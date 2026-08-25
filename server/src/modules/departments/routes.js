// Route phòng — `GET /context` (việc 5.10) + CRUD (việc 5.11).
//
// `GET /context` PHẢI khai trước mọi `/:id`: Express xét theo thứ tự, đặt sau thì
// chữ `context` bị bắt làm mã phòng và người dùng nhận 404.
import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../utils/errors.js';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import { requiredText, text } from '../../utils/zodTypes.js';
import * as assignments from '../assignments/service.js';
import * as bootstrap from '../bootstrap/service.js';
import * as service from './service.js';

const emailsInput = z.union([z.string(), z.array(z.string()), z.null()]).optional();

const createSchema = z.object({
  name: requiredText('Tên phòng là bắt buộc.', 200),
  notes: text(2000).optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  directorEmail: emailsInput,
  directorEmails: emailsInput,
  headEmail: emailsInput,
  headEmails: emailsInput,
  viceEmail: emailsInput,
  viceEmails: emailsInput,
});

const updateSchema = createSchema.partial();

function toInput(body) {
  const map = {
    name: 'name',
    notes: 'notes',
    sortOrder: 'sort_order',
    directorEmail: 'directorEmail',
    directorEmails: 'directorEmails',
    headEmail: 'headEmail',
    headEmails: 'headEmails',
    viceEmail: 'viceEmail',
    viceEmails: 'viceEmails',
  };
  const row = {};
  for (const [key, column] of Object.entries(map)) {
    if (!Object.hasOwn(body, key)) continue;
    if (body[key] === undefined) continue;
    row[column] = body[key];
  }
  return row;
}

export const departmentsRouter = Router();

departmentsRouter.use(requireAuth);

departmentsRouter.get('/context', async (req, res, next) => {
  try {
    return ok(res, await bootstrap.departmentContext(req.user));
  } catch (err) {
    return next(err);
  }
});

departmentsRouter.get('/', async (req, res, next) => {
  try {
    const departments = await service.list(req.user);
    return ok(res, { departments, total: departments.length });
  } catch (err) {
    return next(err);
  }
});

/**
 * Ứng viên phân công cho form (005_phan_cong.sql). `?departmentId=` để trống = "Công việc chung":
 * supervisors = mọi Phó GĐ + admin, leaders = []. Có phòng ⇒ supervisors = Phó GĐ phụ trách
 * phòng đó ∪ admin, leaders = Trưởng/Phó phòng của phòng. Nguồn đọc thẳng
 * department_managers + users, KHÔNG tin danh sách nào gửi lên.
 */
departmentsRouter.get('/assignment-options', async (req, res, next) => {
  try {
    const raw = req.query.departmentId;
    const departmentId =
      raw === undefined || raw === null || String(raw).trim() === '' ? null : Number(raw);
    if (departmentId !== null && !Number.isInteger(departmentId)) {
      throw new AppError('VALIDATION_ERROR', 'Mã phòng không hợp lệ', { field: 'departmentId' });
    }
    return ok(res, await assignments.listCandidates(departmentId));
  } catch (err) {
    return next(err);
  }
});

departmentsRouter.get('/:id', async (req, res, next) => {
  try {
    const department = await service.getOne(req.user, req.params.id);
    return ok(res, { department });
  } catch (err) {
    return next(err);
  }
});

departmentsRouter.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const department = await service.create(req.user, toInput(req.body));
    res.locals.audit = {
      action: 'departments.create',
      entityType: 'department',
      entityId: department.id,
      details: { code: department.code, name: department.name },
    };
    return ok(res, { department });
  } catch (err) {
    return next(err);
  }
});

departmentsRouter.patch('/:id', validate(updateSchema), async (req, res, next) => {
  try {
    const department = await service.update(req.user, req.params.id, toInput(req.body));
    res.locals.audit = {
      action: 'departments.update',
      entityType: 'department',
      entityId: department.id,
      details: { code: department.code },
    };
    return ok(res, { department });
  } catch (err) {
    return next(err);
  }
});

departmentsRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await service.remove(req.user, req.params.id);
    res.locals.audit = {
      action: 'departments.remove',
      entityType: 'department',
      details: { code: result.deletedDepartment },
    };
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
});

export default departmentsRouter;
