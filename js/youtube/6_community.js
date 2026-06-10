// --- Community Detail View Logic ---
    const communityDetailView = document.getElementById('yt-community-detail-view');
    const communityDetailBackBtn = document.getElementById('yt-community-detail-back-btn');
    const communityDetailContent = document.getElementById('yt-community-detail-content');
    const postChatSend = document.getElementById('yt-community-chat-send');
    const postChatInput = document.getElementById('yt-community-chat-input');
    
    let currentActivePost = null;

    function stopCommunityControlEvent(e) {
        if (!e) return;
        e.stopPropagation();
    }

    [
        communityDetailContent,
        postChatInput,
        postChatSend,
        communityDetailBackBtn
    ].filter(Boolean).forEach((el) => {
        el.addEventListener('click', stopCommunityControlEvent);
        el.addEventListener('pointerdown', stopCommunityControlEvent);
    });

    if (communityDetailContent) {
        let isDraggingDetail = false;
        communityDetailContent.addEventListener('touchstart', () => { isDraggingDetail = false; }, { passive: true });
        communityDetailContent.addEventListener('touchmove', () => { isDraggingDetail = true; }, { passive: true });
        communityDetailContent.addEventListener('touchend', () => {
            if (isDraggingDetail) {
                if (postChatInput && document.activeElement === postChatInput) postChatInput.blur();
            }
        });
        communityDetailContent.addEventListener('click', () => {
            if (postChatInput && document.activeElement === postChatInput) postChatInput.blur();
        });
    }

    if (communityDetailBackBtn) {
        communityDetailBackBtn.addEventListener('click', () => {
            if (postChatInput && document.activeElement === postChatInput) postChatInput.blur();
        });
    }

    if (postChatInput) {
        postChatInput.addEventListener('focus', () => {
            if (communityDetailView) communityDetailView.classList.add('keyboard-open');
        });
        postChatInput.addEventListener('blur', () => {
            if (communityDetailView) communityDetailView.classList.remove('keyboard-open');
        });
    }

    function getCurrentYtCommunityUser() {
        if (typeof window.getYtEffectiveUserState === 'function') {
            return window.getYtEffectiveUserState() || {};
        }
        return ytUserState || {};
    }

    if (communityDetailBackBtn) {
        communityDetailBackBtn.addEventListener('click', () => {
            if (communityDetailView) communityDetailView.classList.remove('active');
        });
    }

    function openPostDetail(post) {
        if (!communityDetailView || !communityDetailContent || !currentSubChannelData) return;
        currentActivePost = post;
        if (postChatInput) {
            postChatInput.value = '';
            postChatInput.placeholder = '发表评论...';
            postChatInput.setAttribute('enterkeyhint', 'send');
        }

        // Initialize user avatar in input area
        const userAvatar = document.getElementById('yt-community-user-avatar');
        const userIcon = document.getElementById('yt-community-user-icon');
        const effectiveYtUser = getCurrentYtCommunityUser();
        if (effectiveYtUser.avatarUrl && userAvatar) {
            userAvatar.src = effectiveYtUser.avatarUrl;
            userAvatar.style.display = 'block';
            if(userIcon) userIcon.style.display = 'none';
        }

        renderPostComments();
        communityDetailView.classList.add('active');
    }

    function renderPostComments() {
        if (!currentActivePost) return;
        const post = currentActivePost;
        
        let commentsHtml = '';
        if (post.comments && Array.isArray(post.comments) && post.comments.length > 0) {
            commentsHtml = post.comments.map(c => `
                <div class="yt-community-comment-item">
                    <div class="yt-video-avatar" style="width:30px; height:30px; flex-shrink: 0; background-color: #f2f2f2; display: flex; justify-content: center; align-items: center; border-radius: 50%; overflow: hidden;">
                        ${c.avatar ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:12px; font-weight:bold; color:#555;">${c.name ? c.name[0].toUpperCase() : '?'}</span>`}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 13px; color: #606060; margin-bottom: 4px;">${c.name}</div>
                        <div style="font-size: 14px; color: #0f0f0f; line-height: 1.4;">${c.text}</div>
                        <div style="font-size: 12px; color: #8e8e93; margin-top: 6px; display: flex; gap: 16px;">
                            <span><i class="far fa-thumbs-up"></i> ${Math.floor(Math.random() * 500) + 10}</span>
                            <span><i class="far fa-thumbs-down"></i></span>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            commentsHtml = '<div style="text-align:center; padding: 20px; color:#8e8e93; font-size:13px;" id="yt-empty-post-comments">暂无评论</div>';
        }

        communityDetailContent.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 12px; gap: 10px;">
                <div class="yt-video-avatar" style="width:40px; height:40px;"><img src="${typeof resolveYtChannelAvatar === 'function' ? resolveYtChannelAvatar(currentSubChannelData) : (currentSubChannelData.avatar || '')}"></div>
                <div style="flex:1;">
                    <div style="font-size:15px; font-weight:500;">${currentSubChannelData.name || '未知'}</div>
                    <div style="font-size:12px; color:#606060;">${post.time || '刚刚'}</div>
                </div>
            </div>
            <div style="font-size: 15px; line-height: 1.5; color: #0f0f0f; margin-bottom: 16px;">
                ${post.content || ''}
            </div>
            <div style="display: flex; gap: 24px; color: #606060; font-size: 14px; padding-bottom: 16px;">
                <span><i class="far fa-thumbs-up"></i> ${post.likes || '1.2万'}</span>
                <span><i class="far fa-thumbs-down"></i></span>
                <span><i class="far fa-comment"></i> ${post.comments?.length || post.commentsCount || '0'}</span>
            </div>

            <div class="yt-community-comments-section" id="yt-post-comments-container">
                <div style="font-size: 14px; font-weight: 500; margin-bottom: 16px;">评论</div>
                ${commentsHtml}
            </div>
        `;
    }

    function addPostCommentMessage(name, text, isUser = false) {
        const container = document.getElementById('yt-post-comments-container');
        if (!container) return;
        
        const emptyMsg = document.getElementById('yt-empty-post-comments');
        if (emptyMsg) emptyMsg.remove();

        // Update state
        if (!currentActivePost.comments) currentActivePost.comments = [];
        
        const effectiveYtUser = getCurrentYtCommunityUser();
        const newComment = {
            name: name,
            text: text,
            avatar: isUser ? effectiveYtUser.avatarUrl || null : null
        };
        
        // Append to array so it's at the end (newest at bottom)
        currentActivePost.comments.push(newComment);
        saveYoutubeData();

        // Re-render
        renderPostComments();
    }

    if (postChatSend && postChatInput) {
        postChatSend.addEventListener('click', async () => {
            const text = postChatInput.value.trim();
            if(!text || !currentActivePost) return;
            
            const effectiveYtUser = getCurrentYtCommunityUser();
            addPostCommentMessage(effectiveYtUser.name || '我', text, true);
            postChatInput.value = '';
            
            // Show loading
            const container = document.getElementById('yt-post-comments-container');
            let loadingId = null;
            if(container) {
                loadingId = 'yt-post-reply-loading';
                const loadingDiv = document.createElement('div');
                loadingDiv.id = loadingId;
                loadingDiv.style.textAlign = 'center';
                loadingDiv.style.padding = '10px';
                loadingDiv.style.color = '#8e8e93';
                loadingDiv.style.fontSize = '12px';
                loadingDiv.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 回复生成中...';
                container.appendChild(loadingDiv);
            }

            try {
                const responseObj = await getVODResponse(text, currentActivePost.content);
                renderVODResponse(responseObj, true);
            } finally {
                if(loadingId) { const el = document.getElementById(loadingId); if(el) el.remove(); }
            }
        });
        postChatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                postChatSend.click();
            }
        });
    }

    // --- Fan Group Chat Logic ---
    const groupChatView = document.getElementById('yt-bubble-chat-view');
    const groupChatBackBtn = document.getElementById('yt-bubble-chat-back-btn');
    const groupChatTitle = document.getElementById('yt-bubble-chat-title');
    const groupChatContainer = document.getElementById('yt-bubble-chat-container');
    const groupChatInput = document.getElementById('yt-bubble-chat-input');
    const groupChatApiBtn = document.getElementById('yt-bubble-chat-api-btn');
    const groupChatSendBtn = document.getElementById('yt-bubble-chat-send-btn');
    const groupChatSettingsBtn = document.getElementById('yt-bubble-chat-settings-btn');
    
    // Settings Sheet Elements
    const groupSettingsSheet = document.getElementById('yt-group-settings-sheet');
    const groupNameInput = document.getElementById('yt-group-name-input');
    const groupOwnerInfo = document.getElementById('yt-group-owner-info');
    const groupSettingsSaveBtn = document.getElementById('yt-save-group-settings-btn');
    
    let isGroupChatLoading = false;

    [
        groupChatContainer,
        groupChatInput,
        groupChatSendBtn,
        groupChatApiBtn,
        groupChatBackBtn,
        groupChatSettingsBtn
    ].filter(Boolean).forEach((el) => {
        el.addEventListener('click', stopCommunityControlEvent);
        el.addEventListener('pointerdown', stopCommunityControlEvent);
    });

    if (groupChatContainer) {
        let isDraggingGroupChat = false;
        groupChatContainer.addEventListener('touchstart', () => { isDraggingGroupChat = false; }, { passive: true });
        groupChatContainer.addEventListener('touchmove', () => { isDraggingGroupChat = true; }, { passive: true });
        groupChatContainer.addEventListener('touchend', () => {
            if (isDraggingGroupChat) {
                if (groupChatInput && document.activeElement === groupChatInput) groupChatInput.blur();
            }
        });
        groupChatContainer.addEventListener('click', () => {
            if (groupChatInput && document.activeElement === groupChatInput) groupChatInput.blur();
        });
    }

    if (groupChatBackBtn) {
        groupChatBackBtn.addEventListener('click', () => {
            if (groupChatInput && document.activeElement === groupChatInput) groupChatInput.blur();
        });
    }

    if (groupChatInput) {
        groupChatInput.addEventListener('focus', () => {
            if (groupChatView) groupChatView.classList.add('keyboard-open');
        });
        groupChatInput.addEventListener('blur', () => {
            if (groupChatView) groupChatView.classList.remove('keyboard-open');
        });
    }

    function sendGroupChatMessageOnly(text) {
        if (!text || !currentSubChannelData || !groupChatTitle) return false;

        const effectiveYtUser = getCurrentYtCommunityUser();
        const userMsg = { type: 'user', name: effectiveYtUser.name || '我', text: text };
        const isDM = groupChatTitle.textContent === currentSubChannelData.name;

        if (isDM) {
            if (!currentSubChannelData.dmHistory) currentSubChannelData.dmHistory = [];
            currentSubChannelData.dmHistory.push(userMsg);
        } else {
            if (!currentSubChannelData.groupChatHistory) currentSubChannelData.groupChatHistory = [];
            currentSubChannelData.groupChatHistory.push(userMsg);
        }

        saveYoutubeData();
        addGroupChatMessageToUI(userMsg);
        if (groupChatInput) groupChatInput.value = '';
        return true;
    }

    if (groupChatBackBtn) {
        groupChatBackBtn.addEventListener('click', () => {
            if (groupChatView) groupChatView.classList.remove('active');
        });
    }
    
    // Group Settings Logic
    const groupAvatarWrapper = document.getElementById('yt-group-avatar-wrapper');
    const groupAvatarUpload = document.getElementById('yt-group-avatar-upload');
    const groupAvatarImg = document.getElementById('yt-group-avatar-img');
    const groupAvatarIcon = document.getElementById('yt-group-avatar-icon');
    const clearGroupHistoryBtn = document.getElementById('yt-clear-group-history-btn');
    const exitGroupBtn = document.getElementById('yt-exit-group-btn');

    if (groupAvatarWrapper && groupAvatarUpload) {
        groupAvatarWrapper.addEventListener('click', () => groupAvatarUpload.click());
        groupAvatarUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (window.compressImage) {
                        window.compressImage(event.target.result, 300, 300, (compressedUrl) => {
                            if (groupAvatarImg) {
                                groupAvatarImg.src = compressedUrl;
                                groupAvatarImg.style.display = 'block';
                            }
                            if (groupAvatarIcon) groupAvatarIcon.style.display = 'none';
                            if (groupAvatarWrapper) groupAvatarWrapper.style.backgroundColor = 'transparent';
                        });
                    } else {
                        if (groupAvatarImg) {
                            groupAvatarImg.src = event.target.result;
                            groupAvatarImg.style.display = 'block';
                        }
                        if (groupAvatarIcon) groupAvatarIcon.style.display = 'none';
                        if (groupAvatarWrapper) groupAvatarWrapper.style.backgroundColor = 'transparent';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (groupSettingsSheet) {
        groupSettingsSheet.addEventListener('mousedown', (e) => {
            if (e.target === groupSettingsSheet) groupSettingsSheet.classList.remove('active');
        });
    }
    
    if (groupSettingsSaveBtn) {
        groupSettingsSaveBtn.addEventListener('click', () => {
            if (!currentSubChannelData || !currentSubChannelData.generatedContent || !currentSubChannelData.generatedContent.fanGroup) return;
            
            if (groupNameInput && groupNameInput.value.trim()) {
                currentSubChannelData.generatedContent.fanGroup.name = groupNameInput.value.trim();
                if (groupChatTitle) groupChatTitle.textContent = `${groupNameInput.value.trim()} (${currentSubChannelData.generatedContent.fanGroup.memberCount})`;
            }

            if (groupAvatarImg && groupAvatarImg.style.display === 'block' && groupAvatarImg.src) {
                currentSubChannelData.generatedContent.fanGroup.avatar = groupAvatarImg.src;
            }
            
            saveYoutubeData();
            renderGeneratedContent('community'); // Refresh external card
            renderMessagesList(); // Refresh message list tab
            if(window.showToast) window.showToast('群设置已修改');
            groupSettingsSheet.classList.remove('active');
        });
    }

    if (clearGroupHistoryBtn) {
        clearGroupHistoryBtn.addEventListener('click', () => {
            window.showCustomModal({
                title: '清空聊天记录',
                message: '确定要清空该群聊的所有历史记录吗？此操作无法撤销。',
                confirmText: '清空',
                cancelText: '取消',
                isDestructive: true,
                onConfirm: () => {
                    if (currentSubChannelData) {
                        currentSubChannelData.groupChatHistory = [];
                        saveYoutubeData();
                        renderGroupChatHistory(false);
                        if(window.showToast) window.showToast('聊天记录已清空');
                    }
                    groupSettingsSheet.classList.remove('active');
                }
            });
        });
    }

    if (exitGroupBtn) {
        exitGroupBtn.addEventListener('click', () => {
            window.showCustomModal({
                title: '退出群聊',
                message: '确定要退出该粉丝群吗？退出后聊天记录将被删除。',
                confirmText: '退出',
                cancelText: '取消',
                isDestructive: true,
                onConfirm: () => {
                    if (currentSubChannelData && currentSubChannelData.generatedContent && currentSubChannelData.generatedContent.fanGroup) {
                        currentSubChannelData.generatedContent.fanGroup.isJoined = false;
                        currentSubChannelData.groupChatHistory = [];
                        saveYoutubeData();
                        
                        groupSettingsSheet.classList.remove('active');
                        if (groupChatView) groupChatView.classList.remove('active');
                        
                        renderGeneratedContent('community');
                        renderMessagesList();
                        
                        if(window.showToast) window.showToast('已退出群聊');
                    }
                }
            });
        });
    }
    
    // Add Friend to DM Logic
    if (groupOwnerInfo) {
        groupOwnerInfo.addEventListener('click', () => {
            if (!currentSubChannelData) return;
            
            window.showCustomModal({
                title: '添加私信',
                message: `是否将群主 ${currentSubChannelData.name} 添加至私信列表？`,
                confirmText: '添加',
                cancelText: '取消',
                onConfirm: () => {
                    if (!currentSubChannelData.dmHistory) {
                        currentSubChannelData.dmHistory = [];
                    }
                    
                    currentSubChannelData.isFriend = true; // Ensure it shows in DM list
                    if (currentSubChannelData.isBusiness === undefined) {
                        currentSubChannelData.isBusiness = false; // Default to non-business
                    }
                    
                    // Add an initial greeting if empty
                    if (currentSubChannelData.dmHistory.length === 0) {
                        currentSubChannelData.dmHistory.push({
                            type: 'char',
                            name: currentSubChannelData.name,
                            text: '我已经通过了你的好友请求，现在我们可以开始聊天了。'
                        });
                    }
                    
                    saveYoutubeData();
                    renderMessagesList();
                    
                    groupSettingsSheet.classList.remove('active');
                    if (groupChatView) groupChatView.classList.remove('active');
                    
                    // Optionally jump to DM view immediately
                    setTimeout(() => {
                        const msgNavBtn = document.querySelector('.yt-nav-item[data-target="yt-messages-tab"]');
                        if (msgNavBtn) msgNavBtn.click();
                        const msgFilterDm = document.getElementById('msg-filter-dm');
                        if (msgFilterDm) msgFilterDm.click();
                        if (window.showToast) window.showToast(`已添加与 ${currentSubChannelData.name} 的私信`);
                    }, 300);
                }
            });
        });
    }

    const dmSettingsSheet = document.getElementById('yt-dm-settings-sheet');
    const dmGoHomeBtn = document.getElementById('yt-dm-go-home-btn');
    const dmClearHistoryBtn = document.getElementById('yt-dm-clear-history-btn');
    const dmDeleteFriendBtn = document.getElementById('yt-dm-delete-friend-btn');
    
    // Add "Add Friend" logic
    let dmAddFriendBtn = document.getElementById('yt-dm-add-friend-btn');
    if (!dmAddFriendBtn && dmSettingsSheet) {
        dmAddFriendBtn = document.createElement('div');
        dmAddFriendBtn.className = 'sheet-action';
        dmAddFriendBtn.id = 'yt-dm-add-friend-btn';
        dmAddFriendBtn.style.color = '#007aff';
        dmAddFriendBtn.style.marginBottom = '10px';
        dmAddFriendBtn.textContent = '添加好友';
        
        // Insert before clear history
        if (dmClearHistoryBtn) {
            dmClearHistoryBtn.parentNode.insertBefore(dmAddFriendBtn, dmClearHistoryBtn);
        }
        
        dmAddFriendBtn.addEventListener('click', () => {
            if (currentSubChannelData && !currentSubChannelData.isFriend) {
                currentSubChannelData.isFriend = true;
                saveYoutubeData();
                if (window.showToast) window.showToast('已添加为好友');
                if (dmSettingsSheet) dmSettingsSheet.classList.remove('active');
                renderMessagesList();
            }
        });
    }

    if (groupChatSettingsBtn) {
        groupChatSettingsBtn.addEventListener('click', () => {
            if (!currentSubChannelData) return;
            
            const isDM = groupChatTitle && groupChatTitle.textContent === currentSubChannelData.name;
            
            if (isDM) {
                if (dmAddFriendBtn) {
                    if (currentSubChannelData.isFriend) {
                        dmAddFriendBtn.style.display = 'none';
                        dmDeleteFriendBtn.style.display = 'block';
                    } else {
                        dmAddFriendBtn.style.display = 'block';
                        dmDeleteFriendBtn.style.display = 'none';
                    }
                }
                if (dmSettingsSheet) dmSettingsSheet.classList.add('active');
            } else {
                // Group Settings
                if (!currentSubChannelData.generatedContent || !currentSubChannelData.generatedContent.fanGroup) return;
                const fanGroup = currentSubChannelData.generatedContent.fanGroup;
                
                if (groupNameInput) groupNameInput.value = fanGroup.name || '';
                
                // Set Group Avatar
                if (fanGroup.avatar && groupAvatarImg) {
                    groupAvatarImg.src = fanGroup.avatar;
                    groupAvatarImg.style.display = 'block';
                    if (groupAvatarIcon) groupAvatarIcon.style.display = 'none';
                    if (groupAvatarWrapper) groupAvatarWrapper.style.backgroundColor = 'transparent';
                } else {
                    if (groupAvatarImg) groupAvatarImg.style.display = 'none';
                    if (groupAvatarIcon) groupAvatarIcon.style.display = 'block';
                    if (groupAvatarWrapper) groupAvatarWrapper.style.backgroundColor = '#f2f2f7';
                }

                // Set Owner Info
                const ownerName = document.getElementById('yt-group-owner-name');
                const ownerAvatar = document.getElementById('yt-group-owner-avatar');
                if(ownerName) ownerName.textContent = currentSubChannelData.name;
                if(ownerAvatar) ownerAvatar.src = typeof resolveYtChannelAvatar === 'function' ? resolveYtChannelAvatar(currentSubChannelData) : currentSubChannelData.avatar;
                
                if (groupSettingsSheet) groupSettingsSheet.classList.add('active');
            }
        });
    }
    
    if (dmSettingsSheet) {
        dmSettingsSheet.addEventListener('mousedown', (e) => {
            if (e.target === dmSettingsSheet) dmSettingsSheet.classList.remove('active');
        });
    }

    if (dmGoHomeBtn) {
        dmGoHomeBtn.addEventListener('click', () => {
            if (dmSettingsSheet) dmSettingsSheet.classList.remove('active');
            if (groupChatView) groupChatView.classList.remove('active');
            
            if (currentSubChannelData) {
                // Navigate to channel view
                const homeNavBtn = document.querySelector('.yt-nav-item[data-target="yt-home-tab"]');
                if (homeNavBtn) homeNavBtn.click();
                openSubChannelView(currentSubChannelData);
            }
        });
    }

    if (dmClearHistoryBtn) {
        dmClearHistoryBtn.addEventListener('click', () => {
            window.showCustomModal({
                title: '清空聊天记录',
                message: '确定要清空与该联系人的私信记录吗？',
                confirmText: '清空',
                cancelText: '取消',
                isDestructive: true,
                onConfirm: () => {
                    if (currentSubChannelData) {
                        currentSubChannelData.dmHistory = [];
                        
                        // 仅清空数据，不删除联系人卡片，即使不是好友也不删除
                        renderGroupChatHistory(true);
                        renderMessagesList();
                        
                        saveYoutubeData();
                        if(window.showToast) window.showToast('私信记录已清空');
                    }
                    if (dmSettingsSheet) dmSettingsSheet.classList.remove('active');
                }
            });
        });
    }

    if (dmDeleteFriendBtn) {
        dmDeleteFriendBtn.addEventListener('click', () => {
            window.showCustomModal({
                title: '删除好友',
                message: '确定要删除该好友吗？私信记录将被清空。',
                confirmText: '删除',
                cancelText: '取消',
                isDestructive: true,
                onConfirm: () => {
                    if (currentSubChannelData) {
                        currentSubChannelData.dmHistory = [];
                        currentSubChannelData.isFriend = false; // Set to false to hide from friend list
                        saveYoutubeData();
                        
                        if (dmSettingsSheet) dmSettingsSheet.classList.remove('active');
                        if (groupChatView) groupChatView.classList.remove('active');
                        
                        renderMessagesList();
                        if(window.showToast) window.showToast('已删除好友');
                    }
                }
            });
        });
    }

    function openFanGroupChat(groupData) {
        if (!groupChatView || !currentSubChannelData) return;
        
        if (groupChatTitle) {
            groupChatTitle.textContent = `${groupData.name} (${groupData.memberCount || '3000'})`;
        }

        renderGroupChatHistory(false);
        groupChatView.classList.add('active');
        
        setTimeout(() => {
            if(groupChatContainer) groupChatContainer.scrollTop = groupChatContainer.scrollHeight;
        }, 100);
    }

    function openDMChat(subData) {
        if (!groupChatView || !currentSubChannelData) return;
        
        if (groupChatTitle) {
            groupChatTitle.textContent = `${subData.name}`;
        }

        renderGroupChatHistory(true);
        groupChatView.classList.add('active');
        
        setTimeout(() => {
            if(groupChatContainer) groupChatContainer.scrollTop = groupChatContainer.scrollHeight;
        }, 100);
    }

    function renderGroupChatHistory(isDM = false) {
        if (!groupChatContainer) return;
        groupChatContainer.innerHTML = '';
        
        const historyArray = isDM ? (currentSubChannelData.dmHistory || []) : (currentSubChannelData.groupChatHistory || []);
        if (isDM && !currentSubChannelData.dmHistory) {
            currentSubChannelData.dmHistory = historyArray;
        } else if (!isDM && !currentSubChannelData.groupChatHistory) {
            currentSubChannelData.groupChatHistory = historyArray;
        }

        historyArray.forEach(msg => {
            addGroupChatMessageToUI(msg);
        });
        groupChatContainer.scrollTop = groupChatContainer.scrollHeight;
    }

    function openOfferDetailSheet(msg) {
        let sheet = document.getElementById('yt-offer-detail-sheet');
        if (!sheet) {
            sheet = document.createElement('div');
            sheet.id = 'yt-offer-detail-sheet';
            sheet.className = 'bottom-sheet-overlay detail-sheet-overlay';
            sheet.style.zIndex = '600';
            sheet.innerHTML = `
                <div class="bottom-sheet" style="height: auto; max-height: 80%;">
                    <div class="sheet-handle"></div>
                    <div class="sheet-title">商单详情</div>
                    <div class="detail-sheet-content" id="yt-offer-detail-content" style="padding-bottom: 30px;">
                    </div>
                </div>
            `;
            document.getElementById('app').appendChild(sheet);
            sheet.addEventListener('mousedown', (e) => {
                if (e.target === sheet) sheet.classList.remove('active');
            });
        }
        
        const contentContainer = document.getElementById('yt-offer-detail-content');
        const isAccepted = msg.offerStatus === 'accepted';
        const isRejected = msg.offerStatus === 'rejected';
        const isCompleted = msg.offerStatus === 'completed';
        const isFailed = msg.offerStatus === 'failed';

        let buttonsHtml = '';
        if (isCompleted) {
            buttonsHtml = `<div style="text-align:center; padding: 12px; color: #8e8e93; font-size: 15px; background: #e8f5e9; border-radius: 12px; margin: 0 16px;">商单已结算完成</div>`;
        } else if (isFailed) {
            buttonsHtml = `<div style="text-align:center; padding: 12px; color: #8e8e93; font-size: 15px; background: #ffebee; border-radius: 12px; margin: 0 16px;">商单已违约取消</div>`;
        } else if (isAccepted) {
            buttonsHtml = `
                <div style="display: flex; gap: 12px; margin: 0 16px;">
                    <div id="offer-sheet-fail-btn" style="flex: 1; padding: 12px; text-align: center; border-radius: 12px; background: #ffebee; color: #ff3b30; font-size: 15px; font-weight: 600; cursor: pointer;">违约放弃</div>
                    <div id="offer-sheet-complete-btn" style="flex: 1; padding: 12px; text-align: center; border-radius: 12px; background: #e8f5e9; color: #388e3c; font-size: 15px; font-weight: 600; cursor: pointer;">完成结单</div>
                </div>
            `;
        } else if (isRejected) {
            buttonsHtml = `<div style="text-align:center; padding: 12px; color: #8e8e93; font-size: 15px; background: #f2f2f2; border-radius: 12px; margin: 0 16px;">已婉拒该商单</div>`;
        } else {
            buttonsHtml = `
                <div style="display: flex; gap: 12px; margin: 0 16px;">
                    <div id="offer-sheet-reject-btn" style="flex: 1; padding: 12px; text-align: center; border-radius: 12px; background: #ffebee; color: #ff3b30; font-size: 15px; font-weight: 600; cursor: pointer;">婉拒</div>
                    <div id="offer-sheet-accept-btn" style="flex: 1; padding: 12px; text-align: center; border-radius: 12px; background: #e8f5e9; color: #388e3c; font-size: 15px; font-weight: 600; cursor: pointer;">接取</div>
                </div>
            `;
        }

        contentContainer.innerHTML = `
            <div style="margin: 20px 16px; background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); border: 1px solid rgba(0,0,0,0.08); border-radius: 16px; padding: 20px;  position: relative; overflow: hidden;">
                <div style="position: absolute; top: -10px; right: -10px; opacity: 0.05; font-size: 100px; pointer-events: none;">
                    <i class="fas fa-handshake"></i>
                </div>
                <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px;">
                    <div style="font-size: 15px; color: #1c1c1e; line-height: 1.5; display: flex; flex-direction: column;">
                        <span style="color: #8e8e93; font-size: 12px; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Subject 项目</span>
                        <span style="font-weight: 500; font-size: 16px;">${msg.offerData.title || '无'} <span style="font-size: 11px; background: #e5e5ea; padding: 2px 6px; border-radius: 4px; color: #8e8e93;">${msg.offerData.offerType || '未知'}</span></span>
                    </div>
                    <div style="font-size: 15px; color: #1c1c1e; line-height: 1.5; display: flex; flex-direction: column; background: rgba(0,0,0,0.02); padding: 12px; border-radius: 8px;">
                        <span style="color: #8e8e93; font-size: 12px; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Requirements 需求</span>
                        <span style="white-space: pre-wrap;">${msg.offerData.requirement || '无'}</span>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                        <div style="display: flex; align-items: baseline; gap: 8px;">
                            <span style="color: #8e8e93; font-size: 12px; text-transform: uppercase; font-weight: 600;">Offer 报价</span>
                            <span style="font-size: 22px; color: #ff3b30; font-weight: 700;">${msg.offerData.price || '面议'}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <span style="color: #8e8e93; font-size: 11px; font-weight: 500;">违约金</span>
                            <span style="font-size: 14px; color: #000; font-weight: 600;">${msg.offerData.penalty || '无'}</span>
                        </div>
                    </div>
                </div>
            </div>
            ${buttonsHtml}
        `;

        if (!isAccepted && !isRejected && !isCompleted && !isFailed) {
            setTimeout(() => {
                const acceptBtn = document.getElementById('offer-sheet-accept-btn');
                const rejectBtn = document.getElementById('offer-sheet-reject-btn');
                
                if (acceptBtn) {
                    acceptBtn.addEventListener('click', () => {
                        msg.offerStatus = 'accepted';
                        saveYoutubeData();
                        sheet.classList.remove('active');
                        renderGroupChatHistory(true); 
                        triggerGroupChatAPI("好的，我接下这个合作了，请发送具体合同或细则。");
                    });
                }
                if (rejectBtn) {
                    rejectBtn.addEventListener('click', () => {
                        msg.offerStatus = 'rejected';
                        saveYoutubeData();
                        sheet.classList.remove('active');
                        renderGroupChatHistory(true);
                        triggerGroupChatAPI("抱歉，近期档期较满，暂不接取该合作，感谢邀请。");
                    });
                }
            }, 0);
        } else if (isAccepted) {
            setTimeout(() => {
                const completeBtn = document.getElementById('offer-sheet-complete-btn');
                const failBtn = document.getElementById('offer-sheet-fail-btn');
                
                if (completeBtn) {
                    completeBtn.addEventListener('click', () => {
                        sheet.classList.remove('active');
                        processOfferCompletion(msg, currentSubChannelData, 'complete');
                    });
                }
                if (failBtn) {
                    failBtn.addEventListener('click', () => {
                        sheet.classList.remove('active');
                        processOfferCompletion(msg, currentSubChannelData, 'fail');
                    });
                }
            }, 0);
        }

        sheet.classList.add('active');
    }

    function processOfferCompletion(msg, sub, actionType) {
        const effectiveYtUser = getCurrentYtCommunityUser();
        if (!sub.generatedContent) {
            sub.generatedContent = { pastVideos: [], communityPosts: [], currentLive: null, fanGroup: null };
        }
        
        if (actionType === 'complete') {
            msg.offerStatus = 'completed';
            const priceNum = msg.offerData.rmbAmount || parseFloat((msg.offerData.price || '0').replace(/[^0-9.]/g, '')) || 0;
            if (!channelState.dataCenter) channelState.dataCenter = { views: 0, sc: 0, subs: 0, commission: 0 };
            if (!channelState.dataCenter.commission) channelState.dataCenter.commission = 0;
            channelState.dataCenter.commission += priceNum;
            
            const type = msg.offerData.offerType || 'video';
            const title = msg.offerData.title || '合作项目';
            
            if (type === 'video') {
                if (!sub.generatedContent.pastVideos) sub.generatedContent.pastVideos = [];
                sub.generatedContent.pastVideos.unshift({
                    title: `【官方宣传】${title} ft. ${effectiveYtUser.name || 'User'}`,
                    views: Math.floor(Math.random() * 50) + 10 + '万 次观看',
                    time: '刚刚',
                    thumbnail: 'https://picsum.photos/seed/' + Math.random() + '/320/180?grayscale',
                    comments: [{name: effectiveYtUser.name || '我', text: '感谢官方的邀请！'}]
                });
                sub.dmHistory.push({ type: 'char', name: sub.name, text: '审片通过！视频已经在我们频道上线，反响很好，合作款已打入账户，期待下次合作！' });
            } else if (type === 'live') {
                if (!sub.generatedContent.pastVideos) sub.generatedContent.pastVideos = [];
                sub.generatedContent.pastVideos.unshift({
                    title: `【官方直播回放】${title} 合作专场`,
                    views: Math.floor(Math.random() * 20) + 5 + '万 次观看',
                    time: '刚刚',
                    thumbnail: 'https://picsum.photos/seed/' + Math.random() + '/320/180?grayscale',
                    comments: [{name: effectiveYtUser.name || '我', text: '昨晚带货太有意思了！'}]
                });
                sub.dmHistory.push({ type: 'char', name: sub.name, text: '昨晚在您频道的直播效果爆炸！录播我们官方也同步发布了，感谢主播的热情带货！' });
            } else if (type === 'post') {
                if (!sub.generatedContent.communityPosts) sub.generatedContent.communityPosts = [];
                sub.generatedContent.communityPosts.unshift({
                    content: `非常荣幸能邀请到 @${effectiveYtUser.name || 'User'} 参与我们的 ${title} 活动！现场返图来啦~ #商业合作`,
                    likes: Math.floor(Math.random() * 10) + 1 + '万',
                    time: '刚刚'
                });
                sub.dmHistory.push({ type: 'char', name: sub.name, text: '社群动态已经看到了，互动率很高，感谢您的支持！' });
            } else if (type === 'collab') {
                if (!channelState.pastVideos) channelState.pastVideos = [];
                const videoObj = {
                    title: `【联动】${title} ft. ${sub.name}`,
                    views: Math.floor(Math.random() * 100) + 20 + '万 次观看',
                    time: '刚刚',
                    thumbnail: 'https://picsum.photos/seed/' + Math.random() + '/320/180?grayscale',
                    comments: [{name: sub.name, text: '太好玩了下次再来！'}]
                };
                channelState.pastVideos.unshift(videoObj);
                
                if (!sub.generatedContent.pastVideos) sub.generatedContent.pastVideos = [];
                sub.generatedContent.pastVideos.unshift(videoObj);
                
                if (!sub.generatedContent.communityPosts) sub.generatedContent.communityPosts = [];
                sub.generatedContent.communityPosts.unshift({
                    content: `今天和 @${effectiveYtUser.name || 'User'} 合作了《${title}》，真是太有趣了，快去看正片！`,
                    likes: Math.floor(Math.random() * 5) + 1 + '万',
                    time: '刚刚'
                });
                sub.dmHistory.push({ type: 'char', name: sub.name, text: '节目效果太棒了，动态我也发了，下次再一起玩！' });
            } else {
                sub.dmHistory.push({ type: 'char', name: sub.name, text: '项目已验收，合作款已结清，期待下次合作！' });
            }
            
            if(window.showToast) window.showToast('结单成功，全网数据已同步！');
            
        } else if (actionType === 'fail') {
            msg.offerStatus = 'failed';
            const penaltyNum = msg.offerData.rmbPenalty || parseFloat((msg.offerData.penalty || '0').replace(/[^0-9.]/g, '')) || 0;
            if (!channelState.dataCenter) channelState.dataCenter = { views: 0, sc: 0, subs: 0, commission: 0 };
            if (!channelState.dataCenter.commission) channelState.dataCenter.commission = 0;
            channelState.dataCenter.commission -= penaltyNum;
            
            sub.dmHistory.push({ type: 'char', name: sub.name, text: '由于您单方面违约，项目已终止，违约金已从总资产中扣除。希望下次合作能顺利。' });
            if(window.showToast) window.showToast('已违约放弃，扣除违约金');
        }
        
        saveYoutubeData();
        renderGroupChatHistory(true); 
        
        const dataCenterSheet = document.getElementById('yt-data-center-sheet');
        if (dataCenterSheet && dataCenterSheet.classList.contains('active')) {
            renderDataCenter();
        }
        
        const activeTab = document.querySelector('#profile-main-tabs .yt-sliding-tab.active');
        if (activeTab && activeTab.getAttribute('data-target') === 'past') { activeTab.click(); }
    }

    function addGroupChatMessageToUI(msg) {
        if (!groupChatContainer) return;

        const row = document.createElement('div');
        
        if (msg.isOffer) {
            row.className = 'yt-bubble-row left';
            
            const isAccepted = msg.offerStatus === 'accepted';
            const isRejected = msg.offerStatus === 'rejected';
            const isCompleted = msg.offerStatus === 'completed';
            const isFailed = msg.offerStatus === 'failed';

            let statusText = '待处理';
            let statusColor = '#f57c00';
            if (isAccepted) { statusText = '已接取'; statusColor = '#388e3c'; }
            else if (isRejected) { statusText = '已婉拒'; statusColor = '#ff3b30'; }
            else if (isCompleted) { statusText = '已完成'; statusColor = '#007aff'; }
            else if (isFailed) { statusText = '已违约'; statusColor = '#8e8e93'; }

            row.innerHTML = `
                <div class="yt-bubble-avatar"><img src="${typeof resolveYtChannelAvatar === 'function' ? resolveYtChannelAvatar(currentSubChannelData) : currentSubChannelData.avatar}"></div>
                <div class="yt-bubble-content" style="max-width: 80%;">
                    <div class="yt-bubble-name">${msg.name}</div>
                    <div class="yt-offer-bubble" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border: 1px solid rgba(0,0,0,0.08); border-radius: 16px; padding: 12px; cursor: pointer; display: flex; align-items: center; gap: 10px; margin-top: 4px;">
                        <div style="background: #007aff; color: #fff; width: 32px; height: 32px; border-radius: 8px; display: flex; justify-content: center; align-items: center;">
                            <i class="fas fa-file-signature"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 14px; font-weight: 600; color: #1c1c1e;">商务合作邀请</div>
                            <div style="font-size: 12px; color: ${statusColor}; font-weight: 500; margin-top: 2px;">状态: ${statusText}</div>
                        </div>
                    </div>
                </div>
            `;
            
            setTimeout(() => {
                const bubble = row.querySelector('.yt-offer-bubble');
                if (bubble) {
                    bubble.addEventListener('click', () => {
                        openOfferDetailSheet(msg);
                    });
                }
            }, 0);

        } else if (msg.type === 'user') {
            row.className = 'yt-bubble-row right';
            const effectiveYtUser = getCurrentYtCommunityUser();
            row.innerHTML = `
                <div class="yt-bubble-avatar"><img src="${effectiveYtUser.avatarUrl || 'https://picsum.photos/100'}"></div>
                <div class="yt-bubble-content">
                    <div class="yt-bubble-msg">${msg.text}</div>
                </div>
            `;
        } else if (msg.type === 'char') {
            row.className = 'yt-bubble-row left';
            // isDM check based on Title matching the name
            const isDMContext = groupChatTitle && groupChatTitle.textContent === currentSubChannelData.name;
            const displayName = isDMContext ? msg.name : `${msg.name} <span style="font-size: 10px; background: rgba(0, 122, 255, 0.1); color: #007aff; padding: 2px 6px; border-radius: 6px; margin-left: 6px; font-weight: 600;">群主</span>`;
            
            let charAvatarSrc = typeof resolveYtChannelAvatar === 'function' ? resolveYtChannelAvatar(currentSubChannelData) : currentSubChannelData.avatar;
            
            row.innerHTML = `
                <div class="yt-bubble-avatar" style=""><img src="${charAvatarSrc}"></div>
                <div class="yt-bubble-content">
                    <div class="yt-bubble-name" style="color: #1c1c1e; font-weight: 500; display: flex; align-items: center;">${displayName}</div>
                    <div class="yt-bubble-msg">${msg.text}</div>
                </div>
            `;
        } else {
            row.className = 'yt-bubble-row left';
            let hash = 0;
            for (let i = 0; i < msg.name.length; i++) hash = msg.name.charCodeAt(i) + ((hash << 5) - hash);
            const color = '#' + (hash & 0x00FFFFFF).toString(16).padStart(6, '0');
            
            row.innerHTML = `
                <div class="yt-bubble-avatar" style="background-color: ${color}; display: flex; justify-content: center; align-items: center; color: white; font-size: 14px; font-weight: bold;">
                    ${msg.name.substring(0, 1)}
                </div>
                <div class="yt-bubble-content">
                    <div class="yt-bubble-name">${msg.name}</div>
                    <div class="yt-bubble-msg">${msg.text}</div>
                </div>
            `;
        }

        groupChatContainer.appendChild(row);
        groupChatContainer.scrollTop = groupChatContainer.scrollHeight;
    }

    if (groupChatSendBtn && groupChatInput) {
        groupChatSendBtn.addEventListener('click', () => {
            sendGroupChatMessageOnly(groupChatInput.value.trim());
        });
        
        groupChatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendGroupChatMessageOnly(groupChatInput.value.trim());
                return;
                const text = groupChatInput.value.trim();
                if (text) {
                    const effectiveYtUser = getCurrentYtCommunityUser();
                    const userMsg = { type: 'user', name: effectiveYtUser.name || '我', text: text };
                    
                    const isDM = groupChatTitle.textContent === currentSubChannelData.name;
                    if (isDM) {
                        if (!currentSubChannelData.dmHistory) currentSubChannelData.dmHistory = [];
                        currentSubChannelData.dmHistory.push(userMsg);
                    } else {
                        if (!currentSubChannelData.groupChatHistory) currentSubChannelData.groupChatHistory = [];
                        currentSubChannelData.groupChatHistory.push(userMsg);
                    }
                    
                    saveYoutubeData();
                    addGroupChatMessageToUI(userMsg);
                    groupChatInput.value = '';
                }
            }
        });

        groupChatInput.setAttribute('enterkeyhint', 'send');
    }

    if (groupChatApiBtn && groupChatInput) {
        groupChatApiBtn.addEventListener('click', () => {
            triggerGroupChatAPI('');
        });
    }

    async function triggerGroupChatAPI(text) {
        if (isGroupChatLoading || !currentSubChannelData) return;

        const isDM = groupChatTitle.textContent === currentSubChannelData.name;
        const targetHistory = isDM ? 
            (currentSubChannelData.dmHistory = currentSubChannelData.dmHistory || []) : 
            (currentSubChannelData.groupChatHistory = currentSubChannelData.groupChatHistory || []);

        let isUserMsg = false;
        if (text.length > 0) {
            isUserMsg = true;
            const effectiveYtUser = getCurrentYtCommunityUser();
            const userMsg = { type: 'user', name: effectiveYtUser.name || '我', text: text };
            targetHistory.push(userMsg);
            saveYoutubeData();
            addGroupChatMessageToUI(userMsg);
            if(groupChatInput) groupChatInput.value = '';
        } else {
            isUserMsg = targetHistory.some(m => m.type === 'user');
        }

        isGroupChatLoading = true;
        
        const typingId = 'typing-' + Date.now();
        const typingRow = document.createElement('div');
        typingRow.className = 'yt-bubble-row left';
        typingRow.id = typingId;
        typingRow.innerHTML = `
            <div class="yt-bubble-avatar"><i class="fas fa-users" style="color:#aaa; font-size:20px; line-height:36px; text-align:center; width:100%;"></i></div>
            <div class="yt-bubble-content">
                <div class="yt-bubble-msg"><i class="fas fa-ellipsis-h fa-fade"></i></div>
            </div>
        `;
        groupChatContainer.appendChild(typingRow);
        groupChatContainer.scrollTop = groupChatContainer.scrollHeight;

        try {
            const char = currentSubChannelData;
            const effectiveYtUser = getCurrentYtCommunityUser();
            const userPersona = effectiveYtUser.persona || '普通粉丝';
            
            let wbContext = '';
            if (typeof window.getGlobalWorldBookContext === 'function') {
                wbContext = window.getGlobalWorldBookContext() || '';
            } else if (channelState && channelState.boundWorldBookIds && Array.isArray(channelState.boundWorldBookIds) && window.getWorldBooks) {
                const wbs = window.getWorldBooks();
                channelState.boundWorldBookIds.forEach(id => {
                    const boundWb = wbs.find(w => w.id === id);
                    if (boundWb && boundWb.entries) {
                        wbContext += `\n【${boundWb.name}】:\n` + boundWb.entries.map(e => `${e.keyword}: ${e.content}`).join('\n');
                    }
                });
            }

            const historyStr = targetHistory.slice(-10).map(m => `${m.name}: ${m.text}`).join('\n');

            let instructionStr = isUserMsg 
                ? `用户"${effectiveYtUser.name || '我'}"刚刚发送了消息。请先生成其他粉丝的讨论或附和，然后你作为群主回复用户的消息（也可以带上其他粉丝）。`
                : `用户现在在潜水没有说话。请生成其他粉丝在聊天的内容，然后你作为群主偶尔插话或回复他们，展现群里的日常氛围。`;
            
            if (isDM) {
                let contextAddon = '';
                if (char.isBusiness) {
                    contextAddon = `\n注意：当前是商务私信，你扮演品牌方/赞助商（"${char.name}"）。如果用户刚刚接取了你的商单（发了同意接取之类的话），你需要表现出感谢并回复准备对接细节/合同；如果用户婉拒了，则礼貌回应。`;
                }
                instructionStr = `这是一对一私信。用户刚刚发送了消息（如果上面是用户潜水，则代表没有新消息），请你作为"${char.name}"，直接对用户"${effectiveYtUser.name || '我'}"进行私信回复，语气要自然。${contextAddon}`;
            }

            let promptStr = channelState.groupChatPrompt || defaultGroupChatPrompt;
            const charPersona = typeof window.getYtChannelPersonaWithRelationships === 'function'
                ? window.getYtChannelPersonaWithRelationships(char)
                : (char.desc || '未知');
            let finalPrompt = promptStr
                .replace(/{char}/g, char.name || '')
                .replace(/{char_persona}/g, charPersona)
                .replace(/{user}/g, effectiveYtUser.name || '我')
                .replace(/{user_persona}/g, userPersona)
                .replace(/{wb_context}/g, wbContext)
                .replace(/{chat_history}/g, historyStr)
                .replace(/{trigger_instruction}/g, instructionStr);

            let endpoint = window.apiConfig.endpoint;
            if(endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
            if(!endpoint.endsWith('/chat/completions')) {
                endpoint = endpoint.endsWith('/v1') ? endpoint + '/chat/completions' : endpoint + '/v1/chat/completions';
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: window.apiConfig.model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: finalPrompt }],
                    temperature: 0.8,
                    response_format: { type: "json_object" } 
                })
            });

            if (!res.ok) throw new Error(`API Error`);
            const data = await res.json();
            let resultText = data.choices[0].message.content;
            resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            const responseObj = sanitizeObj(JSON.parse(resultText));

            const tRow = document.getElementById(typingId);
            if (tRow) tRow.remove();

            if (!isDM && responseObj.otherFansReplies && Array.isArray(responseObj.otherFansReplies)) {
                responseObj.otherFansReplies.forEach((reply, i) => {
                    setTimeout(() => {
                        const fanMsg = { type: 'fan', name: reply.name, text: reply.text };
                        targetHistory.push(fanMsg);
                        saveYoutubeData();
                        addGroupChatMessageToUI(fanMsg);
                    }, i * 1500); 
                });
            }

            let replies = [];
            if (responseObj.charReplies && Array.isArray(responseObj.charReplies)) {
                replies = responseObj.charReplies;
            } else if (responseObj.charReply) {
                replies = [responseObj.charReply];
            }

            const baseDelay = (!isDM && responseObj.otherFansReplies ? responseObj.otherFansReplies.length : 0) * 1500 + 1000;
            
            replies.forEach((replyText, index) => {
                setTimeout(() => {
                    if (replyText) {
                        const charMsg = { type: 'char', name: char.name, text: replyText };
                        targetHistory.push(charMsg);
                        saveYoutubeData();
                        addGroupChatMessageToUI(charMsg);
                    }
                }, baseDelay + (index * 2000)); 
            });

        } catch (error) {
            console.error('Group Chat API Error:', error);
            const tRow = document.getElementById(typingId);
            if (tRow) tRow.remove();
            if(window.showToast) window.showToast('网络错误，无法获取回复');
        } finally {
            setTimeout(() => { isGroupChatLoading = false; }, 2000);
        }
    }

    const communityDetailSheet = document.getElementById('yt-community-detail-sheet');
    if (communityDetailSheet) {
        communityDetailSheet.addEventListener('mousedown', (e) => {
            if (e.target === communityDetailSheet) {
                communityDetailSheet.classList.remove('active');
            }
        });
    }
