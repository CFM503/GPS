-- ==============================================================================
-- 道路路产智能巡查与 GIS 管理系统 - 数据库定义 DDL (PostgreSQL 15 + PostGIS 3)
-- 坐标系统：统一采用 WGS84 经纬度地理空间坐标系 (EPSG:4326)
-- ==============================================================================

-- 启用 PostGIS 空间扩展
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. 基础权限与组织架构表
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    real_name VARCHAR(64) NOT NULL,
    role_id VARCHAR(32) NOT NULL REFERENCES roles(id),
    phone VARCHAR(32),
    department VARCHAR(128) DEFAULT '道路养护与路产管理处',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 2. 道路与路段基础设施表
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS roads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(32) UNIQUE NOT NULL,            -- 道路编号，如 G105, S214
    name VARCHAR(128) NOT NULL,                  -- 道路名称，如 京澳线
    level VARCHAR(32) NOT NULL DEFAULT '国道',   -- 高速公路 / 一级公路 / 国道 / 省道 / 县道
    start_milepost DOUBLE PRECISION NOT NULL,    -- 起点桩号 (米制, 例如 120000 代表 K120+000)
    end_milepost DOUBLE PRECISION NOT NULL,      -- 终点桩号 (米制, 例如 180000 代表 K180+000)
    total_length_km DOUBLE PRECISION NOT NULL,   -- 总里程 (公里)
    centerline_geom GEOMETRY(LineString, 4326) NOT NULL, -- 道路高精度中心线
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roads_centerline_gist ON roads USING GIST(centerline_geom);

