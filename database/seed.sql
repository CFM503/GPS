-- ==============================================================================
-- 道路路产智能巡查与 GIS 管理系统 - 初始种子数据 (database/seed.sql)
-- 包含：标准角色、系统测试用户、G105 国道仿真中心线与桩号、全部路产类型字典及示范路产
-- ==============================================================================

-- 1. 角色初始化
INSERT INTO roles (id, name, description) VALUES
('super_admin', '超级管理员', '拥有系统最高配置与全量数据管理权限'),
('bureau_admin', '管理处管理员', '负责辖区内道路、路产审核与工单调度'),
('patroller', '巡查员', '负责车载终端道路现场移动巡查与路产采集'),
('auditor', '审核员', '负责对移动端上报的路产及异常进行核准'),
('maintainer', '维修人员', '负责认领与处置路产破损、维修工单'),
('viewer', '只读用户', '仅具备 GIS 地图浏览与台账查询权限')
ON CONFLICT (id) DO NOTHING;

-- 2. 初始账号 (默认密码均为 admin123 或 patrol123，生产环境请替换)
-- SHA256 / bcrypt hash 占位
INSERT INTO users (id, username, password_hash, real_name, role_id, phone, department) VALUES
('11111111-1111-1111-1111-111111111111', 'admin', '$2a$10$abcdefghijklmnopqrstuvwxyzA1B2C3D4E5F6G7H8I9J0K', '系统管理员', 'super_admin', '13800138000', '信息技术部'),
('22222222-2222-2222-2222-222222222222', 'zhangsan', '$2a$10$abcdefghijklmnopqrstuvwxyzA1B2C3D4E5F6G7H8I9J0K', '张三', 'patroller', '13911112222', '第一巡查中队'),
('33333333-3333-3333-3333-333333333333', 'lisi', '$2a$10$abcdefghijklmnopqrstuvwxyzA1B2C3D4E5F6G7H8I9J0K', '李四', 'auditor', '13933334444', '养护工程科'),
('44444444-4444-4444-4444-444444444444', 'wangwu', '$2a$10$abcdefghijklmnopqrstuvwxyzA1B2C3D4E5F6G7H8I9J0K', '王五', 'maintainer', '13955556666', '应急维修队')
ON CONFLICT (username) DO NOTHING;

-- 3. 路产类型字典定义 (覆盖点、线、面)
INSERT INTO asset_types (id, name, geometry_type, category, icon, color, description) VALUES
('TRAFFIC_SIGN', '道路交通标识牌', 'POINT', 'FACILITY', 'signpost', '#3B82F6', '各类禁令、警告、指示与指路标牌'),
('MILEPOST', '里程碑', 'POINT', 'FACILITY', 'milestone', '#10B981', '整公里国家或省道里程标志石碑'),
('HUNDRED_METER_POST', '百米桩', 'POINT', 'FACILITY', 'flag', '#059669', '每百米设置的道路桩号指示桩'),
('GUARDRAIL', '波形梁钢护栏', 'LINESTRING', 'SAFETY', 'shield', '#F59E0B', '路侧及中央隔离带波形梁钢护栏'),
('CRASH_BARRIER', '防撞设施', 'POINT', 'SAFETY', 'alert-triangle', '#EA580C', '防撞垫、消能防撞桶群'),
('TREE', '绿化林木', 'POINT', 'GREENING', 'trees', '#16A34A', '行道树、古树名木及道路绿化'),
('GREENBELT', '绿化隔离带', 'POLYGON', 'GREENING', 'flower', '#84CC16', '中间隔离绿化带、互通立交绿化区'),
('STREET_LIGHT', '道路路灯', 'POINT', 'FACILITY', 'lamp', '#EAB308', '沿线路灯杆、高杆照明设施'),
('DRAINAGE', '排水设施/边沟', 'LINESTRING', 'FACILITY', 'droplets', '#06B6D4', '混凝土梯形排水沟、盲沟、沉砂井'),
('BRIDGE', '公路桥梁', 'POINT', 'STRUCTURE', 'anchor', '#6366F1', '跨线桥、跨河特大桥、中小型公路桥'),
('CULVERT', '公路涵洞', 'POINT', 'STRUCTURE', 'box', '#8B5CF6', '盖板涵、圆管涵、箱涵排水通道'),
('SLOPE', '路基边坡', 'POLYGON', 'STRUCTURE', 'mountain', '#D97706', '深挖高填方边坡、骨架护坡防护区'),
('CONSTRUCTION', '养护施工区域', 'POLYGON', 'SAFETY', 'cone', '#EF4444', '临时封闭占道施工与养护作业区'),
('DISEASE', '道路路面病害', 'POLYGON', 'PAVEMENT', 'activity', '#DC2626', '坑槽、纵横向裂缝、沉陷、龟裂'),
('OTHER', '其他道路附属设施', 'POINT', 'FACILITY', 'layers', '#6B7280', '隔音屏障、电子卡口、气象监测杆')
ON CONFLICT (id) DO NOTHING;

