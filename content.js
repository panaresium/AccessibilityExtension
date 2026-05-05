(function initAccessiViewContent() {
  const {
    STORAGE_KEY,
    SITE_STORAGE_KEY,
    withDefaults,
    withSiteStore,
    getEffectiveSettings,
    hasSiteSettings,
    upsertSiteSettings,
    getSiteRule,
    upsertSiteRule,
    SUMMARY_CACHE_KEY,
    withSummaryCache,
    upsertSummaryCache
  } = globalThis.AccessiViewConfig;
  const ROOT_CLASSES = [
    "av-enabled",
    "av-mode-focus",
    "av-mode-contrast",
    "av-mode-text",
    "av-mode-motion",
    "av-mode-guide",
    "av-mode-navigation",
    "av-mode-simplify",
    "av-mode-forms",
    "av-mode-cognitive",
    "av-cognitive-hide-extras",
    "av-cognitive-emphasis",
    "av-cognitive-chunk",
    "av-mode-filter",
    "av-focus-hide",
    "av-focus-dim",
    "av-focus-sticky",
    "av-focus-text-only",
    "av-simplify-hide-nav",
    "av-simplify-hide-sidebars",
    "av-simplify-hide-forms",
    "av-simplify-hide-comments",
    "av-guide-band",
    "av-guide-ruler",
    "av-guide-line",
    "av-disable-animations",
    "av-reduce-scroll",
    "av-focus-ring",
    "av-underline-links",
    "av-larger-targets",
    "av-font-system",
    "av-font-dyslexia",
    "av-font-serif",
    "av-font-mono",
    "av-invert-images"
  ];
  const FOCUS_COLOR_IGNORED_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "META",
    "LINK",
    "IMG",
    "PICTURE",
    "VIDEO",
    "AUDIO",
    "IFRAME",
    "EMBED",
    "OBJECT",
    "CANVAS",
    "SVG",
    "PATH"
  ]);
  const FOCUS_MEDIA_SELECTOR = [
    "img",
    "picture",
    "source",
    "video",
    "audio",
    "iframe",
    "embed",
    "object",
    "canvas",
    "svg",
    "image",
    "amp-img",
    "amp-video",
    "amp-iframe",
    "amp-anim",
    "model-viewer",
    "video-js",
    "media-controller",
    "media-player",
    "mux-player",
    "wistia-player",
    "lite-youtube",
    "lite-vimeo",
    "lottie-player",
    "dotlottie-player",
    "spline-viewer",
    "[role='img']"
  ].join(",");
  const FOCUS_OVERRIDE_SELECTOR = [
    "[data-av-focus-color]",
    "[data-av-focus-media]",
    "[data-av-focus-background]"
  ].join(",");
  const CONTRAST_OVERRIDE_SELECTOR = "[data-av-contrast-color]";
  const SIMPLIFY_OVERRIDE_SELECTOR = [
    "[data-av-simplify-main]",
    "[data-av-simplify-chain]",
    "[data-av-simplify-hidden]"
  ].join(",");
  const FORM_HELPER_SELECTOR = [
    "[data-av-form-control]",
    "[data-av-form-required]",
    "[data-av-form-unlabeled]",
    "[data-av-form-invalid]",
    "[data-av-form-title]"
  ].join(",");
  const COGNITIVE_OVERRIDE_SELECTOR = [
    "[data-av-cognitive-main]",
    "[data-av-cognitive-clutter]",
    "[data-av-cognitive-paragraph]"
  ].join(",");
  const KEYBOARD_FOCUSABLE_SELECTOR = [
    "a[href]",
    "button",
    "input:not([type='hidden'])",
    "select",
    "textarea",
    "summary",
    "details",
    "[tabindex]:not([tabindex='-1'])",
    "[role='button']",
    "[role='link']",
    "[role='menuitem']",
    "[role='checkbox']",
    "[role='radio']",
    "[contenteditable='true']"
  ].join(",");
  const READER_CANDIDATE_SELECTOR = [
    "article",
    "main",
    "[role='main']",
    "[itemprop='articleBody']",
    ".article",
    ".article-body",
    ".article-content",
    ".entry-content",
    ".post-content",
    ".story-body",
    ".content",
    "#content",
    "#main",
    "section",
    "div"
  ].join(",");
  const READER_NEGATIVE_PATTERN = /\b(ad|ads|advert|app|banner|breadcrumb|comment|cookie|dialog|footer|game|games|header|hero|login|market|menu|modal|nav|newsletter|paywall|promo|quote|related|search|share|shopping|shortcut|sidebar|social|sponsor|stock|stripe|subscribe|ticker|toolbar|weather|widget)\b/i;
  const READER_POSITIVE_PATTERN = /\b(article|body|content|entry|main|post|reader|story|text)\b/i;
  const FORM_CONTROL_SELECTOR = "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset']), select, textarea";
  const COGNITIVE_CLUTTER_PATTERN = /\b(ad|advert|banner|breadcrumb|comment|cookie|footer|menu|modal|nav|newsletter|promo|related|share|sidebar|social|sponsor|subscribe|ticker|toolbar|widget)\b/i;
  const SHADOW_STYLE_ID = "accessiview-shadow-style";
  const IS_TOP_FRAME = (() => {
    try {
      return window.self === window.top;
    } catch (_error) {
      return false;
    }
  })();

  let globalSettings = withDefaults({});
  let siteStore = withSiteStore({});
  let settings = withDefaults({});
  let usingSiteSettings = false;
  let guideElement = null;
  let mediaObserver = null;
  let mediaObservedTargets = new WeakSet();
  let mediaPlayObservedRoots = new WeakSet();
  let altObserver = null;
  let altObservedTargets = new WeakSet();
  let scrollOverridesInstalled = false;
  let originalScrollMethods = null;
  let shadowStyleObserver = null;
  let shadowStyleObserverTimer = null;
  let shadowStyleScanTimer = null;
  let shadowStyleScanCount = 0;
  let contrastObserver = null;
  let contrastObserverTimer = null;
  let contrastObservedTargets = new WeakSet();
  let contrastStyleCache = new WeakMap();
  let focusObserver = null;
  let focusObserverTimer = null;
  let focusObservedTargets = new WeakSet();
  let focusReaderRefreshTimers = [];
  let focusStyleCache = new WeakMap();
  let readerHost = null;
  let simplifyObserver = null;
  let simplifyObserverTimer = null;
  let simplifyObservedTargets = new WeakSet();
  let formObserver = null;
  let formObservedTargets = new WeakSet();
  let cognitiveObserver = null;
  let cognitiveObserverTimer = null;
  let cognitiveObservedTargets = new WeakSet();
  let keyboardMapHost = null;
  let speechHighlightHost = null;
  let contentPickerHost = null;
  let contentPickerResponse = null;
  let contentPickerTarget = null;
  let quickButtonHost = null;
  let pageStatus = {
    focusReaderActive: false,
    readerBlocks: 0,
    readerTitle: "",
    usingSiteSettings: false
  };
  let lastMouseY = Math.round(window.innerHeight / 2);
  let speechSessionId = 0;
  let speechPauseTimer = null;
  let activeSpeech = null;

  function boot() {
    chrome.storage.sync.get(STORAGE_KEY, (syncResult) => {
      globalSettings = withDefaults(syncResult[STORAGE_KEY]);
      chrome.storage.local.get(SITE_STORAGE_KEY, (localResult) => {
        siteStore = withSiteStore(localResult[SITE_STORAGE_KEY]);
        refreshEffectiveSettings();
      });
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      let shouldRefresh = false;

      if (area === "sync" && changes[STORAGE_KEY]) {
        globalSettings = withDefaults(changes[STORAGE_KEY].newValue);
        shouldRefresh = true;
      }

      if (area === "local" && changes[SITE_STORAGE_KEY]) {
        siteStore = withSiteStore(changes[SITE_STORAGE_KEY].newValue);
        shouldRefresh = true;
      }

      if (!shouldRefresh) {
        return;
      }

      refreshEffectiveSettings();
    });

    if (IS_TOP_FRAME) {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (!message || !message.type) {
          return false;
        }

        if (message.type === "ACCESSIVIEW_APPLY_SETTINGS") {
          settings = withDefaults(message.settings);
          usingSiteSettings = Boolean(message.scope === "site");
          applySettings();
          sendResponse({ ok: true });
          return false;
        }

        if (message.type === "ACCESSIVIEW_REFRESH_SETTINGS") {
          refreshEffectiveSettings();
          sendResponse({ ok: true, usingSiteSettings });
          return false;
        }

        if (message.type === "ACCESSIVIEW_GET_STATUS") {
          const siteRule = getCurrentSiteRule();
          sendResponse({
            ok: true,
            url: window.location.href,
            usingSiteSettings,
            siteRule: siteRule ? {
              label: siteRule.label || "Site rule",
              source: siteRule.source || "built-in",
              mainSelector: siteRule.mainSelector || ""
            } : null,
            focusReaderActive: pageStatus.focusReaderActive,
            readerBlocks: pageStatus.readerBlocks,
            readerTitle: pageStatus.readerTitle
          });
          return false;
        }

        if (message.type === "ACCESSIVIEW_GET_AUDIT") {
          sendResponse({
            ok: true,
            audit: runAccessibilityAudit()
          });
          return false;
        }

        if (message.type === "ACCESSIVIEW_SUMMARIZE_PAGE") {
          summarizeCurrentPage(message.options || {})
            .then(sendResponse)
            .catch(() => sendResponse({ ok: false, message: "Local summary failed on this page." }));
          return true;
        }

        if (message.type === "ACCESSIVIEW_READ_TEXT") {
          readProvidedText(message.text || "", message.label || "text")
            .then(sendResponse)
            .catch(() => sendResponse({ ok: false, message: "Read aloud failed for this text." }));
          return true;
        }

        if (message.type === "ACCESSIVIEW_START_CONTENT_PICKER") {
          startContentPicker(sendResponse);
          return true;
        }

        if (message.type === "ACCESSIVIEW_READ") {
          readCurrentPage()
            .then(sendResponse)
            .catch(() => sendResponse({ ok: false, message: "Read aloud failed on this page." }));
          return true;
        }

        if (message.type === "ACCESSIVIEW_PAUSE_READING") {
          sendResponse(pauseSpeech());
          return false;
        }

        if (message.type === "ACCESSIVIEW_RESUME_READING") {
          sendResponse(resumeSpeech());
          return false;
        }

        if (message.type === "ACCESSIVIEW_PREVIOUS_READING") {
          sendResponse(skipSpeech(-1));
          return false;
        }

        if (message.type === "ACCESSIVIEW_NEXT_READING") {
          sendResponse(skipSpeech(1));
          return false;
        }

        if (message.type === "ACCESSIVIEW_GET_SPEECH_STATUS") {
          sendResponse(getSpeechStatus());
          return false;
        }

        if (message.type === "ACCESSIVIEW_STOP_READING") {
          stopSpeech();
          sendResponse({ ok: true });
          return false;
        }

        if (message.type === "ACCESSIVIEW_TOGGLE_KEYBOARD_MAP") {
          toggleKeyboardMap();
          sendResponse({ ok: true });
          return false;
        }

        return false;
      });
    }
  }

  function refreshEffectiveSettings() {
    const settingsUrl = getSettingsUrl();
    settings = getEffectiveSettings(globalSettings, siteStore, settingsUrl);
    usingSiteSettings = hasSiteSettings(siteStore, settingsUrl);
    pageStatus.usingSiteSettings = usingSiteSettings;
    applySettings();
  }

  function getSettingsUrl() {
    if (IS_TOP_FRAME) {
      return window.location.href;
    }

    try {
      return window.top.location.href || window.location.href;
    } catch (_error) {
      return document.referrer || window.location.href;
    }
  }

  function applySettings() {
    resetRootClasses();
    clearFocusMarks();
    applyRootState();

    if (!settings.enabled) {
      removeFocusReaderOverlay();
      removeSpeechHighlight();
      removeKeyboardMap();
      removeQuickButton();
      removeDynamicStyle();
      removeGuide();
      restoreContrastOverrides();
      clearSimplifyMarks();
      clearFormHelpers();
      clearCognitiveMarks();
      disconnectObservers();
      return;
    }

    writeDynamicStyle();

    updateContrastOverrides();
    updateMotionControls();
    updateFocusMode();
    updateSimplifyMode();
    updateGuide();
    updateMediaControls();
    updateAltWarnings();
    updateFormHelpers();
    updateCognitiveMode();
    updateKeyboardMap();
    updateQuickButton();
  }

  function resetRootClasses() {
    ROOT_CLASSES.forEach((className) => document.documentElement.classList.remove(className));
  }

  function updateContrastOverrides() {
    const shouldApply =
      settings.enabled &&
      settings.modes.contrast.enabled &&
      !(settings.modes.focus.enabled && settings.modes.focus.textOnly);

    if (!shouldApply) {
      stopContrastObserver();
      restoreContrastOverrides();
      return;
    }

    applyContrastOverrides(resolveContrast(settings.modes.contrast));
    startContrastObserver();
  }

  function applyContrastOverrides(contrastColors) {
    getQueryableRoots().forEach((root) => {
      const targets = [root === document ? document.body : null]
        .concat(Array.from(root.querySelectorAll("*")))
        .filter(Boolean);

      targets.forEach((element) => {
        if (shouldSkipContrastElement(element)) {
          return;
        }

        if (!contrastStyleCache.has(element)) {
          contrastStyleCache.set(element, element.getAttribute("style"));
        }

        element.setAttribute("data-av-contrast-color", "true");

        const isFormControl = element.matches("input, textarea, select, button");
        const isLink = Boolean(element.closest("a"));
        const readableColor = isLink ? contrastColors.link : contrastColors.text;
        const backgroundColor = element === document.body || element === document.documentElement
          ? contrastColors.background
          : isFormControl
            ? contrastColors.surface
            : "transparent";

        element.style.setProperty("color", readableColor, "important");
        element.style.setProperty("-webkit-text-fill-color", readableColor, "important");
        element.style.setProperty("caret-color", readableColor, "important");
        element.style.setProperty("background-color", backgroundColor, "important");
        element.style.setProperty("background-image", "none", "important");
        element.style.setProperty("border-color", contrastColors.border, "important");
        element.style.setProperty("text-shadow", "none", "important");
        element.style.setProperty("box-shadow", "none", "important");
        element.style.setProperty("forced-color-adjust", "none", "important");
      });
    });
  }

  function shouldSkipContrastElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE || element.id === "accessiview-reader-host") {
      return true;
    }

    return FOCUS_COLOR_IGNORED_TAGS.has(element.tagName);
  }

  function restoreContrastOverrides() {
    getQueryableRoots().forEach((root) => {
      root.querySelectorAll(CONTRAST_OVERRIDE_SELECTOR).forEach((element) => {
        const originalStyle = contrastStyleCache.get(element);

        if (typeof originalStyle === "string") {
          element.setAttribute("style", originalStyle);
        } else {
          element.removeAttribute("style");
        }

        element.removeAttribute("data-av-contrast-color");
      });
    });

    contrastStyleCache = new WeakMap();
  }

  function startContrastObserver() {
    if (contrastObserver) {
      observeContrastRoots();
      return;
    }

    if (!document.body) {
      return;
    }

    contrastObserver = new MutationObserver(() => {
      clearTimeout(contrastObserverTimer);
      contrastObserverTimer = setTimeout(() => {
        contrastObserverTimer = null;
        if (settings.enabled && settings.modes.contrast.enabled) {
          observeContrastRoots();
          applyContrastOverrides(resolveContrast(settings.modes.contrast));
        }
      }, 120);
    });

    observeContrastRoots();
  }

  function observeContrastRoots() {
    if (!contrastObserver || !document.body) {
      return;
    }

    getQueryableRoots().forEach((root) => {
      const target = root === document ? document.body : root;
      if (target && !contrastObservedTargets.has(target)) {
        contrastObserver.observe(target, { childList: true, subtree: true });
        contrastObservedTargets.add(target);
      }
    });
  }

  function stopContrastObserver() {
    if (contrastObserver) {
      contrastObserver.disconnect();
      contrastObserver = null;
    }

    contrastObservedTargets = new WeakSet();

    if (contrastObserverTimer) {
      clearTimeout(contrastObserverTimer);
      contrastObserverTimer = null;
    }
  }

  function applyRootState() {
    const root = document.documentElement;
    const modes = settings.modes;

    ROOT_CLASSES.forEach((className) => root.classList.remove(className));

    if (!settings.enabled) {
      return;
    }

    root.classList.add("av-enabled");
    root.classList.toggle("av-mode-focus", modes.focus.enabled);
    root.classList.toggle("av-mode-contrast", modes.contrast.enabled);
    root.classList.toggle("av-mode-text", modes.text.enabled);
    root.classList.toggle("av-mode-motion", modes.motion.enabled);
    root.classList.toggle("av-mode-guide", modes.guide.enabled);
    root.classList.toggle("av-mode-navigation", modes.navigation.enabled);
    root.classList.toggle("av-mode-simplify", modes.simplify.enabled);
    root.classList.toggle("av-mode-forms", modes.forms.enabled);
    root.classList.toggle("av-mode-cognitive", modes.cognitive.enabled);
    root.classList.toggle("av-cognitive-hide-extras", modes.cognitive.enabled && modes.cognitive.hideExtras);
    root.classList.toggle("av-cognitive-emphasis", modes.cognitive.enabled && modes.cognitive.emphasizeHeadings);
    root.classList.toggle("av-cognitive-chunk", modes.cognitive.enabled && modes.cognitive.chunkText);
    root.classList.toggle("av-mode-filter", modes.filter.enabled);
    root.classList.toggle("av-focus-hide", modes.focus.enabled && modes.focus.distractionMode === "hide");
    root.classList.toggle("av-focus-dim", modes.focus.enabled && modes.focus.distractionMode === "dim");
    root.classList.toggle("av-focus-sticky", modes.focus.enabled && modes.focus.hideSticky);
    root.classList.toggle("av-focus-text-only", modes.focus.enabled && modes.focus.textOnly);
    root.classList.toggle("av-simplify-hide-nav", modes.simplify.enabled && modes.simplify.hideNav);
    root.classList.toggle("av-simplify-hide-sidebars", modes.simplify.enabled && modes.simplify.hideSidebars);
    root.classList.toggle("av-simplify-hide-forms", modes.simplify.enabled && modes.simplify.hideForms);
    root.classList.toggle("av-simplify-hide-comments", modes.simplify.enabled && modes.simplify.hideComments);
    root.classList.toggle("av-guide-band", modes.guide.enabled && modes.guide.style === "band");
    root.classList.toggle("av-guide-ruler", modes.guide.enabled && modes.guide.style === "ruler");
    root.classList.toggle("av-guide-line", modes.guide.enabled && modes.guide.style === "line");
    root.classList.toggle("av-disable-animations", modes.motion.enabled && modes.motion.disableAnimations);
    root.classList.toggle("av-reduce-scroll", modes.motion.enabled && modes.motion.reduceScrolling);
    root.classList.toggle("av-focus-ring", modes.navigation.enabled && modes.navigation.focusRing);
    root.classList.toggle("av-underline-links", modes.navigation.enabled && modes.navigation.underlineLinks);
    root.classList.toggle("av-larger-targets", modes.navigation.enabled && modes.navigation.largerTargets);
    root.classList.toggle("av-invert-images", modes.contrast.enabled && modes.contrast.invertImages);
    root.classList.add(`av-font-${modes.text.fontFamily}`);

    const contrast = resolveContrast(modes.contrast);
    const focusColors = resolveFocusColors(modes.focus);
    const simplifyColors = resolveFocusColors(modes.simplify);
    root.style.setProperty("--av-bg", contrast.background);
    root.style.setProperty("--av-surface", contrast.surface);
    root.style.setProperty("--av-text", contrast.text);
    root.style.setProperty("--av-link", contrast.link);
    root.style.setProperty("--av-border", contrast.border);
    root.style.setProperty("--av-focus-width", `${modes.focus.maxWidth}px`);
    root.style.setProperty("--av-focus-dim-opacity", String(modes.focus.dimOpacity));
    root.style.setProperty("--av-focus-bg", focusColors.background);
    root.style.setProperty("--av-focus-text", focusColors.text);
    root.style.setProperty("--av-focus-link", focusColors.link);
    root.style.setProperty("--av-simplify-width", `${modes.simplify.maxWidth}px`);
    root.style.setProperty("--av-simplify-bg", simplifyColors.background);
    root.style.setProperty("--av-simplify-text", simplifyColors.text);
    root.style.setProperty("--av-simplify-link", simplifyColors.link);
    root.style.setProperty("--av-cognitive-width", `${modes.cognitive.maxWidth}px`);
    root.style.setProperty("--av-text-scale", String(modes.text.scale / 100));
    root.style.setProperty("--av-line-height", String(modes.text.lineHeight));
    root.style.setProperty("--av-letter-spacing", `${modes.text.letterSpacing}em`);
    root.style.setProperty("--av-word-spacing", `${modes.text.wordSpacing}em`);
    root.style.setProperty("--av-paragraph-spacing", `${modes.text.paragraphSpacing}em`);
    root.style.setProperty("--av-guide-height", `${modes.guide.height}px`);
    root.style.setProperty("--av-guide-color", modes.guide.color);
    root.style.setProperty("--av-guide-opacity", String(modes.guide.opacity));
    root.style.setProperty("--av-page-filter", getFilterValue(modes.filter));
  }

  function resolveContrast(contrast) {
    const presets = {
      dark: {
        background: "#050505",
        surface: "#111827",
        text: "#ffffff",
        link: "#7dd3fc",
        border: "#facc15"
      },
      light: {
        background: "#ffffff",
        surface: "#f3f4f6",
        text: "#000000",
        link: "#0645ad",
        border: "#111827"
      },
      yellow: {
        background: "#000000",
        surface: "#111111",
        text: "#fff176",
        link: "#80d8ff",
        border: "#fff176"
      },
      custom: contrast
    };

    return ensureReadablePalette(presets[contrast.preset] || presets.dark);
  }

  function ensureReadablePalette(palette) {
    const background = palette.background || "#050505";
    const surface = palette.surface || background;
    let text = palette.text || "#ffffff";
    let link = palette.link || "#7dd3fc";
    let border = palette.border || text;

    if (contrastRatio(background, text) < 4.5) {
      text = contrastRatio(background, "#111827") >= contrastRatio(background, "#ffffff") ? "#111827" : "#ffffff";
    }

    if (contrastRatio(background, link) < 3) {
      link = contrastRatio(background, "#0645ad") >= contrastRatio(background, "#7dd3fc") ? "#0645ad" : "#7dd3fc";
    }

    if (contrastRatio(background, border) < 3) {
      border = text;
    }

    return { background, surface, text, link, border };
  }

  function resolveFocusColors(focus) {
    const background = focus.background || "#ffffff";
    let text = focus.text || "#111827";
    let link = focus.link || "#0645ad";

    if (contrastRatio(background, text) < 4.5) {
      text = contrastRatio(background, "#111827") >= contrastRatio(background, "#ffffff") ? "#111827" : "#ffffff";
    }

    if (contrastRatio(background, link) < 3) {
      link = contrastRatio(background, "#0645ad") >= contrastRatio(background, "#7dd3fc") ? "#0645ad" : "#7dd3fc";
    }

    return { background, text, link };
  }

  function getReaderChromeColors(focusColors) {
    const textRgb = hexToRgb(focusColors.text);
    const textAlpha = (opacity) => `rgba(${textRgb.r}, ${textRgb.g}, ${textRgb.b}, ${opacity})`;
    const isDarkBackground = relativeLuminance(hexToRgb(focusColors.background)) < 0.4;

    return {
      colorScheme: isDarkBackground ? "dark" : "light",
      divider: textAlpha(isDarkBackground ? 0.3 : 0.18),
      subtleSurface: textAlpha(isDarkBackground ? 0.12 : 0.06),
      subtleBorder: textAlpha(isDarkBackground ? 0.38 : 0.22),
      sourceOpacity: isDarkBackground ? 0.84 : 0.72
    };
  }

  function contrastRatio(firstColor, secondColor) {
    const first = relativeLuminance(hexToRgb(firstColor));
    const second = relativeLuminance(hexToRgb(secondColor));
    const lighter = Math.max(first, second);
    const darker = Math.min(first, second);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function hexToRgb(color) {
    const normalized = String(color || "").replace("#", "").trim();
    const full = normalized.length === 3
      ? normalized.split("").map((character) => character + character).join("")
      : normalized;
    const value = Number.parseInt(full, 16);

    if (!Number.isFinite(value)) {
      return { r: 255, g: 255, b: 255 };
    }

    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255
    };
  }

  function relativeLuminance(rgb) {
    const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });

    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }

  function getFilterValue(filter) {
    const presetAdjustments = {
      none: {},
      grayscale: { grayscale: 100, saturation: 90 },
      warm: { sepia: Math.max(filter.sepia, 8), saturation: Math.min(filter.saturation, 90) },
      cool: { sepia: 0, saturation: Math.min(filter.saturation, 90), brightness: Math.max(filter.brightness, 102) }
    };
    const adjusted = Object.assign({}, filter, presetAdjustments[filter.preset] || {});

    return [
      `grayscale(${adjusted.grayscale}%)`,
      `saturate(${adjusted.saturation}%)`,
      `brightness(${adjusted.brightness}%)`,
      `contrast(${adjusted.contrast}%)`,
      `sepia(${adjusted.sepia}%)`
    ].join(" ");
  }

  function writeDynamicStyle() {
    let style = document.getElementById("accessiview-style");

    if (!style) {
      style = document.createElement("style");
      style.id = "accessiview-style";
      document.documentElement.appendChild(style);
    }

    style.textContent = `
html.av-enabled.av-mode-text body {
  font-size: calc(1rem * var(--av-text-scale)) !important;
  line-height: var(--av-line-height) !important;
}

html.av-enabled.av-mode-text body,
html.av-enabled.av-mode-text body *:not(svg):not(path) {
  letter-spacing: var(--av-letter-spacing) !important;
  word-spacing: var(--av-word-spacing) !important;
}

html.av-enabled.av-mode-text p,
html.av-enabled.av-mode-text li,
html.av-enabled.av-mode-text blockquote,
html.av-enabled.av-mode-text dd {
  margin-bottom: var(--av-paragraph-spacing) !important;
}

html.av-enabled.av-mode-text.av-font-system body,
html.av-enabled.av-mode-text.av-font-system body *:not(code):not(pre):not(kbd):not(samp) {
  font-family: Arial, Helvetica, sans-serif !important;
}

html.av-enabled.av-mode-text.av-font-dyslexia body,
html.av-enabled.av-mode-text.av-font-dyslexia body *:not(code):not(pre):not(kbd):not(samp) {
  font-family: Verdana, Tahoma, Arial, sans-serif !important;
}

html.av-enabled.av-mode-text.av-font-serif body,
html.av-enabled.av-mode-text.av-font-serif body *:not(code):not(pre):not(kbd):not(samp) {
  font-family: Georgia, "Times New Roman", serif !important;
}

html.av-enabled.av-mode-text.av-font-mono body,
html.av-enabled.av-mode-text.av-font-mono body * {
  font-family: Consolas, "Courier New", monospace !important;
}

html.av-enabled.av-mode-contrast,
html.av-enabled.av-mode-contrast body {
  background: var(--av-bg) !important;
  color: var(--av-text) !important;
  -webkit-text-fill-color: var(--av-text) !important;
  caret-color: var(--av-text) !important;
  forced-color-adjust: none !important;
}

html.av-enabled.av-mode-contrast body :not(img):not(video):not(canvas):not(svg):not(path):not(#accessiview-reading-guide) {
  background-color: transparent !important;
  color: var(--av-text) !important;
  -webkit-text-fill-color: var(--av-text) !important;
  caret-color: var(--av-text) !important;
  border-color: var(--av-border) !important;
  text-shadow: none !important;
  box-shadow: none !important;
  forced-color-adjust: none !important;
}

html.av-enabled.av-mode-contrast main,
html.av-enabled.av-mode-contrast article,
html.av-enabled.av-mode-contrast section,
html.av-enabled.av-mode-contrast aside,
html.av-enabled.av-mode-contrast header,
html.av-enabled.av-mode-contrast footer,
html.av-enabled.av-mode-contrast nav {
  background-color: var(--av-bg) !important;
}

html.av-enabled.av-mode-contrast input,
html.av-enabled.av-mode-contrast textarea,
html.av-enabled.av-mode-contrast select,
html.av-enabled.av-mode-contrast button {
  background-color: var(--av-surface) !important;
  color: var(--av-text) !important;
  -webkit-text-fill-color: var(--av-text) !important;
  caret-color: var(--av-text) !important;
  border: 2px solid var(--av-border) !important;
}

html.av-enabled.av-mode-contrast a,
html.av-enabled.av-mode-contrast a * {
  color: var(--av-link) !important;
  -webkit-text-fill-color: var(--av-link) !important;
  text-decoration: underline !important;
  text-decoration-thickness: 0.12em !important;
  text-underline-offset: 0.16em !important;
}

html.av-enabled.av-mode-contrast ::placeholder {
  color: var(--av-text) !important;
  -webkit-text-fill-color: var(--av-text) !important;
  opacity: 0.78 !important;
}

html.av-enabled.av-mode-contrast.av-invert-images img,
html.av-enabled.av-mode-contrast.av-invert-images video {
  filter: invert(1) hue-rotate(180deg) !important;
}

html.av-enabled.av-mode-motion.av-disable-animations *,
html.av-enabled.av-mode-motion.av-disable-animations *::before,
html.av-enabled.av-mode-motion.av-disable-animations *::after {
  animation-duration: 0.001ms !important;
  animation-iteration-count: 1 !important;
  animation-name: none !important;
  scroll-behavior: auto !important;
  transition-duration: 0.001ms !important;
  transition-property: none !important;
}

html.av-enabled.av-mode-motion.av-reduce-scroll,
html.av-enabled.av-mode-motion.av-reduce-scroll *,
html.av-enabled.av-mode-motion.av-reduce-scroll *::before,
html.av-enabled.av-mode-motion.av-reduce-scroll *::after {
  scroll-behavior: auto !important;
}

html.av-enabled.av-mode-focus:not(.av-focus-text-only) body > :not([data-av-main-chain]):not(#accessiview-reading-guide):not(#accessiview-style) {
  transition: opacity 160ms ease !important;
}

html.av-enabled.av-mode-focus.av-focus-hide:not(.av-focus-text-only) body > :not([data-av-main-chain]):not(#accessiview-reading-guide):not(#accessiview-style) {
  display: none !important;
}

html.av-enabled.av-mode-focus.av-focus-dim:not(.av-focus-text-only) body > :not([data-av-main-chain]):not(#accessiview-reading-guide):not(#accessiview-style) {
  opacity: var(--av-focus-dim-opacity) !important;
  filter: grayscale(1) blur(1px) !important;
}

html.av-enabled.av-mode-focus [data-av-main="true"] {
  box-sizing: border-box !important;
  max-width: var(--av-focus-width) !important;
  margin-left: auto !important;
  margin-right: auto !important;
  padding: clamp(18px, 4vw, 44px) !important;
  background: var(--av-focus-bg) !important;
  color: var(--av-focus-text) !important;
  -webkit-text-fill-color: var(--av-focus-text) !important;
  caret-color: var(--av-focus-text) !important;
  forced-color-adjust: none !important;
  outline: 3px solid rgba(245, 158, 11, 0.28) !important;
  outline-offset: 8px !important;
}

html.av-enabled.av-mode-focus body,
html.av-enabled.av-mode-focus [data-av-main="true"],
html.av-enabled.av-mode-focus [data-av-main="true"] *:not(svg):not(path) {
  background-color: var(--av-focus-bg) !important;
  background-image: none !important;
  color: var(--av-focus-text) !important;
  -webkit-text-fill-color: var(--av-focus-text) !important;
  caret-color: var(--av-focus-text) !important;
  forced-color-adjust: none !important;
  text-shadow: none !important;
}

html.av-enabled.av-mode-focus.av-focus-text-only body *,
html.av-enabled.av-mode-focus.av-focus-text-only body *::before,
html.av-enabled.av-mode-focus.av-focus-text-only body *::after {
  background-image: none !important;
}

html.av-enabled.av-mode-focus [data-av-main="true"] *::before,
html.av-enabled.av-mode-focus [data-av-main="true"] *::after {
  color: var(--av-focus-text) !important;
  -webkit-text-fill-color: var(--av-focus-text) !important;
  text-shadow: none !important;
}

html.av-enabled.av-mode-focus [data-av-main="true"] a,
html.av-enabled.av-mode-focus [data-av-main="true"] a * {
  color: var(--av-focus-link) !important;
  -webkit-text-fill-color: var(--av-focus-link) !important;
  text-decoration: underline !important;
  text-decoration-thickness: 0.1em !important;
  text-underline-offset: 0.16em !important;
}

html.av-enabled.av-mode-focus.av-focus-text-only img,
html.av-enabled.av-mode-focus.av-focus-text-only picture,
html.av-enabled.av-mode-focus.av-focus-text-only video,
html.av-enabled.av-mode-focus.av-focus-text-only audio,
html.av-enabled.av-mode-focus.av-focus-text-only iframe,
html.av-enabled.av-mode-focus.av-focus-text-only embed,
html.av-enabled.av-mode-focus.av-focus-text-only object,
html.av-enabled.av-mode-focus.av-focus-text-only canvas,
html.av-enabled.av-mode-focus.av-focus-text-only svg {
  display: none !important;
}

html.av-enabled.av-mode-focus.av-focus-sticky:not(.av-focus-text-only) [style*="position: fixed"],
html.av-enabled.av-mode-focus.av-focus-sticky:not(.av-focus-text-only) [style*="position:fixed"],
html.av-enabled.av-mode-focus.av-focus-sticky:not(.av-focus-text-only) [style*="position: sticky"],
html.av-enabled.av-mode-focus.av-focus-sticky:not(.av-focus-text-only) [style*="position:sticky"] {
  position: static !important;
}

html.av-enabled.av-mode-simplify body {
  background: var(--av-simplify-bg) !important;
  color: var(--av-simplify-text) !important;
  -webkit-text-fill-color: var(--av-simplify-text) !important;
  text-shadow: none !important;
}

html.av-enabled.av-mode-simplify body > :not([data-av-simplify-chain]):not(#accessiview-reading-guide):not(#accessiview-style) {
  display: none !important;
}

html.av-enabled.av-mode-simplify [data-av-simplify-main="true"] {
  box-sizing: border-box !important;
  max-width: var(--av-simplify-width) !important;
  margin-left: auto !important;
  margin-right: auto !important;
  padding: clamp(18px, 4vw, 42px) !important;
  background: var(--av-simplify-bg) !important;
  color: var(--av-simplify-text) !important;
  -webkit-text-fill-color: var(--av-simplify-text) !important;
}

html.av-enabled.av-mode-simplify [data-av-simplify-main="true"],
html.av-enabled.av-mode-simplify [data-av-simplify-main="true"] *:not(svg):not(path) {
  background-color: var(--av-simplify-bg) !important;
  background-image: none !important;
  color: var(--av-simplify-text) !important;
  -webkit-text-fill-color: var(--av-simplify-text) !important;
  text-shadow: none !important;
}

html.av-enabled.av-mode-simplify [data-av-simplify-main="true"] a,
html.av-enabled.av-mode-simplify [data-av-simplify-main="true"] a * {
  color: var(--av-simplify-link) !important;
  -webkit-text-fill-color: var(--av-simplify-link) !important;
  text-decoration: underline !important;
}

html.av-enabled.av-mode-simplify.av-simplify-hide-nav nav,
html.av-enabled.av-mode-simplify.av-simplify-hide-nav [role="navigation"],
html.av-enabled.av-mode-simplify.av-simplify-hide-nav [data-av-simplify-hidden="nav"],
html.av-enabled.av-mode-simplify.av-simplify-hide-sidebars aside,
html.av-enabled.av-mode-simplify.av-simplify-hide-sidebars [role="complementary"],
html.av-enabled.av-mode-simplify.av-simplify-hide-sidebars [data-av-simplify-hidden="sidebar"],
html.av-enabled.av-mode-simplify.av-simplify-hide-comments [data-av-simplify-hidden="comment"],
html.av-enabled.av-mode-simplify.av-simplify-hide-forms form,
html.av-enabled.av-mode-simplify.av-simplify-hide-forms [data-av-simplify-hidden="form"],
html.av-enabled.av-mode-simplify [data-av-simplify-hidden="rule"] {
  display: none !important;
}

html.av-enabled.av-mode-cognitive body {
  text-align: start !important;
}

html.av-enabled.av-mode-cognitive [data-av-cognitive-main="true"] {
  max-width: var(--av-cognitive-width) !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

html.av-enabled.av-mode-cognitive.av-cognitive-hide-extras [data-av-cognitive-clutter="true"] {
  display: none !important;
}

html.av-enabled.av-mode-cognitive.av-cognitive-chunk [data-av-cognitive-paragraph="true"] {
  padding: 0.25em 0 !important;
  border-bottom: 1px solid rgba(15, 118, 110, 0.18) !important;
}

html.av-enabled.av-mode-cognitive.av-cognitive-emphasis h1,
html.av-enabled.av-mode-cognitive.av-cognitive-emphasis h2,
html.av-enabled.av-mode-cognitive.av-cognitive-emphasis h3,
html.av-enabled.av-mode-cognitive.av-cognitive-emphasis [role="heading"] {
  padding-block: 0.18em !important;
  border-bottom: 3px solid rgba(245, 158, 11, 0.45) !important;
  scroll-margin-top: 90px !important;
}

html.av-enabled.av-mode-navigation.av-underline-links a {
  text-decoration: underline !important;
  text-decoration-thickness: 0.1em !important;
  text-underline-offset: 0.16em !important;
}

html.av-enabled.av-mode-navigation button,
html.av-enabled.av-mode-navigation input,
html.av-enabled.av-mode-navigation select,
html.av-enabled.av-mode-navigation textarea,
html.av-enabled.av-mode-navigation a {
  outline-offset: 4px !important;
}

html.av-enabled.av-mode-navigation.av-focus-ring button:focus-visible,
html.av-enabled.av-mode-navigation.av-focus-ring input:focus-visible,
html.av-enabled.av-mode-navigation.av-focus-ring select:focus-visible,
html.av-enabled.av-mode-navigation.av-focus-ring textarea:focus-visible,
html.av-enabled.av-mode-navigation.av-focus-ring a:focus-visible,
html.av-enabled.av-mode-navigation.av-focus-ring [tabindex]:focus-visible {
  outline: 4px solid #f59e0b !important;
  box-shadow: 0 0 0 7px rgba(15, 118, 110, 0.36) !important;
}

html.av-enabled.av-mode-navigation.av-larger-targets button,
html.av-enabled.av-mode-navigation.av-larger-targets input,
html.av-enabled.av-mode-navigation.av-larger-targets select,
html.av-enabled.av-mode-navigation.av-larger-targets textarea,
html.av-enabled.av-mode-navigation.av-larger-targets a {
  min-height: 36px !important;
}

html.av-enabled.av-mode-navigation img[data-av-missing-alt="true"] {
  outline: 4px dashed #dc2626 !important;
  outline-offset: 4px !important;
}

html.av-enabled.av-mode-forms [data-av-form-control="true"] {
  scroll-margin-top: 90px !important;
}

html.av-enabled.av-mode-forms [data-av-form-required="true"] {
  box-shadow: inset 0 0 0 2px rgba(245, 158, 11, 0.72) !important;
}

html.av-enabled.av-mode-forms [data-av-form-unlabeled="true"] {
  outline: 4px dashed #dc2626 !important;
  outline-offset: 3px !important;
}

html.av-enabled.av-mode-forms [data-av-form-invalid="true"] {
  outline: 4px solid #b91c1c !important;
  outline-offset: 3px !important;
}

html.av-enabled.av-mode-filter body {
  filter: var(--av-page-filter) !important;
}

#accessiview-reading-guide {
  position: fixed !important;
  z-index: 2147483647 !important;
  left: 0 !important;
  width: 100vw !important;
  height: var(--av-guide-height) !important;
  pointer-events: none !important;
  background: var(--av-guide-color) !important;
  opacity: var(--av-guide-opacity) !important;
  box-shadow: 0 -9999px 0 9999px rgba(0, 0, 0, 0.08), 0 9999px 0 9999px rgba(0, 0, 0, 0.08) !important;
  mix-blend-mode: multiply !important;
}

html.av-guide-ruler #accessiview-reading-guide {
  border-top: 3px solid var(--av-guide-color) !important;
  border-bottom: 3px solid var(--av-guide-color) !important;
  background: transparent !important;
  opacity: 1 !important;
}

html.av-guide-line #accessiview-reading-guide {
  height: 4px !important;
  background: var(--av-guide-color) !important;
  opacity: 0.85 !important;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.62), 0 0 18px rgba(0, 0, 0, 0.28) !important;
}
`;

    syncShadowStyles();
    startShadowStyleObserver();
  }

  function removeDynamicStyle() {
    const style = document.getElementById("accessiview-style");
    if (style) {
      style.remove();
    }

    stopShadowStyleObserver();
    removeShadowStyles();
  }

  function getShadowStyleText() {
    return `
:host-context(html.av-enabled.av-mode-text) {
  font-size: calc(1rem * var(--av-text-scale)) !important;
  line-height: var(--av-line-height) !important;
}

:host-context(html.av-enabled.av-mode-text) *:not(svg):not(path) {
  letter-spacing: var(--av-letter-spacing) !important;
  word-spacing: var(--av-word-spacing) !important;
}

:host-context(html.av-enabled.av-mode-text) p,
:host-context(html.av-enabled.av-mode-text) li,
:host-context(html.av-enabled.av-mode-text) blockquote,
:host-context(html.av-enabled.av-mode-text) dd {
  margin-bottom: var(--av-paragraph-spacing) !important;
}

:host-context(html.av-enabled.av-mode-motion.av-disable-animations) *,
:host-context(html.av-enabled.av-mode-motion.av-disable-animations) *::before,
:host-context(html.av-enabled.av-mode-motion.av-disable-animations) *::after {
  animation-duration: 0.001ms !important;
  animation-iteration-count: 1 !important;
  animation-name: none !important;
  scroll-behavior: auto !important;
  transition-duration: 0.001ms !important;
  transition-property: none !important;
}

:host-context(html.av-enabled.av-mode-motion.av-reduce-scroll),
:host-context(html.av-enabled.av-mode-motion.av-reduce-scroll) *,
:host-context(html.av-enabled.av-mode-motion.av-reduce-scroll) *::before,
:host-context(html.av-enabled.av-mode-motion.av-reduce-scroll) *::after {
  scroll-behavior: auto !important;
}

:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) img,
:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) picture,
:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) video,
:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) audio,
:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) iframe,
:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) embed,
:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) object,
:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) canvas,
:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) svg,
:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) model-viewer,
:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) media-player,
:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) mux-player,
:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) lite-youtube,
:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) lite-vimeo,
:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) lottie-player,
:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) dotlottie-player,
:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) spline-viewer,
:host-context(html.av-enabled.av-mode-focus.av-focus-text-only) [role='img'] {
  display: none !important;
}

:host-context(html.av-enabled.av-mode-navigation.av-underline-links) a {
  text-decoration: underline !important;
  text-decoration-thickness: 0.1em !important;
  text-underline-offset: 0.16em !important;
}

:host-context(html.av-enabled.av-mode-navigation.av-focus-ring) button:focus-visible,
:host-context(html.av-enabled.av-mode-navigation.av-focus-ring) input:focus-visible,
:host-context(html.av-enabled.av-mode-navigation.av-focus-ring) select:focus-visible,
:host-context(html.av-enabled.av-mode-navigation.av-focus-ring) textarea:focus-visible,
:host-context(html.av-enabled.av-mode-navigation.av-focus-ring) a:focus-visible,
:host-context(html.av-enabled.av-mode-navigation.av-focus-ring) [tabindex]:focus-visible {
  outline: 4px solid #f59e0b !important;
  box-shadow: 0 0 0 7px rgba(15, 118, 110, 0.36) !important;
}

:host-context(html.av-enabled.av-mode-navigation.av-larger-targets) button,
:host-context(html.av-enabled.av-mode-navigation.av-larger-targets) input,
:host-context(html.av-enabled.av-mode-navigation.av-larger-targets) select,
:host-context(html.av-enabled.av-mode-navigation.av-larger-targets) textarea,
:host-context(html.av-enabled.av-mode-navigation.av-larger-targets) a {
  min-height: 36px !important;
}

:host-context(html.av-enabled.av-mode-forms) [data-av-form-required="true"] {
  box-shadow: inset 0 0 0 2px rgba(245, 158, 11, 0.72) !important;
}

:host-context(html.av-enabled.av-mode-forms) [data-av-form-unlabeled="true"] {
  outline: 4px dashed #dc2626 !important;
  outline-offset: 3px !important;
}

:host-context(html.av-enabled.av-mode-forms) [data-av-form-invalid="true"] {
  outline: 4px solid #b91c1c !important;
  outline-offset: 3px !important;
}

:host-context(html.av-enabled.av-mode-cognitive.av-cognitive-hide-extras) [data-av-cognitive-clutter="true"] {
  display: none !important;
}

:host-context(html.av-enabled.av-mode-cognitive.av-cognitive-chunk) [data-av-cognitive-paragraph="true"] {
  padding: 0.25em 0 !important;
  border-bottom: 1px solid rgba(15, 118, 110, 0.18) !important;
}
`;
  }

  function syncShadowStyles() {
    const styleText = getShadowStyleText();

    getQueryableRoots().forEach((root) => {
      if (root === document) {
        return;
      }

      let style = root.getElementById ? root.getElementById(SHADOW_STYLE_ID) : root.querySelector(`#${SHADOW_STYLE_ID}`);
      if (!style) {
        style = document.createElement("style");
        style.id = SHADOW_STYLE_ID;
        root.appendChild(style);
      }

      if (style.textContent !== styleText) {
        style.textContent = styleText;
      }
    });
  }

  function removeShadowStyles() {
    getQueryableRoots().forEach((root) => {
      if (root === document) {
        return;
      }

      const style = root.getElementById ? root.getElementById(SHADOW_STYLE_ID) : root.querySelector(`#${SHADOW_STYLE_ID}`);
      if (style) {
        style.remove();
      }
    });
  }

  function startShadowStyleObserver() {
    if (shadowStyleObserver) {
      startShadowStyleScanner();
      return;
    }

    if (!document.documentElement) {
      return;
    }

    shadowStyleObserver = new MutationObserver(() => {
      clearTimeout(shadowStyleObserverTimer);
      shadowStyleObserverTimer = setTimeout(() => {
        shadowStyleObserverTimer = null;

        if (!settings.enabled) {
          return;
        }

        syncShadowStyles();
        if (shouldPauseMedia()) {
          observeMediaRoots();
          pauseMedia();
        }
        if (shouldShowAltWarnings()) {
          observeAltRoots();
          markMissingAltText();
        }
        if (settings.modes.forms.enabled) {
          observeFormRoots();
          markFormHelpers();
        }
        if (settings.modes.cognitive.enabled) {
          observeCognitiveRoots();
          markCognitiveMode();
        }
        if (settings.modes.simplify.enabled) {
          observeSimplifyRoots();
          markSimplifyContent();
        }
      }, 160);
    });

    shadowStyleObserver.observe(document.documentElement, { childList: true, subtree: true });
    startShadowStyleScanner();
  }

  function startShadowStyleScanner() {
    if (shadowStyleScanTimer) {
      return;
    }

    shadowStyleScanCount = 0;
    shadowStyleScanTimer = window.setInterval(() => {
      shadowStyleScanCount += 1;

      if (!settings.enabled) {
        stopShadowStyleScanner();
        return;
      }

      syncShadowStyles();
      if (shouldPauseMedia()) {
        observeMediaRoots();
        pauseMedia();
      }
      if (shouldShowAltWarnings()) {
        observeAltRoots();
        markMissingAltText();
      }
      if (settings.modes.forms.enabled) {
        observeFormRoots();
        markFormHelpers();
      }
      if (settings.modes.cognitive.enabled) {
        observeCognitiveRoots();
        markCognitiveMode();
      }
      if (settings.modes.simplify.enabled) {
        observeSimplifyRoots();
        markSimplifyContent();
      }

      if (shadowStyleScanCount >= 45) {
        stopShadowStyleScanner();
      }
    }, 1000);
  }

  function stopShadowStyleObserver() {
    if (shadowStyleObserver) {
      shadowStyleObserver.disconnect();
      shadowStyleObserver = null;
    }

    if (shadowStyleObserverTimer) {
      clearTimeout(shadowStyleObserverTimer);
      shadowStyleObserverTimer = null;
    }

    stopShadowStyleScanner();
  }

  function stopShadowStyleScanner() {
    if (shadowStyleScanTimer) {
      window.clearInterval(shadowStyleScanTimer);
      shadowStyleScanTimer = null;
    }

    shadowStyleScanCount = 0;
  }

  function findMainContent() {
    const ruleMain = findMainContentFromSiteRule();
    if (ruleMain) {
      return ruleMain;
    }

    const candidates = queryAllAcrossRoots(READER_CANDIDATE_SELECTOR)
      .filter(isVisibleContent)
      .filter((element) => !isLikelyReaderBoilerplate(element))
      .map((element) => ({ element, score: scoreReaderCandidate(element) }))
      .filter((item) => item.score > 180)
      .sort((a, b) => b.score - a.score);

    return candidates[0] ? candidates[0].element : document.body;
  }

  function findMainContentFromSiteRule() {
    const rule = getCurrentSiteRule();
    if (!rule || !rule.mainSelectors || !rule.mainSelectors.length) {
      return null;
    }

    const candidates = [];
    rule.mainSelectors.forEach((selector) => {
      queryAllAcrossRoots(selector).forEach((element) => {
        if (!element || element === document.documentElement || !isVisibleContent(element)) {
          return;
        }

        candidates.push({
          element,
          score: scoreReaderCandidate(element) + (selector === rule.mainSelector ? 1200 : 500)
        });
      });
    });

    candidates.sort((first, second) => second.score - first.score);
    return candidates[0] ? candidates[0].element : null;
  }

  function getCurrentSiteRule() {
    return getSiteRule(siteStore, getSettingsUrl());
  }

  function isVisibleContent(element) {
    if (!element || element === document.documentElement) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 220 && rect.height > 80 && style.display !== "none" && style.visibility !== "hidden";
  }

  function getTextLength(element) {
    return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().length;
  }

  function scoreReaderCandidate(element) {
    const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
    const textLength = text.length;
    const linkTextLength = Array.from(element.querySelectorAll("a")).reduce((sum, link) => {
      return sum + getTextLength(link);
    }, 0);
    const linkDensity = textLength ? linkTextLength / textLength : 1;
    const paragraphCount = element.querySelectorAll("p").length;
    const headingCount = element.querySelectorAll("h1,h2,h3").length;
    const mediaCount = element.querySelectorAll(FOCUS_MEDIA_SELECTOR).length;
    const formCount = element.querySelectorAll("form,input,select,textarea,button").length;
    const punctuationCount = (text.match(/[.!?。！？]/g) || []).length;
    const descriptor = getElementDescriptor(element);
    const titleRelevance = scoreTitleRelevance(text, document.title);
    let score = Math.min(textLength, 8000);

    score += paragraphCount * 220;
    score += headingCount * 80;
    score += punctuationCount * 25;
    score += titleRelevance;

    if (element.matches("article,[itemprop='articleBody']")) {
      score += 900;
    }

    if (element.matches("main,[role='main']")) {
      score += 500;
    }

    if (READER_POSITIVE_PATTERN.test(descriptor)) {
      score += 450;
    }

    if (READER_NEGATIVE_PATTERN.test(descriptor)) {
      score -= 1400;
    }

    score -= linkDensity * 2500;
    score -= mediaCount * 30;
    score -= formCount * 180;

    if (paragraphCount === 0 && textLength > 1200) {
      score -= 650;
    }

    if (isLikelyArticlePage() && titleRelevance === 0 && textLength > 500) {
      score -= 900;
    }

    return score;
  }

  function isLikelyArticlePage() {
    return /\/ar-[a-z0-9]+/i.test(window.location.pathname) || /\b(article|news|story)\b/i.test(window.location.pathname);
  }

  function scoreTitleRelevance(text, title) {
    const normalizedText = normalizeReaderText(text).toLowerCase();
    const tokens = getReaderTitleTokens(title);

    if (!normalizedText || !tokens.length) {
      return 0;
    }

    const normalizedTitle = normalizeReaderText(title).toLowerCase();
    let score = normalizedText.includes(normalizedTitle) ? 1800 : 0;

    tokens.forEach((token) => {
      if (normalizedText.includes(token)) {
        score += Math.min(900, Math.max(220, token.length * 90));
      }
    });

    return score;
  }

  function getReaderTitleTokens(title) {
    const normalizedTitle = normalizeReaderText(title)
      .toLowerCase()
      .replace(/\b(msn|news|article|story|other)\b/g, " ");

    return Array.from(new Set(
      normalizedTitle
        .split(/[|:;,.!?()[\]{}"“”‘’'`/\\\-–—\s]+/u)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && !/^\d+$/.test(token))
    )).slice(0, 16);
  }

  function getElementDescriptor(element) {
    const className = typeof element.className === "string" ? element.className : "";

    return [
      element.id || "",
      className,
      element.getAttribute("role") || ""
    ].join(" ");
  }

  function isLikelyReaderBoilerplate(element) {
    if (!element || element === document.body || element === document.documentElement) {
      return false;
    }

    if (element.closest("nav,footer,aside,form,dialog,[role='navigation'],[role='search'],[role='complementary'],[role='contentinfo']")) {
      return true;
    }

    return READER_NEGATIVE_PATTERN.test(getElementDescriptor(element));
  }

  function markMainContent() {
    const main = findMainContent();
    if (!main) {
      return;
    }

    main.setAttribute("data-av-main", "true");
    let current = main;

    while (current && current !== document.body) {
      current.setAttribute("data-av-main-chain", "true");
      current = current.parentElement;
    }
  }

  function clearFocusMarks() {
    stopFocusObserver();
    restoreFocusColorOverrides();

    document.querySelectorAll("[data-av-main], [data-av-main-chain], [data-av-larger-target]").forEach((element) => {
      element.removeAttribute("data-av-main");
      element.removeAttribute("data-av-main-chain");
      element.removeAttribute("data-av-larger-target");
    });
  }

  function updateFocusMode() {
    if (!settings.enabled || !settings.modes.focus.enabled) {
      removeFocusReaderOverlay();
      stopFocusObserver();
      restoreFocusColorOverrides();
      return;
    }

    if (!IS_TOP_FRAME) {
      removeFocusReaderOverlay();
      markMainContent();
      applyFocusColorOverrides(resolveFocusColors(settings.modes.focus));
      if (settings.modes.focus.textOnly) {
        applyFocusMediaOverrides();
      }
      startFocusObserver();
      return;
    }

    const readerRendered = settings.modes.focus.textOnly
      ? renderFocusReaderOverlay(extractReaderContent())
      : false;

    if (!settings.modes.focus.textOnly) {
      removeFocusReaderOverlay();
    }

    if (readerRendered) {
      restoreFocusColorOverrides();
      startFocusObserver();
      scheduleFocusReaderRefreshes();
      return;
    }

    markMainContent();
    const focusColors = resolveFocusColors(settings.modes.focus);
    applyFocusColorOverrides(focusColors);

    if (settings.modes.focus.textOnly) {
      applyFocusMediaOverrides();
    }

    startFocusObserver();
  }

  function extractReaderContent() {
    const source = findMainContent();
    const title = isLikelyArticlePage()
      ? normalizeReaderText(document.title) || findReaderTitle(source)
      : findReaderTitle(source);
    const articleRootBlocks = isLikelyArticlePage() ? collectArticleRootBlocks(title) : [];
    const blocks = articleRootBlocks.length
      ? articleRootBlocks
      : removeDuplicateReaderTitle(collectReaderBlocks(source), title);
    const shadowBlocks = blocks.length >= 2 || getBlocksLength(blocks) >= 180
      ? blocks
      : removeDuplicateReaderTitle(collectReaderBlocksAcrossRoots(), title);
    const fallbackBlocks = shadowBlocks.length >= 2 || getBlocksLength(shadowBlocks) >= 180
      ? shadowBlocks
      : removeDuplicateReaderTitle(collectFallbackTextBlocks(source), title);

    return {
      title,
      site: window.location.hostname || document.title || "Page",
      url: window.location.href,
      blocks: fallbackBlocks
    };
  }

  function collectArticleRootBlocks(title) {
    const candidates = [];

    getQueryableRoots().forEach((root) => {
      if (root === document) {
        return;
      }

      const blocks = removeDuplicateReaderTitle(collectReaderBlocks(root), title);
      const textLength = getBlocksLength(blocks);
      if (blocks.length < 2 || textLength < 220) {
        return;
      }

      const combinedText = blocks.map((block) => block.text).join(" ");
      const relevance = scoreTitleRelevance(combinedText, title);
      const host = root.host || null;
      const hostTop = host ? host.getBoundingClientRect().top + window.scrollY : 0;
      const hostTag = host ? host.tagName.toLowerCase() : "";
      const articleBonus = /(^|-)article($|-)|story|article-body|article-content/.test(hostTag + " " + getElementDescriptor(host || document.body)) ? 800 : 0;

      candidates.push({
        blocks,
        relevance,
        score: relevance + Math.min(textLength, 2600) + blocks.length * 120 + articleBonus - Math.max(0, hostTop / 8)
      });
    });

    const relevantCandidates = candidates.filter((candidate) => candidate.relevance > 0);
    const pool = relevantCandidates.length ? relevantCandidates : candidates;
    const best = pool.sort((first, second) => second.score - first.score)[0];

    return best ? best.blocks : [];
  }

  function removeDuplicateReaderTitle(blocks, title) {
    const normalizedTitle = normalizeReaderText(title).toLowerCase();
    if (!normalizedTitle) {
      return blocks;
    }

    return blocks.filter((block, index) => {
      return !(index === 0 && block.type === "heading" && block.text.toLowerCase() === normalizedTitle);
    });
  }

  function findReaderTitle(source) {
    const heading = source && source.querySelector
      ? source.querySelector("h1, [role='heading'][aria-level='1'], h2")
      : null;
    const text = normalizeReaderText(heading ? heading.innerText || heading.textContent : "");
    return text || normalizeReaderText(document.title) || "Readable page";
  }

  function collectReaderBlocks(source) {
    if (!source || !source.querySelectorAll) {
      return [];
    }

    const blocks = [];
    const seen = new Set();
    const selector = [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "li",
      "blockquote",
      "pre",
      "a",
      "span",
      "figcaption",
      "dt",
      "dd",
      "td",
      "th",
      "[role='heading']",
      "[aria-label]",
      "div",
      "section"
    ].join(",");

    source.querySelectorAll(selector).forEach((element) => {
      if (shouldSkipReaderElement(element)) {
        return;
      }

      const tagName = getReaderTagName(element);
      const hasReadableChildren = element.querySelector("h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,figcaption,dt,dd,td,th");
      if ((tagName === "div" || tagName === "section") && hasReadableChildren) {
        return;
      }

      const text = getReaderElementText(element);
      if (!isUsefulReaderText(text, tagName, element)) {
        return;
      }

      const key = text.toLowerCase();
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      blocks.push({
        type: getReaderBlockType(tagName),
        level: /^h[1-6]$/.test(tagName) ? Number(tagName.slice(1)) : null,
        text,
        html: getReaderElementInlineHtml(element)
      });
    });

    return blocks.slice(0, 260);
  }

  function collectReaderBlocksAcrossRoots() {
    const candidates = [];
    const seen = new Set();
    const selector = [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "li",
      "blockquote",
      "pre",
      "a",
      "[role='heading']",
      "[aria-label]",
      ".heading",
      ".title",
      ".card-title",
      ".headline",
      ".text"
    ].join(",");

    getQueryableRoots().forEach((root) => {
      root.querySelectorAll(selector).forEach((element) => {
        if (shouldSkipReaderElement(element) || !isVisibleReaderElement(element)) {
          return;
        }

        const tagName = getReaderTagName(element);
        const text = getReaderElementText(element);
        if (!isUsefulReaderText(text, tagName, element)) {
          return;
        }

        const key = text.toLowerCase();
        if (seen.has(key)) {
          return;
        }

        seen.add(key);
        const rect = element.getBoundingClientRect();
        candidates.push({
          type: getReaderBlockType(tagName, element),
          level: /^h[1-6]$/.test(tagName) ? Number(tagName.slice(1)) : null,
          text,
          html: getReaderElementInlineHtml(element),
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          length: text.length
        });
      });
    });

    return candidates
      .sort((first, second) => first.top - second.top || first.left - second.left || second.length - first.length)
      .slice(0, 160)
      .map(({ type, level, text, html }) => ({ type, level, text, html }));
  }

  function collectFallbackTextBlocks(source) {
    const text = normalizeReaderText(
      (source && (source.innerText || source.textContent)) ||
      document.body.innerText ||
      document.body.textContent ||
      ""
    );

    if (!text) {
      return [];
    }

    return text
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map(normalizeReaderText)
      .filter((line) => line.length >= 35)
      .slice(0, 120)
      .map((line) => ({ type: "paragraph", level: null, text: line }));
  }

  function shouldSkipReaderElement(element) {
    if (!element || element.id === "accessiview-reader-host" || element.closest("#accessiview-reader-host")) {
      return true;
    }

    const blockedTags = new Set([
      "SCRIPT",
      "STYLE",
      "NOSCRIPT",
      "TEMPLATE",
      "NAV",
      "HEADER",
      "FOOTER",
      "ASIDE",
      "FORM",
      "BUTTON",
      "INPUT",
      "SELECT",
      "TEXTAREA",
      "IMG",
      "PICTURE",
      "VIDEO",
      "AUDIO",
      "IFRAME",
      "EMBED",
      "OBJECT",
      "CANVAS",
      "SVG"
    ]);

    if (blockedTags.has(element.tagName)) {
      return true;
    }

    if (READER_NEGATIVE_PATTERN.test(getElementDescriptor(element))) {
      return true;
    }

    if (element.closest("script,style,noscript,template,nav,footer,aside,form,button,[hidden],[aria-hidden='true']")) {
      return true;
    }

    const role = (element.getAttribute("role") || "").toLowerCase();
    if (["navigation", "banner", "contentinfo", "complementary", "search", "dialog", "alert", "img"].includes(role)) {
      return true;
    }

    const style = window.getComputedStyle(element);
    return style.display === "none" || style.visibility === "hidden";
  }

  function isVisibleReaderElement(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 24 && rect.height > 8 && style.display !== "none" && style.visibility !== "hidden";
  }

  function getReaderTagName(element) {
    const role = (element.getAttribute("role") || "").toLowerCase();
    if (role === "heading") {
      return "h2";
    }

    return element.tagName.toLowerCase();
  }

  function getReaderElementText(element) {
    const ariaLabel = normalizeReaderText(element.getAttribute("aria-label") || "");
    const visibleText = normalizeReaderText(element.innerText || element.textContent || "");

    if (ariaLabel && (!visibleText || ariaLabel.length > visibleText.length * 1.25)) {
      return ariaLabel;
    }

    return visibleText || ariaLabel;
  }

  function getReaderElementInlineHtml(element) {
    if (!element || !element.childNodes || element.tagName === "PRE") {
      return "";
    }

    const html = Array.from(element.childNodes)
      .map(renderReaderInlineNode)
      .join("")
      .replace(/\s+/g, " ")
      .trim();

    return html && normalizeReaderText(html.replace(/<[^>]+>/g, "")) ? html : "";
  }

  function renderReaderInlineNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent);
    }

    if (node.nodeType !== Node.ELEMENT_NODE || shouldSkipReaderInlineElement(node)) {
      return "";
    }

    if (node.tagName === "BR") {
      return "<br>";
    }

    if (node.tagName === "A") {
      const text = normalizeReaderText(node.innerText || node.textContent || node.getAttribute("aria-label") || "");
      const href = getSafeReaderLinkHref(node);
      if (!text || !href) {
        return escapeHtml(text);
      }

      return `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`;
    }

    return Array.from(node.childNodes).map(renderReaderInlineNode).join("");
  }

  function shouldSkipReaderInlineElement(element) {
    return [
      "SCRIPT",
      "STYLE",
      "NOSCRIPT",
      "TEMPLATE",
      "BUTTON",
      "INPUT",
      "SELECT",
      "TEXTAREA",
      "IMG",
      "PICTURE",
      "VIDEO",
      "AUDIO",
      "IFRAME",
      "EMBED",
      "OBJECT",
      "CANVAS",
      "SVG"
    ].includes(element.tagName) || element.getAttribute("aria-hidden") === "true";
  }

  function getSafeReaderLinkHref(anchor) {
    const rawHref = String(anchor.getAttribute("href") || "").trim();
    if (!rawHref || /^javascript:/i.test(rawHref) || /^data:/i.test(rawHref)) {
      return "";
    }

    if (rawHref.startsWith("#")) {
      return rawHref;
    }

    try {
      const url = new URL(rawHref, window.location.href);
      return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.href : "";
    } catch (_error) {
      return "";
    }
  }

  function getReaderBlockType(tagName, element) {
    if (/^h[1-6]$/.test(tagName)) {
      return "heading";
    }

    if (tagName === "li" || tagName === "a" || (element && element.matches(".heading,.title,.card-title,.headline"))) {
      return "list-item";
    }

    if (tagName === "blockquote") {
      return "quote";
    }

    if (tagName === "pre") {
      return "pre";
    }

    if (tagName === "td" || tagName === "th") {
      return "table-cell";
    }

    return "paragraph";
  }

  function isUsefulReaderText(text, tagName, element) {
    if (!text) {
      return false;
    }

    if (isReaderUtilityText(text, element)) {
      return false;
    }

    if (/^h[1-6]$/.test(tagName)) {
      return text.length >= 2 && text.length <= 180;
    }

    if (tagName === "li" || tagName === "dt" || tagName === "dd" || tagName === "figcaption") {
      return text.length >= 8 && text.length <= 500;
    }

    if (tagName === "td" || tagName === "th") {
      return text.length >= 12 && text.length <= 500;
    }

    if (tagName === "a") {
      return text.length >= 24 && text.length <= 260;
    }

    if (tagName === "span") {
      return text.length >= 20 && text.length <= 260;
    }

    return text.length >= 35 && text.length <= 2200;
  }

  function isReaderUtilityText(text, element) {
    const normalized = normalizeReaderText(text).toLowerCase();

    if (!normalized) {
      return true;
    }

    if (/^(skip to|web search|enter your search term|open copilot|open settings|page settings|refresh page)\b/.test(normalized)) {
      return true;
    }

    if (/^(outlook\.com|booking\.com|walmart|ebay|facebook|rewards|microsoft 365|onedrive|onenote|x|discover|shopping)(\s+ad)?$/.test(normalized)) {
      return true;
    }

    if (/\b(ad|sponsored)\b$/i.test(text) && text.length < 80) {
      return true;
    }

    return Boolean(element && READER_NEGATIVE_PATTERN.test(getElementDescriptor(element)));
  }

  function getBlocksLength(blocks) {
    return blocks.reduce((total, block) => total + block.text.length, 0);
  }

  function normalizeReaderText(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function renderFocusReaderOverlay(readerContent) {
    if (!readerContent) {
      pageStatus.focusReaderActive = false;
      pageStatus.readerBlocks = 0;
      pageStatus.readerTitle = "";
      return false;
    }

    if (!readerHost) {
      readerHost = document.createElement("div");
      readerHost.id = "accessiview-reader-host";
      document.documentElement.appendChild(readerHost);
      readerHost.attachShadow({ mode: "open" });
    }

    const root = readerHost.shadowRoot;
    const previousScroll = root.querySelector(".reader") ? root.querySelector(".reader").scrollTop : 0;
    const focusColors = resolveFocusColors(settings.modes.focus);
    const readerChrome = getReaderChromeColors(focusColors);
    const textSettings = settings.modes.text;
    const textScale = settings.modes.text.enabled ? textSettings.scale / 100 : 1.16;
    const lineHeight = settings.modes.text.enabled ? textSettings.lineHeight : 1.75;
    const letterSpacing = settings.modes.text.enabled ? `${textSettings.letterSpacing}em` : "0";
    const wordSpacing = settings.modes.text.enabled ? `${textSettings.wordSpacing}em` : "0.04em";
    const fontFamily = getReaderFontFamily(textSettings.fontFamily);
    const blocksMarkup = readerContent.blocks.length
      ? readerContent.blocks.map(renderReaderBlock).join("")
      : `<p class="empty">No readable text found on this page.</p>`;

    root.innerHTML = `
      <style>
        :host {
          all: initial;
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483646 !important;
          color-scheme: ${readerChrome.colorScheme} !important;
        }

        * {
          box-sizing: border-box;
        }

        .reader {
          width: 100vw;
          height: 100vh;
          overflow: auto;
          background: ${focusColors.background};
          color: ${focusColors.text};
          font-family: ${fontFamily};
          font-size: ${Math.round(18 * textScale)}px;
          line-height: ${lineHeight};
          letter-spacing: ${letterSpacing};
          word-spacing: ${wordSpacing};
        }

        .toolbar {
          position: sticky;
          top: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          min-height: 58px;
          padding: 10px clamp(16px, 4vw, 36px);
          border-bottom: 1px solid ${readerChrome.divider};
          background: ${focusColors.background};
          color: ${focusColors.text};
        }

        .source {
          min-width: 0;
          overflow: hidden;
          color: ${focusColors.text};
          font-size: 14px;
          line-height: 1.3;
          opacity: ${readerChrome.sourceOpacity};
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        button {
          min-width: 76px;
          min-height: 38px;
          padding: 7px 14px;
          border: 2px solid ${focusColors.text};
          border-radius: 8px;
          color: ${focusColors.text};
          background: ${focusColors.background};
          color-scheme: ${readerChrome.colorScheme};
          font: 700 14px/1.2 Arial, Helvetica, sans-serif;
          forced-color-adjust: none;
          cursor: pointer;
        }

        button:focus-visible {
          outline: 4px solid #f59e0b;
          outline-offset: 3px;
        }

        article {
          width: min(${settings.modes.focus.maxWidth}px, calc(100vw - 32px));
          margin: 0 auto;
          padding: clamp(22px, 4vw, 48px) 0 72px;
        }

        h1 {
          margin: 0 0 22px;
          color: ${focusColors.text};
          font-family: ${fontFamily};
          font-size: ${Math.round(30 * textScale)}px;
          line-height: 1.18;
          letter-spacing: 0;
        }

        h2,
        h3,
        h4,
        h5,
        h6 {
          margin: 1.6em 0 0.55em;
          color: ${focusColors.text};
          font-family: ${fontFamily};
          line-height: 1.25;
          letter-spacing: 0;
        }

        h2 { font-size: ${Math.round(24 * textScale)}px; }
        h3 { font-size: ${Math.round(21 * textScale)}px; }
        h4, h5, h6 { font-size: ${Math.round(19 * textScale)}px; }

        p,
        li,
        blockquote,
        pre {
          margin: 0 0 1em;
          color: ${focusColors.text};
          font-family: ${fontFamily};
        }

        .list-item {
          display: grid;
          grid-template-columns: 1.2em 1fr;
          gap: 0.35em;
        }

        blockquote {
          padding-left: 1em;
          border-left: 4px solid ${focusColors.link};
        }

        pre {
          overflow: auto;
          padding: 14px;
          border: 1px solid ${readerChrome.subtleBorder};
          border-radius: 8px;
          background: ${readerChrome.subtleSurface};
          white-space: pre-wrap;
        }

        .empty {
          padding: 18px;
          border: 2px solid ${focusColors.text};
          border-radius: 8px;
        }

        a {
          color: ${focusColors.link};
          font-weight: 700;
          text-decoration: underline;
          text-decoration-thickness: 0.1em;
          text-underline-offset: 0.18em;
        }

        a:focus-visible {
          outline: 4px solid #f59e0b;
          outline-offset: 3px;
          border-radius: 4px;
        }
      </style>
      <div class="reader" role="document" aria-label="Focus reader">
        <div class="toolbar">
          <div class="source" title="${escapeHtml(readerContent.url)}">${escapeHtml(readerContent.site)}</div>
          <button id="accessiview-exit-focus" class="exit" type="button" aria-label="Exit Focus Mode">Exit</button>
        </div>
        <article>
          <h1>${escapeHtml(readerContent.title)}</h1>
          ${blocksMarkup}
        </article>
      </div>
    `;

    root.getElementById("accessiview-exit-focus").addEventListener("click", disableFocusMode);
    const reader = root.querySelector(".reader");
    reader.scrollTop = Math.min(previousScroll, reader.scrollHeight);
    pageStatus.focusReaderActive = true;
    pageStatus.readerBlocks = readerContent.blocks.length;
    pageStatus.readerTitle = readerContent.title;
    return true;
  }

  function renderReaderBlock(block) {
    const text = block.html || escapeHtml(block.text);

    if (block.type === "heading") {
      const level = Math.min(Math.max(block.level || 2, 2), 6);
      return `<h${level}>${text}</h${level}>`;
    }

    if (block.type === "list-item") {
      return `<p class="list-item"><span aria-hidden="true">-</span><span>${text}</span></p>`;
    }

    if (block.type === "quote") {
      return `<blockquote>${text}</blockquote>`;
    }

    if (block.type === "pre") {
      return `<pre>${text}</pre>`;
    }

    return `<p>${text}</p>`;
  }

  function getReaderFontFamily(fontFamily) {
    const families = {
      system: "Arial, Helvetica, sans-serif",
      dyslexia: "Verdana, Tahoma, Arial, sans-serif",
      serif: "Georgia, 'Times New Roman', serif",
      mono: "Consolas, 'Courier New', monospace"
    };

    return families[fontFamily] || families.system;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value || "").replace(/["\\]/g, "\\$&");
  }

  function disableFocusMode() {
    const nextSettings = withDefaults(settings);
    nextSettings.modes.focus.enabled = false;

    if (usingSiteSettings) {
      const nextSiteStore = upsertSiteSettings(siteStore, window.location.href, nextSettings);
      chrome.storage.local.set({ [SITE_STORAGE_KEY]: nextSiteStore });
      return;
    }

    chrome.storage.sync.set({ [STORAGE_KEY]: nextSettings });
  }

  function removeFocusReaderOverlay() {
    clearFocusReaderRefreshes();

    if (readerHost) {
      readerHost.remove();
      readerHost = null;
    }

    pageStatus.focusReaderActive = false;
    pageStatus.readerBlocks = 0;
    pageStatus.readerTitle = "";
  }

  function applyFocusColorOverrides(focusColors) {
    const main = document.querySelector('[data-av-main="true"]');
    if (!main) {
      return;
    }

    const targets = [document.body, main].concat(Array.from(main.querySelectorAll("*")));

    targets.forEach((element) => {
      if (shouldSkipFocusColorElement(element)) {
        return;
      }

      cacheFocusStyle(element, "data-av-focus-color");

      const readableColor = element.closest("a") ? focusColors.link : focusColors.text;
      element.style.setProperty("color", readableColor, "important");
      element.style.setProperty("-webkit-text-fill-color", readableColor, "important");
      element.style.setProperty("caret-color", readableColor, "important");
      element.style.setProperty("background-color", focusColors.background, "important");
      element.style.setProperty("background-image", "none", "important");
      element.style.setProperty("text-shadow", "none", "important");
      element.style.setProperty("forced-color-adjust", "none", "important");
    });
  }

  function shouldSkipFocusColorElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return true;
    }

    return FOCUS_COLOR_IGNORED_TAGS.has(element.tagName);
  }

  function applyFocusMediaOverrides() {
    const roots = getQueryableRoots();
    const rule = getCurrentSiteRule();
    const mediaSelector = rule && rule.mediaSelectors && rule.mediaSelectors.length
      ? `${FOCUS_MEDIA_SELECTOR},${rule.mediaSelectors.join(",")}`
      : FOCUS_MEDIA_SELECTOR;

    roots.forEach((root) => {
      root.querySelectorAll(mediaSelector).forEach(hideFocusMediaElement);
      root.querySelectorAll("*").forEach(removeFocusBackgroundMedia);
    });

    pauseMedia();
  }

  function hideFocusMediaElement(element) {
    if (!element || element.closest("#accessiview-reading-guide")) {
      return;
    }

    cacheFocusStyle(element, "data-av-focus-media");
    element.style.setProperty("display", "none", "important");
    element.style.setProperty("visibility", "hidden", "important");
    element.style.setProperty("opacity", "0", "important");
    element.style.setProperty("width", "0", "important");
    element.style.setProperty("height", "0", "important");
    element.style.setProperty("min-width", "0", "important");
    element.style.setProperty("min-height", "0", "important");
    element.style.setProperty("max-width", "0", "important");
    element.style.setProperty("max-height", "0", "important");
    element.style.setProperty("overflow", "hidden", "important");
  }

  function removeFocusBackgroundMedia(element) {
    if (!element || element.id === "accessiview-reading-guide" || element.id === "accessiview-style") {
      return;
    }

    const style = window.getComputedStyle(element);
    const hasImageBackground =
      hasRenderedImage(style.backgroundImage) ||
      hasRenderedImage(style.borderImageSource) ||
      hasRenderedImage(style.listStyleImage) ||
      hasRenderedImage(style.maskImage) ||
      hasRenderedImage(style.webkitMaskImage);

    if (!hasImageBackground) {
      return;
    }

    cacheFocusStyle(element, "data-av-focus-background");
    element.style.setProperty("background-image", "none", "important");
    element.style.setProperty("border-image-source", "none", "important");
    element.style.setProperty("list-style-image", "none", "important");
    element.style.setProperty("mask-image", "none", "important");
    element.style.setProperty("-webkit-mask-image", "none", "important");
  }

  function hasRenderedImage(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized !== "" && normalized !== "none" && normalized !== "initial";
  }

  function cacheFocusStyle(element, markerAttribute) {
    if (!focusStyleCache.has(element)) {
      focusStyleCache.set(element, element.getAttribute("style"));
    }

    element.setAttribute(markerAttribute, "true");
  }

  function getQueryableRoots() {
    const roots = [document];
    const visited = new Set(roots);

    for (let index = 0; index < roots.length; index += 1) {
      roots[index].querySelectorAll("*").forEach((element) => {
        if (element.id === "accessiview-reader-host") {
          return;
        }

        if (element.shadowRoot && !visited.has(element.shadowRoot)) {
          visited.add(element.shadowRoot);
          roots.push(element.shadowRoot);
        }
      });
    }

    return roots;
  }

  function queryAllAcrossRoots(selector) {
    const results = [];

    getQueryableRoots().forEach((root) => {
      try {
        root.querySelectorAll(selector).forEach((element) => {
          results.push(element);
        });
      } catch (_error) {
        // Ignore invalid site-specific selectors and continue with generic heuristics.
      }
    });

    return results;
  }

  function restoreFocusColorOverrides() {
    getQueryableRoots().forEach((root) => {
      root.querySelectorAll(FOCUS_OVERRIDE_SELECTOR).forEach(restoreFocusElementStyle);
    });

    focusStyleCache = new WeakMap();
  }

  function restoreFocusElementStyle(element) {
      const originalStyle = focusStyleCache.get(element);

      if (typeof originalStyle === "string") {
        element.setAttribute("style", originalStyle);
      } else {
        element.removeAttribute("style");
      }

      element.removeAttribute("data-av-focus-color");
      element.removeAttribute("data-av-focus-media");
      element.removeAttribute("data-av-focus-background");
  }

  function startFocusObserver() {
    if (focusObserver) {
      observeFocusRoots();
      return;
    }

    if (!document.body) {
      return;
    }

    focusObserver = new MutationObserver(() => {
      clearTimeout(focusObserverTimer);
      focusObserverTimer = setTimeout(() => {
        focusObserverTimer = null;
        if (settings.enabled && settings.modes.focus.enabled) {
          observeFocusRoots();
          if (readerHost) {
            renderFocusReaderOverlay(extractReaderContent());
          } else {
            applyFocusColorOverrides(resolveFocusColors(settings.modes.focus));
            if (settings.modes.focus.textOnly) {
              applyFocusMediaOverrides();
            }
          }
        }
      }, 80);
    });

    observeFocusRoots();
  }

  function observeFocusRoots() {
    if (!focusObserver || !document.body) {
      return;
    }

    getQueryableRoots().forEach((root) => {
      const target = root === document ? document.body : root;
      if (target && !focusObservedTargets.has(target)) {
        focusObserver.observe(target, { childList: true, subtree: true });
        focusObservedTargets.add(target);
      }
    });
  }

  function scheduleFocusReaderRefreshes() {
    clearFocusReaderRefreshes();

    if (!readerHost || !settings.enabled || !settings.modes.focus.enabled || !settings.modes.focus.textOnly) {
      return;
    }

    [600, 1800, 4000, 8000, 14000].forEach((delay) => {
      const timer = window.setTimeout(() => {
        focusReaderRefreshTimers = focusReaderRefreshTimers.filter((item) => item !== timer);

        if (!readerHost || !settings.enabled || !settings.modes.focus.enabled || !settings.modes.focus.textOnly) {
          return;
        }

        observeFocusRoots();
        renderFocusReaderOverlay(extractReaderContent());
      }, delay);

      focusReaderRefreshTimers.push(timer);
    });
  }

  function clearFocusReaderRefreshes() {
    focusReaderRefreshTimers.forEach((timer) => window.clearTimeout(timer));
    focusReaderRefreshTimers = [];
  }

  function stopFocusObserver() {
    if (focusObserver) {
      focusObserver.disconnect();
      focusObserver = null;
    }

    focusObservedTargets = new WeakSet();

    if (focusObserverTimer) {
      clearTimeout(focusObserverTimer);
      focusObserverTimer = null;
    }

    clearFocusReaderRefreshes();
  }

  function updateSimplifyMode() {
    if (!settings.enabled || !settings.modes.simplify.enabled || settings.modes.focus.textOnly && settings.modes.focus.enabled) {
      clearSimplifyMarks();
      stopSimplifyObserver();
      return;
    }

    markSimplifyContent();
    startSimplifyObserver();
  }

  function markSimplifyContent() {
    clearSimplifyMarks(false);
    const main = findMainContent();
    if (!main) {
      return;
    }

    markElementChain(main, "data-av-simplify-main", "data-av-simplify-chain");
    markSimplifyHiddenCandidates(main);
  }

  function markElementChain(element, mainAttribute, chainAttribute) {
    element.setAttribute(mainAttribute, "true");
    let current = element;

    while (current && current !== document.body) {
      current.setAttribute(chainAttribute, "true");
      current = current.parentElement;
    }

    if (document.body) {
      document.body.setAttribute(chainAttribute, "true");
    }
  }

  function markSimplifyHiddenCandidates(main) {
    if (!main || !main.querySelectorAll) {
      return;
    }

    const rule = getCurrentSiteRule();
    if (rule && rule.hideSelectors && rule.hideSelectors.length) {
      rule.hideSelectors.forEach((selector) => {
        queryAllAcrossRoots(selector).forEach((element) => {
          if (element !== main && !element.contains(main)) {
            element.setAttribute("data-av-simplify-hidden", "rule");
          }
        });
      });
    }

    main.querySelectorAll("nav,[role='navigation'],aside,[role='complementary'],form,[class],[id],[role]").forEach((element) => {
      if (element === main || element.hasAttribute("data-av-simplify-main")) {
        return;
      }

      const descriptor = getElementDescriptor(element);
      const role = (element.getAttribute("role") || "").toLowerCase();

      if (role === "navigation" || element.tagName === "NAV" || /\b(nav|menu|breadcrumb|toolbar|search)\b/i.test(descriptor)) {
        element.setAttribute("data-av-simplify-hidden", "nav");
        return;
      }

      if (role === "complementary" || element.tagName === "ASIDE" || /\b(sidebar|related|recommend|widget|promo|advert|ad)\b/i.test(descriptor)) {
        element.setAttribute("data-av-simplify-hidden", "sidebar");
        return;
      }

      if (element.tagName === "FORM" || /\b(form|newsletter|subscribe|login|signup)\b/i.test(descriptor)) {
        element.setAttribute("data-av-simplify-hidden", "form");
        return;
      }

      if (/\b(comment|discussion|reply|social|share)\b/i.test(descriptor)) {
        element.setAttribute("data-av-simplify-hidden", "comment");
      }
    });
  }

  function clearSimplifyMarks(stopObserver = true) {
    getQueryableRoots().forEach((root) => {
      root.querySelectorAll(SIMPLIFY_OVERRIDE_SELECTOR).forEach((element) => {
        element.removeAttribute("data-av-simplify-main");
        element.removeAttribute("data-av-simplify-chain");
        element.removeAttribute("data-av-simplify-hidden");
      });
    });

    if (stopObserver) {
      stopSimplifyObserver();
    }
  }

  function startSimplifyObserver() {
    if (!simplifyObserver) {
      simplifyObserver = new MutationObserver(() => {
        clearTimeout(simplifyObserverTimer);
        simplifyObserverTimer = setTimeout(() => {
          simplifyObserverTimer = null;
          if (settings.enabled && settings.modes.simplify.enabled) {
            markSimplifyContent();
          }
        }, 140);
      });
    }

    observeSimplifyRoots();
  }

  function observeSimplifyRoots() {
    if (!simplifyObserver || !document.body) {
      return;
    }

    getQueryableRoots().forEach((root) => {
      const target = root === document ? document.body : root;
      if (target && !simplifyObservedTargets.has(target)) {
        simplifyObserver.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "id", "role"] });
        simplifyObservedTargets.add(target);
      }
    });
  }

  function stopSimplifyObserver() {
    if (simplifyObserver) {
      simplifyObserver.disconnect();
      simplifyObserver = null;
    }

    simplifyObservedTargets = new WeakSet();

    if (simplifyObserverTimer) {
      clearTimeout(simplifyObserverTimer);
      simplifyObserverTimer = null;
    }
  }

  function updateFormHelpers() {
    if (!settings.enabled || !settings.modes.forms.enabled) {
      clearFormHelpers();
      stopFormObserver();
      return;
    }

    markFormHelpers();
    startFormObserver();
  }

  function markFormHelpers() {
    getQueryableRoots().forEach((root) => {
      root.querySelectorAll(FORM_CONTROL_SELECTOR).forEach((control) => {
        markFormControl(control);
      });
    });
  }

  function markFormControl(control) {
    if (!control || !control.matches || control.disabled) {
      return;
    }

    const formSettings = settings.modes.forms;
    const required = control.required || control.getAttribute("aria-required") === "true";
    const unlabeled = !hasAccessibleControlName(control);
    const invalid = isInvalidFormControl(control);
    const messages = [];

    control.setAttribute("data-av-form-control", "true");
    setBooleanDataAttribute(control, "data-av-form-required", Boolean(formSettings.highlightRequired && required));
    setBooleanDataAttribute(control, "data-av-form-unlabeled", Boolean(formSettings.flagUnlabeled && unlabeled));
    setBooleanDataAttribute(control, "data-av-form-invalid", Boolean(formSettings.flagInvalid && invalid));

    if (required) {
      messages.push("Required field");
    }
    if (unlabeled) {
      messages.push("Missing visible or accessible label");
    }
    if (invalid) {
      messages.push("Input value is invalid");
    }

    if (messages.length && !control.title) {
      control.title = messages.join(". ");
      control.setAttribute("data-av-form-title", "true");
    } else if (!messages.length && control.getAttribute("data-av-form-title") === "true") {
      control.removeAttribute("title");
      control.removeAttribute("data-av-form-title");
    }
  }

  function hasAccessibleControlName(control) {
    if (!control) {
      return false;
    }

    if (normalizeReaderText(control.getAttribute("aria-label") || "")) {
      return true;
    }

    const labelledBy = (control.getAttribute("aria-labelledby") || "").trim();
    if (labelledBy) {
      const root = control.getRootNode && control.getRootNode();
      const hasLabelledByText = labelledBy.split(/\s+/).some((id) => {
        const label = (root && root.getElementById ? root.getElementById(id) : null) || document.getElementById(id);
        return Boolean(label && normalizeReaderText(label.innerText || label.textContent));
      });

      if (hasLabelledByText) {
        return true;
      }
    }

    if (control.id) {
      const escapedId = cssEscape(control.id);
      const root = control.getRootNode && control.getRootNode();
      if ((root && root.querySelector && root.querySelector(`label[for="${escapedId}"]`)) ||
          document.querySelector(`label[for="${escapedId}"]`)) {
        return true;
      }
    }

    return Boolean(control.closest("label") || normalizeReaderText(control.getAttribute("placeholder") || ""));
  }

  function isInvalidFormControl(control) {
    if (!control || control.willValidate === false) {
      return false;
    }

    if (control.getAttribute("aria-invalid") === "true") {
      return true;
    }

    try {
      return Boolean(control.matches(":invalid") && (control.value || control.required));
    } catch (_error) {
      return false;
    }
  }

  function clearFormHelpers() {
    getQueryableRoots().forEach((root) => {
      root.querySelectorAll(FORM_HELPER_SELECTOR).forEach((element) => {
        element.removeAttribute("data-av-form-control");
        element.removeAttribute("data-av-form-required");
        element.removeAttribute("data-av-form-unlabeled");
        element.removeAttribute("data-av-form-invalid");
        if (element.getAttribute("data-av-form-title") === "true") {
          element.removeAttribute("title");
          element.removeAttribute("data-av-form-title");
        }
      });
    });
  }

  function setBooleanDataAttribute(element, attribute, enabled) {
    if (enabled) {
      element.setAttribute(attribute, "true");
      return;
    }

    element.removeAttribute(attribute);
  }

  function startFormObserver() {
    if (!formObserver) {
      formObserver = new MutationObserver(markFormHelpers);
    }

    observeFormRoots();
  }

  function observeFormRoots() {
    if (!formObserver) {
      return;
    }

    getQueryableRoots().forEach((root) => {
      const target = root === document ? document.documentElement : root;
      if (target && !formObservedTargets.has(target)) {
        formObserver.observe(target, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["aria-label", "aria-labelledby", "aria-invalid", "disabled", "id", "placeholder", "required", "value"]
        });
        formObservedTargets.add(target);
      }
    });
  }

  function stopFormObserver() {
    if (formObserver) {
      formObserver.disconnect();
      formObserver = null;
    }

    formObservedTargets = new WeakSet();
  }

  function updateCognitiveMode() {
    if (!settings.enabled || !settings.modes.cognitive.enabled) {
      clearCognitiveMarks();
      stopCognitiveObserver();
      return;
    }

    markCognitiveMode();
    startCognitiveObserver();
  }

  function markCognitiveMode() {
    clearCognitiveMarks(false);
    const main = findMainContent();

    if (main) {
      main.setAttribute("data-av-cognitive-main", "true");
      if (settings.modes.cognitive.chunkText) {
        main.querySelectorAll("p, li, blockquote, dd").forEach((element) => {
          if (getTextLength(element) >= 35) {
            element.setAttribute("data-av-cognitive-paragraph", "true");
          }
        });
      }
    }

    if (settings.modes.cognitive.hideExtras) {
      getQueryableRoots().forEach((root) => {
        root.querySelectorAll("aside, nav, footer, [role='navigation'], [role='complementary'], [class], [id]").forEach((element) => {
          if (main && (element === main || main.contains(element))) {
            return;
          }

          if (COGNITIVE_CLUTTER_PATTERN.test(getElementDescriptor(element))) {
            element.setAttribute("data-av-cognitive-clutter", "true");
          }
        });
      });
    }
  }

  function clearCognitiveMarks(stopObserver = true) {
    getQueryableRoots().forEach((root) => {
      root.querySelectorAll(COGNITIVE_OVERRIDE_SELECTOR).forEach((element) => {
        element.removeAttribute("data-av-cognitive-main");
        element.removeAttribute("data-av-cognitive-clutter");
        element.removeAttribute("data-av-cognitive-paragraph");
      });
    });

    if (stopObserver) {
      stopCognitiveObserver();
    }
  }

  function startCognitiveObserver() {
    if (!cognitiveObserver) {
      cognitiveObserver = new MutationObserver(() => {
        clearTimeout(cognitiveObserverTimer);
        cognitiveObserverTimer = setTimeout(() => {
          cognitiveObserverTimer = null;
          if (settings.enabled && settings.modes.cognitive.enabled) {
            markCognitiveMode();
          }
        }, 160);
      });
    }

    observeCognitiveRoots();
  }

  function observeCognitiveRoots() {
    if (!cognitiveObserver || !document.body) {
      return;
    }

    getQueryableRoots().forEach((root) => {
      const target = root === document ? document.body : root;
      if (target && !cognitiveObservedTargets.has(target)) {
        cognitiveObserver.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "id", "role"] });
        cognitiveObservedTargets.add(target);
      }
    });
  }

  function stopCognitiveObserver() {
    if (cognitiveObserver) {
      cognitiveObserver.disconnect();
      cognitiveObserver = null;
    }

    cognitiveObservedTargets = new WeakSet();

    if (cognitiveObserverTimer) {
      clearTimeout(cognitiveObserverTimer);
      cognitiveObserverTimer = null;
    }
  }

  function updateGuide() {
    if (!IS_TOP_FRAME || !settings.enabled || !settings.modes.guide.enabled) {
      removeGuide();
      return;
    }

    if (!guideElement) {
      guideElement = document.createElement("div");
      guideElement.id = "accessiview-reading-guide";
      document.documentElement.appendChild(guideElement);
      document.addEventListener("mousemove", handleMouseMove, { passive: true });
      document.addEventListener("keydown", handleGuideKeydown, true);
      document.addEventListener("focusin", handleGuideFocusIn, true);
    }

    positionGuide(lastMouseY);
  }

  function handleMouseMove(event) {
    lastMouseY = event.clientY;
    positionGuide(lastMouseY);
  }

  function handleGuideKeydown(event) {
    if (!guideElement) {
      return;
    }

    if (event.key === "ArrowDown") {
      lastMouseY = Math.min(window.innerHeight - 10, lastMouseY + getGuideKeyboardStep());
      positionGuide(lastMouseY);
    }

    if (event.key === "ArrowUp") {
      lastMouseY = Math.max(10, lastMouseY - getGuideKeyboardStep());
      positionGuide(lastMouseY);
    }
  }

  function handleGuideFocusIn(event) {
    if (!settings.modes.guide.followFocus || !event.target || !event.target.getBoundingClientRect) {
      return;
    }

    const rect = event.target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    lastMouseY = Math.max(10, Math.min(window.innerHeight - 10, rect.top + rect.height / 2));
    positionGuide(lastMouseY);
  }

  function getGuideKeyboardStep() {
    return clamp(Number(settings.modes.guide.keyboardStep) || 32, 12, 120);
  }

  function positionGuide(yPosition) {
    if (!guideElement) {
      return;
    }

    const height = settings.modes.guide.style === "line" ? 4 : settings.modes.guide.height;
    guideElement.style.top = `${Math.max(0, yPosition - height / 2)}px`;
  }

  function removeGuide() {
    if (guideElement) {
      guideElement.remove();
      guideElement = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("keydown", handleGuideKeydown, true);
      document.removeEventListener("focusin", handleGuideFocusIn, true);
    }
  }

  function updateMotionControls() {
    const shouldReduceScrolling =
      settings.enabled &&
      settings.modes.motion.enabled &&
      settings.modes.motion.reduceScrolling;

    if (shouldReduceScrolling) {
      installScrollOverrides();
      return;
    }

    restoreScrollOverrides();
  }

  function installScrollOverrides() {
    if (scrollOverridesInstalled) {
      setPageScrollOverride(true);
      return;
    }

    originalScrollMethods = {
      windowScroll: window.scroll,
      windowScrollTo: window.scrollTo,
      windowScrollBy: window.scrollBy,
      elementScroll: Element.prototype.scroll,
      elementScrollTo: Element.prototype.scrollTo,
      elementScrollBy: Element.prototype.scrollBy,
      elementScrollIntoView: Element.prototype.scrollIntoView
    };

    window.scroll = function accessiViewScroll(...args) {
      return originalScrollMethods.windowScroll.apply(this, normalizeScrollArguments(args));
    };

    window.scrollTo = function accessiViewScrollTo(...args) {
      return originalScrollMethods.windowScrollTo.apply(this, normalizeScrollArguments(args));
    };

    window.scrollBy = function accessiViewScrollBy(...args) {
      return originalScrollMethods.windowScrollBy.apply(this, normalizeScrollArguments(args));
    };

    if (originalScrollMethods.elementScroll) {
      Element.prototype.scroll = function accessiViewElementScroll(...args) {
        return originalScrollMethods.elementScroll.apply(this, normalizeScrollArguments(args));
      };
    }

    if (originalScrollMethods.elementScrollTo) {
      Element.prototype.scrollTo = function accessiViewElementScrollTo(...args) {
        return originalScrollMethods.elementScrollTo.apply(this, normalizeScrollArguments(args));
      };
    }

    if (originalScrollMethods.elementScrollBy) {
      Element.prototype.scrollBy = function accessiViewElementScrollBy(...args) {
        return originalScrollMethods.elementScrollBy.apply(this, normalizeScrollArguments(args));
      };
    }

    if (originalScrollMethods.elementScrollIntoView) {
      Element.prototype.scrollIntoView = function accessiViewScrollIntoView(...args) {
        return originalScrollMethods.elementScrollIntoView.apply(this, normalizeScrollArguments(args));
      };
    }

    scrollOverridesInstalled = true;
    setPageScrollOverride(true);
  }

  function restoreScrollOverrides() {
    if (!scrollOverridesInstalled || !originalScrollMethods) {
      return;
    }

    window.scroll = originalScrollMethods.windowScroll;
    window.scrollTo = originalScrollMethods.windowScrollTo;
    window.scrollBy = originalScrollMethods.windowScrollBy;

    if (originalScrollMethods.elementScroll) {
      Element.prototype.scroll = originalScrollMethods.elementScroll;
    }

    if (originalScrollMethods.elementScrollTo) {
      Element.prototype.scrollTo = originalScrollMethods.elementScrollTo;
    }

    if (originalScrollMethods.elementScrollBy) {
      Element.prototype.scrollBy = originalScrollMethods.elementScrollBy;
    }

    if (originalScrollMethods.elementScrollIntoView) {
      Element.prototype.scrollIntoView = originalScrollMethods.elementScrollIntoView;
    }

    originalScrollMethods = null;
    scrollOverridesInstalled = false;
    setPageScrollOverride(false);
  }

  function normalizeScrollArguments(args) {
    if (args.length === 1 && args[0] && typeof args[0] === "object") {
      return [Object.assign({}, args[0], { behavior: "auto" })];
    }

    return args;
  }

  function setPageScrollOverride(enabled) {
    window.postMessage({
      source: "AccessiView",
      type: "ACCESSIVIEW_SET_REDUCE_SCROLL",
      enabled: Boolean(enabled)
    }, "*");
  }

  function updateMediaControls() {
    if (!shouldPauseMedia()) {
      if (mediaObserver) {
        mediaObserver.disconnect();
        mediaObserver = null;
      }
      removeMediaPlayListeners();
      mediaObservedTargets = new WeakSet();
      return;
    }

    pauseMedia();
    startMediaObserver();
  }

  function shouldPauseMedia() {
    return Boolean(
      settings.enabled &&
      ((settings.modes.motion.enabled && settings.modes.motion.pauseMedia) ||
        (settings.modes.focus.enabled && settings.modes.focus.textOnly))
    );
  }

  function startMediaObserver() {
    if (!mediaObserver) {
      mediaObserver = new MutationObserver(pauseMedia);
    }

    observeMediaRoots();
  }

  function pauseMedia() {
    getQueryableRoots().forEach((root) => {
      root.querySelectorAll("video, audio").forEach((media) => {
        disableMediaElement(media);
      });
    });
  }

  function observeMediaRoots() {
    if (!mediaObserver) {
      return;
    }

    getQueryableRoots().forEach((root) => {
      const target = root === document ? document.documentElement : root;
      if (target && !mediaObservedTargets.has(target)) {
        mediaObserver.observe(target, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["autoplay", "src"]
        });
        mediaObservedTargets.add(target);
      }

      if (root && !mediaPlayObservedRoots.has(root)) {
        root.addEventListener("play", handleMediaPlay, true);
        mediaPlayObservedRoots.add(root);
      }
    });
  }

  function removeMediaPlayListeners() {
    getQueryableRoots().forEach((root) => {
      root.removeEventListener("play", handleMediaPlay, true);
    });
    mediaPlayObservedRoots = new WeakSet();
  }

  function handleMediaPlay(event) {
    if (!shouldPauseMedia()) {
      return;
    }

    disableMediaElement(event.target);
  }

  function disableMediaElement(media) {
    if (!media || !media.matches || !media.matches("video, audio")) {
      return;
    }

    media.autoplay = false;
    media.removeAttribute("autoplay");
    media.muted = true;

    if (!media.paused && typeof media.pause === "function") {
      try {
        media.pause();
      } catch (_error) {
        // Some embedded media throw while transitioning; the play listener will retry.
      }
    }
  }

  function updateAltWarnings() {
    if (!shouldShowAltWarnings()) {
      clearAltWarnings();
      if (altObserver) {
        altObserver.disconnect();
        altObserver = null;
      }
      altObservedTargets = new WeakSet();
      return;
    }

    markMissingAltText();
    startAltObserver();
  }

  function shouldShowAltWarnings() {
    return Boolean(settings.enabled && settings.modes.navigation.enabled && settings.modes.navigation.showAltWarnings);
  }

  function startAltObserver() {
    if (!altObserver) {
      altObserver = new MutationObserver(() => {
        markMissingAltText();
        observeAltRoots();
      });
    }

    observeAltRoots();
  }

  function observeAltRoots() {
    if (!altObserver) {
      return;
    }

    getQueryableRoots().forEach((root) => {
      const target = root === document ? document.documentElement : root;
      if (target && !altObservedTargets.has(target)) {
        altObserver.observe(target, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["alt", "aria-label", "role"]
        });
        altObservedTargets.add(target);
      }
    });
  }

  function markMissingAltText() {
    getQueryableRoots().forEach((root) => {
      root.querySelectorAll("img").forEach((image) => {
        const missingAlt = !image.hasAttribute("alt") || image.getAttribute("alt").trim() === "";
        setBooleanDataAttribute(image, "data-av-missing-alt", missingAlt);
        if (!missingAlt && image.getAttribute("data-av-alt-title") === "true") {
          image.removeAttribute("title");
          image.removeAttribute("data-av-alt-title");
        }
        if (missingAlt && !image.title) {
          image.title = "Image is missing alternative text";
          image.setAttribute("data-av-alt-title", "true");
        }
      });
    });
  }

  function clearAltWarnings() {
    getQueryableRoots().forEach((root) => {
      root.querySelectorAll("[data-av-missing-alt]").forEach((image) => {
        image.removeAttribute("data-av-missing-alt");
        if (image.getAttribute("data-av-alt-title") === "true") {
          image.removeAttribute("title");
          image.removeAttribute("data-av-alt-title");
        }
      });
    });
  }

  function runAccessibilityAudit() {
    const roots = getQueryableRoots();
    const images = collectVisibleElements(roots, "img");
    const controls = collectVisibleElements(roots, FORM_CONTROL_SELECTOR);
    const focusables = collectVisibleElements(roots, KEYBOARD_FOCUSABLE_SELECTOR);
    const media = collectVisibleElements(roots, "video, audio");
    const headings = collectVisibleElements(roots, "h1,h2,h3,h4,h5,h6,[role='heading']");
    const lowContrast = sampleLowContrastText(roots);
    const missingAlt = images.filter((image) => !image.hasAttribute("alt") || image.getAttribute("alt").trim() === "").length;
    const unlabeledControls = controls.filter((control) => !hasAccessibleControlName(control)).length;
    const requiredFields = controls.filter((control) => control.required || control.getAttribute("aria-required") === "true").length;
    const invalidFields = controls.filter(isInvalidFormControl).length;
    const smallTargets = focusables.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (rect.width < 24 || rect.height < 24);
    }).length;
    const autoplayMedia = media.filter((element) => element.autoplay || element.hasAttribute("autoplay")).length;
    const headingReport = auditHeadings(headings);
    const clutterCount = countLikelyClutter();
    const recommendations = buildAuditRecommendations({
      missingAlt,
      unlabeledControls,
      requiredFields,
      invalidFields,
      smallTargets,
      lowContrastCount: lowContrast.count,
      autoplayMedia,
      headingIssues: headingReport.issues,
      clutterCount
    });

    return {
      title: document.title || window.location.hostname || "This page",
      url: window.location.href,
      scannedAt: new Date().toISOString(),
      counts: {
        images: images.length,
        missingAlt,
        controls: controls.length,
        unlabeledControls,
        requiredFields,
        invalidFields,
        focusTargets: focusables.length,
        smallTargets,
        autoplayMedia,
        headings: headings.length,
        headingIssues: headingReport.issues,
        lowContrastText: lowContrast.count,
        likelyClutter: clutterCount
      },
      score: scoreAudit({
        missingAlt,
        unlabeledControls,
        invalidFields,
        smallTargets,
        lowContrastCount: lowContrast.count,
        autoplayMedia,
        headingIssues: headingReport.issues
      }),
      headingReport,
      recommendations
    };
  }

  function collectVisibleElements(roots, selector) {
    const elements = [];
    roots.forEach((root) => {
      root.querySelectorAll(selector).forEach((element) => {
        if (isVisibleAuditElement(element)) {
          elements.push(element);
        }
      });
    });
    return elements;
  }

  function isVisibleAuditElement(element) {
    if (!element || element.closest("#accessiview-reader-host")) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
  }

  function sampleLowContrastText(roots) {
    let count = 0;
    let sampled = 0;

    roots.forEach((root) => {
      if (sampled >= 220) {
        return;
      }

      root.querySelectorAll("p,li,a,button,label,span,h1,h2,h3,h4,h5,h6,td,th").forEach((element) => {
        if (sampled >= 220 || !isVisibleAuditElement(element)) {
          return;
        }

        const text = normalizeReaderText(element.innerText || element.textContent || "");
        if (text.length < 3) {
          return;
        }

        const style = window.getComputedStyle(element);
        const foreground = parseCssColor(style.color);
        const background = getReadableBackgroundColor(element);
        if (!foreground || !background) {
          return;
        }

        sampled += 1;
        const fontSize = Number.parseFloat(style.fontSize) || 16;
        const isLarge = fontSize >= 24 || (fontSize >= 18.66 && Number.parseInt(style.fontWeight, 10) >= 700);
        const requiredRatio = isLarge ? 3 : 4.5;
        if (contrastRatioFromRgb(foreground, background) < requiredRatio) {
          count += 1;
        }
      });
    });

    return { count, sampled };
  }

  function getReadableBackgroundColor(element) {
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      const color = parseCssColor(window.getComputedStyle(current).backgroundColor);
      if (color && color.a > 0.15) {
        return blendRgb(color, getCanvasColor());
      }

      current = current.parentElement || (current.getRootNode && current.getRootNode().host) || null;
    }

    const bodyColor = document.body ? parseCssColor(window.getComputedStyle(document.body).backgroundColor) : null;
    return bodyColor && bodyColor.a > 0.15 ? blendRgb(bodyColor, getCanvasColor()) : getCanvasColor();
  }

  function getCanvasColor() {
    const rootColor = parseCssColor(window.getComputedStyle(document.documentElement).backgroundColor);
    return rootColor && rootColor.a > 0.15 ? blendRgb(rootColor, { r: 255, g: 255, b: 255, a: 1 }) : { r: 255, g: 255, b: 255, a: 1 };
  }

  function parseCssColor(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!text || text === "transparent") {
      return null;
    }

    const rgbMatch = text.match(/^rgba?\(([^)]+)\)$/);
    if (rgbMatch) {
      const parts = rgbMatch[1].split(/,\s*|\s+/).filter((part) => part && part !== "/");
      const channels = parts.map((part) => part.endsWith("%") ? Number.parseFloat(part) * 2.55 : Number.parseFloat(part));
      if (channels.length >= 3 && channels.every((channel, index) => index > 2 || Number.isFinite(channel))) {
        return {
          r: clamp(Math.round(channels[0]), 0, 255),
          g: clamp(Math.round(channels[1]), 0, 255),
          b: clamp(Math.round(channels[2]), 0, 255),
          a: Number.isFinite(channels[3]) ? clamp(channels[3], 0, 1) : 1
        };
      }
    }

    if (text.startsWith("#")) {
      return Object.assign(hexToRgb(text), { a: 1 });
    }

    return null;
  }

  function blendRgb(top, bottom) {
    const alpha = clamp(top.a, 0, 1);
    return {
      r: Math.round(top.r * alpha + bottom.r * (1 - alpha)),
      g: Math.round(top.g * alpha + bottom.g * (1 - alpha)),
      b: Math.round(top.b * alpha + bottom.b * (1 - alpha)),
      a: 1
    };
  }

  function contrastRatioFromRgb(first, second) {
    const firstLuminance = relativeLuminance(first);
    const secondLuminance = relativeLuminance(second);
    const lighter = Math.max(firstLuminance, secondLuminance);
    const darker = Math.min(firstLuminance, secondLuminance);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function auditHeadings(headings) {
    const levels = headings
      .map((heading) => {
        const roleLevel = Number(heading.getAttribute("aria-level"));
        return /^H[1-6]$/.test(heading.tagName) ? Number(heading.tagName.slice(1)) : roleLevel;
      })
      .filter((level) => level >= 1 && level <= 6);
    let issues = 0;

    if (levels.length && !levels.includes(1)) {
      issues += 1;
    }

    levels.forEach((level, index) => {
      if (index > 0 && level - levels[index - 1] > 1) {
        issues += 1;
      }
    });

    return {
      levels,
      h1Count: levels.filter((level) => level === 1).length,
      issues
    };
  }

  function countLikelyClutter() {
    let count = 0;
    queryAllAcrossRoots("aside,nav,footer,[class],[id],[role]").slice(0, 700).forEach((element) => {
      if (isVisibleAuditElement(element) && COGNITIVE_CLUTTER_PATTERN.test(getElementDescriptor(element))) {
        count += 1;
      }
    });
    return count;
  }

  function buildAuditRecommendations(counts) {
    const recommendations = [];

    if (counts.lowContrastCount > 0) {
      recommendations.push({
        id: "contrast",
        label: "Improve text contrast",
        description: `${counts.lowContrastCount} sampled text areas may be hard to read.`
      });
    }

    if (counts.missingAlt > 0) {
      recommendations.push({
        id: "altWarnings",
        label: "Show image alt warnings",
        description: `${counts.missingAlt} visible images are missing alternative text.`
      });
    }

    if (counts.unlabeledControls > 0 || counts.invalidFields > 0 || counts.requiredFields > 0) {
      recommendations.push({
        id: "forms",
        label: "Enable form helper",
        description: "Highlight required, invalid, and unlabeled form fields."
      });
    }

    if (counts.smallTargets > 0) {
      recommendations.push({
        id: "navigation",
        label: "Improve keyboard navigation",
        description: `${counts.smallTargets} focus targets are smaller than recommended.`
      });
    }

    if (counts.autoplayMedia > 0) {
      recommendations.push({
        id: "motion",
        label: "Reduce motion and autoplay",
        description: `${counts.autoplayMedia} autoplay media elements were detected.`
      });
    }

    if (counts.headingIssues > 0 || counts.clutterCount > 10) {
      recommendations.push({
        id: "cognitive",
        label: "Reduce cognitive load",
        description: "Simplify extra page regions and improve reading structure."
      });
    }

    if (!recommendations.length) {
      recommendations.push({
        id: "readingComfort",
        label: "Optional reading comfort",
        description: "Use larger spacing and the reading guide for longer pages."
      });
    }

    return recommendations;
  }

  function scoreAudit(counts) {
    const penalty =
      counts.missingAlt * 3 +
      counts.unlabeledControls * 5 +
      counts.invalidFields * 4 +
      counts.smallTargets * 2 +
      counts.lowContrastCount * 4 +
      counts.autoplayMedia * 3 +
      counts.headingIssues * 3;

    return clamp(Math.round(100 - penalty), 0, 100);
  }

  function updateKeyboardMap() {
    if (!IS_TOP_FRAME || !settings.enabled || !settings.modes.navigation.enabled || !settings.modes.navigation.keyboardMap) {
      removeKeyboardMap();
      return;
    }

    renderKeyboardMap();
  }

  function toggleKeyboardMap() {
    if (keyboardMapHost) {
      removeKeyboardMap();
      return;
    }

    renderKeyboardMap();
  }

  function renderKeyboardMap() {
    if (!IS_TOP_FRAME) {
      return;
    }

    const items = getKeyboardMapItems();
    if (!keyboardMapHost) {
      keyboardMapHost = document.createElement("div");
      keyboardMapHost.id = "accessiview-keyboard-map-host";
      document.documentElement.appendChild(keyboardMapHost);
      keyboardMapHost.attachShadow({ mode: "open" });
      document.addEventListener("keydown", handleKeyboardMapKeydown, true);
    }

    const root = keyboardMapHost.shadowRoot;
    const itemMarkup = items.length
      ? items.map((item, index) => `
          <li>
            <span class="index">${index + 1}</span>
            <span class="label">${escapeHtml(item.label)}</span>
            <button type="button" data-focus-index="${index}">Focus</button>
          </li>
        `).join("")
      : `<li class="empty">No keyboard focus targets detected.</li>`;

    root.innerHTML = `
      <style>
        :host {
          all: initial;
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          font-family: Arial, Helvetica, sans-serif;
          color: #111827;
        }

        .backdrop {
          position: absolute;
          inset: 0;
          background: rgba(17, 24, 39, 0.34);
        }

        .panel {
          position: absolute;
          top: 18px;
          right: 18px;
          width: min(460px, calc(100vw - 36px));
          max-height: min(720px, calc(100vh - 36px));
          display: grid;
          gap: 12px;
          padding: 16px;
          overflow: auto;
          border: 2px solid #0f766e;
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
        }

        header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        h2 {
          margin: 0;
          font-size: 18px;
          line-height: 1.2;
        }

        p {
          margin: 0;
          color: #4b5563;
          font-size: 13px;
          line-height: 1.4;
        }

        ol {
          display: grid;
          gap: 8px;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        li {
          display: grid;
          grid-template-columns: 34px 1fr auto;
          gap: 8px;
          align-items: center;
          min-height: 38px;
          padding: 8px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #f9fafb;
        }

        .index {
          display: inline-grid;
          place-items: center;
          min-width: 28px;
          min-height: 28px;
          border-radius: 999px;
          color: #ffffff;
          background: #0f766e;
          font-weight: 700;
        }

        .label {
          min-width: 0;
          overflow: hidden;
          color: #111827;
          font-size: 13px;
          line-height: 1.35;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        button {
          min-height: 34px;
          padding: 6px 10px;
          border: 1px solid #0f766e;
          border-radius: 8px;
          color: #0f3f3a;
          background: #e5f3ef;
          font: 700 13px/1.2 Arial, Helvetica, sans-serif;
          cursor: pointer;
        }

        button:focus-visible {
          outline: 4px solid #f59e0b;
          outline-offset: 2px;
        }

        .empty {
          display: block;
          color: #4b5563;
        }
      </style>
      <div class="backdrop" data-close></div>
      <section class="panel" role="dialog" aria-modal="true" aria-label="Keyboard navigation map">
        <header>
          <div>
            <h2>Keyboard Map</h2>
            <p>Press Esc to close. Use the Focus buttons to jump to visible page controls.</p>
          </div>
          <button type="button" data-close>Close</button>
        </header>
        <ol>${itemMarkup}</ol>
      </section>
    `;

    root.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", removeKeyboardMap);
    });

    root.querySelectorAll("[data-focus-index]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.focusIndex);
        const item = getKeyboardMapItems()[index];
        if (item && item.element) {
          focusKeyboardMapElement(item.element);
        }
      });
    });

    const firstButton = root.querySelector("button");
    if (firstButton) {
      firstButton.focus();
    }
  }

  function getKeyboardMapItems() {
    return queryAllAcrossRoots(KEYBOARD_FOCUSABLE_SELECTOR)
      .filter(isVisibleKeyboardTarget)
      .slice(0, 40)
      .map((element) => ({
        element,
        label: getKeyboardTargetLabel(element)
      }));
  }

  function isVisibleKeyboardTarget(element) {
    if (!element || element.disabled || element.closest("#accessiview-reader-host")) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width >= 8 && rect.height >= 8 && style.display !== "none" && style.visibility !== "hidden";
  }

  function getKeyboardTargetLabel(element) {
    const role = element.getAttribute("role") || element.tagName.toLowerCase();
    const text = normalizeReaderText(
      element.getAttribute("aria-label") ||
      element.innerText ||
      element.textContent ||
      element.getAttribute("placeholder") ||
      element.getAttribute("title") ||
      element.href ||
      role
    );

    return `${role}: ${text || "unnamed control"}`.slice(0, 140);
  }

  function focusKeyboardMapElement(element) {
    removeKeyboardMap();
    try {
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      element.focus({ preventScroll: true });
    } catch (_error) {
      element.focus();
    }
  }

  function handleKeyboardMapKeydown(event) {
    if (event.key === "Escape" && keyboardMapHost) {
      event.preventDefault();
      removeKeyboardMap();
    }
  }

  function removeKeyboardMap() {
    if (keyboardMapHost) {
      keyboardMapHost.remove();
      keyboardMapHost = null;
    }

    document.removeEventListener("keydown", handleKeyboardMapKeydown, true);
  }

  function updateQuickButton() {
    if (!IS_TOP_FRAME || !settings.enabled || !settings.ui || !settings.ui.floatingButton) {
      removeQuickButton();
      return;
    }

    renderQuickButton();
  }

  function renderQuickButton(open) {
    if (!quickButtonHost) {
      quickButtonHost = document.createElement("div");
      quickButtonHost.id = "accessiview-quick-button-host";
      document.documentElement.appendChild(quickButtonHost);
      quickButtonHost.attachShadow({ mode: "open" });
    }

    const root = quickButtonHost.shadowRoot;
    const side = settings.ui && settings.ui.floatingPosition === "left" ? "left" : "right";
    const isOpen = Boolean(open || root.querySelector(".panel"));
    const focusOn = settings.modes.focus.enabled;
    const contrastOn = settings.modes.contrast.enabled;
    const motionOn = settings.modes.motion.enabled;

    root.innerHTML = `
      <style>
        :host {
          all: initial;
          position: fixed;
          ${side}: 14px;
          bottom: 18px;
          z-index: 2147483647;
          font-family: Arial, Helvetica, sans-serif;
        }

        .launcher,
        button {
          min-width: 42px;
          min-height: 42px;
          border: 2px solid #0f766e;
          border-radius: 999px;
          color: #ffffff;
          background: #0f766e;
          font: 800 14px/1 Arial, Helvetica, sans-serif;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
        }

        .launcher:focus-visible,
        button:focus-visible {
          outline: 4px solid #f59e0b;
          outline-offset: 3px;
        }

        .panel {
          position: absolute;
          ${side}: 0;
          bottom: 52px;
          display: grid;
          gap: 8px;
          width: 190px;
          padding: 10px;
          border: 2px solid #0f766e;
          border-radius: 8px;
          color: #111827;
          background: #ffffff;
          box-shadow: 0 18px 42px rgba(0, 0, 0, 0.26);
        }

        .panel button {
          display: block;
          width: 100%;
          min-height: 34px;
          padding: 7px 9px;
          border-radius: 8px;
          color: #0f3f3a;
          background: #e5f3ef;
          box-shadow: none;
          text-align: left;
          font-size: 13px;
        }

        .panel button.is-on {
          color: #ffffff;
          background: #0f766e;
        }

        .panel button.danger {
          color: #b91c1c;
          background: #fff5f5;
          border-color: #fecaca;
        }
      </style>
      ${isOpen ? `
        <div class="panel" role="menu" aria-label="AccessiView quick controls">
          <button type="button" data-action="panel">Open side panel</button>
          <button type="button" data-action="focus" class="${focusOn ? "is-on" : ""}">Focus mode</button>
          <button type="button" data-action="contrast" class="${contrastOn ? "is-on" : ""}">High contrast</button>
          <button type="button" data-action="motion" class="${motionOn ? "is-on" : ""}">Reduce motion</button>
          <button type="button" data-action="off" class="danger">Turn off on page</button>
        </div>
      ` : ""}
      <button class="launcher" type="button" aria-label="AccessiView quick controls" aria-expanded="${isOpen}">A</button>
    `;

    root.querySelector(".launcher").addEventListener("click", () => {
      renderQuickButton(!isOpen);
    });

    root.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => handleQuickAction(button.dataset.action));
    });
  }

  function handleQuickAction(action) {
    if (action === "panel") {
      chrome.runtime.sendMessage({ type: "ACCESSIVIEW_OPEN_SIDE_PANEL" }, () => {
        renderQuickButton(false);
      });
      return;
    }

    const nextSettings = withDefaults(settings);

    if (action === "focus") {
      nextSettings.modes.focus.enabled = !nextSettings.modes.focus.enabled;
    } else if (action === "contrast") {
      nextSettings.modes.contrast.enabled = !nextSettings.modes.contrast.enabled;
    } else if (action === "motion") {
      nextSettings.modes.motion.enabled = true;
      nextSettings.modes.motion.disableAnimations = true;
      nextSettings.modes.motion.reduceScrolling = true;
      nextSettings.modes.motion.pauseMedia = true;
    } else if (action === "off") {
      nextSettings.enabled = false;
    }

    saveQuickSettings(nextSettings);
  }

  function saveQuickSettings(nextSettings) {
    if (usingSiteSettings) {
      const nextSiteStore = upsertSiteSettings(siteStore, window.location.href, nextSettings);
      chrome.storage.local.set({ [SITE_STORAGE_KEY]: nextSiteStore });
      return;
    }

    chrome.storage.sync.set({ [STORAGE_KEY]: nextSettings });
  }

  function removeQuickButton() {
    if (quickButtonHost) {
      quickButtonHost.remove();
      quickButtonHost = null;
    }
  }

  function startContentPicker(sendResponse) {
    if (!IS_TOP_FRAME) {
      sendResponse({ ok: false, message: "Content picker is only available in the top page." });
      return;
    }

    stopContentPicker(false);
    contentPickerResponse = sendResponse;
    contentPickerTarget = null;

    contentPickerHost = document.createElement("div");
    contentPickerHost.id = "accessiview-content-picker-host";
    document.documentElement.appendChild(contentPickerHost);
    contentPickerHost.attachShadow({ mode: "open" });
    renderContentPickerOverlay("Move over the page and click the main content area.");

    document.addEventListener("mousemove", handleContentPickerMove, true);
    document.addEventListener("click", handleContentPickerClick, true);
    document.addEventListener("keydown", handleContentPickerKeydown, true);
    document.addEventListener("scroll", updateContentPickerOutline, true);
  }

  function renderContentPickerOverlay(message) {
    if (!contentPickerHost || !contentPickerHost.shadowRoot) {
      return;
    }

    contentPickerHost.shadowRoot.innerHTML = `
      <style>
        :host {
          all: initial;
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          pointer-events: none;
          font-family: Arial, Helvetica, sans-serif;
        }

        .outline {
          position: fixed;
          display: none;
          border: 4px solid #f59e0b;
          border-radius: 8px;
          background: rgba(245, 158, 11, 0.1);
          box-shadow: 0 0 0 9999px rgba(17, 24, 39, 0.22);
        }

        .panel {
          position: fixed;
          top: 14px;
          left: 50%;
          max-width: min(620px, calc(100vw - 28px));
          transform: translateX(-50%);
          padding: 10px 14px;
          border: 2px solid #0f766e;
          border-radius: 8px;
          color: #111827;
          background: #ffffff;
          box-shadow: 0 14px 40px rgba(0, 0, 0, 0.24);
          font-size: 14px;
          font-weight: 700;
          line-height: 1.35;
        }

        .hint {
          display: block;
          margin-top: 3px;
          color: #4b5563;
          font-size: 12px;
          font-weight: 500;
        }
      </style>
      <div class="outline"></div>
      <div class="panel" role="status">
        ${escapeHtml(message)}
        <span class="hint">Esc cancels. The selected region is saved only for this website.</span>
      </div>
    `;
  }

  function handleContentPickerMove(event) {
    const element = getContentPickerElement(event.clientX, event.clientY);
    contentPickerTarget = element ? chooseContentPickerTarget(element) : null;
    updateContentPickerOutline();
  }

  function handleContentPickerClick(event) {
    if (!contentPickerTarget) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const selector = getStableCssSelector(contentPickerTarget);
    const label = getContentPickerLabel(contentPickerTarget);
    siteStore = upsertSiteRule(siteStore, getSettingsUrl(), {
      label: "Manual content area",
      source: "manual",
      mainSelector: selector
    });

    chrome.storage.local.set({ [SITE_STORAGE_KEY]: siteStore }, () => {
      renderContentPickerOverlay(`Saved "${label}" as the main content area.`);
      stopContentPickerListeners();
      refreshEffectiveSettings();
      respondToContentPicker({ ok: true, selector, label, message: "Content area saved for this website." }, true);
      window.setTimeout(() => stopContentPicker(false), 1600);
    });
  }

  function handleContentPickerKeydown(event) {
    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    stopContentPicker(true);
  }

  function getContentPickerElement(xPosition, yPosition) {
    const element = document.elementFromPoint(xPosition, yPosition);
    if (!element || isAccessiViewHost(element)) {
      return null;
    }

    return element;
  }

  function chooseContentPickerTarget(element) {
    const preferred = element.closest("article,main,[role='main'],section,[itemprop='articleBody'],div,p,li,table,form") || element;
    let current = preferred;
    let best = preferred;

    while (current && current !== document.body && current !== document.documentElement) {
      const textLength = getTextLength(current);
      const rect = current.getBoundingClientRect();
      if (textLength >= 60 && rect.width >= 120 && rect.height >= 36) {
        best = current;
      }

      if (current.matches && current.matches("article,main,[role='main'],[itemprop='articleBody']")) {
        return current;
      }

      current = current.parentElement;
    }

    return best;
  }

  function updateContentPickerOutline() {
    if (!contentPickerHost || !contentPickerHost.shadowRoot) {
      return;
    }

    const outline = contentPickerHost.shadowRoot.querySelector(".outline");
    if (!outline || !contentPickerTarget) {
      if (outline) {
        outline.style.display = "none";
      }
      return;
    }

    const rect = contentPickerTarget.getBoundingClientRect();
    outline.style.display = "block";
    outline.style.left = `${Math.max(0, rect.left)}px`;
    outline.style.top = `${Math.max(0, rect.top)}px`;
    outline.style.width = `${Math.max(0, Math.min(window.innerWidth, rect.width))}px`;
    outline.style.height = `${Math.max(0, Math.min(window.innerHeight, rect.height))}px`;
  }

  function getStableCssSelector(element) {
    if (!element || element === document.body) {
      return "body";
    }

    if (element.id && document.querySelectorAll(`#${cssEscape(element.id)}`).length === 1) {
      return `#${cssEscape(element.id)}`;
    }

    const parts = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body && parts.length < 7) {
      let segment = current.tagName.toLowerCase();
      const stableClasses = Array.from(current.classList || [])
        .filter((className) => /^[a-z0-9_-]{3,}$/i.test(className) && !/^(active|selected|open|closed|show|hide|visible|hidden)$/i.test(className))
        .slice(0, 2);

      if (stableClasses.length) {
        segment += `.${stableClasses.map(cssEscape).join(".")}`;
      }

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((sibling) => sibling.tagName === current.tagName);
        if (siblings.length > 1) {
          segment += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
      }

      parts.unshift(segment);
      const selector = parts.join(" > ");
      try {
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      } catch (_error) {
        // Keep building a more specific selector.
      }

      current = parent;
    }

    return parts.length ? parts.join(" > ") : element.tagName.toLowerCase();
  }

  function getContentPickerLabel(element) {
    const text = normalizeReaderText(
      element.getAttribute("aria-label") ||
      element.querySelector("h1,h2,h3,[role='heading']")?.textContent ||
      element.textContent ||
      element.tagName
    );
    return text ? text.slice(0, 80) : element.tagName.toLowerCase();
  }

  function isAccessiViewHost(element) {
    return Boolean(element && (
      element.id === "accessiview-content-picker-host" ||
      element.id === "accessiview-reader-host" ||
      element.id === "accessiview-keyboard-map-host" ||
      element.id === "accessiview-speech-highlight-host" ||
      element.closest("#accessiview-content-picker-host,#accessiview-reader-host,#accessiview-keyboard-map-host,#accessiview-speech-highlight-host")
    ));
  }

  function respondToContentPicker(response, finalResponse) {
    if (!contentPickerResponse) {
      return;
    }

    try {
      contentPickerResponse(response);
    } catch (_error) {
      // The popup may have closed after starting the picker.
    }

    if (finalResponse) {
      contentPickerResponse = null;
    }
  }

  function stopContentPicker(cancelled) {
    stopContentPickerListeners();

    if (contentPickerHost) {
      contentPickerHost.remove();
      contentPickerHost = null;
    }

    contentPickerTarget = null;

    if (cancelled) {
      respondToContentPicker({ ok: false, message: "Content picker cancelled." }, true);
    } else {
      contentPickerResponse = null;
    }
  }

  function stopContentPickerListeners() {
    document.removeEventListener("mousemove", handleContentPickerMove, true);
    document.removeEventListener("click", handleContentPickerClick, true);
    document.removeEventListener("keydown", handleContentPickerKeydown, true);
    document.removeEventListener("scroll", updateContentPickerOutline, true);
  }

  function disconnectObservers() {
    stopContrastObserver();
    stopFocusObserver();
    stopSimplifyObserver();
    stopFormObserver();
    stopCognitiveObserver();
    restoreScrollOverrides();
    stopShadowStyleObserver();
    removeKeyboardMap();
    removeSpeechHighlight();
    stopContentPicker(false);
    removeQuickButton();

    if (mediaObserver) {
      mediaObserver.disconnect();
      mediaObserver = null;
    }
    removeMediaPlayListeners();
    mediaObservedTargets = new WeakSet();

    if (altObserver) {
      altObserver.disconnect();
      altObserver = null;
    }
    altObservedTargets = new WeakSet();
  }

  async function summarizeCurrentPage(options) {
    const readerContent = extractReaderContent();
    const sourceText = getSummarySourceText(readerContent);

    if (!sourceText) {
      return { ok: false, message: "No readable text found to summarize." };
    }

    if (isSensitiveSummaryPage()) {
      return { ok: false, message: "Summary is disabled on pages with password or payment fields." };
    }

    const summaryOptions = normalizeSummaryOptions(options);
    const sourceHash = await hashText(`${window.location.href}\n${sourceText}\n${JSON.stringify(summaryOptions)}`);
    const cached = summaryOptions.cache ? await getCachedSummary(sourceHash) : null;
    if (cached) {
      return Object.assign({ ok: true, cached: true }, cached);
    }

    const browserSummary = summaryOptions.engine !== "extractive"
      ? await summarizeWithBrowserModel(sourceText, readerContent, summaryOptions)
      : null;
    if (!browserSummary && summaryOptions.engine === "browser") {
      return {
        ok: false,
        message: "Browser local AI is not available. Use Auto or Offline extraction for this page."
      };
    }

    const result = browserSummary || summarizeWithExtractiveModel(sourceText, readerContent, summaryOptions);
    const response = Object.assign({
      ok: true,
      cached: false,
      sourceLength: sourceText.length,
      title: readerContent.title,
      url: window.location.href
    }, result);

    if (summaryOptions.cache) {
      await cacheSummary(sourceHash, response);
    }

    return response;
  }

  function getSummarySourceText(readerContent) {
    const blocks = (readerContent.blocks || [])
      .map((block) => normalizeReaderText(block.text))
      .filter((text) => text.length >= 12)
      .slice(0, 180);
    const title = normalizeReaderText(readerContent.title);
    const text = [title].concat(blocks).filter(Boolean).join("\n\n");
    return text
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 36000);
  }

  function normalizeSummaryOptions(options) {
    return {
      engine: ["auto", "browser", "extractive"].includes(options.engine) ? options.engine : "auto",
      length: ["short", "medium", "detailed"].includes(options.length) ? options.length : "short",
      format: ["bullets", "paragraph", "actions"].includes(options.format) ? options.format : "bullets",
      plainLanguage: options.plainLanguage !== false,
      cache: options.cache !== false
    };
  }

  function isSensitiveSummaryPage() {
    const sensitiveSelector = [
      "input[type='password']",
      "input[autocomplete='cc-number']",
      "input[autocomplete='cc-csc']",
      "input[name*='card' i]",
      "input[id*='card' i]",
      "input[name*='cvv' i]",
      "input[id*='cvv' i]",
      "input[name*='ssn' i]",
      "input[id*='ssn' i]"
    ].join(",");

    return Boolean(document.querySelector(sensitiveSelector));
  }

  async function summarizeWithBrowserModel(text, readerContent, summaryOptions) {
    const api = getBrowserSummarizerApi();
    if (!api || typeof api.create !== "function") {
      return null;
    }

    try {
      if (typeof api.availability === "function") {
        const availability = await api.availability();
        if (!["available", "readily", "after-download", "downloadable"].includes(String(availability))) {
          return null;
        }
      }

      let summarizer = null;
      summarizer = await api.create({
        type: summaryOptions.format === "actions" ? "key-points" : summaryOptions.format === "bullets" ? "key-points" : "tldr",
        format: summaryOptions.format === "paragraph" ? "plain-text" : "markdown",
        length: summaryOptions.length === "detailed" ? "long" : summaryOptions.length
      });
      let summary = "";
      try {
        const promptText = getBrowserSummaryPrompt(text, readerContent, summaryOptions);
        summary = await summarizer.summarize(promptText, {
          context: `Summarize ${readerContent.title || "this webpage"} for accessibility.`
        });
      } finally {
        if (summarizer && typeof summarizer.destroy === "function") {
          summarizer.destroy();
        }
      }

      const normalized = normalizeSummaryText(summary);
      return normalized ? {
        method: "browser",
        methodLabel: "On-device browser AI",
        summary: normalized,
        sourceLength: text.length
      } : null;
    } catch (_error) {
      return null;
    }
  }

  function getBrowserSummarizerApi() {
    if (globalThis.Summarizer && typeof globalThis.Summarizer.create === "function") {
      return globalThis.Summarizer;
    }

    if (globalThis.ai && globalThis.ai.summarizer && typeof globalThis.ai.summarizer.create === "function") {
      return globalThis.ai.summarizer;
    }

    if (globalThis.ai && globalThis.ai.Summarizer && typeof globalThis.ai.Summarizer.create === "function") {
      return globalThis.ai.Summarizer;
    }

    return null;
  }

  function getBrowserSummaryPrompt(text, readerContent, summaryOptions) {
    const instructions = [
      summaryOptions.plainLanguage ? "Use plain, accessible language." : "",
      summaryOptions.format === "actions" ? "Focus on actions, warnings, deadlines, and decisions." : "",
      summaryOptions.format === "bullets" ? "Use concise bullet points." : "Use concise paragraphs."
    ].filter(Boolean).join(" ");

    return [
      `Title: ${readerContent.title || document.title || "Webpage"}`,
      `Instructions: ${instructions}`,
      "",
      text
    ].join("\n");
  }

  function summarizeWithExtractiveModel(text, readerContent, summaryOptions) {
    const sentences = splitSummarySentences(text);
    if (!sentences.length) {
      return {
        method: "extractive",
        methodLabel: "Offline local extraction",
        summary: readerContent.title || "No readable text found.",
        sourceLength: text.length
      };
    }

    const targetCount = getSummaryTargetCount(summaryOptions.length, summaryOptions.format);
    const scored = scoreSummarySentences(sentences, readerContent.title);
    const selected = scored
      .slice(0, targetCount)
      .sort((first, second) => first.index - second.index)
      .map((item) => simplifySummarySentence(item.text, summaryOptions.plainLanguage));
    const summary = formatExtractiveSummary(selected, summaryOptions);

    return {
      method: "extractive",
      methodLabel: "Offline local extraction",
      summary,
      sourceLength: text.length
    };
  }

  function splitSummarySentences(text) {
    return normalizeReaderText(text)
      .split(/\n{2,}|(?<=[.!?。！？])\s+/u)
      .flatMap(splitLongSummarySentence)
      .map(normalizeReaderText)
      .filter((sentence) => sentence.length >= 35 && sentence.length <= 520)
      .slice(0, 260);
  }

  function splitLongSummarySentence(sentence) {
    const text = normalizeReaderText(sentence);
    if (text.length <= 520) {
      return [text];
    }

    const parts = text
      .split(/(?<=[,;:，、；:])\s+|\s{2,}/u)
      .map(normalizeReaderText)
      .filter(Boolean);
    const sourceParts = parts.length > 1 ? parts : [text];
    const chunks = [];

    sourceParts.forEach((part) => {
      if (part.length <= 520) {
        chunks.push(part);
        return;
      }

      let remaining = part;
      while (remaining.length > 520) {
        const boundary = Math.max(
          remaining.lastIndexOf(" ", 420),
          remaining.lastIndexOf(" ", 360)
        );
        const take = boundary >= 220 ? boundary : 420;
        chunks.push(remaining.slice(0, take).trim());
        remaining = remaining.slice(take).trim();
      }

      if (remaining) {
        chunks.push(remaining);
      }
    });

    return chunks;
  }

  function scoreSummarySentences(sentences, title) {
    const tokens = getSummaryKeywords(sentences.join(" "), title);
    return sentences.map((sentence, index) => {
      const normalized = sentence.toLowerCase();
      let score = 0;
      tokens.forEach((token, tokenIndex) => {
        if (normalized.includes(token)) {
          score += Math.max(3, 12 - tokenIndex);
        }
      });
      if (/[0-9%$฿€£]/.test(sentence)) {
        score += 6;
      }
      if (/\b(important|warning|deadline|required|must|should|risk|benefit|result|because|therefore)\b/i.test(sentence) ||
          /(สรุป|สำคัญ|ต้อง|ควร)/.test(sentence)) {
        score += 8;
      }
      if (index < 8) {
        score += 8 - index;
      }
      score -= Math.max(0, sentence.length - 260) / 80;
      return { index, text: sentence, score };
    }).sort((first, second) => second.score - first.score);
  }

  function getSummaryKeywords(text, title) {
    const stopWords = new Set([
      "about", "after", "also", "because", "before", "being", "between", "could", "from", "have",
      "into", "more", "most", "other", "over", "some", "such", "than", "that", "their", "there",
      "these", "this", "those", "through", "were", "when", "where", "which", "while", "with",
      "และ", "ของ", "ที่", "ใน", "เป็น", "การ", "ได้", "ให้", "จาก", "กับ", "มี", "ว่า"
    ]);
    const counts = new Map();
    const titleText = normalizeReaderText(title).toLowerCase();

    String(text || "").toLowerCase().match(/[a-z0-9]{3,}|[\u0e00-\u0e7f]{2,}/gu)?.forEach((token) => {
      if (stopWords.has(token)) {
        return;
      }
      counts.set(token, (counts.get(token) || 0) + (titleText.includes(token) ? 4 : 1));
    });

    return Array.from(counts.entries())
      .sort((first, second) => second[1] - first[1])
      .slice(0, 18)
      .map((entry) => entry[0]);
  }

  function getSummaryTargetCount(length, format) {
    if (format === "actions") {
      return length === "detailed" ? 8 : length === "medium" ? 6 : 4;
    }
    return length === "detailed" ? 8 : length === "medium" ? 5 : 3;
  }

  function simplifySummarySentence(sentence, plainLanguage) {
    let text = normalizeReaderText(sentence);
    if (!plainLanguage) {
      return text;
    }

    return text
      .replace(/\butilize\b/gi, "use")
      .replace(/\bapproximately\b/gi, "about")
      .replace(/\badditional\b/gi, "more")
      .replace(/\bcommence\b/gi, "start")
      .replace(/\bterminate\b/gi, "end")
      .replace(/\bsubsequently\b/gi, "then");
  }

  function formatExtractiveSummary(sentences, summaryOptions) {
    if (summaryOptions.format === "paragraph") {
      return sentences.join(" ");
    }

    if (summaryOptions.format === "actions") {
      return sentences.map((sentence) => `- ${sentence}`).join("\n");
    }

    return sentences.map((sentence) => `- ${sentence}`).join("\n");
  }

  function normalizeSummaryText(text) {
    return String(text || "")
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  async function getCachedSummary(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(SUMMARY_CACHE_KEY, (result) => {
        const cache = withSummaryCache(result[SUMMARY_CACHE_KEY]);
        const entry = cache.entries[key];
        if (!entry) {
          resolve(null);
          return;
        }

        cache.entries[key].lastUsed = new Date().toISOString();
        chrome.storage.local.set({ [SUMMARY_CACHE_KEY]: cache }, () => resolve(entry));
      });
    });
  }

  async function cacheSummary(key, response) {
    return new Promise((resolve) => {
      chrome.storage.local.get(SUMMARY_CACHE_KEY, (result) => {
        const cache = upsertSummaryCache(withSummaryCache(result[SUMMARY_CACHE_KEY]), key, {
          summary: response.summary,
          method: response.method,
          methodLabel: response.methodLabel,
          sourceLength: response.sourceLength,
          title: response.title,
          url: response.url
        });
        chrome.storage.local.set({ [SUMMARY_CACHE_KEY]: cache }, resolve);
      });
    });
  }

  async function hashText(text) {
    const value = String(text || "");
    const cryptoApi = globalThis.crypto;
    if (cryptoApi && cryptoApi.subtle && typeof TextEncoder !== "undefined") {
      const bytes = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(value));
      return Array.from(new Uint8Array(bytes))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    }

    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return String(hash >>> 0);
  }

  async function readCurrentPage() {
    if (!("speechSynthesis" in window)) {
      return { ok: false, message: "Speech synthesis is not available in this browser." };
    }

    const selectedText = String(window.getSelection ? window.getSelection() : "").trim();
    const items = selectedText ? getSpeechItemsFromText(selectedText) : getReadableSpeechItems();
    const text = items.map((item) => item.text).join(" ").replace(/\s+/g, " ").trim().slice(0, 24000);

    if (!text) {
      return { ok: false, message: "No readable text found on this page." };
    }

    stopSpeech();

    const voices = await getSpeechVoices();
    const documentLanguage = inferSpeechLanguage(text) || getDocumentLanguage() || navigator.language || "";
    const fallbackVoice = chooseSpeechVoice(voices, text);
    const chunks = splitSpeechItems(items, documentLanguage);
    speakSpeechChunks(chunks, voices, fallbackVoice, documentLanguage);

    const languageCount = countSpeechLanguages(chunks);
    const voiceLabel = fallbackVoice ? ` with ${fallbackVoice.name} (${fallbackVoice.lang})` : "";
    const segmentLabel = chunks.length === 1 ? "1 segment" : `${chunks.length} segments`;
    const languageLabel = languageCount > 1 ? ` across ${languageCount} languages` : "";
    return { ok: true, message: selectedText ? `Reading selected text${voiceLabel}.` : `Reading page content${voiceLabel} in ${segmentLabel}${languageLabel}.` };
  }

  async function readProvidedText(text, label) {
    if (!("speechSynthesis" in window)) {
      return { ok: false, message: "Speech synthesis is not available in this browser." };
    }

    const normalized = normalizeSpeechText(text).slice(0, 16000);
    if (!normalized) {
      return { ok: false, message: "No text provided to read." };
    }

    stopSpeech();
    const voices = await getSpeechVoices();
    const documentLanguage = inferSpeechLanguage(normalized) || getDocumentLanguage() || navigator.language || "";
    const fallbackVoice = chooseSpeechVoice(voices, normalized);
    const chunks = splitSpeechItems(getSpeechItemsFromText(normalized), documentLanguage);
    speakSpeechChunks(chunks, voices, fallbackVoice, documentLanguage);

    const segmentLabel = chunks.length === 1 ? "1 segment" : `${chunks.length} segments`;
    return { ok: true, message: `Reading ${label || "text"} in ${segmentLabel}.` };
  }

  function stopSpeech() {
    speechSessionId += 1;
    if (speechPauseTimer) {
      window.clearTimeout(speechPauseTimer);
      speechPauseTimer = null;
    }
    activeSpeech = null;
    removeSpeechHighlight();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function speakSpeechChunks(chunks, voices, fallbackVoice, fallbackLanguage) {
    activeSpeech = {
      chunks,
      voices,
      fallbackVoice,
      fallbackLanguage,
      index: 0,
      sessionId: speechSessionId,
      paused: false
    };

    speakSpeechIndex(0);
  }

  function speakSpeechIndex(index) {
    if (!activeSpeech || activeSpeech.sessionId !== speechSessionId) {
      return;
    }

    const chunks = activeSpeech.chunks;
    if (index < 0 || index >= chunks.length) {
      activeSpeech = null;
      removeSpeechHighlight();
      return;
    }

    activeSpeech.index = index;
    activeSpeech.paused = false;
    const sessionId = activeSpeech.sessionId;
    const chunk = chunks[index];
    updateSpeechHighlight(chunk, index, chunks.length);
    const voice = getSpeechVoiceForChunk(activeSpeech.voices, chunk, activeSpeech.fallbackVoice);
    const language = voice ? voice.lang : chunk.language || activeSpeech.fallbackLanguage || "";
    const utterance = new SpeechSynthesisUtterance(chunk.text);
    utterance.rate = getSpeechRateForChunk(chunk);
    utterance.pitch = getSpeechPitchForChunk(chunk);
    utterance.volume = Number(settings.modes.speech.volume);
    utterance.lang = language || "";

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => {
      if (!activeSpeech || sessionId !== speechSessionId) {
        return;
      }

      if (index >= chunks.length - 1) {
        activeSpeech = null;
        queueNextSpeechChunk(sessionId, 120, removeSpeechHighlight);
        return;
      }

      queueNextSpeechChunk(sessionId, chunk.pauseAfter, () => speakSpeechIndex(index + 1));
    };
    utterance.onerror = () => {
      if (!activeSpeech || sessionId !== speechSessionId) {
        return;
      }

      if (index >= chunks.length - 1) {
        activeSpeech = null;
        queueNextSpeechChunk(sessionId, 80, removeSpeechHighlight);
        return;
      }

      queueNextSpeechChunk(sessionId, 80, () => speakSpeechIndex(index + 1));
    };
    window.speechSynthesis.speak(utterance);
  }

  function pauseSpeech() {
    if (!("speechSynthesis" in window) || !activeSpeech) {
      return { ok: false, message: "Nothing is being read." };
    }

    window.speechSynthesis.pause();
    activeSpeech.paused = true;
    return { ok: true, message: "Reading paused.", status: getSpeechStatus() };
  }

  function resumeSpeech() {
    if (!("speechSynthesis" in window) || !activeSpeech) {
      return { ok: false, message: "Nothing is paused." };
    }

    window.speechSynthesis.resume();
    activeSpeech.paused = false;
    return { ok: true, message: "Reading resumed.", status: getSpeechStatus() };
  }

  function skipSpeech(delta) {
    if (!("speechSynthesis" in window) || !activeSpeech) {
      return { ok: false, message: "Nothing is being read." };
    }

    const nextIndex = clamp(activeSpeech.index + delta, 0, activeSpeech.chunks.length - 1);
    if (nextIndex === activeSpeech.index && delta > 0) {
      return { ok: false, message: "Already at the last segment.", status: getSpeechStatus() };
    }
    if (nextIndex === activeSpeech.index && delta < 0) {
      return { ok: false, message: "Already at the first segment.", status: getSpeechStatus() };
    }

    speechSessionId += 1;
    if (speechPauseTimer) {
      window.clearTimeout(speechPauseTimer);
      speechPauseTimer = null;
    }
    window.speechSynthesis.cancel();
    activeSpeech.sessionId = speechSessionId;
    activeSpeech.paused = false;
    window.setTimeout(() => speakSpeechIndex(nextIndex), 0);
    return { ok: true, message: delta > 0 ? "Skipped to next segment." : "Returned to previous segment.", status: getSpeechStatus() };
  }

  function getSpeechStatus() {
    if (!activeSpeech) {
      return { ok: true, active: false, paused: false, index: 0, total: 0 };
    }

    return {
      ok: true,
      active: true,
      paused: Boolean(activeSpeech.paused || ("speechSynthesis" in window && window.speechSynthesis.paused)),
      index: activeSpeech.index,
      total: activeSpeech.chunks.length,
      text: activeSpeech.chunks[activeSpeech.index] ? activeSpeech.chunks[activeSpeech.index].text : ""
    };
  }

  function updateSpeechHighlight(chunk, index, total) {
    if (!IS_TOP_FRAME || settings.modes.speech.highlight === false) {
      removeSpeechHighlight();
      return;
    }

    if (!speechHighlightHost) {
      speechHighlightHost = document.createElement("div");
      speechHighlightHost.id = "accessiview-speech-highlight-host";
      document.documentElement.appendChild(speechHighlightHost);
      speechHighlightHost.attachShadow({ mode: "open" });
    }

    const root = speechHighlightHost.shadowRoot;
    const focusColors = resolveFocusColors(settings.modes.focus || {});
    const isDark = relativeLuminance(hexToRgb(focusColors.background)) < 0.4;
    const background = settings.modes.contrast.enabled ? resolveContrast(settings.modes.contrast).surface : focusColors.background;
    const text = settings.modes.contrast.enabled ? resolveContrast(settings.modes.contrast).text : focusColors.text;
    const border = settings.modes.contrast.enabled ? resolveContrast(settings.modes.contrast).border : focusColors.link;

    root.innerHTML = `
      <style>
        :host {
          all: initial;
          position: fixed;
          left: max(12px, env(safe-area-inset-left));
          right: max(12px, env(safe-area-inset-right));
          bottom: max(12px, env(safe-area-inset-bottom));
          z-index: 2147483647;
          color-scheme: ${isDark ? "dark" : "light"};
          pointer-events: none;
          font-family: Arial, Helvetica, sans-serif;
        }

        .box {
          width: min(900px, 100%);
          margin: 0 auto;
          padding: 12px 14px;
          border: 3px solid ${border};
          border-radius: 8px;
          color: ${text};
          background: ${background};
          box-shadow: 0 16px 42px rgba(0, 0, 0, 0.28);
          forced-color-adjust: none;
        }

        .meta {
          margin-bottom: 5px;
          color: ${text};
          font-size: 12px;
          font-weight: 700;
          opacity: 0.74;
        }

        .text {
          color: ${text};
          font-size: 18px;
          line-height: 1.5;
        }
      </style>
      <div class="box" role="status" aria-live="polite">
        <div class="meta">Reading ${index + 1} of ${total}</div>
        <div class="text">${escapeHtml(chunk.text)}</div>
      </div>
    `;
  }

  function removeSpeechHighlight() {
    if (speechHighlightHost) {
      speechHighlightHost.remove();
      speechHighlightHost = null;
    }
  }

  function queueNextSpeechChunk(sessionId, delay, callback) {
    if (sessionId !== speechSessionId) {
      return;
    }

    const safeDelay = Math.max(0, Number(delay) || 0);
    if (!safeDelay) {
      callback();
      return;
    }

    speechPauseTimer = window.setTimeout(() => {
      speechPauseTimer = null;
      if (sessionId === speechSessionId) {
        callback();
      }
    }, safeDelay);
  }

  function getSpeechRateForChunk(chunk) {
    const baseRate = Number(settings.modes.speech.rate) || 0.95;
    const adjustment = chunk.type === "heading" ? -0.05 : 0;
    return clamp(baseRate + adjustment, 0.6, 1.8);
  }

  function getSpeechPitchForChunk(chunk) {
    const basePitch = Number(settings.modes.speech.pitch) || 1;
    const adjustment = chunk.type === "heading" ? -0.03 : 0;
    return clamp(basePitch + adjustment, 0.7, 1.4);
  }

  function splitSpeechItems(items, fallbackLanguage) {
    const chunks = [];
    const usefulItems = items
      .map((item) => ({
        type: item.type || "paragraph",
        text: normalizeSpeechText(item.text)
      }))
      .filter((item) => item.text.length >= 2)
      .slice(0, 260);

    usefulItems.forEach((item) => {
      const sentenceChunks = splitSpeechText(item.text, getSpeechMaxLength(item.text));
      sentenceChunks.forEach((text, index) => {
        const isLastInItem = index === sentenceChunks.length - 1;
        const languageParts = splitMixedLanguageText(text, fallbackLanguage);

        languageParts.forEach((part, partIndex) => {
          const isLastPart = partIndex === languageParts.length - 1;
          chunks.push({
            type: item.type,
            text: part.text,
            language: part.language,
            pauseAfter: isLastPart ? getSpeechPause(item.type, isLastInItem) : 0
          });
        });
      });
    });

    return chunks.length ? chunks.slice(0, 360) : [{ type: "paragraph", text: "No readable text found.", language: fallbackLanguage, pauseAfter: 0 }];
  }

  function splitSpeechText(text, maxLength) {
    const normalized = normalizeSpeechText(text);
    if (!normalized) {
      return [];
    }

    const sentencePattern = /[^.!?。！？।။၊؛؟]+[.!?。！？।။၊؛؟]+["')\]]*|[^.!?。！？।။၊؛؟]+$/gu;
    const sentences = Array.from(normalized.matchAll(sentencePattern))
      .map((match) => match[0].trim())
      .filter(Boolean);
    const chunks = [];
    let current = "";

    sentences.forEach((sentence) => {
      if (sentence.length > maxLength) {
        if (current) {
          chunks.push(current);
          current = "";
        }

        chunks.push(...splitLongSpeechSentence(sentence, maxLength));
        return;
      }

      if (`${current} ${sentence}`.trim().length > maxLength) {
        if (current) {
          chunks.push(current);
        }
        current = sentence;
        return;
      }

      current = `${current} ${sentence}`.trim();
    });

    if (current) {
      chunks.push(current);
    }

    return chunks.length ? chunks : splitLongSpeechSentence(normalized, maxLength);
  }

  function splitLongSpeechSentence(text, maxLength) {
    const chunks = [];
    let remaining = String(text || "").trim();

    while (remaining.length > maxLength) {
      const slice = remaining.slice(0, maxLength);
      const breakAt = Math.max(
        slice.lastIndexOf(", "),
        slice.lastIndexOf("; "),
        slice.lastIndexOf(": "),
        slice.lastIndexOf(" - "),
        slice.lastIndexOf(" "),
        slice.lastIndexOf("、"),
        slice.lastIndexOf("，")
      );
      const cut = breakAt > maxLength * 0.45 ? breakAt + 1 : maxLength;
      chunks.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }

    if (remaining) {
      chunks.push(remaining);
    }

    return chunks;
  }

  function getSpeechMaxLength(text) {
    return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0e00-\u0e7f]/.test(text) ? 180 : 420;
  }

  function getSpeechPause(type, isLastInItem) {
    if (settings.modes.speech.naturalPauses === false) {
      return 0;
    }

    const scale = clamp(Number(settings.modes.speech.pauseScale) || 0.8, 0.4, 1.8);
    const sentencePause = 0;
    const typePause = {
      heading: 220,
      quote: 140,
      pre: 140,
      "list-item": 70,
      "table-cell": 50,
      paragraph: 120
    };

    return Math.round((isLastInItem ? typePause[type] || typePause.paragraph : sentencePause) * scale);
  }

  function splitMixedLanguageText(text, fallbackLanguage) {
    const tokenPattern = /(\s+|[A-Za-z][A-Za-z0-9'’._+\-/#&]*|[\u0e00-\u0e7f]+|[\u3040-\u30ff]+|[\uac00-\ud7af]+|[\u0600-\u06ff]+|[\u0590-\u05ff]+|[\u0900-\u097f]+|[\u0980-\u09ff]+|[\u0a00-\u0a7f]+|[\u0a80-\u0aff]+|[\u0b80-\u0bff]+|[\u0c00-\u0c7f]+|[\u0c80-\u0cff]+|[\u0d00-\u0d7f]+|[\u0d80-\u0dff]+|[\u0e80-\u0eff]+|[\u1780-\u17ff]+|[\u1000-\u109f]+|[\u1200-\u137f]+|[\u0370-\u03ff]+|[\u0400-\u04ff]+|[\u4e00-\u9fff]+|[^\s]+)/gu;
    const tokens = Array.from(String(text || "").matchAll(tokenPattern)).map((match) => match[0]);
    const parts = [];
    let currentLanguage = "";
    let currentText = "";

    tokens.forEach((token) => {
      const language = getSpeechTokenLanguage(token, currentLanguage || fallbackLanguage);

      if (/^\s+$/.test(token)) {
        if (currentText) {
          currentText += token;
        }
        return;
      }

      if (currentText && language && currentLanguage && language !== currentLanguage) {
        parts.push({ text: currentText.trim(), language: currentLanguage });
        currentText = "";
      }

      currentLanguage = language || currentLanguage || fallbackLanguage || "";
      currentText += token;
    });

    if (currentText.trim()) {
      parts.push({ text: currentText.trim(), language: currentLanguage || fallbackLanguage || "" });
    }

    return mergeShortSpeechLanguageParts(parts, fallbackLanguage);
  }

  function getSpeechTokenLanguage(token, fallbackLanguage) {
    if (!token || /^\s+$/.test(token)) {
      return fallbackLanguage || "";
    }

    if (/[A-Za-z]/.test(token)) {
      return getPreferredEnglishLanguage();
    }

    return inferSpeechLanguage(token) || fallbackLanguage || "";
  }

  function mergeShortSpeechLanguageParts(parts, fallbackLanguage) {
    const merged = [];

    parts.forEach((part) => {
      if (!part.text) {
        return;
      }

      const previous = merged[merged.length - 1];
      const isPunctuationOnly = !hasSpeechLetters(part.text);

      if (previous && (previous.language === part.language || isPunctuationOnly)) {
        previous.text = `${previous.text} ${part.text}`.replace(/\s+([,.;:!?。！？、，)])/g, "$1");
        return;
      }

      if (part.text.length <= 2 && previous && part.language !== getPreferredEnglishLanguage()) {
        previous.text = `${previous.text} ${part.text}`.trim();
        return;
      }

      merged.push({
        text: normalizeSpeechSpacing(part.text),
        language: part.language || fallbackLanguage || ""
      });
    });

    return merged.length ? merged : [{ text: "", language: fallbackLanguage || "" }];
  }

  function hasSpeechLetters(text) {
    return /[A-Za-z\u0e00-\u0e7f\u3040-\u30ff\uac00-\ud7af\u0600-\u06ff\u0590-\u05ff\u0900-\u097f\u0980-\u09ff\u0a00-\u0a7f\u0a80-\u0aff\u0b80-\u0bff\u0c00-\u0c7f\u0c80-\u0cff\u0d00-\u0d7f\u0d80-\u0dff\u0e80-\u0eff\u1780-\u17ff\u1000-\u109f\u1200-\u137f\u0370-\u03ff\u0400-\u04ff\u4e00-\u9fff]/.test(text);
  }

  function normalizeSpeechSpacing(text) {
    return String(text || "")
      .replace(/\s+([,.;:!?。！？、，)])/g, "$1")
      .replace(/([(])\s+/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getReadableSpeechItems() {
    const readerContent = extractReaderContent();
    const items = [];

    if (readerContent.title) {
      items.push({ type: "heading", text: readerContent.title });
    }

    readerContent.blocks.forEach((block) => {
      items.push({ type: block.type || "paragraph", text: block.text });
    });

    const usefulLength = items.reduce((total, item) => total + normalizeSpeechText(item.text).length, 0);
    if (items.length >= 2 && usefulLength >= 80) {
      return dedupeSpeechItems(items);
    }

    return getSpeechItemsFromText(getReadableText());
  }

  function getSpeechItemsFromText(text) {
    const normalized = normalizeSpeechText(text);
    if (!normalized) {
      return [];
    }

    return normalized
      .split(/\n{2,}|(?<=\.)\s{2,}/u)
      .map(normalizeSpeechText)
      .filter((part) => part.length >= 2)
      .map((part) => ({ type: part.length <= 120 ? "paragraph" : "paragraph", text: part }));
  }

  function dedupeSpeechItems(items) {
    const seen = new Set();

    return items.filter((item) => {
      const text = normalizeSpeechText(item.text);
      const key = text.toLowerCase();

      if (!text || seen.has(key)) {
        return false;
      }

      seen.add(key);
      item.text = text;
      return true;
    });
  }

  function normalizeSpeechText(text) {
    return String(text || "")
      .replace(/[\u200b-\u200f\u202a-\u202e]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/https?:\/\/[^\s)]+/gi, formatSpeechUrl)
      .replace(/\bwww\.[^\s)]+/gi, formatSpeechUrl)
      .replace(/\s*[\|•]\s*/g, ". ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function formatSpeechUrl(value) {
    try {
      const url = /^https?:\/\//i.test(value) ? new URL(value) : new URL(`https://${value}`);
      return `${url.hostname.replace(/^www\./, "")} link`;
    } catch (_error) {
      return "link";
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getSpeechVoices() {
    const voices = window.speechSynthesis.getVoices();

    if (voices.length) {
      return Promise.resolve(voices);
    }

    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        resolve(window.speechSynthesis.getVoices());
      }, 700);

      const handleVoicesChanged = () => {
        cleanup();
        resolve(window.speechSynthesis.getVoices());
      };

      const cleanup = () => {
        window.clearTimeout(timeout);
        window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
      };

      window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
    });
  }

  function chooseSpeechVoice(voices, text) {
    const availableVoices = Array.isArray(voices) ? voices : [];
    const configuredVoice = settings.modes.speech.voiceURI;

    const configured = getConfiguredSpeechVoice(availableVoices);
    if (configured) {
      return configured;
    }

    const language = inferSpeechLanguage(text) || getDocumentLanguage() || navigator.language || "";
    return findVoiceForLanguage(availableVoices, language) ||
      availableVoices.find((voice) => voice.default) ||
      availableVoices[0] ||
      null;
  }

  function getSpeechVoiceForChunk(voices, chunk, fallbackVoice) {
    const availableVoices = Array.isArray(voices) ? voices : [];
    const configured = getConfiguredSpeechVoice(availableVoices);
    const chunkLanguage = normalizeSpeechLanguage(chunk.language);

    if (configured) {
      return configured;
    }

    return findVoiceForLanguage(availableVoices, chunk.language) ||
      (voiceMatchesLanguage(fallbackVoice, chunkLanguage) ? fallbackVoice : null) ||
      availableVoices.find((voice) => voice.default && voiceMatchesLanguage(voice, chunkLanguage)) ||
      null;
  }

  function voiceMatchesLanguage(voice, normalizedLanguage) {
    if (!voice || !normalizedLanguage) {
      return false;
    }

    const voiceLanguage = normalizeSpeechLanguage(voice.lang);
    return voiceLanguage === normalizedLanguage ||
      voiceLanguage.split("-")[0] === normalizedLanguage.split("-")[0];
  }

  function getConfiguredSpeechVoice(voices) {
    const configuredVoice = settings.modes.speech.voiceURI;

    if (!configuredVoice || configuredVoice === "auto") {
      return null;
    }

    return voices.find((voice) => {
      return voice.voiceURI === configuredVoice || `${voice.name} (${voice.lang})` === configuredVoice;
    }) || null;
  }

  function findVoiceForLanguage(voices, language) {
    const normalizedLanguage = normalizeSpeechLanguage(language);

    if (!normalizedLanguage) {
      return null;
    }

    const primaryLanguage = normalizedLanguage.split("-")[0];
    const candidates = voices
      .map((voice) => ({
        voice,
        score: scoreSpeechVoice(voice, normalizedLanguage, primaryLanguage)
      }))
      .filter((item) => item.score > 0)
      .sort((first, second) => second.score - first.score);

    return candidates[0] ? candidates[0].voice : null;
  }

  function scoreSpeechVoice(voice, normalizedLanguage, primaryLanguage) {
    const voiceLanguage = normalizeSpeechLanguage(voice.lang);
    const voicePrimaryLanguage = voiceLanguage.split("-")[0];
    const name = String(voice.name || "").toLowerCase();
    let score = 0;

    if (voiceLanguage === normalizedLanguage) {
      score += 100;
    } else if (voicePrimaryLanguage === primaryLanguage) {
      score += 70;
    } else {
      return 0;
    }

    if (voice.default) {
      score += 12;
    }

    if (voice.localService) {
      score += 8;
    }

    if (/\b(natural|neural|premium|online)\b/.test(name)) {
      score += 6;
    }

    if (/\b(compact|legacy|old)\b/.test(name)) {
      score -= 4;
    }

    return score;
  }

  function countSpeechLanguages(chunks) {
    return new Set(
      chunks
        .map((chunk) => normalizeSpeechLanguage(chunk.language).split("-")[0])
        .filter(Boolean)
    ).size;
  }

  function getPreferredEnglishLanguage() {
    const candidates = [
      getDocumentLanguage(),
      navigator.language || "",
      ...(Array.isArray(navigator.languages) ? navigator.languages : [])
    ];
    const englishCandidate = candidates.find((language) => normalizeSpeechLanguage(language).split("-")[0] === "en");
    return englishCandidate || "en-US";
  }

  function getDocumentLanguage() {
    const languageElement = document.querySelector("[lang]");
    return document.documentElement.lang ||
      (languageElement ? languageElement.getAttribute("lang") : "") ||
      "";
  }

  function inferSpeechLanguage(text) {
    const sample = String(text || "").slice(0, 1200);

    if (/[\u0e00-\u0e7f]/.test(sample)) {
      return "th-TH";
    }

    if (/[\u3040-\u30ff]/.test(sample)) {
      return "ja-JP";
    }

    if (/[\uac00-\ud7af]/.test(sample)) {
      return "ko-KR";
    }

    if (/[\u0600-\u06ff]/.test(sample)) {
      return "ar";
    }

    if (/[\u0590-\u05ff]/.test(sample)) {
      return "he";
    }

    if (/[\u0900-\u097f]/.test(sample)) {
      return "hi-IN";
    }

    if (/[\u0980-\u09ff]/.test(sample)) {
      return "bn";
    }

    if (/[\u0a00-\u0a7f]/.test(sample)) {
      return "pa";
    }

    if (/[\u0a80-\u0aff]/.test(sample)) {
      return "gu";
    }

    if (/[\u0b80-\u0bff]/.test(sample)) {
      return "ta";
    }

    if (/[\u0c00-\u0c7f]/.test(sample)) {
      return "te";
    }

    if (/[\u0c80-\u0cff]/.test(sample)) {
      return "kn";
    }

    if (/[\u0d00-\u0d7f]/.test(sample)) {
      return "ml";
    }

    if (/[\u0d80-\u0dff]/.test(sample)) {
      return "si";
    }

    if (/[\u0e80-\u0eff]/.test(sample)) {
      return "lo";
    }

    if (/[\u1780-\u17ff]/.test(sample)) {
      return "km";
    }

    if (/[\u1000-\u109f]/.test(sample)) {
      return "my";
    }

    if (/[\u1200-\u137f]/.test(sample)) {
      return "am";
    }

    if (/[\u0370-\u03ff]/.test(sample)) {
      return "el";
    }

    if (/[\u0400-\u04ff]/.test(sample)) {
      return "ru-RU";
    }

    if (/[\u4e00-\u9fff]/.test(sample)) {
      return "zh-CN";
    }

    return "";
  }

  function normalizeSpeechLanguage(language) {
    return String(language || "").trim().replace("_", "-").toLowerCase();
  }

  function getReadableText() {
    const main = findMainContent();
    return (main && main.innerText) || document.body.innerText || document.body.textContent || "";
  }

  boot();
})();
