// Nghiệp vụ luồng duyệt (§7 việc 5.2, 5.3, 5.5, 5.7 · §8.4 nhóm E · TC-APR-08..16).
//
// Ba hành động, một đường ghi:
//   submit  — gửi một mục đi duyệt (hoặc gửi lại sau khi bị từ chối) ⇒ 'Chờ duyệt'
//   approve — 'Đã duyệt', ghi người duyệt và thời điểm, xoá lý do từ chối cũ
//   reject  — 'Từ chối', BẮT BUỘC lý do ≥ 10 ký tự
//
// Bốn điểm đáng nói:
//
//  1. **Quyền duyệt không viết lại ở đây.** `can(user, 'approve', ...)` của §6 đã cho đúng hai vai
//     `admin` và `Phó Giám đốc`, và `inScope()` đã bó Phó Giám đốc theo `managedDepartmentIds`
//     (tức các dòng `department_managers.role = 'deputy_director'`). Nhờ vậy TC-APR-10 (Phó GĐ
//     duyệt phòng không phụ trách ⇒ 403) và TC-APR-11 (Nhân viên gọi thẳng API ⇒ 403) không cần
//     thêm một dòng điều kiện nào. Thêm điều kiện phòng lần thứ hai ở đây là tạo nguồn sự thật thứ
//     hai cho phạm vi — đúng cái §6 cấm.
//
//  2. **Duyệt LAN XUỐNG CẢ CÂY** (012, Vòng 13 — người dùng chốt 2026-08-31). Trước đó luật là
//     «không lan» (TC-APR-16 bản đầu) với lý lẽ người duyệt cấp 1 chưa chắc đã đọc từng mục con.
//     Nay cả cây được GỬI cùng một lần từ bản nháp và người duyệt có nút «Xem chi tiết» đọc hết
//     bên trong trước khi ký, nên một quyết định cho cả cây mới đúng việc thật. Kèm theo:
//     **Từ chối = XOÁ HẲN cả cây** (cửa đóng hẳn), và nút mới **«Trả lại để sửa»** đưa cả cây về
//     bản nháp của người tạo — đó mới là cửa dùng thường ngày.
//
//  3. **Cấp 3 không đi qua đây.** Nhiệm vụ luôn 'Đã duyệt' (việc 5.1) nên gửi duyệt / duyệt một
//     nhiệm vụ là thao tác vô nghĩa ⇒ 409 có câu giải thích, không phải im lặng cho qua.
//
//  4. **Thông báo nằm trong CÙNG giao dịch** với lần đổi trạng thái. Tách ra ngoài thì một lỗi
//     mạng giữa chừng cho ra mục đã duyệt mà người tạo không bao giờ biết. Không có email —
//     §13.4 mục 4 chốt bỏ hẳn (việc 5.9).
import { withTransaction } from '../../db/pool.js';
import { can } from '../../middleware/rbac.js';
import { AppError, conflict, notFound } from '../../utils/errors.js';
import { withPgErrors } from '../../utils/pgError.js';
import * as deptRepo from '../departments/repo.js';
import * as notificationsRepo from '../notifications/repo.js';
import * as worksRepo from '../works/repo.js';
import * as itemsRepo from '../workItems/repo.js';
import * as repo from './repo.js';
import { CHO_DUYET, DA_DUYET, NHAP, TU_CHOI } from './rules.js';

/** Độ dài tối thiểu của lý do từ chối (§7 việc 5.2). "Không đạt" là 8 ký tự — cố ý chưa đủ. */
export const DO_DAI_LY_DO_TOI_THIEU = 10;

/** Tên loại trong đường dẫn `/approvals/:entity/:id/...` → bảng. Nhận cả dạng số nhiều của REST. */
const LOAI_THUC_THE = Object.freeze({
  work: 'work',
  works: 'work',
  'work-item': 'item',
  'work-items': 'item',
  item: 'item',
});

/** Cấp 2 và cấp 3 là hai loại khác nhau trong ma trận quyền §6. */
const entityOf = (level) => (Number(level) === itemsRepo.LEVEL_SUBWORK ? 'subwork' : 'task');

