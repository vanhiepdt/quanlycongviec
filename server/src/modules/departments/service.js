// Nghiệp vụ phòng (§7 việc 5.11). Vỏ HTTP không có logic nào.
//
// `department_managers` thay ba cột email cách nhau dấu ';' của sheet "Phòng". Form vẫn gửi
// chuỗi email (`director` / `head` / `vice`); service đổi sang id người, không lưu chuỗi.
// Email không có trong hệ thống → 400 tiếng Việt, không bỏ qua im lặng (bản cũ lưu nguyên
// chuỗi nên D10 phải tô cam; máy chủ mới từ chối để không mất quyền duyệt vì một email gõ sai).
import { withTransaction } from '../../db/pool.js';
import { can } from '../../middleware/rbac.js';
import { AppError, conflict, notFound } from '../../utils/errors.js';
import { withPgErrors } from '../../utils/pgError.js';
import * as usersRepo from '../users/repo.js';
import * as repo from './repo.js';

const MANAGER_FIELDS = Object.freeze({
  deputy_director: ['directorEmails', 'directorEmail'],
  head: ['headEmails', 'headEmail'],
  vice: ['viceEmails', 'viceEmail'],
});

function assertCan(user, action, row = null) {
  const verdict = can(user, action, 'department', row);
  if (!verdict.ok) throw new AppError(verdict.code, verdict.message);
}

async function mustFind(ref, client = null) {
  const row = await repo.findByRef(ref, client);
  if (!row) throw notFound(`Không tìm thấy phòng "${ref}"`);
  return row;
}

/** Tách chuỗi email cách nhau `;` / `,` — cùng luật `parseEmailListClient` của `app.js`. */
export function parseEmails(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap((v) => parseEmails(v));
  return String(value)
    .split(/[;,]/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item !== '');
}

export function groupManagerEmails(managers) {
  const map = new Map();
  for (const row of managers) {
    if (!map.has(row.department_id)) {
      map.set(row.department_id, { deputy_director: [], head: [], vice: [] });
    }
    const bucket = map.get(row.department_id);
    if (Object.hasOwn(bucket, row.role) && row.email) bucket[row.role].push(row.email);
  }
  return map;
}

/** Hình REST mà bootstrap / RPC / CRUD dùng chung. */
export function toPublic(row, managerEmailsByDeptId) {
  const grouped = managerEmailsByDeptId.get(row.id) ?? {
    deputy_director: [],
    head: [],
    vice: [],
  };
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sortOrder: row.sort_order,
    notes: row.notes ?? '',
    directorEmails: grouped.deputy_director,
    headEmails: grouped.head,
    viceEmails: grouped.vice,
  };
}

async function publicOf(row, client = null) {
  const managers = await repo.listManagers(row.id, client);
  return toPublic(row, groupManagerEmails(managers));
}

function emailsFromInput(input, role) {
  const [pluralKey, singularKey] = MANAGER_FIELDS[role];
  if (Object.hasOwn(input, pluralKey)) return parseEmails(input[pluralKey]);
  if (Object.hasOwn(input, singularKey)) return parseEmails(input[singularKey]);
  return undefined;
}

async function resolveUsersByEmails(emails, field) {
  const users = [];
  for (const email of emails) {
    const row = await usersRepo.findByEmail(email);
    if (!row) {
      throw new AppError('VALIDATION_ERROR', `Không tìm thấy người dùng với email "${email}"`, {
        field,
      });
    }
    users.push(row);
  }
  return users;
}

async function replaceManagers(departmentId, input, client) {
  for (const role of repo.MANAGER_ROLES) {
    const emails = emailsFromInput(input, role);
    if (emails === undefined) continue;
    const field = MANAGER_FIELDS[role][1];
    const people = await resolveUsersByEmails(emails, field);
    await repo.clearManagers(departmentId, role, client);
    for (const person of people) {
      await repo.addManager(departmentId, person.id, role, client);
    }
  }
}

async function assertNameFree(name, exceptId = null, client = null) {
  const existing = await repo.findByName(name, client);
  if (existing && existing.id !== exceptId) {
    throw conflict(`Phòng "${name}" đã tồn tại.`, 'name');
  }
}

export async function list(user) {
  assertCan(user, 'read');
  const [rows, managers] = await Promise.all([repo.listAll(), repo.listAllManagers()]);
  const grouped = groupManagerEmails(managers);
  return rows.map((row) => toPublic(row, grouped));
}

export async function getOne(user, ref) {
  const row = await mustFind(ref);
  assertCan(user, 'read', row);
  return publicOf(row);
}

export async function create(user, input) {
  assertCan(user, 'create');
  const name = String(input.name ?? '').trim();
  if (!name) {
    throw new AppError('VALIDATION_ERROR', 'Tên phòng là bắt buộc.', { field: 'name' });
  }
  const created = await withTransaction(async (client) => {
    await assertNameFree(name, null, client);
    const row = await withPgErrors(() =>
      repo.insert(
        {
          name,
          sort_order: input.sort_order ?? 99,
          notes: input.notes ?? '',
        },
        client
      )
    );
    await replaceManagers(row.id, input, client);
    return publicOf(row, client);
  });
  return created;
}

export async function update(user, ref, patch) {
  const current = await mustFind(ref);
  assertCan(user, 'update', current);

  const rowPatch = {};
  if (Object.hasOwn(patch, 'name')) {
    const name = String(patch.name ?? '').trim();
    if (!name) {
      throw new AppError('VALIDATION_ERROR', 'Tên phòng là bắt buộc.', { field: 'name' });
    }
    rowPatch.name = name;
  }
  if (Object.hasOwn(patch, 'sort_order')) rowPatch.sort_order = patch.sort_order;
  if (Object.hasOwn(patch, 'notes')) rowPatch.notes = patch.notes ?? '';

  return withTransaction(async (client) => {
    if (rowPatch.name) await assertNameFree(rowPatch.name, current.id, client);
    const row = await withPgErrors(() => repo.update(current.id, rowPatch, client));
    await replaceManagers(current.id, patch, client);
    return publicOf(row, client);
  });
}

/**
 * Xoá phòng. Chặn nếu còn người thuộc phòng — câu tiếng Việt giữ nguyên bản cũ.
 *
 * FK `users.department_id` là ON DELETE SET NULL nên CSDL *sẽ* cho xoá; chặn phải nằm ở đây,
 * nếu không người dùng mất phòng trên giấy tờ mà không có lỗi nào hiện ra (D8).
 */
export async function remove(user, ref) {
  const current = await mustFind(ref);
  assertCan(user, 'delete', current);
  const n = await usersRepo.countByDepartmentId(current.id);
  if (n > 0) {
    throw conflict(
      `Còn ${n} người thuộc phòng "${current.name}". Chuyển họ sang phòng khác trước khi xoá.`
    );
  }
  await repo.remove(current.id);
  return { deletedDepartment: current.code };
}

export default {
  list,
  getOne,
  create,
  update,
  remove,
  toPublic,
  groupManagerEmails,
  parseEmails,
};
