// Route ZALO của người dùng (017): xem trạng thái, lấy mã liên kết, bỏ liên kết.
//
// Ba đường REST **không có tên RPC** tương ứng — cầu tương thích giữ đúng 37 tên (§5.2, bảng «REST
// không có tên RPC»): đây là tính năng mới của Phase 8, không có hành động cũ nào trong Apps Script
// cần bắc cầu.
//
// `requireAuth` chặn ở đây thay vì service tự kiểm tra, khác với notifications (chặn trong service)
// vì module này KHÔNG có đường nào qua cầu RPC — chỉ một cổng REST, một chỗ chặn là đủ.
//
// Nhật ký của hai đường dưới do SERVICE ghi thẳng (`zalo.lien-ket` khi webhook khớp mã,
// `zalo.bo-lien-ket` khi thật sự có liên kết bị gỡ) — nên route đặt `skipAudit` để middleware
// `audit` không ghi THÊM dòng tên máy (`DELETE /api/v1/zalo/lien-ket`) cho cùng một hành động.
// Riêng «lấy mã» thì service KHÔNG ghi (chỉ là một lượt cấp mã, chưa phải liên kết) nên route tự
// đặt tên nghiệp vụ `zalo.tao-ma` — nếu không thì panel «Hoạt động gần đây» hiện nguyên đường dẫn.
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
    const ketQua = await service.layMa(req.user);
    res.locals.audit = {
      action: 'zalo.tao-ma',
      entityType: 'user',
      entityId: req.user.id,
      // KHÔNG ghi `ma` vào nhật ký: mã còn hiệu lực 15 phút, ai đọc được nhật ký trong khoảng đó
      // thì liên kết được tài khoản Zalo của người này. Chỉ cần biết «có lượt lấy mã».
      details: {},
    };
    return ok(res, ketQua, 201);
  } catch (err) {
    return next(err);
  }
});

// Bỏ liên kết của chính mình. Vốn chưa liên kết thì `changed: 0`, không phải lỗi.
zaloRouter.delete('/lien-ket', async (req, res, next) => {
  try {
    const ketQua = await service.boLienKet(req.user);
    // `boLienKet` đã ghi `zalo.bo-lien-ket` khi thật sự có liên kết bị gỡ; vốn chưa liên kết thì
    // không có gì đáng ghi. Cả hai trường hợp đều không cần dòng tên máy của middleware.
    res.locals.skipAudit = true;
    return ok(res, ketQua);
  } catch (err) {
    return next(err);
  }
});

export default zaloRouter;
