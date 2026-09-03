-- dev-vong14.sql — DỮ LIỆU TEST MỚI theo LUỒNG «KẾT QUẢ NHIỆM VỤ LÀ FILE» (014, Vòng 14).
--
-- Người dùng yêu cầu 2026-09-01: «tạo lại data test theo đúng quy trình mới, xóa data cũ đi».
-- Chạy bằng:  cd server && npm run seed:v14    (hoặc: node src/db/seeds/run.js dev-vong14.sql)
-- Bộ chạy `run.js` TỪ CHỐI khi NODE_ENV=production hoặc tên CSDL chứa 'prod' — hai chốt cũ.
--
-- KHÁC dev.sql ở đâu:
--   * dev.sql là bộ mẫu §8.3 cho Phase 0–13 (9 công việc, dữ liệu cố ý bẩn) — GIỮ NGUYÊN.
--   * file này XOÁ SẠCH dữ liệu nghiệp vụ rồi dựng một bộ GỌN đúng luồng Vòng 14: mỗi trạng thái
--     của `task_files` có sẵn một nhiệm vụ để bấm thử, không phải tự tạo tay 5 lần.
--
-- Bộ tài khoản (mật khẩu chung `Test@12345`, KHÔNG bắt đổi lần đầu để bấm thử nhanh):
--   gd@test.local    Giám đốc (admin)          — thấy tất cả, tự chốt mọi cửa
--   pgd@test.local   Phó Giám đốc              — phụ trách PH01 (nhận «Trình lãnh đạo»)
--   tp@test.local    Trưởng phòng PH01         — xem/góp ý/yêu cầu sửa/trình/hoàn thành
--   pp@test.local    Phó phòng PH01            — quyền như Trưởng phòng (Quyết định số 5)
--   nv1@test.local   Cán bộ PH01 (Lê Thị Nhân) — người NỘP file, chủ 5 nhiệm vụ mẫu
--   nv2@test.local   Cán bộ PH01 (Vũ Văn Bình) — cán bộ thứ hai, thử «không phải việc của mình»
--   nvb@test.local   Cán bộ PH02               — NGOÀI phòng: mọi đường phải 403
--
-- 5 nhiệm vụ mẫu, mỗi cái ở MỘT trạng thái của luồng file (seed luôn `task_files`):
--   NV-01 «Báo cáo kết quả đào tạo quý 3»   → chưa có file (bấm «Tải file lên» để bắt đầu)
--   NV-02 «Biên bản họp hội đồng đào tạo»   → cho-xem       (Cán bộ vừa nộp v1, chờ TP/PP xem)
--   NV-03 «Kế hoạch đào tạo năm 2027»       → can-sua       (TP đã yêu cầu sửa, có ý kiến)
--   NV-04 «Đề án nâng cao chất lượng»       → cho-lanh-dao  (TP đã trình Phó Giám đốc)
--   NV-05 «Quy chế thi sát hạch nội bộ»     → da-duyet      (PGD đã duyệt — KHÓA, chỉ xem)
--
-- File vật lý: seed chỉ tạo DÒNG trong CSDL, chưa có file trên đĩa cho NV-02..05 (tải về sẽ báo
-- «File trên máy chủ đã bị mất» — đúng thiết kế). Muốn thử tải/sửa trực tuyến thì tự nộp file mới
-- ở NV-01: luồng đầy đủ (upload → ONLYOFFICE → lưu thành bản mới) chạy trên chính bản đó.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────────────────
-- 1. XOÁ DATA CŨ — chỉ dữ liệu NGHIỆP VỤ, giữ lược đồ. TRUNCATE ... CASCADE nên khỏi lo thứ tự.
--    `RESTART IDENTITY` để mã CV001 / NV001 đoán được khi bấm thử.
-- ─────────────────────────────────────────────────────────────────────────────────────────
TRUNCATE task_file_flow, task_file_comments, task_file_versions, task_files,
         permission_overrides, work_month_names, delegations,
         reminders, notifications, chat_messages, activity_logs,
         proposals, apps, work_items, works, department_managers, users, departments
  RESTART IDENTITY CASCADE;

SELECT setval('seq_department_code', 1, false);
SELECT setval('seq_user_code',       1, false);
SELECT setval('seq_work_code',       1, false);
SELECT setval('seq_work_item_code',  1, false);
SELECT setval('seq_proposal_code',   1, false);
SELECT setval('seq_app_code',        1, false);

