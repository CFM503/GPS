import React, { useState } from 'react';
import { X, CloudUpload, RefreshCw, CheckCircle2, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { offlineDb } from '../services/db.js';
import { syncManager } from '../services/sync.js';

interface SyncQueueModalProps {
  onClose: () => void;
  isOnline: boolean;
  onToggleOnline: () => void;
}

export const SyncQueueModal: React.FC<SyncQueueModalProps> = ({
  onClose,
  isOnline,
  onToggleOnline,
}) => {
  const [tasks, setTasks] = useState(offlineDb.getTasks());
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleManualSync = async () => {
    if (!isOnline) {
      alert('当前处于离线仿真状态，请先点击右上角切换为“在线模式”');
      return;
    }
    setSyncing(true);
    setStatusMsg('正在按 5 级优先级同步...');
    const result = await syncManager.triggerSync();
    setTasks(offlineDb.getTasks());
    setSyncing(false);
    setStatusMsg(result.synced > 0 ? `同步成功！已上传 ${result.synced} 项` : '全部队列已处于同步状态');
  };

  const getPriorityBadge = (p: number) => {
    switch (p) {
      case 1: return { label: 'P1 会话摘要', color: 'text-purple-400 bg-purple-950/60 border-purple-800' };
      case 2: return { label: 'P2 GPS轨迹', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800' };
      case 3: return { label: 'P3 路产信息', color: 'text-cyan-400 bg-cyan-950/60 border-cyan-800' };
      case 4: return { label: 'P4 现场照片', color: 'text-amber-400 bg-amber-950/60 border-amber-800' };
      case 5: default: return { label: 'P5 视频切片', color: 'text-blue-400 bg-blue-950/60 border-blue-800' };
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-4 flex flex-col max-h-[85vh]">
        {/* 标题 */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
            <CloudUpload className="w-4 h-4 text-cyan-400" />
            <span>离线队列与断点续传管理</span>
          </div>
          <div className="flex items-center gap-3">
            {/* 模拟网络通断切换开关 */}
            <button
              onClick={onToggleOnline}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${
                isOnline
                  ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-600/20 border-rose-500/40 text-rose-300'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isOnline ? '仿真: 在线' : '仿真: 断网'}</span>
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="mt-2.5 p-2 bg-slate-800 rounded-lg text-xs text-cyan-300 font-mono text-center">
            {statusMsg}
          </div>
        )}

        {/* 任务列表 */}
        <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1 text-xs">
          {tasks.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              暂无待上传数据，路产采集与录像切片将在此处排队
            </div>
          ) : (
            tasks.map((task) => {
              const pri = getPriorityBadge(task.priority);
              return (
                <div
                  key={task.id}
                  className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${pri.color}`}>
                        {pri.label}
                      </span>
                      <span className="font-mono text-slate-200 truncate max-w-[180px]">
                        {task.resource_id}
                      </span>
                    </div>
                    {task.total_bytes > 0 && (
                      <div className="text-[10px] text-slate-400 font-mono mt-1">
                        进度: {(task.uploaded_bytes / 1024 / 1024).toFixed(1)}MB / {(task.total_bytes / 1024 / 1024).toFixed(1)}MB
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {task.status === 'UPLOADED' && (
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 已同步
                      </span>
                    )}
                    {task.status === 'UPLOADING' && (
                      <span className="text-cyan-400 font-mono animate-pulse">上传中...</span>
                    )}
                    {task.status === 'PENDING' && (
                      <span className="text-amber-400 font-mono">待排队</span>
                    )}
                    {task.status === 'FAILED' && (
                      <span className="flex items-center gap-1 text-rose-400">
                        <AlertCircle className="w-3.5 h-3.5" /> 待重试
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 底部手动同步按钮 */}
        <div className="pt-3 border-t border-slate-800 mt-2">
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? '正在按优先级极速续传...' : '立即按优先级全量同步'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
