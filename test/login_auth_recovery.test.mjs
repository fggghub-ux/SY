import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [storageSource, loginSource, indexSource] = await Promise.all([
    fs.readFile(new URL('../js/storage/app_storage.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/login.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

test('auth storage has a lightweight readiness path independent of full storage startup', () => {
    assert.match(storageSource, /async function waitForAuthStorage\(\)/);
    assert.match(storageSource, /Object\.defineProperty\(window\.appStorage, 'authReady'/);
    assert.match(loginSource, /window\.appStorage\.waitForAuthStorage\(\)/);
    assert.doesNotMatch(loginSource, /await window\.appStorage\.ready/);
});

test('transient IndexedDB failures are retried without treating them as logout', () => {
    assert.match(storageSource, /function isTransientIndexedDbError\(error\)/);
    assert.match(storageSource, /AbortError/);
    assert.match(storageSource, /InvalidStateError/);
    assert.match(storageSource, /async function withAuthStorageRetry\(operation, options = \{\}\)/);
    assert.match(loginSource, /authStateStatus = 'error'/);
    assert.match(loginSource, /Retry session \/ \u91cd\u8bd5/);
});

test('login verifies the durable session before unlocking the app', () => {
    assert.match(loginSource, /await window\.appStorage\.setAuthSession\(session\);[\s\S]*const verified = await window\.appStorage\.getAuthSession\(\);/);
    assert.match(loginSource, /verified\.account !== session\.account \|\| verified\.loginAt !== session\.loginAt/);
    assert.match(loginSource, /cachedSession = verified;/);
});

test('storage and login cache versions are bumped together', () => {
    assert.match(indexSource, /js\/storage\/app_storage\.js\?v=20260713-auth-fast-v1/);
    assert.match(indexSource, /js\/login\.js\?v=20260713-auth-fast-v1/);
});
