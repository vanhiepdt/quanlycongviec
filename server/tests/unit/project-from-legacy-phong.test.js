// Chốt hành vi «ô chọn Phòng / Ban lãnh đạo kiểm soát» của form công việc qua cầu RPC
// (projectFromLegacy — bẫy 2026-08-26 lần 2):
//   • value ô select là ID SỐ (COL.D_DB_ID) — gửi mã «PH01» phải bị loại (numberOrUndefined cũ).
//   • `""` là MỘT LỰA CHỌN («Công việc chung») ⇒ `null`: tạo → NULL; SỬA → XOÁ phòng cũ.
//     Bản cũ trả `undefined` ⇒ khoá bị drop ⇒ PATCH thành silent no-op, phòng cũ bị giữ.
//   • Thiếu khoá (PATCH một trường khác) ⇒ khoá không xuất hiện trong payload ⇒ không đổi gì.
import { describe, expect, it } from 'vitest';
import { projectFromLegacy } from '../../src/rpc/legacyFields.js';

describe('projectFromLegacy — ô Phòng và Ban lãnh đạo kiểm soát', () => {
  it('chuỗi id số từ form ⇒ số nguyên trong payload', () => {
    const out = projectFromLegacy({ name: 'A', departmentId: '3', supervisorId: '2' });
    expect(out.departmentId).toBe(3);
    expect(out.supervisorId).toBe(2);
  });

  it('"" = chọn «Công việc chung» ⇒ null (PATCH xoá liên kết, không phải bỏ qua)', () => {
    const out = projectFromLegacy({ name: 'A', departmentId: '', supervisorId: '' });
    expect(out).toHaveProperty('departmentId', null);
    expect(out).toHaveProperty('supervisorId', null);
  });

  it('thiếu khoá ⇒ không có khoá trong payload (PATCH không đổi trường không gửi)', () => {
    const out = projectFromLegacy({ name: 'A' });
    expect(Object.hasOwn(out, 'departmentId')).toBe(false);
    expect(Object.hasOwn(out, 'supervisorId')).toBe(false);
  });

  it('mã phòng «PH01» (không phải số) ⇒ bị loại, không gửi rác cho server', () => {
    const out = projectFromLegacy({ name: 'A', departmentId: 'PH01' });
    expect(Object.hasOwn(out, 'departmentId')).toBe(false);
  });
});
