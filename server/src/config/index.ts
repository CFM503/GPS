import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 尝试加载根目录与本地 .env 文件
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || '3000'}`,

  // 数据库与 GIS
  databaseUrl: process.env.DATABASE_URL || 'postgres://gis_user:gis_secret_password@localhost:5432/road_gis_db',
  mapProvider: (process.env.MAP_PROVIDER || 'AMAP').toUpperCase(),
  amapKey: process.env.AMAP_KEY || '',
  amapSecurityCode: process.env.AMAP_SECURITY_CODE || '',
  baiduKey: process.env.BAIDU_KEY || '',

  // 对象存储 (MinIO / S3)
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
    bucket: process.env.S3_BUCKET || 'road-assets',
    region: process.env.S3_REGION || 'us-east-1',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },

  // 安全与认证
  jwtSecret: process.env.JWT_SECRET || 'gis_road_asset_jwt_secret_key_2026_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // 文件与断点续传临时目录
  uploadTempDir: path.resolve(__dirname, '../../../uploads/temp'),
  uploadStorageDir: path.resolve(__dirname, '../../../uploads/storage'),
  videoMaxChunkSizeMb: parseInt(process.env.VIDEO_MAX_CHUNK_SIZE_MB || '50', 10),
};
