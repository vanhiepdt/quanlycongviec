// GIỎ «LƯU CHỜ» (S1–S4, 12/09/2026) — sửa một mục ĐÃ DUYỆT thì cất vào giỏ, cột thật giữ giá trị cũ.
//
// Chỉ đạo người dùng: «khi sửa thông tin gì cũng có chế độ lưu chờ (tức là cho sửa tiếp), rồi nút ấn
// gửi duyệt thay vì gửi duyệt luôn khi ấn cập nhật như bây giờ, và trước khi ấn nút gửi duyệt thì phải
// hiển thị popup những cái thay đổi, chắc chắn rồi ấn ok để gửi đi duyệt». Bốn câu đã chốt:
//   S1 — giỏ chờ, CỘT THẬT GIỮ GIÁ TRỊ CŨ; lưới vẫn «Đã duyệt» kèm badge «có sửa chờ»;
//   S2 — phạm vi CHỈ mục đang «Đã duyệt»; «Nháp»/«Chờ duyệt»/«Từ chối» giữ nguyên hành vi cũ;
//   S3 — ở màn hình công việc con, «Gửi duyệt» gửi CẢ CÂY một lần;
//   S4 — popup liệt kê thay đổi CÓ Ô TICK: bỏ tick thì thay đổi đó Ở LẠI giỏ, chưa gửi.
//
// Cơ chế giống hệt R4''/R4 (xem đầu `tyLe.js`): một dòng `approval_changes` kind `luu-cho`, giá trị
// mới nằm trong JSON, cây không bị hạ nên `v_countable_items` không mất số. Hai khác biệt có lý do:
//
//   • `recipient_id = editor_id = CHÍNH NGƯỜI SỬA`. Trục `reviewer`/`ty-le` ghi đề nghị cho NGƯỜI
//     DUYỆT đọc; giỏ này ghi cho NGƯỜI SỬA đọc lại — nó là bản nháp của lượt gửi sắp tới, chưa phải
//     một phiếu duyệt. Chuông chỉ rung lúc «Gửi duyệt», và rung theo đường sẵn có
//     (`baoKhiHaVeChoDuyet` bên trong `worksService.update`/`itemsService.update`).
//   • KHÔNG có `decision`. Không ai «quyết» giỏ này; đóng giỏ là đặt `approved_at`, để `decision`
//     NULL, đúng nghĩa «đã gửi đi rồi, không còn treo».
//
// «Cho sửa tiếp nhiều lượt» = MERGE vào giỏ cũ bằng `tronThayDoi` của `changes.js` (giữ `from` của
// lần đầu, đổi `to` thành giá trị mới nhất, sửa vòng về giá trị gốc thì bỏ field). Hai unique index
// của 029 khoá đúng MỘT giỏ đang chờ trên mỗi dòng nên merge là đường duy nhất, không phải lựa chọn.
//
// Vòng import: module này cố tình KHÔNG import một service nào — cùng vị trí trong đồ thị như
// `changes.js`. Bốn hàm nghiệp vụ (đọc / lưu / bỏ / gửi giỏ) nằm ở `approvals/service.js`, nơi đã
// có `mustFind`, `assertCan` và cả hai service ghi. Áp giỏ mà tự tay `repo.update` ở đây thì mất
// đúng phần `ty_le` phải cân lại tỷ lệ anh em (`canLaiTyLeWork`) và mất luôn chuông R7.
import { pool } from '../../db/pool.js';
import * as itemsRepo from '../workItems/repo.js';
import { LABELS_GIO, same, tronThayDoi } from './changes.js';

/** Giá trị `change_kind` của giỏ. Migration 030 nới CHECK để nhận nó. */
export const LUU_CHO = 'luu-cho';

