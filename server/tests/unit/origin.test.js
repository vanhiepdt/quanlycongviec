// Suy nguồn gốc và tính khác biệt hai lần lưu — hàm thuần, không cần CSDL (§2.3, TC-ORIGIN-15).
import { describe, expect, it } from 'vitest';
import { deriveOrigin, diffRows, originOf } from '../../src/utils/origin.js';

const actor = { id: 7, full_name: 'Trần Thị Trưởng' };

describe('deriveOrigin', () => {
  it('gán cho chính mình ⇒ Tự đăng ký, không có người giao', () => {
    const o = deriveOrigin({ actor, recipientId: 7 });
    expect(o.origin).toBe('Tự đăng ký');
    expect(o.created_by).toBe(7);
    expect(o.created_by_name).toBe('Trần Thị Trưởng');
    expect(o.assigned_by_id).toBeNull();
    expect(o.assigned_at).toBeNull();
  });

  it('id kiểu chuỗi vẫn nhận ra là chính mình — tham số HTTP hay về dạng chuỗi', () => {
    expect(deriveOrigin({ actor, recipientId: '7' }).origin).toBe('Tự đăng ký');
  });

  it('gán cho người khác ⇒ Được giao, ghi ai giao và lúc nào', () => {
    const o = deriveOrigin({ actor, recipientId: 9 });
    expect(o.origin).toBe('Được giao');
    expect(o.assigned_by_id).toBe(7);
    expect(o.assigned_by_name).toBe('Trần Thị Trưởng');
    expect(o.assigned_at).toBeInstanceOf(Date);
  });

  it('chưa gán ai ⇒ Tự đăng ký: không có ai để nói là được giao', () => {
    expect(deriveOrigin({ actor }).origin).toBe('Tự đăng ký');
    expect(deriveOrigin({ actor, recipientName: '' }).origin).toBe('Tự đăng ký');
  });

  it('chỉ có tên, tên trùng người lập ⇒ vẫn là Tự đăng ký', () => {
    expect(deriveOrigin({ actor, recipientName: 'Trần Thị Trưởng' }).origin).toBe('Tự đăng ký');
    expect(deriveOrigin({ actor, recipientName: 'Người khác' }).origin).toBe('Được giao');
  });

  it('không có người thao tác (script nhập dữ liệu) vẫn trả bộ cột hợp lệ', () => {
    const o = deriveOrigin({ recipientId: 9 });
    // `origin` có ràng buộc CHECK nên không được để trống, và không được vu cho ai là người giao.
    expect(o.origin).toBe('Tự đăng ký');
    expect(o.created_by).toBeNull();
    expect(o.created_by_name).toBe('');
  });

  it('gọi không tham số cũng không nổ', () => {
    expect(deriveOrigin().origin).toBe('Tự đăng ký');
  });
});

describe('diffRows', () => {
  const fields = ['name', 'status', 'completion', 'due_date', 'result_links'];

  it('chỉ liệt kê cột thật sự đổi, dạng from→to', () => {
    const before = { name: 'A', status: 'Chưa bắt đầu', completion: 0 };
    const after = { name: 'B', status: 'Chưa bắt đầu', completion: 0 };
    expect(diffRows(before, after, fields)).toEqual({ name: { from: 'A', to: 'B' } });
  });

  it('không đổi gì ⇒ null, không phải object rỗng', () => {
    const row = { name: 'A', status: 'Xong' };
    expect(diffRows(row, { ...row }, fields)).toBeNull();
  });

  it('bỏ qua cột ngoài danh sách trắng — nhật ký không kéo theo cột không ai khai', () => {
    const before = { name: 'A', password_hash: 'bam-cu' };
    const after = { name: 'A', password_hash: 'bam-moi' };
    expect(diffRows(before, after, fields)).toBeNull();
  });

  it('số ra khỏi CSDL dạng chuỗi không bị coi là đã đổi', () => {
    expect(diffRows({ completion: 50 }, { completion: '50' }, fields)).toBeNull();
  });

  it('Date và chuỗi ISO cùng thời điểm là một; đổi thời điểm thì ghi chuỗi ISO', () => {
    const t = new Date('2026-09-07T03:00:00.000Z');
    expect(diffRows({ due_date: t }, { due_date: t.toISOString() }, fields)).toBeNull();
    const changed = diffRows(
      { due_date: t },
      { due_date: new Date('2026-09-08T03:00:00Z') },
      fields
    );
    expect(changed.due_date.from).toBe('2026-09-07T03:00:00.000Z');
    expect(changed.due_date.to).toBe('2026-09-08T03:00:00.000Z');
  });

  it('mảng so theo nội dung, không theo tham chiếu', () => {
    expect(diffRows({ result_links: ['a'] }, { result_links: ['a'] }, fields)).toBeNull();
    expect(diffRows({ result_links: ['a'] }, { result_links: ['a', 'b'] }, fields)).toEqual({
      result_links: { from: ['a'], to: ['a', 'b'] },
    });
  });

  it('null ⇄ có giá trị được ghi lại, và null giữ nguyên là null', () => {
    expect(diffRows({ status: null }, { status: 'Xong' }, fields)).toEqual({
      status: { from: null, to: 'Xong' },
    });
    expect(diffRows({ status: null }, { status: null }, fields)).toBeNull();
  });

  it('cột không có trong dòng SAU thì không xét — PATCH không gửi thì không ghi', () => {
    expect(diffRows({ name: 'A', status: 'Xong' }, { name: 'A' }, fields)).toBeNull();
  });

  it('thiếu dòng trước hoặc sau ⇒ null', () => {
    expect(diffRows(null, { name: 'A' }, fields)).toBeNull();
    expect(diffRows({ name: 'A' }, null, fields)).toBeNull();
  });
});

describe('originOf', () => {
  it('gói lại đúng những gì giao diện cần hiện', () => {
    const at = new Date('2026-08-25T01:00:00Z');
    expect(
      originOf({
        origin: 'Được giao',
        created_by: 3,
        created_by_name: 'Người lập',
        assigned_by_id: 1,
        assigned_by_name: 'Người giao đầu tiên',
        assigned_at: at,
      })
    ).toEqual({
      origin: 'Được giao',
      selfRegistered: false,
      createdById: 3,
      createdByName: 'Người lập',
      assignedById: 1,
      assignedByName: 'Người giao đầu tiên',
      assignedAt: at,
    });
  });

  it('dòng cũ chưa có cột nguồn gốc ⇒ mặc định Tự đăng ký, không phải undefined', () => {
    const o = originOf({ id: 1 });
    expect(o.origin).toBe('Tự đăng ký');
    expect(o.selfRegistered).toBe(true);
    expect(o.createdByName).toBe('');
  });

  it('không có dòng ⇒ null', () => {
    expect(originOf(null)).toBeNull();
  });
});
