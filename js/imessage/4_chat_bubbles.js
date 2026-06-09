// ==========================================
// IMESSAGE: 4_chat_bubbles.js
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const { apiConfig, userState } = window;
    window.imChat = window.imChat || {};
    const imChat = window.imChat;
    const INITIAL_HISTORY_USER_ROUNDS = 30;
    const HISTORY_LOAD_MORE_USER_ROUNDS = 10;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, '&#039;');
    }

    function resolvePayTransferParties(msg = {}, friend = null) {
        if (typeof window.imChat.normalizePayTransferMessage === 'function') {
            return window.imChat.normalizePayTransferMessage(msg, friend);
        }

        if (typeof window.imChat.resolvePayTransferParties === 'function') {
            return window.imChat.resolvePayTransferParties(msg, friend);
        }

        const payKind = msg.payKind || (msg.role === 'user' ? 'user_to_char' : 'char_received');
        const userName = userState?.name || userState?.realName || userState?.nickname || 'User';
        const charName = msg.speaker || msg.charName || friend?.nickname || friend?.realName || friend?.name || 'Char';
        const targetName = msg.targetName || '';
        const charToUserKinds = ['char_to_user_pending', 'char_to_user_claimed', 'user_received_from_char', 'user_rejected_from_char'];
        const claimedKinds = ['char_received', 'char_to_user_claimed', 'user_received_from_char'];
        const rejectedKinds = ['user_to_char_rejected', 'char_to_user_rejected', 'user_rejected_from_char'];
        const direction = msg.payDirection === 'char_to_user' || msg.payDirection === 'user_to_char'
            ? msg.payDirection
            : (charToUserKinds.includes(payKind) ? 'char_to_user' : 'user_to_char');
        let status = rejectedKinds.includes(payKind)
            ? 'rejected'
            : (claimedKinds.includes(payKind) ? 'claimed' : 'pending');
        if (status === 'pending' && msg.claimed) status = 'claimed';
        let payerName = msg.payerName || '';
        let payeeName = msg.payeeName || '';

        if (direction === 'char_to_user') {
            payerName = payerName || msg.senderName || targetName || charName;
            payeeName = payeeName || msg.receiverName || userName;
        } else {
            payerName = payerName || msg.senderName || userName;
            payeeName = payeeName || msg.receiverName || (targetName && targetName !== userName ? targetName : charName);
        }

        const payerType = direction === 'user_to_char' ? 'user' : 'char';
        const payeeType = direction === 'user_to_char' ? 'char' : 'user';

        return {
            payKind,
            direction,
            status,
            payerName,
            payeeName,
            payerType,
            payeeType,
            canCurrentUserClaim: direction === 'char_to_user' && status === 'pending' && !msg.claimed,
            senderName: payerName,
            receiverName: payeeName,
            senderType: payerType,
            receiverType: payeeType,
            isUserSender: payerType === 'user'
        };
    }

    function buildMessageHeaderHtml(isUser, friend, timestamp, speakerName, speakerAvatar, hasPrev) {
        if (!friend || !friend.showAvatar || hasPrev) return '';
        const date = new Date(timestamp);
        const dateStr = date.toLocaleString('en-US', { month: 'long', day: 'numeric' });
        const ampmTimeStr = date.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
        
        if (isUser) {
            const userName = window.userState?.name || window.userState?.realName || 'User';
            const userAvatar = window.userState?.avatarUrl || 'assets/moren.jpg';
            return `
                <div class="chat-message-header user-header" style="display: flex; justify-content: flex-end; width: 100%; margin-bottom: 4px; padding-right: 0px; align-items: flex-start;">
                    <div class="chat-header-info" style="display: flex; flex-direction: column; align-items: flex-end; justify-content: center; padding-right: 25px; margin-bottom: 0px; margin-right: -20px; padding-bottom: 0px;">
                        <div class="chat-header-name" style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 2px;">${userName}</div>
                        <div class="chat-header-date" style="font-size: 12px; color: #888;">${dateStr} ${ampmTimeStr}</div>
                    </div>
                    <div class="chat-header-avatar" style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; border: 1px solid #eee; z-index: 2; background: #fff; flex-shrink: 0;">
                        <img src="${userAvatar}" onerror="this.src='assets/moren.jpg'" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                </div>
            `;
        } else {
            const aiName = speakerName || friend.nickname || friend.realName || 'AI';
            const aiAvatar = speakerAvatar || friend.avatarUrl || 'assets/moren.jpg';
            return `
                <div class="chat-message-header ai-header" style="display: flex; justify-content: flex-start; width: 100%; margin-bottom: 4px; padding-left: 0px; align-items: flex-start;">
                    <div class="chat-header-avatar" style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; border: 1px solid #eee; z-index: 2; background: #fff; flex-shrink: 0;">
                        <img src="${aiAvatar}" onerror="this.src='assets/moren.jpg'" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div class="chat-header-info" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding-left: 25px; margin-bottom: 0px; margin-left: -20px; padding-bottom: 0px;">
                        <div class="chat-header-name" style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 2px;">${aiName}</div>
                        <div class="chat-header-date" style="font-size: 12px; color: #888;">${dateStr} ${ampmTimeStr}</div>
                    </div>
                </div>
            `;
        }
    }

function renderSystemNoticeBubble(msg, friend, container, timestamp = Date.now()) {
        const row = document.createElement('div');
        row.className = 'chat-system-row';
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'notice'));
        row.innerHTML = `
            <div style="width:100%; display:flex; justify-content:center; padding:2px 0;">
                <div style="max-width:80%; padding:7px 12px; border-radius:999px; background:rgba(142,142,147,0.16); color:#8e8e93; font-size:12px; line-height:1.35; text-align:center;">
                    ${msg.text || '系统提示'}
                </div>
            </div>
        `;
        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

