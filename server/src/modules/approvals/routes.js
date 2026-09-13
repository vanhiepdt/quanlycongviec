// Route luồng duyệt — `/api/v1/approvals/*` (§5.2, §7 việc 5.2/5.3/5.5).
// Vỏ HTTP mỏng: kiểm dữ liệu vào, gọi service, đặt tên nhật ký. Không có nghiệp vụ ở đây.
//
// Đường dẫn theo đúng §5.2: `POST /approvals/:entity/:id/{submit,approve,reject}` và
// `GET /approvals/pending-count`. `pending-count` PHẢI khai trước `/:entity/...` — Express xét
// theo thứ tự, đặt sau thì `pending-count` bị bắt làm `:entity`.
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../utils/errors.js';
import { projectFromLegacy, taskFromLegacy } from '../../rpc/legacyFields.js';
import { updateSchema as workUpdateSchema, toRow as workToRow } from '../works/routes.js';
import { updateSchema as itemUpdateSchema, toRow as itemToRow } from '../workItems/routes.js';
import * as service from './service.js';
import * as changes from './changes.js';
import * as tyLe from './tyLe.js';

// Lý do từ chối: chặn trên 2000 ký tự cho khớp cột `reject_reason`. Chặn dưới do service lo
// (`DO_DAI_LY_DO_TOI_THIEU`) để cầu RPC cũng chịu cùng một luật, không chỉ đường REST này.
const rejectSchema = z.object({
  reason: z.string({ required_error: 'Vui lòng nhập lý do từ chối' }).max(2000),
});

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const approveSchema = z.object({
  // Khi có edit, đây là dữ liệu form legacy; route sẽ đổi sang schema REST trước khi gọi service.
  // Các khoá khác của request approve cũ được bỏ qua để giữ tương thích.
  edit: z.record(z.unknown()).optional(),
});

/**
 * Thân của `…/pending-edits/submit` — S4: tick ô nào thì gửi ô đó.
 *
 * `chon` vắng mặt ⇒ gửi HẾT giỏ trong phạm vi (nút «Gửi tất cả», và cũng là hành vi của một client
 * chưa có ô tick). `fields` vắng mặt trong một phần tử ⇒ gửi hết giỏ đó. Ba mức chứ không phải một
 * vì popup có ba chỗ bấm: chân popup, dấu ✕ cạnh mỗi mục, dấu ✕ cạnh mỗi dòng thay đổi.
 *
 * `id`/`fields` chỉ kiểm HÌNH DẠNG ở đây; còn «số này có thật trong giỏ không» và «cột này có thật
 * trong giỏ không» là việc của `locTheoTich` bên service, vì phải đọc giỏ mới biết. Chặn tên cột ở
 * đây thì phải chép danh sách cột vào route — đúng cái «nguồn sự thật thứ hai» mà §6 cấm.
 */
const chonSchema = z.object({
  chon: z
    .array(
      z.object({
        id: z.coerce.number().int().positive(),
        fields: z.array(z.string().min(1).max(60)).optional(),
      })
    )
    .optional(),
});

/** Thân của `…/pending-edits/drop` — vắng cả hai khoá nghĩa là bỏ CẢ phạm vi. */
const dropSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  fields: z.array(z.string().min(1).max(60)).optional(),
});

function parseApproveEdit(entity, rawEdit) {
  if (rawEdit === undefined) return undefined;
  const name = String(entity ?? '').toLowerCase();
  const isWork = name === 'work' || name === 'works';
  const isItem = name === 'item' || name === 'work-item' || name === 'work-items';
  if (!isWork && !isItem) return undefined;
  const converted = isWork ? projectFromLegacy(rawEdit) : taskFromLegacy(rawEdit);
  const checked = (isWork ? workUpdateSchema : itemUpdateSchema).safeParse(converted);
  if (!checked.success) {
    const issue = checked.error.issues[0];
    throw new AppError('VALIDATION_ERROR', issue.message, {
      field: issue.path.join('.') || undefined,
    });
  }
  return {
    patch: (isWork ? workToRow : itemToRow)(checked.data),
    targetWorkRef: isItem ? checked.data.workRef : undefined,
  };
}

