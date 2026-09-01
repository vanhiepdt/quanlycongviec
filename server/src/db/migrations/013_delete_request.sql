-- 013_delete_request.sql — LUỒNG YÊU CẦU XOÁ (Vòng 13 đợt 2, yêu cầu người dùng 2026-08-31).
--
-- Yêu cầu: «thêm phần Chờ duyệt cho cán bộ đối với Xoá Công việc (cấp 1), Xoá Công việc (cấp 2),
-- nhiệm vụ (cấp 3)». Trước migration này, ghi đè `delete = 'cho-duyet'` (011) chỉ có nghĩa CHẶN
-- xoá kèm câu «liên hệ Phó Giám đốc phụ trách để xoá giúp» — cán bộ không có đường nào tự xin xoá.
--
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- Vì sao BA CỘT RIÊNG mà không phải một giá trị mới của `approval_status`
--
-- Mục đang xin xoá có thể đang ở BẤT KỲ trạng thái duyệt nào: 'Đã duyệt' (việc đang chạy),
-- 'Chờ duyệt' (vừa gửi duyệt xong lại muốn rút), 'Nháp' (soạn dở rồi bỏ). Nhồi «Chờ duyệt xoá»
-- vào `approval_status` là XOÁ MẤT trạng thái cũ ⇒ khi người duyệt TỪ CHỐI yêu cầu xoá thì không
-- còn gì để biết phải trả dòng về đâu, và hai view `v_countable_*` lại phải sửa lần nữa.
--
-- Ba cột riêng làm «xin xoá» thành một chiều ĐỘC LẬP với luồng duyệt nội dung:
--   xin xoá     ⇒ ghi 3 cột, `approval_status` KHÔNG đổi
--   từ chối xoá ⇒ xoá 3 cột, `approval_status` KHÔNG đổi
--   duyệt xoá   ⇒ xoá dòng thật (CASCADE lo con cháu)
--
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- HAI VIEW `v_countable_*` CỐ Ý KHÔNG ĐỔI
--
-- Người dùng chốt: mục đang chờ duyệt xoá **vẫn hiện bình thường và vẫn vào thống kê**, chỉ thêm
-- nhãn đỏ «Đang xin xoá». Lý lẽ: chưa ai đồng ý cả, việc vẫn phải làm — và nếu ẩn ngay thì số
-- liệu nhảy xuống rồi nhảy lại khi yêu cầu bị từ chối, tệ hơn nữa là cán bộ có thể «tự ẩn» việc
-- của mình bằng cách xin xoá.
--
-- Điều này NGƯỢC với bẫy §13.5 vừa thêm ở 012 («thêm giá trị mới cho approval_status mà không nới
-- view»). Không mâu thuẫn: 012 thêm một TRẠNG THÁI DUYỆT (chưa qua cửa duyệt thì không được đếm),
-- 013 thêm một YÊU CẦU nằm ngoài trục đó. Ghi rõ ở đây để lần sau không ai «sửa cho nhất quán».

-- Up Migration

ALTER TABLE works
  ADD COLUMN xoa_yeu_cau_boi bigint REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN xoa_yeu_cau_luc timestamptz,
  ADD COLUMN xoa_ly_do       text NOT NULL DEFAULT '';

ALTER TABLE work_items
  ADD COLUMN xoa_yeu_cau_boi bigint REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN xoa_yeu_cau_luc timestamptz,
  ADD COLUMN xoa_ly_do       text NOT NULL DEFAULT '';

COMMENT ON COLUMN works.xoa_yeu_cau_boi IS
  'Người xin xoá (013). NULL = không có yêu cầu xoá nào đang treo. Xin xoá một công việc cấp 1 là xin xoá CẢ CÂY bên dưới.';
COMMENT ON COLUMN work_items.xoa_yeu_cau_boi IS
  'Người xin xoá (013). NULL = không có yêu cầu xoá nào đang treo.';

-- Chỉ mục MỘT PHẦN: hộp chờ duyệt quét cột này mỗi lần mở, mà số dòng đang xin xoá luôn ít hơn
-- hẳn số dòng bình thường — cùng cách đã dùng cho `idx_work_items_pending` ở 004/012.
CREATE INDEX idx_works_xoa_cho_duyet ON works (department_id)
  WHERE xoa_yeu_cau_boi IS NOT NULL;
