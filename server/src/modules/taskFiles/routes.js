// Route «Kết quả & Luồng» (014, 2026-09-01). Vỏ HTTP mỏng: nhận FormData (multer) hoặc JSON,
// gọi service, đặt tên nhật ký. Không có nghiệp vụ ở đây — state machine nằm ở service.js.
//
// Năm đường:
//   POST   /work-items/:ref/files           nộp bản mới (multipart: file + fileId? + moTa?)
//   GET    /work-items/:ref/files           nhóm + bản + góp ý + bảng luồng của nhiệm vụ
//   GET    /task-files/:id/download         stream; ?inline=1 để PDF mở trong iframe
//   POST   /task-files/:id/verdict          Yêu cầu sửa / Trình / Đẩy về Cán bộ / Hoàn thành /
//                                           Trả về TP/PP / Duyệt — quyền + trạng thái ở service
//   POST   /task-file-versions/:id/comments góp ý theo bản
//   DELETE /task-files/:id                  người tạo nhóm + admin, khi chưa da-duyet
//
// Multer dùng memoryStorage (giới hạn 20 MB đã set): cần `version_no` từ CSDL TRƯỚC khi đặt tên
// vật lý `v{n}-{uuid}.{ext}` — ghi đĩa là việc của service trong giao dịch, không phải của multer.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { AppError } from '../../utils/errors.js';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import { idInput, text } from '../../utils/zodTypes.js';
import * as service from './service.js';

export const taskFilesRouter = Router();

/** `file` là tên field của FormData; mọi field khác vào `req.body` dạng chuỗi. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: service.DUNG_LUONG_TOI_DA, files: 1 },
});

/**
 * Multer nổ TRƯỚC khi vào handler (multer tự next(err)) nên bắt lỗi phải là MỘT middleware
 * đứng sau `upload.single` — đặt trong catch của handler là không bao giờ thấy. Đổi thành 400
 * tiếng Việt thay vì 500 INTERNAL chung.
 */
function chuyenLoiMulter(err, req, res, next) {
  if (err && err.name === 'MulterError') {
    const thongDiep =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File vượt quá dung lượng tối đa 20 MB'
        : 'Không đọc được file gửi lên, vui lòng thử lại';
    return next(new AppError('VALIDATION_ERROR', thongDiep, { field: 'file' }));
  }
  return next(err);
}

const verdictSchema = z.object({
  hanhDong: z.enum([
    'yeu-cau-sua',
    'trinh-lanh-dao',
    'tra-ve-cbo',
    'hoan-thanh',
    'tra-ve-tp',
    'duyet',
  ]),
  noiDung: text(2000).optional(),
});

const gopYSchema = z.object({
  noiDung: z.string().min(1, 'Vui lòng nhập nội dung góp ý').max(2000),
  trang: z.coerce.number().int().min(1).max(10000).optional(),
});

const downloadSchema = z.object({ inline: z.enum(['0', '1']).optional() });

taskFilesRouter.use(requireAuth);

/** Nộp bản mới (multipart). Không có `fileId` = mở nhóm mới (v1); có = thêm bản vào nhóm. */
taskFilesRouter.post(
  '/work-items/:ref/files',
  upload.single('file'),
  chuyenLoiMulter,
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw Object.assign(new Error('Vui lòng chọn file Word/PDF để nộp'), {
          expected: true,
          code: 'VALIDATION_ERROR',
          status: 400,
          field: 'file',
        });
      }
      const fileId = req.body.fileId ? Number(idInput.parse(req.body.fileId)) : null;
      const ketQua = await service.nop(req.user, req.params.ref, {
        buffer: req.file.buffer,
        tenGoc: req.file.originalname,
        loaiMime: req.file.mimetype,
        fileId,
        moTa: typeof req.body.moTa === 'string' ? req.body.moTa.slice(0, 2000) : '',
      });
      res.locals.audit = {
        action: 'taskFiles.nop',
        entityType: 'task',
        entityId: ketQua.ban.file_id,
        details: {
          fileId: ketQua.nhom.id,
          versionNo: ketQua.ban.version_no,
          tuDong: ketQua.tuDong,
        },
      };
      return ok(res, ketQua);
    } catch (err) {
      // Multer nổ riêng (MulterError) — đổi thành 400 tiếng Việt thay vì 500 INTERNAL chung.
      if (err && err.name === 'MulterError') {
        const thongDiep =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'File vượt quá dung lượng tối đa 20 MB'
            : 'Không đọc được file gửi lên, vui lòng thử lại';
        return next(new AppError('VALIDATION_ERROR', thongDiep, { field: 'file' }));
      }
      return next(err);
    }
  }
);

