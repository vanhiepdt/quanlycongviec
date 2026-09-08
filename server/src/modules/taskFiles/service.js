// Nghiệp vụ «KẾT QUẢ NHIỆM VỤ LÀ FILE» (014, 2026-09-01) — nộp → góp ý → duyệt, và MỌI «cửa
// duyệt» đọc giá trị HIỆU LỰC từ Bảng phân quyền động (`giaTriHieuLuc` — ma trận + ghi đè 009/
// 010/011 nới bởi 014). Thay đổi của admin trong bảng có hiệu lực NGAY cho lần nộp/duyệt sau —
// `attachSession` nạp lại `user.ghiDe` mỗi request, service không đọc CSDL để xét quyền.
//
// Năm trạng thái nhóm (CHECK trong 014): cho-xem · can-sua · cho-lanh-dao · hoan-thanh · da-duyet.
// Hai trạng thái cuối là TRẠNG THÁI KẾT — không nộp thêm (409), không verdict (409).
//
// Quy tắc tự-động (lõi của đợt này): SAU khi lưu bản nộp, đọc `giaTriHieuLuc(user,'file','create')`
// của NGƯỜI NỘP —
//   'cho-phep'  ⇒ bỏ qua cửa xem/duyệt: nhóm chuyển thẳng 'da-duyet' + dòng luồng
//                 'duyet-tu-dong' «Tự động — phân quyền không yêu cầu duyệt».
//   'cho-duyet' ⇒ luồng thường: Cán bộ nộp về 'cho-xem', TP/PP nộp về 'cho-lanh-dao'.
// Nút chốt của NGƯỜI KHÁC không bao giờ được bấm hộ: '✓' chỉ làm nút đó xuất hiện cho đúng vai.
//
// Ba điểm đáng nói:
//  1. **Quyền không viết lại ở đây** — `can()` (rbac) trả lời «vai này được làm gì», `inScope()`
//     bó theo phòng của nhiệm vụ; state machine ở đây chỉ thêm luật TRẠNG THÁI (ai được nộp khi
//     file đang nằm ở tay ai). Không nhân đôi điều kiện phòng — tránh nguồn sự thật thứ hai.
//  2. **Máy chủ là rào chặn cuối**: giao diện ẩn/hiện nút theo `GET /permissions`, nhưng mọi
//     hành động vẫn qua `can()` + bảng verdict ở đây.
//  3. **Thông báo nằm trong CÙNG giao dịch** với lần đổi trạng thái (tiền lệ approvals) — hỏng
//     giữa chừng thì không có «đã duyệt mà người ta không bao giờ biết».
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as cho } from 'node:timers/promises';
import { withTransaction } from '../../db/pool.js';
import { can, giaTriHieuLuc } from '../../middleware/rbac.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import * as deptRepo from '../departments/repo.js';
import * as itemsRepo from '../workItems/repo.js';
import * as notificationsRepo from '../notifications/repo.js';
import * as repo from './repo.js';

/**
 * Giới hạn dung lượng mỗi bản. Người dùng chốt 2026-09-03: nới 20 MB → **50 MB** cùng lúc mở thêm
 * PowerPoint/Excel/ảnh — slide nhiều ảnh và ảnh máy điện thoại đời mới vượt 20 MB là chuyện thường.
 *
 * Multer đang dùng `memoryStorage` ⇒ mỗi file nằm TRỌN trong RAM lúc tải; đây là lý do không nâng
 * cao hơn nữa (§13.5 — nâng tiếp thì phải chuyển multer sang ghi tạm ra đĩa trước).
 */
export const DUNG_LUONG_TOI_DA = 50 * 1024 * 1024; // 50 MB

/** Nhãn dung lượng dùng trong MỌI câu lỗi — một chỗ, khỏi lệch số giữa các câu. */
export const NHAN_DUNG_LUONG = '50 MB';

/**
 * Loại file nhận: đuôi → DANH SÁCH mimeType hợp lệ của đuôi đó. Đuôi và mimeType phải LÀ CẶP
 * (xem whitelist trong `nop`); mime đầu danh sách là mime chuẩn, các mime sau là biến thể máy
 * khách cũ vẫn còn gửi (Office 2003 và vài trình duyệt cũ).
 *
 * KHÔNG nhận `.svg`: SVG là XML chạy được `<script>`, mở inline trên trình duyệt là lỗ XSS lưu
 * trữ. Ảnh raster (jpg/png/gif/webp) không chạy được mã nên mở inline an toàn — xem `MIME_XEM_INLINE`.
 */
