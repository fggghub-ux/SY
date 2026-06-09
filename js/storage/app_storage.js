// ==========================================
// APP STORAGE LAYER
// Unified IndexedDB repository for the whole project
// Mobile-first, no legacy migration retention
// ==========================================

(function() {
    const DB_NAME = 'iiso_app_storage';
    const DB_VERSION = 3;
    const STORAGE_SCHEMA_VERSION = 4;
    const BACKUP_APP_NAME = 'u2phone';
    const PERSISTENT_LOCALSTORAGE_EXCLUDE_PREFIXES = ['iiso_auth_'];
    const MANAGED_LOCALSTORAGE_EXACT_KEYS = new Set([
        'app_global_data',
        'ios_emulator_global_data',
        'shopping_bound_wb_id',
        'shopping_generated_food',
        'shopping_generated_mall',
        'shopping_comments',
        'shopping_qa',
        'shopping_orders',
        'shopping_cart'
    ]);
    const MANAGED_LOCALSTORAGE_PREFIXES = ['u2_', 'shopping_'];

    const STORES = {
        meta: 'meta',
        settings: 'settings',
        accounts: 'accounts',
        appState: 'app_state',
        theme: 'theme',
        worldbooks: 'worldbooks',
        assets: 'assets',
        imFriends: 'im_friends',
        imMessages: 'im_messages',
        imMoments: 'im_moments',
        imMomentMessages: 'im_moment_messages',
        imStickers: 'im_stickers'
    };

    const META_KEYS = {
        schemaVersion: 'schema_version',
        appVersion: 'app_version',
        imMomentsCoverAssetId: 'im_moments_cover_asset_id'
    };

    const runtimeBlobUrls = new Map();
    const runtimeBlobUrlAccess = new Map();
    const MAX_RUNTIME_BLOB_URLS = 120;
    let dbPromise = null;

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

    function isExcludedLocalStorageKey(key) {
        return PERSISTENT_LOCALSTORAGE_EXCLUDE_PREFIXES.some((prefix) => String(key || '').startsWith(prefix));
    }

    function isManagedLocalStorageKey(key) {
        const safeKey = String(key || '');
        if (!safeKey || isExcludedLocalStorageKey(safeKey)) return false;
        if (MANAGED_LOCALSTORAGE_EXACT_KEYS.has(safeKey)) return true;
        return MANAGED_LOCALSTORAGE_PREFIXES.some((prefix) => safeKey.startsWith(prefix));
    }

    function setLocalStorageRaw(key, value) {
        if (!key || isExcludedLocalStorageKey(key)) return;
        localStorage.setItem(String(key), String(value ?? ''));
    }

    function setLocalStorageJson(key, value) {
        setLocalStorageRaw(key, JSON.stringify(value));
    }

    function collectManagedLocalStorageSnapshot() {
        const rows = [];
        if (!window.localStorage) return rows;

        const keys = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (isManagedLocalStorageKey(key)) keys.push(key);
        }

        keys.sort().forEach((key) => {
            rows.push({
                key,
                value: localStorage.getItem(key)
            });
        });

        return rows;
    }

    function clearManagedLocalStorage() {
        if (!window.localStorage) return [];
        const removedKeys = [];
        const keys = [];

        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (isManagedLocalStorageKey(key)) keys.push(key);
        }

        keys.forEach((key) => {
            localStorage.removeItem(key);
            removedKeys.push(key);
        });

        return removedKeys;
    }

    function restoreManagedLocalStorageSnapshot(snapshot = []) {
        if (!window.localStorage) return 0;
        const rows = Array.isArray(snapshot) ? snapshot : [];
        let restored = 0;

        rows.forEach((row) => {
            if (!row || !isManagedLocalStorageKey(row.key)) return;
            setLocalStorageRaw(row.key, row.value);
            restored += 1;
        });

        return restored;
    }

    function getLocalStorageSnapshotValue(snapshot = [], key) {
        const row = Array.isArray(snapshot)
            ? snapshot.find((item) => item && item.key === key)
            : null;
        return row ? row.value : undefined;
    }

    function parseLocalStorageSnapshotJson(snapshot = [], key) {
        const rawValue = getLocalStorageSnapshotValue(snapshot, key);
        if (rawValue === undefined || rawValue === null || rawValue === '') return undefined;

        try {
            return JSON.parse(rawValue);
        } catch (error) {
            console.warn(`Failed to parse localStorage backup key "${key}":`, error);
            return undefined;
        }
    }

    function hasLocalStorageSnapshotKey(snapshot = [], key) {
        return Array.isArray(snapshot) && snapshot.some((item) => item && item.key === key);
    }

    function upsertBackupSettingRecord(storesData, key, value) {
        if (value === undefined) return;
        if (!Array.isArray(storesData[STORES.settings])) storesData[STORES.settings] = [];

        const existing = storesData[STORES.settings].find((record) => record && record.key === key);
        if (existing) {
            existing.value = cloneDeep(value);
        } else {
            storesData[STORES.settings].push({ key, value: cloneDeep(value) });
        }
    }

    function mergeLocalStorageCompatibilityIntoStores(storesData = {}, localStorageSnapshot = []) {
        const localStorageSettingsMap = {
            u2_userState: 'userState',
            u2_apiConfig: 'apiConfig',
            u2_minimaxConfig: 'minimaxConfig',
            u2_apiPresets: 'apiPresets',
            u2_fetchedModels: 'fetchedModels',
            u2_assistiveBallSettings: 'assistiveBallSettings',
            u2_themeState: 'themeState',
            u2_currentAccountId: 'currentAccountId',
            u2_wbGroups: 'wbGroups',
            u2_worldBooks: 'worldBooks',
            u2_appState: 'appState'
        };

        Object.entries(localStorageSettingsMap).forEach(([storageKey, settingKey]) => {
            const value = parseLocalStorageSnapshotJson(localStorageSnapshot, storageKey);
            if (value !== undefined) upsertBackupSettingRecord(storesData, settingKey, value);
        });

        const accounts = parseLocalStorageSnapshotJson(localStorageSnapshot, 'u2_accounts');
        if (Array.isArray(accounts)) {
            if (!Array.isArray(storesData[STORES.accounts])) storesData[STORES.accounts] = [];
            const existing = storesData[STORES.accounts].find((record) => record && record.id === '__all__');
            if (existing) {
                existing.value = cloneDeep(accounts);
            } else {
                storesData[STORES.accounts].push({ id: '__all__', value: cloneDeep(accounts) });
            }
        }
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

    function createDbConnection() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB is not supported in this browser.'));
                return;
            }

            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

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

                if (!db.objectStoreNames.contains(STORES.imFriends)) {
                    db.createObjectStore(STORES.imFriends, { keyPath: 'id' });
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
        return putRecord(STORES.settings, { key, value: cloneDeep(value) });
    }

    async function saveAssetFromDataUrl(assetId, dataUrl, extra = {}) {
        if (!assetId || !isDataUrl(dataUrl)) return null;
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
            content: typeof safe.content === 'string' ? safe.content : '',
            text: typeof safe.text === 'string' ? safe.text : '',
            transcript: typeof safe.transcript === 'string' ? safe.transcript : '',
            stickerCategory: typeof safe.stickerCategory === 'string' ? safe.stickerCategory : '',
            stickerName: typeof safe.stickerName === 'string' ? safe.stickerName : '',
            stickerUrl: typeof safe.stickerUrl === 'string' ? safe.stickerUrl : '',
            translation: typeof safe.translation === 'string' ? safe.translation : '',
            showTranslation: !!safe.showTranslation,
            replyTo: safe.replyTo || null,
            offlineMode: !!safe.offlineMode,
            offlineScene: typeof safe.offlineScene === 'string' ? safe.offlineScene : '',
            offlineAction: typeof safe.offlineAction === 'string' ? safe.offlineAction : '',
            timestamp: Number(safe.timestamp) || Date.now(),
            amount: safe.amount,
            description: safe.description,
            targetName: safe.targetName,
            payKind: safe.payKind,
            speaker: safe.speaker,
            senderName: safe.senderName,
            senderAvatarUrl: safe.senderAvatarUrl,
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
            packetId: safe.packetId,
            totalAmount: safe.totalAmount,
            claimRecords: safe.claimRecords,
            claimedMemberIds: safe.claimedMemberIds,
            speakerMemberId: safe.speakerMemberId,
            payload: safe.payload || null
        };
    }

    function denormalizeMessageRecord(row) {
        return {
            id: row.id,
            role: row.role,
            type: row.type,
            content: row.content,
            text: row.text,
            transcript: row.transcript,
            stickerCategory: row.stickerCategory,
            stickerName: row.stickerName,
            stickerUrl: row.stickerUrl,
            translation: row.translation,
            showTranslation: row.showTranslation,
            replyTo: row.replyTo,
            offlineMode: !!row.offlineMode,
            offlineScene: row.offlineScene || '',
            offlineAction: row.offlineAction || '',
            timestamp: row.timestamp,
            amount: row.amount,
            description: row.description,
            targetName: row.targetName,
            payKind: row.payKind,
            speaker: row.speaker,
            senderName: row.senderName,
            senderAvatarUrl: row.senderAvatarUrl,
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
            packetId: row.packetId,
            totalAmount: row.totalAmount,
            claimRecords: row.claimRecords,
            claimedMemberIds: row.claimedMemberIds,
            speakerMemberId: row.speakerMemberId,
            payload: row.payload,
            __messageOrder: Number(row.order) || 0
        };
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
        const result = { ...friend };

        for (const [urlField, assetField] of FRIEND_ASSET_FIELDS) {
            const currentValue = result[urlField];
            if (isDataUrl(currentValue)) {
                const assetId = result[assetField] || buildAssetId('friend', result.id, urlField);
                await saveAssetFromDataUrl(assetId, currentValue, {
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

        return result;
    }

    async function hydrateFriendAssets(friend) {
        if (!friend) return friend;
        const result = { ...friend };
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

        return result;
    }

    function collectFriendAssetIds(friend) {
        if (!friend) return [];
        return Array.from(new Set(
            FRIEND_ASSET_FIELDS
                .map(([, assetField]) => friend[assetField] ? String(friend[assetField]) : null)
                .filter(Boolean)
        ));
    }

    function getExpectedFriendAssetIds(friend) {
        if (!friend || friend.id == null) return [];
        return Array.from(new Set(
            FRIEND_ASSET_FIELDS
                .map(([urlField, assetField]) => {
                    if (friend[assetField]) return String(friend[assetField]);
                    if (isDataUrl(friend[urlField])) return buildAssetId('friend', friend.id, urlField);
                    return null;
                })
                .filter(Boolean)
        ));
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
            await deleteAsset(assetId);
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
        meta.lastMessagePreview = messageSummary.lastMessagePreview;
        meta.lastMessageTimestamp = messageSummary.lastMessageTimestamp;
        meta.messageCount = messageSummary.messageCount;
        meta.unreadCount = Math.max(0, Number(prepared.unreadCount) || 0);

        return putRecord(STORES.imFriends, sanitizePersistentValue(meta));
    }

    async function saveFriendMessage(friendId, message, order = 0) {
        const safeFriendId = String(friendId);
        const normalized = normalizeMessageRecord(safeFriendId, {
            ...(message || {}),
            __messageOrder: resolveMessageOrder(message, order)
        }, order);

        await putRecord(STORES.imMessages, normalized);
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
        const normalizedList = list.map((msg, idx) => normalizeMessageRecord(safeFriendId, msg, idx));
        const nextMessageIds = new Set(normalizedList.map((msg) => String(msg.id)));

        return withStore([STORES.imMessages], 'readwrite', async (stores) => {
            const index = stores[STORES.imMessages].index('friendId');
            const range = IDBKeyRange.only(safeFriendId);
            const existingKeys = await requestToPromise(index.getAllKeys(range));

            existingKeys.forEach((messageId) => {
                if (!nextMessageIds.has(String(messageId))) {
                    stores[STORES.imMessages].delete(messageId);
                }
            });

            normalizedList.forEach((msg) => stores[STORES.imMessages].put(msg));
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

    async function deleteFriend(friendId) {
        if (friendId == null) return false;
        const previousFriend = await getFriendMetaById(friendId);
        await saveFriendMessages(friendId, []);
        await deleteFriendMetaById(friendId);
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
                return orderedRows.map(denormalizeMessageRecord);
            }

            const timeIndex = messageStore.index('friendId_timestamp');
            const timeRange = IDBKeyRange.bound([safeFriendId, 0], [safeFriendId, Number.MAX_SAFE_INTEGER]);
            const rows = await requestToPromise(timeIndex.getAll(timeRange));
            return rows
                .sort((a, b) => {
                    if ((a.timestamp || 0) !== (b.timestamp || 0)) return (a.timestamp || 0) - (b.timestamp || 0);
                    return (a.order || 0) - (b.order || 0);
                })
                .map(denormalizeMessageRecord);
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
        const allFriends = await getAllRecords(STORES.imFriends);
        const hydrated = await Promise.all(
            allFriends.map(async (friend) => {
                const next = await hydrateFriendAssets(friend);
                next.messages = [];
                next.messagesLoaded = false;
                next.lastMessagePreview = typeof next.lastMessagePreview === 'string' ? next.lastMessagePreview : '';
                next.lastMessageTimestamp = Number(next.lastMessageTimestamp) || 0;
                next.messageCount = Number(next.messageCount) || 0;
                next.unreadCount = Math.max(0, Number(next.unreadCount) || 0);
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
            await deleteAsset(assetId);
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
        const normalizedStickers = safeStickers.map((category) => ({
            ...category,
            categoryName: String(category.categoryName)
        }));
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
        return getAllRecords(STORES.imStickers);
    }

    async function saveMomentsCover(dataUrlOrUrl) {
        if (!dataUrlOrUrl) {
            const oldAssetId = await getMeta(META_KEYS.imMomentsCoverAssetId);
            if (oldAssetId && typeof oldAssetId === 'string') await deleteAsset(oldAssetId);
            await setMeta(META_KEYS.imMomentsCoverAssetId, null);
            return null;
        }

        if (isDataUrl(dataUrlOrUrl)) {
            const assetId = 'im_moments_cover_me';
            await saveAssetFromDataUrl(assetId, dataUrlOrUrl, {
                ownerType: 'im_moments',
                ownerId: 'me',
                field: 'momentsCover'
            });
            await setMeta(META_KEYS.imMomentsCoverAssetId, assetId);
            return assetId;
        }

        await setMeta(META_KEYS.imMomentsCoverAssetId, { externalUrl: dataUrlOrUrl });
        return dataUrlOrUrl;
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
                        : 0.72
                }
                : { enabled: false, x: null, y: null, opacity: 0.72 },
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
            setSetting('appState', normalized.appState),
            putRecord(STORES.accounts, { id: '__all__', value: cloneDeep(normalized.accounts) }),
            setMeta(META_KEYS.schemaVersion, STORAGE_SCHEMA_VERSION)
        ]);

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

        return {
            ...normalizeGlobalPayload({
                userState,
                accounts: accountsRecord && Array.isArray(accountsRecord.value) ? accountsRecord.value : [],
                currentAccountId,
                apiConfig,
                apiPresets,
                fetchedModels,
                assistiveBallSettings,
                themeState,
                wbGroups,
                worldBooks,
                appState
            }),
            storageSchemaVersion: Number(storedSchemaVersion) || 0
        };
    }

    async function exportAllData(progressCallback) {
        if (progressCallback) progressCallback({ message: '准备导出数据...', progress: 0 });
        
        const chunks = [];
        chunks.push(`{"version": ${STORAGE_SCHEMA_VERSION}, "exportedAt": ${Date.now()}, "stores": {`);

        const storeNames = Object.values(STORES);
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
            
            let globalDataForLocalStorage = {};
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
                
                if (storeName === STORES.settings) {
                    records.forEach(record => {
                        if (record && record.key) {
                            globalDataForLocalStorage[record.key] = record.value;
                        }
                    });
                }
            }
            
            if (progressCallback) progressCallback({ message: '同步本地缓存...', progress: 95 });

            try {
                const lsKeys = {
                    'userState': 'u2_userState',
                    'apiConfig': 'u2_apiConfig',
                    'minimaxConfig': 'u2_minimaxConfig',
                    'apiPresets': 'u2_apiPresets',
                    'fetchedModels': 'u2_fetchedModels',
                    'assistiveBallSettings': 'u2_assistiveBallSettings',
                    'themeState': 'u2_themeState',
                    'currentAccountId': 'u2_currentAccountId'
                };
                for (const [memKey, lsKey] of Object.entries(lsKeys)) {
                    if (globalDataForLocalStorage[memKey] !== undefined) {
                        if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                            StorageManager.save(lsKey, globalDataForLocalStorage[memKey]);
                        } else {
                            localStorage.setItem(lsKey, JSON.stringify(globalDataForLocalStorage[memKey]));
                        }
                    }
                }
                if (storesData[STORES.accounts]) {
                    const accountsRecord = storesData[STORES.accounts].find(r => r.id === '__all__');
                    if (accountsRecord && accountsRecord.value) {
                        if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                            StorageManager.save('u2_accounts', accountsRecord.value);
                        } else {
                            localStorage.setItem('u2_accounts', JSON.stringify(accountsRecord.value));
                        }
                    }
                }
            } catch (e) {
                console.warn('Failed to sync imported data to localStorage:', e);
            }
        } else {
            const safe = payload && typeof payload === 'object' ? payload : {};
            const globalData = safe.globalData || {};
            await saveGlobalData(globalData);

            try {
                if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                    if (globalData.userState) StorageManager.save('u2_userState', globalData.userState);
                    if (globalData.apiConfig) StorageManager.save('u2_apiConfig', globalData.apiConfig);
                    if (globalData.minimaxConfig) StorageManager.save('u2_minimaxConfig', globalData.minimaxConfig);
                    if (globalData.apiPresets) StorageManager.save('u2_apiPresets', globalData.apiPresets);
                    if (globalData.fetchedModels) StorageManager.save('u2_fetchedModels', globalData.fetchedModels);
                    if (globalData.assistiveBallSettings) StorageManager.save('u2_assistiveBallSettings', globalData.assistiveBallSettings);
                    if (globalData.accounts) StorageManager.save('u2_accounts', globalData.accounts);
                    if (globalData.currentAccountId !== undefined) StorageManager.save('u2_currentAccountId', globalData.currentAccountId);
                    if (globalData.themeState) StorageManager.save('u2_themeState', globalData.themeState);
                } else {
                    if (globalData.userState) localStorage.setItem('u2_userState', JSON.stringify(globalData.userState));
                    if (globalData.apiConfig) localStorage.setItem('u2_apiConfig', JSON.stringify(globalData.apiConfig));
                    if (globalData.minimaxConfig) localStorage.setItem('u2_minimaxConfig', JSON.stringify(globalData.minimaxConfig));
                    if (globalData.apiPresets) localStorage.setItem('u2_apiPresets', JSON.stringify(globalData.apiPresets));
                    if (globalData.fetchedModels) localStorage.setItem('u2_fetchedModels', JSON.stringify(globalData.fetchedModels));
                    if (globalData.assistiveBallSettings) localStorage.setItem('u2_assistiveBallSettings', JSON.stringify(globalData.assistiveBallSettings));
                    if (globalData.accounts) localStorage.setItem('u2_accounts', JSON.stringify(globalData.accounts));
                    if (globalData.currentAccountId !== undefined) localStorage.setItem('u2_currentAccountId', JSON.stringify(globalData.currentAccountId));
                    if (globalData.themeState) localStorage.setItem('u2_themeState', JSON.stringify(globalData.themeState));
                }
            } catch (e) {
                console.warn('Failed to sync imported data to localStorage:', e);
            }

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

        Object.values(STORES).forEach((storeName) => {
            const count = Array.isArray(storesData[storeName]) ? storesData[storeName].length : 0;
            storeStats[storeName] = count;
            recordCount += count;
        });

        if (Array.isArray(storesData[STORES.assets])) {
            assetCount = storesData[STORES.assets].length;
        }

        return {
            stores: storeStats,
            storeCount: Object.values(STORES).length,
            recordCount,
            assetCount,
            localStorageKeyCount: Array.isArray(localStorageSnapshot) ? localStorageSnapshot.length : 0,
            approximateBytes: estimateJsonBytes({ stores: storesData, localStorage: localStorageSnapshot })
        };
    }

    async function collectBackupSnapshot(progressCallback) {
        reportProgress(progressCallback, '准备导出数据...', 0);

        const storesData = {};
        const storeNames = Object.values(STORES);

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

        reportProgress(progressCallback, '读取本地兼容数据...', 86);
        const localStorageSnapshot = collectManagedLocalStorageSnapshot();
        mergeLocalStorageCompatibilityIntoStores(storesData, localStorageSnapshot);
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
            const storesData = {};
            Object.values(STORES).forEach((storeName) => {
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

        const localStorageRemovedKeys = clearManagedLocalStorage();

        try {
            sessionStorage.clear();
        } catch (e) {}

        const databaseDeleted = await clearAllData();
        return {
            databaseDeleted,
            localStorageRemovedKeys
        };
    }

    function syncCompatibilityLocalStorageFromStores(storesData = {}, restoredLocalStorageSnapshot = []) {
        if (!window.localStorage) return;

        const settingsRows = Array.isArray(storesData[STORES.settings]) ? storesData[STORES.settings] : [];
        const settingsByKey = {};
        settingsRows.forEach((record) => {
            if (record && record.key) settingsByKey[record.key] = record.value;
        });

        const compatibilityMap = {
            userState: 'u2_userState',
            apiConfig: 'u2_apiConfig',
            minimaxConfig: 'u2_minimaxConfig',
            apiPresets: 'u2_apiPresets',
            fetchedModels: 'u2_fetchedModels',
            assistiveBallSettings: 'u2_assistiveBallSettings',
            themeState: 'u2_themeState',
            currentAccountId: 'u2_currentAccountId',
            wbGroups: 'u2_wbGroups',
            worldBooks: 'u2_worldBooks',
            appState: 'u2_appState'
        };

        Object.entries(compatibilityMap).forEach(([settingKey, storageKey]) => {
            if (hasLocalStorageSnapshotKey(restoredLocalStorageSnapshot, storageKey)) return;
            if (settingsByKey[settingKey] !== undefined) {
                setLocalStorageJson(storageKey, settingsByKey[settingKey]);
            }
        });

        const accountsRows = Array.isArray(storesData[STORES.accounts]) ? storesData[STORES.accounts] : [];
        const accountsRecord = accountsRows.find((row) => row && row.id === '__all__');
        if (!hasLocalStorageSnapshotKey(restoredLocalStorageSnapshot, 'u2_accounts') && accountsRecord && Array.isArray(accountsRecord.value)) {
            setLocalStorageJson('u2_accounts', accountsRecord.value);
        }
    }

    function syncCompatibilityLocalStorageFromGlobalData(globalData = {}) {
        const map = {
            userState: 'u2_userState',
            apiConfig: 'u2_apiConfig',
            minimaxConfig: 'u2_minimaxConfig',
            apiPresets: 'u2_apiPresets',
            fetchedModels: 'u2_fetchedModels',
            assistiveBallSettings: 'u2_assistiveBallSettings',
            accounts: 'u2_accounts',
            currentAccountId: 'u2_currentAccountId',
            themeState: 'u2_themeState',
            wbGroups: 'u2_wbGroups',
            worldBooks: 'u2_worldBooks',
            appState: 'u2_appState'
        };

        Object.entries(map).forEach(([dataKey, storageKey]) => {
            if (globalData[dataKey] !== undefined) {
                setLocalStorageJson(storageKey, globalData[dataKey]);
            }
        });
    }

    async function restoreBackupSnapshot(snapshot = {}, progressCallback) {
        const storesData = snapshot.stores || {};
        const storeNames = Object.values(STORES);

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

        reportProgress(progressCallback, '恢复本地兼容数据...', 90);
        restoreManagedLocalStorageSnapshot(snapshot.localStorage);
        syncCompatibilityLocalStorageFromStores(storesData, snapshot.localStorage);
        reportProgress(progressCallback, '导入完成', 100);
        return true;
    }

    async function importLegacyBackupPayload(payload = {}, progressCallback) {
        const safe = payload && typeof payload === 'object' ? payload : {};
        const globalData = safe.globalData || {};

        reportProgress(progressCallback, '迁移旧格式全局数据...', 18);
        await saveGlobalData(globalData);
        syncCompatibilityLocalStorageFromGlobalData(globalData);

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
        try {
            clearRuntimeAssetCache();
        } catch (e) {}

        try {
            const db = await dbPromise;
            if (db) db.close();
        } catch (e) {}
        dbPromise = null;

        const localStorageRemovedKeys = [];
        let localStorageCleared = false;
        let sessionStorageCleared = false;

        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = localStorage.key(i);
                if (key != null) keys.push(key);
            }
            keys.forEach((key) => {
                const shouldKeep = PERSISTENT_LOCALSTORAGE_EXCLUDE_PREFIXES.some((prefix) => key.startsWith(prefix));
                if (shouldKeep) return;
                localStorageRemovedKeys.push(key);
                localStorage.removeItem(key);
            });
            localStorageCleared = true;
        } catch (error) {
            try {
                localStorage.removeItem('ios_emulator_global_data');
                localStorageRemovedKeys.push('ios_emulator_global_data');
            } catch (e) {}
        }

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

        return {
            runtimeCacheCleared: true,
            localStorageCleared,
            localStorageRemovedKeys,
            sessionStorageCleared,
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
        deleteFriend,
        loadFriends,
        saveFriendMessage,
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
        loadMomentsCoverUrl
    };
})();
