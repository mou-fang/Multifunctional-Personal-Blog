/*
 * QQ Music browser-side decryption.
 *
 * Supports five distinct file formats:
 *   1. musicex (.mflac/.mgg new):  needs an EKey fetched from QQ Music API
 *      using the logged-in account.  The file tail is 184+ bytes prefixed by
 *      a length field, terminated by the literal "musicex\0" magic.
 *   2. QTag:  the EKey is embedded right before the trailing "QTag" magic.
 *      keySize is stored as a 4-byte BIG-ENDIAN integer (per unlock-music).
 *   3. STag:  per qmdec convention, the entire embedded text is the EKey.
 *      keySize is little-endian.
 *   4. V1-keyed:  no magic; the last 4 bytes are an LE keySize < 0x400,
 *      followed by `keySize` bytes of raw key material.
 *   5. V1-static (.tkm/.bkcmp3/.bkcflac etc.):  no embedded key; the whole
 *      file is XORed with a 256-byte fixed table indexed by the formula
 *      `QMC_STATIC_BOX[(offset*offset + 27) & 0xFF]`.
 *
 * Only musicex requires the caller to supply an external EKey.
 *
 * Adapted from qmdec (https://github.com/Sophomoresty/qmdec) for the EKey-
 * derived MapCipher/RC4 pipeline, and from unlock-music's reference for the
 * QMCv1 static cipher, dispatch logic, and 256-byte static key table.
 */

