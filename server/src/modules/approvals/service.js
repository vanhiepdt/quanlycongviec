// Nghiệp vụ luồng duyệt (§7 việc 5.2, 5.3, 5.5, 5.7 · §8.4 nhóm E · TC-APR-08..16).
//
// Ba hành động, một đường ghi:
//   submit  — gửi một mục đi duyệt (hoặc gửi lại sau khi bị từ chối) ⇒ 'Chờ duyệt'
//   approve — 'Đã duyệt', ghi người duyệt và thời điểm, xoá lý do từ chối cũ
//   reject  — 'Từ chối', BẮT BUỘC lý do ≥ 10 ký tự
//
// Bốn điểm đáng nói:
//
//  1. **Quyền duyệt không viết lại ở đây.** `can(user, 'approve', ...)` của §6 quyết định. Từ ĐỢT A
//     (028_supervisor_ids.sql) nó gồm HAI lớp: ma trận vai (`admin`, `Phó Giám đốc`) VÀ danh sách
//     `supervisor_ids` của chính dòng — R1(a) chốt «chỉ người TRONG danh sách mới duyệt được, KHÔNG
//     chừa admin làm dự phòng». `inScope()` vẫn bó Phó Giám đốc theo `managedDepartmentIds`. Nhờ vậy
//     TC-APR-10 (Phó GĐ duyệt phòng không phụ trách ⇒ 403) và TC-APR-11 (Nhân viên gọi thẳng API ⇒
//     403) không cần thêm một dòng điều kiện nào ở đây. Thêm điều kiện danh sách lần thứ hai ở đây
//     là tạo nguồn sự thật thứ hai cho quyền duyệt — đúng cái §6 cấm.
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
import * as notificationsRepo from '../notifications/repo.js';
import * as usersRepo from '../users/repo.js';
import * as worksRepo from '../works/repo.js';
import * as itemsRepo from '../workItems/repo.js';
import * as worksService from '../works/service.js';
import * as itemsService from '../workItems/service.js';
import * as repo from './repo.js';
import {
  startSubmission,
  clearPending,
  publishChanges,
  pendingGuiBld,
  proposeGuiBld,
} from './changes.js';
import * as luuCho from './luuCho.js';
import { pendingTyLe } from './tyLe.js';
import {
  CHO_DUYET,
  DA_DUYET,
  NHAP,
  TU_CHOI,
  boCotKhoaDuyet,
  phaiDuyetLaiKhiGuiGio,
} from './rules.js';

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
    let row = await worksRepo.findByRef(ref, client);
    if (!row) throw notFound(`Không tìm thấy công việc "${ref}"`);
    await client.query('SELECT id FROM works WHERE id = $1 FOR UPDATE', [row.id]);
    row = await worksRepo.findByRef(ref, client);
    if (!row) throw notFound();
    return { kind, row, entityType: 'work', label: 'Công việc' };
  }
  // `findByRefWithWork` để có `work_department_id` — `can()` cần phòng để xét phạm vi (§6).
  let row = await itemsRepo.findByRefWithWork(ref, client);
  if (!row) throw notFound(`Không tìm thấy công việc con/nhiệm vụ "${ref}"`);
  await client.query('SELECT id FROM works WHERE id = $1 FOR UPDATE', [row.work_id]);
  row = await itemsRepo.findByRefWithWork(ref, client);
  if (!row) throw notFound();
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

/**
 * Người nhận thông báo duyệt của một mục — ĐỢT A (028_supervisor_ids.sql, D3 + R1a).
 *
 * Bản cũ trả «mọi Phó Giám đốc phụ trách phòng» (`department_managers.role = 'deputy_director'`).
 * Đó là điểm bất hợp lý số 3 của bản rà soát 10/09/2026: người duyệt CÂY không trùng người duyệt
 * FILE, và phòng có ba Phó GĐ thì cả ba cùng nhận chuông cho một việc chỉ một người được giao.
 * Nay người nhận đúng bằng `supervisor_ids` của chính dòng — CÙNG danh sách mà `can()` dùng để xét
 * quyền duyệt, nên chuông và quyền không thể lệch nhau: ai nhận thông báo thì người đó duyệt được.
 *
 * Trả RỖNG khi dòng chưa phân công. `submit` đã chặn trường hợp đó (NO_APPROVER_ASSIGNED), còn
 * `xinXoa` thì cố ý KHÔNG chặn — yêu cầu xoá vẫn phải gửi được, chỉ là không có chuông. Ném lỗi ở
 * đây thì một dòng cũ thiếu phân công là không ai xin xoá được nó.
 *
 * Lọc `is_active`: người trong danh sách đã nghỉ mà vẫn nhận chuông là một dòng không ai xử được.
 * Không tự loại họ khỏi `supervisor_ids` — sửa phân công là việc của người có quyền `update`, và
 * R1(a) giữ đúng đường đó làm lối thoát khi cả danh sách nghỉ việc.
 *
 * `actor` (người vừa bấm nút) bị loại khỏi danh sách nhận: tự gửi việc cho chính mình duyệt thì
 * không cần chuông báo, cùng lý do `baoNguoiTao` không báo người tự xử việc mình gửi.
 */
