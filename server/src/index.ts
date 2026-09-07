import { createApp } from './app.js';
import { config } from './config/index.js';

const app = createApp();

const server = app.listen(config.port, config.host, () => {
  console.log(`================================================================`);
  console.log(`🚀 道路路产智能巡查与 GIS 管理系统 (Road Asset System) 服务已启动`);
  console.log(`📡 服务地址: http://${config.host}:${config.port}`);
  console.log(`🗺️ 激活底图引擎: ${config.mapProvider}`);
  console.log(`💾 数据存储目录: ${config.uploadStorageDir}`);
  console.log(`================================================================`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
