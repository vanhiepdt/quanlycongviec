// Gán tay liên kết Zalo — `npm run zalo:link -- <email> <chat_id>`.
//
// Đường vòng cho máy dev / khi webhook chưa đặt được (webhook đòi domain HTTPS công khai). Cùng một
// đích với luồng LIENKET qua bot: ghi `users.zalo_chat_id` để lịch đẩy biết gửi cho ai. Chạy lệnh này
// xong, `dayThongBaoZalo` đẩy được tin ngay, không cần thêm gì.
//
// KHÔNG in `chat_id` của NGƯỜI KHÁC ra màn hình: nếu chat_id đã thuộc người khác, chỉ nói «đã thuộc
// tài khoản khác» — lệnh này cho một người dùng, không phải công cụ dò định danh Zalo của ai.
import { pool } from '../src/db/pool.js';
import * as logsRepo from '../src/modules/activityLogs/repo.js';
import * as usersRepo from '../src/modules/users/repo.js';
import * as zaloRepo from '../src/modules/zalo/repo.js';

const [email, chatId] = process.argv.slice(2);
if (!email || !chatId) {
  console.error('Cú pháp: npm run zalo:link -- <email> <chat_id>');
  process.exit(1);
}

try {
  const nguoi = await usersRepo.findByEmail(email);
  if (!nguoi) {
    console.error(`Không tìm thấy người dùng với email "${email}".`);
    process.exit(2);
  }

  const chuCu = await zaloRepo.nguoiGiuChatId(chatId);
  if (chuCu && Number(chuCu.id) !== Number(nguoi.id)) {
    console.error('chat_id này đang thuộc một tài khoản khác trong hệ thống.');
    console.error('Người đó phải bỏ liên kết trước (hoặc dùng chat_id khác).');
    process.exit(3);
  }

  await zaloRepo.ganChatId({ userId: nguoi.id, chatId });
  await logsRepo.writeLog({
    actorId: nguoi.id,
    actorName: nguoi.full_name ?? '',
    action: 'zalo.lien-ket-cli',
    entityType: 'user',
    entityId: nguoi.id,
    details: {},
  });
  console.log(`Đã liên kết Zalo cho ${nguoi.full_name || nguoi.code} (${nguoi.email}).`);
} finally {
  await pool.end();
}
