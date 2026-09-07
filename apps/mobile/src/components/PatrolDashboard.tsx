import React, { useState } from 'react';
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
  RotateCcw,
  Signal,
  CheckCircle2
} from 'lucide-react';
import { GPSTrackPoint, PatrolStatus } from '@road-gis/shared';

interface PatrolDashboardProps {
  patrolStatus: PatrolStatus;
  onStartPatrol: () => void;
  onPausePatrol: () => void;
  onResumePatrol: () => void;
  onStopPatrol: () => void;
  onQuickCollect: (typeId: string, typeName: string, isAnomaly?: boolean) => void;
  gpsPoint: GPSTrackPoint | null;
  gpsSignal: 'EXCELLENT' | 'GOOD' | 'POOR' | 'LOST';
  videoDurationSecs: number;
  sliceFileName: string;
  isOnline: boolean;
  syncState: { isSyncing: boolean; syncedCount: number; totalCount: number; message: string };
  pendingCount: number;
  onOpenSync: () => void;
  onOpenPending: () => void;
}

export const PatrolDashboard: React.FC<PatrolDashboardProps> = ({
  patrolStatus,
  onStartPatrol,
  onPausePatrol,
  onResumePatrol,
  onStopPatrol,
  onQuickCollect,
  gpsPoint,
  gpsSignal,
  videoDurationSecs,
  sliceFileName,
  isOnline,
  syncState,
  pendingCount,
  onOpenSync,
  onOpenPending,
}) => {
  const [activeFeedback, setActiveFeedback] = useState<string | null>(null);

  const isPatrolling = patrolStatus === 'RUNNING' || patrolStatus === 'IN_PROGRESS';
  const isPaused = patrolStatus === 'PAUSED';

  const handleTap = (typeId: string, typeName: string, isAnomaly: boolean = false) => {
    if (!isPatrolling) {
      alert('巡查未在运行中，请先开启或恢复巡查');
      return;
    }
    // 触发设备触觉震动反馈
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(isAnomaly ? [60, 60, 120] : 45);
    }
    setActiveFeedback(typeName);
    setTimeout(() => setActiveFeedback(null), 900);
    onQuickCollect(typeId, typeName, isAnomaly);
  };

  const formatSecs = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 8 大生产级一键大触控按键
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
    <div className="flex flex-col h-full bg-[#030712] text-slate-100 p-2.5 sm:p-3.5 select-none">
      {/* 1. 车载顶部运行状态看条 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-xl flex items-center justify-between gap-2 mb-2.5">
        {/* 左侧：车速与航向 */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
            <Gauge className="w-5 h-5 text-emerald-400" />
            <span className="font-mono text-xl font-black text-slate-100">
              {gpsPoint ? gpsPoint.speed_kmh.toFixed(0) : '0'}
            </span>
            <span className="text-[10px] text-slate-400 font-sans">km/h</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-xs font-mono">
            <Navigation
              className="w-4 h-4 text-cyan-400"
              style={{ transform: `rotate(${gpsPoint?.heading || 0}deg)` }}
            />
            <span className="text-slate-300">{Math.round(gpsPoint?.heading || 0)}°</span>
          </div>

          {/* GPS 信号质量 */}
          <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-[11px] font-mono">
            <Signal className={`w-3.5 h-3.5 ${
              gpsSignal === 'EXCELLENT' ? 'text-emerald-400' : gpsSignal === 'GOOD' ? 'text-cyan-400' : 'text-rose-400'
            }`} />
            <span className="text-slate-300">
              {gpsSignal === 'EXCELLENT' ? 'GPS 正常' : gpsSignal === 'GOOD' ? 'GPS 良好' : '信号微弱'}
            </span>
            <span className="text-slate-500">±{gpsPoint?.accuracy || 3.2}m</span>
          </div>
        </div>

        {/* 中间：视频切片录像状态 */}
        {isPatrolling && (
          <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/50 px-2.5 py-1 rounded-xl text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <Video className="w-4 h-4 text-red-400" />
            <span className="font-mono font-bold text-red-300">{formatSecs(videoDurationSecs)}</span>
            <span className="hidden md:inline text-[10px] text-red-400/80 font-mono">({sliceFileName})</span>
          </div>
        )}

        {/* 右侧：网络状态与同步队列徽章 */}
        <div className="flex items-center gap-2">
          {/* 同步状态 */}
          <button
            onClick={onOpenSync}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-medium transition ${
              syncState.isSyncing
                ? 'bg-blue-950/50 border-blue-600 text-blue-300 animate-pulse'
                : pendingCount > 0
                ? 'bg-amber-950/40 border-amber-600/50 text-amber-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-300'
            }`}
          >
            <CloudUpload className="w-4 h-4" />
            {syncState.isSyncing ? (
              <span>同步中: {syncState.syncedCount}/{syncState.totalCount}</span>
            ) : (
              <span>待同步: {pendingCount}</span>
            )}
          </button>

          {/* 网络通断状态徽标 */}
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-semibold ${
            isOnline ? 'bg-emerald-950/40 border-emerald-700 text-emerald-400' : 'bg-rose-950/40 border-rose-700 text-rose-400'
          }`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isOnline ? '在线' : '离线模式'}</span>
          </div>
        </div>
      </div>

      {/* 2. 巡查主状态与启停控制条 */}
      <div className="flex items-center gap-2 sm:gap-3 mb-2.5">
        {patrolStatus === 'CREATED' || !isPatrolling && !isPaused ? (
          <button
            onClick={onStartPatrol}
            className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm sm:text-base rounded-2xl shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2 active:scale-98 transition"
          >
            <Radio className="w-5 h-5 animate-pulse" />
            <span>开启巡查 (GPS持续记录 + 5分钟自动切片)</span>
          </button>
        ) : (
          <>
            {isPatrolling ? (
              <button
                onClick={onPausePatrol}
                className="px-4 py-3 bg-amber-600/30 border border-amber-500/40 text-amber-300 hover:bg-amber-600/40 font-bold text-xs sm:text-sm rounded-2xl flex items-center gap-1.5 transition"
              >
                <Pause className="w-4 h-4" />
                <span>暂停</span>
              </button>
            ) : (
              <button
                onClick={onResumePatrol}
                className="px-4 py-3 bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/40 font-bold text-xs sm:text-sm rounded-2xl flex items-center gap-1.5 transition"
              >
                <Play className="w-4 h-4" />
                <span>继续</span>
              </button>
            )}

            <button
              onClick={onStopPatrol}
              className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl shadow-rose-950/60 flex items-center justify-center gap-2 active:scale-98 transition"
            >
              <CheckCircle className="w-4 h-4" />
              <span>结束巡查并归档 (LineString 拟合)</span>
            </button>
          </>
        )}

        <button
          onClick={onOpenPending}
          className="px-3 sm:px-4 py-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-2xl flex items-center gap-1.5 whitespace-nowrap shadow"
        >
          <span>停车补录</span>
        </button>
      </div>

      {/* 3. 驾驶安全超大触控色块 (8 大核心按键，高对比度防误触) */}
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 min-h-0">
        {buttons.map((btn) => {
          const Icon = btn.icon;
          return (
            <button
              key={btn.id}
              onClick={() => handleTap(btn.id, btn.name, btn.isAnomaly)}
              disabled={!isPatrolling}
              className={`${btn.bg} ${btn.text} disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition duration-75 active:scale-95 active:brightness-125 border border-white/10`}
            >
              <Icon className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.2]" />
              <span className="text-base sm:text-lg font-bold tracking-wider">{btn.name}</span>
              <span className="text-[10px] opacity-75 font-medium">1-TAP 秒级建档</span>
            </button>
          );
        })}
      </div>

      {/* 4. 一键秒级采集瞬时反馈弹幕 */}
      {activeFeedback && (
        <div className="fixed inset-x-0 bottom-20 flex justify-center pointer-events-none z-50 animate-in zoom-in-90 duration-150">
          <div className="bg-emerald-400 text-slate-950 font-black text-base sm:text-lg px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border-2 border-white">
            <CheckCircle2 className="w-6 h-6 text-slate-950" />
            <span>已成功采集: {activeFeedback}！已自动锁定 GPS 与录像帧</span>
          </div>
        </div>
      )}
    </div>
  );
};
