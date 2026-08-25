// Nghiệp vụ Nhắc việc (§7 việc 3.8, mục C9/C10).
//
// Chia việc với CSDL: quy tắc "chỉ Nhiệm vụ cấp 3 mới đặt được nhắc việc" nằm ở trigger
// `trg_reminders_only_level3` (001_init.sql:232). Ở đây KHÔNG kiểm lại `level`, chỉ ghi rồi để
// `withPgErrors` dịch lỗi 23514 của trigger thành `REMINDER_ON_SUBWORK` ⇒ 409 (TC-TREE-28). Viết
// lại cùng quy tắc ở JS là tạo nguồn sự thật thứ hai, mà chỉ nguồn ở CSDL là không thể lách.
//
// Hai chỗ khác bản cũ, mỗi chỗ sửa một lỗi thật:
//  1. **Quyền**: bản cũ chỉ cho `admin` thêm/sửa/xoá nhắc việc ("Chỉ Admin mới có quyền thêm nhắc
//     việc", Code.gs.moi:2136). Quyết định của người dùng (§13.4 mục 13): **admin + Trưởng phòng /
//     Phó phòng CỦA PHÒNG ĐÓ**. Nhắc việc là công cụ điều hành của lãnh đạo phòng, không phải ghi
//     chú cá nhân của người thực hiện — nên KHÔNG dùng "ai sửa được nhiệm vụ thì đặt được", vì thế
//     thì Nhân viên tự nhắc việc của mình được (giả định cũ của Phase 3, đã bị thay).
//     Xem `assertCanManage`: đọc thì mở theo §6, còn ghi thì hẹp hơn ma trận §6.
//  2. **Nhắc việc phải thuộc đúng nhiệm vụ trong đường dẫn**: sửa/xoá theo `reminderId` mà không
//     đối chiếu `work_item_id` thì người có quyền trên nhiệm vụ A xoá được nhắc việc của nhiệm vụ
//     B chỉ bằng cách đổi số trong URL.
import { withTransaction } from '../../db/pool.js';
import { can } from '../../middleware/rbac.js';
import { AppError, notFound } from '../../utils/errors.js';
import { withPgErrors } from '../../utils/pgError.js';
import * as itemsRepo from '../workItems/repo.js';
import * as repo from './repo.js';

/** Cấp 2 và cấp 3 là hai loại thực thể khác nhau trong ma trận quyền §6. */
const entityOf = (level) => (Number(level) === itemsRepo.LEVEL_SUBWORK ? 'subwork' : 'task');

function assertCan(user, action, item) {
  const verdict = can(user, action, entityOf(item.level), item);
  if (!verdict.ok) throw new AppError(verdict.code, verdict.message);
}

/** Hai vai được đặt nhắc việc trong phòng mình (§13.4 mục 13). `admin` xét riêng: không theo phòng. */
const VAI_DAT_NHAC_VIEC = Object.freeze(['Trưởng phòng', 'Phó phòng']);

/**
 * Cổng ghi của nhắc việc — HẸP HƠN ma trận §6, cố ý.
 *
 * Gọi `can(..., 'update', ...)` trước để giữ đúng các mã lỗi chung (`UNAUTHENTICATED`,
 * `ACCOUNT_DISABLED`, vai trò lạ) và để `inScope()` lo phần "đúng phòng mình" — nhờ vậy Trưởng
 * phòng của phòng KHÁC bị chặn ở đó, không cần so `department_id` lần thứ hai ở đây.
 *
 * Sau đó siết theo vai: `Phó Giám đốc` và `Quản lý công việc` **không** đặt được nhắc việc dù §6
 * cho họ sửa nhiệm vụ, và `Nhân viên` không tự nhắc việc của mình được. Muốn nới cho `Phó Giám
 * đốc` thì thêm vai vào `VAI_DAT_NHAC_VIEC` và đảo 2 phép kiểm trong `reminders-api.test.js`.
 */
function assertCanManage(user, item) {
  assertCan(user, 'update', item);
  if (user.role === 'admin' || VAI_DAT_NHAC_VIEC.includes(user.role)) return;
  throw new AppError(
    'FORBIDDEN',
    'Chỉ Admin, Trưởng phòng hoặc Phó phòng của phòng đó mới đặt được nhắc việc'
  );
}

/** Dòng cấp 2/cấp 3 trong đường dẫn; không có thì 404. */
async function mustFindItem(ref, client = null) {
  const row = await itemsRepo.findByRefWithWork(ref, client);
  if (!row) throw notFound(`Không tìm thấy công việc con/nhiệm vụ "${ref}"`);
  return row;
}

/** Nhắc việc phải tồn tại VÀ thuộc đúng dòng trong đường dẫn — xem lý do 2 ở đầu file. */
async function mustFindReminder(id, item, client = null) {
  const numeric = Number(id);
  const row =
    Number.isInteger(numeric) && numeric > 0 ? await repo.findById(numeric, client) : null;
  if (!row || Number(row.work_item_id) !== Number(item.id)) {
    throw notFound(`Không tìm thấy nhắc việc "${id}" của ${item.code}`);
  }
  return row;
}

/** Nhắc việc của một nhiệm vụ, xếp theo ngày nhắc — đúng thứ tự bản cũ sắp lại sau mỗi lần thêm. */
export async function list(user, itemRef) {
  const item = await mustFindItem(itemRef);
  assertCan(user, 'read', item);
  return { item, reminders: await repo.listByItem(item.id) };
}

/**
 * Thêm một nhắc việc. Trả về CẢ danh sách sau khi thêm, đúng như `addTaskReminder` bản cũ trả
 * `reminders` — giao diện vẽ lại nguyên danh sách chứ không tự chèn thêm dòng.
 */
export function create(user, itemRef, { remindDate, content = '' }) {
  return withTransaction(async (client) => {
    const item = await mustFindItem(itemRef, client);
    assertCanManage(user, item);
    const reminder = await withPgErrors(() =>
      repo.insert({ workItemId: item.id, remindDate, content, createdBy: user?.id ?? null }, client)
    );
    return { item, reminder, reminders: await repo.listByItem(item.id, client) };
  });
}

/** Sửa ngày hoặc nội dung một nhắc việc. Không gửi trường nào thì không ghi gì. */
export function update(user, itemRef, reminderId, patch = {}) {
  return withTransaction(async (client) => {
    const item = await mustFindItem(itemRef, client);
    assertCanManage(user, item);
    const before = await mustFindReminder(reminderId, item, client);
    const reminder = await withPgErrors(() => repo.update(before.id, patch, client));
    return { item, reminder, reminders: await repo.listByItem(item.id, client) };
  });
}

export function remove(user, itemRef, reminderId) {
  return withTransaction(async (client) => {
    const item = await mustFindItem(itemRef, client);
    assertCanManage(user, item);
    const reminder = await mustFindReminder(reminderId, item, client);
    await repo.remove(reminder.id, client);
    return {
      item,
      deletedId: reminder.id,
      deletedDate: reminder.remind_date,
      reminders: await repo.listByItem(item.id, client),
    };
  });
}
