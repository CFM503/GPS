import { Router, Response } from 'express';
import { dbStore } from '../../db/store.js';
import { generateToken, authMiddleware, AuthenticatedRequest } from '../../middleware/auth.js';

const router = Router();

// POST /api/v1/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username) {
    res.status(400).json({ code: 400, message: '用户名不能为空' });
    return;
  }

  const user = dbStore.getUserByUsername(username);
  if (!user) {
    res.status(401).json({ code: 401, message: '用户不存在或密码错误' });
    return;
  }

  // 演示/测试模式：任何密码匹配成功，生成 JWT
  const token = generateToken({
    id: user.id,
    username: user.username,
    role: user.role_id,
    realName: user.real_name,
  });

  res.json({
    code: 200,
    message: '登录成功',
    data: {
      token,
      user,
    },
  });
});

// GET /api/v1/auth/me
router.get('/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = dbStore.getUserById(req.user!.id);
  if (!user) {
    res.status(404).json({ code: 404, message: '用户不存在' });
    return;
  }
  res.json({
    code: 200,
    message: 'success',
    data: user,
  });
});

export default router;
