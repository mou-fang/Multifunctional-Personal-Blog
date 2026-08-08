/* ===== claudeOne :: image-scramble-core.js =====
 * PixelFlux reversible image obfuscation core.
 *
 * The format deliberately produces a regular, lossless PNG. A private tEXt
 * record stores the random seed and checksum required to restore the pixels.
 * This is visual obfuscation, not password-based cryptographic encryption.
 */

(function initPixelFlux(global) {
  "use strict";

  var MAGIC = "CLAUDEONE_PIXELFLUX";
  var VERSION = 1;
  var TEXT_KEY = "claudeOne.PixelFlux";
  var PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  var CRC_TABLE = null;

  function asBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    throw new TypeError("Expected an ArrayBuffer or typed array");
  }

  function concatBytes(parts) {
    var total = 0;
    var i;
    for (i = 0; i < parts.length; i++) total += parts[i].length;
    var out = new Uint8Array(total);
    var offset = 0;
    for (i = 0; i < parts.length; i++) {
      out.set(parts[i], offset);
      offset += parts[i].length;
    }
    return out;
  }

  function writeU32(target, offset, value) {
    value = value >>> 0;
    target[offset] = value >>> 24;
    target[offset + 1] = value >>> 16;
    target[offset + 2] = value >>> 8;
    target[offset + 3] = value;
  }

  function readU32(bytes, offset) {
    return (
      bytes[offset] * 0x1000000 +
      (bytes[offset + 1] << 16) +
      (bytes[offset + 2] << 8) +
      bytes[offset + 3]
    ) >>> 0;
  }

  function getCrcTable() {
    if (CRC_TABLE) return CRC_TABLE;
    CRC_TABLE = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      CRC_TABLE[n] = c >>> 0;
    }
    return CRC_TABLE;
  }

  function crc32(value, start, end) {
    var bytes = asBytes(value);
    var table = getCrcTable();
    var from = start == null ? 0 : start;
    var to = end == null ? bytes.length : end;
    var crc = 0xffffffff;
    for (var i = from; i < to; i++) {
      crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function checksumHex(value) {
    return crc32(value).toString(16).padStart(8, "0");
  }

  function rotl(value, shift) {
    return ((value << shift) | (value >>> (32 - shift))) >>> 0;
  }

  function createRng(words) {
    var s0 = words[0] >>> 0;
    var s1 = words[1] >>> 0;
    var s2 = words[2] >>> 0;
    var s3 = words[3] >>> 0;
    if ((s0 | s1 | s2 | s3) === 0) s3 = 0x9e3779b9;

    return function nextUint32() {
      var result = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
      var t = (s1 << 9) >>> 0;
      s2 = (s2 ^ s0) >>> 0;
      s3 = (s3 ^ s1) >>> 0;
      s1 = (s1 ^ s2) >>> 0;
      s0 = (s0 ^ s3) >>> 0;
      s2 = (s2 ^ t) >>> 0;
      s3 = rotl(s3, 11);
      return result;
    };
  }

  function parseSeed(seedHex) {
    if (typeof seedHex !== "string" || !/^[0-9a-f]{32}$/i.test(seedHex)) {
      throw new Error("PixelFlux seed must be 32 hexadecimal characters");
    }
    return [
      parseInt(seedHex.slice(0, 8), 16) >>> 0,
      parseInt(seedHex.slice(8, 16), 16) >>> 0,
      parseInt(seedHex.slice(16, 24), 16) >>> 0,
      parseInt(seedHex.slice(24, 32), 16) >>> 0,
    ];
  }

  function seedToHex(words) {
    return words.map(function (word) {
      return (word >>> 0).toString(16).padStart(8, "0");
    }).join("");
  }

  function randomSeedHex() {
    if (!global.crypto || typeof global.crypto.getRandomValues !== "function") {
      throw new Error("Secure random generation is unavailable in this browser");
    }
    var words = new Uint32Array(4);
    global.crypto.getRandomValues(words);
    return seedToHex(Array.prototype.slice.call(words));
  }

  function gcd(a, b) {
    while (b) {
      var next = a % b;
      a = b;
      b = next;
    }
    return Math.abs(a);
  }

  function derivePermutation(width, height, seedHex) {
    var count = width * height;
    if (count <= 1) return { multiplier: 0, offset: 0, count: count };

    var seed = parseSeed(seedHex);
    var positionRng = createRng([
      (seed[0] ^ 0x243f6a88) >>> 0,
      (seed[1] ^ 0x85a308d3) >>> 0,
      (seed[2] ^ width ^ 0x13198a2e) >>> 0,
      (seed[3] ^ height ^ 0x03707344) >>> 0,
    ]);
    var multiplier = positionRng() % count;
    if (multiplier === 0) multiplier = 1;
    while (gcd(multiplier, count) !== 1) {
      multiplier++;
      if (multiplier >= count) multiplier = 1;
    }
    var offset = positionRng() % count;
    return { multiplier: multiplier, offset: offset, count: count };
  }

  function validatePixelInput(input, width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      throw new Error("Invalid image dimensions");
    }
    var expected = width * height * 4;
    if (!Number.isSafeInteger(expected) || expected !== input.length) {
      throw new Error("RGBA buffer length does not match image dimensions");
    }
  }

  function transformRgba(inputValue, width, height, seedHex, direction, onProgress) {
    var input = asBytes(inputValue);
    validatePixelInput(input, width, height);
    if (direction !== "scramble" && direction !== "restore") {
      throw new Error("PixelFlux transform direction is invalid");
    }

    var seed = parseSeed(seedHex);
    var permutation = derivePermutation(width, height, seedHex);
    var maskRng = createRng([
      (seed[0] ^ 0xa4093822) >>> 0,
      (seed[1] ^ 0x299f31d0) >>> 0,
      (seed[2] ^ 0x082efa98) >>> 0,
      (seed[3] ^ 0xec4e6c89) >>> 0,
    ]);
    var output = new Uint8Array(input.length);
    var count = permutation.count;
    var destination = permutation.offset;
    var reportEvery = Math.max(1, Math.floor(count / 20));

    for (var i = 0; i < count; i++) {
      var sourceOffset = i * 4;
      var destinationOffset = destination * 4;
      var mask = maskRng();
      if (direction === "scramble") {
        output[destinationOffset] = input[sourceOffset] ^ (mask & 0xff);
        output[destinationOffset + 1] = input[sourceOffset + 1] ^ ((mask >>> 8) & 0xff);
        output[destinationOffset + 2] = input[sourceOffset + 2] ^ ((mask >>> 16) & 0xff);
        output[destinationOffset + 3] = input[sourceOffset + 3];
      } else {
        output[sourceOffset] = input[destinationOffset] ^ (mask & 0xff);
        output[sourceOffset + 1] = input[destinationOffset + 1] ^ ((mask >>> 8) & 0xff);
        output[sourceOffset + 2] = input[destinationOffset + 2] ^ ((mask >>> 16) & 0xff);
        output[sourceOffset + 3] = input[destinationOffset + 3];
      }

      destination += permutation.multiplier;
      if (destination >= count) destination -= count;
      if (onProgress && (i % reportEvery === 0 || i === count - 1)) {
        onProgress((i + 1) / count);
      }
    }
    return output;
  }

  function makeChunk(type, dataValue) {
    var data = asBytes(dataValue);
    var typeBytes = new Uint8Array(4);
    for (var i = 0; i < 4; i++) typeBytes[i] = type.charCodeAt(i);
    var chunk = new Uint8Array(12 + data.length);
    writeU32(chunk, 0, data.length);
    chunk.set(typeBytes, 4);
    chunk.set(data, 8);
    var crcInput = new Uint8Array(4 + data.length);
    crcInput.set(typeBytes, 0);
    crcInput.set(data, 4);
    writeU32(chunk, 8 + data.length, crc32(crcInput));
    return chunk;
  }

  function encodeMetadata(metadata) {
    var json = JSON.stringify(metadata);
    if (json.length > 8192) throw new Error("PixelFlux metadata is too large");
    var keyBytes = new TextEncoder().encode(TEXT_KEY);
    var jsonBytes = new TextEncoder().encode(json);
    var data = new Uint8Array(keyBytes.length + 1 + jsonBytes.length);
    data.set(keyBytes, 0);
    data[keyBytes.length] = 0;
    data.set(jsonBytes, keyBytes.length + 1);
    return data;
  }

  function adler32(value) {
    var bytes = asBytes(value);
    var a = 1;
    var b = 0;
    for (var i = 0; i < bytes.length; i++) {
      a += bytes[i];
      b += a;
      if ((i & 4095) === 4095) {
        a %= 65521;
        b %= 65521;
      }
    }
    a %= 65521;
    b %= 65521;
    return (((b << 16) | a) >>> 0);
  }

  function deflateStored(value) {
    var bytes = asBytes(value);
    var blockCount = Math.max(1, Math.ceil(bytes.length / 65535));
    var out = new Uint8Array(2 + bytes.length + blockCount * 5 + 4);
    var outPos = 0;
    var inPos = 0;
    out[outPos++] = 0x78;
    out[outPos++] = 0x01;
    for (var block = 0; block < blockCount; block++) {
      var remaining = bytes.length - inPos;
      var length = Math.min(65535, Math.max(0, remaining));
      var finalBlock = block === blockCount - 1;
      out[outPos++] = finalBlock ? 0x01 : 0x00;
      out[outPos++] = length & 0xff;
      out[outPos++] = (length >>> 8) & 0xff;
      var inverse = (~length) & 0xffff;
      out[outPos++] = inverse & 0xff;
      out[outPos++] = (inverse >>> 8) & 0xff;
      out.set(bytes.subarray(inPos, inPos + length), outPos);
      outPos += length;
      inPos += length;
    }
    writeU32(out, outPos, adler32(bytes));
    return out;
  }

  async function deflateNative(value) {
    if (typeof CompressionStream !== "function") return deflateStored(value);
    try {
      var stream = new Blob([asBytes(value)]).stream().pipeThrough(new CompressionStream("deflate"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (error) {
      return deflateStored(value);
    }
  }

  function inflateStored(value) {
    var bytes = asBytes(value);
    if (bytes.length < 6) throw new Error("Compressed PNG data is incomplete");
    var bitPosition = 16;
    var parts = [];
    var total = 0;
    var finalBlock = false;

    function readBits(count) {
      var result = 0;
      for (var bit = 0; bit < count; bit++) {
        var byteIndex = bitPosition >>> 3;
        if (byteIndex >= bytes.length - 4) throw new Error("Compressed PNG block is truncated");
        result |= ((bytes[byteIndex] >>> (bitPosition & 7)) & 1) << bit;
        bitPosition++;
      }
      return result;
    }

    while (!finalBlock) {
      finalBlock = readBits(1) === 1;
      var blockType = readBits(2);
      if (blockType !== 0) {
        throw new Error("This browser cannot decompress the PixelFlux PNG stream");
      }
      bitPosition = (bitPosition + 7) & ~7;
      var pos = bitPosition >>> 3;
      if (pos + 4 > bytes.length - 4) throw new Error("Compressed PNG block is truncated");
      var length = bytes[pos] | (bytes[pos + 1] << 8);
      var inverse = bytes[pos + 2] | (bytes[pos + 3] << 8);
      if ((((~length) & 0xffff) !== inverse) || pos + 4 + length > bytes.length - 4) {
        throw new Error("Compressed PNG block failed validation");
      }
      var part = bytes.slice(pos + 4, pos + 4 + length);
      parts.push(part);
      total += part.length;
      bitPosition = (pos + 4 + length) * 8;
    }

    var out = new Uint8Array(total);
    var offset = 0;
    for (var i = 0; i < parts.length; i++) {
      out.set(parts[i], offset);
      offset += parts[i].length;
    }
    return out;
  }

  async function inflate(value) {
    if (typeof DecompressionStream === "function") {
      try {
        var stream = new Blob([asBytes(value)]).stream().pipeThrough(new DecompressionStream("deflate"));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      } catch (error) {
        // PixelFlux's obfuscated output uses stored DEFLATE blocks, so a small
        // built-in decoder remains available if the native stream rejects it.
      }
    }
    return inflateStored(value);
  }

  function buildRawScanlines(rgbaValue, width, height) {
    var rgba = asBytes(rgbaValue);
    validatePixelInput(rgba, width, height);
    var stride = width * 4;
    var raw = new Uint8Array(height * (stride + 1));
    for (var y = 0; y < height; y++) {
      var rawOffset = y * (stride + 1);
      raw[rawOffset] = 0;
      raw.set(rgba.subarray(y * stride, (y + 1) * stride), rawOffset + 1);
    }
    return raw;
  }

  async function encodePngRgba(rgba, width, height, metadata, options) {
    options = options || {};
    var raw = buildRawScanlines(rgba, width, height);
    var compressed = options.compression === "store"
      ? deflateStored(raw)
      : await deflateNative(raw);

    var ihdr = new Uint8Array(13);
    writeU32(ihdr, 0, width);
    writeU32(ihdr, 4, height);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    var parts = [PNG_SIGNATURE, makeChunk("IHDR", ihdr)];
    if (metadata) parts.push(makeChunk("tEXt", encodeMetadata(metadata)));
    parts.push(makeChunk("IDAT", compressed));
    parts.push(makeChunk("IEND", new Uint8Array(0)));
    return concatBytes(parts);
  }

  function hasPngSignature(bytes) {
    if (bytes.length < PNG_SIGNATURE.length) return false;
    for (var i = 0; i < PNG_SIGNATURE.length; i++) {
      if (bytes[i] !== PNG_SIGNATURE[i]) return false;
    }
    return true;
  }

  function scanPng(value, collectImageData) {
    var bytes = asBytes(value);
    if (!hasPngSignature(bytes)) throw new Error("The selected file is not a valid PNG");
    var offset = PNG_SIGNATURE.length;
    var width = 0;
    var height = 0;
    var bitDepth = 0;
    var colorType = 0;
    var interlace = 0;
    var metadata = null;
    var idatParts = [];
    var complete = false;

    while (offset + 12 <= bytes.length) {
      var length = readU32(bytes, offset);
      var chunkEnd = offset + 12 + length;
      if (chunkEnd > bytes.length) break;
      var type = String.fromCharCode(
        bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]
      );
      var dataStart = offset + 8;
      var dataEnd = dataStart + length;

      if (type === "IHDR" && length === 13) {
        width = readU32(bytes, dataStart);
        height = readU32(bytes, dataStart + 4);
        bitDepth = bytes[dataStart + 8];
        colorType = bytes[dataStart + 9];
        interlace = bytes[dataStart + 12];
      } else if (type === "tEXt" && length <= 16384) {
        var zero = dataStart;
        while (zero < dataEnd && bytes[zero] !== 0) zero++;
        if (zero < dataEnd) {
          var key = new TextDecoder("latin1").decode(bytes.subarray(dataStart, zero));
          if (key === TEXT_KEY) {
            try {
              metadata = JSON.parse(new TextDecoder().decode(bytes.subarray(zero + 1, dataEnd)));
            } catch (error) {
              throw new Error("PixelFlux metadata is damaged");
            }
          }
        }
      } else if (type === "IDAT" && collectImageData) {
        idatParts.push(bytes.slice(dataStart, dataEnd));
      } else if (type === "IEND") {
        complete = true;
        break;
      }
      offset = chunkEnd;
    }

    return {
      width: width,
      height: height,
      bitDepth: bitDepth,
      colorType: colorType,
      interlace: interlace,
      metadata: metadata,
      idat: collectImageData ? concatBytes(idatParts) : null,
      complete: complete,
    };
  }

  function isPixelFluxMetadata(metadata) {
    return !!(
      metadata &&
      metadata.magic === MAGIC &&
      metadata.version === VERSION &&
      typeof metadata.seed === "string" &&
      /^[0-9a-f]{32}$/i.test(metadata.seed)
    );
  }

  function readMetadata(value) {
    var parsed = scanPng(value, false);
    return isPixelFluxMetadata(parsed.metadata) ? parsed.metadata : null;
  }

  function paeth(left, up, upperLeft) {
    var estimate = left + up - upperLeft;
    var leftDistance = Math.abs(estimate - left);
    var upDistance = Math.abs(estimate - up);
    var diagonalDistance = Math.abs(estimate - upperLeft);
    if (leftDistance <= upDistance && leftDistance <= diagonalDistance) return left;
    return upDistance <= diagonalDistance ? up : upperLeft;
  }

  function unfilterRgba(raw, width, height) {
    var stride = width * 4;
    var expected = height * (stride + 1);
    if (raw.length !== expected) throw new Error("PixelFlux PNG pixel data has an unexpected size");
    var rgba = new Uint8Array(width * height * 4);
    var bpp = 4;

    for (var y = 0; y < height; y++) {
      var filter = raw[y * (stride + 1)];
      var rowStart = y * stride;
      var rawStart = y * (stride + 1) + 1;
      for (var x = 0; x < stride; x++) {
        var value = raw[rawStart + x];
        var left = x >= bpp ? rgba[rowStart + x - bpp] : 0;
        var up = y > 0 ? rgba[rowStart + x - stride] : 0;
        var upperLeft = y > 0 && x >= bpp ? rgba[rowStart + x - stride - bpp] : 0;
        if (filter === 1) value = (value + left) & 0xff;
        else if (filter === 2) value = (value + up) & 0xff;
        else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 0xff;
        else if (filter === 4) value = (value + paeth(left, up, upperLeft)) & 0xff;
        else if (filter !== 0) throw new Error("PixelFlux PNG uses an unsupported row filter");
        rgba[rowStart + x] = value;
      }
    }
    return rgba;
  }

  async function decodePngRgba(value) {
    var parsed = scanPng(value, true);
    if (!parsed.complete || !parsed.width || !parsed.height || !parsed.idat.length) {
      throw new Error("PixelFlux PNG is incomplete");
    }
    if (parsed.bitDepth !== 8 || parsed.colorType !== 6 || parsed.interlace !== 0) {
      throw new Error("PixelFlux PNG must be a non-interlaced 8-bit RGBA image");
    }
    var raw = await inflate(parsed.idat);
    return {
      width: parsed.width,
      height: parsed.height,
      rgba: unfilterRgba(raw, parsed.width, parsed.height),
      metadata: parsed.metadata,
    };
  }

  function makeMetadata(options) {
    return {
      magic: MAGIC,
      version: VERSION,
      algorithm: "affine-position-xoshiro-rgb-xor-v1",
      width: options.width,
      height: options.height,
      seed: options.seed,
      checksum: options.checksum,
      originalNameB64: options.originalNameB64 || "",
      createdAt: options.createdAt || new Date().toISOString(),
    };
  }

  var api = Object.freeze({
    MAGIC: MAGIC,
    VERSION: VERSION,
    TEXT_KEY: TEXT_KEY,
    crc32: crc32,
    checksumHex: checksumHex,
    parseSeed: parseSeed,
    seedToHex: seedToHex,
    randomSeedHex: randomSeedHex,
    derivePermutation: derivePermutation,
    transformRgba: transformRgba,
    scrambleRgba: function (input, width, height, seed, onProgress) {
      return transformRgba(input, width, height, seed, "scramble", onProgress);
    },
    restoreRgba: function (input, width, height, seed, onProgress) {
      return transformRgba(input, width, height, seed, "restore", onProgress);
    },
    encodePngRgba: encodePngRgba,
    decodePngRgba: decodePngRgba,
    readMetadata: readMetadata,
    isPixelFluxMetadata: isPixelFluxMetadata,
    makeMetadata: makeMetadata,
    _deflateStored: deflateStored,
    _inflateStored: inflateStored,
  });

  global.PixelFlux = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
