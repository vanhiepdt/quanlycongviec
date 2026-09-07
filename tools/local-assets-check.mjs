// Kiểm tra chỉ đọc trên PC: không ghi dữ liệu, không đọc bí mật, không đăng nhập.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const index = read('web/index.html');
const app = read('web/assets/js/app.js');
const banner = app.match(/\[QLCV\] app\.js (\d{8}-\d+)/)?.[1];
const version = index.match(/assets\/js\/app\.js\?v=([^"']+)/)?.[1];
try {
  const detailsVersion = index.match(/assets\/js\/project-details\.js\?v=([^"']+)/)?.[1];
  if (!banner || banner !== version || detailsVersion !== version) {
    throw new Error('Banner app.js va buster app.js/project-details.js khong khop.');
  }
  console.log(`Ban app.js = ${banner} (index.html khop).`);
  if (process.argv.includes('--live')) {
    for (const path of ['/healthz', '/readyz', '/', '/assets/js/app.js', '/assets/js/project-details.js', '/assets/css/app.css']) {
      const response = await fetch('http://127.0.0.1:8099' + path, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
      const text = await response.text();
      const local = path === '/' ? index : path.startsWith('/assets/') ? read('web' + path) : null;
      if (local !== null && text !== local) throw new Error(`Nginx phuc vu khac file PC: ${path}`);
    }
    console.log('8099 health/ready va index + JS/CSS khop file PC.');
  }
} catch (error) {
  console.error('KIEM TRA LOI: ' + error.message);
  process.exitCode = 1;
}
