# 变更日志 (CHANGELOG)

本文档记录“道路路产智能巡查与 GIS 管理系统”的所有重要版本迭代与功能变更。

## [1.0.1] - 2026-09-07

### Added
- **一键并行开发指令**：新增 `npm run dev:all` 与跨平台启动器 (`scripts/dev-all.js`)，支持终端多颜色前缀聚合输出与平滑进程生命周期管理。
- **仓库与版本管理**：升级 Monorepo 各工作区至 `1.0.1` 版本，配置标准 `.gitignore`，推送至远程仓库 `https://github.com/CFM503/GPS`。

## [1.0.0] - 2026-09-07

### Added
- **Monorepo 单体工程架构**：根目录工作区驱动，统一调度 `shared`、`server`、`apps/web`、`apps/mobile`，新增 `npm run dev:all` 一键并行调度。
- **项目审计与设计文档**：输出 `PROJECT_AUDIT.md`、`DESIGN.md`、`docs/API.md`、`docs/DATABASE.md`、`docs/DEPLOY.md`。
- **空间数据库层 (PostGIS)**：编写 `database/schema.sql`，支持 POINT/LINESTRING/POLYGON 几何形态与 GIST 空间索引，编写 `database/seed.sql` 植入 G105 国道仿真中心线与桩号数据。
- **高精度空间算法库 (`@road-gis/shared`)**：
  - WGS84、GCJ-02、BD-09 坐标无漂移互转（往返误差 $< 0.1$ 米）。
  - 点到折线中心线几何投影与自动标称桩号推算 (`calculatePointMilepost` 输出如 `K127+350`)。
- **服务端 API 引擎 (`@road-gis/server`)**：
  - JWT 鉴权与 RBAC 权限控制 (`/api/v1/auth`)。
  - 巡查会话全生命周期与轨迹线段自动拟合 (`/api/v1/patrol`)。
  - 高频 GPS 轨迹批量清洗与 GeoJSON 输出 (`/api/v1/tracks`)。
  - 路产档案空间 BBOX 查询与属性过滤 (`/api/v1/assets`)。
  - 5分钟视频自动切片、毫秒级时间戳反查与分块断点续传 (`/api/v1/videos`)。
  - 维修工单流转 (`/api/v1/maintenance`) 与综合统计大屏 (`/api/v1/stats`)。
  - 多格式档案导出 (`/api/v1/export/geojson`, `csv`, `kml`)。
- **Web GIS 管理后台 (`@road-gis/web`)**：
  - 抽象 `MapProvider` 适配高德与百度底图。
  - 图层管理器：控制道路、轨迹、标识牌、百米桩、护栏、林木、路面病害等图层显隐。
  - 巡查回放控制器：支持轨迹时间轴平滑移动、倍速调整与轨迹点秒级联动视频。
  - 路产档案与视频对齐播放器：点击路产秒级跳转至发现时刻录像帧。
- **车载移动巡查端 (`@road-gis/mobile`)**：
  - 驾驶安全模式：6 个超大高对比度触控按键（标识牌、百米桩、护栏、林木、病害异常、其他），行车中 1-Tap 零打字建档。
  - 持续高精度 GPS 采集与 5 分钟自动切片录像。
  - 离线数据库 (Offline-First)：网络中断保障采集正常运行。
  - 5 级优先级同步队列与视频分块断点续传（P1 会话 -> P2 轨迹 -> P3 路产 -> P4 照片 -> P5 视频）。
- **自动化测试套件**：13 项算法与集成测试全量通过（涵盖往返坐标误差、桩号投影、会话生命周期、50%断网续传、视频定位对齐）。
