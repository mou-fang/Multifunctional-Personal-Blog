const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  MapCipher,
  RC4Cipher,
  decryptTencentTea,
  parseFileTail,
  simpleMakeKey,
  sniffAudio,
  writeFlacMetadata,
} = require("./qq-music-unlock");

test("simpleMakeKey matches the QQ Music key schedule", () => {
  assert.deepEqual([...simpleMakeKey(106, 8)], [0x69, 0x56, 0x46, 0x38, 0x2b, 0x20, 0x15, 0x0b]);
});

test("Tencent TEA decrypts a known vector", () => {
  const encrypted = Buffer.from([
    0x91, 0x09, 0x51, 0x62, 0xe3, 0xf5, 0xb6, 0xdc,
    0x6b, 0x41, 0x4b, 0x50, 0xd1, 0xa5, 0xb8, 0x4e,
    0xc5, 0x0d, 0x0c, 0x1b, 0x11, 0x96, 0xfd, 0x3c,
  ]);
  const result = decryptTencentTea(encrypted, Buffer.from("12345678ABCDEFGH"));
  assert.deepEqual([...result], [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("Map and RC4 ciphers are symmetric across chunk offsets", () => {
  const plain = Buffer.from(Array.from({ length: 14000 }, (_value, index) => index % 251));
  const mapKey = Buffer.from(Array.from({ length: 256 }, (_value, index) => (index * 17 + 3) & 0xff));
  const rc4Key = Buffer.from(Array.from({ length: 512 }, (_value, index) => (index * 29 + 7) & 0xff));

  for (const [Cipher, key] of [[MapCipher, mapKey], [RC4Cipher, rc4Key]]) {
    const encrypted = Buffer.from(plain);
    const encryptor = new Cipher(key);
    encryptor.decrypt(encrypted.subarray(0, 3333), 0);
    encryptor.decrypt(encrypted.subarray(3333), 3333);

    const decryptor = new Cipher(key);
    decryptor.decrypt(encrypted.subarray(0, 7777), 0);
    decryptor.decrypt(encrypted.subarray(7777), 7777);
    assert.deepEqual(encrypted, plain);
  }
});

test("musicex tail parser reads songMid, filename and audio size", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "claudeone-musicex-"));
  const filePath = path.join(directory, "sample.mflac");
  try {
    const audio = Buffer.alloc(1234, 0xa5);
    const tail = Buffer.alloc(192);
    Buffer.from("003JJd7a3kd908", "utf16le").copy(tail, 28);
    Buffer.from("F0M000009arN45BswN.mflac", "utf16le").copy(tail, 88);
    const trailer = Buffer.alloc(16);
    trailer.writeUInt32LE(tail.length, 0);
    Buffer.from([0x6d, 0x75, 0x73, 0x69, 0x63, 0x65, 0x78, 0x00]).copy(trailer, 8);
    fs.writeFileSync(filePath, Buffer.concat([audio, tail, trailer]));

    assert.deepEqual(parseFileTail(filePath), {
      format: "musicex",
      songMid: "003JJd7a3kd908",
      filename: "F0M000009arN45BswN.mflac",
      audioSize: audio.length,
      ekey: null,
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("sniffAudio only accepts playable decrypted headers", () => {
  assert.equal(sniffAudio(Buffer.from("fLaC00000000")), ".flac");
  assert.equal(sniffAudio(Buffer.from("OggS00000000")), ".ogg");
  assert.equal(sniffAudio(Buffer.from("musicex\0")), null);
});

test("FLAC metadata writer embeds comments and a front cover", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "claudeone-flac-"));
  const inputPath = path.join(directory, "input.flac");
  const outputPath = path.join(directory, "output.flac");
  try {
    const streamInfoHeader = Buffer.from([0x80, 0x00, 0x00, 0x22]);
    const audioFrames = Buffer.from([0xff, 0xf8, 0x01, 0x02, 0x03]);
    fs.writeFileSync(inputPath, Buffer.concat([
      Buffer.from("fLaC"), streamInfoHeader, Buffer.alloc(34), audioFrames,
    ]));
    const png = Buffer.alloc(32);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
    png.writeUInt32BE(500, 16);
    png.writeUInt32BE(500, 20);

    writeFlacMetadata(inputPath, outputPath, {
      title: "光辉岁月", artist: "BEYOND", album: "命运派对",
    }, { data: png, mime: "image/png" });

    const result = fs.readFileSync(outputPath);
    assert.equal(result.subarray(0, 4).toString("ascii"), "fLaC");
    const blockTypes = [];
    let offset = 4;
    let last = false;
    while (!last) {
      last = Boolean(result[offset] & 0x80);
      blockTypes.push(result[offset] & 0x7f);
      const length = result.readUIntBE(offset + 1, 3);
      offset += 4 + length;
    }
    assert.deepEqual(blockTypes, [0, 4, 6]);
    assert.deepEqual(result.subarray(offset), audioFrames);
    assert.match(result.toString("utf8"), /TITLE=光辉岁月/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
