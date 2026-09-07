import React from 'react';
import { Layers, Eye, EyeOff, CheckSquare, Square } from 'lucide-react';
import { AssetType } from '@road-gis/shared';

interface LayerControlProps {
  assetTypes: AssetType[];
  activeLayers: Record<string, boolean>;
  onToggleLayer: (layerId: string) => void;
  onToggleAll: (enable: boolean) => void;
  assetCounts: Record<string, number>;
}

export const LayerControl: React.FC<LayerControlProps> = ({
  assetTypes,
  activeLayers,
  onToggleLayer,
  onToggleAll,
  assetCounts,
}) => {
  const baseLayers = [
    { id: 'ROAD', name: '道路基础设施 (G105)', color: '#38bdf8', count: 1 },
    { id: 'TRACK', name: '巡查车辆轨迹', color: '#10b981', count: 1 },
  ];

  return (
    <div className="w-72 bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl backdrop-blur-md flex flex-col max-h-[85vh]">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>GIS 图层管理器</span>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => onToggleAll(true)}
            className="text-cyan-400 hover:text-cyan-300 font-medium"
          >
            全选
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => onToggleAll(false)}
            className="text-slate-400 hover:text-slate-200 font-medium"
          >
            清空
          </button>
        </div>
      </div>

      <div className="overflow-y-auto mt-3 space-y-4 pr-1 text-xs">
        {/* 基础空间图层 */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            基础设施与轨迹
          </div>
          <div className="space-y-1">
            {baseLayers.map((layer) => {
              const isActive = activeLayers[layer.id] !== false;
              return (
                <div
                  key={layer.id}
                  onClick={() => onToggleLayer(layer.id)}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                    isActive ? 'bg-slate-800/80 text-slate-100' : 'text-slate-500 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: layer.color }}
                    />
                    <span className="font-medium">{layer.name}</span>
                  </div>
                  {isActive ? (
                    <Eye className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-slate-600" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 数字化路产图层 */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            沿线路产设施 (点/线/面)
          </div>
          <div className="space-y-1">
            {assetTypes.map((type) => {
              const isActive = activeLayers[type.id] !== false;
              const count = assetCounts[type.id] || 0;

              return (
                <div
                  key={type.id}
                  onClick={() => onToggleLayer(type.id)}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                    isActive ? 'bg-slate-800/80 text-slate-100' : 'text-slate-500 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: type.color }}
                    />
                    <span className="truncate">{type.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      ({type.geometry_type[0]})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {count > 0 && (
                      <span className="bg-slate-700/80 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-mono">
                        {count}
                      </span>
                    )}
                    {isActive ? (
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
