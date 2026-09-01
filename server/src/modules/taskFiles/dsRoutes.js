// Router máy-đối-máy với ONLYOFFICE Document Server (Vòng 14) — MOUNT TRƯỚC `verifyCsrf` trong
// app.js (DS không có cookie phiên/CSRF); bảo vệ bằng token HMAC của service (tokenDs/kiemTokenDs).
//   GET  /raw/:id?token=…      DS tải file gốc để mở editor
//   POST /callback/:id?token=… DS trả bản đã sửa (status=2/6) ⇒ app lưu thành BẢN MỚI
import { createReadStream } from 'node:fs';
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
    res.setHeader('Content-Type', ban.loai_mime);
    res.setHeader('Content-Disposition', `filename*=UTF-8''${encodeURIComponent(ban.ten_goc)}`);
    return createReadStream(duong).pipe(res);
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