-- ─────────────────────────────────────────────────────────────────────────────────────────
-- 2. PHÒNG + NGƯỜI
-- ─────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO departments (code, name, sort_order) VALUES
  ('PH01', 'Phòng Đào tạo',  1),
  ('PH02', 'Phòng Kế hoạch', 2);

-- must_change_password = FALSE: bộ này để BẤM THỬ LUỒNG FILE, không phải để thử màn đổi mật khẩu
-- (dev.sql vẫn giữ true cho đường đó). Băm là của `Test@12345`, bcrypt cost 12.
INSERT INTO users (code, full_name, email, password_hash, must_change_password,
                   position, role, object_type, department_id, dept_role)
VALUES
  ('NV001', 'Giám đốc', 'gd@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', false,
   'Giám đốc',     'admin',        'Nội bộ', NULL, NULL),
  ('NV002', 'Phó Giám đốc Phụ trách', 'pgd@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', false,
   'Phó Giám đốc', 'Phó Giám đốc', 'Nội bộ', NULL, NULL),
  ('NV003', 'Trần Thị Trưởng', 'tp@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', false,
   'Trưởng phòng', 'Trưởng phòng', 'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH01'), 'Trưởng phòng'),
  ('NV004', 'Ngô Văn Phó', 'pp@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', false,
   'Phó phòng',    'Phó phòng',    'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH01'), 'Phó phòng'),
  ('NV005', 'Lê Thị Nhân', 'nv1@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', false,
   'Chuyên viên',  'Nhân viên',    'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH01'), 'Nhân viên'),
  ('NV006', 'Vũ Văn Bình', 'nv2@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', false,
   'Chuyên viên',  'Nhân viên',    'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH01'), 'Nhân viên'),
  -- NGOÀI phòng PH01: mọi đường của luồng file phải trả 403 cho người này (TC-TF-13).
  ('NV007', 'Phạm Văn Ngoài', 'nvb@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', false,
   'Chuyên viên',  'Nhân viên',    'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH02'), 'Nhân viên');

-- Phó GĐ PHỤ TRÁCH PH01 — nguồn DUY NHẤT của «Trình lãnh đạo» (`department_managers`). Thiếu dòng
-- này thì TP bấm «Trình Phó giám đốc» vẫn chạy nhưng KHÔNG ai nhận thông báo (đúng thiết kế cũ).
INSERT INTO department_managers (department_id, user_id, role)
SELECT d.id, u.id, m.role
FROM (VALUES
  ('PH01', 'NV002', 'deputy_director'),
  ('PH02', 'NV002', 'deputy_director'),
  ('PH01', 'NV003', 'head'),
  ('PH01', 'NV004', 'vice')
) AS m(dept_code, user_code, role)
JOIN departments d ON d.code = m.dept_code
JOIN users       u ON u.code = m.user_code;

-- ─────────────────────────────────────────────────────────────────────────────────────────
-- 3. CÔNG VIỆC (cấp 1) + CÔNG VIỆC CON (cấp 2) — đều «Đã duyệt» để nhiệm vụ hiện ngay,
--    không phải đi qua luồng duyệt cây trước khi thử luồng FILE.
-- ─────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO works (code, name, description, manager_id, manager_name, department_id,
                   start_date, end_date, status, approval_status, approver_id, approved_at,
                   sort_order, created_by, created_by_name, origin)
SELECT 'CV001', 'Công tác đào tạo năm 2026',
       'Công việc gốc để thử luồng KẾT QUẢ LÀ FILE (Vòng 14).',
       tp.id, tp.full_name, d.id,
       '2026-09-01', '2026-12-31', 'Đang thực hiện',
       'Đã duyệt', pgd.id, '2026-09-01 01:00+00',
       1, tp.id, tp.full_name, 'Tự đăng ký'
FROM departments d, users tp, users pgd
WHERE d.code = 'PH01' AND tp.code = 'NV003' AND pgd.code = 'NV002';

INSERT INTO work_items (code, work_id, parent_id, level, department_id, name, description,
                        assignee_id, assignee_name, status, priority,
                        start_date, due_date, completion, approval_status, approver_id,
                        approved_at, sort_order, created_by, created_by_name, origin,
                        leader_ids)
