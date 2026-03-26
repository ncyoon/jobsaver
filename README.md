# Job Saver

A Chrome extension that saves job postings to Notion with one click. It uses Claude AI to automatically extract the job title, company, description, and location from any job page — no copy-pasting required.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)

## Demo

1. Navigate to a job posting on LinkedIn or JobRight.AI
2. Click the extension icon
3. Claude extracts the job details — review and edit if needed
4. Hit **Save to Notion** — the entry appears in your database instantly

## Features

- **AI extraction** — Claude parses unstructured job page content into structured fields (title, company, location, description, salary)
- **Editable before saving** — review and correct extracted fields before they hit Notion
- **Notion integration** — maps directly to your existing database columns with configurable property names
- **One-click workflow** — no copy-pasting, no switching tabs to fill in forms

## Tech Stack

- **Chrome Extensions API** (Manifest V3) — `chrome.scripting`, `chrome.storage`
- **Anthropic Claude API** — `claude-haiku` for fast, cheap job info extraction
- **Notion API** — creates pages in a configured database
- Vanilla JavaScript, no build step required

## Installation

This extension is not on the Chrome Web Store — you load it directly from the source.

1. Clone the repo
   ```bash
   git clone https://github.com/YOUR_USERNAME/job-saver.git
   ```

2. Open Chrome and go to `chrome://extensions`

3. Enable **Developer mode** (top right toggle)

4. Click **Load unpacked** and select the `job-saver` folder

5. Click the extension icon → gear icon → add your credentials:
   - **Anthropic API key** — [console.anthropic.com](https://console.anthropic.com)
   - **Notion integration token** — [notion.so/my-integrations](https://www.notion.so/my-integrations)
   - **Notion database ID** — from your database URL

## Notion Setup

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) → **New integration** → copy the token
2. Open your Notion jobs database → `...` → **Connections** → add your integration
3. Copy your database ID from the URL: `notion.so/workspace/`**`DATABASE_ID`**`?v=...`

Your database should have these columns (names are configurable in settings):

| Column | Type |
|---|---|
| Company | Title |
| Job Title | Text |
| Description | Text |
| Link | URL |
| Last Updated | Date |
| Stage | Status |
