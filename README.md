# AccessiView Prototype

AccessiView is a Chrome extension prototype for adapting web pages to user accessibility preferences.

## Prototype Features

- Focus mode reader overlay that renders a clean text-first view above the original site while preserving safe inline links for easier navigation.
- Optional legacy focus behavior with dim or hide distraction handling.
- Focus mode readable color controls for page background, text, and links.
- Simplified Page mode that keeps the detected main content and removes repeated navigation, sidebars, comments, and optional forms.
- High contrast themes with custom colors.
- Adjustable text size, line height, spacing, and font style.
- Reduce motion mode for animations, transitions, smooth scrolling, and autoplay media.
- Main-page and iframe coverage for embedded content where browser extension permissions allow it.
- Shadow DOM support for common text, motion, navigation, focus-media, autoplay, and missing-alt handling.
- Instant scrolling coverage for native smooth scroll, keyboard/page scrolling, wheel scrolling, Web Animations API motion, and common jQuery scroll animations.
- Reading guide that follows the cursor or keyboard focus, with band, ruler, and line styles.
- Navigation helpers for stronger focus rings, underlined links, larger targets, missing-alt image outlines, and a keyboard navigation map.
- Form Helper mode for required fields, invalid values, and unlabeled controls.
- Cognitive Support mode for reducing clutter, emphasizing headings, and chunking long text.
- Color filters for grayscale, warm, cool, brightness, contrast, and saturation tuning.
- Read aloud for selected text or detected page content, with automatic language-aware voice switching, shorter natural speech segments, optional subtle pauses, and current-speech highlighting.
- Read aloud transport controls for pause, resume, previous segment, and next segment.
- Local page summary panel that runs on the browser's on-device Summarizer API when available, falls back to offline extractive summarization, caches summaries locally, and can read the summary aloud.
- Accessibility Health scan in the popup with page-specific recommendations.
- Built-in site rule packs for difficult websites, including MSN, Thaiware, and Wikipedia-style article pages.
- Manual main-content picker that saves a selected content region for the current website.
- Undo for the last global or current-site settings change.
- Persistent Chrome/Edge Side Panel support so controls stay open while interacting with the page.
- Optional in-page quick button for opening the side panel and toggling Focus, Contrast, Motion, or page-level off.
- Popup quick controls and a full options page.
- Toggleable presets for low vision, focus, plain page, dyslexia, cognitive support, form filling, calm, night reading, keyboard use, motion safety, bilingual reading, reading comfort, and photosensitivity.
- Collapsible popup and options sections to keep long settings menus manageable.
- Per-website settings saved in local extension storage.
- Custom profiles saved in local extension storage, with apply/delete and JSON import/export.
- Popup diagnostics showing whether the reader overlay is active.
- Export and import global settings, the per-site settings cache, and custom profiles.

## How To Test In Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder:

   `C:\Users\CPC\OneDrive - AdroIT Co.,Ltd\Documents\New project`

5. Open any normal web page, then click the AccessiView extension icon.
6. Try a preset or enable individual modes.

Chrome does not allow extensions to run on `chrome://` pages or the Chrome Web Store, so test on regular `http` or `https` pages.

The toolbar popup closes automatically when you click the web page. Use **Open side panel** for persistent controls that remain visible while you interact with the site. Enable **Show page quick button** if you also want a small in-page AccessiView launcher.

## Per-Website Settings

Open the extension popup on a regular website and enable **Use separate settings for this website**. Changes made after that point are saved only for that hostname, for example `example.com`.

Use **Clear site** to remove the current website override and return to global settings. The options page export includes both global settings and saved website overrides.

The popup health scan can apply recommended changes as a site override. This keeps fixes for difficult websites local to that hostname instead of changing the global configuration.

Use **Pick main content** in the popup when the automatic reader chooses the wrong area. Click the main article or page region; AccessiView saves a CSS selector in the per-site cache and uses it before generic reader detection. Use **Clear pick** to remove that manual rule.

Built-in rule packs provide starter selectors for domains that commonly use complex layouts. Manual picks override the built-in main selector for that site.

## Local Summary

Use **Local Summary** in the popup or side panel to summarize the detected page text. The default engine is **Browser local AI, then offline fallback**:

- In browsers that expose the on-device Summarizer API, AccessiView asks the local browser model for a short, medium, or detailed summary.
- If the browser model is unavailable, AccessiView uses a local extractive fallback that ranks important sentences from the page without sending text to an API.
- Summary cache entries are stored in extension local storage and can be cleared from the options page.
- Summaries are blocked on pages that contain password, credit-card, CVV, or SSN fields.

This prototype does not bundle a Transformer model file yet. That keeps the extension lightweight; adding a bundled CPU/WASM model is possible later, but it needs model-size, startup-time, and update strategy decisions.

## Custom Profiles

Use **Custom Profiles** in the options page to save the current settings as a named profile. Profiles can be applied from the popup or options page, deleted, exported individually, or included in the full settings export.

## Regression Tests

The `tests` folder contains local fixture pages and a smoke-test runner. It loads a temporary copy of the unpacked extension, serves the fixtures, and validates core behavior.

Run it with:

```powershell
& 'C:\Users\CPC\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests/run-extension-smoke.js
```

The runner currently checks manifest wiring, reviewed extension permissions, unsafe CSP tokens, article simplification, missing-alt markers, form helper markers, cognitive chunking, the guide overlay, keyboard map, focus-reader link preservation, local extractive summaries, popup controls, and the automation coverage catalog.

`tests/automation-coverage.json` provides an automation-friendly feature test matrix, a category matrix with at least 20 public websites per category, and a curated catalog of common public websites for exploratory checks. Use it to plan broader AI-assisted browser testing, but keep live-site checks non-mutating: do not sign in, submit forms, post content, purchase items, or collect private data. Live website results should be treated as advisory because layouts, consent prompts, paywalls, and anti-automation behavior can change independently of the extension.

## Files

- `manifest.json` defines the Chrome extension.
- `content.js` applies accessibility changes to web pages.
- `popup.html`, `popup.css`, and `popup.js` provide quick controls.
- `options.html`, `options.css`, and `options.js` provide advanced settings.
- `shared/settings.js` stores defaults, presets, profile helpers, and settings helpers.
- `background.js` initializes default settings.
- `tests/fixtures/*.html` and `tests/run-extension-smoke.js` provide local regression coverage.
- `tests/automation-coverage.json` lists recommended feature cases and common public website targets for broader exploratory automation.

## Notes

This is a prototype. Canvas-only content, closed shadow DOM, DRM/video players, and browser-protected pages can still need site-specific handling in a production version.
