// Router máy-đối-máy với ONLYOFFICE Document Server (Vòng 14) — MOUNT TRƯỚC `verifyCsrf` trong
// app.js (DS không có cookie phiên/CSRF); bảo vệ bằng token HMAC của service (tokenDs/kiemTokenDs).
//   GET  /raw/:id?token=…      DS tải file gốc để mở editor
//   POST /callback/:id?token=… DS trả bản đã sửa (status=2/6) ⇒ app lưu thành BẢN MỚI
import { createReadStream, constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { Router } from 'express';
import { ok } from '../../middleware/errorHandler.js';
import * as service from './service.js';

export const taskFilesDsRouter = Router();

/** GET /raw/:id — DS tải file gốc (Content-Type theo bản; không Content-Disposition). */
taskFilesDsRouter.get('/raw/:id', async (req, res, next) => {
  try {
    if (!service.kiemTokenDs('raw', req.params.id, req.query.token)) {
      throw Object.assign(new Error('Token tải file không hợp lệ'), {
        expected: true,
        code: 'FORBIDDEN',
        status: 403,
      });
    }
    const { ban, item } = await service.docBanSystem(req.params.id);
    const duong = service.duongBan(item.id, ban.ten_luu);
    // PHẢI kiểm file có thật TRƯỚC khi tạo stream. `createReadStream(...).pipe(res)` với đường dẫn
    // không tồn tại phát sự kiện 'error' KHÔNG AI BẮT ⇒ Node ném «Unhandled error event» và
    // **CẢ MÁY CHỦ CHẾT** — đã xảy ra thật 2026-09-02 khi DS đòi bản của seed (seed chỉ tạo dòng
    // CSDL, không có file trên đĩa): người dùng thấy «không mở được màn hình sửa», thực chất là
    // máy chủ vừa sập. Nay trả 404 gọn để DS báo lỗi tải file trong editor.
    try {
      await access(duong, constants.R_OK);
    } catch {
      throw Object.assign(new Error('File trên máy chủ đã bị mất'), {
        expected: true,
        code: 'NOT_FOUND',
        status: 404,
      });
    }
    res.setHeader('Content-Type', ban.loai_mime);
    res.setHeader('Content-Disposition', `filename*=UTF-8''${encodeURIComponent(ban.ten_goc)}`);
    const luong = createReadStream(duong);
    // Chốt thứ hai: file bị xoá/khoá NGAY GIỮA lúc đang truyền thì vẫn không được làm sập tiến trình.
    luong.on('error', (err) => {
      if (!res.headersSent) return next(err);
      return res.destroy(err);
    });
    return luong.pipe(res);
  } catch (err) {
    return next(err);
  }
});

/** POST /callback/:id?token=… — DS gửi {status, url}; status 2/6 = có bản đã sửa để lưu. */
taskFilesDsRouter.post('/callback/:id', async (req, res, next) => {
  try {
    if (!service.kiemTokenDs('callback', req.params.id, req.query.token)) {
      throw Object.assign(new Error('Token callback không hợp lệ'), {
        expected: true,
        code: 'FORBIDDEN',
        status: 403,
      });
    }
    const { status, url } = req.body ?? {};
    // status: 2 = đã lưu sẵn và sẵn sàng lưu, 6 = force-save. Các status khác chỉ xác nhận.
    if (Number(status) !== 2 && Number(status) !== 6) return ok(res, { error: 0 });
    const ketQua = await service.luuTuCallback(req.params.id, url);
    res.locals.audit = {
      action: 'taskFiles.sua-truc-tuyen',
      entityType: 'task',
      entityId: Number(req.params.id),
      details: { versionId: Number(req.params.id), boQua: ketQua.boQua === true },
    };
    return ok(res, { error: 0, ...ketQua });
  } catch (err) {
    // DS đọc `error: 1` để biết phải gọi lại — trả đúng hợp đồng của DS, không phải §5.3.
    return res.status(200).json({ error: 1, message: err?.message ?? 'Lỗi không rõ' });
  }
});

export default taskFilesDsRouter;
