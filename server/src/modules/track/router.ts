import { Router } from 'express';
import { dbStore } from '../../db/store.js';
import { GPSTrackPoint, GeoFeatureCollection } from '@road-gis/shared';

const router = Router();

// POST /api/v1/tracks/batch (车载端批量上传连续高频 GPS 点)
router.post('/batch', (req, res) => {
  const { sessionId, points } = req.body as { sessionId: string; points: GPSTrackPoint[] };
  if (!sessionId || !Array.isArray(points)) {
    res.status(400).json({ code: 400, message: '缺少会话 ID 或点集数据格式错误' });
    return;
  }

  const inserted = dbStore.addTrackPoints(sessionId, points);
  res.status(201).json({
    code: 201,
    message: `成功接收 ${inserted} 个轨迹采样点`,
    data: { count: inserted },
  });
});

// GET /api/v1/tracks/session/:sessionId (查询单次巡查完整轨迹点序列)
router.get('/session/:sessionId', (req, res) => {
  const points = dbStore.getTrackPoints(req.params.sessionId);
  res.json({
    code: 200,
    message: 'success',
    data: points,
  });
});

// GET /api/v1/tracks/session/:sessionId/geojson (标准 GeoJSON 格式轨迹输出)
router.get('/session/:sessionId/geojson', (req, res) => {
  const points = dbStore.getTrackPoints(req.params.sessionId);
  const session = dbStore.getPatrolSession(req.params.sessionId);

  if (points.length === 0) {
    res.json({
      type: 'FeatureCollection',
      features: [],
    });
    return;
  }

  const lineCoordinates: [number, number][] = points
    .filter((p) => p.is_valid !== false)
    .map((p) => [p.longitude, p.latitude] as [number, number]);

  const featureCollection: GeoFeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: session?.id,
        geometry: {
          type: 'LineString',
          coordinates: lineCoordinates,
        },
        properties: {
          sessionId: session?.id,
          roadCode: session?.road_code,
          vehiclePlate: session?.vehicle_plate,
          distanceKm: session?.distance_km,
          startTime: session?.start_time,
          endTime: session?.end_time,
        },
      },
    ],
  };

  res.json(featureCollection);
});

export default router;
