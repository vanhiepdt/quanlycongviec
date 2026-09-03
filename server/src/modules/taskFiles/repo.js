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

/**
 * LÃNH ĐẠO PHÒNG PHỤ TRÁCH nhiệm vụ — người dùng chốt 2026-09-02: «khi có file lên thì Lãnh đạo
 * phòng phụ trách của nhiệm vụ đấy sẽ là người xem/sửa/duyệt, đồng thời nhận được thông báo».
 *
 * Gộp HAI nguồn, vì hai nguồn trả lời hai câu khác nhau và thiếu một nguồn là mất người:
 *   `users`               — TP/PP đứng tên ở phòng đó (`truongPhongPhoPhong` ở trên).
 *   `department_managers` — người được GẮN phụ trách phòng đó với vai 'head'/'vice' (bảng 001).
 * Một người có thể xuất hiện ở cả hai ⇒ `DISTINCT` theo id. Không lấy 'deputy_director': đó là
 * Phó Giám đốc, cấp duyệt cuối, đã có `phoGiamDocPhuTrach` riêng.
 */
export async function lanhDaoPhuTrach(phongId, client = null) {
  if (phongId == null) return [];
  const { rows } = await db(client).query(
    `SELECT DISTINCT u.id, u.full_name, u.role
       FROM users u
      WHERE u.is_active AND (
              (u.department_id = $1 AND u.role IN ('Trưởng phòng', 'Phó phòng'))
              OR EXISTS (SELECT 1 FROM department_managers dm
                          WHERE dm.user_id = u.id AND dm.department_id = $1
                            AND dm.role IN ('head', 'vice'))
            )
      ORDER BY u.id`,
    [phongId]
  );
  return rows;
}

/**
 * HÀNG CHỜ PHÊ DUYỆT KẾT QUẢ (tab riêng, người dùng chốt 2026-09-02) — các nhóm file đang chờ
 * CHÍNH người này xử, kèm tên nhiệm vụ + mã + bản mới nhất.
 *
 * Ai thấy gì (khớp `BANG_VERDICT` + `laLanhDaoPhuTrachNhiemVu` của service — không có luật quyền
 * thứ hai ở SQL này, chỉ có PHẠM VI):
 *   TP/PP        : 'cho-xem' + 'can-sua' của nhiệm vụ mà họ ĐƯỢC NÊU trong `leader_ids`.
 *   Phó Giám đốc : 'cho-lanh-dao' của nhiệm vụ trong các phòng mình PHỤ TRÁCH.
 *   admin        : cả ba trạng thái, mọi phòng.
 * Các vai khác: rỗng — họ không có cửa duyệt nào.
 *
 * 2026-09-02 (siết theo yêu cầu «không phải lãnh đạo phòng phụ trách nhiệm vụ đấy vẫn sửa, phê
 * duyệt được»): điều kiện của TP/PP KHÔNG còn là `i.department_id = phòng mình` mà là
 * `user.id = ANY(i.leader_ids)`. Nhiệm vụ chưa gán lãnh đạo ⇒ KHÔNG TP/PP nào thấy (phải gán
 * trước) — đúng phương án «chặt tuyệt đối» người dùng chọn; admin/Phó GĐ vẫn xử được nên file
 * không bao giờ bị treo vĩnh viễn.
 *
 * `phongIds` rỗng với Phó Giám đốc chưa được gắn phòng nào ⇒ trả rỗng, không phải trả tất cả.
 */
