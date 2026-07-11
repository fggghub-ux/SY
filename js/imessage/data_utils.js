(function initImessageDataUtils(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.imDataUtils = api;
    else if (root) root.imDataUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : null, function createImessageDataUtils() {
    function pad2(value) {
        return String(value).padStart(2, '0');
    }

    function normalizeRoundLimit(value, fallback = 30) {
        const numeric = Number(value);
        return Number.isFinite(numeric) && numeric > 0
            ? Math.min(999, Math.max(1, Math.round(numeric)))
            : fallback;
    }

    function normalizeMessageLimit(value, fallback = 30) {
        return normalizeRoundLimit(value, fallback);
    }

    function normalizeChatLanguage(value) {
        const language = String(value || '').trim().toLowerCase();
        if (!language || ['zh', 'cn', 'zh-cn'].includes(language)) return 'zh';
        if (['ko', 'kr'].includes(language)) return 'ko';
        if (['ja', 'jp'].includes(language)) return 'ja';
        if (language === 'en') return 'en';
        if (language === 'fr') return 'fr';
        return language;
    }

    function getChatLanguageName(value) {
        const language = normalizeChatLanguage(value);
        return {
            zh: 'Chinese',
            ko: 'Korean',
            ja: 'Japanese',
            en: 'English',
            fr: 'French'
        }[language] || language || 'Chinese';
    }

    function parseBilingualDialogue(value, language) {
        const text = String(value || '').trim();
        if (!text) return { original: '', translation: '' };
        if (normalizeChatLanguage(language) === 'zh') {
            return { original: text, translation: '' };
        }

        const match = text.match(/^([\s\S]+)（([^（）]*[\u3400-\u9fff][^（）]*)）$/);
        if (!match) return { original: text, translation: '' };
        const original = String(match[1] || '').trim();
        const translation = String(match[2] || '').trim();
        if (!original || !translation) return { original: text, translation: '' };
        return { original, translation };
    }

    function normalizeGroupChatContexts(contexts, fallbackMessageLimit = 30) {
        const seenGroupIds = new Set();
        return (Array.isArray(contexts) ? contexts : [])
            .map((context) => {
                if (!context || typeof context !== 'object') return null;
                const groupId = String(context.groupId ?? '').trim();
                if (!groupId || seenGroupIds.has(groupId)) return null;
                seenGroupIds.add(groupId);
                return {
                    groupId,
                    messageLimit: normalizeMessageLimit(context.messageLimit, fallbackMessageLimit)
                };
            })
            .filter(Boolean);
    }

    function getRecentPublicGroupMessages(messages, messageLimit = 30) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const limit = normalizeMessageLimit(messageLimit, 30);
        const publicMessages = safeMessages.filter((message) => (
            message?.noticeKind !== 'group_private_to_user'
            && message?.noticeKind !== 'group_friend_private_chat'
        ));
        const selectedMessages = publicMessages.slice(-limit);

        return {
            messageLimit: limit,
            availableMessageCount: publicMessages.length,
            selectedMessageCount: selectedMessages.length,
            selectedMessages
        };
    }

    function getRecentUserRounds(messages, roundLimit = 5) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const limit = normalizeRoundLimit(roundLimit, 5);
        const userMessageIndexes = [];

        safeMessages.forEach((message, index) => {
            if (message?.role === 'user') userMessageIndexes.push(index);
        });

        const selectedRounds = Math.min(limit, userMessageIndexes.length);
        const startIndex = selectedRounds > 0
            ? userMessageIndexes[userMessageIndexes.length - selectedRounds]
            : safeMessages.length;
        const selectedMessages = selectedRounds > 0 ? safeMessages.slice(startIndex) : [];

        return {
            roundLimit: limit,
            availableRounds: userMessageIndexes.length,
            selectedRounds,
            selectedMessageCount: selectedMessages.length,
            startIndex,
            selectedMessages
        };
    }

    function normalizeLocalDateTime(value) {
        const text = String(value || '').trim();
        if (!text) return '';
        const match = text.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);
        return match ? `${match[1]}T${match[2]}` : '';
    }

    function splitLocalDateTime(value) {
        const normalized = normalizeLocalDateTime(value);
        if (!normalized) return { date: '', time: '' };
        const [date, time] = normalized.split('T');
        return { date, time };
    }

    function formatLocalDateTime(value) {
        const normalized = normalizeLocalDateTime(value);
        if (!normalized) return '';
        const date = new Date(normalized);
        if (Number.isNaN(date.getTime())) return '';
        return `${date.getFullYear()}年${pad2(date.getMonth() + 1)}月${pad2(date.getDate())}日 ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    }

    function normalizeScheduleEvent(event, index = 0) {
        if (!event || typeof event !== 'object') return null;
        const source = { ...event };
        const name = String(source.name || source.title || '未命名行程').trim() || '未命名行程';
        let rawTime = normalizeLocalDateTime(source.rawTime || source.startAt);
        const rawParts = splitLocalDateTime(rawTime);
        let date = String(source.date || rawParts.date || '').trim();
        let startTime = String(source.startTime || rawParts.time || '').trim().slice(0, 5);

        if (!rawTime && /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(startTime)) {
            rawTime = `${date}T${startTime}`;
        }
        if (!date || !startTime) {
            const derived = splitLocalDateTime(rawTime);
            date = date || derived.date;
            startTime = startTime || derived.time;
        }

        const sourceEndText = String(source.endAt || source.endTime || '').trim();
        let endAt = normalizeLocalDateTime(sourceEndText);
        let endTime = /^\d{2}:\d{2}$/.test(sourceEndText)
            ? sourceEndText
            : splitLocalDateTime(endAt).time;
        if (!endAt && date && endTime) endAt = `${date}T${endTime}`;
        if (!endTime) endTime = startTime;

        const formattedStart = formatLocalDateTime(rawTime);
        const formattedEnd = formatLocalDateTime(endAt);
        const displayTime = formattedStart
            ? (formattedEnd && formattedEnd !== formattedStart ? `${formattedStart} - ${formattedEnd}` : formattedStart)
            : String(source.time || startTime || '').trim();

        return {
            ...source,
            id: source.id != null ? source.id : `schedule-${Date.now()}-${index}`,
            name,
            title: String(source.title || name).trim() || name,
            date,
            startTime,
            endTime,
            time: displayTime,
            rawTime,
            endAt,
            location: String(source.location || source.description || '').trim(),
            source: String(source.source || '').trim(),
            timestamp: Number(source.timestamp) || Date.now()
        };
    }

    function normalizeSchedule(schedule) {
        const source = schedule && typeof schedule === 'object' ? schedule : {};
        const events = (Array.isArray(source.events) ? source.events : [])
            .map(normalizeScheduleEvent)
            .filter(Boolean)
            .sort((left, right) => {
                const leftTime = new Date(left.rawTime || 0).getTime() || Number(left.timestamp) || 0;
                const rightTime = new Date(right.rawTime || 0).getTime() || Number(right.timestamp) || 0;
                return leftTime - rightTime;
            });
        return {
            enabled: !!source.enabled,
            sleepTime: String(source.sleepTime || '23:00'),
            wakeTime: String(source.wakeTime || '07:00'),
            events
        };
    }

    function getSummaryBatch(messages, lastSummaryMessageCount = 0, roundLimit = 30) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const startIndex = Math.min(safeMessages.length, Math.max(0, Number(lastSummaryMessageCount) || 0));
        const limit = normalizeRoundLimit(roundLimit);
        let availableRounds = 0;
        for (let index = startIndex; index < safeMessages.length; index += 1) {
            if (safeMessages[index]?.role === 'user') availableRounds += 1;
        }

        let selectedRounds = 0;
        let endIndex = startIndex;
        for (let index = startIndex; index < safeMessages.length; index += 1) {
            const message = safeMessages[index];
            if (message?.role === 'user') {
                if (selectedRounds >= limit) break;
                selectedRounds += 1;
            }
            endIndex = index + 1;
        }

        if (selectedRounds === 0) endIndex = startIndex;
        const selectedMessages = safeMessages.slice(startIndex, endIndex);
        return {
            startIndex,
            endIndex,
            roundLimit: limit,
            availableRounds,
            unsummarizedMessageCount: safeMessages.length - startIndex,
            selectedRounds,
            selectedMessageCount: selectedMessages.length,
            selectedMessages,
            ready: availableRounds >= limit
        };
    }

    function removeShortTermSummaryEntry(entries, entryId) {
        const safeEntries = Array.isArray(entries) ? entries : [];
        return safeEntries.filter(entry => !entry || String(entry.id) !== String(entryId));
    }

    function parseStickerManifestText(text) {
        const items = [];
        const invalidLines = [];
        String(text || '').split(/\r?\n/).forEach((line, index) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            const match = trimmed.match(/^(.+?)\s+(https?:\/\/\S+)$/i);
            if (!match) {
                invalidLines.push(index + 1);
                return;
            }
            try {
                const parsed = new URL(match[2]);
                if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
                items.push({ name: match[1].trim(), url: parsed.href });
            } catch (_) {
                invalidLines.push(index + 1);
            }
        });
        return { items, invalidLines };
    }

    return {
        normalizeRoundLimit,
        normalizeMessageLimit,
        normalizeChatLanguage,
        getChatLanguageName,
        parseBilingualDialogue,
        normalizeGroupChatContexts,
        getRecentPublicGroupMessages,
        getRecentUserRounds,
        normalizeScheduleEvent,
        normalizeSchedule,
        getSummaryBatch,
        removeShortTermSummaryEntry,
        parseStickerManifestText
    };
});
