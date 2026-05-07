importScripts("shared/settings.js");

if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {
    // Older Chromium builds may expose sidePanel without this behavior option.
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === "ACCESSIVIEW_GET_ACTIVE_TAB") {
    queryActiveWebTab((tab) => {
      sendResponse({
        ok: Boolean(tab),
        tab: serializeTab(tab)
      });
    });
    return true;
  }

  if (message.type === "ACCESSIVIEW_IS_CURRENT_TAB") {
    const senderTabId = sender && sender.tab && sender.tab.id;
    queryActiveWebTab((tab) => {
      sendResponse({
        ok: true,
        isCurrent: Boolean(tab && senderTabId && tab.id === senderTabId),
        tab: serializeTab(tab)
      });
    });
    return true;
  }

  if (message.type === "ACCESSIVIEW_SEND_TO_ACTIVE_TAB") {
    forwardMessageToActiveTab(message.payload, sendResponse);
    return true;
  }

  if (message.type !== "ACCESSIVIEW_OPEN_SIDE_PANEL") {
    return false;
  }

  if (!chrome.sidePanel || !chrome.sidePanel.open) {
    sendResponse({ ok: false, message: "Side panel is not available in this browser." });
    return false;
  }

  const options = sender && sender.tab && sender.tab.id
    ? { tabId: sender.tab.id }
    : {};

  chrome.sidePanel.open(options)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, message: error.message }));
  return true;
});

if (chrome.tabs && chrome.tabs.onActivated) {
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    refreshTabSettings(tabId);
  });
}

if (chrome.tabs && chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab && tab.active && isWebPageUrl(tab.url)) {
      refreshTabSettings(tabId);
    }
  });
}

function isWebPageUrl(url) {
  return /^https?:\/\//.test(url || "");
}

function serializeTab(tab) {
  if (!tab) {
    return null;
  }

  return {
    id: tab.id,
    url: tab.url || "",
    title: tab.title || "",
    windowId: tab.windowId
  };
}

function queryActiveWebTab(callback) {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const error = chrome.runtime.lastError;
    const tab = !error && tabs ? tabs.find((candidate) => isWebPageUrl(candidate.url)) : null;
    if (tab) {
      callback(tab);
      return;
    }

    chrome.windows.getLastFocused({ populate: true }, (windowInfo) => {
      const windowError = chrome.runtime.lastError;
      if (windowError || !windowInfo || !Array.isArray(windowInfo.tabs)) {
        callback(null);
        return;
      }

      callback(windowInfo.tabs.find((candidate) => candidate.active && isWebPageUrl(candidate.url)) || null);
    });
  });
}

function forwardMessageToActiveTab(payload, sendResponse) {
  if (!payload || !payload.type) {
    sendResponse({ ok: false, message: "No AccessiView message was provided." });
    return;
  }

  queryActiveWebTab((tab) => {
    if (!tab || !tab.id) {
      sendResponse({ ok: false, message: "Open a web page to test.", targetTab: null });
      return;
    }

    chrome.tabs.sendMessage(tab.id, payload, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        sendResponse({ ok: false, message: error.message, targetTab: serializeTab(tab) });
        return;
      }

      sendResponse(Object.assign({}, response || { ok: true }, {
        targetTab: serializeTab(tab)
      }));
    });
  });
}

function refreshTabSettings(tabId) {
  if (!tabId) {
    return;
  }

  chrome.tabs.sendMessage(tabId, { type: "ACCESSIVIEW_REFRESH_SETTINGS" }, () => {
    // The activated tab may be a browser page or may not have the content script yet.
    void chrome.runtime.lastError;
  });
}

chrome.runtime.onInstalled.addListener(() => {
  const config = globalThis.AccessiViewConfig;

  chrome.storage.sync.get(config.STORAGE_KEY, (result) => {
    const existing = result[config.STORAGE_KEY];

    if (existing) {
      const merged = config.withDefaults(existing);
      chrome.storage.sync.set({ [config.STORAGE_KEY]: merged });
      return;
    }

    chrome.storage.sync.set({
      [config.STORAGE_KEY]: config.withDefaults({})
    });
  });

  chrome.storage.local.get(config.SITE_STORAGE_KEY, (result) => {
    const existing = result[config.SITE_STORAGE_KEY];
    chrome.storage.local.set({
      [config.SITE_STORAGE_KEY]: config.withSiteStore(existing)
    });
  });

  chrome.storage.local.get(config.PROFILE_STORAGE_KEY, (result) => {
    const existing = result[config.PROFILE_STORAGE_KEY];
    chrome.storage.local.set({
      [config.PROFILE_STORAGE_KEY]: config.withProfileStore(existing)
    });
  });

  chrome.storage.local.get(config.HISTORY_STORAGE_KEY, (result) => {
    const existing = result[config.HISTORY_STORAGE_KEY];
    chrome.storage.local.set({
      [config.HISTORY_STORAGE_KEY]: config.withHistoryStore(existing)
    });
  });

  chrome.storage.local.get(config.SUMMARY_CACHE_KEY, (result) => {
    const existing = result[config.SUMMARY_CACHE_KEY];
    chrome.storage.local.set({
      [config.SUMMARY_CACHE_KEY]: config.withSummaryCache(existing)
    });
  });

  chrome.storage.local.get(config.SPEECH_PROGRESS_KEY, (result) => {
    const existing = result[config.SPEECH_PROGRESS_KEY];
    chrome.storage.local.set({
      [config.SPEECH_PROGRESS_KEY]: config.withSpeechProgressStore(existing)
    });
  });
});