async function banKiemSoatCua(row, client, actor = null) {
  const ids = [...new Set((row?.supervisor_ids ?? []).map(Number).filter(Number.isFinite))];
  if (ids.length === 0) return [];
  const nguoi = await usersRepo.listByIds(ids, client);
  return nguoi.filter((u) => u.is_active && (actor == null || String(u.id) !== String(actor.id)));
}

/** Một dòng mô tả mục, dùng trong nội dung thông báo. Chữ thuần, không HTML. */
const moTa = (target) => `${target.label} ${target.row.code} — ${target.row.name ?? ''}`.trim();

/**
 * Gửi duyệt: đưa một mục **và cả cây bên dưới nó** vào hàng chờ, báo cho Ban lãnh đạo kiểm soát
 * của chính mục đó (ĐỢT A — trước đây báo mọi Phó Giám đốc của phòng, xem `banKiemSoatCua`).
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

    // R1(a) — ĐỢT A: chưa chọn «Ban lãnh đạo kiểm soát» thì KHÔNG gửi duyệt được.
    //
    // Không phải một phép kiểm dư: `can()` nay bó quyền duyệt vào đúng danh sách này và bỏ luôn
    // đường dự phòng của admin, nên gửi một mục có danh sách rỗng là tạo ra một dòng **kẹt vĩnh
    // viễn** trong hàng chờ — không một ai trên hệ thống duyệt nổi, kể cả Giám đốc. Chặn ở cửa gửi
    // thì người lập sửa được ngay lúc đó; để lọt thì chỉ phát hiện ra khi việc đã trễ.
    //
    // Kiểm ở ĐÂY chứ không phải lúc lưu: lúc lưu mà bắt buộc thì không ai sửa nổi một công việc cũ
    // chưa phân công để mà thêm người vào (xem chú thích của `assertSupervisors`).
    if ((target.row.supervisor_ids ?? []).length === 0) {
      throw new AppError(
        'NO_APPROVER_ASSIGNED',
        `${moTa(target)} chưa có «Ban lãnh đạo kiểm soát» — hãy chọn người duyệt cho mục này rồi gửi lại`,
        { field: 'supervisorIds' }
      );
    }

    await startSubmission(user, target, client);
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

    const nguoiNhan = await banKiemSoatCua(target.row, client, user);
    const keMuc = soCon > 0 ? ` (kèm ${soCon} mục bên trong)` : '';
    const notifications = await notificationsRepo.insertMany(
      nguoiNhan.map((m) => ({
        userId: m.id,
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
function duyetCaCay({ user, entity, ref, edit }) {
  return withTransaction(async (client) => {
    let target = await mustFind(entity, ref, client);
    assertCoBuocDuyet(target);
    // Cổng quyền DUY NHẤT của việc 5.3. Từ ĐỢT A (R1a): admin và Phó Giám đốc phụ trách phòng,
    // nhưng CHỈ khi có tên trong `supervisor_ids` của chính dòng — không còn ai được duyệt thay.
    assertCan(user, 'approve', target);

    // TC-APR-14: duyệt hai lần thì lần hai là 409 và KHÔNG sinh thông báo trùng.
    if (target.row.approval_status === DA_DUYET) {
      throw conflict(
        `${moTa(target)} đã ở trạng thái "${DA_DUYET}" — không cần làm lại`,
        'approvalStatus'
      );
    }

    let saved;
    if (edit) {
      if (target.row.approval_status !== CHO_DUYET)
        throw conflict(
          'Chỉ sửa và phê duyệt cùng lúc khi đầu việc đang Chờ duyệt',
          'approvalStatus'
        );
      saved =
        target.kind === 'work'
          ? await worksService.update(user, ref, edit.patch, { client })
          : await itemsService.update(user, ref, edit.patch, {
              targetWorkRef: edit.targetWorkRef,
              client,
            });
      target = await mustFind(entity, ref, client);
      assertCan(user, 'approve', target);
    }
    await publishChanges(target, client);
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

    return {
      kind: target.kind,
      row,
      soCon,
      notified: notifications.length,
      changes: saved?.changes,
    };
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

    const nguoiNhan = await banKiemSoatCua(target.row, client, user);
    const keMuc = con.length > 0 ? ` (xoá sẽ mất kèm ${con.length} mục bên trong)` : '';
    const notifications = await notificationsRepo.insertMany(
      nguoiNhan.map((m) => ({
        userId: m.id,
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

    await clearPending(target, client);
    // Giỏ «lưu chờ» (S1) cũng phải dọn, và dọn ở ĐÂY chứ không phải lúc người tạo sửa lại bản nháp:
    // điều kiện mở giỏ là dòng đang `Đã duyệt`, mà cả cây vừa bị kéo về `Nháp`. Để giỏ còn treo thì
    // nút «Gửi duyệt» vẫn hiện, và bấm nó là ghi đè giá trị cũ lên bản nháp người tạo đang soạn lại
    // — mất công soạn mà không một câu thông báo. `clearPending` bên trên không đụng tới giỏ vì nó
    // lọc cứng `change_kind = 'reviewer'`.
    await luuCho.xoaGioCay(await luuCho.phamViCay(target, client), client);
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

export function approve(user, entity, ref, edit) {
  return duyetCaCay({ user, entity, ref, edit });
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
export async function pendingCount(user) {
  const count = await repo.countPending(phamViBadge(user));
  // ĐỢT B (R4''): đề nghị đổi TỶ LỆ cũng nằm trong `approval_changes` và cũng đếm vào badge — một
  // đầu việc đang chờ người này ký thì phải hiện lên con số, bất kể nó là cây, là cái tích hay là %.
  const [guiBld, tyLeChanges] = await Promise.all([pendingGuiBld(user), pendingTyLe(user)]);
  const guiBldChanges = guiBld.length;
  return {
    ...count,
    guiBldChanges,
    tyLeChanges: tyLeChanges.length,
    total: count.total + guiBldChanges + tyLeChanges.length,
  };
}

/** Danh sách mục chờ duyệt trong phạm vi người đang xem. */
export async function pendingList(user, { limit = 50 } = {}) {
  const [guiBld, tyLeRows] = await Promise.all([pendingGuiBld(user), pendingTyLe(user)]);
  return [...guiBld, ...tyLeRows, ...(await repo.listPending(phamViBadge(user), { limit }))].slice(
    0,
    limit
  );
}

