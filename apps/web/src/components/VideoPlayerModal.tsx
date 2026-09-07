import React, { useState, useEffect } from 'react';
import { VideoSlice } from '@road-gis/shared';
import { X, Play, Pause, RotateCcw, Volume2, FastForward, Clock, Video } from 'lucide-react';

interface VideoPlayerModalProps {
  videoSlice: VideoSlice | null;
  offsetSeconds: number;
  assetTitle: string;
  milepost: string;
  onClose: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  videoSlice,
  offsetSeconds,
  assetTitle,
  milepost,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(offsetSeconds || 0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const duration = videoSlice?.duration_seconds || 300;

  useEffect(() => {
    setCurrentTime(offsetSeconds || 0);
    setIsPlaying(true);
  }, [offsetSeconds, videoSlice]);

  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false);
            return duration;
          }
          return Math.min(duration, prev + 0.5 * playbackRate);
        });
      }, 500);
    }
    return () => clearInterval(timer);
  }, [isPlaying, playbackRate, duration]);

  if (!videoSlice) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* 顶部标题栏 */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-sm">{videoSlice.file_name}</h3>
                <span className="bg-blue-950 text-blue-300 px-2 py-0.5 rounded text-xs font-mono">
                  切片时段: {new Date(videoSlice.start_time).toLocaleTimeString()} - {new Date(videoSlice.end_time).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>关联路产: <strong className="text-cyan-400">{assetTitle}</strong></span>
                <span>·</span>
                <span>桩号: <strong className="text-amber-400">{milepost}</strong></span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 视频模拟/真实画面展示区 */}
        <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden">
          {/* 模拟道路行车录像画面 */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-transparent to-black/80 pointer-events-none" />
          <img
            src="https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80"
            alt="车载行车巡查录像画面"
            className="w-full h-full object-cover opacity-80"
          />

          {/* 实时时间戳水印 (证明精确秒级时间对齐) */}
          <div className="absolute top-4 left-4 bg-black/70 border border-slate-700/60 rounded px-3 py-1.5 font-mono text-xs text-emerald-400 backdrop-blur shadow">
            <div>CAM-01 · 1080P/30FPS · GPS LOCKED</div>
            <div className="text-white font-bold text-sm mt-0.5">
              {new Date(new Date(videoSlice.start_time).getTime() + currentTime * 1000).toLocaleString()}
            </div>
          </div>

          {/* 目标路产在视频画面中的自动识别锚框 (AI 预留标注演示) */}
          {Math.abs(currentTime - offsetSeconds) < 4 && (
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-cyan-400 bg-cyan-500/20 rounded p-2 text-cyan-300 font-mono text-xs animate-pulse">
              [ 目标路产证据位: {assetTitle} · {milepost} ]
            </div>
          )}

          {/* 快捷跳转至该路产发现瞬间按钮 */}
          <div className="absolute bottom-4 right-4">
            <button
              onClick={() => setCurrentTime(offsetSeconds)}
              className="bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 backdrop-blur transition"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>跳至路产发现时刻 ({formatTime(offsetSeconds)})</span>
            </button>
          </div>
        </div>

        {/* 播放控制栏 */}
        <div className="p-4 bg-slate-900 space-y-3">
          {/* 进度条 */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400 w-10">{formatTime(currentTime)}</span>
            <div className="relative flex-1 group">
              <input
                type="range"
                min="0"
                max={duration}
                step="1"
                value={currentTime}
                onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 group-hover:h-2 transition-all"
              />
              {/* 关键时间点标记 (路产发现偏移点) */}
              <div
                className="absolute top-0 w-2 h-2 bg-amber-400 rounded-full -translate-x-1/2 pointer-events-none"
                style={{ left: `${(offsetSeconds / duration) * 100}%` }}
                title={`路产发现点: ${formatTime(offsetSeconds)}`}
              />
            </div>
            <span className="text-xs font-mono text-slate-400 w-10 text-right">{formatTime(duration)}</span>
          </div>

          {/* 控制按钮集合 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-lg shadow-cyan-900/40"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button
                onClick={() => setCurrentTime(0)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 transition"
                title="重新开始"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <div className="h-4 w-px bg-slate-800 mx-1" />
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <Volume2 className="w-4 h-4 text-slate-400" />
                <span>车载降噪原声</span>
              </div>
            </div>

            {/* 倍速切换 */}
            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 text-xs">
              <FastForward className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
              {[1.0, 2.0, 4.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setPlaybackRate(rate)}
                  className={`px-2 py-0.5 rounded font-mono font-medium transition ${
                    playbackRate === rate ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
