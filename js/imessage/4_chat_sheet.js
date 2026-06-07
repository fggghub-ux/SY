

// ==========================================
// IMESSAGE: 4_chat_sheet.js
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const { apiConfig, userState } = window;
    window.imChat = window.imChat || {};
    const imChat = window.imChat;

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
                            <div class="attachment-more-voice-entry">
                                <div class="attachment-more-voice-icon">
                                    <i class="fas fa-microphone-alt"></i>
                                </div>
                                <div class="attachment-more-voice-label">Voice</div>
                            </div>
                            <div class="attachment-more-offline-entry">
                                <div class="attachment-more-offline-icon">
                                    <i class="fas fa-people-arrows"></i>
                                </div>
                                <div class="attachment-more-offline-label">线下</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bottom Tabs (Floating Pill, Left Aligned, Tap to Select) -->
                <div class="sheet-tabs-container" style="position: absolute; bottom: 16px; left: 20px; right: 20px; border-radius: 40px; display: flex; padding: 10px 16px; overflow-x: auto; background: rgba(250, 250, 250, 0.75);    scrollbar-width: none; gap: 24px; align-items: center; justify-content: flex-start;">
                    <style>
                        #chat-attachment-sheet ::-webkit-scrollbar { display: none; }

                        .attachment-more-pay-entry,
                        .attachment-more-voice-entry,
                        .attachment-more-offline-entry {
                            cursor: pointer;
                            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s;
                        }
                        .attachment-more-regenerate-entry {
                            cursor: pointer;
                            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s;
                        }
                        .attachment-more-pay-entry:active,
                        .attachment-more-voice-entry:active,
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
        `;
        page.appendChild(attachmentSheet);

        const overlay = attachmentSheet.querySelector('.sheet-overlay');
        const content = attachmentSheet.querySelector('.sheet-content');
        const closeBtn = attachmentSheet.querySelector('.close-sheet-btn');
        const tabsContainer = attachmentSheet.querySelector('.sheet-tabs-container');
        const tabItems = attachmentSheet.querySelectorAll('.sheet-tab-item');
        const payEntry = attachmentSheet.querySelector('.attachment-more-pay-entry');
        const regenerateEntry = attachmentSheet.querySelector('.attachment-more-regenerate-entry');
        const voiceEntry = attachmentSheet.querySelector('.attachment-more-voice-entry');
        const offlineEntry = attachmentSheet.querySelector('.attachment-more-offline-entry');
        const offlineLabel = attachmentSheet.querySelector('.attachment-more-offline-label');
        const payFormOverlay = attachmentSheet.querySelector('.pay-transfer-form-overlay');
        const voiceFormOverlay = attachmentSheet.querySelector('.voice-message-form-overlay');
        const voiceTranscriptInput = attachmentSheet.querySelector('.voice-message-transcript-input');
        const voiceCancelBtn = attachmentSheet.querySelector('.voice-message-cancel-btn');
        const voiceSubmitBtn = attachmentSheet.querySelector('.voice-message-submit-btn');
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
            const messages = Array.isArray(chat.messages) ? [...chat.messages].sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0)) : [];
            const bubblesHtml = messages.length > 0
                ? messages.map((message, index) => {
                    const isChar = message.role === 'char';
                    const align = isChar ? 'flex-end' : 'flex-start';
                    const bubbleBg = isChar ? '#111' : '#e9e9ee';
                    const bubbleColor = isChar ? '#fff' : '#111';
                    const radius = isChar ? '16px 16px 4px 16px' : '16px 16px 16px 4px';
                    const currentTime = Number(message.timestamp) || 0;
                    const prevTime = index > 0 ? Number(messages[index - 1]?.timestamp) || 0 : 0;
                    const showTime = index === 0 || (currentTime && prevTime && currentTime - prevTime > 5 * 60 * 1000);
                    return `
                        ${showTime ? `<div style="align-self:center; font-size:11px; color:#8e8e93; margin:4px 0 2px;">${escapeSheetHtml(formatLinkedAccountModalTime(currentTime))}</div>` : ''}
                        <div style="display:flex; flex-direction:column; align-items:${align};">
                            <div style="max-width:78%; padding:7px 10px; border-radius:${radius}; background:${bubbleBg}; color:${bubbleColor}; font-size:13px; line-height:1.32; word-break:break-word;">${escapeSheetHtml(message.text || '')}</div>
                        </div>
                    `;
                }).join('')
                : '<div style="text-align:center; color:#8e8e93; font-size:13px; padding:34px 0;">暂无消息</div>';

            showLinkedAccountModal(`
                <div style="width:min(100%, 360px); height:min(76vh, 560px); max-height:560px; background:#fff; border-radius:24px;  display:flex; flex-direction:column; overflow:hidden;">
                    <div style="display:flex; align-items:center; gap:10px; padding:14px 16px; border-bottom:1px solid #f2f2f7; flex-shrink:0;">
                        <div style="${getLinkedAccountAvatarStyle(chat, 38)}">${escapeSheetHtml(getLinkedAccountInitial(chat))}</div>
                        <div style="min-width:0; flex:1;">
                            <div style="font-size:16px; font-weight:800; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeSheetHtml(displayName)}</div>
                            <div style="font-size:12px; color:#8e8e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeSheetHtml(realName)}${chat.relationship ? ` · ${escapeSheetHtml(chat.relationship)}` : ''}</div>
                        </div>
                        <button type="button" class="linked-account-modal-close" style="width:30px; height:30px; border:none; border-radius:50%; background:#f2f2f7; color:#636366; cursor:pointer;"><i class="fas fa-times"></i></button>
                    </div>
                    <div style="padding:12px; display:flex; flex-direction:column; gap:7px; overflow-y:auto; background:#fff; flex:1; min-height:0; overscroll-behavior:contain;">
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
                if (targetTab === 'more') syncOfflineMeetEntry();
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

        const toggleOfflineMeetMode = async () => {
            const activeFriend = window.imData.currentActiveFriend;
            if (!activeFriend || activeFriend.id == null) return;

            const nextEnabled = !activeFriend.offlineMeetEnabled;
            const saved = await commitSheetFriendChange(activeFriend.id, (targetFriend) => {
                targetFriend.offlineMeetEnabled = nextEnabled;
            }, {
                silent: true,
                metaOnly: true
            });

            if (!saved) {
                if (window.showToast) window.showToast('线下模式保存失败');
                return;
            }

            activeFriend.offlineMeetEnabled = nextEnabled;
            if (window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(activeFriend.id)) {
                window.imData.currentActiveFriend.offlineMeetEnabled = nextEnabled;
            }
            syncOfflineMeetEntry();
            closeSheet();
            if (window.showToast) window.showToast(nextEnabled ? '已进入线下见面' : '已退出线下见面');
        };

        const closeSheet = () => {
            const currentPage = attachmentSheet.parentElement || page;
            const inputContainer = currentPage.querySelector('.ins-chat-input-container');
            stopLinkedAccountTimer();
            closeLinkedAccountModal();
            closePayTransferForm();
            closeVoiceMessageForm();
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

        if (voiceEntry) {
            voiceEntry.addEventListener('click', () => {
                openVoiceMessageForm();
            });
        }

        if (regenerateEntry) {
            regenerateEntry.addEventListener('click', async () => {
                if (regenerateEntry.dataset.busy === 'true') return;

                const activeFriend = window.imData.currentActiveFriend;
                if (!activeFriend || !window.imChat.regenerateLastAiReply) {
                    if (window.showToast) window.showToast('暂无可重回的回复');
                    return;
                }

                regenerateEntry.dataset.busy = 'true';
                regenerateEntry.style.opacity = '0.45';
                closeSheet();

                try {
                    await window.imChat.regenerateLastAiReply(activeFriend, regenerateEntry);
                } finally {
                    regenerateEntry.dataset.busy = 'false';
                    regenerateEntry.style.opacity = '';
                }
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

        if (offlineEntry) {
            offlineEntry.addEventListener('click', async () => {
                await toggleOfflineMeetMode();
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
        const isOffline = !!window.imData.currentActiveFriend?.offlineMeetEnabled;
        if (label) label.textContent = isOffline ? '退出线下' : '线下';
        if (entry) entry.classList.toggle('active', isOffline);
    };
    window.imChat.identifyChatImage = identifyChatImage;
    window.imChat.sendImageMessage = sendImageMessage;
    window.imChat.sendStickerMessage = sendStickerMessage;
    window.imChat.sendVoiceMessage = sendVoiceMessage;
    window.imChat.openAttachmentSheet = openAttachmentSheet;
    window.imChat.showBannerNotification = showBannerNotification;
    window.imChat.hideBannerNotification = hideBannerNotification;

});
