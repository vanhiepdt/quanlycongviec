// Route Công việc con (cấp 2) và Nhiệm vụ (cấp 3) — MỘT bộ route cho cả hai cấp, phân biệt bằng
// `level` trong thân request (§7 việc 3.2). Vỏ HTTP mỏng: kiểm dữ liệu vào, đổi camelCase của giao
// diện sang tên cột CSDL, gọi service, đặt tên nhật ký. Không có nghiệp vụ ở đây.
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import { originOf } from '../../utils/origin.js';
import { approvalInput, dateInput, idInput, requiredText, text } from '../../utils/zodTypes.js';
import { remindersRouter } from '../reminders/routes.js';
import * as service from './service.js';

// `workRef` là mã (`CV001`) hoặc id số của công việc cấp 1 — bắt buộc khi tạo, vì một dòng không
// thể tồn tại ngoài công việc nào.
const createSchema = z.object({
  workRef: z.union([z.string().min(1), z.number().int()]),
  parentRef: z.union([z.string(), z.number().int(), z.null()]).optional(),
  level: z.coerce.number().int().min(2).max(3).optional(),
  name: requiredText('Vui lòng nhập tên công việc con / nhiệm vụ', 500),
  description: text(5000).optional(),
  assigneeId: idInput,
  assigneeName: text(200).optional(),
  // Phân công ba lớp (005_phan_cong.sql): Ban kiểm soát chỉ hợp lệ ở cấp 2; leader của nhiệm vụ
  // tối đa 1 người — nguồn hợp lệ kiểm ở service, CHECK `task_leader_single` là hàng rào cuối.
  supervisorId: idInput,
  leaderIds: z
    .array(idInput)
    .max(50)
    .refine((ids) => ids.every((id) => id == null || Number.isInteger(id)), {
      message: 'Danh sách lãnh đạo phòng phụ trách có mã không hợp lệ',
    })
    .optional(),
  status: text(50).optional(),
  priority: text(50).optional(),
  startDate: dateInput,
  dueDate: dateInput,
  reportDate: dateInput,
  completion: z.coerce.number().int().min(0).max(100).optional(),
  target: text(2000).optional(),
  output: text(2000).optional(),
  notes: text(2000).optional(),
  resultLinks: z.array(text(2000)).max(50).optional(),
  approvalStatus: approvalInput,
  rejectReason: text(2000).optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

// PATCH: mọi trường tuỳ chọn. `workRef` ở đây mang nghĩa "chuyển sang công việc này" (§7 việc 3.4).
const updateSchema = createSchema.partial();

const listSchema = z.object({
  workRef: z.union([z.string().min(1), z.number().int()]),
  level: z.coerce.number().int().min(2).max(3).optional(),
});

const copySchema = z.object({ name: text(500).optional() });

const historySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

/** camelCase của giao diện → tên cột CSDL. Chỉ khoá người dùng thực sự gửi mới được ghi. */
function toRow(body) {
  const map = {
    name: 'name',
    description: 'description',
    assigneeId: 'assignee_id',
    assigneeName: 'assignee_name',
    supervisorId: 'supervisor_id',
    leaderIds: 'leader_ids',
    status: 'status',
    priority: 'priority',
    startDate: 'start_date',
    dueDate: 'due_date',
    reportDate: 'report_date',
    completion: 'completion',
    target: 'target',
    output: 'output',
    notes: 'notes',
    resultLinks: 'result_links',
    approvalStatus: 'approval_status',
    rejectReason: 'reject_reason',
    sortOrder: 'sort_order',
  };
  const row = {};
  for (const [key, column] of Object.entries(map)) {
    if (Object.hasOwn(body, key)) row[column] = body[key];
  }
  // Hai khoá cấu trúc giữ nguyên tên "ref" vì service nhận mã HOẶC id, không nhận id thô.
  if (Object.hasOwn(body, 'parentRef')) row.parentRef = body.parentRef;
  if (Object.hasOwn(body, 'level')) row.level = body.level;
  return row;
}

/** Cấp 2 và cấp 3 là hai loại thực thể khác nhau trong nhật ký, đúng như trong ma trận quyền §6. */
const entityOf = (level) => (Number(level) === 2 ? 'subwork' : 'task');

export const workItemsRouter = Router();

workItemsRouter.use(requireAuth);

/**
 * Nhắc việc treo dưới từng dòng: `/api/v1/work-items/:id/reminders` (§5.2). Gắn ở đây chứ không
 * làm route gốc riêng vì một nhắc việc không tồn tại ngoài nhiệm vụ nào — đường dẫn nói luôn điều
 * đó, và `requireAuth` phía trên phủ sang cả nhánh con.
 */
workItemsRouter.use('/:id/reminders', remindersRouter);

workItemsRouter.get('/', validate(listSchema, 'query'), async (req, res, next) => {
  try {
    const q = req.validatedQuery ?? {};
    const { work, items } = await service.list(req.user, { workRef: q.workRef, level: q.level });
    return ok(res, { work, items, total: items.length });
  } catch (err) {
    return next(err);
  }
});

workItemsRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await service.getOne(req.user, req.params.id);
    return ok(res, { item, originInfo: originOf(item) });
  } catch (err) {
    return next(err);
  }
});

