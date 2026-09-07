const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../js/videogif-core.js');
const meta = { vw: 1920, vh: 1080, duration: 12 };
function defaults(m = meta) { return Core.defaults(m.vw, m.vh, m.duration); }
function worker() {
  const messages = [];
  const context = vm.createContext({ ArrayBuffer, Uint8Array, Uint8ClampedArray, self: { postMessage: m => messages.push(m) } });
  context.importScripts = () => vm.runInContext(fs.readFileSync(path.join(__dirname, '../libs/gifenc/gifenc.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/videogif-worker.js'), 'utf8'), context);
  return { send(m) { context.self.onmessage({ data: m }); return messages.at(-1); }, messages };
}
function rgba(color, pixels = 4) {
  const data = new Uint8Array(pixels * 4);
  for (let i = 0; i < pixels; i++) data.set([...color, 255], i * 4);
  return data.buffer;
}
// Parse the actual GIF, including LZW indices, instead of trusting worker metadata.
function parseGif(buffer) {
  const bytes = Buffer.from(buffer); assert.equal(bytes.subarray(0, 6).toString(), 'GIF89a');
  let pos = 13, global, repeat, frames = [], delay = 0;
  const width = bytes.readUInt16LE(6), height = bytes.readUInt16LE(8);
  function palette(size) { const p = []; for (let i = 0; i < size; i++) p.push([...bytes.subarray(pos + i * 3, pos + i * 3 + 3)]); pos += size * 3; return p; }
  function blocks() { const chunks = []; while (bytes[pos]) { const n = bytes[pos++]; chunks.push(bytes.subarray(pos, pos + n)); pos += n; } pos++; return Buffer.concat(chunks); }
  if (bytes[10] & 128) global = palette(2 ** ((bytes[10] & 7) + 1));
  while (pos < bytes.length) {
    const marker = bytes[pos++];
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      const label = bytes[pos++];
      if (label === 0xf9) { assert.equal(bytes[pos++], 4); pos++; delay = bytes.readUInt16LE(pos) * 10; pos += 4; }
      else if (label === 0xff) { const n = bytes[pos++], name = bytes.subarray(pos, pos + n).toString(); pos += n; const ext = blocks(); if (name === 'NETSCAPE2.0') repeat = ext.readUInt16LE(1); }
      else blocks();
    } else if (marker === 0x2c) {
      const w = bytes.readUInt16LE(pos + 4), h = bytes.readUInt16LE(pos + 6), packed = bytes[pos + 8]; pos += 9;
      const pal = packed & 128 ? palette(2 ** ((packed & 7) + 1)) : global;
      const min = bytes[pos++], data = blocks(), clear = 1 << min, end = clear + 1;
      let dict, size, next, bit = 0, prev, indices = [];
      function reset() { dict = Array.from({ length: clear }, (_, i) => [i]); size = min + 1; next = end + 1; prev = null; }
      reset();
      while (bit + size <= data.length * 8) {
        let code = 0; for (let j = 0; j < size; j++, bit++) code |= ((data[bit >> 3] >> (bit & 7)) & 1) << j;
        if (code === clear) { reset(); continue; } if (code === end) break;
        const entry = dict[code] || (code === next && prev ? [...prev, prev[0]] : null); assert.ok(entry, 'valid LZW code');
        indices.push(...entry);
        if (prev) { dict[next++] = [...prev, entry[0]]; if (next === 1 << size && size < 12) size++; }
        prev = entry;
      }
      assert.equal(indices.length, w * h);
      frames.push({ w, h, delay, pixels: indices.map(i => pal[i]) });
    } else assert.fail('Unexpected GIF block ' + marker);
  }
  return { width, height, repeat, frames };
}
function encode(loop = 0) {
  const w = worker();
  assert.equal(w.send({ id: 42, type: 'start', width: 2, height: 2, total: 4, colors: 128, repeat: loop }).type, 'ready');
  [[0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255]].forEach((color, i) => {
    const result = w.send({ id: 42, type: 'frame', index: i, rgba: rgba(color), delay: 70 });
    assert.deepEqual(structuredClone(result), { id: 42, type: 'progress', done: i + 1, total: 4 });
  });
  const result = w.send({ id: 42, type: 'finish' }); assert.equal(result.type, 'done');
  return parseGif(result.bytes);
}
test('initial metadata creates a nonempty five-second selection and real 480px default', () => {
  const e = defaults(), p = Core.plan(e, meta);
  assert.equal(e.end, 5); assert.equal(p.frames, 75); assert.deepEqual([p.width, p.height], [480, 270]);
  assert.equal(defaults({ ...meta, duration: 1.2 }).end, 1.2);
});
test('each file owns its crop and settings', () => {
  const a = defaults(), b = defaults(); a.crop.x = 100; a.end = 1; a.fps = 24;
  assert.equal(b.crop.x, 0); assert.equal(b.end, 5); assert.equal(b.fps, 15);
});
test('custom sizes keep the real crop ratio and can explicitly unlock it', () => {
  const e = defaults(); Object.assign(e, { size: 'custom', width: '320', height: '400' });
  assert.deepEqual(Core.outputSize(e), { w: 320, h: 180 });
  e.keepRatio = false; assert.deepEqual(Core.outputSize(e), { w: 320, h: 400 });
  e.width = ''; assert.deepEqual(Core.outputSize(e), { w: 711, h: 400 });
  e.width = '-1'; assert.throws(() => Core.plan(e, meta), /宽高/);
  e.width = 'Infinity'; assert.throws(() => Core.plan(e, meta), /宽高/);
});
test('portrait sizing and one-pixel crops never produce zero dimensions', () => {
  const e = Core.defaults(1080, 1920, 3); assert.deepEqual(Core.outputSize(e), { w: 270, h: 480 });
  e.crop = { x: 0, y: 0, w: 1, h: 1920 }; assert.deepEqual(Core.outputSize(e), { w: 1, h: 480 });
});
test('selection clamps crossed, empty, negative and beyond-end inputs', () => {
  assert.deepEqual(Core.normalizeRange(9, 4, 5, 'start'), { start: 4.98, end: 5 });
  const range = Core.normalizeRange(4, -2, 5, 'end'); assert.equal(range.start, 0); assert.equal(range.end, .02);
  assert.deepEqual(Core.normalizeRange(-10, 50, 5, 'start'), { start: 0, end: 5 });
});
test('15 and 24 fps maintain GIF duration using centisecond delays without endpoint capture', () => {
  for (const fps of [3, 8, 15, 24, 30]) for (const duration of [.02, .07, .101, 1, 2.019, 5]) {
    const e = defaults(); e.end = duration; e.fps = fps;
    const p = Core.plan(e, meta);
    assert.ok(p.times.every(t => t >= 0 && t < duration));
    assert.ok(p.delays.every(d => d >= 20 && d % 10 === 0));
    assert.equal(p.delays.reduce((a, b) => a + b, 0), Math.round(duration * 100) * 10);
    assert.equal(p.times.length, p.delays.length);
  }
});
test('reject invalid metadata, out-of-bounds crops, huge outputs and excessive work', () => {
  assert.throws(() => Core.plan(defaults(), { ...meta, duration: Infinity }), /时长/);
  const e = defaults(); e.crop.w = 2000; assert.throws(() => Core.plan(e, meta), /裁剪/);
  Object.assign(e, defaults(), { size: 'custom', width: 9000 }); assert.throws(() => Core.plan(e, meta), /1920/);
  Object.assign(e, defaults(), { size: '0', end: 12, fps: 30 }); assert.throws(() => Core.plan(e, meta), /处理量/);
});
test('UI total playback counts map to GIF repeat extension semantics', () => {
  for (const [loop, repeat] of [[0, 0], [1, -1], [3, 2], [5, 4]]) {
    const e = defaults(); e.loop = loop; assert.equal(Core.plan(e, meta).repeat, repeat);
  }
});
test('real GIF retains black opening and later red, green, blue scenes with exact delays', () => {
  const gif = encode(); assert.deepEqual([gif.width, gif.height], [2, 2]); assert.equal(gif.repeat, 0);
  assert.deepEqual(gif.frames.map(f => f.pixels[0]), [[0,0,0], [255,0,0], [0,255,0], [0,0,255]]);
  assert.equal(gif.frames.reduce((sum, f) => sum + f.delay, 0), 280);
});
test('play-once GIF omits NETSCAPE extension; finite playback counts are stored correctly', () => {
  assert.equal(encode(-1).repeat, undefined); assert.equal(encode(2).repeat, 2);
});
test('worker rejects incomplete frame sequences and invalid RGBA buffers with the task id', () => {
  const w = worker(); const start = { type: 'start', id: 8, width: 2, height: 2, colors: 128, total: 1, repeat: 0 };
  w.send(start); assert.equal(w.send({ type: 'finish', id: 8 }).type, 'error');
  w.send(start); const error = w.send({ type: 'frame', id: 8, index: 0, rgba: new ArrayBuffer(1), delay: 70 });
  assert.equal(error.type, 'error'); assert.equal(error.id, 8);
});
test('worker ignores old run messages and can start a fresh job after failure', () => {
  const w = worker(); w.send({ type: 'start', id: 10, width: 2, height: 2, colors: 128, total: 1, repeat: 0 });
  const count = w.messages.length; w.send({ type: 'frame', id: 9, index: 0, rgba: rgba([0,0,0]), delay: 70 }); assert.equal(w.messages.length, count);
  w.send({ type: 'frame', id: 10, index: 3, rgba: rgba([0,0,0]), delay: 70 });
  assert.equal(w.send({ type: 'start', id: 11, width: 2, height: 2, colors: 128, total: 1, repeat: 0 }).type, 'ready');
});
test('SPA loads core before UI and exposes lifecycle plus all referenced controls', () => {
  const registry = fs.readFileSync(path.join(__dirname, '../js/page-registry.js'), 'utf8');
  const ui = fs.readFileSync(path.join(__dirname, '../js/videogif.js'), 'utf8');
  const template = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').split('<template id="page-videogif">')[1].split('</template>')[0];
  assert.match(registry, /js: \["js\/videogif-core.js", "js\/videogif.js"\]/);
  assert.match(ui, /window\.__page_videogif = \{ mount: mount, unmount: unmount \}/);
  const refs = ui.split('var refs = {')[1].split('}')[0];
  for (const match of refs.matchAll(/:\s*'([^']+)'/g)) assert.ok(template.includes('data-vg-' + match[1]), match[1]);
  assert.doesNotMatch(template, /rgba5|rgba4444|rgb565/);
});
