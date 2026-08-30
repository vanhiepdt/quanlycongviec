// Đọc/ghi bảng `permission_overrides` (009) — ghi đè Bảng phân quyền do Giám đốc sửa bằng dropdown.
import { pool } from '../../db/pool.js';

const db = (client) => client ?? pool;

/** Mọi dòng ghi đè (cho GET ma trận). */
export async function listAll(client = null) {
  const { rows } = await db(client).query(
    `SELECT vai, entity_type, action, gia_tri, updated_by, updated_at
       FROM permission_overrides
      ORDER BY vai, entity_type, action`
  );
  return rows;
}

/** Ghi đè của MỘT vai — session gắn vào `req.user.ghiDe` để `can()` vẫn thuần. */
export async function listByVai(vai, client = null) {
  const { rows } = await db(client).query(
    `SELECT entity_type, action, gia_tri
       FROM permission_overrides
      WHERE vai = $1`,
    [vai]
  );
  return rows;
}

/** Đặt ghi đè (gia_tri đã kiểm ở service). */
export async function upsert({ vai, entityType, action, giaTri, updatedBy }, client = null) {
  await db(client).query(
    `INSERT INTO permission_overrides (vai, entity_type, action, gia_tri, updated_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (vai, entity_type, action)
     DO UPDATE SET gia_tri = EXCLUDED.gia_tri, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [vai, entityType, action, giaTri, updatedBy ?? null]
  );
}

/** Xoá ghi đè = về «Mặc định». */
export async function xoa({ vai, entityType, action }, client = null) {
  await db(client).query(
    `DELETE FROM permission_overrides WHERE vai = $1 AND entity_type = $2 AND action = $3`,
    [vai, entityType, action]
  );
}
