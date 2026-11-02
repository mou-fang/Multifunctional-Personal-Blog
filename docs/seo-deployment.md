# moufang.xyz 搜索接入：部署、账号操作和验收教程

本教程对应“本机开发并推送 main → 另一台服务器拉取 → 重启现有网站”的流程。代码完成不代表服务器已经更新，更不代表已经被搜索引擎收录。请依次完成下面各步。

## 1. 本次代码提供什么

- 每个已上线工具和小游戏都有正常网址；站内切换继续使用 SPA，全局播放器保持连续播放。
- Express 直接提供对应页面的正文、标题、简介、使用帮助、导航和分享信息。详细帮助默认收起，展开后可阅读；不会额外创建只给爬虫看的页面。
- `/game-releases` 和 `/game-releases/archive` 读取原有发布数据。往期每页 60 条，有可直接访问的分页链接；更新发布数据后不需要重新提交代码。
- `/sitemap.xml` 自动列出正式页面及有效的往期分页。`/robots.txt` 允许 Googlebot、Bingbot、Baiduspider，并保留此前其他爬虫的禁止偏好。
- 旧 `#/music` 等地址由浏览器兼容；旧 `/music`、`/game-releases-archive` 等普通路径永久跳转。不存在的网址返回真正的 404。
- 维护规则与测试会检查新增页面的路径、模板、介绍、帮助、入口及网站地图接入。

正式域名默认 `https://moufang.xyz`。只有以后更换域名时，才需要为现有 Node 服务设置 `PUBLIC_SITE_URL`，其值必须是无路径的 HTTP(S) 站点地址。正常本地开发不必配置，它会在页面中保留正式站点的 canonical 地址。

## 2. 在另一台服务器更新代码

以下命令在服务器终端执行。本项目原有部署文档记录的目录如下；若你实际部署在其他目录，请换成实际目录。

```bash
cd /home/li/.openclaw/workspace/Multifunctional-Personal-Blog
git status --short
git branch --show-current
git rev-parse HEAD
```

记下最后一行提交号作为更新前版本。分支应为当前实际部署分支，本次代码推送到 `main`。如果有源文件本地改动或分支不同，先核对差异，不要执行 `git reset --hard`、`git clean` 或删除整个项目。

确认没有冲突后执行：

```bash
git pull --ff-only origin main
npm --prefix claudeOne/server ci
npm --prefix claudeOne/server test
```

新增固定版本依赖 `parse5@7.3.0`（MIT，解析现有 HTML 模板），必须执行 `npm ci`；它还会按锁文件安装传递依赖 `entities`。不需要构建前端，不需要 Rust，也不需要重新生成或覆盖游戏发售数据。

**保留这些运行数据：**`.game-release-data/`（包括 `history/`、`assets/`）、自定义 `GAME_RELEASE_DATA_DIR`、音乐文件、统计数据、临时上传和原有环境配置。不把这些文件加入 Git，不用新副本覆盖它们。

### 重启原有网站进程

沿用你现在的运行方式，先查看，不要再开一个长期重复服务：

```bash
ps -eo pid,args | grep '[n]ode'
command -v pm2 >/dev/null && pm2 list
systemctl --user list-units --type=service --all | grep -Ei 'node|web|blog|personal'
```

- 如果网站由 PM2 管理，在 `pm2 list` 找到原来的网站名称，再执行 `pm2 restart 实际名称 --update-env`。
- 如果由 systemd 管理，使用原来服务的真实名称重启；用户服务用 `systemctl --user restart 实际名称`，系统服务用你原来的管理员方式重启。
- 如果以前直接运行 `node server.js`，正常结束**确认属于本站的旧进程**，再使用原有端口和环境从 `claudeOne/server` 启动 `node server.js`。不要停止其他 OpenClaw、机器人或 Node 服务。

这里无法根据本地仓库确定远端的真实服务名称，因此不能直接给出一个猜测的重启命令。Node 版本应至少支持原项目使用的原生 `fetch`、`node:test` 和 `structuredClone`，建议保持已有受支持版本。

先检查服务器本机（端口按原配置；默认 3001）：

```bash
curl -I http://127.0.0.1:3001/tools/music-unlock
curl -I http://127.0.0.1:3001/sitemap.xml
node claudeOne/scripts/verify-seo.js --base-url http://127.0.0.1:3001
```

预期：前两项 200，第三项 `ok:true` 且退出码为 0。完整报告会列出全部正式页面；已有较多往期记录时，检查数量会随分页增加。它只验证公开技术条件，不能证明搜索引擎已收录。

## 3. 检查反向代理

如果现在所有请求都转发给原来的 Express 服务，通常不需要新增每个工具的代理规则。