/**
 * Đọc mục cần xử, cùng đủ thứ để xét quyền và để viết thông báo.
 *
 * Trả về một hình dạng CHUNG cho cả hai bảng (`kind`, `row`, `entityType`, `label`) để ba hành
 * động bên dưới không phải rẽ nhánh theo bảng ở mỗi bước.
 */
async function mustFind(entity, ref, client) {
  const kind = LOAI_THUC_THE[String(entity ?? '').toLowerCase()];
  if (!kind) {
    throw new AppError('BAD_REQUEST', `Không rõ loại dữ liệu "${entity}" để duyệt`, {
      field: 'entity',
    });
  }
  if (kind === 'work') {
    const row = await worksRepo.findByRef(ref, client);
    if (!row) throw notFound(`Không tìm thấy công việc "${ref}"`);
    return { kind, row, entityType: 'work', label: 'Công việc' };
  }
  // `findByRefWithWork` để có `work_department_id` — `can()` cần phòng để xét phạm vi (§6).
  const row = await itemsRepo.findByRefWithWork(ref, client);
  if (!row) throw notFound(`Không tìm thấy công việc con/nhiệm vụ "${ref}"`);
  return {
    kind,
    row,
    entityType: entityOf(row.level),
    label: Number(row.level) === itemsRepo.LEVEL_SUBWORK ? 'Công việc con' : 'Nhiệm vụ',
  };
}

/** Ghi khoá duyệt — đường ghi DUY NHẤT vào 4 cột duyệt (xem đầu `repo.js`). */
function ghiKhoaDuyet(target, patch, client) {
  const write = target.kind === 'work' ? worksRepo.update : itemsRepo.update;
  return withPgErrors(() => write(target.row.id, patch, client));
}

/**
 * Mọi dòng NẰM DƯỚI mục này (012, Vòng 13). Cấp 1 ⇒ toàn bộ `work_items` của nó; cấp 2 ⇒ các
 * nhiệm vụ con; cấp 3 ⇒ rỗng.
 *
 * Dùng cho ba luồng lan cây: gửi duyệt cả cây, duyệt cả cây, trả lại cả cây. Đọc lại từ CSDL chứ
 * không nhận danh sách từ client — người gửi không được chọn phần nào của cây mình muốn gửi.
 */
function conChauCua(target, client) {
  if (target.kind === 'work') return itemsRepo.listByWork(target.row.id, {}, client);
  return itemsRepo.listDescendants(target.row.id, client);
}

/**
 * Đổi khoá duyệt cho mục này VÀ mọi dòng dưới nó, nhưng chỉ những dòng đang ở một trong
 * `tuTrangThai` — mục đã duyệt từ trước không bị đụng vào, mục người khác đang xử cũng vậy.
 *
 * Trả về số dòng con đã đổi để chỗ gọi nói được «đã duyệt kèm N mục bên trong».
 */
async function ghiKhoaDuyetCaCay(target, patch, tuTrangThai, client) {
  const row = await ghiKhoaDuyet(target, patch, client);
  const con = await conChauCua(target, client);
  let soCon = 0;
  for (const c of con) {
    // `listDescendants` chỉ trả cột cấu trúc (không có `approval_status`) nên phải đọc lại dòng
    // đầy đủ; `listByWork` thì có sẵn. Một lời gọi `findById` cho mỗi dòng là chấp nhận được:
    // cây sâu nhất của hệ thống là 3 tầng và số dòng một công việc thực tế dưới 50.
    const hienTai = c.approval_status ?? (await itemsRepo.findById(c.id, client))?.approval_status;
    if (!tuTrangThai.includes(hienTai)) continue;
    await withPgErrors(() => itemsRepo.update(c.id, patch, client));
    soCon += 1;
  }
  return { row, soCon };
}

