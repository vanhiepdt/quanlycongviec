-- Dữ liệu mẫu cho máy dev và cho UAT (§13.7). BỊA HẾT — không có một dòng nào là nhân sự thật.
--
-- Chạy bằng: npm run seed:dev   (bộ chạy TỪ CHỐI khi NODE_ENV=production, xem run.js)
-- Chạy lại được nhiều lần: mọi INSERT đều có ON CONFLICT, không sinh bản trùng.
--
-- Mật khẩu của cả 13 người: Test@12345   (bcrypt cost 12, xem hằng bên dưới)
-- Cả 13 đều must_change_password = true để chính đường "bắt đổi mật khẩu lần đầu" luôn được đi
-- thử tay ở UAT, chứ không chỉ có test tự động đi qua.
--
-- Dữ liệu mẫu CỐ Ý CÓ DỮ LIỆU BẨN (§8.3): email chữ hoa, hai người trùng họ tên, nhiệm vụ mồ
-- côi, link sai định dạng, ngày vắt qua năm và ngày 29/02. Thấy mấy dòng trông "sai" thì đó là
-- chủ ý — API phải chịu được, không được sửa cho "sạch".
--
-- Sinh lại hằng băm khi đổi mật khẩu mẫu:
--   node --input-type=module -e "import {hashSync} from '@node-rs/bcrypt';console.log(hashSync('MậtKhẩuMới',12))"

BEGIN;

-- 4 phòng lấy đúng tên và thứ tự của file thật (§13.8) để dev thấy cùng thứ tự Gantt như UAT.
-- PH05 là phòng RỖNG HOÀN TOÀN: không người, không công việc, không ai phụ trách — dòng duy
-- nhất mà API "xoá phòng" xoá được thật. PH04 có công việc nên xoá phải bị chặn: cần cả hai.
INSERT INTO departments (code, name, sort_order) VALUES
  ('PH01', 'Quản lý Đào tạo',        1),
  ('PH02', 'Nghiên cứu Khoa học',    2),
  ('PH03', 'Kế toán',                3),
  ('PH04', 'Hành chính Nhân sự',     4),
  ('PH05', 'Phòng Tạm (chưa có người)', 5)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- 13 người dùng. `department_id` dò theo MÃ phòng bằng truy vấn con: không viết số id cứng vào
-- đây, vì `bigserial` không đảm bảo PH01 = 1 sau khi bảng đã bị xoá/nhập lại vài lần.
INSERT INTO users (code, full_name, email, password_hash, must_change_password,
                   position, role, object_type, department_id, dept_role)
VALUES
  ('TEST001', 'Quản trị Hệ thống',       'admin@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Quản trị hệ thống', 'admin',              'Nội bộ', NULL, NULL),

  ('TEST002', 'Phó GĐ Một',              'pgd1@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Phó Giám đốc',      'Phó Giám đốc',        'Nội bộ', NULL, NULL),

  ('TEST003', 'Phó GĐ Hai',              'pgd2@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Phó Giám đốc',      'Phó Giám đốc',        'Nội bộ', NULL, NULL),

  ('TEST004', 'Trưởng phòng Đào tạo',    'tp01@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Trưởng phòng',      'Trưởng phòng',        'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH01'), 'Trưởng phòng'),

  ('TEST005', 'Phó phòng Đào tạo',       'pp01@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Phó phòng',         'Phó phòng',           'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH01'), 'Phó phòng'),

  ('TEST006', 'Trưởng phòng Kế toán',    'tp03@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Trưởng phòng',      'Trưởng phòng',        'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH03'), 'Trưởng phòng'),

  -- Vai trò ĐÚNG là 'Quản lý công việc' (§0 Từ vựng). Viết 'Quản lý dự án' là vi phạm
  -- CHECK users_role_valid và câu seed sẽ đổ ngay tại đây.
  ('TEST007', 'Quản lý Công việc',       'qlcv@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Chuyên viên',       'Quản lý công việc',   'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH01'), 'Nhân viên'),

  ('TEST008', 'Nhân viên Đào tạo',       'nv01@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Chuyên viên',       'Nhân viên',           'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH01'), 'Nhân viên'),

  ('TEST009', 'Nhân viên Kế toán',       'nv03@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Chuyên viên',       'Nhân viên',           'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH03'), 'Nhân viên'),

  -- Cố ý KHÔNG có phòng: TC-RBAC-09 kiểm rằng người không thuộc phòng nào không làm sập API.
  ('TEST010', 'Nhân viên Không phòng',   'nv00@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Chuyên viên',       'Nhân viên',           'Nội bộ', NULL, NULL),

  -- PH02 phải có người của mình, nếu không thì không kiểm được "Phó GĐ Một thấy PH01+PH02
  -- nhưng không thấy PH03+PH04".
  -- BẪY EMAIL CHỮ HOA (§8.3): cột `email` là `citext` nên người này đăng nhập được bằng
  -- 'nghien.cuu@test.local'. Bản Sheets cũ so chuỗi thẳng nên đăng nhập trượt — TC-AUTH-03.
  ('TEST011', 'Nhân viên Nghiên cứu',    'Nghien.Cuu@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Nghiên cứu viên',   'Nhân viên',           'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH02'), 'Nhân viên'),

  -- Đối tượng NGOÀI cơ quan: đứng tên trên đề nghị mua sắm, không thuộc phòng nào.
  ('TEST012', 'Nhà cung cấp Mẫu',        'ncc@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   '',                  'Nhân viên',           'Nhà cung cấp', NULL, NULL),

  -- BẪY TRÙNG HỌ TÊN (§8.3): trùng đúng tên với TEST008. Mọi chỗ dò người **theo tên** đều sai
  -- từ đây — phải dò theo email hoặc mã, và màn hình phải hiện thêm gì đó để phân biệt.
  ('TEST013', 'Nhân viên Đào tạo',       'nv01b@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Chuyên viên',       'Nhân viên',           'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH01'), 'Nhân viên')
ON CONFLICT (code) DO UPDATE SET
  full_name            = EXCLUDED.full_name,
  email                = EXCLUDED.email,
  password_hash        = EXCLUDED.password_hash,
  must_change_password = EXCLUDED.must_change_password,
  position             = EXCLUDED.position,
  role                 = EXCLUDED.role,
  object_type          = EXCLUDED.object_type,
  department_id        = EXCLUDED.department_id,
  dept_role            = EXCLUDED.dept_role,
  -- Seed lại là để có tài khoản dùng được: mở khoá và xoá bộ đếm sai mật khẩu luôn.
  is_active            = true,
  failed_logins        = 0,
  last_failed_login_at = NULL,
  locked_until         = NULL,
  updated_at           = now();

