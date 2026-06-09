// u2phone Settings App Logic
// Adapted from iiso/emulator/4_settings.js

(function() {
    // Basic User/Account State Mock
    let accounts = [];
    let currentAccountId = null;
    let userState = {
        name: '',
        phone: '',
        persona: '',
        avatarUrl: null
    };

    function clonePlainData(value) {
        if (typeof structuredClone === 'function') return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }

    function syncUserStateFromCurrentAccount() {
        const acc = accounts.find(a => String(a.id) === String(currentAccountId));

        if (acc) {
            userState.name = acc.name || '';
            userState.phone = acc.phone || '';
            userState.persona = acc.persona || '';
            userState.signature = acc.signature || '';
            userState.avatarUrl = acc.avatarUrl || null;
        } else {
            userState.name = '';
            userState.phone = '';
            userState.persona = '';
            userState.signature = '';
            userState.avatarUrl = null;
        }

        window.userState = userState;
        return userState;
    }

    function notifyUserStateUpdated(detail = {}) {
        window.userState = userState;
        const eventDetail = {
            userState: clonePlainData(userState),
            ...detail
        };
        window.dispatchEvent(new CustomEvent('user-state-updated', { detail: eventDetail }));
        if (detail.avatarChanged) {
            window.dispatchEvent(new CustomEvent('avatar-updated', { detail: eventDetail }));
        }
    }

    function exposeAccountGlobals() {
        window.getAccounts = () => accounts;
        window.getCurrentAccountId = () => currentAccountId;
        window.setCurrentAccountId = (id) => {
            currentAccountId = id;
            syncUserStateFromCurrentAccount();
            persistSettingsData();
            notifyUserStateUpdated({ avatarChanged: true });
            return currentAccountId;
        };
    }

    function persistSettingsData() {
        syncUserStateFromCurrentAccount();
        if (window.StorageManager) {
            StorageManager.save('u2_userState', userState);
            StorageManager.save('u2_apiConfig', apiConfig);
            StorageManager.save('u2_minimaxConfig', minimaxConfig);
            StorageManager.save('u2_apiPresets', apiPresets);
            StorageManager.save('u2_fetchedModels', fetchedModels);
            StorageManager.save('u2_assistiveBallSettings', assistiveBallSettings);
            StorageManager.save('u2_accounts', accounts);
            StorageManager.save('u2_currentAccountId', currentAccountId);
            StorageManager.save('u2_themeState', themeState);
        }

        if (window.appStorage?.loadGlobalData && window.appStorage?.saveGlobalData) {
            window.appStorage.loadGlobalData()
                .then((existing) => {
                    const safeExisting = existing && typeof existing === 'object' ? existing : {};
                    return window.appStorage.saveGlobalData({
                        ...safeExisting,
                        userState: clonePlainData(userState),
                        accounts: clonePlainData(accounts),
                        currentAccountId,
                        apiConfig: clonePlainData(apiConfig),
                        minimaxConfig: clonePlainData(minimaxConfig),
                        apiPresets: clonePlainData(apiPresets),
                        fetchedModels: clonePlainData(fetchedModels),
                        assistiveBallSettings: clonePlainData(assistiveBallSettings),
                        themeState: clonePlainData(themeState),
                        appState: typeof window.getAllAppState === 'function'
                            ? clonePlainData(window.getAllAppState())
                            : safeExisting.appState
                    });
                })
                .catch((error) => {
                    console.warn('Failed to persist settings to appStorage:', error);
                });
        }
    }

    exposeAccountGlobals();

    // ==========================================
    // API Configuration State
    // ==========================================
    let apiConfig = {
        endpoint: '',
        apiKey: '',
        model: '',
        temperature: 0.7,
    };
    let minimaxConfig = {
        region: 'cn',
        customEndpointEnabled: false,
        endpoint: '',
        apiKey: '',
        groupId: '',
        ttsModel: 'speech-02-hd'
    };
    let apiPresets = [];
    let fetchedModels = [];
    let assistiveBallSettings = {
        enabled: false,
        x: null,
        y: null,
        opacity: 0.72
    };
    
    // 用于保存正在编辑的状态，避免未点保存就污染全局配置
    let tempApiConfig = {};

    // ==========================================
    // Theme Configuration State
    // ==========================================
    const DEFAULT_SYSTEM_THEME_FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    const BUILTIN_THEME_FONTS = [
        {
            key: 'system-default',
            label: '默认',
            cssName: '',
            family: DEFAULT_SYSTEM_THEME_FONT_FAMILY,
            sources: { woff2: '', woff: '', ttf: '' }
        }
    ];

    let themeState = {
        bgUrl: null,
        apps: [
            { id: 'app-icon-1', name: 'Pay', icon: null },
            { id: 'app-icon-2', name: 'TikTok', icon: null },
            { id: 'app-icon-3', name: 'b.stage', icon: null },
            { id: 'app-icon-4', name: 'X', icon: null },
            { id: 'app-icon-5', name: 'Shop', icon: null },
            { id: 'app-icon-6', name: 'call', icon: null },
            { id: 'app-icon-7', name: 'Netflix', icon: null },
            { id: 'app-icon-8', name: 'Loves', icon: null },
            { id: 'dock-icon-settings', name: '设置', icon: null },
            { id: 'dock-icon-imessage', name: '信息', icon: null },
            { id: 'dock-icon-youtube', name: 'YouTube', icon: null }
        ],
        fontMode: 'preset', // 'preset' or 'saved'
        fontPresetKey: 'system-default',
        fontFamily: DEFAULT_SYSTEM_THEME_FONT_FAMILY,
        fontCssName: '',
        fontSize: 16,
        fontSources: { woff2: '', woff: '', ttf: '' },
        savedFontPresets: [],
        imessageChatCssEnabled: false,
        imessageChatCss: ''
    };
    window.u2ThemeState = themeState;
    
    document.addEventListener('DOMContentLoaded', () => {
        // ==========================================
        // Load Saved Data
        // ==========================================
        if (window.StorageManager) {
            apiConfig = StorageManager.load('u2_apiConfig', apiConfig);
            minimaxConfig = StorageManager.load('u2_minimaxConfig', minimaxConfig);
            apiPresets = StorageManager.load('u2_apiPresets', []);
            fetchedModels = StorageManager.load('u2_fetchedModels', []);
            assistiveBallSettings = {
                ...assistiveBallSettings,
                ...StorageManager.load('u2_assistiveBallSettings', {})
            };
            
            accounts = StorageManager.load('u2_accounts', []);
            currentAccountId = StorageManager.load('u2_currentAccountId', null);
            const savedUserState = StorageManager.load('u2_userState', null);
            if (savedUserState && typeof savedUserState === 'object') {
                userState = { ...userState, ...savedUserState };
            }
            
            if (currentAccountId) {
                syncUserStateFromCurrentAccount();
            }

            // Load Theme State
            const savedThemeState = StorageManager.load('u2_themeState', null);
            if (savedThemeState) {
                // Merge arrays smartly to retain new apps if added
                if (Array.isArray(savedThemeState.apps)) {
                    savedThemeState.apps.forEach(savedApp => {
                        const existingApp = themeState.apps.find(a => a.id === savedApp.id);
                        if (existingApp) {
                            existingApp.icon = savedApp.icon;
                            if (savedApp.id === 'app-icon-8' && savedApp.name === 'Diary') {
                                existingApp.name = 'Loves';
                            } else {
                                existingApp.name = savedApp.name || existingApp.name;
                            }
                        } else {
                            themeState.apps.push(savedApp);
                        }
                    });
                    delete savedThemeState.apps;
                }
                themeState = { ...themeState, ...savedThemeState };
            }
            window.u2ThemeState = themeState;
            
            // Apply loaded theme state immediately
            applySavedTheme();
        }
        
        // Expose globally for other modules if needed
        window.apiConfig = apiConfig;
        if (window.u2MinimaxTts && typeof window.u2MinimaxTts.setConfig === 'function') {
            minimaxConfig = window.u2MinimaxTts.setConfig({ ...(window.u2MinimaxTts.DEFAULT_CONFIG || {}), ...minimaxConfig });
        } else {
            window.minimaxConfig = minimaxConfig;
        }
        window.userState = userState;
        exposeAccountGlobals();

        // ==========================================
        // UI DOM Elements Mapping
        // ==========================================
        UI.views.settings = document.getElementById('settings-view');
        UI.views.edit = document.getElementById('edit-view');
        UI.overlays.accountSwitcher = document.getElementById('account-sheet-overlay');
        UI.overlays.personaDetail = document.getElementById('persona-detail-sheet');
        UI.overlays.aboutDevice = document.getElementById('about-device-sheet');
        
        UI.lists.accounts = document.getElementById('account-list');

        // Detail Inputs Mapping
        UI.inputs = {
            detailName: document.getElementById('detail-name-input'),
            detailPhone: document.getElementById('detail-phone-input'),
            detailSignature: document.getElementById('detail-signature-input'),
            detailPersona: document.getElementById('detail-persona-input'),
            detailAvatarImg: document.getElementById('detail-avatar-img'),
            detailAvatarIcon: document.querySelector('#user-detail-avatar-wrapper .fa-user'),
            
            // API Config Inputs
            apiEndpoint: document.getElementById('api-endpoint-input'),
            apiKey: document.getElementById('api-key-input'),
            apiModel: document.getElementById('api-model-select'),
            apiTemp: document.getElementById('api-temp-input'),
            bgActivityToggle: document.getElementById('bg-activity-toggle'),
            systemNotificationToggle: document.getElementById('system-notification-toggle'),
            minimaxRegion: document.getElementById('minimax-region-select'),
            minimaxCustomEndpoint: document.getElementById('minimax-custom-endpoint-toggle'),
            minimaxEndpoint: document.getElementById('minimax-endpoint-input'),
            minimaxKey: document.getElementById('minimax-key-input'),
            minimaxGroupId: document.getElementById('minimax-group-id-input'),
            minimaxTtsModel: document.getElementById('minimax-tts-model-input'),
            presetName: document.getElementById('preset-name-input')
        };

        UI.lists.presets = document.getElementById('preset-list');
        
        UI.overlays.apiConfig = document.getElementById('api-config-sheet');
        UI.overlays.minimaxConfig = document.getElementById('minimax-config-sheet');
        UI.overlays.savePreset = document.getElementById('save-preset-name-sheet');
        UI.overlays.loadPreset = document.getElementById('load-preset-list-sheet');
        UI.overlays.assistiveBallSettings = document.getElementById('assistive-ball-settings-sheet');
        UI.inputs.assistiveBallToggle = document.getElementById('assistive-ball-toggle');
        UI.inputs.assistiveBallOpacity = document.getElementById('assistive-ball-opacity-range');
        UI.inputs.assistiveBallOpacityValue = document.getElementById('assistive-ball-opacity-value');

        // ==========================================
        // NAVIGATION EVENT LISTENERS
        // ==========================================
        
        // Open Settings from Dock
        const settingsBtn = document.getElementById('dock-icon-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                syncUIs();
                openView(UI.views.settings);
            });
        }
        
        // Close Settings
        const settingsBackBtn = document.getElementById('settings-title-back-btn');
        if (settingsBackBtn) {
            settingsBackBtn.addEventListener('click', () => closeView(UI.views.settings));
        }

        // About Device
        const aboutDeviceBtn = document.getElementById('about-device-btn');
        const aboutDeviceSheet = document.getElementById('about-device-sheet');
        const aboutDeviceCloseBtn = document.getElementById('about-device-close-btn');
        
        if (aboutDeviceBtn && aboutDeviceSheet) {
            aboutDeviceBtn.addEventListener('click', () => {
                const appNameEl = document.getElementById('about-device-app-name');
                if (appNameEl) appNameEl.textContent = 'u2phone';
                openView(aboutDeviceSheet);
            });
        }
        if (aboutDeviceCloseBtn && aboutDeviceSheet) {
            aboutDeviceCloseBtn.addEventListener('click', () => closeView(aboutDeviceSheet));
        }

        // Data Management
        const dataManagementBtn = document.getElementById('data-management-btn');
        const dataManagementSheet = document.getElementById('data-management-sheet');
        const dataManagementCloseBtn = document.getElementById('data-management-close-btn');
        
        if (dataManagementBtn && dataManagementSheet) {
            dataManagementBtn.addEventListener('click', () => {
                openView(dataManagementSheet);
            });
        }
        if (dataManagementCloseBtn && dataManagementSheet) {
            dataManagementCloseBtn.addEventListener('click', () => closeView(dataManagementSheet));
        }

        // Apple ID / Profile View
        const appleIdTrigger = document.getElementById('apple-id-trigger');
        if (appleIdTrigger) {
            appleIdTrigger.addEventListener('click', (e) => {
                e.stopPropagation(); 
                syncUIs();
                openView(UI.views.edit);
            });
        }
        const editBackBtn = document.getElementById('edit-back-btn');
        if (editBackBtn) {
            editBackBtn.addEventListener('click', () => closeView(UI.views.edit));
        }

        // ==========================================
        // IMAGE COMPRESSION & ACCOUNT MANAGEMENT
        // ==========================================
        function readImageAsCompressedDataUrl(file, options = {}) {
            return new Promise((resolve, reject) => {
                if (!file) {
                    reject(new Error('No file selected'));
                    return;
                }

                const {
                    maxWidth = 1024,
                    maxHeight = 1024,
                    quality = 0.82,
                    outputType = 'image/jpeg'
                } = options;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const rawDataUrl = event?.target?.result;
                    if (!rawDataUrl || typeof rawDataUrl !== 'string') {
                        reject(new Error('Failed to read file'));
                        return;
                    }

                    const image = new Image();
                    image.onload = () => {
                        let { width, height } = image;

                        if (!width || !height) {
                            resolve(rawDataUrl);
                            return;
                        }

                        const widthRatio = maxWidth / width;
                        const heightRatio = maxHeight / height;
                        const scale = Math.min(1, widthRatio, heightRatio);

                        const targetWidth = Math.max(1, Math.round(width * scale));
                        const targetHeight = Math.max(1, Math.round(height * scale));

                        const canvas = document.createElement('canvas');
                        canvas.width = targetWidth;
                        canvas.height = targetHeight;

                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            resolve(rawDataUrl);
                            return;
                        }

                        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

                        try {
                            const compressedDataUrl = canvas.toDataURL(outputType, quality);
                            resolve(compressedDataUrl || rawDataUrl);
                        } catch (err) {
                            console.warn('Failed to compress image, using original data url.', err);
                            resolve(rawDataUrl);
                        }
                    };

                    image.onerror = () => reject(new Error('Failed to load image for compression'));
                    image.src = rawDataUrl;
                };

                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(file);
            });
        }
        window.readImageAsCompressedDataUrl = readImageAsCompressedDataUrl;

        // Main Edit Avatar Logic
        const mainEditAvatarWrapper = document.getElementById('main-edit-avatar-wrapper');
        const mainAvatarUpload = document.getElementById('main-avatar-upload');
        if (mainEditAvatarWrapper && mainAvatarUpload) {
            mainEditAvatarWrapper.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') mainAvatarUpload.click();
            });

            mainAvatarUpload.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        const url = await readImageAsCompressedDataUrl(file, {
                            maxWidth: 256,
                            maxHeight: 256,
                            quality: 0.72
                        });

                        // Update user state
                        userState.avatarUrl = url;
                        
                        // Update current account in accounts array
                        const acc = accounts.find(a => a.id === currentAccountId);
                        if (acc) {
                            acc.avatarUrl = url;
                        }
                        
                        saveGlobalData();
                        // Sync the UI immediately
                        syncUIs();
                        notifyUserStateUpdated({ avatarChanged: true });
                        showToast('头像已更新');
                    } catch (err) {
                        console.error('Failed to process avatar upload', err);
                        showToast('头像处理失败');
                    }
                }
                e.target.value = ''; // Reset
            });
        }

        let isCreatingNewAccount = false;
        let detailTempId = null;

        // Account Switcher
        const switchAccountBtn = document.getElementById('switch-account-btn');
        if (switchAccountBtn) {
            switchAccountBtn.addEventListener('click', () => {
                renderAccountList();
                openView(UI.overlays.accountSwitcher);
            });
        }
        
        // Account List Rendering
        function renderAccountList() {
            if(!UI.lists.accounts) return;
            UI.lists.accounts.innerHTML = '';

            accounts.forEach(acc => {
                const card = document.createElement('div');
                card.className = `account-card ${acc.id === currentAccountId ? 'selected' : ''}`;
                if (acc.id === currentAccountId) {
                    card.style.backgroundColor = '#e8f2ff'; // highlight current
                }
                
                const avatarHtml = acc.avatarUrl ? `<img src="${acc.avatarUrl}" alt="">` : `<i class="fas fa-user"></i>`;
                card.innerHTML = `
                    <div class="account-content">
                        <div class="account-avatar">${avatarHtml}</div>
                        <div class="account-info">
                            <div class="account-name">${acc.name}</div>
                            <div class="account-detail">${acc.phone || 'No Phone'}</div>
                        </div>
                        <i class="fas fa-times delete-icon"></i>
                    </div>
                `;

                // Click to Open Detail View & Set Active
                card.querySelector('.account-content').addEventListener('click', (e) => {
                    // If clicked on delete icon, do not open detail view
                    if (e.target.classList.contains('delete-icon') || e.target.closest('.delete-icon')) return;

                    currentAccountId = acc.id;
                    if (window.setCurrentAccountId) window.setCurrentAccountId(acc.id);
                    renderAccountList(); // Refresh highlighting
                    
                    isCreatingNewAccount = false;
                    detailTempId = acc.id;
                    UI.inputs.detailName.value = acc.name || '';
                    UI.inputs.detailPhone.value = acc.phone || '';
                    if(UI.inputs.detailSignature) UI.inputs.detailSignature.value = acc.signature || '';
                    UI.inputs.detailPersona.value = acc.persona || '';
                    setDetailAvatar(acc.avatarUrl);
                    
                    openView(UI.overlays.personaDetail);
                });

                // Delete Action
                card.querySelector('.delete-icon').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete account "${acc.name}"?`)) {
                        accounts = accounts.filter(a => a.id !== acc.id);
                        if (currentAccountId === acc.id) {
                            currentAccountId = accounts.length > 0 ? accounts[0].id : null;
                            if (window.setCurrentAccountId) window.setCurrentAccountId(currentAccountId);
                            const nextAccount = accounts.find(a => a.id === currentAccountId);
                            userState.name = nextAccount?.name || '';
                            userState.phone = nextAccount?.phone || '';
                            userState.persona = nextAccount?.signature || nextAccount?.persona || '';
                            userState.avatarUrl = nextAccount?.avatarUrl || null;
                        }
                        saveGlobalData();
                        syncUIs();
                        notifyUserStateUpdated({ avatarChanged: true });
                        renderAccountList();
                    }
                });

                UI.lists.accounts.appendChild(card);
            });
        }

        // Add New Account
        document.getElementById('add-account-btn')?.addEventListener('click', () => {
            isCreatingNewAccount = true;
            detailTempId = Date.now();
            UI.inputs.detailName.value = '';
            UI.inputs.detailPhone.value = '';
            if(UI.inputs.detailSignature) UI.inputs.detailSignature.value = '';
            UI.inputs.detailPersona.value = '';
            setDetailAvatar(null);
            openView(UI.overlays.personaDetail);
        });

        // Save Selected Account to Main State
        document.getElementById('save-id-btn')?.addEventListener('click', () => {
            const accToSync = accounts.find(a => a.id === currentAccountId);
            if (accToSync) {
                userState.name = accToSync.name;
                userState.phone = accToSync.phone;
                userState.persona = accToSync.persona;
                userState.signature = accToSync.signature;
                userState.avatarUrl = accToSync.avatarUrl;
            } else {
                userState.name = '';
                userState.phone = '';
                userState.persona = '';
                userState.signature = '';
                userState.avatarUrl = null;
            }
            saveGlobalData();
            syncUIs();
            notifyUserStateUpdated({ avatarChanged: true });
            closeView(UI.overlays.accountSwitcher);
        });

        // Detail View Confirm
        document.getElementById('confirm-sync-btn')?.addEventListener('click', () => {
            const name = UI.inputs.detailName.value || 'New User';
            const phone = UI.inputs.detailPhone.value;
            const signature = UI.inputs.detailSignature ? UI.inputs.detailSignature.value : '';
            const persona = UI.inputs.detailPersona.value;
            const currentAvatarSrc = UI.inputs.detailAvatarImg.style.display === 'block' ? UI.inputs.detailAvatarImg.src : null;

            if (isCreatingNewAccount) {
                accounts.push({ id: detailTempId, name, phone, signature, persona, avatarUrl: currentAvatarSrc });
                currentAccountId = detailTempId; 
            } else {
                const acc = accounts.find(a => a.id === detailTempId);
                if (acc) {
                    acc.name = name;
                    acc.phone = phone;
                    acc.signature = signature;
                    acc.persona = persona;
                    acc.avatarUrl = currentAvatarSrc;
                }
            }
            isCreatingNewAccount = false;
            if (String(currentAccountId) === String(detailTempId)) {
                syncUserStateFromCurrentAccount();
            }
            saveGlobalData();
            syncUIs();
            notifyUserStateUpdated({ avatarChanged: true });
            renderAccountList(); 
            closeView(UI.overlays.personaDetail); 
            showToast('资料已保存');
        });

        // Avatar Upload Handler
        const userDetailAvatarWrapper = document.getElementById('user-detail-avatar-wrapper');
        if (userDetailAvatarWrapper) {
            userDetailAvatarWrapper.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') document.getElementById('detail-avatar-upload').click();
            });
        }

        document.getElementById('detail-avatar-upload')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const url = await readImageAsCompressedDataUrl(file, {
                        maxWidth: 256,
                        maxHeight: 256,
                        quality: 0.72
                    });
                    setDetailAvatar(url);
                } catch (err) {
                    console.error('Failed to process detail avatar upload', err);
                    showToast('头像处理失败');
                }
            }
        });

        function setDetailAvatar(url) {
            if (url) {
                UI.inputs.detailAvatarImg.src = url;
                UI.inputs.detailAvatarImg.style.display = 'block';
                if(UI.inputs.detailAvatarIcon) UI.inputs.detailAvatarIcon.style.display = 'none';
            } else {
                UI.inputs.detailAvatarImg.style.display = 'none';
                if(UI.inputs.detailAvatarIcon) UI.inputs.detailAvatarIcon.style.display = 'block';
                UI.inputs.detailAvatarImg.src = '';
            }
        }
        
        // Make syncUIs globally aware of the loaded userState
        const originalSyncUIs = window.syncUIs;
        window.syncUIs = function() {
            if (originalSyncUIs) {
                // Call original logic if any
                originalSyncUIs();
            }
            
            // Sync Apple ID Settings View
            const settingsName = document.getElementById('settings-name');
            const settingsAvatarImg = document.getElementById('settings-avatar-img');
            const settingsAvatarIcon = document.querySelector('.apple-id-avatar-small .fa-user');
            
            if (settingsName) {
                settingsName.textContent = userState.name || '未登录 Apple ID';
            }
            
            if (userState.avatarUrl) {
                if (settingsAvatarImg) {
                    settingsAvatarImg.src = userState.avatarUrl;
                    settingsAvatarImg.style.display = 'block';
                }
                if (settingsAvatarIcon) settingsAvatarIcon.style.display = 'none';
            } else {
                if (settingsAvatarImg) settingsAvatarImg.style.display = 'none';
                if (settingsAvatarIcon) settingsAvatarIcon.style.display = 'block';
            }
            
            // Sync Edit View
            const displayName = document.getElementById('display-name');
            const displayPhone = document.getElementById('display-phone');
            const displaySignature = document.getElementById('display-signature');
            const editAvatarImg = document.getElementById('edit-avatar-img');
            const editAvatarIcon = document.querySelector('#edit-avatar-preview .fa-user');
            
            if (displayName) displayName.textContent = userState.name || '未登录 Apple ID';
            if (displayPhone) displayPhone.textContent = userState.phone || '暂无手机号';
            if (displaySignature) displaySignature.textContent = userState.signature || '添加账号后可同步头像、名称与签名';
            
            if (userState.avatarUrl) {
                if (editAvatarImg) {
                    editAvatarImg.src = userState.avatarUrl;
                    editAvatarImg.style.display = 'block';
                }
                if (editAvatarIcon) editAvatarIcon.style.display = 'none';
            } else {
                if (editAvatarImg) editAvatarImg.style.display = 'none';
                if (editAvatarIcon) editAvatarIcon.style.display = 'block';
            }
            
            // Sync iMessage Home Top Bar
            const imProfileName = document.getElementById('imessage-profile-name');
            const imProfileSign = document.getElementById('imessage-profile-sign');
            const imAvatarImg = document.getElementById('imessage-avatar-img');
            const imAvatarIcon = document.getElementById('imessage-avatar-icon');
            
            if (imProfileName) imProfileName.textContent = userState.name || 'Default User';
            if (imProfileSign) imProfileSign.textContent = userState.signature || 'No Signature';
            
            if (userState.avatarUrl) {
                if (imAvatarImg) {
                    imAvatarImg.src = userState.avatarUrl;
                    imAvatarImg.style.display = 'block';
                }
                if (imAvatarIcon) imAvatarIcon.style.display = 'none';
            } else {
                if (imAvatarImg) imAvatarImg.style.display = 'none';
                if (imAvatarIcon) imAvatarIcon.style.display = 'block';
            }
        };

        // 初始同步 UI (使用包含了全局状态同步的完整方法)
        if (window.syncUIs) {
            window.syncUIs();
        }

        document.getElementById('close-account-sheet-btn')?.addEventListener('click', () => {
            closeView(UI.overlays.accountSwitcher);
        });

        document.getElementById('close-persona-sheet-btn')?.addEventListener('click', () => {
            closeView(UI.overlays.personaDetail);
        });

        // ==========================================
        // World Book Configuration Logic
        // ==========================================
        const worldBookMainBtn = document.getElementById('world-book-main-btn');
        if (worldBookMainBtn) {
            worldBookMainBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.renderWorldBooks) {
                    window.renderWorldBooks();
                }
                const wbView = document.getElementById('world-book-view');
                if (wbView) {
                    openView(wbView);
                }
            });
        }

        // ==========================================
        // THEME CONFIGURATION LOGIC
        // ==========================================
        const themeConfigBtn = document.getElementById('theme-config-btn');
        const imessageThemesBtn = document.getElementById('imessage-themes-btn');
        const themeConfigSheet = document.getElementById('theme-config-sheet');
        const desktopThemeConfigSheet = document.getElementById('desktop-theme-config-sheet');

        function applySavedTheme() {
            window.u2ThemeState = themeState;
            applyThemeBackground(themeState);
            applyThemeFont(themeState);
            applyThemeAppIcons(themeState);
            if (window.imApp && window.imApp.applyGlobalChatCss) {
                window.imApp.applyGlobalChatCss(themeState);
            }
        }
        
        function openDesktopThemeConfig() {
            ensureThemeFontStateShape();
            const themeBgUrlInput = document.getElementById('theme-bg-url-input');
            if (themeBgUrlInput) themeBgUrlInput.value = themeState.bgUrl || '';
            syncThemeFontInputsFromState();
            renderThemeFontPresetLists();
            renderThemeFontPreview();
            renderThemeAppList();
            openView(desktopThemeConfigSheet);
        }

        function openImessageThemeConfig() {
            const bubbleCssInput = document.getElementById('theme-bubble-css-input');
            if (bubbleCssInput) bubbleCssInput.value = window.imData?.currentSettingsFriend?.customCss || '';

            const chatCssInput = document.getElementById('theme-chat-css-input');
            if (chatCssInput) chatCssInput.value = themeState.imessageChatCss || '';

            const statusCssInput = document.getElementById('theme-status-css-input');
            if (statusCssInput) statusCssInput.value = window.imData?.currentSettingsFriend?.statusCss || '';

            openView(themeConfigSheet);
        }

        if (themeConfigBtn && desktopThemeConfigSheet) {
            themeConfigBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openDesktopThemeConfig();
            });
        }

        if (imessageThemesBtn && themeConfigSheet) {
            imessageThemesBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openImessageThemeConfig();
            });
        }

        // Theme Tabs Logic
        const themeTabs = document.querySelectorAll('.theme-tab');
        const themeTabContents = document.querySelectorAll('.theme-tab-content');
        
        themeTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetId = tab.getAttribute('data-target');
                themeTabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.color = '#8e8e93';
                });
                tab.classList.add('active');
                tab.style.color = 'var(--blue-color)';
                
                themeTabContents.forEach(content => {
                    if (content.id === targetId) {
                        content.style.display = 'block';
                    } else {
                        content.style.display = 'none';
                    }
                });
            });
        });
        
        const themeBubbleCssInput = document.getElementById('theme-bubble-css-input');
        const themeBubbleClearBtn = document.getElementById('theme-bubble-clear-btn');
        const themeBubbleCopyBtn = document.getElementById('theme-bubble-copy-btn');
        const themeBubbleApplyBtn = document.getElementById('theme-bubble-apply-btn');
        const themeChatCopyBtn = document.getElementById('theme-chat-copy-btn');
        const themeStatusCopyBtn = document.getElementById('theme-status-copy-btn');
        const themeBubbleSaveBtn = document.getElementById('theme-bubble-save-btn');
        const themeBubblePresetName = document.getElementById('theme-bubble-preset-name');
        
        const themeChatCssInput = document.getElementById('theme-chat-css-input');
        const themeChatClearBtn = document.getElementById('theme-chat-clear-btn');
        const themeChatSaveBtn = document.getElementById('theme-chat-save-btn');
        const themeChatPresetName = document.getElementById('theme-chat-preset-name');
        const themeChatPresetList = document.getElementById('theme-chat-preset-list');
        
        const themeStatusCssInput = document.getElementById('theme-status-css-input');
        const themeStatusClearBtn = document.getElementById('theme-status-clear-btn');
        const themeStatusSaveBtn = document.getElementById('theme-status-save-btn');
        const themeStatusPresetName = document.getElementById('theme-status-preset-name');
        const themeStatusPresetList = document.getElementById('theme-status-preset-list');
        
        const themeBubblePresetList = document.getElementById('theme-bubble-preset-list');
        
        // --- 新增的“主题美化”模块变量 ---
        const chatThemeBeautifyToggle = document.getElementById('chat-theme-beautify-toggle');
        const chatThemeBeautifyBody = document.getElementById('chat-theme-beautify-body');
        const chatThemeBubbleSelect = document.getElementById('chat-theme-bubble-select');
        const chatThemeChatSelect = document.getElementById('chat-theme-chat-select');
        const chatThemeStatusSelect = document.getElementById('chat-theme-status-select');
        const chatThemeApplyBtn = document.getElementById('chat-theme-apply-btn');

        // 控制“主题美化”展开折叠
        if (chatThemeBeautifyToggle && chatThemeBeautifyBody) {
            chatThemeBeautifyToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    chatThemeBeautifyBody.style.display = 'flex';
                    if (window.imData && window.imData.currentSettingsFriend) {
                        const friend = window.imData.currentSettingsFriend;
                        if (chatThemeBubbleSelect && friend.customCssEnabled) {
                            chatThemeBubbleSelect.value = friend.customCss || '';
                        }
                        if (chatThemeStatusSelect && friend.statusCssEnabled) {
                            chatThemeStatusSelect.value = friend.statusCss || '';
                        }
                    }
                    if (chatThemeChatSelect && themeState.imessageChatCssEnabled) {
                        chatThemeChatSelect.value = themeState.imessageChatCss || '';
                    }
                } else {
                    chatThemeBeautifyBody.style.display = 'none';
                }
            });
        }
        
        // Clear Bubble CSS
        if (themeBubbleClearBtn) {
            themeBubbleClearBtn.addEventListener('click', async () => {
                 if (window.imData && window.imData.currentSettingsFriend) {
                    const friend = window.imData.currentSettingsFriend;
                    if (window.imApp && window.imApp.commitScopedFriendChange) {
                        const saved = await window.imApp.commitScopedFriendChange(friend, (targetFriend) => {
                            targetFriend.customCss = '';
                            targetFriend.customCssEnabled = false;
                        }, { silent: true, syncSettings: true });
                        
                        if (saved) {
                            if (themeBubbleCssInput) themeBubbleCssInput.value = '';
                            if (window.imApp.applyFriendCss) window.imApp.applyFriendCss(window.imData.currentSettingsFriend);
                            showToast('已清空气泡样式');
                        } else {
                            showToast('清空气泡样式失败');
                        }
                    }
                } else {
                    showToast('请先选择一个朋友');
                }
            });
        }
        
        // Clear Chat CSS
        if (themeChatClearBtn) {
            themeChatClearBtn.addEventListener('click', () => {
                themeState.imessageChatCss = '';
                themeState.imessageChatCssEnabled = false;
                window.u2ThemeState = themeState;
                if (themeChatCssInput) themeChatCssInput.value = '';
                if (window.imApp && window.imApp.applyGlobalChatCss) {
                    window.imApp.applyGlobalChatCss(themeState);
                }
                saveGlobalData();
                showToast('Chat CSS cleared');
            });
        }

        // Clear Status CSS
        if (themeStatusClearBtn) {
            themeStatusClearBtn.addEventListener('click', async () => {
                 if (window.imData && window.imData.currentSettingsFriend) {
                    const friend = window.imData.currentSettingsFriend;
                    if (window.imApp && window.imApp.commitScopedFriendChange) {
                        const saved = await window.imApp.commitScopedFriendChange(friend, (targetFriend) => {
                            targetFriend.statusCss = '';
                            targetFriend.statusCssEnabled = false;
                        }, { silent: true, syncSettings: true });
                        
                        if (saved) {
                            if (themeStatusCssInput) themeStatusCssInput.value = '';
                            if (window.imApp.applyFriendCss) window.imApp.applyFriendCss(window.imData.currentSettingsFriend);
                            showToast('已清空状态栏 CSS');
                        } else {
                            showToast('清空状态栏 CSS 失败');
                        }
                    }
                } else {
                    showToast('请先选择一个朋友');
                }
            });
        }

        if (themeBubbleCopyBtn) {
            themeBubbleCopyBtn.addEventListener('click', () => {
                const bubbleTemplate = `/* 气泡默认结构参考 */
.chat-row.user .chat-bubble {
  background: #111 !important;
  color: #fff !important;
  border-radius: 16px 16px 4px 16px !important;
}
.chat-row.char .chat-bubble {
  background: #e9e9ee !important;
  color: #111 !important;
  border-radius: 16px 16px 16px 4px !important;
}`;
                navigator.clipboard.writeText(bubbleTemplate).then(() => {
                    if (window.showToast) window.showToast('已复制气泡源码结构');
                }).catch(err => {
                    console.error('Copy failed', err);
                    if (window.showToast) window.showToast('复制失败');
                });
            });
        }

        if (themeChatCopyBtn) {
            themeChatCopyBtn.addEventListener('click', () => {
                const chatTemplate = `/* Chat 界面默认结构参考 */
.active-chat-interface {
  background-color: #ffffff;
  background-image: none;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* 顶部栏区域 */
.chat-sticky-container {
  border-bottom: 1px solid #f2f2f7;
  padding-bottom: 5px;
}
.chat-top-bar {
  background-color: transparent;
  backdrop-filter: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 44px;
}

/* 顶部左侧返回按钮 */
.chat-back-btn {
  cursor: pointer;
  padding: 5px 5px 5px 0;
  color: #000;
}

/* 顶部头像 */
.ins-chat-avatar {
  margin: 0;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: #e5e5ea;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #8e8e93;
  overflow: hidden;
}

/* 名字和签名区域 */
.ins-chat-name {
  font-size: 18px;
  line-height: 1.2;
  font-weight: 600;
  color: #000;
}
.ins-chat-sign {
  font-size: 13px;
  color: #8e8e93;
}

/* 顶部右侧菜单按钮 */
.chat-menu-btn {
  cursor: pointer;
  padding: 5px;
  color: #000;
}

/* 聊天消息列表区域 */
.ins-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

/* 底部输入框区域 */
.ins-chat-input-container {
  background-color: #ffffff;
  border-top: 1px solid #f2f2f7;
  padding: 10px 16px 20px;
}
.ins-chat-input-wrapper {
  background-color: #f2f2f7;
  border-radius: 22px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
}
.ins-message-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  color: #111;
}

/* 左侧加号图标 */
.ins-input-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: #007aff;
  color: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  font-size: 14px;
}

/* 右侧发送与麦克风图标 */
.send-btn-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  color: #007aff;
  font-size: 18px;
}`;
                navigator.clipboard.writeText(chatTemplate).then(() => {
                    if (window.showToast) window.showToast('已复制 Chat 源码结构');
                }).catch(err => {
                    console.error('Copy failed', err);
                    if (window.showToast) window.showToast('复制失败');
                });
            });
        }

        if (themeStatusCopyBtn) {
            themeStatusCopyBtn.addEventListener('click', () => {
                const statusTemplate = `/* 状态栏资料卡（点击头像弹出）默认结构参考 */
/* 主卡片容器 */
.chat-profile-panel-card {
  background: #ffffff;
  border-radius: 24px;
}

/* 顶部背景区 */
.chat-profile-panel-header {
  height: 88px;
  background: linear-gradient(180deg, #f2f2f7 0%, #ffffff 100%);
}

/* 头像容器 */
.chat-profile-panel-header .gmp-avatar {
  width: 66px;
  height: 66px;
  border: 3px solid #ffffff;
}

/* 在线状态绿点/文本气泡 */
.gmp-status-bubble {
  background: #ffffff;
  border: 1px solid #e5e5ea;
  color: #333;
}

/* 名字区域 */
.gmp-name {
  font-size: 18px;
  font-weight: 700;
  color: #000;
}

/* 签名区域 */
.gmp-signature {
  font-size: 13px;
  color: #8e8e93;
}

/* 内心想法气泡 (thought) */
.gmp-inner-voice, .chat-profile-panel-thought {
  background: #f2f2f7;
  color: #333;
  border-radius: 16px;
}

/* 底部悬浮的切换 Tab 按钮 */
.chat-profile-panel-tab-btn {
  background: #fff;
  color: #111;
}
.chat-profile-panel-tab-btn.active {
  background: #111;
  color: #fff;
}`;
                navigator.clipboard.writeText(statusTemplate).then(() => {
                    if (window.showToast) window.showToast('已复制状态栏源码结构');
                }).catch(err => {
                    console.error('Copy failed', err);
                    if (window.showToast) window.showToast('复制失败');
                });
            });
        }

        // Preset management logic
        function loadPresets(type) {
            const presets = window.StorageManager ? window.StorageManager.load(`u2_theme_${type}Presets`, []) : [];
            return Array.isArray(presets) ? presets : [];
        }

        function savePresets(type, presets) {
            if (window.StorageManager) {
                window.StorageManager.save(`u2_theme_${type}Presets`, presets);
            }
        }

        function updatePresetSelect(type, selectEl) {
            if (!selectEl) return;
            const presets = loadPresets(type);
            selectEl.innerHTML = '<option value="">选择已保存的预设加载</option>';
            presets.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.css;
                opt.textContent = p.name;
                selectEl.appendChild(opt);
            });
        }

        function renderThemePresetList(type, listEl, selectEl, cssInputEl) {
            if (!listEl) return;
            listEl.innerHTML = '';
            const presets = loadPresets(type);
            
            if (presets.length === 0) {
                listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #8e8e93;">暂无预设</div>';
                return;
            }

            presets.forEach(preset => {
                const item = document.createElement('div');
                item.className = 'account-card';
                item.style.marginBottom = '10px';
                
                const cssPreview = preset.css.length > 50 ? preset.css.substring(0, 50) + '...' : preset.css;
                
                item.innerHTML = `
                    <div class="account-content" style="cursor: pointer;">
                        <div class="account-info">
                            <div class="account-name">${preset.name}</div>
                            <div class="account-detail" style="font-family: monospace; font-size: 11px;">${cssPreview}</div>
                        </div>
                        <i class="fas fa-times delete-icon"></i>
                    </div>
                `;

                item.querySelector('.account-content').addEventListener('click', (e) => {
                    if (e.target.classList.contains('delete-icon') || e.target.closest('.delete-icon')) return;
                    if (cssInputEl) {
                        cssInputEl.value = preset.css;
                        if (window.showToast) window.showToast(`已应用预设 "${preset.name}" 的代码`);
                    }
                });

                item.querySelector('.delete-icon').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`删除预设“${preset.name}”？`)) {
                        const newPresets = presets.filter(p => p.id !== preset.id);
                        savePresets(type, newPresets);
                        updatePresetSelect(type, selectEl);
                        renderThemePresetList(type, listEl, selectEl, cssInputEl);
                        if (window.showToast) window.showToast('预设已删除');
                    }
                });

                listEl.appendChild(item);
            });
        }

        function setupPresetLogic(type, saveBtn, nameInput, selectEl, listEl, cssInputEl) {
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    let cssInput;
                    if (type === 'bubble') cssInput = themeBubbleCssInput;
                    else if (type === 'chat') cssInput = themeChatCssInput;
                    else if (type === 'status') cssInput = themeStatusCssInput;

                    const name = nameInput ? nameInput.value.trim() : '';
                    const css = cssInput ? cssInput.value.trim() : '';
                    if (!name) {
                        if (window.showToast) window.showToast('请输入预设名字');
                        return;
                    }
                    if (!css) {
                        if (window.showToast) window.showToast('CSS 代码不能为空');
                        return;
                    }
                    const presets = loadPresets(type);
                    const existingIndex = presets.findIndex(p => p.name === name);
                    if (existingIndex >= 0) {
                        presets[existingIndex].css = css;
                    } else {
                        presets.push({ id: Date.now(), name, css });
                    }
                    savePresets(type, presets);
                    updatePresetSelect(type, selectEl);
                    if (nameInput) nameInput.value = '';
                    if (window.showToast) window.showToast(`预设 "${name}" 已保存`);
                });
            }

            if (selectEl) {
                // Initial load
                updatePresetSelect(type, selectEl);
            }
            if (listEl) {
                renderThemePresetList(type, listEl, selectEl, cssInputEl);
            }
        }

        setupPresetLogic('bubble', themeBubbleSaveBtn, themeBubblePresetName, chatThemeBubbleSelect, themeBubblePresetList, themeBubbleCssInput);
        setupPresetLogic('chat', themeChatSaveBtn, themeChatPresetName, chatThemeChatSelect, themeChatPresetList, themeChatCssInput);
        setupPresetLogic('status', themeStatusSaveBtn, themeStatusPresetName, chatThemeStatusSelect, themeStatusPresetList, themeStatusCssInput);
        
        // "应用"按钮统一逻辑
        if (chatThemeApplyBtn) {
            chatThemeApplyBtn.addEventListener('click', async () => {
                if (!window.imData || !window.imData.currentSettingsFriend) {
                    showToast('请先选择一个朋友');
                    return;
                }
                
                const friend = window.imData.currentSettingsFriend;
                const nextBubbleCss = chatThemeBubbleSelect ? chatThemeBubbleSelect.value : '';
                const nextChatCss = chatThemeChatSelect ? chatThemeChatSelect.value : '';
                const nextStatusCss = chatThemeStatusSelect ? chatThemeStatusSelect.value : '';

                if (window.imApp && window.imApp.commitScopedFriendChange) {
                    const saved = await window.imApp.commitScopedFriendChange(friend, (targetFriend) => {
                        // 气泡 CSS
                        targetFriend.customCss = nextBubbleCss;
                        targetFriend.customCssEnabled = !!nextBubbleCss;
                        
                        // 状态栏 CSS
                        targetFriend.statusCss = nextStatusCss;
                        targetFriend.statusCssEnabled = !!nextStatusCss;
                    }, { silent: true, syncSettings: true });
                    
                    if (saved) {
                        // Chat CSS 通常作为全局设置，或可挂载到当前对象。这里将其设为全局主题配置以适配现有逻辑
                        themeState.imessageChatCss = nextChatCss;
                        themeState.imessageChatCssEnabled = !!nextChatCss;
                        window.u2ThemeState = themeState;
                        saveGlobalData();

                        if (window.imApp.applyGlobalChatCss) {
                            window.imApp.applyGlobalChatCss(themeState);
                        }

                        if (window.imApp.applyFriendCss) {
                            window.imApp.applyFriendCss(window.imData.currentSettingsFriend);
                        }
                        
                        showToast('主题美化已应用');
                    } else {
                        showToast('应用主题失败');
                    }
                }
            });
        }
        // Theme Background
        const themeBgUploadBtn = document.getElementById('theme-bg-upload-btn');
        const themeBgResetBtn = document.getElementById('theme-bg-reset-btn');
        const themeBgFileInput = document.getElementById('theme-bg-file-input');
        
        if (themeBgUploadBtn) themeBgUploadBtn.addEventListener('click', () => themeBgFileInput?.click());
        if (themeBgResetBtn) {
            themeBgResetBtn.addEventListener('click', () => {
                themeState.bgUrl = null;
                commitThemeBackgroundChanges('背景已重置');
            });
        }
        
        if (themeBgFileInput) {
            themeBgFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        // Resize for background if compressImage is available
                        if (window.compressImage) {
                            window.compressImage(event.target.result, 1080, 1920, (compressedUrl) => {
                                themeState.bgUrl = compressedUrl;
                                commitThemeBackgroundChanges('背景已更新');
                            });
                        } else {
                            themeState.bgUrl = event.target.result;
                            commitThemeBackgroundChanges('背景已更新');
                        }
                    };
                    reader.readAsDataURL(file);
                }
                e.target.value = '';
            });
        }
        
        function applyThemeBackground(state) {
            const appEl = document.getElementById('app');
            if (!appEl) return;
            const bgUrl = typeof state.bgUrl === 'string' ? state.bgUrl.trim() : '';
            if (bgUrl) {
                appEl.style.backgroundImage = `url(${bgUrl})`;
                appEl.style.backgroundSize = 'cover';
                appEl.style.backgroundPosition = 'center';
                appEl.style.backgroundColor = 'transparent';
                document.body.style.backgroundImage = `url(${bgUrl})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
            } else {
                appEl.style.backgroundImage = '';
                appEl.style.backgroundColor = '';
                document.body.style.backgroundImage = '';
                document.body.style.backgroundSize = '';
                document.body.style.backgroundPosition = '';
            }
        }
        
        function commitThemeBackgroundChanges(toastMessage = '') {
            applyThemeBackground(themeState);
            saveGlobalData();
            if (toastMessage) showToast(toastMessage);
        }

        // Theme Apps Icons
        const themeAppListContainer = document.getElementById('theme-app-list');
        const themeAppFileInput = document.getElementById('theme-app-file-input');
        const resetAllIconsBtn = document.getElementById('theme-reset-all-icons-btn');
        let currentEditingAppIndex = -1;
        
        if (resetAllIconsBtn) {
            resetAllIconsBtn.addEventListener('click', () => {
                themeState.apps.forEach(app => { app.icon = null; });
                commitThemeAppIconChanges('应用图标已全部重置');
            });
        }
        
        if (themeAppFileInput) {
            themeAppFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && currentEditingAppIndex >= 0) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (window.compressImage) {
                            window.compressImage(event.target.result, 150, 150, (compressedUrl) => {
                                const appName = themeState.apps[currentEditingAppIndex]?.name || '应用';
                                themeState.apps[currentEditingAppIndex].icon = compressedUrl;
                                commitThemeAppIconChanges(`${appName} 图标已更新`);
                            });
                        } else {
                            const appName = themeState.apps[currentEditingAppIndex]?.name || '应用';
                            themeState.apps[currentEditingAppIndex].icon = event.target.result;
                            commitThemeAppIconChanges(`${appName} 图标已更新`);
                        }
                    };
                    reader.readAsDataURL(file);
                }
                e.target.value = '';
            });
        }
        
        function renderThemeAppList() {
            if (!themeAppListContainer) return;
            themeAppListContainer.innerHTML = '';
        
            themeState.apps.forEach((app, index) => {
                const item = document.createElement('div');
                item.className = 'form-item';
                item.style.padding = '8px 16px';
                item.style.height = '60px';
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.alignItems = 'center';
                item.style.borderBottom = '1px solid #f2f2f7';
                
                let iconHtml = '';
                if (app.icon) {
                    iconHtml = `<div style="width: 40px; height: 40px; border-radius: 10px; background-image: url('${app.icon}'); background-size: cover; background-position: center; border: 1px solid #e5e5ea; flex-shrink: 0;"></div>`;
                } else {
                    iconHtml = `<div style="width: 40px; height: 40px; border-radius: 10px; background-color: #f2f2f7; border: 1px solid #e5e5ea; display: flex; align-items: center; justify-content: center; color: #c7c7cc; flex-shrink: 0;"><i class="fas fa-image"></i></div>`;
                }
        
                item.innerHTML = `
                    <div style="display: flex; align-items: center; flex: 1;">
                        ${iconHtml}
                        <div style="margin-left: 12px; font-size: 16px; font-weight: 500; color: #000;">${app.name}</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <div class="reset-single-app-btn" style="width: 32px; height: 32px; border-radius: 50%; background: #ffebee; color: #ff3b30; display: flex; justify-content: center; align-items: center; cursor: pointer;">
                            <i class="fas fa-undo" style="font-size: 14px;"></i>
                        </div>
                        <div class="upload-single-app-btn" style="width: 32px; height: 32px; border-radius: 50%; background: #e8f5e9; color: #34c759; display: flex; justify-content: center; align-items: center; cursor: pointer;">
                            <i class="fas fa-upload" style="font-size: 14px;"></i>
                        </div>
                    </div>
                `;
                
                const resetBtn = item.querySelector('.reset-single-app-btn');
                resetBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    themeState.apps[index].icon = null;
                    commitThemeAppIconChanges(`${app.name} 图标已重置`);
                });
        
                const uploadBtn = item.querySelector('.upload-single-app-btn');
                uploadBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    currentEditingAppIndex = index;
                    themeAppFileInput?.click();
                });
        
                themeAppListContainer.appendChild(item);
            });
        }
        
        function applyThemeAppIcons(state) {
            if (!Array.isArray(state.apps)) return;
            state.apps.forEach(app => applyAppIconStyles(app));
        }
        
        function commitThemeAppIconChanges(toastMessage = '') {
            applyThemeAppIcons(themeState);
            renderThemeAppList();
            saveGlobalData();
            if (toastMessage) showToast(toastMessage);
        }
        
        function applyAppIconStyles(app) {
            const el = document.getElementById(app.id);
            if (!el) return;
        
            const appItem = el.classList.contains('app-item') ? el : el.closest('.app-item');
            const iconDiv = el.classList.contains('app-icon') ? el : (el.querySelector('.app-icon') || appItem?.querySelector('.app-icon'));
            const nameEl = appItem ? appItem.querySelector('.app-name') : el.querySelector('.app-name');
        
            if (nameEl && app.name) {
                nameEl.textContent = app.name;
            }
        
            if (!iconDiv) return;
        
            const ensureIconElement = (className, extraStyle = '') => {
                iconDiv.innerHTML = `<i class="${className}" style="${extraStyle}"></i>`;
                return iconDiv.querySelector('i');
            };
        
            if (app.icon) {
                iconDiv.innerHTML = '';
            iconDiv.style.backgroundImage = `url(${app.icon})`;
            iconDiv.style.backgroundSize = 'cover';
            iconDiv.style.backgroundPosition = 'center';
            iconDiv.style.backgroundColor = 'transparent';
            // Reset possible inner borders
            iconDiv.style.border = 'none';
            } else {
                iconDiv.style.backgroundImage = 'none';
                iconDiv.style.backgroundSize = '';
                iconDiv.style.backgroundPosition = '';
                iconDiv.style.backgroundColor = '';
                iconDiv.style.color = '';
                iconDiv.style.border = '1px solid #e5e5ea';
                iconDiv.style.display = 'flex';
                iconDiv.style.justifyContent = 'center';
                iconDiv.style.alignItems = 'center';
                iconDiv.innerHTML = '';
        
                const isCustomBg = !!window.u2ThemeState?.bgUrl;
                const defaultBg = isCustomBg ? 'rgba(255, 255, 255, 0.7)' : '#ffffff';
                const defaultImessageBg = isCustomBg ? 'rgba(255, 255, 255, 0.8)' : 'linear-gradient(180deg, #ffffff 0%, #f2f2f7 100%)';

                if (app.id === 'dock-icon-settings') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    ensureIconElement('fas fa-cog');
                } else if (app.id === 'dock-icon-imessage') {
                    iconDiv.style.background = defaultImessageBg;
                    iconDiv.style.color = '#1c1c1e';
                    ensureIconElement('fas fa-comment');
                } else if (app.id === 'dock-icon-youtube') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    iconDiv.style.fontSize = '38px';
                    ensureIconElement('fab fa-youtube');
                } else if (app.id === 'app-icon-1') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    ensureIconElement('fas fa-wallet');
                } else if (app.id === 'app-icon-2') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    ensureIconElement('fab fa-tiktok');
                } else if (app.id === 'app-icon-3') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    ensureIconElement('fas fa-layer-group', 'font-size: 26px;');
                } else if (app.id === 'app-icon-4') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    ensureIconElement('fa-brands fa-x-twitter', 'font-size: 26px;');
                } else if (app.id === 'app-icon-5') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    ensureIconElement('fas fa-shopping-bag', 'color: #1c1c1e; font-size: 30px; filter: none;');
                } else if (app.id === 'app-icon-6') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    iconDiv.style.fontSize = '30px';
                    ensureIconElement('fas fa-phone', 'color: #1c1c1e; font-size: 30px; filter: none;');
                } else if (app.id === 'app-icon-7') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    iconDiv.style.border = isCustomBg ? 'none' : '1px solid #e5e5ea';
                    iconDiv.style.fontSize = '32px';
                    iconDiv.style.fontWeight = '900';
                    iconDiv.style.fontFamily = 'Arial, sans-serif';
                    iconDiv.style.letterSpacing = '-1px';
                    iconDiv.innerHTML = 'N';
                } else if (app.id === 'app-icon-8') {
                    iconDiv.style.background = defaultBg;
                    iconDiv.style.color = '#1c1c1e';
                    ensureIconElement('fas fa-heart', 'color: #1c1c1e; font-size: 28px;');
                }
            }
        }

        // Theme Font Logic
        const themeFontBtn = document.getElementById('theme-font-btn');
        const themeFontModal = document.getElementById('theme-font-modal');
        const themeFontCloseBtn = document.getElementById('theme-font-close-btn');
        const themeFontResetBtn = document.getElementById('theme-font-reset-btn');
        const themeFontLinkFocusBtn = document.getElementById('theme-font-link-focus-btn');
        const themeFontApplyCustomBtn = document.getElementById('theme-font-apply-custom-btn');
        const themeFontSavePresetBtn = document.getElementById('theme-font-save-preset-btn');
        const themeFontCustomSection = document.getElementById('theme-font-custom-section');
        const themeFontModalPreview = document.getElementById('theme-font-modal-preview');
        const themeFontCurrentLabel = document.getElementById('theme-font-current-label');
        const themeFontModalPresetList = document.getElementById('theme-font-modal-preset-list');
        const themeFontModalUserPresetList = document.getElementById('theme-font-modal-user-preset-list');
        const themeFontNameInput = document.getElementById('theme-font-name-input');
        const themeFontUrlInput = document.getElementById('theme-font-url-input');
        const themeFontSizeSlider = document.getElementById('theme-font-size-slider');
        const themeFontSizeValue = document.getElementById('theme-font-size-value');
        const THEME_FONT_PREVIEW_TEXT = 'Aa 你好 Hello 123';
        let themeFontSaveTimer = null;
        
        function cloneThemeFontSources(sources = {}) {
            return {
                woff2: typeof sources.woff2 === 'string' ? sources.woff2.trim() : '',
                woff: typeof sources.woff === 'string' ? sources.woff.trim() : '',
                ttf: typeof sources.ttf === 'string' ? sources.ttf.trim() : ''
            };
        }

        function normalizeThemeFontSize(value) {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return 16;
            return Math.min(24, Math.max(12, Math.round(parsed)));
        }

        function sanitizeThemeFontCssName(value) {
            const sanitized = String(value || '').trim().replace(/["']/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ');
            return sanitized || 'CustomThemeFont';
        }

        function buildThemeFontFamily(cssName) {
            return `"${cssName}", system-ui`;
        }

        function normalizeThemeFontPreset(preset = {}, fallbackIndex = 0) {
            const normalizedName = sanitizeThemeFontCssName(preset.name || preset.label || preset.cssName || `CustomFont${fallbackIndex + 1}`);
            return {
                id: typeof preset.id === 'string' && preset.id ? preset.id : `font_preset_${Date.now()}_${fallbackIndex}`,
                type: 'user',
                name: normalizedName,
                label: normalizedName,
                cssName: sanitizeThemeFontCssName(preset.cssName || normalizedName),
                family: buildThemeFontFamily(preset.cssName || normalizedName),
                sources: cloneThemeFontSources(preset.sources)
            };
        }

        function ensureThemeFontStateShape() {
            if (!themeState || typeof themeState !== 'object') return;
            if (!themeState.fontMode) themeState.fontMode = 'preset';
            if (!themeState.fontPresetKey) themeState.fontPresetKey = 'system-default';
            if (!themeState.fontFamily) themeState.fontFamily = DEFAULT_SYSTEM_THEME_FONT_FAMILY;
            if (typeof themeState.fontCssName !== 'string') themeState.fontCssName = '';
            themeState.fontSize = normalizeThemeFontSize(themeState.fontSize);

            const builtin = BUILTIN_THEME_FONTS.find(f => f.key === themeState.fontPresetKey) || BUILTIN_THEME_FONTS[0];
            if (themeState.fontMode !== 'saved') {
                themeState.fontPresetKey = builtin.key;
                themeState.fontFamily = builtin.family || DEFAULT_SYSTEM_THEME_FONT_FAMILY;
                themeState.fontCssName = builtin.cssName || '';
            }

            if (!themeState.fontSources || typeof themeState.fontSources !== 'object') {
                themeState.fontSources = cloneThemeFontSources(builtin.sources);
            } else {
                themeState.fontSources = cloneThemeFontSources(themeState.fontSources);
            }

            if (!Array.isArray(themeState.savedFontPresets)) {
                themeState.savedFontPresets = [];
            } else {
                themeState.savedFontPresets = themeState.savedFontPresets.map((preset, index) => normalizeThemeFontPreset(preset, index));
            }
        }

        function getActiveThemeFontDefinition(state = themeState) {
            ensureThemeFontStateShape();
            if (state.fontMode === 'saved') {
                const savedPreset = state.savedFontPresets.find(p => p.id === state.fontPresetKey);
                if (savedPreset) {
                    return { ...savedPreset, type: 'user' };
                }
            }
            const preset = BUILTIN_THEME_FONTS.find(f => f.key === state.fontPresetKey) || BUILTIN_THEME_FONTS[0];
            return { ...preset, type: 'builtin' };
        }

        function buildThemeFontFaceCss(cssName, sources = {}) {
            const safeCssName = sanitizeThemeFontCssName(cssName);
            const safeSources = cloneThemeFontSources(sources);
            const srcList = [];
            if (safeSources.woff2) srcList.push(`url("${safeSources.woff2}") format("woff2")`);
            if (safeSources.woff) srcList.push(`url("${safeSources.woff}") format("woff")`);
            if (safeSources.ttf) srcList.push(`url("${safeSources.ttf}") format("truetype")`);
            if (!safeCssName || srcList.length === 0) return '';
            return `
            @font-face {
                font-family: '${safeCssName}';
                src: ${srcList.join(',\n         ')};
                font-weight: normal;
                font-style: normal;
                font-display: swap;
            }`.trim();
        }

        function getThemeFontFaceStyleElement() {
            let styleEl = document.getElementById('theme-font-face-style');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'theme-font-face-style';
                document.head.appendChild(styleEl);
            }
            return styleEl;
        }

        function getThemeFontAppliedStyleElement() {
            let styleEl = document.getElementById('theme-font-applied-style');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'theme-font-applied-style';
                document.head.appendChild(styleEl);
            }
            return styleEl;
        }

        function applyThemeFont(state = themeState) {
            ensureThemeFontStateShape();
            const definition = getActiveThemeFontDefinition(state);
            const faceStyleEl = getThemeFontFaceStyleElement();
            faceStyleEl.textContent = buildThemeFontFaceCss(definition.cssName, definition.sources);
            
            const appliedStyleEl = getThemeFontAppliedStyleElement();
            const resolvedFamily = definition.family || 'system-ui';
            const resolvedSize = `${normalizeThemeFontSize(state.fontSize)}px`;

            appliedStyleEl.textContent = `
            :root {
                --theme-font-family: ${resolvedFamily};
                --theme-font-size: ${resolvedSize};
            }
            body,
            #app,
            #app :where(.app-page, .settings-view, .bottom-sheet, .bottom-sheet-overlay, .settings-group, .settings-item, .settings-text, .form-item, .sheet-title, .sheet-action, .chat-bubble, .chat-row, .ins-chat-input-container, .ins-chat-messages, .global-textarea, input, textarea, button, select) {
                font-family: var(--theme-font-family) !important;
                font-size: var(--theme-font-size);
            }
            #app :where(*):not(i):not(.fa):not(.fas):not(.far):not(.fab):not(.fal):not(.fa-solid):not(.fa-regular):not(.fa-brands) {
                font-family: var(--theme-font-family) !important;
            }
            #app :where(i, .fa, .fas, .far, .fab, .fal, .fa-solid, .fa-regular, .fa-brands),
            #app :where(i, .fa, .fas, .far, .fab, .fal, .fa-solid, .fa-regular, .fa-brands)::before {
                font-family: "Font Awesome 6 Free", "Font Awesome 6 Brands" !important;
            }
            #app :where(#theme-bubble-css-input, #theme-chat-css-input, #theme-status-css-input, #bubble-css-input, #status-css-input, textarea[placeholder*="CSS"], textarea[placeholder*="css"]) {
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace !important;
                font-size: 13px !important;
            }`.trim();
            
            document.documentElement.style.setProperty('--theme-font-family', resolvedFamily);
            document.documentElement.style.setProperty('--theme-font-size', resolvedSize);
            return definition;
        }

        function renderThemeFontPreview() {
            ensureThemeFontStateShape();
            const definition = getActiveThemeFontDefinition(themeState);
            const previewSize = `${normalizeThemeFontSize(themeState.fontSize)}px`;

            if (themeFontModalPreview) {
                themeFontModalPreview.textContent = THEME_FONT_PREVIEW_TEXT;
                themeFontModalPreview.style.fontFamily = definition.family || 'system-ui';
                themeFontModalPreview.style.fontSize = previewSize;
            }
            if (themeFontSizeValue) themeFontSizeValue.textContent = previewSize;
            if (themeFontSizeSlider) themeFontSizeSlider.value = String(normalizeThemeFontSize(themeState.fontSize));
            
            let labelText = definition.type === 'user' ? `我的预设 · ${definition.label}` : definition.label;
            if (themeFontCurrentLabel) themeFontCurrentLabel.textContent = `当前字体：${labelText}`;
        }
        
        function syncThemeFontInputsFromState() {
            ensureThemeFontStateShape();
            if (themeFontSizeSlider) themeFontSizeSlider.value = String(normalizeThemeFontSize(themeState.fontSize));
            if (themeFontSizeValue) themeFontSizeValue.textContent = `${normalizeThemeFontSize(themeState.fontSize)}px`;
            
            if (themeFontNameInput && themeFontUrlInput) {
                if (themeState.fontMode === 'saved') {
                    const preset = themeState.savedFontPresets.find(p => p.id === themeState.fontPresetKey);
                    if (preset) {
                        themeFontNameInput.value = preset.name || '';
                        themeFontUrlInput.value = preset.sources.woff2 || preset.sources.woff || preset.sources.ttf || '';
                        return;
                    }
                }
                themeFontNameInput.value = '';
                themeFontUrlInput.value = '';
            }
        }
        
        function commitThemeFontChanges(toastMessage = '') {
            renderThemeFontPresetLists();
            renderThemeFontPreview();
            applyThemeFont(themeState);
            saveGlobalData();
            if (toastMessage) showToast(toastMessage);
        }

        function scheduleThemeFontSave() {
            if (themeFontSaveTimer) clearTimeout(themeFontSaveTimer);
            themeFontSaveTimer = setTimeout(() => {
                themeFontSaveTimer = null;
                saveGlobalData();
            }, 300);
        }

        function createThemeFontPill({ label, family, isActive, onSelect, onDelete = null }) {
            const pill = document.createElement('button');
            pill.type = 'button';
            pill.className = `theme-font-pill ${isActive ? 'active' : ''}`;
            pill.style.fontFamily = family || 'system-ui';
        
            const pillLabel = document.createElement('span');
            pillLabel.className = 'theme-font-pill-label';
            pillLabel.textContent = label;
            pill.appendChild(pillLabel);
        
            pill.addEventListener('click', () => onSelect?.());
        
            if (typeof onDelete === 'function') {
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'theme-font-pill-delete';
                deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
                deleteBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    onDelete();
                });
                pill.appendChild(deleteBtn);
            }
            return pill;
        }
        
        function renderThemeFontPresetLists() {
            if (themeFontModalUserPresetList) {
                themeFontModalUserPresetList.innerHTML = '';
                
                // Add Built-in font (Default) to user preset list
                const builtin = BUILTIN_THEME_FONTS[0];
                const isBuiltinActive = themeState.fontMode === 'preset' && themeState.fontPresetKey === builtin.key;
                themeFontModalUserPresetList.appendChild(createThemeFontPill({
                    label: builtin.label,
                    family: builtin.family,
                    isActive: isBuiltinActive,
                    onSelect: () => {
                        themeState.fontMode = 'preset';
                        themeState.fontPresetKey = builtin.key;
                        themeState.fontCssName = builtin.cssName || '';
                        themeState.fontFamily = builtin.family || DEFAULT_SYSTEM_THEME_FONT_FAMILY;
                        themeState.fontSources = cloneThemeFontSources(builtin.sources);
                        syncThemeFontInputsFromState();
                        commitThemeFontChanges(`已切换到 ${builtin.label}`);
                    }
                    // No onDelete for builtin font
                }));
                
                // Add User Presets
                themeState.savedFontPresets.forEach((preset) => {
                    const isActive = themeState.fontMode === 'saved' && themeState.fontPresetKey === preset.id;
                    themeFontModalUserPresetList.appendChild(createThemeFontPill({
                        label: preset.label,
                        family: preset.family,
                        isActive,
                        onSelect: () => {
                            themeState.fontMode = 'saved';
                            themeState.fontPresetKey = preset.id;
                            themeState.fontCssName = preset.cssName;
                            themeState.fontFamily = preset.family;
                            themeState.fontSources = cloneThemeFontSources(preset.sources);
                            syncThemeFontInputsFromState();
                            commitThemeFontChanges(`已切换到 ${preset.label}`);
                        },
                        onDelete: () => {
                            themeState.savedFontPresets = themeState.savedFontPresets.filter(p => p.id !== preset.id);
                            if (themeState.fontMode === 'saved' && themeState.fontPresetKey === preset.id) {
                                const builtin = BUILTIN_THEME_FONTS[0];
                                themeState.fontMode = 'preset';
                                themeState.fontPresetKey = builtin.key;
                                themeState.fontCssName = builtin.cssName || '';
                                themeState.fontFamily = builtin.family || DEFAULT_SYSTEM_THEME_FONT_FAMILY;
                                themeState.fontSources = cloneThemeFontSources(builtin.sources);
                            }
                            syncThemeFontInputsFromState();
                            commitThemeFontChanges(`已删除预设 ${preset.label}`);
                        }
                    }));
                });
            }
        }
        
        function buildThemeFontDraftFromInputs() {
            const cssName = sanitizeThemeFontCssName(themeFontNameInput?.value || '');
            const rawUrl = String(themeFontUrlInput?.value || '').trim();
            let fontSources = { woff2: '', woff: '', ttf: '' };
            if (rawUrl) {
                const normalizedUrl = rawUrl.split('?')[0].split('#')[0].toLowerCase();
                if (normalizedUrl.endsWith('.woff2')) fontSources.woff2 = rawUrl;
                else if (normalizedUrl.endsWith('.woff')) fontSources.woff = rawUrl;
                else if (normalizedUrl.endsWith('.ttf')) fontSources.ttf = rawUrl;
                else fontSources.woff2 = rawUrl; // default fallback
            }
        
            if (!fontSources.woff2 && !fontSources.woff && !fontSources.ttf) {
                showToast('请至少填写一个字体完整链接');
                return null;
            }
            return {
                id: '', type: 'user', name: cssName, label: cssName, cssName,
                family: buildThemeFontFamily(cssName), sources: fontSources
            };
        }

        if (themeFontBtn) {
            themeFontBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (themeFontModal) {
                    syncThemeFontInputsFromState();
                    renderThemeFontPresetLists();
                    renderThemeFontPreview();
                    themeFontModal.style.display = 'flex';
                    // Trigger reflow
                    themeFontModal.offsetHeight;
                    themeFontModal.style.opacity = '1';
                }
            });
        }

        const closeThemeFontModal = () => {
            if (themeFontModal) {
                themeFontModal.style.opacity = '0';
                setTimeout(() => { themeFontModal.style.display = 'none'; }, 300);
            }
        };

        if (themeFontCloseBtn) themeFontCloseBtn.addEventListener('click', closeThemeFontModal);
        
        if (themeFontResetBtn) {
            themeFontResetBtn.addEventListener('click', () => {
                const builtin = BUILTIN_THEME_FONTS[0];
                themeState.fontMode = 'preset';
                themeState.fontPresetKey = builtin.key;
                themeState.fontFamily = builtin.family;
                themeState.fontCssName = builtin.cssName || '';
                themeState.fontSources = cloneThemeFontSources(builtin.sources);
                themeState.fontSize = 16;
                syncThemeFontInputsFromState();
                commitThemeFontChanges('字体已重置为默认字体');
            });
        }
        
        if (themeFontLinkFocusBtn) {
            themeFontLinkFocusBtn.addEventListener('click', () => {
                themeFontCustomSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                themeFontNameInput?.focus();
            });
        }
        
        if (themeFontApplyCustomBtn) {
            themeFontApplyCustomBtn.addEventListener('click', () => {
                const draftPreset = buildThemeFontDraftFromInputs();
                if (!draftPreset) return;
                themeState.fontMode = 'saved';
                themeState.fontPresetKey = '__draft__';
                themeState.fontCssName = draftPreset.cssName;
                themeState.fontFamily = draftPreset.family;
                themeState.fontSources = cloneThemeFontSources(draftPreset.sources);
                commitThemeFontChanges('链接字体已应用');
            });
        }
        
        if (themeFontSavePresetBtn) {
            themeFontSavePresetBtn.addEventListener('click', () => {
                ensureThemeFontStateShape();
                const draftPreset = buildThemeFontDraftFromInputs();
                if (!draftPreset) return;
        
                const existingIndex = themeState.savedFontPresets.findIndex((preset) => preset.name === draftPreset.name);
                const presetId = existingIndex >= 0 ? themeState.savedFontPresets[existingIndex].id : `font_preset_${Date.now()}`;
                const nextPreset = normalizeThemeFontPreset({ ...draftPreset, id: presetId });
        
                if (existingIndex >= 0) {
                    themeState.savedFontPresets[existingIndex] = nextPreset;
                } else {
                    themeState.savedFontPresets.push(nextPreset);
                }
                
                themeState.fontMode = 'saved';
                themeState.fontPresetKey = nextPreset.id;
                themeState.fontCssName = nextPreset.cssName;
                themeState.fontFamily = nextPreset.family;
                themeState.fontSources = cloneThemeFontSources(nextPreset.sources);
                
                syncThemeFontInputsFromState();
                commitThemeFontChanges(existingIndex >= 0 ? '字体预设已更新' : '字体预设已保存');
            });
        }
        
        if (themeFontSizeSlider) {
            themeFontSizeSlider.addEventListener('input', (event) => {
                themeState.fontSize = normalizeThemeFontSize(event.target.value);
                renderThemeFontPreview();
                applyThemeFont(themeState);
                scheduleThemeFontSave();
            });
            themeFontSizeSlider.addEventListener('change', (event) => {
                if (themeFontSaveTimer) {
                    clearTimeout(themeFontSaveTimer);
                    themeFontSaveTimer = null;
                }
                saveGlobalData();
                showToast(`字体大小已调整为 ${themeState.fontSize}px`);
            });
        }
        
        // ==========================================
        // API CONFIGURATION LOGIC
        // ==========================================
        function saveGlobalData() {
            persistSettingsData();
        }

        function getBackgroundActivitySettings() {
            if (window.u2BackgroundActivity && typeof window.u2BackgroundActivity.getSettings === 'function') {
                return window.u2BackgroundActivity.getSettings();
            }

            return { enabled: false, intervalSeconds: 60 };
        }

        function syncBackgroundActivityControls() {
            const settings = getBackgroundActivitySettings();

            if (UI.inputs.bgActivityToggle) {
                UI.inputs.bgActivityToggle.checked = !!settings.enabled;
            }
        }

        function applyBackgroundActivityControls(showFeedback = false) {
            const currentSettings = getBackgroundActivitySettings();
            const intervalSeconds = currentSettings.intervalSeconds || 60;
            const enabled = !!UI.inputs.bgActivityToggle?.checked;

            if (window.u2BackgroundActivity && typeof window.u2BackgroundActivity.updateSettings === 'function') {
                window.u2BackgroundActivity.updateSettings({ enabled, intervalSeconds });
            } else if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                window.StorageManager.save('u2_backgroundActivitySettings', { enabled, intervalSeconds, lastTickAt: 0 });
            }

            if (showFeedback && typeof showToast === 'function') {
                showToast(enabled ? '后台保活已开启' : '后台保活已关闭');
            }
        }

        if (UI.inputs.bgActivityToggle) {
            UI.inputs.bgActivityToggle.addEventListener('change', () => {
                applyBackgroundActivityControls(true);
            });
        }

        function syncSystemNotificationControls() {
            if (!UI.inputs.systemNotificationToggle) return;

            const settings = window.u2SystemNotifications?.getSettings
                ? window.u2SystemNotifications.getSettings()
                : { enabled: false };

            UI.inputs.systemNotificationToggle.checked = !!settings.enabled;
        }

        async function applySystemNotificationControls(showFeedback = false) {
            if (!UI.inputs.systemNotificationToggle) return;

            const enabled = !!UI.inputs.systemNotificationToggle.checked;

            if (window.u2SystemNotifications?.updateSettings) {
                const result = await window.u2SystemNotifications.updateSettings({ enabled });
                UI.inputs.systemNotificationToggle.checked = !!result.enabled;

                if (showFeedback && typeof showToast === 'function') {
                    if (result.unsupported) {
                        showToast('当前浏览器不支持系统通知');
                    } else if (result.permission === 'denied') {
                        showToast('系统通知权限被拒绝，请在浏览器设置中开启');
                    } else {
                        showToast(result.enabled ? '消息通知已开启' : '消息通知已关闭');
                    }
                }
                return;
            }

            UI.inputs.systemNotificationToggle.checked = false;
            if (showFeedback && typeof showToast === 'function') {
                showToast('消息通知模块未加载');
            }
        }

        if (UI.inputs.systemNotificationToggle) {
            UI.inputs.systemNotificationToggle.addEventListener('change', () => {
                applySystemNotificationControls(true);
            });
        }

        // -- Global Assistive API Ball --
        const assistiveBallConfigBtn = document.getElementById('assistive-ball-config-btn');
        let assistiveBallEl = null;
        let assistiveBallPanelEl = null;
        let assistivePresetSelectEl = null;
        let assistiveDragState = null;

        function getCurrentApiPresetId() {
            if (!Array.isArray(apiPresets)) return '';
            const match = apiPresets.find(preset =>
                (preset.endpoint || '') === (apiConfig.endpoint || '') &&
                (preset.apiKey || '') === (apiConfig.apiKey || '') &&
                (preset.model || '') === (apiConfig.model || '') &&
                String(preset.temp ?? 0.7) === String(apiConfig.temperature ?? 0.7)
            );
            return match ? String(match.id) : '';
        }

        function getApiDisplayValue(value, fallback = '未设置') {
            const text = String(value || '').trim();
            return text || fallback;
        }

        function maskApiKey(key) {
            const text = String(key || '').trim();
            if (!text) return '未设置';
            if (text.length <= 8) return '已填写';
            return `${text.slice(0, 4)}...${text.slice(-4)}`;
        }

        function normalizeAssistiveBallOpacity(value) {
            const numeric = parseFloat(value);
            if (!Number.isFinite(numeric)) return 0.72;
            return Math.max(0.2, Math.min(1, numeric > 1 ? numeric / 100 : numeric));
        }

        function syncAssistiveBallOpacityControls() {
            assistiveBallSettings.opacity = normalizeAssistiveBallOpacity(assistiveBallSettings.opacity);
            const percent = Math.round(assistiveBallSettings.opacity * 100);
            if (UI.inputs.assistiveBallOpacity) {
                UI.inputs.assistiveBallOpacity.value = String(percent);
            }
            if (UI.inputs.assistiveBallOpacityValue) {
                UI.inputs.assistiveBallOpacityValue.textContent = `${percent}%`;
            }
            if (assistiveBallEl) {
                assistiveBallEl.style.setProperty('--assistive-ball-opacity', assistiveBallSettings.opacity.toFixed(2));
            }
        }

        function ensureAssistiveBallDom() {
            const appContainer = document.getElementById('app') || document.body;

            if (!assistiveBallEl) {
                assistiveBallEl = document.createElement('div');
                assistiveBallEl.id = 'global-assistive-api-ball';
                assistiveBallEl.className = 'assistive-api-ball';
                assistiveBallEl.setAttribute('role', 'button');
                assistiveBallEl.setAttribute('aria-label', 'API 悬浮球');
                assistiveBallEl.innerHTML = '<div class="assistive-api-ball-inner"><i class="fas fa-circle-dot"></i></div>';
                appContainer.appendChild(assistiveBallEl);

                assistiveBallEl.addEventListener('click', (event) => {
                    event.stopPropagation();
                    if (assistiveBallEl.dataset.dragged === 'true') {
                        assistiveBallEl.dataset.dragged = 'false';
                        return;
                    }
                    openAssistiveBallPanel();
                });
                assistiveBallEl.addEventListener('pointerdown', startAssistiveBallDrag);
                syncAssistiveBallOpacityControls();
            }

            if (!assistiveBallPanelEl) {
                assistiveBallPanelEl = document.createElement('div');
                assistiveBallPanelEl.id = 'global-assistive-api-panel';
                assistiveBallPanelEl.className = 'assistive-api-panel';
                assistiveBallPanelEl.innerHTML = `
                    <div class="assistive-api-panel-title">当前 API</div>
                    <div class="assistive-api-row">
                        <span>模型</span>
                        <strong id="assistive-api-model">未设置</strong>
                    </div>
                    <label class="assistive-api-select-wrap">
                        <span>API 预设</span>
                        <select id="assistive-api-preset-select"></select>
                        <i class="fas fa-chevron-down"></i>
                    </label>
                `;
                appContainer.appendChild(assistiveBallPanelEl);
                assistivePresetSelectEl = assistiveBallPanelEl.querySelector('#assistive-api-preset-select');

                assistiveBallPanelEl.addEventListener('click', (event) => {
                    event.stopPropagation();
                    if (event.target === assistiveBallPanelEl) {
                        closeAssistiveBallPanel();
                    }
                });

                assistivePresetSelectEl?.addEventListener('change', (event) => {
                    applyAssistivePreset(event.target.value);
                });
            }
        }

        function openAssistiveBallPanel() {
            ensureAssistiveBallDom();
            syncAssistiveBallPanel();
            assistiveBallEl.classList.remove('visible');
            assistiveBallEl.classList.add('panel-open');
            assistiveBallPanelEl.classList.add('active');
        }

        function closeAssistiveBallPanel() {
            if (assistiveBallPanelEl) assistiveBallPanelEl.classList.remove('active');
            if (assistiveBallEl) {
                assistiveBallEl.classList.remove('panel-open');
                assistiveBallEl.classList.toggle('visible', assistiveBallSettings.enabled);
            }
        }

        function clampAssistiveBallPosition(x, y) {
            if (!assistiveBallEl) return { x: 0, y: 0 };
            const parent = assistiveBallEl.parentElement || document.body;
            const parentRect = parent.getBoundingClientRect();
            const ballRect = assistiveBallEl.getBoundingClientRect();
            const margin = 8;
            const width = ballRect.width || 58;
            const height = ballRect.height || 58;
            return {
                x: Math.max(margin, Math.min(x, parentRect.width - width - margin)),
                y: Math.max(margin, Math.min(y, parentRect.height - height - margin))
            };
        }

        function applyAssistiveBallPosition() {
            if (!assistiveBallEl) return;
            const parent = assistiveBallEl.parentElement || document.body;
            const parentRect = parent.getBoundingClientRect();
            const currentRect = assistiveBallEl.getBoundingClientRect();
            const fallbackX = parentRect.width - (currentRect.width || 58) - 12;
            const fallbackY = parentRect.height * 0.46;
            const next = clampAssistiveBallPosition(
                Number.isFinite(assistiveBallSettings.x) ? assistiveBallSettings.x : fallbackX,
                Number.isFinite(assistiveBallSettings.y) ? assistiveBallSettings.y : fallbackY
            );
            assistiveBallSettings.x = next.x;
            assistiveBallSettings.y = next.y;
            assistiveBallEl.style.left = `${next.x}px`;
            assistiveBallEl.style.top = `${next.y}px`;
        }

        function startAssistiveBallDrag(event) {
            if (!assistiveBallEl) return;
            const parent = assistiveBallEl.parentElement || document.body;
            const parentRect = parent.getBoundingClientRect();
            const ballRect = assistiveBallEl.getBoundingClientRect();

            assistiveDragState = {
                pointerId: event.pointerId,
                startClientX: event.clientX,
                startClientY: event.clientY,
                offsetX: event.clientX - ballRect.left,
                offsetY: event.clientY - ballRect.top,
                parentLeft: parentRect.left,
                parentTop: parentRect.top,
                moved: false
            };

            assistiveBallEl.classList.add('dragging');
            assistiveBallEl.setPointerCapture?.(event.pointerId);
            assistiveBallEl.addEventListener('pointermove', moveAssistiveBallDrag);
            assistiveBallEl.addEventListener('pointerup', endAssistiveBallDrag);
            assistiveBallEl.addEventListener('pointercancel', endAssistiveBallDrag);
        }

        function moveAssistiveBallDrag(event) {
            if (!assistiveDragState || !assistiveBallEl) return;

            const deltaX = event.clientX - assistiveDragState.startClientX;
            const deltaY = event.clientY - assistiveDragState.startClientY;
            if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
                assistiveDragState.moved = true;
                closeAssistiveBallPanel();
            }

            const next = clampAssistiveBallPosition(
                event.clientX - assistiveDragState.parentLeft - assistiveDragState.offsetX,
                event.clientY - assistiveDragState.parentTop - assistiveDragState.offsetY
            );
            assistiveBallSettings.x = next.x;
            assistiveBallSettings.y = next.y;
            assistiveBallEl.style.left = `${next.x}px`;
            assistiveBallEl.style.top = `${next.y}px`;
        }

        function endAssistiveBallDrag(event) {
            if (!assistiveBallEl) return;
            const moved = !!assistiveDragState?.moved;
            assistiveBallEl.classList.remove('dragging');
            assistiveBallEl.releasePointerCapture?.(event.pointerId);
            assistiveBallEl.removeEventListener('pointermove', moveAssistiveBallDrag);
            assistiveBallEl.removeEventListener('pointerup', endAssistiveBallDrag);
            assistiveBallEl.removeEventListener('pointercancel', endAssistiveBallDrag);
            assistiveDragState = null;

            if (moved) {
                assistiveBallEl.dataset.dragged = 'true';
                saveGlobalData();
                window.setTimeout(() => {
                    if (assistiveBallEl) assistiveBallEl.dataset.dragged = 'false';
                }, 0);
            }
        }

        function syncAssistiveBallPanel() {
            if (!assistiveBallPanelEl) return;

            const modelEl = assistiveBallPanelEl.querySelector('#assistive-api-model');

            if (modelEl) modelEl.textContent = getApiDisplayValue(apiConfig.model);

            if (!assistivePresetSelectEl) return;

            assistivePresetSelectEl.innerHTML = '';
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = Array.isArray(apiPresets) && apiPresets.length ? '选择 API 预设' : '暂无 API 预设';
            assistivePresetSelectEl.appendChild(placeholder);

            if (Array.isArray(apiPresets)) {
                apiPresets.forEach((preset) => {
                    const option = document.createElement('option');
                    option.value = String(preset.id);
                    option.textContent = preset.name || '未命名预设';
                    assistivePresetSelectEl.appendChild(option);
                });
            }

            assistivePresetSelectEl.value = getCurrentApiPresetId();
        }

        function setAssistiveBallEnabled(enabled) {
            assistiveBallSettings.enabled = !!enabled;
            if (UI.inputs.assistiveBallToggle) {
                UI.inputs.assistiveBallToggle.checked = assistiveBallSettings.enabled;
            }

            ensureAssistiveBallDom();
            syncAssistiveBallOpacityControls();
            applyAssistiveBallPosition();
            assistiveBallEl.classList.toggle('visible', assistiveBallSettings.enabled);
            if (!assistiveBallSettings.enabled) {
                closeAssistiveBallPanel();
            } else {
                syncAssistiveBallPanel();
            }
        }

        function applyAssistivePreset(presetId) {
            const preset = Array.isArray(apiPresets)
                ? apiPresets.find(item => String(item.id) === String(presetId))
                : null;
            if (!preset) {
                syncAssistiveBallPanel();
                return;
            }

            apiConfig = {
                endpoint: preset.endpoint || '',
                apiKey: preset.apiKey || '',
                model: preset.model || '',
                temperature: preset.temp ?? 0.7
            };
            tempApiConfig = { ...apiConfig };
            window.apiConfig = apiConfig;

            if (UI.inputs.apiEndpoint) UI.inputs.apiEndpoint.value = apiConfig.endpoint;
            if (UI.inputs.apiKey) UI.inputs.apiKey.value = apiConfig.apiKey;
            if (UI.inputs.apiModel) syncSelectValue(UI.inputs.apiModel, apiConfig.model || '');
            if (UI.inputs.apiTemp) UI.inputs.apiTemp.value = apiConfig.temperature;

            saveGlobalData();
            syncAssistiveBallPanel();
            showToast(`已切换到 ${preset.name || '未命名预设'}`);
        }

        if (assistiveBallConfigBtn && UI.overlays.assistiveBallSettings) {
            assistiveBallConfigBtn.addEventListener('click', () => {
                setAssistiveBallEnabled(assistiveBallSettings.enabled);
                syncAssistiveBallOpacityControls();
                openView(UI.overlays.assistiveBallSettings);
            });
        }

        if (UI.inputs.assistiveBallToggle) {
            UI.inputs.assistiveBallToggle.addEventListener('change', () => {
                setAssistiveBallEnabled(UI.inputs.assistiveBallToggle.checked);
                saveGlobalData();
                showToast(assistiveBallSettings.enabled ? '悬浮球已开启' : '悬浮球已关闭');
            });
        }

        if (UI.inputs.assistiveBallOpacity) {
            UI.inputs.assistiveBallOpacity.addEventListener('input', () => {
                assistiveBallSettings.opacity = normalizeAssistiveBallOpacity(UI.inputs.assistiveBallOpacity.value);
                syncAssistiveBallOpacityControls();
            });
            UI.inputs.assistiveBallOpacity.addEventListener('change', () => {
                assistiveBallSettings.opacity = normalizeAssistiveBallOpacity(UI.inputs.assistiveBallOpacity.value);
                syncAssistiveBallOpacityControls();
                saveGlobalData();
            });
        }

        document.addEventListener('click', (event) => {
            if (assistiveBallPanelEl?.classList.contains('active') && !assistiveBallPanelEl.contains(event.target)) {
                closeAssistiveBallPanel();
            }
        });

        window.u2AssistiveApiBall = {
            sync: syncAssistiveBallPanel,
            setEnabled: setAssistiveBallEnabled,
            getSettings: () => ({ ...assistiveBallSettings })
        };

        setAssistiveBallEnabled(assistiveBallSettings.enabled);

        function renderNativeModelSelect() {
            if (!UI.inputs.apiModel) return;
            UI.inputs.apiModel.innerHTML = '<option value="" disabled selected>选择模型</option>';
            if (Array.isArray(fetchedModels)) {
                fetchedModels.forEach(model => {
                    const opt = document.createElement('option');
                    opt.value = model;
                    opt.textContent = model;
                    UI.inputs.apiModel.appendChild(opt);
                });
            }
        }

        function syncSelectValue(selectEl, value) {
            if (!selectEl) return;
            let exists = Array.from(selectEl.options).some(opt => opt.value === value);
            if (value && !exists) {
                const opt = document.createElement('option');
                opt.value = value;
                opt.textContent = value;
                selectEl.appendChild(opt);
            }
            selectEl.value = value;
        }

        const apiConfigBtn = document.getElementById('api-config-btn');
        if (apiConfigBtn && UI.overlays.apiConfig) {
            apiConfigBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                renderNativeModelSelect();

                tempApiConfig = {
                    endpoint: apiConfig.endpoint || '',
                    apiKey: apiConfig.apiKey || '',
                    model: apiConfig.model || '',
                    temperature: apiConfig.temperature ?? 0.7
                };

                UI.inputs.apiEndpoint.value = tempApiConfig.endpoint || '';
                UI.inputs.apiKey.value = tempApiConfig.apiKey || '';
                syncSelectValue(UI.inputs.apiModel, tempApiConfig.model || '');
                UI.inputs.apiTemp.value = tempApiConfig.temperature ?? 0.7;
                syncBackgroundActivityControls();
                syncSystemNotificationControls();

                openView(UI.overlays.apiConfig);
            });
        }

        function syncMinimaxCustomEndpointVisibility() {
            const endpointGroup = document.getElementById('minimax-custom-endpoint-group');
            const enabled = !!(UI.inputs.minimaxCustomEndpoint && UI.inputs.minimaxCustomEndpoint.checked);
            if (endpointGroup) endpointGroup.style.display = enabled ? 'block' : 'none';
        }

        function syncMinimaxInputs() {
            if (window.u2MinimaxTts && typeof window.u2MinimaxTts.getConfig === 'function') {
                minimaxConfig = window.u2MinimaxTts.getConfig();
            }
            if (UI.inputs.minimaxRegion) UI.inputs.minimaxRegion.value = minimaxConfig.region || 'cn';
            if (UI.inputs.minimaxCustomEndpoint) UI.inputs.minimaxCustomEndpoint.checked = !!minimaxConfig.customEndpointEnabled;
            if (UI.inputs.minimaxEndpoint) UI.inputs.minimaxEndpoint.value = minimaxConfig.endpoint || '';
            if (UI.inputs.minimaxKey) UI.inputs.minimaxKey.value = minimaxConfig.apiKey || '';
            if (UI.inputs.minimaxGroupId) UI.inputs.minimaxGroupId.value = minimaxConfig.groupId || '';
            if (UI.inputs.minimaxTtsModel) UI.inputs.minimaxTtsModel.value = minimaxConfig.ttsModel || 'speech-02-hd';
            syncMinimaxCustomEndpointVisibility();
        }

        const minimaxConfigBtn = document.getElementById('minimax-config-btn');
        if (minimaxConfigBtn && UI.overlays.minimaxConfig) {
            minimaxConfigBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                syncMinimaxInputs();
                openView(UI.overlays.minimaxConfig);
            });
        }

        if (UI.inputs.minimaxCustomEndpoint) {
            UI.inputs.minimaxCustomEndpoint.addEventListener('change', syncMinimaxCustomEndpointVisibility);
        }

        const confirmMinimaxBtn = document.getElementById('confirm-minimax-btn');
        if (confirmMinimaxBtn) {
            confirmMinimaxBtn.addEventListener('click', () => {
                minimaxConfig = {
                    region: UI.inputs.minimaxRegion ? UI.inputs.minimaxRegion.value : 'cn',
                    customEndpointEnabled: !!(UI.inputs.minimaxCustomEndpoint && UI.inputs.minimaxCustomEndpoint.checked),
                    endpoint: UI.inputs.minimaxEndpoint ? UI.inputs.minimaxEndpoint.value.trim() : '',
                    apiKey: UI.inputs.minimaxKey ? UI.inputs.minimaxKey.value.trim() : '',
                    groupId: UI.inputs.minimaxGroupId ? UI.inputs.minimaxGroupId.value.trim() : '',
                    ttsModel: UI.inputs.minimaxTtsModel ? (UI.inputs.minimaxTtsModel.value.trim() || 'speech-02-hd') : 'speech-02-hd'
                };

                if (window.u2MinimaxTts && typeof window.u2MinimaxTts.setConfig === 'function') {
                    minimaxConfig = window.u2MinimaxTts.setConfig(minimaxConfig);
                } else {
                    window.minimaxConfig = minimaxConfig;
                }

                saveGlobalData();
                closeView(UI.overlays.minimaxConfig);
                showToast('Minimax 设置已保存');
            });
        }

        const confirmApiBtn = document.getElementById('confirm-api-btn');
        if (confirmApiBtn) {
            confirmApiBtn.addEventListener('click', () => {
                tempApiConfig.endpoint = UI.inputs.apiEndpoint.value;
                tempApiConfig.apiKey = UI.inputs.apiKey.value;
                tempApiConfig.model = UI.inputs.apiModel.value;
                tempApiConfig.temperature = parseFloat(UI.inputs.apiTemp.value) || 0.7;

                apiConfig = {
                    endpoint: tempApiConfig.endpoint,
                    apiKey: tempApiConfig.apiKey,
                    model: tempApiConfig.model,
                    temperature: tempApiConfig.temperature
                };

                applyBackgroundActivityControls(false);
                applySystemNotificationControls(false);
                
                window.apiConfig = apiConfig;
                saveGlobalData();
                syncAssistiveBallPanel();
                
                closeView(UI.overlays.apiConfig);
                showToast('API 设置已保存');
            });
        }

        const btnApiFetch = document.getElementById('fetch-models-btn');
        if (btnApiFetch) {
            btnApiFetch.addEventListener('click', async () => {
                const endpoint = UI.inputs.apiEndpoint.value.trim();
                const key = UI.inputs.apiKey.value.trim();
                
                if (!endpoint) {
                    showToast('请填写接口地址');
                    return;
                }

                const originalText = btnApiFetch.innerHTML;
                btnApiFetch.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';
                
                try {
                    let url = endpoint;
                    if (url.endsWith('/')) url = url.slice(0, -1);
                    if (!url.endsWith('/models')) {
                        url = url.endsWith('/v1') ? url + '/models' : url + '/v1/models';
                    }

                    const headers = { 'Content-Type': 'application/json' };
                    if (key) {
                        headers['Authorization'] = `Bearer ${key}`;
                    }

                    const res = await fetch(url, { method: 'GET', headers });
                    if (!res.ok) throw new Error('网络请求失败');
                    
                    const data = await res.json();
                    
                    if (data && data.data && Array.isArray(data.data)) {
                        fetchedModels = data.data.map(m => m.id);
                        saveGlobalData();
                        renderNativeModelSelect();
                        // 重新应用当前的选中状态
                        syncSelectValue(UI.inputs.apiModel, tempApiConfig.model || '');
                        showToast(`成功获取 ${fetchedModels.length} 个模型`);
                    } else {
                        throw new Error('格式无效');
                    }
                } catch (error) {
                    console.error('Fetch Models Error:', error);
                    showToast('获取模型失败');
                } finally {
                    btnApiFetch.innerHTML = originalText;
                }
            });
        }

        if (UI.inputs.apiModel) {
            UI.inputs.apiModel.addEventListener('change', (e) => {
                tempApiConfig.model = e.target.value;
            });
        }

        // -- Presets --
        const savePresetBtn = document.getElementById('save-preset-btn');
        const loadPresetBtn = document.getElementById('load-preset-btn');
        const confirmSavePresetBtn = document.getElementById('confirm-save-preset-btn');

        if (savePresetBtn && UI.overlays.savePreset) {
            savePresetBtn.addEventListener('click', () => {
                if (UI.inputs.presetName) UI.inputs.presetName.value = '';
                openView(UI.overlays.savePreset);
            });
        }

        if (confirmSavePresetBtn) {
            confirmSavePresetBtn.addEventListener('click', () => {
                const endpoint = UI.inputs.apiEndpoint ? UI.inputs.apiEndpoint.value.trim() : '';
                const apiKey = UI.inputs.apiKey ? UI.inputs.apiKey.value.trim() : '';
                const model = UI.inputs.apiModel ? UI.inputs.apiModel.value.trim() : '';
                const temp = UI.inputs.apiTemp ? parseFloat(UI.inputs.apiTemp.value) || 0.7 : 0.7;
                const presetName = UI.inputs.presetName ? UI.inputs.presetName.value.trim() : '';

                apiPresets.push({
                    id: Date.now(),
                    name: presetName || '未命名预设',
                    endpoint,
                    apiKey,
                    model,
                    temp
                });

                saveGlobalData();
                syncAssistiveBallPanel();
                closeView(UI.overlays.savePreset);
                showToast('预设已保存');
            });
        }

        if (loadPresetBtn && UI.overlays.loadPreset) {
            loadPresetBtn.addEventListener('click', () => {
                openView(UI.overlays.loadPreset);
                setTimeout(() => {
                    renderPresetList();
                }, 150);
            });
        }

        function renderPresetList() {
            if (!UI.lists.presets) return;
            UI.lists.presets.innerHTML = '';

            if (!Array.isArray(apiPresets) || apiPresets.length === 0) {
                UI.lists.presets.innerHTML = `
                    <div style="padding: 40px 20px; text-align: center; color: #8e8e93; font-size: 15px;">
                        暂无预设
                    </div>
                `;
                return;
            }

            const fragment = document.createDocumentFragment();

            apiPresets.forEach(preset => {
                const item = document.createElement('div');
                item.className = 'account-card';
                item.innerHTML = `
                    <div class="account-content" style="cursor: pointer;">
                        <div class="account-avatar" style="background-color: var(--blue-color); color: white;"><i class="fas fa-server"></i></div>
                        <div class="account-info">
                            <div class="account-name">${preset.name || '未命名预设'}</div>
                            <div class="account-detail" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;">${preset.endpoint || '未填写接口地址'}</div>
                        </div>
                        <i class="fas fa-times delete-icon"></i>
                    </div>
                `;

                const content = item.querySelector('.account-content');
                const deleteIcon = item.querySelector('.delete-icon');

                if (content) {
                    content.addEventListener('click', (e) => {
                        if (e.target.classList.contains('delete-icon') || e.target.closest('.delete-icon')) return;

                        if (UI.inputs.apiEndpoint) UI.inputs.apiEndpoint.value = preset.endpoint || '';
                        if (UI.inputs.apiKey) UI.inputs.apiKey.value = preset.apiKey || '';
                        if (UI.inputs.apiModel) {
                            syncSelectValue(UI.inputs.apiModel, preset.model || '');
                            tempApiConfig.model = preset.model || '';
                        }
                        if (UI.inputs.apiTemp) UI.inputs.apiTemp.value = preset.temp ?? 0.7;

                        closeView(UI.overlays.loadPreset);
                        showToast('预设已加载');
                    });
                }

                if (deleteIcon) {
                    deleteIcon.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (confirm(`删除预设“${preset.name || '未命名预设'}”？`)) {
                            apiPresets = apiPresets.filter(p => p.id !== preset.id);
                            saveGlobalData();
                            renderPresetList();
                            syncAssistiveBallPanel();
                            showToast('预设已删除');
                        }
                    });
                }

                fragment.appendChild(item);
            });

            UI.lists.presets.appendChild(fragment);
        }

        // ==========================================
        // Data Management Logic
        // ==========================================
        const exportDataBtn = document.getElementById('export-data-btn');
        const importDataBtn = document.getElementById('import-data-btn');
        const importDataFile = document.getElementById('import-data-file');
        const clearDataBtn = document.getElementById('clear-data-btn');

        // Data Management v4
        (function initDataManagementV4() {
            const importPreview = document.getElementById('data-import-preview');
            const importFileName = document.getElementById('data-import-file-name');
            const importVersion = document.getElementById('data-import-version');
            const importRecords = document.getElementById('data-import-records');
            const importAssets = document.getElementById('data-import-assets');
            const importSize = document.getElementById('data-import-size');
            let selectedImportPayload = null;
            let selectedImportFile = null;
            let overlay = null;
            let overlayText = null;
            let overlayProgress = null;

            function stopLegacy(e) {
                e.preventDefault();
                e.stopImmediatePropagation();
            }

            function setBusy(btn, busy) {
                if (!btn) return;
                btn.disabled = !!busy;
                btn.classList.toggle('is-busy', !!busy);
            }

            function readFileText(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => resolve(event.target.result || '');
                    reader.onerror = () => reject(reader.error || new Error('File read failed'));
                    reader.readAsText(file);
                });
            }

            function formatBytesForUi(bytes) {
                if (window.appStorage && typeof window.appStorage.formatBytes === 'function') {
                    return window.appStorage.formatBytes(bytes);
                }
                const size = Math.max(0, Number(bytes) || 0);
                return size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`;
            }

            function formatDateForUi(timestamp) {
                const value = Number(timestamp) || 0;
                if (!value) return '未知时间';
                try {
                    return new Date(value).toLocaleString();
                } catch (error) {
                    return '未知时间';
                }
            }

            function showOperation(text) {
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.className = 'data-operation-overlay';
                    overlay.innerHTML = `
                        <div class="data-operation-card">
                            <i class="fas fa-spinner fa-spin data-operation-spinner"></i>
                            <div class="data-operation-text"></div>
                            <div class="data-operation-progress"><div></div></div>
                        </div>
                    `;
                    overlayText = overlay.querySelector('.data-operation-text');
                    overlayProgress = overlay.querySelector('.data-operation-progress > div');
                    document.body.appendChild(overlay);
                }
                overlayText.textContent = text || '处理中...';
                overlayProgress.style.width = '0%';
                overlay.style.display = 'flex';
            }

            function updateOperation(progressData = {}) {
                if (overlayText) overlayText.textContent = progressData.message || '处理中...';
                if (overlayProgress) {
                    const progress = Math.max(0, Math.min(100, Number(progressData.progress) || 0));
                    overlayProgress.style.width = `${progress}%`;
                }
            }

            function hideOperation() {
                if (overlay) overlay.style.display = 'none';
            }

            function updatePreview(file, summary) {
                if (!importPreview) return;
                importPreview.style.display = 'block';
                if (importFileName) importFileName.textContent = file?.name || '未命名备份';
                if (importVersion) importVersion.textContent = `v${summary.schemaVersion || '-'}`;
                if (importRecords) importRecords.textContent = String(summary.recordCount || 0);
                if (importAssets) importAssets.textContent = String(summary.assetCount || 0);
                if (importSize) importSize.textContent = formatBytesForUi(summary.approximateBytes || file?.size || 0);
            }

            function resetPreview() {
                selectedImportPayload = null;
                selectedImportFile = null;
                if (importPreview) importPreview.style.display = 'none';
            }

            if (exportDataBtn) {
                exportDataBtn.addEventListener('click', async (e) => {
                    stopLegacy(e);
                    try {
                        setBusy(exportDataBtn, true);
                        showOperation('正在准备导出数据...');
                        const blob = await window.appStorage.exportAllData(updateOperation);
                        updateOperation({ message: '准备下载...', progress: 99 });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `u2phone_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(url), 5000);
                        hideOperation();
                        showToast('数据导出成功');
                    } catch (err) {
                        console.error('Export failed:', err);
                        hideOperation();
                        showToast('导出失败，请查看控制台');
                    } finally {
                        setBusy(exportDataBtn, false);
                    }
                }, true);
            }

            if (importDataBtn && importDataFile) {
                importDataBtn.addEventListener('click', (e) => {
                    stopLegacy(e);
                    if (!selectedImportPayload || !selectedImportFile) {
                        importDataFile.click();
                        return;
                    }

                    if (!confirm(`将用「${selectedImportFile.name}」完整替换当前手机里的应用数据和配置。此操作不可撤销，确定继续？`)) {
                        return;
                    }

                    (async () => {
                        try {
                            setBusy(importDataBtn, true);
                            showOperation('正在导入备份...');
                            await window.appStorage.importAllData(selectedImportPayload, updateOperation);
                            updateOperation({ message: '导入成功，正在重启...', progress: 100 });
                            setTimeout(() => window.location.reload(), 1200);
                        } catch (err) {
                            console.error('Import failed:', err);
                            hideOperation();
                            showToast('导入失败，备份文件可能已损坏');
                            setBusy(importDataBtn, false);
                        }
                    })();
                }, true);

                importDataFile.addEventListener('change', async (e) => {
                    e.stopImmediatePropagation();
                    const file = e.target.files[0];
                    if (!file) return;

                    try {
                        setBusy(importDataBtn, true);
                        showOperation('正在读取备份文件...');
                        const text = await readFileText(file);
                        updateOperation({ message: '正在校验备份...', progress: 30 });
                        const payload = JSON.parse(text);
                        const summary = window.appStorage.inspectBackupPayload(payload);
                        selectedImportPayload = payload;
                        selectedImportFile = file;
                        updatePreview(file, summary);
                        hideOperation();
                        showToast('备份已校验，请再次点击导入');
                    } catch (err) {
                        console.error('Import preview failed:', err);
                        resetPreview();
                        hideOperation();
                        showToast('文件格式错误或备份已损坏');
                    } finally {
                        setBusy(importDataBtn, false);
                        e.target.value = '';
                    }
                }, true);
            }

            if (clearDataBtn) {
                clearDataBtn.addEventListener('click', async (e) => {
                    stopLegacy(e);
                    if (!confirm('确定清空所有应用数据和配置吗？此操作不可恢复，系统将重启到默认状态。')) return;
                    try {
                        setBusy(clearDataBtn, true);
                        showOperation('正在清空应用数据...');
                        await window.appStorage.clearAllPersistentData();
                        updateOperation({ message: '已清空，正在重启...', progress: 100 });
                        setTimeout(() => window.location.reload(), 1200);
                    } catch (err) {
                        console.error('Clear data failed:', err);
                        hideOperation();
                        showToast('清空数据失败');
                        setBusy(clearDataBtn, false);
                    }
                }, true);
            }
        })();
    });

})();
