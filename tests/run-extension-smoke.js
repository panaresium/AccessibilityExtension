const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

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

async function run() {
  const manifestResult = validateManifest();
  const automationCoverageResult = validateAutomationCoverage();
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

    const result = { manifestResult, automationCoverageResult, optionsResult, articleResult, summaryResult, focusReaderResult, formResult, formSummaryResult, popupResult };
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
    if (!articleResult.simplifyMain || !articleResult.missingAlt || !articleResult.keyboardMap || !articleResult.guide || !articleResult.quickButton || articleResult.quickButtonPanelRole !== "group") {
      throw new Error("Article fixture failed AccessiView assertions.");
    }
    if (!optionsResult.hasSummaryEngine || !optionsResult.hasSummaryCacheClear || !optionsResult.hasReadableActivePresetDescription) {
      throw new Error("Options fixture failed summary control assertions.");
    }
    if (!summaryResult.ok || summaryResult.method !== "extractive" || !String(summaryResult.summary || "").includes("- ")) {
      throw new Error("Summary fixture failed AccessiView assertions.");
    }
    if (!focusReaderResult.hasReader || focusReaderResult.linkText !== "reader details link" || !focusReaderResult.linkHref.includes("/article.html#details") || focusReaderResult.linkTabIndex < 0) {
      throw new Error("Focus reader failed link preservation assertions.");
    }
    if (!formResult.required || !formResult.unlabeled || !formResult.invalid) {
      throw new Error("Form fixture failed AccessiView assertions.");
    }
<<<<<<< Updated upstream
    if (formSummaryResult.ok || !String(formSummaryResult.message || "").includes("Summary is disabled")) {
      throw new Error("Sensitive form fixture failed summary privacy assertions.");
    }
    if (popupResult.presets < 13 || !popupResult.hasPicker || !popupResult.hasUndo || !popupResult.hasSpeechControls || !popupResult.hasSidePanelButton || !popupResult.hasSummaryControls) {
=======
    if (popupResult.presets < 13 || !popupResult.hasPicker || !popupResult.hasUndo || !popupResult.hasSpeechControls || !popupResult.hasSidePanelButton || !popupResult.hasSummaryControls || !popupResult.hasNamedModeSwitches || !popupResult.hasSwitchFocusStyle || !popupResult.hasReadableActivePresetDescription || !popupResult.hasLiveStatusRegions || !popupResult.hasSummaryResultRegion) {
>>>>>>> Stashed changes
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
