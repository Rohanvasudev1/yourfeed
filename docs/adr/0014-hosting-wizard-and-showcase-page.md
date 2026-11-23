# 14. Going live is the owner's checkpoint; the design argument gets its own page

Date: 2026-11-23 · Status: accepted

## Decision
- Creating the Google Cloud project, OAuth consent screen, test users, API key, Neon and Render accounts and secrets can only be done by the owner. One script (`scripts/setup-hosting`) walks through them, backed by a README runbook, `render.yaml` and `.env.example` entries. Every other piece works locally with the YouTube fake and SQLite. Spec 3 closes when the code is merged and green; going live waits for the owner to run the wizard.
- A **showcase page** (`/about`) argues the design case (recipe as contract, recipe mirror, outside your recipe, personalised by declaration not profiling) with live pieces of the demo embedded. The app itself stays a tool and isn't restyled.