/**
 * Nhiệm vụ cấp 3 có bước duyệt hay không — TÙY dòng, không tùy cấp (013, Vòng 13 đợt 2).
 *
 * Luật gốc (việc 5.1) vẫn là «cấp 3 không qua bước duyệt»: `trangThaiDuyetKhiTao` cho cấp 3
 * `Đã duyệt` ngay, cửa duyệt đặt ở tầng khối việc (cấp 1/cấp 2). Nhưng Vòng 12e mở ⏳ cho Cán bộ ở
 * ô «Tạo Nhiệm vụ», nên admin bật được ghi đè để nhiệm vụ mới rơi vào `Chờ duyệt` — mà chặn cứng
 * theo cấp thì những mục đó **kẹt vĩnh viễn, không ai duyệt được**. Đó là lỗ do đợt 1 để lại.
 *
 * Nên điều kiện đúng là theo TRẠNG THÁI của chính dòng: nhiệm vụ đang `Chờ duyệt`/`Nháp`/`Từ chối`
 * là nhiệm vụ đã được đưa vào luồng duyệt ⇒ xử được. Nhiệm vụ `Đã duyệt` (trường hợp thường) thì
 * gửi/duyệt vẫn là 409 với câu giải thích — giữ nguyên ý nghĩa cũ cho 99% dữ liệu.
 */
function assertCoBuocDuyet(target) {
  if (target.entityType !== 'task') return;
  if ([CHO_DUYET, NHAP, TU_CHOI].includes(target.row.approval_status)) return;
  throw conflict(
    'Nhiệm vụ này không qua bước duyệt — cửa duyệt đặt ở Công việc / Công việc con. ' +
      'Muốn nhiệm vụ phải chờ duyệt thì Quản trị đặt «⏳ Chờ duyệt» ở ô «Tạo Nhiệm vụ» của vai đó.',
    'entity'
  );
}

function assertCan(user, action, target) {
  const verdict = can(user, action, target.entityType, target.row);
  if (!verdict.ok) throw new AppError(verdict.code, verdict.message);
}

/** Phòng của mục: `work_items` có cột riêng, dự phòng lấy theo công việc cha. */
const phongCua = (row) => row.department_id ?? row.work_department_id ?? null;

/**
 * Các Phó Giám đốc phụ trách phòng của mục — người nhận thông báo "có mục mới chờ duyệt"
 * (việc 5.7).
 *
 * Phòng chưa gán Phó Giám đốc ⇒ danh sách rỗng ⇒ không ai được báo. Đó KHÔNG phải lỗi chặn thao
 * tác: mục vẫn vào 'Chờ duyệt' và vẫn hiện trong hộp chờ duyệt của admin (admin thấy mọi phòng),
 * chỉ là không có thông báo đẩy. Ném lỗi ở đây thì một phòng thiếu cấu hình là cả phòng không gửi
 * duyệt được việc nào.
 */
async function phoGiamDocPhuTrach(departmentId, client) {
  if (departmentId == null) return [];
  const managers = await deptRepo.listManagers(departmentId, client);
  return managers.filter((m) => m.role === 'deputy_director');
}

/** Một dòng mô tả mục, dùng trong nội dung thông báo. Chữ thuần, không HTML. */
const moTa = (target) => `${target.label} ${target.row.code} — ${target.row.name ?? ''}`.trim();

/**
 * Gửi duyệt: đưa một mục **và cả cây bên dưới nó** vào hàng chờ, báo cho Phó Giám đốc phụ trách.
 *
 * Ai gửi được: người **sửa được** mục đó (§6). Cố ý không giới hạn đúng người tạo — Trưởng phòng
 * phải gửi lại được việc của cấp dưới sau khi sửa theo lý do từ chối.
 *
 * GỬI CẢ CÂY (012, Vòng 13 — yêu cầu người dùng): người lập soạn xong công việc cấp 1 kèm công
 * việc con và nhiệm vụ trong bản nháp rồi bấm MỘT nút. Cả cây sang «Chờ duyệt» và hộp chờ duyệt
 * chỉ hiện MỘT dòng gốc (`repo.listPending` bó phần đó) — người duyệt bấm «Xem chi tiết» để đọc
 * bên trong. Trước 012 phải gửi từng cấp, nên một cây 3 tầng đọng lại 1+N+M dòng rời rạc.
 */
