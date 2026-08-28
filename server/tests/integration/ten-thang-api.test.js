// TÊN THEO THÁNG — API (TC-TENTHANG-13..24, docs/KE-HOACH-TEN-THEO-THANG.md).
//
// Yêu cầu người dùng: việc dài hơn 1 tháng thì đặt được tên riêng cho từng tháng TIẾP THEO; xem
// tháng nào thì hiện tên tháng đó; chưa đặt thì vẫn tên gốc. Ở đây kiểm phần máy chủ của cả ba cấp:
// bản đồ `monthNames` về đúng đường đọc nào, tháng nào bị chặn, ai được đặt, và nhật ký ghi gì.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { makeDepartment, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();

// Một công việc trải THÁNG 8 → THÁNG 11: tháng 8 là tháng gốc, ba tháng 9/10/11 đặt tên được.
const DAU = '2026-08-10';
const CUOI = '2026-11-20';

let dept;
let admin;
let nguoiNgoai;

async function loginAs(user) {
  const api = client(app);
  await api.login(user.email);
  return api;
}

/** Cây ba cấp, cả ba dòng đều trải tháng 8 → tháng 11. */
async function dungCay(api) {
  const work = (
    await api.post('/api/v1/works', {
      name: 'Việc dài nhiều tháng',
      departmentId: dept.id,
      startDate: DAU,
      endDate: CUOI,
    })
  ).body.data.work;
  const subwork = (
    await api.post('/api/v1/work-items', {
      workRef: work.code,
      level: 2,
      name: 'Việc con dài',
      startDate: DAU,
      dueDate: CUOI,
    })
  ).body.data.item;
  const task = (
    await api.post('/api/v1/work-items', {
      workRef: work.code,
      parentRef: subwork.code,
      level: 3,
      name: 'Nhiệm vụ dài',
      startDate: DAU,
      dueDate: CUOI,
    })
  ).body.data.item;
  return { work, subwork, task };
}

/**
 * Chờ nhật ký: audit chạy ở `res.on('finish')`, tức SAU khi supertest đã trả về.
 *
 * Trả dòng MỚI NHẤT của hành động đó (nhật ký xếp cũ trước), và chờ cho đủ `soDong` dòng: đặt tên
 * hai lần thì dòng đầu có mặt trước dòng sau, lấy dòng đầu là kiểm sai bản ghi.
 */
