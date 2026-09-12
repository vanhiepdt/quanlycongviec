// Cùng cách chia với tỷ lệ nhiệm vụ con: sửa tay giữ nguyên các dòng khác, tổng lệch được lưu.
import { chiaDeu } from '../workItems/tyLe.js';
export async function updateFileWeights(
  itemId,
  client,
  { addedId = null, editedId = null, value = null } = {}
) {
  await client.query('SELECT id FROM work_items WHERE id=$1 FOR UPDATE', [itemId]);
  const rows = (
    await client.query(
      'SELECT id,ty_le,ty_le_tu_dong FROM task_files WHERE item_id=$1 ORDER BY id FOR UPDATE',
      [itemId]
    )
  ).rows;
  const auto = rows.every((r) => r.ty_le_tu_dong),
    equal = chiaDeu(rows.length);
  for (const [i, r] of rows.entries()) {
    const edited = String(r.id) === String(editedId),
      added = String(r.id) === String(addedId);
    const next = edited ? value : auto ? equal[i] : added ? equal[i] : r.ty_le;
    if (next !== r.ty_le || edited)
      await client.query('UPDATE task_files SET ty_le=$2,ty_le_tu_dong=$3 WHERE id=$1', [
        r.id,
        next,
        edited ? false : r.ty_le_tu_dong,
      ]);
    r.ty_le = next;
  }
  return rows;
}
