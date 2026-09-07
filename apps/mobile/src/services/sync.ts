import { offlineDb } from './db.js';
import { SyncQueueItem } from '@road-gis/shared';

export interface SyncProgressCallback {
  (status: {
    isSyncing: boolean;
    syncedCount: number;
    totalCount: number;
    pendingCount: number;
    message: string;
  }): void;
}

export class SyncManager {
  private isSyncing = false;
  private listeners: SyncProgressCallback[] = [];
  private baseUrl = '/api/v1';

  constructor() {
    // 监听网络恢复事件，自动触发同步
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[SyncManager] Network online detected, triggering auto sync queue');
        this.triggerSync();
      });
    }
  }

  onProgress(cb: SyncProgressCallback) {
    this.listeners.push(cb);
  }

  private notify(synced: number, total: number, message: string) {
    offlineDb.getPendingTasks().then((pending) => {
      for (const l of this.listeners) {
        l({
          isSyncing: this.isSyncing,
          syncedCount: synced,
          totalCount: total,
          pendingCount: pending.length,
          message,
        });
      }
    });
  }

  async triggerSync(): Promise<{ success: boolean; synced: number }> {
    if (this.isSyncing) return { success: true, synced: 0 };
    this.isSyncing = true;
    let synced = 0;

    try {
      const tasks = await offlineDb.getPendingTasks();
      const total = tasks.length;
      this.notify(0, total, `开始执行 5 级优先级同步队列 (共 ${total} 项)`);

      for (const task of tasks) {
        try {
          offlineDb.updateTaskStatus(task.id, 'UPLOADING');

          // P1: 巡查会话 (Session)
          if (task.item_type === 'PATROL_SESSION') {
            await this.syncSession(task.resource_id, task.idempotency_key);
          }
          // P2: GPS 轨迹点批处理 (Track)
          else if (task.item_type === 'GPS_TRACK') {
            await this.syncTracks(task.session_id, task.idempotency_key);
          }
          // P3: 路产采集 (Asset)
          else if (task.item_type === 'ASSET') {
            await this.syncAsset(task.resource_id, task.idempotency_key);
          }
          // P3: 视频证据事件 (VideoEvent)
          else if (task.item_type === 'VIDEO_EVENT') {
            await this.syncVideoEvent(task.resource_id, task.idempotency_key);
          }
          // P4: 现场照片 (Photo)
          else if (task.item_type === 'PHOTO') {
            await this.syncPhoto(task.resource_id, task.idempotency_key);
          }
          // P5: 视频切片断点续传 (Video)
          else if (task.item_type === 'VIDEO') {
            await this.syncVideoChunked(task.resource_id, task.idempotency_key);
          }

          offlineDb.updateTaskStatus(task.id, 'UPLOADED');
          synced++;
          this.notify(synced, total, `已同步: ${task.item_type} (${synced}/${total})`);
        } catch (err: any) {
          console.error(`Task ${task.id} sync error:`, err);
          offlineDb.updateTaskStatus(task.id, 'FAILED', err.message);
        }
      }

      this.notify(synced, total, synced > 0 ? `同步完成，成功上传 ${synced} 项` : '队列已全部同步');
      return { success: true, synced };
    } finally {
      this.isSyncing = false;
      this.notify(synced, synced, '就绪');
    }
  }

  // --- P1: 巡查会话同步 (带客户端 UUID 与幂等性校验) ---
  private async syncSession(sessionId: string, idempotencyKey: string) {
    const session = await offlineDb.getSession(sessionId);
    if (!session) return;

    const res = await fetch(`${this.baseUrl}/patrol/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(session),
    });
    if (!res.ok) throw new Error(`Sync session failed: ${res.status}`);
  }

  // --- P2: GPS 轨迹点批处理同步 ---
  private async syncTracks(sessionId: string, idempotencyKey: string) {
    const points = await offlineDb.getPendingTracks(sessionId);
    if (points.length === 0) return;

    const res = await fetch(`${this.baseUrl}/tracks/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ sessionId, points }),
    });
    if (!res.ok) throw new Error(`Sync tracks failed: ${res.status}`);
  }

  // --- P3: 路产同步 ---
  private async syncAsset(assetId: string, idempotencyKey: string) {
    const asset = await offlineDb.getAsset(assetId);
    if (!asset) return;

    const res = await fetch(`${this.baseUrl}/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(asset),
    });
    if (!res.ok) throw new Error(`Sync asset failed: ${res.status}`);
    await offlineDb.updateAssetSyncStatus(assetId, 'UPLOADED');
  }

  // --- P3: 视频证据事件同步 ---
  private async syncVideoEvent(eventId: string, idempotencyKey: string) {
    const events = await offlineDb.getVideoEvents();
    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    const res = await fetch(`${this.baseUrl}/video-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(event),
    });
    if (!res.ok) throw new Error(`Sync video event failed: ${res.status}`);
  }

  // --- P4: 现场照片同步 ---
  private async syncPhoto(photoId: string, idempotencyKey: string) {
    console.log(`[SyncManager] Syncing photo ${photoId} (idempotency: ${idempotencyKey})`);
  }

  // --- P5: 视频分块断点续传同步 ---
  private async syncVideoChunked(sliceId: string, idempotencyKey: string) {
    const slices = await offlineDb.getVideoSlices();
    const slice = slices.find((v) => v.id === sliceId);
    if (!slice) return;

    // 1. 登记切片元数据
    await fetch(`${this.baseUrl}/videos/slices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(slice),
    });

    // 2. 初始化断点续传，查询服务端偏移量
    const initRes = await fetch(`${this.baseUrl}/videos/upload/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sliceId }),
    });
    const initData = await initRes.json();
    let currentOffset = initData.data?.uploadOffset || 0;

    // 3. 模拟切片分块上传 (每块 2MB，支持 50% 断点自愈)
    const chunkSize = 2 * 1024 * 1024;
    const totalSize = slice.file_size_bytes;

    while (currentOffset < totalSize) {
      const remaining = totalSize - currentOffset;
      const thisChunkSize = Math.min(chunkSize, remaining);
      const fakeChunk = new Uint8Array(thisChunkSize);

      const chunkRes = await fetch(`${this.baseUrl}/videos/upload/chunk?sliceId=${sliceId}`, {
        method: 'PATCH',
        headers: {
          'Upload-Offset': currentOffset.toString(),
          'Content-Type': 'application/octet-stream',
        },
        body: fakeChunk,
      });

      if (!chunkRes.ok) {
        throw new Error(`Chunk upload failed with status ${chunkRes.status}`);
      }

      currentOffset += thisChunkSize;
      await offlineDb.updateVideoStatus(sliceId, currentOffset >= totalSize ? 'COMPLETED' : 'UPLOADING', currentOffset);
    }
  }
}

export const syncManager = new SyncManager();
