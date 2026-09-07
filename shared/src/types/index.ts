import {
  AssetGeometryType,
  AssetStatus,
  PatrolStatus,
  SyncStatus,
  UploadPriority,
  UserRole
} from '../constants/index.js';

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export type GeoGeometry = GeoPoint | GeoLineString | GeoPolygon;

export interface GeoFeature<G extends GeoGeometry = GeoGeometry, P = Record<string, unknown>> {
  type: 'Feature';
  id?: string | number;
  geometry: G;
  properties: P;
}

export interface GeoFeatureCollection<G extends GeoGeometry = GeoGeometry, P = Record<string, unknown>> {
  type: 'FeatureCollection';
  features: GeoFeature<G, P>[];
}

export interface User {
  id: string;
  username: string;
  real_name: string;
  role_id: UserRole;
  phone?: string;
  department: string;
  is_active: boolean;
  created_at: string;
}

export interface Road {
  id: string;
  code: string;               // e.g. G105
  name: string;               // 京澳线
  level: string;              // 国道
  start_milepost: number;     // 120000 (m)
  end_milepost: number;       // 180000 (m)
  total_length_km: number;    // 60
  centerline_geom: GeoLineString;
  created_at: string;
}

export interface AssetType {
  id: string;                 // TRAFFIC_SIGN, MILEPOST, GUARDRAIL, TREE, DISEASE...
  name: string;               // 标识牌、百米桩...
  geometry_type: AssetGeometryType;
  category: string;
  icon: string;
  color: string;
  description?: string;
  is_active: boolean;
}

export interface Asset {
  id: string;
  asset_code: string;         // BZ-G105-K121-001
  type_id: string;            // TRAFFIC_SIGN
  type_name?: string;
  road_id: string;
  road_code?: string;
  geom: GeoGeometry;
  latitude: number;           // WGS84
  longitude: number;          // WGS84
  milepost: string;           // K127+350
  milepost_meters: number;    // 127350
  direction: 'UP' | 'DOWN' | 'BIDIRECTIONAL';
  status: AssetStatus;
  audit_status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  condition_grade: 'A' | 'B' | 'C' | 'D';
  description?: string;
  discovery_time: string;     // ISO timestamp
  patrol_session_id?: string;
  video_slice_id?: string;
  video_offset_seconds?: number;
  created_by?: string;
  creator_name?: string;
  photos?: AssetPhoto[];
  sync_status?: SyncStatus;
  created_at: string;
  updated_at: string;
}

export interface AssetPhoto {
  id: string;
  asset_id: string;
  session_id?: string;
  file_name: string;
  storage_path: string;
  storage_url?: string;
  thumbnail_path?: string;
  thumbnail_url?: string;
  file_size_bytes: number;
  photo_time: string;
  latitude?: number;
  longitude?: number;
  azimuth?: number;
}

export interface GPSTrackPoint {
  id?: number;
  session_id: string;
  point_time: string;
  latitude: number;           // WGS84
  longitude: number;          // WGS84
  speed_kmh: number;
  heading: number;
  altitude: number;
  accuracy: number;
  provider?: string;
  is_valid?: boolean;
}

export interface PatrolSession {
  id: string;                 // PAT-20260907-0001
  user_id: string;
  user_name: string;
  vehicle_plate: string;
  road_id: string;
  road_code: string;
  status: PatrolStatus;
  start_time: string;
  end_time?: string;
  duration_seconds: number;
  distance_km: number;
  asset_count: number;
  anomaly_count: number;
  video_count: number;
  trajectory_geom?: GeoLineString;
  sync_status: SyncStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface VideoSlice {
  id: string;                 // VID-PAT20260907-001
  session_id: string;
  file_name: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  file_size_bytes: number;
  width?: number;
  height?: number;
  storage_path?: string;
  storage_url?: string;
  upload_status: 'PENDING' | 'UPLOADING' | 'COMPLETED' | 'FAILED';
  uploaded_bytes: number;
  md5_checksum?: string;
}

export interface MaintenanceRecord {
  id: string;
  asset_id: string;
  asset_code?: string;
  issue_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reported_time: string;
  reported_by: string;
  status: 'REPORTED' | 'ASSIGNED' | 'IN_REPAIR' | 'REPAIRED' | 'VERIFIED' | 'CLOSED';
  assigned_to?: string;
  assigned_time?: string;
  repair_time?: string;
  repair_desc?: string;
  repair_photos_before?: string[];
  repair_photos_after?: string[];
  cost?: number;
}

export interface UploadTask {
  id: string;
  session_id: string;
  task_type: 'SESSION' | 'TRACK' | 'ASSET' | 'PHOTO' | 'VIDEO';
  priority: UploadPriority;
  resource_id: string;
  file_path?: string;
  total_bytes: number;
  uploaded_bytes: number;
  status: SyncStatus;
  retry_count: number;
  last_error?: string;
}