-- 4. 道路基础设施：示范道路 G105 (国道105线某典型路段，起点 K120+000，终点 K180+000)
-- 坐标取自中国南方典型平原丘陵道路 WGS84 坐标中心线
INSERT INTO roads (id, code, name, level, start_milepost, end_milepost, total_length_km, centerline_geom) VALUES
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'G105',
    '国道105 (京澳线示范段)',
    '国道',
    120000.0,
    180000.0,
    60.0,
    ST_GeomFromText('LINESTRING(
        113.250000 23.100000,
        113.265000 23.125000,
        113.280000 23.150000,
        113.295000 23.180000,
        113.310000 23.210000,
        113.330000 23.245000,
        113.355000 23.280000,
        113.380000 23.320000,
        113.410000 23.365000,
        113.445000 23.410000
    )', 4326)
)
ON CONFLICT (code) DO NOTHING;

-- 5. 示范巡查会话记录 (PAT-20260907-0001)
INSERT INTO patrol_sessions (
    id, user_id, user_name, vehicle_plate, road_id, road_code, status,
    start_time, end_time, duration_seconds, distance_km, asset_count, anomaly_count, video_count,
    trajectory_geom, sync_status, notes
) VALUES (
    'PAT-20260907-0001',
    '22222222-2222-2222-2222-222222222222',
    '张三',
    '粤A12345',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'G105',
    'COMPLETED',
    '2026-09-07 08:30:12+08',
    '2026-09-07 11:02:45+08',
    9153,
    42.8,
    18,
    2,
    3,
    ST_GeomFromText('LINESTRING(
        113.250100 23.100100,
        113.265080 23.125050,
        113.280120 23.150090,
        113.295050 23.180040,
        113.310080 23.210060,
        113.330040 23.245030
    )', 4326),
    'UPLOADED',
    '常规早班巡查，天气晴好，路况良好，K127+350处标识牌轻微倾斜。'
)
ON CONFLICT (id) DO NOTHING;

-- 6. 示范视频切片 (5分钟/个)
INSERT INTO video_slices (
    id, session_id, file_name, start_time, end_time, duration_seconds,
    file_size_bytes, width, height, storage_path, upload_status, uploaded_bytes
) VALUES
('VID-PAT20260907-001', 'PAT-20260907-0001', 'VIDEO_001.mp4', '2026-09-07 08:30:12+08', '2026-09-07 08:35:12+08', 300, 104857600, 1920, 1080, 'videos/PAT-20260907-0001/VIDEO_001.mp4', 'COMPLETED', 104857600),
('VID-PAT20260907-002', 'PAT-20260907-0001', 'VIDEO_002.mp4', '2026-09-07 08:35:12+08', '2026-09-07 08:40:12+08', 300, 104857600, 1920, 1080, 'videos/PAT-20260907-0001/VIDEO_002.mp4', 'COMPLETED', 104857600),
('VID-PAT20260907-003', 'PAT-20260907-0001', 'VIDEO_003.mp4', '2026-09-07 08:40:12+08', '2026-09-07 08:45:12+08', 300, 104857600, 1920, 1080, 'videos/PAT-20260907-0001/VIDEO_003.mp4', 'COMPLETED', 104857600)
ON CONFLICT (id) DO NOTHING;

