// Kết quả nhiệm vụ: tải file/báo cáo → Lưu tạm → Gửi đi duyệt (V4).
// Ngoại lệ Q5: bản đáp ứng lệnh sửa gửi thẳng về cửa duyệt, editor lưu vẫn giữ lệnh sửa.
// can() + phân công + máy trạng thái kiểm lại trên máy chủ; thông báo cùng giao dịch.
// Sáu trạng thái: luu-tam, cho-xem, can-sua, cho-lanh-dao, hoan-thanh, da-duyet.
// Hai trạng thái cuối khóa mọi bản mới. TP/PP không tự chốt kết quả của chính mình.
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
import * as permissionsRepo from '../permissions/repo.js';
import { hieuLucCho } from '../delegations/service.js';
import { nhanKemVai } from '../assignments/service.js';
import { updateFileWeights } from './weights.js';
import { proposeTyLe } from '../approvals/tyLe.js';

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
  'luu-tam': 'lưu tạm, chưa gửi đi duyệt',
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
 * file đúng loại đó. V3 chặn bản MỚI sai loại bằng kiemDinhDangNhom; bản cũ vẫn được xem.
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

/** V3: cùng một cửa kiểm định dạng cho upload, báo cáo, save và callback. */
export const DUOI_THEO_DINH_DANG = Object.freeze({
  Word: ['.doc', '.docx'],
  Excel: ['.xls', '.xlsx'],
  PPT: ['.ppt', '.pptx'],
  PDF: ['.pdf'],
  Ảnh: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  'Báo cáo': [],
});
export function kiemDinhDangNhom(dinhDang, ten, baoCao = false) {
  const khai = dinhDang == null || dinhDang === '' ? null : dinhDang;
  if (khai !== null && !Object.hasOwn(DUOI_THEO_DINH_DANG, khai))
    throw badRequest('Định dạng khai không hợp lệ', 'dinhDang');
  const duoi = path.extname(String(ten ?? '')).toLowerCase();
  if (!khai) return baoCao ? DINH_DANG_BAO_CAO : dinhDangTheoDuoi(duoi);
  if (
    (baoCao && khai !== DINH_DANG_BAO_CAO) ||
    (!baoCao && !DUOI_THEO_DINH_DANG[khai].includes(duoi))
  ) {
    throw badRequest(
      'nhóm này khai ' +
        khai +
        ', ' +
        (khai === DINH_DANG_BAO_CAO
          ? 'chỉ nhận nội dung chữ, không nhận file'
          : 'chỉ nhận ' + DUOI_THEO_DINH_DANG[khai].join('/')),
      'file'
    );
  }
  return khai;
}

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

/**
 * Q1 + Q2 (ĐỢT B, 11/09/2026) — CẤM HẲN nút tải file khi CÂY chưa `Đã duyệt`.
 *
 * Người dùng chốt: «Gửi công việc cha lần đầu thì KHÔNG được up file kết quả lên», và lần gửi ĐẦU
 * chỉ có KHAI BÁO (tên kết quả · định dạng · tỷ lệ) đi theo cây; FILE THẬT đi chuỗi riêng SAU KHI
 * cây `Đã duyệt`. Lý do nghiệp vụ: người duyệt cây phải ký lên một danh sách kết quả đã chốt, chứ
 * không phải ký lên một cái cây mà sau đó ai cũng nhét thêm file vào được.
 *
 * Đây chính là chỗ hai trục duyệt biết nhau (điểm bất hợp lý số 1: `grep approval_status` trong
 * module này từng ra 0 kết quả) — `itemsRepo.cayDaDuyet` soi `approval_status` của CẢ nhiệm vụ, công
 * việc con chứa nó và công việc cha, đúng ba điều kiện của `v_countable_items`.
 *
 * Chỉ chặn NỘP (file và «Báo cáo»). `khaiKetQua` KHÔNG bị chặn: khai báo là đúng thứ được phép làm
 * trước khi duyệt. Nộp bằng `409` chứ không phải `403` — quyền của người bấm không sai, sai là sai
 * THỜI ĐIỂM, và trạng thái cây thay đổi được thì việc này làm lại được.
 */
const LOI_CAY_CHUA_DUYET =
  'Cây công việc chưa được duyệt nên chưa nộp được file kết quả — lúc này chỉ KHAI BÁO (tên kết quả · định dạng · tỷ lệ). File thật nộp ở chuỗi riêng sau khi cây Đã duyệt.';
