# 魔方的妙妙工具

一个前后端结合的个人工具工作台，以 3D 魔方为首页入口，集合了游戏、抽奖、AI 聊天、音乐解锁、ASCII 艺术等七个功能页面。前端采用原生 HTML/CSS/JS，无构建步骤；后端使用 Express 提供 ASCII 图片转换 API。

## 魔方首页

首页是一个可交互的 3D 魔方，使用 Three.js 渲染。

你可以拖动旋转魔方观察每个面的颜色分布，松开后魔方会以缓慢的惯性自动旋转。下方提供 12 个面转动按钮（U / U' / D / D' / L / L' / R / R' / F / F' / B / B'），也支持键盘快捷键：按字母键转动对应面，按住 Shift 反向转动。空格键打乱魔方，Esc 键还原到初始状态。

魔方两侧环绕着项目导航卡片，点击即可进入各个工具页面。右上角的主题开关可以在 Soft UI（柔和拟物风格）和 Liquid Glass（玻璃拟态风格）之间实时切换，两种风格都是 1:1 像素级复刻。

## 工具页面一览

| 页面 | 说明 |
|------|------|
| **俄罗斯转盘** | 设定玩家人数和名字，拖拽排序，选择弹巢与子弹数量，三种结束规则。支持暴露/隐藏弹巢位置 |
| **推箱子** | 10 个固定关卡从入门到地狱难度；随机模式内置 BFS 求解器验证可解性；深渊难模式含唯一解验证 |
| **DeepSeek 聊天** | 对接 DeepSeek V4 API，支持流式回复、思维链显示、推理强度调节。Key 只存本地 localStorage |
| **幸运抽奖** | 大转盘 + 真随机算法（Web Crypto），管理参与者名单和奖项，中奖彩带效果 |
| **音乐解锁** | 纯浏览器端解密网易云/QQ 音乐加密文件，支持 .ncm .qmc* .mflac .mgg 等格式 |
| **ASCII 艺术** | 上传图片转为 ASCII 字符画，Express 后端调用 Go 工具完成转换，支持彩色/灰度/盲文模式 |

## 如何从零开始部署到本地

以下步骤假设你从未用过 GitHub 和命令行，每一步都有截图式说明。

### 第一步：下载项目代码

有三种方式，选一种即可。

**方式 A：直接下载 ZIP（最简单）**

1. 打开浏览器，访问：`https://github.com/mou-fang/eluosizhuanpan`
2. 找到页面上的绿色按钮 **Code**，点击它
3. 在弹出的菜单里点击 **Download ZIP**
4. 浏览器会下载一个压缩包，下载完成后解压到你想要的文件夹
5. 解压后你会看到一个 `eluosizhuanpan-main` 文件夹，里面就是全部代码

**方式 B：用 Git 克隆（如果你已经装了 Git）**

1. 打开终端（Windows 用户：按 Win 键，输入 `cmd` 或 `powershell`，回车）
2. 进入你想放项目的目录，比如桌面：
   ```
   cd Desktop
   ```
3. 执行克隆命令：
   ```
   git clone https://github.com/mou-fang/eluosizhuanpan.git
   ```
4. 等待下载完成，桌面上会出现 `eluosizhuanpan` 文件夹

**方式 C：用 GitHub Desktop（有图形界面）**

