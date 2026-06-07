// U2 background activity manager.
// This is a best-effort PWA heartbeat. Mobile browsers may pause it while hidden.
(function () {
    const STORAGE_KEY = 'u2_backgroundActivitySettings';
    const MIN_INTERVAL_SECONDS = 1;
    const MAX_INTERVAL_SECONDS = 3600;

    const defaults = {
        enabled: false,
        intervalSeconds: 60,
        lastTickAt: 0
    };

    let settings = normalize(loadSettings());
    let timerId = null;
    let wakeLock = null;

    function clampInterval(value) {
        const number = Number.parseInt(value, 10);
        if (!Number.isFinite(number)) return defaults.intervalSeconds;
        return Math.max(MIN_INTERVAL_SECONDS, Math.min(MAX_INTERVAL_SECONDS, number));
    }

    function normalize(value) {
        const safe = value && typeof value === 'object' ? value : {};
        return {
            enabled: !!safe.enabled,
            intervalSeconds: clampInterval(safe.intervalSeconds),
            lastTickAt: Number.isFinite(Number(safe.lastTickAt)) ? Number(safe.lastTickAt) : 0
        };
    }

    function loadSettings() {
        try {
            if (window.StorageManager && typeof window.StorageManager.load === 'function') {
                return window.StorageManager.load(STORAGE_KEY, defaults);
            }

            const raw = window.localStorage ? window.localStorage.getItem(STORAGE_KEY) : null;
            return raw ? JSON.parse(raw) : defaults;
        } catch (error) {
            console.warn('[background_activity] Failed to load settings:', error);
            return defaults;
        }
    }

    function saveSettings() {
        try {
            if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                window.StorageManager.save(STORAGE_KEY, settings);
                return;
            }

            if (window.localStorage) {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            }
        } catch (error) {
            console.warn('[background_activity] Failed to save settings:', error);
        }
    }

    function clearTimer() {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    }

    async function releaseWakeLock() {
        if (!wakeLock) return;

        try {
            await wakeLock.release();
        } catch (error) {
            console.warn('[background_activity] Failed to release wake lock:', error);
        } finally {
            wakeLock = null;
        }
    }

    async function requestWakeLock() {
        if (!settings.enabled || document.hidden || wakeLock || !navigator.wakeLock?.request) {
            return;
        }

        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                wakeLock = null;
            });
        } catch (error) {
            wakeLock = null;
            console.info('[background_activity] Wake Lock is unavailable:', error);
        }
    }

    function dispatchTick(reason) {
        const now = Date.now();
        const previousTickAt = settings.lastTickAt || 0;
        settings.lastTickAt = now;
        saveSettings();

        window.dispatchEvent(new CustomEvent('u2:background-activity-tick', {
            detail: {
                reason,
                enabled: settings.enabled,
                intervalSeconds: settings.intervalSeconds,
                tickAt: now,
                previousTickAt,
                elapsedSeconds: previousTickAt ? Math.max(0, Math.round((now - previousTickAt) / 1000)) : 0
            }
        }));
    }

    function maybeCatchUpAfterHidden() {
        if (!settings.enabled || !settings.lastTickAt) return;

        const elapsedMs = Date.now() - settings.lastTickAt;
        if (elapsedMs >= settings.intervalSeconds * 1000) {
            dispatchTick('resume');
        }
    }

    function schedule() {
        clearTimer();

        if (!settings.enabled || document.hidden) {
            return;
        }

        timerId = setInterval(() => {
            dispatchTick('interval');
        }, settings.intervalSeconds * 1000);
    }

    function start(reason = 'start') {
        if (!settings.enabled) {
            stop();
            return;
        }

        if (!settings.lastTickAt) {
            dispatchTick(reason);
        } else {
            maybeCatchUpAfterHidden();
        }

        schedule();
        requestWakeLock();
    }

    function stop() {
        clearTimer();
        releaseWakeLock();
    }

    function updateSettings(nextSettings = {}) {
        settings = normalize({
            ...settings,
            ...nextSettings
        });
        saveSettings();

        if (settings.enabled) {
            start('settings');
        } else {
            stop();
        }

        return getSettings();
    }

    function getSettings() {
        return { ...settings };
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearTimer();
            releaseWakeLock();
            return;
        }

        start('visible');
    });

    window.addEventListener('pagehide', () => {
        clearTimer();
        releaseWakeLock();
    });

    window.addEventListener('pageshow', () => {
        start('pageshow');
    });

    window.u2BackgroundActivity = {
        getSettings,
        updateSettings,
        start,
        stop
    };

    if (settings.enabled) {
        start('boot');
    }
})();
