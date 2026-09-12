"use strict";
// Tiện ích của đợt sửa 8b: dựng nội dung động bằng textContent, không đưa dữ liệu vào HTML.
let dauViecDangDuyet8b = null;
function taoNut8b(label, onClick, primary = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = primary ? "btn-primary" : "btn-secondary";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}
function hopThoai8b(title, message) {
  const overlay = document.createElement("div");
  overlay.className = "qlcv-dialog";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  const panel = document.createElement("section");
  const heading = document.createElement("h3");
  heading.textContent = title;
  const content = document.createElement("div");
  content.className = "qlcv-dialog-content";
  content.textContent = message;
  const actions = document.createElement("footer");
  panel.append(heading, content, actions);
  overlay.append(panel);
  document.body.append(overlay);
  const prior = document.activeElement;
  return {
    overlay,
    content,
    actions,
    close: () => {
      overlay.remove();
      prior?.focus();
    },
  };
}
function cacTongTyLe8b(type, data = {}, row = null, source = allTasks) {
  const groups = new Map();
  let tasks = source.filter(
    (t) => Number(t[COL.T_LEVEL]) === 3 && t[COL.T_PARENT],
  );
  if (type === "project")
    tasks = tasks.filter((t) => String(t[COL.T_PID]) === String(data.id));
  else if (Number(row?.[COL.T_LEVEL]) === 2)
    tasks = tasks.filter(
      (t) => String(t[COL.T_PARENT]) === String(row[COL.T_ID]),
    );
  else {
    const parent = row?.[COL.T_PARENT] || data.parent;
    if (!parent) return [];
    tasks = tasks.filter((t) => String(t[COL.T_PARENT]) === String(parent));
    const manual = data.tyLe !== undefined && data.tyLe !== "";
    if (!row) {
      const count = tasks.length + 1;
      const equal = (index) =>
        Math.floor(100 / count) + (index < 100 % count ? 1 : 0);
      if (tasks.every((t) => t.__tuDong === true))
        tasks = tasks.map((t, index) => ({
          ...t,
          [COL.T_TY_LE]: equal(index),
        }));
      tasks.push({
        [COL.T_PARENT]: parent,
        [COL.T_TY_LE]: manual ? Number(data.tyLe) : equal(count - 1),
      });
    } else if (manual) {
      tasks = tasks.map((t) =>
        String(t[COL.T_ID]) === String(row[COL.T_ID])
          ? { ...t, [COL.T_TY_LE]: Number(data.tyLe) }
          : t,
      );
    }
  }
  for (const task of tasks)
    groups.set(
      task[COL.T_PARENT],
      (groups.get(task[COL.T_PARENT]) || 0) + Number(task[COL.T_TY_LE] || 0),
    );
  return [...groups].filter(([, total]) => total !== 100);
}
async function kiemTraTyLeMoiNhat8b(type, data, row, intent = "lưu tạm") {
  const workRef =
    type === "project"
      ? data.id || row?.[COL.P_ID]
      : data.projectId || row?.[COL.T_PID];
  if (!workRef) return true;
  const response = await restGetIm(
    "/api/v1/work-items?workRef=" + encodeURIComponent(workRef),
  );
  if (!response?.items) {
    showToast("Chưa kiểm tra được tỷ lệ mới nhất. Vui lòng thử lại.", "error");
    return false;
  }
  const codes = new Map(
    response.items.map((item) => [String(item.id), item.code]),
  );
  const source = response.items.map((item) => ({
    [COL.T_ID]: item.code,
    [COL.T_NAME]: item.name,
    [COL.T_PID]: workRef,
    [COL.T_LEVEL]: item.level,
    [COL.T_PARENT]:
      item.parent_id == null ? "" : codes.get(String(item.parent_id)),
    [COL.T_TY_LE]: item.ty_le,
    __tuDong: item.ty_le_tu_dong,
  }));
  return xacNhanTyLe8b(type, data, row, intent, source);
}
function xacNhanTyLe8b(type, data, row, intent = "lưu tạm", source = allTasks) {
  const invalid = cacTongTyLe8b(type, data, row, source);
  if (!invalid.length) return Promise.resolve(true);
  const text = invalid
    .map(([parent, total]) => {
      const name =
        source.find((t) => String(t[COL.T_ID]) === String(parent))?.[
          COL.T_NAME
        ] || parent;
      return (
        name +
        ": tổng " +
        total +
        "% — " +
        (total > 100 ? "vượt 100%" : "chưa đủ 100%")
      );
    })
    .join("\n");
  return new Promise((resolve) => {
    const dialog = hopThoai8b(
      "Tổng tỷ lệ nhiệm vụ khác 100%",
      text + "\nBạn có thể tiếp tục hoặc quay lại chỉnh sửa tỷ lệ.",
    );
    dialog.actions.append(
      taoNut8b("Sửa lại", () => {
        dialog.close();
        resolve(false);
      }),
      taoNut8b(
        "Vẫn " + intent,
        () => {
          dialog.close();
          resolve(true);
        },
        true,
      ),
    );
    dialog.actions.firstElementChild.focus();
  });
}
function capNhatNutDuyet8b(type, ref, form) {
  const allowed = ref && coQuyenTaiDong("approve", type, ref);
  form.querySelectorAll("[data-review-action]").forEach((button) => {
    button.disabled =
      !allowed || form.dataset.dangLuu === "1" || form.dataset.dangKiem === "1";
  });
}
function ganTienIchForm8b(type, row, form) {
  if (!["project", "task"].includes(type) || !form) return;
  form.addEventListener(
    "submit",
    async (event) => {
      if (form.dataset.tyLeConfirmed === "1") {
        delete form.dataset.tyLeConfirmed;
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (form.dataset.dangKiem === "1" || form.dataset.dangLuu === "1") return;
      const assignee = form.querySelector('[name="assignee"]');
      const level = Number(
        row?.[COL.T_LEVEL] || form.querySelector('[name="level"]')?.value || 3,
      );
      if (
        type === "task" &&
        level === 3 &&
        !String(assignee?.value || "").trim()
      ) {
        showToast("Vui lòng chọn Người thực hiện trực tiếp cho nhiệm vụ", "error");
        assignee?.focus();
        delete form.dataset.quyetDinh;
        return;
      }
      const data = Object.fromEntries(new FormData(form));
      // Ô cha khóa khi tạo từ cây nên FormData không chứa nó.
      if (type === "task" && !data.projectId)
        data.projectId = form.querySelector('[name="projectId"]')?.value;
      form.dataset.dangKiem = "1";
      try {
        const intent =
          form.dataset.quyetDinh === "approve"
            ? "lưu và phê duyệt"
            : event.submitter?.hasAttribute("data-gui-duyet")
              ? "gửi đi"
              : "lưu tạm";
        if (
          (await kiemTraTyLeMoiNhat8b(type, data, row, intent)) &&
          form.isConnected
        ) {
          // Trình duyệt thật bỏ qua requestSubmit gọi lại trong cùng lượt submit.
          // Trường hợp tạo công việc mới không có request mạng để tách lượt đó.
          await new Promise((resolve) => setTimeout(resolve, 0));
          if (!form.isConnected) return;
          form.dataset.tyLeConfirmed = "1";
          form.requestSubmit(event.submitter || undefined);
        } else {
          delete form.dataset.quyetDinh;
        }
      } finally {
        delete form.dataset.dangKiem;
      }
    },
    true,
  );
  if (!row) return;
  const ref = row[type === "project" ? COL.P_ID : COL.T_ID];
  hienThayDoiDuyet8b(type, ref, form);
  if (
    row[COL.P_APPROVAL] !== "Chờ duyệt" ||
    !coQuyenTaiDong("approve", type, row)
  )
    return;
  const footer = document.createElement("footer");
  footer.className = "review-form-actions";
  for (const [label, action] of [
    ["Lưu và phê duyệt", "approve"],
    ["Trả để sửa lại", "return"],
    ["Từ chối", "reject"],
  ]) {
    const button = taoNut8b(
      label,
      () => {
        if (!form.reportValidity()) {
          delete form.dataset.quyetDinh;
          return;
        }
        form.dataset.quyetDinh = action;
        form.requestSubmit();
      },
      action === "approve",
    );
    button.dataset.reviewAction = action;
    footer.append(button);
  }
  form.append(footer);
}
function xinLyDo8b(action) {
  return new Promise((resolve) => {
    const reject = action === "reject";
    const dialog = hopThoai8b(
      reject ? "Từ chối và xóa đầu việc" : "Trả để sửa lại",
      reject
        ? "Từ chối sẽ xóa đầu việc và các mục bên trong. Không thể hoàn tác. Nhập lý do ít nhất 10 ký tự."
        : "Nhập nội dung cần sửa, ít nhất 10 ký tự. Đầu việc sẽ trở về Nháp.",
    );
    const input = document.createElement("textarea");
    input.className = "form-textarea";
    input.maxLength = 2000;
    dialog.content.append(input);
    dialog.actions.append(
      taoNut8b("Hủy", () => {
        dialog.close();
        resolve(null);
      }),
      taoNut8b(
        reject ? "Xác nhận từ chối" : "Trả lại",
        () => {
          if (input.value.trim().length < 10) {
            showToast("Vui lòng nhập ít nhất 10 ký tự", "error");
            input.focus();
            return;
          }
          const reason = input.value.trim();
          dialog.close();
          resolve(reason);
        },
        true,
      ),
    );
    input.focus();
  });
}
async function luuSuaVaQuyetDinh8b(type, row, data, form) {
  if (form.dataset.dangLuu === "1") return;
  const action = form.dataset.quyetDinh || "";
  delete form.dataset.quyetDinh;
  if (!coQuyenTaiDong("approve", type, row)) {
    showToast(
      "Quyền duyệt hiện tại đã thay đổi. Vui lòng mở lại đầu việc.",
      "error",
    );
    return;
  }
  form.dataset.dangLuu = "1";
  const reason = ["return", "reject"].includes(action)
    ? await xinLyDo8b(action)
    : undefined;
  if (reason === null) {
    delete form.dataset.dangLuu;
    return;
  }
  const buttons = [...form.querySelectorAll("button")];
  buttons.forEach((b) => {
    b.disabled = true;
  });
  const ref = row[type === "project" ? COL.P_ID : COL.T_ID];
  const approvalPath =
    "/api/v1/approvals/" +
    (type === "project" ? "work" : "item") +
    "/" +
    encodeURIComponent(ref) +
    "/" +
    action;
  try {
    if (action === "approve") {
      // Người duyệt sửa rồi bấm phê duyệt phải đi qua MỘT request REST. Máy chủ giữ chỉnh sửa
      // và đổi trạng thái trong cùng transaction, nên lỗi ở bước nào cũng không để lại bản ghi dở.
      const result = await restPost(approvalPath, { edit: data });
      if (!result) return;
    } else {
      // Trả lại / Từ chối vẫn lưu nội dung trước, vì đây là hai quyết định khác với phê duyệt.
      const response = await new Promise((resolve, reject) =>
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          [
            type === "project" ? "updateProjectWithAuth" : "updateTaskWithAuth"
          ](ref, data),
      );
      if (!response?.success)
        throw new Error(response?.error || "Không lưu được thay đổi");
      if (action) {
        const result = await restPost(
          approvalPath,
          reason === undefined ? {} : { reason },
        );
        if (!result) return;
      }
    }
    if (action) {
      form.closest(".modal, .modal-overlay")?.remove();
      document.getElementById("project-details-modal")?.remove();
      cheDoDuyetChiDoc = false;
      dauViecDangDuyet8b = null;
    }
    await refreshData();
    showToast(
      action === "approve"
        ? "Đã lưu và phê duyệt nội dung vừa sửa"
        : action
          ? "Đã xử lý đầu việc"
          : "Đã lưu thay đổi; bạn có thể phê duyệt ngay",
      "success",
    );
    if (action) await napLaiSauDuyet();
  } catch (error) {
    showToast(error.message || "Không lưu được thay đổi", "error");
  } finally {
    delete form.dataset.dangLuu;
    buttons.forEach((b) => {
      b.disabled = false;
    });
    capNhatNutDuyet8b(type, ref, form);
  }
}
function ganNutDuyetChiTiet8b(project, modal) {
  if (!modal) return;
  const ref = project[COL.P_ID];
  hienThayDoiDuyet8b("project", ref, modal);
  if (!cheDoDuyetChiDoc) return;
  const target = dauViecDangDuyet8b || { type: "project", ref };
  const row = (target.type === "project" ? allProjects : allTasks).find(
    (r) =>
      String(r[target.type === "project" ? COL.P_ID : COL.T_ID]) ===
      String(target.ref),
  );
  if (
    !row ||
    !coQuyenTaiDong("approve", target.type, row) ||
    row[COL.P_APPROVAL] !== "Chờ duyệt"
  )
    return;
  const footer = document.createElement("footer");
  footer.className = "review-form-actions";
  footer.append(
    taoNut8b("Chỉnh sửa thông tin", () =>
      openEditModal(target.type, target.ref),
    ),
  );
  for (const [label, action] of [
    ["Phê duyệt", "approve"],
    ["Trả để sửa lại", "return"],
    ["Từ chối", "reject"],
  ]) {
    footer.append(
      taoNut8b(
        label,
        async () => {
          const reason =
            action === "approve" ? undefined : await xinLyDo8b(action);
          if (reason === null) return;
          const buttons = [...footer.querySelectorAll("button")];
          buttons.forEach((b) => {
            b.disabled = true;
          });
          try {
            const result = await restPost(
              "/api/v1/approvals/" +
                (target.type === "project" ? "work" : "item") +
                "/" +
                encodeURIComponent(target.ref) +
                "/" +
                action,
              reason === undefined ? {} : { reason },
            );
            if (!result) return;
            modal.remove();
            cheDoDuyetChiDoc = false;
            dauViecDangDuyet8b = null;
            await napLaiSauDuyet();
            showToast(
              action === "approve" ? "Đã phê duyệt" : "Đã xử lý đầu việc",
              "success",
            );
          } finally {
            buttons.forEach((b) => {
              b.disabled = false;
            });
          }
        },
        action === "approve",
      ),
    );
  }
  modal.querySelector(".modal-content").append(footer);
}
async function hienThayDoiDuyet8b(type, ref, host) {
  if (
    !isAuthenticated ||
    !ref ||
    ["1", "loading"].includes(host.dataset.receiptsChecked)
  )
    return;
  host.dataset.receiptsChecked = "loading";
  const nguoi = currentUser;
  const response = await restGetIm(
    "/api/v1/approvals/" +
      (type === "project" ? "work" : "item") +
      "/" +
      encodeURIComponent(ref) +
      "/changes",
  );
  if (!response) delete host.dataset.receiptsChecked;
  else host.dataset.receiptsChecked = "1";
  if (
    !isAuthenticated ||
    currentUser !== nguoi ||
    !host.isConnected ||
    !response?.items?.length ||
    document.querySelector(".approval-changes-dialog")
  )
    return;
  const dialog = hopThoai8b(
    "Nội dung đã được người duyệt chỉnh sửa",
    "Các thay đổi sau đã được phê duyệt. OK đóng lần này; Đã biết sẽ ngừng nhắc các thay đổi này.",
  );
  dialog.overlay.classList.add("approval-changes-dialog");
  for (const item of response.items) {
    const heading = document.createElement("h4");
    heading.textContent =
      item.entity_code +
      " — " +
      item.entity_name +
      " (" +
      (item.editor_name || "Người duyệt") +
      ")";
    const list = document.createElement("ul");
    for (const change of item.changes) {
      const li = document.createElement("li");
      li.textContent =
        change.label +
        ": “" +
        (change.from || "Trống") +
        "” → “" +
        (change.to || "Trống") +
        "”";
      list.append(li);
    }
    dialog.content.append(heading, list);
  }
  dialog.actions.append(
    taoNut8b("OK", dialog.close),
    taoNut8b(
      "Đã biết",
      async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          for (const item of response.items) {
            if (
              !(await restPost(
                "/api/v1/approvals/changes/" +
                  encodeURIComponent(item.id) +
                  "/acknowledge",
                {},
              ))
            )
              return;
          }
          dialog.close();
        } finally {
          button.disabled = false;
        }
      },
      true,
    ),
  );
  dialog.actions.firstElementChild.focus();
}