async function choNhatKy(api, url, hanhDong, soDong = 1, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const res = await api.get(url);
    const khop = (res.body?.data?.entries ?? []).filter((e) => e.action === hanhDong);
    if (khop.length >= soDong) return khop[khop.length - 1];
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

beforeEach(async () => {
  await resetTables();
  dept = await makeDepartment();
  admin = await makeLoginUser({ code: 'NV001', email: 'admin@congty.vn', role: 'admin' });
  nguoiNgoai = await makeLoginUser({
    code: 'NV009',
    email: 'ngoai@congty.vn',
    full_name: 'Trần Ngoài Phòng',
    role: 'Nhân viên',
    department_id: (await makeDepartment({ code: 'PH02', name: 'Phòng khác', sort_order: 2 })).id,
  });
});

afterAll(async () => {
  await closePool();
});

describe('TC-TENTHANG-13..16 — đặt và bỏ tên tháng ở cấp 1', () => {
  it('TC-TENTHANG-13: PUT đặt tên tháng 9, GET /works trả bản đồ monthNames còn `name` là tên gốc', async () => {
    const api = await loginAs(admin);
    const { work } = await dungCay(api);

    const res = await api.put(`/api/v1/works/${work.code}/month-names/2026-09`, {
      name: 'Việc dài — tháng 9',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ month: '2026-09', name: 'Việc dài — tháng 9' });

    const list = await api.get('/api/v1/works');
    const dong = list.body.data.works.find((w) => w.code === work.code);
    // Tên GỐC không bị đổi: form Sửa điền sẵn từ đây, ghi tên tháng vào là bấm Lưu một lần mất tên gốc.
    expect(dong.name).toBe('Việc dài nhiều tháng');
    expect(dong.month_names).toEqual({ '2026-09': 'Việc dài — tháng 9' });
  });

  it('TC-TENTHANG-14: PUT lần hai cùng tháng là GHI ĐÈ, không tạo dòng thứ hai', async () => {
    const api = await loginAs(admin);
    const { work } = await dungCay(api);

    await api.put(`/api/v1/works/${work.code}/month-names/2026-09`, { name: 'Lần một' });
    await api.put(`/api/v1/works/${work.code}/month-names/2026-09`, { name: 'Lần hai' });

    const list = await api.get('/api/v1/works');
    const dong = list.body.data.works.find((w) => w.code === work.code);
    expect(dong.month_names).toEqual({ '2026-09': 'Lần hai' });
  });

  it('TC-TENTHANG-15: DELETE bỏ tên riêng ⇒ tháng đó về tên gốc; bỏ lần hai không phải lỗi', async () => {
    const api = await loginAs(admin);
    const { work } = await dungCay(api);
    await api.put(`/api/v1/works/${work.code}/month-names/2026-10`, { name: 'Tháng 10' });

    const xoa = await api.del(`/api/v1/works/${work.code}/month-names/2026-10`);
    expect(xoa.status).toBe(200);
    expect(xoa.body.data.removed).toBe(1);

    const lai = await api.del(`/api/v1/works/${work.code}/month-names/2026-10`);
    expect(lai.status).toBe(200);
    expect(lai.body.data.removed).toBe(0);

    const list = await api.get('/api/v1/works');
    expect(list.body.data.works.find((w) => w.code === work.code).month_names).toEqual({});
  });

  it('TC-TENTHANG-16: PUT với tên rỗng đi đúng đường BỎ tên, không đặt tên rỗng', async () => {
    const api = await loginAs(admin);
    const { work } = await dungCay(api);
    await api.put(`/api/v1/works/${work.code}/month-names/2026-11`, { name: 'Tháng 11' });

    const res = await api.put(`/api/v1/works/${work.code}/month-names/2026-11`, { name: '   ' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ cleared: true, name: '' });

    const list = await api.get('/api/v1/works');
    expect(list.body.data.works.find((w) => w.code === work.code).month_names).toEqual({});
  });
});

describe('TC-TENTHANG-17..19 — tháng nào được đặt tên', () => {
  it('TC-TENTHANG-17: tháng ĐẦU bị chặn — tên tháng đầu chính là tên gốc', async () => {
    const api = await loginAs(admin);
    const { work } = await dungCay(api);

    const res = await api.put(`/api/v1/works/${work.code}/month-names/2026-08`, { name: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MONTH_IS_FIRST');
  });

  it('TC-TENTHANG-18: tháng ngoài khoảng bị chặn', async () => {
    const api = await loginAs(admin);
    const { work } = await dungCay(api);

    const truoc = await api.put(`/api/v1/works/${work.code}/month-names/2026-07`, { name: 'X' });
    const sau = await api.put(`/api/v1/works/${work.code}/month-names/2026-12`, { name: 'X' });
    expect([truoc.status, sau.status]).toEqual([400, 400]);
    expect(truoc.body.error.code).toBe('MONTH_OUT_OF_RANGE');
    expect(sau.body.error.code).toBe('MONTH_OUT_OF_RANGE');
  });

  it('TC-TENTHANG-19: việc gói trong MỘT tháng thì không đặt được; tháng sai dạng là lỗi kiểm dữ liệu', async () => {
    const api = await loginAs(admin);
    const ngan = (
      await api.post('/api/v1/works', {
        name: 'Việc một tháng',
        departmentId: dept.id,
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      })
    ).body.data.work;

    const mot = await api.put(`/api/v1/works/${ngan.code}/month-names/2026-09`, { name: 'X' });
    expect(mot.status).toBe(400);
    expect(mot.body.error.code).toBe('MONTH_OUT_OF_RANGE');

    const dangSai = await api.put(`/api/v1/works/${ngan.code}/month-names/2026-8`, { name: 'X' });
    expect(dangSai.status).toBe(400);
    expect(dangSai.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('TC-TENTHANG-20..22 — cấp 2, cấp 3 và Sơ đồ Gantt', () => {
  it('TC-TENTHANG-20: công việc con và nhiệm vụ cũng đặt được, bản đồ về theo từng dòng', async () => {
    const api = await loginAs(admin);
    const { subwork, task } = await dungCay(api);

    expect(
      (await api.put(`/api/v1/work-items/${subwork.code}/month-names/2026-09`, { name: 'Con T9' }))
        .status
    ).toBe(200);
    expect(
      (await api.put(`/api/v1/work-items/${task.code}/month-names/2026-10`, { name: 'NV T10' }))
        .status
    ).toBe(200);

    const items = (await api.get('/api/v1/bootstrap')).body.data.items;
    const byCode = new Map(items.map((r) => [r.code, r]));
    expect(byCode.get(subwork.code).month_names).toEqual({ '2026-09': 'Con T9' });
    expect(byCode.get(task.code).month_names).toEqual({ '2026-10': 'NV T10' });
    // Tên gốc của cả hai giữ nguyên.
    expect(byCode.get(subwork.code).name).toBe('Việc con dài');
    expect(byCode.get(task.code).name).toBe('Nhiệm vụ dài');
  });

  it('TC-TENTHANG-21: cầu RPC getProjects/getTasks trả monthNames mà KHÔNG đổi ô Tên cũ', async () => {
    const api = await loginAs(admin);
    const { work, task } = await dungCay(api);
    await api.put(`/api/v1/works/${work.code}/month-names/2026-09`, { name: 'CV T9' });
    await api.put(`/api/v1/work-items/${task.code}/month-names/2026-09`, { name: 'NV T9' });

    const projects = (await api.post('/api/rpc/getProjects', {})).body.data;
    const duAn = projects.find((p) => p['Mã dự án'] === work.code);
    expect(duAn.monthNames).toEqual({ '2026-09': 'CV T9' });
    expect(duAn['Tên dự án']).toBe('Việc dài nhiều tháng');

    const tasks = (await api.post('/api/rpc/getTasks', {})).body.data;
    const nv = tasks.find((t) => t['Mã nhiệm vụ'] === task.code);
    expect(nv.monthNames).toEqual({ '2026-09': 'NV T9' });
    expect(nv['Tên nhiệm vụ']).toBe('Nhiệm vụ dài');
  });

  it('TC-TENTHANG-22: cây Gantt mang monthNames ở cả ba mức', async () => {
    const api = await loginAs(admin);
    const { work, subwork, task } = await dungCay(api);
    await api.put(`/api/v1/works/${work.code}/month-names/2026-09`, { name: 'CV T9' });
    await api.put(`/api/v1/work-items/${subwork.code}/month-names/2026-09`, { name: 'Con T9' });
    await api.put(`/api/v1/work-items/${task.code}/month-names/2026-09`, { name: 'NV T9' });

    const res = await api.get('/api/v1/gantt?from=2026-09-01&to=2026-09-30');
    expect(res.status).toBe(200);
    const cv = res.body.data.groups.flatMap((g) => g.works).find((w) => w.code === work.code);
    expect(cv.monthNames).toEqual({ '2026-09': 'CV T9' });
    const con = cv.subs.find((s) => s.code === subwork.code);
    expect(con.monthNames).toEqual({ '2026-09': 'Con T9' });
    expect(con.children.find((t) => t.code === task.code).monthNames).toEqual({
      '2026-09': 'NV T9',
    });
  });
});

describe('TC-TENTHANG-23..24 — quyền và nhật ký', () => {
  it('TC-TENTHANG-23: người ngoài phòng không đặt được tên tháng (quyền = quyền sửa)', async () => {
    const apiAdmin = await loginAs(admin);
    const { work, task } = await dungCay(apiAdmin);

    const api = await loginAs(nguoiNgoai);
    const cv = await api.put(`/api/v1/works/${work.code}/month-names/2026-09`, { name: 'X' });
    const nv = await api.put(`/api/v1/work-items/${task.code}/month-names/2026-09`, { name: 'X' });
    expect(cv.status).toBe(403);
    expect(nv.status).toBe(403);

    // Không có tên nào lọt vào CSDL.
    const list = await apiAdmin.get('/api/v1/works');
    expect(list.body.data.works.find((w) => w.code === work.code).month_names).toEqual({});
  });

  it('TC-TENTHANG-24: nhật ký ghi tháng, tên mới và tên trước đó ở cả cấp 1 và cấp 3', async () => {
    const api = await loginAs(admin);
    const { work, task } = await dungCay(api);

    await api.put(`/api/v1/works/${work.code}/month-names/2026-09`, { name: 'Bản một' });
    await api.put(`/api/v1/works/${work.code}/month-names/2026-09`, { name: 'Bản hai' });
    await api.put(`/api/v1/work-items/${task.code}/month-names/2026-09`, { name: 'NV bản một' });
    await api.del(`/api/v1/work-items/${task.code}/month-names/2026-09`);

    const dat = await choNhatKy(
      api,
      `/api/v1/works/${work.code}/history?scope=tree`,
      'works.setMonthName',
      2
    );
    expect(dat.details).toMatchObject({ month: '2026-09', name: 'Bản hai' });
    // `previousName` là dấu vết duy nhất của tên tháng đã bị ghi đè.
    expect(dat.details.previousName).toBe('Bản một');

    const bo = await choNhatKy(
      api,
      `/api/v1/works/${work.code}/history?scope=tree`,
      'workItems.clearMonthName'
    );
    expect(bo.details).toMatchObject({ code: task.code, month: '2026-09' });
    expect(bo.details.previousName).toBe('NV bản một');
  });
});
