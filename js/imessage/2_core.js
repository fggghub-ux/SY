// ==========================================
// IMESSAGE: DATA, STATE, CORE SYSTEM & NAVIGATION
// ==========================================

window.imData = {
    friends: [],
    moments: [],
    momentMessages: [],
    currentActiveFriend: null,
    currentSettingsFriend: null,
    currentDetailMoment: null,
    currentOpenUserId: 'me',
    pendingImages: [],
    isPublishing: false,
    currentEditImageIndex: -1,
    cssPresets: [],
    tempSelectedBookIds: [],
    tempRelationshipDrafts: [],
    isRelationshipPickerVisible: false,
    longPressTimer: null,
    currentActiveRow: null,
    stickers: [],
    momentsCoverUrl: null,
    profilePanelUiStateByFriendId: {},
    ready: false,
    momentsLoaded: false,
    momentMessagesLoaded: false,
    stickersLoaded: false
};

window.imApp = window.imApp || {};

window.imApp.scopeUserCss = function(css, scope) {
    if (!css || !scope) return '';

    function findMatchingBrace(text, openIndex) {
        let depth = 0;
        let quote = null;
        let inComment = false;

        for (let i = openIndex; i < text.length; i += 1) {
            const char = text[i];
            const next = text[i + 1];

            if (inComment) {
                if (char === '*' && next === '/') {
                    inComment = false;
                    i += 1;
                }
                continue;
            }

            if (quote) {
                if (char === '\\') {
                    i += 1;
                } else if (char === quote) {
                    quote = null;
                }
                continue;
            }

            if (char === '/' && next === '*') {
                inComment = true;
                i += 1;
                continue;
            }

            if (char === '"' || char === "'") {
                quote = char;
                continue;
            }

            if (char === '{') depth += 1;
            if (char === '}') {
                depth -= 1;
                if (depth === 0) return i;
            }
        }

        return -1;
    }

    function splitSelectorList(selectorText) {
        const selectors = [];
        let current = '';
        let squareDepth = 0;
        let parenDepth = 0;
        let quote = null;

        for (let i = 0; i < selectorText.length; i += 1) {
            const char = selectorText[i];

            if (quote) {
                current += char;
                if (char === '\\') {
                    i += 1;
                    current += selectorText[i] || '';
                } else if (char === quote) {
                    quote = null;
                }
                continue;
            }

            if (char === '"' || char === "'") {
                quote = char;
                current += char;
                continue;
            }

            if (char === '[') squareDepth += 1;
            if (char === ']') squareDepth = Math.max(0, squareDepth - 1);
            if (char === '(') parenDepth += 1;
            if (char === ')') parenDepth = Math.max(0, parenDepth - 1);

            if (char === ',' && squareDepth === 0 && parenDepth === 0) {
                selectors.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        if (current.trim()) selectors.push(current.trim());
        return selectors;
    }

    function scopeSelector(selector) {
        const trimmed = selector.trim();
        if (!trimmed) return trimmed;
        if (trimmed.includes(':scope')) return trimmed.replace(/:scope/g, scope);
        if (trimmed === ':root' || trimmed === 'html' || trimmed === 'body') return scope;
        if (trimmed.startsWith(scope)) return trimmed;
        return `${scope} ${trimmed}`;
    }

    function scopeRules(text) {
        let output = '';
        let cursor = 0;

        while (cursor < text.length) {
            const openIndex = text.indexOf('{', cursor);
            if (openIndex === -1) {
                output += text.slice(cursor);
                break;
            }

            const prelude = text.slice(cursor, openIndex);
            const trimmedPrelude = prelude.trim();
            const closeIndex = findMatchingBrace(text, openIndex);

            if (closeIndex === -1) {
                output += text.slice(cursor);
                break;
            }

            const body = text.slice(openIndex + 1, closeIndex);
            const lowerPrelude = trimmedPrelude.toLowerCase();

            if (!trimmedPrelude) {
                output += text.slice(cursor, closeIndex + 1);
            } else if (
                lowerPrelude.startsWith('@media') ||
                lowerPrelude.startsWith('@supports') ||
                lowerPrelude.startsWith('@container') ||
                lowerPrelude.startsWith('@layer')
            ) {
                output += `${prelude}{${scopeRules(body)}}`;
            } else if (
                lowerPrelude.startsWith('@keyframes') ||
                lowerPrelude.startsWith('@-webkit-keyframes') ||
                lowerPrelude.startsWith('@font-face') ||
                lowerPrelude.startsWith('@property') ||
                lowerPrelude.startsWith('@page')
            ) {
                output += text.slice(cursor, closeIndex + 1);
            } else if (trimmedPrelude.startsWith('@')) {
                output += text.slice(cursor, closeIndex + 1);
            } else {
                const leadingWhitespace = prelude.match(/^\s*/)?.[0] || '';
                const scopedPrelude = splitSelectorList(trimmedPrelude).map(scopeSelector).join(', ');
                output += `${leadingWhitespace}${scopedPrelude}{${body}}`;
            }

            cursor = closeIndex + 1;
        }

        return output;
    }

    return scopeRules(String(css));
};

window.imApp.applyGlobalChatCss = function(themeState = window.u2ThemeState || {}) {
    const styleId = 'global-imessage-chat-css';
    let styleTag = document.getElementById(styleId);

    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
    }

    const enabled = !!themeState.imessageChatCssEnabled;
    const css = typeof themeState.imessageChatCss === 'string' ? themeState.imessageChatCss : '';
    styleTag.textContent = enabled && css.trim()
        ? window.imApp.scopeUserCss(css, '.active-chat-interface.im-chat-single')
        : '';
};

window.imApp.createDefaultMemory = function() {
    return {
        overview: '',
        anniversaries: '',
        context: { enabled: true, limit: 80, notes: '' },
        summary: { enabled: false, limit: 80, prompt: '' },
        longTerm: '',
        shortTermEntries: [],
        cherished: '',
        longTermEntries: [],
        cherishedEntries: [],
        relationships: [],
        socialAccounts: [],
        schedule: { enabled: false, sleepTime: '23:00', wakeTime: '07:00' },
        mountSettings: {},
        mountLimits: {}
    };
};

window.imApp.createDefaultLinkedAccountBot = function() {
    return {
        enabled: false,
        intervalSeconds: 60,
        lastRunAt: 0
    };
};

window.imApp.normalizeLinkedAccountBot = function(bot) {
    const defaultBot = window.imApp.createDefaultLinkedAccountBot();
    const source = bot && typeof bot === 'object' ? bot : {};
    const intervalSeconds = Number(source.intervalSeconds);

    return {
        enabled: !!source.enabled,
        intervalSeconds: Number.isFinite(intervalSeconds)
            ? Math.max(5, Math.min(86400, Math.round(intervalSeconds)))
            : defaultBot.intervalSeconds,
        lastRunAt: Number(source.lastRunAt) || defaultBot.lastRunAt
    };
};

window.imApp.normalizeLinkedAccountChats = function(chats) {
    if (!Array.isArray(chats)) return [];

    return chats
        .map((chat, index) => {
            if (!chat || typeof chat !== 'object') return null;
            const messages = Array.isArray(chat.messages)
                ? chat.messages
                    .map((message, messageIndex) => {
                        if (!message || typeof message !== 'object') return null;
                        const text = typeof message.text === 'string'
                            ? message.text.trim()
                            : (typeof message.content === 'string' ? message.content.trim() : '');
                        if (!text) return null;
                        const role = message.role === 'char' ? 'char' : 'account';
                        const timestamp = Number(message.timestamp) || Date.now() + messageIndex;
                        return {
                            id: message.id || `linked-msg-${timestamp}-${messageIndex}`,
                            role,
                            text,
                            timestamp
                        };
                    })
                    .filter(Boolean)
                : [];
            const now = Date.now();
            const updatedAt = Number(chat.updatedAt) || (messages.length > 0 ? messages[messages.length - 1].timestamp : now);

            return {
                id: chat.id || `linked-chat-${updatedAt}-${index}`,
                name: typeof chat.name === 'string' && chat.name.trim() ? chat.name.trim() : `Linked Friend ${index + 1}`,
                realName: typeof chat.realName === 'string' && chat.realName.trim()
                    ? chat.realName.trim()
                    : (typeof chat.name === 'string' ? chat.name.trim() : ''),
                remark: typeof chat.remark === 'string' ? chat.remark.trim() : '',
                handle: typeof chat.handle === 'string' ? chat.handle.trim() : '',
                persona: typeof chat.persona === 'string' ? chat.persona.trim() : '',
                relationship: typeof chat.relationship === 'string' ? chat.relationship.trim() : '',
                avatarSeed: typeof chat.avatarSeed === 'string' && chat.avatarSeed.trim()
                    ? chat.avatarSeed.trim()
                    : (typeof chat.handle === 'string' && chat.handle.trim() ? chat.handle.trim() : (typeof chat.name === 'string' ? chat.name.trim() : `linked-${index}`)),
                sourceNpcId: chat.sourceNpcId != null ? String(chat.sourceNpcId) : '',
                messages,
                createdAt: Number(chat.createdAt) || updatedAt,
                updatedAt,
                readAt: Number(chat.readAt) || 0
            };
        })
        .filter(Boolean);
};

window.imApp.isCharacterSleeping = function(friend) {
    if (!friend || !friend.memory || !friend.memory.schedule || !friend.memory.schedule.enabled) {
        return false;
    }
    
    const schedule = friend.memory.schedule;
    const sleepTime = schedule.sleepTime || '23:00';
    const wakeTime = schedule.wakeTime || '07:00';
    
    if (sleepTime === wakeTime) return false;

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    const parseTime = (timeStr) => {
        const parts = timeStr.split(':');
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };

    const sleepTotalMinutes = parseTime(sleepTime);
    const wakeTotalMinutes = parseTime(wakeTime);

    if (sleepTotalMinutes < wakeTotalMinutes) {
        // Sleep and wake on the same day (e.g. 13:00 to 15:00)
        return currentTotalMinutes >= sleepTotalMinutes && currentTotalMinutes < wakeTotalMinutes;
    } else {
        // Cross midnight (e.g. 23:00 to 07:00)
        return currentTotalMinutes >= sleepTotalMinutes || currentTotalMinutes < wakeTotalMinutes;
    }
};

window.imApp.createDefaultProfilePanel = function(friend = {}) {
    return {
        activeTab: 'thought',
        thought: friend?.profilePanel?.thought || friend?.latestThought || '',
        location: friend?.profilePanel?.location || '未知位置',
        action: friend?.profilePanel?.action || '暂无动作',
        mood: friend?.profilePanel?.mood || '平静',
        expression: friend?.profilePanel?.expression || '自然',
        affection: typeof friend?.profilePanel?.affection === 'number' ? friend.profilePanel.affection : 0,
        affectionChange: typeof friend?.profilePanel?.affectionChange === 'number' ? friend.profilePanel.affectionChange : 0,
        status: friend?.profilePanel?.status || friend?.status || 'online',
        thoughtHistory: Array.isArray(friend?.profilePanel?.thoughtHistory) ? friend.profilePanel.thoughtHistory : [],
        events: Array.isArray(friend?.profilePanel?.events)
            ? friend.profilePanel.events.map((eventItem, index) => ({
                id: eventItem?.id != null ? eventItem.id : `event-${index}`,
                title: eventItem?.title || '新的事件',
                description: eventItem?.description || '',
                time: eventItem?.time || '',
                type: eventItem?.type || 'note',
                status: eventItem?.status || 'pending',
                requestText: eventItem?.requestText || '',
                detail: eventItem?.detail || '',
                confirmText: eventItem?.confirmText || '确认',
                cancelText: eventItem?.cancelText || '取消',
                memoryPayload: eventItem?.memoryPayload && typeof eventItem.memoryPayload === 'object'
                    ? {
                        title: eventItem.memoryPayload.title || eventItem?.title || '珍视回忆',
                        content: eventItem.memoryPayload.content || eventItem?.requestText || eventItem?.description || '',
                        detail: eventItem.memoryPayload.detail || eventItem?.detail || '',
                        reason: eventItem.memoryPayload.reason || '',
                        sourceEventId: eventItem.memoryPayload.sourceEventId || (eventItem?.id != null ? eventItem.id : `event-${index}`),
                        createdAt: eventItem.memoryPayload.createdAt || eventItem?.time || '',
                        sourceThought: eventItem.memoryPayload.sourceThought || ''
                    }
                    : null
            }))
            : []
    };
};

window.imApp.normalizeFriendData = function(friend) {
    const normalized = { ...friend };
    normalized.id = normalized.id != null ? normalized.id : Date.now();
    normalized.type = normalized.type || 'char';
    const isGroupChat = normalized.type === 'group';
    normalized.realName = normalized.realName || '';
    normalized.nickname = normalized.nickname || (normalized.type === 'npc' ? 'New NPC' : 'New Friend');
    normalized.signature = normalized.signature || 'No Signature';
    normalized.persona = normalized.persona || '';
    normalized.avatarUrl = normalized.avatarUrl || null;
    normalized.avatarAssetId = normalized.avatarAssetId || null;
    normalized.messages = Array.isArray(normalized.messages) ? normalized.messages : [];
    normalized.chatBg = normalized.chatBg || null;
    normalized.chatBgAssetId = normalized.chatBgAssetId || null;
    normalized.customCssEnabled = !!normalized.customCssEnabled;
    normalized.customCss = normalized.customCss || '';
    normalized.chatCssEnabled = !!normalized.chatCssEnabled;
    normalized.chatCss = normalized.chatCss || '';
    normalized.statusCssEnabled = !!normalized.statusCssEnabled;
    normalized.statusCss = normalized.statusCss || '';
    normalized.isPinned = !!normalized.isPinned;
    normalized.unreadCount = Math.max(0, Number(normalized.unreadCount) || 0);
    normalized.showTimestamp = !!normalized.showTimestamp;
    normalized.timeAware = normalized.timeAware !== false;
    normalized.timestampPosition = normalized.timestampPosition === 'outside' ? 'outside' : 'inside';
    normalized.boundBooks = Array.isArray(normalized.boundBooks) ? normalized.boundBooks : [];
    normalized.momentsCover = normalized.momentsCover || null;
    normalized.momentsCoverAssetId = normalized.momentsCoverAssetId || null;
    normalized.members = Array.isArray(normalized.members) ? normalized.members : [];
    normalized.memberProfiles = (friend.memberProfiles && typeof friend.memberProfiles === 'object') ? friend.memberProfiles : {};
    normalized.botEnabled = !!normalized.botEnabled;
    normalized.offlineMeetEnabled = !!normalized.offlineMeetEnabled;
    normalized.linkedAccountBot = window.imApp.normalizeLinkedAccountBot(normalized.linkedAccountBot);
    normalized.linkedAccountChats = window.imApp.normalizeLinkedAccountChats(normalized.linkedAccountChats);

    normalized.profilePanel = window.imApp.createDefaultProfilePanel(friend);
    normalized.latestThought = normalized.profilePanel.thought;
    normalized.status = normalized.profilePanel.status || normalized.status || 'online';

    const defaultMemory = window.imApp.createDefaultMemory();
    const memory = normalized.memory || {};
    normalized.memory = {
        overview: memory.overview || defaultMemory.overview,
        anniversaries: memory.anniversaries || defaultMemory.anniversaries,
        schedule: {
            enabled: typeof memory.schedule?.enabled === 'boolean' ? memory.schedule.enabled : defaultMemory.schedule.enabled,
            sleepTime: memory.schedule?.sleepTime || defaultMemory.schedule.sleepTime,
            wakeTime: memory.schedule?.wakeTime || defaultMemory.schedule.wakeTime
        },
        context: {
            enabled: typeof memory.context?.enabled === 'boolean' ? memory.context.enabled : defaultMemory.context.enabled,
            limit: Number(memory.context?.limit) > 0
                ? Number(memory.context.limit)
                : (isGroupChat ? 100 : defaultMemory.context.limit),
            notes: memory.context?.notes || defaultMemory.context.notes
        },
        summary: {
            enabled: typeof memory.summary?.enabled === 'boolean' ? memory.summary.enabled : defaultMemory.summary.enabled,
            limit: Number(memory.summary?.limit) > 0 ? Number(memory.summary.limit) : defaultMemory.summary.limit,
            prompt: memory.summary?.prompt || defaultMemory.summary.prompt
        },
        longTerm: memory.longTerm || defaultMemory.longTerm,
        shortTermEntries: Array.isArray(memory.shortTermEntries)
            ? memory.shortTermEntries.map((entry, index) => ({
                id: entry?.id != null ? entry.id : `shortterm-${index}`,
                title: entry?.title || '对话总结',
                time: entry?.time || entry?.createdAt || '',
                event: entry?.event || entry?.content || '',
                memoryPoints: entry?.memoryPoints || entry?.points || '',
                degree: entry?.degree || '高',
                lastActivatedAt: entry?.lastActivatedAt || entry?.activatedAt || entry?.time || entry?.createdAt || '',
                raw: entry?.raw || ''
            }))
            : defaultMemory.shortTermEntries,
        longTermEntries: Array.isArray(memory.longTermEntries)
            ? memory.longTermEntries.map((entry, index) => ({
                id: entry?.id != null ? entry.id : `longterm-${index}`,
                title: entry?.title || '长期记忆',
                content: entry?.content || '',
                createdAt: entry?.createdAt || ''
            }))
            : defaultMemory.longTermEntries,
        lastSummaryMessageCount: typeof memory.lastSummaryMessageCount === 'number' ? memory.lastSummaryMessageCount : 0,
        cherished: memory.cherished || defaultMemory.cherished,
        cherishedEntries: Array.isArray(memory.cherishedEntries)
            ? memory.cherishedEntries.map((entry, index) => ({
                id: entry?.id != null ? entry.id : `cherished-${index}`,
                title: entry?.title || '下载项',
                content: entry?.content || '',
                detail: entry?.detail || '',
                reason: entry?.reason || '',
                sourceEventId: entry?.sourceEventId || '',
                createdAt: entry?.createdAt || '',
                sourceThought: entry?.sourceThought || ''
            }))
            : defaultMemory.cherishedEntries,
        relationships: Array.isArray(memory.relationships) ? memory.relationships : defaultMemory.relationships,
        socialAccounts: Array.isArray(memory.socialAccounts)
            ? memory.socialAccounts
                .map((account, index) => ({
                    platform: account?.platform || '',
                    label: account?.label || account?.platform || '社交帐号',
                    handle: account?.handle || '',
                    url: account?.url || '',
                    ytChannelId: account?.ytChannelId || account?.channelId || '',
                    updatedAt: account?.updatedAt || '',
                    id: account?.id || `social-${index}`
                }))
                .filter(account => account.platform || account.handle || account.url)
            : defaultMemory.socialAccounts,
        userOverride: memory.userOverride || null,
        mountSettings: (memory.mountSettings && typeof memory.mountSettings === 'object' && !Array.isArray(memory.mountSettings))
            ? { ...memory.mountSettings }
            : defaultMemory.mountSettings,
        mountLimits: (memory.mountLimits && typeof memory.mountLimits === 'object' && !Array.isArray(memory.mountLimits))
            ? Object.fromEntries(Object.entries(memory.mountLimits).map(([key, value]) => {
                const limit = Number(value);
                return [key, Number.isFinite(limit) && limit > 0 ? Math.max(1, Math.floor(limit)) : 20];
            }))
            : defaultMemory.mountLimits
    };

    return normalized;
};

window.imApp.getContextLimit = function(friend) {
    const normalizedFriend = window.imApp.normalizeFriendData(friend || {});
    const defaultContextLimit = normalizedFriend.type === 'group' ? 100 : 100;

    if (normalizedFriend.memory?.context?.enabled === false) {
        return 0;
    }

    return Number(normalizedFriend.memory?.context?.limit) > 0
        ? Number(normalizedFriend.memory.context.limit)
        : defaultContextLimit;
};

window.imApp.getRecentContextMessages = function(friend) {
    const normalizedFriend = window.imApp.normalizeFriendData(friend || {});
    const contextLimit = window.imApp.getContextLimit(normalizedFriend);
    const allMessages = Array.isArray(normalizedFriend.messages) ? normalizedFriend.messages : [];
    return contextLimit > 0 ? allMessages.slice(-contextLimit) : [];
};

window.imApp.formatMessageForApiContext = function(message, friend, options = {}) {
    const normalizedFriend = window.imApp.normalizeFriendData(friend || {});
    const normalizedMessage = message || {};
    const isGroupChat = normalizedFriend.type === 'group';
    let apiContent = normalizedMessage.content || '';

    if (normalizedMessage.type === 'voice_message') {
        const voiceText = normalizedMessage.transcript || normalizedMessage.text || '';
        apiContent = normalizedMessage.role === 'user'
            ? `[用户发了一条语音消息，语音内容：${voiceText}]`
            : `[你发了一条语音消息，语音内容：${voiceText}]`;
    } else if (normalizedMessage.type === 'sticker') {
        const stickerName = normalizedMessage.stickerName || normalizedMessage.text || '表情包';
        const stickerCategory = normalizedMessage.stickerCategory || '';
        const stickerLabel = stickerCategory ? `${stickerCategory} / ${stickerName}` : stickerName;
        apiContent = normalizedMessage.role === 'user'
            ? `[用户发了一个表情包：${stickerLabel}]`
            : `[你发了一个表情包：${stickerLabel}]`;
    } else if (normalizedMessage.type === 'voice_call_record') {
        const duration = normalizedMessage.duration || 0;
        const callDurationText = `${Math.floor(duration / 60)}分${duration % 60}秒`;
        const callMessages = normalizedMessage.callMessages || [];
        const statusText = normalizedMessage.statusText || '通话记录';
        
        if (statusText === '已拒绝') {
            apiContent = `[提示：${normalizedMessage.isSelf ? '对方' : '你'}刚刚拒绝了这通语音通话。]`;
        } else if (statusText === '已取消') {
            apiContent = `[提示：${normalizedMessage.isSelf ? '你' : '对方'}刚刚取消了这通语音通话。]`;
        } else {
            if (callMessages.length > 0) {
                const userName = options.userName || window.userState?.name || 'User';
                const charName = normalizedFriend.nickname || '对方';
                const callTranscript = callMessages.map(m => {
                    const speaker = m.isSelf ? userName : charName;
                    const parts = [];
                    if (m.actionText) parts.push(String(m.actionText).trim());
                    if (m.thoughtText) parts.push(`心声：${String(m.thoughtText).trim()}`);
                    if (m.text) parts.push(`${speaker}：「${String(m.text).trim()}」`);
                    return parts.join('\n  ');
                }).filter(Boolean).join('\n  ');
                
                apiContent = `[提示：你们刚刚完成了一通语音通话，时长 ${callDurationText}。通话期间的交流内容如下：\n  ${callTranscript}\n（通话已结束，请直接用普通文字回复）]`;
            } else {
                apiContent = `[提示：你们刚刚完成了一通语音通话，时长 ${callDurationText}，未产生可识别的文本记录。（通话已结束，请直接用普通文字回复）]`;
            }
        }
    } else if (normalizedMessage.type === 'moment_forward') {
        try {
            const momentData = JSON.parse(normalizedMessage.content);
            const momentText = momentData.text || '无配文';
            apiContent = `[转发了一条朋友圈, 内容: "${momentText}"]`;
            if (momentData.img) {
                if (momentData.imgDesc) {
                    apiContent += ` (附带图片: ${momentData.imgDesc})`;
                } else {
                    apiContent += ` (附带图片)`;
                }
            }
        } catch (e) {
            apiContent = `[转发了一条朋友圈]`;
        }
    } else if (normalizedMessage.type === 'image') {
        const imageDescription = normalizedMessage.text || normalizedMessage.description || normalizedMessage.fileName || '无描述';
        apiContent = `[发送了一张图片：${imageDescription}]`;
    } else if (normalizedMessage.type === 'pay_transfer') {
        const payAmount = Number(normalizedMessage.amount) || 0;
        const payDesc = normalizedMessage.description || '转账';
        const payTarget = normalizedMessage.targetName || normalizedFriend.nickname || '对方';

        if (normalizedMessage.payKind === 'user_to_char') {
            apiContent = `[用户刚刚向你转账 ¥${payAmount.toFixed(2)}，备注：${payDesc}，对象：${payTarget}。你可以收下这笔钱，也可以退回，或者正常回复。]`;
        } else if (normalizedMessage.payKind === 'char_received') {
            apiContent = `[你刚刚收下了用户的一笔转账 ¥${payAmount.toFixed(2)}，备注：${payDesc}。]`;
        } else if (normalizedMessage.payKind === 'char_to_user_pending') {
            apiContent = `[你刚刚向用户发起了一笔转账 ¥${payAmount.toFixed(2)}，备注：${payDesc}，等待用户领取。]`;
        } else if (normalizedMessage.payKind === 'char_to_user_claimed' || normalizedMessage.payKind === 'user_received_from_char') {
            apiContent = `[用户已领取你的转账 ¥${payAmount.toFixed(2)}，备注：${payDesc}。]`;
        } else if (normalizedMessage.payKind === 'user_rejected_from_char') {
            apiContent = `[用户退回了你的转账 ¥${payAmount.toFixed(2)}，备注：${payDesc}。]`;
        } else if (normalizedMessage.payKind === 'char_to_user_rejected' || normalizedMessage.payKind === 'user_to_char_rejected') {
            apiContent = `[你刚刚退回了用户的转账 ¥${payAmount.toFixed(2)}，备注：${payDesc}。]`;
        }
    }

    if (isGroupChat) {
        const userName = options.userName || window.userState?.name || 'User';
        if (normalizedMessage.role === 'user') {
            if (normalizedMessage.replyTo) {
                apiContent = `[引用了消息："${normalizedMessage.replyTo}"]\n${apiContent}`;
            }
            return {
                role: 'user',
                content: `User(${userName}): ${apiContent}`
            };
        }

        const assistantSpeaker = typeof normalizedMessage.speaker === 'string' && normalizedMessage.speaker.trim()
            ? normalizedMessage.speaker.trim()
            : '群成员';

        if (normalizedMessage.replyTo) {
            apiContent = `[引用了消息："${normalizedMessage.replyTo}"]\n${apiContent}`;
        }

        return {
            role: 'assistant',
            content: `${assistantSpeaker}: ${apiContent}`
        };
    }

    if (normalizedMessage.role === 'user' && normalizedMessage.replyTo) {
        apiContent = `[用户引用了消息："${normalizedMessage.replyTo}"]\n${normalizedMessage.content}`;
    }

    return {
        role: normalizedMessage.role,
        content: apiContent
    };
};

window.imApp.buildApiContextMessages = function(friend, options = {}) {
    const normalizedFriend = window.imApp.normalizeFriendData(friend || {});
    const recentMessages = window.imApp.getRecentContextMessages(normalizedFriend);

    return recentMessages
        .map(message => window.imApp.formatMessageForApiContext(message, normalizedFriend, options))
        .filter(item => item && item.role && typeof item.content === 'string' && item.content.trim());
};

window.imApp.buildLinkedAccountMemoryContext = function(friend, options = {}) {
    const normalizedFriend = window.imApp.normalizeFriendData(friend || {});
    const linkedChats = Array.isArray(normalizedFriend.linkedAccountChats)
        ? normalizedFriend.linkedAccountChats
        : [];
    if (linkedChats.length === 0) return '';

    const charName = normalizedFriend.nickname || normalizedFriend.realName || 'Char';
    const maxMessagesPerFriend = Math.max(1, Number(options.maxMessagesPerFriend) || 4);
    const lines = [
        'Linked Friend Memory / 关联好友记忆:',
        'These are private friend chats belonging to the character. They are context about the character\'s own friends, not messages from the current User.'
    ];

    linkedChats.forEach((chat, index) => {
        const displayName = chat.remark || chat.name || chat.realName || `Friend ${index + 1}`;
        const realName = chat.realName || chat.name || displayName;
        const recentMessages = Array.isArray(chat.messages)
            ? chat.messages.slice(-maxMessagesPerFriend)
            : [];

        lines.push('');
        lines.push(`Friend ${index + 1}: ${displayName}`);
        lines.push(`Real Name: ${realName || 'Unknown'}`);
        lines.push(`Remark: ${chat.remark || displayName || 'None'}`);
        lines.push(`Relationship: ${chat.relationship || 'None'}`);
        lines.push(`Persona: ${chat.persona || 'None'}`);
        lines.push('Recent private messages, fixed to the latest 2 rounds:');
        if (recentMessages.length === 0) {
            lines.push('None');
        } else {
            recentMessages.forEach(message => {
                const speaker = message.role === 'char' ? charName : displayName;
                lines.push(`${speaker}: ${message.text || ''}`);
            });
        }
    });

    return lines.join('\n');
};

window.imApp.getMomentMessages = function() {
    return Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : [];
};

window.imApp.setMomentMessages = function(messages) {
    window.imData.momentMessages = Array.isArray(messages) ? messages : [];
};

window.imApp.ensureFriendMessagesLoaded = async function(friendOrId, options = {}) {
    const targetId = typeof friendOrId === 'object' && friendOrId !== null ? friendOrId.id : friendOrId;
    if (targetId == null) return [];

    const targetFriend = (window.imData.friends || []).find(
        friend => String(friend.id) === String(targetId)
    );
    if (!targetFriend) return [];

    if (targetFriend.messagesLoaded && Array.isArray(targetFriend.messages)) {
        return targetFriend.messages;
    }

    try {
        if (!window.imStorage || !window.imStorage.loadMessagesByFriendId) {
            targetFriend.messages = Array.isArray(targetFriend.messages) ? targetFriend.messages : [];
            targetFriend.messagesLoaded = true;
            return targetFriend.messages;
        }

        const loadedMessages = await window.imStorage.loadMessagesByFriendId(targetId);
        targetFriend.messages = Array.isArray(loadedMessages) ? loadedMessages : [];
        targetFriend.messagesLoaded = true;
        targetFriend.messageCount = targetFriend.messages.length;

        if (targetFriend.messages.length > 0) {
            const lastMessage = targetFriend.messages[targetFriend.messages.length - 1];
            targetFriend.lastMessageTimestamp = Number(lastMessage?.timestamp) || targetFriend.lastMessageTimestamp || 0;
            targetFriend.lastMessagePreview =
                window.imApp.getFriendMessagePreview(lastMessage) ||
                targetFriend.lastMessagePreview ||
                '';
        }

        if (typeof options.onLoaded === 'function') {
            options.onLoaded(targetFriend.messages, targetFriend);
        }

        return targetFriend.messages;
    } catch (e) {
        console.error('Failed to load friend messages on demand', e);
        targetFriend.messages = Array.isArray(targetFriend.messages) ? targetFriend.messages : [];
        targetFriend.messagesLoaded = true;
        return targetFriend.messages;
    }
};

window.imApp.getMomentsCoverUrl = function() {
    return window.imData.momentsCoverUrl || null;
};

window.imApp.setMomentsCoverUrl = function(url) {
    window.imData.momentsCoverUrl = url || null;
};

window.imApp.cloneDataSnapshot = function(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
};

window.imApp.buildPersistedData = function() {
    return {
        friends: window.imApp.cloneDataSnapshot(Array.isArray(window.imData.friends) ? window.imData.friends : []),
        moments: window.imApp.cloneDataSnapshot(Array.isArray(window.imData.moments) ? window.imData.moments : []),
        momentMessages: window.imApp.cloneDataSnapshot(Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : []),
        stickers: window.imApp.cloneDataSnapshot(Array.isArray(window.imData.stickers) ? window.imData.stickers : []),
        momentsCoverUrl: window.imData.momentsCoverUrl || null
    };
};

window.imApp.markMomentsLoaded = function(loaded = true) {
    window.imData.momentsLoaded = !!loaded;
};

window.imApp.markMomentMessagesLoaded = function(loaded = true) {
    window.imData.momentMessagesLoaded = !!loaded;
};

window.imApp.markStickersLoaded = function(loaded = true) {
    window.imData.stickersLoaded = !!loaded;
};

window.imApp.getFriendMessagePreview = function(message) {
    const targetMessage = message || {};
    if (targetMessage.type === 'image') {
        const desc = targetMessage.text || targetMessage.description || '';
        return desc ? `[图片] ${desc}`.trim() : '[图片]';
    }
    if (targetMessage.type === 'voice_message') {
        return `[语音] ${targetMessage.transcript || targetMessage.text || ''}`.trim();
    }
    if (targetMessage.type === 'sticker') {
        const name = targetMessage.stickerName || targetMessage.text || '';
        return name ? `[表情包] ${name}`.trim() : '[表情包]';
    }
    if (targetMessage.type === 'moment_forward') {
        let content = '';
        try {
            if (targetMessage.content) {
                const parsed = JSON.parse(targetMessage.content);
                content = parsed.text || '';
            }
        } catch(e) {}
        return content ? `[朋友圈] ${content}`.trim() : '[朋友圈]';
    }
    if (targetMessage.type === 'pay_transfer') {
        return `[转账] ${targetMessage.description || ''}`.trim();
    }
    if (targetMessage.type === 'group_red_packet') {
        return `[群红包] ${targetMessage.description || ''}`.trim();
    }
    if (targetMessage.type === 'voice_call_record') {
        return targetMessage.text || `[语音通话记录] ${targetMessage.statusText || ''}`.trim();
    }
    if (targetMessage.type === 'html') {
        return targetMessage.text || '[卡片消息]';
    }
    return targetMessage.content || targetMessage.text || '';
};

window.imApp.syncFriendMessageSummary = function(friend) {
    if (!friend) return null;

    const messages = Array.isArray(friend.messages) ? friend.messages : [];
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

    friend.messages = messages;
    friend.messagesLoaded = true;
    friend.messageCount = messages.length;
    friend.lastMessageTimestamp = Number(lastMessage?.timestamp) || 0;
    friend.lastMessagePreview = lastMessage
        ? window.imApp.getFriendMessagePreview(lastMessage)
        : '';

    return friend;
};

window.imApp.getTotalUnreadCount = function() {
    return (Array.isArray(window.imData.friends) ? window.imData.friends : [])
        .reduce((total, friend) => total + Math.max(0, Number(friend?.unreadCount) || 0), 0);
};

window.imApp.updateChatsUnreadBadges = function() {
    const navChatsBtn = document.getElementById('nav-chats-btn');
    if (!navChatsBtn) return;

    let badge = navChatsBtn.querySelector('.nav-chats-unread-badge');
    const totalUnread = window.imApp.getTotalUnreadCount();
    const shouldShow = totalUnread > 0 && !navChatsBtn.classList.contains('active');

    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'nav-chats-unread-badge';
        badge.style.cssText = 'position:absolute; top:6px; right:14px; min-width:16px; height:16px; padding:0 4px; border-radius:999px; background:#ff3b30; color:#fff; font-size:10px; font-weight:700; line-height:16px; text-align:center; box-sizing:border-box; display:none; pointer-events:none;';
        navChatsBtn.style.position = navChatsBtn.style.position || 'relative';
        navChatsBtn.appendChild(badge);
    }

    badge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
    badge.style.display = shouldShow ? 'block' : 'none';
};