-- Phân công quản lý. Hai Phó GĐ phụ trách HAI NHÓM PHÒNG KHÁC NHAU — đó là điều kiện để
-- TC-RBAC-05 có nghĩa (Phó GĐ Một không được duyệt mục của PH03/PH04).
INSERT INTO department_managers (department_id, user_id, role)
SELECT d.id, u.id, m.role
FROM (VALUES
  ('PH01', 'TEST002', 'deputy_director'),
  ('PH02', 'TEST002', 'deputy_director'),
  ('PH03', 'TEST003', 'deputy_director'),
  ('PH04', 'TEST003', 'deputy_director'),
  ('PH01', 'TEST004', 'head'),
  ('PH01', 'TEST005', 'vice'),
  ('PH03', 'TEST006', 'head')
) AS m(dept_code, user_code, role)
JOIN departments d ON d.code = m.dept_code
JOIN users       u ON u.code = m.user_code
ON CONFLICT (department_id, user_id, role) DO NOTHING;

-- =====================================================================================
-- DỮ LIỆU NGHIỆP VỤ MẪU
-- =====================================================================================
-- Từ vựng: cấp 1 = CÔNG VIỆC (bảng `works`, mã CV0xx), cấp 2 = công việc con, cấp 3 =
-- nhiệm vụ (cả hai ở bảng `work_items`). KHÔNG gọi cấp 1 là "dự án" (§0 Từ vựng).
--
-- Mục tiêu: đủ để chạy hết Phase 3 mà không phải bịa thêm dữ liệu bằng tay —
--   * 9 công việc trải 4 phòng, đủ 3 trạng thái duyệt (Chờ duyệt / Đã duyệt / Từ chối);
--   * công việc con có nhiệm vụ bên dưới, có cả công việc con RỖNG (chưa có nhiệm vụ);
--   * nhiệm vụ đủ 4 trạng thái, có nhiệm vụ QUÁ HẠN và nhiệm vụ xong trước hạn (TC-STAT-03);
--   * người phụ trách có người dò ra được, có người để trống (API phải chịu được NULL);
--   * dữ liệu bẩn của §8.3: nhiệm vụ mồ côi, 4 link kết quả kèm 1 link sai định dạng,
--     nhắc việc nội dung rỗng, việc vắt qua năm (31/12 → 01/01) và việc ngày 29/02.
-- Mốc thời gian tính quanh 2026-09 để Gantt có việc đang chạy, việc đã xong, việc quá hạn.
--
-- Chạy lại được: bảng có `code` thì ON CONFLICT; bảng KHÔNG có khoá tự nhiên (nhắc việc,
-- chat, thông báo, nhật ký) thì INSERT ... WHERE NOT EXISTS theo nội dung.

-- 9 CÔNG VIỆC (cấp 1)
INSERT INTO works (code, name, description, manager_id, manager_name, department_id,
                   start_date, end_date, status, approval_status, approver_id, approved_at,
                   reject_reason, sort_order, created_by)
SELECT w.code, w.name, w.description,
       mu.id, coalesce(mu.full_name, ''), d.id,
       w.start_date::date, w.end_date::date, w.status, w.approval_status,
       au.id, w.approved_at::timestamptz, w.reject_reason, w.sort_order, cu.id
FROM (VALUES
  ('CV001', 'Tổ chức 03 lớp đào tạo cán bộ tín dụng',
   'Ba lớp ở ba miền, mỗi lớp 5 ngày, 40 học viên.',
   'TEST007', 'PH01', '2026-09-07', '2026-09-26', 'Đang thực hiện',
   'Đã duyệt', 'TEST002', '2026-08-20 02:00+00', '', 1, 'TEST004'),

  ('CV002', 'Khung chương trình đào tạo năm 2027',
   'Rà soát 12 chuyên đề, chốt khung trước 31/10.',
   'TEST004', 'PH01', '2026-06-01', '2026-07-31', 'Hoàn thành',
   'Đã duyệt', 'TEST002', '2026-05-28 03:30+00', '', 2, 'TEST004'),

  ('CV003', 'Đề tài nghiên cứu tín dụng vi mô',
   'Khảo sát 300 khách hàng tại 5 tỉnh.',
   'TEST011', 'PH02', '2026-07-01', '2026-12-31', 'Đang thực hiện',
   'Đã duyệt', 'TEST002', '2026-06-25 01:15+00', '', 3, 'TEST011'),

  ('CV004', 'Quyết toán chi phí đào tạo quý 3',
   'Đối chiếu chứng từ 3 lớp của CV001.',
   'TEST006', 'PH03', '2026-09-28', '2026-10-15', 'Chưa bắt đầu',
   'Chờ duyệt', NULL, NULL, '', 4, 'TEST009'),

  ('CV005', 'Rà soát hồ sơ nhân sự',
   'Phòng chưa phân người phụ trách — cố ý để trống.',
   NULL, 'PH04', '2026-08-10', '2026-09-15', 'Tạm dừng',
   'Đã duyệt', 'TEST003', '2026-08-05 04:00+00', '', 5, 'TEST001'),

  ('CV006', 'Chuyển hệ thống quản lý công việc lên VPS',
   'Bỏ Google Sheets, chạy Node + PostgreSQL trong Docker.',
   'TEST001', 'PH01', '2026-08-24', '2026-12-20', 'Đang thực hiện',
   'Đã duyệt', 'TEST002', '2026-08-24 06:00+00', '', 6, 'TEST001'),

  ('CV007', 'Đào tạo nghiệp vụ kế toán mới',
   'Bị trả lại vì trùng nội dung với CV002.',
   'TEST009', 'PH03', '2026-10-01', '2026-11-30', 'Chưa bắt đầu',
   'Từ chối', 'TEST003', '2026-09-02 07:20+00',
   'Trùng nội dung với CV002, gộp lại rồi trình lại.', 7, 'TEST009'),

  ('CV008', 'Tổng kết công tác đào tạo năm 2026',
   '', 'TEST005', 'PH01', '2026-12-01', '2026-12-31', 'Chưa bắt đầu',
   'Chờ duyệt', NULL, NULL, '', 8, 'TEST005'),

  -- NGÀY BIÊN (§8.3): bắt đầu 31/12/2026, kết thúc 01/01/2027. Lọc theo tháng/năm mà viết
  -- `year(start) = year(end)` là mất hẳn công việc này khỏi cả hai năm.
  ('CV009', 'Trực Tết Dương lịch 2027',
   'Vắt qua đêm giao thừa — cố ý để thử lọc theo tháng và theo năm.',
   'TEST010', 'PH04', '2026-12-31', '2027-01-01', 'Chưa bắt đầu',
   'Đã duyệt', 'TEST003', '2026-12-20 03:00+00', '', 9, 'TEST001')
) AS w(code, name, description, manager_code, dept_code, start_date, end_date, status,
       approval_status, approver_code, approved_at, reject_reason, sort_order, creator_code)