export function submit(user, entity, ref) {
  return withTransaction(async (client) => {
    const target = await mustFind(entity, ref, client);
    assertCoBuocDuyet(target);
    assertCan(user, 'update', target);

    if (target.row.approval_status === CHO_DUYET) {
      throw conflict(`${moTa(target)} đang chờ duyệt rồi`);
    }

    const { row, soCon } = await ghiKhoaDuyetCaCay(
      target,
      // Gửi lại thì xoá sạch dấu vết lần xử trước: giữ `reject_reason` cũ là mục đang chờ duyệt
      // mà vẫn hiện lý do từ chối của vòng trước trên giao diện.
      {
        approval_status: CHO_DUYET,
        approver_id: null,
        approved_at: null,
        reject_reason: '',
      },
      // Chỉ kéo theo dòng CHƯA gửi: mục đã duyệt từ trước (công việc con thêm sau khi cha duyệt,
      // rồi cha bị trả lại) không bị hạ xuống lại, và mục người khác đang chờ duyệt giữ nguyên.
      [NHAP, TU_CHOI],
      client
    );

    const nguoiNhan = await phoGiamDocPhuTrach(phongCua(target.row), client);
    const keMuc = soCon > 0 ? ` (kèm ${soCon} mục bên trong)` : '';
    const notifications = await notificationsRepo.insertMany(
      nguoiNhan.map((m) => ({
        userId: m.user_id,
        content: `${moTa(target)}${keMuc} đang chờ bạn duyệt (người gửi: ${user.full_name ?? user.code ?? ''}).`,
        type: notificationsRepo.LOAI.CHO_DUYET,
        refType: target.kind === 'work' ? 'work' : 'work_item',
        refId: target.row.id,
      })),
      client
    );

    return { kind: target.kind, row, soCon, notified: notifications.length };
  });
}

/**
 * DUYỆT — và LAN XUỐNG CẢ CÂY (012, Vòng 13).
 *
 * Luật cũ (TC-APR-16 bản đầu) là «duyệt cấp 1 KHÔNG lan xuống cây», lý lẽ: người duyệt cấp 1 chưa
 * chắc đã đọc từng mục con nên tự duyệt hộ là ký thay. Người dùng chốt lại ngày 2026-08-31: cả cây
 * được GỬI cùng một lần và người duyệt có nút «Xem chi tiết» đọc hết bên trong trước khi ký, nên
 * một quyết định cho cả cây mới đúng việc thật — và tránh cảnh phải ký 1+N+M lần cho một cây.
 *
 * Chỉ kéo theo dòng đang «Chờ duyệt»: mục đã duyệt từ trước giữ nguyên `approver_id`/`approved_at`
 * của lần ký cũ, không bị ghi lại tên người duyệt mới.
 */
function duyetCaCay({ user, entity, ref }) {
  return withTransaction(async (client) => {
    const target = await mustFind(entity, ref, client);
    assertCoBuocDuyet(target);
    // Cổng quyền DUY NHẤT của việc 5.3 — chỉ admin và Phó Giám đốc phụ trách phòng đi qua được.
    assertCan(user, 'approve', target);

    // TC-APR-14: duyệt hai lần thì lần hai là 409 và KHÔNG sinh thông báo trùng.
    if (target.row.approval_status === DA_DUYET) {
      throw conflict(
        `${moTa(target)} đã ở trạng thái "${DA_DUYET}" — không cần làm lại`,
        'approvalStatus'
      );
    }

    const { row, soCon } = await ghiKhoaDuyetCaCay(
      target,
      {
        approval_status: DA_DUYET,
        approver_id: user.id,
        approved_at: new Date(),
        reject_reason: '',
      },
      [CHO_DUYET],
      client
    );

    const notifications = await baoNguoiTao(
      target,
      user,
      `${moTa(target)}${soCon > 0 ? ` (kèm ${soCon} mục bên trong)` : ''} đã được duyệt.`,
      notificationsRepo.LOAI.DA_DUYET,
      client
    );

    return { kind: target.kind, row, soCon, notified: notifications.length };
  });
}

