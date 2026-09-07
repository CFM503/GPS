import { VideoSlice } from '@road-gis/shared';
import { offlineDb } from './db.js';

export class VideoRecorder {
  private sessionId: string = '';
  private sliceIndex: number = 1;
  private currentSlice: VideoSlice | null = null;
  private sliceStartTime: number = 0;
  private timer: any = null;

  startRecording(sessionId: string) {
    this.sessionId = sessionId;
    this.sliceIndex = 1;
    this.startNewSlice();

    // 监控切片时长（真实环境每5分钟切片，演示环境每5分钟切片逻辑完备）
    this.timer = setInterval(() => {
      if (this.currentSlice) {
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

    // 生成 P5 视频切片上传任务
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
