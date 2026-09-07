import React, { useState, useEffect, useRef } from 'react';
import {
  PatrolSession,
  PatrolStatus,
  GPSTrackPoint,
  Asset,
  AssetHistoryRecord,
  calculatePointMilepost
} from '@road-gis/shared';
import { PatrolDashboard } from './components/PatrolDashboard.js';
import { SyncQueueModal } from './components/SyncQueueModal.js';
import { PendingAssetsModal } from './components/PendingAssetsModal.js';
import { gpsTracker, GPSSignalStatus } from './services/gps.js';
import { videoRecorder, photoManager } from './services/camera.js';
import { syncManager } from './services/sync.js';
import { offlineDb } from './services/db.js';
import { permissionManager } from './services/permissions.js';

export const App: React.FC = () => {
  const [patrolStatus, setPatrolStatus] = useState<PatrolStatus>('CREATED');
  const [currentSession, setCurrentSession] = useState<PatrolSession | null>(null);
  const [gpsPoint, setGpsPoint] = useState<GPSTrackPoint | null>(null);
  const [gpsSignal, setGpsSignal] = useState<GPSSignalStatus>('LOST');
  const [gpsMessage, setGpsMessage] = useState<string>('');
  const [trackCount, setTrackCount] = useState(0);
  const [assetCount, setAssetCount] = useState(0);
  const [lastAssetId, setLastAssetId] = useState<string | null>(null);

  const [videoDuration, setVideoDuration] = useState(0);
  const [sliceFileName, setSliceFileName] = useState('VIDEO_001.mp4');

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncState, setSyncState] = useState<{
    isSyncing: boolean;
    syncedCount: number;
    totalCount: number;
    message: string;
  }>({
    isSyncing: false,
    syncedCount: 0,
    totalCount: 0,
    message: '就绪',
  });

  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);

  const durationTimerRef = useRef<any>(null);

  // G105 国道仿真线段顶点 (用于自动标称桩号拟合)
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

  const updatePendingCount = async () => {
    try {
      const pending = await offlineDb.getPendingTasks();
      setPendingCount(pending.length);
    } catch {
      setPendingCount(0);
    }
  };

  useEffect(() => {
    updatePendingCount();

    // 监听全生命周期实时网络状态切换 (ONLINE / OFFLINE / SYNCING)
    const handleOnline = () => {
      setIsOnline(true);
      syncManager.triggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    syncManager.onProgress((status) => {
      setSyncState({
        isSyncing: status.isSyncing,
        syncedCount: status.syncedCount,
        totalCount: status.totalCount,
        message: status.message,
      });
      setPendingCount(status.pendingCount);
    });

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, []);

  // 1. 开始巡查
  const handleStartPatrol = async () => {
    // 首次开启巡查前请求并确认定位权限
    const perm = await permissionManager.requestLocationPermission();
    if (!perm.granted) {
      console.warn('[Permission]', perm.message);
    }

    const sessionId = `PAT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const session: PatrolSession = {
      id: sessionId,
      user_id: '22222222-2222-2222-2222-222222222222',
      user_name: '张三 (车载移动巡查端)',
      vehicle_plate: '粤A12345',
      road_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      road_code: 'G105',
      status: 'RUNNING',
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
    setPatrolStatus('RUNNING');
    setVideoDuration(0);
    setTrackCount(0);
    setAssetCount(0);
    setLastAssetId(null);

    // 存入离线 IndexedDB 并加入 P1 同步队列
    await offlineDb.saveSession(session);
    await offlineDb.saveTask({
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

    // 启动真实硬件 GPS 采集 (真机默认纯硬件 GPS)
    await gpsTracker.start(sessionId, (pt, signal, msg) => {
      setGpsPoint(pt);
      setGpsSignal(signal);
      if (msg) setGpsMessage(msg);
      setTrackCount(gpsTracker.getRecordedPointCount());
      updatePendingCount();
    });

    // 启动分段切片录像
    videoRecorder.startRecording(sessionId);
    const slice = videoRecorder.getCurrentSlice();
    if (slice) setSliceFileName(slice.file_name);

    // 启动录像计时器
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationTimerRef.current = setInterval(() => {
      setVideoDuration(videoRecorder.getCurrentOffsetSeconds());
      const cur = videoRecorder.getCurrentSlice();
      if (cur) setSliceFileName(cur.file_name);
    }, 1000);

    await updatePendingCount();
    if (isOnline) {
      syncManager.triggerSync();
    }
  };

  // 2. 暂停巡查
  const handlePausePatrol = async () => {
    if (!currentSession) return;
    gpsTracker.pause();
    videoRecorder.pauseRecording();
    setPatrolStatus('PAUSED');

    currentSession.status = 'PAUSED';
    await offlineDb.saveSession(currentSession);
  };

  // 3. 恢复巡查
  const handleResumePatrol = async () => {
    if (!currentSession) return;
    gpsTracker.resume();
    videoRecorder.resumeRecording();
    setPatrolStatus('RUNNING');

    currentSession.status = 'RUNNING';
    await offlineDb.saveSession(currentSession);
  };

  // 4. 停止巡查
  const handleStopPatrol = async () => {
    if (!currentSession) return;

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    gpsTracker.stop();
    videoRecorder.stopRecording();

    currentSession.status = 'COMPLETED';
    currentSession.end_time = new Date().toISOString();
    await offlineDb.saveSession(currentSession);

    // 创建 P2 轨迹全量打包任务
    await offlineDb.saveTask({
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

    setPatrolStatus('COMPLETED');
    await updatePendingCount();

    if (isOnline) {
      syncManager.triggerSync();
    }
  };

  // 5. 8大车载大触控按键一键极速秒级采集
  const handleQuickCollect = async (typeId: string, typeName: string, isAnomaly: boolean = false) => {
    if (!currentSession) return;

    const pt = gpsTracker.getCurrentPoint() || {
      session_id: currentSession.id,
      point_time: new Date().toISOString(),
      latitude: 23.150000,
      longitude: 113.280000,
      speed_kmh: 0,
      heading: 0,
      altitude: 20,
      accuracy: 10,
      provider: 'device_gnss',
      is_valid: true,
    };

    // 本地即刻根据道路折线计算标称桩号
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

    // 1. 保存路产主记录到 IndexedDB
    await offlineDb.saveAsset(asset);
    setLastAssetId(assetId);
    setAssetCount((prev) => prev + 1);

    // 2. 生成绑定的视频证据事件 (VideoEvent)
    const videoEvent = videoRecorder.recordVideoEvent(
      assetId,
      isAnomaly ? 'ANOMALY_FLAGGED' : 'ASSET_DETECTED',
      `巡检快速打点：${typeName} (${projection.milepostStr})`
    );

    // 3. 记录不可覆盖的历史记录变更 (AssetHistory)
    const historyRec: AssetHistoryRecord = {
      id: crypto.randomUUID(),
      asset_id: assetId,
      session_id: currentSession.id,
      action: isAnomaly ? 'ANOMALY_REPORTED' : 'FIRST_DISCOVERY',
      operator_id: currentSession.user_id,
      operator_name: currentSession.user_name,
      previous_status: undefined,
      new_status: asset.status,
      latitude: pt.latitude,
      longitude: pt.longitude,
      milepost: projection.milepostStr,
      video_event_id: videoEvent?.id,
      notes: `车载一键发现路产，标称桩号: ${projection.milepostStr}`,
      timestamp: nowIso,
    };
    await offlineDb.addAssetHistory(historyRec);

    // 4. 加入 P3 路产优先级同步队列
    await offlineDb.saveTask({
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

    // 5. 若成功生成视频证据事件，加入 P3 同步队列
    if (videoEvent) {
      await offlineDb.saveTask({
        id: crypto.randomUUID(),
        session_id: currentSession.id,
        task_type: 'VIDEO_EVENT',
        priority: 3,
        resource_id: videoEvent.id,
        total_bytes: 1024,
        uploaded_bytes: 0,
        status: 'PENDING',
        retry_count: 0,
      });
    }

    await updatePendingCount();

    // 6. 若在线则立即触发静默同步
    if (isOnline) {
      syncManager.triggerSync();
    }
  };

  // 6. 现场相机拍照支持
  const handleCapturePhoto = async (photoDataUrl: string) => {
    if (!currentSession) {
      alert('请先开启巡查');
      return;
    }

    const targetAssetId = lastAssetId || `PHOTO-TARGET-${Date.now()}`;
    await photoManager.capturePhoto(
      targetAssetId,
      currentSession.id,
      photoDataUrl,
      gpsPoint ? { latitude: gpsPoint.latitude, longitude: gpsPoint.longitude } : undefined
    );

    await updatePendingCount();
    if (isOnline) {
      syncManager.triggerSync();
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-black font-sans select-none">
      <PatrolDashboard
        patrolStatus={patrolStatus}
        onStartPatrol={handleStartPatrol}
        onPausePatrol={handlePausePatrol}
        onResumePatrol={handleResumePatrol}
        onStopPatrol={handleStopPatrol}
        onQuickCollect={handleQuickCollect}
        onCapturePhoto={handleCapturePhoto}
        gpsPoint={gpsPoint}
        gpsSignal={gpsSignal}
        gpsMessage={gpsMessage}
        trackCount={trackCount}
        assetCount={assetCount}
        videoDurationSecs={videoDuration}
        sliceFileName={sliceFileName}
        isOnline={isOnline}
        syncState={syncState}
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