/**
 * Điều kiện «giỏ đang chờ nằm trong phạm vi này» — dùng chung cho đọc, đóng và xoá.
 *
 * `$1` là id công việc (chỉ khác NULL khi phạm vi là CẢ CÔNG VIỆC, vì giỏ của dòng `works` có
 * `item_id IS NULL`); `$2` là danh sách id các dòng `work_items` trong phạm vi. Hai vế OR này y
 * khuôn `clearPending`/`publishChanges` của `changes.js` — lệch một vế là sót giỏ, mà giỏ sót thì
 * nút «Gửi duyệt» vẫn sáng với những thay đổi không ai gửi.
 */
const TRONG_CAY = `c.change_kind = 'luu-cho' AND c.approved_at IS NULL
     AND (($1::bigint IS NOT NULL AND c.item_id IS NULL AND c.work_id = $1)
          OR c.item_id = ANY($2::bigint[]))`;

/**
 * Phạm vi giỏ của một mục (S3) = CHÍNH NÓ cộng mọi dòng dưới nó.
 *
 * Cấp 1 ⇒ dòng `works` cộng toàn bộ `work_items` của nó; cấp 2 ⇒ bản thân nó cộng các nhiệm vụ
 * con; cấp 3 ⇒ đúng một mình nó (`listDescendants` trả rỗng), tức «màn hình chỉ sửa nhiệm vụ thì
 * chỉ nhiệm vụ thôi» đúng như chỉ đạo.
 *
 * Cố ý KHÔNG dùng `conChauCua` của `service.js`: hàm đó trả về các DÒNG (và với cấp dưới thì
 * không gồm chính dòng gốc), còn giỏ cần đúng hai con số để nhét vào SQL.
 *
 * @param {{kind:string,row:object}} target hình dạng của `mustFind`
 * @returns {Promise<{workId:number|null,itemIds:Array<number>}>}
 */
export async function phamViCay(target, client) {
  if (target.kind === 'work') {
    const items = await itemsRepo.listByWork(target.row.id, {}, client);
    return { workId: Number(target.row.id), itemIds: items.map((r) => Number(r.id)) };
  }
  const con = await itemsRepo.listDescendants(target.row.id, client);
  return { workId: null, itemIds: [Number(target.row.id), ...con.map((r) => Number(r.id))] };
}

const COT = 'id, work_id, item_id, entity_code, entity_name, changes';

/**
 * Mọi giỏ đang chờ trong phạm vi — nguồn dựng popup có ô tick (S4) và là danh sách `guiGio` áp.
 * Sắp `item_id NULLS FIRST` để giỏ của công việc cha luôn đứng đầu popup, đúng thứ tự mắt đọc cây.
 */
export async function gioTrongCay({ workId, itemIds }, client) {
  const { rows } = await client.query(
    `SELECT ${COT} FROM approval_changes c WHERE ${TRONG_CAY}
      ORDER BY c.item_id NULLS FIRST, c.id`,
    [workId ?? null, itemIds ?? []]
  );
  return rows;
}

/**
 * Giỏ đang chờ của ĐÚNG MỘT dòng, CÓ KHOÁ (`FOR UPDATE`).
 *
 * Khoá ở đây chứ không phải lúc đọc cả cây: hai người cùng bấm «Cập nhật» trên một dòng thì lượt
 * sau phải chờ lượt trước commit, nếu không cả hai cùng đọc giỏ rỗng và lượt sau INSERT đè mất
 * lượt trước — unique index sẽ ném 23505 thành lỗi 500 thay vì một câu «đã có giỏ đang chờ».
 */
export async function timGio(workId, itemId, client) {
  const { rows } = await client.query(
    `SELECT ${COT} FROM approval_changes
      WHERE change_kind = 'luu-cho' AND approved_at IS NULL
        AND (($2::bigint IS NULL AND item_id IS NULL AND work_id = $1) OR item_id = $2)
      FOR UPDATE`,
    [workId, itemId ?? null]
  );
  return rows[0] ?? null;
}

