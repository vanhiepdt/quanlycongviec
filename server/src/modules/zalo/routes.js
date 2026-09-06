// Route ZALO của người dùng (017): xem trạng thái, lấy mã liên kết, bỏ liên kết.
//
// Ba đường REST **không có tên RPC** tương ứng — cầu tương thích giữ đúng 37 tên (§5.2, bảng «REST
// không có tên RPC»): đây là tính năng mới của Phase 8, không có hành động cũ nào trong Apps Script
// cần bắc cầu.
//
// `requireAuth` chặn ở đây thay vì service tự kiểm tra, khác với notifications (chặn trong service)
// vì module này KHÔNG có đường nào qua cầu RPC — chỉ một cổng REST, một chỗ chặn là đủ.
//
// KHÔNG đặt `res.locals.audit`: service đã ghi thẳng vào `activity_logs` (`zalo.bo-lien-ket`,
// `zalo.lien-ket`) — đặt thêm ở đây sẽ nhân đôi dòng nhật ký cho cùng một hành động.
import { Router } from 'express';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import * as service from './service.js';

export const zaloRouter = Router();

zaloRouter.use(requireAuth);

// Trạng thái cho khối «Thông báo Zalo» trên trang cá nhân: máy chủ có bật không, nhận tin bằng
// cách nào, mình đã liên kết chưa. KHÔNG trả `chat_id` — xem chú thích `trangThai` ở service.
zaloRouter.get('/trang-thai', async (req, res, next) => {
  try {
    return ok(res, await service.trangThai(req.user));
  } catch (err) {
    return next(err);
  }
});

// Cấp mã 6 số dùng một lần trong 15 phút. Mã cũ KHÔNG bị thu hồi — xem chú thích `layMa`.
zaloRouter.post('/ma-lien-ket', async (req, res, next) => {
  try {
    return ok(res, await service.layMa(req.user), 201);
  } catch (err) {
    return next(err);
  }
});

// Bỏ liên kết của chính mình. Vốn chưa liên kết thì `changed: 0`, không phải lỗi.
zaloRouter.delete('/lien-ket', async (req, res, next) => {
  try {
    return ok(res, await service.boLienKet(req.user));
  } catch (err) {
    return next(err);
  }
});

export default zaloRouter;
