import { wgs84ToGcj02, wgs84ToBd09 } from '@road-gis/shared';

export interface MapOptions {
  center: [number, number]; // [lng, lat] WGS84
  zoom: number;
}

export interface MapProvider {
  readonly name: string;
  init(container: HTMLElement, options: MapOptions): Promise<void>;
  convertCoordinate(lng: number, lat: number): [number, number];
  reverseGeocode(lng: number, lat: number): Promise<string>;
  searchPOI(keyword: string): Promise<Array<{ title: string; point: [number, number] }>>;
  setCenter(lng: number, lat: number, zoom?: number): void;
  destroy(): void;
}

/**
 * 高德地图适配器 (AMAP)
 */
export class AmapProvider implements MapProvider {
  readonly name = 'AMAP';
  private container: HTMLElement | null = null;

  async init(container: HTMLElement, options: MapOptions): Promise<void> {
    this.container = container;
    // 渲染高德底图占位或动态加载 AMap SDK
    const [gcjLng, gcjLat] = this.convertCoordinate(options.center[0], options.center[1]);
    console.log(`[AmapProvider] Initialized at GCJ-02: [${gcjLng}, ${gcjLat}], zoom: ${options.zoom}`);
  }

  convertCoordinate(lng: number, lat: number): [number, number] {
    return wgs84ToGcj02(lng, lat);
  }

  async reverseGeocode(lng: number, lat: number): Promise<string> {
    const [gLng, gLat] = this.convertCoordinate(lng, lat);
    return `广东省广州市白云区 G105 国道附近 (${gLng.toFixed(4)}, ${gLat.toFixed(4)})`;
  }

  async searchPOI(keyword: string): Promise<Array<{ title: string; point: [number, number] }>> {
    return [
      { title: `G105国道 - ${keyword}路口`, point: [113.2501, 23.1001] },
      { title: `G105国道服务区`, point: [113.3101, 23.2101] },
    ];
  }

  setCenter(lng: number, lat: number, zoom?: number): void {
    const [gLng, gLat] = this.convertCoordinate(lng, lat);
    console.log(`[AmapProvider] Center updated to [${gLng}, ${gLat}], zoom: ${zoom}`);
  }

  destroy(): void {
    this.container = null;
  }
}

/**
 * 百度地图适配器 (BAIDU)
 */
export class BaiduProvider implements MapProvider {
  readonly name = 'BAIDU';
  private container: HTMLElement | null = null;

  async init(container: HTMLElement, options: MapOptions): Promise<void> {
    this.container = container;
    const [bdLng, bdLat] = this.convertCoordinate(options.center[0], options.center[1]);
    console.log(`[BaiduProvider] Initialized at BD-09: [${bdLng}, ${bdLat}], zoom: ${options.zoom}`);
  }

  convertCoordinate(lng: number, lat: number): [number, number] {
    return wgs84ToBd09(lng, lat);
  }

  async reverseGeocode(lng: number, lat: number): Promise<string> {
    const [bLng, bLat] = this.convertCoordinate(lng, lat);
    return `百度地名: G105 京澳线段 (${bLng.toFixed(4)}, ${bLat.toFixed(4)})`;
  }

  async searchPOI(keyword: string): Promise<Array<{ title: string; point: [number, number] }>> {
    return [{ title: `百度POI: ${keyword}`, point: [113.2505, 23.1005] }];
  }

  setCenter(lng: number, lat: number, zoom?: number): void {
    const [bLng, bLat] = this.convertCoordinate(lng, lat);
    console.log(`[BaiduProvider] Center updated to [${bLng}, ${bLat}], zoom: ${zoom}`);
  }

  destroy(): void {
    this.container = null;
  }
}

/**
 * 工厂方法
 */
export function createMapProvider(providerName: string = 'AMAP'): MapProvider {
  switch (providerName.toUpperCase()) {
    case 'BAIDU':
      return new BaiduProvider();
    case 'AMAP':
    default:
      return new AmapProvider();
  }
}