如果 Nginx 直接读取 HTML 静态文件或把任意地址重写到旧 `index.html`，需要改成将网页请求交给 Express。否则你会看到新网址，但首次返回的仍是旧通用网页。配置示例（放到**已有的**对应站点中，保留原证书、日志和其他专用路由）：

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

实际端口以原服务为准。若保留 CSS、JS、图片等静态直出规则，`/`、`/tools`、`/games`、`/game-releases`、`/robots.txt`、`/sitemap.xml` 和这些网页的子路径必须到 Express。不要把缺失网页统一变成首页 200。`/server/`、`/scripts/`、`/test-results/` 继续禁止公开读取。

如修改了 Nginx，先用原管理方式执行 `nginx -t` 检查，再 reload；不要直接用示例覆盖整个配置。

## 4. Cloudflare：必须检查百度禁令和 HTTPS

2026-11-02 检查时，公开 `https://moufang.xyz/robots.txt` 带有 Cloudflare 托管标记，包含：

```text
User-agent: Baiduspider
Disallow: /
```

遵守这条规则的百度爬虫不会抓取本站。**仅更新仓库可能无法消除 Cloudflare 追加的规则。**

1. 登录 Cloudflare，选中 `moufang.xyz`。
2. 打开 **AI Crawl Control**，检查机器人访问设置及 **Bot Preference Sync / 托管 robots.txt**。界面名称可能随产品更新略有变化，可在站点设置中搜索 `robots` 或 `Bot Preference Sync`。
3. 本次选择由仓库提供 robots.txt：关闭会向本站文件追加托管规则的偏好同步。不要通过关闭全部 WAF 或安全功能来解决。
4. 在爬虫访问控制和相关 WAF 规则中，确认 Googlebot、Bingbot、Baiduspider 没有被 Block 或验证码挑战。保留其他已有爬虫偏好；不要批量放开所有机器人。仓库 robots.txt 继续保留此前其他具名爬虫的禁止规则。
5. 清除 `/robots.txt`、`/sitemap.xml` 及更新前网页的 Cloudflare 缓存。如果有 Cache Rules / Workers，也检查是否仍返回旧 HTML 或改写 robots.txt。
6. 重新读取公开文件，确认百度没有被其他同名规则再次禁止。不要只根据开关位置判断。

```bash
curl --fail --silent --show-error https://moufang.xyz/robots.txt
```

普通 `User-agent: * / Allow: /` 不能覆盖同一文件里专门针对 Baiduspider 的 `Disallow: /`；检查脚本会识别这种冲突。Cloudflare 可以追加托管内容，详见[官方说明](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/)。如果公开文件仍有冲突，说明尚有托管设置、Worker 或缓存需要排查。

### 统一使用 HTTPS

检查时 HTTP 首页返回 200，并未跳到 HTTPS。到 Cloudflare 的 SSL/TLS / Edge Certificates（边缘证书）找到 **Always Use HTTPS**，或使用原有等效重定向规则，将 HTTP 永久跳转到 `https://moufang.xyz`，保留路径和查询参数。

不要为了 SEO 随意更换源站加密模式。若原站依赖 Cloudflare 到源站 HTTP，不要未经核实在 Node/Nginx 再按本机协议强制跳转，避免循环跳转。[Cloudflare HTTPS 文档](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/)

```bash
curl -I http://moufang.xyz/tools/music-unlock
curl -I https://moufang.xyz/tools/music-unlock
```

预期：第一项 301 或 308，Location 指向相同 HTTPS 路径；第二项直接 200。本次正式域名使用不带 www 的地址，无需为了部署新建 www 站点。

## 5. 公网验收

在项目根目录执行：

```bash
node claudeOne/scripts/verify-seo.js --base-url https://moufang.xyz
```

Windows 本机也能运行同一条命令。预期 `ok:true`、`errors:[]`、退出码 0。常见错误：

| 报告代码 | 意义与处理 |
| --- | --- |
| `blocked-bot` | 最终公开 robots.txt 仍阻止 Google、必应或百度，优先检查 Cloudflare。 |
| `sitemap` / `missing-page` | 服务没有更新、地图未提供，或新增页面接入遗漏。 |
| `empty-main` / `help` | 仍返回通用空壳，检查 Node 服务、反向代理和旧 HTML 缓存。 |
| `canonical` / `description` | 读取到错误页面、域名配置错误或不同版本文件混用。 |
| `soft-404` | 反向代理仍把不存在的路径改成首页。 |
| `release-data` | 发售首屏与实时 API 的名称、日期、平台、简介或来源不一致，检查旧 HTML 缓存和发布版本。 |
| `https-redirect` | HTTP 尚未永久跳转到正式 HTTPS 地址。 |
| `request` / 非 200 | 根据实际地址检查网络、验证码挑战、数据读取错误或服务日志。 |

