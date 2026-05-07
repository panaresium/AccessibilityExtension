# AccessiView Pre-PR Verification

This document translates the broader automation strategy into a coding-agent workflow.

## Required Gate

Run this before publishing a PR after code changes:

```powershell
npm run validate
```

This is the deterministic gate. It runs static syntax checks and the extension smoke runner against local fixtures. A PR should not be published while this command fails.

## Advisory Live-Site Checks

Use `tests/automation-coverage.json` for live exploratory checks when a change affects real-page behavior. Live websites are intentionally advisory because site layouts, consent prompts, anti-automation behavior, paywalls, and regional redirects can change independently of AccessiView.

Minimum live-site sampling for relevant changes:

- Pick at least one affected website category.
- Run at least one public, non-mutating website from each selected category.
- Prefer stable pages from documentation, reference, article, search, and public product-listing sites.
- Record blocked or unstable sites as advisory conditions.

## Failure Handling

- Deterministic failure: fix the code and rerun `npm run validate`.
- Reproducible live-site regression: create or update a local fixture that captures the broken pattern, fix the code, then rerun `npm run validate`.
- External site condition: report the website and reason, but do not treat it as a deterministic product failure.
- Skipped relevant check: report why it was skipped and what risk remains.

## Useful Future Enhancements

- Migrate the custom smoke runner into Playwright Test specs for per-feature reports.
- Add trace-on-retry and HTML reports for failing browser tests.
- Add axe scans for popup, options, local fixtures, and reader overlays.
- Add ARIA snapshots for extension UI and reader overlays.
- Add visual snapshots for contrast, focus reader, simplified page, guide overlay, and color filters.
- Add a generated live-site advisory runner that reads `tests/automation-coverage.json`.
