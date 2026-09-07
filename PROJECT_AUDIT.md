# 项目审计报告 (PROJECT_AUDIT)

- **审计时间**：2026-09-07
- **审计对象**：道路路产智能巡查与 GIS 管理系统 (Road Asset Intelligent Patrol & GIS Management System)
- **执行环境**：Windows 11 x64, Node.js v22.22.0, npm 10.9.4, Python 3.13.14, Git 2.52.0

---

## 1. 当前项目结构与环境现状

```text
d:\SOFT\AI\github\GIS\
└── (当前为空目录，无历史遗留文件)
```

- **项目类型**：新立项研发工程。
- **技术栈现状**：全新构建，采用 Monorepo 单仓库模块化架构。
- **数据库规划**：主库采用 PostgreSQL 15 + PostGIS 空间扩展；同时配备本地兼容适配层用于快速单机离线测试。移动端采用 SQLite / IndexedDB 离线存储。
- **代码复用度**：0%（全新绿色开发，无历史兼容包袱与技术债）。

---

## 2. 核心功能规划与实施矩阵

| 模块 | 功能要求 | 状态 | 规划方案 |
| :--- | :--- | :--- | :--- |
| **基础支撑** | 统一单体 Monorepo 工作区 | 待创建 | Root package.json (npm workspaces: `server`, `apps/web`, `apps/mobile`, `shared`) |
| **数据库层** | PostGIS 空间数据表设计 | 待创建 | `database/schema.sql`, 支持 Point / LineString / Polygon, GIST 空间索引, 桩号计算函数 |
| **共享模块** | 坐标转换与空间数学 | 待创建 | `shared`: WGS84, GCJ-02, BD-09 互转算法，点到折线投影计算桩号 |
| **服务端** | 巡查、路产、视频、GPS API | 待创建 | `server`: Express + TypeScript, REST API, 断点续传, GeoJSON 空间查询 |
| **Web GIS** | 综合管理地图与看板 | 待创建 | `apps/web`: React + Vite + TailwindCSS, MapProvider 底图抽象, 轨迹回放, 视频联动 |
| **移动车载** | 离线巡查端 | 待创建 | `apps/mobile`: 驾驶友好大触控按键, 持续GPS, 5分钟视频切片, 本地离线库 |
| **离线同步** | 弱网/断网自动上传 | 待创建 | 5级优先级队列, 视频分块断点续传, 断网保障 |

---

## 3. 技术风险与规避策略

### 3.1 地图厂商强耦合风险
- **风险**：若直接将业务数据字段（如坐标）按照高德或百度格式入库，未来更换底图厂商（如天地图、开源 OpenLayers/MapLibre、内网专网地图）时将导致路产全部偏移或重新校准。
- **应对**：
  1. 数据库底层统一且**强制存储 WGS84 原始经纬度坐标**。
  2. 前端设计统一的 `MapProvider` 适配器（实现 `renderMap`, `convertCoordinate`, `addLayer`, `fitBounds` 等通用接口）。
  3. 坐标只在地图图层渲染的展示层动态调用算法转换为 GCJ-02 或 BD-09，与核心数据模型完全解耦。

### 3.2 偏远公路断网与视频大文件上传风险
- **风险**：单次巡查 1~8 小时，视频切片数 GB 甚至几十 GB，若网络中断导致从头重传，车载终端流量与电量将被迅速耗尽。
- **应对**：
  1. **视频 5 分钟自动切片**（每个文件几十兆），降低单点传输失败成本。
  2. 服务端支持 **HTTP Chunked / Resumable 断点续传**（带 `Upload-Offset` 和分块校验），网络断开后恢复从断点继续。
  3. 实行 **5 级优先级调度**：巡查 Session 摘要 > GPS 轨迹点批次 > 路产信息 > 现场照片 > 大体积视频切片。管理后台可秒级先看到轨迹与路产，视频后台静默续传。

### 3.3 驾驶安全与终端保活风险
- **风险**：巡线员处于车辆行驶中，复杂打字与多级菜单操作会引发重大行车安全隐患；同时 Android 锁屏与系统电池优化可能杀后台 GPS 进程。
- **应对**：
  1. 移动端主界面采用**超大触控色块按钮**，一键完成采集，采集时系统自动静默绑定当前高精度 GPS、瞬时车速、航向角及视频偏移毫秒，巡线员无需低头输入文字。
  2. 配置 Android 前台服务（Foreground Service with Notification）与唤醒锁（WakeLock），阻止系统休眠杀死后台 GPS 进程。

---

## 4. 推荐实施路径

严格按照规划实施：
1. `PROJECT_AUDIT.md` (已就绪)
2. `DESIGN.md` (系统架构与接口详细设计)
3. `database/schema.sql` (PostgreSQL + PostGIS DDL)
4. `shared/` 核心库 (坐标系无损转换、桩号正反算)
5. `server/` API (认证、巡查会话、GPS、路产空间接口、视频断点上传)
6. `apps/web/` Web GIS 调度与管理后台 (图层切换、轨迹回放、视频秒级定位)
7. `apps/mobile/` 车载巡查端 (大键模式、离线库、优先级上传)
8. 单元与端到端自动化测试验证
9. 维护 `README.md`、`DEPLOY.md`、`CHANGELOG.md`
