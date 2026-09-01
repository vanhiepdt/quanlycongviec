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
import { withTransaction } from '../../db/pool.js';
import { can, giaTriHieuLuc } from '../../middleware/rbac.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import * as deptRepo from '../departments/repo.js';
import * as itemsRepo from '../workItems/repo.js';
import * as notificationsRepo from '../notifications/repo.js';
import * as repo from './repo.js';

/** Giới hạn dung lượng mỗi bản (§13.4 mục 22 — chờ người dùng đổi nếu khác). */
export const DUNG_LUONG_TOI_DA = 20 * 1024 * 1024; // 20 MB

/** Loại file nhận: đuôi → mimeType. Đuôi và mimeType phải LÀ CẶP (xem whitelist trong `nop`). */
export const DUOI_FILE_HOP_LE = Object.freeze({
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf': 'application/pdf',
});

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

const sameId = (a, b) => a != null && b != null && Number(a) === Number(b);

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
  // sinh sẵn bên dưới — cấm path traversal).
  const tenSan = String(tenGoc ?? '');
  const duoi = (tenSan.match(/\.(doc|docx|pdf)$/i) ?? [])[0]?.toLowerCase();
  const mimeChoDuoi = duoi ? DUOI_FILE_HOP_LE[duoi] : null;
  const mimeGui = String(loaiMime ?? '');
  if (!duoi || (mimeGui !== mimeChoDuoi && mimeGui !== 'application/octet-stream')) {
    throw badRequest('Chỉ nhận file Word (.doc/.docx) hoặc PDF, dung lượng tối đa 20 MB', 'file');
  }
  const kichThuoc = Number(buffer?.length ?? 0);
  if (!kichThuoc) throw badRequest('File rỗng hoặc không đọc được', 'file');
  if (kichThuoc > DUNG_LUONG_TOI_DA) {
    throw badRequest('File vượt quá dung lượng tối đa 20 MB', 'file');
  }

  return withTransaction(async (client) => {
    assertCan(user, 'create', item);

    let nhom = null;
    if (fileId != null) {
      nhom = await repo.lockNhomById(Number(fileId), client);
      if (!nhom || Number(nhom.item_id) !== Number(item.id)) {
        throw notFound('Không tìm thấy nhóm file kết quả của nhiệm vụ này');
      }
      if (KET_THUC.includes(nhom.trang_thai)) {
        throw conflict(`File này đã ${NHAN_TRANG_THAI[nhom.trang_thai]} — không nộp thêm được`);
      }
      if (nhom.trang_thai === 'cho-lanh-dao') {
        if (!['Trưởng phòng', 'Phó phòng', 'Phó Giám đốc', 'admin'].includes(user.role)) {
          throw forbidden(
            'File đang chờ lãnh đạo xem — lúc này chỉ Trưởng phòng/Phó phòng mới nộp được bản mới'
          );
        }
      }
    }
    // cho-xem / can-sua: `can(create,'file')` phía trên đã lọc đúng người được giao nhiệm vụ,
    // Trưởng phòng/Phó phòng và Phó GĐ/GĐ — không thêm điều kiện vai nào nữa.

    const versionNo = (nhom ? await repo.soBanCaoNhat(nhom.id, client) : 0) + 1;
    const tenLuu = `v${versionNo}-${randomUUID()}${duoi}`;

    const thuMuc = path.join(GOC_STORAGE, String(item.id));
    await mkdir(thuMuc, { recursive: true });
    await writeFile(path.join(thuMuc, tenLuu), buffer);

    if (!nhom) {
      nhom = await repo.themNhom(
        { itemId: item.id, tenGoc: tenSan, trangThai: 'cho-xem', createdBy: user.id },
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
    const giaTri = giaTriHieuLuc(user, 'file', 'create');
    const laLanhDaoPhong = ['Trưởng phòng', 'Phó phòng'].includes(user.role);
    let trangThaiMoi;
    if (giaTri === 'cho-phep') {
      trangThaiMoi = 'da-duyet';
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
    } else if (laLanhDaoPhong) {
      trangThaiMoi = 'cho-lanh-dao';
    } else {
      trangThaiMoi = 'cho-xem';
    }
    const capNhat = await repo.doiTrangThai(nhom.id, trangThaiMoi, client);

    // ─── Thông báo (cùng giao dịch) ─────────────────────────────────────────────────────────
    const tpPp = await repo.truongPhongPhoPhong(item.department_id, client);
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
        `Nhiệm vụ "${item.name}": ${user.full_name} nộp bản ${versionNo} của "${tenSan}" — ${NHAN_TRANG_THAI[trangThaiMoi]}.`,
        notificationsRepo.LOAI.CHO_DUYET,
        nhom.id,
        client
      );
    }

    return {
      nhom: { ...nhom, trang_thai: capNhat.trang_thai },
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
    tu: ['cho-xem', 'cho-lanh-dao'],
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
    den: 'cho-xem',
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
    await repo.doiTrangThai(nhom.id, luat.den, client);
    await thongBaoVerdict(user, item, nhom, { hanhDong, lyDo, banCuoi }, client);

    return { nhom: { ...nhom, trang_thai: luat.den }, hanhDong };
  });
}

