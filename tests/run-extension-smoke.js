const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const vm = require("vm");

function requirePlaywright() {
  try {
    return require("playwright");
  } catch (_error) {
    return require("C:/Users/CPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
  }
}

const { chromium } = requirePlaywright();

const projectRoot = path.resolve(__dirname, "..");
const fixtureRoot = path.join(__dirname, "fixtures");
const edgePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const allowedPermissions = new Set(["storage", "activeTab", "sidePanel"]);
const requiredCoverageCases = [
  "manifest-security",
  "simplify-main-content",
  "focus-reader-overlay",
  "contrast-and-text",
  "reduce-motion",
  "reading-guide-keyboard",
  "navigation-helpers",
  "form-helper",
  "cognitive-support",
  "local-summary",
  "popup-options-regression"
];
const minWebsitesPerCoverageCategory = 20;

function validateManifest() {
  const manifestPath = path.join(projectRoot, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const contentScripts = manifest.content_scripts || [];
  const contentScriptFiles = contentScripts.flatMap((entry) => entry.js || []);
  const permissions = manifest.permissions || [];
  const unexpectedPermissions = permissions.filter((permission) => !allowedPermissions.has(permission));
  const extensionPagesCsp = manifest.content_security_policy && manifest.content_security_policy.extension_pages;

  return {
    manifestVersion: manifest.manifest_version,
    hasServiceWorker: manifest.background && manifest.background.service_worker === "background.js",
    hasSettingsBeforeContent: contentScriptFiles.indexOf("shared/settings.js") > -1 &&
      contentScriptFiles.indexOf("shared/settings.js") < contentScriptFiles.indexOf("content.js"),
    hasDocumentStartScrollScript: contentScripts.some((entry) => (
      (entry.js || []).includes("page-scroll.js") &&
      entry.run_at === "document_start" &&
      entry.world === "MAIN"
    )),
    allFramesContentScripts: contentScripts.every((entry) => entry.all_frames === true),
    unexpectedPermissions,
    unsafeCsp: extensionPagesCsp ? /'unsafe-eval'|'unsafe-inline'/.test(extensionPagesCsp) : false
  };
}

function validateAutomationCoverage() {
  const coveragePath = path.join(projectRoot, "tests", "automation-coverage.json");
  const coverage = JSON.parse(fs.readFileSync(coveragePath, "utf8"));
  const featureTestCases = Array.isArray(coverage.featureTestCases) ? coverage.featureTestCases : [];
  const websiteCategories = Array.isArray(coverage.websiteCategories) ? coverage.websiteCategories : [];
  const websiteCatalog = Array.isArray(coverage.websiteCatalog) ? coverage.websiteCatalog : [];
  const testCaseIds = new Set(featureTestCases.map((testCase) => testCase.id));
  const websiteIds = new Set(websiteCatalog.map((website) => website.id));
  const duplicateTestCases = featureTestCases
    .map((testCase) => testCase.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  const duplicateWebsites = websiteCatalog
    .map((website) => website.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  const categoryWebsiteIds = websiteCategories.flatMap((category) => (
    Array.isArray(category.websites) ? category.websites.map((website) => `${category.id}:${website.id}`) : []
  ));
  const duplicateCategoryWebsites = categoryWebsiteIds
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  const missingRequiredCases = requiredCoverageCases.filter((id) => !testCaseIds.has(id));
  const websitesWithUnknownCases = websiteCatalog.filter((website) => (
    !Array.isArray(website.recommendedCases) ||
    website.recommendedCases.some((id) => !testCaseIds.has(id))
  ));
  const websitesWithInvalidUrls = websiteCatalog.filter((website) => {
    try {
      const parsed = new URL(website.url);
      return parsed.protocol !== "https:";
    } catch (_error) {
      return true;
    }
  });
  const categoryListsWithUnknownCases = websiteCategories.filter((category) => (
    !Array.isArray(category.recommendedCases) ||
    category.recommendedCases.some((id) => !testCaseIds.has(id))
  ));
  const categoryWebsitesWithInvalidUrls = websiteCategories.flatMap((category) => (
    Array.isArray(category.websites) ? category.websites
      .filter((website) => {
        try {
          const parsed = new URL(website.url);
          return parsed.protocol !== "https:";
        } catch (_error) {
          return true;
        }
      })
      .map((website) => `${category.id}:${website.id}`) : [`${category.id}:missing-websites`]
  ));
  const categoriesBelowMinimum = websiteCategories
    .filter((category) => !Array.isArray(category.websites) || category.websites.length < minWebsitesPerCoverageCategory)
    .map((category) => ({
      category: category.id,
      count: Array.isArray(category.websites) ? category.websites.length : 0
    }));

  return {
    schemaVersion: coverage.schemaVersion,
    safetyRuleCount: Array.isArray(coverage.safetyRules) ? coverage.safetyRules.length : 0,
    testCaseCount: featureTestCases.length,
    websiteCategoryCount: websiteCategories.length,
    websiteCount: websiteCatalog.length,
    categoryWebsiteCount: categoryWebsiteIds.length,
    duplicateTestCases,
    duplicateWebsites,
    duplicateCategoryWebsites,
    missingRequiredCases,
    websitesWithUnknownCases: websitesWithUnknownCases.map((website) => website.id),
    websitesWithInvalidUrls: websitesWithInvalidUrls.map((website) => website.id),
    categoryListsWithUnknownCases: categoryListsWithUnknownCases.map((category) => category.id),
    categoryWebsitesWithInvalidUrls,
    categoriesBelowMinimum,
    includesRegionalCoverage: websiteIds.has("thaiware"),
    includesBuiltInRuleCoverage: websiteIds.has("msn") && websiteIds.has("thaiware") && websiteIds.has("wikipedia")
  };
}

function getFunctionSource(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start === -1) {
    return "";
  }

  const nextFunction = source.indexOf("\n  function ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

function validatePopupActiveTabTargeting() {
  const popupSource = fs.readFileSync(path.join(projectRoot, "popup.js"), "utf8");
  const queryActiveTabSource = getFunctionSource(popupSource, "queryActiveTab");
  const queryActiveTabFallbackSource = getFunctionSource(popupSource, "queryActiveTabFallback");
  const watchActiveTabChangesSource = getFunctionSource(popupSource, "watchActiveTabChanges");
  const sendMessageSource = getFunctionSource(popupSource, "sendMessageToActiveTab");
  const openSidePanelSource = getFunctionSource(popupSource, "openSidePanel");

  return {
    hasActiveTabQueryFallback: queryActiveTabSource.includes("ACCESSIVIEW_GET_ACTIVE_TAB") &&
      queryActiveTabFallbackSource.includes("lastFocusedWindow") &&
      queryActiveTabFallbackSource.includes("currentWindow"),
    refreshesOnTabActivation: watchActiveTabChangesSource.includes("chrome.tabs.onActivated") &&
      watchActiveTabChangesSource.includes("scheduleActiveTabRefresh"),
    refreshesMessageTargetBeforeSend: sendMessageSource.includes("ACCESSIVIEW_SEND_TO_ACTIVE_TAB") &&
      sendMessageSource.includes("queryActiveTab") &&
      sendMessageSource.includes("chrome.tabs.sendMessage(tab.id"),
    opensSidePanelWithCurrentTabContext: openSidePanelSource.includes("currentTab.id") &&
      openSidePanelSource.includes("chrome.sidePanel.open(options)")
  };
}

function validateContentContextInvalidationGuards() {
  const contentSource = fs.readFileSync(path.join(projectRoot, "content.js"), "utf8");
  const bootSource = getFunctionSource(contentSource, "boot");
  const refreshStoredSettingsSource = getFunctionSource(contentSource, "refreshStoredSettingsAndApply");
  const scheduleCurrentTabRefreshSource = getFunctionSource(contentSource, "scheduleCurrentTabSettingsRefresh");
  const watchCurrentTabRefreshSource = getFunctionSource(contentSource, "watchCurrentTabSettingsRefresh");
  const disableFocusSource = getFunctionSource(contentSource, "disableFocusMode");
  const handleQuickActionSource = getFunctionSource(contentSource, "handleQuickAction");
  const saveQuickSettingsSource = getFunctionSource(contentSource, "saveQuickSettings");
  const handleContentPickerClickSource = getFunctionSource(contentSource, "handleContentPickerClick");
  const getCachedSummarySource = getFunctionSource(contentSource, "getCachedSummary");
  const cacheSummarySource = getFunctionSource(contentSource, "cacheSummary");

  return {
    hasSafeApiWrapper: contentSource.includes("function safeChromeApi") &&
      contentSource.includes("Extension context invalidated"),
    guardsBootApiRegistration: bootSource.includes("refreshStoredSettingsAndApply") &&
      refreshStoredSettingsSource.includes("safeStorageGet") &&
      bootSource.includes("safeChromeApi(() => chrome.storage.onChanged.addListener") &&
      bootSource.includes("safeChromeApi(() => chrome.runtime.onMessage.addListener"),
    refreshesCurrentTabsOnly: bootSource.includes("scheduleCurrentTabSettingsRefresh") &&
      scheduleCurrentTabRefreshSource.includes("ACCESSIVIEW_IS_CURRENT_TAB") &&
      scheduleCurrentTabRefreshSource.includes("refreshStoredSettingsAndApply") &&
      watchCurrentTabRefreshSource.includes("visibilitychange") &&
      watchCurrentTabRefreshSource.includes("focus"),
    guardsFocusExitStorageWrite: disableFocusSource.includes("safeStorageSet") &&
      !disableFocusSource.includes("chrome.storage"),
    guardsQuickPanelMessage: handleQuickActionSource.includes("safeRuntimeSendMessage") &&
      !handleQuickActionSource.includes("chrome.runtime.sendMessage"),
    guardsQuickSettingsStorageWrite: saveQuickSettingsSource.includes("safeStorageSet") &&
      !saveQuickSettingsSource.includes("chrome.storage"),
    guardsContentPickerStorageWrite: handleContentPickerClickSource.includes("safeStorageSet") &&
      !handleContentPickerClickSource.includes("chrome.storage"),
    guardsSummaryCacheStorage: getCachedSummarySource.includes("safeStorageGet") &&
      getCachedSummarySource.includes("safeStorageSet") &&
      cacheSummarySource.includes("safeStorageGet") &&
      cacheSummarySource.includes("safeStorageSet")
  };
}

function validateSettingsMergeSafety() {
  const settingsPath = path.join(projectRoot, "shared", "settings.js");
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(settingsPath, "utf8"), sandbox, {
    filename: settingsPath
  });

  const payload = JSON.parse("{\"__proto__\":{\"polluted\":\"yes\"},\"constructor\":{\"prototype\":{\"polluted\":\"constructor\"}},\"modes\":{\"text\":{\"scale\":130}}}");
  const merged = sandbox.AccessiViewConfig.withDefaults(payload);

  return {
    keepsSettingsOverride: merged.modes.text.scale === 130,
    inheritedPollution: merged.polluted || Object.getPrototypeOf(merged).polluted || null,
    hasUnsafeOwnKeys: ["__proto__", "constructor", "prototype"].some((key) => (
      Object.prototype.hasOwnProperty.call(merged, key)
    ))
  };
}

function copyExtensionToTemp() {
  const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), "accessiview-ext-"));
  fs.cpSync(projectRoot, extensionPath, {
    recursive: true,
    filter: (sourcePath) => {
      return !sourcePath.includes(`${path.sep}.git`) &&
        !sourcePath.includes(`${path.sep}tests${path.sep}screenshots`);
    }
  });
  return extensionPath.replace(/\\/g, "/");
}

function startFixtureServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const fileName = path.basename(url.pathname) || "article.html";
    const filePath = path.join(fixtureRoot, fileName);

    if (!filePath.startsWith(fixtureRoot) || !fs.existsSync(filePath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fs.readFileSync(filePath));
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function launchWithExtension(extensionPath) {
  const executablePath = fs.existsSync(edgePath) ? edgePath : chromePath;
  return chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), "accessiview-user-")), {
    headless: false,
    executablePath,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
      "--no-default-browser-check"
    ]
  });
}