(function (root) {
  "use strict";

  // ---- Constants -----------------------------------------------------------

  var MUSICEX_MAGIC = new Uint8Array([0x6d, 0x75, 0x73, 0x69, 0x63, 0x65, 0x78, 0x00]);
  var QTAG_MAGIC_STR = "QTag";
  var STAG_MAGIC_STR = "STag";
  var ENCV2_PREFIX_STR = "QQMusic EncV2,Key:";
  var ENCV2_KEY1 = new Uint8Array([
    0x33, 0x38, 0x36, 0x5a, 0x4a, 0x59, 0x21, 0x40,
    0x23, 0x2a, 0x24, 0x25, 0x5e, 0x26, 0x29, 0x28,
  ]);
  var ENCV2_KEY2 = new Uint8Array([
    0x2a, 0x24, 0x25, 0x5e, 0x26, 0x29, 0x28, 0x23,
    0x40, 0x21, 0x33, 0x38, 0x36, 0x5a, 0x4a, 0x59,
  ]);
  var ENCV2_PREFIX = new Uint8Array(18);
  for (var _i = 0; _i < ENCV2_PREFIX_STR.length; _i++) ENCV2_PREFIX[_i] = ENCV2_PREFIX_STR.charCodeAt(_i);

  // QMC v1 static cipher table (256 bytes), identical to unlock-music's QMC1.
  // Used for legacy mobile-era files (.tkm, .bkcmp3, .bkcflac, etc.).
  var QMC_STATIC_BOX = new Uint8Array([
    0x77, 0x48, 0x32, 0x73, 0xDE, 0xF2, 0xC0, 0xC8,
    0x95, 0xEC, 0x30, 0xB2, 0x51, 0xC3, 0xE1, 0xA0,
    0x9E, 0xE6, 0x9D, 0xCF, 0xFA, 0x7F, 0x14, 0xD1,
    0xCE, 0xB8, 0xDC, 0xC3, 0x4A, 0x67, 0x93, 0xD6,
    0x28, 0xC2, 0x91, 0x70, 0xCA, 0x8D, 0xA2, 0xA4,
    0xF0, 0x08, 0x61, 0x90, 0x7E, 0x6F, 0xA2, 0xE0,
    0xEB, 0xAE, 0x3E, 0xB6, 0x67, 0xC7, 0x92, 0xF4,
    0x91, 0xB5, 0xF6, 0x6C, 0x5E, 0x84, 0x40, 0xF7,
    0xF3, 0x1B, 0x02, 0x7F, 0xD5, 0xAB, 0x41, 0x89,
    0x28, 0xF4, 0x25, 0xCC, 0x52, 0x11, 0xAD, 0x43,
    0x68, 0xA6, 0x41, 0x8B, 0x84, 0xB5, 0xFF, 0x2C,
    0x92, 0x4A, 0x26, 0xD8, 0x47, 0x6A, 0x7C, 0x95,
    0x61, 0xCC, 0xE6, 0xCB, 0xBB, 0x3F, 0x47, 0x58,
    0x89, 0x75, 0xC3, 0x75, 0xA1, 0xD9, 0xAF, 0xCC,
    0x08, 0x73, 0x17, 0xDC, 0xAA, 0x9A, 0xA2, 0x16,
    0x41, 0xD8, 0xA2, 0x06, 0xC6, 0x8B, 0xFC, 0x66,
    0x34, 0x9F, 0xCF, 0x18, 0x23, 0xA0, 0x0A, 0x74,
    0xE7, 0x2B, 0x27, 0x70, 0x92, 0xE9, 0xAF, 0x37,
    0xE6, 0x8C, 0xA7, 0xBC, 0x62, 0x65, 0x9C, 0xC2,
    0x08, 0xC9, 0x88, 0xB3, 0xF3, 0x43, 0xAC, 0x74,
    0x2C, 0x0F, 0xD4, 0xAF, 0xA1, 0xC3, 0x01, 0x64,
    0x95, 0x4E, 0x48, 0x9F, 0xF4, 0x35, 0x78, 0x95,
    0x7A, 0x39, 0xD6, 0x6A, 0xA0, 0x6D, 0x40, 0xE8,
    0x4F, 0xA8, 0xEF, 0x11, 0x1D, 0xF3, 0x1B, 0x3F,
    0x3F, 0x07, 0xDD, 0x6F, 0x5B, 0x19, 0x30, 0x19,
    0xFB, 0xEF, 0x0E, 0x37, 0xF0, 0x0E, 0xCD, 0x16,
    0x49, 0xFE, 0x53, 0x47, 0x13, 0x1A, 0xBD, 0xA4,
    0xF1, 0x40, 0x19, 0x60, 0x0E, 0xED, 0x68, 0x09,
    0x06, 0x5F, 0x4D, 0xCF, 0x3D, 0x1A, 0xFE, 0x20,
    0x77, 0xE4, 0xD9, 0xDA, 0xF9, 0xA4, 0x2B, 0x76,
    0x1C, 0x71, 0xDB, 0x00, 0xBC, 0xFD, 0x0C, 0x6C,
    0xA5, 0x47, 0xF7, 0xF6, 0x00, 0x79, 0x4A, 0x11,
  ]);

  // ---- Utilities -----------------------------------------------------------

  function bytesEqual(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function bytesStartsWith(a, prefix) {
    if (a.length < prefix.length) return false;
    for (var i = 0; i < prefix.length; i++) if (a[i] !== prefix[i]) return false;
    return true;
  }

  function readUint32LE(bytes, offset) {
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
  }

  function readUint32BE(bytes, offset) {
    return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
  }

  function writeUint32BE(bytes, offset, value) {
    bytes[offset] = (value >>> 24) & 0xff;
    bytes[offset + 1] = (value >>> 16) & 0xff;
    bytes[offset + 2] = (value >>> 8) & 0xff;
    bytes[offset + 3] = value & 0xff;
  }

  function decodeUtf16LE(bytes, start, end) {
    var chars = [];
    for (var i = start; i < end; i += 2) {
      var code = bytes[i] | (bytes[i + 1] << 8);
      if (code === 0) break;
      chars.push(String.fromCharCode(code));
    }
    return chars.join("").trim();
  }

  function decodeUtf8(bytes) {
    if (typeof TextDecoder !== "undefined") {
      try { return new TextDecoder("utf-8").decode(bytes); } catch (_e) { /* fall through */ }
    }
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }

  function decodeBase64(str) {
    var compact = String(str || "").replace(/\s+/g, "");
    if (!compact || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) return null;
    try {
      var binary = atob(compact);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.length ? bytes : null;
    } catch (_e) {
      return null;
    }
  }

  // ---- File tail parsing ---------------------------------------------------

  function parseFileTail(arrayBuffer) {
    var fileSize = arrayBuffer.byteLength;
    if (fileSize < 16) return null;
    var data = new Uint8Array(arrayBuffer);

    // Path 1: musicex (last 8 bytes match "musicex\0").
    var tail8 = data.subarray(fileSize - 8, fileSize);
    if (bytesEqual(tail8, MUSICEX_MAGIC)) {
      var tailSize = readUint32LE(data, fileSize - 16);
      var audioSize = fileSize - 16 - tailSize;
      if (tailSize < 184 || tailSize > 1024 * 1024 || audioSize <= 0) return null;
      var tail = data.subarray(audioSize, audioSize + tailSize);
      return {
        format: "musicex",
        songMid: decodeUtf16LE(tail, 28, 88),
        filename: decodeUtf16LE(tail, 88, 184),
        audioSize: audioSize,
        ekey: null, // signals UI to fetch from server
        embeddedKey: null,
      };
    }

    // Paths 2–3: QTag / STag (last 4 bytes are the magic).
    var tail4 = String.fromCharCode(tail8[4], tail8[5], tail8[6], tail8[7]);
    if (tail4 === QTAG_MAGIC_STR || tail4 === STAG_MAGIC_STR) {
      // QTag uses BIG-endian keySize (per unlock-music); STag uses LE per qmdec.
      var keySize = tail4 === QTAG_MAGIC_STR
        ? readUint32BE(data, fileSize - 8)
        : readUint32LE(data, fileSize - 8);
      var audioEnd = fileSize - 8 - keySize;
      if (keySize <= 0 || keySize > 0x1000 || audioEnd <= 0) return null;
      var keyBlob = data.subarray(audioEnd, audioEnd + keySize);
      var keyText = decodeUtf8(keyBlob);
      var songMidQ = "", ekeyText = "";
      if (tail4 === QTAG_MAGIC_STR) {
        // QTag inner format (per unlock-music): "<ekey>,<songid>,<...>".
        // qmdec uses "<songmid>,<ekey>".  Accept both: if the first segment
        // looks EKey-like, use it as the EKey; otherwise treat the second
        // segment as the EKey.
        var commaIdx = keyText.indexOf(",");
        if (commaIdx >= 0) {
          var first = keyText.substring(0, commaIdx).trim();
          var rest = keyText.substring(commaIdx + 1).trim();
          var firstLooksLikeEKey = first.length > 16 && (
            first.indexOf(ENCV2_PREFIX_STR) === 0 ||
            /[+/=]/.test(first) ||
            first.length > 40
          );
          if (firstLooksLikeEKey) {
            ekeyText = first;
            var c2 = rest.indexOf(",");
            songMidQ = c2 >= 0 ? rest.substring(c2 + 1).trim() : rest;
          } else {
            songMidQ = first;
            ekeyText = rest;
          }
        } else {
          ekeyText = keyText.trim();
        }
      } else {
        ekeyText = keyText.trim();
      }
      if (!ekeyText) return null;
      return {
        format: tail4 === QTAG_MAGIC_STR ? "qtag" : "stag",
        songMid: songMidQ,
        filename: "",
        audioSize: audioEnd,
        ekey: ekeyText,
        embeddedKey: null,
      };
    }

    // Path 4: V1 with embedded raw key (last 4 bytes = LE keySize < 0x400).
    var v1KeySize = readUint32LE(data, fileSize - 4);
    if (v1KeySize > 0 && v1KeySize < 0x400 && fileSize > v1KeySize + 4) {
      var v1AudioEnd = fileSize - 4 - v1KeySize;
      var v1Key = new Uint8Array(v1KeySize);
      v1Key.set(data.subarray(v1AudioEnd, v1AudioEnd + v1KeySize));
      return {
        format: "v1-keyed",
        songMid: "",
        filename: "",
        audioSize: v1AudioEnd,
        ekey: "<embedded-v1>", // placeholder so music.js skips server fetch
        embeddedKey: v1Key,
      };
    }

    // Path 5: pure static cipher (no recognizable tail) — used by .tkm,
    // .bkcmp3, .bkcflac and other QMCv1 mobile-era formats.
    return {
      format: "v1-static",
      songMid: "",
      filename: "",
      audioSize: fileSize,
      ekey: "<static-key>", // placeholder so music.js skips server fetch
      embeddedKey: null,
    };
  }

  // ---- Tencent TEA (used by EncV2 and EKey derivation) --------------------

  function teaDecryptBlock(block, key) {
    var v0 = readUint32BE(block, 0);
    var v1 = readUint32BE(block, 4);
    var k0 = readUint32BE(key, 0);
    var k1 = readUint32BE(key, 4);
    var k2 = readUint32BE(key, 8);
    var k3 = readUint32BE(key, 12);
    var delta = 0x9e3779b9;
    var total = (delta * 16) >>> 0;

    for (var i = 0; i < 16; i++) {
      var mix1 = (((v0 << 4) + k2) ^ (v0 + total) ^ ((v0 >>> 5) + k3)) >>> 0;
      v1 = (v1 - mix1) >>> 0;
      var mix0 = (((v1 << 4) + k0) ^ (v1 + total) ^ ((v1 >>> 5) + k1)) >>> 0;
      v0 = (v0 - mix0) >>> 0;
      total = (total - delta) >>> 0;
    }

    var output = new Uint8Array(8);
    writeUint32BE(output, 0, v0);
    writeUint32BE(output, 4, v1);
    return output;
  }

  function decryptTencentTea(input, key) {
    if (key.length !== 16 || input.length < 16 || input.length % 8 !== 0) return null;

    var dest = teaDecryptBlock(input.subarray(0, 8), key);
    var padLength = dest[0] & 0x07;
    var outputLength = input.length - padLength - 10;
    if (outputLength <= 0) return null;

    var output = new Uint8Array(outputLength);
    var ivPrevious = new Uint8Array(8);
    var ivCurrent = input.subarray(0, 8);
    var inputPosition = 8;
    var destIndex = 1 + padLength;

    function decryptNextBlock() {
      if (inputPosition + 8 > input.length) return false;
      ivPrevious = ivCurrent;
      ivCurrent = input.subarray(inputPosition, inputPosition + 8);
      var mixed = new Uint8Array(8);
      for (var j = 0; j < 8; j++) mixed[j] = dest[j] ^ input[inputPosition + j];
      dest = teaDecryptBlock(mixed, key);
      inputPosition += 8;
      destIndex = 0;
      return true;
    }

    for (var skipped = 0; skipped < 2;) {
      if (destIndex < 8) { destIndex++; skipped++; }
      else if (!decryptNextBlock()) return null;
    }

    for (var outputPosition = 0; outputPosition < outputLength;) {
      if (destIndex < 8) {
        output[outputPosition] = dest[destIndex] ^ ivPrevious[destIndex];
        outputPosition++;
        destIndex++;
      } else if (!decryptNextBlock()) {
        return null;
      }
    }
    return output;
  }

  // ---- Key derivation ------------------------------------------------------

  function simpleMakeKey(salt, length) {
    var output = new Uint8Array(length);
    for (var i = 0; i < length; i++) {
      output[i] = Math.trunc(Math.abs(Math.tan(salt + i * 0.1)) * 100) & 0xff;
    }
    return output;
  }

  function decryptEncV2(rawKey) {
    var first = decryptTencentTea(rawKey.subarray(ENCV2_PREFIX.length), ENCV2_KEY1);
    if (!first) return null;
    var second = decryptTencentTea(first, ENCV2_KEY2);
    if (!second) return null;
    var asciiStr = "";
    for (var i = 0; i < second.length; i++) asciiStr += String.fromCharCode(second[i]);
    return decodeBase64(asciiStr);
  }

  function deriveKey(rawKey) {
    var keyMaterial = rawKey;
    if (bytesStartsWith(keyMaterial, ENCV2_PREFIX)) {
      keyMaterial = decryptEncV2(keyMaterial);
    }
    if (!keyMaterial || keyMaterial.length < 24 || (keyMaterial.length - 8) % 8 !== 0) return null;

    var simpleKey = simpleMakeKey(106, 8);
    var teaKey = new Uint8Array(16);
    for (var i = 0; i < 8; i++) {
      teaKey[i * 2] = simpleKey[i];
      teaKey[i * 2 + 1] = keyMaterial[i];
    }
    var remainder = decryptTencentTea(keyMaterial.subarray(8), teaKey);
    if (!remainder) return null;
    var result = new Uint8Array(8 + remainder.length);
    result.set(keyMaterial.subarray(0, 8), 0);
    result.set(remainder, 8);
    return result;
  }

  // ---- Cipher 1: QMCv1 static (256-byte fixed table) ----------------------

  function StaticCipher() {}
  StaticCipher.prototype.mask = function (offset) {
    var off = offset > 0x7fff ? (offset % 0x7fff) : offset;
    return QMC_STATIC_BOX[(off * off + 27) & 0xff];
  };
  StaticCipher.prototype.decrypt = function (buffer, offset) {
    for (var i = 0; i < buffer.length; i++) buffer[i] ^= this.mask(offset + i);
  };

  // ---- Cipher 2: MapCipher (short keys, <= 300 bytes) ---------------------

  function MapCipher(key) {
    this.key = key;
    this.length = key.length;
  }
  MapCipher.prototype.mask = function (offset) {
    var normalized = offset;
    if (normalized > 0x7fff) normalized = normalized % 0x7fff;
    var index = (normalized * normalized + 71214) % this.length;
    var shift = ((index & 0x07) + 4) % 8;
    var value = this.key[index];
    return ((value << shift) | (value >>> shift)) & 0xff;
  };
  MapCipher.prototype.decrypt = function (buffer, offset) {
    for (var i = 0; i < buffer.length; i++) buffer[i] ^= this.mask(offset + i);
  };

  // ---- Cipher 3: RC4Cipher (long keys, > 300 bytes) -----------------------

  var RC4_SEGMENT_SIZE = 5120;
  var RC4_FIRST_SEGMENT_SIZE = 128;

  function RC4Cipher(key) {
    this.key = key;
    this.length = key.length;
    this.box = new Array(this.length);
    for (var i = 0; i < this.length; i++) this.box[i] = i & 0xff;
    var j = 0;
    for (var k = 0; k < this.length; k++) {
      j = (j + this.box[k] + key[k]) % this.length;
      var tmp = this.box[k];
      this.box[k] = this.box[j];
      this.box[j] = tmp;
    }
    this.hash = this._computeHash();
  }
  RC4Cipher.prototype._computeHash = function () {
    var hash = 1;
    for (var i = 0; i < this.key.length; i++) {
      var value = this.key[i];
      if (value === 0) continue;
      var next = Math.imul(hash, value) >>> 0;
      if (next === 0 || next <= hash) break;
      hash = next;
    }
    return hash;
  };
  RC4Cipher.prototype.segmentSkip = function (id) {
    var seed = this.key[id % this.length];
    if (seed === 0) return 0;
    return Math.trunc((this.hash / ((id + 1) * seed)) * 100) % this.length;
  };
  RC4Cipher.prototype.decrypt = function (buffer, offset) {
    var remaining = buffer.length;
    var processed = 0;
    var streamOffset = offset;

    if (streamOffset < RC4_FIRST_SEGMENT_SIZE) {
      var blockSize = Math.min(remaining, RC4_FIRST_SEGMENT_SIZE - streamOffset);
      for (var i = 0; i < blockSize; i++) {
        buffer[processed + i] ^= this.key[this.segmentSkip(streamOffset + i)];
      }
      processed += blockSize;
      streamOffset += blockSize;
      remaining -= blockSize;
    }

    if (remaining > 0 && streamOffset % RC4_SEGMENT_SIZE !== 0) {
      var blockSize2 = Math.min(remaining, RC4_SEGMENT_SIZE - (streamOffset % RC4_SEGMENT_SIZE));
      this._decryptSegment(buffer, processed, blockSize2, streamOffset);
      processed += blockSize2;
      streamOffset += blockSize2;
      remaining -= blockSize2;
    }

    while (remaining > RC4_SEGMENT_SIZE) {
      this._decryptSegment(buffer, processed, RC4_SEGMENT_SIZE, streamOffset);
      processed += RC4_SEGMENT_SIZE;
      streamOffset += RC4_SEGMENT_SIZE;
      remaining -= RC4_SEGMENT_SIZE;
    }
    if (remaining > 0) {
      this._decryptSegment(buffer, processed, remaining, streamOffset);
    }
  };
  RC4Cipher.prototype._decryptSegment = function (buffer, bufferOffset, length, streamOffset) {
    var box = this.box.slice();
    var j = 0;
    var k = 0;
    var skipLength = (streamOffset % RC4_SEGMENT_SIZE) +
      this.segmentSkip(Math.trunc(streamOffset / RC4_SEGMENT_SIZE));
    for (var i = -skipLength; i < length; i++) {
      j = (j + 1) % this.length;
      k = (box[j] + k) % this.length;
      var tmp = box[j];
      box[j] = box[k];
      box[k] = tmp;
      if (i >= 0) buffer[bufferOffset + i] ^= box[(box[j] + box[k]) % this.length];
    }
  };

  function createCipherFromDerivedKey(key) {
    if (!key.length) throw new Error("解密密钥为空");
    return key.length > 300 ? new RC4Cipher(key) : new MapCipher(key);
  }

  // ---- Audio sniffing -----------------------------------------------------

  function sniffAudio(buffer) {
    var b = new Uint8Array(buffer);
    if (b.length >= 4 && b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) return ".flac"; // fLaC
    if (b.length >= 4 && b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return ".ogg";  // OggS
    if (b.length >= 3 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return ".mp3";                       // ID3
    if (b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return ".mp3";
    if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return ".m4a";     // ftyp
    if (b.length >= 4 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return ".wav";
    if (b.length >= 4 && b[0] === 0x4d && b[1] === 0x41 && b[2] === 0x43 && b[3] === 0x20) return ".ape";     // "MAC "
    return null;
  }

  // ---- Embedded cover extraction (FLAC / ID3 / MP4 / OGG) -----------------

  function detectImageMime(bytes) {
    if (!bytes || bytes.length < 4) return "image/jpeg";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
        bytes.length > 11 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
    return "image/jpeg";
  }

  function sliceBuffer(bytes, start, end) {
    var sub = bytes.subarray(start, end);
    var out = new Uint8Array(sub.length);
    out.set(sub);
    return out.buffer;
  }

  function extractFlacPicture(data) {
    if (data.length < 8 || data[0] !== 0x66 || data[1] !== 0x4c) return null;
    var pos = 4;
    while (pos + 4 <= data.length) {
      var type = data[pos] & 0x7f;
      var len = (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3];
      pos += 4;
      if (type === 6 && pos + 8 <= data.length) {
        var mimeLen = readUint32BE(data, pos + 4);
        if (pos + 8 + mimeLen + 4 > data.length) return null;
        var mimeStart = pos + 8;
        var descLenPos = mimeStart + mimeLen;
        var descLen = readUint32BE(data, descLenPos);
        var fixedStart = descLenPos + 4 + descLen;
        if (fixedStart + 20 > data.length) return null;
        var dataLen = readUint32BE(data, fixedStart + 16);
        var dataStart = fixedStart + 20;
        if (dataLen <= 0 || dataStart + dataLen > data.length) return null;
        var pic = data.subarray(dataStart, dataStart + dataLen);
        var mime = "";
        for (var i = 0; i < mimeLen && mimeStart + i < data.length; i++) mime += String.fromCharCode(data[mimeStart + i]);
        return { picture: sliceBuffer(data, dataStart, dataStart + dataLen), pictureMime: mime || detectImageMime(pic) };
      }
      pos += len;
      if (pos >= data.length || len <= 0) break;
    }
    return null;
  }

  function syncsafeToInt(data, offset) {
    return ((data[offset] & 0x7f) << 21) | ((data[offset + 1] & 0x7f) << 14) |
      ((data[offset + 2] & 0x7f) << 7) | (data[offset + 3] & 0x7f);
  }

  function extractId3Picture(data) {
    if (data.length < 10 || data[0] !== 0x49 || data[1] !== 0x44 || data[2] !== 0x33) return null;
    var totalSize = syncsafeToInt(data, 6);
    var pos = 10;
    var end = Math.min(pos + totalSize, data.length);
    while (pos + 10 <= end) {
      var id = String.fromCharCode(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
      var frameSize = (data[pos + 4] << 24) | (data[pos + 5] << 16) | (data[pos + 6] << 8) | data[pos + 7];
      pos += 10;
      if (frameSize <= 0 || pos + frameSize > end) break;
      if (id === "APIC") {
        var mimeStart = pos + 1;
        var mimeEnd = mimeStart;
        while (mimeEnd < pos + frameSize && data[mimeEnd] !== 0) mimeEnd++;
        if (mimeEnd >= pos + frameSize) break;
        var mime = "";
        for (var i = mimeStart; i < mimeEnd; i++) mime += String.fromCharCode(data[i]);
        var descStart = mimeEnd + 2;
        var descEnd = descStart;
        while (descEnd + 1 < pos + frameSize && !(data[descEnd] === 0 && data[descEnd + 1] === 0) && data[descEnd] !== 0) descEnd++;
        var dataStart = descEnd;
        if (data[dataStart] === 0) dataStart++;
        if (dataStart < pos + frameSize && data[dataStart] === 0) dataStart++;
        var picLen = pos + frameSize - dataStart;
        if (picLen <= 0) break;
        var pic = data.subarray(dataStart, dataStart + picLen);
        return { picture: sliceBuffer(data, dataStart, dataStart + picLen), pictureMime: mime || detectImageMime(pic) };
      }
      pos += frameSize;
    }
    return null;
  }

  function extractMp4Picture(data) {
    function findBox(buf, start, end, target) {
      var pos = start;
      while (pos + 8 <= end) {
        var size = readUint32BE(buf, pos);
        var type = String.fromCharCode(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]);
        if (size < 8) break;
        if (type === target) return { start: pos, size: size, dataStart: pos + 8, dataEnd: Math.min(pos + size, end) };
        pos += size;
      }
      return null;
    }
    var moov = findBox(data, 0, Math.min(data.length, 256 * 1024), "moov");
    if (!moov) return null;
    var udta = findBox(data, moov.dataStart, moov.dataEnd, "udta");
    var metaSearchStart = udta ? udta.dataStart : moov.dataStart;
    var metaSearchEnd = udta ? udta.dataEnd : moov.dataEnd;
    var meta = findBox(data, metaSearchStart, metaSearchEnd, "meta");
    var metaChildrenStart = meta ? meta.dataStart + 4 : metaSearchStart;
    var metaChildrenEnd = meta ? meta.dataEnd : metaSearchEnd;
    var ilst = findBox(data, metaChildrenStart, metaChildrenEnd, "ilst");
    if (!ilst) return null;
    var covr = findBox(data, ilst.dataStart, ilst.dataEnd, "covr");
    if (!covr) return null;
    var dataAtom = findBox(data, covr.dataStart, covr.dataEnd, "data");
    if (!dataAtom) return null;
    var payloadStart = dataAtom.dataStart + 8;
    if (payloadStart >= dataAtom.dataEnd) return null;
    var pic = data.subarray(payloadStart, dataAtom.dataEnd);
    return { picture: sliceBuffer(data, payloadStart, dataAtom.dataEnd), pictureMime: detectImageMime(pic) };
  }

  // OGG/Vorbis cover lives inside a VorbisComment field — base64-encoded
  // either as METADATA_BLOCK_PICTURE (preferred) or COVERART (legacy).
  // Scan only the first ~1MB of the file to bound the work.
  function extractOggPicture(data) {
    if (data.length < 4 || data[0] !== 0x4f || data[1] !== 0x67 || data[2] !== 0x67 || data[3] !== 0x53) return null;
    var scanLimit = Math.min(data.length, 1024 * 1024);
    var window = decodeUtf8(data.subarray(0, scanLimit));
    var match = window.match(/METADATA_BLOCK_PICTURE=([A-Za-z0-9+/=]+)/i);
    if (match) {
      var rawBlock = decodeBase64(match[1]);
      if (rawBlock && rawBlock.length > 32) {
        var mimeLen = readUint32BE(rawBlock, 4);
        if (8 + mimeLen + 4 + 4 + 16 + 4 < rawBlock.length) {
          var descLen = readUint32BE(rawBlock, 8 + mimeLen);
          var fixedStart = 8 + mimeLen + 4 + descLen;
          if (fixedStart + 20 <= rawBlock.length) {
            var dataLen = readUint32BE(rawBlock, fixedStart + 16);
            var dataStart = fixedStart + 20;
            if (dataLen > 0 && dataStart + dataLen <= rawBlock.length) {
              var picMimeStr = "";
              for (var i = 0; i < mimeLen; i++) picMimeStr += String.fromCharCode(rawBlock[8 + i]);
              var picBytes = rawBlock.subarray(dataStart, dataStart + dataLen);
              return { picture: sliceBuffer(picBytes, 0, picBytes.length), pictureMime: picMimeStr || detectImageMime(picBytes) };
            }
          }
        }
      }
    }
    match = window.match(/COVERART=([A-Za-z0-9+/=]+)/i);
    if (match) {
      var pic = decodeBase64(match[1]);
      if (pic) return { picture: sliceBuffer(pic, 0, pic.length), pictureMime: detectImageMime(pic) };
    }
    return null;
  }

  function extractEmbeddedCover(arrayBuffer, ext) {
    try {
      var data = new Uint8Array(arrayBuffer);
      var lower = String(ext || "").toLowerCase();
      if (lower === ".flac") return extractFlacPicture(data);
      if (lower === ".mp3") return extractId3Picture(data);
      if (lower === ".m4a") return extractMp4Picture(data);
      if (lower === ".ogg") return extractOggPicture(data);
      // Sniff by magic when ext is not provided.
      if (data.length >= 4 && data[0] === 0x66 && data[1] === 0x4c && data[2] === 0x61 && data[3] === 0x43) return extractFlacPicture(data);
      if (data.length >= 4 && data[0] === 0x4f && data[1] === 0x67 && data[2] === 0x67 && data[3] === 0x53) return extractOggPicture(data);
      if (data.length >= 3 && data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) return extractId3Picture(data);
      if (data.length >= 8 && data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) return extractMp4Picture(data);
      return null;
    } catch (_error) {
      return null;
    }
  }

  // ---- EKey text parsing ---------------------------------------------------

  function utf8ToBytes(str) {
    var text = String(str || "");
    var bytes = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
    return bytes;
  }

  function parseEkeyText(ekey) {
    if (!ekey) return null;
    if (typeof ekey !== "string") {
      return ekey instanceof Uint8Array && ekey.length ? ekey : null;
    }
    var text = String(ekey).replace(/^\s+|\s+$/g, "");
    if (!text) return null;
    if (text.startsWith(ENCV2_PREFIX_STR)) return utf8ToBytes(text);
    var standard = decodeBase64(text);
    if (standard) return standard;
    var reencoded = text.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    var pad = reencoded.length % 4;
    if (pad === 2) reencoded += "==";
    else if (pad === 3) reencoded += "=";
    else if (pad === 1) return null;
    return decodeBase64(reencoded);
  }

  // ---- Streaming-decrypt helper -------------------------------------------

  function decryptInChunks(audioData, cipher) {
    var CHUNK = 51200;
    for (var offset = 0; offset < audioData.length; offset += CHUNK) {
      var end = Math.min(offset + CHUNK, audioData.length);
      var chunk = audioData.subarray(offset, end);
      cipher.decrypt(chunk, offset);
    }
  }

  // For the second decrypt pass, build a fresh cipher so RC4's internal state
  // doesn't leak across the preview/full-decrypt boundary.
  function freshCipher(format, derivedKey) {
    if (format === "v1-static") return new StaticCipher();
    return derivedKey.length > 300 ? new RC4Cipher(derivedKey) : new MapCipher(derivedKey);
  }

  // ---- Main decrypt --------------------------------------------------------

  function decryptAudioFile(arrayBuffer, externalEKey) {
    var tail = parseFileTail(arrayBuffer);
    if (!tail) {
      throw new Error("无法识别 QQ 音乐加密文件，请确认文件未被截断或修改");
    }

    var data = new Uint8Array(arrayBuffer);
    var audioData = new Uint8Array(tail.audioSize);
    audioData.set(data.subarray(0, tail.audioSize));

    // Choose the cipher based on the parsed format.
    var derivedKey = null;
    var cipher;
    if (tail.format === "v1-static") {
      cipher = new StaticCipher();
    } else if (tail.format === "v1-keyed") {
      derivedKey = deriveKey(tail.embeddedKey);
      if (!derivedKey) throw new Error("无法从内嵌密钥派生解密密钥");
      cipher = createCipherFromDerivedKey(derivedKey);
    } else {
      // musicex / qtag / stag — all need an EKey + key derivation.
      var ekeyText = (tail.format === "musicex") ? (externalEKey || tail.ekey) : (tail.ekey || externalEKey);
      if (!ekeyText) {
        throw new Error("此文件没有内嵌 EKey，需要先导入 QQ 音乐 Cookie 才能从服务器获取 EKey");
      }
      var rawKey = parseEkeyText(ekeyText);
      if (!rawKey) throw new Error("EKey 编码无效");
      derivedKey = deriveKey(rawKey);
      if (!derivedKey) throw new Error("无法从 EKey 生成解密密钥");
      cipher = createCipherFromDerivedKey(derivedKey);
    }

    // Sniff the audio format from the first 16 decrypted bytes.
    var preview = new Uint8Array(Math.min(16, audioData.length));
    preview.set(audioData.subarray(0, preview.length));
    cipher.decrypt(preview, 0);
    var ext = sniffAudio(preview.buffer);
    if (!ext) {
      if (tail.format === "v1-static") {
        throw new Error("文件可能不是 QQ 音乐 QMCv1 静态密钥格式，或文件已损坏");
      }
      throw new Error("密钥解密后的文件头仍不是有效音频，请确认 QQ 音乐账号拥有该歌曲权限");
    }

    // Full decrypt with a fresh cipher (RC4 needs a clean state).
    decryptInChunks(audioData, freshCipher(tail.format, derivedKey || new Uint8Array()));

    // Best-effort embedded cover extraction.
    var embedded = extractEmbeddedCover(audioData.buffer, ext);

    return {
      audio: audioData.buffer,
      ext: ext,
      songMid: tail.songMid,
      filename: tail.filename,
      picture: embedded ? embedded.picture : null,
      pictureMime: embedded ? embedded.pictureMime : "",
      format: tail.format,
    };
  }

  // ---- Export --------------------------------------------------------------

  root.ClaudeOneQQDecrypt = {
    decrypt: decryptAudioFile,
    parseFileTail: parseFileTail,
    extractEmbeddedCover: extractEmbeddedCover,
  };

})(typeof self !== "undefined" ? self : this);