/**
 * TỪ CHỐI — XOÁ HẲN cả mục và toàn bộ cây bên dưới (012, Vòng 13).
 *
 * Người dùng chốt ngày 2026-08-31 và đã xác nhận rõ đây là xoá VĨNH VIỄN, không phục hồi được:
 * «từ chối là xóa tất cả con và nhiệm vụ», và bản thân mục bị từ chối cũng xoá. Cửa mềm hơn là nút
 * «Trả lại để sửa» (`traLaiDeSua` bên dưới) — nó mới là đường dùng thường ngày; Từ chối là cửa
 * đóng hẳn.
 *
 * Thông báo cho người tạo phải gửi TRƯỚC khi xoá: sau khi xoá thì không còn dòng nào để đọc
 * `created_by`, và `ref_id` trỏ vào id đã mất là một liên kết chết ⇒ để `refType`/`refId` rỗng.
 * Xoá đi CASCADE của CSDL lo phần con cháu (FK `ON DELETE CASCADE` của `work_items`).
 */
function tuChoiVaXoaCay({ user, entity, ref, reason }) {
  return withTransaction(async (client) => {
    const target = await mustFind(entity, ref, client);
    assertCoBuocDuyet(target);
    assertCan(user, 'approve', target);

    const con = await conChauCua(target, client);
    // Gửi thông báo TRƯỚC khi xoá — xem chú thích ở đầu hàm.
    const notifications = await baoNguoiTao(
      target,
      user,
      `${moTa(target)} bị từ chối và đã bị XOÁ${con.length > 0 ? ` cùng ${con.length} mục bên trong` : ''}. Lý do: ${reason}`,
      notificationsRepo.LOAI.TU_CHOI,
      client,
      { khongTroLien: true }
    );

    if (target.kind === 'work') await worksRepo.remove(target.row.id, client);
    else await itemsRepo.remove(target.row.id, client);

    return {
      kind: target.kind,
      // `row` giữ bản chụp TRƯỚC khi xoá + trạng thái đích, để route ghi được nhật ký và giao diện
      // hiện đúng mã vừa bị xoá. Dòng này không còn trong CSDL.
      row: { ...target.row, approval_status: TU_CHOI, reject_reason: reason },
      daXoa: true,
      deletedCodes: con.map((c) => c.code).filter(Boolean),
      soCon: con.length,
      notified: notifications.length,
    };
  });
}

/**
 * Thông báo kết quả cho NGƯỜI TẠO (việc 5.7). Dòng do seed/nhập liệu cũ có thể không có người tạo,
 * và người tự xử việc mình gửi thì không cần tự báo cho mình.
 */
function baoNguoiTao(target, user, content, type, client, { khongTroLien = false } = {}) {
  const nguoiTao = target.row.created_by;
  const tuBaoChoMinh = nguoiTao != null && Number(nguoiTao) === Number(user.id);
  if (nguoiTao == null || tuBaoChoMinh) return Promise.resolve([]);
  return notificationsRepo.insertMany(
    [
      {
        userId: nguoiTao,
        content,
        type,
        // Mục đã bị xoá thì không trỏ liên kết — id đã mất, bấm vào chỉ ra 404.
        refType: khongTroLien ? '' : target.kind === 'work' ? 'work' : 'work_item',
        refId: khongTroLien ? null : target.row.id,
      },
    ],
    client
  );
}

/**
 * Thông báo cho một NGƯỜI CỤ THỂ (013) — dùng khi người cần báo không phải người tạo, ví dụ người
 * XIN XOÁ. Tách khỏi `baoNguoiTao` vì hai hàm trả lời hai câu khác nhau; gộp lại rồi truyền cờ thì
 * chỗ gọi phải đọc cả hàm mới biết ai được báo.
 */
function baoNguoi(userId, user, target, content, type, client, { khongTroLien = false } = {}) {
  if (userId == null || Number(userId) === Number(user.id)) return Promise.resolve([]);
  return notificationsRepo.insertMany(
    [
      {
        userId,
        content,
        type,
        refType: khongTroLien ? '' : target.kind === 'work' ? 'work' : 'work_item',
        refId: khongTroLien ? null : target.row.id,
      },
    ],
    client
  );
}

/** Mục này có yêu cầu xoá nào đang treo không (013). */
const dangXinXoa = (row) => row != null && row.xoa_yeu_cau_boi != null;

