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

test('migration uses IndexedDB app state and preserves only the login localStorage key', () => {
    const xState = window.appStorage.readDomain('x', {});
    assert.equal(xState.xData.name, 'Durable User');
    assert.deepEqual(xState.xGeneratedPosts.map((post) => post.id), ['durable-post']);
    assert.equal(localStorage.getItem('u2_appState'), null);
    assert.notEqual(localStorage.getItem('u2_mockAuthSession'), null);
});

test('v7 startup compaction restores missing main records before deleting inflated v6 copies', async () => {
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
    assert.equal(health.lastCompaction.schemaVersion, 7);
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
    const [friend] = await window.appStorage.loadFriends();
    assert.equal(friend.persona, 'updated persona');
    assert.equal(friend.momentsCoverAssetId, 'friend_friend-1_momentsCover');
    assert.ok(String(friend.momentsCover).startsWith('blob:'));
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
        if (relative === 'js/login.js' || relative === 'js/storage/app_storage.js') continue;
        const source = await fs.readFile(file, 'utf8');
        if (/\b(?:window\.)?localStorage\s*\.(?:getItem|setItem|removeItem|clear)\s*\(/.test(source)) violations.push(relative);
    }
    assert.deepEqual(violations, []);
});
