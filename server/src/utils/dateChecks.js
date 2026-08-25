// Kiểm tra ngày tháng theo kiểu CẢNH BÁO, không chặn (§7 việc 3.10, TC-TREE-33/34).
//
// Vì sao không chặn: dữ liệu thật có việc bắt đầu 2026-12-31 và kết thúc 2027-01-01 (dữ liệu mẫu
// CV009), có nhiệm vụ nằm ngoài khoảng của công việc cha vì kế hoạch bị đẩy lùi. Chặn cứng nghĩa
// là người dùng không lưu được thứ đang có thật trên giấy, nên họ sẽ điền ngày sai cho qua — mất
// luôn cả dữ liệu đúng. Cảnh báo giữ được cả hai: dòng vẫn lưu, giao diện vẫn nhắc.
//
// Trả về MẢNG cảnh báo `{code, message, field}`; mảng rỗng nghĩa là không có gì đáng nói.

/** So hai ngày dạng chuỗi 'YYYY-MM-DD'. Chuỗi ISO so trực tiếp được, không cần dựng Date. */
const isBefore = (a, b) => Boolean(a) && Boolean(b) && a < b;

/**
 * Hạn chót trước ngày bắt đầu (TC-TREE-33). Dùng cho cả công việc cấp 1 (`start_date`/`end_date`)
 * và dòng cấp 2/3 (`start_date`/`due_date`).
 */
export function warnDueBeforeStart(startDate, dueDate, field = 'dueDate') {
  if (!isBefore(dueDate, startDate)) return [];
  return [
    {
      code: 'DUE_BEFORE_START',
      message: `Hạn chót (${dueDate}) trước ngày bắt đầu (${startDate})`,
      field,
    },
  ];
}

/**
 * Ngày của dòng cấp 2/3 nằm ngoài khoảng ngày của công việc cha (TC-TREE-34).
 * Công việc cha chưa điền ngày ⇒ không có gì để so, không cảnh báo.
 */
export function warnOutsideWorkRange(item, work) {
  if (!work) return [];
  const { start_date: workStart, end_date: workEnd } = work;
  if (!workStart && !workEnd) return [];
  const out = [];
  const pairs = [
    ['startDate', item.start_date],
    ['dueDate', item.due_date],
  ];
  for (const [field, value] of pairs) {
    if (!value) continue;
    if (isBefore(value, workStart) || isBefore(workEnd, value)) {
      out.push({
        code: 'OUTSIDE_WORK_RANGE',
        message:
          `Ngày ${value} nằm ngoài khoảng của công việc ` +
          `(${workStart ?? 'chưa có'} → ${workEnd ?? 'chưa có'})`,
        field,
      });
    }
  }
  return out;
}

/** Gộp nhiều nhóm cảnh báo, bỏ trùng theo `code` + `field`. */
export function mergeWarnings(...groups) {
  const seen = new Set();
  const out = [];
  for (const w of groups.flat()) {
    const key = `${w.code}|${w.field ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}
