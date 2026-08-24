// Nhập dữ liệu từ bản chụp Google Sheets vào Postgres (§7 Phase 2).
//
// Thứ tự nhập là BẮT BUỘC và bằng đúng thứ tự khoá ngoại: departments → users →
// department_managers → works → work_items (2 lượt) → reminders → proposals → apps →
// chat_messages → notifications → activity_logs.
//
// Bốn nguyên tắc chi phối cả file:
// 1. CHẠY LẠI ĐƯỢC. Bảng có `code` dùng `ON CONFLICT (code) DO UPDATE`; bảng không có khoá tự
//    nhiên (`reminders`, `chat_messages`, `notifications`, `activity_logs`) dùng
//    `INSERT ... WHERE NOT EXISTS` theo khoá tự nhiên. Lần chạy thứ hai ghi 0 dòng mới (2.2).
// 2. KHÔNG MẤT DÒNG. Dò tên không ra, mã cha không tồn tại, JSON hỏng ⇒ để NULL / bỏ phần hỏng
//    rồi GHI BÁO CÁO, chứ không bỏ cả dòng. Chỗ nào buộc phải bỏ thì bỏ kèm lý do.
// 3. KHÔNG ĐOÁN. Vai trò lạ, trạng thái lạ ⇒ in ra cho người sửa tay (TC-IMP-11).
// 4. MỘT DÒNG LỖI KHÔNG LÀM ĐỔ CẢ LẦN NHẬP: mỗi dòng chạy trong SAVEPOINT riêng. Ngoại lệ duy
//    nhất là lỗi do ta chủ động ném (`AppError`) — ví dụ hai dòng trùng email (TC-IMP-12) —
//    những lỗi đó phải dừng cả lần nhập.
import { AppError } from '../../utils/errors.js';
import { hashPassword } from '../auth/password.js';
import {
  combineDateAndClock,
  normalizeApproval,
  normalizeDeptRole,
  normalizeRole,
  parseDate,
  parseJsonArrayCell,
  parsePercent,
  parseResultLinks,
  parseTimestamp,
  pickFromList,
  placeholderEmail,
  randomTempPassword,
  splitEmailList,
  text,
} from './normalize.js';
import { createDepartmentResolver, createUserResolver } from './resolve.js';
import { checkSheets, sheet } from './snapshot.js';

/** `RETURNING (xmax = 0)`: true khi dòng vừa được CHÈN, false khi `DO UPDATE` sửa dòng cũ. */
const INSERTED = '(xmax = 0) AS inserted';

/**
 * Chạy một dòng trong SAVEPOINT. Lỗi CSDL ⇒ quay lại điểm lưu, ghi lý do, đi tiếp.
 * `AppError` thì ném lên: đó là lỗi ta cố tình dựng để dừng cả lần nhập.
 */
async function perRow(ctx, counter, label, fn) {
  await ctx.client.query('SAVEPOINT r');
  try {
    await fn();
    await ctx.client.query('RELEASE SAVEPOINT r');
  } catch (err) {
    await ctx.client.query('ROLLBACK TO SAVEPOINT r');
    if (err instanceof AppError) throw err;
    counter.addSkipped(`${label}: CSDL từ chối — ${err.message}`);
  }
}

/** Ghi kết quả một câu INSERT ... RETURNING ... inserted vào bảng đối chiếu. */
function countUpsert(counter, rows) {
  if (rows.length === 0) return null;
  if (rows[0].inserted) counter.addInserted();
  else counter.addUpdated();
  return rows[0];
}

// ============================ 1. Phòng ============================

export async function importDepartments(ctx) {
  const s = sheet(ctx.snapshot, 'Phòng');
  const counter = ctx.report.entity('departments');
  counter.countSheetRows(s.rows.length);

  const nameOwner = new Map();
  for (const row of s.rows) {
    const code = text(row['Mã phòng']);
    const name = text(row['Tên phòng']);
    if (code === '' || name === '') {
      counter.addSkipped(`dòng ${row.__row}: thiếu Mã phòng hoặc Tên phòng`);
      continue;
    }
    // `departments.name` là UNIQUE: hai dòng cùng tên thì dòng sau không thể vào được.
    const nameKey = name.toLowerCase();
    if (nameOwner.has(nameKey)) {
      counter.addSkipped(
        `${code}: tên phòng "${name}" đã là của ${nameOwner.get(nameKey)} (departments.name là UNIQUE)`
      );
      continue;
    }
    nameOwner.set(nameKey, code);

    const order = Number.parseInt(text(row['Thứ tự']), 10);
    await perRow(ctx, counter, code, async () => {
      const { rows } = await ctx.client.query(
        `INSERT INTO departments (code, name, sort_order, notes) VALUES ($1,$2,$3,$4)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name,
           sort_order = EXCLUDED.sort_order, notes = EXCLUDED.notes, updated_at = now()
         RETURNING id, ${INSERTED}`,
        [code, name, Number.isFinite(order) ? order : 99, text(row['Ghi chú'])]
      );
      countUpsert(counter, rows);
    });
  }

  const { rows } = await ctx.client.query('SELECT id, code, name FROM departments');
  ctx.departments = createDepartmentResolver(rows);
}

// ============================ 2. Người dùng ============================

/**
 * Hai dòng cùng email là lỗi KHÔNG thể chữa bằng cách đoán (`users.email` là UNIQUE): chọn dòng
 * nào cũng là mất người kia. Dừng cả lần nhập và nói rõ hai mã nào trùng (TC-IMP-12).
 */
