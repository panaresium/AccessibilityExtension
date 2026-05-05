(function initAccessiViewPageScrollPatch() {
  if (window.__accessiViewScrollPatchV2) {
    return;
  }

  window.__accessiViewScrollPatchV2 = true;

  const originalMethods = {
    windowScroll: window.scroll,
    windowScrollTo: window.scrollTo,
    windowScrollBy: window.scrollBy,
    elementScroll: Element.prototype.scroll,
    elementScrollTo: Element.prototype.scrollTo,
    elementScrollBy: Element.prototype.scrollBy,
    elementScrollIntoView: Element.prototype.scrollIntoView,
    elementAnimate: Element.prototype.animate
  };
  let scrollInstalled = false;
  let animationsInstalled = false;
  let classObserver = null;
  let jqueryPollTimer = null;
  let jqueryPollCount = 0;
  const patchedJQueryObjects = new WeakSet();

  function shouldReduceScroll() {
    const root = document.documentElement;

    return Boolean(
      root &&
      root.classList.contains("av-enabled") &&
      root.classList.contains("av-mode-motion") &&
      root.classList.contains("av-reduce-scroll")
    );
  }

  function shouldDisableAnimations() {
    const root = document.documentElement;

    return Boolean(
      root &&
      root.classList.contains("av-enabled") &&
      root.classList.contains("av-mode-motion") &&
      root.classList.contains("av-disable-animations")
    );
  }

  function normalizeScrollArguments(args) {
    if (args.length === 1 && args[0] && typeof args[0] === "object") {
      return [Object.assign({}, args[0], { behavior: "auto" })];
    }

    return args;
  }

  function normalizeWheelDelta(event) {
    let multiplier = 1;

    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      multiplier = 40;
    } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      multiplier = Math.max(window.innerHeight * 0.9, 240);
    }

    return {
      x: event.deltaX * multiplier,
      y: event.deltaY * multiplier
    };
  }

  function getScrollRoot() {
    return document.scrollingElement || document.documentElement || document.body;
  }

  function getElementFromEvent(event) {
    if (typeof event.composedPath === "function") {
      const path = event.composedPath();
      const element = path.find((item) => item && item.nodeType === Node.ELEMENT_NODE);

      if (element) {
        return element;
      }
    }

    return event.target && event.target.nodeType === Node.ELEMENT_NODE
      ? event.target
      : document.activeElement || document.body;
  }

  function getElementParent(element) {
    if (!element) {
      return null;
    }

    if (element.parentElement) {
      return element.parentElement;
    }

    const root = element.getRootNode && element.getRootNode();
    return root && root.host ? root.host : null;
  }

  function allowsScroll(element, axis) {
    if (!element || element === document || element === window) {
      return false;
    }

    if (element === document.body || element === document.documentElement || element === getScrollRoot()) {
      return true;
    }

    const style = window.getComputedStyle(element);
    const overflow = axis === "y" ? style.overflowY : style.overflowX;

    return /(auto|scroll|overlay)/.test(overflow);
  }

  function canScroll(element, axis, amount) {
    if (!element || !amount) {
      return false;
    }

    const root = getScrollRoot();
    const target = element === document.body || element === document.documentElement ? root : element;
    const current = axis === "y" ? target.scrollTop : target.scrollLeft;
    const max = axis === "y"
      ? target.scrollHeight - target.clientHeight
      : target.scrollWidth - target.clientWidth;

    if (max <= 0 || !allowsScroll(target, axis)) {
      return false;
    }

    return amount > 0 ? current < max : current > 0;
  }

  function findScrollTarget(startElement, deltaX, deltaY) {
    let element = startElement;
    const root = getScrollRoot();
    const preferVertical = Math.abs(deltaY) >= Math.abs(deltaX);

    while (element && element !== document.documentElement) {
      if (preferVertical && canScroll(element, "y", deltaY)) {
        return element;
      }

      if (!preferVertical && canScroll(element, "x", deltaX)) {
        return element;
      }

      if (canScroll(element, "y", deltaY)) {
        return element;
      }

      if (canScroll(element, "x", deltaX)) {
        return element;
      }

      element = getElementParent(element);
    }

    if (canScroll(root, "y", deltaY) || canScroll(root, "x", deltaX)) {
      return root;
    }

    return null;
  }

  function applyInstantScroll(target, deltaX, deltaY) {
    if (!target) {
      return false;
    }

    const root = getScrollRoot();
    const scrollTarget = target === document.body || target === document.documentElement ? root : target;
    const beforeLeft = scrollTarget.scrollLeft;
    const beforeTop = scrollTarget.scrollTop;

    if (deltaX) {
      scrollTarget.scrollLeft += deltaX;
    }

    if (deltaY) {
      scrollTarget.scrollTop += deltaY;
    }

    return scrollTarget.scrollLeft !== beforeLeft || scrollTarget.scrollTop !== beforeTop;
  }

  function handleWheel(event) {
    if (!shouldReduceScroll() || event.defaultPrevented || event.ctrlKey) {
      return;
    }

    const delta = normalizeWheelDelta(event);

    if (!delta.x && !delta.y) {
      return;
    }

    if (event.shiftKey && !delta.x) {
      delta.x = delta.y;
      delta.y = 0;
    }

    const target = findScrollTarget(getElementFromEvent(event), delta.x, delta.y);

    if (!applyInstantScroll(target, delta.x, delta.y)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function isEditableKeyTarget(element) {
    return Boolean(
      element &&
      element.closest &&
      element.closest(
        "input, textarea, select, button, [contenteditable='true'], [role='textbox'], [role='combobox'], [role='listbox'], [role='menu'], [role='slider'], [role='spinbutton'], [role='tablist']"
      )
    );
  }

  function getKeyboardDelta(event) {
    const line = 56;
    const page = Math.max(window.innerHeight * 0.88, 320);

    if (event.key === "ArrowDown") {
      return { x: 0, y: line };
    }

    if (event.key === "ArrowUp") {
      return { x: 0, y: -line };
    }

    if (event.key === "ArrowRight") {
      return { x: line, y: 0 };
    }

    if (event.key === "ArrowLeft") {
      return { x: -line, y: 0 };
    }

    if (event.key === "PageDown" || (event.key === " " && !event.shiftKey)) {
      return { x: 0, y: page };
    }

    if (event.key === "PageUp" || (event.key === " " && event.shiftKey)) {
      return { x: 0, y: -page };
    }

    if (event.key === "Home") {
      return { x: 0, y: -Number.MAX_SAFE_INTEGER };
    }

    if (event.key === "End") {
      return { x: 0, y: Number.MAX_SAFE_INTEGER };
    }

    return null;
  }

  function handleKeydown(event) {
    if (
      !shouldReduceScroll() ||
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      isEditableKeyTarget(event.target)
    ) {
      return;
    }

    const delta = getKeyboardDelta(event);

    if (!delta) {
      return;
    }

    const target = findScrollTarget(document.activeElement || document.body, delta.x, delta.y);

    if (!applyInstantScroll(target, delta.x, delta.y)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function normalizeAnimationOptions(options) {
    if (options === undefined) {
      return { duration: 0, delay: 0, endDelay: 0, iterations: 1 };
    }

    if (typeof options === "number") {
      return 0;
    }

    if (options && typeof options === "object") {
      return Object.assign({}, options, {
        delay: 0,
        duration: 0,
        endDelay: 0,
        iterations: 1
      });
    }

    return options;
  }

  function installScrollOverrides() {
    if (scrollInstalled) {
      return;
    }

    if (originalMethods.windowScroll) {
      window.scroll = function accessiViewPageScroll(...args) {
        return originalMethods.windowScroll.apply(this, normalizeScrollArguments(args));
      };
    }

    if (originalMethods.windowScrollTo) {
      window.scrollTo = function accessiViewPageScrollTo(...args) {
        return originalMethods.windowScrollTo.apply(this, normalizeScrollArguments(args));
      };
    }

    if (originalMethods.windowScrollBy) {
      window.scrollBy = function accessiViewPageScrollBy(...args) {
        return originalMethods.windowScrollBy.apply(this, normalizeScrollArguments(args));
      };
    }

    if (originalMethods.elementScroll) {
      Element.prototype.scroll = function accessiViewPageElementScroll(...args) {
        return originalMethods.elementScroll.apply(this, normalizeScrollArguments(args));
      };
    }

    if (originalMethods.elementScrollTo) {
      Element.prototype.scrollTo = function accessiViewPageElementScrollTo(...args) {
        return originalMethods.elementScrollTo.apply(this, normalizeScrollArguments(args));
      };
    }

    if (originalMethods.elementScrollBy) {
      Element.prototype.scrollBy = function accessiViewPageElementScrollBy(...args) {
        return originalMethods.elementScrollBy.apply(this, normalizeScrollArguments(args));
      };
    }

    if (originalMethods.elementScrollIntoView) {
      Element.prototype.scrollIntoView = function accessiViewPageScrollIntoView(...args) {
        return originalMethods.elementScrollIntoView.apply(this, normalizeScrollArguments(args));
      };
    }

    scrollInstalled = true;
    patchKnownJQueryObjects();
  }

  function restoreScrollOverrides() {
    if (!scrollInstalled) {
      return;
    }

    if (originalMethods.windowScroll) {
      window.scroll = originalMethods.windowScroll;
    }

    if (originalMethods.windowScrollTo) {
      window.scrollTo = originalMethods.windowScrollTo;
    }

    if (originalMethods.windowScrollBy) {
      window.scrollBy = originalMethods.windowScrollBy;
    }

    if (originalMethods.elementScroll) {
      Element.prototype.scroll = originalMethods.elementScroll;
    }

    if (originalMethods.elementScrollTo) {
      Element.prototype.scrollTo = originalMethods.elementScrollTo;
    }

    if (originalMethods.elementScrollBy) {
      Element.prototype.scrollBy = originalMethods.elementScrollBy;
    }

    if (originalMethods.elementScrollIntoView) {
      Element.prototype.scrollIntoView = originalMethods.elementScrollIntoView;
    }

    scrollInstalled = false;
  }

  function installAnimationOverrides() {
    if (animationsInstalled || !originalMethods.elementAnimate) {
      return;
    }

    Element.prototype.animate = function accessiViewPageAnimate(keyframes, options) {
      if (shouldDisableAnimations()) {
        return originalMethods.elementAnimate.call(this, keyframes, normalizeAnimationOptions(options));
      }

      return originalMethods.elementAnimate.call(this, keyframes, options);
    };

    animationsInstalled = true;
    patchKnownJQueryObjects();
  }

  function restoreAnimationOverrides() {
    if (!animationsInstalled || !originalMethods.elementAnimate) {
      return;
    }

    Element.prototype.animate = originalMethods.elementAnimate;
    animationsInstalled = false;
  }

  function refresh() {
    if (shouldReduceScroll()) {
      installScrollOverrides();
    } else {
      restoreScrollOverrides();
    }

    if (shouldDisableAnimations()) {
      installAnimationOverrides();
    } else {
      restoreAnimationOverrides();
    }
  }

  function isScrollAnimation(properties) {
    if (!properties || typeof properties !== "object") {
      return false;
    }

    return Object.prototype.hasOwnProperty.call(properties, "scrollTop") ||
      Object.prototype.hasOwnProperty.call(properties, "scrollLeft");
  }

  function normalizeJQueryAnimationArguments(args) {
    const nextArgs = Array.from(args);

    if (nextArgs.length === 1) {
      nextArgs.push(0);
      return nextArgs;
    }

    if (nextArgs[1] && typeof nextArgs[1] === "object") {
      nextArgs[1] = Object.assign({}, nextArgs[1], { duration: 0 });
      return nextArgs;
    }

    nextArgs[1] = 0;
    return nextArgs;
  }

  function patchJQuery(candidate) {
    if (
      !candidate ||
      !candidate.fn ||
      typeof candidate.fn.animate !== "function" ||
      patchedJQueryObjects.has(candidate)
    ) {
      return;
    }

    const originalAnimate = candidate.fn.animate;

    candidate.fn.animate = function accessiViewJQueryAnimate(properties, ...rest) {
      if (shouldDisableAnimations() || (shouldReduceScroll() && isScrollAnimation(properties))) {
        return originalAnimate.apply(this, normalizeJQueryAnimationArguments([properties, ...rest]));
      }

      return originalAnimate.apply(this, [properties, ...rest]);
    };

    candidate.fn.animate.__accessiViewOriginalAnimate = originalAnimate;
    patchedJQueryObjects.add(candidate);
  }

  function patchKnownJQueryObjects() {
    patchJQuery(window.jQuery);
    patchJQuery(window.$);
  }

  function hookJQueryAlias(alias) {
    const descriptor = Object.getOwnPropertyDescriptor(window, alias);

    if (descriptor && !descriptor.configurable) {
      patchKnownJQueryObjects();
      return;
    }

    if (descriptor && (descriptor.get || descriptor.set)) {
      patchKnownJQueryObjects();
      return;
    }

    let currentValue = descriptor ? descriptor.value : window[alias];

    Object.defineProperty(window, alias, {
      configurable: true,
      enumerable: descriptor ? descriptor.enumerable : true,
      get() {
        return currentValue;
      },
      set(value) {
        currentValue = value;
        patchJQuery(value);
      }
    });

    patchJQuery(currentValue);
  }

  function watchForJQuery() {
    hookJQueryAlias("jQuery");
    hookJQueryAlias("$");
    patchKnownJQueryObjects();

    if (jqueryPollTimer) {
      return;
    }

    jqueryPollTimer = window.setInterval(() => {
      patchKnownJQueryObjects();
      jqueryPollCount += 1;

      if (jqueryPollCount >= 200) {
        window.clearInterval(jqueryPollTimer);
        jqueryPollTimer = null;
      }
    }, 50);
  }

  function observeRoot() {
    if (!document.documentElement || classObserver) {
      return;
    }

    classObserver = new MutationObserver(refresh);
    classObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    });
    refresh();
  }

  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      !event.data ||
      event.data.source !== "AccessiView" ||
      event.data.type !== "ACCESSIVIEW_SET_REDUCE_SCROLL"
    ) {
      return;
    }

    if (event.data.enabled) {
      installScrollOverrides();
      if (shouldDisableAnimations()) {
        installAnimationOverrides();
      }
    } else {
      refresh();
    }
  });
  window.addEventListener("wheel", handleWheel, { capture: true, passive: false });
  window.addEventListener("keydown", handleKeydown, { capture: true });

  observeRoot();
  watchForJQuery();

  if (!classObserver) {
    document.addEventListener("DOMContentLoaded", observeRoot, { once: true });
  }
})();