/**
 * XIN XOÁ (013, Vòng 13 đợt 2 — yêu cầu người dùng «thêm phần Chờ duyệt cho cán bộ đối với Xoá
 * Công việc cấp 1, cấp 2, nhiệm vụ cấp 3»).
 *
 * Ai xin được: người **xoá được** mục đó (`can(user,'delete',…)`). Không hạ chuẩn xuống 'update':
 * xin xoá là bước đầu của việc xoá, ai không được xoá thì cũng không được yêu cầu người khác xoá hộ.
 *
 * MỘT YÊU CẦU CHO CẢ CÂY (người dùng chốt): xin xoá công việc cấp 1 là xin xoá luôn con cháu —
 * đối xứng với «duyệt cha = duyệt cả cây» của đợt 1. Con cháu KHÔNG bị ghi cờ: chỉ gốc mang yêu
 * cầu, nên hộp chờ duyệt hiện một dòng và không có cách nào để con cháu «mồ côi cờ» khi gốc bị xử.
 *
 * `approval_status` KHÔNG đổi (xem đầu migration 013): mục đang xin xoá vẫn hiện bình thường và
 * vẫn vào thống kê, chỉ thêm nhãn đỏ. Chưa ai đồng ý thì việc vẫn phải làm.
 */
export function xinXoa(user, entity, ref, lyDo) {
  const noiDung = String(lyDo ?? '').trim();
  if (noiDung.length < DO_DAI_LY_DO_TOI_THIEU) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Vui lòng nhập lý do xin xoá, ít nhất ${DO_DAI_LY_DO_TOI_THIEU} ký tự`,
      { field: 'reason' }
    );
  }
  return withTransaction(async (client) => {
    const target = await mustFind(entity, ref, client);
    assertCan(user, 'delete', target);

    if (dangXinXoa(target.row)) {
      throw conflict(`${moTa(target)} đang có yêu cầu xoá chờ duyệt rồi`, 'xoaYeuCauBoi');
    }

    const con = await conChauCua(target, client);
    const row = await ghiKhoaDuyet(
      target,
      { xoa_yeu_cau_boi: user.id, xoa_yeu_cau_luc: new Date(), xoa_ly_do: noiDung },
      client
    );

    const nguoiNhan = await phoGiamDocPhuTrach(phongCua(target.row), client);
    const keMuc = con.length > 0 ? ` (xoá sẽ mất kèm ${con.length} mục bên trong)` : '';
    const notifications = await notificationsRepo.insertMany(
      nguoiNhan.map((m) => ({
        userId: m.user_id,
        content: `${moTa(target)}${keMuc} đang xin XOÁ, chờ bạn duyệt (người xin: ${user.full_name ?? user.code ?? ''}). Lý do: ${noiDung}`,
        type: notificationsRepo.LOAI.CHO_DUYET,
        refType: target.kind === 'work' ? 'work' : 'work_item',
        refId: target.row.id,
      })),
      client
    );

    return { kind: target.kind, row, soCon: con.length, notified: notifications.length };
  });
}

/**
 * DUYỆT YÊU CẦU XOÁ (013) — xoá THẬT, cả cây bên dưới (CASCADE của CSDL lo con cháu).
 *
 * Quyền: đúng bằng quyền DUYỆT mục đó (`can(user,'approve',…)`), không thêm ô ghi đè riêng — ai
 * duyệt được nội dung của một mục thì duyệt được yêu cầu xoá mục đó. Bớt một hàng trong Bảng phân
 * quyền cũng là bớt 4 ô để cấu hình sai.
 *
 * Thông báo cho người XIN XOÁ phải gửi TRƯỚC khi xoá: sau khi xoá không còn dòng nào để đọc
 * `xoa_yeu_cau_boi`, và `ref_id` trỏ vào id đã mất là liên kết chết ⇒ `refType`/`refId` rỗng.
 * Cùng bẫy đã gặp ở `tuChoiVaXoaCay` (đợt 1).
 */
export function duyetXoa(user, entity, ref) {
  return withTransaction(async (client) => {
    const target = await mustFind(entity, ref, client);
    assertCan(user, 'approve', target);

    if (!dangXinXoa(target.row)) {
      throw conflict(`${moTa(target)} không có yêu cầu xoá nào đang chờ`, 'xoaYeuCauBoi');
    }

    const con = await conChauCua(target, client);
    const notifications = await baoNguoi(
      target.row.xoa_yeu_cau_boi,
      user,
      target,
      `Yêu cầu xoá ${moTa(target)} đã được DUYỆT — mục này${con.length > 0 ? ` cùng ${con.length} mục bên trong` : ''} đã bị xoá.`,
      notificationsRepo.LOAI.DA_DUYET,
      client,
      { khongTroLien: true }
    );

    if (target.kind === 'work') await worksRepo.remove(target.row.id, client);
    else await itemsRepo.remove(target.row.id, client);

    return {
      kind: target.kind,
      // Bản chụp TRƯỚC khi xoá — dòng này không còn trong CSDL, giữ để route ghi nhật ký được.
      row: target.row,
      daXoa: true,
      deletedCodes: con.map((c) => c.code).filter(Boolean),
      soCon: con.length,
      notified: notifications.length,
    };
  });
}

/**
 * TỪ CHỐI YÊU CẦU XOÁ (013) — xoá ba cột yêu cầu, mục trở lại nguyên trạng.
 *
 * `approval_status` KHÔNG đổi: đó là lý do 013 dùng ba cột riêng thay vì thêm một giá trị vào
 * `approval_status` (xem đầu migration). Mục vốn «Đã duyệt» thì vẫn «Đã duyệt», vốn «Nháp» thì vẫn
 * «Nháp» — không phải đoán xem nên trả về đâu.
 *
 * Lý do từ chối là TUỲ CHỌN: người duyệt nói không thì việc vẫn nguyên, không có gì mất đi nên
 * không cần bắt giải trình như khi từ chối nội dung (thứ xoá hẳn cả cây).
 */
export function tuChoiXoa(user, entity, ref, lyDo) {
  return withTransaction(async (client) => {
    const target = await mustFind(entity, ref, client);
    assertCan(user, 'approve', target);

    if (!dangXinXoa(target.row)) {
      throw conflict(`${moTa(target)} không có yêu cầu xoá nào đang chờ`, 'xoaYeuCauBoi');
    }

    const nguoiXin = target.row.xoa_yeu_cau_boi;
    const row = await ghiKhoaDuyet(
      target,
      { xoa_yeu_cau_boi: null, xoa_yeu_cau_luc: null, xoa_ly_do: '' },
      client
    );

    const ghiChu = String(lyDo ?? '').trim();
    const notifications = await baoNguoi(
      nguoiXin,
      user,
      target,
      `Yêu cầu xoá ${moTa(target)} bị TỪ CHỐI — mục vẫn giữ nguyên.${ghiChu ? ` Lý do: ${ghiChu}` : ''}`,
      notificationsRepo.LOAI.TU_CHOI,
      client
    );

    return { kind: target.kind, row, notified: notifications.length };
  });
}

/**
 * TRẢ LẠI ĐỂ SỬA (012, Vòng 13) — cửa mềm giữa Duyệt và Từ chối, người dùng chốt 2026-08-31.
 *
 * Cả cây về «Nháp» của người tạo, KHÔNG mất dữ liệu; ghi chú của người duyệt lưu vào
 * `reject_reason` để người tạo đọc được lý do phải sửa. Người tạo sửa xong bấm «Gửi duyệt» lại.
 *
 * Quyền: đúng bằng quyền DUYỆT (`can(user,'approve',…)`) — trả lại là một quyết định của người
 * duyệt, không phải một lượt sửa nội dung.
 */
export function traLaiDeSua(user, entity, ref, ghiChu) {
  const noiDung = String(ghiChu ?? '').trim();
  if (noiDung.length < DO_DAI_LY_DO_TOI_THIEU) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Vui lòng nhập ghi chú cần sửa gì, ít nhất ${DO_DAI_LY_DO_TOI_THIEU} ký tự`,
      { field: 'reason' }
    );
  }
  return withTransaction(async (client) => {
    const target = await mustFind(entity, ref, client);
    assertCoBuocDuyet(target);
    assertCan(user, 'approve', target);

    if (target.row.approval_status === NHAP) {
      throw conflict(`${moTa(target)} đang là bản nháp rồi`, 'approvalStatus');
    }

    const { row, soCon } = await ghiKhoaDuyetCaCay(
      target,
      {
        approval_status: NHAP,
        approver_id: null,
        approved_at: null,
        reject_reason: noiDung,
      },
      // Kéo theo cả mục đã duyệt bên trong: cả cây phải về tay người tạo, nếu để lại một mục
      // «Đã duyệt» giữa cây nháp thì nó vẫn vào thống kê trong khi cha đã rút khỏi luồng duyệt.
      [CHO_DUYET, DA_DUYET, TU_CHOI],
      client
    );

    const notifications = await baoNguoiTao(
      target,
      user,
      `${moTa(target)} được trả lại để sửa. Ghi chú: ${noiDung}`,
      notificationsRepo.LOAI.TU_CHOI,
      client
    );

    return { kind: target.kind, row, soCon, notified: notifications.length };
  });
}

