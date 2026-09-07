# 道路路产智能巡查与 GIS 管理系统 (Road Asset Intelligent Patrol & GIS Management System)

道路管理处公路沿线所有路产数字化建档、GIS 可视化交互管理、车载智能移动巡查、离线采集与弱网/断网高可靠断点续传一体化综合平台。

---

## 核心系统架构与目录结构 (Monorepo)

本项目采用**单仓库、单项目、模块化 Monorepo 架构**：

```text
GIS/
├── package.json              # Monorepo 统一工作区配置 (npm workspaces)
├── docker-compose.yml        # PostgreSQL 15 + PostGIS、MinIO 对象存储本地环境
├── .env.example              # 规范化环境变量模板
├── PROJECT_AUDIT.md          # 项目初始审计报告
├── DESIGN.md                 # 总体系统设计说明书
├── CHANGELOG.md              # 变更日志
│
├── database/                 # PostGIS 空间数据表定义与种子数据
│   ├── schema.sql            # PostgreSQL 15 + PostGIS 3.4 DDL (点线面、GIST索引、桩号函数)
│   └── seed.sql              # G105 国道仿真中心线、桩号、全量路产类型字典与示范路产
│
├── shared/                   # 前后端与移动端共享模块 (@road-gis/shared)
│   ├── src/types/            # 核心业务接口 (Asset, PatrolSession, GPSTrack, User, VideoSlice)
│   ├── src/coords/           # WGS84 / GCJ-02 / BD-09 坐标无损高精度互转算法 (<0.1m)
│   └── src/spatial/          # 道路中心线桩号投影算法 (ST_LineLocatePoint) 与距离方位角计算
│
├── server/                   # 服务端 RESTful API 核心层 (@road-gis/server)
│   ├── src/modules/          # Auth, Patrol, Track, Asset, Photo, Video, GIS, Maintenance, Stats, Export
│   └── tests/                # 自动化集成测试与断网/断点续传模拟测试
│
├── apps/
│   ├── web/                  # Web GIS 综合管理后台 (@road-gis/web)
│   │   ├── src/gis/          # MapProvider 抽象层 (解耦高德/百度/天地图)
│   │   └── src/components/   # GIS主地图、图层管理器、轨迹回放时间轴、视频时间跳转播放器
│   │
│   └── mobile/               # 车载移动巡查端 (@road-gis/mobile)
│       ├── android/          # Capacitor 5 原生 Android 工程 (全权限配置与 APK 构建源码)
│       ├── src/services/     # 真实硬件GNSS (gps.ts)、相机实景拍照 (camera.ts)、IndexedDB (idbStorage)
│       └── src/components/   # 驾驶安全 8 大触控色块按键、仪表盘实时状态栏、5级优先级同步队列
│
├── prototype/                # 零依赖单文件原型 (双击即用)
│   └── index.html            # 高拟真车载巡查、8按键采集、IndexedDB离线模拟、Canvas GIS轨迹
│
└── docs/                     # 架构与运维技术文档
    ├── TESTING_ANDROID.md    # Android 真机巡查闭环与离线优先验证手册
    ├── ANDROID_BUILD.md      # Android APK 打包与编译构建指南
    ├── OFFLINE_FIRST.md      # 离线优先架构设计与 IndexedDB 规范
    ├── MOBILE_ARCHITECTURE.md# 车载移动巡查端 8 大按键与安全规范
    ├── SYNC_DESIGN.md        # 5 级优先级同步队列与客户端 UUID 幂等性设计
    ├── API.md                # RESTful API 接口规范
    ├── DATABASE.md           # 空间数据库设计说明书
    └── DEPLOY.md             # 生产部署与 Android APK 打包指南
```

---

## 核心四大业务原则

