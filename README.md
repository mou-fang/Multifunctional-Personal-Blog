# 魔方的妙妙工具

一个纯前端的个人工具工作台项目。项目主体在 `claudeOne/` 目录下，不依赖构建工具，也不需要安装 npm 包；直接用浏览器打开 HTML，或用任意静态服务器启动即可使用。

当前工作台包含四个主要页面：

- 首页魔方工作台
- 俄罗斯转盘小游戏
- DeepSeek 聊天工具
- 幸运抽奖活动

## 项目定位

这个项目不是传统后台，也不是单一游戏页面，而是一个带有统一视觉系统的“妙妙工具”集合。首页用可交互魔方作为入口视觉，其他页面则围绕具体工具展开。

整体设计目标：

- 看起来像一个完整的小型产品，而不是几个散落的 demo。
- 每个工具都有自己的主题气质，但导航、按钮、输入框、卡片、弹窗等基础体验保持统一。
- 所有页面都可以独立打开，不依赖后端服务。
- 用户状态尽量保存在浏览器本地，刷新页面后仍能继续使用。

## 视觉风格

项目内置两套主题，可通过右上角开关切换。

### Soft UI

默认主题。视觉关键词是柔和、浅色、拟物、低对比阴影。

主要特点：

- 浅蓝色背景。
- 凸起和内凹阴影模拟软质界面。
- 按钮、卡片、输入框都有柔和浮起感。
- 适合工具型界面，阅读压力较低。

### Liquid Glass

玻璃拟态主题。视觉关键词是半透明、折射、高光、轻质。

主要特点：

- 近白色背景和细网格纹理。
- 组件带有玻璃边缘、高光和轻微模糊。
- 弹窗、卡片、按钮会表现为半透明玻璃面板。
- 保持深色文字，保证可读性。

### 页面风格统一方式

公共设计变量和组件集中在：

- `claudeOne/css/base.css`
- `claudeOne/css/components.css`
- `claudeOne/css/neumorphism.css`
- `claudeOne/css/liquid-glass.css`
- `claudeOne/css/animations.css`


## 页面功能

### 首页：魔方工作台

入口文件：

- `claudeOne/index.html`
- `claudeOne/js/cube.js`
- `claudeOne/css/cube.css`

首页以 3D 魔方为核心视觉和交互对象。

功能包括：

- 可拖动旋转魔方。
- 魔方在空闲时自动缓慢转动。
- 支持 U、D、L、R、F、B 等魔方面转动按钮。
- 支持打乱和还原。
- 支持键盘快捷键操作。
- 展示当前已有工具入口：俄罗斯转盘、DeepSeek 聊天、幸运抽奖。

首页的作用是建立项目的第一印象：这是一个带趣味性的工具集合，而不是普通列表页。

### 俄罗斯转盘

入口文件：

- `claudeOne/game.html`
- `claudeOne/js/roulette.js`

这是一个浏览器内运行的俄罗斯转盘小游戏页面。

主要功能：

- 设置玩家数量。
- 编辑玩家名字。
- 拖拽调整玩家顺序。
- 设置弹巢数量。
- 设置子弹数量。
- 选择是否自动旋转弹巢。
- 选择是否暴露弹巢状态。
- 支持多种结束规则。
- 游戏过程中显示当前玩家、弹巢、开枪结果和回合记录。
- 游戏结束后可以重新开始或沿用设置再来一局。

这个页面更偏游戏感，交互流程分为设置、游玩、结束几个阶段。

### DeepSeek 聊天

入口文件：

- `claudeOne/ai.html`
- `claudeOne/js/ai.js`

这是一个对接 DeepSeek `/chat/completions` 接口的聊天页面。

主要功能：

- 支持输入 DeepSeek API Key。
- API Key 只保存在浏览器本地 `localStorage`，不会写入项目代码。
- 支持选择模型。
- 支持流式回复。
- 支持思维链/推理内容显示。
- 支持推理强度设置。
- 支持停止生成。
- 支持清空当前聊天。
- 支持错误提示。

相关配置集中在 `claudeOne/js/config.js` 的 `deepseek` 配置中，包括：

- API base URL
- chat path
- 默认模型
- 可选模型列表
- 默认温度
- 默认最大输出长度
- Key 的本地存储键名

### 幸运抽奖

入口文件：

- `claudeOne/lottery.html`
- `claudeOne/js/lottery.js`
- `claudeOne/css/lottery.css`

这是一个活动现场风格的幸运抽奖页面。页面视觉上使用大转盘、金色指针、舞台灯光、彩色扇区和彩带效果，让用户一眼就能知道这是抽奖页。

#### 抽奖视觉

页面由三部分组成：

- 顶部：活动标题和随机源说明。
- 左侧/上方：大转盘舞台，显示当前奖项、剩余名额、可抽人数。
- 右侧/下方：奖项设置、参与者管理、中奖记录。

中奖后的提示弹窗会跟随当前主题：

- Soft UI 下是浅色柔和浮起卡片。
- Liquid Glass 下是半透明玻璃卡片。

#### 随机算法

抽奖结果使用浏览器 Web Crypto：

- 使用 `crypto.getRandomValues()` 获取随机数。
- 使用拒绝采样生成无偏整数。
- 不使用 `Math.random()`。
- 不使用时间戳、动画角度或 CSS 动画结果决定中奖者。
- 转盘动画只负责展示，中奖者在动画开始前已经确定。

这个设计不能宣称物理意义上的绝对真随机，但在纯前端浏览器环境里，属于安全、公平、非常接近真随机的实现方式。

#### 参与者管理

支持：

