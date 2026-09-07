import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import { config } from './config/index.js';
import authRouter from './modules/auth/router.js';
import patrolRouter from './modules/patrol/router.js';
import trackRouter from './modules/track/router.js';
import assetRouter from './modules/asset/router.js';
import photoRouter from './modules/photo/router.js';
import videoRouter from './modules/video/router.js';
import videoEventRouter from './modules/video-event/router.js';
import gisRouter from './modules/gis/router.js';
import maintenanceRouter from './modules/maintenance/router.js';
import statsRouter from './modules/stats/router.js';
import exportRouter from './modules/export/router.js';

export function createApp(): Express {
  const app = express();

  // 中间件配置
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 静态上传资源服务
  app.use('/uploads', express.static(config.uploadStorageDir));

  // 健康检查
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'UP',
      time: new Date().toISOString(),
      mapProvider: config.mapProvider,
      service: 'Road Asset GIS Intelligent Management System',
    });
  });

  // REST API v1 路由挂载
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/patrol', patrolRouter);
  app.use('/api/v1/tracks', trackRouter);
  app.use('/api/v1/assets', assetRouter);
  app.use('/api/v1/photos', photoRouter);
  app.use('/api/v1/videos', videoRouter);
  app.use('/api/v1/video-events', videoEventRouter);
  app.use('/api/v1/gis', gisRouter);
  app.use('/api/v1/maintenance', maintenanceRouter);
  app.use('/api/v1/stats', statsRouter);
  app.use('/api/v1/export', exportRouter);

  // 全局 404
  app.use((req: Request, res: Response) => {
    res.status(404).json({ code: 404, message: `Route ${req.method} ${req.originalUrl} not found` });
  });

  // 全局异常处理
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('[Server Error]', err);
    res.status(500).json({ code: 500, message: err.message || 'Internal Server Error' });
  });

  return app;
}
