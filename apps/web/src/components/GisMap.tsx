import React, { useRef, useState, useEffect } from 'react';
import { Asset, Road, GPSTrackPoint } from '@road-gis/shared';
import {
  Compass,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertTriangle,
  Navigation,
  Layers,
  MapPin
} from 'lucide-react';

interface GisMapProps {
  roads: Road[];
  assets: Asset[];
  activeLayers: Record<string, boolean>;
  selectedAsset: Asset | null;
  onSelectAsset: (asset: Asset) => void;
  replayTrackPoints?: GPSTrackPoint[];
  replayCurrentIndex?: number;
}

export const GisMap: React.FC<GisMapProps> = ({
  roads,
  assets,
  activeLayers,
  selectedAsset,
  onSelectAsset,
  replayTrackPoints = [],
  replayCurrentIndex = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 地图视口状态 (平移与缩放)
  const [viewState, setViewState] = useState({
    scale: 2800, // 像素/经纬度比例尺
    centerX: 113.31,
    centerY: 23.21,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
  });

  const [mouseCoord, setMouseCoord] = useState<[number, number]>([113.31, 23.21]);
  const [hoveredAsset, setHoveredAsset] = useState<Asset | null>(null);

  // 坐标投影函数 (WGS84 -> 屏幕像素 X, Y)
  const project = (lng: number, lat: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const x = width / 2 + (lng - viewState.centerX) * viewState.scale;
    const y = height / 2 - (lat - viewState.centerY) * viewState.scale; // 纬度向上为正，屏幕Y向下为正
    return { x, y };
  };

  // 逆投影 (屏幕像素 -> WGS84)
  const unproject = (x: number, y: number): [number, number] => {
    if (!containerRef.current) return [0, 0];
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const lng = (x - width / 2) / viewState.scale + viewState.centerX;
    const lat = (height / 2 - y) / viewState.scale + viewState.centerY;
    return [lng, lat];
  };

  // 鼠标滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.2 : 0.833;
    setViewState((prev) => ({
      ...prev,
      scale: Math.max(800, Math.min(25000, prev.scale * zoomFactor)),
    }));
  };

  // 鼠标拖拽平移
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setViewState((prev) => ({
      ...prev,
      isDragging: true,
      dragStartX: e.clientX,
      dragStartY: e.clientY,
    }));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMouseCoord(unproject(x, y));

    if (!viewState.isDragging) return;

    const dx = e.clientX - viewState.dragStartX;
    const dy = e.clientY - viewState.dragStartY;

    const dLng = -dx / viewState.scale;
    const dLat = dy / viewState.scale;

    setViewState((prev) => ({
      ...prev,
      centerX: prev.centerX + dLng,
      centerY: prev.centerY + dLat,
      dragStartX: e.clientX,
      dragStartY: e.clientY,
    }));
  };

  const handleMouseUp = () => {
    setViewState((prev) => ({ ...prev, isDragging: false }));
  };

  const handleResetView = () => {
    setViewState((prev) => ({
      ...prev,
      scale: 2800,
      centerX: 113.31,
      centerY: 23.21,
    }));
  };

  // 过滤当前激活图层的路产
  const visibleAssets = assets.filter((asset) => {
    // 异常图层独立控制
    if (asset.status === 'ABNORMAL' || asset.status === 'DAMAGED') {
      if (!activeLayers['DISEASE'] && !activeLayers[asset.type_id]) return false;
    }
    return activeLayers[asset.type_id] ?? true;
  });

  // 当前回放车辆位置
  const currentReplayPoint = replayTrackPoints[replayCurrentIndex];

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#0b1120] overflow-hidden select-none cursor-crosshair"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* 1. GIS 背景坐标网格 */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#38bdf8" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* 2. 空间要素渲染 SVG 核心画布 */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {/* (1) 道路中心线图层 */}
        {activeLayers['ROAD'] !== false &&
          roads.map((road) => {
            const points = road.centerline_geom.coordinates.map((c) => {
              const p = project(c[0], c[1]);
              return `${p.x},${p.y}`;
            }).join(' ');

            return (
              <g key={road.id}>
                {/* 道路底层缓冲晕影 */}
                <polyline points={points} fill="none" stroke="#1e293b" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={points} fill="none" stroke="#334155" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={points} fill="none" stroke="#38bdf8" strokeWidth="4" strokeDasharray="12 6" strokeLinecap="round" strokeLinejoin="round" />

                {/* 道路顶点桩号标识 */}
                {road.centerline_geom.coordinates.map((coord, idx) => {
                  if (idx % 2 !== 0 && idx !== road.centerline_geom.coordinates.length - 1) return null;
                  const p = project(coord[0], coord[1]);
                  const km = Math.round(road.start_milepost / 1000 + (idx * 6.5));
                  return (
                    <g key={idx} transform={`translate(${p.x}, ${p.y})`}>
                      <circle r="4" fill="#38bdf8" />
                      <rect x="8" y="-12" width="55" height="18" rx="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
                      <text x="12" y="1" fill="#e0f2fe" fontSize="10" fontFamily="monospace" fontWeight="bold">
                        K{km}+000
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

        {/* (2) 巡查轨迹图层 (Patrol Track) */}
        {activeLayers['TRACK'] !== false && replayTrackPoints.length > 1 && (
          <g>
            {/* 已走过轨迹 */}
            {replayCurrentIndex > 0 && (
              <polyline
                points={replayTrackPoints.slice(0, replayCurrentIndex + 1).map((pt) => {
                  const p = project(pt.longitude, pt.latitude);
                  return `${p.x},${p.y}`;
                }).join(' ')}
                fill="none"
                stroke="#10b981"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-100"
              />
            )}
            {/* 剩余待走轨迹 */}
            <polyline
              points={replayTrackPoints.map((pt) => {
                const p = project(pt.longitude, pt.latitude);
                return `${p.x},${p.y}`;
              }).join(' ')}
              fill="none"
              stroke="#059669"
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeOpacity="0.5"
            />
          </g>
        )}

        {/* (3) 线状路产 (LineString: 护栏、排水沟) */}
        {visibleAssets.map((asset) => {
          if (asset.geom.type !== 'LineString') return null;
          const coords = asset.geom.coordinates;
          const points = coords.map((c) => {
            const p = project(c[0], c[1]);
            return `${p.x},${p.y}`;
          }).join(' ');

          const isSelected = selectedAsset?.id === asset.id;
          const color = asset.type_id === 'GUARDRAIL' ? '#f59e0b' : '#06b6d4';

          return (
            <g key={asset.id}>
              <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={isSelected ? 6 : 4}
                strokeLinecap="round"
                className="cursor-pointer transition-all"
              />
            </g>
          );
        })}

        {/* (4) 面状路产 (Polygon: 道路病害坑槽、施工区、边坡) */}
        {visibleAssets.map((asset) => {
          if (asset.geom.type !== 'Polygon') return null;
          const ring = asset.geom.coordinates[0];
          const points = ring.map((c) => {
            const p = project(c[0], c[1]);
            return `${p.x},${p.y}`;
          }).join(' ');

          const isSelected = selectedAsset?.id === asset.id;
          const isAnomaly = asset.status === 'ABNORMAL' || asset.status === 'DAMAGED';
          const fillColor = isAnomaly ? 'rgba(239, 68, 68, 0.4)' : 'rgba(217, 119, 6, 0.3)';
          const strokeColor = isAnomaly ? '#ef4444' : '#f59e0b';

          return (
            <g key={asset.id}>
              <polygon
                points={points}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isSelected ? 3 : 1.5}
                strokeDasharray={isAnomaly ? '4 2' : 'none'}
              />
            </g>
          );
        })}

        {/* (5) 回放车辆动态光标 */}
        {currentReplayPoint && (
          <g
            transform={`translate(${project(currentReplayPoint.longitude, currentReplayPoint.latitude).x}, ${
              project(currentReplayPoint.longitude, currentReplayPoint.latitude).y
            })`}
          >
            <circle r="16" fill="rgba(16, 185, 129, 0.2)" className="animate-ping" />
            <circle r="10" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
            <g transform={`rotate(${currentReplayPoint.heading || 0})`}>
              <polygon points="0,-8 5,5 0,2 -5,5" fill="#ffffff" />
            </g>
            <rect x="14" y="-12" width="70" height="20" rx="3" fill="#0f172a" stroke="#10b981" strokeWidth="1" />
            <text x="18" y="2" fill="#34d399" fontSize="10" fontFamily="monospace" fontWeight="bold">
              {currentReplayPoint.speed_kmh} km/h
            </text>
          </g>
        )}
      </svg>

      {/* 3. 点状路产要素 DOM 交互层 (包含 Hover 和点击事件) */}
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        {visibleAssets.map((asset) => {
          const { x, y } = project(asset.longitude, asset.latitude);
          const isSelected = selectedAsset?.id === asset.id;
          const isAnomaly = asset.status === 'ABNORMAL' || asset.status === 'DAMAGED';

          let bgColor = '#3b82f6';
          if (asset.type_id === 'HUNDRED_METER_POST') bgColor = '#059669';
          if (asset.type_id === 'MILEPOST') bgColor = '#10b981';
          if (asset.type_id === 'TREE') bgColor = '#16a34a';
          if (asset.type_id === 'GUARDRAIL') bgColor = '#f59e0b';
          if (asset.type_id === 'DISEASE' || isAnomaly) bgColor = '#ef4444';

          return (
            <div
              key={asset.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group"
              style={{ left: `${x}px`, top: `${y}px` }}
              onClick={() => onSelectAsset(asset)}
              onMouseEnter={() => setHoveredAsset(asset)}
              onMouseLeave={() => setHoveredAsset(null)}
            >
              {/* 点位图标徽章 */}
              <div
                className={`relative flex items-center justify-center w-7 h-7 rounded-full shadow-lg border-2 transition-all transform hover:scale-125 ${
                  isSelected ? 'scale-125 ring-4 ring-cyan-400 border-white' : 'border-slate-900'
                }`}
                style={{ backgroundColor: bgColor }}
              >
                {isAnomaly ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-white" />
                ) : (
                  <MapPin className="w-3.5 h-3.5 text-white" />
                )}
                {isAnomaly && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                )}
              </div>

              {/* 桩号标签 */}
              <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-slate-900/90 text-[10px] text-slate-200 px-1.5 py-0.5 rounded border border-slate-700 whitespace-nowrap shadow pointer-events-none group-hover:border-cyan-400">
                {asset.milepost}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. 地图悬停气泡提示 (Hover Tooltip) */}
      {hoveredAsset && (
        <div
          className="absolute z-20 pointer-events-none bg-slate-900/95 border border-cyan-500/50 rounded-lg p-3 shadow-2xl backdrop-blur-md text-xs w-60"
          style={{
            left: `${project(hoveredAsset.longitude, hoveredAsset.latitude).x + 20}px`,
            top: `${project(hoveredAsset.longitude, hoveredAsset.latitude).y - 40}px`,
          }}
        >
          <div className="flex items-center justify-between font-bold text-sm text-cyan-400 mb-1">
            <span>{hoveredAsset.type_name}</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] ${
                hoveredAsset.status === 'NORMAL' ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'
              }`}
            >
              {hoveredAsset.status}
            </span>
          </div>
          <div className="text-slate-300 space-y-0.5">
            <div>编码: <span className="font-mono text-slate-100">{hoveredAsset.asset_code}</span></div>
            <div>道路/桩号: <span className="text-amber-300">{hoveredAsset.road_code} {hoveredAsset.milepost}</span></div>
            <div>发现时间: {new Date(hoveredAsset.discovery_time).toLocaleTimeString()}</div>
            {hoveredAsset.description && (
              <div className="text-slate-400 mt-1 border-t border-slate-800 pt-1 line-clamp-2">
                {hoveredAsset.description}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. 悬浮地图控制器 (缩放/复位/状态信息) */}
      <div className="absolute right-5 bottom-6 flex flex-col gap-2 z-10">
        <div className="flex flex-col bg-slate-800/90 border border-slate-700 rounded-lg p-1 shadow-lg backdrop-blur">
          <button
            onClick={() => setViewState((v) => ({ ...v, scale: Math.min(25000, v.scale * 1.3) }))}
            className="p-2 hover:bg-slate-700 text-slate-200 rounded transition"
            title="放大"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewState((v) => ({ ...v, scale: Math.max(800, v.scale / 1.3) }))}
            className="p-2 hover:bg-slate-700 text-slate-200 rounded transition border-t border-slate-700"
            title="缩小"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={handleResetView}
            className="p-2 hover:bg-slate-700 text-slate-200 rounded transition border-t border-slate-700"
            title="复位视角"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 6. 底部 GIS 状态栏 (经纬度与比例尺) */}
      <div className="absolute left-6 bottom-4 bg-slate-900/80 border border-slate-800 rounded px-3 py-1 text-[11px] font-mono text-slate-400 flex items-center gap-4 backdrop-blur pointer-events-none z-10">
        <div className="flex items-center gap-1">
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span>WGS84 原始空间坐标:</span>
          <span className="text-slate-200 font-bold">
            {mouseCoord[0].toFixed(5)}° E, {mouseCoord[1].toFixed(5)}° N
          </span>
        </div>
        <div className="h-3 w-px bg-slate-700" />
        <div>比例: 1:{(viewState.scale * 10).toFixed(0)}</div>
        <div className="h-3 w-px bg-slate-700" />
        <div className="text-emerald-400 font-sans">底图已解耦 · 点线面几何引擎激活</div>
      </div>
    </div>
  );
};
