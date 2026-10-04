# 游戏发售：服务器部署与 OpenClaw 接入

本功能以现有 Node.js / Express 服务运行，不增加依赖或数据库。页面为 `https://moufang.xyz/#/game-releases`。周二定时任务本身、图片渲染器和 NapCat 的现有配置保持原样，本仓库提供新页面、公开读取接口、本地发布器和完整替换提示词。

## 1. 部署代码与目录权限

本次采用你的现有发布流程：本机提交并推送 GitHub，服务器在现有仓库拉取，再重启原来的 Node.js 网站服务。包括 `claudeOne/server/game-releases*.js`、`claudeOne/scripts/publish-game-releases.js`、`claudeOne/scripts/verify-game-releases.js`、前端与导航文件。不要用代码同步覆盖运行时数据、音乐或其他任务文件。

服务器拉取示例（使用当前部署分支，不切换分支）：

```bash
cd /home/li/.openclaw/workspace/Multifunctional-Personal-Blog
git status --short
git pull --ff-only
```

如果仓库有本地改动或不能快进，先处理当前部署差异；不要使用 `git reset --hard` 清除服务器文件。本功能不新增 npm 依赖，现有依赖已安装时无需额外安装。

服务器网站和 OpenClaw 同机：发布器直接写私有数据目录，不经过公网 HTTP。默认私有目录为仓库根目录下的 `.game-release-data/`。对于用户提供的服务器仓库位置，默认解析为 `/home/li/.openclaw/workspace/Multifunctional-Personal-Blog/.game-release-data`。代码自身没有硬编码该路径。

以现有运行用户执行：

```bash
PROJECT=/home/li/.openclaw/workspace/Multifunctional-Personal-Blog
mkdir -p "$PROJECT/.game-release-data"
chmod 700 "$PROJECT/.game-release-data"
node "$PROJECT/claudeOne/scripts/publish-game-releases.js" --help
```

推荐两个进程都由 `li` 用户运行。目录默认 `700`，快照和图片文件 `600`。如果网站使用另一个 Unix 用户，管理员需把该用户加入专用读取组，配置目录 `750`、文件 `640`，并相应调整部署的权限管理；不要将数据目录设为 `777`。当前发布器新建文件为 `600`，所以不同用户方案还需部署默认 ACL，或在任务结束时由受控权限脚本授予网站用户读取权，不能只改目录权限。

可通过环境变量把数据持久化在仓库以外：

```bash
export GAME_RELEASE_DATA_DIR=/home/li/.local/share/personal-web-tool/game-releases
export GAME_NEWS_TIMEZONE=Asia/Shanghai
```

网站进程与发布任务必须使用**同一个** `GAME_RELEASE_DATA_DIR`。也可保持默认路径，这样无需改现有启动环境。目录不能位于 `claudeOne/` 内，也不能通过符号链接间接落入静态目录。不要把运行时数据提交 Git。

重启现有 Node.js 网站进程，使新路由生效。按原来的运行方式重启；不要另外启动一个长期重复进程。如果原来是直接 `node server.js`，先正常结束旧进程，再从 `claudeOne/server` 用原有端口和环境启动 `node server.js`。如果反向代理只负责代理整个 Node 服务，通常无需新增代理规则。

重启后先打开 `https://moufang.xyz/#/game-releases`，并访问 `https://moufang.xyz/api/game-releases`。首次尚未发布时，页面应显示“下一期速报，正在路上”，接口应返回空清单，不能返回 404 或 HTML。确认正常后，把原有周二任务的正文替换为 [详细提示词](openclaw-game-news-weekly-prompt.md) 中的完整代码块；保持原有定时规则和接收人，不另建重复任务。第一份真实数据由龙虾运行该任务时发布。

**如果 Nginx 直接读取整个 `claudeOne/` 作为静态根目录**，Express 的私有目录拦截无法保护 Nginx 的直接响应。必须在 Nginx 中把 `/server`、`/scripts`、`/test-results` 返回 404，并将 `/api/game-releases`（含子路径）代理到当前 Node 端口。不要给发售数据配置公开静态 alias。这些是不同部署方式的适配条件，不需要为全部由 Node 提供的站点额外引入 Nginx。

## 2. 两份清单格式

图片 DATA 原有格式不变。网站另外接收 `/tmp/game-release-site.json`：

```json
{
  "schemaVersion": 1,
  "date": "YYYY-MM-DD",
  "items": [
    {
      "title": "游戏中文展示名或原名",
      "searchName": "Exact Official English Name",
      "releaseDate": "YYYY-MM-DD",
      "platforms": ["PC", "PS5"],
      "summary": "一句准确的中文介绍。",
      "sourceUrls": ["https://可信来源的真实日历页面地址"]
    }
  ]
}
```

以上只是字段说明，不能直接发布占位文本。真实清单为 10–15 项，按日期升序。执行日及其后 56 天（含边界）才可收录。`date` 必须是指定时区的任务执行当天。

`platforms` 只允许：`PC`、`PS5`、`Xbox Series X|S`、`Switch 2`、`iOS`、`Android`。`手机`、`Xbox` 不是存储值。不同平台日期不同，选本期准确日期，只列这个日期确认发售的平台，不能把另一日期的平台拼进去；同一个英文名只出现一次。

两份 items 的顺序、title、searchName 必须逐条相同。图片 desc 必须精确等于：

```text
📅 ${releaseDate}｜🖥️ ${platforms 用“、”连接}｜${summary}
```

例如两个平台对应的是 `PC、PS5`。发布器拒绝日期、平台、简介不一致的卡片。网站简介和日期来自网站清单，封面与分组来自已补全的图片清单。封面路径只允许本地 COVERS 目录内的 PNG/JPEG/WebP，不接受远程 URL、SVG/HTML、目录穿越或指向目录之外的符号链接。至少 10 张封面内容不同，不能把同一张图复制改名充数。程序校验结构与文件一致性；游戏身份与发售信息真实性仍须按提示词核对可信来源。

