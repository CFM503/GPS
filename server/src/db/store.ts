import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  User,
  Road,
  AssetType,
  Asset,
  AssetPhoto,
  GPSTrackPoint,
  PatrolSession,
  VideoSlice,
  MaintenanceRecord,
  UploadTask,
  GeoLineString,
  calculatePointMilepost,
  calculateDistanceMeters,
  wgs84ToGcj02
} from '@road-gis/shared';
import { config } from '../config/index.js';

export interface AuditLogEntry {
  id: number;
  userId?: string;
  username?: string;
  ipAddress?: string;
  module: string;
  action: string;
  targetId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export class DataStore {
  private users: Map<string, User> = new Map();
  private roles: Map<string, { id: string; name: string; description: string }> = new Map();
  private roads: Map<string, Road> = new Map();
  private assetTypes: Map<string, AssetType> = new Map();
  private patrolSessions: Map<string, PatrolSession> = new Map();
  private patrolTracks: Map<string, GPSTrackPoint[]> = new Map(); // sessionId -> tracks
  private assets: Map<string, Asset> = new Map();
  private assetPhotos: Map<string, AssetPhoto[]> = new Map(); // assetId -> photos
  private videoSlices: Map<string, VideoSlice> = new Map();
  private maintenanceRecords: Map<string, MaintenanceRecord> = new Map();
  private uploadTasks: Map<string, UploadTask> = new Map();
  private auditLogs: AuditLogEntry[] = [];
  private nextLogId = 1;

  constructor() {
    this.ensureDirectories();
    this.seedInitialData();
  }

  private ensureDirectories() {
    if (!fs.existsSync(config.uploadTempDir)) {
      fs.mkdirSync(config.uploadTempDir, { recursive: true });
    }
    if (!fs.existsSync(config.uploadStorageDir)) {
      fs.mkdirSync(config.uploadStorageDir, { recursive: true });
    }
  }

  private seedInitialData() {
    // 1. Roles
    this.roles.set('super_admin', { id: 'super_admin', name: '超级管理员', description: '最高权限' });
    this.roles.set('bureau_admin', { id: 'bureau_admin', name: '管理处管理员', description: '业务与审核管理' });
    this.roles.set('patroller', { id: 'patroller', name: '巡查员', description: '移动端巡查与采集' });
    this.roles.set('auditor', { id: 'auditor', name: '审核员', description: '路产与异常核准' });
    this.roles.set('maintainer', { id: 'maintainer', name: '维修人员', description: '路产维护与工单处置' });
    this.roles.set('viewer', { id: 'viewer', name: '只读用户', description: '浏览' });

    // 2. Users
    const defaultUsers: User[] = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        username: 'admin',
        real_name: '系统管理员',
        role_id: 'super_admin',
        phone: '13800138000',
        department: '信息技术部',
        is_active: true,
        created_at: '2026-09-01T08:00:00Z',
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        username: 'zhangsan',
        real_name: '张三',
        role_id: 'patroller',
        phone: '13911112222',
        department: '第一巡查中队',
        is_active: true,
        created_at: '2026-09-01T08:00:00Z',
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        username: 'lisi',
        real_name: '李四',
        role_id: 'auditor',
        phone: '13933334444',
        department: '养护工程科',
        is_active: true,
        created_at: '2026-09-01T08:00:00Z',
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        username: 'wangwu',
        real_name: '王五',
        role_id: 'maintainer',
        phone: '13955556666',
        department: '应急维修队',
        is_active: true,
        created_at: '2026-09-01T08:00:00Z',
      },
    ];
    for (const u of defaultUsers) {
      this.users.set(u.id, u);
    }