window.imApp.clearFriendUnread = async function(friendId, options = {}) {
    const safeFriendId = String(friendId);
    const targetFriend = (window.imData.friends || []).find(
        friend => String(friend.id) === safeFriendId
    );
    if (!targetFriend) return false;

    if (!targetFriend.unreadCount) {
        if (window.imApp.updateChatsUnreadBadges) window.imApp.updateChatsUnreadBadges();
        return true;
    }

    targetFriend.unreadCount = 0;
    try {
        if (window.imStorage?.saveFriendMeta) {
            await window.imStorage.saveFriendMeta(targetFriend);
        } else if (window.imApp.commitFriendChange) {
            await window.imApp.commitFriendChange(safeFriendId, (friend) => {
                if (friend) friend.unreadCount = 0;
            }, { silent: true, metaOnly: true });
        }
    } catch (error) {
        console.error('Failed to clear unread count', error);
        if (!options.silent && window.showToast) window.showToast('未读状态保存失败');
        return false;
    } finally {
        if (window.imChat?.renderChatsList) window.imChat.renderChatsList();
        if (window.imApp.updateChatsUnreadBadges) window.imApp.updateChatsUnreadBadges();
    }

    return true;
};

window.imApp.reindexFriendMessages = function(friend) {
    if (!friend || !Array.isArray(friend.messages)) return [];

    friend.messages.forEach((message, index) => {
        if (message && typeof message === 'object') {
            message.__messageOrder = index;
        }
    });

    return friend.messages;
};

window.imApp.findFriendMessageIndex = function(friend, descriptor) {
    const messages = Array.isArray(friend?.messages) ? friend.messages : [];
    if (messages.length === 0 || descriptor == null) return -1;

    if (typeof descriptor === 'function') {
        return messages.findIndex(descriptor);
    }

    const descriptorId = typeof descriptor === 'object' && descriptor !== null && descriptor.id != null
        ? String(descriptor.id)
        : (typeof descriptor !== 'object' ? String(descriptor) : null);
    const descriptorTimestamp = typeof descriptor === 'object' && descriptor !== null && descriptor.timestamp != null
        ? String(descriptor.timestamp)
        : null;

    return messages.findIndex((message) => {
        if (!message) return false;
        if (descriptorId && message.id != null && String(message.id) === descriptorId) return true;
        if (descriptorTimestamp && message.timestamp != null && String(message.timestamp) === descriptorTimestamp) return true;
        return false;
    });
};

window.imApp.syncActiveFriendReference = function(friend) {
    if (!friend) return;
    if (window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(friend.id)) {
        window.imData.currentActiveFriend = friend;
    }
};

window.imApp.syncSettingsFriendReference = function(friend) {
    if (!friend) return;
    if (window.imData.currentSettingsFriend && String(window.imData.currentSettingsFriend.id) === String(friend.id)) {
        window.imData.currentSettingsFriend = friend;
    }
};

window.imApp.clearFriendRuntimeMessageContext = function(friend) {
    if (!friend) return;
    if (friend.pendingRegenerateContext) delete friend.pendingRegenerateContext;
    if (window.imData.currentReplyText) window.imData.currentReplyText = null;
    const page = document.getElementById(`chat-interface-${friend.id}`);
    const replyPreview = page ? page.querySelector('.reply-preview-container') : null;
    if (replyPreview) replyPreview.style.display = 'none';
    if (window.imData.currentActiveRow) {
        window.imData.currentActiveRow.classList?.remove('message-active');
        window.imData.currentActiveRow = null;
    }
};

window.imApp.resolveFriendId = function(friendOrId) {
    if (friendOrId && typeof friendOrId === 'object') {
        return friendOrId.id;
    }
    return friendOrId;
};

window.imApp.getFriendById = function(friendOrId) {
    const targetId = window.imApp.resolveFriendId(friendOrId);
    if (targetId == null) return null;

    return (window.imData.friends || []).find(
        friend => String(friend.id) === String(targetId)
    ) || null;
};

window.imApp.commitScopedFriendChange = async function(friendOrId, mutator, options = {}) {
    if (!window.imApp.commitFriendChange) return false;

    const targetId = window.imApp.resolveFriendId(friendOrId);
    if (targetId == null) return false;

    return window.imApp.commitFriendChange(targetId, (targetFriend, friends, targetIndex) => {
        if (!targetFriend) return;

        if (options.syncActive !== false) {
            window.imApp.syncActiveFriendReference(targetFriend);
        }

        if (options.syncSettings === true) {
            window.imApp.syncSettingsFriendReference(targetFriend);
        }

        if (typeof options.onTargetResolved === 'function') {
            options.onTargetResolved(targetFriend, friends, targetIndex);
        }

        return typeof mutator === 'function'
            ? mutator(targetFriend, friends, targetIndex)
            : undefined;
    }, options);
};

window.imApp.runFriendPersistenceTask = async function(friendId, task) {
    const safeFriendId = String(friendId);
    const previousChain = window.imApp.saveState.friendFlushChains.get(safeFriendId) || Promise.resolve();

    const nextChain = previousChain.catch(() => false).then(async () => {
        return task();
    });

    window.imApp.saveState.friendFlushChains.set(safeFriendId, nextChain);

    try {
        return await nextChain;
    } finally {
        if (window.imApp.saveState.friendFlushChains.get(safeFriendId) === nextChain) {
            window.imApp.saveState.friendFlushChains.delete(safeFriendId);
        }
    }
};

