# 实体颜料数据 · 2026-10-08 固定快照

本目录含 5,841 条目录记录、13 个品牌，其中 Kimera 13 色有光谱标定。它不是全品牌实测数据库。

| 来源 | 固定版本 | 用途与许可 |
| --- | --- | --- |
| [miciwan/PaintMixing](https://github.com/miciwan/PaintMixing/tree/d14a2d10f72c78f8338e2bb5a34773affb377796) | `d14a2d10f72c78f8338e2bb5a34773affb377796` | MIT Python 参考代码；原始测量、派生 K/S、积分权重和测试样本数据 CC BY 4.0，署名 miciwan |
| [s10-steve/paintdex](https://github.com/s10-steve/paintdex/tree/c8d2c035cd108d29d6c2db9334a26fe50cb22041) | `c8d2c035cd108d29d6c2db9334a26fe50cb22041` | MIT 目录和系列元数据，署名 Paintdex contributors |
| [Arcturus5404/miniature-paints](https://github.com/Arcturus5404/miniature-paints) | Paintdex 已固定快照中的上游数据 | MIT，© 2022 Rick Fleuren / Miniature Painter Pro，原始许可见 `paintdex/UPSTREAM-LICENSE` |

新增酋长大陆 449 个色号的事实目录，192 个商品色卡/瓶照近似参考值，尚无该品牌仪器标定；详见 [酋长大陆来源与精度](sheik-mainland/README.md)。

目录品牌为 AK Interactive、Army Painter、Duncan Rhodes、Green Stuff World、Kimera、Liquitex、Mig、P3、Scale 75、Tamiya、Vallejo、Warhammer、酋长大陆。制造商色号缺失时保留名称，不编造色号。品牌及产品名属于各权利人，本站不代表制造商。

## 派生文件与数值约定

- `catalogue.json`：合并固定 Paintdex 各品牌记录及 Kimera 13 色、酋长大陆公开产品事实，补充系列介质/交付形式；不是实测混色数据库。
- `kimera-model.json`：运行原始 Python 模型对每色三次纯色与白色混合测量取平均，生成 K/S；保留上游 `(1-R)^2/(4R)` 的双漫射流系数约定。
- 反射率按 170 个实测波长、381.2148–719.8746 nm 计算。XYZ 积分权重按上游光谱与 CIE / D65 网格的线性插值、零填充和梯形积分逐基生成，避免改用不同积分网格导致结果漂移。
- `manifest.json` 保存源文件及生成资源 SHA-256。正式测试还保留 17 组独立 Python 输出、12 组拟合用混合样本和原始光谱导入例子，见 `server/fixtures/paint-*`。
- Python 和 SciPy/NumPy 只用于开发时重新生成资源，网站运行及 Node 回归测试不需要这些依赖。仓库根目录执行 `python claudeOne/scripts/build-paint-data.py`；安装所需开发依赖后可离线重建，脚本不下载或运行未固定代码。

## 实际精度的边界

Python 对齐和复现标定样本只证明移植/拟合计算正确，不证明新混色、其他批次、所有漆种或手机取色的实体精度。本文没有宣称完成独立实体试调。模型假设同一标定组、质量比例、普通非金属颜料、充分覆盖底材，D65 / CIE 1931 2°；不能外推到金属、荧光、透明叠涂或等体积滴数。

目录 HEX 为制造商/社区近似值。估算模式用本地 Spectral.js 3.0.0 的单常数光谱模型，不输出未经标定的实体克数。

需要扩大可信范围时，应使用同一批次基准白、称量比例及仪器测量建立标定库，再对未参与拟合的独立混色样本验证误差。用户标定数据始终单独标识，不能与不同基准组直接混合。

## 测量数据署名与许可

原始和派生 Kimera 数据来自 **miciwan / PaintMixing**，依原仓库 README 的声明按 [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/) 提供。本站做了格式转换、K/S 参数生成、积分权重预计算与中文显示名称补充。原 MIT 代码许可证保留在 `paintmixing/LICENSE`；数据许可说明见 `paintmixing/DATA-LICENSE.md`。导出的实测配方和备份保留来源署名。
