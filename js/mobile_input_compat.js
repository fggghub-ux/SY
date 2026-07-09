(function() {
    const isAndroid = /Android/i.test(navigator.userAgent || '');
    const registrations = new Map();
    const bottomSheetExcludedInputTypes = new Set(['file', 'hidden', 'checkbox', 'radio', 'range', 'color']);
    let activeEntry = null;
    let viewportListenersBound = false;
    let bottomSheetViewportGuardBound = false;
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
        if (tagName !== 'INPUT') return false;

        const type = String(target.getAttribute('type') || target.type || 'text').toLowerCase();
        return !target.readOnly && !bottomSheetExcludedInputTypes.has(type);
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
        lockBottomSheetFocusScroll(event.target);

        const entry = registrations.get(event.target);
        if (entry) {
            activeEntry = entry;
            captureRestingViewport(entry);
        } else if (activeEntry && !activeEntry.keyboardWasOpen) {
            activeEntry = null;
        }
    }, true);

    document.addEventListener('pointerdown', (event) => {
        lockBottomSheetFocusScroll(event.target);
    }, { capture: true, passive: true });

    document.addEventListener('touchstart', (event) => {
        lockBottomSheetFocusScroll(event.target);
    }, { capture: true, passive: true });

    document.addEventListener('focusout', () => {
        if (!isAndroid || !bottomSheetFocusGuard.active) return;
        setTimeout(releaseBottomSheetFocusScrollIfIdle, 120);
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
        unregister(input) {
            const element = resolveElement(input);
            registrations.get(element)?.cleanup();
        }
    };
})();