    // 3. Asset Types
    const types: AssetType[] = [
      { id: 'TRAFFIC_SIGN', name: '道路交通标识牌', geometry_type: 'POINT', category: 'FACILITY', icon: 'signpost', color: '#3B82F6', is_active: true },
      { id: 'MILEPOST', name: '里程碑', geometry_type: 'POINT', category: 'FACILITY', icon: 'milestone', color: '#10B981', is_active: true },
      { id: 'HUNDRED_METER_POST', name: '百米桩', geometry_type: 'POINT', category: 'FACILITY', icon: 'flag', color: '#059669', is_active: true },
      { id: 'GUARDRAIL', name: '波形梁钢护栏', geometry_type: 'LINESTRING', category: 'SAFETY', icon: 'shield', color: '#F59E0B', is_active: true },
      { id: 'CRASH_BARRIER', name: '防撞设施', geometry_type: 'POINT', category: 'SAFETY', icon: 'alert-triangle', color: '#EA580C', is_active: true },
      { id: 'TREE', name: '绿化林木', geometry_type: 'POINT', category: 'GREENING', icon: 'trees', color: '#16A34A', is_active: true },
      { id: 'GREENBELT', name: '绿化隔离带', geometry_type: 'POLYGON', category: 'GREENING', icon: 'flower', color: '#84CC16', is_active: true },
      { id: 'STREET_LIGHT', name: '道路路灯', geometry_type: 'POINT', category: 'FACILITY', icon: 'lamp', color: '#EAB308', is_active: true },
      { id: 'DRAINAGE', name: '排水设施/边沟', geometry_type: 'LINESTRING', category: 'FACILITY', icon: 'droplets', color: '#06B6D4', is_active: true },
      { id: 'BRIDGE', name: '公路桥梁', geometry_type: 'POINT', category: 'STRUCTURE', icon: 'anchor', color: '#6366F1', is_active: true },
      { id: 'CULVERT', name: '公路涵洞', geometry_type: 'POINT', category: 'STRUCTURE', icon: 'box', color: '#8B5CF6', is_active: true },
      { id: 'SLOPE', name: '路基边坡', geometry_type: 'POLYGON', category: 'STRUCTURE', icon: 'mountain', color: '#D97706', is_active: true },
      { id: 'CONSTRUCTION', name: '养护施工区域', geometry_type: 'POLYGON', category: 'SAFETY', icon: 'cone', color: '#EF4444', is_active: true },
      { id: 'DISEASE', name: '道路路面病害', geometry_type: 'POLYGON', category: 'PAVEMENT', icon: 'activity', color: '#DC2626', is_active: true },
      { id: 'OTHER', name: '其他道路附属设施', geometry_type: 'POINT', category: 'FACILITY', icon: 'layers', color: '#6B7280', is_active: true },
    ];
    for (const t of types) {
      this.assetTypes.set(t.id, t);
    }

    // 4. Roads (G105)
    const g105Road: Road = {
      id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      code: 'G105',
      name: '国道105 (京澳线示范段)',
      level: '国道',
      start_milepost: 120000.0,
      end_milepost: 180000.0,
      total_length_km: 60.0,
      centerline_geom: {
        type: 'LineString',
        coordinates: [
          [113.250000, 23.100000],
          [113.265000, 23.125000],
          [113.280000, 23.150000],
          [113.295000, 23.180000],
          [113.310000, 23.210000],
          [113.330000, 23.245000],
          [113.355000, 23.280000],
          [113.380000, 23.320000],
          [113.410000, 23.365000],
          [113.445000, 23.410000],
        ],
      },
      created_at: '2026-09-01T08:00:00Z',
    };
    this.roads.set(g105Road.id, g105Road);

