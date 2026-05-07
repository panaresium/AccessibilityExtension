# AccessiView Coding Agent Instructions

These rules apply to coding agents working in this repository.

## Pre-PR Verification

Before publishing a PR after code changes, run the blocking verification command:

```powershell
npm run validate
```

Do not publish a PR while this command fails. Fix the code, rerun the command, and report the final result.

Use `tests/ai-verification-policy.json` as the repository verification contract. It defines which checks are blocking, when live-site advisory checks are expected, and how failures should be handled.

## Live-Site Advisory Checks

Live website checks are useful for confidence, but they are not deterministic enough to block every PR by themselves. Use `tests/automation-coverage.json` to select public, non-mutating targets when a change affects page adaptation, reader detection, motion handling, forms, summaries, popup tab targeting, or site rules.

For live checks:

- Do not sign in, submit forms, post content, purchase items, or save user data.
- Treat consent prompts, paywalls, CAPTCHA, regional redirects, and anti-automation blocks as site conditions.
- If a live-site issue is reproducible and relevant, add or update a local fixture so future PRs catch it deterministically.
- If live checks cannot be run, state why in the PR summary or final response.

## Change Impact Rules

- `content.js`, `page-scroll.js`, and `shared/settings.js` changes require full `npm run validate` and focused review of affected fixture coverage.
- `popup.*`, `options.*`, and `background.js` changes require full `npm run validate` and manual attention to keyboard reachability, live-region status text, active-tab targeting, and extension context guards.
- `manifest.json` changes require full `npm run validate` and explicit permission/CSP review.
- Test-only changes require `npm run validate` unless the change is documentation-only.

## Failure Policy

Blocking failures must be fixed before publishing. Advisory live-site failures should be classified as one of:

- Extension regression: reproduce locally, fix, and add fixture coverage.
- Site condition: record as advisory with the website and reason.
- Known limitation: document only if the limitation is already accepted for the prototype.