function assertNoDuplicateEmail(rows) {
  const owner = new Map();
  for (const row of rows) {
    const email = text(row.Email).toLowerCase();
    if (email === '') continue;
    const first = owner.get(email);
    if (first) {
      throw new AppError(
        'CONFLICT',
        `Hai dòng của sheet Người dùng dùng chung email "${email}" (${first} và ` +
          `${text(row['Mã NV']) || `dòng ${row.__row}`}). Cột email là UNIQUE nên không thể ` +
          'nhập cả hai. Sửa Google Sheets rồi nhập lại.'
      );
    }
    owner.set(email, text(row['Mã NV']) || `dòng ${row.__row}`);
  }
}

export async function importUsers(ctx) {
  const s = sheet(ctx.snapshot, 'Người dùng');
  const counter = ctx.report.entity('users');
  counter.countSheetRows(s.rows.length);
  assertNoDuplicateEmail(s.rows);

  // Mã đã có trong CSDL: những người này KHÔNG được sinh lại mật khẩu tạm, cũng không bị ghi đè
  // mật khẩu họ đã tự đổi sau lần nhập trước.
  const existing = new Set(
    (await ctx.client.query('SELECT code FROM users')).rows.map((r) => r.code)
  );

  for (const row of s.rows) {
    const code = text(row['Mã NV']);
    const fullName = text(row['Họ tên']);
    if (code === '' || fullName === '') {
      counter.addSkipped(`dòng ${row.__row}: thiếu Mã NV hoặc Họ tên`);
      continue;
    }

    const { role, changed, unknown } = normalizeRole(row['Phân quyền']);
    if (unknown) {
      // Đoán vai trò là cấp quyền sai. Bỏ dòng, in ra, để người sửa tay rồi nhập lại.
      const raw = text(row['Phân quyền']);
      counter.addSkipped(`${code}: Phân quyền lạ "${raw}" ⇒ không đoán vai trò, bỏ dòng`);
      ctx.report.humanFix(
        `Sheet Người dùng, ${code} (${fullName}): sửa cột Phân quyền "${raw}" thành một trong ` +
          '6 vai trò hợp lệ rồi chạy lại công cụ nhập'
      );
      continue;
    }
    if (changed) counter.addNote(`${code}: Phân quyền "${text(row['Phân quyền'])}" → "${role}"`);

    await importOneUser(ctx, counter, row, { code, fullName, role, existing });
  }

  const { rows } = await ctx.client.query('SELECT id, code, full_name, email FROM users');
  ctx.users = createUserResolver(rows);
}

/** Một dòng người dùng: email giữ chỗ, mật khẩu, phòng, vai trò phòng. */
async function importOneUser(ctx, counter, row, { code, fullName, role, existing }) {
  let email = text(row.Email);
  if (email === '') {
    // `users.email` là citext NOT NULL UNIQUE: để rỗng thì người thứ hai không email sẽ đổ.
    // Tên miền `.invalid` được RFC 2606 dành riêng, không bao giờ gửi được thư ra ngoài.
    email = placeholderEmail(code);
    counter.addNote(`${code} (${fullName}): không có email ⇒ dùng địa chỉ giữ chỗ ${email}`);
  }

  const dept = ctx.departments.byNameExact(row.Phòng, `${code}.Phòng`);
  if (dept.problem) counter.addNote(dept.problem);

  const deptRole = normalizeDeptRole(row['Vai trò phòng']);
  if (deptRole.unknown) {
    counter.addNote(`${code}: Vai trò phòng lạ "${text(row['Vai trò phòng'])}" ⇒ để NULL`);
  }

  const isNew = !existing.has(code);
  let passwordHash = null;
  if (isNew) {
    const plain = text(row['Mật khẩu']);
    const temp = plain === '' ? randomTempPassword() : null;
    // 2.5: mật khẩu văn bản thuần được BĂM lại; ai cũng phải đổi ở lần đăng nhập đầu, kể cả
    // người đã có mật khẩu — vì mật khẩu đó đang nằm văn bản thuần trong một bảng tính.
    passwordHash = await hashPassword(temp ?? plain);
    if (temp) {
      // Mật khẩu tạm KHÔNG vào báo cáo, KHÔNG vào log — chỉ vào tệp riêng của `cli.js`.
      ctx.tempPasswords.push({ code, fullName, email, password: temp });
      counter.addNote(`${code}: mật khẩu rỗng ⇒ đã sinh mật khẩu tạm (xem tệp mật khẩu riêng)`);
    }
  }

  await perRow(ctx, counter, code, async () => {
    const { rows } = await ctx.client.query(
      `INSERT INTO users (code, full_name, email, password_hash, must_change_password,
         position, role, object_type, department_id, dept_role, notes)
       VALUES ($1,$2,$3,$4,true,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (code) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email,
         position = EXCLUDED.position, role = EXCLUDED.role,
         object_type = EXCLUDED.object_type, department_id = EXCLUDED.department_id,
         dept_role = EXCLUDED.dept_role, notes = EXCLUDED.notes, updated_at = now()
       RETURNING id, ${INSERTED}`,
      [
        code,
        fullName,
        email,
        // Mã đã có ⇒ nhánh DO UPDATE chạy và KHÔNG chạm `password_hash`, nên $4 không được lưu.
        // Vẫn đặt một chuỗi KHÔNG phải bcrypt: nếu sau này logic đổi mà lọt vào nhánh INSERT thì
        // tài khoản đó không đăng nhập được — thà khoá cửa còn hơn mở cửa bằng chuỗi đoán được.
        passwordHash ?? 'khong-phai-bam-hop-le',

        text(row['Chức vụ']),
        role,
        text(row['Đối tượng']),
        dept.id,
        deptRole.deptRole,
        text(row['Ghi chú']),
      ]
    );
    countUpsert(counter, rows);
  });
}