1. 下载安装 [GitHub Desktop](https://desktop.github.com/)
2. 打开后，点击 **File → Clone repository**
3. 选择 URL 标签页，输入：`https://github.com/mou-fang/eluosizhuanpan`
4. 选择本地存放路径，点击 **Clone**

### 第二步：安装必需软件

项目需要 Node.js 来运行后端服务。如果你的电脑还没有装，按下面步骤安装：

1. 访问 [nodejs.org](https://nodejs.org/)
2. 下载左侧的 **LTS 版本**（长期稳定版）
3. 双击安装包，一路点 Next 即可（Mac 同理）

装好后验证一下。打开终端（Win 键 → 输入 `cmd` → 回车），输入：
```
node -v
```
如果看到版本号（比如 v20.x.x），说明安装成功。

### 第三步：启动后端

ASCII 艺术功能依赖后端将图片转为字符画，后端还需要调用一个 Go 写的命令行工具。一次性配好后，就不用管它了。

**安装 Go 和 ascii-image-converter**

1. 访问 [go.dev/dl](https://go.dev/dl/)，下载 Windows 安装包，一路 Next
2. 打开终端，运行：
   ```
   go install github.com/TheZoraiz/ascii-image-converter@latest
   ```

**安装后端依赖并启动**

1. 在终端中进入 `server` 文件夹。如果你把项目放在了桌面：
   ```
   cd Desktop\eluosizhuanpan-main\claudeOne\server
   ```
   （如果用了 Git 克隆，把 `eluosizhuanpan-main` 换成 `eluosizhuanpan`）
2. 安装依赖（只需运行一次）：
   ```
   npm install
   ```
3. 启动后端服务：
   ```
   npm start
   ```
4. 看到 `[ascii] Server running on http://localhost:3001` 就说明后端启动成功了

这个终端窗口不要关，让它一直运行着。

### 第四步：启动前端

再打开一个**新的终端窗口**（Win 键 → 输入 `cmd` → 回车），进入 `claudeOne` 文件夹：

```
cd Desktop\eluosizhuanpan-main\claudeOne
```

**推荐方法：用 Python 启一个本地服务器**

Windows 通常自带 Python。如果没有，先去 [python.org](https://www.python.org/downloads/) 下载安装（安装时一定要勾选 "Add Python to PATH"）。

```
python -m http.server 8080
```

看到 `Serving HTTP on 0.0.0.0 port 8080` 就说明成功了。

**备选方法：用 Node.js（你已经装了）**

```
npx http-server -p 8080
```

然后打开浏览器，访问：**http://localhost:8080**

现在所有功能都可以正常使用了。两个终端窗口各司其职：
- 第一个终端跑后端（端口 3001），负责 ASCII 图片转换
- 第二个终端跑前端（端口 8080），负责网页界面

### 第五步：使用 DeepSeek 聊天

1. 访问 **http://localhost:8080/ai.html**
2. 首次打开会弹出 API Key 输入框。你需要去 [DeepSeek 控制台](https://platform.deepseek.com/api_keys) 注册并生成一个 Key
3. 将 Key（以 `sk-` 开头）粘贴到输入框，点击保存
4. Key 只保存在你的浏览器本地，不会上传到任何服务器

## 目录结构

```
eluosizhuanpan/
├── README.md
└── claudeOne/
    ├── index.html          首页（魔方工作台）
    ├── game.html           俄罗斯转盘
    ├── sokoban.html        推箱子
    ├── ai.html             DeepSeek 聊天
    ├── lottery.html        幸运抽奖
    ├── music.html          音乐解锁
    ├── ascii.html          ASCII 艺术
    ├── css/                样式文件
    │   ├── base.css            全局变量与基础样式
    │   ├── components.css      公共组件（按钮、卡片、弹窗等）
    │   ├── neumorphism.css     Soft UI 主题
    │   ├── liquid-glass.css    Liquid Glass 主题
    │   ├── animations.css      页面动画
    │   ├── cube.css            魔方样式
    │   ├── lottery.css         抽奖样式
    │   ├── sokoban.css         推箱子样式
    │   ├── music.css           音乐解锁样式
    │   └── ascii.css           ASCII 艺术样式
    ├── js/                 脚本文件
    │   ├── config.js           全局配置
    │   ├── theme-init.js       首屏主题初始化
    │   ├── shell.js            公共能力（主题切换、toast、弹窗等）
    │   ├── cube.js             魔方 3D 逻辑
    │   ├── roulette.js         俄罗斯转盘逻辑
    │   ├── ai.js               DeepSeek 聊天逻辑
    │   ├── lottery.js          幸运抽奖逻辑
    │   ├── sokoban.js          推箱子逻辑
    │   ├── music.js            音乐解锁逻辑
    │   ├── decrypt-worker.js   解密 Web Worker
    │   └── ascii.js            ASCII 艺术逻辑
    └── server/              后端服务
        ├── package.json
        ├── server.js           Express API（ASCII 图片转换）
        └── uploads/            上传文件临时目录
```

## 浏览器兼容

推荐 Chrome、Edge、Firefox、Safari 最新版。

- 抽奖功能需要浏览器支持 `crypto.getRandomValues()`
- 音乐解锁需要浏览器支持 Web Worker 和 ES Module
- 魔方 3D 需要浏览器支持 WebGL
