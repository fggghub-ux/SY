
// ==========================================
// IMESSAGE: 4_chat_interface.js
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const { apiConfig, userState } = window;
    window.imChat = window.imChat || {};
    const imChat = window.imChat;

    function closeStaleGroupCallSheets() {
        ['group-call-invite-sheet', 'group-more-sheet'].forEach((id) => {
            const sheet = document.getElementById(id);
            if (!sheet) return;

            sheet.classList.remove('active');
            sheet.style.pointerEvents = '';
        });
    }

    function getGroupAvatarInitial(friend) {
        return String(friend?.nickname || friend?.realName || 'G').charAt(0).toUpperCase();
    }

    function renderGroupHeaderAvatarInnerHtml(friend) {
        const avatarUrl = friend?.avatarUrl || '';
        if (avatarUrl) {
            return `<img class="im-group-header-avatar-img" src="${avatarUrl}" alt="">`;
        }

        return `<div class="im-group-header-avatar-fallback">${getGroupAvatarInitial(friend)}</div>`;
    }

    imChat.refreshGroupHeaderAvatar = function(groupOrId) {
        const groupId = groupOrId && typeof groupOrId === 'object' ? groupOrId.id : groupOrId;
        if (groupId == null) return false;

        const latestGroup = (window.imData?.friends || []).find(item => String(item.id) === String(groupId))
            || (groupOrId && typeof groupOrId === 'object' ? groupOrId : null);
        if (!latestGroup || latestGroup.type !== 'group') return false;

        const page = document.getElementById(`chat-interface-${latestGroup.id}`);
        if (!page) return false;

        const inner = page.querySelector('.group-header-right-avatar-inner');
        if (!inner) return false;

        inner.innerHTML = renderGroupHeaderAvatarInnerHtml(latestGroup);
        return true;
    };

