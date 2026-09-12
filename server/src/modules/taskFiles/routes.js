// Route «Kết quả & Luồng» (014, 2026-09-01). Vỏ HTTP mỏng: nhận FormData (multer) hoặc JSON,
// gọi service, đặt tên nhật ký. Không có nghiệp vụ ở đây — state machine nằm ở service.js.
//
// Năm đường:
//   POST   /work-items/:ref/files           nộp bản mới (multipart: file + fileId? + moTa?)
//   POST   /work-items/:ref/results         KHAI dòng kết quả trước khi có file (016, JSON)
//   POST   /work-items/:ref/reports         nộp «Báo cáo» — bản không có file, nội dung chữ (016)
//   GET    /work-items/:ref/files           nhóm + bản + góp ý + bảng luồng của nhiệm vụ
//   GET    /task-files/:id/download         stream; ?inline=1 để PDF mở trong iframe
//   POST   /task-files/:id/verdict          TP/PP phê duyệt / Đẩy về Cán bộ / Hoàn thành /
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
        ? `File vượt quá dung lượng tối đa ${service.NHAN_DUNG_LUONG}`
        : 'Không đọc được file gửi lên, vui lòng thử lại';
    return next(new AppError('VALIDATION_ERROR', thongDiep, { field: 'file' }));
  }
  return next(err);
}

const verdictSchema = z.object({
  // ĐỢT B (điểm 7 + điểm 9): `yeu-cau-sua` đã gộp vào `tra-ve-cbo`, `trinh-lanh-dao` thành
  // `tp-phe-duyet` («TP/PP phê duyệt», có lưu mốc ai ký và lúc nào). Hai mã cũ KHÔNG nhận nữa —
  // migration 029 đã viết lại lịch sử và bỏ chúng khỏi CHECK của `task_file_flow`.
  hanhDong: z.enum(['tp-phe-duyet', 'tra-ve-cbo', 'hoan-thanh', 'tra-ve-tp', 'duyet']),
  noiDung: text(2000).optional(),
  versionId: idInput.optional(),
});

const gopYSchema = z.object({
  noiDung: z.string().min(1, 'Vui lòng nhập nội dung góp ý').max(2000),
  trang: z.coerce.number().int().min(1).max(10000).optional(),
});

const downloadSchema = z.object({ inline: z.enum(['0', '1']).optional() });
const guiBanMoiSchema = z.object({ noiDung: text(2000).optional() });
const luuTamSchema = z.object({ ghiChu: z.string().max(2000) });

/**
 * KHAI DÒNG KẾT QUẢ TRƯỚC KHI CÓ FILE (016) — nút ＋ của khối «Kết quả». JSON, KHÔNG multipart:
 * đường nộp file (`POST /work-items/:ref/files`) vẫn đòi có file thật, không nhận thân rỗng —
 * một đường một nhiệm vụ thì câu lỗi mới nói đúng thứ người dùng thiếu.
 */
const khaiKetQuaSchema = z.object({
  tenKetQua: z.string().trim().min(1, 'Vui lòng nhập tên kết quả làm được').max(500),
  dinhDang: z.enum(['Word', 'Excel', 'PPT', 'PDF', 'Ảnh', 'Báo cáo']).optional(),
  yKien: text(2000).optional(),
  // Q1 (ĐỢT B): khai báo gồm BA thứ — tên kết quả · định dạng · TỶ LỆ. Ô tỷ lệ là tuỳ chọn; bỏ
  // trống thì máy chia đều như cũ. Service mới là nơi kiểm 0..100 và quyết ghi thẳng hay lập đề nghị.
  tyLe: z.coerce.number().int().min(0).max(100).nullish(),
});

/** NỘP «BÁO CÁO» — bản KHÔNG có file, nội dung là chữ. `fileId` có = thêm bản vào nhóm đã khai. */
const baoCaoSchema = z.object({
  noiDung: z.string().trim().min(10, 'Nội dung báo cáo cần ít nhất 10 ký tự').max(20000),
  tenGoc: z.string().trim().max(500).optional(),
  fileId: idInput.optional(),
});