/** Thông báo của verdict — nội dung riêng từng hành động, cùng giao dịch với lần đổi trạng thái. */
async function thongBaoVerdict(user, item, nhom, { hanhDong, lyDo, banCuoi }, client) {
  const tpPp = await repo.truongPhongPhoPhong(item.department_id, client);
  const nguoiPhaiSua = [banCuoi?.uploaded_by, item.assignee_id];
  switch (hanhDong) {
    case 'yeu-cau-sua':
      await bao(
        user,
        nguoiPhaiSua,
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
        nguoiPhaiSua,
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
    return bans.map((b) => ({ itemId: item.id, tenLuu: b.ten_luu }));
  });
  // Sau khi commit: dọn file vật lý — hỏng thì bỏ qua, dòng rác không làm đổ thao tác đã xong.
  await Promise.allSettled(
    cacTenLuu.map(({ itemId, tenLuu }) => unlink(path.join(GOC_STORAGE, String(itemId), tenLuu)))
  );
  return { daXoa: true };
}

/** Đọc TOÀN BỘ kết quả file của một nhiệm vụ: nhóm + bản + góp ý + bảng luồng. */
export async function doc(user, ref) {
  const item = await mustFindNhiemVu(ref);
  assertCan(user, 'read', item, 'task');
  const nhoms = await repo.listNhomByItem(item.id);
  return Promise.all(
    nhoms.map(async (nhom) => ({
      ...nhom,
      bans: await repo.listBanByFile(nhom.id),
      gopY: await repo.listGopYByFile(nhom.id),
      luong: await repo.listLuongByFile(nhom.id),
    }))
  );
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
  return { ban, item };
}

/** Bản CHỈ DÀNH cho máy-đối-máy (ONLYOFFICE) — không có người dùng; đã được token HMAC bảo vệ. */
export async function docBanSystem(banId) {
  const ban = await repo.findBanById(Number(banId));
  if (!ban) throw notFound('Không tìm thấy bản file');
  const nhom = await repo.findNhomById(ban.file_id);
  if (!nhom) throw notFound('Không tìm thấy nhóm file chứa bản này');
  const item = await itemsRepo.findById(nhom.item_id);
  if (!item) throw notFound('Không tìm thấy nhiệm vụ chứa file này');
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

/** Config editor cho MỘT bản: `document.url` để DS tải, `callbackUrl` để DS trả bản đã sửa. */
export async function moEditor(user, versionId) {
  if (!onlyOfficeBat()) {
    throw badRequest(
      'Chưa cấu hình ONLYOFFICE_URL và ONLYOFFICE_JWT_SECRET trong deploy/.env — sửa trực tuyến đang tắt'
    );
  }
  const { ban } = await docBan(user, versionId);
  const callbackBase = env.ONLYOFFICE_CALLBACK_BASE || env.APP_BASE_URL;
  const config = {
    document: {
      fileType: (ban.ten_luu.match(/\.(doc|docx|pdf)$/i)?.[1] ?? 'docx').replace('.', ''),
      key: `tf-${ban.id}-${ban.kich_thuoc}`,
      title: ban.ten_goc,
      url: `${callbackBase}/api/v1/task-files-ds/raw/${ban.id}?token=${tokenDs('raw', ban.id)}`,
      permissions: { edit: true, comment: true, download: true },
    },
    documentType: 'word',
    editorConfig: {
      callbackUrl: `${callbackBase}/api/v1/task-files-ds/callback/${ban.id}?token=${tokenDs('callback', ban.id)}`,
      lang: 'vi',
      mode: 'edit',
      user: { id: String(user.id), name: user.full_name },
      customization: { forcesave: true, compactHeader: true },
    },
  };
  return {
    dsUrl: env.ONLYOFFICE_URL.replace(/\/$/, ''),
    token: kyJwt(config, env.ONLYOFFICE_JWT_SECRET),
    config,
    ban,
  };
}
/** Trang editor nhúng DS — HTML riêng, mở trong tab mới (index.html không đụng tới). */
export function htmlEditor({ dsUrl, token, config }) {
  const cauHinh = JSON.stringify({
    document: config.document,
    documentType: config.documentType,
    token,
    editorConfig: config.editorConfig,
    type: 'desktop',
    width: '100%',
    height: '100%',
  }).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><title>Chỉnh sửa kết quả — Quản lý công việc</title>
<style>html,body{margin:0;height:100%}#placeholder{position:absolute;inset:0}</style></head>
<body><div id="placeholder"></div>
<script src="${dsUrl}/web-apps/apps/api/documents/api.js"></script>
<script>window.docEditor = new DocsAPI.DocEditor("placeholder", ${cauHinh});</script>
</body></html>`;
}

/**
 * CALLBACK của DS (`status=2/6` + `url`): tải bản đã sửa về, lưu thành BẢN MỚI trong cùng nhóm
 * — đúng yêu cầu người dùng «sửa lại phải lưu để xem». Trạng thái nhóm KHÔNG đổi: sửa trực
 * tuyến là chỉnh nội dung một bản, không phải một bước của luồng duyệt.
 */
export async function luuTuCallback(versionId, url) {
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
    throw badRequest('Bản đã sửa vượt quá dung lượng tối đa 20 MB');

  return withTransaction(async (client) => {
    await repo.lockNhomById(nhom.id, client);
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
        uploadedBy: ban.uploaded_by,
      },
      client
    );
    await repo.themLuong(
      {
        fileId: nhom.id,
        versionId: moi.id,
        nguoiId: ban.uploaded_by,
        vai: 'Nhân viên',
        hanhDong: 'nop',
        noiDung: 'Sửa trực tuyến — lưu từ ONLYOFFICE',
      },
      client
    );
    return { boQua: false, version: moi };
  });
}
