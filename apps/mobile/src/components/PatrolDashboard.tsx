import React, { useState } from 'react';
import {
  Signpost,
  Flag,
  Shield,
  Trees,
  AlertOctagon,
  Layers,
  Gauge,
  Navigation,
  Radio,
  Video,
  CheckCircle,
  Wifi,
  WifiOff,
  CloudUpload
} from 'lucide-react';
import { GPSTrackPoint } from '@road-gis/shared';

interface PatrolDashboardProps {
  isPatrolling: boolean;
  onStartPatrol: () => void;
  onStopPatrol: () => void;
  onQuickCollect: (typeId: string, typeName: string, isAnomaly?: boolean) => void;
  gpsPoint: GPSTrackPoint | null;
  videoDurationSecs: number;
  sliceFileName: string;
  isOnline: boolean;
  pendingCount: number;
  onOpenSync: () => void;
  onOpenPending: () => void;
}

export const PatrolDashboard: React.FC<PatrolDashboardProps> = ({
  isPatrolling,
  onStartPatrol,
  onStopPatrol,
  onQuickCollect,
  gpsPoint,
  videoDurationSecs,
  sliceFileName,
  isOnline,
  pendingCount,
  onOpenSync,
  onOpenPending,
}) => {
  const [activeFeedback, setActiveFeedback] = useState<string | null>(null);

  const handleTap = (typeId: string, typeName: string, isAnomaly: boolean = false) => {
    if (!isPatrolling) {
      alert('请先点击上方“开始巡查”按钮启动巡查会话');
      return;
    }
    // 触发震动反馈
    if (navigator.vibrate) {
      navigator.vibrate(isAnomaly ? [50, 50, 100] : 40);
    }
    setActiveFeedback(typeName);
    setTimeout(() => setActiveFeedback(null), 800);
    onQuickCollect(typeId, typeName, isAnomaly);
  };

  const formatSecs = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const buttons = [
    { id: 'TRAFFIC_SIGN', name: '标识牌', icon: Signpost, bg: 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700', text: 'text-white' },
    { id: 'HUNDRED_METER_POST', name: '百米桩', icon: Flag, bg: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700', text: 'text-white' },
    { id: 'GUARDRAIL', name: '护栏', icon: Shield, bg: 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700', text: 'text-white' },
    { id: 'TREE', name: '绿化林木', icon: Trees, bg: 'bg-teal-600 hover:bg-teal-500 active:bg-teal-700', text: 'text-white' },
    { id: 'DISEASE', name: '道路病害/异常', icon: AlertOctagon, bg: 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700', text: 'text-white', isAnomaly: true },
    { id: 'OTHER', name: '其他附属设施', icon: Layers, bg: 'bg-slate-700 hover:bg-slate-600 active:bg-slate-800', text: 'text-white' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#030712] text-slate-100 p-3 select-none">
      {/* 1. 车载顶部运行状态看板 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-lg flex items-center justify-between gap-2 mb-3">
        {/* 左侧：车速与航向 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <Gauge className="w-5 h-5 text-emerald-400" />
            <span className="font-mono text-xl font-black text-slate-100">
              {gpsPoint ? gpsPoint.speed_kmh.toFixed(0) : '0'}
            </span>
            <span className="text-[10px] text-slate-400 font-sans">km/h</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
            <Navigation
              className="w-4 h-4 text-cyan-400"
              style={{ transform: `rotate(${gpsPoint?.heading || 0}deg)` }}
            />
            <span className="text-slate-300">{Math.round(gpsPoint?.heading || 0)}°</span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400">精度 {gpsPoint?.accuracy || 3.5}m</span>
          </div>
        </div>

        {/* 中间：录像切片状态 */}
        {isPatrolling && (
          <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/50 px-3 py-1.5 rounded-xl text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <Video className="w-4 h-4 text-red-400" />
            <span className="font-mono font-bold text-red-300">{formatSecs(videoDurationSecs)}</span>
            <span className="text-[10px] text-red-400/80 font-mono">({sliceFileName})</span>
          </div>
        )}

        {/* 右侧：网络与同步队列按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSync}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
              pendingCount > 0
                ? 'bg-amber-950/40 border-amber-600/50 text-amber-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-300'
            }`}
          >
            <CloudUpload className="w-4 h-4" />
            <span>待传: {pendingCount}</span>
          </button>

          <div className={`p-1.5 rounded-xl border ${
            isOnline ? 'bg-emerald-950/40 border-emerald-700 text-emerald-400' : 'bg-rose-950/40 border-rose-700 text-rose-400'
          }`}>
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* 2. 巡查主启停条 */}
      <div className="flex items-center gap-3 mb-3">
        {!isPatrolling ? (
          <button
            onClick={onStartPatrol}
            className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-base rounded-2xl shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2 active:scale-98 transition"
          >
            <Radio className="w-5 h-5 animate-pulse" />
            <span>开始道路巡查 (启动 GPS 与自动录像)</span>
          </button>
        ) : (
          <button
            onClick={onStopPatrol}
            className="flex-1 py-3.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-base rounded-2xl shadow-xl shadow-rose-950/60 flex items-center justify-center gap-2 active:scale-98 transition"
          >
            <CheckCircle className="w-5 h-5" />
            <span>完成巡查并结算 (生成轨迹档案)</span>
          </button>
        )}

        <button
          onClick={onOpenPending}
          className="px-4 py-3.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-2xl flex items-center gap-1.5 whitespace-nowrap"
        >
          <span>停车补录</span>
        </button>
      </div>

      {/* 3. 驾驶安全超大触控色块 (核心 6 按键) */}
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3 min-h-0">
        {buttons.map((btn) => {
          const Icon = btn.icon;
          return (
            <button
              key={btn.id}
              onClick={() => handleTap(btn.id, btn.name, btn.isAnomaly)}
              className={`${btn.bg} ${btn.text} rounded-2xl p-4 shadow-xl flex flex-col items-center justify-center gap-2 transition duration-75 active:scale-95 active:brightness-125 border border-white/10`}
            >
              <Icon className="w-10 h-10 stroke-[2.2]" />
              <span className="text-xl font-bold tracking-wider">{btn.name}</span>
              <span className="text-[11px] opacity-80 font-medium">1-TAP 秒级建档</span>
            </button>
          );
        })}
      </div>

      {/* 4. 一键秒级采集瞬时反馈弹幕 */}
      {activeFeedback && (
        <div className="fixed inset-x-0 bottom-24 flex justify-center pointer-events-none z-50">
          <div className="bg-emerald-500 text-slate-950 font-black text-lg px-6 py-2 rounded-full shadow-2xl animate-bounce flex items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            <span>已成功采集: {activeFeedback}！已自动绑定GPS与录像帧</span>
          </div>
        </div>
      )}
    </div>
  );
};
