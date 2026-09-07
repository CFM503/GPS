import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { AppVersionInfo, UpdateMirrorSource } from '@road-gis/shared';
import { config } from '../../config/index.js';

const router = Router();

// 默认生产发布元数据
let currentAppVersion: AppVersionInfo = {
  latest_version: '1.2.0',
  version_code: 2,
  min_supported_version: '1.0.0',
  is_force_update: false,
  title: '道路路产智能巡查移动端 v1.2.0',
  release_notes: [
    '1. 真实 Android 硬件 GNSS 芯片定位与精度状态监控',
    '2. 8 大驾驶安全触控大按钮，行车秒级快速标记路产',
    '3. 现场实景照片抓拍与 5 分钟循环切片录像',
    '4. 离线优先架构：支持飞行模式完全断网巡查与 IndexedDB 灾备落盘',
    '5. 恢复网络 5 级优先级自动重试同步与断点续传',
    '6. 新增国内多源在线自动更新机制'
  ],
  publish_time: '2026-09-07T12:00:00Z',
  file_size_bytes: 4195608,
  file_size_formatted: '4.19 MB',
  apk_hash_sha256: '414390d5d8f64baa78898d8c13902b27bf8e8e890b269e47e8bbd55f622adbdf',
  download_url: '/api/v1/app/download/latest.apk',
  mirrors: []
};

// 动态生成多镜像源列表
function getMirrors(reqHost: string, version: string): UpdateMirrorSource[] {
  const cleanVer = version.startsWith('v') ? version : `v${version}`;
  return [
    {
      id: 'intranet_server',
      name: '公路管理处直连源 (专网/内网首选，极速下载)',
      url: `${reqHost}/api/v1/app/download/latest.apk`,
      network_type: 'INTRANET',
      recommended: true
    },
    {
      id: 'domestic_ghproxy',
      name: '国内加速镜像源 (GHProxy 国内免翻墙加速)',
      url: `https://mirror.ghproxy.com/https://github.com/CFM503/GPS/releases/download/${cleanVer}/app-debug.apk`,
      network_type: 'DOMESTIC_MIRROR',
      recommended: false
    },
    {
      id: 'domestic_ghproxy_net',
      name: '国内备用加速源 (GHProxy.net 节点)',
      url: `https://ghproxy.net/https://github.com/CFM503/GPS/releases/download/${cleanVer}/app-debug.apk`,
      network_type: 'DOMESTIC_MIRROR',
      recommended: false
    },
    {
      id: 'github_official',
      name: 'GitHub 官方直链 (海外/公网兜底)',
      url: `https://github.com/CFM503/GPS/releases/download/${cleanVer}/app-debug.apk`,
      network_type: 'OFFICIAL_DIRECT',
      recommended: false
    }
  ];
}

// GET /api/v1/app/version (检查最新版本)
router.get('/version', (req, res) => {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost:3000';
  const reqHost = `${protocol}://${host}`;

  // 支持测试环境 mock 最新版本参数
  const mockVersion = req.query.mockVersion as string;
  const mockForce = req.query.mockForce === 'true';

  const version = mockVersion || currentAppVersion.latest_version;
  const mirrors = getMirrors(reqHost, version);

  const responseData: AppVersionInfo = {
    ...currentAppVersion,
    latest_version: version,
    is_force_update: mockForce || currentAppVersion.is_force_update,
    download_url: mirrors[0].url,
    mirrors
  };

  res.json({
    code: 200,
    message: 'success',
    data: responseData
  });
});

// POST /api/v1/app/version/mock (用于自动化测试和后台发布新版本)
router.post('/version/mock', (req, res) => {
  const { latest_version, min_supported_version, is_force_update, release_notes } = req.body;
  if (latest_version) currentAppVersion.latest_version = latest_version;
  if (min_supported_version) currentAppVersion.min_supported_version = min_supported_version;
  if (is_force_update !== undefined) currentAppVersion.is_force_update = is_force_update;
  if (release_notes) currentAppVersion.release_notes = release_notes;

  res.json({
    code: 200,
    message: '版本元数据更新成功',
    data: currentAppVersion
  });
});

// GET /api/v1/app/download/latest.apk (下载最新安装包)
router.get('/download/latest.apk', (req, res) => {
  // 查找本地存储的 APK 文件
  const candidatePaths = [
    path.join(config.uploadStorageDir, 'app-debug.apk'),
    path.resolve(process.cwd(), 'uploads/app-debug.apk'),
    path.resolve(process.cwd(), '../uploads/app-debug.apk'),
    path.resolve(process.cwd(), 'apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk'),
    path.resolve(process.cwd(), '../apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk')
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="road-patrol-v${currentAppVersion.latest_version}.apk"`);
      fs.createReadStream(p).pipe(res);
      return;
    }
  }

  // 本地未找到物理 APK 文件时，智能重定向至国内最快镜像
  const cleanVer = currentAppVersion.latest_version.startsWith('v')
    ? currentAppVersion.latest_version
    : `v${currentAppVersion.latest_version}`;
  const redirectUrl = `https://mirror.ghproxy.com/https://github.com/CFM503/GPS/releases/download/${cleanVer}/app-debug.apk`;
  
  res.redirect(302, redirectUrl);
});

export default router;
