// Repo departments + department_managers. Bảng `department_managers` là nền của phạm vi "Phó Giám
// đốc chỉ trong phòng mình phụ trách" (TC-RBAC-05), nên nó phải đúng trước khi login dùng đến.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../../src/modules/departments/repo.js';
import { makeDepartment, makeUser, pool, resetTables } from '../helpers/db.js';

let ph01;
let ph02;
let nguoi;

beforeAll(resetTables);

beforeEach(async () => {
  await resetTables();
  // sort_order cố tình ngược mã để chứng minh listAll sắp theo sort_order, không theo mã.
  ph01 = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật', sort_order: 2 });
  ph02 = await makeDepartment({ code: 'PH02', name: 'Phòng Kế hoạch', sort_order: 1 });
  nguoi = await makeUser({ email: 'pgd@congty.vn', role: 'Phó Giám đốc', full_name: 'Trần Thị B' });
});

describe('listAll / findById / findByName', () => {
  it('sắp theo sort_order — đúng thứ tự hiện trên Gantt, không phải theo mã', async () => {
    expect((await repo.listAll()).map((d) => d.code)).toEqual(['PH02', 'PH01']);
  });

  it('findById trả đủ cột dùng ở giao diện', async () => {
    expect(await repo.findById(ph01.id)).toMatchObject({ code: 'PH01', name: 'Phòng Kỹ thuật' });
    expect(await repo.findById(999999)).toBeNull();
  });

  it('findByName bỏ qua hoa/thường và dấu cách hai đầu (dữ liệu nhập tay có cả hai kiểu)', async () => {
    expect((await repo.findByName('  phòng kỹ THUẬT '))?.id).toBe(ph01.id);
    expect((await repo.findByName('Phòng Kỹ thuật'))?.id).toBe(ph01.id);
  });

  it('findByName tên không có → null, không ném lỗi kể cả khi truyền null', async () => {
    expect(await repo.findByName('Phòng Không Tồn Tại')).toBeNull();
    expect(await repo.findByName(null)).toBeNull();
  });
});

describe('người phụ trách phòng', () => {
  it('addManager rồi listManagers ra tên người, không chỉ id', async () => {
    await repo.addManager(ph01.id, nguoi.id, 'deputy_director');
    const ds = await repo.listManagers(ph01.id);
    expect(ds).toHaveLength(1);
    expect(ds[0]).toMatchObject({
      department_id: ph01.id,
      user_id: nguoi.id,
      role: 'deputy_director',
      full_name: 'Trần Thị B',
    });
  });

  it('addManager gọi lại lần hai không lỗi (thao tác phải chạy lại được)', async () => {
    await repo.addManager(ph01.id, nguoi.id, 'head');
    await repo.addManager(ph01.id, nguoi.id, 'head');
    expect(await repo.listManagers(ph01.id)).toHaveLength(1);
  });

  it('một người giữ hai vai khác nhau ở cùng phòng là hợp lệ (khoá chính có cả role)', async () => {
    await repo.addManager(ph01.id, nguoi.id, 'head');
    await repo.addManager(ph01.id, nguoi.id, 'deputy_director');
    expect((await repo.listManagers(ph01.id)).map((m) => m.role)).toEqual([
      'deputy_director',
      'head',
    ]);
  });

  it('listDepartmentIdsManagedBy lọc đúng theo vai — head không thành phạm vi của Phó Giám đốc', async () => {
    await repo.addManager(ph01.id, nguoi.id, 'deputy_director');
    await repo.addManager(ph02.id, nguoi.id, 'head');
    expect(await repo.listDepartmentIdsManagedBy(nguoi.id)).toEqual([ph01.id]);
    expect(await repo.listDepartmentIdsManagedBy(nguoi.id, 'head')).toEqual([ph02.id]);
    expect(await repo.listDepartmentIdsManagedBy(999999)).toEqual([]);
  });

  it('id phòng trả về là số, không phải chuỗi (mảng bigint của pg)', async () => {
    await repo.addManager(ph01.id, nguoi.id, 'deputy_director');
    expect(typeof (await repo.listDepartmentIdsManagedBy(nguoi.id))[0]).toBe('number');
  });

  it('removeManager xoá đúng một vai, trả về số dòng đã xoá', async () => {
    await repo.addManager(ph01.id, nguoi.id, 'deputy_director');
    await repo.addManager(ph01.id, nguoi.id, 'head');
    expect(await repo.removeManager(ph01.id, nguoi.id, 'head')).toBe(1);
    expect((await repo.listManagers(ph01.id)).map((m) => m.role)).toEqual(['deputy_director']);
    // Xoá cái không có → 0, không lỗi.
    expect(await repo.removeManager(ph01.id, nguoi.id, 'head')).toBe(0);
  });

  it('vai lạ bị CSDL chặn (CHECK), không âm thầm ghi vào', async () => {
    await expect(repo.addManager(ph01.id, nguoi.id, 'giám_đốc')).rejects.toThrow();
    expect(repo.MANAGER_ROLES).toEqual(['deputy_director', 'head', 'vice']);
  });

  it('xoá phòng thì dòng phụ trách đi theo, không để lại rác', async () => {
    await repo.addManager(ph01.id, nguoi.id, 'deputy_director');
    await pool.query('DELETE FROM departments WHERE id = $1', [ph01.id]);
    expect(await repo.listDepartmentIdsManagedBy(nguoi.id)).toEqual([]);
  });
});