/**
 * Thân của `POST /:entity/:id/pending-edits` → patch tên CỘT. Cùng khuôn `parseApproveEdit` bên trên
 * nhưng KHÔNG qua bước đổi tên legacy.
 *
 * Vì sao không qua legacy: đường này là REST và thân nó là thân của `PATCH /works/:id` /
 * `PATCH /work-items/:id`. Dùng lại đúng hai `updateSchema` + hai `toRow` đó để một form sửa trên
 * giao diện chỉ phải đổi CHỖ GỬI tuỳ theo mục đang «Đã duyệt» hay không, không đổi tên trường. Đặt
 * một schema thứ hai ở đây là đặt thêm một chỗ phải sửa mỗi lần thêm một cột.
 *
 * Entity lạ trả `undefined` chứ không ném: `mustFind` bên service sẽ ném BAD_REQUEST bằng đúng câu mà
 * mọi đường `/approvals/:entity/...` khác vẫn ném. Ném ở đây là một câu thông báo thứ hai cho cùng
 * một lỗi, và hai câu thì sẽ có ngày lệch nhau.
 */
function parsePendingEditBody(entity, body) {
  const name = String(entity ?? '').toLowerCase();
  const isWork = name === 'work' || name === 'works';
  const isItem = name === 'item' || name === 'work-item' || name === 'work-items';
  if (!isWork && !isItem) return undefined;
  const checked = (isWork ? workUpdateSchema : itemUpdateSchema).safeParse(body ?? {});
  if (!checked.success) {
    const issue = checked.error.issues[0];
    throw new AppError('VALIDATION_ERROR', issue.message, {
      field: issue.path.join('.') || undefined,
    });
  }
  return {
    patch: (isWork ? workToRow : itemToRow)(checked.data),
    targetWorkRef: isItem ? checked.data.workRef : undefined,
  };
}

export const approvalsRouter = Router();

approvalsRouter.use(requireAuth);
// Q2: đề nghị dùng cùng approval_changes và cùng danh sách /pending, không tạo hàng chờ mới.
// ĐỢT B (R4''): bảng đó nay có THÊM loại `ty-le` — cùng một đường URL, rẽ nhánh theo `change_kind`.
for (const action of ['approve', 'reject']) {
  approvalsRouter.post('/changes/:id/' + action, async (req, res, next) => {
    try {
      if (!/^\d+$/.test(req.params.id))
        throw new AppError('VALIDATION_ERROR', 'Mã đề nghị không hợp lệ');
      const parsed = action === 'reject' ? rejectSchema.safeParse(req.body) : null;
      if (parsed && !parsed.success)
        throw new AppError('VALIDATION_ERROR', 'Vui lòng nhập lý do từ chối, tối đa 2000 ký tự', {
          field: 'reason',
        });
      const reason = parsed?.data.reason ?? '';
      const loai = await changes.kindOfChange(req.params.id);
      if (loai == null) throw new AppError('NOT_FOUND', 'Không tìm thấy đề nghị');
      if (loai === 'reviewer')
        throw new AppError(
          'VALIDATION_ERROR',
          'Dòng này là thay đổi của người duyệt, không phải đề nghị'
        );
      const duyet = action === 'approve';
      const result =
        loai === 'ty-le'
          ? await tyLe.decideTyLe(req.user, req.params.id, duyet, reason)
          : await changes.decideGuiBld(req.user, req.params.id, duyet, reason);
      res.locals.audit = {
        action: `approvals.${loai}.${action}`,
        entityType: 'task',
        entityId: result.item.id,
        workId: result.item.work_id,
        details:
          loai === 'ty-le'
            ? { changeId: result.id, target: result.target, tyLe: result.tyLe }
            : { changeId: result.id, guiBldPheDuyet: result.item.gui_bld_phe_duyet },
      };
      return ok(res, result);
    } catch (error) {
      return next(error);
    }
  });
}

/** Con số của badge (việc 5.5). Giao diện gọi lại đường này sau MỖI lần duyệt. */
approvalsRouter.get('/pending-count', async (req, res, next) => {
  try {
    return ok(res, await service.pendingCount(req.user));
  } catch (err) {
    return next(err);
  }
});

/** Hộp "chờ bạn duyệt": danh sách mục đang treo trong phạm vi người đang xem. */
approvalsRouter.get('/pending', validate(listSchema, 'query'), async (req, res, next) => {
  try {
    const items = await service.pendingList(req.user, { limit: req.validatedQuery?.limit });
    return ok(res, { items, total: items.length });
  } catch (err) {
    return next(err);
  }
});

/**
 * Hộp "yêu cầu XOÁ chờ bạn duyệt" (013) — đường riêng, không gộp vào `/pending`.
 *
 * Hai danh sách trả lời hai câu khác nhau và có hành động khác nhau (Duyệt/Trả lại/Từ chối ở một
 * bên, Đồng ý xoá/Từ chối xoá ở bên kia). Gộp một mảng rồi để giao diện tự phân loại là mời gọi
 * lỗi «bấm Duyệt trên một dòng yêu cầu xoá».
 */
