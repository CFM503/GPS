import React, { useState, useRef } from 'react';
import {
  Signpost,
  Flag,
  Shield,
  Trees,
  Lamp,
  CarFront,
  AlertOctagon,
  Layers,
  Gauge,
  Navigation,
  Radio,
  Video,
  CheckCircle,
  Wifi,
  WifiOff,
  CloudUpload,
  Pause,
  Play,
  Signal,
  CheckCircle2,
  Camera,
  MapPin,
  Sparkles
} from 'lucide-react';
import { GPSTrackPoint, PatrolStatus } from '@road-gis/shared';
import { CURRENT_APP_VERSION } from '../services/updater.js';

interface PatrolDashboardProps {
  patrolStatus: PatrolStatus;
  onStartPatrol: () => void;
  onPausePatrol: () => void;
  onResumePatrol: () => void;
  onStopPatrol: () => void;
  onQuickCollect: (typeId: string, typeName: string, isAnomaly?: boolean) => void;
  onCapturePhoto?: (photoDataUrl: string) => void;
  gpsPoint: GPSTrackPoint | null;
  gpsSignal: 'EXCELLENT' | 'GOOD' | 'POOR' | 'LOST';
  gpsMessage?: string;
  trackCount: number;
  assetCount: number;
  videoDurationSecs: number;
  sliceFileName: string;
  isOnline: boolean;
  syncState: { isSyncing: boolean; syncedCount: number; totalCount: number; message: string };
  pendingCount: number;
  onOpenSync: () => void;
  onOpenPending: () => void;
  onCheckUpdate?: () => void;
  hasNewVersion?: boolean;
}

