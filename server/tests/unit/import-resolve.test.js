// Unit test cho báo cáo đối chiếu và bộ dò tên. Cả hai đều không cần CSDL.
import { describe, expect, it } from 'vitest';
import { createReport, renderReport, reportTotals } from '../../src/modules/import/report.js';
import { createDepartmentResolver, createUserResolver } from '../../src/modules/import/resolve.js';

const users = [
  { id: 1, code: 'NV001', full_name: 'Phạm Văn Hiệp', email: 'admin@gmail.com' },
  { id: 2, code: 'NV004', full_name: 'Trần Thị B', email: '' },
  { id: 3, code: 'NV005', full_name: 'Trần Thị B', email: 'b2@congty.vn' },
];

describe('TC-IMP-05/06: dò Họ tên → user_id', () => {
  it('tên có đúng một người thì ra id, không có ghi chú', () => {
    const r = createUserResolver(users).byNameExact('Phạm Văn Hiệp', 'DA001.Quản lý');
    expect(r).toEqual({ id: 1, name: 'Phạm Văn Hiệp', problem: null });
  });

  it('bỏ qua hoa/thường và khoảng trắng thừa', () => {
    expect(createUserResolver(users).byNameExact('  phạm  văn hiệp ').id).toBe(1);
  });

  it('KHÔNG bỏ dấu — "Pham Van Hiep" là người khác, không được gộp', () => {
    const r = createUserResolver(users).byNameExact('Pham Van Hiep', 'DA001');
    expect(r.id).toBeNull();
    expect(r.problem).toMatch(/không có người tên/);
  });

  it('TC-IMP-05: tên trùng 2 người ⇒ NULL, giữ tên, nói rõ trùng những mã nào', () => {
    const r = createUserResolver(users).byNameExact('Trần Thị B', 'DA001.Người thực hiện');
    expect(r.id).toBeNull();
    expect(r.name).toBe('Trần Thị B');
    expect(r.problem).toMatch(/trùng 2 người \(NV004, NV005\)/);
  });

  it('TC-IMP-06: tên không có trong Người dùng ⇒ NULL + ghi chú', () => {
    const r = createUserResolver(users).byNameExact('Lê Văn Huy', 'DN001.Người đề nghị');
    expect(r.id).toBeNull();
    expect(r.problem).toMatch(/DN001.Người đề nghị/);
  });

  it('ô rỗng không phải lỗi: NULL, không ghi chú', () => {
    expect(createUserResolver(users).byNameExact('')).toEqual({
      id: null,
      name: '',
      problem: null,
    });
  });

  it('nhật ký ghi email thì dò ra theo email, không cần tên', () => {
    const r = createUserResolver(users).byEmailOrName('ADMIN@gmail.com', 'nhật ký');
    expect(r.id).toBe(1);
    expect(r.problem).toBeNull();
  });

  it('email rỗng không được dùng làm khoá dò — nếu không hai người rỗng sẽ gộp thành một', () => {
    expect(createUserResolver(users).byEmail('')).toBeNull();
  });
});

describe('dò Tên phòng → department_id', () => {
  const deps = [
    { id: 10, code: 'PH01', name: 'Quản lý Đào tạo' },
    { id: 11, code: 'PH03', name: 'Kế toán' },
  ];

  it('dò theo tên (dữ liệu thật ghi tên chứ không ghi mã)', () => {
    expect(createDepartmentResolver(deps).byNameExact('Quản lý Đào tạo').id).toBe(10);
    expect(createDepartmentResolver(deps).byNameExact('kế toán').id).toBe(11);
  });

  it('nhận cả mã phòng cho chắc, tên lạ thì NULL + ghi chú', () => {
    expect(createDepartmentResolver(deps).byNameExact('PH01').id).toBe(10);
    const r = createDepartmentResolver(deps).byNameExact('Phòng Lạ', 'NV009.Phòng');
    expect(r.id).toBeNull();
    expect(r.problem).toMatch(/không có phòng tên/);
  });
});

describe('báo cáo đối chiếu (§7 việc 2.7)', () => {
  const build = () => {
    const rp = createReport({
      sourceFile: 'data/snapshot-test.json',
      dryRun: false,
      snapshotMeta: { source_file: 'x.xlsx', source_sha256: 'abc', generated_at: 'lúc-nào' },
    });
    const u = rp.entity('users');
    u.countSheetRows(5);
    u.addInserted();
    u.addInserted();
    u.addUpdated();
    u.addSkipped('NV009: vai trò lạ "Giám đốc"');
    u.addNote('NV004: email rỗng ⇒ sinh địa chỉ giữ chỗ');
    rp.entity('departments').countSheetRows(4);
    rp.entity('departments').addInserted(4);
    rp.decision('Nhiệm vụ cũ không có khoá Cấp ⇒ nhập thành cấp 2');
    rp.missingSheet('Thông báo', 'nhập 0 dòng');
    rp.humanFix('Sửa cột Phân quyền của NV009 rồi nhập lại');
    return rp;
  };

  it('đếm đúng theo từng thực thể và tổng', () => {
    const totals = reportTotals(build());
    expect(totals.byEntity.users).toEqual({
      sheetRows: 5,
      inserted: 2,
      updated: 1,
      skipped: 1,
    });
    expect(totals.sheetRows).toBe(9);
    expect(totals.inserted).toBe(6);
    expect(totals.skipped).toBe(1);
  });

  it('không cho bỏ một dòng mà không có lý do', () => {
    const rp = createReport();
    rp.entity('users').addSkipped('có lý do');
    expect(rp.entity('users').reasons).toEqual(['có lý do']);
    expect(() => rp.entity('khong-ton-tai')).toThrow(/không có trong báo cáo/);
  });

  it('bản in có đủ 11 thực thể theo thứ tự nhập, kèm mục lý do và ghi chú', () => {
    const out = renderReport(build(), { now: '2026-08-24T09:00:00.000Z' });
    expect(out).toContain('CHẠY THẬT');
    expect(out).toContain('QUYẾT ĐỊNH ĐÃ ÁP DỤNG (1)');
    expect(out).toContain('SHEET KHÔNG CÓ TRONG TỆP TẢI VỀ (1)');
    expect(out).toContain('CẦN NGƯỜI SỬA TAY RỒI NHẬP LẠI (1)');
    expect(out).toContain('LÝ DO BỎ QUA — Người dùng (1)');
    expect(out).toContain('GHI CHÚ — Người dùng (1)');
    const order = ['Phòng', 'Người dùng', 'Công việc con / Nhiệm vụ', 'Nhật ký'];
    let cursor = 0;
    for (const label of order) {
      const at = out.indexOf(label, cursor);
      expect(at, `thiếu hoặc sai thứ tự: ${label}`).toBeGreaterThan(-1);
      cursor = at;
    }
  });

  it('chế độ thử phải hiện rõ là không ghi gì', () => {
    const out = renderReport(createReport({ dryRun: true }));
    expect(out).toContain('--dry-run');
    expect(out).toContain('KHÔNG ghi một dòng nào');
  });

  it('không có mục rỗng nào bị in ra cho rối', () => {
    const out = renderReport(createReport({}));
    expect(out).not.toContain('QUYẾT ĐỊNH');
    expect(out).not.toContain('GHI CHÚ —');
  });
});
