# 数据库设计说明书 (DATABASE.md)

---

## 1. 数据库技术选型与规范
- **主数据库**：PostgreSQL 15+ 配合 PostGIS 3+ 空间扩展。
- **坐标系**：所有空间几何字段统一采用 **WGS84 经纬度地理坐标系 (EPSG:4326)**。
- **空间索引**：所有 geometry 列强制创建 `GIST` 空间索引。
- **主键规范**：分布式或离线场景核心业务表采用 `UUID` 或业务前缀格式（如 `PAT-20260907-0001`），保证客户端离线生成不冲突。

---

## 2. 核心数据表结构

### 2.1 用户、角色与组织 (`users`, `roles`, `audit_logs`)
- `roles`：角色表 (`super_admin`, `bureau_admin`, `patroller`, `auditor`, `maintainer`, `viewer`)。
- `users`：账号、密码Hash、姓名、电话、所属管理处。
- `audit_logs`：全量关键业务审计日志（操作人、模块、动作、IP、旧值、新值、发生时间）。

### 2.2 道路与路网基础设施 (`roads`, `road_sections`)
- `roads`：
  - `id`: UUID
  - `code`: 道路编号（如 `G105`）
  - `name`: 道路全称（如 `京澳线`）
  - `level`: 公路等级（高速公路、一级公路、国道、省道、县道）
  - `start_milepost`: 起点桩号 (米制浮点数，如 120000.0 代表 K120+000)
  - `end_milepost`: 终点桩号 (米制浮点数，如 180000.0 代表 K180+000)
  - `total_length_km`: 路线总里程
  - `centerline_geom`: `GEOMETRY(LineString, 4326)` 道路高精度中心线空间折线
  - `created_at`, `updated_at`

### 2.3 巡查会话与高频轨迹 (`patrol_sessions`, `patrol_tracks`)
- `patrol_sessions`：
  - `id`: VARCHAR(64) 主键（如 `PAT-20260907-0001`）
  - `user_id`: 巡查员用户 ID
  - `user_name`: 巡查员姓名
  - `vehicle_plate`: 车牌号码（如 `粤A12345`）
  - `road_id`: 关联道路 ID
  - `road_code`: 道路编号快照
  - `status`: 状态 (`IN_PROGRESS`, `COMPLETED`, `CANCELLED`)
  - `start_time`: 巡查启动绝对时间
  - `end_time`: 巡查结束时间
  - `distance_km`: 巡查累计总里程
  - `asset_count`: 采集路产总数
  - `anomaly_count`: 发现异常总数
  - `video_count`: 录像切片总数
  - `trajectory_geom`: `GEOMETRY(LineString, 4326)` 巡查结束后自动拟合的巡查轨迹折线
  - `sync_status`: `PENDING` / `UPLOADED`
  - `created_at`, `updated_at`

- `patrol_tracks`：
  - `id`: BIGSERIAL 主键
  - `session_id`: 关联巡查会话编号
  - `point_time`: 打点绝对时间
  - `latitude`: WGS84 原始纬度
  - `longitude`: WGS84 原始经度
  - `geom`: `GEOMETRY(Point, 4326)` 空间点
  - `speed_kmh`: 瞬时时速 (km/h)
  - `heading`: 航向角 (0°~360°)
  - `altitude`: 海拔高度 (米)
  - `accuracy`: 水平定位精度 (米)
  - `provider`: 定位来源 (`gps`, `network`)
  - `is_valid`: 是否有效点（漂移清洗标记）

### 2.4 路产类型与路产核心表 (`asset_types`, `assets`, `asset_photos`)
- `asset_types`：
  - `id`: VARCHAR(32) 主键（如 `TRAFFIC_SIGN`, `MILEPOST`, `GUARDRAIL`, `TREE`, `DISEASE`）
  - `name`: 显示名称（标识牌、百米桩、护栏、绿化林木、道路病害等）
  - `geometry_type`: 支持的几何类型 (`POINT`, `LINESTRING`, `POLYGON`)
  - `category`: 分类 (`FACILITY`, `SAFETY`, `GREENING`, `PAVEMENT`, `STRUCTURE`)
  - `icon`: 前端地图展示图标标识
  - `color`: 图层渲染颜色代码
  - `schema_props`: JSONB 扩展自定义属性元数据定义

