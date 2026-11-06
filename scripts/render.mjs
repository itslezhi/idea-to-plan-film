#!/usr/bin/env node
/** Deterministic local-browser frame capture, shutter integration, H.264 export. */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer, PROJECT_ROOT, pythonPath, browserLaunchOptions } from './serve.mjs';

const args = process.argv.slice(2);
const opts = { stills: false, samples: 4, workers: 4, width: 1920, height: 1080, fps: 30, keepCaptures: false };
for (let i = 0; i < args.length; i++) {
  const flag = args[i];
  if (flag === '--stills') opts.stills = true;
  else if (flag === '--keep-captures') opts.keepCaptures = true;
  else if (['--samples', '--workers', '--width', '--height', '--fps'].includes(flag)) {
    const value = Number(args[++i]);
    if (!Number.isInteger(value) || value < 1) throw new Error(`Invalid value for ${flag}`);
    opts[flag.slice(2)] = value;
  } else if (flag === '--help') {
    console.log('node scripts/render.mjs [--stills] [--samples 4] [--workers 4] [--width 1920] [--height 1080] [--fps 30] [--keep-captures]');
    process.exit(0);
  } else throw new Error(`Unknown option ${flag}`);
}
if (opts.samples > 32 || opts.workers > 12 || opts.fps > 120) throw new Error('Requested render settings exceed the safe local limits');
if (opts.width % 2 || opts.height % 2) throw new Error('H.264 output width and height must be even');

const output = path.join(PROJECT_ROOT, 'output');
await mkdir(output, { recursive: true });
const qa = {
  mode: opts.stills ? 'stills' : 'video',
  settings: opts,
  started: new Date().toISOString(),
  pageErrors: [],
  consoleErrors: [],
  missingAssets: [],
  failedRequests: [],
  mediaPreloadAborts: [],
  inspections: [],
};
const python = pythonPath();
qa.python = python;

