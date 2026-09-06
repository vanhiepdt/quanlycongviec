// Quản lý webhook Zalo — `npm run zalo:webhook -- <lệnh>`:
//   set <url>  đặt webhook (url PHẢI là https:// công khai — Zalo từ chối localhost/IP nội bộ)
//   xem        trạng thái webhook hiện tại (getWebhookInfo)
//   thu        nhờ Zalo tự gọi thử để chẩn đoán (testWebhook)
//   bo         bỏ webhook, trả bot về chế độ nhận bằng getUpdates
//
// Secret token lấy từ `ZALO_BOT_SECRET_TOKEN` trong env — KHÔNG nhận secret qua argv để nó không nằm
// trong lịch sử shell và `ps`. Không in secret ra màn hình ở bất kỳ lệnh nào.
import { env } from '../src/config/env.js';
import * as zalo from '../src/services/zalo.js';

const lenh = String(process.argv[2] ?? '');

function dung(loi) {
  console.error(loi);
  process.exit(1);
}

if (!zalo.daBat()) dung('ZALO_BOT_TOKEN chưa được cấu hình — tính năng đang TẮT.');

function xuat(kq, thanhCong) {
  if (!kq.ok) dung(`Thất bại: ${kq.loi}`);
  console.log(thanhCong);
  if (kq.ket_qua != null) console.log(JSON.stringify(kq.ket_qua, null, 2));
  process.exit(0);
}

if (lenh === 'set') {
  const url = String(process.argv[3] ?? '').trim();
  if (!/^https:\/\//i.test(url)) dung('URL webhook phải là https:// công khai (Zalo từ chối localhost).');
  const secret = String(env.ZALO_BOT_SECRET_TOKEN ?? '').trim();
  if (secret.length < 8)
    dung('ZALO_BOT_SECRET_TOKEN trống hoặc dưới 8 ký tự — đặt vào deploy/.env rồi chạy lại.');
  const kq = await zalo.datWebhook({ url, secretToken: secret });
  xuat(kq, `Đã đặt webhook về ${url}.`);
} else if (lenh === 'xem') {
  xuat(await zalo.xemWebhook(), 'Trạng thái webhook:');
} else if (lenh === 'thu') {
  xuat(await zalo.thuWebhook(), 'Kết quả Zalo tự thử gọi webhook:');
} else if (lenh === 'bo') {
  xuat(await zalo.boWebhook(), 'Đã bỏ webhook — bot nhận tin bằng getUpdates (zalo:polling).');
} else {
  dung('Cú pháp: npm run zalo:webhook -- set <url> | xem | thu | bo');
}
