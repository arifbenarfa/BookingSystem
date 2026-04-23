import { initAuthUI, requireAuthOrBlockPage, logout } from "./auth-ui.js";

initAuthUI();
if (!requireAuthOrBlockPage()) {
  throw new Error("Authentication required");
}

window.logout = logout;

const form = document.getElementById("reservationForm");
const messageEl = document.getElementById("formMessage");
const listEl = document.getElementById("reservationList");
const modeBadgeEl = document.getElementById("formModeBadge");

const reservationIdInput = document.getElementById("reservationId");
const resourceIdInput = document.getElementById("resourceId");
const userIdInput = document.getElementById("userId");
const startTimeInput = document.getElementById("startTime");
const endTimeInput = document.getElementById("endTime");
const noteInput = document.getElementById("note");
const statusInput = document.getElementById("status");

const createBtn = document.getElementById("createBtn");
const updateBtn = document.getElementById("updateBtn");
const deleteBtn = document.getElementById("deleteBtn");
const clearBtn = document.getElementById("clearBtn");

let reservationsCache = [];
let mode = "create";

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function setMessage(type, text) {
  const typeClass = {
    success: "border-brand-green/30 bg-brand-green/10 text-brand-green",
    error: "border-brand-rose/30 bg-brand-rose/10 text-brand-rose",
    info: "border-brand-blue/30 bg-brand-blue/10 text-brand-blue",
  };

  messageEl.className = `mt-6 rounded-2xl border px-4 py-3 text-sm ${typeClass[type] || typeClass.info}`;
  messageEl.textContent = text;
  messageEl.classList.remove("hidden");
}

function clearMessage() {
  messageEl.className = "hidden mt-6 rounded-2xl border px-4 py-3 text-sm";
  messageEl.textContent = "";
}

function setMode(nextMode) {
  mode = nextMode;
  const editMode = mode === "edit";
  updateBtn.disabled = !editMode;
  deleteBtn.disabled = !editMode;
  createBtn.disabled = editMode;
  modeBadgeEl.textContent = editMode ? "Edit reservation" : "Create reservation";
}

function clearForm() {
  reservationIdInput.value = "";
  resourceIdInput.value = "";
  userIdInput.value = "";
  startTimeInput.value = "";
  endTimeInput.value = "";
  noteInput.value = "";
  statusInput.value = "active";
  setMode("create");
  highlightSelectedReservation(null);
}

function readPayloadFromForm() {
  return {
    resourceId: Number(resourceIdInput.value),
    userId: Number(userIdInput.value),
    startTime: new Date(startTimeInput.value).toISOString(),
    endTime: new Date(endTimeInput.value).toISOString(),
    note: noteInput.value.trim(),
    status: statusInput.value,
  };
}

function validateForm() {
  const resourceId = Number(resourceIdInput.value);
  const userId = Number(userIdInput.value);
  if (!resourceId || !userId) {
    setMessage("error", "Resource ID and User ID are required.");
    return false;
  }

  if (!startTimeInput.value || !endTimeInput.value) {
    setMessage("error", "Start time and end time are required.");
    return false;
  }

  if (new Date(startTimeInput.value) >= new Date(endTimeInput.value)) {
    setMessage("error", "End time must be after start time.");
    return false;
  }

  return true;
}

function renderReservations(items) {
  if (!items.length) {
    listEl.innerHTML = `<p class="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black/60">No reservations yet.</p>`;
    return;
  }

  listEl.innerHTML = items
    .map((item) => {
      const start = new Date(item.start_time).toLocaleString();
      const end = new Date(item.end_time).toLocaleString();
      return `
        <button
          type="button"
          data-id="${item.id}"
          class="w-full text-left rounded-2xl border border-black/10 bg-white px-4 py-3 transition hover:bg-black/5"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="font-semibold">#${item.id} - ${item.resource_name || "Resource " + item.resource_id}</p>
              <p class="text-xs text-black/60">User: ${item.user_email || item.user_id} | ${item.status}</p>
              <p class="text-xs text-black/60">${start} - ${end}</p>
            </div>
          </div>
        </button>
      `;
    })
    .join("");

  listEl.querySelectorAll("[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      const selected = reservationsCache.find((item) => Number(item.id) === id);
      if (!selected) return;
      loadReservationToForm(selected);
    });
  });
}

function highlightSelectedReservation(id) {
  listEl.querySelectorAll("[data-id]").forEach((btn) => {
    const selected = Number(btn.dataset.id) === Number(id);
    btn.classList.toggle("ring-2", selected);
    btn.classList.toggle("ring-brand-blue/40", selected);
    btn.classList.toggle("bg-brand-blue/5", selected);
  });
}

function loadReservationToForm(item) {
  reservationIdInput.value = String(item.id);
  resourceIdInput.value = String(item.resource_id);
  userIdInput.value = String(item.user_id);
  startTimeInput.value = new Date(item.start_time).toISOString().slice(0, 16);
  endTimeInput.value = new Date(item.end_time).toISOString().slice(0, 16);
  noteInput.value = item.note || "";
  statusInput.value = item.status || "active";
  setMode("edit");
  highlightSelectedReservation(item.id);
}

async function readBody(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

async function refreshReservations() {
  try {
    const response = await fetch("/api/reservations", {
      headers: getAuthHeaders(),
    });
    const body = await readBody(response);
    if (!response.ok) {
      setMessage("error", `Loading reservations failed (${response.status}).`);
      renderReservations([]);
      return;
    }

    reservationsCache = Array.isArray(body.data) ? body.data : [];
    renderReservations(reservationsCache);
  } catch (error) {
    console.error(error);
    setMessage("error", "Unable to contact server while loading reservations.");
    renderReservations([]);
  }
}

async function createReservation() {
  const payload = readPayloadFromForm();
  const response = await fetch("/api/reservations", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await readBody(response);
  if (!response.ok) {
    throw new Error(body?.error || `Create failed (${response.status})`);
  }
  setMessage("success", "Reservation created successfully.");
}

async function updateReservation(id) {
  const payload = readPayloadFromForm();
  const response = await fetch(`/api/reservations/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await readBody(response);
  if (!response.ok) {
    throw new Error(body?.error || `Update failed (${response.status})`);
  }
  setMessage("success", `Reservation #${id} updated successfully.`);
}

async function deleteReservation(id) {
  const response = await fetch(`/api/reservations/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const body = await readBody(response);
    throw new Error(body?.error || `Delete failed (${response.status})`);
  }
  setMessage("success", `Reservation #${id} deleted successfully.`);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  if (!validateForm()) return;

  try {
    if (mode === "create") {
      await createReservation();
      clearForm();
      await refreshReservations();
      return;
    }

    const id = Number(reservationIdInput.value);
    if (!id) {
      setMessage("error", "Select a reservation before updating.");
      return;
    }
    await updateReservation(id);
    clearForm();
    await refreshReservations();
  } catch (error) {
    setMessage("error", error.message || "Request failed.");
  }
});

deleteBtn.addEventListener("click", async () => {
  clearMessage();
  const id = Number(reservationIdInput.value);
  if (!id) {
    setMessage("error", "Select a reservation before deleting.");
    return;
  }

  try {
    await deleteReservation(id);
    clearForm();
    await refreshReservations();
  } catch (error) {
    setMessage("error", error.message || "Delete failed.");
  }
});

clearBtn.addEventListener("click", () => {
  clearMessage();
  clearForm();
});

setMode("create");
refreshReservations();