function run(command, parameters, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, parameters, { cwd: PROJECT_ROOT, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    let stdout = '', stderr = '';
    if (capture) {
      child.stdout.on('data', d => stdout += d.toString());
      child.stderr.on('data', d => stderr += d.toString());
    }
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${command} exited ${code}${capture ? `: ${stderr}` : ''}`)));
  });
}

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { encoding: 'utf8' });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim().split(/\r?\n/)[0];
  const imageio = spawnSync(python, ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' });
  if (imageio.status === 0 && existsSync(imageio.stdout.trim())) return imageio.stdout.trim();
  throw new Error('ffmpeg not found. Set FFMPEG=/path/to/ffmpeg, install ffmpeg, or install Python imageio-ffmpeg.');
}

let server, browser;
try {
  if (!opts.stills) await run(python, ['scripts/audio.py']);
  server = await createServer({ port: 0 });
  const launch = browserLaunchOptions(chromium);
  browser = await chromium.launch(launch);
  qa.browser = { version: browser.version(), executablePath: launch.executablePath ?? 'Playwright default', args: launch.args };
  const contexts = [];
  async function pageFor(worker) {
    const context = await browser.newContext({ viewport: { width: opts.width, height: opts.height }, deviceScaleFactor: 1, colorScheme: 'light' });
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', error => qa.pageErrors.push({ worker, message: error.message, stack: error.stack }));
    page.on('console', msg => { if (msg.type() === 'error') qa.consoleErrors.push({ worker, message: msg.text() }); });
    page.on('response', response => { if (response.status() >= 400) qa.missingAssets.push({ worker, url: response.url(), status: response.status() }); });
    page.on('requestfailed', request => {
      const item = { worker, url: request.url(), failure: request.failure()?.errorText };
      // Chromium can cancel a buffered media preload without the resource failing.
      if (request.resourceType() === 'media' && item.failure === 'net::ERR_ABORTED') qa.mediaPreloadAborts.push(item);
      else qa.failedRequests.push(item);
    });
    page.setDefaultTimeout(60_000);
    await page.goto(`${server.origin}/?render=1`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      await window.__ready;
      if (typeof window.__seek !== 'function') throw new Error('Film must define window.__seek(t)');
      await document.fonts.ready;
      await window.__seek(0);
    });
    return page;
  }
  const first = await pageFor(0);
  const meta = await first.evaluate(() => window.__meta ?? { dur: 5, fps: 30 });
  const duration = Number(meta.dur);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Film duration must be a positive number');
  qa.meta = meta;
  qa.webgl = await first.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!gl) return { available: false };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      available: true,
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      canvas: [canvas.width, canvas.height],
    };
  });

  if (opts.stills) {
    const destination = path.join(output, 'stills');
    await mkdir(destination, { recursive: true });
    const times = [0.25, 0.75, 1.25, 1.75, 2.5, 3.5, 4.15, 4.8].filter(t => t < duration);
    const stills = [];
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      const filename = `${String(i + 1).padStart(2, '0')}_${t.toFixed(2)}s.png`;
      await first.evaluate(async time => { await window.__seek(time); }, t);
      await first.screenshot({ path: path.join(destination, filename), type: 'png', animations: 'disabled' });
      const inspection = await first.evaluate(time => typeof window.__inspect === 'function' ? window.__inspect(time) : null, t);
      qa.inspections.push({ time: t, result: inspection });
      stills.push({ file: filename, time: t });
      console.log(`Still ${i + 1}/${times.length}: ${t.toFixed(2)} s`);
    }
    await writeFile(path.join(destination, 'manifest.json'), JSON.stringify({ duration, stills }, null, 2) + '\n');
    await run(python, [
      'scripts/composite.py', 'sheet', '--input-dir', destination,
      '--output', path.join(output, 'contact-sheet.jpg'),
    ]);
    qa.outputs = ['output/contact-sheet.jpg', ...stills.map(s => `output/stills/${s.file}`)];
  } else {
    const ffmpeg = ffmpegPath();
    const captures = path.join(output, 'captures');
    const frames = path.join(output, 'frames');
    await mkdir(captures, { recursive: true });
    await mkdir(frames, { recursive: true });
    const count = Math.round(duration * opts.fps);
    const workers = Math.min(opts.workers, count);
    const pages = [first, ...await Promise.all(Array.from({ length: workers - 1 }, (_, i) => pageFor(i + 1)))];
    const exposure = 0.5 / opts.fps; // A 180-degree shutter.
    let done = 0;
    console.log(`${count} frames · ${opts.samples} shutter samples · ${workers} pages · ${opts.width}×${opts.height}`);
    await Promise.all(pages.map(async (page, worker) => {
      for (let frame = worker; frame < count; frame += workers) {
        const centre = (frame + 0.5) / opts.fps;
        for (let s = 0; s < opts.samples; s++) {
          const t = Math.max(0, Math.min(duration - 1e-6, centre + ((s + 0.5) / opts.samples - 0.5) * exposure));
          await page.evaluate(async time => { await window.__seek(time); }, t);
          await page.screenshot({
            path: path.join(captures, `${String(frame).padStart(5, '0')}_${String(s).padStart(2, '0')}.png`),
            type: 'png', animations: 'disabled',
          });
        }
        done++;
        if (done % 10 === 0 || done === count) console.log(`Captured ${done}/${count} frames`);
      }
    }));
    // Release WebGL contexts before the memory-intensive integration stage.
    await Promise.all(contexts.map(context => context.close()));
    await browser.close(); browser = null;
    await run(python, [
      'scripts/composite.py', 'frames', '--input-dir', captures,
      '--output-dir', frames, '--frames', String(count), '--samples', String(opts.samples),
      '--workers', '2',
    ]);
    const audio = path.join(PROJECT_ROOT, 'assets/audio/sample.wav');
    if (!existsSync(audio)) throw new Error('Missing assets/audio/sample.wav. Run python3 scripts/audio.py first.');
    const target = path.join(output, 'idea-to-plan-5s.mp4');
    await run(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-framerate', String(opts.fps), '-start_number', '0', '-i', path.join(frames, '%05d.png'),
      '-i', audio, '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
      '-profile:v', 'high', '-frames:v', String(count), '-r', String(opts.fps),
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(duration),
      '-movflags', '+faststart', '-shortest', target,
    ]);
    const decode = await run(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-i', target,
      '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-', '-progress', 'pipe:1',
    ], { capture: true });
    qa.encoding = {
      ffmpeg, video: target, duration, fps: opts.fps, frames: count,
      size: [opts.width, opts.height], shutterDegrees: 180,
      samplesPerFrame: opts.samples, captures: count * opts.samples,
      decodePassed: true, decodeProgress: decode.stdout.trim(),
    };
    qa.outputs = ['output/idea-to-plan-5s.mp4'];
    if (!opts.keepCaptures) await rm(captures, { recursive: true, force: true });
    console.log(`Video ready: ${target}`);
  }
  qa.mediaValidation = [];
  for (const url of new Set(qa.mediaPreloadAborts.map(item => item.url))) {
    const response = await fetch(url, { method: 'HEAD' });
    const passed = response.ok && Number(response.headers.get('content-length')) > 0;
    qa.mediaValidation.push({ url, status: response.status, passed });
  }
  if (qa.pageErrors.length || qa.missingAssets.length || qa.failedRequests.length || qa.consoleErrors.length || qa.mediaValidation.some(item => !item.passed)) {
    throw new Error('Browser errors or missing assets were detected; inspect output/qa.json');
  }
  qa.success = true;
} catch (error) {
  qa.success = false;
  qa.failure = error.stack ?? String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  qa.finished = new Date().toISOString();
  const report = JSON.stringify(qa, null, 2) + '\n';
  await writeFile(path.join(output, 'qa.json'), report);
  await writeFile(path.join(output, `qa-${opts.stills ? 'stills' : 'video'}.json`), report);
}
