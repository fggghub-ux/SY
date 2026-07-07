

// ==========================================
// IMESSAGE: 4_chat_sheet.js
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const { apiConfig, userState } = window;
    window.imChat = window.imChat || {};
    const imChat = window.imChat;
    const offlineRegexEngine = window.imOfflineRegex;

async function commitSheetFriendChange(friendOrId, mutator, options = {}) {
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

function getChatImagePlaceholderUrl() {
        return window.imChat.CHAT_IMAGE_PLACEHOLDER_URL || 'assets/imessage/chat-image-placeholder.jpg';
    }

function resolveChatCompletionsEndpoint(config) {
        let endpoint = String(config?.endpoint || '').trim();
        if (!endpoint) return '';
        if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
        if (!endpoint.endsWith('/chat/completions')) {
            endpoint = endpoint.endsWith('/v1') ? `${endpoint}/chat/completions` : `${endpoint}/v1/chat/completions`;
        }
        return endpoint;
    }

function getVisionResponseContent(data) {
        const firstChoice = Array.isArray(data?.choices) ? data.choices[0] : null;
        return firstChoice?.message?.content || firstChoice?.text || firstChoice?.delta?.content || '';
    }

async function identifyChatImage(imageUrl) {
        const currentApiConfig = window.apiConfig || apiConfig || {};
        const endpoint = resolveChatCompletionsEndpoint(currentApiConfig);
        if (!endpoint || !currentApiConfig.apiKey || !currentApiConfig.model) {
            throw new Error('Vision API config missing');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentApiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: currentApiConfig.model || '',
                    temperature: parseFloat(currentApiConfig.temperature) || 0.3,
                    messages: [
                        {
                            role: 'system',
                            content: '你是图片识别助手。只输出一段简洁中文图片描述，包含主体、场景、明显文字和情绪氛围，不要解释过程。'
                        },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: '请识别这张图片，输出可供聊天 AI 理解的中文描述。' },
                                { type: 'image_url', image_url: { url: imageUrl } }
                            ]
                        }
                    ]
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                let errorText = `${response.status} ${response.statusText}`;
                try {
                    errorText = JSON.stringify(await response.json());
                } catch (_) {}
                throw new Error(errorText);
            }

            const data = await response.json();
            const content = String(getVisionResponseContent(data) || '').trim();
            if (!content) throw new Error('Vision API returned empty content');
            return content;
        } finally {
            clearTimeout(timeoutId);
        }
    }

