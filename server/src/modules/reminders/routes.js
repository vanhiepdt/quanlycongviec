// Route Nhắc việc — gắn dưới Nhiệm vụ: `/api/v1/work-items/:id/reminders` (§5.2, §7 việc 3.8).
// Vỏ HTTP mỏng: kiểm dữ liệu vào, gọi service, đặt tên nhật ký. Không có nghiệp vụ ở đây.
//
// `mergeParams: true` để lấy được `:id` của nhiệm vụ do router cha bắt — thiếu cờ này thì
// `req.params.id` là `undefined` và mọi request thành 404 "Không tìm thấy ... undefined".
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../middleware/errorHandler.js';
import { validate } from '../../middleware/validate.js';
import { text } from '../../utils/zodTypes.js';
import * as service from './service.js';

// Ngày nhắc là BẮT BUỘC và không nhận chuỗi rỗng — khác `dateInput` (đổi '' thành null) vì cột
// `remind_date` là NOT NULL: để rỗng lọt xuống CSDL thì người dùng nhận 500 thay vì câu tiếng Việt.
const remindDateInput = z
  .string({ required_error: 'Ngày nhắc là bắt buộc' })
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày nhắc phải theo dạng YYYY-MM-DD');

const createSchema = z.object({
  remindDate: remindDateInput,
  content: text(2000).optional(),
});

// PATCH: gửi trường nào sửa trường đó; không gửi gì thì dòng giữ nguyên.
const updateSchema = z.object({
  remindDate: remindDateInput.optional(),
  content: text(2000).optional(),
});

/** Cấp 2 và cấp 3 là hai loại thực thể khác nhau trong nhật ký, đúng như trong ma trận quyền §6. */
const entityOf = (level) => (Number(level) === 2 ? 'subwork' : 'task');

/**
 * Nhật ký của nhắc việc ghi vào ĐẦU VIỆC, không phải vào một loại thực thể riêng: người dùng mở
 * `/work-items/:id/history` là thấy luôn "đã thêm nhắc việc ngày …" trong dòng thời gian của
 * nhiệm vụ (§2.3), thay vì phải tìm ở một nhật ký khác.
 */
const auditFor = (action, item, details) => ({
  action,
  entityType: entityOf(item.level),
  entityId: item.id,
  workId: item.work_id,
  details: { code: item.code, ...details },
});

export const remindersRouter = Router({ mergeParams: true });

remindersRouter.get('/', async (req, res, next) => {
  try {
    const { item, reminders } = await service.list(req.user, req.params.id);
    return ok(res, { item, reminders, total: reminders.length });
  } catch (err) {
    return next(err);
  }
});

remindersRouter.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const { item, reminder, reminders } = await service.create(req.user, req.params.id, {
      remindDate: req.body.remindDate,
      content: req.body.content ?? '',
    });
    res.locals.audit = auditFor('reminders.create', item, {
      reminderId: reminder.id,
      remindDate: reminder.remind_date,
    });
    return ok(res, { reminder, reminders });
  } catch (err) {
    return next(err);
  }
});

remindersRouter.patch('/:reminderId', validate(updateSchema), async (req, res, next) => {
  try {
    const { item, reminder, reminders } = await service.update(
      req.user,
      req.params.id,
      req.params.reminderId,
      req.body
    );
    res.locals.audit = auditFor('reminders.update', item, {
      reminderId: reminder.id,
      remindDate: reminder.remind_date,
    });
    return ok(res, { reminder, reminders });
  } catch (err) {
    return next(err);
  }
});

remindersRouter.delete('/:reminderId', async (req, res, next) => {
  try {
    const result = await service.remove(req.user, req.params.id, req.params.reminderId);
    res.locals.audit = auditFor('reminders.remove', result.item, {
      reminderId: result.deletedId,
      remindDate: result.deletedDate,
    });
    return ok(res, { deletedId: result.deletedId, reminders: result.reminders });
  } catch (err) {
    return next(err);
  }
});

export default remindersRouter;