async function getExtensionId(context) {
  const worker = context.serviceWorkers()[0] ||
    await context.waitForEvent("serviceworker", { timeout: 15000 });
  return worker.url().split("/")[2];
}

async function setSettings(optionsPage, override) {
  await optionsPage.evaluate((settingsOverride) => new Promise((resolve) => {
    const { STORAGE_KEY, mergeDeep, withDefaults } = globalThis.AccessiViewConfig;
    const settings = withDefaults(mergeDeep(withDefaults({}), settingsOverride));
    chrome.storage.sync.set({ [STORAGE_KEY]: settings }, resolve);
  }), override);
}

async function buildSettings(extensionPage, override) {
  return extensionPage.evaluate((settingsOverride) => {
    const { mergeDeep, withDefaults } = globalThis.AccessiViewConfig;
    return withDefaults(mergeDeep(withDefaults({}), settingsOverride));
  }, override);
}

async function sendMessageToFixture(optionsPage, urlPart, message) {
  return optionsPage.evaluate(({ expectedUrlPart, payload }) => new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      const target = tabs.find((tab) => String(tab.url || "").includes(expectedUrlPart));
      if (!target) {
        resolve({ ok: false, message: "Fixture tab not found." });
        return;
      }

      chrome.tabs.sendMessage(target.id, payload, (response) => {
        const error = chrome.runtime.lastError;
        resolve(error ? { ok: false, message: error.message } : response || { ok: false });
      });
    });
  }), { expectedUrlPart: urlPart, payload: message });
}