taskFilesRouter.use(requireAuth);
taskFilesRouter.patch('/task-files/:id/ty-le', async (req, res, next) => {
  try {
    const result = await service.suaTyLe(req.user, req.params.id, req.body);
    res.locals.audit = {
      action: 'taskFiles.ty-le',
      entityType: 'task',
      entityId: result.nhom.item_id,
      // ĐỢT B (R4''): cây đã duyệt thì `ty_le` trong `nhom` là giá trị CŨ (chưa đổi) và
      // `choDuyet` = true. Ghi CẢ HAI để nhật ký nói đúng sự thật: ai xin bao nhiêu, và đã đổi chưa.
      details: {
        fileId: result.nhom.id,
        tyLe: result.nhom.ty_le,
        tyLeDeNghi: req.body?.tyLe ?? null,
        choDuyet: result.tyLeChange?.pending === true,
      },
    };
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
});

taskFilesRouter.get('/task-files/lenh-sua', async (req, res, next) => {
  try {
    return ok(res, await service.lenhSua(req.user));
  } catch (err) {
    return next(err);
  }
});

for (const [method, duong, schema, xuLy] of [
  [
    'post',
    'gui-di-duyet',
    guiBanMoiSchema.extend({ versionId: idInput.optional() }),
    service.guiDiDuyet,
  ],
  ['post', 'gui-ban-moi', guiBanMoiSchema, service.guiBanMoi],
  ['post', 'huy-lenh-sua', z.object({}), service.huyLenhSua],
  ['patch', 'luu-tam', luuTamSchema, service.luuTam],
]) {
  taskFilesRouter[method](`/task-files/:id/${duong}`, validate(schema), async (req, res, next) => {
    try {
      const ketQua = await xuLy(req.user, req.params.id, req.body);
      res.locals.audit = {
        action: `taskFiles.${duong}`,
        entityType: 'task',
        entityId: ketQua.nhom.item_id,
        details: { fileId: ketQua.nhom.id, trangThai: ketQua.nhom.trang_thai },
      };
      return ok(res, ketQua);
    } catch (err) {
      return next(err);
    }
  });
}

/** Nộp bản mới (multipart). Không có `fileId` = mở nhóm mới (v1); có = thêm bản vào nhóm. */
taskFilesRouter.post(
  '/work-items/:ref/files',
  upload.single('file'),
  chuyenLoiMulter,
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw Object.assign(new Error('Vui lòng chọn file kết quả để nộp'), {
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
        dinhDang: req.body.dinhDang ?? null,
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
            ? `File vượt quá dung lượng tối đa ${service.NHAN_DUNG_LUONG}`
            : 'Không đọc được file gửi lên, vui lòng thử lại';
        return next(new AppError('VALIDATION_ERROR', thongDiep, { field: 'file' }));
      }
      return next(err);
    }
  }
);

/**
 * POST /work-items/:ref/results — KHAI dòng kết quả (tên + định dạng + ý kiến), CHƯA có file.
 * Nhóm sinh ra với 0 bản ⇒ cột «File đã tải lên» là «Chưa có» và nhóm không vào hàng chờ phê duyệt.
 */
taskFilesRouter.post(
  '/work-items/:ref/results',
  validate(khaiKetQuaSchema),
  async (req, res, next) => {
    try {
      const ketQua = await service.khaiKetQua(req.user, req.params.ref, {
        tenKetQua: req.body.tenKetQua,
        dinhDang: req.body.dinhDang,
        yKien: req.body.yKien,
        tyLe: req.body.tyLe ?? null,
      });
      res.locals.audit = {
        action: 'taskFiles.khai',
        entityType: 'task',
        entityId: ketQua.nhom.item_id,
        details: {
          fileId: ketQua.nhom.id,
          dinhDang: ketQua.nhom.dinh_dang,
          tyLe: ketQua.nhom.ty_le,
          choDuyet: ketQua.tyLeChange?.pending === true,
        },
      };
      return ok(res, ketQua);
    } catch (err) {
      return next(err);
    }
  }
);

