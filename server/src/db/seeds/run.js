// Bộ chạy dữ liệu mẫu. Không có `psql` trên máy Windows của dự án, nên đọc file .sql rồi gửi
// qua chính pool của ứng dụng.
//
// Hai chốt an toàn, vì file này XOÁ và GHI ĐÈ người dùng:
//   1. NODE_ENV = 'production'  → từ chối chạy, thoát mã 1.
//   2. DATABASE_URL trỏ tới CSDL có tên chứa 'prod' → cũng từ chối. Chốt 1 dựa vào biến môi
//      trường mà người chạy tay rất dễ đặt sai; chốt 2 dựa vào chính đích đến.
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';
import { closePool, query } from '../pool.js';

const HERE = dirname(fileURLToPath(import.meta.url));

function refuse(reason) {
  process.stderr.write(`[seed] TỪ CHỐI: ${reason}\n`);
  process.exit(1);
}

function assertSafeTarget() {
  if (env.NODE_ENV === 'production') {
    refuse('NODE_ENV=production. Dữ liệu mẫu chỉ dành cho máy dev và UAT.');
  }
  const dbName = (() => {
    try {
      return new URL(env.DATABASE_URL).pathname.replace(/^\//, '');
    } catch {
      return '';
    }
  })();
  if (/prod/i.test(dbName)) {
    refuse(`tên CSDL "${dbName}" trông như production.`);
  }
  return dbName;
}

export async function runSeed(fileName = 'dev.sql') {
  const dbName = assertSafeTarget();
  const sql = await readFile(resolve(HERE, fileName), 'utf8');
  await query(sql);
  // Đếm cả phần nghiệp vụ: người chạy seed cần thấy ngay là dữ liệu mẫu có công việc và nhiệm
  // vụ để bấm thử, không phải chỉ có tài khoản.
  const { rows } = await query(
    `SELECT (SELECT count(*) FROM departments)         AS departments,
            (SELECT count(*) FROM users)               AS users,
            (SELECT count(*) FROM department_managers) AS managers,
            (SELECT count(*) FROM works)               AS works,
            (SELECT count(*) FROM work_items WHERE level = 2) AS subworks,
            (SELECT count(*) FROM work_items WHERE level = 3) AS tasks,
            (SELECT count(*) FROM reminders)           AS reminders,
            (SELECT count(*) FROM proposals)           AS proposals,
            (SELECT count(*) FROM apps)                AS apps,
            (SELECT count(*) FROM chat_messages)       AS chats,
            (SELECT count(*) FROM notifications)       AS notifications,
            (SELECT count(*) FROM activity_logs)       AS logs`
  );
  return { dbName, ...rows[0] };
}

// Chỉ tự chạy khi được gọi trực tiếp; import từ test thì không chạy gì.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const r = await runSeed(process.argv[2] ?? 'dev.sql');
    process.stdout.write(
      `[seed] xong trên CSDL "${r.dbName}":\n` +
        `[seed]   ${r.departments} phòng, ${r.users} người dùng, ${r.managers} phân công quản lý\n` +
        `[seed]   ${r.works} công việc, ${r.subworks} công việc con, ${r.tasks} nhiệm vụ, ` +
        `${r.reminders} nhắc việc\n` +
        `[seed]   ${r.proposals} đề nghị, ${r.apps} app, ${r.chats} tin nhắn, ` +
        `${r.notifications} thông báo, ${r.logs} dòng nhật ký\n` +
        `[seed] Mật khẩu mọi tài khoản mẫu: Test@12345 (bị bắt đổi ở lần đăng nhập đầu).\n`
    );
  } catch (err) {
    process.stderr.write(`[seed] lỗi: ${err.message}\n`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

export default runSeed;
