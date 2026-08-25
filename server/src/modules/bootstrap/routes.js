// `GET /api/v1/bootstrap` — gói dữ liệu đầu trang (việc 5.10).
import { Router } from 'express';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import * as service from './service.js';

export const bootstrapRouter = Router();

bootstrapRouter.use(requireAuth);

bootstrapRouter.get('/', async (req, res, next) => {
  try {
    res.locals.audit = { action: 'bootstrap.get' };
    return ok(res, await service.getBundle(req.user));
  } catch (err) {
    return next(err);
  }
});

export default bootstrapRouter;