/** Danh sách YÊU CẦU XOÁ đang chờ duyệt trong phạm vi người đang xem (013). */
export function pendingDeleteList(user, { limit = 50 } = {}) {
  return repo.listPendingDeletes(phamViBadge(user), { limit });
}

// ────────────────────────────────────────────────────────────────────────────────────────────────
// GIỎ «LƯU CHỜ» (S1–S4, 12/09/2026) — «sửa → lưu chờ → popup tick → gửi duyệt»
// ────────────────────────────────────────────────────────────────────────────────────────────────
//
// Chỉ đạo người dùng nguyên văn: «tôi muốn khi sửa thông tin gì cũng có chế độ lưu chờ (tức là cho
// sửa tiếp), rồi nút ấn gửi duyệt thay vì gửi duyệt luôn khi ấn cập nhật như bây giờ, và trước khi ấn
// nút gửi duyệt thì phải hiển thị popup những cái thay đổi, chắc chắn rồi ấn ok để gửi đi duyệt. Nếu
// trong màn hình công việc con thì cho sửa cả nhiệm vụ cùng lưu tạm đấy, còn nếu màn hình chỉ có sửa
// nhiệm vụ thì chỉ nhiệm vụ thôi.» Bốn câu đã chốt:
//   S1 — «Lưu chờ» là GIỎ, cột thật GIỮ giá trị cũ; lưới vẫn «Đã duyệt» kèm badge «có sửa chờ».
//   S2 — CHỈ mục đang «Đã duyệt»; «Nháp»/«Chờ duyệt»/«Từ chối» giữ nguyên hành vi cũ.
//   S3 — ở màn hình công việc con, «Gửi duyệt» gửi CẢ CÂY một lần.
//   S4 — popup CÓ Ô TICK: bỏ tick thì thay đổi đó ở lại giỏ, chưa gửi.
//
// Vì sao bốn hàm nghiệp vụ nằm Ở ĐÂY còn `luuCho.js` chỉ giữ nguyên ngữ SQL: chúng cần `mustFind`
// (khoá dòng + xét quyền theo phạm vi), `moTa`, `entityOf`, và cần gọi `worksService.update` /
// `itemsService.update` để ÁP giỏ. Bốn thứ đó đều ở file này. `luuCho.js` đứng cùng chỗ trong đồ thị
// import với `changes.js` và `tyLe.js` nên thêm nó không tạo vòng; kéo nghiệp vụ xuống đó thì có.
//
// Vì sao ÁP giỏ bằng hai hàm `update` chứ không `repo.update` thẳng: lượt ghi phải đi qua đúng những
// cửa một lượt sửa bình thường đi qua — cân lại tỷ lệ anh em (`canLaiTyLeWork`), suy `assignee_id`
// từ `assignee_name` (`resolveAssignee`), kiểm phân công ba lớp, hạ về `Chờ duyệt` kèm `submitted_by`
// và chuông R7 (`baoKhiHaVeChoDuyet`). Tự ghi ở đây là nhân bản năm đoạn luật ra chỗ thứ sáu, và chỗ
// lệch sẽ KHÔNG nổ lỗi — nó chỉ lặng lẽ cho một ô tỷ lệ đổi mà anh em không được cân.
//
// Hai chỗ cố ý KHÔNG đụng:
//   • `pendingCount` — giỏ là việc riêng của người đang soạn, người duyệt chưa có gì phải làm; cộng
//     nó vào `total` là làm chuông «Chờ duyệt» rung cho một thứ chưa ai được gửi. Badge đi đường
//     riêng (`gioChoCuaToi`).
//   • `duyetCaCay` — giỏ còn sót khi cây được duyệt thì GIỮ. Đó đúng là chữ «cho sửa tiếp»: người
//     dùng cất nháp cho lượt duyệt sau, không ai có quyền vứt bản nháp của họ khi ký lượt này.

