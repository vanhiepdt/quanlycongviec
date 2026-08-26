// Route Người dùng (§5.2, việc 5.11). Vỏ HTTP mỏng: kiểm dữ liệu, đổi camelCase → cột CSDL,
// gọi service, đặt tên nhật ký. Không có nghiệp vụ ở đây.
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import { idInput, requiredText, text } from '../../utils/zodTypes.js';
import * as service from './service.js';

const optionalBool = z
  .union([z.boolean(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null || v === '') return undefined;
    if (v === true || v === 'true' || v === '1') return true;
    if (v === false || v === 'false' || v === '0') return false;
    return undefined;
  });

const createSchema = z.object({
  name: requiredText('Tên nhân viên là bắt buộc.', 200).optional(),
  fullName: text(200).optional(),
  email: text(200).optional(),
  password: z.string().max(200).optional(),
  position: text(200).optional(),
  role: text(80).optional(),
  objectType: text(80).optional(),
  departmentId: idInput,
  department: text(200).optional(),
  deptRole: text(80).optional(),
  notes: text(2000).optional(),
  isActive: optionalBool,
});

const updateSchema = createSchema.partial();

/** camelCase của giao diện → tên cột / khoá service. */
function toInput(body) {
  const map = {
    name: 'full_name',
    fullName: 'full_name',
    email: 'email',
    password: 'password',
    position: 'position',
    role: 'role',
    objectType: 'object_type',
    departmentId: 'department_id',
    department: 'department',
    deptRole: 'dept_role',
    notes: 'notes',
    isActive: 'is_active',
  };
  const row = {};
  for (const [key, column] of Object.entries(map)) {
    if (!Object.hasOwn(body, key)) continue;
    if (body[key] === undefined) continue;
    row[column] = body[key];
  }
  return row;
}

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get('/', async (req, res, next) => {
  try {
    const people = await service.list(req.user);
    return ok(res, { people, total: people.length });
  } catch (err) {
    return next(err);
  }
});

usersRouter.get('/:id', async (req, res, next) => {
  try {
    const person = await service.getOne(req.user, req.params.id);
    return ok(res, { person });
  } catch (err) {
    return next(err);
  }
});

usersRouter.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const person = await service.create(req.user, toInput(req.body));
    res.locals.audit = {
      action: 'users.create',
      entityType: 'user',
      entityId: person.id,
      details: { code: person.code, name: person.full_name, role: person.role },
    };
    return ok(res, { person });
  } catch (err) {
    return next(err);
  }
});

usersRouter.patch('/:id', validate(updateSchema), async (req, res, next) => {
  try {
    const person = await service.update(req.user, req.params.id, toInput(req.body));
    res.locals.audit = {
      action: 'users.update',
      entityType: 'user',
      entityId: person.id,
      details: { code: person.code },
    };
    return ok(res, { person });
  } catch (err) {
    return next(err);
  }
});

usersRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await service.remove(req.user, req.params.id);
    res.locals.audit = {
      action: 'users.remove',
      entityType: 'user',
      details: { code: result.deletedUser },
    };
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
});

export default usersRouter;
