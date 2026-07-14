// ==========================================
// APP STORAGE LAYER
// Unified IndexedDB repository for the whole project
// Mobile-first, no legacy migration retention
// ==========================================

(function() {
    const DB_NAME = 'iiso_app_storage';
    const OPTIMIZATION_SHADOW_DB_NAME = 'iiso_app_storage_optimization_shadow_v8';
    const DB_VERSION = 7;
    const STORAGE_SCHEMA_VERSION = 8;
    const BACKUP_APP_NAME = 'u2phone';
    const AUTH_SESSION_ID = 'current';
    const LEGACY_AUTH_SESSION_KEY = 'u2_mockAuthSession';

    const STORES = {
        meta: 'meta',
        settings: 'settings',
        accounts: 'accounts',
        appState: 'app_state',
        theme: 'theme',
        worldbooks: 'worldbooks',
        assets: 'assets',
        authSessions: 'auth_sessions',
        imFriends: 'im_friends',
        imChatSummaries: 'im_chat_summaries',
        imMessages: 'im_messages',
        imMoments: 'im_moments',
        imMomentMessages: 'im_moment_messages',
        imStickers: 'im_stickers',
        libraryBooks: 'library_books',
        libraryBookContent: 'library_book_content',
        libraryPlaylists: 'library_playlists',
        libraryTracks: 'library_tracks',
        libraryDailyStats: 'library_daily_stats',
        appDomains: 'app_domains',
        xPosts: 'x_posts',
        xThreads: 'x_threads',
        xDms: 'x_dms',
        storageCheckpoints: 'storage_checkpoints'
    };
    const BACKUP_STORES = Object.values(STORES).filter((storeName) => storeName !== STORES.authSessions);

    const META_KEYS = {
        schemaVersion: 'schema_version',
        appVersion: 'app_version',
        imMomentsCoverAssetId: 'im_moments_cover_asset_id'
    };

    const runtimeBlobUrls = new Map();
    const runtimeBlobUrlAccess = new Map();
    const MAX_RUNTIME_BLOB_URLS = 120;
    let dbPromise = null;
    const domainCache = new Map();
    const domainWriteChains = new Map();
    const pendingWrites = new Set();
    const storageSubscribers = new Set();
    const storageHealthState = {
        status: 'initializing',
        pendingWrites: 0,
        lastCommitAt: 0,
        lastError: null,
        migrationVersion: 0,
        lastCompaction: null,
        lastCacheCleanup: null
    };
    let storageReadyPromise = null;

    function isTransientIndexedDbError(error) {
        const name = String(error?.name || '');
        const message = String(error?.message || error || '');
        return name === 'AbortError' ||
            name === 'InvalidStateError' ||
            name === 'TransactionInactiveError' ||
            /connection|closing|closed|transaction.*inactive|database.*not open/i.test(message);
    }

    async function resetDbConnection() {
        const pendingDb = dbPromise;
        dbPromise = null;
        if (!pendingDb) return;
        try {
            const db = await pendingDb;
            db?.close();
        } catch (error) {}
    }

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function withAuthStorageRetry(operation, options = {}) {
        const attempts = Math.max(1, Number(options.attempts) || 3);
        let lastError;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (!isTransientIndexedDbError(error) || attempt === attempts - 1) throw error;
                const name = String(error?.name || '');
                const message = String(error?.message || error || '');
                if (name === 'InvalidStateError' || /connection|closing|closed|database.*not open/i.test(message)) {
                    await resetDbConnection();
                }
                await delay(60 * (attempt + 1));
            }
        }
        throw lastError;
    }

    function cloneDeep(value) {
        if (typeof structuredClone === 'function') {
            return structuredClone(value);
        }
        return JSON.parse(JSON.stringify(value));
    }

    function isDomNode(value) {
        return !!(
            value &&
            typeof value === 'object' &&
            typeof Node !== 'undefined' &&
            value instanceof Node
        );
    }

    function sanitizePersistentValue(value, seen = new WeakSet()) {
        if (value == null) return value;
        if (typeof value === 'function' || typeof value === 'symbol') return undefined;
        if (typeof value === 'string' && isBlobUrl(value)) return null;
        if (typeof value !== 'object') return value;
        if (isDomNode(value)) return undefined;
        if (value instanceof Date) return value.toISOString();
        if (typeof Blob !== 'undefined' && value instanceof Blob) return value;
        if (typeof File !== 'undefined' && value instanceof File) return value;

        if (seen.has(value)) return undefined;
        seen.add(value);

        if (Array.isArray(value)) {
            return value
                .map((item) => sanitizePersistentValue(item, seen))
                .filter((item) => item !== undefined);
        }

        const result = {};
        Object.keys(value).forEach((key) => {
            if (key.charAt(0) === '_') return;
            const sanitized = sanitizePersistentValue(value[key], seen);
            if (sanitized !== undefined) result[key] = sanitized;
        });
        return result;
    }

    function clampProgress(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return 0;
        return Math.max(0, Math.min(100, Math.round(parsed)));
    }

    function reportProgress(callback, message, progress) {
        if (typeof callback === 'function') {
            callback({ message, progress: clampProgress(progress) });
        }
    }

    // Browser localStorage is intentionally never read at runtime. These helpers
    // only parse rows embedded in a user-selected legacy backup file.
    function getLegacyBackupValue(snapshot = [], key) {
        const row = Array.isArray(snapshot)
            ? snapshot.find((item) => item && item.key === key)
            : null;
        return row ? row.value : undefined;
    }

    function parseLegacyBackupJson(snapshot = [], key) {
        const rawValue = getLegacyBackupValue(snapshot, key);
        if (rawValue === undefined || rawValue === null || rawValue === '') return undefined;

        try {
            return JSON.parse(rawValue);
        } catch (error) {
            console.warn(`Failed to parse legacy backup key "${key}":`, error);
            return undefined;
        }
    }

    function parseLegacyRawValue(rawValue) {
        if (rawValue === undefined || rawValue === null) return undefined;
        try {
            return sanitizePersistentValue(JSON.parse(String(rawValue)));
        } catch (error) {
            return isBlobUrl(String(rawValue)) ? '' : String(rawValue);
        }
    }

    async function importLegacyBackupStorageRows(snapshot = []) {
        const rows = Array.isArray(snapshot) ? snapshot.filter((row) => row?.key) : [];
        if (rows.length === 0) return { migratedKeys: [], authMigrated: false };

        const settingsMap = {
            u2_userState: 'userState',
            u2_apiConfig: 'apiConfig',
            u2_minimaxConfig: 'minimaxConfig',
            u2_apiPresets: 'apiPresets',
            u2_fetchedModels: 'fetchedModels',
            u2_assistiveBallSettings: 'assistiveBallSettings',
            u2_accounts: 'accounts',
            u2_currentAccountId: 'currentAccountId',
            u2_themeState: 'themeState',
            u2_worldBooks: 'worldBooks',
            u2_wbGroups: 'wbGroups'
        };
        const authRow = rows.find((row) => row.key === LEGACY_AUTH_SESSION_KEY);
        const authValue = authRow ? parseLegacyRawValue(authRow.value) : undefined;
        const existingAuth = await getRecord(STORES.authSessions, AUTH_SESSION_ID);
        let authMigrated = false;

        await withStore([STORES.appDomains, STORES.authSessions, STORES.meta], 'readwrite', async (stores) => {
            const domainStore = stores[STORES.appDomains];
            const settingsRecord = await requestToPromise(domainStore.get('settings'));
            const legacyRecord = await requestToPromise(domainStore.get('legacy'));
            const settings = settingsRecord?.value && typeof settingsRecord.value === 'object'
                ? cloneDeep(settingsRecord.value)
                : {};
            const legacy = legacyRecord?.value && typeof legacyRecord.value === 'object'
                ? cloneDeep(legacyRecord.value)
                : {};
            let settingsChanged = false;
            let legacyChanged = false;

            for (const row of rows) {
                if (row.key === LEGACY_AUTH_SESSION_KEY || row.key === 'u2_appState') continue;
                const value = parseLegacyRawValue(row.value);
                const settingKey = settingsMap[row.key];
                if (settingKey) {
                    if (!Object.prototype.hasOwnProperty.call(settings, settingKey) && value !== undefined) {
                        settings[settingKey] = value;
                        settingsChanged = true;
                    }
                } else if (!Object.prototype.hasOwnProperty.call(legacy, row.key) && value !== undefined) {
                    legacy[row.key] = value;
                    legacyChanged = true;
                }
            }

            const oldAppState = parseLegacyBackupJson(rows, 'u2_appState');
            if (oldAppState && typeof oldAppState === 'object') {
                for (const [name, value] of Object.entries(oldAppState)) {
                    if (!name || !value || typeof value !== 'object') continue;
                    const existing = await requestToPromise(domainStore.get(name));
                    if (!existing) {
                        domainStore.put({
                            name,
                            schemaVersion: STORAGE_SCHEMA_VERSION,
                            revision: 1,
                            updatedAt: Date.now(),
                            value: sanitizePersistentValue(cloneDeep(value))
                        });
                    }
                }
            }

            const now = Date.now();
            if (settingsChanged || !settingsRecord) {
                domainStore.put({
                    name: 'settings',
                    schemaVersion: STORAGE_SCHEMA_VERSION,
                    revision: Math.max(0, Number(settingsRecord?.revision) || 0) + 1,
                    updatedAt: now,
                    value: sanitizePersistentValue(settings)
                });
            }
            if (legacyChanged || !legacyRecord) {
                domainStore.put({
                    name: 'legacy',
                    schemaVersion: STORAGE_SCHEMA_VERSION,
                    revision: Math.max(0, Number(legacyRecord?.revision) || 0) + 1,
                    updatedAt: now,
                    value: sanitizePersistentValue(legacy)
                });
            }
            if (!existingAuth && authValue && typeof authValue === 'object') {
                stores[STORES.authSessions].put({ id: AUTH_SESSION_ID, session: authValue, updatedAt: now });
                authMigrated = true;
            }
            stores[STORES.meta].put({ key: 'legacy_backup_imported_at', value: { importedAt: now, keys: rows.map((row) => row.key) } });
        });

        if (authMigrated) {
            const verified = await getRecord(STORES.authSessions, AUTH_SESSION_ID);
            if (!verified?.session) throw new Error('Auth session migration verification failed.');
        }

        return { importedKeys: rows.map((row) => row.key), authMigrated };
    }

    function estimateJsonBytes(value) {
        try {
            return new Blob([JSON.stringify(value)]).size;
        } catch (error) {
            try {
                return JSON.stringify(value).length;
            } catch (e) {
                return 0;
            }
        }
    }

    function createChecksum(value) {
        let text = '';
        try {
            text = JSON.stringify(value);
        } catch (error) {
            text = String(value || '');
        }

        let hash = 2166136261;
        for (let i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }

        return (hash >>> 0).toString(16).padStart(8, '0');
    }

    function touchRuntimeBlobUrl(assetId) {
        if (!assetId) return;
        runtimeBlobUrlAccess.set(assetId, Date.now());
    }

    function revokeRuntimeBlobUrl(assetId) {
        const existing = runtimeBlobUrls.get(assetId);
        if (existing) {
            try {
                URL.revokeObjectURL(existing);
            } catch (e) {}
            runtimeBlobUrls.delete(assetId);
        }
        runtimeBlobUrlAccess.delete(assetId);
    }

    function clearRuntimeAssetCache() {
        try {
            Array.from(runtimeBlobUrls.keys()).forEach((assetId) => revokeRuntimeBlobUrl(assetId));
        } catch (e) {}
        runtimeBlobUrls.clear();
        runtimeBlobUrlAccess.clear();
        return true;
    }

    async function measureRuntimeCacheUsage() {
        const assetIds = Array.from(runtimeBlobUrls.keys());
        if (assetIds.length === 0) return 0;

        let total = 0;
        for (const assetId of assetIds) {
            const blob = await getAssetBlob(assetId);
            total += Number(blob?.size) || 0;
        }
        return total;
    }

    function pruneRuntimeAssetCache(maxEntries = MAX_RUNTIME_BLOB_URLS) {
        const limit = Math.max(0, Number(maxEntries) || 0);
        if (limit === 0) {
            clearRuntimeAssetCache();
            return 0;
        }

        if (runtimeBlobUrls.size <= limit) {
            return runtimeBlobUrls.size;
        }

        const removableIds = Array.from(runtimeBlobUrls.keys())
            .sort((a, b) => (runtimeBlobUrlAccess.get(a) || 0) - (runtimeBlobUrlAccess.get(b) || 0))
            .slice(0, Math.max(0, runtimeBlobUrls.size - limit));

        removableIds.forEach((assetId) => revokeRuntimeBlobUrl(assetId));
        return runtimeBlobUrls.size;
    }

    function isDataUrl(value) {
        return typeof value === 'string' && value.startsWith('data:');
    }

    function isBlobUrl(value) {
        return typeof value === 'string' && value.startsWith('blob:');
    }

    function hasStoreIndex(store, indexName) {
        if (!store || !store.indexNames) return false;
        if (typeof store.indexNames.contains === 'function') {
            return store.indexNames.contains(indexName);
        }
        return Array.from(store.indexNames).includes(indexName);
    }

    function dataUrlToBlob(dataUrl) {
        const parts = String(dataUrl || '').split(',');
        const header = parts[0] || '';
        const data = parts[1] || '';
        const mimeMatch = header.match(/data:(.*?);base64/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const binary = atob(data);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new Blob([bytes], { type: mimeType });
    }

    async function hashBlobSha256(blob) {
        if (!blob || !globalThis.crypto?.subtle) return '';
        const buffer = await blob.arrayBuffer();
        const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    async function saveContentAddressedAsset(dataUrl, extra = {}) {
        if (!isDataUrl(dataUrl)) return null;
        await assertLargeAssetCapacity(dataUrl);
        const blob = dataUrlToBlob(dataUrl);
        const digest = await hashBlobSha256(blob);
        const fallbackId = String(extra.fallbackId || `asset_${Date.now()}_${Math.random().toString(36).slice(2)}`);
        const assetId = digest ? `sha256_${digest}` : fallbackId;
        await withStore([STORES.assets], 'readwrite', async (stores) => {
            const existing = await requestToPromise(stores[STORES.assets].get(assetId));
            if (existing?.blob && Number(existing.blob.size) === Number(blob.size)) return;
            stores[STORES.assets].put({
                id: assetId,
                blob,
                sha256: digest || null,
                mimeType: blob.type || extra.mimeType || 'application/octet-stream',
                createdAt: Number(existing?.createdAt) || Date.now(),
                updatedAt: Date.now(),
                ...extra,
                fallbackId: undefined
            });
        });
        return assetId;
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    function requestToPromise(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function deleteDatabaseSafe(name) {
        return new Promise((resolve) => {
            if (!window.indexedDB || !name) {
                resolve({ name, deleted: false, reason: 'indexeddb_unavailable' });
                return;
            }

            let settled = false;
            const request = window.indexedDB.deleteDatabase(name);

            request.onsuccess = () => {
                if (settled) return;
                settled = true;
                resolve({ name, deleted: true, reason: 'deleted' });
            };

            request.onerror = () => {
                if (settled) return;
                settled = true;
                resolve({
                    name,
                    deleted: false,
                    reason: request.error?.message || request.error?.name || 'delete_error'
                });
            };

            request.onblocked = () => {
                if (settled) return;
                settled = true;
                resolve({ name, deleted: false, reason: 'blocked' });
            };
        });
    }

    async function clearBrowserCaches() {
        if (!window.caches || typeof window.caches.keys !== 'function') {
            return [];
        }

        try {
            const cacheNames = await window.caches.keys();
            const results = [];

            for (const cacheName of cacheNames) {
                const deleted = await window.caches.delete(cacheName);
                results.push({ name: cacheName, deleted: !!deleted });
            }

            return results;
        } catch (error) {
            return [{ name: '*', deleted: false, reason: error?.message || 'cache_clear_failed' }];
        }
    }

    async function unregisterServiceWorkers() {
        if (!navigator.serviceWorker || typeof navigator.serviceWorker.getRegistrations !== 'function') {
            return [];
        }

        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            const results = [];

            for (const registration of registrations) {
                const scope = registration?.scope || 'unknown';
                const unregistered = await registration.unregister();
                results.push({ scope, unregistered: !!unregistered });
            }

            return results;
        } catch (error) {
            return [{ scope: '*', unregistered: false, reason: error?.message || 'sw_unregister_failed' }];
        }
    }

    function createDbConnection(databaseName = DB_NAME) {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB is not supported in this browser.'));
                return;
            }

            const request = window.indexedDB.open(databaseName, DB_VERSION);

            request.onerror = () => {
                dbPromise = null;
                reject(request.error);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(STORES.meta)) {
                    db.createObjectStore(STORES.meta, { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains(STORES.settings)) {
                    db.createObjectStore(STORES.settings, { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains(STORES.accounts)) {
                    db.createObjectStore(STORES.accounts, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(STORES.appState)) {
                    db.createObjectStore(STORES.appState, { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains(STORES.theme)) {
                    db.createObjectStore(STORES.theme, { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains(STORES.worldbooks)) {
                    db.createObjectStore(STORES.worldbooks, { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains(STORES.assets)) {
                    db.createObjectStore(STORES.assets, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(STORES.authSessions)) {
                    db.createObjectStore(STORES.authSessions, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(STORES.imFriends)) {
                    db.createObjectStore(STORES.imFriends, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(STORES.imChatSummaries)) {
                    db.createObjectStore(STORES.imChatSummaries, { keyPath: 'friendId' });
                }

                if (!db.objectStoreNames.contains(STORES.imMessages)) {
                    const messageStore = db.createObjectStore(STORES.imMessages, { keyPath: 'id' });
                    messageStore.createIndex('friendId', 'friendId', { unique: false });
                    messageStore.createIndex('friendId_timestamp', ['friendId', 'timestamp'], { unique: false });
                    messageStore.createIndex('friendId_order', ['friendId', 'order'], { unique: false });
                } else {
                    const upgradeTransaction = event.target.transaction;
                    if (upgradeTransaction) {
                        const messageStore = upgradeTransaction.objectStore(STORES.imMessages);
                        if (!hasStoreIndex(messageStore, 'friendId')) {
                            messageStore.createIndex('friendId', 'friendId', { unique: false });
                        }
                        if (!hasStoreIndex(messageStore, 'friendId_timestamp')) {
                            messageStore.createIndex('friendId_timestamp', ['friendId', 'timestamp'], { unique: false });
                        }
                        if (!hasStoreIndex(messageStore, 'friendId_order')) {
                            messageStore.createIndex('friendId_order', ['friendId', 'order'], { unique: false });
                        }
                    }
                }

                if (!db.objectStoreNames.contains(STORES.imMoments)) {
                    const momentsStore = db.createObjectStore(STORES.imMoments, { keyPath: 'id' });
                    momentsStore.createIndex('userId', 'userId', { unique: false });
                    momentsStore.createIndex('time', 'time', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.imMomentMessages)) {
                    const momentMsgStore = db.createObjectStore(STORES.imMomentMessages, { keyPath: 'id' });
                    momentMsgStore.createIndex('time', 'time', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.imStickers)) {
                    db.createObjectStore(STORES.imStickers, { keyPath: 'categoryName' });
                }

                if (!db.objectStoreNames.contains(STORES.libraryBooks)) {
                    const booksStore = db.createObjectStore(STORES.libraryBooks, { keyPath: 'id' });
                    booksStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.libraryBookContent)) {
                    db.createObjectStore(STORES.libraryBookContent, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(STORES.libraryPlaylists)) {
                    const playlistsStore = db.createObjectStore(STORES.libraryPlaylists, { keyPath: 'id' });
                    playlistsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.libraryTracks)) {
                    const tracksStore = db.createObjectStore(STORES.libraryTracks, { keyPath: 'id' });
                    tracksStore.createIndex('playlistId', 'playlistId', { unique: false });
                    tracksStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.libraryDailyStats)) {
                    const statsStore = db.createObjectStore(STORES.libraryDailyStats, { keyPath: 'id' });
                    statsStore.createIndex('date', 'date', { unique: false });
                    statsStore.createIndex('kind', 'kind', { unique: false });
                    statsStore.createIndex('date_kind', ['date', 'kind'], { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.appDomains)) {
                    const domainStore = db.createObjectStore(STORES.appDomains, { keyPath: 'name' });
                    domainStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.xPosts)) {
                    const postStore = db.createObjectStore(STORES.xPosts, { keyPath: 'id' });
                    postStore.createIndex('createdAt', 'createdAt', { unique: false });
                    postStore.createIndex('authorId', 'authorId', { unique: false });
                    postStore.createIndex('topicTag', 'topicTag', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.xThreads)) {
                    db.createObjectStore(STORES.xThreads, { keyPath: 'postId' });
                }

                if (!db.objectStoreNames.contains(STORES.xDms)) {
                    const dmStore = db.createObjectStore(STORES.xDms, { keyPath: 'id' });
                    dmStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.storageCheckpoints)) {
                    db.createObjectStore(STORES.storageCheckpoints, { keyPath: 'id' });
                }
            };

            request.onsuccess = () => {
                const db = request.result;

                db.onversionchange = () => {
                    try {
                        db.close();
                    } catch (e) {}
                    dbPromise = null;
                };

                resolve(db);
            };
        });
    }

    function openDb() {
        if (!dbPromise) {
            dbPromise = createDbConnection().catch((error) => {
                dbPromise = null;
                throw error;
            });
        }
        return dbPromise;
    }

    async function withStore(storeNames, mode, callback) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeNames, mode);
            const stores = {};
            storeNames.forEach((name) => {
                stores[name] = transaction.objectStore(name);
            });

            let callbackResult;
            try {
                callbackResult = callback(stores, transaction);
            } catch (error) {
                reject(error);
                return;
            }

            transaction.oncomplete = async () => {
                try {
                    const resolved = await Promise.resolve(callbackResult);
                    resolve(resolved);
                } catch (error) {
                    reject(error);
                }
            };

            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
        });
    }

    async function getRecord(storeName, key) {
        return withStore([storeName], 'readonly', async (stores) => {
            const row = await requestToPromise(stores[storeName].get(key));
            return row || null;
        });
    }

    async function putRecord(storeName, record) {
        return withStore([storeName], 'readwrite', (stores) => {
            stores[storeName].put(record);
        });
    }

    async function deleteRecord(storeName, key) {
        return withStore([storeName], 'readwrite', (stores) => {
            stores[storeName].delete(key);
        });
    }

    async function getAllRecords(storeName) {
        return withStore([storeName], 'readonly', async (stores) => {
            const rows = await requestToPromise(stores[storeName].getAll());
            return Array.isArray(rows) ? rows : [];
        });
    }

    async function openExistingShadowDatabase() {
        if (!window.indexedDB) return null;
        if (typeof window.indexedDB.databases === 'function') {
            try {
                const databases = await window.indexedDB.databases();
                if (!databases.some((item) => item?.name === OPTIMIZATION_SHADOW_DB_NAME)) return null;
            } catch (error) {}
        }
        const db = await createDbConnection(OPTIMIZATION_SHADOW_DB_NAME);
        const marker = await new Promise((resolve, reject) => {
            const request = db.transaction(STORES.meta, 'readonly').objectStore(STORES.meta).get('optimization_shadow_ready');
            request.onsuccess = () => resolve(request.result?.value || null);
            request.onerror = () => reject(request.error);
        });
        if (!marker) {
            db.close();
            await deleteDatabaseSafe(OPTIMIZATION_SHADOW_DB_NAME);
            return null;
        }
        return { db, marker };
    }

    async function getAllFromConnection(db, storeName) {
        return new Promise((resolve, reject) => {
            const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
            request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
            request.onerror = () => reject(request.error);
        });
    }

    async function buildStoreSignature(storeName, rows) {
        let checksumRows = rows;
        if (storeName === STORES.assets) {
            checksumRows = [];
            for (const row of rows) {
                const blob = row?.blob;
                checksumRows.push({
                    ...row,
                    blob: blob ? {
                        size: Number(blob.size) || 0,
                        type: blob.type || '',
                        sha256: row.sha256 || await hashBlobSha256(blob)
                    } : null
                });
            }
        }
        return {
            count: rows.length,
            bytes: rows.reduce((sum, row) => sum + measureRecordBytes(row), 0),
            checksum: createChecksum(checksumRows)
        };
    }

    async function replaceConnectionStore(db, storeName, rows) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            store.clear();
            rows.forEach((row) => store.put(row));
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error || new Error(`Copy aborted for ${storeName}`));
        });
    }

    async function copyDatabaseContents(sourceDb, targetDb, progressCallback, progressStart = 0, progressSpan = 100) {
        const signatures = {};
        const storeNames = Object.values(STORES);
        for (let index = 0; index < storeNames.length; index += 1) {
            const storeName = storeNames[index];
            const rows = await getAllFromConnection(sourceDb, storeName);
            const filteredRows = storeName === STORES.meta
                ? rows.filter((row) => row?.key !== 'optimization_shadow_ready' && row?.key !== 'optimization_restore_complete')
                : rows;
            const expected = await buildStoreSignature(storeName, filteredRows);
            await replaceConnectionStore(targetDb, storeName, filteredRows);
            const copiedRows = await getAllFromConnection(targetDb, storeName);
            const actual = await buildStoreSignature(storeName, copiedRows);
            if (expected.count !== actual.count || expected.bytes !== actual.bytes || expected.checksum !== actual.checksum) {
                throw new Error(`Storage verification failed for ${storeName}.`);
            }
            signatures[storeName] = actual;
            reportProgress(
                progressCallback,
                `校验 ${storeName} (${actual.count})...`,
                progressStart + ((index + 1) / storeNames.length) * progressSpan
            );
        }
        return signatures;
    }

    async function setConnectionMeta(db, key, value) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.meta, 'readwrite');
            transaction.objectStore(STORES.meta).put({ key, value });
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error || new Error(`Meta write aborted for ${key}`));
        });
    }

    function notifyStorageSubscribers(detail) {
        storageSubscribers.forEach((listener) => {
            try {
                listener(cloneDeep(detail));
            } catch (error) {
                console.warn('[appStorage] storage subscriber failed', error);
            }
        });
        try {
            window.dispatchEvent(new CustomEvent('u2-storage-status', { detail: cloneDeep(detail) }));
        } catch (error) {}
    }

    function trackPendingWrite(promise) {
        pendingWrites.add(promise);
        storageHealthState.pendingWrites = pendingWrites.size;
        storageHealthState.status = 'saving';
        notifyStorageSubscribers({ ...storageHealthState });
        promise.finally(() => {
            pendingWrites.delete(promise);
            storageHealthState.pendingWrites = pendingWrites.size;
            if (pendingWrites.size === 0 && storageHealthState.status !== 'error') {
                storageHealthState.status = 'saved';
            }
            notifyStorageSubscribers({ ...storageHealthState });
        });
        return promise;
    }

    function readDomain(name, fallbackValue = null) {
        if (!name || !domainCache.has(String(name))) return cloneDeep(fallbackValue);
        return cloneDeep(domainCache.get(String(name)));
    }

    function stripXCollections(value = {}) {
        const safe = value && typeof value === 'object' ? cloneDeep(value) : {};
        delete safe.xGeneratedPosts;
        delete safe.xPostThreads;
        delete safe.xDirectMessages;
        return safe;
    }

    function putAssetInTransaction(assetStore, assetId, dataUrl, extra = {}) {
        const blob = dataUrlToBlob(dataUrl);
        assetStore.put({
            id: assetId,
            blob,
            mimeType: blob.type || 'application/octet-stream',
            updatedAt: Date.now(),
            ...extra
        });
    }

    function persistXAssetsInTransaction(value, assetStore) {
        const next = cloneDeep(value && typeof value === 'object' ? value : {});
        const persistField = (owner, urlField, assetField, assetId, extra) => {
            if (!owner || !isDataUrl(owner[urlField])) return;
            putAssetInTransaction(assetStore, assetId, owner[urlField], extra);
            owner[assetField] = assetId;
            owner[urlField] = null;
        };

        persistField(next.xData, 'avatar', 'avatarAssetId', 'x_profile_avatar', { ownerType: 'x_profile', field: 'avatar' });
        persistField(next.xData, 'banner', 'bannerAssetId', 'x_profile_banner', { ownerType: 'x_profile', field: 'banner' });
        persistField(next, 'xHomeBannerUrl', 'xHomeBannerAssetId', 'x_home_banner', { ownerType: 'x_app', field: 'homeBanner' });
        persistField(next, 'xSearchBannerUrl', 'xSearchBannerAssetId', 'x_search_banner', { ownerType: 'x_app', field: 'searchBanner' });

        (Array.isArray(next.xTopics) ? next.xTopics : []).forEach((topic, topicIndex) => {
            const topicId = String(topic?.id ?? topic?.name ?? topicIndex);
            persistField(topic, 'avatar', 'avatarAssetId', `x_topic_${topicId}_avatar`, { ownerType: 'x_topic', ownerId: topicId, field: 'avatar' });
            persistField(topic, 'banner', 'bannerAssetId', `x_topic_${topicId}_banner`, { ownerType: 'x_topic', ownerId: topicId, field: 'banner' });
        });

        (Array.isArray(next.xGeneratedPosts) ? next.xGeneratedPosts : []).forEach((post, postIndex) => {
            const postId = String(post?.id ?? postIndex);
            persistField(post, 'authorAvatar', 'authorAvatarAssetId', `x_post_${postId}_author`, { ownerType: 'x_post', ownerId: postId, field: 'authorAvatar' });
            (Array.isArray(post?.images) ? post.images : []).forEach((image, imageIndex) => {
                if (!image || typeof image !== 'object' || !isDataUrl(image.url)) return;
                const assetId = String(image.assetId || `x_post_${postId}_image_${imageIndex}`);
                putAssetInTransaction(assetStore, assetId, image.url, { ownerType: 'x_post', ownerId: postId, field: 'images', index: imageIndex });
                image.assetId = assetId;
                image.url = null;
            });
        });
        return next;
    }

    async function hydrateXAssets(value) {
        const next = cloneDeep(value && typeof value === 'object' ? value : {});
        const hydrateField = async (owner, urlField, assetField) => {
            if (owner?.[assetField] && !owner[urlField]) owner[urlField] = await getAssetUrl(owner[assetField]);
        };
        await hydrateField(next.xData, 'avatar', 'avatarAssetId');
        await hydrateField(next.xData, 'banner', 'bannerAssetId');
        await hydrateField(next, 'xHomeBannerUrl', 'xHomeBannerAssetId');
        await hydrateField(next, 'xSearchBannerUrl', 'xSearchBannerAssetId');
        for (const topic of (Array.isArray(next.xTopics) ? next.xTopics : [])) {
            await hydrateField(topic, 'avatar', 'avatarAssetId');
            await hydrateField(topic, 'banner', 'bannerAssetId');
        }
        for (const post of (Array.isArray(next.xGeneratedPosts) ? next.xGeneratedPosts : [])) {
            await hydrateField(post, 'authorAvatar', 'authorAvatarAssetId');
            for (const image of (Array.isArray(post?.images) ? post.images : [])) {
                if (image?.assetId && !image.url) image.url = await getAssetUrl(image.assetId);
            }
        }
        return next;
    }

    async function replaceCollectionRecords(store, rows, keyField) {
        const safeRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
        const keepKeys = new Set(safeRows.map((row) => String(row[keyField])).filter(Boolean));
        const existingKeys = await requestToPromise(store.getAllKeys());
        (Array.isArray(existingKeys) ? existingKeys : []).forEach((key) => {
            if (!keepKeys.has(String(key))) store.delete(key);
        });
        safeRows.forEach((row) => store.put(sanitizePersistentValue(cloneDeep(row))));
    }

    async function hydrateXDomain(value = {}) {
        const [posts, threads, dms] = await Promise.all([
            getAllRecords(STORES.xPosts),
            getAllRecords(STORES.xThreads),
            getAllRecords(STORES.xDms)
        ]);
        return hydrateXAssets({
            ...(value && typeof value === 'object' ? value : {}),
            xGeneratedPosts: posts.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)),
            xPostThreads: Object.fromEntries(threads.map((row) => [String(row.postId), row.value])),
            xDirectMessages: dms
        });
    }

    async function runWithQuotaRetry(task) {
        try {
            return await task();
        } catch (error) {
            const isQuotaError = error?.name === 'QuotaExceededError'
                || /quota|storage.*full/i.test(String(error?.message || ''));
            if (!isQuotaError) throw error;
            await pruneOrphanedAssets();
            return task();
        }
    }

    async function commitDomain(name, reducer, options = {}) {
        const domainName = String(name || '').trim();
        if (!domainName) throw new Error('Domain name is required.');
        if (storageReadyPromise) await storageReadyPromise;

        const previousChain = domainWriteChains.get(domainName) || Promise.resolve();
        const writePromise = previousChain.catch(() => undefined).then(async () => {
            const storeNames = [STORES.appDomains];
            if (domainName === 'x') {
                storeNames.push(STORES.xPosts, STORES.xThreads, STORES.xDms, STORES.assets);
            }

            const currentCached = readDomain(domainName, {});
            const nextDraft = cloneDeep(currentCached && typeof currentCached === 'object' ? currentCached : {});
            const reduced = typeof reducer === 'function' ? reducer(nextDraft) : reducer;
            const runtimeNextValue = cloneDeep(reduced === undefined ? nextDraft : reduced);
            const nextValue = domainName === 'x'
                ? runtimeNextValue
                : sanitizePersistentValue(cloneDeep(runtimeNextValue));
            const now = Date.now();

            let commitResult = null;
            await runWithQuotaRetry(() => withStore(storeNames, 'readwrite', async (stores) => {
                const currentRecord = await requestToPromise(stores[STORES.appDomains].get(domainName));
                const revision = Math.max(0, Number(currentRecord?.revision) || 0) + 1;
                const persistedValue = domainName === 'x'
                    ? sanitizePersistentValue(persistXAssetsInTransaction(nextValue, stores[STORES.assets]))
                    : nextValue;
                const storedValue = domainName === 'x' ? stripXCollections(persistedValue) : persistedValue;
                const record = {
                    name: domainName,
                    schemaVersion: STORAGE_SCHEMA_VERSION,
                    revision,
                    updatedAt: now,
                    value: storedValue
                };

                if (domainName === 'x') {
                    await replaceCollectionRecords(
                        stores[STORES.xPosts],
                        Array.isArray(persistedValue.xGeneratedPosts) ? persistedValue.xGeneratedPosts : [],
                        'id'
                    );
                    const threadRows = Object.entries(persistedValue.xPostThreads || {}).map(([postId, value]) => ({ postId, value }));
                    await replaceCollectionRecords(stores[STORES.xThreads], threadRows, 'postId');
                    const dmRows = (Array.isArray(persistedValue.xDirectMessages) ? persistedValue.xDirectMessages : []).map((item, index) => ({
                        ...item,
                        id: String(item?.id ?? item?.charId ?? `x-dm-${index}`),
                        updatedAt: Number(item?.updatedAt) || now
                    }));
                    await replaceCollectionRecords(stores[STORES.xDms], dmRows, 'id');
                }

                stores[STORES.appDomains].put(record);
                commitResult = { revision, updatedAt: now, durable: true, domain: domainName };
            }));

            domainCache.set(domainName, cloneDeep(nextValue));
            storageHealthState.status = 'saved';
            storageHealthState.lastCommitAt = now;
            storageHealthState.lastError = null;
            notifyStorageSubscribers({ ...storageHealthState, commit: commitResult, reason: options.reason || '' });
            return commitResult;
        }).catch((error) => {
            storageHealthState.status = 'error';
            storageHealthState.lastError = error?.message || String(error);
            notifyStorageSubscribers({ ...storageHealthState, domain: domainName });
            throw error;
        });

        domainWriteChains.set(domainName, writePromise);
        trackPendingWrite(writePromise);
        try {
            return await writePromise;
        } finally {
            if (domainWriteChains.get(domainName) === writePromise) domainWriteChains.delete(domainName);
        }
    }

    async function commitRecords(operations = [], options = {}) {
        if (storageReadyPromise) await storageReadyPromise;
        const safeOperations = (Array.isArray(operations) ? operations : []).filter((operation) => {
            return operation && Object.values(STORES).includes(operation.store);
        });
        if (safeOperations.length === 0) return { durable: true, updatedAt: Date.now(), count: 0 };
        const storeNames = Array.from(new Set(safeOperations.map((operation) => operation.store)));
        const promise = runWithQuotaRetry(() => withStore(storeNames, 'readwrite', (stores) => {
            safeOperations.forEach((operation) => {
                const store = stores[operation.store];
                if (operation.type === 'delete') store.delete(operation.key);
                else store.put(sanitizePersistentValue(cloneDeep(operation.value)));
            });
        })).then(() => {
            const result = { durable: true, updatedAt: Date.now(), count: safeOperations.length, reason: options.reason || '' };
            storageHealthState.lastCommitAt = result.updatedAt;
            storageHealthState.lastError = null;
            return result;
        });
        return trackPendingWrite(promise);
    }

    async function flushPendingWrites() {
        const writes = Array.from(pendingWrites);
        if (writes.length === 0) return true;
        const results = await Promise.allSettled(writes);
        return results.every((result) => result.status === 'fulfilled');
    }

    function subscribe(listener) {
        if (typeof listener !== 'function') return () => {};
        storageSubscribers.add(listener);
        return () => storageSubscribers.delete(listener);
    }

    function sanitizeLibraryRecord(record) {
        return sanitizePersistentValue(cloneDeep(record || {}));
    }

    function splitLibraryBookRecord(book) {
        const record = sanitizeLibraryRecord(book);
        const text = typeof record.text === 'string' ? record.text : null;
        const chapterIndex = Array.isArray(record.chapterIndex) ? record.chapterIndex : null;
        const chunks = Array.isArray(record.chunks) ? record.chunks : null;
        delete record.text;
        delete record.chapterIndex;
        delete record.chunks;
        return { record, text, chapterIndex, chunks };
    }

    async function loadLibraryBooks() {
        return withStore([STORES.libraryBooks, STORES.libraryBookContent], 'readwrite', async (stores) => {
            const rows = await requestToPromise(stores[STORES.libraryBooks].getAll());
            const books = [];
            rows.forEach((row) => {
                const { record, text, chapterIndex, chunks } = splitLibraryBookRecord(row);
                if (!record.id) return;
                if (text !== null || chapterIndex || chunks) {
                    stores[STORES.libraryBookContent].put({
                        id: record.id,
                        text: text || '',
                        chapterIndex: chapterIndex || [],
                        chunks: chunks || [],
                        updatedAt: Number(record.updatedAt) || Date.now()
                    });
                    stores[STORES.libraryBooks].put(record);
                }
                books.push(record);
            });
            return cloneDeep(books);
        });
    }

    async function saveLibraryBook(book) {
        const { record, text, chapterIndex, chunks } = splitLibraryBookRecord(book);
        if (!record.id) throw new Error('Library book id is required.');
        if (text !== null || chapterIndex || chunks) {
            await withStore([STORES.libraryBooks, STORES.libraryBookContent], 'readwrite', (stores) => {
                stores[STORES.libraryBooks].put(record);
                stores[STORES.libraryBookContent].put({
                    id: record.id,
                    text: text || '',
                    chapterIndex: chapterIndex || [],
                    chunks: chunks || [],
                    updatedAt: Number(record.updatedAt) || Date.now()
                });
            });
        } else {
            await putRecord(STORES.libraryBooks, record);
        }
        return cloneDeep(record);
    }

    async function loadLibraryBookContent(bookId) {
        const record = await getRecord(STORES.libraryBookContent, String(bookId || ''));
        return record ? cloneDeep(record) : null;
    }

    async function deleteLibraryBook(bookId) {
        const safeBookId = String(bookId || '');
        return withStore([STORES.libraryBooks, STORES.libraryBookContent], 'readwrite', (stores) => {
            stores[STORES.libraryBooks].delete(safeBookId);
            stores[STORES.libraryBookContent].delete(safeBookId);
        });
    }

    async function loadLibraryPlaylists() {
        return cloneDeep(await getAllRecords(STORES.libraryPlaylists));
    }

    async function loadLibraryTracks() {
        return cloneDeep(await getAllRecords(STORES.libraryTracks));
    }

    async function saveLibraryPlaylistBundle(playlist, tracks = [], options = {}) {
        const playlistRecord = sanitizeLibraryRecord(playlist);
        if (!playlistRecord.id) throw new Error('Library playlist id is required.');
        const trackRecords = (Array.isArray(tracks) ? tracks : [])
            .map(sanitizeLibraryRecord)
            .filter((track) => track.id);

        await withStore([STORES.libraryPlaylists, STORES.libraryTracks], 'readwrite', (stores) => {
            const playlistStore = stores[STORES.libraryPlaylists];
            const trackStore = stores[STORES.libraryTracks];
            const writeBundle = () => {
                playlistStore.put(playlistRecord);
                trackRecords.forEach((track) => trackStore.put(track));
            };

            if (options.replaceTracks) {
                const keepIds = new Set(trackRecords.map((track) => track.id));
                const existingKeysRequest = trackStore.index('playlistId').getAllKeys(playlistRecord.id);
                existingKeysRequest.onsuccess = () => {
                    (Array.isArray(existingKeysRequest.result) ? existingKeysRequest.result : []).forEach((trackId) => {
                        if (!keepIds.has(trackId)) trackStore.delete(trackId);
                    });
                    writeBundle();
                };
                return;
            }

            writeBundle();
        });

        return {
            playlist: cloneDeep(playlistRecord),
            tracks: cloneDeep(trackRecords)
        };
    }

    async function saveLibraryTrack(track) {
        const record = sanitizeLibraryRecord(track);
        if (!record.id) throw new Error('Library track id is required.');
        await putRecord(STORES.libraryTracks, record);
        return cloneDeep(record);
    }

    async function deleteLibraryTrack(trackId) {
        return deleteRecord(STORES.libraryTracks, String(trackId || ''));
    }

    async function deleteLibraryPlaylist(playlistId) {
        const safePlaylistId = String(playlistId || '');
        if (!safePlaylistId) return;

        return withStore([STORES.libraryPlaylists, STORES.libraryTracks], 'readwrite', async (stores) => {
            const trackRows = await requestToPromise(stores[STORES.libraryTracks].getAll());
            (Array.isArray(trackRows) ? trackRows : []).forEach((track) => {
                if (track && track.playlistId === safePlaylistId) {
                    stores[STORES.libraryTracks].delete(track.id);
                }
            });
            stores[STORES.libraryPlaylists].delete(safePlaylistId);
        });
    }

    async function loadLibraryDailyStats() {
        return cloneDeep(await getAllRecords(STORES.libraryDailyStats));
    }

    async function incrementLibraryDailyStat({ date, kind, itemId, seconds = 0, count = 0 }) {
        const safeDate = String(date || '');
        const safeKind = String(kind || '');
        const safeItemId = String(itemId || 'all');
        const rawSeconds = Number(seconds);
        const rawCount = Number(count);
        const safeSeconds = Number.isFinite(rawSeconds) ? Math.max(0, rawSeconds) : 0;
        const safeCount = Number.isFinite(rawCount) ? Math.max(0, Math.floor(rawCount)) : 0;
        if (!safeDate || !safeKind || (safeSeconds <= 0 && safeCount <= 0)) return null;

        const id = `${safeDate}|${safeKind}|${safeItemId}`;
        return withStore([STORES.libraryDailyStats], 'readwrite', async (stores) => {
            const store = stores[STORES.libraryDailyStats];
            const existing = await requestToPromise(store.get(id));
            const record = {
                id,
                date: safeDate,
                kind: safeKind,
                itemId: safeItemId,
                seconds: Math.max(0, Number(existing?.seconds) || 0) + safeSeconds,
                count: Math.max(0, Number(existing?.count) || 0) + safeCount,
                updatedAt: Date.now()
            };
            store.put(record);
            return cloneDeep(record);
        });
    }

    async function getMeta(key) {
        const record = await getRecord(STORES.meta, key);
        return record ? record.value : null;
    }

    async function setMeta(key, value) {
        return putRecord(STORES.meta, { key, value });
    }

    async function getSetting(key, fallbackValue = null) {
        const record = await getRecord(STORES.settings, key);
        return record ? cloneDeep(record.value) : fallbackValue;
    }

    async function setSetting(key, value) {
        return putRecord(STORES.settings, { key, value: sanitizePersistentValue(cloneDeep(value)) });
    }

    async function waitForAuthStorage() {
        return withAuthStorageRetry(async () => {
            const db = await openDb();
            if (!db.objectStoreNames.contains(STORES.authSessions)) {
                throw new DOMException('Authentication storage is unavailable.', 'InvalidStateError');
            }
            return true;
        });
    }

    async function getAuthSession() {
        await waitForAuthStorage();
        const record = await withAuthStorageRetry(() => getRecord(STORES.authSessions, AUTH_SESSION_ID));
        return record?.session && typeof record.session === 'object'
            ? cloneDeep(record.session)
            : null;
    }

    async function setAuthSession(session) {
        if (!session || typeof session !== 'object') {
            await clearAuthSession();
            return null;
        }
        const safeSession = sanitizePersistentValue(cloneDeep(session));
        await waitForAuthStorage();
        await withAuthStorageRetry(() => putRecord(STORES.authSessions, {
            id: AUTH_SESSION_ID,
            session: safeSession,
            updatedAt: Date.now()
        }));
        return cloneDeep(safeSession);
    }

    async function clearAuthSession() {
        await waitForAuthStorage();
        await withAuthStorageRetry(() => deleteRecord(STORES.authSessions, AUTH_SESSION_ID));
        return true;
    }

    async function assertLargeAssetCapacity(dataUrl) {
        if (typeof dataUrl !== 'string' || dataUrl.length < 350000 || !navigator.storage?.estimate) return;
        const estimate = await navigator.storage.estimate();
        const usage = Math.max(0, Number(estimate?.usage) || 0);
        const quota = Math.max(0, Number(estimate?.quota) || 0);
        if (quota > 0 && usage / quota >= 0.9) {
            throw new DOMException('Storage is above 90%; new large images are temporarily blocked.', 'QuotaExceededError');
        }
    }

    async function saveAssetFromDataUrl(assetId, dataUrl, extra = {}) {
        if (!assetId || !isDataUrl(dataUrl)) return null;
        await assertLargeAssetCapacity(dataUrl);
        revokeRuntimeBlobUrl(assetId);
        const blob = dataUrlToBlob(dataUrl);
        return withStore([STORES.assets], 'readwrite', (stores) => {
            stores[STORES.assets].put({
                id: assetId,
                blob,
                mimeType: blob.type || extra.mimeType || 'application/octet-stream',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                ...extra
            });
        }).then(() => assetId);
    }

    async function getAssetBlob(assetId) {
        if (!assetId) return null;
        const record = await getRecord(STORES.assets, assetId);
        return record && record.blob ? record.blob : null;
    }

    async function getAssetUrl(assetId) {
        if (!assetId) return null;
        const existing = runtimeBlobUrls.get(assetId);
        if (existing) {
            touchRuntimeBlobUrl(assetId);
            return existing;
        }

        const blob = await getAssetBlob(assetId);
        if (!blob) return null;

        const url = URL.createObjectURL(blob);
        runtimeBlobUrls.set(assetId, url);
        touchRuntimeBlobUrl(assetId);
        pruneRuntimeAssetCache();
        return url;
    }

    async function deleteAsset(assetId) {
        if (!assetId) return;
        revokeRuntimeBlobUrl(assetId);
        return deleteRecord(STORES.assets, assetId);
    }

    async function markAssetOrphaned(assetId) {
        if (!assetId) return false;
        return withStore([STORES.assets], 'readwrite', async (stores) => {
            const current = await requestToPromise(stores[STORES.assets].get(String(assetId)));
            if (!current) return false;
            stores[STORES.assets].put({ ...current, orphanedAt: current.orphanedAt || Date.now() });
            return true;
        });
    }

    function collectAssetReferences(value, result = new Set(), seen = new WeakSet()) {
        if (!value || typeof value !== 'object') return result;
        if (seen.has(value)) return result;
        seen.add(value);
        if (Array.isArray(value)) {
            value.forEach((item) => collectAssetReferences(item, result, seen));
            return result;
        }
        Object.entries(value).forEach(([key, item]) => {
            if ((key === 'assetId' || key.endsWith('AssetId')) && typeof item === 'string' && item) result.add(item);
            else collectAssetReferences(item, result, seen);
        });
        return result;
    }

    async function pruneOrphanedAssets(options = {}) {
        const graceMs = Math.max(0, Number(options.graceMs) || 7 * 24 * 60 * 60 * 1000);
        const now = Date.now();
        const referenceStores = Object.values(STORES).filter((name) => ![
            STORES.assets,
            STORES.storageCheckpoints,
            STORES.meta
        ].includes(name));
        const rowsByStore = await Promise.all(referenceStores.map((name) => getAllRecords(name)));
        const references = new Set();
        rowsByStore.forEach((rows) => collectAssetReferences(rows, references));
        const coverReference = await getMeta(META_KEYS.imMomentsCoverAssetId);
        if (typeof coverReference === 'string') references.add(coverReference);
        const assets = await getAllRecords(STORES.assets);
        const removable = assets.filter((asset) => {
            return asset?.id && asset.orphanedAt && now - Number(asset.orphanedAt) >= graceMs && !references.has(String(asset.id));
        });
        if (removable.length > 0) {
            await withStore([STORES.assets], 'readwrite', (stores) => {
                removable.forEach((asset) => stores[STORES.assets].delete(asset.id));
            });
            removable.forEach((asset) => revokeRuntimeBlobUrl(asset.id));
        }
        return removable.length;
    }

    function resolveMessageOrder(message, fallbackIndex = 0) {
        if (message && Number.isFinite(Number(message.__messageOrder))) {
            return Number(message.__messageOrder);
        }
        return Number.isFinite(Number(fallbackIndex)) ? Number(fallbackIndex) : 0;
    }

    function normalizeMessageRecord(friendId, msg, index) {
        const safe = msg || {};
        const resolvedOrder = resolveMessageOrder(safe, index);
        return {
            id: safe.id || `${String(friendId)}_msg_${safe.timestamp || Date.now()}_${resolvedOrder}`,
            friendId: String(friendId),
            order: resolvedOrder,
            role: safe.role || 'assistant',
            type: safe.type || 'text',
            noticeKind: typeof safe.noticeKind === 'string' ? safe.noticeKind : '',
            actorRole: safe.actorRole === 'user' || safe.actorRole === 'assistant' ? safe.actorRole : '',
            actorName: typeof safe.actorName === 'string' ? safe.actorName : '',
            content: typeof safe.content === 'string' ? safe.content : '',
            contentAssetId: typeof safe.contentAssetId === 'string' ? safe.contentAssetId : '',
            text: typeof safe.text === 'string' ? safe.text : '',
            transcript: typeof safe.transcript === 'string' ? safe.transcript : '',
            stickerCategory: typeof safe.stickerCategory === 'string' ? safe.stickerCategory : '',
            stickerName: typeof safe.stickerName === 'string' ? safe.stickerName : '',
            stickerUrl: typeof safe.stickerUrl === 'string' ? safe.stickerUrl : '',
            stickerAssetId: typeof safe.stickerAssetId === 'string' ? safe.stickerAssetId : '',
            translation: typeof safe.translation === 'string' ? safe.translation : '',
            showTranslation: !!safe.showTranslation,
            replyTo: safe.replyTo || null,
            offlineMode: !!safe.offlineMode,
            offlineScene: typeof safe.offlineScene === 'string' ? safe.offlineScene : '',
            offlineAction: typeof safe.offlineAction === 'string' ? safe.offlineAction : '',
            offlineSessionId: typeof safe.offlineSessionId === 'string' ? safe.offlineSessionId : '',
            endedAt: Number(safe.endedAt) || 0,
            dateText: typeof safe.dateText === 'string' ? safe.dateText : '',
            title: typeof safe.title === 'string' ? safe.title : '',
            summary: typeof safe.summary === 'string' ? safe.summary : '',
            rawSummary: typeof safe.rawSummary === 'string' ? safe.rawSummary : '',
            timestamp: Number(safe.timestamp) || Date.now(),
            amount: safe.amount,
            description: safe.description,
            targetName: safe.targetName,
            payKind: safe.payKind,
            speaker: safe.speaker,
            senderName: safe.senderName,
            senderAvatarUrl: safe.senderAvatarUrl,
            senderAvatarAssetId: typeof safe.senderAvatarAssetId === 'string' ? safe.senderAvatarAssetId : '',
            packetMsg: safe.packetMsg,
            claims: safe.claims,
            packetCount: safe.packetCount,
            packetType: safe.packetType,
            allocations: safe.allocations,
            status: safe.status,
            duration: safe.duration,
            callMessages: safe.callMessages,
            isSelf: safe.isSelf,
            statusText: safe.statusText,
            senderId: safe.senderId,
            apiRunId: safe.apiRunId,
            rollbackSourceMessage: safe.rollbackSourceMessage || null,
            paymentAction: safe.paymentAction,
            payDirection: safe.payDirection,
            payerName: safe.payerName,
            payeeName: safe.payeeName,
            receiverName: safe.receiverName,
            cardTitle: safe.cardTitle,
            payStatus: safe.payStatus,
            claimed: !!safe.claimed,
            imageSource: safe.imageSource,
            fakeLinkData: safe.fakeLinkData && typeof safe.fakeLinkData === 'object'
                ? sanitizePersistentValue(cloneDeep(safe.fakeLinkData))
                : null,
            packetId: safe.packetId,
            totalAmount: safe.totalAmount,
            claimRecords: safe.claimRecords,
            claimedMemberIds: safe.claimedMemberIds,
            speakerMemberId: safe.speakerMemberId,
            payload: safe.payload || null
        };
    }

    function denormalizeMessageRecord(row) {
        const inferredRecallActorRole = row.noticeKind === 'message_recalled'
            ? (String(row.content || '').trim().startsWith('你撤回了') ? 'user' : 'assistant')
            : '';
        return {
            id: row.id,
            role: row.role,
            type: row.type,
            noticeKind: row.noticeKind || '',
            actorRole: row.actorRole === 'user' || row.actorRole === 'assistant'
                ? row.actorRole
                : inferredRecallActorRole,
            actorName: row.actorName || '',
            content: row.content,
            contentAssetId: row.contentAssetId || '',
            text: row.text,
            transcript: row.transcript,
            stickerCategory: row.stickerCategory,
            stickerName: row.stickerName,
            stickerUrl: row.stickerUrl,
            stickerAssetId: row.stickerAssetId || '',
            translation: row.translation,
            showTranslation: row.showTranslation,
            replyTo: row.replyTo,
            offlineMode: !!row.offlineMode,
            offlineScene: row.offlineScene || '',
            offlineAction: row.offlineAction || '',
            offlineSessionId: row.offlineSessionId || '',
            endedAt: Number(row.endedAt) || 0,
            dateText: row.dateText || '',
            title: row.title || '',
            summary: row.summary || '',
            rawSummary: row.rawSummary || '',
            timestamp: row.timestamp,
            amount: row.amount,
            description: row.description,
            targetName: row.targetName,
            payKind: row.payKind,
            speaker: row.speaker,
            senderName: row.senderName,
            senderAvatarUrl: row.senderAvatarUrl,
            senderAvatarAssetId: row.senderAvatarAssetId || '',
            packetMsg: row.packetMsg,
            claims: row.claims,
            packetCount: row.packetCount,
            packetType: row.packetType,
            allocations: row.allocations,
            status: row.status,
            duration: row.duration,
            callMessages: row.callMessages,
            isSelf: row.isSelf,
            statusText: row.statusText,
            senderId: row.senderId,
            apiRunId: row.apiRunId,
            rollbackSourceMessage: row.rollbackSourceMessage || null,
            paymentAction: row.paymentAction,
            payDirection: row.payDirection,
            payerName: row.payerName,
            payeeName: row.payeeName,
            receiverName: row.receiverName,
            cardTitle: row.cardTitle,
            payStatus: row.payStatus,
            claimed: !!row.claimed,
            imageSource: row.imageSource,
            fakeLinkData: row.fakeLinkData && typeof row.fakeLinkData === 'object'
                ? cloneDeep(row.fakeLinkData)
                : null,
            packetId: row.packetId,
            totalAmount: row.totalAmount,
            claimRecords: row.claimRecords,
            claimedMemberIds: row.claimedMemberIds,
            speakerMemberId: row.speakerMemberId,
            payload: row.payload,
            __messageOrder: Number(row.order) || 0
        };
    }

    const MESSAGE_ASSET_FIELDS = [
        ['content', 'contentAssetId'],
        ['stickerUrl', 'stickerAssetId'],
        ['senderAvatarUrl', 'senderAvatarAssetId']
    ];

    async function prepareMessageForStorage(friendId, message, index = 0) {
        const next = cloneDeep(message || {});
        const messageId = String(next.id || `${friendId}_msg_${next.timestamp || Date.now()}_${index}`);
        next.id = messageId;
        for (const [urlField, assetField] of MESSAGE_ASSET_FIELDS) {
            const value = next[urlField];
            if (isDataUrl(value)) {
                next[assetField] = await saveContentAddressedAsset(value, {
                    fallbackId: buildAssetId('im_message', messageId, urlField),
                    ownerType: 'im_message',
                    ownerId: messageId,
                    field: urlField
                });
                next[urlField] = '';
            } else if (next[assetField] && isBlobUrl(value)) {
                next[urlField] = '';
            }
        }
        return next;
    }

    async function hydrateMessageAssets(message) {
        const next = { ...(message || {}) };
        for (const [urlField, assetField] of MESSAGE_ASSET_FIELDS) {
            if (next[assetField] && !next[urlField]) next[urlField] = await getAssetUrl(next[assetField]);
        }
        return next;
    }

    function buildAssetId(prefix, ownerId, fieldName) {
        return `${prefix}_${String(ownerId)}_${String(fieldName)}`;
    }

    const FRIEND_ASSET_FIELDS = [
        ['avatarUrl', 'avatarAssetId'],
        ['chatBg', 'chatBgAssetId'],
        ['momentsCover', 'momentsCoverAssetId']
    ];

    async function persistFriendAssets(friend) {
        if (!friend) return friend;
        const result = cloneDeep(friend);

        for (const [urlField, assetField] of FRIEND_ASSET_FIELDS) {
            const currentValue = result[urlField];
            if (isDataUrl(currentValue)) {
                const assetId = await saveContentAddressedAsset(currentValue, {
                    fallbackId: result[assetField] || buildAssetId('friend', result.id, urlField),
                    ownerType: 'im_friend',
                    ownerId: String(result.id),
                    field: urlField
                });
                result[assetField] = assetId;
                result[urlField] = null;
                continue;
            }

            if (result[assetField] && isBlobUrl(currentValue)) {
                result[urlField] = null;
            }
        }

        if (Array.isArray(result.members)) {
            for (let index = 0; index < result.members.length; index += 1) {
                const member = result.members[index];
                if (!member || typeof member !== 'object') continue;
                if (isDataUrl(member.avatarUrl)) {
                    member.avatarAssetId = await saveContentAddressedAsset(member.avatarUrl, {
                        fallbackId: buildAssetId('friend_member', result.id, member.id ?? index),
                        ownerType: 'im_group_member',
                        ownerId: String(member.id ?? index),
                        field: 'avatarUrl'
                    });
                    member.avatarUrl = null;
                } else if (member.avatarAssetId && isBlobUrl(member.avatarUrl)) {
                    member.avatarUrl = null;
                }
            }
        }

        return result;
    }

    async function hydrateFriendAssets(friend) {
        if (!friend) return friend;
        const result = cloneDeep(friend);
        const mappings = [
            ['avatarAssetId', 'avatarUrl'],
            ['chatBgAssetId', 'chatBg'],
            ['momentsCoverAssetId', 'momentsCover']
        ];

        for (const [assetField, urlField] of mappings) {
            if (result[assetField] && (!result[urlField] || isBlobUrl(result[urlField]))) {
                result[urlField] = await getAssetUrl(result[assetField]);
            }
        }

        if (Array.isArray(result.members)) {
            for (const member of result.members) {
                if (member?.avatarAssetId && !member.avatarUrl) member.avatarUrl = await getAssetUrl(member.avatarAssetId);
            }
        }

        return result;
    }

    function collectFriendAssetIds(friend) {
        if (!friend) return [];
        const ids = FRIEND_ASSET_FIELDS
            .map(([, assetField]) => friend[assetField] ? String(friend[assetField]) : null)
            .filter(Boolean);
        (Array.isArray(friend.members) ? friend.members : []).forEach((member) => {
            if (member?.avatarAssetId) ids.push(String(member.avatarAssetId));
        });
        return Array.from(new Set(ids));
    }

    function getExpectedFriendAssetIds(friend) {
        if (!friend || friend.id == null) return [];
        const ids = FRIEND_ASSET_FIELDS
            .map(([urlField, assetField]) => {
                if (friend[assetField]) return String(friend[assetField]);
                if (isDataUrl(friend[urlField])) return buildAssetId('friend', friend.id, urlField);
                return null;
            })
            .filter(Boolean);
        (Array.isArray(friend.members) ? friend.members : []).forEach((member, index) => {
            if (member?.avatarAssetId) ids.push(String(member.avatarAssetId));
            else if (isDataUrl(member?.avatarUrl)) ids.push(buildAssetId('friend_member', friend.id, member.id ?? index));
        });
        return Array.from(new Set(ids));
    }

    async function getFriendMetaById(friendId) {
        if (friendId == null) return null;
        return getRecord(STORES.imFriends, String(friendId));
    }

    async function deleteFriendMetaById(friendId) {
        return deleteRecord(STORES.imFriends, String(friendId));
    }

    async function cleanupRemovedFriendAssets(previousFriend, nextFriend, retainedAssetIds = new Set()) {
        if (!previousFriend) return;
        const nextIds = new Set(getExpectedFriendAssetIds(nextFriend));
        for (const assetId of collectFriendAssetIds(previousFriend)) {
            if (nextIds.has(assetId) || retainedAssetIds.has(assetId)) continue;
            await markAssetOrphaned(assetId);
        }
    }

    async function buildFriendMessageSummary(messages) {
        const list = Array.isArray(messages) ? messages : [];
        const lastMessage = list.length > 0 ? list[list.length - 1] : null;

        let previewText = '';
        if (lastMessage) {
            if (lastMessage.type === 'image') {
                previewText = lastMessage.text || '[图片]';
            } else if (lastMessage.type === 'voice_message') {
                previewText = `[语音] ${lastMessage.transcript || lastMessage.text || ''}`.trim();
            } else if (lastMessage.type === 'sticker') {
                previewText = `[表情] ${lastMessage.stickerName || lastMessage.text || ''}`.trim();
            } else if (lastMessage.type === 'moment_forward') {
                previewText = '[朋友圈]';
            } else if (lastMessage.type === 'pay_transfer') {
                previewText = `[转账] ${lastMessage.description || ''}`.trim();
            } else if (lastMessage.type === 'group_red_packet') {
                previewText = `[群红包] ${lastMessage.description || ''}`.trim();
            } else if (lastMessage.type === 'system_notice') {
                if (lastMessage.noticeKind === 'group_left') {
                    previewText = '你已退出群聊';
                } else if (lastMessage.noticeKind === 'group_rejoined') {
                    previewText = '你重新进入群聊';
                } else if (lastMessage.noticeKind === 'narration') {
                    previewText = `[旁白] ${lastMessage.content || lastMessage.text || ''}`.trim();
                } else {
                    previewText = lastMessage.content || lastMessage.text || '';
                }
            } else {
                previewText = lastMessage.content || lastMessage.text || '';
            }
        }

        return {
            lastMessagePreview: previewText || '',
            lastMessageTimestamp: Number(lastMessage?.timestamp) || 0,
            messageCount: list.length
        };
    }

    function resolveFriendMessageSummary(friend, previousMeta = null) {
        if (!friend || friend.messagesLoaded !== false) {
            return buildFriendMessageSummary(friend ? friend.messages : []);
        }

        const preview = typeof friend.lastMessagePreview === 'string'
            ? friend.lastMessagePreview
            : typeof previousMeta?.lastMessagePreview === 'string'
                ? previousMeta.lastMessagePreview
                : '';

        const timestampSource = friend.lastMessageTimestamp != null
            ? friend.lastMessageTimestamp
            : previousMeta?.lastMessageTimestamp;

        const countSource = friend.messageCount != null
            ? friend.messageCount
            : previousMeta?.messageCount;

        return {
            lastMessagePreview: preview,
            lastMessageTimestamp: Number(timestampSource) || 0,
            messageCount: Number(countSource) || 0
        };
    }

    function normalizeChatSummary(friendId, source = {}) {
        return {
            friendId: String(friendId),
            lastMessagePreview: typeof source.lastMessagePreview === 'string' ? source.lastMessagePreview : '',
            lastMessageTimestamp: Math.max(0, Number(source.lastMessageTimestamp) || 0),
            messageCount: Math.max(0, Number(source.messageCount) || 0),
            unreadCount: Math.max(0, Number(source.unreadCount) || 0),
            updatedAt: Date.now()
        };
    }

    async function saveChatSummary(friendId, source = {}) {
        const record = normalizeChatSummary(friendId, source);
        await putRecord(STORES.imChatSummaries, record);
        return record;
    }

    async function saveFriendMeta(friend, options = {}) {
        if (!friend || friend.id == null) return false;

        const previousMeta = Object.prototype.hasOwnProperty.call(options, 'previousMeta')
            ? options.previousMeta
            : await getFriendMetaById(friend.id);

        const prepared = await persistFriendAssets(friend);
        const meta = { ...prepared };
        const messageSummary = await resolveFriendMessageSummary(prepared, previousMeta);

        delete meta.messages;

        meta.id = String(meta.id);
        meta.updatedAt = Date.now();
        const summary = normalizeChatSummary(meta.id, {
            ...messageSummary,
            unreadCount: prepared.unreadCount
        });
        delete meta.lastMessagePreview;
        delete meta.lastMessageTimestamp;
        delete meta.messageCount;
        delete meta.unreadCount;

        await withStore([STORES.imFriends, STORES.imChatSummaries], 'readwrite', (stores) => {
            stores[STORES.imFriends].put(sanitizePersistentValue(meta));
            stores[STORES.imChatSummaries].put(summary);
        });
        return true;
    }

    async function saveFriendMessage(friendId, message, order = 0) {
        const safeFriendId = String(friendId);
        const preparedMessage = await prepareMessageForStorage(safeFriendId, message, order);
        const normalized = normalizeMessageRecord(safeFriendId, {
            ...preparedMessage,
            __messageOrder: resolveMessageOrder(message, order)
        }, order);

        await putRecord(STORES.imMessages, normalized);
        return normalized;
    }

    async function commitFriendMessage(friend, message, order = 0) {
        if (!friend || friend.id == null) throw new Error('Friend is required for atomic message commit.');
        const safeFriendId = String(friend.id);
        const preparedMessage = await prepareMessageForStorage(safeFriendId, message, order);
        const normalized = normalizeMessageRecord(safeFriendId, {
            ...preparedMessage,
            __messageOrder: resolveMessageOrder(message, order)
        }, order);
        const messageSummary = await buildFriendMessageSummary(friend.messages || []);
        const summary = normalizeChatSummary(safeFriendId, {
            ...messageSummary,
            unreadCount: friend.unreadCount
        });
        await runWithQuotaRetry(() => withStore([STORES.imMessages, STORES.imChatSummaries], 'readwrite', (stores) => {
            stores[STORES.imMessages].put(normalized);
            stores[STORES.imChatSummaries].put(summary);
        }));
        storageHealthState.lastCommitAt = Date.now();
        storageHealthState.lastError = null;
        notifyStorageSubscribers({ ...storageHealthState, reason: 'imessage-message-commit', friendId: safeFriendId });
        return normalized;
    }

    async function deleteFriendMessage(messageId) {
        if (!messageId) return false;
        await deleteRecord(STORES.imMessages, messageId);
        return true;
    }

    async function deleteFriendMessages(messageIds) {
        const safeIds = Array.isArray(messageIds) ? messageIds.map((id) => String(id)).filter(Boolean) : [];
        if (safeIds.length === 0) return true;

        await withStore([STORES.imMessages], 'readwrite', (stores) => {
            safeIds.forEach((messageId) => stores[STORES.imMessages].delete(messageId));
        });
        return true;
    }

    async function saveFriendMessages(friendId, messages) {
        const safeFriendId = String(friendId);
        const list = Array.isArray(messages) ? messages : [];
        const preparedList = await Promise.all(list.map((msg, idx) => prepareMessageForStorage(safeFriendId, msg, idx)));
        const normalizedList = preparedList.map((msg, idx) => normalizeMessageRecord(safeFriendId, msg, idx));
        const nextMessageIds = new Set(normalizedList.map((msg) => String(msg.id)));

        return withStore([STORES.imMessages, STORES.imChatSummaries], 'readwrite', async (stores) => {
            const index = stores[STORES.imMessages].index('friendId');
            const range = IDBKeyRange.only(safeFriendId);
            const existingKeys = await requestToPromise(index.getAllKeys(range));
            const existingSummary = await requestToPromise(stores[STORES.imChatSummaries].get(safeFriendId));

            existingKeys.forEach((messageId) => {
                if (!nextMessageIds.has(String(messageId))) {
                    stores[STORES.imMessages].delete(messageId);
                }
            });

            normalizedList.forEach((msg) => stores[STORES.imMessages].put(msg));
            const messageSummary = await buildFriendMessageSummary(normalizedList);
            stores[STORES.imChatSummaries].put(normalizeChatSummary(safeFriendId, {
                ...messageSummary,
                unreadCount: existingSummary?.unreadCount
            }));
        });
    }

    async function replaceFriendMessages(friendId, messages) {
        return saveFriendMessages(friendId, messages);
    }

    async function saveFriend(friend, options = {}) {
        if (!friend || friend.id == null) return false;
        const previousFriend = await getFriendMetaById(friend.id);
        const retainedAssetIds = new Set(getExpectedFriendAssetIds(friend));
        const shouldPersistMessages = options.skipMessages !== true && friend.messagesLoaded !== false;

        await saveFriendMeta(friend, { previousMeta: previousFriend });

        if (shouldPersistMessages) {
            await saveFriendMessages(friend.id, friend.messages || []);
        }

        await cleanupRemovedFriendAssets(previousFriend, friend, retainedAssetIds);
        return true;
    }

    async function saveFriendMetaOnly(friend) {
        return saveFriend(friend, { skipMessages: true });
    }

    async function patchFriendMeta(friendId, patch = {}) {
        if (friendId == null) return false;
        const safeFriendId = String(friendId);
        const safePatch = patch && typeof patch === 'object' ? cloneDeep(patch) : {};
        delete safePatch.id;
        delete safePatch.messages;
        const summaryPatch = {};
        ['lastMessagePreview', 'lastMessageTimestamp', 'messageCount', 'unreadCount'].forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(safePatch, key)) summaryPatch[key] = safePatch[key];
            delete safePatch[key];
        });
        const now = Date.now();
        const refreshAssetIds = [];
        for (const [urlField, assetField] of FRIEND_ASSET_FIELDS) {
            if (!isDataUrl(safePatch[urlField])) continue;
            const assetId = await saveContentAddressedAsset(safePatch[urlField], {
                fallbackId: safePatch[assetField] || buildAssetId('friend', safeFriendId, urlField),
                ownerType: 'im_friend',
                ownerId: safeFriendId,
                field: urlField
            });
            safePatch[assetField] = assetId;
            safePatch[urlField] = null;
            refreshAssetIds.push(assetId);
        }

        await withStore([STORES.imFriends, STORES.imChatSummaries, STORES.assets], 'readwrite', async (stores) => {
            const current = await requestToPromise(stores[STORES.imFriends].get(safeFriendId));
            if (!current) throw new Error(`Friend ${safeFriendId} does not exist.`);
            const currentSummary = await requestToPromise(stores[STORES.imChatSummaries].get(safeFriendId));
            const next = { ...current, ...safePatch, id: safeFriendId };

            for (const [urlField, assetField] of FRIEND_ASSET_FIELDS) {
                if (!Object.prototype.hasOwnProperty.call(safePatch, urlField)) continue;
                const incoming = safePatch[urlField];
                if (isDataUrl(incoming)) {
                    const assetId = String(safePatch[assetField] || current[assetField] || buildAssetId('friend', safeFriendId, urlField));
                    const blob = dataUrlToBlob(incoming);
                    stores[STORES.assets].put({
                        id: assetId,
                        blob,
                        mimeType: blob.type || 'application/octet-stream',
                        ownerType: 'im_friend',
                        ownerId: safeFriendId,
                        field: urlField,
                        updatedAt: now
                    });
                    next[assetField] = assetId;
                    next[urlField] = null;
                    refreshAssetIds.push(assetId);
                } else if (!incoming && safePatch[assetField]) {
                    next[urlField] = null;
                    next[assetField] = safePatch[assetField];
                } else if (!incoming) {
                    next[urlField] = null;
                    next[assetField] = null;
                } else if (isBlobUrl(incoming) && current[assetField]) {
                    next[urlField] = null;
                    next[assetField] = current[assetField];
                }
            }

            next.updatedAt = now;
            next.revision = Math.max(0, Number(current.revision) || 0) + 1;
            const sanitized = sanitizePersistentValue(next);
            stores[STORES.imFriends].put(sanitized);
            if (Object.keys(summaryPatch).length > 0) {
                stores[STORES.imChatSummaries].put(normalizeChatSummary(safeFriendId, {
                    ...(currentSummary || {}),
                    ...summaryPatch
                }));
            }
        });

        refreshAssetIds.forEach((assetId) => revokeRuntimeBlobUrl(assetId));
        storageHealthState.lastCommitAt = now;
        storageHealthState.lastError = null;
        notifyStorageSubscribers({ ...storageHealthState, reason: 'imessage-friend-patch', friendId: safeFriendId });
        return true;
    }

    async function deleteFriend(friendId) {
        if (friendId == null) return false;
        const previousFriend = await getFriendMetaById(friendId);
        await saveFriendMessages(friendId, []);
        await withStore([STORES.imFriends, STORES.imChatSummaries], 'readwrite', (stores) => {
            stores[STORES.imFriends].delete(String(friendId));
            stores[STORES.imChatSummaries].delete(String(friendId));
        });
        await cleanupRemovedFriendAssets(previousFriend, null);
        return true;
    }

    async function loadMessagesByFriendId(friendId) {
        const safeFriendId = String(friendId);
        return withStore([STORES.imMessages], 'readonly', async (stores) => {
            const messageStore = stores[STORES.imMessages];

            if (hasStoreIndex(messageStore, 'friendId_order')) {
                const orderIndex = messageStore.index('friendId_order');
                const orderRange = IDBKeyRange.bound(
                    [safeFriendId, Number.MIN_SAFE_INTEGER],
                    [safeFriendId, Number.MAX_SAFE_INTEGER]
                );
                const orderedRows = await requestToPromise(orderIndex.getAll(orderRange));
                return Promise.all(orderedRows.map((row) => hydrateMessageAssets(denormalizeMessageRecord(row))));
            }

            const timeIndex = messageStore.index('friendId_timestamp');
            const timeRange = IDBKeyRange.bound([safeFriendId, 0], [safeFriendId, Number.MAX_SAFE_INTEGER]);
            const rows = await requestToPromise(timeIndex.getAll(timeRange));
            const ordered = rows
                .sort((a, b) => {
                    if ((a.timestamp || 0) !== (b.timestamp || 0)) return (a.timestamp || 0) - (b.timestamp || 0);
                    return (a.order || 0) - (b.order || 0);
                })
                .map(denormalizeMessageRecord);
            return Promise.all(ordered.map((message) => hydrateMessageAssets(message)));
        });
    }

    async function saveFriends(friends) {
        const safeFriends = Array.isArray(friends) ? friends.filter((friend) => friend && friend.id != null) : [];
        const nextFriendIds = new Set(safeFriends.map((friend) => String(friend.id)));
        const retainedAssetIds = new Set();
        safeFriends.forEach((friend) => {
            getExpectedFriendAssetIds(friend).forEach((assetId) => retainedAssetIds.add(assetId));
        });

        const existingFriends = await getAllRecords(STORES.imFriends);
        const existingById = new Map(existingFriends.map((friend) => [String(friend.id), friend]));

        for (const existingFriend of existingFriends) {
            const friendId = String(existingFriend.id);
            if (!nextFriendIds.has(friendId)) {
                await deleteFriend(friendId);
            }
        }

        for (const friend of safeFriends) {
            const previousFriend = existingById.get(String(friend.id)) || null;
            await saveFriendMeta(friend, { previousMeta: previousFriend });
            if (friend.messagesLoaded !== false) {
                await saveFriendMessages(friend.id, friend.messages || []);
            }
            await cleanupRemovedFriendAssets(previousFriend, friend, retainedAssetIds);
        }

        return true;
    }

    async function loadFriends() {
        const [allFriends, summaries] = await Promise.all([
            getAllRecords(STORES.imFriends),
            getAllRecords(STORES.imChatSummaries)
        ]);
        const summariesByFriendId = new Map(summaries.map((item) => [String(item.friendId), item]));
        const hydrated = await Promise.all(
            allFriends.map(async (friend) => {
                const next = await hydrateFriendAssets(friend);
                const summary = summariesByFriendId.get(String(friend.id)) || friend;
                next.messages = [];
                next.messagesLoaded = false;
                next.lastMessagePreview = typeof summary.lastMessagePreview === 'string' ? summary.lastMessagePreview : '';
                next.lastMessageTimestamp = Number(summary.lastMessageTimestamp) || 0;
                next.messageCount = Number(summary.messageCount) || 0;
                next.unreadCount = Math.max(0, Number(summary.unreadCount) || 0);
                return next;
            })
        );

        hydrated.sort((a, b) => {
            const aPinned = a.isPinned ? 1 : 0;
            const bPinned = b.isPinned ? 1 : 0;
            if (aPinned !== bPinned) return bPinned - aPinned;
            const aTime = Number(a.lastMessageTimestamp) || 0;
            const bTime = Number(b.lastMessageTimestamp) || 0;
            if (aTime !== bTime) return bTime - aTime;
            return String(a.id).localeCompare(String(b.id));
        });

        return hydrated;
    }

    async function persistMomentAssets(moment) {
        if (!moment) return moment;
        const result = { ...moment };

        if (isDataUrl(result.avatar)) {
            const assetId = result.avatarAssetId || buildAssetId('moment_avatar', result.id, 'avatar');
            await saveAssetFromDataUrl(assetId, result.avatar, {
                ownerType: 'im_moment',
                ownerId: String(result.id),
                field: 'avatar'
            });
            result.avatarAssetId = assetId;
            result.avatar = null;
        } else if (result.avatarAssetId && isBlobUrl(result.avatar)) {
            result.avatar = null;
        }

        if (Array.isArray(result.images)) {
            const nextImages = [];
            for (let i = 0; i < result.images.length; i += 1) {
                const item = result.images[i];
                if (typeof item === 'string' && isDataUrl(item)) {
                    const assetId = buildAssetId('moment_img', result.id, i);
                    await saveAssetFromDataUrl(assetId, item, {
                        ownerType: 'im_moment',
                        ownerId: String(result.id),
                        field: 'images',
                        index: i
                    });
                    nextImages.push({ assetId, desc: '' });
                } else if (item && typeof item === 'object' && isDataUrl(item.src)) {
                    const assetId = item.assetId || buildAssetId('moment_img', result.id, i);
                    await saveAssetFromDataUrl(assetId, item.src, {
                        ownerType: 'im_moment',
                        ownerId: String(result.id),
                        field: 'images',
                        index: i
                    });
                    nextImages.push({ ...item, assetId, src: null });
                } else if (item && typeof item === 'object' && item.assetId && isBlobUrl(item.src)) {
                    nextImages.push({ ...item, src: null });
                } else {
                    nextImages.push(item);
                }
            }
            result.images = nextImages;
        }

        return result;
    }

    async function hydrateMomentAssets(moment) {
        if (!moment) return moment;
        const result = { ...moment };

        if (result.avatarAssetId && (!result.avatar || isBlobUrl(result.avatar))) {
            result.avatar = await getAssetUrl(result.avatarAssetId);
        }

        if (Array.isArray(result.images)) {
            const nextImages = [];
            for (const item of result.images) {
                if (item && typeof item === 'object' && item.assetId && (!item.src || isBlobUrl(item.src))) {
                    nextImages.push({ ...item, src: await getAssetUrl(item.assetId) });
                } else {
                    nextImages.push(item);
                }
            }
            result.images = nextImages;
        }

        return result;
    }

    function collectMomentAssetIds(moment) {
        if (!moment) return [];
        const ids = [];
        if (moment.avatarAssetId) ids.push(String(moment.avatarAssetId));
        if (Array.isArray(moment.images)) {
            moment.images.forEach((item) => {
                if (item && typeof item === 'object' && item.assetId) {
                    ids.push(String(item.assetId));
                }
            });
        }
        return Array.from(new Set(ids));
    }

    function getExpectedMomentAssetIds(moment) {
        if (!moment || moment.id == null) return [];
        const ids = [];

        if (moment.avatarAssetId) {
            ids.push(String(moment.avatarAssetId));
        } else if (isDataUrl(moment.avatar)) {
            ids.push(buildAssetId('moment_avatar', moment.id, 'avatar'));
        }

        if (Array.isArray(moment.images)) {
            moment.images.forEach((item, index) => {
                if (item && typeof item === 'object' && item.assetId) {
                    ids.push(String(item.assetId));
                    return;
                }
                if (typeof item === 'string' && isDataUrl(item)) {
                    ids.push(buildAssetId('moment_img', moment.id, index));
                    return;
                }
                if (item && typeof item === 'object' && isDataUrl(item.src)) {
                    ids.push(String(item.assetId || buildAssetId('moment_img', moment.id, index)));
                }
            });
        }

        return Array.from(new Set(ids));
    }

    async function getMomentById(momentId) {
        if (momentId == null) return null;
        return getRecord(STORES.imMoments, momentId);
    }

    async function cleanupRemovedMomentAssets(previousMoment, nextMoment, retainedAssetIds = new Set()) {
        if (!previousMoment) return;
        const nextIds = new Set(getExpectedMomentAssetIds(nextMoment));
        for (const assetId of collectMomentAssetIds(previousMoment)) {
            if (nextIds.has(assetId) || retainedAssetIds.has(assetId)) continue;
            await markAssetOrphaned(assetId);
        }
    }

    async function saveMoment(moment) {
        if (!moment || moment.id == null) return false;
        const previousMoment = await getMomentById(moment.id);
        const retainedAssetIds = new Set(getExpectedMomentAssetIds(moment));
        const prepared = await persistMomentAssets(moment);

        await putRecord(STORES.imMoments, {
            ...prepared,
            id: prepared.id,
            updatedAt: Date.now()
        });

        await cleanupRemovedMomentAssets(previousMoment, moment, retainedAssetIds);
        return true;
    }

    async function deleteMoment(momentId) {
        if (momentId == null) return false;
        const existingMoments = await getAllRecords(STORES.imMoments);
        const matchingMoments = existingMoments.filter((moment) => String(moment?.id) === String(momentId));
        const directMoment = await getMomentById(momentId);
        const momentsToCleanup = [];
        const keysToDelete = new Set([momentId]);

        if (directMoment) {
            momentsToCleanup.push(directMoment);
            keysToDelete.add(directMoment.id);
        }

        matchingMoments.forEach((moment) => {
            if (!moment) return;
            momentsToCleanup.push(moment);
            keysToDelete.add(moment.id);
        });

        for (const key of keysToDelete) {
            await deleteRecord(STORES.imMoments, key);
        }

        const cleanedIds = new Set();
        for (const moment of momentsToCleanup) {
            const cleanupKey = `${typeof moment.id}:${String(moment.id)}`;
            if (cleanedIds.has(cleanupKey)) continue;
            cleanedIds.add(cleanupKey);
            await cleanupRemovedMomentAssets(moment, null);
        }
        return true;
    }

    async function saveMoments(moments) {
        const safeMoments = Array.isArray(moments) ? moments : [];
        const existingMoments = await getAllRecords(STORES.imMoments);
        const nextMomentIds = new Set(safeMoments.map((moment) => String(moment.id)));
        const retainedAssetIds = new Set();

        safeMoments.forEach((moment) => {
            getExpectedMomentAssetIds(moment).forEach((assetId) => retainedAssetIds.add(assetId));
        });

        for (const existingMoment of existingMoments) {
            if (!nextMomentIds.has(String(existingMoment.id))) {
                await deleteMoment(existingMoment.id);
            }
        }

        for (const rawMoment of safeMoments) {
            await saveMoment(rawMoment);
        }

        return true;
    }

    async function loadMoments() {
        const allMoments = await getAllRecords(STORES.imMoments);
        const hydrated = await Promise.all(allMoments.map((moment) => hydrateMomentAssets(moment)));
        hydrated.sort((a, b) => (b.time || 0) - (a.time || 0));
        return hydrated;
    }

    async function saveMomentMessages(messages) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const normalizedMessages = safeMessages.map((msg) => ({
            ...msg,
            id: msg?.id || `moment_msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        }));
        const nextIds = new Set(normalizedMessages.map((msg) => String(msg.id)));

        return withStore([STORES.imMomentMessages], 'readwrite', async (stores) => {
            const existing = await requestToPromise(stores[STORES.imMomentMessages].getAll());
            const existingById = new Map((Array.isArray(existing) ? existing : []).map((item) => [String(item.id), item]));

            existingById.forEach((item, itemId) => {
                if (!nextIds.has(itemId)) {
                    stores[STORES.imMomentMessages].delete(item.id);
                }
            });

            normalizedMessages.forEach((msg) => {
                stores[STORES.imMomentMessages].put(msg);
            });
        });
    }

    async function loadMomentMessages() {
        const rows = await getAllRecords(STORES.imMomentMessages);
        return Array.isArray(rows) ? rows.sort((a, b) => (b.time || 0) - (a.time || 0)) : [];
    }

    async function saveStickers(stickers) {
        const safeStickers = Array.isArray(stickers)
            ? stickers.filter((category) => category && category.categoryName != null)
            : [];
        const normalizedStickers = [];
        for (const category of safeStickers) {
            const nextCategory = cloneDeep(category);
            nextCategory.categoryName = String(category.categoryName);
            const items = Array.isArray(nextCategory.items) ? nextCategory.items : [];
            for (let index = 0; index < items.length; index += 1) {
                const sticker = items[index];
                if (!sticker || typeof sticker !== 'object') continue;
                if (isDataUrl(sticker.url)) {
                    sticker.assetId = await saveContentAddressedAsset(sticker.url, {
                        fallbackId: buildAssetId('sticker', nextCategory.categoryName, sticker.name ?? index),
                        ownerType: 'im_sticker',
                        ownerId: nextCategory.categoryName,
                        field: String(sticker.name ?? index)
                    });
                    sticker.url = null;
                } else if (sticker.assetId && isBlobUrl(sticker.url)) {
                    sticker.url = null;
                }
            }
            normalizedStickers.push(nextCategory);
        }
        const nextIds = new Set(normalizedStickers.map((category) => category.categoryName));

        return withStore([STORES.imStickers], 'readwrite', async (stores) => {
            const existing = await requestToPromise(stores[STORES.imStickers].getAll());
            const existingById = new Map((Array.isArray(existing) ? existing : []).map((item) => [String(item.categoryName), item]));

            existingById.forEach((item, categoryName) => {
                if (!nextIds.has(categoryName)) {
                    stores[STORES.imStickers].delete(item.categoryName);
                }
            });

            normalizedStickers.forEach((category) => stores[STORES.imStickers].put(category));
        });
    }

    async function loadStickers() {
        const categories = await getAllRecords(STORES.imStickers);
        for (const category of categories) {
            for (const sticker of (Array.isArray(category?.items) ? category.items : [])) {
                if (sticker?.assetId && !sticker.url) sticker.url = await getAssetUrl(sticker.assetId);
            }
        }
        return categories;
    }

    async function saveMomentsCover(dataUrlOrUrl) {
        const now = Date.now();
        let storedValue = dataUrlOrUrl || null;
        if (isDataUrl(dataUrlOrUrl)) await assertLargeAssetCapacity(dataUrlOrUrl);
        await withStore([STORES.meta, STORES.assets], 'readwrite', async (stores) => {
            if (isDataUrl(dataUrlOrUrl)) {
                const assetId = 'im_moments_cover_me';
                const blob = dataUrlToBlob(dataUrlOrUrl);
                stores[STORES.assets].put({
                    id: assetId,
                    blob,
                    mimeType: blob.type || 'application/octet-stream',
                    ownerType: 'im_moments',
                    ownerId: 'me',
                    field: 'momentsCover',
                    updatedAt: now
                });
                storedValue = assetId;
            } else if (dataUrlOrUrl) {
                storedValue = { externalUrl: dataUrlOrUrl };
            } else {
                storedValue = null;
            }
            stores[STORES.meta].put({ key: META_KEYS.imMomentsCoverAssetId, value: storedValue });
        });
        if (storedValue === 'im_moments_cover_me') revokeRuntimeBlobUrl(storedValue);
        return storedValue;
    }

    async function loadMomentsCoverUrl() {
        const assetMeta = await getMeta(META_KEYS.imMomentsCoverAssetId);
        if (!assetMeta) return null;
        if (typeof assetMeta === 'object' && assetMeta.externalUrl) return assetMeta.externalUrl;
        if (typeof assetMeta === 'string') return getAssetUrl(assetMeta);
        return null;
    }

    function createDefaultAppState() {
        return {
            youtube: {
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
            },
            tiktok: {
                profile: {
                    name: 'User',
                    handle: 'user123',
                    avatar: null,
                    status: '思考中...',
                    bio: '点击添加个人简介',
                    persona: '',
                    following: 0,
                    followers: 0,
                    likes: 0,
                    posts: []
                },
                chars: [],
                videos: [
                    {
                        id: 'v_default_1',
                        authorId: 'user_default_1',
                        authorName: 'Mew',
                        desc: '周末的正确打开方式，当然是和猫猫一起虚度光阴啦 🐈 #猫咪日常 #周末vlog',
                        sceneText: '阳光穿过窗纱洒在木地板上，一只橘猫正四仰八叉地躺在阳光里打呼噜。镜头缓慢拉近，画面色调温暖治愈，配着慵懒的 lofi 音乐。',
                        likes: 12543,
                        commentsCount: 432,
                        shares: 128,
                        isLiked: false,
                        comments: [
                            { authorName: 'Cici', text: '好治愈的画面，想去你家偷猫！', likes: 231 },
                            { authorName: '鱼蛋', text: '这猫怎么长得跟人一样哈哈哈', likes: 89 }
                        ]
                    },
                    {
                        id: 'v_default_2',
                        authorId: 'user_default_2',
                        authorName: 'CityWalker',
                        desc: '下雨天的城市，也有别样的浪漫 🌧️ 📸 #扫街 #下雨天 #摄影',
                        sceneText: '镜头跟随着一把透明雨伞，穿梭在霓虹闪烁的积水街道。水面倒映着红蓝色的灯牌，雨滴砸在伞面上发出清脆的白噪音，氛围感拉满。',
                        likes: 8762,
                        commentsCount: 215,
                        shares: 342,
                        isLiked: false,
                        comments: [
                            { authorName: '光影', text: '色彩太棒了，求个滤镜参数', likes: 156 },
                            { authorName: 'Jay', text: '喜欢下雨天的人，内心都很温柔吧', likes: 44 }
                        ]
                    }
                ],
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
            netflix: {
                works: [],
                boundWorldBookIds: [],
                homeCatalog: null,
                playbackCatalog: {},
                playbackCustomCss: '',
                presetState: null
            },
            desktop: {},
            bstage: {},
            x: {
                xData: {
                    name: 'User',
                    handle: '@user',
                    bio: '点击编辑资料添加简介',
                    location: '',
                    following: '0',
                    followers: '0',
                    persona: '',
                    avatar: '',
                    banner: ''
                },
                xTopics: [],
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

    function ensureAppStateShape(rawState = {}) {
        const defaults = createDefaultAppState();
        const safeState = rawState && typeof rawState === 'object' ? rawState : {};

        return {
            ...defaults,
            ...safeState,
            youtube: {
                ...defaults.youtube,
                ...(safeState.youtube && typeof safeState.youtube === 'object' ? safeState.youtube : {})
            },
            tiktok: {
                ...defaults.tiktok,
                ...(safeState.tiktok && typeof safeState.tiktok === 'object' ? safeState.tiktok : {})
            },
            pay: {
                ...defaults.pay,
                ...(safeState.pay && typeof safeState.pay === 'object' ? safeState.pay : {})
            },
            spotify: {
                ...defaults.spotify,
                ...(safeState.spotify && typeof safeState.spotify === 'object' ? safeState.spotify : {})
            },
            diary: {
                ...defaults.diary,
                ...(safeState.diary && typeof safeState.diary === 'object' ? safeState.diary : {})
            },
            maps: {
                ...defaults.maps,
                ...(safeState.maps && typeof safeState.maps === 'object' ? safeState.maps : {})
            },
            netflix: safeState.netflix && typeof safeState.netflix === 'object' ? safeState.netflix : defaults.netflix,
            desktop: safeState.desktop && typeof safeState.desktop === 'object' ? safeState.desktop : defaults.desktop,
            bstage: safeState.bstage && typeof safeState.bstage === 'object' ? safeState.bstage : defaults.bstage,
            x: {
                ...defaults.x,
                ...(safeState.x && typeof safeState.x === 'object' ? safeState.x : {}),
                xData: {
                    ...defaults.x.xData,
                    ...(safeState.x && safeState.x.xData && typeof safeState.x.xData === 'object'
                        ? safeState.x.xData
                        : {})
                },
                xTopics: Array.isArray(safeState.x?.xTopics) ? safeState.x.xTopics : defaults.x.xTopics,
                xHomeBannerUrl: typeof safeState.x?.xHomeBannerUrl === 'string'
                    ? safeState.x.xHomeBannerUrl
                    : defaults.x.xHomeBannerUrl,
                xSearchBannerUrl: typeof safeState.x?.xSearchBannerUrl === 'string'
                    ? safeState.x.xSearchBannerUrl
                    : defaults.x.xSearchBannerUrl
            },
            imessage: {
                ...defaults.imessage,
                ...(safeState.imessage && typeof safeState.imessage === 'object' ? safeState.imessage : {}),
                uiState: {
                    ...defaults.imessage.uiState,
                    ...(safeState.imessage && safeState.imessage.uiState && typeof safeState.imessage.uiState === 'object'
                        ? safeState.imessage.uiState
                        : {})
                }
            }
        };
    }

    function normalizeGlobalPayload(payload = {}) {
        const safe = payload && typeof payload === 'object' ? payload : {};
        const themeState = safe.themeState && typeof safe.themeState === 'object' ? safe.themeState : null;
        if (themeState) {
            themeState.imessageChatCssEnabled = !!themeState.imessageChatCssEnabled;
            themeState.imessageChatCss = typeof themeState.imessageChatCss === 'string' ? themeState.imessageChatCss : '';
            if (Array.isArray(themeState.apps)) {
                themeState.apps = themeState.apps.map(app => {
                    if (!app || typeof app !== 'object') return app;
                    if (app.id === 'app-icon-8' && app.name === 'Spotify') {
                        return { ...app, name: 'Loves' };
                    }
                    return app;
                });
            }
        }

        return {
            storageSchemaVersion: STORAGE_SCHEMA_VERSION,
            userState: safe.userState && typeof safe.userState === 'object'
                ? {
                    name: safe.userState.name || '',
                    phone: safe.userState.phone || '',
                    persona: safe.userState.persona || '',
                    avatarUrl: safe.userState.avatarUrl || null
                }
                : {
                    name: '',
                    phone: '',
                    persona: '',
                    avatarUrl: null
                },
            accounts: Array.isArray(safe.accounts) ? safe.accounts : [],
            currentAccountId: safe.currentAccountId ?? null,
            apiConfig: safe.apiConfig && typeof safe.apiConfig === 'object'
                ? {
                    endpoint: typeof safe.apiConfig.endpoint === 'string' ? safe.apiConfig.endpoint : '',
                    apiKey: typeof safe.apiConfig.apiKey === 'string' ? safe.apiConfig.apiKey : '',
                    model: typeof safe.apiConfig.model === 'string' ? safe.apiConfig.model : '',
                    temperature: Number.isFinite(parseFloat(safe.apiConfig.temperature))
                        ? parseFloat(safe.apiConfig.temperature)
                        : 0.7
                }
                : { endpoint: '', apiKey: '', model: '', temperature: 0.7 },
            apiPresets: Array.isArray(safe.apiPresets) ? safe.apiPresets : [],
            fetchedModels: Array.isArray(safe.fetchedModels) ? safe.fetchedModels : [],
            assistiveBallSettings: safe.assistiveBallSettings && typeof safe.assistiveBallSettings === 'object'
                ? {
                    enabled: !!safe.assistiveBallSettings.enabled,
                    x: Number.isFinite(parseFloat(safe.assistiveBallSettings.x))
                        ? parseFloat(safe.assistiveBallSettings.x)
                        : null,
                    y: Number.isFinite(parseFloat(safe.assistiveBallSettings.y))
                        ? parseFloat(safe.assistiveBallSettings.y)
                        : null,
                    opacity: Number.isFinite(parseFloat(safe.assistiveBallSettings.opacity))
                        ? Math.max(0.2, Math.min(1, parseFloat(safe.assistiveBallSettings.opacity) > 1
                            ? parseFloat(safe.assistiveBallSettings.opacity) / 100
                            : parseFloat(safe.assistiveBallSettings.opacity)))
                        : 0.72,
                    imageUrl: typeof safe.assistiveBallSettings.imageUrl === 'string'
                        && /^(https?:\/\/|data:image\/png;base64,)/i.test(safe.assistiveBallSettings.imageUrl.trim())
                        ? safe.assistiveBallSettings.imageUrl.trim()
                        : ''
                }
                : { enabled: false, x: null, y: null, opacity: 0.72, imageUrl: '' },
            themeState: themeState || {
                bgUrl: null,
                fontMode: 'preset',
                fontPresetKey: 'system-default',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
            fontCssName: '',
            fontSize: 16,
                fontSources: {
                    woff2: '',
                    woff: '',
                    ttf: ''
                },
                savedFontPresets: [],
                imessageChatCssEnabled: false,
                imessageChatCss: '',
                apps: [
                    { id: 'app-icon-1', name: 'Pay', icon: null },
                    { id: 'app-icon-2', name: 'TikTok', icon: null },
                    { id: 'app-icon-3', name: 'b.stage', icon: null },
                    { id: 'app-icon-4', name: 'X', icon: null },
                    { id: 'app-icon-5', name: 'Shop', icon: null },
            { id: 'app-icon-6', name: 'call', icon: null },
                    { id: 'app-icon-7', name: 'Netflix', icon: null },
                    { id: 'app-icon-8', name: 'Loves', icon: null },
                    { id: 'dock-icon-settings', name: '设置', icon: null },
                    { id: 'dock-icon-imessage', name: '信息', icon: null },
                    { id: 'dock-icon-youtube', name: 'YouTube', icon: null }
                ]
            },
            wbGroups: Array.isArray(safe.wbGroups) ? safe.wbGroups : [],
            worldBooks: Array.isArray(safe.worldBooks) ? safe.worldBooks : [],
            appState: ensureAppStateShape(safe.appState)
        };
    }

    async function saveGlobalData(payload = {}) {
        const normalized = normalizeGlobalPayload(payload);

        await Promise.all([
            setSetting('userState', normalized.userState),
            setSetting('currentAccountId', normalized.currentAccountId),
            setSetting('apiConfig', normalized.apiConfig),
            setSetting('apiPresets', normalized.apiPresets),
            setSetting('fetchedModels', normalized.fetchedModels),
            setSetting('assistiveBallSettings', normalized.assistiveBallSettings),
            setSetting('themeState', normalized.themeState),
            setSetting('wbGroups', normalized.wbGroups),
            setSetting('worldBooks', normalized.worldBooks),
            putRecord(STORES.accounts, { id: '__all__', value: cloneDeep(normalized.accounts) }),
            setMeta(META_KEYS.schemaVersion, STORAGE_SCHEMA_VERSION)
        ]);

        if (storageReadyPromise) await storageReadyPromise;
        await commitDomain('settings', (draft) => ({
            ...draft,
            userState: normalized.userState,
            accounts: normalized.accounts,
            currentAccountId: normalized.currentAccountId,
            apiConfig: normalized.apiConfig,
            apiPresets: normalized.apiPresets,
            fetchedModels: normalized.fetchedModels,
            assistiveBallSettings: normalized.assistiveBallSettings,
            themeState: normalized.themeState,
            wbGroups: normalized.wbGroups,
            worldBooks: normalized.worldBooks
        }), { reason: 'global-settings-save' });
        await Promise.all(Object.entries(normalized.appState || {}).map(([name, value]) => {
            return commitDomain(name, value, { reason: `global-app-save:${name}` });
        }));

        return true;
    }

    async function loadGlobalData() {
        const [
            storedSchemaVersion,
            userState,
            currentAccountId,
            apiConfig,
            apiPresets,
            fetchedModels,
            assistiveBallSettings,
            themeState,
            wbGroups,
            worldBooks,
            appState,
            accountsRecord
        ] = await Promise.all([
            getMeta(META_KEYS.schemaVersion),
            getSetting('userState', null),
            getSetting('currentAccountId', null),
            getSetting('apiConfig', null),
            getSetting('apiPresets', []),
            getSetting('fetchedModels', []),
            getSetting('assistiveBallSettings', { enabled: false }),
            getSetting('themeState', null),
            getSetting('wbGroups', []),
            getSetting('worldBooks', []),
            getSetting('appState', createDefaultAppState()),
            getRecord(STORES.accounts, '__all__')
        ]);

        const durableSettings = readDomain('settings', {});
        const domainAppState = createDefaultAppState();
        Object.keys(domainAppState).forEach((name) => {
            domainAppState[name] = readDomain(name, domainAppState[name]);
        });
        return {
            ...normalizeGlobalPayload({
                userState: durableSettings.userState ?? userState,
                accounts: Array.isArray(durableSettings.accounts)
                    ? durableSettings.accounts
                    : (accountsRecord && Array.isArray(accountsRecord.value) ? accountsRecord.value : []),
                currentAccountId: durableSettings.currentAccountId ?? currentAccountId,
                apiConfig: durableSettings.apiConfig ?? apiConfig,
                apiPresets: durableSettings.apiPresets ?? apiPresets,
                fetchedModels: durableSettings.fetchedModels ?? fetchedModels,
                assistiveBallSettings: durableSettings.assistiveBallSettings ?? assistiveBallSettings,
                themeState: durableSettings.themeState ?? themeState,
                wbGroups: durableSettings.wbGroups ?? wbGroups,
                worldBooks: durableSettings.worldBooks ?? worldBooks,
                appState: domainAppState
            }),
            storageSchemaVersion: Number(storedSchemaVersion) || 0
        };
    }

    async function exportAllData(progressCallback) {
        if (progressCallback) progressCallback({ message: '准备导出数据...', progress: 0 });
        
        const chunks = [];
        chunks.push(`{"version": ${STORAGE_SCHEMA_VERSION}, "exportedAt": ${Date.now()}, "stores": {`);

        const storeNames = BACKUP_STORES;
        const totalStores = storeNames.length;
        
        for (let i = 0; i < totalStores; i++) {
            const storeName = storeNames[i];
            
            const baseProgress = Math.floor((i / totalStores) * 90);
            if (progressCallback) progressCallback({ message: `正在读取: ${storeName}`, progress: baseProgress });
            
            chunks.push(`"${storeName}": [`);
            
            const records = await getAllRecords(storeName);
            const totalRecords = records.length;
            
            for (let j = 0; j < totalRecords; j++) {
                const record = records[j];
                
                if (storeName === STORES.assets && record && record.blob) {
                    try {
                        const dataUrl = await blobToDataUrl(record.blob);
                        record.dataUrl = dataUrl;
                        record.blob = undefined;
                    } catch (err) {
                        console.warn(`Failed to convert asset ${record.id} to dataUrl`, err);
                    }
                }
                
                chunks.push(JSON.stringify(record));
                if (j < totalRecords - 1) {
                    chunks.push(',');
                }
                
                if ((storeName === STORES.assets || storeName === STORES.imMessages) && j > 0 && j % 20 === 0 && progressCallback) {
                    const stepProgress = Math.floor((j / totalRecords) * (90 / totalStores));
                    progressCallback({ message: `处理表 ${storeName} (${j}/${totalRecords})...`, progress: baseProgress + stepProgress });
                }
            }
            
            chunks.push(']');
            if (i < totalStores - 1) {
                chunks.push(',');
            }
        }
        
        chunks.push(`}}`);
        
        if (progressCallback) progressCallback({ message: '正在生成备份文件...', progress: 95 });
        
        return new Blob(chunks, { type: 'application/json' });
    }

    async function importAllData(payload = {}, progressCallback) {
        if (progressCallback) progressCallback({ message: '开始清理旧数据...', progress: 0 });
        
        await clearAllData();
        
        const isNewFormat = !!payload.stores;
        
        if (isNewFormat) {
            const storesData = payload.stores || {};
            if (progressCallback) progressCallback({ message: '开始恢复数据...', progress: 10 });
            
            const storeNames = Object.keys(storesData);
            const totalStores = storeNames.length;
            
            for (let i = 0; i < totalStores; i++) {
                const storeName = storeNames[i];
                const records = storesData[storeName];
                if (!Array.isArray(records) || records.length === 0) continue;

                const baseProgress = 10 + Math.floor((i / totalStores) * 80);
                if (progressCallback) progressCallback({ message: `正在恢复: ${storeName}...`, progress: baseProgress });

                await withStore([storeName], 'readwrite', (stores) => {
                    const store = stores[storeName];
                    records.forEach((record) => {
                        if (storeName === STORES.assets && record.dataUrl) {
                            try {
                                const blob = dataUrlToBlob(record.dataUrl);
                                record.blob = blob;
                                record.dataUrl = undefined;
                            } catch (err) {
                                console.warn(`Failed to restore asset ${record.id}`, err);
                            }
                        }
                        store.put(record);
                    });
                });
                
            }
            if (progressCallback) progressCallback({ message: '校验 IndexedDB 数据...', progress: 95 });
        } else {
            const safe = payload && typeof payload === 'object' ? payload : {};
            const globalData = safe.globalData || {};
            await saveGlobalData(globalData);

            const imessage = safe.imessage && typeof safe.imessage === 'object' ? safe.imessage : {};
            const friends = Array.isArray(imessage.friends) ? imessage.friends : [];
            if (friends.length > 0) {
                await withStore([STORES.imFriends], 'readwrite', (stores) => {
                    friends.forEach(f => stores[STORES.imFriends].put(f));
                });
            }
            
            const messages = Array.isArray(imessage.messages) ? imessage.messages : [];
            if (messages.length > 0) {
                await withStore([STORES.imMessages], 'readwrite', (stores) => {
                    messages.forEach(msg => stores[STORES.imMessages].put(msg));
                });
            }

            const moments = Array.isArray(imessage.moments) ? imessage.moments : [];
            if (moments.length > 0) {
                await withStore([STORES.imMoments], 'readwrite', (stores) => {
                    moments.forEach(m => stores[STORES.imMoments].put(m));
                });
            }

            const momentMessages = Array.isArray(imessage.momentMessages) ? imessage.momentMessages : [];
            if (momentMessages.length > 0) {
                await withStore([STORES.imMomentMessages], 'readwrite', (stores) => {
                    momentMessages.forEach(m => stores[STORES.imMomentMessages].put(m));
                });
            }

            const stickers = Array.isArray(imessage.stickers) ? imessage.stickers : [];
            if (stickers.length > 0) {
                await withStore([STORES.imStickers], 'readwrite', (stores) => {
                    stickers.forEach(s => stores[STORES.imStickers].put(s));
                });
            }

            if (imessage.momentsCoverUrlMeta !== undefined) {
                await setMeta(META_KEYS.imMomentsCoverAssetId, imessage.momentsCoverUrlMeta);
            } else if (imessage.momentsCoverUrl) {
                await saveMomentsCover(imessage.momentsCoverUrl);
            }

            const assetsArray = Array.isArray(safe.assets) ? safe.assets : [];
            if (assetsArray.length > 0) {
                await withStore([STORES.assets], 'readwrite', (stores) => {
                    assetsArray.forEach((record) => {
                        if (record && record.id && record.dataUrl) {
                            try {
                                const blob = dataUrlToBlob(record.dataUrl);
                                stores[STORES.assets].put({ ...record, blob, dataUrl: undefined });
                            } catch (err) {
                                console.warn(`Failed to restore asset ${record.id}`, err);
                            }
                        }
                    });
                });
            }
        }
        
        if (progressCallback) progressCallback({ message: '恢复完成', progress: 100 });
        return true;
    }

    async function serializeRecordForBackup(storeName, record) {
        const serialized = cloneDeep(record);

        if (storeName === STORES.assets && serialized && serialized.blob) {
            try {
                serialized.dataUrl = await blobToDataUrl(serialized.blob);
                delete serialized.blob;
            } catch (err) {
                console.warn(`Failed to convert asset ${serialized.id} to dataUrl`, err);
            }
        }

        return serialized;
    }

    function deserializeBackupRecord(storeName, record) {
        const restored = cloneDeep(record);

        if (storeName === STORES.assets && restored && restored.dataUrl) {
            try {
                restored.blob = dataUrlToBlob(restored.dataUrl);
                delete restored.dataUrl;
            } catch (err) {
                console.warn(`Failed to restore asset ${restored.id}`, err);
            }
        }

        return restored;
    }

    function buildBackupStats(storesData = {}, localStorageSnapshot = []) {
        const storeStats = {};
        let recordCount = 0;
        let assetCount = 0;

        BACKUP_STORES.forEach((storeName) => {
            const count = Array.isArray(storesData[storeName]) ? storesData[storeName].length : 0;
            storeStats[storeName] = count;
            recordCount += count;
        });

        if (Array.isArray(storesData[STORES.assets])) {
            assetCount = storesData[STORES.assets].length;
        }

        return {
            stores: storeStats,
            storeCount: BACKUP_STORES.length,
            recordCount,
            assetCount,
            localStorageKeyCount: Array.isArray(localStorageSnapshot) ? localStorageSnapshot.length : 0,
            approximateBytes: estimateJsonBytes({ stores: storesData, localStorage: localStorageSnapshot })
        };
    }

    async function collectBackupSnapshot(progressCallback) {
        reportProgress(progressCallback, '准备导出数据...', 0);

        const storesData = {};
        const storeNames = BACKUP_STORES;

        for (let i = 0; i < storeNames.length; i += 1) {
            const storeName = storeNames[i];
            const baseProgress = Math.floor((i / storeNames.length) * 82);
            reportProgress(progressCallback, `读取 ${storeName}...`, baseProgress);

            const records = await getAllRecords(storeName);
            const serializedRecords = [];

            for (let j = 0; j < records.length; j += 1) {
                serializedRecords.push(await serializeRecordForBackup(storeName, records[j]));
                if ((storeName === STORES.assets || storeName === STORES.imMessages) && j > 0 && j % 20 === 0) {
                    const stepProgress = Math.floor((j / records.length) * (82 / storeNames.length));
                    reportProgress(progressCallback, `处理 ${storeName} (${j}/${records.length})...`, baseProgress + stepProgress);
                }
            }

            storesData[storeName] = serializedRecords;
        }

        reportProgress(progressCallback, '校验 IndexedDB 数据...', 86);
        const localStorageSnapshot = [];
        const checksumSource = {
            stores: storesData,
            localStorage: localStorageSnapshot
        };
        const stats = buildBackupStats(storesData, localStorageSnapshot);

        return {
            app: BACKUP_APP_NAME,
            schemaVersion: STORAGE_SCHEMA_VERSION,
            version: STORAGE_SCHEMA_VERSION,
            exportedAt: Date.now(),
            stores: storesData,
            localStorage: localStorageSnapshot,
            stats,
            checksum: {
                algorithm: 'fnv1a32',
                value: createChecksum(checksumSource)
            }
        };
    }

    async function serializeBackupBlob(snapshot, progressCallback) {
        reportProgress(progressCallback, '生成备份文件...', 95);
        return new Blob([JSON.stringify(snapshot)], { type: 'application/json' });
    }

    function summarizeBackupPayload(payload = {}) {
        const safe = payload && typeof payload === 'object' ? payload : {};
        const storesData = safe.stores && typeof safe.stores === 'object' ? safe.stores : {};
        const localStorageSnapshot = Array.isArray(safe.localStorage) ? safe.localStorage : [];
        const stats = safe.stats && typeof safe.stats === 'object'
            ? safe.stats
            : buildBackupStats(storesData, localStorageSnapshot);

        return {
            app: safe.app || BACKUP_APP_NAME,
            schemaVersion: Number(safe.schemaVersion || safe.version) || 1,
            exportedAt: Number(safe.exportedAt) || 0,
            storeCount: Number(stats.storeCount) || Object.keys(storesData).length,
            recordCount: Number(stats.recordCount) || 0,
            assetCount: Number(stats.assetCount) || 0,
            localStorageKeyCount: Number(stats.localStorageKeyCount) || localStorageSnapshot.length,
            approximateBytes: Number(stats.approximateBytes) || estimateJsonBytes(safe),
            checksum: safe.checksum?.value || ''
        };
    }

    function validateBackupPayload(payload = {}) {
        if (!payload || typeof payload !== 'object') {
            throw new Error('Invalid backup payload.');
        }

        if (payload.stores && typeof payload.stores === 'object') {
            const suppliedChecksum = payload.checksum?.value;
            if (suppliedChecksum) {
                const actualChecksum = createChecksum({
                    stores: payload.stores,
                    localStorage: Array.isArray(payload.localStorage) ? payload.localStorage : []
                });
                if (actualChecksum !== suppliedChecksum) {
                    throw new Error('Backup checksum mismatch.');
                }
            }
            const storesData = {};
            BACKUP_STORES.forEach((storeName) => {
                storesData[storeName] = Array.isArray(payload.stores[storeName]) ? payload.stores[storeName] : [];
            });

            const normalized = {
                ...payload,
                stores: storesData,
                localStorage: Array.isArray(payload.localStorage) ? payload.localStorage : []
            };

            return {
                format: 'snapshot',
                payload: normalized,
                summary: summarizeBackupPayload(normalized)
            };
        }

        if (payload.globalData || payload.imessage || payload.assets) {
            return {
                format: 'legacy',
                payload,
                summary: {
                    app: BACKUP_APP_NAME,
                    schemaVersion: Number(payload.version) || 1,
                    exportedAt: Number(payload.exportedAt) || 0,
                    storeCount: 0,
                    recordCount: 0,
                    assetCount: Array.isArray(payload.assets) ? payload.assets.length : 0,
                    localStorageKeyCount: 0,
                    approximateBytes: estimateJsonBytes(payload),
                    checksum: ''
                }
            };
        }

        throw new Error('Unsupported backup format.');
    }

    function inspectBackupPayload(payload = {}) {
        return validateBackupPayload(payload).summary;
    }

    async function clearManagedPersistence() {
        try {
            clearRuntimeAssetCache();
        } catch (e) {}
        const authSession = await getAuthSession();
        const databaseDeleted = await clearAllData();
        if (authSession) await setAuthSession(authSession);
        return {
            databaseDeleted,
            authSessionPreserved: !!authSession
        };
    }

    async function restoreBackupSnapshot(snapshot = {}, progressCallback) {
        const storesData = snapshot.stores || {};
        const storeNames = BACKUP_STORES;

        reportProgress(progressCallback, '清理旧数据...', 0);
        await clearManagedPersistence();
        reportProgress(progressCallback, '恢复数据库...', 12);

        for (let i = 0; i < storeNames.length; i += 1) {
            const storeName = storeNames[i];
            const records = Array.isArray(storesData[storeName]) ? storesData[storeName] : [];
            const baseProgress = 12 + Math.floor((i / storeNames.length) * 72);
            reportProgress(progressCallback, `恢复 ${storeName}...`, baseProgress);

            if (records.length === 0) continue;

            await withStore([storeName], 'readwrite', (stores) => {
                const store = stores[storeName];
                records.forEach((record) => {
                    store.put(deserializeBackupRecord(storeName, record));
                });
            });
        }

        const legacyRows = (Array.isArray(snapshot.localStorage) ? snapshot.localStorage : [])
            .filter((row) => row?.key && row.key !== LEGACY_AUTH_SESSION_KEY);
        if (legacyRows.length > 0) {
            reportProgress(progressCallback, '迁移旧版兼容数据...', 90);
            await importLegacyBackupStorageRows(legacyRows);
        }
        reportProgress(progressCallback, '导入完成', 100);
        return true;
    }

    async function importLegacyBackupPayload(payload = {}, progressCallback) {
        const safe = payload && typeof payload === 'object' ? payload : {};
        const globalData = safe.globalData || {};

        reportProgress(progressCallback, '迁移旧格式全局数据...', 18);
        await saveGlobalData(globalData);

        const imessage = safe.imessage && typeof safe.imessage === 'object' ? safe.imessage : {};
        const friends = Array.isArray(imessage.friends) ? imessage.friends : [];
        if (friends.length > 0) {
            reportProgress(progressCallback, '迁移聊天联系人...', 36);
            await withStore([STORES.imFriends], 'readwrite', (stores) => {
                friends.forEach((friend) => stores[STORES.imFriends].put(friend));
            });
        }

        const messages = Array.isArray(imessage.messages) ? imessage.messages : [];
        if (messages.length > 0) {
            reportProgress(progressCallback, '迁移聊天记录...', 48);
            await withStore([STORES.imMessages], 'readwrite', (stores) => {
                messages.forEach((message) => stores[STORES.imMessages].put(message));
            });
        }

        const moments = Array.isArray(imessage.moments) ? imessage.moments : [];
        if (moments.length > 0) {
            reportProgress(progressCallback, '迁移朋友圈...', 58);
            await withStore([STORES.imMoments], 'readwrite', (stores) => {
                moments.forEach((moment) => stores[STORES.imMoments].put(moment));
            });
        }

        const momentMessages = Array.isArray(imessage.momentMessages) ? imessage.momentMessages : [];
        if (momentMessages.length > 0) {
            reportProgress(progressCallback, '迁移朋友圈消息...', 68);
            await withStore([STORES.imMomentMessages], 'readwrite', (stores) => {
                momentMessages.forEach((message) => stores[STORES.imMomentMessages].put(message));
            });
        }

        const stickers = Array.isArray(imessage.stickers) ? imessage.stickers : [];
        if (stickers.length > 0) {
            reportProgress(progressCallback, '迁移贴纸...', 76);
            await withStore([STORES.imStickers], 'readwrite', (stores) => {
                stickers.forEach((sticker) => stores[STORES.imStickers].put(sticker));
            });
        }

        if (imessage.momentsCoverUrlMeta !== undefined) {
            await setMeta(META_KEYS.imMomentsCoverAssetId, imessage.momentsCoverUrlMeta);
        } else if (imessage.momentsCoverUrl) {
            await saveMomentsCover(imessage.momentsCoverUrl);
        }

        const assetsArray = Array.isArray(safe.assets) ? safe.assets : [];
        if (assetsArray.length > 0) {
            reportProgress(progressCallback, '迁移图片资源...', 86);
            await withStore([STORES.assets], 'readwrite', (stores) => {
                assetsArray.forEach((record) => {
                    if (record && record.id && record.dataUrl) {
                        stores[STORES.assets].put(deserializeBackupRecord(STORES.assets, record));
                    }
                });
            });
        }

        reportProgress(progressCallback, '旧格式迁移完成', 100);
        return true;
    }

    async function exportAllData(progressCallback) {
        const snapshot = await collectBackupSnapshot(progressCallback);
        const blob = await serializeBackupBlob(snapshot, progressCallback);
        reportProgress(progressCallback, '导出完成', 100);
        return blob;
    }

    async function importAllData(payload = {}, progressCallback) {
        const validation = validateBackupPayload(payload);

        if (validation.format === 'snapshot') {
            return restoreBackupSnapshot(validation.payload, progressCallback);
        }

        reportProgress(progressCallback, '清理旧数据...', 0);
        await clearManagedPersistence();
        return importLegacyBackupPayload(validation.payload, progressCallback);
    }

    function formatBytes(bytes = 0) {
        const size = Math.max(0, Number(bytes) || 0);
        if (size < 1024) return `${size} B`;

        const units = ['KB', 'MB', 'GB', 'TB'];
        let value = size / 1024;
        let unitIndex = 0;

        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex += 1;
        }

        const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
        return `${value.toFixed(precision)} ${units[unitIndex]}`;
    }

    async function measureApproximateUsage() {
        const blob = await exportAllData();
        return blob.size;
    }

    async function getUsageSummary() {
        const [cacheBytes, totalBytes] = await Promise.all([
            measureRuntimeCacheUsage(),
            measureApproximateUsage()
        ]);

        return {
            cacheBytes,
            totalBytes,
            cacheFormatted: formatBytes(cacheBytes),
            totalFormatted: formatBytes(totalBytes),
            label: `${formatBytes(cacheBytes)} / ${formatBytes(totalBytes)}`
        };
    }

    async function getStorageHealth() {
        if (storageReadyPromise) await storageReadyPromise;
        let usage = 0;
        let quota = 0;
        let persisted = false;
        try {
            if (navigator.storage?.estimate) {
                const estimate = await navigator.storage.estimate();
                usage = Math.max(0, Number(estimate?.usage) || 0);
                quota = Math.max(0, Number(estimate?.quota) || 0);
            }
            if (navigator.storage?.persisted) persisted = !!(await navigator.storage.persisted());
        } catch (error) {}
        const breakdown = await getStorageBreakdown({ skipReady: true });
        return {
            ...cloneDeep(storageHealthState),
            usage,
            quota,
            ratio: quota > 0 ? usage / quota : 0,
            persisted,
            breakdown
        };
    }

    function measureBlobBytes(value, seen = new WeakSet()) {
        if (!value || typeof value !== 'object') return 0;
        if (typeof Blob !== 'undefined' && value instanceof Blob) return Math.max(0, Number(value.size) || 0);
        if (seen.has(value)) return 0;
        seen.add(value);
        if (Array.isArray(value)) return value.reduce((sum, item) => sum + measureBlobBytes(item, seen), 0);
        return Object.values(value).reduce((sum, item) => sum + measureBlobBytes(item, seen), 0);
    }

    function measureRecordBytes(record) {
        return estimateJsonBytes(record) + measureBlobBytes(record);
    }

    const STORAGE_BREAKDOWN_GROUPS = {
        appDomains: '应用状态',
        settings: '应用状态',
        accounts: '应用状态',
        appState: '应用状态',
        theme: '应用状态',
        worldbooks: '应用状态',
        meta: '应用状态',
        authSessions: '认证会话',
        imFriends: 'iMessage',
        imChatSummaries: 'iMessage',
        imMessages: 'iMessage',
        imMoments: 'iMessage',
        imMomentMessages: 'iMessage',
        imStickers: 'iMessage',
        xPosts: 'X',
        xThreads: 'X',
        xDms: 'X',
        assets: '图片资源',
        libraryBooks: '书库',
        libraryBookContent: '书库',
        libraryPlaylists: '书库',
        libraryTracks: '书库',
        libraryDailyStats: '书库',
        storageCheckpoints: '冗余历史'
    };

    async function getStorageBreakdown(options = {}) {
        if (!options.skipReady && storageReadyPromise) await storageReadyPromise;
        const stores = {};
        const groups = {};
        let indexedDbBytes = 0;
        for (const [storeKey, storeName] of Object.entries(STORES)) {
            const rows = await getAllRecords(storeName);
            const bytes = rows.reduce((sum, row) => sum + measureRecordBytes(row), 0);
            stores[storeName] = { count: rows.length, bytes };
            indexedDbBytes += bytes;
            const groupName = STORAGE_BREAKDOWN_GROUPS[storeKey] || '其他数据';
            const group = groups[groupName] || { count: 0, bytes: 0 };
            group.count += rows.length;
            group.bytes += bytes;
            groups[groupName] = group;
        }
        const logicalGroups = cloneDeep(groups);
        let originUsage = 0;
        let quota = 0;
        let usageDetails = {};
        try {
            const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
            originUsage = Math.max(0, Number(estimate?.usage) || 0);
            quota = Math.max(0, Number(estimate?.quota) || 0);
            usageDetails = estimate?.usageDetails && typeof estimate.usageDetails === 'object'
                ? Object.fromEntries(Object.entries(estimate.usageDetails).map(([key, value]) => [key, Math.max(0, Number(value) || 0)]))
                : {};
        } catch (error) {}
        const readUsageDetail = (...keys) => keys.reduce((value, key) => value || Math.max(0, Number(usageDetails[key]) || 0), 0);
        const indexedDbReportedBytes = readUsageDetail('indexedDB', 'indexeddb');
        const cacheBytes = readUsageDetail('caches', 'cacheStorage', 'cache_storage');
        const serviceWorkerBytes = readUsageDetail('serviceWorkerRegistrations', 'service_workers');
        const databaseOverheadBytes = indexedDbReportedBytes > 0
            ? Math.max(0, indexedDbReportedBytes - indexedDbBytes)
            : 0;
        const classifiedBytes = indexedDbReportedBytes + cacheBytes + serviceWorkerBytes;
        const browserOtherBytes = Math.max(0, originUsage - (classifiedBytes || indexedDbBytes));
        if (databaseOverheadBytes > 0) groups['IndexedDB 数据库开销'] = { count: 0, bytes: databaseOverheadBytes };
        if (cacheBytes > 0) groups['页面缓存'] = { count: 0, bytes: cacheBytes };
        if (browserOtherBytes > 0) groups[indexedDbReportedBytes > 0 ? '浏览器其他占用' : '浏览器未分类占用（估算）'] = { count: 0, bytes: browserOtherBytes };
        return {
            stores,
            groups,
            logicalGroups,
            indexedDbBytes,
            logicalBytes: indexedDbBytes,
            indexedDbReportedBytes,
            databaseOverheadBytes,
            cacheBytes,
            browserOtherBytes,
            originUsage,
            quota,
            usageDetails,
            classificationExact: indexedDbReportedBytes > 0 || cacheBytes > 0,
            otherBytes: browserOtherBytes,
            measuredAt: Date.now()
        };
    }

    async function deduplicateStoredImessageAssets() {
        const [friendRows, messageRows, stickerRows] = await Promise.all([
            getAllRecords(STORES.imFriends),
            getAllRecords(STORES.imMessages),
            getAllRecords(STORES.imStickers)
        ]);
        let recordsConverted = 0;
        for (const friend of friendRows) {
            const hasEmbedded = FRIEND_ASSET_FIELDS.some(([urlField]) => isDataUrl(friend?.[urlField]))
                || (Array.isArray(friend?.members) && friend.members.some((member) => isDataUrl(member?.avatarUrl)));
            if (!hasEmbedded) continue;
            const prepared = await persistFriendAssets(friend);
            await putRecord(STORES.imFriends, sanitizePersistentValue(prepared));
            recordsConverted += 1;
        }
        for (let index = 0; index < messageRows.length; index += 1) {
            const message = messageRows[index];
            if (!MESSAGE_ASSET_FIELDS.some(([urlField]) => isDataUrl(message?.[urlField]))) continue;
            const prepared = await prepareMessageForStorage(message.friendId, message, message.order ?? index);
            await putRecord(STORES.imMessages, normalizeMessageRecord(message.friendId, prepared, message.order ?? index));
            recordsConverted += 1;
        }
        const hasEmbeddedStickers = stickerRows.some((category) =>
            (Array.isArray(category?.items) ? category.items : []).some((sticker) => isDataUrl(sticker?.url))
        );
        if (hasEmbeddedStickers) {
            await saveStickers(stickerRows);
            recordsConverted += stickerRows.length;
        }
        return recordsConverted;
    }

    async function compactStorage(options = {}) {
        if (!options.skipReady && storageReadyPromise) await storageReadyPromise;
        const existingReport = await getMeta('storage_compacted_v8');
        if (existingReport && !options.force) {
            storageHealthState.lastCompaction = cloneDeep(existingReport);
            return cloneDeep(existingReport);
        }

        const before = await getStorageBreakdown({ skipReady: true });
        const [checkpoints, domains, friends, summaries, messages, moments, momentMessages, stickers, xPosts, xThreads, xDms, oldAppStateRecord, momentsCoverMeta] = await Promise.all([
            getAllRecords(STORES.storageCheckpoints),
            getAllRecords(STORES.appDomains),
            getAllRecords(STORES.imFriends),
            getAllRecords(STORES.imChatSummaries),
            getAllRecords(STORES.imMessages),
            getAllRecords(STORES.imMoments),
            getAllRecords(STORES.imMomentMessages),
            getAllRecords(STORES.imStickers),
            getAllRecords(STORES.xPosts),
            getAllRecords(STORES.xThreads),
            getAllRecords(STORES.xDms),
            getRecord(STORES.settings, 'appState'),
            getRecord(STORES.meta, META_KEYS.imMomentsCoverAssetId)
        ]);

        const domainNames = new Set(domains.map((row) => String(row?.name || '')).filter(Boolean));
        const friendIds = new Set(friends.map((row) => String(row?.id || '')).filter(Boolean));
        const summaryIds = new Set(summaries.map((row) => String(row?.friendId || '')).filter(Boolean));
        const messageIds = new Set(messages.map((row) => String(row?.id || '')).filter(Boolean));
        const momentIds = new Set(moments.map((row) => String(row?.id || '')).filter(Boolean));
        const momentMessageIds = new Set(momentMessages.map((row) => String(row?.id || '')).filter(Boolean));
        const stickerIds = new Set(stickers.map((row) => String(row?.categoryName || '')).filter(Boolean));
        const xPostIds = new Set(xPosts.map((row) => String(row?.id || '')).filter(Boolean));
        const xThreadIds = new Set(xThreads.map((row) => String(row?.postId || '')).filter(Boolean));
        const xDmIds = new Set(xDms.map((row) => String(row?.id || '')).filter(Boolean));
        const recoveredDomains = [];
        const recoveredFriends = [];
        const recoveredMessages = [];
        const recoveredMoments = [];
        const recoveredMomentMessages = [];
        const recoveredStickers = [];
        let coverRecoveryValue;

        const domainCheckpoints = new Map();
        checkpoints.forEach((checkpoint) => {
            if (checkpoint?.id?.startsWith('domain:') && checkpoint.current?.value && typeof checkpoint.current.value === 'object') {
                domainCheckpoints.set(checkpoint.id.slice('domain:'.length), checkpoint.current.value);
            }
            if (checkpoint?.id?.startsWith('im-friend:') && checkpoint.current?.value) {
                const friendId = checkpoint.id.slice('im-friend:'.length);
                if (!friendIds.has(friendId)) recoveredFriends.push(sanitizePersistentValue(cloneDeep(checkpoint.current.value)));
            }
            if (checkpoint?.id?.startsWith('im-messages:') && Array.isArray(checkpoint.current?.value)) {
                const friendId = checkpoint.id.slice('im-messages:'.length);
                checkpoint.current.value.forEach((message, index) => {
                    if (!message?.id || messageIds.has(String(message.id))) return;
                    recoveredMessages.push(normalizeMessageRecord(friendId, message, index));
                });
            }
            if (checkpoint?.id === 'im-moments-cover' && !momentsCoverMeta && checkpoint.current?.value) {
                coverRecoveryValue = cloneDeep(checkpoint.current.value);
            }
        });

        const oldAppState = oldAppStateRecord?.value && typeof oldAppStateRecord.value === 'object'
            ? oldAppStateRecord.value
            : {};
        const currentImessageDomain = domains.find((row) => row?.name === 'imessage');
        const legacyImessageValues = [oldAppState.imessage, currentImessageDomain?.value]
            .filter((value) => value && typeof value === 'object');
        legacyImessageValues.forEach((legacyImessage) => {
            const legacyFriends = Array.isArray(legacyImessage.friends) ? legacyImessage.friends : [];
            legacyFriends.forEach((friend) => {
                if (!friend || friend.id == null) return;
                const friendId = String(friend.id);
                if (!friendIds.has(friendId)) {
                    const friendMeta = sanitizePersistentValue(cloneDeep(friend));
                    delete friendMeta.messages;
                    recoveredFriends.push({ ...friendMeta, id: friendId });
                    friendIds.add(friendId);
                }
                (Array.isArray(friend.messages) ? friend.messages : []).forEach((message, index) => {
                    if (!message) return;
                    const normalized = normalizeMessageRecord(friendId, message, index);
                    if (messageIds.has(String(normalized.id))) return;
                    recoveredMessages.push(normalized);
                    messageIds.add(String(normalized.id));
                });
            });
            (Array.isArray(legacyImessage.messages) ? legacyImessage.messages : []).forEach((message, index) => {
                if (!message) return;
                const friendId = String(message.friendId ?? message.chatId ?? 'legacy');
                const normalized = normalizeMessageRecord(friendId, message, index);
                if (messageIds.has(String(normalized.id))) return;
                recoveredMessages.push(normalized);
                messageIds.add(String(normalized.id));
            });
            (Array.isArray(legacyImessage.moments) ? legacyImessage.moments : []).forEach((moment) => {
                if (!moment || moment.id == null || momentIds.has(String(moment.id))) return;
                recoveredMoments.push(sanitizePersistentValue(cloneDeep(moment)));
                momentIds.add(String(moment.id));
            });
            (Array.isArray(legacyImessage.momentMessages) ? legacyImessage.momentMessages : []).forEach((message) => {
                if (!message || message.id == null || momentMessageIds.has(String(message.id))) return;
                recoveredMomentMessages.push(sanitizePersistentValue(cloneDeep(message)));
                momentMessageIds.add(String(message.id));
            });
            (Array.isArray(legacyImessage.stickers) ? legacyImessage.stickers : []).forEach((category) => {
                if (!category || category.categoryName == null || stickerIds.has(String(category.categoryName))) return;
                recoveredStickers.push(sanitizePersistentValue(cloneDeep(category)));
                stickerIds.add(String(category.categoryName));
            });
        });
        const allDomainNames = new Set([...Object.keys(oldAppState), ...domainCheckpoints.keys()]);
        allDomainNames.forEach((name) => {
            if (domainNames.has(name)) return;
            const value = domainCheckpoints.get(name) ?? oldAppState[name];
            if (!value || typeof value !== 'object') {
                throw new Error(`Cannot safely recover missing domain ${name}.`);
            }
            recoveredDomains.push({
                name,
                value: name === 'imessage'
                    ? { uiState: cloneDeep(value.uiState && typeof value.uiState === 'object' ? value.uiState : {}) }
                    : cloneDeep(value)
            });
        });

        const xDomainValue = domains.find((row) => row?.name === 'x')?.value || {};
        const xRecoveryValue = domainCheckpoints.get('x') || oldAppState.x || {};
        const mergedXRecovery = {
            ...xRecoveryValue,
            ...xDomainValue,
            xGeneratedPosts: Array.isArray(xRecoveryValue.xGeneratedPosts) ? xRecoveryValue.xGeneratedPosts : [],
            xPostThreads: xRecoveryValue.xPostThreads && typeof xRecoveryValue.xPostThreads === 'object' ? xRecoveryValue.xPostThreads : {},
            xDirectMessages: Array.isArray(xRecoveryValue.xDirectMessages) ? xRecoveryValue.xDirectMessages : []
        };

        const summaryRecords = [];
        const allMessageRows = [...messages, ...recoveredMessages];
        for (const friend of [...friends, ...recoveredFriends]) {
            const friendId = String(friend?.id || '');
            if (!friendId || summaryIds.has(friendId)) continue;
            const friendMessages = allMessageRows
                .filter((message) => String(message?.friendId || '') === friendId)
                .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
            const derived = friendMessages.length > 0
                ? await buildFriendMessageSummary(friendMessages)
                : {
                    lastMessagePreview: friend.lastMessagePreview || '',
                    lastMessageTimestamp: Number(friend.lastMessageTimestamp) || 0,
                    messageCount: Number(friend.messageCount) || 0
                };
            summaryRecords.push(normalizeChatSummary(friendId, {
                ...derived,
                unreadCount: friend.unreadCount
            }));
        }

        const now = Date.now();
        await withStore([
            STORES.appDomains,
            STORES.imFriends,
            STORES.imChatSummaries,
            STORES.imMessages,
            STORES.imMoments,
            STORES.imMomentMessages,
            STORES.imStickers,
            STORES.xPosts,
            STORES.xThreads,
            STORES.xDms,
            STORES.assets,
            STORES.meta
        ], 'readwrite', (stores) => {
            recoveredDomains.forEach(({ name, value }) => {
                const persistedValue = name === 'x'
                    ? persistXAssetsInTransaction(value, stores[STORES.assets])
                    : sanitizePersistentValue(cloneDeep(value));
                stores[STORES.appDomains].put({
                    name,
                    schemaVersion: STORAGE_SCHEMA_VERSION,
                    revision: 1,
                    updatedAt: now,
                    value: name === 'x' ? stripXCollections(persistedValue) : persistedValue
                });
            });
            [...friends, ...recoveredFriends].forEach((friend) => {
                const nextFriend = sanitizePersistentValue(cloneDeep(friend));
                delete nextFriend.messages;
                delete nextFriend.lastMessagePreview;
                delete nextFriend.lastMessageTimestamp;
                delete nextFriend.messageCount;
                delete nextFriend.unreadCount;
                stores[STORES.imFriends].put(nextFriend);
            });
            summaryRecords.forEach((summary) => stores[STORES.imChatSummaries].put(summary));
            recoveredMessages.forEach((message) => stores[STORES.imMessages].put(message));
            recoveredMoments.forEach((moment) => stores[STORES.imMoments].put(moment));
            recoveredMomentMessages.forEach((message) => stores[STORES.imMomentMessages].put(message));
            recoveredStickers.forEach((category) => stores[STORES.imStickers].put(category));
            if (currentImessageDomain) {
                stores[STORES.appDomains].put({
                    ...currentImessageDomain,
                    schemaVersion: STORAGE_SCHEMA_VERSION,
                    revision: Math.max(0, Number(currentImessageDomain.revision) || 0) + 1,
                    updatedAt: now,
                    value: {
                        uiState: cloneDeep(currentImessageDomain.value?.uiState && typeof currentImessageDomain.value.uiState === 'object'
                            ? currentImessageDomain.value.uiState
                            : {})
                    }
                });
            }
            if (coverRecoveryValue !== undefined) {
                stores[STORES.meta].put({ key: META_KEYS.imMomentsCoverAssetId, value: coverRecoveryValue });
            }

            const persistedX = persistXAssetsInTransaction(mergedXRecovery, stores[STORES.assets]);
            (persistedX.xGeneratedPosts || []).forEach((post) => {
                if (post?.id != null && !xPostIds.has(String(post.id))) stores[STORES.xPosts].put(sanitizePersistentValue(post));
            });
            Object.entries(persistedX.xPostThreads || {}).forEach(([postId, value]) => {
                if (!xThreadIds.has(String(postId))) stores[STORES.xThreads].put({ postId: String(postId), value: sanitizePersistentValue(value) });
            });
            (persistedX.xDirectMessages || []).forEach((dm, index) => {
                const id = String(dm?.id ?? dm?.charId ?? `x-dm-${index}`);
                if (!xDmIds.has(id)) stores[STORES.xDms].put({ ...sanitizePersistentValue(dm), id, updatedAt: Number(dm?.updatedAt) || now });
            });
        });
        if (currentImessageDomain) {
            domainCache.set('imessage', {
                uiState: cloneDeep(currentImessageDomain.value?.uiState && typeof currentImessageDomain.value.uiState === 'object'
                    ? currentImessageDomain.value.uiState
                    : {})
            });
        }

        const [verifiedDomains, verifiedMessages, verifiedXPosts] = await Promise.all([
            getAllRecords(STORES.appDomains),
            getAllRecords(STORES.imMessages),
            getAllRecords(STORES.xPosts)
        ]);
        const verifiedDomainNames = new Set(verifiedDomains.map((row) => String(row?.name || '')));
        const verifiedMessageIds = new Set(verifiedMessages.map((row) => String(row?.id || '')));
        const verifiedXPostIds = new Set(verifiedXPosts.map((row) => String(row?.id || '')));
        if (recoveredDomains.some(({ name }) => !verifiedDomainNames.has(name))) throw new Error('Domain recovery verification failed.');
        if (recoveredMessages.some((message) => !verifiedMessageIds.has(String(message.id)))) throw new Error('Message recovery verification failed.');
        if ((mergedXRecovery.xGeneratedPosts || []).some((post) => post?.id != null && !verifiedXPostIds.has(String(post.id)))) {
            throw new Error('X post recovery verification failed.');
        }

        const cleanedImessageDomainBytes = currentImessageDomain
            ? measureRecordBytes({ value: { uiState: currentImessageDomain.value?.uiState || {} } })
            : 0;
        const legacyImessageBytes = currentImessageDomain
            ? Math.max(0, measureRecordBytes(currentImessageDomain) - cleanedImessageDomainBytes)
            : 0;
        const redundantBytes = checkpoints.reduce((sum, row) => sum + measureRecordBytes(row), 0)
            + (oldAppStateRecord ? measureRecordBytes(oldAppStateRecord) : 0)
            + legacyImessageBytes;
        await withStore([STORES.storageCheckpoints, STORES.settings, STORES.meta], 'readwrite', (stores) => {
            stores[STORES.storageCheckpoints].clear();
            stores[STORES.settings].delete('appState');
            stores[STORES.meta].put({ key: META_KEYS.schemaVersion, value: STORAGE_SCHEMA_VERSION });
        });
        const mediaRecordsDeduplicated = await deduplicateStoredImessageAssets();
        const orphanAssetsRemoved = await pruneOrphanedAssets();
        const after = await getStorageBreakdown({ skipReady: true });
        const report = {
            schemaVersion: STORAGE_SCHEMA_VERSION,
            compactedAt: Date.now(),
            checkpointRecordsDeleted: checkpoints.length,
            legacyAppStateDeleted: !!oldAppStateRecord,
            domainsRecovered: recoveredDomains.length,
            friendsRecovered: recoveredFriends.length,
            messagesRecovered: recoveredMessages.length,
            momentsRecovered: recoveredMoments.length,
            stickersRecovered: recoveredStickers.length,
            summariesCreated: summaryRecords.length,
            legacyImessageBytesRemoved: legacyImessageBytes,
            mediaRecordsDeduplicated,
            xPostsRecovered: Math.max(0, verifiedXPosts.length - xPosts.length),
            orphanAssetsRemoved,
            estimatedBytesFreed: Math.max(redundantBytes, before.indexedDbBytes - after.indexedDbBytes),
            beforeIndexedDbBytes: before.indexedDbBytes,
            afterIndexedDbBytes: after.indexedDbBytes
        };
        await setMeta('storage_compacted_v8', report);
        await setMeta('storage_last_compaction', report);
        storageHealthState.lastCompaction = cloneDeep(report);
        return cloneDeep(report);
    }

    async function clearSafeCache(options = {}) {
        if (!options.skipReady && storageReadyPromise) await storageReadyPromise;
        const progressCallback = typeof options.progressCallback === 'function' ? options.progressCallback : null;
        storageHealthState.status = 'saving';
        storageHealthState.lastError = null;
        notifyStorageSubscribers({ ...storageHealthState, reason: 'cache-cleanup-start' });

        try {
            reportProgress(progressCallback, '正在完成待保存数据...', 10);
            const flushed = await flushPendingWrites();
            if (!flushed) throw new Error('Pending writes could not be completed before cache cleanup.');

            const before = await getStorageBreakdown({ skipReady: true });
            reportProgress(progressCallback, '正在校验并清理重复数据...', 35);
            const compaction = await compactStorage({ skipReady: true, force: true });

            reportProgress(progressCallback, '正在清理可重新下载的页面缓存...', 72);
            const cacheResults = await clearBrowserCaches();
            const cachesDeleted = cacheResults.filter((item) => item?.deleted).length;
            const cacheDeleteFailures = cacheResults.filter((item) => !item?.deleted).length;

            reportProgress(progressCallback, '正在重新统计空间...', 90);
            const after = await getStorageBreakdown({ skipReady: true });
            const cacheBytesBefore = Math.max(0, Number(before.usageDetails?.caches) || 0);
            const cacheBytesAfter = Math.max(0, Number(after.usageDetails?.caches) || 0);
            const browserCacheBytesFreed = cacheResults.length > 0 && cacheDeleteFailures === 0
                ? Math.max(cacheBytesBefore, cacheBytesBefore - cacheBytesAfter)
                : Math.max(0, cacheBytesBefore - cacheBytesAfter);
            const estimateDelta = Math.max(0, before.originUsage - after.originUsage);
            const report = {
                clearedAt: Date.now(),
                cacheEntriesFound: cacheResults.length,
                cachesDeleted,
                cacheDeleteFailures,
                checkpointRecordsDeleted: Number(compaction?.checkpointRecordsDeleted) || 0,
                orphanAssetsRemoved: Number(compaction?.orphanAssetsRemoved) || 0,
                estimatedBytesFreed: Math.max(
                    estimateDelta,
                    (Number(compaction?.estimatedBytesFreed) || 0) + browserCacheBytesFreed
                ),
                beforeUsage: before.originUsage,
                afterUsage: after.originUsage
            };
            await setMeta('storage_last_cache_cleanup', report);
            storageHealthState.status = cacheDeleteFailures > 0 ? 'error' : 'saved';
            storageHealthState.lastError = cacheDeleteFailures > 0
                ? `${cacheDeleteFailures} browser cache item(s) could not be deleted.`
                : null;
            storageHealthState.lastCacheCleanup = cloneDeep(report);
            notifyStorageSubscribers({ ...storageHealthState, reason: 'cache-cleanup-complete' });
            reportProgress(progressCallback, '缓存清理完成', 100);
            return cloneDeep(report);
        } catch (error) {
            storageHealthState.status = 'error';
            storageHealthState.lastError = error?.message || String(error);
            notifyStorageSubscribers({ ...storageHealthState, reason: 'cache-cleanup-error' });
            throw error;
        }
    }

    async function optimizeStorage(options = {}) {
        if (!options.skipReady && storageReadyPromise) await storageReadyPromise;
        const progressCallback = typeof options.progressCallback === 'function' ? options.progressCallback : null;
        storageHealthState.status = 'saving';
        storageHealthState.lastError = null;
        notifyStorageSubscribers({ ...storageHealthState, reason: 'storage-optimization-start' });
        let shadowDb = null;
        try {
            reportProgress(progressCallback, '正在完成待保存数据...', 4);
            if (!await flushPendingWrites()) throw new Error('Pending writes could not be completed before optimization.');
            await compactStorage({ skipReady: true, force: true });
            const before = await getStorageBreakdown({ skipReady: true });
            const availableBytes = before.quota > 0 ? Math.max(0, before.quota - before.originUsage) : Number.POSITIVE_INFINITY;
            const requiredBytes = Math.max(8 * 1024 * 1024, Math.ceil(before.logicalBytes * 1.15));
            if (availableBytes < requiredBytes) {
                throw new DOMException(
                    `Safe optimization needs about ${formatBytes(requiredBytes)} of free temporary space.`,
                    'QuotaExceededError'
                );
            }

            await deleteDatabaseSafe(OPTIMIZATION_SHADOW_DB_NAME);
            shadowDb = await createDbConnection(OPTIMIZATION_SHADOW_DB_NAME);
            const mainDb = await openDb();
            const optimizationId = `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            reportProgress(progressCallback, '正在创建安全影子数据库...', 10);
            const signatures = await copyDatabaseContents(mainDb, shadowDb, progressCallback, 10, 42);
            await setConnectionMeta(shadowDb, 'optimization_shadow_ready', {
                optimizationId,
                createdAt: Date.now(),
                signatures
            });

            try {
                mainDb.close();
            } catch (error) {}
            dbPromise = null;
            reportProgress(progressCallback, '正在重建主数据库...', 56);
            const deleted = await deleteDatabaseSafe(DB_NAME);
            if (!deleted.deleted) {
                throw new Error(deleted.reason === 'blocked'
                    ? '数据库正被其他页面占用，请关闭本项目的其他标签页后重试。'
                    : `Main database could not be rebuilt: ${deleted.reason}`);
            }

            const rebuiltDb = await openDb();
            await copyDatabaseContents(shadowDb, rebuiltDb, progressCallback, 58, 36);
            await setConnectionMeta(rebuiltDb, 'optimization_restore_complete', {
                optimizationId,
                restoredAt: Date.now()
            });
            shadowDb.close();
            shadowDb = null;
            await deleteDatabaseSafe(OPTIMIZATION_SHADOW_DB_NAME);
            const after = await getStorageBreakdown({ skipReady: true });
            const report = {
                optimizedAt: Date.now(),
                compactedAt: Date.now(),
                optimizationId,
                logicalBytesBefore: before.logicalBytes,
                logicalBytesAfter: after.logicalBytes,
                browserUsageBefore: before.originUsage,
                browserUsageAfter: after.originUsage,
                estimatedBytesFreed: Math.max(0, before.originUsage - after.originUsage),
                databaseOverheadBefore: before.databaseOverheadBytes,
                databaseOverheadAfter: after.databaseOverheadBytes,
                verifiedStores: Object.keys(signatures).length
            };
            await setMeta('storage_last_optimization', report);
            storageHealthState.status = 'saved';
            storageHealthState.lastCompaction = cloneDeep(report);
            notifyStorageSubscribers({ ...storageHealthState, reason: 'storage-optimization-complete' });
            reportProgress(progressCallback, '存储优化完成', 100);
            return cloneDeep(report);
        } catch (error) {
            try {
                if (shadowDb) shadowDb.close();
            } catch (closeError) {}
            storageHealthState.status = 'error';
            storageHealthState.lastError = error?.message || String(error);
            notifyStorageSubscribers({ ...storageHealthState, reason: 'storage-optimization-error' });
            throw error;
        }
    }

    async function recoverOptimizationShadowIfNeeded() {
        const shadow = await openExistingShadowDatabase();
        if (!shadow) return false;
        const mainDb = await openDb();
        const currentMarker = await new Promise((resolve, reject) => {
            const request = mainDb.transaction(STORES.meta, 'readonly').objectStore(STORES.meta).get('optimization_restore_complete');
            request.onsuccess = () => resolve(request.result?.value || null);
            request.onerror = () => reject(request.error);
        });
        if (!currentMarker || currentMarker.optimizationId !== shadow.marker.optimizationId) {
            await copyDatabaseContents(shadow.db, mainDb, null);
            await setConnectionMeta(mainDb, 'optimization_restore_complete', {
                optimizationId: shadow.marker.optimizationId,
                restoredAt: Date.now()
            });
        }
        shadow.db.close();
        await deleteDatabaseSafe(OPTIMIZATION_SHADOW_DB_NAME);
        return true;
    }

    async function initializeUnifiedStorage() {
        storageHealthState.status = 'initializing';
        await recoverOptimizationShadowIfNeeded();
        const existingDomains = await getAllRecords(STORES.appDomains);

        if (existingDomains.length === 0) {
            const [settingRows, appStateRecord, accountsRecord] = await Promise.all([
                getAllRecords(STORES.settings),
                getRecord(STORES.settings, 'appState'),
                getRecord(STORES.accounts, '__all__')
            ]);
            const durableAppState = appStateRecord && appStateRecord.value && typeof appStateRecord.value === 'object'
                ? appStateRecord.value
                : null;
            const appStateSource = durableAppState || {};
            const settingsValue = {};
            settingRows.forEach((row) => {
                if (!row || row.key === 'appState') return;
                settingsValue[row.key] = cloneDeep(row.value);
            });
            if (Array.isArray(accountsRecord?.value)) settingsValue.accounts = cloneDeep(accountsRecord.value);

            const domainValues = {
                ...Object.fromEntries(Object.entries(appStateSource).map(([name, value]) => [name, cloneDeep(value)])),
                settings: settingsValue,
                legacy: {}
            };
            const now = Date.now();
            await withStore([
                STORES.appDomains,
                STORES.xPosts,
                STORES.xThreads,
                STORES.xDms,
                STORES.assets,
                STORES.meta
            ], 'readwrite', async (stores) => {
                for (const [name, rawValue] of Object.entries(domainValues)) {
                    const value = sanitizePersistentValue(cloneDeep(rawValue));
                    const persistedValue = name === 'x'
                        ? persistXAssetsInTransaction(value, stores[STORES.assets])
                        : value;
                    const storedValue = name === 'x' ? stripXCollections(persistedValue) : persistedValue;
                    stores[STORES.appDomains].put({
                        name,
                        schemaVersion: STORAGE_SCHEMA_VERSION,
                        revision: 1,
                        updatedAt: now,
                        value: storedValue
                    });
                    if (name === 'x') {
                        await replaceCollectionRecords(stores[STORES.xPosts], persistedValue.xGeneratedPosts || [], 'id');
                        const threadRows = Object.entries(persistedValue.xPostThreads || {}).map(([postId, threadValue]) => ({ postId, value: threadValue }));
                        await replaceCollectionRecords(stores[STORES.xThreads], threadRows, 'postId');
                        const dmRows = (persistedValue.xDirectMessages || []).map((item, index) => ({
                            ...item,
                            id: String(item?.id ?? item?.charId ?? `x-dm-${index}`),
                            updatedAt: Number(item?.updatedAt) || now
                        }));
                        await replaceCollectionRecords(stores[STORES.xDms], dmRows, 'id');
                    }
                }
                stores[STORES.meta].put({ key: META_KEYS.schemaVersion, value: STORAGE_SCHEMA_VERSION });
                stores[STORES.meta].put({ key: 'unified_storage_migrated_at', value: now });
            });
        }

        storageHealthState.lastCompaction = await compactStorage({ skipReady: true });
        storageHealthState.lastCacheCleanup = await getMeta('storage_last_cache_cleanup');

        const hydratedDomains = await getAllRecords(STORES.appDomains);
        for (const record of hydratedDomains) {
            if (!record?.name) continue;
            const value = record.name === 'x' ? await hydrateXDomain(record.value) : record.value;
            domainCache.set(String(record.name), cloneDeep(value));
        }

        storageHealthState.status = 'saved';
        storageHealthState.migrationVersion = STORAGE_SCHEMA_VERSION;
        storageHealthState.lastError = null;
        try {
            if (navigator.storage?.persist) await navigator.storage.persist();
        } catch (error) {}
        notifyStorageSubscribers({ ...storageHealthState });
        try {
            window.dispatchEvent(new CustomEvent('u2-storage-ready'));
        } catch (error) {}
        return true;
    }

    const LEGACY_SETTING_KEY_MAP = {
        u2_userState: 'userState',
        u2_apiConfig: 'apiConfig',
        u2_minimaxConfig: 'minimaxConfig',
        u2_apiPresets: 'apiPresets',
        u2_fetchedModels: 'fetchedModels',
        u2_assistiveBallSettings: 'assistiveBallSettings',
        u2_accounts: 'accounts',
        u2_currentAccountId: 'currentAccountId',
        u2_themeState: 'themeState',
        u2_worldBooks: 'worldBooks',
        u2_wbGroups: 'wbGroups'
    };

    function loadLegacyKey(key, fallbackValue = null) {
        const safeKey = String(key || '');
        const mappedKey = LEGACY_SETTING_KEY_MAP[safeKey];
        const settings = readDomain('settings', {});
        if (mappedKey) {
            return Object.prototype.hasOwnProperty.call(settings || {}, mappedKey)
                ? cloneDeep(settings[mappedKey])
                : cloneDeep(fallbackValue);
        }
        const legacy = readDomain('legacy', {});
        if (Object.prototype.hasOwnProperty.call(legacy || {}, safeKey)) return cloneDeep(legacy[safeKey]);
        return cloneDeep(fallbackValue);
    }

    function saveLegacyKey(key, value) {
        const safeKey = String(key || '');
        const mappedKey = LEGACY_SETTING_KEY_MAP[safeKey];
        const domainName = mappedKey ? 'settings' : 'legacy';
        const propertyName = mappedKey || safeKey;
        const optimistic = readDomain(domainName, {});
        optimistic[propertyName] = cloneDeep(value);
        domainCache.set(domainName, optimistic);
        return commitDomain(domainName, (draft) => {
            draft[propertyName] = cloneDeep(value);
            return draft;
        }, { reason: `legacy-key:${safeKey}` });
    }

    function removeLegacyKey(key) {
        const safeKey = String(key || '');
        const mappedKey = LEGACY_SETTING_KEY_MAP[safeKey];
        const domainName = mappedKey ? 'settings' : 'legacy';
        const propertyName = mappedKey || safeKey;
        const optimistic = readDomain(domainName, {});
        delete optimistic[propertyName];
        domainCache.set(domainName, optimistic);
        return commitDomain(domainName, (draft) => {
            delete draft[propertyName];
            return draft;
        }, { reason: `legacy-key-remove:${safeKey}` });
    }

    async function clearAllData() {
        try {
            clearRuntimeAssetCache();
        } catch (e) {}

        try {
            const db = await dbPromise;
            if (db) db.close();
        } catch (e) {}
        dbPromise = null;

        const result = await deleteDatabaseSafe(DB_NAME);
        return !!result.deleted;
    }

    async function clearAllPersistentData() {
        const authSession = await getAuthSession();
        try {
            clearRuntimeAssetCache();
        } catch (e) {}

        try {
            const db = await dbPromise;
            if (db) db.close();
        } catch (e) {}
        dbPromise = null;

        let sessionStorageCleared = false;

        try {
            sessionStorage.clear();
            sessionStorageCleared = true;
        } catch (e) {}

        const [currentDbResult, legacyDbResult, cacheResults, swResults] = await Promise.all([
            deleteDatabaseSafe(DB_NAME),
            deleteDatabaseSafe('iiso_imessage_storage'),
            clearBrowserCaches(),
            unregisterServiceWorkers()
        ]);
        if (authSession) await setAuthSession(authSession);

        return {
            runtimeCacheCleared: true,
            localStorageCleared: false,
            localStorageRemovedKeys: [],
            sessionStorageCleared,
            authSessionPreserved: !!authSession,
            databases: [currentDbResult, legacyDbResult],
            caches: cacheResults,
            serviceWorkers: swResults
        };
    }

    window.appStorage = {
        DB_NAME,
        STORES,
        openDb,
        withStore,
        requestToPromise,
        cloneDeep,
        dataUrlToBlob,
        blobToDataUrl,
        clearRuntimeAssetCache,
        pruneRuntimeAssetCache,
        measureRuntimeCacheUsage,
        formatBytes,
        getUsageSummary,
        saveAssetFromDataUrl,
        getAssetUrl,
        deleteAsset,
        getMeta,
        setMeta,
        getSetting,
        setSetting,
        getAuthSession,
        setAuthSession,
        clearAuthSession,
        waitForAuthStorage,
        saveGlobalData,
        loadGlobalData,
        collectBackupSnapshot,
        inspectBackupPayload,
        validateBackupPayload,
        exportAllData,
        importAllData,
        clearAllData,
        clearManagedPersistence,
        clearAllPersistentData,
        clearBrowserCaches,
        unregisterServiceWorkers,
        measureApproximateUsage,
        saveFriends,
        saveFriend,
        saveFriendMetaOnly,
        saveFriendMeta,
        patchFriendMeta,
        deleteFriend,
        loadFriends,
        saveFriendMessage,
        commitFriendMessage,
        saveChatSummary,
        deleteFriendMessage,
        deleteFriendMessages,
        saveFriendMessages,
        replaceFriendMessages,
        loadMessagesByFriendId,
        saveMoments,
        saveMoment,
        deleteMoment,
        loadMoments,
        saveMomentMessages,
        loadMomentMessages,
        saveStickers,
        loadStickers,
        saveMomentsCover,
        loadMomentsCoverUrl,
        loadLibraryBooks,
        loadLibraryBookContent,
        saveLibraryBook,
        deleteLibraryBook,
        loadLibraryPlaylists,
        loadLibraryTracks,
        saveLibraryPlaylistBundle,
        saveLibraryTrack,
        deleteLibraryTrack,
        deleteLibraryPlaylist,
        loadLibraryDailyStats,
        incrementLibraryDailyStat
    };

    Object.assign(window.appStorage, {
        readDomain,
        commitDomain,
        commitRecords,
        flushPendingWrites,
        getStorageHealth,
        getStorageBreakdown,
        compactStorage,
        clearSafeCache,
        optimizeStorage,
        pruneOrphanedAssets,
        subscribe,
        loadLegacyKey,
        saveLegacyKey,
        removeLegacyKey
    });
    Object.defineProperty(window.appStorage, 'ready', {
        enumerable: true,
        configurable: false,
        get() {
            return storageReadyPromise;
        }
    });

    Object.defineProperty(window.appStorage, 'authReady', {
        enumerable: true,
        configurable: false,
        get() {
            return waitForAuthStorage();
        }
    });

    storageReadyPromise = initializeUnifiedStorage().catch((error) => {
        storageHealthState.status = 'error';
        storageHealthState.lastError = error?.message || String(error);
        console.error('[appStorage] unified storage initialization failed', error);
        notifyStorageSubscribers({ ...storageHealthState });
        try {
            const overlay = document.createElement('div');
            overlay.id = 'u2-storage-fatal';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#f2f2f7;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui;color:#1c1c1e;';
            overlay.innerHTML = `<div style="max-width:420px;background:#fff;border-radius:18px;padding:22px;box-shadow:0 18px 50px rgba(0,0,0,.12)"><h2 style="margin:0 0 10px">存储初始化失败</h2><p style="line-height:1.55;margin:0 0 16px">为防止空数据覆盖原数据，应用已停止启动。请重试；若仍失败，请先导出浏览器站点数据。</p><pre style="white-space:pre-wrap;font-size:12px;color:#8e8e93">${String(error?.message || error).replace(/[<>]/g, '')}</pre><button type="button" style="border:0;border-radius:12px;background:#007aff;color:#fff;padding:11px 18px" onclick="location.reload()">重试</button></div>`;
            document.body.appendChild(overlay);
        } catch (overlayError) {}
        throw error;
    });

    const nativeDocumentAddEventListener = document.addEventListener.bind(document);
    document.addEventListener = function(type, listener, options) {
        if (type !== 'DOMContentLoaded' || typeof listener !== 'function') {
            return nativeDocumentAddEventListener(type, listener, options);
        }
        const wrappedListener = function(event) {
            storageReadyPromise.then(() => listener.call(this, event)).catch(() => {});
        };
        return nativeDocumentAddEventListener(type, wrappedListener, options);
    };
})();
