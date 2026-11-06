#!/usr/bin/env node
/** Small, dependency-free local server for the film and its installed modules. */
import { createServer as createHTTPServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Prefer an explicit interpreter, then the project's venv, then the system. */
export function pythonPath() {
  if (process.env.PYTHON) return process.env.PYTHON;
  const virtual = path.join(PROJECT_ROOT, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  return existsSync(virtual) ? virtual : 'python3';
}

/** One browser selection policy shared by rendering and the integration check. */
export function browserLaunchOptions(chromium) {
  if (process.env.CHROME_PATH && !existsSync(process.env.CHROME_PATH)) {
    throw new Error(`CHROME_PATH does not exist: ${process.env.CHROME_PATH}`);
  }
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    chromium.executablePath(),
  ].filter(Boolean);
  const executablePath = candidates.find(filename => existsSync(filename));
  const args = ['--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling'];
  if (process.platform === 'darwin') args.push('--use-angle=metal');
  if (process.platform === 'linux') {
    // CI runners need no display or physical GPU. SwiftShader draws the same scene.
    args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage');
  }
  return { headless: true, executablePath, args };
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

/** Start a server. Port zero selects an unused port; server.origin is its URL. */
export async function createServer({ port = 4173, host = '127.0.0.1', root = PROJECT_ROOT } = {}) {
  const base = path.resolve(root);
  const server = createHTTPServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method ?? '')) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end('Method not allowed');
      return;
    }
    let requested;
    try {
      requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400); res.end('Bad URL'); return;
    }
    // Do not expose dotfiles, repository metadata or anything outside the project.
    if (requested.split('/').some(part => part.startsWith('.') && part.length)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    let filename = path.resolve(base, `.${requested}`);
    const rel = path.relative(base, filename);
    if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    try {
      let info = await stat(filename);
      if (info.isDirectory()) {
        filename = path.join(filename, 'index.html');
        info = await stat(filename);
      }
      if (!info.isFile()) throw new Error('Not a file');
      let start = 0, end = info.size - 1, status = 200;
      const range = req.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2])) {
          res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return;
        }
        if (!match[1]) start = Math.max(0, info.size - Number(match[2]));
        else {
          start = Number(match[1]);
          if (match[2]) end = Math.min(end, Number(match[2]));
        }
        if (start > end || start >= info.size) {
          res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return;
        }
        status = 206;
      }
      const headers = {
        'Content-Type': MIME[path.extname(filename).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': Math.max(0, end - start + 1),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      };
      if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
      res.writeHead(status, headers);
      if (req.method === 'HEAD' || info.size === 0) res.end();
      else createReadStream(filename, { start, end }).on('error', () => res.destroy()).pipe(res);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.off('error', reject); resolve(); });
  });
  const actual = server.address();
  server.origin = `http://${host}:${actual.port}`;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createServer({ port: Number(process.env.PORT ?? 4173) });
  console.log(`Film preview: ${server.origin}`);
  console.log('Ctrl+C to stop. Render mode: /?render=1');
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
