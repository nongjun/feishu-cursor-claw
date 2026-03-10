---
name: github-web-actions
description: Use when navigating GitHub in a browser (searching repos, starring, opening repo pages).
---
# GitHub Web Actions

## Core workflow
- Open a browser first if the user did not specify the Github app.
- Always open a new tab before navigating the browser.
- Open GitHub webpage, then use the site search to find repositories or users.
- When asked to star a repo, open the repo page and toggle the Star button.

## Safety and checks
- If login is required, ask the user before proceeding.
- Confirm the Star button state (Starred vs Star) before moving on.
- Do not create issues, PRs, or comments unless explicitly requested.
