# 部署与运维指南 (DEPLOY.md)

---

## 1. 部署架构概览

```
  ┌──────────────────────────────────────────────────────────────┐
  │                    反向代理层 (Nginx / SSL)                   │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
┌──────────────────┐                           ┌──────────────────┐
│ Web GIS 管理后台 │                           │ 后端 API 服务    │
│ (apps/web)       │                           │ (server:3000)    │
└──────────────────┘                           └────────┬─────────┘
                                                        │
                         ┌──────────────────────────────┴──────────────────────────────┐
                         ▼                                                             ▼
             ┌───────────────────────┐                                     ┌───────────────────────┐
             │ PostgreSQL 15 +       │                                     │ MinIO 对象存储池      │
             │ PostGIS 3.4 (port:5432│                                     │ (S3 兼容协议: port:9000│
             └───────────────────────┘                                     └───────────────────────┘
```

---

## 2. 基础环境准备

### 2.1 依赖项清单
* **操作系统**：Ubuntu 22.04 LTS / Debian 12 / Windows Server 2022 / CentOS 7.9+
* **容器引擎**：Docker 24.0+ 与 Docker Compose v2+
* **Node.js 运行时**：Node.js v20.x 或 v22.x LTS
* **移动端编译环境 (可选)**：Android Studio Hedgehog (2023.1+) / JDK 17 / Android SDK 34

---

## 3. 使用 Docker Compose 一键启动依赖服务

在项目根目录执行：

```bash
# 启动 PostgreSQL 15 (带 PostGIS 扩展) 与 MinIO
docker compose up -d

# 检查容器运行状态
docker compose ps
```

* **PostgreSQL + PostGIS 空间库**：`localhost:5432`
  * 数据库名称：`road_gis_db`
  * 用户名：`gis_user`
  * 密码：`gis_secret_password`
  * 容器启动时会自动载入 `database/schema.sql` 和 `database/seed.sql` 完成表结构与初始种子数据初始化。
* **MinIO 对象存储**：
  * API 端口：`http://localhost:9000`
  * Web 控制台：`http://localhost:9001`
  * 用户名：`minioadmin`，密码：`minioadmin`
  * Bucket：`road-assets` (自动创建且策略为 public/download)

---

## 4. 环境变量配置 (`.env`)

复制根目录模板生成正式配置文件：

```bash
cp .env.example .env
```

修改关键变量：
```ini
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://gis_user:gis_secret_password@localhost:5432/road_gis_db

# 高德地图 Web 密钥配置
MAP_PROVIDER=AMAP
AMAP_KEY=your_production_amap_key
AMAP_SECURITY_CODE=your_production_security_code

# MinIO / S3 存储
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=road-assets

# 安全
JWT_SECRET=generate_a_random_64_character_hex_secret_key
```

---

## 5. 服务构建与启动

### 5.1 安装依赖并全量编译
```bash
# 在项目根目录执行
npm install
npm run build
```

### 5.2 启动服务端 API
```bash
# 方式一：Node 进程启动
node server/dist/index.js

# 方式二：PM2 进程守护
npm install -g pm2
pm2 start server/dist/index.js --name "road-gis-server" -i max
pm2 save
pm2 startup
```

---

## 6. Web GIS 管理前端部署

构建产物位于 `apps/web/dist/`，可使用 Nginx 作为静态服务器：

```nginx
server {
    listen 80;
    server_name gis.yourcompany.com;

    root /var/www/road-asset-system/apps/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 反向代理后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 视频断点续传支持大请求体与无缓冲流式传输
        client_max_body_size 100M;
        proxy_request_buffering off;
    }

    # 上传资源服务代理
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
        expires 30d;
    }
}
```

---

## 7. 车载 Android 终端构建指南

车载巡查端代码位于 `apps/mobile/`。

### 7.1 PWA 方式直接部署
构建产物 `apps/mobile/dist/` 直接部署于 Web 服务器，巡查员通过车载 Android 屏的 Chrome / Edge 浏览器打开，点击“添加至主屏幕”，即成为独立运行的 PWA 全屏应用，具备完全的离线持久化与后台缓存能力。

### 7.2 打包原生 APK (Capacitor)
```bash
cd apps/mobile
npm run build

# 初始化 Capacitor Android 工程
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "RoadPatrol" "com.road.patrol" --web-dir dist
npx cap add android
npx cap copy

# 在 Android Studio 中打开并构建签名 APK
npx cap open android
```

#### Android 权限配置 (`AndroidManifest.xml`)：
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
```
