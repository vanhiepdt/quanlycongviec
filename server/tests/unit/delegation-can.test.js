// TC-UQ-07..12 — lớp MƯỢN quyền của `can()` (ủy quyền có thời hạn, 006_delegations.sql).
//
// Chỗ này test bằng hàm thuần, KHÔNG dựng máy chủ: `can()` không đọc CSDL, các bản ghi đang hiệu
// lực do `attachSession` nạp sẵn vào `user.delegations`. Nhờ vậy ba câu hỏi khó nhất của tính năng
// (trước / trong / sau khoảng ngày) test được mà không phải chờ tới ngày đó — điều kiện ngày là
// việc của SQL (`current_date BETWEEN …`), và nó được canh riêng ở delegations-api.test.js.
//
// Bốn luật gốc mà file này canh:
//   L2 vai admin không cho mượn được, kể cả khi CSDL có dòng như vậy
//   L3 phạm vi mượn không rộng hơn phạm vi người ủy quyền
//   L4 chỉ work/subwork/task mượn được — `user`/`department` thì không
//   + quyền TỰ CÓ luôn được xét trước, nên tính năng này không bao giờ làm mất quyền của ai
import { describe, expect, it } from 'vitest';
import { can } from '../../src/middleware/rbac.js';
import { OTHER_DEPT, OWN_DEPT, principal } from '../helpers/rbac.js';

/** Nhân viên phòng OWN_DEPT — người MƯỢN quyền trong mọi trường hợp dưới đây. */
const nguoiMuon = (delegations = [], over = {}) =>
  principal('Nhân viên', { id: 300, delegations, ...over });

/** Bản ủy quyền ĐANG hiệu lực do `attachSession` nạp (đã lọc ngày + trạng thái ở SQL). */
const uyQuyen = (over = {}) => ({
  id: 77,
  fromUserId: 200,
  fromUserName: 'Phạm Phó Giám Đốc',
  fromRole: 'Phó Giám đốc',
  toDate: '2026-09-07',
  departmentIds: [OWN_DEPT],
  ...over,
});

const dongCV = (over = {}) => ({
  id: 50,
  level: null,
  department_id: OWN_DEPT,
  manager_id: 999,
  assignee_id: 998,
  ...over,
});

describe('TC-UQ-07..09: hiệu lực theo khoảng ngày — nạp gì thì mượn được cái đó', () => {
  // TC-UQ-07 (trước khoảng ngày) và TC-UQ-09 (sau khoảng ngày) cùng một hình dạng ở tầng này:
  // `listEffectiveFor` không trả bản ghi nào ⇒ `user.delegations` rỗng ⇒ không mượn được gì.
  // Đây chính là lý do không cần cron đánh dấu «hết hạn»: hết ngày là bản ghi tự rơi khỏi câu SQL.
  it('TC-UQ-07/09: chưa tới hoặc đã qua khoảng ngày ⇒ không có gì để mượn', () => {
    for (const delegations of [[], undefined]) {
      const v = can(nguoiMuon(delegations), 'update', 'work', dongCV());
      expect(v.ok).toBe(false);
      expect(v.code).toBe('FORBIDDEN');
      expect(v.viaDelegationId).toBeUndefined();
    }
  });

  it('TC-UQ-08: trong khoảng ngày ⇒ mượn được, và trả đúng id bản ủy quyền', () => {
    const v = can(nguoiMuon([uyQuyen()]), 'update', 'work', dongCV());
    expect(v.ok).toBe(true);
    expect(v.viaDelegationId).toBe(77);
  });

  it('TC-UQ-08b: mượn được cả 5 hành động của vai người ủy quyền, kể cả `approve`', () => {
    for (const action of ['read', 'create', 'update', 'delete', 'approve']) {
      const v = can(nguoiMuon([uyQuyen()]), action, 'work', dongCV());
      expect(v.ok, `hành động ${action}`).toBe(true);
      // `read` lọt bằng quyền TỰ CÓ (Nhân viên đọc được công việc phòng mình) nên không có
      // `viaDelegationId` — đúng thứ tự "tự có trước, mượn sau". Bốn hành động còn lại thì
      // Nhân viên không có, phải nhờ bản ủy quyền.
      expect(v.viaDelegationId, `hành động ${action}`).toBe(action === 'read' ? undefined : 77);
    }
  });

  it('TC-UQ-08c: mượn được ở cả 3 cấp công việc', () => {
    for (const [entityType, level] of [
      ['work', null],
      ['subwork', 2],
      ['task', 3],
    ]) {
      const v = can(nguoiMuon([uyQuyen()]), 'delete', entityType, dongCV({ level }));
      expect(v.ok, `cấp ${entityType}`).toBe(true);
    }
  });

  // Câu hỏi quyền CHUNG (row = null) — giao diện dùng để ẩn/hiện nút. Mượn quyền phải trả lời
  // được, không thì người được ủy quyền không thấy nút nào để bấm dù bấm vào là chạy.
  it('TC-UQ-08d: hỏi quyền chung (không có dòng) cũng mượn được', () => {
    const v = can(nguoiMuon([uyQuyen()]), 'approve', 'work', null);
    expect(v.ok).toBe(true);
    expect(v.viaDelegationId).toBe(77);
  });
});

