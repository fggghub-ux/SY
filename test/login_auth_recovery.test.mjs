import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const [loginSource, indexSource] = await Promise.all([
    fs.readFile(new URL('../js/login.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

function createAuthRuntime(localStorage) {
    let domReady;
    const screenClasses = new Set();
    const bodyClasses = new Set();
    const screen = {
        classList: {
            add(name) { screenClasses.add(name); },
            remove(name) { screenClasses.delete(name); }
        },
        setAttribute() {}
    };
    const form = { addEventListener() {} };
    const context = {
        console: { warn() {}, error() {}, log() {} },
        setTimeout,
        structuredClone,
        CustomEvent: class {
            constructor(type, init) {
                this.type = type;
                this.detail = init?.detail;
            }
        },
        document: {
            readyState: 'loading',
            body: {
                classList: {
                    toggle(name, enabled) {
                        if (enabled) bodyClasses.add(name);
                        else bodyClasses.delete(name);
                    }
                }
            },
            getElementById(id) {
                if (id === 'u2-login-screen') return screen;
                if (id === 'u2-login-form') return form;
                return null;
            },
            addEventListener(type, callback) {
                if (type === 'DOMContentLoaded') domReady = callback;
            }
        },
        localStorage,
        dispatchEvent() {}
    };
    context.window = context;
    vm.runInNewContext(loginSource, context);
    return {
        auth: context.u2Auth,
        screenClasses,
        bodyClasses,
        async start() {
            domReady?.();
            await context.u2Auth.ready;
        }
    };
}

function createMapStorage(values = new Map()) {
    return {
        values,
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, value); },
        removeItem(key) { values.delete(key); }
    };
}

test('login session uses its own localStorage key without IndexedDB dependencies', () => {
    assert.match(loginSource, /const AUTH_SESSION_STORAGE_KEY = 'u2_authSession'/);
    assert.match(loginSource, /window\.localStorage\.getItem\(AUTH_SESSION_STORAGE_KEY\)/);
    assert.match(loginSource, /window\.localStorage\.setItem\(AUTH_SESSION_STORAGE_KEY, JSON\.stringify\(session\)\)/);
    assert.match(loginSource, /window\.localStorage\.removeItem\(AUTH_SESSION_STORAGE_KEY\)/);
    assert.doesNotMatch(loginSource, /window\.appStorage/);
    assert.doesNotMatch(loginSource, /u2_mockAuthSession/);
});

test('temporary login gate bypass is enabled before any delayed DOM ready work', () => {
    assert.match(loginSource, /const AUTH_GATE_ENABLED = false/);
    assert.match(loginSource, /isGateEnabled: AUTH_GATE_ENABLED/);
    assert.match(loginSource, /if \(!AUTH_GATE_ENABLED\) \{[\s\S]*hideLoginScreen\(\);[\s\S]*settleAuthReady\(\);[\s\S]*\} else if \(document\.readyState === 'loading'\)/);
    assert.match(indexSource, /id="u2-login-screen" class="u2-login-screen is-hidden" aria-hidden="true"/);
    assert.match(indexSource, /id="u2-auth-sign-out-btn" hidden aria-hidden="true"/);
});

test('disabled login gate cannot relock the desktop through show or logout', async () => {
    const storage = createMapStorage();
    const runtime = createAuthRuntime(storage);
    await runtime.start();
    assert.equal(runtime.auth.isGateEnabled, false);
    runtime.auth.showLoginScreen();
    assert.equal(runtime.screenClasses.has('is-hidden'), true);
    assert.equal(runtime.bodyClasses.has('u2-login-locked'), false);
    await runtime.auth.logout();
    assert.equal(runtime.screenClasses.has('is-hidden'), true);
    assert.equal(runtime.bodyClasses.has('u2-login-locked'), false);
    assert.equal(runtime.auth.getSession(), null);
    assert.equal(storage.values.has('u2_authSession'), false);
});

test('invalid stored sessions are removed and treated as logged out', () => {
    assert.match(loginSource, /function isValidSession\(session\)/);
    assert.match(loginSource, /Number\.isFinite\(session\.loginAt\)/);
    assert.match(loginSource, /if \(isValidSession\(session\)\) return session;[\s\S]*window\.localStorage\.removeItem\(AUTH_SESSION_STORAGE_KEY\);[\s\S]*return null;/);
});

test('localStorage write failures retain the in-memory session and do not block login', () => {
    assert.match(loginSource, /cachedSession = clonePlainData\(session\);[\s\S]*localStorage\.setItem/);
    assert.match(loginSource, /Session will only last for this page/);
    assert.doesNotMatch(loginSource, /Unable to save login session/);
    assert.match(loginSource, /safeSaveSession\(session\);[\s\S]*hideLoginScreen\(\);/);
});

test('logout clears both the in-memory and localStorage session', () => {
    assert.match(loginSource, /function safeRemoveSession\(\) \{[\s\S]*cachedSession = null;[\s\S]*window\.localStorage\.removeItem\(AUTH_SESSION_STORAGE_KEY\)/);
});

test('login cache version is bumped for the localStorage implementation', () => {
    assert.match(indexSource, /js\/login\.js\?v=20260713-auth-disabled-v1/);
});

test('login persists, restores, and removes the local session at runtime', async () => {
    const storage = createMapStorage();
    const firstRuntime = createAuthRuntime(storage);
    await firstRuntime.start();
    const result = await firstRuntime.auth.login({ account: 'test@example.com', password: 'secret' });
    assert.equal(result.ok, true);
    assert.equal(JSON.parse(storage.values.get('u2_authSession')).account, 'test@example.com');

    const restoredRuntime = createAuthRuntime(storage);
    await restoredRuntime.start();
    assert.equal(restoredRuntime.auth.getSession().account, 'test@example.com');
    await restoredRuntime.auth.logout();
    assert.equal(storage.values.has('u2_authSession'), false);
});

test('malformed local sessions are discarded without blocking startup', async () => {
    const storage = createMapStorage(new Map([['u2_authSession', '{broken']]));
    const runtime = createAuthRuntime(storage);
    await runtime.start();
    assert.equal(runtime.auth.getSession(), null);
    assert.equal(storage.values.has('u2_authSession'), false);
});

test('a blocked localStorage write still creates a current-page session', async () => {
    const runtime = createAuthRuntime({
        getItem() { return null; },
        setItem() { throw new Error('blocked'); },
        removeItem() { throw new Error('blocked'); }
    });
    await runtime.start();
    const result = await runtime.auth.login({ account: 'memory@example.com', password: 'secret' });
    assert.equal(result.ok, true);
    assert.equal(runtime.auth.getSession().account, 'memory@example.com');
});
