#!/usr/bin/env node
/** Integration checks of the rendered scene, rather than the animation formulae. */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer, PROJECT_ROOT, browserLaunchOptions } from './serve.mjs';

let film = 'original';
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--film') film = args[++i];
  else if (args[i] === '--help') {
    console.log('node scripts/check.mjs [--film original|codex-glass]');
    process.exit(0);
  } else throw new Error(`Unknown option ${args[i]}`);
}
if (!['original', 'codex-glass'].includes(film)) throw new Error('Unknown film variant; choose original or codex-glass');
const variant = film === 'codex-glass';
const pagePath = variant ? '/variants/codex-glass/' : '/';
const filmRoot = variant ? path.join(PROJECT_ROOT, 'variants/codex-glass') : PROJECT_ROOT;
const output = path.join(filmRoot, 'output');
const reportPath = variant ? 'variants/codex-glass/output/check.json' : 'output/check.json';
const framingTimes = variant
  ? [0.25, 0.575, 0.8, 1.07, 1.25, 1.49, 1.65, 2.4, 2.65, 2.8, 2.95, 3.1, 3.25, 3.4, 3.55, 3.65, 4.05, 4.8]
  : [0.25, 0.75, 1.25, 1.75, 2.5, 3.5, 4.15, 4.8];
await mkdir(output, { recursive: true });
const report = {
  film,
  success: false,
  started: new Date().toISOString(),
  pageErrors: [],
  consoleErrors: [],
  missingAssets: [],
  failedRequests: [],
  mediaPreloadAborts: [],
  framing: [],
  endpoints: [],
};
let server, browser;
try {
  server = await createServer({ port: 0 });
  const launch = browserLaunchOptions(chromium);
  browser = await chromium.launch(launch);
  report.browser = { version: browser.version(), executablePath: launch.executablePath ?? 'Playwright default', args: launch.args };
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'light' });
  page.setDefaultTimeout(60_000);
  page.on('pageerror', error => report.pageErrors.push({ message: error.message, stack: error.stack }));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) report.missingAssets.push({ url: response.url(), status: response.status() }); });
  page.on('requestfailed', request => {
    const item = { url: request.url(), failure: request.failure()?.errorText };
    if (request.resourceType() === 'media' && item.failure === 'net::ERR_ABORTED') report.mediaPreloadAborts.push(item);
    else report.failedRequests.push(item);
  });
  await page.goto(`${server.origin}${pagePath}?render=1`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await window.__ready;
    await document.fonts.ready;
    if (typeof window.__seek !== 'function') throw new Error('Missing window.__seek(t)');
    if (typeof window.__inspect !== 'function') throw new Error('Missing window.__inspect(t)');
  });
  const meta = await page.evaluate(() => window.__meta);
  if (!meta || !Number.isFinite(meta.dur) || meta.dur <= 0) throw new Error('Invalid film metadata/duration');
  report.meta = meta;
  const seek = async t => page.evaluate(async time => {
    await window.__seek(time);
    return window.__inspect(time);
  }, t);

  // Boundary seeks exercise the first/last states even when no video frame lands there.
  for (const t of [0, Math.min(4.999, meta.dur - 0.001)]) {
    const inspection = await seek(t);
    report.endpoints.push({ time: t, passed: true, inspection });
  }

  // Projected actor-centre checks complement the human review of the contact sheet.
  // __inspect intentionally does not expose a full character silhouette.
  for (const t of framingTimes) {
    if (t >= meta.dur) continue;
    const inspection = await seek(t);
    const xy = inspection?.pip?.screen;
    const width = meta.width ?? 1920, height = meta.height ?? 1080;
    const finite = Array.isArray(xy) && xy.length === 2 && xy.every(Number.isFinite);
    const passed = Boolean(finite && inspection.pip.visible && xy[0] >= 0 && xy[0] <= width && xy[1] >= 0 && xy[1] <= height);
    report.framing.push({ time: t, passed, type: 'actor centre inside frame', inspection });
  }

  // A previous seek must not change a later frame: 4.8 -> 1.25 -> 4.8.
  await seek(4.8);
  const first = await page.screenshot({ type: 'png', animations: 'disabled' });
  await seek(1.25);
  await seek(4.8);
  const second = await page.screenshot({ type: 'png', animations: 'disabled' });
  const hash = buffer => createHash('sha256').update(buffer).digest('hex');
  report.determinism = { path: [4.8, 1.25, 4.8], first: hash(first), second: hash(second), passed: hash(first) === hash(second) };
  await browser.close(); browser = null;
  report.mediaValidation = [];
  for (const url of new Set(report.mediaPreloadAborts.map(item => item.url))) {
    const response = await fetch(url, { method: 'HEAD' });
    const passed = response.ok && Number(response.headers.get('content-length')) > 0;
    report.mediaValidation.push({ url, status: response.status, passed });
  }
  report.success = Boolean(
    report.determinism.passed
    && report.framing.length > 0
    && report.framing.every(check => check.passed)
    && report.endpoints.every(check => check.passed)
    && report.pageErrors.length === 0
    && report.consoleErrors.length === 0
    && report.missingAssets.length === 0
    && report.failedRequests.length === 0
    && report.mediaValidation.every(item => item.passed)
  );
  if (!report.success) process.exitCode = 1;
} catch (error) {
  report.success = false;
  report.failure = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  report.finished = new Date().toISOString();
  await writeFile(path.join(output, 'check.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ success: report.success, framingChecks: report.framing.length, determinism: report.determinism?.passed ?? false, report: reportPath }, null, 2));
  if (report.failure) console.error(report.failure);
}