function renderGroupRedPacketBubble(msg, friend, container, timestamp = Date.now()) {
        window.imChat.normalizeGroupRedPacketState(msg, friend);

        const isUser = msg.role === 'user';
        const isGroupMessage = friend.type === 'group' && !isUser;
        const speakerName = msg.senderName || msg.speaker || '群成员';
        const speakerAvatar = msg.senderAvatarUrl || null;

        const lastRow = container.lastElementChild;
        let hasPrev = false;
        let sameSpeaker = false;

        if (lastRow) {
            if (isUser && lastRow.classList.contains('user-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            } else if (!isUser && lastRow.classList.contains('ai-row')) {
                const prevSpeaker = lastRow.getAttribute('data-speaker') || null;
                if (isGroupMessage) {
                    if (prevSpeaker === speakerName) {
                        hasPrev = true;
                        sameSpeaker = true;
                        lastRow.classList.add('has-next');
                    }
                } else if (!prevSpeaker) {
                    hasPrev = true;
                    sameSpeaker = true;
                    lastRow.classList.add('has-next');
                }
            }
        }

        const row = document.createElement('div');
        row.className = `chat-row ${isUser ? 'user-row' : 'ai-row'} ${hasPrev ? 'has-prev' : ''} ${isGroupMessage ? 'group-ai-row' : ''} ${isGroupMessage && sameSpeaker ? 'group-ai-row-continuous' : ''}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'packet'));
        if (speakerName) {
            row.setAttribute('data-speaker', speakerName);
        }

        const totalAmount = Number(msg.totalAmount) || 0;
        const packetCount = parseInt(msg.packetCount, 10) || 0;
        const claimedCount = Array.isArray(msg.claimRecords) ? msg.claimRecords.length : 0;
        const subtitle = msg.currentUserClaimed
            ? `已领取 · ${claimedCount}/${packetCount}`
            : (msg.isFinished ? `${claimedCount}/${packetCount} 已领取` : '点击领取红包');

        const contentHtml = `
            <div class="group-red-packet-card" style="width:100%; min-width:0; max-width:268px; border-radius:18px; padding:12px 14px; background:#fff; color:#111;  border:1px solid rgba(0,0,0,0.08); cursor:pointer;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:40px; height:40px; border-radius:14px; background:#111; color:#fff; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;">
                        <i class="fas fa-gift"></i>
                    </div>
                    <div style="min-width:0; flex:1;">
                        <div style="font-size:15px; font-weight:800; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${msg.description || '恭喜发财'}</div>
                        <div style="font-size:12px; color:#8e8e93; margin-top:4px;">${subtitle}</div>
                    </div>
                </div>
                <div style="margin-top:10px; font-size:26px; font-weight:800; color:#111; letter-spacing:0.2px;">¥${totalAmount.toFixed(2)}</div>
            </div>
        `;

        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : (() => {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        })();

        const headerHtml = buildMessageHeaderHtml(isUser, friend, timestamp, speakerName, speakerAvatar, hasPrev);

        if (isUser) {
            const metaHtml = "";
            row.innerHTML = `
                <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                    <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                    ${headerHtml}
                    <div style="display: flex; justify-content: flex-end; align-items: flex-end; width: 100%;">
                        <div class="chat-bubble user-bubble pay-transfer-bubble group-red-packet-bubble" style="padding:6px;">${contentHtml}${metaHtml}</div>
                    </div>
                </div>
            `;
        } else {
            const metaHtml = "";
            
            let bubbleWrapperHtml = '';
            if (isGroupMessage) {
                const avatarInitial = String(speakerName).trim().charAt(0) || '?';
                const avatarImg = speakerAvatar
                    ? `<img src="${speakerAvatar}" onerror="this.src='assets/moren.jpg'" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">`
                    : `<div class="chat-avatar-small">${avatarInitial}</div>`;

                bubbleWrapperHtml = `
                    <div class="group-ai-bubble-wrap">
                        ${sameSpeaker ? '' : `<div class="group-ai-speaker-name">${speakerName}</div>`}
                        <div class="group-ai-bubble-row">
                            <div class="group-ai-avatar-slot">${sameSpeaker ? '<div class="group-ai-avatar-placeholder"></div>' : avatarImg}</div>
                            <div class="chat-bubble ai-bubble pay-transfer-bubble group-red-packet-bubble" style="padding:6px;">${contentHtml}${metaHtml}</div>
                        </div>
                    </div>
                `;
            } else {
                bubbleWrapperHtml = `<div class="chat-bubble ai-bubble pay-transfer-bubble group-red-packet-bubble" style="padding:6px;">${contentHtml}${metaHtml}</div>`;
            }

            row.innerHTML = `
                <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                    <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                    ${headerHtml}
                    <div style="display: flex; justify-content: flex-start; align-items: flex-end; width: 100%;">
                        ${bubbleWrapperHtml}
                    </div>
                </div>
            `;
        }

        const clickableBubble = row.querySelector('.group-red-packet-card');
        if (clickableBubble) {
            clickableBubble.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const activePage = container.closest('.active-chat-interface');
                if (!activePage) return;
                if (!activePage._openGroupRedPacketInteraction) {
                    window.imChat.ensureRedPacketDetailOverlayForExistingPage(activePage, friend);
                }
                if (activePage._openGroupRedPacketInteraction) {
                    activePage._openGroupRedPacketInteraction(msg);
                }
            });
        }

        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