-- 7. 示范路产 (涵盖点、线、面)
-- (1) POINT: 限速60标识牌 (发现于 08:32:45，位于切片001中，偏移 153秒)
INSERT INTO assets (
    id, asset_code, type_id, road_id, geom, latitude, longitude,
    milepost, milepost_meters, direction, status, audit_status, condition_grade,
    description, discovery_time, patrol_session_id, video_slice_id, video_offset_seconds, created_by
) VALUES (
    'b0000001-0000-0000-0000-000000000001',
    'BZ-G105-K121-001',
    'TRAFFIC_SIGN',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    ST_GeomFromText('POINT(113.253000 23.105000)', 4326),
    23.105000, 113.253000,
    'K121+200', 121200.0,
    'UP', 'NORMAL', 'APPROVED', 'A',
    '限速60标志牌，版面反光良好',
    '2026-09-07 08:32:45+08',
    'PAT-20260907-0001',
    'VID-PAT20260907-001',
    153.0,
    '22222222-2222-2222-2222-222222222222'
) ON CONFLICT (asset_code) DO NOTHING;

-- (2) POINT: 百米桩
INSERT INTO assets (
    id, asset_code, type_id, road_id, geom, latitude, longitude,
    milepost, milepost_meters, direction, status, audit_status, condition_grade,
    description, discovery_time, patrol_session_id, video_slice_id, video_offset_seconds, created_by
) VALUES (
    'b0000002-0000-0000-0000-000000000002',
    'BMZ-G105-K123-005',
    'HUNDRED_METER_POST',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    ST_GeomFromText('POINT(113.268000 23.130000)', 4326),
    23.130000, 113.268000,
    'K123+500', 123500.0,
    'UP', 'NORMAL', 'APPROVED', 'A',
    '百米桩字迹清晰，无破损',
    '2026-09-07 08:36:10+08',
    'PAT-20260907-0001',
    'VID-PAT20260907-002',
    58.0,
    '22222222-2222-2222-2222-222222222222'
) ON CONFLICT (asset_code) DO NOTHING;

-- (3) LINESTRING: 波形梁护栏 (线状路产)
INSERT INTO assets (
    id, asset_code, type_id, road_id, geom, latitude, longitude,
    milepost, milepost_meters, direction, status, audit_status, condition_grade,
    description, discovery_time, patrol_session_id, video_slice_id, video_offset_seconds, created_by
) VALUES (
    'b0000003-0000-0000-0000-000000000003',
    'HL-G105-K125-001',
    'GUARDRAIL',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    ST_GeomFromText('LINESTRING(113.275000 23.142000, 113.278000 23.147000, 113.282000 23.153000)', 4326),
    23.147000, 113.278000,
    'K125+100', 125100.0,
    'UP', 'NORMAL', 'APPROVED', 'A',
    '右侧两波型镀锌钢护栏，总长约1200米',
    '2026-09-07 08:38:20+08',
    'PAT-20260907-0001',
    'VID-PAT20260907-002',
    188.0,
    '22222222-2222-2222-2222-222222222222'
) ON CONFLICT (asset_code) DO NOTHING;

-- (4) POLYGON: 道路病害坑槽区 (面状路产，异常状态)
INSERT INTO assets (
    id, asset_code, type_id, road_id, geom, latitude, longitude,
    milepost, milepost_meters, direction, status, audit_status, condition_grade,
    description, discovery_time, patrol_session_id, video_slice_id, video_offset_seconds, created_by
) VALUES (
    'b0000004-0000-0000-0000-000000000004',
    'BH-G105-K127-001',
    'DISEASE',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    ST_GeomFromText('POLYGON((
        113.292000 23.175000,
        113.292500 23.175000,
        113.292500 23.176000,
        113.292000 23.176000,
        113.292000 23.175000
    ))', 4326),
    23.175500, 113.292250,
    'K127+350', 127350.0,
    'UP', 'ABNORMAL', 'APPROVED', 'D',
    '主车道沥青路面严重坑槽，面积约8平方米，深约5cm，急需修复',
    '2026-09-07 08:42:15+08',
    'PAT-20260907-0001',
    'VID-PAT20260907-003',
    123.0,
    '22222222-2222-2222-2222-222222222222'
) ON CONFLICT (asset_code) DO NOTHING;

-- 8. 对应维修工单记录
INSERT INTO maintenance_records (
    id, asset_id, issue_type, severity, reported_time, reported_by,
    status, assigned_to, assigned_time, repair_desc
) VALUES (
    'c0000001-0000-0000-0000-000000000001',
    'b0000004-0000-0000-0000-000000000004',
    '路面坑槽破损',
    'HIGH',
    '2026-09-07 08:45:00+08',
    '张三',
    'ASSIGNED',
    '王五',
    '2026-09-07 09:00:00+08',
    '已安排养护一班携带沥青冷补料出勤处理'
) ON CONFLICT (id) DO NOTHING;
