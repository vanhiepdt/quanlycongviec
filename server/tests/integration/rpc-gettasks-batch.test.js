// Hết nợ N+1 của `getTasks` (§13.5, đo ở §8.5 C6): một lời gọi RPC phải dùng SỐ TRUY VẤN NGHIỆP
// VỤ KHÔNG ĐỔI theo số công việc.
//
// Cách canh: bọc `pool.query` bằng spy và đếm câu SQL chạm tới `works` / `work_items` /
// `reminders`. Bản N+1 quét từng công việc một route `/work-items` ⇒ đếm tăng theo số công việc;
// bản gộp (`cayChoUser`) là hằng số. Truy vấn phiên/audit/CSRF không nằm trong phép đếm.
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import { COL } from '../../src/rpc/legacyFields.js';
import { makeDepartment, makeItem, makeWork, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';

const app = createApp();
const SQL_NGHIEP_VU = /(from|into|update)\s+(works|work_items|reminders)\b/i;

let phong;
let admin;
let apiAdmin;

beforeEach(async () => {
  await resetTables();
  phong = await makeDepartment({ code: 'PH01', name: 'Phòng A' });
  admin = await makeLoginUser({
    code: 'NV001',
    full_name: 'Quản trị Hệ thống',
    email: 'admin@test.local',
    role: 'admin',
    department_id: phong.id,
  });
  apiAdmin = await client(app);
  await apiAdmin.login(admin.email);

  // 6 công việc, mỗi việc 1 công việc con + 1 nhiệm vụ ⇒ bản cũ phải gọi ít nhất 6 lần
  // /work-items; nếu vẫn còn N+1 thì phép đếm dưới đây đỏ ngay.
  for (let i = 1; i <= 6; i += 1) {
    const work = await makeWork({
      code: `CV00${i}`,
      name: `Công việc ${i}`,
      department_id: phong.id,
    });
    const sub = await makeItem({
      code: `CV00${i}-01`,
      work_id: work.id,
      level: 2,
    });
    await makeItem({
      code: `CV00${i}-02`,
      work_id: work.id,
      parent_id: sub.id,
      level: 3,
      name: `Nhiệm vụ ${i}`,
    });
  }
});

afterAll(async () => {
  await closePool();
});

async function demTruyVanKhiGoiGetTasks() {
  const spy = vi.spyOn(pool, 'query');
  try {
    const res = await apiAdmin.post('/api/rpc/getTasks', { args: [{}] });
    expect(res.status).toBe(200);
    return {
      res,
      soCauNghiepVu: spy.mock.calls.filter(([sql]) => SQL_NGHIEP_VU.test(String(sql))).length,
    };
  } finally {
    spy.mockRestore();
  }
}

describe('RPC getTasks — hết nợ N+1', () => {
  it('trả đủ cây phẳng legacy: 12 dòng gồm cả cấp 2, có nhắc việc dạng mảng', async () => {
    const { res } = await demTruyVanKhiGoiGetTasks();
    const tasks = res.body.data;
    expect(tasks).toHaveLength(12);
    const motCap3 = tasks.find((t) => t[COL.T_ID] === 'CV001-02');
    expect(motCap3[COL.T_PID]).toBe('CV001');
    expect(Array.isArray(motCap3[COL.T_REMINDERS])).toBe(true);
  });

  it('số truy vấn nghiệp vụ KHÔNG đổi theo số công việc — gộp còn ≤ 4 câu', async () => {
    const { soCauNghiepVu } = await demTruyVanKhiGoiGetTasks();
    // Gói gộp: list works (1) + listForWorks (1) + mapByItemIds (1) = 3.
    // Bản N+1 với 6 công việc là ≥ 8 câu — chặn trần 4 để dư địa cho truy vấn phụ trợ hợp lệ.
    expect(soCauNghiepVu).toBeLessThanOrEqual(4);
    expect(soCauNghiepVu).toBeGreaterThan(0);
  });
});
