-- 018_ty_le_tien_do.sql — TỶ LỆ CÔNG VIỆC + TIẾN ĐỘ ĐO BẰNG FILE KẾT QUẢ (8b lỗi 2, 2026-09-06).
--
-- Người dùng chốt: tiến độ KHÔNG còn là con số nhập tay. Xoá mọi ô nhập tiến độ; tiến độ của một
-- công việc tính bằng MỨC HOÀN THÀNH CÁC FILE KẾT QUẢ của nó. Thay vào đó mỗi PHÂN CÔNG (việc con
-- cấp 2) và mỗi NHIỆM VỤ ĐỘC LẬP (cấp 3 không nằm trong việc con nào — parent_id NULL) mang thêm
-- một TỶ LỆ CÔNG VIỆC (phần trăm đóng góp vào tiến độ chung của công việc cấp 1):
--
--   * Mặc định chia đều giữa các mục cùng một công việc (mỗi mục 100/n).
--   * Trưởng phòng / Phó phòng / Phó Giám đốc / admin sửa được tỷ lệ (hành động 'ty-le' trong ma
--     trận rbac.js — phạm vi «phụ trách» của inScope() vẫn xét như mọi hành động khác).
--   * Thêm mục mới ⇒ nhận phần đều 100/n, các mục cũ co lại theo đúng tỷ lệ đang có (giữ chỉnh
--     tay); xoá mục ⇒ phần của nó chia lại cho các mục còn lại cũng theo tỷ lệ; sửa tay một ô ⇒
--     các ô còn lại co/giãn về đúng 100 − giá trị mới. Mọi phép chia làm tròn số nguyên sao cho
--     tổng ĐÚNG 100 (phần dư dồn cho các mục đầu theo số dư lớn nhất — luật trong tyLe.js).
--
-- Cột `ty_le` chỉ có nghĩa trên HAI dạng dòng: cấp 2, và cấp 3 có parent_id NULL. Các dòng khác
-- (cấp 3 nằm trong việc con) bắt buộc 0 — rào CHECK `work_items_ty_le_doi_tuong` canh ở CSDL để một
-- lỗi mã đổi cha/mẹ mà quên cân lại tỷ lệ thì NỔ ngay tại chỗ ghi chứ không lặng lẽ lệch số.
-- (Service cân lại trong cùng giao dịch với câu đổi cha/mẹ nên CHECK không cản đường đúng.)
--
-- Cột ở đây là SỐ NGUYÊN 0..100 vì luật người dùng là «tổng đúng 100» — số nguyên thì tổng hiển
-- thị luôn khớp, không có cảnh 99,97%. Phần dư của phép chia đều do tyLe.js quyết, CSDL chỉ giữ
-- kết quả cuối.
--
-- Cùng migration này nới `po_action_ok` thêm 'ty-le' để Bảng phân quyền hệ thống bật/tắt được
-- quyền sửa tỷ lệ như mọi ô khác (khuôn DROP + ADD của 014:107-110). KHÔNG nới `po_cho_duyet`:
-- sửa tỷ lệ là chỉnh một con số tính toán, không sinh dòng mới cần duyệt — đặt «Chờ duyệt» cho nó
-- vô nghĩa (permissions/service.js cũng chặn cùng luật).
--
-- Không đụng `completion`: cột cũ GIỮ NGUYÊN cho luồng ghi của cầu RPC cũ (rpc-bridge) và dữ liệu
-- lịch sử; chỉ ĐƯỜNG HIỂN THỊ đổi sang tiến độ tính từ file (service gắn `tien_do` lên dòng trước
-- khi trả về). Không xoá cột ở đây vì §13.1 cấm phá dữ liệu đang chạy.
--
-- Điền sẵn dữ liệu cũ: mỗi công việc hiện có chia đều 100 giữa các mục thuộc diện, làm tròn
-- số nguyên theo cùng luật tyLe.js — mục đầu gánh phần dư:
--   n = số mục thuộc diện của công việc; base = 100/n (chia nguyên); dư = 100 − base*n;
--   `dư` mục đầu tiên (thứ tự level, sort_order, id) nhận base+1, còn lại nhận base.
--   (n > 100 thì base = 0, đúng 100 mục nhận 1, còn lại 0 — CHECK vẫn thoả.)

-- Up Migration

ALTER TABLE work_items ADD COLUMN ty_le smallint NOT NULL DEFAULT 0;

ALTER TABLE work_items
  ADD CONSTRAINT work_items_ty_le_ok CHECK (ty_le BETWEEN 0 AND 100);

ALTER TABLE work_items
  ADD CONSTRAINT work_items_ty_le_doi_tuong CHECK (
    ty_le = 0 OR level = 2 OR (level = 3 AND parent_id IS NULL)
  );

UPDATE work_items wi
   SET ty_le = chia.ty_le_moi
  FROM (
    SELECT id,
           CASE
             WHEN ROW_NUMBER() OVER w <= 100 - (100 / COUNT(*) OVER w) * COUNT(*) OVER w
               THEN (100 / COUNT(*) OVER w) + 1
             ELSE 100 / COUNT(*) OVER w
           END AS ty_le_moi
      FROM work_items
     WHERE level = 2 OR (level = 3 AND parent_id IS NULL)
    WINDOW w AS (PARTITION BY work_id ORDER BY level, sort_order, id)
  ) chia
 WHERE wi.id = chia.id;

-- Dựng lại hai view đếm được — BẮT BUỘC dù điều kiện lọc không đổi một chữ nào. Postgres đóng băng
-- danh sách cột của view ngay lúc tạo (bẫy đã ghi ở 013): không DROP + CREATE lại thì cột `ty_le`
-- vô hình với mọi truy vấn thống kê/Gantt uống `v_countable_*`. Định nghĩa chép ĐÚNG bản 013.
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

ALTER TABLE permission_overrides
  DROP CONSTRAINT IF EXISTS po_action_ok;
ALTER TABLE permission_overrides
  ADD CONSTRAINT po_action_ok CHECK (
    action IN ('read', 'create', 'update', 'delete', 'approve', 'ty-le')
  );

-- Down Migration

-- XOÁ dòng ghi đè 'ty-le' TRƯỚC khi siết lại CHECK — khuôn và bẫy đã ghi ở 014:124-126.
DELETE FROM permission_overrides WHERE action = 'ty-le';

ALTER TABLE permission_overrides
  DROP CONSTRAINT IF EXISTS po_action_ok;
ALTER TABLE permission_overrides
  ADD CONSTRAINT po_action_ok CHECK (
    action IN ('read', 'create', 'update', 'delete', 'approve')
  );

-- Hai view đang tham chiếu `ty_le` (đóng băng từ lúc Up) ⇒ phải DROP TRƯỚC khi bỏ cột, không thì
-- DROP COLUMN nổ «cannot drop because other objects depend on it» (cùng bẫy đã ghi ở 013).
DROP VIEW IF EXISTS v_countable_items;
DROP VIEW IF EXISTS v_countable_works;

ALTER TABLE work_items DROP CONSTRAINT IF EXISTS work_items_ty_le_doi_tuong;
ALTER TABLE work_items DROP CONSTRAINT IF EXISTS work_items_ty_le_ok;
ALTER TABLE work_items DROP COLUMN ty_le;

-- Dựng lại view theo bộ cột cũ (không còn `ty_le`) — định nghĩa chép ĐÚNG bản 013.
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
