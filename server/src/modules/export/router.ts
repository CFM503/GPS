import { Router, Response } from 'express';
import { dbStore } from '../../db/store.js';

const router = Router();

// GET /api/v1/export/geojson
router.get('/geojson', (req, res: Response) => {
  const assets = dbStore.listAssets();
  const fc = {
    type: 'FeatureCollection',
    features: assets.map((a) => ({
      type: 'Feature',
      id: a.id,
      geometry: a.geom,
      properties: {
        asset_code: a.asset_code,
        type: a.type_name,
        road: a.road_code,
        milepost: a.milepost,
        direction: a.direction,
        status: a.status,
        condition: a.condition_grade,
        discovery_time: a.discovery_time,
        description: a.description,
      },
    })),
  };

  res.setHeader('Content-Type', 'application/geo+json');
  res.setHeader('Content-Disposition', 'attachment; filename="road_assets.geojson"');
  res.send(JSON.stringify(fc, null, 2));
});

// GET /api/v1/export/kml
router.get('/kml', (req, res: Response) => {
  const assets = dbStore.listAssets();
  let kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n<name>Road Assets</name>\n`;

  for (const a of assets) {
    kml += `  <Placemark>\n`;
    kml += `    <name>${a.asset_code} (${a.type_name})</name>\n`;
    kml += `    <description><![CDATA[道路: ${a.road_code}<br/>桩号: ${a.milepost}<br/>状态: ${a.status}<br/>描述: ${a.description || '无'}]]></description>\n`;
    if (a.geom.type === 'Point') {
      kml += `    <Point><coordinates>${a.longitude},${a.latitude},0</coordinates></Point>\n`;
    } else if (a.geom.type === 'LineString') {
      const coords = a.geom.coordinates.map((c) => `${c[0]},${c[1]},0`).join(' ');
      kml += `    <LineString><coordinates>${coords}</coordinates></LineString>\n`;
    }
    kml += `  </Placemark>\n`;
  }

  kml += `</Document>\n</kml>`;

  res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
  res.setHeader('Content-Disposition', 'attachment; filename="road_assets.kml"');
  res.send(kml);
});

// GET /api/v1/export/csv
router.get('/csv', (req, res: Response) => {
  const assets = dbStore.listAssets();
  const headers = ['资产编码', '路产类型', '道路编号', '标称桩号', '行车方向', '经度', '纬度', '状态', '技术状况', '发现时间', '描述'];
  const rows = assets.map((a) => [
    `"${a.asset_code}"`,
    `"${a.type_name}"`,
    `"${a.road_code}"`,
    `"${a.milepost}"`,
    `"${a.direction}"`,
    a.longitude,
    a.latitude,
    `"${a.status}"`,
    `"${a.condition_grade}"`,
    `"${a.discovery_time}"`,
    `"${(a.description || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="road_assets.csv"');
  res.send(csvContent);
});

export default router;