function createAttachmentSheet(page) {
        if (window.imData.attachmentSheet) {
            // Ensure it's appended to the correct page if switching chats
            if (window.imData.attachmentSheet.parentNode !== page) {
                page.appendChild(window.imData.attachmentSheet);
            }
            return window.imData.attachmentSheet;
        }
        
        const attachmentSheet = document.createElement('div');
        attachmentSheet.id = 'chat-attachment-sheet';
        window.imData.attachmentSheet = attachmentSheet;
        attachmentSheet.style.position = 'absolute';
        attachmentSheet.style.inset = '0';
        attachmentSheet.style.zIndex = '45';
        attachmentSheet.style.display = 'none';
        attachmentSheet.style.flexDirection = 'column';
        attachmentSheet.style.justifyContent = 'flex-end';
        attachmentSheet.style.overflow = 'hidden';

        attachmentSheet.innerHTML = `
            <div class="sheet-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.4); opacity: 0; transition: opacity 0.3s;"></div>
            <div class="sheet-content" style="position: relative; height: 50%; width: 100%; background: #fff; border-radius: 24px 24px 0 0; display: flex; flex-direction: column; overflow: hidden; transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1); ">
                <!-- Header -->
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: rgba(255,255,255,0.95);   z-index: 10;">
                    <div class="close-sheet-btn" style="width: 32px; height: 32px; background: #f2f2f7; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer; color: #000;"><i class="fas fa-times"></i></div>
                    <div style="font-weight: 600; font-size: 18px; color: #000;">Recents <i class="fas fa-chevron-down" style="font-size: 12px; color: #8e8e93; margin-left: 4px;"></i></div>
                    <div style="width: 32px;"></div>
                </div>
                
                <!-- Views Container -->
                <div style="flex: 1; position: relative; overflow: hidden; background: #fff;">
                    <!-- Gallery View -->
                    <div class="sheet-view view-gallery" style="position: absolute; inset: 0; overflow-y: auto; padding: 18px; padding-bottom: 120px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-content: flex-start; scrollbar-width: none;">
                        <div class="grid-item virtual-upload" style="aspect-ratio: 1; background: #f7f7fa; border-radius: 18px; border: 1px solid #ececf1; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;">
                            <i class="fas fa-magic" style="font-size: 30px; color: #007aff; margin-bottom: 10px;"></i>
                            <span style="font-size: 14px; color: #111; font-weight: 800;">虚拟图片</span>
                            <span style="font-size: 11px; color: #8e8e93; margin-top: 4px;">使用默认图发送</span>
                        </div>
                        <div class="grid-item real-upload" style="aspect-ratio: 1; background: #f7f7fa; border-radius: 18px; border: 1px solid #ececf1; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; position: relative; overflow: hidden;">
                            <i class="fas fa-camera" style="font-size: 30px; color: #34c759; margin-bottom: 10px;"></i>
                            <span style="font-size: 14px; color: #111; font-weight: 800;">真实相册</span>
                            <span style="font-size: 11px; color: #8e8e93; margin-top: 4px;">上传后自动识图</span>
                            <input type="file" accept="image/*" class="real-file-input" style="position: absolute; inset: 0; opacity: 0; cursor: pointer;">
                        </div>
                    </div>

                    <!-- Linked Friends View -->
                    <div class="sheet-view view-file" style="position: absolute; inset: 0; display: none; background: #fff; padding: 14px 14px 112px; box-sizing: border-box; overflow-y: auto; -webkit-overflow-scrolling: touch;">
                        <div class="linked-accounts-panel" style="width: 100%; display: flex; flex-direction: column; gap: 12px;">
                            <div class="linked-accounts-empty" style="display:none; text-align:center; color:#8e8e93; font-size:13px; line-height:1.45; padding:42px 18px;"></div>
                            <div class="linked-accounts-controls" style="display:flex; flex-direction:column; gap:10px;">
                                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border-radius:18px; background:#f7f7fa;">
                                    <div style="min-width:0;">
                                        <div style="font-size:15px; font-weight:800; color:#111;">是否开启关联好友</div>
                                        <div class="linked-accounts-status" style="font-size:12px; color:#8e8e93; margin-top:2px;">开启后会自动生成好友会话</div>
                                    </div>
                                    <label class="toggle-switch" style="flex-shrink:0;">
                                        <input type="checkbox" class="linked-accounts-toggle">
                                        <span class="slider"></span>
                                    </label>
                                </div>
                                <div class="linked-accounts-interval-row" style="display:none; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border-radius:18px; background:#f7f7fa;">
                                    <div>
                                        <div style="font-size:15px; font-weight:700; color:#111;">多少秒自动调用一次 API</div>
                                        <div style="font-size:12px; color:#8e8e93; margin-top:2px;">开启后按此间隔自动生成消息</div>
                                    </div>
                                    <input type="number" class="linked-accounts-interval-input" min="5" step="1" value="60" style="width:82px; height:34px; border:1px solid #e5e5ea; border-radius:12px; background:#fff; color:#111; font-size:15px; text-align:center; outline:none;">
                                </div>
                            </div>
                            <div class="linked-accounts-list" style="display:flex; flex-direction:column; gap:10px;"></div>
                        </div>
                    </div>

                    <!-- Location View Placeholder -->
                    <div class="sheet-view view-location" style="position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; background: #fff; padding-bottom: 60px;">
                        <i class="fas fa-map-marked-alt" style="font-size: 64px; color: #c7c7cc; margin-bottom: 16px;"></i>
                        <div style="font-size: 16px; color: #8e8e93; font-weight: 500;">Location Picker</div>
                        <div style="font-size: 13px; color: #aeaeb2; margin-top: 4px;">Coming soon</div>
                    </div>

                    <!-- Stickers View -->
                    <div class="sheet-view view-stickers" style="position: absolute; inset: 0; display: none; flex-direction: column; background: #fff; padding: 12px 0 112px; overflow: hidden;">
                        <div class="sheet-sticker-category-tabs"></div>
                        <div class="sheet-stickers-list"></div>
                    </div>

                    <!-- More View -->
                    <div class="sheet-view view-more" style="position: absolute; inset: 0; display: none; flex-direction: column; align-items: flex-start; justify-content: flex-start; background: #fff; padding: 20px 18px 120px; gap: 14px;">
                        <div class="attachment-more-icon-grid">
                            <div class="attachment-more-regenerate-entry">
                                <div class="attachment-more-regenerate-icon">
                                    <i class="fas fa-rotate-left"></i>
                                </div>
                                <div class="attachment-more-regenerate-label">重回</div>
                            </div>
                            <div class="attachment-more-pay-entry">
                                <div class="attachment-more-pay-icon">
                                    <i class="fas fa-wallet"></i>
                                </div>
                                <div class="attachment-more-pay-label">Pay</div>
                            </div>
                            <div class="attachment-more-link-entry">
                                <div class="attachment-more-link-icon">
                                    <i class="fas fa-link"></i>
                                </div>
                                <div class="attachment-more-link-label">链接</div>
                            </div>
                            <div class="attachment-more-voice-entry">
                                <div class="attachment-more-voice-icon">
                                    <i class="fas fa-microphone-alt"></i>
                                </div>
                                <div class="attachment-more-voice-label">Voice</div>
                            </div>
                            <div class="attachment-more-listen-entry" style="display:none;">
                                <div class="attachment-more-listen-icon">
                                    <i class="fas fa-headphones"></i>
                                </div>
                                <div class="attachment-more-listen-label">一起听</div>
                            </div>
                            <div class="attachment-more-offline-entry" id="open-offline-taverns-btn">
                                <div class="attachment-more-offline-icon">
                                    <i class="fas fa-people-arrows"></i>
                                </div>
                                <div class="attachment-more-offline-label">线下</div>
                            </div>
                            <div class="attachment-more-narration-entry">
                                <div class="attachment-more-narration-icon">
                                    <i class="fas fa-quote-left"></i>
                                </div>
                                <div class="attachment-more-narration-label">旁白</div>
                            </div>
                            <div class="attachment-more-dynamic-action-entry">
                                <div class="attachment-more-dynamic-action-icon">
                                    <i class="fas fa-running"></i>
                                </div>
                                <div class="attachment-more-dynamic-action-label">动描</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bottom Tabs (Floating Pill, Left Aligned, Tap to Select) -->
                <div class="sheet-tabs-container" style="position: absolute; bottom: 16px; left: 20px; right: 20px; border-radius: 40px; display: flex; padding: 10px 16px; overflow-x: auto; background: rgba(250, 250, 250, 0.75);    scrollbar-width: none; gap: 24px; align-items: center; justify-content: flex-start;">
                    <style>
                        #chat-attachment-sheet ::-webkit-scrollbar { display: none; }

                        .attachment-more-pay-entry,
                        .attachment-more-link-entry,
                        .attachment-more-voice-entry,
                        .attachment-more-listen-entry,
                        .attachment-more-narration-entry,
                        .attachment-more-dynamic-action-entry,
                        .attachment-more-offline-entry {
                            cursor: pointer;
                            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s;
                        }
                        .attachment-more-regenerate-entry {
                            cursor: pointer;
                            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s;
                        }
                        .attachment-more-pay-entry:active,
                        .attachment-more-link-entry:active,
                        .attachment-more-voice-entry:active,
                        .attachment-more-listen-entry:active,
                        .attachment-more-narration-entry:active,
                        .attachment-more-dynamic-action-entry:active,
                        .attachment-more-offline-entry:active {
                            transform: scale(0.85);
                            opacity: 0.7;
                        }
                        .attachment-more-regenerate-entry:active {
                            transform: scale(0.85);
                            opacity: 0.7;
                        }

                        .sheet-tab-item {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            gap: 3px;
                            min-width: 44px;
                            cursor: pointer;
                            transition: transform 0.2s, opacity 0.2s;
                            flex-shrink: 0;
                        }
                        .sheet-tab-icon {
                            font-size: 24px;
                            color: #8e8e93;
                            transition: color 0.2s, transform 0.2s;
                        }
                        .sheet-tab-text {
                            font-size: 10px;
                            color: #8e8e93;
                            font-weight: 500;
                            transition: color 0.2s;
                        }
                        .sheet-tab-item.active .sheet-tab-icon {
                            color: #007aff;
                            transform: scale(1.1);
                        }
                        .sheet-tab-item.active .sheet-tab-text {
                            color: #007aff;
                            font-weight: 600;
                        }
                        .sheet-stickers-list {
                            width: 100%;
                            flex: 1;
                            min-height: 0;
                            overflow-y: auto;
                            padding: 12px 14px 0;
                            box-sizing: border-box;
                        }
                        .sheet-sticker-category-tabs {
                            width: 100%;
                            display: flex;
                            gap: 8px;
                            overflow-x: auto;
                            padding: 0 14px 10px;
                            box-sizing: border-box;
                            border-bottom: 1px solid #f2f2f7;
                            flex-shrink: 0;
                        }
                        .sheet-sticker-category-tab {
                            height: 32px;
                            border: none;
                            border-radius: 999px;
                            background: #f7f7fa;
                            color: #636366;
                            padding: 0 13px;
                            font-size: 13px;
                            font-weight: 700;
                            white-space: nowrap;
                            cursor: pointer;
                            flex-shrink: 0;
                        }
                        .sheet-sticker-category-tab.active {
                            background: #111;
                            color: #fff;
                        }
                        .sheet-sticker-grid {
                            display: grid;
                            grid-template-columns: repeat(4, minmax(0, 1fr));
                            gap: 10px;
                        }
                        .sheet-sticker-item {
                            aspect-ratio: 1;
                            border: none;
                            border-radius: 14px;
                            background: #f7f7fa;
                            padding: 7px;
                            cursor: pointer;
                            overflow: hidden;
                        }
                        .sheet-sticker-item img {
                            width: 100%;
                            height: 100%;
                            object-fit: contain;
                            display: block;
                        }
                    </style>
                    
                    <div class="sheet-tab-item active" data-tab="gallery">
                        <i class="fas fa-image sheet-tab-icon"></i>
                        <span class="sheet-tab-text">Gallery</span>
                    </div>
                    <div class="sheet-tab-item" data-tab="file">
                        <i class="fas fa-user-friends sheet-tab-icon"></i>
                        <span class="sheet-tab-text">Friends</span>
                    </div>
                    <div class="sheet-tab-item" data-tab="location">
                        <i class="fas fa-map-marker-alt sheet-tab-icon"></i>
                        <span class="sheet-tab-text">Location</span>
                    </div>
                    <div class="sheet-tab-item" data-tab="stickers">
                        <i class="fas fa-smile sheet-tab-icon"></i>
                        <span class="sheet-tab-text">Stickers</span>
                    </div>
                    <div class="sheet-tab-item" data-tab="more">
                        <i class="fas fa-ellipsis-h sheet-tab-icon"></i>
                        <span class="sheet-tab-text">More</span>
                    </div>
                </div>
            </div>
            
            <!-- Pay Transfer Overlay moved to attachmentSheet root so it floats centrally and isn't cropped -->
            <div class="pay-transfer-form-overlay" style="position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,0.18); z-index: 20; padding: 20px;">
                <div class="pay-transfer-form-card" style="width: 100%; max-width: 348px; border-radius: 30px; background: rgba(255,255,255,0.98);  padding: 18px 16px 16px; box-sizing: border-box;  ">
                    <div class="pay-transfer-form-title" style="font-size: 18px; font-weight: 800; color: #111; text-align: center; margin-bottom: 10px;">Pay</div>
                    <div class="pay-transfer-mode-tabs" style="display: flex; justify-content: center; gap: 22px; margin-bottom: 14px; border-bottom: 1px solid rgba(0,0,0,0.08);">
                        <button type="button" class="pay-mode-tab active" data-pay-mode="transfer" style="position: relative; border: none; background: none; color: #000; font-size: 15px; font-weight: 600; padding: 0 2px 10px; cursor: pointer;">转账</button>
                        <button type="button" class="pay-mode-tab" data-pay-mode="red_packet" style="position: relative; border: none; background: none; color: #8e8e93; font-size: 15px; font-weight: 600; padding: 0 2px 10px; cursor: pointer;">红包</button>
                    </div>

                    <div class="pay-mode-panel pay-mode-panel-transfer" style="display: block;">
                        <div class="pay-form-field" style="margin-bottom: 10px;">
                            <div style="font-size: 12px; color: #8e8e93; margin-bottom: 6px;">金额</div>
                            <input type="number" class="pay-transfer-amount-input" placeholder="金额，例如 88.88" min="0" step="0.01" style="width: 100%; height: 42px; border: none; border-radius: 16px; background: #f7f7fa; padding: 0 14px; box-sizing: border-box; font-size: 14px; color: #111;">
                        </div>
                        <div class="pay-form-field" style="margin-bottom: 10px;">
                            <div style="font-size: 12px; color: #8e8e93; margin-bottom: 6px;">描述</div>
                            <input type="text" class="pay-transfer-desc-input" placeholder="描述，例如 奶茶钱 / 晚餐AA" style="width: 100%; height: 42px; border: none; border-radius: 16px; background: #f7f7fa; padding: 0 14px; box-sizing: border-box; font-size: 14px; color: #111;">
                        </div>
                        <div class="pay-form-field pay-group-recipient-field" style="display: none; margin-bottom: 6px; position: relative;">
                            <div style="font-size: 12px; color: #8e8e93; margin-bottom: 8px;">转账给谁</div>
                            <button type="button" class="pay-group-recipient-trigger" style="width: 100%; height: 48px; border: none; border-radius: 16px; background: #f7f7fa; padding: 0 14px; display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                                    <div class="pay-group-recipient-avatar" style="width: 28px; height: 28px; border-radius: 50%; overflow: hidden; background: #e5e5ea; color: #8e8e93; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px;">
                                        <i class="fas fa-user"></i>
                                    </div>
                                    <div class="pay-group-recipient-label" style="font-size: 14px; color: #111; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">请选择群成员</div>
                                </div>
                                <i class="fas fa-chevron-down pay-group-recipient-arrow" style="font-size: 12px; color: #8e8e93;"></i>
                            </button>
                            <div class="pay-group-recipient-dropdown" style="display: none; margin-top: 8px; border-radius: 18px; background: #fff;  padding: 8px; max-height: 220px; overflow-y: auto;"></div>
                        </div>
                    </div>

                    <div class="pay-mode-panel pay-mode-panel-red-packet" style="display: none;">
                        <div class="pay-form-field" style="margin-bottom: 10px;">
                            <div style="font-size: 12px; color: #8e8e93; margin-bottom: 6px;">红包个数</div>
                            <input type="number" class="pay-red-packet-count-input" placeholder="例如 3" min="1" step="1" style="width: 100%; height: 42px; border: none; border-radius: 16px; background: #f7f7fa; padding: 0 14px; box-sizing: border-box; font-size: 14px; color: #111;">
                        </div>
                        <div class="pay-form-field" style="margin-bottom: 10px;">
                            <div style="font-size: 12px; color: #8e8e93; margin-bottom: 6px;">总金额</div>
                            <input type="number" class="pay-red-packet-amount-input" placeholder="总金额，例如 88.88" min="0" step="0.01" style="width: 100%; height: 42px; border: none; border-radius: 16px; background: #f7f7fa; padding: 0 14px; box-sizing: border-box; font-size: 14px; color: #111;">
                        </div>
                        <div class="pay-form-field" style="margin-bottom: 6px;">
                            <div style="font-size: 12px; color: #8e8e93; margin-bottom: 6px;">描述</div>
                            <input type="text" class="pay-red-packet-desc-input" placeholder="描述，例如 恭喜发财 / 今晚奶茶" style="width: 100%; height: 42px; border: none; border-radius: 16px; background: #f7f7fa; padding: 0 14px; box-sizing: border-box; font-size: 14px; color: #111;">
                        </div>
                    </div>

                    <div class="pay-transfer-form-actions" style="display: flex; gap: 4px; margin-top: 16px;">
                        <div class="pay-transfer-cancel-btn" style="flex: 1; height: 44px; border-radius: 16px; background: #f2f2f7; color: #666; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; cursor: pointer;">取消</div>
                        <div class="pay-transfer-submit-btn" style="flex: 1; height: 44px; border-radius: 16px; background: #111; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 800; cursor: pointer;">发送</div>
                    </div>
                </div>
            </div>
            <div class="voice-message-form-overlay" style="position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,0.18); z-index: 21; padding: 20px;">
                <div class="voice-message-form-card" style="width: 100%; max-width: 348px; border-radius: 30px; background: rgba(255,255,255,0.98);  padding: 18px 16px 16px; box-sizing: border-box;  ">
                    <div style="display:flex; align-items:center; justify-content:center; gap:8px; font-size:18px; font-weight:800; color:#111; text-align:center; margin-bottom:12px;">
                        <i class="fas fa-microphone-alt" style="color:#111;"></i>
                        <span>Voice</span>
                    </div>
                    <textarea class="voice-message-transcript-input" placeholder="输入语音内容..." style="width:100%; min-height:112px; max-height:180px; resize:none; border:none; outline:none; border-radius:20px; background:#f7f7fa; padding:13px 14px; box-sizing:border-box; font-size:15px; line-height:1.45; color:#111; font-family:inherit;"></textarea>
                    <div style="font-size:12px; color:#8e8e93; line-height:1.45; margin:10px 2px 0;">将以语音气泡发送，并把这段文字作为转文字内容给 AI。</div>
                    <div class="voice-message-form-actions" style="display:flex; gap:8px; margin-top:16px;">
                        <div class="voice-message-cancel-btn" style="flex:1; height:44px; border-radius:16px; background:#f2f2f7; color:#666; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700; cursor:pointer;">取消</div>
                        <div class="voice-message-submit-btn" style="flex:1; height:44px; border-radius:16px; background:#111; color:#fff; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:800; cursor:pointer;">发送</div>
                    </div>
                </div>
            </div>
            <div class="narration-form-overlay" style="position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,0.18); z-index: 22; padding: 20px;">
                <div class="narration-form-card" style="width: 100%; max-width: 348px; border-radius: 30px; background: rgba(255,255,255,0.98); padding: 18px 16px 16px; box-sizing: border-box;">
                    <div style="display:flex; align-items:center; justify-content:center; gap:8px; font-size:18px; font-weight:800; color:#111; text-align:center; margin-bottom:12px;">
                        <i class="fas fa-quote-left" style="color:#5856d6;"></i>
                        <span>旁白</span>
                    </div>
                    <textarea class="narration-message-input" placeholder="输入旁白，例如：窗外雨声慢慢停了" style="width:100%; min-height:120px; max-height:200px; resize:none; border:none; outline:none; border-radius:20px; background:#f7f7fa; padding:13px 14px; box-sizing:border-box; font-size:15px; line-height:1.45; color:#111; font-family:inherit;"></textarea>
                    <div style="font-size:12px; color:#8e8e93; line-height:1.45; margin:10px 2px 0;">会作为居中事件进入聊天上下文，不会自动触发 AI。</div>
                    <div class="narration-form-actions" style="display:flex; gap:8px; margin-top:16px;">
                        <div class="narration-cancel-btn" style="flex:1; height:44px; border-radius:16px; background:#f2f2f7; color:#666; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700; cursor:pointer;">取消</div>
                        <div class="narration-submit-btn" style="flex:1; height:44px; border-radius:16px; background:#111; color:#fff; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:800; cursor:pointer;">发送</div>
                    </div>
                </div>
            </div>
            <div class="regenerate-form-overlay" style="position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,0.18); z-index: 23; padding: 20px;">
                <div class="regenerate-form-card" style="width: 100%; max-width: 348px; border-radius: 30px; background: rgba(255,255,255,0.98); padding: 18px 16px 16px; box-sizing: border-box;">
                    <div style="display:flex; align-items:center; justify-content:center; gap:8px; font-size:18px; font-weight:800; color:#111; text-align:center; margin-bottom:12px;">
                        <i class="fas fa-rotate-left" style="color:#8e8e93;"></i>
                        <span>重回上一轮回复</span>
                    </div>
                    <textarea class="regenerate-requirement-input" placeholder="可以写为什么重回，或希望 TA 怎样回复。例如：角色ooc了，注意人设" style="width:100%; min-height:120px; max-height:200px; resize:none; border:none; outline:none; border-radius:20px; background:#f7f7fa; padding:13px 14px; box-sizing:border-box; font-size:15px; line-height:1.45; color:#111; font-family:inherit;"></textarea>
                    <div style="font-size:12px; color:#8e8e93; line-height:1.45; margin:10px 2px 0;">参考：按上方要求重回生成；重回：不带要求直接重回。</div>
                    <div class="regenerate-form-actions" style="display:flex; gap:8px; margin-top:16px;">
                        <div class="regenerate-reference-btn" style="flex:1; height:44px; border-radius:16px; background:#8e8e93; color:#fff; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:800; cursor:pointer;">参考</div>
                        <div class="regenerate-direct-btn" style="flex:1; height:44px; border-radius:16px; background:#111; color:#fff; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:800; cursor:pointer;">重回</div>
                    </div>
                </div>
            </div>
        `;
        page.appendChild(attachmentSheet);

        const overlay = attachmentSheet.querySelector('.sheet-overlay');
        const content = attachmentSheet.querySelector('.sheet-content');
        const closeBtn = attachmentSheet.querySelector('.close-sheet-btn');
        const tabsContainer = attachmentSheet.querySelector('.sheet-tabs-container');
        const tabItems = attachmentSheet.querySelectorAll('.sheet-tab-item');
        const payEntry = attachmentSheet.querySelector('.attachment-more-pay-entry');
        const linkEntry = attachmentSheet.querySelector('.attachment-more-link-entry');
        const regenerateEntry = attachmentSheet.querySelector('.attachment-more-regenerate-entry');
        const voiceEntry = attachmentSheet.querySelector('.attachment-more-voice-entry');
        const listenEntry = attachmentSheet.querySelector('.attachment-more-listen-entry');
        const narrationEntry = attachmentSheet.querySelector('.attachment-more-narration-entry');
        const dynamicActionEntry = attachmentSheet.querySelector('.attachment-more-dynamic-action-entry');
        const dynamicActionLabel = attachmentSheet.querySelector('.attachment-more-dynamic-action-label');
        const offlineEntry = attachmentSheet.querySelector('.attachment-more-offline-entry');
        const offlineLabel = attachmentSheet.querySelector('.attachment-more-offline-label');
        const payFormOverlay = attachmentSheet.querySelector('.pay-transfer-form-overlay');
        const voiceFormOverlay = attachmentSheet.querySelector('.voice-message-form-overlay');
        const voiceTranscriptInput = attachmentSheet.querySelector('.voice-message-transcript-input');
        const voiceCancelBtn = attachmentSheet.querySelector('.voice-message-cancel-btn');
        const voiceSubmitBtn = attachmentSheet.querySelector('.voice-message-submit-btn');
        const narrationFormOverlay = attachmentSheet.querySelector('.narration-form-overlay');
        const narrationInput = attachmentSheet.querySelector('.narration-message-input');
        const narrationCancelBtn = attachmentSheet.querySelector('.narration-cancel-btn');
        const narrationSubmitBtn = attachmentSheet.querySelector('.narration-submit-btn');
        const regenerateFormOverlay = attachmentSheet.querySelector('.regenerate-form-overlay');
        const regenerateRequirementInput = attachmentSheet.querySelector('.regenerate-requirement-input');
        const regenerateReferenceBtn = attachmentSheet.querySelector('.regenerate-reference-btn');
        const regenerateDirectBtn = attachmentSheet.querySelector('.regenerate-direct-btn');
        const stickersList = attachmentSheet.querySelector('.sheet-stickers-list');
        const stickerCategoryTabs = attachmentSheet.querySelector('.sheet-sticker-category-tabs');
        const payAmountInput = attachmentSheet.querySelector('.pay-transfer-amount-input');
        const payDescInput = attachmentSheet.querySelector('.pay-transfer-desc-input');
        const payCancelBtn = attachmentSheet.querySelector('.pay-transfer-cancel-btn');
        const paySubmitBtn = attachmentSheet.querySelector('.pay-transfer-submit-btn');
        const payModeTabs = attachmentSheet.querySelectorAll('.pay-mode-tab');
        const payTransferPanel = attachmentSheet.querySelector('.pay-mode-panel-transfer');
        const payRedPacketPanel = attachmentSheet.querySelector('.pay-mode-panel-red-packet');
        const payRecipientField = attachmentSheet.querySelector('.pay-group-recipient-field');
        const payRecipientTrigger = attachmentSheet.querySelector('.pay-group-recipient-trigger');
        const payRecipientAvatar = attachmentSheet.querySelector('.pay-group-recipient-avatar');
        const payRecipientLabel = attachmentSheet.querySelector('.pay-group-recipient-label');
        const payRecipientArrow = attachmentSheet.querySelector('.pay-group-recipient-arrow');
        const payRecipientDropdown = attachmentSheet.querySelector('.pay-group-recipient-dropdown');
        const payRedPacketCountInput = attachmentSheet.querySelector('.pay-red-packet-count-input');
        const payRedPacketAmountInput = attachmentSheet.querySelector('.pay-red-packet-amount-input');
        const payRedPacketDescInput = attachmentSheet.querySelector('.pay-red-packet-desc-input');
        const linkedAccountsEmpty = attachmentSheet.querySelector('.linked-accounts-empty');
        const linkedAccountsControls = attachmentSheet.querySelector('.linked-accounts-controls');
        const linkedAccountsToggle = attachmentSheet.querySelector('.linked-accounts-toggle');
        const linkedAccountsIntervalRow = attachmentSheet.querySelector('.linked-accounts-interval-row');
        const linkedAccountsIntervalInput = attachmentSheet.querySelector('.linked-accounts-interval-input');
        const linkedAccountsStatus = attachmentSheet.querySelector('.linked-accounts-status');
        const linkedAccountsList = attachmentSheet.querySelector('.linked-accounts-list');

        const sheetViews = attachmentSheet.querySelectorAll('.sheet-view');
        let currentPayMode = 'transfer';
        let selectedRecipientId = null;
        let activeStickerCategoryName = '';
        let linkedAccountTimer = null;
        let linkedAccountTimerFriendId = null;
        let linkedAccountTimerIntervalMs = 0;

        const escapeSheetHtml = (value) => String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        const offlineSpeechRuntimeStore = new Map();
        const offlineBarrageRuntimeStore = new Map();
        const offlineChoiceRuntimeStore = new Map();

        const parseOfflineTagAttributes = (value) => {
            const attrs = {};
            String(value || '').replace(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g, (_, key, raw, doubleValue, singleValue, bareValue) => {
                attrs[String(key || '').toLowerCase()] = doubleValue ?? singleValue ?? bareValue ?? '';
                return '';
            });
            return attrs;
        };

        const isLikelyChineseText = (value) => /[\u3400-\u9fff]/.test(String(value || ''));

        const wrapOfflineSpeechDisplayText = (value) => {
            const text = String(value || '').trim();
            if (!text) return '';
            if (text.startsWith('「') && text.endsWith('」')) return text;
            return `「${text}」`;
        };

        const getOfflineSpeechDisplayText = (original, translation = '') => {
            const source = String(original || '').trim();
            const translated = String(translation || '').trim();
            if (!source) return '';
            if (translated && translated !== source && !isLikelyChineseText(source)) {
                return wrapOfflineSpeechDisplayText(`${source}（${translated}）`);
            }
            return wrapOfflineSpeechDisplayText(source);
        };

        const normalizeOfflineSectionHeading = (value) => String(value || '').trim().replace(/[ \t]/g, '');

        const isOfflineSectionHeading = (line, names) => {
            const normalized = normalizeOfflineSectionHeading(line);
            return names.some(name => (
                normalized === `【${name}】` ||
                normalized === `[${name}]` ||
                normalized === `${name}:` ||
                normalized === `${name}：`
            ));
        };

        const isOfflineBarrageSectionHeading = (line) => isOfflineSectionHeading(line, ['弹幕', '弹幕评论', '观众弹幕']);
        const isOfflineChoiceSectionHeading = (line) => isOfflineSectionHeading(line, ['选项', '玩家选项', '后续选项', '可选行动', '选择']);

        const normalizeOfflineListLine = (value) => String(value || '')
            .replace(/<[^>]+>/g, '')
            .replace(/^[\s\-*•·]+/, '')
            .replace(/^(?:\d+|[①②③④⑤⑥⑦⑧⑨]|[A-Za-z])[\).、:：-]?\s*/, '')
            .trim();

        const getOfflineBarrageRandomLikes = () => Math.floor(Math.random() * 999) + 1;

        const parseOfflineBarrageTextBlock = (value) => String(value || '')
            .split(/\r?\n/)
            .map(line => normalizeOfflineListLine(line))
            .filter(Boolean)
            .map((line, index) => {
                const match = line.match(/^([^:：|]{1,16})[:：|]\s*(.*?)\s*(?:\|\s*(\d+)\s*)?$/);
                if (match && match[2]) {
                    return {
                        name: match[1].trim() || `观众${index + 1}`,
                        text: match[2].trim(),
                        likes: getOfflineBarrageRandomLikes()
                    };
                }
                return {
                    name: `观众${index + 1}`,
                    text: line,
                    likes: getOfflineBarrageRandomLikes()
                };
            })
            .filter(item => item.text);

        const parseOfflineBarrageBlocks = (value) => {
            const barragesByParagraph = [];
            const plainBarrageSections = [];
            const cleanText = String(value || '').replace(/<barrages?\b[^>]*>([\s\S]*?)<\/barrages?>/gi, (fullMatch, body) => {
                const items = [];
                String(body || '').replace(/<barrage\b([^>]*)>([\s\S]*?)<\/barrage>/gi, (_, attrText, commentText) => {
                    const attrs = parseOfflineTagAttributes(attrText);
                    const name = String(attrs.name || attrs.user || attrs.author || '观众').trim() || '观众';
                    const text = String(commentText || attrs.text || '').replace(/<[^>]+>/g, '').trim();
                    const likes = getOfflineBarrageRandomLikes();
                    if (text) items.push({ name, text, likes });
                    return '';
                });

                if (items.length === 0) {
                    String(body || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).forEach((line) => {
                        const match = line.match(/^([^:：|]+)[:：|]\s*(.*?)\s*(?:\|\s*(\d+)\s*)?$/);
                        if (match) {
                            items.push({
                                name: match[1].trim() || '观众',
                                text: match[2].trim(),
                                likes: getOfflineBarrageRandomLikes()
                            });
                        }
                    });
                }

                barragesByParagraph.push(items);
                return '\n\n';
            });

            const keptLines = [];
            let captureBuffer = null;
            const flushPlainBarrage = () => {
                if (!captureBuffer) return;
                const items = parseOfflineBarrageTextBlock(captureBuffer.join('\n'));
                if (items.length > 0) plainBarrageSections.push(items);
                captureBuffer = null;
            };

            cleanText.split(/\r?\n/).forEach((line) => {
                if (isOfflineBarrageSectionHeading(line)) {
                    flushPlainBarrage();
                    captureBuffer = [];
                    return;
                }

                if (captureBuffer && isOfflineChoiceSectionHeading(line)) {
                    flushPlainBarrage();
                    keptLines.push(line);
                    return;
                }

                if (captureBuffer) {
                    captureBuffer.push(line);
                    return;
                }

                keptLines.push(line);
            });
            flushPlainBarrage();

            return {
                cleanText: keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
                barragesByParagraph,
                plainBarrageSections
            };
        };

        const normalizeOfflineChoiceText = (value) => normalizeOfflineListLine(value)
            .replace(/^(?:选项|选择|Choice)\s*\d*\s*[:：.、-]?\s*/i, '')
            .trim();

        const parseOfflineChoiceBlocks = (value) => {
            let choices = [];
            let cleanText = String(value || '').replace(/<choices?\b[^>]*>([\s\S]*?)<\/choices?>/gi, (fullMatch, body) => {
                const parsed = [];
                String(body || '').replace(/<choice\b[^>]*>([\s\S]*?)<\/choice>/gi, (_, choiceText) => {
                    const cleanChoice = normalizeOfflineChoiceText(choiceText);
                    if (cleanChoice) parsed.push(cleanChoice);
                    return '';
                });

                if (parsed.length === 0) {
                    String(body || '').split(/\r?\n/).forEach((line) => {
                        const cleanChoice = normalizeOfflineChoiceText(line);
                        if (cleanChoice) parsed.push(cleanChoice);
                    });
                }

                choices = choices.concat(parsed);
                return '\n\n';
            });

            const keptLines = [];
            const plainChoices = [];
            let captureBuffer = null;
            const flushPlainChoices = () => {
                if (!captureBuffer) return;
                captureBuffer
                    .map(line => normalizeOfflineChoiceText(line))
                    .filter(Boolean)
                    .forEach(choice => plainChoices.push(choice));
                captureBuffer = null;
            };

            cleanText.split(/\r?\n/).forEach((line) => {
                if (isOfflineChoiceSectionHeading(line)) {
                    flushPlainChoices();
                    captureBuffer = [];
                    return;
                }

                if (captureBuffer && isOfflineBarrageSectionHeading(line)) {
                    flushPlainChoices();
                    keptLines.push(line);
                    return;
                }

                if (captureBuffer) {
                    captureBuffer.push(line);
                    return;
                }

                keptLines.push(line);
            });
            flushPlainChoices();

            if (plainChoices.length > 0) {
                choices = choices.concat(plainChoices);
                cleanText = keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
            }

            if (choices.length === 0) {
                const fallbackMatch = cleanText.match(/(?:^|\n)\s*(?:玩家选项|可选行动|后续选项|选项|选择)\s*[:：]\s*\n([\s\S]*?)$/);
                if (fallbackMatch) {
                    const block = fallbackMatch[1] || '';
                    const parsed = block.split(/\r?\n/)
                        .map(line => normalizeOfflineChoiceText(line))
                        .filter(Boolean);
                    if (parsed.length > 0) {
                        choices = parsed;
                        cleanText = cleanText.slice(0, fallbackMatch.index).trim();
                    }
                }
            }

            if (choices.length === 0) {
                const lines = cleanText.split(/\r?\n/);
                const tail = [];
                for (let i = lines.length - 1; i >= 0 && tail.length < 5; i -= 1) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    if (/^(?:\d+|[①②③④⑤⑥⑦⑧⑨]|[A-Ca-c])[\).、:：-]\s*\S+/.test(line)) {
                        tail.unshift({ index: i, value: normalizeOfflineChoiceText(line) });
                    } else {
                        break;
                    }
                }
                if (tail.length >= 2) {
                    choices = tail.map(item => item.value).filter(Boolean);
                    const firstIndex = tail[0].index;
                    cleanText = lines.slice(0, firstIndex).join('\n').trim();
                }
            }

            return {
                cleanText,
                choices: choices.map(choice => choice.trim()).filter(Boolean).slice(0, 3)
            };
        };

        const stripOfflineDecorativeMarkup = (value) => {
            let text = String(value == null ? '' : value).replace(/\r\n/g, '\n');
            text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
            text = parseOfflineBarrageBlocks(text).cleanText;
            text = parseOfflineChoiceBlocks(text).cleanText;
            text = text.replace(/<speech\b([^>]*)>([\s\S]*?)<\/speech>/gi, (_, attrText, innerText) => {
                const attrs = parseOfflineTagAttributes(attrText);
                const original = attrs.original || attrs.text || String(innerText || '').trim();
                const translation = attrs.translation || attrs.zh || attrs.cn || '';
                return getOfflineSpeechDisplayText(original, translation);
            });
            text = text.replace(/<speech\b([^>]*)\/>/gi, (_, attrText) => {
                const attrs = parseOfflineTagAttributes(attrText);
                return getOfflineSpeechDisplayText(attrs.original || attrs.text || '', attrs.translation || attrs.zh || attrs.cn || '');
            });
            text = text.replace(/<\/?paragraph\b[^>]*>/gi, '\n\n');
            return text.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
        };

        const renderOfflinePlainTextWithFallbackSpeech = (value, speechItems, enableVoice, allowFallbackSpeech) => {
            const text = String(value || '');
            if (!enableVoice || !allowFallbackSpeech) {
                return escapeSheetHtml(text).replace(/\n/g, '<br>');
            }

            const quoteRegex = /「([^」\n]{1,180})」|“([^”\n]{1,180})”|"([^"\n]{1,180})"/g;
            let html = '';
            let lastIndex = 0;
            let match = null;
            while ((match = quoteRegex.exec(text)) !== null) {
                const original = String(match[1] || match[2] || match[3] || '').trim();
                if (!original) continue;
                html += escapeSheetHtml(text.slice(lastIndex, match.index)).replace(/\n/g, '<br>');
                const speechIndex = speechItems.length;
                speechItems.push({ original, translation: '' });
                html += `<span class="offline-tavern-speech">${escapeSheetHtml(match[0])}<button type="button" class="offline-tavern-voice-btn" data-offline-speech-index="${speechIndex}" title="播放语音" aria-label="播放语音"><i class="fas fa-volume-up"></i></button></span>`;
                lastIndex = match.index + match[0].length;
            }
            html += escapeSheetHtml(text.slice(lastIndex)).replace(/\n/g, '<br>');
            return html;
        };

        const renderOfflineParagraphText = (value, speechItems, enableVoice) => {
            const text = String(value || '');
            const speechRegex = /<speech\b([^>]*?)>([\s\S]*?)<\/speech>|<speech\b([^>]*?)\/>/gi;
            let html = '';
            let lastIndex = 0;
            let hasExplicitSpeech = false;
            let match = null;

            while ((match = speechRegex.exec(text)) !== null) {
                hasExplicitSpeech = true;
                html += renderOfflinePlainTextWithFallbackSpeech(text.slice(lastIndex, match.index), speechItems, enableVoice, false);
                const attrText = match[1] || match[3] || '';
                const attrs = parseOfflineTagAttributes(attrText);
                const innerText = String(match[2] || '').replace(/<[^>]+>/g, '').trim();
                const original = String(attrs.original || attrs.text || innerText || '').trim();
                const translation = String(attrs.translation || attrs.zh || attrs.cn || '').trim();
                const displayText = getOfflineSpeechDisplayText(original, translation);

                if (displayText) {
                    const speechIndex = speechItems.length;
                    speechItems.push({ original, translation });
                    html += `<span class="offline-tavern-speech">${escapeSheetHtml(displayText)}${enableVoice ? `<button type="button" class="offline-tavern-voice-btn" data-offline-speech-index="${speechIndex}" title="播放语音" aria-label="播放语音"><i class="fas fa-volume-up"></i></button>` : ''}</span>`;
                }
                lastIndex = match.index + match[0].length;
            }

            html += renderOfflinePlainTextWithFallbackSpeech(text.slice(lastIndex), speechItems, enableVoice, !hasExplicitSpeech);
            return html;
        };

        const buildOfflineTavernTextHtml = (value, options = {}) => {
            const messageId = options.messageId ? String(options.messageId) : '';
            const enableVoice = options.enableVoice !== false;
            const enableBarrage = !!options.enableBarrage;
            const enableChoices = !!options.enableChoices;
            const text = String(value == null ? '' : value).replace(/\r\n/g, '\n').trim();
            if (!text) {
                if (messageId) {
                    offlineSpeechRuntimeStore.delete(messageId);
                    offlineBarrageRuntimeStore.delete(messageId);
                    offlineChoiceRuntimeStore.delete(messageId);
                }
                return '';
            }

            const speechItems = [];
            const { cleanText, barragesByParagraph, plainBarrageSections } = parseOfflineBarrageBlocks(text);
            const choiceParseResult = parseOfflineChoiceBlocks(cleanText);
            const choices = choiceParseResult.choices;
            const normalizedText = choiceParseResult.cleanText
                .replace(/<paragraph\b[^>]*>/gi, '')
                .replace(/<\/paragraph>/gi, '\n\n')
                .trim();
            const paragraphs = normalizedText
                .split(/\n{2,}/)
                .map(part => part.trim())
                .filter(Boolean);
            const allBarrageItems = []
                .concat(...barragesByParagraph.map(items => Array.isArray(items) ? items : []))
                .concat(...(plainBarrageSections || []).map(items => Array.isArray(items) ? items : []))
                .filter(item => item && item.text);

            if (messageId) {
                offlineBarrageRuntimeStore.set(messageId, [allBarrageItems]);
                offlineChoiceRuntimeStore.set(messageId, choices);
            }

            const paragraphHtml = paragraphs
                .map((part, index) => {
                    const paragraphHtml = renderOfflineParagraphText(part, speechItems, enableVoice);
                    return `<div class="offline-tavern-paragraph-wrap"><p class="offline-tavern-paragraph">${paragraphHtml}</p></div>`;
                })
                .join('');
            const barrageButtonHtml = enableBarrage && allBarrageItems.length > 0
                ? `<button type="button" class="offline-tavern-barrage-btn offline-tavern-barrage-final-btn" data-offline-barrage-index="0" title="查看弹幕" aria-label="查看弹幕"><i class="fas fa-comment-dots"></i><span>${allBarrageItems.length}</span></button>`
                : '';
            const choiceHtml = enableChoices && choices.length > 0
                ? `<div class="offline-tavern-choice-list">${choices.map((choice, index) => `<button type="button" class="offline-tavern-choice-btn" data-offline-choice-index="${index}"><span class="offline-tavern-choice-index">${index + 1}</span><span class="offline-tavern-choice-text">${escapeSheetHtml(choice)}</span></button>`).join('')}</div>`
                : '';
            const html = paragraphHtml + barrageButtonHtml + choiceHtml;

            if (messageId) {
                offlineSpeechRuntimeStore.set(messageId, speechItems);
            }
            return html;
        };

        const OFFLINE_ACTIVE_NOTICE_KIND = 'offline_meeting_active';
        const OFFLINE_MEETING_RECORD_TYPE = 'offline_meeting_record';

        const bindOfflineTavernTextControls = (bubbleDiv, message, friend, floor) => {
            if (!bubbleDiv || !message?.id) return;
            const messageId = String(message.id);

            bubbleDiv.querySelectorAll('.offline-tavern-voice-btn').forEach((button) => {
                if (button.dataset.bound === 'true') return;
                button.dataset.bound = 'true';
                button.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const speechIndex = Number(button.getAttribute('data-offline-speech-index'));
                    const speeches = offlineSpeechRuntimeStore.get(messageId) || [];
                    const speech = speeches[speechIndex];
                    const originalText = String(speech?.original || '').trim();
                    if (!originalText) return;

                    if (!window.u2MinimaxTts || typeof window.u2MinimaxTts.speakTextCached !== 'function') {
                        if (window.showToast) window.showToast('Minimax 语音不可用');
                        return;
                    }

                    button.style.opacity = '0.45';
                    button.style.pointerEvents = 'none';
                    try {
                        await window.u2MinimaxTts.speakTextCached(originalText, friend, speech);
                    } catch (error) {
                        console.error('Offline speech playback failed', error);
                        if (window.showToast) window.showToast('语音播放失败');
                    } finally {
                        button.style.opacity = '';
                        button.style.pointerEvents = '';
                    }
                });
            });

            bubbleDiv.querySelectorAll('.offline-tavern-barrage-btn').forEach((button) => {
                if (button.dataset.bound === 'true') return;
                button.dataset.bound = 'true';
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const paragraphIndex = Number(button.getAttribute('data-offline-barrage-index')) || 0;
                    openOfflineBarrageView({
                        messageId,
                        paragraphIndex,
                        floor,
                        barrages: (offlineBarrageRuntimeStore.get(messageId) || [])[paragraphIndex] || []
                    });
                });
            });

            bubbleDiv.querySelectorAll('.offline-tavern-choice-btn').forEach((button) => {
                if (button.dataset.bound === 'true') return;
                button.dataset.bound = 'true';
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const choiceIndex = Number(button.getAttribute('data-offline-choice-index')) || 0;
                    const choices = offlineChoiceRuntimeStore.get(messageId) || [];
                    const choiceText = String(choices[choiceIndex] || '').trim();
                    const input = document.getElementById('offline-tavern-input');
                    if (!choiceText || !input) return;
                    input.value = choiceText;
                    input.focus();
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    const view = document.getElementById('offline-tavern-view');
                    const contentArea = document.getElementById('offline-tavern-content');
                    if (view && contentArea) contentArea.scrollTop = contentArea.scrollHeight;
                });
            });
        };

        const isOfflineBarragePromptEnabled = (friend) => {
            if (!friend) return false;
            const prompts = normalizeOfflinePrompts(Array.isArray(friend.offlinePrompts) ? friend.offlinePrompts : []);
            return prompts.some(prompt => prompt.id === 'barrage_comments' && (prompt.alwaysEnabled || prompt.enabled));
        };

        const isOfflineChoicesPromptEnabled = (friend) => {
            if (!friend) return true;
            const prompts = normalizeOfflinePrompts(Array.isArray(friend.offlinePrompts) ? friend.offlinePrompts : []);
            return prompts.some(prompt => prompt.id === 'player_choices' && (prompt.alwaysEnabled || prompt.enabled));
        };

        const createOfflineTavernId = (prefix = 'offline') => {
            if (window.imChat?.createMessageId) return window.imChat.createMessageId(prefix);
            return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        };

        const estimateOfflineTextTokens = (value) => {
            const text = stripOfflineDecorativeMarkup(value).trim();
            if (!text) return 0;
            if (typeof window.calculateTokens === 'function') {
                try {
                    return Math.max(1, Number(window.calculateTokens([{ title: '', keyword: '', content: text }])) || 0);
                } catch (error) {
                    console.warn('Offline token estimate failed', error);
                }
            }
            return Math.max(1, Math.ceil(text.length * 0.75));
        };

        const countOfflineTextCharacters = (value) => {
            const text = stripOfflineDecorativeMarkup(value).replace(/\s+/g, '');
            return text.length;
        };

        const formatOfflineBubbleTime = (timestamp) => {
            const date = new Date(Number(timestamp) || Date.now());
            const pad = (num) => String(num).padStart(2, '0');
            return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
        };

        const formatOfflineMeetingDate = (timestamp) => {
            const date = new Date(Number(timestamp) || Date.now());
            const pad = (num) => String(num).padStart(2, '0');
            return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        };

        const cloneOfflineMeetingMessages = (messages) => (Array.isArray(messages) ? messages : []).map((message, index) => ({
            id: message?.id || createOfflineTavernId(message?.role === 'assistant' ? 'offline-ai' : 'offline-user'),
            role: message?.role === 'assistant' ? 'assistant' : 'user',
            content: String(message?.content || ''),
            timestamp: Number(message?.timestamp) || Date.now() + index,
            tokens: message?.role === 'assistant' ? Math.max(0, Number(message?.tokens) || estimateOfflineTextTokens(message?.content || '')) : undefined,
            updatedAt: message?.updatedAt || undefined,
            offlineRegexAppliedRevisions: offlineRegexEngine?.normalizeAppliedRevisions(message?.offlineRegexAppliedRevisions) || {}
        }));

        const serializeOfflineMessagesForCompare = (messages) => JSON.stringify((messages || []).map(message => ({
            id: message.id,
            role: message.role,
            content: message.content,
            timestamp: message.timestamp,
            tokens: message.tokens || 0,
            updatedAt: message.updatedAt || '',
            offlineRegexAppliedRevisions: message.offlineRegexAppliedRevisions || {}
        })));

        const getOfflineRegexScripts = (activeFriend) => offlineRegexEngine
            ? offlineRegexEngine.normalizeRules(activeFriend?.offlineRegexScripts)
            : [];

        const applyOfflineRegexText = (activeFriend, text, role, depth, channel) => offlineRegexEngine
            ? offlineRegexEngine.applyRules(text, {
                rules: getOfflineRegexScripts(activeFriend),
                role,
                depth,
                channel
            })
            : String(text || '');

        const applyOfflineStreamingRegexText = (activeFriend, text, role, depth) => {
            const storagePreview = applyOfflineRegexText(activeFriend, text, role, depth, 'storage');
            return applyOfflineRegexText(activeFriend, storagePreview, role, depth, 'display');
        };

        const normalizeOfflineMessagesForFriend = (activeFriend) => {
            if (!activeFriend) return [];
            const previous = Array.isArray(activeFriend.offlineMessages) ? activeFriend.offlineMessages : [];
            let normalized = cloneOfflineMeetingMessages(previous);
            if (offlineRegexEngine) {
                normalized = offlineRegexEngine.applyStorageRules(normalized, getOfflineRegexScripts(activeFriend));
            }
            if (serializeOfflineMessagesForCompare(previous) !== serializeOfflineMessagesForCompare(normalized)) {
                activeFriend.offlineMessages = normalized;
                commitSheetFriendChange(activeFriend, (targetFriend) => {
                    targetFriend.offlineMessages = normalized;
                }, { silent: true, metaOnly: true });
            }
            return normalized;
        };

        const normalizeOfflineMeetingSessions = (activeFriend) => {
            if (!activeFriend) return [];
            const sessions = Array.isArray(activeFriend.offlineMeetingSessions) ? activeFriend.offlineMeetingSessions : [];
            const normalized = sessions.map((session, index) => {
                const messages = cloneOfflineMeetingMessages(session?.messages || []);
                const startedAt = Number(session?.startedAt) || (messages[0]?.timestamp || Date.now() + index);
                const endedAt = Number(session?.endedAt) || startedAt;
                return {
                    id: session?.id || createOfflineTavernId('offline-session'),
                    startedAt,
                    endedAt,
                    messages,
                    dateText: session?.dateText || formatOfflineMeetingDate(endedAt),
                    title: session?.title || '见面记录',
                    summary: session?.summary || '',
                    rawSummary: session?.rawSummary || '',
                    updatedAt: session?.updatedAt || undefined
                };
            });
            if (JSON.stringify(sessions) !== JSON.stringify(normalized)) {
                activeFriend.offlineMeetingSessions = normalized;
                commitSheetFriendChange(activeFriend, (targetFriend) => {
                    targetFriend.offlineMeetingSessions = normalized;
                }, { silent: true, metaOnly: true });
            }
            return normalized;
        };

        const getCurrentOnlineChatContainer = (friend) => {
            if (!friend?.id) return null;
            const page = document.getElementById(`chat-interface-${friend.id}`);
            return page ? page.querySelector('.ins-chat-messages') : null;
        };

        const rerenderOnlineChatForFriend = (friend, options = {}) => {
            const container = getCurrentOnlineChatContainer(friend);
            if (container && window.imChat?.rerenderChatContainer) {
                const latestFriend = (window.imData?.friends || []).find(item => String(item.id) === String(friend.id)) || friend;
                window.imChat.rerenderChatContainer(latestFriend, container, { scroll: options.scroll !== false });
            }
            if (window.imChat?.renderChatsList) window.imChat.renderChatsList();
        };

        const upsertOfflineMeetingActiveNotice = async (activeFriend) => {
            if (!activeFriend?.id) return false;
            if (window.imApp?.ensureFriendMessagesLoaded) {
                await window.imApp.ensureFriendMessagesLoaded(activeFriend);
            }
            if (!Array.isArray(activeFriend.messages)) activeFriend.messages = [];

            const activeNotices = activeFriend.messages.filter(message => message?.type === 'system_notice' && message.noticeKind === OFFLINE_ACTIVE_NOTICE_KIND);
            const now = Date.now();
            const sessionId = activeFriend.offlineCurrentSessionId || createOfflineTavernId('offline-session');
            const baseNotice = {
                id: activeNotices[0]?.id || createOfflineTavernId('notice'),
                role: 'system',
                type: 'system_notice',
                noticeKind: OFFLINE_ACTIVE_NOTICE_KIND,
                content: '见面中',
                text: '见面中',
                offlineSessionId: sessionId,
                timestamp: activeNotices[0]?.timestamp || now
            };

            if (activeNotices.length > 1 && window.imApp?.removeFriendMessages) {
                await window.imApp.removeFriendMessages(activeFriend.id, activeNotices.slice(1).map(message => ({
                    id: message.id || null,
                    timestamp: message.timestamp || null
                })), { silent: true });
            }

            let saved = true;
            if (activeNotices[0] && window.imApp?.updateFriendMessage) {
                saved = await window.imApp.updateFriendMessage(activeFriend.id, {
                    id: activeNotices[0].id || null,
                    timestamp: activeNotices[0].timestamp || null
                }, (targetMsg) => {
                    Object.assign(targetMsg, baseNotice);
                }, { silent: true });
            } else if (window.imApp?.appendFriendMessage) {
                saved = await window.imApp.appendFriendMessage(activeFriend.id, baseNotice, { silent: true });
            } else {
                activeFriend.messages.push(baseNotice);
                saved = await commitSheetFriendChange(activeFriend, (targetFriend) => {
                    if (!Array.isArray(targetFriend.messages)) targetFriend.messages = [];
                    targetFriend.messages.push(baseNotice);
                }, { silent: true });
            }

            if (saved) rerenderOnlineChatForFriend(activeFriend, { scroll: true });
            return saved;
        };

        const removeOfflineMeetingActiveNotice = async (activeFriend) => {
            if (!activeFriend?.id) return true;
            if (window.imApp?.ensureFriendMessagesLoaded) {
                await window.imApp.ensureFriendMessagesLoaded(activeFriend);
            }
            const notices = (activeFriend.messages || []).filter(message => message?.type === 'system_notice' && message.noticeKind === OFFLINE_ACTIVE_NOTICE_KIND);
            if (notices.length === 0) return true;

            let saved = true;
            if (window.imApp?.removeFriendMessages) {
                saved = await window.imApp.removeFriendMessages(activeFriend.id, notices.map(message => ({
                    id: message.id || null,
                    timestamp: message.timestamp || null
                })), { silent: true });
            } else {
                activeFriend.messages = activeFriend.messages.filter(message => !(message?.type === 'system_notice' && message.noticeKind === OFFLINE_ACTIVE_NOTICE_KIND));
                saved = await commitSheetFriendChange(activeFriend, (targetFriend) => {
                    targetFriend.messages = (targetFriend.messages || []).filter(message => !(message?.type === 'system_notice' && message.noticeKind === OFFLINE_ACTIVE_NOTICE_KIND));
                }, { silent: true });
            }

            if (saved) rerenderOnlineChatForFriend(activeFriend, { scroll: false });
            return saved;
        };

        const isOfflineMeetingRecordForSession = (message, session) => {
            if (!message || !session || message.type !== OFFLINE_MEETING_RECORD_TYPE) return false;
            const sessionId = String(session.id || '');
            if (sessionId && String(message.offlineSessionId || '') === sessionId) return true;

            const messageTime = Number(message.timestamp) || 0;
            const endedAt = Number(session.endedAt) || 0;
            const messageTitle = String(message.title || '').trim();
            const sessionTitle = String(session.title || '').trim();
            return !!(messageTime && endedAt && Math.abs(messageTime - endedAt) <= 1000 && messageTitle && messageTitle === sessionTitle);
        };

        const buildOfflineMeetingRecordContent = (session, summary) => {
            return [
                session?.dateText || formatOfflineMeetingDate(session?.endedAt),
                session?.title || '见面记录',
                String(summary || '')
            ].filter(Boolean).join('\n\n');
        };

        const buildOfflineMeetingRawSummary = (session, summary) => {
            return [
                `标题：${session?.title || '见面记录'}`,
                `见面内容：${String(summary || '')}`
            ].join('\n');
        };

        const updateOfflineMeetingSessionSummary = async (activeFriend, session, nextSummary) => {
            if (!activeFriend?.id || !session?.id) return false;
            if (window.imApp?.ensureFriendMessagesLoaded) {
                await window.imApp.ensureFriendMessagesLoaded(activeFriend);
            }

            const sessionId = String(session.id);
            const summaryText = String(nextSummary || '').trim();
            const updatedRawSummary = buildOfflineMeetingRawSummary(session, summaryText);
            const updatedContent = buildOfflineMeetingRecordContent(session, summaryText);
            const saved = await commitSheetFriendChange(activeFriend, (targetFriend) => {
                if (!targetFriend) return;
                targetFriend.offlineMeetingSessions = (Array.isArray(targetFriend.offlineMeetingSessions) ? targetFriend.offlineMeetingSessions : []).map(item => {
                    if (String(item?.id || '') !== sessionId) return item;
                    return {
                        ...item,
                        summary: summaryText,
                        rawSummary: updatedRawSummary,
                        updatedAt: Date.now()
                    };
                });

                if (Array.isArray(targetFriend.messages)) {
                    targetFriend.messages.forEach((message) => {
                        if (!isOfflineMeetingRecordForSession(message, session)) return;
                        message.summary = summaryText;
                        message.rawSummary = updatedRawSummary;
                        message.content = updatedContent;
                        message.text = `见面记录：${session.title || '见面记录'}`;
                    });
                    if (window.imApp?.syncFriendMessageSummary) window.imApp.syncFriendMessageSummary(targetFriend);
                    if (window.imApp?.clearFriendRuntimeMessageContext) window.imApp.clearFriendRuntimeMessageContext(targetFriend);
                    if (window.imApp?.syncActiveFriendReference) window.imApp.syncActiveFriendReference(targetFriend);
                    if (window.imApp?.syncSettingsFriendReference) window.imApp.syncSettingsFriendReference(targetFriend);
                }
            }, { silent: true, includeMessages: true });

            if (!saved) return false;
            const latestFriend = (window.imData?.friends || []).find(item => String(item.id) === String(activeFriend.id)) || activeFriend;
            if (window.imData?.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(latestFriend.id)) {
                window.imData.currentActiveFriend = latestFriend;
            }
            rerenderOnlineChatForFriend(latestFriend, { scroll: false });
            return true;
        };

        const deleteOfflineMeetingSession = async (activeFriend, session) => {
            if (!activeFriend?.id || !session?.id) return false;
            if (window.imApp?.ensureFriendMessagesLoaded) {
                await window.imApp.ensureFriendMessagesLoaded(activeFriend);
            }

            const sessionId = String(session.id);
            const saved = await commitSheetFriendChange(activeFriend, (targetFriend) => {
                if (!targetFriend) return;
                targetFriend.offlineMeetingSessions = (Array.isArray(targetFriend.offlineMeetingSessions) ? targetFriend.offlineMeetingSessions : [])
                    .filter(item => String(item?.id || '') !== sessionId);

                if (Array.isArray(targetFriend.messages)) {
                    targetFriend.messages = targetFriend.messages.filter(message => !isOfflineMeetingRecordForSession(message, session));
                    if (window.imApp?.reindexFriendMessages) window.imApp.reindexFriendMessages(targetFriend);
                    if (window.imApp?.syncFriendMessageSummary) window.imApp.syncFriendMessageSummary(targetFriend);
                    if (window.imApp?.clearFriendRuntimeMessageContext) window.imApp.clearFriendRuntimeMessageContext(targetFriend);
                    if (window.imApp?.syncActiveFriendReference) window.imApp.syncActiveFriendReference(targetFriend);
                    if (window.imApp?.syncSettingsFriendReference) window.imApp.syncSettingsFriendReference(targetFriend);
                }
            }, { silent: true, includeMessages: true });

            if (!saved) return false;
            const latestFriend = (window.imData?.friends || []).find(item => String(item.id) === String(activeFriend.id)) || activeFriend;
            if (window.imData?.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(latestFriend.id)) {
                window.imData.currentActiveFriend = latestFriend;
            }
            renderOfflineHistoryList(latestFriend);
            rerenderOnlineChatForFriend(latestFriend, { scroll: false });
            return true;
        };

        const confirmDeleteOfflineMeetingSession = (activeFriend, session, button = null) => {
            const runDelete = async () => {
                if (button) {
                    button.disabled = true;
                    button.dataset.busy = 'true';
                }
                try {
                    const saved = await deleteOfflineMeetingSession(activeFriend, session);
                    if (window.showToast) window.showToast(saved ? '见面记录已删除' : '删除见面记录失败');
                } catch (error) {
                    console.error('Delete offline meeting session failed', error);
                    if (window.showToast) window.showToast('删除见面记录失败');
                } finally {
                    if (button) {
                        button.disabled = false;
                        button.dataset.busy = 'false';
                    }
                }
            };

            if (window.showCustomModal) {
                window.showCustomModal({
                    title: '删除见面记录',
                    message: '确定彻底删除这条见面记录吗？这会同时清理聊天上下文，无法恢复。',
                    confirmText: '删除',
                    isDestructive: true,
                    onConfirm: runDelete
                });
                return;
            }

            if (window.confirm('确定彻底删除这条见面记录吗？这会同时清理聊天上下文，无法恢复。')) {
                runDelete();
            }
        };

        const getActiveLinkedAccountsFriend = () => {
            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend || activeFriend.type === 'group' || activeFriend.type === 'official') return null;
            return activeFriend;
        };

        const formatLinkedAccountTime = (timestamp) => {
            const time = Number(timestamp) || 0;
            if (!time) return '';
            if (window.imApp?.formatTime) return window.imApp.formatTime(time);
            return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

        const getLinkedAccountDisplayName = (chat) => {
            if (!chat) return '关联好友';
            return chat.remark || chat.name || chat.realName || '关联好友';
        };

        const getLinkedAccountInitial = (chat) => {
            return String(getLinkedAccountDisplayName(chat)).trim().charAt(0).toUpperCase() || 'A';
        };

        const getLinkedAccountAvatarStyle = (chat, size = 42) => {
            const seed = String(chat?.avatarSeed || chat?.remark || chat?.realName || getLinkedAccountDisplayName(chat) || 'linked');
            let hash = 0;
            for (let i = 0; i < seed.length; i += 1) {
                hash = ((hash << 5) - hash) + seed.charCodeAt(i);
                hash |= 0;
            }
            const hue = Math.abs(hash) % 360;
            const hue2 = (hue + 38) % 360;
            return `width:${size}px; height:${size}px; border-radius:50%; background:linear-gradient(135deg, hsl(${hue}, 62%, 40%), hsl(${hue2}, 68%, 48%)); color:#fff; display:flex; align-items:center; justify-content:center; font-size:${Math.max(14, Math.round(size * 0.38))}px; font-weight:800; flex-shrink:0;`;
        };

        const formatLinkedAccountModalTime = (timestamp) => {
            const time = Number(timestamp) || 0;
            if (!time) return '';
            const date = new Date(time);
            return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        };

        const getLinkedAccountMessageTranslation = (message) => {
            if (!message || typeof message !== 'object') return '';
            return typeof message.translation === 'string' && message.translation.trim()
                ? message.translation.trim()
                : (typeof message.translationZh === 'string' && message.translationZh.trim()
                    ? message.translationZh.trim()
                    : (typeof message.trans === 'string' && message.trans.trim() ? message.trans.trim() : ''));
        };

        const buildLinkedAccountBubbleHtml = (message) => {
            const text = escapeSheetHtml(message?.text || '');
            const translation = getLinkedAccountMessageTranslation(message);
            if (!translation) {
                return `<div class="group-private-chat-detail-bubble"><span class="group-private-chat-detail-original">${text}</span></div>`;
            }
            return `
                <button type="button" class="group-private-chat-detail-bubble has-translation" aria-expanded="false" title="点击展开翻译">
                    <span class="group-private-chat-detail-original">${text}</span>
                    <span class="group-private-chat-detail-translation" hidden>${escapeSheetHtml(translation)}</span>
                </button>
            `;
        };

        const toggleLinkedAccountBubbleTranslation = (bubble) => {
            if (!bubble) return;
            const translation = bubble.querySelector('.group-private-chat-detail-translation');
            if (!translation) return;
            const willExpand = translation.hidden;
            translation.hidden = !willExpand;
            bubble.classList.toggle('is-expanded', willExpand);
            bubble.setAttribute('aria-expanded', willExpand ? 'true' : 'false');
            bubble.title = willExpand ? '点击收起翻译' : '点击展开翻译';
        };

        const findLinkedAccountChat = (chatId) => {
            const activeFriend = getActiveLinkedAccountsFriend();
            const chats = Array.isArray(activeFriend?.linkedAccountChats) ? activeFriend.linkedAccountChats : [];
            return chats.find(chat => String(chat.id) === String(chatId)) || null;
        };

        let linkedAccountModalOverlay = null;

        const closeLinkedAccountModal = () => {
            if (linkedAccountModalOverlay) linkedAccountModalOverlay.style.display = 'none';
        };

        const showLinkedAccountModal = (innerHtml) => {
            if (!linkedAccountModalOverlay) {
                linkedAccountModalOverlay = document.createElement('div');
                linkedAccountModalOverlay.className = 'linked-account-modal-overlay';
                linkedAccountModalOverlay.style.cssText = 'position:absolute; inset:0; z-index:30; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,0.22); padding:18px; box-sizing:border-box;';
                linkedAccountModalOverlay.addEventListener('click', (event) => {
                    const translationBubble = event.target.closest('.group-private-chat-detail-bubble.has-translation');
                    if (translationBubble) {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleLinkedAccountBubbleTranslation(translationBubble);
                        return;
                    }
                    const deleteBtn = event.target.closest('.linked-account-delete-chat-btn');
                    if (deleteBtn) {
                        event.preventDefault();
                        event.stopPropagation();
                        deleteLinkedAccountChat(deleteBtn.getAttribute('data-linked-chat-id'));
                        return;
                    }
                    if (event.target === linkedAccountModalOverlay || event.target.closest('.linked-account-modal-close')) {
                        closeLinkedAccountModal();
                    }
                });
                attachmentSheet.appendChild(linkedAccountModalOverlay);
            }

            linkedAccountModalOverlay.innerHTML = innerHtml;
            linkedAccountModalOverlay.style.display = 'flex';
        };

        const openLinkedAccountChatModal = (chat) => {
            const activeFriend = getActiveLinkedAccountsFriend();
            if (!chat || !activeFriend) return;
            const displayName = getLinkedAccountDisplayName(chat);
            const realName = chat.realName || chat.name || displayName;
            const charName = activeFriend.nickname || activeFriend.realName || 'TA';
            const messages = Array.isArray(chat.messages) ? [...chat.messages].sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0)) : [];
            const bubblesHtml = messages.length > 0
                ? messages.map((message, index) => {
                    const isChar = message.role === 'char';
                    const currentName = isChar ? charName : displayName;
                    const previousRole = index > 0 ? messages[index - 1]?.role : null;
                    const isGroupStart = index === 0 || previousRole !== message?.role;
                    const currentTime = Number(message.timestamp) || 0;
                    const prevTime = index > 0 ? Number(messages[index - 1]?.timestamp) || 0 : 0;
                    const showTime = index === 0 || (currentTime && prevTime && currentTime - prevTime > 5 * 60 * 1000);
                    return `
                        ${showTime ? `<div class="group-private-chat-detail-time-chip">${escapeSheetHtml(formatLinkedAccountModalTime(currentTime))}</div>` : ''}
                        <div class="group-private-chat-detail-row${isChar ? ' is-sender' : ''}${isGroupStart ? ' is-group-start' : ''}">
                            ${isGroupStart ? `<div class="group-private-chat-detail-name">${escapeSheetHtml(currentName)}</div>` : ''}
                            ${buildLinkedAccountBubbleHtml(message)}
                        </div>
                    `;
                }).join('')
                : '<div style="text-align:center; color:#8e8e93; font-size:13px; padding:34px 0;">暂无消息</div>';

            showLinkedAccountModal(`
                <div class="group-private-chat-detail-card linked-account-chat-detail-card">
                    <div style="display:flex; align-items:center; gap:10px; padding:14px 16px; border-bottom:1px solid #f2f2f7; flex-shrink:0;">
                        <div style="${getLinkedAccountAvatarStyle(chat, 38)}">${escapeSheetHtml(getLinkedAccountInitial(chat))}</div>
                        <div style="min-width:0; flex:1;">
                            <div style="font-size:16px; font-weight:800; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeSheetHtml(displayName)}</div>
                            <div style="font-size:12px; color:#8e8e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeSheetHtml(realName)}${chat.relationship ? ` · ${escapeSheetHtml(chat.relationship)}` : ''}</div>
                        </div>
                        <button type="button" class="linked-account-modal-close" style="width:30px; height:30px; border:none; border-radius:50%; background:#f2f2f7; color:#636366; cursor:pointer;"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="group-private-chat-detail-messages linked-account-chat-detail-messages">
                        ${bubblesHtml}
                    </div>
                </div>
            `);
        };

        const deleteLinkedAccountChat = async (chatId) => {
            const activeFriend = getActiveLinkedAccountsFriend();
            if (!activeFriend || !chatId) return false;
            const safeChatId = String(chatId);
            const saved = await commitSheetFriendChange(activeFriend.id, (targetFriend) => {
                targetFriend.linkedAccountChats = window.imApp?.normalizeLinkedAccountChats
                    ? window.imApp.normalizeLinkedAccountChats(targetFriend.linkedAccountChats)
                    : (Array.isArray(targetFriend.linkedAccountChats) ? targetFriend.linkedAccountChats : []);
                targetFriend.linkedAccountChats = targetFriend.linkedAccountChats.filter(item => String(item.id) !== safeChatId);
            }, {
                silent: true,
                metaOnly: true
            });

            if (!saved) {
                if (window.showToast) window.showToast('删除好友会话失败');
                return false;
            }

            activeFriend.linkedAccountChats = (Array.isArray(activeFriend.linkedAccountChats) ? activeFriend.linkedAccountChats : [])
                .filter(item => String(item.id) !== safeChatId);
            closeLinkedAccountModal();
            renderLinkedAccountsPanel();
            if (window.showToast) window.showToast('已删除好友会话');
            return true;
        };

        const markLinkedAccountChatRead = async (chatId) => {
            const activeFriend = getActiveLinkedAccountsFriend();
            if (!activeFriend || !chatId) return false;
            const safeChatId = String(chatId);
            let nextReadAt = 0;
            const saved = await commitSheetFriendChange(activeFriend.id, (targetFriend) => {
                targetFriend.linkedAccountChats = window.imApp?.normalizeLinkedAccountChats
                    ? window.imApp.normalizeLinkedAccountChats(targetFriend.linkedAccountChats)
                    : (Array.isArray(targetFriend.linkedAccountChats) ? targetFriend.linkedAccountChats : []);
                const targetChat = targetFriend.linkedAccountChats.find(item => String(item.id) === safeChatId);
                if (!targetChat) return;
                nextReadAt = Math.max(Number(targetChat.updatedAt) || 0, Date.now());
                targetChat.readAt = nextReadAt;
            }, {
                silent: true,
                metaOnly: true
            });

            if (!saved) return false;
            const localChat = (Array.isArray(activeFriend.linkedAccountChats) ? activeFriend.linkedAccountChats : [])
                .find(item => String(item.id) === safeChatId);
            if (localChat) localChat.readAt = nextReadAt;
            renderLinkedAccountsPanel();
            return true;
        };

        const openLinkedAccountProfileModal = (chat) => {
            if (!chat) return;
            const displayName = getLinkedAccountDisplayName(chat);
            const realName = chat.realName || chat.name || displayName;
            const rows = [
                ['真名', realName],
                ['备注', chat.remark || displayName],
                ['关系', chat.relationship || '未填写'],
                ['人设', chat.persona || '未填写']
            ];

            showLinkedAccountModal(`
                <div style="width:min(100%, 340px); max-height:74vh; background:#fff; border-radius:24px;  overflow:hidden;">
                    <div style="position:relative; padding:24px 18px 16px; display:flex; flex-direction:column; align-items:center; border-bottom:1px solid #f2f2f7;">
                        <button type="button" class="linked-account-modal-close" style="position:absolute; right:14px; top:14px; width:30px; height:30px; border:none; border-radius:50%; background:#f2f2f7; color:#636366; cursor:pointer;"><i class="fas fa-times"></i></button>
                        <div style="${getLinkedAccountAvatarStyle(chat, 72)}">${escapeSheetHtml(getLinkedAccountInitial(chat))}</div>
                        <div style="font-size:19px; font-weight:850; color:#111; margin-top:12px; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeSheetHtml(displayName)}</div>
                        <div style="font-size:12px; color:#8e8e93; margin-top:3px;">只读资料</div>
                    </div>
                    <div style="padding:10px 16px 16px; overflow-y:auto;">
                        ${rows.map(([label, value]) => `
                            <div style="display:flex; gap:12px; align-items:flex-start; padding:11px 0; border-bottom:1px solid #f2f2f7;">
                                <div style="width:48px; color:#8e8e93; font-size:13px; flex-shrink:0;">${escapeSheetHtml(label)}</div>
                                <div style="flex:1; color:#111; font-size:14px; line-height:1.42; word-break:break-word;">${escapeSheetHtml(value)}</div>
                            </div>
                        `).join('')}
                        <button type="button" class="linked-account-delete-chat-btn" data-linked-chat-id="${escapeSheetHtml(chat.id)}" style="width:100%; margin-top:14px; height:42px; border:none; border-radius:14px; background:#ff3b30; color:#fff; font-size:14px; font-weight:800; display:flex; align-items:center; justify-content:center; gap:7px; cursor:pointer;">
                            <i class="fas fa-trash-alt"></i>
                            <span>删除会话</span>
                        </button>
                    </div>
                </div>
            `);
        };

        const stopLinkedAccountTimer = () => {
            if (linkedAccountTimer) {
                clearInterval(linkedAccountTimer);
                linkedAccountTimer = null;
            }
            linkedAccountTimerFriendId = null;
            linkedAccountTimerIntervalMs = 0;
        };

        const getActiveAttachmentTab = () => {
            const activeTab = attachmentSheet.querySelector('.sheet-tab-item.active');
            return activeTab ? activeTab.getAttribute('data-tab') : '';
        };

        const syncLinkedAccountTimer = () => {
            const activeFriend = getActiveLinkedAccountsFriend();
            const bot = window.imApp?.normalizeLinkedAccountBot
                ? window.imApp.normalizeLinkedAccountBot(activeFriend?.linkedAccountBot)
                : (activeFriend?.linkedAccountBot || {});
            const shouldRun = !!activeFriend
                && attachmentSheet.style.display === 'flex'
                && getActiveAttachmentTab() === 'file'
                && !!bot.enabled;
            const nextFriendId = activeFriend ? String(activeFriend.id) : null;
            const nextIntervalMs = Math.max(5, Number(bot.intervalSeconds) || 60) * 1000;

            if (!shouldRun) {
                stopLinkedAccountTimer();
                return;
            }

            if (linkedAccountTimer && linkedAccountTimerFriendId === nextFriendId && linkedAccountTimerIntervalMs === nextIntervalMs) {
                return;
            }

            stopLinkedAccountTimer();
            linkedAccountTimerFriendId = nextFriendId;
            linkedAccountTimer = setInterval(async () => {
                const latestFriend = getActiveLinkedAccountsFriend();
                if (!latestFriend || String(latestFriend.id) !== nextFriendId || getActiveAttachmentTab() !== 'file') {
                    stopLinkedAccountTimer();
                    return;
                }
                if (window.imChat.runLinkedAccountBotNow) {
                    await window.imChat.runLinkedAccountBotNow(latestFriend, { silent: false });
                }
            }, nextIntervalMs);
            linkedAccountTimerIntervalMs = nextIntervalMs;
        };

        const renderLinkedAccountsPanel = () => {
            const activeFriend = getActiveLinkedAccountsFriend();
            if (!linkedAccountsEmpty || !linkedAccountsControls || !linkedAccountsList) return;

            if (!activeFriend) {
                linkedAccountsEmpty.style.display = 'block';
                linkedAccountsEmpty.textContent = '关联好友仅支持单聊 Char。';
                linkedAccountsControls.style.display = 'none';
                linkedAccountsList.style.display = 'none';
                stopLinkedAccountTimer();
                return;
            }

            activeFriend.linkedAccountBot = window.imApp?.normalizeLinkedAccountBot
                ? window.imApp.normalizeLinkedAccountBot(activeFriend.linkedAccountBot)
                : (activeFriend.linkedAccountBot || { enabled: false, intervalSeconds: 60, lastRunAt: 0 });
            activeFriend.linkedAccountChats = window.imApp?.normalizeLinkedAccountChats
                ? window.imApp.normalizeLinkedAccountChats(activeFriend.linkedAccountChats)
                : (Array.isArray(activeFriend.linkedAccountChats) ? activeFriend.linkedAccountChats : []);

            linkedAccountsEmpty.style.display = 'none';
            linkedAccountsControls.style.display = 'flex';
            linkedAccountsList.style.display = 'flex';
            if (linkedAccountsToggle) linkedAccountsToggle.checked = !!activeFriend.linkedAccountBot.enabled;
            if (linkedAccountsIntervalRow) linkedAccountsIntervalRow.style.display = activeFriend.linkedAccountBot.enabled ? 'flex' : 'none';
            if (linkedAccountsIntervalInput) linkedAccountsIntervalInput.value = String(activeFriend.linkedAccountBot.intervalSeconds || 60);
            if (linkedAccountsStatus) {
                linkedAccountsStatus.textContent = activeFriend.linkedAccountBot.enabled
                    ? `已开启，每 ${activeFriend.linkedAccountBot.intervalSeconds || 60} 秒自动调用一次 API`
                    : '开启后会自动生成好友会话';
            }

            const chats = [...activeFriend.linkedAccountChats].sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
            if (chats.length === 0) {
                linkedAccountsList.innerHTML = '<div style="text-align:center; color:#8e8e93; font-size:13px; line-height:1.45; padding:28px 12px;">暂无好友会话。开启后，系统会自动生成好友发来的消息。</div>';
                syncLinkedAccountTimer();
                return;
            }

            linkedAccountsList.innerHTML = chats.map(chat => {
                const messages = Array.isArray(chat.messages) ? chat.messages : [];
                const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
                const displayName = getLinkedAccountDisplayName(chat);
                const realName = chat.realName || chat.name || displayName;
                const latestText = lastMessage ? escapeSheetHtml(lastMessage.text || '') : '暂无消息';
                const speakerLabel = lastMessage && lastMessage.role === 'char' ? `${escapeSheetHtml(activeFriend.nickname || 'Char')}: ` : '';
                const unreadCount = messages.filter(message => (Number(message.timestamp) || 0) > (Number(chat.readAt) || 0)).length;
                const countText = unreadCount > 99 ? '99+' : String(unreadCount);
                const unreadBadgeHtml = unreadCount > 0
                    ? `<div style="min-width:20px; height:20px; padding:0 6px; box-sizing:border-box; border-radius:999px; background:#ff3b30; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:850; line-height:1;">${escapeSheetHtml(countText)}</div>`
                    : '';
                return `
                    <div class="linked-account-chat-card" data-linked-chat-id="${escapeSheetHtml(chat.id)}" style="display:flex; gap:10px; align-items:center; padding:11px 12px; border-radius:18px; background:#f7f7fa; cursor:pointer;">
                        <button type="button" class="linked-account-avatar-btn" data-linked-chat-id="${escapeSheetHtml(chat.id)}" style="${getLinkedAccountAvatarStyle(chat, 42)} border:none; padding:0; cursor:pointer;">${escapeSheetHtml(getLinkedAccountInitial(chat))}</button>
                        <div style="min-width:0; flex:1;">
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                                <div style="font-size:15px; font-weight:800; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeSheetHtml(displayName)}</div>
                                <div style="display:flex; align-items:center; gap:7px; flex-shrink:0;">
                                    <div style="font-size:11px; color:#8e8e93;">${escapeSheetHtml(formatLinkedAccountTime(chat.updatedAt))}</div>
                                    ${unreadBadgeHtml}
                                </div>
                            </div>
                            <div style="font-size:12px; color:#8e8e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px;">${escapeSheetHtml(realName)}${chat.relationship ? ` · ${escapeSheetHtml(chat.relationship)}` : ''}</div>
                            <div style="font-size:13px; color:#3a3a3c; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:4px;">${speakerLabel}${latestText}</div>
                        </div>
                    </div>
                `;
            }).join('');
            syncLinkedAccountTimer();
        };

        const saveLinkedAccountBotSettings = async (patch = {}) => {
            const activeFriend = getActiveLinkedAccountsFriend();
            if (!activeFriend) return false;
            const currentBot = window.imApp?.normalizeLinkedAccountBot
                ? window.imApp.normalizeLinkedAccountBot(activeFriend.linkedAccountBot)
                : (activeFriend.linkedAccountBot || { enabled: false, intervalSeconds: 60, lastRunAt: 0 });
            const nextBot = window.imApp?.normalizeLinkedAccountBot
                ? window.imApp.normalizeLinkedAccountBot({ ...currentBot, ...patch })
                : { ...currentBot, ...patch };

            const saved = await commitSheetFriendChange(activeFriend.id, (targetFriend) => {
                targetFriend.linkedAccountBot = nextBot;
            }, {
                silent: true,
                metaOnly: true
            });

            if (!saved) {
                if (window.showToast) window.showToast('关联好友设置保存失败');
                return false;
            }

            activeFriend.linkedAccountBot = nextBot;
            renderLinkedAccountsPanel();
            return true;
        };

        const renderSheetStickers = async () => {
            if (!stickersList || !stickerCategoryTabs) return;

            stickersList.innerHTML = '<div style="text-align:center; color:#8e8e93; padding:28px 0; font-size:13px;">Loading stickers...</div>';
            stickerCategoryTabs.innerHTML = '';

            try {
                if (window.imApp?.ensureStickersReady) {
                    await window.imApp.ensureStickersReady();
                }
            } catch (error) {
                console.error('Failed to load stickers for attachment sheet', error);
            }

            const categories = (Array.isArray(window.imData?.stickers) ? window.imData.stickers : [])
                .filter(category => category && Array.isArray(category.items) && category.items.length > 0);

            if (categories.length === 0) {
                stickersList.innerHTML = '<div style="text-align:center; color:#8e8e93; padding:32px 14px; font-size:13px; line-height:1.45;">No stickers yet. Add stickers from Home first.</div>';
                return;
            }

            if (!activeStickerCategoryName || !categories.some(category => category.categoryName === activeStickerCategoryName)) {
                activeStickerCategoryName = categories[0].categoryName || '';
            }

            const renderActiveStickerGrid = (category) => {
                stickersList.innerHTML = '';
                const grid = document.createElement('div');
                grid.className = 'sheet-sticker-grid';

                const items = Array.isArray(category?.items) ? category.items : [];
                if (items.length === 0) {
                    stickersList.innerHTML = '<div style="text-align:center; color:#8e8e93; padding:32px 14px; font-size:13px;">This category is empty.</div>';
                    return;
                }

                items.forEach(sticker => {
                    if (!sticker || !sticker.url) return;
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'sheet-sticker-item';
                    button.title = sticker.name || '';
                    button.innerHTML = `<img src="${escapeSheetHtml(sticker.url)}" alt="${escapeSheetHtml(sticker.name || 'Sticker')}">`;
                    button.addEventListener('click', async () => {
                        closeSheet();
                        await window.imChat.sendStickerMessage({
                            category: category.categoryName || '',
                            name: sticker.name || 'Sticker',
                            url: sticker.url
                        });
                    });
                    grid.appendChild(button);
                });

                stickersList.appendChild(grid);
            };

            stickerCategoryTabs.innerHTML = '';
            categories.forEach(category => {
                const tab = document.createElement('button');
                tab.type = 'button';
                tab.className = `sheet-sticker-category-tab ${category.categoryName === activeStickerCategoryName ? 'active' : ''}`;
                tab.textContent = category.categoryName || 'Stickers';
                tab.addEventListener('click', () => {
                    activeStickerCategoryName = category.categoryName || '';
                    stickerCategoryTabs.querySelectorAll('.sheet-sticker-category-tab').forEach(item => {
                        item.classList.toggle('active', item === tab);
                    });
                    renderActiveStickerGrid(category);
                });
                stickerCategoryTabs.appendChild(tab);
            });

            const activeCategory = categories.find(category => category.categoryName === activeStickerCategoryName) || categories[0];
            renderActiveStickerGrid(activeCategory);
        };

        const syncOfflineMeetEntry = () => {
            const activeFriend = window.imData.currentActiveFriend;
            const isOffline = !!activeFriend?.offlineMeetEnabled;
            if (offlineLabel) offlineLabel.textContent = isOffline ? '退出线下' : '线下';
            if (offlineEntry) offlineEntry.classList.toggle('active', isOffline);
        };

        const syncDynamicActionEntry = () => {
            const activeFriend = window.imData.currentActiveFriend;
            const isEnabled = !!activeFriend?.dynamicActionNarrationEnabled;
            if (dynamicActionLabel) dynamicActionLabel.textContent = isEnabled ? '关闭' : '动描';
            if (dynamicActionEntry) dynamicActionEntry.classList.toggle('active', isEnabled);
        };

        const toggleDynamicActionNarration = async () => {
            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend) {
                if (window.showToast) window.showToast('当前聊天不存在');
                return;
            }

            const nextEnabled = !activeFriend.dynamicActionNarrationEnabled;
            const saved = await commitSheetFriendChange(activeFriend.id, (targetFriend) => {
                if (!targetFriend) return;
                targetFriend.dynamicActionNarrationEnabled = nextEnabled;
            }, {
                silent: true,
                metaOnly: true
            });

            if (!saved) {
                if (window.showToast) window.showToast('动描设置保存失败');
                return;
            }

            activeFriend.dynamicActionNarrationEnabled = nextEnabled;
            syncDynamicActionEntry();
            if (window.showToast) window.showToast(nextEnabled ? '动描已开启' : '动描已关闭');
        };

        window.addEventListener('u2:stickers-binding-changed', () => {
            if (attachmentSheet.style.display === 'flex') {
                const activeTab = attachmentSheet.querySelector('.sheet-tab-item.active');
                if (activeTab && activeTab.getAttribute('data-tab') === 'stickers') {
                    renderSheetStickers();
                }
            }
        });

        window.addEventListener('u2:stickers-data-changed', () => {
            if (attachmentSheet.style.display === 'flex') {
                const activeTab = attachmentSheet.querySelector('.sheet-tab-item.active');
                if (activeTab && activeTab.getAttribute('data-tab') === 'stickers') {
                    renderSheetStickers();
                }
            }
        });

        window.addEventListener('u2:linked-accounts-changed', (event) => {
            const activeFriend = getActiveLinkedAccountsFriend();
            if (!activeFriend) return;
            if (event?.detail?.friendId && String(event.detail.friendId) !== String(activeFriend.id)) return;
            if (attachmentSheet.style.display === 'flex' && getActiveAttachmentTab() === 'file') {
                renderLinkedAccountsPanel();
            }
        });

        if (linkedAccountsToggle) {
            linkedAccountsToggle.addEventListener('change', async () => {
                await saveLinkedAccountBotSettings({ enabled: linkedAccountsToggle.checked });
            });
        }

        if (linkedAccountsIntervalInput) {
            linkedAccountsIntervalInput.addEventListener('change', async () => {
                const intervalSeconds = Math.max(5, Math.round(Number(linkedAccountsIntervalInput.value) || 60));
                linkedAccountsIntervalInput.value = String(intervalSeconds);
                await saveLinkedAccountBotSettings({ intervalSeconds });
            });
        }

        if (linkedAccountsList) {
            linkedAccountsList.addEventListener('click', (event) => {
                const avatarBtn = event.target.closest('.linked-account-avatar-btn');
                if (avatarBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    const chat = findLinkedAccountChat(avatarBtn.getAttribute('data-linked-chat-id'));
                    openLinkedAccountProfileModal(chat);
                    return;
                }

                const card = event.target.closest('.linked-account-chat-card');
                if (!card) return;
                const chat = findLinkedAccountChat(card.getAttribute('data-linked-chat-id'));
                openLinkedAccountChatModal(chat);
                markLinkedAccountChatRead(card.getAttribute('data-linked-chat-id'));
            });
        }

        // Click listener to set active tab and ensure it is fully visible in the container
        tabItems.forEach(item => {
            item.addEventListener('click', () => {
                // 1. Update active tab UI
                tabItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                // 2. Scroll into view if partially hidden
                const containerRect = tabsContainer.getBoundingClientRect();
                const itemRect = item.getBoundingClientRect();
                
                if (itemRect.left < containerRect.left) {
                    tabsContainer.scrollBy({ left: itemRect.left - containerRect.left - 16, behavior: 'smooth' });
                } else if (itemRect.right > containerRect.right) {
                    tabsContainer.scrollBy({ left: itemRect.right - containerRect.right + 16, behavior: 'smooth' });
                }

                // 3. Switch View Panels
                const targetTab = item.getAttribute('data-tab');
                if (targetTab === 'more') {
                    syncOfflineMeetEntry();
                    syncDynamicActionEntry();
                }
                sheetViews.forEach(view => {
                    if (view.classList.contains(`view-${targetTab}`)) {
                        if (targetTab === 'gallery') {
                            view.style.display = 'grid';
                        } else if (targetTab === 'file') {
                            view.style.display = 'block';
                        } else {
                            view.style.display = 'flex';
                        }
                        if (targetTab === 'stickers') {
                            renderSheetStickers();
                        }
                        if (targetTab === 'file') {
                            renderLinkedAccountsPanel();
                        }
                    } else {
                        view.style.display = 'none';
                    }
                });
                if (targetTab !== 'file') {
                    stopLinkedAccountTimer();
                }
            });
        });

        const setRecipientTriggerDisplay = (member) => {
            if (payRecipientLabel) {
                payRecipientLabel.textContent = member
                    ? (member.nickname || member.realName || '群成员')
                    : '请选择群成员';
            }

            if (payRecipientAvatar) {
                if (member && member.avatarUrl) {
                    payRecipientAvatar.innerHTML = `<img src="${member.avatarUrl}" style="width:100%; height:100%; object-fit:cover; display:block;">`;
                } else if (member) {
                    payRecipientAvatar.innerHTML = `<span>${String(member.nickname || member.realName || '群').charAt(0)}</span>`;
                } else {
                    payRecipientAvatar.innerHTML = `<i class="fas fa-user"></i>`;
                }
            }
        };

        const setRecipientDropdownOpen = (isOpen) => {
            if (payRecipientDropdown) payRecipientDropdown.style.display = isOpen ? 'block' : 'none';
            if (payRecipientArrow) {
                payRecipientArrow.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
            }
        };

        const renderGroupRecipientOptions = (activeFriend) => {
            if (!payRecipientDropdown) return;

            payRecipientDropdown.innerHTML = '';
            selectedRecipientId = null;
            setRecipientTriggerDisplay(null);
            setRecipientDropdownOpen(false);

            if (!activeFriend || activeFriend.type !== 'group') return;

            const recipients = window.imChat.getAvailableGroupRecipients(activeFriend);
            recipients.forEach(member => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'pay-group-recipient-option';
                option.setAttribute('data-member-id', member.id);
                option.style.width = '100%';
                option.style.border = 'none';
                option.style.borderRadius = '14px';
                option.style.background = 'transparent';
                option.style.padding = '10px 10px';
                option.style.display = 'flex';
                option.style.alignItems = 'center';
                option.style.justifyContent = 'space-between';
                option.style.cursor = 'pointer';

                option.innerHTML = `
                    <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                        <div style="width:30px; height:30px; border-radius:50%; overflow:hidden; background:#e5e5ea; color:#8e8e93; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:12px;">
                            ${member.avatarUrl
                                ? `<img src="${member.avatarUrl}" style="width:100%; height:100%; object-fit:cover; display:block;">`
                                : `<span>${String(member.nickname || member.realName || '群').charAt(0)}</span>`}
                        </div>
                        <div style="font-size:14px; color:#111; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${member.nickname || member.realName || '群成员'}</div>
                    </div>
                    <i class="fas fa-check" style="font-size:12px; color:transparent;"></i>
                `;

                option.addEventListener('click', () => {
                    selectedRecipientId = member.id;
                    setRecipientTriggerDisplay(member);
                    payRecipientDropdown.querySelectorAll('.pay-group-recipient-option').forEach(item => {
                        item.style.background = 'transparent';
                        const icon = item.querySelector('.fa-check');
                        if (icon) icon.style.color = 'transparent';
                    });
                    option.style.background = '#f7f7fa';
                    const icon = option.querySelector('.fa-check');
                    if (icon) icon.style.color = '#111';
                    setRecipientDropdownOpen(false);
                });

                payRecipientDropdown.appendChild(option);
            });

            if (recipients.length > 0) {
                const firstOption = payRecipientDropdown.querySelector('.pay-group-recipient-option');
                if (firstOption) firstOption.click();
            }
        };

        const syncPayModeUi = (activeFriend, nextMode = 'transfer') => {
            currentPayMode = nextMode === 'red_packet' ? 'red_packet' : 'transfer';

            payModeTabs.forEach(tab => {
                const isActive = tab.getAttribute('data-pay-mode') === currentPayMode;
                tab.classList.toggle('active', isActive);
                tab.style.color = isActive ? '#000' : '#8e8e93';
                tab.style.fontWeight = isActive ? '700' : '600';
                tab.style.boxShadow = 'none';
                tab.style.background = 'none';
                tab.style.borderRadius = '0';
                tab.style.setProperty('--tab-line-opacity', isActive ? '1' : '0');
                if (isActive) {
                    tab.style.borderBottom = '2px solid #111';
                } else {
                    tab.style.borderBottom = '2px solid transparent';
                }
            });

            if (payTransferPanel) payTransferPanel.style.display = currentPayMode === 'transfer' ? 'block' : 'none';
            if (payRedPacketPanel) payRedPacketPanel.style.display = currentPayMode === 'red_packet' ? 'block' : 'none';

            const isGroupChat = activeFriend && activeFriend.type === 'group';
            if (payRecipientField) {
                payRecipientField.style.display = isGroupChat && currentPayMode === 'transfer' ? 'block' : 'none';
            }
        };

        const closePayTransferForm = () => {
            if (!payFormOverlay) return;
            payFormOverlay.style.display = 'none';
            if (payAmountInput) payAmountInput.value = '';
            if (payDescInput) payDescInput.value = '';
            if (payRedPacketCountInput) payRedPacketCountInput.value = '';
            if (payRedPacketAmountInput) payRedPacketAmountInput.value = '';
            if (payRedPacketDescInput) payRedPacketDescInput.value = '';
            selectedRecipientId = null;
            if (payRecipientDropdown) payRecipientDropdown.innerHTML = '';
            setRecipientTriggerDisplay(null);
            setRecipientDropdownOpen(false);
            currentPayMode = 'transfer';
        };

        const closeVoiceMessageForm = () => {
            if (!voiceFormOverlay) return;
            voiceFormOverlay.style.display = 'none';
            if (voiceTranscriptInput) voiceTranscriptInput.value = '';
        };

        const closeNarrationForm = () => {
            if (!narrationFormOverlay) return;
            narrationFormOverlay.style.display = 'none';
            if (narrationInput) narrationInput.value = '';
        };

        const setRegenerateBusyState = (busy) => {
            const controls = [regenerateEntry, regenerateReferenceBtn, regenerateDirectBtn];
            controls.forEach((control) => {
                if (!control) return;
                control.dataset.busy = busy ? 'true' : 'false';
                control.style.opacity = busy ? '0.45' : '';
                control.style.pointerEvents = busy ? 'none' : '';
            });
        };

        const closeRegenerateForm = () => {
            if (!regenerateFormOverlay) return;
            regenerateFormOverlay.style.display = 'none';
            if (regenerateRequirementInput) regenerateRequirementInput.value = '';
        };

        const renderPayMethodSelection = (requiredAmount, callback) => {
            const sheet = document.getElementById('pay-method-selection-sheet');
            const listEl = document.getElementById('pay-method-selection-list');
            if (!sheet || !listEl) return false;

            const cards = typeof window.getPayCards === 'function' ? window.getPayCards() : [];
            if (cards.length === 0) {
                if (window.showToast) window.showToast('没有可用的银行卡');
                return false;
            }

            listEl.innerHTML = '';
            cards.forEach(c => {
                const el = document.createElement('div');
                el.className = 'pay-bank-card';
                // Always white card for simplicity in picker
                el.style.background = '#ffffff';
                el.style.color = '#000000';
                el.style.borderRadius = '16px';
                el.style.cursor = 'pointer';
                el.style.border = '1px solid #e5e5ea';
                el.style.boxShadow = 'none';
                el.style.height = 'auto';
                el.style.padding = '12px 16px';
                
                const isInsufficient = c.balance < requiredAmount;
                if (isInsufficient) {
                    el.style.opacity = '0.5';
                    el.style.cursor = 'not-allowed';
                }
                
                el.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; flex-direction: column;">
                            <div class="pay-bank-name" style="font-size: 15px; display: flex; align-items: center; gap: 8px;"><i class="${c.icon}"></i> ${c.name}</div>
                            <div class="pay-bank-type" style="font-size: 11px; margin-top: 4px; opacity: 0.8;">${c.cardType} - ${c.number}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 15px; font-weight: 600;">¥${c.balance.toFixed(2)}</div>
                            ${isInsufficient ? '<div style="font-size: 11px; color: #ff3b30; margin-top: 4px;">余额不足</div>' : ''}
                        </div>
                    </div>
                `;
                
                if (!isInsufficient) {
                    el.addEventListener('click', () => {
                        if (window.closeView) window.closeView(sheet);
                        else sheet.style.display = 'none';
                        
                        setTimeout(() => {
                            callback(c.id);
                        }, 300);
                    });
                }
                
                listEl.appendChild(el);
            });

            if (window.openView) window.openView(sheet);
            else sheet.style.display = 'flex';

            return true;
        };

        const openPayTransferForm = () => {
            if (!payFormOverlay) return;
            const activeFriend = window.imData.currentActiveFriend;
            const isGroupChat = activeFriend && activeFriend.type === 'group';

            // Close attachment menu overlay & content
            if (content) content.style.transform = 'translateY(100%)';
            if (overlay) overlay.style.opacity = '0';

            payFormOverlay.style.display = 'flex';
            if (payAmountInput) payAmountInput.value = '';
            if (payDescInput) payDescInput.value = '';
            if (payRedPacketCountInput) payRedPacketCountInput.value = '';
            if (payRedPacketAmountInput) payRedPacketAmountInput.value = '';
            if (payRedPacketDescInput) payRedPacketDescInput.value = '';

            if (payModeTabs.length > 0) {
                payModeTabs.forEach(tab => {
                    tab.style.display = isGroupChat ? 'inline-flex' : 'none';
                });
            }

            renderGroupRecipientOptions(activeFriend);
            syncPayModeUi(activeFriend, 'transfer');

            setTimeout(() => {
                if (payAmountInput) payAmountInput.focus();
            }, 30);
        };

        const openVoiceMessageForm = () => {
            if (!voiceFormOverlay) return;

            if (content) content.style.transform = 'translateY(100%)';
            if (overlay) overlay.style.opacity = '0';

            voiceFormOverlay.style.display = 'flex';
            if (voiceTranscriptInput) {
                voiceTranscriptInput.value = '';
                setTimeout(() => voiceTranscriptInput.focus(), 30);
            }
        };

        const openNarrationForm = () => {
            if (!narrationFormOverlay) return;

            if (content) content.style.transform = 'translateY(100%)';
            if (overlay) overlay.style.opacity = '0';

            narrationFormOverlay.style.display = 'flex';
            if (narrationInput) {
                narrationInput.value = '';
                setTimeout(() => narrationInput.focus(), 30);
            }
        };

        const openRegenerateForm = () => {
            if (!regenerateFormOverlay) return;
            if (regenerateEntry?.dataset?.busy === 'true') return;

            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend || !window.imChat.regenerateLastAiReply) {
                if (window.showToast) window.showToast('暂无可重回的回复');
                return;
            }

            if (content) content.style.transform = 'translateY(100%)';
            if (overlay) overlay.style.opacity = '0';

            regenerateFormOverlay.style.display = 'flex';
            if (regenerateRequirementInput) {
                regenerateRequirementInput.value = '';
                setTimeout(() => regenerateRequirementInput.focus(), 30);
            }
        };

        const renderOfflineTavernBubble = (messageOrText, isUser = true, options = {}) => {
            const contentArea = document.getElementById('offline-tavern-content');
            if (!contentArea) return null;

            const friend = window.imData.currentActiveFriend;
            const rawMessage = messageOrText && typeof messageOrText === 'object'
                ? messageOrText
                : { role: isUser ? 'user' : 'assistant', content: String(messageOrText || ''), timestamp: Date.now() };
            const message = {
                id: rawMessage.id || createOfflineTavernId(rawMessage.role === 'assistant' ? 'offline-ai' : 'offline-user'),
                role: rawMessage.role === 'assistant' ? 'assistant' : 'user',
                content: String(rawMessage.content || ''),
                timestamp: Number(rawMessage.timestamp) || Date.now(),
                tokens: Number(rawMessage.tokens) || 0
            };
            isUser = message.role === 'user';

            const userName = isUser ? (window.userState?.name || '我') : (friend?.nickname || friend?.realName || 'TA');
            const userSign = isUser ? (window.userState?.signature || '这是你的签名') : (friend?.signature || '');
            const userAvatar = isUser ? (window.userState?.avatarUrl || '') : (friend?.avatarUrl || '');
            const floor = Number(options.floor) || 1;
            const depth = Number.isInteger(Number(options.depth)) ? Number(options.depth) : 0;
            const isReadOnly = !!options.readOnly;
            const actionsDisabled = isReadOnly || !!options.actionsDisabled;
            const enableBarrageForMessage = !isUser && isOfflineBarragePromptEnabled(friend);
            const enableChoicesForMessage = !isUser && isOfflineChoicesPromptEnabled(friend);
            const timeText = formatOfflineBubbleTime(message.timestamp);
            const metaText = isUser
                ? `#${floor} · ${countOfflineTextCharacters(message.content)}字 · ${timeText}`
                : `#${floor} · ${message.tokens || estimateOfflineTextTokens(message.content)} tokens · ${timeText}`;

            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = `offline-tavern-bubble ${isUser ? 'user' : 'ai'}`;
            bubbleDiv.setAttribute('data-message-id', message.id);
            bubbleDiv.setAttribute('data-floor', String(floor));
            
            let avatarHtml = `<div class="offline-tavern-avatar"><i class="fas fa-user"></i></div>`;
            if (userAvatar) {
                avatarHtml = `<div class="offline-tavern-avatar"><img src="${escapeSheetHtml(userAvatar)}" alt="avatar"></div>`;
            }

            // 解析 thinking 标签
            let displayThinking = '';
            let rawThinking = '';
            const displayContent = applyOfflineRegexText(friend, message.content, message.role, depth, 'display');
            let displayText = displayContent;
            
            const thinkingMatch = displayContent.match(/<thinking>([\s\S]*?)<\/thinking>/);
            if (thinkingMatch) {
                rawThinking = thinkingMatch[1];
                // 将原始文本中的 thinking 块移除，剩余的作为正文
                displayText = displayContent.replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim();
                
                // 构建可折叠的 thinking 气泡 UI
                displayThinking = `
                    <div class="offline-tavern-thinking-content" data-raw-thinking="${escapeSheetHtml(rawThinking)}" style="display: none; background: #f8f8f8; border: 1px solid #e5e5ea; border-radius: 12px; padding: 10px 14px; margin-top: 8px; font-size: 13px; white-space: pre-wrap; word-break: break-word; color: #666; width: 100%; box-sizing: border-box;">${escapeSheetHtml(rawThinking.trim())}</div>
                `;
            }

            const actionButtonsHtml = actionsDisabled ? '' : `
                <div class="offline-tavern-bubble-actions">
                    <button type="button" class="offline-tavern-action-btn" data-offline-action="edit" title="编辑" aria-label="编辑"><i class="fas fa-pen"></i></button>
                    ${!isUser ? '<button type="button" class="offline-tavern-action-btn" data-offline-action="reroll" title="重回" aria-label="重回"><i class="fas fa-redo"></i></button>' : ''}
                    <button type="button" class="offline-tavern-action-btn danger" data-offline-action="delete" title="删除" aria-label="删除"><i class="fas fa-trash"></i></button>
                </div>
            `;

            bubbleDiv.innerHTML = `
                <div class="offline-tavern-bubble-header">
                    ${avatarHtml}
                    <div class="offline-tavern-name-container">
                        <span class="offline-tavern-name">${escapeSheetHtml(userName)}</span>
                        ${thinkingMatch ? `<i class="fas fa-chevron-down offline-tavern-thinking-icon" style="transition: transform 0.3s; cursor: pointer; color: #8e8e93; margin-left: 4px;"></i>` : ''}
                    </div>
                    ${userSign ? `<div class="offline-tavern-sign">${escapeSheetHtml(userSign)}</div>` : ''}
                    ${displayThinking}
                </div>
                <div class="offline-tavern-bubble-body">
                    <div class="offline-tavern-bubble-text" ${displayText ? '' : 'style="display:none;"'}>${buildOfflineTavernTextHtml(displayText, {
                        messageId: message.id,
                        enableVoice: !isUser,
                        enableBarrage: enableBarrageForMessage,
                        enableChoices: enableChoicesForMessage
                    })}</div>
                    <div class="offline-tavern-bubble-footer">
                        <div class="offline-tavern-bubble-meta">${escapeSheetHtml(metaText)}</div>
                        ${actionButtonsHtml}
                    </div>
                </div>
            `;

            // 绑定折叠/展开事件
            const thinkingIcon = bubbleDiv.querySelector('.offline-tavern-thinking-icon');
            if (thinkingIcon) {
                thinkingIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const content = bubbleDiv.querySelector('.offline-tavern-thinking-content');
                    if (content) {
                        if (content.style.display === 'none') {
                            content.style.display = 'block';
                            thinkingIcon.style.transform = 'rotate(180deg)';
                        } else {
                            content.style.display = 'none';
                            thinkingIcon.style.transform = 'rotate(0deg)';
                        }
                    }
                });
            }

            bubbleDiv.querySelectorAll('[data-offline-action]').forEach((button) => {
                button.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const action = button.getAttribute('data-offline-action');
                    if (action === 'edit') await openOfflineMessageEditor(message.id);
                    if (action === 'delete') await deleteOfflineMessage(message.id);
                    if (action === 'reroll') await rerollOfflineAssistantMessage(message.id, button);
                });
            });

            bindOfflineTavernTextControls(bubbleDiv, { ...message, content: displayContent }, friend, floor);

            contentArea.appendChild(bubbleDiv);
            contentArea.scrollTop = contentArea.scrollHeight;
            return bubbleDiv;
        };

        const createStreamingBubble = (initialText = '', isUser = false, options = {}) => {
            const message = {
                id: options.id || createOfflineTavernId(isUser ? 'offline-user' : 'offline-ai'),
                role: isUser ? 'user' : 'assistant',
                content: initialText,
                timestamp: options.timestamp || Date.now(),
                tokens: options.tokens || 0
            };
            const bubbleDiv = renderOfflineTavernBubble(message, isUser, {
                floor: options.floor,
                depth: options.depth,
                actionsDisabled: true
            });
            if (!bubbleDiv) return null;
            
            let currentText = initialText;
            
            return {
                appendChunk: (chunk) => {
                    currentText += chunk;
                    
                    // 解析流式文本并更新 DOM
                    const displaySource = applyOfflineStreamingRegexText(
                        window.imData.currentActiveFriend,
                        currentText,
                        message.role,
                        Number.isInteger(Number(options.depth)) ? Number(options.depth) : 0
                    );
                    let displayText = displaySource;
                    let displayThinking = '';
                    
                    let isThinkingStarted = false;
                    let isThinkingEnded = false;
                    let currentThinking = '';

                    const startMatch = displaySource.match(/<t(h(i(n(k(i(n(g(>)?)?)?)?)?)?)?)?/);
                    const endMatch = displaySource.match(/<\/t(h(i(n(k(i(n(g(>)?)?)?)?)?)?)?)?/);

                    if (startMatch) {
                        isThinkingStarted = true;
                        const startIdx = startMatch.index;
                        let innerStartIdx = startIdx + startMatch[0].length;

                        // Check if we actually have the full opening tag, otherwise we assume the content hasn't fully started
                        if (displaySource.substring(startIdx, innerStartIdx) !== '<thinking>') {
                            innerStartIdx = startIdx; // Do not parse thinking text yet if tag incomplete
                        }

                        if (endMatch) {
                            const endIdx = endMatch.index;
                            isThinkingEnded = true;
                            // Extract thinking content
                            if (displaySource.substring(startIdx, startIdx + 10) === '<thinking>') {
                                currentThinking = displaySource.substring(startIdx + 10, endIdx);
                            }
                            
                            // displayText is what comes before <thinking and after </thinking>
                            displayText = displaySource.substring(0, startIdx) + displaySource.substring(endIdx + endMatch[0].length);
                        } else {
                            // Thinking has started but not ended
                            if (displaySource.substring(startIdx, startIdx + 10) === '<thinking>') {
                                currentThinking = displaySource.substring(startIdx + 10);
                            }
                            // Only show text before the thinking tag started
                            displayText = displaySource.substring(0, startIdx);
                        }
                    }
                    
                    let thinkingHtml = '';
                    let thinkingIconHtml = '';
                    
                    if (isThinkingStarted) {
                        thinkingIconHtml = `<i class="fas fa-chevron-down offline-tavern-thinking-icon" style="transition: transform 0.3s; cursor: pointer; color: #8e8e93; margin-left: 4px; ${!isThinkingEnded ? 'transform: rotate(180deg);' : ''}"></i>`;
                        thinkingHtml = `
                            <div class="offline-tavern-thinking-content" data-raw-thinking="${escapeSheetHtml(currentThinking)}" style="${isThinkingEnded ? 'display: none;' : 'display: block;'} background: #f8f8f8; border: 1px solid #e5e5ea; border-radius: 12px; padding: 10px 14px; margin-top: 8px; font-size: 13px; white-space: pre-wrap; word-break: break-word; color: #666; width: 100%; box-sizing: border-box;">${escapeSheetHtml(currentThinking.trim() || '思考中...')}</div>
                        `;
                    }
                    
                    const header = bubbleDiv.querySelector('.offline-tavern-bubble-header');
                    if (header) {
                        const nameContainer = header.querySelector('.offline-tavern-name-container');
                        if (nameContainer) {
                            const existingIcon = nameContainer.querySelector('.offline-tavern-thinking-icon');
                            if (thinkingIconHtml && !existingIcon) {
                                nameContainer.insertAdjacentHTML('beforeend', thinkingIconHtml);
                                
                                // 为新添加的图标绑定事件
                                const newIcon = nameContainer.querySelector('.offline-tavern-thinking-icon');
                                newIcon.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    const content = bubbleDiv.querySelector('.offline-tavern-thinking-content');
                                    if (content) {
                                        if (content.style.display === 'none') {
                                            content.style.display = 'block';
                                            newIcon.style.transform = 'rotate(180deg)';
                                        } else {
                                            content.style.display = 'none';
                                            newIcon.style.transform = 'rotate(0deg)';
                                        }
                                    }
                                });
                            } else if (existingIcon && !isThinkingEnded) {
                                existingIcon.style.transform = 'rotate(180deg)';
                            } else if (existingIcon && isThinkingEnded && existingIcon.dataset.autoClosed !== 'true') {
                                // Auto close it once when ended
                                existingIcon.style.transform = 'rotate(0deg)';
                                existingIcon.dataset.autoClosed = 'true';
                            }
                        }
                        
                        let thinkingContent = header.querySelector('.offline-tavern-thinking-content');
                        if (thinkingHtml) {
                            if (!thinkingContent) {
                                header.insertAdjacentHTML('beforeend', thinkingHtml);
                            } else {
                                thinkingContent.setAttribute('data-raw-thinking', currentThinking);
                                thinkingContent.innerHTML = escapeSheetHtml(currentThinking.trim() || '思考中...');
                                if (!isThinkingEnded && thinkingContent.style.display === 'none') {
                                    thinkingContent.style.display = 'block';
                                } else if (isThinkingEnded && thinkingContent.dataset.autoClosed !== 'true') {
                                    thinkingContent.style.display = 'none';
                                    thinkingContent.dataset.autoClosed = 'true';
                                }
                            }
                        }
                    }
                    
                    let textEl = bubbleDiv.querySelector('.offline-tavern-bubble-text');
                    if (displayText.trim() !== '') {
                        if (!textEl) {
                            bubbleDiv.insertAdjacentHTML('beforeend', `<div class="offline-tavern-bubble-text"></div>`);
                            textEl = bubbleDiv.querySelector('.offline-tavern-bubble-text');
                        }
                        textEl.style.display = '';
                        textEl.innerHTML = buildOfflineTavernTextHtml(displayText, {
                            messageId: message.id,
                            enableVoice: !isUser,
                            enableBarrage: !isUser && isOfflineBarragePromptEnabled(window.imData.currentActiveFriend),
                            enableChoices: !isUser && isOfflineChoicesPromptEnabled(window.imData.currentActiveFriend)
                        });
                        bindOfflineTavernTextControls(bubbleDiv, message, window.imData.currentActiveFriend, Number(options.floor) || 1);
                    } else if (textEl) {
                        // Clear text if it became empty (e.g. was a partial thinking tag)
                        textEl.innerHTML = '';
                        textEl.style.display = 'none';
                    }
                    
                    const contentArea = document.getElementById('offline-tavern-content');
                    if (contentArea) {
                        // Keep scrolled to bottom during generation
                        contentArea.scrollTop = contentArea.scrollHeight;
                    }
                },
                setTokens: (tokens) => {
                    const safeTokens = Math.max(0, Number(tokens) || 0);
                    const metaEl = bubbleDiv.querySelector('.offline-tavern-bubble-meta');
                    if (metaEl) {
                        metaEl.textContent = `#${Number(options.floor) || 1} · ${safeTokens || estimateOfflineTextTokens(currentText)} tokens · ${formatOfflineBubbleTime(message.timestamp)}`;
                    }
                },
                getFullText: () => currentText
            };
        };

        const persistOfflineMessages = async (activeFriend, messages, options = {}) => {
            if (!activeFriend) return [];
            let normalized = cloneOfflineMeetingMessages(messages);
            if (offlineRegexEngine) {
                normalized = offlineRegexEngine.applyStorageRules(normalized, getOfflineRegexScripts(activeFriend), {
                    resetMessageIds: options.resetMessageIds || []
                });
            }
            activeFriend.offlineMessages = normalized;
            await commitSheetFriendChange(activeFriend, (targetFriend) => {
                targetFriend.offlineMessages = normalized;
            }, { silent: true, metaOnly: true });
            return normalized;
        };

        const ensureOfflineMeetingState = async (activeFriend) => {
            if (!activeFriend) return null;
            normalizeOfflineMeetingSessions(activeFriend);
            normalizeOfflineMessagesForFriend(activeFriend);

            const needsNewSession = activeFriend.offlineMeetingActive !== true || !activeFriend.offlineCurrentSessionId;
            if (needsNewSession) {
                const now = Date.now();
                activeFriend.offlineMeetingActive = true;
                activeFriend.offlineCurrentSessionId = activeFriend.offlineCurrentSessionId || createOfflineTavernId('offline-session');
                activeFriend.offlineMeetingStartedAt = Number(activeFriend.offlineMeetingStartedAt) || now;
                if (!Array.isArray(activeFriend.offlineMessages)) activeFriend.offlineMessages = [];
                await commitSheetFriendChange(activeFriend, (targetFriend) => {
                    targetFriend.offlineMeetingActive = true;
                    targetFriend.offlineCurrentSessionId = activeFriend.offlineCurrentSessionId;
                    targetFriend.offlineMeetingStartedAt = activeFriend.offlineMeetingStartedAt;
                    targetFriend.offlineMessages = activeFriend.offlineMessages;
                }, { silent: true, metaOnly: true });
            }

            await removeOfflineMeetingActiveNotice(activeFriend);
            return activeFriend.offlineCurrentSessionId;
        };

        const renderOfflineHistoryButton = (contentArea, activeFriend) => {
            const sessions = normalizeOfflineMeetingSessions(activeFriend);
            if (sessions.length === 0) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'offline-tavern-history-card';
            button.innerHTML = `<i class="fas fa-history"></i><span>查看历史见面</span>`;
            button.addEventListener('click', () => renderOfflineHistoryList(activeFriend));
            contentArea.appendChild(button);
        };

        function renderOfflineCurrentMessages(activeFriend) {
            const contentArea = document.getElementById('offline-tavern-content');
            if (!contentArea || !activeFriend) return;
            contentArea.innerHTML = '';
            const titleEl = document.querySelector('#offline-tavern-view .offline-tavern-title');
            if (titleEl) titleEl.textContent = '线下';
            renderOfflineHistoryButton(contentArea, activeFriend);

            const messages = normalizeOfflineMessagesForFriend(activeFriend);
            messages.forEach((message, index) => {
                renderOfflineTavernBubble(message, message.role === 'user', {
                    floor: index + 1,
                    depth: messages.length - 1 - index
                });
            });

            if (messages.length === 0 && normalizeOfflineMeetingSessions(activeFriend).length === 0) {
                const placeholder = document.createElement('div');
                placeholder.className = 'offline-tavern-placeholder';
                placeholder.textContent = '开始一次线下见面';
                contentArea.appendChild(placeholder);
            }
            contentArea.scrollTop = contentArea.scrollHeight;
        }

        function renderOfflineHistoryList(activeFriend) {
            const contentArea = document.getElementById('offline-tavern-content');
            if (!contentArea || !activeFriend) return;
            const sessions = normalizeOfflineMeetingSessions(activeFriend).slice().sort((a, b) => Number(b.endedAt) - Number(a.endedAt));
            contentArea.innerHTML = '';
            const titleEl = document.querySelector('#offline-tavern-view .offline-tavern-title');
            if (titleEl) titleEl.textContent = '历史见面';

            const backBtn = document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = 'offline-tavern-history-back';
            backBtn.innerHTML = '<i class="fas fa-chevron-left"></i> 返回当前见面';
            backBtn.addEventListener('click', () => renderOfflineCurrentMessages(activeFriend));
            contentArea.appendChild(backBtn);

            if (sessions.length === 0) {
                const placeholder = document.createElement('div');
                placeholder.className = 'offline-tavern-placeholder';
                placeholder.textContent = '还没有历史见面';
                contentArea.appendChild(placeholder);
                return;
            }

            sessions.forEach((session) => {
                const card = document.createElement('div');
                card.className = 'offline-tavern-history-session';
                card.setAttribute('role', 'button');
                card.tabIndex = 0;
                const summary = String(session.summary || session.rawSummary || '').trim();
                card.innerHTML = `
                    <button type="button" class="offline-tavern-history-delete" aria-label="删除见面记录" title="删除见面记录"><i class="fas fa-trash"></i></button>
                    <div class="offline-tavern-history-title">${escapeSheetHtml(session.title || '见面记录')}</div>
                    <div class="offline-tavern-history-meta">${escapeSheetHtml(session.dateText || formatOfflineMeetingDate(session.endedAt))} · ${session.messages.length} 楼</div>
                    ${summary ? `<div class="offline-tavern-history-summary">${escapeSheetHtml(summary)}</div>` : ''}
                `;
                const openSession = () => renderOfflineHistoricalSession(activeFriend, session);
                card.addEventListener('click', (event) => {
                    const targetEl = event.target instanceof Element ? event.target : null;
                    if (targetEl?.closest('.offline-tavern-history-delete')) return;
                    openSession();
                });
                card.addEventListener('keydown', (event) => {
                    const targetEl = event.target instanceof Element ? event.target : null;
                    if (targetEl?.closest('.offline-tavern-history-delete')) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openSession();
                    }
                });
                const deleteBtn = card.querySelector('.offline-tavern-history-delete');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        confirmDeleteOfflineMeetingSession(activeFriend, session, deleteBtn);
                    });
                }
                contentArea.appendChild(card);
            });
        }

        function renderOfflineHistoricalSummary(activeFriend, session) {
            const contentArea = document.getElementById('offline-tavern-content');
            if (!contentArea || !session) return;

            const card = document.createElement('div');
            card.className = 'offline-tavern-history-detail-summary';
            const summaryText = String(session.summary || session.rawSummary || '').trim();
            card.innerHTML = `
                <div class="offline-tavern-history-detail-summary-head">
                    <div>
                        <div class="offline-tavern-history-detail-summary-title">见面总结</div>
                        <div class="offline-tavern-history-detail-summary-meta">${escapeSheetHtml(session.dateText || formatOfflineMeetingDate(session.endedAt))}</div>
                    </div>
                    <button type="button" class="offline-tavern-history-summary-edit" aria-label="编辑总结" title="编辑总结"><i class="fas fa-pen"></i></button>
                </div>
                <div class="offline-tavern-history-detail-summary-text">${summaryText ? escapeSheetHtml(summaryText) : '暂无总结'}</div>
                <textarea class="offline-tavern-history-summary-textarea" aria-label="见面总结">${escapeSheetHtml(summaryText)}</textarea>
                <div class="offline-tavern-history-summary-actions">
                    <button type="button" class="offline-tavern-history-summary-cancel">取消</button>
                    <button type="button" class="offline-tavern-history-summary-save">保存</button>
                </div>
            `;

            const textEl = card.querySelector('.offline-tavern-history-detail-summary-text');
            const textarea = card.querySelector('.offline-tavern-history-summary-textarea');
            const actionsEl = card.querySelector('.offline-tavern-history-summary-actions');
            const editBtn = card.querySelector('.offline-tavern-history-summary-edit');
            const cancelBtn = card.querySelector('.offline-tavern-history-summary-cancel');
            const saveBtn = card.querySelector('.offline-tavern-history-summary-save');
            let isEditing = false;

            const setEditing = (editing) => {
                isEditing = editing;
                card.classList.toggle('is-editing', editing);
                if (textarea) textarea.value = editing ? String(session.summary || session.rawSummary || '').trim() : textarea.value;
                if (editing) setTimeout(() => textarea?.focus(), 30);
            };

            editBtn?.addEventListener('click', () => setEditing(true));
            cancelBtn?.addEventListener('click', () => setEditing(false));
            saveBtn?.addEventListener('click', async () => {
                if (!isEditing || !textarea) return;
                const nextSummary = textarea.value.trim();
                saveBtn.disabled = true;
                cancelBtn.disabled = true;
                try {
                    const saved = await updateOfflineMeetingSessionSummary(activeFriend, session, nextSummary);
                    if (!saved) {
                        if (window.showToast) window.showToast('总结保存失败');
                        return;
                    }
                    session.summary = nextSummary;
                    session.rawSummary = buildOfflineMeetingRawSummary(session, nextSummary);
                    if (textEl) textEl.textContent = nextSummary || '暂无总结';
                    setEditing(false);
                    if (window.showToast) window.showToast('总结已保存');
                } catch (error) {
                    console.error('Update offline meeting summary failed', error);
                    if (window.showToast) window.showToast('总结保存失败');
                } finally {
                    saveBtn.disabled = false;
                    cancelBtn.disabled = false;
                }
            });

            textarea?.addEventListener('keydown', (event) => {
                if (event.isComposing || event.keyCode === 229) return;
                if ((event.ctrlKey || event.metaKey) && (event.key === 'Enter' || event.keyCode === 13)) {
                    event.preventDefault();
                    saveBtn?.click();
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    setEditing(false);
                }
            });

            contentArea.appendChild(card);
        }

        function renderOfflineHistoricalSession(activeFriend, session) {
            const contentArea = document.getElementById('offline-tavern-content');
            if (!contentArea || !session) return;
            contentArea.innerHTML = '';
            const titleEl = document.querySelector('#offline-tavern-view .offline-tavern-title');
            if (titleEl) titleEl.textContent = session.title || '历史见面';

            const backBtn = document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = 'offline-tavern-history-back';
            backBtn.innerHTML = '<i class="fas fa-chevron-left"></i> 返回历史见面';
            backBtn.addEventListener('click', () => renderOfflineHistoryList(activeFriend));
            contentArea.appendChild(backBtn);

            const messages = cloneOfflineMeetingMessages(session.messages || []);
            messages.forEach((message, index) => {
                renderOfflineTavernBubble(message, message.role === 'user', {
                    floor: index + 1,
                    depth: messages.length - 1 - index,
                    readOnly: true
                });
            });
            renderOfflineHistoricalSummary(activeFriend, session);
            contentArea.scrollTop = contentArea.scrollHeight;
        }

        function ensureOfflineBarrageView() {
            let view = document.getElementById('offline-tavern-barrage-view');
            if (view) return view;

            view = document.createElement('div');
            view.id = 'offline-tavern-barrage-view';
            view.className = 'offline-tavern-barrage-view';
            view.innerHTML = `
                <div class="offline-tavern-barrage-header">
                    <button type="button" class="offline-tavern-barrage-close" id="offline-tavern-barrage-close-btn" aria-label="返回"><i class="fas fa-chevron-left"></i></button>
                    <div class="offline-tavern-barrage-title" id="offline-tavern-barrage-title">弹幕</div>
                    <div class="offline-tavern-barrage-spacer"></div>
                </div>
                <div class="offline-tavern-barrage-list" id="offline-tavern-barrage-list"></div>
            `;
            document.body.appendChild(view);

            const closeBtn = view.querySelector('#offline-tavern-barrage-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    view.classList.remove('active');
                    setTimeout(() => {
                        view.style.display = 'none';
                    }, 180);
                });
            }
            return view;
        }

        function openOfflineBarrageView({ floor = 1, paragraphIndex = 0, barrages = [] } = {}) {
            const view = ensureOfflineBarrageView();
            const titleEl = view.querySelector('#offline-tavern-barrage-title');
            const listEl = view.querySelector('#offline-tavern-barrage-list');
            const cleanBarrages = (Array.isArray(barrages) ? barrages : [])
                .filter(item => item && item.text)
                .map(item => ({
                    name: String(item.name || '观众').trim() || '观众',
                    text: String(item.text || '').trim(),
                    likes: Number(item.likes) > 0
                        ? Math.max(0, Math.round(Number(item.likes) || 0))
                        : getOfflineBarrageRandomLikes()
                }));

            if (titleEl) titleEl.textContent = `#${floor} · 弹幕`;
            if (listEl) {
                listEl.innerHTML = cleanBarrages.length > 0
                    ? cleanBarrages.map(item => `
                        <div class="offline-tavern-barrage-row">
                            <span class="offline-tavern-barrage-name">${escapeSheetHtml(item.name)}</span>
                            <span class="offline-tavern-barrage-text">${escapeSheetHtml(item.text)}</span>
                            <span class="offline-tavern-barrage-likes"><i class="fas fa-thumbs-up"></i>${item.likes}</span>
                        </div>
                    `).join('')
                    : '<div class="offline-tavern-barrage-empty">暂无弹幕</div>';
                listEl.scrollTop = 0;
            }

            view.style.display = 'flex';
            void view.offsetWidth;
            view.classList.add('active');
        }

        async function openOfflineMessageEditor(messageId) {
            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend) return;
            const messages = normalizeOfflineMessagesForFriend(activeFriend);
            const index = messages.findIndex(message => String(message.id) === String(messageId));
            if (index < 0) return;

            const bubble = Array.from(document.querySelectorAll('.offline-tavern-bubble'))
                .find(item => String(item.getAttribute('data-message-id') || '') === String(messageId));
            const textEl = bubble ? bubble.querySelector('.offline-tavern-bubble-text') : null;
            const actionsEl = bubble ? bubble.querySelector('.offline-tavern-bubble-actions') : null;
            if (!bubble || !textEl || textEl.dataset.editing === 'true') return;

            const originalText = messages[index].content || '';
            const originalHtml = textEl.innerHTML;
            const originalDisplay = textEl.style.display;
            const originalMinHeight = textEl.style.minHeight;
            const originalActionsHtml = actionsEl ? actionsEl.innerHTML : '';
            const measuredHeight = Math.ceil(textEl.getBoundingClientRect().height || 0);
            textEl.dataset.editing = 'true';
            textEl.style.display = '';
            if (measuredHeight > 0) textEl.style.minHeight = `${measuredHeight}px`;
            textEl.innerHTML = `<textarea class="offline-tavern-inline-editor">${escapeSheetHtml(originalText)}</textarea>`;

            if (actionsEl) {
                actionsEl.innerHTML = `
                    <button type="button" class="offline-tavern-action-btn" data-inline-edit-action="save" title="保存" aria-label="保存"><i class="fas fa-check"></i></button>
                    <button type="button" class="offline-tavern-action-btn" data-inline-edit-action="cancel" title="取消" aria-label="取消"><i class="fas fa-times"></i></button>
                `;
            }

            const textarea = textEl.querySelector('.offline-tavern-inline-editor');
            const restore = () => {
                textEl.dataset.editing = 'false';
                textEl.innerHTML = originalHtml;
                textEl.style.display = originalDisplay;
                textEl.style.minHeight = originalMinHeight;
                textEl.querySelectorAll('[data-bound]').forEach((control) => {
                    delete control.dataset.bound;
                });
                bindOfflineTavernTextControls(bubble, messages[index], activeFriend, index + 1);
                if (actionsEl) {
                    actionsEl.innerHTML = originalActionsHtml;
                    actionsEl.querySelectorAll('[data-offline-action]').forEach((button) => {
                        button.addEventListener('click', async (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const action = button.getAttribute('data-offline-action');
                            if (action === 'edit') await openOfflineMessageEditor(messageId);
                            if (action === 'delete') await deleteOfflineMessage(messageId);
                            if (action === 'reroll') await rerollOfflineAssistantMessage(messageId, button);
                        });
                    });
                }
            };
            const save = async () => {
                const nextValue = textarea ? textarea.value : originalText;
                const nextMessages = messages.slice();
                nextMessages[index] = {
                    ...nextMessages[index],
                    content: nextValue,
                    tokens: nextMessages[index].role === 'assistant' ? estimateOfflineTextTokens(nextValue) : undefined,
                    updatedAt: new Date().toISOString(),
                    offlineRegexAppliedRevisions: {}
                };
                await persistOfflineMessages(activeFriend, nextMessages, { resetMessageIds: [messageId] });
                renderOfflineCurrentMessages(activeFriend);
            };

            if (actionsEl) {
                const saveBtn = actionsEl.querySelector('[data-inline-edit-action="save"]');
                const cancelBtn = actionsEl.querySelector('[data-inline-edit-action="cancel"]');
                if (saveBtn) saveBtn.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    await save();
                });
                if (cancelBtn) cancelBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    restore();
                });
            }
            if (textarea) {
                textarea.focus();
                textarea.selectionStart = textarea.value.length;
                textarea.selectionEnd = textarea.value.length;
                textarea.addEventListener('keydown', async (event) => {
                    if (event.isComposing || event.keyCode === 229) return;
                    if ((event.ctrlKey || event.metaKey) && (event.key === 'Enter' || event.keyCode === 13)) {
                        event.preventDefault();
                        await save();
                    }
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        restore();
                    }
                });
            }
        }

        async function deleteOfflineMessage(messageId) {
            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend) return;
            if (!window.confirm('删除这一楼？')) return;
            const messages = normalizeOfflineMessagesForFriend(activeFriend);
            const nextMessages = messages.filter(message => String(message.id) !== String(messageId));
            await persistOfflineMessages(activeFriend, nextMessages);
            renderOfflineCurrentMessages(activeFriend);
        }

        const getOfflineGroupMembers = (activeFriend) => {
            if (!activeFriend || activeFriend.type !== 'group') return [];
            const snapshots = Array.isArray(activeFriend.leftGroupMemberSnapshot)
                ? activeFriend.leftGroupMemberSnapshot
                : [];
            if (Number(activeFriend.leftGroupAt) > 0 && snapshots.length > 0) {
                return snapshots.map((snapshot) => ({
                    id: snapshot.id,
                    realName: snapshot.realName || '',
                    nickname: snapshot.nickname || '',
                    persona: ''
                }));
            }
            const liveMembers = window.imChat?.getGroupMemberFriends
                ? window.imChat.getGroupMemberFriends(activeFriend)
                : [];
            if (liveMembers.length > 0) return liveMembers;

            return snapshots.map((snapshot) => ({
                id: snapshot.id,
                realName: snapshot.realName || '',
                nickname: snapshot.nickname || '',
                persona: ''
            }));
        };

        const getOfflineIdentityContext = (activeFriend, currentUserState = null) => {
            const userState = currentUserState || (window.getUserState ? window.getUserState() : (window.userState || {}));
            const userName = String(userState?.name || userState?.realName || userState?.nickname || 'User').trim() || 'User';
            const isGroup = activeFriend?.type === 'group';
            const groupMembers = isGroup ? getOfflineGroupMembers(activeFriend) : [];
            const memberNames = Array.from(new Set(groupMembers
                .map(member => String(member?.realName || member?.nickname || '').trim())
                .filter(Boolean)));
            const charName = isGroup
                ? (memberNames.join('、') || String(activeFriend?.realName || activeFriend?.nickname || '群成员').trim() || '群成员')
                : (String(activeFriend?.realName || activeFriend?.nickname || 'Char').trim() || 'Char');

            return {
                userName,
                charName,
                isGroup,
                groupMembers
            };
        };

        const replaceOfflinePromptVariables = (content, identityContext) => String(content || '')
            .replace(/\{\{user\}\}/g, () => identityContext.userName)
            .replace(/\{\{char\}\}/g, () => identityContext.charName);

        const getOfflineContextMessages = (activeFriend, offlineMessages) => {
            const currentUserState = window.getUserState ? window.getUserState() : (window.userState || {});
            const { userName } = getOfflineIdentityContext(activeFriend, currentUserState);
            const onlineMessages = Array.isArray(activeFriend?.messages) ? activeFriend.messages : [];
            const combined = [];

            onlineMessages.forEach((message) => {
                if (message?.type === 'system_notice' && message.noticeKind === OFFLINE_ACTIVE_NOTICE_KIND) return;
                let formatted = null;
                if (window.imApp?.formatMessageForApiContext) {
                    formatted = window.imApp.formatMessageForApiContext(message, activeFriend, { userName });
                }
                const role = formatted?.role || (message.role === 'assistant' || message.role === 'char' ? 'assistant' : (message.role === 'system' ? 'system' : 'user'));
                const content = formatted?.content || message.content || message.text || '';
                if (content) {
                    combined.push({
                        role,
                        content,
                        timestamp: Number(message.timestamp) || 0,
                        isOffline: false
                    });
                }
            });

            cloneOfflineMeetingMessages(offlineMessages).forEach((message) => {
                if (message.content) {
                    combined.push({
                        role: message.role === 'assistant' ? 'assistant' : 'user',
                        content: message.content,
                        timestamp: Number(message.timestamp) || 0,
                        isOffline: true
                    });
                }
            });

            combined.sort((a, b) => a.timestamp - b.timestamp);
            const mounted = combined.slice(-60);
            let depth = 0;
            for (let index = mounted.length - 1; index >= 0; index -= 1) {
                const message = mounted[index];
                if (message.role !== 'user' && message.role !== 'assistant') continue;
                const promptContent = applyOfflineRegexText(activeFriend, message.content, message.role, depth, 'prompt');
                message.content = message.isOffline ? stripOfflineDecorativeMarkup(promptContent) : promptContent;
                depth += 1;
            }
            return mounted.map(({ isOffline, ...message }) => message).filter(message => message.content);
        };

        const buildOfflineApiMessages = (activeFriend, offlineMessagesForContext) => {
            const currentUserState = window.getUserState ? window.getUserState() : (window.userState || {});
            const identityContext = getOfflineIdentityContext(activeFriend, currentUserState);
            const { userName, charName, isGroup } = identityContext;
            const systemPrompt = isGroup
                ? `You are the narrator and director of a fictional face-to-face group scene centered on ${userName}, involving these group members: ${charName}. You are not the group itself and must not speak as a single group entity.`
                : `You are the narrator and director of a fictional face-to-face scene centered on ${userName}, featuring ${charName}. Write narrative fiction rather than speaking as an assistant.`;
            const historyMessages = getOfflineContextMessages(activeFriend, offlineMessagesForContext);
            const worldBookContextText = [
                ...historyMessages.map(m => m.content || ''),
                activeFriend.persona || '',
                currentUserState.persona || '',
                activeFriend.memory?.overview || ''
            ].filter(Boolean).join('\n');
            const worldBookContexts = getOfflineWorldBookContexts(activeFriend, worldBookContextText);
            const dataZoneContext = buildOfflineDataZoneContext({
                activeFriend,
                currentUserState,
                userName,
                charName,
                identityContext,
                historyMessages,
                worldBookContexts
            });
            const memorySystemContext = buildOfflineMemorySystemContext(activeFriend, worldBookContextText);
            const finalPrompts = [];
            const offlinePrompts = ensureOfflinePromptsForFriend(activeFriend);

            for (let p of offlinePrompts) {
                const isEnabled = p.alwaysEnabled || p.enabled;
                if (!isEnabled) continue;
                if (p.id === 'data_zone') finalPrompts.push(replaceOfflinePromptVariables(dataZoneContext, identityContext));
                else if (p.id === 'memory_system') finalPrompts.push(replaceOfflinePromptVariables(memorySystemContext, identityContext));
                else if (p.content && p.content.trim()) finalPrompts.push(replaceOfflinePromptVariables(p.content.trim(), identityContext));
            }

            const combinedPromptsText = finalPrompts.join('\n\n');
            if (combinedPromptsText) {
                const insertIndex = Math.max(0, historyMessages.length - 3);
                historyMessages.splice(insertIndex, 0, {
                    role: 'system',
                    content: `[System Instruction for Current Roleplay]:\n${combinedPromptsText}`
                });
            }

            return [
                { role: 'system', content: systemPrompt },
                ...historyMessages.map(message => ({
                    role: message.role,
                    content: message.content
                }))
            ];
        };

        const requestOfflineAssistantReply = async (apiMessages, streamingBubble = null, options = {}) => {
            const currentApiConfig = window.getApiConfig ? window.getApiConfig() : (window.apiConfig || {});
            if (!currentApiConfig.endpoint || !currentApiConfig.apiKey) {
                throw new Error('API config missing');
            }
            const signal = options.signal || null;

            let endpoint = currentApiConfig.endpoint;
            if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
            if (!endpoint.endsWith('/chat/completions')) {
                endpoint = endpoint.endsWith('/v1') ? `${endpoint}/chat/completions` : `${endpoint}/v1/chat/completions`;
            }

            const finishStream = (content, completionTokens = 0, aborted = false) => {
                const finalText = streamingBubble ? streamingBubble.getFullText() : content;
                const tokens = completionTokens || estimateOfflineTextTokens(finalText);
                if (streamingBubble?.setTokens) streamingBubble.setTokens(tokens);
                return { content: finalText, tokens, aborted };
            };

            let response = null;
            try {
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${currentApiConfig.apiKey}`
                    },
                    body: JSON.stringify({
                        model: currentApiConfig.model || '',
                        messages: apiMessages,
                        temperature: parseFloat(currentApiConfig.temperature) || 0.7,
                        stream: true,
                        stream_options: { include_usage: true }
                    }),
                    signal: signal || undefined
                });
            } catch (error) {
                if (signal?.aborted || error?.name === 'AbortError') {
                    return finishStream('', 0, true);
                }
                throw error;
            }

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let done = false;
            let fullText = '';
            let completionTokens = 0;
            let aborted = false;

            while (!done) {
                let readResult = null;
                try {
                    readResult = await reader.read();
                } catch (error) {
                    if (signal?.aborted || error?.name === 'AbortError') {
                        aborted = true;
                        break;
                    }
                    throw error;
                }
                const { value, done: readerDone } = readResult;
                done = readerDone;
                if (!value) continue;
                const chunkStr = decoder.decode(value, { stream: !done });
                const lines = chunkStr.split('\n');
                for (const line of lines) {
                    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
                    try {
                        const data = JSON.parse(line.substring(6));
                        if (data.usage?.completion_tokens != null) {
                            completionTokens = Number(data.usage.completion_tokens) || completionTokens;
                        }
                        const deltaContent = data.choices?.[0]?.delta?.content || data.choices?.[0]?.text || '';
                        if (deltaContent) {
                            fullText += deltaContent;
                            if (streamingBubble) streamingBubble.appendChunk(deltaContent);
                        }
                    } catch (error) {
                        // Ignore incomplete streaming JSON chunks.
                    }
                }
                if (signal?.aborted) {
                    aborted = true;
                    try {
                        await reader.cancel();
                    } catch (error) {
                        // The fetch may already be closed by the abort signal.
                    }
                    break;
                }
            }

            return finishStream(fullText, completionTokens, aborted || !!signal?.aborted);
        };

        const formatOfflineMeetingTranscript = (activeFriend, messages) => {
            const { userName, charName } = getOfflineIdentityContext(activeFriend);
            const normalizedMessages = cloneOfflineMeetingMessages(messages);
            return normalizedMessages.map((message, index) => {
                const speaker = message.role === 'assistant' ? charName : userName;
                const depth = normalizedMessages.length - 1 - index;
                const promptContent = applyOfflineRegexText(activeFriend, message.content, message.role, depth, 'prompt');
                return `#${index + 1} ${speaker}: ${stripOfflineDecorativeMarkup(promptContent)}`;
            }).join('\n\n');
        };

        const parseOfflineMeetingSummary = (rawText, endedAt) => {
            const raw = String(rawText || '').trim();
            const generatedDatePattern = /^(?:(?:日期|时间|当前时间|见面时间|结束时间)[:：]\s*)?(?:\d{4}年\d{1,2}月\d{1,2}日|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\s*$/;
            const lines = raw
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(line => line && !generatedDatePattern.test(line));
            const dateText = formatOfflineMeetingDate(endedAt);
            let title = '见面记录';
            let summary = lines.join('\n\n').trim();

            const titleIndex = lines.findIndex(line => /^标题[:：]/.test(line));
            if (titleIndex >= 0) {
                title = lines[titleIndex].replace(/^标题[:：]\s*/, '').trim() || title;
            } else if (lines.length > 1) {
                const candidate = lines.find(line => !/^见面内容[:：]/.test(line));
                if (candidate) title = candidate.replace(/^#+\s*/, '').trim() || title;
            }

            const contentIndex = lines.findIndex(line => /^见面内容[:：]/.test(line));
            if (contentIndex >= 0) {
                const firstContentLine = lines[contentIndex].replace(/^见面内容[:：]\s*/, '').trim();
                summary = [firstContentLine, ...lines.slice(contentIndex + 1)].filter(Boolean).join('\n\n');
            } else if (lines.length > 0) {
                summary = lines
                    .filter((_, index) => index !== titleIndex)
                    .join('\n\n')
                    .trim() || lines.join('\n\n').trim();
            }

            const normalizedSummary = summary || '本次见面暂无总结。';

            return {
                dateText,
                title,
                summary: normalizedSummary,
                rawSummary: [`标题：${title}`, `见面内容：${normalizedSummary}`].join('\n')
            };
        };

        const requestOfflineMeetingSummary = async (activeFriend, messages) => {
            const currentApiConfig = window.getApiConfig ? window.getApiConfig() : (window.apiConfig || {});
            if (!currentApiConfig.endpoint || !currentApiConfig.apiKey) {
                throw new Error('API config missing');
            }

            let endpoint = currentApiConfig.endpoint;
            if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
            if (!endpoint.endsWith('/chat/completions')) {
                endpoint = endpoint.endsWith('/v1') ? `${endpoint}/chat/completions` : `${endpoint}/v1/chat/completions`;
            }

            const identityContext = getOfflineIdentityContext(activeFriend);
            const charName = identityContext.charName;
            const transcript = formatOfflineMeetingTranscript(activeFriend, messages);
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentApiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: currentApiConfig.model || '',
                    temperature: parseFloat(currentApiConfig.temperature) || 0.5,
                    stream: false,
                    messages: [
                        {
                            role: 'system',
                            content: `Write a concise third-person summary of one completed face-to-face ${identityContext.isGroup ? 'group meeting' : 'meeting'} involving ${charName}. Do not roleplay a new scene. The summary must be limited to Char's perspective: only describe what Char saw, heard, said, did, noticed, or could reasonably infer. Do not use first-person "I" for Char. Do not enter User's or other people's private thoughts. Output exactly two sections in Chinese: first line starts with 标题：, then 见面内容： followed by the summary. Never output any date, time, timestamp, or time-related heading.`
                        },
                        {
                            role: 'user',
                            content: `请以第三人称、Char 限定视角总结以下${identityContext.isGroup ? '群体线下见面' : '线下见面'}的所有楼层。只描述 Char 看到、听到、说出、做出、注意到或能合理推断的事情；不要写 Char 的第一人称“我”，不要进入 User 或其他人的内心。只生成标题和见面内容，不要生成日期或时间。\n\n${transcript}`
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            const data = await response.json();
            return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
        };

        async function endOfflineMeeting(endButton = null) {
            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend) return;
            const messages = normalizeOfflineMessagesForFriend(activeFriend);
            if (messages.length === 0) {
                if (window.showToast) window.showToast('没有可结束的见面内容');
                return;
            }
            const endedAt = Date.now();

            if (endButton) {
                endButton.dataset.busy = 'true';
                endButton.style.opacity = '0.45';
                endButton.style.pointerEvents = 'none';
            }

            try {
                if (window.showToast) window.showToast('正在生成见面总结...');
                const rawSummary = await requestOfflineMeetingSummary(activeFriend, messages);
                const parsed = parseOfflineMeetingSummary(rawSummary, endedAt);
                const sessionId = activeFriend.offlineCurrentSessionId || createOfflineTavernId('offline-session');
                const session = {
                    id: sessionId,
                    startedAt: Number(activeFriend.offlineMeetingStartedAt) || messages[0]?.timestamp || endedAt,
                    endedAt,
                    messages: cloneOfflineMeetingMessages(messages),
                    dateText: parsed.dateText,
                    title: parsed.title,
                    summary: parsed.summary,
                    rawSummary: parsed.rawSummary
                };
                const recordContent = [parsed.dateText, parsed.title, parsed.summary].filter(Boolean).join('\n\n');
                const recordMsg = {
                    id: createOfflineTavernId('meeting'),
                    role: 'system',
                    type: OFFLINE_MEETING_RECORD_TYPE,
                    offlineSessionId: sessionId,
                    endedAt,
                    dateText: parsed.dateText,
                    title: parsed.title,
                    summary: parsed.summary,
                    rawSummary: parsed.rawSummary,
                    meetingMessages: session.messages,
                    content: recordContent,
                    text: `见面记录：${parsed.title}`,
                    timestamp: endedAt
                };

                let savedRecord = true;
                if (window.imApp?.appendFriendMessage) {
                    savedRecord = await window.imApp.appendFriendMessage(activeFriend.id, recordMsg, { silent: true });
                } else {
                    savedRecord = await commitSheetFriendChange(activeFriend, (targetFriend) => {
                        if (!Array.isArray(targetFriend.messages)) targetFriend.messages = [];
                        targetFriend.messages.push(recordMsg);
                    }, { silent: true });
                }
                if (!savedRecord) {
                    throw new Error('Failed to save offline meeting record');
                }

                const sessions = normalizeOfflineMeetingSessions(activeFriend).concat(session);
                activeFriend.offlineMeetingSessions = sessions;
                activeFriend.offlineMessages = [];
                activeFriend.offlineMeetingActive = false;
                activeFriend.offlineCurrentSessionId = null;
                activeFriend.offlineMeetingStartedAt = null;
                await commitSheetFriendChange(activeFriend, (targetFriend) => {
                    targetFriend.offlineMeetingSessions = sessions;
                    targetFriend.offlineMessages = [];
                    targetFriend.offlineMeetingActive = false;
                    targetFriend.offlineCurrentSessionId = null;
                    targetFriend.offlineMeetingStartedAt = null;
                }, { silent: true, metaOnly: true });

                await removeOfflineMeetingActiveNotice(activeFriend);
                renderOfflineCurrentMessages(activeFriend);
                rerenderOnlineChatForFriend(activeFriend, { scroll: true });
                if (window.showToast) window.showToast('见面记录已生成');
            } catch (error) {
                console.error('End offline meeting failed', error);
                if (window.showToast) window.showToast('结束见面失败，请检查 API 配置或网络');
            } finally {
                if (endButton) {
                    endButton.dataset.busy = 'false';
                    endButton.style.opacity = '';
                    endButton.style.pointerEvents = '';
                }
            }
        }

        async function rerollOfflineAssistantMessage(messageId, button = null) {
            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend) return;
            const messages = normalizeOfflineMessagesForFriend(activeFriend);
            const targetIndex = messages.findIndex(message => String(message.id) === String(messageId));
            if (targetIndex < 0 || messages[targetIndex].role !== 'assistant') return;
            const originalMessage = messages[targetIndex];
            const bubble = Array.from(document.querySelectorAll('.offline-tavern-bubble'))
                .find(item => String(item.getAttribute('data-message-id') || '') === String(messageId));
            const textEl = bubble ? bubble.querySelector('.offline-tavern-bubble-text') : null;
            const metaEl = bubble ? bubble.querySelector('.offline-tavern-bubble-meta') : null;
            const actionsEl = bubble ? bubble.querySelector('.offline-tavern-bubble-actions') : null;
            const originalHtml = textEl ? textEl.innerHTML : '';
            const originalDisplay = textEl ? textEl.style.display : '';
            const originalMeta = metaEl ? metaEl.textContent : '';
            const actionButtons = actionsEl ? Array.from(actionsEl.querySelectorAll('button')) : [];
            const rerollTimestamp = Date.now();

            let streamText = '';
            const getVisibleStreamText = () => {
                let displayText = applyOfflineStreamingRegexText(
                    activeFriend,
                    streamText,
                    'assistant',
                    messages.length - 1 - targetIndex
                );
                const startIndex = displayText.indexOf('<thinking>');
                if (startIndex >= 0) {
                    const endIndex = displayText.indexOf('</thinking>', startIndex);
                    displayText = endIndex >= 0
                        ? `${displayText.slice(0, startIndex)}${displayText.slice(endIndex + '</thinking>'.length)}`
                        : displayText.slice(0, startIndex);
                }
                return displayText.trim();
            };
            const renderStreamText = () => {
                if (!textEl || !bubble) return;
                const displayText = getVisibleStreamText();
                textEl.style.display = '';
                textEl.innerHTML = displayText
                    ? buildOfflineTavernTextHtml(displayText, {
                        messageId,
                        enableVoice: true,
                        enableBarrage: isOfflineBarragePromptEnabled(activeFriend),
                        enableChoices: isOfflineChoicesPromptEnabled(activeFriend)
                    })
                    : '<div class="offline-tavern-reroll-placeholder">正在重新思考...</div>';
                bindOfflineTavernTextControls(bubble, {
                    ...originalMessage,
                    content: displayText,
                    timestamp: rerollTimestamp
                }, activeFriend, targetIndex + 1);
                const contentArea = document.getElementById('offline-tavern-content');
                if (contentArea) {
                    const bubbleTop = bubble.offsetTop;
                    if (bubbleTop < contentArea.scrollTop || bubbleTop > contentArea.scrollTop + contentArea.clientHeight - 120) {
                        contentArea.scrollTop = Math.max(0, bubbleTop - 24);
                    }
                }
            };
            const streamingBubble = textEl ? {
                appendChunk: (chunk) => {
                    streamText += chunk;
                    renderStreamText();
                },
                setTokens: (tokens) => {
                    if (metaEl) {
                        const safeTokens = Math.max(0, Number(tokens) || 0);
                        metaEl.textContent = `#${targetIndex + 1} · ${safeTokens || estimateOfflineTextTokens(streamText)} tokens · ${formatOfflineBubbleTime(rerollTimestamp)}`;
                    }
                },
                getFullText: () => streamText
            } : null;

            if (button) {
                button.disabled = true;
                button.style.opacity = '0.45';
            }
            actionButtons.forEach(actionButton => {
                actionButton.disabled = true;
                actionButton.style.opacity = '0.45';
            });
            if (textEl) {
                textEl.dataset.rerolling = 'true';
                textEl.style.display = '';
                textEl.innerHTML = '<div class="offline-tavern-reroll-placeholder">正在重新思考...</div>';
            }

            try {
                const contextMessages = messages.slice(0, targetIndex);
                const apiMessages = buildOfflineApiMessages(activeFriend, contextMessages);
                const { content, tokens } = await requestOfflineAssistantReply(apiMessages, streamingBubble);
                const nextMessages = messages.slice();
                nextMessages[targetIndex] = {
                    ...nextMessages[targetIndex],
                    content,
                    tokens,
                    timestamp: rerollTimestamp,
                    updatedAt: new Date().toISOString(),
                    offlineRegexAppliedRevisions: {}
                };
                await persistOfflineMessages(activeFriend, nextMessages, { resetMessageIds: [messageId] });
                renderOfflineCurrentMessages(activeFriend);
            } catch (error) {
                if (textEl) {
                    textEl.dataset.rerolling = 'false';
                    textEl.innerHTML = originalHtml;
                    textEl.style.display = originalDisplay;
                    textEl.querySelectorAll('[data-bound]').forEach((control) => {
                        delete control.dataset.bound;
                    });
                    bindOfflineTavernTextControls(bubble, originalMessage, activeFriend, targetIndex + 1);
                }
                if (metaEl) metaEl.textContent = originalMeta;
                console.error('Offline reroll failed', error);
                if (window.showToast) window.showToast('重回失败，请检查 API 配置或网络');
            } finally {
                actionButtons.forEach(actionButton => {
                    actionButton.disabled = false;
                    actionButton.style.opacity = '';
                });
                if (button) {
                    button.disabled = false;
                    button.style.opacity = '';
                }
            }
        }

        const openOfflineTavernView = async () => {
            closeSheet();
            const tavernView = document.getElementById('offline-tavern-view');
            if (tavernView) {
                // 恢复普通模式界面
                const inputArea = tavernView.querySelector('.offline-tavern-input-area');
                if (inputArea) inputArea.style.display = '';
                
                const titleEl = tavernView.querySelector('.offline-tavern-title');
                if (titleEl) titleEl.textContent = '线下';
                
                const settingsBtn = tavernView.querySelector('.offline-tavern-settings');
                if (settingsBtn) settingsBtn.style.display = '';
            
                tavernView.style.display = 'flex';
                // Trigger reflow to ensure display:flex is applied before adding active class for animation
                void tavernView.offsetWidth; 
                tavernView.classList.add('active');

                const activeFriend = window.imData.currentActiveFriend;
                if (activeFriend) {
                    await ensureOfflineMeetingState(activeFriend);
                    renderOfflineCurrentMessages(activeFriend);
                }
            }
        };

        const OFFLINE_LEGACY_PROMPT_ID_BY_NAME = {
            '破限和身份定义': 'role_identity',
            '身份定义': 'role_identity',
            '资料区': 'data_zone',
            '语言和字数': 'length_words',
            '字数要求': 'length_words',
            'NSFW': 'nsfw',
            '文风基调': 'style_baimiao',
            '文风-白描': 'style_baimiao',
            '创作指导': 'perspective_third',
            '创作指导-第一人称视角': 'perspective_first',
            '创作指导-第二人称视角': 'perspective_second',
            '创作指导-第三人称视角': 'perspective_third',
            '弹幕评论': 'barrage_comments',
            '玩家选项': 'player_choices',
            '后续选项': 'player_choices',
            '任务要求': 'task_instruction',
            '记忆系统': 'memory_system',
            '记忆区': 'memory_system',
            '格式示例': 'format_rules',
            'COT': 'cot'
        };

        const OFFLINE_PROMPT_RENAMED_DEFAULT_NAME_BY_ID = {
            role_identity: new Set(['破限和身份定义']),
            length_words: new Set(['语言和字数']),
            memory_system: new Set(['记忆系统'])
        };

        const createOfflineDefaultPrompts = () => [
            {
                id: 'role_identity',
                name: '身份定义',
                enabled: true,
                presetVersion: 2,
                content: `<role_setting>
You are U2, not a character inside the story. You are a skilled editor and director creating a fictional cinematic roleplay scene.
{{user}} is the viewpoint center of the scene. {{char}} is the participating Char identity in a private scene, or the complete list of participating Char identities in a group scene.
Preserve their identities, relationship history, boundaries, and current emotional momentum. In a group scene, never treat the group itself as one speaking character.
Write as narrative fiction, not as a real-world assistant. Do not explain your process, policies, or system messages in the final prose.
Keep every scene grounded in concrete action, visible behavior, sensory detail, and continuity from the mounted context.
</role_setting>`,
                editable: true,
                deletable: false
            },
            {
                id: 'data_zone',
                name: '资料区',
                enabled: true,
                content: `<data_zone>
System managed. Mounted world books, User persona, Char persona, and recent online/offline context are inserted here when sending.
</data_zone>`,
                systemManaged: true,
                editable: false,
                deletable: false,
                alwaysEnabled: true
            },
            {
                id: 'length_words',
                name: '字数要求',
                enabled: true,
                content: `<length_requirement>
字数要求：最少800字，最多1200字。
正文必须分段输出。每段约100至150字，段落之间必须保留一个空行，不要把所有文字挤在同一个长段落里。
如果包含对白，仍要让叙述段落和对白自然分开，保持阅读呼吸感。
</length_requirement>`,
                editable: true,
                deletable: false
            },
            {
                id: 'nsfw',
                name: 'NSFW',
                enabled: true,
                content: `<nsfw_rules>
允许符合当前角色关系、场景和用户设定的成人向描写。不要机械跳过情绪、动作、环境和人物反应。
</nsfw_rules>`,
                editable: true,
                deletable: false
            },
            {
                id: 'style_baimiao',
                name: '文风-白描',
                enabled: true,
                content: `<writing_style name="文风-白描">
Use plain description. Prefer nouns and verbs over adjectives.
Show emotion through actions, objects, silence, distance, light, sound, smell, and touch.
Avoid ornate metaphors, abstract emotional labels, and author commentary.
Keep sentences clean and concrete. Let the reader infer what the characters feel from what they do.
</writing_style>`,
                editable: true,
                deletable: false
            },
            {
                id: 'perspective_first',
                name: '创作指导-第一人称视角',
                enabled: false,
                content: `<perspective_rule type="first_person">
Use first-person narration. "I" refers to User.
Only narrate what User can directly see, hear, feel, remember, or infer from the scene.
Do not reveal Char's private thoughts unless they are expressed through visible behavior or dialogue.
</perspective_rule>`,
                editable: true,
                deletable: false
            },
            {
                id: 'perspective_second',
                name: '创作指导-第二人称视角',
                enabled: false,
                content: `<perspective_rule type="second_person">
Use second-person narration. "You" refers to User.
Keep the camera close to User's perception and bodily experience.
Do not summarize information that User cannot perceive inside the current scene.
</perspective_rule>`,
                editable: true,
                deletable: false
            },
            {
                id: 'perspective_third',
                name: '创作指导-第三人称视角',
                enabled: true,
                presetVersion: 2,
                content: `<perspective_rule type="third_person">
必须使用以 {{user}} 为主导、为中心的第三人称限定视角。这是第三人称叙事，不得用“我”代替 {{user}}，也不得把正文写成对 {{user}} 使用“你”的第二人称叙事。
叙事镜头优先贴近 {{user}} 当下能够看见、听见、触碰、回忆或合理推断的内容，并由 {{user}} 的动作、选择和注意力带动剧情。
不得随意进入 {{char}} 的内心或使用全知总结；Char 的情绪、动机和隐私必须通过动作、对白、停顿、表情及场景线索呈现。
群聊场景仍以 {{user}} 为视角锚点，同时观察成员之间的关系、反应与彼此影响，形成层次清楚的群像，而不是轮流点名发言。
</perspective_rule>`,
                editable: true,
                deletable: false
            },
            {
                id: 'barrage_comments',
                name: '弹幕评论',
                enabled: true,
                presetVersion: 3,
                content: `<barrage_comment_rules>
This rule is enabled by default, but the user may turn it off in the offline settings.
When enabled, keep using it in every later offline reply for this character unless the user disables the setting.
Output only barrage comment text. The frontend will create exactly one barrage button after the prose and will generate random likes.
After all prose is finished, add one plain text section headed exactly:
【弹幕】
Then write at least 10 short audience-style comments, one comment per line.
Every line must include the viewer name and content in this exact plain text shape:
观众名字：评论内容
Do not output likes, numbers, XML, HTML, JSON, buttons, labels, or UI instructions.
Comments should sound like viewers reading a novel or watching a film: react to tension, notice details, guess what may happen next, praise the protagonist, or lightly tease the plot.
Do not let barrage comments change the story. They are UI reactions only, not canon and not dialogue.
</barrage_comment_rules>`,
                editable: true,
                deletable: false
            },
            {
                id: 'player_choices',
                name: '玩家选项',
                enabled: true,
                presetVersion: 2,
                content: `<player_choice_rules>
After the final narrative paragraph and any barrage section, output only choice button text. The frontend will create all buttons and option UI.
Add one plain text section headed exactly:
【选项】
Then write exactly 3 short choices, one choice per line. Do not output XML, HTML, JSON, button markup, numbering requirements, or UI instructions.
Each choice should be about 10 Chinese characters, actionable, and able to lead naturally into the next scene or deepen the current tension.
Do not make choices generic. Tie them to the current scene, relationship, objects, and unresolved momentum.
</player_choice_rules>`,
                editable: true,
                deletable: false
            },
            {
                id: 'task_instruction',
                name: '任务要求',
                enabled: true,
                presetVersion: 2,
                content: `<task_instruction>
根据当前剧情、人物动机和最近互动推进故事。优先承接 {{user}} 的最新动作或话语。
处理好互动、对白、身体动作、环境变化和场景节奏，不要只做解释或总结。
若 {{char}} 包含多位群成员，每轮依据最新输入和剧情连续性选取 1 至 2 位主要 Char 重点推动当前片段；其他成员可通过短暂反应、插话、行动和成员间关系自然参与，保持群像小说般的整体感。不要随机轮换主角，也不要让所有成员机械地平均发言。
一件事情不得在一次回复中从开端直接写到完整结局。每轮只推进当前阶段，保留尚未完成的动作、仍在变化的关系或未解决的矛盾。
结尾必须留白：停在一个自然的动作、视线、声音、悬念或等待 {{user}} 决定的节点。不要用总结句收束事件，不要替 {{user}} 做出下一步选择，也不要一次性解决全部问题。
</task_instruction>`,
                editable: true,
                deletable: false
            },
            {
                id: 'memory_system',
                name: '记忆区',
                enabled: true,
                content: `<memory_system>
System managed. Vectorized Char short-term, long-term, and cherished memories are inserted here when sending.
</memory_system>`,
                systemManaged: true,
                editable: false,
                deletable: false,
                alwaysEnabled: true
            },
            {
                id: 'format_rules',
                name: '格式示例',
                enabled: true,
                presetVersion: 2,
                content: `<formatting_rules>
Output narrative prose only. Do not output JSON or Markdown code fences.
Use normal paragraph prose with a blank line between paragraphs.
Every spoken line from Char must be wrapped in Chinese corner quotes, for example: 「我在这里。」 Do not write bare Char dialogue and do not use "Char: dialogue" labels.
If barrage comments are enabled, append exactly one plain 【弹幕】 section after all prose, containing at least 10 lines in the shape 观众名字：评论内容. Do not output likes; the frontend controls random likes.
If player choices are enabled, append a plain 【选项】 section containing exactly three choice text lines.
Do not output XML tags such as <speech>, <barrages>, <barrage>, <choices>, or <choice>; the frontend owns all UI.
If a <thinking> block is produced for the frontend, put it before the prose and keep the final prose outside it.
</formatting_rules>`,
                editable: true,
                deletable: false
            },
            {
                id: 'cot',
                name: 'COT',
                enabled: true,
                presetVersion: 2,
                content: `<thinking_instruction>
Before every prose response, you must first output one <thinking>...</thinking> block.
Inside <thinking>, think through the active world-book facts, personas, memories, recent online/offline context, scene goal, character motivation, narrative perspective, and a concise prose draft plan.
The <thinking> block must appear before the正文 and must be closed before any正文 begins.
After </thinking>, output the final正文 only; do not continue thinking outside the tag.
Keep the thinking concise, specific, and usable for drafting. The正文 must execute the draft plan instead of ignoring it.
</thinking_instruction>`,
                editable: true,
                deletable: false
            }
        ];

        const cloneOfflinePrompt = (prompt) => ({
            id: prompt.id,
            name: prompt.name,
            enabled: prompt.alwaysEnabled ? true : prompt.enabled !== false,
            content: prompt.content || '',
            systemManaged: !!prompt.systemManaged,
            editable: prompt.editable !== false,
            deletable: !!prompt.deletable,
            alwaysEnabled: !!prompt.alwaysEnabled,
            presetVersion: Math.max(0, Number(prompt.presetVersion) || 0)
        });

        const slugOfflinePromptName = (name) => String(name || 'custom')
            .trim()
            .toLowerCase()
            .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 32) || 'custom';

        const groupOfflinePerspectivePrompts = (prompts) => {
            const perspectiveIds = ['perspective_first', 'perspective_second', 'perspective_third'];
            const perspectivePrompts = perspectiveIds
                .map(id => prompts.find(prompt => prompt.id === id))
                .filter(Boolean);
            const barragePrompt = prompts.find(prompt => prompt.id === 'barrage_comments');
            const choicesPrompt = prompts.find(prompt => prompt.id === 'player_choices');
            const groupedPrompts = perspectivePrompts
                .concat(barragePrompt ? [barragePrompt] : [])
                .concat(choicesPrompt ? [choicesPrompt] : []);
            if (groupedPrompts.length <= 1) return prompts;

            const groupedIds = new Set(perspectiveIds.concat(['barrage_comments', 'player_choices']));
            const withoutPerspective = prompts.filter(prompt => !groupedIds.has(prompt.id));
            const styleIndex = withoutPerspective.findIndex(prompt => prompt.id === 'style_baimiao');
            const insertIndex = styleIndex >= 0 ? styleIndex + 1 : Math.min(withoutPerspective.length, 5);
            return [
                ...withoutPerspective.slice(0, insertIndex),
                ...groupedPrompts,
                ...withoutPerspective.slice(insertIndex)
            ];
        };

        const normalizeOfflinePrompts = (sourcePrompts) => {
            const defaults = createOfflineDefaultPrompts();
            const defaultById = new Map(defaults.map(prompt => [prompt.id, prompt]));
            const source = Array.isArray(sourcePrompts) ? sourcePrompts : [];
            if (source.length === 0) return groupOfflinePerspectivePrompts(defaults.map(cloneOfflinePrompt));

            const normalized = [];
            const usedIds = new Set();

            source.forEach((rawPrompt, index) => {
                const prompt = rawPrompt && typeof rawPrompt === 'object' ? rawPrompt : {};
                const rawName = String(prompt.name || '').trim();
                const id = prompt.id || OFFLINE_LEGACY_PROMPT_ID_BY_NAME[rawName] || `custom-${slugOfflinePromptName(rawName)}-${index}`;
                const defaultPrompt = defaultById.get(id);
                const isLegacyDefault = !prompt.id && !!defaultPrompt;
                const isDuplicateDefault = defaultPrompt && usedIds.has(id);

                if (isDuplicateDefault) {
                    const customId = `custom-${slugOfflinePromptName(rawName || defaultPrompt.name)}-${index}`;
                    normalized.push({
                        id: customId,
                        name: rawName || `${defaultPrompt.name} 副本`,
                        enabled: prompt.enabled !== false,
                        content: String(prompt.content || ''),
                        systemManaged: false,
                        editable: true,
                        deletable: true,
                        alwaysEnabled: false
                    });
                    usedIds.add(customId);
                    return;
                }

                if (defaultPrompt) {
                    const item = cloneOfflinePrompt(defaultPrompt);
                    item.enabled = item.alwaysEnabled ? true : (typeof prompt.enabled === 'boolean' ? prompt.enabled : item.enabled);
                    const legacyRenamedNames = OFFLINE_PROMPT_RENAMED_DEFAULT_NAME_BY_ID[id];
                    const shouldUseDefaultName = !rawName || isLegacyDefault || item.systemManaged || legacyRenamedNames?.has(rawName);
                    item.name = (!shouldUseDefaultName && prompt.id && rawName) ? rawName : defaultPrompt.name;
                    const sourcePresetVersion = Math.max(0, Number(prompt.presetVersion) || 0);
                    const targetPresetVersion = Math.max(0, Number(defaultPrompt.presetVersion) || 0);
                    const shouldSyncPreset = ['role_identity', 'perspective_third', 'task_instruction', 'barrage_comments', 'player_choices', 'format_rules', 'cot'].includes(id) && sourcePresetVersion < targetPresetVersion;
                    item.content = item.systemManaged || shouldSyncPreset
                        ? defaultPrompt.content
                        : ((!isLegacyDefault && typeof prompt.content === 'string') ? prompt.content : defaultPrompt.content);
                    const oldStructuredPrompt = /<speech\b|<barrages?\b|<barrage\b|<choices?\b|<choice\b/i.test(item.content || '');
                    if (['barrage_comments', 'player_choices', 'format_rules'].includes(id) && oldStructuredPrompt) {
                        item.content = defaultPrompt.content;
                    }
                    if (id === 'barrage_comments') {
                        item.alwaysEnabled = false;
                        item.enabled = sourcePresetVersion < targetPresetVersion
                            ? true
                            : (typeof prompt.enabled === 'boolean' ? prompt.enabled : item.enabled);
                    }
                    item.presetVersion = targetPresetVersion;
                    normalized.push(item);
                    usedIds.add(id);
                    return;
                }

                normalized.push({
                    id,
                    name: rawName || '自定义条目',
                    enabled: prompt.enabled !== false,
                    content: String(prompt.content || ''),
                    systemManaged: false,
                    editable: true,
                    deletable: prompt.deletable !== false,
                    alwaysEnabled: false
                });
                usedIds.add(id);
            });

            defaults.forEach(defaultPrompt => {
                if (!usedIds.has(defaultPrompt.id)) {
                    normalized.push(cloneOfflinePrompt(defaultPrompt));
                    usedIds.add(defaultPrompt.id);
                }
            });

            return groupOfflinePerspectivePrompts(normalized);
        };

        const serializeOfflinePrompts = (prompts) => JSON.stringify((prompts || []).map(prompt => cloneOfflinePrompt(prompt)));
        let offlinePromptSaveTimer = null;

        const persistOfflinePrompts = async (activeFriend, prompts, options = {}) => {
            if (!activeFriend) return [];
            if (offlinePromptSaveTimer) {
                clearTimeout(offlinePromptSaveTimer);
                offlinePromptSaveTimer = null;
            }
            const normalized = normalizeOfflinePrompts(prompts);
            activeFriend.offlinePrompts = normalized;
            await commitSheetFriendChange(activeFriend, (targetFriend) => {
                targetFriend.offlinePrompts = normalized;
            }, { silent: true, metaOnly: true, ...options });
            return normalized;
        };

        const scheduleOfflinePromptsPersist = (activeFriend, prompts) => {
            if (!activeFriend) return;
            const normalized = normalizeOfflinePrompts(prompts);
            activeFriend.offlinePrompts = normalized;
            if (offlinePromptSaveTimer) clearTimeout(offlinePromptSaveTimer);
            offlinePromptSaveTimer = setTimeout(() => {
                persistOfflinePrompts(activeFriend, normalized);
            }, 350);
        };

        const ensureOfflinePromptsForFriend = (activeFriend) => {
            if (!activeFriend) return [];
            const previous = Array.isArray(activeFriend.offlinePrompts) ? activeFriend.offlinePrompts : [];
            const normalized = normalizeOfflinePrompts(previous);
            if (serializeOfflinePrompts(previous) !== serializeOfflinePrompts(normalized)) {
                activeFriend.offlinePrompts = normalized;
                commitSheetFriendChange(activeFriend, (targetFriend) => {
                    targetFriend.offlinePrompts = normalized;
                }, { silent: true, metaOnly: true });
            }
            return normalized;
        };

        const createCustomOfflinePrompt = () => ({
            id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: '自定义条目',
            enabled: true,
            content: '<custom_instruction>\n在这里输入新的线下提示词。\n</custom_instruction>',
            systemManaged: false,
            editable: true,
            deletable: true,
            alwaysEnabled: false
        });

        const formatOfflinePromptTime = (timestamp) => {
            const value = Number(timestamp);
            if (!Number.isFinite(value) || value <= 0) return '';
            const date = new Date(value);
            const pad = (num) => String(num).padStart(2, '0');
            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        };

        const formatOfflineHistoryForPrompt = (historyMessages, userName, charName) => {
            const messages = Array.isArray(historyMessages) ? historyMessages : [];
            return messages.slice(-60).map((message) => {
                const speaker = message.role === 'assistant' ? charName : userName;
                const timeText = message.timestamp ? `[${formatOfflinePromptTime(message.timestamp)}] ` : '';
                return `${timeText}${speaker}: ${message.content || ''}`;
            }).filter(line => line.trim()).join('\n');
        };

        const getOfflineWorldBookFriend = (friend) => {
            const boundIds = [
                ...(Array.isArray(friend?.boundBooks) ? friend.boundBooks : []),
                ...(Array.isArray(friend?.worldbooks) ? friend.worldbooks : [])
            ].map(id => String(id));
            return {
                ...(friend || {}),
                boundBooks: Array.from(new Set(boundIds))
            };
        };

        const getOfflineWorldBookContexts = (friend, contextText) => {
            const worldBookFriend = getOfflineWorldBookFriend(friend);
            const getter = window.imApp?.getWorldBookContextForFriendByPosition || window.getWorldBookContextForFriendByPosition;
            return {
                systemDepth: getter ? getter('system_depth', worldBookFriend, contextText) : (window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('system_depth', contextText) : ''),
                beforeRole: getter ? getter('before_role', worldBookFriend, contextText) : (window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('before_role', contextText) : ''),
                afterRole: getter ? getter('after_role', worldBookFriend, contextText) : (window.getGlobalWorldBookContextByPosition ? window.getGlobalWorldBookContextByPosition('after_role', contextText) : '')
            };
        };

        const buildOfflineDataZoneContext = ({ activeFriend, currentUserState, userName, charName, identityContext, historyMessages, worldBookContexts }) => {
            const userPersona = currentUserState?.persona || 'A normal user';
            const charPersona = activeFriend?.persona || 'No specific persona';
            const historyText = formatOfflineHistoryForPrompt(historyMessages, userName, charName) || 'None';
            const contexts = worldBookContexts || {};
            const isGroup = !!identityContext?.isGroup;
            const groupMembers = Array.isArray(identityContext?.groupMembers) ? identityContext.groupMembers : [];
            const charProfile = isGroup
                ? `<group_profile>
Group Name: ${activeFriend?.nickname || activeFriend?.realName || 'Group'}
Members:
${groupMembers.length > 0 ? groupMembers.map((member, index) => `- Member ${index + 1}
  True Name: ${member.realName || member.nickname || 'Unknown'}
  Display Name: ${member.nickname || member.realName || 'Unknown'}
  Persona: ${member.persona || 'No specific persona'}`).join('\n') : `- ${charName}`}
</group_profile>`
                : `<char_profile>
Name: ${charName}
Persona: ${charPersona}
</char_profile>`;

            return `<data_zone>
<world_books>
<system_depth>
${contexts.systemDepth || 'None'}
</system_depth>
<before_role>
${contexts.beforeRole || 'None'}
</before_role>
<after_role>
${contexts.afterRole || 'None'}
</after_role>
</world_books>

<user_profile>
Name: ${userName}
Persona: ${userPersona}
</user_profile>

${charProfile}

<recent_context source="online_and_offline_last_30_rounds">
${historyText}
</recent_context>
</data_zone>`;
        };

        const isOfflineMemoryEntryTriggered = (entry, recentText) => {
            if (!entry) return false;
            const text = String(recentText || '');
            const values = [
                entry.keyword,
                entry.title,
                entry.memoryPoints,
                entry.event,
                entry.content
            ].map(value => String(value || '').trim()).filter(Boolean);

            return values.some(value => value.length >= 2 && text.includes(value));
        };

        const pickOfflineMemoryEntries = (entries, recentText, limit) => {
            const cleanEntries = Array.isArray(entries)
                ? entries.filter(entry => entry && (entry.title || entry.event || entry.content || entry.memoryPoints || entry.detail))
                : [];
            if (cleanEntries.length === 0) return [];
            const triggered = cleanEntries.filter(entry => isOfflineMemoryEntryTriggered(entry, recentText));
            return (triggered.length > 0 ? triggered : cleanEntries).slice(-limit);
        };

        const buildOfflineMemorySystemContext = (friend, recentText) => {
            const normalizedFriend = window.imApp?.normalizeFriendData
                ? window.imApp.normalizeFriendData(friend || {})
                : (friend || {});
            const memory = normalizedFriend.memory || {};
            const sections = [];

            if (memory.overview) {
                sections.push(`<core_memory_overview>\n${memory.overview}\n</core_memory_overview>`);
            }
            if (memory.context?.notes) {
                sections.push(`<extra_context_notes>\n${memory.context.notes}\n</extra_context_notes>`);
            }

            const shortTermEntries = pickOfflineMemoryEntries(memory.shortTermEntries, recentText, 8);
            if (shortTermEntries.length > 0) {
                sections.push(`<short_term_memories source="vectorized_char_memory">
${shortTermEntries.map(entry => `<short_term_memory>
<title>${entry.title || 'Memory'}</title>
<content>${entry.event || entry.content || ''}</content>
<memory_points>${entry.memoryPoints || ''}</memory_points>
<degree>${entry.degree || ''}</degree>
</short_term_memory>`).join('\n')}
</short_term_memories>`);
            }

            const longTermEntries = pickOfflineMemoryEntries(memory.longTermEntries, recentText, 8);
            const longTermBlocks = [];
            if (memory.longTerm) longTermBlocks.push(`<memory_text>\n${memory.longTerm}\n</memory_text>`);
            longTermEntries.forEach(entry => {
                longTermBlocks.push(`<memory>
<title>${entry.title || 'Long-term memory'}</title>
<content>${entry.content || ''}</content>
<time>${entry.createdAt || entry.time || ''}</time>
</memory>`);
            });
            if (longTermBlocks.length > 0) {
                sections.push(`<long_term_memories source="vectorized_char_memory">\n${longTermBlocks.join('\n')}\n</long_term_memories>`);
            }

            const cherishedEntries = pickOfflineMemoryEntries(memory.cherishedEntries, recentText, 8);
            const cherishedBlocks = [];
            if (memory.cherished) cherishedBlocks.push(`<memory_text>\n${memory.cherished}\n</memory_text>`);
            cherishedEntries.forEach(entry => {
                cherishedBlocks.push(`<memory>
<title>${entry.title || 'Cherished memory'}</title>
<content>${entry.content || ''}</content>
<detail>${entry.detail || ''}</detail>
<reason>${entry.reason || ''}</reason>
<time>${entry.createdAt || ''}</time>
</memory>`);
            });
            if (cherishedBlocks.length > 0) {
                sections.push(`<cherished_memories source="vectorized_char_memory">\n${cherishedBlocks.join('\n')}\n</cherished_memories>`);
            }

            return `<character_memory_system>
${sections.length > 0 ? sections.join('\n\n') : 'No active vectorized character memory is available yet.'}
</character_memory_system>`;
        };

        const serializeOfflineRegexScripts = (scripts) => JSON.stringify(
            offlineRegexEngine ? offlineRegexEngine.normalizeRules(scripts) : []
        );
        let offlineRegexSaveTimer = null;

        const ensureOfflineRegexScriptsForFriend = (activeFriend) => {
            if (!activeFriend || !offlineRegexEngine) return [];
            const previous = Array.isArray(activeFriend.offlineRegexScripts) ? activeFriend.offlineRegexScripts : [];
            const normalized = offlineRegexEngine.normalizeRules(previous);
            if (serializeOfflineRegexScripts(previous) !== serializeOfflineRegexScripts(normalized)) {
                activeFriend.offlineRegexScripts = normalized;
                commitSheetFriendChange(activeFriend, (targetFriend) => {
                    targetFriend.offlineRegexScripts = normalized;
                }, { silent: true, metaOnly: true });
            }
            return normalized;
        };

        const persistOfflineRegexScripts = async (activeFriend, scripts, options = {}) => {
            if (!activeFriend || !offlineRegexEngine) return [];
            if (offlineRegexSaveTimer) {
                clearTimeout(offlineRegexSaveTimer);
                offlineRegexSaveTimer = null;
            }
            const normalized = offlineRegexEngine.normalizeRules(scripts);
            activeFriend.offlineRegexScripts = normalized;
            await commitSheetFriendChange(activeFriend, (targetFriend) => {
                targetFriend.offlineRegexScripts = normalized;
            }, { silent: true, metaOnly: true });

            if (options.applyMessages !== false) {
                await persistOfflineMessages(activeFriend, normalizeOfflineMessagesForFriend(activeFriend));
                const titleEl = document.querySelector('#offline-tavern-view .offline-tavern-title');
                if (titleEl?.textContent === '线下') renderOfflineCurrentMessages(activeFriend);
            }
            return normalized;
        };

        const scheduleOfflineRegexScriptsPersist = (activeFriend, scripts) => {
            if (!activeFriend || !offlineRegexEngine) return;
            const normalized = offlineRegexEngine.normalizeRules(scripts);
            activeFriend.offlineRegexScripts = normalized;
            if (offlineRegexSaveTimer) clearTimeout(offlineRegexSaveTimer);
            offlineRegexSaveTimer = setTimeout(() => {
                persistOfflineRegexScripts(activeFriend, normalized);
            }, 350);
        };

        const getOfflineRegexValidationError = (rule) => {
            if (!offlineRegexEngine) return '正则引擎未加载';
            const compiled = offlineRegexEngine.compileRule(rule);
            if (compiled.error) return compiled.error;
            if (!offlineRegexEngine.isDepthValid(rule)) return '最大深度不能小于最小深度';
            return '';
        };

        const renderOfflineRegexSettingsEditor = (listEl, activeFriend) => {
            if (!listEl) return;
            listEl.innerHTML = '';
            if (!offlineRegexEngine) {
                listEl.innerHTML = '<div class="offline-regex-empty">正则引擎加载失败</div>';
                return;
            }

            const scripts = ensureOfflineRegexScriptsForFriend(activeFriend);
            const intro = document.createElement('div');
            intro.className = 'offline-regex-intro';
            intro.textContent = '最新消息深度为 0；深度留空表示无限。规则按当前列表从上到下执行。';
            listEl.appendChild(intro);

            if (scripts.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'offline-regex-empty';
                empty.textContent = '暂无正则规则';
                listEl.appendChild(empty);
            }

            scripts.forEach((rule, index) => {
                const card = document.createElement('details');
                card.className = `offline-regex-card${rule.disabled ? ' is-disabled' : ''}`;
                card.open = index === 0;
                card.innerHTML = `
                    <summary class="offline-regex-summary">
                        <span class="offline-regex-summary-name">${escapeSheetHtml(rule.scriptName || `正则 ${index + 1}`)}</span>
                        <span class="offline-regex-summary-state">${rule.disabled ? '已停用' : '已启用'}</span>
                    </summary>
                    <div class="offline-regex-editor">
                        <div class="offline-regex-toolbar">
                            <label class="offline-regex-enabled"><input type="checkbox" data-regex-field="enabled" ${rule.disabled ? '' : 'checked'}><span>启用</span></label>
                            <div class="offline-regex-order-actions">
                                <button type="button" data-regex-action="up" title="上移" ${index === 0 ? 'disabled' : ''}><i class="fas fa-arrow-up"></i></button>
                                <button type="button" data-regex-action="down" title="下移" ${index === scripts.length - 1 ? 'disabled' : ''}><i class="fas fa-arrow-down"></i></button>
                                <button type="button" class="danger" data-regex-action="delete" title="删除"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                        <label class="offline-regex-field"><span>显示名称</span><input type="text" data-regex-field="scriptName" value="${escapeSheetHtml(rule.scriptName)}"></label>
                        <label class="offline-regex-field"><span>查找正则表达式</span><textarea data-regex-field="findRegex" rows="2" placeholder="例如 /foo/gi">${escapeSheetHtml(rule.findRegex)}</textarea></label>
                        <label class="offline-regex-field"><span>替换为</span><textarea data-regex-field="replaceString" rows="2" placeholder="支持 $&、$1 和 {{match}}">${escapeSheetHtml(rule.replaceString)}</textarea></label>
                        <div class="offline-regex-section-label">作用范围</div>
                        <div class="offline-regex-checks">
                            <label><input type="checkbox" data-regex-placement="user" ${rule.placement.includes('user') ? 'checked' : ''}><span>User 输入</span></label>
                            <label><input type="checkbox" data-regex-placement="assistant" ${rule.placement.includes('assistant') ? 'checked' : ''}><span>AI 输出</span></label>
                        </div>
                        <div class="offline-regex-section-label">格式模式</div>
                        <div class="offline-regex-checks vertical">
                            <label><input type="checkbox" data-regex-field="markdownOnly" ${rule.markdownOnly ? 'checked' : ''}><span>仅格式显示</span></label>
                            <label><input type="checkbox" data-regex-field="promptOnly" ${rule.promptOnly ? 'checked' : ''}><span>仅格式提示词</span></label>
                        </div>
                        <div class="offline-regex-depths">
                            <label class="offline-regex-field"><span>最小深度</span><input type="number" min="0" step="1" data-regex-field="minDepth" value="${rule.minDepth === null ? '' : rule.minDepth}" placeholder="无限"></label>
                            <label class="offline-regex-field"><span>最大深度</span><input type="number" min="0" step="1" data-regex-field="maxDepth" value="${rule.maxDepth === null ? '' : rule.maxDepth}" placeholder="无限"></label>
                        </div>
                        <div class="offline-regex-error" role="alert"></div>
                    </div>
                `;

                const errorEl = card.querySelector('.offline-regex-error');
                const summaryName = card.querySelector('.offline-regex-summary-name');
                const summaryState = card.querySelector('.offline-regex-summary-state');
                const refreshValidation = (temporaryError = '') => {
                    const error = temporaryError || getOfflineRegexValidationError(rule);
                    if (errorEl) {
                        errorEl.textContent = error;
                        errorEl.style.display = error ? 'block' : 'none';
                    }
                    card.classList.toggle('has-error', !!error);
                };
                const updateRule = (mutator) => {
                    mutator(rule);
                    rule.revision = Math.max(1, Number(rule.revision) || 1) + 1;
                    scheduleOfflineRegexScriptsPersist(activeFriend, scripts);
                    refreshValidation();
                };

                card.querySelectorAll('[data-regex-field]').forEach((control) => {
                    const field = control.getAttribute('data-regex-field');
                    const eventName = control instanceof HTMLInputElement && control.type === 'checkbox' ? 'change' : 'input';
                    control.addEventListener(eventName, () => {
                        if (field === 'enabled') {
                            updateRule(item => { item.disabled = !control.checked; });
                            card.classList.toggle('is-disabled', rule.disabled);
                            if (summaryState) summaryState.textContent = rule.disabled ? '已停用' : '已启用';
                            return;
                        }
                        if (field === 'markdownOnly' || field === 'promptOnly') {
                            updateRule(item => { item[field] = control.checked; });
                            return;
                        }
                        if (field === 'minDepth' || field === 'maxDepth') {
                            const rawValue = control.value.trim();
                            if (rawValue !== '' && !/^\d+$/.test(rawValue)) {
                                refreshValidation('深度只接受非负整数');
                                return;
                            }
                            updateRule(item => { item[field] = rawValue === '' ? null : Number(rawValue); });
                            return;
                        }
                        updateRule(item => { item[field] = control.value; });
                        if (field === 'scriptName' && summaryName) summaryName.textContent = control.value || `正则 ${index + 1}`;
                    });
                });

                card.querySelectorAll('[data-regex-placement]').forEach((control) => {
                    control.addEventListener('change', () => {
                        const role = control.getAttribute('data-regex-placement');
                        updateRule(item => {
                            const placements = new Set(item.placement);
                            if (control.checked) placements.add(role);
                            else placements.delete(role);
                            item.placement = offlineRegexEngine.PLACEMENTS.filter(value => placements.has(value));
                        });
                    });
                });

                card.querySelectorAll('[data-regex-action]').forEach((button) => {
                    button.addEventListener('click', async (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const action = button.getAttribute('data-regex-action');
                        if (action === 'delete') {
                            if (!window.confirm(`删除正则“${rule.scriptName}”？`)) return;
                            scripts.splice(index, 1);
                        } else {
                            const targetIndex = action === 'up' ? index - 1 : index + 1;
                            if (targetIndex < 0 || targetIndex >= scripts.length) return;
                            [scripts[index], scripts[targetIndex]] = [scripts[targetIndex], scripts[index]];
                        }
                        await persistOfflineRegexScripts(activeFriend, scripts);
                        renderOfflineRegexSettingsEditor(listEl, activeFriend);
                    });
                });

                refreshValidation();
                listEl.appendChild(card);
            });

            const addButton = document.createElement('button');
            addButton.type = 'button';
            addButton.className = 'offline-regex-add';
            addButton.innerHTML = '<i class="fas fa-plus"></i><span>新增正则</span>';
            addButton.addEventListener('click', async () => {
                const nextScripts = scripts.concat(offlineRegexEngine.createRule());
                await persistOfflineRegexScripts(activeFriend, nextScripts);
                renderOfflineRegexSettingsEditor(listEl, activeFriend);
            });
            listEl.appendChild(addButton);
        };

        const renderOfflineTavernSettingsEditor = (listEl, activeFriend) => {
            listEl.innerHTML = '';

            const wbBtnDiv = document.createElement('div');
            wbBtnDiv.style.cssText = 'background:#fff; border-radius:12px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; margin-bottom:8px;';
            wbBtnDiv.innerHTML = `
                <div style="font-size:15px; font-weight:700; color:#000; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-book" style="font-size:14px; color:#007aff;"></i>
                    <span>挂载世界书</span>
                </div>
                <div style="color:#8e8e93; font-size:13px; display:flex; align-items:center; gap:4px;">
                    <span id="offline-tavern-wb-count">${(activeFriend.worldbooks || activeFriend.boundBooks || []).length} 项</span>
                    <i class="fas fa-chevron-right" style="font-size:12px;"></i>
                </div>
            `;
            wbBtnDiv.addEventListener('click', () => {
                const currentIds = activeFriend.worldbooks || activeFriend.boundBooks || [];
                const handleSelection = (newIds) => {
                    activeFriend.worldbooks = newIds;
                    commitSheetFriendChange(activeFriend, (targetFriend) => {
                        targetFriend.worldbooks = newIds;
                    }, { silent: true, metaOnly: true });
                    const countSpan = document.getElementById('offline-tavern-wb-count');
                    if (countSpan) countSpan.textContent = `${newIds.length} 项`;
                };

                if (window.renderWorldBookSelector) {
                    window.renderWorldBookSelector(currentIds, handleSelection);
                } else if (window.renderLegacyWorldBookSelector) {
                    window.renderLegacyWorldBookSelector(currentIds, handleSelection);
                }
            });
            listEl.appendChild(wbBtnDiv);

            const variableHint = document.createElement('div');
            variableHint.style.cssText = 'margin-bottom:8px; padding:11px 14px; border-radius:12px; background:#eef6ff; color:#31506f; font-size:12px; line-height:1.55;';
            variableHint.innerHTML = '<div style="font-weight:800; color:#007aff; margin-bottom:3px;">可用变量</div><div><code>{{user}}</code> 当前 User 名字</div><div><code>{{char}}</code> 单聊为 Char 真名；群聊为全部群成员真名</div>';
            listEl.appendChild(variableHint);

            const prompts = ensureOfflinePromptsForFriend(activeFriend);
            const promptsContainer = document.createElement('div');
            promptsContainer.style.cssText = 'background:#fff; border-radius:12px; display:flex; flex-direction:column; overflow:hidden;';
            listEl.appendChild(promptsContainer);

            const makeIconButton = (iconClass, label, disabled = false) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.setAttribute('aria-label', label);
                button.title = label;
                button.disabled = disabled;
                button.style.cssText = `width:30px; height:30px; border:none; border-radius:15px; background:${disabled ? '#f7f7fa' : '#f2f2f7'}; color:${disabled ? '#c7c7cc' : '#111'}; display:flex; align-items:center; justify-content:center; cursor:${disabled ? 'default' : 'pointer'}; flex-shrink:0;`;
                button.innerHTML = `<i class="${iconClass}" style="font-size:12px;"></i>`;
                return button;
            };

            prompts.forEach((prompt, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.style.cssText = 'padding:12px 14px; display:flex; flex-direction:column; gap:10px; border-bottom:1px solid #f2f2f7;';

                const topRow = document.createElement('div');
                topRow.style.cssText = 'display:flex; align-items:center; gap:8px; cursor:pointer;';

                const moveGroup = document.createElement('div');
                moveGroup.style.cssText = 'display:flex; gap:4px; flex-shrink:0;';
                const upBtn = makeIconButton('fas fa-arrow-up', '上移', index === 0);
                const downBtn = makeIconButton('fas fa-arrow-down', '下移', index === prompts.length - 1);

                upBtn.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    if (index === 0) return;
                    const nextPrompts = prompts.slice();
                    [nextPrompts[index - 1], nextPrompts[index]] = [nextPrompts[index], nextPrompts[index - 1]];
                    await persistOfflinePrompts(activeFriend, nextPrompts);
                    renderOfflineTavernSettingsEditor(listEl, activeFriend);
                });

                downBtn.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    if (index >= prompts.length - 1) return;
                    const nextPrompts = prompts.slice();
                    [nextPrompts[index], nextPrompts[index + 1]] = [nextPrompts[index + 1], nextPrompts[index]];
                    await persistOfflinePrompts(activeFriend, nextPrompts);
                    renderOfflineTavernSettingsEditor(listEl, activeFriend);
                });

                moveGroup.appendChild(upBtn);
                moveGroup.appendChild(downBtn);
                topRow.appendChild(moveGroup);

                const nameWrap = document.createElement('div');
                nameWrap.style.cssText = 'min-width:0; flex:1; display:flex; flex-direction:column; gap:3px;';

                if (prompt.editable !== false) {
                    const nameInput = document.createElement('input');
                    nameInput.type = 'text';
                    nameInput.value = prompt.name || '未命名提示词';
                    nameInput.style.cssText = 'width:100%; border:none; outline:none; background:transparent; color:#000; font-size:15px; font-weight:700; padding:0;';
                    nameInput.addEventListener('click', event => event.stopPropagation());
                    nameInput.addEventListener('input', () => {
                        prompt.name = nameInput.value || '未命名提示词';
                        scheduleOfflinePromptsPersist(activeFriend, prompts);
                    });
                    nameWrap.appendChild(nameInput);
                } else {
                    const nameLabel = document.createElement('div');
                    nameLabel.style.cssText = 'font-size:15px; font-weight:700; color:#000; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
                    nameLabel.textContent = prompt.name || '系统条目';
                    nameWrap.appendChild(nameLabel);
                }

                if (prompt.systemManaged) {
                    const managedLabel = document.createElement('div');
                    managedLabel.style.cssText = 'font-size:11px; color:#007aff; font-weight:700;';
                    managedLabel.textContent = '系统挂载 · 始终开启';
                    nameWrap.appendChild(managedLabel);
                } else if (prompt.alwaysEnabled) {
                    const alwaysLabel = document.createElement('div');
                    alwaysLabel.style.cssText = 'font-size:11px; color:#34c759; font-weight:700;';
                    alwaysLabel.textContent = '已永久开启';
                    nameWrap.appendChild(alwaysLabel);
                }

                topRow.appendChild(nameWrap);

                const actionGroup = document.createElement('div');
                actionGroup.style.cssText = 'display:flex; align-items:center; gap:8px; flex-shrink:0;';

                if (!prompt.alwaysEnabled) {
                    const toggleLabel = document.createElement('label');
                    toggleLabel.className = 'toggle-switch';
                    toggleLabel.style.cssText = 'margin:0;';
                    toggleLabel.addEventListener('click', event => event.stopPropagation());

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = !!prompt.enabled;
                    checkbox.addEventListener('change', () => {
                        prompt.enabled = checkbox.checked;
                        scheduleOfflinePromptsPersist(activeFriend, prompts);
                    });

                    const slider = document.createElement('span');
                    slider.className = 'slider';
                    toggleLabel.appendChild(checkbox);
                    toggleLabel.appendChild(slider);
                    actionGroup.appendChild(toggleLabel);
                }

                if (prompt.deletable) {
                    const deleteBtn = makeIconButton('fas fa-trash', '删除');
                    deleteBtn.style.background = '#fff0f0';
                    deleteBtn.style.color = '#ff3b30';
                    deleteBtn.addEventListener('click', async (event) => {
                        event.stopPropagation();
                        const nextPrompts = prompts.filter((_, promptIndex) => promptIndex !== index);
                        await persistOfflinePrompts(activeFriend, nextPrompts);
                        renderOfflineTavernSettingsEditor(listEl, activeFriend);
                    });
                    actionGroup.appendChild(deleteBtn);
                }

                const expandIcon = document.createElement('i');
                expandIcon.className = 'fas fa-chevron-down';
                expandIcon.style.cssText = 'font-size:13px; color:#8e8e93; transition:transform 0.2s;';
                actionGroup.appendChild(expandIcon);
                topRow.appendChild(actionGroup);

                const contentDiv = document.createElement('div');
                contentDiv.style.cssText = 'display:none; margin-left:68px;';

                if (prompt.editable !== false) {
                    const textarea = document.createElement('textarea');
                    textarea.value = prompt.content || '';
                    textarea.placeholder = '输入提示词内容...';
                    textarea.style.cssText = 'width:100%; min-height:132px; border:none; outline:none; resize:vertical; border-radius:10px; background:#f2f2f7; padding:10px 12px; box-sizing:border-box; font-size:13px; line-height:1.45; color:#333; font-family:inherit; user-select:text;';
                    textarea.addEventListener('click', event => event.stopPropagation());
                    textarea.addEventListener('input', () => {
                        prompt.content = textarea.value;
                        scheduleOfflinePromptsPersist(activeFriend, prompts);
                    });
                    contentDiv.appendChild(textarea);
                } else {
                    const preview = document.createElement('div');
                    preview.style.cssText = 'font-size:13px; color:#666; background:#f2f2f7; padding:10px 12px; border-radius:10px; white-space:pre-wrap; word-break:break-word; line-height:1.45;';
                    preview.textContent = prompt.content || '';
                    contentDiv.appendChild(preview);
                }

                topRow.addEventListener('click', (event) => {
                    if (event.target.closest('button, input, textarea, label')) return;
                    const willOpen = contentDiv.style.display === 'none';
                    contentDiv.style.display = willOpen ? 'block' : 'none';
                    expandIcon.style.transform = willOpen ? 'rotate(180deg)' : 'rotate(0deg)';
                });

                itemDiv.appendChild(topRow);
                itemDiv.appendChild(contentDiv);
                promptsContainer.appendChild(itemDiv);
            });

            if (promptsContainer.lastElementChild) {
                promptsContainer.lastElementChild.style.borderBottom = 'none';
            }

            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.style.cssText = 'width:100%; margin-top:12px; border:none; border-radius:12px; background:#111; color:#fff; height:44px; display:flex; align-items:center; justify-content:center; gap:8px; font-size:15px; font-weight:800; cursor:pointer;';
            addBtn.innerHTML = '<i class="fas fa-plus" style="font-size:13px;"></i><span>增加条目</span>';
            addBtn.addEventListener('click', async () => {
                const nextPrompts = prompts.concat(createCustomOfflinePrompt());
                await persistOfflinePrompts(activeFriend, nextPrompts);
                renderOfflineTavernSettingsEditor(listEl, activeFriend);
            });
            listEl.appendChild(addBtn);
        };

        // Render Offline Tavern Settings
        const renderOfflineTavernSettings = () => {
            const listEl = document.getElementById('offline-tavern-settings-list');
            const regexListEl = document.getElementById('offline-tavern-regex-list');
            if (!listEl || !regexListEl) return;
            listEl.innerHTML = '';
            regexListEl.innerHTML = '';
            
            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend) return;

            renderOfflineTavernSettingsEditor(listEl, activeFriend);
            renderOfflineRegexSettingsEditor(regexListEl, activeFriend);

            const tabButtons = Array.from(document.querySelectorAll('#offline-tavern-settings-tabs [data-offline-settings-tab]'));
            const promptPanel = document.getElementById('offline-tavern-prompts-panel');
            const regexPanel = document.getElementById('offline-tavern-regex-panel');
            const activateTab = (tabName) => {
                const showRegex = tabName === 'regex';
                if (promptPanel) {
                    promptPanel.hidden = showRegex;
                    promptPanel.classList.toggle('active', !showRegex);
                }
                if (regexPanel) {
                    regexPanel.hidden = !showRegex;
                    regexPanel.classList.toggle('active', showRegex);
                }
                tabButtons.forEach((button) => {
                    const active = button.getAttribute('data-offline-settings-tab') === tabName;
                    button.classList.toggle('active', active);
                    button.setAttribute('aria-selected', String(active));
                });
            };
            tabButtons.forEach((button) => {
                button.onclick = () => activateTab(button.getAttribute('data-offline-settings-tab'));
            });
            activateTab('prompts');
        };


        // Offline Tavern logic setup
        const setupOfflineTavernLogic = () => {
            const sendBtn = document.getElementById('offline-tavern-send-btn');
            const inputField = document.getElementById('offline-tavern-input');
            const attachmentBtn = document.getElementById('offline-tavern-attachment-btn');
            const actionSheet = document.getElementById('offline-tavern-action-sheet');
            const actionCancel = document.getElementById('offline-tavern-action-cancel');
            const clearBtn = document.getElementById('offline-tavern-clear-btn');
            const endBtn = document.getElementById('offline-tavern-end-btn');
            const tavernView = document.getElementById('offline-tavern-view');

            let isGenerating = false;
            let currentGenerationController = null;
            
            if (attachmentBtn && actionSheet) {
                attachmentBtn.addEventListener('click', () => {
                    actionSheet.style.display = 'flex';
                    // Trigger reflow
                    void actionSheet.offsetWidth;
                    actionSheet.classList.add('active');
                });
                
                if (actionCancel) {
                    actionCancel.addEventListener('click', () => {
                        actionSheet.classList.remove('active');
                        setTimeout(() => {
                            actionSheet.style.display = 'none';
                        }, 300);
                    });
                }
                
                actionSheet.addEventListener('click', (e) => {
                    if (e.target === actionSheet) {
                        actionSheet.classList.remove('active');
                        setTimeout(() => {
                            actionSheet.style.display = 'none';
                        }, 300);
                    }
                });
            }

            if (clearBtn && tavernView) {
                clearBtn.addEventListener('click', async () => {
                    actionSheet.classList.remove('active');
                    setTimeout(() => {
                        actionSheet.style.display = 'none';
                    }, 300);

                    const activeFriend = window.imData.currentActiveFriend;
                    if (activeFriend) {
                        await persistOfflineMessages(activeFriend, []);
                        renderOfflineCurrentMessages(activeFriend);
                        
                        if (window.showToast) window.showToast('线下聊天记录已清空');
                    }
                });
            }

            if (endBtn && actionSheet) {
                endBtn.addEventListener('click', async () => {
                    if (endBtn.dataset.busy === 'true') return;
                    actionSheet.classList.remove('active');
                    setTimeout(() => {
                        actionSheet.style.display = 'none';
                    }, 300);
                    await endOfflineMeeting(endBtn);
                });
            }
            
            if (sendBtn && inputField) {
                const handleSend = async () => {
                    if (isGenerating) {
                        if (currentGenerationController && !currentGenerationController.signal.aborted) {
                            currentGenerationController.abort();
                            sendBtn.classList.remove('is-generating');
                            sendBtn.classList.add('is-stopping');
                            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                            sendBtn.title = '正在暂停';
                        }
                        return;
                    }
                    const text = inputField.value.trim();
                    if (!text) return;
                    
                    const activeFriend = window.imData.currentActiveFriend;
                    if (!activeFriend) return;

                    // 获取当前 API Config
                    const currentApiConfig = window.getApiConfig ? window.getApiConfig() : (window.apiConfig || {});
                    if (!currentApiConfig.endpoint || !currentApiConfig.apiKey) {
                        if (window.showToast) window.showToast('请先配置 API');
                        return;
                    }

                    {
                        inputField.value = '';
                        isGenerating = true;
                        const generationController = new AbortController();
                        currentGenerationController = generationController;
                        inputField.disabled = true;
                        const sendOriginalBtnContent = sendBtn.innerHTML;
                        const sendOriginalTitle = sendBtn.title || '';
                        sendBtn.classList.add('is-generating');
                        sendBtn.classList.remove('is-stopping');
                        sendBtn.innerHTML = '<i class="fas fa-pause"></i>';
                        sendBtn.title = '暂停生成';

                        try {
                            await ensureOfflineMeetingState(activeFriend);
                            const previousMessages = normalizeOfflineMessagesForFriend(activeFriend);
                            const userMsg = {
                                id: createOfflineTavernId('offline-user'),
                                role: 'user',
                                content: text,
                                timestamp: Date.now()
                            };
                            const messagesWithUser = await persistOfflineMessages(activeFriend, previousMessages.concat(userMsg));
                            renderOfflineCurrentMessages(activeFriend);

                            const aiTimestamp = Date.now();
                            const aiMessageId = createOfflineTavernId('offline-ai');
                            const streamingBubble = createStreamingBubble('', false, {
                                id: aiMessageId,
                                floor: messagesWithUser.length + 1,
                                timestamp: aiTimestamp,
                                depth: 0
                            });
                            if (!streamingBubble) {
                                throw new Error('Failed to create streaming bubble');
                            }

                            const apiMessages = buildOfflineApiMessages(activeFriend, messagesWithUser);
                            const { content: finalReplyContent, tokens, aborted } = await requestOfflineAssistantReply(apiMessages, streamingBubble, {
                                signal: generationController.signal
                            });

                            const latestMessages = normalizeOfflineMessagesForFriend(activeFriend);
                            const aiMsgObj = {
                                id: aiMessageId,
                                role: 'assistant',
                                content: finalReplyContent || '',
                                timestamp: aiTimestamp,
                                tokens: Math.max(0, Number(tokens) || 0)
                            };
                            await persistOfflineMessages(activeFriend, latestMessages.concat(aiMsgObj));
                            renderOfflineCurrentMessages(activeFriend);

                            if (aborted && window.showToast) {
                                window.showToast(finalReplyContent ? '已暂停生成' : '已暂停生成，可重回空白楼层');
                            }
                        } catch (error) {
                            console.error("Offline Tavern API Error:", error);
                            if (window.showToast) window.showToast('请求失败，请检查网络或 API 配置');
                        } finally {
                            isGenerating = false;
                            currentGenerationController = null;
                            inputField.disabled = false;
                            sendBtn.classList.remove('is-generating', 'is-stopping');
                            sendBtn.innerHTML = sendOriginalBtnContent;
                            sendBtn.title = sendOriginalTitle;
                            setTimeout(() => inputField.focus(), 50);
                        }
                    }
                    return;

                };

                sendBtn.addEventListener('click', handleSend);
                inputField.addEventListener('keydown', (e) => {
                    if (e.isComposing || e.keyCode === 229) return;
                    if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.keyCode === 13)) {
                        e.preventDefault();
                        handleSend();
                    }
                });
            }
        };
        setupOfflineTavernLogic();

        const closeSheet = () => {
            const currentPage = attachmentSheet.parentElement || page;
            const inputContainer = currentPage.querySelector('.ins-chat-input-container');
            stopLinkedAccountTimer();
            closeLinkedAccountModal();
            closePayTransferForm();
            closeVoiceMessageForm();
            closeNarrationForm();
            closeRegenerateForm();
            overlay.style.opacity = '0';
            content.style.transform = 'translateY(100%)';
            setTimeout(() => {
                attachmentSheet.style.display = 'none';
            }, 300);
        };

        const submitVoiceMessage = async () => {
            const transcript = String(voiceTranscriptInput ? voiceTranscriptInput.value : '').trim();
            if (!transcript) {
                if (window.showToast) window.showToast('请输入语音内容');
                return;
            }

            closeVoiceMessageForm();
            closeSheet();
            await window.imChat.sendVoiceMessage(transcript);
        };

        const submitNarrationMessage = async () => {
            const narrationText = String(narrationInput ? narrationInput.value : '').trim();
            if (!narrationText) {
                if (window.showToast) window.showToast('请输入旁白内容');
                return;
            }

            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend) {
                if (window.showToast) window.showToast('当前聊天不存在');
                return;
            }

            if (activeFriend.type === 'group' && Number(activeFriend.leftGroupAt) > 0) {
                if (window.showToast) window.showToast('已退出该群，不能添加旁白');
                return;
            }

            const activePage = document.getElementById(`chat-interface-${activeFriend.id}`);
            const activeContainer = activePage ? activePage.querySelector('.ins-chat-messages') : null;
            const now = Date.now();
            const narrationMsg = {
                id: window.imChat.createMessageId ? window.imChat.createMessageId('notice') : `notice-${now}`,
                role: 'system',
                type: 'system_notice',
                noticeKind: 'narration',
                content: narrationText,
                text: narrationText,
                timestamp: now
            };

            const saved = window.imApp.appendFriendMessage
                ? await window.imApp.appendFriendMessage(activeFriend.id, narrationMsg, { silent: true })
                : await commitSheetFriendChange(activeFriend, (targetFriend) => {
                    if (!targetFriend.messages) targetFriend.messages = [];
                    targetFriend.messages.push(narrationMsg);
                }, { silent: true });

            if (!saved) {
                if (window.showToast) window.showToast('旁白保存失败');
                return;
            }

            closeNarrationForm();
            closeSheet();

            const latestFriend = (window.imData.friends || [])
                .find(item => String(item.id) === String(activeFriend.id)) || activeFriend;
            if (activeContainer) {
                const appended = window.imChat.appendMessageToContainer
                    ? window.imChat.appendMessageToContainer(latestFriend, activeContainer, narrationMsg, { scroll: true })
                    : false;
                if (!appended && window.imChat.rerenderChatContainer) {
                    window.imChat.rerenderChatContainer(latestFriend, activeContainer, { scroll: true });
                }
            }
        };

        const submitRegenerateRequest = async (useRequirement) => {
            if (regenerateEntry?.dataset?.busy === 'true') return;

            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend || !window.imChat.regenerateLastAiReply) {
                if (window.showToast) window.showToast('暂无可重回的回复');
                return;
            }

            const userRequirement = useRequirement
                ? String(regenerateRequirementInput ? regenerateRequirementInput.value : '').trim()
                : '';

            if (useRequirement && !userRequirement) {
                if (window.showToast) window.showToast('请先输入参考要求');
                if (regenerateRequirementInput) regenerateRequirementInput.focus();
                return;
            }

            setRegenerateBusyState(true);
            closeRegenerateForm();
            closeSheet();

            try {
                await window.imChat.regenerateLastAiReply(activeFriend, regenerateEntry, { userRequirement });
            } finally {
                setRegenerateBusyState(false);
            }
        };

        const submitPayTransfer = async () => {
            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend) {
                if (window.showToast) window.showToast('当前聊天不存在');
                return;
            }

            const isGroupChat = activeFriend.type === 'group';
            const activePageId = `chat-interface-${activeFriend.id}`;
            const activePage = document.getElementById(activePageId);
            const activeContainer = activePage ? activePage.querySelector('.ins-chat-messages') : null;
            const now = Date.now();
            const lastMsg = activeFriend.messages && activeFriend.messages.length > 0
                ? activeFriend.messages[activeFriend.messages.length - 1]
                : null;

            if (currentPayMode === 'red_packet' && isGroupChat) {
                const packetCount = parseInt(payRedPacketCountInput ? payRedPacketCountInput.value : '', 10);
                const totalAmount = Number(payRedPacketAmountInput ? payRedPacketAmountInput.value : '');
                const description = String(payRedPacketDescInput ? payRedPacketDescInput.value : '').trim() || '恭喜发财';

                if (!Number.isInteger(packetCount) || packetCount <= 0) {
                    if (window.showToast) window.showToast('红包个数无效');
                    return;
                }

                if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
                    if (window.showToast) window.showToast('总金额无效');
                    return;
                }

                const allocations = window.imChat.createRedPacketAllocations(totalAmount, packetCount);
                if (allocations.length !== packetCount) {
                    if (window.showToast) window.showToast('红包金额需至少满足每包 0.01');
                    return;
                }

                // Call payment selection instead of immediate deduction
                const didOpenSelection = renderPayMethodSelection(totalAmount, async (selectedCardId) => {
                    const success = typeof window.addPayTransaction === 'function'
                        ? window.addPayTransaction(totalAmount, `${description} · 群红包`, 'expense', selectedCardId)
                        : false;

                    if (!success) {
                        if (window.showToast) window.showToast('红包发送失败');
                        return;
                    }

                    const packetMsg = window.imChat.normalizeGroupRedPacketState({
                        id: window.imChat.createMessageId('packet'),
                        packetId: window.imChat.createMessageId('packet'),
                        role: 'user',
                        type: 'group_red_packet',
                        totalAmount,
                        packetCount,
                        description,
                        allocations,
                        claimRecords: [],
                        claimedMemberIds: [],
                        content: `[群红包] ${description} ¥${Number(totalAmount).toFixed(2)}`,
                        timestamp: now
                    }, activeFriend);

                    const saved = window.imApp.appendFriendMessage
                        ? await window.imApp.appendFriendMessage(activeFriend.id, packetMsg, { silent: true })
                        : await commitSheetFriendChange(activeFriend, (targetFriend) => {
                            if (!targetFriend.messages) targetFriend.messages = [];
                            targetFriend.messages.push(packetMsg);
                        }, { silent: true });

                    if (!saved) {
                        if (window.showToast) window.showToast('红包记录保存失败');
                        return;
                    }

                    closeSheet();

                    if (activeContainer) {
                        const appended = window.imChat.appendMessageToContainer
                            ? window.imChat.appendMessageToContainer(activeFriend, activeContainer, packetMsg, { scroll: true })
                            : false;
                        if (!appended && window.imChat.rerenderChatContainer) {
                            window.imChat.rerenderChatContainer(activeFriend, activeContainer, { scroll: true });
                        }
                    }
                });

                if (!didOpenSelection) {
                    // Fallback to existing logic if selection fails to open (e.g., no cards)
                    if (window.showToast) window.showToast('支付方式拉取失败');
                }
                return;
            }

            const amount = Number(payAmountInput ? payAmountInput.value : '');
            const description = String(payDescInput ? payDescInput.value : '').trim() || '转账';

            if (!Number.isFinite(amount) || amount <= 0) {
                if (window.showToast) window.showToast('金额无效');
                return;
            }

            let targetName = activeFriend.type === 'group'
                ? (activeFriend.nickname || '群聊')
                : (activeFriend.nickname || activeFriend.realName || '对方');
            const senderName = userState?.name || userState?.realName || userState?.nickname || 'User';

            if (isGroupChat) {
                const selectedMember = window.imChat.getAvailableGroupRecipients(activeFriend).find(member => String(member.id) === String(selectedRecipientId));
                if (!selectedMember) {
                    if (window.showToast) window.showToast('请选择群成员');
                    return;
                }
                targetName = selectedMember.nickname || selectedMember.realName || '群成员';
            }

            const didOpenSelection = renderPayMethodSelection(amount, async (selectedCardId) => {
                const success = typeof window.addPayTransaction === 'function'
                    ? window.addPayTransaction(amount, `${description} · ${targetName}`, 'expense', selectedCardId)
                    : false;

                if (!success) {
                    if (window.showToast) window.showToast('转账失败');
                    return;
                }

                const payMsg = {
                    id: window.imChat.createMessageId('pay'),
                    role: 'user',
                    type: 'pay_transfer',
                    payKind: 'user_to_char',
                    payDirection: 'user_to_char',
                    amount,
                    description,
                    payerName: senderName,
                    payeeName: targetName,
                    senderName,
                    receiverName: targetName,
                    targetName,
                    targetMemberId: isGroupChat ? selectedRecipientId : null,
                    cardTitle: isGroupChat ? '群转账' : 'Pay 转账',
                    payStatus: 'completed',
                    content: `[用户转账] ${description} ¥${amount.toFixed(2)}`,
                    timestamp: now
                };

                const saved = window.imApp.appendFriendMessage
                    ? await window.imApp.appendFriendMessage(activeFriend.id, payMsg, { silent: true })
                    : await commitSheetFriendChange(activeFriend, (targetFriend) => {
                        if (!targetFriend.messages) targetFriend.messages = [];
                        targetFriend.messages.push(payMsg);
                    }, { silent: true });

                if (!saved) {
                    if (window.showToast) window.showToast('转账记录保存失败');
                    return;
                }

                closeSheet();

                if (activeContainer) {
                    const appended = window.imChat.appendMessageToContainer
                        ? window.imChat.appendMessageToContainer(activeFriend, activeContainer, payMsg, { scroll: true })
                        : false;
                    if (!appended && window.imChat.rerenderChatContainer) {
                        window.imChat.rerenderChatContainer(activeFriend, activeContainer, { scroll: true });
                    }
                }
            });

            if (!didOpenSelection) {
                if (window.showToast) window.showToast('支付方式拉取失败');
            }
        };

        overlay.addEventListener('click', closeSheet);
        closeBtn.addEventListener('click', closeSheet);

        if (payEntry) {
            payEntry.addEventListener('click', () => {
                openPayTransferForm();
            });
        }

        if (linkEntry) {
            linkEntry.addEventListener('click', () => {
                closeSheet();
                if (window.imChat.openFakeLinkComposer) {
                    window.imChat.openFakeLinkComposer();
                } else if (window.showToast) {
                    window.showToast('链接功能加载失败');
                }
            });
        }

        if (voiceEntry) {
            voiceEntry.addEventListener('click', () => {
                openVoiceMessageForm();
            });
        }

        if (listenEntry) {
            listenEntry.addEventListener('click', () => {
                const activeFriend = window.imData.currentActiveFriend;
                if (!activeFriend || activeFriend.type !== 'char') return;
                closeSheet();
                window.libraryApp?.openTogetherListeningPicker?.(activeFriend);
            });
        }

        if (narrationEntry) {
            narrationEntry.addEventListener('click', () => {
                openNarrationForm();
            });
        }

        if (dynamicActionEntry) {
            dynamicActionEntry.addEventListener('click', async () => {
                await toggleDynamicActionNarration();
            });
        }

        if (regenerateEntry) {
            regenerateEntry.addEventListener('click', () => {
                if (regenerateEntry.dataset.busy === 'true') return;

                const activeFriend = window.imData.currentActiveFriend;
                if (!activeFriend || !window.imChat.regenerateLastAiReply) {
                    if (window.showToast) window.showToast('暂无可重回的回复');
                    return;
                }

                openRegenerateForm();
            });
        }

        if (payRecipientTrigger) {
            payRecipientTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const activeFriend = window.imData.currentActiveFriend;
                if (!activeFriend || activeFriend.type !== 'group') return;
                const hasOptions = payRecipientDropdown && payRecipientDropdown.children.length > 0;
                if (!hasOptions) return;
                const isOpen = payRecipientDropdown && payRecipientDropdown.style.display === 'block';
                setRecipientDropdownOpen(!isOpen);
            });
        }

        if (payModeTabs.length > 0) {
            payModeTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const activeFriend = window.imData.currentActiveFriend;
                    const nextMode = tab.getAttribute('data-pay-mode') || 'transfer';
                    setRecipientDropdownOpen(false);
                    syncPayModeUi(activeFriend, nextMode);
                    setTimeout(() => {
                        if (nextMode === 'red_packet') {
                            if (payRedPacketCountInput) payRedPacketCountInput.focus();
                        } else if (payAmountInput) {
                            payAmountInput.focus();
                        }
                    }, 20);
                });
            });
        }

        if (payFormOverlay) {
            payFormOverlay.addEventListener('click', (e) => {
                if (e.target === payFormOverlay) {
                    closePayTransferForm();
                    return;
                }

                if (
                    payRecipientDropdown &&
                    payRecipientDropdown.style.display === 'block' &&
                    !e.target.closest('.pay-group-recipient-field')
                ) {
                    setRecipientDropdownOpen(false);
                }
            });
        }

        if (voiceFormOverlay) {
            voiceFormOverlay.addEventListener('click', (e) => {
                if (e.target === voiceFormOverlay) {
                    closeSheet();
                }
            });
        }

        if (narrationFormOverlay) {
            narrationFormOverlay.addEventListener('click', (e) => {
                if (e.target === narrationFormOverlay) {
                    closeSheet();
                }
            });
        }

        if (regenerateFormOverlay) {
            regenerateFormOverlay.addEventListener('click', (e) => {
                if (e.target === regenerateFormOverlay) {
                    closeSheet();
                }
            });
        }

        if (voiceCancelBtn) {
            voiceCancelBtn.addEventListener('click', () => {
                closeSheet();
            });
        }

        if (voiceSubmitBtn) {
            voiceSubmitBtn.addEventListener('click', async () => {
                await submitVoiceMessage();
            });
        }

        if (narrationCancelBtn) {
            narrationCancelBtn.addEventListener('click', () => {
                closeSheet();
            });
        }

        if (narrationSubmitBtn) {
            narrationSubmitBtn.addEventListener('click', async () => {
                await submitNarrationMessage();
            });
        }

        if (regenerateReferenceBtn) {
            regenerateReferenceBtn.addEventListener('click', async () => {
                await submitRegenerateRequest(true);
            });
        }

        if (regenerateDirectBtn) {
            regenerateDirectBtn.addEventListener('click', async () => {
                await submitRegenerateRequest(false);
            });
        }

        if (offlineEntry) {
            offlineEntry.addEventListener('click', () => {
                openOfflineTavernView();
            });
        }

        const tavernCloseBtn = document.getElementById('offline-tavern-close-btn');
        if (tavernCloseBtn) {
            tavernCloseBtn.addEventListener('click', () => {
                const tavernView = document.getElementById('offline-tavern-view');
                if (tavernView) {
                    tavernView.classList.remove('active');
                    setTimeout(() => { tavernView.style.display = 'none'; }, 300);
                }
            });
        }

        const tavernSettingsBtn = document.getElementById('offline-tavern-settings-btn');
        if (tavernSettingsBtn) {
            tavernSettingsBtn.addEventListener('click', () => {
                renderOfflineTavernSettings();
                window.openView(document.getElementById('offline-tavern-settings-sheet'));
            });
        }

        if (voiceTranscriptInput) {
            voiceTranscriptInput.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.keyCode === 13)) {
                    e.preventDefault();
                    submitVoiceMessage();
                }
            });
        }

        if (narrationInput) {
            narrationInput.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.keyCode === 13)) {
                    e.preventDefault();
                    submitNarrationMessage();
                }
            });
        }

        if (regenerateRequirementInput) {
            regenerateRequirementInput.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.keyCode === 13)) {
                    e.preventDefault();
                    submitRegenerateRequest(true);
                }
            });
        }

        if (payCancelBtn) {
            payCancelBtn.addEventListener('click', () => {
                closePayTransferForm();
            });
        }

        if (paySubmitBtn) {
            paySubmitBtn.addEventListener('click', async () => {
                await submitPayTransfer();
            });
        }

        if (payAmountInput) {
            payAmountInput.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault();
                    if (payDescInput) payDescInput.focus();
                }
            });
        }

        if (payDescInput) {
            payDescInput.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault();
                    submitPayTransfer();
                }
            });
        }

        // Upload Virtual Photo
        const virtualUpload = attachmentSheet.querySelector('.virtual-upload');
        virtualUpload.addEventListener('click', () => {
            closeSheet();
            if (window.showCustomModal) {
                window.showCustomModal({
                    type: 'prompt',
                    title: '发送虚拟图片',
                    placeholder: '描述这张图片的内容（供 AI 理解）',
                    confirmText: '发送',
                    onConfirm: (desc) => {
                        if (desc && desc.trim()) {
                            window.imChat.sendImageMessage(
                                getChatImagePlaceholderUrl(),
                                desc.trim(),
                                { imageSource: 'virtual' }
                            );
                        }
                    }
                });
            }
        });

        // Upload Real Photo
        const realFileInput = attachmentSheet.querySelector('.real-file-input');
        realFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                closeSheet();
                try {
                    const imageUrl = window.imApp.compressImageFile
                        ? await window.imApp.compressImageFile(file, {
                            maxWidth: 1600,
                            maxHeight: 1600,
                            mimeType: 'image/jpeg',
                            quality: 0.82
                        })
                        : await window.imApp.readFileAsDataUrl(file);

                    let description = '';
                    try {
                        if (window.showToast) window.showToast('正在识别图片...');
                        description = await identifyChatImage(imageUrl);
                    } catch (visionError) {
                        console.warn('Failed to identify uploaded chat image', visionError);
                        description = '图片识别失败，未生成描述';
                        if (window.showToast) window.showToast('图片识别失败，已发送原图');
                    }

                    window.imChat.sendImageMessage(imageUrl, description, {
                        imageSource: 'real',
                        fileName: file.name
                    });
                } catch (error) {
                    console.error('Failed to process uploaded chat image', error);
                    if (window.showToast) window.showToast('图片处理失败');
                }
            }
            e.target.value = '';
        });

        window.imChat.renderLinkedAccountsPanel = renderLinkedAccountsPanel;
        window.imChat.stopLinkedAccountTimer = stopLinkedAccountTimer;

        return attachmentSheet;
    }

