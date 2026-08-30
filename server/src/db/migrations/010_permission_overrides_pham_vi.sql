-- 010_permission_overrides_pham_vi.sql — thêm ĐIỀU KIỆN PHẠM VI cho ghi đè (Vòng 10, 2026-08-29).
--
-- Riêng Phó Giám đốc / Trưởng phòng / Phó phòng, mỗi ô của Bảng phân quyền chọn được:
--   'phong'  (mặc định) — phạm vi như luật gốc: phòng phụ trách / phòng mình
--   'tat-ca'            — áp dụng cho TẤT CẢ các phòng (nới phạm vi dữ liệu)
-- `can()` đọc `pham_vi` và bỏ qua `inScope()` khi là 'tat-ca' (chỉ cho work/subwork/task).

-- Up Migration

ALTER TABLE permission_overrides
  ADD COLUMN pham_vi text NOT NULL DEFAULT 'phong';

ALTER TABLE permission_overrides
  DROP CONSTRAINT IF EXISTS po_pham_vi_ok;

ALTER TABLE permission_overrides
  ADD CONSTRAINT po_pham_vi_ok CHECK (pham_vi IN ('phong', 'tat-ca'));

-- Down Migration

ALTER TABLE permission_overrides DROP CONSTRAINT IF EXISTS po_pham_vi_ok;
ALTER TABLE permission_overrides DROP COLUMN IF EXISTS pham_vi;