async function sendMessageToActiveTab(extensionPage, message) {
  return extensionPage.evaluate((payload) => new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: "ACCESSIVIEW_SEND_TO_ACTIVE_TAB",
      payload
    }, (response) => {
      const error = chrome.runtime.lastError;
      resolve(error ? { ok: false, message: error.message } : response || { ok: false });
    });
  }), message);
}

async function getAccessiViewState(page) {
  return page.evaluate(() => ({
    enabled: document.documentElement.classList.contains("av-enabled"),
    contrast: document.documentElement.classList.contains("av-mode-contrast"),
    focus: document.documentElement.classList.contains("av-mode-focus"),
    url: window.location.href
  }));
}

async function collectReadableColorChecks(page, checks) {
  return page.evaluate((items) => {
    function parseColor(value) {
      const match = String(value || "").match(/^rgba?\(([^)]+)\)$/);
      if (!match) {
        return null;
      }

      const channels = match[1]
        .split(/,\s*|\s+/)
        .filter((part) => part && part !== "/")
        .map((part) => part.endsWith("%") ? Number.parseFloat(part) * 2.55 : Number.parseFloat(part));

      if (channels.length < 3 || channels.slice(0, 3).some((channel) => !Number.isFinite(channel))) {
        return null;
      }

      return {
        r: Math.round(channels[0]),
        g: Math.round(channels[1]),
        b: Math.round(channels[2]),
        a: Number.isFinite(channels[3]) ? Math.min(Math.max(channels[3], 0), 1) : 1
      };
    }

    function blend(top, bottom) {
      const alpha = Math.min(Math.max(top.a, 0), 1);
      return {
        r: Math.round(top.r * alpha + bottom.r * (1 - alpha)),
        g: Math.round(top.g * alpha + bottom.g * (1 - alpha)),
        b: Math.round(top.b * alpha + bottom.b * (1 - alpha)),
        a: 1
      };
    }

    function luminance(color) {
      const channels = [color.r, color.g, color.b].map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    }

    function contrastRatio(first, second) {
      const lighter = Math.max(luminance(first), luminance(second));
      const darker = Math.min(luminance(first), luminance(second));
      return (lighter + 0.05) / (darker + 0.05);
    }

    function getCanvasColor() {
      const rootColor = parseColor(getComputedStyle(document.documentElement).backgroundColor);
      return rootColor && rootColor.a > 0.15 ? blend(rootColor, { r: 255, g: 255, b: 255, a: 1 }) : { r: 255, g: 255, b: 255, a: 1 };
    }

    function getReadableBackground(element) {
      let current = element;
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        const color = parseColor(getComputedStyle(current).backgroundColor);
        if (color && color.a > 0.15) {
          return blend(color, getCanvasColor());
        }
        current = current.parentElement || (current.getRootNode && current.getRootNode().host) || null;
      }
      return getCanvasColor();
    }

    return items.map((item) => {
      const element = document.querySelector(item.selector);
      if (!element) {
        return Object.assign({}, item, { found: false, ratio: 0, readable: false });
      }

      const style = getComputedStyle(element);
      const foreground = parseColor(style.webkitTextFillColor) || parseColor(style.color);
      const background = getReadableBackground(element);
      const ratio = foreground && background ? contrastRatio(foreground, background) : 0;
      return Object.assign({}, item, {
        found: true,
        color: style.color,
        textFillColor: style.webkitTextFillColor,
        background: `rgb(${background.r}, ${background.g}, ${background.b})`,
        ratio,
        readable: ratio >= item.minimum
      });
    });
  }, checks);
}