LEFT JOIN users       mu ON mu.code = w.manager_code
LEFT JOIN users       au ON au.code = w.approver_code
LEFT JOIN users       cu ON cu.code = w.creator_code
LEFT JOIN departments d  ON d.code  = w.dept_code
ON CONFLICT (code) DO UPDATE SET
  name            = EXCLUDED.name,
  description     = EXCLUDED.description,
  manager_id      = EXCLUDED.manager_id,
  manager_name    = EXCLUDED.manager_name,
  department_id   = EXCLUDED.department_id,
  start_date      = EXCLUDED.start_date,
  end_date        = EXCLUDED.end_date,
  status          = EXCLUDED.status,
  approval_status = EXCLUDED.approval_status,
  approver_id     = EXCLUDED.approver_id,
  approved_at     = EXCLUDED.approved_at,
  reject_reason   = EXCLUDED.reject_reason,
  sort_order      = EXCLUDED.sort_order,
  updated_at      = now();

-- CÔNG VIỆC CON (cấp 2) — cha của nhiệm vụ, KHÔNG có cha của chính nó (CHECK lvl2_no_parent).
-- Mã theo §13.4 mục 6: `<mã công việc>-NNN`, số đánh liên tục toàn hệ thống (không theo từng
-- công việc) để trùng mã là không thể xảy ra khi nhiệm vụ chuyển sang công việc khác.
--
-- Không khai `department_id` ở cả ba khối work_items dưới đây là CHỦ Ý: phòng của cấp 2 và cấp 3
-- luôn bằng phòng của công việc cha, và trigger `trg_work_items_sync_department` tự điền
-- (002_work_items_department.sql). Viết tay số phòng ở đây chỉ tạo thêm một chỗ để lệch.
INSERT INTO work_items (code, work_id, parent_id, level, name, description, assignee_id,
                        assignee_name, status, priority, start_date, due_date, report_date,
                        completion, target, output, notes, result_links, approval_status,
                        approver_id, approved_at, reject_reason, sort_order, created_by)
SELECT i.code, w.id, NULL, 2, i.name, i.description,
       au.id, coalesce(au.full_name, i.assignee_name), i.status, i.priority,
       i.start_date::date, i.due_date::date, i.report_date::date, i.completion,
       '', '', i.notes, '[]'::jsonb, i.approval_status, NULL, NULL, i.reject_reason,
       i.sort_order, cu.id
FROM (VALUES
  ('CV001-001', 'CV001', 'Lớp tại Vũng Tàu (07/9 - 12/9)', '', 'TEST007', '',
   'Hoàn thành',      'Cao',         '2026-09-07', '2026-09-12', '2026-09-12', 100, '',
   'Đã duyệt', '', 1),
  ('CV001-004', 'CV001', 'Lớp tại Nha Trang (14/9 - 19/9)', '', 'TEST007', '',
   'Đang thực hiện',  'Cao',         '2026-09-14', '2026-09-19', NULL,          60, '',
   'Đã duyệt', '', 2),
  -- Công việc con RỖNG: chưa có nhiệm vụ nào bên dưới. API tính tiến độ phải chịu được.
  ('CV001-008', 'CV001', 'Lớp tại Thanh Hoá (21/9 - 26/9)', '', 'TEST007', '',
   'Chưa bắt đầu',    'Trung bình',  '2026-09-21', '2026-09-26', NULL,           0,
   'Chưa mở lớp, chưa chia nhiệm vụ.', 'Đã duyệt', '', 3),
  ('CV002-009', 'CV002', 'Rà soát 12 chuyên đề', '', 'TEST004', '',
   'Hoàn thành',      'Trung bình',  '2026-06-01', '2026-07-25', '2026-07-24', 100, '',
   'Đã duyệt', '', 1),
  ('CV003-012', 'CV003', 'Khảo sát 5 tỉnh', 'Mỗi tỉnh 60 khách hàng.', 'TEST011', '',
   'Đang thực hiện',  'Cao',         '2026-07-15', '2026-11-30', NULL,          40, '',
   'Đã duyệt', '', 1),
  ('CV003-016', 'CV003', 'Viết báo cáo đề tài', '', 'TEST011', '',
   'Chưa bắt đầu',    'Trung bình',  '2026-12-01', '2026-12-28', NULL,           0, '',
   'Đã duyệt', '', 2),
  ('CV004-017', 'CV004', 'Đối chiếu chứng từ lớp Vũng Tàu', '', 'TEST009', '',
   'Chưa bắt đầu',    'Trung bình',  '2026-09-28', '2026-10-10', NULL,           0, '',
   'Chờ duyệt', '', 1),
  -- Không dò ra người phụ trách: `assignee_id` NULL nhưng `assignee_name` vẫn có chữ.
  ('CV005-019', 'CV005', 'Rà soát hồ sơ 120 nhân sự', '', NULL, 'Chưa phân công',
   'Tạm dừng',        'Thấp',        '2026-08-10', '2026-09-15', NULL,          20,
   'Chờ phòng phân người.', 'Đã duyệt', '', 1),
  ('CV006-020', 'CV006', 'Phase 1 — xác thực và phân quyền', '', 'TEST001', '',
   'Hoàn thành',      'Cao',         '2026-08-24', '2026-08-24', '2026-08-24', 100, '',
   'Đã duyệt', '', 1),
  ('CV006-021', 'CV006', 'Phase 2 — dữ liệu mẫu', '', 'TEST001', '',
   'Đang thực hiện',  'Cao',         '2026-08-24', '2026-08-31', NULL,          70, '',
   'Đã duyệt', '', 2),
  ('CV006-024', 'CV006', 'Phase 3 — API nghiệp vụ', '', 'TEST001', '',
   'Chưa bắt đầu',    'Cao',         '2026-09-01', '2026-09-30', NULL,           0, '',
   'Đã duyệt', '', 3),
  -- Bị trả lại: `approval_status` = 'Từ chối' có kèm lý do (chuỗi rỗng là sai nghiệp vụ).
  ('CV007-025', 'CV007', 'Soạn đề cương lớp kế toán', '', 'TEST009', '',
   'Chưa bắt đầu',    'Thấp',        '2026-10-01', '2026-10-20', NULL,           0, '',
   'Từ chối', 'Chờ gộp với CV002 rồi trình lại.', 1),
  ('CV009-026', 'CV009', 'Phân ca trực đêm giao thừa', '', 'TEST010', '',
   'Chưa bắt đầu',    'Cao',         '2026-12-31', '2027-01-01', NULL,           0, '',
   'Đã duyệt', '', 1)
) AS i(code, work_code, name, description, assignee_code, assignee_name, status, priority,
       start_date, due_date, report_date, completion, notes, approval_status, reject_reason,
       sort_order)
