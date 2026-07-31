(function() {
    const isAndroid = /Android/i.test(navigator.userAgent || '');
    const registrations = new Map();
    const focusScopeRegistrations = new Map();
    const bottomSheetExcludedInputTypes = new Set(['file', 'hidden', 'checkbox', 'radio', 'range', 'color']);
    let activeEntry = null;
    let activeFocusScope = null;
    let viewportListenersBound = false;
    let bottomSheetViewportGuardBound = false;
    let focusScopeViewportGuardBound = false;
    const bottomSheetFocusGuard = {
        active: false,
        overlay: null,
        scrollLeft: 0,
        previousScrollSnapType: '',
        previousScrollBehavior: '',
        previousOverflowX: '',
        previousTouchAction: '',
        restoreTimers: []
    };

    function resolveElement(value) {
        if (typeof value === 'function') return value() || null;
        if (typeof value === 'string') return document.querySelector(value);
        return value || null;
    }

    function getViewportMetrics() {
        const viewport = window.visualViewport;
        return {
            height: Math.round(viewport?.height || window.innerHeight || 0),
            width: Math.round(viewport?.width || window.innerWidth || 0)
        };
    }

    function getPagesContainer() {
        return document.getElementById('pages-container');
    }

    function isBottomSheetEditableTarget(target) {
        if (!target || !target.closest || target.disabled) return false;

        const tagName = target.tagName;
        if (tagName === 'TEXTAREA') return !target.readOnly;
        if (tagName === 'SELECT') return true;
        if (target.isContentEditable || target.getAttribute?.('contenteditable') === 'true') return true;
        if (tagName !== 'INPUT') return false;

        const type = String(target.getAttribute('type') || target.type || 'text').toLowerCase();
        return !target.readOnly && !bottomSheetExcludedInputTypes.has(type);
    }

    function resolveFocusScope(target) {
        if (!isAndroid || !isBottomSheetEditableTarget(target)) return null;

        for (const registration of focusScopeRegistrations.values()) {
            let root = null;
            try {
                root = target.closest(registration.selector);
            } catch (error) {
                console.warn('[mobileInputCompat] Invalid focus scope selector:', registration.selector, error);
            }
            if (root) return { registration, root, target };
        }
        return null;
    }

    function restoreFocusScopeWindowPosition(scope = activeFocusScope) {
        if (!isAndroid || !scope) return;

        try {
            window.scrollTo(scope.scrollLeft, scope.scrollTop);
        } catch (error) {
            // Some embedded Android WebViews can reject scrollTo while the keyboard is animating.
        }
        document.documentElement.scrollLeft = scope.scrollLeft;
        document.documentElement.scrollTop = scope.scrollTop;
        document.body.scrollLeft = scope.scrollLeft;
        document.body.scrollTop = scope.scrollTop;
    }

    function clearFocusScopeRestoreTimers(scope = activeFocusScope) {
        if (!scope) return;
        scope.restoreTimers.forEach(timer => clearTimeout(timer));
        scope.restoreTimers = [];
    }

    function scheduleFocusScopeWindowRestore(scope = activeFocusScope) {
        if (!isAndroid || !scope || scope !== activeFocusScope) return;
        clearFocusScopeRestoreTimers(scope);
        requestAnimationFrame(() => restoreFocusScopeWindowPosition(scope));
        [0, 60, 180, 360].forEach(delay => {
            scope.restoreTimers.push(setTimeout(() => restoreFocusScopeWindowPosition(scope), delay));
        });
    }

    function getFocusScopeScrollContainer(scope) {
        if (!scope || typeof scope.registration.resolveScrollContainer !== 'function') return null;
        try {
            return resolveElement(scope.registration.resolveScrollContainer(scope.target, scope.root));
        } catch (error) {
            console.warn('[mobileInputCompat] Failed to resolve focus-scope scroll container:', error);
            return null;
        }
    }

    function scrollFocusScopeToLatest(scope) {
        const scrollContainer = getFocusScopeScrollContainer(scope);
        if (!scrollContainer) return;
        requestAnimationFrame(() => {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        });
    }

    function restoreFocusScopeLayout(scope = activeFocusScope, options = {}) {
        if (!scope) return;

        const { root, originalRoot } = scope;
        if (root?.style) {
            root.style.height = originalRoot.height;
            root.style.top = originalRoot.top;
            root.style.bottom = originalRoot.bottom;
            root.classList.remove('u2-android-keyboard-open');
        }
        scope.keyboardWasOpen = false;
        restoreFocusScopeWindowPosition(scope);
        if (options.scrollToLatest) scrollFocusScopeToLatest(scope);
    }

    function releaseFocusScope(scope = activeFocusScope) {
        if (!scope) return;

        clearFocusScopeRestoreTimers(scope);
        restoreFocusScopeLayout(scope, { scrollToLatest: scope.keyboardWasOpen });
        scope.root?.classList?.remove('u2-android-focus-locked');
        if (activeFocusScope === scope) activeFocusScope = null;
    }

    function captureFocusScope(target) {
        if (!isAndroid) return false;
        const resolved = resolveFocusScope(target);
        if (!resolved) return false;

        if (activeFocusScope && activeFocusScope.root === resolved.root) {
            activeFocusScope.target = target;
            if (!activeFocusScope.keyboardWasOpen) {
                const metrics = getViewportMetrics();
                const layoutHeight = Math.round(window.innerHeight || metrics.height || 0);
                activeFocusScope.restingHeight = Math.max(activeFocusScope.restingHeight, layoutHeight, metrics.height);
                activeFocusScope.restingLayoutHeight = Math.max(activeFocusScope.restingLayoutHeight, layoutHeight);
            }
            activeFocusScope.root.classList.add('u2-android-focus-locked');
            scheduleFocusScopeWindowRestore(activeFocusScope);
            return true;
        }

        if (activeFocusScope) releaseFocusScope(activeFocusScope);

        const metrics = getViewportMetrics();
        const layoutHeight = Math.round(window.innerHeight || metrics.height || 0);
        const root = resolved.root;
        activeFocusScope = {
            ...resolved,
            scrollLeft: Math.round(window.scrollX || document.documentElement.scrollLeft || document.body.scrollLeft || 0),
            scrollTop: Math.round(window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0),
            restingHeight: Math.max(layoutHeight, metrics.height),
            restingLayoutHeight: layoutHeight,
            keyboardWasOpen: false,
            restoreTimers: [],
            releaseTimer: null,
            originalRoot: {
                height: root.style.height,
                top: root.style.top,
                bottom: root.style.bottom
            }
        };
        root.classList.add('u2-android-focus-locked');
        bindFocusScopeViewportGuard();
        scheduleFocusScopeWindowRestore(activeFocusScope);
        return true;
    }

    function isActiveFocusScopeStillFocused(scope = activeFocusScope) {
        if (!scope) return false;
        const resolved = resolveFocusScope(document.activeElement);
        return !!resolved && resolved.root === scope.root;
    }

    function applyFocusScopeViewport() {
        const scope = activeFocusScope;
        if (!isAndroid || !scope || !scope.root?.isConnected) return;

        const metrics = getViewportMetrics();
        const layoutHeight = Math.round(window.innerHeight || metrics.height || 0);
        const layoutAlreadyResized = scope.restingLayoutHeight - layoutHeight > 100;
        const viewportHeight = layoutAlreadyResized ? layoutHeight : metrics.height;
        const viewportTop = layoutAlreadyResized ? 0 : Math.round(window.visualViewport?.offsetTop || 0);
        if (viewportHeight <= 0) return;

        const focused = isActiveFocusScopeStillFocused(scope);
        const keyboardOpen = focused && scope.restingHeight - viewportHeight > 100;
        scheduleFocusScopeWindowRestore(scope);

        if (!keyboardOpen) {
            if (scope.keyboardWasOpen) restoreFocusScopeLayout(scope, { scrollToLatest: true });
            if (!focused || viewportHeight >= scope.restingHeight - 72) {
                scope.restingHeight = Math.max(scope.restingHeight, layoutHeight, metrics.height);
                scope.restingLayoutHeight = Math.max(scope.restingLayoutHeight, layoutHeight);
            }
            return;
        }

        scope.keyboardWasOpen = true;
        scope.root.style.height = `${viewportHeight}px`;
        scope.root.style.top = `${viewportTop}px`;
        scope.root.style.bottom = 'auto';
        scope.root.classList.add('u2-android-keyboard-open');
        scrollFocusScopeToLatest(scope);
    }

    function handleFocusScopeViewportChange() {
        if (!isAndroid || !activeFocusScope) return;
        applyFocusScopeViewport();
    }

    function bindFocusScopeViewportGuard() {
        if (!isAndroid || !window.visualViewport || focusScopeViewportGuardBound) return;
        focusScopeViewportGuardBound = true;
        window.visualViewport.addEventListener('resize', handleFocusScopeViewportChange, { passive: true });
        window.visualViewport.addEventListener('scroll', handleFocusScopeViewportChange, { passive: true });
    }

    function releaseFocusScopeIfIdle(scope) {
        if (!scope || scope !== activeFocusScope) return;
        if (isActiveFocusScopeStillFocused(scope)) {
            scheduleFocusScopeWindowRestore(scope);
            return;
        }
        releaseFocusScope(scope);
    }

    function scheduleFocusScopeRelease() {
        const scope = activeFocusScope;
        if (!isAndroid || !scope) return;
        if (scope.releaseTimer) clearTimeout(scope.releaseTimer);
        scope.releaseTimer = setTimeout(() => releaseFocusScopeIfIdle(scope), 120);
    }

    function registerFocusScope(options = {}) {
        const selector = String(options.selector || '').trim();
        if (!selector) return function() {};

        const previous = focusScopeRegistrations.get(selector);
        if (previous) previous.cleanup();

        const registration = {
            selector,
            preferFocusScope: options.preferFocusScope === true,
            resolveScrollContainer: typeof options.resolveScrollContainer === 'function'
                ? options.resolveScrollContainer
                : null,
            cleanup: null
        };
        registration.cleanup = () => {
            if (activeFocusScope?.registration === registration) releaseFocusScope(activeFocusScope);
            if (focusScopeRegistrations.get(selector) === registration) focusScopeRegistrations.delete(selector);
        };
        focusScopeRegistrations.set(selector, registration);
        bindFocusScopeViewportGuard();
        return registration.cleanup;
    }

    function getActiveBottomSheetOverlay(target) {
        if (!target || !target.closest) return null;
        const overlay = target.closest('.bottom-sheet-overlay.active');
        return overlay || null;
    }

    function resetHorizontalWindowScroll() {
        try {
            window.scrollTo(0, window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0);
        } catch (error) {
            // Some embedded Android WebViews can reject scrollTo while the keyboard is animating.
        }
        document.documentElement.scrollLeft = 0;
        document.body.scrollLeft = 0;
    }

    function restoreBottomSheetFocusPosition() {
        if (!isAndroid || !bottomSheetFocusGuard.active) return;

        const pagesContainer = getPagesContainer();
        if (pagesContainer) {
            try {
                pagesContainer.scrollTo({ left: bottomSheetFocusGuard.scrollLeft, behavior: 'auto' });
            } catch (error) {
                pagesContainer.scrollLeft = bottomSheetFocusGuard.scrollLeft;
            }
            pagesContainer.scrollLeft = bottomSheetFocusGuard.scrollLeft;
        }
        resetHorizontalWindowScroll();
    }

    function scheduleBottomSheetFocusRestore() {
        if (!isAndroid || !bottomSheetFocusGuard.active) return;
        bottomSheetFocusGuard.restoreTimers.forEach(timer => clearTimeout(timer));
        bottomSheetFocusGuard.restoreTimers = [];
        requestAnimationFrame(restoreBottomSheetFocusPosition);
        [0, 60, 180, 360].forEach(delay => {
            bottomSheetFocusGuard.restoreTimers.push(setTimeout(restoreBottomSheetFocusPosition, delay));
        });
    }

    function lockBottomSheetFocusScroll(target) {
        if (!isAndroid || !isBottomSheetEditableTarget(target)) return false;

        const overlay = getActiveBottomSheetOverlay(target);
        if (!overlay) return false;

        const pagesContainer = getPagesContainer();
        if (!bottomSheetFocusGuard.active) {
            bottomSheetFocusGuard.active = true;
            bottomSheetFocusGuard.scrollLeft = pagesContainer ? pagesContainer.scrollLeft : 0;
            if (pagesContainer) {
                bottomSheetFocusGuard.previousScrollSnapType = pagesContainer.style.scrollSnapType || '';
                bottomSheetFocusGuard.previousScrollBehavior = pagesContainer.style.scrollBehavior || '';
                bottomSheetFocusGuard.previousOverflowX = pagesContainer.style.overflowX || '';
                bottomSheetFocusGuard.previousTouchAction = pagesContainer.style.touchAction || '';
            }
        }

        bottomSheetFocusGuard.overlay = overlay;
        overlay.classList.add('u2-android-input-locked');

        if (pagesContainer) {
            pagesContainer.style.scrollSnapType = 'none';
            pagesContainer.style.scrollBehavior = 'auto';
            pagesContainer.style.overflowX = 'hidden';
            pagesContainer.style.touchAction = 'none';
        }

        bindBottomSheetViewportGuard();
        scheduleBottomSheetFocusRestore();
        return true;
    }

    function activateAndroidInputGuard(target) {
        const preferredScope = resolveFocusScope(target);
        if (preferredScope?.registration.preferFocusScope) {
            if (bottomSheetFocusGuard.active) unlockBottomSheetFocusScroll();
            return captureFocusScope(target) ? 'focus-scope' : '';
        }

        const bottomSheetLocked = lockBottomSheetFocusScroll(target);
        if (bottomSheetLocked) {
            if (activeFocusScope) releaseFocusScope(activeFocusScope);
            return 'bottom-sheet';
        }
        return captureFocusScope(target) ? 'focus-scope' : '';
    }

    function unlockBottomSheetFocusScroll() {
        if (!bottomSheetFocusGuard.active) return;

        bottomSheetFocusGuard.restoreTimers.forEach(timer => clearTimeout(timer));
        bottomSheetFocusGuard.restoreTimers = [];

        const pagesContainer = getPagesContainer();
        if (pagesContainer) {
            pagesContainer.style.scrollSnapType = bottomSheetFocusGuard.previousScrollSnapType;
            pagesContainer.style.scrollBehavior = bottomSheetFocusGuard.previousScrollBehavior;
            pagesContainer.style.overflowX = bottomSheetFocusGuard.previousOverflowX;
            pagesContainer.style.touchAction = bottomSheetFocusGuard.previousTouchAction;
            pagesContainer.scrollLeft = bottomSheetFocusGuard.scrollLeft;
        }

        if (bottomSheetFocusGuard.overlay?.classList) {
            bottomSheetFocusGuard.overlay.classList.remove('u2-android-input-locked');
        }

        bottomSheetFocusGuard.active = false;
        bottomSheetFocusGuard.overlay = null;
        bottomSheetFocusGuard.scrollLeft = 0;
        bottomSheetFocusGuard.previousScrollSnapType = '';
        bottomSheetFocusGuard.previousScrollBehavior = '';
        bottomSheetFocusGuard.previousOverflowX = '';
        bottomSheetFocusGuard.previousTouchAction = '';
        resetHorizontalWindowScroll();
    }

    function isBottomSheetGuardContextActive() {
        const activeElement = document.activeElement;
        return isBottomSheetEditableTarget(activeElement) && !!getActiveBottomSheetOverlay(activeElement);
    }

    function releaseBottomSheetFocusScrollIfIdle() {
        if (!isAndroid || !bottomSheetFocusGuard.active) return;
        if (isBottomSheetGuardContextActive()) {
            scheduleBottomSheetFocusRestore();
            return;
        }
        unlockBottomSheetFocusScroll();
    }

    function handleBottomSheetViewportChange() {
        if (!isAndroid || !bottomSheetFocusGuard.active) return;
        scheduleBottomSheetFocusRestore();
        setTimeout(releaseBottomSheetFocusScrollIfIdle, 120);
    }

    function bindBottomSheetViewportGuard() {
        if (!isAndroid || !window.visualViewport || bottomSheetViewportGuardBound) return;
        bottomSheetViewportGuardBound = true;
        window.visualViewport.addEventListener('resize', handleBottomSheetViewportChange, { passive: true });
        window.visualViewport.addEventListener('scroll', handleBottomSheetViewportChange, { passive: true });
    }

    function isSendEnter(event, options = {}) {
        if (!event || event.key !== 'Enter') return false;
        if (event.isComposing || event.keyCode === 229) return false;
        if (event.ctrlKey || event.metaKey || event.altKey) return false;
        if (event.shiftKey) return false;
        if (options.multiline && event.shiftKey) return false;
        return true;
    }

    function captureRestingViewport(entry) {
        if (!isAndroid || !entry) return;
        const metrics = getViewportMetrics();
        if (metrics.width > 0 && Math.abs(metrics.width - entry.viewportWidth) > 48) {
            entry.viewportWidth = metrics.width;
            entry.restingHeight = metrics.height;
            entry.keyboardWasOpen = false;
            return;
        }
        entry.viewportWidth = metrics.width || entry.viewportWidth;
        entry.restingHeight = Math.max(entry.restingHeight, metrics.height);
    }

    function restoreEntry(entry) {
        if (!isAndroid || !entry || !entry.input.isConnected) return;
        const root = resolveElement(entry.root);
        const scrollContainer = resolveElement(entry.scrollContainer);

        if (root?.classList) {
            entry.openClasses.forEach(className => root.classList.remove(className));
        }

        if (entry.restoreWindowScroll) {
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        }

        requestAnimationFrame(() => {
            if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
            if (typeof entry.onRestore === 'function') entry.onRestore(entry);
        });
    }

    function scheduleRestore(entry) {
        entry.restoreTimers.forEach(timer => clearTimeout(timer));
        entry.restoreTimers = [];
        [0, 60, 180, 360].forEach(delay => {
            entry.restoreTimers.push(setTimeout(() => restoreEntry(entry), delay));
        });
    }

    function handleViewportChange() {
        const entry = activeEntry;
        if (!isAndroid || !entry || !entry.input.isConnected) return;

        const metrics = getViewportMetrics();
        if (Math.abs(metrics.width - entry.viewportWidth) > 48) {
            entry.viewportWidth = metrics.width;
            entry.restingHeight = metrics.height;
            entry.keyboardWasOpen = false;
            return;
        }

        const inputFocused = document.activeElement === entry.input;
        if (!inputFocused && !entry.keyboardWasOpen) {
            entry.restingHeight = Math.max(entry.restingHeight, metrics.height);
        }

        if (inputFocused && entry.restingHeight - metrics.height > entry.openThreshold) {
            entry.keyboardWasOpen = true;
            return;
        }

        if (entry.keyboardWasOpen && metrics.height >= entry.restingHeight - entry.closeTolerance) {
            entry.keyboardWasOpen = false;
            entry.restingHeight = Math.max(entry.restingHeight, metrics.height);
            scheduleRestore(entry);
        }
    }

    function bindViewportListeners() {
        if (!isAndroid || !window.visualViewport || viewportListenersBound) return;
        viewportListenersBound = true;
        window.visualViewport.addEventListener('resize', handleViewportChange, { passive: true });
        window.visualViewport.addEventListener('scroll', handleViewportChange, { passive: true });
    }

    function register(options = {}) {
        const input = resolveElement(options.input);
        if (!input) return function() {};

        const existing = registrations.get(input);
        if (existing) existing.cleanup();

        const entry = {
            input,
            root: options.root || null,
            scrollContainer: options.scrollContainer || null,
            onSend: typeof options.onSend === 'function' ? options.onSend : null,
            onRestore: typeof options.onRestore === 'function' ? options.onRestore : null,
            allowEmpty: !!options.allowEmpty,
            multiline: !!options.multiline,
            blurAfterSend: !!options.blurAfterSend,
            restoreWindowScroll: options.restoreWindowScroll !== false,
            openClasses: Array.isArray(options.openClasses)
                ? options.openClasses.filter(Boolean)
                : ['keyboard-open'],
            openThreshold: Number(options.openThreshold) || 100,
            closeTolerance: Number(options.closeTolerance) || 72,
            restingHeight: 0,
            viewportWidth: 0,
            keyboardWasOpen: false,
            restoreTimers: [],
            cleanup: null
        };

        if (options.enterKeyHint !== false) {
            input.setAttribute('enterkeyhint', options.enterKeyHint || 'send');
        }

        const activate = () => {
            activeEntry = entry;
            captureRestingViewport(entry);
        };

        const handleKeydown = (event) => {
            if (!isSendEnter(event, entry)) return;
            event.preventDefault();

            const text = String(input.value || '').trim();
            if (!entry.allowEmpty && !text) return;
            if (!entry.onSend) return;

            try {
                const result = entry.onSend({ event, input, text });
                if (result && typeof result.catch === 'function') {
                    result.catch(error => console.error('[mobileInputCompat] send failed', error));
                }
            } catch (error) {
                console.error('[mobileInputCompat] send failed', error);
            }

            if (entry.blurAfterSend) input.blur();
        };

        const handleBlur = () => {
            if (isAndroid && !window.visualViewport) scheduleRestore(entry);
        };

        input.addEventListener('pointerdown', activate, { passive: true });
        input.addEventListener('touchstart', activate, { passive: true });
        input.addEventListener('focus', activate);
        input.addEventListener('blur', handleBlur);
        input.addEventListener('keydown', handleKeydown);

        entry.cleanup = () => {
            entry.restoreTimers.forEach(timer => clearTimeout(timer));
            input.removeEventListener('pointerdown', activate);
            input.removeEventListener('touchstart', activate);
            input.removeEventListener('focus', activate);
            input.removeEventListener('blur', handleBlur);
            input.removeEventListener('keydown', handleKeydown);
            registrations.delete(input);
            if (activeEntry === entry) activeEntry = null;
        };

        registrations.set(input, entry);
        captureRestingViewport(entry);
        bindViewportListeners();
        return entry.cleanup;
    }

    document.addEventListener('focusin', (event) => {
        activateAndroidInputGuard(event.target);

        const entry = registrations.get(event.target);
        if (entry) {
            activeEntry = entry;
            captureRestingViewport(entry);
        } else if (activeEntry && !activeEntry.keyboardWasOpen) {
            activeEntry = null;
        }
    }, true);

    document.addEventListener('pointerdown', (event) => {
        activateAndroidInputGuard(event.target);
    }, { capture: true, passive: true });

    document.addEventListener('touchstart', (event) => {
        activateAndroidInputGuard(event.target);
    }, { capture: true, passive: true });

    document.addEventListener('focusout', () => {
        if (!isAndroid) return;
        if (bottomSheetFocusGuard.active) setTimeout(releaseBottomSheetFocusScrollIfIdle, 120);
        scheduleFocusScopeRelease();
    }, true);

    document.addEventListener('selectionchange', () => {
        if (!isAndroid || !bottomSheetFocusGuard.active) return;
        if (isBottomSheetGuardContextActive()) {
            scheduleBottomSheetFocusRestore();
        } else {
            setTimeout(releaseBottomSheetFocusScrollIfIdle, 120);
        }
    });

    window.mobileInputCompat = {
        isAndroid,
        isSendEnter,
        register,
        registerFocusScope,
        unregister(input) {
            const element = resolveElement(input);
            registrations.get(element)?.cleanup();
        }
    };
})();
