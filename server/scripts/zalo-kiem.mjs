// Kiểm tra token Zalo Bot — `npm run zalo:kiem`.
//
// Gọi `getMe` và in THÔNG TIN BOT khi token đúng. KHÔNG BAO GIỜ in token: nó nằm trong đường dẫn
// của mọi lời gọi Zalo, lộ ra là người khác gửi tin thay bot được.
import * as zalo from '../src/services/zalo.js';

if (!zalo.daBat()) {
  console.error('ZALO_BOT_TOKEN chưa được cấu hình — tính năng đang TẮT.');
  process.exit(1);
}

const kq = await zalo.kiemToken();
if (!kq.ok) {
  console.error(`Kiểm token thất bại: ${kq.loi}`);
  console.error('Nếu báo «Unauthorized»: token sai hoặc đã bị thu hồi — cần token MỚI ở deploy/.env.');
  process.exit(1);
}

console.log('Token hợp lệ. Thông tin bot:');
console.log(JSON.stringify(kq.ket_qua, null, 2));
process.exit(0);
