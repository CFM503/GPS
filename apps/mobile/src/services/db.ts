import {
  PatrolSession,
  GPSTrackPoint,
  Asset,
  AssetPhoto,
  VideoSlice,
  VideoEvent,
  AssetHistoryRecord,
  SyncQueueItem,
  UploadTask,
  SyncStatus
} from '@road-gis/shared';
import { idbStorage } from './idbStorage.js';

/**
 * 统一离线数据库接入层 (结合 IndexedDB 真实异步持久化与内存快速缓存)
 */
export const offlineDb = {
  // --- Sessions ---
  saveSession: (session: PatrolSession) => {
    idbStorage.saveSession(session);
  },
  getSession: (id: string) => idbStorage.getSession(id),
  getSessions: async () => idbStorage.getAllSessions(),

  // --- Tracks ---
  saveTrackPoint: (point: GPSTrackPoint) => {
    idbStorage.saveTrackPoint(point);
  },
  getPendingTracks: async (sessionId: string) => {
    return idbStorage.getSessionTracks(sessionId);
  },

  // --- Assets ---
  saveAsset: (asset: Asset) => {
    idbStorage.saveAsset(asset);
  },
  getAsset: (id: string) => idbStorage.getAsset(id),
  getAssets: async (sessionId?: string) => {
    return idbStorage.getAllAssets(sessionId);
  },
  updateAssetSyncStatus: async (id: string, status: SyncStatus) => {
    const asset = await idbStorage.getAsset(id);
    if (asset) {
      asset.sync_status = status;
      await idbStorage.saveAsset(asset);
    }
  },

  // --- Asset History (路产不可覆盖历史记录) ---
  addAssetHistory: (rec: AssetHistoryRecord) => {
    idbStorage.addAssetHistory(rec);
  },
  getAssetHistory: (assetId: string) => {
    return idbStorage.getAssetHistory(assetId);
  },

  // --- Video Slices ---
  saveVideoSlice: (slice: VideoSlice) => {
    idbStorage.saveVideoSlice(slice);
  },
  getVideoSlices: async (sessionId?: string) => {
    return idbStorage.getVideoSlices(sessionId);
  },
  updateVideoStatus: async (id: string, status: VideoSlice['upload_status'], uploadedBytes?: number) => {
    const list = await idbStorage.getVideoSlices();
    const slice = list.find((v) => v.id === id);
    if (slice) {
      slice.upload_status = status;
      if (uploadedBytes !== undefined) slice.uploaded_bytes = uploadedBytes;
      await idbStorage.saveVideoSlice(slice);
    }
  },

  // --- Video Events (视频证据事件) ---
  saveVideoEvent: (event: VideoEvent) => {
    idbStorage.saveVideoEvent(event);
  },
  getVideoEvents: async (sessionId?: string) => {
    return idbStorage.getVideoEvents(sessionId);
  },

  // --- Sync Queue (正式同步队列) ---
  saveTask: (task: UploadTask | SyncQueueItem) => {
    const rawType = ((task as any).item_type || (task as any).task_type || 'ASSET') as string;
    let itemType: SyncQueueItem['item_type'] = 'ASSET';
    if (rawType === 'SESSION' || rawType === 'PATROL_SESSION') itemType = 'PATROL_SESSION';
    else if (rawType === 'TRACK' || rawType === 'GPS_TRACK') itemType = 'GPS_TRACK';
    else if (rawType === 'ASSET') itemType = 'ASSET';
    else if (rawType === 'VIDEO_EVENT') itemType = 'VIDEO_EVENT';
    else if (rawType === 'PHOTO') itemType = 'PHOTO';
    else if (rawType === 'VIDEO') itemType = 'VIDEO';

    const queueItem: SyncQueueItem = {
      id: task.id,
      session_id: task.session_id,
      item_type: itemType,
      priority: task.priority,
      resource_id: task.resource_id,
      status: task.status,
      retry_count: task.retry_count,
      max_retries: 5,
      last_error: task.last_error,
      idempotency_key: `${itemType}_${task.resource_id}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    idbStorage.saveQueueItem(queueItem);
  },
  getTasks: async () => {
    return idbStorage.getAllQueueItems();
  },
  getPendingTasks: async () => {
    return idbStorage.getPendingQueueItems();
  },
  updateTaskStatus: (id: string, status: SyncStatus, error?: string) => {
    idbStorage.updateQueueItemStatus(id, status, error);
  },

  clearAll: () => idbStorage.clearAll(),
};
