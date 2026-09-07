import React, { useState } from 'react';
import { X, Check, Camera, Edit3, MapPin, Compass } from 'lucide-react';
import { Asset } from '@road-gis/shared';
import { offlineDb } from '../services/db.js';

interface PendingAssetsModalProps {
  onClose: () => void;
}

export const PendingAssetsModal: React.FC<PendingAssetsModalProps> = ({ onClose }) => {
  const [assets, setAssets] = useState(offlineDb.getAssets());
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [descInput, setDescInput] = useState('');

  const handleEdit = (a: Asset) => {
    setEditingAsset(a);
    setDescInput(a.description || '');
  };

  const handleSaveEdit = () => {
    if (!editingAsset) return;
    editingAsset.description = descInput;
    offlineDb.saveAsset(editingAsset);
    setAssets(offlineDb.getAssets());
    setEditingAsset(null);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-4 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
            <Edit3 className="w-4 h-4 text-cyan-400" />
            <span>停车安全补录 (本次已采集 {assets.length} 处)</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto mt-3 space-y-3 text-xs">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-100">{asset.type_name}</span>
                <span className="font-mono text-cyan-400">{asset.milepost}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                <MapPin className="w-3 h-3 text-slate-500" />
                <span>GPS: {asset.longitude.toFixed(4)}, {asset.latitude.toFixed(4)}</span>
              </div>
              {asset.description ? (
                <div className="text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800">
                  {asset.description}
                </div>
              ) : (
                <div className="text-slate-500 italic">暂无现场文字说明</div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                <button
                  onClick={() => handleEdit(asset)}
                  className="px-2.5 py-1 rounded bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/30 flex items-center gap-1 font-medium"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>补充说明</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 补充说明弹层 */}
        {editingAsset && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-full max-w-sm space-y-3">
              <h4 className="font-bold text-sm text-slate-100">
                补充 {editingAsset.type_name} 说明
              </h4>
              <textarea
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder="在此输入路产破损程度、规格或备注信息..."
                className="w-full h-24 bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  onClick={() => setEditingAsset(null)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-300"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 rounded bg-cyan-600 text-white font-medium"
                >
                  保存更新
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
