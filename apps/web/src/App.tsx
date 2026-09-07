import React, { useState, useEffect } from 'react';
import { Road, Asset, AssetType, PatrolSession, GPSTrackPoint, VideoSlice } from '@road-gis/shared';
import { api } from './services/api.js';
import { GisMap } from './components/GisMap.js';
import { LayerControl } from './components/LayerControl.js';
import { FilterBar } from './components/FilterBar.js';
import { PatrolReplayBar } from './components/PatrolReplayBar.js';
import { AssetDetailModal } from './components/AssetDetailModal.js';
import { VideoPlayerModal } from './components/VideoPlayerModal.js';
import { DashboardStats } from './components/DashboardStats.js';
import { ExportModal } from './components/ExportModal.js';
import {
  Compass,
  Layers,
  BarChart3,
  Download,
  Car,
  ShieldCheck,
  RefreshCw,
  Video
} from 'lucide-react';

export const App: React.FC = () => {
  // 核心业务数据状态
  const [roads, setRoads] = useState<Road[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [sessions, setSessions] = useState<PatrolSession[]>([]);
  const [activeSession, setActiveSession] = useState<PatrolSession | null>(null);
  const [trackPoints, setTrackPoints] = useState<GPSTrackPoint[]>([]);
  const [replayIndex, setReplayIndex] = useState(0);

  // 交互控制状态
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({
    ROAD: true,
    TRACK: true,
    TRAFFIC_SIGN: true,
    MILEPOST: true,
    HUNDRED_METER_POST: true,
    GUARDRAIL: true,
    TREE: true,
    DISEASE: true,
  });

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [showExport, setShowExport] = useState(false);

  // 视频联动弹窗状态
  const [videoModal, setVideoModal] = useState<{
    isOpen: boolean;
    slice: VideoSlice | null;
    offsetSeconds: number;
    assetTitle: string;
    milepost: string;
  }>({
    isOpen: false,
    slice: null,
    offsetSeconds: 0,
    assetTitle: '',
    milepost: '',
  });

  // 初始加载数据
  const loadInitialData = async () => {
    try {
      const [roadsData, typesData, assetsData, sessionsData, statsData] = await Promise.all([
        api.getRoads(),
        api.getAssetTypes(),
        api.getAssets(),
        api.getPatrolSessions(),
        api.getDashboardStats(),
      ]);

      const parsedRoads: Road[] = roadsData.features.map((f: any) => ({
        id: f.id,
        code: f.properties.code,
        name: f.properties.name,
        level: f.properties.level,
        start_milepost: f.properties.startMilepost,
        end_milepost: f.properties.endMilepost,
        total_length_km: f.properties.totalLengthKm,
        centerline_geom: f.geometry,
        created_at: new Date().toISOString(),
      }));

      setRoads(parsedRoads);
      setAssetTypes(typesData);
      setAssets(assetsData);
      setSessions(sessionsData);
      setDashboardStats(statsData);

      // 默认选中第一条巡查会话
      if (sessionsData.length > 0) {
        handleSelectSession(sessionsData[0].id);
      }
    } catch (err) {
      console.error('Failed to load initial data', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // 切换巡查会话并加载对应轨迹点
  const handleSelectSession = async (sessionId: string) => {
    const s = sessions.find((item) => item.id === sessionId) || null;
    setActiveSession(s);
    try {
      const points = await api.getTrackPoints(sessionId);
      setTrackPoints(points);
      setReplayIndex(0);
    } catch (err) {
      console.error('Failed to load track points', err);
    }
  };

  // 图层开关控制
  const handleToggleLayer = (layerId: string) => {
    setActiveLayers((prev) => ({
      ...prev,
      [layerId]: prev[layerId] === false ? true : false,
    }));
  };

  const handleToggleAllLayers = (enable: boolean) => {
    const next: Record<string, boolean> = { ROAD: enable, TRACK: enable };
    assetTypes.forEach((t) => {
      next[t.id] = enable;
    });
    setActiveLayers(next);
  };

  // 条件筛选检索
  const handleFilterChange = async (filters: any) => {
    try {
      const res = await api.getAssets(filters);
      setAssets(res);
    } catch (err) {
      console.error('Filter failed', err);
    }
  };

  // 核心能力：点击路产跳转对应视频切片
  const handlePlayVideoForAsset = async (asset: Asset) => {
    try {
      // 优先根据路产已绑定的切片及偏移秒数定位
      if (asset.video_slice_id) {
        const slices = await api.getVideoSlices();
        const slice = slices.find((v) => v.id === asset.video_slice_id);
        if (slice) {
          setVideoModal({
            isOpen: true,
            slice,
            offsetSeconds: asset.video_offset_seconds || 0,
            assetTitle: asset.type_name || '路产详情',
            milepost: asset.milepost,
          });
          return;
        }
      }

      // 若未直接绑定，使用发现时间戳在服务端逆向匹配
      const located = await api.locateVideo(asset.discovery_time);
      setVideoModal({
        isOpen: true,
        slice: located.videoSlice,
        offsetSeconds: located.offsetSeconds,
        assetTitle: asset.type_name || '路产详情',
        milepost: asset.milepost,
      });
    } catch (err) {
      alert('未检索到该路产发现时刻对应的录像切片数据');
    }
  };

  // 轨迹点跳转录像
  const handleJumpToTrackVideo = async () => {
    const pt = trackPoints[replayIndex];
    if (!pt) return;
    try {
      const located = await api.locateVideo(pt.point_time);
      setVideoModal({
        isOpen: true,
        slice: located.videoSlice,
        offsetSeconds: located.offsetSeconds,
        assetTitle: `巡查轨迹瞬时位置 (${pt.speed_kmh} km/h)`,
        milepost: `瞬时点: ${pt.longitude.toFixed(4)}, ${pt.latitude.toFixed(4)}`,
      });
    } catch (err) {
      alert('该轨迹采样点暂无关联的录像切片');
    }
  };

  // 更新路产状态
  const handleUpdateAssetStatus = async (assetId: string, newStatus: any) => {
    try {
      const updated = await api.updateAsset(assetId, { status: newStatus });
      setAssets((prev) => prev.map((a) => (a.id === assetId ? updated : a)));
      if (selectedAsset?.id === assetId) {
        setSelectedAsset(updated);
      }
    } catch (err) {
      alert('状态更新失败');
    }
  };

  // 统计各类路产数量
  const assetCounts: Record<string, number> = {};
  for (const a of assets) {
    assetCounts[a.type_id] = (assetCounts[a.type_id] || 0) + 1;
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-950 overflow-hidden font-sans text-slate-100">
      {/* 1. 顶部全局导航栏 */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-5 flex items-center justify-between z-30 shadow-md flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-cyan-900/50 shadow-md">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-100 tracking-wide">
              道路路产智能巡查与 GIS 管理系统
            </h1>
            <div className="text-[10px] text-cyan-400 font-mono flex items-center gap-2">
              <span>Road Asset Intelligent Patrol & GIS Management Platform</span>
              <span className="text-slate-600">|</span>
              <span className="text-emerald-400 font-sans font-medium">PostGIS 空间引擎就绪</span>
            </div>
          </div>
        </div>

        {/* 顶部右侧功能操作区 */}
        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={() => setShowStats(!showStats)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition ${
              showStats
                ? 'bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-900/40'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>综合看板</span>
          </button>

          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 hover:bg-slate-800 text-slate-300 font-medium transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>档案导出</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* 用户身份信息 */}
          <div className="flex items-center gap-2 pl-1">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-cyan-400 text-xs">
              张
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-medium text-slate-200">张三 (巡查主管)</div>
              <div className="text-[10px] text-slate-400">养护工程第一管理处</div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. GIS 主视图容器 */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* 核心地图 */}
        <GisMap
          roads={roads}
          assets={assets}
          activeLayers={activeLayers}
          selectedAsset={selectedAsset}
          onSelectAsset={setSelectedAsset}
          replayTrackPoints={trackPoints}
          replayCurrentIndex={replayIndex}
        />

        {/* 左上角浮动：图层管理器 */}
        <div className="absolute top-4 left-4 z-20">
          <LayerControl
            assetTypes={assetTypes}
            activeLayers={activeLayers}
            onToggleLayer={handleToggleLayer}
            onToggleAll={handleToggleAllLayers}
            assetCounts={assetCounts}
          />
        </div>

        {/* 顶部居中浮动：路产过滤与桩号检索栏 */}
        <div className="absolute top-4 left-80 right-4 flex justify-center z-20 pointer-events-none">
          <div className="pointer-events-auto">
            <FilterBar
              roads={roads}
              assetTypes={assetTypes}
              onFilterChange={handleFilterChange}
            />
          </div>
        </div>

        {/* 顶部下拉综合统计大屏面板 */}
        {showStats && (
          <div className="absolute top-16 left-80 right-20 z-30 animate-in slide-in-from-top-4 duration-200">
            <DashboardStats
              stats={dashboardStats}
              onClose={() => setShowStats(false)}
            />
          </div>
        )}

        {/* 底部浮动：巡查轨迹动态回放控制器 */}
        <div className="absolute bottom-12 left-80 right-24 flex justify-center z-20 pointer-events-none">
          <div className="w-full max-w-2xl pointer-events-auto">
            <PatrolReplayBar
              sessions={sessions}
              activeSession={activeSession}
              onSelectSession={handleSelectSession}
              trackPoints={trackPoints}
              currentIndex={replayIndex}
              onIndexChange={setReplayIndex}
              onJumpToVideo={handleJumpToTrackVideo}
            />
          </div>
        </div>

        {/* 右侧抽屉：路产详情卡片 */}
        <AssetDetailModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onPlayVideo={handlePlayVideoForAsset}
          onUpdateStatus={handleUpdateAssetStatus}
          onCreateMaintenance={(a) => alert(`已为路产 ${a.asset_code} 派发快速维修工单`)}
        />
      </div>

      {/* 3. 视频秒级定位播放弹窗 */}
      {videoModal.isOpen && (
        <VideoPlayerModal
          videoSlice={videoModal.slice}
          offsetSeconds={videoModal.offsetSeconds}
          assetTitle={videoModal.assetTitle}
          milepost={videoModal.milepost}
          onClose={() => setVideoModal((prev) => ({ ...prev, isOpen: false }))}
        />
      )}

      {/* 4. 数据多格式导出弹窗 */}
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </div>
  );
};
