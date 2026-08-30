// Đọc phiên từ cookie và gắn người đăng nhập vào `req`. Chạy TRƯỚC mọi route nghiệp vụ.
//
// Ba việc, tách làm ba middleware để mỗi route lấy đúng phần mình cần:
//   attachSession        — có cookie hợp lệ thì gắn req.user, không có thì đi tiếp (route công khai)
//   requireAuth          — bắt buộc đã đăng nhập
//   requirePasswordChanged — chặn người còn cờ must_change_password (§7 việc 1.8)
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import {
  clearCsrfCookie,
  clearSessionCookie,
  csrfTokenFor,
  readSid,
  setCsrfCookie,
  setSessionCookie,
  SID_COOKIE,
} from '../modules/auth/cookies.js';
import * as authRepo from '../modules/auth/repo.js';
import * as delegations from '../modules/delegations/service.js';
import * as permissionsRepo from '../modules/permissions/repo.js';

export async function attachSession(req, res, next) {
  try {
    const sid = readSid(req.cookies?.[SID_COOKIE]);
    // Không có cookie, hoặc cookie giả/bị sửa: coi như khách. Không đi CSDL (TC-AUTH-07).
    if (!sid) return next();

    const row = await authRepo.findLiveSession(sid);
    if (!row) {
      // Phiên đã hết hạn hoặc đã bị thu hồi: xoá hẳn dòng rác và xoá cookie để lần sau khỏi hỏi
      // lại CSDL (TC-AUTH-08, TC-AUTH-09).
      await authRepo.deleteSession(sid);
      clearSessionCookie(res);
      clearCsrfCookie(res);
      return next();
    }

    req.sessionId = sid;
    req.user = {
      id: row.id,
      code: row.code,
      full_name: row.full_name,
      name: row.full_name,
      email: row.email,
      position: row.position,
      role: row.role,
      object_type: row.object_type,
      department_id: row.department_id,
      dept_role: row.dept_role,
      is_active: row.is_active,
      must_change_password: row.must_change_password,
      managedDepartmentIds: row.managedDepartmentIds ?? [],
      // Ủy quyền có thời hạn (006_delegations.sql): các bản ghi ĐANG hiệu lực cho người này, nạp
      // sẵn ở đây để `can()` vẫn là hàm thuần (không đọc CSDL). Một truy vấn cho mỗi request có
      // phiên, đi cùng đường với `managedDepartmentIds`.
      delegations: [],
      // Nơi `can()` ghi lại id bản ủy quyền đã dùng để một hành động lọt — `middleware/audit.js`
      // đọc mảng này và đưa vào `activity_logs.details.viaDelegationId`. Chỉ có ở req.user; bộ test
      // đơn vị của `can()` không gắn mảng nên hàm vẫn không có tác dụng lề nào ở đó.
      viaDelegationIds: [],
    };

    // Lỗi ở bước này KHÔNG được làm đổ request: không đọc được bảng ủy quyền thì người dùng mất
    // phần quyền MƯỢN, còn quyền tự có vẫn nguyên — hỏng một tính năng phụ, không hỏng đăng nhập.
    try {
      req.user.delegations = await delegations.hieuLucCho(row.id);
    } catch (err) {
      logger.warn({ err: err.message }, 'Không đọc được danh sách ủy quyền');
    }

    // Ghi đè «Bảng phân quyền hệ thống» của vai này (009): `can()` đọc `user.ghiDe` — vẫn thuần.
    // Hỏng bảng ghi đè không làm đổ request: mất phần tùy chỉnh, quyền gốc vẫn nguyên.
    req.user.ghiDe = {};
    try {
      req.user.ghiDe = await permissionsRepo.listByVai(row.role).then((dong) =>
        Object.fromEntries(dong.map((d) => [d.entity_type + ':' + d.action, d.gia_tri]))
      );
    } catch (err) {
      logger.warn({ err: err.message }, 'Không đọc được bảng ghi đè phân quyền');
    }

    // Gia hạn khi còn hoạt động. Lỗi ở bước này KHÔNG được làm đổ request — người dùng vẫn đang
    // đăng nhập hợp lệ, chỉ là hạn phiên không được đẩy ra thêm.
    try {
      const newExpiry = await authRepo.touchSession(sid, env.SESSION_TTL_HOURS);
      if (newExpiry) {
        setSessionCookie(res, sid, new Date(newExpiry));
        setCsrfCookie(res, csrfTokenFor(sid));
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Không gia hạn được phiên');
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return next(new AppError('UNAUTHENTICATED', 'Bạn chưa đăng nhập hoặc phiên đã hết hạn'));
  }
  if (req.user.is_active === false) {
    return next(new AppError('ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hoá'));
  }
  return next();
}

/**
 * Người còn cờ `must_change_password` chỉ được gọi `/api/v1/auth/*`. Đặt middleware này ở gốc
 * `/api` **sau** attachSession và **trước** mọi route nghiệp vụ, không rải vào từng route — rải
 * là kiểu bỏ sót mà bản Sheets đã mắc.
 */
export function requirePasswordChanged(req, res, next) {
  if (req.user?.must_change_password) {
    return next(
      new AppError('MUST_CHANGE_PASSWORD', 'Bạn phải đổi mật khẩu lần đầu trước khi dùng hệ thống')
    );
  }
  return next();
}