SELECT 'CV001-001', w.id, NULL, 2, w.department_id, 'Tài liệu và báo cáo đào tạo',
       'Khối công việc con chứa 5 nhiệm vụ mẫu của luồng file.',
       tp.id, tp.full_name, 'Đang thực hiện', 'Cao',
       '2026-09-01', '2026-12-31', 40, 'Đã duyệt', pgd.id, '2026-09-01 01:05+00',
       1, tp.id, tp.full_name, 'Tự đăng ký',
       -- Cấp 2 phải NÊU đủ hai lãnh đạo: luật `LEADER_NOT_IN_SOURCE` (assignments/service.js) đòi
       -- lãnh đạo của nhiệm vụ cấp 3 nằm trong danh sách của công việc con.
       ARRAY[tp.id, pp.id]::bigint[]
FROM works w, users tp, users pgd, users pp
WHERE w.code = 'CV001' AND tp.code = 'NV003' AND pgd.code = 'NV002' AND pp.code = 'NV004';


-- ─────────────────────────────────────────────────────────────────────────────────────────
-- 4. NĂM NHIỆM VỤ (cấp 3) — tất cả giao cho Cán bộ NV005 (Lê Thị Nhân), «Đã duyệt» theo luật
--    việc 5.1 (cấp 3 không qua cửa duyệt cây), để bấm thẳng vào luồng FILE.
-- ─────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO work_items (code, work_id, parent_id, level, department_id, name, description,
                        assignee_id, assignee_name, status, priority,
                        start_date, due_date, completion, approval_status,
                        sort_order, created_by, created_by_name, origin,
                        assigned_by_id, assigned_by_name, assigned_at, leader_ids)
SELECT n.code, w.id, p.id, 3, w.department_id, n.name, n.mo_ta,
       nv.id, nv.full_name, n.status, 'Trung bình',
       '2026-09-01', n.due_date::date, n.completion, 'Đã duyệt',
       n.sort_order, tp.id, tp.full_name, 'Được giao',
       tp.id, tp.full_name, '2026-09-01 02:00+00',
       -- LÃNH ĐẠO PHÒNG PHỤ TRÁCH — bắt buộc từ 2026-09-02: chỉ người có tên ở đây (cùng Phó GĐ phụ
       -- trách / Giám đốc) mới xem, sửa, duyệt được file kết quả của nhiệm vụ. Bỏ trống thì hàng chờ
       -- của TP/PP trống và họ bị 403 khi nộp — đúng luật nhưng làm người test tưởng là lỗi.
       -- Cấp 3 chỉ được MỘT lãnh đạo (`task_leader_single`, migration 005) nên chia đôi: NV-02/04
       -- cho Trưởng phòng, NV-01/03/05 cho Phó phòng — test được cả hai vai mà không phải sửa data.
       CASE WHEN n.code IN ('CV001-003', 'CV001-005') THEN ARRAY[tp.id]::bigint[]
            ELSE ARRAY[pp.id]::bigint[] END

FROM (VALUES
  ('CV001-002', 'NV-01 Báo cáo kết quả đào tạo quý 3',
   'CHƯA CÓ FILE — bấm «Tải file lên» ở ô «Kết quả» để bắt đầu luồng.',
   'Đang thực hiện', '2026-09-20', 30, 1),
  ('CV001-003', 'NV-02 Biên bản họp hội đồng đào tạo',
   'Cán bộ đã nộp bản 1 — đang CHỜ TP/PP XEM (badge vàng).',
   'Đang thực hiện', '2026-09-22', 50, 2),
  ('CV001-004', 'NV-03 Kế hoạch đào tạo năm 2027',
   'TP đã YÊU CẦU SỬA kèm ý kiến — Cán bộ nộp bản 2 (badge đỏ nhạt).',
   'Đang thực hiện', '2026-09-25', 40, 3),
  ('CV001-005', 'NV-04 Đề án nâng cao chất lượng giảng viên',
   'TP đã TRÌNH PHÓ GIÁM ĐỐC — chờ lãnh đạo xử (badge tím).',
   'Đang thực hiện', '2026-09-28', 70, 4),
  ('CV001-006', 'NV-05 Quy chế thi sát hạch nội bộ',
   'PGD ĐÃ DUYỆT — kết quả chốt, KHÓA upload (badge xanh đậm).',
   'Hoàn thành', '2026-09-15', 100, 5)
) AS n(code, name, mo_ta, status, due_date, completion, sort_order)
JOIN works      w  ON w.code = 'CV001'
JOIN work_items p  ON p.code = 'CV001-001'
JOIN users      nv ON nv.code = 'NV005'
JOIN users      tp ON tp.code = 'NV003'
JOIN users      pp ON pp.code = 'NV004';

