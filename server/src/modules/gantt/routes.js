// Route Gantt — `GET /api/v1/gantt` (§7 việc 6.6). REST MỚI của Phase 6, KHÔNG thêm tên nào
// vào cầu RPC. Trả cây đã nhóm sẵn: frontend chỉ vẽ thanh (việc 6.7/6.8).
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import * as service from './service.js';

const NGAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải dạng yyyy-MM-dd');

const ganttSchema = z.object({
  groupBy: z
    .enum(service.GROUP_MODES, {
      errorMap: () => ({
        message: `groupBy phải là một trong: ${service.GROUP_MODES.join(', ')}`,
      }),
    })
    .default('department'),
  from: NGAY.optional(),
  to: NGAY.optional(),
  departmentIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
});

export const ganttRouter = Router();

ganttRouter.use(requireAuth);

ganttRouter.get('/', validate(ganttSchema, 'query'), async (req, res, next) => {
  try {
    // Không đặt `res.locals.audit` ở route GET — xem lý do ở bootstrap/routes.js (code chết với
    // REST trực tiếp, giẫm đè mốc `rpc.*` của cầu qua subrequest).
    return ok(res, await service.ganttTree(req.user, req.validatedQuery));
  } catch (err) {
    return next(err);
  }
});

export default ganttRouter;
