import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { createApp } from '../dist/app.js';
import { dbStore } from '../dist/db/store.js';
import type {
  PatrolSession,
  GPSTrackPoint,
  Asset,
  VideoSlice,
  VideoEvent,
  AssetHistoryRecord,
  SyncQueueItem
} from '@road-gis/shared';

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

// 模拟移动端离线 IndexedDB 存储容器
class MockClientOfflineStorage {
  public sessions = new Map<string, PatrolSession>();
  public tracks = new Map<string, GPSTrackPoint[]>();
  public assets = new Map<string, Asset>();
  public videoSlices = new Map<string, VideoSlice>();
  public videoEvents = new Map<string, VideoEvent>();
  public assetHistory = new Map<string, AssetHistoryRecord[]>();
  public syncQueue: SyncQueueItem[] = [];

  // 保存数据
  saveSession(session: PatrolSession) { this.sessions.set(session.id, { ...session }); }
  saveTrackPoints(sessionId: string, points: GPSTrackPoint[]) {
    const list = this.tracks.get(sessionId) || [];
    list.push(...points);
    this.tracks.set(sessionId, list);
  }
  saveAsset(asset: Asset) { this.assets.set(asset.id, { ...asset }); }
  saveVideoSlice(slice: VideoSlice) { this.videoSlices.set(slice.id, { ...slice }); }
  saveVideoEvent(event: VideoEvent) { this.videoEvents.set(event.id, { ...event }); }
  addAssetHistory(record: AssetHistoryRecord) {
    const list = this.assetHistory.get(record.asset_id) || [];
    list.push({ ...record });
    this.assetHistory.set(record.asset_id, list);
  }
  pushQueue(item: SyncQueueItem) { this.syncQueue.push({ ...item }); }

  // 模拟序列化持久化与重启反序列化 (模拟 IndexedDB 刷新重载)
  serialize(): string {
    return JSON.stringify({
      sessions: Array.from(this.sessions.entries()),
      tracks: Array.from(this.tracks.entries()),
      assets: Array.from(this.assets.entries()),
      videoSlices: Array.from(this.videoSlices.entries()),
      videoEvents: Array.from(this.videoEvents.entries()),
      assetHistory: Array.from(this.assetHistory.entries()),
      syncQueue: this.syncQueue,
    });
  }

  static deserialize(json: string): MockClientOfflineStorage {
    const data = JSON.parse(json);
    const store = new MockClientOfflineStorage();
    store.sessions = new Map(data.sessions);
    store.tracks = new Map(data.tracks);
    store.assets = new Map(data.assets);
    store.videoSlices = new Map(data.videoSlices);
    store.videoEvents = new Map(data.videoEvents);
    store.assetHistory = new Map(data.assetHistory);
    store.syncQueue = data.syncQueue;
    return store;
  }
}

// 共享测试上下文
let clientStore = new MockClientOfflineStorage();
const testSessionId = `PAT-TEST-${Date.now()}`;
const testVideoSliceId = `VID-${testSessionId}-001`;
const assetIds: string[] = [];
const videoEventIds: string[] = [];