async function validateReadableColorFallbacks(context, extensionPage, baseUrl) {
  const badWhitePalette = {
    background: "#ffffff",
    surface: "#ffffff",
    text: "#ffffff",
    link: "#ffffff",
    border: "#ffffff"
  };

  await setSettings(extensionPage, {
    enabled: true,
    modes: {
      contrast: Object.assign({ enabled: true, preset: "custom" }, badWhitePalette)
    }
  });

  const contrastPage = await context.newPage();
  await contrastPage.goto(`${baseUrl}/form.html?colors=contrast`);
  await contrastPage.waitForFunction(() => document.documentElement.classList.contains("av-mode-contrast"));
  const contrastChecks = await collectReadableColorChecks(contrastPage, [
    { mode: "contrast", selector: "body", minimum: 4.5 },
    { mode: "contrast", selector: "input", minimum: 4.5 },
    { mode: "contrast", selector: "button", minimum: 4.5 }
  ]);
  await contrastPage.close();

  await setSettings(extensionPage, {
    enabled: true,
    modes: {
      focus: { enabled: true, textOnly: false, background: "#ffffff", text: "#ffffff", link: "#ffffff" }
    }
  });

  const focusPage = await context.newPage();
  await focusPage.goto(`${baseUrl}/article.html?colors=focus`);
  await focusPage.waitForFunction(() => document.querySelector("[data-av-main='true']"));
  const focusChecks = await collectReadableColorChecks(focusPage, [
    { mode: "focus", selector: "[data-av-main='true']", minimum: 4.5 },
    { mode: "focus", selector: "[data-av-main='true'] a", minimum: 3 }
  ]);
  await focusPage.close();

  await setSettings(extensionPage, {
    enabled: true,
    modes: {
      simplify: { enabled: true, background: "#ffffff", text: "#ffffff", link: "#ffffff" }
    }
  });

  const simplifyPage = await context.newPage();
  await simplifyPage.goto(`${baseUrl}/article.html?colors=simplify`);
  await simplifyPage.waitForFunction(() => document.querySelector("[data-av-simplify-main='true']"));
  const simplifyChecks = await collectReadableColorChecks(simplifyPage, [
    { mode: "simplify", selector: "[data-av-simplify-main='true']", minimum: 4.5 },
    { mode: "simplify", selector: "[data-av-simplify-main='true'] a", minimum: 3 },
    { mode: "simplify", selector: ".printables-like-showcase h2", minimum: 4.5 },
    { mode: "simplify", selector: ".printables-like-showcase a", minimum: 3 },
    { mode: "simplify", selector: ".stubborn-same-color", minimum: 4.5 }
  ]);
  await simplifyPage.close();

  const checks = contrastChecks.concat(focusChecks, simplifyChecks);
  return {
    checks,
    allReadable: checks.every((check) => check.found && check.readable)
  };
}

