// Drive template/index.html with Playwright. The page is a pure function of time: renderAt(t, ft)
// draws sub-frame time t (motion) while ft, the frame centre, decides which shot is on screen.
//
//   node tools/render.mjs lint [--strict]         pacing advice (exit 1 on findings only with --strict)
//   node tools/render.mjs cues                    write build/cues.json for tools/sfx.py
//   node tools/render.mjs probe build/probe 3.9 7.2 ...   stills at given seconds
//   node tools/render.mjs full                    3 sub-frames per 60 fps frame -> build/subframes
//
// Uses the installed Google Chrome when present, else Playwright's Chromium (npx playwright install chromium).
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'file://' + path.join(ROOT, 'template', 'index.html');
const [mode = 'lint', outArg, ...rest] = process.argv.slice(2);
const args = ['--allow-file-access-from-files', '--force-color-profile=srgb', '--font-render-hinting=none'];
const browser = await chromium.launch({channel: 'chrome', args}).catch(() => chromium.launch({args}));

async function page() {
  const ctx = await browser.newContext({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});
  const p = await ctx.newPage();
  p.on('pageerror', e => console.error('[page]', e.message));
  p.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
  await p.goto(PAGE);
  await p.evaluate(() => window.ready);
  return p;
}

if (mode === 'lint') {
  const p = await page();
  const {bad, ev, grid} = await p.evaluate(() => ({
    bad: window.lintPacing(), grid: window.GRID,
    ev: window.PACING.map(e => `${e.t.toFixed(3).padStart(7)}s  ${e.kind.padEnd(4)} ${e.text}`),
  }));
  console.log(`grid ${(60 / grid.P).toFixed(2)} BPM, bar ${(4 * grid.P).toFixed(3)}s, film ${grid.total}s\n` + ev.join('\n'));
  // advice, not a gate: the rules are what reads comfortably, the author decides
  console.log(bad.length ? `\nPACING ADVICE (${bad.length}) - likely too fast to read:\n- ` + bad.join('\n- ') : '\nPACING OK');
  process.exitCode = bad.length && rest.concat(outArg || []).includes('--strict') ? 1 : 0;
} else if (mode === 'cues') {
  const p = await page();
  const cues = await p.evaluate(() => window.CUES);
  fs.mkdirSync(path.join(ROOT, 'build'), {recursive: true});
  fs.writeFileSync(path.join(ROOT, 'build', 'cues.json'), JSON.stringify(cues, null, 1));
  console.log(`build/cues.json: ${cues.length} cues`);
} else if (mode === 'probe') {
  const out = path.resolve(outArg || path.join(ROOT, 'build', 'probe'));
  fs.mkdirSync(out, {recursive: true});
  const p = await page();
  for (const t of rest.map(Number)) {
    await p.evaluate(t => window.renderAt(t, t), t);
    await p.screenshot({path: path.join(out, `t${t.toFixed(3).padStart(7, '0')}.jpg`), type: 'jpeg', quality: 90});
  }
  console.log(`${rest.length} stills -> ${out}`);
} else if (mode === 'full') {
  const out = path.resolve(outArg || path.join(ROOT, 'build', 'subframes'));
  fs.mkdirSync(out, {recursive: true});
  const probe = await page();
  const total = await probe.evaluate(() => window.T.total);
  const FPS = 60, N = Math.round(total * FPS), SUB = [-1 / 240, 0, 1 / 240];
  const workers = Number(process.env.WORKERS || 4), start = Date.now();
  let done = 0;
  // frames are independent, so workers take contiguous slices; existing files are kept
  await Promise.all(Array.from({length: workers}, async (_, w) => {
    const p = w ? await page() : probe;
    for (let n = Math.floor(N * w / workers); n < Math.floor(N * (w + 1) / workers); n++) {
      for (let k = 0; k < 3; k++) {
        const f = path.join(out, `s${String(n * 3 + k).padStart(5, '0')}.jpg`);
        if (fs.existsSync(f)) continue;
        await p.evaluate(([t, ft]) => window.renderAt(t, ft), [n / FPS + SUB[k], n / FPS]);
        await p.screenshot({path: f, type: 'jpeg', quality: 94});
      }
      if (++done % 120 === 0) console.log(`${done}/${N} frames ${((Date.now() - start) / 1000).toFixed(0)}s`);
    }
  }));
  fs.writeFileSync(path.join(ROOT, 'build', 'frames.json'), JSON.stringify({frames: N, fps: FPS, subframes: 3}));
  console.log(`${N} frames x 3 sub-frames -> ${out}`);
} else {
  console.error('usage: render.mjs lint | cues | probe <dir> <t...> | full [dir]');
  process.exitCode = 2;
}
await browser.close();
