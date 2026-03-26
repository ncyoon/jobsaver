// ── Helpers ──────────────────────────────────────────────────────────────────

function showState(id) {
  document.querySelectorAll(".state").forEach((el) => el.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function setLoading(msg) {
  document.getElementById("loadingMsg").textContent = msg;
  showState("state-loading");
}

function showError(msg) {
  document.getElementById("errorMsg").textContent = msg;
  showState("state-error");
}

async function getSettings() {
  return new Promise((resolve) =>
    chrome.storage.sync.get(
      ["anthropicKey", "notionToken", "notionDatabaseId", "notionProps"],
      resolve
    )
  );
}

// ── Page content extraction (injected into active tab) ────────────────────────

function extractPageContent() {
  const url = window.location.href;
  const title = document.title;

  // Try progressively broader selectors for the main job content
  const selectors = [
    // LinkedIn
    ".jobs-description__container",
    ".job-view-layout",
    ".jobs-details",
    // Jobright
    "[class*='job-detail']",
    "[class*='JobDetail']",
    "[class*='job_detail']",
    // Generic
    "main",
    "[role='main']",
    "article",
  ];

  let el = null;
  for (const sel of selectors) {
    el = document.querySelector(sel);
    if (el) break;
  }

  const source = el || document.body;
  let text = source.innerText || source.textContent || "";

  // Clean up whitespace
  text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  return { url, title, text: text.slice(0, 15000) };
}

// ── Claude extraction ─────────────────────────────────────────────────────────

async function extractJobInfo(apiKey, pageUrl, pageText, pageTitle) {
  const prompt = `You are a job-posting parser. Extract structured information from this job posting.

Return ONLY a valid JSON object with these fields:
- "title": job title (string)
- "company": company name (string)
- "location": location or "Remote" (string)
- "description": a concise 3–5 sentence summary of the role, responsibilities, and key requirements (string)
- "salary": salary/compensation range if mentioned, otherwise null

Page URL: ${pageUrl}
Page title: ${pageTitle}
Page content:
${pageText}`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${err.error?.message || resp.statusText}`);
  }

  const data = await resp.json();
  let raw = data.content[0].text.trim();

  // Extract the first {...} block in case Claude adds surrounding text
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in Claude's response.");

  return JSON.parse(match[0]);
}

// ── Notion ────────────────────────────────────────────────────────────────────

async function saveToNotion(notionToken, databaseId, props, job, pageUrl) {
  const now = new Date().toISOString();

  const descParts = [];
  if (job.description) descParts.push(job.description);
  if (job.salary) descParts.push(`Salary: ${job.salary}`);
  const fullDescription = descParts.join("\n\n");

  const properties = {
    [props.company]: {
      title: [{ text: { content: job.company || "Unknown Company" } }],
    },
    [props.jobTitle]: {
      rich_text: [{ text: { content: job.title || "" } }],
    },
    [props.description]: {
      rich_text: [{ text: { content: fullDescription.slice(0, 2000) } }],
    },
    [props.location]: {
      rich_text: [{ text: { content: job.location || "" } }],
    },
    [props.link]: {
      url: pageUrl,
    },
    [props.lastUpdated]: {
      date: { start: now },
    },
    [props.stage]: {
      status: { name: job.stage || "To apply" },
    },
  };

  const resp = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(
      `Notion API error: ${err.message || resp.statusText}. ` +
        "Check that your integration has access to the database."
    );
  }

  return await resp.json();
}

// ── State ─────────────────────────────────────────────────────────────────────

let currentJob = null;
let notionPageUrl = null;
let pageUrl = null;

function populateForm(job) {
  currentJob = job;
  document.getElementById("f-title").value = job.title || "";
  document.getElementById("f-company").value = job.company || "";
  document.getElementById("f-location").value = job.location || "";
  document.getElementById("f-description").value = job.description || "";
  showState("state-review");
}

function readForm() {
  return {
    title: document.getElementById("f-title").value.trim(),
    company: document.getElementById("f-company").value.trim(),
    location: document.getElementById("f-location").value.trim(),
    description: document.getElementById("f-description").value.trim(),
    stage: document.getElementById("f-stage").value,
  };
}

// ── Main flow ─────────────────────────────────────────────────────────────────

async function run() {
  const settings = await getSettings();

  if (!settings.anthropicKey || !settings.notionToken || !settings.notionDatabaseId) {
    showState("state-setup");
    return;
  }

  setLoading("Reading page content…");

  // Get the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  pageUrl = tab.url;

  // Inject and run the extraction function in the page
  let pageData;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent,
    });
    pageData = results[0].result;
  } catch (e) {
    showError(`Could not read page: ${e.message}\n\nMake sure you're on a job posting page.`);
    return;
  }

  if (!pageData || pageData.text.length < 100) {
    showError(
      "Not enough text found on this page.\n\n" +
        "Make sure the job posting is fully loaded and you're logged in if required."
    );
    return;
  }

  setLoading("Extracting job info with Claude…");

  let job;
  try {
    job = await extractJobInfo(
      settings.anthropicKey,
      pageData.url,
      pageData.text,
      pageData.title
    );
  } catch (e) {
    showError(`Extraction failed: ${e.message}`);
    return;
  }

  populateForm(job);
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById("goToOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById("retryBtn").addEventListener("click", () => {
  run();
});

document.getElementById("retryFromError").addEventListener("click", () => {
  run();
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  const settings = await getSettings();
  const defaultProps = {
    company: "Company",
    jobTitle: "Job Title",
    description: "Description",
    location: "Location",
    link: "Link",
    lastUpdated: "Last Updated",
    stage: "Stage",
  };
  const props = { ...defaultProps, ...(settings.notionProps || {}) };

  const job = readForm();
  showState("state-saving");

  try {
    const page = await saveToNotion(
      settings.notionToken,
      settings.notionDatabaseId,
      props,
      job,
      pageUrl
    );
    notionPageUrl = page.url;
    document.getElementById("successCompany").textContent =
      `${job.title}${job.company ? " at " + job.company : ""}`;
    showState("state-success");
    setTimeout(() => window.close(), 2500);
  } catch (e) {
    showError(e.message);
  }
});


// ── Start ─────────────────────────────────────────────────────────────────────

run().catch((e) => showError(`Unexpected error: ${e.message}`));
