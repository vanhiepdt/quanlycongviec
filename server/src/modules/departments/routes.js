// Route phòng — việc 5.10 mới cần `GET /context`; CRUD nằm ở việc 5.11.
//
// `GET /context` PHẢI khai trước mọi `/:id` sau này: Express xét theo thứ tự, đặt sau thì
// chữ `context` bị bắt làm mã phòng và người dùng nhận 404.
import { Router } from 'express';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import * as bootstrap from '../bootstrap/service.js';

export const departmentsRouter = Router();

departmentsRouter.use(requireAuth);

departmentsRouter.get('/context', async (req, res, next) => {
  try {
    return ok(res, await bootstrap.departmentContext(req.user));
  } catch (err) {
    return next(err);
  }
});

export default departmentsRouter;