export const DUOI_FILE_HOP_LE = Object.freeze({
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.pdf': ['application/pdf'],
  '.xls': ['application/vnd.ms-excel', 'application/excel', 'application/x-msexcel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.ppt': [
    'application/vnd.ms-powerpoint',
    'application/mspowerpoint',
    'application/x-mspowerpoint',
  ],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.jpg': ['image/jpeg', 'image/pjpeg'],
  '.jpeg': ['image/jpeg', 'image/pjpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
});

/** Regex đuôi hợp lệ — SINH từ chính bảng trên để hai chỗ không bao giờ lệch nhau. */
const RE_DUOI_HOP_LE = new RegExp(
  `\\.(${Object.keys(DUOI_FILE_HOP_LE)
    .map((d) => d.slice(1))
    .join('|')})$`,
  'i'
);

/** Danh sách đuôi in ra trong câu lỗi — cũng sinh từ bảng, khỏi phải sửa hai nơi. */
const DANH_SACH_DUOI = Object.keys(DUOI_FILE_HOP_LE).join(' ');

/**
 * Những mimeType được MỞ XEM ngay trên trình duyệt (`?inline=1`). Chỉ PDF và ảnh raster: không có
 * SVG nên không có đường chạy mã; helmet đã đặt `X-Content-Type-Options: nosniff` nên trình duyệt
 * không tự đoán lại kiểu. Mọi thứ khác luôn tải về dạng attachment.
 */
export const MIME_XEM_INLINE = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

/** Gốc lưu file: server/storage/ket-qua/{itemId}/v{n}-{uuid}.{ext} — đã đưa vào .gitignore. */
export const GOC_STORAGE = path.resolve(process.cwd(), 'storage', 'ket-qua');

/** Nhãn trạng thái cho câu thông báo (giao diện tự có nhãn/badge riêng). */
const NHAN_TRANG_THAI = Object.freeze({
  'cho-xem': 'chờ Trưởng phòng/Phó phòng xem',
  'can-sua': 'cần nộp bản sửa',
  'cho-lanh-dao': 'chờ Phó GĐ/Giám đốc xem',
  'hoan-thanh': 'đã hoàn thành',
  'da-duyet': 'đã duyệt',
});

const KET_THUC = Object.freeze(['hoan-thanh', 'da-duyet']);
const DO_DAI_NOI_DUNG_TOI_THIEU = 10;

/**
 * ĐỊNH DẠNG khai trước (016) — khớp CHECK `tf_dinh_dang_ok` của CSDL và `NHAN_DINH_DANG` của
 * client. «Báo cáo» là loại DUY NHẤT không cần file: nội dung nhập thẳng thành BẢN không có file
 * (người dùng chốt 2026-09-03: «như một BẢN không có file»), năm loại còn lại là lời hứa sẽ nộp
 * file đúng loại đó — máy chủ KHÔNG chặn nộp lệch loại, chỉ chặn đuôi ngoài `DUOI_FILE_HOP_LE`:
 * khai «Word» rồi nộp PDF là chuyện thường ở cơ quan, chặn cứng chỉ làm người dùng bế tắc.
 */
export const DINH_DANG_KHAI = Object.freeze(['Word', 'Excel', 'PPT', 'PDF', 'Ảnh', 'Báo cáo']);

/** «Báo cáo» = kết quả là CHỮ, không có file nào để tải. */
export const DINH_DANG_BAO_CAO = 'Báo cáo';

/**
 * Đuôi file → nhãn định dạng (016) — dùng khi nhóm mở trực tiếp bằng cách nộp file: khai lại thứ
 * đã nằm trong chính tên file là việc vô nghĩa. Đuôi lạ không bao giờ tới đây (`nop` đã chặn bằng
 * `DUOI_FILE_HOP_LE`), nhưng vẫn trả `null` cho chắc — cột `dinh_dang` cho phép NULL.
 */
const DINH_DANG_THEO_DUOI = Object.freeze({
  '.doc': 'Word',
  '.docx': 'Word',
  '.pdf': 'PDF',
  '.xls': 'Excel',
  '.xlsx': 'Excel',
  '.ppt': 'PPT',
  '.pptx': 'PPT',
  '.jpg': 'Ảnh',
  '.jpeg': 'Ảnh',
  '.png': 'Ảnh',
  '.gif': 'Ảnh',
  '.webp': 'Ảnh',
});

function dinhDangTheoDuoi(duoi) {
  return DINH_DANG_THEO_DUOI[String(duoi ?? '').toLowerCase()] ?? null;
}

const sameId = (a, b) => a != null && b != null && Number(a) === Number(b);

/**
 * LÃNH ĐẠO PHÒNG PHỤ TRÁCH ĐÚNG NHIỆM VỤ NÀY hay không — luật SIẾT 2026-09-02.
 *
 * Người dùng báo: «Hàng chờ phê duyệt, không phải lãnh đạo phòng phụ trách nhiệm vụ đấy vẫn sửa,
 * phê duyệt được» và chọn phương án CHẶT TUYỆT ĐỐI. Trước đây phạm vi của TP/PP là cả PHÒNG
 * (`inScope` case 'Trưởng phòng') nên mọi TP/PP trong phòng xử được mọi file của phòng.
 *
 * Nay với hai vai 'Trưởng phòng'/'Phó phòng', cửa file đòi thêm: id của họ phải nằm trong
 * `work_items.leader_ids` của CHÍNH nhiệm vụ chứa file (ô «Lãnh đạo phòng phụ trách» của nhiệm vụ,
 * 005_phan_cong.sql — cấp 3 tối đa MỘT người do CHECK `task_leader_single`).
 *   • Nhiệm vụ CHƯA gán lãnh đạo (`leader_ids` rỗng) ⇒ trả false: không TP/PP nào xử được, phải
 *     gán lãnh đạo trước. Đây là lựa chọn của người dùng (không mở cửa dự phòng cho cả phòng).
 *   • admin và 'Phó Giám đốc' KHÔNG đi qua hàm này — họ giữ phạm vi cũ (admin mọi phòng, Phó GĐ
 *     các phòng mình phụ trách), nên file không bao giờ treo vĩnh viễn.
 * Đây là luật TRẠNG THÁI/PHÂN CÔNG, KHÔNG thay `can()`: `can()` vẫn chạy trước để bó phòng.
 */
function laLanhDaoPhuTrachNhiemVu(user, item) {
  const ds = Array.isArray(item?.leader_ids) ? item.leader_ids : [];
  return ds.some((id) => sameId(id, user.id));
}

/** Câu từ chối dùng chung cho mọi cửa file khi TP/PP không phụ trách nhiệm vụ đó. */
function loiKhongPhuTrach() {
  return forbidden(
    'Bạn không phải Lãnh đạo phòng phụ trách nhiệm vụ này — chỉ người được nêu ở ô «Lãnh đạo phòng phụ trách» của nhiệm vụ (hoặc Phó Giám đốc phụ trách / Giám đốc) mới xem, sửa và duyệt được file kết quả. Nhiệm vụ chưa gán lãnh đạo thì phải gán trước.'
  );
}

/**
 * NGƯỜI NHẬN thông báo «có file cần xem/đã sửa» — đúng LÃNH ĐẠO PHÒNG PHỤ TRÁCH NHIỆM VỤ
 * (`leader_ids`), không phải mọi TP/PP của phòng: gửi cho người không có quyền xử là báo rác.
 *
 * Nhiệm vụ CHƯA gán lãnh đạo thì không ai xử được (luật chặt tuyệt đối ở trên) — lúc đó vẫn phải
 * báo cho TP/PP của phòng, kèm câu nhắc gán lãnh đạo, nếu không file nằm im và không ai biết.
 * Trả `{ rows, thieuLanhDao }` để câu thông báo nói đúng tình huống.
 */
async function nguoiNhanLanhDao(item, client) {
  const rows = await repo.nguoiTheoIds(item.leader_ids ?? [], client);
  if (rows.length > 0) return { rows, thieuLanhDao: false };
  return {
    rows: await repo.lanhDaoPhuTrach(item.department_id, client),
    thieuLanhDao: true,
  };
}

/** Đuôi câu nhắc khi nhiệm vụ chưa gán «Lãnh đạo phòng phụ trách» (không ai duyệt được file). */
const NHAC_GAN_LANH_DAO =
  ' LƯU Ý: nhiệm vụ chưa gán «Lãnh đạo phòng phụ trách» nên chưa ai xử được file — cần gán trước.';

/**
 * Tên file gửi lên bị MẤT DẤU TIẾNG VIỆT — sửa ở đúng một chỗ.
 *
 * Trình duyệt gửi `filename` trong Content-Disposition của multipart dưới dạng **UTF-8**, nhưng
 * busboy (nhân của multer) giải mã bằng **latin1** ⇒ `BÀI 2.docx` thành `BÃ€I 2.docx`. Lỗi này
 * người dùng thấy ngay trên khối «Kết quả» và cả trong tiêu đề trang sửa trực tuyến (2026-09-02).
 * multer 2.x không có tuỳ chọn đổi bảng mã, nên phải giải ngược tại đây.
 *
 * Ba lớp canh để không làm hỏng tên vốn đã đúng:
 *   1. Toàn ASCII ⇒ không có gì phải sửa.
 *   2. Có ký tự ngoài latin1 (ví dụ 'À' thật) ⇒ máy khách/đường truyền đã đưa UTF-8 đúng, giữ nguyên.
 *   3. Giải ra có ký tự thay thế U+FFFD ⇒ không phải UTF-8, giữ nguyên bản gốc.
 */
export function tenGocUtf8(ten) {
  const s = String(ten ?? '');
  if (!/[\u0080-\u00ff]/.test(s)) return s;
  // Ký tự nào ngoài dải latin1 (mã > 0xff) ⇒ chuỗi đã là UTF-8 đúng, không đụng tới. Viết bằng
  // `codePointAt` chứ không phải regex `[^\u0000-\u00ff]`: lớp phủ định đó chứa \x00 nên eslint
  // báo `no-control-regex` (đúng luật — control char trong regex thường là lỗi đánh máy).
  for (const kt of s) {
    if (kt.codePointAt(0) > 0xff) return s;
  }
  const lai = Buffer.from(s, 'latin1').toString('utf8');
  return lai.includes('\ufffd') ? s : lai;
}

/** Nhiệm vụ chứa nhóm file — đồng thời là dòng xét phạm vi (`can()`/`inScope()`). */
async function mustFindNhiemVu(ref, client = null) {
  const item = await itemsRepo.findByRef(ref, client);
  if (!item) throw notFound(`Không tìm thấy nhiệm vụ "${ref}"`);
  if (Number(item.level) !== itemsRepo.LEVEL_TASK) {
    throw badRequest(
      'Chỉ NHIỆM VỤ (cấp 3) mới nộp được file kết quả — công việc/công việc con không có kết quả file'
    );
  }
  return item;
}

function assertCan(user, action, row, entityType = 'file') {
  const verdict = can(user, action, entityType, row);
  if (!verdict.ok) throw new AppError(verdict.code, verdict.message);
}

/** Gom người nhận (người phải sửa…), bỏ chính người hành động và trùng lặp. */
function bao(user, ids, content, type, refId, client) {
  const bo = new Set([user.id, null, undefined]);
  const nguoiNhan = [...new Set(ids.filter((id) => id != null && !bo.has(Number(id))))];
  if (nguoiNhan.length === 0) return [];
  return notificationsRepo.insertMany(
    nguoiNhan.map((userId) => ({
      userId: Number(userId),
      content,
      type,
      refType: 'task_file',
      refId,
    })),
    client
  );
}

/** Gửi cho một danh sách người có sẵn (TP/PP phòng, Phó GĐ phụ trách). */
function baoNguoiNhan(user, rows, content, type, refId, client) {
  return notificationsRepo.insertMany(
    rows.map((u) => ({
      userId: Number(u.id ?? u.user_id),
      content,
      type,
      refType: 'task_file',
      refId,
    })),
    client
  );
}

/**
 * KHOÁ + KIỂM một nhóm có sẵn trước khi thêm bản (dùng cho cả nộp file và nộp «Báo cáo»).
 * Trạng thái KẾT ⇒ 409; đang ở tay lãnh đạo ⇒ chỉ TP/PP và Phó GĐ/GĐ nộp được bản mới.
 */
async function nhomDeThemBan(user, item, fileId, client) {
  const nhom = await repo.lockNhomById(Number(fileId), client);
  if (!nhom || Number(nhom.item_id) !== Number(item.id)) {
    throw notFound('Không tìm thấy nhóm file kết quả của nhiệm vụ này');
  }
  if (KET_THUC.includes(nhom.trang_thai)) {
    throw conflict(`File này đã ${NHAN_TRANG_THAI[nhom.trang_thai]} — không nộp thêm được`);
  }
  if (nhom.trang_thai === 'can-sua' && nhom.lenh_sua_cho && !laChuLenhSua(user, nhom, item)) {
    throw forbidden('Chỉ người đang nhận lệnh sửa mới được gửi bản thay thế');
  }
  if (
    nhom.trang_thai === 'cho-lanh-dao' &&
    !['Trưởng phòng', 'Phó phòng', 'Phó Giám đốc', 'admin'].includes(user.role)
  ) {
    throw forbidden(
      'File đang chờ lãnh đạo xem — lúc này chỉ Trưởng phòng/Phó phòng mới nộp được bản mới'
    );
  }
  return nhom;
}

/**
 * SIẾT `leader_ids` cho cửa nộp — TP/PP chỉ nộp/sửa được file của nhiệm vụ mà họ ĐƯỢC NÊU ở ô
 * «Lãnh đạo phòng phụ trách» (2026-09-02). Vai khác không đi qua nhánh này: `can()` đã lo.
 */
function chanTpPpKhongPhuTrach(user, item) {
  if (['Trưởng phòng', 'Phó phòng'].includes(user.role) && !laLanhDaoPhuTrachNhiemVu(user, item)) {
    throw loiKhongPhuTrach();
  }
}

/**
 * QUY TẮC TỰ-ĐỘNG sau khi lưu một bản (file hay «Báo cáo» đều dùng): đọc `file:create` hiệu lực của
 * NGƯỜI NỘP — 'cho-phep' ⇒ chốt luôn 'da-duyet' kèm dòng luồng 'duyet-tu-dong'; TP/PP nộp ⇒
 * 'cho-lanh-dao'; còn lại ⇒ 'cho-xem'. Trả trạng thái mới để bên gọi ghi + soạn câu thông báo.
 */
async function apTuDong(user, nhom, ban, client) {
  const giaTri = giaTriHieuLuc(user, 'file', 'create');
  if (giaTri === 'cho-phep') {
    await repo.themLuong(
      {
        fileId: nhom.id,
        versionId: ban.id,
        nguoiId: user.id,
        vai: user.role,
        hanhDong: 'duyet-tu-dong',
        noiDung: 'Tự động — phân quyền không yêu cầu duyệt',
      },
      client
    );
    return 'da-duyet';
  }
  return ['Trưởng phòng', 'Phó phòng'].includes(user.role) ? 'cho-lanh-dao' : 'cho-xem';
}

/**
 * KHAI MỘT DÒNG KẾT QUẢ TRƯỚC KHI CÓ FILE (016) — nút ＋ của khối «Kết quả».
 *
 * Người dùng chốt 2026-09-03: «Dòng đầu tiên khi mới tạo nhiệm vụ sẽ điền 1. 2. 3. điền những nội
 * dung Kết quả làm được, Định dạng, Ghi ý kiến. Nhớ phải có nút + để thêm dòng để điền 2, 3…».
 * Nhóm sinh ra với **0 bản** ⇒ cột «File đã tải lên» là «Chưa có» và nhóm KHÔNG vào hàng chờ phê
 * duyệt (`listChoDuyetKetQua` đòi `v.id IS NOT NULL`): chưa có gì để duyệt thì đừng bắt ai duyệt.
 *
 * Trạng thái luôn là 'cho-xem' — KHÔNG áp quy tắc tự-động ở đây: chưa có bản nào thì không có cái
 * gì để «duyệt tự động», và để 'da-duyet' là khoá luôn dòng vừa khai (nộp file sau sẽ bị 409).
 *
 * Ý kiến khai kèm ghi vào BẢNG LUỒNG (`hanh_dong = 'nop'`, `version_id` NULL — 014 cho phép), không
 * vào `task_file_comments`: bảng góp ý gắn theo BẢN mà ở đây chưa có bản nào.
 */
export async function khaiKetQua(user, ref, { tenKetQua, dinhDang = null, yKien = '' }) {
  const item = await mustFindNhiemVu(ref);
  const ten = String(tenKetQua ?? '').trim();
  if (!ten) throw badRequest('Vui lòng nhập tên kết quả làm được', 'tenKetQua');
  if (ten.length > 500) throw badRequest('Tên kết quả tối đa 500 ký tự', 'tenKetQua');
  const dd = dinhDang == null || dinhDang === '' ? null : String(dinhDang);
  if (dd != null && !DINH_DANG_KHAI.includes(dd)) {
    throw badRequest(`Định dạng chỉ nhận: ${DINH_DANG_KHAI.join(' · ')}`, 'dinhDang');
  }
  const yk = String(yKien ?? '').trim();
  if (yk.length > 2000) throw badRequest('Ý kiến tối đa 2000 ký tự', 'yKien');

  return withTransaction(async (client) => {
    assertCan(user, 'create', item);
    chanTpPpKhongPhuTrach(user, item);
    const nhom = await repo.themNhom(
      {
        itemId: item.id,
        tenGoc: ten,
        tenKetQua: ten,
        dinhDang: dd,
        trangThai: 'cho-xem',
        createdBy: user.id,
      },
      client
    );
    await repo.themLuong(
      {
        fileId: nhom.id,
        versionId: null,
        nguoiId: user.id,
        vai: user.role,
        hanhDong: 'nop',
        noiDung: yk || `Khai dòng kết quả «${ten}»${dd ? ` — định dạng ${dd}` : ''}, chưa có file`,
      },
      client
    );
    return { nhom, ban: null, tuDong: false };
  });
}

/**
 * NỘP «BÁO CÁO» — kết quả là CHỮ, thành một BẢN KHÔNG CÓ FILE (người dùng chốt: «như một BẢN không
 * có file»). Nhờ vậy nó dùng lại nguyên bộ máy bản/góp ý/bảng luồng/verdict, không có nhánh nghiệp
 * vụ thứ hai: TP/PP vẫn góp ý theo bản, vẫn Yêu cầu sửa / Trình / Duyệt như với file.
 *
 * `fileId` null = mở nhóm mới (dòng kết quả mới, định dạng «Báo cáo»); có = thêm bản vào nhóm đã
 * khai trước. Không ghi đĩa, không kiểm đuôi/dung lượng — chỉ độ dài chữ (CHECK `tfv_file_hoac_chu`
 * đòi ≥ 10 ký tự sau khi bỏ trắng, kiểm ở đây để trả câu tiếng Việt thay vì lỗi CSDL).
 */
export async function nopBaoCao(user, ref, { noiDung, tenGoc = '', fileId = null }) {
  const item = await mustFindNhiemVu(ref);
  const nd = String(noiDung ?? '').trim();
  if (nd.length < DO_DAI_NOI_DUNG_TOI_THIEU) {
    throw badRequest(`Nội dung báo cáo cần ít nhất ${DO_DAI_NOI_DUNG_TOI_THIEU} ký tự`, 'noiDung');
  }
  if (nd.length > 20000) throw badRequest('Nội dung báo cáo tối đa 20000 ký tự', 'noiDung');
  const tenNhap = String(tenGoc ?? '').trim();
  if (tenNhap.length > 500) throw badRequest('Tên báo cáo tối đa 500 ký tự', 'tenGoc');

  return withTransaction(async (client) => {
    assertCan(user, 'create', item);
    let nhom = fileId != null ? await nhomDeThemBan(user, item, fileId, client) : null;
    chanTpPpKhongPhuTrach(user, item);

    // Tiêu đề bản: ưu tiên tên người dùng nhập, rồi tên kết quả đã khai của nhóm, cuối cùng mặc
    // định — cột `ten_goc` của bản là NOT NULL và bảng kết quả in nó ở cột «File đã tải lên».
    const ten = tenNhap || nhom?.ten_ket_qua || nhom?.ten_goc || 'Báo cáo';
    const versionNo = (nhom ? await repo.soBanCaoNhat(nhom.id, client) : 0) + 1;
    if (!nhom) {
      nhom = await repo.themNhom(
        {
          itemId: item.id,
          tenGoc: ten,
          tenKetQua: ten,
          dinhDang: DINH_DANG_BAO_CAO,
          trangThai: 'cho-xem',
          createdBy: user.id,
        },
        client
      );
    }
    const ban = await repo.themBan(
      { fileId: nhom.id, versionNo, tenGoc: ten, noiDung: nd, uploadedBy: user.id },
      client
    );
    await repo.themLuong(
      {
        fileId: nhom.id,
        versionId: ban.id,
        nguoiId: user.id,
        vai: user.role,
        hanhDong: 'nop',
        noiDung: `Báo cáo (nhập chữ, không có file) — bản ${versionNo}`,
      },
      client
    );

    const trangThaiMoi = await apTuDong(user, nhom, ban, client);
    const capNhat = await repo.doiTrangThai(nhom.id, trangThaiMoi, client);

    const { rows: tpPp, thieuLanhDao } = await nguoiNhanLanhDao(item, client);
    const nhac = thieuLanhDao ? NHAC_GAN_LANH_DAO : '';
    if (trangThaiMoi === 'da-duyet') {
      await baoNguoiNhan(
        user,
        tpPp,
        `Nhiệm vụ "${item.name}": báo cáo "${ten}" bản ${versionNo} được phê duyệt tự động — phân quyền không yêu cầu duyệt.`,
        notificationsRepo.LOAI.DA_DUYET,
        nhom.id,
        client
      );
    } else if (trangThaiMoi === 'cho-lanh-dao') {
      await baoNguoiNhan(
        user,
        await phoGiamDocPhuTrach(item.department_id, client),
        `Nhiệm vụ "${item.name}": ${user.full_name} nộp bản ${versionNo} của báo cáo "${ten}" — chờ Phó GĐ phụ trách xem.`,
        notificationsRepo.LOAI.CHO_DUYET,
        nhom.id,
        client
      );
    } else {
      await baoNguoiNhan(
        user,
        tpPp,
        `Nhiệm vụ "${item.name}": ${user.full_name} nộp bản ${versionNo} của báo cáo "${ten}" — ${NHAN_TRANG_THAI[trangThaiMoi]}.${nhac}`,
        notificationsRepo.LOAI.CHO_DUYET,
        nhom.id,
        client
      );
    }

    return {
      nhom: { ...nhom, ...capNhat },
      ban,
      tuDong: trangThaiMoi === 'da-duyet',
    };
  });
}

/**
 * NỘP BẢN MỚI. `fileId` có thì nộp thêm bản vào NHÓM có sẵn; không có thì mở NHÓM mới (v1).
 *
 * Sau khi lưu bản, áp QUY TẮC TỰ-ĐỘNG theo giá trị hiệu lực `file:create` của người nộp —
 * xem đầu file. Trả về `{ nhom, ban, tuDong }` (tuDong = đã chốt tự động hay không).
 */
export async function nop(user, ref, { buffer, tenGoc, loaiMime, fileId = null, moTa = '' }) {
  const item = await mustFindNhiemVu(ref);

  // Whitelist: đuôi + mimeType + dung lượng. Đuôi và mimeType phải LÀ CẶP đúng (file .pdf mang
  // mime của Word là dữ liệu dối trá); riêng 'application/octet-stream' được tha cho máy khách
  // cũ không đặt đúng mime. TÊN GỐC chỉ để hiển thị, không bao giờ làm đường dẫn (tên vật lý
  // sinh sẵn bên dưới — cấm path traversal); `tenGocUtf8` trả lại dấu tiếng Việt bị busboy làm hỏng.
  //
  // 2026-09-03: mở thêm Excel/PowerPoint/ảnh (người dùng chốt) ⇒ mỗi đuôi có thể có NHIỀU mime hợp
  // lệ (Office 2003 gửi mime khác nhau tuỳ trình duyệt) nên so bằng `includes`, không so bằng `===`.
  const tenSan = tenGocUtf8(tenGoc);
  const duoi = (tenSan.match(RE_DUOI_HOP_LE) ?? [])[0]?.toLowerCase();
  const mimeChoDuoi = duoi ? DUOI_FILE_HOP_LE[duoi] : null;
  const mimeGui = String(loaiMime ?? '');
  if (!duoi || !(mimeChoDuoi.includes(mimeGui) || mimeGui === 'application/octet-stream')) {
    throw badRequest(
      `Chỉ nhận file ${DANH_SACH_DUOI}, dung lượng tối đa ${NHAN_DUNG_LUONG}`,
      'file'
    );
  }
  const kichThuoc = Number(buffer?.length ?? 0);
  if (!kichThuoc) throw badRequest('File rỗng hoặc không đọc được', 'file');
  if (kichThuoc > DUNG_LUONG_TOI_DA) {
    throw badRequest(`File vượt quá dung lượng tối đa ${NHAN_DUNG_LUONG}`, 'file');
  }

  return withTransaction(async (client) => {
    assertCan(user, 'create', item);

    const nhomCo = fileId != null ? await nhomDeThemBan(user, item, fileId, client) : null;
    let nhom = nhomCo;
    chanTpPpKhongPhuTrach(user, item);

    const versionNo = (nhom ? await repo.soBanCaoNhat(nhom.id, client) : 0) + 1;
    const tenLuu = `v${versionNo}-${randomUUID()}${duoi}`;

    const thuMuc = path.join(GOC_STORAGE, String(item.id));
    await mkdir(thuMuc, { recursive: true });
    await writeFile(path.join(thuMuc, tenLuu), buffer);

    if (!nhom) {
      // 016: nhóm mở TRỰC TIẾP bằng cách nộp file (không qua nút ＋) thì tên kết quả = tên file và
      // định dạng suy từ đuôi — người dùng không phải khai lại thứ đã nằm trong chính cái file.
      nhom = await repo.themNhom(
        {
          itemId: item.id,
          tenGoc: tenSan,
          tenKetQua: tenSan,
          dinhDang: dinhDangTheoDuoi(duoi),
          trangThai: 'cho-xem',
          createdBy: user.id,
        },
        client
      );
    }
    const ban = await repo.themBan(
      {
        fileId: nhom.id,
        versionNo,
        tenLuu,
        tenGoc: tenSan,
        loaiMime: String(loaiMime),
        kichThuoc,
        uploadedBy: user.id,
      },
      client
    );
    await repo.themLuong(
      {
        fileId: nhom.id,
        versionId: ban.id,
        nguoiId: user.id,
        vai: user.role,
        hanhDong: 'nop',
        noiDung: moTa,
      },
      client
    );

    // ─── Quy tắc tự-động theo Bảng phân quyền (lõi của đợt này) ────────────────────────────
    // Dùng CHUNG `apTuDong` với `nopBaoCao` (016): một bản là một bản, không phân biệt file hay chữ.
    const trangThaiMoi = await apTuDong(user, nhom, ban, client);
    const capNhat = await repo.doiTrangThai(nhom.id, trangThaiMoi, client);

    // ─── Thông báo (cùng giao dịch) ─────────────────────────────────────────────────────────
    // Người nhận = LÃNH ĐẠO PHÒNG PHỤ TRÁCH NHIỆM VỤ (`leader_ids`) — người dùng chốt 2026-09-02
    // và siết lần hai cùng ngày: chỉ họ xử được file nên chỉ họ được báo. Nhiệm vụ chưa gán lãnh
    // đạo ⇒ `nguoiNhanLanhDao` lùi về TP/PP của phòng kèm câu nhắc gán (không thì file nằm im).
    const { rows: tpPp, thieuLanhDao } = await nguoiNhanLanhDao(item, client);
    const nhac = thieuLanhDao ? NHAC_GAN_LANH_DAO : '';
    if (trangThaiMoi === 'da-duyet') {
      await baoNguoiNhan(
        user,
        tpPp,
        `Nhiệm vụ "${item.name}": file "${tenSan}" bản ${versionNo} được phê duyệt tự động — phân quyền không yêu cầu duyệt.`,
        notificationsRepo.LOAI.DA_DUYET,
        nhom.id,
        client
      );
    } else if (trangThaiMoi === 'cho-lanh-dao') {
      await baoNguoiNhan(
        user,
        await phoGiamDocPhuTrach(item.department_id, client),
        `Nhiệm vụ "${item.name}": ${user.full_name} nộp bản ${versionNo} của "${tenSan}" — chờ Phó GĐ phụ trách xem.`,
        notificationsRepo.LOAI.CHO_DUYET,
        nhom.id,
        client
      );
    } else {
      await baoNguoiNhan(
        user,
        tpPp,
        `Nhiệm vụ "${item.name}": ${user.full_name} nộp bản ${versionNo} của "${tenSan}" — ${NHAN_TRANG_THAI[trangThaiMoi]}.${nhac}`,
        notificationsRepo.LOAI.CHO_DUYET,
        nhom.id,
        client
      );
    }

    return {
      nhom: { ...nhom, ...capNhat },
      ban,
      tuDong: trangThaiMoi === 'da-duyet',
    };
  });
}

/** Phó Giám đốc phụ trách phòng — khuôn `phoGiamDocPhuTrach` của approvals. */
async function phoGiamDocPhuTrach(departmentId, client) {
  if (departmentId == null) return [];
  const managers = await deptRepo.listManagers(departmentId, client);
  return managers.filter((m) => m.role === 'deputy_director');
}

// ────────────────────────────────────────────────────────────────────────────────────────────
// BẢNG VERDICT — state machine kiểm CẢ quyền HIỆU LỰC lẫn trạng thái hiện tại.
//  - vai: ai được làm (máy chủ khớp CHÍNH XÁC users.role — bẫy includes §13.5).
//  - tu:   trạng thái nhóm cho phép thực hiện hành động.  den: trạng thái chuyển tới.
//  - canDuyet: là hành động CHỐT ⇒ cửa `file:approve` phải có giá trị hiệu lực 'cho-phep'
//    (admin đặt ⏳ cho TP/PP ⇒ mất nút «Hoàn thành / Duyệt», chỉ còn «Trình» + «Yêu cầu sửa»).
//  - canNoiDung: bắt buộc nội dung ≥ 10 ký tự (yeu-cau-sua / tra-ve-tp / trinh-lanh-dao).
// ────────────────────────────────────────────────────────────────────────────────────────────
const BANG_VERDICT = Object.freeze({
  'yeu-cau-sua': Object.freeze({
    vai: ['Trưởng phòng', 'Phó phòng'],
    tu: ['cho-xem', 'can-sua'],
    den: 'can-sua',
    canDuyet: false,
    canNoiDung: true,
    canKiem: 'read',
  }),
  'trinh-lanh-dao': Object.freeze({
    vai: ['Trưởng phòng', 'Phó phòng'],
    tu: ['cho-xem', 'can-sua'],
    den: 'cho-lanh-dao',
    canDuyet: false,
    canNoiDung: true,
    canKiem: 'read',
  }),
  'tra-ve-cbo': Object.freeze({
    vai: ['Trưởng phòng', 'Phó phòng'],
    tu: ['cho-xem', 'cho-lanh-dao', 'can-sua'],
    den: 'can-sua',
    canDuyet: false,
    canNoiDung: false,
    canKiem: 'read',
  }),
  'hoan-thanh': Object.freeze({
    vai: ['Trưởng phòng', 'Phó phòng'],
    tu: ['cho-xem', 'can-sua'],
    den: 'hoan-thanh',
    canDuyet: true,
    canNoiDung: false,
    canKiem: 'read',
  }),
  'tra-ve-tp': Object.freeze({
    vai: ['Phó Giám đốc', 'admin'],
    tu: ['cho-lanh-dao'],
    den: 'can-sua',
    canDuyet: false,
    canNoiDung: true,
    canKiem: 'approve',
  }),
  duyet: Object.freeze({
    vai: ['Phó Giám đốc', 'admin'],
    tu: ['cho-lanh-dao'],
    den: 'da-duyet',
    canDuyet: true,
    canNoiDung: false,
    canKiem: 'approve',
  }),
});

const NHAN_VERDICT = Object.freeze({
  'yeu-cau-sua': 'Yêu cầu sửa',
  'trinh-lanh-dao': 'Trình Phó giám đốc',
  'tra-ve-cbo': 'Đẩy về Cán bộ',
  'hoan-thanh': 'Hoàn thành',
  'tra-ve-tp': 'Trả về TP/PP',
  duyet: 'Duyệt',
});

const lyDoQuaNgan = (s) => s.length < DO_DAI_NOI_DUNG_TOI_THIEU;

/**
 * Xử lý một nhóm file: Yêu cầu sửa · Trình · Đẩy về Cán bộ · Hoàn thành (TP/PP) ·
 * Trả về TP/PP · Duyệt (PGD/GĐ). Kiểm VAI + PHẠM VI + GIÁ TRỊ HIỆU LỰC + TRẠNG THÁI hiện tại.
 */
export function verdict(user, fileId, { hanhDong, noiDung = '' }) {
  const luat = BANG_VERDICT[hanhDong];
  if (!luat) {
    throw badRequest(`Hành động "${hanhDong}" không hợp lệ`, 'hanhDong');
  }
  const lyDo = String(noiDung ?? '').trim();
  if (luat.canNoiDung && lyDoQuaNgan(lyDo)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Vui lòng nhập nội dung, ít nhất ${DO_DAI_NOI_DUNG_TOI_THIEU} ký tự`,
      { field: 'noiDung' }
    );
  }

  return withTransaction(async (client) => {
    const nhom = await repo.lockNhomById(Number(fileId), client);
    if (!nhom) throw notFound('Không tìm thấy nhóm file kết quả');
    if (KET_THUC.includes(nhom.trang_thai)) {
      throw conflict(`Kết quả này đã ${NHAN_TRANG_THAI[nhom.trang_thai]}, không thể xử lý thêm`);
    }
    const item = await itemsRepo.findById(nhom.item_id, client);
    if (!item) throw notFound('Không tìm thấy nhiệm vụ chứa file này');

    // Vai trước (khớp chính xác), rồi phạm vi qua can() — không nhân đôi điều kiện phòng.
    if (!luat.vai.includes(user.role)) {
      throw forbidden('Vai trò của bạn không được thực hiện hành động này trên file kết quả');
    }
    assertCan(user, luat.canKiem, item);
    // 2026-09-02 — SIẾT: TP/PP chỉ verdict được file của nhiệm vụ mà họ được nêu ở `leader_ids`.
    // Phó GĐ/admin không đi qua đây (họ giữ phạm vi phòng phụ trách / toàn hệ thống).
    if (
      ['Trưởng phòng', 'Phó phòng'].includes(user.role) &&
      !laLanhDaoPhuTrachNhiemVu(user, item)
    ) {
      throw loiKhongPhuTrach();
    }
    if (luat.canDuyet && giaTriHieuLuc(user, 'file', 'approve') !== 'cho-phep') {
      throw forbidden(
        'Quản trị đã đặt «⏳ Chờ duyệt» ở ô «Duyệt kết quả (file nhiệm vụ)» cho vai của bạn — hãy dùng «Trình Phó giám đốc» hoặc «Yêu cầu sửa».'
      );
    }
    if (!luat.tu.includes(nhom.trang_thai)) {
      throw conflict(
        `File đang ở trạng thái «${NHAN_TRANG_THAI[nhom.trang_thai]}» — không làm được «${NHAN_VERDICT[hanhDong]}» ở lúc này`
      );
    }

    const banCuoi = await repo.banCuoiCung(nhom.id, client);
    await repo.themLuong(
      {
        fileId: nhom.id,
        versionId: banCuoi?.id ?? null,
        nguoiId: user.id,
        vai: user.role,
        hanhDong,
        noiDung: lyDo,
      },
      client
    );
    const capNhat =
      luat.den === 'can-sua'
        ? await repo.datLenhSua(
            nhom.id,
            hanhDong === 'tra-ve-tp' ? 'lanh-dao' : 'can-bo',
            lyDo,
            client
          )
        : await repo.doiTrangThai(nhom.id, luat.den, client);
    await thongBaoVerdict(user, item, nhom, { hanhDong, lyDo, banCuoi }, client);

    return { nhom: { ...nhom, ...capNhat }, hanhDong };
  });
}

/** Thông báo của verdict — nội dung riêng từng hành động, cùng giao dịch với lần đổi trạng thái. */
async function thongBaoVerdict(user, item, nhom, { hanhDong, lyDo, banCuoi }, client) {
  const { rows: tpPp } = await nguoiNhanLanhDao(item, client);
  const nguoiPhaiSua = [banCuoi?.uploaded_by, item.assignee_id];
  switch (hanhDong) {
    case 'yeu-cau-sua':
      await bao(
        user,
        [item.assignee_id],
        `Nhiệm vụ "${item.name}": "${nhom.ten_goc}" được yêu cầu sửa lại. Ghi chú: ${lyDo}`,
        notificationsRepo.LOAI.TU_CHOI,
        nhom.id,
        client
      );
      break;
    case 'trinh-lanh-dao':
      await baoNguoiNhan(
        user,
        await phoGiamDocPhuTrach(item.department_id, client),
        `Nhiệm vụ "${item.name}": "${nhom.ten_goc}" được trình Phó GĐ phụ trách xem. Ghi chú: ${lyDo}`,
        notificationsRepo.LOAI.CHO_DUYET,
        nhom.id,
        client
      );
      break;
    case 'tra-ve-cbo':
      await bao(
        user,
        [item.assignee_id],
        `Nhiệm vụ "${item.name}": "${nhom.ten_goc}" được trả về để sửa. ${lyDo}`.trim(),
        notificationsRepo.LOAI.TU_CHOI,
        nhom.id,
        client
      );
      break;
    case 'tra-ve-tp':
      await baoNguoiNhan(
        user,
        tpPp,
        `Nhiệm vụ "${item.name}": "${nhom.ten_goc}" được trả về Trưởng phòng/Phó phòng. Ghi chú: ${lyDo}`,
        notificationsRepo.LOAI.TU_CHOI,
        nhom.id,
        client
      );
      break;
    default: {
      // hoan-thanh / duyet — chốt: báo TP/PP phòng + người nộp bản cuối + người được giao nhiệm vụ.
      const cau =
        hanhDong === 'duyet'
          ? `"${nhom.ten_goc}" đã được duyệt — kết quả chốt.`
          : `"${nhom.ten_goc}" được hoàn thành.`;
      await baoNguoiNhan(
        user,
        tpPp,
        `Nhiệm vụ "${item.name}": ${cau}`,
        notificationsRepo.LOAI.DA_DUYET,
        nhom.id,
        client
      );
      await bao(
        user,
        nguoiPhaiSua,
        `Nhiệm vụ "${item.name}": ${cau}`,
        notificationsRepo.LOAI.DA_DUYET,
        nhom.id,
        client
      );
      break;
    }
  }
}

/**
 * GÓP Ý theo bản: TP/PP phòng + Phó GĐ phụ trách + GĐ/admin (Cán bộ góp ý bằng nộp bản mới
 * kèm mô tả — đúng luồng người dùng mô tả). Không đổi trạng thái, không gửi thông báo đẩy.
 */
export function gomY(user, versionId, { noiDung, trang = null }) {
  const nd = String(noiDung ?? '').trim();
  if (!nd)
    throw new AppError('VALIDATION_ERROR', 'Vui lòng nhập nội dung góp ý', { field: 'noiDung' });
  if (nd.length > 2000) {
    throw new AppError('VALIDATION_ERROR', 'Nội dung góp ý tối đa 2000 ký tự', {
      field: 'noiDung',
    });
  }
  return withTransaction(async (client) => {
    const ban = await repo.findBanById(Number(versionId), client);
    if (!ban) throw notFound('Không tìm thấy bản file để góp ý');
    const nhom = await repo.findNhomById(ban.file_id, client);
    if (!nhom) throw notFound('Không tìm thấy nhóm file chứa bản này');
    const item = await itemsRepo.findById(nhom.item_id, client);
    if (!item) throw notFound('Không tìm thấy nhiệm vụ chứa file này');

    const vaiXem = ['Trưởng phòng', 'Phó phòng', 'Phó Giám đốc', 'admin'];
    if (!vaiXem.includes(user.role)) {
      throw forbidden(
        'Chỉ Trưởng phòng / Phó phòng / Phó GĐ phụ trách / Giám đốc được góp ý vào file kết quả'
      );
    }
    assertCan(user, 'read', item);
    // 2026-09-02 — SIẾT: TP/PP góp ý được chỉ khi phụ trách CHÍNH nhiệm vụ này (`leader_ids`).
    if (
      ['Trưởng phòng', 'Phó phòng'].includes(user.role) &&
      !laLanhDaoPhuTrachNhiemVu(user, item)
    ) {
      throw loiKhongPhuTrach();
    }

    const gopY = await repo.themGopY(
      { versionId: ban.id, nguoiId: user.id, vai: user.role, noiDung: nd, trang },
      client
    );
    await repo.themLuong(
      {
        fileId: nhom.id,
        versionId: ban.id,
        nguoiId: user.id,
        vai: user.role,
        hanhDong: 'gom-y',
        noiDung: nd,
      },
      client
    );
    return { gopY };
  });
}

/** Xoá NHÓM file: người tạo nhóm + admin, khi chưa 'da-duyet'. File vật lý xoá nỗ lực tốt. */
export async function xoaNhom(user, fileId) {
  const cacTenLuu = await withTransaction(async (client) => {
    const nhom = await repo.lockNhomById(Number(fileId), client);
    if (!nhom) throw notFound('Không tìm thấy nhóm file kết quả');
    const item = await itemsRepo.findById(nhom.item_id, client);
    if (!item) throw notFound('Không tìm thấy nhiệm vụ chứa file này');
    const admin = user.role === 'admin';
    if (!admin && !sameId(nhom.created_by, user.id)) {
      throw forbidden('Chỉ người nộp file này hoặc Giám đốc được xoá');
    }
    if (nhom.trang_thai === 'da-duyet') {
      throw conflict('Kết quả đã được duyệt, không xoá được nữa');
    }
    const bans = await repo.listBanByFile(nhom.id, client);
    await repo.xoaNhom(nhom.id, client);
    // Bản «Báo cáo» (016) không có file vật lý ⇒ `ten_luu` NULL: lọc ra trước khi ghép đường dẫn,
    // `path.join(..., null)` ném TypeError và làm đổ cả bước dọn của các bản có file thật.
    return bans
      .filter((b) => b.ten_luu != null)
      .map((b) => ({ itemId: item.id, tenLuu: b.ten_luu }));
  });
  // Sau khi commit: dọn file vật lý — hỏng thì bỏ qua, dòng rác không làm đổ thao tác đã xong.
  await Promise.allSettled(
    cacTenLuu.map(({ itemId, tenLuu }) => unlink(path.join(GOC_STORAGE, String(itemId), tenLuu)))
  );
  return { daXoa: true };
}

/**
 * HÀNG CHỜ PHÊ DUYỆT KẾT QUẢ — nguồn dữ liệu cho tab con thứ hai của «Hàng chờ phê duyệt»
 * (người dùng chốt 2026-09-02: tách «phê duyệt tất cả» thành 2 tab — công việc/nhiệm vụ và kết quả).
 *
 * Phạm vi do `repo.listChoDuyetKetQua` bó theo VAI + phòng; ở đây chỉ thêm hai thứ:
 *   - `hanhDong`: đúng những nút vai này bấm được trên từng dòng, tính LẠI bằng `BANG_VERDICT` +
 *     `giaTriHieuLuc` — client không tự suy luật lần nữa, và server vẫn kiểm lại khi bấm.
 *   - `duocSua`: có hiện nút ✎ sửa trực tuyến hay không (cùng hàm với khối «Kết quả»).
 */
export async function choDuyetKetQua(user) {
  if (!user) return { items: [] };
  const rows = await repo.listChoDuyetKetQua({
    vai: user.role,
    nguoiId: user.id,
    phongIds: user.managedDepartmentIds ?? [],
  });
  const coDuyet = giaTriHieuLuc(user, 'file', 'approve') === 'cho-phep';
  const coNop = giaTriHieuLuc(user, 'file', 'create') !== 'tu-choi';
  const items = rows.map((r) => {
    const hanhDong = Object.entries(BANG_VERDICT)
      .filter(
        ([, luat]) =>
          luat.vai.includes(user.role) &&
          luat.tu.includes(r.trang_thai) &&
          (!luat.canDuyet || coDuyet)
      )
      .map(([ma, luat]) => ({ ma, nhan: NHAN_VERDICT[ma], canNoiDung: luat.canNoiDung }));
    // «Nộp bản mới» ngay trong hàng chờ (người dùng chốt 2026-09-02: «người sửa file nhiệm vụ có
    // thể up file lên để thể hiện bản mới của nó»). Cùng luật với nút ✎ sửa trực tuyến — nộp và
    // sửa trực tuyến đều tạo BẢN MỚI nên không thể lệch nhau; máy chủ vẫn kiểm lại trong `nop()`.
    const duocNop =
      coNop &&
      duocSuaTrucTiep(
        user,
        { trang_thai: r.trang_thai },
        {
          leader_ids: r.leader_ids,
          id: r.item_id,
          department_id: r.department_id,
          assignee_id: r.assignee_id,
          level: 3,
        }
      );
    return { ...r, hanhDong, duocNop, laBaoCao: r.ban_cuoi_la_bao_cao === true };
  });
  return { items, onlyOffice: onlyOfficeBat() };
}

/** Số dòng đang chờ CHÍNH người này xử — cho con số trên tab, không cần tải cả danh sách. */
export async function demChoDuyetKetQua(user) {
  const { items } = await choDuyetKetQua(user);
  return items.length;
}

function laChuLenhSua(user, nhom, item) {
  if (nhom.trang_thai !== 'can-sua') return false;
  if (nhom.lenh_sua_cho === 'can-bo') return sameId(item.assignee_id, user.id);
  return (
    nhom.lenh_sua_cho === 'lanh-dao' &&
    ['Trưởng phòng', 'Phó phòng'].includes(user.role) &&
    laLanhDaoPhuTrachNhiemVu(user, item)
  );
}

async function khoaLenhSua(user, fileId, client) {
  const nhom = await repo.lockNhomById(Number(fileId), client);
  if (!nhom) throw notFound('Không tìm thấy nhóm file kết quả');
  const item = await mustFindNhiemVu(nhom.item_id, client);
  assertCan(user, 'read', item, 'task');
  if (nhom.trang_thai !== 'can-sua' || !nhom.lenh_sua_cho) {
    throw conflict('Lệnh sửa không còn hoặc kết quả đã chốt — hãy tải lại hàng chờ');
  }
  if (!laChuLenhSua(user, nhom, item)) {
    throw forbidden('Chỉ người đang nhận lệnh sửa mới được thực hiện hành động này');
  }
  return { nhom, item };
}

export async function lenhSua(user) {
  const rows = await repo.listChoDuyetKetQua({ vai: user.role, nguoiId: user.id, lenhSua: true });
  const items = rows
    .filter(
      (row) =>
        can(user, 'read', 'task', {
          ...row,
          id: row.item_id,
          level: 3,
        }).ok
    )
    .map((row) => {
      const duocSua = duocSuaTrucTiep(user, row, { ...row, id: row.item_id, level: 3 });
      return { ...row, duocSua, duocGui: duocSua && row.ban_cuoi_id != null };
    });
  return { items, onlyOffice: onlyOfficeBat() };
}

export function luuTam(user, fileId, { ghiChu }) {
  return withTransaction(async (client) => {
    const { nhom } = await khoaLenhSua(user, fileId, client);
    await repo.luuGhiChu(nhom.id, ghiChu, client);
    return { nhom: { ...nhom, lenh_sua_ghi_chu: ghiChu } };
  });
}

export function huyLenhSua(user, fileId) {
  return withTransaction(async (client) => {
    const { nhom, item } = await khoaLenhSua(user, fileId, client);
    const nguoiRaLenh = await repo.nguoiRaLenh(nhom.id, client);
    const ban = await repo.banCuoiCung(nhom.id, client);
    const capNhat = await repo.doiTrangThai(
      nhom.id,
      nhom.lenh_sua_cho === 'can-bo' ? 'cho-xem' : 'cho-lanh-dao',
      client
    );
    await repo.themLuong(
      {
        fileId: nhom.id,
        versionId: ban?.id,
        nguoiId: user.id,
        vai: user.role,
        hanhDong: 'huy-lenh-sua',
        noiDung: 'Hủy lệnh sửa — giữ nguyên file và trả về cửa chờ trước',
      },
      client
    );
    const nguoiNhan =
      nguoiRaLenh != null
        ? [nguoiRaLenh]
        : nhom.lenh_sua_cho === 'can-bo'
          ? item.leader_ids
          : (await phoGiamDocPhuTrach(item.department_id, client)).map(
              (row) => row.id ?? row.user_id
            );
    await bao(
      user,
      nguoiNhan ?? [],
      `Nhiệm vụ "${item.name}": ${user.full_name} hủy lệnh sửa — kết quả trở về cửa chờ duyệt.`,
      notificationsRepo.LOAI.TU_CHOI,
      nhom.id,
      client
    );
    return { nhom: { ...nhom, ...capNhat } };
  });
}

export function guiBanMoi(user, fileId, { noiDung = '' } = {}) {
  return withTransaction(async (client) => {
    const { nhom, item } = await khoaLenhSua(user, fileId, client);
    if (!duocSuaTrucTiep(user, nhom, item)) {
      throw forbidden('Bạn không có quyền gửi bản mới của kết quả này');
    }
    const ban = await repo.banCuoiCung(nhom.id, client);
    if (!ban) throw conflict('Chưa có bản nào được lưu để gửi đi phê duyệt');
    const yKien = String(noiDung ?? '').trim();
    await repo.themLuong(
      {
        fileId: nhom.id,
        versionId: ban.id,
        nguoiId: user.id,
        vai: user.role,
        hanhDong: 'nop',
        noiDung: 'Gửi bản mới nhất' + (yKien ? ` — ${yKien}` : ''),
      },
      client
    );
    const trangThai = await apTuDong(user, nhom, ban, client);
    const capNhat = await repo.doiTrangThai(nhom.id, trangThai, client);
    const { rows: lanhDao, thieuLanhDao } = await nguoiNhanLanhDao(item, client);
    const nguoiNhan =
      trangThai === 'cho-lanh-dao' ? await phoGiamDocPhuTrach(item.department_id, client) : lanhDao;
    await baoNguoiNhan(
      user,
      nguoiNhan,
      `Nhiệm vụ "${item.name}": ${user.full_name} gửi bản mới nhất (${ban.version_no}) — ${NHAN_TRANG_THAI[trangThai]}.` +
        (trangThai === 'cho-xem' && thieuLanhDao ? NHAC_GAN_LANH_DAO : ''),
      trangThai === 'da-duyet' ? notificationsRepo.LOAI.DA_DUYET : notificationsRepo.LOAI.CHO_DUYET,
      nhom.id,
      client
    );
    return { nhom: { ...nhom, ...capNhat }, ban, tuDong: trangThai === 'da-duyet' };
  });
}

/**
 * Đọc TOÀN BỘ kết quả file của một nhiệm vụ: nhóm + bản + góp ý + bảng luồng.
 *
 * Kèm hai CỜ theo người đang xem — client không tự suy luật lần nữa (2026-09-02, luật siết
 * `leader_ids`): `duocSua` (mở nút ✎ sửa trực tuyến + nút nộp bản mới) và `duocVerdict` (mở hàng
 * nút Yêu cầu sửa / Trình / Duyệt…). Máy chủ vẫn kiểm lại khi bấm.
 */
export async function doc(user, ref) {
  const item = await mustFindNhiemVu(ref);
  assertCan(user, 'read', item, 'task');
  const laLanhDaoPhong = ['Trưởng phòng', 'Phó phòng'].includes(user.role);
  const phuTrach = laLanhDaoPhong ? laLanhDaoPhuTrachNhiemVu(user, item) : true;
  const nhoms = await repo.listNhomByItem(item.id);
  return Promise.all(
    nhoms.map(async (nhom) => {
      const bans = await repo.listBanByFile(nhom.id);
      return {
        ...nhom,
        bans,
        gopY: await repo.listGopYByFile(nhom.id),
        luong: await repo.listLuongByFile(nhom.id),
        duocSua: duocSuaTrucTiep(user, nhom, item),
        duocVerdict: phuTrach && !KET_THUC.includes(nhom.trang_thai),
        // 016 — «Báo cáo»: dòng này nhập CHỮ chứ không nộp file, nên giao diện đổi ô «Hành động»
        // thành khung nhập nội dung. Lấy theo `dinh_dang` đã khai; nhóm cũ chưa có cột thì suy từ
        // bản mới nhất (bản không có `ten_luu` là bản chữ).
        laBaoCao:
          nhom.dinh_dang === DINH_DANG_BAO_CAO ||
          (bans.length > 0 && laBanBaoCao(bans[bans.length - 1])),
      };
    })
  );
}

/**
 * QUYỀN của người đang xem trên luồng file của MỘT nhiệm vụ — cho client mở/ẩn nút cấp nhiệm vụ
 * (nút «Tải file lên» tạo nhóm mới) mà không phải tự suy luật `leader_ids` lần nữa.
 *
 * `duocNop` = `can(create,'file')` cho phép VÀ (không phải TP/PP HOẶC đúng lãnh đạo phụ trách).
 * `phuTrach` = TP/PP có tên ở ô «Lãnh đạo phòng phụ trách» của nhiệm vụ (vai khác luôn true, vì
 * luật siết chỉ áp cho hai vai đó).
 */
export async function quyenFile(user, ref) {
  const item = await mustFindNhiemVu(ref);
  const laLanhDaoPhong = ['Trưởng phòng', 'Phó phòng'].includes(user.role);
  const phuTrach = laLanhDaoPhong ? laLanhDaoPhuTrachNhiemVu(user, item) : true;
  return {
    phuTrach,
    duocNop: can(user, 'create', 'file', item).ok && phuTrach,
    thieuLanhDao: (item.leader_ids ?? []).length === 0,
  };
}

/** Một bản để tải/xem — quyền đọc đi theo `can(read,'task')` của nhiệm vụ chứa nó. */
export async function docBan(user, banId) {
  const ban = await repo.findBanById(Number(banId));
  if (!ban) throw notFound('Không tìm thấy bản file');
  const nhom = await repo.findNhomById(ban.file_id);
  if (!nhom) throw notFound('Không tìm thấy nhóm file chứa bản này');
  const item = await itemsRepo.findById(nhom.item_id);
  if (!item) throw notFound('Không tìm thấy nhiệm vụ chứa file này');
  assertCan(user, 'read', item, 'task');
  chanBanBaoCao(ban);
  return { ban, item };
}

/**
 * Bản «Báo cáo» (016) KHÔNG có file vật lý — mọi cửa đòi file phải dừng ở đây với câu nói rõ, chứ
 * không đi tiếp để `duongBan(null)` hay ONLYOFFICE nổ một lỗi không ai hiểu. Nội dung báo cáo đọc
 * ngay trong bảng kết quả nên không có gì để tải về.
 */
export function laBanBaoCao(ban) {
  return Boolean(ban && ban.noi_dung != null && ban.ten_luu == null);
}

function chanBanBaoCao(ban) {
  if (laBanBaoCao(ban)) {
    throw badRequest(
      'Bản này là BÁO CÁO nhập chữ, không có file để tải hay mở — nội dung đã hiện ngay trong bảng kết quả'
    );
  }
}

/** Bản CHỈ DÀNH cho máy-đối-máy (ONLYOFFICE) — không có người dùng; đã được token HMAC bảo vệ. */
export async function docBanSystem(banId) {
  const ban = await repo.findBanById(Number(banId));
  if (!ban) throw notFound('Không tìm thấy bản file');
  const nhom = await repo.findNhomById(ban.file_id);
  if (!nhom) throw notFound('Không tìm thấy nhóm file chứa bản này');
  const item = await itemsRepo.findById(nhom.item_id);
  if (!item) throw notFound('Không tìm thấy nhiệm vụ chứa file này');
  chanBanBaoCao(ban);
  return { ban, item };
}

/** Đường vật lý của một bản — tên `ten_luu` do máy chủ sinh sẵn, không bao giờ là tên gốc. */
export function duongBan(itemId, tenLuu) {
  const ten = path.basename(String(tenLuu ?? ''));
  if (ten !== tenLuu) throw badRequest('Tên file lưu không hợp lệ');
  return path.join(GOC_STORAGE, String(itemId), ten);
}

// ============================================================================
// SỬA TRỰC TUYẾN với ONLYOFFICE Document Server (Vòng 14 — docker `busy_merkle`, cổng 80).
//
// Người dùng chốt 2026-09-01: CÓ editor trực tuyến, mọi lần sửa phải LƯU LẠI thành BẢN MỚI
// trong cùng nhóm để xem được. Khuôn: tab mới mở trang editor do app dựng (config ký JWT HS256
// bằng ONLYOFFICE_JWT_SECRET); DS tải file gốc qua `/raw` (token HMAC); người dùng lưu → DS gọi
// `/callback` với `status=2` + `url` bản đã sửa → app tải về, lưu version_no + 1 trong cùng nhóm.
// Chưa cấu hình ONLYOFFICE_URL/ONLYOFFICE_JWT_SECRET ⇒ tính năng TẮT (nút ẩn, đường trả câu rõ).
// ============================================================================
import { env } from '../../config/env.js';
import { kyJwt } from '../../utils/jwt.js';

/** DS đã được cấu hình chưa — quyết định nút «✎ sửa trực tuyến» có hiện hay không. */
export function onlyOfficeBat() {
  return Boolean(env.ONLYOFFICE_URL && env.ONLYOFFICE_JWT_SECRET);
}

/**
 * Token máy-đối-máy cho DS tải/gửi file về: HMAC với SESSION_SECRET (không thêm biến env mới).
 * Không có thời hạn — id bản là số sinh trong CSDL và token chỉ được dùng trên đúng đường
 * `raw`/`callback` của CHÍNH id đó; xoá bản là token chết theo.
 */
function chuKyDs(action, versionId) {
  return createHmac('sha256', env.SESSION_SECRET)
    .update(`ds:${action}:${versionId}`)
    .digest('base64url');
}

export function tokenDs(action, versionId) {
  return chuKyDs(action, Number(versionId));
}

export function kiemTokenDs(action, versionId, token) {
  const tinh = chuKyDs(action, Number(versionId));
  const daGui = String(token ?? '');
  if (daGui.length !== tinh.length) return false;
  return timingSafeEqual(Buffer.from(daGui), Buffer.from(tinh));
}

/**
 * `document.key` — PHẢI đổi mỗi khi nội dung file đổi, nếu không DS lấy lại bản trong bộ đệm của
 * nó (tài liệu Docs API: tối đa 128 ký tự, chỉ 0-9 a-z A-Z -._=). Ghép id bản + kích thước + mốc
 * thời gian nộp: cùng một bản thì key ổn định (mở lại vẫn vào đúng phiên đang sửa), còn lưu ra bản
 * mới thì id khác ⇒ key khác. MỘT chỗ duy nhất — lệnh `forcesave` phải gửi ĐÚNG key này.
 */
function khoaDs(ban) {
  return `tf-${ban.id}-${ban.kich_thuoc}-${Date.parse(ban.uploaded_at) || 0}`.slice(0, 128);
}

/** Config editor cho MỘT bản: `document.url` để DS tải, `callbackUrl` để DS trả bản đã sửa. */
export async function moEditor(user, versionId) {
  if (!onlyOfficeBat()) {
    throw badRequest(
      'Chưa cấu hình ONLYOFFICE_URL và ONLYOFFICE_JWT_SECRET trong deploy/.env — sửa trực tuyến đang tắt'
    );
  }
  const { ban, item } = await docBan(user, versionId);
  const nhom = await repo.findNhomById(ban.file_id);
  const duocSua = duocSuaTrucTiep(user, nhom, item);
  const callbackBase = env.ONLYOFFICE_CALLBACK_BASE || env.APP_BASE_URL;
  const duoi = duoiBan(ban.ten_luu);
  // Ảnh (jpg/png/gif/webp) KHÔNG có bộ soạn thảo nào trong DS. Trước đây `?? 'word'` biến mọi đuôi
  // lạ thành Word ⇒ mở ảnh là được một trang editor lỗi không ai hiểu; nay trả câu rõ ngay.
  const documentType = DOCUMENT_TYPE_THEO_DUOI[duoi];
  if (!documentType) {
    throw badRequest(`Không sửa trực tuyến được file .${duoi} — hãy tải về để xem`);
  }
  const config = {
    document: {
      fileType: duoi,
      key: khoaDs(ban),
      title: ban.ten_goc,
      url: `${callbackBase}/api/v1/task-files-ds/raw/${ban.id}?token=${tokenDs('raw', ban.id)}`,
      permissions: { edit: duocSua, comment: duocSua, download: true },
    },
    documentType,
    editorConfig: {
      callbackUrl: `${callbackBase}/api/v1/task-files-ds/callback/${ban.id}?token=${tokenDs('callback', ban.id)}`,
      lang: 'vi',
      mode: duocSua ? 'edit' : 'view',
      user: { id: String(user.id), name: user.full_name },
      customization: { forcesave: true, compactHeader: true },
    },
  };
  return {
    dsUrl: env.ONLYOFFICE_URL.replace(/\/$/, ''),
    token: kyJwt(config, env.ONLYOFFICE_JWT_SECRET),
    config,
    ban,
    item,
    nhom,
    duocSua,
    duocGui: duocSua && laChuLenhSua(user, nhom, item),
  };
}

/**
 * LƯU NGAY thành bản mới — trả lời câu hỏi «sửa xong rồi lưu lại vào nhiệm vụ kiểu gì».
 *
 * Docs API KHÔNG có phương thức JS nào bắt editor lưu (xem danh sách methods: chỉ có downloadAs,
 * requestClose, …). Cách chính thức là gọi **command service**: POST `{dsUrl}/command` với thân
 * JSON `{c:'forcesave', key, userdata}`, kèm `token` là JWT của chính thân đó. DS lưu xong sẽ gọi
 * `callbackUrl` với `status=6` ⇒ `luuTuCallback` tạo BẢN MỚI. Nút «Lưu thành bản mới» trên trang
 * editor gọi đường này rồi đóng tab.
 *
 * Mã lỗi của DS (tài liệu «Command service»): 0 không lỗi · 1 không thấy key · 2 callback sai ·
 * 3 lỗi nội bộ · 4 CHƯA CÓ THAY ĐỔI NÀO · 5 lệnh sai · 6 token sai. Dịch sang câu tiếng Việt nói
 * rõ phải làm gì; riêng 4 KHÔNG phải lỗi (bấm Lưu khi chưa sửa gì).
 */
const LOI_COMMAND_DS = Object.freeze({
  1: 'Document Server không còn giữ phiên sửa của file này — hãy tải lại trang sửa rồi thử lại.',
  2: 'Đường callback không đúng — kiểm ONLYOFFICE_CALLBACK_BASE trong deploy/.env.',
  3: 'Document Server gặp lỗi nội bộ khi lưu — thử lại, nếu vẫn lỗi xem log container DS.',
  5: 'Lệnh gửi tới Document Server không đúng (lỗi lập trình, không phải do bạn).',
  6: 'ONLYOFFICE_JWT_SECRET của máy chủ không trùng JWT_SECRET của Document Server.',
});

const luotLuuDangCho = new Map();

export async function luuNgay(user, versionId) {
  if (!onlyOfficeBat()) {
    throw badRequest('Sửa trực tuyến đang tắt — chưa cấu hình ONLYOFFICE trong deploy/.env');
  }
  const { ban, item } = await docBan(user, versionId);
  const nhom = await repo.findNhomById(ban.file_id);
  if (!duocSuaTrucTiep(user, nhom, item)) {
    throw forbidden('Bạn chỉ được XEM bản này, không lưu được bản mới');
  }
  const maLuu = randomUUID();
  const luot = { banId: Number(ban.id), nguoiId: user.id, ban: null };
  luotLuuDangCho.set(maLuu, luot);
  try {
    const than = { c: 'forcesave', key: khoaDs(ban), userdata: maLuu };
    const dsUrl = env.ONLYOFFICE_URL.replace(/\/$/, '');
    let phanHoi;
    try {
      phanHoi = await fetch(`${dsUrl}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...than, token: kyJwt(than, env.ONLYOFFICE_JWT_SECRET) }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (err) {
      throw badRequest(`Không gọi được Document Server (${dsUrl}): ${err?.message ?? 'không rõ'}`);
    }
    if (!phanHoi.ok) throw badRequest(`Document Server trả ${phanHoi.status} cho lệnh lưu`);
    const ketQua = await phanHoi.json().catch(() => ({}));
    const ma = Number(ketQua?.error ?? -1);
    if (ma === 4) return { daLuu: false, lyDo: 'Chưa có thay đổi nào để lưu' };
    if (ma !== 0) {
      throw badRequest(LOI_COMMAND_DS[ma] ?? `Document Server trả mã lỗi ${ma} khi lưu`);
    }
    const hetHan = Date.now() + 20000;
    while (!luot.ban && Date.now() < hetHan) await cho(100);
    if (!luot.ban)
      throw conflict('Chưa xác nhận bản mới đã lưu — chưa gửi đi. Hãy đợi rồi thử lại');
    return { daLuu: true, banId: luot.ban.id, versionNo: luot.ban.version_no };
  } finally {
    luotLuuDangCho.delete(maLuu);
  }
}

/**
 * Ai được MỞ editor ở chế độ SỬA — cùng luật với nộp bản mới (mỗi lần lưu là một bản mới):
 *   cho-xem / can-sua : người được giao nhiệm vụ + TP/PP + PGD/GĐ
 *   cho-lanh-dao      : chỉ TP/PP + PGD/GĐ
 *   hoan-thanh / da-duyet : CHỈ XEM (kết quả đã chốt) — người thiếu quyền cũng chỉ xem được.
 */
function duocSuaTrucTiep(user, nhom, item) {
  if (!nhom || KET_THUC.includes(nhom.trang_thai)) return false;
  if (!can(user, 'create', 'file', item).ok) return false;
  // 2026-09-02 — SIẾT: TP/PP chỉ sửa trực tuyến được file của nhiệm vụ mình phụ trách (`leader_ids`);
  // người khác trong phòng mở editor ra chỉ ở chế độ XEM (`mode: 'view'`).
  if (['Trưởng phòng', 'Phó phòng'].includes(user.role)) {
    return laLanhDaoPhuTrachNhiemVu(user, item);
  }
  if (nhom.trang_thai === 'cho-lanh-dao') {
    return ['Phó Giám đốc', 'admin'].includes(user.role);
  }
  if (['Phó Giám đốc', 'admin'].includes(user.role)) return true;
  return sameId(item.assignee_id, user.id);
}

/**
 * ONLYOFFICE dùng ĐUÔI FILE để chọn bộ soạn thảo. Trước đây ghi cứng `'word'` nên mở file `.pdf`
 * là DS báo lỗi định dạng — bộ seed Vòng 14 có `quy-che-thi-sat-hach.pdf` nên gặp ngay.
 * Bảng đuôi → documentType lấy đúng theo tài liệu Docs API (`word` | `cell` | `slide` | `pdf`).
 *
 * 2026-09-03 (người dùng chốt): mở nút ✎ cho Excel (`cell`) và PowerPoint (`slide`) — DS hỗ trợ
 * sẵn hai bộ này. ẢNH KHÔNG có trong bảng ⇒ `duocMoEditor` trả false ⇒ nút ✎ không hiện, vì DS
 * không sửa được ảnh.
 */
const DOCUMENT_TYPE_THEO_DUOI = Object.freeze({
  doc: 'word',
  docx: 'word',
  pdf: 'pdf',
  xls: 'cell',
  xlsx: 'cell',
  ppt: 'slide',
  pptx: 'slide',
});

/** Đuôi này có mở được editor trực tuyến không — client hỏi để ẩn/hiện nút ✎ cho từng bản. */
export function duocMoEditor(tenLuu) {
  return Object.hasOwn(DOCUMENT_TYPE_THEO_DUOI, duoiBan(tenLuu));
}

/** Đuôi (chữ thường, không dấu chấm) của một bản đã lưu. Không dò được thì coi là docx. */
function duoiBan(tenLuu) {
  return (String(tenLuu ?? '').match(/\.([a-z0-9]+)$/i)?.[1] ?? 'docx').toLowerCase();
}

/**
 * Thoát HTML cho trang editor — trang này là HTML do MÁY CHỦ dựng nên không dùng được
 * `escapeHtml` của app.js. Tên nhiệm vụ và tên file đều là dữ liệu người dùng nhập, phải thoát
 * trước khi nội suy vào thẻ (nếu không là một lỗ XSS ngay trên trang có quyền gọi API).
 */
function escapeHtmlServer(giaTri) {
  return String(giaTri ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * CSP RIÊNG cho trang editor — lý do phải có, ghi rõ để không ai siết lại rồi lại trang trắng:
 *
 * `helmet()` mặc định đặt `script-src 'self'`, mà trang editor BẮT BUỘC nạp `api.js` từ **origin
 * của Document Server** (`http://localhost` ở máy dev). Trình duyệt chặn thẻ script đó ⇒ biến
 * `DocsAPI` không tồn tại ⇒ **màn hình trắng, không một dòng lỗi nào trên giao diện** — đúng
 * triệu chứng người dùng báo 2026-09-02. Header của helmet đã gửi rồi thì `res.setHeader` ở route
 * ghi đè được, nên chỉ nới cho ĐÚNG một trang này, phần còn lại của API giữ nguyên CSP chặt.
 *
 * Nới những gì và vì sao:
 *   script-src  + DS origin  : nạp `api.js`; `'unsafe-inline'` cho thẻ script khởi tạo DocEditor.
 *   frame-src   + DS origin  : `DocsAPI.DocEditor` dựng một <iframe> trỏ về DS — thiếu là khung trắng.
 *   connect-src + DS + ws/wss: editor giữ kết nối WebSocket với DS để lưu/đồng tác giả.
 *   img-src/style-src/font-src: biểu tượng, CSS, phông của bộ soạn thảo do DS phục vụ.
 * KHÔNG có `frame-ancestors` nới: trang này mở ở TAB RIÊNG, không nhúng vào đâu.
 */
export function cspEditor(dsUrl) {
  const ds = String(dsUrl ?? '').replace(/\/$/, '');
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${ds}`,
    `style-src 'self' 'unsafe-inline' ${ds}`,
    `img-src 'self' data: blob: ${ds}`,
    `font-src 'self' data: ${ds}`,
    `connect-src 'self' ${ds} ws: wss:`,
    `frame-src 'self' ${ds}`,
    `media-src 'self' blob: ${ds}`,
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');
}

/** Trang editor nhúng DS — HTML riêng, mở trong tab mới (index.html không đụng tới). */
export function htmlEditor({ dsUrl, token, config, ban, item, nhom, duocSua, duocGui }) {
  const cauHinh = JSON.stringify({
    document: config.document,
    documentType: config.documentType,
    token,
    editorConfig: config.editorConfig,
    type: 'desktop',
    width: '100%',
    height: '100%',
  }).replace(/</g, '\\u003c');
  const dsJson = JSON.stringify(dsUrl).replace(/</g, '\\u003c');
  // Thanh trên: TÊN NHIỆM VỤ + tên file + nút «Lưu thành bản mới» — trả lời câu hỏi của người dùng
  // «tab mới hiện ra rồi thì sửa xong lưu lại vào nhiệm vụ kiểu gì». Nút gọi `POST …/save` (lệnh
  // forcesave của DS) rồi đóng tab; trang nhiệm vụ tự nạp lại danh sách khi tab này đóng.
  const nhanNhiemVu = escapeHtmlServer(`${item?.code ?? ''} — ${item?.name ?? ''}`.trim());
  const nhanFile = escapeHtmlServer(ban?.ten_goc ?? '');
  const idBan = Number(ban?.id ?? 0);
  const idNhom = Number(nhom?.id ?? ban?.file_id ?? 0);
  const idNhiemVu = Number(item?.id ?? 0);
  // `events` + khối #loi: trước đây hỏng gì cũng chỉ thấy TRANG TRẮNG. Nay mọi đường thất bại
  // (script bị chặn, DS chết, DS không tải được file) đều hiện một câu tiếng Việt kèm chỗ cần xem.
  return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><title>Chỉnh sửa kết quả — Quản lý công việc</title>
<style>
html,body{margin:0;height:100%;font-family:system-ui,Segoe UI,sans-serif}
#thanh{position:absolute;top:0;left:0;right:0;height:44px;display:flex;align-items:center;gap:12px;
  padding:0 12px;background:#1f2937;color:#fff;font-size:13px;box-sizing:border-box}
#thanh .ten{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#thanh .file{color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
#thanh button{font:inherit;padding:5px 12px;border:0;border-radius:6px;cursor:pointer}
#luu{background:#2563eb;color:#fff}
#gui{background:#b45309;color:#fff}
#y-kien{position:absolute;top:44px;left:0;right:0;height:50px;background:#1f2937;color:#fff;padding:6px 12px;box-sizing:border-box;display:flex;align-items:center;gap:12px}
#noi-dung{flex:1;resize:none;height:30px;font:inherit}
#luu:disabled{background:#64748b;cursor:default}
#dong{background:#374151;color:#e5e7eb}
#tinh{color:#a7f3d0;white-space:nowrap}
#placeholder{position:absolute;top:94px;left:0;right:0;bottom:0}
#loi{position:absolute;top:94px;left:0;right:0;bottom:0;display:none;padding:24px;background:#fff;overflow:auto}
#chan-sua{position:absolute;top:94px;left:0;right:0;bottom:0;z-index:10;background:#ffffff80;display:none}
#loi h3{margin:0 0 8px;color:#b91c1c}
#loi code{background:#f3f4f6;padding:1px 4px;border-radius:3px}
#loi li{margin:4px 0}
</style></head>
<body>
<div id="thanh">
  <span class="ten">${nhanNhiemVu}</span>
  <span class="file">${nhanFile}</span>
  <span id="tinh"></span>
  ${duocSua ? '<button type="button" id="luu">Lưu thành bản mới</button>' : '<span id="tinh-xem">Chỉ xem</span>'}
  ${duocGui ? '<button type="button" id="gui">Gửi bản mới nhất đi</button>' : ''}
  <button type="button" id="dong">Đóng</button>
</div>
<div id="y-kien"><label for="noi-dung">Ghi ý kiến</label><textarea id="noi-dung" maxlength="2000" ${duocGui ? '' : 'disabled'}>${escapeHtmlServer(nhom?.lenh_sua_ghi_chu ?? '')}</textarea></div>
<div id="chan-sua" aria-label="Đang lưu và gửi, vui lòng chờ"></div>
<div id="placeholder"></div>
<div id="loi" role="alert" aria-live="assertive">
  <h3>Không mở được trình chỉnh sửa</h3>
  <p id="loi-chi-tiet"></p>
  <p>Kiểm theo thứ tự:</p>
  <ol>
    <li>Document Server còn sống: mở <code id="loi-ds"></code> — phải thấy chữ <code>true</code>.</li>
    <li>DS phải tự tải được file từ máy chủ này (biến <code>ONLYOFFICE_CALLBACK_BASE</code> trong
        <code>deploy/.env</code> — trong Docker Desktop là <code>http://host.docker.internal:3000</code>).</li>
    <li><code>ONLYOFFICE_JWT_SECRET</code> phải TRÙNG với <code>JWT_SECRET</code> của container DS.</li>
  </ol>
</div>
<script>
(function () {
  var DS = ${dsJson};
  var el = document.getElementById("loi");
  var ct = document.getElementById("loi-chi-tiet");
  document.getElementById("loi-ds").textContent = DS + "/healthcheck";
  window.__hienLoi = function (cau) {
    ct.textContent = cau;
    el.style.display = "block";
  };
})();
</script>
<script>
(function () {
  var ID_BAN = ${idBan};
  var ID_NHOM = ${idNhom};
  var ID_NHIEM_VU = ${idNhiemVu};
  var soBan = ${Number(ban?.version_no ?? 0)};
  var nguoiId = ${JSON.stringify(String(config.editorConfig.user.id))};
  var daSua = false, dangDongBo = false, dangXuLy = false, lanSua = 0, daGui = false;
  var tinh = document.getElementById("tinh");
  var nutLuu = document.getElementById("luu");
  var nutGui = document.getElementById("gui");
  var nutDong = document.getElementById("dong");
  var yKien = document.getElementById("noi-dung");
  function bao(cau, mau) { tinh.textContent = cau; tinh.style.color = mau || "#a7f3d0"; }
  // Cookie CSRF đọc được (double-submit) — phải gửi lại ở header, đúng như app.js làm.
  function layCsrf() {
    var m = document.cookie.match(/(?:^|; )qlcv_sid_csrf=([^;]*)/);
    return m ? decodeURIComponent(m[1]) : "";
  }
  function dong() {
    if (!dangXuLy && (!daSua || window.confirm("Còn thay đổi chưa lưu. Bạn vẫn muốn đóng?"))) window.close();
  }
  nutDong && nutDong.addEventListener("click", dong);
  window.__dongEditor = dong;
  window.__doiTrangThaiTaiLieu = function (event) {
    dangDongBo = event.data === true;
    if (dangDongBo) { daSua = true; lanSua++; bao("Có thay đổi chưa lưu thành bản mới", "#fde68a"); }
  };
  if (!nutLuu) return;
  function khoa(bat) {
    dangXuLy = bat;
    nutLuu.disabled = bat;
    nutDong.disabled = bat;
    yKien.disabled = bat || !nutGui;
    if (nutGui) nutGui.disabled = bat;
    document.getElementById("chan-sua").style.display = bat ? "block" : "none";
  }
  function daLuu() {
    bao("Đã lưu bản mới — chưa gửi đi");
    try { localStorage.setItem("qlcv_file_da_luu", String(Date.now())); } catch (error) {}
  }
  async function yeuCau(url, method, body) {
    var res = await fetch(url, {
      method: method || "GET", credentials: "same-origin",
      headers: { "X-CSRF-Token": layCsrf(), "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    var json = await res.json();
    if (!res.ok || !json.ok) throw new Error((json.error && json.error.message) || "Lỗi " + res.status);
    return json.data;
  }
  async function luu() {
    var lan = lanSua;
    if (dangDongBo) throw new Error("Đang đồng bộ nội dung với OnlyOffice — hãy chờ rồi thử lại");
    var ketQua = await yeuCau("/api/v1/task-file-versions/" + ID_BAN + "/save", "POST");
    if (ketQua.daLuu) {
      soBan = Math.max(soBan, Number(ketQua.versionNo) || 0);
      if (lan === lanSua) daSua = false;
      daLuu();
    } else if (daSua) {
      throw new Error("Chưa xác nhận thay đổi đã lưu — chưa gửi đi. Hãy nhấn Ctrl+S và chờ");
    } else bao(ketQua.lyDo || "Chưa có thay đổi nào để lưu", "#fde68a");
  }
  async function thucHien(gui) {
    if (dangXuLy || daGui) return;
    if (gui && !window.confirm("Chắc chắn gửi bản mới nhất đi phê duyệt?")) return;
    khoa(true);
    bao(gui ? "Đang chuẩn bị gửi…" : "Đang lưu…", "#fde68a");
    try {
      if (nutGui && !gui) await yeuCau("/api/v1/task-files/" + ID_NHOM + "/luu-tam", "PATCH", { ghiChu: yKien.value });
      if (!gui || daSua) await luu();
      if (gui) {
        if (daSua || dangDongBo) throw new Error("Còn thay đổi chưa lưu — chưa gửi đi");
        await yeuCau("/api/v1/task-files/" + ID_NHOM + "/gui-ban-moi", "POST", { noiDung: yKien.value });
        daGui = true;
        bao("Đã gửi bản mới nhất — bạn có thể đóng tab");
        try { localStorage.setItem("qlcv_file_da_luu", String(Date.now())); } catch (error) {}
        window.close();
      }
    } catch (error) { bao(error.message || "Không thực hiện được yêu cầu", "#fca5a5"); }
    finally { if (!daGui) khoa(false); }
  }
  nutLuu.addEventListener("click", function () { thucHien(false); });
  if (nutGui) nutGui.addEventListener("click", function () { thucHien(true); });
  async function kiemBanDaLuu() {
    if (daGui) return;
    try {
      if (!dangXuLy && document.visibilityState !== "hidden") {
        var lan = lanSua;
        var duLieu = await yeuCau("/api/v1/work-items/" + ID_NHIEM_VU + "/files");
        var nhom = (duLieu.nhom || []).find(function (row) { return Number(row.id) === ID_NHOM; });
        var banMoi = nhom && (nhom.bans || []).filter(function (row) {
          return Number(row.version_no) > soBan && String(row.uploaded_by) === nguoiId &&
            (nhom.luong || []).some(function (flow) { return flow.hanh_dong === "sua-truc-tuyen" && Number(flow.version_id) === Number(row.id); });
        }).pop();
        if (banMoi && !dangXuLy && !dangDongBo && lan === lanSua) {
          soBan = Number(banMoi.version_no); daSua = false; daLuu();
        }
      }
    } catch (error) {}
    if (!daGui) setTimeout(kiemBanDaLuu, 2000);
  }
  setTimeout(kiemBanDaLuu, 2000);
})();
</script>
<script src="${escapeHtmlServer(dsUrl)}/web-apps/apps/api/documents/api.js"
        onerror="window.__hienLoi('Không nạp được api.js của Document Server — trình duyệt chặn (Content-Security-Policy) hoặc DS không chạy.')"></script>
<script>
(function () {
  if (typeof DocsAPI === "undefined" || !DocsAPI.DocEditor) {
    window.__hienLoi("Đã nạp trang nhưng thư viện DocsAPI không có — xem tab Console của trình duyệt, thường là bị Content-Security-Policy chặn.");
    return;
  }
  var cauHinh = ${cauHinh};
  cauHinh.events = {
    onAppReady: function () { document.getElementById("loi").style.display = "none"; },
    onError: function (e) {
      var d = (e && e.data) || {};
      window.__hienLoi("Document Server báo lỗi " + (d.errorCode ?? "?") + ": " + (d.errorDescription || "không rõ"));
    },
    onDocumentStateChange: function (event) { window.__doiTrangThaiTaiLieu(event); },
    onRequestClose: function () { window.__dongEditor(); },
  };
  try {
    window.docEditor = new DocsAPI.DocEditor("placeholder", cauHinh);
  } catch (err) {
    window.__hienLoi("Lỗi khi khởi tạo trình chỉnh sửa: " + (err && err.message ? err.message : err));
  }
})();
</script>
</body></html>`;
}

/**
 * CALLBACK của DS (`status=2/6` + `url`): tải bản đã sửa về, lưu thành BẢN MỚI trong cùng nhóm
 * — đúng yêu cầu người dùng «sửa lại phải lưu để xem». Trạng thái nhóm KHÔNG đổi: sửa trực
 * tuyến là chỉnh nội dung một bản, không phải một bước của luồng duyệt.
 *
 * `nguoiSuaId` (từ `users[0]`/`actions[0].userid` của DS) là NGƯỜI VỪA SỬA. Trước đây bản mới ghi
 * cứng `uploaded_by = ban.uploaded_by` và vai `'Nhân viên'`, nên Trưởng phòng sửa file của cán bộ
 * thì «Lịch sử» hiện tên cán bộ với vai Nhân viên — sai người, sai vai. Đọc `users` để ghi đúng,
 * và gửi thông báo cho lãnh đạo phòng phụ trách + người nộp bản trước (yêu cầu người dùng
 * 2026-09-02: «đồng thời nhận được thông báo về sửa file»).
 */
export async function luuTuCallback(versionId, url, nguoiSuaId = null, maLuu = null) {
  const ban = await repo.findBanById(Number(versionId));
  if (!ban) throw notFound('Không tìm thấy bản file');
  const nhom = await repo.findNhomById(ban.file_id);
  if (!nhom) throw notFound('Không tìm thấy nhóm file chứa bản này');
  if (KET_THUC.includes(nhom.trang_thai)) {
    // Kết quả đã chốt — DS còn giữ phiên cũ thì báo bỏ qua (200) để nó thôi gọi lại.
    return { boQua: true, lyDo: 'Kết quả đã chốt, không nhận bản mới' };
  }
  if (!/^https?:\/\//i.test(String(url ?? ''))) {
    throw badRequest('URL bản đã sửa không hợp lệ');
  }
  const phanHoi = await fetch(url);
  if (!phanHoi.ok) throw badRequest(`ONLYOFFICE trả ${phanHoi.status} khi tải bản đã sửa`);
  const buffer = Buffer.from(await phanHoi.arrayBuffer());
  if (buffer.length === 0) throw badRequest('Bản đã sửa rỗng');
  if (buffer.length > DUNG_LUONG_TOI_DA)
    throw badRequest(`Bản đã sửa vượt quá dung lượng tối đa ${NHAN_DUNG_LUONG}`);

  // Người sửa phải là người CÓ THẬT và còn hoạt động; DS gửi id lạ (phiên cũ, dữ liệu rác) thì lùi
  // về người nộp bản đang sửa — không bao giờ để `uploaded_by` trỏ vào id không tồn tại.
  const luot = luotLuuDangCho.get(maLuu);
  const luotHopLe = luot?.banId === Number(versionId) ? luot : null;
  const idNguoiSua = luotHopLe?.nguoiId ?? nguoiSuaId;
  const nguoiSua = idNguoiSua == null ? null : await repo.nguoiTheoId(Number(idNguoiSua));
  const nguoiGhi = nguoiSua ?? { id: ban.uploaded_by, full_name: ban.ten_nguoi_nop, role: '' };

  const item = await itemsRepo.findById(nhom.item_id);
  const ketQua = await withTransaction(async (client) => {
    const nhomHienTai = await repo.lockNhomById(nhom.id, client);
    if (!nhomHienTai || KET_THUC.includes(nhomHienTai.trang_thai)) {
      return { boQua: true, lyDo: 'Kết quả đã chốt, không nhận bản mới' };
    }
    const versionNo = (await repo.soBanCaoNhat(nhom.id, client)) + 1;
    const duoi = path.extname(ban.ten_luu) || '.docx';
    const tenLuu = `v${versionNo}-${randomUUID()}${duoi}`;
    const thuMuc = path.join(GOC_STORAGE, String(nhom.item_id));
    await mkdir(thuMuc, { recursive: true });
    await writeFile(path.join(thuMuc, tenLuu), buffer);
    const moi = await repo.themBan(
      {
        fileId: nhom.id,
        versionNo,
        tenLuu,
        tenGoc: ban.ten_goc,
        loaiMime: ban.loai_mime,
        kichThuoc: buffer.length,
        uploadedBy: nguoiGhi.id,
      },
      client
    );
    await repo.themLuong(
      {
        fileId: nhom.id,
        versionId: moi.id,
        nguoiId: nguoiGhi.id,
        vai: nguoiGhi.role || 'Nhân viên',
        hanhDong: 'sua-truc-tuyen',
        noiDung: 'Sửa trực tuyến — lưu từ ONLYOFFICE',
      },
      client
    );
    // Thông báo trong CÙNG giao dịch (tiền lệ approvals): lãnh đạo phòng phụ trách nhiệm vụ +
    // người nộp bản trước. Người tự sửa không tự nhận thông báo — `bao()` lọc chính họ ra.
    if (item) {
      const cau =
        `Nhiệm vụ "${item.name}": ${nguoiGhi.full_name} sửa trực tuyến "${ban.ten_goc}" ` +
        `— đã lưu thành bản ${versionNo}.`;
      const { rows: lanhDao } = await nguoiNhanLanhDao(item, client);
      await bao(
        nguoiGhi,
        [...lanhDao.map((u) => u.id), ban.uploaded_by, item.assignee_id],
        cau,
        notificationsRepo.LOAI.CHO_DUYET,
        nhom.id,
        client
      );
    }
    return { boQua: false, version: moi };
  });
  if (luotHopLe && !ketQua.boQua) luotHopLe.ban = ketQua.version;
  return ketQua;
}