/** Nhật ký từ đầu của một công việc con / nhiệm vụ: dòng tạo + mọi lần chỉnh sửa (§2.3, §5.2). */
workItemsRouter.get('/:id/history', validate(historySchema, 'query'), async (req, res, next) => {
  try {
    const limit = req.validatedQuery?.limit;
    return ok(res, await service.history(req.user, req.params.id, { limit }));
  } catch (err) {
    return next(err);
  }
});

workItemsRouter.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const { item, warnings } = await service.create(req.user, {
      ...toRow(req.body),
      workRef: req.body.workRef,
    });
    res.locals.audit = {
      action: `${entityOf(item.level)}s.create`,
      entityType: entityOf(item.level),
      entityId: item.id,
      workId: item.work_id,
      // Dòng đầu của nhật ký (§2.3). KHÔNG đưa cả `req.body` vào — chỉ những trường chọn tay.
      details: {
        code: item.code,
        name: item.name,
        level: item.level,
        origin: item.origin,
        createdByName: item.created_by_name,
        assignedByName: item.assigned_by_name,
      },
    };
    return ok(res, { item, warnings, originInfo: originOf(item) });
  } catch (err) {
    return next(err);
  }
});

workItemsRouter.patch('/:id', validate(updateSchema), async (req, res, next) => {
  try {
    const { item, moved, parentCleared, changes, warnings } = await service.update(
      req.user,
      req.params.id,
      toRow(req.body),
      // Không gửi `workRef` ⇒ `undefined` ⇒ không chuyển công việc (khác hẳn gửi chuỗi rỗng).
      { targetWorkRef: Object.hasOwn(req.body, 'workRef') ? req.body.workRef : undefined }
    );
    res.locals.audit = {
      action: `${entityOf(item.level)}s.update`,
      entityType: entityOf(item.level),
      entityId: item.id,
      workId: item.work_id,
      // `changes` do service tính giữa dòng TRƯỚC và SAU khi ghi — đây là thứ làm nên mục "các lần
      // chỉnh sửa" của nhật ký. Không đổi gì thì không ghi khoá nào.
      details: changes ? { code: item.code, changes } : { code: item.code },
    };
    return ok(res, { item, moved, parentCleared, warnings });
  } catch (err) {
    return next(err);
  }
});

workItemsRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await service.remove(req.user, req.params.id);
    res.locals.audit = {
      action: 'workItems.remove',
      entityType: 'task',
      details: {
        code: result.deletedItem,
        deletedChildren: result.deletedChildren,
        deletedCount: result.deletedCount,
      },
    };
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
});

workItemsRouter.post('/:id/copy', validate(copySchema), async (req, res, next) => {
  try {
    const result = await service.copy(req.user, req.params.id, { name: req.body.name ?? null });
    res.locals.audit = {
      action: `${entityOf(result.item.level)}s.copy`,
      entityType: entityOf(result.item.level),
      entityId: result.item.id,
      workId: result.item.work_id,
      details: { from: req.params.id, code: result.item.code, copiedCount: result.copiedCount },
    };
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
});

export default workItemsRouter;