function renderMessageBubble(msg, friend, container, timestamp = Date.now()) {
        if (!msg || !container) return false;

        window.imChat.ensureMessageId(msg, msg.type === 'pay_transfer' ? 'pay' : 'msg');
        const msgTime = timestamp || msg.timestamp || Date.now();

        if (msg.type === 'moment_forward') {
            window.imChat.renderMomentForwardBubble(msg, friend, container, msgTime);
            return true;
        }
        if (msg.type === 'voice_call_record') {
            window.imChat.renderVoiceCallRecordBubble(msg, friend, container, msgTime);
            return true;
        }
        if (msg.type === 'voice_message') {
            window.imChat.renderVoiceMessageBubble(msg, friend, container, msgTime);
            return true;
        }
        if (msg.type === 'sticker') {
            window.imChat.renderStickerMessageBubble(msg, friend, container, msgTime);
            return true;
        }
        if (msg.type === 'image') {
            window.imChat.renderImageBubble(msg, friend, container, msgTime);
            return true;
        }
        if (msg.type === 'pay_transfer') {
            window.imChat.renderPayTransferBubble(msg, friend, container, msgTime);
            return true;
        }
        if (msg.type === 'group_red_packet') {
            window.imChat.renderGroupRedPacketBubble(msg, friend, container, msgTime);
            return true;
        }
        if (msg.type === 'system_notice') {
            window.imChat.renderSystemNoticeBubble(msg, friend, container, msgTime);
            return true;
        }
        if (msg.type === 'html') {
            window.imChat.renderHtmlBubble(msg, friend, container, msgTime);
            return true;
        }
        if (msg.role === 'user') {
            window.imChat.renderUserBubble(msg.content, container, msgTime, msg.replyTo, msg.translation, msg.showTranslation, msg.id, friend);
            return true;
        }
        if (msg.role === 'assistant') {
            let safeSpeakerName = msg.speaker || null;
            let speakerAvatar = null;

            if (friend.type === 'group') {
                const safeSpeaker = window.imChat.getSafeGroupSpeaker(friend, msg.speaker);
                if (safeSpeaker) {
                    safeSpeakerName = safeSpeaker.nickname;
                    speakerAvatar = safeSpeaker.avatarUrl || null;
                } else {
                    safeSpeakerName = null;
                }
            }

            window.imChat.renderAiBubble(
                msg.content,
                friend,
                container,
                msgTime,
                msg.translation,
                msg.showTranslation,
                msg.replyTo,
                safeSpeakerName,
                speakerAvatar,
                msg.id,
                msg.thought || null,
                msg.offlineScene || null,
                msg.offlineAction || null
            );
            return true;
        }

        return false;
    }

    function getMessageUserRoundCount(messages, startIndex = 0, endIndex = null) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        let count = 0;
        const start = Math.max(0, Number(startIndex) || 0);
        const end = Math.min(safeMessages.length, Math.max(start, endIndex == null ? safeMessages.length : Number(endIndex) || safeMessages.length));

        for (let i = start; i < end; i += 1) {
            if (safeMessages[i] && safeMessages[i].role === 'user') count += 1;
        }

        return count;
    }

    function getHistoryStartIndexForUserRounds(messages, userRoundLimit) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const limit = Math.max(0, Number(userRoundLimit) || 0);
        if (limit <= 0 || safeMessages.length === 0) return 0;

        let rounds = 0;
        for (let i = safeMessages.length - 1; i >= 0; i -= 1) {
            if (safeMessages[i] && safeMessages[i].role === 'user') {
                rounds += 1;
                if (rounds >= limit) return i;
            }
        }

        return 0;
    }

    function getExpandedHistoryStartIndex(messages, currentStartIndex, additionalUserRounds) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const currentStart = Math.max(0, Math.min(safeMessages.length, Number(currentStartIndex) || 0));
        const additionalRounds = Math.max(1, Number(additionalUserRounds) || HISTORY_LOAD_MORE_USER_ROUNDS);
        let rounds = 0;

        for (let i = currentStart - 1; i >= 0; i -= 1) {
            if (safeMessages[i] && safeMessages[i].role === 'user') {
                rounds += 1;
                if (rounds >= additionalRounds) return i;
            }
        }

        return 0;
    }

    function getInitialHistoryStartIndex(messages) {
        return getHistoryStartIndexForUserRounds(messages, INITIAL_HISTORY_USER_ROUNDS);
    }

    function clampHistoryStartIndex(messages, startIndex) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        return Math.max(0, Math.min(safeMessages.length, Number(startIndex) || 0));
    }

    function getChatHistoryState(friend, container, messages, options = {}) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const friendId = friend && friend.id != null ? String(friend.id) : '';
        const previousState = container ? container._imHistoryState : null;
        let visibleStartIndex;

        if (options.resetWindow) {
            visibleStartIndex = getInitialHistoryStartIndex(safeMessages);
        } else if (Number.isFinite(Number(options.startIndex))) {
            visibleStartIndex = clampHistoryStartIndex(safeMessages, options.startIndex);
        } else if (previousState && previousState.friendId === friendId && Number.isFinite(Number(previousState.visibleStartIndex))) {
            visibleStartIndex = clampHistoryStartIndex(safeMessages, previousState.visibleStartIndex);
        } else {
            visibleStartIndex = getInitialHistoryStartIndex(safeMessages);
        }

        const state = {
            friendId,
            visibleStartIndex,
            totalMessages: safeMessages.length
        };

        if (container) container._imHistoryState = state;
        return state;
    }

    function renderLoadMoreHistoryControl(friend, container, messages, state) {
        if (!container || !state || state.visibleStartIndex <= 0) return;

        const hiddenMessageCount = state.visibleStartIndex;
        const hiddenUserRounds = getMessageUserRoundCount(messages, 0, state.visibleStartIndex);
        const wrapper = document.createElement('div');
        wrapper.className = 'chat-history-loader';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chat-history-load-more-btn';
        button.innerHTML = `
            <span class="chat-history-load-more-title">查看更多历史记录</span>
            <span class="chat-history-load-more-meta">${hiddenUserRounds}轮 / ${hiddenMessageCount}条更早消息</span>
        `;

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const latestMessages = Array.isArray(friend.messages) ? friend.messages : [];
            const currentState = container._imHistoryState || state;
            const previousScrollHeight = container.scrollHeight;
            const previousScrollTop = container.scrollTop;
            const nextStartIndex = getExpandedHistoryStartIndex(
                latestMessages,
                currentState.visibleStartIndex,
                HISTORY_LOAD_MORE_USER_ROUNDS
            );

            container.innerHTML = '';
            renderChatHistory(friend, container, {
                startIndex: nextStartIndex,
                scroll: false
            });

            const heightDelta = container.scrollHeight - previousScrollHeight;
            container.scrollTop = previousScrollTop + heightDelta;
        });

        wrapper.appendChild(button);
        container.appendChild(wrapper);
    }

    function appendMessageToContainer(friend, container, msg, options = {}) {
        if (!friend || !container || !msg) return false;

        const msgTime = msg.timestamp || Date.now();
        const rows = Array.from(container.children);
        let lastMessageTimestamp = 0;

        for (let i = rows.length - 1; i >= 0; i -= 1) {
            const row = rows[i];
            if (!row || !row.classList || !row.classList.contains('chat-row')) continue;
            lastMessageTimestamp = Number(row.getAttribute('data-timestamp')) || 0;
            if (lastMessageTimestamp) break;
        }

        if (!lastMessageTimestamp || msgTime - lastMessageTimestamp > 300000) {
            window.imChat.renderTimestamp(msgTime, container);
        }

        const rendered = renderMessageBubble(msg, friend, container, msgTime);
        if (rendered && container._imHistoryState && container._imHistoryState.friendId === String(friend.id)) {
            container._imHistoryState.totalMessages = Array.isArray(friend.messages) ? friend.messages.length : container._imHistoryState.totalMessages;
        }
        if (rendered && options.scroll !== false) {
            window.imChat.scrollToBottom(container);
        }
        return rendered;
    }

    function rerenderChatContainer(friend, container, options = {}) {
        if (!friend || !container) return false;
        container.innerHTML = '';
        window.imChat.renderChatHistory(friend, container, {
            resetWindow: !!options.resetWindow,
            scroll: false
        });
        if (options.scroll !== false) {
            window.imChat.scrollToBottom(container);
        }
        return true;
    }

    function findMessageRow(container, descriptor) {
        if (!container || descriptor == null) return null;

        const descriptorId = typeof descriptor === 'object' && descriptor !== null && descriptor.id != null
            ? String(descriptor.id)
            : (typeof descriptor !== 'object' && descriptor != null ? String(descriptor) : null);
        const descriptorTimestamp = typeof descriptor === 'object' && descriptor !== null && descriptor.timestamp != null
            ? String(descriptor.timestamp)
            : null;

        if (descriptorId) {
            const rowById = container.querySelector(`.chat-row[data-message-id="${descriptorId}"]`);
            if (rowById) return rowById;
        }

        if (descriptorTimestamp) {
            const rows = Array.from(container.querySelectorAll('.chat-row'));
            return rows.find(row => String(row.getAttribute('data-timestamp') || '') === descriptorTimestamp) || null;
        }

        return null;
    }

    function replaceMessageInContainer(friend, container, msg, descriptor, options = {}) {
        if (!friend || !container || !msg) return false;
        return rerenderChatContainer(friend, container, options);
    }

    function removeMessageFromContainer(container, descriptor, options = {}) {
        if (!container) return false;
        const targetRow = findMessageRow(container, descriptor);
        if (!targetRow) return false;

        const previousElement = targetRow.previousElementSibling;
        const nextElement = targetRow.nextElementSibling;
        targetRow.remove();

        if (
            previousElement &&
            previousElement.classList &&
            previousElement.classList.contains('chat-timestamp') &&
            (!nextElement || !nextElement.classList || !nextElement.classList.contains('chat-row'))
        ) {
            previousElement.remove();
        }

        if (options.scroll) {
            window.imChat.scrollToBottom(container);
        }
        return true;
    }

function renderChatHistory(friend, container, options = {}) {
        if (!friend || !container) return;

        const messages = Array.isArray(friend.messages) ? friend.messages : [];
        const state = getChatHistoryState(friend, container, messages, options);
        let lastTime = 0;

        try {
            container._imIsRenderingHistory = true;
            renderLoadMoreHistoryControl(friend, container, messages, state);

            if (messages.length > 0) {
                messages.slice(state.visibleStartIndex).forEach(msg => {
                    window.imChat.ensureMessageId(msg, msg.type === 'pay_transfer' ? 'pay' : 'msg');
                    const msgTime = msg.timestamp || 0;
                    if (msgTime - lastTime > 300000) { 
                        window.imChat.renderTimestamp(msgTime, container);
                        lastTime = msgTime;
                    }
                    renderMessageBubble(msg, friend, container, msgTime);
                });
            }
        } finally {
            container._imIsRenderingHistory = false;
        }

        if (options.scroll !== false) {
            window.imChat.scrollToBottom(container);
        }
    }

function scrollToBottom(container) {
        if(container && !container._imIsRenderingHistory) container.scrollTop = container.scrollHeight;
    }

function renderTimestamp(timestamp, container) {
        if (!timestamp) return;
        const div = document.createElement('div');
        div.className = 'chat-timestamp';
        let timeStr = window.imApp.formatTime ? window.imApp.formatTime(timestamp) : '';
        div.innerHTML = `<span>${timeStr}</span>`;
        container.appendChild(div);
    }