describe('TC-UQ-10: bản đã huỷ không cho mượn', () => {
  // `status='cancelled'` bị loại ở SQL (`listEffectiveFor`), nên tới `can()` thì mảng đã rỗng.
  // Test ở tầng này khẳng định đúng một điều: `can()` KHÔNG có đường nào khác để lấy bản ghi —
  // nó chỉ đọc mảng được nạp. Phần "SQL loại đúng dòng cancelled" là TC-UQ-04/14.
  it('TC-UQ-10: mảng rỗng sau khi huỷ ⇒ trở lại quyền tự có', () => {
    const v = can(nguoiMuon([]), 'update', 'task', dongCV({ level: 3 }));
    expect(v.ok).toBe(false);
  });
});

describe('TC-UQ-11: L4 — chỉ công việc mượn được, người dùng và phòng thì không', () => {
  it('TC-UQ-11: mượn quyền Phó Giám đốc KHÔNG tạo/sửa/xoá được người dùng hay phòng', () => {
    const user = nguoiMuon([uyQuyen()]);
    for (const entityType of ['user', 'department']) {
      for (const action of ['create', 'update', 'delete']) {
        const v = can(user, action, entityType, { id: 9 });
        expect(v.ok, `${action} ${entityType}`).toBe(false);
        expect(v.code).toBe('FORBIDDEN');
      }
    }
  });

  it('TC-UQ-11b: L2 — bản ghi mượn vai `admin` bị bỏ qua (dữ liệu cũ / sửa tay trong CSDL)', () => {
    const user = nguoiMuon([uyQuyen({ fromRole: 'admin', departmentIds: [OWN_DEPT, OTHER_DEPT] })]);
    const v = can(user, 'update', 'work', dongCV({ department_id: OTHER_DEPT }));
    expect(v.ok).toBe(false);
  });

  it('TC-UQ-11c: mượn từ `Nhân viên` không mở được gì (vai không có phạm vi để cho)', () => {
    const user = nguoiMuon([uyQuyen({ fromRole: 'Nhân viên' })]);
    expect(can(user, 'update', 'work', dongCV()).ok).toBe(false);
  });
});

describe('TC-UQ-12: phạm vi mượn bó theo `department_ids` của bản ghi', () => {
  it('TC-UQ-12: phòng ngoài phạm vi ủy quyền vẫn bị chặn', () => {
    const user = nguoiMuon([uyQuyen({ departmentIds: [OWN_DEPT] })]);
    const v = can(user, 'update', 'work', dongCV({ department_id: OTHER_DEPT }));
    expect(v.ok).toBe(false);
    expect(v.code).toBe('FORBIDDEN');
    // Câu từ chối giữ nguyên câu của quyền TỰ CÓ ("Vai trò … không được sửa công việc"), không đổi
    // sang "ngoài phạm vi ủy quyền": người này vốn không sửa được công việc nào, nói về phạm vi ủy
    // quyền chỉ làm họ tưởng cứ đổi phòng là được.
    expect(v.message).toContain('Nhân viên');
  });

  it('TC-UQ-12b: nhiều phòng thì phòng nào cũng mượn được, phòng thứ ba thì không', () => {
    const user = nguoiMuon([uyQuyen({ departmentIds: [OWN_DEPT, OTHER_DEPT] })]);
    expect(can(user, 'delete', 'work', dongCV({ department_id: OWN_DEPT })).ok).toBe(true);
    expect(can(user, 'delete', 'work', dongCV({ department_id: OTHER_DEPT })).ok).toBe(true);
    expect(can(user, 'delete', 'work', dongCV({ department_id: 99 })).ok).toBe(false);
  });

  it('TC-UQ-12c: phạm vi rỗng không phải toàn quyền — không mở phòng nào', () => {
    const user = nguoiMuon([uyQuyen({ departmentIds: [] })]);
    expect(can(user, 'update', 'work', dongCV()).ok).toBe(false);
  });

  // Id từ CSDL có thể về dạng chuỗi (bigint), đúng bẫy đã sửa ở `sameId()`.
  it('TC-UQ-12d: id dạng chuỗi vẫn khớp id dạng số', () => {
    const user = nguoiMuon([uyQuyen({ departmentIds: [String(OWN_DEPT)] })]);
    expect(can(user, 'update', 'work', dongCV({ department_id: OWN_DEPT })).ok).toBe(true);
  });

  // L3 với vai `Quản lý công việc`: phạm vi thật của họ là các công việc mình quản lý, KHÔNG phải
  // cả phòng. Nếu lớp mượn chỉ xét phòng thì người mượn được nhiều hơn người cho.
  it('TC-UQ-12e: mượn từ «Quản lý công việc» chỉ mở đúng công việc của người đó', () => {
    const uq = uyQuyen({ fromRole: 'Quản lý công việc', fromUserId: 210 });
    const user = nguoiMuon([uq]);
    expect(can(user, 'update', 'work', dongCV({ manager_id: 210 })).ok).toBe(true);
    expect(can(user, 'update', 'work', dongCV({ assignee_id: 210 })).ok).toBe(true);
    expect(can(user, 'update', 'work', dongCV({ manager_id: 999 })).ok).toBe(false);
  });

  it('TC-UQ-12f: mượn từ Trưởng phòng / Phó phòng bó theo phòng được ghi trong bản ghi', () => {
    for (const fromRole of ['Trưởng phòng', 'Phó phòng']) {
      const user = nguoiMuon([uyQuyen({ fromRole, departmentIds: [OTHER_DEPT] })]);
      expect(
        can(user, 'create', 'subwork', dongCV({ department_id: OTHER_DEPT, level: 2 })).ok,
        fromRole
      ).toBe(true);
      expect(
        can(user, 'create', 'subwork', dongCV({ department_id: OWN_DEPT, level: 2 })).ok,
        fromRole
      ).toBe(false);
    }
  });
});

