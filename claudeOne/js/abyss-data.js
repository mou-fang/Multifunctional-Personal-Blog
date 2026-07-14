/* ===== claudeOne :: abyss-data.js =====
 * 《深渊协议 (Protocol: Abyss)》内容数据层。
 * 与 abyss.js 解耦：本文件只定义数据，abyss.js 读取 window.__ABYSS_DATA__。
 * 精灵格式：{ w, h, frames, fps, palette:{char->hex|null}, data:[每帧 w 个字符 × h 行] }
 *   '.' 表示透明；其余字符映射 palette 颜色。脏感来自多色阶 + 1px 点缀。
 * 加载顺序：page-registry.js 的 js 数组中 abyss-data.js 必须排在 abyss.js 之前。
 */
(function (host) {
  "use strict";

  // ------------------------------------------------------------------
  // 调色板复用片段（按色系分组，方便手写精灵时保持脏感一致）
  // ------------------------------------------------------------------
  var P = {
    // 金属灰阶（机甲/结构）
    steelHi: "#dfe7ef", steel: "#9fb0bf", steelLo: "#5a6b7b", steelDark: "#2c3744", steelShd: "#161d26",
    // 能量蓝（协议核心/激光）
    energyHi: "#bfefff", energy: "#5fc8ff", energyLo: "#1f7fd6", energyDark: "#0a3a78", energyDeep: "#04183a",
    // 警示红（爆炸/血/危险）
    redHi: "#ffd0c4", red: "#ff6b5a", redLo: "#c8332a", redDark: "#7a1410", redDeep: "#3a0606",
    // 酸液绿（感染者/异常）
    acidHi: "#d6ffb0", acid: "#7fe04a", acidLo: "#3a8a1e", acidDark: "#1d4a0c", acidDeep: "#0a2105",
    // 紫渊（虚渊/异常生物）
    voidHi: "#e0b8ff", void: "#a25cff", voidLo: "#6420c0", voidDark: "#330a78", voidDeep: "#160433",
    // 暖橙（火焰/警告）
    fireHi: "#ffe6a0", fire: "#ff9a2e", fireLo: "#d65a0a", fireDark: "#7a2c00",
    // 冷青（冰/数据）
    iceHi: "#e8fbff", ice: "#7fe6f5", iceLo: "#2aa6c8", iceDark: "#0a4a6a",
    // 通用
    white: "#ffffff", bone: "#f4e8d0", skin: "#f4c59a", black: "#0a0d12",
    rust: "#8a5a3a", rustLo: "#5a3a22", gold: "#ffcf52", goldLo: "#c98a1e",
  };

  // ------------------------------------------------------------------
  // 精灵库
  // ------------------------------------------------------------------
  var SPRITES = {
    // ---- 玩家：特工 Zero（黑色战术夹克 + 蓝色护目镜 + 协议核心）16×20 ----
    zero: {
      w: 16, h: 20, frames: 2, fps: 5,
      palette: { "H": "#1a2030", "h": "#2c3744", "S": P.skin, "K": "#0a0d12", "C": "#5fc8ff", "c": "#1f7fd6", "G": "#bfefff", "B": "#2c3744", "b": "#161d26", "L": "#1a2030", "W": "#ffffff", "x": "#0a0d12" },
      data: [
        // frame 0：站立
        "....HHHHHHHH....",
        "...HhhhhhhhhH...",
        "..HhhSSSSSShhH..",
        "..HhSSSSSSSShH..",
        "..HCCCCWWCCCCH..",
        "..HhSSSKKSSShH..",
        "...HhSSSSSShH...",
        "....HHHHHHHH....",
        "....BBBBBBBB....",
        "...BbCCCCCCbB...",
        "..BbCWGGGGWCbB..",
        "..BbCGGCCGGCbB..",
        "..BbCGCCCCGCbB..",
        "..BbCWGGGGWCbB..",
        "...BbCCCCCCbB...",
        "....BBBBBBBB....",
        "....HH....HH....",
        "....Hh....hH....",
        "....HH....HH....",
        "....bb....bb....",
        // frame 1：迈步
        "....HHHHHHHH....",
        "...HhhhhhhhhH...",
        "..HhhSSSSSShhH..",
        "..HhSSSSSSSShH..",
        "..HCCCCWWCCCCH..",
        "..HhSSSKKSSShH..",
        "...HhSSSSSShH...",
        "....HHHHHHHH....",
        "....BBBBBBBB....",
        "...BbCCCCCCbB...",
        "..BbCWGGGGWCbB..",
        "..BbCGGCCGGCbB..",
        "..BbCGCCCCGCbB..",
        "..BbCWGGGGWCbB..",
        "...BbCCCCCCbB...",
        "....BBBBBBBB....",
        "...HH......HH...",
        "..Hh........hH..",
        "..HH........HH..",
        "..bb........bb..",
      ]
    },

    // ---- 玩家：医疗 AI（白色机甲 + 红十字 + 绿色护目镜）16×20 ----
    medic: {
      w: 16, h: 20, frames: 2, fps: 5,
      palette: { "W": "#ffffff", "w": "#dfe7ef", "G": "#7fe04a", "g": "#3a8a1e", "R": "#ff6b5a", "r": "#c8332a", "K": "#0a0d12", "B": "#9fb0bf", "b": "#5a6b7b", "x": "#161d26" },
      data: [
        // frame 0
        "....WWWWWWWW....",
        "...WwwwwwwwwW...",
        "..WwwWWWWWWwwW..",
        "..WwWwwwwwwWwW..",
        "..WGGGGwwGGGGW..",
        "..WgGggwwggGgW..",
        "...WwwwKKwwwW...",
        "....WWWWWWWW....",
        "....WWWWWWWW....",
        "...WwwwRRwwwW...",
        "..WwwwwRRwwwwW..",
        "..WwRRRRRRRRwW..",
        "..WwRRRRRRRRwW..",
        "..WwwwwRRwwwwW..",
        "...WwwwRRwwwW...",
        "....WWWWWWWW....",
        "....BB....BB....",
        "....Bb....bB....",
        "....BB....BB....",
        "....xx....xx....",
        // frame 1
        "....WWWWWWWW....",
        "...WwwwwwwwwW...",
        "..WwwWWWWWWwwW..",
        "..WwWwwwwwwWwW..",
        "..WGGGGwwGGGGW..",
        "..WgGggwwggGgW..",
        "...WwwwKKwwwW...",
        "....WWWWWWWW....",
        "....WWWWWWWW....",
        "...WwwwRRwwwW...",
        "..WwwwwRRwwwwW..",
        "..WwRRRRRRRRwW..",
        "..WwRRRRRRRRwW..",
        "..WwwwwRRwwwwW..",
        "...WwwwRRwwwW...",
        "....WWWWWWWW....",
        "...BB......BB...",
        "..Bb........bB..",
        "..BB........BB..",
        "..xx........xx..",
      ]
    },

    // ---- 玩家：重装士兵（厚重灰甲 + 红色独眼镜 + 金色护肩）16×20 ----
    heavy: {
      w: 16, h: 20, frames: 2, fps: 4,
      palette: { "A": "#5a6b7b", "a": "#2c3744", "d": "#161d26", "V": "#9fb0bf", "G": "#ffcf52", "g": "#c98a1e", "R": "#ff6b5a", "L": "#ffd0c4", "K": "#0a0d12", "x": "#0a0d12" },
      data: [
        // frame 0
        "...AAAAAAAAAA...",
        "..AaaaaaaaaaaA..",
        "..AaVVVVVVVVaA..",
        "..AaVaaaaaaVaA..",
        "..AaVaRRLLRaVA..",
        "..AaVaLRRRLaVA..",
        "..AaVaaKKaaVaA..",
        "..AaVVVVVVVVaA..",
        ".GGAAAAAAAAAAGG.",
        ".gGAaaaaaaaaAGg.",
        "..AaaAAAAAAaaA..",
        "..AaaAVRRVAaaA..",
        "..AaaAVRRVAaaA..",
        "..AaaAAAAAAaaA..",
        "..AaaaaaaaaaaA..",
        "...AAAaaaaAAA...",
        "....AAA..AAA....",
        "....AaA..AaA....",
        "....AAA..AAA....",
        "....xxx..xxx....",
        // frame 1
        "...AAAAAAAAAA...",
        "..AaaaaaaaaaaA..",
        "..AaVVVVVVVVaA..",
        "..AaVaaaaaaVaA..",
        "..AaVaRRLLRaVA..",
        "..AaVaLRRRLaVA..",
        "..AaVaaKKaaVaA..",
        "..AaVVVVVVVVaA..",
        ".GGAAAAAAAAAAGG.",
        ".gGAaaaaaaaaAGg.",
        "..AaaAAAAAAaaA..",
        "..AaaAVRRVAaaA..",
        "..AaaAVRRVAaaA..",
        "..AaaAAAAAAaaA..",
        "..AaaaaaaaaaaA..",
        "...AAAaaaaAAA...",
        "...AAA....AAA...",
        "..AaA......AaA..",
        "..AAA......AAA..",
        "..xxx......xxx..",
      ]
    },

    // ---- 玩家：赌徒（紫色礼帽 + 金边夹克 + 红丝带）16×20 ----
    gambler: {
      w: 16, h: 20, frames: 2, fps: 5,
      palette: { "T": "#330a78", "t": "#160433", "M": "#a25cff", "m": "#6420c0", "F": P.skin, "K": "#0a0d12", "G": "#ffcf52", "g": "#c98a1e", "R": "#ff6b5a", "W": "#ffffff", "B": "#0a0d12", "x": "#0a0d12" },
      data: [
        // frame 0
        "..TTTTTTTTTTTT..",
        ".TtttttttttttT..",
        "..TTTTTTTTTTTT..",
        "....GGGGGGGG....",
        "....MFFFFFFFM...",
        "...MFFFKKFFFM...",
        "...MFFFFFFFFM...",
        "...MFFFKKFFFM...",
        "....MFFFFFFM....",
        "....GGRRRRGG....",
        "...MMmmmmmmMM...",
        "..MmGmmRRmmGmM..",
        "..MmmGmmmmGmmM..",
        "..MmmmGmmGmmmM..",
        "...MmmmGGmmmM...",
        "....MmmmmmmM....",
        "....BB....BB....",
        "....Bm....mB....",
        "....BB....BB....",
        "....xx....xx....",
        // frame 1
        "..TTTTTTTTTTTT..",
        ".TtttttttttttT..",
        "..TTTTTTTTTTTT..",
        "....GGGGGGGG....",
        "....MFFFFFFFM...",
        "...MFFFKKFFFM...",
        "...MFFFFFFFFM...",
        "...MFFFKKFFFM...",
        "....MFFFFFFM....",
        "....GGRRRRGG....",
        "...MMmmmmmmMM...",
        "..MmGmmRRmmGmM..",
        "..MmmGmmmmGmmM..",
        "..MmmmGmmGmmmM..",
        "...MmmmGGmmmM...",
        "....MmmmmmmM....",
        "...BB......BB...",
        "..Bm........mB..",
        "..BB........BB..",
        "..xx........xx..",
      ]
    },

    // ---- 玩家：失控实验体（裸露红色生物核心 + 紫色裂纹 + 异化触手）16×20 ----
    mutant: {
      w: 16, h: 20, frames: 2, fps: 7,
      palette: { "S": P.skin, "s": "#8a5a3a", "V": "#a25cff", "v": "#330a78", "K": "#0a0d12", "R": "#ff6b5a", "r": "#7a1410", "L": "#ffd0c4", "C": "#ffcf52", "x": "#160433" },
      data: [
        // frame 0
        "....sSSSSSSss...",
        "...sSSSSSSSSss..",
        "..sSSVSSSSVSSss.",
        "..sSSSSSSSSSSs..",
        "..sSRRSSSSRRSs..",
        "..sSRKRSSRKRSs..",
        "..sSSSSKKSSSSs..",
        "..sSSvVSSVvSSs..",
        "...ssSSSSSSss...",
        "....SRRSSRRS....",
        "...SRRRRRRRRS...",
        "..SRrCCRRCCrRS..",
        "..SRCRCCCCRCRS..",
        "..SRrRRRRRRrRS..",
        "...SRrrrrrrRS...",
        "....SSrrrrSS....",
        "....SS....SS....",
        "....Vs....sV....",
        "....SS....SS....",
        "....xx....xx....",
        // frame 1
        "....sSSSSSSss...",
        "...sSSSSSSSSss..",
        "..sSSVSSSSVSSss.",
        "..sSSSSSSSSSSs..",
        "..sSRRSSSSRRSs..",
        "..sSRKRSSRKRSs..",
        "..sSSSSKKSSSSs..",
        "..sSSvVSSVvSSs..",
        "...ssSSSSSSss...",
        "....SRRSSRRS....",
        "...SRRRRRRRRS...",
        "..SRrCCRRCCrRS..",
        "..SRCRCCCCRCRS..",
        "..SRrRRRRRRrRS..",
        "...SRrrrrrrRS...",
        "....SSrrrrSS....",
        "...SS......SS...",
        "..Vs........sV..",
        "..SS........SS..",
        "..xx........xx..",
      ]
    },

    // ---- 敌人：感染者（近战追击，绿脓人形）12×14 ----
    infected: {
      w: 12, h: 14, frames: 2, fps: 5,
      palette: { "G": P.acid, "g": P.acidLo, "d": P.acidDark, "E": P.black, "R": P.red, "r": P.redDark, "x": P.acidDeep },
      data: [
        "...GGGGGG...",
        "..GggggggG..",
        ".GggggggggG.",
        ".GgEGggGEgG.",
        ".GgRRggRRgG.",
        ".GggggggggG.",
        "..GggggggG..",
        "..GgxGGxgG..",
        "..GgGGGGgG..",
        "..GggggggG..",
        "...Gg..gG...",
        "...Gg..gG...",
        "...xx..xx...",
        "...dd..dd...",
        "...GGGGGG...",
        "..GggggggG..",
        ".GggggggggG.",
        ".GgEGggGEgG.",
        ".GgRRggRRgG.",
          ".GggggggggG.",
        "..GggggggG..",
        ".GgxGGxgG...",
        ".GgGGGGgG...",
        ".GggggggG...",
        "..Gg..gG....",
        "..Gg..gG....",
        "..xx..xx....",
        "..dd..dd....",
      ]
    },

    // ---- 敌人：飞行无人机（远程骚扰）14×12 ----
    drone_enemy: {
      w: 14, h: 12, frames: 2, fps: 8,
      palette: { "S": P.steel, "s": P.steelLo, "d": P.steelDark, "R": P.red, "r": P.redDark, "E": P.black, "L": P.redHi, "x": P.steelShd },
      data: [
        "....SSSS....",
        "...SssssS...",
        "..SssRRssS..",
        ".SssRLLRssS.",
        "SsssRLLRsssS",
        "SssssRRssssS",
        "SsddssssddsS",
        ".SddsssssS..",
        "..SddddddS..",
        "...SxxxxS...",
        "....xxxx....",
        ".............",
        "....SSSS....",
        "...SssssS...",
        "..SssRRssS..",
        ".SssRLLRssS.",
        "SsssRLLRsssS",
        "SssssRRssssS",
        "SsddssssddsS",
        ".SddsssssS..",
        "..SddddddS..",
        "...SxxxxS...",
        "....xxxx....",
        ".............",
      ]
    },

    // ---- 敌人：爆炸虫（圆润 + 引信光）10×10 ----
    bomber: {
      w: 10, h: 10, frames: 2, fps: 6,
      palette: { "R": P.red, "r": P.redDark, "O": P.fire, "o": P.fireLo, "E": P.black, "Y": P.fireHi, "x": P.redDeep },
      data: [
        "..RRRR..",
        ".RrrrrR.",
        "RrrOOrrR",
        "RrOYYOrR",
        "RrOYYOrR",
        "RrrOOrrR",
        ".RrrrrR.",
        "..RRRR..",
        "...oo...",
        "...OO...",
        "..RRRR..",
        ".RrrrrR.",
        "RrrOOrrR",
        "RrOYYOrR",
          "RrOYYOrR",
        "RrrOOrrR",
        ".RrrrrR.",
        "..RRRR..",
        "..ooo...",
        ".OOOOO..",
      ]
    },

    // ---- 敌人：幽影（半透明紫影，瞬移）12×14 ----
    wraith: {
      w: 12, h: 14, frames: 2, fps: 4,
      palette: { "V": P.void, "v": P.voidLo, "d": P.voidDark, "E": P.black, "L": P.voidHi, "x": P.voidDeep },
      data: [
        "....VVVV....",
        "...VvvvvV...",
        "..VvLLLLvV..",
        "..VvLvvLvV..",
        "..VvLLLLvV..",
        "...VvvvvV...",
        "..VvdxxvV...",
        ".VvddxxdvV..",
        ".VvddddvV...",
        "VvvddvvV....",
        "Vvv..vvV....",
        ".Vv..vV.....",
        "..x..x......",
        "..x..x......",
        "....VVVV....",
        "...VvvvvV...",
        "..VvLLLLvV..",
        "..VvLvvLvV..",
        "..VvLLLLvV..",
        "...VvvvvV...",
        ".VvdxxvV....",
        "VvddxxdvV...",
        "VvddddvV....",
        ".vvddvv.....",
        ".vv..vv.....",
        ".Vv..vV.....",
        "..x..x......",
        "..x..x......",
      ]
    },

    // ---- 敌人：护盾兵（带六边形能量盾）12×14 ----
    shielder: {
      w: 12, h: 14, frames: 1, fps: 1,
      palette: { "S": P.steel, "s": P.steelLo, "d": P.steelDark, "C": P.ice, "c": P.iceLo, "E": P.black, "R": P.red, "x": P.steelShd, "L": P.iceHi },
      data: [
        "...CCCCCC...",
        "..CLccccLC..",
        ".CLccddccLC.",
        "CLccddddccLC",
        "CLcdSSSSdcLC",
        "CLcdSssSdcLC",
        "CLcdSEEsdcLC",
        "CLcdSEEsdcLC",
        "CLcdSssSdcLC",
        "CLcdSSSSdcLC",
        ".CLcddddcLC.",
        "..CLccccLC..",
        "...CCCCCC...",
        "....xxxx....",
      ]
    },

    // ---- 敌人：医疗机（白色 + 绿十字光环）12×12 ----
    healer: {
      w: 12, h: 12, frames: 2, fps: 5,
      palette: { "W": P.bone, "w": P.white, "G": P.acid, "g": P.acidLo, "E": P.black, "C": P.iceLo, "L": P.acidHi, "x": P.steelShd },
      data: [
        "..WWWWWW..",
        ".WwwwwwwW.",
        "WwCCCCCCwW",
        "WwCwwwwCwW",
        "WwCwGGwCwW",
        "WwCGGGGCwW",
        "WwCwGGwCwW",
        "WwCwwwwCwW",
        "WwCCCCCCwW",
        ".WwwwwwwW.",
        "..WWWWWW..",
        "...xxxx...",
        "..WWWWWW..",
        ".WwwwwwwW.",
        "WwCCCCCCwW",
        "WwCwwwwCwW",
        "WwCwGGwCwW",
        "WwCLGGGCwW",
        "WwCwGGwCwW",
          "WwCwwwwCwW",
        "WwCCCCCCwW",
        ".WwwwwwwW.",
        "..WWWWWW..",
        "...xxxx...",
      ]
    },

    // ---- 敌人：复制体（细胞状，会分裂）10×10 ----
    splitter: {
      w: 10, h: 10, frames: 2, fps: 4,
      palette: { "V": P.void, "v": P.voidLo, "d": P.voidDark, "E": P.black, "L": P.voidHi, "x": P.voidDeep },
      data: [
        "..VVVV..",
        ".VvvvvV.",
        "VvLLLLvV",
        "VvLvLvLV",
        "VvLLLLvV",
        "VvvddvvV",
        ".VvddvV.",
        "..VddV..",
        "...xx...",
        "...xx...",
        "..VVVV..",
        ".VvvvvV.",
        "VvLLLLvV",
        "VvLvLvLV",
        "VvLLLLvV",
        "VvvddvvV",
        ".VvddvV.",
        "..VddV..",
        "..xxx...",
        "..xxx...",
      ]
    },

    // ---- 敌人：深渊之眼（大眼球，发射激光）14×12 ----
    eye: {
      w: 14, h: 12, frames: 2, fps: 4,
      palette: { "V": P.voidDark, "v": P.voidLo, "W": P.bone, "R": P.red, "r": P.redDark, "E": P.black, "L": P.redHi, "Y": P.fireHi, "x": P.voidDeep },
      data: [
        "...VVVVVVVV...",
        "..VvvvvvvvvV..",
        ".VvvWWWWWWvvV.",
        "VvvWRLLLLRWvvV",
        "VvvWRLYLLRWvvV",
        "VvvWRLLLLRWvvV",
        "VvvWWWWWWWWvvV",
        ".VvvvvvvvvvvV.",
        "..VvvvvvvvvV..",
        "...VxxxxxxV...",
        "....xxxxxxxx..",
        "..............",
        "...VVVVVVVV...",
        "..VvvvvvvvvV..",
        ".VvvWWWWWWvvV.",
        "VvvWRLLLLRWvvV",
        "VvvWRLYLLRWvvV",
        "VvvWRLLLLRWvvV",
          "VvvWWWWWWWWvvV",
        ".VvvvvvvvvvvV.",
        "..VvvvvvvvvV..",
        "...VxxxxxxV...",
        "...xxxxxxxx...",
        "..............",
      ]
    },

    // ---- 经验晶体（小）4×4 ----
    gem_small: {
      w: 4, h: 4, frames: 1, fps: 1,
      palette: { "C": P.energy, "c": P.energyLo, "H": P.energyHi, "x": P.energyDeep },
      data: [
        ".Hc.",
        "HCcH",
        "HCcx",
        ".xc.",
      ]
    },
    // ---- 经验晶体（大/精英）6×6 ----
    gem_big: {
      w: 6, h: 6, frames: 1, fps: 1,
      palette: { "C": P.gold, "c": P.goldLo, "H": P.fireHi, "x": P.redDark, "W": P.white },
      data: [
        ".WHcc.",
        "WHCCcH",
        "WCCCcH",
        "HCCCcx",
        "HcCcxx",
        ".xcxx.",
      ]
    },
    // ---- 金币 5×5 ----
    coin: {
      w: 5, h: 5, frames: 2, fps: 6,
      palette: { "G": P.gold, "g": P.goldLo, "H": P.fireHi, "x": P.rustLo },
      data: [
        ".GGG.",
        "GHgHg",
        "GHgGg",
        "Ggxgg",
        ".xgx.",
        ".gGg.",
        "gGgGg",
        "gGgGx",
        "Gggxg",
        ".xgx.",
      ]
    },
    // ---- 补给箱 8×8 ----
    crate: {
      w: 8, h: 8, frames: 1, fps: 1,
      palette: { "W": P.rust, "w": P.rustLo, "G": P.gold, "g": P.goldLo, "E": P.black, "x": P.steelShd },
      data: [
        "WWWWWWWW",
        "WggggggW",
        "WgGWWgGW",
        "WgWEEWgW",
        "WgWEEWgW",
        "WgGWWgGW",
        "WggggggW",
        "xxxxxxxx",
      ]
    },

    // ---- Boss 1：钢铁巨蛛 32×24（大尺寸）----
    spider_boss: {
      w: 32, h: 24, frames: 2, fps: 4,
      palette: { "S": P.steel, "s": P.steelLo, "d": P.steelDark, "x": P.steelShd, "R": P.red, "r": P.redDark, "E": P.black, "L": P.redHi, "g": P.steelHi },
      data: (() => {
        var f = [];
        // 用程序化方式生成两只对称蜘蛛腿，保证细节
        for (var fr = 0; fr < 2; fr++) {
          var rows = [];
          for (var y = 0; y < 24; y++) { rows.push(new Array(32).fill(".")); }
          // 腿（8 条）
          var legOffsets = [
            [4, 8, -1], [6, 10, -1], [4, 14, -1], [6, 18, -1],
            [4, 22, 1], [6, 20, 1], [4, 26, 1], [6, 28, 1]
          ];
          // 简化：画腹部 + 头 + 腿
          // 腹部椭圆
          function disc(cx, cy, rx, ry, ch) {
            for (var yy = -ry; yy <= ry; yy++) for (var xx = -rx; xx <= rx; xx++) {
              if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) <= 1) {
                var px = cx + xx, py = cy + yy;
                if (px >= 0 && px < 32 && py >= 0 && py < 24) rows[py][px] = ch;
              }
            }
          }
          disc(16, 12, 9, 6, "S");
          disc(16, 12, 7, 4, "s");
          disc(16, 11, 5, 3, "d");
          // 红色眼/纹
          disc(16, 10, 2, 1, "R");
          rows[10][15] = "L"; rows[10][16] = "L"; rows[10][17] = "L";
          // 腿
          var legY = fr === 0 ? 0 : 1;
          function leg(x0, y0, dir) {
            for (var i = 0; i < 8; i++) {
              var lx = x0 + dir * i, ly = y0 - (i < 4 ? i : 6 - i) + legY;
              if (lx >= 0 && lx < 32 && ly >= 0 && ly < 24 && rows[ly][lx] === ".") rows[ly][lx] = "s";
            }
          }
          leg(7, 9, -1); leg(7, 13, -1); leg(8, 15, -1); leg(8, 17, -1);
          leg(25, 9, 1); leg(25, 13, 1); leg(24, 15, 1); leg(24, 17, 1);
          // 头部前突
          disc(16, 6, 4, 2, "S");
          rows[5][14] = "E"; rows[5][17] = "E";
          rows[6][14] = "r"; rows[6][17] = "r";
          f.push(rows.map(function (r) { return r.join(""); }));
        }
        return f;
      })()
    },

    // ---- Boss 2：机械教皇 32×28 ----
    pope_boss: {
      w: 32, h: 28, frames: 1, fps: 1,
      palette: { "G": P.gold, "g": P.goldLo, "S": P.steel, "s": P.steelLo, "d": P.steelDark, "R": P.red, "r": P.redDark, "E": P.black, "L": P.fireHi, "W": P.bone, "x": P.steelShd },
      data: (() => {
        var rows = [];
        for (var y = 0; y < 28; y++) rows.push(new Array(32).fill("."));
        function disc(cx, cy, rx, ry, ch) {
          for (var yy = -ry; yy <= ry; yy++) for (var xx = -rx; xx <= rx; xx++) {
            if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) <= 1) {
              var px = cx + xx, py = cy + yy;
              if (px >= 0 && px < 32 && py >= 0 && py < 28) rows[py][px] = ch;
            }
          }
        }
        // 三重光环
        disc(16, 14, 13, 12, "s");
        disc(16, 14, 11, 10, "S");
        disc(16, 14, 9, 8, "g");
        // 主体
        disc(16, 14, 7, 7, "G");
        disc(16, 14, 5, 5, "g");
        // 机械脸
        disc(16, 12, 4, 3, "W");
        rows[11][13] = "E"; rows[11][18] = "E";
        rows[12][13] = "R"; rows[12][18] = "R";
        rows[13][14] = "E"; rows[13][15] = "E"; rows[13][16] = "E"; rows[13][17] = "E";
        // 顶部权杖光
        rows[1][15] = "L"; rows[2][15] = "L"; rows[2][16] = "L"; rows[1][16] = "L";
        // 侧翼装饰
        for (var i = 0; i < 6; i++) { rows[6 + i][3] = "d"; rows[6 + i][28] = "d"; }
        return [rows.map(function (r) { return r.join(""); })];
      })()
    },

    // ---- Boss 3：深渊列车 48×16（横长）----
    train_boss: {
      w: 48, h: 16, frames: 1, fps: 1,
      palette: { "S": P.steel, "s": P.steelLo, "d": P.steelDark, "x": P.steelShd, "R": P.red, "r": P.redDark, "E": P.black, "L": P.redHi, "F": P.fire, "f": P.fireLo, "Y": P.fireHi },
      data: (() => {
        var rows = [];
        for (var y = 0; y < 16; y++) rows.push(new Array(48).fill("."));
        function rect(x0, y0, w, h, ch) {
          for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) {
            if (x >= 0 && x < 48 && y >= 0 && y < 16) rows[y][x] = ch;
          }
        }
        // 车头
        rect(40, 4, 6, 8, "S"); rect(41, 5, 5, 6, "s");
        rect(42, 5, 3, 2, "L"); // 车灯
        rect(43, 9, 2, 1, "E");
        // 车厢
        rect(2, 4, 38, 8, "S");
        rect(3, 5, 36, 6, "s");
        // 窗户
        for (var w = 0; w < 6; w++) { rect(6 + w * 6, 5, 4, 2, "R"); rect(6 + w * 6, 5, 4, 1, "L"); }
        // 底盘 + 轮
        rect(2, 12, 44, 2, "d");
        for (var wh = 0; wh < 6; wh++) {
          rect(5 + wh * 7, 13, 3, 2, "x");
          rect(6 + wh * 7, 13, 1, 1, "r");
        }
        // 烟雾/火焰
        rect(44, 2, 2, 2, "F"); rect(45, 1, 1, 1, "Y");
        return [rows.map(function (r) { return r.join(""); })];
      })()
    },

    // ---- Boss 4：██协议（抽象几何核心，动态）32×32 ----
    protocol_boss: {
      w: 32, h: 32, frames: 2, fps: 3,
      palette: { "V": P.void, "v": P.voidLo, "d": P.voidDark, "x": P.voidDeep, "R": P.red, "r": P.redDark, "E": P.black, "L": P.voidHi, "W": P.white, "S": P.steel, "s": P.steelLo },
      data: (() => {
        var frames = [];
        for (var fr = 0; fr < 2; fr++) {
          var rows = [];
          for (var y = 0; y < 32; y++) rows.push(new Array(32).fill("."));
          function disc(cx, cy, rx, ry, ch) {
            for (var yy = -ry; yy <= ry; yy++) for (var xx = -rx; xx <= rx; xx++) {
              if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) <= 1) {
                var px = cx + xx, py = cy + yy;
                if (px >= 0 && px < 32 && py >= 0 && py < 32) rows[py][px] = ch;
              }
            }
          }
          // 外环（断裂）
          disc(16, 16, 14, 14, "v");
          disc(16, 16, 12, 12, ".");
          // 旋转的尖刺（4 方向，第二帧偏移）
          var off = fr === 0 ? 0 : 1;
          function spike(angle) {
            for (var r = 8; r <= 15; r++) {
              var px = Math.round(16 + Math.cos(angle) * r), py = Math.round(16 + Math.sin(angle) * r);
              if (px >= 0 && px < 32 && py >= 0 && py < 32) rows[py][px] = "V";
            }
          }
          spike(off * 0.05); spike(Math.PI / 2 + off * 0.05); spike(Math.PI + off * 0.05); spike(Math.PI * 1.5 + off * 0.05);
          // 核心
          disc(16, 16, 6, 6, "d");
          disc(16, 16, 5, 5, "V");
          disc(16, 16, 3, 3, "R");
          disc(16, 16, 2, 2, "L");
          rows[16][16] = "W";
          // 眼
          rows[15][14] = "E"; rows[15][17] = "E";
          rows[16][14] = "r"; rows[16][17] = "r";
          frames.push(rows.map(function (r) { return r.join(""); }));
        }
        return frames;
      })()
    },

    // ---- 炮塔（逻辑模块召唤）10×10 ----
    turret: {
      w: 10, h: 10, frames: 1, fps: 1,
      palette: { "S": P.steel, "s": P.steelLo, "d": P.steelDark, "R": P.red, "E": P.black, "L": P.redHi, "x": P.steelShd },
      data: [
        "....SS....",
        "...SssS...",
        "..SsRRsS..",
        "..SsRLRsS.",
        ".SssRRRssS",
        ".SsdEEEssS",
        ".SsddddssS",
        "..SsddssS.",
        "...SssS...",
        "....xx....",
      ]
    },

    // ============ 22 种新敌人精灵 ============
    // 9. 腐化爬虫（小型快速近战）10×8
    crawler: {
      w: 10, h: 8, frames: 2, fps: 6,
      palette: { "G": P.acidDark, "g": P.acidLo, "d": P.acidDeep, "E": P.black, "R": P.red, "x": P.acidDeep },
      data: [
        "..GGGGGG..",
        ".GggggggG.",
        "GgGGEEGGgG",
        "GgRRggRRgG",
        "GggggggggG",
        ".GgddddgG.",
        "..Gx..xG..",
        "...x..x...",
        "..GGGGGG..",
        ".GggggggG.",
        "GgGGEEGGgG",
        "GgRRggRRgG",
        "GggggggggG",
        ".GgddddgG.",
        ".Gx....xG.",
        "x........x",
      ]
    },
    // 10. 钉刺兽（带尖刺的冲锋者）12×12
    spiker: {
      w: 12, h: 12, frames: 1, fps: 1,
      palette: { "S": P.steelLo, "s": P.steelDark, "d": P.steelShd, "R": P.red, "r": P.redDark, "E": P.black, "L": P.redHi },
      data: [
        ".S..S..S..S.",
        ".s..s..s..s.",
        "..SSSSSSSS..",
        ".SsRRRRRRsS.",
        "SsRrLLLLrRsS",
        "SsRLrrrrLRsS",
        "SsRLrEELrRsS",
        "SsRLrEELrRsS",
        "SsRLrrrrLRsS",
        "SsRrLLLLrRsS",
        ".SsRRRRRRsS.",
        "..SddddddS..",
      ]
    },
    // 11. 毒囊虫（喷毒远程）10×10
    spitter: {
      w: 10, h: 10, frames: 2, fps: 5,
      palette: { "G": P.acid, "g": P.acidLo, "d": P.acidDark, "E": P.black, "P": P.acidHi, "x": P.acidDeep },
      data: [
        "..GGGG..",
        ".GggggG.",
        "GgGEEGgG",
        "GgGPPGgG",
        "GggggggG",
        "GgddddgG",
        ".Gx..xG.",
        "..G..G..",
        "...PP...",
        "...GG...",
        "..GGGG..",
        ".GggggG.",
        "GgGEEGgG",
        "GgGPPGgG",
        "GggggggG",
        "GgddddgG",
        ".Gx..xG.",
        "..G..G..",
        "..PPP...",
        "..PGGP..",
      ]
    },
    // 12. 铁甲坦克（高血厚甲缓慢）14×14
    tank: {
      w: 14, h: 14, frames: 1, fps: 1,
      palette: { "A": P.steel, "a": P.steelLo, "d": P.steelDark, "x": P.steelShd, "R": P.red, "G": P.gold, "E": P.black },
      data: [
        "...AAAAAAAA...",
        "..AaaaaaaaaA..",
        ".AadGGGGGGdaA.",
        "AaadGGGGGGdaaA",
        "AadGGGGGGGGdaA",
        "AadGAAA_AAAGdaA",
        "AadGAaaaAaaGdaA",
        "AadGaEEEaEEGdaA",
        "AadGaEEEaEEGdaA",
        "AadGAaaaAaaGdaA",
        "AadGAAA_AAAGdaA",
        "AadGGGGGGGGdaA",
        ".AadGGGGGGdaA.",
        "..AxxxxxxxxA..",
      ]
    },
    // 13. 自爆蛹（更大爆炸）12×12
    cocoon: {
      w: 12, h: 12, frames: 2, fps: 5,
      palette: { "R": P.redDark, "r": P.redDeep, "O": P.fire, "o": P.fireLo, "Y": P.fireHi, "E": P.black, "x": P.steelShd },
      data: [
        "...RRRRRR...",
        "..RrrrrrrR..",
        ".RrrOOOOrR..",
        "RrrOYYYORrR.",
        "RrOYEYYOYrR.",
        "RrOYYYEYOrR.",
        "RrOYEYYYOrR.",
        "RrOYYYOYYrR.",
        ".RrrOOOOrR..",
        "..RrrrrrrR..",
        "...RxxxxR...",
        "....xxxx....",
        "...RRRRRR...",
        "..RrrrrrrR..",
        ".RrrooooorR.",
        "RrroYYYYorrR",
        "RroYYEYYoYrR",
        "RroYYYEYorrR",
        "RroYYEYYorrR",
        "RroYYYYorrR.",
        ".RrrooooorR.",
        "..RrrrrrrR..",
        "...RxxxxR...",
        "....xxxx....",
      ]
    },
    // 14. 幻影刺客（瞬移 + 高伤）12×14
    phantom: {
      w: 12, h: 14, frames: 2, fps: 4,
      palette: { "V": P.voidDark, "v": P.voidLo, "d": P.voidDeep, "L": P.voidHi, "E": P.black, "R": P.red, "x": P.voidDeep },
      data: [
        "....VVVV....",
        "...VvvvvV...",
        "..VvLLLLvV..",
        "..VvLvvLvV..",
        "..VvLRRLvV..",
        "...VvvvvV...",
        "..VvddddvV..",
        ".VvdRRRRdvV.",
        ".VvdRxxRdvV.",
        "VvddRxxRddvV",
        "VvvddddddvvV",
        ".Vv......vV.",
        "..x......x..",
        "..x......x..",
        "....VVVV....",
        "...VvvvvV...",
        "..VvLLLLvV..",
        "..VvLvvLvV..",
        "..VvLRRLvV..",
        "...VvvvvV...",
        ".VvddddvV...",
        "VvdRRRRdvV..",
        "VvdRxxRdvV..",
        "VvddRxxRddvV",
        ".VvddddddvvV",
        "..Vv....vV..",
        "...x....x...",
        "...x....x...",
      ]
    },
    // 15. 能量盾卫（重盾坦克型）12×14
    bulwark: {
      w: 12, h: 14, frames: 1, fps: 1,
      palette: { "S": P.steel, "s": P.steelLo, "d": P.steelDark, "C": P.ice, "c": P.iceLo, "L": P.iceHi, "E": P.black, "x": P.steelShd },
      data: [
        "...CCCCCC...",
        "..CLccccLC..",
        ".CLccSSccLC.",
        "CLccSsssSccLC",
        "CLcdSsssSdcLC",
        "CLcdSEEsSdcLC",
        "CLcdSEEsSdcLC",
        "CLcdSsssSdcLC",
        "CLcdSSSSSdcLC",
        ".CLcdSSSdcLC.",
        "..CLcdSSdcLC.",
        "...CLcdcLC..",
        "....CLLC....",
        ".....xx.....",
      ]
    },
    // 16. 修复蜂群（群体治疗）10×10
    swarm_healer: {
      w: 10, h: 10, frames: 2, fps: 8,
      palette: { "W": P.bone, "w": P.white, "G": P.acid, "g": P.acidLo, "L": P.acidHi, "E": P.black, "x": P.steelShd },
      data: [
        "..WWWWWW..",
        ".WwwwwwwW.",
        "WwGGwwGGwW",
        "WwGwwwwGwW",
        "WwGGwwGGwW",
        "WwwwwwwwwW",
        ".WwwwwwwW.",
        "..WxxxxW..",
        "...xxxx...",
        "..........",
        "..WWWWWW..",
        ".WwwwwwwW.",
        "WwGGwwGGwW",
        "WwLwwwwLwW",
        "WwGGwwGGwW",
        "WwwwwwwwwW",
        ".WwwwwwwW.",
        "..WxxxxW..",
        "...xxxx...",
        "..........",
      ]
    },
    // 17. 二分裂体（分裂更多）10×10
    mitosis: {
      w: 10, h: 10, frames: 2, fps: 3,
      palette: { "V": P.void, "v": P.voidLo, "d": P.voidDark, "L": P.voidHi, "E": P.black, "x": P.voidDeep },
      data: [
        ".VV..VV..",
        "VvvVVvvV.",
        "VvLLLLvV.",
        "VvLvLvLV.",
        "VvLLLLvV.",
        ".VvddvV..",
        "..VddV...",
        "...xx....",
        "...xx....",
        ".........",
        ".VV..VV..",
        "VvvVVvvV.",
        "VvLLLLvV.",
        "VvLvLvLV.",
        "VvLLLLvV.",
        ".VvddvV..",
        "..VddV...",
        "..xxx....",
        "..xxx....",
        ".........",
      ]
    },
    // 18. 激光眼（强化版深渊之眼）14×12
    mega_eye: {
      w: 14, h: 12, frames: 2, fps: 4,
      palette: { "V": P.voidDark, "v": P.voidLo, "W": P.bone, "R": P.red, "r": P.redDark, "E": P.black, "L": P.redHi, "Y": P.fireHi, "P": P.void },
      data: [
        "..VVVVVVVVVV..",
        ".VvvvvvvvvvvV.",
        "VvvWWWWWWWWvvV",
        "VvvWRPYYPRWvvV",
        "VvvWRPYYPRWvvV",
        "VvvWRPYYPRWvvV",
        "VvvWWWWWWWWvvV",
        ".VvvvvvvvvvvV.",
        "..VvvvvvvvvV..",
        "...VxxxxxxV...",
        "..............",
        "..............",
        "..VVVVVVVVVV..",
        ".VvvvvvvvvvvV.",
        "VvvWWWWWWWWvvV",
        "VvvWRYPPYRWvvV",
        "VvvWRPYYPRWvvV",
        "VvvWRPYYPRWvvV",
        "VvvWWWWWWWWvvV",
        ".VvvvvvvvvvvV.",
        "..VvvvvvvvvV..",
        "...VxxxxxxV...",
        "..............",
        "..............",
      ]
    },
    // 19. 感染巨兽（大型近战，高血）14×14
    brute: {
      w: 14, h: 14, frames: 2, fps: 4,
      palette: { "G": P.acid, "g": P.acidLo, "d": P.acidDark, "E": P.black, "R": P.red, "r": P.redDark, "x": P.acidDeep },
      data: [
        "...GGGGGGGG...",
        "..GggggggggG..",
        ".GggGGGGGGggG.",
        "GggGGggggGGggG",
        "GggGGEggEGGggG",
        "GggGgRRggRGggG",
        "GggGgRRggRGggG",
        "GggGGggggGGggG",
        "GggGGGGGGGGggG",
        ".GgggddddgggG.",
        "..GgddRRddgG..",
        "...GxRxxRxG...",
        "...xx....xx...",
        "...xx....xx...",
        "...GGGGGGGG...",
        "..GggggggggG..",
        ".GggGGGGGGggG.",
        "GggGGggggGGggG",
        "GggGGEggEGGggG",
        "GggGgRRggRGggG",
        "GggGgRRggRGggG",
        "GggGGggggGGggG",
        "GggGGGGGGGGggG",
        ".GgggddddgggG.",
        "..GgddRRddgG..",
        "...GxRxxRxG...",
        "..xx......xx..",
        "..xx......xx..",
      ]
    },
    // 20. 弹幕蜂（多发远程）10×10
    wasp: {
      w: 10, h: 10, frames: 2, fps: 8,
      palette: { "Y": P.fireHi, "y": P.fire, "o": P.fireLo, "E": P.black, "R": P.red, "x": P.fireDark },
      data: [
        "...YYYY...",
        "..YyyyyY..",
        ".YyEyyEyyY",
        "YyyRRyyRRy",
        "YyRRyyRRyY",
        "YyyyyyyyyY",
        ".YooooooY.",
        "..YxxxxY..",
        "...xxxx...",
        "..........",
        "...YYYY...",
        "..YyyyyY..",
        ".YyEyyEyyY",
        "YyyRRyyRRy",
        "YyRRyyRRyY",
        "YyyyyyyyyY",
        ".YooooooY.",
        "..YxxxxY..",
        "..xxxxx...",
        "..........",
      ]
    },
    // 21. 寄生卵（静止孵化，分裂出小怪）10×10
    egg: {
      w: 10, h: 10, frames: 2, fps: 3,
      palette: { "V": P.voidLo, "v": P.voidDark, "d": P.voidDeep, "G": P.acid, "g": P.acidLo, "E": P.black, "x": P.voidDeep },
      data: [
        "..VVVVVV..",
        ".VvvvvvvV.",
        "VvvgGGGgvV",
        "VvgGEEEgVv",
        "VvgGEEGgVv",
        "VvgGGGGgVv",
        "VvvgGGgvVV",
        ".VvvvvvvV.",
        "..VxxxxV..",
        "...xxxx...",
        "..VVVVVV..",
        ".VvvvvvvV.",
        "VvvgGGGgvV",
        "VvgGEEEgVv",
        "VvgGEgGgVv",
        "VvgGGgGgVv",
        "VvvgGggvVV",
        ".VvvvvvvV.",
        "..VxxxxV..",
        "...xxxx...",
      ]
    },
    // 22. 磁力机（吸引玩家）12×12
    magnet: {
      w: 12, h: 12, frames: 2, fps: 5,
      palette: { "S": P.steel, "s": P.steelLo, "d": P.steelDark, "B": P.ice, "b": P.iceLo, "R": P.red, "E": P.black, "x": P.steelShd },
      data: [
        "...SSSSSS...",
        "..SsssssSs..",
        ".SsBBBBBBsS.",
        "SsBbbbbbbBsS",
        "SsBbRRRRbBsS",
        "SsBbRxxRbBsS",
        "SsBbRxxRbBsS",
        "SsBbRRRRbBsS",
        "SsBbbbbbbBsS",
        ".SsddddddsS.",
        "..SxxxxxxS..",
        "...xxxxxx...",
        "...SSSSSS...",
        "..SsssssSs..",
        ".SsBBBBBBsS.",
        "SsBbbbbbbBsS",
        "SsBbRRRRbBsS",
        "SsBbRxxRbBsS",
        "SsBbRxxRbBsS",
        "SsBbRRRRbBsS",
        "SsBbbbbbbBsS",
        ".SsddddddsS.",
        "..SxxxxxxS..",
        "..xxxxxxx...",
      ]
    },
    // 23. 虚空棱镜（折射激光塔）12×12
    prism: {
      w: 12, h: 12, frames: 2, fps: 4,
      palette: { "V": P.void, "v": P.voidLo, "d": P.voidDark, "L": P.voidHi, "W": P.white, "R": P.red, "E": P.black, "x": P.voidDeep },
      data: [
        "....VVVV....",
        "...VvvvvV...",
        "..VvLLLLvV..",
        ".VvLvRRvLvV.",
        "VvLvRWWRvLvV",
        "VvLvRWERvLvV",
        "VvLvRWWRvLvV",
        ".VvLvRRvLvV.",
        "..VvLLLLvV..",
        "...VvvvvV...",
        "....VxxV....",
        ".....xx.....",
        "....VVVV....",
        "...VvvvvV...",
        "..VvLLLLvV..",
        ".VvLvRRvLvV.",
        "VvLvRWWRvLvV",
        "VvLvRWWRvLvV",
        "VvLvRWWRvLvV",
        ".VvLvRRvLvV.",
        "..VvLLLLvV..",
        "...VvvvvV...",
        "....VxxV....",
        ".....xx.....",
      ]
    },
    // 24. 腐液史莱姆（缓慢但粘人）12×10
    slime: {
      w: 12, h: 10, frames: 2, fps: 3,
      palette: { "G": P.acid, "g": P.acidLo, "d": P.acidDark, "L": P.acidHi, "E": P.black, "x": P.acidDeep },
      data: [
        "...GGGGGG...",
        "..GggggggG..",
        ".GgggLLgggG.",
        "GgggLggLgggG",
        "GgggEggEgggG",
        "GggggggggggG",
        "GgdddddddddG",
        ".GxxxxxxxxG.",
        "..xxxxxxxx..",
        "............",
        "...GGGGGG...",
        "..GggggggG..",
        ".GgggLLgggG.",
        "GgggLggLgggG",
        "GgggEggEgggG",
        "GggggggggggG",
        "GgdddddddddG",
        ".GxxxxxxxxG.",
        "..xxxxxxxx..",
        "............",
      ]
    },
    // 25. 镰刀死神（高伤近战）12×14
    reaper: {
      w: 12, h: 14, frames: 2, fps: 5,
      palette: { "K": P.black, "k": P.steelShd, "V": P.voidDark, "v": P.voidLo, "R": P.red, "r": P.redDark, "E": P.black, "L": P.redHi, "x": P.voidDeep },
      data: [
        "...KKKKKK...",
        "..KkkkkkkK..",
        ".KkkVVVVkkK.",
        "KkkVvvvvVkkK",
        "KkkVvLLvVkkK",
        "KkkVvLLvVkkK",
        ".KkVvvvvVkK.",
        "..KkVRRVkK..",
        "...KkRRkK...",
        "K..KkRRkK..K",
        "KK.KkRRkK.KK",
        ".KKKkRRkKKK.",
        "...KxkkxK...",
        "...xx..xx...",
        "...KKKKKK...",
        "..KkkkkkkK..",
        ".KkkVVVVkkK.",
        "KkkVvvvvVkkK",
        "KkkVvLLvVkkK",
        "KkkVvLLvVkkK",
        ".KkVvvvvVkK.",
        "..KkVRRVkK..",
        ".KKkRRRkKK..",
        "K.KKkRRkKK.K",
        "KK.KkRRkK.KK",
        ".KKKkRRkKKK.",
        "...KxkkxK...",
        "...xx..xx...",
      ]
    },
    // 26. 脉冲机（周期范围伤害）12×12
    pulsar: {
      w: 12, h: 12, frames: 2, fps: 5,
      palette: { "S": P.steel, "s": P.steelLo, "d": P.steelDark, "B": P.ice, "b": P.iceLo, "L": P.iceHi, "E": P.black, "x": P.steelShd },
      data: [
        "....SSSS....",
        "...SssssS...",
        "..SsBBBBsS..",
        ".SsBbbbbBsS.",
        "SsBbLLLLbBsS",
        "SsBbLWWLbBsS",
        "SsBbLWELbBsS",
        "SsBbLLLLbBsS",
        ".SsBbbbbBsS.",
        "..SsddddsS..",
        "...SxxxxS...",
        "....xxxx....",
        "....SSSS....",
        "...SssssS...",
        "..SsBBBBsS..",
        ".SsBbbbbBsS.",
        "SsBbLLLLbBsS",
        "SsBbLWLLbBsS",
        "SsBbLWELbBsS",
        "SsBbLLLLbBsS",
        ".SsBbbbbBsS.",
        "..SsddddsS..",
        "...SxxxxS...",
        "....xxxx....",
      ]
    },
    // 27. 投手（抛物远程）10×12
    lobber: {
      w: 10, h: 12, frames: 2, fps: 5,
      palette: { "O": P.fireLo, "o": P.fireDark, "Y": P.fireHi, "E": P.black, "R": P.red, "x": P.steelShd, "S": P.steelLo },
      data: [
        "...OOOO...",
        "..OooooO..",
        ".OoYYYYoO.",
        "OoYEYYEYoO",
        "OoYYYYYYoO",
        ".OooooooO.",
        "..SSSSSS..",
        ".SssssssS.",
        "SssssssssS",
        "SsxxxxxxsS",
        ".SxxxxxxS.",
        "..xxxxxx..",
        "...OOOO...",
        "..OooooO..",
        ".OoYYYYoO.",
        "OoYEYYEYoO",
        "OoYYYYYYoO",
        ".OooooooO.",
        "..SSSSSS..",
        ".SssssssS.",
        "SssssssssS",
        "SsxxxxxxsS",
        ".SxxxxxxS.",
        "..xxxxxx..",
      ]
    },
    // 28. 幻影蜂群（瞬移 + 群体）8×8
    shade: {
      w: 8, h: 8, frames: 2, fps: 6,
      palette: { "V": P.void, "v": P.voidLo, "d": P.voidDark, "L": P.voidHi, "E": P.black, "x": P.voidDeep },
      data: [
        "..VVVV..",
        ".VvvvvV.",
        "VvLLLLvV",
        "VvLvvLvV",
        "VvLLLLvV",
        ".VvddvV.",
        "..VxxV..",
        "...xx...",
        "..VVVV..",
        ".VvvvvV.",
        "VvLLLLvV",
        "VvLvLvLV",
        "VvLLLLvV",
        ".VvddvV.",
        "..VxxV..",
        "..xxx...",
      ]
    },
    // 29. 铁线虫（蛇形快速）14×6
    wire: {
      w: 14, h: 6, frames: 2, fps: 8,
      palette: { "S": P.steelLo, "s": P.steelDark, "d": P.steelShd, "R": P.red, "E": P.black, "x": P.steelShd },
      data: [
        "SSSSSSSSSSSS..",
        "ssssssssssssS.",
        "sddRRRRRRddssS",
        "sddREERdddssS.",
        "ssssssssssssS.",
        "xxxxxxxxxxxx..",
        "..SSSSSSSSSSSS",
        ".Sssssssssssss",
        "SsddRRRRRRddss",
        ".SsddREERdddss",
        ".Sssssssssssss",
        "..xxxxxxxxxxxx",
      ]
    },
    // 30. 虚空使徒（强化瞬移者）12×14
    apostle: {
      w: 12, h: 14, frames: 2, fps: 4,
      palette: { "V": P.voidDark, "v": P.voidLo, "d": P.voidDeep, "L": P.voidHi, "W": P.white, "R": P.red, "E": P.black, "x": P.voidDeep },
      data: [
        "...VVVVVV...",
        "..VvvvvvvV..",
        ".VvvLLLLvvV.",
        "VvvLvWWLvLvv",
        "VvvLRWWRvLvv",
        "VvvLRERRvLvv",
        "VvvLvWWLvLvv",
        "VvvvLLLLvvvV",
        ".VvvddddvvV.",
        "..VvddddvV..",
        "...VvxxvV...",
        "....VxxV....",
        "....VxxV....",
        ".....xx.....",
        "...VVVVVV...",
        "..VvvvvvvV..",
        ".VvvLLLLvvV.",
        "VvvLvWWLvLvv",
        "VvvLRWWRvLvv",
        "VvvLRWWRvLvv",
        "VvvLvWWLvLvv",
        "VvvvLLLLvvvV",
        ".VvvddddvvV.",
        "..VvddddvV..",
        "...VvxxvV...",
        "....VxxV....",
        "....VxxV....",
        ".....xx.....",
      ]
    },
  };

  // 标准化精灵：统一 data 为 [frame0:[rows...], frame1:[rows...], ...]。
  // 手写精灵的 data 是扁平的 frames*h 个字符串；程序化 Boss 已是帧数组。
  // 同时补齐/截断每行至 w 字符，保证渲染时不越界。
  (function normalizeSprites() {
    Object.keys(SPRITES).forEach(function (name) {
      var sp = SPRITES[name];
      if (!Array.isArray(sp.data) || sp.data.length === 0) return;
      var isChunked = Array.isArray(sp.data[0]);
      var frames = sp.frames || 1;
      var h = sp.h, w = sp.w;
      var chunked;
      if (isChunked) {
        chunked = sp.data;
      } else {
        chunked = [];
        for (var f = 0; f < frames; f++) chunked.push(sp.data.slice(f * h, (f + 1) * h));
      }
      // 每帧补齐行数与列宽
      chunked = chunked.map(function (rows) {
        var out = [];
        for (var y = 0; y < h; y++) {
          var r = rows[y] || "";
          if (r.length < w) r = r + new Array(w - r.length + 1).join(".");
          else if (r.length > w) r = r.slice(0, w);
          out.push(r);
        }
        return out;
      });
      sp.data = chunked;
    });
  })();

  // stats: 基础属性。perk 为运行时钩子。
  // ------------------------------------------------------------------
  var CHARACTERS = [
    {
      id: "zero", name: "特工 Zero", sprite: "zero",
      desc: "协议核心特工，暴击率高，初始手枪精准。",
      unlock: "默认", startWeapon: "pistol",
      stats: { hp: 100, atk: 1.0, atkspd: 1.0, crit: 0.20, critdmg: 1.8, range: 1.0, proj: 0, cdr: 1.0, luck: 1.0, lifesteal: 0, shield: 0, speed: 1.0 },
      perk: { type: "crit_bonus", val: 0.05, every: 5, desc: "每 5 级暴击 +5%" }
    },
    {
      id: "medic", name: "医疗 AI", sprite: "medic",
      desc: "战场医疗单元，生命更高且持续回血。",
      unlock: "默认", startWeapon: "flamer",
      stats: { hp: 140, atk: 0.9, atkspd: 1.0, crit: 0.05, critdmg: 1.5, range: 1.0, proj: 0, cdr: 1.0, luck: 1.0, lifesteal: 0, shield: 1, speed: 1.0 },
      perk: { type: "regen", val: 1.5, desc: "每秒回复 1.5 HP" }
    },
    {
      id: "heavy", name: "重装士兵", sprite: "heavy",
      desc: "厚重装甲，生命翻倍但移速降低。",
      unlock: "单局存活 5 分钟", startWeapon: "railgun",
      stats: { hp: 200, atk: 1.1, atkspd: 0.85, crit: 0.05, critdmg: 1.6, range: 1.0, proj: 0, cdr: 1.0, luck: 0.8, lifesteal: 0, shield: 2, speed: 0.8 },
      perk: { type: "hp_mult", val: 2.0, desc: "生命上限 ×2（已计入基础值）" }
    },
    {
      id: "gambler", name: "赌徒", sprite: "gambler",
      desc: "幸运极高，每次升级属性随机波动。",
      unlock: "累计击杀 1000 名敌人", startWeapon: "needle",
      stats: { hp: 90, atk: 1.0, atkspd: 1.0, crit: 0.10, critdmg: 1.6, range: 1.0, proj: 0, cdr: 1.0, luck: 2.0, lifesteal: 0, shield: 0, speed: 1.1 },
      perk: { type: "random_per_level", val: 0.15, desc: "每次升级随机 ±15% 某项属性" }
    },
    {
      id: "mutant", name: "失控实验体", sprite: "mutant",
      desc: "开局仅 1 HP，每次升级永久提升攻击。",
      unlock: "用其它角色通关一次", startWeapon: "blade",
      stats: { hp: 1, atk: 1.2, atkspd: 1.2, crit: 0.15, critdmg: 2.0, range: 1.0, proj: 0, cdr: 1.0, luck: 1.0, lifesteal: 0.2, shield: 0, speed: 1.15 },
      perk: { type: "atk_per_level", val: 0.06, desc: "每升级永久 +6% 攻击（独立乘区）" }
    },
  ];

  // ------------------------------------------------------------------
  // 被动道具（用于升级池 + 进化合成）
  // 每项给一组属性加成。evolve 标记参与进化合成。
  // ------------------------------------------------------------------
  var PASSIVES = [
    { id: "energy_core", name: "能量核心", desc: "攻击 +15%，冷却 -8%", stat: { atk: 0.15, cdr: -0.08 }, evolve: "laser_drone", icon: "🔋" },
    { id: "magnet", name: "磁场", desc: "范围 +20%，拾取范围扩大", stat: { range: 0.20 }, evolve: "flywheel", icon: "🧲" },
    { id: "fuel", name: "燃料", desc: "攻击 +10%，攻速 +12%", stat: { atk: 0.10, atkspd: 0.12 }, evolve: "flamer", icon: "⛽" },
    { id: "guidance", name: "制导芯片", desc: "投射物 +1，攻速 +8%", stat: { proj: 1, atkspd: 0.08 }, evolve: "missile", icon: "📡" },
    { id: "cooler", name: "制冷器", desc: "冷却 -15%，攻速 +6%", stat: { cdr: -0.15, atkspd: 0.06 }, evolve: "ice_lance", icon: "❄️" },
    { id: "scope", name: "瞄准镜", desc: "暴击 +8%，暴伤 +25%", stat: { crit: 0.08, critdmg: 0.25 }, icon: "🔭" },
    { id: "core_overclock", name: "过载线圈", desc: "攻速 +20%", stat: { atkspd: 0.20 }, icon: "⚡" },
    { id: "vital_module", name: "生命模块", desc: "HP +30，吸血 +3%", stat: { hp: 30, lifesteal: 0.03 }, icon: "❤️" },
    { id: "shield_gen", name: "护盾发生器", desc: "护盾 +2，移速 +5%", stat: { shield: 2, speed: 0.05 }, icon: "🛡️" },
    { id: "lucky_chip", name: "幸运芯片", desc: "幸运 +50%", stat: { luck: 0.50 }, icon: "🍀" },
    { id: "range_ext", name: "扩展阵列", desc: "范围 +25%，投射物 +1", stat: { range: 0.25, proj: 1 }, icon: "📡" },
    { id: "crit_amp", name: "暴击放大器", desc: "暴伤 +60%", stat: { critdmg: 0.60 }, icon: "💥" },
  ];

  // ------------------------------------------------------------------
  // 武器（10 把 + 进化形态）。kind 决定运行时行为。
  // base: 每级叠加。levels: 升级文案数组（5 级）。
  // ------------------------------------------------------------------
  var WEAPONS = [
    {
      id: "pistol", name: "协议手枪", kind: "projectile", icon: "🔫",
      desc: "向最近敌人发射能量弹。",
      base: { dmg: 12, rate: 1.6, proj: 1, speed: 2.4, range: 1.0 },
      levels: ["双发齐射（投射+1）", "攻速 +30%", "穿透 +1", "三连射（投射+1，攻速+20%）", "终极：协议审判（弹道巨大化 + 爆裂）"],
      evolve: null
    },
    {
      id: "laser_drone", name: "激光无人机", kind: "homing", icon: "🛸",
      desc: "自动锁定最近敌人发射激光。",
      base: { dmg: 8, rate: 1.2, count: 1, range: 1.0 },
      levels: ["双无人机（数量+1）", "四旋翼（数量+2，攻速+15%）", "轨道激光（持续光束）", "伤害 +40%", "终极：天基炮阵（全屏随机轰炸）"],
      evolve: { passive: "energy_core", result: "star_ray", resultName: "恒星射线" }
    },
    {
      id: "flywheel", name: "电磁飞轮", kind: "orbit", icon: "🌀",
      desc: "围绕玩家旋转的电磁飞轮。",
      base: { dmg: 14, count: 1, radius: 36, rotSpeed: 2.2, range: 1.0 },
      levels: ["双飞轮（数量+1）", "四飞轮（数量+2）", "高速旋转（转速+40%）", "可弹射（命中后跳向下一敌人）", "终极：裂变飞轮（数量×2）"],
      evolve: { passive: "magnet", result: "black_saw", resultName: "黑洞锯盘" }
    },
    {
      id: "needle", name: "纳米针雨", kind: "projectile", icon: "💉",
      desc: "从天而降的随机针刺。",
      base: { dmg: 10, rate: 1.4, proj: 1, range: 1.4 },
      levels: ["针数 +1", "攻速 +25%", "针数 +2", "爆炸针（落点小范围）", "终极：针雨风暴（全屏覆盖）"],
      evolve: null
    },
    {
      id: "missile", name: "追踪导弹", kind: "homing", icon: "🚀",
      desc: "发射追踪导弹，命中爆炸。",
      base: { dmg: 18, rate: 0.8, proj: 1, speed: 1.8, range: 1.0, aoe: 14 },
      levels: ["双发（投射+1）", "爆炸范围 +40%", "攻速 +25%", "四连发（投射+2）", "终极：集束炸弹（每发分裂）"],
      evolve: { passive: "guidance", result: "carpet_bomb", resultName: "饱和轰炸" }
    },
    {
      id: "ice_lance", name: "冰枪", kind: "projectile", icon: "🔱",
      desc: "发射冰枪，减速命中敌人。",
      base: { dmg: 14, rate: 1.0, proj: 1, speed: 2.2, range: 1.0, slow: 0.5 },
      levels: ["双发", "攻速 +20%", "穿透 +1", "冰冻时长 +50%", "终极：绝对零度（命中冰封）"],
      evolve: { passive: "cooler", result: "permafrost", resultName: "永冻领域" }
    },
    {
      id: "flamer", name: "火焰喷射", kind: "aura", icon: "🔥",
      desc: "周围持续灼烧敌人。",
      base: { dmg: 4, rate: 4.0, radius: 40, range: 1.0, burn: 2 },
      levels: ["范围 +25%", "伤害 +30%", "灼烧叠加", "攻速 +30%", "终极：地狱火（范围 +50%，持续燃烧）"],
      evolve: { passive: "fuel", result: "fusion_jet", resultName: "核聚变喷流" }
    },
    {
      id: "railgun", name: "轨道炮", kind: "beam", icon: "✨",
      desc: "周期性发射贯穿全屏的高速光束。",
      base: { dmg: 30, rate: 0.45, range: 1.0 },
      levels: ["伤害 +30%", "攻速 +20%", "双轨（再发一束）", "光束变粗（范围+）", "终极：歼星炮（伤害翻倍 + 范围巨大）"],
      evolve: null
    },
    {
      id: "forcefield", name: "力场", kind: "aura", icon: "🔵",
      desc: "排斥力场，推开并伤害近身敌人。",
      base: { dmg: 6, rate: 2.0, radius: 30, range: 1.0, knockback: 1.5 },
      levels: ["范围 +25%", "伤害 +35%", "击退 +50%", "攻速 +30%", "终极：奇点（吸引并绞碎）"],
      evolve: null
    },
    {
      id: "blade", name: "回旋刃", kind: "orbit", icon: "🗡️",
      desc: "高速回旋的斩击刃，可穿透。",
      base: { dmg: 16, count: 1, radius: 28, rotSpeed: 3.0, range: 1.0 },
      levels: ["双刃", "转速 +40%", "伤害 +30%", "四刃", "终极：千刃风暴（数量×3）"],
      evolve: null
    },

    // ---- 进化形态（不直接出现在初始选择，但可由进化获得）----
    {
      id: "star_ray", name: "恒星射线", kind: "beam", icon: "☀️",
      desc: "进化：持续灼烧的恒星光束，自动扫射全场。",
      base: { dmg: 6, rate: 10, range: 1.5 }, levels: ["伤害 +25%", "攻速 +20%", "范围 +30%", "灼烧叠加", "终极：超新星"], evolve: null, _evolved: true
    },
    {
      id: "black_saw", name: "黑洞锯盘", kind: "orbit", icon: "🕳️",
      desc: "进化：吸引敌人的巨大锯盘。",
      base: { dmg: 22, count: 1, radius: 52, rotSpeed: 2.0, range: 1.3, pull: 1.0 }, levels: ["数量+1", "伤害+25%", "吸力+50%", "转速+30%", "终极：事件视界"], evolve: null, _evolved: true
    },
    {
      id: "fusion_jet", name: "核聚变喷流", kind: "aura", icon: "☄️",
      desc: "进化：灼热等离子喷流，持续大范围伤害。",
      base: { dmg: 8, rate: 6, radius: 62, range: 1.4, burn: 5 }, levels: ["范围+20%", "伤害+25%", "攻速+25%", "灼烧+50%", "终极：日冕"], evolve: null, _evolved: true
    },
    {
      id: "carpet_bomb", name: "饱和轰炸", kind: "homing", icon: "🛩️",
      desc: "进化：天降海量炸弹覆盖全场。",
      base: { dmg: 22, rate: 1.2, proj: 4, aoe: 22, range: 1.3 }, levels: ["投射+2", "伤害+25%", "攻速+20%", "范围+30%", "终极：末日机群"], evolve: null, _evolved: true
    },
    {
      id: "permafrost", name: "永冻领域", kind: "aura", icon: "🌨️",
      desc: "进化：冻结周围一切，周期碎裂伤害。",
      base: { dmg: 12, rate: 1.5, radius: 60, range: 1.3, slow: 0.8, freeze: 1.0 }, levels: ["范围+20%", "伤害+25%", "冰封时长+50%", "碎裂+30%", "终极：冰河世纪"], evolve: null, _evolved: true
    },
  ];

  // 进化表（武器 + 被动 → 结果），便于查询
  var EVOLUTIONS = [
    { weapon: "laser_drone", passive: "energy_core", result: "star_ray" },
    { weapon: "flywheel", passive: "magnet", result: "black_saw" },
    { weapon: "flamer", passive: "fuel", result: "fusion_jet" },
    { weapon: "missile", passive: "guidance", result: "carpet_bomb" },
    { weapon: "ice_lance", passive: "cooler", result: "permafrost" },
    // 预留扩展（数据结构就绪）
    { weapon: "railgun", passive: "core_overclock", result: "star_ray" },
    { weapon: "blade", passive: "scope", result: "black_saw" },
    { weapon: "forcefield", passive: "magnet", result: "permafrost" },
  ];

  // ------------------------------------------------------------------
  // 遗物（10 个）。effect 在运行时由 relic 引擎解释。
  // ------------------------------------------------------------------
  var RELICS = [
    { id: "lucky_coin", name: "幸运硬币", icon: "🪙", desc: "金币掉落 +100%，但怪物数量 +30%。", rarity: "common" },
    { id: "overload_core", name: "失控核心", icon: "🔴", desc: "攻击 ×2，但 HP 上限减半。", rarity: "rare" },
    { id: "sacrifice_pact", name: "献祭契约", icon: "🩸", desc: "每分钟失去 10% HP，永久增加 8% 攻击。", rarity: "rare" },
    { id: "time_rift", name: "时间裂缝", icon: "⏳", desc: "所有技能 CD 减少 40%，敌人移速 -15%。", rarity: "epic" },
    { id: "glass_cannon", name: "玻璃大炮", icon: "💎", desc: "伤害 ×1.8，但被击即死（护盾可挡）。", rarity: "epic" },
    { id: "vampire_fang", name: "吸血鬼之牙", icon: "🦷", desc: "吸血 +12%，但无法拾取治疗道具。", rarity: "rare" },
    { id: "resonance_core", name: "共振核心", icon: "🔊", desc: "每装备一个逻辑模块，攻击 +10%。", rarity: "rare" },
    { id: "ghost_gait", name: "幽灵步态", icon: "👻", desc: "移速 +40%，静止 1 秒后短暂无敌。", rarity: "rare" },
    { id: "paradox_ring", name: "悖论之环", icon: "♾️", desc: "暴击伤害 +120%，但暴击率 -10%。", rarity: "epic" },
    { id: "abyss_heart", name: "深渊之心", icon: "🫀", desc: "每损失 1% 生命，伤害 +1%。", rarity: "epic" },
  ];

  // ------------------------------------------------------------------
  // 逻辑模块（8 个）—— 特色系统
  // cond.type: hp_below / kills_since / idle_for / move_for / on_level / on_damaged
  // action.type: shield / shockwave / spawn_turret / next_skill_x2 / heal / damage_burst / freeze_aura / gold_rain
  // ------------------------------------------------------------------
  var LOGIC_MODULES = [
    {
      id: "low_hp_shield", name: "应急协议", icon: "🚨",
      desc: "生命低于 30% 时激活护盾 + 短暂攻速提升。",
      cond: { type: "hp_below", val: 0.30 },
      action: { type: "shield", amount: 2, buff: { atkspd: 1.5, dur: 3 } },
      cd: 30
    },
    {
      id: "kill_chain", name: "连锁歼灭", icon: "💥",
      desc: "每击杀 100 名敌人，释放一次全屏冲击波。",
      cond: { type: "kills_since", val: 100 },
      action: { type: "shockwave", dmgMul: 3.0, radius: 200 },
      cd: 0
    },
    {
      id: "sentry", name: "哨卫部署", icon: "🏰",
      desc: "静止超过 2 秒，自动部署一座临时炮塔。",
      cond: { type: "idle_for", val: 2.0 },
      action: { type: "spawn_turret", dur: 6, dmg: 8 },
      cd: 8
    },
    {
      id: "momentum", name: "动量蓄能", icon: "🏃",
      desc: "连续移动 5 秒，下一次技能伤害翻倍。",
      cond: { type: "move_for", val: 5.0 },
      action: { type: "next_skill_x2" },
      cd: 6
    },
    {
      id: "level_heal", name: "迭代修复", icon: "➕",
      desc: "每次升级恢复 25% 最大生命。",
      cond: { type: "on_level" },
      action: { type: "heal", pct: 0.25 },
      cd: 0
    },
    {
      id: "pain_burst", name: "痛觉过载", icon: "⚡",
      desc: "受击后 1 秒内攻速翻倍并反弹伤害。",
      cond: { type: "on_damaged" },
      action: { type: "damage_burst", buff: { atkspd: 2.0, dur: 1 }, reflectMul: 1.5 },
      cd: 4
    },
    {
      id: "freeze_pulse", name: "零度脉冲", icon: "❄️",
      desc: "每 8 秒释放冰冻脉冲，冻结周围敌人 2 秒。",
      cond: { type: "interval", val: 8 },
      action: { type: "freeze_aura", radius: 90, dur: 2 },
      cd: 0
    },
    {
      id: "gold_rush", name: "贪婪算法", icon: "💰",
      desc: "每击杀 50 名敌人，天降金币雨。",
      cond: { type: "kills_since", val: 50 },
      action: { type: "gold_rain", count: 8 },
      cd: 0
    },
  ];

  // ------------------------------------------------------------------
  // 敌人种类（8 种）
  // ai: chase / ranged / suicide / teleport / shield / heal / split / turret_eye
  // ------------------------------------------------------------------
  var ENEMIES = {
    infected:  { name: "感染者", sprite: "infected", hp: 18, dmg: 8, speed: 0.55, xp: 1, gold: 0.3, size: 12, ai: "chase", color: P.acid },
    drone_enemy: { name: "飞行无人机", sprite: "drone_enemy", hp: 14, dmg: 6, speed: 0.7, xp: 2, gold: 0.5, size: 13, ai: "ranged", shotRate: 2.0, shotDmg: 6, color: P.steelLo },
    bomber:    { name: "爆炸虫", sprite: "bomber", hp: 10, dmg: 25, speed: 0.85, xp: 2, gold: 0.4, size: 10, ai: "suicide", blastRadius: 22, color: P.red },
    wraith:    { name: "幽影", sprite: "wraith", hp: 22, dmg: 10, speed: 0.6, xp: 3, gold: 0.6, size: 12, ai: "teleport", teleportCd: 3.0, color: P.void },
    shielder:  { name: "护盾兵", sprite: "shielder", hp: 40, dmg: 10, speed: 0.45, xp: 4, gold: 0.8, size: 12, ai: "shield", shieldHp: 30, color: P.iceLo },
    healer:    { name: "医疗机", sprite: "healer", hp: 30, dmg: 0, speed: 0.5, xp: 5, gold: 1.0, size: 12, ai: "heal", healRate: 1.0, healRange: 50, color: P.bone },
    splitter:  { name: "复制体", sprite: "splitter", hp: 26, dmg: 8, speed: 0.5, xp: 3, gold: 0.5, size: 10, ai: "split", splitCount: 2, splitHpPct: 0.5, color: P.voidLo },
    eye:       { name: "深渊之眼", sprite: "eye", hp: 36, dmg: 0, speed: 0.3, xp: 5, gold: 1.2, size: 14, ai: "turret_eye", laserRate: 2.5, laserDmg: 12, color: P.redDark },
    // ---- 22 种新敌人 ----
    crawler:   { name: "腐化爬虫", sprite: "crawler", hp: 14, dmg: 6, speed: 0.9, xp: 1, gold: 0.3, size: 10, ai: "chase", color: P.acidDark },
    spiker:    { name: "钉刺兽", sprite: "spiker", hp: 30, dmg: 14, speed: 0.7, xp: 3, gold: 0.6, size: 12, ai: "chase", color: P.steelLo },
    spitter:   { name: "毒囊虫", sprite: "spitter", hp: 20, dmg: 4, speed: 0.5, xp: 3, gold: 0.6, size: 10, ai: "ranged", shotRate: 1.6, shotDmg: 7, color: P.acid },
    tank:      { name: "铁甲坦克", sprite: "tank", hp: 90, dmg: 16, speed: 0.32, xp: 7, gold: 1.5, size: 14, ai: "chase", color: P.steel },
    cocoon:    { name: "自爆蛹", sprite: "cocoon", hp: 16, dmg: 38, speed: 0.7, xp: 3, gold: 0.5, size: 12, ai: "suicide", blastRadius: 30, color: P.redDark },
    phantom:   { name: "幻影刺客", sprite: "phantom", hp: 34, dmg: 18, speed: 0.65, xp: 5, gold: 1.0, size: 12, ai: "teleport", teleportCd: 2.2, color: P.voidDark },
    bulwark:   { name: "能量盾卫", sprite: "bulwark", hp: 60, dmg: 12, speed: 0.4, xp: 6, gold: 1.2, size: 12, ai: "shield", shieldHp: 50, color: P.iceLo },
    swarm_healer: { name: "修复蜂群", sprite: "swarm_healer", hp: 24, dmg: 0, speed: 0.6, xp: 6, gold: 1.2, size: 10, ai: "heal", healRate: 1.8, healRange: 60, color: P.bone },
    mitosis:   { name: "二分裂体", sprite: "mitosis", hp: 22, dmg: 8, speed: 0.55, xp: 4, gold: 0.7, size: 10, ai: "split", splitCount: 3, splitHpPct: 0.45, color: P.voidLo },
    mega_eye:  { name: "虚空巨眼", sprite: "mega_eye", hp: 52, dmg: 0, speed: 0.28, xp: 7, gold: 1.6, size: 14, ai: "turret_eye", laserRate: 1.8, laserDmg: 16, color: P.void },
    brute:     { name: "感染巨兽", sprite: "brute", hp: 75, dmg: 20, speed: 0.45, xp: 8, gold: 1.8, size: 14, ai: "chase", color: P.acid },
    wasp:      { name: "弹幕蜂", sprite: "wasp", hp: 18, dmg: 5, speed: 0.8, xp: 3, gold: 0.7, size: 10, ai: "ranged", shotRate: 1.2, shotDmg: 5, color: P.fireHi },
    egg:       { name: "寄生卵", sprite: "egg", hp: 28, dmg: 0, speed: 0.15, xp: 4, gold: 0.8, size: 10, ai: "split", splitCount: 3, splitHpPct: 0.4, color: P.voidLo },
    magnet:    { name: "磁力机", sprite: "magnet", hp: 40, dmg: 10, speed: 0.4, xp: 5, gold: 1.0, size: 12, ai: "chase", pull: 1.0, color: P.ice },
    prism:     { name: "虚空棱镜", sprite: "prism", hp: 44, dmg: 0, speed: 0.35, xp: 6, gold: 1.4, size: 12, ai: "turret_eye", laserRate: 2.0, laserDmg: 14, color: P.void },
    slime:     { name: "腐液史莱姆", sprite: "slime", hp: 50, dmg: 12, speed: 0.35, xp: 4, gold: 0.9, size: 12, ai: "chase", slowOnHit: 0.5, color: P.acidLo },
    reaper:    { name: "镰刀死神", sprite: "reaper", hp: 46, dmg: 26, speed: 0.6, xp: 7, gold: 1.5, size: 12, ai: "chase", color: P.voidDark },
    pulsar:    { name: "脉冲机", sprite: "pulsar", hp: 38, dmg: 0, speed: 0.4, xp: 5, gold: 1.1, size: 12, ai: "turret_eye", laserRate: 2.2, laserDmg: 10, pulseRadius: 70, color: P.iceLo },
    lobber:    { name: "投手", sprite: "lobber", hp: 26, dmg: 4, speed: 0.45, xp: 4, gold: 0.9, size: 10, ai: "ranged", shotRate: 1.4, shotDmg: 9, lobbed: true, color: P.fireLo },
    shade:     { name: "幻影蜂群", sprite: "shade", hp: 16, dmg: 8, speed: 0.75, xp: 2, gold: 0.4, size: 8, ai: "teleport", teleportCd: 2.5, color: P.void },
    wire:      { name: "铁线虫", sprite: "wire", hp: 24, dmg: 10, speed: 1.0, xp: 3, gold: 0.6, size: 14, ai: "chase", color: P.steelLo },
    apostle:   { name: "虚空使徒", sprite: "apostle", hp: 58, dmg: 22, speed: 0.55, xp: 8, gold: 1.8, size: 12, ai: "teleport", teleportCd: 1.8, color: P.voidDark },
  };
  // 给每个敌人补 id（用对象键），便于引擎与其它内容类型一致引用
  Object.keys(ENEMIES).forEach(function (k) { ENEMIES[k].id = k; });

  // 精英词缀
  var ELITE_AFFIXES = [
    { id: "swift", name: "加速", mod: { speed: 1.6 }, color: P.ice },
    { id: "split", name: "分裂", mod: { splitOnDeath: true, splitCount: 2 }, color: P.void },
    { id: "thorns", name: "反伤", mod: { thorns: 0.4 }, color: P.red },
    { id: "shielded", name: "护盾", mod: { shieldHpMul: 2.0 }, color: P.iceLo },
    { id: "berserk", name: "狂暴", mod: { dmg: 1.5, hp: 1.8 }, color: P.fire },
  ];

  // ------------------------------------------------------------------
  // Boss（4 个）
  // ------------------------------------------------------------------
  var BOSSES = [
    {
      id: "spider", name: "钢铁巨蛛", sprite: "spider_boss", time: 5 * 60,
      hp: 1200, dmg: 18, speed: 0.6, size: 32, xp: 80, gold: 30,
      desc: "召唤小蜘蛛包围玩家。",
      ai: "spider", summonRate: 5, summonCount: 4, summonType: "infected",
    },
    {
      id: "pope", name: "机械教皇", sprite: "pope_boss", time: 10 * 60,
      hp: 2600, dmg: 24, speed: 0.35, size: 32, xp: 150, gold: 60,
      desc: "全屏激光扫射 + 召唤信徒。",
      ai: "pope", laserRate: 4, summonRate: 8, summonCount: 3, summonType: "healer",
    },
    {
      id: "train", name: "深渊列车", sprite: "train_boss", time: 15 * 60,
      hp: 4000, dmg: 30, speed: 2.4, size: 48, xp: 220, gold: 90,
      desc: "横穿地图，沿途抛撒敌人。",
      ai: "train", dropRate: 1.2, dropType: "infected",
    },
    {
      id: "protocol", name: "██协议", sprite: "protocol_boss", time: 20 * 60,
      hp: 8000, dmg: 35, speed: 0.5, size: 32, xp: 400, gold: 200,
      desc: "根据玩家 Build 动态生成技能的隐藏 Boss。",
      ai: "protocol", adaptive: true,
    },
  ];

  // ------------------------------------------------------------------
  // 地图（3 张实装 + 2 张预留）
  // ------------------------------------------------------------------
  var MAPS = [
    {
      id: "ruins", name: "废弃都市", desc: "四处掉落补给箱，拾取获得金币与治疗。",
      unlock: "默认", mechanic: "crates", bg: "ruins",
      spawnMul: 1.0, eliteChance: 0.04,
    },
    {
      id: "lava", name: "熔岩矿井", desc: "持续掉血，需移动到冷却区回血。",
      unlock: "单局存活 8 分钟", mechanic: "lava", bg: "lava",
      spawnMul: 1.1, eliteChance: 0.06, envDps: 1.0,
    },
    {
      id: "data_sea", name: "数据海", desc: "敌人刷新极快，但经验更高。",
      unlock: "累计 5000 杀", mechanic: "data", bg: "data_sea",
      spawnMul: 1.4, eliteChance: 0.05, xpMul: 1.3,
    },
    { id: "moon", name: "月球基地", desc: "低重力，移动惯性增强（敬请期待）。", unlock: "敬请期待", mechanic: "moon", bg: "moon", soon: true },
    { id: "core", name: "深渊核心", desc: "最终地图，背景不断崩坏（敬请期待）。", unlock: "敬请期待", mechanic: "core", bg: "core", soon: true },
  ];

  // ------------------------------------------------------------------
  // 难度（4 档）
  // ------------------------------------------------------------------
  var DIFFICULTIES = [
    { id: "normal", name: "普通", desc: "适合新玩家。", hpMul: 1.0, dmgMul: 1.0, spawnMul: 1.0, eliteChance: 1.0, affix: false, fragMul: 1.0 },
    { id: "hard", name: "困难", desc: "敌人更密集，精英更早。", hpMul: 1.3, dmgMul: 1.2, spawnMul: 1.3, eliteChance: 1.5, affix: false, fragMul: 1.6 },
    { id: "nightmare", name: "噩梦", desc: "敌人获得词缀（加速/分裂/反伤）。", hpMul: 1.7, dmgMul: 1.5, spawnMul: 1.5, eliteChance: 2.0, affix: true, fragMul: 2.4 },
    { id: "endless", name: "无限模式", desc: "20 分钟后敌人无限增强。", hpMul: 1.5, dmgMul: 1.3, spawnMul: 1.4, eliteChance: 1.8, affix: true, fragMul: 3.0, endless: true },
  ];

  // ------------------------------------------------------------------
  // 成就（12 个）
  // ------------------------------------------------------------------
  var ACHIEVEMENTS = [
    { id: "first_blood", name: "初次接触", desc: "完成第一局游戏。", icon: "🩸", reward: 20 },
    { id: "flawless", name: "毫发无伤", desc: "0 受伤通关一局（至击败首个 Boss）。", icon: "🛡️", reward: 50 },
    { id: "evo_10min", name: "极速进化", desc: "10 分钟内完成一次武器终极进化。", icon: "🧬", reward: 60 },
    { id: "killer_100k", name: "屠戮者", desc: "单局消灭 100,000 名敌人。", icon: "💀", reward: 100 },
    { id: "no_heal_boss", name: "硬核猎手", desc: "不拾取任何治疗道具完成 Boss 战。", icon: "⚔️", reward: 60 },
    { id: "one_weapon", name: "专一", desc: "使用同一武器完成全程通关。", icon: "🎯", reward: 80 },
    { id: "survive_15", name: "深渊行者", desc: "单局存活 15 分钟。", icon: "⏱️", reward: 40 },
    { id: "beat_protocol", name: "协议终焉", desc: "击败隐藏 Boss ██协议。", icon: "👁️", reward: 200 },
    { id: "all_chars", name: "全角色", desc: "解锁全部角色。", icon: "👥", reward: 100 },
    { id: "rich", name: "财迷", desc: "单局累计获得 5000 金币。", icon: "💰", reward: 40 },
    { id: "logic_master", name: "架构师", desc: "单局装备 6 个以上逻辑模块。", icon: "🔌", reward: 70 },
    { id: "max_level", name: "无尽成长", desc: "单局达到 30 级。", icon: "📈", reward: 50 },
  ];

  // ------------------------------------------------------------------
  // 局外成长（协议碎片消费）
  // ------------------------------------------------------------------
  var META_UPGRADES = [
    { id: "atk", name: "永久攻击", desc: "攻击 +5%/级", icon: "⚔️", max: 10, cost: base => 15 + base * 10, effect: lvl => ({ atkPct: lvl * 0.05 }) },
    { id: "atkspd", name: "永久攻速", desc: "攻速 +4%/级", icon: "⚡", max: 10, cost: base => 18 + base * 12, effect: lvl => ({ atkspdPct: lvl * 0.04 }) },
    { id: "range", name: "永久范围", desc: "武器攻击范围 +6%/级", icon: "🎯", max: 10, cost: base => 18 + base * 12, effect: lvl => ({ rangePct: lvl * 0.06 }) },
    { id: "crit", name: "永久暴击", desc: "暴击率 +3%/级", icon: "💥", max: 8, cost: base => 22 + base * 14, effect: lvl => ({ crit: lvl * 0.03 }) },
    { id: "critdmg", name: "永久暴伤", desc: "暴击伤害 +12%/级", icon: "🌟", max: 8, cost: base => 22 + base * 14, effect: lvl => ({ critdmg: lvl * 0.12 }) },
    { id: "speed", name: "永久移速", desc: "移动速度 +4%/级", icon: "👟", max: 8, cost: base => 20 + base * 13, effect: lvl => ({ speedPct: lvl * 0.04 }) },
    { id: "lifesteal", name: "永久吸血", desc: "吸血 +1.5%/级", icon: "🩸", max: 6, cost: base => 28 + base * 18, effect: lvl => ({ lifesteal: lvl * 0.015 }) },
    { id: "shield", name: "永久护盾", desc: "护盾 +1/级", icon: "🛡️", max: 5, cost: base => 30 + base * 20, effect: lvl => ({ shield: lvl }) },
    { id: "pickup", name: "经验吸收", desc: "经验/金币磁吸范围 +30%/级", icon: "🧲", max: 8, cost: base => 16 + base * 11, effect: lvl => ({ pickupPct: lvl * 0.30 }) },
    { id: "hp", name: "永久生命", desc: "HP +20/级", icon: "❤️", max: 10, cost: base => 15 + base * 10, effect: lvl => ({ hp: lvl * 20 }) },
    { id: "gold", name: "初始金币", desc: "开局 +50 金币/级", icon: "💰", max: 8, cost: base => 20 + base * 15, effect: lvl => ({ gold: lvl * 50 }) },
    { id: "reroll", name: "重抽数", desc: "每局重抽次数 +1/级", icon: "🔄", max: 5, cost: base => 30 + base * 20, effect: lvl => ({ reroll: lvl }) },
    { id: "choices", name: "升级选项", desc: "升级三选一 → 四选一（需 3 级）", icon: "📋", max: 1, cost: base => 120, effect: lvl => ({ choices: lvl }) },
    { id: "luck", name: "永久幸运", desc: "幸运 +10%/级", icon: "🍀", max: 8, cost: base => 25 + base * 15, effect: lvl => ({ luckPct: lvl * 0.10 }) },
    { id: "cdr", name: "永久冷却", desc: "冷却 -3%/级", icon: "⏱️", max: 6, cost: base => 30 + base * 20, effect: lvl => ({ cdr: -lvl * 0.03 }) },
    { id: "start_drones", name: "初始无人机", desc: "开局自带 1 架激光无人机（需 1 级）", icon: "🛸", max: 1, cost: base => 150, effect: lvl => ({ startWeapon: "laser_drone" }) },
  ];

  // ------------------------------------------------------------------
  // 全局调参常量
  // ------------------------------------------------------------------
  var CONFIG = {
    // 视口（相机所见）—— 比 v1 翻倍，提供更宽阔视野
    W: 960, H: 540,
    // 世界尺寸——大地图，玩家可在其中自由移动，相机锁定玩家居中
    WORLD_W: 4000, WORLD_H: 4000,
    FIXED_DT: 1000 / 60,
    PLAYER_R: 6,                    // 玩家碰撞半径
    PICKUP_R: 14,                   // 经验拾取范围（需走近才能捡）
    MAGNET_R: 36,                   // 磁吸范围（走近才吸过来，比拾取稍大）
    SPAWN_MARGIN: 60,               // 屏外生成边距（基于视口）
    MAX_ENEMIES: 320,
    MAX_PARTICLES: 500,
    XP_CURVE: lv => Math.floor(8 + lv * 5 + lv * lv * 1.2), // 升级所需经验
    WIN_TIME: 20 * 60,              // 20 分钟通关（击败最终 Boss 后 cleared）
  };

  host.__ABYSS_DATA__ = {
    PALETTE: P,
    SPRITES: SPRITES,
    CHARACTERS: CHARACTERS,
    PASSIVES: PASSIVES,
    WEAPONS: WEAPONS,
    EVOLUTIONS: EVOLUTIONS,
    RELICS: RELICS,
    LOGIC_MODULES: LOGIC_MODULES,
    ENEMIES: ENEMIES,
    ELITE_AFFIXES: ELITE_AFFIXES,
    BOSSES: BOSSES,
    MAPS: MAPS,
    DIFFICULTIES: DIFFICULTIES,
    ACHIEVEMENTS: ACHIEVEMENTS,
    META_UPGRADES: META_UPGRADES,
    CONFIG: CONFIG,
  };
})(typeof window !== "undefined" ? window : globalThis);