async function openChatTab(friend) {
        const chatsContent = document.getElementById('chats-content');
        const navChatsBtn = document.getElementById('nav-chats-btn');
        closeStaleGroupCallSheets();

        if (window.imApp.ensureFriendMessagesLoaded) {
            await window.imApp.ensureFriendMessagesLoaded(friend, {
                onLoaded: (_, loadedFriend) => {
                    if (window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(loadedFriend.id)) {
                        window.imData.currentActiveFriend = loadedFriend;
                    }
                }
            });
        }

        const activeFriend = (window.imData.friends || []).find(
            item => String(item.id) === String(friend.id)
        ) || friend;

        window.imData.currentActiveFriend = activeFriend;
        friend = activeFriend;
        if (window.imApp.clearFriendUnread) {
            await window.imApp.clearFriendUnread(friend.id, { silent: true });
        }
        let pageId = `chat-interface-${friend.id}`;
        let page = document.getElementById(pageId);
        const isGroupChat = friend.type === 'group';
        const isNpcChat = friend.type === 'npc';
        const interfaceClassName = `active-chat-interface im-chat-interface ${isGroupChat ? 'im-chat-group' : (isNpcChat ? 'im-chat-npc' : 'im-chat-single')}`;
        const isSleeping = window.imApp.isCharacterSleeping(friend);
        const statusLabel = isSleeping ? 'offline' : 'online';
        const statusColor = isSleeping ? '#8e8e93' : '#34c759';

        if (page) {
            page.className = interfaceClassName;
            page.style.setProperty('--im-chat-status-color', statusColor);
            const msgContainer = page.querySelector('.ins-chat-messages');
            if (msgContainer) msgContainer.innerHTML = '';
        }

        if (!page) {
            page = document.createElement('div');
            page.id = pageId;
            page.className = interfaceClassName;
            page.style.display = 'none';
            page.style.setProperty('--im-chat-status-color', statusColor);
            
            let avatarHtml;
            if (isGroupChat) {
                avatarHtml = renderGroupHeaderAvatarInnerHtml(friend);
            } else {
                avatarHtml = friend.avatarUrl 
                    ? `<img src="${friend.avatarUrl}" style="display: block;">` 
                    : `<i class="fas fa-user"></i>`;
            }

            const headerStyle = isGroupChat
                ? `position: relative; top: 0; padding: 0 16px; align-items: center; justify-content: space-between; display: flex; pointer-events: none; width: 100%;`
                : `position: relative; top: 0; padding: 0 16px; align-items: center;`;
                
            let titleHtml = '';
            if (isGroupChat) {
                titleHtml = `<div class="im-chat-group-title-wrap" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 0; padding: 4px 16px; background: rgba(242, 242, 247, 0.85);   border-radius: 40px;  pointer-events: auto;">
                        <div class="ins-chat-name" style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${friend.nickname}</div>
                        <div class="ins-chat-sign" style="font-size: 11px; font-weight: 500; color: #8e8e93; margin-top: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px;">${(friend.members ? friend.members.length : 0) + 1} member${(friend.members ? friend.members.length : 0) + 1 > 1 ? 's' : ''}</div>
                   </div>`;
            } else if (friend.type === 'official') {
                titleHtml = `<div class="im-chat-avatar-wrap">
                        <div class="ins-chat-avatar" style="pointer-events: none;">
                            ${avatarHtml}
                        </div>
                   </div>
                   <div class="im-chat-title-wrap">
                        <div class="ins-chat-name">${friend.nickname}</div>
                        <div class="ins-chat-sign"><div class="im-chat-status-dot"></div><span>${statusLabel}</span></div>
                   </div>`;
            } else if (isNpcChat) {
                titleHtml = `<div class="im-chat-avatar-wrap">
                        <div class="ins-chat-avatar">
                            ${avatarHtml}
                        </div>
                   </div>
                   <div class="im-chat-title-wrap">
                        <div class="ins-chat-name">${friend.nickname}</div>
                   </div>`;
            } else {
                titleHtml = `<div class="im-chat-avatar-wrap">
                        <div class="ins-chat-avatar">
                            ${avatarHtml}
                        </div>
                   </div>
                   <div class="im-chat-title-wrap">
                        <div class="ins-chat-name">${friend.nickname}</div>
                        <div class="ins-chat-sign"><div class="im-chat-status-dot"></div><span>${statusLabel}</span></div>
                   </div>`;
            }

            // Make the right avatar a floating bubble as well
            let groupRightAvatarHtml = '';
            if (isGroupChat) {
                groupRightAvatarHtml = `<div class="group-header-right-avatar">
                        <div class="group-header-right-avatar-inner">${avatarHtml}</div>
                   </div>`;
            } else if (friend.type === 'official') {
                groupRightAvatarHtml = `<div class="chat-menu-btn im-chat-icon-btn"><i class="fas fa-bars"></i></div>
                   <div class="chat-cancel-batch-btn im-chat-cancel-batch-btn" style="display:none;">取消</div>`;
            } else if (isNpcChat) {
                groupRightAvatarHtml = `<div class="chat-menu-btn im-chat-icon-btn"><i class="fas fa-bars"></i></div>
                   <div class="chat-cancel-batch-btn im-chat-cancel-batch-btn" style="display:none;">取消</div>`;
            } else {
                groupRightAvatarHtml = `<div class="chat-call-btn im-chat-icon-btn"><i class="fas fa-phone-alt"></i></div>
                   <div class="chat-menu-btn im-chat-icon-btn"><i class="fas fa-bars"></i></div>
                   <div class="chat-cancel-batch-btn im-chat-cancel-batch-btn" style="display:none;">取消</div>`;
            }

            const backBtnHtml = isGroupChat
                ? `<div class="chat-back-btn" style="cursor: pointer; width: 36px; height: 36px; background: rgba(242, 242, 247, 0.85);   border-radius: 50%;  display: flex; justify-content: center; align-items: center; pointer-events: auto;">
                        <i class="fas fa-chevron-left" style="pointer-events: none; margin-right: 2px;"></i>
                   </div>`
                : `<div class="chat-back-btn im-chat-back-btn"><i class="fas fa-chevron-left" style="pointer-events: none;"></i></div>`;

            let topBarHtml = '';
            if (isGroupChat) {
                topBarHtml = `
                    <div class="chat-top-bar" style="${headerStyle}">
                        ${backBtnHtml}
                        <div style="display: flex; align-items: center; justify-content: center; flex: 1; pointer-events: none;" class="ins-chat-header" id="active-chat-header">
                            ${titleHtml}
                        </div>
                        <div id="active-chat-right-avatar-container">
                            ${groupRightAvatarHtml}
                        </div>
                    </div>
                `;
            } else {
                topBarHtml = `
                    <div class="chat-top-bar im-chat-top-bar">
                        <div class="im-chat-header-left">
                            ${backBtnHtml}
                            <div class="ins-chat-header im-chat-header-main">
                                ${titleHtml}
                            </div>
                        </div>
                        <div class="im-chat-actions">
                            ${groupRightAvatarHtml}
                        </div>
                    </div>
                `;
            }

            page.innerHTML = `
                <div class="chat-sticky-container ${isGroupChat ? 'is-group' : 'is-friend'}">
                    ${topBarHtml}
                </div>
                <div class="ins-chat-messages"></div>
                <div class="ins-chat-input-container">
                    <div class="reply-preview-container" style="display:none; padding: 10px 14px; background: #f2f2f7; border-radius: 18px; margin-bottom: 10px; font-size: 13px; color: #8e8e93; position: relative; margin-left: 10px; margin-right: 10px; max-width: fit-content; border: 1px solid #e5e5ea; ">
                        <div class="reply-preview-text" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 24px; color: #333; max-width: 250px;"></div>
                        <div class="reply-cancel-btn" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; border-radius: 50%; background: #ccc; color: #fff; display: flex; justify-content: center; align-items: center; cursor: pointer; font-size: 10px;"><i class="fas fa-times"></i></div>
                    </div>
                    <div class="ins-chat-input-wrapper">
                        ${isNpcChat ? '' : '<div class="ins-input-icon plus-btn"><i class="fas fa-plus"></i></div>'}
                        <input type="text" placeholder="发送消息..." class="ins-message-input chat-input">
                        <div class="im-chat-input-actions">
                            <div class="send-btn-icon send-btn"><i class="fas fa-paper-plane"></i></div>
                            <div class="send-btn-icon mic-btn"><i class="fas ${isNpcChat ? 'fa-magic' : 'fa-microphone'}"></i></div>
                        </div>
                    </div>
                    <div class="chat-batch-action-bar" style="display:none; justify-content: space-between; align-items: center; padding: 15px 40px; padding-bottom: 15px; background: rgba(242, 242, 247, 0.95);   border-top: 1px solid rgba(0,0,0,0.1); position: absolute; bottom: 0; left: 0; width: 100%; z-index: 100; box-sizing: border-box;">
                        <i class="fas fa-share batch-forward-btn" style="font-size: 22px; color: #8e8e93; cursor: pointer;"></i>
                        <i class="far fa-star batch-star-btn" style="font-size: 22px; color: #8e8e93; cursor: pointer;"></i>
                        <i class="far fa-trash-alt batch-delete-btn" style="font-size: 22px; color: #ff3b30; cursor: pointer;"></i>
                    </div>
                </div>
            `;

            if(chatsContent) chatsContent.appendChild(page);
            if (window.imApp.applyGlobalChatCss) {
                window.imApp.applyGlobalChatCss(window.u2ThemeState || {});
            }

            const backBtn = page.querySelector('.chat-back-btn');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    if (profilePanelOverlay) {
                        const latestFriend = window.imApp.getFriendById(friend) || friend;
                        window.imChat.hideProfilePanel(latestFriend, profilePanelOverlay);
                    }
                    window.imData.currentActiveFriend = null;
                    window.imChat.updateChatsView();
                });
            }

            const cancelBatchBtn = page.querySelector('.chat-cancel-batch-btn');
            const menuBtn = page.querySelector('.chat-menu-btn');
            const callBtn = page.querySelector('.chat-call-btn');
            const batchActionBar = page.querySelector('.chat-batch-action-bar');
            const inputWrapper = page.querySelector('.ins-chat-input-wrapper');
            const batchDeleteBtn = page.querySelector('.batch-delete-btn');

            function exitBatchSelectMode() {
                window.imData.batchSelectMode = false;
                if (cancelBatchBtn) cancelBatchBtn.style.display = 'none';
                if (menuBtn) menuBtn.style.display = 'block';
                if (callBtn) callBtn.style.display = 'block';
                if (batchActionBar) batchActionBar.style.display = 'none';
                if (inputWrapper) inputWrapper.style.display = 'flex';

                const checkboxes = page.querySelectorAll('.chat-checkbox-wrapper');
                checkboxes.forEach(cb => {
                    cb.style.display = 'none';
                    const icon = cb.querySelector('i');
                    if (icon) {
                        icon.className = 'far fa-circle';
                        icon.style.color = '#c7c7cc';
                    }
                });
            }

            window.imChat.ensureTransferDetailOverlayForExistingPage(page, friend);
            window.imChat.ensureRedPacketDetailOverlayForExistingPage(page, friend);

            if (callBtn) {
                callBtn.addEventListener('click', () => {
                    let callOverlay = document.getElementById('custom-call-overlay');
                    if (!callOverlay) {
                        callOverlay = document.createElement('div');
                        callOverlay.id = 'custom-call-overlay';
                        callOverlay.style.position = 'fixed';
                        callOverlay.style.inset = '0';
                        callOverlay.style.backgroundColor = 'rgba(0,0,0,0.4)';
                        callOverlay.style.zIndex = '10000';
                        callOverlay.style.display = 'flex';
                        callOverlay.style.alignItems = 'flex-end';
                        callOverlay.style.justifyContent = 'center';
                        
                        const sheet = document.createElement('div');
                        sheet.style.width = '100%';
                        sheet.style.backgroundColor = 'transparent';
                        sheet.style.padding = '10px';
                        sheet.style.boxSizing = 'border-box';
                        sheet.style.paddingBottom = 'max(10px, env(safe-area-inset-bottom))';
                        
                        const menuGroup = document.createElement('div');
                        menuGroup.style.backgroundColor = '#fff';
                        menuGroup.style.borderRadius = '14px';
                        menuGroup.style.overflow = 'hidden';
                        
                        const videoBtn = document.createElement('div');
                        videoBtn.innerText = '视频通话';
                        videoBtn.style.padding = '18px 0';
                        videoBtn.style.textAlign = 'center';
                        videoBtn.style.fontSize = '20px';
                        videoBtn.style.color = '#007aff';
                        videoBtn.style.borderBottom = '1px solid #e5e5ea';
                        videoBtn.style.cursor = 'pointer';
                        videoBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            callOverlay.style.display = 'none';
                            if(window.showToast) window.showToast('视频通话功能开发中...');
                        });
                        
                        const voiceBtn = document.createElement('div');
                        voiceBtn.innerText = '语音通话';
                        voiceBtn.style.padding = '18px 0';
                        voiceBtn.style.textAlign = 'center';
                        voiceBtn.style.fontSize = '20px';
                        voiceBtn.style.color = '#007aff';
                        voiceBtn.style.cursor = 'pointer';
                        voiceBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            callOverlay.style.display = 'none';
                            if (window.imChat && window.imChat.openVoiceCall) {
                                window.imChat.openVoiceCall(friend);
                            } else {
                                if(window.showToast) window.showToast('语音通话准备中...');
                            }
                        });
                        
                        menuGroup.appendChild(videoBtn);
                        menuGroup.appendChild(voiceBtn);
                        sheet.appendChild(menuGroup);
                        callOverlay.appendChild(sheet);
                        
                        document.body.appendChild(callOverlay);
                        
                        callOverlay.addEventListener('click', (e) => {
                            if (e.target === callOverlay) {
                                callOverlay.style.display = 'none';
                            }
                        });
                    }
                    callOverlay.style.display = 'flex';
                });
            }

            if (cancelBatchBtn) {
                cancelBatchBtn.addEventListener('click', () => {
                    exitBatchSelectMode();
                });
            }

            if (batchDeleteBtn) {
                batchDeleteBtn.addEventListener('click', () => {
                    const selectedIcons = page.querySelectorAll('.chat-checkbox-wrapper i.fa-check-circle');
                    const selectedDescriptors = Array.from(selectedIcons)
                        .map((icon) => {
                            const row = icon.closest('.chat-row');
                            return {
                                id: row?.getAttribute('data-message-id') || null,
                                timestamp: icon.getAttribute('data-timestamp') || row?.getAttribute('data-timestamp') || null
                            };
                        })
                        .filter((descriptor) => descriptor.id || descriptor.timestamp);
                    if (selectedDescriptors.length === 0) {
                        if(window.showToast) window.showToast('请选择要删除的消息');
                        return;
                    }
                    if (window.showCustomModal) {
                        window.showCustomModal({
                            title: '删除消息',
                            message: `确定要删除选中的 ${selectedDescriptors.length} 条消息吗？`,
                            confirmText: '删除',
                            cancelText: '取消',
                            onConfirm: async () => {
                                const saved = window.imApp.removeFriendMessages
                                    ? await window.imApp.removeFriendMessages(
                                        friend.id,
                                        selectedDescriptors,
                                        { silent: true }
                                    )
                                    : (window.imApp.commitFriendChange
                                        ? await window.imApp.commitFriendChange(friend.id, (targetFriend) => {
                                            if (!targetFriend || !Array.isArray(targetFriend.messages)) return;
                                            targetFriend.messages = targetFriend.messages.filter((m) => !selectedDescriptors.some((descriptor) => {
                                                if (!m) return true;
                                                if (descriptor.id && String(m.id) === String(descriptor.id)) return true;
                                                if (descriptor.timestamp && String(m.timestamp) === String(descriptor.timestamp)) return true;
                                                return false;
                                            }));
                                        }, { silent: true })
                                        : false);

                                if (!saved) {
                                    if (window.showToast) window.showToast('删除失败，消息已恢复');
                                    const failedContainer = page.querySelector('.ins-chat-messages');
                                    if (failedContainer) {
                                        failedContainer.innerHTML = '';
                                        const failedFriend = window.imApp.getFriendById ? (window.imApp.getFriendById(friend.id) || friend) : friend;
                                        window.imChat.renderChatHistory(failedFriend, failedContainer);
                                        window.imChat.scrollToBottom(failedContainer);
                                    }
                                    return;
                                }

                                const container = page.querySelector('.ins-chat-messages');
                                if(container) {
                                    container.innerHTML = '';
                                    const latestFriend = window.imApp.getFriendById ? (window.imApp.getFriendById(friend.id) || friend) : friend;
                                    window.imChat.renderChatHistory(latestFriend, container);
                                    window.imChat.scrollToBottom(container);
                                }
                                exitBatchSelectMode();
                            }
                        });
                    }
                });
            }

            const msgContainerProxy = page.querySelector('.ins-chat-messages');
            if (msgContainerProxy) {
                msgContainerProxy.addEventListener('click', (e) => {
                    const row = e.target.closest('.chat-row');

                    if (window.imData.batchSelectMode) {
                        e.stopPropagation();
                        e.preventDefault();
                        if (row) {
                            const icon = row.querySelector('.chat-checkbox-wrapper i');
                            if (icon) {
                                if (icon.classList.contains('fa-circle')) {
                                    icon.className = 'fas fa-check-circle';
                                    icon.style.color = '#393939';
                                } else {
                                    icon.className = 'far fa-circle';
                                    icon.style.color = '#c7c7cc';
                                }
                            }
                        }
                        return;
                    }

                }, true);
            }


            const replyCancelBtn = page.querySelector('.reply-cancel-btn');
            if (replyCancelBtn) {
                replyCancelBtn.addEventListener('click', () => {
                    window.imData.currentReplyText = null;
                    const preview = page.querySelector('.reply-preview-container');
                    if(preview) preview.style.display = 'none';
                });
            }

            let profilePanelOverlay = page.querySelector('.chat-profile-panel-overlay');
            if (!profilePanelOverlay) {
                profilePanelOverlay = document.createElement('div');
                profilePanelOverlay.className = 'chat-profile-panel-overlay';
                profilePanelOverlay.style.display = 'none';

                page.appendChild(profilePanelOverlay);

                profilePanelOverlay.addEventListener('click', (e) => {
                    if (e.target === profilePanelOverlay) {
                        const latestFriend = window.imApp.getFriendById(friend) || friend;
                        window.imChat.hideProfilePanel(latestFriend, profilePanelOverlay);
                    }
                });
            }

            const avatarContainer = page.querySelector('.ins-chat-avatar');
            const singleChatHeader = page.querySelector('.ins-chat-header');

            function handleSingleChatProfileTrigger(e) {
                if (friend.type === 'official' || friend.type === 'group' || friend.type === 'npc') return;
                e.stopPropagation();
                const latestFriend = window.imApp.getFriendById(friend) || friend;
                window.imChat.toggleProfilePanel(latestFriend, profilePanelOverlay);
            }

            if (avatarContainer) {
                if (friend.type === 'official' || friend.type === 'npc') {
                    avatarContainer.style.cursor = 'default';
                } else {
                    avatarContainer.style.cursor = 'pointer';
                    avatarContainer.addEventListener('click', handleSingleChatProfileTrigger);
                }
            }

            if (singleChatHeader && friend.type !== 'group') {
                if (friend.type === 'official' || friend.type === 'npc') {
                    singleChatHeader.style.cursor = 'default';
                } else {
                    singleChatHeader.style.cursor = 'pointer';
                    singleChatHeader.addEventListener('click', handleSingleChatProfileTrigger);
                }
            }

            page.addEventListener('click', (e) => {
                if (
                    profilePanelOverlay &&
                    profilePanelOverlay.classList.contains('active') &&
                    !e.target.closest('.chat-profile-panel-card') &&
                    !e.target.closest('.ins-chat-avatar') &&
                    !e.target.closest('.ins-chat-header')
                ) {
                    const latestFriend = window.imApp.getFriendById(friend) || friend;
                    window.imChat.hideProfilePanel(latestFriend, profilePanelOverlay);
                }
            });

            if (friend.type === 'group') {
                const rightAvatar = page.querySelector('.group-header-right-avatar');
                if (rightAvatar) {
                    rightAvatar.addEventListener('click', () => {
                        if (window.imApp.openGroupDetails) {
                            window.imApp.openGroupDetails(friend);
                        }
                    });
                }
                const header = page.querySelector('.ins-chat-header');
                if (header) {
                    header.addEventListener('click', () => {
                        if (window.imApp.openGroupDetails) {
                            window.imApp.openGroupDetails(friend);
                        }
                    });
                }

                // Event delegation for clicking on member avatars in group chat to show profile card
                const messagesArea = page.querySelector('.ins-chat-messages');
                if (messagesArea) {
                    // Start dragging detection for keyboard dismissal
                    let isDragging = false;
                    let startY = 0;
                    
                    messagesArea.addEventListener('touchstart', (e) => {
                        isDragging = false;
                        startY = e.touches[0].clientY;
                    }, { passive: true });
                    
                    messagesArea.addEventListener('touchmove', (e) => {
                        if (Math.abs(e.touches[0].clientY - startY) > 10) {
                            isDragging = true;
                        }
                    }, { passive: true });
                    
                    messagesArea.addEventListener('touchend', (e) => {
                        if (isDragging) {
                            // User is scrolling, dismiss keyboard
                            const input = page.querySelector('.chat-input');
                            if (input && document.activeElement === input) {
                                input.blur();
                            }
                        }
                        isDragging = false;
                    }, { passive: true });

                    messagesArea.addEventListener('click', (e) => {
                        // User clicked somewhere in the chat messages area, dismiss keyboard
                        const input = page.querySelector('.chat-input');
                        if (input && document.activeElement === input) {
                            input.blur();
                        }
                        const avatarSlot = e.target.closest('.group-ai-avatar-slot');
                        if (avatarSlot) {
                            const row = avatarSlot.closest('.ai-row');
                            if (row) {
                                const speakerName = row.getAttribute('data-speaker');
                                const thought = row.getAttribute('data-thought');
                                if (speakerName) {
                                    const members = window.imChat.getGroupMemberFriends(friend);
                                    const speakerInfo = members.find(m => m.nickname === speakerName);
                                    if (speakerInfo && window.imChat.showGroupMemberProfileCard) {
                                        window.imChat.showGroupMemberProfileCard(speakerInfo, page, avatarSlot, friend, thought);
                                    }
                                }
                            }
                        }
                    });
                }
            }
            
            // Re-bind menuBtn properly for chat settings (whether single or group if needed, but per request it's mainly single chat setting missing)
            if (menuBtn && friend.type !== 'group') {
                menuBtn.addEventListener('click', () => {
                    if (friend.type === 'official') {
                        const officialSettingsSheet = document.getElementById('official-chat-settings-sheet');
                        if (officialSettingsSheet) {
                            if (window.openView) {
                                window.openView(officialSettingsSheet);
                            } else {
                                officialSettingsSheet.style.display = 'flex';
                                setTimeout(() => {
                                    officialSettingsSheet.style.opacity = '1';
                                    const bottomSheet = officialSettingsSheet.querySelector('.bottom-sheet');
                                    if(bottomSheet) bottomSheet.style.transform = 'translateY(0)';
                                }, 10);
                            }
                            
                            // add empty click listener so clicking outside closes it
                            officialSettingsSheet.onclick = (e) => {
                                if (e.target === officialSettingsSheet) {
                                    if (window.closeView) window.closeView(officialSettingsSheet);
                                    else officialSettingsSheet.style.display = 'none';
                                }
                            };
                        }
                        return;
                    }

                    if (window.imApp.openChatSettingsForFriend) {
                        window.imApp.openChatSettingsForFriend(friend);
                    }
                });
            }

            const input = page.querySelector('.chat-input');
            const sendBtn = page.querySelector('.send-btn');
            const micBtn = page.querySelector('.mic-btn');
            const plusBtn = page.querySelector('.plus-btn');
            const msgContainer = page.querySelector('.ins-chat-messages');

            const onPlusClick = (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                if (input) input.blur();
                if (window.imChat.openAttachmentSheet) {
                    window.imChat.openAttachmentSheet();
                }
            };

            if (plusBtn) {
                plusBtn.addEventListener('mousedown', onPlusClick);
                plusBtn.addEventListener('touchstart', onPlusClick, { passive: false });
            }

            if (input) {
                input.addEventListener('focus', () => {
                    page.classList.add('keyboard-open');
                    const attachmentSheet = document.getElementById('chat-attachment-sheet');
                    if (attachmentSheet) {
                        const overlay = attachmentSheet.querySelector('.sheet-overlay');
                        const content = attachmentSheet.querySelector('.sheet-content');
                        if (overlay) overlay.style.opacity = '0';
                        if (content) content.style.transform = 'translateY(100%)';
                        attachmentSheet.style.display = 'none';
                    }

                    setTimeout(() => {
                        if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
                    }, 100);
                });

                input.addEventListener('blur', () => {
                    page.classList.remove('keyboard-open');
                });
            }

            // @ mention logic variables
            let mentionList = null;
            let currentMentionQuery = '';
            let mentionStartIndex = -1;

            function renderMentionList(query, inputEl) {
                if (friend.type !== 'group' || !friend.members) return;
                
                const listContainer = page.querySelector('.at-mention-list');
                if (!listContainer) return;

                const members = window.imChat.getGroupMemberFriends(friend);
                const allOptions = [
                    { id: 'all', nickname: '全体成员', isAll: true },
                    ...members
                ];

                const filtered = allOptions.filter(m => 
                    m.isAll || (m.nickname && m.nickname.toLowerCase().includes(query.toLowerCase()))
                );

                if (filtered.length === 0) {
                    listContainer.style.display = 'none';
                    return;
                }

                listContainer.innerHTML = '';
                filtered.forEach(m => {
                    const item = document.createElement('div');
                    item.className = 'at-mention-item';
                    
                    let avatarHtml = '';
                    if (m.isAll) {
                        avatarHtml = `<i class="fas fa-users" style="color: #007aff;"></i>`;
                    } else if (m.avatarUrl) {
                        avatarHtml = `<img src="${m.avatarUrl}">`;
                    } else {
                        avatarHtml = `<i class="fas fa-user"></i>`;
                    }

                    item.innerHTML = `
                        <div class="at-mention-avatar">${avatarHtml}</div>
                        <div class="at-mention-name">${m.isAll ? m.nickname : m.nickname}</div>
                    `;

                    item.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const text = inputEl.value;
                        const before = text.substring(0, mentionStartIndex);
                        const after = text.substring(inputEl.selectionStart);
                        const mentionText = m.isAll ? '@全体成员 ' : `@${m.nickname} `;
                        
                        inputEl.value = before + mentionText + after;
                        const newCursorPos = before.length + mentionText.length;
                        inputEl.setSelectionRange(newCursorPos, newCursorPos);
                        inputEl.focus();
                        
                        listContainer.style.display = 'none';
                        mentionStartIndex = -1;
                        currentMentionQuery = '';
                    });

                    listContainer.appendChild(item);
                });

                listContainer.style.display = 'flex';
            }

            input.addEventListener('input', (e) => {
                if (friend.type !== 'group') return;
                
                const text = input.value;
                const cursorPos = input.selectionStart;
                
                // Search backwards for the @ symbol
                let foundAt = -1;
                for (let i = cursorPos - 1; i >= 0; i--) {
                    if (text[i] === '@') {
                        foundAt = i;
                        break;
                    }
                    if (text[i] === ' ' || text[i] === '\n') {
                        break; // Stop if we hit a space before @
                    }
                }

                if (foundAt !== -1) {
                    mentionStartIndex = foundAt;
                    currentMentionQuery = text.substring(foundAt + 1, cursorPos);
                    
                    let listContainer = page.querySelector('.at-mention-list');
                    if (!listContainer) {
                        listContainer = document.createElement('div');
                        listContainer.className = 'at-mention-list';
                        const inputWrapper = page.querySelector('.ins-chat-input-wrapper');
                        inputWrapper.parentNode.insertBefore(listContainer, inputWrapper);
                    }
                    
                    renderMentionList(currentMentionQuery, input);
                } else {
                    mentionStartIndex = -1;
                    currentMentionQuery = '';
                    const listContainer = page.querySelector('.at-mention-list');
                    if (listContainer) listContainer.style.display = 'none';
                }
            });

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (e.shiftKey || e.ctrlKey || e.altKey) {
                        return; // 允许在多行文本框中换行（如果适用）或忽略修饰键
                    }
                    e.preventDefault();
                    const currentFriend = window.imData.currentActiveFriend || friend;
                    window.imChat.handleSend(currentFriend, input, msgContainer);
                    const listContainer = page.querySelector('.at-mention-list');
                    if (listContainer) listContainer.style.display = 'none';
                }
            });

            let lastSendTouchAt = 0;

            const onSendClick = (e, options = {}) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                const currentFriend = window.imData.currentActiveFriend || friend;
                window.imChat.handleSend(currentFriend, input, msgContainer);
                const listContainer = page.querySelector('.at-mention-list');
                if (listContainer) listContainer.style.display = 'none';
                if (options.refocus && input) {
                    setTimeout(() => {
                        input.focus();
                    }, 50);
                }
            };

            sendBtn.addEventListener('click', (e) => {
                if (Date.now() - lastSendTouchAt < 500) {
                    e.preventDefault();
                    return;
                }
                onSendClick(e);
            });
            sendBtn.addEventListener('touchstart', (e) => {
                lastSendTouchAt = Date.now();
                onSendClick(e, { refocus: true });
            }, { passive: false });

            const onMicClick = (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                console.log('Mic button clicked!');
                const currentFriend = window.imData.currentActiveFriend || friend;
                if (window.imChat && window.imChat.handleAiReply) {
                    window.imChat.handleAiReply(currentFriend, msgContainer, micBtn);
                } else {
                    console.error('window.imChat.handleAiReply is not defined');
                    if (window.showToast) window.showToast('无法调用 AI 接口');
                }
            };

            micBtn.addEventListener('mousedown', onMicClick);
            micBtn.addEventListener('touchstart', onMicClick, { passive: false });

            window.imChat.renderChatHistory(friend, msgContainer, { resetWindow: true });
        } else {
             // 如果页面已存在，我们需要确保已有页面的麦克风按钮能够正常触发，
             // 但原逻辑只有在 !page 也就是创建页面时绑定了 click，
             // 所以如果是复用的页面，原先的闭包引用的 friend 可能旧了，或者节点变了。
             // 不过通常这种 SPA 是在元素上保留原本监听器的，所以先看看原先的逻辑。
             window.imChat.ensureTransferDetailOverlayForExistingPage(page, friend);
             window.imChat.ensureRedPacketDetailOverlayForExistingPage(page, friend);
              if (isGroupChat && window.imChat.refreshGroupHeaderAvatar) {
                  window.imChat.refreshGroupHeaderAvatar(friend);
              }
              const msgContainer = page.querySelector('.ins-chat-messages');
              window.imChat.renderChatHistory(friend, msgContainer, { resetWindow: true });

             // 确保在已存在页面下，麦克风按钮也能绑定点击事件，或者原先的事件中的闭包上下文能够更新
             // 更好的做法是将最新 friend 更新给全局上下文。上面已经做了:
             // window.imData.currentActiveFriend = activeFriend;
             // 所以原绑定的闭包会读到最新的 window.imData.currentActiveFriend，这是有效的。
        }

        if(window.imApp.applyFriendBg) window.imApp.applyFriendBg(friend);
        if(window.imApp.initTimestampSetting) window.imApp.initTimestampSetting(friend);
        
        if(page) {
            page.classList.toggle('show-timestamps', !!friend.showTimestamp);
            page.classList.toggle('timestamp-outside', !!friend.showTimestamp && friend.timestampPosition === 'outside');
            
            if(friend.isPinned) page.classList.add('pinned-chat');
            else page.classList.remove('pinned-chat');
            
            // Re-apply status bar css
            if(window.imApp.applyFriendStatusBarCss) window.imApp.applyFriendStatusBarCss(friend);
        }

        if (navChatsBtn) {
            if (navChatsBtn.classList.contains('active')) window.imChat.updateChatsView();
            else navChatsBtn.click();
        }
    }