1. **采集与网络彻底解耦 (Offline-First)**：移动端在偏远山区无网络时所有功能完全正常（GPS持续记录、5分钟视频自动切片、路产一键采集、现场照片落盘）。网络恢复后由 5 级优先级队列静默续传。
2. **地图底图与核心数据解耦**：数据库底层**永远强制保存 WGS84 原始空间坐标**。前端通过 `MapProvider` 抽象接口动态转换，无论底图未来切换为高德、百度、天地图或专网 GIS，核心业务数据零改动。
3. **路产全面支持点 (Point)、线 (LineString)、面 (Polygon)**：
   - **点**：交通标识牌、百米桩、里程碑、单株林木、路灯、防撞桶；
   - **线**：波形梁钢护栏、中央隔离带、路侧排水边沟；
   - **面**：绿化隔离带、边坡防护区、施工区、路面坑槽病害区。
4. **视频-路产-GPS 毫秒级时间对齐**：路产采集时系统自动记录毫秒绝对时间戳 $T_{asset}$。在后台点击路产时，系统自动匹配对应视频切片 $V$ 并直接 seek 跳转至偏移秒数 $\Delta t = T_{asset} - V_{start}$ 播放。

---

## 开发环境要求

* **Node.js**：`v20.x` 或 `v22.x`（推荐 `v22.22.0`）
* **npm**：`10.x` 或更高
* **Docker & Docker Compose**：用于本地运行 PostgreSQL 15 + PostGIS 与 MinIO

---

## 快速安装与启动

### 1. 安装项目所有工作区依赖

```bash
npm install
```

### 2. 启动依赖空间数据库与 MinIO 对象存储 (Docker)

```bash
docker compose up -d
```

> 容器启动后会自动加载 `database/schema.sql` 和 `database/seed.sql`，预置 G105 国道中心线、15类路产字典、初始用户与巡查示例。

### 3. 配置环境变量

复制根目录模板：
```bash
cp .env.example .env
```

环境变量配置说明：
| 变量名 | 默认值 | 作用说明 |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgres://gis_user:gis_secret_password@localhost:5432/road_gis_db` | PostgreSQL 15 + PostGIS 连接串 |
| `MAP_PROVIDER` | `AMAP` | 底图提供商 (`AMAP` 高德 / `BAIDU` 百度) |
| `AMAP_KEY` | - | 高德开放平台 Web 服务 API Key |
| `AMAP_SECURITY_CODE`| - | 高德地图安全密钥 |
| `BAIDU_KEY` | - | 百度地图开放平台 API Key |
| `S3_ENDPOINT` | `http://localhost:9000` | MinIO / AWS S3 对象存储地址 |
| `S3_ACCESS_KEY` | `minioadmin` | 对象存储 Access Key |
| `S3_SECRET_KEY` | `minioadmin` | 对象存储 Secret Key |
| `S3_BUCKET` | `road-assets` | 现场照片与视频切片存储 Bucket |
| `JWT_SECRET` | - | 用户认证与 JWT 令牌加密密钥 |

---

## 各端启动与开发

### 一键并行启动全部服务 (推荐)
```bash
npm run dev:all
# 同时启动：
# 1. 后端 API 服务:     http://localhost:3000
# 2. Web GIS 管理后台:  http://localhost:5173
# 3. 车载移动巡查端:    http://localhost:3001
```

### 单独分端启动
#### 启动服务端 API
```bash
npm run dev:server
# API 服务监听: http://localhost:3000
# API 健康检查: http://localhost:3000/health
```

### 启动 Web GIS 管理后台
```bash
npm run dev:web
# Web GIS 管理平台界面: http://localhost:5173
```

### 启动车载移动巡查端
```bash
npm run dev:mobile
# 车载巡查端触控屏界面: http://localhost:3001
```

---

## 项目构建 (Production Build)

### 1. 全量工程编译
在项目根目录下执行：
```bash
npm run build
```
该命令会自动按顺序完成 `@road-gis/shared`、`@road-gis/server`、`@road-gis/web`、`@road-gis/mobile` 的 TypeScript 编译与 Vite 生产打包。

### 2. Web 管理后台构建产物
位于 `apps/web/dist/`，可直接部署于 Nginx。

