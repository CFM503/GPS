# Android APK 打包与编译构建指南 (ANDROID_BUILD.md)

本文档说明如何将“道路路产智能巡查系统”移动巡查端编译打包为 Android 安装包（`.apk`）。

---

## 一、项目架构与源码目录

移动端采用现代 **Capacitor 5 原生 Android 容器** 架构：
- **Web 前端工程**：`apps/mobile/`（基于 React 18 + Vite + TypeScript + Tailwind CSS）
- **原生 Android 工程**：`apps/mobile/android/`
  - 原生主工程配置：`apps/mobile/android/build.gradle`
  - App 模块配置：`apps/mobile/android/app/build.gradle`
  - 权限与清单文件：`apps/mobile/android/app/src/main/AndroidManifest.xml`
  - 静态资源落盘目录：`apps/mobile/android/app/src/main/assets/public/`

---

## 二、编译环境准备 (Prerequisites)

在准备编译 APK 的机器上，需具备以下基础开发环境：
1. **Node.js**：v18.x 或 v20.x
2. **Java 开发套件 (JDK)**：OpenJDK 21（推荐 Eclipse Temurin 21 或 Microsoft OpenJDK 21，Capacitor 8 原生构建要求 Java 21）
   - 配置环境变量 `JAVA_HOME` 指向 JDK 21 根目录。
3. **Android SDK**：
   - 建议安装最新版 **Android Studio Ladybug (2024.2+)** 或 **Android SDK Command-line Tools**。
   - SDK 目标版本：`compileSdkVersion 34`，`targetSdkVersion 34`，`minSdkVersion 22`。
   - 配置环境变量 `ANDROID_HOME`（如 `C:\Users\<User>\AppData\Local\Android\Sdk`）。

---

## 三、标准构建流程

### 步骤 1：编译移动端 Web 资源并同步至 Android 原生工程
在项目根目录下执行：
```bash
# 1. 编译 mobile 前端生产 bundle
npm run build --workspace=@road-gis/mobile

# 2. 将 bundle 产物同步到 android 原生工程的 assets 目录
cd apps/mobile
npx cap copy android
```

---

### 步骤 2：生成 Debug APK

#### 方式 A：使用 Android Studio 图形界面编译（推荐）
1. 启动 **Android Studio**。
2. 选择 **Open**，打开目录：`apps/mobile/android`。
3. 等待 Gradle 自动完成依赖同步与索引构建。
4. 顶部菜单栏依次点击：
   **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**。
5. 构建完成后，右下角将弹出通知，点击 `locate` 即可打开 APK 所在文件夹。

#### 方式 B：使用 Gradle 命令行一键构建
进入 Android 原生目录执行构建脚本：
```bash
# Windows (PowerShell / CMD)
cd apps/mobile/android
.\gradlew.bat assembleDebug

# macOS / Linux
cd apps/mobile/android
chmod +x gradlew
./gradlew assembleDebug
```

---

## 四、编译产物输出路径

编译成功后，Debug APK 输出于：
```
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 五、安装与真机调试

通过 USB 数据线连接 Android 手机，开启手机的“开发者模式”和“USB 调试”，执行：
```bash
# 安装到手机
adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk

# 实时查看定位与同步日志
adb logcat -s Capacitor/Console
```

---

## 六、构建环境现状说明 (真实环境约束)

- **当前开发机器现状**：当前主机未全局配置本地 Java JDK 17 及 Android SDK 命令行工具。
- **产物就绪情况**：
  - Capacitor 原生 Android 项目骨架已生成完毕。
  - 所有权限（精确定位、后台定位、相机、录音、前台保活服务、电池优化白名单）已在 `AndroidManifest.xml` 中完整声明。
  - Web 生产资源已通过 `npx cap copy android` 同步进 `apps/mobile/android/app/src/main/assets/public/`。
  - 开发者或测试人员在安装有 Android Studio / JDK 17 的环境中，打开 `apps/mobile/android` 即可立即生成标准 APK。