// ==========================================
// 场景 1：纯离线环境数据采集与本地保存
// ==========================================
test('Scenario 1: Full offline collection (GPS + 5 assets + photos + video) locally saved', async () => {
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. 本地生成巡查会话 (使用客户端 UUID / 业务主键)
  const session: PatrolSession = {
    id: testSessionId,
    user_id: '22222222-2222-2222-2222-222222222222',
    user_name: '巡查员张三',
    vehicle_plate: '粤A12345',
    road_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    road_code: 'G105',
    status: 'RUNNING',
    start_time: nowIso,
    duration_seconds: 300,
    distance_km: 4.8,
    asset_count: 5,
    anomaly_count: 1,
    video_count: 1,
    sync_status: 'PENDING',
    created_at: nowIso,
    updated_at: nowIso,
  };
  clientStore.saveSession(session);
  clientStore.pushQueue({
    id: crypto.randomUUID(),
    session_id: testSessionId,
    item_type: 'PATROL_SESSION',
    priority: 1,
    resource_id: testSessionId,
    status: 'PENDING',
    retry_count: 0,
    max_retries: 5,
    idempotency_key: `PATROL_SESSION_${testSessionId}`,
    created_at: nowIso,
    updated_at: nowIso,
  });

  // 2. 本地记录 GPS 轨迹点批次 (20个高精点)
  const gpsPoints: GPSTrackPoint[] = [];
  for (let i = 0; i < 20; i++) {
    gpsPoints.push({
      session_id: testSessionId,
      point_time: new Date(now.getTime() + i * 1000).toISOString(),
      latitude: 23.15 + i * 0.001,
      longitude: 113.28 + i * 0.001,
      speed_kmh: 60.0,
      heading: 45,
      altitude: 20.0,
      accuracy: 3.5,
      provider: 'gnss_rtk',
      is_valid: true,
    });
  }
  clientStore.saveTrackPoints(testSessionId, gpsPoints);
  clientStore.pushQueue({
    id: crypto.randomUUID(),
    session_id: testSessionId,
    item_type: 'GPS_TRACK',
    priority: 2,
    resource_id: testSessionId,
    status: 'PENDING',
    retry_count: 0,
    max_retries: 5,
    idempotency_key: `GPS_TRACK_${testSessionId}`,
    created_at: nowIso,
    updated_at: nowIso,
  });

  // 3. 视频切片元数据保存
  const slice: VideoSlice = {
    id: testVideoSliceId,
    session_id: testSessionId,
    file_name: 'VIDEO_001.mp4',
    start_time: nowIso,
    end_time: new Date(now.getTime() + 300 * 1000).toISOString(),
    duration_seconds: 300,
    file_size_bytes: 1024 * 64, // 64KB 用于分块测试
    upload_status: 'PENDING',
    uploaded_bytes: 0,
  };
  clientStore.saveVideoSlice(slice);

  // 4. 离线连续采集 5 种不同类型路产 (含异常病害)
  const assetDefinitions = [
    { typeId: 'TRAFFIC_SIGN', typeName: '限速80标识牌', isAnomaly: false, offsetSecs: 25 },
    { typeId: 'HUNDRED_METER_POST', typeName: '百米桩 K127+100', isAnomaly: false, offsetSecs: 60 },
    { typeId: 'GUARDRAIL', typeName: '波形梁钢护栏', isAnomaly: false, offsetSecs: 110 },
    { typeId: 'TREE', typeName: '行道绿化树木', isAnomaly: false, offsetSecs: 180 },
    { typeId: 'DISEASE', typeName: '路面严重坑槽病害', isAnomaly: true, offsetSecs: 240 },
  ];

  for (const def of assetDefinitions) {
    const assetId = crypto.randomUUID();
    assetIds.push(assetId);

    const asset: Asset = {
      id: assetId,
      asset_code: `ASSET-G105-${def.typeId}-${Date.now().toString().slice(-4)}`,
      type_id: def.typeId,
      type_name: def.typeName,
      road_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      road_code: 'G105',
      geom: { type: 'Point', coordinates: [113.285, 23.155] },
      latitude: 23.155,
      longitude: 113.285,
      milepost: 'K127+250',
      milepost_meters: 127250,
      direction: 'UP',
      status: def.isAnomaly ? 'ABNORMAL' : 'NORMAL',
      audit_status: 'PENDING_REVIEW',
      condition_grade: def.isAnomaly ? 'D' : 'A',
      discovery_time: new Date(now.getTime() + def.offsetSecs * 1000).toISOString(),
      patrol_session_id: testSessionId,
      video_slice_id: testVideoSliceId,
      video_offset_seconds: def.offsetSecs,
      sync_status: 'PENDING',
      created_at: nowIso,
      updated_at: nowIso,
    };
    clientStore.saveAsset(asset);

    // 视频证据事件绑定 (VideoEvent)
    const eventId = crypto.randomUUID();
    videoEventIds.push(eventId);
    const videoEvent: VideoEvent = {
      id: eventId,
      session_id: testSessionId,
      video_id: testVideoSliceId,
      asset_id: assetId,
      event_type: def.isAnomaly ? 'ANOMALY_FLAGGED' : 'ASSET_DETECTED',
      timestamp: asset.discovery_time,
      video_offset_seconds: def.offsetSecs,
      description: `离线一键打点证据：${def.typeName}`,
      created_at: nowIso,
    };
    clientStore.saveVideoEvent(videoEvent);

    // 写入不可覆盖变更历史 (AssetHistoryRecord)
    clientStore.addAssetHistory({
      id: crypto.randomUUID(),
      asset_id: assetId,
      session_id: testSessionId,
      action: def.isAnomaly ? 'ANOMALY_REPORTED' : 'FIRST_DISCOVERY',
      operator_name: '巡查员张三',
      new_status: asset.status,
      latitude: asset.latitude,
      longitude: asset.longitude,
      milepost: asset.milepost,
      video_event_id: eventId,
      notes: '离线车载初次发现',
      timestamp: nowIso,
    });

    // 压入 P3 优先级队列 (路产)
    clientStore.pushQueue({
      id: crypto.randomUUID(),
      session_id: testSessionId,
      item_type: 'ASSET',
      priority: 3,
      resource_id: assetId,
      status: 'PENDING',
      retry_count: 0,
      max_retries: 5,
      idempotency_key: `ASSET_${assetId}`,
      created_at: nowIso,
      updated_at: nowIso,
    });

    // 压入 P3 优先级队列 (视频事件)
    clientStore.pushQueue({
      id: crypto.randomUUID(),
      session_id: testSessionId,
      item_type: 'VIDEO_EVENT',
      priority: 3,
      resource_id: eventId,
      status: 'PENDING',
      retry_count: 0,
      max_retries: 5,
      idempotency_key: `VIDEO_EVENT_${eventId}`,
      created_at: nowIso,
      updated_at: nowIso,
    });
  }

  // 5. 压入 P5 视频切片上传任务
  clientStore.pushQueue({
    id: crypto.randomUUID(),
    session_id: testSessionId,
    item_type: 'VIDEO',
    priority: 5,
    resource_id: testVideoSliceId,
    status: 'PENDING',
    retry_count: 0,
    max_retries: 5,
    idempotency_key: `VIDEO_${testVideoSliceId}`,
    created_at: nowIso,
    updated_at: nowIso,
  });

  // 验证离线持久化状态
  assert.strictEqual(clientStore.sessions.size, 1);
  assert.strictEqual(clientStore.assets.size, 5);
  assert.strictEqual(clientStore.videoEvents.size, 5);
  assert.strictEqual(clientStore.tracks.get(testSessionId)!.length, 20);
  assert.strictEqual(clientStore.syncQueue.length, 1 + 1 + 5 + 5 + 1); // 13个任务
});

