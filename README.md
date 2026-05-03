# claudeOne · 魔方工作台

一个前后端结合的个人工具工作台，以 3D 魔方为首页入口，通过顶部导航进入「游戏」和「工具箱」两大分类。纯原生 HTML/CSS/JS 实现，无构建步骤；内置全局音乐播放器，切页不中断；支持双主题一键切换。

## 项目架构

```
SPA 单页应用（Hash 路由）
├── index.html           SPA 壳子 + 所有页面模板
├── js/router.js         Hash 路由器，动态加载/卸载页面
├── js/page-registry.js  页面注册表（路由 → 模板/CSS/JS/生命周期）
├── js/player.js         全局音乐播放引擎（DOM 在 SPA 壳子之外，切页不中断）
├── js/shell.js          公共能力（导航、主题切换、Toast、弹窗、存储）
├── js/config.js         全局配置（API、限制、播放器参数等）
└── js/tool-cards.js     游戏/工具卡片数据与渲染
```

**核心设计：**
- **SPA 路由**：所有页面通过 `<template>` 标签内嵌在 `index.html`，切换页面时从模板克隆内容注入 `<main>` 槽位，旧页面先 `unmount()` 清理事件。
- **全局播放器**：播放器 DOM 在 `<main>` 之外，不受页面切换影响。支持展开/最小化两种状态。
- **双主题**：Soft UI（柔和拟物风）和 Liquid Glass（玻璃拟态风），CSS 变量驱动，播放器深度适配两种风格。
- **单端口服务**：Express 同时托管前端静态文件和 ASCII 转换 API，统一在 `localhost:3001`。

## 快速开始

### 前提条件

