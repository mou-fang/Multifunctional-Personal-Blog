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

## 维护规则

- 页面脚本只管理自己的页面逻辑，并通过 `window.__page_xxx = { mount, unmount }` 暴露生命周期。
- `mount(root)` 只查询当前页面根节点内的 DOM；需要全局能力时通过 `window.ClaudeOne`、`window.ClaudeOnePlayer` 或 router API 调用。
- `unmount()` 必须清理本页创建的事件监听、定时器、animationFrame、Worker、Object URL、异步请求和临时 DOM。
- 页面切换中的异步任务必须有 abort 或过期保护，不能在页面卸载后继续写旧 DOM。
- 全局能力只放在 `js/shell.js`、`js/player.js`、`js/router.js`、`js/config.js` 等公共模块。
- 页面 CSS 尽量使用页面命名空间，例如 `.page-ascii ...`、`.pixel-...`、`.compress-...`；全局 CSS 只放变量、基础布局、按钮、弹窗、Toast 等通用规则。
- localStorage key 统一使用 `claudeOne:*` 前缀；DeepSeek API Key 只能保存在浏览器 localStorage，不写死进代码，也不打印到日志。
- 不硬编码本机绝对路径。API 地址、限制和播放器参数优先放在 `js/config.js`。
- `music/` 里的用户音频和 `server/uploads/` 里的临时上传不应继续进入 Git；仓库只保留 `.gitkeep` 和生成的 `music/playlist.js`。

## 快速开始

### 前提条件

- [Node.js](https://nodejs.org/) LTS 版本（用于运行后端和音乐扫描）
- 可选：[Go](https://go.dev/dl/)（ASCII 艺术功能需要 `ascii-image-converter`）

### 一键启动

双击 `claudeOne/addmusic.bat`：

1. 启动 Express 服务器（前端 + 后端，端口 3001）
2. 扫描 `music/` 文件夹，提取音乐元数据生成播放列表
3. 打开浏览器访问 `http://localhost:3001`

之后往 `claudeOne/music/` 文件夹添加新歌曲，再次双击 `claudeOne/addmusic.bat` 即可更新播放列表。

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
- **播放模式**：顺序 / 随机 / 单曲循环，一键切换，右上角 Toast 提示
- **拖拽添加**：拖拽音频文件到播放器即可临时播放
- **来源标记**：显示当前曲目来自「项目文件夹」还是「音乐解锁」或「拖拽添加」

## 主题切换

右上角主题开关在两种风格之间切换：

- **Soft UI**（新拟物）：浅蓝色画布，凸起/凹陷的柔和阴影，没有可见边框
- **Liquid Glass**（液态玻璃）：网格背景 + 毛玻璃面板，多层堆叠阴影 + 透镜边缘 + 对角高光

切换时从开关位置播放涟漪动画，掩盖元素重排。
