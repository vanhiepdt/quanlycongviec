// Route Đề nghị (§5.2, §7 việc 7.1). Vỏ HTTP mỏng: kiểm dữ liệu vào, gọi service, đặt tên nhật ký.
import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import { dateInput, text } from '../../utils/zodTypes.js';
import { LOAI, TRANG_THAI } from './repo.js';
import * as service from './service.js';

/**
 * Tham chiếu công việc / nhiệm vụ: giao diện cũ gửi **mã** (`CV001`, `CV001-003`) vì `<option value>`
 * lấy từ `COL.P_ID` / `COL.T_ID`. `""` là một lựa chọn thật ("Không gắn công việc nào") nên giữ
 * nguyên chuỗi rỗng cho service hiểu là bỏ liên kết, không đổi thành `null` ở đây.
 */
const refInput = z.union([z.string().trim().max(60), z.number().int(), z.null()]).optional();

const createSchema = z.object({
  type: z.enum(LOAI).optional(),
  workRef: refInput,
  taskRef: refInput,
  content: text(5000).optional(),
  url: text(2000).optional(),
  supplier: text(300).optional(),
  proposalDate: dateInput,
  // Hai trường của người duyệt. Schema vẫn nhận (giao diện cũ gửi cả form), service mới là chỗ
  // quyết định có ghi hay không — xem `duyetDuoc`.
  status: z.enum(TRANG_THAI).optional(),
  reviewNote: text(2000).optional(),
});

const updateSchema = createSchema.partial();

const querySchema = z.object({
  status: z.enum(TRANG_THAI).optional(),
  type: z.enum(LOAI).optional(),
  workId: z.coerce.number().int().positive().optional(),
  q: text(200).optional(),
});

export const proposalsRouter = Router();

proposalsRouter.use(requireAuth);

proposalsRouter.get('/', validate(querySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.validatedQuery ?? {};
    return ok(res, await service.list(req.user, q));
  } catch (err) {
    return next(err);
  }
});

proposalsRouter.get('/:id', async (req, res, next) => {
  try {
    return ok(res, { proposal: await service.getOne(req.user, req.params.id) });
  } catch (err) {
    return next(err);
  }
});

proposalsRouter.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const proposal = await service.create(req.user, req.body);
    res.locals.audit = {
      action: 'proposal.create',
      entityType: 'proposal',
      entityId: proposal.id,
      workId: proposal.work_id ?? null,
      details: { code: proposal.code, loai: proposal.type, status: proposal.status },
    };
    return ok(res, { proposal }, 201);
  } catch (err) {
    return next(err);
  }
});

proposalsRouter.patch('/:id', validate(updateSchema), async (req, res, next) => {
  try {
    const { proposal, before } = await service.update(req.user, req.params.id, req.body);
    res.locals.audit = {
      action: 'proposal.update',
      entityType: 'proposal',
      entityId: proposal.id,
      workId: proposal.work_id ?? null,
      // Đổi trạng thái là việc đáng ghi riêng: đó là dấu vết của khâu duyệt đề nghị.
      details:
        before.status === proposal.status
          ? { code: proposal.code }
          : { code: proposal.code, status: { from: before.status, to: proposal.status } },
    };
    return ok(res, { proposal });
  } catch (err) {
    return next(err);
  }
});

proposalsRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await service.remove(req.user, req.params.id);
    res.locals.audit = {
      action: 'proposal.remove',
      entityType: 'proposal',
      details: { code: result.deletedProposal },
    };
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
});

export default proposalsRouter;