window.imApp.saveState = {
    timer: null,
    delay: 800,
    dirty: false,
    isSaving: false,
    hasPendingSave: false,
    lastError: null,
    friendTimers: new Map(),
    momentTimers: new Map(),
    friendDirtyIds: new Set(),
    momentDirtyIds: new Set(),
    friendFlushChains: new Map(),
    momentFlushChains: new Map(),
    friendRevisions: new Map(),
    momentRevisions: new Map(),
    momentMessagesDirty: false,
    stickersDirty: false,
    momentsCoverDirty: false
};

window.imApp.markFriendDirty = function(friendId) {
    if (friendId == null) return;
    const safeFriendId = String(friendId);
    const currentRevision = window.imApp.saveState.friendRevisions.get(safeFriendId) || 0;
    window.imApp.saveState.friendRevisions.set(safeFriendId, currentRevision + 1);
    window.imApp.saveState.friendDirtyIds.add(safeFriendId);
    window.imApp.saveState.dirty = true;
};

window.imApp.markMomentDirty = function(momentId) {
    if (momentId == null) return;
    const safeMomentId = String(momentId);
    const currentRevision = window.imApp.saveState.momentRevisions.get(safeMomentId) || 0;
    window.imApp.saveState.momentRevisions.set(safeMomentId, currentRevision + 1);
    window.imApp.saveState.momentDirtyIds.add(safeMomentId);
    window.imApp.saveState.dirty = true;
};

window.imApp.markMomentMessagesDirty = function() {
    window.imApp.saveState.momentMessagesDirty = true;
    window.imApp.saveState.dirty = true;
};

window.imApp.markStickersDirty = function() {
    window.imApp.saveState.stickersDirty = true;
    window.imApp.saveState.dirty = true;
};

window.imApp.markMomentsCoverDirty = function() {
    window.imApp.saveState.momentsCoverDirty = true;
    window.imApp.saveState.dirty = true;
};

window.imApp.persistGlobalData = async function(options = {}) {
    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage || !window.imStorage.saveGlobalData) {
            throw new Error('imStorage.saveGlobalData unavailable');
        }

        const payload = window.imApp.buildPersistedData();
        await window.imStorage.saveGlobalData(payload);
        window.imApp.saveState.lastError = null;
        return true;
    } catch (e) {
        console.error('Failed to persist iMessage global data', e);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('保存失败，可能是浏览器存储不可用');
        }
        return false;
    }
};

window.imApp.persistFriendData = async function(friendId, options = {}) {
    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage || !window.imStorage.saveFriend) {
            throw new Error('imStorage.saveFriend unavailable');
        }

        const targetFriend = (window.imData.friends || []).find(
            friend => String(friend.id) === String(friendId)
        );

        if (!targetFriend) {
            if (window.imStorage.deleteFriend) {
                await window.imStorage.deleteFriend(friendId);
            }
            window.imApp.saveState.lastError = null;
            return true;
        }

        const friendSnapshot = window.imApp.cloneDataSnapshot(targetFriend);
        const shouldPersistMetaOnly = options.metaOnly === true && !!window.imStorage.saveFriendMetaOnly;

        if (shouldPersistMetaOnly) {
            await window.imStorage.saveFriendMetaOnly(friendSnapshot);
        } else {
            await window.imStorage.saveFriend(friendSnapshot, {
                skipMessages: options.includeMessages === false
            });
        }

        window.imApp.saveState.lastError = null;
        return true;
    } catch (e) {
        console.error('Failed to persist friend data', e);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('好友数据保存失败');
        }
        return false;
    }
};

window.imApp.persistMomentData = async function(momentId, options = {}) {
    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage) {
            throw new Error('imStorage unavailable');
        }

        const targetMoment = (window.imData.moments || []).find(
            moment => String(moment.id) === String(momentId)
        );

        if (!targetMoment) {
            if (window.imStorage.deleteMoment) {
                await window.imStorage.deleteMoment(momentId);
            }
            window.imApp.saveState.lastError = null;
            return true;
        }

        if (!window.imStorage.saveMoment) {
            throw new Error('imStorage.saveMoment unavailable');
        }

        await window.imStorage.saveMoment(window.imApp.cloneDataSnapshot(targetMoment));
        window.imApp.saveState.lastError = null;
        return true;
    } catch (e) {
        console.error('Failed to persist moment data', e);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('朋友圈数据保存失败');
        }
        return false;
    }
};

window.imApp.appendFriendMessage = async function(friendId, message, options = {}) {
    const safeFriendId = String(friendId);
    const targetFriend = (window.imData.friends || []).find(
        friend => String(friend.id) === safeFriendId
    );

    if (!targetFriend) return false;
    if (window.imApp.ensureFriendMessagesLoaded) {
        await window.imApp.ensureFriendMessagesLoaded(targetFriend);
    }
    if (!Array.isArray(targetFriend.messages)) targetFriend.messages = [];

    const targetMessage = message && typeof message === 'object' ? message : {};
    const previousUnreadCount = Math.max(0, Number(targetFriend.unreadCount) || 0);
    const nextOrder = targetFriend.messages.length;
    targetMessage.__messageOrder = nextOrder;
    targetFriend.messages.push(targetMessage);
    window.imApp.syncFriendMessageSummary(targetFriend);

    const isIncomingMessage = targetMessage.role !== 'user';
    const isActiveChat = window.imData.currentActiveFriend &&
        String(window.imData.currentActiveFriend.id) === safeFriendId;
    if (isIncomingMessage && !isActiveChat) {
        targetFriend.unreadCount = Math.max(0, Number(targetFriend.unreadCount) || 0) + 1;
    }

    window.imApp.syncActiveFriendReference(targetFriend);

    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage?.saveFriendMessage || !window.imStorage?.saveFriendMeta) {
            throw new Error('Incremental friend message persistence unavailable');
        }

        const persistedMessage = await window.imApp.runFriendPersistenceTask(safeFriendId, async () => {
            const stored = await window.imStorage.saveFriendMessage(safeFriendId, targetMessage, nextOrder);
            await window.imStorage.saveFriendMeta(targetFriend);
            return stored;
        });

        if (persistedMessage && persistedMessage.id && !targetMessage.id) {
            targetMessage.id = persistedMessage.id;
        }
        targetMessage.__messageOrder = nextOrder;
        window.imApp.saveState.lastError = null;
        if (window.imChat?.renderChatsList) window.imChat.renderChatsList();
        if (window.imApp.updateChatsUnreadBadges) window.imApp.updateChatsUnreadBadges();
        if (isIncomingMessage && window.u2SystemNotifications?.notifyIncomingMessage) {
            window.u2SystemNotifications.notifyIncomingMessage({
                friend: targetFriend,
                message: targetMessage
            });
        }
        return true;
    } catch (e) {
        console.error('Failed to append friend message', e);
        targetFriend.messages = targetFriend.messages.filter((item, index) => {
            if (item === targetMessage) return false;
            if (targetMessage.id && item?.id && String(item.id) === String(targetMessage.id)) return false;
            return !(index === nextOrder && item?.timestamp != null && targetMessage.timestamp != null && String(item.timestamp) === String(targetMessage.timestamp));
        });
        window.imApp.reindexFriendMessages(targetFriend);
        window.imApp.syncFriendMessageSummary(targetFriend);
        targetFriend.unreadCount = previousUnreadCount;
        window.imApp.syncActiveFriendReference(targetFriend);
        if (window.imChat?.renderChatsList) window.imChat.renderChatsList();
        if (window.imApp.updateChatsUnreadBadges) window.imApp.updateChatsUnreadBadges();
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('消息保存失败');
        }
        return false;
    }
};

window.imApp.updateFriendMessage = async function(friendId, descriptor, mutator, options = {}) {
    const safeFriendId = String(friendId);
    const targetFriend = (window.imData.friends || []).find(
        friend => String(friend.id) === safeFriendId
    );

    if (!targetFriend) return false;
    if (window.imApp.ensureFriendMessagesLoaded) {
        await window.imApp.ensureFriendMessagesLoaded(targetFriend);
    }
    if (!Array.isArray(targetFriend.messages)) return false;

    const targetIndex = window.imApp.findFriendMessageIndex(targetFriend, descriptor);
    if (targetIndex < 0) return false;

    const previousMessage = window.imApp.cloneDataSnapshot(targetFriend.messages[targetIndex]);
    const targetMessage = targetFriend.messages[targetIndex];

    try {
        if (typeof mutator === 'function') {
            await mutator(targetMessage, targetFriend, targetIndex);
        }

        targetMessage.__messageOrder = targetIndex;
        window.imApp.syncFriendMessageSummary(targetFriend);
        window.imApp.syncActiveFriendReference(targetFriend);

        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage?.saveFriendMessage || !window.imStorage?.saveFriendMeta) {
            throw new Error('Incremental friend message persistence unavailable');
        }

        const persistedMessage = await window.imApp.runFriendPersistenceTask(safeFriendId, async () => {
            const stored = await window.imStorage.saveFriendMessage(safeFriendId, targetMessage, targetIndex);
            await window.imStorage.saveFriendMeta(targetFriend);
            return stored;
        });

        if (persistedMessage && persistedMessage.id && !targetMessage.id) {
            targetMessage.id = persistedMessage.id;
        }
        targetMessage.__messageOrder = targetIndex;
        window.imApp.saveState.lastError = null;
        return true;
    } catch (e) {
        console.error('Failed to update friend message', e);
        targetFriend.messages[targetIndex] = previousMessage;
        window.imApp.syncFriendMessageSummary(targetFriend);
        window.imApp.syncActiveFriendReference(targetFriend);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('消息保存失败');
        }
        return false;
    }
};

window.imApp.removeFriendMessages = async function(friendId, descriptors, options = {}) {
    const safeFriendId = String(friendId);
    const targetFriend = (window.imData.friends || []).find(
        friend => String(friend.id) === safeFriendId
    );

    if (!targetFriend) return false;
    if (window.imApp.ensureFriendMessagesLoaded) {
        await window.imApp.ensureFriendMessagesLoaded(targetFriend);
    }
    if (!Array.isArray(targetFriend.messages)) return false;

    const descriptorList = Array.isArray(descriptors) ? descriptors : [descriptors];
    const previousMessages = window.imApp.cloneDataSnapshot(targetFriend.messages);
    const removalIndexes = new Set();

    descriptorList.forEach((descriptor) => {
        const index = window.imApp.findFriendMessageIndex(targetFriend, descriptor);
        if (index > -1) removalIndexes.add(index);
    });

    if (removalIndexes.size === 0) return true;

    const sortedRemovalIndexes = Array.from(removalIndexes).sort((a, b) => a - b);
    const removedMessages = targetFriend.messages.filter((_, index) => removalIndexes.has(index));
    const canDeleteWithoutReindex = sortedRemovalIndexes.every((index, removalOrder) => {
        return index === (previousMessages.length - sortedRemovalIndexes.length + removalOrder);
    });

    targetFriend.messages = targetFriend.messages.filter((_, index) => !removalIndexes.has(index));
    window.imApp.reindexFriendMessages(targetFriend);
    window.imApp.syncFriendMessageSummary(targetFriend);
    window.imApp.clearFriendRuntimeMessageContext(targetFriend);
    window.imApp.syncActiveFriendReference(targetFriend);
    window.imApp.syncSettingsFriendReference(targetFriend);

    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage?.saveFriendMeta) {
            throw new Error('Friend meta persistence unavailable');
        }

        const removableIds = removedMessages
            .map((message) => message?.id ? String(message.id) : null)
            .filter(Boolean);

        await window.imApp.runFriendPersistenceTask(safeFriendId, async () => {
            if (
                canDeleteWithoutReindex &&
                removableIds.length === removedMessages.length &&
                window.imStorage?.deleteFriendMessages
            ) {
                await window.imStorage.deleteFriendMessages(removableIds);
            } else if (window.imStorage?.replaceFriendMessages) {
                await window.imStorage.replaceFriendMessages(safeFriendId, targetFriend.messages);
            } else {
                throw new Error('Friend message removal persistence unavailable');
            }

            await window.imStorage.saveFriendMeta(targetFriend);
            return true;
        });

        window.imApp.saveState.lastError = null;
        return true;
    } catch (e) {
        console.error('Failed to remove friend messages', e);
        targetFriend.messages = previousMessages;
        window.imApp.reindexFriendMessages(targetFriend);
        window.imApp.syncFriendMessageSummary(targetFriend);
        window.imApp.syncActiveFriendReference(targetFriend);
        window.imApp.syncSettingsFriendReference(targetFriend);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('删除消息失败');
        }
        return false;
    }
};

window.imApp.resetFriendMessages = async function(friendId, options = {}) {
    const safeFriendId = String(friendId);
    const targetFriend = (window.imData.friends || []).find(
        friend => String(friend.id) === safeFriendId
    );

    if (!targetFriend) return false;
    if (window.imApp.ensureFriendMessagesLoaded) {
        await window.imApp.ensureFriendMessagesLoaded(targetFriend);
    }

    const previousMessages = window.imApp.cloneDataSnapshot(Array.isArray(targetFriend.messages) ? targetFriend.messages : []);
    targetFriend.messages = [];
    window.imApp.syncFriendMessageSummary(targetFriend);
    window.imApp.clearFriendRuntimeMessageContext(targetFriend);
    window.imApp.syncActiveFriendReference(targetFriend);
    window.imApp.syncSettingsFriendReference(targetFriend);

    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage?.replaceFriendMessages || !window.imStorage?.saveFriendMeta) {
            throw new Error('Friend message reset persistence unavailable');
        }

        await window.imApp.runFriendPersistenceTask(safeFriendId, async () => {
            await window.imStorage.replaceFriendMessages(safeFriendId, []);
            await window.imStorage.saveFriendMeta(targetFriend);
            return true;
        });

        window.imApp.saveState.lastError = null;
        return true;
    } catch (e) {
        console.error('Failed to reset friend messages', e);
        targetFriend.messages = previousMessages;
        window.imApp.reindexFriendMessages(targetFriend);
        window.imApp.syncFriendMessageSummary(targetFriend);
        window.imApp.syncActiveFriendReference(targetFriend);
        window.imApp.syncSettingsFriendReference(targetFriend);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('聊天记录清空失败');
        }
        return false;
    }
};

window.imApp.persistMomentMessagesData = async function(options = {}) {
    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage || !window.imStorage.saveMomentMessages) {
            throw new Error('imStorage.saveMomentMessages unavailable');
        }

        await window.imStorage.saveMomentMessages(
            window.imApp.cloneDataSnapshot(Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : [])
        );
        window.imApp.saveState.lastError = null;
        return true;
    } catch (e) {
        console.error('Failed to persist moment message data', e);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('朋友圈通知保存失败');
        }
        return false;
    }
};

window.imApp.persistStickersData = async function(options = {}) {
    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage || !window.imStorage.saveStickers) {
            throw new Error('imStorage.saveStickers unavailable');
        }

        await window.imStorage.saveStickers(
            window.imApp.cloneDataSnapshot(Array.isArray(window.imData.stickers) ? window.imData.stickers : [])
        );
        window.imApp.saveState.lastError = null;
        return true;
    } catch (e) {
        console.error('Failed to persist sticker data', e);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('表情包保存失败');
        }
        return false;
    }
};

window.imApp.persistMomentsCoverData = async function(options = {}) {
    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (!window.imStorage || !window.imStorage.saveMomentsCover) {
            throw new Error('imStorage.saveMomentsCover unavailable');
        }

        await window.imStorage.saveMomentsCover(window.imData.momentsCoverUrl || null);
        window.imApp.saveState.lastError = null;
        return true;
    } catch (e) {
        console.error('Failed to persist moments cover data', e);
        window.imApp.saveState.lastError = e;
        if (!options.silent && window.showToast) {
            window.showToast('朋友圈封面保存失败');
        }
        return false;
    }
};

window.imApp.flushFriendSave = async function(friendId, options = {}) {
    const safeFriendId = String(friendId);
    const timerRecord = window.imApp.saveState.friendTimers.get(safeFriendId);
    if (timerRecord) {
        clearTimeout(timerRecord.timer || timerRecord);
        window.imApp.saveState.friendTimers.delete(safeFriendId);
    }

    const previousChain = window.imApp.saveState.friendFlushChains.get(safeFriendId) || Promise.resolve();
    const nextChain = previousChain.catch(() => false).then(async () => {
        const revisionBeforeSave = window.imApp.saveState.friendRevisions.get(safeFriendId) || 0;
        const timerOptions = timerRecord && typeof timerRecord === 'object' ? (timerRecord.options || {}) : {};
        const persistOptions = {
            ...timerOptions,
            ...options
        };
        const saved = await window.imApp.persistFriendData(safeFriendId, persistOptions);

        if (saved) {
            const latestRevision = window.imApp.saveState.friendRevisions.get(safeFriendId) || 0;
            if (latestRevision === revisionBeforeSave) {
                window.imApp.saveState.friendDirtyIds.delete(safeFriendId);
            }
        }

        window.imApp.saveState.dirty =
            window.imApp.saveState.friendDirtyIds.size > 0 ||
            window.imApp.saveState.momentDirtyIds.size > 0 ||
            window.imApp.saveState.momentMessagesDirty ||
            window.imApp.saveState.stickersDirty ||
            window.imApp.saveState.momentsCoverDirty;

        return saved;
    });

    window.imApp.saveState.friendFlushChains.set(safeFriendId, nextChain);

    try {
        return await nextChain;
    } finally {
        if (window.imApp.saveState.friendFlushChains.get(safeFriendId) === nextChain) {
            window.imApp.saveState.friendFlushChains.delete(safeFriendId);
        }
    }
};

window.imApp.scheduleFriendSave = function(friendId, options = {}) {
    if (friendId == null) return false;
    const safeFriendId = String(friendId);
    const delay = Number.isFinite(Number(options.delay)) ? Number(options.delay) : 500;

    window.imApp.markFriendDirty(safeFriendId);

    const existingTimer = window.imApp.saveState.friendTimers.get(safeFriendId);
    if (existingTimer) {
        clearTimeout(existingTimer.timer || existingTimer);
    }

    const timerOptions = {
        silent: options.silent !== false,
        metaOnly: options.metaOnly === true,
        includeMessages: options.includeMessages
    };

    const timer = setTimeout(() => {
        window.imApp.flushFriendSave(safeFriendId, timerOptions);
    }, Math.max(0, delay));

    window.imApp.saveState.friendTimers.set(safeFriendId, {
        timer,
        options: timerOptions
    });
    return true;
};

window.imApp.flushMomentSave = async function(momentId, options = {}) {
    const safeMomentId = String(momentId);
    const timer = window.imApp.saveState.momentTimers.get(safeMomentId);
    if (timer) {
        clearTimeout(timer);
        window.imApp.saveState.momentTimers.delete(safeMomentId);
    }

    const previousChain = window.imApp.saveState.momentFlushChains.get(safeMomentId) || Promise.resolve();
    const nextChain = previousChain.catch(() => false).then(async () => {
        const revisionBeforeSave = window.imApp.saveState.momentRevisions.get(safeMomentId) || 0;
        const saved = await window.imApp.persistMomentData(safeMomentId, options);

        if (saved) {
            const latestRevision = window.imApp.saveState.momentRevisions.get(safeMomentId) || 0;
            if (latestRevision === revisionBeforeSave) {
                window.imApp.saveState.momentDirtyIds.delete(safeMomentId);
            }
        }

        window.imApp.saveState.dirty =
            window.imApp.saveState.friendDirtyIds.size > 0 ||
            window.imApp.saveState.momentDirtyIds.size > 0 ||
            window.imApp.saveState.momentMessagesDirty ||
            window.imApp.saveState.stickersDirty ||
            window.imApp.saveState.momentsCoverDirty;

        return saved;
    });

    window.imApp.saveState.momentFlushChains.set(safeMomentId, nextChain);

    try {
        return await nextChain;
    } finally {
        if (window.imApp.saveState.momentFlushChains.get(safeMomentId) === nextChain) {
            window.imApp.saveState.momentFlushChains.delete(safeMomentId);
        }
    }
};