JOIN works      w  ON w.code = i.work_code
LEFT JOIN users au ON au.code = i.assignee_code
LEFT JOIN users cu ON cu.code = 'TEST001'
ON CONFLICT (code) DO UPDATE SET
  name            = EXCLUDED.name,
  description     = EXCLUDED.description,
  assignee_id     = EXCLUDED.assignee_id,
  assignee_name   = EXCLUDED.assignee_name,
  status          = EXCLUDED.status,
  priority        = EXCLUDED.priority,
  start_date      = EXCLUDED.start_date,
  due_date        = EXCLUDED.due_date,
  report_date     = EXCLUDED.report_date,
  completion      = EXCLUDED.completion,
  notes           = EXCLUDED.notes,
  approval_status = EXCLUDED.approval_status,
  reject_reason   = EXCLUDED.reject_reason,
  sort_order      = EXCLUDED.sort_order,
  updated_at      = now();

-- NHIỆM VỤ (cấp 3) — bắt buộc có cha là công việc con CÙNG công việc (trigger
-- `work_items_check_parent` chặn cả hai lỗi: cha cấp 3 và cha khác công việc).
-- Có 2 nhiệm vụ QUÁ HẠN (hạn < 24/08/2026 mà chưa Hoàn thành) để TC-STAT-03 có việc mà đếm.
INSERT INTO work_items (code, work_id, parent_id, level, name, description, assignee_id,
                        assignee_name, status, priority, start_date, due_date, report_date,
                        completion, target, output, notes, result_links, approval_status,
                        approver_id, approved_at, reject_reason, sort_order, created_by)
SELECT i.code, w.id, p.id, 3, i.name, '',
       au.id, coalesce(au.full_name, i.assignee_name), i.status, i.priority,
       i.start_date::date, i.due_date::date, i.report_date::date, i.completion,
       i.target, i.output, '', i.result_links::jsonb, i.approval_status, NULL, NULL, '',
       i.sort_order, cu.id
