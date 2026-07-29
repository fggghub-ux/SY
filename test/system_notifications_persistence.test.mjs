import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const [notificationSource, settingsSource, indexSource, settingsCssSource] = await Promise.all([
    fs.readFile(new URL('../js/system_notifications.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/settings.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/settings.css', import.meta.url), 'utf8')
]);

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
        this.listeners.set(type, entries.filter(entry => entry.listener !== listener));
    }

    dispatchEvent(event) {
        const entries = [...(this.listeners.get(event.type) || [])];
        entries.forEach(entry => {
            entry.listener.call(this, event);
            if (entry.once) this.removeEventListener(event.type, entry.listener);
        });
        return true;
    }
}

class FakeCustomEvent {
    constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
    }
}

function createNotificationClass(permission = 'granted') {
    return class FakeNotification {
        static permission = permission;
        static async requestPermission() {
            return this.permission;
        }
        constructor() {}
    };
}

test('system notifications rehydrate the persisted enabled state after storage is ready', async () => {
    let hydrated = false;
    let resolveStorage;
    const storageReady = new Promise(resolve => { resolveStorage = resolve; });
    const persisted = { enabled: true, permission: 'granted' };
    const writes = [];
    const events = [];
    const window = new FakeEventTarget();
    const Notification = createNotificationClass('granted');

    window.appStorage = {
        ready: storageReady,
        async saveLegacyKey(key, value) { writes.push({ key, value: { ...value } }); }
    };
    window.StorageManager = {
        load(key, fallback) { return hydrated ? persisted : fallback; },
        save() { return true; }
    };
    window.addEventListener('u2:system-notification-settings-changed', event => events.push(event.detail));

    vm.runInNewContext(notificationSource, {
        window,
        Notification,
        CustomEvent: FakeCustomEvent,
        console
    });

    assert.equal(window.u2SystemNotifications.getSettings().enabled, false);
    hydrated = true;
    resolveStorage();
    await storageReady;
    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual({ ...window.u2SystemNotifications.getSettings() }, {
        ...persisted,
        soundAssetId: '',
        soundFileName: '',
        soundMimeType: '',
        hasCustomSound: false
    });
    assert.equal(events.at(-1).reason, 'storage-ready');
    assert.equal(writes.length, 0, 'valid persisted settings should not be rewritten during hydration');
});

test('notification updates await persistence and denied permissions remain off', async () => {
    let releaseWrite;
    const pendingWrite = new Promise(resolve => { releaseWrite = resolve; });
    const window = new FakeEventTarget();
    const Notification = createNotificationClass('granted');
    window.appStorage = {
        ready: new Promise(() => {}),
        saveLegacyKey() { return pendingWrite; }
    };
    window.StorageManager = { load(key, fallback) { return fallback; } };

    vm.runInNewContext(notificationSource, {
        window,
        Notification,
        CustomEvent: FakeCustomEvent,
        console
    });

    let resolved = false;
    const updatePromise = window.u2SystemNotifications.updateSettings({ enabled: true }).then(result => {
        resolved = true;
        return result;
    });
    await Promise.resolve();
    assert.equal(resolved, false);
    releaseWrite();
    const enabledResult = await updatePromise;
    assert.equal(enabledResult.enabled, true);

    Notification.permission = 'denied';
    assert.equal(window.u2SystemNotifications.getSettings().enabled, false);
});

test('custom notification sounds use durable assets, preview, and silence the native duplicate sound', async () => {
    const savedAssets = [];
    const deletedAssets = [];
    const writes = [];
    const shownNotifications = [];
    const playedAudio = [];
    const window = new FakeEventTarget();

    class FakeNotification {
        static permission = 'granted';
        static async requestPermission() { return this.permission; }
        constructor(title, options) { shownNotifications.push({ title, options }); }
    }

    window.Audio = class FakeAudio {
        constructor(src) {
            this.src = src;
            this.currentTime = 0;
            this.paused = true;
        }
        addEventListener() {}
        pause() { this.paused = true; }
        async play() {
            this.paused = false;
            playedAudio.push(this.src);
        }
    };
    window.focus = () => {};
    window.appStorage = {
        ready: new Promise(() => {}),
        async saveLegacyKey(key, value) { writes.push({ key, value: { ...value } }); },
        async saveAssetFromDataUrl(id, dataUrl, extra) {
            savedAssets.push({ id, dataUrl, extra });
            return id;
        },
        async getAssetUrl(id) { return `blob:${id}`; },
        async deleteAsset(id) { deletedAssets.push(id); }
    };
    window.StorageManager = { load(key, fallback) { return fallback; } };

    vm.runInNewContext(notificationSource, {
        window,
        Notification: FakeNotification,
        CustomEvent: FakeCustomEvent,
        console
    });

    await window.u2SystemNotifications.updateSettings({ enabled: true });
    const soundSettings = await window.u2SystemNotifications.setCustomSound({
        dataUrl: 'data:audio/wav;base64,UklGRg==',
        fileName: 'ding.wav',
        mimeType: 'audio/wav'
    });

    assert.equal(soundSettings.hasCustomSound, true);
    assert.equal(soundSettings.soundFileName, 'ding.wav');
    assert.equal(savedAssets.length, 1);
    assert.equal(savedAssets[0].extra.ownerType, 'system_notification');

    assert.equal(window.u2SystemNotifications.notifyIncomingMessage({
        friend: { id: 'friend-1', nickname: '朋友' },
        message: { id: 'message-1', content: '你好' }
    }), true);
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(shownNotifications[0].options.silent, true);
    assert.deepEqual(playedAudio, ['blob:u2_system_notification_sound']);

    const cleared = await window.u2SystemNotifications.clearCustomSound();
    assert.equal(cleared.hasCustomSound, false);
    assert.deepEqual(deletedAssets, ['u2_system_notification_sound']);
    assert.ok(writes.length >= 3);
});

test('settings listens for notification hydration and changed assets are cache-busted', () => {
    assert.match(notificationSource, /window\.addEventListener\('u2-storage-ready', hydrateSettingsFromStorage/);
    assert.match(notificationSource, /window\.appStorage\.ready\.then/);
    assert.match(notificationSource, /u2:system-notification-settings-changed/);
    assert.match(settingsSource, /window\.addEventListener\('u2:system-notification-settings-changed', syncSystemNotificationControls\)/);
    assert.match(settingsSource, /setCustomSound/);
    assert.match(settingsSource, /MAX_NOTIFICATION_SOUND_BYTES/);
    assert.match(indexSource, /id="notification-sound-settings"/);
    assert.match(indexSource, /id="notification-sound-file-input"[^>]*accept="audio/);
    assert.match(indexSource, /system_notifications\.js\?v=[^"']*custom-sound-v1/);
    assert.match(indexSource, /settings\.js\?v=[^"']*custom-notification-sound-v1/);
    assert.match(indexSource, /settings\.css\?v=[^"']*notification-sound-v1/);
    assert.match(settingsCssSource, /\.notification-sound-settings\.is-visible/);
});
