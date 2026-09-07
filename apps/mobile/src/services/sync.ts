import { offlineDb } from './db.js';
import { UploadTask, PatrolSession } from '@road-gis/shared';

export interface SyncProgressCallback {
  (status: { isSyncing: boolean; pendingCount: number; message: string }): void;
}

export class SyncManager {
  private isSyncing = false;
  private listeners: SyncProgressCallback[] = [];
  private baseUrl = '/api/v1';

  constructor() {
    // 监听网络恢复事件，自动触发同步
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[SyncManager] Network online detected, triggering auto sync');
        this.triggerSync();
      });
    }
  }

  onProgress(cb: SyncProgressCallback) {
    this.listeners.push(cb);
  }

  private notify(message: string) {
    const pending = offlineDb.getPendingTasks().length;
    for (const l of this.listeners) {
      l({ isSyncing: this.isSyncing, pendingCount: pending, message });
    }
  }

  async triggerSync(): Promise<{ success: boolean; synced: number }> {
    if (this.isSyncing) return { success: true, synced: 0 };
    this.isSyncing = true;
    let synced = 0;

    try {
      const tasks = offlineDb.getPendingTasks();
      this.notify(`开始执行优先级上传队列 (共 ${tasks.length} 项)`);

      for (const task of tasks) {
        try {
          offlineDb.updateTaskStatus(task.id, 'UPLOADING');

          // P1: 巡查会话
          if (task.task_type === 'SESSION') {
            await this.syncSession(task.resource_id);
          }
          // P2: GPS 轨迹点批处理
          else if (task.task_type === 'TRACK') {
            await this.syncTracks(task.session_id);
          }
          // P3: 路产采集
          else if (task.task_type === 'ASSET') {
            await this.syncAsset(task.resource_id);
          }
          // P4: 现场照片
          else if (task.task_type === 'PHOTO') {
            await this.syncPhoto(task.resource_id);
          }
          // P5: 视频切片断点续传
          else if (task.task_type === 'VIDEO') {
            await this.syncVideoChunked(task.resource_id);
          }

          offlineDb.updateTaskStatus(task.id, 'UPLOADED');
          synced++;
          this.notify(`已同步: ${task.task_type} (${synced}/${tasks.length})`);
        } catch (err: any) {
          console.error(`Task ${task.id} failed`, err);
          offlineDb.updateTaskStatus(task.id, 'FAILED', err.message);
        }
      }

      this.notify(synced > 0 ? `同步完成，成功上传 ${synced} 项` : '队列已全部同步');
      return { success: true, synced };
    } finally {
      this.isSyncing = false;
      this.notify('空闲');
    }
  }

  private async syncSession(sessionId: string) {
    const sessions = offlineDb.getSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    await fetch(`${this.baseUrl}/patrol/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
  }

  private async syncTracks(sessionId: string) {
    const points = offlineDb.getPendingTracks(sessionId);
    if (points.length === 0) return;

    await fetch(`${this.baseUrl}/tracks/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, points }),
    });
  }

  private async syncAsset(assetId: string) {
    const assets = offlineDb.getAssets();
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    await fetch(`${this.baseUrl}/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asset),
    });
    offlineDb.updateAssetSyncStatus(assetId, 'UPLOADED');
  }

  private async syncPhoto(photoId: string) {
    // 模拟照片上传
    console.log(`Syncing photo ${photoId}`);
  }

  /**
   * 视频分块断点续传实现
   */
  private async syncVideoChunked(sliceId: string) {
    const slices = offlineDb.getVideoSlices();
    const slice = slices.find((s) => s.id === sliceId);
    if (!slice) return;

    // 1. 登记切片
    await fetch(`${this.baseUrl}/videos/slices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    // 3. 模拟切片分块上传 (每块 2MB)
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
      offlineDb.updateVideoStatus(sliceId, currentOffset >= totalSize ? 'COMPLETED' : 'UPLOADING', currentOffset);
    }
  }
}

export const syncManager = new SyncManager();
