/* ===== claudeOne :: bead-studio-core.js =====
 * Pure image-to-fuse-bead conversion, palette, project, layer and drawing helpers.
 * Browser global: window.BeadStudioCore
 * Node/CommonJS: module.exports
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BeadStudioCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var VERSION = "1.0.0";
  var MAX_SIDE = 200;
  var BASIC_COLOR_COUNT = 221;
  var BRANDS = ["MARD", "COCO", "漫漫", "盼盼", "咪小窝"];

  /* Shared RGB swatches with brand-code cross references. */
  var PALETTE_CSV = `
#FAF4C8,A01,E02,E2,65,77
#FFFFD5,A02,E01,B1,2,2
#FEFF8B,A03,E05,B2,28,28
#FBED56,A04,E07,B3,3,3
#F4D738,A05,D03,B4,74,79
#FEAC4C,A06,D05,B5,29,29
#FE8B4C,A07,D08,B6,4,4
#FFDA45,A08,E08,B10,88,98
#FF995B,A09,D06,B11,90,97
#F77C31,A10,D07,B12,89,96
#FFDD99,A11,D01,E11,100,109
#FE9F72,A12,K09,A18,99,110
#FFC365,A13,D04,B13,131,116
#FD543D,A14,C05,B14,138,135
#FFF365,A15,E04,B15,150,150
#FFFF9F,A16,E03,IC04,216,216
#FFE36E,A17,E06,IC9,213,213
#FEBE7D,A18,D02,IC14,223,208
#FD7C72,A19,K10,IC15,218,218
#FFD568,A20,E09,Q6,242,242
#FFE395,A21,E10,R07,276,261
#F4F57D,A22,E11,R06,270,255
#E6C9B7,A23,E12,R08,274,259
#F7F8A2,A24,E13,G3,288,273
#FFD67D,A25,E14,G4,289,274
#FFC830,A26,E15,G5,290,275
#E6EE31,B01,F05,C1,48,48
#63F347,B02,F08,C2,33,33
#9EF780,B03,F04,C7,26,26
#5DE035,B04,F09,C3,66,78
#35E352,B05,F10,C4,39,39
#65E2A6,B06,G04,C9,11,11
#3DAF80,B07,G05,C10,44,44
#1C9C4F,B08,F11,C5,10,10
#27523A,B09,F16,C6,79,84
#95D3C2,B10,G03,C11,96,100
#5D722A,B11,F14,C12,97,99
#166F41,B12,F12,C13,106,111
#CAEB7B,B13,F02,C14,128,119
#ADE946,B14,F06,C15,129,117
#2E5132,B15,F15,C16,130,122
#C5ED9C,B16,F03,C17,141,133
#9BB13A,B17,F13,C18,142,141
#E6EE49,B18,F07,C19,147,147
#24B88C,B19,G06,DH15,191,174
#C2F0CC,B20,G02,DH10,192,175
#156A6B,B21,G07,DH2,207,194
#0B3C43,B22,G08,DH7,206,193
#303A21,B23,F17,DH12,205,192
#EEFCA5,B24,F01,IC5,222,207
#4E846D,B25,F18,Q13,240,240
#8D7A35,B26,F19,Q7,248,248
#CCE1AF,B27,F20,R10,262,262
#9EE5B9,B28,F21,R11,269,254
#C5E254,B29,F22,R09,268,253
#E2FCB1,B30,F23,G6,285,270
#B0E792,B31,F24,G7,286,271
#9CAB5A,B32,F25,G12,287,272
#E8FFE7,C01,G01,C8,64,76
#A9F9FC,C02,H03,D1,30,30
#A0E2FB,C03,H04,D2,63,75
#41CCFF,C04,H05,D3,77,82
#01ACEB,C05,H07,D7,34,34
#50AAF0,C06,H08,D4,25,25
#3677D2,C07,H13,D8,9,9
#0F54C0,C08,H14,D9,52,71
#324BCA,C09,H16,N5,42,42
#3EBCE2,C10,H09,D25,121,130
#28DDDE,C11,H10,D28,122,113
#1C334D,C12,H23,D26,120,120
#CDE8FF,C13,H01,D30,140,142
#D5FDFF,C14,H02,D29,139,136
#22C4C6,C15,H11,D31,143,132
#1557A8,C16,H18,D32,149,149
#04D1F6,C17,H19,D36,163,156
#1D3344,C18,H24,DH6,196,196
#1887A2,C19,H12,DH9,202,202
#176DAF,C20,H17,DH14,197,197
#BEDDFF,C21,H06,IC3,212,212
#67B4BE,C22,H25,Q11,239,239
#C8E2FF,C23,H26,R13,263,263
#7CC4FF,C24,H27,R14,267,252
#A9E5E5,C25,H28,R12,271,256
#3CAED8,C26,H29,R15,265,250
#D3DFFA,C27,H30,G13,279,264
#BBCFED,C28,H31,G14,280,265
#34488E,C29,H32,G15,281,266
#AEB4F2,D01,J07,D5,46,46
#858EDD,D02,J08,D6,36,36
#2F54AF,D03,H15,D10,8,8
#182A84,D04,H20,D11,75,80
#B843C5,D05,J12,D13,32,32
#AC7BDE,D06,J11,D14,27,27
#8854B3,D07,J15,D12,7,7
#E2D3FF,D08,J03,D16,94,89
#D5B9F8,D09,J04,D17,93,90
#361851,D10,J19,D15,92,91
#B9BAE1,D11,J06,D19,105,104
#DE9AD4,D12,J10,D20,104,105
#B90095,D13,J14,D21,103,106
#8B279B,D14,J16,D22,102,107
#2F1F90,D15,H22,D18,101,108
#E3E1EE,D16,J01,D23,118,126
#C4D4F6,D17,J05,D24,119,128
#A45EC7,D18,J13,D27,124,125
#D8C3D7,D19,J09,D33,153,153
#9C32B2,D20,J17,D34,161,155
#9A009B,D21,J18,D35,162,158
#333A95,D22,H21,DH1,198,198
#EBDAFC,D23,J02,IC8,217,217
#7786E5,D24,J20,Q14,244,244
#494FC7,D25,J21,Q15,249,234
#DFC2F8,D26,J22,R01,273,258
#FDD3CC,E01,K03,E1,18,18
#FEC0DF,E02,K15,A7,38,38
#FFB7E7,E03,K17,A8,62,74
#E8649E,E04,K21,A9,6,6
#F551A2,E05,K19,A10,40,40
#F13D74,E06,K22,A11,20,20
#C63478,E07,K25,A12,41,41
#FFDBE9,E08,K12,A13,84,103
#E970CC,E09,K18,A14,98,95
#D33793,E10,K23,A16,83,94
#FCDDD2,E11,K02,A19,125,131
#F78FC3,E12,K16,A20,126,112
#B5006D,E13,K24,A21,127,124
#FFD1BA,E14,K05,E21,137,140
#F8C7C9,E15,K04,A23,135,139
#FFF3EB,E16,K01,IC2,221,206
#FFE2EA,E17,K11,IC7,220,205
#FFC7DB,E18,K13,IC13,210,210
#FEBAD5,E19,K14,IC12,215,215
#D8C7D1,E20,K26,Q1,241,241
#BD9DA1,E21,K27,Q2,253,238
#B785A1,E22,K28,Q4,252,237
#937A8D,E23,K29,Q3,250,235
#E1BCE8,E24,K30,G8,282,267
#FD957B,F01,K08,A1,35,35
#FC3D46,F02,C02,A2,31,31
#F74941,F03,C03,A3,53,72
#FC283C,F04,C06,A4,54,73
#E7002F,F05,C07,A5,5,5
#943630,F06,Z21,E9,16,16
#971937,F07,C10,A6,47,47
#BC0028,F08,C09,A17,81,92
#E2677A,F09,K20,A15,82,93
#8A4526,F10,Z20,E15,116,115
#5A2121,F11,Z23,E16,117,129
#FD4E6A,F12,C01,A22,136,134
#F35744,F13,C04,A24,148,148
#FFA9AD,F14,K07,A25,154,154
#D30022,F15,C08,DH8,204,191
#FEC2A6,F16,K06,IC10,211,211
#E69C79,F17,K31,Q9,245,245
#D37C46,F18,K32,Q10,246,246
#C1444A,F19,K33,Q05,243,243
#CD9391,F20,K34,R04,275,260
#F7B4C6,F21,K35,R03,266,251
#FDC0D0,F22,K36,R02,272,257
#F67E66,F23,K37,R05,264,249
#E698AA,F24,K38,G9,283,268
#E54B4F,F25,K39,G10,284,269
#FFE2CE,G01,Z02,E3,76,81
#FFC4AA,G02,Z05,E4,49,49
#F4C3A5,G03,Z06,E5,80,85
#E1B383,G04,Z08,E6,19,19
#EDB045,G05,Z10,B7,43,43
#E99C17,G06,Z11,B8,50,50
#9D5B3E,G07,Z18,E7,17,17
#753832,G08,Z22,E8,12,12
#E6B483,G09,Z09,E10,91,102
#D98C39,G10,Z15,B9,87,101
#E0C593,G11,Z07,E12,112,118
#FFC890,G12,Z13,E13,113,127
#B7714A,G13,Z14,E17,115,114
#8D614C,G14,Z17,E14,114,123
#FCF9E0,G15,Z03,E19,133,143
#F2D9BA,G16,Z04,E20,134,138
#78524B,G17,Z16,E22,144,137
#FFE4CC,G18,Z01,DH5,203,203
#E07935,G19,Z12,DH3,208,195
#A94023,G20,Z19,DH13,199,199
#B88558,G21,Z24,Q8,247,247
#FDFBFF,H01,A02,F1,15,15
#FEFFFF,H02,A01,F2,1,1
#B6B1BA,H03,B03,F3,13,13
#89858C,H04,B05,F4,78,83
#48464E,H05,B06,F5,45,45
#2F2B2F,H06,B07,F6,51,70
#000000,H07,B09,F7,14,14
#E7D6DB,H08,A09,F8,85,86
#EDEDED,H09,A08,F10,95,87
#EEE9EA,H10,A10,F9,86,88
#CECDD5,H11,B01,F11,123,121
#FFF5ED,H12,A04,E18,132,144
#F5ECD2,H13,A06,E23,145,146
#CFD7D3,H14,B02,F12,146,145
#98A6A8,H15,B04,DH4,201,201
#1D1414,H16,B08,DH11,200,200
#F1EDED,H17,A07,IC6,214,214
#FFFDF0,H18,A03,IC1,219,204
#F6EFE2,H19,A05,IC11,209,209
#949FA3,H20,B10,Q12,251,236
#FFFBE1,H21,A11,G1,291,276
#CACAD4,H22,A12,G2,277,277
#9A9D94,H23,B11,G11,278,278
#BCC6B8,M01,Y01,YX11,168,168
#8AA386,M02,Y02,YX12,172,172
#697D80,M03,Y03,YX2,166,166
#E3D2BC,M04,Y04,YX15,167,167
#D0CCAA,M05,Y05,YX6,174,159
#B0A782,M06,Y06,YX1,169,169
#B4A497,M07,Y07,YX13,171,171
#B38281,M08,Y08,YX14,177,162
#A58767,M09,Y09,YX10,170,170
#C5B2BC,M10,Y10,YX9,164,164
#9F7594,M11,Y11,YX4,176,161
#644749,M12,Y12,YX5,173,173
#D19066,M13,Y13,YX8,175,160
#C77362,M14,Y14,YX3,165,165
#757D78,M15,Y15,YX7,178,163
#FCF7F8,P01,M01,P1,71,62
#B0A9AC,P02,M02,P2,55,69
#AFDCAB,P03,M03,P4,73,66
#FEA49F,P04,M04,P5,72,64
#EE8C3E,P05,M05,P3,56,63
#5FD0A7,P06,M06,P8,157,65
#EB9270,P07,M07,P6,159,68
#F0D958,P08,M08,P7,158,67
#D9D9D9,P09,M09,P13,195,178
#D9C7EA,P10,M10,P18,187,187
#F3ECC9,P11,M11,P9,185,185
#E6EEF2,P12,M12,P12,190,190
#AACBEF,P13,M13,P17,193,176
#337680,P14,M14,P22,183,183
#668575,P15,M15,P23,184,184
#FEBF45,P16,M16,P14,182,182
#FEA324,P17,M17,P19,179,179
#FEB89F,P18,M18,P11,194,177
#FFFEEC,P19,M19,P10,186,186
#FEBECF,P20,M21,P15,188,180
#ECBEBF,P21,M20,P20,180,188
#E4A89F,P22,M22,P16,189,189
#A56268,P23,M23,P21,181,181
#F2A5E8,Q01,W3,W3,109,W3
#E9EC91,Q02,W4,W4,111,W4
#FFFF00,Q03,W1,W1,107,W1
#FFEBFA,Q04,W2,W2,110,W2
#76CEDE,Q05,W5,W5,108,W5
#D50D21,R01,L01,T1,67,52
#F92F83,R02,L02,N1,24,24
#FD8324,R03,L03,N2,22,22
#F8EC31,R04,L04,N3,21,21
#35C75B,R05,L05,N4,23,23
#238891,R06,L06,T4,69,55
#19779D,R07,L07,T5,37,37
#1A60C3,R08,L08,T3,68,54
#9A56B4,R09,L09,T2,70,56
#FFDB4C,R10,L10,L2,156,53
#FFEBFB,R11,L11,T6,151,151
#D8D5CE,R12,L12,T7,160,157
#55514C,R13,L13,-,152,152
#9FE4DF,R14,S1,S1,231,231
#77CEE9,R15,S2,S2,237,224
#3ECFCA,R16,S3,S3,238,225
#4A867A,R17,S4,S5,233,233
#7FCD9D,R18,S5,S4,235,222
#CDE55D,R19,S6,S11,227,227
#E8C7B4,R20,S7,S6,230,230
#AD6F3C,R21,S8,S13,234,221
#6C372F,R22,S9,S15,226,226
#FEB872,R23,S10,S12,224,219
#F3C1C0,R24,S11,S4,228,228
#C9675E,R25,S12,S14,225,220
#D293BE,R26,S13,S9,229,229
#EA8CB1,R27,S14,S8,232,232
#9C87D6,R28,S15,S10,236,223
#FFFFFF,T01,L14,L6,155,51
#FD6FB4,Y01,N01,Y1,59,59
#FEB481,Y02,N02,Y2,60,60
#D7FAA0,Y03,N03,Y3,57,57
#8BDBFA,Y04,N04,Y4,58,58
#E987EA,Y05,N05,Y5,61,61
#DAABB3,ZG1,GB1,ZG1,254,ZG1
#D6AA87,ZG2,GB2,ZG2,255,ZG2
#C1BD8D,ZG3,GB3,ZG3,256,ZG3
#96869F,ZG4,GB4,ZG4,257,ZG4
#8490A6,ZG5,GB5,ZG5,258,ZG5
#94BFE2,ZG6,GB6,ZG6,259,ZG6
#E2A9D2,ZG7,GB7,ZG7,260,ZG7
#AB91C0,ZG8,GB8,ZG8,261,ZG8
`;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function hexToRgb(hex) {
    var value = parseInt(String(hex).replace("#", ""), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }

  function rgbToHex(rgb) {
    return "#" + rgb.map(function (value) {
      return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
    }).join("").toUpperCase();
  }

  function parsePalette() {
    return PALETTE_CSV.trim().split(/\r?\n/).map(function (line, index) {
      var parts = line.split(",");
      var hex = parts[0].toUpperCase();
      var rgb = hexToRgb(hex);
      return {
        index: index,
        id: parts[1],
        hex: hex,
        rgb: rgb,
        lab: rgbToLab(rgb),
        group: parts[1].indexOf("ZG") === 0 ? "ZG" : parts[1].charAt(0),
        codes: {
          MARD: parts[1],
          COCO: parts[2],
          "漫漫": parts[3],
          "盼盼": parts[4],
          "咪小窝": parts[5]
        }
      };
    });
  }

  function pivotRgb(value) {
    value /= 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  function rgbToLab(rgb) {
    var r = pivotRgb(rgb[0]);
    var g = pivotRgb(rgb[1]);
    var b = pivotRgb(rgb[2]);
    var x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
    var y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750);
    var z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;
    function pivot(value) {
      return value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
    }
    x = pivot(x);
    y = pivot(y);
    z = pivot(z);
    return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
  }

  function degreesToRadians(value) { return value * Math.PI / 180; }
  function radiansToDegrees(value) { return value * 180 / Math.PI; }

  function hueAngle(b, ap) {
    if (b === 0 && ap === 0) return 0;
    var hue = radiansToDegrees(Math.atan2(b, ap));
    return hue < 0 ? hue + 360 : hue;
  }

  function ciede2000(lab1, lab2) {
    var L1 = lab1.L, a1 = lab1.a, b1 = lab1.b;
    var L2 = lab2.L, a2 = lab2.a, b2 = lab2.b;
    var C1 = Math.sqrt(a1 * a1 + b1 * b1);
    var C2 = Math.sqrt(a2 * a2 + b2 * b2);
    var Cbar = (C1 + C2) / 2;
    var Cbar7 = Math.pow(Cbar, 7);
    var G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));
    var a1p = (1 + G) * a1;
    var a2p = (1 + G) * a2;
    var C1p = Math.sqrt(a1p * a1p + b1 * b1);
    var C2p = Math.sqrt(a2p * a2p + b2 * b2);
    var h1p = hueAngle(b1, a1p);
    var h2p = hueAngle(b2, a2p);
    var dLp = L2 - L1;
    var dCp = C2p - C1p;
    var dhp = 0;
    if (C1p * C2p !== 0) {
      var hueDiff = h2p - h1p;
      if (Math.abs(hueDiff) <= 180) dhp = hueDiff;
      else if (hueDiff > 180) dhp = hueDiff - 360;
      else dhp = hueDiff + 360;
    }
    var dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(degreesToRadians(dhp) / 2);
    var Lbarp = (L1 + L2) / 2;
    var Cbarp = (C1p + C2p) / 2;
    var hbarp;
    if (C1p * C2p === 0) hbarp = h1p + h2p;
    else if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
    else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
    else hbarp = (h1p + h2p - 360) / 2;
    var T = 1 - 0.17 * Math.cos(degreesToRadians(hbarp - 30)) +
      0.24 * Math.cos(degreesToRadians(2 * hbarp)) +
      0.32 * Math.cos(degreesToRadians(3 * hbarp + 6)) -
      0.2 * Math.cos(degreesToRadians(4 * hbarp - 63));
    var dtheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
    var Cbarp7 = Math.pow(Cbarp, 7);
    var Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));
    var Sl = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
    var Sc = 1 + 0.045 * Cbarp;
    var Sh = 1 + 0.015 * Cbarp * T;
    var Rt = -Math.sin(degreesToRadians(2 * dtheta)) * Rc;
    return Math.sqrt(
      Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) +
      Rt * (dCp / Sc) * (dHp / Sh)
    );
  }

  var COMPLETE_PALETTE = parsePalette();
  var COLOR_BY_ID = new Map(COMPLETE_PALETTE.map(function (color) { return [color.id, color]; }));

  function getPalette(mode) {
    return String(mode) === "221" ? COMPLETE_PALETTE.slice(0, BASIC_COLOR_COUNT) : COMPLETE_PALETTE.slice();
  }

  function getColor(id) {
    return COLOR_BY_ID.get(String(id || "")) || null;
  }

  function codeFor(colorOrId, brand) {
    var color = typeof colorOrId === "string" ? getColor(colorOrId) : colorOrId;
    if (!color) return "—";
    return color.codes[brand] && color.codes[brand] !== "-" ? color.codes[brand] : color.id;
  }

  function nearestPaletteColor(rgb, palette) {
    if (!palette || !palette.length) return null;
    var target = rgbToLab(rgb);
    var best = palette[0];
    var bestDistance = Infinity;
    for (var index = 0; index < palette.length; index += 1) {
      var distance = ciede2000(target, palette[index].lab);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = palette[index];
        if (distance === 0) break;
      }
    }
    return best;
  }

  function adjustRgb(rgb, options) {
    var brightness = Number(options.brightness || 0) * 2.55;
    var contrastValue = clamp(Number(options.contrast || 0), -100, 100);
    var contrast = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));
    var saturation = 1 + clamp(Number(options.saturation || 0), -100, 100) / 100;
    var r = contrast * (rgb[0] - 128) + 128 + brightness;
    var g = contrast * (rgb[1] - 128) + 128 + brightness;
    var b = contrast * (rgb[2] - 128) + 128 + brightness;
    var gray = 0.299 * r + 0.587 * g + 0.114 * b;
    return [
      clamp(gray + (r - gray) * saturation, 0, 255),
      clamp(gray + (g - gray) * saturation, 0, 255),
      clamp(gray + (b - gray) * saturation, 0, 255)
    ];
  }

  function sourcePixel(imageData, x, y) {
    var index = (y * imageData.width + x) * 4;
    return [imageData.data[index], imageData.data[index + 1], imageData.data[index + 2], imageData.data[index + 3]];
  }

  function estimateBackground(imageData) {
    var samples = [];
    var xStep = Math.max(1, Math.floor(imageData.width / 40));
    var yStep = Math.max(1, Math.floor(imageData.height / 40));
    var x, y;
    for (x = 0; x < imageData.width; x += xStep) {
      samples.push(sourcePixel(imageData, x, 0));
      samples.push(sourcePixel(imageData, x, imageData.height - 1));
    }
    for (y = 0; y < imageData.height; y += yStep) {
      samples.push(sourcePixel(imageData, 0, y));
      samples.push(sourcePixel(imageData, imageData.width - 1, y));
    }
    var opaque = samples.filter(function (pixel) { return pixel[3] >= 24; });
    if (!opaque.length) return [255, 255, 255];
    return [0, 1, 2].map(function (channel) {
      var values = opaque.map(function (pixel) { return pixel[channel]; }).sort(function (a, b) { return a - b; });
      return values[Math.floor(values.length / 2)];
    });
  }

  function sampleCell(imageData, targetX, targetY, targetWidth, targetHeight, style) {
    var x0 = Math.floor(targetX * imageData.width / targetWidth);
    var x1 = Math.max(x0 + 1, Math.ceil((targetX + 1) * imageData.width / targetWidth));
    var y0 = Math.floor(targetY * imageData.height / targetHeight);
    var y1 = Math.max(y0 + 1, Math.ceil((targetY + 1) * imageData.height / targetHeight));
    var sampleSide = style === "cartoon" ? 6 : 5;
    var pixels = [];
    var alphaTotal = 0;
    for (var sy = 0; sy < sampleSide; sy += 1) {
      for (var sx = 0; sx < sampleSide; sx += 1) {
        var px = clamp(Math.floor(x0 + (sx + 0.5) * (x1 - x0) / sampleSide), 0, imageData.width - 1);
        var py = clamp(Math.floor(y0 + (sy + 0.5) * (y1 - y0) / sampleSide), 0, imageData.height - 1);
        var pixel = sourcePixel(imageData, px, py);
        alphaTotal += pixel[3];
        if (pixel[3] >= 24) pixels.push(pixel);
      }
    }
    if (!pixels.length || alphaTotal / (sampleSide * sampleSide) < 24) return null;
    if (style === "cartoon") {
      var buckets = new Map();
      pixels.forEach(function (pixel) {
        var key = [pixel[0], pixel[1], pixel[2]].map(function (value) { return Math.round(value / 24); }).join(":");
        var entry = buckets.get(key) || { count: 0, sum: [0, 0, 0] };
        entry.count += 1;
        entry.sum[0] += pixel[0]; entry.sum[1] += pixel[1]; entry.sum[2] += pixel[2];
        buckets.set(key, entry);
      });
      var winner = Array.from(buckets.values()).sort(function (a, b) { return b.count - a.count; })[0];
      return winner.sum.map(function (value) { return value / winner.count; });
    }
    var sum = pixels.reduce(function (out, pixel) {
      out[0] += pixel[0]; out[1] += pixel[1]; out[2] += pixel[2]; return out;
    }, [0, 0, 0]);
    return sum.map(function (value) { return value / pixels.length; });
  }

  function selectCandidates(samples, palette, limit) {
    if (limit >= palette.length) return palette;
    var counts = new Map();
    samples.forEach(function (rgb) {
      if (!rgb) return;
      var color = nearestPaletteColor(rgb, palette);
      counts.set(color.id, (counts.get(color.id) || 0) + 1);
    });
    var ranked = Array.from(counts.entries()).sort(function (a, b) { return b[1] - a[1]; });
    var chosen = [];
    var chosenIds = new Set();
    ranked.forEach(function (entry) {
      if (chosen.length >= limit) return;
      var color = getColor(entry[0]);
      var separated = chosen.every(function (existing) { return ciede2000(color.lab, existing.lab) >= 3.5; });
      if (separated || chosen.length < Math.min(4, limit)) {
        chosen.push(color); chosenIds.add(color.id);
      }
    });
    ranked.forEach(function (entry) {
      if (chosen.length < limit && !chosenIds.has(entry[0])) chosen.push(getColor(entry[0]));
    });
    return chosen.length ? chosen : palette.slice(0, limit);
  }

  function ditherSamples(samples, width, height, palette) {
    var work = samples.map(function (rgb) { return rgb ? rgb.slice() : null; });
    var cells = new Array(work.length).fill(null);
    function addError(index, error, factor) {
      if (!work[index]) return;
      for (var channel = 0; channel < 3; channel += 1) {
        work[index][channel] = clamp(work[index][channel] + error[channel] * factor, 0, 255);
      }
    }
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        var index = y * width + x;
        var rgb = work[index];
        if (!rgb) continue;
        var color = nearestPaletteColor(rgb, palette);
        cells[index] = color.id;
        var error = [rgb[0] - color.rgb[0], rgb[1] - color.rgb[1], rgb[2] - color.rgb[2]];
        if (x + 1 < width) addError(index + 1, error, 7 / 16);
        if (y + 1 < height) {
          if (x > 0) addError(index + width - 1, error, 3 / 16);
          addError(index + width, error, 5 / 16);
          if (x + 1 < width) addError(index + width + 1, error, 1 / 16);
        }
      }
    }
    return cells;
  }

  function cleanupCells(cells, width, height, strength) {
    var passes = clamp(Math.round(Number(strength || 0) / 25), 0, 4);
    var next = cells.slice();
    for (var pass = 0; pass < passes; pass += 1) {
      var current = next;
      next = current.slice();
      for (var y = 0; y < height; y += 1) {
        for (var x = 0; x < width; x += 1) {
          var index = y * width + x;
          if (!current[index]) continue;
          var counts = new Map();
          var same = 0;
          for (var dy = -1; dy <= 1; dy += 1) {
            for (var dx = -1; dx <= 1; dx += 1) {
              if (dx === 0 && dy === 0) continue;
              var nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
              var value = current[ny * width + nx];
              if (!value) continue;
              if (value === current[index]) same += 1;
              counts.set(value, (counts.get(value) || 0) + 1);
            }
          }
          var majority = Array.from(counts.entries()).sort(function (a, b) { return b[1] - a[1]; })[0];
          if (majority && majority[0] !== current[index] && same <= (pass === 0 ? 1 : 2) && majority[1] >= 4) {
            var from = getColor(current[index]);
            var to = getColor(majority[0]);
            if (ciede2000(from.lab, to.lab) <= 10 + passes * 3) next[index] = majority[0];
          }
        }
      }
    }
    return next;
  }

  function summarizeCells(cells) {
    var counts = new Map();
    var total = 0;
    cells.forEach(function (id) {
      if (!id) return;
      total += 1;
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    var rows = Array.from(counts.entries()).map(function (entry) {
      return { id: entry[0], color: getColor(entry[0]), count: entry[1] };
    }).sort(function (a, b) { return b.count - a.count || a.id.localeCompare(b.id); });
    return { total: total, colors: rows.length, rows: rows };
  }

  function convertImageData(imageData, options) {
    if (!imageData || !imageData.data || !imageData.width || !imageData.height) throw new Error("Invalid image data");
    options = options || {};
    var width = clamp(Math.round(Number(options.width || 29)), 1, MAX_SIDE);
    var height = clamp(Math.round(Number(options.height || Math.max(1, imageData.height / imageData.width * width))), 1, MAX_SIDE);
    var palette = getPalette(options.paletteMode || "291");
    var excluded = new Set(options.excludedIds || []);
    palette = palette.filter(function (color) { return !excluded.has(color.id); });
    if (!palette.length) throw new Error("No palette colors available");
    var background = estimateBackground(imageData);
    var backgroundLab = rgbToLab(background);
    var removeBackground = options.removeBackground === true;
    var backgroundTolerance = clamp(Number(options.backgroundTolerance || 16), 1, 60);
    var samples = [];
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        var sample = sampleCell(imageData, x, y, width, height, options.style || "cartoon");
        if (sample) sample = adjustRgb(sample, options);
        if (sample && removeBackground && ciede2000(rgbToLab(sample), backgroundLab) <= backgroundTolerance) sample = null;
        samples.push(sample);
      }
    }
    var maxColors = clamp(Math.round(Number(options.maxColors || 32)), 2, palette.length);
    var candidates = selectCandidates(samples, palette, maxColors);
    var cells = options.dither === true
      ? ditherSamples(samples, width, height, candidates)
      : samples.map(function (rgb) { var color = rgb ? nearestPaletteColor(rgb, candidates) : null; return color ? color.id : null; });
    cells = cleanupCells(cells, width, height, options.mergeStrength || 0);
    var summary = summarizeCells(cells);
    return {
      width: width,
      height: height,
      cells: cells,
      totalBeads: summary.total,
      colorsUsed: summary.colors,
      candidateIds: candidates.map(function (color) { return color.id; }),
      detectedBackground: rgbToHex(background)
    };
  }

  function emptyCells(width, height) {
    return new Array(width * height).fill(null);
  }

  var layerSequence = 0;
  function createLayer(width, height, name, cells) {
    layerSequence += 1;
    return {
      id: "layer-" + Date.now().toString(36) + "-" + layerSequence.toString(36),
      name: name || "新图层",
      visible: true,
      locked: false,
      opacity: 1,
      cells: Array.isArray(cells) ? cells.slice(0, width * height).concat(emptyCells(width, height)).slice(0, width * height) : emptyCells(width, height)
    };
  }

  function createProject(width, height, name) {
    width = clamp(Math.round(Number(width || 29)), 1, MAX_SIDE);
    height = clamp(Math.round(Number(height || 29)), 1, MAX_SIDE);
    var base = createLayer(width, height, "主体");
    return {
      version: VERSION,
      name: name || "未命名拼豆",
      width: width,
      height: height,
      brand: "MARD",
      paletteMode: "291",
      boardSize: 29,
      layers: [base],
      activeLayerId: base.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function getActiveLayer(project) {
    return project.layers.find(function (layer) { return layer.id === project.activeLayerId; }) || project.layers[project.layers.length - 1] || null;
  }

  function composeProject(project) {
    var cells = emptyCells(project.width, project.height);
    project.layers.forEach(function (layer) {
      if (!layer.visible) return;
      layer.cells.forEach(function (cell, index) { if (cell) cells[index] = cell; });
    });
    return cells;
  }

  function cloneProject(project) {
    var copy = JSON.parse(JSON.stringify(project));
    copy.layers = copy.layers.map(function (layer) { layer.cells = layer.cells.slice(); return layer; });
    return copy;
  }

  function normalizeProject(raw) {
    if (!raw || typeof raw !== "object") throw new Error("Invalid project");
    var width = clamp(Math.round(Number(raw.width || 29)), 1, MAX_SIDE);
    var height = clamp(Math.round(Number(raw.height || 29)), 1, MAX_SIDE);
    var project = createProject(width, height, String(raw.name || "导入的拼豆项目").slice(0, 80));
    project.brand = BRANDS.indexOf(raw.brand) >= 0 ? raw.brand : "MARD";
    project.paletteMode = String(raw.paletteMode) === "221" ? "221" : "291";
    project.boardSize = clamp(Math.round(Number(raw.boardSize || 29)), 5, 100);
    if (Array.isArray(raw.layers) && raw.layers.length) {
      project.layers = raw.layers.slice(0, 30).map(function (source, index) {
        var layer = createLayer(width, height, String(source.name || "图层 " + (index + 1)).slice(0, 40), source.cells);
        layer.id = String(source.id || layer.id);
        layer.visible = source.visible !== false;
        layer.locked = source.locked === true;
        layer.opacity = clamp(Number(source.opacity == null ? 1 : source.opacity), 0.1, 1);
        return layer;
      });
      project.activeLayerId = project.layers.some(function (layer) { return layer.id === raw.activeLayerId; }) ? raw.activeLayerId : project.layers[project.layers.length - 1].id;
    }
    project.createdAt = raw.createdAt || project.createdAt;
    project.updatedAt = new Date().toISOString();
    return project;
  }

  function resizeCells(cells, oldWidth, oldHeight, newWidth, newHeight, anchor) {
    var next = emptyCells(newWidth, newHeight);
    var offsetX = anchor === "top-left" ? 0 : Math.floor((newWidth - oldWidth) / 2);
    var offsetY = anchor === "top-left" ? 0 : Math.floor((newHeight - oldHeight) / 2);
    for (var y = 0; y < oldHeight; y += 1) {
      for (var x = 0; x < oldWidth; x += 1) {
        var nx = x + offsetX, ny = y + offsetY;
        if (nx >= 0 && ny >= 0 && nx < newWidth && ny < newHeight) next[ny * newWidth + nx] = cells[y * oldWidth + x] || null;
      }
    }
    return next;
  }

  function resizeProject(project, newWidth, newHeight, anchor) {
    newWidth = clamp(Math.round(Number(newWidth)), 1, MAX_SIDE);
    newHeight = clamp(Math.round(Number(newHeight)), 1, MAX_SIDE);
    var next = cloneProject(project);
    next.layers.forEach(function (layer) {
      layer.cells = resizeCells(layer.cells, project.width, project.height, newWidth, newHeight, anchor || "center");
    });
    next.width = newWidth;
    next.height = newHeight;
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function selectionBounds(selection, width, height) {
    if (!selection) return { x0: 0, y0: 0, x1: width - 1, y1: height - 1 };
    return {
      x0: clamp(Math.min(selection.x0, selection.x1), 0, width - 1),
      y0: clamp(Math.min(selection.y0, selection.y1), 0, height - 1),
      x1: clamp(Math.max(selection.x0, selection.x1), 0, width - 1),
      y1: clamp(Math.max(selection.y0, selection.y1), 0, height - 1)
    };
  }

  function floodFill(cells, width, height, startIndex, replacement) {
    var next = cells.slice();
    var target = next[startIndex] || null;
    replacement = replacement || null;
    if (target === replacement || startIndex < 0 || startIndex >= next.length) return next;
    var queue = [startIndex];
    var visited = new Uint8Array(next.length);
    visited[startIndex] = 1;
    for (var cursor = 0; cursor < queue.length; cursor += 1) {
      var index = queue[cursor];
      if ((next[index] || null) !== target) continue;
      next[index] = replacement;
      var x = index % width, y = Math.floor(index / width);
      var neighbors = [];
      if (x > 0) neighbors.push(index - 1);
      if (x + 1 < width) neighbors.push(index + 1);
      if (y > 0) neighbors.push(index - width);
      if (y + 1 < height) neighbors.push(index + width);
      neighbors.forEach(function (neighbor) {
        if (!visited[neighbor] && (next[neighbor] || null) === target) { visited[neighbor] = 1; queue.push(neighbor); }
      });
    }
    return next;
  }

  function drawLine(cells, width, height, x0, y0, x1, y1, colorId) {
    var next = cells.slice();
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    var dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    var error = dx + dy;
    while (true) {
      if (x0 >= 0 && y0 >= 0 && x0 < width && y0 < height) next[y0 * width + x0] = colorId || null;
      if (x0 === x1 && y0 === y1) break;
      var error2 = 2 * error;
      if (error2 >= dy) { error += dy; x0 += sx; }
      if (error2 <= dx) { error += dx; y0 += sy; }
    }
    return next;
  }

  function drawRect(cells, width, height, start, end, colorId, filled) {
    var next = cells.slice();
    var bounds = selectionBounds({ x0: start.x, y0: start.y, x1: end.x, y1: end.y }, width, height);
    for (var y = bounds.y0; y <= bounds.y1; y += 1) {
      for (var x = bounds.x0; x <= bounds.x1; x += 1) {
        if (filled || x === bounds.x0 || x === bounds.x1 || y === bounds.y0 || y === bounds.y1) next[y * width + x] = colorId || null;
      }
    }
    return next;
  }

  function drawEllipse(cells, width, height, start, end, colorId, filled) {
    var next = cells.slice();
    var bounds = selectionBounds({ x0: start.x, y0: start.y, x1: end.x, y1: end.y }, width, height);
    var cx = (bounds.x0 + bounds.x1) / 2, cy = (bounds.y0 + bounds.y1) / 2;
    var rx = Math.max(0.5, (bounds.x1 - bounds.x0 + 1) / 2);
    var ry = Math.max(0.5, (bounds.y1 - bounds.y0 + 1) / 2);
    for (var y = bounds.y0; y <= bounds.y1; y += 1) {
      for (var x = bounds.x0; x <= bounds.x1; x += 1) {
        var distance = Math.pow((x + 0.5 - cx) / rx, 2) + Math.pow((y + 0.5 - cy) / ry, 2);
        if ((filled && distance <= 1) || (!filled && distance <= 1.18 && distance >= 0.68)) next[y * width + x] = colorId || null;
      }
    }
    return next;
  }

  function mirrorCells(cells, width, height, axis, selection) {
    var next = cells.slice();
    var bounds = selectionBounds(selection, width, height);
    for (var y = bounds.y0; y <= bounds.y1; y += 1) {
      for (var x = bounds.x0; x <= bounds.x1; x += 1) {
        var sourceX = axis === "vertical" ? x : bounds.x1 - (x - bounds.x0);
        var sourceY = axis === "vertical" ? bounds.y1 - (y - bounds.y0) : y;
        next[y * width + x] = cells[sourceY * width + sourceX] || null;
      }
    }
    return next;
  }

  function copyRegion(cells, width, height, selection) {
    var bounds = selectionBounds(selection, width, height);
    var outWidth = bounds.x1 - bounds.x0 + 1;
    var outHeight = bounds.y1 - bounds.y0 + 1;
    var out = emptyCells(outWidth, outHeight);
    for (var y = 0; y < outHeight; y += 1) {
      for (var x = 0; x < outWidth; x += 1) out[y * outWidth + x] = cells[(bounds.y0 + y) * width + bounds.x0 + x] || null;
    }
    return { width: outWidth, height: outHeight, cells: out };
  }

  function pasteRegion(cells, width, height, region, x0, y0) {
    var next = cells.slice();
    if (!region || !Array.isArray(region.cells)) return next;
    for (var y = 0; y < region.height; y += 1) {
      for (var x = 0; x < region.width; x += 1) {
        var nx = x0 + x, ny = y0 + y;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        var value = region.cells[y * region.width + x];
        if (value) next[ny * width + nx] = value;
      }
    }
    return next;
  }

  function serializeProject(project) {
    var copy = cloneProject(project);
    copy.version = VERSION;
    copy.updatedAt = new Date().toISOString();
    return JSON.stringify(copy, null, 2);
  }

  function deserializeProject(text) {
    return normalizeProject(JSON.parse(text));
  }

  return Object.freeze({
    VERSION: VERSION,
    MAX_SIDE: MAX_SIDE,
    BASIC_COLOR_COUNT: BASIC_COLOR_COUNT,
    BRANDS: BRANDS.slice(),
    COMPLETE_PALETTE: COMPLETE_PALETTE,
    clamp: clamp,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    rgbToLab: rgbToLab,
    ciede2000: ciede2000,
    getPalette: getPalette,
    getColor: getColor,
    codeFor: codeFor,
    nearestPaletteColor: nearestPaletteColor,
    convertImageData: convertImageData,
    cleanupCells: cleanupCells,
    summarizeCells: summarizeCells,
    emptyCells: emptyCells,
    createLayer: createLayer,
    createProject: createProject,
    getActiveLayer: getActiveLayer,
    composeProject: composeProject,
    cloneProject: cloneProject,
    normalizeProject: normalizeProject,
    resizeProject: resizeProject,
    floodFill: floodFill,
    drawLine: drawLine,
    drawRect: drawRect,
    drawEllipse: drawEllipse,
    mirrorCells: mirrorCells,
    copyRegion: copyRegion,
    pasteRegion: pasteRegion,
    serializeProject: serializeProject,
    deserializeProject: deserializeProject
  });
});
