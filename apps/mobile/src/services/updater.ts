import { AppVersionInfo, UpdateMirrorSource } from '@road-gis/shared';

// 当前客户端内置版本号
export const CURRENT_APP_VERSION = '1.2.0';
export const CURRENT_VERSION_CODE = 2;

/**
 * 严格语义化版本号比对函数 (Semver Compare)
 * 返回值：
 *   < 0 : v1 < v2 (存在更新)
 *   = 0 : v1 == v2 (已是最新)
 *   > 0 : v1 > v2 (当前版本更新)
 */
export function semverCompare(v1: string, v2: string): number {
  const clean1 = (v1 || '').trim().replace(/^v/i, '');
  const clean2 = (v2 || '').trim().replace(/^v/i, '');

  const parts1 = clean1.split('-')[0].split('.').map(Number);
  const parts2 = clean2.split('-')[0].split('.').map(Number);

  const maxLen = Math.max(parts1.length, parts2.length, 3);
  for (let i = 0; i < maxLen; i++) {
    const num1 = Number.isFinite(parts1[i]) ? parts1[i] : 0;
    const num2 = Number.isFinite(parts2[i]) ? parts2[i] : 0;
    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
  }
  return 0;
}

export interface CheckUpdateResult {
  hasUpdate: boolean;
  isForceUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  versionInfo?: AppVersionInfo;
  errorMessage?: string;
}

export class AppUpdaterService {
  private apiBaseUrl = typeof window !== 'undefined' ? (window as any).__API_BASE_URL__ || '/api/v1' : '/api/v1';

  /**
   * 检查服务端是否有新版本发布
   */
  async checkUpdate(currentVer: string = CURRENT_APP_VERSION): Promise<CheckUpdateResult> {
    try {
      const url = `${this.apiBaseUrl}/app/version?_t=${Date.now()}`;
      const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
      if (!res.ok) {
        throw new Error(`版本检查服务响应异常 (${res.status})`);
      }
      const json = await res.json();
      const versionInfo: AppVersionInfo = json.data;

      if (!versionInfo || !versionInfo.latest_version) {
        throw new Error('服务端返回的版本元数据格式不正确');
      }

      const cmp = semverCompare(currentVer, versionInfo.latest_version);
      const hasUpdate = cmp < 0;

      // 强制更新判断：服务端标志 或 当前版本低于系统要求的最低兼容版本
      const isBelowMin = versionInfo.min_supported_version
        ? semverCompare(currentVer, versionInfo.min_supported_version) < 0
        : false;
      const isForceUpdate = hasUpdate && (versionInfo.is_force_update || isBelowMin);

      return {
        hasUpdate,
        isForceUpdate,
        currentVersion: currentVer,
        latestVersion: versionInfo.latest_version,
        versionInfo
      };
    } catch (err: any) {
      console.warn('[AppUpdater] 检查更新失败:', err.message);
      return {
        hasUpdate: false,
        isForceUpdate: false,
        currentVersion: currentVer,
        latestVersion: currentVer,
        errorMessage: err.message || '网络连接超时'
      };
    }
  }

  /**
   * 顺序智能回退多源高速下载 APK
   */
  async downloadApk(
    mirrors: UpdateMirrorSource[],
    onProgress: (percent: number, speedText: string, activeMirror: UpdateMirrorSource) => void,
    signal?: AbortSignal,
    expectedSizeBytes?: number
  ): Promise<{ blob: Blob; mirror: UpdateMirrorSource }> {
    if (!mirrors || mirrors.length === 0) {
      throw new Error('未提供有效的安装包下载源');
    }

    let lastError: Error | null = null;

    for (const mirror of mirrors) {
      try {
        console.log(`[AppUpdater] 正在尝试下载源: ${mirror.name} (${mirror.url})`);
        const startTime = Date.now();
        let loadedBytes = 0;

        const response = await fetch(mirror.url, { signal, mode: 'cors' });
        if (!response.ok) {
          throw new Error(`HTTP 状态异常 ${response.status}`);
        }

        const contentLength = response.headers.get('content-length');
        const totalBytes = contentLength ? parseInt(contentLength, 10) : (expectedSizeBytes || 4195608);

        const reader = response.body?.getReader();
        if (!reader) {
          // 不支持流式读取，直接 arrayBuffer
          const buf = await response.arrayBuffer();
          onProgress(100, '下载完成', mirror);
          return { blob: new Blob([buf], { type: 'application/vnd.android.package-archive' }), mirror };
        }

        const chunks: Uint8Array[] = [];
        let lastSpeedSampleTime = startTime;
        let lastSampleBytes = 0;
        let currentSpeedText = '正在建立连接...';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            loadedBytes += value.length;

            const now = Date.now();
            if (now - lastSpeedSampleTime > 500) {
              const deltaSec = (now - lastSpeedSampleTime) / 1000;
              const deltaBytes = loadedBytes - lastSampleBytes;
              const speedMBps = (deltaBytes / (1024 * 1024)) / deltaSec;
              currentSpeedText = `${speedMBps.toFixed(2)} MB/s`;
              lastSpeedSampleTime = now;
              lastSampleBytes = loadedBytes;
            }

            const percent = Math.min(99, Math.round((loadedBytes / totalBytes) * 100));
            onProgress(percent, currentSpeedText, mirror);
          }
        }

        onProgress(100, '准备安装...', mirror);
        const completeBlob = new Blob(chunks as any[], { type: 'application/vnd.android.package-archive' });
        return { blob: completeBlob, mirror };
      } catch (err: any) {
        if (signal?.aborted) {
          throw new Error('下载已由用户取消');
        }
        console.warn(`[AppUpdater] 镜像源 [${mirror.name}] 下载失败，自动切换下一镜像:`, err.message);
        lastError = err;
      }
    }

    throw new Error(`所有安装包下载镜像均不可用，请检查网络设置或稍后再试 (末次错误: ${lastError?.message})`);
  }

  /**
   * 触发 Android 系统安装器或浏览器原生安装向导
   */
  installApk(blobOrUrl: Blob | string, fileName: string = 'road-patrol-latest.apk') {
    if (typeof blobOrUrl === 'string') {
      // 传入的是直接下载 URL (在手机外部浏览器打开，触发原生下载与安装)
      if (typeof window !== 'undefined') {
        window.open(blobOrUrl, '_system');
      }
      return;
    }

    // 传入的是 Blob 二进制
    if (typeof window !== 'undefined') {
      const blobUrl = URL.createObjectURL(blobOrUrl);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 释放 ObjectURL
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    }
  }
}

export const appUpdater = new AppUpdaterService();
