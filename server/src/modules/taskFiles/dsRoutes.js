// Router máy-đối-máy với ONLYOFFICE Document Server (Vòng 14) — MOUNT TRƯỚC `verifyCsrf` trong
// app.js (DS không có cookie phiên/CSRF); bảo vệ bằng token HMAC của service (tokenDs/kiemTokenDs).
//   GET  /raw/:id?token=…      DS tải file gốc để mở editor
//   POST /callback/:id?token=… DS trả bản đã sửa (status=2/6) ⇒ app lưu thành BẢN MỚI
import { createReadStream, constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { Router } from 'express';
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

/**
 * POST /callback/:id?token=… — DS gửi {status, url, users, actions}; status 2/6 = có bản đã sửa.
 *
 * HỢP ĐỒNG CỦA DS (tài liệu «Callback handler»): thân phản hồi phải là **ĐÚNG** `{"error":0}` ở
 * CẤP CAO NHẤT. Trước đây route này trả qua `ok()` của §5.3 ⇒ `{"ok":true,"data":{"error":0}}`,
 * DS không thấy khoá `error` nên coi là LƯU THẤT BẠI và hiện hộp «Không thể lưu tài liệu. Vui lòng
 * kiểm tra cài đặt kết nối…» — đúng lỗi người dùng báo 2026-09-02. Log của DS ghi rõ:
 *   sendServerRequest returned an error: data = {"ok":true,"data":{"error":0,...}}
 * Bản mới VẪN được lưu (nên «Lịch sử» có bản mới) nhưng DS vẫn báo lỗi rồi `storeForgotten`.
 * ⇒ Đây là NGOẠI LỆ có chủ ý của §5.3: đường máy-đối-máy đi theo hợp đồng của DS.
 */
taskFilesDsRouter.post('/callback/:id', async (req, res, next) => {
  try {
    if (!service.kiemTokenDs('callback', req.params.id, req.query.token)) {
      throw Object.assign(new Error('Token callback không hợp lệ'), {
        expected: true,
        code: 'FORBIDDEN',
        status: 403,
      });
    }
    const { status, url, users, actions } = req.body ?? {};
    // status: 1 = đang cùng sửa, 2 = đã đóng và sẵn sàng lưu, 3 = lỗi khi lưu, 4 = đóng mà không
    // đổi gì, 6 = force-save (Ctrl+S / nút Lưu / lệnh forcesave), 7 = lỗi khi force-save.
    // Chỉ 2 và 6 mới có `url` bản đã sửa; các status khác chỉ cần xác nhận đã nhận.
    if (Number(status) !== 2 && Number(status) !== 6) return res.status(200).json({ error: 0 });
    // Ai vừa sửa: DS gửi `users` (mảng id người còn/đã mở) hoặc `actions[].userid`. Config của
    // `moEditor` đặt `editorConfig.user.id = String(user.id)` nên đây chính là id trong `users`.
    const nguoiSua =
      (Array.isArray(users) && users.length > 0 ? users[0] : null) ??
      (Array.isArray(actions) && actions.length > 0 ? actions[0]?.userid : null);
    const ketQua = await service.luuTuCallback(req.params.id, url, nguoiSua);
    res.locals.audit = {
      action: 'taskFiles.sua-truc-tuyen',
      entityType: 'task',
      entityId: Number(req.params.id),
      details: { versionId: Number(req.params.id), boQua: ketQua.boQua === true },
    };
    return res.status(200).json({ error: 0 });
  } catch (err) {
    // DS đọc `error: 1` để biết phải gọi lại — trả đúng hợp đồng của DS, không phải §5.3.
    return res.status(200).json({ error: 1, message: err?.message ?? 'Lỗi không rõ' });
  }
});

export default taskFilesDsRouter;