/** Câu trả lời cho S2, và cũng là cờ giao diện dùng để đổi nhãn nút «Cập nhật» thành «Lưu chờ». */
function oCheDoLuuCho(user, target) {
  // `phaiDuyetLaiKhiSua` đã tự trả `false` cho mọi trạng thái khác `Đã duyệt` (cả hai nhánh của nó
  // đều bắt đầu từ `DA_DUYET`), nên S2 không cần viết lại thành một điều kiện thứ hai ở đây — viết
  // hai lần là hai chỗ để lệch, đúng cái kiểu hỏng mà đầu `rules.js` nói tới.
  //
  // `can(update)` đứng sau vì đó là câu hỏi khác: «có được ghi không», không phải «ghi thì có phải
  // qua duyệt lại không». Một vai ghi THẲNG (admin, hay Phó GĐ sửa mục phòng mình khi không bị ghi
  // đè) thì nút «Cập nhật» giữ nguyên hành vi cũ và không có giỏ nào cả. Đó là cố ý: bắt người vốn
  // được ghi thẳng phải tự gửi cho chính mình duyệt là thêm một bước không ai ký.
  return (
    phaiDuyetLaiKhiGuiGio(user, target.entityType, target.row) &&
    can(user, 'update', target.entityType, target.row).ok
  );
}

/**
 * Đổi chỗ trên cây KHÔNG nằm trong giỏ — và thà nói thẳng còn hơn im lặng bỏ qua.
 *
 * Giỏ giữ cặp `field → valueTo` của những CỘT trong `LABELS_GIO`; còn chuyển cha / chuyển sang công
 * việc khác là việc của `itemsRepo.updateStructure` kèm một loạt kiểm tra chu trình và cân lại tỷ lệ
 * của CẢ HAI công việc. Cất nó vào giỏ là phải nhân bản số kiểm tra đó ra một chỗ thứ hai.
 *
 * Nút này gần như không nổ với modal hiện tại, và lý do đáng ghi lại vì hai khoá đi hai đường khác
 * nhau: `#task-form` chỉ vẽ ô ẩn `name="parent"` ở chế độ TẠO MỚI (`createTaskModal` nhánh
 * `!isEdit`), nên lượt SỬA không gửi `parentRef` lên đây — `taskFromLegacy` chỉ đặt khoá đó khi thân
 * có `parent`/`parentRef`. Còn `workRef` thì NGƯỢC LẠI, có trong MỌI lượt sửa: `select[name=
 * "projectId"]` bị `disabled` khi sửa nhưng `handleEdit` nhặt lại giá trị của select disabled bỏ vào
 * `data`. Vậy nên phải SO SÁNH chứ không được thấy khoá là chặn (chặn mù thì mọi lượt «Lưu chờ» đều
 * 409), và phải chặn chứ không được bỏ qua (bỏ qua là một lượt chuyển cây mất hút không một câu thông
 * báo).
 */
const DOI_CHO =
  'Đổi chỗ trên cây (chuyển sang công việc / công việc con khác) không nằm trong chế độ «lưu chờ» — giỏ chỉ giữ giá trị cột. Hãy gửi các thay đổi đang chờ rồi đổi chỗ sau.';

async function assertKhongDoiCho(target, dayDu, targetWorkRef, client) {
  if (target.kind === 'work') return;
  const before = target.row;
  if (Object.hasOwn(dayDu, 'parentRef')) {
    const raw =
      dayDu.parentRef == null || String(dayDu.parentRef).trim() === '' ? null : dayDu.parentRef;
    const cha = raw == null ? null : await itemsRepo.findByRef(raw, client);
    if ((cha?.id ?? null) !== before.parent_id) throw conflict(DOI_CHO, 'parentRef');
  }
  if (targetWorkRef !== undefined) {
    const viec = await worksRepo.findByRef(targetWorkRef, client);
    if ((viec?.id ?? null) !== before.work_id) throw conflict(DOI_CHO, 'workRef');
  }
}

/**
 * Giỏ thô từ CSDL → hình dạng popup.
 *
 * `entity` suy từ `level` đọc SỐNG chứ không cất trong giỏ: giỏ treo được qua nhiều ngày, mà cấp của
 * một dòng thì đổi được. Popup hiện sai nhãn «Nhiệm vụ» cho một công việc con là chuyện nhỏ, nhưng
 * chính nhãn đó quyết định đường gửi (`/works/…` hay `/work-items/…`) và loại thực thể trong nhật ký.
 */
