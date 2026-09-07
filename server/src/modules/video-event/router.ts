import { Router } from 'express';
import { dbStore } from '../../db/store.js';
import { VideoEvent } from '@road-gis/shared';

const router = Router();

// POST /api/v1/video-events (登记视频证据事件，秒级关联视频与路产)
router.post('/', (req, res) => {
  const event = req.body as VideoEvent;
  if (!event.id || !event.session_id || !event.video_id || !event.asset_id) {
    res.status(400).json({ code: 400, message: '视频证据事件必填字段缺失' });
    return;
  }
  const saved = dbStore.addVideoEvent(event);
  res.status(201).json({
    code: 201,
    message: '视频证据事件登记成功',
    data: saved,
  });
});

// GET /api/v1/video-events (查询视频证据事件)
router.get('/', (req, res) => {
  const { sessionId, assetId, videoId } = req.query;
  const events = dbStore.getVideoEvents({
    sessionId: sessionId as string,
    assetId: assetId as string,
    videoId: videoId as string,
  });
  res.json({
    code: 200,
    message: 'success',
    data: events,
  });
});

export default router;