approvalsRouter.get('/pending-deletes', validate(listSchema, 'query'), async (req, res, next) => {
  try {
    const items = await service.pendingDeleteList(req.user, { limit: req.validatedQuery?.limit });
    return ok(res, { items, total: items.length });
  } catch (err) {
    return next(err);
  }
});

/**
 * GIỎ «LƯU CHỜ» CỦA TÔI (S1, 12/09/2026) — nguồn của badge «có sửa chờ» trên lưới.
 *
 * Khai TRƯỚC `/:entity/:id/...` vì cùng lý do với `/pending-count` ở đầu file: Express xét theo thứ
 * tự, đặt sau thì `pending-edits` bị bắt làm `:entity`.
 *
 * Không gộp vào `/pending-count`: số đó là «bao nhiêu mục đang chờ BẠN DUYỆT», còn số này là «bao
 * nhiêu mục BẠN đang soạn dở». Cộng chung thì chuông «Chờ duyệt» rung cho một thứ chưa gửi cho ai,
 * và người duyệt mở hộp ra thấy rỗng.
 */
approvalsRouter.get('/pending-edits', async (req, res, next) => {
  try {
    return ok(res, await service.gioChoCuaToi(req.user));
  } catch (err) {
    return next(err);
  }
});

/**
 * Nhật ký của cả ba hành động ghi vào chính đầu việc, không vào một loại thực thể riêng: mở
 * `/works/:id/history` là thấy luôn "đã duyệt / bị từ chối vì …" trong dòng thời gian (§2.3).
 */
function auditFor(action, result, details = {}) {
  const isWork = result.kind === 'work';
  return {
    action,
    entityType: isWork ? 'work' : result.row.level === 2 ? 'subwork' : 'task',
    entityId: result.row.id,
    workId: isWork ? result.row.id : result.row.work_id,
    details: {
      code: result.row.code,
      approvalStatus: result.row.approval_status,
      notified: result.notified,
      ...details,
    },
  };
}

approvalsRouter.post('/:entity/:id/submit', async (req, res, next) => {
  try {
    const result = await service.submit(req.user, req.params.entity, req.params.id);
    res.locals.audit = auditFor('approvals.submit', result, { soCon: result.soCon ?? 0 });
    return ok(res, { row: result.row, soCon: result.soCon ?? 0, notified: result.notified });
  } catch (err) {
    return next(err);
  }
});

approvalsRouter.post('/:entity/:id/approve', validate(approveSchema), async (req, res, next) => {
  try {
    const edit = parseApproveEdit(req.params.entity, req.body?.edit);
    const result = await service.approve(req.user, req.params.entity, req.params.id, edit);
    res.locals.audit = auditFor('approvals.approve', result, {
      soCon: result.soCon ?? 0,
      ...(result.changes ? { changes: result.changes } : {}),
    });
    return ok(res, {
      row: result.row,
      soCon: result.soCon ?? 0,
      notified: result.notified,
      ...(result.changes ? { changes: result.changes } : {}),
    });
  } catch (err) {
    return next(err);
  }
});