async function assertCayDaDuyet(item) {
  if (!(await itemsRepo.cayDaDuyet(item.id))) throw conflict(LOI_CAY_CHUA_DUYET);
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
/** Cửa ghi: TP/PP phụ trách hoặc CHÍNH người thực hiện. Không dùng cho verdict/góp ý. */
function duocGhiTheoPhanCong(user, item) {
  return (
    !['Trưởng phòng', 'Phó phòng'].includes(user.role) ||
    sameId(item.assignee_id, user.id) ||
    laLanhDaoPhuTrachNhiemVu(user, item)
  );
}
function chanTpPpKhongPhuTrach(user, item) {
  if (!duocGhiTheoPhanCong(user, item)) throw loiKhongPhuTrach();
}

/**
 * BẢN ĐẦU TIÊN CỦA MỘT NHÓM KẾT QUẢ CHỈ DO CHÍNH NGƯỜI THỰC HIỆN NỘP (12/09/2026, người dùng báo).
 *
 * Lỗ hổng cũ: `duocGhiTheoPhanCong` mở cửa cho TP/PP **là lãnh đạo phụ trách** của nhiệm vụ, nên TP
 * up được bản 1 thay cho cán bộ — kết quả của một nhiệm vụ mang chữ của người không làm nó. Nay:
 * `versionNo === 1` ⇒ bắt buộc `assignee_id`; mọi bản sau (sửa, nộp lại sau khi bị trả về, bản do
 * người duyệt sửa trực tuyến) vẫn theo luật cũ. Điều kiện viết theo SỐ BẢN chứ không theo
 * «`fileId == null`» vì Q1 tách KHAI BÁO khỏi NỘP FILE: `khaiKetQua` tạo nhóm **0 bản**, nên một
 * nhóm đã khai sẵn vẫn sinh bản số 1 khi có người nộp file đầu tiên vào nó.
 *
 * Nhiệm vụ chưa gán người thực hiện (`assignee_id` NULL — cột cho phép) thì báo 409 chứ không phải
 * 403: thiếu dữ kiện để quyết, không phải thiếu quyền.
 */
async function assertNguoiNopBanDau(user, item, versionNo, client = null) {
  if (Number(versionNo) > 1) return;
  if (item.assignee_id == null) {
    throw conflict(
      'Nhiệm vụ chưa có «Người thực hiện trực tiếp» — hãy gán người thực hiện ở form nhiệm vụ ' +
        'trước, rồi chính người đó nộp bản kết quả đầu tiên'
    );
  }
  if (sameId(item.assignee_id, user.id)) return;
  const nguoiThucHien = await repo.nguoiTheoId(item.assignee_id, client);
  throw forbidden(
    `Chỉ «Người thực hiện trực tiếp» (${nguoiThucHien?.full_name ?? 'đã gán cho nhiệm vụ'}) ` +
      'mới được nộp bản kết quả ĐẦU TIÊN — TP/PP và PGĐ/GĐ chỉ sửa/nộp từ bản thứ hai trở đi'
  );
}

/**
 * QUY TẮC TỰ-ĐỘNG sau khi lưu một bản (file hay «Báo cáo» đều dùng): bản phải trình Ban lãnh đạo
 * ⇒ 'cho-lanh-dao'; còn lại ⇒ 'cho-xem'. Trả trạng thái mới để bên gọi ghi + soạn câu thông báo.
 *
 * R6 (ĐỢT B, 11/09/2026) — BỎ TỰ DUYỆT. Bản cũ đọc `file:create` hiệu lực của NGƯỜI NỘP và trả
 * 'da-duyet' khi giá trị là ✓, kèm một dòng luồng 'duyet-tu-dong': tức là MẶC ĐỊNH KHÔNG AI DUYỆT
 * FILE (điểm bất hợp lý số 6). Nay `file:create = ✓` chỉ còn đúng nghĩa «được phép khai/nộp» — mọi
 * bản đều phải có một người ký, và `duyet-tu-dong` không được ghi thêm nữa (mã đó vẫn nằm trong
 * CHECK của `task_file_flow` để dòng lịch sử cũ còn đọc được).
 *
 * MỚI-6 (12/09/2026) — bản cũ CHỈ NHÌN VAI: hễ người nộp là Trưởng/Phó phòng thì bản lên thẳng
 * `cho-lanh-dao` (Phó GĐ), bất kể nhiệm vụ có tích «Gửi BLĐ phê duyệt» hay không. Trái nghĩa Q6/Q11
 * (tích TẮT ⇒ TP/PP là CHẶNG CUỐI, chốt bằng `hoan-thanh`), và người dùng gặp thật hai lần trên
 * CV002 — TP sửa trực tuyến rồi bấm «Gửi đi duyệt» là file chạy lên Phó GĐ dù cái tích đang TẮT.
 * Nay TP/PP chỉ trình Ban lãnh đạo khi NHIỆM VỤ thật sự phải trình, đúng ba lý do của
 * `phaiTrinhLanhDao`: tích BẬT · chính họ là NGƯỜI THỰC HIỆN (Q5) · admin đã thu quyền chốt
 * (`file:approve` ≠ ✓, họ không còn cửa «Hoàn thành / Duyệt» nên phải có người ký thay). Ngược lại
 * bản về `cho-xem` — đúng hàng chờ của TP/PP — để chính họ chốt. R6 vẫn giữ: KHÔNG BAO GIỜ trả
 * 'da-duyet'.
 *
 * `ghiDe` phải ĐỌC LẠI theo vai: `nguoiNop` ở đây là dòng `users` do `repo.nguoiTheoId` lấy ra,
 * không phải `req.user` nên không mang bảng ghi đè mà session đã gắn.
 */
async function apTuDong(user, item, client) {
  // Chỉ quyết định trạng thái, lịch sử ghi sau dòng gửi.
  if (!['Trưởng phòng', 'Phó phòng'].includes(user.role)) return 'cho-xem';
  const dong = await permissionsRepo.listByVai(user.role, client);
  const nguoiNop = {
    ...user,
    ghiDe: Object.fromEntries(
      dong.map((g) => [g.entity_type + ':' + g.action, { gia_tri: g.gia_tri, pham_vi: g.pham_vi }])
    ),
  };
  return phaiTrinhLanhDao(nguoiNop, item) ? 'cho-lanh-dao' : 'cho-xem';
}

/** V4: quyền gửi tách khỏi tải lên. Người tạo, người thực hiện hoặc người lưu bản cuối
 * có thể gửi trong modal; hàng chờ nháp vẫn chỉ người tạo nhóm + admin (Q5).
 * Không dùng vai người bấm hộ (đặc biệt admin) để tự duyệt bản do cán bộ/TP nộp.
 *
 * MỚI-6 (12/09/2026): thêm vế cuối — TP/PP trên nhiệm vụ KHÔNG phải trình Ban lãnh đạo thì «Gửi đi
 * duyệt» với họ là gửi cho CHÍNH HỌ, nên ẩn nút (người dùng chọn «Ẩn nút, chỉ còn «Hoàn thành»»).
 * Không thành thế kẹt: `hoan-thanh` nay mở cả ở trạng thái `luu-tam` (xem `BANG_VERDICT`), và điều
 * kiện `duocGhiTheoPhanCong` trong `laChuBanNhom` đã bảo đảm người này đúng là LÃNH ĐẠO PHỤ TRÁCH
 * của nhiệm vụ.
 */
function duocGuiBanLuu(user, nhom, item, ban) {
  return laChuBanNhom(user, nhom, item, ban) && !tpPpLaChanhCuoi(user, item);
}

/**
 * Vế «có phải chủ bản nháp không» của `duocGuiBanLuu`, TÁCH RIÊNG để `guiDiDuyet` báo đúng lý do:
 * không phải chủ ⇒ 403 mất quyền; là chủ mà TP/PP là chặng cuối ⇒ 409 «không còn ai để gửi». Gộp
 * chung một hàm thì hai ca đó không phân biệt được (đã trả giá: TC-V4-02 nhận 409 thay vì 403).
 */
function laChuBanNhom(user, nhom, item, ban) {
  return (
    nhom.trang_thai === 'luu-tam' &&
    Boolean(ban) &&
    can(user, 'submit', 'file', item).ok &&
    duocGhiTheoPhanCong(user, item) &&
    (user.role === 'admin' ||
      sameId(nhom.created_by, user.id) ||
      sameId(item.assignee_id, user.id) ||
      sameId(ban.uploaded_by, user.id))
  );
}

/** Người bấm là Trưởng/Phó phòng VÀ nhiệm vụ không cần trình lên trên ⇒ họ là chặng cuối. */
function tpPpLaChanhCuoi(user, item) {
  return ['Trưởng phòng', 'Phó phòng'].includes(user.role) && !phaiTrinhLanhDao(user, item);
}

async function guiBanDaLuu(user, item, nhom, ban, client, noiDung = '', hanhDongLuu = 'gui-duyet') {
  assertCan(user, 'submit', item);
  chanTpPpKhongPhuTrach(user, item);
  const nguoiNop = await repo.nguoiTheoId(ban.uploaded_by, client);
  if (!nguoiNop)
    throw conflict('Người nộp bản này không còn hoạt động — cần lưu bản mới trước khi gửi');
  const nguoiThucHien = await repo.nguoiTheoId(item.assignee_id, client);
  // TP/PP tự thực hiện luôn lên Phó GĐ, kể cả ai đó tải/gửi hộ (Q5 — GIỮ NGUYÊN ở ĐỢT B).
  const canTraLanhDao =
    ['Trưởng phòng', 'Phó phòng'].includes(nguoiThucHien?.role) ||
    (nhom.trang_thai === 'can-sua' && nhom.lenh_sua_cho === 'lanh-dao');
  // R6: không còn nhánh 'da-duyet' ở đây. `apTuDong` chỉ trả 'cho-lanh-dao' hoặc 'cho-xem', và
  // `batBuocDuyet` của bản cũ (đọc `gui_bld_phe_duyet` + `file:submit = ⏳`) mất nghĩa: nó sinh ra chỉ
  // để CHẶN tự duyệt, mà nay không còn gì để chặn.
  const trangThai = canTraLanhDao ? 'cho-lanh-dao' : await apTuDong(nguoiNop, item, client);
  if (hanhDongLuu) {
    await repo.themLuong(
      {
        fileId: nhom.id,
        versionId: ban.id,
        nguoiId: user.id,
        vai: user.role,
        hanhDong: hanhDongLuu,
        noiDung:
          noiDung || (hanhDongLuu === 'nop' ? 'Gửi bản mới nhất' : 'Gửi bản mới nhất đi duyệt'),
      },
      client
    );
  }
  const capNhat = await repo.doiTrangThai(nhom.id, trangThai, client);
  const { rows: lanhDao, thieuLanhDao } = await nguoiNhanLanhDao(item, client);
  const nguoiNhan = trangThai === 'cho-lanh-dao' ? await banLanhDaoNhanFile(item, client) : lanhDao;
  await baoNguoiNhan(
    user,
    nguoiNhan,
    `Nhiệm vụ "${item.name}": ${user.full_name} gửi bản ${ban.version_no} của "${nhom.ten_ket_qua || nhom.ten_goc}" — ${NHAN_TRANG_THAI[trangThai]}.` +
      (trangThai === 'cho-xem' && thieuLanhDao ? NHAC_GAN_LANH_DAO : ''),
    notificationsRepo.LOAI.CHO_DUYET,
    nhom.id,
    client
  );
  return { nhom: { ...nhom, ...capNhat }, ban, tuDong: false };
}

/** Tải lên bình thường chỉ lưu; bản ĐÁP ỨNG lệnh sửa gửi thẳng theo Q5. */
async function ketThucLuuBan(user, item, nhom, ban, client) {
  if (nhom.trang_thai === 'can-sua' && nhom.lenh_sua_cho) {
    return guiBanDaLuu(user, item, nhom, ban, client, 'Gửi bản đáp ứng lệnh sửa', null);
  }
  const capNhat = await repo.doiTrangThai(nhom.id, 'luu-tam', client);
  return { nhom: { ...nhom, ...capNhat }, ban, tuDong: false };
}

export function guiDiDuyet(user, fileId, { noiDung = '', versionId = null } = {}) {
  return withTransaction(async (client) => {
    const nhom = await repo.lockNhomById(Number(fileId), client);
    if (!nhom) throw notFound('Không tìm thấy nhóm file kết quả');
    const item = await mustFindNhiemVu(nhom.item_id, client);
    assertCan(user, 'submit', item);
    chanTpPpKhongPhuTrach(user, item);
    const ban = await repo.banCuoiCung(nhom.id, client);
    if (nhom.trang_thai !== 'luu-tam')
      throw conflict('Bản này không còn Lưu tạm — hãy tải lại trước khi gửi');
    if (!ban) throw conflict('Chưa có bản nào được lưu để gửi đi phê duyệt');
    // MỚI-6: hai lý do từ chối KHÁC NHAU — báo đúng lý do, đừng để người dùng tưởng mình mất quyền
    // trong khi chỉ là nhiệm vụ này không còn chặng nào để «gửi đi». Kiểm «không phải chủ bản» TRƯỚC:
    // một TP/PP đứng ngoài bản nháp của người khác vẫn phải nhận 403 mất quyền (TC-V4-02).
    if (!laChuBanNhom(user, nhom, item, ban))
      throw forbidden(
        'Chỉ người tạo nhóm, người thực hiện, người lưu bản cuối hoặc Giám đốc được gửi bản lưu tạm'
      );
    if (tpPpLaChanhCuoi(user, item))
      throw conflict(
        'Nhiệm vụ này KHÔNG bật «Gửi BLĐ phê duyệt» nên bạn là chặng cuối — không còn ai để gửi. Hãy dùng «Hoàn thành / Duyệt» để chốt, hoặc «Đẩy về Cán bộ» nếu cần sửa lại.'
      );
    if (versionId != null && !sameId(versionId, ban.id))
      throw conflict('Đã có bản mới hơn — hãy kiểm tra lại trước khi gửi');
    return guiBanDaLuu(user, item, nhom, ban, client, String(noiDung).trim());
  });
}

/**
 * KHAI MỘT DÒNG KẾT QUẢ TRƯỚC KHI CÓ FILE (016) — nút ＋ của khối «Kết quả».
 *
 * Người dùng chốt 2026-09-03: «Dòng đầu tiên khi mới tạo nhiệm vụ sẽ điền 1. 2. 3. điền những nội
 * dung Kết quả làm được, Định dạng, Ghi ý kiến. Nhớ phải có nút + để thêm dòng để điền 2, 3…».
 * Nhóm sinh ra với **0 bản** ⇒ cột «File đã tải lên» là «Chưa có» và nhóm KHÔNG vào hàng chờ phê
 * duyệt (`listChoDuyetKetQua` đòi `v.id IS NOT NULL`): chưa có gì để duyệt thì đừng bắt ai duyệt.
 *
 * Trạng thái luôn là 'luu-tam' — KHÔNG áp quy tắc tự-động ở đây: chưa có bản nào thì không có cái
 * gì để «duyệt tự động», và để 'da-duyet' là khoá luôn dòng vừa khai (nộp file sau sẽ bị 409).
 *
 * Ý kiến khai kèm ghi vào BẢNG LUỒNG (`hanh_dong = 'luu-tam'`, `version_id` NULL — 014 cho phép), không
 * vào `task_file_comments`: bảng góp ý gắn theo BẢN mà ở đây chưa có bản nào.
 *
 * ĐỢT B (Q1 + Q2): khi cây chưa `Đã duyệt` thì đây là CỬA DUY NHẤT còn mở — nộp file và nộp «Báo
 * cáo» đều bị `assertCayDaDuyet` chặn, chỉ còn khai báo. Và khai báo nay nhận THÊM `tyLe`, đúng ba
 * thứ Q1 liệt kê: «tên kết quả · định dạng · tỷ lệ». Tỷ lệ khai lúc này ghi THẲNG (Q3: nháp thì sửa
 * thoải mái mọi thứ) vì nó đi lên cùng phiếu duyệt cây; khai trên một cây ĐÃ duyệt thì nó thành một
 * đề nghị `ty-le` như `suaTyLe` (R4'').
 */
export async function khaiKetQua(
  user,
  ref,
  { tenKetQua, dinhDang = null, yKien = '', tyLe = null }
) {
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
  // Tỷ lệ là PHẦN KHAI BÁO tuỳ chọn (Q1). `null`/`''` = để máy chia đều như cũ.
  const tyLeKhai =
    tyLe == null || tyLe === ''
      ? null
      : Number.isInteger(tyLe) && tyLe >= 0 && tyLe <= 100
        ? tyLe
        : null;
  if (tyLe != null && tyLe !== '' && tyLeKhai == null) {
    throw badRequest('Tỷ lệ công việc của file phải là số nguyên từ 0 đến 100', 'tyLe');
  }

  return withTransaction(async (client) => {
    assertCan(user, 'create', item);
    chanTpPpKhongPhuTrach(user, item);
    const nhom = await repo.themNhom(
      {
        itemId: item.id,
        tenGoc: ten,
        tenKetQua: ten,
        dinhDang: dd,
        trangThai: 'luu-tam',
        createdBy: user.id,
      },
      client
    );
    // `themNhom` đã tự chia đều; khai tỷ lệ riêng thì đặt lại đúng con số người dùng nhập.
    let tyLeChange = { pending: false, value: nhom.ty_le };
    if (tyLeKhai != null && tyLeKhai !== Number(nhom.ty_le)) {
      if (await itemsRepo.cayDaDuyet(item.id, client)) {
        tyLeChange = await proposeTyLe(
          user,
          { loai: 'file', row: { ...nhom, ty_le: nhom.ty_le }, item },
          tyLeKhai,
          client
        );
      } else {
        await updateFileWeights(item.id, client, { editedId: nhom.id, value: tyLeKhai });
        tyLeChange = { pending: false, value: tyLeKhai };
      }
    }
    await repo.themLuong(
      {
        fileId: nhom.id,
        versionId: null,
        nguoiId: user.id,
        vai: user.role,
        hanhDong: nhom.trang_thai === 'can-sua' && nhom.lenh_sua_cho ? 'nop' : 'luu-tam',
        noiDung:
          yk ||
          `Khai dòng kết quả «${ten}»${dd ? ` — định dạng ${dd}` : ''}${
            tyLeKhai != null ? ` — tỷ lệ ${tyLeKhai}%` : ''
          }, chưa có file`,
      },
      client
    );
    return {
      nhom: { ...nhom, ty_le: tyLeChange.value ?? nhom.ty_le },
      ban: null,
      tuDong: false,
      tyLeChange,
    };
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
  // Q2 áp cho CẢ «Báo cáo»: nó không có file vật lý nhưng nó LÀ NỘI DUNG KẾT QUẢ và sinh ra một
  // BẢN (`task_file_versions`) y như nộp file. Chỉ cho khai báo trước khi duyệt thì bản chữ cũng phải
  // chờ — nếu không đây thành cửa sau để nộp kết quả vào một cái cây chưa ai ký.
  await assertCayDaDuyet(item);

  return withTransaction(async (client) => {
    assertCan(user, 'create', item);
    let nhom = fileId != null ? await nhomDeThemBan(user, item, fileId, client) : null;
    chanTpPpKhongPhuTrach(user, item);

    // Tiêu đề bản: ưu tiên tên người dùng nhập, rồi tên kết quả đã khai của nhóm, cuối cùng mặc
    // định — cột `ten_goc` của bản là NOT NULL và bảng kết quả in nó ở cột «File đã tải lên».
    kiemDinhDangNhom(nhom?.dinh_dang, '', true);
    const ten = tenNhap || nhom?.ten_ket_qua || nhom?.ten_goc || 'Báo cáo';
    const versionNo = (nhom ? await repo.soBanCaoNhat(nhom.id, client) : 0) + 1;
    await assertNguoiNopBanDau(user, item, versionNo, client);
    if (!nhom) {
      nhom = await repo.themNhom(
        {
          itemId: item.id,
          tenGoc: ten,
          tenKetQua: ten,
          dinhDang: DINH_DANG_BAO_CAO,
          trangThai: 'luu-tam',
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
        hanhDong: nhom.trang_thai === 'can-sua' && nhom.lenh_sua_cho ? 'nop' : 'luu-tam',
        noiDung: `Báo cáo (nhập chữ, không có file) — bản ${versionNo}`,
      },
      client
    );

    return ketThucLuuBan(user, item, nhom, ban, client);
  });
}

/**
 * NỘP BẢN MỚI. `fileId` có thì nộp thêm bản vào NHÓM có sẵn; không có thì mở NHÓM mới (v1).
 *
 * Lưu bình thường là luu-tam, chưa thông báo/chưa tự duyệt. Bản đáp ứng lệnh sửa gửi ngay.
 * Khi gửi mới đọc file:submit và file:create của người nộp, giữ trần TP/PP. Trả về `{ nhom, ban, tuDong }` (tuDong = đã chốt tự động hay không).
 */
export async function nop(
  user,
  ref,
  { buffer, tenGoc, loaiMime, fileId = null, moTa = '', dinhDang = null }
) {
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
  // Q2 — chặn TRƯỚC khi mở giao dịch và TRƯỚC khi ghi đĩa: để sau một lời gọi bị từ chối không còn
  // một file mồ côi nằm trong `storage/ket-qua/<itemId>/` mà không dòng CSDL nào trỏ tới.
  await assertCayDaDuyet(item);

  return withTransaction(async (client) => {
    assertCan(user, 'create', item);

    const nhomCo = fileId != null ? await nhomDeThemBan(user, item, fileId, client) : null;
    let nhom = nhomCo;
    chanTpPpKhongPhuTrach(user, item);

    if (nhom?.trang_thai === 'can-sua' && nhom.lenh_sua_cho) assertCan(user, 'submit', item);
    kiemDinhDangNhom(nhom?.dinh_dang ?? dinhDang, tenSan);
    const versionNo = (nhom ? await repo.soBanCaoNhat(nhom.id, client) : 0) + 1;
    // Chặn TRƯỚC khi ghi đĩa: lời gọi bị từ chối không để lại file mồ côi trong `storage/ket-qua/`.
    await assertNguoiNopBanDau(user, item, versionNo, client);
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
          dinhDang: dinhDang ?? dinhDangTheoDuoi(duoi),
          trangThai: 'luu-tam',
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
        hanhDong: nhom.trang_thai === 'can-sua' && nhom.lenh_sua_cho ? 'nop' : 'luu-tam',
        noiDung: moTa,
      },
      client
    );

    return ketThucLuuBan(user, item, nhom, ban, client);
  });
}

/** Phó Giám đốc phụ trách phòng — khuôn `phoGiamDocPhuTrach` của approvals. */
async function phoGiamDocPhuTrach(departmentId, client) {
  if (departmentId == null) return [];
  const managers = await deptRepo.listManagers(departmentId, client);
  return managers.filter((m) => m.role === 'deputy_director');
}

/** V7 + ĐỢT B (điểm 12): file lên Ban lãnh đạo là lên ĐÚNG người kiểm soát của nhiệm vụ đó. */
async function banLanhDaoNhanFile(item, client) {
  const id = supervisorFile(item);
  if (id == null) return phoGiamDocPhuTrach(item.department_id, client);
  const who = await repo.nguoiTheoId(id, client);
  if (!who) throw badRequest('Nhiệm vụ chưa có Ban lãnh đạo phụ trách để gửi phê duyệt');
  return [who];
}
// Đợt A (028): `supervisor_hieu_luc` do `sqlSupervisorHieuLuc` tính sẵn trong SQL và ĐÃ là «phần
// tử đầu của chính dòng, không thì của cấp 2 chứa nó» — đúng Q12. Nhánh dự phòng đọc thẳng
// `supervisor_ids` dành cho những `item` do service tự dựng chứ không qua repo (không có cột tính
// sẵn); cấp 3 nay có người kiểm soát RIÊNG nên không còn phải mượn của cha như bản cũ.
const supervisorFile = (item) => item.supervisor_hieu_luc ?? (item.supervisor_ids ?? [])[0] ?? null;
/**
 * ĐIỂM 12 (ĐỢT B) — ai được xử lý file của nhiệm vụ này ở cửa lãnh đạo.
 *
 * Bản cũ chỉ siết khi `gui_bld_phe_duyet` BẬT và chỉ siết vai Phó Giám đốc: tích TẮT thì bất kỳ Phó
 * GĐ nào của phòng, và cả admin, đều duyệt được DÙ Ô «BAN LÃNH ĐẠO KIỂM SOÁT» GHI NGƯỜI KHÁC. Nay
 * siết theo đúng ô đó, KHÔNG phụ thuộc cái tích, và áp cho cả admin — cùng một luật với R1(a) bên
 * trục duyệt cây: người có tên trong `supervisor_ids` mới là người duyệt.
 *
 * Hai vai TP/PP không đi qua đây (họ bị `laLanhDaoPhuTrachNhiemVu` soi theo `leader_ids`), nên hàm
 * chỉ cần trả lời cho Phó Giám đốc và admin.
 *
 * Ô CHƯA chọn ai (`supervisorFile` = null) thì KHÔNG siết: điểm 12 than đúng cái «ô ghi người khác
 * mà ai cũng duyệt được», còn ô trống thì chẳng mâu thuẫn với ai. Chặn cả trường hợp này là tạo
 * nút thắt vĩnh viễn — R1(a) dặn phải chừa đường thoát, và ở đây không có đường gỡ nào vì nhiệm vụ
 * chưa hề có người để mà «đổi sang».
 */
const dungNguoiDuyetFile = (user, item) => {
  if (user.role !== 'Phó Giám đốc' && user.role !== 'admin') return true;
  const ai = supervisorFile(item);
  return ai == null || sameId(user.id, ai);
};

/**
 * Q6 + Q11 (người dùng chốt 11/09/2026, sau khi thử thật trên CV002-002) — nhiệm vụ KHÔNG tích
 * «Gửi BLĐ phê duyệt» thì TP/PP là CHẶNG CUỐI, file KHÔNG được đẩy lên Phó GĐ.
 *
 * «TP/PP phê duyệt» nghĩa là TRÌNH Ban lãnh đạo kiểm soát, nên nó chỉ còn chỗ khi thật sự phải
 * trình. Trả `true` = phải trình lên (nút «TP/PP phê duyệt» hiện, nút «Hoàn thành / Duyệt» ẩn);
 * `false` = chốt tại phòng (ngược lại). Ba lý do phải trình:
 *   • tích BẬT — đúng nghĩa của cái tích;
 *   • Q5 — chính người bấm là NGƯỜI THỰC HIỆN của nhiệm vụ ⇒ không ai trong phòng ký thay được,
 *     đây cũng là van chống tự duyệt duy nhất còn giữ (xem `verdict`);
 *   • admin đặt ⏳/✕ ở «Duyệt kết quả (file nhiệm vụ)» cho vai đó ⇒ mất quyền chốt, chỉ còn trình.
 *
 * Hai hàm `verdict` (rào chặn) và `hanhDongDuocLam` (ẩn/hiện nút) đọc CÙNG hàm này, nên không bao
 * giờ có chuyện nút hiện mà bấm bị từ chối, hay nút ẩn mà máy chủ vẫn cho làm.
 */
function phaiTrinhLanhDao(user, item) {
  return (
    item.gui_bld_phe_duyet === true ||
    sameId(item.assignee_id, user.id) ||
    giaTriHieuLuc(user, 'file', 'approve') !== 'cho-phep'
  );
}

// ────────────────────────────────────────────────────────────────────────────────────────────
// BẢNG VERDICT — state machine kiểm CẢ quyền HIỆU LỰC lẫn trạng thái hiện tại.
//  - vai: ai được làm (máy chủ khớp CHÍNH XÁC users.role — bẫy includes §13.5).
//  - tu:   trạng thái nhóm cho phép thực hiện hành động.  den: trạng thái chuyển tới.
//  - canDuyet: là hành động CHỐT ⇒ cửa `file:approve` phải có giá trị hiệu lực 'cho-phep'
//    (admin đặt ⏳ cho TP/PP ⇒ mất nút «Hoàn thành», chỉ còn «TP/PP phê duyệt» + «Đẩy về Cán bộ»).
//  - canNoiDung: bắt buộc nội dung ≥ 10 ký tự.
//  - laMocTpPp: hành động là một LẦN TP/PP KÝ ⇒ ghi `tp_duyet_boi` + `tp_duyet_luc` (điểm 7).
//  - chiKhiTrinh: hành động chỉ tồn tại khi `phaiTrinhLanhDao(user, item)` — xem Q6 bên dưới.
//
// ĐỢT B (11/09/2026) đổi bảng này ba chỗ, đều theo quyết định đã chốt:
//  • ĐIỂM 9 — BỎ `yeu-cau-sua`, gộp vào `tra-ve-cbo`. Hai mã cũ cùng `den:'can-sua'`, cùng
//    `datLenhSua(...,'can-bo',...)`, khác đúng `tu` và `canNoiDung`: hai nút cho một việc. Mã sống
//    sót lấy `tu` là HỢP của hai bên và `canNoiDung: true` — trả việc về cho cán bộ mà không nói vì
//    sao là đúng cái bất hợp lý đang dọn, và `tra-ve-tp` bên dưới cũng đã bắt nội dung như vậy.
//    Migration 029 viết lại lịch sử nên dòng cũ vẫn đọc được.
//  • ĐIỂM 7 — `trinh-lanh-dao` thành `tp-phe-duyet` («TP/PP phê duyệt»), và nay có lưu AI ký và
//    LÚC NÀO. Trạng thái đích vẫn `cho-lanh-dao` vì bản chất hành động là TRÌNH lên Ban lãnh đạo.
//  • R6 — `duyet-tu-dong` không còn là một hành động ở đây; nó chỉ còn trong CHECK của bảng luồng
//    cho lịch sử cũ.
//
// SỬA SAU KHI NGƯỜI DÙNG THỬ THẬT (11/09/2026, nhiệm vụ CV002-002) — Q6/Q11 bị bỏ sót ở ĐIỂM 7:
// nhiệm vụ KHÔNG tích «Gửi BLĐ phê duyệt» mà bấm «TP/PP phê duyệt» thì file VẪN lên Phó GĐ, trái
// nghĩa của cái tích. Nay nút đó chỉ hiện khi thật sự phải trình (`phaiTrinhLanhDao`); tích TẮT và
// được chốt thì TP/PP kết thúc bằng «Hoàn thành / Duyệt» ⇒ `hoan-thanh`, không qua BLĐ. Cùng lúc
// NỚI van chống tự duyệt: trước đây nó chặn cả người chỉ LƯU BẢN CUỐI (sửa trực tuyến hộ, gửi hộ),
// nên TP rơi vào thế kẹt — không tự chốt được mà tích lại cấm trình. Van nay chỉ còn chặn khi người
// bấm chính là NGƯỜI THỰC HIỆN (đúng Q5); xem chú thích trong `verdict`.
// ────────────────────────────────────────────────────────────────────────────────────────────
const BANG_VERDICT = Object.freeze({
  'tp-phe-duyet': Object.freeze({
    vai: ['Trưởng phòng', 'Phó phòng'],
    tu: ['cho-xem', 'can-sua'],
    den: 'cho-lanh-dao',
    canDuyet: false,
    canNoiDung: true,
    canKiem: 'read',
    laMocTpPp: true,
    chiKhiTrinh: true,
  }),
  'tra-ve-cbo': Object.freeze({
    vai: ['Trưởng phòng', 'Phó phòng'],
    tu: ['cho-xem', 'cho-lanh-dao', 'can-sua'],
    den: 'can-sua',
    canDuyet: false,
    canNoiDung: true,
    canKiem: 'read',
  }),
  'hoan-thanh': Object.freeze({
    vai: ['Trưởng phòng', 'Phó phòng'],
    // MỚI-6 (12/09/2026): thêm `luu-tam`. Nhiệm vụ KHÔNG tích «Gửi BLĐ phê duyệt» thì TP/PP là
    // chặng cuối, và nút «Gửi đi duyệt» của chính họ bị ẩn (xem `duocGuiBanLuu`) — nếu `hoan-thanh`
    // không mở ở `luu-tam` thì bản nháp do TP/PP tạo không còn đường nào ra. Ràng buộc «phải có ít
    // nhất MỘT bản» nằm ở `verdict` và ở `hanhDongDuocLam`, vì Q1 cho khai nhóm trước khi có file.
    tu: ['luu-tam', 'cho-xem', 'can-sua'],
    den: 'hoan-thanh',
    canDuyet: true,
    canNoiDung: false,
    canKiem: 'read',
    laMocTpPp: true,
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
  'tp-phe-duyet': 'TP/PP phê duyệt',
  'tra-ve-cbo': 'Đẩy về Cán bộ',
  // Tên đầy đủ của nút chốt, đúng như docs/KE-HOACH-KET-QUA-FILE.md và migration 014 gọi từ
  // 2026-09-01: một nút hai nghĩa — HOÀN THÀNH luôn (không trình ai) và đó chính là lần DUYỆT của
  // TP/PP (`laMocTpPp`, có ghi `tp_duyet_boi` + `tp_duyet_luc`). Danh sách dự phòng ở client
  // (app.js `dsVerdictFile`) cũng viết đúng nhãn này.
  'hoan-thanh': 'Hoàn thành / Duyệt',
  'tra-ve-tp': 'Trả về TP/PP',
  duyet: 'Duyệt',
});

const lyDoQuaNgan = (s) => s.length < DO_DAI_NOI_DUNG_TOI_THIEU;

/**
 * Xử lý một nhóm file: TP/PP phê duyệt · Đẩy về Cán bộ · Hoàn thành (TP/PP) ·
 * Trả về TP/PP · Duyệt (PGĐ/GĐ). Kiểm VAI + PHẠM VI + GIÁ TRỊ HIỆU LỰC + TRẠNG THÁI hiện tại.
 */
export function verdict(user, fileId, { hanhDong, noiDung = '', versionId = null }) {
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
    if (!dungNguoiDuyetFile(user, item))
      throw forbidden('Chỉ Ban lãnh đạo phụ trách được chỉ định mới duyệt kết quả này');
    // Q6/Q11 — «Hoàn thành» và «TP/PP phê duyệt» là hai đầu ra LOẠI TRỪ NHAU: nhiệm vụ phải trình
    // Ban lãnh đạo kiểm soát thì không chốt tại phòng, và ngược lại. Ba lý do phải trình
    // (`phaiTrinhLanhDao`) bị chặn ở BA chỗ khác nhau, mỗi chỗ một câu báo đúng lý do: tích BẬT ở
    // ngay đây, admin đặt ⏳ ở rào `canDuyet` bên dưới, và Q5 (người bấm là người thực hiện) ở van
    // chống tự duyệt. Chặn cả ở máy chủ chứ không chỉ ẩn nút, vì hàng nút và trang có thể lệch nhau
    // khi người dùng chưa tải lại sau khi admin đổi tích.
    if (hanhDong === 'hoan-thanh' && item.gui_bld_phe_duyet) {
      throw forbidden(
        'Nhiệm vụ đã bật Gửi BLĐ phê duyệt — phải trình Ban lãnh đạo phụ trách, không Hoàn thành tại TP/PP'
      );
    }
    if (luat.chiKhiTrinh && !phaiTrinhLanhDao(user, item)) {
      throw conflict(
        'Nhiệm vụ này KHÔNG bật «Gửi BLĐ phê duyệt» nên TP/PP là chặng cuối — hãy dùng «Hoàn thành / Duyệt» để chốt, hoặc «Đẩy về Cán bộ» nếu cần sửa lại.'
      );
    }
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
        'Quản trị đã đặt «⏳ Chờ duyệt» ở ô «Duyệt kết quả (file nhiệm vụ)» cho vai của bạn — hãy dùng «TP/PP phê duyệt» hoặc «Đẩy về Cán bộ».'
      );
    }
    if (!luat.tu.includes(nhom.trang_thai)) {
      throw conflict(
        `File đang ở trạng thái «${NHAN_TRANG_THAI[nhom.trang_thai]}» — không làm được «${NHAN_VERDICT[hanhDong]}» ở lúc này`
      );
    }

    const banCuoi = await repo.banCuoiCung(nhom.id, client);
    // MỚI-6: `hoan-thanh` nay mở cả ở `luu-tam`, mà Q1 cho KHAI nhóm trước khi có file — chốt một
    // nhóm chưa có bản nào là cho tiến độ lên 100% mà chưa có kết quả nào để đọc.
    if (nhom.trang_thai === 'luu-tam' && !banCuoi)
      throw conflict('Nhóm kết quả này chưa có bản nào được lưu — không có gì để chốt');
    if (versionId != null && !sameId(banCuoi?.id, versionId)) {
      throw conflict(
        'Đã có bản khác được lưu — hãy tải lại và kiểm tra bản mới nhất trước khi duyệt'
      );
    }
    // 2026-09-09 — CHẶN TỰ DUYỆT, NỚI lại 11/09/2026 theo Q5/Q6. Trưởng/Phó phòng nay được nhận
    // việc trực tiếp, mà họ cũng là người duyệt ĐẦU TIÊN của file kết quả (`hoan-thanh` là trạng
    // thái kết, được tính là XONG trong tienDo.js). Nếu để họ tự chốt thì chỉ cần «Đẩy về Cán bộ»
    // rồi «Hoàn thành» là tự duyệt xong trong hai lần bấm, tiến độ tự lên 100% và cộng dồn lên cả
    // cây ⇒ với kết quả của CHÍNH HỌ, đường kết thúc duy nhất là Phó GĐ phụ trách dùng verdict
    // `duyet` (đúng Q5: TP/PP tự làm thì lên thẳng BLĐ kiểm soát).
    //
    // Bản cũ chặn THÊM người đã LƯU bản cuối, và đó là một thế kẹt: TP/PP sửa trực tuyến hộ cán bộ
    // (mỗi lần lưu ở ONLYOFFICE là một bản mới đứng tên mình) thì mất luôn quyền chốt. Với nhiệm vụ
    // tích TẮT «Gửi BLĐ phê duyệt» là hết đường — trình lên thì trái cái tích, mà không trình thì
    // file treo vĩnh viễn (người dùng gặp thật trên CV002-002 ngày 11/09/2026). Nay chỉ chặn theo
    // NGƯỜI THỰC HIỆN của nhiệm vụ: van này canh NỘI DUNG là của ai, còn sửa hộ hoặc nộp hộ một
    // bản của người khác không biến TP/PP thành tác giả.
    if (hanhDong === 'hoan-thanh' && sameId(item.assignee_id, user.id)) {
      throw forbidden(
        'Bạn là người thực hiện nhiệm vụ này nên không được tự chốt kết quả của chính mình — hãy dùng «TP/PP phê duyệt» để trình Ban lãnh đạo kiểm soát.'
      );
    }
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
    // ĐIỂM 7 — MỐC «TP/PP PHÊ DUYỆT»: ai ký và ký lúc nào, đọc lại được ngay trên dòng nhóm mà
    // không phải dò ngược bảng luồng. Ghi SAU lần đổi trạng thái vì `doiTrangThai` tự xoá mốc khi
    // nhóm quay về `can-sua`/`cho-xem`/`luu-tam` — đặt trước là mất mốc vừa ký.
    const moc = luat.laMocTpPp ? await repo.datMocTpPheDuyet(nhom.id, user.id, client) : null;
    await thongBaoVerdict(user, item, nhom, { hanhDong, lyDo, banCuoi }, client);

    return { nhom: { ...nhom, ...capNhat, ...moc }, hanhDong };
  });
}

