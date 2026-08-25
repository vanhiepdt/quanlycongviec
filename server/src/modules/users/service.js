// Nghiệp vụ người dùng / nhân sự (§7 việc 5.11). Vỏ HTTP không có logic nào.
//
// Ba chỗ khác bản Sheets, mỗi chỗ sửa một lỗ thật:
//  1. Mật khẩu băm bcrypt, không lưu thuần. Form cũ gửi mật khẩu (hoặc chuỗi rỗng khi sửa);
//     chuỗi rỗng lúc SỬA nghĩa là "giữ nguyên" — cột `password_hash` NOT NULL, không được ghi rỗng.
//  2. Vai trò form (`Admin` / `Quản lý`) ánh xạ sang đúng CHECK `users_role_valid`
//     (`admin` / `Quản lý công việc`). REST vẫn nhận đủ 6 vai của CSDL.
//  3. Ghi chỉ admin (§6). Không nới quyền.
import { withTransaction } from '../../db/pool.js';
import { can } from '../../middleware/rbac.js';
import { AppError, conflict, notFound } from '../../utils/errors.js';
import { withPgErrors } from '../../utils/pgError.js';
import * as authRepo from '../auth/repo.js';
import { publicUser } from '../auth/service.js';
import { assertPasswordUsable, hashPassword, UNUSABLE_HASH } from '../auth/password.js';
import * as deptRepo from '../departments/repo.js';
import * as repo from './repo.js';

/** 6 vai trò của CHECK `users_role_valid`. */
export const DB_ROLES = Object.freeze([
  'admin',
  'Phó Giám đốc',
  'Trưởng phòng',
  'Phó phòng',
  'Quản lý công việc',
  'Nhân viên',
]);

/** Nhãn form cũ → giá trị CSDL. Form chỉ có 4 ô; 2 vai Trưởng/Phó phòng gán qua `deptRole`. */
export const FORM_ROLE_MAP = Object.freeze({
  Admin: 'admin',
  'Quản lý': 'Quản lý công việc',
});

const DEPT_ROLES = new Set(['Trưởng phòng', 'Phó phòng', 'Nhân viên']);

function assertCan(user, action, row = null) {
  const verdict = can(user, action, 'user', row);
  if (!verdict.ok) throw new AppError(verdict.code, verdict.message);
}

async function mustFind(ref, client = null) {
  const row = await repo.findByRef(ref, client);
  if (!row) throw notFound(`Không tìm thấy người dùng "${ref}"`);
  return row;
}

/** Người trong danh sách nhân sự: `publicUser` thêm `notes` (cột Sheets "Ghi chú"). */
export function publicStaff(row) {
  return { ...publicUser(row), notes: row.notes ?? '' };
}

/**
 * Đổi nhãn form (`Admin`, `Quản lý`) sang vai CSDL. Giá trị đã đúng CHECK thì giữ nguyên.
 * Trả `undefined` khi không gửi — PATCH không đụng cột.
 */
export function mapRole(value) {
  if (value === undefined) return undefined;
  const trimmed = String(value ?? '').trim();
  if (trimmed === '') {
    throw new AppError('VALIDATION_ERROR', 'Phân quyền không được để trống', { field: 'role' });
  }
  const mapped = FORM_ROLE_MAP[trimmed] ?? trimmed;
  if (!DB_ROLES.includes(mapped)) {
    throw new AppError('VALIDATION_ERROR', `Phân quyền "${trimmed}" không hợp lệ`, {
      field: 'role',
    });
  }
  return mapped;
}

function mapDeptRole(value) {
  if (value === undefined) return undefined;
  const trimmed = String(value ?? '').trim();
  if (trimmed === '') return null;
  if (!DEPT_ROLES.has(trimmed)) {
    throw new AppError('VALIDATION_ERROR', `Vai trò phòng "${trimmed}" không hợp lệ`, {
      field: 'deptRole',
    });
  }
  return trimmed;
}

/**
 * Phòng: nhận id số (`departmentId`) hoặc tên (`department`) như form cũ.
 * Chuỗi rỗng / null = chưa phân phòng. Tên không có → 400, không im lặng bỏ.
 */
async function resolveDepartmentId(input, client = null) {
  if (Object.hasOwn(input, 'department_id')) {
    const id = input.department_id;
    if (id == null) return null;
    const row = await deptRepo.findById(id, client);
    if (!row) {
      throw new AppError('VALIDATION_ERROR', `Không tìm thấy phòng id ${id}`, {
        field: 'departmentId',
      });
    }
    return row.id;
  }
  if (Object.hasOwn(input, 'department')) {
    const name = String(input.department ?? '').trim();
    if (name === '') return null;
    const row = await deptRepo.findByName(name, client);
    if (!row) {
      throw new AppError('VALIDATION_ERROR', `Không tìm thấy phòng "${name}"`, {
        field: 'department',
      });
    }
    return row.id;
  }
  return undefined;
}

function objectTypeOf(input, fallback = 'Người dùng') {
  if (!Object.hasOwn(input, 'object_type')) return fallback;
  const trimmed = String(input.object_type ?? '').trim();
  return trimmed === '' ? fallback : trimmed;
}

function isSupplier(objectType) {
  return objectType === 'Nhà cung cấp';
}

function emailOrEmpty(value) {
  if (value === undefined) return undefined;
  return repo.normalizeEmail(value);
}

function placeholderEmail(code) {
  return `${String(code).toLowerCase()}@khong-dang-nhap.invalid`;
}

async function assertEmailFree(email, exceptId = null, client = null) {
  if (!email) return;
  const existing = await repo.findByEmail(email, client);
  if (existing && existing.id !== exceptId) {
    throw conflict('Email đã được sử dụng', 'email');
  }
}

