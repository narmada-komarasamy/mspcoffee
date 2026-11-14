<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## MSP Coffee development and deployment workflow

User instruction confirmed on 14 November 2026: use the established workflow for
all MSP Coffee app development, deployments, and bug fixes.

- Work in the existing MSP Coffee repository and follow its implementation and testing practices.
- Use the existing Supabase project for database changes and verify them.
- Commit the relevant changes and push to the existing GitHub repository.
- Use the existing Vercel project for deployment and verify the production result.
- Do not introduce another platform, deployment pipeline, coding CLI, or workflow,
  or ask the user to install or switch to one, unless the user explicitly requests
  or approves that change. In particular, do not redirect the user to a separate
  Terminal Codex session to complete work that should be done here.
- If the established workflow is blocked, explain the specific blocker and resolve
  it within that workflow. Ask before proposing a replacement.
- Preserve unrelated work and report deployment as complete only after verification.

## Imported Claude Cowork project instructions

## MSP Coffee instruction guides

For all MSPPROJECT instruction guides, follow the user-approved cream standard in
`docs/instruction-guides/README.md`. Use the retained official logo and approved
reference PDF in that directory. Default to English and Tamil, numbered steps,
actual privacy-safe screenshots, A4 pages, and print-friendly MSP Coffee branding.
Do not ask the user to choose white versus cream again unless they request a redesign.

## MSP Coffee app buttons

Follow the user-approved green primary/upload and cream secondary button standard in
`docs/button-standard.md` throughout MSP Coffee. Use the shared upload control or
shared button styles for new and updated actions. Keep destructive actions red.