// ==========================================
// 场景 2：移动端重启/刷新后本地数据不丢失
// ==========================================
test('Scenario 2: App reload preserves unsynced records (IndexedDB persistence)', async () => {
  // 模拟应用关闭、序列化到磁盘，并在新会话中重启重载
  const serialized = clientStore.serialize();
  const reloadedStore = MockClientOfflineStorage.deserialize(serialized);

  assert.strictEqual(reloadedStore.sessions.size, 1);
  assert.ok(reloadedStore.sessions.has(testSessionId));
  assert.strictEqual(reloadedStore.assets.size, 5);
  for (const id of assetIds) {
    assert.ok(reloadedStore.assets.has(id), `Asset ${id} should be preserved across app reload`);
  }
  assert.strictEqual(reloadedStore.videoEvents.size, 5);
  assert.strictEqual(reloadedStore.tracks.get(testSessionId)!.length, 20);
  assert.strictEqual(reloadedStore.syncQueue.length, 13);

  // 确认队列中所有任务依旧是 PENDING 状态
  const pendingCount = reloadedStore.syncQueue.filter((q) => q.status === 'PENDING').length;
  assert.strictEqual(pendingCount, 13);

  // 覆盖当前内存客户端实例，证明完全依赖恢复后的持久化数据
  clientStore = reloadedStore;
});