window.imApp.scheduleMomentSave = function(momentId, options = {}) {
    if (momentId == null) return false;
    const safeMomentId = String(momentId);
    const delay = Number.isFinite(Number(options.delay)) ? Number(options.delay) : 500;

    window.imApp.markMomentDirty(safeMomentId);

    const existingTimer = window.imApp.saveState.momentTimers.get(safeMomentId);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
        window.imApp.flushMomentSave(safeMomentId, {
            silent: options.silent !== false
        });
    }, Math.max(0, delay));

    window.imApp.saveState.momentTimers.set(safeMomentId, timer);
    return true;
};

window.imApp.flushMomentMessagesSave = async function(options = {}) {
    const saved = await window.imApp.persistMomentMessagesData(options);
    if (saved) {
        window.imApp.saveState.momentMessagesDirty = false;
    }
    window.imApp.saveState.dirty =
        window.imApp.saveState.friendDirtyIds.size > 0 ||
        window.imApp.saveState.momentDirtyIds.size > 0 ||
        window.imApp.saveState.momentMessagesDirty ||
        window.imApp.saveState.stickersDirty ||
        window.imApp.saveState.momentsCoverDirty;
    return saved;
};

window.imApp.flushStickersSave = async function(options = {}) {
    const saved = await window.imApp.persistStickersData(options);
    if (saved) {
        window.imApp.saveState.stickersDirty = false;
    }
    window.imApp.saveState.dirty =
        window.imApp.saveState.friendDirtyIds.size > 0 ||
        window.imApp.saveState.momentDirtyIds.size > 0 ||
        window.imApp.saveState.momentMessagesDirty ||
        window.imApp.saveState.stickersDirty ||
        window.imApp.saveState.momentsCoverDirty;
    return saved;
};

window.imApp.flushMomentsCoverSave = async function(options = {}) {
    const saved = await window.imApp.persistMomentsCoverData(options);
    if (saved) {
        window.imApp.saveState.momentsCoverDirty = false;
    }
    window.imApp.saveState.dirty =
        window.imApp.saveState.friendDirtyIds.size > 0 ||
        window.imApp.saveState.momentDirtyIds.size > 0 ||
        window.imApp.saveState.momentMessagesDirty ||
        window.imApp.saveState.stickersDirty ||
        window.imApp.saveState.momentsCoverDirty;
    return saved;
};

window.imApp.flushGlobalSave = async function(options = {}) {
    if (window.imApp.saveState.timer) {
        clearTimeout(window.imApp.saveState.timer);
        window.imApp.saveState.timer = null;
    }

    if (window.imApp.saveState.isSaving) {
        window.imApp.saveState.hasPendingSave = true;
        return true;
    }

    window.imApp.saveState.isSaving = true;
    try {
        do {
            window.imApp.saveState.hasPendingSave = false;

            const dirtyFriendIds = Array.from(window.imApp.saveState.friendDirtyIds);
            const dirtyMomentIds = Array.from(window.imApp.saveState.momentDirtyIds);

            for (const friendId of dirtyFriendIds) {
                const saved = await window.imApp.flushFriendSave(friendId, options);
                if (!saved) return false;
            }

            for (const momentId of dirtyMomentIds) {
                const saved = await window.imApp.flushMomentSave(momentId, options);
                if (!saved) return false;
            }

            if (window.imApp.saveState.momentMessagesDirty) {
                const saved = await window.imApp.flushMomentMessagesSave(options);
                if (!saved) return false;
            }

            if (window.imApp.saveState.stickersDirty) {
                const saved = await window.imApp.flushStickersSave(options);
                if (!saved) return false;
            }

            if (window.imApp.saveState.momentsCoverDirty) {
                const saved = await window.imApp.flushMomentsCoverSave(options);
                if (!saved) return false;
            }

            window.imApp.saveState.dirty =
                window.imApp.saveState.friendDirtyIds.size > 0 ||
                window.imApp.saveState.momentDirtyIds.size > 0 ||
                window.imApp.saveState.momentMessagesDirty ||
                window.imApp.saveState.stickersDirty ||
                window.imApp.saveState.momentsCoverDirty;
        } while (window.imApp.saveState.hasPendingSave);

        return true;
    } finally {
        window.imApp.saveState.isSaving = false;
    }
};

window.imApp.scheduleGlobalSave = function(options = {}) {
    const delay = Number.isFinite(Number(options.delay)) ? Number(options.delay) : window.imApp.saveState.delay;
    window.imApp.saveState.dirty = true;

    if (window.imApp.saveState.timer) {
        clearTimeout(window.imApp.saveState.timer);
    }

    window.imApp.saveState.timer = setTimeout(() => {
        window.imApp.flushGlobalSave({
            silent: options.silent !== false
        });
    }, Math.max(0, delay));

    return true;
};

window.imApp.commitGlobalChange = async function(mutator, options = {}) {
    const previousSnapshot = window.imApp.buildPersistedData();

    try {
        if (typeof mutator === 'function') {
            await mutator();
        }

        if (options.immediate === false) {
            window.imApp.scheduleGlobalSave({
                delay: options.delay,
                silent: options.silent !== false
            });

            if (typeof options.onSuccess === 'function') {
                options.onSuccess(window.imData);
            }
            return true;
        }

        const saved = await window.imApp.flushGlobalSave({
            silent: !!options.silent
        });

        if (!saved) {
            window.imData.friends = previousSnapshot.friends;
            window.imData.moments = previousSnapshot.moments;
            window.imData.momentMessages = previousSnapshot.momentMessages;
            window.imData.stickers = previousSnapshot.stickers;
            window.imData.momentsCoverUrl = previousSnapshot.momentsCoverUrl;
            if (typeof options.onRollback === 'function') {
                options.onRollback(window.imData);
            }
            return false;
        }

        if (typeof options.onSuccess === 'function') {
            options.onSuccess(window.imData);
        }

        return true;
    } catch (e) {
        console.error('Failed to commit global change', e);
        window.imData.friends = previousSnapshot.friends;
        window.imData.moments = previousSnapshot.moments;
        window.imData.momentMessages = previousSnapshot.momentMessages;
        window.imData.stickers = previousSnapshot.stickers;
        window.imData.momentsCoverUrl = previousSnapshot.momentsCoverUrl;
        if (typeof options.onRollback === 'function') {
            options.onRollback(window.imData);
        }
        if (!options.silent && window.showToast) {
            window.showToast('保存失败，已撤销本次修改');
        }
        return false;
    }
};

window.imApp.commitFriendChange = async function(friendId, mutator, options = {}) {
    const friends = Array.isArray(window.imData.friends) ? window.imData.friends : [];
    const targetIndex = friends.findIndex(
        friend => String(friend.id) === String(friendId)
    );
    const previousFriend = targetIndex > -1
        ? window.imApp.cloneDataSnapshot(friends[targetIndex])
        : null;

    try {
        const targetFriend = targetIndex > -1 ? friends[targetIndex] : null;

        if (typeof mutator === 'function') {
            await mutator(targetFriend, friends, targetIndex);
        }

        window.imApp.markFriendDirty(friendId);

        if (options.immediate === false) {
            window.imApp.scheduleFriendSave(friendId, {
                delay: options.delay,
                silent: options.silent !== false,
                metaOnly: options.metaOnly === true,
                includeMessages: options.includeMessages
            });

            if (typeof options.onSuccess === 'function') {
                options.onSuccess(window.imData.friends);
            }
            return true;
        }

        const saved = await window.imApp.flushFriendSave(friendId, {
            silent: !!options.silent,
            metaOnly: options.metaOnly === true,
            includeMessages: options.includeMessages
        });

        if (!saved) {
            if (targetIndex > -1) {
                if (previousFriend) {
                    window.imData.friends[targetIndex] = previousFriend;
                } else {
                    window.imData.friends.splice(targetIndex, 1);
                }
            }
            if (typeof options.onRollback === 'function') {
                options.onRollback(window.imData.friends);
            }
            return false;
        }

        if (typeof options.onSuccess === 'function') {
            options.onSuccess(window.imData.friends);
        }

        return true;
    } catch (e) {
        console.error('Failed to commit friend change', e);
        if (targetIndex > -1) {
            if (previousFriend) {
                window.imData.friends[targetIndex] = previousFriend;
            } else {
                window.imData.friends.splice(targetIndex, 1);
            }
        }
        if (typeof options.onRollback === 'function') {
            options.onRollback(window.imData.friends);
        }
        if (!options.silent && window.showToast) {
            window.showToast('保存失败，已撤销本次修改');
        }
        return false;
    }
};

window.imApp.commitFriendsChange = async function(mutator, options = {}) {
    if (window.imApp.ensureDataReady && !window.imData.ready) {
        await window.imApp.ensureDataReady();
    }

    const previousFriends = window.imApp.cloneDataSnapshot(
        Array.isArray(window.imData.friends) ? window.imData.friends : []
    );

    try {
        if (typeof mutator === 'function') {
            await mutator();
        }

        const currentFriendIds = (window.imData.friends || []).map(friend => String(friend.id));
        const deletedFriendIds = Array.isArray(options.deletedFriendIds)
            ? options.deletedFriendIds.map(String)
            : previousFriends
                .map(friend => String(friend.id))
                .filter((friendId) => !currentFriendIds.includes(friendId));

        const friendIds = Array.isArray(options.friendIds)
            ? Array.from(new Set([...options.friendIds.map(String), ...deletedFriendIds]))
            : (options.friendId != null
                ? Array.from(new Set([String(options.friendId), ...deletedFriendIds]))
                : Array.from(new Set([...currentFriendIds, ...deletedFriendIds])));

        friendIds.forEach((friendId) => window.imApp.markFriendDirty(friendId));

        if (options.immediate === false) {
            if (friendIds.length === 1) {
                window.imApp.scheduleFriendSave(friendIds[0], {
                    delay: options.delay,
                    silent: options.silent !== false,
                    metaOnly: options.metaOnly === true,
                    includeMessages: options.includeMessages
                });
            } else {
                window.imApp.scheduleGlobalSave({
                    delay: options.delay,
                    silent: options.silent !== false
                });
            }

            if (typeof options.onSuccess === 'function') {
                options.onSuccess(window.imData.friends);
            }
            return true;
        }

        const saved = friendIds.length === 1
            ? await window.imApp.flushFriendSave(friendIds[0], {
                silent: !!options.silent,
                metaOnly: options.metaOnly === true,
                includeMessages: options.includeMessages
            })
            : await window.imApp.flushGlobalSave({
                silent: !!options.silent
            });

        if (!saved) {
            window.imData.friends = previousFriends;
            if (typeof options.onRollback === 'function') {
                options.onRollback(window.imData.friends);
            }
            return false;
        }

        if (typeof options.onSuccess === 'function') {
            options.onSuccess(window.imData.friends);
        }

        return true;
    } catch (e) {
        console.error('Failed to commit friends change', e);
        window.imData.friends = previousFriends;
        if (typeof options.onRollback === 'function') {
            options.onRollback(window.imData.friends);
        }
        if (!options.silent && window.showToast) {
            window.showToast('保存失败，已撤销本次修改');
        }
        return false;
    }
};

window.imApp.commitMomentChange = async function(momentId, mutator, options = {}) {
    const moments = Array.isArray(window.imData.moments) ? window.imData.moments : [];
    const targetIndex = moments.findIndex(
        moment => String(moment.id) === String(momentId)
    );
    const previousMoment = targetIndex > -1
        ? window.imApp.cloneDataSnapshot(moments[targetIndex])
        : null;

    try {
        const targetMoment = targetIndex > -1 ? moments[targetIndex] : null;

        if (typeof mutator === 'function') {
            await mutator(targetMoment, moments, targetIndex);
        }

        window.imApp.markMomentDirty(momentId);

        if (options.immediate === false) {
            window.imApp.scheduleMomentSave(momentId, {
                delay: options.delay,
                silent: options.silent !== false
            });

            if (typeof options.onSuccess === 'function') {
                options.onSuccess(window.imData.moments);
            }
            return true;
        }

        const saved = await window.imApp.flushMomentSave(momentId, {
            silent: !!options.silent
        });

        if (!saved) {
            if (targetIndex > -1) {
                if (previousMoment) {
                    window.imData.moments[targetIndex] = previousMoment;
                } else {
                    window.imData.moments.splice(targetIndex, 1);
                }
            }
            if (typeof options.onRollback === 'function') {
                options.onRollback(window.imData.moments);
            }
            return false;
        }

        if (typeof options.onSuccess === 'function') {
            options.onSuccess(window.imData.moments);
        }

        return true;
    } catch (e) {
        console.error('Failed to commit moment change', e);
        if (targetIndex > -1) {
            if (previousMoment) {
                window.imData.moments[targetIndex] = previousMoment;
            } else {
                window.imData.moments.splice(targetIndex, 1);
            }
        }
        if (typeof options.onRollback === 'function') {
            options.onRollback(window.imData.moments);
        }
        if (!options.silent && window.showToast) {
            window.showToast('朋友圈保存失败，已撤销本次修改');
        }
        return false;
    }
};

window.imApp.deleteMomentPermanently = async function(momentId, options = {}) {
    if (momentId == null) return false;

    const safeMomentId = String(momentId);
    let previousMoments = [];
    let previousMessages = [];

    try {
        if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();
        if (window.imApp.ensureMomentsReady) await window.imApp.ensureMomentsReady();
        if (window.imApp.ensureMomentMessagesReady) await window.imApp.ensureMomentMessagesReady();

        previousMoments = window.imApp.cloneDataSnapshot(Array.isArray(window.imData.moments) ? window.imData.moments : []);
        previousMessages = window.imApp.cloneDataSnapshot(Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : []);

        const pendingTimer = window.imApp.saveState.momentTimers.get(safeMomentId);
        if (pendingTimer) {
            clearTimeout(pendingTimer);
            window.imApp.saveState.momentTimers.delete(safeMomentId);
        }

        const pendingFlush = window.imApp.saveState.momentFlushChains.get(safeMomentId);
        if (pendingFlush) {
            await pendingFlush.catch(() => false);
        }

        window.imData.moments = (Array.isArray(window.imData.moments) ? window.imData.moments : [])
            .filter(moment => String(moment?.id) !== safeMomentId);
        window.imData.momentMessages = (Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : [])
            .filter(msg => String(msg?.momentId) !== safeMomentId);

        window.imApp.saveState.momentDirtyIds.delete(safeMomentId);
        window.imApp.saveState.momentRevisions.delete(safeMomentId);
        window.imApp.saveState.momentFlushChains.delete(safeMomentId);

        if (window.imStorage?.deleteMoment) {
            const deleted = await window.imStorage.deleteMoment(momentId);
            if (deleted === false) throw new Error('deleteMoment failed');
        }
        if (window.imStorage?.saveMoments) {
            const savedMoments = await window.imStorage.saveMoments(window.imData.moments);
            if (savedMoments === false) throw new Error('saveMoments failed');
        } else if (window.imApp.saveMoments) {
            const saved = await window.imApp.saveMoments({ silent: options.silent !== false });
            if (!saved) throw new Error('saveMoments failed');
        }

        if (window.imStorage?.saveMomentMessages) {
            const savedMessages = await window.imStorage.saveMomentMessages(window.imData.momentMessages);
            if (savedMessages === false) throw new Error('saveMomentMessages failed');
            window.imApp.saveState.momentMessagesDirty = false;
        } else if (window.imApp.saveMomentMessages) {
            const saved = await window.imApp.saveMomentMessages({ silent: options.silent !== false });
            if (!saved) throw new Error('saveMomentMessages failed');
        }

        window.imApp.saveState.lastError = null;
        window.imApp.saveState.dirty =
            window.imApp.saveState.friendDirtyIds.size > 0 ||
            window.imApp.saveState.momentDirtyIds.size > 0 ||
            window.imApp.saveState.momentMessagesDirty ||
            window.imApp.saveState.stickersDirty ||
            window.imApp.saveState.momentsCoverDirty;

        return true;
    } catch (e) {
        console.error('Failed to permanently delete moment', e);
        window.imData.moments = previousMoments;
        window.imData.momentMessages = previousMessages;
        window.imApp.saveState.lastError = e;

        try {
            if (window.imStorage?.saveMoments) {
                await window.imStorage.saveMoments(previousMoments);
            }
            if (window.imStorage?.saveMomentMessages) {
                await window.imStorage.saveMomentMessages(previousMessages);
            }
        } catch (restoreError) {
            console.error('Failed to restore moment deletion rollback', restoreError);
        }

        if (!options.silent && window.showToast) {
            window.showToast('朋友圈删除失败，已恢复');
        }
        return false;
    }
};

window.imApp.saveFriends = async function(options = {}) {
    return window.imApp.flushGlobalSave(options);
};

window.imApp.saveMoments = async function(options = {}) {
    return window.imApp.flushGlobalSave(options);
};

window.imApp.saveMomentMessages = async function(options = {}) {
    window.imApp.markMomentMessagesDirty();
    if (options.immediate === false) {
        window.imApp.scheduleGlobalSave({
            delay: options.delay,
            silent: options.silent !== false
        });
        return true;
    }
    return window.imApp.flushMomentMessagesSave(options);
};

window.imApp.saveStickers = async function(options = {}) {
    window.imApp.markStickersDirty();
    if (options.immediate === false) {
        window.imApp.scheduleGlobalSave({
            delay: options.delay,
            silent: options.silent !== false
        });
        return true;
    }
    return window.imApp.flushStickersSave(options);
};

window.imApp.commitStickersChange = async function(mutator, options = {}) {
    const previousStickers = window.imApp.cloneDataSnapshot(
        Array.isArray(window.imData.stickers) ? window.imData.stickers : []
    );

    try {
        if (typeof mutator === 'function') {
            await mutator(window.imData.stickers);
        }

        window.imApp.markStickersDirty();

        if (options.immediate === false) {
            window.imApp.scheduleGlobalSave({
                delay: options.delay,
                silent: options.silent !== false
            });

            if (typeof options.onSuccess === 'function') {
                options.onSuccess(window.imData.stickers);
            }
            window.dispatchEvent(new CustomEvent('u2:stickers-data-changed', {
                detail: { stickers: window.imData.stickers }
            }));
            return true;
        }

        const saved = await window.imApp.flushStickersSave({
            silent: !!options.silent
        });

        if (!saved) {
            window.imData.stickers = previousStickers;
            if (typeof options.onRollback === 'function') {
                options.onRollback(window.imData.stickers);
            }
            return false;
        }

        if (typeof options.onSuccess === 'function') {
            options.onSuccess(window.imData.stickers);
        }

        window.dispatchEvent(new CustomEvent('u2:stickers-data-changed', {
            detail: { stickers: window.imData.stickers }
        }));

        return true;
    } catch (e) {
        console.error('Failed to commit stickers change', e);
        window.imData.stickers = previousStickers;
        if (typeof options.onRollback === 'function') {
            options.onRollback(window.imData.stickers);
        }
        if (!options.silent && window.showToast) {
            window.showToast('表情包保存失败，已撤销本次修改');
        }
        return false;
    }
};

window.imApp.saveMomentsCover = async function(dataUrlOrUrl, options = {}) {
    window.imData.momentsCoverUrl = dataUrlOrUrl || null;
    window.imApp.markMomentsCoverDirty();
    if (options.immediate === false) {
        window.imApp.scheduleGlobalSave({
            delay: options.delay,
            silent: options.silent !== false
        });
        return window.imData.momentsCoverUrl;
    }
    const saved = await window.imApp.flushMomentsCoverSave(options);
    return saved ? window.imData.momentsCoverUrl : null;
};

window.imApp.getStorageUsage = async function() {
    try {
        if (!window.imStorage || !window.imStorage.measureApproximateUsage) return 0;
        return await window.imStorage.measureApproximateUsage();
    } catch (e) {
        console.error('Failed to measure iMessage storage usage', e);
        return 0;
    }
};

