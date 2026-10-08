# 天际城原创 Rust / WebAssembly 核心

本目录是本站独立实现的第一方代码编译产物，不包含 Grow Now! Games 的引擎、素材或代码。

- Rust 1.97.0，`wasm32-unknown-unknown`，无外部 crate 依赖。
- 源码：`../../engine/city-shuttle/src/lib.rs`。
- 城市构造源：`../../js/city-shuttle-scene.js`，固定布局、逐栋设计。
- ABI v2：26 个 float 的场景记录，支持三个旋转轴；Rust BVH 表面求交、字符/颜色采样、飞行与碰撞；Worker 返回字符网格，WebGL2 绘制字符图集。
- `build.json` 记录编译版本、字节数与 SHA-256；文件名包含内容哈希，避免不可变缓存混用。
- 编译时链接的 Rust 1.97.0 标准库及其构建依赖的版权说明保留为 `RUST-STANDARD-LIBRARY-COPYRIGHT.html`，另附 Rust 的 MIT / Apache-2.0 许可证。文件来自对应版本的官方 rustup 工具链发行包；HTML 副本只清理了行尾空白，许可文字保持原样。版权清单涵盖标准库各目标的依赖，不表示每一项都进入本模块。本站源码不依赖额外第三方 crate。

在仓库根目录执行 `node claudeOne/scripts/build-city-shuttle.js` 重建。需安装 Rust 1.97.0 和 `wasm32-unknown-unknown` 目标；运行网站不需要 Rust。网页按需加载模块。

画面参照：[ASCII City Update 1](https://www.youtube.com/watch?v=UCKEDWowc0o)。参照用于确定字符、遮挡、体积对象与室内连通的效果标准；本站采用原创城市布局。验看记录见 `../../../docs/city-shuttle-art-direction.md`。
