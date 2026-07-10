import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

class MemoryStorage {
    constructor() {
        this.values = new Map();
    }
    get length() { return this.values.size; }
    key(index) { return Array.from(this.values.keys())[index] ?? null; }
    getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
    setItem(key, value) { this.values.set(String(key), String(value)); }
    removeItem(key) { this.values.delete(String(key)); }
    clear() { this.values.clear(); }
}

globalThis.window = globalThis;
globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;
globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.FileReader = class FileReader {
    readAsDataURL(blob) {
        blob.arrayBuffer().then((buffer) => {
            this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buffer).toString('base64')}`;
            this.onload?.({ target: this });
        }).catch((error) => {
            this.error = error;
            this.onerror?.(error);
        });
    }
};
globalThis.document = {
    body: { appendChild() {} },
    addEventListener() {},
    createElement() { return { style: {}, appendChild() {}, innerHTML: '' }; }
};
Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
        storage: {
            async persist() { return true; },
            async persisted() { return true; },
            async estimate() { return { usage: 1024, quota: 1024 * 1024 * 100 }; }
        }
    }
});

async function seedVersionFourDatabase() {
    await new Promise((resolve, reject) => {
        const request = indexedDB.open('iiso_app_storage', 4);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
            if (!db.objectStoreNames.contains('app_domains')) db.createObjectStore('app_domains', { keyPath: 'name' });
            if (!db.objectStoreNames.contains('storage_checkpoints')) db.createObjectStore('storage_checkpoints', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('im_friends')) db.createObjectStore('im_friends', { keyPath: 'id' });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['settings', 'app_domains', 'storage_checkpoints', 'im_friends'], 'readwrite');
            transaction.objectStore('settings').put({
                key: 'appState',
                value: {
                    x: {
                        xData: { name: 'Durable User' },
                        xGeneratedPosts: [{ id: 'durable-post', text: 'from IndexedDB', createdAt: 10 }],
                        xPostThreads: {},
                        xDirectMessages: []
                    }
                }
            });
            transaction.objectStore('app_domains').put({
                name: 'x',
                schemaVersion: 6,
                revision: 1,
                updatedAt: 1,
                value: { xData: { name: 'Durable User' } }
            });
            transaction.objectStore('im_friends').put({ id: 'seed-friend', nickname: 'Seed Friend', messageCount: 1 });
            transaction.objectStore('storage_checkpoints').put({
                id: 'domain:x',
                schemaVersion: 6,
                current: {
                    revision: 1,
                    updatedAt: 1,
                    value: {
                        xData: { name: 'Durable User' },
                        xGeneratedPosts: [{ id: 'durable-post', text: 'from IndexedDB', createdAt: 10 }],
                        xPostThreads: {},
                        xDirectMessages: []
                    }
                },
                previous: null
            });
            transaction.objectStore('storage_checkpoints').put({
                id: 'im-messages:seed-friend',
                schemaVersion: 6,
                current: {
                    revision: 1,
                    updatedAt: 1,
                    value: [{ id: 'seed-message', text: 'recover me', timestamp: 1 }]
                },
                previous: null
            });
            transaction.objectStore('storage_checkpoints').put({
                id: 'migration:legacy-localstorage',
                schemaVersion: 6,
                current: { revision: 1, updatedAt: 1, value: 'x'.repeat(100000) },
                previous: null
            });
            transaction.oncomplete = () => {
                db.close();
                resolve();
            };
            transaction.onerror = () => reject(transaction.error);
        };
    });
}

await seedVersionFourDatabase();
localStorage.setItem('u2_appState', JSON.stringify({
    x: {
        xData: { name: 'Stale Local User' },
        xGeneratedPosts: [{ id: 'local-post', text: 'from localStorage', createdAt: 20 }]
    }
}));
localStorage.setItem('u2_mockAuthSession', JSON.stringify({ loggedIn: true }));

await import(`../js/storage/app_storage.js?storage-test=${Date.now()}`);
await window.appStorage.ready;
await import(`../storage.js?storage-test=${Date.now()}`);

test('startup ignores browser localStorage and preserves it without importing', async () => {
    const xState = window.appStorage.readDomain('x', {});
    assert.equal(xState.xData.name, 'Durable User');
    assert.deepEqual(xState.xGeneratedPosts.map((post) => post.id), ['durable-post']);
    assert.equal(localStorage.getItem('u2_appState'), JSON.stringify({
        x: {
            xData: { name: 'Stale Local User' },
            xGeneratedPosts: [{ id: 'local-post', text: 'from localStorage', createdAt: 20 }]
        }
    }));
    assert.equal(localStorage.getItem('u2_mockAuthSession'), JSON.stringify({ loggedIn: true }));
    assert.equal(await window.appStorage.getAuthSession(), null);
});

test('v8 startup compaction restores missing main records before deleting inflated copies', async () => {
    const [checkpoints, oldAppState, messages, health] = await Promise.all([
        window.appStorage.withStore([window.appStorage.STORES.storageCheckpoints], 'readonly', (stores) =>
            window.appStorage.requestToPromise(stores[window.appStorage.STORES.storageCheckpoints].getAll())
        ),
        window.appStorage.getSetting('appState', null),
        window.appStorage.loadMessagesByFriendId('seed-friend'),
        window.appStorage.getStorageHealth()
    ]);
    assert.deepEqual(checkpoints, []);
    assert.equal(oldAppState, null);
    assert.ok(messages.some((message) => message.id === 'seed-message'));
    assert.equal(health.lastCompaction.schemaVersion, 8);
    assert.equal(health.lastCompaction.messagesRecovered, 1);
    assert.ok(health.lastCompaction.checkpointRecordsDeleted >= 3);
});

test('legacy storage facade returns null for missing shopping keys without cloning sentinels', () => {
    assert.equal(window.u2LegacyStorageFacade.getItem('shopping_missing_key'), null);
});

test('serialized domain reducers keep concurrent changes and expose durable revisions', async () => {
    const [first, second] = await Promise.all([
        window.appStorage.commitDomain('concurrency', (draft) => ({ ...draft, persona: 'kept' }), { reason: 'persona' }),
        window.appStorage.commitDomain('concurrency', (draft) => ({ ...draft, background: 'kept' }), { reason: 'background' })
    ]);
    assert.equal(first.durable, true);
    assert.ok(second.revision > first.revision);
    assert.deepEqual(window.appStorage.readDomain('concurrency'), { persona: 'kept', background: 'kept' });
});

test('X collections are committed to their normalized stores', async () => {
    await window.appStorage.commitDomain('x', (draft) => ({
        ...draft,
        xGeneratedPosts: [
            ...(draft.xGeneratedPosts || []),
            { id: 'user-post', authorId: 'me', text: 'persist me', createdAt: 30 }
        ],
        xPostThreads: { 'user-post': { comments: [{ id: 'comment-1', text: 'saved' }] } },
        xDirectMessages: [{ id: 'dm-1', name: 'Saved DM', messages: [] }]
    }), { critical: true, reason: 'x-test' });

    const [posts, threads, dms] = await window.appStorage.withStore(
        [window.appStorage.STORES.xPosts, window.appStorage.STORES.xThreads, window.appStorage.STORES.xDms],
        'readonly',
        async (stores) => Promise.all([
            window.appStorage.requestToPromise(stores[window.appStorage.STORES.xPosts].getAll()),
            window.appStorage.requestToPromise(stores[window.appStorage.STORES.xThreads].getAll()),
            window.appStorage.requestToPromise(stores[window.appStorage.STORES.xDms].getAll())
        ])
    );
    assert.ok(posts.some((post) => post.id === 'user-post'));
    assert.ok(threads.some((thread) => thread.postId === 'user-post'));
    assert.ok(dms.some((dm) => dm.id === 'dm-1'));
});

test('iMessage field patches preserve persona and moments-cover assets across concurrent commits', async () => {
    await window.appStorage.saveFriend({
        id: 'friend-1',
        nickname: 'Friend',
        persona: 'original',
        momentsCover: null,
        messages: [],
        messagesLoaded: true
    });
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    await Promise.all([
        window.appStorage.patchFriendMeta('friend-1', { persona: 'updated persona' }),
        window.appStorage.patchFriendMeta('friend-1', { momentsCover: dataUrl })
    ]);
    const friend = (await window.appStorage.loadFriends()).find((item) => item.id === 'friend-1');
    assert.equal(friend.persona, 'updated persona');
    assert.match(friend.momentsCoverAssetId, /^sha256_[a-f0-9]{64}$/);
    assert.ok(String(friend.momentsCover).startsWith('blob:'));
});

test('iMessage per-chat theme CSS survives durable friend storage', async () => {
    await window.appStorage.saveFriend({
        id: 'theme-friend',
        nickname: 'Theme Friend',
        customCssEnabled: true,
        customCss: '.user-bubble { background: #123456; }',
        chatCssEnabled: true,
        chatCss: ':scope { --im-chat-bg-color: #f0f0f0; }',
        statusCssEnabled: true,
        statusCss: '.chat-top-bar { color: #654321; }',
        messages: [],
        messagesLoaded: true
    });

    const friend = (await window.appStorage.loadFriends()).find((item) => item.id === 'theme-friend');
    assert.equal(friend.customCssEnabled, true);
    assert.equal(friend.customCss, '.user-bubble { background: #123456; }');
    assert.equal(friend.chatCssEnabled, true);
    assert.equal(friend.chatCss, ':scope { --im-chat-bg-color: #f0f0f0; }');
    assert.equal(friend.statusCssEnabled, true);
    assert.equal(friend.statusCss, '.chat-top-bar { color: #654321; }');
});

test('plain-text message commits update only message and compact summary records', async () => {
    const friend = {
        id: 'atomic-friend',
        nickname: 'Atomic Friend',
        persona: 'must stay untouched',
        messages: [],
        messagesLoaded: true,
        unreadCount: 0
    };
    await window.appStorage.saveFriend(friend);
    const beforeMeta = await window.appStorage.withStore(
        [window.appStorage.STORES.imFriends],
        'readonly',
        (stores) => window.appStorage.requestToPromise(stores[window.appStorage.STORES.imFriends].get(friend.id))
    );
    const first = { id: 'atomic-message-1', role: 'user', content: 'hello', timestamp: 100 };
    friend.messages.push(first);
    await window.appStorage.commitFriendMessage(friend, first, 0);
    const second = { id: 'atomic-message-2', role: 'assistant', content: 'world', timestamp: 200 };
    friend.messages.push(second);
    await window.appStorage.commitFriendMessage(friend, second, 1);
    const [afterMeta, summary, messages] = await Promise.all([
        window.appStorage.withStore([window.appStorage.STORES.imFriends], 'readonly', (stores) =>
            window.appStorage.requestToPromise(stores[window.appStorage.STORES.imFriends].get(friend.id))
        ),
        window.appStorage.withStore([window.appStorage.STORES.imChatSummaries], 'readonly', (stores) =>
            window.appStorage.requestToPromise(stores[window.appStorage.STORES.imChatSummaries].get(friend.id))
        ),
        window.appStorage.loadMessagesByFriendId(friend.id)
    ]);
    assert.deepEqual(afterMeta, beforeMeta);
    assert.equal(summary.messageCount, 2);
    assert.equal(summary.lastMessagePreview, 'world');
    assert.deepEqual(messages.map((message) => message.id), ['atomic-message-1', 'atomic-message-2']);
});

test('identical embedded chat images share one lossless content-addressed asset', async () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const friend = { id: 'media-friend', messages: [], messagesLoaded: true, unreadCount: 0 };
    await window.appStorage.saveFriend(friend);
    const first = { id: 'media-1', role: 'user', type: 'image', content: dataUrl, timestamp: 1 };
    friend.messages.push(first);
    await window.appStorage.commitFriendMessage(friend, first, 0);
    const second = { id: 'media-2', role: 'user', type: 'image', content: dataUrl, timestamp: 2 };
    friend.messages.push(second);
    await window.appStorage.commitFriendMessage(friend, second, 1);
    const stored = await window.appStorage.withStore(
        [window.appStorage.STORES.imMessages, window.appStorage.STORES.assets],
        'readonly',
        async (stores) => ({
            messages: await window.appStorage.requestToPromise(stores[window.appStorage.STORES.imMessages].getAll()),
            assets: await window.appStorage.requestToPromise(stores[window.appStorage.STORES.assets].getAll())
        })
    );
    const mediaRows = stored.messages.filter((message) => message.friendId === friend.id);
    assert.equal(mediaRows.length, 2);
    assert.equal(mediaRows[0].contentAssetId, mediaRows[1].contentAssetId);
    assert.match(mediaRows[0].contentAssetId, /^sha256_[a-f0-9]{64}$/);
    assert.equal(stored.assets.filter((asset) => asset.id === mediaRows[0].contentAssetId).length, 1);
});

test('v8 backup excludes auth sessions and no longer emits localStorage data', async () => {
    const snapshot = await window.appStorage.collectBackupSnapshot();
    assert.equal(Object.hasOwn(snapshot.stores, window.appStorage.STORES.authSessions), false);
    assert.deepEqual(snapshot.localStorage, []);
});

test('legacy iMessage domain collections are recovered once and removed from the app domain', async () => {
    await window.appStorage.commitDomain('imessage', {
        uiState: { cssPresets: ['kept'] },
        friends: [{ id: 'legacy-domain-friend', nickname: 'Recovered', messages: [{ id: 'legacy-domain-message', content: 'kept', timestamp: 1 }] }]
    });
    await window.appStorage.compactStorage({ force: true });
    const domain = window.appStorage.readDomain('imessage', {});
    const messages = await window.appStorage.loadMessagesByFriendId('legacy-domain-friend');
    assert.deepEqual(domain, { uiState: { cssPresets: ['kept'] } });
    assert.ok(messages.some((message) => message.id === 'legacy-domain-message'));
});

test('storage breakdown never labels unclassified IndexedDB usage as cache', async () => {
    const breakdown = await window.appStorage.getStorageBreakdown();
    assert.equal(Object.hasOwn(breakdown.groups, '缓存与其他'), false);
    assert.equal(breakdown.logicalBytes, breakdown.indexedDbBytes);
});

test('verified shadow-database optimization preserves auth and user records', async () => {
    await window.appStorage.setAuthSession({ loggedIn: true });
    const report = await window.appStorage.optimizeStorage();
    const [auth, messages] = await Promise.all([
        window.appStorage.getAuthSession(),
        window.appStorage.loadMessagesByFriendId('atomic-friend')
    ]);
    assert.ok(report.verifiedStores >= 1);
    assert.deepEqual(auth, { loggedIn: true });
    assert.deepEqual(messages.map((message) => message.id), ['atomic-message-1', 'atomic-message-2']);
});

test('safe optimization aborts before rebuild when temporary quota is insufficient', async () => {
    const originalEstimate = navigator.storage.estimate;
    navigator.storage.estimate = async () => ({ usage: 1024, quota: 1024 });
    await assert.rejects(() => window.appStorage.optimizeStorage(), /temporary space|QuotaExceededError/i);
    navigator.storage.estimate = originalEstimate;
    const messages = await window.appStorage.loadMessagesByFriendId('atomic-friend');
    assert.deepEqual(messages.map((message) => message.id), ['atomic-message-1', 'atomic-message-2']);
});

test('storage usage details expose only real Cache Storage bytes as page cache', async () => {
    const originalEstimate = navigator.storage.estimate;
    navigator.storage.estimate = async () => ({
        usage: 10 * 1024 * 1024,
        quota: 100 * 1024 * 1024,
        usageDetails: { indexedDB: 8 * 1024 * 1024, caches: 512 * 1024 }
    });
    const breakdown = await window.appStorage.getStorageBreakdown();
    navigator.storage.estimate = originalEstimate;
    assert.equal(breakdown.cacheBytes, 512 * 1024);
    assert.equal(breakdown.groups['页面缓存'].bytes, 512 * 1024);
    assert.equal(Object.hasOwn(breakdown.groups, '缓存与其他'), false);
});

test('normal domain, X and iMessage writes no longer create full local-history checkpoints', async () => {
    await window.appStorage.commitDomain('checkpoint-test', { value: 1 });
    await window.appStorage.commitDomain('checkpoint-test', { value: 2 });
    const checkpoints = await window.appStorage.withStore(
        [window.appStorage.STORES.storageCheckpoints],
        'readonly',
        (stores) => window.appStorage.requestToPromise(stores[window.appStorage.STORES.storageCheckpoints].getAll())
    );
    assert.deepEqual(checkpoints, []);
});

test('manual cache cleanup removes only rebuildable caches and expired unreferenced assets', async () => {
    const deletedCacheNames = [];
    globalThis.caches = {
        async keys() { return ['app-shell-v1', 'image-cache-v1']; },
        async delete(name) {
            deletedCacheNames.push(name);
            return true;
        }
    };
    await window.appStorage.withStore(
        [window.appStorage.STORES.assets],
        'readwrite',
        (stores) => stores[window.appStorage.STORES.assets].put({
            id: 'expired-unreferenced-asset',
            blob: new Blob(['cache']),
            orphanedAt: Date.now() - (8 * 24 * 60 * 60 * 1000)
        })
    );

    const report = await window.appStorage.clearSafeCache();
    const [orphan, friends, xState, health] = await Promise.all([
        window.appStorage.withStore([window.appStorage.STORES.assets], 'readonly', (stores) =>
            window.appStorage.requestToPromise(stores[window.appStorage.STORES.assets].get('expired-unreferenced-asset'))
        ),
        window.appStorage.loadFriends(),
        Promise.resolve(window.appStorage.readDomain('x', {})),
        window.appStorage.getStorageHealth()
    ]);

    assert.deepEqual(deletedCacheNames, ['app-shell-v1', 'image-cache-v1']);
    assert.equal(report.cachesDeleted, 2);
    assert.equal(report.orphanAssetsRemoved, 1);
    assert.equal(orphan, undefined);
    assert.ok(friends.some((friend) => friend.id === 'friend-1'));
    assert.ok(xState.xGeneratedPosts.some((post) => post.id === 'user-post'));
    assert.equal(health.lastCacheCleanup.clearedAt, report.clearedAt);
    delete globalThis.caches;
});

test('compaction is idempotent and aborts before cleanup when a missing domain cannot be recovered', async () => {
    const first = await window.appStorage.compactStorage();
    const second = await window.appStorage.compactStorage();
    assert.equal(second.compactedAt, first.compactedAt);

    await window.appStorage.withStore(
        [window.appStorage.STORES.settings, window.appStorage.STORES.storageCheckpoints],
        'readwrite',
        (stores) => {
            stores[window.appStorage.STORES.settings].put({ key: 'appState', value: { invalidDomain: 'not-an-object' } });
            stores[window.appStorage.STORES.storageCheckpoints].put({ id: 'validation-sentinel', current: { value: 'keep-me' } });
        }
    );
    await assert.rejects(() => window.appStorage.compactStorage({ force: true }), /safely recover/i);
    const [sentinel, appState] = await Promise.all([
        window.appStorage.withStore([window.appStorage.STORES.storageCheckpoints], 'readonly', (stores) =>
            window.appStorage.requestToPromise(stores[window.appStorage.STORES.storageCheckpoints].get('validation-sentinel'))
        ),
        window.appStorage.getSetting('appState', null)
    ]);
    assert.equal(sentinel.current.value, 'keep-me');
    assert.equal(appState.invalidDomain, 'not-an-object');
});

test('backup checksum rejects corrupted snapshots', async () => {
    const snapshot = await window.appStorage.collectBackupSnapshot();
    const corrupted = structuredClone(snapshot);
    corrupted.stores.app_domains[0].updatedAt += 1;
    assert.throws(() => window.appStorage.validateBackupPayload(corrupted), /checksum/i);
});

test('business modules do not access browser localStorage directly', async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const files = [];
    async function walk(directory) {
        for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
            if (entry.name === 'dist' || entry.name === 'node_modules') continue;
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) await walk(fullPath);
            else if (entry.name.endsWith('.js')) files.push(fullPath);
        }
    }
    await walk(path.join(root, 'js'));
    const violations = [];
    for (const file of files) {
        const relative = path.relative(root, file).replaceAll('\\', '/');
        if (relative === 'js/login.js') continue;
        const source = await fs.readFile(file, 'utf8');
        if (/\b(?:window\.)?localStorage\s*\.(?:getItem|setItem|removeItem|clear)\s*\(/.test(source)) violations.push(relative);
    }
    assert.deepEqual(violations, []);
});

test('manual legacy snapshot import converts backup rows into IndexedDB only', async () => {
    const legacySnapshot = {
        app: 'u2phone',
        version: 7,
        stores: {},
        localStorage: [
            { key: 'u2_appState', value: JSON.stringify({ bstage: { updatedAt: 9, teams: [{ id: 'team-legacy', members: [] }] } }) },
            { key: 'shopping_cart', value: JSON.stringify([{ id: 'cart-legacy', qty: 1 }]) }
        ]
    };

    await window.appStorage.importAllData(legacySnapshot);
    const [bstageRecord, legacyRecord] = await window.appStorage.withStore(
        [window.appStorage.STORES.appDomains],
        'readonly',
        (stores) => Promise.all([
            window.appStorage.requestToPromise(stores[window.appStorage.STORES.appDomains].get('bstage')),
            window.appStorage.requestToPromise(stores[window.appStorage.STORES.appDomains].get('legacy'))
        ])
    );
    assert.equal(bstageRecord.value.teams[0].id, 'team-legacy');
    assert.deepEqual(legacyRecord.value.shopping_cart, [{ id: 'cart-legacy', qty: 1 }]);
    assert.equal(localStorage.getItem('u2_appState'), JSON.stringify({
        x: {
            xData: { name: 'Stale Local User' },
            xGeneratedPosts: [{ id: 'local-post', text: 'from localStorage', createdAt: 20 }]
        }
    }));
});