async function validateActiveTabMessageBridge(context, extensionPage, baseUrl) {
  const firstPage = await context.newPage();
  const secondPage = await context.newPage();

  try {
    await setSettings(extensionPage, { enabled: false });
    await firstPage.goto(`${baseUrl}/article.html?target=first`);
    await secondPage.goto(`${baseUrl}/article.html?target=second`);
    await firstPage.waitForSelector("main");
    await secondPage.waitForSelector("main");

    const firstReady = await sendMessageToFixture(extensionPage, "/article.html?target=first", {
      type: "ACCESSIVIEW_GET_STATUS"
    });
    const secondReady = await sendMessageToFixture(extensionPage, "/article.html?target=second", {
      type: "ACCESSIVIEW_GET_STATUS"
    });

    const contrastSettings = await buildSettings(extensionPage, {
      enabled: true,
      modes: {
        contrast: { enabled: true, preset: "dark" }
      }
    });
    await firstPage.bringToFront();
    await setSettings(extensionPage, {
      enabled: true,
      modes: {
        contrast: { enabled: true, preset: "dark" }
      }
    });
    await secondPage.waitForTimeout(120);
    const secondAfterContrastStorageWrite = await getAccessiViewState(secondPage);
    const firstResponse = await sendMessageToActiveTab(extensionPage, {
      type: "ACCESSIVIEW_APPLY_SETTINGS",
      settings: contrastSettings,
      scope: "global"
    });
    await firstPage.waitForFunction(() => document.documentElement.classList.contains("av-mode-contrast"));
    const secondBeforeSwitch = await getAccessiViewState(secondPage);

    const focusSettings = await buildSettings(extensionPage, {
      enabled: true,
      modes: {
        focus: { enabled: true, textOnly: true }
      }
    });
    await secondPage.bringToFront();
    await setSettings(extensionPage, {
      enabled: true,
      modes: {
        focus: { enabled: true, textOnly: true }
      }
    });
    await firstPage.waitForTimeout(120);
    const firstAfterFocusStorageWrite = await getAccessiViewState(firstPage);
    const secondResponse = await sendMessageToActiveTab(extensionPage, {
      type: "ACCESSIVIEW_APPLY_SETTINGS",
      settings: focusSettings,
      scope: "global"
    });
    await secondPage.waitForFunction(() => document.documentElement.classList.contains("av-mode-focus"));

    const firstAfterSwitch = await getAccessiViewState(firstPage);
    const secondAfterSwitch = await getAccessiViewState(secondPage);
    await firstPage.bringToFront();
    await firstPage.waitForFunction(() => (
      document.documentElement.classList.contains("av-mode-focus") &&
      !document.documentElement.classList.contains("av-mode-contrast")
    ));
    const firstAfterReturn = await getAccessiViewState(firstPage);

    return {
      firstReady: Boolean(firstReady && firstReady.ok),
      secondReady: Boolean(secondReady && secondReady.ok),
      firstResponseTarget: firstResponse && firstResponse.targetTab ? firstResponse.targetTab.url : "",
      secondResponseTarget: secondResponse && secondResponse.targetTab ? secondResponse.targetTab.url : "",
      storageWriteDidNotApplyContrastToSecond: !secondAfterContrastStorageWrite.contrast,
      storageWriteDidNotApplyFocusToFirst: !firstAfterFocusStorageWrite.focus,
      firstReceivedInitialContrast: firstAfterSwitch.contrast,
      secondStayedUntouchedBeforeSwitch: !secondBeforeSwitch.contrast && !secondBeforeSwitch.focus,
      secondReceivedFocusAfterSwitch: secondAfterSwitch.focus,
      firstDidNotReceiveSecondFocus: !firstAfterSwitch.focus,
      firstAppliedCurrentFocusOnReturn: firstAfterReturn.focus,
      firstClearedPreviousContrastOnReturn: !firstAfterReturn.contrast
    };
  } finally {
    await firstPage.close().catch(() => {});
    await secondPage.close().catch(() => {});
  }
}

