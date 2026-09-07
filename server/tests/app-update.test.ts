import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { Server } from 'node:http';

let server: Server;
let baseUrl: string;

function semverCompare(v1: string, v2: string): number {
  const clean1 = (v1 || '').trim().replace(/^v/i, '');
  const clean2 = (v2 || '').trim().replace(/^v/i, '');
  const parts1 = clean1.split('-')[0].split('.').map(Number);
  const parts2 = clean2.split('-')[0].split('.').map(Number);
  const maxLen = Math.max(parts1.length, parts2.length, 3);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
  }
  return 0;
}

test.before(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://localhost:${addr.port}/api/v1/app`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('Update Module: Semver comparison algorithm robustness', () => {
  // 1. 同版本
  assert.strictEqual(semverCompare('1.2.0', '1.2.0'), 0);
  assert.strictEqual(semverCompare('v1.2.0', '1.2.0'), 0);
  assert.strictEqual(semverCompare('V1.2.0', 'v1.2.0'), 0);

  // 2. 升小版本
  assert.ok(semverCompare('1.2.0', '1.2.1') < 0);
  assert.ok(semverCompare('1.2.0', '1.3.0') < 0);
  assert.ok(semverCompare('1.2.9', '1.3.0') < 0);

  // 3. 升大版本
  assert.ok(semverCompare('1.2.0', '2.0.0') < 0);

  // 4. 当前版本更新 (降级保护)
  assert.ok(semverCompare('1.3.0', '1.2.0') > 0);
  assert.ok(semverCompare('1.2.1', '1.2.0') > 0);
});

test('Update Module: Query latest version metadata & China mirror resolution', async () => {
  const res = await fetch(`${baseUrl}/version`);
  assert.strictEqual(res.status, 200);

  const body = await res.json();
  assert.strictEqual(body.code, 200);
  const data = body.data;

  // 校验必须字段
  assert.ok(data.latest_version);
  assert.ok(data.file_size_formatted);
  assert.ok(Array.isArray(data.release_notes) && data.release_notes.length > 0);
  assert.ok(Array.isArray(data.mirrors) && data.mirrors.length >= 4);

  // 校验针对中国用户的镜像体系
  const intranetMirror = data.mirrors.find((m: any) => m.id === 'intranet_server');
  assert.ok(intranetMirror, '必须提供公路管理处专网/局域网直连源');
  assert.strictEqual(intranetMirror.recommended, true, '管理处直连源应当默认优先推荐');

  const ghProxyMirror = data.mirrors.find((m: any) => m.id === 'domestic_ghproxy');
  assert.ok(ghProxyMirror, '必须提供国内免翻墙 GHProxy 加速源');
  assert.ok(ghProxyMirror.url.includes('ghproxy'), '国内加速源必须解析代理路由');

  const githubDirect = data.mirrors.find((m: any) => m.id === 'github_official');
  assert.ok(githubDirect, '必须提供 GitHub 官方源作为最终兜底');
});

test('Update Module: Mock newer version and verify force update flag', async () => {
  // 模拟远端发布重大安全升级 v1.3.0 且开启强制更新
  const res = await fetch(`${baseUrl}/version?mockVersion=1.3.0&mockForce=true`);
  assert.strictEqual(res.status, 200);

  const body = await res.json();
  assert.strictEqual(body.data.latest_version, '1.3.0');
  assert.strictEqual(body.data.is_force_update, true);

  // 镜像源中的 URL 应自动适配为 v1.3.0
  const ghProxy = body.data.mirrors.find((m: any) => m.id === 'domestic_ghproxy');
  assert.ok(ghProxy.url.includes('v1.3.0'));
});

test('Update Module: Download endpoint redirects or streams APK properly', async () => {
  // 测试 /api/v1/app/download/latest.apk 端点
  const res = await fetch(`${baseUrl}/download/latest.apk`, { redirect: 'manual' });
  
  // 如果本地没有打包的 APK 文件，服务端应执行 302 重定向到国内高速镜像
  // 如果本地存在物理 APK 文件，服务端应以 application/vnd.android.package-archive 流式输出
  if (res.status === 302) {
    const location = res.headers.get('location');
    assert.ok(location && (location.includes('ghproxy') || location.includes('github')));
  } else {
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'application/vnd.android.package-archive');
  }
});