function renderOfflineSceneText(sceneText, container, timestamp = Date.now()) {
        if (!sceneText || !container) return;
        const row = document.createElement('div');
        row.className = 'chat-offline-scene-row';
        row.setAttribute('data-timestamp', timestamp);
        row.innerHTML = `<span>${escapeHtml(sceneText)}</span>`;
        container.appendChild(row);
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

function renderUserBubble(text, container, timestamp = Date.now(), replyTo = null, translation = null, showTranslation = false, messageId = null, friend = null) {
        const rows = Array.from(container.children).filter(el => el.classList.contains('chat-row') && !el.classList.contains('typing-row'));
        const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
        let hasPrev = false;
        if (lastRow && lastRow.classList.contains('user-row')) {
            hasPrev = true;
            lastRow.classList.add('has-next');
        }

        const headerHtml = buildMessageHeaderHtml(true, friend, timestamp, null, null, hasPrev);

        const row = document.createElement('div');
        row.className = `chat-row user-row ${hasPrev ? 'has-prev' : ''}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', messageId || window.imChat.createMessageId('msg'));
        
        let contentHtml = '';
        if (replyTo) {
            contentHtml += `<div class="msg-reply-quote" style="font-size: 13px; color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.15); padding: 8px 12px; border-radius: 14px; margin-bottom: 8px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${replyTo}</div>`;
        }
        contentHtml += text;
        if (translation && showTranslation) {
            contentHtml += `<div class="msg-translation" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.4; word-wrap: break-word; white-space: normal;">${translation}</div>`;
        }

        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : (() => {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        })();
        contentHtml += `<span class="bubble-meta"><span class="bubble-time">${timeStr}</span><i class="fas fa-check bubble-read-icon"></i></span>`;

        row.innerHTML = `
            <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                ${headerHtml}
                <div style="display: flex; justify-content: flex-end; align-items: flex-end; width: 100%;">
                    <div class="chat-bubble user-bubble">${contentHtml}</div>
                </div>
            </div>
        `;
        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

function renderAiBubble(text, friend, container, timestamp = Date.now(), translation = null, showTranslation = false, replyTo = null, speakerName = null, speakerAvatar = null, messageId = null, thought = null, offlineScene = null, offlineAction = null) {
        const rows = Array.from(container.children).filter(el => !el.classList.contains('chat-timestamp') && !el.classList.contains('typing-row') && !el.classList.contains('chat-offline-scene-row'));
        const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
        const isGroupMessage = friend.type === 'group' && !!speakerName;
        let hasPrev = false;
        let sameSpeaker = false;

        if (lastRow && lastRow.classList.contains('ai-row')) {
            const prevSpeaker = lastRow.getAttribute('data-speaker') || null;
            if (isGroupMessage) {
                if (prevSpeaker === speakerName) {
                    hasPrev = true;
                    sameSpeaker = true;
                    lastRow.classList.add('has-next');
                }
            } else if (!prevSpeaker) {
                hasPrev = true;
                sameSpeaker = true;
                lastRow.classList.add('has-next');
            }
        }

        const row = document.createElement('div');
        row.className = `chat-row ai-row ${hasPrev ? 'has-prev' : ''} ${isGroupMessage ? 'group-ai-row' : ''} ${isGroupMessage && sameSpeaker ? 'group-ai-row-continuous' : ''}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', messageId || window.imChat.createMessageId('msg'));
        if (speakerName) {
            row.setAttribute('data-speaker', speakerName);
        }
        if (thought) {
            row.setAttribute('data-thought', thought);
        }
        
        let contentHtml = '';
        if (replyTo) {
            contentHtml += `<div class="msg-reply-quote" style="font-size: 13px; color: rgba(0,0,0,0.6); background: rgba(0,0,0,0.05); padding: 8px 12px; border-radius: 14px; margin-bottom: 8px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${replyTo}</div>`;
        }
        const safeOfflineAction = normalizeOfflineActionText(offlineAction);
        if (safeOfflineAction) {
            contentHtml += `<span class="chat-offline-action">（${escapeHtml(safeOfflineAction)}）</span>`;
        }
        contentHtml += text;
        if (translation && showTranslation) {
            contentHtml += `<div class="msg-translation" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(0,0,0,0.1); font-size: 13px; color: #8e8e93; line-height: 1.4; word-wrap: break-word; white-space: normal;">${translation}</div>`;
        }
        
        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : (() => {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        })();
        contentHtml += `<span class="bubble-meta"><span class="bubble-time">${timeStr}</span></span>`;

        const headerHtml = buildMessageHeaderHtml(false, friend, timestamp, speakerName, speakerAvatar, hasPrev);

        let bubbleWrapperHtml = '';
            if (isGroupMessage) {
                const avatarInitial = String(speakerName).trim().charAt(0) || '?';
                const avatarImg = speakerAvatar
                    ? `<img src="${speakerAvatar}" onerror="this.src='assets/moren.jpg'" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">`
                    : `<div class="chat-avatar-small">${avatarInitial}</div>`;

                bubbleWrapperHtml = `
                    <div class="group-ai-bubble-wrap">
                    ${sameSpeaker ? '' : `<div class="group-ai-speaker-name">${speakerName}</div>`}
                    <div class="group-ai-bubble-row">
                        <div class="group-ai-avatar-slot">${sameSpeaker ? '<div class="group-ai-avatar-placeholder"></div>' : avatarImg}</div>
                        <div class="chat-bubble ai-bubble">${contentHtml}</div>
                    </div>
                </div>
            `;
        } else {
            bubbleWrapperHtml = `<div class="chat-bubble ai-bubble">${contentHtml}</div>`;
        }

        row.innerHTML = `
            <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                ${headerHtml}
                <div style="display: flex; justify-content: flex-start; align-items: flex-end; width: 100%;">
                    ${bubbleWrapperHtml}
                </div>
            </div>
        `;
        if (offlineScene) {
            renderOfflineSceneText(offlineScene, container, timestamp);
        }
        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

function openChatImageDetail(msg, friend, timestamp, senderName) {
        let overlay = document.getElementById('chat-image-detail-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'chat-image-detail-overlay';
            overlay.style.cssText = 'position:fixed; inset:0; z-index:99999; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,0.55); padding:20px; box-sizing:border-box;';
            overlay.innerHTML = `
                <div class="chat-image-detail-card" style="width:100%; max-width:360px; max-height:86vh; background:#fff; border-radius:24px; overflow:hidden;  display:flex; flex-direction:column;">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; border-bottom:1px solid #f2f2f7;">
                        <div style="min-width:0;">
                            <div class="chat-image-detail-sender" style="font-size:16px; font-weight:800; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>
                            <div class="chat-image-detail-time" style="font-size:12px; color:#8e8e93; margin-top:2px;"></div>
                        </div>
                        <button type="button" class="chat-image-detail-close" aria-label="关闭" style="width:32px; height:32px; border:none; border-radius:16px; background:#f2f2f7; color:#111; cursor:pointer; flex-shrink:0;"><i class="fas fa-times"></i></button>
                    </div>
                    <div style="background:#111; display:flex; align-items:center; justify-content:center; min-height:220px;">
                        <img class="chat-image-detail-img" src="" alt="" style="max-width:100%; max-height:52vh; object-fit:contain; display:block;">
                    </div>
                    <div style="padding:14px 16px 18px; overflow-y:auto;">
                        <div style="font-size:12px; color:#8e8e93; font-weight:700; margin-bottom:7px;">图片详情</div>
                        <div class="chat-image-detail-desc" style="font-size:15px; color:#222; line-height:1.55; white-space:pre-wrap; word-break:break-word;"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay || event.target.closest('.chat-image-detail-close')) {
                    overlay.style.display = 'none';
                }
            });
        }

        const imageEl = overlay.querySelector('.chat-image-detail-img');
        const senderEl = overlay.querySelector('.chat-image-detail-sender');
        const timeEl = overlay.querySelector('.chat-image-detail-time');
        const descEl = overlay.querySelector('.chat-image-detail-desc');
        const date = new Date(timestamp || msg.timestamp || Date.now());
        const timeStr = typeof window.formatChatBubbleTime === 'function'
            ? window.formatChatBubbleTime(timestamp || msg.timestamp || Date.now())
            : `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;

        if (imageEl) imageEl.src = msg.content || window.imChat.CHAT_IMAGE_PLACEHOLDER_URL || '';
        if (senderEl) senderEl.textContent = senderName || friend?.nickname || friend?.realName || '图片';
        if (timeEl) timeEl.textContent = timeStr;
        if (descEl) descEl.textContent = msg.text || msg.description || '暂无图片描述';
        overlay.style.display = 'flex';
    }

function renderImageBubble(msg, friend, container, timestamp = Date.now()) {
        const isUser = msg.role === 'user';
        const isGroupMessage = !isUser && friend.type === 'group';
        const safeSpeaker = isGroupMessage && window.imChat.getSafeGroupSpeaker
            ? window.imChat.getSafeGroupSpeaker(friend, msg.speaker || msg.senderName)
            : null;
        const speakerName = isGroupMessage
            ? ((safeSpeaker && safeSpeaker.nickname) || msg.speaker || msg.senderName || 'Group member')
            : null;
        const speakerAvatar = (safeSpeaker && safeSpeaker.avatarUrl) || msg.senderAvatarUrl || null;
        const rows = Array.from(container.children).filter(el => !el.classList.contains('chat-timestamp') && !el.classList.contains('typing-row'));
        const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
        let hasPrev = false;
        let sameSpeaker = false;
        
        if (lastRow) {
            if (isUser && lastRow.classList.contains('user-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            } else if (!isUser && lastRow.classList.contains('ai-row')) {
                const prevSpeaker = lastRow.getAttribute('data-speaker') || null;
                if (isGroupMessage) {
                    if (prevSpeaker === speakerName) {
                        hasPrev = true;
                        sameSpeaker = true;
                        lastRow.classList.add('has-next');
                    }
                } else if (!prevSpeaker) {
                    hasPrev = true;
                    lastRow.classList.add('has-next');
                }
            }
        }

        const row = document.createElement('div');
        row.className = `chat-row ${isUser ? 'user-row' : 'ai-row'} ${hasPrev ? 'has-prev' : ''} ${isGroupMessage ? 'group-ai-row' : ''} ${isGroupMessage && sameSpeaker ? 'group-ai-row-continuous' : ''}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'img'));
        if (speakerName) row.setAttribute('data-speaker', speakerName);
        
        const imageSrc = msg.content || window.imChat.CHAT_IMAGE_PLACEHOLDER_URL || '';
        const contentHtml = `
            <img class="chat-image-bubble-img" src="${escapeHtml(imageSrc)}" style="width: min(56vw, 200px); height: min(56vw, 200px); max-width: 200px; max-height: 200px; aspect-ratio: 1 / 1; border-radius: 12px; object-fit: cover; display: block; background: #e5e5ea; cursor: pointer;">
        `;

        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : (() => {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        })();

        const metaHtml = "";
        const bubbleHtml = `<div class="chat-bubble ${isUser ? 'user-bubble' : 'ai-bubble'}" style="padding: 0; background: transparent; ">${contentHtml}${metaHtml}</div>`;
        let bubbleWrapperHtml = bubbleHtml;

            if (isGroupMessage) {
                const avatarInitial = String(speakerName).trim().charAt(0) || '?';
                const avatarImg = speakerAvatar
                    ? `<img src="${escapeHtml(speakerAvatar)}" onerror="this.src='assets/moren.jpg'" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">`
                    : `<div class="chat-avatar-small">${escapeHtml(avatarInitial)}</div>`;

                bubbleWrapperHtml = `
                    <div class="group-ai-bubble-wrap">
                    ${sameSpeaker ? '' : `<div class="group-ai-speaker-name">${escapeHtml(speakerName)}</div>`}
                    <div class="group-ai-bubble-row">
                        <div class="group-ai-avatar-slot">${sameSpeaker ? '<div class="group-ai-avatar-placeholder"></div>' : avatarImg}</div>
                        ${bubbleHtml}
                    </div>
                </div>
            `;
        }

        const headerHtml = buildMessageHeaderHtml(isUser, friend, timestamp, speakerName, speakerAvatar, hasPrev);

        row.innerHTML = `
            <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                ${headerHtml}
                <div style="display: flex; justify-content: ${isUser ? 'flex-end' : 'flex-start'}; align-items: flex-end; width: 100%;">
                    ${bubbleWrapperHtml}
                </div>
            </div>
        `;

        const imageEl = row.querySelector('.chat-image-bubble-img');
        if (imageEl) {
            imageEl.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const senderName = isUser
                    ? (window.userState?.name || '我')
                    : (speakerName || friend?.nickname || friend?.realName || 'Char');
                openChatImageDetail(msg, friend, timestamp, senderName);
            });
        }

        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

function renderPayTransferBubble(msg, friend, container, timestamp = Date.now()) {
        const isUser = msg.role === 'user';
        const lastRow = container.lastElementChild;
        let hasPrev = false;

        if (lastRow) {
            if (isUser && lastRow.classList.contains('user-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            } else if (!isUser && lastRow.classList.contains('ai-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            }
        }

        const row = document.createElement('div');
        row.className = `chat-row ${isUser ? 'user-row' : 'ai-row'} ${hasPrev ? 'has-prev' : ''}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'pay'));

        const amount = Number(msg.amount) || 0;
        const amountText = `¥${amount.toFixed(2)}`;
        const description = msg.description || '转账';
        const parties = resolvePayTransferParties(msg, friend);
        const { payKind, status, payerName, payeeName } = parties;

        const isOfficialReceipt = msg.targetName === 'Payment' || msg.cardTitle === '收款通知' || msg.cardTitle === '支付凭证';
        const familyCardText = `${msg.paymentAction || ''} ${msg.cardTitle || ''} ${msg.description || ''} ${msg.content || ''}`;
        const isFamilyCard = msg.paymentAction === 'family_card'
            || msg.paymentAction === 'family_card_increase'
            || familyCardText.includes('亲属卡');
        let cardTitle = msg.cardTitle || 'Payment';
        let subtitle = `${payerName} 向 ${payeeName} 转账`;
        let extraClass = '';

        if (status === 'claimed') {
            cardTitle = msg.cardTitle || `${payeeName}已收款`;
            subtitle = `${payeeName}已收取 ${payerName} 的转账`;
            extraClass = payKind === 'char_received' ? ' is-received' : ' is-income';
        } else if (status === 'rejected') {
            cardTitle = msg.cardTitle || '已退还';
            subtitle = `${payeeName}已退还 ${payerName} 的转账`;
            extraClass = ' is-rejected';
        } else if (payKind === 'char_to_user_pending') {
            cardTitle = msg.cardTitle || '转账';
            subtitle = `${payerName} 向 ${payeeName} 转账`;
            extraClass = ' is-pending';
        }

        const headerHtml = buildMessageHeaderHtml(isUser, friend, timestamp, null, null, hasPrev);

        const date = new Date(timestamp);
        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;

        if (isOfficialReceipt) {
            // 微信支付样式居中大卡片
            const sign = msg.cardTitle === '收款通知' ? '+' : '-';
            row.innerHTML = `
                <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                    <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                </div>
                <div style="width:100%; display:flex; justify-content:center; padding:10px 0;">
                    <div style="width:280px; background:#fff; border-radius:12px; padding:16px;  display:flex; flex-direction:column; align-items:center;">
                        <div style="font-size:14px; color:#111; margin-bottom:8px;">${description}</div>
                        <div style="font-size:28px; font-weight:bold; color:#111; margin-bottom:12px;">${sign}¥${amount.toFixed(2)}</div>
                          <div style="background:#f2f2f7; border-radius:16px; padding:4px 12px; font-size:12px; color:#8e8e93; margin-bottom:16px;">
                              ${timeStr}
                          </div>
                        <div style="width:100%; border-top:1px solid #f2f2f7; padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:13px; color:#8e8e93;">账单详情</span>
                            <i class="fas fa-chevron-right" style="font-size:12px; color:#c7c7cc;"></i>
                        </div>
                    </div>
                </div>
            `;
        } else {
            const contentHtml = `
                <div class="pay-transfer-card${extraClass}">
                    <div class="pay-transfer-card-top">
                        <div class="pay-transfer-card-icon"><i class="fas fa-wallet"></i></div>
                        <div class="pay-transfer-card-meta">
                            <div class="pay-transfer-card-title">${cardTitle}</div>
                            ${isFamilyCard ? '' : `<div class="pay-transfer-card-subtitle">${subtitle}</div>`}
                        </div>
                    </div>
                    <div class="pay-transfer-card-amount">${amountText}</div>
                    <div class="pay-transfer-card-desc">${description}</div>
                </div>
            `;

            if (isUser) {
                const metaHtml = "";
                row.innerHTML = `
                    <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                        <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                    </div>
                    <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                        ${headerHtml}
                        <div style="display: flex; justify-content: flex-end; align-items: flex-end; width: 100%;">
                            <div class="chat-bubble user-bubble pay-transfer-bubble">${contentHtml}${metaHtml}</div>
                        </div>
                    </div>
                `;
            } else {
                const metaHtml = "";
                row.innerHTML = `
                    <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                        <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                    </div>
                    <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                        ${headerHtml}
                        <div style="display: flex; justify-content: flex-start; align-items: flex-end; width: 100%;">
                            <div class="chat-bubble ai-bubble pay-transfer-bubble">${contentHtml}${metaHtml}</div>
                        </div>
                    </div>
                `;
            }
        }

        container.appendChild(row);

        // 允许用户向AI转账时，以及AI向用户转账时，都可以点击打开弹窗
        if (payKind === 'char_to_user_pending' || payKind === 'user_to_char') {
            const clickableBubble = row.querySelector('.chat-bubble.pay-transfer-bubble') || row.querySelector('.pay-transfer-card');
            if (clickableBubble) {
                clickableBubble.style.cursor = 'pointer';
                clickableBubble.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const activePage = container.closest('.active-chat-interface');
                    if (!activePage) {
                        if (window.showToast) window.showToast('未找到聊天页面');
                        return;
                    }

                    if (!activePage._openTransferDetailOverlay) {
                        window.imChat.ensureTransferDetailOverlayForExistingPage(activePage, friend);
                    }

                    if (activePage._openTransferDetailOverlay) {
                        const messageId = row.getAttribute('data-message-id');
                        const rowTimestamp = row.getAttribute('data-timestamp');
                        const liveFriend = window.imData.currentActiveFriend &&
                            String(window.imData.currentActiveFriend.id) === String(friend.id)
                            ? window.imData.currentActiveFriend
                            : friend;
                        const liveMsg = Array.isArray(liveFriend?.messages)
                            ? liveFriend.messages.find(item => {
                                if (messageId && String(item.id) === String(messageId)) return true;
                                return rowTimestamp && String(item.timestamp) === String(rowTimestamp);
                            })
                            : null;
                        activePage._openTransferDetailOverlay(liveMsg || msg);
                    } else if (window.showToast) {
                        window.showToast('详情卡片初始化失败');
                    }
                });
            }
        }

        window.imChat.scrollToBottom(container);
    }

function renderMomentForwardBubble(msg, friend, container, timestamp = Date.now()) {
        let momentData = {};
        try {
            momentData = JSON.parse(msg.content);
        } catch (e) {
            momentData = { text: '[解析错误]' };
        }

        const isUser = msg.role === 'user';
        const lastRow = container.lastElementChild;
        let hasPrev = false;
        
        if (lastRow) {
            if (isUser && lastRow.classList.contains('user-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            } else if (!isUser && lastRow.classList.contains('ai-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            }
        }

        const row = document.createElement('div');
        row.className = `chat-row ${isUser ? 'user-row' : 'ai-row'} ${hasPrev ? 'has-prev' : ''}`;
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'moment'));
        
        const contentHtml = `
            <div class="moment-forward-bubble" style="cursor: pointer; background: #fff; border-radius: 16px; padding: 12px;  border: 1px solid rgba(0,0,0,0.04); display: flex; align-items: center; gap: 12px; width: 220px; text-align: left; margin: 4px 0;">
                <div style="width: 44px; height: 44px; border-radius: 12px; background: #1c1c1e; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fff; font-size: 20px;">
                    <i class="far fa-images"></i>
                </div>
                <div style="flex: 1; overflow: hidden;">
                    <div style="font-size: 15px; font-weight: 600; color: #262626; margin-bottom: 2px;">分享了动态</div>
                    <div style="font-size: 13px; color: #8e8e93;">点击查看详情</div>
                </div>
            </div>
        `;

        const headerHtml = buildMessageHeaderHtml(isUser, friend, timestamp, null, null, hasPrev);

        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : (() => {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        })();
        
        if (isUser) {
            let metaHtml = "";
            row.innerHTML = `
                <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                    <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                    ${headerHtml}
                    <div style="display: flex; justify-content: flex-end; align-items: flex-end; width: 100%;">
                        ${contentHtml}
                        ${metaHtml}
                    </div>
                </div>
            `;
        } else {
            let metaHtml = "";
            row.innerHTML = `
                <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                    <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                    ${headerHtml}
                    <div style="display: flex; justify-content: flex-start; align-items: flex-end; width: 100%;">
                        ${contentHtml}
                        ${metaHtml}
                    </div>
                </div>
            `;
        }
        
        row.querySelector('.moment-forward-bubble').addEventListener('click', () => {
            const foundMoment = window.imData.moments.find(m => m.id == momentData.id);
            if (foundMoment) {
                if(window.imApp.openMomentDetail) window.imApp.openMomentDetail(foundMoment);
            } else {
                if(window.showToast) window.showToast('该朋友圈已删除或不存在');
            }
        });

        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

function renderVoiceMessageBubble(msg, friend, container, timestamp = Date.now()) {
        const isUser = msg.role !== 'assistant';
        const rows = Array.from(container.children).filter(el => !el.classList.contains('chat-timestamp') && !el.classList.contains('typing-row') && !el.classList.contains('chat-offline-scene-row'));
        const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
        const isGroupMessage = !isUser && friend.type === 'group';
        const safeSpeaker = isGroupMessage && window.imChat.getSafeGroupSpeaker
            ? window.imChat.getSafeGroupSpeaker(friend, msg.speaker || msg.senderName)
            : null;
        const speakerName = isGroupMessage
            ? ((safeSpeaker && safeSpeaker.nickname) || msg.speaker || msg.senderName || '群成员')
            : null;
        const speakerAvatar = (safeSpeaker && safeSpeaker.avatarUrl) || msg.senderAvatarUrl || null;
        let hasPrev = false;
        let sameSpeaker = false;

        if (lastRow) {
            if (isUser && lastRow.classList.contains('user-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            } else if (!isUser && lastRow.classList.contains('ai-row')) {
                const prevSpeaker = lastRow.getAttribute('data-speaker') || null;
                if (isGroupMessage) {
                    if (prevSpeaker === speakerName) {
                        hasPrev = true;
                        sameSpeaker = true;
                        lastRow.classList.add('has-next');
                    }
                } else if (!prevSpeaker) {
                    hasPrev = true;
                    sameSpeaker = true;
                    lastRow.classList.add('has-next');
                }
            }
        }

        const row = document.createElement('div');
        row.className = `chat-row ${isUser ? 'user-row' : 'ai-row'} ${hasPrev ? 'has-prev' : ''} ${isGroupMessage ? 'group-ai-row' : ''} ${isGroupMessage && sameSpeaker ? 'group-ai-row-continuous' : ''}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'voice'));
        if (speakerName) {
            row.setAttribute('data-speaker', speakerName);
        }

        const transcript = String(msg.transcript || msg.text || '').trim();
        const calculatedDuration = Math.min(18, Math.max(3, Math.ceil(transcript.length / 3)));
        const duration = Math.min(18, Math.max(3, Number(msg.duration) || calculatedDuration));
        const safeTranscript = escapeHtml(transcript || '暂无转文字');
        const cleanTranslation = String(msg.translation || '').trim();
        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : (() => {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        })();
        const metaHtml = "";

        const safeOfflineAction = !isUser ? normalizeOfflineActionText(msg.offlineAction) : '';
        const offlineActionHtml = safeOfflineAction
            ? `<span class="chat-offline-action">（${escapeHtml(safeOfflineAction)}）</span>`
            : '';
        const contentHtml = `
            ${offlineActionHtml}
            <button type="button" class="voice-message-bubble-inner" aria-expanded="false">
                <span class="voice-message-mic"><i class="fas fa-microphone-alt"></i></span>
                <span class="voice-message-wave" aria-hidden="true">
                    <span></span><span></span><span></span><span></span><span></span>
                </span>
                <span class="voice-message-duration">${duration}s</span>
            </button>
            <div class="voice-message-transcript" hidden>${safeTranscript}</div>
            ${cleanTranslation && msg.showTranslation ? `<div class="msg-translation" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid ${isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}; font-size: 13px; color: ${isUser ? 'rgba(255,255,255,0.7)' : '#8e8e93'}; line-height: 1.4; word-wrap: break-word; white-space: normal;">${escapeHtml(cleanTranslation)}</div>` : ''}
            ${metaHtml}
        `;

        const bubbleHtml = `<div class="chat-bubble ${isUser ? 'user-bubble' : 'ai-bubble'} voice-message-bubble">${contentHtml}</div>`;
        let bubbleWrapperHtml = bubbleHtml;
        if (isGroupMessage) {
            const avatarInitial = String(speakerName).trim().charAt(0) || '?';
            const avatarImg = speakerAvatar
                ? `<img src="${speakerAvatar}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">`
                : `<div class="chat-avatar-small">${escapeHtml(avatarInitial)}</div>`;

            bubbleWrapperHtml = `
                <div class="group-ai-bubble-wrap">
                    ${sameSpeaker ? '' : `<div class="group-ai-speaker-name">${escapeHtml(speakerName)}</div>`}
                    <div class="group-ai-bubble-row">
                        <div class="group-ai-avatar-slot">${sameSpeaker ? '<div class="group-ai-avatar-placeholder"></div>' : avatarImg}</div>
                        ${bubbleHtml}
                    </div>
                </div>
            `;
        }

        const headerHtml = buildMessageHeaderHtml(isUser, friend, timestamp, speakerName, speakerAvatar, hasPrev);

        row.innerHTML = `
            <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                ${headerHtml}
                <div style="display: flex; justify-content: ${isUser ? 'flex-end' : 'flex-start'}; align-items: flex-end; width: 100%;">
                    ${bubbleWrapperHtml}
                </div>
            </div>
        `;

        const toggle = row.querySelector('.voice-message-bubble-inner');
        const transcriptEl = row.querySelector('.voice-message-transcript');
        if (toggle && transcriptEl) {
            toggle.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const shouldExpand = transcriptEl.hidden;
                transcriptEl.hidden = !shouldExpand;
                toggle.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');

                if (shouldExpand && window.u2MinimaxTts && typeof window.u2MinimaxTts.speakTextCached === 'function') {
                    try {
                        const cacheOwner = msg && typeof msg === 'object' ? msg : {};
                        const audioUrl = await window.u2MinimaxTts.speakTextCached(transcript, friend, cacheOwner);
                        if (audioUrl && msg && typeof msg === 'object' && !msg.minimaxAudioUrl && window.imApp?.updateFriendMessage) {
                            await window.imApp.updateFriendMessage(friend.id, {
                                id: msg.id || row.getAttribute('data-message-id') || null,
                                timestamp: row.getAttribute('data-timestamp') || timestamp || null
                            }, (targetMsg) => {
                                if (targetMsg) targetMsg.minimaxAudioUrl = audioUrl;
                            }, { silent: true });
                        }
                    } catch (error) {
                        console.error('Voice message playback failed', error);
                        if (window.showToast) window.showToast('语音播放失败');
                    }
                }
            });
        }

        if (!isUser && msg.offlineScene) {
            renderOfflineSceneText(msg.offlineScene, container, timestamp);
        }
        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

function renderStickerMessageBubble(msg, friend, container, timestamp = Date.now()) {
        const isUser = msg.role !== 'assistant';
        const rows = Array.from(container.children).filter(el => !el.classList.contains('chat-timestamp') && !el.classList.contains('typing-row'));
        const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
        const isGroupMessage = !isUser && friend.type === 'group';
        const safeSpeaker = isGroupMessage && window.imChat.getSafeGroupSpeaker
            ? window.imChat.getSafeGroupSpeaker(friend, msg.speaker || msg.senderName)
            : null;
        const speakerName = isGroupMessage
            ? ((safeSpeaker && safeSpeaker.nickname) || msg.speaker || msg.senderName || 'Group member')
            : null;
        const speakerAvatar = (safeSpeaker && safeSpeaker.avatarUrl) || msg.senderAvatarUrl || null;
        let hasPrev = false;
        let sameSpeaker = false;

        if (lastRow) {
            if (isUser && lastRow.classList.contains('user-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            } else if (!isUser && lastRow.classList.contains('ai-row')) {
                const prevSpeaker = lastRow.getAttribute('data-speaker') || null;
                if (isGroupMessage) {
                    if (prevSpeaker === speakerName) {
                        hasPrev = true;
                        sameSpeaker = true;
                        lastRow.classList.add('has-next');
                    }
                } else if (!prevSpeaker) {
                    hasPrev = true;
                    sameSpeaker = true;
                    lastRow.classList.add('has-next');
                }
            }
        }

        const row = document.createElement('div');
        row.className = `chat-row ${isUser ? 'user-row' : 'ai-row'} ${hasPrev ? 'has-prev' : ''} ${isGroupMessage ? 'group-ai-row' : ''} ${isGroupMessage && sameSpeaker ? 'group-ai-row-continuous' : ''}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'sticker'));
        if (speakerName) {
            row.setAttribute('data-speaker', speakerName);
        }

        const stickerUrl = String(msg.stickerUrl || msg.content || '').trim();
        const stickerName = String(msg.stickerName || msg.text || 'Sticker').trim();
        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : (() => {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        })();
        const metaHtml = "";
        const stickerHtml = `
            <div class="sticker-message-wrap" title="${escapeHtml(stickerName)}">
                <img class="sticker-message-img" src="${escapeHtml(stickerUrl)}" alt="${escapeHtml(stickerName)}">
                ${metaHtml}
            </div>
        `;

        let bubbleWrapperHtml = stickerHtml;
        if (isGroupMessage) {
            const avatarInitial = String(speakerName).trim().charAt(0) || '?';
            const avatarImg = speakerAvatar
                ? `<img src="${escapeHtml(speakerAvatar)}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">`
                : `<div class="chat-avatar-small">${escapeHtml(avatarInitial)}</div>`;

            bubbleWrapperHtml = `
                <div class="group-ai-bubble-wrap sticker-group-wrap">
                    ${sameSpeaker ? '' : `<div class="group-ai-speaker-name">${escapeHtml(speakerName)}</div>`}
                    <div class="group-ai-bubble-row">
                        <div class="group-ai-avatar-slot">${sameSpeaker ? '<div class="group-ai-avatar-placeholder"></div>' : avatarImg}</div>
                        ${stickerHtml}
                    </div>
                </div>
            `;
        }

        const headerHtml = buildMessageHeaderHtml(isUser, friend, timestamp, speakerName, speakerAvatar, hasPrev);

        row.innerHTML = `
            <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                ${headerHtml}
                <div style="display: flex; justify-content: ${isUser ? 'flex-end' : 'flex-start'}; align-items: flex-end; width: 100%;">
                    ${bubbleWrapperHtml}
                </div>
            </div>
        `;

        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

    window.imChat.renderSystemNoticeBubble = renderSystemNoticeBubble;
    window.imChat.renderGroupRedPacketBubble = renderGroupRedPacketBubble;
    window.imChat.renderStickerMessageBubble = renderStickerMessageBubble;
    window.imChat.renderMessageBubble = renderMessageBubble;
    window.imChat.appendMessageToContainer = appendMessageToContainer;
    window.imChat.replaceMessageInContainer = replaceMessageInContainer;
    window.imChat.removeMessageFromContainer = removeMessageFromContainer;
    window.imChat.rerenderChatContainer = rerenderChatContainer;
    window.imChat.renderChatHistory = renderChatHistory;
    window.imChat.scrollToBottom = scrollToBottom;
    window.imChat.renderTimestamp = renderTimestamp;
    window.imChat.renderOfflineSceneText = renderOfflineSceneText;
    window.imChat.renderUserBubble = renderUserBubble;
    window.imChat.renderAiBubble = renderAiBubble;
    window.imChat.renderImageBubble = renderImageBubble;
    window.imChat.renderPayTransferBubble = renderPayTransferBubble;
    window.imChat.renderVoiceMessageBubble = renderVoiceMessageBubble;
    function renderHtmlBubble(msg, friend, container, timestamp = Date.now()) {
        const isUser = msg.role === 'user';
        const lastRow = container.lastElementChild;
        let hasPrev = false;

        if (lastRow) {
            if (isUser && lastRow.classList.contains('user-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            } else if (!isUser && lastRow.classList.contains('ai-row')) {
                hasPrev = true;
                lastRow.classList.add('has-next');
            }
        }

        const row = document.createElement('div');
        row.className = `chat-row ${isUser ? 'user-row' : 'ai-row'} ${hasPrev ? 'has-prev' : ''}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'html'));

        const contentHtml = msg.content || msg.text || '';
        const headerHtml = buildMessageHeaderHtml(isUser, friend, timestamp, null, null, hasPrev);

        const date = new Date(timestamp);
        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;

        if (isUser) {
            const metaHtml = "";
            row.innerHTML = `
                <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                    <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                    ${headerHtml}
                    <div style="display: flex; justify-content: flex-end; align-items: flex-end; width: 100%;">
                        <div class="chat-bubble html-bubble" style="position: relative; background: transparent; padding: 0;">
                            ${contentHtml}
                            <div style="position: absolute; bottom: 8px; right: -30px;">${metaHtml}</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            const metaHtml = "";
            row.innerHTML = `
                <div class="chat-checkbox-wrapper" style="display: ${window.imData.batchSelectMode ? 'flex' : 'none'}; width: 40px; justify-content: center; align-items: flex-end; padding-bottom: 10px; flex-shrink: 0; cursor: pointer; transition: all 0.2s;">
                    <i class="far fa-circle chat-checkbox" data-timestamp="${timestamp}" style="color: #c7c7cc; font-size: 22px;"></i>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                    ${headerHtml}
                    <div style="display: flex; justify-content: flex-start; align-items: flex-end; width: 100%;">
                        <div class="chat-bubble html-bubble" style="position: relative; background: transparent; padding: 0;">
                            ${contentHtml}
                            <div style="position: absolute; bottom: 8px; right: -25px;">${metaHtml}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

function renderVoiceCallRecordBubble(msg, friend, container, timestamp = Date.now()) {
        const isSystem = msg.role === 'system';
        const isUser = msg.senderId === (window.imData.currentUser ? window.imData.currentUser.id : 'me') || msg.senderId === '__user__' || isSystem;
        
        if (isSystem && friend.type === 'group') {
            // Group call record
            const row = document.createElement('div');
            row.className = 'chat-system-row';
            row.setAttribute('data-timestamp', timestamp);
            row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'notice'));
            row.innerHTML = `
                <div style="width:100%; display:flex; justify-content:center; padding:2px 0; margin: 10px 0; cursor: pointer;">
                    <div class="voice-call-record-card" style="max-width:80%; padding:10px 16px; border-radius:18px; background:rgba(0,0,0,0.05); color:#000; font-size:13px; line-height:1.4; text-align:center; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-phone-alt" style="color: #34c759;"></i>
                        <span>${msg.statusText || '群通话记录'}</span>
                    </div>
                </div>
            `;
            
            const clickableCard = row.querySelector('.voice-call-record-card');
            if (clickableCard) {
                clickableCard.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.imChat && window.imChat.openVoiceCallDetail) {
                        window.imChat.openVoiceCallDetail(msg, friend);
                    }
                });
            }

            container.appendChild(row);
            window.imChat.scrollToBottom(container);
            return;
        }

        const row = document.createElement('div');
        row.className = `chat-row ${isUser ? 'user-row' : 'ai-row'}`;
        row.setAttribute('data-timestamp', timestamp);
        row.setAttribute('data-message-id', window.imChat.ensureMessageId(msg, 'call'));

        const duration = msg.duration || 0;
        const m = Math.floor(duration / 60).toString().padStart(2, '0');
        const s = (duration % 60).toString().padStart(2, '0');
        const durationText = `${m}:${s}`;
        const title = msg.isVideo ? '视频通话' : '语音通话';
        const statusText = msg.statusText || '通话记录';
        
        let subtitleHtml = '';
        if (statusText === '已拒绝' || statusText === '已取消') {
            subtitleHtml = `<div style="font-size: 13px; color: #ff3b30; margin-top: 2px; font-weight: 500;">${statusText}</div>`;
        } else {
            subtitleHtml = `<div style="font-size: 13px; color: #8e8e93; margin-top: 2px;">通话时长 ${durationText}</div>`;
        }

        const contentHtml = `
            <div class="voice-call-record-card" style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: ${isUser ? '#e5e5ea' : '#f2f2f7'}; border-radius: 18px; cursor: pointer; color: #111;">
                <div style="width: 32px; height: 32px; border-radius: 16px; background: ${statusText === '已拒绝' || statusText === '已取消' ? '#ff3b30' : '#34c759'}; color: #fff; display: flex; justify-content: center; align-items: center; flex-shrink: 0;">
                    <i class="fas fa-phone-alt"></i>
                </div>
                <div>
                    <div style="font-size: 15px; font-weight: 600;">${title}</div>
                    ${subtitleHtml}
                </div>
            </div>
        `;

        const timeStr = typeof window.formatChatBubbleTime === 'function' ? window.formatChatBubbleTime(timestamp) : (() => {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        })();

        // For voice call record, it uses simplified DOM structure, but we still need header. 
        // Note: It doesn't have hasPrev tracking in its code properly, let's just assume false as it lacks context, or compute if possible.
        // Actually it doesn't compute hasPrev. I'll just pass false for hasPrev as it doesn't track it, 
        // but wait, is it worth adding? No, VoiceCallRecord is usually a system notice or independent item.
        const headerHtml = buildMessageHeaderHtml(isUser, friend, timestamp, null, null, false);

        if (isUser) {
            const metaHtml = "";
            row.innerHTML = `
                <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                    ${headerHtml}
                    <div style="display: flex; justify-content: flex-end; align-items: flex-end; width: 100%;">
                        <div class="chat-bubble user-bubble" style="padding: 0; background: transparent;">${contentHtml}${metaHtml}</div>
                    </div>
                </div>
            `;
        } else {
            const metaHtml = "";
            row.innerHTML = `
                <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                    ${headerHtml}
                    <div style="display: flex; justify-content: flex-start; align-items: flex-end; width: 100%;">
                        <div class="chat-bubble ai-bubble" style="padding: 0; background: transparent;">${contentHtml}${metaHtml}</div>
                    </div>
                </div>
            `;
        }

        const clickableCard = row.querySelector('.voice-call-record-card');
        if (clickableCard) {
            clickableCard.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.imChat && window.imChat.openVoiceCallDetail) {
                    window.imChat.openVoiceCallDetail(msg, friend);
                }
            });
        }

        container.appendChild(row);
        window.imChat.scrollToBottom(container);
    }

    window.imChat.renderMomentForwardBubble = renderMomentForwardBubble;
    window.imChat.renderVoiceCallRecordBubble = renderVoiceCallRecordBubble;
    window.imChat.renderHtmlBubble = renderHtmlBubble;

});
