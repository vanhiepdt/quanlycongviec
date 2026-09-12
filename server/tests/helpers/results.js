// Fixture file đã có bản và được duyệt, thay cho việc chỉ đặt status tay ở đầu việc.
import { pool } from './db.js';
export async function makeApprovedResult(itemId, approvedAt = new Date()) {
  const {
    rows: [file],
  } = await pool.query(
    "INSERT INTO task_files(item_id,ten_goc,trang_thai,ty_le) VALUES($1,'kết quả.pdf','da-duyet',100) RETURNING id",
    [itemId]
  );
  const {
    rows: [version],
  } = await pool.query(
    "INSERT INTO task_file_versions(file_id,version_no,ten_luu,ten_goc,loai_mime,kich_thuoc) VALUES($1,1,'fixture.pdf','kết quả.pdf','application/pdf',1) RETURNING id",
    [file.id]
  );
  await pool.query(
    "INSERT INTO task_file_flow(file_id,version_id,vai,hanh_dong,created_at) VALUES($1,$2,'admin','duyet',$3)",
    [file.id, version.id, approvedAt]
  );
  return file;
}