    // 5. Patrol Session (PAT-20260907-0001)
    const session1: PatrolSession = {
      id: 'PAT-20260907-0001',
      user_id: '22222222-2222-2222-2222-222222222222',
      user_name: '张三',
      vehicle_plate: '粤A12345',
      road_id: g105Road.id,
      road_code: 'G105',
      status: 'COMPLETED',
      start_time: '2026-09-07T08:30:12+08:00',
      end_time: '2026-09-07T11:02:45+08:00',
      duration_seconds: 9153,
      distance_km: 42.8,
      asset_count: 4,
      anomaly_count: 1,
      video_count: 3,
      trajectory_geom: {
        type: 'LineString',
        coordinates: [
          [113.250100, 23.100100],
          [113.265080, 23.125050],
          [113.280120, 23.150090],
          [113.295050, 23.180040],
          [113.310080, 23.210060],
          [113.330040, 23.245030],
        ],
      },
      sync_status: 'UPLOADED',
      notes: '常规早班巡查，天气晴好，路况良好。',
      created_at: '2026-09-07T08:30:12+08:00',
      updated_at: '2026-09-07T11:02:45+08:00',
    };
    this.patrolSessions.set(session1.id, session1);

    // 6. Video Slices
    const v1: VideoSlice = {
      id: 'VID-PAT20260907-001',
      session_id: session1.id,
      file_name: 'VIDEO_001.mp4',
      start_time: '2026-09-07T08:30:12+08:00',
      end_time: '2026-09-07T08:35:12+08:00',
      duration_seconds: 300,
      file_size_bytes: 104857600,
      width: 1920,
      height: 1080,
      storage_path: 'videos/PAT-20260907-0001/VIDEO_001.mp4',
      storage_url: '/api/v1/videos/stream/VID-PAT20260907-001',
      upload_status: 'COMPLETED',
      uploaded_bytes: 104857600,
    };
    const v2: VideoSlice = {
      id: 'VID-PAT20260907-002',
      session_id: session1.id,
      file_name: 'VIDEO_002.mp4',
      start_time: '2026-09-07T08:35:12+08:00',
      end_time: '2026-09-07T08:40:12+08:00',
      duration_seconds: 300,
      file_size_bytes: 104857600,
      width: 1920,
      height: 1080,
      storage_path: 'videos/PAT-20260907-0001/VIDEO_002.mp4',
      storage_url: '/api/v1/videos/stream/VID-PAT20260907-002',
      upload_status: 'COMPLETED',
      uploaded_bytes: 104857600,
    };
    const v3: VideoSlice = {
      id: 'VID-PAT20260907-003',
      session_id: session1.id,
      file_name: 'VIDEO_003.mp4',
      start_time: '2026-09-07T08:40:12+08:00',
      end_time: '2026-09-07T08:45:12+08:00',
      duration_seconds: 300,
      file_size_bytes: 104857600,
      width: 1920,
      height: 1080,
      storage_path: 'videos/PAT-20260907-0001/VIDEO_003.mp4',
      storage_url: '/api/v1/videos/stream/VID-PAT20260907-003',
      upload_status: 'COMPLETED',
      uploaded_bytes: 104857600,
    };
    this.videoSlices.set(v1.id, v1);
    this.videoSlices.set(v2.id, v2);
    this.videoSlices.set(v3.id, v3);

    // 7. Assets (Point, Line, Polygon)
    const asset1: Asset = {
      id: 'b0000001-0000-0000-0000-000000000001',
      asset_code: 'BZ-G105-K121-001',
      type_id: 'TRAFFIC_SIGN',
      type_name: '道路交通标识牌',
      road_id: g105Road.id,
      road_code: 'G105',
      geom: { type: 'Point', coordinates: [113.253000, 23.105000] },
      latitude: 23.105000,
      longitude: 113.253000,
      milepost: 'K121+200',
      milepost_meters: 121200.0,
      direction: 'UP',
      status: 'NORMAL',
      audit_status: 'APPROVED',
      condition_grade: 'A',
      description: '限速60标志牌，反光膜完好清晰',
      discovery_time: '2026-09-07T08:32:45+08:00',
      patrol_session_id: session1.id,
      video_slice_id: v1.id,
      video_offset_seconds: 153.0,
      created_by: '22222222-2222-2222-2222-222222222222',
      creator_name: '张三',
      sync_status: 'UPLOADED',
      created_at: '2026-09-07T08:32:45+08:00',
      updated_at: '2026-09-07T08:32:45+08:00',
    };