// ============================ 3. Người phụ trách phòng ============================

// Ba cột email của sheet `Phòng` ⇄ ba giá trị của CHECK `department_managers.role`.
const MANAGER_COLUMNS = Object.freeze([
  ['Email Phó GĐ phụ trách', 'deputy_director'],
  ['Email Trưởng phòng', 'head'],
  ['Email Phó phòng', 'vice'],
]);

export async function importDepartmentManagers(ctx) {
  const s = sheet(ctx.snapshot, 'Phòng');
  const counter = ctx.report.entity('department_managers');

  for (const row of s.rows) {
    const code = text(row['Mã phòng']);
    const dept = ctx.departments.byNameExact(code, `${code}.Mã phòng`);
    for (const [column, role] of MANAGER_COLUMNS) {
      // Một ô có thể chứa nhiều email, ngăn bằng `;` hoặc `,` (§4.3).
      for (const email of splitEmailList(row[column])) {
        counter.countSheetRows(1);
        if (dept.id === null) {
          counter.addSkipped(`${code}.${column} (${email}): không nhập được vì phòng đã bị bỏ`);
          continue;
        }
        const user = ctx.users.byEmail(email);
        if (!user) {
          counter.addSkipped(`${code}.${column}: không có người dùng nào mang email "${email}"`);
          continue;
        }
        await perRow(ctx, counter, `${code}.${role}`, async () => {
          // Khoá chính là (department_id, user_id, role) ⇒ chạy lại không sinh thêm dòng.
          // Dòng đã có sẵn tính vào cột "Cập nhật" (không có gì để sửa, chỉ để không đếm là mới).
          const { rows } = await ctx.client.query(
            `INSERT INTO department_managers (department_id, user_id, role) VALUES ($1,$2,$3)
             ON CONFLICT DO NOTHING RETURNING 1`,
            [dept.id, user.id, role]
          );
          if (rows.length === 1) counter.addInserted();
          else counter.addUpdated();
        });
      }
    }
  }
}

// ============================ 4. Công việc (cấp 1) ============================

const WORK_SHEET = 'Dự án/Nhiệm vụ';

export async function importWorks(ctx) {
  const s = sheet(ctx.snapshot, WORK_SHEET);
  const counter = ctx.report.entity('works');
  counter.countSheetRows(s.rows.length);

  let order = 0;
  for (const row of s.rows) {
    const code = text(row['Mã dự án']);
    const name = text(row['Tên dự án']);
    if (code === '' || name === '') {
      counter.addSkipped(`dòng ${row.__row}: thiếu Mã dự án hoặc Tên dự án`);
      continue;
    }
    order += 1;

    // Cột `Quản lý dự án` ghi HỌ TÊN, cột `Email quản lý` ghi email. Dò theo tên trước (đó là
    // cột người dùng thật sự nhập), tên trùng hoặc không có thì mới dùng email — email là UNIQUE
    // nên đó là chữa cháy bằng dữ liệu chắc chắn, không phải đoán.
    const manager = ctx.users.byNameExact(row['Quản lý dự án'], `${code}.Quản lý`);
    if (manager.id === null && text(row['Email quản lý']) !== '') {
      const byEmail = ctx.users.byEmail(row['Email quản lý']);
      if (byEmail) {
        counter.addNote(
          `${code}: ${manager.problem ?? 'không có tên quản lý'} ⇒ đã dò ra theo "Email quản lý" ` +
            `(${byEmail.email})`
        );
        manager.id = byEmail.id;
        // Ô tên rỗng thì lấy tên của người vừa dò ra; ô tên có chữ thì GIỮ NGUYÊN chữ đã nhập.
        if (manager.name === '') manager.name = byEmail.full_name;
      }
    }
    if (manager.id === null && manager.problem) counter.addNote(manager.problem);

    const dept = ctx.departments.byNameExact(row.Phòng, `${code}.Phòng`);
    if (dept.problem) counter.addNote(dept.problem);

    const start = parseDate(row['Ngày bắt đầu']);
    const end = parseDate(row['Ngày kết thúc']);
    for (const p of [start.problem, end.problem]) if (p) counter.addNote(`${code}: ${p}`);

    const approval = normalizeApproval(row['Trạng thái duyệt']);
    if (approval.filledDefault) ctx.needsApprovalDecision.add(code);
    if (approval.unknown) {
      counter.addNote(
        `${code}: Trạng thái duyệt lạ "${text(row['Trạng thái duyệt'])}" ⇒ lấy "Đã duyệt"`
      );
    }
    const approver = ctx.users.byNameExact(row['Người duyệt'], `${code}.Người duyệt`);
    if (approver.problem) counter.addNote(approver.problem);
    const approvedAt = parseTimestamp(row['Ngày duyệt']);
    if (approvedAt.problem) counter.addNote(`${code}.Ngày duyệt: ${approvedAt.problem}`);

    await perRow(ctx, counter, code, async () => {
      const { rows } = await ctx.client.query(
        `INSERT INTO works (code, name, description, manager_id, manager_name, department_id,
           start_date, end_date, status, approval_status, approver_id, approved_at,
           reject_reason, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name,
           description = EXCLUDED.description, manager_id = EXCLUDED.manager_id,
           manager_name = EXCLUDED.manager_name, department_id = EXCLUDED.department_id,
           start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
           status = EXCLUDED.status, approval_status = EXCLUDED.approval_status,
           approver_id = EXCLUDED.approver_id, approved_at = EXCLUDED.approved_at,
           reject_reason = EXCLUDED.reject_reason, sort_order = EXCLUDED.sort_order,
           updated_at = now()
         RETURNING id, ${INSERTED}`,
        [
          code,
          name,
          text(row['Mô tả dự án']),
          manager.id,
          manager.name,
          dept.id,
          start.date,
          end.date,
          text(row['Trạng thái dự án']) || 'Chưa bắt đầu',
          approval.status,
          approver.id,
          approvedAt.at,
          text(row['Lý do từ chối']),
          order,
        ]
      );
      const saved = countUpsert(counter, rows);
      if (saved) ctx.workIdByCode.set(code, saved.id);
    });
  }

  if (ctx.needsApprovalDecision.size > 0) {
    ctx.report.decision(
      `Ô "Trạng thái duyệt" rỗng ở ${[...ctx.needsApprovalDecision].join(', ')} ⇒ lấy "Đã duyệt": ` +
        'dữ liệu cũ đang được dùng thật, không bắt đi duyệt lại'
    );
  }
}

