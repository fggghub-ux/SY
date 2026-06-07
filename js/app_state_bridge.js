// U2 app state bridge.
// Provides the synchronous getAppState/setAppState API expected by migrated app modules,
// while keeping the current IndexedDB-backed appStorage layer as the durable store.
(function () {
    const APP_STATE_KEY = 'u2_appState';
    const SAVE_DEBOUNCE_MS = 120;

    const defaultYoutubeState = {
        channelState: {
            bannerUrl: null,
            url: '',
            boundWorldBookIds: [],
            systemPrompt: '',
            summaryPrompt: '',
            groupChatPrompt: '',
            vodPrompt: '',
            postPrompt: '',
            liveSummaryPrompt: '',
            liveSummaries: [],
            groupChatHistory: [],
            cachedTrendingLive: null,
            cachedTrendingSub: null,
            activeUserLive: null,
            pastVideos: []
        },
        subscriptions: [],
        userState: null
    };

    function createDefaultAppState() {
        return {
            youtube: clone(defaultYoutubeState),
            tiktok: {
                profile: {
                    name: 'User',
                    handle: 'user123',
                    avatar: null,
                    status: '',
                    bio: '',
                    persona: '',
                    following: 0,
                    followers: 0,
                    likes: 0,
                    posts: []
                },
                chars: [],
                videos: [],
                dms: []
            },
            pay: {
                transactions: [],
                balance: 1000
            },
            spotify: {
                customName: '',
                avatarUrl: '',
                backgroundUrl: ''
            },
            diary: {
                notes: []
            },
            maps: {
                mapsStore: [],
                activeMapId: null,
                friendPositionsStore: {}
            },
            desktop: {},
            bstage: {},
            x: {
                xData: {
                    name: 'User',
                    handle: '@user',
                    bio: '',
                    location: '',
                    following: '0',
                    followers: '0',
                    persona: '',
                    avatar: '',
                    banner: ''
                },
                xTopics: [],
                boundWorldBookIds: [],
                xVisitors: [],
                xDirectMessages: [],
                xPostThreads: {},
                xGeneratedPosts: [],
                xHomeBannerUrl: '',
                xSearchBannerUrl: ''
            },
            imessage: {
                uiState: {
                    cssPresets: []
                }
            }
        };
    }

    function clone(value) {
        if (value == null || typeof value !== 'object') return value;
        if (typeof structuredClone === 'function') {
            return structuredClone(value);
        }
        return JSON.parse(JSON.stringify(value));
    }

    function isPlainObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    }

    function normalizeYoutubeState(raw) {
        const safe = isPlainObject(raw) ? raw : {};
        const channelState = isPlainObject(safe.channelState) ? safe.channelState : {};

        return {
            ...clone(defaultYoutubeState),
            ...safe,
            channelState: {
                ...clone(defaultYoutubeState.channelState),
                ...channelState,
                boundWorldBookIds: Array.isArray(channelState.boundWorldBookIds) ? channelState.boundWorldBookIds.filter(Boolean) : [],
                liveSummaries: Array.isArray(channelState.liveSummaries) ? channelState.liveSummaries.filter(Boolean) : [],
                groupChatHistory: Array.isArray(channelState.groupChatHistory) ? channelState.groupChatHistory.filter(Boolean) : [],
                activeUserLive: isPlainObject(channelState.activeUserLive) ? channelState.activeUserLive : null,
                pastVideos: Array.isArray(channelState.pastVideos) ? channelState.pastVideos.filter(Boolean) : []
            },
            subscriptions: Array.isArray(safe.subscriptions) ? safe.subscriptions.filter(Boolean) : [],
            userState: isPlainObject(safe.userState) ? safe.userState : null
        };
    }

    function normalizeAppState(raw) {
        const defaults = createDefaultAppState();
        const safe = isPlainObject(raw) ? raw : {};

        return {
            ...defaults,
            ...safe,
            youtube: normalizeYoutubeState(safe.youtube),
            tiktok: {
                ...defaults.tiktok,
                ...(isPlainObject(safe.tiktok) ? safe.tiktok : {})
            },
            pay: {
                ...defaults.pay,
                ...(isPlainObject(safe.pay) ? safe.pay : {})
            },
            spotify: {
                ...defaults.spotify,
                ...(isPlainObject(safe.spotify) ? safe.spotify : {})
            },
            diary: {
                ...defaults.diary,
                ...(isPlainObject(safe.diary) ? safe.diary : {})
            },
            maps: {
                ...defaults.maps,
                ...(isPlainObject(safe.maps) ? safe.maps : {})
            },
            desktop: isPlainObject(safe.desktop) ? safe.desktop : defaults.desktop,
            bstage: isPlainObject(safe.bstage) ? safe.bstage : defaults.bstage,
            x: {
                ...defaults.x,
                ...(isPlainObject(safe.x) ? safe.x : {}),
                xData: {
                    ...defaults.x.xData,
                    ...(isPlainObject(safe.x?.xData) ? safe.x.xData : {})
                },
                xTopics: Array.isArray(safe.x?.xTopics) ? safe.x.xTopics : defaults.x.xTopics,
                boundWorldBookIds: Array.isArray(safe.x?.boundWorldBookIds) ? safe.x.boundWorldBookIds.map(String) : defaults.x.boundWorldBookIds,
                xVisitors: Array.isArray(safe.x?.xVisitors) ? safe.x.xVisitors : defaults.x.xVisitors,
                xDirectMessages: Array.isArray(safe.x?.xDirectMessages) ? safe.x.xDirectMessages : defaults.x.xDirectMessages,
                xPostThreads: isPlainObject(safe.x?.xPostThreads) ? safe.x.xPostThreads : defaults.x.xPostThreads,
                xGeneratedPosts: Array.isArray(safe.x?.xGeneratedPosts) ? safe.x.xGeneratedPosts : defaults.x.xGeneratedPosts,
                xHomeBannerUrl: typeof safe.x?.xHomeBannerUrl === 'string' ? safe.x.xHomeBannerUrl : defaults.x.xHomeBannerUrl,
                xSearchBannerUrl: typeof safe.x?.xSearchBannerUrl === 'string' ? safe.x.xSearchBannerUrl : defaults.x.xSearchBannerUrl
            },
            imessage: {
                ...defaults.imessage,
                ...(isPlainObject(safe.imessage) ? safe.imessage : {}),
                uiState: {
                    ...defaults.imessage.uiState,
                    ...(isPlainObject(safe.imessage?.uiState) ? safe.imessage.uiState : {})
                }
            }
        };
    }

    function loadLocalAppState() {
        try {
            if (window.StorageManager && typeof window.StorageManager.load === 'function') {
                return window.StorageManager.load(APP_STATE_KEY, null);
            }
            const raw = window.localStorage ? window.localStorage.getItem(APP_STATE_KEY) : null;
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('[app_state_bridge] Failed to load local app state:', error);
            return null;
        }
    }

    function saveLocalAppState() {
        try {
            if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                window.StorageManager.save(APP_STATE_KEY, appState);
                hasLocalAppState = true;
                return;
            }
            if (window.localStorage) {
                window.localStorage.setItem(APP_STATE_KEY, JSON.stringify(appState));
                hasLocalAppState = true;
            }
        } catch (error) {
            console.warn('[app_state_bridge] Failed to save local app state:', error);
        }
    }

    function buildGlobalDataForSave(base = {}) {
        return {
            ...(isPlainObject(base) ? base : {}),
            appState: normalizeAppState(appState)
        };
    }

    const initialLocalAppState = loadLocalAppState();
    let hasLocalAppState = !!initialLocalAppState;
    let runtimeDirty = false;
    let appState = normalizeAppState(initialLocalAppState);
    let globalDataCache = null;
    let saveTimer = null;

    function syncWindowState() {
        window.__u2AppState = appState;
        window.__iisonAppState = appState;
    }

    async function persistToAppStorage() {
        if (!window.appStorage || typeof window.appStorage.saveGlobalData !== 'function') {
            return false;
        }

        try {
            const base = globalDataCache || (
                typeof window.appStorage.loadGlobalData === 'function'
                    ? await window.appStorage.loadGlobalData()
                    : {}
            );
            const nextGlobalData = buildGlobalDataForSave(base);
            await window.appStorage.saveGlobalData(nextGlobalData);
            globalDataCache = nextGlobalData;
            return true;
        } catch (error) {
            console.warn('[app_state_bridge] Failed to persist app state:', error);
            return false;
        }
    }

    function scheduleSave() {
        saveLocalAppState();
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveTimer = null;
            persistToAppStorage();
        }, SAVE_DEBOUNCE_MS);
    }

    window.getAllAppState = function getAllAppState() {
        return appState;
    };

    window.getAppState = function getAppState(appKey) {
        if (!appKey) return null;
        return appState && Object.prototype.hasOwnProperty.call(appState, appKey)
            ? clone(appState[appKey])
            : null;
    };

    window.setAppState = function setAppState(appKey, nextState, options = {}) {
        if (!appKey) return null;
        appState[appKey] = isPlainObject(nextState) || Array.isArray(nextState) ? clone(nextState) : nextState;
        appState = normalizeAppState(appState);
        syncWindowState();
        runtimeDirty = true;
        if (options.save !== false) scheduleSave();
        return clone(appState[appKey]);
    };

    window.updateAppState = function updateAppState(appKey, updater, options = {}) {
        if (!appKey) return null;
        const previous = window.getAppState(appKey);
        const draft = isPlainObject(previous) || Array.isArray(previous) ? clone(previous) : previous;
        const nextState = typeof updater === 'function' ? updater(draft) ?? draft : updater;
        return window.setAppState(appKey, nextState, options);
    };

    window.resetUnifiedAppState = function resetUnifiedAppState(options = {}) {
        appState = normalizeAppState();
        syncWindowState();
        runtimeDirty = true;
        if (options.save !== false) scheduleSave();
        return clone(appState);
    };

    window.saveGlobalData = async function saveGlobalData() {
        saveLocalAppState();
        return persistToAppStorage();
    };

    window.loadGlobalData = async function loadGlobalData() {
        if (window.appStorage && typeof window.appStorage.loadGlobalData === 'function') {
            try {
                const loaded = await window.appStorage.loadGlobalData();
                globalDataCache = loaded && typeof loaded === 'object' ? loaded : {};

                if (!hasLocalAppState && !runtimeDirty && globalDataCache.appState) {
                    appState = normalizeAppState(globalDataCache.appState);
                    syncWindowState();
                    saveLocalAppState();
                }

                return buildGlobalDataForSave(globalDataCache);
            } catch (error) {
                console.warn('[app_state_bridge] Failed to load global data:', error);
            }
        }

        return buildGlobalDataForSave(globalDataCache || {});
    };

    syncWindowState();

    window.globalDataReadyPromise = window.loadGlobalData();
})();
