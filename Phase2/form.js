// ===============================
// Form handling for resources page
// ===============================

// -------------- Helpers --------------
function $(id) {
  return document.getElementById(id);
}

function logSection(title, data) {
  console.group(title);
  console.log(data);
  console.groupEnd();
}

// -------------- Validation helpers --------------
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
  const lengthValid = trimmed.length >= 10 && trimmed.length <= 200;
  const charactersValid = allowedPattern.test(trimmed);
  return lengthValid && charactersValid;
}

// -------------- Form wiring --------------
document.addEventListener("DOMContentLoaded", () => {
  const form = $("resourceForm");
  if (!form) {
    console.warn('resourceForm not found. Ensure the form has id="resourceForm".');
    return;
  }

  form.addEventListener("submit", onSubmit);
});

async function onSubmit(event) {
  event.preventDefault();

  const submitter = event.submitter;
  const actionValue = submitter && submitter.value ? submitter.value : "create";

  // Trimmed values
  const resourceName = $("resourceName")?.value.trim() ?? "";
  const resourceDescription = $("resourceDescription")?.value.trim() ?? "";
  const resourceAvailable = $("resourceAvailable")?.value ?? "";
  const resourcePrice = $("resourcePrice")?.value ?? "";
  const resourcePriceUnit = $("resourcePriceUnit")?.value ?? "";

  // ===============================
  // SAFETY VALIDATION (important!)
  // ===============================
  const nameValid = isResourceNameValid(resourceName);
  const descriptionValid = isResourceDescriptionValid(resourceDescription);

  if (!nameValid || !descriptionValid) {
    alert("Please fix validation errors before submitting.");
    return;
  }

  const payload = {
    action: actionValue,
    resourceName,
    resourceDescription,
    resourceAvailable,
    resourcePrice,
    resourcePriceUnit
  };

  logSection("Sending payload to httpbin.org/post", payload);

  try {
    const response = await fetch("https://httpbin.org/post", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} ${response.statusText}\n${text}`);
    }

    const data = await response.json();

    console.group("Response from httpbin.org");
    console.log("Status:", response.status);
    console.log("URL:", data.url);
    console.log("You sent (echo):", data.json);
    console.log("Headers (echoed):", data.headers);
    console.groupEnd();

    alert("Form submitted successfully!");

  } catch (err) {
    console.error("POST error:", err);
    alert("Server error. Please try again.");
  }
}
