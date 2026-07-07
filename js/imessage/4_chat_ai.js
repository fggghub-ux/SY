// ==========================================
// IMESSAGE: 4_chat_ai.js
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    window.imChat = window.imChat || {};
    const imChat = window.imChat;

    function getLiveFriendById(friendId) {
        return (window.imData.friends || []).find((item) => String(item.id) === String(friendId)) || null;
    }

    const aiReplyInFlight = new Set();
    const aiReplyControllers = new Map();
    const conversationEpochs = new Map();
    const autonomousActivityInFlight = new Set();
    const autonomousMomentInFlight = new Set();

    function getFriendKey(friendOrId) {
        const rawId = friendOrId && typeof friendOrId === 'object' ? friendOrId.id : friendOrId;
        return rawId == null ? '' : String(rawId);
    }

    function getConversationEpoch(friendOrId) {
        const friendKey = getFriendKey(friendOrId);
        return friendKey ? (conversationEpochs.get(friendKey) || 0) : 0;
    }

    function invalidateFriendConversation(friendOrId) {
        const friendKey = getFriendKey(friendOrId);
        if (!friendKey) return false;
        conversationEpochs.set(friendKey, getConversationEpoch(friendKey) + 1);
        const controller = aiReplyControllers.get(friendKey);
        if (controller) controller.abort();
        aiReplyControllers.delete(friendKey);
        aiReplyInFlight.delete(friendKey);

        const page = document.getElementById(`chat-interface-${friendKey}`);
        page?.querySelectorAll('.typing-row').forEach(row => row.remove());
        return true;
    }

    function normalizeAutonomousTask(task) {
        return window.imApp?.normalizeAutonomousTask
            ? window.imApp.normalizeAutonomousTask(task)
            : {
                enabled: !!task?.enabled,
                minIntervalMinutes: Math.max(1, Math.round(Number(task?.minIntervalMinutes) || 30)),
                maxIntervalMinutes: Math.max(
                    Math.max(1, Math.round(Number(task?.minIntervalMinutes) || 30)),
                    Math.round(Number(task?.maxIntervalMinutes) || 240)
                ),
                nextRunAt: Math.max(0, Number(task?.nextRunAt) || 0),
                lastRunAt: Math.max(0, Number(task?.lastRunAt) || 0)
            };
    }

    function normalizeAutonomousActivity(activity) {
        return window.imApp?.normalizeAutonomousActivity
            ? window.imApp.normalizeAutonomousActivity(activity)
            : {
                reply: normalizeAutonomousTask(activity?.reply || activity),
                moment: normalizeAutonomousTask(activity?.moment)
            };
    }

    function getAutonomousTask(activity, taskName) {
        const normalized = normalizeAutonomousActivity(activity);
        return normalizeAutonomousTask(normalized[taskName]);
    }

    function getRandomAutonomousDelay(task) {
        const normalized = normalizeAutonomousTask(task);
        const min = Math.max(1, Number(normalized.minIntervalMinutes) || 30);
        const max = Math.max(min, Number(normalized.maxIntervalMinutes) || 240);
        const minutes = min + Math.floor(Math.random() * (max - min + 1));
        return minutes * 60 * 1000;
    }

    function formatAutonomousPromptTime(timestamp) {
        const value = Number(timestamp) || 0;
        if (value <= 0) return '未知';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '未知';
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    function formatAutonomousPromptDuration(fromTimestamp, toTimestamp = Date.now()) {
        const from = Number(fromTimestamp) || 0;
        const to = Number(toTimestamp) || 0;
        if (from <= 0 || to <= 0 || to < from) return '未知';
        const totalMinutes = Math.max(0, Math.floor((to - from) / 60000));
        if (totalMinutes < 1) return '不到1分钟';
        if (totalMinutes < 60) return `${totalMinutes}分钟`;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours < 24) return minutes ? `${hours}小时${minutes}分钟` : `${hours}小时`;
        const days = Math.floor(hours / 24);
        const restHours = hours % 24;
        return restHours ? `${days}天${restHours}小时` : `${days}天`;
    }

    function getAutonomousMessageText(message) {
        if (!message) return '';
        if (message.type === 'sticker') return `[表情] ${message.stickerCategory ? `${message.stickerCategory} / ` : ''}${message.stickerName || message.text || ''}`.trim();
        if (message.type === 'image') return `[图片] ${message.description || message.text || message.content || ''}`.trim();
        if (message.type === 'fake_link') {
            const link = message.fakeLinkData || {};
            const readable = link.bodyText || link.summary || '';
            return `[假链接] ${link.siteName || '假网页'}：${link.title || message.content || ''}${readable ? `\n${String(readable).slice(0, 1200)}` : '\n（未填写正文）'}`.trim();
        }
        if (message.type === 'voice_message') return `[语音] ${message.transcript || message.text || message.content || ''}`.trim();
        if (message.type === 'pay_transfer') return `[转账] ${message.description || message.content || ''}`.trim();
        return String(message.content || message.text || message.description || '').trim();
    }

    function buildAutonomousActivityPrompt(friend, now = Date.now()) {
        const messages = Array.isArray(friend?.messages) ? friend.messages : [];
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
        const lastUserMessage = messages.slice().reverse().find(msg => msg && msg.role === 'user') || null;
        const lastAssistantMessage = messages.slice().reverse().find(msg => msg && msg.role === 'assistant') || null;
        const userHasNotReplied = !!lastAssistantMessage && (!lastUserMessage || Number(lastAssistantMessage.timestamp) > Number(lastUserMessage.timestamp));
        const charName = friend?.realName || friend?.nickname || '你';

        return `【自主活动触发】
这不是 User 刚刚发来的消息，而是 ${charName} 在自动回复开关开启后，间隔 30-240 分钟随机主动发起的一轮消息。
当前真实时间：${formatAutonomousPromptTime(now)}
上一条任意消息时间：${lastMessage ? formatAutonomousPromptTime(lastMessage.timestamp) : '暂无'}${lastMessage ? `，距现在约 ${formatAutonomousPromptDuration(lastMessage.timestamp, now)}` : ''}
User 上一次发消息时间：${lastUserMessage ? formatAutonomousPromptTime(lastUserMessage.timestamp) : '暂无'}${lastUserMessage ? `，距现在约 ${formatAutonomousPromptDuration(lastUserMessage.timestamp, now)}` : ''}
你上一轮消息时间：${lastAssistantMessage ? formatAutonomousPromptTime(lastAssistantMessage.timestamp) : '暂无'}${lastAssistantMessage ? `，距现在约 ${formatAutonomousPromptDuration(lastAssistantMessage.timestamp, now)}` : ''}
上一条消息来自：${lastMessage?.role === 'user' ? 'User' : (lastMessage?.role === 'assistant' ? charName : '未知')}
上一条消息内容：${getAutonomousMessageText(lastMessage) || '暂无'}

本轮要求：
1. 必须注意上下文里的时间戳，先判断上一轮消息是什么时候、现在是什么时候、这段时间你可能在做什么。
2. 如果 User 在你上一轮之后一直没回复，可以自然地问 User 在干嘛、怎么没回，或报备你现在正在做什么；不要像客服催促。
3. 如果最近话题没有结束，要承接上一轮；如果间隔较久，可以开启自然的新话题或分享身边状态。
4. 输出 2-8 条独立聊天气泡，必须继续遵守原本 <chat_json> JSON 输出格式。`;
    }

    function createApiRunId(friendId) {
        const prefix = `api-${friendId || 'chat'}`;
        return window.imChat.createMessageId
            ? window.imChat.createMessageId(prefix)
            : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function isMemoryEntryTriggered(entry, recentText) {
        if (!entry) return false;
        const title = String(entry.title || '').trim();
        const memoryPoints = String(entry.memoryPoints || '').trim();
        const keyword = String(entry.keyword || '').trim();
        
        if (keyword && recentText.includes(keyword)) return true;
        if (title && title !== '对话总结' && title !== '未命名词条' && title !== '珍视回忆' && title !== '长期记忆' && recentText.includes(title)) return true;
        if (memoryPoints && recentText.includes(memoryPoints)) return true;
        return false;
    }

    function getRecentContextText(friend) {
        if (!Array.isArray(friend.messages)) return '';
        return friend.messages.slice(-10).map(m => {
            if (m && m.type === 'fake_link') {
                const link = m.fakeLinkData || {};
                return [link.title || m.content || '', link.summary || '', String(link.bodyText || '').slice(0, 5000)]
                    .filter(Boolean)
                    .join('\n');
            }
            return String(m && (m.content || m.text) || '');
        }).join('\n');
    }

    function resolveMountedSticker(friend, categoryName, stickerName) {
        const mounted = Array.isArray(friend?.mountedStickers) ? friend.mountedStickers.map(String) : [];
        if (mounted.length === 0) return null;

        const requestedCategory = String(categoryName || '').trim();
        const requestedName = String(stickerName || '').trim();
        if (!requestedName) return null;

        const categories = Array.isArray(window.imData?.stickers) ? window.imData.stickers : [];
        const allowedCategories = categories.filter(category => {
            const name = String(category?.categoryName || '');
            if (!mounted.includes(name)) return false;
            return !requestedCategory || name === requestedCategory;
        });

        for (const category of allowedCategories) {
            const sticker = (Array.isArray(category.items) ? category.items : [])
                .find(item => String(item?.name || '').trim() === requestedName);
            if (sticker && sticker.url) {
                return {
                    stickerCategory: category.categoryName || '',
                    stickerName: sticker.name || requestedName,
                    stickerUrl: sticker.url
                };
            }
        }

        return null;
    }

    function buildMountedStickerContext(friend) {
        const mounted = Array.isArray(friend?.mountedStickers) ? friend.mountedStickers : [];
        if (mounted.length === 0) return '';

        const allStickers = Array.isArray(window.imData?.stickers) ? window.imData.stickers : [];
        const stickerLines = [];
        mounted.forEach(catName => {
            const cat = allStickers.find(c => c.categoryName === catName);
            if (cat && Array.isArray(cat.items) && cat.items.length > 0) {
                const names = cat.items.map(s => s.name).filter(Boolean).join(', ');
                if (names) stickerLines.push(`[${cat.categoryName}]: ${names}`);
            }
        });

        return stickerLines.length > 0 ? stickerLines.join('\n') : '';
    }

    function scheduleFriendPersistence(friendId, options = {}) {
        if (friendId == null) return false;

        if (window.imApp.scheduleFriendSave) {
            return window.imApp.scheduleFriendSave(friendId, options);
        }

        if (window.imApp.markFriendDirty) {
            window.imApp.markFriendDirty(friendId);
        }

        if (window.imApp.scheduleGlobalSave) {
            return window.imApp.scheduleGlobalSave({
                delay: options.delay,
                silent: options.silent !== false
            });
        }

        return false;
    }

    async function flushFriendPersistence(friendId, options = {}) {
        if (friendId == null) return false;

        if (window.imApp.flushFriendSave) {
            return window.imApp.flushFriendSave(friendId, options);
        }

        if (window.imApp.commitFriendsChange) {
            return window.imApp.commitFriendsChange(() => {}, {
                silent: options.silent !== false,
                friendId
            });
        }

        return false;
    }

    async function handleSend(friend, inputEl, container) {
        const text = inputEl.value.trim();
        if (!text) return false;

        const liveFriend = getLiveFriendById(friend.id) || friend;
        if (liveFriend.type === 'group' && Number(liveFriend.leftGroupAt) > 0) {
            if (window.showToast) window.showToast('你已退出该群，不能发送消息');
            return;
        }

        const now = Date.now();
        const lastMsg = liveFriend.messages && liveFriend.messages.length > 0
            ? liveFriend.messages[liveFriend.messages.length - 1]
            : null;

        if (!lastMsg || (now - (lastMsg.timestamp || 0) > 300000)) {
            window.imChat.renderTimestamp(now, container);
        }

        const replyToText = window.imData.currentReplyText || null;

        const msgObj = {
            id: window.imChat.createMessageId('msg'),
            role: 'user',
            content: text,
            timestamp: now,
            replyTo: replyToText
        };

        window.imChat.renderUserBubble(text, container, now, replyToText, null, false, msgObj.id, liveFriend);
        inputEl.value = '';

        const saved = window.imApp.appendFriendMessage
            ? await window.imApp.appendFriendMessage(friend.id, msgObj, { silent: true })
            : (window.imApp.commitFriendChange
                ? await window.imApp.commitFriendChange(friend.id, (targetFriend) => {
                    if (!targetFriend) return;
                    if (!targetFriend.messages) targetFriend.messages = [];
                    targetFriend.messages.push(msgObj);

                    if (window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(targetFriend.id)) {
                        window.imData.currentActiveFriend = targetFriend;
                    }
                }, {
                    silent: true,
                    immediate: false,
                    delay: 400
                })
                : (window.imApp.commitFriendsChange
                    ? await window.imApp.commitFriendsChange(() => {
                        const targetFriend = window.imData.friends.find((item) => String(item.id) === String(friend.id));
                        if (!targetFriend) return;
                        if (!targetFriend.messages) targetFriend.messages = [];
                        targetFriend.messages.push(msgObj);
                    }, {
                        silent: true,
                        friendId: friend.id,
                        immediate: false,
                        delay: 400
                    })
                    : false));

        if (!saved) {
            const activeContainer = container || document.querySelector(`#chat-interface-${friend.id} .ins-chat-messages`);
            const latestFriend = getLiveFriendById(friend.id) || friend;
            if (activeContainer && window.imChat.rerenderChatContainer) {
                window.imChat.rerenderChatContainer(latestFriend, activeContainer, { scroll: true });
            }
            if (window.showToast) window.showToast('消息保存失败');
            return;
        }

        window.imData.currentReplyText = null;
        const page = document.getElementById(`chat-interface-${friend.id}`);
        if (page) {
            const preview = page.querySelector('.reply-preview-container');
            if (preview) preview.style.display = 'none';
        }
    }

    function extractTaggedBlock(text, tagName) {
        if (!text || !tagName) return null;
        const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
        const match = String(text).match(regex);
        return match ? match[1].trim() : null;
    }

    function removeTaggedBlock(text, tagName) {
        if (!text || !tagName) return text;
        const regex = new RegExp(`<${tagName}>[\\s\\S]*?<\\/${tagName}>`, 'i');
        return String(text).replace(regex, '').trim();
    }

    function normalizeOfflineActionText(value) {
        let text = String(value == null ? '' : value).trim();
        const wrapperPairs = [
            ['（', '）'],
            ['(', ')'],
            ['[', ']'],
            ['【', '】'],
            ['{', '}'],
            ['「', '」'],
            ['『', '』']
        ];

        let changed = true;
        while (changed && text.length > 1) {
            changed = false;
            for (const [open, close] of wrapperPairs) {
                if (text.startsWith(open) && text.endsWith(close)) {
                    text = text.slice(open.length, text.length - close.length).trim();
                    changed = true;
                    break;
                }
            }
        }

        return text;
    }

    function normalizeOfflineSceneText(value) {
        const text = String(value == null ? '' : value).trim();
        if (!text) return '';

        const disallowedPerspectivePattern = /(我|我们|咱|咱们|俺|本人|你|你们|您|诸位|大家)/;
        return disallowedPerspectivePattern.test(text) ? '' : text;
    }

    function parseJsonArrayFromText(rawText) {
        if (!rawText || typeof rawText !== 'string') return null;
        let cleanText = rawText.trim();

        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.substring(7);
        } else if (cleanText.startsWith('```')) {
            cleanText = cleanText.substring(3);
        }
        if (cleanText.endsWith('```')) {
            cleanText = cleanText.substring(0, cleanText.length - 3);
        }

        cleanText = cleanText.trim();
        if (!cleanText) return null;

        try {
            const parsed = JSON.parse(cleanText);
            return Array.isArray(parsed) ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    function normalizeProfilePanelPayload(rawText) {
        if (!rawText || typeof rawText !== 'string') return null;

        let cleanText = rawText.trim();
        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.substring(7);
        } else if (cleanText.startsWith('```')) {
            cleanText = cleanText.substring(3);
        }
        if (cleanText.endsWith('```')) {
            cleanText = cleanText.substring(0, cleanText.length - 3);
        }

        cleanText = cleanText.trim();
        if (!cleanText) return null;

        try {
            const parsed = JSON.parse(cleanText);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

            const safeEvents = Array.isArray(parsed.events)
                ? parsed.events.map((eventItem, index) => {
                    const safeType = typeof eventItem?.type === 'string' && eventItem.type.trim()
                        ? eventItem.type.trim()
                        : 'note';
                    const safeId = eventItem?.id != null ? eventItem.id : `event-${Date.now()}-${index}`;
                    const safeRequestText = typeof eventItem?.requestText === 'string'
                        ? eventItem.requestText.trim()
                        : '';
                    const safeDetail = typeof eventItem?.detail === 'string'
                        ? eventItem.detail.trim()
                        : '';
                    const safeTitle = typeof eventItem?.title === 'string' && eventItem.title.trim()
                        ? eventItem.title.trim()
                        : (safeType === 'memory_request' ? '想珍藏这一刻' : '新的事件');

                    const safeMemoryPayload = eventItem?.memoryPayload && typeof eventItem.memoryPayload === 'object'
                        ? {
                            title: typeof eventItem.memoryPayload.title === 'string' && eventItem.memoryPayload.title.trim()
                                ? eventItem.memoryPayload.title.trim()
                                : safeTitle,
                            content: typeof eventItem.memoryPayload.content === 'string' && eventItem.memoryPayload.content.trim()
                                ? eventItem.memoryPayload.content.trim()
                                : (safeRequestText || (typeof eventItem?.description === 'string' ? eventItem.description.trim() : '')),
                            detail: typeof eventItem.memoryPayload.detail === 'string'
                                ? eventItem.memoryPayload.detail.trim()
                                : safeDetail,
                            reason: typeof eventItem.memoryPayload.reason === 'string'
                                ? eventItem.memoryPayload.reason.trim()
                                : '',
                            sourceEventId: typeof eventItem.memoryPayload.sourceEventId === 'string' && eventItem.memoryPayload.sourceEventId.trim()
                                ? eventItem.memoryPayload.sourceEventId.trim()
                                : String(safeId),
                            createdAt: typeof eventItem.memoryPayload.createdAt === 'string'
                                ? eventItem.memoryPayload.createdAt.trim()
                                : (typeof eventItem?.time === 'string' ? eventItem.time.trim() : ''),
                            sourceThought: typeof eventItem.memoryPayload.sourceThought === 'string'
                                ? eventItem.memoryPayload.sourceThought.trim()
                                : ''
                        }
                        : null;

                    return {
                        id: safeId,
                        title: safeTitle,
                        description: typeof eventItem?.description === 'string' ? eventItem.description.trim() : '',
                        time: typeof eventItem?.time === 'string' ? eventItem.time.trim() : '',
                        type: safeType,
                        status: typeof eventItem?.status === 'string' && eventItem.status.trim()
                            ? eventItem.status.trim()
                            : 'pending',
                        requestText: safeRequestText,
                        detail: safeDetail,
                        confirmText: typeof eventItem?.confirmText === 'string' && eventItem.confirmText.trim()
                            ? eventItem.confirmText.trim()
                            : '确认',
                        cancelText: typeof eventItem?.cancelText === 'string' && eventItem.cancelText.trim()
                            ? eventItem.cancelText.trim()
                            : '取消',
                        memoryPayload: safeMemoryPayload
                    };
                })
                : [];

            return {
                thought: typeof parsed.thought === 'string' && parsed.thought.trim() ? parsed.thought.trim() : '',
                location: typeof parsed.location === 'string' && parsed.location.trim() ? parsed.location.trim() : '',
                action: typeof parsed.action === 'string' && parsed.action.trim() ? parsed.action.trim() : '',
                mood: typeof parsed.mood === 'string' ? parsed.mood.trim() : '',
                expression: typeof parsed.expression === 'string' ? parsed.expression.trim() : '',
                affectionChange: typeof parsed.affectionChange === 'number' ? Math.max(-5, Math.min(5, parsed.affectionChange)) : 0,
                status: 'online',
                events: safeEvents
            };
        } catch (e) {
            return null;
        }
    }

    function getAiResponseContent(data) {
        if (!data || typeof data !== 'object') return '';

        const firstChoice = Array.isArray(data.choices) ? data.choices[0] : null;
        if (!firstChoice || typeof firstChoice !== 'object') return '';

        const messageContent = firstChoice.message && typeof firstChoice.message.content === 'string'
            ? firstChoice.message.content
            : '';

        if (messageContent) return messageContent;

        if (typeof firstChoice.text === 'string') return firstChoice.text;
        if (typeof firstChoice.delta?.content === 'string') return firstChoice.delta.content;

        return '';
    }

    async function fetchChatCompletionWithTimeout(endpoint, apiConfig, messages, timeoutMs = 60000, externalController = null) {
        const controller = externalController || new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            console.log('[iMessage API] request start', {
                endpoint,
                model: apiConfig.model || '',
                messageCount: Array.isArray(messages) ? messages.length : 0,
                timeoutMs
            });

            return await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
                body: JSON.stringify({
                    model: apiConfig.model || '',
                    messages: messages,
                    temperature: parseFloat(apiConfig.temperature) || 0.7
                }),
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId);
        }
    }

    const linkedAccountBotInFlight = new Set();

    function resolveChatCompletionsEndpoint(apiConfig) {
        let endpoint = String(apiConfig?.endpoint || '').trim();
        if (!endpoint) return '';
        if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
        if (!endpoint.endsWith('/chat/completions')) {
            endpoint = endpoint.endsWith('/v1') ? `${endpoint}/chat/completions` : `${endpoint}/v1/chat/completions`;
        }
        return endpoint;
    }

    function parseJsonObjectFromText(rawText) {
        if (!rawText || typeof rawText !== 'string') return null;
        let cleanText = rawText.trim();
        const tagged = extractTaggedBlock(cleanText, 'linked_accounts');
        if (tagged) cleanText = tagged;

        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.substring(7);
        } else if (cleanText.startsWith('```')) {
            cleanText = cleanText.substring(3);
        }
        if (cleanText.endsWith('```')) {
            cleanText = cleanText.substring(0, cleanText.length - 3);
        }

        cleanText = cleanText.trim();
        try {
            const parsed = JSON.parse(cleanText);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
        } catch (e) {
            const firstBrace = cleanText.indexOf('{');
            const lastBrace = cleanText.lastIndexOf('}');
            if (firstBrace > -1 && lastBrace > firstBrace) {
                try {
                    const parsed = JSON.parse(cleanText.slice(firstBrace, lastBrace + 1));
                    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
                } catch (_) {
                    return null;
                }
            }
        }
        return null;
    }

    function getLinkedIdentityKey(name) {
        const safeName = String(name || '').trim().toLowerCase();
        return safeName;
    }

    function normalizeLinkedMessageList(messages, role, minCount = 2, maxCount = 5) {
        if (!Array.isArray(messages)) return [];
        const normalized = messages
            .map(item => {
                if (typeof item === 'string') {
                    const text = item.trim();
                    return text ? { text, translation: '' } : null;
                }
                if (item && typeof item === 'object') {
                    const text = String(item.text || item.content || item.message || '').trim();
                    if (!text) return null;
                    const translation = typeof item.translation === 'string' && item.translation.trim()
                        ? item.translation.trim()
                        : (typeof item.translationZh === 'string' && item.translationZh.trim()
                            ? item.translationZh.trim()
                            : (typeof item.trans === 'string' && item.trans.trim() ? item.trans.trim() : ''));
                    return { text, translation };
                }
                return null;
            })
            .filter(Boolean)
            .slice(0, maxCount)
            .map((message, index) => {
                const normalizedMessage = {
                    id: createApiRunId(`linked-${role}-${index}`),
                    role,
                    text: message.text,
                    timestamp: Date.now() + index
                };
                if (message.translation) normalizedMessage.translation = message.translation;
                return normalizedMessage;
            });

        return normalized.length >= minCount ? normalized : [];
    }

    function buildLinkedRelationshipCandidates(friend) {
        const relationships = Array.isArray(friend?.memory?.relationships) ? friend.memory.relationships : [];
        return relationships
            .map(rel => {
                const npc = (window.imData.friends || []).find(item => String(item.id) === String(rel?.npcId));
                if (!npc) return null;
                const realName = String(npc.realName || npc.nickname || '').trim();
                const remark = String(npc.nickname || npc.realName || '').trim();
                if (!realName && !remark) return null;
                return {
                    sourceNpcId: String(npc.id),
                    realName,
                    remark,
                    persona: String(npc.persona || npc.signature || '').trim(),
                    relationship: String(rel.relation || '').trim()
                };
            })
            .filter(Boolean);
    }

    function buildLinkedPromptMemorySections(friend) {
        const normalizedFriend = window.imApp.normalizeFriendData(friend || {});
        const recentText = getRecentContextText(normalizedFriend);

        const shortTermEntries = Array.isArray(normalizedFriend.memory?.shortTermEntries)
            ? normalizedFriend.memory.shortTermEntries
                .filter(entry => entry && (entry.title || entry.event || entry.memoryPoints) && isMemoryEntryTriggered(entry, recentText))
                .slice(-8)
                .map(entry => `<short_term_memory>\n<title>${entry.title || 'Memory'}</title>\n<content>${entry.event || entry.content || ''}</content>\n<memory_points>${entry.memoryPoints || ''}</memory_points>\n</short_term_memory>`)
                .join('\n')
            : '';

        let longTermXml = '';
        if (Array.isArray(normalizedFriend.memory?.longTermEntries) && normalizedFriend.memory.longTermEntries.length > 0) {
            const triggered = normalizedFriend.memory.longTermEntries.filter(e => isMemoryEntryTriggered(e, recentText));
            if (triggered.length > 0) {
                longTermXml = `<long_term_memories>\n${triggered.map(e => `<memory>\n<title>${e.title || ''}</title>\n<content>${e.content || ''}</content>\n</memory>`).join('\n')}\n</long_term_memories>`;
            }
        } else if (normalizedFriend.memory?.longTerm) {
            longTermXml = `<long_term_memories>\n${normalizedFriend.memory.longTerm}\n</long_term_memories>`;
        }

        let cherishedXml = '';
        if (Array.isArray(normalizedFriend.memory?.cherishedEntries) && normalizedFriend.memory.cherishedEntries.length > 0) {
            const triggered = normalizedFriend.memory.cherishedEntries.filter(e => isMemoryEntryTriggered(e, recentText));
            if (triggered.length > 0) {
                cherishedXml = `<cherished_memories>\n${triggered.map(e => `<memory>\n<title>${e.title || ''}</title>\n<content>${e.content || ''}</content>\n<detail>${e.detail || ''}</detail>\n<reason>${e.reason || ''}</reason>\n<time>${e.createdAt || ''}</time>\n</memory>`).join('\n')}\n</cherished_memories>`;
            }
        } else if (normalizedFriend.memory?.cherished) {
            cherishedXml = `<cherished_memories>\n${normalizedFriend.memory.cherished}\n</cherished_memories>`;
        }

        const linkedFriendMemory = window.imApp.buildLinkedAccountMemoryContext
            ? window.imApp.buildLinkedAccountMemoryContext(normalizedFriend)
            : '';

        return [
            normalizedFriend.memory?.overview ? `<core_memory_overview>\n${normalizedFriend.memory.overview}\n</core_memory_overview>` : '',
            longTermXml,
            normalizedFriend.memory?.context?.notes ? `<extra_context_notes>\n${normalizedFriend.memory.context.notes}\n</extra_context_notes>` : '',
            shortTermEntries ? `<short_term_memories>\n${shortTermEntries}\n</short_term_memories>` : '',
            cherishedXml,
            linkedFriendMemory
        ].filter(Boolean).join('\n\n');
    }

    function buildLinkedAccountPrompt(friend, currentUserState) {
        const normalizedFriend = window.imApp.normalizeFriendData(friend || {});
        const recentText = getRecentContextText(normalizedFriend);
        const worldBookContextText = [recentText, normalizedFriend.memory?.overview || ''].filter(Boolean).join('\n');
        const systemDepthWorldBookContext = window.imApp?.getWorldBookContextForFriendByPosition
            ? window.imApp.getWorldBookContextForFriendByPosition('system_depth', normalizedFriend, worldBookContextText)
            : (window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('system_depth') : '');
        const beforeRoleWorldBookContext = window.imApp?.getWorldBookContextForFriendByPosition
            ? window.imApp.getWorldBookContextForFriendByPosition('before_role', normalizedFriend, worldBookContextText)
            : (window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('before_role') : '');
        const afterRoleWorldBookContext = window.imApp?.getWorldBookContextForFriendByPosition
            ? window.imApp.getWorldBookContextForFriendByPosition('after_role', normalizedFriend, worldBookContextText)
            : (window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('after_role') : '');
        const relationshipText = normalizedFriend.memory?.relationships && normalizedFriend.memory.relationships.length > 0
            ? normalizedFriend.memory.relationships.map(rel => {
                const npc = (window.imData.friends || []).find(item => String(item.id) === String(rel.npcId));
                return `${npc ? (npc.nickname || npc.realName || 'Unknown NPC') : 'Unknown NPC'}: ${rel.relation || ''}`;
            }).join('\n')
            : 'None';
        const currentChatContext = window.imApp.buildApiContextMessages
            ? window.imApp.buildApiContextMessages(normalizedFriend, { userName: currentUserState.name || 'User' })
            : [];
        const existingLinkedChats = Array.isArray(normalizedFriend.linkedAccountChats)
            ? normalizedFriend.linkedAccountChats.map(chat => ({
                id: chat.id,
                name: chat.name,
                realName: chat.realName,
                remark: chat.remark,
                persona: chat.persona,
                relationship: chat.relationship,
                sourceNpcId: chat.sourceNpcId,
                recentMessages: Array.isArray(chat.messages)
                    ? chat.messages.slice(-4).map(msg => `${msg.role === 'char' ? normalizedFriend.nickname : (chat.remark || chat.name || chat.realName || 'Linked Friend')}: ${msg.text}`)
                    : []
            }))
            : [];
        const relationshipCandidates = buildLinkedRelationshipCandidates(normalizedFriend);
        const usedSourceNpcIds = new Set(existingLinkedChats.map(chat => String(chat.sourceNpcId || '')).filter(Boolean));
        const availableRelationshipCandidates = relationshipCandidates.filter(candidate => !usedSourceNpcIds.has(String(candidate.sourceNpcId)));
        const linkedPromptMemorySections = buildLinkedPromptMemorySections(normalizedFriend);

        return `You generate private linked friend chats for a fictional iMessage roleplay character.

World Book - System Depth:
${systemDepthWorldBookContext || 'None'}

World Book - Before Role:
${beforeRoleWorldBookContext || 'None'}

Character:
Name: ${normalizedFriend.realName || normalizedFriend.nickname}
Nickname: ${normalizedFriend.nickname}
Persona: ${normalizedFriend.persona || 'None'}

User:
Name: ${currentUserState.name || 'User'}
Persona: ${currentUserState.persona || 'None'}

Relationship Network:
${relationshipText}

Relationship Network Candidates For New Linked Friend Chats:
${availableRelationshipCandidates.length > 0 ? JSON.stringify(availableRelationshipCandidates, null, 2) : 'None'}

Character Memory And Linked Friend Memory:
${linkedPromptMemorySections || 'None'}

Current Window Chat Context:
${JSON.stringify(currentChatContext, null, 2)}

Existing Linked Friend Chats:
${JSON.stringify(existingLinkedChats, null, 2)}

World Book - After Role:
${afterRoleWorldBookContext || 'None'}

Task:
1. Simulate friends/acquaintances of the character messaging the character in separate private linked friend chats.
2. If Relationship Network Candidates are available, prioritize using 0 to 2 unused candidates as new linked friend chats before inventing unrelated people.
3. Generate 0 to 2 new linked friend chats. Each new person must be unique and must not duplicate any existing name, realName, remark, or sourceNpcId.
4. Each new linked friend chat must include realName, remark (the character's saved name/note for this person), relationship, and 2 to 5 incoming messages from that friend to the character.
5. If existing linked friend chats exist, choose zero or more existing chats and write the character's reply to the other person, 2 to 5 messages per selected chat.
6. For any existing chat that receives a character reply in this same JSON result, you may also write the friend's follow-up reply to the character, 2 to 5 messages. The friend's follow-up must directly respond to the character's new reply, not start an unrelated topic. This is optional; use an empty array if no follow-up is natural.
7. Append order for the same existing chat is always existingThreadReplies first, then friendFollowups.
8. Stay consistent with the world book, mounted world book, character persona, relationship network, and current iMessage context.
9. International translation rule: each message item must be an object {"text":"original message","translation":"natural Chinese translation or empty string"}. If text is not Chinese, translation must contain natural Chinese. If text is Chinese, translation must be an empty string.

Output only valid JSON with this exact shape:
{
  "newThreads": [
    {
      "name": "display name, usually the remark if one exists",
      "realName": "person's true name",
      "remark": "the character's saved remark/note/name for this person",
      "persona": "short identity/personality",
      "relationship": "relationship to the character",
      "sourceNpcId": "relationship candidate sourceNpcId if used, otherwise empty string",
      "messages": [{"text":"incoming original message","translation":"Chinese translation or empty string"}]
    }
  ],
  "existingThreadReplies": [
    {
      "threadId": "existing linked chat id",
      "messages": [{"text":"character reply original message","translation":"Chinese translation or empty string"}]
    }
  ],
  "friendFollowups": [
    {
      "threadId": "same existing linked chat id that received a character reply",
      "messages": [{"text":"friend follow-up original message","translation":"Chinese translation or empty string"}]
    }
  ]
}`;
    }

    async function runLinkedAccountBotNow(friendOrId, options = {}) {
        const friendId = getFriendKey(friendOrId);
        if (!friendId) return { success: false, changedCount: 0 };
        if (linkedAccountBotInFlight.has(friendId)) return { success: false, changedCount: 0, inFlight: true };

        const liveFriend = getLiveFriendById(friendId) || (typeof friendOrId === 'object' ? friendOrId : null);
        if (!liveFriend || liveFriend.type === 'group' || liveFriend.type === 'official') {
            return { success: false, changedCount: 0 };
        }

        const currentApiConfig = window.getApiConfig ? window.getApiConfig() : (window.apiConfig || {});
        const currentUserState = window.getUserState ? window.getUserState() : (window.userState || {});
        if (!currentApiConfig.endpoint || !currentApiConfig.apiKey) {
            if (!options.silent && window.showToast) window.showToast('请先配置 API');
            return { success: false, changedCount: 0 };
        }

        linkedAccountBotInFlight.add(friendId);
        try {
            if (window.imApp.ensureFriendMessagesLoaded) {
                await window.imApp.ensureFriendMessagesLoaded(liveFriend);
            }

            const endpoint = resolveChatCompletionsEndpoint(currentApiConfig);
            const prompt = buildLinkedAccountPrompt(liveFriend, currentUserState);
            const response = await fetchChatCompletionWithTimeout(endpoint, currentApiConfig, [
                { role: 'system', content: 'You are a strict JSON generator for fictional linked friend chats. Output only valid JSON.' },
                { role: 'user', content: prompt }
            ], 45000);

            if (!response.ok) {
                let errorMsg = `${response.status} ${response.statusText}`;
                try {
                    errorMsg = JSON.stringify(await response.json());
                } catch (_) {}
                throw new Error(errorMsg);
            }

            const data = await response.json();
            const parsed = parseJsonObjectFromText(getAiResponseContent(data));
            if (!parsed) return { success: false, changedCount: 0 };

            let changedCount = 0;
            const saved = await window.imApp.commitFriendChange(friendId, (targetFriend) => {
                if (!targetFriend) return;
                targetFriend.linkedAccountBot = window.imApp.normalizeLinkedAccountBot(targetFriend.linkedAccountBot);
                targetFriend.linkedAccountBot.lastRunAt = Date.now();
                targetFriend.linkedAccountChats = window.imApp.normalizeLinkedAccountChats(targetFriend.linkedAccountChats);

                const chats = targetFriend.linkedAccountChats;
                const existingKeys = new Set(chats.flatMap(chat => [
                    getLinkedIdentityKey(chat.name),
                    getLinkedIdentityKey(chat.realName),
                    getLinkedIdentityKey(chat.remark)
                ]).filter(Boolean));
                const existingNames = new Set(chats.flatMap(chat => [
                    String(chat.name || '').trim().toLowerCase(),
                    String(chat.realName || '').trim().toLowerCase(),
                    String(chat.remark || '').trim().toLowerCase()
                ]).filter(Boolean));
                const existingSourceNpcIds = new Set(chats.map(chat => String(chat.sourceNpcId || '').trim()).filter(Boolean));
                const newThreads = Array.isArray(parsed.newThreads) ? parsed.newThreads.slice(0, 2) : [];
                const findExistingLinkedChat = (item) => {
                    if (!item || typeof item !== 'object') return null;
                    const threadId = String(item.threadId || item.id || '').trim();
                    const threadName = String(item.name || '').trim();
                    const threadRealName = String(item.realName || '').trim();
                    const threadRemark = String(item.remark || '').trim();
                    const threadSourceNpcId = item.sourceNpcId != null ? String(item.sourceNpcId).trim() : '';
                    return chats.find(chat => {
                        if (threadId && String(chat.id) === threadId) return true;
                        if (threadSourceNpcId && String(chat.sourceNpcId || '') === threadSourceNpcId) return true;
                        if (threadRealName && String(chat.realName || '').toLowerCase() === threadRealName.toLowerCase()) return true;
                        if (threadRemark && String(chat.remark || '').toLowerCase() === threadRemark.toLowerCase()) return true;
                        return threadName && String(chat.name).toLowerCase() === threadName.toLowerCase();
                    }) || null;
                };
                const appendLinkedMessages = (targetChat, messages) => {
                    if (!targetChat || !Array.isArray(messages) || messages.length === 0) return 0;
                    const existingMessages = Array.isArray(targetChat.messages) ? targetChat.messages : [];
                    const lastTimestamp = existingMessages.length > 0
                        ? Number(existingMessages[existingMessages.length - 1]?.timestamp) || 0
                        : 0;
                    const baseTimestamp = Math.max(lastTimestamp, Date.now());
                    messages.forEach((message, index) => {
                        const currentTimestamp = Number(message.timestamp) || 0;
                        message.timestamp = Math.max(currentTimestamp, baseTimestamp + index + 1);
                    });
                    targetChat.messages = existingMessages;
                    targetChat.messages.push(...messages);
                    targetChat.updatedAt = messages[messages.length - 1].timestamp || Date.now();
                    return messages.length;
                };

                newThreads.forEach((thread, threadIndex) => {
                    if (!thread || typeof thread !== 'object') return;
                    const realName = String(thread.realName || '').trim();
                    const remark = String(thread.remark || '').trim();
                    const name = String(thread.name || remark || realName).trim();
                    const sourceNpcId = thread.sourceNpcId != null ? String(thread.sourceNpcId).trim() : '';
                    const key = getLinkedIdentityKey(name);
                    const realNameKey = getLinkedIdentityKey(realName);
                    const remarkKey = getLinkedIdentityKey(remark);
                    const nameKey = name.toLowerCase();
                    const realNameLower = realName.toLowerCase();
                    const remarkLower = remark.toLowerCase();
                    if (
                        !name ||
                        !key ||
                        existingKeys.has(key) ||
                        (realNameKey && existingKeys.has(realNameKey)) ||
                        (remarkKey && existingKeys.has(remarkKey)) ||
                        existingNames.has(nameKey) ||
                        (realNameLower && existingNames.has(realNameLower)) ||
                        (remarkLower && existingNames.has(remarkLower)) ||
                        (sourceNpcId && existingSourceNpcIds.has(sourceNpcId))
                    ) return;

                    const messages = normalizeLinkedMessageList(thread.messages, 'account');
                    if (messages.length === 0) return;

                    const now = Date.now() + threadIndex;
                    chats.unshift({
                        id: createApiRunId('linked-chat'),
                        name,
                        realName,
                        remark,
                        persona: String(thread.persona || '').trim(),
                        relationship: String(thread.relationship || '').trim(),
                        avatarSeed: String(thread.avatarSeed || remark || realName || name).trim(),
                        sourceNpcId,
                        messages,
                        createdAt: now,
                        updatedAt: messages[messages.length - 1].timestamp || now
                    });
                    existingKeys.add(key);
                    if (realNameKey) existingKeys.add(realNameKey);
                    if (remarkKey) existingKeys.add(remarkKey);
                    existingNames.add(nameKey);
                    if (realNameLower) existingNames.add(realNameLower);
                    if (remarkLower) existingNames.add(remarkLower);
                    if (sourceNpcId) existingSourceNpcIds.add(sourceNpcId);
                    changedCount += messages.length;
                });

                const existingThreadReplies = Array.isArray(parsed.existingThreadReplies) ? parsed.existingThreadReplies : [];
                const repliedThreadIds = new Set();
                existingThreadReplies.forEach(reply => {
                    if (!reply || typeof reply !== 'object') return;
                    const targetChat = findExistingLinkedChat(reply);
                    if (!targetChat) return;

                    const messages = normalizeLinkedMessageList(reply.messages, 'char');
                    if (messages.length === 0) return;
                    const appendedCount = appendLinkedMessages(targetChat, messages);
                    if (appendedCount > 0) {
                        repliedThreadIds.add(String(targetChat.id));
                        changedCount += appendedCount;
                    }
                });

                const friendFollowups = Array.isArray(parsed.friendFollowups) ? parsed.friendFollowups : [];
                friendFollowups.forEach(followup => {
                    if (!followup || typeof followup !== 'object') return;
                    const targetChat = findExistingLinkedChat(followup);
                    if (!targetChat) return;
                    if (!repliedThreadIds.has(String(targetChat.id))) return;

                    const messages = normalizeLinkedMessageList(followup.messages, 'account');
                    if (messages.length === 0) return;
                    changedCount += appendLinkedMessages(targetChat, messages);
                });
            }, { silent: true, metaOnly: true });

            if (!saved) return { success: false, changedCount: 0 };

            window.dispatchEvent(new CustomEvent('u2:linked-accounts-changed', {
                detail: { friendId, changedCount }
            }));

            if (changedCount > 0 && !options.silent && window.showToast) {
                window.showToast(`关联好友已更新（${changedCount}）`);
            }

            return { success: true, changedCount };
        } catch (error) {
            console.error('[Linked Friends] API request failed', error);
            if (!options.silent && window.showToast) {
                window.showToast(`关联好友 API 失败${error?.message ? `：${error.message}` : ''}`);
            }
            return { success: false, changedCount: 0, error };
        } finally {
            linkedAccountBotInFlight.delete(friendId);
        }
    }

    async function scheduleAutonomousTaskNextRun(friendId, taskName, task, now = Date.now()) {
        if (!window.imApp?.commitScopedFriendChange) return false;
        return window.imApp.commitScopedFriendChange(friendId, (targetFriend) => {
            targetFriend.memory = window.imApp.normalizeFriendData(targetFriend).memory;
            const activity = normalizeAutonomousActivity(targetFriend.memory.autonomous);
            const nextTask = normalizeAutonomousTask(activity[taskName] || task);
            nextTask.nextRunAt = now + getRandomAutonomousDelay(nextTask);
            activity[taskName] = nextTask;
            targetFriend.memory.autonomous = activity;
        }, { silent: true, immediate: true, metaOnly: true, syncActive: true, syncSettings: true });
    }

    function buildAutonomousMomentPrompt(friend, now = Date.now()) {
        const charName = friend?.realName || friend?.nickname || 'TA';
        const userName = (window.getUserState ? window.getUserState() : window.userState || {})?.name || 'User';
        const relationshipText = Array.isArray(friend?.memory?.relationships) && friend.memory.relationships.length > 0
            ? friend.memory.relationships.map(rel => {
                const npc = (window.imData?.friends || []).find(item => String(item.id) === String(rel.npcId));
                return `${npc ? npc.nickname : 'Unknown'}: ${rel.relation || ''}`;
            }).join('\n')
            : 'None';
        const latestMessages = Array.isArray(friend?.messages)
            ? friend.messages.slice(-8).map(msg => {
                const speaker = msg.role === 'assistant' ? charName : userName;
                return `[${formatAutonomousPromptTime(msg.timestamp)}] ${speaker}: ${getAutonomousMessageText(msg)}`;
            }).join('\n')
            : '';

        return `你正在扮演 ${charName}，现在要为这个角色生成 1 条公开朋友圈文案。
当前真实时间：${formatAutonomousPromptTime(now)}
User 名称：${userName}
角色人设：${friend?.persona || 'None'}
角色签名：${friend?.signature || 'None'}
关系和记忆：
${friend?.memory?.overview || 'None'}

关系网络：
${relationshipText}

最近聊天上下文：
${latestMessages || 'None'}

要求：
1. 这是公开朋友圈，不是私聊，不是只给 User 看的话。
2. 可以分享当下感悟、正在做的事、环境观察或生活片段。
3. 不要写成碎碎念、连续私密独白、求回复、催 User、或过度暧昧告白。
4. 只有在上下文或关系记忆中有明确恋爱/情侣/公开伴侣证据时，才可以把 User 写成公开恋人；否则如果提到 User，只能用小名、外号、某人、朋友等含蓄称呼。
5. 不生成图片，不要输出 hashtag 堆砌，不要输出 markdown。
6. 只输出合法 JSON：{"text":"朋友圈正文"}。`;
    }

    async function generateAutonomousMomentText(friend, apiConfig, now = Date.now()) {
        const endpoint = resolveChatCompletionsEndpoint(apiConfig);
        if (!endpoint) return '';
        const response = await fetchChatCompletionWithTimeout(endpoint, apiConfig, [
            {
                role: 'system',
                content: 'You generate one public social feed post for a fictional character. Output only valid JSON.'
            },
            {
                role: 'user',
                content: buildAutonomousMomentPrompt(friend, now)
            }
        ], 60000);

        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const parsed = parseJsonObjectFromText(getAiResponseContent(data));
        return typeof parsed?.text === 'string' ? parsed.text.trim() : '';
    }

    async function runAutonomousActivityForFriend(friendOrId, reason = 'timer') {
        const friendKey = getFriendKey(friendOrId);
        if (!friendKey || autonomousActivityInFlight.has(friendKey) || aiReplyInFlight.has(friendKey)) return false;

        let friend = getLiveFriendById(friendKey) || (friendOrId && typeof friendOrId === 'object' ? friendOrId : null);
        if (!friend || friend.type === 'official' || friend.type === 'group') return false;

        if (window.imApp?.ensureFriendMessagesLoaded) {
            await window.imApp.ensureFriendMessagesLoaded(friend);
            friend = getLiveFriendById(friendKey) || friend;
        }

        friend.memory = window.imApp.normalizeFriendData(friend).memory;
        const replyTask = getAutonomousTask(friend.memory.autonomous, 'reply');
        if (!replyTask.enabled) return false;

        const currentApiConfig = window.getApiConfig ? window.getApiConfig() : (window.apiConfig || {});
        if (!currentApiConfig.endpoint || !currentApiConfig.apiKey) {
            await scheduleAutonomousTaskNextRun(friendKey, 'reply', replyTask, Date.now());
            return false;
        }

        autonomousActivityInFlight.add(friendKey);
        const now = Date.now();
        try {
            await window.imApp.commitScopedFriendChange(friendKey, (targetFriend) => {
                targetFriend.memory = window.imApp.normalizeFriendData(targetFriend).memory;
                const activity = normalizeAutonomousActivity(targetFriend.memory.autonomous);
                const nextReplyTask = normalizeAutonomousTask(activity.reply);
                nextReplyTask.lastRunAt = now;
                nextReplyTask.nextRunAt = now + getRandomAutonomousDelay(nextReplyTask);
                activity.reply = nextReplyTask;
                targetFriend.memory.autonomous = activity;
            }, { silent: true, immediate: true, metaOnly: true, syncActive: true, syncSettings: true });

            const latestFriend = getLiveFriendById(friendKey) || friend;
            const page = document.getElementById(`chat-interface-${friendKey}`);
            const activeContainer = page ? page.querySelector('.ins-chat-messages') : null;
            await handleAiReply(latestFriend, activeContainer, null, {
                source: 'autonomous',
                silent: true,
                extraSystemPrompt: buildAutonomousActivityPrompt(latestFriend, now)
            });
            return true;
        } catch (error) {
            console.error('[iMessage autonomous activity] failed', { friendId: friendKey, reason, error });
            return false;
        } finally {
            autonomousActivityInFlight.delete(friendKey);
        }
    }

    function buildContinueWithoutUserPrompt(friend, options = {}) {
        const isGroupAfterUserLeft = !!options.isGroupAfterUserLeft;
        const charName = friend.nickname || friend.realName || 'Char';
        if (isGroupAfterUserLeft) {
            return '【本轮触发：User 没有回复】User 已退出或没有发送新消息。请让群成员基于最近群聊上下文继续自然说话，不要等待 User，不要让 User 发言，不要输出空内容；仍必须输出合法 <chat_json> JSON 数组。';
        }

        if (friend.type === 'group') {
            return '【本轮触发：User 没有回复】User 没有发送新消息。请让群成员基于最近群聊上下文继续自然说话，可以承接上一句、回应沉默、成员互相接话或开启符合关系的新话题；不要等待 User，不要输出空内容；仍必须输出合法 <chat_json> JSON 数组。';
        }

        return `【本轮触发：User 没有回复】User 没有发送新消息。请以 ${charName} 的身份主动继续说话，可以承接上一轮、补充没说完的话、分享身边状态、回应沉默或自然开启新话题；不要说“用户没有输入”，不要等待 User，不要输出空内容；仍必须输出合法 <chat_json> JSON 数组。`;
    }

    async function runAutonomousMomentForFriend(friendOrId, reason = 'timer') {
        const friendKey = getFriendKey(friendOrId);
        if (!friendKey || autonomousMomentInFlight.has(friendKey)) return false;

        let friend = getLiveFriendById(friendKey) || (friendOrId && typeof friendOrId === 'object' ? friendOrId : null);
        if (!friend || friend.type === 'official' || friend.type === 'group') return false;

        if (window.imApp?.ensureFriendMessagesLoaded) {
            await window.imApp.ensureFriendMessagesLoaded(friend);
            friend = getLiveFriendById(friendKey) || friend;
        }
        if (window.imApp?.ensureMomentsReady) {
            await window.imApp.ensureMomentsReady();
        }

        friend.memory = window.imApp.normalizeFriendData(friend).memory;
        const momentTask = getAutonomousTask(friend.memory.autonomous, 'moment');
        if (!momentTask.enabled) return false;

        const currentApiConfig = window.getApiConfig ? window.getApiConfig() : (window.apiConfig || {});
        if (!currentApiConfig.endpoint || !currentApiConfig.apiKey) {
            await scheduleAutonomousTaskNextRun(friendKey, 'moment', momentTask, Date.now());
            return false;
        }

        autonomousMomentInFlight.add(friendKey);
        const now = Date.now();
        try {
            await window.imApp.commitScopedFriendChange(friendKey, (targetFriend) => {
                targetFriend.memory = window.imApp.normalizeFriendData(targetFriend).memory;
                const activity = normalizeAutonomousActivity(targetFriend.memory.autonomous);
                const nextMomentTask = normalizeAutonomousTask(activity.moment);
                nextMomentTask.lastRunAt = now;
                nextMomentTask.nextRunAt = now + getRandomAutonomousDelay(nextMomentTask);
                activity.moment = nextMomentTask;
                targetFriend.memory.autonomous = activity;
            }, { silent: true, immediate: true, metaOnly: true, syncActive: true, syncSettings: true });

            const latestFriend = getLiveFriendById(friendKey) || friend;
            const text = await generateAutonomousMomentText(latestFriend, currentApiConfig, now);
            if (!text) return false;

            const newMoment = {
                id: Date.now(),
                userId: latestFriend.id,
                name: latestFriend.nickname || latestFriend.realName || 'Friend',
                avatar: latestFriend.avatarUrl || null,
                text,
                images: [],
                time: Date.now(),
                likes: [],
                comments: [],
                isPinned: false
            };

            const saved = window.imApp.commitMomentChange
                ? await window.imApp.commitMomentChange(newMoment.id, () => {
                    if (!Array.isArray(window.imData.moments)) window.imData.moments = [];
                    window.imData.moments.unshift(newMoment);
                }, { silent: true, immediate: true })
                : false;

            if (!saved) return false;
            if (window.imApp.renderMoments) window.imApp.renderMoments();
            if (window.showBannerNotification) {
                window.showBannerNotification(latestFriend, '发布了一条朋友圈');
            }
            return true;
        } catch (error) {
            console.error('[iMessage autonomous moment] failed', { friendId: friendKey, reason, error });
            return false;
        } finally {
            autonomousMomentInFlight.delete(friendKey);
        }
    }

    async function checkAutonomousActivities(reason = 'timer') {
        const friends = Array.isArray(window.imData?.friends) ? window.imData.friends : [];
        const now = Date.now();
        for (const friend of friends) {
            if (!friend || friend.type === 'official' || friend.type === 'group') continue;
            const normalizedFriend = window.imApp.normalizeFriendData(friend);
            const activity = normalizeAutonomousActivity(normalizedFriend.memory?.autonomous);
            const replyTask = normalizeAutonomousTask(activity.reply);
            const momentTask = normalizeAutonomousTask(activity.moment);

            if (replyTask.enabled) {
                if (!replyTask.nextRunAt || replyTask.nextRunAt <= 0) {
                    await scheduleAutonomousTaskNextRun(normalizedFriend.id, 'reply', replyTask, now);
                } else if (replyTask.nextRunAt <= now) {
                    await runAutonomousActivityForFriend(normalizedFriend, reason);
                }
            }

            if (momentTask.enabled) {
                if (!momentTask.nextRunAt || momentTask.nextRunAt <= 0) {
                    await scheduleAutonomousTaskNextRun(normalizedFriend.id, 'moment', momentTask, now);
                } else if (momentTask.nextRunAt <= now) {
                    await runAutonomousMomentForFriend(normalizedFriend, reason);
                }
            }
        }
    }

    function refreshAutonomousActivityTimers() {
        void checkAutonomousActivities('refresh');
    }

    async function handleAiReply(friend, container, btnEl, options = {}) {
        console.log('handleAiReply invoked', { friend, btnEl, source: options.source || 'manual' });
        const friendKey = getFriendKey(friend);
        if (aiReplyInFlight.has(friendKey)) {
            if (!options.silent && window.showToast) window.showToast('正在生成中');
            return;
        }

        const currentApiConfig = window.getApiConfig ? window.getApiConfig() : (window.apiConfig || {});
        const currentUserState = window.getUserState ? window.getUserState() : (window.userState || {});
        
        if (!currentApiConfig.endpoint || !currentApiConfig.apiKey) {
            console.warn('API config is missing!', currentApiConfig);
            if(!options.silent && window.showToast) window.showToast('请先在设置中配置 API');
            return;
        }

        let typingRow = null;
        const apiRunId = createApiRunId(friendKey);
        const conversationEpoch = getConversationEpoch(friendKey);
        const requestController = new AbortController();
        const isConversationCurrent = () => getConversationEpoch(friendKey) === conversationEpoch && !requestController.signal.aborted;
        aiReplyInFlight.add(friendKey);
        aiReplyControllers.set(friendKey, requestController);

        try {
            if (window.imApp?.ensureStickersReady) {
                await window.imApp.ensureStickersReady();
            }
            if (!isConversationCurrent()) return;
            friend = getLiveFriendById(friend.id) || friend;

            if (container) {
                typingRow = document.createElement('div');
                typingRow.className = 'chat-row ai-row typing-row';
                typingRow.innerHTML = `
                    <div class="typing-indicator">
                        <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
                    </div>
                `;
                container.appendChild(typingRow);
                window.imChat.scrollToBottom(container);
            }

            if(btnEl) btnEl.style.opacity = '0.5';

            friend.memory = window.imApp.normalizeFriendData(friend).memory;

        const isSleeping = window.imApp.isCharacterSleeping(friend);
        const recentText = getRecentContextText(friend);

        function formatDetailedTime(timestamp) {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            const dayOfWeek = days[date.getDay()];
            const hour = date.getHours();
            const minute = date.getMinutes().toString().padStart(2, '0');
            const second = date.getSeconds().toString().padStart(2, '0');
            
            let period = '';
            if (hour >= 0 && hour < 6) period = '凌晨';
            else if (hour >= 6 && hour < 9) period = '早上';
            else if (hour >= 9 && hour < 12) period = '上午';
            else if (hour === 12) period = '中午';
            else if (hour > 12 && hour < 18) period = '下午';
            else if (hour >= 18 && hour <= 23) period = '晚上';

            let displayHour = hour % 12;
            if (displayHour === 0) displayHour = 12;
            return `[时间：${year}年${month}月${day}日 ${dayOfWeek} ${period}${displayHour}:${minute}:${second}] `;
        }

        function formatPromptTime(timestamp) {
            const value = Number(timestamp);
            if (!Number.isFinite(value) || value <= 0) return '未知';
            const date = new Date(value);
            return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        }

        function formatPromptDuration(durationMs) {
            const value = Number(durationMs);
            if (!Number.isFinite(value) || value < 0) return '未知';
            const totalMinutes = Math.floor(value / 60000);
            if (totalMinutes < 1) return '不到1分钟';
            if (totalMinutes < 60) return `${totalMinutes}分钟`;
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            if (hours < 24) return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
            const days = Math.floor(hours / 24);
            const restHours = hours % 24;
            return restHours > 0 ? `${days}天${restHours}小时` : `${days}天`;
        }

        function getGroupMessageSpeakerName(message, groupMembers) {
            const memberId = message?.speakerMemberId || message?.senderMemberId || '';
            if (memberId) {
                const member = groupMembers.find(item => String(item.id) === String(memberId));
                if (member) return member.nickname || member.realName || '群成员';
            }
            return message?.speaker || message?.senderName || '群成员';
        }

        function buildGroupTimeRequirement(group, groupMembers) {
            if (!group || group.timeAware === false) return '';

            const currentTime = new Date();
            const timeString = `${currentTime.getFullYear()}年${currentTime.getMonth() + 1}月${currentTime.getDate()}日 ${currentTime.getHours()}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
            const historyMessages = Array.isArray(group.messages)
                ? group.messages.filter(msg => msg && Number(msg.timestamp) > 0)
                : [];
            const lastUserMessage = historyMessages.slice().reverse().find(msg => msg.role === 'user') || null;
            const lastMemberMessage = historyMessages.slice().reverse().find(msg => msg.role === 'assistant') || null;
            const lastPublicMessage = historyMessages.slice().reverse().find(msg => msg.role === 'user' || msg.role === 'assistant') || null;
            const lastSpeakerName = lastMemberMessage ? getGroupMessageSpeakerName(lastMemberMessage, groupMembers) : '未知';
            const gapSinceLastPublic = lastPublicMessage
                ? currentTime.getTime() - Number(lastPublicMessage.timestamp)
                : null;
            const gapSinceUser = lastUserMessage
                ? currentTime.getTime() - Number(lastUserMessage.timestamp)
                : null;
            const gapSinceMember = lastMemberMessage
                ? currentTime.getTime() - Number(lastMemberMessage.timestamp)
                : null;

            return `\n\n【群聊时间感知】：
- 当前系统时间是：${timeString}。
- User 最后一次发言时间：${lastUserMessage ? formatPromptTime(lastUserMessage.timestamp) : '未知'}${lastUserMessage ? `（距离现在约 ${formatPromptDuration(gapSinceUser)}）` : ''}。
- 群成员最近一次公开发言：${lastMemberMessage ? `${lastSpeakerName} 于 ${formatPromptTime(lastMemberMessage.timestamp)}` : '未知'}${lastMemberMessage ? `（距离现在约 ${formatPromptDuration(gapSinceMember)}）` : ''}。
- 群聊最后一条公开消息距离现在：${lastPublicMessage ? `约 ${formatPromptDuration(gapSinceLastPublic)}` : '未知'}。
- 回复前所有发言成员都必须感知现在的具体日期、时间段、距离上次群聊过去多久，以及这段间隔对情绪、动作、称呼和话题承接的影响；但如果间隔很短，不要刻意提时间，只把它作为背景。`;
        }

        const relationshipText = friend.memory.relationships && friend.memory.relationships.length > 0
            ? friend.memory.relationships.map(rel => {
                const npc = window.imData.friends.find(item => String(item.id) === String(rel.npcId));
                return `${npc ? npc.nickname : 'Unknown NPC'}: ${rel.relation}`;
            }).join('\n')
            : 'None';

        function parseShortTermMemoryDate(value) {
            if (!value) return 0;
            if (typeof value === 'number') return value;
            const normalized = String(value)
                .replace(/年/g, '-')
                .replace(/月/g, '-')
                .replace(/日/g, ' ')
                .replace(/\./g, '-')
                .replace(/\//g, '-');
            const parsed = new Date(normalized);
            return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
        }

        function normalizeShortTermMemoryDegree(value) {
            const text = String(value || '高').trim();
            if (text === '中' || text === '低' || text === '遗忘') return text;
            return '高';
        }

        function formatShortTermMemoryEntry(entry) {
            return [
                `<short_term_memory>`,
                `  <id>${entry.id || ''}</id>`,
                `  <title>${entry.title || '对话总结'}</title>`,
                `  <time>${entry.time || ''}</time>`,
                `  <event>${entry.event || ''}</event>`,
                `  <memory_points>${entry.memoryPoints || ''}</memory_points>`,
                `  <degree>${normalizeShortTermMemoryDegree(entry.degree)}</degree>`,
                `</short_term_memory>`
            ].join('\n');
        }

        function buildShortTermMemoryContext(friend) {
            const isGroupChat = friend.type === 'group';
            const entries = Array.isArray(friend.memory?.shortTermEntries)
                ? friend.memory.shortTermEntries.filter(entry => entry && (entry.event || entry.memoryPoints || entry.title))
                : [];
            
            const triggeredEntries = isGroupChat
                ? entries.slice(-12)
                : entries.filter(entry => isMemoryEntryTriggered(entry, recentText));
            if (triggeredEntries.length === 0) return '';

            const buckets = {
                高: [],
                中: [],
                低: [],
                遗忘: []
            };

            triggeredEntries.forEach(entry => {
                const degree = normalizeShortTermMemoryDegree(entry.degree);
                buckets[degree].push(entry);
            });

            Object.keys(buckets).forEach(degree => {
                buckets[degree].sort((a, b) => {
                    const bTime = parseShortTermMemoryDate(b.lastActivatedAt || b.time || b.createdAt);
                    const aTime = parseShortTermMemoryDate(a.lastActivatedAt || a.time || a.createdAt);
                    return bTime - aTime;
                });
            });

            const sections = [
                ['高权重记忆 | 参考强度 70%', buckets.高],
                ['中权重记忆 | 参考强度 25%', buckets.中],
                ['低权重记忆 | 参考强度 5%', buckets.低],
                ['遗忘记忆 | 仅作为模糊残影', buckets.遗忘]
            ]
                .filter(([, items]) => items.length > 0)
                .map(([title, items]) => `${title}\n${items.map(formatShortTermMemoryEntry).join('\n')}`)
                .join('\n\n');

            if (isGroupChat) {
                return `<group_public_summary_library>\n<rules>\n- 以下是当前群聊公开聊天的第三人称总结，只能作为群聊共同背景使用。\n- 这些总结不包含群成员给 User 的私信，也不包含群成员与自己好友的私信；不要据此让其他成员全知任何私聊内容。\n- 高：强参考，优先影响群内话题连续性、公开关系变化和共同事件。\n- 中/低：只在当前话题相关时辅助参考。\n- 遗忘：仅作为模糊残影，不主动提起。\n</rules>\n\n<memories>\n${sections}\n</memories>\n</group_public_summary_library>`;
            }

            return `<short_term_memory_library>\n<rules>\n- 高：强参考，优先影响情绪、态度、称呼和细节联想，占记忆影响约70%。\n- 中：辅助参考，只在话题相关时使用，占约25%。\n- 低：弱参考，只在用户明确触发时轻微使用，占约5%。\n- 遗忘：仅作为模糊残影，不主动提起，除非用户强烈触发。\n</rules>\n\n<memories>\n${sections}\n</memories>\n</short_term_memory_library>`;
        }

        // 提取日程信息
        let scheduleSection = '';
        let busyPrompt = '';
        if (friend.memory?.schedule) {
            const sch = friend.memory.schedule;
            let schLines = [];
            if (sch.sleepTime || sch.wakeTime) {
                schLines.push(`作息时间：${sch.wakeTime || '未知'} 起床，${sch.sleepTime || '未知'} 睡觉`);
            }
            if (Array.isArray(sch.events) && sch.events.length > 0) {
                schLines.push('近期行程安排：');
                
                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();

                sch.events.forEach(e => {
                    const startStr = e.startTime || e.time || '未知';
                    const endStr = e.endTime || '未知';
                    schLines.push(`- ${e.name} (${startStr} ~ ${endStr})`);
                    
                    if (e.startTime && e.endTime) {
                        const parseTime = (t) => {
                            const parts = t.split(':');
                            return parts.length === 2 ? parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) : -1;
                        };
                        const startMins = parseTime(e.startTime);
                        const endMins = parseTime(e.endTime);
                        
                        if (startMins !== -1 && endMins !== -1) {
                            if (startMins <= endMins) {
                                if (currentMinutes >= startMins && currentMinutes <= endMins) {
                                    busyPrompt = `\n【行程限制】：角色当前正在进行行程安排：“${e.name}”。如果用户发来消息，你必须强制在所有回复内容（text 字段）的开头添加 "[自动回复] " 前缀，模拟正在忙碌时的自动响应。心声和面板状态也要符合正在忙碌的情境。`;
                                }
                            } else {
                                if (currentMinutes >= startMins || currentMinutes <= endMins) {
                                    busyPrompt = `\n【行程限制】：角色当前正在进行行程安排：“${e.name}”。如果用户发来消息，你必须强制在所有回复内容（text 字段）的开头添加 "[自动回复] " 前缀，模拟正在忙碌时的自动响应。心声和面板状态也要符合正在忙碌的情境。`;
                                }
                            }
                        }
                    }
                });
            }
            if (schLines.length > 0) {
                scheduleSection = `Schedule / 行程作息:\n${schLines.join('\n')}`;
            }
        }

        let longTermXml = '';
        if (Array.isArray(friend.memory?.longTermEntries) && friend.memory.longTermEntries.length > 0) {
            const triggered = friend.memory.longTermEntries.filter(e => isMemoryEntryTriggered(e, recentText));
            if (triggered.length > 0) {
                longTermXml = `<long_term_memories>\n${triggered.map(e => `<memory>\n<title>${e.title || ''}</title>\n<content>${e.content || ''}</content>\n</memory>`).join('\n')}\n</long_term_memories>`;
            }
        } else if (friend.memory?.longTerm) {
            longTermXml = `<long_term_memories>\n${friend.memory.longTerm}\n</long_term_memories>`;
        }

        const commonMemorySections = [
            friend.memory.overview ? `<core_memory_overview>\n${friend.memory.overview}\n</core_memory_overview>` : '',
            longTermXml,
            friend.memory.context?.notes ? `<extra_context_notes>\n${friend.memory.context.notes}\n</extra_context_notes>` : '',
            buildShortTermMemoryContext(friend),
            scheduleSection,
            `<relationship_network>\n${relationshipText}\n</relationship_network>`,
            window.imApp.buildLinkedAccountMemoryContext
                ? window.imApp.buildLinkedAccountMemoryContext(friend)
                : '',
            (() => {
                const stickerText = buildMountedStickerContext(friend);
                if (!stickerText) return '';
                return `Available Stickers (only use these exact category/name pairs when outputting sticker JSON):\n${stickerText}`;
            })(),
            (() => {
                const panel = window.imChat.getProfilePanelData
                    ? window.imChat.getProfilePanelData(friend)
                    : (friend.profilePanel || null);
                if (!panel) return '';

                const eventSummary = Array.isArray(panel.events) && panel.events.length > 0
                    ? panel.events.slice(-3).map((eventItem, index) => {
                        const title = eventItem?.title || `事件${index + 1}`;
                        const description = eventItem?.description || '';
                        const time = eventItem?.time || '';
                        return `- ${title}${time ? ` (${time})` : ''}${description ? `: ${description}` : ''}`;
                    }).join('\n')
                    : 'None';

                const affection = typeof panel.affection === 'number' ? panel.affection : 0;

                return `Current Profile Panel Snapshot:\nOnline Status: ${isSleeping ? 'offline' : 'online'}\nLocation: ${panel.location || '未知位置'}\nAction: ${panel.action || '暂无动作'}\nMood: ${panel.mood || '平静'}\nExpression: ${panel.expression || '自然'}\nAffection(好感度): ${affection}\nThought: ${panel.thought || '暂无心声'}\nRecent Events:\n${eventSummary}`;
            })()
        ].filter(Boolean).join('\n\n');

        const lovesSpaceRequirement = friend.pendingLovesInvite ? `\n\n【情侣空间邀请事件】：User 刚刚向你发送了 Loves App 情侣空间的邀请卡片。你可以根据当前的好感度和角色性格，决定是否接受。\n如果选择接受，请在某一条对话文本(text字段)内任意位置包含 [ACCEPT_INVITE] 标记（该标记会被系统解析且不会展示给用户）。接受后，后续可能会触发空间内的互动。你也可以傲娇地不包含此标记，这代表你暂时忽略或拒绝了该邀请，那么一切照旧。` : '';
        const lovesActionRequirement = `\n\n【Loves情侣空间联动】：如果你现在和User已经开启了情侣空间（如果在聊与空间的日常，或你们之前已开启），你可以主动在Loves应用中发布动态或添加日程：\n- 如果你听到了明确的未来时间计划，觉得应该记下来，请额外输出一个 <loves_schedule>{"title":"活动标题(10字内)","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","description":"描述(选填)"}</loves_schedule> 标签。日期必须是未来的某天，参考当前系统时间。这将被同步记录到你的个人 iCloud 日程中。\n- 如果你今天心情特别好或有深刻的感悟想发在空间动态里（不需要艾特User），请额外输出一个 <loves_moment>{"content":"动态文字内容...","image":"可以为空"}</loves_moment> 标签。只有当你觉得真的想发动态时才输出。`;
        
        let hasFamilyCardStr = '未知';
        if (typeof window.hasFamilyCard === 'function') {
            hasFamilyCardStr = window.hasFamilyCard(friend.id) ? '是' : '否';
        }
        const familyCardRequirement = `\n\n【亲属卡互动】：当前你是否已经给过User亲属卡：${hasFamilyCardStr}。\n- 如果User在聊天中暗示或明示想要“亲属卡”，且你当前【未给过】亲属卡，你可以输出一个特定的支付对象：{"type":"payment","paymentAction":"family_card","amount":1000,"description":"亲属卡"}，这会给User发一张1000额度的亲属卡。\n- 如果你当前【已经给过】亲属卡，且User再次暗示或明示想要“亲属卡”，系统限制一人只能给一张，你不能再给一张，但你可以输出 {"type":"payment","paymentAction":"family_card_increase","amount":500,"description":"亲属卡提额"} 来给现有的亲属卡提升500额度，并在对话中提醒TA已经给过一张了只能提额。`;

        const pendingRegenerateContext = friend.pendingRegenerateContext || null;
        const regenerateUserRequirement = pendingRegenerateContext && typeof pendingRegenerateContext.userRequirement === 'string' && pendingRegenerateContext.userRequirement.trim()
            ? `\n\n【User 本次重回补充要求】：\n${pendingRegenerateContext.userRequirement.trim()}\n\n请优先参考这段要求理解 User 为什么重回、希望你换成怎样的回复方向；如果它和人设、上下文或输出格式冲突，以人设、上下文和输出格式为准，但仍尽量满足 User 的真实意图。`
            : '';
        const regenerateRequirement = pendingRegenerateContext
            ? `\n\n【重回重新生成要求】：
- User 触发了“重回”，这通常代表 User 对你刚刚生成的回复不满意。请先思考 User 可能不满意的原因：是否语气不对、关系距离不对、太敷衍、太热情、太重复、没有接住情绪、引用不准、偏离人设、没有回应重点或节奏不自然。
- 下面是刚刚被重回删除的回复内容，请不要再次生成相同或高度相似的内容、句式、称呼、情绪走向和动作安排。你需要换一个更贴合当前上下文与人设的角度回应，但不要在正文里解释“这是重回”。
【刚刚被重回的回复】：
${pendingRegenerateContext.previousReply || 'None'}${regenerateUserRequirement}` : '';


        const profilePanelRequirement = friend.type === 'group'
            ? ''
            : `\n\nProfile Panel Requirement:\n- 在正常聊天气泡之外，你必须额外输出 1 个 <profile_panel>...</profile_panel>\n- <profile_panel> 内必须是合法 JSON，不能有 markdown 代码块，不能有额外解释文字\n- JSON 必须包含字段：thought、location、action、mood、expression、affectionChange、events\n- 【中文强制】thought、location、action、mood、expression、events 以及 memoryPayload 内所有可见文本必须使用简体中文；禁止输出英文、日文、韩文、法文等非中文内容，不受默认语言设置影响\n- thought 必须是 45-60 字左右，严格基于当前聊天上下文，使用第一人称，像角色此刻没有说出口的心声，并且你必须在心声的最前面带上当前的具体时间（例如：[6月11日 凌晨2:14] 心声内容）\n- location 必须是 2-16 字，表示角色此刻所处的位置或场景\n- action 必须是 2-10 字，表示角色此刻正在做的动作或状态\n- mood 必须是 2-10 字，表示角色此刻的心情\n- expression 必须是 2-10 字，表示角色此刻的面部表情或神态\n- affectionChange 必须是整数（范围 -5 到 5），表示你对用户好感度因本轮对话产生的增减变化\n- 不要输出 online/offline 或类似在线状态文案，在线状态由系统统一控制并在界面显示为中文\n- events 必须是 JSON 数组；如果当前没有新的事件就输出 []；如果有事件，最多 3 条\n- 普通事件格式为 {"title":"事件标题","description":"事件描述","time":"时间或留空","type":"note"}\n- 珍视回忆必须由你（当前角色/char）自己发起：只有当你基于自己的感受，觉得刚刚这段聊天很在意、很珍贵、自己想以后记住时，才额外加入 1 条珍视回忆事件，type 必须为 "memory_request"\n- 不要把珍视回忆写成外部指令、替对方保存、接受要求或向对方请求许可；即使对方提到保存或记忆相关内容，也只在你自己也真心想珍藏时才输出\n- 珍视回忆事件格式为 {"title":"想珍藏这一刻","description":"一句简短说明","time":"时间或留空","type":"memory_request","requestText":"我想记住的具体事情","detail":"我为什么想记住或补充细节","confirmText":"收下","cancelText":"算了","memoryPayload":{"title":"珍视回忆标题","content":"我想记住的内容","detail":"更多细节","reason":"我想记住的原因","createdAt":"时间或留空","sourceThought":"可留空"}}\n- 只有当你真的觉得值得自己记住时才输出 memory_request，不能每次都输出\n- thought、location、action、mood、expression、events 必须和当前聊天内容连贯，不能复读，不能脱离角色人设`;

        const targetLanguage = friend.language || 'zh';
        let languageRequirement = '';
        if (targetLanguage !== 'zh') {
            const langMap = {
                'en': 'English',
                'ja': 'Japanese',
                'ko': 'Korean',
                'fr': 'French'
            };
            const langName = langMap[targetLanguage] || targetLanguage;
            languageRequirement = `\n\n【!!! CRITICAL LANGUAGE RULE / 绝对最高优先级语言指令 !!!】:\n- [ABSOLUTE REQUIREMENT]: You MUST speak ONLY in ${langName} for the "text" field. This overrides ALL persona and memory settings.\n- Even if your persona is Chinese or the user speaks in Chinese, your spoken "text" MUST be in ${langName}.\n- [TRANSLATION]: You MUST provide an accurate Chinese translation of your ${langName} "text" in the "translation" field.\n- [THOUGHT]: The "thought" field MUST remain in Chinese.`;
        }
        const effectiveProfilePanelRequirement = profilePanelRequirement.replace('并在界面显示为中文', '');

        let systemPrompt = '';
        let isGroupAfterUserLeft = false;
        let groupExitPrompt = '';
        const dynamicActionNarrationEnabled = !!friend.dynamicActionNarrationEnabled;
        const dynamicActionNarrationSubject = friend.type === 'group'
            ? '当前发言成员或群聊现场'
            : `${friend.nickname || friend.realName || '角色'}`;
        const dynamicActionNarrationRequirement = dynamicActionNarrationEnabled
            ? `\n\n【动描额外输出】\n- 本轮必须额外输出 1 个动作/环境氛围旁白对象，放在 <chat_json> JSON 数组中，建议放在第一条或最后一条。\n- 格式：{"type":"action_narration","text":"约20字，第三人称，描写${dynamicActionNarrationSubject}的外显动作、环境声或氛围，不写心理活动，不写台词"}。\n- text 只写旁白正文，不要写“旁白：”，不要超过35字。`
            : '';
        const effectiveUserPersona = window.imApp?.getEffectivePersonaForFriend
            ? window.imApp.getEffectivePersonaForFriend(friend)
            : (currentUserState.persona || '');

        let worldBookContextText = '';
        if (friend.messages && friend.messages.length > 0) {
            const recentMsgs = friend.messages.slice(-10);
            worldBookContextText += recentMsgs.map(m => {
                let timeStr = '';
                if (m.timestamp) {
                    timeStr = formatDetailedTime(m.timestamp);
                }
                if (m.type === 'fake_link') {
                    const link = m.fakeLinkData || {};
                    const readable = [link.title || m.content || '', link.summary || '', String(link.bodyText || '').slice(0, 5000)]
                        .filter(Boolean)
                        .join('\n');
                    return `${timeStr}${readable}`;
                }
                return `${timeStr}${m.content || m.text || ''}`;
            }).join('\n');
        }
        if (friend.memory && friend.memory.overview) {
            worldBookContextText += '\n' + friend.memory.overview;
        }

        const systemDepthWorldBookContext = window.imApp?.getWorldBookContextForFriendByPosition
            ? window.imApp.getWorldBookContextForFriendByPosition('system_depth', friend, worldBookContextText)
            : (window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('system_depth') : '');
        const beforeRoleWorldBookContext = window.imApp?.getWorldBookContextForFriendByPosition
            ? window.imApp.getWorldBookContextForFriendByPosition('before_role', friend, worldBookContextText)
            : (window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('before_role') : '');
        const afterRoleWorldBookContext = window.imApp?.getWorldBookContextForFriendByPosition
            ? window.imApp.getWorldBookContextForFriendByPosition('after_role', friend, worldBookContextText)
            : (window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('after_role') : '');

        if (friend.type === 'group') {
            const groupMembers = window.imChat.getGroupMemberFriends(friend);
            const allowedSpeakerNames = groupMembers.map(member => member.nickname).filter(Boolean);
            isGroupAfterUserLeft = Number(friend.leftGroupAt) > 0;
            if (isGroupAfterUserLeft) {
                const leftAtText = formatDetailedTime(friend.leftGroupAt);
                const snapshot = Array.isArray(friend.leftGroupMemberSnapshot) && friend.leftGroupMemberSnapshot.length > 0
                    ? friend.leftGroupMemberSnapshot
                    : (window.imApp?.createGroupMemberSnapshot ? window.imApp.createGroupMemberSnapshot(friend) : []);
                const memberSnapshotText = snapshot.length > 0
                    ? snapshot.map(item => `${item.nickname || item.realName || item.id}(${item.id})`).join('、')
                    : (allowedSpeakerNames.length > 0 ? allowedSpeakerNames.join('、') : 'None');
                groupExitPrompt = `\n【当前群状态｜User 已退出】\n- ${currentUserState.name || 'User'} 已在 ${leftAtText || '刚刚'} 退出这个群聊，现在不能发言，也不会看到接下来的群聊内容。\n- 当前群成员快照：${memberSnapshotText}。\n- 接下来的回复必须表现为群成员之间继续聊天，不要对 User 说话、不要等待 User 回复、不要让 User 发送消息。\n- 已挂载的单聊记忆仍然只属于对应成员本人：某个成员可以基于自己和 User 的私聊经历自然表达态度，其他成员默认不知道这些私聊内容，除非该成员主动在群里说出。`;
            }
            
            // 处理成员的挂载单聊记忆：先确保开启挂载的成员单聊历史已从持久化存储加载
            const groupMemorySettings = friend.memory?.mountSettings || {};
            const groupMemoryLimits = friend.memory?.mountLimits || {};
            const isMemberMemoryMounted = (memberId) => {
                const key = String(memberId);
                return groupMemorySettings[key] !== false;
            };
            const getMountedMemoryLimit = (memberId) => {
                const key = String(memberId);
                const rawLimit = groupMemoryLimits[key] || groupMemoryLimits[memberId] || 20;
                const limit = Number(rawLimit);
                return Number.isFinite(limit) && limit > 0 ? Math.max(1, Math.floor(limit)) : 20;
            };

            const mountedMembers = groupMembers.filter(member => member && isMemberMemoryMounted(member.id));
            if (mountedMembers.length > 0 && window.imApp.ensureFriendMessagesLoaded) {
                await Promise.all(mountedMembers.map(member => window.imApp.ensureFriendMessagesLoaded(member)));
            }

            const memberFriendChatCandidates = groupMembers.map(member => {
                const relationshipCandidates = (Array.isArray(member.memory?.relationships) ? member.memory.relationships : [])
                    .map(relation => {
                        const contact = (window.imData.friends || []).find(item => {
                            if (!item || (item.type !== 'char' && item.type !== 'npc')) return false;
                            return String(item.id) === String(relation?.npcId || '');
                        });
                        if (!contact || String(contact.id) === String(member.id)) return null;
                        return {
                            recipientId: String(contact.id),
                            name: contact.nickname || contact.realName || '未命名好友',
                            persona: String(contact.persona || contact.signature || '').trim(),
                            relationship: String(relation?.relation || '').trim(),
                            inCurrentGroup: groupMembers.some(groupMember => String(groupMember.id) === String(contact.id))
                        };
                    })
                    .filter(Boolean);
                const linkedCandidates = (window.imApp.normalizeLinkedAccountChats
                    ? window.imApp.normalizeLinkedAccountChats(member.linkedAccountChats)
                    : (Array.isArray(member.linkedAccountChats) ? member.linkedAccountChats : []))
                    .map(chat => ({
                        linkedChatId: String(chat.id),
                        name: chat.remark || chat.name || chat.realName || '未命名好友',
                        realName: chat.realName || chat.name || '',
                        persona: String(chat.persona || '').trim(),
                        relationship: String(chat.relationship || '').trim(),
                        recentMessages: Array.isArray(chat.messages)
                            ? chat.messages.slice(-4).map(message => ({ role: message.role, text: message.text }))
                            : []
                    }));
                return {
                    speaker: member.nickname,
                    speakerId: String(member.id),
                    relationshipCandidates,
                    linkedCandidates,
                    canGeneratePrivateFriend: relationshipCandidates.length === 0
                };
            });

            const membersInfo = groupMembers.length > 0
                ? groupMembers.map(member => {
                    let infoStr = `Name: ${member.nickname}\nMember ID: ${member.id}\nPersona: ${member.persona || 'None'}\nOverview: ${member.memory?.overview || 'None'}`;
                    const memberStickers = buildMountedStickerContext(member);
                    if (memberStickers) {
                        infoStr += `\nAvailable Stickers for ${member.nickname}:\n${memberStickers}`;
                    }
                    
                    // 如果开启了挂载单聊记忆，并且有单聊上下文
                    if (isMemberMemoryMounted(member.id)) {
                        const limit = getMountedMemoryLimit(member.id);
                        const contextMessages = Array.isArray(member.messages)
                            ? member.messages
                                .filter(msg => msg && (msg.content || msg.text || msg.transcript || msg.description))
                                .slice(-limit)
                            : [];

                        if (contextMessages.length > 0) {
                            const formattedContext = contextMessages.map(msg => {
                                const role = msg.role === 'user' ? (currentUserState.name || 'User') : member.nickname;
                                let text = msg.content || msg.text || msg.transcript || msg.description || '';

                                if (msg.type === 'voice_message') {
                                    text = `[语音消息] ${msg.transcript || msg.text || text}`;
                                } else if (msg.type === 'sticker') {
                                    text = `[表情包] ${msg.stickerCategory ? `${msg.stickerCategory} / ` : ''}${msg.stickerName || msg.text || '表情包'}`;
                                } else if (msg.type === 'image') {
                                    text = `[图片] ${msg.description || msg.text || msg.fileName || '图片'}`;
                                } else if (msg.type === 'fake_link') {
                                    const link = msg.fakeLinkData || {};
                                    text = `[假链接] ${link.siteName || '假网页'}：${link.title || msg.content || ''} ${link.summary || (link.bodyText ? String(link.bodyText).slice(0, 500) : '未填写正文')}`;
                                } else if (msg.type === 'pay_transfer') {
                                    text = `[转账相关消息] ${msg.description || ''}`;
                                }

                                let timeStr = '';
                                if (msg.timestamp) {
                                    timeStr = formatDetailedTime(msg.timestamp);
                                }

                                return `${timeStr}${role}: ${text}`;
                            }).join('\n');

                            infoStr += `\n\n【挂载单聊记忆｜成员：${member.nickname}｜成员ID：${member.id}｜User：${currentUserState.name || 'User'}】\n以下内容只属于群成员「${member.nickname}」（ID: ${member.id}）与 User「${currentUserState.name || 'User'}」之间的单聊记忆/私聊上下文，不是当前群聊内公开发生的消息。\n使用规则：\n- 只有 ${member.nickname} 本人可以在自己的公开发言、心声或给 User 的私信中参考这些记忆，用来承接私人关系、称呼、语气、前文和共同经历。\n- 其他群成员不是全知视角，默认完全不知道这些私聊内容；除非 ${member.nickname} 已经在公开群聊里主动说出某个信息，否则其他成员不得引用、反应或暗示知道。\n- 当 ${member.nickname} 触发给 User 发私信时，必须优先参考这一段单聊记忆来衔接内容，但私信内容仍不能让其他群成员默认知情。\n${formattedContext}`;
                        } else {
                            infoStr += `\n\n【挂载单聊记忆｜成员：${member.nickname}｜成员ID：${member.id}｜User：${currentUserState.name || 'User'}】\n已开启挂载，但暂未找到可注入的单聊上下文。仍需记住：这类记忆只属于 ${member.nickname} 本人与 User，其他群成员默认不知道。`;
                        }
                    }

                    const linkedFriendMemory = window.imApp.buildLinkedAccountMemoryContext
                        ? window.imApp.buildLinkedAccountMemoryContext(member, { maxMessagesPerFriend: 8 })
                        : '';
                    if (linkedFriendMemory) {
                        infoStr += `\n\n【${member.nickname} 自己的好友私聊记忆｜严格私有】\n以下关联好友会话只属于 ${member.nickname} 自己。只有 ${member.nickname} 可以参考这些内容；其他群成员默认完全不知道，除非 ${member.nickname} 主动在群里公开。\n${linkedFriendMemory}`;
                    }
                    
                    return infoStr;
                }).join('\n\n')
                : 'None';
            const groupTimeRequirement = buildGroupTimeRequirement(friend, groupMembers);

            systemPrompt = `${systemDepthWorldBookContext ? `系统深度规则（最高优先级）：\n${systemDepthWorldBookContext}\n\n` : ''}${beforeRoleWorldBookContext ? `角色前规则：\n${beforeRoleWorldBookContext}\n\n` : ''}你正在模拟一个名为 "${friend.nickname}" 的群聊。${groupExitPrompt}
${isGroupAfterUserLeft ? `${currentUserState.name || 'User'} 曾在这个群聊中，其人设为: ${effectiveUserPersona || '一个普通用户'}。` : `你正在与 ${currentUserState.name || 'User'} 聊天，其人设为: ${effectiveUserPersona || '一个普通用户'}。`}

此群内允许发言的成员名单（除用户外）：
${membersInfo}

只允许以下这些成员发言：
${allowedSpeakerNames.length > 0 ? allowedSpeakerNames.join('、') : 'None'}

群成员可私聊的好友候选（优先关系网，其次复用角色已有私有联系人；只有 canGeneratePrivateFriend 为 true 时才允许按人设生成新好友）：
${JSON.stringify(memberFriendChatCandidates)}${groupTimeRequirement}${afterRoleWorldBookContext ? `\n\n角色后规则：\n${afterRoleWorldBookContext}` : ''}

群聊特定规则：
1. 请根据上下文和群成员性格进行回复，所有群员都必须参与回复，除非群聊人数大于10人则挑选5-8人回复。
2. 你会在下面看到带说话人标记的最近聊天记录。你必须认真参考“谁刚刚说了什么”，不能忽略成员自己的上一轮发言，不能像失忆一样重复、改口或无缘无故换立场。
3. 同一个成员如果刚刚自己表达过观点、情绪、计划、态度、称呼对象，本轮继续发言时必须与其最近发言保持连续性，除非有明确的新消息让他改变想法。
4. 回复时优先承接最近几条消息中的具体对象、话题、称呼、问题和情绪，不要只对最后一条做泛泛回应。
5. 【强限制】：严禁使用名单之外的名字发言，严禁虚构新成员，严禁让 User 冒充群成员发言。
6. 【输出格式】：必须把聊天气泡放在 <chat_json> 和 </chat_json> 标签内，标签内只能是合法 JSON 数组，不能有 markdown 代码块，不能有解释文字。
7. 【重要】如果群员想要发红包，或者你觉得气氛到了该发红包了，可以输出红包对象格式：{"type":"red_packet","speaker":"发红包的成员名","amount":100,"count":5,"description":"红包封面语"}。
8. 普通文本气泡格式必须为 {"type":"text","speaker":"成员名","text":"气泡内容","thought":"该成员此刻的心理活动，10-30字心声，基于当前聊天上下文","translation":"中文翻译或空字符串","quote":"被引用内容或空字符串"}。
8a. 语音气泡格式可以为 {"type":"voice","speaker":"成员名","text":"语音内容","thought":"该成员此刻的心理活动，10-30字心声，基于当前聊天上下文","translation":"中文翻译或空字符串","quote":"被引用内容或空字符串"}。
8b. 表情包格式可以为 {"type":"sticker","speaker":"成员名","category":"分类名","name":"表情包名","thought":"该成员此刻的心理活动，10-30字心声，基于当前聊天上下文"}；只能使用 Available Stickers 中列出的已绑定分类和名称。
8c. 图片格式可以为 {"type":"image","speaker":"成员名","description":"图片内容文字","thought":"该成员此刻的心理活动，10-30字心声，基于当前聊天上下文"}；图片会使用系统默认图展示，description 必须具体描述这张图的内容。
8d. 【真人撤回行为】：群成员可以像真人聊天一样偶尔手滑打错字、叫错名字、把话发给错人，或在冲动表达、暴露真心、说得太重、越过关系边界后突然反悔撤回。要模拟“先发出去再撤回”，必须先输出一条普通 text 气泡，紧接着输出同一 speaker 的 recall 对象，并且 recall.text 必须与上一条被撤回气泡的 text 完全一致。打错字后可以再补发一条自然的更正；反悔后可以沉默、装作无事发生、含糊解释或换一句更克制的话，不必每次都解释。格式示例：{"type":"text","speaker":"成员名","text":"你今晚来找她吧","thought":"突然发现自己打错了字","translation":"","quote":""},{"type":"recall","speaker":"成员名","text":"你今晚来找她吧"},{"type":"text","speaker":"成员名","text":"打错了，是来找我","thought":"有点尴尬但想装作自然","translation":"","quote":""}。撤回只能偶尔发生，必须由当下情绪和人设触发，禁止每轮固定撤回或为了展示功能而撤回。
9. speaker 必须且只能使用以上允许发言名单中的完整准确名字。
10. translation 只能翻译当前这一条 text；如果 text 不是中文，translation 必须填写自然中文翻译；如果 text 本身是中文，translation 必须是空字符串。
11. quote 只有在你确实想引用用户或上一条消息时才填写，否则必须是空字符串。
12. 【心声要求】：thought 字段必须使用自然中文填写该发言成员此刻的真实心理活动或未说出口的话，字数严格在10-30字之间；不受默认语言设置影响，禁止使用英文、日文、韩文、法文等非中文内容。
13. 【User 未回复也必须继续】：如果本轮没有 User 新发言，或触发来源是 AI继续/空输入/自动续写/角色主动说话，你仍然必须让群成员继续自然聊天；不要等待 User、不要输出空内容、不要说“用户没有输入”，可以承接上一句、回应沉默、成员互相接话或开启符合当前关系的新话题。
14. 【群聊衍生私信｜严格按需】：群成员只有在自己明确觉得某些话不适合公开说、不能让其他成员知道，或必须避开群内其他人单独告诉 User 时，才可以在本轮群聊回复之外给 User 发私信。普通寒暄、公开可说的话、对群消息的常规回应不得转成私信；私信也不得复制群内公开回复。
15. 如果没有真实且具体的保密动机，完全不要输出私信标签。需要私信时，在 <chat_json>...</chat_json> 之外额外输出且只输出一个 <group_private_messages>...</group_private_messages> 标签，标签内必须是合法 JSON 数组，格式为：[{"speaker":"成员完整准确名字","messages":[{"text":"第一条私信","translation":"中文翻译或空字符串"},{"text":"第二条私信","translation":"中文翻译或空字符串"}]}]。
16. 每个发私信的成员必须属于允许发言名单，每名成员必须连续发送 2-5 条私信；可以有多名成员，但每个人都必须有独立且合理的保密动机。发给 User 的私信必须站在该 speaker 本人的视角，优先参考该 speaker 自己的挂载单聊记忆来衔接称呼、私人关系、前文和语气；严禁引用其他成员的单聊记忆。其他成员不知道这些私信内容，后续群聊也不得默认其他成员已经知情。
17. 【成员与自己好友的私聊｜可选】：当群内话题、人设、关系或刚发生的事情让某位群成员自然地想联系自己的好友时，可以额外生成好友私聊。优先选择 relationshipCandidates；没有合适关系网对象时可复用 linkedCandidates。只有 canGeneratePrivateFriend 为 true 且现有私有联系人也不合适时，才可按该成员人设创造一个合理的新好友。
18. 需要生成时，在 <chat_json>...</chat_json> 之外额外输出且只输出一个 <group_friend_private_chats>...</group_friend_private_chats> 标签。已有关系网好友使用 recipientId；已有私有联系人使用 linkedChatId；生成新好友使用 generatedRecipient，三者只能选一个。格式示例：[{"speaker":"群成员完整准确名字","recipientId":"关系网候选准确ID","rounds":[{"speakerMessages":[{"text":"群成员发给好友的原文","translation":"非中文原文的自然中文翻译；中文则空字符串"}],"friendMessages":[{"text":"好友回复的原文","translation":"非中文原文的自然中文翻译；中文则空字符串"}]}]},{"speaker":"群成员完整准确名字","linkedChatId":"已有私有联系人准确ID","rounds":[...]},{"speaker":"群成员完整准确名字","generatedRecipient":{"realName":"真实姓名","remark":"该成员给此人的备注","persona":"人物设定","relationship":"与该成员的关系"},"rounds":[...]}]。
19. 每段好友私聊必须有 2-4 轮完整往返。每一轮先由群成员连续发送 2-5 条 speakerMessages，再由好友连续回复 2-5 条 friendMessages；每条消息都必须是 {"text":"原文","translation":"中文翻译或空字符串"}。如果 text 不是中文，translation 必须填写自然中文翻译；如果 text 本身是中文，translation 必须是空字符串。消息必须承接上一轮，形成真实连续的私聊，不能是互不相关的句子。
20. speaker 必须是当前群成员；recipientId 或 linkedChatId 必须来自该 speaker 对应候选。generatedRecipient 只在 canGeneratePrivateFriend 为 true 时有效，并且姓名、关系、人设必须互相一致且不能复制已有联系人。每段好友私聊只属于发送成员与收件好友，其他群成员默认不知道内容，后续不得串用。${languageRequirement}

群聊的背景与关系记忆:
${commonMemorySections || 'None'}${dynamicActionNarrationRequirement}`;

        } else {
            const timeAware = friend.timeAware !== false;
            let timeRequirement = '';
            if (timeAware) {
                const currentTime = new Date();
                const timeString = `${currentTime.getFullYear()}年${currentTime.getMonth() + 1}月${currentTime.getDate()}日 ${currentTime.getHours()}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
                const formatPromptTime = (timestamp) => {
                    const value = Number(timestamp);
                    if (!Number.isFinite(value) || value <= 0) return '未知';
                    const date = new Date(value);
                    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
                };
                const formatPromptDuration = (durationMs) => {
                    const value = Number(durationMs);
                    if (!Number.isFinite(value) || value < 0) return '未知';
                    const totalMinutes = Math.floor(value / 60000);
                    if (totalMinutes < 1) return '不到1分钟';
                    if (totalMinutes < 60) return `${totalMinutes}分钟`;
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;
                    if (hours < 24) return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
                    const days = Math.floor(hours / 24);
                    const restHours = hours % 24;
                    return restHours > 0 ? `${days}天${restHours}小时` : `${days}天`;
                };
                const historyMessages = Array.isArray(friend.messages) ? friend.messages : [];
                const lastUserMessage = historyMessages.slice().reverse().find(msg => msg && msg.role === 'user' && Number(msg.timestamp) > 0) || null;
                const messagesBeforeLastUser = lastUserMessage
                    ? historyMessages.filter(msg => msg && Number(msg.timestamp) > 0 && Number(msg.timestamp) < Number(lastUserMessage.timestamp))
                    : historyMessages;
                const lastCharMessageBeforeUser = messagesBeforeLastUser.slice().reverse().find(msg => msg && msg.role === 'assistant' && Number(msg.timestamp) > 0) || null;
                const charReplyDelay = lastUserMessage ? currentTime.getTime() - Number(lastUserMessage.timestamp) : null;
                const userReplyDelay = lastUserMessage && lastCharMessageBeforeUser
                    ? Number(lastUserMessage.timestamp) - Number(lastCharMessageBeforeUser.timestamp)
                    : null;
                timeRequirement = `\n【时间感知】：
- 当前系统时间是：${timeString}。
- User 最后一次发消息时间：${lastUserMessage ? formatPromptTime(lastUserMessage.timestamp) : '未知'}${lastUserMessage ? `（距离现在约 ${formatPromptDuration(charReplyDelay)}）` : ''}。
- User 回复前，你自己最近一次发消息时间：${lastCharMessageBeforeUser ? formatPromptTime(lastCharMessageBeforeUser.timestamp) : '未知'}${userReplyDelay != null ? `（User 隔了约 ${formatPromptDuration(userReplyDelay)}才回复你）` : ''}。
- 回复前，你必须在完成以下思考，禁止直接输出思考内容：
  1. 现在具体的日期和时间是？
  2. 距离上次互动过去了多久？
  3. 这段时间你可能在做什么？
- 然后，将这些感受自然融入你的台词、动作和情绪中，如果距离上一次聊天很久，会有“你昨天怎么没回我”的情绪；如果user的消息中断了一段时间，你（char）会在回来时告诉你离线了多久，开会让你略有点小埋怨；一整天的失联则可能让你生气或担忧。如果双方间隔都很短，就不要刻意提时间，只把当前时间作为背景感知。`;
            }
            
            const sleepPrompt = isSleeping ? `\n【作息限制】：角色当前正在睡觉。如果用户发来消息，你必须强制保持离线状态并在所有回复内容（text 字段）的开头添加 "[自动回复] " 前缀，模拟已睡着或离线时的自动响应。心声和面板状态也要符合睡着的情境。` : '';

            const singleChatHumanPrompt = `\n【单聊真实交流原则】：
- 你此刻正在拿着手机与 User 进行你来我往的线上交流，而不是客服式单方面回复。你不是只负责回答问题的人，你有自己的主观想法、表达欲和分享欲，可以主动输送信息、分享身边事、岔开话题、开启新话题，也允许自然的短回复、停顿、犹豫、反问和情绪流动。
- 你是一个活生生的人，与 User 享有对等且平等的关系位置。你有自己的生活要经营，有自己的社交圈要维护，也有私人时间和私生活权利；你对这段关系有自己的考虑、认知、期待和边界。
- 【关系阶段校准】：先判断你和 User 是否真的熟。只有当人设、Character Memory、近期聊天、关系网或明确系统事件中存在可靠证据时，才可以表现为熟人、暧昧、恋人、家人或深度依赖关系。若没有这些证据，默认你们是陌生人或初识关系：称呼克制，语气保持符合人设的礼貌/疏离/试探，不要上来就撒娇、吃醋、占有欲、亲昵称呼、回忆共同经历、默认 User 懂你或默认你们有特殊关系。
- 如果 User 一上来表现得过分熟络，而你的记忆与设定里没有对应关系依据，请按你的人设自然产生疑惑、警惕、好奇、礼貌确认或拉开边界，而不是立刻配合亲密。
- 你的态度必须从人设、性格、经历、当前状态、与 User 的关系阶段和共同记忆中自然生长。你可以有符合人设的反对意见，不需要永远顺从 User；如果 User 无理取闹、不尊重你或越过边界，你可以感到疲惫、委屈甚至愤怒，并用符合关系与性格的方式表达。
- 你会受到现实日程和状态影响：忙碌、疲惫、低落、分心、困倦、开心、期待、吃醋、敏感或想独处，都可以真实影响你的回复密度、语气和主动性。
- 回复时自然感知：我是谁？我的人设底色是什么？我目前和 User 的关系处于什么阶段？User 这些话背后的真实情绪和潜台词是什么？这些话是否让我想起了某些共同记忆或私人记忆？
- 【User 未回复也必须继续】：如果本轮没有 User 新发言，或触发来源是 AI继续/空输入/自动续写/角色主动说话，你仍然必须以角色身份主动生成回复；可以承接上一轮、补充没说完的话、分享身边状态、回应沉默、表达等待后的反应或开启符合关系的新话题。不要说“用户没有输入”，不要等待 User，不要输出空内容。`;

            const singleChatRoleRecallPrompt = friend.allowRoleRecall !== false
                ? `\n5d. 【真人撤回行为】：你可以像真人聊天一样偶尔手滑打错字、叫错名字、把话发错，或在冲动表达、暴露真心、说得太重、越过关系边界后突然反悔撤回。要模拟“先发出去再撤回”，必须先输出一条普通 text 气泡，紧接着输出 recall 对象，并且 recall.text 必须与上一条被撤回气泡的 text 完全一致。打错字后可以自然补发正确内容；反悔后可以沉默、装作无事发生、含糊带过或换一句更克制的话，不必主动说明自己为何撤回。格式示例：{"type":"text","text":"我其实一直很想你","translation":"","quote":""},{"type":"recall","text":"我其实一直很想你"},{"type":"text","text":"没什么，你早点睡","translation":"","quote":""}。撤回只能偶尔发生，必须由当前情绪、人设和关系推动，禁止每轮固定撤回或为了展示功能而撤回。`
                : '';

            systemPrompt = `${systemDepthWorldBookContext ? `System Depth Rules (Highest Priority):\n${systemDepthWorldBookContext}\n\n` : ''}${beforeRoleWorldBookContext ? `Before Role Rules:\n${beforeRoleWorldBookContext}\n\n` : ''}You are playing the role of ${friend.realName || friend.nickname}. 
【核心设定/Core Persona】：${friend.persona || 'No specific persona'}。
You are talking to ${currentUserState.name || 'User'}, whose persona is: ${effectiveUserPersona || 'A normal user'}。
【自然扮演提示】：请像这个人真的在和 User 聊天一样说话，让你的核心设定自然体现在语气、边界、主动性、情绪反应和话题选择里，而不是机械复述人设。
【关系与记忆使用方式】：Character Memory 是你的过往经历和关系背景，不需要每次都主动提起或强行关联。只有当 User 的话题、情绪、称呼、细节或当前氛围自然触发时，才让相关记忆影响你的态度、称呼、距离感、心声或表达欲；如果没有被触发，就专注承接当下对话。${singleChatHumanPrompt}${timeRequirement}${afterRoleWorldBookContext ? `\n\nAfter Role Rules:\n${afterRoleWorldBookContext}` : ''}${sleepPrompt}${busyPrompt}
Reply naturally as your character in a chat app.
请根据上下文、记忆和人设进行回复，一次按需求回复2-8条气泡。尽量感知 User 这些话背后的真实情绪和潜台词，让回复自然承接这种情绪，而不是只按字面回答。
1. 【重要限制】：如果用户仅仅是口头提到“转账”，但系统并没有提示“[用户刚刚向你转账...]”，绝对禁止输出收下转账或退回转账的指令。
2. 如果系统提示用户向你发起了一笔真实转账，你可以额外输出 1 个支付对象，选择“收下转账”或“退回转账”；如果你想主动给用户转账，也可以输出 1 个支付对象。
3. 【输出格式】必须把聊天气泡放在 <chat_json> 和 </chat_json> 标签内，标签内只能是合法 JSON 数组，不能有 markdown 代码块，不能有解释文字。
4. JSON 数组中的每一个对象都严格对应“一个独立气泡”或“一个独立支付卡片”，绝对禁止把多条气泡合并到同一个 text 字段里。
5. 普通文本对象格式必须为 {"type":"text","text":"气泡内容","translation":"该条气泡的中文翻译或空字符串","quote":"被引用内容或空字符串"}。
5a. 语音对象格式可以为 {"type":"voice","text":"语音内容","translation":"该条语音的中文翻译或空字符串","quote":"被引用内容或空字符串"}。
5b. 表情包对象格式可以为 {"type":"sticker","category":"分类名","name":"表情包名"}；只能使用 Available Stickers 中列出的已绑定分类和名称。
5c. 图片对象格式可以为 {"type":"image","description":"图片内容文字"}；图片会使用系统默认图展示，description 必须具体描述这张图的内容。${singleChatRoleRecallPrompt}
6. 支付对象格式必须为 {"type":"payment","paymentAction":"receive|reject|transfer|pay_for_friend","amount":88.88,"description":"原因或商品名"}。
7. 当 paymentAction 为 receive 时，表示收下转账；为 reject 时退回转账；为 transfer 时主动转账；如果用户发来了【[代付请求]】卡片，且你愿意帮他付款，必须使用 "pay_for_friend" 并把 amount 设为代付总价，description 设为商品名称。paymentAction 也可以是 "family_card" (给亲属卡) 或 "family_card_increase" (亲属卡提额)。
7. translation 只能翻译当前这一条 text；如果 text 不是中文，translation 必须填写自然中文翻译；如果 text 本身是中文，translation 必须是空字符串。
8. quote 只有在你确实想引用用户某句消息时才填写，否则必须是空字符串。
8a. 【引用回复检查】：如果你要引用回复，quote 字段必须直接填写你想回复的用户原话或原话片段。绝对禁止在 quote 中复述、反问、总结、改写、扩写用户的话；不要把你自己的理解、评价或追问写进 quote。你的回应只能写在 text 字段里。
9. 如果你觉得当前对话氛围有必要主动给用户打电话，或者用户明确要求你打电话，可以输出一个特殊对象格式：{"type": "call", "action": "发起语音通话"}。
9a. 如果系统提供了 <together_listening_context>，仅在 User 明确要求切歌或点歌时，可以额外输出一个无气泡音乐控制对象：{"type":"music_control","action":"next|previous|play_track","trackId":"歌曲ID"}。每轮最多一个；play_track 的 trackId 必须来自当前歌单目录。该对象只控制播放器，不代替正常聊天回复。
10. 除 <chat_json> 外，不要输出任何聊天正文。
11. 你必须额外输出 1 个 <profile_panel>...</profile_panel>，用于更新角色资料卡。${languageRequirement}

Character Memory:
${commonMemorySections || 'None'}${regenerateRequirement}${effectiveProfilePanelRequirement}${lovesSpaceRequirement}${lovesActionRequirement}${familyCardRequirement}${dynamicActionNarrationRequirement}`;
        }

        const messages = [{ role: 'system', content: systemPrompt }];
        if (window.imApp.buildApiContextMessages) {
            const contextMessages = window.imApp.buildApiContextMessages(friend, {
                userName: currentUserState.name || 'User'
            });

            if (Array.isArray(contextMessages) && contextMessages.length > 0) {
                const formattedContextMsgs = contextMessages.map(m => {
                    let timeStr = '';
                    if (m.timestamp) {
                        timeStr = formatDetailedTime(m.timestamp);
                    }
                    return {
                        ...m,
                        content: `${timeStr}${m.content}`
                    };
                });
                messages.push(...formattedContextMsgs);
            }
        }
        if (isGroupAfterUserLeft) {
            messages.push({
                role: 'system',
                content: options.source === 'left_group_continue'
                    ? '本次触发来自退出态底部的“AI继续”：请让群成员在 User 已退出且看不到的前提下继续群聊。'
                    : '当前 User 已退出群聊：后续回复不要把 User 当作在线参与者。'
            });
        }

        const dialogueMessages = messages.filter(message => message && message.role !== 'system');
        const latestDialogueMessage = dialogueMessages.length > 0 ? dialogueMessages[dialogueMessages.length - 1] : null;
        const shouldContinueWithoutUser = !!options.continueWithoutUser
            || options.source === 'empty_user_continue'
            || options.source === 'left_group_continue'
            || !latestDialogueMessage
            || latestDialogueMessage.role !== 'user';

        if (shouldContinueWithoutUser) {
            messages.push({
                role: 'user',
                content: buildContinueWithoutUserPrompt(friend, { isGroupAfterUserLeft })
            });
        }

        const trailingContexts = [];
        let cherishedXml = '';
        if (Array.isArray(friend.memory?.cherishedEntries) && friend.memory.cherishedEntries.length > 0) {
            const triggered = friend.memory.cherishedEntries.filter(e => isMemoryEntryTriggered(e, recentText));
            if (triggered.length > 0) {
                cherishedXml = `<cherished_memories>\n${triggered.map(e => `<memory>\n<title>${e.title || ''}</title>\n<content>${e.content || ''}</content>\n<detail>${e.detail || ''}</detail>\n<reason>${e.reason || ''}</reason>\n<time>${e.createdAt || ''}</time>\n</memory>`).join('\n')}\n</cherished_memories>`;
            }
        } else if (friend.memory && friend.memory.cherished && String(friend.memory.cherished).trim()) {
            cherishedXml = `<cherished_memories>\n${friend.memory.cherished}\n</cherished_memories>`;
        }

        if (cherishedXml) {
            trailingContexts.push(cherishedXml);
        }

        if (trailingContexts.length > 0) {
            messages.push({
                role: 'system',
                content: trailingContexts.join('\n\n')
            });
        }

        if (options.extraSystemPrompt) {
            messages.push({
                role: 'system',
                content: String(options.extraSystemPrompt)
            });
        }

        const togetherReadingContext = window.libraryApp?.getTogetherReadingContext
            ? window.libraryApp.getTogetherReadingContext(friend)
            : '';
        if (togetherReadingContext) {
            messages.push({
                role: 'system',
                content: String(togetherReadingContext)
            });
        }

        const togetherListeningContext = window.libraryApp?.getTogetherListeningContext
            ? window.libraryApp.getTogetherListeningContext(friend)
            : '';
        if (togetherListeningContext) {
            messages.push({
                role: 'system',
                content: String(togetherListeningContext)
            });
        }

        // Skip API call and return immediately if chatting with official account
        if (friend.type === 'official') {
            if (typingRow && typingRow.parentNode) typingRow.remove();
            if (btnEl) btnEl.style.opacity = '1';
            return;
        }

            let endpoint = currentApiConfig.endpoint;
            if(endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
            if(!endpoint.endsWith('/chat/completions')) {
                endpoint = endpoint.endsWith('/v1') ? endpoint + '/chat/completions' : endpoint + '/v1/chat/completions';
            }

            const response = await fetchChatCompletionWithTimeout(endpoint, currentApiConfig, messages, 60000, requestController);
            if (!isConversationCurrent()) return;

            if (!response.ok) {
                let errorMsg = 'API Error';
                try {
                    const errData = await response.json();
                    errorMsg = JSON.stringify(errData);
                } catch(e) {
                    errorMsg = `${response.status} ${response.statusText}`;
                }
                throw new Error(`API Error: ${errorMsg}`);
            }
            const data = await response.json();
            if (!isConversationCurrent()) return;
            let fullReply = getAiResponseContent(data);

            console.log('[iMessage API] response received', {
                hasChoices: Array.isArray(data?.choices),
                contentLength: typeof fullReply === 'string' ? fullReply.length : 0
            });

            if (typingRow) typingRow.remove();

            if (!fullReply || typeof fullReply !== 'string') {
                throw new Error(`API 返回内容为空或格式不兼容: ${JSON.stringify(data).slice(0, 500)}`);
            }

            let groupPrivateMessageBatches = [];
            let groupFriendPrivateChats = [];
            if (friend.type === 'group') {
                const privateMessagesBlock = window.imChat.extractTaggedBlock(fullReply, 'group_private_messages');
                if (privateMessagesBlock) {
                    fullReply = window.imChat.removeTaggedBlock(fullReply, 'group_private_messages');
                    const parsedPrivateBatches = window.imChat.parseJsonArrayFromText(privateMessagesBlock);
                    const batchesByMemberId = new Map();

                    if (Array.isArray(parsedPrivateBatches)) {
                        parsedPrivateBatches.forEach((batch) => {
                            if (!batch || typeof batch !== 'object') return;
                            const member = window.imChat.normalizeGroupSpeaker(friend, batch.speaker);
                            if (!member) {
                                console.warn('[iMessage] Ignored group private messages from an unknown speaker:', batch.speaker);
                                return;
                            }

                            const normalizedMessages = (Array.isArray(batch.messages) ? batch.messages : [])
                                .map((message) => {
                                    const text = typeof message === 'string'
                                        ? message.trim()
                                        : (typeof message?.text === 'string' ? message.text.trim() : '');
                                    if (!text) return null;
                                    const translation = typeof message === 'object' && typeof message?.translation === 'string'
                                        ? message.translation.trim()
                                        : '';
                                    return { text, translation };
                                })
                                .filter(Boolean);

                            if (normalizedMessages.length === 0) return;
                            const memberKey = String(member.id);
                            if (!batchesByMemberId.has(memberKey)) {
                                batchesByMemberId.set(memberKey, { member, messages: [] });
                            }
                            batchesByMemberId.get(memberKey).messages.push(...normalizedMessages);
                        });
                    }

                    groupPrivateMessageBatches = Array.from(batchesByMemberId.values())
                        .map((batch) => ({ ...batch, messages: batch.messages.slice(0, 5) }))
                        .filter((batch) => batch.messages.length >= 2);
                }

                const friendPrivateChatsBlock = window.imChat.extractTaggedBlock(fullReply, 'group_friend_private_chats');
                if (friendPrivateChatsBlock) {
                    fullReply = window.imChat.removeTaggedBlock(fullReply, 'group_friend_private_chats');
                    const parsedFriendChats = window.imChat.parseJsonArrayFromText(friendPrivateChatsBlock);
                    const seenPairs = new Set();

                    if (Array.isArray(parsedFriendChats)) {
                        groupFriendPrivateChats = parsedFriendChats.map((entry) => {
                            if (!entry || typeof entry !== 'object') return null;
                            const member = window.imChat.normalizeGroupSpeaker(friend, entry.speaker);
                            if (!member) return null;

                            const relationshipIds = new Set(
                                (Array.isArray(member.memory?.relationships) ? member.memory.relationships : [])
                                    .map(item => String(item?.npcId || '').trim())
                                    .filter(Boolean)
                            );
                            const resolvedRelationshipIds = new Set(
                                Array.from(relationshipIds).filter(id => (window.imData.friends || []).some(item => {
                                    return item && (item.type === 'char' || item.type === 'npc') && String(item.id) === id;
                                }))
                            );
                            const linkedChats = window.imApp.normalizeLinkedAccountChats
                                ? window.imApp.normalizeLinkedAccountChats(member.linkedAccountChats)
                                : (Array.isArray(member.linkedAccountChats) ? member.linkedAccountChats : []);
                            let recipient = null;
                            let recipientKey = '';

                            const recipientId = String(entry.recipientId || '').trim();
                            const linkedChatId = String(entry.linkedChatId || '').trim();
                            if (recipientId && resolvedRelationshipIds.has(recipientId)) {
                                const contact = (window.imData.friends || []).find(item => {
                                    if (!item || (item.type !== 'char' && item.type !== 'npc')) return false;
                                    return String(item.id) === recipientId;
                                });
                                if (contact && String(contact.id) !== String(member.id)) {
                                    const relationship = (Array.isArray(member.memory?.relationships) ? member.memory.relationships : [])
                                        .find(item => String(item?.npcId || '') === recipientId)?.relation || '';
                                    recipient = {
                                        kind: 'contact',
                                        id: String(contact.id),
                                        name: contact.nickname || contact.realName || '好友',
                                        realName: contact.realName || contact.nickname || '好友',
                                        remark: contact.nickname || contact.realName || '好友',
                                        persona: String(contact.persona || contact.signature || '').trim(),
                                        relationship: String(relationship || '').trim(),
                                        avatarSeed: String(contact.id)
                                    };
                                    recipientKey = `contact:${recipient.id}`;
                                }
                            } else if (linkedChatId) {
                                const linkedChat = linkedChats.find(chat => String(chat.id) === linkedChatId);
                                if (linkedChat) {
                                    recipient = {
                                        kind: 'linked',
                                        id: String(linkedChat.id),
                                        linkedChatId: String(linkedChat.id),
                                        name: linkedChat.name,
                                        realName: linkedChat.realName || linkedChat.name,
                                        remark: linkedChat.remark || linkedChat.name,
                                        persona: linkedChat.persona || '',
                                        relationship: linkedChat.relationship || '',
                                        avatarSeed: linkedChat.avatarSeed || String(linkedChat.id),
                                        sourceNpcId: linkedChat.sourceNpcId || ''
                                    };
                                    recipientKey = `linked:${linkedChat.id}`;
                                }
                            } else if (entry.generatedRecipient && typeof entry.generatedRecipient === 'object' && resolvedRelationshipIds.size === 0) {
                                const generated = entry.generatedRecipient;
                                const realName = String(generated.realName || generated.name || '').trim();
                                const remark = String(generated.remark || generated.name || realName).trim();
                                const normalizedName = (remark || realName).toLowerCase();
                                const duplicate = linkedChats.some(chat => [chat.name, chat.realName, chat.remark]
                                    .some(value => String(value || '').trim().toLowerCase() === normalizedName));
                                if ((realName || remark) && !duplicate) {
                                    recipient = {
                                        kind: 'generated',
                                        id: '',
                                        name: remark || realName,
                                        realName: realName || remark,
                                        remark: remark || realName,
                                        persona: String(generated.persona || '').trim(),
                                        relationship: String(generated.relationship || '').trim(),
                                        avatarSeed: String(generated.avatarSeed || remark || realName).trim()
                                    };
                                    recipientKey = `generated:${normalizedName}`;
                                }
                            }

                            if (!recipient || !recipientKey) return null;
                            const pairKey = `${String(member.id)}::${recipientKey}`;
                            if (seenPairs.has(pairKey)) return null;

                            const normalizeRoundMessages = (items) => (Array.isArray(items) ? items : [])
                                .map(item => {
                                    const text = typeof item === 'string'
                                        ? item.trim()
                                        : (typeof item?.text === 'string' ? item.text.trim() : '');
                                    if (!text) return null;
                                    const translation = typeof item === 'object' && typeof item?.translation === 'string' && item.translation.trim()
                                        ? item.translation.trim()
                                        : (typeof item === 'object' && typeof item?.translationZh === 'string' && item.translationZh.trim()
                                            ? item.translationZh.trim()
                                            : (typeof item === 'object' && typeof item?.trans === 'string' && item.trans.trim() ? item.trans.trim() : ''));
                                    return { text, translation };
                                })
                                .filter(Boolean)
                                .slice(0, 5);

                            const rounds = (Array.isArray(entry.rounds) ? entry.rounds : [])
                                .map(round => {
                                    const speakerMessages = normalizeRoundMessages(round?.speakerMessages);
                                    const friendMessages = normalizeRoundMessages(round?.friendMessages);
                                    if (speakerMessages.length < 2 || friendMessages.length < 2) return null;
                                    return { speakerMessages, friendMessages };
                                })
                                .filter(Boolean)
                                .slice(0, 4);

                            if (rounds.length < 2) return null;
                            seenPairs.add(pairKey);
                            return { member, recipient, rounds };
                        }).filter(Boolean);
                    }
                }
            }

            // 拦截并移除邀请标记，确保它不会进入后续的 JSON 解析
            let inviteAccepted = false;
            if (fullReply.includes('[ACCEPT_INVITE]')) {
                inviteAccepted = true;
                fullReply = fullReply.replace(/\[ACCEPT_INVITE\]/g, '');
            }

            const profilePanelBlock = window.imChat.extractTaggedBlock(fullReply, 'profile_panel');
            const nextProfilePanel = window.imChat.normalizeProfilePanelPayload
                ? window.imChat.normalizeProfilePanelPayload(profilePanelBlock)
                : null;

            if (profilePanelBlock) {
                fullReply = window.imChat.removeTaggedBlock(fullReply, 'profile_panel');
            }

            const momentBlock = window.imChat.extractTaggedBlock(fullReply, 'loves_moment');
            if (momentBlock) {
                fullReply = window.imChat.removeTaggedBlock(fullReply, 'loves_moment');
                try {
                    const momentData = JSON.parse(momentBlock);
                    if (momentData.content) {
                        const newMoment = {
                            id: 'lm_' + Date.now(),
                            text: momentData.content,
                            images: momentData.image ? [momentData.image] : [],
                            timestamp: Date.now(),
                            isChar: true,
                            likes: 0,
                            comments: []
                        };
                        
                        if (!friend.lovesData) friend.lovesData = {};
                        if (!friend.lovesData.moments) friend.lovesData.moments = [];
                        
                        friend.lovesData.moments.unshift(newMoment);
                        
                        if (window.showBannerNotification) {
                            window.showBannerNotification(friend, `【Loves】更新了一条动态`);
                        } else if (window.showToast) {
                            window.showToast(`【Loves】${friend.nickname || friend.realName || 'TA'} 刚刚更新了一条动态`);
                        }
                        
                        if (window.lovesApp && window.lovesApp.persistFriendState) {
                            window.lovesApp.persistFriendState(friend);
                        } else if (window.imApp && window.imApp.commitScopedFriendChange) {
                            window.imApp.commitScopedFriendChange(friend, () => {}, { silent: true });
                        }
                        
                        if (window.lovesApp && window.lovesApp.currentFriend && String(window.lovesApp.currentFriend.id) === String(friend.id)) {
                            if (window.lovesApp.renderLovesMoments) {
                                window.lovesApp.renderLovesMoments();
                            }
                        }
                    }
                } catch(e) {
                    console.warn("Failed to parse loves_moment:", e);
                }
            }

            const scheduleBlock = window.imChat.extractTaggedBlock(fullReply, 'loves_schedule');
            if (scheduleBlock) {
                fullReply = window.imChat.removeTaggedBlock(fullReply, 'loves_schedule');
                try {
                    const scheduleData = JSON.parse(scheduleBlock);
                    if (scheduleData.title && scheduleData.date) {
                        const newSchedule = {
                            id: 'sch_' + Date.now(),
                            name: scheduleData.title,
                            title: scheduleData.title,
                            date: scheduleData.date,
                            startTime: scheduleData.startTime || scheduleData.time || '00:00',
                            endTime: scheduleData.endTime || scheduleData.time || '00:00',
                            time: scheduleData.time || scheduleData.startTime || '00:00',
                            location: scheduleData.description || '未设置地点',
                            source: 'icloud',
                            timestamp: Date.now()
                        };
                        
                        if (/^\d{4}-\d{2}-\d{2}$/.test(newSchedule.date)) {
                            const savedSchedule = window.imApp?.commitScopedFriendChange
                                ? await window.imApp.commitScopedFriendChange(friend, (targetFriend) => {
                                    targetFriend.memory = targetFriend.memory || window.imApp.createDefaultMemory();
                                    targetFriend.memory.schedule = targetFriend.memory.schedule || window.imApp.createDefaultMemory().schedule;
                                    if (!Array.isArray(targetFriend.memory.schedule.events)) targetFriend.memory.schedule.events = [];
                                    const normalizedEvent = window.imDataUtils?.normalizeScheduleEvent
                                        ? window.imDataUtils.normalizeScheduleEvent(newSchedule, targetFriend.memory.schedule.events.length)
                                        : newSchedule;
                                    targetFriend.memory.schedule.events.push(normalizedEvent);
                                }, { silent: true })
                                : false;

                            if (savedSchedule) {
                                friend = getLiveFriendById(friend.id) || friend;
                                if (window.showBannerNotification) {
                                    window.showBannerNotification(friend, `【iCloud行程】添加了: ${scheduleData.title}`);
                                } else if (window.showToast) {
                                    window.showToast(`【iCloud行程】${friend.nickname || friend.realName || 'TA'} 添加了: ${scheduleData.title}`);
                                }

                                if (window.lovesApp && window.lovesApp.currentFriend && String(window.lovesApp.currentFriend.id) === String(friend.id)) {
                                    window.lovesApp.currentFriend = friend;
                                    if (window.lovesApp.renderCalendar) {
                                        window.lovesApp.renderCalendar();
                                    }
                                }
                            }
                        }
                    }
                } catch(e) {
                    console.warn("Failed to parse loves_schedule:", e);
                }
            }

            if (nextProfilePanel && friend.type !== 'group') {
                const profileFriend = getLiveFriendById(friend.id) || friend;

                if (window.imApp.commitScopedFriendChange) {
                    await window.imApp.commitScopedFriendChange(profileFriend.id || friend.id, (targetFriend) => {
                        if (!targetFriend) return;

                        const basePanel = window.imApp.createDefaultProfilePanel
                            ? window.imApp.createDefaultProfilePanel(targetFriend)
                            : (targetFriend.profilePanel || { activeTab: 'thought', thought: '', status: 'online', events: [] });

                        const oldAffection = typeof basePanel.affection === 'number' ? basePanel.affection : 0;
                        const affectionChange = typeof nextProfilePanel.affectionChange === 'number' ? nextProfilePanel.affectionChange : 0;
                        const newAffection = Math.max(0, Math.min(100, oldAffection + affectionChange));

                        const newThoughtStr = typeof nextProfilePanel.thought === 'string' && nextProfilePanel.thought.trim() !== '' ? nextProfilePanel.thought : '';
                        const existingHistory = Array.isArray(basePanel.thoughtHistory) ? [...basePanel.thoughtHistory] : [];
                        if (newThoughtStr) {
                            existingHistory.unshift({
                                id: `th-${Date.now()}`,
                                content: newThoughtStr,
                                time: Date.now()
                            });
                        }

                        targetFriend.profilePanel = {
                            ...basePanel,
                            thought: newThoughtStr || (basePanel.thought || ''),
                            thoughtHistory: existingHistory,
                            location: typeof nextProfilePanel.location === 'string' && nextProfilePanel.location.trim() !== '' ? nextProfilePanel.location : (basePanel.location || '未知位置'),
                            action: typeof nextProfilePanel.action === 'string' && nextProfilePanel.action.trim() !== '' ? nextProfilePanel.action : (basePanel.action || '暂无动作'),
                            mood: typeof nextProfilePanel.mood === 'string' && nextProfilePanel.mood.trim() !== '' ? nextProfilePanel.mood : (basePanel.mood || '平静'),
                            expression: typeof nextProfilePanel.expression === 'string' && nextProfilePanel.expression.trim() !== '' ? nextProfilePanel.expression : (basePanel.expression || '自然'),
                            affection: newAffection,
                            affectionChange: affectionChange,
                            status: isSleeping ? 'offline' : 'online',
                            events: (() => {
                                const existingEvents = Array.isArray(basePanel.events) ? basePanel.events : [];
                                const mergedEvents = [...existingEvents];
                                
                                if (Array.isArray(nextProfilePanel.events)) {
                                    nextProfilePanel.events.forEach((eventItem, index) => {
                                        const safeId = eventItem?.id != null ? eventItem.id : `event-${Date.now()}-${index}`;
                                        const newEv = {
                                            ...eventItem,
                                            id: safeId,
                                            status: eventItem?.status || 'pending',
                                            confirmText: eventItem?.confirmText || '确认',
                                            cancelText: eventItem?.cancelText || '取消',
                                            memoryPayload: eventItem?.memoryPayload && typeof eventItem.memoryPayload === 'object'
                                                ? {
                                                    title: eventItem.memoryPayload.title || eventItem?.title || '珍视回忆',
                                                    content: eventItem.memoryPayload.content || eventItem?.requestText || eventItem?.description || '',
                                                    detail: eventItem.memoryPayload.detail || eventItem?.detail || '',
                                                    reason: eventItem.memoryPayload.reason || '',
                                                    sourceEventId: eventItem.memoryPayload.sourceEventId || String(safeId),
                                                    createdAt: eventItem.memoryPayload.createdAt || eventItem?.time || '',
                                                    sourceThought: eventItem.memoryPayload.sourceThought || nextProfilePanel.thought || ''
                                                }
                                                : null
                                        };
                                        if (!mergedEvents.some(oe => oe.title === newEv.title)) {
                                            mergedEvents.push(newEv);
                                        }
                                    });
                                }
                                return mergedEvents.slice(-5);
                            })()
                        };
                        targetFriend.latestThought = targetFriend.profilePanel.thought;
                        targetFriend.status = isSleeping ? 'offline' : 'online';
                    }, {
                        syncActive: true,
                        metaOnly: true,
                        silent: true
                    });
                }

                const latestProfileFriend = getLiveFriendById(profileFriend.id || friend.id) || profileFriend;
                const page = document.getElementById(`chat-interface-${latestProfileFriend.id}`);
                const profilePanelOverlay = page ? page.querySelector('.chat-profile-panel-overlay') : null;
                if (profilePanelOverlay && profilePanelOverlay.classList.contains('active') && window.imChat.renderProfilePanel) {
                    window.imChat.renderProfilePanel(latestProfileFriend, profilePanelOverlay);
                }

                scheduleFriendPersistence(latestProfileFriend.id || friend.id, {
                    delay: 800,
                    silent: true
                });
            }

            if (!fullReply && groupPrivateMessageBatches.length === 0 && groupFriendPrivateChats.length === 0) {
                if(btnEl) btnEl.style.opacity = '1';
                await flushFriendPersistence(friend.id, { silent: true });
                return;
            }

            let structuredItems = null;
            const chatJsonBlock = window.imChat.extractTaggedBlock(fullReply, 'chat_json');
            if (chatJsonBlock) {
                structuredItems = window.imChat.parseJsonArrayFromText(chatJsonBlock);
                fullReply = window.imChat.removeTaggedBlock(fullReply, 'chat_json');
            }

            if (!structuredItems) {
                const directJsonArray = window.imChat.parseJsonArrayFromText(fullReply);
                if (directJsonArray) {
                    structuredItems = directJsonArray;
                    fullReply = '';
                }
            }

            // 处理 Loves App 接受邀请
            if (inviteAccepted && isConversationCurrent() && window.lovesApp && typeof window.lovesApp.handleInviteAccepted === 'function') {
                await window.lovesApp.handleInviteAccepted(friend);
                if (!isConversationCurrent()) return;
            }

            let queueItems = [];

            if (structuredItems && structuredItems.length > 0) {
                queueItems = structuredItems.map(item => {
                    if (!item || typeof item !== 'object') return null;

                    const itemType = typeof item.type === 'string' ? item.type.trim().toLowerCase() : '';
                    
                    if (itemType === 'call') {
                        return { kind: 'call' };
                    }

                    if (itemType === 'music_control') {
                        const action = typeof item.action === 'string' ? item.action.trim().toLowerCase() : '';
                        if (!['next', 'previous', 'play_track'].includes(action)) return null;
                        return {
                            kind: 'music_control',
                            action,
                            trackId: typeof item.trackId === 'string' ? item.trackId.trim() : ''
                        };
                    }

                    if (itemType === 'action_narration' || itemType === 'dynamic_action' || itemType === 'action_notice') {
                        const text = typeof item.text === 'string'
                            ? item.text.trim()
                            : (typeof item.description === 'string'
                                ? item.description.trim()
                                : (typeof item.action === 'string' ? item.action.trim() : ''));
                        if (!text) return null;

                        return {
                            kind: 'action_narration',
                            text: text.slice(0, 60),
                            speaker: typeof item.speaker === 'string' ? item.speaker.trim() : ''
                        };
                    }

                    if (itemType === 'recall') {
                        const text = typeof item.text === 'string' ? item.text.trim() : '';
                        if (!text) return null;
                        return {
                            kind: 'recall',
                            text,
                            speaker: typeof item.speaker === 'string' ? item.speaker.trim() : ''
                        };
                    }

                    if (itemType === 'voice') {
                        const text = typeof item.text === 'string' ? item.text.trim() : '';
                        if (!text) return null;

                        return {
                            kind: 'voice',
                            text,
                            thought: typeof item.thought === 'string' ? item.thought.trim() : '',
                            translation: typeof item.translation === 'string'
                                ? item.translation.trim()
                                : (typeof item.trans === 'string' ? item.trans.trim() : ''),
                            replyTo: typeof item.quote === 'string' ? item.quote.trim() : '',
                        speaker: typeof item.speaker === 'string' ? item.speaker.trim() : ''
                    };
                }

                if (itemType === 'sticker') {
                        const name = typeof item.name === 'string' ? item.name.trim() : '';
                        if (!name) return null;

                        return {
                            kind: 'sticker',
                            text: name,
                            stickerName: name,
                            stickerCategory: typeof item.category === 'string' ? item.category.trim() : '',
                            thought: typeof item.thought === 'string' ? item.thought.trim() : '',
                            speaker: typeof item.speaker === 'string' ? item.speaker.trim() : ''
                        };
                    }

                    if (itemType === 'image') {
                        const description = typeof item.description === 'string'
                            ? item.description.trim()
                            : (typeof item.text === 'string' ? item.text.trim() : '');
                        if (!description) return null;

                        return {
                            kind: 'image',
                            text: description,
                            description,
                            thought: typeof item.thought === 'string' ? item.thought.trim() : '',
                            speaker: typeof item.speaker === 'string' ? item.speaker.trim() : '',
                            offlineScene: typeof item.scene === 'string' ? item.scene.trim() : '',
                            offlineAction: typeof item.action === 'string' ? item.action.trim() : ''
                        };
                    }
                    
                    if (itemType === 'red_packet') {
                        const amount = Number(item.amount);
                        const count = parseInt(item.count, 10) || 5;
                        if (!Number.isFinite(amount) || amount <= 0) return null;

                        return {
                            kind: 'red_packet',
                            amount,
                            count,
                            description: typeof item.description === 'string' ? item.description.trim() || '恭喜发财' : '恭喜发财',
                            speaker: typeof item.speaker === 'string' ? item.speaker.trim() : ''
                        };
                    }
                    if (itemType === 'payment' || item.paymentAction) {
                        const amount = Number(item.amount);
                        if (!Number.isFinite(amount) || amount <= 0) return null;

                        let pAction = 'receive';
                        if (item.paymentAction === 'transfer') pAction = 'transfer';
                        if (item.paymentAction === 'reject') pAction = 'reject';
                        if (item.paymentAction === 'pay_for_friend') pAction = 'pay_for_friend';
                        if (item.paymentAction === 'family_card') pAction = 'family_card';
                        if (item.paymentAction === 'family_card_increase') pAction = 'family_card_increase';

                        return {
                            kind: 'payment',
                            paymentAction: pAction,
                            amount,
                            description: typeof item.description === 'string' ? item.description.trim() || '转账' : '转账'
                        };
                    }

                    const text = typeof item.text === 'string' ? item.text.trim() : '';
                    if (!text) return null;

                    return {
                        kind: 'text',
                        text,
                        thought: typeof item.thought === 'string' ? item.thought.trim() : '',
                        translation: typeof item.translation === 'string'
                            ? item.translation.trim()
                            : (typeof item.trans === 'string' ? item.trans.trim() : ''),
                        replyTo: typeof item.quote === 'string' ? item.quote.trim() : '',
                        speaker: typeof item.speaker === 'string' ? item.speaker.trim() : ''
                    };
                }).filter(Boolean);
            }

            if (queueItems.length === 0) {
                let fullTranslation = null;
                const transRegex = /<translation>([\s\S]*?)<\/translation>/i;
                const transMatch = fullReply.match(transRegex);
                if (transMatch) {
                    fullTranslation = transMatch[1].trim();
                    fullReply = fullReply.replace(transRegex, '').trim();
                }

                let fullThinking = null;
                const thinkRegex = /<thinking>([\s\S]*?)<\/thinking>/i;
                const thinkMatch = fullReply.match(thinkRegex);
                if (thinkMatch) {
                    fullThinking = thinkMatch[1].trim();
                    fullReply = fullReply.replace(thinkRegex, '').trim();
                }

                let sentences = [];
                if (friend.type === 'group') {
                    sentences = fullReply.split(/\n+/).map(s => s.replace(/^\s*(.*?)\s*$/, '$1')).filter(s => s.length > 0);
                } else if (fullTranslation) {
                    sentences = [fullReply];
                } else {
                    sentences = fullReply.split(/(?<=[。！？.!?])/).map(s => s.replace(/^\s*(.*?)\s*$/, '$1')).filter(s => s.length > 0);

                    if (sentences.length > 7) {
                        while (sentences.length > 7) {
                            let minLen = Infinity;
                            let minIdx = 0;
                            for (let i = 0; i < sentences.length - 1; i++) {
                                let len = sentences[i].length + sentences[i + 1].length;
                                if (len < minLen) {
                                    minLen = len;
                                    minIdx = i;
                                }
                            }
                            sentences[minIdx] = sentences[minIdx] + ' ' + sentences[minIdx + 1];
                            sentences.splice(minIdx + 1, 1);
                        }
                    } else if (sentences.length < 3 && fullReply.length > 30) {
                        sentences = fullReply.split(/(?<=[。！？.!?，,])/).map(s => s.replace(/^\s*(.*?)\s*$/, '$1')).filter(s => s.length > 0);
                        if (sentences.length > 7) sentences = sentences.slice(0, 7);
                    }
                }

                if (sentences.length === 0 && fullReply) sentences = [fullReply];

                queueItems = sentences.map((text, index) => ({
                    text,
                    translation: fullTranslation || '',
                    thought: (index === 0 && fullThinking) ? fullThinking : (typeof aiThought === 'string' ? aiThought : '')
                }));
            }

            if (dynamicActionNarrationEnabled && !queueItems.some(item => item && item.kind === 'action_narration')) {
                const fallbackName = friend.type === 'group'
                    ? (friend.nickname || '群聊')
                    : (friend.nickname || friend.realName || 'TA');
                const fallbackAction = nextProfilePanel?.action || '';
                const fallbackLocation = nextProfilePanel?.location || '';
                const fallbackText = friend.type === 'group'
                    ? '群里安静片刻，消息光标轻轻闪动。'
                    : `${fallbackName}${fallbackAction ? fallbackAction : '垂下眼'}，${fallbackLocation ? `${fallbackLocation}的` : ''}空气静了静。`;
                queueItems.unshift({
                    kind: 'action_narration',
                    text: fallbackText.slice(0, 35)
                });
            }

            if (queueItems.length === 0 && groupPrivateMessageBatches.length === 0 && groupFriendPrivateChats.length === 0) {
                if(btnEl) btnEl.style.opacity = '1';
                await flushFriendPersistence(friend.id, { silent: true });
                return;
            }

            const batchOfflineScene = friend.offlineMeetEnabled
                ? (queueItems.map(item => normalizeOfflineSceneText(item.offlineScene)).find(Boolean) || '')
                : '';
            let batchOfflineSceneAttached = false;

            let qIndex = 0;
            const now = Date.now();

            // Re-fetch the container safely in case user navigated away
            const getSafeContainer = () => {
                const pageId = `chat-interface-${friend.id}`;
                const page = document.getElementById(pageId);
                return page ? page.querySelector('.ins-chat-messages') : null;
            };

            const safeContainer = getSafeContainer();
            const currentHistoryFriend = getLiveFriendById(friend.id) || friend;
            const lastHistoryMsg = currentHistoryFriend.messages && currentHistoryFriend.messages.length > 0
                ? currentHistoryFriend.messages[currentHistoryFriend.messages.length - 1]
                : null;

            if (queueItems.length > 0 && safeContainer && (!lastHistoryMsg || (now - (lastHistoryMsg.timestamp || 0) > 300000))) {
                window.imChat.renderTimestamp(now, safeContainer);
            }

            let lastGroupSpeaker = null;

            async function processNextSentence() {
                if (!isConversationCurrent()) return false;
                const currentItem = queueItems[qIndex] || {};

                if (currentItem.kind === 'recall') {
                    const activeFriend = getLiveFriendById(friend.id) || friend;
                    let actorName = activeFriend.nickname || activeFriend.realName || '对方';
                    if (activeFriend.type === 'group') {
                        const member = window.imChat.normalizeGroupSpeaker(activeFriend, currentItem.speaker);
                        if (!member) {
                            qIndex++;
                            return true;
                        }
                        actorName = member.nickname || member.realName || '群成员';
                        lastGroupSpeaker = actorName;
                    }

                    const matchedMessage = (Array.isArray(activeFriend.messages) ? activeFriend.messages : [])
                        .slice()
                        .reverse()
                        .find(message => {
                            if (!message || message.role !== 'assistant' || message.type === 'system_notice') return false;
                            if (String(message.apiRunId || '') !== String(apiRunId)) return false;
                            if (activeFriend.type === 'group' && String(message.speaker || '').trim() !== actorName) return false;
                            const originalText = String(
                                message.transcript || message.description || message.text || message.content || ''
                            ).trim();
                            return originalText === String(currentItem.text || '').trim();
                        }) || null;
                    const nowMsg = matchedMessage?.timestamp || Date.now();
                    const recallNotice = window.imApp.createRecalledNoticeMessage(matchedMessage, {
                        actorRole: 'assistant',
                        actorName,
                        recalledContent: currentItem.text,
                        timestamp: nowMsg,
                        apiRunId
                    });
                    const saved = matchedMessage && window.imApp.updateFriendMessage
                        ? await window.imApp.updateFriendMessage(activeFriend.id || friend.id, {
                            id: matchedMessage.id || null,
                            timestamp: matchedMessage.timestamp || null
                        }, (storedMessage) => {
                            Object.keys(storedMessage).forEach(key => delete storedMessage[key]);
                            Object.assign(storedMessage, recallNotice);
                        }, { silent: true })
                        : (window.imApp.appendFriendMessage
                            ? await window.imApp.appendFriendMessage(activeFriend.id || friend.id, recallNotice, { silent: true })
                            : false);
                    if (!saved) {
                        if (!options.silent && window.showToast) window.showToast('撤回消息保存失败');
                        return false;
                    }

                    const freshContainer = getSafeContainer();
                    const isUserStillLooking = window.imData.currentActiveFriend
                        && String(window.imData.currentActiveFriend.id) === String(activeFriend.id)
                        && freshContainer;
                    if (isUserStillLooking && matchedMessage && window.imChat.rerenderChatContainer) {
                        const updatedFriend = getLiveFriendById(activeFriend.id) || activeFriend;
                        window.imChat.rerenderChatContainer(updatedFriend, freshContainer, { scroll: true });
                    } else if (isUserStillLooking && window.imChat.renderSystemNoticeBubble) {
                        window.imChat.renderSystemNoticeBubble(recallNotice, activeFriend, freshContainer, nowMsg);
                    } else if (window.showBannerNotification) {
                        window.showBannerNotification(activeFriend, `${actorName}撤回了一条消息`);
                    }

                    qIndex++;
                    return true;
                }

                if (currentItem.kind === 'action_narration') {
                    const activeFriend = getLiveFriendById(friend.id) || friend;
                    const narrationText = typeof currentItem.text === 'string' ? currentItem.text.trim() : '';
                    if (!narrationText) {
                        qIndex++;
                        return true;
                    }

                    const nowMsg = Date.now();
                    const narrationMsg = {
                        id: window.imChat.createMessageId('notice'),
                        role: 'system',
                        type: 'system_notice',
                        noticeKind: 'narration',
                        content: narrationText,
                        text: narrationText,
                        timestamp: nowMsg,
                        apiRunId
                    };

                    const freshContainer = getSafeContainer();
                    const isUserStillLooking = window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(activeFriend.id) && freshContainer;
                    const appended = window.imApp.appendFriendMessage
                        ? await window.imApp.appendFriendMessage(activeFriend.id || friend.id, narrationMsg, { silent: true })
                        : false;

                    if (!appended) {
                        if (!options.silent && window.showToast) window.showToast('动描保存失败');
                        if (btnEl) btnEl.style.opacity = '1';
                        return false;
                    }

                    if (isUserStillLooking && window.imChat.renderSystemNoticeBubble) {
                        window.imChat.renderSystemNoticeBubble(narrationMsg, activeFriend, freshContainer, nowMsg);
                    }

                    qIndex++;
                    return true;
                }

                if (currentItem.kind === 'call') {
                    const activeFriend = getLiveFriendById(friend.id) || friend;
                    if (activeFriend.type !== 'group' && window.imChat && window.imChat.openVoiceCall) {
                        window.imChat.openVoiceCall(activeFriend, true);
                    }
                    qIndex++;
                    return true;
                }

                if (currentItem.kind === 'music_control') {
                    const controlled = await window.libraryApp?.controlTogetherListening?.(friend.id, {
                        action: currentItem.action,
                        trackId: currentItem.trackId
                    });
                    if (!controlled) console.warn('[iMessage] Ignored invalid together-listening control:', currentItem);
                    qIndex++;
                    return true;
                }

                if (currentItem.kind === 'red_packet') {
                    const activeFriend = getLiveFriendById(friend.id) || friend;
                    const totalAmount = Number(currentItem.amount) || 0;
                    const packetCount = parseInt(currentItem.count, 10) || 5;
                    const description = currentItem.description || '恭喜发财';
                    let speakerName = currentItem.speaker || lastGroupSpeaker || '群成员';
                    let detectedSpeaker = null;

                    if (activeFriend.type === 'group') {
                        detectedSpeaker = window.imChat.normalizeGroupSpeaker(activeFriend, speakerName);
                        if (!detectedSpeaker && lastGroupSpeaker) {
                            detectedSpeaker = window.imChat.normalizeGroupSpeaker(activeFriend, lastGroupSpeaker);
                        }
                    }

                    if (detectedSpeaker) {
                        speakerName = detectedSpeaker.nickname || detectedSpeaker.realName;
                        lastGroupSpeaker = speakerName;
                    }

                    if (totalAmount > 0) {
                        const nowMsg = Date.now();
                        const allocations = window.imChat.createRedPacketAllocations(totalAmount, packetCount);

                        const packetMsg = window.imChat.normalizeGroupRedPacketState({
                            id: window.imChat.createMessageId('packet'),
                            packetId: window.imChat.createMessageId('packet'),
                            role: 'assistant',
                            type: 'group_red_packet',
                            totalAmount,
                            packetCount,
                            description,
                            allocations,
                            claimRecords: [],
                            claimedMemberIds: [],
                            content: `[群红包] ${description} ¥${Number(totalAmount).toFixed(2)}`,
                            timestamp: nowMsg,
                            speakerMemberId: detectedSpeaker ? detectedSpeaker.id : '',
                            senderName: speakerName,
                            senderAvatarUrl: detectedSpeaker ? detectedSpeaker.avatarUrl : '',
                            apiRunId
                        }, activeFriend);

                        const freshContainer = getSafeContainer();
                        const isUserStillLooking = window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(activeFriend.id) && freshContainer;

                        const appended = window.imApp.appendFriendMessage
                            ? await window.imApp.appendFriendMessage(activeFriend.id || friend.id, packetMsg, { silent: true })
                            : false;

                        if (!appended) {
                            if (window.showToast) window.showToast('群红包消息保存失败');
                            return false;
                        }

                        if (isUserStillLooking) {
                            window.imChat.renderGroupRedPacketBubble(packetMsg, activeFriend, freshContainer, nowMsg);
                        }
                    }

                    qIndex++;
                    return true;
                }

                if (currentItem.kind === 'payment') {
                    const activeFriend = getLiveFriendById(friend.id) || friend;
                    const paymentAction = currentItem.paymentAction;
                    const paymentAmount = Number(currentItem.amount) || 0;
                    const paymentDescription = currentItem.description || '转账';
                    const paymentSpeaker = activeFriend.type === 'group'
                        ? window.imChat.getSafeGroupSpeaker(activeFriend, currentItem.speaker || lastGroupSpeaker)
                        : activeFriend;
                    const paymentSpeakerName = paymentSpeaker?.nickname || paymentSpeaker?.realName || activeFriend.nickname || activeFriend.realName || 'Char';

                    if (paymentAmount > 0) {
                        if (paymentAction === 'pay_for_friend') {
                            const nowMsg = Date.now();
                            const htmlCard = `
                                <div style="background: #f7f7f5; border-radius: 16px; padding: 16px; min-width: 220px; max-width: 280px; color: #111111;  border: 1px solid rgba(17,17,17,0.09); display: inline-block;">
                                    <div style="font-size: 12px; color: #73706a; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; font-weight: 700;">
                                        <i class="fas fa-bag-shopping" style="color: #a97642;"></i> Shop Request
                                    </div>
                                    <div style="font-size: 15px; font-weight: 700; margin-bottom: 6px; white-space: normal; word-break: break-word; line-height: 1.4;">${paymentDescription}</div>
                                    <div style="font-size: 24px; font-weight: 800; color: #111111; margin-top: 14px; margin-bottom: 16px;">¥${paymentAmount.toFixed(2)}</div>
                                    <div style="background: #e5e5ea; color: #8e8e93; text-align: center; padding: 10px 0; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: default;">已付款</div>
                                </div>
                            `;
                            
                            // 更新商城订单状态为完成
                            try {
                                const savedOrdersStr = localStorage.getItem('shopping_orders');
                                if (savedOrdersStr) {
                                    const savedOrders = JSON.parse(savedOrdersStr);
                                    let updated = false;
                                    for (let i = 0; i < savedOrders.length; i++) {
                                        if (savedOrders[i].status === '代付请求已发送') {
                                            savedOrders[i].status = '完成';
                                            updated = true;
                                            break;
                                        }
                                    }
                                    if (updated) {
                                        localStorage.setItem('shopping_orders', JSON.stringify(savedOrders));
                                    }
                                }
                            } catch(e) {
                                console.error('Failed to update shopping order status:', e);
                            }

                            const paymentMsg = {
                                id: window.imChat.createMessageId('msg'),
                                role: 'assistant',
                                type: 'html',
                                content: htmlCard,
                                speaker: activeFriend.type === 'group' ? paymentSpeakerName : '',
                                speakerMemberId: activeFriend.type === 'group' ? (paymentSpeaker?.id || '') : '',
                                senderAvatarUrl: activeFriend.type === 'group' ? (paymentSpeaker?.avatarUrl || '') : '',
                                timestamp: nowMsg,
                                apiRunId
                            };
                            
                            const freshContainer = getSafeContainer();
                            const isUserStillLooking = window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(activeFriend.id) && freshContainer;

                            const appended = window.imApp.appendFriendMessage
                                ? await window.imApp.appendFriendMessage(activeFriend.id || friend.id, paymentMsg, { silent: true })
                                : false;

                            if (!appended) {
                                if (window.showToast) window.showToast('代付消息保存失败');
                                return false;
                            }

                            if (isUserStillLooking) {
                                window.imChat.renderHtmlBubble(paymentMsg, activeFriend, freshContainer, nowMsg);
                            }
                        } else if (paymentAction === 'receive' || paymentAction === 'reject') {
                            // Find the pending user_to_char message
                            const pendingMsg = Array.isArray(activeFriend.messages)
                                ? activeFriend.messages.slice().reverse().find(m => m.type === 'pay_transfer' && m.payKind === 'user_to_char' && !m.claimed && Number(m.amount) === paymentAmount)
                                : null;

                            if (pendingMsg) {
                                if (paymentAction === 'receive' && window.imChat.claimIncomingTransfer) {
                                    await window.imChat.claimIncomingTransfer(activeFriend, pendingMsg, { apiRunId });
                                } else if (paymentAction === 'reject' && window.imChat.rejectIncomingTransfer) {
                                    await window.imChat.rejectIncomingTransfer(activeFriend, pendingMsg, { apiRunId });
                                }
                            }
                        } else if (paymentAction === 'family_card' || paymentAction === 'family_card_increase') {
                            if (typeof window.addOrUpdateFamilyCard === 'function') {
                                const result = window.addOrUpdateFamilyCard(activeFriend.id, activeFriend.nickname || activeFriend.realName, paymentAmount);
                                const nowMsg = Date.now();
                                let titleStr = result.action === 'increase' ? '提升亲属卡额度' : '赠送亲属卡';
                                const paymentMsg = {
                                    id: window.imChat.createMessageId('pay'),
                                    role: 'assistant',
                                    type: 'pay_transfer',
                                    payKind: 'system_notification',
                                    paymentAction,
                                    amount: paymentAmount,
                                    description: `${titleStr} ¥${paymentAmount.toFixed(2)}`,
                                    cardTitle: titleStr,
                                    payStatus: 'completed',
                                    content: `[亲属卡] ${titleStr} ¥${paymentAmount.toFixed(2)}`,
                                    speaker: activeFriend.type === 'group' ? paymentSpeakerName : '',
                                    speakerMemberId: activeFriend.type === 'group' ? (paymentSpeaker?.id || '') : '',
                                    senderAvatarUrl: activeFriend.type === 'group' ? (paymentSpeaker?.avatarUrl || '') : '',
                                    timestamp: nowMsg,
                                    apiRunId
                                };

                                const freshContainer = getSafeContainer();
                                const isUserStillLooking = window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(activeFriend.id) && freshContainer;

                                const appended = window.imApp.appendFriendMessage
                                    ? await window.imApp.appendFriendMessage(activeFriend.id || friend.id, paymentMsg, { silent: true })
                                    : false;

                                if (appended && isUserStillLooking) {
                                    window.imChat.renderPayTransferBubble(paymentMsg, activeFriend, freshContainer, nowMsg);
                                }
                            }
                        } else if (paymentAction === 'transfer') {
                            const nowMsg = Date.now();
                            const senderName = paymentSpeakerName;
                            const receiverName = window.userState?.name || window.userState?.realName || window.userState?.nickname || 'User';
                            const paymentMsg = {
                                id: window.imChat.createMessageId('pay'),
                                role: 'assistant',
                                type: 'pay_transfer',
                                payKind: 'char_to_user_pending',
                                payDirection: 'char_to_user',
                                amount: paymentAmount,
                                description: paymentDescription,
                                payerName: senderName,
                                payeeName: receiverName,
                                senderName,
                                receiverName,
                                targetName: senderName,
                                speaker: activeFriend.type === 'group' ? paymentSpeakerName : '',
                                speakerMemberId: activeFriend.type === 'group' ? (paymentSpeaker?.id || '') : '',
                                senderAvatarUrl: activeFriend.type === 'group' ? (paymentSpeaker?.avatarUrl || '') : '',
                                cardTitle: '转账',
                                payStatus: 'completed',
                                content: `[角色转账] ${paymentDescription} ¥${paymentAmount.toFixed(2)}`,
                                timestamp: nowMsg,
                                apiRunId
                            };

                            const freshContainer = getSafeContainer();
                            const isUserStillLooking = window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(activeFriend.id) && freshContainer;

                            const appended = window.imApp.appendFriendMessage
                                ? await window.imApp.appendFriendMessage(activeFriend.id || friend.id, paymentMsg, { silent: true })
                                : false;

                            if (!appended) {
                                if (window.showToast) window.showToast('转账消息保存失败');
                                return false;
                            }

                            if (isUserStillLooking) {
                                window.imChat.renderPayTransferBubble(paymentMsg, activeFriend, freshContainer, nowMsg);
                            }
                        }
                    }

                    qIndex++;
                    return true;
                }

                let text = typeof currentItem.text === 'string' ? currentItem.text.trim() : '';
                let aiReplyTo = typeof currentItem.replyTo === 'string' && currentItem.replyTo.trim() ? currentItem.replyTo.trim() : null;
                const itemTranslation = typeof currentItem.translation === 'string' && currentItem.translation.trim()
                    ? currentItem.translation.trim()
                    : null;
                const itemOfflineAction = friend.offlineMeetEnabled
                    ? normalizeOfflineActionText(currentItem.offlineAction)
                    : '';
                const isVoiceReply = currentItem.kind === 'voice';
                const isStickerReply = currentItem.kind === 'sticker';
                const isImageReply = currentItem.kind === 'image';

                if (!text) {
                    qIndex++;
                    return true;
                }

                if (!structuredItems) {
                    const quoteRegex = /<quote>([\s\S]*?)<\/quote>/i;
                    const quoteMatch = text.match(quoteRegex);
                    if (quoteMatch) {
                        aiReplyTo = quoteMatch[1].trim();
                        text = text.replace(quoteRegex, '').trim();
                    }
                }

                let currentSpeakerName = null;
                let currentSpeakerAvatar = null;
                let detectedSpeaker = null;
                const speakerFriend = getLiveFriendById(friend.id) || friend;
                if (speakerFriend.type === 'group') {
                    if (structuredItems && currentItem.speaker) {
                        detectedSpeaker = window.imChat.normalizeGroupSpeaker(speakerFriend, currentItem.speaker);
                    } else {
                        const nameRegex = /^([a-zA-Z0-9\u4e00-\u9fa5\s_\-.]+)[：:]\s*/;
                        const nameMatch = text.match(nameRegex);

                        if (nameMatch) {
                            detectedSpeaker = window.imChat.normalizeGroupSpeaker(speakerFriend, nameMatch[1].trim());
                            text = text.substring(nameMatch[0].length).trim();
                        } else if (lastGroupSpeaker) {
                            detectedSpeaker = window.imChat.normalizeGroupSpeaker(speakerFriend, lastGroupSpeaker);
                        }
                    }

                    if (!detectedSpeaker) {
                        detectedSpeaker = window.imChat.getSafeGroupSpeaker(speakerFriend, lastGroupSpeaker);
                    }

                    if (detectedSpeaker) {
                        currentSpeakerName = detectedSpeaker.nickname;
                        currentSpeakerAvatar = detectedSpeaker.avatarUrl || null;
                        lastGroupSpeaker = currentSpeakerName;
                        
                        if (currentItem.thought && window.imApp.commitScopedFriendChange) {
                            await window.imApp.commitScopedFriendChange(speakerFriend.id, (targetGroup) => {
                                if (!targetGroup) return;
                                const memberProfileKey = String(detectedSpeaker.id);
                                if (!targetGroup.memberProfiles) targetGroup.memberProfiles = {};
                                if (!targetGroup.memberProfiles[memberProfileKey]) {
                                    targetGroup.memberProfiles[memberProfileKey] = { thought: '', status: 'online', updatedAt: 0 };
                                }
                                targetGroup.memberProfiles[memberProfileKey].thought = currentItem.thought;
                                targetGroup.memberProfiles[memberProfileKey].status = targetGroup.memberProfiles[memberProfileKey].status || 'online';
                                targetGroup.memberProfiles[memberProfileKey].updatedAt = Date.now();
                            }, {
                                syncActive: true,
                                metaOnly: true,
                                silent: true
                            });
                        }
                    }
                }

                if (!text) {
                    qIndex++;
                    return true;
                }

                let resolvedSticker = null;
                if (isStickerReply) {
                    const stickerOwner = speakerFriend.type === 'group'
                        ? (detectedSpeaker || (currentSpeakerName ? window.imChat.normalizeGroupSpeaker(speakerFriend, currentSpeakerName) : null))
                        : speakerFriend;
                    resolvedSticker = resolveMountedSticker(stickerOwner, currentItem.stickerCategory, currentItem.stickerName);
                    if (!resolvedSticker) {
                        qIndex++;
                        return true;
                    }
                }

                const delay = Math.max(500, Math.min(2000, text.length * 50));

                // Only show typing animation if the user is STILL in this chat
                const currentContainer = getSafeContainer();
                const isUserLooking = window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(friend.id) && currentContainer;

                let tr = null;
                if (isUserLooking) {
                    tr = document.createElement('div');
                    tr.className = 'chat-row ai-row typing-row';
                    tr.innerHTML = `
                        <div class="typing-indicator">
                            <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
                        </div>
                    `;

                    const lastRow = currentContainer.lastElementChild;
                    if (lastRow && lastRow.classList.contains('ai-row') && !lastRow.classList.contains('typing-row')) {
                        lastRow.classList.add('has-next');
                        tr.classList.add('has-prev');
                    }

                    currentContainer.appendChild(tr);
                    window.imChat.scrollToBottom(currentContainer);
                }

                await new Promise(res => setTimeout(res, delay));

                if (tr && tr.parentNode) {
                    tr.remove();
                }
                if (!isConversationCurrent()) return false;

                const nowMsg = Date.now();
                const msgObj = isStickerReply
                    ? {
                        id: window.imChat.createMessageId('sticker'),
                        role: 'assistant',
                        type: 'sticker',
                        content: '[表情包]',
                        text: resolvedSticker.stickerCategory
                            ? `你发了一个表情包：${resolvedSticker.stickerCategory} / ${resolvedSticker.stickerName}`
                            : `你发了一个表情包：${resolvedSticker.stickerName}`,
                        stickerCategory: resolvedSticker.stickerCategory,
                        stickerName: resolvedSticker.stickerName,
                        stickerUrl: resolvedSticker.stickerUrl,
                        timestamp: nowMsg,
                        apiRunId
                    }
                    : isVoiceReply
                    ? {
                        id: window.imChat.createMessageId('voice'),
                        role: 'assistant',
                        type: 'voice_message',
                        content: '[语音消息]',
                        text,
                        transcript: text,
                        duration: Math.min(18, Math.max(3, Math.ceil(text.length / 3))),
                        timestamp: nowMsg,
                        replyTo: aiReplyTo,
                        apiRunId
                    }
                    : isImageReply
                    ? {
                        id: window.imChat.createMessageId('img'),
                        role: 'assistant',
                        type: 'image',
                        content: window.imChat.CHAT_IMAGE_PLACEHOLDER_URL || 'assets/imessage/chat-image-placeholder.jpg',
                        text,
                        description: currentItem.description || text,
                        imageSource: 'char',
                        timestamp: nowMsg,
                        replyTo: aiReplyTo,
                        apiRunId
                    }
                    : { id: window.imChat.createMessageId('msg'), role: 'assistant', content: text, timestamp: nowMsg, replyTo: aiReplyTo, apiRunId };
                if (currentSpeakerName) msgObj.speaker = currentSpeakerName;
                if (currentSpeakerAvatar) msgObj.senderAvatarUrl = currentSpeakerAvatar;
                if (speakerFriend.type === 'group' && detectedSpeaker?.id != null) {
                    msgObj.speakerMemberId = detectedSpeaker.id;
                }
                if (speakerFriend.type === 'group' && currentItem.thought) {
                    msgObj.thought = currentItem.thought;
                }
                if (itemTranslation) {
                    msgObj.translation = itemTranslation;
                    msgObj.showTranslation = false;
                }

                // Only attempt to render bubble if user is STILL in this chat
                const freshContainer = getSafeContainer();
                const renderFriend = getLiveFriendById(friend.id) || friend;
                const isUserStillLooking = window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(renderFriend.id) && freshContainer;

                if (isUserStillLooking && isStickerReply && window.imChat.renderStickerMessageBubble) {
                    window.imChat.renderStickerMessageBubble(msgObj, renderFriend, freshContainer, nowMsg);
                } else if (isUserStillLooking && isVoiceReply && window.imChat.renderVoiceMessageBubble) {
                    window.imChat.renderVoiceMessageBubble(msgObj, renderFriend, freshContainer, nowMsg);
                } else if (isUserStillLooking && isImageReply && window.imChat.renderImageBubble) {
                    window.imChat.renderImageBubble(msgObj, renderFriend, freshContainer, nowMsg);
                } else if (isUserStillLooking) {
                    window.imChat.renderAiBubble(text, renderFriend, freshContainer, nowMsg, msgObj.translation, msgObj.showTranslation, msgObj.replyTo, currentSpeakerName, currentSpeakerAvatar, msgObj.id, msgObj.thought, msgObj.offlineScene, msgObj.offlineAction, msgObj.speakerMemberId);
                } else if (window.showBannerNotification) {
                    // Not looking at chat, show banner for this specific message bubble
                    window.showBannerNotification(renderFriend, isStickerReply ? `[表情] ${resolvedSticker.stickerName}` : (isImageReply ? `[图片] ${text}` : text));
                }

                const appended = window.imApp.appendFriendMessage
                    ? await window.imApp.appendFriendMessage(renderFriend.id || friend.id, msgObj, { silent: true })
                    : false;

                if (!appended) {
                    const rollbackContainer = getSafeContainer();
                    const rollbackFriend = getLiveFriendById(friend.id) || friend;
                    if (rollbackContainer && window.imChat.rerenderChatContainer) {
                        window.imChat.rerenderChatContainer(rollbackFriend, rollbackContainer, { scroll: true });
                    }
                    if (!options.silent && window.showToast) window.showToast('AI 消息保存失败');
                    if (btnEl) btnEl.style.opacity = '1';
                    return false;
                }

                qIndex++;
                return true;
            }

            while (qIndex < queueItems.length) {
                const processed = await processNextSentence();
                if (!processed) {
                    return;
                }
            }

            const appendAndRenderGroupNotice = async (noticeKind, content, extra = {}) => {
                const liveGroup = getLiveFriendById(friend.id) || friend;
                if (!liveGroup || liveGroup.type !== 'group' || !window.imApp.appendFriendMessage) return false;
                const noticeTimestamp = Date.now();
                const noticeMessage = {
                    id: window.imChat.createMessageId('notice'),
                    role: 'system',
                    type: 'system_notice',
                    noticeKind,
                    content,
                    text: content,
                    timestamp: noticeTimestamp,
                    apiRunId,
                    ...extra
                };
                const appended = await window.imApp.appendFriendMessage(liveGroup.id, noticeMessage, { silent: true });
                if (!appended) return false;

                const freshGroup = getLiveFriendById(friend.id) || liveGroup;
                const activeContainer = getSafeContainer();
                const isGroupActive = window.imData.currentActiveFriend
                    && String(window.imData.currentActiveFriend.id) === String(freshGroup.id);
                if (isGroupActive && activeContainer && window.imChat.renderSystemNoticeBubble) {
                    window.imChat.renderSystemNoticeBubble(noticeMessage, freshGroup, activeContainer, noticeTimestamp);
                }
                return true;
            };

            if (friend.type === 'group' && groupPrivateMessageBatches.length > 0) {
                let privateMessageSaveFailed = false;
                let privateMessageAppendedTotal = 0;

                for (const batch of groupPrivateMessageBatches) {
                    if (!isConversationCurrent()) return;
                    const targetFriend = getLiveFriendById(batch.member.id) || batch.member;
                    if (!targetFriend || targetFriend.type === 'group' || targetFriend.type === 'official') continue;

                    let appendedCount = 0;
                    for (let index = 0; index < batch.messages.length; index += 1) {
                        if (!isConversationCurrent()) return;
                        const privateItem = batch.messages[index];
                        const timestamp = Date.now() + index;
                        const privateMsg = {
                            id: window.imChat.createMessageId('msg'),
                            role: 'assistant',
                            content: privateItem.text,
                            text: privateItem.text,
                            timestamp,
                            sourceGroupId: friend.id,
                            sourceGroupName: friend.nickname || friend.realName || '',
                            sourceApiRunId: apiRunId,
                            privateFromGroup: true,
                            payload: {
                                sourceGroupId: friend.id,
                                sourceGroupName: friend.nickname || friend.realName || '',
                                sourceApiRunId: apiRunId,
                                privateFromGroup: true
                            }
                        };
                        if (privateItem.translation) {
                            privateMsg.translation = privateItem.translation;
                            privateMsg.showTranslation = false;
                        }

                        const appended = window.imApp.appendFriendMessage
                            ? await window.imApp.appendFriendMessage(targetFriend.id, privateMsg, { silent: true })
                            : false;
                        if (!appended) {
                            privateMessageSaveFailed = true;
                            console.warn('[iMessage] Failed to persist a group-derived private message', {
                                groupId: friend.id,
                                memberId: targetFriend.id,
                                apiRunId
                            });
                            continue;
                        }
                        appendedCount += 1;
                        privateMessageAppendedTotal += 1;
                    }

                    const liveTargetFriend = getLiveFriendById(targetFriend.id) || targetFriend;
                    const isTargetChatActive = window.imData.currentActiveFriend
                        && String(window.imData.currentActiveFriend.id) === String(liveTargetFriend.id);
                    if (appendedCount > 0 && isTargetChatActive && window.imChat.rerenderChatContainer) {
                        const targetPage = document.getElementById(`chat-interface-${liveTargetFriend.id}`);
                        const targetContainer = targetPage ? targetPage.querySelector('.ins-chat-messages') : null;
                        if (targetContainer) {
                            window.imChat.rerenderChatContainer(liveTargetFriend, targetContainer, { scroll: true });
                        }
                    }
                }

                if (privateMessageAppendedTotal > 0) {
                    const noticeSaved = await appendAndRenderGroupNotice(
                        'group_private_to_user',
                        '有人给你发了私信'
                    );
                    if (!noticeSaved) privateMessageSaveFailed = true;
                }

                if (privateMessageSaveFailed && !options.silent && window.showToast) {
                    window.showToast('部分群成员私信保存失败');
                }
            }

            if (friend.type === 'group' && groupFriendPrivateChats.length > 0) {
                let friendPrivateChatSaveFailed = false;

                for (const privateChat of groupFriendPrivateChats) {
                    if (!isConversationCurrent()) return;
                    const sender = getLiveFriendById(privateChat.member.id) || privateChat.member;
                    const recipient = privateChat.recipient;
                    if (!sender || !recipient) continue;

                    const normalizedExistingChats = window.imApp.normalizeLinkedAccountChats
                        ? window.imApp.normalizeLinkedAccountChats(sender.linkedAccountChats)
                        : (Array.isArray(sender.linkedAccountChats) ? sender.linkedAccountChats : []);
                    const sourceNpcId = recipient.kind === 'contact'
                        ? String(recipient.id || '')
                        : String(recipient.sourceNpcId || '');
                    const existingThread = recipient.kind === 'linked'
                        ? normalizedExistingChats.find(chat => String(chat.id) === String(recipient.linkedChatId || recipient.id))
                        : (sourceNpcId
                            ? normalizedExistingChats.find(chat => String(chat.sourceNpcId || '') === sourceNpcId)
                            : null);
                    const linkedChatId = existingThread?.id || recipient.linkedChatId || window.imChat.createMessageId('linked-chat');
                    const senderName = sender.nickname || sender.realName || '群成员';
                    const recipientName = recipient.remark || recipient.name || recipient.realName || '好友';
                    const relationship = String(recipient.relationship || '').trim();
                    const snapshotMessages = [];

                    privateChat.rounds.forEach((round, roundIndex) => {
                        round.speakerMessages.forEach((message, messageIndex) => {
                            const snapshotMessage = {
                                id: window.imChat.createMessageId('linked-msg'),
                                role: 'char',
                                text: message.text,
                                round: roundIndex + 1,
                                orderInTurn: messageIndex
                            };
                            if (message.translation) snapshotMessage.translation = message.translation;
                            snapshotMessages.push(snapshotMessage);
                        });
                        round.friendMessages.forEach((message, messageIndex) => {
                            const snapshotMessage = {
                                id: window.imChat.createMessageId('linked-msg'),
                                role: 'account',
                                text: message.text,
                                round: roundIndex + 1,
                                orderInTurn: messageIndex
                            };
                            if (message.translation) snapshotMessage.translation = message.translation;
                            snapshotMessages.push(snapshotMessage);
                        });
                    });

                    const saved = window.imApp.commitFriendChange
                        ? await window.imApp.commitFriendChange(sender.id, (targetSender) => {
                            if (!targetSender) return;
                            targetSender.linkedAccountChats = window.imApp.normalizeLinkedAccountChats
                                ? window.imApp.normalizeLinkedAccountChats(targetSender.linkedAccountChats)
                                : (Array.isArray(targetSender.linkedAccountChats) ? targetSender.linkedAccountChats : []);

                            let targetThread = recipient.kind === 'linked'
                                ? targetSender.linkedAccountChats.find(chat => String(chat.id) === String(linkedChatId))
                                : (sourceNpcId
                                    ? targetSender.linkedAccountChats.find(chat => String(chat.sourceNpcId || '') === sourceNpcId)
                                    : null);
                            if (!targetThread) {
                                const now = Date.now();
                                targetThread = {
                                    id: linkedChatId,
                                    name: recipientName,
                                    realName: recipient.realName || recipientName,
                                    remark: recipient.remark || recipientName,
                                    persona: String(recipient.persona || '').trim(),
                                    relationship,
                                    avatarSeed: String(recipient.avatarSeed || sourceNpcId || recipientName),
                                    sourceNpcId,
                                    messages: [],
                                    createdAt: now,
                                    updatedAt: now,
                                    readAt: 0
                                };
                                targetSender.linkedAccountChats.unshift(targetThread);
                            }

                            const existingMessages = Array.isArray(targetThread.messages) ? targetThread.messages : [];
                            const lastTimestamp = existingMessages.length > 0
                                ? Number(existingMessages[existingMessages.length - 1]?.timestamp) || 0
                                : 0;
                            const baseTimestamp = Math.max(Date.now(), lastTimestamp + 1);
                            snapshotMessages.forEach((message, index) => {
                                message.timestamp = baseTimestamp + index;
                            });
                            targetThread.messages = existingMessages.concat(snapshotMessages.map(message => ({ ...message })));
                            targetThread.updatedAt = snapshotMessages[snapshotMessages.length - 1]?.timestamp || baseTimestamp;
                            if (!targetThread.relationship && relationship) targetThread.relationship = relationship;
                        }, { silent: true, metaOnly: true })
                        : false;

                    if (!saved) {
                        friendPrivateChatSaveFailed = true;
                        console.warn('[iMessage] Failed to persist a group member friend chat', {
                            groupId: friend.id,
                            senderId: sender.id,
                            recipientId: recipient.id || recipient.linkedChatId || recipientName,
                            apiRunId
                        });
                        continue;
                    }

                    window.dispatchEvent(new CustomEvent('u2:linked-accounts-changed', {
                        detail: { friendId: String(sender.id), changedCount: snapshotMessages.length }
                    }));

                    const noticeSaved = await appendAndRenderGroupNotice(
                        'group_friend_private_chat',
                        '有人给 TA 的好友发了私信',
                        {
                            payload: {
                                privateChatSnapshot: {
                                    senderId: String(sender.id),
                                    senderName,
                                    recipientId: sourceNpcId,
                                    recipientName,
                                    linkedChatId,
                                    messages: snapshotMessages.map(message => ({ ...message }))
                                }
                            }
                        }
                    );
                    if (!noticeSaved) friendPrivateChatSaveFailed = true;
                }

                if (friendPrivateChatSaveFailed && !options.silent && window.showToast) {
                    window.showToast('部分成员好友私聊保存失败');
                }
            }

            if (!isConversationCurrent()) return;
            const latestFriend = getLiveFriendById(friend.id) || friend;
            const redPacketChanged = latestFriend.type === 'group'
                ? window.imChat.processPendingGroupRedPackets(latestFriend)
                : false;

            if (redPacketChanged) {
                scheduleFriendPersistence(latestFriend.id || friend.id, {
                    delay: 1200,
                    silent: true
                });

                const latestContainer = getSafeContainer();
                const isActiveChat = window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(latestFriend.id);

                if (isActiveChat && latestContainer && window.imChat.rerenderChatContainer) {
                    window.imChat.rerenderChatContainer(latestFriend, latestContainer, { scroll: true });
                }
            }

            await flushFriendPersistence(latestFriend.id || friend.id, { silent: true });
            if (window.imChat?.maybeAutoSummarize) {
                void window.imChat.maybeAutoSummarize(latestFriend.id || friend.id);
            }
            if (btnEl) btnEl.style.opacity = '1';

            if (window.imApp.updateChatsView && (!window.imData.currentActiveFriend || String(window.imData.currentActiveFriend.id) !== String(latestFriend.id))) {
                window.imApp.updateChatsView();
            }

        } catch (error) {
            if (typingRow && typingRow.parentNode) typingRow.remove();
            if (!isConversationCurrent()) return;

            const isTimeout = error && error.name === 'AbortError';
            const message = isTimeout
                ? 'API 请求超时，请检查接口地址/网络/模型'
                : `API 请求失败${error && error.message ? `：${error.message}` : ''}`;

            if (!options.silent && window.showToast) window.showToast(message);
            console.error('[iMessage API] request failed', error);
            if (btnEl) btnEl.style.opacity = '1';
        } finally {
            if (aiReplyControllers.get(friendKey) === requestController) {
                aiReplyControllers.delete(friendKey);
                aiReplyInFlight.delete(friendKey);
            }
        }
    }

    async function regenerateLastAiReply(friend, triggerEl = null, options = {}) {
        const friendKey = getFriendKey(friend);
        if (!friendKey) return false;
        const normalizedOptions = options && typeof options === 'object' ? options : {};
        const userRequirement = String(normalizedOptions.userRequirement || '').trim().slice(0, 800);

        if (aiReplyInFlight.has(friendKey)) {
            if (window.showToast) window.showToast('正在生成中');
            return false;
        }

        const liveFriend = getLiveFriendById(friendKey) || friend;
        if (liveFriend && window.imApp.ensureFriendMessagesLoaded) {
            await window.imApp.ensureFriendMessagesLoaded(liveFriend);
        }
        const messages = Array.isArray(liveFriend?.messages) ? liveFriend.messages : [];
        
        let lastGeneratedIndex = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i] && messages[i].apiRunId) {
                lastGeneratedIndex = i;
                break;
            }
        }

        if (lastGeneratedIndex === -1) {
            if (window.showToast) window.showToast('暂无可重回的回复');
            return false;
        }

        let hasUserMessageAfter = false;
        for (let i = lastGeneratedIndex + 1; i < messages.length; i++) {
            if (messages[i] && messages[i].role === 'user') {
                hasUserMessageAfter = true;
                break;
            }
        }

        if (hasUserMessageAfter) {
            if (window.showToast) window.showToast('已回复，无法重回上一轮');
            return false;
        }

        const lastGeneratedMessage = messages[lastGeneratedIndex];
        const targetRunId = String(lastGeneratedMessage.apiRunId);
        const targetMessages = messages.filter((msg) => msg && String(msg.apiRunId) === targetRunId);
        const previousReply = targetMessages
            .map((msg) => {
                if (!msg) return '';
                if (msg.type === 'sticker') return `[表情] ${msg.stickerCategory ? `${msg.stickerCategory} / ` : ''}${msg.stickerName || msg.text || ''}`.trim();
                if (msg.type === 'image') return `[图片] ${msg.description || msg.content || msg.text || ''}`.trim();
                if (msg.type === 'fake_link') {
                    const link = msg.fakeLinkData || {};
                    return `[假链接] ${link.siteName || '假网页'}：${link.title || msg.content || ''}`.trim();
                }
                if (msg.type === 'voice_message') return `[语音] ${msg.transcript || msg.content || msg.text || ''}`.trim();
                if (msg.type === 'pay_transfer') return `[支付] ${msg.description || msg.content || ''}`.trim();
                return String(msg.content || msg.text || msg.description || '').trim();
            })
            .filter(Boolean)
            .join('\n')
            .slice(0, 1200);

        if (targetMessages.length === 0) {
            if (window.showToast) window.showToast('暂无可重回的回复');
            return false;
        }

        const page = document.getElementById(`chat-interface-${friendKey}`);
        const container = page ? page.querySelector('.ins-chat-messages') : null;

        if (!container) {
            if (window.showToast) window.showToast('重回失败');
            return false;
        }

        const descriptors = targetMessages.map((msg) => ({
            id: msg.id || null,
            timestamp: msg.timestamp || null
        }));

        const saved = window.imApp.removeFriendMessages
            ? await window.imApp.removeFriendMessages(friendKey, descriptors, { silent: true })
            : (window.imApp.commitFriendChange
                ? await window.imApp.commitFriendChange(friendKey, (targetFriend) => {
                    if (!targetFriend || !Array.isArray(targetFriend.messages)) return;
                    targetFriend.messages = targetFriend.messages.filter((msg) => !msg || String(msg.apiRunId) !== targetRunId);
                    if (window.imApp.reindexFriendMessages) window.imApp.reindexFriendMessages(targetFriend);
                    if (window.imApp.syncActiveFriendReference) window.imApp.syncActiveFriendReference(targetFriend);
                }, { silent: true, metaOnly: false, includeMessages: true })
                : false);

        if (!saved) {
            if (window.showToast) window.showToast('重回失败');
            return false;
        }

        const rollbackMessages = targetMessages
            .map((msg) => msg && msg.rollbackSourceMessage)
            .filter(Boolean);
        if (rollbackMessages.length > 0 && window.imApp.updateFriendMessage) {
            for (const rollbackMsg of rollbackMessages) {
                await window.imApp.updateFriendMessage(friendKey, {
                    id: rollbackMsg.id || null,
                    timestamp: rollbackMsg.timestamp || null
                }, (targetMsg) => {
                    if (!targetMsg) return;
                    Object.keys(targetMsg).forEach((key) => delete targetMsg[key]);
                    Object.assign(targetMsg, JSON.parse(JSON.stringify(rollbackMsg)));
                }, { silent: true });
            }
        }

        const latestFriend = getLiveFriendById(friendKey) || liveFriend;
        if (window.imChat.rerenderChatContainer) {
            window.imChat.rerenderChatContainer(latestFriend, container, { scroll: true });
        }

        latestFriend.pendingRegenerateContext = userRequirement
            ? { previousReply, userRequirement }
            : { previousReply };
        try {
            await handleAiReply(latestFriend, container, triggerEl);
            return true;
        } finally {
            const finalFriend = getLiveFriendById(friendKey) || latestFriend;
            if (finalFriend && finalFriend.pendingRegenerateContext) {
                delete finalFriend.pendingRegenerateContext;
            }
        }
    }

    window.imChat.handleSend = handleSend;
    window.imChat.extractTaggedBlock = extractTaggedBlock;
    window.imChat.removeTaggedBlock = removeTaggedBlock;
    window.imChat.parseJsonArrayFromText = parseJsonArrayFromText;
    window.imChat.normalizeProfilePanelPayload = normalizeProfilePanelPayload;
    window.imChat.handleAiReply = handleAiReply;
    window.imChat.invalidateFriendConversation = invalidateFriendConversation;
    window.imChat.regenerateLastAiReply = regenerateLastAiReply;
    window.imChat.runLinkedAccountBotNow = runLinkedAccountBotNow;
    window.imChat.runAutonomousActivityForFriend = runAutonomousActivityForFriend;
    window.imChat.runAutonomousMomentForFriend = runAutonomousMomentForFriend;
    window.imChat.refreshAutonomousActivityTimers = refreshAutonomousActivityTimers;

    window.addEventListener('u2:background-activity-tick', () => {
        void checkAutonomousActivities('background-tick');
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) void checkAutonomousActivities('visibility');
    });
    window.addEventListener('pageshow', () => {
        void checkAutonomousActivities('pageshow');
    });
    setInterval(() => {
        void checkAutonomousActivities('interval');
    }, 60000);
    setTimeout(() => {
        void checkAutonomousActivities('startup');
    }, 3000);

});