- `assets`：
  - `id`: UUID 主键
  - `asset_code`: 路产资产唯一编码（如 `ASSET-G105-K127-001`）
  - `type_id`: 关联 `asset_types.id`
  - `road_id`: 关联道路 ID
  - `geom`: `GEOMETRY(Geometry, 4326)` 空间几何体（支持 POINT、LINESTRING、POLYGON）
  - `latitude`: WGS84 代表纬度
  - `longitude`: WGS84 代表经度
  - `milepost`: 标称桩号字符串（如 `K127+350`）
  - `milepost_meters`: 桩号米制数值（如 127350）
  - `direction`: 道路方向 (`UP` 上行, `DOWN` 下行, `BIDIRECTIONAL` 双向)
  - `status`: 当前物理状态 (`NORMAL`, `ABNORMAL`, `DAMAGED`, `MISSING`, `MAINTAINING`, `REPAIRED`, `REVOKED`)
  - `audit_status`: 审核生命周期 (`PENDING_REVIEW`, `APPROVED`, `REJECTED`)
  - `description`: 描述与现场记录
  - `discovery_time`: 发现绝对时间戳
  - `patrol_session_id`: 采集所属巡查会话
  - `video_slice_id`: 对应视频切片 ID
  - `video_offset_seconds`: 在视频切片中的精确定位偏移秒数
  - `created_by`: 采集人 ID
  - `created_at`, `updated_at`

- `asset_photos`：
  - `id`: UUID 主键
  - `asset_id`: 关联路产 ID
  - `session_id`: 关联巡查会话
  - `storage_path`: 对象存储路径
  - `thumbnail_path`: 缩略图路径
  - `photo_time`: 拍照绝对时间
  - `geom`: `GEOMETRY(Point, 4326)`
  - `angle`: 拍摄视角
  - `file_size`: 文件字节数

### 2.5 视频切片管理表 (`video_slices`, `video_upload_chunks`)
- `video_slices`：
  - `id`: VARCHAR(64) 主键（如 `VID-PAT20260907-001`）
  - `session_id`: 关联巡查会话
  - `file_name`: 原始文件名（如 `VIDEO_001.mp4`）
  - `start_time`: 录像开始绝对时间
  - `end_time`: 录像结束绝对时间
  - `duration_seconds`: 视频时长（秒）
  - `file_size_bytes`: 文件字节总大小
  - `storage_path`: MinIO/S3 实际对象存储路径
  - `upload_status`: 上传状态 (`PENDING`, `UPLOADING`, `COMPLETED`, `FAILED`)
  - `uploaded_bytes`: 当前已完成续传字节数
  - `md5_checksum`: 文件校验和

- `upload_tasks`：
  - `id`: UUID 主键
  - `session_id`: 会话编号
  - `task_type`: 任务类型 (`SESSION`, `TRACK`, `ASSET`, `PHOTO`, `VIDEO`)
  - `priority`: 优先级 (1~5，1为最高)
  - `status`: `PENDING`, `UPLOADING`, `COMPLETED`, `FAILED`
  - `retry_count`: 重试次数
  - `error_message`: 最后一次错误信息

### 2.6 维修工单与处置流转 (`maintenance_records`)
- `maintenance_records`：
  - `id`: UUID 主键
  - `asset_id`: 关联路产
  - `issue_type`: 问题类型
  - `severity`: 严重等级 (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
  - `reported_at`: 报告时间
  - `reported_by`: 报告巡查员
  - `status`: `REPORTED`, `ASSIGNED`, `IN_REPAIR`, `REPAIRED`, `VERIFIED`, `CLOSED`
  - `assigned_to`: 指派维修人员
  - `repair_description`: 维修说明
  - `repair_photo_before`: 维修前照片
  - `repair_photo_after`: 维修后照片
  - `completed_at`: 修复完成时间