FROM (VALUES
  ('CV001-002', 'CV001', 'CV001-001', 'Chốt danh sách 40 học viên lớp Vũng Tàu', 'TEST008', '',
   'Hoàn thành',     'Cao',        '2026-09-01', '2026-09-05', '2026-09-04', 100,
   'Đủ 40 người, không thiếu tỉnh nào', 'Danh sách đã gửi 3 chi nhánh', '[]', 'Đã duyệt', 1),
  ('CV001-003', 'CV001', 'CV001-001', 'Thuê hội trường và chỗ ăn nghỉ', 'TEST008', '',
   'Hoàn thành',     'Trung bình', '2026-09-01', '2026-09-06', '2026-09-05', 100, '',
   'Đã ký hợp đồng', '[]', 'Đã duyệt', 2),
  ('CV001-005', 'CV001', 'CV001-004', 'Mời giảng viên cho lớp Nha Trang', 'TEST008', '',
   'Hoàn thành',     'Cao',        '2026-09-05', '2026-09-10', '2026-09-09', 100, '', '',
   '[]', 'Đã duyệt', 1),
  ('CV001-006', 'CV001', 'CV001-004', 'In 40 bộ tài liệu', 'TEST008', '',
   'Đang thực hiện', 'Trung bình', '2026-09-10', '2026-09-13', NULL,          50, '', '',
   '[]', 'Đã duyệt', 2),
  -- QUÁ HẠN và chưa có người: hai điều bất thường trên cùng một dòng, cố ý.
  ('CV001-007', 'CV001', 'CV001-004', 'Đặt vé máy bay cho giảng viên', NULL, 'Chưa phân công',
   'Chưa bắt đầu',   'Cao',        '2026-08-15', '2026-08-20', NULL,           0, '', '',
   '[]', 'Đã duyệt', 3),
  ('CV002-010', 'CV002', 'CV002-009', 'Chuyên đề tín dụng', 'TEST008', '',
   'Hoàn thành',     'Trung bình', '2026-06-01', '2026-07-10', '2026-07-09', 100, '', '',
   '[{"label": "Khung chuyên đề tín dụng", "url": "https://vidu.test/tai-lieu/tin-dung.pdf"}]',
   'Đã duyệt', 1),
  ('CV002-011', 'CV002', 'CV002-009', 'Chuyên đề kế toán', 'TEST009', '',
   'Hoàn thành',     'Trung bình', '2026-06-01', '2026-07-20', '2026-07-18', 100, '', '',
   '[]', 'Đã duyệt', 2),
  ('CV003-013', 'CV003', 'CV003-012', 'Thiết kế phiếu khảo sát', 'TEST011', '',
   'Hoàn thành',     'Cao',        '2026-07-15', '2026-07-30', '2026-07-28', 100, '', '',
   '[]', 'Đã duyệt', 1),
  ('CV003-014', 'CV003', 'CV003-012', 'Khảo sát tỉnh Nghệ An', 'TEST011', '',
   'Đang thực hiện', 'Trung bình', '2026-08-01', '2026-09-30', NULL,          30, '', '',
   '[]', 'Đã duyệt', 2),
  -- QUÁ HẠN thứ hai, ở trạng thái Tạm dừng — quá hạn không chỉ xảy ra với việc chưa bắt đầu.
  ('CV003-015', 'CV003', 'CV003-012', 'Khảo sát tỉnh Hà Tĩnh', 'TEST011', '',
   'Tạm dừng',       'Thấp',       '2026-08-01', '2026-08-15', NULL,          10, '', '',
   '[]', 'Đã duyệt', 3),
  ('CV004-018', 'CV004', 'CV004-017', 'Thu chứng từ từ phòng Đào tạo', 'TEST009', '',
   'Chưa bắt đầu',   'Trung bình', '2026-09-28', '2026-10-05', NULL,           0, '', '',
   '[]', 'Chờ duyệt', 1),
  ('CV006-022', 'CV006', 'CV006-021', 'Sinh dữ liệu test đủ chạy Phase 3', 'TEST001', '',
   'Đang thực hiện', 'Cao',        '2026-08-24', '2026-08-31', NULL,          70, '', '',
   '[]', 'Đã duyệt', 1),
  ('CV006-023', 'CV006', 'CV006-021', 'Bỏ hướng đồng bộ Google Sheets', 'TEST001', '',
   'Hoàn thành',     'Cao',        '2026-08-24', '2026-08-24', '2026-08-24', 100, '',
   'Đã xoá công cụ nhập và test của nó', '[]', 'Đã duyệt', 2),
  -- NGÀY BIÊN (§8.3): ca trực vắt từ 31/12 sang 01/01 năm sau.
  ('CV009-027', 'CV009', 'CV009-026', 'Trực ca đêm 31/12 sang 01/01', 'TEST010', '',
   'Chưa bắt đầu',   'Cao',        '2026-12-31', '2027-01-01', NULL,           0, '', '',
   '[]', 'Đã duyệt', 1),
  -- NGÀY BIÊN thứ hai: 29/02/2028 chỉ tồn tại vì 2028 là năm nhuận. Sinh ngày bằng cách cộng
  -- 365 ngày hay ghép chuỗi '29/02' cho năm bất kỳ là đổ ở đúng dòng này.
  ('CV003-028', 'CV003', 'CV003-012', 'Đối chiếu số liệu ngày 29/02/2028', 'TEST011', '',
   'Chưa bắt đầu',   'Thấp',       '2028-02-29', '2028-02-29', NULL,           0, '', '',
   '[]', 'Đã duyệt', 4),
  -- LINK KẾT QUẢ (§8.3): 4 link, trong đó link cuối SAI ĐỊNH DẠNG (thiếu giao thức http). Màn
  -- hình bấm vào link đó sẽ ra đường dẫn tương đối của chính trang web, không phải tài liệu.
  ('CV002-029', 'CV002', 'CV002-009', 'Tổng hợp tài liệu 12 chuyên đề', 'TEST008', '',
   'Hoàn thành',     'Trung bình', '2026-07-01', '2026-07-25', '2026-07-25', 100, '',
   'Đã nộp bộ tài liệu đầy đủ',
   '[{"label": "Bộ chuyên đề (bản PDF)", "url": "https://vidu.test/tai-lieu/bo-chuyen-de.pdf"},
     {"label": "Biên bản họp chốt khung", "url": "https://vidu.test/tai-lieu/bien-ban.docx"},
     {"label": "Bảng phân công giảng viên", "url": "https://vidu.test/tai-lieu/phan-cong.xlsx"},
     {"label": "Ảnh chụp bản ký (link sai định dạng)", "url": "vidu.test/thieu-giao-thuc"}]',
   'Đã duyệt', 3)
) AS i(code, work_code, parent_code, name, assignee_code, assignee_name, status, priority,
       start_date, due_date, report_date, completion, target, output, result_links,
       approval_status, sort_order)
JOIN works      w  ON w.code = i.work_code
JOIN work_items p  ON p.code = i.parent_code
LEFT JOIN users au ON au.code = i.assignee_code
LEFT JOIN users cu ON cu.code = 'TEST001'
ON CONFLICT (code) DO UPDATE SET
  name            = EXCLUDED.name,
  assignee_id     = EXCLUDED.assignee_id,
  assignee_name   = EXCLUDED.assignee_name,
  status          = EXCLUDED.status,
  priority        = EXCLUDED.priority,
  start_date      = EXCLUDED.start_date,
  due_date        = EXCLUDED.due_date,
  report_date     = EXCLUDED.report_date,
  completion      = EXCLUDED.completion,
  target          = EXCLUDED.target,
  output          = EXCLUDED.output,
  result_links    = EXCLUDED.result_links,
  approval_status = EXCLUDED.approval_status,
  sort_order      = EXCLUDED.sort_order,
  updated_at      = now();

-- NHIỆM VỤ MỒ CÔI (§8.3) — cấp 3 mà `parent_id` NULL. CSDL CHO PHÉP (chỉ cấp 2 mới bắt buộc
-- không có cha), và bản Sheets cũ có thật những dòng thế này: `Mã cha` trỏ tới công việc con đã
-- bị xoá. Phải có đúng MỘT dòng như vậy, vì:
--   * API dựng cây phải hiện nó ra chứ không được âm thầm bỏ (mất việc của người ta);
--   * tính tiến độ công việc con không được đếm nó vào cha nào cả.
-- Đứng riêng một câu INSERT vì khối cấp 3 ở trên JOIN work_items để dò cha — không JOIN được NULL.
INSERT INTO work_items (code, work_id, parent_id, level, name, description, assignee_id,
                        assignee_name, status, priority, start_date, due_date, report_date,
                        completion, target, output, notes, result_links, approval_status,
                        approver_id, approved_at, reject_reason, sort_order, created_by)
SELECT 'CV001-030', w.id, NULL, 3, 'Rà soát lại danh sách học viên đã tốt nghiệp', '',
       au.id, coalesce(au.full_name, ''), 'Chưa bắt đầu', 'Thấp',
       DATE '2026-09-20', DATE '2026-09-30', NULL, 0, '', '',
       'Mất mã công việc con cha khi chuyển từ hệ thống cũ — cố ý để mồ côi.',
       '[]'::jsonb, 'Đã duyệt', NULL, NULL, '', 9, cu.id