浏览器再实际检查：新网址直接打开、刷新、前进后退、旧 Hash 链接；播放音乐后切换工具和游戏；两套主题、桌面和手机宽度；帮助面板的展开、键盘焦点。游戏发售要检查真实清单、来源、封面、本期/往期切换和分页。没有真实发布数据时显示等待状态，不能为了验收编造正式数据。

## 6. 接入搜索引擎账号

代码和公网检查通过后，才进行下面的账号操作。这些步骤需要你自己的登录和网站归属验证，不需要把账号密码交给 AI。

### Google

1. 打开 [Google Search Console](https://search.google.com/search-console/about)。
2. 添加 **Domain / 网域资源** `moufang.xyz`，复制平台生成的 DNS TXT 验证值。
3. 在 Cloudflare DNS 中添加平台要求的 TXT 记录；记录名称和值严格按平台提示填写，返回 Search Console 验证。
4. 在“站点地图”提交 `https://moufang.xyz/sitemap.xml`。
5. 在“网址检查”依次检查首页、音乐解锁、一个游戏、游戏发售和往期页；查看实时测试返回的页面内容。对于已经通过检查的重点页面，可以请求编入索引。
6. 后续看“网页索引”和“效果”中的收录状态、搜索词、展现及点击，按具体问题修复。

### 必应

1. 登录 [Bing Webmaster Tools](https://www.bing.com/webmasters/about)。
2. 添加 `https://moufang.xyz`，可按平台支持方式导入已验证的 Search Console 站点，或完成它提供的验证。
3. 提交同一份网站地图，使用 URL Inspection 检查重点页面及抓取异常。

### 百度

1. 登录[百度搜索资源平台](https://ziyuan.baidu.com/)，添加 HTTPS 站点，按平台当前提供的 DNS、文件或其他方式验证。
2. **先完成第 4 节的 Baiduspider 放行**，再检查抓取诊断及 robots 结果。
3. 在“普通收录”等可用入口提交正式页面链接；账号若开放 sitemap 提交则提交同一份网站地图。具体入口与配额以该账号实际开放功能为准，不假定每个账号都有所有权益。
4. 查看索引量、抓取异常和搜索词。若平台要求放验证文件，保留它要求的原始内容并只部署该文件；不要把认证令牌写进公共示例或 AI 提示词。

提交只是帮助搜索引擎发现网址，不保证收录或排名。Google 表示重新抓取可能需要几天到几周，重复请求也不会让同一网址抓取得更快；百度同样说明普通收录提交不能保证收录。[Google 说明](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)、[百度说明](https://ziyuan.baidu.com/linksubmit/index)

## 7. 以后让 AI 增加工具时

可以直接给 AI 这段要求：

> 请先阅读 README.md 和 AGENTS.md。新增页面必须同时完成真实功能、两套主题、模板与 mount/unmount、共用登记表中的正式路径/标题/简介/帮助/更新日期、分类入口、服务端首屏和网站地图接入。详细说明默认放入可展开的使用帮助；不要写虚构能力、评分或关键词堆砌。保留播放器常驻和原有切页动画。新增入口从登记表取得正式地址，不能另写一份服务器路由白名单。运行完整测试和 verify-seo，实际检查新地址、刷新、旧链接（若存在）、两套主题和窄屏；只报告实际验证结果。

具体字段和例子见 README 的“搜索接入与新页面检查清单”。游戏发售清单的每周更新仍走原来的本地发布器，不需要把清单写入代码或修改站长平台配置。

## 8. 回退与状态记录

如果新代码异常，保留日志和当前数据，使用更新前记录的提交号核对差异。推荐在开发端对本次功能提交执行 `git revert 实际功能提交号`、测试并推送，再由服务器正常快进拉取、安装锁定依赖并重启。不要删除运行数据，也不要强制重置或强推 main。

验收记录分开填写：

- 本地代码和测试是否通过。
- 公网版本及技术检查是否通过。
- 哪些搜索平台完成验证、地图提交及网址检查。
- 哪些网址已经实际收录，是否出现展现或点击。

只有从对应平台或实际搜索结果取得证据，才能填“已收录”。代码仓库里的检查脚本无法读取你未授权连接的搜索账号数据。

### 本次检查发现的既有依赖告警

2026-11-02 安装 HTML 解析依赖后执行 `npm audit --omit=dev`，报告 5 项既有依赖告警，涉及 `body-parser`、`compression`、`proxy-addr`、`qs`、`uuid`；新增加的 `parse5` 和 `entities` 不在该报告中。此次只增加解析库，没有混入这些包的升级。`uuid` 的建议修复涉及跨大版本，不能直接运行 `npm audit fix --force` 代替兼容性验证。

上线前可重新运行审计查看当前公告，并另行安排依赖升级与相关接口、代理信任及上传回归。审计报告与公告会更新，这个记录描述的是本次实际检查结果。