/**
 * Diff lượt sửa mới vào giỏ cũ, KÈM GIÁ TRỊ THÔ.
 *
 * `valueFrom`/`valueTo` là phần `tronThayDoi` không cần nhưng giỏ bắt buộc phải có: `from`/`to` là
 * CHUỖI NGƯỜI ĐỌC (tên người, tên phòng) để hiện trong popup, còn lúc gửi thì phải ghi GIÁ TRỊ THÔ
 * vào cột thật. Cùng khuôn `proposeTyLe` của `tyLe.js`.
 *
 * `valueFrom` lấy của lần ĐẦU (`prior?.valueFrom`) theo đúng luật «giữ from lần đầu» — giỏ là
 * gốc → mới nhất, không phải gốc → trung gian.
 */
export function thayDoiTu(gioCu, before, after, client, { patch } = {}) {
  // `after` = `{...before, ...patch}` nên ô KHÔNG GỬI và ô GỬI ĐÚNG GIÁ TRỊ CŨ trông giống hệt:
  // `before[field] === after[field]`. `tronThayDoi` lúc đó `continue` và GIỮ prior — đúng với trục
  // người duyệt (CSDL đã đổi, prior vẫn là A→B cần công bố), SAI với giỏ: CSDL chưa đổi, gửi lại
  // giá trị gốc nghĩa là «bỏ ô này khỏi giỏ». Lọc prior của đúng những ô nằm trong `patch` thì
  // «sửa tiếp ô khác» vẫn giữ tên đang chờ, còn «sửa vòng về gốc» thì xoá.
  let gio = gioCu;
  if (patch) {
    const cham = new Set(Object.keys(patch).filter((f) => Object.hasOwn(LABELS_GIO, f)));
    gio = (gioCu ?? []).filter((c) => !cham.has(c.field) || !same(before[c.field], after[c.field]));
  }
  return tronThayDoi(gio, before, after, client, {
    nhan: LABELS_GIO,
    extra: (field, prior) => ({
      valueFrom: prior ? prior.valueFrom : (before[field] ?? null),
      valueTo: after[field] ?? null,
    }),
  });
}

/**
 * Upsert giỏ của MỘT dòng. `changes` rỗng thì XOÁ giỏ đang chờ.
 *
 * Xoá chứ không giữ giỏ rỗng: sửa vòng về đúng giá trị cũ nghĩa là không còn gì để gửi, mà giỏ rỗng
 * vẫn làm sáng nút «Gửi duyệt» và vẫn gắn badge «có sửa chờ» — một lời hứa không có nội dung.
 *
 * @returns {Promise<number|null>} id giỏ, hoặc `null` khi không còn gì để chờ
 */
export async function ghiGio({ workId, itemId, user, code, name, changes, client }) {
  const old = await timGio(workId, itemId, client);
  if (!changes.length) {
    if (old) await client.query('DELETE FROM approval_changes WHERE id = $1', [old.id]);
    return null;
  }
  if (old) {
    await client.query(
      'UPDATE approval_changes SET changes = $2::jsonb, editor_id = $3, entity_name = $4 WHERE id = $1',
      [old.id, JSON.stringify(changes), user.id, name]
    );
    return old.id;
  }
  const { rows } = await client.query(
    `INSERT INTO approval_changes
       (work_id, item_id, recipient_id, editor_id, entity_code, entity_name, changes, change_kind)
     VALUES ($1,$2,$3,$3,$4,$5,$6::jsonb,'luu-cho') RETURNING id`,
    [workId, itemId ?? null, user.id, code, name, JSON.stringify(changes)]
  );
  return rows[0].id;
}

/**
 * Cắt giỏ còn đúng những thay đổi CHƯA được tick (S4).
 *
 * Phần đã tick thì `guiGio` ghi vào cột thật rồi `dongGio` đóng lại; phần bỏ tick ở nguyên đây để
 * người dùng gửi lượt sau. Hai nửa này phải là HAI thao tác trên cùng một dòng JSON — làm một nửa
 * rồi lỗi giữa chừng thì hoặc mất thay đổi chưa gửi, hoặc gửi lại thay đổi đã duyệt.
 */