// ==================== 5. Công việc con / Nhiệm vụ — LƯỢT 1: chèn ====================

/** `Cấp` của phần tử JSON → 2 hoặc 3. Không có khoá `Cấp` là dữ liệu kiểu cũ (§13.4 mục 8). */
function readLevel(item) {
  const raw = text(item['Cấp']);
  if (raw === '') return { level: 2, legacy: true, unknown: false };
  const n = Number.parseInt(raw, 10);
  if (n === 2 || n === 3) return { level: n, legacy: false, unknown: false };
  return { level: 2, legacy: false, unknown: true };
}

export async function importWorkItems(ctx) {
  const s = sheet(ctx.snapshot, WORK_SHEET);
  const counter = ctx.report.entity('work_items');
  const legacyCodes = [];

  for (const row of s.rows) {
    const workCode = text(row['Mã dự án']);
    const cell = parseJsonArrayCell(row['Nhiệm vụ JSON']);
    if (!cell.ok) {
      // TC-IMP-03: ô hỏng chỉ mất nhiệm vụ của MỘT công việc, các công việc khác vẫn nhập đủ.
      counter.addSkipped(`${workCode}.Nhiệm vụ JSON hỏng (${cell.error}) ⇒ bỏ toàn bộ ô này`);
      ctx.report.humanFix(
        `Sheet ${WORK_SHEET}, dòng ${row.__row} (${workCode}): ô "Nhiệm vụ JSON" không đọc được, ` +
          'phải sửa tay rồi nhập lại — hiện công việc này chưa có nhiệm vụ nào'
      );
      continue;
    }
    if (cell.error) counter.addNote(`${workCode}.Nhiệm vụ JSON: ${cell.error}`);
    counter.countSheetRows(cell.items.length);

    const workId = ctx.workIdByCode.get(workCode);
    if (workId === undefined) {
      if (cell.items.length > 0) {
        counter.addSkipped(
          `${workCode}: công việc cha không nhập được ⇒ ${cell.items.length} nhiệm vụ bên dưới ` +
            'cũng không có chỗ để nhập'
        );
      }
      continue;
    }

    let order = 0;
    for (const item of cell.items) {
      order += 1;
      await importOneItem(ctx, counter, { item, workCode, workId, order, legacyCodes });
    }
  }

  if (legacyCodes.length > 0) {
    ctx.report.decision(
      `${legacyCodes.length} phần tử "Nhiệm vụ JSON" không có khoá "Cấp" và "Mã cha" (dữ liệu ` +
        'kiểu cũ) ⇒ nhập thành CẤP 2 (công việc con), không có cha: ' +
        `${legacyCodes.join(', ')}`
    );
  }
}

/** Một phần tử của `Nhiệm vụ JSON`. Lượt 1 luôn để `parent_id = NULL`, lượt 2 mới nối cha. */
async function importOneItem(ctx, counter, { item, workCode, workId, order, legacyCodes }) {
  let code = text(item['Mã nhiệm vụ']);
  if (code === '') {
    code = `${workCode}-KM${String(order).padStart(2, '0')}`;
    counter.addNote(`${workCode}: phần tử thứ ${order} không có "Mã nhiệm vụ" ⇒ đặt mã "${code}"`);
  }

  const { level, legacy, unknown } = readLevel(item);
  if (legacy) legacyCodes.push(code);
  if (unknown) counter.addNote(`${code}: "Cấp" lạ "${text(item['Cấp'])}" ⇒ lấy cấp 2`);

  const assignee = ctx.users.byNameExact(item['Người thực hiện'], `${code}.Người thực hiện`);
  if (assignee.problem) counter.addNote(assignee.problem);

  const start = parseDate(item['Ngày bắt đầu']);
  const due = parseDate(item['Hạn chót']);
  const report = parseDate(item['Ngày hoàn thành']);
  for (const [label, p] of [
    ['Ngày bắt đầu', start.problem],
    ['Hạn chót', due.problem],
    ['Ngày hoàn thành', report.problem],
  ]) {
    if (p) counter.addNote(`${code}.${label}: ${p}`);
  }

  const percent = parsePercent(item['Tiến độ (%)']);
  if (percent.problem) counter.addNote(`${code}: ${percent.problem}`);
  const links = parseResultLinks(item['Link kết quả']);

  await perRow(ctx, counter, code, async () => {
    const { rows } = await ctx.client.query(
      `INSERT INTO work_items (code, work_id, parent_id, level, name, description, assignee_id,
         assignee_name, status, priority, start_date, due_date, report_date, completion,
         target, output, notes, result_links, sort_order)
       VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18)
       ON CONFLICT (code) DO UPDATE SET work_id = EXCLUDED.work_id, level = EXCLUDED.level,
         name = EXCLUDED.name, description = EXCLUDED.description,
         assignee_id = EXCLUDED.assignee_id, assignee_name = EXCLUDED.assignee_name,
         status = EXCLUDED.status, priority = EXCLUDED.priority,
         start_date = EXCLUDED.start_date, due_date = EXCLUDED.due_date,
         report_date = EXCLUDED.report_date, completion = EXCLUDED.completion,
         target = EXCLUDED.target, output = EXCLUDED.output, notes = EXCLUDED.notes,
         result_links = EXCLUDED.result_links, sort_order = EXCLUDED.sort_order,
         updated_at = now()
       RETURNING id, ${INSERTED}`,
      [
        code,
        workId,
        level,
        text(item['Tên nhiệm vụ']) || code,
        text(item['Mô tả nhiệm vụ']),
        assignee.id,
        assignee.name,
        text(item['Trạng thái']) || 'Chưa bắt đầu',
        text(item['Ưu tiên']) || 'Trung bình',
        start.date,
        due.date,
        report.date,
        percent.percent,
        text(item['Mục tiêu']),
        text(item['Kết quả đầu ra']),
        text(item['Ghi chú']),
        JSON.stringify(links),
        order,
      ]
    );
    const saved = countUpsert(counter, rows);
    if (!saved) return;
    ctx.items.set(code, {
      id: saved.id,
      level,
      workId,
      workCode,
      parentCode: text(item['Mã cha']),
    });
    if (Array.isArray(item['Nhắc việc']) && item['Nhắc việc'].length > 0) {
      ctx.reminderSpecs.push({ itemCode: code, itemId: saved.id, level, list: item['Nhắc việc'] });
    }
  });
}