### 3. 车载移动端 Android 构建 (Capacitor 原生打包)
```bash
cd apps/mobile
npm run build
npx cap copy
npx cap open android
```
在 Android Studio 中点击 **Build APK** 即可生成车载安装包。详见 [docs/DEPLOY.md](file:///d:/SOFT/AI/github/GIS/docs/DEPLOY.md)。

---

## 自动化测试与验证套件

本项目配备完备的算法单元测试、离线同步套件、多源更新套件与端到端集成测试（共 25 项全部通过）：

```bash
# 1. 运行核心共享库单元测试 (坐标系互转、桩号折线投影、Haversine算法)
node --test shared/tests/shared.test.ts

# 2. 运行服务端全套集成 API 与断网续传测试
npx tsx --test server/tests/api.test.ts

# 3. 运行全量离线优先与真机规范自动化测试套件 (8大核心场景)
npx tsx --test server/tests/offline-sync.test.ts

# 4. 运行国内多源在线自动更新与 Semver 测试套件
npx tsx --test server/tests/app-update.test.ts

# 5. 一键运行全量自动化测试 (25 项测试)
npm test
```

### 核心测试覆盖 (25 项自动化测试 100% 通过)：
- [x] **WGS84 $\leftrightarrow$ GCJ-02 $\leftrightarrow$ BD-09** 高精度双向转换往返误差 $< 0.1$ 米测试；
- [x] **道路中心线桩号投影**：输入 GPS 点自动拟合推算标称桩号（如 `K120+000`）；
- [x] **巡查 Session 全生命周期**：创建会话 $\rightarrow$ 上传轨迹点 $\rightarrow$ 生成 PostGIS LineString $\rightarrow$ 结束会话；
- [x] **纯离线环境数据采集与本地保存**：断网状态下 GPS、5类路产、切片完整记录于本地队列；
- [x] **移动端重启数据不丢失**：模拟应用销毁重启，IndexedDB 100% 完整恢复未同步项；
- [x] **网络恢复 5 级优先级自动同步**：P1 会话 $\rightarrow$ P2 轨迹 $\rightarrow$ P3 路产与视频事件 $\rightarrow$ P4 照片 $\rightarrow$ P5 视频切片；
- [x] **中断再续传与幂等性**：50% 视频断网不产生脏数据，恢复后继续上传；重试上传杜绝重复数据；
- [x] **视频-路产联动与历史追溯**：通过路产 ID 关联视频切片与秒级帧偏移，不可覆盖变更记录保留；
- [x] **同步队列状态机生命周期**：`PENDING -> UPLOADING -> UPLOADED` 转移与失败指数退避重试；
- [x] **真实硬件 GNSS 实体全规范与现场照片元数据联动**：高精度 `device_gnss` 数据结构校验与实景照片元数据上报查询；
- [x] **国内多源在线自动更新系统 (4级备用源)**：Semver 语义化版本算法、强制升级拦截、局域网内网首选与国内免翻墙 CDN 镜像、APK 文件流服务与 302 重定向。

---

## 巡查业务真实闭环验证流程

1. 打开车载移动端 (`http://localhost:3001`)，点击**“开始道路巡查”**；
2. 系统自动唤起高精度 GPS 轨迹记录与切片录像（`VIDEO_001.mp4`）；
3. 车辆行驶中点击大触控键：**【标识牌】**、**【百米桩】**、**【护栏】**；
4. 点击右上角切换为**“仿真: 断网”**模式，模拟偏远公路断网；
5. 在离线状态下继续点击**【道路病害/异常】**，系统毫秒级写入本地离线数据库，生成待同步任务；
6. 车辆到达终点，点击**“完成巡查并结算”**；
7. 点击切换回**“仿真: 在线”**模式，系统自动唤醒 5 级优先级同步队列（P1 会话 $\rightarrow$ P2 轨迹 $\rightarrow$ P3 路产 $\rightarrow$ P4 照片 $\rightarrow$ P5 视频分块断点续传）；
8. 打开 Web GIS 管理后台 (`http://localhost:5173`)：
   - 地图高亮呈现 G105 道路及刚刚巡查的绿色动态轨迹；
   - 地图呈现各类路产与红色病害报警面；
   - 底部播放器点击播放，小车在地图上沿轨迹平滑移动；
   - 点击任意路产，右侧抽屉展示桩号（如 `K127+350`）与现场照片；
   - 点击**【跳转对应视频切片】**，视频播放器自动秒级跳转至该路产发现瞬间（如 `02:33`），形成完整数字档案证据链！