function showContextMenu(row, e) {
        const msgContextOverlay = document.getElementById('msg-context-overlay');
        const msgContextMenu = document.getElementById('msg-context-menu');
        
        if (!msgContextOverlay || !msgContextMenu) return;
        
        if (navigator.vibrate) navigator.vibrate(50);
        
        window.imData.currentActiveRow = row;
        row.classList.add('message-active');
        
        const bubble = row.querySelector('.chat-bubble') || row.querySelector('.sticker-message-wrap');
        if (!bubble) return;
        
        const screenEl = document.getElementById('app') || document.body;
        const screenRect = screenEl.getBoundingClientRect();
        
        // Clone bubble into context menu
        const bubbleClone = document.getElementById('msg-context-bubble-clone');
        if (bubbleClone) {
            bubbleClone.innerHTML = '';
            const clonedBubble = bubble.cloneNode(true);
            clonedBubble.style.margin = '0';
            clonedBubble.style.maxWidth = '100%';
            bubbleClone.appendChild(clonedBubble);
        }
        
        // Reset more actions
        const moreActions = document.getElementById('msg-context-more-actions');
        const mainActions = document.getElementById('msg-context-actions');
        if (moreActions) moreActions.style.display = 'none';
        if (mainActions) mainActions.style.display = 'flex';
        
        // Determine alignment based on user/ai row
        const isUserRow = row.classList.contains('user-row');
        
        msgContextOverlay.style.display = 'flex';
        msgContextOverlay.style.opacity = '1';
        
        // Position the menu centered or aligned
        const menuWidth = Math.min(screenRect.width - 32, 300);
        msgContextMenu.style.width = menuWidth + 'px';
        
        if (isUserRow) {
            msgContextMenu.style.alignItems = 'flex-end';
            msgContextMenu.style.right = '16px';
            msgContextMenu.style.left = 'auto';
        } else {
            msgContextMenu.style.alignItems = 'flex-start';
            msgContextMenu.style.left = '16px';
            msgContextMenu.style.right = 'auto';
        }
        
        // Vertical centering: place bubble roughly at its original position
        const bubbleRect = bubble.getBoundingClientRect();
        const bubbleCenterY = bubbleRect.top + bubbleRect.height / 2 - screenRect.top;
        
        // Estimate menu total height (reaction bar ~50 + bubble + actions ~200)
        const estimatedMenuHeight = 50 + bubbleRect.height + 220;
        let topOffset = bubbleCenterY - estimatedMenuHeight / 2;
        
        // Clamp to screen bounds
        if (topOffset < 60) topOffset = 60;
        if (topOffset + estimatedMenuHeight > screenRect.height - 20) {
            topOffset = screenRect.height - estimatedMenuHeight - 20;
        }
        if (topOffset < 60) topOffset = 60;
        
        msgContextMenu.style.top = topOffset + 'px';
        
        msgContextMenu.style.transformOrigin = isUserRow ? 'top right' : 'top left';
        
        requestAnimationFrame(() => {
            msgContextMenu.style.opacity = '1';
            msgContextMenu.style.transform = 'scale(1)';
        });
    }

