import { getTokenPayload, initAuthUI, logout } from "./auth-ui.js";

initAuthUI();
window.logout = logout;

const payload = getTokenPayload();
const messageEl = document.getElementById("accountMessage");
const idEl = document.getElementById("accountUserId");
const nameEl = document.getElementById("accountName");
const emailEl = document.getElementById("accountEmail");
const roleEl = document.getElementById("accountRole");

if (!payload) {
  if (messageEl) {
    messageEl.className = "mt-6 rounded-2xl border border-brand-rose/30 bg-brand-rose/10 px-4 py-3 text-sm text-brand-rose";
    messageEl.textContent = "Unable to read account data. Please sign in again.";
    messageEl.classList.remove("hidden");
  }
} else {
  if (idEl) idEl.textContent = payload.sub || "-";
  if (nameEl) nameEl.textContent = `${payload.firstName || ""} ${payload.lastName || ""}`.trim() || "-";
  if (emailEl) emailEl.textContent = payload.email || "-";
  if (roleEl) roleEl.textContent = payload.role || "-";
}
