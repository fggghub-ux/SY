// ==========================================
// IMESSAGE: 4_chat_status.js
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    window.imChat = window.imChat || {};

    async function commitStatusFriendChange(friendOrId, mutator, options = {}) {
        const commitOptions = {
            metaOnly: options.metaOnly !== false,
            ...options
        };

        return window.imApp.commitScopedFriendChange(friendOrId, mutator, {
            syncActive: true,
            ...commitOptions
        });
    }

    function ensureProfilePanelData(friend) {
        if (!friend) return window.imApp.createDefaultProfilePanel({});
        const nextPanel = window.imApp.createDefaultProfilePanel(friend);
        friend.profilePanel = nextPanel;
        friend.latestThought = nextPanel.thought;
        friend.status = nextPanel.status || 'online';
        return nextPanel;
    }

    function getProfilePanelData(friend) {
        if (!friend) return window.imApp.createDefaultProfilePanel({});
        return ensureProfilePanelData(friend);
    }

    function getProfilePanelUiState(friendOrId) {
        const targetId = window.imApp.resolveFriendId(friendOrId);
        const safeFriendId = targetId != null ? String(targetId) : 'default';
        const stateMap = window.imData.profilePanelUiStateByFriendId || (window.imData.profilePanelUiStateByFriendId = {});
        const existingState = stateMap[safeFriendId];

        if (
            !existingState ||
            typeof existingState !== 'object' ||
            typeof existingState.activeTab !== 'string'
        ) {
            stateMap[safeFriendId] = {
                open: false,
                activeTab: 'thought'
            };
        }

        if (!['thought', 'events'].includes(stateMap[safeFriendId].activeTab)) {
            stateMap[safeFriendId].activeTab = 'thought';
        }

        return stateMap[safeFriendId];
    }

    function setProfilePanelTab(friendOrId, tabName) {
        const uiState = window.imChat.getProfilePanelUiState(friendOrId);
        const safeTab = ['thought', 'events'].includes(tabName) ? tabName : 'thought';
        uiState.activeTab = safeTab;

        const targetFriend = window.imApp.getFriendById(friendOrId);
        if (targetFriend) {
            ensureProfilePanelData(targetFriend).activeTab = safeTab;
        }

        return safeTab;
    }

    function getProfilePanelEvents(friend) {
        const panel = window.imChat.getProfilePanelData(friend);
        return Array.isArray(panel.events) ? panel.events : [];
    }

    function getProfilePanelMetrics() {
        return [];
    }

    function buildCherishedMemoryEntryFromEvent(eventItem, friend) {
        if (!eventItem) return null;

        const payload = eventItem.memoryPayload && typeof eventItem.memoryPayload === 'object'
            ? eventItem.memoryPayload
            : null;

        const entryId = `cherished-${eventItem.id || Date.now()}`;
        const title = payload?.title || eventItem.title || '珍视回忆';
        const content = payload?.content || eventItem.requestText || eventItem.description || '';
        const detail = payload?.detail || eventItem.detail || '';
        const reason = payload?.reason || '';
        const createdAt = payload?.createdAt || eventItem.time || '';
        const sourceThought = payload?.sourceThought
            || friend?.profilePanel?.thought
            || friend?.latestThought
            || '';

        if (!content.trim()) return null;

        return {
            id: entryId,
            title,
            content,
            detail,
            reason,
            sourceEventId: String(payload?.sourceEventId || eventItem.id || ''),
            createdAt,
            sourceThought
        };
    }

    function mergeCherishedMemoryText(existingText, entry) {
        const baseText = typeof existingText === 'string' ? existingText.trim() : '';
        if (!entry || !entry.content) return baseText;

        const parts = [
            entry.title ? `【${entry.title}】` : '',
            entry.content || '',
            entry.reason ? `原因：${entry.reason}` : ''
        ].filter(Boolean);

        const block = parts.join('\n').trim();
        if (!block) return baseText;
        if (baseText.includes(entry.content)) return baseText;

        return baseText ? `${baseText}\n\n${block}` : block;
    }

    async function confirmMemoryRequestEvent(friendOrId, eventId) {
        const targetFriend = window.imApp.getFriendById(friendOrId);
        if (!targetFriend || !eventId) return false;

        const saved = await commitStatusFriendChange(targetFriend, (friend) => {
            if (!friend) return;
            friend.memory = window.imApp.normalizeFriendData(friend).memory;

            const panel = ensureProfilePanelData(friend);
            const events = Array.isArray(panel.events) ? panel.events : [];
            const eventIndex = events.findIndex((eventItem) => String(eventItem.id) === String(eventId));
            if (eventIndex < 0) return;

            const targetEvent = events[eventIndex];
            const nextEntry = buildCherishedMemoryEntryFromEvent(targetEvent, friend);
            if (!nextEntry) {
                events.splice(eventIndex, 1);
                panel.events = events;
                return;
            }

            const existingEntries = Array.isArray(friend.memory.cherishedEntries)
                ? friend.memory.cherishedEntries
                : [];

            const duplicated = existingEntries.some((entry) => {
                if (!entry) return false;
                if (entry.sourceEventId && String(entry.sourceEventId) === String(targetEvent.id)) return true;
                return String(entry.content || '').trim() && String(entry.content || '').trim() === String(nextEntry.content || '').trim();
            });

            if (!duplicated) {
                existingEntries.push(nextEntry);
            }

            friend.memory.cherishedEntries = existingEntries;
            friend.memory.cherished = mergeCherishedMemoryText(friend.memory.cherished, nextEntry);
            
            events.splice(eventIndex, 1);
            panel.events = events;
        }, { silent: true });

        return saved;
    }

    async function cancelMemoryRequestEvent(friendOrId, eventId) {
        const targetFriend = window.imApp.getFriendById(friendOrId);
        if (!targetFriend || !eventId) return false;

        return commitStatusFriendChange(targetFriend, (friend) => {
            if (!friend) return;
            const panel = ensureProfilePanelData(friend);
            let events = Array.isArray(panel.events) ? panel.events : [];
            events = events.filter((eventItem) => String(eventItem.id) !== String(eventId));
            panel.events = events;
        }, { silent: true });
    }

    function showProfileEventDetail(friend, eventId, panelEl) {
        if (!friend || !eventId || !panelEl) return;

        const overlay = panelEl.querySelector('.chat-profile-event-detail-overlay');
        const titleEl = panelEl.querySelector('.chat-profile-event-detail-title');
        const timeEl = panelEl.querySelector('.chat-profile-event-detail-time');
        const descEl = panelEl.querySelector('.chat-profile-event-detail-desc');
        const detailEl = panelEl.querySelector('.chat-profile-event-detail-detail');

        if (!overlay || !titleEl || !timeEl || !descEl || !detailEl) return;

        const events = window.imChat.getProfilePanelEvents(friend);
        const targetEvent = events.find((eventItem) => String(eventItem.id) === String(eventId));
        if (!targetEvent) return;

        titleEl.textContent = targetEvent.title || '事件详情';
        timeEl.textContent = targetEvent.time || '';
        descEl.textContent = targetEvent.requestText || targetEvent.description || '暂无内容';
        detailEl.textContent = targetEvent.detail
            || targetEvent.memoryPayload?.detail
            || targetEvent.memoryPayload?.reason
            || '暂无更多详情';

        overlay.style.display = 'flex';
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
    }

    function hideProfileEventDetail(panelEl) {
        if (!panelEl) return;
        const overlay = panelEl.querySelector('.chat-profile-event-detail-overlay');
        if (!overlay) return;

        overlay.classList.remove('active');
        setTimeout(() => {
            if (!overlay.classList.contains('active')) {
                overlay.style.display = 'none';
            }
        }, 220);
    }

    function buildProfilePanelBody(friend, activeTab) {
        const panel = window.imChat.getProfilePanelData(friend);
        const safeTab = ['thought', 'events'].includes(activeTab) ? activeTab : 'thought';

        if (safeTab === 'events') {
            const events = window.imChat.getProfilePanelEvents(friend);
            if (events.length === 0) {
                return `
                    <div class="chat-profile-panel-empty">
                        <div class="chat-profile-panel-empty-title">暂无事件</div>
                        <div class="chat-profile-panel-empty-desc">这里会展示和这个角色相关的近期事件记录。</div>
                    </div>
                `;
            }

            return `
                <div class="chat-profile-panel-events">
                    ${events.map((eventItem) => {
                        if (eventItem.type === 'memory_request') {
                            const statusLabel = eventItem.status === 'confirmed'
                                ? '<span class="chat-profile-memory-request-badge is-confirmed">已记住</span>'
                                : eventItem.status === 'cancelled'
                                    ? '<span class="chat-profile-memory-request-badge is-cancelled">已取消</span>'
                                    : '<span class="chat-profile-memory-request-badge">待处理</span>';

                            const actionHtml = eventItem.status === 'pending'
                                ? `
                                    <div class="chat-profile-memory-request-actions">
                                        <button type="button" class="chat-profile-memory-request-btn is-confirm" data-action="confirm-memory-request" data-event-id="${eventItem.id}">${eventItem.confirmText || '确认'}</button>
                                        <button type="button" class="chat-profile-memory-request-btn is-cancel" data-action="cancel-memory-request" data-event-id="${eventItem.id}">${eventItem.cancelText || '取消'}</button>
                                    </div>
                                `
                                : '';

                            return `
                                <div class="chat-profile-memory-request-card" data-event-id="${eventItem.id}" data-event-type="memory_request">
                                    <div class="chat-profile-memory-request-top">
                                        <div class="chat-profile-memory-request-title">${eventItem.title || '想记住某件事'}</div>
                                        ${statusLabel}
                                    </div>
                                    <div class="chat-profile-memory-request-content">${eventItem.requestText || eventItem.description || '想把这一刻记住。'}</div>
                                    ${eventItem.detail ? `<div class="chat-profile-memory-request-detail">${eventItem.detail}</div>` : ''}
                                    <div class="chat-profile-memory-request-footer">
                                        ${eventItem.time ? `<div class="chat-profile-memory-request-time">${eventItem.time}</div>` : '<div></div>'}
                                        <button type="button" class="chat-profile-memory-request-detail-trigger" data-action="open-event-detail" data-event-id="${eventItem.id}">查看详情</button>
                                    </div>
                                    ${actionHtml}
                                </div>
                            `;
                        }

                        return `
                            <div class="chat-profile-event-item" data-event-id="${eventItem.id}">
                                <div class="chat-profile-event-dot"></div>
                                <div class="chat-profile-event-main">
                                    <div class="chat-profile-event-title-row">
                                        <div class="chat-profile-event-title">${eventItem.title || '新的事件'}</div>
                                        ${eventItem.time ? `<div class="chat-profile-event-time">${eventItem.time}</div>` : ''}
                                    </div>
                                    ${eventItem.description ? `<div class="chat-profile-event-desc">${eventItem.description}</div>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        if (!panel.thought || !panel.thought.trim()) {
            return `
                <div class="chat-profile-panel-empty">
                    <div class="chat-profile-panel-empty-title">暂无心声</div>
                    <div class="chat-profile-panel-empty-desc">这里会展示这个角色此刻的心声。</div>
                </div>
            `;
        }

        return `
            <div class="chat-profile-panel-section">
                <div class="gmp-inner-voice chat-profile-panel-thought">${panel.thought.trim()}</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 2px;">
                    <div style="background: #f2f2f7; border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;">
                        <div style="font-size: 11px; color: #8e8e93; font-weight: 700;">位置</div>
                        <div style="font-size: 13px; color: #333; line-height: 1.4; word-break: break-all; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${panel.location || '未知'}</div>
                    </div>
                    <div style="background: #f2f2f7; border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;">
                        <div style="font-size: 11px; color: #8e8e93; font-weight: 700;">动作</div>
                        <div style="font-size: 13px; color: #333; line-height: 1.4; word-break: break-all; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${panel.action || '暂无'}</div>
                    </div>
                    <div style="background: #f2f2f7; border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;">
                        <div style="font-size: 11px; color: #8e8e93; font-weight: 700;">心情</div>
                        <div style="font-size: 13px; color: #333; line-height: 1.4; word-break: break-all; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${panel.mood || '平静'}</div>
                    </div>
                    <div style="background: #f2f2f7; border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;">
                        <div style="font-size: 11px; color: #8e8e93; font-weight: 700;">表情</div>
                        <div style="font-size: 13px; color: #333; line-height: 1.4; word-break: break-all; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${panel.expression || '自然'}</div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderProfilePanel(friend, panelEl) {
        if (!friend || !panelEl) return;

        const panel = window.imChat.getProfilePanelData(friend);
        const uiState = window.imChat.getProfilePanelUiState(friend);
        const activeTab = ['thought', 'events'].includes(uiState.activeTab)
            ? uiState.activeTab
            : (['thought', 'events'].includes(panel.activeTab) ? panel.activeTab : 'thought');

        uiState.activeTab = activeTab;
        panel.activeTab = activeTab;

        const avatarUrl = friend.avatarUrl || 'https://picsum.photos/seed/char/100/100';
        
        let isSleeping = false;
        if (typeof window.imApp.isCharacterSleeping === 'function') {
            isSleeping = window.imApp.isCharacterSleeping(friend);
        } else if (friend.memory && friend.memory.schedule && friend.memory.schedule.enabled) {
            const now = new Date();
            const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
            
            const parseTime = (timeStr) => {
                if (!timeStr) return 0;
                const [h, m] = timeStr.split(':').map(Number);
                return (h || 0) * 60 + (m || 0);
            };
            
            const sleepMin = parseTime(friend.memory.schedule.sleepTime || '23:00');
            const wakeMin = parseTime(friend.memory.schedule.wakeTime || '07:00');
            
            if (sleepMin > wakeMin) {
                isSleeping = currentTotalMinutes >= sleepMin || currentTotalMinutes < wakeMin;
            } else {
                isSleeping = currentTotalMinutes >= sleepMin && currentTotalMinutes < wakeMin;
            }
        }

        const name = friend.nickname || friend.realName || 'Unknown';
        const signature = friend.signature || '这个人很懒，什么都没写';
        const onlineLabel = isSleeping ? 'offline' : ((panel.status || friend.status || 'online').toString().trim() || 'online');
        
        const affection = typeof friend.profilePanel?.affection === 'number' ? friend.profilePanel.affection : (typeof panel.affection === 'number' ? panel.affection : 0);
        const affectionChange = typeof friend.profilePanel?.affectionChange === 'number' ? friend.profilePanel.affectionChange : (typeof panel.affectionChange === 'number' ? panel.affectionChange : 0);
        const affectionChangeStr = affectionChange >= 0 ? `+${affectionChange}` : `${affectionChange}`;

        panelEl.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 320px; margin: 0 auto;">
                <div class="chat-profile-panel-card" style="width: 100%;">
                    <div class="gmp-header chat-profile-panel-header" style="position: relative;">
                        <div class="gmp-avatar-wrapper">
                            <div class="gmp-avatar"><img src="${avatarUrl}"></div>
                            <div class="gmp-status-bubble chat-profile-panel-header-status">${onlineLabel}</div>
                        </div>
                        <button type="button" class="chat-profile-panel-close" aria-label="关闭">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="gmp-body chat-profile-panel-body">
                        <div class="gmp-name-row" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div class="gmp-name">${name}</div>
                            <div style="display: flex; flex-direction: column; align-items: flex-end;">
                                <div style="background: #f2f2f7; color: #8e8e93; padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 4px;">
                                    <i class="fas fa-heart"></i> ${affection}
                                </div>
                                ${affectionChange !== 0 ? `<div style="font-size: 10px; color: #8e8e93; margin-top: 4px; font-weight: 600;">${affectionChangeStr}</div>` : ''}
                            </div>
                        </div>
                        <div class="gmp-signature">${signature}</div>
                        <div class="chat-profile-panel-content">
                            ${window.imChat.buildProfilePanelBody(friend, activeTab)}
                        </div>
                    </div>
                    <div class="chat-profile-event-detail-overlay" style="display:none;">
                        <div class="chat-profile-event-detail-card">
                            <button type="button" class="chat-profile-event-detail-close" aria-label="关闭">
                                <i class="fas fa-times"></i>
                            </button>
                            <div class="chat-profile-event-detail-label">记忆详情</div>
                            <div class="chat-profile-event-detail-title">事件详情</div>
                            <div class="chat-profile-event-detail-time"></div>
                            <div class="chat-profile-event-detail-desc"></div>
                            <div class="chat-profile-event-detail-detail"></div>
                        </div>
                    </div>
                </div>
                
                <div class="chat-profile-panel-floating-tabs" style="display: flex; flex-direction: row; gap: 20px; margin-top: 24px; z-index: 100;">
                    <button type="button" class="chat-profile-panel-tab-btn ${activeTab === 'thought' ? 'active' : ''}" data-tab="thought" style="width: 52px; height: 52px; border-radius: 50%; border: none; background: ${activeTab === 'thought' ? '#111' : '#fff'}; color: ${activeTab === 'thought' ? '#fff' : '#111'};  display: flex; justify-content: center; align-items: center; font-size: 22px; cursor: pointer; transition: transform 0.2s, background 0.2s;">
                        <i class="fas fa-heart"></i>
                    </button>
                    <button type="button" class="chat-profile-panel-tab-btn ${activeTab === 'events' ? 'active' : ''}" data-tab="events" style="width: 52px; height: 52px; border-radius: 50%; border: none; background: ${activeTab === 'events' ? '#111' : '#fff'}; color: ${activeTab === 'events' ? '#fff' : '#111'};  display: flex; justify-content: center; align-items: center; font-size: 22px; cursor: pointer; transition: transform 0.2s, background 0.2s;">
                        <i class="fas fa-flag"></i>
                    </button>
                </div>
            </div>
        `;

        const closeBtn = panelEl.querySelector('.chat-profile-panel-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.imChat.hideProfilePanel(friend, panelEl);
            });
        }

        const detailOverlay = panelEl.querySelector('.chat-profile-event-detail-overlay');
        const detailCloseBtn = panelEl.querySelector('.chat-profile-event-detail-close');
        if (detailOverlay) {
            detailOverlay.addEventListener('click', (e) => {
                if (e.target === detailOverlay) {
                    window.imChat.hideProfileEventDetail(panelEl);
                }
            });
        }
        if (detailCloseBtn) {
            detailCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.imChat.hideProfileEventDetail(panelEl);
            });
        }

        const eventActionButtons = panelEl.querySelectorAll('[data-action="confirm-memory-request"], [data-action="cancel-memory-request"], [data-action="open-event-detail"]');
        eventActionButtons.forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = btn.getAttribute('data-action') || '';
                const eventId = btn.getAttribute('data-event-id') || '';
                const latestFriend = window.imApp.getFriendById(friend) || friend;

                if (action === 'open-event-detail') {
                    window.imChat.showProfileEventDetail(latestFriend, eventId, panelEl);
                    return;
                }

                let saved = false;
                if (action === 'confirm-memory-request') {
                    saved = await window.imChat.confirmMemoryRequestEvent(latestFriend, eventId);
                    if (saved && window.showToast) window.showToast('已写入下载项');
                } else if (action === 'cancel-memory-request') {
                    saved = await window.imChat.cancelMemoryRequestEvent(latestFriend, eventId);
                }

                if (!saved) {
                    if (window.showToast) window.showToast(action === 'confirm-memory-request' ? '保存珍视回忆失败' : '事件状态更新失败');
                    return;
                }

                const refreshedFriend = window.imApp.getFriendById(friend) || latestFriend;
                window.imChat.renderProfilePanel(refreshedFriend, panelEl);

                if (
                    window.imData.currentSettingsFriend &&
                    String(window.imData.currentSettingsFriend.id) === String(refreshedFriend.id) &&
                    typeof window.imApp.initChatSettingsForFriend === 'function'
                ) {
                    window.imApp.initChatSettingsForFriend(refreshedFriend);
                }
            });
        });

        const eventItems = panelEl.querySelectorAll('.chat-profile-event-item');
        eventItems.forEach((item) => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const eventId = item.getAttribute('data-event-id');
                const latestFriend = window.imApp.getFriendById(friend) || friend;
                window.imChat.showProfileEventDetail(latestFriend, eventId, panelEl);
            });
        });

        const tabButtons = panelEl.querySelectorAll('.chat-profile-panel-tab-btn');
        tabButtons.forEach((btn) => {
            const stopProfileTabEvent = (e) => {
                e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') {
                    e.stopImmediatePropagation();
                }
            };

            const handleProfileTabClick = (e) => {
                e.preventDefault();
                stopProfileTabEvent(e);
            };

            btn.addEventListener('pointerdown', stopProfileTabEvent, true);
            btn.addEventListener('touchstart', stopProfileTabEvent, { capture: true, passive: false });

            btn.addEventListener('click', async (e) => {
                handleProfileTabClick(e);
                const nextTab = btn.getAttribute('data-tab') || 'thought';
                window.imChat.setProfilePanelTab(friend, nextTab);

                await commitStatusFriendChange(friend, (targetFriend) => {
                    if (!targetFriend) return;
                    const nextPanel = ensureProfilePanelData(targetFriend);
                    nextPanel.activeTab = nextTab;
                }, { silent: true });

                const latestFriend = window.imApp.getFriendById(friend) || friend;
                window.imChat.renderProfilePanel(latestFriend, panelEl);
            });
        });
    }

    function showProfilePanel(friend, panelEl) {
        if (!friend || !panelEl) return;
        const uiState = window.imChat.getProfilePanelUiState(friend);
        uiState.open = true;
        window.imChat.renderProfilePanel(friend, panelEl);
        panelEl.style.display = 'flex';
        requestAnimationFrame(() => {
            panelEl.classList.add('active');
        });
    }

    function hideProfilePanel(friendOrId, panelEl) {
        const uiState = window.imChat.getProfilePanelUiState(friendOrId);
        uiState.open = false;
        if (!panelEl) return;
        panelEl.classList.remove('active');
        setTimeout(() => {
            if (!panelEl.classList.contains('active')) {
                panelEl.style.display = 'none';
            }
        }, 220);
    }

    function toggleProfilePanel(friend, panelEl) {
        if (!friend || !panelEl) return;
        const uiState = window.imChat.getProfilePanelUiState(friend);
        if (uiState.open && panelEl.classList.contains('active')) {
            window.imChat.hideProfilePanel(friend, panelEl);
        } else {
            window.imChat.showProfilePanel(friend, panelEl);
        }
    }

    function applyFriendStatusBarCss() {
        // 状态栏资料卡当前没有独立的动态 CSS 注入需求；
        // 保留该方法作为稳定兼容出口，供现有调用方继续安全调用。
        return;
    }

    window.imChat.getProfilePanelData = getProfilePanelData;
    window.imChat.getProfilePanelUiState = getProfilePanelUiState;
    window.imChat.setProfilePanelTab = setProfilePanelTab;
    window.imChat.getProfilePanelEvents = getProfilePanelEvents;
    window.imChat.getProfilePanelMetrics = getProfilePanelMetrics;
    window.imChat.buildCherishedMemoryEntryFromEvent = buildCherishedMemoryEntryFromEvent;
    window.imChat.mergeCherishedMemoryText = mergeCherishedMemoryText;
    window.imChat.confirmMemoryRequestEvent = confirmMemoryRequestEvent;
    window.imChat.cancelMemoryRequestEvent = cancelMemoryRequestEvent;
    window.imChat.showProfileEventDetail = showProfileEventDetail;
    window.imChat.hideProfileEventDetail = hideProfileEventDetail;
    window.imChat.buildProfilePanelBody = buildProfilePanelBody;
    window.imChat.renderProfilePanel = renderProfilePanel;
    window.imChat.showProfilePanel = showProfilePanel;
    window.imChat.hideProfilePanel = hideProfilePanel;
    window.imChat.toggleProfilePanel = toggleProfilePanel;
    window.imChat.applyFriendStatusBarCss = applyFriendStatusBarCss;
    window.imApp.applyFriendStatusBarCss = applyFriendStatusBarCss;
});
