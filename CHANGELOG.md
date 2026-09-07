# 变更日志 (CHANGELOG)

本文档记录“道路路产智能巡查与 GIS 管理系统”的所有重要版本迭代与功能变更。

## [1.2.0] - 2026-09-07

### Added
- **真实 Android 巡查闭环与 Capacitor 原生容器接入 (`apps/mobile/android`)**：
  - 生成 Capacitor 5 原生 Android 工程，配置 `build.gradle` 与 `AndroidManifest.xml`。
  - 完整声明真实定位 (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`)、多媒体抓拍 (`CAMERA`, `RECORD_AUDIO`, `READ_MEDIA_IMAGES`)、前台服务保活 (`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `WAKE_LOCK`) 及电池白名单 (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`)。
- **真机硬件 GPS 定位引擎改造 (`gps.ts`)**：
  - 废除无条件 Mock 模拟器，全面切换为真实硬件 GNSS 芯片定位 (`navigator.geolocation.watchPosition` + `enableHighAccuracy: true`)。
  - 实时采集经纬度、车速、航向角、GNSS 精度及海拔高度，并附带错误自愈重试与硬件标记 (`device_gnss`)。
- **现场实景快照多媒体服务 (`camera.ts` & `idbStorage.ts`)**：
  - 移动巡查端新增现场拍照能力，抓拍快照自动生成唯一 UUID，打上当前 GPS 经纬度与时间戳，保存至 IndexedDB 本地库，并自动挂载 P4 照片同步任务。
- **巡查驾驶仪表盘状态栏全面升级 (`PatrolDashboard.tsx` & `App.tsx`)**：
  - 实时显示巡查状态、真实硬件 GPS 精度（如 `GPS 正常 ±3.2m`）、网络状态指示（`ONLINE`/`OFFLINE`/`SYNCING`）、行车车速、轨迹点计数、路产标记计数与待同步队列统计。
- **服务端照片元数据与路产多媒体联动支持 (`modules/photo` & `modules/asset`)**：
  - 新增 `POST /api/v1/photos/metadata` 接口，支持离线同步现场照片元数据。
  - `GET /api/v1/assets/:id` 自动返回路产实体及其关联的多媒体实景照片列表。
- **真机测试与构建指南文档**：
  - 新增 `docs/TESTING_ANDROID.md`（涵盖真机权限授权、飞行模式离线巡查、进程强杀抗灾、恢复网络 5 级自动同步及 Web GIS 复核）。
  - 新增 `docs/ANDROID_BUILD.md`（包含 Android Studio 与 Gradle 命令行 APK 打包指引）。
- **自动化测试套件扩充**：
  - `server/tests/offline-sync.test.ts` 新增场景 7（同步队列生命周期状态转移机与重试保护）与场景 8（真实 GNSS 数据规范与多媒体照片实体联动），全量 21 项自动化测试 100% 通过。

## [1.1.0] - 2026-09-07

### Added
- **离线优先 (Offline-First) 生产级存储改造**：全面废弃 `localStorage`，实现 IndexedDB 本地持久化存储引擎 (`idbStorage.ts`)，规划 8 大核心对象仓库，具备大容量异步非阻塞事务与安全内存回退保护。
- **车载行车安全 8 大触控按键全面升级**：新增路灯、交通工程设施，形成 8 大标准分类（标识牌、百米桩、护栏、林木、路灯、交通设施、异常病害、其他），触控高度 $\ge 72\text{px}$，行车一键秒级打点。
- **不可覆盖历史记录档案 (`asset_history`)**：严禁直接覆盖原记录，每次现场补充文字、添加照片或审核状态调整均生成独立不可篡改的变更历史记录。
- **视频证据实体 (`VideoEvent`)**：路产采集瞬间自动计算当前视频切片毫秒级帧偏移量，生成独立的视频证据关联实体，支持秒级精准跳转回放。
- **全链路客户端 UUID 与服务端幂等性保障**：客户端使用 UUID 作为实体主键贯穿全链路，请求头携带 `X-Idempotency-Key`，服务端针对会话、轨迹、路产、切片全面实现重试幂等去重保护。
- **屏幕防休眠唤醒锁 (Screen Wake Lock API)**：巡查开启时自动申请唤醒锁，防止车载手机长时间运行自动熄屏休眠导致 GPS 停摆。
- **零依赖单文件高保真验证原型 (`prototype/index.html`)**：双击即可在任意浏览器直接运行，内置车载仪表盘、8 触控按键、IndexedDB 离线模拟、Canvas GIS 动态轨迹与 5 级优先级同步队列。
- **离线优先与幂等性全链路测试套件 (`server/tests/offline-sync.test.ts`)**：覆盖 6 大离线核心场景（离线采集落盘、应用重启持久化保留、网络恢复 5 级自动同步、50% 视频切片断网保护、断点续传与重试幂等性、视频-路产帧联动），全套 19 项自动化测试 100% 通过。
- **架构指导文档**：新增 `docs/OFFLINE_FIRST.md`、`docs/MOBILE_ARCHITECTURE.md`、`docs/SYNC_DESIGN.md`。

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
