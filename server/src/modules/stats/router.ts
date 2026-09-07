import { Router } from 'express';
import { dbStore } from '../../db/store.js';

const router = Router();

// GET /api/v1/stats/dashboard (管理平台综合大屏与统计核心数据)
router.get('/dashboard', (req, res) => {
  const stats = dbStore.getDashboardStats();
  const recentLogs = dbStore.getAuditLogs().slice(0, 10);
  res.json({
    code: 200,
    message: 'success',
    data: {
      ...stats,
      recentLogs,
    },
  });
});

export default router;