async function assertNotLastAdmin(row, nextRole, actionLabel) {
  if (row.role !== 'admin') return;
  if (nextRole === 'admin') return;
  const n = await repo.countByRole('admin');
  if (n <= 1) {
    throw conflict(`Không thể ${actionLabel} admin cuối cùng của hệ thống`);
  }
}

export async function list(user) {
  assertCan(user, 'read');
  const rows = await repo.listAll();
  return rows.map(publicStaff);
}

export async function getOne(user, ref) {
  const row = await mustFind(ref);
  assertCan(user, 'read', row);
  return publicStaff(row);
}

export async function create(user, input) {
  assertCan(user, 'create');
  const fullName = String(input.full_name ?? '').trim();
  if (!fullName) {
    throw new AppError('VALIDATION_ERROR', 'Tên nhân viên là bắt buộc.', { field: 'name' });
  }
  const role = mapRole(input.role ?? 'Nhân viên');
  const objectType = objectTypeOf(input);
  const deptRole = mapDeptRole(Object.hasOwn(input, 'dept_role') ? input.dept_role : 'Nhân viên');
  const departmentId = await resolveDepartmentId(input);
  let email = emailOrEmpty(input.email);
  if (email === '') email = '';

  const passwordPlain = Object.hasOwn(input, 'password') ? String(input.password ?? '') : '';
  let passwordHash;
  let mustChange = true;
  if (passwordPlain === '') {
    if (!isSupplier(objectType)) {
      throw new AppError('VALIDATION_ERROR', 'Vui lòng nhập mật khẩu', { field: 'password' });
    }
    passwordHash = UNUSABLE_HASH;
    mustChange = false;
  } else {
    passwordHash = await hashPassword(assertPasswordUsable(passwordPlain, 'password'));
  }

  return withTransaction(async (client) => {
    const code = await repo.nextUserCode(client);
    if (!email) email = placeholderEmail(code);
    await assertEmailFree(email, null, client);
    const row = await withPgErrors(() =>
      repo.insert(
        {
          code,
          full_name: fullName,
          email,
          password_hash: passwordHash,
          position: input.position ?? '',
          role,
          object_type: objectType,
          department_id: departmentId === undefined ? null : departmentId,
          dept_role: deptRole === undefined ? null : deptRole,
          notes: input.notes ?? '',
          is_active: input.is_active === undefined ? true : input.is_active !== false,
          must_change_password: mustChange,
        },
        client
      )
    );
    return publicStaff(row);
  });
}

export async function update(user, ref, patch) {
  const current = await mustFind(ref);
  assertCan(user, 'update', current);

  const nextRole = Object.hasOwn(patch, 'role') ? mapRole(patch.role) : current.role;
  await assertNotLastAdmin(current, nextRole, 'hạ cấp');

  const objectType = Object.hasOwn(patch, 'object_type')
    ? objectTypeOf(patch, current.object_type)
    : current.object_type;

  const rowPatch = {};
  if (Object.hasOwn(patch, 'full_name')) {
    const fullName = String(patch.full_name ?? '').trim();
    if (!fullName) {
      throw new AppError('VALIDATION_ERROR', 'Tên nhân viên là bắt buộc.', { field: 'name' });
    }
    rowPatch.full_name = fullName;
  }
  if (Object.hasOwn(patch, 'role')) rowPatch.role = nextRole;
  if (Object.hasOwn(patch, 'object_type')) rowPatch.object_type = objectType;
  if (Object.hasOwn(patch, 'position')) rowPatch.position = patch.position ?? '';
  if (Object.hasOwn(patch, 'notes')) rowPatch.notes = patch.notes ?? '';
  if (Object.hasOwn(patch, 'is_active')) rowPatch.is_active = patch.is_active !== false;
  if (Object.hasOwn(patch, 'dept_role')) rowPatch.dept_role = mapDeptRole(patch.dept_role);

  const departmentId = await resolveDepartmentId(patch);
  if (departmentId !== undefined) rowPatch.department_id = departmentId;

  if (Object.hasOwn(patch, 'email')) {
    let email = emailOrEmpty(patch.email);
    if (!email) email = placeholderEmail(current.code);
    rowPatch.email = email;
  }

  const passwordPlain = Object.hasOwn(patch, 'password') ? String(patch.password ?? '') : '';
  const changePassword = Object.hasOwn(patch, 'password') && passwordPlain !== '';

  return withTransaction(async (client) => {
    if (rowPatch.email) await assertEmailFree(rowPatch.email, current.id, client);
    let row = await withPgErrors(() => repo.update(current.id, rowPatch, client));
    if (changePassword) {
      const hash = await hashPassword(assertPasswordUsable(passwordPlain, 'password'));
      row = await repo.setPasswordHash(current.id, hash, client);
      row = await withPgErrors(() =>
        repo.update(current.id, { must_change_password: true }, client)
      );
      await authRepo.deleteOtherSessions(current.id, null, client);
    }
    if (rowPatch.is_active === false) {
      await authRepo.deleteOtherSessions(current.id, null, client);
    }
    return publicStaff(row);
  });
}

export async function remove(user, ref) {
  const current = await mustFind(ref);
  assertCan(user, 'delete', current);
  if (Number(current.id) === Number(user.id)) {
    throw conflict('Không thể xoá chính tài khoản đang đăng nhập');
  }
  await assertNotLastAdmin(current, null, 'xoá');
  await repo.remove(current.id);
  return { deletedUser: current.code };
}

export default { list, getOne, create, update, remove, publicStaff, mapRole, DB_ROLES };
