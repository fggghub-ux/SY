// Real browser/system notifications for incoming app messages.
(function () {
    const STORAGE_KEY = 'u2_systemNotificationSettings';

    const defaults = {
        enabled: false,
        permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
    };

    let settings = normalize(loadSettings());

    function normalize(value) {
        const safe = value && typeof value === 'object' ? value : {};
        return {
            enabled: !!safe.enabled,
            permission: getPermission()
        };
    }

    function getPermission() {
        if (typeof Notification === 'undefined') return 'unsupported';
        return Notification.permission;
    }

    function loadSettings() {
        try {
            if (window.StorageManager && typeof window.StorageManager.load === 'function') {
                return window.StorageManager.load(STORAGE_KEY, defaults);
            }

            const raw = window.localStorage ? window.localStorage.getItem(STORAGE_KEY) : null;
            return raw ? JSON.parse(raw) : defaults;
        } catch (error) {
            console.warn('[system_notifications] Failed to load settings:', error);
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
            console.warn('[system_notifications] Failed to save settings:', error);
        }
    }

    function getSettings() {
        settings.permission = getPermission();
        if (settings.permission === 'denied' || settings.permission === 'unsupported') {
            settings.enabled = false;
            saveSettings();
        }
        return { ...settings };
    }

    async function updateSettings(nextSettings = {}) {
        const wantsEnabled = !!nextSettings.enabled;

        if (getPermission() === 'unsupported') {
            settings = { enabled: false, permission: 'unsupported' };
            saveSettings();
            return { ...settings, unsupported: true };
        }

        let permission = getPermission();
        if (wantsEnabled && permission === 'default') {
            try {
                permission = await Notification.requestPermission();
            } catch (error) {
                console.warn('[system_notifications] Failed to request permission:', error);
                permission = getPermission();
            }
        }

        settings = {
            enabled: wantsEnabled && permission === 'granted',
            permission
        };
        saveSettings();
        return { ...settings };
    }

    function resolveTitle(payload = {}) {
        const friend = payload.friend || {};
        const message = payload.message || {};
        return message.speaker || message.senderName || friend.nickname || friend.realName || friend.realname || friend.name || 'iMessage';
    }

    function resolveBody(payload = {}) {
        const message = payload.message || {};
        const preview = window.imApp?.getFriendMessagePreview
            ? window.imApp.getFriendMessagePreview(message)
            : (message.content || message.text || message.message || '');
        return String(preview || '新消息').replace(/\s+/g, ' ').trim().slice(0, 180);
    }

    function notifyIncomingMessage(payload = {}) {
        const current = getSettings();
        if (!current.enabled || current.permission !== 'granted') return false;

        const friend = payload.friend || {};
        const title = resolveTitle(payload);
        const body = resolveBody(payload);
        const tag = payload.message?.id ? `imessage-${payload.message.id}` : `imessage-${friend.id || Date.now()}`;
        const options = {
            body,
            tag,
            renotify: true,
            icon: friend.avatarUrl || 'assets/moren.jpg',
            badge: 'assets/moren.jpg',
            data: {
                app: 'imessage',
                friendId: friend.id || null,
                messageId: payload.message?.id || null
            }
        };

        try {
            const notification = new Notification(title, options);
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            return true;
        } catch (error) {
            console.warn('[system_notifications] Failed to show notification:', error);
            return false;
        }
    }

    window.u2SystemNotifications = {
        getSettings,
        updateSettings,
        notifyIncomingMessage
    };
})();
