// Truy vấn 4 bảng «kết quả nhiệm vụ là file» (014_nhiem_vu_file_ket_qua.sql, nới 016). SQL viết
// tay, tham số hoá 100%; tên cột chỉ đến từ danh sách khai ở đây.
//
// Bốn bảng là bốn tầng của cùng một tính năng nhưng tách bảng để mỗi tầng có vòng đời riêng:
//   task_files          NHÓM file của MỘT nhiệm vụ — đi riêng một luồng nộp → góp ý → duyệt
//   task_file_versions  BẢN (v1, v2, …) — mỗi lần nộp là một bản mới, KHÔNG ghi đè bản cũ
//   task_file_comments  GÓP Ý gắn theo BẢN (góp ý của bản nào là của đúng bản đó)
//   task_file_flow      BẢNG LUỒNG — một dòng cho MỖI hành động, kể cả «Tự động»
// JOIN users để trả TÊN người kèm mỗi dòng: giao diện không phải gọi thêm API nào.
//
// 016 thêm ba cột vào danh sách chọn: `ten_ket_qua`/`dinh_dang` của NHÓM (khai trước khi có file —
// dòng «Chưa có») và `noi_dung` của BẢN (bản «Báo cáo» không có file). Nhóm 0 bản là hợp lệ từ 016.
import { pool } from '../../db/pool.js';
import { updateFileWeights } from './weights.js';
import { read as readSettings } from '../systemSettings/service.js';
import { fileProgress } from '../systemSettings/defaults.js';
import { sqlSupervisorHieuLuc } from '../workItems/repo.js';

const db = (client) => client ?? pool;

// ĐỢT B (điểm 7): thêm MỐC «TP/PP PHÊ DUYỆT» — ai ký (`tp_duyet_boi` + tên) và ký lúc nào
// (`tp_duyet_luc`). Hai cột này nằm trong danh sách dùng chung nên MỌI đường đọc nhóm file đều
// mang mốc theo, giao diện không phải gọi thêm API nào.
const NHOM = `f.id, f.item_id, f.ten_goc, f.ten_ket_qua, f.dinh_dang, f.trang_thai,
              f.lenh_sua_cho, f.lenh_sua_ly_do, f.lenh_sua_ghi_chu,
              f.ty_le, f.ty_le_tu_dong, f.created_by, f.created_at, cu.full_name AS ten_nguoi_tao,
              f.tp_duyet_boi, f.tp_duyet_luc, tpb.full_name AS ten_nguoi_tp_duyet`;
const JOIN_NHOM = `JOIN users cu ON cu.id = f.created_by
      LEFT JOIN users tpb ON tpb.id = f.tp_duyet_boi`;
const BAN = `v.id, v.file_id, v.version_no, v.ten_luu, v.ten_goc, v.loai_mime, v.kich_thuoc,
             v.noi_dung, v.uploaded_by, v.uploaded_at, uu.full_name AS ten_nguoi_nop`;

/**
 * Mở NHÓM kết quả. `tenKetQua`/`dinhDang` là phần người dùng KHAI (016); `tenGoc` vẫn là tên file
 * đầu tiên — nhóm khai trước khi có file thì lấy chính tên kết quả làm `tenGoc` (cột NOT NULL từ
 * 014, và giao diện cũ lùi về nó khi `ten_ket_qua` trống).
 */
export async function themNhom(
  { itemId, tenGoc, tenKetQua = null, dinhDang = null, trangThai, createdBy },
  client
) {
  await db(client).query('SELECT id FROM work_items WHERE id=$1 FOR UPDATE', [itemId]);
  const { rows } = await db(client).query(
    `INSERT INTO task_files (item_id, ten_goc, ten_ket_qua, dinh_dang, trang_thai, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, item_id, ten_goc, ten_ket_qua, dinh_dang, trang_thai, created_by, created_at`,
    [itemId, tenGoc, tenKetQua ?? tenGoc, dinhDang, trangThai, createdBy]
  );
  const weights = await updateFileWeights(itemId, client, { addedId: rows[0].id });
  return {
    ...rows[0],
    ty_le: weights.find((r) => String(r.id) === String(rows[0].id))?.ty_le,
    ty_le_tu_dong: true,
  };
}

