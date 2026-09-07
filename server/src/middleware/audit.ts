import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';
import { dbStore } from '../db/store.js';

export function auditMiddleware(moduleName: string, actionName: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // 监听响应结束，记录审计日志
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        dbStore.addAuditLog({
          userId: req.user?.id,
          username: req.user?.username || 'anonymous',
          ipAddress: req.ip || req.socket.remoteAddress,
          module: moduleName,
          action: actionName,
          targetId: req.params.id || (req.body && req.body.id),
          details: {
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
          },
        });
      }
    });
    next();
  };
}