async function dinhDangGio(gio, client) {
  const ids = [...new Set(gio.filter((g) => g.item_id != null).map((g) => Number(g.item_id)))];
  const cap = new Map();
  if (ids.length) {
    const { rows } = await client.query(
      'SELECT id, level FROM work_items WHERE id = ANY($1::bigint[])',
      [ids]
    );
    for (const r of rows) cap.set(Number(r.id), Number(r.level));
  }
  return gio.map((g) => {
    const itemId = g.item_id == null ? null : Number(g.item_id);
    return {
      id: Number(g.id),
      entity: itemId == null ? 'work' : entityOf(cap.get(itemId)),
      itemId,
      workId: Number(g.work_id),
      code: g.entity_code,
      name: g.entity_name,
      // Raw draft values are read-only form defaults; submit still accepts only ids/fields.
      thayDoi: g.changes.map((c) => ({ field: c.field, label: c.label, from: c.from, to: c.to, valueTo: c.valueTo })),
    };
  });
}

/**
 * ĐỌC giỏ của một phạm vi — nội dung popup «Gửi duyệt» + cờ cho nút «Cập nhật».
 *
 * S3 nằm ở `luuCho.phamViCay`: mở popup từ CÔNG VIỆC CON thì thấy giỏ của cả cây bên dưới (nên
 * «cho sửa cả nhiệm vụ cùng lưu tạm»), mở từ một NHIỆM VỤ thì chỉ thấy giỏ của chính nó vì cấp 3
 * không có con cháu. Cùng một hàm, không một nhánh nào ở đây phải biết cấp.
 */
export function docGio(user, entity, ref) {
  return withTransaction(async (client) => {
    const target = await mustFind(entity, ref, client);
    assertCan(user, 'read', target);
    const gio = await luuCho.gioTrongCay(await luuCho.phamViCay(target, client), client);
    return {
      kind: target.kind,
      code: target.row.code,
      name: target.row.name,
      approvalStatus: target.row.approval_status,
      // Server tính, KHÔNG để client tự suy: giao diện có một bản sao của ma trận quyền
      // (`giaTriHieuLucQuyen` trong `app.js`) và bản sao đó đã từng lệch. Nút hiện sai thì người
      // dùng bấm «Cập nhật» và nhận 409, hoặc ngược lại mất lượt sửa vào giỏ mà không biết.
      phaiLuuCho: oCheDoLuuCho(user, target),
      gio: await dinhDangGio(gio, client),
      tongSoThayDoi: gio.reduce((n, g) => n + g.changes.length, 0),
    };
  });
}

/**
 * CẤT một lượt sửa vào giỏ (nút «Cập nhật» khi `phaiLuuCho`).
 *
 * `patch` là thân request ĐÃ đổi sang tên cột CSDL — route chạy nó qua đúng `toRow` của
 * `works/routes.js` và `workItems/routes.js`, nên hai đường (PATCH cũ và giỏ mới) nhìn thấy cùng một
 * hình dạng và cùng một bộ khoá hợp lệ.
 *
 * Ghi ĐÈ chứ không thêm dòng: hai unique index của 029 đã chốt «một đề nghị đang chờ trên mỗi dòng
 * cho mỗi `change_kind`», và đó cũng đúng ý người dùng — «lưu chờ (tức là cho sửa tiếp)». Lượt thứ
 * hai sửa cùng một ô thì giữ `from` của lượt ĐẦU và chỉ đổi `to` (`tronThayDoi`), nên popup luôn kể
 * «từ giá trị đang chạy trong CSDL → giá trị sắp gửi», không phải chuỗi các lần sửa vụn.
 */
