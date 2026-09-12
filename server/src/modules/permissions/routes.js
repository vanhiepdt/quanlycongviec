// Route «Bảng phân quyền hệ thống» — GET/PUT `/api/v1/permissions`, CHỈ admin (Vòng 9).
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../utils/errors.js';
import * as service from './service.js';
import * as settings from '../systemSettings/service.js';

export const permissionsRouter = Router();

permissionsRouter.use(requireAuth);

function assertAdmin(req) {
  if (req.user?.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'Chỉ Giám đốc (admin) được xem/sửa bảng phân quyền');
  }
}

const ghiDeSchema = z.object({
  vai: z.string().min(1),
  // 014: thêm 'file' — 2 hàng «Nộp kết quả (file nhiệm vụ)» / «Duyệt kết quả (file nhiệm vụ)».
  entityType: z.enum(['work', 'subwork', 'task', 'file']),
  action: z.enum(['read', 'create', 'update', 'delete', 'approve', 'ty-le', 'submit', 'gui-bld']),
  giaTri: z.enum(['mac-dinh', 'cho-phep', 'tu-choi', 'cho-duyet']),
  phamVi: z.enum(['phong', 'tat-ca']).optional(),
});

const putSchema = z.object({
  thayDoi: z.array(ghiDeSchema).min(1).max(200),
});

permissionsRouter.get('/settings', async (req, res, next) => {
  try {
    return ok(res, await settings.read());
  } catch (err) {
    return next(err);
  }
});
permissionsRouter.put('/settings', async (req, res, next) => {
  try {
    assertAdmin(req);
    const result = await settings.update(req.user, req.body);
    res.locals.audit = {
      action: 'settings.update',
      entityType: 'user',
      entityId: req.user.id,
      details: { fields: Object.keys(req.body) },
    };
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
});

permissionsRouter.get('/', async (req, res, next) => {
  try {
    // Mở cho mọi vai đăng nhập: bảng phân quyền không phải dữ liệu mật — người dùng cần biết
    // mình được làm gì. Chỉ PUT mới là admin.
    return ok(res, {
      ...(await service.bangHienTai()),
      phamVi: {
        vai: req.user.role,
        departmentId: req.user.department_id ?? null,
        managedDepartmentIds: req.user.managedDepartmentIds ?? [],
        delegations: req.user.delegations ?? [],
      },
    });
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