describe('Quyền TỰ CÓ xét trước — mượn quyền chỉ là đường bổ sung', () => {
  it('người tự có quyền vẫn ok và KHÔNG bị gắn `viaDelegationId`', () => {
    const tp = principal('Trưởng phòng', { id: 300, delegations: [uyQuyen()] });
    const v = can(tp, 'update', 'work', dongCV({ department_id: OWN_DEPT }));
    expect(v.ok).toBe(true);
    expect(v.viaDelegationId).toBeUndefined();
  });

  it('Nhân viên vẫn sửa được nhiệm vụ của chính mình dù có/không có ủy quyền', () => {
    const nv = nguoiMuon([uyQuyen({ departmentIds: [] })]);
    const v = can(nv, 'update', 'task', dongCV({ assignee_id: nv.id, level: 3 }));
    expect(v.ok).toBe(true);
    expect(v.viaDelegationId).toBeUndefined();
  });

  it('tài khoản bị vô hiệu hoá thì không mượn được gì', () => {
    const user = nguoiMuon([uyQuyen()], { is_active: false });
    const v = can(user, 'read', 'work', dongCV());
    expect(v.ok).toBe(false);
    expect(v.code).toBe('ACCOUNT_DISABLED');
  });
});

describe('Dấu vết cho nhật ký — `viaDelegationIds`', () => {
  // `middleware/audit.js` đọc mảng này để ghi `activity_logs.details.viaDelegationId`. Chỉ
  // `attachSession` gắn mảng; không gắn thì `can()` không có tác dụng lề nào.
  it('ghi id vào mảng khi (và chỉ khi) hành động lọt nhờ mượn quyền', () => {
    const user = nguoiMuon([uyQuyen()]);
    user.viaDelegationIds = [];
    expect(can(user, 'update', 'work', dongCV()).ok).toBe(true);
    expect(user.viaDelegationIds).toEqual([77]);
    // Gọi lại lần nữa: không nhân đôi id.
    can(user, 'delete', 'work', dongCV());
    expect(user.viaDelegationIds).toEqual([77]);
  });

  it('không ghi gì khi quyền tự có đã đủ, và không ghi gì khi bị từ chối', () => {
    const tuCo = principal('Trưởng phòng', {
      id: 300,
      delegations: [uyQuyen()],
      viaDelegationIds: [],
    });
    can(tuCo, 'update', 'work', dongCV({ department_id: OWN_DEPT }));
    expect(tuCo.viaDelegationIds).toEqual([]);

    const biChan = nguoiMuon([uyQuyen({ departmentIds: [OWN_DEPT] })]);
    biChan.viaDelegationIds = [];
    can(biChan, 'update', 'work', dongCV({ department_id: OTHER_DEPT }));
    expect(biChan.viaDelegationIds).toEqual([]);
  });
});
