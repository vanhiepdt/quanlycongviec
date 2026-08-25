// Lịch chạy trong container `app` — thay `setupDailyTrigger` của Apps Script (§7 việc 5.8, J2).
//
// Ba quyết định đáng ghi:
//
// 1. **Hàm quét tách rời khỏi lịch.** `quetQuaHan({ now })` là hàm thường, nhận đồng hồ từ ngoài
//    và trả về con số đã làm. Lịch chỉ gọi nó. Nhờ vậy test chạy được cả luồng trong một phần
//    nghìn giây với ngày giả, thay vì chờ 07:00 hoặc phải giả lập `node-cron`.
//
// 2. **Chống trùng bằng CSDL, không bằng biến nhớ.** Một nhiệm vụ quá hạn 30 ngày mà quét mỗi
//    ngày là 30 dòng thông báo giống hệt nếu không hỏi lại. Câu hỏi "hôm nay đã báo chưa" hỏi
//    thẳng bảng `notifications` (`repo.exists` với `since` = đầu ngày hôm nay), nên khởi động lại
//    container giữa chừng cũng không sinh thêm bản trùng — biến nhớ thì mất theo tiến trình.
//    Bản Apps Script chống trùng bằng cách dò chuỗi `[mã]` trong nội dung MỌI dòng thông báo, tức
//    là báo một lần rồi thôi vĩnh viễn; ở đây báo lại mỗi ngày, vì một việc quá hạn tuần thứ ba
//    vẫn cần nhắc.
//
// 3. **Chỉ nhiệm vụ đã qua cửa duyệt mới được nhắc** — quét đọc `v_countable_items` (việc 5.4),
//    không đọc `work_items`. Nhắc người ta về một việc mà chính họ chưa được duyệt để làm là sai,
//    và nó cũng là đúng cái lỗ mà hai view sinh ra để bịt.
import cron from 'node-cron';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { logger } from '../utils/logger.js';
import * as notiRepo from '../modules/notifications/repo.js';

/** Nhiệm vụ đã xong thì không quá hạn nữa, dù hạn chót đã lùi lại bao lâu. */
const TRANG_THAI_XONG = 'Hoàn thành';

/**
 * Nhiệm vụ quá hạn CHƯA xong, kèm người thực hiện.
 *
 * `due_date` là `date` (không giờ) nên so với NGÀY, không so với dấu thời gian: một việc hạn chót
 * hôm nay chưa phải quá hạn cho tới hết ngày. `assignee_id IS NOT NULL` vì thông báo phải có người
 * nhận — dữ liệu cũ có dòng chỉ ghi tên người bằng chuỗi tự do, không dò ra tài khoản nào.
 */
async function timNhiemVuQuaHan(ngay, client) {
  const { rows } = await client.query(
    `SELECT i.id, i.code, i.name, i.due_date, i.assignee_id
       FROM v_countable_items i
      WHERE i.due_date IS NOT NULL
        AND i.due_date < $1::date
        AND i.status <> $2
        AND i.assignee_id IS NOT NULL
      ORDER BY i.due_date, i.id`,
    [ngay, TRANG_THAI_XONG]
  );
  return rows;
}

/** "dd/MM/yyyy" — đúng dạng người dùng đọc trên giao diện. */
function ngayVietNam(value) {
  const d = value instanceof Date ? value : new Date(value);
  const hai = (n) => String(n).padStart(2, '0');
  return `${hai(d.getDate())}/${hai(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * "yyyy-MM-dd" theo giờ ĐỊA PHƯƠNG của tiến trình (`TZ`).
 *
 * KHÔNG dùng `toISOString().slice(0,10)` ở đây, và đây là chỗ đã sai một lần: `toISOString` đổi
 * sang UTC trước, nên nửa đêm ở Việt Nam (+07) thành 17:00 của NGÀY HÔM TRƯỚC và cả lượt quét
 * lệch đúng một ngày — nhiệm vụ quá hạn từ hôm qua không được nhắc. Cột `due_date` là `date`
 * (không có múi giờ), nên mốc so sánh cũng phải là ngày theo lịch địa phương.
 */
function ngaySo(d) {
  const hai = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`;
}