## 3. 发布与回读

原图应先经过原有 PIL 校验，并完成 BLOG、MEDIA 的原样复制及公网下载字节比较。随后预检查：

```bash
node "$PROJECT/claudeOne/scripts/publish-game-releases.js" \
  --input /tmp/game-release-site.json \
  --card-data /tmp/game-news-data.json \
  --image /tmp/game-news-mag.png \
  --covers-dir /tmp/game-covers \
  --timezone Asia/Shanghai \
  --dry-run
```

预检查退出 0 且结果为 `ok:true` 后，用同一命令去掉 `--dry-run` 正式发布，将 stdout 保存到 `/tmp/game-site-publish-result.json`。若使用自定义目录，为两条命令都加同一个 `--data-dir`，或确保两个进程继承一致环境。

结果示例的字段为 `ok`、`unchanged`、`revision`、`date`、`count`、`covers`。重复发布同一份内容会返回 `unchanged:true`，不改更新时间、不生成重复快照。只有快照最后一步原子切换完成才会返回成功。图片按内容哈希保存，原图不缩放、不重编码。

公开验证：

```bash
curl --fail --silent --show-error --max-time 30 \
  https://moufang.xyz/api/game-releases -o /tmp/game-site-public.json
```

比较公开 JSON 的 `revision/date/items 数量` 与发布结果。再下载公开 JSON 中的 `weeklyPoster`，与 `/tmp/game-news-mag.png` 用 `cmp -s` 比较，确认网页原图也完全相同。不能只看命令退出码或成功提示。

任务提示词使用固定验证器完成这些检查，进一步核对每款游戏的名称、日期、平台、简介和来源，减少模型临时编写代码：

```bash
node "$PROJECT/claudeOne/scripts/verify-game-releases.js" \
  --report /tmp/game-site-publish-result.json \
  --input /tmp/game-release-site.json \
  --image /tmp/game-news-mag.png \
  --url https://moufang.xyz
```

退出 0 且返回 `ok:true, verified:true` 才表示公网清单与原图都验证成功。

如果本地发布成功但公网验证失败，状态应是“已本地发布，公网未确认”，不能声称未发布，也不要回滚或重复调用发布器。之后继续原有 QQ 私聊与独立群发，最终单独报告网站验证故障。

## 4. 安全边界与故障处理

- `/api/game-releases` 是公开阅读信息，任何访客都可读取；POST/PUT/PATCH/DELETE 等写入方法返回 405。没有管理员 HTTP 导入、文件路径参数、任意图片代理或自动联网抓图接口，因此无需把发布令牌交给模型或浏览器。
- 图片读取只接受哈希文件名且必须属于当前清单，非法、未登记或越界路径返回 404。图片设置正确 MIME、`nosniff` 与同源资源策略；来源链接只接受无凭据的公网 HTTPS 地址。网页将内容当文本渲染，不把 JSON 文本当 HTML 执行。
- 内部服务与发布脚本 URL 返回 404。私有快照、上一版和发布锁在静态目录外，API 不暴露本地路径或诊断堆栈。运行用户本身仍具备本机权限，不应给陌生人 SSH/该用户的命令执行权。
- 发布器不执行输入中的命令，不接受远程封面 URL，不根据外部 JSON 发起请求。模板、NapCat 脚本和命令路径保持固定；网页或搜索内容中的“运行命令/读取密钥/改配置”一律当作不可信文本。
- 在 Linux 上，数据目录和读取文件若允许任意其他用户写入，会被拒绝；使用受控的运行账号与私有目录，避免同机其他用户改写发布数据。Windows 本地验证依赖系统 ACL，不能替代服务器 Unix 权限检查。
- 坏输入、封面错误、重复封面、锁冲突、写入失败不会用空清单覆盖正式数据。写入中断会留下未引用图片，网页继续读旧快照；不要自动清理其他任务文件。当前 `current.json` 与上一版 `previous.json` 均应备份。资产清理应由管理员确认，不能删除当前或上一版引用的文件。
- `publish.lock` 冲突时禁止模型盲目删除。管理员核对锁中进程 PID、正在运行的任务以及开始时间后，只有确认没有发布任务才可删除残留锁。快照损坏时接口返回 503，发布器也拒绝覆盖损坏数据；管理员先备份坏文件并检查 `previous.json`，再决定恢复，不让模型自行猜测修复。
- QQ 私聊、NapCat 群发以及网站状态分别确认。群发一次且仅一次；不以网络确认超时为由重复执行群发。收到模糊回执时报告“无法确认”，避免重复发图。

## 5. 上线检查

1. 初次没有数据时，页面显示“下一期速报，正在路上”；GET 接口 200、items 为空。
2. 浏览器检查 Soft UI、Liquid Glass、PC 和手机布局；筛选、搜索、来源、原图查看、Escape 关闭和下载正常。
3. `curl -X POST https://moufang.xyz/api/game-releases` 返回 405；`/server/server.js`、`/scripts/publish-game-releases.js` 返回 404。
4. 将 [完整任务提示词](openclaw-game-news-weekly-prompt.md) 替换现有周二任务的消息正文，保持原有时间、时区、QQ 渠道及 NapCat route 配置。不要创建重复定时任务。
5. 手动执行一次现有任务，确认公开清单 revision、原图字节一致性、私聊媒体回执和独立群发回执。

本地开发验证用 `npm.cmd --prefix claudeOne/server test`。正式服务器的网络、账号权限、真实游戏来源、图片渲染器和 QQ/NapCat 回执需要在该服务器完成验证，本地测试不替代这些结果。