export function approve(user, entity, ref) {
  return duyetCaCay({ user, entity, ref });
}

/**
 * Từ chối — lý do là BẮT BUỘC và phải ≥ 10 ký tự sau khi cắt trắng (TC-APR-08).
 *
 * Kiểm ở đây chứ không chỉ ở zod của route: `reject` còn được gọi từ cầu RPC, và một luật nghiệp
 * vụ nằm duy nhất trong lược đồ của một route là luật có đường vòng.
 *
 * Lý do là dữ liệu NGƯỜI DÙNG NHẬP — lưu và trả về nguyên văn, không thoát HTML ở máy chủ. Thoát ở
 * đây thì giao diện (đã thoát đủ 474 chỗ ở Phase 4) thoát lần thứ hai và người đọc thấy `&lt;`.
 * Chỗ chống XSS đúng là nơi dựng HTML, không phải nơi lưu dữ liệu (xem `xss-injection.test.js`).
 *
 * TỪ 012: từ chối là XOÁ HẲN cả cây, xem `tuChoiVaXoaCay`.
 */
export function reject(user, entity, ref, reason) {
  const lyDo = String(reason ?? '').trim();
  if (lyDo.length < DO_DAI_LY_DO_TOI_THIEU) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Vui lòng nhập lý do từ chối, ít nhất ${DO_DAI_LY_DO_TOI_THIEU} ký tự`,
      { field: 'reason' }
    );
  }
  return tuChoiVaXoaCay({ user, entity, ref, reason: lyDo });
}

/**
 * Phạm vi badge của một người (việc 5.5).
 *
 * Không phải phạm vi DUYỆT: Trưởng phòng không duyệt được nhưng vẫn cần biết phòng mình còn bao
 * nhiêu mục đang treo, và ai cũng cần thấy việc mình gửi đi đã được xử chưa. Vì badge chỉ ĐẾM
 * (không mở đường ghi nào), rộng hơn quyền duyệt ở đây không nới quyền của §6.
 */
export function phamViBadge(user) {
  if (user.role === 'admin') return { all: true };
  const departmentIds = [];
  if (user.role === 'Phó Giám đốc') departmentIds.push(...(user.managedDepartmentIds ?? []));
  else if (user.department_id != null) departmentIds.push(user.department_id);
  // Ủy quyền đang hiệu lực: các phòng của NGƯỜI ỦY QUYỀN cũng vào phạm vi badge/danh sách
  // (2026-08-28 — Phó GĐ được ủy quyền phải thấy duyệt + việc của phòng bên ủy quyền).
  (user.delegations ?? []).forEach((d) => departmentIds.push(...(d.departmentIds ?? [])));
  return { all: false, departmentIds, createdBy: user.id };
}

/** Số mục chờ duyệt cho badge — `GET /approvals/pending-count` (việc 5.5). */
export function pendingCount(user) {
  return repo.countPending(phamViBadge(user));
}

/** Danh sách mục chờ duyệt trong phạm vi người đang xem. */
export function pendingList(user, { limit = 50 } = {}) {
  return repo.listPending(phamViBadge(user), { limit });
}

/** Danh sách YÊU CẦU XOÁ đang chờ duyệt trong phạm vi người đang xem (013). */
export function pendingDeleteList(user, { limit = 50 } = {}) {
  return repo.listPendingDeletes(phamViBadge(user), { limit });
}