-- ─────────────────────────────────────────────────────────────────────────────────────────
-- 5. BỐN NHÓM FILE (014) — mỗi nhóm một trạng thái của luồng, kèm BẢN + Ý KIẾN + BẢNG LUỒNG.
--    NV-01 cố ý KHÔNG có nhóm nào: đó là chỗ bấm «Tải file lên» để chạy luồng đầy đủ (kể cả
--    sửa trực tuyến bằng ONLYOFFICE, vì bản do chính mình nộp mới có file thật trên đĩa).
-- ─────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO task_files (item_id, ten_goc, trang_thai, created_by)
SELECT i.id, f.ten_goc, f.trang_thai, nv.id
FROM (VALUES
  ('CV001-003', 'bien-ban-hop-hoi-dong.docx', 'cho-xem'),
  ('CV001-004', 'ke-hoach-dao-tao-2027.docx', 'can-sua'),
  ('CV001-005', 'de-an-nang-cao-chat-luong.docx', 'cho-lanh-dao'),
  ('CV001-006', 'quy-che-thi-sat-hach.pdf', 'da-duyet')
) AS f(item_code, ten_goc, trang_thai)
JOIN work_items i ON i.code = f.item_code
JOIN users     nv ON nv.code = 'NV005';

-- BẢN: NV-02 và NV-05 mỗi cái 1 bản; NV-03 có 2 bản (nộp lại sau khi bị yêu cầu sửa);
-- NV-04 có 2 bản (bản của Cán bộ + bản TP tự chỉnh trước khi trình).
INSERT INTO task_file_versions (file_id, version_no, ten_luu, ten_goc, loai_mime, kich_thuoc,
                                uploaded_by, uploaded_at)
SELECT tf.id, v.version_no, v.ten_luu, tf.ten_goc, v.loai_mime, v.kich_thuoc,
       u.id, v.uploaded_at::timestamptz
FROM (VALUES
  ('CV001-003', 1, 'v1-seed-bien-ban.docx',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 18432,
   'NV005', '2026-09-02 02:10+00'),
  ('CV001-004', 1, 'v1-seed-ke-hoach.docx',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 22016,
   'NV005', '2026-09-02 03:00+00'),
  ('CV001-004', 2, 'v2-seed-ke-hoach.docx',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 23040,
   'NV005', '2026-09-03 01:30+00'),
  ('CV001-005', 1, 'v1-seed-de-an.docx',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 31744,
   'NV005', '2026-09-02 04:00+00'),
  ('CV001-005', 2, 'v2-seed-de-an-tp-sua.docx',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 32768,
   'NV003', '2026-09-04 02:20+00'),
  ('CV001-006', 1, 'v1-seed-quy-che.pdf', 'application/pdf', 51200,
   'NV005', '2026-09-05 01:00+00')
) AS v(item_code, version_no, ten_luu, loai_mime, kich_thuoc, uploader, uploaded_at)
JOIN work_items i  ON i.code = v.item_code
JOIN task_files tf ON tf.item_id = i.id
JOIN users      u  ON u.code = v.uploader;

-- Ý KIẾN (task_file_comments) — gắn theo BẢN, hiện khi bấm chữ «Xem ý kiến» của dòng file.
INSERT INTO task_file_comments (version_id, nguoi_id, vai, noi_dung, created_at)
SELECT v.id, u.id, u.role, c.noi_dung, c.created_at::timestamptz
FROM (VALUES
  ('CV001-004', 1, 'NV003',
   'Mục 2 thiếu số liệu học viên năm 2026, bổ sung bảng đối chiếu rồi nộp lại.',
   '2026-09-02 07:30+00'),
  ('CV001-005', 1, 'NV003',
   'Phần kinh phí cần ghi rõ nguồn; tôi đã chỉnh trực tiếp ở bản 2 trước khi trình.',
   '2026-09-04 02:00+00'),
  ('CV001-005', 2, 'NV002',
   'Đã đọc bản 2, ý kiến: bổ sung lộ trình 3 năm ở mục 4 rồi trình lại lần cuối.',
   '2026-09-04 08:15+00'),
  ('CV001-006', 1, 'NV002',
   'Nội dung đạt yêu cầu, đồng ý duyệt.',
   '2026-09-05 03:40+00')
) AS c(item_code, version_no, nguoi, noi_dung, created_at)
JOIN work_items i          ON i.code = c.item_code
JOIN task_files tf         ON tf.item_id = i.id
JOIN task_file_versions v  ON v.file_id = tf.id AND v.version_no = c.version_no
JOIN users u               ON u.code = c.nguoi;