    const asset2: Asset = {
      id: 'b0000002-0000-0000-0000-000000000002',
      asset_code: 'BMZ-G105-K123-005',
      type_id: 'HUNDRED_METER_POST',
      type_name: '百米桩',
      road_id: g105Road.id,
      road_code: 'G105',
      geom: { type: 'Point', coordinates: [113.268000, 23.130000] },
      latitude: 23.130000,
      longitude: 113.268000,
      milepost: 'K123+500',
      milepost_meters: 123500.0,
      direction: 'UP',
      status: 'NORMAL',
      audit_status: 'APPROVED',
      condition_grade: 'A',
      description: '百米桩字迹清晰，无倾斜',
      discovery_time: '2026-09-07T08:36:10+08:00',
      patrol_session_id: session1.id,
      video_slice_id: v2.id,
      video_offset_seconds: 58.0,
      created_by: '22222222-2222-2222-2222-222222222222',
      creator_name: '张三',
      sync_status: 'UPLOADED',
      created_at: '2026-09-07T08:36:10+08:00',
      updated_at: '2026-09-07T08:36:10+08:00',
    };

    const asset3: Asset = {
      id: 'b0000003-0000-0000-0000-000000000003',
      asset_code: 'HL-G105-K125-001',
      type_id: 'GUARDRAIL',
      type_name: '波形梁钢护栏',
      road_id: g105Road.id,
      road_code: 'G105',
      geom: {
        type: 'LineString',
        coordinates: [
          [113.275000, 23.142000],
          [113.278000, 23.147000],
          [113.282000, 23.153000],
        ],
      },
      latitude: 23.147000,
      longitude: 113.278000,
      milepost: 'K125+100',
      milepost_meters: 125100.0,
      direction: 'UP',
      status: 'NORMAL',
      audit_status: 'APPROVED',
      condition_grade: 'A',
      description: '右侧波形梁护栏连续段，结构稳固',
      discovery_time: '2026-09-07T08:38:20+08:00',
      patrol_session_id: session1.id,
      video_slice_id: v2.id,
      video_offset_seconds: 188.0,
      created_by: '22222222-2222-2222-2222-222222222222',
      creator_name: '张三',
      sync_status: 'UPLOADED',
      created_at: '2026-09-07T08:38:20+08:00',
      updated_at: '2026-09-07T08:38:20+08:00',
    };

    const asset4: Asset = {
      id: 'b0000004-0000-0000-0000-000000000004',
      asset_code: 'BH-G105-K127-001',
      type_id: 'DISEASE',
      type_name: '道路路面病害',
      road_id: g105Road.id,
      road_code: 'G105',
      geom: {
        type: 'Polygon',
        coordinates: [[
          [113.292000, 23.175000],
          [113.292500, 23.175000],
          [113.292500, 23.176000],
          [113.292000, 23.176000],
          [113.292000, 23.175000],
        ]],
      },
      latitude: 23.175500,
      longitude: 113.292250,
      milepost: 'K127+350',
      milepost_meters: 127350.0,
      direction: 'UP',
      status: 'ABNORMAL',
      audit_status: 'APPROVED',
      condition_grade: 'D',
      description: '主车道沥青路面严重坑槽，面积约8平方米，深度约5cm',
      discovery_time: '2026-09-07T08:42:15+08:00',
      patrol_session_id: session1.id,
      video_slice_id: v3.id,
      video_offset_seconds: 123.0,
      created_by: '22222222-2222-2222-2222-222222222222',
      creator_name: '张三',
      sync_status: 'UPLOADED',
      created_at: '2026-09-07T08:42:15+08:00',
      updated_at: '2026-09-07T08:42:15+08:00',
    };