/** Khoá dòng nhóm trong giao dịch (`FOR UPDATE`): hai người cùng nộp/duyệt thì xếp hàng. */
export async function lockNhomById(id, client) {
  // Cùng thứ tự với thêm/chia tỷ lệ: nhiệm vụ trước, rồi nhóm. Đọc lại nhóm SAU khóa
  // để trường hợp vừa bị xóa không dùng ảnh chụp cũ.
  const target = await db(client).query('SELECT item_id FROM task_files WHERE id=$1', [id]);
  if (!target.rows[0]) return null;
  await db(client).query('SELECT id FROM work_items WHERE id=$1 FOR UPDATE', [
    target.rows[0].item_id,
  ]);
  const { rows } = await db(client).query(
    `SELECT ${NHOM} FROM task_files f
      ${JOIN_NHOM} WHERE f.id = $1 FOR UPDATE OF f`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findNhomById(id, client = null) {
  const { rows } = await db(client).query(
    `SELECT ${NHOM} FROM task_files f
      ${JOIN_NHOM} WHERE f.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Mọi nhóm kết quả của một nhiệm vụ, kèm NGƯỜI THỰC HIỆN TRỰC TIẾP của nhiệm vụ đó.
 *
 * Hai cột thêm (12/09/2026) không nằm trong hằng `NHOM` vì `NHOM` là danh sách dùng chung của các
 * truy vấn đọc theo ID đơn lẻ — chỉ bảng «Kết quả» của giao diện mới cần biết ai là người thực hiện:
 * cột «Người thực hiện» của từng BẢN chỉ được ghi «Người thực hiện trực tiếp» khi đúng người đó tải
 * lên lần đầu hoặc trực tiếp sửa bản bị trả về, còn lại phải ghi «người duyệt/người sửa».
 */
export async function listNhomByItem(itemId, client = null) {
  const { rows } = await db(client).query(
    `SELECT ${NHOM}, w.assignee_id, nv.full_name AS ten_nguoi_thuc_hien
       FROM task_files f
      ${JOIN_NHOM}
      JOIN work_items w ON w.id = f.item_id
      LEFT JOIN users nv ON nv.id = w.assignee_id
      WHERE f.item_id = $1 ORDER BY f.id`,
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

/**
 * Thêm BẢN. Hai dạng loại trừ nhau, CHECK `tfv_file_hoac_chu` (016) canh ở CSDL:
 *   FILE     : `tenLuu` + `loaiMime` + `kichThuoc` đủ ba, `noiDung` bỏ trống.
 *   BÁO CÁO  : `noiDung` là chữ (≥ 10 ký tự), ba cột file để NULL — không sinh file vật lý nào.
 * `tenGoc` luôn phải có: bản báo cáo cũng cần một tiêu đề để in ra bảng kết quả.
 */
export async function themBan(
  {
    fileId,
    versionNo,
    tenLuu = null,
    tenGoc,
    loaiMime = null,
    kichThuoc = null,
    noiDung = null,
    uploadedBy,
  },
  client
) {
  const { rows } = await db(client).query(
    `INSERT INTO task_file_versions
       (file_id, version_no, ten_luu, ten_goc, loai_mime, kich_thuoc, noi_dung, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, file_id, version_no, ten_luu, ten_goc, loai_mime, kich_thuoc, noi_dung,
               uploaded_by, uploaded_at`,
    [fileId, versionNo, tenLuu, tenGoc, loaiMime, kichThuoc, noiDung, uploadedBy]
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

/**
 * Đổi trạng thái nhóm.
 *
 * ĐỢT B (điểm 7): mốc «TP/PP phê duyệt» chỉ sống từ lúc ký tới lúc nhóm BỊ TRẢ LẠI hoặc về nháp —
 * để nguyên mốc trên một nhóm đang `can-sua` là nói dối rằng bản hiện tại đã có TP/PP ký. Mốc được
 * đặt bởi `datMocTpPheDuyet`, hàm này chỉ lo phần XOÁ.
 */
export async function doiTrangThai(fileId, trangThai, client) {
  const { rows } = await db(client).query(
    `UPDATE task_files SET trang_thai = $2,
       lenh_sua_cho = CASE WHEN $2 = 'can-sua' THEN lenh_sua_cho ELSE NULL END,
       lenh_sua_ly_do = CASE WHEN $2 = 'can-sua' THEN lenh_sua_ly_do ELSE '' END,
       lenh_sua_ghi_chu = CASE WHEN $2 = 'can-sua' THEN lenh_sua_ghi_chu ELSE '' END,
       tp_duyet_boi = CASE WHEN $2 IN ('can-sua','cho-xem','luu-tam') THEN NULL ELSE tp_duyet_boi END,
       tp_duyet_luc = CASE WHEN $2 IN ('can-sua','cho-xem','luu-tam') THEN NULL ELSE tp_duyet_luc END
     WHERE id = $1 RETURNING id, trang_thai, lenh_sua_cho, lenh_sua_ly_do, lenh_sua_ghi_chu,
       tp_duyet_boi, tp_duyet_luc`,
    [fileId, trangThai]
  );
  return rows[0] ?? null;
}

export async function datLenhSua(fileId, cho, lyDo, client) {
  const { rows } = await db(client).query(
    `UPDATE task_files SET trang_thai = 'can-sua', lenh_sua_cho = $2,
       lenh_sua_ly_do = $3, lenh_sua_ghi_chu = '', tp_duyet_boi = NULL, tp_duyet_luc = NULL
     WHERE id = $1
     RETURNING id, trang_thai, lenh_sua_cho, lenh_sua_ly_do, lenh_sua_ghi_chu,
       tp_duyet_boi, tp_duyet_luc`,
    [fileId, cho, lyDo]
  );
  return rows[0];
}

/**
 * MỐC «TP/PP PHÊ DUYỆT» (ĐỢT B, điểm 7) — ghi AI ký và LÚC NÀO lên chính dòng nhóm.
 *
 * Vì sao cần một cột chứ không đọc bảng luồng: luồng là nhật ký mọi hành động, muốn biết «TP/PP đã
 * ký chưa» thì phải lọc + sắp xếp lại; còn bảng kết quả, hàng chờ và file Excel đều cần con dấu này
 * ngay trên dòng. Hai hành động được đóng dấu (`tp-phe-duyet` và `hoan-thanh`) đều là một lần
 * TP/PP ký — khác nhau ở chỗ một bên chuyển lên Ban lãnh đạo kiểm soát, một bên chốt luôn (Q11).
 *
 * `now()` lấy từ CSDL chứ không từ đồng hồ máy chủ: cùng nguồn với `created_at` của bảng luồng nên
 * hai mốc không lệch nhau khi so sánh.
 */
export async function datMocTpPheDuyet(fileId, nguoiId, client) {
  const { rows } = await db(client).query(
    `UPDATE task_files SET tp_duyet_boi = $2, tp_duyet_luc = now()
     WHERE id = $1 RETURNING tp_duyet_boi, tp_duyet_luc`,
    [fileId, nguoiId]
  );
  return rows[0] ?? null;
}

export async function luuGhiChu(fileId, ghiChu, client) {
  await db(client).query('UPDATE task_files SET lenh_sua_ghi_chu = $2 WHERE id = $1', [
    fileId,
    ghiChu,
  ]);
}

export async function nguoiRaLenh(fileId, client) {
  const { rows } = await db(client).query(
    `SELECT nguoi_id FROM task_file_flow WHERE file_id = $1
       AND hanh_dong IN ('tra-ve-cbo', 'tra-ve-tp')
     ORDER BY id DESC LIMIT 1`,
    [fileId]
  );
  return rows[0]?.nguoi_id ?? null;
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
 * V4: thêm nháp luu-tam cho admin hoặc CHÍNH người tạo nhóm ở mọi vai; vẫn qua can(read).
 *
 * 2026-09-02 (siết theo yêu cầu «không phải lãnh đạo phòng phụ trách nhiệm vụ đấy vẫn sửa, phê
 * duyệt được»): điều kiện của TP/PP KHÔNG còn là `i.department_id = phòng mình` mà là
 * `user.id = ANY(i.leader_ids)`. Nhiệm vụ chưa gán lãnh đạo ⇒ KHÔNG TP/PP nào thấy (phải gán
 * trước) — đúng phương án «chặt tuyệt đối» người dùng chọn; admin/Phó GĐ vẫn xử được nên file
 * không bao giờ bị treo vĩnh viễn.
 *
 * `phongIds` rỗng với Phó Giám đốc chưa được gắn phòng nào ⇒ trả rỗng, không phải trả tất cả.
 *
 * 016 — `AND v.id IS NOT NULL`: nhóm KHAI TRƯỚC còn 0 bản (dòng «Chưa có» trong khối «Kết quả») thì
 * KHÔNG vào hàng chờ. Chưa có bản nào thì không có gì để duyệt: hiện ra là dòng trống không bấm
 * được nút nào, lại còn đội con số trên tab lên. Nộp bản đầu (file hoặc «Báo cáo») là nó xuất hiện.
 */
export async function listChoDuyetKetQua(
  { vai, nguoiId, phongIds, lenhSua = false },
  client = null
) {
  let dieuKien;
  const tham = [];
  if (lenhSua) {
    if (nguoiId == null) return [];
    tham.push(Number(nguoiId), ['Trưởng phòng', 'Phó phòng'].includes(vai));
    dieuKien = `f.trang_thai = 'can-sua' AND ((f.lenh_sua_cho = 'can-bo' AND i.assignee_id = $1)
      OR (f.lenh_sua_cho = 'lanh-dao' AND $2::boolean AND $1::bigint = ANY(i.leader_ids)))`;
  } else if (vai === 'admin') {
    dieuKien = `f.trang_thai IN ('luu-tam', 'cho-xem', 'can-sua', 'cho-lanh-dao')`;
  } else {
    if (nguoiId == null) return [];
    tham.push(Number(nguoiId));
    // Q5: ở MỌI vai, bản nháp chỉ xuất hiện với người tạo nhóm, không với người duyệt.
    const nhapCuaToi = `(f.trang_thai = 'luu-tam' AND f.created_by = $1)`;
    if (['Trưởng phòng', 'Phó phòng'].includes(vai)) {
      dieuKien = `(${nhapCuaToi} OR ($1::bigint = ANY(i.leader_ids) AND
        (f.trang_thai = 'cho-xem' OR (f.trang_thai = 'can-sua' AND f.lenh_sua_cho IS DISTINCT FROM 'lanh-dao'))))`;
    } else if (vai === 'Phó Giám đốc') {
      tham.push((phongIds ?? []).map(Number).filter(Number.isFinite));
      dieuKien = `(${nhapCuaToi} OR (f.trang_thai = 'cho-lanh-dao' AND i.department_id = ANY($2::bigint[]) AND (NOT i.gui_bld_phe_duyet OR $1::bigint = ${sqlSupervisorHieuLuc('i.')})))`;
    } else if (vai === 'Nhân viên') {
      dieuKien = nhapCuaToi;
    } else return [];
  }
  const { rows } = await db(client).query(
    `SELECT f.id, f.item_id, f.ten_goc, f.ten_ket_qua, f.dinh_dang, f.trang_thai, f.created_at, f.created_by,
            f.lenh_sua_cho, f.lenh_sua_ly_do, f.lenh_sua_ghi_chu,
            f.tp_duyet_boi, f.tp_duyet_luc, tpb.full_name AS ten_nguoi_tp_duyet,
            cu.full_name AS ten_nguoi_tao,
            i.code AS ma_nhiem_vu, i.name AS ten_nhiem_vu, i.department_id, i.leader_ids,
            i.assignee_id, i.parent_id, i.work_id, i.gui_bld_phe_duyet, i.supervisor_ids,
            ${sqlSupervisorHieuLuc('i.')} AS supervisor_hieu_luc,
            cha.code AS ma_cv_con, cha.name AS ten_cv_con,
            w.code AS ma_cong_viec, w.name AS ten_cong_viec,
            d.name AS ten_phong,
            (i.approval_status = 'Đã duyệt' AND w.approval_status = 'Đã duyệt'
             AND (cha.id IS NULL OR cha.approval_status = 'Đã duyệt')) AS cay_da_duyet,
            v.id AS ban_cuoi_id, v.uploaded_by AS ban_cuoi_uploaded_by, v.version_no AS ban_cuoi_so, v.uploaded_at AS ban_cuoi_luc,
            v.ten_goc AS ban_cuoi_ten, v.noi_dung IS NOT NULL AS ban_cuoi_la_bao_cao,
            (SELECT count(*) FROM task_file_flow gx WHERE gx.file_id=f.id AND gx.hanh_dong IN ('tra-ve-tp','tra-ve-cbo'))::int AS so_tra_lai,
            vu.full_name AS ban_cuoi_nguoi,
            (SELECT count(*) FROM task_file_versions tv WHERE tv.file_id = f.id)::int AS so_ban,
            (SELECT count(*) FROM task_file_comments tc
               JOIN task_file_versions tv2 ON tv2.id = tc.version_id
              WHERE tv2.file_id = f.id)::int AS so_y_kien
       FROM task_files f
       JOIN users cu       ON cu.id = f.created_by
       LEFT JOIN users tpb ON tpb.id = f.tp_duyet_boi
       JOIN work_items i   ON i.id = f.item_id
       JOIN works w        ON w.id = i.work_id
       LEFT JOIN work_items cha ON cha.id = i.parent_id
       LEFT JOIN departments d ON d.id = i.department_id
       LEFT JOIN LATERAL (
         SELECT id, version_no, ten_goc, noi_dung, uploaded_at, uploaded_by
           FROM task_file_versions
          WHERE file_id = f.id
          ORDER BY version_no DESC LIMIT 1
       ) v ON TRUE
       LEFT JOIN users vu  ON vu.id = v.uploaded_by
      WHERE (${dieuKien})
        AND (v.id IS NOT NULL OR ${lenhSua ? 'TRUE' : 'FALSE'})
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
    `SELECT u.id, u.full_name, u.role, u.department_id,
      COALESCE((SELECT array_agg(dm.department_id ORDER BY dm.department_id)
        FROM department_managers dm WHERE dm.user_id=u.id AND dm.role='deputy_director'), '{}') AS "managedDepartmentIds"
      FROM users u WHERE u.id = $1 AND u.is_active`,
    [Number(id)]
  );
  return rows[0] ?? null;
}

/** V2: một nguồn tiến độ cho bảng file, cây, Gantt và thống kê. */
export async function tienDoFileRows(itemId = null, client = null, itemIds = null) {
  const settings = await readSettings(client);
  const { rows } = await db(client).query(
    `SELECT f.id, f.item_id, f.ty_le, f.trang_thai, f.ten_goc, f.ten_ket_qua, f.dinh_dang,
       f.tp_duyet_boi, f.tp_duyet_luc, tpb.full_name AS ten_nguoi_tp_duyet,
       v.id AS ban_cuoi_id, v.ten_goc AS ten_ban_cuoi, vu.full_name AS ten_nguoi_nop,
       (SELECT count(*) FROM task_file_versions tv WHERE tv.file_id = f.id)::int AS so_ban,
       (SELECT MAX(c.created_at) FROM task_file_flow c WHERE c.file_id=f.id AND c.version_id=v.id
        AND c.hanh_dong IN ('duyet','duyet-tu-dong','hoan-thanh')) AS duyet_luc,
      EXISTS(SELECT 1 FROM task_file_versions v WHERE v.file_id=f.id) AS co_ban,
      COALESCE((to_jsonb(i)->>'gui_bld_phe_duyet')::boolean,false) AS gui_bld_phe_duyet,
      (u.role IN ('Trưởng phòng','Phó phòng') OR
       (vu.role IN ('Trưởng phòng','Phó phòng') AND COALESCE(g.hanh_dong,'') <> 'tp-phe-duyet')) AS lanh_dao_tu_lam
     FROM task_files f JOIN work_items i ON i.id=f.item_id
     LEFT JOIN users u ON u.id=i.assignee_id
     LEFT JOIN users tpb ON tpb.id=f.tp_duyet_boi
     LEFT JOIN LATERAL(SELECT id, ten_goc, uploaded_by FROM task_file_versions WHERE file_id=f.id ORDER BY version_no DESC LIMIT 1) v ON TRUE
     LEFT JOIN users vu ON vu.id=v.uploaded_by
     LEFT JOIN LATERAL(SELECT hanh_dong FROM task_file_flow WHERE file_id=f.id AND hanh_dong IN ('nop','luu-tam','gui-duyet','tp-phe-duyet') ORDER BY id DESC LIMIT 1) g ON TRUE
     WHERE ($1::bigint IS NULL OR f.item_id=$1) AND ($2::bigint[] IS NULL OR f.item_id=ANY($2)) ORDER BY f.id`,
    [itemId, itemIds]
  );
  return rows.map((row) => ({ ...row, tienDo: fileProgress(row, settings.fileProgress) }));
}
/** Tổng tỷ lệ hiện tại của các nhóm file trong MỘT nhiệm vụ — chỉ đọc, không chia lại gì. */
export async function tongTyLeFile(itemId, client = null) {
  const { rows } = await db(client).query(
    'SELECT COALESCE(SUM(ty_le), 0)::int AS tong FROM task_files WHERE item_id = $1',
    [itemId]
  );
  return rows[0]?.tong ?? 0;
}
/** Đếm vẫn nhị phân để tương thích; tiến độ dùng tổng trọng số, không đếm bản. */
export async function demNhomFileTheoItem(client = null, itemIds = null) {
  const dem = new Map();
  for (const row of await tienDoFileRows(null, client, itemIds)) {
    const key = String(row.item_id);
    const d = dem.get(key) ?? {
      tong: 0,
      xong: 0,
      daDuyetCoBan: 0,
      tongTyLe: 0,
      tienDoCoTrongSo: 0,
      files: [],
      duyetLuc: null,
    };
    d.tong++;
    if (['hoan-thanh', 'da-duyet'].includes(row.trang_thai)) d.xong++;
    if (row.co_ban && ['hoan-thanh', 'da-duyet'].includes(row.trang_thai)) {
      d.daDuyetCoBan++;
      if (row.duyet_luc && (!d.duyetLuc || row.duyet_luc > d.duyetLuc)) d.duyetLuc = row.duyet_luc;
    }
    // Chỉ metadata phục vụ danh sách; không mang đường dẫn lưu, nội dung, góp ý hay phiên bản cũ.
    // `so_ban` + `ten_nguoi_nop` để tab Nhiệm vụ hiện «Số bản» và ai nộp bản cuối mà không phải
    // gọi thêm API cho từng nhóm (TC-KQ-DONE-06, thiết kế 2026-09-10).
    d.files.push({
      id: row.id,
      ten_goc: row.ten_goc,
      ten_ket_qua: row.ten_ket_qua,
      dinh_dang: row.dinh_dang,
      trang_thai: row.trang_thai,
      co_ban: row.co_ban,
      ban_cuoi_id: row.ban_cuoi_id,
      ten_ban_cuoi: row.ten_ban_cuoi,
      ten_nguoi_nop: row.ten_nguoi_nop ?? null,
      so_ban: Number(row.so_ban) || 0,
      ty_le: row.ty_le,
      tienDo: row.tienDo,
      // ĐIỂM 7 (ĐỢT B): mốc «TP/PP phê duyệt» — tab Nhiệm vụ in «TP/PP … đã phê duyệt lúc …» ngay
      // trên hàng kết quả, không bắt người dùng mở nhật ký file mới biết ai đã ký.
      tp_duyet_ten: row.ten_nguoi_tp_duyet ?? null,
      tp_duyet_luc: row.tp_duyet_luc ?? null,
    });
    d.tongTyLe += row.ty_le;
    d.tienDoCoTrongSo += row.ty_le * row.tienDo;
    dem.set(key, d);
  }
  return dem;
}
