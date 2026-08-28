// Route Ủy quyền — `/api/v1/delegations` (§5 của `docs/KE-HOACH-UY-QUYEN.md`).
//
// Chặn quyền nằm ở service, KHÔNG ở middleware: lời gọi qua cầu RPC và lời gọi REST phải đi cùng
// một cổng — cùng lý do như `notifications/routes.js`.
//
// `DELETE /:id` là HUỶ MỀM (`status='cancelled'`), không xoá dòng: nhật ký hoạt động lưu
// `delegation_id`, xoá dòng là biến các dòng nhật ký đó thành mã số không tra được nữa.
//
// `POST /:id/accept` và `POST /:id/decline` là câu trả lời của NGƯỜI ĐƯỢC ỦY QUYỀN (§13.4 mục 20):
// bản ghi mới tạo ở trạng thái `pending` và chưa cho mượn quyền gì cho tới khi họ đồng ý.
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

// Người NHẬN trả lời đề nghị ủy quyền (§13.4 mục 20). Hai đường riêng chứ không phải
// `PATCH /:id {status}`: `PATCH` là cổng của NGƯỜI ỦY QUYỀN (sửa hạn, ghi chú, phạm vi), còn hai
// đường này của người nhận. Trộn chung thì một lời `PATCH` phải tự đoán ai đang gọi để chọn luật.
//
// KHÔNG thêm tên nào vào cầu RPC (đang chốt đúng 37 tên): trình duyệt gọi thẳng REST qua `restGhi`.
delegationsRouter.post('/:id/accept', async (req, res, next) => {
  try {
    const result = await service.accept(req.user, req.params.id);
    res.locals.audit = {
      action: 'delegations.accept',
      entityType: 'delegation',
      entityId: result.delegation.id,
      details: { changed: result.changed, status: result.delegation.status },
    };
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
});

delegationsRouter.post('/:id/decline', async (req, res, next) => {
  try {
    const result = await service.decline(req.user, req.params.id);
    res.locals.audit = {
      action: 'delegations.decline',
      entityType: 'delegation',
      entityId: result.delegation.id,
      details: { changed: result.changed, status: result.delegation.status },
    };
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
});

export default delegationsRouter;
