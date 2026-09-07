import { GPSTrackPoint, calculateDistanceMeters, calculateBearing } from '@road-gis/shared';
import { offlineDb } from './db.js';

export type GPSSignalStatus = 'EXCELLENT' | 'GOOD' | 'POOR' | 'LOST';

export interface LocationCallback {
  (point: GPSTrackPoint, signalStatus: GPSSignalStatus, message?: string): void;
}

export class GPSTracker {
  private sessionId: string = '';
  private watchId: number | null = null;
  private listeners: LocationCallback[] = [];
  private wakeLock: any = null;
  private accumulatedPoints: GPSTrackPoint[] = [];
  private totalRecordedPoints: number = 0;

  private lastPoint: GPSTrackPoint | null = null;
  private currentSignal: GPSSignalStatus = 'LOST';
  private lastErrorMessage: string = '';

  // 调试与室内演示仿真开关 (默认关闭，真机默认纯硬件 GPS)
  private isDemoSimulationEnabled = false;
  private simTimer: any = null;
  private simSeg = 0;
  private simProgress = 0.0;
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

  async start(sessionId: string, onUpdate?: LocationCallback) {
    this.sessionId = sessionId;
    this.accumulatedPoints = [];
    this.totalRecordedPoints = 0;
    this.currentSignal = 'LOST';
    this.lastErrorMessage = '正在搜索 GPS 卫星信号...';

    if (onUpdate) this.listeners.push(onUpdate);

    // 1. 请求屏幕唤醒锁 (Screen Wake Lock)，防止车载手机锁屏休眠导致 GPS 停摆
    await this.requestWakeLock();

    // 2. 真机优先启动真实设备 GPS
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        this.watchId = navigator.geolocation.watchPosition(
          (pos) => this.handleDevicePosition(pos),
          (err) => this.handleDeviceError(err),
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          }
        );
      } catch (e: any) {
        console.warn('[GPS] Failed to start device geolocation watchPosition:', e);
        this.lastErrorMessage = e.message || 'GPS 启动异常';
      }
    } else {
      this.lastErrorMessage = '当前设备不支持 Geolocation API';
    }

    // 3. 仅当显式开启室内仿真模式时启动模拟器
    if (this.isDemoSimulationEnabled) {
      this.startSimulatedTimer();
    }
  }

  stop() {
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
    if (this.watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.releaseWakeLock();
    this.flushAccumulatedTracks();
  }

  pause() {
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
    if (this.watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  resume() {
    if (this.sessionId) {
      if (this.isDemoSimulationEnabled) {
        this.startSimulatedTimer();
      } else if (typeof navigator !== 'undefined' && 'geolocation' in navigator && this.watchId === null) {
        this.watchId = navigator.geolocation.watchPosition(
          (pos) => this.handleDevicePosition(pos),
          (err) => this.handleDeviceError(err),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      }
    }
  }

  getCurrentPoint(): GPSTrackPoint | null {
    return this.lastPoint;
  }

  getSignalStatus(): GPSSignalStatus {
    return this.currentSignal;
  }

  getLastError(): string {
    return this.lastErrorMessage;
  }

  getRecordedPointCount(): number {
    return this.totalRecordedPoints;
  }

  setDemoSimulation(enabled: boolean) {
    this.isDemoSimulationEnabled = enabled;
    if (!enabled && this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    } else if (enabled && !this.simTimer && this.sessionId) {
      this.startSimulatedTimer();
    }
  }

  isDemoSimulation(): boolean {
    return this.isDemoSimulationEnabled;
  }

  on(cb: LocationCallback) {
    this.listeners.push(cb);
  }

  private handleDevicePosition(pos: GeolocationPosition) {
    const coords = pos.coords;
    const accuracy = coords.accuracy || 10;

    let signal: GPSSignalStatus = 'EXCELLENT';
    if (accuracy > 35) signal = 'POOR';
    else if (accuracy > 15) signal = 'GOOD';
    else if (accuracy <= 5) signal = 'EXCELLENT';

    this.lastErrorMessage = '';

    const pt: GPSTrackPoint = {
      session_id: this.sessionId,
      point_time: new Date(pos.timestamp).toISOString(),
      latitude: coords.latitude,
      longitude: coords.longitude,
      speed_kmh: coords.speed !== null && coords.speed !== undefined
        ? parseFloat((coords.speed * 3.6).toFixed(1))
        : (this.lastPoint?.speed_kmh || 0),
      heading: coords.heading !== null && coords.heading !== undefined
        ? Math.round(coords.heading)
        : (this.lastPoint?.heading || 0),
      altitude: coords.altitude !== null && coords.altitude !== undefined
        ? parseFloat(coords.altitude.toFixed(1))
        : 0,
      accuracy: parseFloat(accuracy.toFixed(1)),
      provider: 'device_gnss',
      is_valid: accuracy <= 50,
    };

    this.emitPoint(pt, signal);
  }

  private handleDeviceError(err: GeolocationPositionError) {
    let msg = 'GPS 定位中...';
    let signal: GPSSignalStatus = 'LOST';

    switch (err.code) {
      case err.PERMISSION_DENIED:
        signal = 'LOST';
        msg = '定位权限被拒绝，请在 Android 系统设置中授予位置权限';
        break;
      case err.POSITION_UNAVAILABLE:
        signal = 'LOST';
        msg = 'GPS 位置暂不可用，请确保手机 GPS 已开启且处于开阔路段';
        break;
      case err.TIMEOUT:
        signal = 'POOR';
        msg = 'GPS 搜星定位超时，正在自动重试...';
        break;
      default:
        signal = 'LOST';
        msg = err.message || '定位出现未知异常';
    }

    this.currentSignal = signal;
    this.lastErrorMessage = msg;

    for (const l of this.listeners) {
      if (this.lastPoint) {
        l(this.lastPoint, signal, msg);
      }
    }
  }

  private startSimulatedTimer() {
    if (!this.simTimer) {
      this.simTimer = setInterval(() => {
        this.stepSimulation();
      }, 1500);
    }
  }

  private stepSimulation() {
    if (this.simSeg >= this.waypoints.length - 1) {
      this.simSeg = 0;
      this.simProgress = 0.0;
    }

    const p1 = this.waypoints[this.simSeg];
    const p2 = this.waypoints[this.simSeg + 1];

    this.simProgress += 0.035;
    if (this.simProgress >= 1.0) {
      this.simSeg++;
      this.simProgress = 0.0;
    }

    const lng = p1[0] + (p2[0] - p1[0]) * this.simProgress + (Math.random() - 0.5) * 0.00004;
    const lat = p1[1] + (p2[1] - p1[1]) * this.simProgress + (Math.random() - 0.5) * 0.00004;
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
      provider: 'gnss_simulation',
      is_valid: true,
    };

    this.emitPoint(pt, 'EXCELLENT');
  }

  private emitPoint(pt: GPSTrackPoint, signal: GPSSignalStatus) {
    this.lastPoint = pt;
    this.currentSignal = signal;
    this.accumulatedPoints.push(pt);
    this.totalRecordedPoints++;

    // 1. 立即写入本地 IndexedDB 持久化存储
    offlineDb.saveTrackPoint(pt);

    // 2. 每 20 个点自动打包并生成待同步任务
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
