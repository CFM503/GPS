import React from 'react';
import { Asset } from '@road-gis/shared';
import {
  X,
  PlayCircle,
  AlertTriangle,
  Wrench,
  Camera,
  Compass,
  MapPin,
  Calendar,
  User,
  CheckCircle2,
  FileText
} from 'lucide-react';

interface AssetDetailModalProps {
  asset: Asset | null;
  onClose: () => void;
  onPlayVideo: (asset: Asset) => void;
  onUpdateStatus: (assetId: string, newStatus: any) => void;
  onCreateMaintenance: (asset: Asset) => void;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  asset,
  onClose,
  onPlayVideo,
  onUpdateStatus,
  onCreateMaintenance,
}) => {
  if (!asset) return null;

  const isAnomaly = asset.status === 'ABNORMAL' || asset.status === 'DAMAGED' || asset.status === 'MISSING';

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-slate-900/95 border-l border-slate-800 shadow-2xl z-40 flex flex-col backdrop-blur-md animate-in slide-in-from-right duration-200">
      {/* 头部 */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-cyan-400" />
          <h3 className="font-bold text-slate-100 text-base">{asset.type_name}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 滚动内容区 */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
        {/* 状态徽章 */}
        <div className="flex items-center justify-between bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
          <div>
            <div className="text-[11px] text-slate-400 uppercase">资产状态</div>
            <div className={`font-bold flex items-center gap-1.5 mt-0.5 ${
              isAnomaly ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {isAnomaly ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{asset.status}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-400 uppercase">技术状况评级</div>
            <div className="font-mono font-bold text-cyan-300 mt-0.5">{asset.condition_grade} 级</div>
          </div>
        </div>

        {/* 基础属性 */}
        <div className="space-y-3 bg-slate-800/30 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" /> 资产编码
            </span>
            <span className="font-mono text-xs font-semibold text-slate-200">{asset.asset_code}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500" /> 所属道路
            </span>
            <span className="font-semibold text-amber-300">{asset.road_code}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-slate-500" /> 标称桩号
            </span>
            <span className="font-mono font-bold text-cyan-400">{asset.milepost}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs">行车方向</span>
            <span className="text-slate-200 font-medium">
              {asset.direction === 'UP' ? '上行 (K值递增)' : asset.direction === 'DOWN' ? '下行 (K值递减)' : '双向'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs">原始地理坐标</span>
            <span className="font-mono text-[11px] text-slate-400">
              {asset.longitude.toFixed(5)}, {asset.latitude.toFixed(5)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" /> 巡查采信人
            </span>
            <span className="text-slate-200">{asset.creator_name || '张三'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" /> 发现时间
            </span>
            <span className="font-mono text-xs text-slate-300">
              {new Date(asset.discovery_time).toLocaleString()}
            </span>
          </div>
        </div>

        {/* 现场文字描述 */}
        <div>
          <div className="text-xs font-semibold text-slate-400 mb-1.5">现场说明与病害特征</div>
          <div className="bg-slate-800/50 p-3 rounded-lg text-slate-300 text-xs leading-relaxed border border-slate-700/40">
            {asset.description || '现场巡查确认无明显结构破损，反光清晰，外观正常。'}
          </div>
        </div>

        {/* 现场照片预览 */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
            <span className="flex items-center gap-1">
              <Camera className="w-3.5 h-3.5" /> 现场照片 (1张)
            </span>
            <span className="text-[11px] text-cyan-400 cursor-pointer">查看原图</span>
          </div>
          <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-800 aspect-video flex items-center justify-center group">
            <img
              src="https://images.unsplash.com/photo-1545459720-aac8509eb02c?auto=format&fit=crop&w=600&q=80"
              alt="现场抓拍"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent flex items-end p-2 text-[10px] text-slate-300 font-mono">
              GPS: {asset.longitude.toFixed(4)}, {asset.latitude.toFixed(4)} · {asset.milepost}
            </div>
          </div>
        </div>
      </div>

      {/* 底部操作工具条 */}
      <div className="p-4 border-t border-slate-800 space-y-2 bg-slate-900">
        {/* 播放录像核心按钮 */}
        <button
          onClick={() => onPlayVideo(asset)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-sm shadow-lg shadow-cyan-900/30 transition transform active:scale-98"
        >
          <PlayCircle className="w-4 h-4" />
          <span>跳转对应视频切片 (精准定位)</span>
        </button>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={() => onCreateMaintenance(asset)}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-amber-600/20 border border-amber-500/30 hover:bg-amber-600/30 text-amber-300 font-medium transition"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>派发维修工单</span>
          </button>
          <button
            onClick={() => onUpdateStatus(asset.id, isAnomaly ? 'NORMAL' : 'ABNORMAL')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border font-medium transition ${
              isAnomaly
                ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30'
                : 'bg-rose-600/20 border-rose-500/30 text-rose-300 hover:bg-rose-600/30'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{isAnomaly ? '解除异常' : '标记异常'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
