import { Router } from 'express';
import { dbStore } from '../../db/store.js';
import { auditMiddleware } from '../../middleware/audit.js';

const router = Router();

// POST /api/v1/patrol/sessions (启动巡查会话)
router.post('/sessions', auditMiddleware('PATROL', 'START_SESSION'), (req, res) => {
  const sessionData = req.body;
  const session = dbStore.createPatrolSession(sessionData);
  res.status(201).json({
    code: 201,
    message: '巡查会话已开启',
    data: session,
  });
});

// PUT /api/v1/patrol/sessions/:id/finish (结束巡查会话)
router.put('/sessions/:id/finish', auditMiddleware('PATROL', 'FINISH_SESSION'), (req, res) => {
  const { id } = req.params;
  const updated = dbStore.finishPatrolSession(id, req.body);
  if (!updated) {
    res.status(404).json({ code: 404, message: '巡查会话不存在' });
    return;
  }
  res.json({
    code: 200,
    message: '巡查已成功结束并归档',
    data: updated,
  });
});

// GET /api/v1/patrol/sessions (查询巡查会话列表)
router.get('/sessions', (req, res) => {
  const { roadId, status } = req.query;
  const sessions = dbStore.listPatrolSessions({
    roadId: roadId as string,
    status: status as string,
  });
  res.json({
    code: 200,
    message: 'success',
    data: sessions,
  });
});

// GET /api/v1/patrol/sessions/:id (获取单个巡查会话详情)
router.get('/sessions/:id', (req, res) => {
  const session = dbStore.getPatrolSession(req.params.id);
  if (!session) {
    res.status(404).json({ code: 404, message: '巡查会话不存在' });
    return;
  }
  const tracks = dbStore.getTrackPoints(req.params.id);
  const assets = dbStore.listAssets({ sessionId: req.params.id });
  const videos = dbStore.listVideoSlices(req.params.id);

  res.json({
    code: 200,
    message: 'success',
    data: {
      ...session,
      tracks_count: tracks.length,
      assets,
      videos,
    },
  });
});

export default router;
