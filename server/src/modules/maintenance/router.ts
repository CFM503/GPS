import { Router } from 'express';
import { dbStore } from '../../db/store.js';
import { auditMiddleware } from '../../middleware/audit.js';

const router = Router();

// POST /api/v1/maintenance (上报维修工单)
router.post('/', auditMiddleware('MAINTENANCE', 'CREATE_ORDER'), (req, res) => {
  const rec = dbStore.createMaintenanceRecord(req.body);
  res.status(201).json({
    code: 201,
    message: '维修工单已派发',
    data: rec,
  });
});

// PUT /api/v1/maintenance/:id (更新维修进度/处置结案)
router.put('/:id', auditMiddleware('MAINTENANCE', 'UPDATE_ORDER'), (req, res) => {
  const updated = dbStore.updateMaintenanceRecord(req.params.id, req.body);
  if (!updated) {
    res.status(404).json({ code: 404, message: '工单不存在' });
    return;
  }
  // 若已结案，自动更新对应路产状态为 REPAIRED 或 NORMAL
  if (updated.status === 'REPAIRED' || updated.status === 'CLOSED') {
    dbStore.updateAsset(updated.asset_id, { status: 'REPAIRED' });
  }

  res.json({
    code: 200,
    message: '工单已更新',
    data: updated,
  });
});

// GET /api/v1/maintenance (查询工单列表)
router.get('/', (req, res) => {
  const records = dbStore.listMaintenanceRecords(req.query.status as string);
  res.json({
    code: 200,
    message: 'success',
    data: records,
  });
});

export default router;