async function sendImageMessage(imgUrl, description, options = {}) {
        if (!window.imData.currentActiveFriend) return;
        const friend = window.imData.currentActiveFriend;
        const pageId = `chat-interface-${friend.id}`;
        const page = document.getElementById(pageId);
        if (!page) return;
        const container = page.querySelector('.ins-chat-messages');

        const now = Date.now();
        const msgObj = {
            id: window.imChat.createMessageId('img'),
            role: 'user',
            type: 'image',
            content: imgUrl,
            text: description,
            description,
            imageSource: options.imageSource || 'unknown',
            fileName: options.fileName || '',
            timestamp: now
        };

        const saved = window.imApp.appendFriendMessage
            ? await window.imApp.appendFriendMessage(friend.id, msgObj, { silent: true })
            : await commitSheetFriendChange(friend, (targetFriend) => {
                if (!targetFriend.messages) targetFriend.messages = [];
                targetFriend.messages.push(msgObj);
            }, { silent: true });

        if (!saved) {
            if (window.showToast) window.showToast('图片消息保存失败');
            return;
        }

        if (container) {
            const appended = window.imChat.appendMessageToContainer
                ? window.imChat.appendMessageToContainer(friend, container, msgObj, { scroll: true })
                : false;
            if (!appended && window.imChat.rerenderChatContainer) {
                window.imChat.rerenderChatContainer(friend, container, { scroll: true });
            }
        }
    }

