# 测试文件说明

本目录下的加密文件用于测试 QQ 音乐解锁工具的所有 5 条解密路径，覆盖用户清单中的全部格式。

## 真实 musicex 文件（需要 QQ 音乐 Cookie）

| 文件 | 解密路径 | 解密后 | 是否需要 Cookie |
|------|----------|--------|---------------|
| `BEYOND - 海阔天空.mflac` | musicex | flac | **是** — 需登录 QQ 音乐导入 Cookie |
| `BEYOND - 喜欢你.mflac` | musicex | flac | **是** |
| `BEYOND - 光辉岁月.mflac` | musicex | flac | **是** |

## 合成测试文件（无需 Cookie，可直接解密）

所有 `test_*.*` 文件都是用同一首真实 mp3（`開膛手嚶嚶嚶 - 莓 莓 布 丁 沙 冰.mp3` 的前 1.5MB）通过对应的加密路径合成而来。它们解密后会得到字节完全一致的 mp3（含 ID3 标签和 134KB 内嵌封面）。

### V1-static 路径（256 字节固定密钥表，无文件尾）

| 文件 | 测试目的 |
|------|---------|
| `test_v1_static.tkm` | 测试 `.tkm` 扩展名 |
| `test_v1_static.bkcmp3` | 测试 `.bkcmp3` 扩展名 |
| `test_v1_static.bkcflac` | 测试 `.bkcflac` 扩展名 |

### V1-keyed 路径（内嵌原始密钥 + LE keySize 尾部）

| 文件 | 测试目的 |
|------|---------|
| `test_v1_keyed.qmc0` | 测试 `.qmc0` 扩展名 |
| `test_v1_keyed.qmc3` | 测试 `.qmc3` 扩展名 |

### QTag 路径（内嵌 ekey 文本 + **BE** keySize + "QTag" 魔数）

| 文件 | 测试目的 |
|------|---------|
| `test_qtag.qmcflac` | 测试 `.qmcflac` + unlock-music 风格 `<ekey>,<songid>,<songmid>` 拆分 |
| `test_qtag.qmcogg` | 测试 `.qmcogg` 扩展名 |
| `test_legacy.mflac` | **老版 .mflac**（QQ 音乐桌面端早期版本写的是 QTag 尾部，不是 musicex） |
| `test_legacy.mgg` | **老版 .mgg**（同上） |

### STag 路径（内嵌 ekey 文本 + **LE** keySize + "STag" 魔数）

| 文件 | 测试目的 |
|------|---------|
| `test_stag.qmc2` | 测试 `.qmc2` 扩展名 |

### 合成 musicex（仅验证 parseFileTail 路径，需要 Cookie）

| 文件 | 测试目的 |
|------|---------|
| `test_musicex.mgg` | **新版 .mgg**：musicex 尾部结构合法但 songMid 是合成的，无法从 QQ 音乐 API 真正取到 EKey。用来验证：① parseFileTail 把 .mgg 识别为 musicex；② 没登录时给出 "需要 Cookie" 提示。完整解密需要真实 .mgg 文件。 |

## 用户清单覆盖情况

按你列出的 11 种格式逐一对照：

| 清单格式 | 对应文件 | 路径 |
|---------|---------|------|
| `.ncm`（网易云）| 任何 .ncm（解码器独立，未改动）| ncm-decrypt.js |
| `.qmc0` | `test_v1_keyed.qmc0` | V1-keyed |
| `.qmc2` | `test_stag.qmc2` | STag |
| `.qmc3` | `test_v1_keyed.qmc3` | V1-keyed |
| `.qmcflac` | `test_qtag.qmcflac` | QTag |
| `.qmcogg` | `test_qtag.qmcogg` | QTag |
| `.mflac`（新）| `BEYOND - *.mflac` × 3 | musicex (需 Cookie) |
| `.mflac`（老）| `test_legacy.mflac` | QTag |
| `.mgg`（新）| `test_musicex.mgg` | musicex (需 Cookie，合成 songmid 无法解出真实音频) |
| `.mgg`（老）| `test_legacy.mgg` | QTag |
| `.tkm` | `test_v1_static.tkm` | V1-static |
| `.bkcmp3` | `test_v1_static.bkcmp3` | V1-static |
| `.bkcflac` | `test_v1_static.bkcflac` | V1-static |

## 自动化验证结果

`_verify_all.js`（脚本可重新运行验证）已确认：

- **11/11** 测试文件全部通过
- 10 个合成 QTag/STag/V1-keyed/V1-static 文件解密后**字节完全一致**于原 mp3（1500000 字节），且每个都成功提取 134KB JPEG **内嵌封面**
- 1 个合成 musicex 文件（`test_musicex.mgg`）的 parseFileTail 正确识别为 musicex 格式，songMid 和 filename 都被解析出来，没有 Cookie 时给出可操作的 "需要 Cookie" 错误提示

## 重新生成 / 重新验证

```bash
# 重新生成全部 11 个合成测试文件
node testMusic/_generate_test_files.js

# 把每个文件丢回解密器跑一遍，确认能字节级还原
node testMusic/_verify_all.js
```
