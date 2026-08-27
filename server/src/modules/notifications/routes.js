// Route Thông báo (§5.2 `POST /api/v1/notifications`).
//
// Chỉ có ĐƯỜNG TẠO, đúng một dòng của §5.2. Đọc thông báo (hộp thông báo / badge trên giao diện)
// chưa có đường REST nào vì giao diện cũ chưa từng vẽ danh sách thông báo — `repo.listByUser`,
// `repo.countUnread`, `repo.markRead` đã có sẵn, chờ phase nào thêm chuông thông báo thì mở route,
// không thêm sớm để §5.2 và mã nguồn không lệch nhau (xem §13.4).
//
// Chặn quyền nằm ở service (`assertAdmin`), KHÔNG ở middleware: lời gọi qua cầu RPC và lời gọi REST
// phải đi cùng một cổng, hai chỗ chặn là hai bộ luật.
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import { text } from '../../utils/zodTypes.js';
import * as service from './service.js';

/** Người nhận: id, mã nhân sự, email hay họ tên — service dò ra `user_id`. Trống = tất cả. */
const recipientInput = z.union([z.string().trim().max(200), z.number(), z.null()]);

const createSchema = z.object({
  content: text(5000).optional(),
  recipient: recipientInput.optional(),
  type: text(60).optional(),
});

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const result = await service.create(req.user, req.body);
    res.locals.audit = {
      action: 'notification.create',
      entityType: 'notification',
      entityId: result.notifications[0]?.id ?? null,
      // KHÔNG ghi `content` vào nhật ký: thông báo có thể chứa chuyện nội bộ, mà nhật ký thì ai
      // đọc được nhật ký cũng thấy. Chỉ ghi số người nhận và loại.
      details: {
        total: result.total,
        type: result.notifications[0]?.type ?? '',
        toAll: result.toAll,
      },
    };
    return ok(res, { notifications: result.notifications, total: result.total }, 201);
  } catch (err) {
    return next(err);
  }
});

export default notificationsRouter;