async function sendStickerMessage(sticker) {
        if (!window.imData.currentActiveFriend) return;
        const friend = window.imData.currentActiveFriend;
        const pageId = `chat-interface-${friend.id}`;
        const page = document.getElementById(pageId);
        if (!page) return;
        const container = page.querySelector('.ins-chat-messages');
        const safeSticker = sticker || {};
        const stickerUrl = String(safeSticker.url || safeSticker.stickerUrl || '').trim();
        const stickerName = String(safeSticker.name || safeSticker.stickerName || 'Sticker').trim() || 'Sticker';
        const stickerCategory = String(safeSticker.category || safeSticker.stickerCategory || '').trim();
        if (!stickerUrl) return;

        const now = Date.now();
        const readable = stickerCategory
            ? `用户发了一个表情包：${stickerCategory} / ${stickerName}`
            : `用户发了一个表情包：${stickerName}`;
        const msgObj = {
            id: window.imChat.createMessageId('sticker'),
            role: 'user',
            type: 'sticker',
            content: '[表情包]',
            text: readable,
            stickerCategory,
            stickerName,
            stickerUrl,
            timestamp: now
        };

        const saved = window.imApp.appendFriendMessage
            ? await window.imApp.appendFriendMessage(friend.id, msgObj, { silent: true })
            : await commitSheetFriendChange(friend, (targetFriend) => {
                if (!targetFriend.messages) targetFriend.messages = [];
                targetFriend.messages.push(msgObj);
            }, { silent: true });

        if (!saved) {
            if (window.showToast) window.showToast('表情包消息保存失败');
            return;
        }

        if (container) {
            const appended = window.imChat.appendMessageToContainer
                ? window.imChat.appendMessageToContainer(friend, container, msgObj, { scroll: true })
                : false;
            if (!appended && window.imChat.rerenderChatContainer) {
                window.imChat.rerenderChatContainer(friend, container, { scroll: true });
            }
        }
    }

