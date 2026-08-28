// Gắn nhãn "dòng nhật ký này thuộc đầu việc nào" cho một mảng `activity_logs`.
//
// Vì sao ở máy chủ: giao diện chỉ có sẵn dữ liệu của đúng cái đang mở, còn nhật ký cả cây thì trộn
// dòng của cha, của công việc con và của nhiệm vụ. Máy chủ có luôn danh sách dòng nên tra tên một
// lần rồi trả kèm; để trình duyệt tự tra là nó phải tải thêm cả cây, và những dòng ĐÃ XOÁ thì không
// bao giờ tra ra tên.
//
// Không đọc CSDL — hàm thuần, để test được bằng dữ liệu bày sẵn.

const LEVEL_OF = { work: 1, subwork: 2, task: 3 };

/**
 * @param {Array<object>} entries dòng `activity_logs` (đã có `entity_type`, `entity_id`, `details`)
 * @param {{ work?: object|null, items?: Array<object> }} danhMuc dòng cấp 1 và các dòng cấp 2/3
 *        đang CÒN của cây; thiếu thì rơi về `details.code` / `details.name`.
 * @returns {Array<object>} bản sao từng dòng, thêm khoá `ref { kind, level, code, name, deleted }`
 */
export function attachRefs(entries, { work = null, items = [] } = {}) {
  const theoId = new Map();
  if (work?.id != null) {
    theoId.set(`work:${work.id}`, { level: 1, code: work.code ?? '', name: work.name ?? '' });
  }
  for (const row of Array.isArray(items) ? items : []) {
    if (row?.id == null) continue;
    const kind = row.level === 2 ? 'subwork' : 'task';
    theoId.set(`${kind}:${row.id}`, {
      level: row.level ?? LEVEL_OF[kind],
      code: row.code ?? '',
      name: row.name ?? '',
    });
  }

  return (Array.isArray(entries) ? entries : []).map((entry) => {
    const kind = String(entry?.entity_type || '');
    const tra = entry?.entity_id == null ? null : theoId.get(`${kind}:${entry.entity_id}`);
    const details = entry?.details && typeof entry.details === 'object' ? entry.details : {};
    // `deleted`: còn dòng nhật ký mà không còn đầu việc — giao diện hiện «(đã xoá)» chứ không im
    // lặng bỏ dòng đó đi.
    const ref = tra
      ? { kind, ...tra, deleted: false }
      : {
          kind,
          level: LEVEL_OF[kind] ?? null,
          code: String(details.code ?? ''),
          name: String(details.name ?? ''),
          deleted: true,
        };
    return { ...entry, ref };
  });
}
