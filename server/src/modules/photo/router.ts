import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { dbStore } from '../../db/store.js';
import { config } from '../../config/index.js';
import { AssetPhoto } from '@road-gis/shared';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadStorageDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `PHOTO_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB limit

// POST /api/v1/photos/upload
router.post('/upload', upload.single('photo'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ code: 400, message: '未包含图片文件' });
    return;
  }

  const { assetId, sessionId, latitude, longitude, azimuth, photoTime } = req.body;
  const photo: AssetPhoto = {
    id: crypto.randomUUID(),
    asset_id: assetId || '',
    session_id: sessionId || '',
    file_name: req.file.filename,
    storage_path: req.file.path,
    storage_url: `/uploads/${req.file.filename}`,
    file_size_bytes: req.file.size,
    photo_time: photoTime || new Date().toISOString(),
    latitude: latitude ? parseFloat(latitude) : undefined,
    longitude: longitude ? parseFloat(longitude) : undefined,
    azimuth: azimuth ? parseFloat(azimuth) : undefined,
  };

  dbStore.addPhoto(photo);

  res.status(201).json({
    code: 201,
    message: '照片上传成功',
    data: photo,
  });
});

// GET /api/v1/photos/asset/:assetId
router.get('/asset/:assetId', (req, res) => {
  const photos = dbStore.getPhotosByAsset(req.params.assetId);
  res.json({
    code: 200,
    message: 'success',
    data: photos,
  });
});

export default router;
