/**
 * 空间几何计算与道路桩号推算核心算法
 */

const EARTH_RADIUS_METERS = 6378137.0; // WGS84 椭球体平均半径

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180.0;
}

function toDegrees(radians: number): number {
  return (radians * 180.0) / Math.PI;
}

/**
 * 计算两个 WGS84 经纬度点之间的球面大圆距离 (Haversine 公式，单位：米)
 */
export function calculateDistanceMeters(
  point1: [number, number], // [lng, lat]
  point2: [number, number]
): number {
  const [lng1, lat1] = point1;
  const [lng2, lat2] = point2;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * 计算从 point1 到 point2 的初始方位角 (航向角，0°~360°，正北为0，顺时针)
 */
export function calculateBearing(
  point1: [number, number],
  point2: [number, number]
): number {
  const [lng1, lat1] = point1;
  const [lng2, lat2] = point2;

  const y = Math.sin(toRadians(lng2 - lng1)) * Math.cos(toRadians(lat2));
  const x =
    Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(toRadians(lng2 - lng1));

  let brng = toDegrees(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * 标称桩号字符串格式化 (米数 -> K127+350)
 * 例如 127350 -> "K127+350"
 */
export function formatMilepost(meters: number): string {
  const km = Math.floor(meters / 1000);
  const m = Math.round(meters - km * 1000);
  return `K${km}+${m.toString().padStart(3, '0')}`;
}

/**
 * 解析桩号字符串为米制连续数字
 * 例如 "K127+350" -> 127350
 */
export function parseMilepost(milepostStr: string): number {
  const cleanStr = milepostStr.trim().toUpperCase();
  const match = cleanStr.match(/^K?(\d+)\+(\d+(\.\d+)?)$/);
  if (!match) {
    throw new Error(`Invalid milepost format: ${milepostStr}. Expected format like K127+350`);
  }
  const km = parseInt(match[1], 10);
  const m = parseFloat(match[2]);
  return km * 1000 + m;
}

/**
 * 计算点 P 在线段 AB 上的投影点及其在线段上的投影比例 t (0 <= t <= 1)
 */
function projectPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): { closestPoint: [number, number]; t: number } {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;

  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) {
    return { closestPoint: [ax, ay], t: 0 };
  }

  // 标量投影 t = ((P - A) . (B - A)) / |B - A|^2
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t)); // 截断到线段内

  const closestPoint: [number, number] = [ax + t * dx, ay + t * dy];
  return { closestPoint, t };
}

export interface MilepostProjectionResult {
  milepostStr: string;                 // e.g. "K127+350"
  milepostMeters: number;              // e.g. 127350
  projectedPoint: [number, number];    // [lng, lat]
  distanceToCenterlineMeters: number;  // 离道路中心线的垂直偏离米数
  fractionAlongRoad: number;           // 沿道路中心线全长的比例 (0.0 ~ 1.0)
}

/**
 * 计算 GPS 点在道路中心线折线上的投影并推算公路标称桩号
 * @param gpsPoint 目标点 [lng, lat] (WGS84)
 * @param centerlineCoordinates 道路中心线顶点序列 [[lng, lat], ...]
 * @param startMilepostMeters 道路起点桩号 (米制, 例如 120000 代表 K120+000)
 */
export function calculatePointMilepost(
  gpsPoint: [number, number],
  centerlineCoordinates: [number, number][],
  startMilepostMeters: number
): MilepostProjectionResult {
  if (!centerlineCoordinates || centerlineCoordinates.length < 2) {
    throw new Error('Centerline must have at least 2 points');
  }

  let minDistance = Infinity;
  let bestClosestPoint: [number, number] = centerlineCoordinates[0];
  let bestSegmentIndex = 0;
  let bestSegmentT = 0;

  // 1. 遍历折线每段，找到几何距离最近的一段
  for (let i = 0; i < centerlineCoordinates.length - 1; i++) {
    const a = centerlineCoordinates[i];
    const b = centerlineCoordinates[i + 1];

    const { closestPoint, t } = projectPointOnSegment(gpsPoint, a, b);
    const dist = calculateDistanceMeters(gpsPoint, closestPoint);

    if (dist < minDistance) {
      minDistance = dist;
      bestClosestPoint = closestPoint;
      bestSegmentIndex = i;
      bestSegmentT = t;
    }
  }

  // 2. 累计从道路中心线起点到最佳线段投影点的沿线实际米数
  let distanceAlongRoad = 0;
  let totalRoadLength = 0;

  for (let i = 0; i < centerlineCoordinates.length - 1; i++) {
    const a = centerlineCoordinates[i];
    const b = centerlineCoordinates[i + 1];
    const segLen = calculateDistanceMeters(a, b);

    if (i < bestSegmentIndex) {
      distanceAlongRoad += segLen;
    } else if (i === bestSegmentIndex) {
      distanceAlongRoad += segLen * bestSegmentT;
    }
    totalRoadLength += segLen;
  }

  const fraction = totalRoadLength > 0 ? distanceAlongRoad / totalRoadLength : 0;
  const calculatedMeters = startMilepostMeters + distanceAlongRoad;

  return {
    milepostStr: formatMilepost(calculatedMeters),
    milepostMeters: calculatedMeters,
    projectedPoint: bestClosestPoint,
    distanceToCenterlineMeters: minDistance,
    fractionAlongRoad: fraction,
  };
}