approvalsRouter.post('/:entity/:id/reject', validate(rejectSchema), async (req, res, next) => {
  try {
    const result = await service.reject(
      req.user,
      req.params.entity,
      req.params.id,
      req.body.reason
    );
    // Lý do KHÔNG vào nhật ký: nó đã nằm ở cột `reject_reason` của chính dòng đó, và nhật ký chỉ
    // nhận những trường chọn tay (xem `middleware/audit.js`). TỪ 012 mục bị từ chối bị XOÁ HẲN nên
    // cột đó không còn — ghi thêm số mục đã mất để nhật ký nói được chuyện gì đã xảy ra.
    res.locals.audit = auditFor('approvals.reject', result, {
      daXoa: true,
      deletedCount: 1 + (result.soCon ?? 0),
    });
    return ok(res, {
      row: result.row,
      daXoa: true,
      deletedCodes: result.deletedCodes ?? [],
      soCon: result.soCon ?? 0,
      notified: result.notified,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * TRẢ LẠI ĐỂ SỬA (012, Vòng 13) — cửa mềm giữa Duyệt và Từ chối: cả cây về bản nháp của người tạo,
 * không mất dữ liệu. Ghi chú bắt buộc như lý do từ chối, và cũng đi qua `rejectSchema` vì cả hai
 * đều ghi vào cột `reject_reason` (chặn trên 2000 ký tự); chặn dưới 10 ký tự do service lo.
 */
approvalsRouter.post('/:entity/:id/return', validate(rejectSchema), async (req, res, next) => {
  try {
    const result = await service.traLaiDeSua(
      req.user,
      req.params.entity,
      req.params.id,
      req.body.reason
    );
    res.locals.audit = auditFor('approvals.return', result, { soCon: result.soCon ?? 0 });
    return ok(res, { row: result.row, soCon: result.soCon ?? 0, notified: result.notified });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------------------------
// YÊU CẦU XOÁ (013, Vòng 13 đợt 2) — ba hành động, cùng khuôn với submit/approve/reject ở trên.
//
// Vai bị ghi đè `delete = 'cho-duyet'` không xoá thẳng được (`xoaPhaiQuaDuyet`), phải xin xoá rồi
// người có quyền duyệt mục đó xử. `approval_status` không tham gia — xem đầu migration 013.
// ---------------------------------------------------------------------------------------------

/** Xin xoá: lý do BẮT BUỘC ≥ 10 ký tự (service kiểm), dùng chung `rejectSchema` vì cùng hình dạng. */
approvalsRouter.post(
  '/:entity/:id/request-delete',
  validate(rejectSchema),
  async (req, res, next) => {
    try {
      const result = await service.xinXoa(
        req.user,
        req.params.entity,
        req.params.id,
        req.body.reason
      );
      res.locals.audit = auditFor('approvals.requestDelete', result, { soCon: result.soCon ?? 0 });
      return ok(res, { row: result.row, soCon: result.soCon ?? 0, notified: result.notified });
    } catch (err) {
      return next(err);
    }
  }
);

/** Duyệt yêu cầu xoá ⇒ XOÁ THẬT cả cây. Quyền đúng bằng quyền duyệt mục đó. */
approvalsRouter.post('/:entity/:id/approve-delete', async (req, res, next) => {
  try {
    const result = await service.duyetXoa(req.user, req.params.entity, req.params.id);
    res.locals.audit = auditFor('approvals.approveDelete', result, {
      daXoa: true,
      deletedCount: 1 + (result.soCon ?? 0),
    });
    return ok(res, {
      row: result.row,
      daXoa: true,
      deletedCodes: result.deletedCodes ?? [],
      soCon: result.soCon ?? 0,
      notified: result.notified,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * Từ chối yêu cầu xoá ⇒ ba cột yêu cầu về rỗng, mục nguyên trạng.
 *
 * Lý do TUỲ CHỌN (khác `/reject` và `/return`): không có gì mất đi nên không bắt giải trình.
 * `.partial()` để thân request rỗng cũng hợp lệ.
 */
approvalsRouter.post(
  '/:entity/:id/reject-delete',
  validate(rejectSchema.partial()),
  async (req, res, next) => {
    try {
      const result = await service.tuChoiXoa(
        req.user,
        req.params.entity,
        req.params.id,
        req.body?.reason
      );
      res.locals.audit = auditFor('approvals.rejectDelete', result);
      return ok(res, { row: result.row, notified: result.notified });
    } catch (err) {
      return next(err);
    }
  }
);

approvalsRouter.get('/:entity/:id/changes', async (req, res, next) => {
  try {
    return ok(res, {
      items: await changes.unreadChanges(req.user, req.params.entity, req.params.id),
    });
  } catch (err) {
    return next(err);
  }
});
approvalsRouter.post(
  '/changes/:id/acknowledge',
  validate(z.object({ id: z.coerce.number().int().positive() }), 'params'),
  async (req, res, next) => {
    try {
      // «Đã xem thay đổi» là việc của người đọc, không đổi dữ liệu nghiệp vụ nào — ghi vào nhật ký
      // thì mỗi lần mở popup xem thay đổi lại thêm một dòng tên máy vào «Hoạt động gần đây».
      res.locals.skipAudit = true;
      return ok(res, await changes.acknowledge(req.user, req.params.id));
    } catch (err) {
      return next(err);
    }
  }
);

// ---------------------------------------------------------------------------------------------
// GIỎ «LƯU CHỜ» (S1–S4, 12/09/2026) — người dùng: «khi sửa thông tin gì cũng có chế độ lưu chờ (tức
// là cho sửa tiếp), rồi nút ấn gửi duyệt thay vì gửi duyệt luôn khi ấn cập nhật như bây giờ, và trước
// khi ấn nút gửi duyệt thì phải hiển thị popup những cái thay đổi».
//
// Bốn đường dưới cùng một tài nguyên `/:entity/:id/pending-edits` thay vì rải bốn chỗ: đọc giỏ, cất
// vào giỏ, bỏ khỏi giỏ, gửi giỏ. `drop` và `submit` là POST con chứ không phải DELETE/PUT vì giao
// diện chỉ có hai helper `restGet`/`restPost` — thêm một động từ HTTP là thêm một hàm fetch nữa trong
// `app.js`. Khuôn `POST /changes/:id/:action` ở đầu file là tiền lệ.
//
// `:entity` nhận cả `work|works|work-item|work-items|item` (`LOAI_THUC_THE` bên service), nên đường
// này không cần biết client gọi theo số ít hay số nhiều.
// ---------------------------------------------------------------------------------------------

/**
 * ĐỌC giỏ của phạm vi — nội dung popup «Gửi duyệt» + cờ `phaiLuuCho` để giao diện đổi nhãn nút
 * «Cập nhật» thành «Lưu chờ».
 *
 * Cờ do SERVER tính, không để client tự suy từ bản sao ma trận quyền của nó: nút hiện sai thì người
 * dùng bấm «Cập nhật» và nhận 409, hoặc ngược lại — sửa mất hút vào giỏ mà không ai nói.
 */
approvalsRouter.get('/:entity/:id/pending-edits', async (req, res, next) => {
  try {
    return ok(res, await service.docGio(req.user, req.params.entity, req.params.id));
  } catch (err) {
    return next(err);
  }
});

/**
 * CẤT một lượt sửa vào giỏ (nút «Cập nhật» khi mục đang «Đã duyệt» và vai này phải qua duyệt lại).
 *
 * `skipAudit`: lượt này KHÔNG đổi một cột nghiệp vụ nào — giỏ là bản nháp của riêng người soạn, và
 * «cho sửa tiếp» nghĩa là một lượt sửa bấm «Lưu chờ» nhiều lần được. Ghi nhật ký thì mỗi lần bấm là
 * một dòng tên người trong «Hoạt động gần đây» cho một việc chưa thành; đúng tiền lệ của
 * `POST /changes/:id/acknowledge` bên trên. Không mất dấu ai: giỏ có `editor_id`, và lúc GỬI thì
 * `update` của hai service ghi như một lượt sửa thường.
 */
approvalsRouter.post('/:entity/:id/pending-edits', async (req, res, next) => {
  try {
    res.locals.skipAudit = true;
    const day = parsePendingEditBody(req.params.entity, req.body) ?? {};
    return ok(
      res,
      await service.luuGio(req.user, req.params.entity, req.params.id, day.patch, {
        targetWorkRef: day.targetWorkRef,
      })
    );
  } catch (err) {
    return next(err);
  }
});

/** BỎ giỏ — cả phạm vi (thân rỗng), một giỏ (`{id}`), hoặc đúng vài ô trong một giỏ (`{id, fields}`). */
approvalsRouter.post(
  '/:entity/:id/pending-edits/drop',
  validate(dropSchema),
  async (req, res, next) => {
    try {
      // `skipAudit` như trên: bỏ một bản nháp chưa từng công bố thì không có gì để kể lại.
      res.locals.skipAudit = true;
      return ok(
        res,
        await service.boGio(req.user, req.params.entity, req.params.id, req.body ?? {})
      );
    } catch (err) {
      return next(err);
    }
  }
);

/** GỬI giỏ đi duyệt, sau khi đã tick trong popup (S3 gửi cả cây một lần · S4 tick ô nào gửi ô đó). */
approvalsRouter.post(
  '/:entity/:id/pending-edits/submit',
  validate(chonSchema),
  async (req, res, next) => {
    try {
      const result = await service.guiGio(
        req.user,
        req.params.entity,
        req.params.id,
        req.body?.chon ?? null
      );
      // CÓ nhật ký, khác hai đường trên: đây là lúc giỏ thành thật — các dòng hạ về `Chờ duyệt`,
      // chuông R7 rung, người duyệt có việc. Hai hàm `update` được gọi như HÀM chứ không qua route
      // của chúng nên không tự ghi dòng nào; thiếu dòng này thì một lượt gửi cả cây mất dấu.
      // `code`/`count`/`changed` là ba khoá `dichKhoa` bên `rpc/legacyFields.js` đã dịch sẵn thành
      // «Cập nhật N trường» / «N mục» / «N thay đổi» — không phải thêm nhãn mới ở hai bản dịch.
      res.locals.audit = {
        action: 'approvals.pendingEditSubmit',
        entityType: result.muc.entityType,
        entityId: result.muc.entityId,
        workId: result.muc.workId,
        details: {
          code: result.muc.code,
          count: result.daGui.length,
          changed: result.daGui.reduce((n, g) => n + g.thayDoi.length, 0),
        },
      };
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  }
);

export default approvalsRouter;