/** Đầu ngày (00:00) của một mốc thời gian — mốc để hỏi "hôm nay đã báo chưa". */
function dauNgay(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Một lượt quét nhiệm vụ quá hạn.
 *
 * @param {object} opts
 * @param {Date} opts.now đồng hồ — test truyền đồng hồ giả, lịch chạy truyền `new Date()`
 * @returns {Promise<{quaHan: number, daBao: number, boQua: number}>} số nhiệm vụ quá hạn tìm được,
 *   số thông báo mới tạo, số bỏ qua vì hôm nay đã báo rồi
 */
export async function quetQuaHan({ now = new Date() } = {}) {
  const client = await pool.connect();
  try {
    const homNay = dauNgay(now);
    const danhSach = await timNhiemVuQuaHan(ngaySo(homNay), client);

    const canTao = [];
    let boQua = 0;
    for (const nv of danhSach) {
      // Hỏi từng dòng chứ không gộp một câu: số nhiệm vụ quá hạn thực tế là vài chục, còn câu gộp
      // phải dựng danh sách id động — đánh đổi không đáng cho một việc chạy mỗi ngày một lần.
      const daCo = await notiRepo.exists(
        {
          userId: nv.assignee_id,
          type: notiRepo.LOAI.QUA_HAN,
          refType: 'work_item',
          refId: nv.id,
          since: homNay,
        },
        client
      );
      if (daCo) {
        boQua += 1;
        continue;
      }
      canTao.push({
        userId: nv.assignee_id,
        content: `Nhiệm vụ "${nv.name}" (${nv.code}) đã quá hạn ${ngayVietNam(nv.due_date)}.`,
        type: notiRepo.LOAI.QUA_HAN,
        refType: 'work_item',
        refId: nv.id,
      });
    }

    const daTao = await notiRepo.insertMany(canTao, client);
    const ketQua = { quaHan: danhSach.length, daBao: daTao.length, boQua };
    logger.info(ketQua, 'Quét nhiệm vụ quá hạn xong');
    return ketQua;
  } finally {
    client.release();
  }
}

/** Việc đã đăng ký, giữ lại để `dungLichChay()` gỡ được — tránh chồng lịch khi test/khởi động lại. */
let viecDaDangKy = null;

/**
 * Bật lịch chạy. Trả về `null` khi `CRON_ENABLED=false` — chỗ gọi không phải tự kiểm cờ.
 *
 * Lỗi trong một lượt quét được NUỐT lại (chỉ ghi log): một lượt hỏng vì CSDL bận không được phép
 * làm chết tiến trình đang phục vụ người dùng, và lượt sau vẫn phải chạy.
 */
export function batLichChay() {
  if (!env.CRON_ENABLED) {
    logger.info({ CRON_ENABLED: false }, 'Lịch chạy đang tắt, bỏ qua');
    return null;
  }
  if (!cron.validate(env.CRON_OVERDUE)) {
    logger.error({ CRON_OVERDUE: env.CRON_OVERDUE }, 'Biểu thức lịch không hợp lệ, không bật lịch');
    return null;
  }
  dungLichChay();
  viecDaDangKy = cron.schedule(
    env.CRON_OVERDUE,
    async () => {
      try {
        await quetQuaHan({ now: new Date() });
      } catch (err) {
        logger.error({ err: err.message }, 'Lượt quét nhiệm vụ quá hạn hỏng');
      }
    },
    { timezone: env.TZ }
  );
  logger.info({ lich: env.CRON_OVERDUE, tz: env.TZ }, 'Đã bật lịch quét nhiệm vụ quá hạn');
  return viecDaDangKy;
}

/** Gỡ lịch. Gọi khi tắt máy chủ để tiến trình không bị giữ lại bởi bộ đếm giờ. */
export function dungLichChay() {
  if (!viecDaDangKy) return;
  viecDaDangKy.stop();
  viecDaDangKy = null;
}
