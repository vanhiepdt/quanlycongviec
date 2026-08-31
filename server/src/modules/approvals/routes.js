// Route luồng duyệt — `/api/v1/approvals/*` (§5.2, §7 việc 5.2/5.3/5.5).
// Vỏ HTTP mỏng: kiểm dữ liệu vào, gọi service, đặt tên nhật ký. Không có nghiệp vụ ở đây.
//
// Đường dẫn theo đúng §5.2: `POST /approvals/:entity/:id/{submit,approve,reject}` và
// `GET /approvals/pending-count`. `pending-count` PHẢI khai trước `/:entity/...` — Express xét
// theo thứ tự, đặt sau thì `pending-count` bị bắt làm `:entity`.
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import * as service from './service.js';

// Lý do từ chối: chặn trên 2000 ký tự cho khớp cột `reject_reason`. Chặn dưới do service lo
// (`DO_DAI_LY_DO_TOI_THIEU`) để cầu RPC cũng chịu cùng một luật, không chỉ đường REST này.
const rejectSchema = z.object({
  reason: z.string({ required_error: 'Vui lòng nhập lý do từ chối' }).max(2000),
});

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const approvalsRouter = Router();

approvalsRouter.use(requireAuth);

/** Con số của badge (việc 5.5). Giao diện gọi lại đường này sau MỖI lần duyệt. */
approvalsRouter.get('/pending-count', async (req, res, next) => {
  try {
    return ok(res, await service.pendingCount(req.user));
  } catch (err) {
    return next(err);
  }
});

/** Hộp "chờ bạn duyệt": danh sách mục đang treo trong phạm vi người đang xem. */
approvalsRouter.get('/pending', validate(listSchema, 'query'), async (req, res, next) => {
  try {
    const items = await service.pendingList(req.user, { limit: req.validatedQuery?.limit });
    return ok(res, { items, total: items.length });
  } catch (err) {
    return next(err);
  }
});

/**
 * Nhật ký của cả ba hành động ghi vào chính đầu việc, không vào một loại thực thể riêng: mở
 * `/works/:id/history` là thấy luôn "đã duyệt / bị từ chối vì …" trong dòng thời gian (§2.3).
 */
function auditFor(action, result, details = {}) {
  const isWork = result.kind === 'work';
  return {
    action,
    entityType: isWork ? 'work' : result.row.level === 2 ? 'subwork' : 'task',
    entityId: result.row.id,
    workId: isWork ? result.row.id : result.row.work_id,
    details: {
      code: result.row.code,
      approvalStatus: result.row.approval_status,
      notified: result.notified,
      ...details,
    },
  };
}

approvalsRouter.post('/:entity/:id/submit', async (req, res, next) => {
  try {
    const result = await service.submit(req.user, req.params.entity, req.params.id);
    res.locals.audit = auditFor('approvals.submit', result, { soCon: result.soCon ?? 0 });
    return ok(res, { row: result.row, soCon: result.soCon ?? 0, notified: result.notified });
  } catch (err) {
    return next(err);
  }
});

approvalsRouter.post('/:entity/:id/approve', async (req, res, next) => {
  try {
    const result = await service.approve(req.user, req.params.entity, req.params.id);
    res.locals.audit = auditFor('approvals.approve', result, { soCon: result.soCon ?? 0 });
    return ok(res, { row: result.row, soCon: result.soCon ?? 0, notified: result.notified });
  } catch (err) {
    return next(err);
  }
});

approvalsRouter.post('/:entity/:id/reject', validate(rejectSchema), async (req, res, next) => {
  try {
    const result = await service.reject(
      req.user,
      req.params.entity,
      req.params.id,
      req.body.reason
    );
    // Lý do KHÔNG vào nhật ký: nó đã nằm ở cột `reject_reason` của chính dòng đó, và nhật ký chỉ
    // nhận những trường chọn tay (xem `middleware/audit.js`). TỪ 012 mục bị từ chối bị XOÁ HẲN nên
    // cột đó không còn — ghi thêm số mục đã mất để nhật ký nói được chuyện gì đã xảy ra.
    res.locals.audit = auditFor('approvals.reject', result, {
      daXoa: true,
      deletedCount: 1 + (result.soCon ?? 0),
    });
    return ok(res, {
      row: result.row,
      daXoa: true,
      deletedCodes: result.deletedCodes ?? [],
      soCon: result.soCon ?? 0,
      notified: result.notified,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * TRẢ LẠI ĐỂ SỬA (012, Vòng 13) — cửa mềm giữa Duyệt và Từ chối: cả cây về bản nháp của người tạo,
 * không mất dữ liệu. Ghi chú bắt buộc như lý do từ chối, và cũng đi qua `rejectSchema` vì cả hai
 * đều ghi vào cột `reject_reason` (chặn trên 2000 ký tự); chặn dưới 10 ký tự do service lo.
 */
approvalsRouter.post('/:entity/:id/return', validate(rejectSchema), async (req, res, next) => {
  try {
    const result = await service.traLaiDeSua(
      req.user,
      req.params.entity,
      req.params.id,
      req.body.reason
    );
    res.locals.audit = auditFor('approvals.return', result, { soCon: result.soCon ?? 0 });
    return ok(res, { row: result.row, soCon: result.soCon ?? 0, notified: result.notified });
  } catch (err) {
    return next(err);
  }
});

export default approvalsRouter;
