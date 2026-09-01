// Truy vấn 4 bảng «kết quả nhiệm vụ là file» (014_nhiem_vu_file_ket_qua.sql) — nhóm, bản, góp ý,
// bảng luồng. SQL viết tay, tham số hoá 100%; tên cột chỉ đến từ danh sách khai ở đây.
//
// Bốn bảng là bốn tầng của cùng một tính năng nhưng tách bảng để mỗi tầng có vòng đời riêng:
//   task_files          NHÓM file của MỘT nhiệm vụ — đi riêng một luồng nộp → góp ý → duyệt
//   task_file_versions  BẢN (v1, v2, …) — mỗi lần nộp là một bản mới, KHÔNG ghi đè bản cũ
//   task_file_comments  GÓP Ý gắn theo BẢN (góp ý của bản nào là của đúng bản đó)
//   task_file_flow      BẢNG LUỒNG — một dòng cho MỖI hành động, kể cả «Tự động»
// JOIN users để trả TÊN người kèm mỗi dòng: giao diện không phải gọi thêm API nào.
import { pool } from '../../db/pool.js';

const db = (client) => client ?? pool;

const NHOM = `f.id, f.item_id, f.ten_goc, f.trang_thai, f.created_by, f.created_at,
              cu.full_name AS ten_nguoi_tao`;
const BAN = `v.id, v.file_id, v.version_no, v.ten_luu, v.ten_goc, v.loai_mime, v.kich_thuoc,
             v.uploaded_by, v.uploaded_at, uu.full_name AS ten_nguoi_nop`;

export async function themNhom({ itemId, tenGoc, trangThai, createdBy }, client) {
  const { rows } = await db(client).query(
    `INSERT INTO task_files (item_id, ten_goc, trang_thai, created_by)
     VALUES ($1, $2, $3, $4) RETURNING id, item_id, ten_goc, trang_thai, created_by, created_at`,
    [itemId, tenGoc, trangThai, createdBy]
  );
  return rows[0];
}