FROM works w
LEFT JOIN users au ON au.code = 'TEST008'
LEFT JOIN users cu ON cu.code = 'TEST001'
WHERE w.code = 'CV001'
ON CONFLICT (code) DO UPDATE SET
  parent_id  = NULL,
  notes      = EXCLUDED.notes,
  updated_at = now();

-- NHẮC VIỆC — chỉ đặt được trên nhiệm vụ cấp 3 (trigger `reminders_only_level3`).
-- Bảng không có khoá tự nhiên nên chống trùng bằng WHERE NOT EXISTS theo (nhiệm vụ, ngày).
INSERT INTO reminders (work_item_id, remind_date, content, created_by)
SELECT wi.id, r.remind_date::date, r.content, cu.id
FROM (VALUES
  ('CV001-006', '2026-09-11', 'Gọi nhà in xác nhận giao đúng hẹn'),
  ('CV001-007', '2026-08-19', 'Vé máy bay vẫn chưa đặt, sát hạn rồi'),
  ('CV003-014', '2026-09-25', 'Chốt số phiếu khảo sát Nghệ An'),
  ('CV006-022', '2026-08-26', 'Xem trước danh sách bảng cần sinh dữ liệu'),
  ('CV006-022', '2026-08-28', 'Xem lại dữ liệu mẫu trước khi bắt đầu Phase 3'),
  ('CV006-022', '2026-08-30', 'Nhắc lần hai — cùng một nhiệm vụ có nhiều nhắc việc'),
  -- NỘI DUNG RỖNG (§8.3): người dùng bấm đặt nhắc rồi không gõ gì. Màn hình phải hiện tên nhiệm
  -- vụ thay cho nội dung, không được hiện dòng trắng.
  ('CV009-027', '2026-12-30', '')
) AS r(item_code, remind_date, content)
JOIN work_items wi ON wi.code = r.item_code
LEFT JOIN users cu ON cu.code = 'TEST001'
WHERE NOT EXISTS (
  SELECT 1 FROM reminders x
   WHERE x.work_item_id = wi.id AND x.remind_date = r.remind_date::date
);

-- ĐỀ NGHỊ — đủ 2 loại và đủ 4 trạng thái, có dòng KHÔNG gắn công việc nào (work_id NULL).
INSERT INTO proposals (code, type, work_id, work_item_id, content, url, supplier,
                       creator_id, creator_name, proposal_date, status, review_note)
SELECT p.code, p.type, w.id, wi.id, p.content, p.url, p.supplier,
       cu.id, coalesce(cu.full_name, ''), p.proposal_date::date, p.status, p.review_note
FROM (VALUES
  ('DN001', 'Trong kế hoạch',  'CV001', 'CV001-003',
   'Thuê hội trường và chỗ ăn nghỉ cho 3 lớp', 'https://vidu.test/de-nghi/dn001',
   'Nhà cung cấp Mẫu', 'TEST007', '2026-08-18', 'Đã duyệt', 'Giá trong định mức, đồng ý.'),
  ('DN002', 'Ngoài kế hoạch', 'CV001', 'CV001-007',
   'Mua gấp 2 vé máy bay cho giảng viên', '', 'Nhà cung cấp Mẫu',
   'TEST008', '2026-08-21', 'Chờ duyệt', ''),
  ('DN003', 'Trong kế hoạch',  'CV003', NULL,
   'In 300 phiếu khảo sát', '', 'Nhà cung cấp Mẫu',
   'TEST011', '2026-07-20', 'Đã duyệt', 'Đã có trong dự toán đề tài.'),
  ('DN004', 'Ngoài kế hoạch', 'CV005', NULL,
   'Thuê tư vấn ngoài rà soát hồ sơ nhân sự', '', '',
   'TEST001', '2026-08-12', 'Từ chối', 'Chưa có kinh phí, để sang năm sau.'),
  -- Không gắn công việc: đề nghị mua sắm chung của phòng.
  ('DN005', 'Trong kế hoạch',  NULL, NULL,
   'Mua 2 máy in cho phòng Kế toán', '', 'Nhà cung cấp Mẫu',
   'TEST006', '2026-08-22', 'Đề xuất mới', '')
) AS p(code, type, work_code, item_code, content, url, supplier, creator_code,
       proposal_date, status, review_note)
LEFT JOIN works      w  ON w.code  = p.work_code
LEFT JOIN work_items wi ON wi.code = p.item_code
LEFT JOIN users      cu ON cu.code = p.creator_code
ON CONFLICT (code) DO UPDATE SET
  type          = EXCLUDED.type,
  work_id       = EXCLUDED.work_id,
  work_item_id  = EXCLUDED.work_item_id,
  content       = EXCLUDED.content,
  url           = EXCLUDED.url,
  supplier      = EXCLUDED.supplier,
  creator_id    = EXCLUDED.creator_id,
  creator_name  = EXCLUDED.creator_name,
  proposal_date = EXCLUDED.proposal_date,
  status        = EXCLUDED.status,
  review_note   = EXCLUDED.review_note,
  updated_at    = now();

-- QUẢN LÝ APP — `allowed_roles` là text[]; mảng RỖNG nghĩa là ai cũng thấy.
-- Tên vai trò trong mảng phải trùng đúng chữ với CHECK `users_role_valid`, nếu không thì lọc
-- theo vai trò sẽ ra rỗng mà chẳng báo lỗi gì.
INSERT INTO apps (code, name, url, icon_url, description, category, allowed_roles, created_by)
SELECT a.code, a.name, a.url, a.icon_url, a.description, a.category,
       a.allowed_roles::text[], cu.id
FROM (VALUES
  ('APP001', 'Cổng thông tin nội bộ', 'https://vidu.test/portal', '',
   'Tin nội bộ, văn bản, biểu mẫu.', 'Nội bộ', '{}'),
  ('APP002', 'Báo cáo tín dụng',      'https://vidu.test/bao-cao', '',
   'Chỉ lãnh đạo xem được.', 'Báo cáo',
   '{"admin","Phó Giám đốc","Trưởng phòng"}'),
  ('APP003', 'Phần mềm kế toán',      'https://vidu.test/ke-toan', '',
   '', 'Nghiệp vụ', '{"admin","Trưởng phòng"}'),
  ('APP004', 'Thư viện tài liệu đào tạo', 'https://vidu.test/thu-vien', '',
   'Ai cũng vào được.', 'Đào tạo', '{}')
) AS a(code, name, url, icon_url, description, category, allowed_roles)
LEFT JOIN users cu ON cu.code = 'TEST001'
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  url           = EXCLUDED.url,
  icon_url      = EXCLUDED.icon_url,
  description   = EXCLUDED.description,
  category      = EXCLUDED.category,
  allowed_roles = EXCLUDED.allowed_roles,
  updated_at    = now();

