import { GPSTrackPoint, calculateDistanceMeters, calculateBearing } from '@road-gis/shared';
import { offlineDb } from './db.js';

export interface LocationCallback {
  (point: GPSTrackPoint): void;
}

export class GPSTracker {
  private sessionId: string = '';
  private timer: any = null;
  private listeners: LocationCallback[] = [];

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

  start(sessionId: string, onUpdate?: LocationCallback) {
    this.sessionId = sessionId;
    if (onUpdate) this.listeners.push(onUpdate);

    // 优先调用浏览器真实定位，无定位或在车辆模拟模式下运行平滑轨迹发生器
    this.timer = setInterval(() => {
      this.step();
    }, 1500);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getCurrentPoint(): GPSTrackPoint | null {
    return this.lastPoint;
  }

  on(cb: LocationCallback) {
    this.listeners.push(cb);
  }

  private step() {
    if (this.currentSeg >= this.waypoints.length - 1) {
      this.currentSeg = 0;
      this.segProgress = 0.0;
    }

    const p1 = this.waypoints[this.currentSeg];
    const p2 = this.waypoints[this.currentSeg + 1];

    // 车速 60 km/h = 16.6 m/s
    this.segProgress += 0.04;
    if (this.segProgress >= 1.0) {
      this.currentSeg++;
      this.segProgress = 0.0;
    }

    const lng = p1[0] + (p2[0] - p1[0]) * this.segProgress + (Math.random() - 0.5) * 0.00005;
    const lat = p1[1] + (p2[1] - p1[1]) * this.segProgress + (Math.random() - 0.5) * 0.00005;
    const heading = calculateBearing(p1, p2);
    const speed = 55 + Math.random() * 8; // 55~63 km/h
    const accuracy = 3.5 + Math.random() * 2.5; // 高精度 3.5~6米

    const pt: GPSTrackPoint = {
      session_id: this.sessionId,
      point_time: new Date().toISOString(),
      latitude: lat,
      longitude: lng,
      speed_kmh: parseFloat(speed.toFixed(1)),
      heading: Math.round(heading),
      altitude: 24.5,
      accuracy: parseFloat(accuracy.toFixed(1)),
      provider: 'gps_gnss',
      is_valid: true,
    };

    this.lastPoint = pt;
    offlineDb.saveTrackPoint(pt);

    for (const l of this.listeners) {
      l(pt);
    }
  }
}

export const gpsTracker = new GPSTracker();
