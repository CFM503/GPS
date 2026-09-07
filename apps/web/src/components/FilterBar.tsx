import React, { useState } from 'react';
import { AssetType, Road } from '@road-gis/shared';
import { Search, RotateCcw, Filter } from 'lucide-react';

interface FilterBarProps {
  roads: Road[];
  assetTypes: AssetType[];
  onFilterChange: (filters: {
    roadId?: string;
    typeId?: string;
    status?: string;
    minMilepost?: string;
    maxMilepost?: string;
  }) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({ roads, assetTypes, onFilterChange }) => {
  const [roadId, setRoadId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [status, setStatus] = useState('');
  const [minMilepost, setMinMilepost] = useState('');
  const [maxMilepost, setMaxMilepost] = useState('');

  const handleSearch = () => {
    onFilterChange({
      roadId: roadId || undefined,
      typeId: typeId || undefined,
      status: status || undefined,
      minMilepost: minMilepost || undefined,
      maxMilepost: maxMilepost || undefined,
    });
  };

  const handleReset = () => {
    setRoadId('');
    setTypeId('');
    setStatus('');
    setMinMilepost('');
    setMaxMilepost('');
    onFilterChange({});
  };

  return (
    <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 shadow-xl backdrop-blur-md text-xs">
      <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
        <Filter className="w-3.5 h-3.5 text-cyan-400" />
        <span>路产检索:</span>
      </div>

      {/* 道路选择 */}
      <select
        value={roadId}
        onChange={(e) => setRoadId(e.target.value)}
        className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-500"
      >
        <option value="">全部道路</option>
        {roads.map((r) => (
          <option key={r.id} value={r.id}>
            {r.code} ({r.name})
          </option>
        ))}
      </select>

      {/* 路产类型选择 */}
      <select
        value={typeId}
        onChange={(e) => setTypeId(e.target.value)}
        className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-500"
      >
        <option value="">全部路产类型</option>
        {assetTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {/* 状态选择 */}
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-500"
      >
        <option value="">全部状态</option>
        <option value="NORMAL">正常</option>
        <option value="ABNORMAL">异常</option>
        <option value="DAMAGED">损坏</option>
        <option value="MISSING">缺失</option>
        <option value="MAINTAINING">维修中</option>
        <option value="REPAIRED">已修复</option>
      </select>

      {/* 桩号区间 */}
      <div className="flex items-center gap-1.5 font-mono">
        <input
          type="text"
          placeholder="起桩(如 K120+000)"
          value={minMilepost}
          onChange={(e) => setMinMilepost(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 w-28 focus:outline-none focus:border-cyan-500"
        />
        <span className="text-slate-500">~</span>
        <input
          type="text"
          placeholder="止桩(如 K135+000)"
          value={maxMilepost}
          onChange={(e) => setMaxMilepost(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 w-28 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* 按钮 */}
      <button
        onClick={handleSearch}
        className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-3 py-1 rounded-lg transition shadow"
      >
        <Search className="w-3.5 h-3.5" />
        <span>查询</span>
      </button>

      <button
        onClick={handleReset}
        className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
        title="重置"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    </div>
  );
};
