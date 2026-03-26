const DEFAULTS = {
  company: "Company",
  description: "Description",
  location: "Location",
  link: "Link",
  lastUpdated: "Last Updated",
  stage: "Stage",
};

// Load saved settings into the form
chrome.storage.sync.get(
  ["anthropicKey", "notionToken", "notionDatabaseId", "notionProps"],
  (settings) => {
    if (settings.anthropicKey) document.getElementById("anthropicKey").value = settings.anthropicKey;
    if (settings.notionToken) document.getElementById("notionToken").value = settings.notionToken;
    if (settings.notionDatabaseId) document.getElementById("notionDatabaseId").value = settings.notionDatabaseId;

    const props = { ...DEFAULTS, ...(settings.notionProps || {}) };
    document.getElementById("prop-company").value = props.company;
    document.getElementById("prop-description").value = props.description;
    document.getElementById("prop-location").value = props.location;
    document.getElementById("prop-link").value = props.link;
    document.getElementById("prop-lastUpdated").value = props.lastUpdated;
    document.getElementById("prop-stage").value = props.stage;
  }
);

document.getElementById("saveBtn").addEventListener("click", () => {
  const notionProps = {
    company: document.getElementById("prop-company").value.trim() || DEFAULTS.company,
    description: document.getElementById("prop-description").value.trim() || DEFAULTS.description,
    location: document.getElementById("prop-location").value.trim() || DEFAULTS.location,
    link: document.getElementById("prop-link").value.trim() || DEFAULTS.link,
    lastUpdated: document.getElementById("prop-lastUpdated").value.trim() || DEFAULTS.lastUpdated,
    stage: document.getElementById("prop-stage").value.trim() || DEFAULTS.stage,
  };

  chrome.storage.sync.set(
    {
      anthropicKey: document.getElementById("anthropicKey").value.trim(),
      notionToken: document.getElementById("notionToken").value.trim(),
      notionDatabaseId: document.getElementById("notionDatabaseId").value.trim().replace(/-/g, ""),
      notionProps,
    },
    () => {
      const status = document.getElementById("saveStatus");
      status.textContent = "✓ Saved";
      setTimeout(() => (status.textContent = ""), 2500);
    }
  );
});