-- CHAT — không có khoá tự nhiên, chống trùng theo nội dung.
-- `created_at` đặt tay để danh sách có thứ tự thời gian thật, không dồn hết vào lúc seed. 12 tin
-- trải nhiều ngày để phân trang và mốc "tin mới từ lần xem trước" có gì mà cắt.
INSERT INTO chat_messages (user_id, user_name, message, created_at)
SELECT u.id, coalesce(u.full_name, c.user_name), c.message, c.created_at::timestamptz
FROM (VALUES
  ('TEST004', '', 'Cả nhóm nhớ chốt danh sách học viên trước 05/9 nhé.',
   '2026-09-01 01:15+00'),
  ('TEST008', '', 'Vâng em đang gọi từng chi nhánh, chiều nay xong ạ.',
   '2026-09-01 02:40+00'),
  ('TEST005', '', 'Hội trường Vũng Tàu đã đặt, còn chỗ ăn nghỉ thì mai có báo giá.',
   '2026-09-01 08:05+00'),
  ('TEST008', '', 'Danh sách lớp Vũng Tàu xong rồi ạ, đủ 40 người.',
   '2026-09-04 07:40+00'),
  ('TEST004', '', 'Tốt. Gửi luôn cho ba chi nhánh để họ xác nhận lại.',
   '2026-09-04 08:00+00'),
  ('TEST007', '', 'Vé máy bay cho giảng viên vẫn chưa đặt được, đang chờ báo giá.',
   '2026-08-21 02:05+00'),
  ('TEST004', '', 'Sát hạn rồi, mai không có báo giá thì mua vé lẻ trước đi.',
   '2026-08-21 03:30+00'),
  ('TEST001', '', 'Hệ thống mới đã có dữ liệu mẫu, mọi người thử đăng nhập giúp.',
   '2026-08-24 09:30+00'),
  ('TEST006', '', 'Em đăng nhập được, nó bắt đổi mật khẩu ngay lần đầu.',
   '2026-08-24 10:05+00'),
  ('TEST011', '', 'Khảo sát Hà Tĩnh phải tạm dừng, chờ công văn của tỉnh.',
   '2026-08-16 01:20+00'),
  ('TEST003', '', 'Ghi rõ lý do tạm dừng vào nhiệm vụ để lúc tổng kết còn biết.',
   '2026-08-16 04:45+00'),
  -- Người gửi không dò ra: `user_id` NULL nhưng vẫn còn tên để hiển thị.
  (NULL, 'Người cũ đã nghỉ', 'Tin nhắn từ tài khoản không còn trong hệ thống.',
   '2026-07-15 03:00+00')
) AS c(user_code, user_name, message, created_at)
LEFT JOIN users u ON u.code = c.user_code
WHERE NOT EXISTS (
  SELECT 1 FROM chat_messages x WHERE x.message = c.message
);

-- THÔNG BÁO — `user_id` NOT NULL: thông báo luôn thuộc về một người cụ thể.
INSERT INTO notifications (user_id, content, type, is_read, ref_type, ref_id, created_at)
SELECT u.id, n.content, n.type, n.is_read, n.ref_type,
       CASE n.ref_type WHEN 'work' THEN w.id WHEN 'work_item' THEN wi.id
                       WHEN 'proposal' THEN p.id ELSE NULL END,
       n.created_at::timestamptz
FROM (VALUES
  ('TEST007', 'Công việc CV001 đã được duyệt.', 'success', true,
   'work',      'CV001',     NULL,        NULL,   '2026-08-20 02:00+00'),
  ('TEST008', 'Nhiệm vụ "Đặt vé máy bay cho giảng viên" đã quá hạn.', 'warning', false,
   'work_item', NULL,        'CV001-007', NULL,   '2026-08-21 00:30+00'),
  ('TEST007', 'Đề nghị DN002 đang chờ duyệt.', 'info', false,
   'proposal',  NULL,        NULL,        'DN002', '2026-08-21 02:10+00'),
  ('TEST009', 'Công việc CV007 bị từ chối: trùng nội dung với CV002.', 'error', false,
   'work',      'CV007',     NULL,        NULL,   '2026-09-02 07:20+00'),
  ('TEST011', 'Bạn được phân công nhiệm vụ "Khảo sát tỉnh Nghệ An".', 'info', true,
   'work_item', NULL,        'CV003-014', NULL,   '2026-08-01 01:00+00'),
  -- Thông báo chung, không trỏ tới bản ghi nào: ref_type rỗng, ref_id NULL.
  ('TEST001', 'Hệ thống sẽ bảo trì 22:00 hôm nay.', 'info', false,
   '',          NULL,        NULL,        NULL,   '2026-08-24 09:00+00')
) AS n(user_code, content, type, is_read, ref_type, work_code, item_code, proposal_code,
       created_at)
JOIN users           u  ON u.code  = n.user_code
LEFT JOIN works      w  ON w.code  = n.work_code
LEFT JOIN work_items wi ON wi.code = n.item_code
LEFT JOIN proposals  p  ON p.code  = n.proposal_code
WHERE NOT EXISTS (
  SELECT 1 FROM notifications x WHERE x.user_id = u.id AND x.content = n.content
);

-- NHẬT KÝ — `action` viết dạng `<nhóm>.<việc>` đúng như middleware/audit.js sinh ra, để màn
-- hình quản trị đọc dữ liệu mẫu và dữ liệu thật bằng cùng một cách.
INSERT INTO activity_logs (actor_id, actor_name, action, entity_type, entity_id, work_id,
                           details, ip, created_at)
SELECT u.id, coalesce(u.full_name, ''), l.action, l.entity_type,
       CASE l.entity_type WHEN 'work' THEN w.id WHEN 'work_item' THEN wi.id
                          WHEN 'proposal' THEN p.id ELSE NULL END,
       w.id, l.details::jsonb, l.ip::inet, l.created_at::timestamptz