/** Khoá dòng nhóm trong giao dịch (`FOR UPDATE`): hai người cùng nộp/duyệt thì xếp hàng. */
export async function lockNhomById(id, client) {
  const { rows } = await db(client).query(
    `SELECT ${NHOM} FROM task_files f
      JOIN users cu ON cu.id = f.created_by WHERE f.id = $1 FOR UPDATE OF f`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findNhomById(id, client = null) {
  const { rows } = await db(client).query(
    `SELECT ${NHOM} FROM task_files f
      JOIN users cu ON cu.id = f.created_by WHERE f.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function listNhomByItem(itemId, client = null) {
  const { rows } = await db(client).query(
    `SELECT ${NHOM} FROM task_files f
      JOIN users cu ON cu.id = f.created_by WHERE f.item_id = $1 ORDER BY f.id`,
    [itemId]
  );
  return rows;
}

export async function xoaNhom(id, client) {
  await db(client).query('DELETE FROM task_files WHERE id = $1', [id]);
}

export async function soBanCaoNhat(fileId, client) {
  const { rows } = await db(client).query(
    'SELECT COALESCE(MAX(version_no), 0)::int AS n FROM task_file_versions WHERE file_id = $1',
    [fileId]
  );
  return rows[0].n;
}

export async function themBan(
  { fileId, versionNo, tenLuu, tenGoc, loaiMime, kichThuoc, uploadedBy },
  client
) {
  const { rows } = await db(client).query(
    `INSERT INTO task_file_versions
       (file_id, version_no, ten_luu, ten_goc, loai_mime, kich_thuoc, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, file_id, version_no, ten_luu, ten_goc, loai_mime, kich_thuoc,
               uploaded_by, uploaded_at`,
    [fileId, versionNo, tenLuu, tenGoc, loaiMime, kichThuoc, uploadedBy]
  );
  return rows[0];
}

export async function findBanById(id, client = null) {
  const { rows } = await db(client).query(
    `SELECT ${BAN} FROM task_file_versions v
      JOIN users uu ON uu.id = v.uploaded_by WHERE v.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function listBanByFile(fileId, client = null) {
  const { rows } = await db(client).query(
    `SELECT ${BAN} FROM task_file_versions v
      JOIN users uu ON uu.id = v.uploaded_by WHERE v.file_id = $1 ORDER BY v.version_no`,
    [fileId]
  );
  return rows;
}

/** Bản mới nhất của nhóm — «người phải sửa» tính từ người nộp bản cuối. */
export async function banCuoiCung(fileId, client) {
  const { rows } = await db(client).query(
    `SELECT ${BAN} FROM task_file_versions v
      JOIN users uu ON uu.id = v.uploaded_by WHERE v.file_id = $1
     ORDER BY v.version_no DESC LIMIT 1`,
    [fileId]
  );
  return rows[0] ?? null;
}

export async function themGopY({ versionId, nguoiId, vai, noiDung, trang }, client) {
  const { rows } = await db(client).query(
    `INSERT INTO task_file_comments (version_id, nguoi_id, vai, noi_dung, trang)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, version_id, nguoi_id, vai, noi_dung, trang, created_at`,
    [versionId, nguoiId, vai, noiDung, trang ?? null]
  );
  return rows[0];
}

export async function listGopYByFile(fileId, client = null) {
  const { rows } = await db(client).query(
    `SELECT c.id, c.version_id, c.nguoi_id, c.vai, c.noi_dung, c.trang, c.created_at,
            u.full_name AS ten_nguoi
       FROM task_file_comments c
       JOIN users u ON u.id = c.nguoi_id
       JOIN task_file_versions v ON v.id = c.version_id
      WHERE v.file_id = $1 ORDER BY c.id`,
    [fileId]
  );
  return rows;
}

export async function themLuong({ fileId, versionId, nguoiId, vai, hanhDong, noiDung }, client) {
  const { rows } = await db(client).query(
    `INSERT INTO task_file_flow (file_id, version_id, nguoi_id, vai, hanh_dong, noi_dung)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, file_id, version_id, nguoi_id, vai,
                                               hanh_dong, noi_dung, created_at`,
    [fileId, versionId ?? null, nguoiId, vai, hanhDong, noiDung ?? '']
  );
  return rows[0];
}

export async function listLuongByFile(fileId, client = null) {
  const { rows } = await db(client).query(
    `SELECT g.id, g.version_id, g.nguoi_id, g.vai, g.hanh_dong, g.noi_dung, g.created_at,
            u.full_name AS ten_nguoi, v.version_no
       FROM task_file_flow g
       JOIN users u ON u.id = g.nguoi_id
       LEFT JOIN task_file_versions v ON v.id = g.version_id
      WHERE g.file_id = $1 ORDER BY g.id DESC`,
    [fileId]
  );
  return rows;
}

export async function doiTrangThai(fileId, trangThai, client) {
  const { rows } = await db(client).query(
    'UPDATE task_files SET trang_thai = $2 WHERE id = $1 RETURNING id, trang_thai',
    [fileId, trangThai]
  );
  return rows[0] ?? null;
}

/**
 * Trưởng phòng / Phó phòng của MỘT phòng — người nhận thông báo «có file chờ xem».
 * Nguồn là `users` (vai + department_id) chứ không phải `department_managers`: một người thuộc
 * ĐÚNG MỘT phòng (§13.4 mục 1) nên phòng của vai này là nơi họ đứng tên.
 */
export async function truongPhongPhoPhong(phongId, client = null) {
  if (phongId == null) return [];
  const { rows } = await db(client).query(
    `SELECT id, full_name FROM users
      WHERE department_id = $1 AND role IN ('Trưởng phòng', 'Phó phòng') AND is_active`,
    [phongId]
  );
  return rows;
}