async function sendVoiceMessage(transcript) {
        if (!window.imData.currentActiveFriend) return;
        const friend = window.imData.currentActiveFriend;
        const pageId = `chat-interface-${friend.id}`;
        const page = document.getElementById(pageId);
        if (!page) return;
        const container = page.querySelector('.ins-chat-messages');
        const safeTranscript = String(transcript || '').trim();
        if (!safeTranscript) return;

        const now = Date.now();
        const duration = Math.min(18, Math.max(3, Math.ceil(safeTranscript.length / 3)));
        const msgObj = {
            id: window.imChat.createMessageId('voice'),
            role: 'user',
            type: 'voice_message',
            content: '[语音消息]',
            text: safeTranscript,
            transcript: safeTranscript,
            duration,
            timestamp: now
        };

        const saved = window.imApp.appendFriendMessage
            ? await window.imApp.appendFriendMessage(friend.id, msgObj, { silent: true })
            : await commitSheetFriendChange(friend, (targetFriend) => {
                if (!targetFriend.messages) targetFriend.messages = [];
                targetFriend.messages.push(msgObj);
            }, { silent: true });

        if (!saved) {
            if (window.showToast) window.showToast('语音消息保存失败');
            return;
        }

        if (container) {
            const appended = window.imChat.appendMessageToContainer
                ? window.imChat.appendMessageToContainer(friend, container, msgObj, { scroll: true })
                : false;
            if (!appended && window.imChat.rerenderChatContainer) {
                window.imChat.rerenderChatContainer(friend, container, { scroll: true });
            }
        }
    }

