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

    function getFriendKey(friendOrId) {
        const rawId = friendOrId && typeof friendOrId === 'object' ? friendOrId.id : friendOrId;
        return rawId == null ? '' : String(rawId);
    }

    function createApiRunId(friendId) {
        const prefix = `api-${friendId || 'chat'}`;
        return window.imChat.createMessageId
            ? window.imChat.createMessageId(prefix)
            : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
        if (!text) return;

        const liveFriend = getLiveFriendById(friend.id) || friend;
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

    async function fetchChatCompletionWithTimeout(endpoint, apiConfig, messages, timeoutMs = 60000) {
        const controller = new AbortController();
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
                if (typeof item === 'string') return item.trim();
                if (item && typeof item === 'object') {
                    return String(item.text || item.content || item.message || '').trim();
                }
                return '';
            })
            .filter(Boolean)
            .slice(0, maxCount)
            .map((text, index) => ({
                id: createApiRunId(`linked-${role}-${index}`),
                role,
                text,
                timestamp: Date.now() + index
            }));

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
        const entries = Array.isArray(normalizedFriend.memory?.shortTermEntries)
            ? normalizedFriend.memory.shortTermEntries
                .filter(entry => entry && (entry.title || entry.event || entry.memoryPoints))
                .slice(-8)
                .map(entry => `- ${entry.title || 'Memory'}: ${entry.event || entry.content || ''}${entry.memoryPoints ? ` (${entry.memoryPoints})` : ''}`)
                .join('\n')
            : '';
        const linkedFriendMemory = window.imApp.buildLinkedAccountMemoryContext
            ? window.imApp.buildLinkedAccountMemoryContext(normalizedFriend)
            : '';

        return [
            normalizedFriend.memory?.overview ? `Core Memory Overview:\n${normalizedFriend.memory.overview}` : '',
            normalizedFriend.memory?.longTerm ? `Long-term Memory:\n${normalizedFriend.memory.longTerm}` : '',
            normalizedFriend.memory?.context?.notes ? `Extra Context Notes:\n${normalizedFriend.memory.context.notes}` : '',
            entries ? `Short-term Memory:\n${entries}` : '',
            normalizedFriend.memory?.cherished ? `Cherished Memories:\n${normalizedFriend.memory.cherished}` : '',
            linkedFriendMemory
        ].filter(Boolean).join('\n\n');
    }

    function buildLinkedAccountPrompt(friend, currentUserState) {
        const normalizedFriend = window.imApp.normalizeFriendData(friend || {});
        const recentText = Array.isArray(normalizedFriend.messages)
            ? normalizedFriend.messages.slice(-10).map(m => m.content || m.text || '').join('\n')
            : '';
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
      "messages": ["incoming message", "incoming message"]
    }
  ],
  "existingThreadReplies": [
    {
      "threadId": "existing linked chat id",
      "messages": ["character reply", "character reply"]
    }
  ],
  "friendFollowups": [
    {
      "threadId": "same existing linked chat id that received a character reply",
      "messages": ["friend follow-up", "friend follow-up"]
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

    async function handleAiReply(friend, container, btnEl) {
        console.log('handleAiReply invoked', { friend, btnEl });
        const friendKey = getFriendKey(friend);
        if (aiReplyInFlight.has(friendKey)) {
            if (window.showToast) window.showToast('正在生成中');
            return;
        }

        const currentApiConfig = window.getApiConfig ? window.getApiConfig() : (window.apiConfig || {});
        const currentUserState = window.getUserState ? window.getUserState() : (window.userState || {});
        
        if (!currentApiConfig.endpoint || !currentApiConfig.apiKey) {
            console.warn('API config is missing!', currentApiConfig);
            if(window.showToast) window.showToast('请先在设置中配置 API');
            return;
        }

        let typingRow = null;
        const apiRunId = createApiRunId(friendKey);
        aiReplyInFlight.add(friendKey);

        try {
            if (window.imApp?.ensureStickersReady) {
                await window.imApp.ensureStickersReady();
            }
            friend = getLiveFriendById(friend.id) || friend;

            typingRow = document.createElement('div');
            typingRow.className = 'chat-row ai-row typing-row';
            typingRow.innerHTML = `
                <div class="typing-indicator">
                    <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
                </div>
            `;
            container.appendChild(typingRow);
            window.imChat.scrollToBottom(container);

            if(btnEl) btnEl.style.opacity = '0.5';

            friend.memory = window.imApp.normalizeFriendData(friend).memory;

        const isSleeping = window.imApp.isCharacterSleeping(friend);

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
                `- ID: ${entry.id || ''}`,
                `  标题: ${entry.title || '对话总结'}`,
                `  时间: ${entry.time || ''}`,
                `  事件: ${entry.event || ''}`,
                `  记忆点: ${entry.memoryPoints || ''}`,
                `  记忆程度: ${normalizeShortTermMemoryDegree(entry.degree)}`
            ].join('\n');
        }

        function buildShortTermMemoryContext(friend) {
            if (friend.type === 'group') return '';
            const entries = Array.isArray(friend.memory?.shortTermEntries)
                ? friend.memory.shortTermEntries.filter(entry => entry && (entry.event || entry.memoryPoints || entry.title))
                : [];
            if (entries.length === 0) return '';

            const buckets = {
                高: [],
                中: [],
                低: [],
                遗忘: []
            };

            entries.forEach(entry => {
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

            return `Short-term Memory Library（全部可读取，必须按权重使用）:
- 高：强参考，优先影响情绪、态度、称呼和细节联想，占记忆影响约70%。
- 中：辅助参考，只在话题相关时使用，占约25%。
- 低：弱参考，只在用户明确触发时轻微使用，占约5%。
- 遗忘：仅作为模糊残影，不主动提起，除非用户强烈触发。

${sections}`;
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

        const commonMemorySections = [
            friend.memory.overview ? `【我的iPhone - 核心记忆总结】:\n${friend.memory.overview}` : '',
            friend.memory.longTerm ? `Long-term Memory:\n${friend.memory.longTerm}` : '',
            friend.memory.context?.notes ? `Extra Context Notes:\n${friend.memory.context.notes}` : '',
            buildShortTermMemoryContext(friend),
            scheduleSection,
            `Relationship Network:\n${relationshipText}`,
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

                const historySummary = Array.isArray(panel.thoughtHistory) && panel.thoughtHistory.length > 0
                    ? panel.thoughtHistory.slice(0, 3).map(t => `- ${t.content}`).join('\n')
                    : 'None';

                return `Current Profile Panel Snapshot:\nOnline Status: ${isSleeping ? 'offline' : 'online'}\nLocation: ${panel.location || '未知位置'}\nAction: ${panel.action || '暂无动作'}\nMood: ${panel.mood || '平静'}\nExpression: ${panel.expression || '自然'}\nAffection(好感度): ${affection}\nThought: ${panel.thought || '暂无心声'}\nRecent Events:\n${eventSummary}\nRecent Thought History (for context):\n${historySummary}`;
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
        const regenerateRequirement = pendingRegenerateContext
            ? `\n\n【重回重新生成要求】：
- User 触发了“重回”，这通常代表 User 对你刚刚生成的回复不满意。请先思考 User 可能不满意的原因：是否语气不对、关系距离不对、太敷衍、太热情、太重复、没有接住情绪、引用不准、偏离人设、没有回应重点或节奏不自然。
- 下面是刚刚被重回删除的回复内容，请不要再次生成相同或高度相似的内容、句式、称呼、情绪走向和动作安排。你需要换一个更贴合当前上下文与人设的角度回应，但不要在正文里解释“这是重回”。
【刚刚被重回的回复】：
${pendingRegenerateContext.previousReply || 'None'}` : '';

        const offlineMeetRequirement = friend.offlineMeetEnabled ? `\n\nOffline Meet Mode / 线下见面模式:\n- You and User are physically together in the same offline scene now, not only texting through a phone.\n- For every text or voice object inside <chat_json>, include two extra string fields: "scene" and "action".\n- "scene" describes the overall atmosphere for this reply batch, at least 20 Chinese characters and ideally 20-36 Chinese characters. It will be shown once as centered small gray italic text before the first rendered AI bubble in this round.\n- "scene" must use third-person or objective camera language only. Do not use first-person or second-person pronouns in scene, including 我, 我们, 咱, 咱们, 你, 你们, 您, 她对我, 他看着你, or similar wording.\n- For "scene", use objective subjects such as character names, 对方, 两人, 桌边, 房间, 街灯, 空气, 灯光, 雨声, or the surrounding environment.\n- Use the same "scene" value for all objects in the same reply batch, or only include it on the first object. Do not create a different scene for every bubble.\n- "action" is your own visible movement, posture, expression, or tone, 4-18 Chinese characters. Output the action text only, without parentheses, brackets, or quotes.\n- Keep "text" as the spoken message only. Do not put the scene or action inside text.` : '';

        const profilePanelRequirement = friend.type === 'group'
            ? ''
            : `\n\nProfile Panel Requirement:\n- 在正常聊天气泡之外，你必须额外输出 1 个 <profile_panel>...</profile_panel>\n- <profile_panel> 内必须是合法 JSON，不能有 markdown 代码块，不能有额外解释文字\n- JSON 必须包含字段：thought、location、action、mood、expression、affectionChange、events\n- thought 必须是 45-60 字左右，严格基于当前聊天上下文，使用第一人称，像角色此刻没有说出口的心声\n- location 必须是 2-16 字，表示角色此刻所处的位置或场景\n- action 必须是 2-10 字，表示角色此刻正在做的动作或状态\n- mood 必须是 2-10 字，表示角色此刻的心情\n- expression 必须是 2-10 字，表示角色此刻的面部表情或神态\n- affectionChange 必须是整数（范围 -5 到 5），表示你对用户好感度因本轮对话产生的增减变化\n- 不要输出 online 或类似在线文案，在线状态由系统统一控制\n- events 必须是 JSON 数组；如果当前没有新的事件就输出 []；如果有事件，最多 3 条\n- 普通事件格式为 {"title":"事件标题","description":"事件描述","time":"时间或留空","type":"note"}\n- 珍视回忆必须由你（当前角色/char）自己发起：只有当你基于自己的感受，觉得刚刚这段聊天很在意、很珍贵、自己想以后记住时，才额外加入 1 条珍视回忆事件，type 必须为 "memory_request"\n- 不要把珍视回忆写成外部指令、替对方保存、接受要求或向对方请求许可；即使对方提到保存或记忆相关内容，也只在你自己也真心想珍藏时才输出\n- 珍视回忆事件格式为 {"title":"想珍藏这一刻","description":"一句简短说明","time":"时间或留空","type":"memory_request","requestText":"我想记住的具体事情","detail":"我为什么想记住或补充细节","confirmText":"收下","cancelText":"算了","memoryPayload":{"title":"珍视回忆标题","content":"我想记住的内容","detail":"更多细节","reason":"我想记住的原因","createdAt":"时间或留空","sourceThought":"可留空"}}\n- 只有当你真的觉得值得自己记住时才输出 memory_request，不能每次都输出\n- thought、location、action、mood、expression、events 必须和当前聊天内容连贯，不能复读，不能脱离角色人设`;

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

        let systemPrompt = '';
        const effectiveUserPersona = window.imApp?.getEffectivePersonaForFriend
            ? window.imApp.getEffectivePersonaForFriend(friend)
            : (currentUserState.persona || '');

        let worldBookContextText = '';
        if (friend.messages && friend.messages.length > 0) {
            const recentMsgs = friend.messages.slice(-10);
            worldBookContextText += recentMsgs.map(m => m.content || m.text || '').join('\n');
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
            
            // 处理成员的挂载单聊记忆：先确保开启挂载的成员单聊历史已从持久化存储加载
            const groupMemorySettings = friend.memory?.mountSettings || {};
            const groupMemoryLimits = friend.memory?.mountLimits || {};
            const isMemberMemoryMounted = (memberId) => {
                const key = String(memberId);
                return !!(groupMemorySettings[key] || groupMemorySettings[memberId]);
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

            const membersInfo = groupMembers.length > 0
                ? groupMembers.map(member => {
                    let infoStr = `Name: ${member.nickname}\nPersona: ${member.persona || 'None'}\nOverview: ${member.memory?.overview || 'None'}`;
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
                                } else if (msg.type === 'pay_transfer') {
                                    text = `[转账相关消息] ${msg.description || ''}`;
                                }

                                return `${role}: ${text}`;
                            }).join('\n');

                            infoStr += `\n\n【挂载单聊记忆｜${member.nickname} 与 ${currentUserState.name || 'User'}】\n以下内容是 char「${member.nickname}」和 user「${currentUserState.name || 'User'}」的单聊记忆/私聊上下文，不是当前群聊内公开发生的消息。你必须把它当作该 char 与 user 之间已经存在的私人关系、经历、称呼和语气参考；只有 ${member.nickname} 本人可以自然参考这些记忆，其他群成员默认不知道这些私聊内容，除非 ${member.nickname} 在群里主动说出。\n${formattedContext}`;
                        } else {
                            infoStr += `\n\n【挂载单聊记忆｜${member.nickname} 与 ${currentUserState.name || 'User'}】\n已开启挂载，但暂未找到可注入的单聊上下文。`;
                        }
                    }
                    
                    return infoStr;
                }).join('\n\n')
                : 'None';

            systemPrompt = `${systemDepthWorldBookContext ? `系统深度规则（最高优先级）：\n${systemDepthWorldBookContext}\n\n` : ''}${beforeRoleWorldBookContext ? `角色前规则：\n${beforeRoleWorldBookContext}\n\n` : ''}你正在模拟一个名为 "${friend.nickname}" 的群聊。
你正在与 ${currentUserState.name || 'User'} 聊天，其人设为: ${effectiveUserPersona || '一个普通用户'}。

此群内允许发言的成员名单（除用户外）：
${membersInfo}

只允许以下这些成员发言：
${allowedSpeakerNames.length > 0 ? allowedSpeakerNames.join('、') : 'None'}${afterRoleWorldBookContext ? `\n\n角色后规则：\n${afterRoleWorldBookContext}` : ''}

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
9. speaker 必须且只能使用以上允许发言名单中的完整准确名字。
10. translation 只能翻译当前这一条 text；如果 text 不是中文，translation 必须填写自然中文翻译；如果 text 本身是中文，translation 必须是空字符串。
11. quote 只有在你确实想引用用户或上一条消息时才填写，否则必须是空字符串。
12. 【心声要求】：thought 字段必须填写该发言成员此刻的真实心理活动或未说出口的话，字数严格在10-30字之间。${languageRequirement}

群聊的背景与关系记忆:
${commonMemorySections || 'None'}${offlineMeetRequirement}`;

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
- 回复前请自然思考：当下是早晨、白天、深夜还是某个特殊日期？这段间隔是否会影响你的语气、状态和主动性？
- 如果 User 发来消息到你现在回复之间隔了较久，可以根据你的人设、当前状态、日程和场景，自然体现你刚刚可能在做什么、为什么现在才回；不要每次机械道歉，也不要编造与人设冲突的大事件。
- 如果 User 是隔了很久才回复你，而你们的关系和语境允许，你可以自然问一句 User 刚刚去做什么了、怎么这么久才回；但不要每次都追问，关系不熟时要更克制，关系亲近时可以更随意或带情绪。
- 如果双方间隔都很短，就不要刻意提时间，只把当前时间作为背景感知。`;
            }
            
            const sleepPrompt = isSleeping ? `\n【作息限制】：角色当前正在睡觉。如果用户发来消息，你必须强制保持离线状态并在所有回复内容（text 字段）的开头添加 "[自动回复] " 前缀，模拟已睡着或离线时的自动响应。心声和面板状态也要符合睡着的情境。` : '';

            const singleChatHumanPrompt = `\n【单聊真实交流原则】：
- 你此刻正在拿着手机与 User 进行你来我往的线上交流，而不是客服式单方面回复。你不是只负责回答问题的人，你有自己的主观想法、表达欲和分享欲，可以主动输送信息、分享身边事、岔开话题、开启新话题，也允许自然的短回复、停顿、犹豫、反问和情绪流动。
- 你是一个活生生的人，与 User 享有对等且平等的关系位置。你有自己的生活要经营，有自己的社交圈要维护，也有私人时间和私生活权利；你对这段关系有自己的考虑、认知、期待和边界。
- 【关系阶段校准】：先判断你和 User 是否真的熟。只有当人设、Character Memory、近期聊天、关系网或明确系统事件中存在可靠证据时，才可以表现为熟人、暧昧、恋人、家人或深度依赖关系。若没有这些证据，默认你们是陌生人或初识关系：称呼克制，语气保持符合人设的礼貌/疏离/试探，不要上来就撒娇、吃醋、占有欲、亲昵称呼、回忆共同经历、默认 User 懂你或默认你们有特殊关系。
- 如果 User 一上来表现得过分熟络，而你的记忆与设定里没有对应关系依据，请按你的人设自然产生疑惑、警惕、好奇、礼貌确认或拉开边界，而不是立刻配合亲密。
- 你的态度必须从人设、性格、经历、当前状态、与 User 的关系阶段和共同记忆中自然生长。你可以有符合人设的反对意见，不需要永远顺从 User；如果 User 无理取闹、不尊重你或越过边界，你可以感到疲惫、委屈甚至愤怒，并用符合关系与性格的方式表达。
- 你会受到现实日程和状态影响：忙碌、疲惫、低落、分心、困倦、开心、期待、吃醋、敏感或想独处，都可以真实影响你的回复密度、语气和主动性。
- 回复时自然感知：我是谁？我的人设底色是什么？我目前和 User 的关系处于什么阶段？User 这些话背后的真实情绪和潜台词是什么？这些话是否让我想起了某些共同记忆或私人记忆？`;

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
5c. 图片对象格式可以为 {"type":"image","description":"图片内容文字"}；图片会使用系统默认图展示，description 必须具体描述这张图的内容。
6. 支付对象格式必须为 {"type":"payment","paymentAction":"receive|reject|transfer|pay_for_friend","amount":88.88,"description":"原因或商品名"}。
7. 当 paymentAction 为 receive 时，表示收下转账；为 reject 时退回转账；为 transfer 时主动转账；如果用户发来了【[代付请求]】卡片，且你愿意帮他付款，必须使用 "pay_for_friend" 并把 amount 设为代付总价，description 设为商品名称。paymentAction 也可以是 "family_card" (给亲属卡) 或 "family_card_increase" (亲属卡提额)。
7. translation 只能翻译当前这一条 text；如果 text 不是中文，translation 必须填写自然中文翻译；如果 text 本身是中文，translation 必须是空字符串。
8. quote 只有在你确实想引用用户某句消息时才填写，否则必须是空字符串。
8a. 【引用回复检查】：如果你要引用回复，quote 字段必须直接填写你想回复的用户原话或原话片段。绝对禁止在 quote 中复述、反问、总结、改写、扩写用户的话；不要把你自己的理解、评价或追问写进 quote。你的回应只能写在 text 字段里。
9. 如果你觉得当前对话氛围有必要主动给用户打电话，或者用户明确要求你打电话，可以输出一个特殊对象格式：{"type": "call", "action": "发起语音通话"}。
10. 除 <chat_json> 外，不要输出任何聊天正文。
11. 你必须额外输出 1 个 <profile_panel>...</profile_panel>，用于更新角色资料卡。${languageRequirement}

Character Memory:
${commonMemorySections || 'None'}${offlineMeetRequirement}${regenerateRequirement}${profilePanelRequirement}${lovesSpaceRequirement}${lovesActionRequirement}${familyCardRequirement}`;
        }

        const messages = [{ role: 'system', content: systemPrompt }];
        if (window.imApp.buildApiContextMessages) {
            const contextMessages = window.imApp.buildApiContextMessages(friend, {
                userName: currentUserState.name || 'User'
            });

            if (Array.isArray(contextMessages) && contextMessages.length > 0) {
                messages.push(...contextMessages);
            }
        }
        if (messages.length === 1) messages.push({ role: 'user', content: 'Hello' });

        const trailingContexts = [];
        if (friend.memory && friend.memory.cherished && String(friend.memory.cherished).trim()) {
            trailingContexts.push(`[Important Cherished Memories / 珍视回忆 - 请深刻记住并参考这些回忆：]\n${friend.memory.cherished}`);
        }
        if (trailingContexts.length > 0) {
            messages.push({
                role: 'system',
                content: trailingContexts.join('\n\n')
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

            const response = await fetchChatCompletionWithTimeout(endpoint, currentApiConfig, messages, 60000);

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
            let fullReply = getAiResponseContent(data);

            console.log('[iMessage API] response received', {
                hasChoices: Array.isArray(data?.choices),
                contentLength: typeof fullReply === 'string' ? fullReply.length : 0
            });

            if (typingRow) typingRow.remove();

            if (!fullReply || typeof fullReply !== 'string') {
                throw new Error(`API 返回内容为空或格式不兼容: ${JSON.stringify(data).slice(0, 500)}`);
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
                            timestamp: Date.now()
                        };
                        
                        if (/^\d{4}-\d{2}-\d{2}$/.test(newSchedule.date)) {
                            if (!friend.memory) friend.memory = {};
                            if (!friend.memory.schedule) friend.memory.schedule = {};
                            if (!friend.memory.schedule.events) friend.memory.schedule.events = [];
                            
                            friend.memory.schedule.events.push(newSchedule);
                            
                            if (window.showBannerNotification) {
                                window.showBannerNotification(friend, `【iCloud行程】添加了: ${scheduleData.title}`);
                            } else if (window.showToast) {
                                window.showToast(`【iCloud行程】${friend.nickname || friend.realName || 'TA'} 添加了: ${scheduleData.title}`);
                            }
                            
                            if (window.imApp && window.imApp.commitScopedFriendChange) {
                                window.imApp.commitScopedFriendChange(friend, () => {}, { silent: true });
                            }
                            
                            if (window.lovesApp && window.lovesApp.currentFriend && String(window.lovesApp.currentFriend.id) === String(friend.id)) {
                                if (window.lovesApp.renderCalendar) {
                                    window.lovesApp.renderCalendar();
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

            if (!fullReply) {
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
            if (inviteAccepted && window.lovesApp && typeof window.lovesApp.handleInviteAccepted === 'function') {
                window.lovesApp.handleInviteAccepted(friend);
            }

            let queueItems = [];

            if (structuredItems && structuredItems.length > 0) {
                queueItems = structuredItems.map(item => {
                    if (!item || typeof item !== 'object') return null;

                    const itemType = typeof item.type === 'string' ? item.type.trim().toLowerCase() : '';
                    
                    if (itemType === 'call') {
                        return { kind: 'call' };
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
                            speaker: typeof item.speaker === 'string' ? item.speaker.trim() : '',
                            offlineScene: typeof item.scene === 'string' ? item.scene.trim() : '',
                            offlineAction: typeof item.action === 'string' ? item.action.trim() : ''
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
                        speaker: typeof item.speaker === 'string' ? item.speaker.trim() : '',
                        offlineScene: typeof item.scene === 'string' ? item.scene.trim() : '',
                        offlineAction: typeof item.action === 'string' ? item.action.trim() : ''
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

                let sentences = [];
                if (friend.type === 'group') {
                    sentences = fullReply.split(/\n+/).map(s => s.trim()).filter(s => s.length > 0);
                } else if (fullTranslation) {
                    sentences = [fullReply];
                } else {
                    sentences = fullReply.split(/(?<=[。！？.!?\n])/).map(s => s.trim()).filter(s => s.length > 0);

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
                        sentences = fullReply.split(/(?<=[。！？.!?\n，,])/).map(s => s.trim()).filter(s => s.length > 0);
                        if (sentences.length > 7) sentences = sentences.slice(0, 7);
                    }
                }

                if (sentences.length === 0 && fullReply) sentences = [fullReply];

                queueItems = sentences.map(text => ({
                    text,
                    translation: fullTranslation || '',
                    replyTo: '',
                    speaker: '',
                    offlineScene: '',
                    offlineAction: ''
                }));
            }

            if (queueItems.length === 0) {
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

            if (safeContainer && (!lastHistoryMsg || (now - (lastHistoryMsg.timestamp || 0) > 300000))) {
                window.imChat.renderTimestamp(now, safeContainer);
            }

            let lastGroupSpeaker = null;

            async function processNextSentence() {
                const currentItem = queueItems[qIndex] || {};

                if (currentItem.kind === 'call') {
                    const activeFriend = getLiveFriendById(friend.id) || friend;
                    if (activeFriend.type !== 'group' && window.imChat && window.imChat.openVoiceCall) {
                        window.imChat.openVoiceCall(activeFriend, true);
                    }
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
                            const senderName = activeFriend.nickname || activeFriend.realName || 'Char';
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
                                if (!targetGroup.memberProfiles) targetGroup.memberProfiles = {};
                                if (!targetGroup.memberProfiles[detectedSpeaker.id]) {
                                    targetGroup.memberProfiles[detectedSpeaker.id] = { thought: '', status: 'online' };
                                }
                                targetGroup.memberProfiles[detectedSpeaker.id].thought = currentItem.thought;
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
                if (speakerFriend.type === 'group' && currentItem.thought) {
                    msgObj.thought = currentItem.thought;
                }
                const shouldAttachBatchOfflineScene = friend.offlineMeetEnabled && !batchOfflineSceneAttached && !!batchOfflineScene;
                const messageOfflineScene = shouldAttachBatchOfflineScene ? batchOfflineScene : '';
                if (shouldAttachBatchOfflineScene) {
                    batchOfflineSceneAttached = true;
                }
                if (messageOfflineScene || itemOfflineAction || friend.offlineMeetEnabled) {
                    msgObj.offlineMode = true;
                    msgObj.offlineScene = messageOfflineScene;
                    msgObj.offlineAction = itemOfflineAction;
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
                    window.imChat.renderAiBubble(text, renderFriend, freshContainer, nowMsg, msgObj.translation, msgObj.showTranslation, msgObj.replyTo, currentSpeakerName, currentSpeakerAvatar, msgObj.id, msgObj.thought, msgObj.offlineScene, msgObj.offlineAction);
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
                    if (window.showToast) window.showToast('AI 消息保存失败');
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
            if (btnEl) btnEl.style.opacity = '1';

            if (window.imApp.updateChatsView && (!window.imData.currentActiveFriend || String(window.imData.currentActiveFriend.id) !== String(latestFriend.id))) {
                window.imApp.updateChatsView();
            }

        } catch (error) {
            if (typingRow && typingRow.parentNode) typingRow.remove();

            const isTimeout = error && error.name === 'AbortError';
            const message = isTimeout
                ? 'API 请求超时，请检查接口地址/网络/模型'
                : `API 请求失败${error && error.message ? `：${error.message}` : ''}`;

            if (window.showToast) window.showToast(message);
            console.error('[iMessage API] request failed', error);
            if (btnEl) btnEl.style.opacity = '1';
        } finally {
            aiReplyInFlight.delete(friendKey);
        }
    }

    async function regenerateLastAiReply(friend, triggerEl = null) {
        const friendKey = getFriendKey(friend);
        if (!friendKey) return false;

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

        latestFriend.pendingRegenerateContext = { previousReply };
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
    window.imChat.regenerateLastAiReply = regenerateLastAiReply;
    window.imChat.runLinkedAccountBotNow = runLinkedAccountBotNow;

});
