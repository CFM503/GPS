/**
 * 移动端生产级 IndexedDB 本地离线持久化存储引擎
 * 支持大容量离线缓存、非阻塞异步事务与复合索引查询
 * 在非浏览器/测试环境中提供自动安全内存回退
 */

import {
  PatrolSession,
  GPSTrackPoint,
  Asset,
  AssetPhoto,
  VideoSlice,
  VideoEvent,
  AssetHistoryRecord,
  SyncQueueItem
} from '@road-gis/shared';

const DB_NAME = 'RoadGisPatrolOfflineDB';
const DB_VERSION = 1;

export const STORES = {
  SESSIONS: 'patrol_sessions',
  TRACKS: 'gps_tracks',
  ASSETS: 'assets',
  ASSET_HISTORY: 'asset_history',
  PHOTOS: 'photos',
  VIDEOS: 'videos',
  VIDEO_EVENTS: 'video_events',
  SYNC_QUEUE: 'sync_queue',
} as const;

class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase | null> | null = null;

  // 内存回退（在无 window.indexedDB 的环境或测试环境保证 100% 可运行）
  private memFallback: {
    sessions: Map<string, PatrolSession>;
    tracks: GPSTrackPoint[];
    assets: Map<string, Asset>;
    assetHistory: Map<string, AssetHistoryRecord>;
    photos: Map<string, AssetPhoto>;
    videos: Map<string, VideoSlice>;
    videoEvents: Map<string, VideoEvent>;
    syncQueue: Map<string, SyncQueueItem>;
  } = {
    sessions: new Map(),
    tracks: [],
    assets: new Map(),
    assetHistory: new Map(),
    photos: new Map(),
    videos: new Map(),
    videoEvents: new Map(),
    syncQueue: new Map(),
  };

  constructor() {
    this.init();
  }

  private isIDBAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
  }

  async init(): Promise<IDBDatabase | null> {
    if (!this.isIDBAvailable()) {
      return null;
    }
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
        const db = (e.target as IDBOpenDBRequest).result;

        // 1. patrol_sessions
        if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
          const sStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
          sStore.createIndex('status', 'status', { unique: false });
          sStore.createIndex('start_time', 'start_time', { unique: false });
        }

        // 2. gps_tracks
        if (!db.objectStoreNames.contains(STORES.TRACKS)) {
          const tStore = db.createObjectStore(STORES.TRACKS, { autoIncrement: true, keyPath: '_local_id' });
          tStore.createIndex('session_id', 'session_id', { unique: false });
          tStore.createIndex('point_time', 'point_time', { unique: false });
        }

        // 3. assets
        if (!db.objectStoreNames.contains(STORES.ASSETS)) {
          const aStore = db.createObjectStore(STORES.ASSETS, { keyPath: 'id' });
          aStore.createIndex('patrol_session_id', 'patrol_session_id', { unique: false });
          aStore.createIndex('type_id', 'type_id', { unique: false });
          aStore.createIndex('status', 'status', { unique: false });
          aStore.createIndex('sync_status', 'sync_status', { unique: false });
        }

        // 4. asset_history (路产全生命周期历史追溯)
        if (!db.objectStoreNames.contains(STORES.ASSET_HISTORY)) {
          const hStore = db.createObjectStore(STORES.ASSET_HISTORY, { keyPath: 'id' });
          hStore.createIndex('asset_id', 'asset_id', { unique: false });
          hStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 5. photos
        if (!db.objectStoreNames.contains(STORES.PHOTOS)) {
          const pStore = db.createObjectStore(STORES.PHOTOS, { keyPath: 'id' });
          pStore.createIndex('asset_id', 'asset_id', { unique: false });
          pStore.createIndex('session_id', 'session_id', { unique: false });
        }

        // 6. videos
        if (!db.objectStoreNames.contains(STORES.VIDEOS)) {
          const vStore = db.createObjectStore(STORES.VIDEOS, { keyPath: 'id' });
          vStore.createIndex('session_id', 'session_id', { unique: false });
          vStore.createIndex('upload_status', 'upload_status', { unique: false });
        }

        // 7. video_events
        if (!db.objectStoreNames.contains(STORES.VIDEO_EVENTS)) {
          const veStore = db.createObjectStore(STORES.VIDEO_EVENTS, { keyPath: 'id' });
          veStore.createIndex('video_id', 'video_id', { unique: false });
          veStore.createIndex('asset_id', 'asset_id', { unique: false });
          veStore.createIndex('session_id', 'session_id', { unique: false });
        }

        // 8. sync_queue
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const qStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
          qStore.createIndex('priority', 'priority', { unique: false });
          qStore.createIndex('status', 'status', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = (err) => {
        console.warn('[IndexedDB] Open failed, using memory fallback:', err);
        resolve(null);
      };
    });

    return this.initPromise;
  }

  // --- 通用 CRUD 工具 ---
  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore | null> {
    const db = await this.init();
    if (!db) return null;
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  // --- 1. Patrol Sessions ---
  async saveSession(session: PatrolSession): Promise<void> {
    this.memFallback.sessions.set(session.id, session);
    const store = await this.getStore(STORES.SESSIONS, 'readwrite');
    if (!store) return;
    return new Promise((resolve, reject) => {
      const req = store.put(session);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getSession(id: string): Promise<PatrolSession | null> {
    if (this.memFallback.sessions.has(id)) {
      return this.memFallback.sessions.get(id)!;
    }
    const store = await this.getStore(STORES.SESSIONS, 'readonly');
    if (!store) return null;
    return new Promise((resolve) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async getAllSessions(): Promise<PatrolSession[]> {
    const store = await this.getStore(STORES.SESSIONS, 'readonly');
    if (!store) return Array.from(this.memFallback.sessions.values());
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const results: PatrolSession[] = req.result || [];
        // 合并内存
        for (const s of results) {
          this.memFallback.sessions.set(s.id, s);
        }
        resolve(Array.from(this.memFallback.sessions.values()));
      };
      req.onerror = () => resolve(Array.from(this.memFallback.sessions.values()));
    });
  }

  // --- 2. GPS Tracks ---
  async saveTrackPoint(point: GPSTrackPoint): Promise<void> {
    this.memFallback.tracks.push(point);
    const store = await this.getStore(STORES.TRACKS, 'readwrite');
    if (!store) return;
    store.add(point);
  }

  async getSessionTracks(sessionId: string): Promise<GPSTrackPoint[]> {
    const store = await this.getStore(STORES.TRACKS, 'readonly');
    if (!store) {
      return this.memFallback.tracks.filter((t) => t.session_id === sessionId);
    }
    return new Promise((resolve) => {
      const idx = store.index('session_id');
      const req = idx.getAll(sessionId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve(this.memFallback.tracks.filter((t) => t.session_id === sessionId));
    });
  }

  // --- 3. Assets ---
  async saveAsset(asset: Asset): Promise<void> {
    this.memFallback.assets.set(asset.id, asset);
    const store = await this.getStore(STORES.ASSETS, 'readwrite');
    if (!store) return;
    store.put(asset);
  }

  async getAsset(id: string): Promise<Asset | null> {
    if (this.memFallback.assets.has(id)) {
      return this.memFallback.assets.get(id)!;
    }
    const store = await this.getStore(STORES.ASSETS, 'readonly');
    if (!store) return null;
    return new Promise((resolve) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async getAllAssets(sessionId?: string): Promise<Asset[]> {
    const store = await this.getStore(STORES.ASSETS, 'readonly');
    if (!store) {
      let list = Array.from(this.memFallback.assets.values());
      if (sessionId) list = list.filter((a) => a.patrol_session_id === sessionId);
      return list;
    }
    return new Promise((resolve) => {
      const req = sessionId ? store.index('patrol_session_id').getAll(sessionId) : store.getAll();
      req.onsuccess = () => {
        const results = req.result || [];
        for (const a of results) this.memFallback.assets.set(a.id, a);
        resolve(results);
      };
      req.onerror = () => resolve(Array.from(this.memFallback.assets.values()));
    });
  }

  // --- 4. Asset History (历史追溯) ---
  async addAssetHistory(rec: AssetHistoryRecord): Promise<void> {
    this.memFallback.assetHistory.set(rec.id, rec);
    const store = await this.getStore(STORES.ASSET_HISTORY, 'readwrite');
    if (!store) return;
    store.put(rec);
  }

  async getAssetHistory(assetId: string): Promise<AssetHistoryRecord[]> {
    const store = await this.getStore(STORES.ASSET_HISTORY, 'readonly');
    if (!store) {
      return Array.from(this.memFallback.assetHistory.values()).filter((h) => h.asset_id === assetId);
    }
    return new Promise((resolve) => {
      const req = store.index('asset_id').getAll(assetId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  // --- 5. Video Slices & Video Events ---
  async saveVideoSlice(slice: VideoSlice): Promise<void> {
    this.memFallback.videos.set(slice.id, slice);
    const store = await this.getStore(STORES.VIDEOS, 'readwrite');
    if (!store) return;
    store.put(slice);
  }

  async getVideoSlices(sessionId?: string): Promise<VideoSlice[]> {
    const store = await this.getStore(STORES.VIDEOS, 'readonly');
    if (!store) {
      let list = Array.from(this.memFallback.videos.values());
      if (sessionId) list = list.filter((v) => v.session_id === sessionId);
      return list;
    }
    return new Promise((resolve) => {
      const req = sessionId ? store.index('session_id').getAll(sessionId) : store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve(Array.from(this.memFallback.videos.values()));
    });
  }

  async saveVideoEvent(event: VideoEvent): Promise<void> {
    this.memFallback.videoEvents.set(event.id, event);
    const store = await this.getStore(STORES.VIDEO_EVENTS, 'readwrite');
    if (!store) return;
    store.put(event);
  }

  async getVideoEvents(sessionId?: string): Promise<VideoEvent[]> {
    const store = await this.getStore(STORES.VIDEO_EVENTS, 'readonly');
    if (!store) {
      let list = Array.from(this.memFallback.videoEvents.values());
      if (sessionId) list = list.filter((e) => e.session_id === sessionId);
      return list;
    }
    return new Promise((resolve) => {
      const req = sessionId ? store.index('session_id').getAll(sessionId) : store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  // --- 6. Sync Queue ---
  async saveQueueItem(item: SyncQueueItem): Promise<void> {
    this.memFallback.syncQueue.set(item.id, item);
    const store = await this.getStore(STORES.SYNC_QUEUE, 'readwrite');
    if (!store) return;
    store.put(item);
  }

  async getPendingQueueItems(): Promise<SyncQueueItem[]> {
    const store = await this.getStore(STORES.SYNC_QUEUE, 'readonly');
    if (!store) {
      return Array.from(this.memFallback.syncQueue.values())
        .filter((i) => i.status === 'PENDING' || i.status === 'FAILED')
        .sort((a, b) => a.priority - b.priority);
    }
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const list: SyncQueueItem[] = (req.result || [])
          .filter((i: SyncQueueItem) => i.status === 'PENDING' || i.status === 'FAILED')
          .sort((a: SyncQueueItem, b: SyncQueueItem) => a.priority - b.priority);
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  }

  async getAllQueueItems(): Promise<SyncQueueItem[]> {
    const store = await this.getStore(STORES.SYNC_QUEUE, 'readonly');
    if (!store) return Array.from(this.memFallback.syncQueue.values());
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve(Array.from(this.memFallback.syncQueue.values()));
    });
  }

  async updateQueueItemStatus(id: string, status: SyncQueueItem['status'], error?: string): Promise<void> {
    const item = this.memFallback.syncQueue.get(id);
    if (item) {
      item.status = status;
      if (error) item.last_error = error;
      item.updated_at = new Date().toISOString();
    }
    const store = await this.getStore(STORES.SYNC_QUEUE, 'readwrite');
    if (!store) return;
    const req = store.get(id);
    req.onsuccess = () => {
      const val = req.result as SyncQueueItem;
      if (val) {
        val.status = status;
        if (error) val.last_error = error;
        val.updated_at = new Date().toISOString();
        store.put(val);
      }
    };
  }

  // --- 重置与数据导出 ---
  async clearAll(): Promise<void> {
    this.memFallback.sessions.clear();
    this.memFallback.tracks = [];
    this.memFallback.assets.clear();
    this.memFallback.assetHistory.clear();
    this.memFallback.photos.clear();
    this.memFallback.videos.clear();
    this.memFallback.videoEvents.clear();
    this.memFallback.syncQueue.clear();

    const db = await this.init();
    if (!db) return;
    for (const storeName of Object.values(STORES)) {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
    }
  }
}

export const idbStorage = new IndexedDBStorage();
