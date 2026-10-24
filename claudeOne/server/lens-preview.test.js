const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const web = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(web, file), 'utf8').replace(/\r\n/g, '\n');

// These checks protect the requested 1:1 prototype from becoming a redesign.
test('Lens preview preserves the exact original homepage, header, footer and player markup', () => {
  const original = read('index.html'), preview = read('lens-preview/index.html');
  for (const expression of [
    /<template id="page-home">[\s\S]*?<\/template>/,
    /<header class="site-header[\s\S]*?<\/header>/,
    /<footer class="site-footer[\s\S]*?<\/footer>/,
    /<div class="global-player"[\s\S]*?<audio[\s\S]*?<\/audio>\s*<\/div>/,
    /<div class="site-assistant"[^>]*><\/div>/,
  ]) assert.equal(preview.match(expression)?.[0]?.replaceAll('="../', '="./'), original.match(expression)?.[0], String(expression));
  assert.deepEqual([...preview.matchAll(/<template\b[^>]*id="([^"]+)"/g)].map(m => m[1]), ['page-home']);
});

test('Lens preview loads all the same layout styles and has no layout or typography redesign', () => {
  const original = read('index.html'), preview = read('lens-preview/index.html');
  const css = source => [...source.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1].replace(/^\.\.?\//, ''));
  for (const file of css(original)) assert.ok(css(preview).includes(file), file);
  const adapter = read('lens-preview/preview.css');
  assert.doesNotMatch(adapter, /(?:^|[;{\s])(?:font(?:-family|-size|-weight)?|padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|gap|grid-template-columns)\s*:/m);
  assert.doesNotMatch(preview, /<base\b/);
});

test('Lens preview reuses the complete original shell, player and assistant UI logic with isolated storage', () => {
  for (const [source, copy] of [['shell.js', 'shell-preview.js'], ['player.js', 'player-preview.js'], ['assistant.js', 'assistant-preview.js']]) {
    assert.equal(read('lens-preview/' + copy), read('js/' + source).replaceAll('claudeOne:', 'claudeOne:lens-preview:'));
  }
  const isolation = read('lens-preview/isolation.js');
  assert.match(isolation, /home: \{\.\.\.originalHome/);
  assert.match(isolation, /originalHome\.css\.map/);
  assert.match(isolation, /location\.pathname \+ location\.search \+ '#\/home'/);
  const visitor = read('lens-preview/visitor-preview.js');
  assert.doesNotMatch(visitor, /method\s*:\s*["']POST["']|fetch\(["']\/api\/visitors\/heartbeat/);
});

test('Lens preview HTML scripts, styles and images resolve from its independent directory', () => {
  const preview = read('lens-preview/index.html');
  for (const match of preview.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^https?:|^data:/.test(match[1])) continue;
    const url = new URL(match[1], 'http://localhost/lens-preview/');
    assert.ok(fs.existsSync(path.join(web, decodeURIComponent(url.pathname))), match[1]);
  }
  const startup = read('lens-preview/startup-preview.js');
  assert.match(startup, /\.\.\/lens-preview\/player-preview\.js/);
  assert.match(startup, /\.\.\/lens-preview\/assistant-preview\.js/);
  assert.match(startup, /copy\[key\] = new URL\(copy\[key\], base\)\.href/);
});

test('Lens vendor snapshot hashes and relative runtime import closure are complete', () => {
  const base = path.join(web, 'libs/lens-1.1.0-showcase.1-20261017');
  const manifest = JSON.parse(fs.readFileSync(path.join(base, 'UPSTREAM.json'), 'utf8'));
  assert.match(manifest.commit, /^[0-9a-f]{40}$/);
  for (const [file, hash] of Object.entries(manifest.files)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(base, file))).digest('hex'), hash, file);
  const visited = new Set();
  const check = file => {
    if (visited.has(file)) return; visited.add(file);
    const source = fs.readFileSync(file, 'utf8').replace(/`(?:\\.|[^`])*`/g, '');
    for (const match of source.matchAll(/^(?:import|export)\s+(?:[^;\n]*?\sfrom\s*)?['"]([^'"]+)['"]/gm)) {
      assert.ok(match[1].startsWith('.'), match[1]);
      const target = path.resolve(path.dirname(file), match[1]); assert.ok(fs.existsSync(target), target);
      if (target.endsWith('.js')) check(target);
    }
  };
  check(path.join(base, 'index.js')); assert.ok(visited.size > 10);
  check(path.join(web, 'lens-preview/lens-adapter.js'));
});
