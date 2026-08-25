// Nghiệp vụ Nhắc việc (§7 việc 3.8, mục C9/C10).
//
// Chia việc với CSDL: quy tắc "chỉ Nhiệm vụ cấp 3 mới đặt được nhắc việc" nằm ở trigger
// `trg_reminders_only_level3` (001_init.sql:232). Ở đây KHÔNG kiểm lại `level`, chỉ ghi rồi để
// `withPgErrors` dịch lỗi 23514 của trigger thành `REMINDER_ON_SUBWORK` ⇒ 409 (TC-TREE-28). Viết
// lại cùng quy tắc ở JS là tạo nguồn sự thật thứ hai, mà chỉ nguồn ở CSDL là không thể lách.
//
// Hai chỗ khác bản cũ, mỗi chỗ sửa một lỗi thật:
//  1. **Quyền**: bản cũ chỉ cho `admin` thêm/sửa/xoá nhắc việc ("Chỉ Admin mới có quyền thêm nhắc
//     việc", Code.gs.moi:2136) — người thực hiện không tự đặt nổi lời nhắc cho việc của mình.
//     Nhắc việc là một phần của nhiệm vụ, nên quyền ở đây là quyền **sửa chính nhiệm vụ đó** theo
//     ma trận §6: ai sửa được nhiệm vụ thì đặt được nhắc việc cho nó.
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
    assertCan(user, 'update', item);
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
    assertCan(user, 'update', item);
    const before = await mustFindReminder(reminderId, item, client);
    const reminder = await withPgErrors(() => repo.update(before.id, patch, client));
    return { item, reminder, reminders: await repo.listByItem(item.id, client) };
  });
}

export function remove(user, itemRef, reminderId) {
  return withTransaction(async (client) => {
    const item = await mustFindItem(itemRef, client);
    assertCan(user, 'update', item);
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
