// Route Chat nội bộ (§5.2, §7 việc 7.3).
//
// `GET /chat?since=` là đường mà giao diện hỏi lại mỗi 10 giây. Vì tần suất đó, route KHÔNG làm gì
// ngoài đọc: không ghi nhật ký kiểm toán cho lần đọc (mỗi người 6 dòng/phút sẽ nhấn chìm
// `activity_logs`), chỉ ghi khi GỬI.
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import * as service from './service.js';

const sendSchema = z.object({
  message: z.string().max(5000),
});

export const chatRouter = Router();

chatRouter.use(requireAuth);

chatRouter.get('/', async (req, res, next) => {
  try {
    return ok(res, await service.list(req.user, { since: req.query.since ?? null }));
  } catch (err) {
    return next(err);
  }
});

chatRouter.post('/', validate(sendSchema), async (req, res, next) => {
  try {
    const message = await service.send(req.user, req.body.message);
    res.locals.audit = {
      action: 'chat.send',
      entityType: 'chat_message',
      entityId: message.id,
      details: { length: message.message.length },
    };
    return ok(res, { message }, 201);
  } catch (err) {
    return next(err);
  }
});

export default chatRouter;
