// ==========================================
// IMESSAGE: 4. CHAT INTERFACE & AI
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const { apiConfig, userState, openView, closeView, showToast } = window;
    
    async function commitMainFriendChange(friendOrId, mutator, options = {}) {
        if (!window.imApp.commitFriendChange) return false;
        const targetId = typeof friendOrId === 'object' && friendOrId !== null ? friendOrId.id : friendOrId;

        return window.imApp.commitFriendChange(targetId, (targetFriend) => {
            if (!targetFriend) return;
            if (window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(targetFriend.id)) {
                window.imData.currentActiveFriend = targetFriend;
            }
            return mutator(targetFriend);
        }, options);
    }

    const chatsContent = document.getElementById('chats-content');

    // --- Context Menu Logic ---
    const msgContextOverlay = document.getElementById('msg-context-overlay');
    const msgContextMenu = document.getElementById('msg-context-menu');

    if (chatsContent) {
        let startX, startY;
        
        const startPress = (e) => {
            const row = e.target.closest('.chat-row');
            if (!row) return;
            
            if (window.imData.longPressTimer) clearTimeout(window.imData.longPressTimer);
            
            startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

            window.imData.longPressTimer = setTimeout(() => {
                window.imChat.showContextMenu(row, e);
            }, 500);
        };

        const cancelPress = (e) => {
            if (window.imData.longPressTimer) {
                clearTimeout(window.imData.longPressTimer);
                window.imData.longPressTimer = null;
            }
        };

        const movePress = (e) => {
            if (!window.imData.longPressTimer) return;
            const currentX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
            const currentY = e.type.includes('mouse') ? e.pageY : e.touches[0].clientY;
            if (Math.abs(currentX - startX) > 10 || Math.abs(currentY - startY) > 10) {
                cancelPress();
            }
        };

        chatsContent.addEventListener('touchstart', startPress, {passive: true});
        chatsContent.addEventListener('touchend', cancelPress);
        chatsContent.addEventListener('touchmove', movePress, {passive: true});
        chatsContent.addEventListener('mousedown', startPress);
        chatsContent.addEventListener('mouseup', cancelPress);
        chatsContent.addEventListener('mousemove', movePress);
        chatsContent.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.chat-row')) {
                e.preventDefault();
            }
        });

        chatsContent.addEventListener('click', async (e) => {
            const selection = window.getSelection();
            if (selection && selection.toString().trim().length > 0) return;

            const bubble = e.target.closest('.chat-bubble');
            if (bubble) {
                if (bubble.querySelector('.chat-image-bubble-img')) return;
                if (bubble.classList.contains('pay-transfer-bubble')) return;
                if (bubble.classList.contains('group-red-packet-bubble')) return;
                if (bubble.classList.contains('moment-forward-bubble')) return;
                if (bubble.classList.contains('voice-message-bubble')) return;
                if (bubble.classList.contains('sticker-bubble')) return;
                if (bubble.classList.contains('voice-call-record-bubble')) return;

                const row = bubble.closest('.chat-row');
                if (!row) return;

                const ts = row.getAttribute('data-timestamp');
                if (ts && window.imData.currentActiveFriend) {
                    const friendId = window.imData.currentActiveFriend.id;
                    const liveFriend = (window.imData.friends || []).find(f => String(f.id) === String(friendId)) || window.imData.currentActiveFriend;
                    const msg = (liveFriend.messages || []).find(m => String(m.timestamp) === String(ts));
                    
                    if (msg && msg.translation) {
                        const nextShowTranslation = !msg.showTranslation;
                        const translationHtml = msg.translation;

                        const saved = window.imApp.updateFriendMessage
                            ? await window.imApp.updateFriendMessage(friendId, {
                                id: msg.id || null,
                                timestamp: ts || null
                            }, (targetMsg) => {
                                if (!targetMsg) return;
                                targetMsg.showTranslation = nextShowTranslation;
                            }, { silent: true })
                            : await commitMainFriendChange(liveFriend, (targetFriend) => {
                                if (!Array.isArray(targetFriend.messages)) return;
                                const targetMsg = targetFriend.messages.find(m => String(m.timestamp) === String(ts));
                                if (!targetMsg) return;
                                targetMsg.showTranslation = nextShowTranslation;
                            }, { silent: true });

                        if (saved) {
                            const existingTranslationNode = bubble.querySelector('.msg-translation');
                            if (nextShowTranslation) {
                                if (!existingTranslationNode) {
                                    const metaNode = bubble.querySelector('.bubble-meta');
                                    const transNode = document.createElement('div');
                                    transNode.className = 'msg-translation';
                                    
                                    if (row.classList.contains('user-row')) {
                                        transNode.style.cssText = 'margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.4; word-wrap: break-word; white-space: normal;';
                                    } else {
                                        transNode.style.cssText = 'margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(0,0,0,0.1); font-size: 13px; color: #8e8e93; line-height: 1.4; word-wrap: break-word; white-space: normal;';
                                    }
                                    transNode.innerHTML = translationHtml;
                                    
                                    if (metaNode) {
                                        bubble.insertBefore(transNode, metaNode);
                                    } else {
                                        bubble.appendChild(transNode);
                                    }
                                }
                            } else {
                                if (existingTranslationNode) {
                                    existingTranslationNode.remove();
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    if (msgContextOverlay) {
        msgContextOverlay.addEventListener('click', (e) => {
            if (e.target === msgContextOverlay) window.imChat.closeContextMenu();
        });
    }

    // Use event delegation for menu items (since HTML structure changed)
    if (msgContextMenu) {
        msgContextMenu.addEventListener('click', async (e) => {
            const menuItem = e.target.closest('.msg-menu-item');
            if (menuItem) {
                const action = menuItem.getAttribute('data-action');
                
                if (action === 'reply') {
                    if (window.imData.currentActiveRow) {
                        const bubble = window.imData.currentActiveRow.querySelector('.chat-bubble');
                        if (bubble) {
                            const clone = bubble.cloneNode(true);
                            const meta = clone.querySelector('.bubble-meta');
                            if(meta) meta.remove();
                            const quote = clone.querySelector('.msg-reply-quote');
                            if(quote) quote.remove();
                            const reaction = clone.querySelector('.bubble-reaction-icon');
                            if(reaction) reaction.remove();

                            const text = clone.innerText || clone.textContent;
                            
                            window.imData.currentReplyText = text.trim();
                            
                            const page = document.querySelector('.active-chat-interface[style*="display: flex"]');
                            if (page) {
                                const previewContainer = page.querySelector('.reply-preview-container');
                                const previewText = page.querySelector('.reply-preview-text');
                                const input = page.querySelector('.chat-input');
                                
                                if (previewContainer && previewText) {
                                    previewText.textContent = text.trim();
                                    previewContainer.style.display = 'block';
                                }
                                if (input) {
                                    input.focus();
                                }
                            }
                        }
                    }
                    window.imChat.closeContextMenu();
                    return;
                }

                if (action === 'select') {
                    if (window.imData.currentActiveRow) {
                        const row = window.imData.currentActiveRow;
                        const ts = row.getAttribute('data-timestamp');
                        
                        window.imData.batchSelectMode = true;
                        
                        const page = document.querySelector('.active-chat-interface[style*="display: flex"]');
                        if (page) {
                            const cancelBatchBtn = page.querySelector('.chat-cancel-batch-btn');
                            const topMenuBtn = page.querySelector('.chat-menu-btn');
                            const topCallBtn = page.querySelector('.chat-call-btn');
                            const batchActionBar = page.querySelector('.chat-batch-action-bar');
                            const inputWrapper = page.querySelector('.ins-chat-input-wrapper');
                            
                            if (cancelBatchBtn) cancelBatchBtn.style.display = 'block';
                            if (topMenuBtn) topMenuBtn.style.display = 'none';
                            if (topCallBtn) topCallBtn.style.display = 'none';
                            if (batchActionBar) batchActionBar.style.display = 'flex';
                            if (inputWrapper) inputWrapper.style.display = 'none';
                            
                            const checkboxes = page.querySelectorAll('.chat-checkbox-wrapper');
                            checkboxes.forEach(cb => {
                                cb.style.display = 'flex';
                                const icon = cb.querySelector('i');
                                if (icon && ts && icon.getAttribute('data-timestamp') === ts) {
                                    icon.className = 'fas fa-check-circle chat-checkbox';
                                    icon.style.color = '#007aff';
                                }
                            });
                        }
                    }
                    window.imChat.closeContextMenu();
                    return;
                }

                if (action === 'more') {
                    // Toggle more actions visibility
                    const moreActions = document.getElementById('msg-context-more-actions');
                    const mainActions = document.getElementById('msg-context-actions');
                    if (moreActions && mainActions) {
                        mainActions.style.display = 'none';
                        moreActions.style.display = 'flex';
                    }
                    return;
                }
                
                if (action === 'delete') {
                    if (window.imData.currentActiveRow && window.imData.currentActiveFriend) {
                        const row = window.imData.currentActiveRow;
                        const ts = row.getAttribute('data-timestamp');
                        const messageId = row.getAttribute('data-message-id');

                        const saved = window.imApp.removeFriendMessages
                            ? await window.imApp.removeFriendMessages(window.imData.currentActiveFriend.id, {
                                id: messageId || null,
                                timestamp: ts || null
                            }, { silent: true })
                            : await commitMainFriendChange(window.imData.currentActiveFriend, (targetFriend) => {
                                if (!Array.isArray(targetFriend.messages)) return;
                                targetFriend.messages = targetFriend.messages.filter((m) => {
                                    if (!m) return false;
                                    if (messageId && String(m.id) === String(messageId)) return false;
                                    if (ts && String(m.timestamp) === String(ts)) return false;
                                    return true;
                                });
                            }, { silent: true });

                        if (!saved) {
                            if (window.showToast) window.showToast('删除消息失败');
                            window.imChat.closeContextMenu();
                            return;
                        }

                        const latestFriend = window.imApp.getFriendById
                            ? (window.imApp.getFriendById(window.imData.currentActiveFriend.id) || window.imData.currentActiveFriend)
                            : window.imData.currentActiveFriend;
                        const container = row.closest('.ins-chat-messages');
                        if (container) {
                            const removed = window.imChat.removeMessageFromContainer
                                ? window.imChat.removeMessageFromContainer(container, {
                                    id: messageId || null,
                                    timestamp: ts || null
                                }, { scroll: true })
                                : false;

                            if (!removed && window.imChat.rerenderChatContainer) {
                                window.imChat.rerenderChatContainer(latestFriend, container, { scroll: true });
                            }
                        }
                        if(window.showToast) window.showToast('已删除该消息');
                    }
                } else if (action === 'copy') {
                    // Copy bubble text
                    if (window.imData.currentActiveRow) {
                        const bubble = window.imData.currentActiveRow.querySelector('.chat-bubble');
                        if (bubble) {
                            const text = bubble.innerText || bubble.textContent;
                            navigator.clipboard.writeText(text).then(() => {
                                if(window.showToast) window.showToast('已复制');
                            }).catch(() => {
                                if(window.showToast) window.showToast('已复制');
                            });
                        }
                    }
                } else if (action === 'speak') {
                    if (window.imData.currentActiveRow && window.imData.currentActiveFriend) {
                        const row = window.imData.currentActiveRow;
                        const ts = row.getAttribute('data-timestamp');
                        const messageId = row.getAttribute('data-message-id');
                        const friendId = window.imData.currentActiveFriend.id;
                        const liveFriend = (window.imData.friends || []).find(f => String(f.id) === String(friendId)) || window.imData.currentActiveFriend;
                        const msg = (liveFriend.messages || []).find(m => {
                            if (!m) return false;
                            if (messageId && String(m.id) === String(messageId)) return true;
                            return ts && String(m.timestamp) === String(ts);
                        });
                        const bubble = row.querySelector('.chat-bubble');
                        let text = msg && (msg.content || msg.text || msg.description || '');
                        if (!text && bubble) {
                            const clone = bubble.cloneNode(true);
                            clone.querySelectorAll('.bubble-meta, .msg-translation, .msg-reply-quote, .bubble-reaction-icon').forEach(node => node.remove());
                            text = clone.innerText || clone.textContent || '';
                        }

                        try {
                            if (!window.u2MinimaxTts || typeof window.u2MinimaxTts.speakTextCached !== 'function') {
                                throw new Error('Minimax TTS 未初始化');
                            }
                            const cacheOwner = msg && typeof msg === 'object' ? msg : {};
                            const audioUrl = await window.u2MinimaxTts.speakTextCached(text, liveFriend, cacheOwner);
                            if (audioUrl && msg && typeof msg === 'object' && !msg.minimaxAudioUrl && window.imApp?.updateFriendMessage) {
                                await window.imApp.updateFriendMessage(friendId, {
                                    id: msg.id || messageId || null,
                                    timestamp: ts || null
                                }, (targetMsg) => {
                                    if (targetMsg) targetMsg.minimaxAudioUrl = audioUrl;
                                }, { silent: true });
                            }
                        } catch (error) {
                            console.error('Minimax speech failed', error);
                            if (window.showToast) window.showToast('语音播放失败');
                        }
                    }
                } else if (action === 'translate') {
                    if (window.imData.currentActiveRow) {
                        const row = window.imData.currentActiveRow;
                        const ts = row.getAttribute('data-timestamp');
                        if (ts && window.imData.currentActiveFriend) {
                            const friendId = window.imData.currentActiveFriend.id;
                            const liveFriend = (window.imData.friends || []).find(f => String(f.id) === String(friendId)) || window.imData.currentActiveFriend;
                            const msg = (liveFriend.messages || []).find(m => String(m.timestamp) === String(ts));
                            if (msg) {
                                if (msg.translation) {
                                    const nextShowTranslation = !msg.showTranslation;
                                    const translationHtml = msg.translation;

                                    const saved = window.imApp.updateFriendMessage
                                        ? await window.imApp.updateFriendMessage(friendId, {
                                            id: msg.id || null,
                                            timestamp: ts || null
                                        }, (targetMsg) => {
                                            if (!targetMsg) return;
                                            targetMsg.showTranslation = nextShowTranslation;
                                        }, { silent: true })
                                        : await commitMainFriendChange(liveFriend, (targetFriend) => {
                                            if (!Array.isArray(targetFriend.messages)) return;
                                            const targetMsg = targetFriend.messages.find(m => String(m.timestamp) === String(ts));
                                            if (!targetMsg) return;
                                            targetMsg.showTranslation = nextShowTranslation;
                                        }, { silent: true });

                                    if (!saved) {
                                        if (window.showToast) window.showToast('翻译状态保存失败');
                                        window.imChat.closeContextMenu();
                                        return;
                                    }
                                    
                                    // In-place DOM update instead of full clear and re-render
                                    const bubbleInner = row.querySelector('.chat-bubble');
                                    if (bubbleInner) {
                                        // Find existing translation element
                                        const existingTranslationNode = bubbleInner.querySelector('.msg-translation');
                                        
                                        if (nextShowTranslation) {
                                            // If it should show but doesn't exist, create it
                                            if (!existingTranslationNode) {
                                                const metaNode = bubbleInner.querySelector('.bubble-meta');
                                                const transNode = document.createElement('div');
                                                transNode.className = 'msg-translation';
                                                
                                                if (row.classList.contains('user-row')) {
                                                    transNode.style.cssText = 'margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.4; word-wrap: break-word; white-space: normal;';
                                                } else {
                                                    transNode.style.cssText = 'margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(0,0,0,0.1); font-size: 13px; color: #8e8e93; line-height: 1.4; word-wrap: break-word; white-space: normal;';
                                                }
                                                transNode.innerHTML = translationHtml;
                                                
                                                if (metaNode) {
                                                    bubbleInner.insertBefore(transNode, metaNode);
                                                } else {
                                                    bubbleInner.appendChild(transNode);
                                                }
                                            }
                                        } else {
                                            // If it should hide and exists, remove it
                                            if (existingTranslationNode) {
                                                existingTranslationNode.remove();
                                            }
                                        }
                                    }
                                } else {
                                    if (window.showToast) window.showToast('该消息无需翻译或暂无翻译');
                                }
                            }
                        }
                    }
                    window.imChat.closeContextMenu();
                    return;
                } else if (action === 'edit') {
                    if (window.imData.currentActiveRow) {
                        const row = window.imData.currentActiveRow;
                        const ts = row.getAttribute('data-timestamp');
                        if (ts && window.imData.currentActiveFriend) {
                            const friendId = window.imData.currentActiveFriend.id;
                            const liveFriend = (window.imData.friends || []).find(f => String(f.id) === String(friendId)) || window.imData.currentActiveFriend;
                            const msg = (liveFriend.messages || []).find(m => String(m.timestamp) === String(ts));
                            if (msg) {
                                if (window.showCustomModal) {
                                    window.showCustomModal({
                                        type: 'prompt',
                                        title: '编辑消息',
                                        placeholder: '修改内容...',
                                        confirmText: '保存',
                                        onConfirm: async (newVal) => {
                                            const textarea = document.getElementById('modal-textarea');
                                            const textareaGroup = document.getElementById('modal-textarea-group');
                                            let finalVal = newVal;
                                            
                                            if (textarea && textareaGroup && textareaGroup.style.display !== 'none') {
                                                finalVal = textarea.value;
                                            }
                                            
                                            if (finalVal !== null && finalVal.trim() !== '') {
                                                const nextContent = finalVal.trim();
                                                const saved = window.imApp.updateFriendMessage
                                                    ? await window.imApp.updateFriendMessage(friendId, {
                                                        id: msg.id || null,
                                                        timestamp: ts || null
                                                    }, (targetMsg) => {
                                                        if (!targetMsg) return;
                                                        targetMsg.content = nextContent;
                                                    }, { silent: true })
                                                    : await commitMainFriendChange(liveFriend, (targetFriend) => {
                                                        if (!Array.isArray(targetFriend.messages)) return;
                                                        const targetMsg = targetFriend.messages.find(m => String(m.timestamp) === String(ts));
                                                        if (!targetMsg) return;
                                                        targetMsg.content = nextContent;
                                                    }, { silent: true });

                                                if (!saved) {
                                                    if (window.showToast) window.showToast('消息保存失败');
                                                    return;
                                                }
                                                
                                                const container = row.closest('.ins-chat-messages');
                                                if (container && window.imChat.rerenderChatContainer) {
                                                    const updatedFriend = (window.imData.friends || []).find(f => String(f.id) === String(friendId)) || liveFriend;
                                                    window.imChat.rerenderChatContainer(updatedFriend, container, { scroll: true });
                                                }
                                            }
                                        }
                                    });
                                    
                                    setTimeout(() => {
                                        const inputGroup = document.getElementById('modal-input-group');
                                        const textareaGroup = document.getElementById('modal-textarea-group');
                                        const textarea = document.getElementById('modal-textarea');
                                        
                                        if (inputGroup && textareaGroup && textarea) {
                                            inputGroup.style.display = 'none';
                                            textareaGroup.style.display = 'block';
                                            textarea.value = msg.content;
                                        }
                                    }, 10);
                                }
                            }
                        }
                    }
                    window.imChat.closeContextMenu();
                    return;
                } else {
                    if(window.showToast) window.showToast(action + ' 功能未实现');
                }
                window.imChat.closeContextMenu();
                return;
            }
            
            const reaction = e.target.closest('.msg-reaction');
            if (reaction) {
                const htmlContent = reaction.innerHTML;
                
                if (window.imData.currentActiveRow) {
                    const bubble = window.imData.currentActiveRow.querySelector('.chat-bubble');
                    if (bubble) {
                        // Remove any existing reaction
                        const existingReaction = bubble.querySelector('.bubble-reaction-icon');
                        if (existingReaction) {
                            existingReaction.remove();
                        }
                        
                        // Create new reaction badge
                        const reactionBadge = document.createElement('div');
                        reactionBadge.className = 'bubble-reaction-icon';
                        reactionBadge.innerHTML = htmlContent;
                        
                        // Set inline styles for the badge to match iOS iMessage look
                        reactionBadge.style.position = 'absolute';
                        reactionBadge.style.bottom = '-8px';
                        reactionBadge.style.left = '-8px';
                        reactionBadge.style.width = '24px';
                        reactionBadge.style.height = '24px';
                        reactionBadge.style.backgroundColor = '#f2f2f7';
                        reactionBadge.style.border = '2px solid #ffffff';
                        reactionBadge.style.borderRadius = '50%';
                        reactionBadge.style.display = 'flex';
                        reactionBadge.style.justifyContent = 'center';
                        reactionBadge.style.alignItems = 'center';
                        reactionBadge.style.fontSize = '12px';
                        reactionBadge.style.color = '#8e8e93';
                        reactionBadge.style.zIndex = '10';
                        reactionBadge.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                        
                        // Ensure bubble is positioned relative to anchor the absolute badge
                        bubble.style.position = 'relative';
                        
                        // If it's a user bubble (right side), adjust position to bottom right
                        if (window.imData.currentActiveRow.classList.contains('user-row')) {
                            reactionBadge.style.left = 'auto';
                            reactionBadge.style.right = '-8px';
                        }
                        
                        // Specific tweak for the HAHA text to fit in the small circle
                        if (reactionBadge.textContent.includes('HA')) {
                            reactionBadge.style.fontSize = '8px';
                            reactionBadge.style.fontWeight = '900';
                            reactionBadge.style.lineHeight = '0.9';
                            reactionBadge.style.letterSpacing = '-0.5px';
                            reactionBadge.style.fontFamily = 'sans-serif';
                        }
                        
                        bubble.appendChild(reactionBadge);
                    }
                }
                
                window.imChat.closeContextMenu();
                return;
            }
        });
    }


    // Expose Functions
    window.imApp.updateChatsView = window.imChat.updateChatsView;
    window.imApp.renderChatsList = window.imChat.renderChatsList;
    window.imApp.openChatTab = window.imChat.openChatTab;
    window.imApp.scrollToBottom = window.imChat.scrollToBottom;
    window.imApp.renderTimestamp = window.imChat.renderTimestamp;
    window.imApp.renderMomentForwardBubble = window.imChat.renderMomentForwardBubble;
    window.imApp.renderImageBubble = window.imChat.renderImageBubble;
    window.imApp.renderPayTransferBubble = window.imChat.renderPayTransferBubble;
    window.imApp.openAttachmentSheet = window.imChat.openAttachmentSheet;
    window.imApp.showBannerNotification = window.showBannerNotification;
});