- [Node.js](https://nodejs.org/) LTS 版本（用于运行后端和音乐扫描）
- 可选：[Go](https://go.dev/dl/)（ASCII 艺术功能需要 `ascii-image-converter`）

### 一键启动

双击项目根目录下的 `addmusic.bat`：

1. 启动 Express 服务器（前端 + 后端，端口 3001）
2. 扫描 `music/` 文件夹，提取音乐元数据生成播放列表
3. 打开浏览器访问 `http://localhost:3001`

之后往 `music/` 文件夹添加新歌曲，再次双击 `addmusic.bat` 即可更新播放列表。

### 控制面板

双击 `control.bat` 提供完整管理菜单：

| 选项 | 功能 |
|------|------|
| Start All | 启动服务器 + 扫描音乐 + 打开浏览器 |
| Start Server Only | 仅启动服务器 |
| Scan Music Only | 仅重新扫描音乐文件夹 |
| Restart Server | 重启服务器 |
| Stop Server | 停止服务器 |

面板顶部显示服务器运行状态（RUNNING/STOPPED + PID）。

## 页面功能

### 首页

可交互的 3D 魔方（Three.js）。拖动旋转观察，松开后惯性自转。提供 12 个面转动按钮（U/U'/D/D'/L/L'/R/R'/F/F'/B/B'），支持键盘快捷键（字母键转面，Shift+字母反向，空格打乱，Esc 还原）。

### 游戏

| 页面 | 路由 | 说明 |
|------|------|------|
| **俄罗斯转盘** | `#/game` | 设定玩家人数和名字，拖拽排序，选择弹巢与子弹数量，三种结束规则，支持暴露/隐藏弹巢位置 |
| **推箱子** | `#/sokoban` | 10 个固定关卡从入门到地狱；随机模式内置 BFS 求解器验证可解性；深渊模式含唯一解验证 |

### 工具箱

| 页面 | 路由 | 说明 |
|------|------|------|
| **幸运抽奖** | `#/lottery` | 大转盘 + Web Crypto 真随机算法，管理参与者名单和奖项，中奖彩带效果 |
| **音乐解锁** | `#/music` | 纯浏览器端解密网易云/QQ 音乐加密文件（.ncm .qmc* .mflac .mgg 等），解密后自动加入全局播放器 |
| **ASCII 艺术** | `#/ascii` | 上传图片转为 ASCII 字符画，后端调用 Go 工具完成转换，支持彩色/灰度/盲文模式 |
| **图片像素化** | `#/pixel` | 上传图片生成复古像素风、8-bit 风、Game Boy 风或自定义调色板像素画，支持导出 PNG |
| **图片压缩** | `#/compress` | 浏览器本地压缩图片、调整尺寸、转换 JPG/PNG/WebP，支持批量处理和 ZIP 打包下载 |
| **二维码美化** | `#/qr` | 生成带 Logo、渐变色、圆点样式和自定义角标的高级二维码，支持 PNG/SVG 导出 |
| **DeepSeek 聊天** | `#/ai` | 对接 DeepSeek API，流式回复，思维链显示，推理强度调节，多轮对话 + 话题管理。Key 仅存 localStorage |

### 全局音乐播放器

固定在页面底部，展开态显示封面、歌曲信息、进度条和完整控制栏；最小化态收缩为右下角浮动窄条。

- **音乐来源**：`music/` 文件夹（自动扫描，支持 mp3/flac/wav/ogg/aac/m4a 等格式）
- **元数据提取**：自动从音频文件 ID3 标签读取歌名、歌手、专辑、封面图
- **封面回退**：内嵌封面 → 同目录同名图片 → cover.jpg → 默认渐变色
- **播放模式**：顺序 / 随机 / 列表循环 / 单曲循环，一键切换，右上角 Toast 提示
- **拖拽添加**：拖拽音频文件到播放器即可临时播放
- **来源标记**：显示当前曲目来自「项目文件夹」还是「音乐解锁」或「拖拽添加」

## 主题切换

右上角主题开关在两种风格之间切换：

- **Soft UI**（新拟物）：浅蓝色画布，凸起/凹陷的柔和阴影，没有可见边框
- **Liquid Glass**（液态玻璃）：网格背景 + 毛玻璃面板，多层堆叠阴影 + 透镜边缘 + 对角高光

切换时从开关位置播放涟漪动画，掩盖元素重排。

## 部署到本地

### 1. 下载项目

```bash
git clone https://github.com/mou-fang/eluosizhuanpan.git
cd eluosizhuanpan
```

或直接在 GitHub 页面点击 **Code → Download ZIP** 下载解压。

### 2. 安装依赖

```bash
cd claudeOne/server
npm install
```

### 3. 安装 Go 工具（ASCII 艺术需要）

```bash
# 安装 Go 后运行
go install github.com/TheZoraiz/ascii-image-converter@latest
```

确保 `ascii-image-converter` 在系统 PATH 中，否则 ASCII 转换功能不可用（其他功能不受影响）。

### 4. 启动

双击 `claudeOne/addmusic.bat` 一键启动，或手动：

```bash
cd claudeOne/server
node server.js
```

然后访问 `http://localhost:3001`。

### 5. 放置音乐

将音频文件（mp3/flac/wav 等）放入 `claudeOne/music/` 文件夹，重新运行 `addmusic.bat` 或在控制面板选择 "Scan Music Only" 更新播放列表。

## 目录结构

```
eluosizhuanpan/
├── README.md
├── claudeOne/
│   ├── index.html              SPA 壳子 + 所有页面模板
│   ├── addmusic.bat            一键启动器
│   ├── control.bat             服务器管理面板
│   ├── music/                  音乐文件夹
│   │   ├── .gitkeep
│   │   ├── playlist.js         自动生成的播放列表
│   │   └── *.mp3               用户放入的音乐文件
│   ├── scripts/
│   │   ├── scan-music.js       Node.js 音乐扫描器
│   │   └── scan-music.ps1      PowerShell 备选方案（已弃用）
│   ├── css/
│   │   ├── base.css            全局变量、重置、排版
│   │   ├── components.css      公共组件（按钮、卡片、弹窗、Toast 等）
│   │   ├── neumorphism.css     Soft UI 主题覆盖
│   │   ├── liquid-glass.css    Liquid Glass 主题覆盖
│   │   ├── animations.css      页面过渡动画
│   │   ├── player.css          全局播放器样式（双主题深度适配）
│   │   ├── cube.css            魔方 3D 样式
│   │   ├── games.css / tools.css  卡片网格
│   │   └── *.css               各页面独立样式
│   ├── js/
│   │   ├── config.js           全局配置
│   │   ├── theme-init.js       首屏主题初始化（防闪烁）
│   │   ├── shell.js            公共能力（导航、主题、Toast、弹窗）
│   │   ├── router.js           SPA Hash 路由器
│   │   ├── page-registry.js    页面注册表
│   │   ├── player.js           全局播放引擎
│   │   ├── tool-cards.js       游戏/工具卡片渲染
│   │   ├── cube.js             魔方 3D（Three.js）
│   │   ├── roulette.js         俄罗斯转盘
│   │   ├── sokoban.js          推箱子
│   │   ├── lottery.js          幸运抽奖
│   │   ├── music.js            音乐解锁
│   │   ├── decrypt-worker.js   解密 Web Worker
│   │   ├── ascii.js            ASCII 艺术
│   │   ├── pixel.js            图片像素化
│   │   ├── compress.js         图片压缩
│   │   ├── qr.js               二维码美化
│   │   └── ai.js               DeepSeek 聊天
│   ├── libs/
│   │   ├── pixelit/pixelit.js  像素化库
│   │   ├── jszip/jszip.min.js  ZIP 打包库
│   │   ├── qr-code-styling/    二维码渲染库
│   │   └── browser-image-compression/  图片压缩库
│   └── server/
│       ├── package.json
│       ├── server.js           Express 服务（前端静态 + ASCII API）
│       └── uploads/            上传临时目录
```

## 技术栈

- **前端**：原生 HTML / CSS / JavaScript，Three.js（CDN 引入）
- **路由**：Hash 路由 + `<template>` 模板克隆
- **后端**：Express（Node.js），multer 处理上传
- **ASCII 转换**：Go 编写的 `ascii-image-converter` 命令行工具
- **音乐元数据**：music-metadata（Node.js，ES Module）
- **主题**：CSS 自定义属性，无运行时开销
- **无构建步骤**：零依赖前端，所有库都是静态文件

## 浏览器兼容

推荐 Chrome、Edge、Firefox 最新版。

- 魔方需要 WebGL 支持
- 抽奖需要 `crypto.getRandomValues()`
- 音乐解锁需要 Web Worker + ES Module
- 主题动画需要 CSS `clip-path` 和 `backdrop-filter`
