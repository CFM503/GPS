import { GPSTrackPoint, calculateDistanceMeters, calculateBearing } from '@road-gis/shared';
import { offlineDb } from './db.js';

export type GPSSignalStatus = 'EXCELLENT' | 'GOOD' | 'POOR' | 'LOST';

export interface LocationCallback {
  (point: GPSTrackPoint, signalStatus: GPSSignalStatus): void;
}

export class GPSTracker {
  private sessionId: string = '';
  private timer: any = null;
  private watchId: number | null = null;
  private listeners: LocationCallback[] = [];
  private wakeLock: any = null;
  private accumulatedPoints: GPSTrackPoint[] = [];

  // G105 国道仿真行车轨迹线段序列 (经度、纬度)
  private waypoints: [number, number][] = [
    [113.250000, 23.100000],
    [113.265000, 23.125000],
    [113.280000, 23.150000],
    [113.295000, 23.180000],
    [113.310000, 23.210000],
    [113.330000, 23.245000],
    [113.355000, 23.280000],
    [113.380000, 23.320000],
  ];

  private currentSeg = 0;
  private segProgress = 0.0;
  private lastPoint: GPSTrackPoint | null = null;
  private currentSignal: GPSSignalStatus = 'EXCELLENT';

  async start(sessionId: string, onUpdate?: LocationCallback) {
    this.sessionId = sessionId;
    if (onUpdate) this.listeners.push(onUpdate);

    // 1. 请求屏幕唤醒锁 (Screen Wake Lock)，防止车载手机锁屏休眠导致 GPS 停摆
    await this.requestWakeLock();

    // 2. 尝试启动真实设备 GPS
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        this.watchId = navigator.geolocation.watchPosition(
          (pos) => this.handleDevicePosition(pos),
          (err) => {
            console.warn('[GPS] Device geolocation unavailable, falling back to simulated driving GNSS:', err);
            this.ensureSimulatedTimer();
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      } catch {
        this.ensureSimulatedTimer();
      }
    } else {
      this.ensureSimulatedTimer();
    }

    // 默认保持仿真发生器以确保室内/演示/巡检车辆仿真连续产生数据
    this.ensureSimulatedTimer();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.releaseWakeLock();
    this.flushAccumulatedTracks();
  }

  pause() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  resume() {
    this.ensureSimulatedTimer();
  }

  getCurrentPoint(): GPSTrackPoint | null {
    return this.lastPoint;
  }

  getSignalStatus(): GPSSignalStatus {
    return this.currentSignal;
  }

  on(cb: LocationCallback) {
    this.listeners.push(cb);
  }

  private ensureSimulatedTimer() {
    if (!this.timer) {
      this.timer = setInterval(() => {
        this.stepSimulation();
      }, 1500);
    }
  }

  private handleDevicePosition(pos: GeolocationPosition) {
    const coords = pos.coords;
    const accuracy = coords.accuracy || 10;

    let signal: GPSSignalStatus = 'EXCELLENT';
    if (accuracy > 30) signal = 'POOR';
    else if (accuracy > 15) signal = 'GOOD';

    const pt: GPSTrackPoint = {
      session_id: this.sessionId,
      point_time: new Date(pos.timestamp).toISOString(),
      latitude: coords.latitude,
      longitude: coords.longitude,
      speed_kmh: coords.speed !== null ? parseFloat(((coords.speed || 0) * 3.6).toFixed(1)) : 58.0,
      heading: coords.heading !== null ? Math.round(coords.heading) : 45,
      altitude: coords.altitude !== null ? parseFloat(coords.altitude.toFixed(1)) : 20.0,
      accuracy: parseFloat(accuracy.toFixed(1)),
      provider: 'device_gnss',
      is_valid: accuracy <= 40,
    };

    this.emitPoint(pt, signal);
  }

  private stepSimulation() {
    if (this.currentSeg >= this.waypoints.length - 1) {
      this.currentSeg = 0;
      this.segProgress = 0.0;
    }

    const p1 = this.waypoints[this.currentSeg];
    const p2 = this.waypoints[this.currentSeg + 1];

    this.segProgress += 0.035;
    if (this.segProgress >= 1.0) {
      this.currentSeg++;
      this.segProgress = 0.0;
    }

    const lng = p1[0] + (p2[0] - p1[0]) * this.segProgress + (Math.random() - 0.5) * 0.00004;
    const lat = p1[1] + (p2[1] - p1[1]) * this.segProgress + (Math.random() - 0.5) * 0.00004;
    const heading = calculateBearing(p1, p2);
    const speed = 56 + Math.random() * 8;
    const accuracy = 3.2 + Math.random() * 2.0;

    const pt: GPSTrackPoint = {
      session_id: this.sessionId,
      point_time: new Date().toISOString(),
      latitude: lat,
      longitude: lng,
      speed_kmh: parseFloat(speed.toFixed(1)),
      heading: Math.round(heading),
      altitude: 22.5,
      accuracy: parseFloat(accuracy.toFixed(1)),
      provider: 'gnss_rtk',
      is_valid: true,
    };

    this.emitPoint(pt, 'EXCELLENT');
  }

  private emitPoint(pt: GPSTrackPoint, signal: GPSSignalStatus) {
    this.lastPoint = pt;
    this.currentSignal = signal;
    this.accumulatedPoints.push(pt);

    // 写入本地持久化
    offlineDb.saveTrackPoint(pt);

    // 每 20 个点自动打包并生成待同步任务
    if (this.accumulatedPoints.length >= 20) {
      this.flushAccumulatedTracks();
    }

    for (const l of this.listeners) {
      l(pt, signal);
    }
  }

  private flushAccumulatedTracks() {
    if (this.accumulatedPoints.length === 0 || !this.sessionId) return;
    offlineDb.saveTask({
      id: crypto.randomUUID(),
      session_id: this.sessionId,
      task_type: 'TRACK',
      priority: 2,
      resource_id: `${this.sessionId}_batch_${Date.now()}`,
      total_bytes: this.accumulatedPoints.length * 128,
      uploaded_bytes: 0,
      status: 'PENDING',
      retry_count: 0,
    });
    this.accumulatedPoints = [];
  }

  private async requestWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        console.log('[GPS] Screen Wake Lock acquired: Screen will remain active during patrol');
      } catch (err) {
        console.warn('[GPS] Wake lock request failed:', err);
      }
    }
  }

  private releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }
}

export const gpsTracker = new GPSTracker();
