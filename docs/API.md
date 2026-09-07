# RESTful API 接口规范说明书 (API.md)

---

## 1. 统一接口规范
- **基础路径**：`/api/v1`
- **请求/响应格式**：`application/json` (视频/照片上传采用 `multipart/form-data` 或 `application/octet-stream`)
- **鉴权方式**：`Authorization: Bearer <JWT_TOKEN>`
- **统一响应结构**：
```json
{
  "code": 200,
  "message": "success",
  "data": {},
  "timestamp": 1788772355450
}
```

---

## 2. 核心 API 矩阵

### 2.1 认证与用户 (`/api/v1/auth`)
* `POST /auth/login`：账号密码登录，获取 JWT Token、角色与用户信息。
* `GET /auth/me`：获取当前登录用户详情与权限列表。

### 2.2 巡查会话与生命周期 (`/api/v1/patrol`)
* `POST /patrol/sessions`：车载端启动巡查，创建巡查 Session（分配如 `PAT-20260907-0001`）。
* `PUT /patrol/sessions/:id/finish`：结束巡查，上报总里程、路产与异常统计，触发轨迹 LineString 聚合。
* `GET /patrol/sessions`：巡查历史列表分页查询（支持按道路、巡查员、时间范围筛选）。
* `GET /patrol/sessions/:id`：获取单个巡查会话详情（含轨迹、采集路产统计、视频列表）。

### 2.3 高频 GPS 轨迹流 (`/api/v1/tracks`)
* `POST /tracks/batch`：车载端批量上传高频 GPS 打点数组（支持批量 50~200 点/包，入库并更新瞬时位置）。
* `GET /tracks/session/:sessionId`：查询该次巡查全部清洗后的有效轨迹点序列（用于回放动画）。
* `GET /tracks/session/:sessionId/geojson`：以标准 GeoJSON LineString 输出该次巡查完整轨迹。

### 2.4 路产档案与空间检索 (`/api/v1/assets`)
* `GET /assets/types`：获取系统全部路产类型字典（含几何形态 POINT/LINESTRING/POLYGON、渲染颜色与图标）。
* `POST /assets`：车载端快速采集或后台新增路产（自动结合道路中心线计算标称桩号 `K127+350`）。
* `PUT /assets/:id`：修改路产信息（状态变更、文字说明、审核入库）。
* `GET /assets`：综合属性筛选分页（支持按道路 `road_id`、桩号区间 `K120~K130`、类型、状态）。
* `GET /assets/spatial/bbox`：GIS 地图视图视口范围检索，按 `minLng, minLat, maxLng, maxLat` 返回空间要素集合。
* `GET /assets/:id`：获取路产完整档案（含基本信息、照片列表、对应视频切片及精确定位偏移毫秒）。

### 2.5 视频切片与断点续传 (`/api/v1/videos`)
* `POST /videos/slices`：登记 5 分钟录像切片元数据（起止绝对时间、文件名、预估时长）。
* `POST /videos/upload/init`：断点续传初始化，返回当前切片已上传的字节数 `offset` 与 `upload_id`。
* `PATCH /videos/upload/chunk`：分块流式上传（Header: `Upload-Offset: <bytes>`，写入磁盘或MinIO分块，返回新偏移量）。
* `POST /videos/upload/complete`：上传完成确认，核验 MD5，触发切片可用状态。
* `GET /videos/locate`：根据传入的绝对时间戳 `timestamp`，自动匹配对应视频切片及内部播放偏移秒数。

### 2.6 GIS 图层与多格式导出 (`/api/v1/gis`, `/api/v1/export`)
* `GET /gis/roads`：获取辖区所有道路中心线与桩号数据 (GeoJSON)。
* `GET /gis/layers`：获取全部激活图层的要素集合。
* `GET /export/geojson`：根据筛选条件导出标准 GeoJSON 文件。
* `GET /export/kml`：导出 Google Earth / GIS 平台兼容的 KML 格式。
* `GET /export/csv`：导出路产台账 CSV 表格。

### 2.7 维修工单 (`/api/v1/maintenance`)
* `POST /maintenance`：上报病害/破损维修工单。
* `PUT /maintenance/:id`：维修流转处理（派工、维修完成上传现场对比照、结案）。
* `GET /maintenance`：工单列表分页。

### 2.8 统计报表 (`/api/v1/stats`)
* `GET /stats/dashboard`：获取首页大屏统计指标（总道路里程、路产总数、今日巡查公里、月度巡查趋势、病害分布饼图）。