-- BẢNG LUỒNG (task_file_flow) — đúng thứ tự đã xảy ra; giao diện hiện MỚI NHẤT TRÊN ĐẦU.
INSERT INTO task_file_flow (file_id, version_id, nguoi_id, vai, hanh_dong, noi_dung, created_at)
SELECT tf.id, v.id, u.id, u.role, g.hanh_dong, g.noi_dung, g.created_at::timestamptz
FROM (VALUES
  -- NV-02: mới nộp, chờ TP/PP xem.
  ('CV001-003', 1, 'NV005', 'nop', 'Nộp biên bản họp lần 1', '2026-09-02 02:10+00'),
  -- NV-03: nộp → góp ý → yêu cầu sửa → nộp lại bản 2.
  ('CV001-004', 1, 'NV005', 'nop', 'Nộp kế hoạch bản đầu', '2026-09-02 03:00+00'),
  ('CV001-004', 1, 'NV003', 'gom-y',
   'Mục 2 thiếu số liệu học viên năm 2026, bổ sung bảng đối chiếu rồi nộp lại.',
   '2026-09-02 07:30+00'),
  ('CV001-004', 1, 'NV003', 'yeu-cau-sua',
   'Bổ sung bảng số liệu học viên 2026 vào mục 2 rồi nộp lại bản mới.',
   '2026-09-02 07:35+00'),
  ('CV001-004', 2, 'NV005', 'nop', 'Đã bổ sung bảng số liệu theo yêu cầu', '2026-09-03 01:30+00'),
  -- NV-04: nộp → TP tự sửa bản 2 → trình Phó Giám đốc.
  ('CV001-005', 1, 'NV005', 'nop', 'Nộp đề án bản đầu', '2026-09-02 04:00+00'),
  ('CV001-005', 1, 'NV003', 'gom-y',
   'Phần kinh phí cần ghi rõ nguồn; tôi đã chỉnh trực tiếp ở bản 2 trước khi trình.',
   '2026-09-04 02:00+00'),
  ('CV001-005', 2, 'NV003', 'nop', 'Bản Trưởng phòng chỉnh sửa', '2026-09-04 02:20+00'),
  ('CV001-005', 2, 'NV003', 'trinh-lanh-dao',
   'Kính trình Phó Giám đốc xem và cho ý kiến về đề án nâng cao chất lượng.',
   '2026-09-04 02:25+00'),
  -- NV-05: nộp → trình → PGD duyệt (chốt, khóa).
  ('CV001-006', 1, 'NV005', 'nop', 'Nộp quy chế bản cuối', '2026-09-05 01:00+00'),
  ('CV001-006', 1, 'NV003', 'trinh-lanh-dao',
   'Trình Phó Giám đốc phê duyệt quy chế thi sát hạch nội bộ.',
   '2026-09-05 02:00+00'),
  ('CV001-006', 1, 'NV002', 'duyet', '', '2026-09-05 03:45+00')
) AS g(item_code, version_no, nguoi, hanh_dong, noi_dung, created_at)
JOIN work_items i         ON i.code = g.item_code
JOIN task_files tf        ON tf.item_id = i.id
JOIN task_file_versions v ON v.file_id = tf.id AND v.version_no = g.version_no
JOIN users u              ON u.code = g.nguoi;

