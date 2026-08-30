// Route «Bảng phân quyền hệ thống» — GET/PUT `/api/v1/permissions`, CHỈ admin (Vòng 9).
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../utils/errors.js';
import * as service from './service.js';

export const permissionsRouter = Router();

permissionsRouter.use(requireAuth);

function assertAdmin(req) {
  if (req.user?.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'Chỉ Giám đốc (admin) được xem/sửa bảng phân quyền');
  }
}

const ghiDeSchema = z.object({
  vai: z.string().min(1),
  entityType: z.enum(['work', 'subwork', 'task']),
  action: z.enum(['read', 'create', 'update', 'delete', 'approve']),
  giaTri: z.enum(['mac-dinh', 'cho-phep', 'tu-choi', 'cho-duyet']),
  phamVi: z.enum(['phong', 'tat-ca']).optional(),
});

const putSchema = z.object({
  thayDoi: z.array(ghiDeSchema).min(1).max(200),
});

permissionsRouter.get('/', async (req, res, next) => {
  try {
    // Mở cho mọi vai đăng nhập: bảng phân quyền không phải dữ liệu mật — người dùng cần biết
    // mình được làm gì. Chỉ PUT mới là admin.
    return ok(res, await service.bangHienTai());
  } catch (err) {
    return next(err);
  }
});

permissionsRouter.put('/', validate(putSchema), async (req, res, next) => {
  try {
    assertAdmin(req);
    const ghiDe = await service.luuGhiDe(req.user, req.body.thayDoi);
    res.locals.audit = {
      action: 'permissions.update',
      entityType: 'user',
      entityId: req.user.id,
      details: { count: req.body.thayDoi.length },
    };
    return ok(res, { ghiDe });
  } catch (err) {
    return next(err);
  }
});

export default permissionsRouter;
