// ==========================================
// IMESSAGE: Minimax TTS
// ==========================================
(function () {
    const DEFAULT_CONFIG = {
        region: 'cn',
        customEndpointEnabled: false,
        endpoint: '',
        apiKey: '',
        groupId: '',
        ttsModel: 'speech-02-hd'
    };

    const REGION_ENDPOINTS = {
        cn: 'https://api.minimax.chat',
        intl: 'https://api.minimax.io'
    };

    let currentAudio = null;

    function cloneConfig(value) {
        return {
            ...DEFAULT_CONFIG,
            ...(value && typeof value === 'object' ? value : {})
        };
    }

    function safeLoad(key, fallback) {
        try {
            if (window.StorageManager && typeof window.StorageManager.load === 'function') {
                return window.StorageManager.load(key, fallback);
            }
            const raw = window.localStorage ? window.localStorage.getItem(key) : null;
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            console.warn('[minimax_tts] Failed to load config:', error);
            return fallback;
        }
    }

    function safeSave(key, value) {
        try {
            if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                window.StorageManager.save(key, value);
                return;
            }
            if (window.localStorage) window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn('[minimax_tts] Failed to save config:', error);
        }
    }

    function getConfig() {
        window.minimaxConfig = cloneConfig(window.minimaxConfig || safeLoad('u2_minimaxConfig', DEFAULT_CONFIG));
        return window.minimaxConfig;
    }

    function setConfig(nextConfig) {
        window.minimaxConfig = cloneConfig(nextConfig);
        safeSave('u2_minimaxConfig', window.minimaxConfig);
        window.dispatchEvent(new CustomEvent('u2:minimax-config-updated', { detail: window.minimaxConfig }));
        return window.minimaxConfig;
    }

    function getBaseEndpoint(config = getConfig()) {
        const regionEndpoint = REGION_ENDPOINTS[config.region] || REGION_ENDPOINTS.cn;
        return String(config.customEndpointEnabled ? (config.endpoint || regionEndpoint) : regionEndpoint).replace(/\/+$/, '');
    }

    function getTtsUrl(config = getConfig()) {
        const groupId = String(config.groupId || '').trim();
        const query = groupId ? `?GroupId=${encodeURIComponent(groupId)}` : '';
        return `${getBaseEndpoint(config)}/v1/t2a_v2${query}`;
    }

    function isLikelyChinese(text) {
        return /[\u3400-\u9fff]/.test(String(text || ''));
    }

    function normalizeLanguage(language) {
        const lang = String(language || '').trim().toLowerCase();
        if (!lang || lang === 'zh' || lang === 'cn' || lang === 'zh-cn') return 'Chinese';
        if (lang === 'ja' || lang === 'jp') return 'Japanese';
        if (lang === 'ko' || lang === 'kr') return 'Korean';
        if (lang === 'fr') return 'French';
        if (lang === 'en') return 'English';
        return lang;
    }

    function hexToBlobUrl(hex, mimeType = 'audio/mpeg') {
        const cleanHex = String(hex || '').replace(/^0x/i, '').replace(/\s+/g, '');
        if (!cleanHex || cleanHex.length % 2 !== 0) return '';
        const bytes = new Uint8Array(cleanHex.length / 2);
        for (let i = 0; i < cleanHex.length; i += 2) {
            bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
        }
        return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    }

    function base64ToBlobUrl(base64, mimeType = 'audio/mpeg') {
        const cleanBase64 = String(base64 || '').replace(/^data:audio\/[^;]+;base64,/, '').replace(/\s+/g, '');
        if (!cleanBase64) return '';
        const binary = atob(cleanBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    }

    function extractAudioUrl(data) {
        const candidates = [
            data?.data?.audio,
            data?.data?.audio_base64,
            data?.audio,
            data?.audio_base64,
            data?.data?.audio_file,
            data?.data?.url,
            data?.url
        ].filter(Boolean);

        const first = String(candidates[0] || '').trim();
        if (!first) return '';
        if (/^https?:\/\//i.test(first) || /^blob:/i.test(first) || /^data:audio\//i.test(first)) return first;
        if (/^[0-9a-fA-F]+$/.test(first) && first.length > 32) return hexToBlobUrl(first);
        return base64ToBlobUrl(first);
    }

    async function playAudioUrl(url) {
        if (!url) throw new Error('No audio url');
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        currentAudio = new Audio(url);
        await currentAudio.play();
        return currentAudio;
    }

    function resolveFriendVoiceSettings(friend) {
        const settings = friend?.minimaxVoice && typeof friend.minimaxVoice === 'object' ? friend.minimaxVoice : {};
        return {
            enabled: !!settings.enabled,
            voiceId: String(settings.voiceId || '').trim(),
            speed: Math.max(0.5, Math.min(2, parseFloat(settings.speed) || 1)),
            language: friend?.language || 'zh'
        };
    }

    async function speakText(text, friend = null, options = {}) {
        const cleanText = String(text || '').trim();
        if (!cleanText) {
            if (window.showToast) window.showToast('没有可播放的文本');
            return null;
        }

        const config = getConfig();
        const voiceSettings = resolveFriendVoiceSettings(friend);
        if (!voiceSettings.enabled && !options.ignoreFriendToggle) {
            if (window.showToast) window.showToast('请先在 Chat Settings Info 开启 Minimax 语音');
            return null;
        }
        if (!config.apiKey || !config.groupId) {
            if (window.showToast) window.showToast('请先配置 Minimax Key 和 Group ID');
            return null;
        }

        const voiceId = voiceSettings.voiceId || options.voiceId || 'male-qn-qingse';
        const language = normalizeLanguage(voiceSettings.language);
        const body = {
            model: config.ttsModel || DEFAULT_CONFIG.ttsModel,
            text: cleanText,
            stream: false,
            output_format: 'hex',
            voice_setting: {
                voice_id: voiceId,
                speed: voiceSettings.speed,
                vol: 1,
                pitch: 0
            },
            audio_setting: {
                sample_rate: 32000,
                bitrate: 128000,
                format: 'mp3',
                channel: 1
            }
        };

        if (language && (language !== 'Chinese' || isLikelyChinese(cleanText))) {
            body.language_boost = language;
        }

        if (window.showToast) window.showToast('语音生成中...');
        const response = await fetch(getTtsUrl(config), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const data = await response.json();
        const audioUrl = extractAudioUrl(data);
        if (!audioUrl) throw new Error('Minimax 未返回音频');
        await playAudioUrl(audioUrl);
        return audioUrl;
    }

    async function speakTextCached(text, friend = null, cacheOwner = null, options = {}) {
        if (cacheOwner && cacheOwner.minimaxAudioUrl) {
            await playAudioUrl(cacheOwner.minimaxAudioUrl);
            return cacheOwner.minimaxAudioUrl;
        }

        if (cacheOwner && cacheOwner.minimaxAudioPromise) {
            const cachedUrl = await cacheOwner.minimaxAudioPromise;
            if (cachedUrl) await playAudioUrl(cachedUrl);
            return cachedUrl;
        }

        const requestPromise = speakText(text, friend, options);
        if (cacheOwner) cacheOwner.minimaxAudioPromise = requestPromise;

        try {
            const audioUrl = await requestPromise;
            if (cacheOwner && audioUrl) cacheOwner.minimaxAudioUrl = audioUrl;
            return audioUrl;
        } finally {
            if (cacheOwner) delete cacheOwner.minimaxAudioPromise;
        }
    }

    window.minimaxConfig = cloneConfig(window.minimaxConfig || safeLoad('u2_minimaxConfig', DEFAULT_CONFIG));
    window.u2MinimaxTts = {
        DEFAULT_CONFIG,
        REGION_ENDPOINTS,
        getConfig,
        setConfig,
        getBaseEndpoint,
        getTtsUrl,
        speakText,
        speakTextCached,
        playAudioUrl,
        resolveFriendVoiceSettings
    };
})();
