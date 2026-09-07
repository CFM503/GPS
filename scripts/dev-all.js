import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

// 终端 ANSI 颜色常量
const colors = {
  reset: '\x1b[0m',
  server: '\x1b[34m',  // 蓝色
  web: '\x1b[36m',     // 青色
  mobile: '\x1b[32m',  // 绿色
  bold: '\x1b[1m',
};

const services = [
  {
    name: 'SERVER:3000',
    color: colors.server,
    args: ['run', 'dev', '--workspace=server'],
  },
  {
    name: 'WEB:5173   ',
    color: colors.web,
    args: ['run', 'dev', '--workspace=apps/web'],
  },
  {
    name: 'MOBILE:3001',
    color: colors.mobile,
    args: ['run', 'dev', '--workspace=apps/mobile'],
  },
];

console.log('================================================================');
console.log(`${colors.bold}🚀 正在一键并行启动道路路产智能巡查与 GIS 管理系统全套服务...${colors.reset}`);
console.log(`📡 后端 API 服务:     http://localhost:3000`);
console.log(`🗺️ Web GIS 管理平台:  http://localhost:5173`);
console.log(`📱 车载移动巡查终端:  http://localhost:3001`);
console.log('================================================================\n');

const children = [];

for (const svc of services) {
  const child = spawn(npmCmd, svc.args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  children.push(child);

  const prefix = `${svc.color}[${svc.name}]${colors.reset} `;

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${prefix}${line}`);
      }
    }
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.error(`${prefix}${line}`);
      }
    }
  });

  child.on('close', (code) => {
    console.log(`${prefix}服务已退出 (code: ${code})`);
  });
}

function cleanup() {
  console.log('\n正在优雅终止所有子服务...');
  for (const child of children) {
    if (!child.killed) {
      if (isWin) {
        spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t']);
      } else {
        child.kill('SIGTERM');
      }
    }
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
