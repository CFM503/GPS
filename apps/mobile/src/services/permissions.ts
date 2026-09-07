/**
 * Android 移动端运行权限管理器
 * 遵循现代 Android 权限设计规范：
 * 首次使用 -> 解释业务用途 -> 用户授权 -> 优雅降级处理拒绝状态
 */

export interface PermissionStatusResult {
  location: 'granted' | 'denied' | 'prompt' | 'unknown';
  camera: 'granted' | 'denied' | 'prompt' | 'unknown';
  microphone: 'granted' | 'denied' | 'prompt' | 'unknown';
}

class PermissionManager {
  /**
   * 检查核心权限当前授权状态
   */
  async checkPermissions(): Promise<PermissionStatusResult> {
    const result: PermissionStatusResult = {
      location: 'unknown',
      camera: 'unknown',
      microphone: 'unknown',
    };

    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      try {
        const loc = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        result.location = loc.state as any;
      } catch {
        result.location = 'unknown';
      }
    }

    return result;
  }

  /**
   * 请求定位权限 (含用户友好引导说明)
   */
  async requestLocationPermission(): Promise<{ granted: boolean; message: string }> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return {
        granted: false,
        message: '当前设备不支持 GPS 定位硬件或浏览器禁用了定位接口',
      };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            granted: true,
            message: `定位授权成功 (当前精度: ${pos.coords.accuracy?.toFixed(1) || 5}m)`,
          });
        },
        (err) => {
          let msg = '定位权限请求失败';
          switch (err.code) {
            case err.PERMISSION_DENIED:
              msg = '定位权限已被用户拒绝。系统将无法获取真实行车轨迹，请在 Android“系统设置 -> 应用权限”中开启【精准位置信息】';
              break;
            case err.POSITION_UNAVAILABLE:
              msg = 'GPS 位置暂不可用。请确认已在车载手机顶部下拉栏开启【位置信息/GPS】硬件开关';
              break;
            case err.TIMEOUT:
              msg = 'GPS 搜星定位超时，正在持续重试中...';
              break;
          }
          resolve({ granted: false, message: msg });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }

  /**
   * 请求摄像头与麦克风权限 (录像与拍照用途)
   */
  async requestMediaPermissions(): Promise<{ camera: boolean; microphone: boolean; message: string }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        camera: false,
        microphone: false,
        message: '当前环境不支持摄像头直接调用 (可使用文件相机选择拍照)',
      };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      });

      // 成功获得媒体流后立即安全关闭，防止后台一直占用摄像头
      stream.getTracks().forEach((track) => track.stop());

      return {
        camera: true,
        microphone: true,
        message: '相机与麦克风授权成功，行车录像与路产拍照已就绪',
      };
    } catch (err: any) {
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      const msg = isDenied
        ? '相机/麦克风权限被拒绝。录像功能将无法使用，请在 Android“系统设置 -> 应用权限”中允许【相机】和【麦克风】'
        : `相机调用异常: ${err.message || '未知错误'}`;

      return {
        camera: false,
        microphone: false,
        message: msg,
      };
    }
  }
}

export const permissionManager = new PermissionManager();