export function luuGio(user, entity, ref, patch = {}, { targetWorkRef = undefined } = {}) {
  return withTransaction(async (client) => {
    const target = await mustFind(entity, ref, client);
    assertCan(user, 'update', target);
    if (!oCheDoLuuCho(user, target)) {
      throw conflict(
        `${moTa(target)} không ở chế độ «lưu chờ». Chỉ mục đang "${DA_DUYET}" và lượt sửa của vai bạn phải qua duyệt lại thì mới cất vào giỏ — hãy dùng nút «Cập nhật» như cũ.`,
        'approvalStatus'
      );
    }
    const dayDu = boCotKhoaDuyet(patch);
    await assertKhongDoiCho(target, dayDu, targetWorkRef, client);

    // Tích «Gửi BLĐ phê duyệt» KHÔNG vào giỏ: 026 đã cấp cho nó một trục duyệt RIÊNG
    // (`change_kind = 'gui-bld'`, đúng MỘT người của Ban lãnh đạo kiểm soát nhiệm vụ ký), và trục đó
    // vẫn chạy y như cũ. Nhét nó vào giỏ là hai trục cho một ô — đúng thứ 029 gộp lại để bỏ.
    // Gọi ở ĐÂY thay vì để client gọi PATCH riêng, vì PATCH sẽ hạ dòng về `Chờ duyệt` (Q9) và phá S1.
    let guiBldChange;
    if (target.kind === 'item' && typeof dayDu.gui_bld_phe_duyet === 'boolean') {
      guiBldChange = await proposeGuiBld(
        user,
        target.row,
        // `after` = bản nháp SAU khi giỏ được áp: `proposeGuiBld` cần `supervisor_ids` sắp tới để
        // kiểm «tích bật thì phải có người nhận» và để tìm đúng một người ký. Riêng `assignee_id`
        // vẫn là giá trị CŨ khi lượt này đổi luôn ô «Người thực hiện» — giỏ chỉ giữ `assignee_name`
        // thô, id do `resolveAssignee` suy ra lúc ÁP. Lệch đó AN TOÀN vì nó rơi đúng vào chốt chống
        // cũ của `decideGuiBld`: «Phân công hoặc tích hiện tại đã thay đổi — hãy từ chối và lập đề
        // nghị mới». Tức là đề nghị bị từ chối để lập lại, chứ không âm thầm ký trên phân công đã đổi.
        { ...target.row, ...dayDu },
        dayDu.gui_bld_phe_duyet,
        client
      );
    }

    const before = target.row;
    const isWork = target.kind === 'work';
    const cu = await luuCho.timGio(isWork ? before.id : null, isWork ? null : before.id, client);
    const changes = await luuCho.thayDoiTu(cu?.changes, before, { ...before, ...dayDu }, client, {
      patch: dayDu,
    });
    const id = await luuCho.ghiGio({
      // `approval_changes.work_id` là NOT NULL (023) nên giỏ của MỘT DÒNG vẫn phải treo dưới công
      // việc gốc — khác với `phamViCay`, nơi `workId: null` là cờ «phạm vi là cây con, không phải cả
      // công việc». Hai chỗ cùng tên biến nhưng khác nghĩa, và chính chỗ này đã từng là lỗi: ghi NULL
      // cho giỏ nhiệm vụ là vỡ ràng buộc.
      workId: isWork ? Number(before.id) : Number(before.work_id),
      itemId: isWork ? null : Number(before.id),
      user,
      code: before.code,
      // Tên lấy từ BẢN NHÁP: lượt này có thể đổi luôn ô «Tên», và popup phải gọi đúng cái tên người
      // dùng vừa đặt chứ không phải tên cũ trong CSDL.
      name: dayDu.name ?? before.name ?? '',
      changes,
      client,
    });

    const gio = await luuCho.gioTrongCay(await luuCho.phamViCay(target, client), client);
    return {
      luuCho: id != null,
      // `id` là SỐ CỦA GIỎ, không phải số của mục — đây là cái mà ô tick của popup gửi ngược lại
      // trong `chon[].id`. `code`/`name` đi kèm để cầu RPC giữ đúng hình dạng cũ (`taskId`/`projectId`
      // của `updateTaskWithAuth` là MÃ) mà không phải đọc lại dòng.
      id: id == null ? null : Number(id),
      code: before.code,
      name: dayDu.name ?? before.name ?? '',
      // Vẫn `Đã duyệt` — đó chính là nội dung của S1. Trả ra để giao diện vẽ lại badge mà không phải
      // đoán: giỏ không đổi trạng thái, nên ai đọc `approvalStatus` sau lượt này vẫn thấy mục đã duyệt.
      approvalStatus: before.approval_status,
      // `changes` rỗng nghĩa là lượt sửa này đưa mọi ô VỀ GIÁ TRỊ CŨ (`tronThayDoi` tự bỏ field khi
      // `from === to`), giỏ cũ nếu có cũng vừa bị xoá. Nói rõ để giao diện biết đây không phải lỗi.
      soThayDoi: changes.length,
      thayDoi: changes.map((c) => ({ field: c.field, label: c.label, from: c.from, to: c.to })),
      guiBldChange,
      // Đủ số để vẽ lại popup/badge ngay, khỏi một lượt đọc thứ hai: theo S3 giỏ ở màn công việc con
      // là giỏ của CẢ CÂY, nên một lượt «lưu chờ» trên nhiệm vụ làm đổi cả số của popup cấp trên.
      tongSoThayDoi: gio.reduce((n, g) => n + g.changes.length, 0),
      soMucCoGio: gio.length,
    };
  });
}

/**
 * BỎ giỏ — hoặc cả phạm vi (không `id`), hoặc một giỏ, hoặc đúng vài ô trong một giỏ (`fields`).
 *
 * Ba mức vì popup có ba chỗ bấm: «Bỏ tất cả» ở chân popup, dấu ✕ cạnh mỗi mục, dấu ✕ cạnh mỗi dòng
 * thay đổi. Thiếu mức thứ ba thì người dùng lỡ tay sửa một ô chỉ còn cách bỏ cả mục rồi sửa lại.
 */