/** POST /work-items/:ref/reports — nộp «Báo cáo»: một BẢN không có file, nội dung là chữ. */
taskFilesRouter.post('/work-items/:ref/reports', validate(baoCaoSchema), async (req, res, next) => {
  try {
    const ketQua = await service.nopBaoCao(req.user, req.params.ref, {
      noiDung: req.body.noiDung,
      tenGoc: req.body.tenGoc,
      fileId: req.body.fileId == null ? null : Number(req.body.fileId),
    });
    res.locals.audit = {
      action: 'taskFiles.nop-bao-cao',
      entityType: 'task',
      entityId: ketQua.nhom.item_id,
      details: {
        fileId: ketQua.nhom.id,
        versionNo: ketQua.ban.version_no,
        tuDong: ketQua.tuDong,
      },
    };
    return ok(res, ketQua);
  } catch (err) {
    return next(err);
  }
});

taskFilesRouter.get('/work-items/:ref/files', async (req, res, next) => {
  try {
    return ok(res, {
      item: req.params.ref,
      nhom: await service.doc(req.user, req.params.ref),
      // Quyền của CHÍNH người đang xem trên luồng file của nhiệm vụ này (luật siết `leader_ids`
      // 2026-09-02) — client mở/ẩn nút «Tải file lên» theo `quyen.duocNop`, không tự suy lại luật.
      quyen: await service.quyenFile(req.user, req.params.ref),
      // Cờ bật/tắt ONLYOFFICE — client đọc để hiện/ẩn nút ✎ sửa trực tuyến.
      onlyOffice: service.onlyOfficeBat(),
    });
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
    // GHI ĐÈ CSP của helmet cho ĐÚNG trang này: mặc định `script-src 'self'` chặn `api.js` của
    // Document Server ⇒ DocsAPI không tồn tại ⇒ MÀN HÌNH TRẮNG không lời giải thích (lỗi người
    // dùng báo 2026-09-02). Xem `cspEditor()` để biết nới cái gì và vì sao.
    res.setHeader('Content-Security-Policy', service.cspEditor(ketQua.dsUrl));
    // Trang này KHÔNG nhúng vào đâu (mở tab riêng), nhưng nó nhúng iframe của DS: hai đầu dưới đây
    // của helmet chặn tài nguyên khác origin nên phải nới, nếu không khung editor trắng.
    res.removeHeader('Cross-Origin-Embedder-Policy');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
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

/**
 * GET /task-files/cho-duyet — HÀNG CHỜ PHÊ DUYỆT KẾT QUẢ (tab con thứ hai).
 * PHẢI đứng TRƯỚC `/task-files/:id/download` và mọi đường có `:id`? Không: Express khớp theo
 * đường dẫn đầy đủ nên `/task-files/cho-duyet` không đụng `/task-files/:id/download`. Nhưng
 * `DELETE /task-files/:id` cùng tiền tố lại khác method, nên vẫn an toàn.
 */
taskFilesRouter.get('/task-files/cho-duyet', async (req, res, next) => {
  try {
    return ok(res, await service.choDuyetKetQua(req.user));
  } catch (err) {
    return next(err);
  }
});

/** POST /task-file-versions/:id/save — bấm «Lưu thành bản mới» trên trang editor (forcesave). */
taskFilesRouter.post('/task-file-versions/:id/save', async (req, res, next) => {
  try {
    const ketQua = await service.luuNgay(req.user, req.params.id);
    res.locals.audit = {
      action: 'taskFiles.luu-ngay',
      entityType: 'task',
      entityId: Number(req.params.id),
      details: { versionId: Number(req.params.id), daLuu: ketQua.daLuu === true },
    };
    return ok(res, ketQua);
  } catch (err) {
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
      // `?inline=1` = mở NGAY trên trình duyệt thay vì tải về. Chỉ cho PDF và ảnh raster
      // (`MIME_XEM_INLINE`): không có SVG nên không có đường chạy mã, và helmet đã đặt nosniff.
      // Mime nào ngoài danh sách thì luôn về nhánh `attachment`.
      const inline =
        req.validatedQuery?.inline === '1' && service.MIME_XEM_INLINE.includes(ban.loai_mime);
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
      versionId: req.body.versionId,
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