// ==================== 5b. LƯỢT 2: nối cha–con theo `Mã cha` ====================

/** Tìm cha trong lượt nhập này, không có thì tìm trong CSDL (lần nhập trước có thể đã tạo). */
async function findParent(ctx, parentCode) {
  const inRun = ctx.items.get(parentCode);
  if (inRun) return inRun;
  const { rows } = await ctx.client.query(
    'SELECT id, level, work_id FROM work_items WHERE code = $1',
    [parentCode]
  );
  if (rows.length === 0) return null;
  return { id: rows[0].id, level: rows[0].level, workId: rows[0].work_id };
}

/**
 * Việc 2.4. Cha không tồn tại ⇒ `parent_id = NULL` + ghi báo cáo, **không mất dòng**
 * (TC-IMP-04). Ba trường hợp cha không dùng được đều chỉ là ghi chú, không phải bỏ dòng.
 */
export async function linkWorkItemParents(ctx) {
  const counter = ctx.report.entity('work_items');
  let linked = 0;

  for (const [code, info] of ctx.items) {
    if (info.parentCode === '') continue;
    if (info.level !== 3) {
      counter.addNote(
        `${code}: cấp ${info.level} không được có cha (ràng buộc lvl2_no_parent) ⇒ bỏ qua ` +
          `"Mã cha" = "${info.parentCode}"`
      );
      continue;
    }
    const parent = await findParent(ctx, info.parentCode);
    if (!parent) {
      counter.addNote(`${code}: "Mã cha" = "${info.parentCode}" không tồn tại ⇒ parent_id = NULL`);
      continue;
    }
    if (parent.level !== 2) {
      counter.addNote(
        `${code}: cha "${info.parentCode}" là cấp ${parent.level}, cha phải là cấp 2 ⇒ để NULL`
      );
      continue;
    }
    if (parent.workId !== info.workId) {
      counter.addNote(
        `${code}: cha "${info.parentCode}" thuộc công việc khác ⇒ để NULL (cha và con phải cùng ` +
          'một công việc)'
      );
      continue;
    }
    await perRow(ctx, counter, code, async () => {
      await ctx.client.query('UPDATE work_items SET parent_id = $1 WHERE id = $2', [
        parent.id,
        info.id,
      ]);
      linked += 1;
    });
  }

  if (linked > 0) counter.addNote(`lượt 2: đã nối ${linked} nhiệm vụ vào công việc con cha`);
}

// ============================ 6. Nhắc việc ============================

// Bản chụp thật chưa có nhắc việc nào nên không biết chắc khoá tên gì; nhận cả ba cách viết đã
// thấy trong `Code.gs.moi` và cả trường hợp phần tử chỉ là một chuỗi ngày.
const REMIND_DATE_KEYS = ['Ngày nhắc', 'Ngày', 'date', 'remindDate'];
const REMIND_TEXT_KEYS = ['Nội dung', 'content', 'text', 'message'];

function readReminder(raw) {
  if (typeof raw === 'string') return { ...parseDate(raw), content: '' };
  if (raw === null || typeof raw !== 'object') {
    return { date: null, problem: `phần tử nhắc việc không dùng được: ${typeof raw}`, content: '' };
  }
  const dateKey = REMIND_DATE_KEYS.find((k) => text(raw[k]) !== '');
  const textKey = REMIND_TEXT_KEYS.find((k) => text(raw[k]) !== '');
  const parsed = parseDate(dateKey ? raw[dateKey] : '');
  return { ...parsed, content: textKey ? text(raw[textKey]) : '' };
}