-- ─────────────────────────────────────────────────────────────────────────────────────────
-- 6. THÔNG BÁO — đúng những gì người dùng báo THIẾU: TP/PP nhận thông báo khi Cán bộ tạo mới
--    (nhiệm vụ) và khi có file chờ xem; PGD nhận khi TP trình lên.
--    `ref_type` khớp code: 'work_item' cho nhiệm vụ, 'task_file' cho luồng file.
-- ─────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO notifications (user_id, content, type, is_read, ref_type, ref_id, created_at)
SELECT u.id, n.content, n.type, false, n.ref_type, n.ref_id::bigint, n.created_at::timestamptz
FROM (VALUES
  -- TP + PP nhận «có nhiệm vụ mới của phòng» (Cán bộ tự tạo / được giao).
  ('NV003', 'Nhiệm vụ mới trong phòng: «NV-02 Biên bản họp hội đồng đào tạo» — Lê Thị Nhân phụ trách.',
   'approval_pending', 'work_item', NULL, '2026-09-02 02:05+00'),
  ('NV004', 'Nhiệm vụ mới trong phòng: «NV-02 Biên bản họp hội đồng đào tạo» — Lê Thị Nhân phụ trách.',
   'approval_pending', 'work_item', NULL, '2026-09-02 02:05+00'),
  -- TP + PP nhận «file chờ xem» (Cán bộ vừa nộp bản 1 của NV-02).
  ('NV003', 'Nhiệm vụ "NV-02 Biên bản họp hội đồng đào tạo": Lê Thị Nhân nộp bản 1 của "bien-ban-hop-hoi-dong.docx" — chờ Trưởng phòng/Phó phòng xem.',
   'approval_pending', 'task_file', NULL, '2026-09-02 02:10+00'),
  ('NV004', 'Nhiệm vụ "NV-02 Biên bản họp hội đồng đào tạo": Lê Thị Nhân nộp bản 1 của "bien-ban-hop-hoi-dong.docx" — chờ Trưởng phòng/Phó phòng xem.',
   'approval_pending', 'task_file', NULL, '2026-09-02 02:10+00'),
  -- Cán bộ nhận «bị yêu cầu sửa» (NV-03).
  ('NV005', 'Nhiệm vụ "NV-03 Kế hoạch đào tạo năm 2027": "ke-hoach-dao-tao-2027.docx" được yêu cầu sửa lại. Ghi chú: Bổ sung bảng số liệu học viên 2026 vào mục 2 rồi nộp lại bản mới.',
   'approval_rejected', 'task_file', NULL, '2026-09-02 07:35+00'),
  -- PGD nhận «được trình lên» (NV-04) — đúng đường department_managers.
  ('NV002', 'Nhiệm vụ "NV-04 Đề án nâng cao chất lượng giảng viên": "de-an-nang-cao-chat-luong.docx" được trình Phó GĐ phụ trách xem. Ghi chú: Kính trình Phó Giám đốc xem và cho ý kiến về đề án nâng cao chất lượng.',
   'approval_pending', 'task_file', NULL, '2026-09-04 02:25+00'),
  -- Cán bộ + TP nhận «đã duyệt» (NV-05).
  ('NV005', 'Nhiệm vụ "NV-05 Quy chế thi sát hạch nội bộ": "quy-che-thi-sat-hach.pdf" đã được duyệt — kết quả chốt.',
   'approval_approved', 'task_file', NULL, '2026-09-05 03:45+00'),
  ('NV003', 'Nhiệm vụ "NV-05 Quy chế thi sát hạch nội bộ": "quy-che-thi-sat-hach.pdf" đã được duyệt — kết quả chốt.',
   'approval_approved', 'task_file', NULL, '2026-09-05 03:45+00')
) AS n(nguoi, content, type, ref_type, ref_id, created_at)
JOIN users u ON u.code = n.nguoi;

-- ─────────────────────────────────────────────────────────────────────────────────────────
-- 7. BẢNG PHÂN QUYỀN ĐỘNG — để TRỐNG (không ghi đè nào) = dùng MẶC ĐỊNH của Vòng 14:
--      file:create  Cán bộ/TP/PP = ⏳ Chờ duyệt · Phó GĐ = ✓ (nộp là chốt luôn)
--      file:approve admin/PGD/TP/PP = ✓ (TP/PP có nút «Hoàn thành / Duyệt»)
--    Muốn thử «phê duyệt luôn»: đăng nhập Giám đốc → Quản lý tài khoản → Bảng phân quyền →
--    «Nộp kết quả (file nhiệm vụ)» cột Cán bộ = ✓ Cho phép → Lưu → Cán bộ nộp file ở NV-01.
-- ─────────────────────────────────────────────────────────────────────────────────────────

COMMIT;