/** Thông báo của verdict — nội dung riêng từng hành động, cùng giao dịch với lần đổi trạng thái. */
/**
 * Báo cho người phải sửa. `bao()` LOẠI chính người hành động, nên khi Trưởng/Phó phòng vừa là
 * người thực hiện của nhiệm vụ vừa tự xử lý nhóm của mình thì danh sách hoá rỗng — đầu việc nằm
 * im mà không ai được báo. Lúc đó lùi về Phó GĐ phụ trách phòng (quyết định 2026-09-09).
 */
async function baoNguoiPhaiSua(user, item, nhom, cau, client) {
  if (!sameId(item.assignee_id, user.id)) {
    return bao(user, [item.assignee_id], cau, notificationsRepo.LOAI.TU_CHOI, nhom.id, client);
  }
  return baoNguoiNhan(
    user,
    await banLanhDaoNhanFile(item, client),
    cau,
    notificationsRepo.LOAI.TU_CHOI,
    nhom.id,
    client
  );
}

async function thongBaoVerdict(user, item, nhom, { hanhDong, lyDo, banCuoi }, client) {
  const { rows: tpPp } = await nguoiNhanLanhDao(item, client);
  const nguoiPhaiSua = [banCuoi?.uploaded_by, item.assignee_id];
  switch (hanhDong) {
    case 'tp-phe-duyet':
      await baoNguoiNhan(
        user,
        await banLanhDaoNhanFile(item, client),
        `Nhiệm vụ "${item.name}": "${nhom.ten_goc}" đã được TP/PP phê duyệt và trình Ban lãnh đạo kiểm soát xem. Ghi chú: ${lyDo}`,
        notificationsRepo.LOAI.CHO_DUYET,
        nhom.id,
        client
      );
      break;
    case 'tra-ve-cbo':
      // ĐIỂM 9: nút này nay là MỘT nút duy nhất cho «trả việc về cán bộ» (đã gộp `yeu-cau-sua`),
      // và nội dung là BẮT BUỘC nên câu báo luôn có phần ghi chú.
      await baoNguoiPhaiSua(
        user,
        item,
        nhom,
        `Nhiệm vụ "${item.name}": "${nhom.ten_goc}" được trả về để sửa lại. Ghi chú: ${lyDo}`,
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
      // Q6/Q11: nút chốt nay CÓ ô ghi chú (tuỳ chọn), nên chỉ nối phần đó vào câu báo khi người duyệt
      // thật sự có viết gì — để trống thì câu báo giữ nguyên y như trước.
      const ghiChu = lyDo ? ` Ghi chú: ${lyDo}` : '';
      const cau =
        (hanhDong === 'duyet'
          ? `"${nhom.ten_goc}" đã được duyệt — kết quả chốt.`
          : `"${nhom.ten_goc}" được hoàn thành.`) + ghiChu;
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
    await updateFileWeights(item.id, client);
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
 *
 * Q6/Q11 — «Hoàn thành / Duyệt» và «TP/PP phê duyệt» là hai đầu ra LOẠI TRỪ NHAU: phải trình Ban
 * lãnh đạo kiểm soát thì không có nút chốt tại phòng, và ngược lại. Cả hai vế đọc chung
 * `phaiTrinhLanhDao`, nên hàng nút ở đây không bao giờ lệch với rào chặn trong `verdict`.
 */
function hanhDongDuocLam(user, nhom, item, soBan = 0) {
  if (!dungNguoiDuyetFile(user, item)) return [];
  if (['Trưởng phòng', 'Phó phòng'].includes(user.role) && !laLanhDaoPhuTrachNhiemVu(user, item))
    return [];
  const trinh = phaiTrinhLanhDao(user, item);
  // MỚI-6: nhóm `luu-tam` chưa có BẢN nào (Q1 — khai tên/định dạng/tỷ lệ trước) thì không hiện nút
  // chốt; cùng luật với rào `!banCuoi` trong `verdict`, để hàng nút không bao giờ lệch rào chặn.
  const coBan = nhom.trang_thai !== 'luu-tam' || Number(soBan) > 0;
  return Object.entries(BANG_VERDICT)
    .filter(
      ([ma, luat]) =>
        luat.vai.includes(user.role) &&
        luat.tu.includes(nhom.trang_thai) &&
        can(user, luat.canKiem, 'file', item).ok &&
        (!luat.canDuyet || giaTriHieuLuc(user, 'file', 'approve') === 'cho-phep') &&
        (!luat.chiKhiTrinh || trinh) &&
        !(ma === 'hoan-thanh' && (trinh || !coBan))
    )
    .map(([ma, luat]) => ({ ma, nhan: NHAN_VERDICT[ma], canNoiDung: luat.canNoiDung }));
}

async function thongTinNguoiNhanSua(item, nhom, client = null) {
  const soTraLai = Number(nhom.so_tra_lai ?? nhom.soTraLai ?? 0);
  if (nhom.trang_thai !== 'can-sua') return { ds: [], chiTiet: [], soTraLai };
  let rows = [];
  if (nhom.lenh_sua_cho === 'lanh-dao') {
    rows = await repo.nguoiTheoIds(item.leader_ids ?? [], client);
  } else {
    const nguoi = await repo.nguoiTheoId(item.assignee_id, client);
    if (nguoi) rows = [nguoi];
  }
  return {
    ds: rows.map((r) => nhanKemVai(r.full_name, r.role)),
    chiTiet: rows.map((r) => ({ id: r.id, ten: r.full_name, vai: r.role })),
    soTraLai,
  };
}

export async function choDuyetKetQua(user) {
  if (!user) return { items: [] };
  const rows = await repo.listChoDuyetKetQua({
    vai: user.role,
    nguoiId: user.id,
    phongIds: user.managedDepartmentIds ?? [],
  });
  const items = await Promise.all(
    rows
      .filter((r) => can(user, 'read', 'task', { ...r, id: r.item_id, level: 3 }).ok)
      .map(async (r) => {
        const item = { ...r, id: r.item_id, level: 3 };
        const hanhDong = hanhDongDuocLam(user, r, item, r.so_ban);
        // Q2 (ĐỢT B): hàng chờ vẫn liệt kê nhóm của một cây vừa bị HẠ về `Chờ duyệt` (Q9) — người
        // duyệt cần thấy nó đang ở đâu — nhưng không cửa nào sinh BẢN MỚI khi cây chưa duyệt lại.
        const cay = r.cay_da_duyet === true;
        const duocNop = cay && duocSuaTrucTiep(user, r, item);
        const duocGuiDuyet =
          cay &&
          duocGuiBanLuu(
            user,
            r,
            item,
            r.ban_cuoi_id ? { id: r.ban_cuoi_id, uploaded_by: r.ban_cuoi_uploaded_by } : null
          );
        const nhan = await thongTinNguoiNhanSua(item, r);
        return {
          ...r,
          hanhDong,
          duocNop,
          duocGuiDuyet,
          nguoiNhan: nhan.ds,
          nguoiNhanChiTiet: nhan.chiTiet,
          soTraLai: nhan.soTraLai,
          laBaoCao: r.ban_cuoi_la_bao_cao === true,
        };
      })
  );
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
    .map(async (row) => {
      const item = { ...row, id: row.item_id, level: 3 };
      const duocSua = duocSuaTrucTiep(user, row, item);
      const nhan = await thongTinNguoiNhanSua(item, row);
      return {
        ...row,
        nguoiNhan: nhan.ds,
        nguoiNhanChiTiet: nhan.chiTiet,
        soTraLai: nhan.soTraLai,
        duocSua,
        duocGui:
          duocSua &&
          row.ban_cuoi_id != null &&
          can(user, 'submit', 'file', { ...row, id: row.item_id, level: 3 }).ok,
      };
    });
  return { items: await Promise.all(items), onlyOffice: onlyOfficeBat() };
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
          : (await banLanhDaoNhanFile(item, client)).map((row) => row.id ?? row.user_id);
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
    const ghiChu = String(noiDung ?? '').trim();
    return guiBanDaLuu(
      user,
      item,
      nhom,
      ban,
      client,
      'Gửi bản mới nhất' + (ghiChu ? ' — ' + ghiChu : ''),
      'nop'
    );
  });
}

/**
 * Đọc TOÀN BỘ kết quả file của một nhiệm vụ: nhóm + bản + góp ý + bảng luồng.
 *
 * Kèm các CỜ theo người đang xem — client không tự suy luật lần nữa (2026-09-02, luật siết
 * `leader_ids`): `duocSua` (mở nút ✎ sửa trực tuyến + nút nộp bản mới), `duocVerdict` (mở hàng nút
 * TP/PP phê duyệt / Đẩy về Cán bộ / Duyệt…) và `cayDaDuyet` (Q2 — cây chưa duyệt thì hai cờ trên
 * đều TẮT, giao diện chỉ còn nút ＋ khai báo). Máy chủ vẫn kiểm lại khi bấm.
 */
export async function doc(user, ref) {
  const item = await mustFindNhiemVu(ref);
  assertCan(user, 'read', item, 'task');
  const [nhoms, cay] = await Promise.all([
    repo.listNhomByItem(item.id),
    itemsRepo.cayDaDuyet(item.id),
  ]);
  const progress = new Map(
    (await repo.tienDoFileRows(item.id)).map((r) => [String(r.id), r.tienDo])
  );
  return Promise.all(
    nhoms.map(async (nhom) => {
      const bans = await repo.listBanByFile(nhom.id);
      const luong = await repo.listLuongByFile(nhom.id);
      const nhomCoLuot = {
        ...nhom,
        so_tra_lai: luong.filter((g) => ['tra-ve-tp', 'tra-ve-cbo'].includes(g.hanh_dong)).length,
      };
      const hanhDong = hanhDongDuocLam(user, nhom, item, bans.length);
      const nhan = await thongTinNguoiNhanSua(item, nhomCoLuot);
      return {
        ...nhom,
        tienDo: progress.get(String(nhom.id)) ?? 0,
        duocSuaTyLe: can(user, 'create', 'file', item).ok && duocGhiTheoPhanCong(user, item),
        bans,
        // Q2 (ĐỢT B): cây chưa `Đã duyệt` thì không cửa nào sinh ra BẢN MỚI — kể cả ✎ sửa trực tuyến
        // (mỗi lần lưu ở editor là một bản) và kể cả «Gửi đi duyệt» của một bản nháp còn sót từ
        // trước. `duocSuaTyLe` KHÔNG bị khoá: khai/sửa tỷ lệ là phần KHAI BÁO của Q1, và Q3 cho
        // phép đổi tỷ lệ thoải mái khi cây còn nháp.
        cayDaDuyet: cay,
        duocGuiDuyet: cay && duocGuiBanLuu(user, nhom, item, bans.at(-1)),
        gopY: await repo.listGopYByFile(nhom.id),
        luong,
        nguoiNhan: nhan.ds,
        nguoiNhanChiTiet: nhan.chiTiet,
        soTraLai: nhan.soTraLai,
        // 12/09/2026 — nhóm chưa có BẢN nào (khai báo trước, Q1) thì nút «Tải lên» chỉ hiện cho
        // chính người thực hiện: bản đầu là của người làm ra kết quả, không phải của người duyệt.
        // Nhóm đã có bản thì giữ luật cũ — TP/PP, PGĐ/GĐ sửa trực tiếp/nộp bản mới như trước.
        duocSua:
          cay &&
          duocSuaTrucTiep(user, nhom, item) &&
          (bans.length > 0 || sameId(item.assignee_id, user.id)),
        hanhDong,
        duocVerdict: hanhDong.length > 0,
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
 * `duocNop` = `can(create,'file')` cho phép VÀ (không phải TP/PP HOẶC đúng lãnh đạo phụ trách)
 * VÀ là **chính người thực hiện trực tiếp** — đường này mở NHÓM MỚI bằng một bản thật nên luôn sinh
 * bản số 1 (12/09/2026, người dùng báo: TP đang up được bản đầu thay cán bộ).
 * `phuTrach` = TP/PP có tên ở ô «Lãnh đạo phòng phụ trách» của nhiệm vụ (vai khác luôn true, vì
 * luật siết chỉ áp cho hai vai đó).
 */
export async function quyenFile(user, ref) {
  const item = await mustFindNhiemVu(ref);
  const laLanhDaoPhong = ['Trưởng phòng', 'Phó phòng'].includes(user.role);
  const phuTrach = laLanhDaoPhong ? laLanhDaoPhuTrachNhiemVu(user, item) : true;
  // TÊN người thực hiện đọc từ `users` theo `assignee_id`, không đọc cột gộp `assignee_name`: cột đó
  // chỉ được điền khi form gửi kèm tên, còn `assigneeId` đi một mình (REST ánh xạ thẳng vào
  // `assignee_id`, `workItems/routes.js:84`) nên nó rỗng — và nó thành MỒ CÔI khi người dùng bị xoá
  // (FK `ON DELETE SET NULL` hạ `assignee_id` mà không đụng `assignee_name`). Giữ nó làm dự phòng
  // cho dòng cũ đã thôi người dùng, y như `listNhomByItem` LEFT JOIN `users`.
  const [cay, nguoiThucHien] = await Promise.all([
    itemsRepo.cayDaDuyet(item.id),
    item.assignee_id == null ? null : repo.nguoiTheoId(item.assignee_id),
  ]);
  return {
    phuTrach,
    // Q2 (ĐỢT B): `duocNop` là nút TẢI FILE LÊN (mở nhóm mới bằng một bản thật) — cây chưa `Đã duyệt`
    // thì tắt. Nút ＋ KHAI BÁO kết quả đọc `phuTrach` + `can(create,'file')` chứ không đọc cờ này.
    cayDaDuyet: cay,
    duocNop:
      cay &&
      can(user, 'create', 'file', item).ok &&
      duocGhiTheoPhanCong(user, item) &&
      sameId(item.assignee_id, user.id),
    // Cho giao diện nói rõ ai được nộp bản đầu, thay vì để người dùng bấm rồi mới ăn lỗi.
    tenNguoiThucHien: nguoiThucHien?.full_name || item.assignee_name || null,
    thieuNguoiThucHien: item.assignee_id == null,
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
  const duocSua = duoiBan(ban.ten_luu) !== 'pdf' && duocSuaTrucTiep(user, nhom, item);
  const callbackBase = env.ONLYOFFICE_CALLBACK_BASE || env.APP_BASE_URL;
  const duoi = duoiBan(ban.ten_luu);
  // Ảnh (jpg/png/gif/webp) KHÔNG có bộ soạn thảo nào trong DS. Trước đây `?? 'word'` biến mọi đuôi
  // lạ thành Word ⇒ mở ảnh là được một trang editor lỗi không ai hiểu; nay trả câu rõ ngay.
  const documentType = DOCUMENT_TYPE_THEO_DUOI[duoi];
  if (!documentType) {
    throw badRequest(`Không sửa trực tuyến được file .${duoi} — hãy tải về để xem`);
  }
  // Đang mở MỘT bản cụ thể ⇒ nhóm chắc chắn có bản: `soBan = 1` để hàng nút không bị luật «nhóm
  // `luu-tam` chưa có bản nào» của MỚI-6 cắt mất (luật đó chỉ dành cho nhóm khai trước, Q1).
  const hanhDong = hanhDongDuocLam(user, nhom, item, 1);
  // Lưu ở editor là sinh BẢN MỚI đứng tên chính người lưu — nhưng van chống tự duyệt nay chỉ canh
  // NGƯỜI THỰC HIỆN (Q5), nên hàng nút tính ở trên vẫn đúng nguyên sau lần lưu, khỏi tính lại.
  const duyetMoi = duocSua
    ? (hanhDong.find((h) => ['duyet', 'tp-phe-duyet'].includes(h.ma)) ?? null)
    : null;
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
    duocGui: duocSua && laChuLenhSua(user, nhom, item) && can(user, 'submit', 'file', item).ok,
    duocVerdict: hanhDong.length > 0,
    duyetMoi,
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
  kiemDinhDangNhom(nhom?.dinh_dang, ban.ten_goc);
  if (duoiBan(ban.ten_luu) === 'pdf') throw badRequest('PDF chỉ xem, không sửa trực tuyến');
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
  if (!dungNguoiDuyetFile(user, item)) return false;
  if (!can(user, 'create', 'file', item).ok) return false;
  if (nhom.trang_thai === 'can-sua' && nhom.lenh_sua_cho && !laChuLenhSua(user, nhom, item))
    return false;
  // 2026-09-02 — SIẾT: TP/PP chỉ sửa trực tuyến được file của nhiệm vụ mình phụ trách (`leader_ids`);
  // người khác trong phòng mở editor ra chỉ ở chế độ XEM (`mode: 'view'`).
  if (['Trưởng phòng', 'Phó phòng'].includes(user.role)) {
    return duocGhiTheoPhanCong(user, item);
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
  return duoiBan(tenLuu) !== 'pdf' && Object.hasOwn(DOCUMENT_TYPE_THEO_DUOI, duoiBan(tenLuu));
}

/** Đuôi (chữ thường, không dấu chấm) của một bản đã lưu. Không dò được thì coi là docx. */
function duoiBan(tenLuu) {
  return (String(tenLuu ?? '').match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
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
export function htmlEditor({
  dsUrl,
  token,
  config,
  ban,
  item,
  nhom,
  duocSua,
  duocGui,
  duocVerdict = false,
  duyetMoi = null,
}) {
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
body{display:flex;flex-direction:column;overflow:hidden}
#thanh{flex:0 0 auto;min-height:44px;display:flex;flex-wrap:wrap;align-items:center;gap:12px;
  padding:6px 12px;background:#1f2937;color:#fff;font-size:13px;box-sizing:border-box}
#thanh .ten{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#thanh .file{color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
#thanh button{font:inherit;padding:5px 12px;border:0;border-radius:6px;cursor:pointer}
#luu{background:#2563eb;color:#fff}
#gui{background:#b45309;color:#fff}
#duyet-moi{background:#047857;color:#fff}
#y-kien{flex:0 0 auto;min-height:50px;background:#1f2937;color:#fff;padding:6px 12px;box-sizing:border-box;display:flex;align-items:center;gap:12px}
#noi-dung{flex:1;resize:none;height:30px;font:inherit}
#luu:disabled{background:#64748b;cursor:default}
#dong{background:#374151;color:#e5e7eb}
#tinh{color:#a7f3d0}
#ghi-chu-duyet{flex:0 0 auto;padding:6px 12px;background:#fef3c7;color:#78350f;font-size:13px}
#khung-editor{position:relative;flex:1 1 0;min-height:0}
#placeholder{height:100%;width:100%}
#loi{position:absolute;top:0;left:0;right:0;bottom:0;display:none;padding:24px;background:#fff;overflow:auto}
#chan-sua{position:absolute;top:0;left:0;right:0;bottom:0;z-index:10;background:#ffffff80;display:none}
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
  ${duyetMoi ? '<button type="button" id="duyet-moi">Phê duyệt bản mới vừa chỉnh sửa</button>' : ''}
  <button type="button" id="dong">Đóng</button>
</div>
<div id="y-kien"><label for="noi-dung">Ghi ý kiến</label><textarea id="noi-dung" maxlength="2000" ${duocGui || duocVerdict || duyetMoi ? '' : 'disabled'}>${escapeHtmlServer(nhom?.lenh_sua_ghi_chu ?? '')}</textarea></div>
${duyetMoi?.ma === 'tp-phe-duyet' ? '<div id="ghi-chu-duyet">Bản này bạn không tự Hoàn thành được — phải trình Ban lãnh đạo kiểm soát. Nút «TP/PP phê duyệt» sẽ lưu bản mới rồi trình lên; cần ý kiến ít nhất 10 ký tự.</div>' : ''}
<div id="khung-editor">
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
  var banDaLuu = null;
  var duyetMoi = ${JSON.stringify(duyetMoi).replace(/</g, '\\u003c')};
  var nguoiId = ${JSON.stringify(String(config.editorConfig.user.id))};
  var daSua = false, dangDongBo = false, dangXuLy = false, lanSua = 0, daGui = false;
  var tinh = document.getElementById("tinh");
  var nutLuu = document.getElementById("luu");
  var nutGui = document.getElementById("gui");
  var nutDuyet = document.getElementById("duyet-moi");
  var nutDong = document.getElementById("dong");
  var yKien = document.getElementById("noi-dung");
  var duocYKien = !yKien.disabled;
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
    yKien.disabled = bat || !duocYKien;
    if (nutGui) nutGui.disabled = bat;
    if (nutDuyet) nutDuyet.disabled = bat;
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
      banDaLuu = Number(ketQua.banId) || null;
      if (lan === lanSua) daSua = false;
      daLuu();
    } else if (daSua) {
      throw new Error("Chưa xác nhận thay đổi đã lưu — chưa gửi đi. Hãy nhấn Ctrl+S và chờ");
    } else bao(ketQua.lyDo || "Chưa có thay đổi nào để lưu", "#fde68a");
  }
  async function pheDuyetMoi() {
    if (dangXuLy || daGui || !duyetMoi) return;
    if (duyetMoi.canNoiDung && yKien.value.trim().length < 10) {
      bao("Vui lòng nhập ý kiến ít nhất 10 ký tự trước khi trình", "#fca5a5"); return;
    }
    if (!window.confirm("Lưu bản mới rồi " + duyetMoi.nhan.toLowerCase() + "?")) return;
    khoa(true); bao("Đang lưu bản mới trước khi duyệt…", "#fde68a");
    try {
      await luu();
      if (daSua || dangDongBo || !banDaLuu) throw new Error("Chưa xác nhận bản mới đã lưu — chưa phê duyệt");
      await yeuCau("/api/v1/task-files/" + ID_NHOM + "/verdict", "POST", {
        hanhDong: duyetMoi.ma, noiDung: yKien.value, versionId: banDaLuu,
      });
      daGui = true;
      bao(duyetMoi.ma === "tp-phe-duyet" ? "Đã phê duyệt và trình bản mới lên Ban lãnh đạo kiểm soát" : "Đã phê duyệt bản mới vừa lưu");
      try { localStorage.setItem("qlcv_file_da_luu", String(Date.now())); } catch (error) {}
      window.close();
    } catch (error) { bao(error.message || "Chưa phê duyệt được bản mới", "#fca5a5"); }
    finally { if (!daGui) khoa(false); }
  }
  if (nutDuyet) nutDuyet.addEventListener("click", pheDuyetMoi);
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
          soBan = Number(banMoi.version_no); banDaLuu = Number(banMoi.id); daSua = false; daLuu();
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
  kiemDinhDangNhom(nhom.dinh_dang, ban.ten_goc);
  if (duoiBan(ban.ten_luu) === 'pdf') throw badRequest('PDF chỉ xem, không sửa trực tuyến');
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

  const luot = luotLuuDangCho.get(maLuu);
  const luotHopLe = luot?.banId === Number(versionId) ? luot : null;
  const idNguoiSua = luotHopLe?.nguoiId ?? nguoiSuaId;
  const ketQua = await withTransaction(async (client) => {
    // Cùng thứ tự item → nhóm với submit/weights để tránh deadlock và đọc phân công mới nhất.
    await itemsRepo.lockById(nhom.item_id, client);
    const item = await itemsRepo.findById(nhom.item_id, client);
    const nhomHienTai = await repo.lockNhomById(nhom.id, client);
    if (!item || !nhomHienTai || KET_THUC.includes(nhomHienTai.trang_thai)) {
      return { boQua: true, lyDo: 'Kết quả đã chốt, không nhận bản mới' };
    }
    kiemDinhDangNhom(nhomHienTai.dinh_dang, ban.ten_goc);
    const nguoiGhi = await repo.nguoiTheoId(idNguoiSua, client);
    if (!nguoiGhi)
      throw forbidden('Không xác định được người sửa còn hoạt động — không nhận bản mới');
    nguoiGhi.ghiDe = Object.fromEntries(
      (await permissionsRepo.listByVai(nguoiGhi.role, client)).map((g) => [
        g.entity_type + ':' + g.action,
        g,
      ])
    );
    nguoiGhi.delegations = await hieuLucCho(nguoiGhi.id, client);
    if (!can(nguoiGhi, 'read', 'task', item).ok || !duocSuaTrucTiep(nguoiGhi, nhomHienTai, item)) {
      throw forbidden(
        'Quyền sửa hoặc phân công đã thay đổi — không nhận bản mới từ phiên editor cũ'
      );
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
    if (item && nhomHienTai.trang_thai !== 'luu-tam') {
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

/**
 * Tỷ lệ thuộc nhóm; chỉ người được nộp kết quả trong phạm vi này mới sửa được.
 *
 * Q10 + R4 + R4'' (ĐỢT B): sửa tỷ lệ CÓ phải gửi duyệt. Cây `Đã duyệt` rồi thì lời gọi này KHÔNG
 * ghi nữa — nó lập một dòng đề nghị trong `approval_changes` gửi đúng 1 Ban lãnh đạo kiểm soát của
 * nhiệm vụ (R4'), và `ty_le` CŨ giữ nguyên cho tới khi đề nghị được duyệt. Cây chưa duyệt (còn
 * `Nháp`/`Chờ duyệt`) thì ghi thẳng: đó là lúc người lập đang KHAI BÁO tỷ lệ để nó đi lên cùng
 * phiếu duyệt cây (Q1), và Q3 cho phép «nháp thì sửa thoải mái MỌI thứ» — kể cả tỷ lệ.
 *
 * Phản hồi giữ nguyên hình dạng cũ (`{ nhom, tongTyLe }`) và THÊM `tyLeChange` khi thành đề nghị, để
 * giao diện nói được «đã trình, chưa đổi» thay vì im lặng tỏ ra đã lưu.
 */
export function suaTyLe(user, fileId, { tyLe }) {
  if (
    typeof tyLe !== 'number' ||
    !Number.isFinite(tyLe) ||
    !Number.isInteger(tyLe) ||
    tyLe < 0 ||
    tyLe > 100
  )
    throw badRequest('Tỷ lệ công việc của file phải là số nguyên từ 0 đến 100', 'tyLe');
  return withTransaction(async (client) => {
    const nhom = await repo.lockNhomById(fileId, client);
    if (!nhom) throw notFound('Không tìm thấy nhóm file');
    const item = await mustFindNhiemVu(nhom.item_id, client);
    assertCan(user, 'create', item);
    chanTpPpKhongPhuTrach(user, item);
    if (await itemsRepo.cayDaDuyet(item.id, client)) {
      const deNghi = await proposeTyLe(user, { loai: 'file', row: nhom, item }, tyLe, client);
      return {
        nhom: { ...nhom, ty_le: deNghi.value },
        tongTyLe: await repo.tongTyLeFile(item.id, client),
        tyLeChange: deNghi,
      };
    }
    const rows = await updateFileWeights(item.id, client, { editedId: nhom.id, value: tyLe });
    return {
      nhom: { ...nhom, ty_le: tyLe, ty_le_tu_dong: false },
      tongTyLe: rows.reduce((s, r) => s + r.ty_le, 0),
      tyLeChange: { pending: false, value: tyLe },
    };
  });
}