export function boGio(user, entity, ref, { id = null, fields = null } = {}) {
  return withTransaction(async (client) => {
    const target = await mustFind(entity, ref, client);
    assertCan(user, 'update', target);
    const phamVi = await luuCho.phamViCay(target, client);
    const truoc = await luuCho.gioTrongCay(phamVi, client);
    if (id == null) {
      const daBo = await luuCho.xoaGioId(
        truoc.map((g) => g.id),
        client
      );
      return { daBo, gio: [], tongSoThayDoi: 0 };
    }
    const g = truoc.find((x) => Number(x.id) === Number(id));
    if (!g) throw notFound(`Không có thay đổi chờ nào mang số ${id} trong phạm vi này`);

    let conLai = [];
    if (fields != null) {
      if (!Array.isArray(fields)) {
        throw new AppError('VALIDATION_ERROR', '«fields» phải là danh sách tên cột', {
          field: 'fields',
        });
      }
      const trongGio = new Set(g.changes.map((c) => c.field));
      for (const f of fields) {
        if (!trongGio.has(f)) {
          throw new AppError(
            'VALIDATION_ERROR',
            `«${f}» không nằm trong giỏ chờ của ${g.entity_code}`,
            {
              field: 'fields',
            }
          );
        }
      }
      const bo = new Set(fields);
      conLai = g.changes.filter((c) => !bo.has(c.field));
    }
    if (conLai.length) await luuCho.catGio(g.id, conLai, client);
    else await luuCho.xoaGioId([g.id], client);

    const gio = await luuCho.gioTrongCay(phamVi, client);
    return {
      daBo: 1,
      gio: await dinhDangGio(gio, client),
      tongSoThayDoi: gio.reduce((n, x) => n + x.changes.length, 0),
    };
  });
}

/**
 * S4 — dịch `chon` của client thành «giỏ nào gửi ô nào».
 *
 * `chon` vắng mặt / `null` ⇒ gửi HẾT (nút «Gửi tất cả», và cũng là hành vi khi client cũ chưa có ô
 * tick). `fields` vắng mặt trong một phần tử ⇒ gửi hết giỏ đó. Trả `Map<id, Set<field>|null>`, trong
 * đó `null` nghĩa là «cả giỏ» — phân biệt với `Set` rỗng, là «giỏ này không gửi».
 *
 * Kiểm TỪNG tên cột có thật trong giỏ: một `field` lạ mà lọt qua thì `Object.fromEntries` bên dưới
 * dựng ra một patch có khoá không nằm trong `WRITABLE`, và `repo.update` sẽ im lặng bỏ nó — người
 * dùng tưởng đã gửi, thực ra không có gì được ghi.
 */