window.imApp.clearRuntimeCache = function() {
    try {
        if (window.imStorage?.clearRuntimeAssetCache) {
            window.imStorage.clearRuntimeAssetCache();
        }
        if (window.imStorage?.pruneRuntimeAssetCache) {
            window.imStorage.pruneRuntimeAssetCache(0);
        }
        return true;
    } catch (e) {
        console.error('Failed to clear iMessage runtime cache', e);
        return false;
    }
};

window.getGlobalWorldBookContextByPosition = function(position = 'before_role', contextText = '') {
    const normalizeEntry = window.normalizeWorldBookEntry
        ? window.normalizeWorldBookEntry
        : function(entry = {}) {
            return {
                title: entry.title || entry.name || entry.keyword || '未命名词条',
                keyword: entry.keyword || '',
                content: entry.content || '',
                triggerMode: entry.triggerMode === 'keyword' ? 'keyword' : 'permanent',
                injectionPosition: ['before_role', 'after_role', 'system_depth'].includes(entry.injectionPosition)
                    ? entry.injectionPosition
                    : 'before_role',
                systemDepth: Number.isFinite(Number(entry.systemDepth)) ? Number(entry.systemDepth) : 4,
                order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : 100,
                recursive: false,
                enabled: entry.enabled !== false
            };
        };

    const keywordMatched = window.worldBookKeywordMatched
        ? window.worldBookKeywordMatched
        : function(entry, text = '') {
            if (!entry || entry.triggerMode !== 'keyword') return true;
            const keyword = entry.keyword ? String(entry.keyword).trim() : '';
            if (!keyword) return false;
            return String(text || '').includes(keyword);
        };

    const formatEntry = window.formatWorldBookEntryForPrompt
        ? window.formatWorldBookEntryForPrompt
        : function(entry) {
            const title = entry.title ? String(entry.title).trim() : '未命名词条';
            const keyword = entry.keyword ? String(entry.keyword).trim() : '';
            const content = entry.content ? String(entry.content).trim() : '';
            const triggerModeLabel = entry.triggerMode === 'keyword' ? '关键词' : '永久';

            let injectionLabel = '角色前';
            if (entry.injectionPosition === 'after_role') injectionLabel = '角色后';
            if (entry.injectionPosition === 'system_depth') injectionLabel = '系统深度';

            let block = `【${title}】\n`;
            block += `触发机制: ${triggerModeLabel}\n`;
            block += `注入位置: ${injectionLabel}\n`;

            if (entry.injectionPosition === 'system_depth') {
                block += `深度: ${entry.systemDepth}\n`;
                block += `顺序: ${entry.order}\n`;
            }

            if (entry.triggerMode === 'keyword' && keyword) {
                block += `关键词: ${keyword}\n`;
            }

            if (content) {
                block += `内容:\n${content}\n`;
            }

            return block.trim();
        };

    const titleMap = {
        before_role: 'World Book / 角色前',
        after_role: 'World Book / 角色后',
        system_depth: 'World Book / 系统深度'
    };

    const positionEntries = [];

    if (window.getWorldBooks) {
        const allBooks = window.getWorldBooks();
        if (Array.isArray(allBooks) && allBooks.length > 0) {
            const globalBooks = allBooks.filter(book => book && book.isGlobal && Array.isArray(book.entries) && book.entries.length > 0);

            globalBooks.forEach(book => {
                book.entries
                    .map(entry => normalizeEntry(entry))
                    .filter(entry => entry && entry.enabled !== false)
                    .filter(entry => entry.injectionPosition === position)
                    .filter(entry => keywordMatched(entry, contextText))
                    .forEach(entry => {
                        positionEntries.push({
                            ...entry,
                            __bookName: book.name || '未命名世界书'
                        });
                    });
            });
        }
    }

    const sections = [];

    if (positionEntries.length > 0) {
        positionEntries.sort((a, b) => {
            if (position === 'system_depth') {
                if (a.systemDepth !== b.systemDepth) return a.systemDepth - b.systemDepth;
                return a.order - b.order;
            }
            return a.order - b.order;
        });

        let section = `${titleMap[position]}:\n`;
        positionEntries.forEach(entry => {
            section += `〔${entry.__bookName}〕\n${formatEntry(entry)}\n\n`;
        });
        sections.push(section.trim());
    }

    if (window.getBuiltinWorldBookContext) {
        const builtinSection = window.getBuiltinWorldBookContext(position, contextText);
        if (builtinSection) {
            sections.push(builtinSection.trim());
        }
    }

    return sections.join('\n\n').trim();
};

window.getGlobalWorldBookContext = function(contextText = '') {
    const positions = ['system_depth', 'before_role', 'after_role'];
    const sections = positions
        .map(position => window.getGlobalWorldBookContextByPosition(position, contextText))
        .filter(Boolean);

    return sections.join('\n\n').trim();
};

window.imApp.getWorldBookContextForFriendByPosition = function(position = 'before_role', friend = null, contextText = '') {
    const normalizeEntry = window.normalizeWorldBookEntry
        ? window.normalizeWorldBookEntry
        : function(entry = {}) {
            return {
                title: entry.title || entry.name || entry.keyword || '未命名词条',
                keyword: entry.keyword || '',
                content: entry.content || '',
                triggerMode: entry.triggerMode === 'keyword' ? 'keyword' : 'permanent',
                injectionPosition: ['before_role', 'after_role', 'system_depth'].includes(entry.injectionPosition)
                    ? entry.injectionPosition
                    : 'before_role',
                systemDepth: Number.isFinite(Number(entry.systemDepth)) ? Number(entry.systemDepth) : 4,
                order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : 100,
                enabled: entry.enabled !== false
            };
        };

    const keywordMatched = window.worldBookKeywordMatched
        ? window.worldBookKeywordMatched
        : function(entry, text = '') {
            if (!entry || entry.triggerMode !== 'keyword') return true;
            const keyword = entry.keyword ? String(entry.keyword).trim() : '';
            if (!keyword) return false;
            return String(text || '').includes(keyword);
        };

    const formatEntry = window.formatWorldBookEntryForPrompt
        ? window.formatWorldBookEntryForPrompt
        : function(entry) {
            const title = entry.title ? String(entry.title).trim() : '未命名词条';
            const keyword = entry.keyword ? String(entry.keyword).trim() : '';
            const content = entry.content ? String(entry.content).trim() : '';
            const triggerModeLabel = entry.triggerMode === 'keyword' ? '关键词' : '永久';

            let injectionLabel = '角色前';
            if (entry.injectionPosition === 'after_role') injectionLabel = '角色后';
            if (entry.injectionPosition === 'system_depth') injectionLabel = '系统深度';

            let block = `【${title}】\n`;
            block += `触发机制: ${triggerModeLabel}\n`;
            block += `注入位置: ${injectionLabel}\n`;

            if (entry.injectionPosition === 'system_depth') {
                block += `深度: ${entry.systemDepth}\n`;
                block += `顺序: ${entry.order}\n`;
            }

            if (entry.triggerMode === 'keyword' && keyword) {
                block += `关键词: ${keyword}\n`;
            }

            if (content) {
                block += `内容:\n${content}\n`;
            }

            return block.trim();
        };

    const titleMap = {
        before_role: 'Bound World Book / 绑定角色前',
        after_role: 'Bound World Book / 绑定角色后',
        system_depth: 'Bound World Book / 绑定系统深度'
    };

    const sections = [];
    const globalContext = window.getGlobalWorldBookContextByPosition
        ? window.getGlobalWorldBookContextByPosition(position, contextText)
        : '';

    if (globalContext) {
        sections.push(globalContext.trim());
    }

    const normalizedFriend = friend ? window.imApp.normalizeFriendData(friend) : null;
    const boundBookIds = normalizedFriend && Array.isArray(normalizedFriend.boundBooks)
        ? normalizedFriend.boundBooks.map(id => String(id))
        : [];

    if (boundBookIds.length > 0 && window.getWorldBooks) {
        const allBooks = window.getWorldBooks();
        const boundEntries = [];

        if (Array.isArray(allBooks)) {
            allBooks
                .filter(book => book && boundBookIds.includes(String(book.id)) && Array.isArray(book.entries))
                .forEach(book => {
                    book.entries
                        .map(entry => normalizeEntry(entry))
                        .filter(entry => entry && entry.enabled !== false)
                        .filter(entry => entry.injectionPosition === position)
                        .filter(entry => keywordMatched(entry, contextText))
                        .forEach(entry => {
                            boundEntries.push({
                                ...entry,
                                __bookName: book.name || '未命名世界书'
                            });
                        });
                });
        }

        if (boundEntries.length > 0) {
            boundEntries.sort((a, b) => {
                if (position === 'system_depth') {
                    if (a.systemDepth !== b.systemDepth) return a.systemDepth - b.systemDepth;
                    return a.order - b.order;
                }
                return a.order - b.order;
            });

            let section = `${titleMap[position]}:\n`;
            boundEntries.forEach(entry => {
                section += `〔${entry.__bookName}〕\n${formatEntry(entry)}\n\n`;
            });
            sections.push(section.trim());
        }
    }

    return sections.join('\n\n').trim();
};

window.getWorldBookContextForFriendByPosition = function(position = 'before_role', friend = null, contextText = '') {
    return window.imApp.getWorldBookContextForFriendByPosition(position, friend, contextText);
};

window.imApp.getWorldBookContextForFriendByPosition = function(position = 'before_role', friend = null, contextText = '') {
    const normalizeEntry = window.normalizeWorldBookEntry
        ? window.normalizeWorldBookEntry
        : function(entry = {}) {
            return {
                title: entry.title || entry.name || entry.keyword || '未命名词条',
                keyword: entry.keyword || '',
                content: entry.content || '',
                triggerMode: entry.triggerMode === 'keyword' ? 'keyword' : 'permanent',
                injectionPosition: ['before_role', 'after_role', 'system_depth'].includes(entry.injectionPosition)
                    ? entry.injectionPosition
                    : 'before_role',
                systemDepth: Number.isFinite(Number(entry.systemDepth)) ? Number(entry.systemDepth) : 4,
                order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : 100,
                enabled: entry.enabled !== false
            };
        };

    const keywordMatched = window.worldBookKeywordMatched
        ? window.worldBookKeywordMatched
        : function(entry, text = '') {
            if (!entry || entry.triggerMode !== 'keyword') return true;
            const keyword = entry.keyword ? String(entry.keyword).trim() : '';
            if (!keyword) return false;
            return String(text || '').includes(keyword);
        };

    const formatEntry = window.formatWorldBookEntryForPrompt
        ? window.formatWorldBookEntryForPrompt
        : function(entry) {
            const title = entry.title ? String(entry.title).trim() : '未命名词条';
            const keyword = entry.keyword ? String(entry.keyword).trim() : '';
            const content = entry.content ? String(entry.content).trim() : '';
            const triggerModeLabel = entry.triggerMode === 'keyword' ? '关键词' : '永久';

            let injectionLabel = '角色前';
            if (entry.injectionPosition === 'after_role') injectionLabel = '角色后';
            if (entry.injectionPosition === 'system_depth') injectionLabel = '系统深度';

            let block = `【${title}】\n`;
            block += `触发机制: ${triggerModeLabel}\n`;
            block += `注入位置: ${injectionLabel}\n`;

            if (entry.injectionPosition === 'system_depth') {
                block += `深度: ${entry.systemDepth}\n`;
                block += `顺序: ${entry.order}\n`;
            }

            if (entry.triggerMode === 'keyword' && keyword) {
                block += `关键词: ${keyword}\n`;
            }

            if (content) {
                block += `内容:\n${content}\n`;
            }

            return block.trim();
        };

    const titleMap = {
        before_role: 'Bound World Book / 绑定角色前',
        after_role: 'Bound World Book / 绑定角色后',
        system_depth: 'Bound World Book / 绑定系统深度'
    };

    const sections = [];
    const globalContext = window.getGlobalWorldBookContextByPosition
        ? window.getGlobalWorldBookContextByPosition(position, contextText)
        : '';

    if (globalContext) {
        sections.push(globalContext.trim());
    }

    const normalizedFriend = friend ? window.imApp.normalizeFriendData(friend) : null;
    const boundBookIds = normalizedFriend && Array.isArray(normalizedFriend.boundBooks)
        ? normalizedFriend.boundBooks.map(id => String(id))
        : [];

    if (boundBookIds.length > 0 && window.getWorldBooks) {
        const allBooks = window.getWorldBooks();
        const boundEntries = [];

        if (Array.isArray(allBooks)) {
            allBooks
                .filter(book => book && boundBookIds.includes(String(book.id)) && Array.isArray(book.entries))
                .forEach(book => {
                    book.entries
                        .map(entry => normalizeEntry(entry))
                        .filter(entry => entry && entry.enabled !== false)
                        .filter(entry => entry.injectionPosition === position)
                        .filter(entry => keywordMatched(entry, contextText))
                        .forEach(entry => {
                            boundEntries.push({
                                ...entry,
                                __bookName: book.name || '未命名世界书'
                            });
                        });
                });
        }

        if (boundEntries.length > 0) {
            boundEntries.sort((a, b) => {
                if (position === 'system_depth') {
                    if (a.systemDepth !== b.systemDepth) return a.systemDepth - b.systemDepth;
                    return a.order - b.order;
                }
                return a.order - b.order;
            });

            let section = `${titleMap[position]}:\n`;
            boundEntries.forEach(entry => {
                section += `〔${entry.__bookName}〕\n${formatEntry(entry)}\n\n`;
            });
            sections.push(section.trim());
        }
    }

    return sections.join('\n\n').trim();
};

window.getWorldBookContextForFriendByPosition = function(position = 'before_role', friend = null, contextText = '') {
    return window.imApp.getWorldBookContextForFriendByPosition(position, friend, contextText);
};

window.getImFriends = () => window.imData.friends;

window.addImFriend = async function(friendData) {
    const friend = window.imApp.normalizeFriendData({
        id: Date.now(),
        type: friendData.type || 'char',
        realName: friendData.realName || '',
        nickname: friendData.nickname || 'New Friend',
        signature: friendData.signature || 'No Signature',
        persona: friendData.persona || '',
        avatarUrl: friendData.avatarUrl || null,
        messages: [],
        chatBg: null,
        customCssEnabled: false,
        customCss: '',
        memory: window.imApp.createDefaultMemory()
    });

    const saved = window.imApp.commitFriendsChange
        ? await window.imApp.commitFriendsChange(() => {
            window.imData.friends.push(friend);
        }, { friendId: friend.id, silent: true })
        : false;

    if (!saved) {
        if (window.showToast) window.showToast('添加好友保存失败');
        return false;
    }

    if (window.imApp.renderFriendsList) window.imApp.renderFriendsList();
    if (window.showToast) window.showToast(`已添加好友: ${friend.nickname}`);
    return true;
};

window.imApp.formatTime = function(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

      if (isToday) return `${hours}:${minutes}`;
      if (isYesterday) return `Yesterday`;
      return `${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}`;
  };

window.imApp.addMomentNotification = async function(type, user, momentId, content = '', thought = '') {
    const notif = {
        id: Date.now(),
        type: type,
        userId: user.id || user.userId,
        userName: user.nickname || user.name,
        userAvatar: user.avatarUrl || user.avatar,
        momentId: momentId,
        momentImg: null,
        momentText: null,
        content: content,
        thought: thought,
        time: Date.now(),
        read: false
    };

    const m = window.imData.moments.find(x => x.id === momentId);
    if (m) {
        if (m.images && m.images.length > 0) {
            const img = m.images[0];
            notif.momentImg = (typeof img === 'object') ? img.src : img;
        }
        notif.momentText = m.text;
    }

    const previousMessages = Array.isArray(window.imData.momentMessages)
        ? (typeof structuredClone === 'function'
            ? structuredClone(window.imData.momentMessages)
            : JSON.parse(JSON.stringify(window.imData.momentMessages)))
        : [];

    window.imData.momentMessages.unshift(notif);
    const saved = await window.imApp.saveMomentMessages({ silent: true });
    if (!saved) {
        window.imData.momentMessages = previousMessages;
        if (window.imApp.renderMomentsMessages) window.imApp.renderMomentsMessages();
        if (window.showToast) window.showToast('朋友圈消息保存失败');
        return false;
    }

    if (window.imApp.renderMomentsMessages) window.imApp.renderMomentsMessages();
    return true;
};

window.imApp.getImessageUiState = function() {
    const rawState = typeof window.getAppState === 'function'
        ? window.getAppState('imessage')
        : null;
    const safeState = rawState && typeof rawState === 'object' ? rawState : {};
    const uiState = safeState.uiState && typeof safeState.uiState === 'object' ? safeState.uiState : {};

    return {
        cssPresets: Array.isArray(uiState.cssPresets) ? uiState.cssPresets : []
    };
};

window.imApp.saveImessageUiState = function() {
    const currentState = typeof window.getAppState === 'function'
        ? (window.getAppState('imessage') || {})
        : {};
    const nextState = {
        ...currentState,
        uiState: {
            ...(currentState && currentState.uiState && typeof currentState.uiState === 'object' ? currentState.uiState : {}),
            cssPresets: Array.isArray(window.imData.cssPresets) ? window.imData.cssPresets : []
        }
    };

    if (typeof window.setAppState === 'function') {
        window.setAppState('imessage', nextState);
    } else if (window.saveGlobalData) {
        window.saveGlobalData();
    }

    return nextState;
};

window.imApp.initializeData = async function() {
    if (window.imData.ready) return window.imData;

    try {
        if (window.imStorage) {
            if (window.__iisoNeedsLegacyStorageReset && window.imStorage.clearAllData) {
                try {
                    await window.imStorage.clearAllData();
                    console.warn('Legacy iMessage IndexedDB data cleared due to storage schema upgrade.');
                } catch (clearError) {
                    console.error('Failed to clear legacy iMessage IndexedDB data during schema upgrade', clearError);
                } finally {
                    window.__iisoNeedsLegacyStorageReset = false;
                }
            }

            const initialPayload = {
                friends: window.imStorage.loadFriends
                    ? await window.imStorage.loadFriends()
                    : [],
                momentsCoverUrl: window.imStorage.loadMomentsCoverUrl
                    ? await window.imStorage.loadMomentsCoverUrl()
                    : null
            };

            window.imData.friends = Array.isArray(initialPayload.friends)
                ? initialPayload.friends.map((friend) => {
                    const normalizedFriend = window.imApp.normalizeFriendData(friend);
                    normalizedFriend.messages = Array.isArray(friend.messages) ? friend.messages : [];
                    normalizedFriend.messagesLoaded = !!friend.messagesLoaded || normalizedFriend.messages.length > 0;
                    normalizedFriend.lastMessagePreview = typeof friend.lastMessagePreview === 'string'
                        ? friend.lastMessagePreview
                        : '';
                    normalizedFriend.lastMessageTimestamp = Number(friend.lastMessageTimestamp) || 0;
                    normalizedFriend.messageCount = Number(friend.messageCount) || normalizedFriend.messages.length || 0;
                    return normalizedFriend;
                })
                : [];
            window.imData.moments = [];
            window.imData.momentMessages = [];
            window.imData.stickers = [];
            window.imData.momentsCoverUrl = initialPayload.momentsCoverUrl || null;
            window.imData.momentsLoaded = false;
            window.imData.momentMessagesLoaded = false;
            window.imData.stickersLoaded = false;
        } else {
            console.warn('imStorage not available, iMessage will run with volatile in-memory state.');
        }

        const globalUiState = window.imApp.getImessageUiState
            ? window.imApp.getImessageUiState()
            : { cssPresets: [] };
        window.imData.cssPresets = Array.isArray(globalUiState.cssPresets) ? globalUiState.cssPresets : [];

        window.imData.ready = true;

        if (typeof window.updateAppState === 'function') {
            window.updateAppState('imessage', (currentState) => {
                const safeState = currentState && typeof currentState === 'object' ? currentState : {};
                const existingMeta = safeState.meta && typeof safeState.meta === 'object' ? safeState.meta : {};
                return {
                    ...safeState,
                    meta: {
                        ...existingMeta,
                        storageMode: 'indexeddb',
                        dataVersion: 2,
                        ready: true,
                        friendsCount: Array.isArray(window.imData.friends) ? window.imData.friends.length : 0,
                        momentsCount: Array.isArray(window.imData.moments) ? window.imData.moments.length : 0,
                        stickersCount: Array.isArray(window.imData.stickers) ? window.imData.stickers.length : 0,
                        lastSyncAt: Date.now()
                    }
                };
            }, { save: true });
        }

        document.dispatchEvent(new CustomEvent('imessage-data-ready'));
    } catch (e) {
        console.error('Failed to initialize iMessage data', e);
        window.imData.ready = true;
        document.dispatchEvent(new CustomEvent('imessage-data-ready'));
    }

    return window.imData;
};

