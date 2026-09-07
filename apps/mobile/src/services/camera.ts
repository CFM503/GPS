import { VideoSlice, VideoEvent, VideoEventType, AssetPhoto } from '@road-gis/shared';
import { offlineDb } from './db.js';

export class VideoRecorder {
  private sessionId: string = '';
  private sliceIndex: number = 1;
  private currentSlice: VideoSlice | null = null;
  private sliceStartTime: number = 0;
  private timer: any = null;
  private isPaused: boolean = false;

  startRecording(sessionId: string) {
    this.sessionId = sessionId;
    this.sliceIndex = 1;
    this.isPaused = false;
    this.startNewSlice();

    // 监控切片时长（每5分钟切片，低传输失败成本）
    this.timer = setInterval(() => {
      if (this.currentSlice && !this.isPaused) {
        const now = Date.now();
        const elapsedSecs = (now - this.sliceStartTime) / 1000;
        this.currentSlice.duration_seconds = Math.round(elapsedSecs);

        // 达到 5 分钟 (300秒) 自动分段切片
        if (elapsedSecs >= 300) {
          this.finishCurrentSlice();
          this.startNewSlice();
        }
      }
    }, 1000);
  }

  pauseRecording() {
    this.isPaused = true;
  }

  resumeRecording() {
    this.isPaused = false;
  }

  stopRecording(): VideoSlice | null {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    return this.finishCurrentSlice();
  }

  getCurrentSlice(): VideoSlice | null {
    return this.currentSlice;
  }

  getCurrentOffsetSeconds(): number {
    if (!this.sliceStartTime) return 0;
    return Math.round((Date.now() - this.sliceStartTime) / 1000);
  }

  /**
   * 创建视频与路产发现绑定的绝对时间戳证据事件 (VideoEvent)
   */
  recordVideoEvent(assetId: string, eventType: VideoEventType = 'ASSET_DETECTED', description?: string): VideoEvent | null {
    if (!this.currentSlice) return null;
    const offset = this.getCurrentOffsetSeconds();
    const event: VideoEvent = {
      id: crypto.randomUUID(),
      session_id: this.sessionId,
      video_id: this.currentSlice.id,
      asset_id: assetId,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      video_offset_seconds: offset,
      description: description || '',
      created_at: new Date().toISOString(),
    };
    offlineDb.saveVideoEvent(event);
    return event;
  }

  private startNewSlice() {
    const sliceId = `VID-${this.sessionId}-${this.sliceIndex.toString().padStart(3, '0')}`;
    const fileName = `VIDEO_${this.sliceIndex.toString().padStart(3, '0')}.mp4`;
    const nowIso = new Date().toISOString();
    this.sliceStartTime = Date.now();

    const slice: VideoSlice = {
      id: sliceId,
      session_id: this.sessionId,
      file_name: fileName,
      start_time: nowIso,
      end_time: new Date(Date.now() + 300 * 1000).toISOString(),
      duration_seconds: 0,
      file_size_bytes: 50 * 1024 * 1024, // 预估约50MB
      width: 1920,
      height: 1080,
      upload_status: 'PENDING',
      uploaded_bytes: 0,
    };

    this.currentSlice = slice;
    this.sliceIndex++;
    offlineDb.saveVideoSlice(slice);
  }

  private finishCurrentSlice(): VideoSlice | null {
    if (!this.currentSlice) return null;
    this.currentSlice.end_time = new Date().toISOString();
    offlineDb.saveVideoSlice(this.currentSlice);

    // 生成 P5 视频切片上传任务 (含客户端 UUID 与幂等性保护)
    offlineDb.saveTask({
      id: crypto.randomUUID(),
      session_id: this.sessionId,
      task_type: 'VIDEO',
      priority: 5,
      resource_id: this.currentSlice.id,
      total_bytes: this.currentSlice.file_size_bytes,
      uploaded_bytes: 0,
      status: 'PENDING',
      retry_count: 0,
    });

    const finished = this.currentSlice;
    this.currentSlice = null;
    return finished;
  }
}

export const videoRecorder = new VideoRecorder();

export class PhotoManager {
  async capturePhoto(
    assetId: string,
    sessionId: string,
    photoDataUrl: string,
    coords?: { latitude: number; longitude: number }
  ): Promise<AssetPhoto> {
    const photoId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const photo: AssetPhoto = {
      id: photoId,
      asset_id: assetId,
      session_id: sessionId,
      file_name: `PHOTO_${assetId.slice(0, 8)}_${Date.now()}.jpg`,
      storage_path: photoDataUrl,
      storage_url: photoDataUrl,
      file_size_bytes: Math.round(photoDataUrl.length * 0.75),
      photo_time: nowIso,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
    };

    // 1. 保存到本地持久化 IndexedDB
    await offlineDb.savePhoto(photo);

    // 2. 加入 P4 优先级同步队列
    offlineDb.saveTask({
      id: crypto.randomUUID(),
      session_id: sessionId,
      task_type: 'PHOTO',
      priority: 4,
      resource_id: photoId,
      total_bytes: photo.file_size_bytes,
      uploaded_bytes: 0,
      status: 'PENDING',
      retry_count: 0,
    });

    return photo;
  }

  async getPhotos(assetId: string): Promise<AssetPhoto[]> {
    return offlineDb.getAssetPhotos(assetId);
  }
}

export const photoManager = new PhotoManager();
