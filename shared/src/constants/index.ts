/**
 * 道路路产系统 - 全局枚举与常量定义
 */

export const ASSET_GEOMETRY_TYPES = {
  POINT: 'POINT',
  LINESTRING: 'LINESTRING',
  POLYGON: 'POLYGON',
} as const;
export type AssetGeometryType = typeof ASSET_GEOMETRY_TYPES[keyof typeof ASSET_GEOMETRY_TYPES];

export const ASSET_STATUSES = {
  NORMAL: 'NORMAL',         // 正常
  ABNORMAL: 'ABNORMAL',     // 异常
  DAMAGED: 'DAMAGED',       // 损坏
  MISSING: 'MISSING',       // 缺失
  MAINTAINING: 'MAINTAINING', // 维修中
  REPAIRED: 'REPAIRED',     // 已修复
  REVOKED: 'REVOKED',       // 已注销
} as const;
export type AssetStatus = typeof ASSET_STATUSES[keyof typeof ASSET_STATUSES];

export const PATROL_STATUSES = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type PatrolStatus = typeof PATROL_STATUSES[keyof typeof PATROL_STATUSES];

export const SYNC_STATUSES = {
  PENDING: 'PENDING',
  UPLOADING: 'UPLOADING',
  UPLOADED: 'UPLOADED',
  FAILED: 'FAILED',
} as const;
export type SyncStatus = typeof SYNC_STATUSES[keyof typeof SYNC_STATUSES];

export const UPLOAD_PRIORITIES = {
  SESSION: 1,  // 第一优先级：巡查会话摘要
  TRACK: 2,    // 第二优先级：GPS轨迹
  ASSET: 3,    // 第三优先级：路产
  PHOTO: 4,    // 第四优先级：现场照片
  VIDEO: 5,    // 第五优先级：视频切片
} as const;
export type UploadPriority = typeof UPLOAD_PRIORITIES[keyof typeof UPLOAD_PRIORITIES];

export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  BUREAU_ADMIN: 'bureau_admin',
  PATROLLER: 'patroller',
  AUDITOR: 'auditor',
  MAINTAINER: 'maintainer',
  VIEWER: 'viewer',
} as const;
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
