import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { createApp } from '../dist/app.js';
import { dbStore } from '../dist/db/store.js';

const app = createApp();
let server: http.Server;
let baseUrl = '';

test.before((t, done) => {
  server = app.listen(0, '127.0.0.1', () => {
    const address = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
    done();
  });
});

test.after((t, done) => {
  server.close(done);
});

test('API: Health Check', async () => {
  const res = await fetch(`${baseUrl.replace('/api/v1', '')}/health`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'UP');
});

test('API: Auth Login & Profile', async () => {
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'zhangsan', password: 'password123' }),
  });
  assert.strictEqual(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.strictEqual(loginData.code, 200);
  assert.ok(loginData.data.token, 'Token should be returned');
  assert.strictEqual(loginData.data.user.username, 'zhangsan');

  const token = loginData.data.token;
  const meRes = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(meRes.status, 200);
  const meData = await meRes.json();
  assert.strictEqual(meData.data.username, 'zhangsan');
});

test('API: Full Patrol Session Lifecycle & GPS Tracking', async () => {
  // 1. 开启巡查 Session
  const sessionRes = await fetch(`${baseUrl}/patrol/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: '22222222-2222-2222-2222-222222222222',
      user_name: '张三',
      vehicle_plate: '粤A99999',
      road_code: 'G105',
    }),
  });
  assert.strictEqual(sessionRes.status, 201);
  const sessionData = await sessionRes.json();
  const sessionId = sessionData.data.id;
  assert.ok(sessionId.startsWith('PAT-'));

  // 2. 批量上传连续 GPS 轨迹点
  const trackPoints = [
    {
      session_id: sessionId,
      point_time: new Date().toISOString(),
      latitude: 23.100100,
      longitude: 113.250100,
      speed_kmh: 55.0,
      heading: 45.0,
      altitude: 20.0,
      accuracy: 5.0,
    },
    {
      session_id: sessionId,
      point_time: new Date(Date.now() + 2000).toISOString(),
      latitude: 23.105000,
      longitude: 113.253000,
      speed_kmh: 58.0,
      heading: 45.0,
      altitude: 22.0,
      accuracy: 6.0,
    },
    {
      session_id: sessionId,
      point_time: new Date(Date.now() + 4000).toISOString(),
      latitude: 23.110000,
      longitude: 113.256000,
      speed_kmh: 60.0,
      heading: 45.0,
      altitude: 21.0,
      accuracy: 4.0,
    },
  ];

  const trackRes = await fetch(`${baseUrl}/tracks/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, points: trackPoints }),
  });
  assert.strictEqual(trackRes.status, 201);
  const trackData = await trackRes.json();
  assert.strictEqual(trackData.data.count, 3);

  // 3. 校验 GeoJSON 轨迹输出
  const geojsonRes = await fetch(`${baseUrl}/tracks/session/${sessionId}/geojson`);
  assert.strictEqual(geojsonRes.status, 200);
  const geojsonData = await geojsonRes.json();
  assert.strictEqual(geojsonData.type, 'FeatureCollection');
  assert.strictEqual(geojsonData.features[0].geometry.type, 'LineString');
  assert.strictEqual(geojsonData.features[0].geometry.coordinates.length, 3);

  // 4. 结束巡查 Session
  const finishRes = await fetch(`${baseUrl}/patrol/sessions/${sessionId}/finish`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: '测试巡查结束' }),
  });
  assert.strictEqual(finishRes.status, 200);
  const finishData = await finishRes.json();
  assert.strictEqual(finishData.data.status, 'COMPLETED');
  assert.ok(finishData.data.trajectory_geom, 'Trajectory LineString should be auto generated');
});