CREATE TABLE IF NOT EXISTS road_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    road_id UUID NOT NULL REFERENCES roads(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    start_milepost DOUBLE PRECISION NOT NULL,
    end_milepost DOUBLE PRECISION NOT NULL,
    section_geom GEOMETRY(LineString, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 3. 路产类型字典元数据 (支持动态扩展与点/线/面几何形态)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS asset_types (
    id VARCHAR(32) PRIMARY KEY,                  -- 类型标识：TRAFFIC_SIGN, MILEPOST, GUARDRAIL, TREE, DISEASE...
    name VARCHAR(64) NOT NULL,                   -- 显示名称：交通标识牌, 百米桩, 波形梁护栏, 绿化林木, 道路病害...
    geometry_type VARCHAR(16) NOT NULL CHECK (geometry_type IN ('POINT', 'LINESTRING', 'POLYGON')),
    category VARCHAR(32) NOT NULL DEFAULT 'FACILITY', -- FACILITY(设施), SAFETY(安防), GREENING(绿化), PAVEMENT(路面), STRUCTURE(结构)
    icon VARCHAR(64) NOT NULL DEFAULT 'tag',
    color VARCHAR(16) NOT NULL DEFAULT '#3B82F6',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 4. 巡查任务与巡查会话 (Patrol Session 聚合核心)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS patrol_sessions (
    id VARCHAR(64) PRIMARY KEY,                  -- 巡查会话编号：PAT-20260907-0001
    user_id UUID REFERENCES users(id),
    user_name VARCHAR(64) NOT NULL,              -- 巡查员快照
    vehicle_plate VARCHAR(32) NOT NULL,          -- 车辆车牌，如 粤A12345
    road_id UUID REFERENCES roads(id),
    road_code VARCHAR(32) NOT NULL,              -- 道路编号快照
    status VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    distance_km DOUBLE PRECISION DEFAULT 0.0,
    asset_count INTEGER DEFAULT 0,
    anomaly_count INTEGER DEFAULT 0,
    video_count INTEGER DEFAULT 0,
    trajectory_geom GEOMETRY(LineString, 4326),  -- 巡查结束后拟合的实际巡查轨迹折线
    sync_status VARCHAR(32) DEFAULT 'UPLOADED' CHECK (sync_status IN ('PENDING', 'UPLOADING', 'UPLOADED', 'FAILED')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patrol_sessions_traj_gist ON patrol_sessions USING GIST(trajectory_geom);
CREATE INDEX IF NOT EXISTS idx_patrol_sessions_road ON patrol_sessions(road_id);
CREATE INDEX IF NOT EXISTS idx_patrol_sessions_time ON patrol_sessions(start_time);

-- ------------------------------------------------------------------------------
-- 5. 高频 GPS 连续轨迹明细表
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS patrol_tracks (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES patrol_sessions(id) ON DELETE CASCADE,
    point_time TIMESTAMP WITH TIME ZONE NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,          -- WGS84 原始纬度
    longitude DOUBLE PRECISION NOT NULL,         -- WGS84 原始经度
    geom GEOMETRY(Point, 4326) NOT NULL,         -- WGS84 空间点
    speed_kmh DOUBLE PRECISION DEFAULT 0.0,      -- 瞬时速度
    heading DOUBLE PRECISION DEFAULT 0.0,        -- 航向角 (0-360)
    altitude DOUBLE PRECISION DEFAULT 0.0,       -- 海拔
    accuracy DOUBLE PRECISION NOT NULL,          -- 水平精度 (米)
    provider VARCHAR(16) DEFAULT 'gps',          -- 信号来源
    is_valid BOOLEAN DEFAULT TRUE,               -- 漂移清洗标记
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patrol_tracks_geom_gist ON patrol_tracks USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_patrol_tracks_session_time ON patrol_tracks(session_id, point_time);

-- ------------------------------------------------------------------------------
-- 6. 视频切片登记与存储映射表
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS video_slices (
    id VARCHAR(64) PRIMARY KEY,                  -- VID-PAT20260907-001
    session_id VARCHAR(64) NOT NULL REFERENCES patrol_sessions(id) ON DELETE CASCADE,
    file_name VARCHAR(128) NOT NULL,             -- VIDEO_001.mp4
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,-- 视频切片开始绝对时间
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,  -- 视频切片结束绝对时间
    duration_seconds DOUBLE PRECISION NOT NULL,  -- 视频时长
    file_size_bytes BIGINT NOT NULL,             -- 文件大小
    width INTEGER DEFAULT 1920,
    height INTEGER DEFAULT 1080,
    storage_path VARCHAR(512),                   -- S3 / MinIO 对象键
    storage_url VARCHAR(512),                    -- 访问 URL
    upload_status VARCHAR(32) DEFAULT 'PENDING' CHECK (upload_status IN ('PENDING', 'UPLOADING', 'COMPLETED', 'FAILED')),
    uploaded_bytes BIGINT DEFAULT 0,             -- 断点续传已接收字节
    md5_checksum VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_video_slices_session ON video_slices(session_id);
CREATE INDEX IF NOT EXISTS idx_video_slices_time_window ON video_slices(start_time, end_time);

-- ------------------------------------------------------------------------------
-- 7. 路产核心业务表 (支持 POINT / LINESTRING / POLYGON 空间要素)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_code VARCHAR(64) UNIQUE NOT NULL,      -- 统一资产编码，如 ASSET-G105-K127-001
    type_id VARCHAR(32) NOT NULL REFERENCES asset_types(id),
    road_id UUID NOT NULL REFERENCES roads(id),
    geom GEOMETRY(Geometry, 4326) NOT NULL,      -- 统一空间几何列 (Point/LineString/Polygon)
    latitude DOUBLE PRECISION NOT NULL,          -- 锚点/代表中心点纬度 (WGS84)
    longitude DOUBLE PRECISION NOT NULL,         -- 锚点/代表中心点经度 (WGS84)
    milepost VARCHAR(32) NOT NULL,               -- 标称桩号字符串，如 K127+350
    milepost_meters DOUBLE PRECISION NOT NULL,   -- 标称桩号米制连续数值，如 127350.0
    direction VARCHAR(16) DEFAULT 'UP' CHECK (direction IN ('UP', 'DOWN', 'BIDIRECTIONAL')), -- 上行/下行/双向
    status VARCHAR(32) NOT NULL DEFAULT 'NORMAL' 
        CHECK (status IN ('NORMAL', 'ABNORMAL', 'DAMAGED', 'MISSING', 'MAINTAINING', 'REPAIRED', 'REVOKED')),
    audit_status VARCHAR(32) NOT NULL DEFAULT 'APPROVED'
        CHECK (audit_status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
    condition_grade VARCHAR(16) DEFAULT 'A',     -- A(优), B(良), C(次), D(差)
    description TEXT,
    discovery_time TIMESTAMP WITH TIME ZONE NOT NULL,
    patrol_session_id VARCHAR(64) REFERENCES patrol_sessions(id),
    video_slice_id VARCHAR(64) REFERENCES video_slices(id),
    video_offset_seconds DOUBLE PRECISION,       -- 对应视频切片内精确定位秒数 (路产时间 - 视频开始时间)
    created_by UUID REFERENCES users(id),
    sync_status VARCHAR(32) DEFAULT 'UPLOADED' CHECK (sync_status IN ('PENDING', 'UPLOADING', 'UPLOADED', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assets_geom_gist ON assets USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_assets_road_milepost ON assets(road_id, milepost_meters);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_session ON assets(patrol_session_id);

-- ------------------------------------------------------------------------------
-- 8. 现场照片关联表
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS asset_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    session_id VARCHAR(64) REFERENCES patrol_sessions(id),
    file_name VARCHAR(128) NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    thumbnail_path VARCHAR(512),
    file_size_bytes BIGINT NOT NULL,
    photo_time TIMESTAMP WITH TIME ZONE NOT NULL,
    geom GEOMETRY(Point, 4326),
    azimuth DOUBLE PRECISION,                     -- 拍照方位角
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asset_photos_asset ON asset_photos(asset_id);

-- ------------------------------------------------------------------------------
-- 9. 异常处置与维修管理表 (maintenance_records)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS maintenance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    issue_type VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    reported_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reported_by VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'REPORTED' 
        CHECK (status IN ('REPORTED', 'ASSIGNED', 'IN_REPAIR', 'REPAIRED', 'VERIFIED', 'CLOSED')),
    assigned_to VARCHAR(64),
    assigned_time TIMESTAMP WITH TIME ZONE,
    repair_time TIMESTAMP WITH TIME ZONE,
    repair_desc TEXT,
    repair_photos_before TEXT[],                 -- 维修前照片列表
    repair_photos_after TEXT[],                  -- 维修后照片列表
    cost DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON maintenance_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_records(status);

-- ------------------------------------------------------------------------------
-- 10. 离线上传调度与断点续传任务队列 (upload_tasks)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS upload_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(64) NOT NULL,
    task_type VARCHAR(32) NOT NULL CHECK (task_type IN ('SESSION', 'TRACK', 'ASSET', 'PHOTO', 'VIDEO')),
    priority INTEGER NOT NULL DEFAULT 3,         -- 1(最高:Session) -> 5(最低:Video)
    resource_id VARCHAR(128) NOT NULL,
    file_path VARCHAR(512),
    total_bytes BIGINT DEFAULT 0,
    uploaded_bytes BIGINT DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'UPLOADING', 'COMPLETED', 'FAILED')),
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_upload_tasks_priority_status ON upload_tasks(priority ASC, status);

-- ------------------------------------------------------------------------------
-- 11. 全链路业务审计日志 (audit_logs)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID,
    username VARCHAR(64),
    ip_address VARCHAR(64),
    module VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_id VARCHAR(128),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module, created_at);

-- ------------------------------------------------------------------------------
-- 12. 核心空间存储过程：根据点与道路计算桩号 (fn_calculate_milepost)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_calculate_milepost(
    p_road_id UUID,
    p_point GEOMETRY
)
RETURNS TABLE (
    calc_milepost_str VARCHAR(32),
    calc_milepost_meters DOUBLE PRECISION,
    projected_geom GEOMETRY,
    distance_to_centerline_meters DOUBLE PRECISION
) AS $$
DECLARE
    v_centerline GEOMETRY;
    v_start_milepost DOUBLE PRECISION;
    v_fraction DOUBLE PRECISION;
    v_proj_point GEOMETRY;
    v_offset_meters DOUBLE PRECISION;
    v_total_meters DOUBLE PRECISION;
    v_km INTEGER;
    v_m INTEGER;
    v_dist DOUBLE PRECISION;
BEGIN
    -- 查询对应道路中心线与起始桩号
    SELECT centerline_geom, start_milepost 
    INTO v_centerline, v_start_milepost
    FROM roads WHERE id = p_road_id;

    IF v_centerline IS NULL THEN
        RAISE EXCEPTION 'Road with ID % not found', p_road_id;
    END IF;

    -- 计算投影比例 (0.0 ~ 1.0)
    v_fraction := ST_LineLocatePoint(v_centerline, p_point);
    v_proj_point := ST_ClosestPoint(v_centerline, p_point);

    -- 计算点到道路中心线的实际垂直距离 (转换为4326投影球体米数)
    v_dist := ST_Distance(p_point::geography, v_proj_point::geography);

    -- 计算沿折线起点的米数距离
    v_offset_meters := ST_Length(ST_LineSubstring(v_centerline, 0, v_fraction)::geography);
    v_total_meters := v_start_milepost + v_offset_meters;

    v_km := FLOOR(v_total_meters / 1000.0);
    v_m := ROUND(v_total_meters - (v_km * 1000.0));

    calc_milepost_str := 'K' || v_km || '+' || LPAD(v_m::text, 3, '0');
    calc_milepost_meters := v_total_meters;
    projected_geom := v_proj_point;
    distance_to_centerline_meters := v_dist;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
