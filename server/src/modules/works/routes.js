// Route Công việc cấp 1 (§5.2). Vỏ HTTP mỏng: kiểm dữ liệu vào, đổi tên trường camelCase của
// giao diện sang tên cột CSDL, gọi service, đặt tên nhật ký. Không có nghiệp vụ ở đây.
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import { originOf } from '../../utils/origin.js';
import { approvalInput, dateInput, idInput, text } from '../../utils/zodTypes.js';
import * as service from './service.js';

const createSchema = z.object({
  name: text(500).min(1, 'Vui lòng nhập tên công việc'),
  description: text(5000).optional(),
  managerId: idInput,
  managerName: text(200).optional(),
  departmentId: idInput,
  startDate: dateInput,
  endDate: dateInput,
  status: text(50).optional(),
  approvalStatus: approvalInput,
  rejectReason: text(2000).optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

// PATCH: mọi trường đều tuỳ chọn, kể cả tên — không truyền thì không ghi (§5.2).
const updateSchema = createSchema.partial();

const querySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Tháng phải theo dạng YYYY-MM')
    .optional(),
  departmentId: idInput,
  managerId: idInput,
  approvalStatus: approvalInput,
});

const copySchema = z.object({ name: text(500).optional() });

// Nhật ký có thể dài (một công việc sống cả năm): cho gọi số dòng, chặn trên ở 1000 để một request
// không kéo cả bảng về.
const historySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

/** camelCase của giao diện → tên cột CSDL. Chỉ những khoá người dùng thực sự gửi được ghi. */
function toRow(body) {
  const map = {
    name: 'name',
    description: 'description',
    managerId: 'manager_id',
    managerName: 'manager_name',
    departmentId: 'department_id',
    startDate: 'start_date',
    endDate: 'end_date',
    status: 'status',
    approvalStatus: 'approval_status',
    rejectReason: 'reject_reason',
    sortOrder: 'sort_order',
  };
  const row = {};
  for (const [key, column] of Object.entries(map)) {
    if (Object.hasOwn(body, key)) row[column] = body[key];
  }
  return row;
}

export const worksRouter = Router();

worksRouter.use(requireAuth);

worksRouter.get('/', validate(querySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.validatedQuery ?? {};
    const rows = await service.list(req.user, {
      month: q.month,
      departmentId: q.departmentId,
      managerId: q.managerId,
      approvalStatus: q.approvalStatus,
    });
    return ok(res, { works: rows, total: rows.length });
  } catch (err) {
    return next(err);
  }
});

worksRouter.get('/:id', async (req, res, next) => {
  try {
    const work = await service.getOne(req.user, req.params.id);
    // `originInfo` để giao diện hiện ngay "ai đăng ký / ai giao đầu tiên" mà không cần gọi thêm
    // /history (§2.3).
    return ok(res, { work, originInfo: originOf(work) });
  } catch (err) {
    return next(err);
  }
});

/** Nhật ký từ đầu của một công việc: dòng tạo + mọi lần chỉnh sửa (§2.3, §5.2). */
worksRouter.get('/:id/history', validate(historySchema, 'query'), async (req, res, next) => {
  try {
    const limit = req.validatedQuery?.limit;
    return ok(res, await service.history(req.user, req.params.id, { limit }));
  } catch (err) {
    return next(err);
  }
});

worksRouter.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const { work, warnings } = await service.create(req.user, toRow(req.body));
    res.locals.audit = {
      action: 'works.create',
      entityType: 'work',
      entityId: work.id,
      workId: work.id,
      // Dòng đầu của nhật ký: lập lúc nào, ai lập, tự đăng ký hay được giao (§2.3). KHÔNG đưa cả
      // req.body vào — nhật ký chỉ nhận những trường đã chọn tay.
      details: {
        code: work.code,
        name: work.name,
        origin: work.origin,
        createdByName: work.created_by_name,
        assignedByName: work.assigned_by_name,
      },
    };
    return ok(res, { work, warnings, originInfo: originOf(work) });
  } catch (err) {
    return next(err);
  }
});

worksRouter.patch('/:id', validate(updateSchema), async (req, res, next) => {
  try {
    const { work, warnings, changes } = await service.update(
      req.user,
      req.params.id,
      toRow(req.body)
    );
    res.locals.audit = {
      action: 'works.update',
      entityType: 'work',
      entityId: work.id,
      workId: work.id,
      // `changes` do service tính từ dòng TRƯỚC và SAU khi ghi, dạng { cột: { from, to } } — đây là
      // thứ làm nên mục "các lần chỉnh sửa". Không đổi gì thì không ghi khoá nào.
      details: changes ? { code: work.code, changes } : { code: work.code },
    };
    return ok(res, { work, warnings });
  } catch (err) {
    return next(err);
  }
});

worksRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await service.remove(req.user, req.params.id);
    res.locals.audit = {
      action: 'works.remove',
      entityType: 'work',
      details: { code: result.deletedWork, deletedCount: result.deletedCount },
    };
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
});

worksRouter.post('/:id/copy', validate(copySchema), async (req, res, next) => {
  try {
    const result = await service.copy(req.user, req.params.id, { name: req.body.name ?? null });
    res.locals.audit = {
      action: 'works.copy',
      entityType: 'work',
      entityId: result.work.id,
      details: { from: req.params.id, copiedCount: result.copiedCount },
    };
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
});

export default worksRouter;
