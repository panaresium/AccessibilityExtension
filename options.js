(function initAccessiViewOptions() {
  const {
    STORAGE_KEY,
    SITE_STORAGE_KEY,
    PROFILE_STORAGE_KEY,
    HISTORY_STORAGE_KEY,
    SUMMARY_CACHE_KEY,
    DEFAULT_SETTINGS,
    DEFAULT_SITE_STORE,
    PRESETS,
    withDefaults,
    withSiteStore,
    withProfileStore,
    withHistoryStore,
    applyPreset,
    removePreset,
    clearActivePreset,
    pruneSiteStore,
    createProfile,
    upsertProfile,
    removeProfile,
    applyProfile,
    pruneProfileStore,
    addHistoryEntry,
    removeHistoryEntry
  } = globalThis.AccessiViewConfig;
  let settings = withDefaults({});
  let siteStore = withSiteStore({});
  let profileStore = withProfileStore({});
  let historyStore = withHistoryStore({});
  let saveTimer = null;
  let speechVoices = [];

  document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      settings = withDefaults(result[STORAGE_KEY]);
      chrome.storage.local.get(SITE_STORAGE_KEY, (localResult) => {
        siteStore = withSiteStore(localResult[SITE_STORAGE_KEY]);
        chrome.storage.local.get(PROFILE_STORAGE_KEY, (profileResult) => {
          profileStore = withProfileStore(profileResult[PROFILE_STORAGE_KEY]);
          chrome.storage.local.get(HISTORY_STORAGE_KEY, (historyResult) => {
            historyStore = withHistoryStore(historyResult[HISTORY_STORAGE_KEY]);
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

  function bindEvents() {
    document.getElementById("enabled").addEventListener("change", (event) => {
      settings.enabled = event.target.checked;
      saveAndRender();
    });

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
        const header = event.target.closest(".card-title");
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

    document.getElementById("profileSelect").addEventListener("change", () => {
      renderProfiles();
    });

    document.getElementById("saveProfile").addEventListener("click", () => {
      const nameInput = document.getElementById("profileName");
      profileStore = createProfile(profileStore, nameInput.value || "Custom profile", settings);
      nameInput.value = "";
      saveProfileStore(() => {
        renderProfiles();
        setStatus("Profile saved.");
      });
    });

    document.getElementById("applyProfile").addEventListener("click", () => {
      const profileId = document.getElementById("profileSelect").value;
      if (!profileId) {
        setStatus("Select a profile first.");
        return;
      }

      settings = applyProfile(settings, profileStore, profileId);
      profileStore.activeProfileId = profileId;
      saveProfileStore(() => saveAndRender(true));
    });

    document.getElementById("deleteProfile").addEventListener("click", () => {
      const profileId = document.getElementById("profileSelect").value;
      if (!profileId) {
        setStatus("Select a profile first.");
        return;
      }

      profileStore = removeProfile(profileStore, profileId);
      saveProfileStore(() => {
        renderProfiles();
        setStatus("Profile deleted.");
      });
    });

    document.getElementById("exportProfile").addEventListener("click", () => {
      const profileId = document.getElementById("profileSelect").value;
      const profile = profileStore.profiles[profileId];
      if (!profile) {
        setStatus("Select a profile first.");
        return;
      }

      document.getElementById("settingsJson").value = JSON.stringify({
        type: "AccessiView profile export",
        version: 1,
        exportedAt: new Date().toISOString(),
        profile
      }, null, 2);
      setStatus("Profile exported.");
    });

    document.getElementById("importProfile").addEventListener("click", () => {
      try {
        const imported = JSON.parse(document.getElementById("settingsJson").value);
        const profile = imported.profile || imported;
        profileStore = upsertProfile(profileStore, profile);
        saveProfileStore(() => {
          renderProfiles();
          setStatus("Profile imported.");
        });
      } catch (_error) {
        setStatus("Import failed: invalid profile JSON.");
      }
    });

    document.getElementById("exportSettings").addEventListener("click", () => {
      document.getElementById("settingsJson").value = JSON.stringify({
        type: "AccessiView settings export",
        version: 1,
        exportedAt: new Date().toISOString(),
        globalSettings: settings,
        siteSettings: siteStore,
        profiles: profileStore,
        history: historyStore
      }, null, 2);
      setStatus("Exported settings and profiles.");
    });

    document.getElementById("importSettings").addEventListener("click", () => {
      try {
        const imported = JSON.parse(document.getElementById("settingsJson").value);
        settings = withDefaults(imported.globalSettings || imported);
        siteStore = withSiteStore(imported.siteSettings || siteStore);
        siteStore = pruneSiteStore(siteStore);
        profileStore = pruneProfileStore(imported.profiles || profileStore);
        historyStore = withHistoryStore(imported.history || historyStore);
        chrome.storage.local.set({ [SITE_STORAGE_KEY]: siteStore });
        chrome.storage.local.set({ [PROFILE_STORAGE_KEY]: profileStore });
        chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: historyStore });
        saveAndRender(true);
        setStatus("Imported settings.");
      } catch (error) {
        setStatus("Import failed: invalid JSON.");
      }
    });

    document.getElementById("clearSiteSettings").addEventListener("click", () => {
      siteStore = withSiteStore(DEFAULT_SITE_STORE);
      chrome.storage.local.set({ [SITE_STORAGE_KEY]: siteStore }, () => {
        setStatus("Cleared all site settings.");
      });
    });

    const clearSummaryButton = document.getElementById("clearSummaryCache");
    if (clearSummaryButton) {
      clearSummaryButton.addEventListener("click", () => {
        chrome.storage.local.remove(SUMMARY_CACHE_KEY, () => {
          setStatus("Cleared summary cache.");
        });
      });
    }

    document.getElementById("undoGlobalSettings").addEventListener("click", undoGlobalSettings);

    document.getElementById("reset").addEventListener("click", () => {
      settings = withDefaults(DEFAULT_SETTINGS);
      saveAndRender(true);
    });
  }

  function render() {
    document.getElementById("enabled").checked = Boolean(settings.enabled);

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
    document.querySelectorAll(".grid .card").forEach((section, index) => {
      const header = section.querySelector(".card-title");
      if (!header || section.dataset.collapsibleReady === "true") {
        return;
      }

      const body = document.createElement("div");
      const title = getSectionTitle(section) || `section ${index + 1}`;
      const key = `accessiview_options_collapsed_${section.dataset.modeCard || title}`;
      const button = document.createElement("button");
      const saved = localStorage.getItem(key);
      const startCollapsed = saved === null ? true : saved === "true";

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
    document.getElementById("exportProfile").disabled = !select.value;
  }

  function saveProfileStore(callback) {
    chrome.storage.local.set({ [PROFILE_STORAGE_KEY]: profileStore }, callback);
  }

  function renderUndoState() {
    const button = document.getElementById("undoGlobalSettings");
    if (!button) {
      return;
    }

    button.disabled = !(historyStore.entries || []).some((entry) => entry.scope === "global");
  }

  function rememberGlobalSettingsBeforeSave() {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      const storedSettings = withDefaults(result[STORAGE_KEY]);
      if (JSON.stringify(storedSettings) === JSON.stringify(settings)) {
        return;
      }

      historyStore = addHistoryEntry(historyStore, {
        scope: "global",
        label: "Before options change",
        settings: storedSettings
      });
      saveHistoryStore(renderUndoState);
    });
  }

  function undoGlobalSettings() {
    const entry = (historyStore.entries || []).find((item) => item.scope === "global");
    if (!entry) {
      setStatus("No previous global settings.");
      return;
    }

    historyStore = removeHistoryEntry(historyStore, entry.id);
    settings = withDefaults(entry.settings);
    saveHistoryStore(() => {
      chrome.storage.sync.set({ [STORAGE_KEY]: settings }, () => {
        render();
        setStatus("Restored previous global settings.");
      });
    });
  }

  function saveHistoryStore(callback) {
    chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: historyStore }, callback);
  }

  function saveAndRender(immediate) {
    render();
    clearTimeout(saveTimer);

    const save = () => {
      rememberGlobalSettingsBeforeSave();
      settings.lastUpdated = new Date().toISOString();
      chrome.storage.sync.set({ [STORAGE_KEY]: settings }, () => {
        setStatus("Saved.");
      });
    };

    if (immediate) {
      save();
      return;
    }

    saveTimer = setTimeout(save, 120);
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

  function setStatus(message) {
    const status = document.getElementById("status");
    status.textContent = message;
    clearTimeout(setStatus.timer);
    setStatus.timer = setTimeout(() => {
      status.textContent = "";
    }, 2600);
  }
})();