CREATE INDEX idx_work_items_xoa_cho_duyet ON work_items (department_id)
  WHERE xoa_yeu_cau_boi IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────────────────────
-- DỰNG LẠI HAI VIEW — bắt buộc, dù ĐIỀU KIỆN LỌC của chúng không đổi một chữ nào.
--
-- Cả hai view viết `SELECT *` / `SELECT i.*`, và Postgres mở rộng dấu `*` NGAY LÚC TẠO VIEW rồi
-- đóng băng danh sách cột. Thêm cột vào bảng gốc thì view vẫn trả bộ cột CŨ — không lỗi, không
-- cảnh báo, chỉ là ba cột mới vô hình với mọi truy vấn thống kê. `countable-views.test.js` có ca
-- so danh sách cột của view với bảng gốc chính vì chuyện này.
--
-- `CREATE OR REPLACE VIEW` KHÔNG làm được (không đổi được danh sách cột) ⇒ phải DROP rồi CREATE.
-- Điều kiện lọc chép đúng bản 012, không sửa gì: mục đang xin xoá VẪN được đếm.
DROP VIEW IF EXISTS v_countable_items;
DROP VIEW IF EXISTS v_countable_works;

CREATE VIEW v_countable_works AS
  SELECT * FROM works
   WHERE approval_status NOT IN ('Chờ duyệt','Nháp');

CREATE VIEW v_countable_items AS
  SELECT i.*
    FROM work_items i
    JOIN works w  ON w.id = i.work_id
    LEFT JOIN work_items p ON p.id = i.parent_id
   WHERE i.approval_status NOT IN ('Chờ duyệt','Nháp')
     AND w.approval_status NOT IN ('Chờ duyệt','Nháp')
     AND (p.id IS NULL OR p.approval_status NOT IN ('Chờ duyệt','Nháp'));

COMMENT ON VIEW v_countable_works IS
  'Công việc cấp 1 được phép vào thống kê: bỏ mục Chờ duyệt và bản Nháp (§7 việc 5.4, 012). Mục đang xin xoá VẪN được đếm (013).';
COMMENT ON VIEW v_countable_items IS
  'Công việc con / nhiệm vụ được phép vào thống kê: bỏ mục Chờ duyệt/Nháp và mọi dòng nằm dưới một mục Chờ duyệt/Nháp. Mục đang xin xoá VẪN được đếm (013).';

-- Down Migration

-- Dựng lại view theo bộ cột CŨ (chưa có 3 cột xin xoá) — phải làm TRƯỚC khi DROP COLUMN, nếu
-- không thì view đang tham chiếu cột sắp bị bỏ và câu DROP COLUMN nổ «cannot drop because other
-- objects depend on it». Cùng bẫy đã ghi trong 005_phan_cong.sql.
DROP VIEW IF EXISTS v_countable_items;
DROP VIEW IF EXISTS v_countable_works;

-- Mất dữ liệu yêu cầu xoá là ĐÚNG: nó là trạng thái tạm của một quy trình, không phải dữ liệu
-- nghiệp vụ. Dòng công việc/nhiệm vụ vẫn còn nguyên — chỉ những yêu cầu đang treo biến mất, và
-- người xin phải xin lại.
DROP INDEX IF EXISTS idx_work_items_xoa_cho_duyet;
DROP INDEX IF EXISTS idx_works_xoa_cho_duyet;

ALTER TABLE work_items
  DROP COLUMN IF EXISTS xoa_ly_do,
  DROP COLUMN IF EXISTS xoa_yeu_cau_luc,
  DROP COLUMN IF EXISTS xoa_yeu_cau_boi;

ALTER TABLE works
  DROP COLUMN IF EXISTS xoa_ly_do,
  DROP COLUMN IF EXISTS xoa_yeu_cau_luc,
  DROP COLUMN IF EXISTS xoa_yeu_cau_boi;

CREATE VIEW v_countable_works AS
  SELECT * FROM works
   WHERE approval_status NOT IN ('Chờ duyệt','Nháp');

CREATE VIEW v_countable_items AS
  SELECT i.*
    FROM work_items i
    JOIN works w  ON w.id = i.work_id
    LEFT JOIN work_items p ON p.id = i.parent_id
   WHERE i.approval_status NOT IN ('Chờ duyệt','Nháp')
     AND w.approval_status NOT IN ('Chờ duyệt','Nháp')
     AND (p.id IS NULL OR p.approval_status NOT IN ('Chờ duyệt','Nháp'));