window.imApp.dataReadyPromise = window.imApp.initializeData();

window.imApp.ensureDataReady = async function() {
    return window.imApp.dataReadyPromise;
};

window.imApp.ensureMomentsReady = async function() {
    if (window.imData.momentsLoaded) {
        return Array.isArray(window.imData.moments) ? window.imData.moments : [];
    }

    if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();

    try {
        const moments = window.imStorage?.loadMoments
            ? await window.imStorage.loadMoments()
            : [];
        window.imData.moments = Array.isArray(moments) ? moments : [];
        window.imData.momentsLoaded = true;
    } catch (e) {
        console.error('Failed to lazy load moments', e);
        window.imData.moments = Array.isArray(window.imData.moments) ? window.imData.moments : [];
        window.imData.momentsLoaded = true;
    }

    return window.imData.moments;
};

window.imApp.ensureMomentMessagesReady = async function() {
    if (window.imData.momentMessagesLoaded) {
        return Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : [];
    }

    if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();

    try {
        const messages = window.imStorage?.loadMomentMessages
            ? await window.imStorage.loadMomentMessages()
            : [];
        window.imData.momentMessages = Array.isArray(messages) ? messages : [];
        window.imData.momentMessagesLoaded = true;
    } catch (e) {
        console.error('Failed to lazy load moment messages', e);
        window.imData.momentMessages = Array.isArray(window.imData.momentMessages) ? window.imData.momentMessages : [];
        window.imData.momentMessagesLoaded = true;
    }

    return window.imData.momentMessages;
};

window.imApp.ensureStickersReady = async function() {
    if (window.imData.stickersLoaded) {
        return Array.isArray(window.imData.stickers) ? window.imData.stickers : [];
    }

    if (window.imApp.ensureDataReady) await window.imApp.ensureDataReady();

    try {
        const stickers = window.imStorage?.loadStickers
            ? await window.imStorage.loadStickers()
            : [];
        window.imData.stickers = Array.isArray(stickers) ? stickers : [];
        window.imData.stickersLoaded = true;
    } catch (e) {
        console.error('Failed to lazy load stickers', e);
        window.imData.stickers = Array.isArray(window.imData.stickers) ? window.imData.stickers : [];
        window.imData.stickersLoaded = true;
    }

    return window.imData.stickers;
};

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && window.imApp?.saveState?.dirty) {
        window.imApp.flushGlobalSave({ silent: true });
    }
});

