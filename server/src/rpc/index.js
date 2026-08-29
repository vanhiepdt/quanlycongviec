// Cầu tương thích `/api/rpc/:name` (§5.1) — lớp CÓ THỜI HẠN.
//
// Giao diện cũ gọi backend bằng `google.script.run.tênHàm(...)`. Thay vì sửa 3653 dòng frontend,
// `web/assets/js/api-bridge.js` đổi mọi lời gọi đó thành `POST /api/rpc/<tên>` với thân
// `{args: [...]}`, còn file này dịch ngược lại thành lời gọi route `/api/v1/*` thật.
//
// Ba điều bắt buộc, mỗi điều đều đã từng là lỗ hổng thật:
//  1. `authenticateUser` PHẢI đi qua `loginRateLimiter` — cùng một bộ đếm với `/v1/auth/login`.
//     Không gắn thì cầu RPC trở thành đường vòng thoát khỏi chặn dò mật khẩu (nợ từ Phase 1).
//  2. Không có route "chung" nào bắt tên lạ: tên không có trong bảng trả 404 với câu nói rõ tên
//     nào sai, KHÔNG trả 200 rỗng.
//  3. Thân phản hồi giữ hình dạng CŨ (`{success:true, …}`) bọc trong `data` của §5.3 — giao diện
//     cũ đọc `response.success`, đổi hình dạng là vỡ 28 chỗ gọi.
import { Router } from 'express';
import * as bootstrapService from '../modules/bootstrap/service.js';
import * as departmentsRepo from '../modules/departments/repo.js';
import * as remindersRepo from '../modules/reminders/repo.js';
import { ok } from '../middleware/errorHandler.js';
import { loginRateLimiter } from '../middleware/rateLimit.js';
import { AppError } from '../utils/errors.js';
import { callV1OrThrow } from './subrequest.js';
import { RPC_TABLE } from './table.js';

/** Đối số của lời gọi cũ luôn là một mảng; nhận cả `{args: …}` lẫn mảng trần cho dễ gỡ lỗi bằng curl. */
function argsOf(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.args)) return body.args;
  if (body?.args !== undefined) return [body.args];
  return [];
}

/** Những thứ handler cần mà không phải một lời gọi route: bảng tra phòng, nhắc việc theo lô. */
function makeContext(v1Router, req, res) {
  let deptCache = null;
  return {
    req,
    res,
    call: (method, path, body = {}, query = {}) =>
      callV1OrThrow(v1Router, req, res, { method, path, body, query }),

    /** Map `department_id → tên phòng`. Repo công việc không join bảng phòng, mà giao diện cũ đọc
     *  cột "Phòng" bằng chữ. Bảng phòng nhỏ nên nạp một lần mỗi request là đủ. */
    async deptNameById() {
      if (!deptCache) {
        const rows = await departmentsRepo.listAll();
        deptCache = new Map(rows.map((row) => [row.id, row.name]));
      }
      return deptCache;
    },

    /** Nhắc việc của nhiều dòng trong MỘT truy vấn. */
    remindersByItemIds: (ids) => remindersRepo.mapByItemIds(ids),

    /**
     * Cây (works + items kèm nhắc việc) mà người đang gọi được thấy — MỘT bộ truy vấn
     * (`cayChoUser` của bootstrap). Dành riêng cho `getTasks` để hết nợ N+1: trước đây handler
     * quét từng công việc một lời gọi `/work-items` (§13.5 · §8.5 C6).
     */
    visibleTree: () => bootstrapService.cayChoUser(req.user),

    /**
     * Đổi SỐ THỨ TỰ nhắc việc của bản cũ thành `reminderId` thật.
     * Thứ tự lấy từ chính route REST (`ORDER BY remind_date, id`) nên khớp với thứ tự người dùng
     * đang thấy trên màn hình.
     */
    async reminderIdByIndex(taskRef, index) {
      const data = await callV1OrThrow(v1Router, req, res, {
        method: 'GET',
        path: `/work-items/${encodeURIComponent(taskRef)}/reminders`,
      });
      const list = data.reminders ?? [];
      const position = Number(index);
      if (!Number.isInteger(position) || position < 0 || position >= list.length) {
        throw new AppError('NOT_FOUND', 'Không tìm thấy nhắc việc cần sửa (danh sách đã đổi)', {
          field: 'reminderIndex',
        });
      }
      return list[position].id;
    },
  };
}

/**
 * @param {Function} v1Router router `/api/v1` — truyền vào chứ không import để chỉ có MỘT bản
 *   thứ tự middleware (`/auth` → `requirePasswordChanged` → route nghiệp vụ), xem `app.js`.
 */
export function createRpcRouter(v1Router) {
  const router = Router();

  // Gắn TRƯỚC route chung. `next()` của route này rơi xuống `/:name` ngay dưới.
  router.post('/authenticateUser', loginRateLimiter, (req, res, next) => next());

  router.post('/:name', async (req, res, next) => {
    const name = req.params.name;
    const entry = RPC_TABLE[name];
    if (!entry) {
      return next(new AppError('NOT_FOUND', `Không có hàm «${name}» ở máy chủ`, { status: 404 }));
    }
    // Tên chưa có nghiệp vụ: 501 kèm tên chức năng bằng tiếng Việt (§5.3).
    const mocAudit = { action: `rpc.${name}` };
    res.locals.audit = mocAudit;
    try {
      const data = await entry.handler(argsOf(req.body), makeContext(v1Router, req, res));
      // Lời gọi RPC chỉ xứng đáng một dòng nhật ký khi BÊN TRONG nó có route GHI thật chạy qua —
      // route GHI tự đặt `res.locals.audit` MỚI với tên nghiệp vụ (works.create…, TC-RPC-21).
      // Mốc còn nguyên ⇒ lời ĐỌC (getDataForUser, getDepartmentContext, …): mỗi lần mở trang gọi
      // cả chục lượt mà cứ ghi thì «Hoạt động gần đây» đầy rác `rpc.*` (người dùng 2026-08-29).
      if (res.locals.audit === mocAudit) res.locals.skipAudit = true;
      return ok(res, data);
    } catch (err) {
      return next(err);
    }
  });

  // GET để soi bảng ánh xạ khi gỡ lỗi: tên nào đã có nghiệp vụ, tên nào chưa, và đi route nào.
  router.get('/', (req, res) =>
    ok(res, {
      total: Object.keys(RPC_TABLE).length,
      functions: Object.entries(RPC_TABLE).map(([name, entry]) => ({
        name,
        rest: entry.rest ?? null,
        implemented: !entry.notImplemented,
      })),
    })
  );

  return router;
}

export default createRpcRouter;
