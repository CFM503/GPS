import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@road-gis/shared';
import { config } from '../config/index.js';
import { dbStore } from '../db/store.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: UserRole;
    realName: string;
  };
}

export function generateToken(payload: { id: string; username: string; role: UserRole; realName: string }): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // 允许离线/开发模式下的模拟用户
    const devUserId = req.headers['x-dev-user-id'] as string;
    if (devUserId) {
      const user = dbStore.getUserById(devUserId) || dbStore.getUserByUsername(devUserId);
      if (user) {
        req.user = { id: user.id, username: user.username, role: user.role_id, realName: user.real_name };
        return next();
      }
    }
    res.status(401).json({ code: 401, message: '未提供有效认证凭据 (Missing Bearer Token)' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { id: string; username: string; role: UserRole; realName: string };
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ code: 401, message: '认证令牌无效或已过期 (Invalid or expired token)' });
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ code: 401, message: '未登录认证' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ code: 403, message: '无访问权限 (Forbidden role)' });
      return;
    }
    next();
  };
}
