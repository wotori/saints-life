# Saints Life

- Read docs/architecture.md and docs/content-policy.md before changing domain data.
- Keep the person, veneration claim, commemoration, work, edition and published text separate.
- Never infer recognition by a church from a person's age or another church's calendar.
- Do not call an editorial summary a full historical text. Preserve edition and rights metadata.
- Do not turn an observed movable feast into an annual fixed date.
- Run npm run check, npm run build and npm run test:e2e after relevant changes.
- Read the relevant installed Next.js guide in node_modules/next/dist/docs before writing framework code.
- Do not use U+2014 or double hyphens as punctuation in project text. Technical CLI flags and CSS custom properties are allowed.
- No deployment, secrets changes, new production dependencies or broad architecture changes without the owner's request.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
