// `GET /api/v1/bootstrap` — gói dữ liệu đầu trang (việc 5.10).
import { Router } from 'express';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import * as service from './service.js';

export const bootstrapRouter = Router();

bootstrapRouter.use(requireAuth);

bootstrapRouter.get('/', async (req, res, next) => {
  try {
    // KHÔNG đặt `res.locals.audit` ở route GET: middleware `audit` chỉ ghi với phương thức GHI nên
    // dòng này là code chết với lời gọi REST trực tiếp; nhưng khi đi QUA CẦU RPC (subrequest dùng
    // CHUNG `res.locals`) nó giẫm đè mốc của cầu và biến mỗi lần mở trang thành một dòng rác
    // `bootstrap.get` trong «Hoạt động gần đây» (người dùng 2026-08-29).
    return ok(res, await service.getBundle(req.user));
  } catch (err) {
    return next(err);
  }
});

export default bootstrapRouter;