function locTheoTich(chon, gio) {
  if (chon == null) return new Map(gio.map((g) => [Number(g.id), null]));
  if (!Array.isArray(chon)) {
    throw new AppError('VALIDATION_ERROR', '«chon» phải là danh sách {id, fields}', {
      field: 'chon',
    });
  }
  const ra = new Map();
  for (const c of chon) {
    const id = Number(c?.id);
    const g = gio.find((x) => Number(x.id) === id);
    if (!g) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Không có thay đổi chờ nào mang số ${c?.id} trong phạm vi này`,
        { field: 'chon' }
      );
    }
    if (ra.has(id)) {
      throw new AppError('VALIDATION_ERROR', `Mục số ${id} bị lặp trong «chon»`, { field: 'chon' });
    }
    if (c.fields == null) {
      ra.set(id, null);
      continue;
    }
    if (!Array.isArray(c.fields)) {
      throw new AppError('VALIDATION_ERROR', '«fields» phải là danh sách tên cột', {
        field: 'chon',
      });
    }
    const trongGio = new Set(g.changes.map((x) => x.field));
    for (const f of c.fields) {
      if (!trongGio.has(f)) {
        throw new AppError(
          'VALIDATION_ERROR',
          `«${f}» không nằm trong giỏ chờ của ${g.entity_code}`,
          { field: 'chon' }
        );
      }
    }
    ra.set(id, new Set(c.fields));
  }
  return ra;
}

/**
 * GỬI giỏ đi duyệt (nút «Gửi duyệt» sau khi đã tick trong popup).
 *
 * MỘT giao dịch cho CẢ CÂY (S3): hoặc mọi mục được tick đều ghi xong và hạ về `Chờ duyệt`, hoặc
 * không có gì thay đổi. Nửa vời ở đây là tệ nhất — người dùng thấy «đã gửi» cho ba mục mà một mục
 * lăn ra lỗi thì mục đó vẫn `Đã duyệt` với giỏ còn treo, và không câu thông báo nào nói cho họ biết
 * mục nào.
 *
 * KHÔNG tái dùng `submit()`: hàm đó ném 409 «đang chờ duyệt rồi» và, với nhiệm vụ cấp 3, ném 409
 * «không qua bước duyệt» (`assertCoBuocDuyet`). Cả hai đều sai ở đây — giỏ tự hạ dòng về `Chờ duyệt`
 * qua `phaiDuyetLaiKhiSua` bên trong hai hàm `update`, không cần ai bấm submit.
 */
export function guiGio(user, entity, ref, chon = null) {
  return withTransaction(async (client) => {
    const target = await mustFind(entity, ref, client);
    assertCan(user, 'update', target);
    const phamVi = await luuCho.phamViCay(target, client);
    const gio = await luuCho.gioTrongCay(phamVi, client);
    if (!gio.length) {
      throw conflict(`${moTa(target)} không có thay đổi nào đang chờ gửi`, 'approvalStatus');
    }
    const tich = locTheoTich(chon, gio);

    const daGui = [];
    const canhBao = [];
    for (const g of gio) {
      const chonCuaGio = tich.get(Number(g.id));
      // `undefined` = giỏ không có trong `chon` (bỏ tick cả mục); `Set` rỗng = có tên nhưng không ô
      // nào được tick. Cả hai đều nghĩa là «ở lại giỏ», khác `null` = gửi hết.
      if (chonCuaGio === undefined) continue;
      const gui =
        chonCuaGio === null ? g.changes : g.changes.filter((c) => chonCuaGio.has(c.field));
      if (!gui.length) continue;
      const oLai = chonCuaGio === null ? [] : g.changes.filter((c) => !chonCuaGio.has(c.field));

      const patch = Object.fromEntries(gui.map((c) => [c.field, c.valueTo]));
      const ketQua =
        g.item_id == null
          ? await worksService.update(user, g.entity_code, patch, { client })
          : await itemsService.update(user, g.entity_code, patch, { client, tuGuiGio: true });
      canhBao.push(...(ketQua.warnings ?? []));

      // Áp XONG mới đóng/cắt giỏ: `update` ném thì giao dịch lăn lại, giỏ còn nguyên — người dùng
      // sửa lại rồi gửi tiếp, không mất bản nháp.
      if (oLai.length) await luuCho.catGio(g.id, oLai, client);
      else await luuCho.dongGio([g.id], client);

      daGui.push({
        entity: g.item_id == null ? 'work' : 'work-item',
        code: g.entity_code,
        name: g.entity_name,
        choDuyetLai: Boolean(ketQua.choDuyetLai),
        thayDoi: gui.map((c) => ({ field: c.field, label: c.label, from: c.from, to: c.to })),
      });
    }
    if (!daGui.length) {
      throw conflict('Chưa tích thay đổi nào để gửi duyệt', 'chon');
    }

    const conLai = await luuCho.gioTrongCay(phamVi, client);
    return {
      kind: target.kind,
      // Dòng GỐC của phạm vi, để route viết nhật ký (`auditFor` bên đó cần `row`, mà giỏ áp cho cả
      // cây nên không có một `row` nào là "kết quả"). `approvalStatus` cố ý không kèm: giá trị đọc
      // được là TRƯỚC khi áp, mà áp xong thì chính dòng này có thể đã hạ về `Chờ duyệt` — đưa ra là
      // mời giao diện tin một trạng thái đã cũ. `daGui[].choDuyetLai` nói đúng chuyện đó theo từng dòng.
      muc: {
        entityType: target.entityType,
        entityId: Number(target.row.id),
        workId: Number(target.row.work_id ?? target.row.id),
        code: target.row.code,
        name: target.row.name ?? '',
      },
      daGui,
      canhBao,
      conLai: await dinhDangGio(conLai, client),
      tongSoThayDoiConLai: conLai.reduce((n, x) => n + x.changes.length, 0),
    };
  });
}

/**
 * Giỏ của CHÍNH NGƯỜI ĐANG XEM trên TOÀN hệ thống — nguồn của badge «có sửa chờ» trên lưới.
 *
 * Tách khỏi `docGio` vì hai câu hỏi khác nhau: lưới cần biết «mục nào của tôi đang có nháp», popup
 * cần biết «trong mục này nháp viết gì». Gộp lại thì mỗi lần vẽ lưới phải xét phạm vi đọc cho từng
 * dòng một.
 *
 * Câu truy vấn không có index riêng (ba index của 023/029 đều theo `work_id`/`item_id`, không theo
 * `recipient_id`), nhưng số giỏ đang treo của một người tính bằng đơn vị — đây không phải chỗ cần
 * index, và thêm một index cho nó thì mỗi lượt ghi `approval_changes` phải nuôi thêm một cây.
 */
export async function gioChoCuaToi(user) {
  const rows = await luuCho.gioCuaToi(user.id);
  return {
    tongSoThayDoi: rows.reduce((n, g) => n + g.changes.length, 0),
    muc: rows.map((g) => ({
      id: Number(g.id),
      entity: g.item_id == null ? 'work' : 'work-item',
      itemId: g.item_id == null ? null : Number(g.item_id),
      workId: Number(g.work_id),
      code: g.entity_code,
      name: g.entity_name,
      soThayDoi: g.changes.length,
      fields: g.changes.map((c) => c.field),
    })),
  };
}
