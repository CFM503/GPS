import React, { useState, useEffect } from 'react';
import { PatrolSession, GPSTrackPoint } from '@road-gis/shared';
import { Play, Pause, RotateCcw, FastForward, Navigation, Gauge, Video, CheckCircle } from 'lucide-react';

interface PatrolReplayBarProps {
  sessions: PatrolSession[];
  activeSession: PatrolSession | null;
  onSelectSession: (sessionId: string) => void;
  trackPoints: GPSTrackPoint[];
  currentIndex: number;
  onIndexChange: (idx: number | ((prev: number) => number)) => void;
  onJumpToVideo: () => void;
}

export const PatrolReplayBar: React.FC<PatrolReplayBarProps> = ({
  sessions,
  activeSession,
  onSelectSession,
  trackPoints,
  currentIndex,
  onIndexChange,
  onJumpToVideo,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const totalPoints = trackPoints.length;
  const currentPoint = trackPoints[currentIndex];

  useEffect(() => {
    let timer: any;
    if (isPlaying && totalPoints > 0) {
      timer = setInterval(() => {
        onIndexChange((prev: number) => {
          if (prev >= totalPoints - 1) {
            setIsPlaying(false);
            return totalPoints - 1;
          }
          return prev + 1;
        });
      }, 1000 / speed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, speed, totalPoints, onIndexChange]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-xl backdrop-blur-md flex flex-col gap-2.5">
      {/* 顶部会话选择与基础状态 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">巡查回放:</span>
          <select
            value={activeSession?.id || ''}
            onChange={(e) => onSelectSession(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500 font-mono"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} ({s.road_code} · {s.vehicle_plate} · {s.user_name})
              </option>
            ))}
          </select>
        </div>

        {/* 车辆瞬时车速与航向角 */}
        {currentPoint && (
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1 text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
              <Gauge className="w-3.5 h-3.5" />
              <span>{currentPoint.speed_kmh.toFixed(1)} km/h</span>
            </div>
            <div className="flex items-center gap-1 text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
              <Navigation
                className="w-3.5 h-3.5"
                style={{ transform: `rotate(${currentPoint.heading || 0}deg)` }}
              />
              <span>{Math.round(currentPoint.heading || 0)}°</span>
            </div>
          </div>
        )}
      </div>

      {/* 进度条与控制器 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow"
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <button
          onClick={() => {
            setIsPlaying(false);
            onIndexChange(0);
          }}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          title="重新回放"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* 时间/打点进度条 */}
        <div className="flex-1 flex items-center gap-2">
          <input
            type="range"
            min="0"
            max={Math.max(0, totalPoints - 1)}
            value={currentIndex}
            onChange={(e) => {
              setIsPlaying(false);
              onIndexChange(parseInt(e.target.value, 10));
            }}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap w-14 text-right">
            {currentIndex + 1} / {totalPoints}
          </span>
        </div>

        {/* 倍速 */}
        <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded border border-slate-700 text-xs">
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-1.5 py-0.5 rounded font-mono text-[11px] ${
                speed === s ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* 跳转当前轨迹点视频 */}
        <button
          onClick={onJumpToVideo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/30 text-xs font-semibold whitespace-nowrap transition"
        >
          <Video className="w-3.5 h-3.5" />
          <span>查看该点录像</span>
        </button>
      </div>
    </div>
  );
};
