# DOOM 静态资源部署说明

本目录是 claudeOne 站点的 DOOM 模块静态产物,由 doomgeneric (GPL) +
Freedoom Phase 1 (BSD) 经 Emscripten 编译产生。

## 文件清单

| 文件 | 大小 | 说明 |
|------|------|------|
| `doomgeneric.js` | ~177 KB | Emscripten 引擎胶水代码 |
| `doomgeneric.wasm` | ~1.4 MB | DOOM 引擎(WebAssembly) |
| `doomgeneric.data` | ~28 MB | 包含 freedoom1.wad 的 emscripten preloaded file |

合计约 30 MB。

## 部署到 Linux 服务器(Express)

claudeOne 用 [claudeOne/server/server.js](../../server/server.js) 提供单端口
服务,所以这里直接用 Express 中间件实现压缩与长缓存,无需改 nginx 之类反代。

### 1. 拉代码并装依赖

```bash
git pull
cd claudeOne/server
npm install
```

`compression` 包已写进 [package.json](../../server/package.json),`npm install`
会一并安装。

### 2. 启动服务

```bash
cd claudeOne/server
node server.js          # 默认端口 3001
PORT=80 node server.js  # 或自定义端口
```

服务器会自动:
- **压缩**:对 `.wasm`、`.data`、`.js`、`.css`、HTML 等响应启用 gzip(`compression`
  中间件,客户端 `Accept-Encoding: gzip` 时自动压)。`.data`(默认 MIME 为
  `application/octet-stream`,会被 compression 默认 filter 跳过)显式放行。
- **长缓存**:所有 `libs/*` 下的文件加 `Cache-Control: public, max-age=31536000, immutable`
  (1 年,内容不变就一直走浏览器本地缓存,服务器零流量)。
- **正确 MIME**:`.wasm → application/wasm`(浏览器流式编译的硬性要求)、
  `.data → application/octet-stream`、`.js → application/javascript`。

### 3. 验证部署

```bash
curl -I http://your-server:3001/libs/doom/doomgeneric.wasm
```

期望响应头包含:

```
HTTP/1.1 200 OK
Content-Type: application/wasm
Cache-Control: public, max-age=31536000, immutable
Content-Encoding: gzip
```

实测压缩效果(本地测过):

| 文件 | 原始 | gzip 后 | 压缩比 |
|------|------|---------|--------|
| `doomgeneric.wasm` | 1.4 MB | 0.58 MB | 2.5× |
| `doomgeneric.data` | 28 MB | 10 MB | 2.7× |
| 合计单次首次加载 | 29.6 MB | **~11 MB** | 节省 18.6 MB |

### 4. 进程守护(可选)

如果直接 `node server.js` 跑,SSH 一断就停了。建议用 systemd 或 pm2:

#### 用 systemd

`/etc/systemd/system/claudeone.service`:

```ini
[Unit]
Description=claudeOne SPA + API
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/claudeOne/server
ExecStart=/usr/bin/node server.js
Environment=PORT=3001
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now claudeone
sudo systemctl status claudeone
```

#### 用 pm2

```bash
npm i -g pm2
cd claudeOne/server
pm2 start server.js --name claudeone
pm2 save
pm2 startup   # 按提示执行 sudo 命令以开机自启
```

## 流量与性能预期

- **首次访问 DOOM 页签**:用户下载约 11 MB(开了 gzip 后)
- **重复访问**:浏览器命中长缓存,服务器流量 0
- **运行时**:游戏完全在用户浏览器本地跑,服务器零负载
- **首屏影响**:0(按需加载,只在点 #/doom 路由后才请求)

## 重新生成产物

如果 Freedoom 升级或 doomgeneric 修改源码,在装了 emsdk 的开发机上重新编译:

```bash
cd doomgeneric/doomgeneric                    # doomgeneric 仓库
source <emsdk-root>/emsdk_env.sh              # 激活 emscripten 环境变量
bash build.sh                                  # 即 e:/doomgeneric/doomgeneric/build.sh

# 拷贝产物到 claudeOne
cp doomgeneric.{js,wasm,data} <path>/claudeOne/libs/doom/
```

## 许可证

- **doomgeneric**: GPL-2.0(<https://github.com/ozkl/doomgeneric>)
- **Freedoom**: BSD 3-clause(<https://freedoom.github.io/>)
- 两者均允许自由分发和嵌入。商业 DOOM IWAD(`doom.wad` 等)**不要**放进
  本目录,license 不允许。
