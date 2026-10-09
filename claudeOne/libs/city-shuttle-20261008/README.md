# 字符城市原创 Rust / WebAssembly 核心

本目录是本站独立实现的第一方代码编译产物，不包含 Grow Now! Games 的引擎、素材或代码。

- Rust 1.97.0，`wasm32-unknown-unknown`，无外部 crate 依赖。
- 源码：`../../engine/city-shuttle/src/lib.rs`。
- 城市构造源：`../../js/city-shuttle-scene.js` 与 `city-shuttle-{geometry,streets,neighborhoods,city,transit}.js`，固定布局、逐处设计；活动定义在 `city-shuttle-{actors,life,transit}.js`。
- 版本 0.3.0 / ABI v3：每条记录 26 个 float，支持三个旋转轴、长方体、椭球、圆柱/收分圆台与实际三角形表面。Rust 分别维护静态城市与动态人车的 BVH，计算遮挡、透明车窗、车灯照明、字符/颜色、飞行与扫掠碰撞；`floor_height` 读取真实地面，避免行人和车轮悬空。
- 静态容量 50,000 条、动态容量 12,000 条；Worker 构造城市并返回字符网格、活动时间与空间声源，WebGL2 绘制字符图集。暂停不推进城市时间，重置视角不重置交通。
- 标准与精细模式字符网格宽、高均为原来的两倍，页面最高分别为 480 × 320 与 640 × 320；`render_ascii` 支持 32–840 列、24–480 行，避免高分辨率输出被旧上限截断。
- `city-shuttle-audio.js` 使用 Web Audio 在本机合成城市声音，并处理位置、距离与运动音高。没有下载外部音频、人物贴图或建筑模型；不接管站点播放器。
- `build.json` 记录编译版本、字节数与 SHA-256；文件名包含内容哈希，避免不可变缓存混用。
- 编译时链接的 Rust 1.97.0 标准库及其构建依赖的版权说明保留为 `RUST-STANDARD-LIBRARY-COPYRIGHT.html`，另附 Rust 的 MIT / Apache-2.0 许可证。文件来自对应版本的官方 rustup 工具链发行包；HTML 副本只清理了行尾空白，许可文字保持原样。版权清单涵盖标准库各目标的依赖，不表示每一项都进入本模块。本站源码不依赖额外第三方 crate。

在仓库根目录执行 `node claudeOne/scripts/build-city-shuttle.js` 重建。需安装 Rust 1.97.0 和 `wasm32-unknown-unknown` 目标；运行网站不需要 Rust。网页按需加载模块。

画面参照：[ASCII City Update 1](https://www.youtube.com/watch?v=UCKEDWowc0o)。参照用于确定字符、遮挡、体积对象与室内连通的效果标准；本站采用原创城市布局。验看记录见 `../../../docs/city-shuttle-art-direction.md`。
