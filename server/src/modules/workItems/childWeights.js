// Tỷ lệ nội bộ công việc con: mặc định chia đều, sửa tay giữ nguyên để người dùng xác nhận tổng.
import { chiaDeu } from './tyLe.js';

export async function updateChildWeights(
  parentId,
  client,
  { addedId = null, editedId = null, value = null } = {}
) {
  if (parentId == null) return new Map();
  await client.query('SELECT id FROM work_items WHERE id = $1 FOR UPDATE', [parentId]);
  const { rows } = await client.query(
    'SELECT id, ty_le, ty_le_tu_dong FROM work_items WHERE parent_id = $1 AND level = 3 ORDER BY sort_order,id FOR UPDATE',
    [parentId]
  );
  if (!rows.length) return new Map();
  const auto = rows.every((r) => r.ty_le_tu_dong);
  const equal = chiaDeu(rows.length);
  const values = new Map();
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    const edited = String(r.id) === String(editedId);
    const added = String(r.id) === String(addedId);
    const next = edited ? Number(value) : auto ? equal[i] : added ? equal[i] : r.ty_le;
    if (next !== r.ty_le || edited)
      await client.query(
        'UPDATE work_items SET ty_le = $2, ty_le_tu_dong = $3, updated_at = now() WHERE id = $1',
        [r.id, next, edited ? false : r.ty_le_tu_dong]
      );
    values.set(String(r.id), next);
  }
  return values;
}