FROM (VALUES
  ('TEST004', 'work.create',     'work',      'CV001', '{"name": "Tổ chức 03 lớp đào tạo cán bộ tín dụng"}',
   '10.0.0.11', '2026-08-18 01:00+00'),
  ('TEST002', 'work.approve',    'work',      'CV001', '{"tu": "Chờ duyệt", "sang": "Đã duyệt"}',
   '10.0.0.12', '2026-08-20 02:00+00'),
  ('TEST008', 'workItem.update', 'work_item', 'CV001-002', '{"completion": {"tu": 60, "sang": 100}}',
   '10.0.0.18', '2026-09-04 07:35+00'),
  ('TEST008', 'workItem.complete', 'work_item', 'CV001-003', '{}',
   '10.0.0.18', '2026-09-05 08:10+00'),
  ('TEST007', 'proposal.create', 'proposal',  'DN002', '{"loai": "Ngoài kế hoạch"}',
   '10.0.0.17', '2026-08-21 02:00+00'),
  ('TEST003', 'work.reject',     'work',      'CV007', '{"ly_do": "Trùng nội dung với CV002"}',
   '10.0.0.13', '2026-09-02 07:20+00'),
  ('TEST001', 'auth.login',      'user',      NULL, '{}',
   '10.0.0.10', '2026-08-24 09:00+00'),
  ('TEST001', 'auth.logout',     'user',      NULL, '{}',
   '10.0.0.10', '2026-08-24 11:30+00'),
  -- Đăng nhập sai: nhật ký KHÔNG được ghi mật khẩu đã nhập, chỉ ghi email và số lần sai.
  ('TEST006', 'auth.loginFailed', 'user',     NULL, '{"email": "tp03@test.local", "lan_sai": 2}',
   '10.0.0.16', '2026-08-24 09:58+00'),
  ('TEST001', 'user.create',     'user',      NULL, '{"code": "TEST013", "vai_tro": "Nhân viên"}',
   '10.0.0.10', '2026-08-23 02:00+00'),
  ('TEST001', 'user.update',     'user',      NULL, '{"dept_role": {"tu": "", "sang": "Nhân viên"}}',
   '10.0.0.10', '2026-08-23 02:05+00'),
  ('TEST001', 'department.create', 'department', NULL, '{"code": "PH05"}',
   '10.0.0.10', '2026-08-23 01:40+00'),
  ('TEST004', 'work.update',     'work',      'CV002', '{"status": {"tu": "Đang thực hiện", "sang": "Hoàn thành"}}',
   '10.0.0.11', '2026-07-31 09:00+00'),
  ('TEST011', 'workItem.create', 'work_item', 'CV003-015', '{"level": 3, "parent": "CV003-012"}',
   '10.0.0.19', '2026-08-01 00:30+00'),
  ('TEST002', 'workItem.approve', 'work_item', 'CV001-001', '{}',
   '10.0.0.12', '2026-08-20 02:01+00'),
  ('TEST002', 'proposal.approve', 'proposal', 'DN001', '{"ghi_chu": "Giá trong định mức"}',
   '10.0.0.12', '2026-08-19 03:00+00'),
  ('TEST003', 'proposal.reject', 'proposal',  'DN004', '{"ly_do": "Chưa có kinh phí"}',
   '10.0.0.13', '2026-08-13 01:15+00'),
  ('TEST001', 'app.create',      'app',       NULL, '{"code": "APP004"}',
   '10.0.0.10', '2026-08-22 06:20+00'),
  -- Xoá là việc không lấy lại được: nhật ký giữ luôn tên đã xoá, vì bản ghi thì không còn nữa.
  ('TEST001', 'work.delete',     'work',      NULL, '{"code": "CV000", "name": "Công việc nhập thử rồi bỏ"}',
   '10.0.0.10', '2026-08-22 07:45+00'),
  -- Chủ thể không dò ra (tài khoản đã xoá): actor_id NULL nhưng tên còn để đối chiếu.
  (NULL,      'auth.login',      'user',      NULL, '{"ghi_chu": "tài khoản đã xoá"}',
   '10.0.0.99', '2026-07-01 00:00+00')
) AS l(actor_code, action, entity_type, ref_code, details, ip, created_at)
LEFT JOIN users      u  ON u.code  = l.actor_code
LEFT JOIN works      w  ON w.code  = l.ref_code
LEFT JOIN work_items wi ON wi.code = l.ref_code
LEFT JOIN proposals  p  ON p.code  = l.ref_code
WHERE NOT EXISTS (
  SELECT 1 FROM activity_logs x
   WHERE x.action = l.action AND x.created_at = l.created_at::timestamptz
);

-- =====================================================================================
-- ĐẨY SEQUENCE SINH MÃ VƯỢT QUA DỮ LIỆU MẪU
-- =====================================================================================
-- Dữ liệu mẫu dùng mã ĐẶT TAY (CV001, DN005, APP004...) nên `next_code()` vẫn đang ở 1.
-- Không đẩy sequence thì API Phase 3 tạo công việc đầu tiên sẽ sinh ra 'CV001' và đổ vì
-- trùng UNIQUE — lỗi chỉ hiện khi bấm tạo mới, nên phải có test riêng: TC-SEED-22/23 gọi
-- `next_code()` sau khi seed và đòi đúng CV010 / CV031 / DN006 / APP005 / NV014 / PH06.
--
-- Dùng GREATEST chứ không setval thẳng: seed chạy lại sau khi Phase 3 đã tạo CV010, CV011 thì
-- setval(9) sẽ KÉO LÙI sequence và mã mới lại trùng lần nữa.
SELECT setval('seq_department_code', GREATEST((SELECT last_value FROM seq_department_code),  5)),
       setval('seq_user_code',       GREATEST((SELECT last_value FROM seq_user_code),       13)),
       setval('seq_work_code',       GREATEST((SELECT last_value FROM seq_work_code),        9)),
       setval('seq_work_item_code',  GREATEST((SELECT last_value FROM seq_work_item_code),  30)),
       setval('seq_proposal_code',   GREATEST((SELECT last_value FROM seq_proposal_code),    5)),
       setval('seq_app_code',        GREATEST((SELECT last_value FROM seq_app_code),         4));

COMMIT;
