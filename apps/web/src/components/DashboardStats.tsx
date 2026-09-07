import React from 'react';
import {
  Milestone,
  Layers,
  Car,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp
} from 'lucide-react';

interface DashboardStatsProps {
  stats: {
    totalRoads: number;
    totalRoadMileageKm: number;
    totalAssets: number;
    todayPatrolKm: number;
    monthPatrolKm: number;
    monthPatrolCount: number;
    abnormalAssets: number;
    pendingMaintenance: number;
    repairedAssets: number;
    typeDistribution?: Record<string, number>;
  } | null;
  onClose?: () => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ stats, onClose }) => {
  if (!stats) return null;

  const cards = [
    { label: '管辖道路总数', value: `${stats.totalRoads} 条`, sub: `${stats.totalRoadMileageKm} km`, icon: Milestone, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: '数字路产总数', value: `${stats.totalAssets} 处`, sub: '全要素点线面建档', icon: Layers, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: '今日巡查公里', value: `${stats.todayPatrolKm} km`, sub: '实时车载轨迹拟合', icon: Car, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: '本月巡查公里', value: `${stats.monthPatrolKm} km`, sub: `${stats.monthPatrolCount} 次巡查会话`, icon: Calendar, color: 'text-teal-400', bg: 'bg-teal-500/10' },
    { label: '路产异常数量', value: `${stats.abnormalAssets} 处`, sub: '需跟进或修复', icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { label: '待处理维修工单', value: `${stats.pendingMaintenance} 单`, sub: '已派发养护中队', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: '已恢复/维修完成', value: `${stats.repairedAssets} 处`, sub: '验收归档合格', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: '巡查覆盖率', value: '98.5%', sub: 'G105全覆盖', icon: TrendingUp, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  ];

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>道路巡查综合数字化看板 (KPI 指标)</span>
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200">
            收起
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={i}
              className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 flex items-center gap-3"
            >
              <div className={`p-2.5 rounded-xl ${c.bg} ${c.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] text-slate-400">{c.label}</div>
                <div className="text-base font-bold font-mono text-slate-100 mt-0.5">{c.value}</div>
                <div className="text-[10px] text-slate-500 truncate">{c.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
