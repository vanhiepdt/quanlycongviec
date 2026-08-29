// Route thống kê — `/api/v1/stats/*` (§5.2, §7 việc 6.1–6.3). Vỏ HTTP mỏng: kiểm query bằng
// zod, gọi service, đặt tên nhật ký. Đây là REST MỚI của Phase 6 — KHÔNG thêm tên nào vào
// cầu RPC 37 tên (đề nghị/chat/app còn 501 là chuyện Phase 7).
//
// Ba đường, cùng một bộ lọc `from/to/departmentIds` (việc 6.4/6.5):
//   GET /stats/summary                     — 4 thẻ số + tỷ lệ (chỉ cấp 3)
//   GET /stats/charts?type=<6 loại>        — {labels,data} đúng hình dạng Chart.js đang nhận
//   GET /stats/activities?page=&limit=     — hoạt động gần đây CÓ PHÂN TRANG
//
// `departmentIds` nhận dạng "1,2,3" (một lần) hoặc lặp lại (?departmentIds=1&departmentIds=2)
// — zod gộp mảng. Ai được chọn nhiều phòng do SERVICE quyết (TC-STAT-10), route không tin.
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import * as service from './service.js';

const NGAY = z
  .string({ required_error: 'Thiếu ngày' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải dạng yyyy-MM-dd');

/** `from`/`to` tuỳ chọn; thiếu một trong hai thì không lọc theo khoảng (TC-STAT-09). */
const boLocSchema = {
  from: NGAY.optional(),
  to: NGAY.optional(),
  departmentIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
};

const summarySchema = z.object(boLocSchema);

const chartsSchema = z.object({
  type: z.enum(service.CHART_TYPES, {
    errorMap: () => ({
      message: `type phải là một trong: ${service.CHART_TYPES.join(', ')}`,
    }),
  }),
  ...boLocSchema,
});

const activitiesSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const statsRouter = Router();

statsRouter.use(requireAuth);

statsRouter.get('/summary', validate(summarySchema, 'query'), async (req, res, next) => {
  try {
    // Route GET không đặt `res.locals.audit` — xem lý do ở bootstrap/routes.js.
    return ok(res, await service.summary(req.user, req.validatedQuery));
  } catch (err) {
    return next(err);
  }
});

statsRouter.get('/charts', validate(chartsSchema, 'query'), async (req, res, next) => {
  try {
    // Route GET không đặt `res.locals.audit` — xem lý do ở bootstrap/routes.js.
    return ok(res, await service.charts(req.user, req.validatedQuery.type, req.validatedQuery));
  } catch (err) {
    return next(err);
  }
});

statsRouter.get('/activities', validate(activitiesSchema, 'query'), async (req, res, next) => {
  try {
    // Route GET không đặt `res.locals.audit` — xem lý do ở bootstrap/routes.js.
    return ok(res, await service.activities(req.user, req.validatedQuery));
  } catch (err) {
    return next(err);
  }
});

export default statsRouter;