taskFilesRouter.get('/work-items/:ref/files', async (req, res, next) => {
  try {
    return ok(res, { item: req.params.ref, nhom: await service.doc(req.user, req.params.ref) });
  } catch (err) {
    return next(err);
  }
});

/** Trang SỬA TRỰC TUYẾN (ONLYOFFICE) — tab mới, người dùng đăng nhập; DS còn cần token riêng. */
taskFilesRouter.get('/task-file-versions/:id/editor', async (req, res, next) => {
  try {
    const ketQua = await service.moEditor(req.user, req.params.id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(service.htmlEditor(ketQua));
  } catch (err) {
    // Chưa cấu hình DS: trả trang thông báo có thể đọc được thay vì JSON lỗi.
    if (err && err.status === 400 && String(err.message).includes('ONLYOFFICE')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res
        .status(400)
        .send(
          '<!DOCTYPE html><html lang="vi"><meta charset="utf-8"><body style="font-family:sans-serif;padding:24px">' +
            '<h3>Chưa bật sửa trực tuyến</h3><p>' +
            String(err.message).replace(/</g, '&lt;') +
            '</p><p>Xem <code>docs/KE-HOACH-KET-QUA-FILE.md</code> §7.</p></html>'
        );
    }
    return next(err);
  }
});

taskFilesRouter.get(
  '/task-files/:id/download',
  validate(downloadSchema, 'query'),
  async (req, res, next) => {
    try {
      const { ban, item } = await service.docBan(req.user, req.params.id);
      const duong = service.duongBan(item.id, ban.ten_luu);
      let thongKe;
      try {
        thongKe = await stat(duong);
      } catch {
        throw Object.assign(new Error('File trên máy chủ đã bị mất — liên hệ quản trị'), {
          expected: true,
          code: 'NOT_FOUND',
          status: 404,
        });
      }
      const inline = req.validatedQuery?.inline === '1' && ban.loai_mime === 'application/pdf';
      res.setHeader('Content-Type', ban.loai_mime);
      res.setHeader('Content-Length', thongKe.size);
      res.setHeader(
        'Content-Disposition',
        `${inline ? 'inline' : 'attachment'}; filename="file-${ban.version_no}"; filename*=UTF-8''${encodeURIComponent(ban.ten_goc)}`
      );
      return createReadStream(duong).pipe(res);
    } catch (err) {
      return next(err);
    }
  }
);

taskFilesRouter.post('/task-files/:id/verdict', validate(verdictSchema), async (req, res, next) => {
  try {
    const ketQua = await service.verdict(req.user, req.params.id, {
      hanhDong: req.body.hanhDong,
      noiDung: req.body.noiDung,
    });
    res.locals.audit = {
      action: `taskFiles.${ketQua.hanhDong}`,
      entityType: 'task',
      entityId: ketQua.nhom.item_id,
      details: { fileId: ketQua.nhom.id, trangThai: ketQua.nhom.trang_thai },
    };
    return ok(res, ketQua);
  } catch (err) {
    return next(err);
  }
});

taskFilesRouter.post(
  '/task-file-versions/:id/comments',
  validate(gopYSchema),
  async (req, res, next) => {
    try {
      const { gopY } = await service.gomY(req.user, req.params.id, {
        noiDung: req.body.noiDung,
        trang: req.body.trang,
      });
      res.locals.audit = {
        action: 'taskFiles.gom-y',
        entityType: 'task',
        entityId: gopY.version_id,
        details: { versionId: gopY.version_id },
      };
      return ok(res, { gopY });
    } catch (err) {
      return next(err);
    }
  }
);

taskFilesRouter.delete('/task-files/:id', async (req, res, next) => {
  try {
    const ketQua = await service.xoaNhom(req.user, req.params.id);
    res.locals.audit = {
      action: 'taskFiles.xoa',
      entityType: 'task',
      entityId: Number(req.params.id),
      details: { fileId: Number(req.params.id) },
    };
    return ok(res, ketQua);
  } catch (err) {
    return next(err);
  }
});

export default taskFilesRouter;
