import {
  PatrolSession,
  GPSTrackPoint,
  Asset,
  AssetPhoto,
  VideoSlice,
  UploadTask,
  SyncStatus
} from '@road-gis/shared';

const STORAGE_KEYS = {
  SESSIONS: 'gis_offline_sessions',
  TRACKS: 'gis_offline_tracks',
  ASSETS: 'gis_offline_assets',
  PHOTOS: 'gis_offline_photos',
  VIDEOS: 'gis_offline_videos',
  TASKS: 'gis_offline_tasks',
};

function getItem<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setItem<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.error('LocalStorage write error', err);
  }
}

export const offlineDb = {
  // --- Sessions ---
  saveSession: (session: PatrolSession) => {
    const list = getItem<PatrolSession>(STORAGE_KEYS.SESSIONS);
    const idx = list.findIndex((s) => s.id === session.id);
    if (idx >= 0) list[idx] = session;
    else list.push(session);
    setItem(STORAGE_KEYS.SESSIONS, list);
  },
  getSessions: () => getItem<PatrolSession>(STORAGE_KEYS.SESSIONS),

  // --- Tracks ---
  saveTrackPoint: (point: GPSTrackPoint) => {
    const list = getItem<GPSTrackPoint>(STORAGE_KEYS.TRACKS);
    list.push(point);
    setItem(STORAGE_KEYS.TRACKS, list);
  },
  getPendingTracks: (sessionId: string) => {
    return getItem<GPSTrackPoint>(STORAGE_KEYS.TRACKS).filter((t) => t.session_id === sessionId);
  },
  clearTracks: (sessionId: string) => {
    const list = getItem<GPSTrackPoint>(STORAGE_KEYS.TRACKS).filter((t) => t.session_id !== sessionId);
    setItem(STORAGE_KEYS.TRACKS, list);
  },

  // --- Assets ---
  saveAsset: (asset: Asset) => {
    const list = getItem<Asset>(STORAGE_KEYS.ASSETS);
    const idx = list.findIndex((a) => a.id === asset.id);
    if (idx >= 0) list[idx] = asset;
    else list.push(asset);
    setItem(STORAGE_KEYS.ASSETS, list);
  },
  getAssets: () => getItem<Asset>(STORAGE_KEYS.ASSETS),
  updateAssetSyncStatus: (id: string, status: SyncStatus) => {
    const list = getItem<Asset>(STORAGE_KEYS.ASSETS);
    const asset = list.find((a) => a.id === id);
    if (asset) {
      asset.sync_status = status;
      setItem(STORAGE_KEYS.ASSETS, list);
    }
  },

  // --- Video Slices ---
  saveVideoSlice: (slice: VideoSlice) => {
    const list = getItem<VideoSlice>(STORAGE_KEYS.VIDEOS);
    const idx = list.findIndex((v) => v.id === slice.id);
    if (idx >= 0) list[idx] = slice;
    else list.push(slice);
    setItem(STORAGE_KEYS.VIDEOS, list);
  },
  getVideoSlices: () => getItem<VideoSlice>(STORAGE_KEYS.VIDEOS),
  updateVideoStatus: (id: string, status: VideoSlice['upload_status'], uploadedBytes?: number) => {
    const list = getItem<VideoSlice>(STORAGE_KEYS.VIDEOS);
    const slice = list.find((v) => v.id === id);
    if (slice) {
      slice.upload_status = status;
      if (uploadedBytes !== undefined) slice.uploaded_bytes = uploadedBytes;
      setItem(STORAGE_KEYS.VIDEOS, list);
    }
  },

  // --- Upload Tasks ---
  saveTask: (task: UploadTask) => {
    const list = getItem<UploadTask>(STORAGE_KEYS.TASKS);
    const idx = list.findIndex((t) => t.id === task.id);
    if (idx >= 0) list[idx] = task;
    else list.push(task);
    setItem(STORAGE_KEYS.TASKS, list);
  },
  getTasks: () => getItem<UploadTask>(STORAGE_KEYS.TASKS),
  getPendingTasks: () => {
    return getItem<UploadTask>(STORAGE_KEYS.TASKS)
      .filter((t) => t.status === 'PENDING' || t.status === 'FAILED')
      .sort((a, b) => a.priority - b.priority);
  },
  updateTaskStatus: (id: string, status: SyncStatus, error?: string) => {
    const list = getItem<UploadTask>(STORAGE_KEYS.TASKS);
    const task = list.find((t) => t.id === id);
    if (task) {
      task.status = status;
      if (error) task.last_error = error;
      setItem(STORAGE_KEYS.TASKS, list);
    }
  },
};
