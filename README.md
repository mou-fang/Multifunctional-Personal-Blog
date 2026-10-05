# 魔方的妙妙工具 · claudeOne

一个把实用工具、小游戏、游戏发售速报和音乐播放器放在一起的个人工作台。首页是一颗可以转动、打乱和还原的 3D 魔方；顶部导航连接「首页」「游戏」「游戏发售」「工具箱」。整个站点支持 **Soft UI** 与 **Liquid Glass** 两套主题。

前端采用原生 HTML、CSS 和 JavaScript，通过 Hash 路由切页，无需打包构建。Express 同时提供静态页面和后端接口，默认访问地址为 `http://localhost:3001`。

## 快速开始

先安装 Node.js（服务端使用原生 `fetch`，测试使用 `node:test`）。以下 PowerShell 命令均在**仓库根目录**执行；根目录没有 `package.json`。

```powershell
npm.cmd --prefix claudeOne/server ci
npm.cmd --prefix claudeOne/server start
```

打开 [本地工作台](http://localhost:3001)。不要直接双击 `index.html`：Worker、WebAssembly 和后端接口需要通过 HTTP 服务使用。

macOS / Linux 使用相同命令，将 `npm.cmd` 替换为 `npm`。

### Windows 启动入口

安装依赖后，也可以使用：

| 文件 | 用途 |
| --- | --- |
| [claudeOne/addmusic.bat](claudeOne/addmusic.bat) | 启动服务、扫描音乐、打开浏览器 |
| [claudeOne/control.bat](claudeOne/control.bat) | 启动、停止、重启服务，或单独更新歌单 |

两个批处理入口当前使用固定端口 `3001`。需要临时换端口时，使用命令行启动：

```powershell
$env:PORT = "3017"
npm.cmd --prefix claudeOne/server start
```

此时访问 `http://localhost:3017`。批处理按端口查找进程，使用停止或重启菜单前，应确认该端口属于本项目。

### 可选：ASCII 图片转换

ASCII 艺术需要服务端安装 `ascii-image-converter`。安装 Go 后执行：

```powershell
go install github.com/TheZoraiz/ascii-image-converter@latest
```

服务优先查找用户目录下的 `go/bin`，再从 `PATH` 查找命令。没有安装时，其他页面仍可使用。

## 现有功能

以下列出已有路由的页面。游戏中心和工具箱中的「即将推出」卡片属于占位内容，不代表功能已经实现。

游戏中心和工具箱的桌面首行各放两张卡片：游戏为「台球」「DOOM」，工具为「音乐解锁」「图片加密（混淆）」。后续卡片每行三张等宽排列，已上线内容自动排在「敬请期待」占位卡片前；新增入口沿用该排序。屏幕宽度不超过 900px 时后续卡片改为两列，不超过 600px 时全部改为一列。

### 工具箱

进入 `#/tools` 查看工具卡片。

| 工具 | 路由 | 功能 |
| --- | --- | --- |
| 颜色工具 | `#/colors` | 屏幕 / 图片取色、框选提取配色、色卡备注与排序、撤销重做、保存方案、PNG / SVG / JSON / CSS 导出，以及自动配色、渐变、对比度与色觉预览 |
| 二维码解析 | `#/qr-reader` | 拖入、选取或粘贴图片，识别链接、文本、Wi-Fi、邮件、电话和名片；可复制原文，网页链接可手动打开 |
| 二维码制作 | `#/qr` | 生成二维码，调整 Logo、颜色、渐变和点阵样式，导出 PNG / SVG |
| 拼豆工坊 | `#/beads` | 图片转拼豆图纸，提供色卡映射、图层精修、文字与形状、材质预览、逐色制作引导及导出 |
| 图片加密（混淆） | `#/scramble` | PixelFlux 可逆像素与颜色混淆，导出可还原 PNG；还原需要保留原始导出文件中的信息 |
| 图片压缩 | `#/compress` | 批量压缩、调整尺寸、转换 JPG / PNG / WebP，可打包下载 |
| 图片像素化 | `#/pixel` | 把图片转换为像素画，调整调色板与视觉效果，导出 PNG |
| 视频转 GIF | `#/videogif` | 本地导入视频、裁剪、选取片段、调整帧率和输出尺寸，生成 GIF |
| ASCII 艺术 | `#/ascii` | 图片转字符画，支持彩色、灰度与盲文等模式；通过后端转换 |
| 音乐解锁 | `#/music` | 处理 NCM、QMC 等支持的音乐格式；部分 QQ 音乐文件需通过后端获取密钥 |
| 幸运抽奖 | `#/lottery` | 管理参与者和奖项，通过转盘完成随机抽奖 |
| DeepSeek 聊天 | `#/ai` | 流式对话、话题管理、提示词和模型设置，需要用户提供 API Key |
| 播放歌单 | `#/playlist` | 浏览和播放歌单，与全局播放器共用播放状态 |

二维码解析在浏览器本地运行，支持 PNG、JPG、WebP、GIF 和 BMP，每次一张、最大 20 MB。待机时，二维码像素会飞向右侧组成短句或链接；演示文案按轮随机打乱，不连续重复，导入真实图片后停止演示。PixelFlux 用于视觉混淆，不应当作敏感资料的安全加密方案。

颜色工具支持拖入、上传或粘贴 PNG、JPG、WebP、GIF、BMP 图片（每次一张，最大 20 MB / 4000 万像素；GIF 读取第一帧）。可点击图片读取原始像素颜色，也可拖动框选或输入百分比选区，只提取模型等目标区域的配色。图片提色采用本地 Worker 中的 Color Thief 3.5.0，来源和 MIT 许可证见 [库说明](claudeOne/libs/color-thief-3.5.0/README.md)。换图、移除图片、切页都会取消旧任务。

屏幕取色通过浏览器 EyeDropper API 实现，桌面 Chrome / Edge 在 HTTPS 或 localhost 环境下可取浏览器窗口外的可见颜色，用户点击启动并点选，Esc 取消。不支持时显示提示并保留图片取色。手动输入支持不透明 HEX、RGB 和 HSL，并提供色相、饱和度、明度微调。使用帮助在按钮下方的小窗口中显示，点击外部、关闭按钮或按 Esc 可收起，不推开主操作区。

一套色卡最多 40 色，支持备注、拖动或按钮排序、删除、撤销 / 重做；可比较白 / 灰 / 黑底色上的搭配效果。草稿自动保存在当前浏览器，最多保存 30 套命名方案；保存过的方案再次保存会更新，可打开副本另存。JSON 导出 / 导入用于跨设备备份，PNG / SVG 用于分享，CSS 用于开发；导出后提供文件预览和再次下载链接。图片与配色不发送到服务器；浏览器清除站点数据会删除本地方案，请使用导出备份。

“更多颜色工具”提供四种 HSL 自动配色关系、2–8 节点的线性 / 径向渐变及预设（可复制 CSS、导出 PNG）、WCAG 文字对比度，以及基于 Machado 2009 模型的红 / 绿 / 蓝色觉和灰度近似预览。显示颜色用于设计参考，不等于实体模型漆色号或真实混漆配方。外围控件同时适配两套主题，色块和图片保持原色，不叠加主题滤镜。

### 游戏

进入 `#/games` 查看游戏卡片。

| 游戏 | 路由 | 玩法 |
| --- | --- | --- |
| 无界穿梭：天际城 | `#/city-shuttle` | 程序生成城市中的高速飞行与空中任务，支持第一 / 第三人称；需要 PC 键鼠与 WebGL2 |
| DOOM | `#/doom` | 基于 doomgeneric 与 Freedoom 数据的 WebAssembly 射击游戏 |
| 推箱子 | `#/sokoban` | 固定关卡与随机生成关卡 |
| 重力扫雷 | `#/minesweeper` | 翻开空格后方块下落，结合数字和重力变化推理 |
| 贪吃蛇竞技场 | `#/snake` | 多 AI 对手、大地图、能力道具与障碍物 |
| 中式八球 | `#/billiards` | 单人练习、人机对战与规则说明 |
| Only Up | `#/onlyup` | 像素风垂直攀爬与多场景挑战 |
| 深渊协议 | `#/abyss` | 自动攻击、生存、升级、武器进化与 Boss 战 |
| 俄罗斯转盘 | `#/game` | 自定义玩家、弹巢和结束规则的聚会小游戏 |

`#/anomaly-bureau` 和 `#/ascii-void` 是天际城的兼容入口，不是另外两款游戏。

### 游戏发售

独立导航 `#/game-releases` 展示未来约 8 周的发售清单，按月份排列，支持中文 / 英文名称搜索、平台筛选、信息来源以及当周 1440px 无损 PNG 原图查看和下载。「显示本期已发售游戏」默认勾选，可取消以只看今日及未来发售的游戏；每周新清单会替换展示内容，不作为永久发售档案。顶部介绍和筛选采用紧凑布局，卡片在同一行展示发售日期及其右侧的倒计时；两者使用 Soft UI 的柔和阴影或 Liquid Glass 的透明材质，不使用按日期状态区分的颜色。日期按发布任务配置的时区判断（默认北京时间），依次显示「N 天后」「今日发售」「已发售」。页面可见时每分钟检查跨天，从后台返回或窗口重新获得焦点时立即检查；隐藏时停止定时检查，离开页面后清理定时器及监听。此状态按已公布日期计算，不代表实时验证了商店解锁时间或延期消息。没有发布数据时显示首期等待状态，不提供虚构游戏信息；超过 8 天未更新时显示提醒。

同服务器 OpenClaw 通过 `claudeOne/scripts/publish-game-releases.js` 本地发布。`GET /api/game-releases` 和受限的图片读取路由均为公开只读；不提供 HTTP 写入、上传或导入接口。发布器检查 10–15 条、日期窗口、平台、图片清单一致性、至少 10 张不同封面及 PNG 完整性，使用发布锁和原子替换，并保留上一版。数据默认位于仓库根目录 `.game-release-data/`，必须在 `claudeOne/` 静态目录之外。内部 `server/`、`scripts/`、`test-results/` URL 禁止静态访问。

服务器部署、数据格式、权限、发布与验证命令见 [游戏发售接入说明](docs/game-releases-deployment.md)。可完整复制的 OpenClaw 任务提示词见 [周二游戏发售任务](docs/openclaw-game-news-weekly-prompt.md)。源文件中不包含真实发布数据。

游戏发售页的 CSS、核心脚本和页面脚本使用带版本号的资源 URL；修改这些文件时，同时更新 `page-registry.js` 中三个 URL 的 `v` 参数以及 `index.html` 中注册表脚本的 `v` 参数，再一起部署。这样已访问过的浏览器会请求新版资源，避免继续使用动态加载资源的旧缓存。若线上仍显示旧版，在 Chrome / Edge 按 F12，打开 Network（网络），勾选 Disable cache（停用缓存），保持开发者工具打开并刷新；这一步无需清除站点本地存储中的主题、配色方案等数据。

### 首页与全局功能

- **首页 `#/home`**：基于 CSS 3D 与 JavaScript 的交互魔方，支持转面、打乱、还原和散开效果。
- **GitHub 项目入口**：页头使用本地 SVG 显示 GitHub 官方 Invertocat 图标（2026 年品牌素材），点击打开项目仓库；素材来源与使用约定见 [GitHub 官方品牌说明](https://brand.github.com/foundations/logo)，标志版权与商标归 GitHub 所有。
- **音乐播放器**：每次打开、刷新或通过浏览器返回网站时均以最小化状态呈现，恢复上次歌单歌曲与进度并保持暂停，点击播放后继续；没有播放记录时载入第一首，可手动展开。页面切换不中断播放，支持播放进度、音量、顺序 / 随机 / 单曲循环，以及本地音频拖入；拖入或音乐工具添加的音频为当前页面会话的临时曲目，不跨次访问保存。
- **全站 AI 助手**：提供对话与已接入页面的操作能力，执行范围受页面适配器和动作白名单限制。
- **访问统计**：依据可见页面中的用户交互发送匿名心跳，过滤常见自动化信号；这是启发式统计，并非严格的真人身份验证。

## 两套 UI 风格

| 主题 | 视觉基调 | 相关文件 |
| --- | --- | --- |
| Soft UI（`neumorphism`） | 浅蓝底色、柔和凸起 / 凹陷阴影；共享低对比度紫青柔光背景，当前强度为 45% | [neumorphism.css](claudeOne/css/neumorphism.css)、[softui-background.css](claudeOne/css/softui-background.css) |
| Liquid Glass（`liquid-glass`） | 浅色网格背景、半透明玻璃面板、边缘高光和多层阴影，文字保持深色可读 | [liquid-glass.css](claudeOne/css/liquid-glass.css) |

右上角开关切换主题，选择保存在本机浏览器。两套主题共用布局和交互，通过 [base.css](claudeOne/css/base.css) 中的颜色、阴影、圆角和间距变量表达各自材质。

## 音乐、配置与数据

### 更新本地歌单

将音频放入 `claudeOne/music/`，然后运行：

```powershell
node claudeOne/scripts/scan-music.js
```

扫描器生成 `claudeOne/music/playlist.js`。若安装了可选的 `music-metadata`，会读取音频标签和内嵌封面；当前服务端依赖清单不包含该包，缺少时回退到文件名和同目录封面图片。音频能否播放还取决于浏览器的编解码支持。

### 配置入口

- [config.js](claudeOne/js/config.js)：API 地址、DeepSeek 设置、主题默认值、播放器与部分工具限制。页面自身的限制还需查看对应模块。
- [server.js](claudeOne/server/server.js)：服务端路由、上传限制、静态资源和音乐接口。

| 环境变量 | 默认值 / 用途 |
| --- | --- |
| `PORT` | `3001`，HTTP 监听端口 |
| `GAME_RELEASE_DATA_DIR` | 默认仓库根目录 `.game-release-data/`；发售数据与图片的持久化私有目录，必须位于 `claudeOne/` 之外 |
| `GAME_NEWS_TIMEZONE` | 本地发布器默认 `Asia/Shanghai`，校验任务当天日期；网站按快照记录的时区显示日期 |
| `VISITOR_DATA_FILE` | 默认 `claudeOne/server/data/visitor-stats.json`，访客统计持久化文件 |
| `TRUST_PROXY` | 设为 `1` 或 `true` 启用 Express 代理信任；按实际反向代理部署配置 |
| `RATE_LIMIT_VISITOR_STATS` | 默认每 IP 每分钟 120 次统计请求 |
| `RATE_LIMIT_MUSIC_EKEY` | 默认每 IP 每小时 200 次密钥请求 |
| `RATE_LIMIT_MUSIC_METADATA` | 默认每 IP 每小时 200 次音乐元数据请求 |

### 本地处理与网络请求

二维码解析、颜色工具、拼豆、像素化、压缩、图片混淆和视频转 GIF 的主要处理在浏览器内完成。ASCII 图片会提交到本站后端；DeepSeek 对话会发送到配置的服务地址；部分 QQ 音乐流程会通过本站后端访问音乐服务。页面还会加载外部字体并发送本站访问统计心跳，因此“图片本地处理”不等于“整个站点完全离线”。

DeepSeek API Key 保存在浏览器本地存储，调用时用于向配置的 API 服务认证。QQ 音乐授权信息由后端短期保存在内存会话中。不要将密钥、Cookie、用户音频和临时上传写入仓库。

对外部署时使用 HTTPS；访客统计需要持久化保存上述数据文件。DOOM 的静态资源、许可证与部署注意事项见 [DOOM 资源说明](claudeOne/libs/doom/README.md)。`libs/` 当前有一年不可变缓存，更新库文件时应同步采用新资源路径或版本目录。

## 项目结构

```text
.
├── README.md                    使用说明与维护规范
├── AGENTS.md                    代码代理进入项目时遵循的规则
├── .gitignore                   用户媒体、依赖与临时产物排除规则
└── claudeOne/
    ├── index.html               SPA 外壳、共享组件与页面 template
    ├── addmusic.bat / control.bat
    ├── css/
    │   ├── base.css             主题变量、基础布局与排版
    │   ├── components.css       通用组件结构
    │   ├── neumorphism.css      Soft UI 组件材质
    │   ├── liquid-glass.css     Liquid Glass 组件材质
    │   ├── softui-background.css
    │   └── *.css                页面样式
    ├── js/
    │   ├── config.js            公共配置
    │   ├── theme-init.js        首屏主题初始化
    │   ├── shell.js             导航、主题、Toast 等共享能力
    │   ├── page-registry.js     页面元数据、资源、生命周期与导航分类
    │   ├── router.js            Hash 路由与页面挂载 / 卸载
    │   ├── tool-cards.js        游戏和工具入口
    │   ├── player.js            全局音乐播放器
    │   ├── assistant.js         全站 AI 助手与页面适配
    │   └── *.js                各工具、游戏、核心算法与 Worker
    ├── libs/                   随项目提供的第三方库、WASM 与许可证
    ├── scripts/                音乐扫描与控制面板辅助脚本
    ├── music/                  用户音频及生成的 playlist.js
    └── server/
        ├── package.json / package-lock.json
        ├── server.js           Express 服务入口
        ├── *test.js / fixtures/ 回归测试与必要样例
        ├── data/               运行时统计数据
        └── uploads/            临时上传文件
```

## 维护规则

### 1. 新增内容必须符合两套 UI 的美术风格

**新增或修改工具、游戏、组件和动画时，必须同时适配 Soft UI 与 Liquid Glass。只完成一种主题不算完成。**

- 优先复用 `.card`、`.btn`、`.input`、`.pill` 等公共组件，以及 `--bg`、`--surface`、`--ink`、`--accent`、`--shadow-*`、`--radius-*`、`--space-*` 等变量。不要在通用控件上写死只适合某一主题的背景、文字颜色或阴影。
- **Soft UI** 沿用浅蓝色基调、柔和层次与凸凹阴影；保持共享紫青柔光背景克制，不给每个卡片另铺高饱和渐变。
- **Liquid Glass** 沿用浅色网格、透明材质、边缘高光与玻璃阴影；检查透明叠加后文字、输入框和按钮是否仍清晰可读。
- 主题专属规则以 `body[data-theme="neumorphism"]` 或 `body[data-theme="liquid-glass"]` 限定作用范围。修改一个主题时，应确认另一个主题没有被连带改变。
- 游戏场景、图片预览和像素艺术可保留内容本身的色彩；外围导航、工具栏、说明、弹窗和按钮仍须适配两套主题。Canvas 内容若采用主题配色，也要响应主题切换。
- 交互以简单直白为先：突出主操作，清楚显示空状态、处理中、成功和失败；检查 hover、按下、选中、禁用、键盘焦点与长文本状态。
- 游戏中心与工具箱的桌面首行各放两张指定卡片（游戏：台球、DOOM；工具：音乐解锁、图片加密），后续每行三张等宽卡片。用显式分组标记首行，已上线卡片自动排在敬请期待的占位卡片之前；窄屏适配两列或一列，不按卡片序号设置跨列。
- 装饰动画应可暂停或遵循减少动态效果偏好；在页面隐藏、卸载或开始实际处理时按需要停止，避免干扰操作。
- 交付前实际切换两套主题，检查桌面和窄屏的截图与主要流程。明确仅支持 PC 的游戏，应在移动端给出清晰提示，站点导航和提示页面仍应正常显示。

### 2. 页面接入与导航

新页面须完成以下接入，不能只添加一个 HTML 文件：

1. 在 `claudeOne/index.html` 添加页面 `<template>`。
2. 在 `claudeOne/js/page-registry.js` 注册 `title`、`description`、`templateId`、`css`、`js`、`lifecycle` 和 **`navSection`**。
3. `navSection` 只能为 `home`、`games`、`tools`、`game-releases`；工具页归 `tools`，游戏页归 `games`，游戏发售归独立分类 `game-releases`，兼容地址与目标页保持一致。导航归属统一由注册表维护，不另建页面白名单。
4. 在 `tool-cards.js` 添加对应分类入口；需由 AI 助手操作时，再更新 `assistant.js` 的页面说明和动作适配。
5. 暴露 `window.__page_xxx = { mount, unmount }`，相关核心逻辑必须先于页面脚本加载。
6. 检查直接打开 Hash 地址、刷新、前进后退、卡片跳转以及导航选中态，并更新本 README 的功能表。

### 3. 生命周期与模块边界

- `mount(root)` 中的页面 DOM 查询应限定在传入根节点内。全局能力通过 `window.ClaudeOne`、播放器和路由器接口使用。
- `unmount()` 清理本页创建的监听、定时器、动画帧、Worker、Object URL、观察器和临时 DOM；取消未完成请求，或用任务标识丢弃过期结果。
- 连续换文件、取消、重试、切页后返回都不能写入旧结果，也不能重复启动后台任务。
- 耗时图像 / 媒体计算优先放入 Worker；可复用算法放入 `*-core.js`，界面逻辑留在页面模块。
- 页面 CSS 使用独立类名前缀，避免裸 `button`、`canvas`、`h1` 等选择器影响其他页面。全局基础样式只放共享规则。
- 共享播放器、助手和主题背景由站点外壳管理，页面不得重复创建或意外销毁。

### 4. 配置、依赖与仓库卫生

- 不硬编码开发者电脑路径。公共配置集中到 `config.js` 或后端环境变量；本地存储键使用 `claudeOne:*` 前缀。
- 用户输入和二维码内容按文本渲染，不直接作为 HTML 执行；识别出的链接不自动打开。
- 不把 API Key、Cookie、授权令牌写入源码或日志。保留与当前任务无关的修改。
- 新增第三方库应保留来源、版本和许可证；遵循现有无构建架构，避免无必要引入构建链。
- 用户音乐、临时上传、统计数据、依赖目录、浏览器配置、截图与一次性测试产物遵循 `.gitignore`。必要的正式回归测试及 fixtures 保留在仓库。
- 一次性验证产物放入已忽略的 `output/`，完成后清理本次创建且不再需要的文件；不要为了清理删除用户媒体或其他任务产物。

### 5. 验证与文档同步

从仓库根目录执行已有回归测试：

```powershell
npm.cmd --prefix claudeOne/server test
```

按改动范围做必要验证：纯逻辑或缺陷修复补充有实际价值的回归检查；UI 修改检查两套主题和真实操作流程；文件工具至少确认成功、错误、取消 / 换文件和切页清理。不要仅凭页面显示成功就认定处理或导出结果正确。

新增功能、修改启动方式、配置、依赖或维护要求时，同步更新 README；规则变更也应同步 [AGENTS.md](AGENTS.md)。文档只描述已经实现的能力，避免把占位卡片、旧别名或计划中的功能写成已上线功能。
