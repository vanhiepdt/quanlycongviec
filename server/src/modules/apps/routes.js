// Route Quản lý App (§5.2, §7 việc 7.2). Vỏ HTTP mỏng: kiểm dữ liệu vào, gọi service, đặt tên nhật ký.
//
// Ghi chỉ admin — chặn ở service (`assertAdmin`) chứ không phải ở middleware, để lời gọi qua cầu
// RPC đi cùng một cổng với lời gọi REST: hai chỗ chặn là hai bộ luật.
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import { text } from '../../utils/zodTypes.js';
import * as service from './service.js';

/** Danh sách vai trò: mảng, hoặc chuỗi ngăn bằng dấu phẩy của form cũ. Service kiểm từng tên. */
const rolesInput = z.union([z.array(z.string().trim().max(60)), z.string().max(500), z.null()]);

const createSchema = z.object({
  name: text(200).optional(),
  url: text(2000).optional(),
  iconUrl: text(2000).optional(),
  description: text(2000).optional(),
  category: text(120).optional(),
  allowedRoles: rolesInput.optional(),
});

const updateSchema = createSchema.partial();

export const appsRouter = Router();

appsRouter.use(requireAuth);

appsRouter.get('/', async (req, res, next) => {
  try {
    return ok(res, await service.list(req.user));
  } catch (err) {
    return next(err);
  }
});

appsRouter.get('/:id', async (req, res, next) => {
  try {
    return ok(res, { app: await service.getOne(req.user, req.params.id) });
  } catch (err) {
    return next(err);
  }
});

appsRouter.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const app = await service.create(req.user, req.body);
    res.locals.audit = {
      action: 'app.create',
      entityType: 'app',
      entityId: app.id,
      details: { code: app.code, name: app.name, allowedRoles: app.allowed_roles },
    };
    return ok(res, { app }, 201);
  } catch (err) {
    return next(err);
  }
});

appsRouter.patch('/:id', validate(updateSchema), async (req, res, next) => {
  try {
    const { app } = await service.update(req.user, req.params.id, req.body);
    res.locals.audit = {
      action: 'app.update',
      entityType: 'app',
      entityId: app.id,
      details: { code: app.code, name: app.name, allowedRoles: app.allowed_roles },
    };
    return ok(res, { app });
  } catch (err) {
    return next(err);
  }
});

appsRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await service.remove(req.user, req.params.id);
    res.locals.audit = {
      action: 'app.remove',
      entityType: 'app',
      details: { code: result.deletedApp },
    };
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
});

export default appsRouter;
