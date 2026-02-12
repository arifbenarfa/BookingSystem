// ===============================
// 1) DOM references
// ===============================
const actions = document.getElementById("resourceActions");
const resourceNameContainer = document.getElementById("resourceNameContainer");
const resourceDescriptionInput = document.getElementById("resourceDescription");

// Example roles
const role = "admin"; // "reserver" | "admin"

let createButton = null;
let updateButton = null;
let deleteButton = null;

// ===============================
// 2) Button creation helpers
// ===============================

const BUTTON_BASE_CLASSES =
  "w-full rounded-2xl px-6 py-3 text-sm font-semibold transition-all duration-200 ease-out";

const BUTTON_ENABLED_CLASSES =
  "bg-brand-primary text-white hover:bg-brand-dark/80 shadow-soft";

function addButton({ label, type = "button", value, classes = "" }) {
  const btn = document.createElement("button");
  btn.type = type;
  btn.textContent = label;
  btn.name = "action";
  if (value) btn.value = value;

  btn.className = `${BUTTON_BASE_CLASSES} ${classes}`.trim();
  actions.appendChild(btn);
  return btn;
}

function setButtonEnabled(btn, enabled) {
  if (!btn) return;

  btn.disabled = !enabled;
  btn.classList.toggle("cursor-not-allowed", !enabled);
  btn.classList.toggle("opacity-50", !enabled);

  if (!enabled) {
    btn.classList.remove("hover:bg-brand-dark/80");
  } else {
    btn.classList.add("hover:bg-brand-dark/80");
  }
}

function renderActionButtons(currentRole) {
  if (currentRole === "reserver") {
    createButton = addButton({
      label: "Create",
      type: "submit",
      value: "create",
      classes: BUTTON_ENABLED_CLASSES,
    });
  }

  if (currentRole === "admin") {
    createButton = addButton({
      label: "Create",
      type: "submit",
      value: "create",
      classes: BUTTON_ENABLED_CLASSES,
    });

    updateButton = addButton({
      label: "Update",
      value: "update",
      classes: BUTTON_ENABLED_CLASSES,
    });

    deleteButton = addButton({
      label: "Delete",
      value: "delete",
      classes: BUTTON_ENABLED_CLASSES,
    });
  }

  // Disable all by default
  setButtonEnabled(createButton, false);
  setButtonEnabled(updateButton, false);
  setButtonEnabled(deleteButton, false);
}

// ===============================
// 3) Input creation
// ===============================

function createResourceNameInput(container) {
  const input = document.createElement("input");

  input.id = "resourceName";
  input.name = "resourceName";
  input.type = "text";
  input.placeholder = "e.g., Meeting Room A";

  input.className = `
    mt-2 w-full rounded-2xl border border-black/10 bg-white
    px-4 py-3 text-sm outline-none
    focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30
    transition-all duration-200 ease-out
  `;

  container.appendChild(input);
  return input;
}

// ===============================
// 4) Validation logic
// ===============================

function isResourceNameValid(value) {
  const trimmed = value.trim();
  const allowedPattern = /^[a-zA-Z0-9äöåÄÖÅ ]+$/;

  const lengthValid = trimmed.length >= 5 && trimmed.length <= 30;
  const charactersValid = allowedPattern.test(trimmed);

  return lengthValid && charactersValid;
}

function isResourceDescriptionValid(value) {
  const trimmed = value.trim();
  const allowedPattern = /^[a-zA-Z0-9äöåÄÖÅ ,.]+$/;

  // 🔥 EXACT REQUIREMENT: 10–50 characters
  const lengthValid = trimmed.length >= 10 && trimmed.length <= 50;
  const charactersValid = allowedPattern.test(trimmed);

  return lengthValid && charactersValid;
}

function setInputVisualState(input, state) {
  input.classList.remove("border-green-500", "border-red-500");

  if (state === "valid") {
    input.classList.add("border-green-500");
  } else if (state === "invalid") {
    input.classList.add("border-red-500");
  }
}

// ===============================
// 5) Combined validation
// ===============================

function attachValidation(nameInput) {
  const update = () => {
    const nameValue = nameInput.value;
    const descriptionValue = resourceDescriptionInput.value;

    const nameValid = isResourceNameValid(nameValue);
    const descriptionValid = isResourceDescriptionValid(descriptionValue);

    // Name visual
    if (nameValue.trim() === "") {
      setInputVisualState(nameInput, null);
    } else {
      setInputVisualState(nameInput, nameValid ? "valid" : "invalid");
    }

    // Description visual
    if (descriptionValue.trim() === "") {
      setInputVisualState(resourceDescriptionInput, null);
    } else {
      setInputVisualState(
        resourceDescriptionInput,
        descriptionValid ? "valid" : "invalid"
      );
    }

    const formValid = nameValid && descriptionValid;

    setButtonEnabled(createButton, formValid);
    setButtonEnabled(updateButton, formValid);
    setButtonEnabled(deleteButton, formValid);
  };

  nameInput.addEventListener("input", update);
  resourceDescriptionInput.addEventListener("input", update);

  update();
}

// ===============================
// 6) Bootstrapping
// ===============================

renderActionButtons(role);

const resourceNameInput = createResourceNameInput(resourceNameContainer);
attachValidation(resourceNameInput);
