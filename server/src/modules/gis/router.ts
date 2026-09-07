import { Router } from 'express';
import { dbStore } from '../../db/store.js';
import { GeoFeatureCollection } from '@road-gis/shared';

const router = Router();

// GET /api/v1/gis/roads (获取全部道路中心线 GeoJSON)
router.get('/roads', (req, res) => {
  const roads = dbStore.getAllRoads();
  const fc: GeoFeatureCollection = {
    type: 'FeatureCollection',
    features: roads.map((r) => ({
      type: 'Feature',
      id: r.id,
      geometry: r.centerline_geom,
      properties: {
        code: r.code,
        name: r.name,
        level: r.level,
        startMilepost: r.start_milepost,
        endMilepost: r.end_milepost,
        totalLengthKm: r.total_length_km,
      },
    })),
  };
  res.json(fc);
});

// GET /api/v1/gis/layers (获取路产全量图层 GeoJSON)
router.get('/layers', (req, res) => {
  const { typeId, status } = req.query;
  const assets = dbStore.listAssets({
    typeId: typeId as string,
    status: status as string,
  });

  const fc: GeoFeatureCollection = {
    type: 'FeatureCollection',
    features: assets.map((a) => ({
      type: 'Feature',
      id: a.id,
      geometry: a.geom,
      properties: {
        assetCode: a.asset_code,
        typeId: a.type_id,
        typeName: a.type_name,
        roadCode: a.road_code,
        milepost: a.milepost,
        milepostMeters: a.milepost_meters,
        direction: a.direction,
        status: a.status,
        conditionGrade: a.condition_grade,
        description: a.description,
        discoveryTime: a.discovery_time,
        videoSliceId: a.video_slice_id,
        videoOffsetSeconds: a.video_offset_seconds,
      },
    })),
  };

  res.json(fc);
});

export default router;
