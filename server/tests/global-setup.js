// Chạy MỘT LẦN trước cả bộ test: dựng lại CSDL test từ migration, không dùng lại bảng cũ.
// Xoá sạch schema là chủ ý — CSDL test nằm trong tmpfs của container db-test, không có dữ liệu
// thật nào ở đây.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import pg from 'pg';

const SERVER_DIR = resolve(import.meta.dirname, '..');

export async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  const client = new pg.Client({ connectionString: url });

  // Container db-test có thể còn đang khởi động khi `npm test` chạy ngay sau `up -d`.
  let lastErr;
  for (let i = 0; i < 20; i++) {
    try {
      await client.connect();
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (lastErr) {
    throw new Error(
      `Không kết nối được CSDL test (${url}). Chạy:\n` +
        '  docker compose -f deploy/docker-compose.dev.yml up -d\n' +
        `Lỗi gốc: ${lastErr.message}`
    );
  }

  const { rows } = await client.query('SELECT current_database() AS db');
  if (!rows[0].db.endsWith('_test')) {
    throw new Error(
      `CSDL "${rows[0].db}" không có hậu tố _test — không xoá. Kiểm TEST_DATABASE_URL.`
    );
  }
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.end();

  // Gọi thẳng file JS của node-pg-migrate bằng chính Node đang chạy. Không gọi `npx` —
  // từ Node 20 trở đi Windows chặn spawn file .cmd (EINVAL), test sẽ đỏ trên máy Windows.
  const migrateBin = resolve(SERVER_DIR, 'node_modules/node-pg-migrate/bin/node-pg-migrate.js');
  execFileSync(
    process.execPath,
    [migrateBin, '--migrations-dir', 'src/db/migrations', '--migration-file-language', 'sql', 'up'],
    { cwd: SERVER_DIR, env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' }
  );
}
