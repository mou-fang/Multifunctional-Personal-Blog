/* ===== claudeOne :: ncm-decrypt.js =====
 * Browser-side NetEase Cloud Music .ncm unlock support.
 */

(function initNcmDecrypt(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ClaudeOneNcmDecrypt = api;
})(typeof self !== "undefined" ? self : this, function factory() {
  const CORE_KEY = hexToBytes("687A4852416D736F356B496E62617857");
  const META_KEY = hexToBytes("2331346C6A6B5F215C5D2630553C2728");
  const textDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8") : null;
  const SBOX = new Uint8Array(256);
  const INV_SBOX = new Uint8Array(256);
  initAesTables();

  function hexToBytes(hex) {
    const output = new Uint8Array(hex.length / 2);
    for (let i = 0; i < output.length; i += 1) output[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return output;
  }

  function rotl8(value, shift) {
    return ((value << shift) | (value >>> (8 - shift))) & 0xff;
  }

  function gmul(a, b) {
    let p = 0;
    let x = a;
    let y = b;
    for (let i = 0; i < 8; i += 1) {
      if (y & 1) p ^= x;
      const hi = x & 0x80;
      x = (x << 1) & 0xff;
      if (hi) x ^= 0x1b;
      y >>>= 1;
    }
    return p;
  }

  function gfPow(value, power) {
    let result = 1;
    let base = value;
    let exp = power;
    while (exp > 0) {
      if (exp & 1) result = gmul(result, base);
      base = gmul(base, base);
      exp >>>= 1;
    }
    return result;
  }

  function initAesTables() {
    for (let i = 0; i < 256; i += 1) {
      const inv = i ? gfPow(i, 254) : 0;
      const sub = (0x63 ^ inv ^ rotl8(inv, 1) ^ rotl8(inv, 2) ^ rotl8(inv, 3) ^ rotl8(inv, 4)) & 0xff;
      SBOX[i] = sub;
      INV_SBOX[sub] = i;
    }
  }

  function expandKey(key) {
    if (!key || key.length !== 16) throw new Error("NCM AES key length is invalid");
    const words = new Uint32Array(44);
    for (let i = 0; i < 4; i += 1) {
      words[i] = ((key[i * 4] << 24) | (key[i * 4 + 1] << 16) | (key[i * 4 + 2] << 8) | key[i * 4 + 3]) >>> 0;
    }
    let rcon = 1;
    for (let i = 4; i < 44; i += 1) {
      let temp = words[i - 1];
      if (i % 4 === 0) {
        temp = subWord(rotWord(temp)) ^ (rcon << 24);
        rcon = gmul(rcon, 2);
      }
      words[i] = (words[i - 4] ^ temp) >>> 0;
    }
    return words;
  }

  function rotWord(word) {
    return ((word << 8) | (word >>> 24)) >>> 0;
  }

  function subWord(word) {
    return (
      (SBOX[(word >>> 24) & 0xff] << 24) |
      (SBOX[(word >>> 16) & 0xff] << 16) |
      (SBOX[(word >>> 8) & 0xff] << 8) |
      SBOX[word & 0xff]
    ) >>> 0;
  }

  function addRoundKey(state, words, round) {
    for (let col = 0; col < 4; col += 1) {
      const word = words[round * 4 + col];
      state[col * 4] ^= (word >>> 24) & 0xff;
      state[col * 4 + 1] ^= (word >>> 16) & 0xff;
      state[col * 4 + 2] ^= (word >>> 8) & 0xff;
      state[col * 4 + 3] ^= word & 0xff;
    }
  }

  function invSubBytes(state) {
    for (let i = 0; i < 16; i += 1) state[i] = INV_SBOX[state[i]];
  }

  function invShiftRows(state) {
    const copy = state.slice();
    for (let row = 1; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        state[row + 4 * col] = copy[row + 4 * ((col - row + 4) % 4)];
      }
    }
  }

  function invMixColumns(state) {
    for (let col = 0; col < 4; col += 1) {
      const offset = col * 4;
      const a0 = state[offset];
      const a1 = state[offset + 1];
      const a2 = state[offset + 2];
      const a3 = state[offset + 3];
      state[offset] = gmul(a0, 14) ^ gmul(a1, 11) ^ gmul(a2, 13) ^ gmul(a3, 9);
      state[offset + 1] = gmul(a0, 9) ^ gmul(a1, 14) ^ gmul(a2, 11) ^ gmul(a3, 13);
      state[offset + 2] = gmul(a0, 13) ^ gmul(a1, 9) ^ gmul(a2, 14) ^ gmul(a3, 11);
      state[offset + 3] = gmul(a0, 11) ^ gmul(a1, 13) ^ gmul(a2, 9) ^ gmul(a3, 14);
    }
  }

  function decryptBlock(block, words) {
    const state = Uint8Array.from(block);
    addRoundKey(state, words, 10);
    for (let round = 9; round >= 1; round -= 1) {
      invShiftRows(state);
      invSubBytes(state);
      addRoundKey(state, words, round);
      invMixColumns(state);
    }
    invShiftRows(state);
    invSubBytes(state);
    addRoundKey(state, words, 0);
    return state;
  }

  function aesEcbDecrypt(input, key) {
    const data = toBytes(input);
    if (data.length === 0 || data.length % 16 !== 0) throw new Error("NCM AES data length is invalid");
    const words = expandKey(toBytes(key));
    const output = new Uint8Array(data.length);
    for (let offset = 0; offset < data.length; offset += 16) {
      output.set(decryptBlock(data.slice(offset, offset + 16), words), offset);
    }
    return stripPkcs7(output);
  }

  function stripPkcs7(bytes) {
    const pad = bytes[bytes.length - 1];
    if (pad < 1 || pad > 16 || pad > bytes.length) return bytes;
    for (let i = bytes.length - pad; i < bytes.length; i += 1) {
      if (bytes[i] !== pad) return bytes;
    }
    return bytes.slice(0, bytes.length - pad);
  }

  function toBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new Error("NCM input must be ArrayBuffer or Uint8Array");
  }

  function readAscii(bytes, offset, length) {
    let output = "";
    for (let i = 0; i < length; i += 1) output += String.fromCharCode(bytes[offset + i]);
    return output;
  }

  function xorCopy(bytes, mask) {
    const output = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i += 1) output[i] = bytes[i] ^ mask;
    return output;
  }

  function bytesToUtf8(bytes) {
    if (textDecoder) return textDecoder.decode(bytes);
    let text = "";
    for (let i = 0; i < bytes.length; i += 1) text += String.fromCharCode(bytes[i]);
    try { return decodeURIComponent(escape(text)); }
    catch (_error) { return text; }
  }

  function base64ToBytes(text) {
    const clean = String(text || "").replace(/\s+/g, "");
    if (typeof atob === "function") {
      const binary = atob(clean);
      const output = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) output[i] = binary.charCodeAt(i);
      return output;
    }
    if (typeof Buffer !== "undefined") return Uint8Array.from(Buffer.from(clean, "base64"));
    throw new Error("当前浏览器不支持 Base64 解码");
  }

  function readUint32(view, offset) {
    return view.getUint32(offset, true);
  }

  function buildKeyBox(key) {
    const box = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) box[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i += 1) {
      j = (j + box[i] + key[i % key.length]) & 0xff;
      const tmp = box[i];
      box[i] = box[j];
      box[j] = tmp;
    }
    return box;
  }

  function decryptAudio(audio, keyBox) {
    const output = new Uint8Array(audio.length);
    for (let i = 0; i < audio.length; i += 1) {
      const j = (i + 1) & 0xff;
      output[i] = audio[i] ^ keyBox[(keyBox[j] + keyBox[(keyBox[j] + j) & 0xff]) & 0xff];
    }
    return output;
  }

  function detectImageMime(bytes) {
    if (!bytes || bytes.length < 4) return "";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
    return "image/jpeg";
  }

  function sniffAudioExt(bytes, preferred) {
    const ext = String(preferred || "").toLowerCase().replace(/^\./, "");
    if (["mp3", "flac", "ogg", "m4a", "wav", "aac"].includes(ext)) return ext;
    if (readAscii(bytes, 0, 4) === "fLaC") return "flac";
    if (readAscii(bytes, 0, 4) === "OggS") return "ogg";
    if (readAscii(bytes, 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return "mp3";
    if (readAscii(bytes, 4, 4) === "ftyp") return "m4a";
    if (readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 4) === "WAVE") return "wav";
    return "mp3";
  }

  function parseArtists(value) {
    if (!Array.isArray(value)) return String(value || "");
    return value.map(item => {
      if (Array.isArray(item)) return item[0];
      return item && (item.name || item.title) || "";
    }).filter(Boolean).join("/");
  }

  function decrypt(arrayBuffer, fileName) {
    const bytes = toBytes(arrayBuffer);
    if (bytes.length < 32 || readAscii(bytes, 0, 8) !== "CTENFDAM") {
      throw new Error("不是有效的网易云 .ncm 文件");
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 10;

    const keyLength = readUint32(view, offset);
    offset += 4;
    const encryptedKey = xorCopy(bytes.slice(offset, offset + keyLength), 0x64);
    offset += keyLength;
    const keyData = aesEcbDecrypt(encryptedKey, CORE_KEY).slice(17);
    if (!keyData.length) throw new Error("NCM 音频密钥解析失败");
    const keyBox = buildKeyBox(keyData);

    const metaLength = readUint32(view, offset);
    offset += 4;
    const metaRaw = xorCopy(bytes.slice(offset, offset + metaLength), 0x63);
    offset += metaLength;
    const metaEncoded = readAscii(metaRaw, 0, metaRaw.length).replace(/^163 key\(Don't modify\):/, "");
    let metadata = {};
    if (metaEncoded) {
      const metaText = bytesToUtf8(aesEcbDecrypt(base64ToBytes(metaEncoded), META_KEY)).replace(/^music:/, "");
      try { metadata = JSON.parse(metaText); }
      catch (_error) { metadata = {}; }
    }

    offset += 4; // CRC32
    offset += 5; // gap
    const coverLength = readUint32(view, offset);
    offset += 4;
    const cover = coverLength > 0 ? bytes.slice(offset, offset + coverLength) : null;
    offset += coverLength;

    const audio = decryptAudio(bytes.slice(offset), keyBox);
    const ext = sniffAudioExt(audio, metadata.format);
    const rawName = String(fileName || "music").replace(/\.[^.]+$/, "");
    return {
      title: metadata.musicName || metadata.name || rawName,
      artist: parseArtists(metadata.artist || metadata.artists),
      album: metadata.album || "",
      ext,
      mime: {
        mp3: "audio/mpeg",
        flac: "audio/flac",
        ogg: "audio/ogg",
        m4a: "audio/mp4",
        wav: "audio/wav",
        aac: "audio/aac",
      }[ext] || "application/octet-stream",
      audio: audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength),
      picture: cover ? cover.buffer.slice(cover.byteOffset, cover.byteOffset + cover.byteLength) : null,
      pictureMime: cover ? detectImageMime(cover) : "",
    };
  }

  return {
    decrypt,
    _internals: { aesEcbDecrypt, decryptBlock, expandKey, hexToBytes },
  };
});
