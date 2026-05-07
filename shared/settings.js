(function initAccessiViewConfig(global) {
  const STORAGE_KEY = "accessiview_settings_v1";
  const SITE_STORAGE_KEY = "accessiview_site_settings_v1";
  const PROFILE_STORAGE_KEY = "accessiview_profiles_v1";
  const HISTORY_STORAGE_KEY = "accessiview_settings_history_v1";
  const SUMMARY_CACHE_KEY = "accessiview_summary_cache_v1";
  const SPEECH_PROGRESS_KEY = "accessiview_speech_progress_v1";
  const MAX_SITE_SETTINGS = 80;
  const MAX_PROFILES = 40;
  const MAX_HISTORY_ENTRIES = 16;
  const MAX_SUMMARY_CACHE_ENTRIES = 30;
  const MAX_SPEECH_PROGRESS_PAGES = 30;
  const MAX_SPEECH_BOOKMARKS_PER_PAGE = 20;

  const DEFAULT_SETTINGS = {
    schemaVersion: 1,
    enabled: true,
    activePreset: null,
    lastUpdated: null,
    ui: {
      floatingButton: false,
      floatingPosition: "right"
    },
    summary: {
      engine: "auto",
      length: "short",
      format: "bullets",
      plainLanguage: true,
      cache: true
    },
    modes: {
      focus: {
        enabled: false,
        distractionMode: "dim",
        maxWidth: 820,
        dimOpacity: 0.16,
        hideSticky: true,
        emphasizeMain: true,
        textOnly: true,
        background: "#ffffff",
        text: "#111827",
        link: "#0645ad"
      },
      simplify: {
        enabled: false,
        hideNav: true,
        hideSidebars: true,
        hideForms: false,
        hideComments: true,
        maxWidth: 840,
        background: "#ffffff",
        text: "#111827",
        link: "#0645ad"
      },
      contrast: {
        enabled: false,
        preset: "dark",
        background: "#050505",
        surface: "#111827",
        text: "#ffffff",
        link: "#7dd3fc",
        border: "#facc15",
        invertImages: false
      },
      text: {
        enabled: false,
        scale: 120,
        lineHeight: 1.65,
        letterSpacing: 0.02,
        wordSpacing: 0.08,
        paragraphSpacing: 0.75,
        fontFamily: "system"
      },
      motion: {
        enabled: false,
        disableAnimations: true,
        reduceScrolling: true,
        pauseMedia: true
      },
      guide: {
        enabled: false,
        height: 72,
        style: "band",
        keyboardStep: 32,
        followFocus: true,
        color: "#f59e0b",
        opacity: 0.24
      },
      navigation: {
        enabled: false,
        focusRing: true,
        underlineLinks: true,
        largerTargets: false,
        showAltWarnings: false,
        keyboardMap: false
      },
      forms: {
        enabled: false,
        highlightRequired: true,
        flagUnlabeled: true,
        flagInvalid: true
      },
      cognitive: {
        enabled: false,
        hideExtras: true,
        emphasizeHeadings: true,
        chunkText: true,
        maxWidth: 760
      },
      filter: {
        enabled: false,
        preset: "none",
        grayscale: 0,
        saturation: 100,
        brightness: 100,
        contrast: 100,
        sepia: 0
      },
      speech: {
        voiceURI: "auto",
        rate: 0.95,
        pitch: 1,
        volume: 1,
        naturalPauses: true,
        pauseScale: 0.8,
        highlight: true
      }
    }
  };

  const DEFAULT_SITE_STORE = {
    schemaVersion: 1,
    sites: {}
  };

  const DEFAULT_PROFILE_STORE = {
    schemaVersion: 1,
    profiles: {},
    activeProfileId: null
  };

  const DEFAULT_HISTORY_STORE = {
    schemaVersion: 1,
    entries: []
  };

  const DEFAULT_SUMMARY_CACHE = {
    schemaVersion: 1,
    entries: {}
  };

  const DEFAULT_SPEECH_PROGRESS_STORE = {
    schemaVersion: 1,
    pages: {}
  };

  const SITE_RULE_PACKS = {
    "msn.com": {
      label: "MSN articles",
      mainSelectors: [
        "article",
        "main",
        "[role='main']",
        "[itemprop='articleBody']",
        "[data-t*='article']",
        "[class*='article-body']",
        "[class*='articleBody']",
        "[class*='article-content']",
        "[class*='story']"
      ],
      hideSelectors: [
        "[class*='native-ad']",
        "[class*='sponsored']",
        "[class*='ad-']",
        "[data-t*='ad']",
        "[data-module*='recommend']",
        "[class*='recommend']",
        "[class*='related']",
        "[class*='share']",
        "[class*='social']"
      ],
      mediaSelectors: [
        "img",
        "picture",
        "video",
        "iframe",
        "canvas",
        "svg"
      ]
    },
    "thaiware.com": {
      label: "Thaiware content",
      mainSelectors: [
        "article",
        "main",
        "[role='main']",
        "#content",
        "#main",
        ".content",
        ".main-content",
        ".article",
        ".news-detail",
        ".detail",
        ".entry-content"
      ],
      hideSelectors: [
        ".ads",
        ".advertise",
        "[class*='ads']",
        "[id*='ads']",
        "[class*='banner']",
        "[class*='social']",
        "[class*='share']",
        "[class*='related']",
        "[class*='recommend']"
      ],
      mediaSelectors: [
        "img",
        "picture",
        "video",
        "iframe",
        "canvas",
        "svg"
      ]
    },
    "wikipedia.org": {
      label: "Wikipedia articles",
      mainSelectors: [
        "main",
        "#content",
        "#mw-content-text",
        ".mw-parser-output"
      ],
      hideSelectors: [
        "#mw-navigation",
        "#siteNotice",
        ".navbox",
        ".metadata",
        ".ambox",
        ".mw-editsection"
      ],
      mediaSelectors: []
    }
  };

  const PRESETS = {
    lowVision: {
      label: "Low Vision",
      description: "High contrast, larger text, stronger focus states.",
      settings: {
        modes: {
          contrast: {
            enabled: true,
            preset: "dark",
            invertImages: false
          },
          text: {
            enabled: true,
            scale: 145,
            lineHeight: 1.75,
            letterSpacing: 0.03,
            wordSpacing: 0.1,
            fontFamily: "system"
          },
          navigation: {
            enabled: true,
            focusRing: true,
            underlineLinks: true,
            largerTargets: true
          }
        }
      }
    },
    focus: {
      label: "Focus",
      description: "Reduce visual noise and keep the main content centered.",
      settings: {
        modes: {
          focus: {
            enabled: true,
            distractionMode: "hide",
            maxWidth: 780,
            dimOpacity: 0.1,
            hideSticky: true,
            emphasizeMain: true,
            textOnly: true
          },
          motion: {
            enabled: true,
            disableAnimations: true,
            reduceScrolling: true,
            pauseMedia: true
          },
          guide: {
            enabled: false
          }
        }
      }
    },
    plainPage: {
      label: "Plain Page",
      description: "Simplify page structure while keeping the original page available.",
      settings: {
        modes: {
          simplify: {
            enabled: true,
            hideNav: true,
            hideSidebars: true,
            hideForms: false,
            hideComments: true,
            maxWidth: 820
          },
          text: {
            enabled: true,
            scale: 118,
            lineHeight: 1.75,
            letterSpacing: 0.02,
            wordSpacing: 0.08
          }
        }
      }
    },
    dyslexia: {
      label: "Dyslexia Reading",
      description: "Roomier text, readable type, and a reading guide.",
      settings: {
        modes: {
          text: {
            enabled: true,
            scale: 125,
            lineHeight: 1.85,
            letterSpacing: 0.06,
            wordSpacing: 0.14,
            paragraphSpacing: 1,
            fontFamily: "dyslexia"
          },
          guide: {
            enabled: true,
            height: 84,
            color: "#fde68a",
            opacity: 0.26
          },
          navigation: {
            enabled: true,
            focusRing: true,
            underlineLinks: true
          }
        }
      }
    },
    cognitive: {
      label: "Cognitive Support",
      description: "Cleaner layout, chunked reading, and stronger headings.",
      settings: {
        modes: {
          cognitive: {
            enabled: true,
            hideExtras: true,
            emphasizeHeadings: true,
            chunkText: true,
            maxWidth: 760
          },
          text: {
            enabled: true,
            scale: 116,
            lineHeight: 1.85,
            letterSpacing: 0.02,
            wordSpacing: 0.1,
            paragraphSpacing: 1
          }
        }
      }
    },
    formFilling: {
      label: "Form Filling",
      description: "Highlight required fields, invalid inputs, and missing labels.",
      settings: {
        modes: {
          forms: {
            enabled: true,
            highlightRequired: true,
            flagUnlabeled: true,
            flagInvalid: true
          },
          navigation: {
            enabled: true,
            focusRing: true,
            largerTargets: true,
            underlineLinks: true,
            keyboardMap: false
          }
        }
      }
    },
    calm: {
      label: "Calm",
      description: "Reduce movement and soften color intensity.",
      settings: {
        modes: {
          motion: {
            enabled: true,
            disableAnimations: true,
            reduceScrolling: true,
            pauseMedia: true
          },
          filter: {
            enabled: true,
            preset: "warm",
            grayscale: 0,
            saturation: 85,
            brightness: 96,
            contrast: 96,
            sepia: 8
          }
        }
      }
    },
    nightReading: {
      label: "Night Reading",
      description: "Dark page, warm colors, and comfortable reading text.",
      settings: {
        modes: {
          contrast: {
            enabled: true,
            preset: "dark",
            invertImages: false
          },
          text: {
            enabled: true,
            scale: 128,
            lineHeight: 1.75,
            letterSpacing: 0.02,
            wordSpacing: 0.08,
            paragraphSpacing: 0.85,
            fontFamily: "system"
          },
          filter: {
            enabled: true,
            preset: "warm",
            saturation: 82,
            brightness: 92,
            contrast: 96,
            sepia: 12
          }
        }
      }
    },
    keyboard: {
      label: "Keyboard",
      description: "Strong focus rings, larger targets, and underlined links.",
      settings: {
        modes: {
          navigation: {
            enabled: true,
            focusRing: true,
            underlineLinks: true,
            largerTargets: true,
            showAltWarnings: false
          }
        }
      }
    },
    motionSafe: {
      label: "Motion Safe",
      description: "Stop animations, instant scroll, and autoplay media.",
      settings: {
        modes: {
          motion: {
            enabled: true,
            disableAnimations: true,
            reduceScrolling: true,
            pauseMedia: true
          }
        }
      }
    },
    bilingualReader: {
      label: "Bilingual Reader",
      description: "Language-aware read aloud with visible sentence highlighting.",
      settings: {
        modes: {
          speech: {
            voiceURI: "auto",
            rate: 0.92,
            pitch: 1,
            volume: 1,
            naturalPauses: true,
            pauseScale: 0.6,
            highlight: true
          },
          text: {
            enabled: true,
            scale: 112,
            lineHeight: 1.75,
            letterSpacing: 0.01,
            wordSpacing: 0.06
          }
        }
      }
    },
    readingComfort: {
      label: "Reading Comfort",
      description: "Larger line spacing, guide band, and readable links.",
      settings: {
        modes: {
          text: {
            enabled: true,
            scale: 118,
            lineHeight: 1.9,
            letterSpacing: 0.03,
            wordSpacing: 0.1,
            paragraphSpacing: 1,
            fontFamily: "system"
          },
          guide: {
            enabled: true,
            height: 80,
            color: "#fde68a",
            opacity: 0.22
          },
          navigation: {
            enabled: true,
            focusRing: true,
            underlineLinks: true,
            largerTargets: false
          }
        }
      }
    },
    photosensitive: {
      label: "Photosensitive",
      description: "Reduce flashes, motion, saturation, and autoplay.",
      settings: {
        modes: {
          motion: {
            enabled: true,
            disableAnimations: true,
            reduceScrolling: true,
            pauseMedia: true
          },
          filter: {
            enabled: true,
            preset: "none",
            grayscale: 15,
            saturation: 65,
            brightness: 92,
            contrast: 90,
            sepia: 4
          }
        }
      }
    }
  };
  const UNSAFE_MERGE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

  function clone(value) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value));
  }

  function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function mergeDeep(base, override) {
    const result = clone(base);

    if (!isPlainObject(override)) {
      return result;
    }

    Object.keys(override).forEach((key) => {
      if (UNSAFE_MERGE_KEYS.has(key)) {
        return;
      }

      if (isPlainObject(result[key]) && isPlainObject(override[key])) {
        result[key] = mergeDeep(result[key], override[key]);
      } else {
        result[key] = clone(override[key]);
      }
    });

    return result;
  }

  function withDefaults(value) {
    return mergeDeep(DEFAULT_SETTINGS, value || {});
  }

  function withSiteStore(value) {
    return mergeDeep(DEFAULT_SITE_STORE, value || {});
  }

  function withProfileStore(value) {
    return pruneProfileStore(mergeDeep(DEFAULT_PROFILE_STORE, value || {}));
  }

  function withHistoryStore(value) {
    const store = mergeDeep(DEFAULT_HISTORY_STORE, value || {});
    store.entries = Array.isArray(store.entries) ? store.entries.slice(0, MAX_HISTORY_ENTRIES) : [];
    return store;
  }

  function withSummaryCache(value) {
    return pruneSummaryCache(mergeDeep(DEFAULT_SUMMARY_CACHE, value || {}));
  }

  function withSpeechProgressStore(value) {
    return pruneSpeechProgressStore(mergeDeep(DEFAULT_SPEECH_PROGRESS_STORE, value || {}));
  }

  function applyPreset(settings, presetId) {
    const preset = PRESETS[presetId];
    if (!preset) {
      return withDefaults(settings);
    }

    const nextSettings = withDefaults(mergeDeep(withDefaults(settings), preset.settings));
    nextSettings.enabled = true;
    nextSettings.activePreset = presetId;
    return withDefaults(nextSettings);
  }

  function removePreset(settings, presetId) {
    const preset = PRESETS[presetId];
    const nextSettings = withDefaults(settings);

    if (!preset) {
      nextSettings.activePreset = null;
      return nextSettings;
    }

    Object.entries(preset.settings.modes || {}).forEach(([modeName, presetMode]) => {
      if (presetMode && presetMode.enabled === true && nextSettings.modes[modeName]) {
        nextSettings.modes[modeName].enabled = false;
      }
    });

    nextSettings.activePreset = null;
    return withDefaults(nextSettings);
  }

  function clearActivePreset(settings) {
    const nextSettings = withDefaults(settings);
    nextSettings.activePreset = null;
    return nextSettings;
  }

  function getSiteKeyFromUrl(url) {
    try {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) {
        return null;
      }

      return parsed.hostname.toLowerCase().replace(/^www\./, "");
    } catch (_error) {
      return null;
    }
  }

  function getSiteLabelFromUrl(url) {
    return getSiteKeyFromUrl(url) || "This site";
  }

  function getSiteEntry(siteStore, url) {
    const key = getSiteKeyFromUrl(url);
    if (!key) {
      return null;
    }

    const store = withSiteStore(siteStore);
    return store.sites[key] || null;
  }

  function hasSiteSettings(siteStore, url) {
    const entry = getSiteEntry(siteStore, url);
    return Boolean(entry && entry.enabled);
  }

  function getEffectiveSettings(globalSettings, siteStore, url) {
    const base = withDefaults(globalSettings);
    const entry = getSiteEntry(siteStore, url);

    if (!entry || !entry.enabled) {
      return base;
    }

    return withDefaults(mergeDeep(base, entry.settings || {}));
  }

  function upsertSiteSettings(siteStore, url, settings) {
    const key = getSiteKeyFromUrl(url);
    if (!key) {
      return withSiteStore(siteStore);
    }

    const store = withSiteStore(siteStore);
    const existing = store.sites[key] || {};
    store.sites[key] = {
      ...existing,
      enabled: true,
      key,
      label: getSiteLabelFromUrl(url),
      settings: withDefaults(settings),
      rule: existing.rule ? normalizeSiteRule(existing.rule) : null,
      lastUpdated: new Date().toISOString()
    };

    return pruneSiteStore(store);
  }

  function disableSiteSettings(siteStore, url) {
    const key = getSiteKeyFromUrl(url);
    const store = withSiteStore(siteStore);

    if (key && store.sites[key]) {
      store.sites[key].enabled = false;
      store.sites[key].lastUpdated = new Date().toISOString();
    }

    return store;
  }

  function removeSiteSettings(siteStore, url) {
    const key = getSiteKeyFromUrl(url);
    const store = withSiteStore(siteStore);

    if (key) {
      delete store.sites[key];
    }

    return store;
  }

  function pruneSiteStore(siteStore) {
    const store = withSiteStore(siteStore);
    const entries = Object.entries(store.sites)
      .sort((first, second) => {
        return String(second[1].lastUpdated || "").localeCompare(String(first[1].lastUpdated || ""));
      });

    store.sites = Object.fromEntries(entries.slice(0, MAX_SITE_SETTINGS));
    return store;
  }

  function getBuiltInSiteRule(url) {
    const key = getSiteKeyFromUrl(url);
    if (!key) {
      return null;
    }

    const directRule = SITE_RULE_PACKS[key];
    if (directRule) {
      return normalizeSiteRule(directRule);
    }

    const matchingKey = Object.keys(SITE_RULE_PACKS)
      .filter((ruleKey) => key === ruleKey || key.endsWith(`.${ruleKey}`))
      .sort((first, second) => second.length - first.length)[0];

    return matchingKey ? normalizeSiteRule(SITE_RULE_PACKS[matchingKey]) : null;
  }

  function getSiteRule(siteStore, url) {
    const builtIn = getBuiltInSiteRule(url);
    const entry = getSiteEntry(siteStore, url);
    const custom = entry && entry.enabled && entry.rule ? normalizeSiteRule(entry.rule) : null;

    if (builtIn && custom) {
      return mergeSiteRules(builtIn, custom);
    }

    return custom || builtIn || null;
  }

  function upsertSiteRule(siteStore, url, rule) {
    const key = getSiteKeyFromUrl(url);
    if (!key) {
      return withSiteStore(siteStore);
    }

    const store = withSiteStore(siteStore);
    const existing = store.sites[key] || {};
    store.sites[key] = {
      ...existing,
      enabled: true,
      key,
      label: getSiteLabelFromUrl(url),
      settings: withDefaults(existing.settings || {}),
      rule: mergeSiteRules(existing.rule || {}, rule || {}),
      lastUpdated: new Date().toISOString()
    };

    return pruneSiteStore(store);
  }

  function removeSiteRule(siteStore, url) {
    const key = getSiteKeyFromUrl(url);
    const store = withSiteStore(siteStore);

    if (key && store.sites[key]) {
      store.sites[key].rule = null;
      store.sites[key].lastUpdated = new Date().toISOString();
    }

    return store;
  }

  function mergeSiteRules(baseRule, overrideRule) {
    const base = normalizeSiteRule(baseRule);
    const override = normalizeSiteRule(overrideRule);
    return normalizeSiteRule({
      label: override.label || base.label,
      source: override.source || base.source,
      mainSelector: override.mainSelector || base.mainSelector,
      mainSelectors: uniqueList([override.mainSelector, base.mainSelector]
        .concat(override.mainSelectors || [], base.mainSelectors || [])),
      hideSelectors: uniqueList((base.hideSelectors || []).concat(override.hideSelectors || [])),
      mediaSelectors: uniqueList((base.mediaSelectors || []).concat(override.mediaSelectors || []))
    });
  }

  function normalizeSiteRule(rule) {
    const value = isPlainObject(rule) ? rule : {};
    const mainSelector = typeof value.mainSelector === "string" ? value.mainSelector.trim() : "";

    return {
      label: typeof value.label === "string" ? value.label.slice(0, 80) : "",
      source: typeof value.source === "string" ? value.source.slice(0, 40) : "",
      mainSelector,
      mainSelectors: uniqueList([mainSelector].concat(Array.isArray(value.mainSelectors) ? value.mainSelectors : [])),
      hideSelectors: uniqueList(Array.isArray(value.hideSelectors) ? value.hideSelectors : []),
      mediaSelectors: uniqueList(Array.isArray(value.mediaSelectors) ? value.mediaSelectors : [])
    };
  }

  function uniqueList(values) {
    return Array.from(new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )).slice(0, 80);
  }

  function createProfile(profileStore, label, settings) {
    const store = withProfileStore(profileStore);
    const safeLabel = String(label || "Custom profile").trim().slice(0, 80) || "Custom profile";
    const id = `profile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    store.profiles[id] = {
      id,
      label: safeLabel,
      settings: withDefaults(settings),
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    store.activeProfileId = id;

    return pruneProfileStore(store);
  }

  function upsertProfile(profileStore, profile) {
    const store = withProfileStore(profileStore);
    const existingId = profile && profile.id ? String(profile.id) : "";
    const id = existingId || `profile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    store.profiles[id] = {
      id,
      label: String((profile && profile.label) || "Imported profile").trim().slice(0, 80) || "Imported profile",
      settings: withDefaults(profile && profile.settings),
      createdAt: (profile && profile.createdAt) || new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    store.activeProfileId = id;

    return pruneProfileStore(store);
  }

  function removeProfile(profileStore, profileId) {
    const store = withProfileStore(profileStore);
    delete store.profiles[profileId];

    if (store.activeProfileId === profileId) {
      store.activeProfileId = null;
    }

    return store;
  }

  function applyProfile(settings, profileStore, profileId) {
    const store = withProfileStore(profileStore);
    const profile = store.profiles[profileId];

    if (!profile) {
      return withDefaults(settings);
    }

    const nextSettings = withDefaults(profile.settings);
    nextSettings.enabled = true;
    nextSettings.activePreset = null;
    return nextSettings;
  }

  function pruneProfileStore(profileStore) {
    const store = mergeDeep(DEFAULT_PROFILE_STORE, profileStore || {});
    const entries = Object.entries(store.profiles || {})
      .filter((entry) => entry[1] && entry[1].settings)
      .map(([id, profile]) => {
        return [id, Object.assign({}, profile, {
          id,
          label: String(profile.label || "Custom profile").slice(0, 80),
          settings: withDefaults(profile.settings)
        })];
      })
      .sort((first, second) => {
        return String(second[1].lastUpdated || second[1].createdAt || "")
          .localeCompare(String(first[1].lastUpdated || first[1].createdAt || ""));
      });

    store.profiles = Object.fromEntries(entries.slice(0, MAX_PROFILES));
    if (store.activeProfileId && !store.profiles[store.activeProfileId]) {
      store.activeProfileId = null;
    }

    return store;
  }

  function addHistoryEntry(historyStore, entry) {
    const store = withHistoryStore(historyStore);
    const snapshot = entry || {};
    const settings = snapshot.settings ? withDefaults(snapshot.settings) : null;

    if (!settings) {
      return store;
    }

    store.entries.unshift({
      id: `history_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      scope: snapshot.scope === "site" ? "site" : "global",
      siteKey: snapshot.siteKey || null,
      siteLabel: snapshot.siteLabel || "",
      label: snapshot.label || "Previous settings",
      settings,
      createdAt: new Date().toISOString()
    });
    store.entries = store.entries.slice(0, MAX_HISTORY_ENTRIES);
    return store;
  }

  function removeHistoryEntry(historyStore, historyId) {
    const store = withHistoryStore(historyStore);
    store.entries = store.entries.filter((entry) => entry.id !== historyId);
    return store;
  }

  function upsertSummaryCache(summaryCache, key, entry) {
    const cache = withSummaryCache(summaryCache);
    if (!key || !entry) {
      return cache;
    }

    cache.entries[key] = Object.assign({}, entry, {
      key,
      summaryItems: Array.isArray(entry.summaryItems) ? entry.summaryItems.slice(0, 12) : [],
      createdAt: entry.createdAt || new Date().toISOString(),
      lastUsed: new Date().toISOString()
    });
    return pruneSummaryCache(cache);
  }

  function pruneSummaryCache(summaryCache) {
    const cache = mergeDeep(DEFAULT_SUMMARY_CACHE, summaryCache || {});
    const entries = Object.entries(cache.entries || {})
      .filter((entry) => entry[1] && entry[1].summary)
      .sort((first, second) => {
        return String(second[1].lastUsed || second[1].createdAt || "")
          .localeCompare(String(first[1].lastUsed || first[1].createdAt || ""));
      })
      .slice(0, MAX_SUMMARY_CACHE_ENTRIES);

    cache.entries = Object.fromEntries(entries);
    return cache;
  }

  function getSpeechProgressEntry(speechProgressStore, key) {
    const store = withSpeechProgressStore(speechProgressStore);
    return key && store.pages[key] ? store.pages[key] : null;
  }

  function upsertSpeechProgress(speechProgressStore, key, entry) {
    const store = withSpeechProgressStore(speechProgressStore);
    if (!key || !entry) {
      return store;
    }

    const existing = store.pages[key] || {};
    store.pages[key] = Object.assign({}, existing, {
      key,
      url: String(entry.url || existing.url || "").slice(0, 2000),
      title: String(entry.title || existing.title || "This page").slice(0, 160),
      label: String(entry.label || existing.label || "Page reading").slice(0, 80),
      sourceHash: String(entry.sourceHash || existing.sourceHash || "").slice(0, 120),
      index: Math.max(0, Number(entry.index) || 0),
      total: Math.max(0, Number(entry.total) || 0),
      text: String(entry.text || "").slice(0, 220),
      lastUpdated: new Date().toISOString(),
      bookmarks: normalizeSpeechBookmarks(existing.bookmarks)
    });

    return pruneSpeechProgressStore(store);
  }

  function removeSpeechProgress(speechProgressStore, key) {
    const store = withSpeechProgressStore(speechProgressStore);
    if (key) {
      delete store.pages[key];
    }
    return store;
  }

  function addSpeechBookmark(speechProgressStore, key, bookmark) {
    const store = withSpeechProgressStore(speechProgressStore);
    if (!key || !bookmark) {
      return store;
    }

    const existing = store.pages[key] || {
      key,
      url: "",
      title: "This page",
      label: "Page reading",
      sourceHash: "",
      index: 0,
      total: 0,
      text: "",
      lastUpdated: new Date().toISOString(),
      bookmarks: []
    };
    const index = Math.max(0, Number(bookmark.index) || 0);
    const bookmarkEntry = {
      id: `bookmark_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      index,
      label: String(bookmark.label || `Segment ${index + 1}`).slice(0, 80),
      text: String(bookmark.text || "").slice(0, 220),
      createdAt: new Date().toISOString()
    };

    store.pages[key] = Object.assign({}, existing, {
      bookmarks: [bookmarkEntry].concat(normalizeSpeechBookmarks(existing.bookmarks).filter((item) => item.index !== index)),
      lastUpdated: new Date().toISOString()
    });

    return pruneSpeechProgressStore(store);
  }

  function removeSpeechBookmark(speechProgressStore, key, bookmarkId) {
    const store = withSpeechProgressStore(speechProgressStore);
    const entry = key && store.pages[key];
    if (entry) {
      entry.bookmarks = normalizeSpeechBookmarks(entry.bookmarks)
        .filter((bookmark) => bookmark.id !== bookmarkId);
      entry.lastUpdated = new Date().toISOString();
    }
    return store;
  }

  function pruneSpeechProgressStore(speechProgressStore) {
    const store = mergeDeep(DEFAULT_SPEECH_PROGRESS_STORE, speechProgressStore || {});
    const entries = Object.entries(store.pages || {})
      .filter((entry) => entry[1] && (entry[1].url || entry[1].title))
      .map(([key, entry]) => {
        return [key, {
          key,
          url: String(entry.url || "").slice(0, 2000),
          title: String(entry.title || "This page").slice(0, 160),
          label: String(entry.label || "Page reading").slice(0, 80),
          sourceHash: String(entry.sourceHash || "").slice(0, 120),
          index: Math.max(0, Number(entry.index) || 0),
          total: Math.max(0, Number(entry.total) || 0),
          text: String(entry.text || "").slice(0, 220),
          lastUpdated: entry.lastUpdated || entry.createdAt || new Date().toISOString(),
          bookmarks: normalizeSpeechBookmarks(entry.bookmarks)
        }];
      })
      .sort((first, second) => {
        return String(second[1].lastUpdated || "").localeCompare(String(first[1].lastUpdated || ""));
      })
      .slice(0, MAX_SPEECH_PROGRESS_PAGES);

    store.pages = Object.fromEntries(entries);
    return store;
  }

  function normalizeSpeechBookmarks(bookmarks) {
    return (Array.isArray(bookmarks) ? bookmarks : [])
      .filter(Boolean)
      .map((bookmark) => ({
        id: String(bookmark.id || `bookmark_${Date.now().toString(36)}`).slice(0, 80),
        index: Math.max(0, Number(bookmark.index) || 0),
        label: String(bookmark.label || `Segment ${(Number(bookmark.index) || 0) + 1}`).slice(0, 80),
        text: String(bookmark.text || "").slice(0, 220),
        createdAt: bookmark.createdAt || new Date().toISOString()
      }))
      .sort((first, second) => String(second.createdAt || "").localeCompare(String(first.createdAt || "")))
      .slice(0, MAX_SPEECH_BOOKMARKS_PER_PAGE);
  }

  global.AccessiViewConfig = {
    STORAGE_KEY,
    SITE_STORAGE_KEY,
    PROFILE_STORAGE_KEY,
    HISTORY_STORAGE_KEY,
    SUMMARY_CACHE_KEY,
    SPEECH_PROGRESS_KEY,
    DEFAULT_SETTINGS,
    DEFAULT_SITE_STORE,
    DEFAULT_PROFILE_STORE,
    DEFAULT_HISTORY_STORE,
    DEFAULT_SUMMARY_CACHE,
    DEFAULT_SPEECH_PROGRESS_STORE,
    SITE_RULE_PACKS,
    PRESETS,
    clone,
    mergeDeep,
    withDefaults,
    withSiteStore,
    withProfileStore,
    withHistoryStore,
    withSummaryCache,
    withSpeechProgressStore,
    applyPreset,
    removePreset,
    clearActivePreset,
    getSiteKeyFromUrl,
    getSiteLabelFromUrl,
    getSiteEntry,
    hasSiteSettings,
    getEffectiveSettings,
    upsertSiteSettings,
    disableSiteSettings,
    removeSiteSettings,
    pruneSiteStore,
    getBuiltInSiteRule,
    getSiteRule,
    upsertSiteRule,
    removeSiteRule,
    mergeSiteRules,
    normalizeSiteRule,
    createProfile,
    upsertProfile,
    removeProfile,
    applyProfile,
    pruneProfileStore,
    addHistoryEntry,
    removeHistoryEntry,
    upsertSummaryCache,
    pruneSummaryCache,
    getSpeechProgressEntry,
    upsertSpeechProgress,
    removeSpeechProgress,
    addSpeechBookmark,
    removeSpeechBookmark,
    pruneSpeechProgressStore
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
