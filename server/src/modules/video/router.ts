import { Router, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { dbStore } from '../../db/store.js';
import { config } from '../../config/index.js';
import { VideoSlice } from '@road-gis/shared';

const router = Router();

// POST /api/v1/videos/slices (登记视频切片元数据)
router.post('/slices', (req, res) => {
  const sliceData = req.body as VideoSlice;
  if (!sliceData.id || !sliceData.session_id || !sliceData.start_time || !sliceData.end_time) {
    res.status(400).json({ code: 400, message: '视频切片必填字段缺失' });
    return;
  }
  const registered = dbStore.registerVideoSlice({
    ...sliceData,
    upload_status: sliceData.upload_status || 'PENDING',
    uploaded_bytes: sliceData.uploaded_bytes || 0,
  });
  res.status(201).json({
    code: 201,
    message: '视频切片元数据登记成功',
    data: registered,
  });
});

// POST /api/v1/videos/upload/init (断点续传初始化，查询当前已上传偏移量)
router.post('/upload/init', (req, res) => {
  const { sliceId } = req.body;
  const slice = dbStore.getVideoSlice(sliceId);
  if (!slice) {
    res.status(404).json({ code: 404, message: '指定的视频切片不存在' });
    return;
  }

  const chunkPath = path.join(config.uploadTempDir, `${sliceId}.part`);
  let currentOffset = 0;
  if (fs.existsSync(chunkPath)) {
    currentOffset = fs.statSync(chunkPath).size;
  }

  res.json({
    code: 200,
    message: '断点续传就绪',
    data: {
      sliceId,
      uploadOffset: currentOffset,
      totalBytes: slice.file_size_bytes,
      status: slice.upload_status,
    },
  });
});

// PATCH /api/videos/upload/chunk (流式/分块断点续传核心接口)
router.patch('/upload/chunk', (req: Request, res: Response) => {
  const sliceId = req.query.sliceId as string;
  const offsetHeader = req.headers['upload-offset'];

  if (!sliceId || offsetHeader === undefined) {
    res.status(400).json({ code: 400, message: '缺少 sliceId 参数或 Upload-Offset 请求头' });
    return;
  }

  const uploadOffset = parseInt(offsetHeader as string, 10);
  const chunks: Buffer[] = [];

  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      const result = dbStore.appendVideoChunk(sliceId, buffer, uploadOffset);
      res.set('Upload-Offset', result.uploadedBytes.toString());
      res.json({
        code: 200,
        message: result.completed ? '视频上传已完成' : '分块上传成功',
        data: result,
      });
    } catch (err: unknown) {
      res.status(409).json({ code: 409, message: err instanceof Error ? err.message : '分块写入冲突' });
    }
  });
});

// GET /api/v1/videos/locate (核心能力：输入绝对时间戳，秒级定位视频及帧偏移)
router.get('/locate', (req, res) => {
  const timestamp = req.query.timestamp as string;
  if (!timestamp) {
    res.status(400).json({ code: 400, message: '缺少 timestamp 参数' });
    return;
  }

  const location = dbStore.locateVideo(timestamp);
  if (!location) {
    res.status(404).json({ code: 404, message: '未找到覆盖该时间戳的视频切片' });
    return;
  }

  res.json({
    code: 200,
    message: 'success',
    data: {
      videoSlice: location.video,
      offsetSeconds: location.offsetSeconds,
      timestamp,
    },
  });
});

// GET /api/v1/videos/session/:sessionId (获取巡查会话的所有视频)
router.get('/session/:sessionId', (req, res) => {
  const slices = dbStore.listVideoSlices(req.params.sessionId);
  res.json({
    code: 200,
    message: 'success',
    data: slices,
  });
});

// GET /api/v1/videos/stream/:id (视频切片 HTTP 206 Partial Content 流式播放支持)
router.get('/stream/:id', (req, res) => {
  const slice = dbStore.getVideoSlice(req.params.id);
  const filePath = slice?.storage_path && fs.existsSync(slice.storage_path)
    ? slice.storage_path
    : path.join(config.uploadStorageDir, `${req.params.id}.mp4`);

  if (!fs.existsSync(filePath)) {
    // 若本地没有真实MP4文件，返回一段轻量模拟视频或200状态
    res.setHeader('Content-Type', 'video/mp4');
    res.send(Buffer.from('MOCK_VIDEO_BINARY_DATA'));
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

export default router;