test('API: Asset Creation, Auto-Milepost Calculation & BBOX Spatial Query', async () => {
  // 创建路产，经纬度位于 G105 起点附近
  const assetRes = await fetch(`${baseUrl}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type_id: 'TRAFFIC_SIGN',
      latitude: 23.102000,
      longitude: 113.251000,
      direction: 'UP',
      status: 'NORMAL',
      description: '自动化测试创建标识牌',
    }),
  });

  assert.strictEqual(assetRes.status, 201);
  const assetData = await assetRes.json();
  assert.ok(assetData.data.id);
  assert.ok(assetData.data.milepost.startsWith('K120+'), `Milepost should be auto calculated (actual: ${assetData.data.milepost})`);

  // BBOX 空间矩形检索
  const bboxRes = await fetch(`${baseUrl}/assets/spatial/bbox?minLng=113.24&minLat=23.09&maxLng=113.26&maxLat=23.11`);
  assert.strictEqual(bboxRes.status, 200);
  const bboxData = await bboxRes.json();
  assert.ok(bboxData.data.length >= 1, 'Should find at least 1 asset in bbox');
});

test('API: Video Slices & Chunked Resumable Upload (50% Disconnect & Resume)', async () => {
  const sliceId = `VID-TEST-${Date.now()}`;
  const totalBytes = 1000;
  const chunk1Size = 500;
  const chunk2Size = 500;

  // 1. 登记切片元数据
  const regRes = await fetch(`${baseUrl}/videos/slices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: sliceId,
      session_id: 'PAT-20260907-0001',
      file_name: `${sliceId}.mp4`,
      start_time: '2026-09-07T12:00:00Z',
      end_time: '2026-09-07T12:05:00Z',
      duration_seconds: 300,
      file_size_bytes: totalBytes,
    }),
  });
  assert.strictEqual(regRes.status, 201);

  // 2. 初始化断点续传，偏移量应为 0
  const init1 = await fetch(`${baseUrl}/videos/upload/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sliceId }),
  });
  const init1Data = await init1.json();
  assert.strictEqual(init1Data.data.uploadOffset, 0);

  // 3. 上传第一块 (500字节，达到50%)
  const chunk1 = Buffer.alloc(chunk1Size, 'A');
  const patch1 = await fetch(`${baseUrl}/videos/upload/chunk?sliceId=${sliceId}`, {
    method: 'PATCH',
    headers: {
      'Upload-Offset': '0',
      'Content-Type': 'application/octet-stream',
    },
    body: chunk1,
  });
  assert.strictEqual(patch1.status, 200);
  const patch1Data = await patch1.json();
  assert.strictEqual(patch1Data.data.uploadedBytes, 500);
  assert.strictEqual(patch1Data.data.completed, false);

  // 4. 模拟网络断开 -> 重新恢复网络 -> 调用 init 查询断点
  const init2 = await fetch(`${baseUrl}/videos/upload/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sliceId }),
  });
  const init2Data = await init2.json();
  assert.strictEqual(init2Data.data.uploadOffset, 500, 'Server should resume from 500 bytes (50%)');

  // 5. 从断点 500 续传剩余 500 字节
  const chunk2 = Buffer.alloc(chunk2Size, 'B');
  const patch2 = await fetch(`${baseUrl}/videos/upload/chunk?sliceId=${sliceId}`, {
    method: 'PATCH',
    headers: {
      'Upload-Offset': '500',
      'Content-Type': 'application/octet-stream',
    },
    body: chunk2,
  });
  assert.strictEqual(patch2.status, 200);
  const patch2Data = await patch2.json();
  assert.strictEqual(patch2Data.data.uploadedBytes, 1000);
  assert.strictEqual(patch2Data.data.completed, true, 'Upload should complete after final chunk');
});

test('API: Video - Timestamp Location Synchronization', async () => {
  // 查找时间位于 2026-09-07 08:32:45 的视频切片与偏移
  const locateRes = await fetch(`${baseUrl}/videos/locate?timestamp=2026-09-07T08:32:45%2B08:00`);
  assert.strictEqual(locateRes.status, 200);
  const locateData = await locateRes.json();
  assert.strictEqual(locateData.data.videoSlice.id, 'VID-PAT20260907-001');
  assert.strictEqual(locateData.data.offsetSeconds, 153);
});

test('API: GIS Roads & Dashboard Stats', async () => {
  const roadsRes = await fetch(`${baseUrl}/gis/roads`);
  assert.strictEqual(roadsRes.status, 200);
  const roadsData = await roadsRes.json();
  assert.strictEqual(roadsData.type, 'FeatureCollection');
  assert.ok(roadsData.features.length >= 1);

  const statsRes = await fetch(`${baseUrl}/stats/dashboard`);
  assert.strictEqual(statsRes.status, 200);
  const statsData = await statsRes.json();
  assert.ok(statsData.data.totalRoads >= 1);
  assert.ok(statsData.data.totalAssets >= 1);
});

test('API: Data Export (GeoJSON, CSV, KML)', async () => {
  const geojsonRes = await fetch(`${baseUrl}/export/geojson`);
  assert.strictEqual(geojsonRes.status, 200);
  const geojsonData = await geojsonRes.json();
  assert.strictEqual(geojsonData.type, 'FeatureCollection');

  const csvRes = await fetch(`${baseUrl}/export/csv`);
  assert.strictEqual(csvRes.status, 200);
  const csvText = await csvRes.text();
  assert.ok(csvText.includes('资产编码,路产类型'));

  const kmlRes = await fetch(`${baseUrl}/export/kml`);
  assert.strictEqual(kmlRes.status, 200);
  const kmlText = await kmlRes.text();
  assert.ok(kmlText.includes('<kml xmlns="http://www.opengis.net/kml/2.2">'));
});
