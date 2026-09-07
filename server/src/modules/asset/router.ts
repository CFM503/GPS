import { Router } from 'express';
import { dbStore } from '../../db/store.js';
import { auditMiddleware } from '../../middleware/audit.js';

const router = Router();

// GET /api/v1/assets/types (获取路产类型字典)
router.get('/types', (req, res) => {
  const types = dbStore.getAssetTypes();
  res.json({
    code: 200,
    message: 'success',
    data: types,
  });
});

// POST /api/v1/assets/types (动态扩展路产类型)
router.post('/types', auditMiddleware('ASSET', 'CREATE_TYPE'), (req, res) => {
  const type = dbStore.addAssetType(req.body);
  res.status(201).json({
    code: 201,
    message: '路产类型创建成功',
    data: type,
  });
});

// POST /api/v1/assets (创建路产，自动推算道路桩号与关联视频)
router.post('/', auditMiddleware('ASSET', 'CREATE_ASSET'), (req, res) => {
  const asset = dbStore.createAsset(req.body);
  res.status(201).json({
    code: 201,
    message: '路产建档成功',
    data: asset,
  });
});

// PUT /api/v1/assets/:id (更新路产状态/属性)
router.put('/:id', auditMiddleware('ASSET', 'UPDATE_ASSET'), (req, res) => {
  const updated = dbStore.updateAsset(req.params.id, req.body);
  if (!updated) {
    res.status(404).json({ code: 404, message: '路产不存在' });
    return;
  }
  res.json({
    code: 200,
    message: '路产已成功更新',
    data: updated,
  });
});

// GET /api/v1/assets/spatial/bbox (GIS 地图视口范围检索)
router.get('/spatial/bbox', (req, res) => {
  const minLng = parseFloat(req.query.minLng as string);
  const minLat = parseFloat(req.query.minLat as string);
  const maxLng = parseFloat(req.query.maxLng as string);
  const maxLat = parseFloat(req.query.maxLat as string);

  if (isNaN(minLng) || isNaN(minLat) || isNaN(maxLng) || isNaN(maxLat)) {
    res.status(400).json({ code: 400, message: 'BBOX 参数必须包含合法的数值 minLng, minLat, maxLng, maxLat' });
    return;
  }

  const assets = dbStore.getAssetsInBBox(minLng, minLat, maxLng, maxLat);
  res.json({
    code: 200,
    message: 'success',
    data: assets,
  });
});

// GET /api/v1/assets (多条件组合查询)
router.get('/', (req, res) => {
  const { roadId, typeId, status, sessionId, minMilepost, maxMilepost } = req.query;
  const assets = dbStore.listAssets({
    roadId: roadId as string,
    typeId: typeId as string,
    status: status as string,
    sessionId: sessionId as string,
    minMilepost: minMilepost ? parseFloat(minMilepost as string) : undefined,
    maxMilepost: maxMilepost ? parseFloat(maxMilepost as string) : undefined,
  });

  res.json({
    code: 200,
    message: 'success',
    data: assets,
  });
});

// GET /api/v1/assets/:id (查询路产详情)
router.get('/:id', (req, res) => {
  const asset = dbStore.getAssetById(req.params.id);
  if (!asset) {
    res.status(404).json({ code: 404, message: '路产不存在' });
    return;
  }
  res.json({
    code: 200,
    message: 'success',
    data: asset,
  });
});

// GET /api/v1/assets/:id/history (查询路产变更历史记录)
router.get('/:id/history', (req, res) => {
  const history = dbStore.getAssetHistory(req.params.id);
  res.json({
    code: 200,
    message: 'success',
    data: history,
  });
});

// POST /api/v1/assets/:id/history (追加路产历史变更记录)
router.post('/:id/history', auditMiddleware('ASSET', 'ADD_HISTORY'), (req, res) => {
  const record = dbStore.addAssetHistory({
    ...req.body,
    asset_id: req.params.id,
  });
  res.status(201).json({
    code: 201,
    message: '路产变更历史记录登记成功',
    data: record,
  });
});

export default router;