async function run() {
  const manifestResult = validateManifest();
  const automationCoverageResult = validateAutomationCoverage();
  const popupActiveTabTargetingResult = validatePopupActiveTabTargeting();
  const contentContextGuardResult = validateContentContextInvalidationGuards();
  const settingsMergeSafetyResult = validateSettingsMergeSafety();
  const extensionPath = copyExtensionToTemp();
  const server = await startFixtureServer();
  const context = await launchWithExtension(extensionPath);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const extensionId = await getExtensionId(context);
    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);
    await optionsPage.waitForSelector("[data-preset]");
    const optionsResult = await optionsPage.evaluate(() => ({
      hasSummaryEngine: Boolean(document.querySelector("[data-path='summary.engine']")),
      hasSummaryCacheClear: Boolean(document.getElementById("clearSummaryCache")),
      hasSiteRuleManager: Boolean(
        document.getElementById("siteRuleSelect") &&
        document.getElementById("saveSiteRule") &&
        document.getElementById("validateSiteRule") &&
        document.getElementById("siteRuleMainSelectors")
      ),
      hasDisabledButtonStyle: (() => {
        const button = document.getElementById("applyProfile");
        if (!button || !button.disabled) {
          return false;
        }

        const style = getComputedStyle(button);
        return style.cursor === "not-allowed" && Number.parseFloat(style.opacity) < 1;
      })(),
      hasReadableActivePresetDescription: (() => {
        const button = document.querySelector("[data-preset]");
        const description = button && button.querySelector("span");
        if (!button || !description) {
          return false;
        }
        button.classList.add("is-active");
        return getComputedStyle(description).color === "rgb(255, 255, 255)";
      })()
    }));
    const activeTabBridgeResult = await validateActiveTabMessageBridge(context, optionsPage, baseUrl);

    await setSettings(optionsPage, {
      enabled: true,
      ui: {
        floatingButton: true
      },
      modes: {
        simplify: { enabled: true },
        forms: { enabled: true },
        cognitive: { enabled: true },
        navigation: { enabled: true, showAltWarnings: true, keyboardMap: true },
        guide: { enabled: true, style: "line" }
      }
    });

    const articlePage = await context.newPage();
    await articlePage.goto(`${baseUrl}/article.html`);
    await articlePage.waitForFunction(() => document.documentElement.classList.contains("av-mode-simplify"));
    const articleResult = await articlePage.evaluate(() => ({
      simplifyMain: Boolean(document.querySelector("[data-av-simplify-main='true']")),
      missingAlt: document.querySelectorAll("[data-av-missing-alt='true']").length,
      cognitiveChunks: document.querySelectorAll("[data-av-cognitive-paragraph='true']").length,
      keyboardMap: Boolean(document.getElementById("accessiview-keyboard-map-host")),
      guide: Boolean(document.getElementById("accessiview-reading-guide")),
      quickButton: Boolean(document.getElementById("accessiview-quick-button-host")),
      quickButtonPanelRole: (() => {
        const host = document.getElementById("accessiview-quick-button-host");
        const launcher = host && host.shadowRoot && host.shadowRoot.querySelector(".launcher");
        if (!launcher) {
          return "";
        }
        launcher.click();
        const panel = host.shadowRoot.querySelector(".panel");
        return panel ? panel.getAttribute("role") : "";
      })()
    }));
    const auditIssueResult = await sendMessageToFixture(optionsPage, "/article.html", {
      type: "ACCESSIVIEW_GET_AUDIT"
    });
    const firstAuditIssue = auditIssueResult && auditIssueResult.audit
      ? (auditIssueResult.audit.recommendations || []).flatMap((recommendation) => recommendation.issues || [])[0]
      : null;
    const auditHighlightResult = firstAuditIssue && firstAuditIssue.selector
      ? await sendMessageToFixture(optionsPage, "/article.html", {
        type: "ACCESSIVIEW_HIGHLIGHT_SELECTOR",
        selector: firstAuditIssue.selector,
        label: firstAuditIssue.label
      })
      : { ok: false };
    const auditHighlightDomResult = await articlePage.evaluate(() => Boolean(document.getElementById("accessiview-audit-highlight-host")));

    const resultsPage = await context.newPage();
    await resultsPage.goto(`${baseUrl}/results.html`);
    await resultsPage.waitForFunction(() => document.documentElement.classList.contains("av-mode-simplify"));
    const resultsSimplifyResult = await resultsPage.evaluate(() => {
      const main = document.querySelector("[data-av-simplify-main='true']");
      const hiddenReasons = Array.from(document.querySelectorAll("[data-av-simplify-hidden]"))
        .map((element) => element.getAttribute("data-av-simplify-hidden"))
        .filter(Boolean);

      return {
        mainId: main ? main.id : "",
        mainClass: main ? main.className : "",
        mainTag: main ? main.tagName : "",
        resultCards: main ? main.querySelectorAll(".result-card").length : 0,
        pickedSingleCard: Boolean(main && main.classList.contains("result-card")),
        markedRelatedPanel: Boolean(document.querySelector(".related-panel[data-av-simplify-hidden='sidebar']")),
        markedSearchForm: Boolean(document.querySelector(".search-form[data-av-simplify-hidden='form']")),
        hiddenReasons
      };
    });
    await resultsPage.close();
    const overlayTabOrderResult = await sendMessageToFixture(optionsPage, "/article.html", {
      type: "ACCESSIVIEW_GET_TAB_ORDER"
    });
    await setSettings(optionsPage, {
      enabled: true
    });

    const structurePage = await context.newPage();
    await structurePage.goto(`${baseUrl}/article.html?structure=1`);
    await structurePage.waitForSelector("main");
    const structureResult = await sendMessageToFixture(optionsPage, "/article.html?structure=1", {
      type: "ACCESSIVIEW_GET_STRUCTURE_MAP"
    });
    const tabOrderResult = await sendMessageToFixture(optionsPage, "/article.html?structure=1", {
      type: "ACCESSIVIEW_GET_TAB_ORDER"
    });
    await structurePage.close();
    const summaryResult = await sendMessageToFixture(optionsPage, "/article.html", {
      type: "ACCESSIVIEW_SUMMARIZE_PAGE",
      options: {
        engine: "extractive",
        length: "short",
        format: "bullets",
        plainLanguage: true,
        cache: false
      }
    });
    const speechProgressResult = await sendMessageToFixture(optionsPage, "/article.html", {
      type: "ACCESSIVIEW_GET_SPEECH_PROGRESS"
    });
    await setSettings(optionsPage, {
      enabled: true,
      modes: {
        focus: { enabled: true, textOnly: true }
      }
    });

    const focusPage = await context.newPage();
    await focusPage.goto(`${baseUrl}/article.html`);
    await focusPage.waitForSelector("#accessiview-reader-host");
    const focusReaderResult = await focusPage.evaluate(() => {
      const host = document.getElementById("accessiview-reader-host");
      const link = host && host.shadowRoot && host.shadowRoot.querySelector("article a");
      return {
        hasReader: Boolean(host),
        linkText: link ? link.textContent.trim() : "",
        linkHref: link ? link.href : "",
        linkTabIndex: link ? link.tabIndex : null
      };
    });
    await setSettings(optionsPage, {
      enabled: true,
      modes: {
        forms: { enabled: true }
      }
    });

    const formPage = await context.newPage();
    await formPage.goto(`${baseUrl}/form.html`);
    await formPage.waitForFunction(() => document.documentElement.classList.contains("av-mode-forms"));
    const formResult = await formPage.evaluate(() => ({
      required: document.querySelectorAll("[data-av-form-required='true']").length,
      unlabeled: document.querySelectorAll("[data-av-form-unlabeled='true']").length,
      invalid: document.querySelectorAll("[data-av-form-invalid='true']").length
    }));
    const formSummaryResult = await sendMessageToFixture(optionsPage, "/form.html", {
      type: "ACCESSIVIEW_SUMMARIZE_PAGE",
      options: {
        engine: "extractive",
        length: "short",
        format: "bullets",
        plainLanguage: true,
        cache: false
      }
    });
    const readableColorResult = await validateReadableColorFallbacks(context, optionsPage, baseUrl);

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForSelector("#pickContent");
    const popupResult = await popupPage.evaluate(() => ({
      presets: document.querySelectorAll("[data-preset]").length,
      hasPicker: Boolean(document.getElementById("pickContent")),
      hasUndo: Boolean(document.getElementById("undoSettings")),
      hasSpeechControls: Boolean(document.getElementById("pauseRead") && document.getElementById("nextRead")),
      hasSidePanelButton: Boolean(document.getElementById("openSidePanel")),
      hasSummaryControls: Boolean(document.getElementById("summarizePage") && document.getElementById("summaryOutput")),
      hasSetupWizard: Boolean(document.getElementById("applySetupWizard") && document.querySelectorAll("[data-setup-need]").length >= 6),
      hasSpeechResumeControls: Boolean(document.getElementById("resumeSavedRead") && document.getElementById("bookmarkRead") && document.getElementById("speechBookmarks")),
      disablesPrerequisiteActions: Boolean(
        document.getElementById("applyAuditFixes") &&
        document.getElementById("applyAuditFixes").disabled &&
        document.getElementById("readSummary") &&
        document.getElementById("readSummary").disabled
      ),
      hasDisabledButtonStyle: (() => {
        const button = document.getElementById("readSummary");
        if (!button || !button.disabled) {
          return false;
        }

        const style = getComputedStyle(button);
        return style.cursor === "not-allowed" && Number.parseFloat(style.opacity) < 1;
      })(),
      hasStructureControls: Boolean(document.getElementById("inspectStructure") && document.getElementById("inspectTabOrder") && document.getElementById("structureOutput")),
      hasNamedModeSwitches: (() => {
        const switches = Array.from(document.querySelectorAll(".toggle input[data-path$='.enabled']"));
        return switches.length >= 10 && switches.every((control) => Boolean(control.getAttribute("aria-label")));
      })(),
      hasSwitchFocusStyle: Array.from(document.styleSheets).some((styleSheet) => {
        try {
          return Array.from(styleSheet.cssRules).some((rule) => rule.selectorText === ".toggle input:focus-visible + span");
        } catch (_error) {
          return false;
        }
      }),
      hasReadableActivePresetDescription: (() => {
        const button = document.querySelector("[data-preset]");
        const description = button && button.querySelector("span");
        if (!button || !description) {
          return false;
        }
        button.classList.add("is-active");
        return getComputedStyle(description).color === "rgb(255, 255, 255)";
      })(),
      hasLiveStatusRegions: ["pageStatus", "auditSummary", "summaryStatus", "speechStatus"].every((id) => {
        const element = document.getElementById(id);
        return Boolean(element && element.getAttribute("role") === "status" && element.getAttribute("aria-live") === "polite");
      }),
      hasSummaryResultRegion: (() => {
        const element = document.getElementById("summaryOutput");
        return Boolean(element && element.getAttribute("role") === "region" && element.getAttribute("aria-live") === "polite");
      })()
    }));

    const result = { manifestResult, automationCoverageResult, popupActiveTabTargetingResult, contentContextGuardResult, settingsMergeSafetyResult, optionsResult, activeTabBridgeResult, articleResult, auditIssueResult, auditHighlightResult, auditHighlightDomResult, resultsSimplifyResult, overlayTabOrderResult, structureResult, tabOrderResult, summaryResult, speechProgressResult, focusReaderResult, formResult, formSummaryResult, readableColorResult, popupResult };
    console.log(JSON.stringify(result, null, 2));

    if (manifestResult.manifestVersion !== 3 || !manifestResult.hasServiceWorker || !manifestResult.hasSettingsBeforeContent || !manifestResult.hasDocumentStartScrollScript || !manifestResult.allFramesContentScripts) {
      throw new Error("Manifest failed AccessiView extension wiring assertions.");
    }
    if (manifestResult.unexpectedPermissions.length || manifestResult.unsafeCsp) {
      throw new Error("Manifest failed AccessiView permission or CSP assertions.");
    }
    if (automationCoverageResult.schemaVersion !== 1 || automationCoverageResult.safetyRuleCount < 5 || automationCoverageResult.testCaseCount < requiredCoverageCases.length || automationCoverageResult.websiteCount < 20 || automationCoverageResult.websiteCategoryCount < 5 || automationCoverageResult.categoryWebsiteCount < automationCoverageResult.websiteCategoryCount * minWebsitesPerCoverageCategory) {
      throw new Error("Automation coverage catalog is missing required breadth.");
    }
    if (automationCoverageResult.duplicateTestCases.length || automationCoverageResult.duplicateWebsites.length || automationCoverageResult.duplicateCategoryWebsites.length || automationCoverageResult.missingRequiredCases.length || automationCoverageResult.websitesWithUnknownCases.length || automationCoverageResult.websitesWithInvalidUrls.length || automationCoverageResult.categoryListsWithUnknownCases.length || automationCoverageResult.categoryWebsitesWithInvalidUrls.length || automationCoverageResult.categoriesBelowMinimum.length) {
      throw new Error("Automation coverage catalog failed consistency assertions.");
    }
    if (!automationCoverageResult.includesRegionalCoverage || !automationCoverageResult.includesBuiltInRuleCoverage) {
      throw new Error("Automation coverage catalog is missing regional or built-in site-rule targets.");
    }
    if (!popupActiveTabTargetingResult.hasActiveTabQueryFallback || !popupActiveTabTargetingResult.refreshesOnTabActivation || !popupActiveTabTargetingResult.refreshesMessageTargetBeforeSend || !popupActiveTabTargetingResult.opensSidePanelWithCurrentTabContext) {
      throw new Error("Popup active-tab targeting regression assertions failed.");
    }
    if (!activeTabBridgeResult.firstReady || !activeTabBridgeResult.secondReady || !activeTabBridgeResult.firstResponseTarget.includes("target=first") || !activeTabBridgeResult.secondResponseTarget.includes("target=second") || !activeTabBridgeResult.storageWriteDidNotApplyContrastToSecond || !activeTabBridgeResult.storageWriteDidNotApplyFocusToFirst || !activeTabBridgeResult.firstReceivedInitialContrast || !activeTabBridgeResult.secondStayedUntouchedBeforeSwitch || !activeTabBridgeResult.secondReceivedFocusAfterSwitch || !activeTabBridgeResult.firstDidNotReceiveSecondFocus || !activeTabBridgeResult.firstAppliedCurrentFocusOnReturn || !activeTabBridgeResult.firstClearedPreviousContrastOnReturn) {
      throw new Error("Active tab message bridge failed tab-switch targeting assertions.");
    }
    if (!Object.values(contentContextGuardResult).every(Boolean)) {
      throw new Error("Content script extension-context guard assertions failed.");
    }
    if (!settingsMergeSafetyResult.keepsSettingsOverride || settingsMergeSafetyResult.inheritedPollution || settingsMergeSafetyResult.hasUnsafeOwnKeys) {
      throw new Error("Settings merge failed unsafe key assertions.");
    }
    if (!articleResult.simplifyMain || !articleResult.missingAlt || !articleResult.keyboardMap || !articleResult.guide || !articleResult.quickButton || articleResult.quickButtonPanelRole !== "group") {
      throw new Error("Article fixture failed AccessiView assertions.");
    }
    if (resultsSimplifyResult.mainId !== "results" || !/\bsearch-results\b/.test(resultsSimplifyResult.mainClass) || resultsSimplifyResult.resultCards < 3 || resultsSimplifyResult.pickedSingleCard || !resultsSimplifyResult.markedRelatedPanel || !resultsSimplifyResult.markedSearchForm || !resultsSimplifyResult.hiddenReasons.includes("sidebar") || !resultsSimplifyResult.hiddenReasons.includes("form")) {
      throw new Error("Search results fixture failed Simplified Page reader assertions.");
    }
    if (!structureResult.ok || !structureResult.structure || structureResult.structure.counts.headings < 1 || structureResult.structure.counts.landmarks < 1 || structureResult.structure.counts.missingAlt < 1) {
      throw new Error("Page structure fixture failed AccessiView assertions.");
    }
    if (!overlayTabOrderResult.ok || !overlayTabOrderResult.tabOrder || overlayTabOrderResult.tabOrder.items.some((item) => /accessiview|Open side panel|Focus mode|High contrast|Reduce motion|Turn off on page/i.test(`${item.selector} ${item.label}`))) {
      throw new Error("Tab order fixture included AccessiView overlay controls.");
    }
    if (!tabOrderResult.ok || !tabOrderResult.tabOrder || tabOrderResult.tabOrder.counts.focusTargets < 1 || tabOrderResult.tabOrder.counts.missingNames !== 0 || !tabOrderResult.tabOrder.items[0].selector) {
      throw new Error("Tab order fixture failed AccessiView assertions.");
    }
    if (!optionsResult.hasSummaryEngine || !optionsResult.hasSummaryCacheClear || !optionsResult.hasSiteRuleManager || !optionsResult.hasDisabledButtonStyle || !optionsResult.hasReadableActivePresetDescription) {
      throw new Error("Options fixture failed summary control assertions.");
    }
    if (!auditIssueResult.ok || !auditIssueResult.audit || !(auditIssueResult.audit.issueGroups || []).length || !(auditIssueResult.audit.recommendations || []).some((recommendation) => Array.isArray(recommendation.issues) && recommendation.issues.length) || !auditHighlightResult.ok || !auditHighlightDomResult) {
      throw new Error("Audit issue explorer failed detail or highlight assertions.");
    }
    if (!summaryResult.ok || summaryResult.method !== "extractive" || !String(summaryResult.summary || "").includes("- ") || !Array.isArray(summaryResult.summaryItems) || !summaryResult.summaryItems.length || !summaryResult.summaryItems[0].selector) {
      throw new Error("Summary fixture failed AccessiView assertions.");
    }
    if (!speechProgressResult.ok || speechProgressResult.active || !Array.isArray(speechProgressResult.bookmarks)) {
      throw new Error("Speech progress fixture failed idle status assertions.");
    }
    if (!focusReaderResult.hasReader || focusReaderResult.linkText !== "reader details link" || !focusReaderResult.linkHref.includes("/article.html#details") || focusReaderResult.linkTabIndex < 0) {
      throw new Error("Focus reader failed link preservation assertions.");
    }
    if (!formResult.required || !formResult.unlabeled || !formResult.invalid) {
      throw new Error("Form fixture failed AccessiView assertions.");
    }
    if (formSummaryResult.ok || !String(formSummaryResult.message || "").includes("Summary is disabled")) {
      throw new Error("Sensitive form fixture failed summary privacy assertions.");
    }
    if (!readableColorResult.allReadable) {
      throw new Error("Readable color fallback assertions failed for custom color settings.");
    }
    if (popupResult.presets < 13 || !popupResult.hasPicker || !popupResult.hasUndo || !popupResult.hasSpeechControls || !popupResult.hasSidePanelButton || !popupResult.hasSummaryControls || !popupResult.hasSetupWizard || !popupResult.hasSpeechResumeControls || !popupResult.disablesPrerequisiteActions || !popupResult.hasDisabledButtonStyle || !popupResult.hasStructureControls || !popupResult.hasNamedModeSwitches || !popupResult.hasSwitchFocusStyle || !popupResult.hasReadableActivePresetDescription || !popupResult.hasLiveStatusRegions || !popupResult.hasSummaryResultRegion) {
      throw new Error("Popup fixture failed AccessiView assertions.");
    }
  } finally {
    await context.close();
    server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