export const PatrolDashboard: React.FC<PatrolDashboardProps> = ({
  patrolStatus,
  onStartPatrol,
  onPausePatrol,
  onResumePatrol,
  onStopPatrol,
  onQuickCollect,
  onCapturePhoto,
  gpsPoint,
  gpsSignal,
  gpsMessage,
  trackCount,
  assetCount,
  videoDurationSecs,
  sliceFileName,
  isOnline,
  syncState,
  pendingCount,
  onOpenSync,
  onOpenPending,
  onCheckUpdate,
  hasNewVersion,
}) => {
  const [activeFeedback, setActiveFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPatrolling = patrolStatus === 'RUNNING' || patrolStatus === 'IN_PROGRESS';
  const isPaused = patrolStatus === 'PAUSED';

  const handleTap = (typeId: string, typeName: string, isAnomaly: boolean = false) => {
    if (!isPatrolling) {
      alert('巡查未在运行中，请先点击【开启巡查】');
      return;
    }
    // 触发设备触觉震动反馈 (Android 真实震动)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(isAnomaly ? [80, 60, 140] : 50);
    }
    setActiveFeedback(typeName);
    setTimeout(() => setActiveFeedback(null), 1000);
    onQuickCollect(typeId, typeName, isAnomaly);
  };

  const handlePhotoInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onCapturePhoto) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          onCapturePhoto(reader.result as string);
          setActiveFeedback('照片已保存');
          setTimeout(() => setActiveFeedback(null), 1000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const formatSecs = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 8 大生产级一键大触控按键 (高对比度防误触，触控高度 >= 72px)
  const buttons = [
    { id: 'TRAFFIC_SIGN', name: '标识牌', icon: Signpost, bg: 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700', text: 'text-white' },
    { id: 'HUNDRED_METER_POST', name: '百米桩', icon: Flag, bg: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700', text: 'text-white' },
    { id: 'GUARDRAIL', name: '护栏', icon: Shield, bg: 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700', text: 'text-white' },
    { id: 'TREE', name: '林木', icon: Trees, bg: 'bg-teal-600 hover:bg-teal-500 active:bg-teal-700', text: 'text-white' },
    { id: 'STREET_LIGHT', name: '路灯', icon: Lamp, bg: 'bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-700', text: 'text-white' },
    { id: 'TRAFFIC_FACILITY', name: '交通设施', icon: CarFront, bg: 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700', text: 'text-white' },
    { id: 'DISEASE', name: '异常/病害', icon: AlertOctagon, bg: 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700', text: 'text-white', isAnomaly: true },
    { id: 'OTHER', name: '其他设施', icon: Layers, bg: 'bg-slate-700 hover:bg-slate-600 active:bg-slate-800', text: 'text-white' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#030712] text-slate-100 p-2.5 sm:p-3 select-none overflow-hidden">
      {/* 隐藏式原生相机文件选择器 */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handlePhotoInput}
        className="hidden"
      />

      {/* 1. 核心状态信息看条 (严格满足规范要求的各项实时状态显示) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 shadow-xl mb-2 flex flex-col gap-2">
        {/* 上行：巡查状态 / GPS状态 / 网络状态 / 录像状态 */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          {/* 巡查状态 */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 font-bold">
            <span className={`w-2 h-2 rounded-full ${isPatrolling ? 'bg-emerald-400 animate-ping' : isPaused ? 'bg-amber-400' : 'bg-slate-500'}`} />
            <span className={isPatrolling ? 'text-emerald-400' : isPaused ? 'text-amber-400' : 'text-slate-400'}>
              {isPatrolling ? '巡查中' : isPaused ? '已暂停' : '未开始'}
            </span>
          </div>

          {/* GPS 硬件状态与精度 */}
          <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 font-mono">
            <Signal className={`w-3.5 h-3.5 ${
              gpsSignal === 'EXCELLENT' ? 'text-emerald-400' : gpsSignal === 'GOOD' ? 'text-cyan-400' : 'text-rose-400'
            }`} />
            <span className="text-slate-200">
              {gpsSignal === 'EXCELLENT' ? 'GPS 正常' : gpsSignal === 'GOOD' ? 'GPS 良好' : 'GPS 弱/搜星'}
            </span>
            {gpsPoint?.accuracy !== undefined && (
              <span className="text-slate-400 text-[10px]">±{gpsPoint.accuracy}m</span>
            )}
          </div>

          {/* 网络状态 (ONLINE / OFFLINE / SYNCING) */}
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border font-bold ${
            syncState.isSyncing
              ? 'bg-blue-950/40 border-blue-600 text-blue-400 animate-pulse'
              : isOnline
              ? 'bg-emerald-950/40 border-emerald-700 text-emerald-400'
              : 'bg-rose-950/40 border-rose-700 text-rose-400'
          }`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{syncState.isSyncing ? 'SYNCING' : isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>

          {/* 录像状态 */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 font-mono">
            <Video className={`w-3.5 h-3.5 ${isPatrolling ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
            <span className={isPatrolling ? 'text-rose-300 font-bold' : 'text-slate-400'}>
              {isPatrolling ? `REC ${formatSecs(videoDurationSecs)}` : '录像就绪'}
            </span>
          </div>

          {/* 版本号与在线更新检测按钮 */}
          <button
            onClick={onCheckUpdate}
            title="点击检查最新系统版本"
            className="flex items-center gap-1 bg-slate-950 hover:bg-slate-800 active:bg-slate-700 px-2 py-1 rounded-xl border border-slate-800 text-slate-400 hover:text-blue-300 transition cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span className="font-mono text-[11px]">v{CURRENT_APP_VERSION}</span>
            {hasNewVersion && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>
        </div>

        {/* 下行：遥测指标 (坐标、车速、轨迹点数量、路产数量、待同步数量) */}
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 text-center text-[11px] font-mono">
          <div className="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800/80">
            <div className="text-slate-400 text-[10px]">车速</div>
            <div className="text-emerald-400 font-bold text-sm">
              {gpsPoint ? gpsPoint.speed_kmh.toFixed(0) : '0'}<span className="text-[9px] text-slate-500">km/h</span>
            </div>
          </div>

          <div className="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800/80">
            <div className="text-slate-400 text-[10px]">轨迹点</div>
            <div className="text-cyan-400 font-bold text-sm">{trackCount}</div>
          </div>

          <div className="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800/80">
            <div className="text-slate-400 text-[10px]">路产</div>
            <div className="text-amber-400 font-bold text-sm">{assetCount}</div>
          </div>

          <div
            onClick={onOpenSync}
            className="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800/80 cursor-pointer hover:border-blue-500 transition"
          >
            <div className="text-slate-400 text-[10px]">待同步</div>
            <div className="text-purple-400 font-bold text-sm">{pendingCount}</div>
          </div>

          <div className="hidden sm:block bg-slate-950/80 p-1.5 rounded-xl border border-slate-800/80 truncate">
            <div className="text-slate-400 text-[10px]">当前经纬度</div>
            <div className="text-slate-200 text-[10px] truncate">
              {gpsPoint ? `${gpsPoint.longitude.toFixed(4)}, ${gpsPoint.latitude.toFixed(4)}` : '搜星定位中...'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 巡查主流程控制按钮 & 拍照/补录入口 */}
      <div className="flex items-center gap-2 mb-2">
        {patrolStatus === 'CREATED' || (!isPatrolling && !isPaused) ? (
          <button
            onClick={onStartPatrol}
            className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm sm:text-base rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-98 transition"
          >
            <Radio className="w-5 h-5 animate-pulse" />
            <span>开启巡查 (GPS高精采集 + 录像切片)</span>
          </button>
        ) : (
          <>
            {isPatrolling ? (
              <button
                onClick={onPausePatrol}
                className="px-3 sm:px-4 py-3 bg-amber-600/30 border border-amber-500/40 text-amber-300 hover:bg-amber-600/40 font-bold text-xs sm:text-sm rounded-2xl flex items-center gap-1.5 transition"
              >
                <Pause className="w-4 h-4" />
                <span>暂停</span>
              </button>
            ) : (
              <button
                onClick={onResumePatrol}
                className="px-3 sm:px-4 py-3 bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/40 font-bold text-xs sm:text-sm rounded-2xl flex items-center gap-1.5 transition"
              >
                <Play className="w-4 h-4" />
                <span>继续</span>
              </button>
            )}

            <button
              onClick={onStopPatrol}
              className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-98 transition"
            >
              <CheckCircle className="w-4 h-4" />
              <span>结束巡查</span>
            </button>
          </>
        )}

        {/* 快速拍照按钮 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 sm:px-4 py-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-2xl flex items-center gap-1.5 shadow active:scale-95 transition"
        >
          <Camera className="w-4 h-4 text-cyan-400" />
          <span>拍照</span>
        </button>

        {/* 停车安全补录按钮 */}
        <button
          onClick={onOpenPending}
          className="px-3 sm:px-4 py-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-2xl flex items-center gap-1.5 whitespace-nowrap shadow"
        >
          <span>停车补录</span>
        </button>
      </div>

      {/* 3. 驾驶安全超大触控色块 (8 大核心按键，高对比度防误触，触控高度 >= 72px) */}
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 min-h-0">
        {buttons.map((btn) => {
          const Icon = btn.icon;
          return (
            <button
              key={btn.id}
              onClick={() => handleTap(btn.id, btn.name, btn.isAnomaly)}
              disabled={!isPatrolling}
              className={`${btn.bg} ${btn.text} disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl p-2.5 sm:p-3.5 shadow-xl flex flex-col items-center justify-center gap-1 sm:gap-1.5 transition duration-75 active:scale-95 active:brightness-125 border border-white/10`}
            >
              <Icon className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.2]" />
              <span className="text-base sm:text-lg font-bold tracking-wider">{btn.name}</span>
              <span className="text-[10px] opacity-75 font-medium">1-TAP 秒级打点</span>
            </button>
          );
        })}
      </div>

      {/* 4. 一键秒级采集瞬时反馈弹幕 */}
      {activeFeedback && (
        <div className="fixed inset-x-0 bottom-16 flex justify-center pointer-events-none z-50 animate-in zoom-in-90 duration-150">
          <div className="bg-emerald-400 text-slate-950 font-black text-sm sm:text-base px-5 py-2 rounded-full shadow-2xl flex items-center gap-2 border-2 border-white">
            <CheckCircle2 className="w-5 h-5 text-slate-950" />
            <span>{activeFeedback}！已自动锁定当前坐标与切片帧</span>
          </div>
        </div>
      )}
    </div>
  );
};
