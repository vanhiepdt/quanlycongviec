// Route xuất Excel (§5.2 `GET /api/v1/export/works.xlsx?…`, §7 việc 7.5 + 7.6).
//
// Vỏ HTTP mỏng: kiểm tham số, gọi service, đặt hai header rồi trả Buffer. KHÔNG có `ok(res, …)` ở
// đây — ba đường này trả FILE NHỊ PHÂN, không phải phong bì JSON `{ok:true,data}` (§5.3). Đường
// lỗi thì vẫn là JSON như mọi API khác, vì header chỉ đặt sau khi service đã chạy xong: gặp lỗi
// giữa đường thì `next(err)` còn nguyên quyền ghi phản hồi.
//
// Phạm vi (7.6) KHÔNG kiểm ở đây. Nó nằm trong service, bằng cách gọi đúng hàm lọc của API danh
// sách. Route không được thêm một điều kiện quyền riêng: hai chỗ kiểm quyền là hai chỗ lệch nhau.
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import { idInput } from '../../utils/zodTypes.js';
import * as service from './service.js';
import { MIME_XLSX, taoBuffer } from './workbook.js';

const cayQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Tháng phải theo dạng YYYY-MM')
    .optional(),
  departmentId: idInput,
});

const thongKeQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày bắt đầu phải theo dạng YYYY-MM-DD')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày kết thúc phải theo dạng YYYY-MM-DD')
    .optional(),
  // Nhận cả `?departmentIds=1,2` và `?departmentIds=1&departmentIds=2` — `boLocPhong` tách cả hai
  // kiểu. Ở đây chỉ chặn hình dạng, việc CẮT theo vai là của `boLocPhong`.
  departmentIds: z.union([z.string(), z.array(z.string())]).optional(),
});

/** 'cong-viec' + ngày hôm nay: tên file không dấu để mọi trình duyệt/hệ điều hành nhận đúng. */
function tenFile(goc, now = new Date()) {
  const hai = (n) => String(n).padStart(2, '0');
  const ngay = `${now.getFullYear()}${hai(now.getMonth() + 1)}${hai(now.getDate())}`;
  return `${goc}-${ngay}.xlsx`;
}

function guiFile(res, buf, ten) {
  res.setHeader('Content-Type', MIME_XLSX);
  res.setHeader('Content-Disposition', `attachment; filename="${ten}"`);
  res.setHeader('Content-Length', String(buf.length));
  // File số liệu vừa xuất không được nằm lại trong bộ đệm dùng chung: người kế tiếp trên cùng máy
  // (hoặc proxy) có thể có phạm vi khác.
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).end(buf);
}

export const exportRouter = Router();

exportRouter.use(requireAuth);

/** Mẫu (a) — Công việc 3 tầng có thụt lề. */
exportRouter.get('/works.xlsx', validate(cayQuerySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.validatedQuery ?? {};
    const model = await service.mauCongViec(req.user, {
      month: q.month,
      departmentId: q.departmentId,
    });
    return guiFile(res, await taoBuffer(model), tenFile('cong-viec'));
  } catch (err) {
    return next(err);
  }
});

/** Mẫu (b) — Nhiệm vụ theo người thực hiện. */
exportRouter.get('/tasks.xlsx', validate(cayQuerySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.validatedQuery ?? {};
    const model = await service.mauNhiemVu(req.user, {
      month: q.month,
      departmentId: q.departmentId,
    });
    return guiFile(res, await taoBuffer(model), tenFile('nhiem-vu-theo-nguoi'));
  } catch (err) {
    return next(err);
  }
});

/** Mẫu (c) — Thống kê theo phòng. */
exportRouter.get('/stats.xlsx', validate(thongKeQuerySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.validatedQuery ?? {};
    const model = await service.mauThongKe(req.user, {
      from: q.from,
      to: q.to,
      departmentIds: q.departmentIds,
    });
    return guiFile(res, await taoBuffer(model), tenFile('thong-ke-theo-phong'));
  } catch (err) {
    return next(err);
  }
});

export default exportRouter;
