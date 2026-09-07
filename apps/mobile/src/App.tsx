import React, { useState, useEffect } from 'react';
import { PatrolSession, GPSTrackPoint, Asset, calculatePointMilepost } from '@road-gis/shared';
import { PatrolDashboard } from './components/PatrolDashboard.js';
import { SyncQueueModal } from './components/SyncQueueModal.js';
import { PendingAssetsModal } from './components/PendingAssetsModal.js';
import { gpsTracker } from './services/gps.js';
import { videoRecorder } from './services/camera.js';
import { syncManager } from './services/sync.js';
import { offlineDb } from './services/db.js';

export const App: React.FC = () => {
  const [isPatrolling, setIsPatrolling] = useState(false);
  const [currentSession, setCurrentSession] = useState<PatrolSession | null>(null);
  const [gpsPoint, setGpsPoint] = useState<GPSTrackPoint | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [sliceFileName, setSliceFileName] = useState('VIDEO_001.mp4');

  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);

  // G105 国道仿真线段顶点
  const g105Coords: [number, number][] = [
    [113.250000, 23.100000],
    [113.265000, 23.125000],
    [113.280000, 23.150000],
    [113.295000, 23.180000],
    [113.310000, 23.210000],
    [113.330000, 23.245000],
    [113.355000, 23.280000],
    [113.380000, 23.320000],
  ];

  const updatePendingCount = () => {
    setPendingCount(offlineDb.getPendingTasks().length);
  };

  useEffect(() => {
    updatePendingCount();
    syncManager.onProgress(() => {
      updatePendingCount();
    });
  }, []);

  // 1. 开始巡查
  const handleStartPatrol = () => {
    const sessionId = `PAT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const session: PatrolSession = {
      id: sessionId,
      user_id: '22222222-2222-2222-2222-222222222222',
      user_name: '张三 (车载移动巡查端)',
      vehicle_plate: '粤A12345',
      road_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      road_code: 'G105',
      status: 'IN_PROGRESS',
      start_time: new Date().toISOString(),
      duration_seconds: 0,
      distance_km: 0,
      asset_count: 0,
      anomaly_count: 0,
      video_count: 1,
      sync_status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setCurrentSession(session);
    setIsPatrolling(true);

    // 保存离线数据库并加入 P1 队列
    offlineDb.saveSession(session);
    offlineDb.saveTask({
      id: crypto.randomUUID(),
      session_id: sessionId,
      task_type: 'SESSION',
      priority: 1,
      resource_id: sessionId,
      total_bytes: 1024,
      uploaded_bytes: 0,
      status: 'PENDING',
      retry_count: 0,
    });

    // 启动高精度持续 GPS 采集
    gpsTracker.start(sessionId, (pt) => {
      setGpsPoint(pt);
      // 每采集一定点数自动生成 P2 轨迹上传任务
      updatePendingCount();
    });

    // 启动切片录像
    videoRecorder.startRecording(sessionId);
    const slice = videoRecorder.getCurrentSlice();
    if (slice) setSliceFileName(slice.file_name);

    updatePendingCount();
    if (isOnline) {
      syncManager.triggerSync();
    }
  };

  // 2. 驾驶友好一键秒级快速打点采集
  const handleQuickCollect = (typeId: string, typeName: string, isAnomaly: boolean = false) => {
    if (!currentSession) return;

    const pt = gpsTracker.getCurrentPoint() || {
      latitude: 23.150000,
      longitude: 113.280000,
      speed_kmh: 60,
      heading: 45,
      altitude: 20,
      accuracy: 4,
    };

    // 本地即刻根据中心线折线推算标称桩号
    const projection = calculatePointMilepost([pt.longitude, pt.latitude], g105Coords, 120000);

    const currSlice = videoRecorder.getCurrentSlice();
    const offsetSecs = videoRecorder.getCurrentOffsetSeconds();
    const nowIso = new Date().toISOString();

    const assetId = crypto.randomUUID();
    const asset: Asset = {
      id: assetId,
      asset_code: `ASSET-G105-${projection.milepostStr.replace('+', '_')}-${Math.floor(100 + Math.random() * 900)}`,
      type_id: typeId,
      type_name: typeName,
      road_id: currentSession.road_id,
      road_code: currentSession.road_code,
      geom: { type: 'Point', coordinates: [pt.longitude, pt.latitude] },
      latitude: pt.latitude,
      longitude: pt.longitude,
      milepost: projection.milepostStr,
      milepost_meters: projection.milepostMeters,
      direction: 'UP',
      status: isAnomaly ? 'ABNORMAL' : 'NORMAL',
      audit_status: 'PENDING_REVIEW',
      condition_grade: isAnomaly ? 'D' : 'A',
      discovery_time: nowIso,
      patrol_session_id: currentSession.id,
      video_slice_id: currSlice?.id,
      video_offset_seconds: offsetSecs,
      sync_status: 'PENDING',
      created_at: nowIso,
      updated_at: nowIso,
    };

    // 写入离线数据库
    offlineDb.saveAsset(asset);

    // 加入 P3 路产优先级队列
    offlineDb.saveTask({
      id: crypto.randomUUID(),
      session_id: currentSession.id,
      task_type: 'ASSET',
      priority: 3,
      resource_id: assetId,
      total_bytes: 2048,
      uploaded_bytes: 0,
      status: 'PENDING',
      retry_count: 0,
    });

    updatePendingCount();

    // 若在线立即静默上传
    if (isOnline) {
      syncManager.triggerSync();
    }
  };

  // 3. 结束巡查
  const handleStopPatrol = () => {
    if (!currentSession) return;

    gpsTracker.stop();
    videoRecorder.stopRecording();

    currentSession.status = 'COMPLETED';
    currentSession.end_time = new Date().toISOString();
    offlineDb.saveSession(currentSession);

    // 创建 P2 轨迹全量打包任务
    offlineDb.saveTask({
      id: crypto.randomUUID(),
      session_id: currentSession.id,
      task_type: 'TRACK',
      priority: 2,
      resource_id: currentSession.id,
      total_bytes: 10240,
      uploaded_bytes: 0,
      status: 'PENDING',
      retry_count: 0,
    });

    setIsPatrolling(false);
    updatePendingCount();

    if (isOnline) {
      syncManager.triggerSync();
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-black font-sans select-none">
      <PatrolDashboard
        isPatrolling={isPatrolling}
        onStartPatrol={handleStartPatrol}
        onStopPatrol={handleStopPatrol}
        onQuickCollect={handleQuickCollect}
        gpsPoint={gpsPoint}
        videoDurationSecs={videoDuration}
        sliceFileName={sliceFileName}
        isOnline={isOnline}
        pendingCount={pendingCount}
        onOpenSync={() => setShowSyncModal(true)}
        onOpenPending={() => setShowPendingModal(true)}
      />

      {/* 离线队列与断点续传弹窗 */}
      {showSyncModal && (
        <SyncQueueModal
          onClose={() => {
            setShowSyncModal(false);
            updatePendingCount();
          }}
          isOnline={isOnline}
          onToggleOnline={() => {
            const next = !isOnline;
            setIsOnline(next);
            if (next) syncManager.triggerSync();
          }}
        />
      )}

      {/* 停车安全补录弹窗 */}
      {showPendingModal && (
        <PendingAssetsModal
          onClose={() => {
            setShowPendingModal(false);
            updatePendingCount();
          }}
        />
      )}
    </div>
  );
};
