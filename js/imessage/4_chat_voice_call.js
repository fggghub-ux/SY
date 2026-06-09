// ==========================================
// IMESSAGE: 4_chat_voice_call.js
// ==========================================
(function() {
    window.imChat = window.imChat || {};

    let callTimer = null;
    let callSeconds = 0;
    let callFriend = null;
    let callMessages = [];
    let callMessageSeq = 0;
    let lastCallAiTurn = null;

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    let minTimeEl = null;

    function startTimer(statusEl, minEl) {
        callSeconds = 0;
        if(statusEl) statusEl.innerText = '00:00';
        if(minEl) minEl.innerText = '00:00';
        callTimer = setInterval(() => {
            callSeconds++;
            const t = formatTime(callSeconds);
            if(statusEl) statusEl.innerText = t;
            if(minEl) minEl.innerText = t;
            if(minTimeEl) minTimeEl.innerText = t;
        }, 1000);
    }

    function stopTimer() {
        if (callTimer) {
            clearInterval(callTimer);
            callTimer = null;
        }
    }

    function getCallSpeakerName(message, friend = callFriend) {
        if (!message || !message.isSelf) {
            return friend?.nickname || friend?.realName || 'Char';
        }
        return window.userState?.name || window.userState?.realName || 'User';
    }

    function formatCallLineText(text) {
        const cleanText = String(text || '').trim();
        return cleanText ? `「${cleanText}」` : '';
    }

    function createCallNovelLine(text, options = {}) {
        const row = document.createElement('div');
        if (options.callTurnId) row.dataset.callTurnId = options.callTurnId;
        if (options.callLineType) row.dataset.callLineType = options.callLineType;
        row.style.width = '100%';
        row.style.display = 'flex';
        row.style.alignItems = 'flex-start';
        row.style.justifyContent = 'flex-start';
        row.style.gap = '8px';
        row.style.marginBottom = '10px';
        row.style.padding = '0 10px';
        row.style.boxSizing = 'border-box';
        row.style.fontSize = options.fontSize || '15px';
        row.style.lineHeight = '1.55';
        row.style.color = options.color || '#fff';
        row.style.textAlign = 'left';
        row.style.wordBreak = 'break-word';

        const textEl = document.createElement('div');
        textEl.style.minWidth = '0';
        textEl.style.maxWidth = options.voiceButton ? 'calc(100% - 42px)' : '100%';
        textEl.style.whiteSpace = 'pre-wrap';
        
        if (options.speakerName) {
            const nameTag = document.createElement('span');
            nameTag.style.display = 'inline-block';
            nameTag.style.padding = '1px 6px';
            nameTag.style.borderRadius = '8px';
            nameTag.style.marginRight = '6px';
            nameTag.style.fontSize = '12px';
            nameTag.style.fontWeight = '500';
            nameTag.style.verticalAlign = 'baseline';
            
            if (options.isSelf) {
                nameTag.style.background = 'rgba(255, 255, 255, 0.15)';
                nameTag.style.color = '#fff';
            } else {
                nameTag.style.background = 'rgba(255, 255, 255, 0.15)';
                nameTag.style.color = '#fff';
            }
            nameTag.innerText = `@${options.speakerName}`;
            
            textEl.appendChild(nameTag);
            textEl.appendChild(document.createTextNode(text));
        } else {
            textEl.innerText = text;
        }

        row.appendChild(textEl);

        if (options.voiceButton) row.appendChild(options.voiceButton);
        return row;
    }

    function createCallVoiceButton(text, message, friend = callFriend) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = '播放语音';
        btn.setAttribute('aria-label', '播放语音');
        btn.style.width = '30px';
        btn.style.height = '30px';
        btn.style.border = '1px solid rgba(255,255,255,0.35)';
        btn.style.borderRadius = '50%';
        btn.style.background = 'rgba(255,255,255,0.14)';
        btn.style.color = '#fff';
        btn.style.display = 'inline-flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.cursor = 'pointer';
        btn.style.flexShrink = '0';
        btn.style.padding = '0';
        btn.innerHTML = '<i class="fas fa-volume-up" style="font-size: 12px;"></i>';

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!window.u2MinimaxTts || typeof window.u2MinimaxTts.speakTextCached !== 'function') {
                if (window.showToast) window.showToast('Minimax 语音不可用');
                return;
            }

            btn.style.opacity = '0.55';
            btn.style.pointerEvents = 'none';
            try {
                await window.u2MinimaxTts.speakTextCached(text, friend, message);
            } catch (error) {
                console.error('Call voice playback failed', error);
                if (window.showToast) window.showToast('语音播放失败');
            } finally {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }
        });

        return btn;
    }

    function addCallBubble(text, isSelf, messagesArea, actionText = '', thoughtText = '') {
        const turnId = `call-msg-${Date.now()}-${++callMessageSeq}`;
        const message = {
            text: text,
            actionText: actionText,
            thoughtText: thoughtText,
            isSelf: isSelf,
            timestamp: Date.now(),
            callTurnId: turnId
        };
        callMessages.push(message);

        if (actionText && messagesArea) {
            messagesArea.appendChild(createCallNovelLine(actionText, {
                callTurnId: turnId,
                callLineType: 'action'
            }));
        }

        if (thoughtText && messagesArea) {
            messagesArea.appendChild(createCallNovelLine(thoughtText, {
                callTurnId: turnId,
                callLineType: 'thought',
                color: 'rgba(255,255,255,0.55)',
                fontSize: '13px'
            }));
        }

        if (text && messagesArea) {
            const speakerName = getCallSpeakerName(message);
            messagesArea.appendChild(createCallNovelLine(formatCallLineText(text), {
                voiceButton: isSelf ? null : createCallVoiceButton(text, message),
                callTurnId: turnId,
                callLineType: 'text',
                speakerName: speakerName,
                isSelf: isSelf
            }));
        }

        if (messagesArea) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }

        return message;
    }

    window.imChat.openVoiceCall = function(friend, isIncoming = false) {
        const view = document.getElementById('voice-call-view');
        
        if (!view) return;

        // Clean up old listeners by cloning
        const newView = view.cloneNode(true);
        view.parentNode.replaceChild(newView, view);

        const newMinimizeBtn = newView.querySelector('#voice-call-minimize-btn');
        const newAvatarImg = newView.querySelector('#voice-call-avatar');
        const newAvatarIcon = newView.querySelector('#voice-call-avatar-icon');
        const newNameEl = newView.querySelector('#voice-call-name');
        const newStatusEl = newView.querySelector('#voice-call-status');
        const newMessagesArea = newView.querySelector('#voice-call-messages');
        
        const newInputRow = newView.querySelector('#voice-call-input-row');
        const newActionsRow = newView.querySelector('#voice-call-actions-row');
        const newInput = newView.querySelector('#voice-call-input');
        const newSendBtn = newView.querySelector('#voice-call-send-btn');
        const newAiBtn = newView.querySelector('#voice-call-ai-btn');
        const newHangupBtn = newView.querySelector('#voice-call-hangup-btn');
        const newRegenerateBtn = newView.querySelector('#voice-call-regenerate-btn');
        const newAcceptBtn = newView.querySelector('#voice-call-accept-btn');
        
        const minimizedFloat = newView.querySelector('#voice-call-minimized-float');
        const mainContent = newView.querySelector('#voice-call-main-content');
        const bgEl = newView.querySelector('#voice-call-bg');
        const infoArea = newView.querySelector('#voice-call-info-area');
        minTimeEl = newView.querySelector('#voice-call-minimized-time');

        callFriend = friend;
        callMessages = [];
        callMessageSeq = 0;
        lastCallAiTurn = null;
        if(newMessagesArea) newMessagesArea.innerHTML = '';
        if(newInput) newInput.value = '';

        if (friend.avatarUrl) {
            if(newAvatarImg) {
                newAvatarImg.src = friend.avatarUrl;
                newAvatarImg.style.display = 'block';
            }
            if(newAvatarIcon) newAvatarIcon.style.display = 'none';
        } else {
            if(newAvatarImg) {
                newAvatarImg.src = '';
                newAvatarImg.style.display = 'none';
            }
            if(newAvatarIcon) newAvatarIcon.style.display = 'block';
        }

        if(newNameEl) newNameEl.innerText = friend.nickname || '对方';
        
        newView.style.display = 'flex';
        newView.style.opacity = '1';
        newView.style.pointerEvents = 'auto';
        newView.classList.add('active');
        
        if (minimizedFloat && mainContent) {
            minimizedFloat.style.display = 'none';
            mainContent.style.display = 'flex';
            mainContent.style.opacity = '1';
            mainContent.style.pointerEvents = 'auto';
            if(bgEl) bgEl.style.opacity = '1';
        }
        
        if (infoArea) {
            infoArea.style.transform = 'scale(1)';
        }

        if (window.openView) window.openView(newView);

        // State control
        let isConnected = false;
        let dialTimeout = null;

        if (isIncoming) {
            newStatusEl.innerText = '正在邀请你进行语音通话...';
            newInputRow.style.display = 'none';
            newAcceptBtn.style.display = 'flex';
        } else {
            newStatusEl.innerText = '正在呼叫...';
            newInputRow.style.display = 'none';
            newAcceptBtn.style.display = 'none';
            
            // Auto connect after 2 seconds for outgoing call
            dialTimeout = setTimeout(() => {
                connectCall();
            }, 2000);
        }

        function connectCall() {
            isConnected = true;
            newInputRow.style.display = 'flex';
            newAcceptBtn.style.display = 'none';
            newStatusEl.innerText = '00:00';
            if (infoArea) {
                infoArea.style.transform = 'scale(0.8)';
            }
            startTimer(newStatusEl, minTimeEl);
        }

        if (newAcceptBtn) {
            newAcceptBtn.addEventListener('click', connectCall);
        }

        function closeCall() {
            if (dialTimeout) clearTimeout(dialTimeout);
            
            // Capture final duration BEFORE doing anything else
            const finalDuration = isConnected ? callSeconds : 0;
            const finalMessages = [...callMessages];
            const finalStatusText = isConnected ? '通话记录' : (isIncoming ? '已拒绝' : '已取消');
            const targetFriend = callFriend;

            stopTimer();
            minTimeEl = null;
            newView.style.display = 'none';
            newView.style.opacity = '0';
            newView.style.pointerEvents = 'none';
            newView.classList.remove('active');
            if (window.closeView) window.closeView(newView);
            
            if (targetFriend) {
                // Save call record
                const isSelfRecord = !isIncoming;
                const recordMsg = {
                    id: Date.now().toString(),
                    type: 'voice_call_record',
                    role: isSelfRecord ? 'user' : 'assistant',
                    content: '[语音通话记录]',
                    senderId: isSelfRecord ? (window.imData.currentUser ? window.imData.currentUser.id : 'me') : targetFriend.id,
                    timestamp: Date.now(),
                    duration: finalDuration,
                    callMessages: finalMessages,
                    isSelf: isSelfRecord,
                    statusText: finalStatusText
                };

                if (window.imApp && window.imApp.appendFriendMessage) {
                    window.imApp.appendFriendMessage(targetFriend.id, recordMsg);
                    
                    // Appended in real-time UI without re-rendering whole list
                    const pageId = `chat-interface-${callFriend.id}`;
                    const page = document.getElementById(pageId);
                    if (page) {
                        const msgContainer = page.querySelector('.ins-chat-messages');
                        if (msgContainer && window.imChat.appendMessageToContainer) {
                            window.imChat.appendMessageToContainer(callFriend, msgContainer, recordMsg);
                            window.imChat.scrollToBottom(msgContainer);
                        }
                    }
                }
            }

            callFriend = null;
        }

        if (newHangupBtn) {
            newHangupBtn.addEventListener('click', closeCall);
        }

        if (newMinimizeBtn && minimizedFloat && mainContent) {
            newMinimizeBtn.addEventListener('click', () => {
                mainContent.style.opacity = '0';
                mainContent.style.pointerEvents = 'none';
                if(bgEl) bgEl.style.opacity = '0';
                
                setTimeout(() => {
                    mainContent.style.display = 'none';
                    minimizedFloat.style.display = 'flex';
                }, 300);
                
                // 设置整个视图不拦截点击
                newView.style.pointerEvents = 'none';
                
                // Reset float position
                minimizedFloat.style.right = '20px';
                minimizedFloat.style.top = '100px';
                minimizedFloat.style.left = 'auto';
                minimizedFloat.style.bottom = 'auto';
            });
        }

        if (minimizedFloat && mainContent) {
            let isDragging = false;
            let startX, startY, initialX, initialY;

            const onDragStart = (e) => {
                isDragging = false;
                const touch = e.type.includes('touch') ? e.touches[0] : e;
                startX = touch.clientX;
                startY = touch.clientY;
                const rect = minimizedFloat.getBoundingClientRect();
                initialX = rect.left;
                initialY = rect.top;
                
                minimizedFloat.style.transition = 'none';
                minimizedFloat.style.right = 'auto';
                minimizedFloat.style.bottom = 'auto';
                minimizedFloat.style.left = initialX + 'px';
                minimizedFloat.style.top = initialY + 'px';

                document.addEventListener('mousemove', onDragMove, { passive: false });
                document.addEventListener('touchmove', onDragMove, { passive: false });
                document.addEventListener('mouseup', onDragEnd);
                document.addEventListener('touchend', onDragEnd);
            };

            const onDragMove = (e) => {
                const touch = e.type.includes('touch') ? e.touches[0] : e;
                const dx = touch.clientX - startX;
                const dy = touch.clientY - startY;

                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    isDragging = true;
                }

                if (isDragging) {
                    e.preventDefault();
                    let newX = initialX + dx;
                    let newY = initialY + dy;
                    
                    // Boundary check
                    const maxX = window.innerWidth - minimizedFloat.offsetWidth;
                    const maxY = window.innerHeight - minimizedFloat.offsetHeight;
                    newX = Math.max(0, Math.min(newX, maxX));
                    newY = Math.max(0, Math.min(newY, maxY));

                    minimizedFloat.style.left = newX + 'px';
                    minimizedFloat.style.top = newY + 'px';
                }
            };

            const onDragEnd = () => {
                minimizedFloat.style.transition = 'all 0.3s ease';
                document.removeEventListener('mousemove', onDragMove);
                document.removeEventListener('touchmove', onDragMove);
                document.removeEventListener('mouseup', onDragEnd);
                document.removeEventListener('touchend', onDragEnd);
            };

            minimizedFloat.addEventListener('mousedown', onDragStart);
            minimizedFloat.addEventListener('touchstart', onDragStart, { passive: false });

            minimizedFloat.addEventListener('click', (e) => {
                if (isDragging) {
                    e.stopPropagation();
                    e.preventDefault();
                    return;
                }
                minimizedFloat.style.display = 'none';
                mainContent.style.display = 'flex';
                if(bgEl) bgEl.style.opacity = '1';
                setTimeout(() => {
                    mainContent.style.opacity = '1';
                    mainContent.style.pointerEvents = 'auto';
                }, 10);
                
                // 恢复整个视图的点击拦截
                newView.style.pointerEvents = 'auto';
            });
        }

        if (newSendBtn && newInput && newMessagesArea) {
            newSendBtn.addEventListener('click', async () => {
                if (!isConnected) return;
                const text = newInput.value.trim();
                if (!text || !callFriend) return;
                
                addCallBubble(text, true, newMessagesArea);
                lastCallAiTurn = null;
                newInput.value = '';

                // Optional: trigger API for character response inside call
                if (window.imChat.handleCallApiReply) {
                    await window.imChat.handleCallApiReply(callFriend, text, (txt, isSelf) => addCallBubble(txt, isSelf, newMessagesArea));
                } else if (window.imChat.generateMockReply) {
                    setTimeout(() => {
                        addCallBubble(window.imChat.generateMockReply(callFriend, text), false, newMessagesArea);
                    }, 1000);
                }
            });
        }

        function removeCallTurnFromView(turn, messagesArea) {
            if (!turn?.message?.callTurnId || !messagesArea) return;
            messagesArea.querySelectorAll(`[data-call-turn-id="${turn.message.callTurnId}"]`).forEach(node => node.remove());
        }

        function buildCallRegeneratePrompt(previousReply) {
            return previousReply ? `

【重回重新生成要求】：
- User 按下了“重回”，这通常代表 User 对上一轮语音回复不满意。
- 请先在内部思考：User 为什么重回、刚刚生成的内容不好的点在哪里、User 现在更需要怎样的电话回复。可能问题包括：语气不对、关系距离不对、动作氛围太泛、没有接住情绪、对话太长、太敷衍、太热情、偏离人设、节奏不像电话、没有回应重点。
- 禁止与上一轮重复或高度相似，不能复用相同句式、称呼、情绪走向、动作安排、环境声细节或结尾。
- 不要在 action 或 text 里解释“重回”。
【刚刚被重回的回复】：
${previousReply}` : '';
        }

        async function runCallAiReply(options = {}) {
            const triggerBtn = options.regenerate ? newRegenerateBtn : newAiBtn;
            if (!isConnected || !callFriend || !newMessagesArea) return;
            const { apiConfig, userState } = window;
            if (!apiConfig || !apiConfig.endpoint || !apiConfig.apiKey) {
                if (window.showToast) window.showToast('请先配置 API');
                return;
            }

            let regenerateContext = null;
            if (options.regenerate) {
                if (!lastCallAiTurn?.message) {
                    if (window.showToast) window.showToast('暂无可重回的回复');
                    return;
                }
                regenerateContext = {
                    previousAction: lastCallAiTurn.message.actionText || '',
                    previousThought: lastCallAiTurn.message.thoughtText || '',
                    previousText: lastCallAiTurn.message.text || '',
                    previousReply: [
                        lastCallAiTurn.message.actionText ? `动作/氛围：${lastCallAiTurn.message.actionText}` : '',
                        lastCallAiTurn.message.thoughtText ? `心声：${lastCallAiTurn.message.thoughtText}` : '',
                        lastCallAiTurn.message.text ? `对话：${lastCallAiTurn.message.text}` : ''
                    ].filter(Boolean).join('\n')
                };
                removeCallTurnFromView(lastCallAiTurn, newMessagesArea);
                callMessages = callMessages.filter(item => item !== lastCallAiTurn.message);
                lastCallAiTurn = null;
            }

            if (triggerBtn) {
                triggerBtn.style.opacity = '0.5';
                triggerBtn.style.pointerEvents = 'none';
            }

            try {
                const systemDepth = window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('system_depth') : '';
                const beforeRole = window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('before_role') : '';
                
                const effectiveUserPersona = window.imApp?.getEffectivePersonaForFriend ? window.imApp.getEffectivePersonaForFriend(callFriend) : (userState?.persona || '普通用户');
                
                const contextLimit = window.imApp?.getContextLimit ? window.imApp.getContextLimit(callFriend) : 20;
                
                let chatContextStr = '';
                if (window.imApp?.getRecentContextMessages) {
                    const contextMsgs = window.imApp.getRecentContextMessages(callFriend);
                    if (contextMsgs && contextMsgs.length > 0) {
                        chatContextStr = contextMsgs.map(m => {
                            const roleName = m.role === 'user' ? (userState.name || 'User') : (m.speaker || callFriend.nickname);
                            const content = m.text || m.content || '';
                            return `${roleName}: ${content}`;
                        }).join('\n');
                    }
                }

                const recentMessages = callMessages.slice(-contextLimit).map(m => {
                    const speaker = m.isSelf ? (userState.name || 'User') : callFriend.nickname;
                    const parts = [];
                    if (m.actionText) parts.push(`动作/氛围：${m.actionText}`);
                    if (m.thoughtText) parts.push(`心声：${m.thoughtText}`);
                    if (m.text) parts.push(`对话：${m.text}`);
                    return `${speaker}: ${parts.join(' / ')}`;
                }).join('\n');

                const charDisplayName = callFriend.realName || callFriend.nickname || 'Char';
                const regeneratePrompt = buildCallRegeneratePrompt(regenerateContext?.previousReply || '');
                const systemPrompt = `${systemDepth ? `System Depth Rules:\n${systemDepth}\n\n` : ''}${beforeRole ? `Before Role Rules:\n${beforeRole}\n\n` : ''}You are playing the role of ${charDisplayName}.
【核心设定/Core Persona】：${callFriend.persona || 'No specific persona'}。
You are talking to ${userState.name || 'User'}, whose persona is: ${effectiveUserPersona}。

【之前的文字聊天记录】：
${chatContextStr || '无'}

【当前场景】：你和用户正处于实时的语音通话中。
【要求】：
1. 请结合之前的文字聊天记录以及当前的语音通话上下文，给出一个连贯自然的电话回复。
2. action 必须用第三人称描写动作、环境声或通话氛围，必须包含角色名字“${charDisplayName}”，不要用“我/你”开头。
3. action 要像电话那头能听到或感受到的细节，例如：${charDisplayName}翻了个身，电话那头传来布料摩擦声；${charDisplayName}压低了呼吸，背景里有很轻的脚步声。
4. thought 是 ${charDisplayName} 此刻没说出口的当下心声，必须使用第一人称自述视角（即以“我”自称），可以体现口是心非、犹豫、压住的情绪、真正想说但没说的话；必须贴合人设和当前电话氛围。
5. text 是角色真正说出口的话，可以和 thought 有反差，但不能让 text 解释 thought。
6. action、thought、text 都要简短、口语、贴近实时通话，不要长篇独白。
【输出格式】：必须返回纯 JSON，格式为 {"action": "第三人称动作/环境声/氛围描写，必须带${charDisplayName}的名字", "thought": "角色当下心声，不说出口的话（第一人称视角）", "text": "角色说出口的对话内容"}${regeneratePrompt}

【当前的语音通话上下文】:
${recentMessages}`;

                let endpoint = apiConfig.endpoint;
                if(endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
                if(!endpoint.endsWith('/chat/completions')) {
                    endpoint = endpoint.endsWith('/v1') ? endpoint + '/chat/completions' : endpoint + '/v1/chat/completions';
                }

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
                    body: JSON.stringify({
                        model: apiConfig.model || '',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: options.regenerate ? '请重回并重新生成这一轮语音通话回复' : '请继续语音通话' }
                        ],
                        temperature: parseFloat(apiConfig.temperature) || 0.7
                    })
                });

                if (!response.ok) throw new Error('API Error');
                const data = await response.json();
                let fullReply = data.choices[0].message.content;

                let parsed = null;
                let cleanText = fullReply.trim();
                if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
                else if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
                if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3);

                try {
                    parsed = JSON.parse(cleanText);
                } catch (e) {
                    parsed = { action: '', text: cleanText };
                }

                if (!callFriend) return;

                if (parsed && (parsed.text || parsed.action || parsed.thought)) {
                    const message = addCallBubble(parsed.text || '', false, newMessagesArea, parsed.action || '', parsed.thought || '');
                    lastCallAiTurn = { message };
                }

            } catch (error) {
                console.error(error);
                if (options.regenerate && regenerateContext?.previousReply) {
                    const restored = addCallBubble(
                        regenerateContext.previousText || '',
                        false,
                        newMessagesArea,
                        regenerateContext.previousAction || '',
                        regenerateContext.previousThought || ''
                    );
                    lastCallAiTurn = { message: restored };
                }
                if (window.showToast) window.showToast(options.regenerate ? '重回失败' : 'API 请求失败');
            } finally {
                if (triggerBtn) {
                    triggerBtn.style.opacity = '1';
                    triggerBtn.style.pointerEvents = 'auto';
                }
            }
        }

        if (newAiBtn && newMessagesArea) {
            newAiBtn.addEventListener('click', async () => {
                await runCallAiReply();
            });
        }

        if (newRegenerateBtn && newMessagesArea) {
            newRegenerateBtn.addEventListener('click', async () => {
                await runCallAiReply({ regenerate: true });
            });
        }

        if (newInput && newSendBtn) {
            newInput.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter' || e.keyCode === 13) {
                    newSendBtn.click();
                }
            });
        }
    };

    // Call Details Modal Logic
    // ==========================================
    // GROUP VOICE CALL
    // ==========================================
    let groupCallTimer = null;
    let groupCallSeconds = 0;
    let groupCallTarget = null;
    let groupCallMessages = [];
    let activeGroupMembers = [];

    function startGroupTimer(statusEl, minTimeTextEl) {
        groupCallSeconds = 0;
        if(statusEl) statusEl.innerText = '00:00';
        if(minTimeTextEl) minTimeTextEl.innerText = '00:00';
        groupCallTimer = setInterval(() => {
            groupCallSeconds++;
            const t = formatTime(groupCallSeconds);
            if(statusEl) statusEl.innerText = t;
            if(minTimeTextEl) minTimeTextEl.innerText = t;
        }, 1000);
    }

    function stopGroupTimer() {
        if (groupCallTimer) {
            clearInterval(groupCallTimer);
            groupCallTimer = null;
        }
    }

    function addGroupCallBubble(text, senderId, messagesArea, actionText = '') {
        if (actionText) {
            const actionDiv = document.createElement('div');
            actionDiv.style.textAlign = 'center';
            actionDiv.style.fontSize = '12px';
            actionDiv.style.color = 'rgba(255,255,255,0.6)';
            actionDiv.style.marginBottom = '10px';
            actionDiv.innerText = actionText;
            if (messagesArea) {
                messagesArea.appendChild(actionDiv);
            }
        }

        if (!text) return;
        
        let isSelf = (senderId === '__user__' || !senderId);
        let senderName = isSelf ? (window.userState?.name || 'User') : 'Member';
        let senderAvatar = '';
        
        if (!isSelf && groupCallTarget) {
            const friend = window.imData.friends.find(f => f.id === senderId);
            if (friend) {
                senderName = friend.nickname;
                senderAvatar = friend.avatarUrl;
            }
        }

        const bubbleWrap = document.createElement('div');
        bubbleWrap.style.display = 'flex';
        bubbleWrap.style.flexDirection = 'column';
        bubbleWrap.style.alignItems = isSelf ? 'flex-end' : 'flex-start';
        bubbleWrap.style.marginBottom = '10px';

        const nameLabel = document.createElement('div');
        nameLabel.style.fontSize = '12px';
        nameLabel.style.color = 'rgba(255,255,255,0.6)';
        nameLabel.style.marginBottom = '4px';
        nameLabel.innerText = senderName;

        const bubbleRow = document.createElement('div');
        bubbleRow.style.display = 'flex';
        bubbleRow.style.gap = '8px';
        bubbleRow.style.alignItems = 'flex-start';

        const bubble = document.createElement('div');
        bubble.style.maxWidth = '240px';
        bubble.style.fontSize = '14px';
        bubble.style.lineHeight = '1.4';
        bubble.style.wordBreak = 'break-word';
        bubble.style.color = '#fff';
        bubble.style.padding = '4px 0'; // 稍微留点上下间距，但不做气泡内边距

        if (isSelf) {
            bubbleRow.appendChild(bubble);
        } else {
            const avatarEl = document.createElement('div');
            avatarEl.style.width = '32px';
            avatarEl.style.height = '32px';
            avatarEl.style.borderRadius = '50%';
            avatarEl.style.background = '#e5e5ea';
            avatarEl.style.overflow = 'hidden';
            avatarEl.style.display = 'flex';
            avatarEl.style.justifyContent = 'center';
            avatarEl.style.alignItems = 'center';
            avatarEl.style.color = '#8e8e93';
            if (senderAvatar) {
                avatarEl.innerHTML = `<img src="${senderAvatar}" style="width:100%;height:100%;object-fit:cover;">`;
            } else {
                avatarEl.innerHTML = `<i class="fas fa-user"></i>`;
            }
            
            bubbleRow.appendChild(avatarEl);
            bubbleRow.appendChild(bubble);
        }

        bubble.innerText = '「 ' + text + ' 」';
        bubbleWrap.appendChild(nameLabel);
        bubbleWrap.appendChild(bubbleRow);
        
        if (messagesArea) {
            messagesArea.appendChild(bubbleWrap);
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }

        groupCallMessages.push({
            text: text,
            actionText: actionText,
            senderId: senderId || '__user__',
            senderName: senderName,
            isSelf: isSelf,
            timestamp: Date.now()
        });
    }

    window.imChat.openGroupVoiceCall = function(group, memberIds) {
        const view = document.getElementById('group-voice-call-view');
        if (!view) return;

        // Clean up old listeners
        const newView = view.cloneNode(true);
        view.parentNode.replaceChild(newView, view);

        groupCallTarget = group;
        activeGroupMembers = memberIds;
        groupCallMessages = [];

        // UI Elements
        const hangupBtn = newView.querySelector('#group-call-hangup-btn');
        const minimizeBtn = newView.querySelector('#group-call-minimize-btn');
        const statusText = newView.querySelector('#group-call-status-text');
        const avatarsGrid = newView.querySelector('#group-call-avatars-grid');
        const messagesArea = newView.querySelector('#group-call-messages');
        const inputEl = newView.querySelector('#group-call-input');
        const sendBtn = newView.querySelector('#group-call-send-btn');
        const aiBtn = newView.querySelector('#group-call-ai-btn');
        
        let minBanner = document.getElementById('group-call-minimized-banner');
        let minText = null;
        let minTime = null;

        // 提前克隆并更新引用，防止后续使用旧 DOM
        if (minBanner) {
            const newMinBanner = minBanner.cloneNode(true);
            minBanner.parentNode.replaceChild(newMinBanner, minBanner);
            minBanner = newMinBanner;
            
            minText = document.getElementById('group-call-minimized-text');
            minTime = document.getElementById('group-call-minimized-time');
            
            minBanner.addEventListener('click', () => {
                minBanner.style.display = 'none';
                newView.style.display = 'flex';
                const mainContent = newView.querySelector('#group-call-main-content');
                const bgEl = newView.querySelector('#group-call-bg');
                if (mainContent) {
                    mainContent.style.opacity = '1';
                    mainContent.style.pointerEvents = 'auto';
                }
                if (bgEl) {
                    bgEl.style.opacity = '1';
                }
                newView.style.opacity = '1';
                newView.style.pointerEvents = 'auto';
                newView.classList.add('active');
            });
        }

        // Reset UI
        messagesArea.innerHTML = '';
        inputEl.value = '';
        avatarsGrid.innerHTML = '';
        statusText.innerText = '等待接通...';
        
        newView.style.display = 'flex';
        newView.style.opacity = '1';
        newView.style.pointerEvents = 'auto';
        newView.classList.add('active');
        if (window.openView) {
            window.openView(newView);
        }

        // Include user in avatars grid
        const allParticipants = [{ id: '__user__', isUser: true }, ...memberIds.map(id => window.imData.friends.find(f => f.id === id)).filter(Boolean)];
        
        allParticipants.forEach(p => {
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.alignItems = 'center';
            wrap.style.gap = '6px';
            
            const avatar = document.createElement('div');
            avatar.style.width = '64px';
            avatar.style.height = '64px';
            avatar.style.borderRadius = '50%';
            avatar.style.border = '2px solid rgba(255,255,255,0.1)';
            avatar.style.background = '#333';
            avatar.style.overflow = 'hidden';
            avatar.style.transition = 'all 0.5s ease';
            
            if (p.isUser) {
                // User initiating the call is fully colored and active immediately
                avatar.style.filter = 'grayscale(0%) opacity(1)';
                avatar.style.border = '2px solid #34c759';
            } else {
                // Others grayed out initially
                avatar.style.filter = 'grayscale(100%) opacity(0.5)';
            }
            
            if (p.isUser) {
                const userAvatar = window.userState?.avatarUrl || window.userState?.avatar;
                if (userAvatar) {
                    avatar.innerHTML = `<img src="${userAvatar}" style="width:100%;height:100%;object-fit:cover;">`;
                } else {
                    avatar.innerHTML = `<div style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;color:#fff;"><i class="fas fa-user"></i></div>`;
                }
            } else {
                if (p.avatarUrl) {
                    avatar.innerHTML = `<img src="${p.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">`;
                } else {
                    avatar.innerHTML = `<div style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;color:#fff;"><i class="fas fa-robot"></i></div>`;
                }
            }

            const name = document.createElement('div');
            name.style.fontSize = '12px';
            name.style.color = 'rgba(255,255,255,0.6)';
            name.style.maxWidth = '70px';
            name.style.overflow = 'hidden';
            name.style.textOverflow = 'ellipsis';
            name.style.whiteSpace = 'nowrap';
            name.innerText = p.isUser ? (window.userState?.name || 'User') : p.nickname;

            wrap.appendChild(avatar);
            wrap.appendChild(name);
            avatarsGrid.appendChild(wrap);

            if (!p.isUser) {
                // Animate to color after random delay (1-3 seconds)
                setTimeout(() => {
                    avatar.style.filter = 'grayscale(0%) opacity(1)';
                    avatar.style.border = '2px solid #34c759'; // Green border when connected
                }, 1000 + Math.random() * 2000);
            }
        });

        // Start timer after 1 second
        setTimeout(() => {
            startGroupTimer(statusText, minTime);
            if (minText) minText.innerText = `${allParticipants.length}人正在群通话中...`;
        }, 1000);

        const closeGroupCall = () => {
            const durationText = formatTime(groupCallSeconds);
            const finalMessages = [...groupCallMessages];
            const finalDuration = groupCallSeconds;

            stopGroupTimer();
            newView.style.display = 'none';
            newView.style.opacity = '0';
            newView.style.pointerEvents = 'none';
            newView.classList.remove('active');
            if (window.closeView) window.closeView(newView);
            
            if (minBanner) minBanner.style.display = 'none';
            
            // Save to group
            if (groupCallTarget && window.imApp && window.imApp.appendFriendMessage) {
                let callTranscript = '';
                if (finalMessages.length > 0) {
                    callTranscript = finalMessages.map(m => `${m.senderName}: ${m.text}`).join('\n  ');
                } else {
                    callTranscript = '无对话';
                }

                // Append the call card
                const recordMsg = {
                    id: Date.now().toString(),
                    type: 'voice_call_record',
                    role: 'system',
                    content: '[群语音通话记录]',
                    senderId: '__user__',
                    timestamp: Date.now(),
                    duration: finalDuration,
                    callMessages: finalMessages,
                    statusText: `群通话时长 ${durationText}`,
                    isSelf: true
                };

                window.imApp.appendFriendMessage(groupCallTarget.id, recordMsg);
                
                // Add text note for context
                const contextNotice = {
                    id: (Date.now() + 1).toString(),
                    type: 'text',
                    role: 'system',
                    content: `[系统提示：刚刚完成了一次群语音通话，时长 ${durationText}。通话内容：\n${callTranscript}]`,
                    timestamp: Date.now() + 1
                };
                window.imApp.appendFriendMessage(groupCallTarget.id, contextNotice);

                // Update UI if needed
                const pageId = `chat-interface-${groupCallTarget.id}`;
                const page = document.getElementById(pageId);
                if (page) {
                    const msgContainer = page.querySelector('.ins-chat-messages');
                    if (msgContainer && window.imChat.appendMessageToContainer) {
                        window.imChat.appendMessageToContainer(groupCallTarget, msgContainer, recordMsg);
                        window.imChat.scrollToBottom(msgContainer);
                    }
                }
            }

            groupCallTarget = null;
            groupCallMessages = [];
        };

        if (hangupBtn) hangupBtn.addEventListener('click', closeGroupCall);

        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
                const mainContent = newView.querySelector('#group-call-main-content');
                const bgEl = newView.querySelector('#group-call-bg');
                
                if (mainContent) {
                    mainContent.style.opacity = '0';
                    mainContent.style.pointerEvents = 'none';
                }
                if (bgEl) {
                    bgEl.style.opacity = '0';
                }

                setTimeout(() => {
                    newView.style.display = 'none';
                    newView.style.opacity = '0';
                    newView.classList.remove('active');
                }, 300);
                
                newView.style.pointerEvents = 'none';
                if (minBanner) minBanner.style.display = 'flex'; // 恢复显示悬浮气泡
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                const text = inputEl.value.trim();
                if (!text) return;
                addGroupCallBubble(text, '__user__', messagesArea);
                inputEl.value = '';
            });
        }

        if (inputEl) {
            inputEl.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter' || e.keyCode === 13) sendBtn.click();
            });
        }

        if (aiBtn) {
            aiBtn.addEventListener('click', async () => {
                if (!groupCallTarget) return;
                
                const { apiConfig } = window;
                const userState = window.userState || {};
                if (!apiConfig || !apiConfig.endpoint || !apiConfig.apiKey) {
                    if (window.showToast) window.showToast('请先配置 API');
                    return;
                }

                aiBtn.style.opacity = '0.5';
                aiBtn.style.pointerEvents = 'none';

                try {
                    // Fetch group members details
                    const groupMembers = activeGroupMembers.map(id => window.imData.friends.find(f => f.id === id)).filter(Boolean);
                    
                    // 获取群聊成员的挂载单聊记忆
                    const groupMemorySettings = groupCallTarget.memory?.mountSettings || {};
                    const groupMemoryLimits = groupCallTarget.memory?.mountLimits || {};
                    const membersInfo = groupMembers.map(m => {
                        let memberStr = `Name: ${m.nickname}\nPersona: ${m.persona || 'None'}`;
                        
                        // 挂载单聊上下文
                        if (groupMemorySettings[m.id]) {
                            const limit = groupMemoryLimits[m.id] || 20;
                            let contextMsgs = m.messages || [];
                            if (window.imApp.getRecentContextMessages && contextMsgs.length === 0) {
                                contextMsgs = window.imApp.getRecentContextMessages(m) || [];
                            }
                            if (contextMsgs.length > limit) {
                                contextMsgs = contextMsgs.slice(-limit);
                            }
                            if (contextMsgs && contextMsgs.length > 0) {
                                const chatContextStr = contextMsgs.map(msg => {
                                    const roleName = msg.role === 'user' ? (userState.name || 'User') : (msg.speaker || m.nickname);
                                    return `${roleName}: ${msg.text || msg.content || ''}`;
                                }).join('\n');
                                memberStr += `\n【${m.nickname} 与 ${userState.name || 'User'} 的单聊记忆（供参考该角色的态度和背景）】:\n${chatContextStr}`;
                            }
                        }
                        return memberStr;
                    }).join('\n\n-----------------\n\n');
                    
                    const systemDepth = window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('system_depth') : '';
                    const beforeRole = window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('before_role') : '';
                    const afterRole = window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('after_role') : '';
                    const customGroupPrompt = groupCallTarget.memory?.context?.prompt || '';
                    
                    const effectiveUserPersona = window.imApp?.getEffectivePersonaForFriend ? window.imApp.getEffectivePersonaForFriend(groupCallTarget) : (userState?.persona || '普通用户');
                    
                    const recentMsgs = groupCallMessages.slice(-20).map(m => `${m.senderName}: ${m.text}`).join('\n');
                    
                    let systemPrompt = '';
                    if (systemDepth) systemPrompt += `【系统规则 (System Depth)】\n${systemDepth}\n\n`;
                    if (beforeRole) systemPrompt += `【前置设定 (Before Role)】\n${beforeRole}\n\n`;
                    
                    systemPrompt += `You are simulating a group voice call in the group "${groupCallTarget.nickname}".
【群聊成员设定】:
${membersInfo}

The user is ${userState?.name || 'User'}, whose persona is: ${effectiveUserPersona}.

【当前的语音通话记录】:
${recentMsgs || '无'}
`;
                    if (customGroupPrompt) systemPrompt += `\n【群聊特殊设定】:\n${customGroupPrompt}\n`;
                    if (afterRole) systemPrompt += `\n【补充设定 (After Role)】:\n${afterRole}\n`;

systemPrompt += `\n【!!!重要指示!!!】:
你现在正处于真实的群聊实时语音通话中。
【要求】:
1. 请根据最新的语音聊天记录、成员设定（尤其是单聊挂载记忆）及群聊场景，选择 1 到 3 个最合适的群成员发言回应。
2. 每个被选中的人说2-5简短自然的语音回复（务必口语化，像真人在打电话，不要长篇大论），并且提供相应的动作、环境或心理描写。
3. 严禁虚构名单外的人发言。
4. 【输出格式】：必须返回纯 JSON 数组，格式为：[{"senderName": "成员名", "action": "动作或心理描写，如：轻轻叹了口气 / 听起来很开心", "text": "发言内容"}]。`;
                    let endpoint = apiConfig.endpoint;
                    if(endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
                    if(!endpoint.endsWith('/chat/completions')) {
                        endpoint = endpoint.endsWith('/v1') ? endpoint + '/chat/completions' : endpoint + '/v1/chat/completions';
                    }

                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
                        body: JSON.stringify({
                            model: apiConfig.model || '',
                            messages: [
                                { role: 'system', content: systemPrompt },
                                { role: 'user', content: '请继续群语音通话' }
                            ],
                            temperature: parseFloat(apiConfig.temperature) || 0.8
                        })
                    });

                    if (!response.ok) throw new Error('API Error');
                    const data = await response.json();
                    let fullReply = data.choices[0].message.content;

                    let parsed = null;
                    
                    try {
                        // 更鲁棒的 JSON 提取
                        let match = fullReply.match(/\[[\s\S]*\]/);
                        if (match) {
                            parsed = JSON.parse(match[0]);
                        } else {
                            let singleMatch = fullReply.match(/\{[\s\S]*\}/);
                            if (singleMatch) {
                                parsed = [JSON.parse(singleMatch[0])];
                            } else {
                                let cleanText = fullReply.trim();
                                if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
                                else if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
                                if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3);
                                parsed = JSON.parse(cleanText.trim());
                            }
                        }
                        if (!Array.isArray(parsed)) parsed = [parsed];
                    } catch (e) {
                        console.error("Failed to parse JSON in group call", e, fullReply);
                        parsed = [];
                        if (window.showToast) window.showToast('AI返回格式错误，请重试');
                    }

                    if (!groupCallTarget) return; // if hung up during fetch

                    parsed.forEach(msgObj => {
                        if (msgObj.senderName && (msgObj.text || msgObj.action)) {
                            // Find member id by name
                            let friend = groupMembers.find(m => 
                                m.nickname === msgObj.senderName || 
                                m.realName === msgObj.senderName || 
                                (m.nickname && msgObj.senderName.includes(m.nickname)) || 
                                (m.realName && msgObj.senderName.includes(m.realName))
                            );
                            
                            // 兜底方案，如果找不到对应角色，默认使用第一位非用户的群成员
                            if (!friend && groupMembers.length > 0) {
                                friend = groupMembers.find(m => m.id !== '__user__') || groupMembers[0];
                            }

                            if (friend) {
                                setTimeout(() => {
                                    addGroupCallBubble(msgObj.text || '', friend.id, messagesArea, msgObj.action || '');
                                }, 500); // slight delay
                            } else {
                                // 极端情况依然没找到，强行以纯文本显示
                                setTimeout(() => {
                                    addGroupCallBubble(msgObj.text || '', null, messagesArea, msgObj.action || '');
                                }, 500);
                            }
                        }
                    });

                } catch (err) {
                    console.error(err);
                    if (window.showToast) window.showToast('API 请求失败');
                } finally {
                    aiBtn.style.opacity = '1';
                    aiBtn.style.pointerEvents = 'auto';
                }
            });
        }
    };

    window.imChat.openVoiceCallDetail = function(msg) {
        const detailModal = document.getElementById('voice-call-detail-modal');
        const detailContent = document.getElementById('voice-call-detail-content');
        const detailMeta = document.getElementById('voice-call-detail-meta');

        if (!detailModal || !detailContent || !detailMeta) return;
        
        detailMeta.innerText = `通话时长: ${formatTime(msg.duration || 0)}`;
        detailContent.innerHTML = '';

        if (!msg.callMessages || msg.callMessages.length === 0) {
            detailContent.innerHTML = '<div style="text-align: center; color: #8e8e93; padding: 20px;">无通话内容记录</div>';
        } else {
            msg.callMessages.forEach(cMsg => {
                const row = document.createElement('div');
                row.style.marginBottom = '12px';
                
                const name = document.createElement('div');
                name.style.fontSize = '12px';
                name.style.color = '#8e8e93';
                name.style.marginBottom = '4px';
                name.innerText = cMsg.isSelf ? '我' : '对方';

                const bubble = document.createElement('div');
                bubble.style.display = 'inline-block';
                bubble.style.padding = '8px 12px';
                bubble.style.borderRadius = '12px';
                bubble.style.fontSize = '14px';
                bubble.style.maxWidth = '85%';
                bubble.style.wordBreak = 'break-word';

                if (cMsg.isSelf) {
                    bubble.style.background = '#e5e5ea';
                    bubble.style.color = '#000';
                } else {
                    bubble.style.background = '#f2f2f7';
                    bubble.style.color = '#000';
                }

                bubble.innerText = cMsg.text;
                
                row.appendChild(name);
                row.appendChild(bubble);
                detailContent.appendChild(row);
            });
        }

        if (window.openView) {
            window.openView(detailModal);
        } else {
            detailModal.style.display = 'flex';
        }
    };
    function serializeCallMessagesForEdit(messages, friend = null) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        return safeMessages.map((message) => {
            const lines = [];
            if (message.actionText) lines.push(String(message.actionText).trim());
            if (message.thoughtText) lines.push(`心声：${String(message.thoughtText).trim()}`);
            if (message.text) lines.push(`${getCallSpeakerName(message, friend)}：${formatCallLineText(message.text)}`);
            return lines.join('\n');
        }).filter(Boolean).join('\n\n');
    }

    function buildCallRecordContextText(messages, friend = null, duration = 0, statusText = '通话记录') {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const durationText = `${Math.floor((Number(duration) || 0) / 60)}分${(Number(duration) || 0) % 60}秒`;

        if (statusText === '已拒绝') {
            return '[语音通话记录] 对方刚刚拒绝了这通语音通话。';
        }
        if (statusText === '已取消') {
            return '[语音通话记录] 用户刚刚取消了这通语音通话。';
        }

        const transcript = safeMessages.map((message) => {
            const parts = [];
            if (message.actionText) parts.push(String(message.actionText).trim());
            if (message.thoughtText) parts.push(`心声：${String(message.thoughtText).trim()}`);
            if (message.text) parts.push(`${getCallSpeakerName(message, friend)}：${formatCallLineText(message.text)}`);
            return parts.join('\n');
        }).filter(Boolean).join('\n');

        return transcript
            ? `[语音通话记录] 时长 ${durationText}\n${transcript}`
            : `[语音通话记录] 时长 ${durationText}，未产生可识别的文本记录。`;
    }

    function parseCallMessagesFromEdit(rawText, previousMessages = [], friend = null) {
        const userNames = [window.userState?.name, window.userState?.realName, 'User', '我']
            .filter(Boolean)
            .map(name => String(name).trim());
        const charNames = [friend?.nickname, friend?.realName, 'Char', '对方']
            .filter(Boolean)
            .map(name => String(name).trim());
        const messages = [];
        let pendingAction = '';
        let pendingThought = '';

        String(rawText || '').split(/\r?\n/).forEach((rawLine) => {
            const line = rawLine.trim();
            if (!line) return;

            const thoughtMatch = line.match(/^心声[：:]\s*(.+)$/);
            if (thoughtMatch) {
                pendingThought = String(thoughtMatch[1] || '').trim();
                return;
            }

            const dialogMatch = line.match(/^(?:(.+?)[：:]\s*)?[「"](.*?)[」"]$/);
            if (dialogMatch) {
                const speaker = String(dialogMatch[1] || '').trim();
                const text = String(dialogMatch[2] || '').trim();
                const fallback = previousMessages[messages.length] || {};
                let isSelf = !!fallback.isSelf;

                if (speaker) {
                    if (userNames.some(name => name && speaker.includes(name))) isSelf = true;
                    if (charNames.some(name => name && speaker.includes(name))) isSelf = false;
                }

                messages.push({
                    text,
                    actionText: pendingAction,
                    thoughtText: pendingThought,
                    isSelf,
                    timestamp: fallback.timestamp || Date.now()
                });
                pendingAction = '';
                pendingThought = '';
                return;
            }

            pendingAction = pendingAction ? `${pendingAction}\n${line}` : line;
        });

        if (pendingAction || pendingThought) {
            const fallback = previousMessages[messages.length] || {};
            messages.push({
                text: '',
                actionText: pendingAction,
                thoughtText: pendingThought,
                isSelf: !!fallback.isSelf,
                timestamp: fallback.timestamp || Date.now()
            });
        }

        return messages;
    }

    function renderCallDetailReadMode(detailContent, msg, friend = null) {
        detailContent.innerHTML = '';
        const safeMessages = Array.isArray(msg.callMessages) ? msg.callMessages : [];

        if (safeMessages.length === 0) {
            detailContent.innerHTML = '<div style="text-align:left; color:#8e8e93; padding:20px 0;">无通话内容记录</div>';
            return;
        }

        safeMessages.forEach((cMsg) => {
            const block = document.createElement('div');
            block.style.marginBottom = '14px';
            block.style.textAlign = 'left';
            block.style.color = '#111';
            block.style.fontSize = '15px';
            block.style.lineHeight = '1.65';

            if (cMsg.actionText) {
                const action = document.createElement('div');
                action.style.whiteSpace = 'pre-wrap';
                action.style.wordBreak = 'break-word';
                action.innerText = cMsg.actionText;
                block.appendChild(action);
            }

            if (cMsg.thoughtText) {
                const thought = document.createElement('div');
                thought.style.whiteSpace = 'pre-wrap';
                thought.style.wordBreak = 'break-word';
                thought.style.color = '#8e8e93';
                thought.style.fontSize = '13px';
                thought.innerText = cMsg.thoughtText;
                block.appendChild(thought);
            }

            if (cMsg.text) {
                const line = document.createElement('div');
                line.style.whiteSpace = 'pre-wrap';
                line.style.wordBreak = 'break-word';
                line.innerText = `${getCallSpeakerName(cMsg, friend)}：${formatCallLineText(cMsg.text)}`;
                block.appendChild(line);
            }

            detailContent.appendChild(block);
        });
    }

    function renderCallDetailEditMode(detailContent, msg, friend = null) {
        detailContent.innerHTML = '';
        const textarea = document.createElement('textarea');
        textarea.id = 'voice-call-detail-editor';
        // 保留说话人名称，便于保存时识别通话双方。
        textarea.value = serializeCallMessagesForEdit(msg.callMessages, friend);
        textarea.style.width = '100%';
        textarea.style.height = '100%';
        textarea.style.minHeight = '320px';
        textarea.style.boxSizing = 'border-box';
        textarea.style.border = '1px solid #d1d1d6';
        textarea.style.borderRadius = '12px';
        textarea.style.padding = '12px';
        textarea.style.fontSize = '15px';
        textarea.style.lineHeight = '1.6';
        textarea.style.outline = 'none';
        textarea.style.resize = 'none';
        textarea.style.background = '#fff';
        textarea.style.color = '#111';
        detailContent.appendChild(textarea);
        textarea.focus();
    }

    window.imChat.openVoiceCallDetail = function(msg, friend = null) {
        const detailModal = document.getElementById('voice-call-detail-modal');
        const detailContent = document.getElementById('voice-call-detail-content');
        const detailMeta = document.getElementById('voice-call-detail-meta');
        const editBtn = document.getElementById('voice-call-detail-edit-btn');
        const saveBtn = document.getElementById('voice-call-detail-save-btn');
        const cancelBtn = document.getElementById('voice-call-detail-cancel-btn');

        if (!detailModal || !detailContent || !detailMeta) return;

        const detailFriend = friend || window.imData?.currentActiveFriend || null;
        let isEditing = false;

        const setEditMode = (nextEditing) => {
            isEditing = nextEditing;
            if (editBtn) editBtn.style.display = isEditing ? 'none' : 'block';
            if (saveBtn) saveBtn.style.display = isEditing ? 'block' : 'none';
            if (cancelBtn) cancelBtn.style.display = isEditing ? 'block' : 'none';
            if (isEditing) renderCallDetailEditMode(detailContent, msg, detailFriend);
            else renderCallDetailReadMode(detailContent, msg, detailFriend);
        };

        detailMeta.innerText = `通话时长: ${formatTime(msg.duration || 0)}`;

        if (editBtn) editBtn.onclick = () => setEditMode(true);
        if (cancelBtn) cancelBtn.onclick = () => setEditMode(false);
        if (saveBtn) {
            saveBtn.onclick = async () => {
                const editor = document.getElementById('voice-call-detail-editor');
                if (!editor) return;

                const previousMessages = Array.isArray(msg.callMessages) ? msg.callMessages : [];
                const nextMessages = parseCallMessagesFromEdit(editor.value, previousMessages, detailFriend);
                const nextContextText = buildCallRecordContextText(
                    nextMessages,
                    detailFriend,
                    msg.duration || 0,
                    msg.statusText || '通话记录'
                );
                msg.callMessages = nextMessages;
                msg.content = nextContextText;
                msg.text = nextContextText;
                msg.updatedAt = new Date().toISOString();

                let saved = true;
                if (detailFriend?.id && window.imApp?.updateFriendMessage) {
                    saved = await window.imApp.updateFriendMessage(detailFriend.id, {
                        id: msg.id || null,
                        timestamp: msg.timestamp || null
                    }, (targetMsg) => {
                        targetMsg.callMessages = nextMessages;
                        targetMsg.content = nextContextText;
                        targetMsg.text = nextContextText;
                        targetMsg.updatedAt = msg.updatedAt;
                    }, { silent: true });

                    if (!saved && window.showToast) {
                        window.showToast('通话记录保存失败');
                    }
                }

                const page = detailFriend?.id ? document.getElementById(`chat-interface-${detailFriend.id}`) : null;
                const msgContainer = page ? page.querySelector('.ins-chat-messages') : null;
                if (msgContainer && window.imChat.rerenderChatContainer) {
                    const latestFriend = (window.imData?.friends || []).find(item => String(item.id) === String(detailFriend.id)) || detailFriend;
                    window.imChat.rerenderChatContainer(latestFriend, msgContainer, { scroll: false });
                }

                if (saved && window.showToast) window.showToast('通话上下文已更新');
                setEditMode(false);
            };
        }

        setEditMode(false);

        if (window.openView) {
            window.openView(detailModal);
        } else {
            detailModal.style.display = 'flex';
        }
    };
})();

