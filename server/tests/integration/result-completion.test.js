import { afterAll, beforeEach, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/db/pool.js';
import { makeItem, makeWork, pool, resetTables } from '../helpers/db.js';
import { client, makeLoginUser } from '../helpers/http.js';
import { quetQuaHan } from '../../src/services/cron.js';
const app = createApp();
let admin, api, work, sub, task;
beforeEach(async () => {
  await resetTables();
  admin = await makeLoginUser({ role: 'admin' });
  api = client(app);
  await api.login(admin.email);
  work = await makeWork();
  sub = await makeItem({ work_id: work.id });
  task = await makeItem({ code: 'DA001-02', work_id: work.id, parent_id: sub.id, level: 3 });
  await pool.query(
    "UPDATE work_items SET status='Hoàn thành', due_date='2020-01-01',assignee_id=$1,ty_le=100",
    [admin.id]
  );
});
afterAll(closePool);
async function group(state = 'da-duyet', weight = 100, version = true) {
  const {
    rows: [f],
  } = await pool.query(
    `INSERT INTO task_files(item_id,ten_goc,ten_ket_qua,dinh_dang,trang_thai,ty_le,created_by) VALUES($1,'kết quả.pdf','Kết quả <thử>','PDF',$2,$3,$4) RETURNING *`,
    [task.id, state, weight, admin.id]
  );
  if (version)
    await pool.query(
      `INSERT INTO task_file_versions(file_id,version_no,ten_luu,ten_goc,loai_mime,kich_thuoc,uploaded_by) VALUES($1,1,'test-only.pdf','kết quả.pdf','application/pdf',1,$2)`,
      [f.id, admin.id]
    );
  return f;
}
async function bundle() {
  const r = await api.get('/api/v1/bootstrap');
  expect(r.status).toBe(200);
  return r.body.data;
}
it('TC-KQ-DONE-01: status tay Hoàn thành nhưng không có nhóm không hoàn thành ở bootstrap, stats, cron', async () => {
  const b = await bundle();
  expect(b.items.find((i) => i.id === task.id)).toMatchObject({
    hoan_thanh: false,
    tien_do: 0,
    ket_qua_files: [],
  });
  expect(b.summaryStats).toMatchObject({
    totalTasks: 1,
    completedTasks: 0,
    ongoingTasks: 1,
    overdueTasks: 1,
  });
  expect((await api.get('/api/v1/stats/summary')).body.data.completedTasks).toBe(0);
  expect((await quetQuaHan()).quaHan).toBe(1);
});
it('TC-KQ-DONE-02: tất cả nhóm có bản đã duyệt hoàn thành cả ba cấp dù status cũ Tạm dừng', async () => {
  await group();
  await pool.query("UPDATE work_items SET status='Tạm dừng'");
  const b = await bundle();
  expect(b.items.every((i) => i.hoan_thanh === true)).toBe(true);
  expect(b.works[0].hoan_thanh).toBe(true);
  expect(b.summaryStats.completedTasks).toBe(1);
  expect(b.items.find((i) => i.id === task.id).ket_qua_files[0]).toMatchObject({
    ten_ket_qua: 'Kết quả <thử>',
    tienDo: 100,
    co_ban: true,
  });
  expect((await quetQuaHan()).quaHan).toBe(0);
  const tree = (await api.get('/api/v1/works/tree')).body.data;
  expect(tree.works[0].hoan_thanh).toBe(true);
  const chart = (await api.get('/api/v1/stats/charts?type=status')).body.data;
  expect(chart.labels).toEqual(['Đã duyệt đủ kết quả']);
});
it('TC-KQ-DONE-03: nhóm trọng số 0 chưa duyệt, nhóm 0 bản, mốc giữa luồng 100 không được chốt', async () => {
  await group();
  const pending = await group('cho-xem', 0);
  let b = await bundle();
  expect(b.items.find((i) => i.id === task.id)).toMatchObject({ hoan_thanh: false, tien_do: 100 });
  await pool.query("UPDATE task_files SET trang_thai='da-duyet' WHERE id=$1", [pending.id]);
  await pool.query('DELETE FROM task_file_versions WHERE file_id=$1', [pending.id]);
  b = await bundle();
  expect(b.items.find((i) => i.id === task.id).hoan_thanh).toBe(false);
});
it('TC-KQ-DONE-04: REST cũ không còn ghi status/completion thủ công; dữ liệu lịch sử giữ nguyên', async () => {
  const r = await api.patch('/api/v1/work-items/' + task.code, {
    status: 'Đang thực hiện',
    completion: 100,
  });
  expect(r.status).toBe(200);
  const {
    rows: [row],
  } = await pool.query('SELECT status,completion FROM work_items WHERE id=$1', [task.id]);
  expect(row.status).toBe('Hoàn thành');
  expect(row.completion).toBe(0);
});

it('TC-KQ-DONE-05: đổi mốc giữa luồng thành 100 không chốt; đã duyệt 75 vẫn hoàn thành', async () => {
  const f = await group('cho-xem');
  await pool.query("INSERT INTO system_settings(setting_key,setting_value) VALUES('workflow',$1)", [
    { fileProgress: { canBoGuiTpPp: 100 } },
  ]);
  let b = await bundle();
  expect(b.items.find((i) => i.id === task.id)).toMatchObject({ hoan_thanh: false, tien_do: 100 });
  await pool.query("UPDATE system_settings SET setting_value=$1 WHERE setting_key='workflow'", [
    { fileProgress: { tpPpDaDuyetGuiPgd: 70, daDuyet: 75 } },
  ]);
  await pool.query("UPDATE task_files SET trang_thai='da-duyet' WHERE id=$1", [f.id]);
  b = await bundle();
  expect(b.items.find((i) => i.id === task.id)).toMatchObject({ hoan_thanh: true, tien_do: 75 });
});
it('TC-KQ-DONE-06: nhiều phiên bản chỉ là một nhóm; ngày hoàn thành lấy từ lần duyệt bản mới nhất', async () => {
  const f = await group();
  const {
    rows: [version],
  } = await pool.query(
    `INSERT INTO task_file_versions(file_id,version_no,ten_luu,ten_goc,loai_mime,kich_thuoc,uploaded_by) VALUES($1,2,'test-only-v2.pdf','bản mới.pdf','application/pdf',1,$2) RETURNING id`,
    [f.id, admin.id]
  );
  await pool.query(
    "INSERT INTO task_file_flow(file_id,version_id,vai,hanh_dong,created_at) VALUES($1,$2,'admin','duyet','2026-09-10T01:00:00Z')",
    [f.id, version.id]
  );
  await pool.query("UPDATE work_items SET report_date='2020-01-01' WHERE id=$1", [task.id]);
  const b = await bundle(),
    t = b.items.find((i) => i.id === task.id);
  expect(t.ket_qua_files).toHaveLength(1);
  expect(t.ket_qua_files[0]).toMatchObject({
    ban_cuoi_id: version.id,
    ten_ban_cuoi: 'bản mới.pdf',
    so_ban: 2,
    ten_nguoi_nop: admin.full_name,
  });
  expect(t.hoan_thanh_luc).toBe('2026-09-10T01:00:00.000Z');
  expect(JSON.stringify(t.ket_qua_files)).not.toMatch(/ten_luu|test-only|noi_dung/);
  const rpc = await api.post('/api/rpc/getTasks', { args: [] });
  expect(rpc.status).toBe(200);
  const rt = rpc.body.data.find((i) => i['Mã nhiệm vụ'] === task.code);
  expect(rt).toMatchObject({ hoanThanh: true, ketQuaFiles: t.ket_qua_files });
});
it('TC-KQ-DONE-07: nhóm chưa có bản và nhiệm vụ con tỷ lệ 0 đều ngăn cha hoàn thành', async () => {
  await group();
  const other = await makeItem({ code: 'DA001-03', work_id: work.id, parent_id: sub.id, level: 3 });
  await pool.query('UPDATE work_items SET ty_le=0 WHERE id=$1', [other.id]);
  const b = await bundle();
  expect(b.items.find((i) => i.id === task.id).hoan_thanh).toBe(true);
  expect(b.items.find((i) => i.id === sub.id)).toMatchObject({ tien_do: 100, hoan_thanh: false });
  expect(b.works[0].hoan_thanh).toBe(false);
});