export async function catGio(gioId, conLai, client) {
  await client.query('UPDATE approval_changes SET changes = $2::jsonb WHERE id = $1', [
    gioId,
    JSON.stringify(conLai),
  ]);
}

/**
 * Đóng giỏ đã gửi xong: `approved_at = now()`, `decision` để NULL (không ai quyết giỏ này).
 * Đặt `approved_at` là đủ để hai unique index của 029 nhả chỗ cho giỏ kế tiếp.
 */
export async function dongGio(ids, client) {
  if (!ids?.length) return 0;
  const { rowCount } = await client.query(
    `UPDATE approval_changes SET approved_at = now()
      WHERE id = ANY($1::bigint[]) AND change_kind = 'luu-cho' AND approved_at IS NULL`,
    [ids]
  );
  return rowCount;
}

/**
 * Xoá HẲN giỏ theo id — người dùng bấm «Bỏ» trong popup.
 *
 * Vì sao xoá chứ không `dongGio`: `approved_at = now()` nghĩa là «đã gửi và xong», còn giỏ này chưa
 * từng gửi cho ai. Đánh dấu nó là đã duyệt thì sổ `approval_changes` có một dòng nói dối, và người
 * dùng sau này đọc lại «Các lần chỉnh sửa» sẽ thấy một lượt thay đổi chưa từng xảy ra.
 *
 * Lọc thêm `change_kind = 'luu-cho'`: id đến từ thân request, thiếu điều kiện này thì một id đoán
 * được là xoá luôn phiếu duyệt của người khác.
 */
export async function xoaGioId(ids, client) {
  if (!ids?.length) return 0;
  const { rowCount } = await client.query(
    `DELETE FROM approval_changes
      WHERE id = ANY($1::bigint[]) AND change_kind = 'luu-cho' AND approved_at IS NULL`,
    [ids]
  );
  return rowCount;
}

/**
 * Xoá sạch giỏ đang chờ trong phạm vi.
 *
 * Gọi từ `traLaiDeSua`: cả cây vừa bị trả về `Nháp` thì giỏ không còn ý nghĩa — điều kiện mở giỏ
 * (S2) là dòng đang `Đã duyệt`, và một giỏ còn treo trên dòng nháp là một nút «Gửi duyệt» sẽ ghi
 * đè giá trị cũ lên bản nháp người tạo đang soạn lại.
 */
export async function xoaGioCay({ workId, itemIds }, client) {
  const { rowCount } = await client.query(`DELETE FROM approval_changes AS c WHERE ${TRONG_CAY}`, [
    workId ?? null,
    itemIds ?? [],
  ]);
  return rowCount;
}

/**
 * Giỏ của CHÍNH NGƯỜI ĐANG XEM, để vẽ badge «có sửa chờ» trên lưới.
 *
 * Bó theo `recipient_id = user.id` (= người đã lưu) chứ không theo phạm vi đọc: giỏ là việc RIÊNG
 * của người đang soạn, người duyệt không có gì phải làm với nó — thứ họ chờ là phiếu duyệt, và
 * phiếu đó chỉ sinh ra lúc «Gửi duyệt». Đổi lại là không phải dựng thêm một lần xét phạm vi đọc ở
 * đây, tức không tạo nguồn sự thật thứ hai cho `can(user,'read',…)`.
 *
 * Chỉ đọc nên lấy `pool`, không mở giao dịch — cùng khuôn `unreadChanges` của `changes.js`.
 */
export async function gioCuaToi(userId) {
  const { rows } = await pool.query(
    `SELECT ${COT} FROM approval_changes c
      WHERE c.change_kind = 'luu-cho' AND c.approved_at IS NULL AND c.recipient_id = $1
      ORDER BY c.item_id NULLS FIRST, c.id`,
    [userId]
  );
  return rows;
}