function closeContextMenu() {
        const msgContextOverlay = document.getElementById('msg-context-overlay');
        const msgContextMenu = document.getElementById('msg-context-menu');
        
        if (!msgContextOverlay || !msgContextMenu) return;
        msgContextMenu.style.opacity = '0';
        msgContextMenu.style.transform = 'scale(0.85)';
        
        if (window.imData.currentActiveRow) {
            window.imData.currentActiveRow.classList.remove('message-active');
            window.imData.currentActiveRow = null;
        }
        
        setTimeout(() => {
            msgContextOverlay.style.display = 'none';
            // Clean up cloned bubble
            const bubbleClone = document.getElementById('msg-context-bubble-clone');
            if (bubbleClone) bubbleClone.innerHTML = '';
        }, 250);
    }

    function showGroupMemberProfileCard(speakerInfo, page, anchorElement, group, historicalThought = null) {
        if (!page) return;
        let overlay = document.getElementById('global-gmp-overlay');
        if (!overlay) {
            // Mount overlay to body so it covers everything and isn't clipped
            overlay = document.createElement('div');
            overlay.id = 'global-gmp-overlay';
            overlay.className = 'group-member-profile-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.4)';
            overlay.style.zIndex = '9999';
            overlay.style.display = 'none';
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s ease';

            const card = document.createElement('div');
            card.className = 'group-member-profile-card';
            
            overlay.appendChild(card);
            document.body.appendChild(overlay);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.style.opacity = '0';
                    card.classList.remove('active');
                    setTimeout(() => overlay.style.display = 'none', 300);
                }
            });
        }

        const card = overlay.querySelector('.group-member-profile-card');
        const avatarUrl = speakerInfo.avatarUrl || 'https://picsum.photos/seed/char/100/100';
        const name = speakerInfo.nickname || 'Unknown';
        const signature = speakerInfo.signature || '这个人很懒，什么都没写';
        const title = speakerInfo.groupTitle || '';
        
        let groupProfile = {};
        if (group && group.memberProfiles && group.memberProfiles[speakerInfo.id]) {
            groupProfile = group.memberProfiles[speakerInfo.id];
        }
        
        const thought = historicalThought || (historicalThought === null ? '暂无心声' : (groupProfile.thought || '暂无心声'));
        
        // For group members, we check if they have individual sleeping schedules if we can retrieve them
        let isSleeping = false;
        const members = window.imChat.getGroupMemberFriends(group);
        const actualMember = members.find(m => String(m.id) === String(speakerInfo.id));
        if (actualMember) {
            isSleeping = window.imApp.isCharacterSleeping(actualMember);
        }
        
        const status = isSleeping ? 'offline' : (groupProfile.status || 'online');
        const statusColor = isSleeping ? '#8e8e93' : '#34c759';

        let titleHtml = title ? `<div class="gmp-title">${title}</div>` : '';

        card.innerHTML = `
            <div class="gmp-header">
                <div class="gmp-avatar-wrapper">
                    <div class="gmp-avatar"><img src="${avatarUrl}"></div>
                    <div class="gmp-status-bubble" contenteditable="${isSleeping ? 'false' : 'true'}" spellcheck="false">${status}</div>
                </div>
            </div>
            <div class="gmp-body">
                <div class="gmp-name-row">
                    <div class="gmp-name">${name}</div>
                    ${titleHtml}
                </div>
                <div class="gmp-signature">${signature}</div>
                <div class="gmp-inner-voice">${thought}</div>
            </div>
        `;

        const statusBubble = card.querySelector('.gmp-status-bubble');
        statusBubble.addEventListener('blur', async (e) => {
            const nextStatus = e.target.innerText.trim() || 'online';
            if (group) {
                const saved = window.imApp.commitFriendChange
                    ? await window.imApp.commitFriendChange(group.id, (targetGroup) => {
                        if (!targetGroup) return;
                        if (!targetGroup.memberProfiles) targetGroup.memberProfiles = {};
                        if (!targetGroup.memberProfiles[speakerInfo.id]) {
                            targetGroup.memberProfiles[speakerInfo.id] = { thought: '暂无心声', status: 'online' };
                        }
                        targetGroup.memberProfiles[speakerInfo.id].status = nextStatus;
                    }, { silent: true })
                    : false;

                if (!saved) {
                    e.target.innerText = status;
                    if (window.showToast) window.showToast('状态保存失败');
                    return;
                }
            } else {
                // Fallback if no group context
                e.target.innerText = status;
            }
        });

        // Step 1: Explicitly set display flex to make it part of the render tree
        overlay.style.display = 'block';
        card.style.display = 'flex'; // CRITICAL FIX: Make the card itself visible

        // Calculate position based on anchor element
        if (anchorElement) {
            const rect = anchorElement.getBoundingClientRect();
            const cardWidth = 300;
            const cardHeight = card.offsetHeight || 380; // approximate if 0

            let top = rect.bottom + 10;
            let left = rect.left;

            // Adjust if it goes off screen
            const viewportWidth = Math.max(
                0,
                window.visualViewport?.width ||
                document.documentElement.clientWidth ||
                window.innerWidth ||
                0
            );
            const viewportHeight = Math.max(
                0,
                window.visualViewport?.height ||
                document.documentElement.clientHeight ||
                window.innerHeight ||
                0
            );

            if (left + cardWidth > viewportWidth - 20) {
                left = viewportWidth - cardWidth - 20;
            }
            if (top + cardHeight > viewportHeight - 20) {
                top = rect.top - cardHeight - 10;
            }

            const originY = (top < rect.top) ? 'bottom' : 'top';
            const originX = (left === rect.left) ? 'left' : 'right';
            
            card.style.top = top + 'px';
            card.style.left = left + 'px';
            card.style.transformOrigin = `${originX} ${originY}`;
        } else {
            card.style.top = '50%';
            card.style.left = '50%';
            card.style.transform = 'translate(-50%, -50%) scale(0.85)';
            card.style.transformOrigin = 'center center';
        }

        // Step 2: Force reflow so browser registers the new display state BEFORE animating
        void overlay.offsetHeight;
        void card.offsetHeight;
        
        // Step 3: Trigger the transition
        overlay.style.opacity = '1';
        card.classList.add('active');
        
        // Cleanup translation for anchor if needed after scale animation is triggered
        if (anchorElement) {
            card.style.transform = 'scale(1)';
        }
    }

    window.imChat.openChatTab = openChatTab;
    window.imChat.showContextMenu = showContextMenu;
    window.imChat.closeContextMenu = closeContextMenu;
    window.imChat.showGroupMemberProfileCard = showGroupMemberProfileCard;

});