- 默认示例名单。
- 单个添加参与者。
- 编辑参与者姓名。
- 删除参与者。
- 批量导入名单。
- 每行一个名字的导入格式。
- 自动去掉空行。
- 自动过滤重复名字。
- 中奖后自动从可抽名单中移出。
- 重置中奖状态后，已中奖者重新回到可抽名单。

#### 奖项管理

默认奖项：

- 一等奖 1 名
- 二等奖 3 名
- 三等奖 5 名

支持：

- 添加奖项。
- 编辑奖项名称和名额。
- 删除奖项。
- 选择当前奖项。
- 当前奖项抽满后禁用抽奖按钮并提示切换奖项。

#### 中奖记录

支持：

- 记录中奖者。
- 记录中奖奖项。
- 已中奖者不再参与后续抽奖。
- 显示中奖顺序。
- 一键重置中奖状态。
- 一键重置全部抽奖数据。

#### 状态保存

幸运抽奖会把状态保存到 `localStorage`：

- 参与者名单
- 奖项列表
- 中奖记录
- 当前选中的奖项
- 转盘角度

刷新页面后，抽奖状态会尽量恢复。

## 技术结构

项目没有构建步骤，使用原生 HTML、CSS、JavaScript。

目录结构：

```text
claudeOne/
  index.html              首页 / 魔方工作台
  game.html               俄罗斯转盘页面
  ai.html                 DeepSeek 聊天页面
  lottery.html            幸运抽奖页面

  css/
    base.css              全局变量、布局、字体、主题基础
    components.css        按钮、卡片、表单、弹窗、toast 等公共组件
    neumorphism.css       Soft UI 主题
    liquid-glass.css      Liquid Glass 主题
    animations.css        页面进入、切换等动画
    cube.css              首页魔方专用样式
    lottery.css           幸运抽奖专用样式

  js/
    config.js             全局配置
    theme-init.js         首屏前主题初始化
    shell.js              公共能力：主题、导航、toast、storage、API Key 弹窗
    cube.js               魔方逻辑
    roulette.js           俄罗斯转盘逻辑
    ai.js                 DeepSeek 聊天逻辑
    lottery.js            幸运抽奖逻辑
```

## 公共能力

### 主题系统

主题保存在：

```text
claudeOne:theme
```

`theme-init.js` 会在页面渲染前读取主题，避免页面先闪成默认主题再切换。

`shell.js` 负责：

- 应用主题。
- 切换主题。
- 主题切换动画。
- 导航当前页高亮。
- 页面进入动画。
- 站内链接淡出跳转。

### 本地存储

项目使用 `localStorage` 保存用户配置。

主要键名：

```text
claudeOne:theme
claudeOne:deepseek-key
claudeOne:lottery-state-v2
```

如果浏览器禁用 `localStorage`，`shell.js` 里有内存降级方案，至少能保证当前页面会话内可用。

### 安全策略

HTML 页面使用了 CSP meta 标签限制资源来源：

- 脚本只允许加载本站脚本。
- 字体和样式允许 Google Fonts。
- DeepSeek 页面允许连接 DeepSeek API。
- 图片允许本地和 data URI。

注意：如果未来要部署到正式服务器，更推荐在 HTTP header 中设置 CSP，而不是只依赖 meta 标签。

## 运行方式

### 方式一：直接打开

可以直接打开：

```text
claudeOne/index.html
```

大多数功能可以直接使用。

### 方式二：本地静态服务器

推荐使用本地服务器，资源加载和部署环境更接近。

在项目根目录运行：

```powershell
python -m http.server 4173
```

然后访问：

```text
http://127.0.0.1:4173/claudeOne/index.html
```

其他页面：

```text
http://127.0.0.1:4173/claudeOne/game.html
http://127.0.0.1:4173/claudeOne/ai.html
http://127.0.0.1:4173/claudeOne/lottery.html
```

## 配置说明

全局配置在：

```text
claudeOne/js/config.js
```

包含：

- DeepSeek API 配置
- 可选模型列表
- 默认模型参数
- 主题配置
- 游戏和抽奖限制

幸运抽奖限制示例：

```js
lotteryParticipantsMax: 300
lotteryParticipantNameMax: 24
lotteryPrizeNameMax: 24
lotteryPrizeQuotaMax: 100
```

## 浏览器兼容

推荐使用现代浏览器：

- Chrome
- Edge
- Firefox
- Safari 新版本

幸运抽奖需要浏览器支持：

```js
crypto.getRandomValues()
```

如果浏览器不支持 Web Crypto，抽奖按钮会不可用，因为项目不使用低质量随机数作为降级方案。

## 设计注意事项

后续扩展页面时，建议遵守这些约定：

- 继续复用顶部导航和主题切换。
- 页面专属样式单独放入独立 CSS 文件。
- 公共按钮、输入框、弹窗优先复用 `components.css`。
- 不要在页面里硬写大量不跟随主题的颜色。
- 如果是工具页，优先保证文字清晰和操作直观。
- 如果是游戏或活动页，可以增强舞台感，但仍要和两套主题协调。

## 当前项目特点总结

这是一个轻量但完整的浏览器工具项目：

- 不需要构建。
- 不需要后端。
- 有统一品牌和导航。
- 有两套可切换视觉主题。
- 有可交互 3D 魔方首页。
- 有完整俄罗斯转盘小游戏。
- 有可连接 DeepSeek 的聊天工具。
- 有活动级幸运抽奖页面。
- 状态保存在浏览器本地。
- 抽奖随机性使用 Web Crypto 实现，避免伪随机和动画决定结果。

适合继续扩展成个人工具箱、小型互动站点、活动现场页面或课堂/展示用前端项目。