export async function importReminders(ctx) {
  const counter = ctx.report.entity('reminders');

  for (const spec of ctx.reminderSpecs) {
    counter.countSheetRows(spec.list.length);
    if (spec.level !== 3) {
      // C10: nhắc việc CHỈ cho cấp 3 (trigger reminders_only_level3). Nhiệm vụ kiểu cũ vào cấp 2
      // nên nhắc việc của nó không có chỗ đặt — bỏ kèm lý do, KHÔNG bỏ cả nhiệm vụ.
      counter.addSkipped(
        `${spec.itemCode}: ${spec.list.length} nhắc việc thuộc một dòng cấp ${spec.level}; ` +
          'chỉ nhiệm vụ cấp 3 mới đặt được nhắc việc'
      );
      ctx.report.humanFix(
        `${spec.itemCode}: nhiệm vụ này vào CSDL ở cấp 2 nên ${spec.list.length} nhắc việc chưa ` +
          'nhập được — chuyển nó xuống cấp 3 dưới một công việc con rồi đặt lại nhắc việc'
      );
      continue;
    }
    for (const raw of spec.list) {
      const { date, problem, content } = readReminder(raw);
      if (!date) {
        counter.addSkipped(
          `${spec.itemCode}: nhắc việc không có ngày dùng được (${problem ?? 'ô rỗng'})`
        );
        continue;
      }
      await perRow(ctx, counter, spec.itemCode, async () => {
        // `reminders` không có khoá tự nhiên nào ⇒ chống trùng bằng chính bộ ba dữ liệu.
        const { rows } = await ctx.client.query(
          `INSERT INTO reminders (work_item_id, remind_date, content)
           SELECT $1, $2::date, $3
           WHERE NOT EXISTS (SELECT 1 FROM reminders
             WHERE work_item_id = $1 AND remind_date = $2::date AND content = $3)
           RETURNING 1`,
          [spec.itemId, date, content]
        );
        if (rows.length === 1) counter.addInserted();
        else counter.addUpdated();
      });
    }
  }
}

// ============================ 7. Đề nghị ============================

// Viết đúng như CHECK của `proposals` trong 001_init.sql.
const PROPOSAL_TYPES = Object.freeze(['Trong kế hoạch', 'Ngoài kế hoạch']);
const PROPOSAL_STATUS = Object.freeze(['Đề xuất mới', 'Chờ duyệt', 'Đã duyệt', 'Từ chối']);

async function findWorkId(ctx, code) {
  if (code === '') return null;
  const inRun = ctx.workIdByCode.get(code);
  if (inRun !== undefined) return inRun;
  const { rows } = await ctx.client.query('SELECT id FROM works WHERE code = $1', [code]);
  return rows[0]?.id ?? null;
}

async function findItemId(ctx, code) {
  if (code === '') return null;
  const inRun = ctx.items.get(code);
  if (inRun) return inRun.id;
  const { rows } = await ctx.client.query('SELECT id FROM work_items WHERE code = $1', [code]);
  return rows[0]?.id ?? null;
}

export async function importProposals(ctx) {
  const s = sheet(ctx.snapshot, 'Đề nghị');
  const counter = ctx.report.entity('proposals');
  counter.countSheetRows(s.rows.length);

  for (const row of s.rows) {
    const code = text(row['Mã đề nghị']);
    if (code === '') {
      counter.addSkipped(`dòng ${row.__row}: thiếu Mã đề nghị`);
      continue;
    }

    const workCode = text(row['Mã dự án']);
    const itemCode = text(row['Mã nhiệm vụ']);
    const workId = await findWorkId(ctx, workCode);
    const itemId = await findItemId(ctx, itemCode);
    // Dữ liệu thật có đề nghị trỏ vào DA010 không tồn tại: để NULL và nói ra, không bỏ đề nghị.
    if (workCode !== '' && workId === null) {
      counter.addNote(`${code}: "Mã dự án" = "${workCode}" không tồn tại ⇒ work_id = NULL`);
    }
    if (itemCode !== '' && itemId === null) {
      counter.addNote(`${code}: "Mã nhiệm vụ" = "${itemCode}" không tồn tại ⇒ work_item_id = NULL`);
    }

    const creator = ctx.users.byEmailOrName(row['Người đề nghị'], `${code}.Người đề nghị`);
    if (creator.problem) counter.addNote(creator.problem);

    const type = pickFromList(row.Loại, PROPOSAL_TYPES, PROPOSAL_TYPES[0]);
    if (type.unknown) counter.addNote(`${code}: Loại lạ "${text(row.Loại)}" ⇒ "${type.value}"`);
    const status = pickFromList(row['Trạng thái'], PROPOSAL_STATUS, PROPOSAL_STATUS[0]);
    if (status.unknown) {
      counter.addNote(`${code}: Trạng thái lạ "${text(row['Trạng thái'])}" ⇒ "${status.value}"`);
    }
    const date = parseDate(row['Ngày đề nghị']);
    if (date.problem) counter.addNote(`${code}.Ngày đề nghị: ${date.problem}`);

    await perRow(ctx, counter, code, async () => {
      const { rows } = await ctx.client.query(
        `INSERT INTO proposals (code, type, work_id, work_item_id, content, url, supplier,
           creator_id, creator_name, proposal_date, status, review_note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (code) DO UPDATE SET type = EXCLUDED.type, work_id = EXCLUDED.work_id,
           work_item_id = EXCLUDED.work_item_id, content = EXCLUDED.content, url = EXCLUDED.url,
           supplier = EXCLUDED.supplier, creator_id = EXCLUDED.creator_id,
           creator_name = EXCLUDED.creator_name, proposal_date = EXCLUDED.proposal_date,
           status = EXCLUDED.status, review_note = EXCLUDED.review_note, updated_at = now()
         RETURNING id, ${INSERTED}`,
        [
          code,
          type.value,
          workId,
          itemId,
          text(row['Nội dung đề nghị']),
          text(row['URL đề nghị']),
          text(row['Nhà cung cấp']),
          creator.id,
          creator.name,
          date.date,
          status.value,
          text(row['Ghi chú duyệt']),
        ]
      );
      countUpsert(counter, rows);
    });
  }
}

// ============================ 8. Quản lý App ============================

