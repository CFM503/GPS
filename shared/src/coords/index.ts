/**
 * 高精度坐标系统转换算法
 * 支持 WGS84 (原始GPS标准) <-> GCJ-02 (火星坐标/高德/腾讯) <-> BD-09 (百度坐标)
 * 误差控制在 0.1 米以内
 */

const PI = Math.PI;
const X_PI = (PI * 3000.0) / 180.0;
const A = 6378245.0;            // 长半轴
const EE = 0.00669342162296594323; // 扁率

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}

/**
 * 判断坐标是否在中国境外（境外坐标不进行火星坐标转换）
 */
export function isOutOfChina(lng: number, lat: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

/**
 * WGS84 -> GCJ-02 (高德/腾讯/Google中国底图渲染)
 */
export function wgs84ToGcj02(lng: number, lat: number): [number, number] {
  if (isOutOfChina(lng, lat)) {
    return [lng, lat];
  }
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return [lng + dLng, lat + dLat];
}

/**
 * GCJ-02 -> WGS84 (高德坐标逆转为原始GPS存储)
 */
export function gcj02ToWgs84(gcjLng: number, gcjLat: number): [number, number] {
  if (isOutOfChina(gcjLng, gcjLat)) {
    return [gcjLng, gcjLat];
  }
  let wgsLng = gcjLng;
  let wgsLat = gcjLat;
  // 3次迭代修正，误差由米级降低至毫米级
  for (let i = 0; i < 3; i++) {
    const [currGcjLng, currGcjLat] = wgs84ToGcj02(wgsLng, wgsLat);
    wgsLng -= currGcjLng - gcjLng;
    wgsLat -= currGcjLat - gcjLat;
  }
  return [wgsLng, wgsLat];
}

/**
 * GCJ-02 -> BD-09 (高德 -> 百度)
 */
export function gcj02ToBd09(lng: number, lat: number): [number, number] {
  const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * X_PI);
  const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * X_PI);
  const bdLng = z * Math.cos(theta) + 0.0065;
  const bdLat = z * Math.sin(theta) + 0.006;
  return [bdLng, bdLat];
}

/**
 * BD-09 -> GCJ-02 (百度 -> 高德)
 */
export function bd09ToGcj02(bdLng: number, bdLat: number): [number, number] {
  let gcjLng = bdLng - 0.0065;
  let gcjLat = bdLat - 0.006;
  for (let i = 0; i < 3; i++) {
    const [currBdLng, currBdLat] = gcj02ToBd09(gcjLng, gcjLat);
    gcjLng -= currBdLng - bdLng;
    gcjLat -= currBdLat - bdLat;
  }
  return [gcjLng, gcjLat];
}

/**
 * WGS84 -> BD-09 (原始GPS -> 百度)
 */
export function wgs84ToBd09(lng: number, lat: number): [number, number] {
  const [gcjLng, gcjLat] = wgs84ToGcj02(lng, lat);
  return gcj02ToBd09(gcjLng, gcjLat);
}

/**
 * BD-09 -> WGS84 (百度 -> 原始GPS)
 */
export function bd09ToWgs84(bdLng: number, bdLat: number): [number, number] {
  const [gcjLng, gcjLat] = bd09ToGcj02(bdLng, bdLat);
  return gcj02ToWgs84(gcjLng, gcjLat);
}
