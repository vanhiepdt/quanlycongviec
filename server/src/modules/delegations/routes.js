// Route Ủy quyền — `/api/v1/delegations` (§5 của `docs/KE-HOACH-UY-QUYEN.md`).
//
// Chặn quyền nằm ở service, KHÔNG ở middleware: lời gọi qua cầu RPC và lời gọi REST phải đi cùng
// một cổng — cùng lý do như `notifications/routes.js`.
//
// `DELETE /:id` là HUỶ MỀM (`status='cancelled'`), không xoá dòng: nhật ký hoạt động lưu
// `delegation_id`, xoá dòng là biến các dòng nhật ký đó thành mã số không tra được nữa.
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import { text } from '../../utils/zodTypes.js';
import * as service from './service.js';

/** Người dùng nhận id, mã nhân sự, email hay họ tên — service dò ra `user_id`. */
const userRef = z.union([z.string().trim().max(200), z.number()]);
/** Mảng mã phòng; thiếu hẳn ⇒ "theo phòng người ủy quyền đang phụ trách" (xem repo). */
const deptIds = z.union([z.array(z.union([z.number(), z.string()])), z.null()]).optional();

const createSchema = z.object({
  fromUserId: userRef.optional(),
  toUserId: userRef.optional(),
  to: userRef.optional(),
  fromDate: z.string().trim().max(10),
  toDate: z.string().trim().max(10),
  departmentIds: deptIds,
  note: text(1000).optional(),
});

const updateSchema = z.object({
  toDate: z.string().trim().max(10).optional(),
  departmentIds: deptIds,
  note: text(1000).optional(),
});

export const delegationsRouter = Router();

delegationsRouter.use(requireAuth);

delegationsRouter.get('/', async (req, res, next) => {
  try {
    const all = String(req.query.all ?? '') === '1';
    return ok(res, await service.list(req.user, { all }));
  } catch (err) {
    return next(err);
  }
});

delegationsRouter.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const { delegation } = await service.create(req.user, req.body);
    res.locals.audit = {
      action: 'delegations.create',
      entityType: 'delegation',
      entityId: delegation.id,
      // KHÔNG ghi `note` (có thể chứa lý do đi công tác — chuyện riêng của người ta). Ghi đủ để
      // đối chiếu về sau: ai cho ai, khoảng nào, phạm vi mấy phòng.
      details: {
        fromUserId: delegation.from_user_id,
        toUserId: delegation.to_user_id,
        fromDate: String(delegation.from_date),
        toDate: String(delegation.to_date),
        departmentIds: delegation.department_ids ?? [],
      },
    };
    return ok(res, { delegation }, 201);
  } catch (err) {
    return next(err);
  }
});

delegationsRouter.patch('/:id', validate(updateSchema), async (req, res, next) => {
  try {
    const { delegation } = await service.update(req.user, req.params.id, req.body);
    res.locals.audit = {
      action: 'delegations.update',
      entityType: 'delegation',
      entityId: delegation.id,
      details: {
        toDate: String(delegation.to_date),
        departmentIds: delegation.department_ids ?? [],
      },
    };
    return ok(res, { delegation });
  } catch (err) {
    return next(err);
  }
});

delegationsRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await service.cancel(req.user, req.params.id);
    res.locals.audit = {
      action: 'delegations.cancel',
      entityType: 'delegation',
      entityId: result.delegation.id,
      details: { cancelled: result.cancelled },
    };
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
});

export default delegationsRouter;
