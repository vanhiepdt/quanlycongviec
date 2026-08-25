// Cây 3 tầng cho `GET /api/v1/works/tree` (§7 việc 3.6, mục C2).
//
// Tách riêng khỏi `service.js` vì đây là việc DỰNG HÌNH, không phải nghiệp vụ: không sửa gì, không
// giao dịch, chỉ đọc rồi lồng lại. Nhờ tách ra mà phần lồng cây test được bằng dữ liệu giả, không
// cần dựng cả Express.
//
// Hai điều bản Apps Script làm sai mà đây phải làm đúng:
//  1. `getWorkTree` bản cũ đọc `Nhiệm vụ (JSON)` của TỪNG công việc rồi lọc mảng trong bộ nhớ, nên
//     nhiệm vụ có `Mã cha` trỏ vào công việc con đã xoá thì rơi khỏi cây — mất hẳn khỏi giao diện.
//     Ở đây mọi dòng không tìm được cha đều vào nhóm `(chưa gán công việc con)`, không dòng nào mất
//     (TC-TREE-24).
//  2. Bản cũ đếm chung cấp 2 và cấp 3 vào `tasks`. `totals` ở đây đếm rạch ròi từng cấp (bẫy §13.5).
import { can } from '../../middleware/rbac.js';
import * as itemsRepo from '../workItems/repo.js';
import * as repo from './repo.js';

/** Nhãn nhóm cho nhiệm vụ cấp 3 không thuộc công việc con nào. Giữ đúng chữ của bản cũ để người
 *  dùng không thấy giao diện lạ đi (Code.gs.moi:205 `UNASSIGNED_SUBWORK_LABEL`). */
export const UNASSIGNED_SUBWORK_LABEL = '(chưa gán công việc con)';

/**
 * Lồng danh sách phẳng thành cây. Tách khỏi `getTree` để test được không cần CSDL.
 *
 * `items` phải xếp theo `depth` tăng dần — `itemsRepo.listForWorks` đã bảo đảm — nhờ vậy khi tới
 * một nhiệm vụ thì công việc con cha của nó đã dựng xong, chỉ cần một lượt đi.
 */
export function assemble(works, items) {
  const buckets = new Map(works.map((w) => [w.id, { subWorks: [], orphanTasks: [] }]));
  const subworkById = new Map();
  // Dữ liệu trỏ vòng làm một dòng xuất hiện hai lần (một lần làm gốc, một lần làm con của kẻ trong
  // vòng). Vì `items` xếp theo `depth` tăng dần, lần đầu gặp là bản ở đúng chỗ nhất — giữ nó, bỏ
  // bản sau, để cây không nhân đôi mà cũng không mất dòng nào.
  const placed = new Set();

  for (const row of items) {
    const bucket = buckets.get(row.work_id);
    if (!bucket) continue; // dòng thuộc công việc người này không được đọc
    if (placed.has(row.id)) continue;
    placed.add(row.id);
    if (row.level === itemsRepo.LEVEL_SUBWORK) {
      const node = { ...row, tasks: [] };
      subworkById.set(row.id, node);
      bucket.subWorks.push(node);
    } else if (row.parent_id != null && subworkById.has(row.parent_id)) {
      subworkById.get(row.parent_id).tasks.push(row);
    } else {
      // Không có cha, hoặc có `parent_id` nhưng cha không phải cấp 2 / không đọc được: vẫn hiện,
      // ở nhóm chung. Thà hiện lẫn chỗ còn hơn để người dùng mất việc.
      bucket.orphanTasks.push(row);
    }
  }

  let subWorkCount = 0;
  let taskCount = 0;
  let unassignedCount = 0;

  const tree = works.map((work) => {
    const { subWorks, orphanTasks } = buckets.get(work.id);
    subWorkCount += subWorks.length;
    for (const s of subWorks) taskCount += s.tasks.length;
    if (orphanTasks.length > 0) {
      taskCount += orphanTasks.length;
      unassignedCount += orphanTasks.length;
      // Nhóm ảo, KHÔNG phải một dòng trong CSDL: `id`/`code` để trống và có cờ `virtual` để giao
      // diện biết đừng cho sửa, xoá hay kéo–thả nó.
      subWorks.push({
        id: null,
        code: null,
        work_id: work.id,
        parent_id: null,
        level: itemsRepo.LEVEL_SUBWORK,
        name: UNASSIGNED_SUBWORK_LABEL,
        virtual: true,
        tasks: orphanTasks,
      });
    }
    return { ...work, subWorks };
  });

  return {
    works: tree,
    // `subWorks` chỉ đếm dòng thật, không đếm nhóm ảo. `tasks` đếm CẢ nhiệm vụ mồ côi —
    // `unassignedTasks` là tập con của nó, không phải một loại khác.
    totals: {
      works: tree.length,
      subWorks: subWorkCount,
      tasks: taskCount,
      unassignedTasks: unassignedCount,
    },
  };
}

/**
 * Cây 3 tầng của những công việc người đang xem được phép đọc.
 *
 * Lọc phạm vi ở TẦNG CÔNG VIỆC rồi mới lấy dòng con: cấp 2/cấp 3 luôn cùng phòng với công việc cha
 * (§4.1), nên công việc đã ngoài phạm vi thì cả cây bên dưới cũng vậy — không cần kiểm lại 5.000
 * dòng con một lần nữa.
 */
export async function getTree(user, filter = {}) {
  const works = (await repo.list(filter)).filter((row) => can(user, 'read', 'work', row).ok);
  const items = await itemsRepo.listForWorks(works.map((w) => w.id));
  return assemble(works, items);
}

export default getTree;
