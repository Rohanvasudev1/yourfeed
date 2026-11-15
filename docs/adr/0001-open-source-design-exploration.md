# 1. Open source, demo first, but really usable

Date: 2026-11-15 · Status: accepted

## Context
Yourfeed explores how YouTube's custom-feeds idea could be designed. It isn't a product with a business behind it. The repo will be public on GitHub (MIT). It still has to be usable for real, not just a mockup.

## Decision
- One app with two modes: **demo mode** (no sign-in, mock catalog, works with no setup) and **signed-in mode** (real YouTube data).
- A hosted instance runs both. The README also documents self-hosting with your own keys.
- Name: Yourfeed. No YouTube logos or trademarks, plus a "Not affiliated with YouTube" line.
- `prototype/index.html` (the original mockup) is kept as the design reference until the port matches it.

## Consequences
- Every feature has to work against the mock catalog, which keeps it demoable and testable.
- No secrets in the repo. All keys come from environment variables, and `.env.example` documents them.