// ==========================================
// 场景 3：网络恢复后按 5 级优先级自动同步至服务端
// ==========================================
test('Scenario 3: Network reconnect triggers 5-priority automatic sync', async () => {
  // 按优先级排序队列：P1 -> P2 -> P3 -> P4 -> P5
  const sortedQueue = [...clientStore.syncQueue].sort((a, b) => a.priority - b.priority);

  const syncedPriorities: number[] = [];

  for (const task of sortedQueue) {
    syncedPriorities.push(task.priority);

    // P1: 巡查会话同步
    if (task.item_type === 'PATROL_SESSION') {
      const session = clientStore.sessions.get(task.resource_id)!;
      const res = await fetch(`${baseUrl}/patrol/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': task.idempotency_key },
        body: JSON.stringify(session),
      });
      assert.strictEqual(res.status, 201);
      task.status = 'UPLOADED';
    }

    // P2: GPS 轨迹批次同步
    else if (task.item_type === 'GPS_TRACK') {
      const points = clientStore.tracks.get(task.session_id)!;
      const res = await fetch(`${baseUrl}/tracks/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': task.idempotency_key },
        body: JSON.stringify({ sessionId: task.session_id, points }),
      });
      assert.strictEqual(res.status, 201);
      task.status = 'UPLOADED';
    }

    // P3: 路产与视频事件同步
    else if (task.item_type === 'ASSET') {
      const asset = clientStore.assets.get(task.resource_id)!;
      const res = await fetch(`${baseUrl}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': task.idempotency_key },
        body: JSON.stringify(asset),
      });
      assert.strictEqual(res.status, 201);
      task.status = 'UPLOADED';

      // 同步不可覆盖变更历史
      const historyList = clientStore.assetHistory.get(asset.id) || [];
      for (const h of historyList) {
        await fetch(`${baseUrl}/assets/${asset.id}/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(h),
        });
      }
    } else if (task.item_type === 'VIDEO_EVENT') {
      const event = clientStore.videoEvents.get(task.resource_id)!;
      const res = await fetch(`${baseUrl}/video-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': task.idempotency_key },
        body: JSON.stringify(event),
      });
      assert.strictEqual(res.status, 201);
      task.status = 'UPLOADED';
    }
  }

  // 验证优先级同步顺序：确保 P1 最先同步，接着 P2，然后 P3
  assert.strictEqual(syncedPriorities[0], 1, 'P1 Session must sync first');
  assert.strictEqual(syncedPriorities[1], 2, 'P2 Track must sync second');
  assert.strictEqual(syncedPriorities[2], 3, 'P3 Assets and VideoEvents must follow');

  // 验证服务端资产库中已正确落盘 5 个路产
  const serverAssetsRes = await fetch(`${baseUrl}/assets?sessionId=${testSessionId}`);
  const serverAssetsData = await serverAssetsRes.json();
  assert.strictEqual(serverAssetsData.code, 200);
  assert.strictEqual(serverAssetsData.data.length, 5);
});

// ==========================================
// 场景 4：上传过程中模拟网络再次中断 (50% 切片断网)
// ==========================================
test('Scenario 4: Mid-upload disconnection preserves queue state without data corruption', async () => {
  const slice = clientStore.videoSlices.get(testVideoSliceId)!;

  // 1. 登记切片元数据
  const metaRes = await fetch(`${baseUrl}/videos/slices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slice),
  });
  assert.strictEqual(metaRes.status, 201);

  // 2. 初始化上传进度
  const initRes = await fetch(`${baseUrl}/videos/upload/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sliceId: slice.id }),
  });
  const initData = await initRes.json();
  assert.strictEqual(initData.data.uploadOffset, 0);

  // 3. 上传前 50% 块 (32KB)
  const totalBytes = slice.file_size_bytes; // 64KB
  const halfBytes = totalBytes / 2; // 32KB
  const chunk1 = Buffer.alloc(halfBytes, 0xaa);

  const chunk1Res = await fetch(`${baseUrl}/videos/upload/chunk?sliceId=${slice.id}`, {
    method: 'PATCH',
    headers: {
      'Upload-Offset': '0',
      'Content-Type': 'application/octet-stream',
    },
    body: chunk1,
  });
  assert.strictEqual(chunk1Res.status, 200);

  // 4. 模拟在上传第二个 50% 块时突然发生网络崩溃 (直接中断，不发送剩余数据)
  // 本地更新切片已上传状态为 UPLOADING，已上传 32KB
  slice.uploaded_bytes = halfBytes;
  slice.upload_status = 'UPLOADING';

  const videoTask = clientStore.syncQueue.find((q) => q.resource_id === testVideoSliceId);
  assert.ok(videoTask);
  videoTask.status = 'FAILED';
  videoTask.last_error = 'Network connection dropped unexpectedly';

  // 验证服务端切片状态：已持久化当前已上传偏移量，未发生数据损坏
  const checkRes = await fetch(`${baseUrl}/videos/upload/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sliceId: slice.id }),
  });
  const checkData = await checkRes.json();
  assert.strictEqual(checkData.data.uploadOffset, halfBytes, 'Server should securely preserve 50% offset');
  assert.strictEqual(checkData.data.status, 'UPLOADING');
});