export async function importApps(ctx) {
  const s = sheet(ctx.snapshot, 'Quản lý App');
  const counter = ctx.report.entity('apps');
  counter.countSheetRows(s.rows.length);

  for (const row of s.rows) {
    const code = text(row['Mã App']);
    const name = text(row['Tên App']);
    if (code === '' || name === '') {
      counter.addSkipped(`dòng ${row.__row}: thiếu Mã App hoặc Tên App`);
      continue;
    }

    // `Phân quyền` của App là DANH SÁCH vai trò, ngăn bằng `;` hoặc `,`. Rỗng = mọi vai trò thấy.
    const roles = [];
    for (const piece of text(row['Phân quyền'])
      .split(/[;,]/)
      .map((x) => x.trim())
      .filter((x) => x !== '')) {
      const { role, unknown } = normalizeRole(piece);
      if (unknown) {
        counter.addNote(`${code}: Phân quyền có vai trò lạ "${piece}" ⇒ bỏ mục đó`);
        continue;
      }
      if (!roles.includes(role)) roles.push(role);
    }

    const creator = ctx.users.byEmailOrName(row['Người tạo'], `${code}.Người tạo`);
    if (creator.problem) counter.addNote(creator.problem);

    await perRow(ctx, counter, code, async () => {
      const { rows } = await ctx.client.query(
        `INSERT INTO apps (code, name, url, icon_url, description, category, allowed_roles,
           created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url,
           icon_url = EXCLUDED.icon_url, description = EXCLUDED.description,
           category = EXCLUDED.category, allowed_roles = EXCLUDED.allowed_roles,
           created_by = EXCLUDED.created_by, updated_at = now()
         RETURNING id, ${INSERTED}`,
        [
          code,
          name,
          text(row.URL),
          text(row['Icon URL']),
          text(row['Mô tả']),
          text(row['Danh mục']),
          roles,
          creator.id,
        ]
      );
      countUpsert(counter, rows);
    });
  }
}

// ============================ 9. Chat ============================

export async function importChatMessages(ctx) {
  const s = sheet(ctx.snapshot, 'Chat');
  const counter = ctx.report.entity('chat_messages');

  for (const row of s.rows) {
    const chatCode = text(row['Mã chat']) || `dòng ${row.__row}`;
    const cell = parseJsonArrayCell(row['Chat JSON']);
    if (!cell.ok) {
      counter.addSkipped(`${chatCode}.Chat JSON hỏng (${cell.error}) ⇒ bỏ toàn bộ ô này`);
      continue;
    }
    counter.countSheetRows(cell.items.length);

    for (const msg of cell.items) {
      const message = text(msg.message);
      if (message === '') {
        counter.addSkipped(`${chatCode}: một tin nhắn không có nội dung`);
        continue;
      }
      // `created_at` = cột `Ngày` ghép với giờ `HH:MM` của từng tin (§4.3).
      const when = combineDateAndClock(row.Ngày, msg.timestamp);
      if (when.problem) counter.addNote(`${chatCode}: ${when.problem}`);
      if (!when.at) {
        counter.addSkipped(`${chatCode}: không đọc được ngày "${text(row.Ngày)}" của tin nhắn`);
        continue;
      }
      const author = ctx.users.byEmailOrName(msg.user, `${chatCode}.người gửi`);
      if (author.problem) counter.addNote(author.problem);

      await perRow(ctx, counter, chatCode, async () => {
        // Không có khoá tự nhiên ⇒ chống trùng bằng (người gửi, nội dung, thời điểm).
        const { rows } = await ctx.client.query(
          `INSERT INTO chat_messages (user_id, user_name, message, created_at)
           SELECT $1, $2, $3, $4::timestamptz
           WHERE NOT EXISTS (SELECT 1 FROM chat_messages
             WHERE user_name = $2 AND message = $3 AND created_at = $4::timestamptz)
           RETURNING 1`,
          [author.id, text(msg.user), message, when.at]
        );
        if (rows.length === 1) counter.addInserted();
        else counter.addUpdated();
      });
    }
  }
}

// ============================ 10. Thông báo ============================

// Sheet này KHÔNG có trong tệp tải về (§13.8) nên chưa biết chắc tên cột. Nhận vài cách viết đã
// dùng trong bản cũ; sheet không có thì nhập 0 dòng và ghi vào báo cáo, không báo lỗi.
const NOTIFY_KEYS = Object.freeze({
  user: ['Người nhận', 'Email người nhận', 'Người dùng'],
  content: ['Nội dung', 'Nội dung thông báo', 'Thông báo'],
  type: ['Loại', 'Kiểu'],
  at: ['Ngày', 'Thời gian', 'Ngày tạo'],
  read: ['Đã đọc', 'Trạng thái đọc'],
});

const pick = (row, keys) => keys.map((k) => row[k]).find((v) => text(v) !== '') ?? '';

