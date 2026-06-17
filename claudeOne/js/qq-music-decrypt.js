/*
 * QQ Music musicex/QMC2 browser-side decryption.
 *
 * Ported from server/qq-music-unlock.js — all algorithms are pure math,
 * no Node.js APIs. Runs entirely in the browser (main thread or Web Worker).
 *
 * Adapted from qmdec: https://github.com/Sophomoresty/qmdec (MIT)
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

  // ---- Utilities -----------------------------------------------------------

  function bytesEqual(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function bytesStartsWith(a, prefix) {
    if (a.length < prefix.length) return false;
    for (var i = 0; i < prefix.length; i++) {
      if (a[i] !== prefix[i]) return false;
    }
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

  // ---- Base64 decode -------------------------------------------------------

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

    // Check musicex magic (last 8 bytes)
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
        ekey: null,
      };
    }

    // Check QTag / STag (last 4 bytes)
    var tail4 = String.fromCharCode(tail8[4], tail8[5], tail8[6], tail8[7]);
    if (tail4 !== QTAG_MAGIC_STR && tail4 !== STAG_MAGIC_STR) return null;

    var ekeyLength = readUint32LE(data, 0); // first 4 bytes of the 8-byte tail area = at fileSize-8
    // Actually the 8 bytes are: [ekeyLength(4)][magic(4)], so ekeyLength is at fileSize-8
    ekeyLength = readUint32LE(data, fileSize - 8);
    var audioEnd = fileSize - 8 - ekeyLength;
    if (ekeyLength <= 0 || ekeyLength > 4096 || audioEnd <= 0) return null;
    var ekeyData = data.subarray(audioEnd, audioEnd + ekeyLength);
    var ekeyText = new TextDecoder().decode(ekeyData);

    var songMid = "";
    var ekey = "";
    if (tail4 === QTAG_MAGIC_STR) {
      var commaIdx = ekeyText.indexOf(",");
      if (commaIdx >= 0) {
        songMid = ekeyText.substring(0, commaIdx).trim();
        ekey = ekeyText.substring(commaIdx + 1).trim();
      } else {
        songMid = ekeyText.trim();
      }
    } else {
      ekey = ekeyText.trim();
    }
    return { format: "legacy", songMid: songMid, filename: "", audioSize: audioEnd, ekey: ekey };
  }

  // ---- Tencent TEA decryption ----------------------------------------------

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
      if (destIndex < 8) {
        destIndex++;
        skipped++;
      } else if (!decryptNextBlock()) {
        return null;
      }
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

  // ---- MapCipher (short keys, <= 300 bytes) --------------------------------

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
    for (var i = 0; i < buffer.length; i++) {
      buffer[i] ^= this.mask(offset + i);
    }
  };

  // ---- RC4Cipher (long keys, > 300 bytes) ----------------------------------

  var RC4_SEGMENT_SIZE = 5120;
  var RC4_FIRST_SEGMENT_SIZE = 128;

  function RC4Cipher(key) {
    this.key = key;
    this.length = key.length;
    this.box = new Array(this.length);
    for (var i = 0; i < this.length; i++) this.box[i] = i & 0xff;
    var j = 0;
    for (var i = 0; i < this.length; i++) {
      j = (j + this.box[i] + key[i]) % this.length;
      var tmp = this.box[i];
      this.box[i] = this.box[j];
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

  // ---- Cipher selection & audio sniffing -----------------------------------

  function createCipher(key) {
    if (!key.length) throw new Error("解密密钥为空");
    return key.length > 300 ? new RC4Cipher(key) : new MapCipher(key);
  }

  function sniffAudio(buffer) {
    var b = new Uint8Array(buffer);
    if (b.length >= 4 && b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) return ".flac"; // fLaC
    if (b.length >= 4 && b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return ".ogg";  // OggS
    if (b.length >= 3 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return ".mp3";                       // ID3
    if (b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return ".mp3";
    if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return ".m4a";     // ftyp
    return null;
  }

  // ---- Embedded cover extraction -------------------------------------------
  //
  // QQ Music decryption produces a raw audio file that usually still carries
  // its own cover picture (FLAC PICTURE block, ID3 APIC frame, or MP4 covr).
  // When the server-side metadata lookup fails or returns the wrong song,
  // this embedded picture is the most reliable fallback for the card cover.
  // We scan only the leading chunk of the file (covers live near the start).

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
    // Return a standalone ArrayBuffer copy so callers can wrap it in a Blob.
    var sub = bytes.subarray(start, end);
    var out = new Uint8Array(sub.length);
    out.set(sub);
    return out.buffer;
  }

  function extractFlacPicture(data) {
    // FLAC: "fLaC" then metadata blocks. Block header: 1 byte (last-flag<<7 | type),
    // 3 bytes big-endian length. Type 6 = PICTURE. Picture block body layout:
    //   [pictureType(4)][mimeLen(4)][mime][descLen(4)][desc][width(4)][height(4)]
    //   [colorDepth(4)][indexedColors(4)][dataLen(4)][data]
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
        var fixedStart = descLenPos + 4 + descLen; // start of width(4)height(4)colorDepth(4)indexedColors(4)dataLen(4)
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
      // Stop if we've passed the end of the metadata blocks (the "last" flag
      // is set on the final metadata block; audio frames follow). We don't
      // strictly need the flag since covers live in early metadata blocks, but
      // bail out on malformed/oversized lengths to avoid runaway scans.
      if (pos >= data.length || len <= 0) break;
    }
    return null;
  }

  function syncsafeToInt(data, offset) {
    return ((data[offset] & 0x7f) << 21) | ((data[offset + 1] & 0x7f) << 14) |
      ((data[offset + 2] & 0x7f) << 7) | (data[offset + 3] & 0x7f);
  }

  function extractId3Picture(data) {
    // ID3v2: "ID3" + version(2) + flags(1) + size(4 syncsafe). Frames: id(4) +
    // size(4) + flags(2) + data. APIC frame: [encoding(1)][mime\0][picType(1)][desc...][\0][data]
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
        // encoding(1), then mime string until \0
        var mimeStart = pos + 1;
        var mimeEnd = mimeStart;
        while (mimeEnd < pos + frameSize && data[mimeEnd] !== 0) mimeEnd++;
        if (mimeEnd >= pos + frameSize) break;
        var mime = "";
        for (var i = mimeStart; i < mimeEnd; i++) mime += String.fromCharCode(data[i]);
        var picType = data[mimeEnd + 1];
        // description: encoding-dependent, terminated by \0 (for latin/utf-16)
        var descStart = mimeEnd + 2;
        var descEnd = descStart;
        // Skip the description (find next \0\0 for utf-16 or \0 for latin/utf-8).
        while (descEnd + 1 < pos + frameSize && !(data[descEnd] === 0 && data[descEnd + 1] === 0) && data[descEnd] !== 0) descEnd++;
        // Move past the terminator(s).
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
    // MP4/M4A: "ftyp" box near start, then nested boxes. Cover is in
    // moov/udta/meta/ilst/covr. We scan the top-level + one level of moov for
    // an "ilst" box, then look for a "covr" atom inside it.
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
    // MP4 "meta" box is special: it has a 4-byte version/flags field before its children.
    var metaChildrenStart = meta ? meta.dataStart + 4 : metaSearchStart;
    var metaChildrenEnd = meta ? meta.dataEnd : metaSearchEnd;
    var ilst = findBox(data, metaChildrenStart, metaChildrenEnd, "ilst");
    if (!ilst) return null;
    var covr = findBox(data, ilst.dataStart, ilst.dataEnd, "covr");
    if (!covr) return null;
    // Inside covr: a "data" atom: [size(4)]"data"[flags(4)][4 zero bytes][payload]
    var dataAtom = findBox(data, covr.dataStart, covr.dataEnd, "data");
    if (!dataAtom) return null;
    var payloadStart = dataAtom.dataStart + 8; // skip 4-byte flags + 4 reserved
    if (payloadStart >= dataAtom.dataEnd) return null;
    var pic = data.subarray(payloadStart, dataAtom.dataEnd);
    return { picture: sliceBuffer(data, payloadStart, dataAtom.dataEnd), pictureMime: detectImageMime(pic) };
  }

  function extractEmbeddedCover(arrayBuffer, ext) {
    try {
      var data = new Uint8Array(arrayBuffer);
      var lower = String(ext || "").toLowerCase();
      var result = null;
      if (lower === ".flac") result = extractFlacPicture(data);
      else if (lower === ".mp3") result = extractId3Picture(data);
      else if (lower === ".m4a") result = extractMp4Picture(data);
      else {
        // Sniff by magic and try the matching extractor.
        if (data.length >= 4 && data[0] === 0x66 && data[1] === 0x4c && data[2] === 0x61 && data[3] === 0x43) result = extractFlacPicture(data);
        else if (data.length >= 3 && data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) result = extractId3Picture(data);
        else if (data.length >= 8 && data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) result = extractMp4Picture(data);
      }
      return result;
    } catch (_error) {
      return null;
    }
  }

  // ---- EKey parsing --------------------------------------------------------
  //
  // An EKey from the QQ Music API (or embedded in a QTag/STag tail) can be one
  // of three textual shapes:
  //   1. EncV2:  "QQMusic EncV2,Key:<base64>"  — the leading prefix is literal
  //      ASCII, the remainder is standard base64 of the encrypted key blob.
  //   2. Legacy base64 / URL-safe base64 of the raw key blob directly.
  //   3. Already-decoded raw bytes (passed in as a Uint8Array).
  //
  // We need to return the RAW key bytes (still including the EncV2 prefix bytes
  // when present) so that deriveKey() can detect the prefix and apply the two
  // TEA passes. decodeBase64() alone is not enough: it rejects any string that
  // contains the literal "QQMusic EncV2,Key:" prefix because of the comma/colon.

  function utf8ToBytes(str) {
    var text = String(str || "");
    var bytes = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
    return bytes;
  }

  function parseEkeyText(ekey) {
    if (!ekey) return null;
    // Already raw bytes.
    if (typeof ekey !== "string") {
      return ekey instanceof Uint8Array && ekey.length ? ekey : null;
    }
    // Only trim leading/trailing whitespace. Do NOT strip internal spaces: the
    // EncV2 prefix ("QQMusic EncV2,Key:") contains a literal space.
    var text = String(ekey).replace(/^\s+|\s+$/g, "");
    if (!text) return null;

    // EncV2: keep the full literal prefix + base64 payload as raw ASCII bytes.
    // deriveKey() checks for the EncV2 prefix and runs the two TEA passes.
    if (text.startsWith(ENCV2_PREFIX_STR)) {
      return utf8ToBytes(text);
    }

    // Standard base64 (ignore any internal whitespace here).
    var standard = decodeBase64(text);
    if (standard) return standard;

    // URL-safe base64 (replace -/+ and _ with + and /), then pad.
    var reencoded = text.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    var pad = reencoded.length % 4;
    if (pad === 2) reencoded += "==";
    else if (pad === 3) reencoded += "=";
    else if (pad === 1) return null; // malformed base64
    return decodeBase64(reencoded);
  }

  // ---- Main decrypt function -----------------------------------------------

  function decryptAudioFile(arrayBuffer, ekey) {
    // 1. Parse file tail
    var tail = parseFileTail(arrayBuffer);
    if (!tail) {
      throw new Error("没有识别到 musicex、QTag 或 STag 文件尾部，请使用原始 QQ 音乐加密文件");
    }

    // 2. Get raw key bytes
    //    - Legacy QTag/STag files embed the EKey in the tail (tail.ekey).
    //    - musicex files do NOT embed it; the caller must supply the EKey
    //      fetched from the QQ Music API using the logged-in account.
    var rawKey = parseEkeyText(tail.ekey || ekey);
    if (!rawKey) {
      if (!tail.ekey && !ekey) {
        throw new Error("此文件没有内嵌 EKey，需要先导入 QQ 音乐 Cookie 才能从服务器获取 EKey");
      }
      throw new Error("EKey 编码无效");
    }

    // 3. Derive key
    var key = deriveKey(rawKey);
    if (!key) throw new Error("无法从 EKey 生成解密密钥");

    // 4. Create cipher & sniff audio format
    var cipher = createCipher(key);
    var data = new Uint8Array(arrayBuffer);
    var previewLength = Math.min(16, tail.audioSize);
    var preview = new Uint8Array(previewLength);
    preview.set(data.subarray(0, previewLength));
    cipher.decrypt(preview, 0);

    var ext = sniffAudio(preview.buffer);
    if (!ext) {
      throw new Error("密钥解密后的文件头仍不是有效音频，请确认 QQ 音乐账号拥有该歌曲权限");
    }

    // 5. Decrypt full audio
    var audioData = new Uint8Array(tail.audioSize);
    audioData.set(data.subarray(0, tail.audioSize));
    var fullCipher = createCipher(key);
    // Decrypt in chunks to avoid blocking too long on huge files
    var CHUNK = 51200; // 50KB chunks
    for (var offset = 0; offset < tail.audioSize; offset += CHUNK) {
      var end = Math.min(offset + CHUNK, tail.audioSize);
      var chunk = audioData.subarray(offset, end);
      fullCipher.decrypt(chunk, offset);
    }

    // 6. Extract embedded cover (fallback for when server metadata/cover fails
    //    or returns the wrong song). QQ Music FLAC/MP3/M4A files carry their
    //    own cover picture near the start of the audio.
    var embedded = extractEmbeddedCover(audioData.buffer, ext);

    return {
      audio: audioData.buffer,
      ext: ext,
      songMid: tail.songMid,
      filename: tail.filename,
      picture: embedded ? embedded.picture : null,
      pictureMime: embedded ? embedded.pictureMime : "",
    };
  }

  // ---- Export ---------------------------------------------------------------

  root.ClaudeOneQQDecrypt = {
    decrypt: decryptAudioFile,
    parseFileTail: parseFileTail,
    extractEmbeddedCover: extractEmbeddedCover,
  };

})(typeof self !== "undefined" ? self : this);
