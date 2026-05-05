importScripts("shared/settings.js");

if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {
    // Older Chromium builds may expose sidePanel without this behavior option.
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "ACCESSIVIEW_OPEN_SIDE_PANEL") {
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
});
