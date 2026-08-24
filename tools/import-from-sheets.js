#!/usr/bin/env node
/**
 * import-from-sheets.js — nhập bản chụp Google Sheets vào PostgreSQL (§7 Phase 2).
 *
 *   node tools/import-from-sheets.js --dry-run           # chỉ in báo cáo, KHÔNG ghi một dòng nào
 *   node tools/import-from-sheets.js                     # nhập thật bản chụp mới nhất trong data/
 *   node tools/import-from-sheets.js data/snapshot-20260824.json
 *
 * Đầu ra: data/import-report.txt (bảng đối chiếu) và — chỉ khi chạy thật và có tài khoản không
 * mật khẩu — data/import-temp-passwords.txt (BÍ MẬT, quyền 0600, phát riêng rồi xoá).
 *
 * Chạy LẠI được: lần thứ hai ghi 0 dòng mới. Không sợ chạy hai lần.
 *
 * File này chỉ là VỎ. Toàn bộ việc nhập nằm ở `server/src/modules/import/` để dùng chung đúng
 * một bộ hàm với test và với API sau này — đặc biệt là hàm băm mật khẩu, vì băm khác cost thì
 * mật khẩu nhập vào không đăng nhập được. `tools/` là CommonJS còn `server/` là ESM, nên phải
 * nạp bằng `import()` động.
 */
'use strict';

const path = require('path');
const { pathToFileURL } = require('url');

const CLI = path.join(__dirname, '..', 'server', 'src', 'modules', 'import', 'cli.js');

async function main() {
  const { main: run } = await import(pathToFileURL(CLI).href);
  process.exitCode = await run(process.argv.slice(2));
}

main().catch((err) => {
  console.error(`\nLỖI: ${err.message}`);
  process.exit(1);
});