    this.assets.set(asset1.id, asset1);
    this.assets.set(asset2.id, asset2);
    this.assets.set(asset3.id, asset3);
    this.assets.set(asset4.id, asset4);

    // 8. Maintenance record
    const maint1: MaintenanceRecord = {
      id: 'c0000001-0000-0000-0000-000000000001',
      asset_id: asset4.id,
      asset_code: asset4.asset_code,
      issue_type: '路面坑槽破损',
      severity: 'HIGH',
      reported_time: '2026-09-07T08:45:00+08:00',
      reported_by: '张三',
      status: 'ASSIGNED',
      assigned_to: '王五',
      assigned_time: '2026-09-07T09:00:00+08:00',
      repair_desc: '已安排养护一班携带沥青冷补料出勤处理',
    };
    this.maintenanceRecords.set(maint1.id, maint1);
  }

  // --- Users & Auth ---
  getUserByUsername(username: string): User | undefined {
    for (const u of this.users.values()) {
      if (u.username === username) return u;
    }
    return undefined;
  }

  getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  // --- Roads ---
  getAllRoads(): Road[] {
    return Array.from(this.roads.values());
  }

  getRoadById(id: string): Road | undefined {
    return this.roads.get(id);
  }

  // --- Asset Types ---
  getAssetTypes(): AssetType[] {
    return Array.from(this.assetTypes.values());
  }

  addAssetType(type: AssetType): AssetType {
    this.assetTypes.set(type.id, type);
    return type;
  }

  // --- Patrol Sessions ---
  createPatrolSession(sessionData: Partial<PatrolSession>): PatrolSession {
    const id = sessionData.id || `PAT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const session: PatrolSession = {
      id,
      user_id: sessionData.user_id || '',
      user_name: sessionData.user_name || '巡查员',
      vehicle_plate: sessionData.vehicle_plate || '粤A00001',
      road_id: sessionData.road_id || Array.from(this.roads.keys())[0],
      road_code: sessionData.road_code || 'G105',
      status: 'IN_PROGRESS',
      start_time: sessionData.start_time || new Date().toISOString(),
      duration_seconds: 0,
      distance_km: 0,
      asset_count: 0,
      anomaly_count: 0,
      video_count: 0,
      sync_status: 'UPLOADED',
      notes: sessionData.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.patrolSessions.set(id, session);
    return session;
  }

  finishPatrolSession(
    id: string,
    update: {
      end_time?: string;
      distance_km?: number;
      duration_seconds?: number;
      notes?: string;
    }
  ): PatrolSession | undefined {
    const session = this.patrolSessions.get(id);
    if (!session) return undefined;

    session.status = 'COMPLETED';
    session.end_time = update.end_time || new Date().toISOString();
    if (update.distance_km !== undefined) session.distance_km = update.distance_km;
    if (update.duration_seconds !== undefined) session.duration_seconds = update.duration_seconds;
    if (update.notes !== undefined) session.notes = update.notes;
    session.updated_at = new Date().toISOString();

    // 自动根据打点生成轨迹折线 LineString
    const tracks = this.patrolTracks.get(id) || [];
    if (tracks.length >= 2) {
      session.trajectory_geom = {
        type: 'LineString',
        coordinates: tracks.map((t) => [t.longitude, t.latitude]),
      };
    }

    return session;
  }

  getPatrolSession(id: string): PatrolSession | undefined {
    return this.patrolSessions.get(id);
  }

  listPatrolSessions(filter?: { roadId?: string; status?: string }): PatrolSession[] {
    let list = Array.from(this.patrolSessions.values());
    if (filter?.roadId) list = list.filter((s) => s.road_id === filter.roadId);
    if (filter?.status) list = list.filter((s) => s.status === filter.status);
    return list.sort((a, b) => (b.start_time > a.start_time ? 1 : -1));
  }

  // --- GPS Tracks ---
  addTrackPoints(sessionId: string, points: GPSTrackPoint[]): number {
    const session = this.patrolSessions.get(sessionId);
    if (!this.patrolTracks.has(sessionId)) {
      this.patrolTracks.set(sessionId, []);
    }
    const list = this.patrolTracks.get(sessionId)!;

    // 清洗漂移点并追加
    for (const p of points) {
      p.is_valid = p.accuracy <= 50; // 精度50米内有效
      list.push(p);
    }

    // 重新计算里程
    if (list.length >= 2 && session && session.status === 'IN_PROGRESS') {
      let distMeters = 0;
      for (let i = 0; i < list.length - 1; i++) {
        if (list[i].is_valid && list[i + 1].is_valid) {
          distMeters += calculateDistanceMeters(
            [list[i].longitude, list[i].latitude],
            [list[i + 1].longitude, list[i + 1].latitude]
          );
        }
      }
      session.distance_km = parseFloat((distMeters / 1000).toFixed(2));
      session.updated_at = new Date().toISOString();
    }

    return points.length;
  }

  getTrackPoints(sessionId: string): GPSTrackPoint[] {
    return this.patrolTracks.get(sessionId) || [];
  }

  // --- Assets ---
  createAsset(assetData: Partial<Asset>): Asset {
    const id = assetData.id || crypto.randomUUID();
    const road = this.roads.get(assetData.road_id || '') || Array.from(this.roads.values())[0];
    const assetType = this.assetTypes.get(assetData.type_id || 'OTHER') || this.assetTypes.get('OTHER')!;

    const lng = assetData.longitude ?? 113.25;
    const lat = assetData.latitude ?? 23.10;

    // 自动投影计算道路桩号
    const projection = calculatePointMilepost([lng, lat], road.centerline_geom.coordinates, road.start_milepost);

    // 查找对应录像切片及偏移秒数
    let videoSliceId = assetData.video_slice_id;
    let videoOffset = assetData.video_offset_seconds;
    const discTime = assetData.discovery_time || new Date().toISOString();
    const discTimestamp = new Date(discTime).getTime();

    if (!videoSliceId && assetData.patrol_session_id) {
      for (const v of this.videoSlices.values()) {
        if (v.session_id === assetData.patrol_session_id) {
          const vStart = new Date(v.start_time).getTime();
          const vEnd = new Date(v.end_time).getTime();
          if (discTimestamp >= vStart && discTimestamp <= vEnd) {
            videoSliceId = v.id;
            videoOffset = Math.round((discTimestamp - vStart) / 1000);
            break;
          }
        }
      }
    }

    const asset: Asset = {
      id,
      asset_code: assetData.asset_code || `ASSET-${road.code}-${projection.milepostStr.replace('+', '_')}-${Math.floor(100 + Math.random() * 900)}`,
      type_id: assetType.id,
      type_name: assetType.name,
      road_id: road.id,
      road_code: road.code,
      geom: assetData.geom || { type: 'Point', coordinates: [lng, lat] },
      latitude: lat,
      longitude: lng,
      milepost: assetData.milepost || projection.milepostStr,
      milepost_meters: assetData.milepost_meters || projection.milepostMeters,
      direction: assetData.direction || 'UP',
      status: assetData.status || 'NORMAL',
      audit_status: assetData.audit_status || 'APPROVED',
      condition_grade: assetData.condition_grade || 'A',
      description: assetData.description || '',
      discovery_time: discTime,
      patrol_session_id: assetData.patrol_session_id,
      video_slice_id: videoSliceId,
      video_offset_seconds: videoOffset,
      created_by: assetData.created_by,
      creator_name: assetData.creator_name || '巡查员',
      sync_status: 'UPLOADED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.assets.set(id, asset);

    // 递增 session 采集计数
    if (asset.patrol_session_id && this.patrolSessions.has(asset.patrol_session_id)) {
      const s = this.patrolSessions.get(asset.patrol_session_id)!;
      s.asset_count += 1;
      if (asset.status === 'ABNORMAL' || asset.status === 'DAMAGED') {
        s.anomaly_count += 1;
      }
    }

    return asset;
  }

  updateAsset(id: string, update: Partial<Asset>): Asset | undefined {
    const asset = this.assets.get(id);
    if (!asset) return undefined;
    Object.assign(asset, update);
    asset.updated_at = new Date().toISOString();
    return asset;
  }

  getAssetById(id: string): Asset | undefined {
    const asset = this.assets.get(id);
    if (asset) {
      asset.photos = this.assetPhotos.get(id) || [];
    }
    return asset;
  }

  listAssets(filter?: {
    roadId?: string;
    typeId?: string;
    status?: string;
    minMilepost?: number;
    maxMilepost?: number;
    sessionId?: string;
  }): Asset[] {
    let list = Array.from(this.assets.values());
    if (filter?.roadId) list = list.filter((a) => a.road_id === filter.roadId);
    if (filter?.typeId) list = list.filter((a) => a.type_id === filter.typeId);
    if (filter?.status) list = list.filter((a) => a.status === filter.status);
    if (filter?.sessionId) list = list.filter((a) => a.patrol_session_id === filter.sessionId);
    if (filter?.minMilepost !== undefined) list = list.filter((a) => a.milepost_meters >= filter.minMilepost!);
    if (filter?.maxMilepost !== undefined) list = list.filter((a) => a.milepost_meters <= filter.maxMilepost!);
    return list;
  }

  getAssetsInBBox(minLng: number, minLat: number, maxLng: number, maxLat: number): Asset[] {
    return Array.from(this.assets.values()).filter((a) => {
      return a.longitude >= minLng && a.longitude <= maxLng && a.latitude >= minLat && a.latitude <= maxLat;
    });
  }

  // --- Video Slices & Resumable Upload ---
  registerVideoSlice(slice: VideoSlice): VideoSlice {
    this.videoSlices.set(slice.id, slice);
    if (slice.session_id && this.patrolSessions.has(slice.session_id)) {
      this.patrolSessions.get(slice.session_id)!.video_count += 1;
    }
    return slice;
  }

  getVideoSlice(id: string): VideoSlice | undefined {
    return this.videoSlices.get(id);
  }

  listVideoSlices(sessionId?: string): VideoSlice[] {
    let list = Array.from(this.videoSlices.values());
    if (sessionId) list = list.filter((v) => v.session_id === sessionId);
    return list;
  }

  locateVideo(timestampIso: string): { video: VideoSlice; offsetSeconds: number } | null {
    const targetTime = new Date(timestampIso).getTime();
    for (const v of this.videoSlices.values()) {
      const vStart = new Date(v.start_time).getTime();
      const vEnd = new Date(v.end_time).getTime();
      if (targetTime >= vStart && targetTime <= vEnd) {
        return {
          video: v,
          offsetSeconds: Math.round((targetTime - vStart) / 1000),
        };
      }
    }
    return null;
  }

  appendVideoChunk(sliceId: string, chunkBuffer: Buffer, uploadOffset: number): { uploadedBytes: number; completed: boolean } {
    const slice = this.videoSlices.get(sliceId);
    if (!slice) throw new Error(`Video slice ${sliceId} not found`);

    const chunkPath = path.join(config.uploadTempDir, `${sliceId}.part`);
    let currentSize = 0;
    if (fs.existsSync(chunkPath)) {
      currentSize = fs.statSync(chunkPath).size;
    }

    if (uploadOffset !== currentSize) {
      throw new Error(`Upload offset mismatch: client sent ${uploadOffset}, server expected ${currentSize}`);
    }

    fs.appendFileSync(chunkPath, chunkBuffer);
    slice.uploaded_bytes = currentSize + chunkBuffer.length;
    slice.upload_status = 'UPLOADING';

    const completed = slice.uploaded_bytes >= slice.file_size_bytes;
    if (completed) {
      slice.upload_status = 'COMPLETED';
      const finalPath = path.join(config.uploadStorageDir, `${sliceId}.mp4`);
      fs.renameSync(chunkPath, finalPath);
      slice.storage_path = finalPath;
      slice.storage_url = `/api/v1/videos/stream/${sliceId}`;
    }

    return { uploadedBytes: slice.uploaded_bytes, completed };
  }

  // --- Photos ---
  addPhoto(photo: AssetPhoto): AssetPhoto {
    if (!this.assetPhotos.has(photo.asset_id)) {
      this.assetPhotos.set(photo.asset_id, []);
    }
    this.assetPhotos.get(photo.asset_id)!.push(photo);
    return photo;
  }

  getPhotosByAsset(assetId: string): AssetPhoto[] {
    return this.assetPhotos.get(assetId) || [];
  }

  // --- Maintenance ---
  createMaintenanceRecord(rec: MaintenanceRecord): MaintenanceRecord {
    rec.id = rec.id || crypto.randomUUID();
    rec.status = 'REPORTED';
    this.maintenanceRecords.set(rec.id, rec);
    return rec;
  }

  updateMaintenanceRecord(id: string, update: Partial<MaintenanceRecord>): MaintenanceRecord | undefined {
    const rec = this.maintenanceRecords.get(id);
    if (!rec) return undefined;
    Object.assign(rec, update);
    return rec;
  }

  listMaintenanceRecords(status?: string): MaintenanceRecord[] {
    let list = Array.from(this.maintenanceRecords.values());
    if (status) list = list.filter((r) => r.status === status);
    return list.sort((a, b) => (b.reported_time > a.reported_time ? 1 : -1));
  }

  // --- Audit Logs ---
  addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): AuditLogEntry {
    const log: AuditLogEntry = {
      id: this.nextLogId++,
      ...entry,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 500) this.auditLogs.pop();
    return log;
  }

  getAuditLogs(): AuditLogEntry[] {
    return this.auditLogs;
  }

  // --- Statistics Dashboard ---
  getDashboardStats() {
    const totalRoads = this.roads.size;
    let totalRoadMileageKm = 0;
    for (const r of this.roads.values()) {
      totalRoadMileageKm += r.total_length_km;
    }

    const totalAssets = this.assets.size;
    let abnormalAssets = 0;
    let repairedAssets = 0;
    for (const a of this.assets.values()) {
      if (a.status === 'ABNORMAL' || a.status === 'DAMAGED' || a.status === 'MISSING') {
        abnormalAssets++;
      } else if (a.status === 'REPAIRED') {
        repairedAssets++;
      }
    }

    let todayPatrolKm = 0;
    let monthPatrolKm = 0;
    let monthPatrolCount = 0;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthStr = now.toISOString().slice(0, 7);

    for (const s of this.patrolSessions.values()) {
      if (s.start_time.startsWith(todayStr)) {
        todayPatrolKm += s.distance_km;
      }
      if (s.start_time.startsWith(monthStr)) {
        monthPatrolKm += s.distance_km;
        monthPatrolCount++;
      }
    }

    // Asset type distribution
    const typeDistribution: Record<string, number> = {};
    for (const a of this.assets.values()) {
      typeDistribution[a.type_id] = (typeDistribution[a.type_id] || 0) + 1;
    }

    return {
      totalRoads,
      totalRoadMileageKm: parseFloat(totalRoadMileageKm.toFixed(1)),
      totalAssets,
      todayPatrolKm: parseFloat(todayPatrolKm.toFixed(1)),
      monthPatrolKm: parseFloat(monthPatrolKm.toFixed(1)),
      monthPatrolCount,
      abnormalAssets,
      pendingMaintenance: this.listMaintenanceRecords('REPORTED').length + this.listMaintenanceRecords('ASSIGNED').length,
      repairedAssets,
      typeDistribution,
    };
  }
}

export const dbStore = new DataStore();