export async function importNotifications(ctx) {
  const s = sheet(ctx.snapshot, 'Thông báo');
  const counter = ctx.report.entity('notifications');
  counter.countSheetRows(s.rows.length);

  for (const row of s.rows) {
    const label = `dòng ${row.__row}`;
    const target = ctx.users.byEmailOrName(pick(row, NOTIFY_KEYS.user), `${label}.Người nhận`);
    if (target.id === null) {
      // `notifications.user_id` là NOT NULL: không biết gửi cho ai thì không có dòng nào đúng.
      counter.addSkipped(
        `${label}: không dò ra người nhận "${text(pick(row, NOTIFY_KEYS.user))}" ` +
          '⇒ không nhập được (user_id là NOT NULL)'
      );
      continue;
    }
    const when = parseTimestamp(pick(row, NOTIFY_KEYS.at));
    if (when.problem) counter.addNote(`${label}: ${when.problem}`);
    const content = text(pick(row, NOTIFY_KEYS.content));
    const isRead = /^(x|có|true|1|đã đọc)$/i.test(text(pick(row, NOTIFY_KEYS.read)));

    await perRow(ctx, counter, label, async () => {
      const { rows } = await ctx.client.query(
        `INSERT INTO notifications (user_id, content, type, is_read, created_at)
         SELECT $1, $2, $3, $4, coalesce($5::timestamptz, now())
         WHERE NOT EXISTS (SELECT 1 FROM notifications
           WHERE user_id = $1 AND content = $2
             AND (created_at = $5::timestamptz OR $5::timestamptz IS NULL))
         RETURNING 1`,
        [target.id, content, text(pick(row, NOTIFY_KEYS.type)) || 'info', isRead, when.at]
      );
      if (rows.length === 1) counter.addInserted();
      else counter.addUpdated();
    });
  }
}

// ============================ 11. Nhật ký ============================

export async function importActivityLogs(ctx) {
  const s = sheet(ctx.snapshot, WORK_SHEET);
  const counter = ctx.report.entity('activity_logs');

  for (const row of s.rows) {
    const workCode = text(row['Mã dự án']);
    const cell = parseJsonArrayCell(row['Nhật ký JSON']);
    if (!cell.ok) {
      counter.addSkipped(`${workCode}.Nhật ký JSON hỏng (${cell.error}) ⇒ bỏ toàn bộ ô này`);
      continue;
    }
    counter.countSheetRows(cell.items.length);
    const workId = await findWorkId(ctx, workCode);

    for (const entry of cell.items) {
      const action = text(entry['Hành động']);
      if (action === '') {
        counter.addSkipped(`${workCode}: một dòng nhật ký không có "Hành động"`);
        continue;
      }
      const when = parseTimestamp(entry['Thời gian']);
      if (when.problem) counter.addNote(`${workCode}: ${when.problem}`);
      if (!when.at) {
        counter.addSkipped(`${workCode}: dòng nhật ký "${action}" không có thời gian dùng được`);
        continue;
      }
      // Cột này ghi EMAIL (dữ liệu thật), nhưng bản cũ có chỗ ghi họ tên ⇒ thử cả hai.
      const actor = ctx.users.byEmailOrName(entry['Người thực hiện'], `${workCode}.nhật ký`);
      const actorName = text(entry['Người thực hiện']);

      await perRow(ctx, counter, workCode, async () => {
        const { rows } = await ctx.client.query(
          `INSERT INTO activity_logs (actor_id, actor_name, action, entity_type, entity_id,
             work_id, details, created_at)
           SELECT $1, $2, $3, 'work', $4, $4, $5::jsonb, $6::timestamptz
           WHERE NOT EXISTS (SELECT 1 FROM activity_logs
             WHERE (work_id = $4 OR $4::bigint IS NULL) AND action = $3 AND actor_name = $2
               AND created_at = $6::timestamptz)
           RETURNING 1`,
          [
            actor.id,
            actorName,
            action,
            workId,
            JSON.stringify({ text: text(entry['Chi tiết']), source: 'import-from-sheets' }),
            when.at,
          ]
        );
        if (rows.length === 1) counter.addInserted();
        else counter.addUpdated();
      });
    }
  }
}

// ============================ Điều phối ============================

/** Trạng thái dùng chung giữa các bước — mỗi bước chỉ đọc thứ bước trước đã dựng. */
export function createContext({ client, snapshot, report }) {
  return {
    client,
    snapshot,
    report,
    users: createUserResolver([]),
    departments: createDepartmentResolver([]),
    workIdByCode: new Map(),
    items: new Map(),
    reminderSpecs: [],
    needsApprovalDecision: new Set(),
    // Mật khẩu tạm chỉ nằm trong bộ nhớ rồi đi ra tệp riêng của `cli.js`. KHÔNG vào báo cáo,
    // KHÔNG vào log.
    tempPasswords: [],
  };
}

// Đúng thứ tự của việc 2.1. Đổi thứ tự là vỡ khoá ngoại, nên danh sách này là chỗ duy nhất giữ nó.
const STEPS = Object.freeze([
  ['departments', importDepartments],
  ['users', importUsers],
  ['department_managers', importDepartmentManagers],
  ['works', importWorks],
  ['work_items (lượt 1: chèn)', importWorkItems],
  ['work_items (lượt 2: nối cha)', linkWorkItemParents],
  ['reminders', importReminders],
  ['proposals', importProposals],
  ['apps', importApps],
  ['chat_messages', importChatMessages],
  ['notifications', importNotifications],
  ['activity_logs', importActivityLogs],
]);

export const STEP_NAMES = Object.freeze(STEPS.map(([name]) => name));

/**
 * Nhập cả bản chụp bằng MỘT `client` đang mở transaction. Chỗ gọi (`cli.js` hoặc test) quyết
 * định COMMIT hay ROLLBACK — nhờ vậy `--dry-run` đi qua đúng những câu SQL và đúng những ràng
 * buộc của lần chạy thật, chỉ khác ở chữ ROLLBACK cuối cùng (việc 2.3).
 *
 * @param {{client: object, snapshot: object, report: object, onStep?: (name: string) => void}} args
 */
export async function runImport({ client, snapshot, report, onStep = null }) {
  for (const name of checkSheets(snapshot)) {
    report.missingSheet(name, 'không có trong tệp tải về ⇒ nhập 0 dòng (không phải lỗi)');
  }

  const ctx = createContext({ client, snapshot, report });
  for (const [name, step] of STEPS) {
    if (onStep) onStep(name);
    await step(ctx);
  }
  return ctx;
}
