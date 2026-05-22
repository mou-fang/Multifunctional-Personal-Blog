# claudeOne 代码位置-函数名-功能注解表

> 在本项目工作前先读此表和 README.md。

---

## 目录

1. [全局模块（shell / router / config / page-registry / tool-cards）](#1-全局模块)
2. [全局播放器](#2-全局播放器playerjs)
3. [首页 3D 魔方](#3-首页-3d-魔方cubejs)
4. [俄罗斯转盘](#4-俄罗斯转盘roulettejs)
5. [推箱子](#5-推箱子sokobanjs)
6. [幸运抽奖](#6-幸运抽奖lotteryjs)
7. [音乐解锁](#7-音乐解锁musicjs)
8. [播放列表页](#8-播放列表页playlist-pagejs)
9. [ASCII 艺术](#9ascii-艺术asciijs)
10. [图片像素化](#10-图片像素化pixeljs)
11. [图片压缩](#11-图片压缩compressjs)
12. [二维码美化](#12-二维码美化qrjs)
13. [DeepSeek 聊天](#13deepseek-聊天aijs)
14. [后端服务](#14-后端服务serverserverjs)
15. [音乐扫描脚本](#15-音乐扫描脚本scan-musicjs)
16. [CSS 文件索引](#16-css-文件索引)
17. [架构模式速查](#17-架构模式速查)

---

## 1. 全局模块

### config.js — `claudeOne/js/config.js` (82 行)
全局配置对象 `window.CLAUDE_ONE_CONFIG`（冻结），包含 API、主题默认值、播放器参数、文件大小限制等。无函数，IIFE 构建。

### theme-init.js — `claudeOne/js/theme-init.js` (12 行)
首屏主题防闪烁脚本，同步读 localStorage 设置 `data-theme`。无函数。

### shell.js — `claudeOne/js/shell.js` (346 行)
公共能力模块，暴露在 `window.ClaudeOne`。

| 行号 | 函数 | 功能 |
|------|------|------|
| 29 | `resolveCurrentRoute()` | 从 hash 或 `data-page` 获取当前路由名 |
| 36 | `renderNav()` | 渲染导航链接，高亮当前页 |
| 47 | `storage.get(key)` | 安全读 localStorage，降级到内存 Map |
| 59 | `storage.set(key, val)` | 安全写 localStorage，降级到内存 Map |
| 74 | `escapeHtml(s)` | HTML 实体转义 |
| 83 | `clamp(n, lo, hi)` | 数值区间钳制 |
| 93 | `resolveTheme()` | 读取持久化的主题偏好 |
| 99 | `applyTheme(theme, opts)` | 将主题应用到 DOM（设置 `data-theme`） |
| 120 | `setThemeAnimated(nextTheme, origin)` | 带涟漪动画的主题切换 |
| 145 | `getRevealObserver()` | 创建/缓存滚动揭示 IntersectionObserver |
| 162 | `setupReveal()` | 观察 `.page-chunk` 元素做揭示动画 |
| 174 | `refreshReveal()` | 重新观察动态添加的 `.page-chunk` |
| 185 | `ensureToastRail()` | 创建固定 Toast 容器 |
| 195 | `toast(text, kind, ms)` | 显示 Toast 通知（kind: "ok"/"err"） |
| 209 | `setupThemeToggle()` | 绑定主题切换开关 |
| 223 | `createApiKeyModal({ forceOpen, onSave })` | 创建 DeepSeek API Key 输入弹窗 |

### router.js — `claudeOne/js/router.js` (313 行)
SPA Hash 路由器，处理页面导航、模板克隆、CSS/JS 加载、生命周期。

| 行号 | 函数 | 功能 |
|------|------|------|
| 27 | `sleep(ms)` | 延时 Promise |
| 31 | `updateMetaDescription(desc)` | 更新 `<meta description>` |
| 36 | `resolveRoute()` | 解析 `location.hash` 获取页面名 |
| 44 | `updateHash(pageName)` | 推入新 hash 状态 |
| 51 | `finishNavigation()` | 完成待定导航 Promise |
| 65 | `loadCSS(url)` | 动态加载 CSS 文件 |
| 82 | `loadJS(url)` | 动态加载 JS 文件 |
| 99 | `loadJSSeq(urls)` | 顺序加载多个 JS 文件 |
| 106 | `getLifecycle(meta)` | 解析页面的 mount/unmount 生命周期 |
| 116 | `navigateTo(pageName, opts)` | 核心导航：卸载旧页→加载 CSS→克隆模板→加载 JS→挂载新页 |
| 228 | `onHashChange()` | hashchange 事件处理 |
| 235 | `onClickNav(e)` | 导航链接点击处理 |
| 251 | `init()` | 路由初始化，设置事件监听并导航到初始路由 |

### page-registry.js — `claudeOne/js/page-registry.js` (110 行)
页面注册表，映射页面名到元数据（title, description, templateId, css[], js[], lifecycle）。注册页面：home, games, tools, game, sokoban, lottery, music, playlist, ai, ascii, pixel, compress, qr。

### tool-cards.js — `claudeOne/js/tool-cards.js` (228 行)
游戏/工具卡片数据与渲染。

| 行号 | 函数/属性 | 功能 |
|------|----------|------|
| 10 | `GAME_CARDS` | 8 个游戏卡片条目 |
| 63 | `TOOL_CARDS` | 15 个工具卡片条目 |
| 157 | `renderCardGrid(grid, cards)` | 渲染卡片 HTML 到网格 |
| 207 | `makeMount(source)` | 为 games/tools 页面创建 mount 函数 |

---

## 2. 全局播放器（player.js）

`claudeOne/js/player.js` (1015 行) — 全局音频播放引擎，DOM 在 SPA `<main>` 之外，切页不中断。暴露 `window.ClaudeOnePlayer` API。

| 行号 | 函数 | 功能 |
|------|------|------|
| 58 | `fmtTime(sec)` | 秒数格式化为 `mm:ss` |
| 71 | `saveState()` | 持久化播放器状态到 localStorage |
| 79 | `loadSavedState()` | 从 localStorage 恢复播放器状态 |
| 106 | `updateVolumeIcon()` | 根据音量更新图标 |
| 119 | `applyVolume()` | 将当前音量应用到 audio 元素 |
| 134 | `shuffleArray(arr)` | Fisher-Yates 洗牌 |
| 142 | `buildShuffleOrder(anchorIdx)` | 构建以锚点为起点的随机队列 |
| 181 | `getNextIndex()` | 根据播放模式获取下一曲索引 |
| 204 | `getPrevIndex()` | 根据播放模式获取上一曲索引 |
| 223 | `updatePlayBtn()` | 更新播放/暂停按钮图标 |
| 229 | `getPlaybackMode()` | 获取播放模式（"one"/"shuffle"/"sequence"） |
| 262 | `setPlaybackMode(mode)` | 切换播放模式并 Toast 提示 |
| 282 | `updateCover(track)` | 更新封面显示 |
| 299 | `updateTrackInfo(track)` | 更新歌曲标题、歌手、来源标记 |
| 328 | `setMinimized(min)` | 切换展开/最小化状态 |
| 377 | `emitPlayerChange(reason)` | 派发 `CustomEvent` 通知状态变化 |
| 496 | `loadAndPlay(idx)` | 核心：加载指定索引曲目并播放 |
| 547 | API 对象 | `window.ClaudeOnePlayer`：play, pause, toggle, load, next, prev, skipTo, seek, setVolume, toggleMute, cycleMode, addTracks, removeTrack, getState, getPlaylist, expand, minimize, openPlaylist |
| 716-793 | 拖放处理 | 拖拽音频文件到播放器支持 |
| 905 | 键盘处理 | 空格键切换播放/暂停 |
| 915 | `init()` | 播放器初始化，从 `window.__MUSIC_PLAYLIST` 加载 |

---

## 3. 首页 3D 魔方（cube.js）

`claudeOne/js/cube.js` (1065 行) — 首页可交互 3D 魔方，CSS 3D 实现。注册 `window.__page_home`。

| 行号 | 函数 | 功能 |
|------|------|------|
| 10 | `identity()` | 4x4 单位矩阵 |
| 15 | `matMul(a, b)` | 4x4 矩阵乘法 |
| 30 | `rotMat(axis, angle)` | 绕轴旋转矩阵 |
| 56 | `rotateVec(m, v)` | 矩阵旋转向量 |
| 66 | `matrix3dCss(m)` | 矩阵转 CSS `matrix3d()` 字符串 |
| 72 | `degToRad(d)` | 角度转弧度 |
| 76 | `radToDeg(r)` | 弧度转角度 |
| 80 | `mat3RotX/Y/Z(a)` | 3x3 轴旋转矩阵 |
| 100 | `mat3Mul(a, b)` | 3x3 矩阵乘法 |
| 112 | `mat3Transpose(m)` | 3x3 矩阵转置 |
| 119 | `extractEulerXYZ(m)` | 从 3x3 旋转矩阵提取欧拉角 |
| 140 | `worldToLocal(worldPos, cubeRot)` | 世界坐标转魔方局部坐标 |
| 158 | `rotationToLocal(cubeRot)` | 世界旋转转局部旋转 |
| 188 | `addSticker(face, x, y, z)` | 构建贴纸 DOM 元素 |
| 198 | `addFiller(face, x, y, z)` | 构建内壳填充 DOM 元素 |
| 204 | `renderCubelet(c)` | CSS transform 定位小方块 |
| 213 | `inverseTurn(name)` | 返回反转名称（如 "U"→"U'"） |
| 217 | `enqueueTurn(name, fast, recordHistory)` | 入队面转动画 |
| 225 | `runQueue()` | 处理转动动画队列 |
| 243 | `doTurn(name, durationMs)` | 执行单次面转动画 |
| 302 | `scramble(n)` | 打乱 n 步随机操作 |
| 316 | `reset()` | 逆序撤销所有操作 |
| 345 | `renderCube()` | 将当前旋转应用到魔方 DOM |
| 360 | `setScatterMode(on)` | 启用/禁用散射模式 |
| 390 | `scatterCubelets()` | 小方块散射到视口各处 |
| 480 | `gatherCubelets()` | 小方块聚回魔方形态 |
| 560 | `updateScatterDrift()` | 更新散射漂移动画 |
| 741 | `tick(time)` | 主动画循环 (requestAnimationFrame) |
| 790 | `stagePointerDown(e)` | 指针/触摸按下处理 |
| 810 | `stagePointerMove(e)` | 指针/触摸移动处理 |
| 820 | `endDrag()` | 结束拖拽交互 |
| 836 | `buildCubeDOM()` | 创建全部 26 个小方块 |
| 903 | `wireEvents(signal)` | 用 AbortController 绑定事件 |
| 993 | `mount(el)` | SPA 生命周期挂载 |
| 1043 | `unmount()` | SPA 生命周期卸载 |

---

## 4. 俄罗斯转盘（roulette.js）

`claudeOne/js/roulette.js` (628 行) — 俄罗斯转盘游戏。注册 `window.__page_game`。

| 行号 | 函数 | 功能 |
|------|------|------|
| 51 | `makePlayer(name)` | 创建玩家对象（随机颜色） |
| 91 | `renderPlayerList()` | 渲染可拖拽排序的玩家列表 |
| 120 | `renderChamberStepper()` | 渲染弹巢数量步进器 |
| 145 | `renderBulletStepper()` | 渲染子弹数量步进器 |
| 176 | `buildChamberSvg(...)` | 构建弹巢 SVG 可视化 |
| 248 | `renderChamber(spinning)` | 渲染当前弹巢状态 |
| 293 | `start()` | 校验输入并开始游戏 |
| 321 | `buildChamber()` | 随机放置子弹到弹巢 |
| 360 | `fire()` | 核心开火逻辑 |
| 425 | `rebuildChamberBetweenTurns()` | 回合间重新洗牌 |
| 451 | `decideEnd()` | 检查结束条件 |
| 476 | `computeOutcome(kind)` | 计算胜负结果 |
| 501 | `renderPhase()` | 切换设置/游戏/结束视图 |
| 541 | `wire()` | 绑定 UI 事件 |
| 612 | `mount(el)` | SPA 生命周期挂载 |
| 620 | `unmount()` | SPA 生命周期卸载 |

---

## 5. 推箱子（sokoban.js）

`claudeOne/js/sokoban.js` (2657 行) — 推箱子益智游戏，10 固定关卡 + 随机生成 + BFS 求解器 + 深渊模式。注册 `window.__page_sokoban`。

| 行号 | 函数 | 功能 |
|------|------|------|
| ~15 | `parseMap(str)` | 解析地图字符串为 2D 网格 |
| ~35 | `buildMap(grid)` | 网格转内部游戏状态 |
| ~55 | `trimMap(state)` | 裁剪地图边缘空行/列 |
| ~100 | `executeMove(dirId)` | 执行玩家移动（推箱） |
| ~160 | `resetLevel()` | 重置当前关卡 |
| ~180 | `handleComplete()` | 检查是否通关 |
| ~210 | `renderHud()` | 渲染 HUD（关卡名、步数、推数） |
| ~230 | `renderBoard()` | 渲染游戏棋盘 |
| ~280 | `renderFixedLevels()` | 渲染固定关卡选择列表 |
| ~310 | `renderRandomControls()` | 渲染随机模式控件 |
| ~350 | `solveSnapshot(snapshot, opts)` | BFS 求解器：返回解法或 null |
| ~450 | `countPushSolutions(snapshot, opts)` | 统计不同推法解数 |
| ~500 | `requestHint()` | 请求提示 |
| ~530 | `buildHintPlan(moves)` | 构建可视化提示（路径+箭头） |
| ~570 | `startAuto(sequence, opts)` | 开始自动演示 |
| ~590 | `stopAuto()` | 停止自动演示 |
| ~600 | `toggleAuto()` | 切换自动演示 |
| ~650 | `generateCandidate(difficulty, rng)` | 生成随机关卡候选 |
| ~750 | `generateRandomLevel(targetDifficulty)` | 生成匹配目标难度的随机关卡 |
| ~850 | `generateBrutalLevel()` | 生成深渊难度关卡 |
| ~900 | `buildBrutalTangleMap()` | 构建缠绕型深渊地图 |
| ~950 | `buildBrutalMessMap()` | 构建混乱型深渊地图 |
| ~1000 | `validateBrutalMap(map)` | 验证深渊地图唯一解 |
| ~1050 | `validateBrutalDecoyMap(map)` | 验证深渊诱饵地图 |
| ~1100 | `mulberry32(seed)` | 种子伪随机数生成器 |
| ~1150 | `saveState()` | 持久化游戏状态 |
| ~1170 | `restoreSavedState()` | 恢复游戏状态 |
| 2630 | `mount(el)` | SPA 生命周期挂载 |
| 2645 | `unmount()` | SPA 生命周期卸载 |

---

## 6. 幸运抽奖（lottery.js）

`claudeOne/js/lottery.js` (980 行) — 抽奖大转盘，Web Crypto 真随机，参与者/奖项管理，彩带+星星特效。注册 `window.__page_lottery`。

| 行号 | 函数 | 功能 |
|------|------|------|
| 62 | `randomInt(maxExclusive)` | Crypto 安全随机整数（拒绝采样） |
| ~80 | `makeParticipant()` | 创建参与者对象 |
| ~90 | `makePrize()` | 创建奖项对象 |
| 294 | `buildWheel()` | 构建 SVG 转盘（扇区+标签） |
| 620 | `spin()` | 启动转盘旋转（Crypto 随机选中） |
| 667 | `resolveSpin()` | 旋转动画结束后解析结果 |
| 694 | `launchConfetti()` | 发射彩带动画 |
| 711 | `showWinner()` | 显示中奖者揭晓弹窗 |
| ~750 | `upsertParticipant()` | 新增/更新参与者 |
| ~770 | `deleteParticipant(id)` | 删除参与者 |
| ~790 | `upsertPrize()` | 新增/更新奖项 |
| ~810 | `deletePrize(id)` | 删除奖项 |
| ~830 | `importParticipants()` | 批量导入参与者 |
| ~850 | `resetWinnersOnly()` | 仅重置中奖记录 |
| ~870 | `resetEverything()` | 重置全部数据 |
| ~950 | `mount(el)` | SPA 生命周期挂载 |
| ~970 | `unmount()` | SPA 生命周期卸载 |

---

## 7. 音乐解锁（music.js）

`claudeOne/js/music.js` (409 行) — 加密音乐文件浏览器端解密（.ncm/.qmc*/.mflac/.mgg），通过 Web Worker 解密。注册 `window.__page_music`。

| 行号 | 函数 | 功能 |
|------|------|------|
| 31 | `ensureWorker()` | 创建/复用解密 Web Worker |
| 81 | `handleFiles(files)` | 处理上传文件：校验格式/大小、创建条目、发送到 Worker |
| 120 | `readAndDecrypt(id, file)` | 读取文件为 ArrayBuffer 并发给 Worker |
| 134 | `buildCardHTML(entry)` | 构建文件卡片 HTML |
| 166 | `renderFileCardDOM(id)` | 创建并追加文件卡片 DOM |
| 178 | `updateFileCardDOM(id)` | 更新已有文件卡片 |
| 187 | `bindCardActionsDOM(card, id)` | 绑定卡片操作按钮事件 |
| 200 | `updateEmptyDOM()` | 切换空状态和批量操作栏 |
| 208 | `previewWithGlobalPlayer(id)` | 用全局播放器播放解密文件 |
| 229 | `getNamingFormat()` | 获取下载命名格式 |
| 237 | `getDownloadFilename(entry)` | 计算下载文件名 |
| 249 | `downloadFile(id)` | 下载单个解密文件 |
| 262 | `downloadAll()` | 批量下载（错开时间） |
| 287 | `removeFile(id)` | 移除文件条目 |
| 297 | `clearAll()` | 清空所有文件 |
| 309 | `mount(el)` | SPA 生命周期挂载 |
| 388 | `unmount()` | SPA 生命周期卸载 |

---

## 8. 播放列表页（playlist-page.js）

`claudeOne/js/playlist-page.js` (196 行) — 全局播放器歌单页面。注册 `window.__page_playlist`。

| 行号 | 函数 | 功能 |
|------|------|------|
| ~10 | `getTracks()` | 从播放器 API 获取曲目列表 |
| ~20 | `getState()` | 获取当前播放器状态 |
| 117 | `render()` | 渲染完整播放列表 |
| 165 | `onClick(e)` | 点击曲目播放 |
| ~185 | `mount(el)` | SPA 生命周期挂载 |
| ~192 | `unmount()` | SPA 生命周期卸载 |

---

## 9. ASCII 艺术（ascii.js）

`claudeOne/js/ascii.js` (619 行) — 图片转 ASCII 字符画，后端 `/api/ascii` 转换。注册 `window.__page_ascii`。

| 行号 | 函数 | 功能 |
|------|------|------|
| ~20 | `getMode()` | 获取转换模式（彩色/灰度/盲文） |
| ~30 | `getWidth()` | 获取目标字符宽度 |
| ~40 | `getHeight()` | 获取目标字符高度 |
| ~50 | `getCharSet()` | 获取字符集 |
| ~60 | `getCustomMap()` | 获取自定义字符映射 |
| ~70 | `getParams()` | 聚合所有转换参数 |
| ~90 | `handleFile(file)` | 处理上传的图片文件 |
| ~110 | `clearFile()` | 清除当前文件 |
| ~130 | `scheduleAutoConvert()` | 防抖自动转换 |
| ~140 | `cancelPending()` | 取消待定转换 |
| 186 | `doConvert()` | 发送图片到 `/api/ascii` 并显示结果 |
| 283 | `switchTab(name)` | 切换文本/PNG 输出标签页 |
| ~320 | `loadHistory()` | 从 localStorage 加载历史 |
| ~340 | `saveHistory(params)` | 保存转换到历史 |
| ~360 | `renderHistory()` | 渲染历史列表 |
| ~400 | `removeHistoryItem(id)` | 删除历史条目 |
| ~430 | `checkMobileCollapse()` | 移动端折叠控件 |
| 450 | `wire()` | 绑定 UI 事件 |
| ~600 | `mount(el)` | SPA 生命周期挂载 |
| ~615 | `unmount()` | SPA 生命周期卸载 |

---

## 10. 图片像素化（pixel.js）

`claudeOne/js/pixel.js` (825 行) — 复古像素画生成器，多调色板+后处理效果。注册 `window.__page_pixel`。

| 行号 | 函数 | 功能 |
|------|------|------|
| 17 | `PALETTES` | 预定义调色板（gb, nes, pico8, cyberpunk, bw, warm, cool） |
| ~50 | `loadConfig()` | 从 localStorage 加载配置 |
| ~70 | `saveConfig()` | 保存配置到 localStorage |
| 388 | `processImage()` | 核心像素化流水线（使用 pixelit 库） |
| ~420 | `applyColorMode()` | 应用颜色模式 |
| ~440 | `applyAdjustments()` | 应用亮度/对比度调整 |
| ~460 | `applyThresholdDither()` | 应用阈值抖动 |
| ~480 | `drawPixelStroke()` | 绘制像素描边 |
| ~500 | `drawGridLines()` | 绘制网格线叠加 |
| ~520 | `drawRoundedPixels()` | 绘制圆角像素 |
| ~540 | `drawCRT()` | CRT 扫描线效果 |
| ~560 | `drawNoise()` | 噪点纹理效果 |
| ~600 | `exportPNG()` | 导出 PNG |
| ~650 | `copyConfigJSON()` | 复制配置 JSON 到剪贴板 |
| ~670 | `restoreDefaults()` | 恢复默认设置 |
| 810 | `mount(el)` | SPA 生命周期挂载 |
| 817 | `unmount()` | SPA 生命周期卸载 |

---

## 11. 图片压缩（compress.js）

`claudeOne/js/compress.js` (684 行) — 浏览器端图片压缩，支持缩放、格式转换、批量处理、ZIP 下载。注册 `window.__page_compress`。

| 行号 | 函数 | 功能 |
|------|------|------|
| 65 | `getParams()` | 读取所有压缩参数 |
| ~100 | `addFiles(fileArr)` | 添加文件到处理队列 |
| ~130 | `removeFile(id)` | 从队列移除文件 |
| 194 | `loadImage(file)` | 加载文件为 HTMLImageElement |
| 244 | `canvasPipeline(img, file, params)` | Canvas 缩放和颜色调整 |
| 280 | `compressBlob(blob, params, abortSignal)` | 二分搜索压缩到目标大小 |
| 317 | `processImage(fileItem, params, abortSignal)` | 单图完整处理流水线 |
| 353 | `processAll()` | 批量处理（并发控制） |
| ~400 | `downloadAll()` | 逐个下载处理后文件 |
| ~420 | `downloadZip()` | ZIP 打包下载 |
| ~460 | `openPreview(id)` | 打开前后对比弹窗 |
| ~490 | `closePreview()` | 关闭对比弹窗 |
| ~650 | `mount(el)` | SPA 生命周期挂载 |
| ~675 | `unmount()` | SPA 生命周期卸载 |

---

## 12. 二维码美化（qr.js）

`claudeOne/js/qr.js` (914 行) — 高级二维码生成器，支持 Logo、渐变、圆点样式、自定义角标。注册 `window.__page_qr`。

| 行号 | 函数 | 功能 |
|------|------|------|
| 40 | `buildContentData()` | 根据内容类型构建 QR 数据字符串 |
| 77 | `renderQR(instance, wrap)` | 渲染 QR 实例到容器 |
| 113 | `updateQR()` | 用当前配置重建 QR 码 |
| 151 | `syncUIFromConfig()` | 从配置同步 UI 控件 |
| 254 | `switchContentType(type)` | 根据内容类型切换输入字段 |
| 295 | `PRESETS` | 9 个预设主题 |
| 377 | `applyPreset(name)` | 应用命名预设 |
| ~450 | `exportPNG()` | 导出 PNG |
| ~470 | `exportSVG()` | 导出 SVG |
| ~500 | `handleLogoFile(file)` | 处理 Logo 图片上传 |
| ~520 | `removeLogo()` | 移除 Logo |
| 880 | `setupSegPills()` | 设置分段药丸控件样式 |
| ~900 | `mount(el)` | SPA 生命周期挂载 |
| ~910 | `unmount()` | SPA 生命周期卸载 |

---

## 13. DeepSeek 聊天（ai.js）

`claudeOne/js/ai.js` (938 行) — DeepSeek AI 对话界面，流式回复、思维链、推理强度、多话题管理。注册 `window.__page_ai`。

| 行号 | 函数 | 功能 |
|------|------|------|
| ~30 | `loadPrefs()` | 加载用户偏好 |
| ~40 | `savePrefs()` | 保存用户偏好 |
| ~60 | `newId()` | 生成话题唯一 ID |
| ~70 | `makeTopic()` | 创建新话题对象 |
| ~80 | `loadTopics()` | 加载所有话题 |
| ~90 | `saveTopics()` | 保存所有话题 |
| ~100 | `getActiveTopic()` | 获取当前活跃话题 |
| ~110 | `commitActiveTopic()` | 保存活跃话题消息 |
| ~120 | `ensureActiveTopic()` | 确保活跃话题存在 |
| ~140 | `switchToTopic(id)` | 切换到指定话题 |
| ~160 | `startNewTopic()` | 创建并切换新话题 |
| ~180 | `deleteTopic(id)` | 删除话题 |
| 225 | `wire()` | 绑定 UI 事件 |
| 509 | `addMessage(role, text, opts)` | 创建消息 DOM，支持流式更新 |
| 569 | `send()` | 发送用户消息到 DeepSeek API |
| 628 | `buildApiMessages()` | 构建 API 消息负载 |
| 653 | `streamCompletion(apiKey, assistantView)` | SSE 流式处理（含 reasoning_content） |
| 748 | `createPromptModal(opts)` | 系统提示编辑弹窗 |
| ~920 | `mount(el)` | SPA 生命周期挂载 |
| ~935 | `unmount()` | SPA 生命周期卸载 |

---

## 14. 后端服务（server/server.js）

`claudeOne/server/server.js` (340 行) — Express 服务器，端口 3001。

| 行号 | 函数/路由 | 功能 |
|------|----------|------|
| 31 | `getCliCommand()` | 定位 `ascii-image-converter` 二进制路径 |
| 100 | `parseBool(val)` | 字符串转布尔 |
| 104 | `validateParams(body)` | 校验 ASCII 转换请求参数 |
| 136 | `buildCliArgs(inputPath, tempDir, params)` | 构建转换器 CLI 参数 |
| 171 | `runConverter(inputPath, params)` | 启动转换进程 |
| 248 | `POST /api/ascii` | ASCII 转换端点（含并发限制） |
| 297 | `GET /api/health` | 健康检查端点 |
| 71 | SPA fallback | 已知 SPA 路由回退到 `index.html` |

---

## 15. 音乐扫描脚本（scripts/scan-music.js）

`claudeOne/scripts/scan-music.js` (204 行) — Node.js 脚本，扫描 music/ 提取 ID3 元数据生成 playlist.js。

| 行号 | 函数 | 功能 |
|------|------|------|
| 19 | `extractMeta(filePath, mm)` | 提取 ID3 元数据（标题、歌手、专辑、封面） |
| 61 | `parseFilename(fileName)` | 解析 "Artist - Title" 文件名模式 |
| 74 | `findCoverImage(audioPath)` | 查找同目录封面图 |
| 96 | `main()` | 主入口：扫描文件夹、提取元数据、生成 playlist.js |

---

## 16. CSS 文件索引

| 文件 | 行数 | 职责 |
|------|------|------|
| `base.css` | 551 | CSS 重置、设计 token、主题变量、布局壳子、排版、响应式断点 |
| `components.css` | 578 | 可复用组件：按钮、卡片、表单控件、开关、药丸、弹窗、Toast |
| `animations.css` | 198 | 关键帧动画：环境光球、滚动揭示、页面过渡、各页面特效 |
| `neumorphism.css` | 278 | Soft UI 主题覆盖：凸起/凹陷阴影、纹理叠加 |
| `liquid-glass.css` | 597 | Liquid Glass 主题覆盖：毛玻璃面板、多层伪元素、网格背景 |
| `player.css` | 1104 | 全局播放器：展开/最小化态、进度条、音量滑块、拖放覆盖 |
| `cube.css` | 576 | 3D 魔方：方块/贴纸结构、面颜色、散射模式 |
| `sokoban.css` | 611 | 推箱子：棋盘网格、墙壁/地板/目标/箱子/玩家、D-pad、胜利叠加 |
| `lottery.css` | 1060 | 抽奖：暗色舞台、SVG 转盘、中奖者揭晓弹窗、彩带/星星特效 |
| `music.css` | 471 | 音乐解锁：上传区、文件卡片、解密动画、批量操作栏 |
| `ascii.css` | 417 | ASCII 艺术：上传区、工作区网格、文本/PNG 输出标签页、历史列表 |
| `pixel.css` | 498 | 像素画：上传区、画布+控件面板、预设药丸、自定义调色板 |
| `compress.css` | 797 | 图片压缩：文件列表、参数面板、进度条、前后对比弹窗 |
| `qr.css` | 565 | 二维码：预览面板、预设、导出区、颜色选择器、Logo 上传 |
| `games.css` | 61 | 游戏卡片网格 |
| `tools.css` | 61 | 工具卡片网格 |
| `playlist.css` | 271 | 播放列表页：曲目行、封面、详情列 |

---

## 17. 架构模式速查

### 生命周期
每个页面脚本暴露 `window.__page_xxx = { mount, unmount }`。`mount(root)` 接收克隆的模板根节点。`unmount()` 必须清理所有事件、定时器、动画帧、Worker、Object URL、异步请求。

### AbortController
所有页面在 mount 时创建 `new AbortController()`，将 `ac.signal` 传给事件监听。unmount 时 `ac.abort()` 一次性移除所有监听。

### 主题系统
`data-theme` 属性驱动两套主题。`base.css` 定义 CSS 变量 token；`neumorphism.css` 和 `liquid-glass.css` 提供主题覆盖。所有页面 CSS 使用这些变量。

### 全局播放器隔离
播放器 DOM 在 `<main>` 之外，不受页面切换影响。通过 `CustomEvent` 通知状态变化。

### localStorage 约定
所有 key 使用 `claudeOne:*` 前缀。DeepSeek API Key 仅存 localStorage，不硬编码，不打日志。

### 第三方库
| 库 | 路径 | 用途 |
|---|------|------|
| pixelit.js | `libs/pixelit/` | 图片像素化引擎 |
| jszip.min.js | `libs/jszip/` | ZIP 创建（批量下载） |
| browser-image-compression.js | `libs/browser-image-compression/` | 浏览器端图片压缩 |
| qr-code-styling.js | `libs/qr-code-styling/` | QR 码自定义样式生成 |
