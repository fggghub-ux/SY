// --- Video Player Logic ---
    const playerView = document.getElementById('yt-video-player-view');
    const playerBackBtn = document.getElementById('yt-player-back-btn');
    const ytPlayerVideoArea = document.getElementById('yt-player-video-area');
    const ytPlayerThumbnail = document.getElementById('yt-player-thumbnail');
    const ytCharSpeechBubble = document.getElementById('yt-char-speech-bubble');
    
    let currentVideoData = null;
    let chatInterval = null;
    let tempVideoCover = null;
    let tempGuestData = null;

    function getCurrentYtViewer() {
        if (typeof window.getYtEffectiveUserState === 'function') {
            return window.getYtEffectiveUserState() || {};
        }
        return ytUserState || {};
    }

    const ytEditVideoSheet = document.getElementById('yt-edit-video-sheet');
    const ytEditVideoCoverBtn = document.getElementById('yt-edit-video-cover-btn');
    const ytEditVideoUpload = document.getElementById('yt-edit-video-upload');
    const ytEditVideoCoverImg = document.getElementById('yt-edit-video-cover-img');
    const ytEditVideoTitleInput = document.getElementById('yt-edit-video-title-input');
    const confirmYtVideoBtn = document.getElementById('confirm-yt-video-btn');
    const resetYtVideoBtn = document.getElementById('reset-yt-video-btn');

    // Guest Picker Elements
    const ytGuestPickerSheet = document.getElementById('yt-guest-picker-sheet');
    const ytGuestList = document.getElementById('yt-guest-list');
    const closeYtGuestPickerBtn = document.getElementById('close-yt-guest-picker-btn');
    const ytEditVideoGuestSelector = document.getElementById('yt-edit-video-guest-selector');
    const ytEditVideoGuestName = document.getElementById('yt-edit-video-guest-name');
    
    // User Live Guest Elements
    const ytUserLiveGuestSelector = document.getElementById('yt-user-live-guest-selector');
    const ytUserLiveGuestName = document.getElementById('yt-user-live-guest-name');
    let userLiveSelectedGuest = null;

    function renderGuestPicker(onSelect) {
        if (!ytGuestList) return;
        ytGuestList.innerHTML = '';

        // "No Guest" option
        const noneItem = document.createElement('div');
        noneItem.className = 'account-card';
        noneItem.innerHTML = `<div class="account-content"><div class="account-name">无联动嘉宾</div></div>`;
        noneItem.addEventListener('click', () => {
            onSelect(null);
            if(ytGuestPickerSheet) ytGuestPickerSheet.classList.remove('active');
        });
        ytGuestList.appendChild(noneItem);

        // Subscriptions as options
        mockSubscriptions.forEach(sub => {
            // Avoid selecting self
            if (currentSubChannelData && sub.id === currentSubChannelData.id) return;
            if (ytUserState && sub.name === ytUserState.name) return;
            const avatarUrl = typeof resolveYtChannelAvatar === 'function'
                ? resolveYtChannelAvatar(sub)
                : (sub.avatar || 'https://picsum.photos/80/80?grayscale');

            const item = document.createElement('div');
            item.className = 'account-card';
            item.innerHTML = `
                <div class="account-content">
                    <div class="account-avatar"><img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>
                    <div class="account-info">
                        <div class="account-name">${sub.name}</div>
                        <div class="account-detail">${sub.subs || '0'} 订阅者</div>
                    </div>
                </div>
            `;
            item.addEventListener('click', () => {
                onSelect(sub);
                if(ytGuestPickerSheet) ytGuestPickerSheet.classList.remove('active');
            });
            ytGuestList.appendChild(item);
        });
    }

    if (closeYtGuestPickerBtn && ytGuestPickerSheet) {
        closeYtGuestPickerBtn.addEventListener('click', () => ytGuestPickerSheet.classList.remove('active'));
        ytGuestPickerSheet.addEventListener('mousedown', (e) => {
            if (e.target === ytGuestPickerSheet) ytGuestPickerSheet.classList.remove('active');
        });
    }

    if (ytEditVideoGuestSelector && ytGuestPickerSheet) {
        ytEditVideoGuestSelector.addEventListener('click', () => {
            renderGuestPicker((selectedSub) => {
                tempGuestData = selectedSub;
                if (ytEditVideoGuestName) {
                    ytEditVideoGuestName.textContent = selectedSub ? selectedSub.name : '无';
                }
            });
            ytGuestPickerSheet.classList.add('active');
        });
    }
    
    if (ytUserLiveGuestSelector && ytGuestPickerSheet) {
        ytUserLiveGuestSelector.addEventListener('click', () => {
            renderGuestPicker((selectedSub) => {
                userLiveSelectedGuest = selectedSub;
                if (ytUserLiveGuestName) {
                    ytUserLiveGuestName.textContent = selectedSub ? selectedSub.name : '无';
                }
            });
            ytGuestPickerSheet.classList.add('active');
        });
    }

    if (ytPlayerVideoArea && ytEditVideoSheet) {
        ytPlayerVideoArea.addEventListener('click', (e) => {
            if (e.target === ytPlayerVideoArea || e.target === ytPlayerThumbnail) {
                if(currentVideoData) {
                    ytEditVideoTitleInput.value = currentVideoData.title || '';
                    if (currentVideoData.thumbnail) {
                        ytEditVideoCoverImg.src = currentVideoData.thumbnail;
                        ytEditVideoCoverImg.style.display = 'block';
                    } else {
                        ytEditVideoCoverImg.style.display = 'none';
                    }

                    // Set temp guest data
                    tempGuestData = currentVideoData.guest || null;
                    if(ytEditVideoGuestName) {
                        ytEditVideoGuestName.textContent = tempGuestData ? tempGuestData.name : '无';
                    }

                    ytEditVideoSheet.classList.add('active');
                }
            }
        });

        if (ytEditVideoSheet) {
            ytEditVideoSheet.addEventListener('mousedown', (e) => {
                if (e.target === ytEditVideoSheet) ytEditVideoSheet.classList.remove('active');
            });
        }

        if (ytEditVideoCoverBtn && ytEditVideoUpload) {
            ytEditVideoCoverBtn.addEventListener('click', () => ytEditVideoUpload.click());
            ytEditVideoUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (window.compressImage) {
                            window.compressImage(event.target.result, 640, 360, (compressedUrl) => {
                                ytEditVideoCoverImg.src = compressedUrl;
                                ytEditVideoCoverImg.style.display = 'block';
                            });
                        } else {
                            ytEditVideoCoverImg.src = event.target.result;
                            ytEditVideoCoverImg.style.display = 'block';
                        }
                    };
                    reader.readAsDataURL(file);
                }
                e.target.value = '';
            });
        }

        if (resetYtVideoBtn) {
            resetYtVideoBtn.addEventListener('click', () => {
                ytEditVideoCoverImg.src = '';
                ytEditVideoCoverImg.style.display = 'none';
                ytEditVideoTitleInput.value = currentVideoData._originalTitle || '无标题';
            });
        }

        if (confirmYtVideoBtn) {
            confirmYtVideoBtn.addEventListener('click', () => {
                if (!currentVideoData) return;
                
                const newTitle = ytEditVideoTitleInput.value.trim() || '无标题';
                const newCover = (ytEditVideoCoverImg.style.display === 'block' && ytEditVideoCoverImg.src) ? ytEditVideoCoverImg.src : 'https://picsum.photos/320/180?grayscale';

                currentVideoData.title = newTitle;
                currentVideoData.thumbnail = newCover;
                currentVideoData.guest = tempGuestData;
                
                const titleEl = document.getElementById('yt-player-title');
                if(titleEl) titleEl.textContent = newTitle;
                const liveTitleOverlay = document.getElementById('yt-player-live-title-overlay');
                if(liveTitleOverlay) liveTitleOverlay.textContent = newTitle;
                if(ytPlayerThumbnail) ytPlayerThumbnail.src = newCover;

                const channel = currentVideoData.channelData;
                if (channel && channel.generatedContent) {
                    if (currentVideoData.isLive && channel.generatedContent.currentLive) {
                        channel.generatedContent.currentLive.title = newTitle;
                        channel.generatedContent.currentLive.thumbnail = newCover;
                        channel.generatedContent.currentLive.guest = tempGuestData;
                    } else if (!currentVideoData.isLive && channel.generatedContent.pastVideos) {
                        const originalTitle = currentVideoData._originalTitle;
                        const match = channel.generatedContent.pastVideos.find(v => v.title === originalTitle);
                        if (match) {
                            match.title = newTitle;
                            match.thumbnail = newCover;
                            match.guest = tempGuestData;
                        }
                    }
                }
                
                if (channel && channel.id === 'user_channel_id' && channelState.pastVideos) {
                    const originalTitle = currentVideoData._originalTitle;
                    const match = channelState.pastVideos.find(v => v.title === originalTitle);
                    if (match) {
                        match.title = newTitle;
                        match.thumbnail = newCover;
                        match.guest = tempGuestData;
                    }
                }
                
                const mv = mockVideos.find(v => v.title === currentVideoData._originalTitle);
                if (mv) {
                    mv.title = newTitle;
                    mv.thumbnail = newCover;
                    mv.guest = tempGuestData;
                }
                
                currentVideoData._originalTitle = newTitle; 

                saveYoutubeData();
                renderVideos();
                
                const activeTab = document.querySelector('#sub-channel-tabs .yt-sliding-tab.active');
                if (activeTab) {
                    const target = activeTab.getAttribute('data-target');
                    if (target === 'live' || target === 'past') renderGeneratedContent(target);
                } else if (channel && channel.id === 'user_channel_id') {
                    const userPastTab = document.querySelector('#profile-main-tabs .yt-sliding-tab.active');
                    if(userPastTab) userPastTab.click();
                }
                
                ytEditVideoSheet.classList.remove('active');
                if (window.showToast) window.showToast('视频信息已更新');
            });
        }
    }

    if(playerBackBtn && playerView) {
        playerBackBtn.addEventListener('click', () => {
            if (chatInput && document.activeElement === chatInput) chatInput.blur();
            if (ytScCustomInput && document.activeElement === ytScCustomInput) ytScCustomInput.blur();
            if (ytScInput && document.activeElement === ytScInput) ytScInput.blur();
            playerView.classList.remove('active');
            playerView.classList.remove('yt-char-live-mode');
            if(chatInterval) clearInterval(chatInterval);
            
            if (window.ytLiveTimeouts) {
                window.ytLiveTimeouts.forEach(clearTimeout);
                window.ytLiveTimeouts = [];
            }
            
            if(ytCharSpeechBubble) {
                ytCharSpeechBubble.innerHTML = '';
                ytCharSpeechBubble.style.display = 'none';
            }
        });
    }

    function clearCharLiveBubbles() {
        if (!ytCharSpeechBubble) return;
        ytCharSpeechBubble.innerHTML = '';
        ytCharSpeechBubble.style.display = 'none';
    }

    function addCharLiveBubble(text, options = {}) {
        if (!ytCharSpeechBubble || (!text && !options.loading) || !currentVideoData || !currentVideoData.isLive) return;
        const bubble = document.createElement('div');
        bubble.className = options.isNarrative ? 'yt-char-live-narrative' : 'yt-char-live-bubble';
        if (options.loading) {
            bubble.innerHTML = '<i class="fas fa-ellipsis-h fa-fade"></i>';
            bubble.dataset.loading = 'true';
        } else {
            bubble.textContent = text;
            
            // Persist the bubble if it's not narrative
            if (!options.isNarrative && !options.skipPersist) {
                if (!currentVideoData.initialBubbles) currentVideoData.initialBubbles = [];
                currentVideoData.initialBubbles.push(text);
                
                // Update the underlying data structure (use replacement instead of push to avoid reference duplication)
                const channel = currentVideoData.channelData;
                if (channel) {
                    if (channel.id === 'user_channel_id' && channelState.activeUserLive) {
                        channelState.activeUserLive.initialBubbles = [...currentVideoData.initialBubbles];
                    } else if (channel.generatedContent && channel.generatedContent.currentLive) {
                        channel.generatedContent.currentLive.initialBubbles = [...currentVideoData.initialBubbles];
                    }
                    
                    if (typeof mockVideos !== 'undefined') {
                        const mv = mockVideos.find(v => v.title === currentVideoData.title && v.isLive === currentVideoData.isLive);
                        if (mv) mv.initialBubbles = [...currentVideoData.initialBubbles];
                    }
                    
                    if (typeof saveYoutubeData === 'function') saveYoutubeData();
                }
            }
        }
        ytCharSpeechBubble.style.display = 'flex';
        ytCharSpeechBubble.appendChild(bubble);

        const lifetime = options.loading ? 0 : (options.lifetime || 8000);
        if (lifetime > 0) {
            setTimeout(() => {
                bubble.style.opacity = '0';
                setTimeout(() => {
                    bubble.remove();
                    if (ytCharSpeechBubble && ytCharSpeechBubble.children.length === 0) {
                        ytCharSpeechBubble.style.display = 'none';
                    }
                }, 1000);
            }, lifetime);
        }
        return bubble;
    }

    function removeCharLiveLoadingBubbles() {
        if (!ytCharSpeechBubble) return;
        ytCharSpeechBubble.querySelectorAll('[data-loading="true"]').forEach(item => item.remove());
        if (ytCharSpeechBubble.children.length === 0) {
            ytCharSpeechBubble.style.display = 'none';
        }
    }

    function ensureCharLiveChrome(video) {
        if (!playerView || !ytPlayerVideoArea) return;
        const isCharLive = !!(video && video.isLive && video.channelData && video.channelData.id !== 'user_channel_id');
        playerView.classList.toggle('yt-char-live-mode', isCharLive);

        let titleOverlay = document.getElementById('yt-player-live-title-overlay');
        if (!titleOverlay) {
            titleOverlay = document.createElement('div');
            titleOverlay.id = 'yt-player-live-title-overlay';
            titleOverlay.className = 'yt-player-live-title-overlay';
            ytPlayerVideoArea.appendChild(titleOverlay);
        }

        let statsOverlay = document.getElementById('yt-player-live-stats-overlay');
        if (!statsOverlay) {
            statsOverlay = document.createElement('div');
            statsOverlay.id = 'yt-player-live-stats-overlay';
            statsOverlay.className = 'yt-player-live-stats-overlay';
            ytPlayerVideoArea.appendChild(statsOverlay);
        }

        let actionsOverlay = document.getElementById('yt-player-live-actions-overlay');
        if (!actionsOverlay) {
            actionsOverlay = document.createElement('div');
            actionsOverlay.id = 'yt-player-live-actions-overlay';
            actionsOverlay.className = 'yt-player-live-actions-overlay';
            actionsOverlay.innerHTML = `
                <button type="button" class="yt-player-live-action-btn" id="yt-player-live-gift-btn"><i class="fas fa-gift"></i></button>
                <button type="button" class="yt-player-live-action-btn" id="yt-player-live-menu-btn"><i class="fas fa-plus"></i></button>
                <div class="yt-player-live-action-menu" id="yt-player-live-action-menu">
                    <div class="yt-player-live-menu-item" id="yt-player-live-all-content-btn"><i class="fas fa-list-alt"></i><span style="margin-left: 6px;">全部内容</span></div>
                    <div class="yt-player-live-menu-item" id="yt-player-live-continue-btn"><i class="fas fa-forward"></i><span style="margin-left: 6px;">继续直播</span></div>
                </div>
            `;
            ytPlayerVideoArea.appendChild(actionsOverlay);

            const liveGiftBtn = actionsOverlay.querySelector('#yt-player-live-gift-btn');
            const liveMenuBtn = actionsOverlay.querySelector('#yt-player-live-menu-btn');
            const liveMenu = actionsOverlay.querySelector('#yt-player-live-action-menu');
            const liveContinueBtn = actionsOverlay.querySelector('#yt-player-live-continue-btn');
            const liveAllContentBtn = actionsOverlay.querySelector('#yt-player-live-all-content-btn');

            if (liveGiftBtn) {
                liveGiftBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const giftBtn = document.getElementById('yt-gift-btn');
                    if (giftBtn) giftBtn.click();
                });
            }
            if (liveMenuBtn && liveMenu) {
                liveMenuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    liveMenu.classList.toggle('active');
                });
            }
            if (liveContinueBtn) {
                liveContinueBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (liveMenu) liveMenu.classList.remove('active');
                    const actionContinue = document.getElementById('yt-player-action-continue');
                    if (actionContinue) actionContinue.click();
                });
            }
            if (liveAllContentBtn) {
                liveAllContentBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (liveMenu) liveMenu.classList.remove('active');
                    openCharAllContentSheet();
                });
            }
        }

        let allContentSheet = document.getElementById('yt-char-all-content-sheet');
        if (!allContentSheet) {
            allContentSheet = document.createElement('div');
            allContentSheet.id = 'yt-char-all-content-sheet';
            allContentSheet.className = 'bottom-sheet-overlay';
            allContentSheet.innerHTML = `
                <div class="bottom-sheet" style="background: #ffffff;">
                    <div class="sheet-header" style="padding: 16px; border-bottom: 1px solid #f2f2f2; display: flex; justify-content: space-between; align-items: center;">
                        <h3 class="sheet-title" style="margin: 0; font-size: 18px; font-weight: 600;">全部内容</h3>
                        <div>
                            <button id="clear-yt-all-content-btn" style="background: none; border: none; font-size: 14px; cursor: pointer; color: #ff3b30; margin-right: 16px; font-weight: 500;">清空</button>
                            <button class="sheet-close" id="close-yt-all-content-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #606060;"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                    <div class="sheet-content" id="yt-char-all-content-list" style="max-height: 60vh; min-height: 30vh; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 4px; background: #ffffff;">
                    </div>
                </div>
            `;
            document.body.appendChild(allContentSheet);
            
            const closeBtn = allContentSheet.querySelector('#close-yt-all-content-btn');
            closeBtn.addEventListener('click', () => allContentSheet.classList.remove('active'));
            
            const clearBtn = allContentSheet.querySelector('#clear-yt-all-content-btn');
            clearBtn.addEventListener('click', () => {
                if (window.showCustomModal) {
                    window.showCustomModal({
                        title: '清空内容',
                        message: '确定要清空该直播间的所有历史内容吗？此操作无法撤销。',
                        confirmText: '清空',
                        cancelText: '取消',
                        isDestructive: true,
                        onConfirm: () => {
                            if (currentVideoData && currentVideoData.channelData) {
                                currentVideoData.channelData.liveHistory = [];
                                currentVideoData.initialBubbles = [];
                                
                                const channel = currentVideoData.channelData;
                                if (channel.id === 'user_channel_id' && channelState.activeUserLive) {
                                    channelState.activeUserLive.history = [];
                                    channelState.activeUserLive.initialBubbles = [];
                                } else if (channel.generatedContent && channel.generatedContent.currentLive) {
                                    channel.generatedContent.currentLive.initialBubbles = [];
                                }
                                
                                if(typeof saveYoutubeData === 'function') saveYoutubeData();
                                openCharAllContentSheet(); // refresh
                                if(window.showToast) window.showToast('历史内容已清空');
                            }
                        }
                    });
                }
            });

            allContentSheet.addEventListener('mousedown', (e) => {
                if (e.target === allContentSheet) allContentSheet.classList.remove('active');
            });
        }

        titleOverlay.style.display = isCharLive ? 'block' : 'none';
        statsOverlay.style.display = isCharLive ? 'block' : 'none';
        actionsOverlay.style.display = isCharLive ? 'flex' : 'none';
        if (isCharLive) {
            titleOverlay.textContent = video.title || 'Live';
            statsOverlay.textContent = video.views || '0';
        }

        const backIcon = playerBackBtn ? playerBackBtn.querySelector('i') : null;
        if (backIcon) {
            backIcon.className = isCharLive ? 'fas fa-xmark' : 'fas fa-chevron-left';
        }
    }

    function openCharAllContentSheet() {
        const sheet = document.getElementById('yt-char-all-content-sheet');
        const list = document.getElementById('yt-char-all-content-list');
        if (!sheet || !list) return;

        list.innerHTML = '';
        
        if (!currentVideoData || !currentVideoData.channelData || !currentVideoData.channelData.liveHistory || currentVideoData.channelData.liveHistory.length === 0) {
            list.innerHTML = '<div style="text-align: center; color: #8e8e93; padding: 20px;">暂无内容</div>';
        } else {
            currentVideoData.channelData.liveHistory.forEach(item => {
                const el = document.createElement('div');
                el.style.backgroundColor = item.type === 'narrative' ? 'transparent' : '#f2f2f2';
                el.style.padding = item.type === 'narrative' ? '4px 12px' : '10px 14px';
                el.style.borderRadius = item.type === 'narrative' ? '0' : '16px';
                el.style.color = item.type === 'narrative' ? '#8e8e93' : '#0f0f0f';
                el.style.fontStyle = item.type === 'narrative' ? 'italic' : 'normal';
                el.style.textAlign = item.type === 'narrative' ? 'center' : 'left';
                el.style.fontSize = item.type === 'narrative' ? '12px' : '14px';
                el.style.lineHeight = '1.4';
                el.style.alignSelf = item.type === 'narrative' ? 'center' : 'flex-start';
                el.style.maxWidth = '85%';
                
                let timeStr = new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                if (item.type !== 'narrative') {
                    // removed the visible time string to make bubbles look more connected
                    el.innerHTML = `<div>${item.text}</div>`;
                } else {
                    el.textContent = item.text;
                }
                list.appendChild(el);
            });
            
            setTimeout(() => {
                list.scrollTop = list.scrollHeight;
            }, 10);
        }
        
        sheet.classList.add('active');
    }

    function openVideoPlayer(video) {
        try {
            if(!playerView) return;
            currentVideoData = video;
            if(!currentVideoData._originalTitle) currentVideoData._originalTitle = video.title;
            const channel = video.channelData;

            if(!channel) return;
            ensureCharLiveChrome(video);

            let displayThumb = video.thumbnail;
            if (!video.isLive && channel.generatedContent && channel.generatedContent.pastVideos) {
                const savedMatch = channel.generatedContent.pastVideos.find(v => v.title === video.title);
                if (savedMatch && savedMatch.thumbnail) displayThumb = savedMatch.thumbnail;
            } else if (video.isLive && channel.generatedContent && channel.generatedContent.currentLive && channel.generatedContent.currentLive.thumbnail) {
                displayThumb = channel.generatedContent.currentLive.thumbnail;
            }
            
            if(ytPlayerThumbnail) ytPlayerThumbnail.src = displayThumb;
            currentVideoData.thumbnail = displayThumb; 

            const titleEl = document.getElementById('yt-player-title');
            if(titleEl) titleEl.textContent = video.title || '无标题';
            
            const viewsEl = document.getElementById('yt-player-views');
            if(viewsEl) viewsEl.textContent = video.views || '0';
            
            const avatarEl = document.getElementById('yt-player-avatar');
            if(avatarEl) {
                avatarEl.src = typeof resolveYtChannelAvatar === 'function'
                    ? resolveYtChannelAvatar(channel)
                    : (channel.avatar || '');
            }
            
            const channelNameEl = document.getElementById('yt-player-channel-name');
            if(channelNameEl) channelNameEl.textContent = channel.name || '未知频道';
            
            const channelSubsEl = document.getElementById('yt-player-channel-subs');
            if(channelSubsEl) channelSubsEl.textContent = channel.subs || '1.2万 订阅者';

            clearCharLiveBubbles();

            const liveBadge = document.getElementById('yt-player-live-badge');
            const chatTitle = document.getElementById('yt-player-chat-title');
            const chatContainer = document.getElementById('yt-player-chat-container');
            const giftBtn = document.getElementById('yt-gift-btn');
            const plusMenu = document.querySelector('.yt-player-menu-container');
            
            if(chatContainer) chatContainer.innerHTML = ''; 

            if (video.isLive) {
                syncPlayerChatInputMode(true);
                if(liveBadge) liveBadge.style.display = 'block';
                if(chatTitle) chatTitle.textContent = '实时聊天';
                if(giftBtn) giftBtn.style.display = 'flex';
                if(plusMenu) plusMenu.style.display = 'flex';
                
                currentChatHistory = [];
                
                let bubblesToPlay = video.initialBubbles;
                window.ytLiveTimeouts = window.ytLiveTimeouts || [];

                if (!bubblesToPlay || !Array.isArray(bubblesToPlay) || bubblesToPlay.length === 0) {
                    bubblesToPlay = ["欢迎来到直播间！", "大家晚上好~"];
                    bubblesToPlay.forEach((bubbleText, index) => {
                        let tId = setTimeout(() => {
                            addCharLiveBubble(bubbleText);
                        }, 500 + (index * 2000));
                        window.ytLiveTimeouts.push(tId);
                    });
                } else {
                    if (bubblesToPlay.length > 0) {
                        // Just display the last bubble instantly to show current state, don't duplicate persist
                        addCharLiveBubble(bubblesToPlay[bubblesToPlay.length - 1], { skipPersist: true });
                    }
                }
                
                if(video.comments && Array.isArray(video.comments) && video.comments.length > 0) {
                    video.comments.forEach(c => {
                        addChatMessage(c.name || '观众', c.text || '', true, c.amount, c.color, true);
                    });
                    
                    if(chatInterval) clearInterval(chatInterval);
                }
            } else {
                syncPlayerChatInputMode(false);
                if(liveBadge) liveBadge.style.display = 'none';
                if(chatTitle) chatTitle.textContent = '评论';
                if(giftBtn) giftBtn.style.display = 'none';
                if(plusMenu) plusMenu.style.display = 'none';
                if(chatInterval) clearInterval(chatInterval);
                
                if(video.comments && Array.isArray(video.comments) && video.comments.length > 0) {
                    video.comments.forEach(c => addChatMessage(c.name || '观众', c.text || '', false, c.amount, c.color, true));
                } else {
                    if(chatContainer) chatContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: #666;" id="yt-empty-comment-msg">暂无评论</div>`;
                }
            }

            playerView.classList.add('active');
        } catch (e) {
            console.error("Error opening video player:", e);
            if(window.showToast) window.showToast('打开视频出错');
        }
    }

    function addChatMessage(name, text, isLive = true, amount = null, color = null, skipPersist = false) {
        const chatContainer = document.getElementById('yt-player-chat-container');
        if(!chatContainer) return;

        const emptyMsg = document.getElementById('yt-empty-comment-msg');
        if(emptyMsg) emptyMsg.remove();

        const row = document.createElement('div');
        if (isLive) row.className = 'yt-live-chat-row-anim';
        
        if (amount) {
            let displayAmount = amount;
            if (typeof amount === 'number' || /^\d+(\.\d+)?$/.test(String(amount))) {
                displayAmount = '￥' + amount;
            }
            row.style.backgroundColor = color || '#8e8e93';
            row.style.padding = '8px 12px';
            row.style.borderRadius = '8px';
            row.style.marginBottom = '4px';
            row.innerHTML = `
                <div style="font-weight: bold; font-size: 13px; color: rgba(255,255,255,0.9); margin-bottom: 4px;">${name} <span style="margin-left: 8px;">${displayAmount}</span></div>
                <div style="font-size: 14px; color: #fff;">${text}</div>
            `;
        } else {
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.alignItems = 'flex-start';
            row.style.marginBottom = '12px'; // slightly more margin for VOD
            
            const grayColors = ['#333333', '#4d4d4d', '#666666', '#808080', '#999999', '#b3b3b3'];
            const randColor = grayColors[Math.floor(Math.random() * grayColors.length)];
            
            row.innerHTML = `
                <div style="width:24px; height:24px; border-radius:50%; background-color:${randColor}; display:flex; justify-content:center; align-items:center; color:#fff; font-size:10px; font-weight:bold; flex-shrink:0;">
                    ${name && name.length > 0 ? name[0].toUpperCase() : '?'}
                </div>
                <div style="font-size:13px; margin-top:2px;">
                    <span class="yt-chat-msg-name" style="font-size:12px; margin-right:4px;">${name}</span>
                    <span class="yt-chat-msg-text">${text}</span>
                </div>
            `;
        }
        
        // append to bottom for both live and VOD as requested (最新评论置底)
        chatContainer.appendChild(row);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Persist comment
        if (currentVideoData && !skipPersist) {
            if (!currentVideoData.comments) currentVideoData.comments = [];
            currentVideoData.comments.push({ name: name, text: text, amount: amount, color: color });
            
            // Update the underlying data structure (use replacement instead of push to avoid reference duplication)
            const channel = currentVideoData.channelData;
            if (channel) {
                if (channel.id === 'user_channel_id' && channelState.activeUserLive) {
                    channelState.activeUserLive.comments = [...currentVideoData.comments];
                } else if (isLive && channel.generatedContent && channel.generatedContent.currentLive) {
                    channel.generatedContent.currentLive.comments = [...currentVideoData.comments];
                } else if (!isLive && channel.generatedContent && channel.generatedContent.pastVideos) {
                    const savedMatch = channel.generatedContent.pastVideos.find(v => v.title === currentVideoData.title);
                    if (savedMatch) {
                        savedMatch.comments = [...currentVideoData.comments];
                    }
                } else if (!isLive && channel.id === 'user_channel_id' && channelState.pastVideos) {
                    const savedMatch = channelState.pastVideos.find(v => v.title === currentVideoData.title);
                    if (savedMatch) {
                        savedMatch.comments = [...currentVideoData.comments];
                    }
                }
                
                // Keep also the global mockVideos up to date
                if (typeof mockVideos !== 'undefined') {
                    const mv = mockVideos.find(v => v.title === currentVideoData.title && v.isLive === isLive);
                    if (mv) {
                        mv.comments = [...currentVideoData.comments];
                    }
                }
                if (typeof saveYoutubeData === 'function') saveYoutubeData();
            }
        }
        
        if(isLive) {
            currentChatHistory.push({
                time: new Date().toLocaleTimeString(),
                name: name || '未知',
                text: text || '',
                amount: amount
            });
            if (currentChatHistory.length > 50) currentChatHistory.shift(); 
        }
    }

    // --- VOD Comment API ---
    async function getVODResponse(userMessage, titleOverride) {
        if (!currentSubChannelData) return null;
        const char = currentSubChannelData;
        
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            return { charReplies: ["（请配置API后体验互动）"], fanReplies: [] };
        }
        
        const effectiveYtUser = getCurrentYtViewer();
        const userPersona = effectiveYtUser.persona || '普通观众';
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

        let promptStr = channelState.vodPrompt || defaultVODPrompt;
        const charPersona = typeof window.getYtChannelPersonaWithRelationships === 'function'
            ? window.getYtChannelPersonaWithRelationships(char)
            : (char.desc || '未知');
        let finalPrompt = promptStr
            .replace(/{char}/g, char.name || '')
            .replace(/{char_persona}/g, charPersona)
            .replace(/{user}/g, effectiveYtUser.name || '我')
            .replace(/{user_persona}/g, userPersona)
            .replace(/{msg}/g, userMessage || '')
            .replace(/{wb_context}/g, wbContext)
            .replace(/{video_title}/g, titleOverride || (currentVideoData ? currentVideoData.title : '未知内容'));

        try {
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
            return sanitizeObj(JSON.parse(resultText));
        } catch (error) {
            console.error('VOD API Error:', error);
            return {
                charReplies: ["（网络似乎断开了...）"],
                fanReplies: []
            };
        }
    }

    function getYtVodReplyText(reply) {
        if (typeof reply === 'string') return reply.trim();
        if (!reply || typeof reply !== 'object') return '';
        return String(reply.text || reply.reply || reply.comment || reply.content || reply.message || '').trim();
    }

    function renderVODResponse(responseObj, isPost = false) {
        if (!responseObj) return;
        
        window.ytLiveTimeouts = window.ytLiveTimeouts || [];
        
        const effectiveYtUser = getCurrentYtViewer();
        const userName = effectiveYtUser.name || '用户';
        
        let replies = [];
        if (responseObj.charReplies && Array.isArray(responseObj.charReplies)) {
            replies = responseObj.charReplies;
        } else if (responseObj.charReply) {
            replies = [responseObj.charReply];
        }

        // Add char replies with prefix
        replies.map(getYtVodReplyText).filter(Boolean).forEach((text, index) => {
            let tId = setTimeout(() => {
                const replyText = `回复 @${userName} : ${text}`;
                if (isPost) {
                    addPostCommentMessage(currentSubChannelData.name, replyText);
                } else {
                    addChatMessage(currentSubChannelData.name, replyText, false); 
                }
            }, 1000 + (index * 1500));
            window.ytLiveTimeouts.push(tId);
        });

        if (responseObj.fanReplies && Array.isArray(responseObj.fanReplies)) {
            responseObj.fanReplies = responseObj.fanReplies
                .map((reply) => {
                    const text = getYtVodReplyText(reply);
                    if (!text) return null;
                    if (reply && typeof reply === 'object') {
                        return {
                            ...reply,
                            name: reply.name || reply.user || reply.nickname,
                            text
                        };
                    }
                    return { text };
                })
                .filter(Boolean);
        }

        // Add fan replies with prefix
        if (responseObj.fanReplies && Array.isArray(responseObj.fanReplies)) {
            responseObj.fanReplies.forEach((c, i) => {
                let tId = setTimeout(() => {
                    const replyText = `回复 @${userName} : ${c.text}`;
                    if (isPost) {
                        addPostCommentMessage(c.name || '观众', replyText);
                    } else {
                        addChatMessage(c.name || '观众', replyText, false);
                    }
                }, 1500 + (replies.length * 1500) + (i * 1500));
                window.ytLiveTimeouts.push(tId);
            });
        }
        
        // Remove loading indicator
        const loadingMsg = document.getElementById('yt-reply-loading');
        if (loadingMsg) loadingMsg.remove();
        
        const postLoadingMsg = document.getElementById('yt-post-reply-loading');
        if (postLoadingMsg) postLoadingMsg.remove();
    }

    // AI API call for interactive response (Live)
    async function getCharResponse(userMessage, isSC = false, amount = 0, isContinue = false) {
        if (!currentVideoData || !currentVideoData.channelData) return null;
        const char = currentVideoData.channelData;
        const guest = currentVideoData.guest;
        
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            return { charBubbles: ["（请配置API后体验互动）"], passerbyComments: [] };
        }
        
        addCharLiveBubble('', { loading: true });
        
        const effectiveYtUser = getCurrentYtViewer();
        const userName = effectiveYtUser.name || '我';
        const userPersona = effectiveYtUser.persona || '普通观众';
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

        // Get last summary for live context
        let lastSummary = '暂无';
        if (channelState.liveSummaries && channelState.liveSummaries.length > 0) {
            const s = channelState.liveSummaries[channelState.liveSummaries.length - 1];
            lastSummary = `主题: ${s.title}, 内容: ${s.content}`;
        }

        let systemPromptStr = channelState.systemPrompt || defaultPrompt;

        let contextClueStr = isContinue 
            ? "注意：现在没有新的观众发言。请你作为主播，根据上下文自主推进直播内容，主动找话题，进行环境描写或动作描写，不要傻等观众，保持直播间的活跃氛围。" 
            : "";
            
        let msgContextStr = userMessage 
            ? `刚刚有一位观众（${userName}）发了一条弹幕说：“${userMessage}”。请主要针对这条留言进行回复。`
            : "";

        const charPersona = typeof window.getYtChannelPersonaWithRelationships === 'function'
            ? window.getYtChannelPersonaWithRelationships(char)
            : (char.desc || '未知');
        const guestPersona = guest && typeof window.getYtChannelPersonaWithRelationships === 'function'
            ? window.getYtChannelPersonaWithRelationships(guest)
            : (guest?.desc || '未知');
        let guestContextStr = guest 
            ? `\n特别注意：本场直播的联动嘉宾是"${guest.name}"，ta的人设："${guestPersona}"。你的回复中可以偶尔cue到嘉宾，或由你代为复述嘉宾说的话。`
            : "";

        let finalPrompt = systemPromptStr
            .replace(/{char}/g, char.name || '')
            .replace(/{char_persona}/g, charPersona)
            .replace(/{user}/g, userName)
            .replace(/{user_persona}/g, userPersona)
            .replace(/{guest}/g, guest ? guest.name : '无嘉宾')
            .replace(/{wb_context}/g, wbContext)
            .replace(/{live_summary_context}/g, lastSummary)
            .replace(/{msg}/g, userMessage || '')
            .replace(/{msg_context}/g, msgContextStr)
            .replace(/{context_clue}/g, contextClueStr + guestContextStr);
            
        if (isSC) {
            finalPrompt += `\n注意：这不仅仅是一条弹幕，而是一条来自“${userName}”价值 ${amount} 元的 Super Chat（醒目留言）！这是非常慷慨的打赏！\n要求：\n1. 你的 charBubbles 必须明确提到“${userName}”的名字，并表现出相应的惊喜和感谢！\n2. 【重要】本次由于已经有观众打赏，**请将 randomSuperChat 设置为 {"hasSuperChat": false}，不要再生成其他人的打赏了**！`;
        }

        try {
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
            return sanitizeObj(JSON.parse(resultText));
        } catch (error) {
            console.error('Interactive Live Error:', error);
            return {
                charBubbles: ["（直播信号有点差...）"],
                passerbyComments: []
            };
        }
    }

    function recordCharContent(text, isNarrative = false) {
        if (!currentVideoData || !currentVideoData.channelData) return;
        if (!currentVideoData.channelData.liveHistory) {
            currentVideoData.channelData.liveHistory = [];
        }
        currentVideoData.channelData.liveHistory.push({
            type: isNarrative ? 'narrative' : 'bubble',
            text: text,
            timestamp: new Date().getTime()
        });
        saveYoutubeData();
    }

    function renderAiResponse(responseObj) {
        if (!responseObj) return;
        removeCharLiveLoadingBubbles();
        
        window.ytLiveTimeouts = window.ytLiveTimeouts || [];

        if (responseObj.narrative) {
            let tId = setTimeout(() => {
                const text = `（${responseObj.narrative}）`;
                addCharLiveBubble(text, { isNarrative: true });
                recordCharContent(text, true);
            }, 500);
            window.ytLiveTimeouts.push(tId);
        }

        if (responseObj.randomSuperChat && responseObj.randomSuperChat.hasSuperChat) {
            let tId = setTimeout(() => {
                addChatMessage(
                    responseObj.randomSuperChat.name || '神秘人', 
                    responseObj.randomSuperChat.text || '', 
                    true, 
                    responseObj.randomSuperChat.displayAmount || responseObj.randomSuperChat.amount || 30, 
                    responseObj.randomSuperChat.color || '#606060'
                );
            }, Math.floor(Math.random() * 2000) + 500);
            window.ytLiveTimeouts.push(tId);
        }

        let bubbles = [];
        if (responseObj.charBubbles && Array.isArray(responseObj.charBubbles)) {
            bubbles = responseObj.charBubbles;
        } else if (responseObj.charResponse) {
            bubbles = [responseObj.charResponse];
        }

        if (bubbles.length > 0) {
            bubbles.forEach((bubbleText, index) => {
                let tId = setTimeout(() => {
                    addCharLiveBubble(bubbleText);
                    recordCharContent(bubbleText, false);
                    // 主播的话不再显示在下方评论区，仅在气泡显示
                }, 1000 + (index * 2500)); 
                window.ytLiveTimeouts.push(tId);
            });
        } else {
            if(ytCharSpeechBubble && ytCharSpeechBubble.children.length === 0) ytCharSpeechBubble.style.display = 'none';
        }

        const commentsArr = responseObj.fanComments || responseObj.passerbyComments;
        if (commentsArr && Array.isArray(commentsArr)) {
            let totalDelay = 2000;
            commentsArr.forEach((c) => {
                totalDelay += Math.floor(Math.random() * 2000) + 500;
                let tId = setTimeout(() => {
                    addChatMessage(c.name || '观众', c.text, true);
                }, totalDelay);
                window.ytLiveTimeouts.push(tId);
            });
        }
    }

    async function generateLiveSummary() {
        if (!currentVideoData || !currentVideoData.channelData) return null;
        const char = currentVideoData.channelData;
        
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            if(window.showToast) window.showToast('请先配置 API 以生成总结');
            return null;
        }

        const effectiveYtUser = getCurrentYtViewer();
        const userPersona = effectiveYtUser.persona || '普通观众';
        
        let historyStr = "";
        if (currentChatHistory.length > 0) {
            historyStr = currentChatHistory.map(item => {
                if(item.amount) return `[${item.time}] ${item.name} 打赏了 ${item.amount}元: ${item.text}`;
                return `[${item.time}] ${item.name}: ${item.text}`;
            }).join('\n');
        } else {
            historyStr = "（暂无详细聊天记录）";
        }

        let promptStr = channelState.summaryPrompt || defaultSummaryPrompt;
        const charPersona = typeof window.getYtChannelPersonaWithRelationships === 'function'
            ? window.getYtChannelPersonaWithRelationships(char)
            : (char.desc || '未知');
        
        if (!promptStr.includes('newSubs')) {
            promptStr += `\n\n请在JSON中额外返回一个 "newSubs" 字段（整数），代表本次直播带来的新增订阅数。`;
        }

        let finalPrompt = promptStr
            .replace(/{char}/g, char.name || '')
            .replace(/{char_persona}/g, charPersona)
            .replace(/{user}/g, userPersona)
            .replace(/{current_time}/g, new Date().toLocaleString())
            .replace(/{chat_history}/g, historyStr);

        try {
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
                    temperature: 0.7,
                    response_format: { type: "json_object" } 
                })
            });

            if (!res.ok) throw new Error(`API Error`);
            const data = await res.json();
            let resultText = data.choices[0].message.content;
            resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            const summaryObj = sanitizeObj(JSON.parse(resultText));
            summaryObj.charName = char.name || '未知';
            
            if(!channelState.liveSummaries) channelState.liveSummaries = [];
            channelState.liveSummaries.push(summaryObj);
            
            // Generate World Book Entry
            if (window.autoSaveSummaryToWorldBook) {
                window.autoSaveSummaryToWorldBook(`${char.name} 直播记录`, summaryObj.content || summaryObj.summary || JSON.stringify(summaryObj));
            }
            
            // Update Char Subs
            if (summaryObj.newSubs && typeof summaryObj.newSubs === 'number') {
                const currentSubsNum = parseSubs(char.subs);
                char.subs = formatSubs(currentSubsNum + summaryObj.newSubs);
                
                const subIndex = mockSubscriptions.findIndex(s => s.id === char.id);
                if (subIndex > -1) {
                    mockSubscriptions[subIndex].subs = char.subs;
                }
                
                if (currentSubChannelData && currentSubChannelData.id === char.id) {
                    const subsEl = document.getElementById('sub-channel-subs');
                    if (subsEl) subsEl.textContent = `${char.subs} 订阅者`;
                }
            }
            
            saveYoutubeData();
            if(window.showToast) window.showToast('直播总结生成完毕并已保存');
            
            if(playerView) playerView.classList.remove('active');
            if(chatInterval) clearInterval(chatInterval);
            clearCharLiveBubbles();

        } catch (error) {
            console.error('Summary Error:', error);
            if(window.showToast) window.showToast('生成总结失败');
        }
    }


    const chatInput = document.getElementById('yt-player-chat-input');
    const chatSend = document.getElementById('yt-player-chat-send');

    function stopPlayerControlEvent(e) {
        if (!e) return;
        e.stopPropagation();
    }

    const ytPlayerChatContainer = document.getElementById('yt-player-chat-container');
    const playerPlusBtn = document.getElementById('yt-player-plus-btn');
    const playerActionMenu = document.getElementById('yt-player-action-menu');
    const actionContinue = document.getElementById('yt-player-action-continue');
    const actionSummary = document.getElementById('yt-player-action-summary');

    [
        ytPlayerVideoArea,
        playerBackBtn,
        ytPlayerChatContainer,
        chatInput,
        chatSend,
        playerPlusBtn,
        document.getElementById('yt-gift-btn')
    ].filter(Boolean).forEach((el) => {
        el.addEventListener('click', stopPlayerControlEvent);
        el.addEventListener('pointerdown', stopPlayerControlEvent);
    });

    if (ytPlayerChatContainer) {
        let isDraggingPlayerChat = false;
        ytPlayerChatContainer.addEventListener('touchstart', () => { isDraggingPlayerChat = false; }, { passive: true });
        ytPlayerChatContainer.addEventListener('touchmove', () => { isDraggingPlayerChat = true; }, { passive: true });
        ytPlayerChatContainer.addEventListener('touchend', () => {
            if (isDraggingPlayerChat) {
                if (chatInput && document.activeElement === chatInput) chatInput.blur();
            }
        });
        ytPlayerChatContainer.addEventListener('click', () => {
            if (chatInput && document.activeElement === chatInput) chatInput.blur();
        });
        const playerBackBtnInner = document.getElementById('yt-player-back-btn');
        if (playerBackBtnInner) {
            playerBackBtnInner.addEventListener('click', () => {
                if (chatInput && document.activeElement === chatInput) chatInput.blur();
            });
        }
    }

    if (chatInput) {
        chatInput.addEventListener('focus', () => {
            if (playerView) playerView.classList.add('keyboard-open');
        });
        chatInput.addEventListener('blur', () => {
            if (playerView) playerView.classList.remove('keyboard-open');
        });
    }

    function syncPlayerChatInputMode(isLive) {
        if (chatInput) {
            chatInput.placeholder = isLive ? '发送消息...' : '发表评论...';
            chatInput.setAttribute('aria-label', isLive ? '发送直播聊天' : '发表评论');
            chatInput.setAttribute('enterkeyhint', 'send');
        }
        if (chatSend) {
            chatSend.title = isLive ? '发送消息' : '发表评论';
        }
    }

    if(chatSend && chatInput) {
        const sendAction = async () => {
            const text = chatInput.value.trim();
            if(!text) return;
            
            const isLive = currentVideoData && currentVideoData.isLive;
            const effectiveYtUser = getCurrentYtViewer();
            addChatMessage(effectiveYtUser.name || '我', text, isLive);
            chatInput.value = '';
            
            if (!currentVideoData) return;
            
            if (isLive) {
                const responseObj = await getCharResponse(text, false);
                renderAiResponse(responseObj);
            } else {
                // Show loading indicator
                const chatContainer = document.getElementById('yt-player-chat-container');
                if(chatContainer) {
                    const loadingId = 'yt-reply-loading';
                    const loadingDiv = document.createElement('div');
                    loadingDiv.id = loadingId;
                    loadingDiv.style.textAlign = 'center';
                    loadingDiv.style.padding = '10px';
                    loadingDiv.style.color = '#8e8e93';
                    loadingDiv.style.fontSize = '12px';
                    loadingDiv.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 回复生成中...';
                    chatContainer.appendChild(loadingDiv);
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
                
                const responseObj = await getVODResponse(text);
                renderVODResponse(responseObj);
            }
        };

        chatSend.addEventListener('click', sendAction);
        
        chatInput.addEventListener('keydown', (e) => {
            if(e.key === 'Enter') {
                e.preventDefault();
                sendAction();
            }
        });
    }

    if(playerPlusBtn && playerActionMenu) {
        playerPlusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playerActionMenu.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!playerPlusBtn.contains(e.target) && !playerActionMenu.contains(e.target)) {
                playerActionMenu.classList.remove('active');
            }
        });
    }

    if(actionContinue) {
        actionContinue.addEventListener('click', async (e) => {
            e.stopPropagation();
            if(playerActionMenu) playerActionMenu.classList.remove('active');
            if(currentVideoData && currentVideoData.isLive) {
                if(window.showToast) window.showToast('正在生成后续直播内容...');
                const responseObj = await getCharResponse('', false, 0, true); 
                renderAiResponse(responseObj);
            } else {
                if(window.showToast) window.showToast('仅在直播时可用');
            }
        });
    }

    if(actionSummary) {
        actionSummary.addEventListener('click', async (e) => {
            e.stopPropagation();
            if(playerActionMenu) playerActionMenu.classList.remove('active');
            if(currentVideoData && currentVideoData.isLive) {
                if(window.showToast) window.showToast('正在生成并保存直播总结...');
                await generateLiveSummary();
            } else {
                if(window.showToast) window.showToast('仅在直播时可用');
            }
        });
    }

    // --- Super Chat Logic ---
    const ytGiftBtn = document.getElementById('yt-gift-btn');
    const ytScSheet = document.getElementById('yt-sc-sheet');
    const scAmountBtns = document.querySelectorAll('.sc-amount-btn');
    const ytScCustomInput = document.getElementById('yt-sc-custom-amount');
    const ytScInput = document.getElementById('yt-sc-input');
    const ytSendScBtn = document.getElementById('yt-send-sc-btn');
    
    let currentScAmount = 30;
    let currentScColor = '#606060';

    if(ytGiftBtn && ytScSheet) {
        ytGiftBtn.addEventListener('click', () => {
            ytScSheet.classList.add('active');
        });

        ytScSheet.addEventListener('mousedown', (e) => {
            if (e.target === ytScSheet) {
                if (ytScCustomInput && document.activeElement === ytScCustomInput) ytScCustomInput.blur();
                if (ytScInput && document.activeElement === ytScInput) ytScInput.blur();
                ytScSheet.classList.remove('active');
            }
        });
    }

    function updateScBtn() {
        if(ytSendScBtn) {
            ytSendScBtn.textContent = `发送 ￥${currentScAmount}`;
            ytSendScBtn.style.backgroundColor = currentScColor;
        }
    }

    scAmountBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            scAmountBtns.forEach(b => {
                b.classList.remove('selected');
                b.style.background = '#f2f2f2';
                b.style.color = '#333';
            });
            btn.classList.add('selected');
            currentScAmount = btn.getAttribute('data-amount');
            // override colors to grayscale
            currentScColor = '#606060';
            
            btn.style.background = currentScColor;
            btn.style.color = 'white';
            if(ytScCustomInput) ytScCustomInput.value = '';
            updateScBtn();
        });
    });

    if(ytScCustomInput) {
        ytScCustomInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val && !isNaN(val)) {
                currentScAmount = val;
                currentScColor = '#3a3a3c'; 
                scAmountBtns.forEach(b => {
                    b.classList.remove('selected');
                    b.style.background = '#f2f2f2';
                    b.style.color = '#333';
                });
                updateScBtn();
            }
        });
        ytScCustomInput.addEventListener('focus', () => {
            if (ytScSheet) ytScSheet.classList.add('keyboard-open');
        });
        ytScCustomInput.addEventListener('blur', () => {
            if (ytScSheet) ytScSheet.classList.remove('keyboard-open');
        });
    }

    if (ytScInput) {
        ytScInput.addEventListener('focus', () => {
            if (ytScSheet) ytScSheet.classList.add('keyboard-open');
        });
        ytScInput.addEventListener('blur', () => {
            if (ytScSheet) ytScSheet.classList.remove('keyboard-open');
        });
    }

    if(ytSendScBtn) {
        ytSendScBtn.addEventListener('click', async () => {
            const text = ytScInput ? ytScInput.value.trim() || '支持主播！' : '支持主播！';
            
            const effectiveYtUser = getCurrentYtViewer();
            addChatMessage(effectiveYtUser.name || '我', text, true, currentScAmount, currentScColor);
            
            if(ytScInput) ytScInput.value = '';
            if(ytScSheet) ytScSheet.classList.remove('active');
            
            if(currentVideoData && currentVideoData.isLive) {
                const responseObj = await getCharResponse(text, true, currentScAmount);
                renderAiResponse(responseObj);
            }
        });
    }

    // --- Content Generation Logic (Append Mode) ---
    const btnGenerate = document.getElementById('yt-char-generate-btn');
    const loadingEl = document.getElementById('sub-channel-loading');

    function setCharGenerateLoading(isLoading) {
        if (!btnGenerate) return;
        btnGenerate.classList.toggle('is-loading', isLoading);
        btnGenerate.setAttribute('aria-disabled', isLoading ? 'true' : 'false');
        btnGenerate.innerHTML = isLoading
            ? '<i class="fas fa-spinner fa-spin"></i>'
            : '<i class="fas fa-search"></i>';
    }

    function renderGeneratedContent(type) {
        try {
            if (!subChannelContent) return;
            if (!currentSubChannelData || !currentSubChannelData.generatedContent) {
                subChannelContent.innerHTML = `<div style="text-align:center; padding: 30px; color:#8e8e93; font-size:14px;">点击右上角魔法棒生成内容</div>`;
                return;
            }

            const data = currentSubChannelData.generatedContent;
            subChannelContent.innerHTML = '';

            if (type === 'live' && data.currentLive) {
                const el = document.createElement('div');
                const thumbUrl = data.currentLive.thumbnail || `https://picsum.photos/seed/${Math.random()}/320/180?grayscale`;
                
                el.innerHTML = `
                    <div class="yt-video-card yt-live-pin-card" style="margin: 16px;">
                        <div class="yt-video-thumbnail">
                            <img src="${thumbUrl}" alt="Live">
                            <div class="yt-live-badge"><i class="fas fa-broadcast-tower" style="font-size: 10px;"></i> LIVE</div>
                        </div>
                        <div class="yt-video-info" style="padding: 12px;">
                            <div class="yt-video-details">
                                <h3 class="yt-video-title">${data.currentLive.title || '无标题'}</h3>
                                <p class="yt-video-meta">${data.currentLive.views || '1.2万 人正在观看'}</p>
                            </div>
                        </div>
                    </div>
                `;
                
                const cardEl = el.querySelector('.yt-video-card');
                if (cardEl) {
                    cardEl.addEventListener('click', () => {
                        const videoObj = {
                            title: data.currentLive.title,
                            views: data.currentLive.views,
                            thumbnail: thumbUrl,
                            isLive: true,
                            channelData: currentSubChannelData,
                            comments: data.currentLive.comments || [],
                            initialBubbles: data.currentLive.initialBubbles || [],
                            guest: data.currentLive.guest || null
                        };
                        openVideoPlayer(videoObj);
                    });
                }
                
                subChannelContent.appendChild(el);
            } else if (type === 'past' && data.pastVideos && data.pastVideos.length > 0) {
                const listWrapper = document.createElement('div');
                listWrapper.className = 'yt-history-list';
                listWrapper.style.padding = '16px';
                
                data.pastVideos.forEach((v, index) => {
                    const item = document.createElement('div');
                    item.className = 'yt-history-item';
                    item.style.position = 'relative';
                    const thumbUrl = v.thumbnail || `https://picsum.photos/seed/${Math.random()}/320/180?grayscale`;
                    item.innerHTML = `
                        <div class="yt-history-thumb">
                            <img src="${thumbUrl}" alt="VOD">
                            <div class="yt-history-time">${Math.floor(Math.random() * 2)+1}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}</div>
                        </div>
                        <div class="yt-history-info">
                            <h3 class="yt-history-title">${v.title || '无标题'}</h3>
                            <p class="yt-history-meta">${v.views || Math.floor(Math.random() * 50) + 1 + '万次观看'} • ${v.time || Math.floor(Math.random() * 11) + 1 + '个月前'}</p>
                        </div>
                        <div class="yt-history-delete-btn" style="position: absolute; right: 10px; top: 10px; background: rgba(0,0,0,0.5); width: 28px; height: 28px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: #fff; cursor: pointer; z-index: 10;">
                            <i class="fas fa-trash-alt" style="font-size: 12px;"></i>
                        </div>
                    `;
                    
                    item.addEventListener('click', (e) => {
                        if (e.target.closest('.yt-history-delete-btn')) {
                            e.stopPropagation();
                            window.showCustomModal({
                                title: '删除视频',
                                message: '确定要删除这个往期视频吗？',
                                confirmText: '删除',
                                cancelText: '取消',
                                isDestructive: true,
                                onConfirm: () => {
                                    data.pastVideos.splice(index, 1);
                                    saveYoutubeData();
                                    renderGeneratedContent('past');
                                    if(window.showToast) window.showToast('视频已删除');
                                }
                            });
                            return;
                        }
                        const videoObj = {
                            title: v.title,
                            views: v.views,
                            thumbnail: item.querySelector('img').src,
                            isLive: false,
                            channelData: currentSubChannelData,
                            comments: v.comments || [],
                            guest: v.guest || null
                        };
                        openVideoPlayer(videoObj);
                    });
                    
                    listWrapper.appendChild(item);
                });
                subChannelContent.appendChild(listWrapper);
            } else if (type === 'community' && data.communityPosts) {
                if (data.fanGroup) {
                    const isJoined = data.fanGroup.isJoined || false;
                    const btnBg = isJoined ? '#e5e5e5' : '#000';
                    const btnColor = isJoined ? '#606060' : '#fff';
                    const btnText = isJoined ? '进入' : '加入';

                    const groupEl = document.createElement('div');
                    groupEl.style.margin = '0 16px 16px';
                    groupEl.style.padding = '12px';
                    groupEl.style.backgroundColor = '#f2f2f2';
                    groupEl.style.borderRadius = '12px';
                    groupEl.style.display = 'flex';
                    groupEl.style.alignItems = 'center';
                    groupEl.style.gap = '10px';
                    groupEl.style.cursor = 'pointer';
                    
                    let groupAvatarHtml = `
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: #f2f2f7; display: flex; justify-content: center; align-items: center; color: #8e8e93; ">
                            <i class="fas fa-users"></i>
                        </div>
                    `;
                    
                    if (data.fanGroup.avatar) {
                        groupAvatarHtml = `
                            <div style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden;  background: transparent;">
                                <img src="${data.fanGroup.avatar}" style="width: 100%; height: 100%; object-fit: cover;">
                            </div>
                        `;
                    }

                    groupEl.innerHTML = `
                        ${groupAvatarHtml}
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 14px;">${data.fanGroup.name || '粉丝群'}</div>
                            <div style="font-size: 12px; color: #606060;">${data.fanGroup.memberCount || '3000人'} • 粉丝专属基地</div>
                        </div>
                        <div class="yt-fan-group-btn" style="background: ${btnBg}; color: ${btnColor}; padding: 6px 12px; border-radius: 16px; font-size: 12px; font-weight: 500; transition: all 0.2s;">${btnText}</div>
                    `;
                    
                    groupEl.addEventListener('click', () => {
                        if (!data.fanGroup.isJoined) {
                            data.fanGroup.isJoined = true;
                            renderGeneratedContent('community'); 
                            saveYoutubeData();
                            if (typeof renderMessagesList === 'function') renderMessagesList();
                            if(window.showToast) window.showToast('已加入粉丝群！');
                        }
                        openFanGroupChat(data.fanGroup);
                    });
                    
                    subChannelContent.appendChild(groupEl);
                }

                if(Array.isArray(data.communityPosts)){
                    data.communityPosts.forEach(post => {
                        const el = document.createElement('div');
                        const avatarUrl = typeof resolveYtChannelAvatar === 'function'
                            ? resolveYtChannelAvatar(currentSubChannelData)
                            : (currentSubChannelData.avatar || '');
                        el.className = 'yt-community-post';
                        el.style.cursor = 'pointer';
                        el.innerHTML = `
                            <div style="display: flex; align-items: center; margin-bottom: 10px; gap: 10px;">
                                <div class="yt-video-avatar" style="width:36px; height:36px;"><img src="${avatarUrl}"></div>
                                <div style="flex:1;">
                                    <div style="font-size:14px; font-weight:500;">${currentSubChannelData.name || '未知'}</div>
                                    <div style="font-size:11px; color:#606060;">${post.time || '刚刚'}</div>
                                </div>
                            </div>
                            <div class="yt-community-post-content">${post.content || ''}</div>
                            <div class="yt-community-post-actions">
                                <div class="yt-community-post-action"><i class="far fa-thumbs-up"></i> ${post.likes || '1.2万'}</div>
                                <div class="yt-community-post-action"><i class="far fa-thumbs-down"></i></div>
                                <div class="yt-community-post-action"><i class="far fa-comment"></i> ${post.commentsCount || post.comments?.length || '856'}</div>
                            </div>
                        `;
                        
                        el.addEventListener('click', () => {
                            openPostDetail(post);
                        });
                        
                        subChannelContent.appendChild(el);
                    });
                }
            } else {
                subChannelContent.innerHTML = `<div style="text-align:center; padding: 30px; color:#8e8e93; font-size:14px;">暂无相关内容</div>`;
            }
        } catch (e) {
            console.error("Error rendering content:", e);
        }
    }

    if (btnGenerate) {
        btnGenerate.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (btnGenerate.classList.contains('is-loading')) return;
            if (!currentSubChannelData) return;
            
            if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
                if(window.showToast) window.showToast('请先在设置中配置大模型 API');
                return;
            }

            if (typeof mergeYtChannelIntoSubscriptions === 'function') {
                currentSubChannelData = mergeYtChannelIntoSubscriptions(currentSubChannelData, { save: true, preferExistingSubscription: true }) || currentSubChannelData;
            }

            setCharGenerateLoading(true);
            if(subChannelContent) subChannelContent.innerHTML = '';
            if (loadingEl) loadingEl.style.display = 'block';
            
            const prompt = `你是一个YouTube内容生成助手。现在有一个YouTuber，她的频道名称是："${currentSubChannelData.name}"，她的人设和简介是："${currentSubChannelData.desc || '未知'}"。
请你根据挂载的世界书，她的设定，生成符合她身份人设风格的内容，具有活人感，返回严格的JSON格式数据。
要求JSON包含以下字段：
1. currentLive: 对象，包含:
   - title(直播标题) 
   - views(观看人数，如"1.5万 人正在观看")
   - initialBubbles: 字符串数组，模拟刚进入直播间时主播正在说的话（3-5句开场白或正在进行的话题）。
   - comments: 数组，包含5-10个对象，每个对象有 name(观众昵称) 和 text(弹幕内容，要符合直播氛围，有网感活人感)。
2. pastVideos: 数组，包含3个对象，每个对象有:
   - title(往期视频标题)
   - views(观看次数，如"45万次观看")
   - time(发布时间，如"2天前")
   - comments: 数组，包含3-5个对象，每个对象有 name(观众昵称) 和 text(评论内容)。
3. communityPosts: 数组，包含1-3个对象，每个对象代表一条YouTube社区动态，有:
   - content(动态正文内容，符合人设，具有活人感，禁止使用emoji)
   - likes(点赞数字符串，如"3.2万")
   - commentsCount(评论数，如"1400")
   - time(发布时间，如"5小时前")
   - comments: 数组，包含3-5个对象，代表这条动态下的热门评论，每个对象有 name(观众昵称) 和 text(评论内容)。
4. fanGroup: 对象，包含 name(粉丝群名称，如"xx的秘密基地") 和 memberCount(群人数，如"3000人")。
注意：只能返回纯 JSON，不要包含 Markdown 符号如 \`\`\`json。`;

            try {
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
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.7,
                        response_format: { type: "json_object" } 
                    })
                });

                if (!res.ok) throw new Error(`API Error: ${res.status}`);
                
                const data = await res.json();
                let resultText = data.choices[0].message.content;
                resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsedData = sanitizeObj(JSON.parse(resultText));

                // --- Append Logic instead of replace ---
                if (!currentSubChannelData.generatedContent) {
                    currentSubChannelData.generatedContent = { pastVideos: [], communityPosts: [] };
                }
                const oldGen = currentSubChannelData.generatedContent;
                
                // If there's an active live, move it to past
                if (oldGen.currentLive) {
                    if (!oldGen.pastVideos) oldGen.pastVideos = [];
                    oldGen.pastVideos.unshift({
                        title: oldGen.currentLive.title,
                        views: oldGen.currentLive.views,
                        time: '刚刚直播结束',
                        thumbnail: oldGen.currentLive.thumbnail,
                        comments: oldGen.currentLive.comments,
                        guest: oldGen.currentLive.guest || null
                    });
                }
                
                if (parsedData.currentLive) {
                    parsedData.currentLive.thumbnail = parsedData.currentLive.thumbnail || `https://picsum.photos/seed/${encodeURIComponent(currentSubChannelData.id + '_live_' + Date.now())}/320/180?grayscale`;
                    parsedData.currentLive.comments = Array.isArray(parsedData.currentLive.comments) ? parsedData.currentLive.comments : [];
                    parsedData.currentLive.initialBubbles = Array.isArray(parsedData.currentLive.initialBubbles) ? parsedData.currentLive.initialBubbles : [];
                }
                oldGen.currentLive = parsedData.currentLive;
                
                if (parsedData.pastVideos) {
                    if (!oldGen.pastVideos) oldGen.pastVideos = [];
                    const normalizedPastVideos = parsedData.pastVideos.map((video, index) => ({
                        ...video,
                        thumbnail: video.thumbnail || `https://picsum.photos/seed/${encodeURIComponent(currentSubChannelData.id + '_past_' + Date.now() + '_' + index)}/320/180?grayscale`,
                        comments: Array.isArray(video.comments) ? video.comments : []
                    }));
                    oldGen.pastVideos = normalizedPastVideos.concat(oldGen.pastVideos);
                }
                
                if (parsedData.communityPosts) {
                    if (!oldGen.communityPosts) oldGen.communityPosts = [];
                    const normalizedCommunityPosts = parsedData.communityPosts.map(post => ({
                        ...post,
                        comments: Array.isArray(post.comments) ? post.comments : []
                    }));
                    oldGen.communityPosts = normalizedCommunityPosts.concat(oldGen.communityPosts);
                }
                
                if (parsedData.fanGroup) {
                    if (oldGen.fanGroup) {
                        parsedData.fanGroup.isJoined = oldGen.fanGroup.isJoined; 
                        // Preserve name if exists
                        if (oldGen.fanGroup.name) {
                            parsedData.fanGroup.name = oldGen.fanGroup.name;
                        }
                    }
                    oldGen.fanGroup = parsedData.fanGroup;
                }
                
                if (typeof mergeYtChannelIntoSubscriptions === 'function') {
                    currentSubChannelData = mergeYtChannelIntoSubscriptions(currentSubChannelData, { save: false, preferExistingSubscription: true }) || currentSubChannelData;
                }
                saveYoutubeData();
                
                if(parsedData.currentLive) {
                    const newLiveVideo = {
                        title: parsedData.currentLive.title,
                        views: parsedData.currentLive.views,
                        time: 'LIVE',
                        thumbnail: parsedData.currentLive.thumbnail || 'https://picsum.photos/seed/' + Math.random() + '/320/180?grayscale',
                        isLive: true,
                        comments: parsedData.currentLive.comments,
                        initialBubbles: parsedData.currentLive.initialBubbles || [], 
                        guest: parsedData.currentLive.guest || null,
                        channelData: currentSubChannelData 
                    };
                    
                    mockVideos = mockVideos.filter(v => v.channelData.id !== currentSubChannelData.id);
                    mockVideos.unshift(newLiveVideo);
                    renderVideos();
                }

                if (loadingEl) loadingEl.style.display = 'none';
                setCharGenerateLoading(false);
                
                const activeTab = document.querySelector('#sub-channel-tabs .yt-sliding-tab.active');
                const target = activeTab ? activeTab.getAttribute('data-target') : 'live';
                renderGeneratedContent(target);

                if(window.showToast) window.showToast('内容生成成功并已保存！');

            } catch (error) {
                console.error(error);
                if (loadingEl) loadingEl.style.display = 'none';
                setCharGenerateLoading(false);
                if(subChannelContent) subChannelContent.innerHTML = `<div style="text-align:center; padding: 30px; color:#ff3b30; font-size:14px;">生成失败，请检查 API 配置或网络</div>`;
            }
        });
    }
