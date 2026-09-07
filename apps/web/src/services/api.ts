import {
  Road,
  Asset,
  AssetType,
  PatrolSession,
  GPSTrackPoint,
  VideoSlice,
  MaintenanceRecord,
  GeoFeatureCollection
} from '@road-gis/shared';

const BASE_URL = '/api/v1';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-dev-user-id': 'admin', // 默认开发认证标识
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed with status ${res.status}`);
  }

  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export const api = {
  // 统计看板
  getDashboardStats: () => request<any>('/stats/dashboard'),

  // 道路
  getRoads: () => request<GeoFeatureCollection>('/gis/roads'),

  // 路产与字典
  getAssetTypes: () => request<AssetType[]>('/assets/types'),
  getAssets: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Asset[]>(`/assets${qs}`);
  },
  getAssetById: (id: string) => request<Asset>(`/assets/${id}`),
  updateAsset: (id: string, data: Partial<Asset>) =>
    request<Asset>(`/assets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // 巡查会话与轨迹
  getPatrolSessions: () => request<PatrolSession[]>('/patrol/sessions'),
  getPatrolSessionById: (id: string) => request<any>(`/patrol/sessions/${id}`),
  getTrackPoints: (sessionId: string) => request<GPSTrackPoint[]>(`/tracks/session/${sessionId}`),
  getTrackGeoJson: (sessionId: string) => request<GeoFeatureCollection>(`/tracks/session/${sessionId}/geojson`),

  // 视频切片与秒级定位
  getVideoSlices: (sessionId?: string) =>
    request<VideoSlice[]>(sessionId ? `/videos/session/${sessionId}` : '/videos/slices'),
  locateVideo: (timestamp: string) =>
    request<{ videoSlice: VideoSlice; offsetSeconds: number; timestamp: string }>(
      `/videos/locate?timestamp=${encodeURIComponent(timestamp)}`
    ),

  // 维修工单
  getMaintenanceRecords: (status?: string) =>
    request<MaintenanceRecord[]>(status ? `/maintenance?status=${status}` : '/maintenance'),
  createMaintenanceRecord: (data: Partial<MaintenanceRecord>) =>
    request<MaintenanceRecord>('/maintenance', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateMaintenanceRecord: (id: string, data: Partial<MaintenanceRecord>) =>
    request<MaintenanceRecord>(`/maintenance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // 导出接口地址
  getExportUrl: (format: 'geojson' | 'csv' | 'kml') => `${BASE_URL}/export/${format}`,
};
