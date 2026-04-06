# GitHub Safe Push — Without Sensitive Files

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-initialise the local git repository and push to GitHub without committing sensitive files (.env, .claude/).

**Architecture:** Rotate compromised credentials first, then reset git history entirely (fresh `git init`), update `.gitignore` to exclude all sensitive files, then commit and push to the empty remote repo after the user deletes and recreates it on GitHub.

**Tech Stack:** Git, GitHub (HTTPS remote)

---

## Sensitive Files Identified

| File | Content | Action |
|------|---------|--------|
| `.env` | Supabase credentials | Exclude via `.gitignore` |
| `.claude/` | Claude Code local settings | Exclude entire folder via `.gitignore` |
| `supabase/config.toml` | Supabase project ID (hardcoded) | Commit intentionally — this is the local dev project config, not a secret key |

> ⚠️ The SQL migration files contain a hardcoded Supabase project URL inside function bodies. These are migration files that are intentional to commit (they define database structure). If the project URL is considered sensitive, those SQL function bodies should be parameterised before pushing — but this is out of scope of this plan.

---

## File Structure

- **Modify:** `.gitignore` — add rules to block `.env*`, `.claude/`, and other secrets
- **Create:** `.env.example` — safe placeholder reference for required variables
- **No other files** — only the `.gitignore` update and a fresh git history

---

### Task 0 (URGENT): Rotate the exposed Supabase credentials

> **Do this before anything else.** The previously pushed `.env` contained real API keys that are now compromised.

**Files:** None (action on Supabase dashboard)

- [ ] **Step 1: Go to the Supabase dashboard API settings**

  Navigate to your project → Settings → API (exact path is in your Supabase dashboard).

- [ ] **Step 2: Regenerate / rotate the API keys**

  Generate new keys. This invalidates the previously exposed ones.

- [ ] **Step 3: Update your local `.env` with the new values**

  Edit `.env` locally with the new credentials. This file stays local and is never committed.

---

### Task 1: Delete the compromised GitHub repository

**Files:** None (action on GitHub website)

- [ ] **Step 1: Go to the GitHub repository settings**

  Navigate to your repository → Settings → Danger Zone.

- [ ] **Step 2: Delete the repository**

  "Delete this repository" → confirm with repo name.

- [ ] **Step 3: Recreate the repository**

  Go to `https://github.com/new`, create a new repo named `kura-lab`:
  - Visibility: Public or Private (your choice)
  - **Do NOT** initialise with README, .gitignore, or license (leave it empty)

---

### Task 2: Update .gitignore to block sensitive files

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add sensitive file rules to `.gitignore`**

  Append the following block to the end of `.gitignore`:

  ```
  # Environment variables — NEVER commit these
  .env
  .env.*
  !.env.example

  # Claude Code local config — entire folder
  .claude/
  ```

- [ ] **Step 2: Verify the rules look correct**

  Run: `cat .gitignore`
  Expected: the new lines are present at the bottom, `.claude/` blocks the whole folder.

---

### Task 3: Create a .env.example file (safe reference)

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Create `.env.example` with placeholder values**

  Create the file with this content:

  ```
  # Supabase — replace with your project values
  VITE_SUPABASE_PROJECT_ID="your_project_id"
  VITE_SUPABASE_PUBLISHABLE_KEY="your_publishable_key"
  VITE_SUPABASE_URL="https://your_project_id.supabase.co"
  ```

  This file is safe to commit and helps other developers know which variables are needed.

---

### Task 4: Reset git history and create a clean initial commit

**Files:** All tracked project files (excluding the ones now in `.gitignore`)

- [ ] **Step 1: Delete the existing git history**

  ```bash
  cd D:/PERSONAL_PROJECTS/kura_official
  rm -rf .git
  ```

- [ ] **Step 2: Reinitialise git**

  ```bash
  git init
  git branch -M main
  ```

- [ ] **Step 3: Verify sensitive files are ignored**

  ```bash
  git status
  ```

  Check the output carefully:
  - `.env` must **NOT** appear
  - `.claude/` must **NOT** appear
  - `node_modules/` must **NOT** appear
  - `dist/` must **NOT** appear

  If any of those appear, fix `.gitignore` before continuing.

- [ ] **Step 4: Double-check with an explicit grep**

  ```bash
  git status | grep -E "\.env|\.claude|node_modules|dist/"
  ```

  Expected: **empty output**. If anything matches, do NOT proceed.

- [ ] **Step 5: Stage all safe files**

  ```bash
  git add .
  ```

- [ ] **Step 6: Final security check — confirm no secrets are staged**

  ```bash
  git diff --cached --name-only | grep -E "\.env|\.claude"
  ```

  Expected: **empty output**. If any file appears, run `git reset HEAD <file>` to unstage it.

- [ ] **Step 7: Create the initial commit**

  ```bash
  git commit -m "Initial commit — safe push without credentials"
  ```

---

### Task 5: Push to GitHub

**Files:** None (remote operation)

- [ ] **Step 1: Add the remote**

  ```bash
  git remote add origin https://github.com/LuisForasteiro/kura-lab.git
  ```

- [ ] **Step 2: Push to main**

  ```bash
  git push -u origin main
  ```

  Expected: `Branch 'main' set up to track 'origin/main'.`

- [ ] **Step 3: Verify on GitHub**

  Open `https://github.com/LuisForasteiro/kura-lab` and confirm:
  - `.env` is **not** present
  - `.claude/` is **not** present
  - `.env.example` is present
  - All source files (`src/`, `package.json`, etc.) are present

---

## Done ✓

The project is now on GitHub without any sensitive files. Future commits will automatically exclude `.env` and `.claude/` local configs.