window.addEventListener('pagehide', () => {
    if (window.imApp?.saveState?.dirty) {
        window.imApp.flushGlobalSave({ silent: true });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const { UI, userState, apiConfig, openView, closeView, showToast, syncUIs } = window;

    async function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result || null);
            reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    async function loadImageFromDataUrl(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = dataUrl;
        });
    }

    function canvasToDataUrl(canvas, mimeType = 'image/jpeg', quality = 0.82) {
        try {
            return canvas.toDataURL(mimeType, quality);
        } catch (e) {
            return canvas.toDataURL();
        }
    }

    async function compressImageFile(file, options = {}) {
        if (!file) return null;

        const {
            maxWidth = 1080,
            maxHeight = 1080,
            mimeType = 'image/jpeg',
            quality = 0.82
        } = options;

        const rawDataUrl = await readFileAsDataUrl(file);
        if (!rawDataUrl) return null;

        const img = await loadImageFromDataUrl(rawDataUrl);
        const naturalWidth = img.naturalWidth || img.width || 0;
        const naturalHeight = img.naturalHeight || img.height || 0;

        if (!naturalWidth || !naturalHeight) {
            return rawDataUrl;
        }

        const scale = Math.min(
            1,
            maxWidth / naturalWidth,
            maxHeight / naturalHeight
        );

        const targetWidth = Math.max(1, Math.round(naturalWidth * scale));
        const targetHeight = Math.max(1, Math.round(naturalHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return rawDataUrl;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        return canvasToDataUrl(canvas, mimeType, quality);
    }

    window.imApp = window.imApp || {};
    window.imApp.readFileAsDataUrl = readFileAsDataUrl;
    window.imApp.compressImageFile = compressImageFile;

    // --- Custom Modal Logic ---
    const customModalOverlay = document.getElementById('custom-modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalConfirmContent = document.getElementById('modal-confirm-content');
    const modalPromptContent = document.getElementById('modal-prompt-content');
    const modalMessage = document.getElementById('modal-message');
    const modalInput = document.getElementById('modal-input');
    
    // Buttons
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalPromptConfirmBtn = document.getElementById('modal-prompt-confirm-btn');

    let currentModalCallback = null;
    let currentModalCancelCallback = null;

    function showCustomModal(options) {
        if (!customModalOverlay) return;
        
        modalTitle.textContent = options.title || '提示';
        currentModalCallback = options.onConfirm;
        currentModalCancelCallback = options.onCancel;

        if (options.type === 'prompt') {
            modalConfirmBtn.style.display = 'none';
            modalPromptConfirmBtn.style.display = 'block';
            modalConfirmContent.style.display = 'none';
            modalPromptContent.style.display = 'block';
            
            modalMessage.textContent = options.message || '';
            modalInput.value = options.defaultValue || '';
            modalInput.placeholder = options.placeholder || '';
            modalPromptConfirmBtn.textContent = options.confirmText || '确认';
        } else {
            modalConfirmBtn.style.display = 'block';
            modalPromptConfirmBtn.style.display = 'none';
            modalConfirmContent.style.display = 'block';
            modalPromptContent.style.display = 'none';
            
            modalMessage.textContent = options.message || '';
            modalConfirmBtn.textContent = options.confirmText || '确认';
            const isDeleteAction = options.isDestructive && String(options.confirmText || '').trim() === '删除';
            modalConfirmBtn.style.color = isDeleteAction ? '#fff' : (options.isDestructive ? '#ff3b30' : '#2c2c2e');
            modalConfirmBtn.style.background = isDeleteAction ? '#111' : '';
            modalConfirmBtn.style.borderRadius = isDeleteAction ? '12px' : '';
            modalConfirmBtn.style.fontWeight = isDeleteAction ? '700' : '';
        }

        customModalOverlay.style.display = 'flex';
        void customModalOverlay.offsetWidth; // force reflow
        customModalOverlay.classList.add('active');
        
        const sheet = customModalOverlay.querySelector('.bottom-sheet');
        if(sheet) sheet.style.transform = 'translateY(0)';

        if (options.type === 'prompt') {
            setTimeout(() => modalInput.focus(), 300);
        }
    }

    function closeCustomModal(isCancel = true) {
        if (!customModalOverlay) return;
        customModalOverlay.classList.remove('active');
        setTimeout(() => {
            customModalOverlay.style.display = 'none';
        }, 300);
        if (isCancel && typeof currentModalCancelCallback === 'function') {
            currentModalCancelCallback();
        }
        currentModalCallback = null;
        currentModalCancelCallback = null;
    }

    window.imApp.showCustomModal = showCustomModal;
    window.imApp.closeCustomModal = closeCustomModal;

    // Export for legacy compatibility if any other app uses it directly
    window.showCustomModal = showCustomModal;
    window.closeCustomModal = closeCustomModal;

    if (modalCancelBtn) modalCancelBtn.addEventListener('click', () => closeCustomModal(true));
    
    if (modalConfirmBtn) {
        modalConfirmBtn.addEventListener('click', () => {
            if (currentModalCallback) currentModalCallback(true);
            closeCustomModal(false);
        });
    }

    if (modalPromptConfirmBtn) {
        modalPromptConfirmBtn.addEventListener('click', () => {
            if (currentModalCallback) currentModalCallback(modalInput.value);
            closeCustomModal(false);
        });
    }

    if (customModalOverlay) {
        customModalOverlay.addEventListener('click', (e) => {
            if (e.target === customModalOverlay) closeCustomModal(true);
        });
    }

    // --- iMessage (LINE Style) View Initialization ---
    const imessageView = document.getElementById('imessage-view');
    const dockIcon = document.getElementById('dock-icon-imessage');
    
    if (dockIcon) {
        dockIcon.addEventListener('click', (e) => {
            if (window.isJiggleMode || window.preventAppClick) { e.preventDefault(); e.stopPropagation(); return; }
            if (syncUIs) syncUIs();
            openView(imessageView);
            
            // Sync user avatar
            if (window.imApp.syncMomentsUser) window.imApp.syncMomentsUser();
            // Render friends to ensure up to date
            if (window.imApp.renderFriendsList) window.imApp.renderFriendsList();
            if (window.imApp.renderGroupsList) window.imApp.renderGroupsList();
            if (window.imApp.updateChatsUnreadBadges) window.imApp.updateChatsUnreadBadges();
        });
    }

    const imHeaderLeft = document.querySelector('.line-header-left');
    if (imHeaderLeft) {
        imHeaderLeft.addEventListener('click', () => {
            closeView(imessageView);
        });
    }

    const imHeaderRight = document.querySelector('.line-header-right');
    if (imHeaderRight) {
        const bookmarkBtn = imHeaderRight.querySelector('.fa-bookmark');
        const settingsBtn = imHeaderRight.querySelector('.fa-cog');

        if(bookmarkBtn) bookmarkBtn.addEventListener('click', () => { if(window.showToast) window.showToast('Bookmark clicked'); });
        if(settingsBtn) settingsBtn.addEventListener('click', () => { if(window.showToast) window.showToast('Settings clicked'); });
    }

    const imServiceItems = document.querySelectorAll('.line-service-item');
    imServiceItems.forEach(item => {
        item.addEventListener('click', async () => {
            const spanText = item.querySelector('span')?.textContent?.trim() || '';
            // Check if this is the Stickers button
            if (spanText === 'Stickers') {
                try {
                    if (window.imApp?.ensureStickersReady) {
                        await window.imApp.ensureStickersReady();
                    }
                } catch (error) {
                    console.error('Failed to lazy load stickers', error);
                    if (window.showToast) window.showToast('表情数据加载失败');
                }

                // Open stickers view
                const stickersViewEl = document.getElementById('stickers-view');
                if (stickersViewEl && window.openView) {
                    stickersViewEl.style.display = 'flex';
                    window.openView(stickersViewEl);
                    if (typeof renderStickersView === 'function') {
                        renderStickersView();
                    }
                } else {
                    console.error('Stickers view or openView not found');
                }
            } else {
                // Ignore general service clicks
            }
        });
    });

    // --- Stickers Feature Logic ---
    const stickersView = document.getElementById('stickers-view');
    const stickersBackBtn = document.getElementById('stickers-back-btn');
    const stickersAddBtn = document.getElementById('stickers-add-btn');
    const stickersEditBtn = document.getElementById('stickers-edit-btn');
    const addStickerSheet = document.getElementById('add-sticker-sheet');
    const stickersListContainer = document.getElementById('stickers-list-container');
    const stickerCategoryNameInput = document.getElementById('sticker-category-name');
    const stickerLocalUploadBtn = document.getElementById('sticker-local-upload-btn');
    const stickerLocalUploadInput = document.getElementById('sticker-local-upload-input');
    const stickerLocalPreview = document.getElementById('sticker-local-preview');
    const stickerUrlInput = document.getElementById('sticker-url-input');
    const confirmAddStickerBtn = document.getElementById('confirm-add-sticker-btn');

    // Temporary storage for local uploaded images
    let pendingLocalStickers = [];

    // Stickers back btn removed - no back button in new design

    // Open add sticker sheet
    if (stickersAddBtn) {
        stickersAddBtn.addEventListener('click', () => {
            if (addStickerSheet) {
                addStickerSheet.style.display = 'flex';
                void addStickerSheet.offsetWidth;
                addStickerSheet.classList.add('active');
                const sheet = addStickerSheet.querySelector('.bottom-sheet');
                if (sheet) sheet.style.transform = 'translateY(0)';
                // Reset form
                if (stickerCategoryNameInput) stickerCategoryNameInput.value = '';
                if (stickerUrlInput) stickerUrlInput.value = '';
                if (stickerLocalPreview) {
                    stickerLocalPreview.innerHTML = '';
                    stickerLocalPreview.classList.remove('has-items');
                }
                pendingLocalStickers = [];
            }
        });
    }

    // Close add sticker sheet
    function closeAddStickerSheet() {
        if (addStickerSheet) {
            addStickerSheet.classList.remove('active');
            setTimeout(() => {
                addStickerSheet.style.display = 'none';
                if (stickerLocalPreview) {
                    stickerLocalPreview.innerHTML = '';
                    stickerLocalPreview.classList.remove('has-items');
                }
                pendingLocalStickers = [];
            }, 300);
        }
    }

    if (addStickerSheet) {
        addStickerSheet.addEventListener('click', (e) => {
            if (e.target === addStickerSheet) closeAddStickerSheet();
        });
    }

    // Local file upload trigger
    if (stickerLocalUploadBtn && stickerLocalUploadInput) {
        stickerLocalUploadBtn.addEventListener('click', () => {
            stickerLocalUploadInput.click();
        });

        stickerLocalUploadInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;

            pendingLocalStickers = [];
            if (stickerLocalPreview) {
                stickerLocalPreview.innerHTML = '';
                stickerLocalPreview.classList.add('has-items');
            }

            Array.from(files).forEach(async (file, index) => {
                try {
                    const dataUrl = window.imApp.compressImageFile
                        ? await window.imApp.compressImageFile(file, {
                            maxWidth: 256,
                            maxHeight: 256,
                            mimeType: 'image/jpeg',
                            quality: 0.8
                        })
                        : await window.imApp.readFileAsDataUrl(file);

                    const name = file.name.replace(/\.[^/.]+$/, '') || `sticker_${index + 1}`;
                    
                    // Store with temporary index, will update name from input
                    const stickerObj = { name, url: dataUrl };
                    pendingLocalStickers.push(stickerObj);

                    // Show preview with name input
                    if (stickerLocalPreview) {
                        const previewContainer = document.createElement('div');
                        previewContainer.className = 'sticker-preview-item';
                        
                        const previewImg = document.createElement('img');
                        previewImg.src = dataUrl;
                        previewImg.className = 'sticker-preview-img';
                        
                        const nameInput = document.createElement('input');
                        nameInput.type = 'text';
                        nameInput.value = name;
                        nameInput.className = 'sticker-name-input';
                        nameInput.placeholder = '名称';
                        
                        // Update name when input changes
                        nameInput.addEventListener('input', () => {
                            const idx = pendingLocalStickers.findIndex(s => s.url === dataUrl);
                            if (idx !== -1) {
                                pendingLocalStickers[idx].name = nameInput.value || name;
                            }
                        });
                        
                        previewContainer.appendChild(previewImg);
                        previewContainer.appendChild(nameInput);
                        stickerLocalPreview.appendChild(previewContainer);
                    }
                } catch (error) {
                    console.error('Failed to process sticker image', error);
                    if (showToast) showToast('表情图片处理失败');
                }
            });

            // Reset input for re-upload
            stickerLocalUploadInput.value = '';
        });
    }

    // Confirm add sticker
    if (confirmAddStickerBtn) {
        confirmAddStickerBtn.addEventListener('click', async () => {
            const categoryName = stickerCategoryNameInput ? stickerCategoryNameInput.value.trim() : '';
            if (!categoryName) {
                if (showToast) showToast('请输入分类名称');
                return;
            }

            // Parse URL input
            const urlStickers = [];
            if (stickerUrlInput) {
                const lines = stickerUrlInput.value.split('\n');
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return;
                    const parts = trimmed.split(/\s+/);
                    if (parts.length >= 2) {
                        const name = parts[0];
                        const url = parts.slice(1).join(' ');
                        urlStickers.push({ name, url });
                    }
                });
            }

            // Combine all stickers
            const allNewStickers = [...pendingLocalStickers, ...urlStickers];
            if (allNewStickers.length === 0) {
                if (showToast) showToast('请添加至少一张表情');
                return;
            }

            const saved = window.imApp.commitStickersChange
                ? await window.imApp.commitStickersChange(() => {
                    if (!window.imData.stickers) window.imData.stickers = [];
                    let category = window.imData.stickers.find(c => c.categoryName === categoryName);
                    if (category) {
                        category.items = Array.isArray(category.items) ? category.items.concat(allNewStickers) : [...allNewStickers];
                    } else {
                        window.imData.stickers.push({
                            categoryName,
                            items: allNewStickers
                        });
                    }
                }, { silent: true })
                : (window.imApp.saveStickers
                    ? await (async () => {
                        if (!window.imData.stickers) window.imData.stickers = [];
                        let category = window.imData.stickers.find(c => c.categoryName === categoryName);
                        if (category) {
                            category.items = Array.isArray(category.items) ? category.items.concat(allNewStickers) : [...allNewStickers];
                        } else {
                            window.imData.stickers.push({
                                categoryName,
                                items: allNewStickers
                            });
                        }
                        return window.imApp.saveStickers({ silent: true });
                    })()
                    : false);

            if (!saved) {
                if (showToast) showToast('表情包保存失败');
                return;
            }

            renderStickersView();
            closeAddStickerSheet();
            if (showToast) showToast(`已添加 ${allNewStickers.length} 张表情到 "${categoryName}"`);
        });
    }

    // Batch delete mode state
    let batchDeleteMode = false;
    let selectedStickers = new Set();

    // Edit button to toggle batch delete mode
    if (stickersEditBtn) {
        stickersEditBtn.addEventListener('click', () => {
            batchDeleteMode = !batchDeleteMode;
            selectedStickers.clear();
            stickersEditBtn.innerHTML = batchDeleteMode ? '<i class="fas fa-check"></i>' : '<i class="fas fa-pen"></i>';
            renderStickersView(batchDeleteMode);
        });
    }

    function getStickerBindableFriends() {
        return (Array.isArray(window.imData.friends) ? window.imData.friends : [])
            .filter(friend => friend && friend.id != null && friend.type !== 'group');
    }

    function getStickerBoundFriends(categoryName) {
        return getStickerBindableFriends()
            .filter(friend => Array.isArray(friend.mountedStickers) && friend.mountedStickers.includes(categoryName));
    }

    function openStickerBindingDialog(categoryName) {
        const safeCategoryName = String(categoryName || '').trim();
        if (!safeCategoryName) return;

        const chars = getStickerBindableFriends();
        if (chars.length === 0) {
            if (showToast) showToast('No chars available');
            return;
        }

        let overlay = document.getElementById('sticker-bind-role-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'sticker-bind-role-overlay';
            overlay.style.cssText = 'position:fixed; inset:0; z-index:10020; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,0.24); padding:18px;';
            overlay.innerHTML = `
                <div class="sticker-bind-role-card" style="width:min(100%,360px); max-height:78vh; display:flex; flex-direction:column; background:#fff; border-radius:24px;  overflow:hidden;">
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 18px; border-bottom:1px solid #f2f2f7;">
                        <div style="min-width:0;">
                            <div style="font-size:17px; font-weight:800; color:#111;">Bind Roles</div>
                            <div class="sticker-bind-role-subtitle" style="font-size:12px; color:#8e8e93; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>
                        </div>
                        <button type="button" class="sticker-bind-role-close" style="width:32px; height:32px; border:none; border-radius:50%; background:#f2f2f7; color:#636366; cursor:pointer;"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="sticker-bind-role-list" style="padding:8px; overflow-y:auto;"></div>
                    <div style="display:flex; gap:8px; padding:12px 14px 14px; border-top:1px solid #f2f2f7;">
                        <button type="button" class="sticker-bind-role-cancel" style="flex:1; height:42px; border:none; border-radius:16px; background:#f2f2f7; color:#555; font-size:15px; font-weight:700; cursor:pointer;">Cancel</button>
                        <button type="button" class="sticker-bind-role-save" style="flex:1; height:42px; border:none; border-radius:16px; background:#111; color:#fff; font-size:15px; font-weight:800; cursor:pointer;">Save</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) overlay.style.display = 'none';
            });
            overlay.querySelector('.sticker-bind-role-close')?.addEventListener('click', () => {
                overlay.style.display = 'none';
            });
            overlay.querySelector('.sticker-bind-role-cancel')?.addEventListener('click', () => {
                overlay.style.display = 'none';
            });
        }

        const subtitle = overlay.querySelector('.sticker-bind-role-subtitle');
        const list = overlay.querySelector('.sticker-bind-role-list');
            const saveBtn = overlay.querySelector('.sticker-bind-role-save');
        if (subtitle) subtitle.textContent = safeCategoryName;
        if (!list || !saveBtn) return;

        list.innerHTML = '';
        chars.forEach(char => {
            const selected = Array.isArray(char.mountedStickers) && char.mountedStickers.includes(safeCategoryName);
            const item = document.createElement('label');
            item.style.cssText = 'display:flex; align-items:center; gap:12px; padding:10px; border-radius:16px; cursor:pointer;';
            item.innerHTML = `
                <input type="checkbox" data-friend-id="${char.id}" ${selected ? 'checked' : ''} style="width:18px; height:18px; accent-color:#111;">
                <div style="width:34px; height:34px; border-radius:50%; overflow:hidden; background:#f2f2f7; color:#8e8e93; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    ${char.avatarUrl ? `<img src="${char.avatarUrl}" style="width:100%; height:100%; object-fit:cover;">` : `<span>${String(char.nickname || char.realName || '?').charAt(0)}</span>`}
                </div>
                <div style="min-width:0; flex:1; font-size:14px; color:#111; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${char.nickname || char.realName || 'Char'}</div>
            `;
            list.appendChild(item);
        });

        saveBtn.onclick = async () => {
            const checkedIds = new Set(Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map(input => String(input.dataset.friendId)));
            const touchedIds = chars.map(char => String(char.id));
            const saved = window.imApp.commitFriendsChange
                ? await window.imApp.commitFriendsChange(() => {
                    chars.forEach(char => {
                        const shouldBind = checkedIds.has(String(char.id));
                        const mounted = Array.isArray(char.mountedStickers) ? char.mountedStickers : [];
                        const nextMounted = mounted.filter(name => name !== safeCategoryName);
                        if (shouldBind) nextMounted.push(safeCategoryName);
                        char.mountedStickers = Array.from(new Set(nextMounted));
                    });
                }, { silent: true, friendIds: touchedIds, metaOnly: true })
                : false;

            if (!saved) {
                if (showToast) showToast('Bind failed');
                return;
            }

            const activeFriend = window.imData.currentActiveFriend;
            if (activeFriend && touchedIds.includes(String(activeFriend.id))) {
                const latestActive = (window.imData.friends || []).find(friend => String(friend.id) === String(activeFriend.id));
                if (latestActive) window.imData.currentActiveFriend = latestActive;
            }

            const settingsFriend = window.imData.currentSettingsFriend;
            if (settingsFriend && touchedIds.includes(String(settingsFriend.id))) {
                const latestSettings = (window.imData.friends || []).find(friend => String(friend.id) === String(settingsFriend.id));
                if (latestSettings) window.imData.currentSettingsFriend = latestSettings;
            }

            overlay.style.display = 'none';
            renderStickersView(true);
            window.dispatchEvent(new CustomEvent('u2:stickers-binding-changed', {
                detail: {
                    categoryName: safeCategoryName,
                    boundFriendIds: Array.from(checkedIds)
                }
            }));
            if (showToast) showToast('Bound');
        };

        overlay.style.display = 'flex';
    }

    // Render stickers view
    function renderStickersView(keepBatchMode) {
        if (!stickersListContainer) return;
        stickersListContainer.innerHTML = '';
        
        // If not explicitly keeping batch mode, reset it
        if (!keepBatchMode) {
            batchDeleteMode = false;
            selectedStickers.clear();
            if (stickersEditBtn) stickersEditBtn.innerHTML = '<i class="fas fa-pen"></i>';
        }

        const stickers = window.imData.stickers || [];
        if (stickers.length === 0) {
            stickersListContainer.innerHTML = '<div style="text-align: center; color: #8e8e93; padding: 40px;">No stickers yet. Tap + to add.</div>';
            return;
        }

        // Floating batch delete bar (fixed at bottom when in batch mode)
        if (batchDeleteMode) {
            const batchBar = document.createElement('div');
            batchBar.id = 'batch-delete-bar';
            batchBar.style.cssText = 'position: sticky; top: 0; z-index: 50; display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: rgba(255,255,255,0.95);   border-radius: 16px; margin-bottom: 12px; ';
            
            const selectInfo = document.createElement('div');
            selectInfo.id = 'batch-select-info';
            selectInfo.style.cssText = 'font-size: 14px; color: #8e8e93; font-weight: 500;';
            selectInfo.textContent = `已选择 ${selectedStickers.size} 项`;
            
            const batchDeleteBtn = document.createElement('div');
            batchDeleteBtn.id = 'batch-delete-toggle';
            batchDeleteBtn.style.cssText = 'background: #ff3b30; color: #fff; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;';
            batchDeleteBtn.innerHTML = '<i class="fas fa-trash"></i> 删除所选';
            batchDeleteBtn.addEventListener('click', async () => {
                if (selectedStickers.size === 0) {
                    if (showToast) showToast('请先选择要删除的表情');
                    return;
                }
                // Sort selected keys in reverse order to safely splice
                const sortedKeys = Array.from(selectedStickers).sort((a, b) => {
                    const [aCat, aIdx] = a.split('-').map(Number);
                    const [bCat, bIdx] = b.split('-').map(Number);
                    if (aCat !== bCat) return bCat - aCat;
                    return bIdx - aIdx;
                });
                const count = sortedKeys.length;

                const saved = window.imApp.commitStickersChange
                    ? await window.imApp.commitStickersChange(() => {
                        sortedKeys.forEach(key => {
                            const [catIdx, stickerIdx] = key.split('-').map(Number);
                            if (window.imData.stickers[catIdx]?.items?.[stickerIdx]) {
                                window.imData.stickers[catIdx].items.splice(stickerIdx, 1);
                            }
                        });
                        window.imData.stickers = (window.imData.stickers || []).filter(c => Array.isArray(c.items) && c.items.length > 0);
                    }, { silent: true })
                    : (window.imApp.saveStickers
                        ? await (async () => {
                            sortedKeys.forEach(key => {
                                const [catIdx, stickerIdx] = key.split('-').map(Number);
                                if (window.imData.stickers[catIdx]?.items?.[stickerIdx]) {
                                    window.imData.stickers[catIdx].items.splice(stickerIdx, 1);
                                }
                            });
                            window.imData.stickers = (window.imData.stickers || []).filter(c => Array.isArray(c.items) && c.items.length > 0);
                            return window.imApp.saveStickers({ silent: true });
                        })()
                        : false);

                if (!saved) {
                    if (showToast) showToast('表情删除失败');
                    return;
                }

                batchDeleteMode = false;
                selectedStickers.clear();
                if (stickersEditBtn) stickersEditBtn.innerHTML = '<i class="fas fa-pen"></i>';
                renderStickersView();
                if (showToast) showToast(`已删除 ${count} 张表情`);
            });
            
            batchBar.appendChild(selectInfo);
            batchBar.appendChild(batchDeleteBtn);
            stickersListContainer.appendChild(batchBar);
        }

        stickers.forEach((category, catIndex) => {
            const card = document.createElement('div');
            card.className = 'sticker-category-card';
            card.style.cssText = 'background: #fff; border: 1px solid #f2f2f7; border-radius: 14px; padding: 0; overflow: hidden;  display: flex; flex-direction: column; max-height: 350px; margin-bottom: 12px;';

            // Header: title center, collapse arrow right
            const header = document.createElement('div');
            header.className = 'sticker-category-header';
            header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; position: relative; min-height: 42px; padding: 7px 12px; flex-shrink: 0; border-bottom: 1px solid #f2f2f7;';

            const leftContainer = document.createElement('div');
            leftContainer.style.cssText = 'display: flex; align-items: center; gap: 6px; min-width: 90px;';

            const bindBtn = document.createElement('button');
            bindBtn.type = 'button';
            bindBtn.className = 'sticker-category-bind';
            const boundCount = getStickerBoundFriends(category.categoryName).length;
            bindBtn.innerHTML = `<i class="fas fa-user-plus"></i><span>${boundCount || ''}</span>`;
            bindBtn.title = 'Bind roles';
            bindBtn.style.cssText = 'height: 28px; min-width: 44px; border: none; border-radius: 14px; background: #f7f7fa; color: #111; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 0 9px; font-size: 12px; font-weight: 700; cursor: pointer;';
            bindBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openStickerBindingDialog(category.categoryName);
            });

            leftContainer.appendChild(bindBtn);

            // Center: title (absolutely positioned for true centering)
            const title = document.createElement('div');
            title.className = 'sticker-category-title';
            title.textContent = category.categoryName;
            title.style.cssText = 'position: absolute; left: 50%; transform: translateX(-50%); font-size: 14px; font-weight: 600; color: #000; white-space: nowrap; pointer-events: none;';

            // Right side container: delete btn + collapse icon
            const rightContainer = document.createElement('div');
            rightContainer.style.cssText = 'display: flex; align-items: center; gap: 4px; margin-left: auto;';

            // Delete category button (only visible when expanded)
            const deleteBtn = document.createElement('div');
            deleteBtn.className = 'sticker-category-delete';
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.style.cssText = 'color: #ff3b30; cursor: pointer; font-size: 13px; width: 28px; height: 28px; padding: 0; display: none; border-radius: 50%; align-items: center; justify-content: center; transition: background 0.2s;';
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`删除分类 "${category.categoryName}" ?`)) {
                    const saved = window.imApp.commitStickersChange
                        ? await window.imApp.commitStickersChange(() => {
                            window.imData.stickers.splice(catIndex, 1);
                        }, { silent: true })
                        : (window.imApp.saveStickers
                            ? await (async () => {
                                window.imData.stickers.splice(catIndex, 1);
                                return window.imApp.saveStickers({ silent: true });
                            })()
                            : false);

                    if (!saved) {
                        if (showToast) showToast('分类删除失败');
                        return;
                    }

                    renderStickersView();
                    if (showToast) showToast(`已删除分类 "${category.categoryName}"`);
                }
            });

            // Collapse indicator
            const collapseIcon = document.createElement('div');
            collapseIcon.className = 'sticker-category-collapse-icon';
            collapseIcon.style.cssText = 'color: #8e8e93; font-size: 13px; transition: transform 0.3s; padding: 6px;';
            collapseIcon.innerHTML = '<i class="fas fa-chevron-down"></i>';

            rightContainer.appendChild(deleteBtn);
            rightContainer.appendChild(collapseIcon);

            header.appendChild(leftContainer);
            header.appendChild(title);
            header.appendChild(rightContainer);

            // Sticker grid
            const grid = document.createElement('div');
            grid.className = 'sticker-grid';
            grid.style.overflowY = 'auto';
            grid.style.flex = '1';
            grid.style.minHeight = '0';
            grid.style.padding = '12px 12px 12px 12px';
            grid.style.alignContent = 'start';
            
            // Track collapsed state
            let isCollapsed = category.collapsed || false;
            if (isCollapsed) {
                grid.style.display = 'none';
                collapseIcon.querySelector('i').style.transform = 'rotate(-90deg)';
                deleteBtn.style.display = 'none';
            } else {
                deleteBtn.style.display = 'flex';
            }

            // Toggle collapse on header click
            header.addEventListener('click', (e) => {
                if (e.target.closest('.sticker-category-delete')) return;
                if (e.target.closest('.sticker-category-bind')) return;
                
                isCollapsed = !isCollapsed;
                category.collapsed = isCollapsed;
                grid.style.display = isCollapsed ? 'none' : 'grid';
                collapseIcon.querySelector('i').style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
                deleteBtn.style.display = isCollapsed ? 'none' : 'flex';
            });

            category.items.forEach((sticker, stickerIndex) => {
                const item = document.createElement('div');
                item.className = 'sticker-item';
                item.style.position = 'relative';
                
                const img = document.createElement('img');
                img.src = sticker.url;
                img.alt = sticker.name;
                img.title = sticker.name;

                // Selection checkbox for batch delete
                if (batchDeleteMode) {
                    const checkbox = document.createElement('div');
                    checkbox.className = 'sticker-select-checkbox';
                    checkbox.dataset.key = `${catIndex}-${stickerIndex}`;
                    const isSelected = selectedStickers.has(`${catIndex}-${stickerIndex}`);
                    checkbox.style.cssText = `position: absolute; top: 4px; left: 4px; width: 22px; height: 22px; border-radius: 50%; background: ${isSelected ? '#007aff' : 'rgba(255,255,255,0.9)'}; border: 2px solid ${isSelected ? '#007aff' : '#ccc'}; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #fff; cursor: pointer; z-index: 5; `;
                    if (isSelected) {
                        checkbox.innerHTML = '<i class="fas fa-check"></i>';
                        item.style.outline = '2px solid #007aff';
                        item.style.borderRadius = '8px';
                    }
                    
                    const toggleSelect = (e) => {
                        if (e) e.stopPropagation();
                        const key = `${catIndex}-${stickerIndex}`;
                        if (selectedStickers.has(key)) {
                            selectedStickers.delete(key);
                            checkbox.innerHTML = '';
                            checkbox.style.borderColor = '#ccc';
                            checkbox.style.background = 'rgba(255,255,255,0.9)';
                            item.style.outline = 'none';
                        } else {
                            selectedStickers.add(key);
                            checkbox.innerHTML = '<i class="fas fa-check"></i>';
                            checkbox.style.borderColor = '#007aff';
                            checkbox.style.background = '#007aff';
                            item.style.outline = '2px solid #007aff';
                        }
                        // Update count display
                        const info = document.getElementById('batch-select-info');
                        if (info) info.textContent = `已选择 ${selectedStickers.size} 项`;
                    };
                    
                    checkbox.addEventListener('click', toggleSelect);
                    item.addEventListener('click', () => toggleSelect());
                    item.appendChild(checkbox);
                }

                item.appendChild(img);

                // Long press or right click to enter batch mode when not already in it
                if (!batchDeleteMode) {
                    let pressTimer;
                    item.addEventListener('touchstart', () => {
                        pressTimer = setTimeout(() => {
                            batchDeleteMode = true;
                            selectedStickers.add(`${catIndex}-${stickerIndex}`);
                            if (stickersEditBtn) stickersEditBtn.innerHTML = '<i class="fas fa-check"></i>';
                            renderStickersView(true);
                        }, 800);
                    });
                    item.addEventListener('touchend', () => clearTimeout(pressTimer));
                    item.addEventListener('touchmove', () => clearTimeout(pressTimer));
                    
                    item.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        batchDeleteMode = true;
                        selectedStickers.add(`${catIndex}-${stickerIndex}`);
                        if (stickersEditBtn) stickersEditBtn.innerHTML = '<i class="fas fa-check"></i>';
                        renderStickersView(true);
                    });
                }

                grid.appendChild(item);
            });

            card.appendChild(header);
            card.appendChild(grid);
            stickersListContainer.appendChild(card);
        });
    }

    // Export render function
    window.imApp.renderStickersView = renderStickersView;

    const groupsToggle = document.getElementById('groups-toggle');
    if (groupsToggle) {
        groupsToggle.addEventListener('click', () => {
            groupsToggle.parentElement.classList.toggle('collapsed');
        });
    }

    const friendsToggle = document.getElementById('friends-toggle');
    if (friendsToggle) {
        friendsToggle.addEventListener('click', () => {
            friendsToggle.parentElement.classList.toggle('collapsed');
        });
    }

    const npcsToggle = document.getElementById('npcs-toggle');
    if (npcsToggle) {
        npcsToggle.addEventListener('click', () => {
            npcsToggle.parentElement.classList.toggle('collapsed');
        });
    }

    // --- Bottom Nav Logic ---
    const navHomeBtn = document.getElementById('nav-home-btn');
    const navChatsBtn = document.getElementById('nav-chats-btn');
    const navMemoryBtn = document.getElementById('nav-memory-btn');
    const navMomentsBtn = document.getElementById('nav-moments-btn');
    const lineNavIndicator = document.getElementById('line-nav-indicator');
    const imBottomNavContainer = document.querySelector('.line-bottom-nav-container');
    
    const imContent = document.querySelector('.line-content'); 
    const chatsContent = document.getElementById('chats-content');
    const memoryContent = document.getElementById('memory-content');
    const memoryTopFriendsScroll = document.getElementById('memory-top-friends-scroll');
    const memorySelectedName = document.getElementById('memory-selected-name');
    const memoryLocationSheet = document.getElementById('memory-location-sheet');
    const memoryLocationSheetContent = document.getElementById('memory-location-sheet-content');
    const memoryEntryDetailModal = document.getElementById('memory-entry-detail-modal');
    const scheduleModal = document.getElementById('chat-memory-schedule-modal');
    const scheduleClose = document.getElementById('chat-memory-schedule-close');
    const scheduleAddModal = document.getElementById('chat-memory-schedule-add-modal');
    const memoryEntryDetailTitle = document.getElementById('memory-entry-detail-title');
    const memoryEntryDetailBody = document.getElementById('memory-entry-detail-body');
    const memoryEntryDetailClose = document.getElementById('memory-entry-detail-close');
    const momentsContent = document.getElementById('moments-content');
    let currentMemoryFriendId = null;
    let memoryProgrammaticScrollUntil = 0;

    function updateLineNavIndicator(activeItem) {
        if (!activeItem || !lineNavIndicator) return;
        const containerRect = activeItem.parentElement.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        const relativeLeft = itemRect.left - containerRect.left;
        
        lineNavIndicator.style.width = `${itemRect.width}px`;
        lineNavIndicator.style.left = `${relativeLeft}px`;
    }

    setTimeout(() => {
        if(navHomeBtn && navHomeBtn.classList.contains('active')) updateLineNavIndicator(navHomeBtn);
    }, 100);

    function getMemoryFriends() {
        const allFriends = Array.isArray(window.imData?.friends) ? window.imData.friends : [];
        return allFriends.filter(f => f && f.type !== 'group' && f.type !== 'npc');
    }

    function getMemoryFriendName(friend) {
        return friend?.nickname || friend?.realname || friend?.realName || 'Unknown';
    }

    function escapeMemoryHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function setActiveMemoryFriend(friend) {
        if (!friend) return;
        currentMemoryFriendId = friend.id;
        if (memorySelectedName) memorySelectedName.textContent = getMemoryFriendName(friend);

        if (memoryTopFriendsScroll) {
            const items = memoryTopFriendsScroll.querySelectorAll('.memory-friend-story-item');
            items.forEach(item => {
                const isActive = String(item.dataset.friendId) === String(friend.id);
                item.classList.toggle('active', isActive);
            });
        }
        
        // Re-render location sheet when active friend changes
        if (memoryLocationSheetContent && memoryLocationSheetContent.innerHTML !== '') {
            renderMemoryLocationSheet('iphone');
        }
    }

    function renderMemoryView() {
        if (!memoryTopFriendsScroll) return;

        const validFriends = getMemoryFriends();
        memoryTopFriendsScroll.innerHTML = '';

        if (validFriends.length === 0) {
            currentMemoryFriendId = null;
            if (memorySelectedName) memorySelectedName.textContent = '';
            memoryTopFriendsScroll.innerHTML = '<div class="memory-empty-state">暂无好友</div>';
            return;
        }

        let activeFriend = validFriends.find(f => String(f.id) === String(currentMemoryFriendId)) || validFriends[0];

        validFriends.forEach(friend => {
            const item = document.createElement('div');
            item.className = 'memory-friend-story-item';
            item.dataset.friendId = friend.id;

            const avatarWrapper = document.createElement('div');
            avatarWrapper.className = 'memory-friend-story-avatar-wrapper';

            if (friend.avatarUrl) {
                const img = document.createElement('img');
                img.src = friend.avatarUrl;
                img.alt = '';
                img.className = 'memory-friend-story-avatar-img';
                avatarWrapper.appendChild(img);
            } else {
                const icon = document.createElement('i');
                icon.className = 'fas fa-user memory-friend-story-avatar-icon';
                avatarWrapper.appendChild(icon);
            }

            const nameEl = document.createElement('div');
            nameEl.className = 'memory-friend-story-name';
            nameEl.textContent = getMemoryFriendName(friend);

            item.appendChild(avatarWrapper);
            item.appendChild(nameEl);
            item.addEventListener('click', () => setActiveMemoryFriend(friend));
            memoryTopFriendsScroll.appendChild(item);
        });

        setActiveMemoryFriend(activeFriend);
    }

    function openMemoryLocationSheet() {
        const location = this?.dataset?.memoryLocation || '';
        if (memoryLocationSheet && window.openView) {
            renderMemoryLocationSheet(location);
            window.openView(memoryLocationSheet);
        }
    }

    function renderScheduleModal() {
        const friend = getCurrentMemoryFriend();
        if (!friend || !friend.memory || !friend.memory.schedule) return;

        const enabledToggle = document.getElementById('chat-memory-schedule-enabled-toggle');
        const sleepText = document.getElementById('chat-memory-schedule-sleep-text');
        const wakeText = document.getElementById('chat-memory-schedule-wake-text');
        const sleepPicker = document.getElementById('chat-memory-schedule-sleep-picker');
        const wakePicker = document.getElementById('chat-memory-schedule-wake-picker');
        const timeline = document.getElementById('chat-memory-schedule-timeline');
        const addScheduleBtn = document.getElementById('chat-memory-schedule-add-btn');

        const schedule = friend.memory.schedule;

        if (enabledToggle) {
            enabledToggle.checked = !!schedule.enabled;
            enabledToggle.onchange = async (e) => {
                await window.imApp.commitScopedFriendChange(friend, (f) => {
                    if (!f.memory.schedule) f.memory.schedule = {};
                    f.memory.schedule.enabled = e.target.checked;
                }, { silent: true });
                renderScheduleModal();
            };
        }
        
        if (addScheduleBtn) {
            addScheduleBtn.onclick = () => {
                if (scheduleAddModal && window.openView) {
                    const nameInput = document.getElementById('chat-memory-schedule-add-name');
                    const startInput = document.getElementById('chat-memory-schedule-add-start');
                    const endInput = document.getElementById('chat-memory-schedule-add-end');
                    if (nameInput) nameInput.value = '';
                    if (startInput) {
                        const now = new Date();
                        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                        startInput.value = now.toISOString().slice(0, 16);
                    }
                    if (endInput) {
                        const now = new Date();
                        now.setHours(now.getHours() + 1);
                        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                        endInput.value = now.toISOString().slice(0, 16);
                    }
                    window.openView(scheduleAddModal);
                }
            };
        }

        const confirmAddBtn = document.getElementById('chat-memory-schedule-add-confirm-btn');
        if (confirmAddBtn) {
            confirmAddBtn.onclick = async () => {
                const nameInput = document.getElementById('chat-memory-schedule-add-name');
                const startInput = document.getElementById('chat-memory-schedule-add-start');
                const endInput = document.getElementById('chat-memory-schedule-add-end');
                
                const eventName = nameInput ? nameInput.value.trim() : '';
                const startTime = startInput ? startInput.value : '';
                const endTime = endInput ? endInput.value : '';
                
                if (!eventName || !startTime || !endTime) {
                    if (window.showToast) window.showToast('请输入完整的行程信息');
                    return;
                }

                if (new Date(startTime) >= new Date(endTime)) {
                    if (window.showToast) window.showToast('结束时间必须晚于开始时间');
                    return;
                }

                await window.imApp.commitScopedFriendChange(friend, (f) => {
                    if (!f.memory.schedule) f.memory.schedule = {};
                    if (!Array.isArray(f.memory.schedule.events)) f.memory.schedule.events = [];
                    
                    const formatTime = (timeStr) => {
                        const d = new Date(timeStr);
                        return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    };

                    const formattedStartTime = formatTime(startTime);
                    const formattedEndTime = formatTime(endTime);

                    f.memory.schedule.events.push({
                        id: Date.now(),
                        name: eventName,
                        time: `${formattedStartTime} - ${formattedEndTime}`,
                        rawTime: startTime,
                        endTime: endTime
                    });
                    
                    f.memory.schedule.events.sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));
                }, { silent: true });

                if (scheduleAddModal && window.closeView) {
                    window.closeView(scheduleAddModal);
                }
                renderScheduleModal();
            };
        }
        
        if (sleepText && sleepPicker) {
            sleepText.textContent = schedule.sleepTime || '23:00';
            sleepPicker.value = schedule.sleepTime || '23:00';
            sleepPicker.onchange = async (e) => {
                sleepText.textContent = e.target.value;
                await window.imApp.commitScopedFriendChange(friend, (f) => {
                    if (!f.memory.schedule) f.memory.schedule = {};
                    f.memory.schedule.sleepTime = e.target.value;
                }, { silent: true });
                renderScheduleModal();
            };
        }

        if (wakeText && wakePicker) {
            wakeText.textContent = schedule.wakeTime || '07:00';
            wakePicker.value = schedule.wakeTime || '07:00';
            wakePicker.onchange = async (e) => {
                wakeText.textContent = e.target.value;
                await window.imApp.commitScopedFriendChange(friend, (f) => {
                    if (!f.memory.schedule) f.memory.schedule = {};
                    f.memory.schedule.wakeTime = e.target.value;
                }, { silent: true });
                renderScheduleModal();
            };
        }

        if (timeline) {
            const wake = schedule.wakeTime || '07:00';
            const sleep = schedule.sleepTime || '23:00';
            const events = Array.isArray(schedule.events) ? schedule.events : [];
            
            let html = `<div style="position: absolute; left: 24px; top: 10px; bottom: 10px; width: 2px; background: #e5e5ea; z-index: 1;"></div>`;
            
            html += `
                <div style="position: relative; z-index: 2; display: flex; align-items: flex-start;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: #007aff; margin-right: 15px; margin-top: 5px;  flex-shrink: 0;"></div>
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: #111;">起床</div>
                        <div style="font-size: 13px; color: #8e8e93; margin-top: 2px;">${wake} - 开启新的一天</div>
                    </div>
                </div>
            `;

            events.forEach(evt => {
                html += `
                    <div style="position: relative; z-index: 2; display: flex; align-items: flex-start;">
                        <div style="width: 10px; height: 10px; border-radius: 50%; background: #8e8e93; margin-right: 15px; margin-top: 15px;  flex-shrink: 0;"></div>
                        <div class="schedule-event-card" data-event-id="${evt.id}" style="background: #f2f2f7; border-radius: 16px; padding: 12px 16px; flex: 1; cursor: pointer; ">
                            <div style="font-size: 15px; font-weight: 600; color: #111;">${evt.name}</div>
                            <div style="font-size: 13px; color: #8e8e93; margin-top: 4px;">${evt.time}</div>
                        </div>
                    </div>
                `;
            });

            html += `
                <div style="position: relative; z-index: 2; display: flex; align-items: flex-start;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: #5856d6; margin-right: 15px; margin-top: 5px;  flex-shrink: 0;"></div>
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: #111;">睡觉</div>
                        <div style="font-size: 13px; color: #8e8e93; margin-top: 2px;">${sleep} - 休息时间到了</div>
                    </div>
                </div>
            `;
            
            timeline.innerHTML = html;

            const eventCards = timeline.querySelectorAll('.schedule-event-card');
            eventCards.forEach(card => {
                card.addEventListener('click', () => {
                    const eventId = card.getAttribute('data-event-id');
                    const targetEvent = events.find(e => String(e.id) === String(eventId));
                    if (targetEvent && window.imApp.showCustomModal) {
                        window.imApp.showCustomModal({
                            title: '行程详情',
                            message: `行程：${targetEvent.name}\n时间：${targetEvent.time}`,
                            isDestructive: true,
                            confirmText: '删除行程',
                            onConfirm: async () => {
                                await window.imApp.commitScopedFriendChange(friend, (f) => {
                                    if (f.memory && f.memory.schedule && Array.isArray(f.memory.schedule.events)) {
                                        f.memory.schedule.events = f.memory.schedule.events.filter(e => String(e.id) !== String(eventId));
                                    }
                                }, { silent: true });
                                if (window.showToast) window.showToast('行程已删除');
                                renderScheduleModal();
                            }
                        });
                    }
                });
            });
        }
    }

    function getCurrentMemoryFriend() {
        const friends = getMemoryFriends();
        return friends.find(f => String(f.id) === String(currentMemoryFriendId)) || friends[0] || null;
    }

    function showMemoryEntryDetail(entry) {
        if (!entry || !memoryEntryDetailModal || !memoryEntryDetailBody) return;
        if (memoryEntryDetailTitle) memoryEntryDetailTitle.textContent = entry.title || '记忆详情';
        memoryEntryDetailBody.innerHTML = `
            <div class="memory-entry-field">
                <div class="memory-entry-field-label">时间</div>
                <div class="memory-entry-field-value">${escapeMemoryHtml(entry.time || '')}</div>
            </div>
            <div class="memory-entry-field">
                <div class="memory-entry-field-label">事件</div>
                <div class="memory-entry-field-value">${escapeMemoryHtml(entry.event || '')}</div>
            </div>
            <div class="memory-entry-field">
                <div class="memory-entry-field-label">记忆点</div>
                <div class="memory-entry-field-value">${escapeMemoryHtml(entry.memoryPoints || '')}</div>
            </div>
            <div class="memory-entry-field">
                <div class="memory-entry-field-label">记忆程度</div>
                <div class="memory-entry-field-value">${escapeMemoryHtml(entry.degree || '高')}</div>
            </div>
            <div style="margin-top: 20px;">
                <button type="button" id="memory-entry-detail-delete-btn" style="width: 100%; padding: 12px; border-radius: 12px; background: #ffe5e5; color: #ff3b30; border: none; font-size: 15px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <i class="fas fa-trash-alt"></i> 删除这条记忆
                </button>
            </div>
        `;
        
        const deleteBtn = document.getElementById('memory-entry-detail-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                const friend = getCurrentMemoryFriend();
                if (!friend) return;
                
                const saved = await window.imApp.commitScopedFriendChange(friend, (targetFriend) => {
                    if (!targetFriend || !targetFriend.memory || !Array.isArray(targetFriend.memory.shortTermEntries)) return;
                    targetFriend.memory.shortTermEntries = targetFriend.memory.shortTermEntries.filter(e => String(e.id) !== String(entry.id));
                }, { silent: true });

                if (saved) {
                    if (window.showToast) window.showToast('已删除短期记忆');
                    if (window.closeView) window.closeView(memoryEntryDetailModal);
                    renderMemoryLocationSheet('iphone'); // Re-render the list
                } else {
                    if (window.showToast) window.showToast('删除失败');
                }
            });
        }
        
        if (window.openView) window.openView(memoryEntryDetailModal);
    }

    function renderMemoryLocationSheet(location) {
        if (!memoryLocationSheetContent) return;

        const friend = getCurrentMemoryFriend();
        
        if (location === 'icloud') {
            memoryLocationSheetContent.innerHTML = `
                <div class="memory-sheet-title">iCloud 云盘</div>
                <div class="memory-short-list">
                    <button type="button" class="memory-short-item" id="memory-schedule-btn">
                        <span>日程作息</span>
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            `;
            
            const scheduleBtn = memoryLocationSheetContent.querySelector('#memory-schedule-btn');
            if (scheduleBtn) {
                scheduleBtn.addEventListener('click', () => {
                    if (scheduleModal && window.openView) {
                        renderScheduleModal();
                        window.openView(scheduleModal);
                    }
                });
            }
            return;
        }

        const normalizedFriend = friend ? window.imApp.normalizeFriendData(friend) : null;

        if (location === 'deleted') {
            const socialAccounts = Array.isArray(normalizedFriend?.memory?.socialAccounts)
                ? normalizedFriend.memory.socialAccounts
                : [];

            if (socialAccounts.length === 0) {
                memoryLocationSheetContent.innerHTML = `
                    <div class="memory-sheet-title">社交帐号</div>
                    <div class="memory-short-list">
                        <div class="memory-short-empty">暂无社交帐号</div>
                    </div>
                `;
                return;
            }

            memoryLocationSheetContent.innerHTML = `
                <div class="memory-sheet-title">社交帐号</div>
                <div class="memory-short-list">
                    ${socialAccounts.map(account => `
                        <div class="memory-short-item" style="gap:12px;">
                            <span style="width:30px; height:30px; border-radius:9px; background:${account.platform === 'youtube' ? '#ff0000' : (account.platform === 'tiktok' ? '#111111' : '#8e8e93')}; color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                <i class="${account.platform === 'youtube' ? 'fab fa-youtube' : (account.platform === 'tiktok' ? 'fab fa-tiktok' : 'fas fa-link')}" style="color:#fff; font-size:15px;"></i>
                            </span>
                            <span style="display:flex; flex-direction:column; min-width:0; flex:1; gap:2px;">
                                <span style="font-size:15px; color:#111; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeMemoryHtml(account.handle || account.label || '社交帐号')}</span>
                                <span style="font-size:12px; color:#8e8e93; font-weight:400; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeMemoryHtml(account.url || '')}</span>
                            </span>
                        </div>
                    `).join('')}
                </div>
            `;
            return;
        }

        if (location === 'downloads') {
            const cherishedEntries = Array.isArray(normalizedFriend?.memory?.cherishedEntries)
                ? normalizedFriend.memory.cherishedEntries
                : [];
            
            if (cherishedEntries.length === 0) {
                memoryLocationSheetContent.innerHTML = `
                    <div class="memory-sheet-title">下载项</div>
                    <div class="memory-short-list">
                        <div class="memory-short-empty">暂无下载项</div>
                    </div>
                `;
                return;
            }

            memoryLocationSheetContent.innerHTML = `
                <div class="memory-sheet-title">下载项</div>
                <div class="chat-memory-modal-cherished-list" style="padding: 0 16px;">
                    ${cherishedEntries.slice().reverse().map(entry => `
                        <button type="button" class="chat-memory-modal-cherished-card" data-entry-id="${entry.id}">
                            <div class="chat-memory-modal-cherished-card-title">${escapeMemoryHtml(entry.title || '下载项')}</div>
                            <div class="chat-memory-modal-cherished-card-time">${escapeMemoryHtml(entry.createdAt || '点击查看详情')}</div>
                        </button>
                    `).join('')}
                </div>
            `;

            memoryLocationSheetContent.querySelectorAll('.chat-memory-modal-cherished-card').forEach(btn => {
                btn.addEventListener('click', () => {
                    const entryId = btn.getAttribute('data-entry-id');
                    const target = cherishedEntries.find(entry => String(entry.id) === String(entryId));
                    if (target && window.imApp.showCherishedMemoryDetail) {
                        window.imApp.showCherishedMemoryDetail(target);
                    }
                });
            });
            return;
        }

        if (location !== 'iphone') {
            memoryLocationSheetContent.innerHTML = '';
            return;
        }

        // "我的 iPhone" acts as the short-term memory library for manually generated chat summaries.
        const entries = Array.isArray(normalizedFriend?.memory?.shortTermEntries)
            ? normalizedFriend.memory.shortTermEntries
            : [];

        if (entries.length === 0) {
            memoryLocationSheetContent.innerHTML = `
                <div class="memory-sheet-title">我的 iPhone</div>
                <div class="memory-short-list">
                    <div class="memory-short-empty">暂无短期记忆</div>
                </div>
            `;
            return;
        }

        memoryLocationSheetContent.innerHTML = `
            <div class="memory-sheet-title">我的 iPhone</div>
            <div class="memory-short-list">
                ${entries.slice().reverse().map(entry => `
                    <button type="button" class="memory-short-item" data-memory-entry-id="${entry.id}">
                        <span>${escapeMemoryHtml(entry.title || '对话总结')}</span>
                        <i class="fas fa-chevron-right"></i>
                    </button>
                `).join('')}
            </div>
        `;

        memoryLocationSheetContent.querySelectorAll('.memory-short-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const entryId = btn.getAttribute('data-memory-entry-id');
                const target = entries.find(entry => String(entry.id) === String(entryId));
                if (target) showMemoryEntryDetail(target);
            });
        });
    }

    document.querySelectorAll('.memory-file-row').forEach(row => {
        row.addEventListener('click', openMemoryLocationSheet);
    });

    if (memoryEntryDetailClose && memoryEntryDetailModal) {
        memoryEntryDetailClose.addEventListener('click', () => {
            if (window.closeView) window.closeView(memoryEntryDetailModal);
        });
    }

    if (scheduleClose && scheduleModal) {
        scheduleClose.addEventListener('click', () => {
            if (window.closeView) window.closeView(scheduleModal);
        });
    }

    window.imApp.renderMemoryView = renderMemoryView;

    function hideAllTabs() {
        if(imContent) imContent.style.display = 'none';
        if(chatsContent) chatsContent.style.display = 'none';
        if(memoryContent) memoryContent.style.display = 'none';
        if(momentsContent) momentsContent.style.display = 'none';
        
        if(navHomeBtn) navHomeBtn.classList.remove('active');
        if(navChatsBtn) navChatsBtn.classList.remove('active');
        if(navMemoryBtn) navMemoryBtn.classList.remove('active');
        if(navMomentsBtn) navMomentsBtn.classList.remove('active');
        
        const imHeaderRight = document.querySelector('.line-header-right');
        if (imHeaderRight) imHeaderRight.style.display = 'flex'; 
    }

    if (navHomeBtn) {
        navHomeBtn.addEventListener('click', () => {
            hideAllTabs();
            if(imContent) imContent.style.display = 'block';
            if(imBottomNavContainer) imBottomNavContainer.style.display = 'flex';
            navHomeBtn.classList.add('active');
            updateLineNavIndicator(navHomeBtn);
            if (window.imApp.renderFriendsList) window.imApp.renderFriendsList();
            if (window.imApp.renderGroupsList) window.imApp.renderGroupsList();
        });
    }

    if (navChatsBtn) {
        navChatsBtn.addEventListener('click', () => {
            hideAllTabs();
            if(chatsContent) {
                chatsContent.style.display = 'flex';
                chatsContent.style.flexDirection = 'column';
                if (window.imApp.updateChatsView) window.imApp.updateChatsView();
            }
            navChatsBtn.classList.add('active');
            updateLineNavIndicator(navChatsBtn);
            if (window.imApp.updateChatsUnreadBadges) window.imApp.updateChatsUnreadBadges();
        });
    }

    if (navMemoryBtn) {
        navMemoryBtn.addEventListener('click', () => {
            hideAllTabs();
            if(memoryContent) {
                memoryContent.style.display = 'flex';
                memoryContent.style.flexDirection = 'column';
                renderMemoryView();
            }
            if(imBottomNavContainer) imBottomNavContainer.style.display = 'flex';
            navMemoryBtn.classList.add('active');
            updateLineNavIndicator(navMemoryBtn);
            if (window.imApp.updateChatsUnreadBadges) window.imApp.updateChatsUnreadBadges();
        });
    }

    if (navMomentsBtn) {
        navMomentsBtn.addEventListener('click', () => {
            hideAllTabs();
            if(momentsContent) {
                momentsContent.style.display = 'flex';
                momentsContent.style.flexDirection = 'column';
                if (window.imApp.renderMoments) window.imApp.renderMoments();
                
                if(imBottomNavContainer) imBottomNavContainer.style.display = 'flex';
                
                const imHeaderRight = document.querySelector('.line-header-right');
                if (imHeaderRight) imHeaderRight.style.display = 'none';
            }
            navMomentsBtn.classList.add('active');
            updateLineNavIndicator(navMomentsBtn);
            if (window.imApp.updateChatsUnreadBadges) window.imApp.updateChatsUnreadBadges();
        });
    }

    // Initialize saved CSS for all friends on boot
    setTimeout(() => {
        if (window.imApp.applyAllSavedCss) window.imApp.applyAllSavedCss();
    }, 100);
});