function openAttachmentSheet() {
        if (!window.imData.currentActiveFriend) return;
        const pageId = `chat-interface-${window.imData.currentActiveFriend.id}`;
        const page = document.getElementById(pageId);
        if (!page) return;

        // Reset the sheet instance entirely just in case DOM was manipulated or destroyed
        const sheet = window.imChat.createAttachmentSheet(page);
        const inputContainer = page.querySelector('.ins-chat-input-container');
        sheet.style.display = 'flex';
        // force reflow
        sheet.offsetHeight;
        const overlay = sheet.querySelector('.sheet-overlay');
        const content = sheet.querySelector('.sheet-content');
        if (window.imChat.syncOfflineMeetEntry) window.imChat.syncOfflineMeetEntry();
        const activeTab = sheet.querySelector('.sheet-tab-item.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'file' && typeof window.imChat.renderLinkedAccountsPanel === 'function') {
            window.imChat.renderLinkedAccountsPanel();
        } else if (typeof window.imChat.stopLinkedAccountTimer === 'function') {
            window.imChat.stopLinkedAccountTimer();
        }
        if (overlay) overlay.style.opacity = '1';
        if (content) content.style.transform = 'translateY(0)';
    }

    // --- Banner Notification logic moved to global ui.js ---
    
    // We wrap the global functions so existing imChat references still work
    function showBannerNotification(friend, messageText) {
        if (window.showBannerNotification) {
            window.showBannerNotification(friend, messageText);
        }
    }

    function hideBannerNotification(clearQueue = false) {
        if (window.hideBannerNotification) {
            window.hideBannerNotification(clearQueue);
        }
    }

    window.imChat.createAttachmentSheet = createAttachmentSheet;
    window.imChat.syncOfflineMeetEntry = function() {
        const sheet = window.imData.attachmentSheet;
        if (!sheet) return;
        const entry = sheet.querySelector('.attachment-more-offline-entry');
        const label = sheet.querySelector('.attachment-more-offline-label');
        const dynamicEntry = sheet.querySelector('.attachment-more-dynamic-action-entry');
        const dynamicLabel = sheet.querySelector('.attachment-more-dynamic-action-label');
        const listenEntry = sheet.querySelector('.attachment-more-listen-entry');
        const listenLabel = sheet.querySelector('.attachment-more-listen-label');
        const activeFriend = window.imData.currentActiveFriend;
        const isOffline = !!window.imData.currentActiveFriend?.offlineMeetEnabled;
        const isDynamicActionEnabled = !!window.imData.currentActiveFriend?.dynamicActionNarrationEnabled;
        const canListenTogether = activeFriend?.type === 'char';
        const isListeningTogether = canListenTogether && !!window.libraryApp?.getTogetherListeningSnapshot?.(activeFriend.id);
        if (label) label.textContent = isOffline ? '退出线下' : '线下';
        if (entry) entry.classList.toggle('active', isOffline);
        if (dynamicLabel) dynamicLabel.textContent = isDynamicActionEnabled ? '关闭' : '动描';
        if (dynamicEntry) dynamicEntry.classList.toggle('active', isDynamicActionEnabled);
        if (listenEntry) {
            listenEntry.style.display = canListenTogether ? 'flex' : 'none';
            listenEntry.classList.toggle('active', isListeningTogether);
        }
        if (listenLabel) listenLabel.textContent = isListeningTogether ? '退出一起听' : '一起听';
    };
    window.imChat.identifyChatImage = identifyChatImage;
    window.imChat.sendImageMessage = sendImageMessage;
    window.imChat.sendStickerMessage = sendStickerMessage;
    window.imChat.sendVoiceMessage = sendVoiceMessage;
    window.imChat.openAttachmentSheet = openAttachmentSheet;
    window.imChat.showBannerNotification = showBannerNotification;
    window.imChat.hideBannerNotification = hideBannerNotification;

});
