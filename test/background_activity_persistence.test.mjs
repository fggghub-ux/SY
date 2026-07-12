import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../js/background_activity.js', import.meta.url), 'utf8');

class FakeEventTarget {
    constructor() {
        this.listeners = new Map();
    }

    addEventListener(type, listener, options = {}) {
        const entries = this.listeners.get(type) || [];
        entries.push({ listener, once: !!options.once });
        this.listeners.set(type, entries);
    }

    removeEventListener(type, listener) {
        const entries = this.listeners.get(type) || [];
        this.listeners.set(type, entries.filter((entry) => entry.listener !== listener));
    }

    dispatchEvent(event) {
        const entries = [...(this.listeners.get(event.type) || [])];
        entries.forEach((entry) => {
            entry.listener.call(this, event);
            if (entry.once) this.removeEventListener(event.type, entry.listener);
        });
        return true;
    }
}

test('background activity rehydrates its persisted state when storage becomes ready', async () => {
    let hydrated = false;
    let resolveStorage;
    const storageReady = new Promise((resolve) => { resolveStorage = resolve; });
    const persisted = { enabled: true, intervalSeconds: 37, lastTickAt: Date.now() };
    const window = new FakeEventTarget();
    const document = new FakeEventTarget();
    const settingsEvents = [];

    document.hidden = false;
    document.body = { appendChild(node) { node.isConnected = true; } };
    document.createElement = () => ({
        paused: true,
        ended: false,
        isConnected: false,
        style: {},
        setAttribute() {},
        play() { this.paused = false; return Promise.resolve(); },
        pause() { this.paused = true; },
        currentTime: 0
    });

    window.appStorage = { ready: storageReady };
    window.StorageManager = {
        load(key, fallback) { return hydrated ? persisted : fallback; },
        save() {}
    };
    window.addEventListener('u2:background-activity-settings-changed', (event) => {
        settingsEvents.push(event.detail);
    });

    class FakeCustomEvent {
        constructor(type, options = {}) {
            this.type = type;
            this.detail = options.detail;
        }
    }

    const context = {
        window,
        document,
        navigator: {},
        location: { protocol: 'https:' },
        CustomEvent: FakeCustomEvent,
        Blob,
        URL,
        ArrayBuffer,
        DataView,
        Uint8Array,
        Math,
        Date,
        console,
        setInterval: () => 1,
        clearInterval: () => {}
    };

    vm.runInNewContext(source, context);
    assert.equal(window.u2BackgroundActivity.getSettings().enabled, false);

    hydrated = true;
    window.dispatchEvent(new FakeCustomEvent('u2-storage-ready'));
    resolveStorage();
    await storageReady;
    await Promise.resolve();

    assert.deepEqual(
        { ...window.u2BackgroundActivity.getSettings() },
        persisted
    );
    assert.equal(settingsEvents.at(-1).reason, 'storage-ready');
    assert.equal(settingsEvents.at(-1).enabled, true);
});