// Chỉ làm mới bộ dữ liệu; không đổi đối tượng phiên hay dựng lại form đang nhập.
function napDuLieuDauViec8b() {
  if (
    !isAuthenticated ||
    typeof google === "undefined" ||
    !google.script?.run ||
    typeof google.script.run.getDataForUser !== "function"
  )
    return Promise.resolve(false);
  const nguoi = currentUser;
  return new Promise((resolve) => {
    google.script.run
      .withSuccessHandler((response) => {
        if (
          !isAuthenticated ||
          currentUser !== nguoi ||
          !response?.success ||
          String(response.user?.id) !== String(nguoi.id)
        )
          return resolve(false);
        allProjects = response.projects || [];
        allTasks = response.tasks || [];
        if (response.staff) allStaff = response.staff;
        resolve(true);
      })
      .withFailureHandler(() => resolve(false))
      .getDataForUser();
  });
}
async function lamMoiChiTiet8b(ref, host) {
  if (!(await napDuLieuDauViec8b()) || !host.isConnected) return;
  const row = allProjects.find((r) => String(r[COL.P_ID]) === String(ref));
  if (!row) {
    host.remove();
    showToast(
      "Công việc không còn tồn tại hoặc bạn không còn quyền xem.",
      "error",
    );
    return;
  }
  showProjectDetailsModal(ref, row[COL.P_NAME], {
    receiptsChecked: host.dataset.receiptsChecked,
    daLamMoi: true,
  });
}
let lanMoSua8b = 0;
async function moSuaMoiNhat8b(type, ref) {
  const lan = ++lanMoSua8b;
  if (!(await napDuLieuDauViec8b())) {
    showToast("Chưa tải được thông tin mới nhất. Vui lòng mở lại.", "error");
    return;
  }
  if (lan !== lanMoSua8b) return;
  const key = type === "project" ? COL.P_ID : COL.T_ID;
  const row = (type === "project" ? allProjects : allTasks).find(
    (r) => String(r[key]) === String(ref),
  );
  if (!row) {
    showToast(
      "Đầu việc không còn tồn tại hoặc bạn không còn quyền xem.",
      "error",
    );
    return;
  }
  openModal(type, row);
}