export async function listChoDuyetKetQua({ vai, nguoiId, phongIds }, client = null) {
  let dieuKienTrangThai;
  let dieuKienPhong;
  const tham = [];
  if (vai === 'admin') {
    dieuKienTrangThai = `f.trang_thai IN ('cho-xem', 'can-sua', 'cho-lanh-dao')`;
    dieuKienPhong = 'TRUE';
  } else if (vai === 'Trưởng phòng' || vai === 'Phó phòng') {
    if (nguoiId == null) return [];
    dieuKienTrangThai = `f.trang_thai IN ('cho-xem', 'can-sua')`;
    tham.push(Number(nguoiId));
    dieuKienPhong = `$${tham.length}::bigint = ANY(i.leader_ids)`;
  } else if (vai === 'Phó Giám đốc') {
    const ds = (phongIds ?? []).map(Number).filter(Number.isFinite);
    if (ds.length === 0) return [];
    dieuKienTrangThai = `f.trang_thai = 'cho-lanh-dao'`;
    tham.push(ds);
    dieuKienPhong = `i.department_id = ANY($${tham.length}::bigint[])`;
  } else {
    return [];
  }
  const { rows } = await db(client).query(
    `SELECT f.id, f.item_id, f.ten_goc, f.trang_thai, f.created_at,
            cu.full_name AS ten_nguoi_tao,
            i.code AS ma_nhiem_vu, i.name AS ten_nhiem_vu, i.department_id, i.leader_ids,
            i.assignee_id, i.parent_id, i.work_id,
            cha.code AS ma_cv_con, cha.name AS ten_cv_con,
            w.code AS ma_cong_viec, w.name AS ten_cong_viec,
            d.name AS ten_phong,
            v.id AS ban_cuoi_id, v.version_no AS ban_cuoi_so, v.uploaded_at AS ban_cuoi_luc,
            vu.full_name AS ban_cuoi_nguoi,
            (SELECT count(*) FROM task_file_versions tv WHERE tv.file_id = f.id)::int AS so_ban,
            (SELECT count(*) FROM task_file_comments tc
               JOIN task_file_versions tv2 ON tv2.id = tc.version_id
              WHERE tv2.file_id = f.id)::int AS so_y_kien
       FROM task_files f
       JOIN users cu       ON cu.id = f.created_by
       JOIN work_items i   ON i.id = f.item_id
       JOIN works w        ON w.id = i.work_id
       LEFT JOIN work_items cha ON cha.id = i.parent_id
       LEFT JOIN departments d ON d.id = i.department_id
       LEFT JOIN LATERAL (
         SELECT id, version_no, uploaded_at, uploaded_by
           FROM task_file_versions
          WHERE file_id = f.id
          ORDER BY version_no DESC LIMIT 1
       ) v ON TRUE
       LEFT JOIN users vu  ON vu.id = v.uploaded_by
      WHERE ${dieuKienTrangThai} AND ${dieuKienPhong}
      ORDER BY w.code, cha.code NULLS FIRST, i.code,
               COALESCE(v.uploaded_at, f.created_at) DESC, f.id DESC
      LIMIT 200`,
    tham
  );
  return rows;
}

/**
 * Nhiều người theo danh sách id — dùng cho `leader_ids` của MỘT nhiệm vụ (2026-09-02: người dùng
 * chốt chỉ LÃNH ĐẠO PHÒNG PHỤ TRÁCH của chính nhiệm vụ đó mới xử được file, nên người nhận thông
 * báo cũng phải đúng danh sách này chứ không phải mọi TP/PP của phòng).
 * Id không tồn tại / đã vô hiệu hoá thì rơi ra — gọi xong phải xử lý trường hợp mảng rỗng.
 */
export async function nguoiTheoIds(ids, client = null) {
  const ds = (ids ?? []).map(Number).filter(Number.isFinite);
  if (ds.length === 0) return [];
  const { rows } = await db(client).query(
    `SELECT id, full_name, role FROM users
      WHERE id = ANY($1::bigint[]) AND is_active ORDER BY id`,
    [ds]
  );
  return rows;
}

/** Một người theo id — dùng khi ONLYOFFICE gửi `users[0]` và ta phải biết đó là ai (tên + vai). */
export async function nguoiTheoId(id, client = null) {
  if (id == null || !Number.isFinite(Number(id))) return null;
  const { rows } = await db(client).query(
    'SELECT id, full_name, role, department_id FROM users WHERE id = $1 AND is_active',
    [Number(id)]
  );
  return rows[0] ?? null;
}
