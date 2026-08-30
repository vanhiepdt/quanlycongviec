// TC-PQ-10..13 — lớp GHI ĐÈ «Bảng phân quyền hệ thống» của `can()` (009_permission_overrides.sql).
//
// Test bằng hàm thuần như delegation-can.test.js: ghi đè do `attachSession` nạp sẵn vào
// `user.ghiDe` (khóa `entityType:action` → giá trị). Bốn luật:
//   'tu-choi'  tắt quyền DÙ ma trận gốc cho phép (admin không chịu ghi đè)
//   'cho-phep' mở quyền khi ma trận gốc từ chối — phạm vi `inScope()` VẪN xét
//   'cho-duyet' mở tạo + dòng mới rơi vào «Chờ duyệt» (trangThaiDuyetKhiTao)
//   không ghi đè ⇒ đúng luật gốc từng chữ
import { describe, expect, it } from 'vitest';
import { can } from '../../src/middleware/rbac.js';
import { trangThaiDuyetKhiTao } from '../../src/modules/approvals/rules.js';
import { OTHER_DEPT, OWN_DEPT, principal } from '../helpers/rbac.js';

const dongCV = (over = {}) => ({
  id: 50,
  level: null,
  department_id: OWN_DEPT,
  manager_id: 999,
  assignee_id: 998,
  ...over,
});

describe('TC-PQ-10: ghi đè «tu-choi» tắt quyền của Trưởng phòng', () => {
  it('ma trận gốc cho phép update, ghi đè tắt ⇒ từ chối với câu riêng', () => {
    const tp = principal('Trưởng phòng', { ghiDe: { 'work:update': 'tu-choi' } });
    const v = can(tp, 'update', 'work', dongCV());
    expect(v.ok).toBe(false);
    expect(v.message).toContain('Quản trị hệ thống đã tắt quyền');
  });

  it('admin không chịu ghi đè — vẫn toàn quyền', () => {
    const admin = principal('admin', { ghiDe: { 'work:update': 'tu-choi' } });
    expect(can(admin, 'update', 'work', dongCV({ department_id: OTHER_DEPT })).ok).toBe(true);
  });

  it('không ghi đè ⇒ đúng luật gốc từng chữ', () => {
    expect(can(principal('Trưởng phòng'), 'update', 'work', dongCV()).ok).toBe(true);
  });
});

describe('TC-PQ-11: ghi đè «cho-phep» mở quyền — phạm vi vẫn xét', () => {
  it('Nhân viên sửa Công việc: ma trận từ chối, ghi đè mở ⇒ qua khi việc có mình trong đó', () => {
    const nv = principal('Nhân viên', { ghiDe: { 'work:update': 'cho-phep' } });
    expect(can(nv, 'update', 'work', dongCV({ assignee_id: 100 })).ok).toBe(true);
  });

  it('phạm vi vẫn chặn: việc không có mình thì ghi đè không cứu được', () => {
    const nv = principal('Nhân viên', { ghiDe: { 'work:update': 'cho-phep' } });
    const v = can(nv, 'update', 'work', dongCV());
    expect(v.ok).toBe(false);
  });

  it('không ghi đè ⇒ Nhân viên vẫn không sửa được Công việc', () => {
    expect(can(principal('Nhân viên'), 'update', 'work', dongCV({ assignee_id: 100 })).ok).toBe(
      false
    );
  });
});

describe('TC-PQ-12: ghi đè «cho-duyet» chỉ đổi trạng thái khi TẠO', () => {
  it('Trưởng phòng tạo Công việc với ghi đè cho-phep ⇒ «Đã duyệt» ngay', () => {
    const tp = principal('Trưởng phòng', { ghiDe: { 'work:create': 'cho-phep' } });
    expect(trangThaiDuyetKhiTao(tp, 1)).toBe('Đã duyệt');
  });

  it('Trưởng phòng tạo Công việc với ghi đè cho-duyet ⇒ «Chờ duyệt» (như mặc định)', () => {
    const tp = principal('Trưởng phòng', { ghiDe: { 'work:create': 'cho-duyet' } });
    expect(trangThaiDuyetKhiTao(tp, 1)).toBe('Chờ duyệt');
  });

  it('không ghi đè ⇒ luật gốc: TP «Chờ duyệt», Phó GĐ «Đã duyệt», nhiệm vụ luôn «Đã duyệt»', () => {
    expect(trangThaiDuyetKhiTao(principal('Trưởng phòng'), 1)).toBe('Chờ duyệt');
    expect(trangThaiDuyetKhiTao(principal('Phó Giám đốc'), 1)).toBe('Đã duyệt');
    expect(trangThaiDuyetKhiTao(principal('Trưởng phòng'), 3)).toBe('Đã duyệt');
  });

  it('Phó GĐ bị ghi đè cho-duyet ⇒ công việc mình tạo cũng phải chờ duyệt', () => {
    const pgd = principal('Phó Giám đốc', { ghiDe: { 'work:create': 'cho-duyet' } });
    expect(trangThaiDuyetKhiTao(pgd, 1)).toBe('Chờ duyệt');
  });
});