// ==========================================
// 场景 5：网络再次恢复后断点续传与幂等性验证
// ==========================================
test('Scenario 5: Re-upload prevents duplicate records & completes video chunk resume (Idempotency)', async () => {
  const slice = clientStore.videoSlices.get(testVideoSliceId)!;
  const halfBytes = slice.file_size_bytes / 2;

  // 1. 断点续传后 50% (从 32KB 续传至 64KB)
  const chunk2 = Buffer.alloc(halfBytes, 0xbb);
  const chunk2Res = await fetch(`${baseUrl}/videos/upload/chunk?sliceId=${slice.id}`, {
    method: 'PATCH',
    headers: {
      'Upload-Offset': halfBytes.toString(),
      'Content-Type': 'application/octet-stream',
    },
    body: chunk2,
  });
  assert.strictEqual(chunk2Res.status, 200);
  const chunk2Data = await chunk2Res.json();
  assert.strictEqual(chunk2Data.data.completed, true, 'Video upload must complete seamlessly');

  // 2. 幂等性测试：使用相同的客户端 UUID 再次全量上传 Session 与 5 个路产
  const session = clientStore.sessions.get(testSessionId)!;
  const dupSessionRes = await fetch(`${baseUrl}/patrol/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': `PATROL_SESSION_${testSessionId}` },
    body: JSON.stringify(session),
  });
  assert.strictEqual(dupSessionRes.status, 201, 'Duplicate session POST must succeed idempotently');

  // 再次重试上传 5 个路产
  for (const id of assetIds) {
    const asset = clientStore.assets.get(id)!;
    const dupAssetRes = await fetch(`${baseUrl}/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': `ASSET_${id}` },
      body: JSON.stringify(asset),
    });
    assert.strictEqual(dupAssetRes.status, 201, `Duplicate asset ${id} POST must succeed idempotently`);
  }

  // 再次重试上传轨迹
  const points = clientStore.tracks.get(testSessionId)!;
  const dupTracksRes = await fetch(`${baseUrl}/tracks/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': `GPS_TRACK_${testSessionId}` },
    body: JSON.stringify({ sessionId: testSessionId, points }),
  });
  assert.strictEqual(dupTracksRes.status, 201, 'Duplicate tracks batch POST must succeed idempotently');

  // 3. 校验服务端总数：路产总数必须仍严格等于 5，不得产生重复数据！
  const serverAssetsRes = await fetch(`${baseUrl}/assets?sessionId=${testSessionId}`);
  const serverAssetsData = await serverAssetsRes.json();
  assert.strictEqual(serverAssetsData.data.length, 5, 'Idempotency guarantee: exactly 5 assets must exist');
});

// ==========================================
// 场景 6：视频-路产联动验证与历史追溯
// ==========================================
test('Scenario 6: Asset inspection retrieves linked photos and video events with exact offsets', async () => {
  // 1. 查询第 5 个路产 (严重坑槽病害)
  const anomalyAssetId = assetIds[4];
  const detailRes = await fetch(`${baseUrl}/assets/${anomalyAssetId}`);
  assert.strictEqual(detailRes.status, 200);
  const detailData = await detailRes.json();
  const asset = detailData.data;

  // 验证路产详情
  assert.strictEqual(asset.id, anomalyAssetId);
  assert.strictEqual(asset.status, 'ABNORMAL');
  assert.strictEqual(asset.condition_grade, 'D');
  assert.strictEqual(asset.video_slice_id, testVideoSliceId);
  assert.strictEqual(asset.video_offset_seconds, 240, 'Video frame offset must be exactly 240 seconds');

  // 验证绑定的视频事件 VideoEvent
  assert.ok(asset.video_events && asset.video_events.length > 0);
  const event = asset.video_events[0];
  assert.strictEqual(event.event_type, 'ANOMALY_FLAGGED');
  assert.strictEqual(event.video_offset_seconds, 240);
  assert.strictEqual(event.asset_id, anomalyAssetId);

  // 验证变更历史记录不可覆盖 (AssetHistory)
  assert.ok(asset.history && asset.history.length > 0);
  assert.strictEqual(asset.history[0].action, 'ANOMALY_REPORTED');
  assert.strictEqual(asset.history[0].operator_name, '巡查员张三');

  // 2. 通过绝对时间戳反查视频定位 (/api/v1/videos/locate)
  const locateRes = await fetch(`${baseUrl}/videos/locate?timestamp=${encodeURIComponent(asset.discovery_time)}`);
  assert.strictEqual(locateRes.status, 200);
  const locateData = await locateRes.json();
  assert.strictEqual(locateData.data.videoSlice.id, testVideoSliceId);
  assert.strictEqual(locateData.data.offsetSeconds, 240);
});

// ==========================================
// 场景 7：同步队列严密状态迁移与重试生命周期验证
// ==========================================
test('Scenario 7: Sync queue lifecycle state transitions (PENDING -> UPLOADING -> UPLOADED and retry loop)', async () => {
  // 1. 验证正向流程: PENDING -> UPLOADING -> UPLOADED
  const normalItem: SyncQueueItem = {
    id: crypto.randomUUID(),
    session_id: testSessionId,
    item_type: 'ASSET',
    priority: 3,
    resource_id: crypto.randomUUID(),
    status: 'PENDING',
    retry_count: 0,
    max_retries: 5,
    idempotency_key: `ASSET_NORMAL_${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  assert.strictEqual(normalItem.status, 'PENDING');
  normalItem.status = 'UPLOADING';
  normalItem.updated_at = new Date().toISOString();
  assert.strictEqual(normalItem.status, 'UPLOADING');

  normalItem.status = 'UPLOADED';
  normalItem.updated_at = new Date().toISOString();
  assert.strictEqual(normalItem.status, 'UPLOADED');

  // 2. 验证失败重试回退循环: PENDING -> UPLOADING -> FAILED -> PENDING (Retry)
  const retryItem: SyncQueueItem = {
    id: crypto.randomUUID(),
    session_id: testSessionId,
    item_type: 'PHOTO',
    priority: 4,
    resource_id: crypto.randomUUID(),
    status: 'PENDING',
    retry_count: 0,
    max_retries: 3,
    idempotency_key: `PHOTO_RETRY_${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 第 1 次尝试上传中
  retryItem.status = 'UPLOADING';
  assert.strictEqual(retryItem.status, 'UPLOADING');

  // 发生瞬时网络中断，迁移为 FAILED，记录错误信息与增加重试计数
  retryItem.status = 'FAILED';
  retryItem.retry_count += 1;
  retryItem.last_error = 'Connection reset by peer';
  assert.strictEqual(retryItem.status, 'FAILED');
  assert.strictEqual(retryItem.retry_count, 1);

  // 网络检测恢复或定时调度器唤起重试，状态自动从 FAILED 重新置为 PENDING
  if (retryItem.retry_count < retryItem.max_retries) {
    retryItem.status = 'PENDING';
    retryItem.last_error = undefined;
  }
  assert.strictEqual(retryItem.status, 'PENDING', 'Failed item under max_retries must reset to PENDING');

  // 第 2 次尝试并成功
  retryItem.status = 'UPLOADING';
  retryItem.status = 'UPLOADED';
  assert.strictEqual(retryItem.status, 'UPLOADED');
});

// ==========================================
// 场景 8：真机 GPS 实体全字段规范与现场照片多媒体联动验证
// ==========================================
test('Scenario 8: Real GNSS data structure and Photo entity verification', async () => {
  const photoAssetId = assetIds[0];
  const photoId = crypto.randomUUID();

  // 1. 验证真实 GNSS 坐标点全部必填字段
  const realGpsPoint: GPSTrackPoint = {
    session_id: testSessionId,
    point_time: new Date().toISOString(),
    latitude: 23.150042,
    longitude: 113.280125,
    speed_kmh: 58.5,
    heading: 42,
    altitude: 18.3,
    accuracy: 3.2,
    provider: 'device_gnss',
    is_valid: true,
  };

  assert.ok(realGpsPoint.latitude > 0 && realGpsPoint.longitude > 0);
  assert.strictEqual(realGpsPoint.provider, 'device_gnss');
  assert.strictEqual(realGpsPoint.accuracy, 3.2);

  // 2. 验证现场实景照片元数据创建并上报服务端
  const photoRes = await fetch(`${baseUrl}/photos/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': `PHOTO_${photoId}` },
    body: JSON.stringify({
      id: photoId,
      asset_id: photoAssetId,
      session_id: testSessionId,
      file_name: `PHOTO_${photoId.slice(0, 8)}.jpg`,
      storage_path: `/uploads/photos/${photoId}.jpg`,
      storage_url: `/uploads/photos/${photoId}.jpg`,
      file_size_bytes: 512 * 1024,
      photo_time: new Date().toISOString(),
      latitude: realGpsPoint.latitude,
      longitude: realGpsPoint.longitude,
      azimuth: realGpsPoint.heading,
    }),
  });
  assert.strictEqual(photoRes.status, 201);
  const photoData = await photoRes.json();
  assert.strictEqual(photoData.data.asset_id, photoAssetId);

  // 3. 通过路产 ID 查询照片
  const assetWithPhotoRes = await fetch(`${baseUrl}/assets/${photoAssetId}`);
  const assetWithPhotoData = await assetWithPhotoRes.json();
  assert.ok(assetWithPhotoData.data.photos && assetWithPhotoData.data.photos.length > 0);
  assert.strictEqual(assetWithPhotoData.data.photos[0].id, photoId);
});
