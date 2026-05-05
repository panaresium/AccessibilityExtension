(function initAccessiViewPopup() {
  const {
    STORAGE_KEY,
    SITE_STORAGE_KEY,
    PROFILE_STORAGE_KEY,
    HISTORY_STORAGE_KEY,
    DEFAULT_SETTINGS,
    PRESETS,
    withDefaults,
    withSiteStore,
    withProfileStore,
    withHistoryStore,
    applyPreset,
    removePreset,
    clearActivePreset,
    createProfile,
    removeProfile,
    applyProfile,
    addHistoryEntry,
    removeHistoryEntry,
    getSiteKeyFromUrl,
    getSiteLabelFromUrl,
    hasSiteSettings,
    getEffectiveSettings,
    upsertSiteSettings,
    disableSiteSettings,
    removeSiteSettings,
    removeSiteRule
  } = globalThis.AccessiViewConfig;

  let globalSettings = withDefaults({});
  let siteStore = withSiteStore({});
  let profileStore = withProfileStore({});
  let historyStore = withHistoryStore({});
  let settings = withDefaults({});
  let currentTab = null;
  let currentUrl = "";
  let saveScope = "global";
  let saveTimer = null;
  let pageStatusTimer = null;
  let speechVoices = [];
  let currentAudit = null;
  let currentSummary = null;

  document.addEventListener("DOMContentLoaded", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      currentTab = tabs[0] || null;
      currentUrl = currentTab && /^https?:\/\//.test(currentTab.url || "") ? currentTab.url : "";

      chrome.storage.sync.get(STORAGE_KEY, (syncResult) => {
        globalSettings = withDefaults(syncResult[STORAGE_KEY]);
        chrome.storage.local.get(SITE_STORAGE_KEY, (localResult) => {
          siteStore = withSiteStore(localResult[SITE_STORAGE_KEY]);
          chrome.storage.local.get(PROFILE_STORAGE_KEY, (profileResult) => {
            profileStore = withProfileStore(profileResult[PROFILE_STORAGE_KEY]);
            chrome.storage.local.get(HISTORY_STORAGE_KEY, (historyResult) => {
              historyStore = withHistoryStore(historyResult[HISTORY_STORAGE_KEY]);
              refreshEffectiveSettings();
              renderPresetButtons();
              setupCollapsibleSections();
              bindEvents();
              setupVoiceControls();
              render();
            });
          });
        });
      });
    });
  });

  function bindEvents() {
    document.getElementById("enabled").addEventListener("change", (event) => {
      settings.enabled = event.target.checked;
      saveAndRender();
    });

    document.getElementById("siteSettingsToggle").addEventListener("change", (event) => {
      if (!currentUrl) {
        event.target.checked = false;
        setStatus("Open a normal web page first.");
        return;
      }

      if (event.target.checked) {
        siteStore = upsertSiteSettings(siteStore, currentUrl, settings);
        saveScope = "site";
        saveSiteStore(() => {
          refreshEffectiveSettings();
          render();
          setStatus(`Using settings for ${getSiteLabelFromUrl(currentUrl)}.`);
          applyToActiveTab();
        });
        return;
      }

      siteStore = disableSiteSettings(siteStore, currentUrl);
      saveScope = "global";
      settings = withDefaults(globalSettings);
      saveSiteStore(() => {
        render();
        setStatus("Using global settings.");
        applyToActiveTab();
      });
    });

    document.getElementById("resetSite").addEventListener("click", () => {
      if (!currentUrl) {
        setStatus("Open a normal web page first.");
        return;
      }

      siteStore = removeSiteSettings(siteStore, currentUrl);
      saveScope = "global";
      settings = withDefaults(globalSettings);
      saveSiteStore(() => {
        render();
        setStatus("Site settings cleared.");
        applyToActiveTab();
      });
    });

    document.getElementById("pickContent").addEventListener("click", () => {
      if (!currentUrl) {
        setStatus("Open a normal web page first.");
        return;
      }

      sendMessageToActiveTab({ type: "ACCESSIVIEW_START_CONTENT_PICKER" }, (response) => {
        if (response && response.ok && response.selector) {
          chrome.storage.local.get(SITE_STORAGE_KEY, (result) => {
            siteStore = withSiteStore(result[SITE_STORAGE_KEY]);
            refreshEffectiveSettings();
            render();
            setStatus("Saved main content for this site.");
          });
          return;
        }

        if (response && response.message) {
          setStatus(response.message);
        }
      });
      setStatus("Click the main content area on the page.");
    });

    document.getElementById("clearContentPick").addEventListener("click", () => {
      if (!currentUrl) {
        setStatus("Open a normal web page first.");
        return;
      }

      siteStore = removeSiteRule(siteStore, currentUrl);
      saveSiteStore(() => {
        refreshEffectiveSettings();
        render();
        applyToActiveTab();
        setStatus("Saved content pick cleared.");
      });
    });

    document.getElementById("undoSettings").addEventListener("click", undoLastSettingsChange);

    document.querySelectorAll("[data-path]").forEach((control) => {
      const eventName = control.type === "range" ? "input" : "change";
      control.addEventListener(eventName, () => {
        const value = readControlValue(control);
        setByPath(settings, control.dataset.path, value);
        enableMotionModeWhenConfigured(control.dataset.path, value);
        settings = clearActivePreset(settings);
        saveAndRender();
      });
    });

    document.querySelectorAll("[data-mode-card]").forEach((card) => {
      card.addEventListener("click", (event) => {
        const header = event.target.closest(".mode-title");
        if (!header || !card.contains(header) || event.target.closest("input, select, button, label, textarea, a")) {
          return;
        }

        const path = `modes.${card.dataset.modeCard}.enabled`;
        setByPath(settings, path, !getByPath(settings, path));
        settings = clearActivePreset(settings);
        saveAndRender(true);
      });
    });

    document.querySelectorAll("[data-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        settings = isPresetActive(button.dataset.preset)
          ? removePreset(settings, button.dataset.preset)
          : applyPreset(settings, button.dataset.preset);
        saveAndRender(true);
      });
    });

    document.getElementById("reset").addEventListener("click", () => {
      settings = withDefaults(DEFAULT_SETTINGS);
      saveAndRender(true);
    });

    document.getElementById("openOptions").addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });

    document.getElementById("openSidePanel").addEventListener("click", () => {
      openSidePanel();
    });

    document.getElementById("runAudit").addEventListener("click", () => {
      runPageAudit();
    });

    document.getElementById("applyAuditFixes").addEventListener("click", () => {
      applyAuditRecommendations();
    });

    document.getElementById("inspectStructure").addEventListener("click", () => {
      inspectPageStructure();
    });

    document.getElementById("inspectTabOrder").addEventListener("click", () => {
      inspectTabOrder();
    });

    document.getElementById("summarizePage").addEventListener("click", () => {
      summarizePage();
    });

    document.getElementById("readSummary").addEventListener("click", () => {
      readCurrentSummary();
    });

    document.getElementById("saveProfile").addEventListener("click", () => {
      saveCurrentProfile();
    });

    document.getElementById("profileSelect").addEventListener("change", () => {
      renderProfiles();
    });

    document.getElementById("applyProfile").addEventListener("click", () => {
      const profileId = document.getElementById("profileSelect").value;
      if (!profileId) {
        setStatus("No profile selected.");
        return;
      }

      settings = applyProfile(settings, profileStore, profileId);
      profileStore.activeProfileId = profileId;
      saveProfileStore(() => saveAndRender(true));
    });

    document.getElementById("deleteProfile").addEventListener("click", () => {
      const profileId = document.getElementById("profileSelect").value;
      if (!profileId) {
        setStatus("No profile selected.");
        return;
      }

      profileStore = removeProfile(profileStore, profileId);
      saveProfileStore(() => {
        renderProfiles();
        setStatus("Profile deleted.");
      });
    });

    document.getElementById("readPage").addEventListener("click", () => {
      sendMessageToActiveTab({ type: "ACCESSIVIEW_READ" }, (response) => {
        setStatus(response && response.message ? response.message : "Read command sent.");
        requestSpeechStatus();
      });
    });

    document.getElementById("stopRead").addEventListener("click", () => {
      sendMessageToActiveTab({ type: "ACCESSIVIEW_STOP_READING" }, () => {
        setStatus("Reading stopped.");
        requestSpeechStatus();
      });
    });

    document.getElementById("pauseRead").addEventListener("click", () => {
      sendSpeechControl("ACCESSIVIEW_PAUSE_READING");
    });

    document.getElementById("resumeRead").addEventListener("click", () => {
      sendSpeechControl("ACCESSIVIEW_RESUME_READING");
    });

    document.getElementById("previousRead").addEventListener("click", () => {
      sendSpeechControl("ACCESSIVIEW_PREVIOUS_READING");
    });

    document.getElementById("nextRead").addEventListener("click", () => {
      sendSpeechControl("ACCESSIVIEW_NEXT_READING");
    });

    document.getElementById("showKeyboardMap").addEventListener("click", () => {
      sendMessageToActiveTab({ type: "ACCESSIVIEW_TOGGLE_KEYBOARD_MAP" }, () => {
        setStatus("Keyboard map toggled.");
      });
    });
  }

  function refreshEffectiveSettings() {
    saveScope = currentUrl && hasSiteSettings(siteStore, currentUrl) ? "site" : "global";
    settings = saveScope === "site"
      ? getEffectiveSettings(globalSettings, siteStore, currentUrl)
      : withDefaults(globalSettings);
  }

  function render() {
    document.getElementById("enabled").checked = Boolean(settings.enabled);
    document.getElementById("siteSettingsToggle").checked = saveScope === "site";
    document.getElementById("siteSettingsToggle").disabled = !currentUrl;
    document.getElementById("resetSite").disabled = !currentUrl;
    document.getElementById("siteName").textContent = currentUrl
      ? getSiteLabelFromUrl(currentUrl)
      : "Site-specific settings are unavailable on this page.";
    document.getElementById("scopeStatus").textContent = saveScope === "site"
      ? `Saving changes for ${getSiteLabelFromUrl(currentUrl)}`
      : "Saving changes globally";

    document.querySelectorAll("[data-path]").forEach((control) => {
      const value = getByPath(settings, control.dataset.path);
      writeControlValue(control, value);
    });

    document.querySelectorAll("[data-output]").forEach((output) => {
      const value = getByPath(settings, output.dataset.output);
      const suffix = output.dataset.suffix || "";
      output.textContent = `${formatOutput(value)}${suffix}`;
    });

    document.querySelectorAll("[data-mode-card]").forEach((card) => {
      const mode = card.dataset.modeCard;
      card.classList.toggle("is-on", Boolean(settings.modes[mode] && settings.modes[mode].enabled));
    });

    renderPresetStates();
    renderVoiceControls();
    renderProfiles();
    renderUndoState();
    schedulePageStatusRefresh();
    requestSpeechStatus();
  }

  function renderPresetButtons() {
    const list = document.querySelector("[data-preset-list]");
    if (!list) {
      return;
    }

    list.textContent = "";
    Object.entries(PRESETS).forEach(([presetId, preset]) => {
      const button = document.createElement("button");
      const label = document.createElement("strong");
      const description = document.createElement("span");

      button.type = "button";
      button.dataset.preset = presetId;
      button.setAttribute("aria-pressed", "false");
      label.textContent = preset.label;
      description.textContent = preset.description;
      button.append(label, description);
      list.append(button);
    });
  }

  function renderPresetStates() {
    document.querySelectorAll("[data-preset]").forEach((button) => {
      const active = isPresetActive(button.dataset.preset);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function isPresetActive(presetId) {
    return Boolean(settings.enabled && settings.activePreset === presetId);
  }

  function setupCollapsibleSections() {
    document.querySelectorAll(".audit-panel, .structure-panel, .summary-panel, .preset-panel, .profile-panel, .mode-card, .speech-panel").forEach((section, index) => {
      const header = section.querySelector(".mode-title, .section-heading");
      if (!header || section.dataset.collapsibleReady === "true") {
        return;
      }

      const body = document.createElement("div");
      const title = getSectionTitle(section) || `section ${index + 1}`;
      const key = `accessiview_popup_collapsed_${section.dataset.modeCard || title}`;
      const button = document.createElement("button");
      const saved = localStorage.getItem(key);
      const startCollapsed = saved === null ? section.classList.contains("mode-card") : saved === "true";

      body.className = "collapse-body";
      while (header.nextSibling) {
        body.appendChild(header.nextSibling);
      }

      button.type = "button";
      button.className = "collapse-button";
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const collapsed = !section.classList.contains("is-collapsed");
        localStorage.setItem(key, String(collapsed));
        setCollapsedState(section, body, button, title, collapsed);
      });

      header.append(button);
      section.append(body);
      section.dataset.collapsibleReady = "true";
      setCollapsedState(section, body, button, title, startCollapsed);
    });
  }

  function setCollapsedState(section, body, button, title, collapsed) {
    section.classList.toggle("is-collapsed", collapsed);
    body.hidden = collapsed;
    button.textContent = collapsed ? "+" : "-";
    button.title = collapsed ? `Expand ${title}` : `Collapse ${title}`;
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-expanded", String(!collapsed));
  }

  function getSectionTitle(section) {
    const heading = section.querySelector("h2");
    return heading ? heading.textContent.trim() : "";
  }

  function setupVoiceControls() {
    if (!("speechSynthesis" in window)) {
      return;
    }

    speechVoices = window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      speechVoices = window.speechSynthesis.getVoices();
      renderVoiceControls();
    });
  }

  function renderVoiceControls() {
    document.querySelectorAll("[data-voice-select]").forEach((select) => {
      const selectedValue = getByPath(settings, select.dataset.path) || "auto";
      const supportsSpeech = "speechSynthesis" in window;

      select.textContent = "";
      select.append(new Option("Auto switch by detected language", "auto"));

      if (!supportsSpeech) {
        const option = new Option("Speech voices unavailable", "auto");
        option.disabled = true;
        select.append(option);
        select.disabled = true;
        return;
      }

      getSortedSpeechVoices().forEach((voice) => {
        const defaultLabel = voice.default ? " - default" : "";
        select.append(new Option(`${voice.name} (${voice.lang})${defaultLabel}`, voice.voiceURI));
      });

      const hasSavedVoice = Array.from(select.options).some((option) => option.value === selectedValue);
      if (!hasSavedVoice && selectedValue !== "auto") {
        select.append(new Option("Saved voice unavailable", selectedValue));
      }

      select.value = selectedValue;
      select.disabled = false;
    });
  }

  function getSortedSpeechVoices() {
    return speechVoices.slice().sort((first, second) => {
      return `${first.lang} ${first.name}`.localeCompare(`${second.lang} ${second.name}`);
    });
  }

  function renderProfiles() {
    const select = document.getElementById("profileSelect");
    if (!select) {
      return;
    }

    const selected = select.value || profileStore.activeProfileId || "";
    const profiles = Object.values(profileStore.profiles || {});
    select.textContent = "";
    select.append(new Option(profiles.length ? "Choose a profile" : "No saved profiles", ""));

    profiles.forEach((profile) => {
      select.append(new Option(profile.label, profile.id));
    });

    select.value = profiles.some((profile) => profile.id === selected) ? selected : "";
    document.getElementById("applyProfile").disabled = !select.value;
    document.getElementById("deleteProfile").disabled = !select.value;
  }

  function saveCurrentProfile() {
    const defaultName = currentUrl ? `${getSiteLabelFromUrl(currentUrl)} profile` : "Custom profile";
    const label = window.prompt("Profile name", defaultName);
    if (label === null) {
      return;
    }

    profileStore = createProfile(profileStore, label, settings);
    saveProfileStore(() => {
      renderProfiles();
      setStatus("Profile saved.");
    });
  }

  function saveProfileStore(callback) {
    chrome.storage.local.set({ [PROFILE_STORAGE_KEY]: profileStore }, callback);
  }

  function openSidePanel() {
    if (!chrome.sidePanel || !chrome.sidePanel.open) {
      setStatus("Side panel is not available in this browser.");
      return;
    }

    const options = currentTab && currentTab.id
      ? { tabId: currentTab.id }
      : currentTab && currentTab.windowId
        ? { windowId: currentTab.windowId }
        : {};

    chrome.sidePanel.open(options)
      .then(() => setStatus("Side panel opened."))
      .catch((error) => setStatus(error.message || "Side panel could not open."));
  }

  function runPageAudit() {
    setAuditSummary("Scanning page...");
    sendMessageToActiveTab({ type: "ACCESSIVIEW_GET_AUDIT" }, (response) => {
      if (!response || !response.ok || !response.audit) {
        currentAudit = null;
        setAuditSummary("Reload the page if the scanner is unavailable.");
        renderAuditRecommendations();
        return;
      }

      currentAudit = response.audit;
      renderAudit();
    });
  }

  function renderAudit() {
    if (!currentAudit) {
      setAuditSummary("Scan this page for common accessibility issues.");
      renderAuditRecommendations();
      return;
    }

    const counts = currentAudit.counts || {};
    setAuditSummary(
      `Score ${currentAudit.score}/100. ` +
      `${counts.lowContrastText || 0} contrast, ` +
      `${counts.missingAlt || 0} image alt, ` +
      `${counts.unlabeledControls || 0} form label, ` +
      `${counts.smallTargets || 0} target size issues.`
    );
    renderAuditRecommendations();
  }

  function setAuditSummary(text) {
    const summary = document.getElementById("auditSummary");
    if (summary) {
      summary.textContent = text;
    }
  }

  function renderAuditRecommendations() {
    const list = document.getElementById("auditRecommendations");
    if (!list) {
      return;
    }

    list.textContent = "";
    (currentAudit && currentAudit.recommendations ? currentAudit.recommendations : []).forEach((recommendation) => {
      const item = document.createElement("div");
      const title = document.createElement("strong");
      const description = document.createElement("span");
      item.className = "recommendation-item";
      title.textContent = recommendation.label;
      description.textContent = recommendation.description;
      item.append(title, description);
      list.append(item);
    });
  }

  function inspectPageStructure() {
    setStructureSummary("Inspecting headings, landmarks, forms, and live regions...");
    clearStructureOutput();

    sendMessageToActiveTab({ type: "ACCESSIVIEW_GET_STRUCTURE_MAP" }, (response) => {
      if (!response || !response.ok || !response.structure) {
        setStructureSummary(response && response.message ? response.message : "Reload the page if structure inspection is unavailable.");
        return;
      }

      renderPageStructure(response.structure);
    });
  }

  function inspectTabOrder() {
    setStructureSummary("Inspecting visible keyboard focus order...");
    clearStructureOutput();

    sendMessageToActiveTab({ type: "ACCESSIVIEW_GET_TAB_ORDER" }, (response) => {
      if (!response || !response.ok || !response.tabOrder) {
        setStructureSummary(response && response.message ? response.message : "Reload the page if tab order inspection is unavailable.");
        return;
      }

      renderTabOrder(response.tabOrder);
    });
  }

  function renderPageStructure(structure) {
    const counts = structure.counts || {};
    const issueCount = (counts.headingIssues || 0) + (counts.missingAlt || 0) + (counts.unlabeledControls || 0);
    setStructureSummary(
      `${counts.headings || 0} headings, ` +
      `${counts.landmarks || 0} landmarks, ` +
      `${counts.liveRegions || 0} live regions, ` +
      `${issueCount} structure issues.`
    );

    const output = clearStructureOutput();
    appendStructureGroup(output, "Heading outline", (structure.headings || []).slice(0, 12), (heading) => ({
      title: `H${heading.level || "?"}: ${heading.text || "Untitled heading"}`,
      detail: heading.selector || "",
      meta: heading.issues && heading.issues.length ? heading.issues.join(", ") : "OK",
      warning: Boolean(heading.issues && heading.issues.length)
    }));
    appendStructureGroup(output, "Landmarks", (structure.landmarks || []).slice(0, 10), (landmark) => ({
      title: landmark.name ? `${landmark.role}: ${landmark.name}` : landmark.role,
      detail: landmark.selector || "",
      meta: landmark.name ? "Named landmark" : "Unnamed landmark",
      warning: !landmark.name && landmark.role === "region"
    }));
    appendStructureGroup(output, "Forms", (structure.forms || []).slice(0, 8), (form) => ({
      title: form.name || "Form",
      detail: form.selector || "",
      meta: `${form.controls || 0} controls, ${form.unlabeledControls || 0} unlabeled, ${form.requiredFields || 0} required`,
      warning: Boolean(form.unlabeledControls)
    }));
    appendStructureGroup(output, "Live regions", (structure.liveRegions || []).slice(0, 8), (region) => ({
      title: `${region.role || "region"}${region.live ? ` (${region.live})` : ""}`,
      detail: region.selector || "",
      meta: region.name || "No accessible name",
      warning: false
    }));
    appendStructureGroup(output, "Missing image alt", (structure.missingAlt || []).slice(0, 8), (image) => ({
      title: image.text || "Image without alternative text",
      detail: image.selector || "",
      meta: "Needs alt text or decorative handling",
      warning: true
    }));
  }

  function renderTabOrder(tabOrder) {
    const counts = tabOrder.counts || {};
    setStructureSummary(
      `${counts.focusTargets || 0} focus targets. ` +
      `${counts.positiveTabIndex || 0} positive tabindex, ` +
      `${counts.missingNames || 0} missing names, ` +
      `${counts.smallTargets || 0} small targets.`
    );

    const output = clearStructureOutput();
    appendStructureGroup(output, "Tab order", (tabOrder.items || []).slice(0, 18), (item) => {
      const issues = [];
      if (item.positiveTabIndex) {
        issues.push(`positive tabindex ${item.explicitTabIndex}`);
      }
      if (item.missingName) {
        issues.push("missing name");
      }
      if (item.smallTarget) {
        issues.push("small target");
      }
      if (item.offscreen) {
        issues.push("offscreen");
      }

      return {
        title: `${item.index}. ${item.label || item.role || "Focus target"}`,
        detail: item.selector || "",
        meta: issues.length ? issues.join(", ") : `tabIndex ${item.tabIndex}`,
        warning: Boolean(issues.length)
      };
    });
  }

  function setStructureSummary(text) {
    const summary = document.getElementById("structureSummary");
    if (summary) {
      summary.textContent = text;
    }
  }

  function clearStructureOutput() {
    const output = document.getElementById("structureOutput");
    if (output) {
      output.textContent = "";
    }
    return output;
  }

  function appendStructureGroup(output, title, items, mapItem) {
    if (!output) {
      return;
    }

    const group = document.createElement("section");
    const heading = document.createElement("h3");
    group.className = "structure-group";
    heading.textContent = title;
    group.append(heading);

    if (!items.length) {
      appendStructureItem(group, "None detected", "", "", false);
      output.append(group);
      return;
    }

    items.forEach((item) => {
      const view = mapItem(item);
      appendStructureItem(group, view.title, view.detail, view.meta, view.warning);
    });

    output.append(group);
  }

  function appendStructureItem(group, title, detail, meta, warning) {
    const item = document.createElement("div");
    const strong = document.createElement("strong");
    const detailText = document.createElement("span");
    const metaText = document.createElement("span");

    item.className = "structure-item";
    item.classList.toggle("is-warning", Boolean(warning));
    strong.textContent = title || "Untitled item";
    detailText.textContent = detail || "";
    metaText.textContent = meta || "";
    item.append(strong);
    if (detailText.textContent) {
      item.append(detailText);
    }
    if (metaText.textContent) {
      item.append(metaText);
    }
    group.append(item);
  }

  function applyAuditRecommendations() {
    if (!currentAudit || !currentAudit.recommendations || !currentAudit.recommendations.length) {
      runPageAudit();
      return;
    }

    currentAudit.recommendations.forEach((recommendation) => {
      applyRecommendation(recommendation.id);
    });

    settings.enabled = true;
    settings = clearActivePreset(settings);

    if (currentUrl && saveScope !== "site") {
      siteStore = upsertSiteSettings(siteStore, currentUrl, settings);
      saveScope = "site";
      saveSiteStore(() => {
        refreshEffectiveSettings();
        saveAndRender(true);
        setStatus(`Applied suggestions for ${getSiteLabelFromUrl(currentUrl)}.`);
      });
      return;
    }

    saveAndRender(true);
  }

  function applyRecommendation(id) {
    if (id === "contrast") {
      settings.modes.contrast.enabled = true;
      settings.modes.contrast.preset = "dark";
      return;
    }

    if (id === "altWarnings") {
      settings.modes.navigation.enabled = true;
      settings.modes.navigation.showAltWarnings = true;
      settings.modes.navigation.focusRing = true;
      return;
    }

    if (id === "forms") {
      settings.modes.forms.enabled = true;
      settings.modes.forms.highlightRequired = true;
      settings.modes.forms.flagUnlabeled = true;
      settings.modes.forms.flagInvalid = true;
      settings.modes.navigation.enabled = true;
      settings.modes.navigation.focusRing = true;
      return;
    }

    if (id === "navigation") {
      settings.modes.navigation.enabled = true;
      settings.modes.navigation.focusRing = true;
      settings.modes.navigation.underlineLinks = true;
      settings.modes.navigation.largerTargets = true;
      return;
    }

    if (id === "motion") {
      settings.modes.motion.enabled = true;
      settings.modes.motion.disableAnimations = true;
      settings.modes.motion.reduceScrolling = true;
      settings.modes.motion.pauseMedia = true;
      return;
    }

    if (id === "cognitive") {
      settings.modes.cognitive.enabled = true;
      settings.modes.cognitive.hideExtras = true;
      settings.modes.cognitive.emphasizeHeadings = true;
      settings.modes.cognitive.chunkText = true;
      settings.modes.simplify.enabled = true;
      return;
    }

    if (id === "readingComfort") {
      settings.modes.text.enabled = true;
      settings.modes.text.scale = Math.max(Number(settings.modes.text.scale) || 100, 118);
      settings.modes.text.lineHeight = Math.max(Number(settings.modes.text.lineHeight) || 1.2, 1.75);
      settings.modes.guide.enabled = true;
    }
  }

  function summarizePage() {
    const status = document.getElementById("summaryStatus");
    const output = document.getElementById("summaryOutput");
    status.textContent = "Summarizing locally...";
    output.textContent = "";
    currentSummary = null;

    sendMessageToActiveTab({
      type: "ACCESSIVIEW_SUMMARIZE_PAGE",
      options: {
        length: settings.summary.length,
        format: settings.summary.format,
        plainLanguage: settings.summary.plainLanguage,
        engine: settings.summary.engine,
        cache: settings.summary.cache
      }
    }, (response) => {
      if (!response || !response.ok) {
        status.textContent = response && response.message ? response.message : "Summary failed on this page.";
        return;
      }

      currentSummary = response.summary || "";
      output.textContent = currentSummary;
      const cacheLabel = response.cached ? " cached" : "";
      status.textContent = `${response.methodLabel || response.method || "Local"} summary${cacheLabel}. ${response.sourceLength || 0} characters read.`;
    });
  }

  function readCurrentSummary() {
    if (!currentSummary) {
      setStatus("Create a summary first.");
      return;
    }

    sendMessageToActiveTab({
      type: "ACCESSIVIEW_READ_TEXT",
      text: currentSummary,
      label: "summary"
    }, (response) => {
      setStatus(response && response.message ? response.message : "Reading summary.");
      requestSpeechStatus();
    });
  }

  function renderUndoState() {
    const undoButton = document.getElementById("undoSettings");
    if (!undoButton) {
      return;
    }

    undoButton.disabled = !findUndoEntry();
  }

  function findUndoEntry() {
    const siteKey = getSiteKeyFromUrl(currentUrl);
    return (historyStore.entries || []).find((entry) => {
      if (entry.scope === "global") {
        return saveScope === "global";
      }

      return saveScope === "site" && siteKey && entry.siteKey === siteKey;
    }) || null;
  }

  function undoLastSettingsChange() {
    const entry = findUndoEntry();
    if (!entry) {
      setStatus("No previous settings for this scope.");
      return;
    }

    historyStore = removeHistoryEntry(historyStore, entry.id);
    settings = withDefaults(entry.settings);

    saveHistoryStore(() => {
      if (entry.scope === "site" && currentUrl) {
        saveScope = "site";
        siteStore = upsertSiteSettings(siteStore, currentUrl, settings);
        saveSiteStore(() => {
          refreshEffectiveSettings();
          render();
          applyToActiveTab();
          setStatus("Restored previous site settings.");
        });
        return;
      }

      saveScope = "global";
      globalSettings = withDefaults(settings);
      chrome.storage.sync.set({ [STORAGE_KEY]: globalSettings }, () => {
        refreshEffectiveSettings();
        render();
        applyToActiveTab();
        setStatus("Restored previous global settings.");
      });
    });
  }

  function rememberSettingsBeforeSave(label) {
    const previousSettings = saveScope === "site" && currentUrl
      ? getEffectiveSettings(globalSettings, siteStore, currentUrl)
      : withDefaults(globalSettings);

    if (JSON.stringify(previousSettings) === JSON.stringify(settings)) {
      return;
    }

    historyStore = addHistoryEntry(historyStore, {
      scope: saveScope,
      siteKey: saveScope === "site" ? getSiteKeyFromUrl(currentUrl) : null,
      siteLabel: saveScope === "site" ? getSiteLabelFromUrl(currentUrl) : "",
      label: label || "Previous settings",
      settings: previousSettings
    });
    saveHistoryStore(renderUndoState);
  }

  function saveAndRender(immediate) {
    render();
    clearTimeout(saveTimer);

    const save = () => {
      settings.lastUpdated = new Date().toISOString();
      rememberSettingsBeforeSave(saveScope === "site" ? `Before changes on ${getSiteLabelFromUrl(currentUrl)}` : "Before global changes");

      if (saveScope === "site" && currentUrl) {
        siteStore = upsertSiteSettings(siteStore, currentUrl, settings);
        saveSiteStore(() => {
          setStatus(`Saved for ${getSiteLabelFromUrl(currentUrl)}.`);
          applyToActiveTab();
        });
        return;
      }

      globalSettings = withDefaults(settings);
      chrome.storage.sync.set({ [STORAGE_KEY]: globalSettings }, () => {
        setStatus("Saved globally.");
        applyToActiveTab();
      });
    };

    if (immediate) {
      save();
      return;
    }

    saveTimer = setTimeout(save, 120);
  }

  function saveSiteStore(callback) {
    chrome.storage.local.set({ [SITE_STORAGE_KEY]: siteStore }, callback);
  }

  function saveHistoryStore(callback) {
    chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: historyStore }, callback);
  }

  function sendSpeechControl(type) {
    sendMessageToActiveTab({ type }, (response) => {
      setStatus(response && response.message ? response.message : "Read aloud control sent.");
      renderSpeechStatus(response && response.status ? response.status : response);
      requestSpeechStatus();
    });
  }

  function requestSpeechStatus() {
    const status = document.getElementById("speechStatus");
    if (!status || !currentUrl) {
      return;
    }

    sendMessageToActiveTab({ type: "ACCESSIVIEW_GET_SPEECH_STATUS" }, (response) => {
      renderSpeechStatus(response);
    });
  }

  function renderSpeechStatus(response) {
    const status = document.getElementById("speechStatus");
    if (!status) {
      return;
    }

    if (!response || !response.active) {
      status.textContent = "Read selected text or detected page content.";
      return;
    }

    const state = response.paused ? "Paused" : "Reading";
    status.textContent = `${state} ${response.index + 1} of ${response.total}`;
  }

  function applyToActiveTab() {
    sendMessageToActiveTab({
      type: "ACCESSIVIEW_APPLY_SETTINGS",
      settings,
      scope: saveScope
    }, () => {
      schedulePageStatusRefresh(true);
    });
  }

  function schedulePageStatusRefresh(immediate) {
    clearTimeout(pageStatusTimer);
    pageStatusTimer = setTimeout(requestPageStatus, immediate ? 40 : 180);
  }

  function requestPageStatus() {
    const pageStatus = document.getElementById("pageStatus");

    if (!currentUrl) {
      pageStatus.textContent = "Page status unavailable";
      return;
    }

    sendMessageToActiveTab({ type: "ACCESSIVIEW_GET_STATUS" }, (response) => {
      if (!response || !response.ok) {
        pageStatus.textContent = "Reload the page if controls do not apply.";
        return;
      }

      if (response.focusReaderActive) {
        const ruleLabel = response.siteRule ? `, ${response.siteRule.label}` : "";
        pageStatus.textContent = `Reader active: ${response.readerBlocks} text blocks${ruleLabel}`;
        return;
      }

      if (response.siteRule) {
        pageStatus.textContent = `${response.usingSiteSettings ? "Site override" : "Global settings"} with ${response.siteRule.label}`;
        return;
      }

      pageStatus.textContent = response.usingSiteSettings ? "Using site override on this page" : "Using global settings on this page";
    });
  }

  function sendMessageToActiveTab(message, callback) {
    if (!currentTab || !currentTab.id || !currentUrl) {
      setStatus("Open a web page to test.");
      if (callback) {
        callback({ ok: false });
      }
      return;
    }

    chrome.tabs.sendMessage(currentTab.id, message, (response) => {
      const error = chrome.runtime.lastError;
      if (callback) {
        callback(error ? { ok: false, message: error.message } : response || { ok: true });
      }
    });
  }

  function setStatus(message) {
    const status = document.getElementById("status");
    status.textContent = message;
    clearTimeout(setStatus.timer);
    setStatus.timer = setTimeout(() => {
      status.textContent = "";
    }, 2200);
  }

  function readControlValue(control) {
    if (control.type === "checkbox") {
      return control.checked;
    }

    if (control.type === "range" || control.type === "number") {
      return Number(control.value);
    }

    return control.value;
  }

  function writeControlValue(control, value) {
    if (control.type === "checkbox") {
      control.checked = Boolean(value);
      return;
    }

    control.value = value;
  }

  function getByPath(object, path) {
    return path.split(".").reduce((current, key) => current && current[key], object);
  }

  function setByPath(object, path, value) {
    const parts = path.split(".");
    const last = parts.pop();
    const target = parts.reduce((current, key) => current[key], object);
    target[last] = value;
  }

  function enableMotionModeWhenConfigured(path, value) {
    if (path.startsWith("modes.motion.") && path !== "modes.motion.enabled" && value === true) {
      settings.modes.motion.enabled = true;
    }
  }

  function formatOutput(value) {
    if (typeof value === "number") {
      return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
    }

    return String(value);
  }
})();
