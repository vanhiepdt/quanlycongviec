// Nghiệp vụ xác thực: đăng nhập, đăng xuất, đổi mật khẩu. Không biết gì về Express — nhận dữ
// liệu thuần, trả dữ liệu thuần, ném `AppError`. Vỏ HTTP nằm ở `routes.js`.
import { env } from '../../config/env.js';
import { withTransaction } from '../../db/pool.js';
import { AppError } from '../../utils/errors.js';
import * as usersRepo from '../users/repo.js';
import { newSessionId, csrfTokenFor } from './cookies.js';
import { assertPasswordUsable, hashPassword, verifyPassword } from './password.js';
import * as repo from './repo.js';

// Băm giả để so cả khi email không tồn tại. Nhờ vậy thời gian trả lời của "email không có" và
// "mật khẩu sai" gần như nhau — không dò ra được email nào đang tồn tại (TC-AUTH-02).
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.Xr0i4S0lCMDPl1oXCxHF2qHzKPDCJmC';

const SAME_MESSAGE = 'Email hoặc mật khẩu không đúng';

const invalidCredentials = () => new AppError('INVALID_CREDENTIALS', SAME_MESSAGE);

function lockedError(lockedUntil) {
  const minutes = Math.max(1, Math.ceil((new Date(lockedUntil) - Date.now()) / 60000));
  return new AppError(
    'ACCOUNT_LOCKED',
    `Tài khoản đang bị tạm khoá do đăng nhập sai nhiều lần. Thử lại sau ${minutes} phút.`
  );
}

/** Bỏ các cột không được ra khỏi máy chủ trước khi trả về cho frontend. */
function publicUser(row) {
  return {
    id: row.id,
    code: row.code,
    full_name: row.full_name,
    email: row.email,
    position: row.position,
    role: row.role,
    object_type: row.object_type,
    department_id: row.department_id,
    dept_role: row.dept_role,
    is_active: row.is_active,
    must_change_password: row.must_change_password,
  };
}

export { publicUser };

/**
 * Đăng nhập.
 *
 * Thứ tự kiểm là có chủ ý: **khoá tài khoản trước, mật khẩu sau, `is_active` sau cùng**.
 *  - Khoá trước: đang khoá thì mật khẩu đúng cũng không vào được (TC-AUTH-05).
 *  - `is_active` sau khi mật khẩu đã đúng: người nhập sai mật khẩu chỉ nhận được câu chung, nên
 *    không dò được tài khoản nào đang tồn tại mà bị vô hiệu hoá (TC-AUTH-06).
 */
export async function login({ email, password, ip = null, userAgent = '' }) {
  const user = await usersRepo.findAuthByEmail(email);

  if (!user) {
    await verifyPassword(String(password ?? 'x'), DUMMY_HASH);
    throw invalidCredentials();
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw lockedError(user.locked_until);
  }

  const okPassword = await verifyPassword(String(password ?? ''), user.password_hash);
  if (!okPassword) {
    const after = await usersRepo.recordFailedLogin(user.id, {
      windowMinutes: env.LOGIN_LOCKOUT_MINUTES,
      maxAttempts: env.LOGIN_MAX_ATTEMPTS,
    });
    if (after?.locked_until) throw lockedError(after.locked_until);
    throw invalidCredentials();
  }

  if (user.is_active === false) {
    throw new AppError(
      'ACCOUNT_DISABLED',
      'Tài khoản đã bị vô hiệu hoá, liên hệ quản trị hệ thống'
    );
  }

  const sid = newSessionId();
  const session = await withTransaction(async (client) => {
    await usersRepo.clearFailedLogins(user.id, client);
    return repo.createSession(
      { id: sid, userId: user.id, ttlHours: env.SESSION_TTL_HOURS, ip, userAgent },
      client
    );
  });

  return { user: publicUser(user), session, csrfToken: csrfTokenFor(sid) };
}

export function logout(sid) {
  return sid ? repo.deleteSession(sid) : Promise.resolve(0);
}

/**
 * Đổi mật khẩu. Bắt nhập mật khẩu cũ, tối thiểu 8 ký tự, và **thu hồi mọi phiên khác** để
 * người đang dùng tài khoản đó ở máy khác bị đẩy ra (TC-AUTH-13).
 */
export async function changePassword({ userId, currentPassword, newPassword, keepSid = null }) {
  const next = assertPasswordUsable(newPassword);
  const currentHash = await usersRepo.findPasswordHash(userId);
  if (!currentHash) throw new AppError('NOT_FOUND', 'Không tìm thấy người dùng');

  if (!(await verifyPassword(String(currentPassword ?? ''), currentHash))) {
    throw new AppError('VALIDATION_ERROR', 'Mật khẩu hiện tại không đúng', {
      field: 'currentPassword',
    });
  }
  if (await verifyPassword(next, currentHash)) {
    throw new AppError('VALIDATION_ERROR', 'Mật khẩu mới phải khác mật khẩu hiện tại', {
      field: 'newPassword',
    });
  }

  const passwordHash = await hashPassword(next);
  return withTransaction(async (client) => {
    const updated = await usersRepo.updatePassword(userId, passwordHash, client);
    const revoked = await repo.deleteOtherSessions(userId, keepSid ?? null, client);
    return { user: publicUser(updated), revokedSessions: revoked };
  });
}
