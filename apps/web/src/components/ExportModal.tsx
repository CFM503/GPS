import React from 'react';
import { X, Download, FileSpreadsheet, Map, Globe } from 'lucide-react';
import { api } from '../services/api.js';

interface ExportModalProps {
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ onClose }) => {
  const exportItems = [
    {
      format: 'geojson',
      title: 'GeoJSON 空间要素集',
      desc: '标准 OGC GeoJSON 规范，支持 ArcGIS、QGIS、Mapbox 直接加载',
      icon: Map,
      url: api.getExportUrl('geojson'),
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    },
    {
      format: 'csv',
      title: 'CSV / Excel 路产台账',
      desc: '含桩号、经纬度、状态与现场描述的标准表格数据',
      icon: FileSpreadsheet,
      url: api.getExportUrl('csv'),
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    },
    {
      format: 'kml',
      title: 'Google Earth KML',
      desc: '支持三维实景地球可视化与手持 GPS 导航导入',
      icon: Globe,
      url: api.getExportUrl('kml'),
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-5 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
            <Download className="w-4 h-4 text-cyan-400" />
            <span>导出道路路产全量数字档案</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {exportItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.format}
                href={item.url}
                download
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 hover:border-cyan-500/50 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${item.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200 text-xs group-hover:text-cyan-400 transition">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition" />
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
};
