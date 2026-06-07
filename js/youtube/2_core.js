// 1. YouTube State, Data & Discovery Content
    let mockVideos = []; // Global video list
    let currentChatHistory = []; // Store chat history for summary
    
    // Initial empty mock subscription list
    let mockSubscriptions = []; 
    let hasSubscriptions = false;

    // Channel Data State
    let ytUserState = null; // Internal state for YouTube app
    let currentSummaryFilter = '全部';

    function sanitizeObj(obj) {
        if (typeof obj === 'string') {
            let str = obj.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
            str = str.replace(/[.。]+$/g, '');
            return str.trim();
        } else if (Array.isArray(obj)) {
            return obj.map(item => sanitizeObj(item));
        } else if (obj !== null && typeof obj === 'object') {
            const newObj = {};
            for (let key in obj) {
                newObj[key] = sanitizeObj(obj[key]);
            }
            return newObj;
        }
        return obj;
    }

    function createDefaultYtChannelState() {
        return {
            bannerUrl: null,
            url: '',
            boundWorldBookIds: [],
            systemPrompt: '',
            summaryPrompt: '',
            groupChatPrompt: '',
            vodPrompt: '',
            postPrompt: '',
            liveSummaryPrompt: '',
            liveSummaries: [],
            groupChatHistory: [],
            cachedTrendingLive: null,
            cachedTrendingSub: null,
            activeUserLive: null,
            pastVideos: []
        };
    }

    function createDefaultYoutubeState() {
        return {
            channelState: createDefaultYtChannelState(),
            subscriptions: [],
            userState: null
        };
    }

    function normalizeYoutubeState(rawState) {
        const safeState = rawState && typeof rawState === 'object' ? rawState : {};
        return {
            channelState: normalizeYtChannelState(safeState.channelState),
            subscriptions: normalizeYtSubscriptions(safeState.subscriptions),
            userState: safeState.userState ? normalizeYtUserState(safeState.userState) : null
        };
    }

    let channelState = createDefaultYtChannelState();

    function compressImage(dataUrl, maxWidth, maxHeight, callback) {
        const img = new Image();
        img.onload = function() {
            let width = img.width;
            let height = img.height;
            let shouldCompress = false;
            
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
                shouldCompress = true;
            }
            if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
                shouldCompress = true;
            }

            if (!shouldCompress) {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, img.width, img.height);
                callback(canvas.toDataURL('image/jpeg', 0.8));
                return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            callback(compressedDataUrl);
        };
        img.src = dataUrl;
    }
    window.compressImage = window.compressImage || compressImage;

    function parseSubs(str) {
        if (!str) return 0;
        let s = String(str).replace(/,/g, '').trim();
        let multi = 1;
        if (s.includes('亿')) { multi = 100000000; s = s.replace('亿', ''); }
        else if (s.includes('万')) { multi = 10000; s = s.replace('万', ''); }
        else if (s.toUpperCase().includes('K')) { multi = 1000; s = s.toUpperCase().replace('K', ''); }
        else if (s.toUpperCase().includes('M')) { multi = 1000000; s = s.toUpperCase().replace('M', ''); }
        let num = parseFloat(s);
        if (isNaN(num)) return 0;
        return Math.floor(num * multi);
    }

    function formatSubs(num) {
        if (num >= 100000000) {
            return (num / 100000000).toFixed(1).replace(/\.0$/, '') + '亿';
        } else if (num >= 10000) {
            return (num / 10000).toFixed(1).replace(/\.0$/, '') + '万';
        } else {
            return num.toString();
        }
    }

    function getPreferredAppleIdUser() {
        const accounts = typeof window.getAccounts === 'function' ? window.getAccounts() : [];
        const currentAccountId = typeof window.getCurrentAccountId === 'function' ? window.getCurrentAccountId() : null;
        const currentAccount = accounts.find(acc => String(acc.id) === String(currentAccountId)) || null;
        const runtimeUser = window.userState || {};

        if (currentAccount) {
            const resolvedName = currentAccount.name || runtimeUser.name || runtimeUser.realName || 'User';
            return {
                name: resolvedName,
                handle: currentAccount.handle || runtimeUser.handle || (resolvedName ? resolvedName.toLowerCase().replace(/\s+/g, '') : 'user'),
                avatarUrl: currentAccount.avatarUrl || runtimeUser.avatarUrl || runtimeUser.avatar || '',
                persona: currentAccount.persona || currentAccount.signature || runtimeUser.persona || '',
                subs: runtimeUser.subs || '0',
                videos: runtimeUser.videos || '0'
            };
        }

        return {
            name: runtimeUser.name || runtimeUser.realName || 'User',
            handle: runtimeUser.handle || (runtimeUser.name ? runtimeUser.name.toLowerCase().replace(/\s+/g, '') : 'user'),
            avatarUrl: runtimeUser.avatarUrl || runtimeUser.avatar || '',
            persona: runtimeUser.persona || '',
            subs: runtimeUser.subs || '0',
            videos: runtimeUser.videos || '0'
        };
    }

    function createYtUserStateFromAppleId() {
        const appleUser = getPreferredAppleIdUser();
        return {
            name: appleUser.name || 'User',
            handle: appleUser.handle || (appleUser.name ? appleUser.name.toLowerCase().replace(/\s+/g, '') : 'user'),
            avatarUrl: appleUser.avatarUrl || '',
            persona: appleUser.persona || '',
            subs: appleUser.subs || '0',
            videos: appleUser.videos || '0'
        };
    }

    function normalizeYtUserState(rawUser) {
        const fallbackUser = createYtUserStateFromAppleId();
        const safeUser = rawUser && typeof rawUser === 'object' ? rawUser : {};
        const resolvedName = safeUser.name || safeUser.realName || fallbackUser.name || 'User';

        return {
            name: resolvedName,
            handle: (safeUser.handle || (resolvedName ? resolvedName.toLowerCase().replace(/\s+/g, '') : fallbackUser.handle || 'user')).replace(/^@/, ''),
            avatarUrl: safeUser.avatarUrl || safeUser.avatar || fallbackUser.avatarUrl || '',
            persona: safeUser.persona || fallbackUser.persona || '',
            subs: safeUser.subs || fallbackUser.subs || '0',
            videos: safeUser.videos || fallbackUser.videos || '0'
        };
    }

    function normalizeYtChannelState(rawState) {
        const defaults = createDefaultYtChannelState();
        const safeState = rawState && typeof rawState === 'object' ? rawState : {};

        return {
            ...defaults,
            ...safeState,
            boundWorldBookIds: Array.isArray(safeState.boundWorldBookIds) ? safeState.boundWorldBookIds.filter(Boolean) : [],
            liveSummaries: Array.isArray(safeState.liveSummaries) ? safeState.liveSummaries.filter(item => item && typeof item === 'object') : [],
            groupChatHistory: Array.isArray(safeState.groupChatHistory) ? safeState.groupChatHistory.filter(item => item && typeof item === 'object') : [],
            activeUserLive: safeState.activeUserLive && typeof safeState.activeUserLive === 'object' ? safeState.activeUserLive : null,
            pastVideos: Array.isArray(safeState.pastVideos) ? safeState.pastVideos.filter(video => video && typeof video === 'object') : []
        };
    }

    function getYtImChars() {
        const friends = typeof window.getImFriends === 'function'
            ? window.getImFriends()
            : (window.imData && Array.isArray(window.imData.friends) ? window.imData.friends : []);
        return (Array.isArray(friends) ? friends : []).filter(friend => friend && friend.type === 'char');
    }

    function normalizeYtLookupText(value) {
        return String(value || '').trim().toLowerCase();
    }

    function resolveYtLinkedImChar(channel) {
        if (!channel || typeof channel !== 'object') return null;
        const chars = getYtImChars();
        if (chars.length === 0) return null;

        if (channel.imCharId !== undefined && channel.imCharId !== null && channel.imCharId !== '') {
            const byId = chars.find(friend => String(friend.id) === String(channel.imCharId));
            if (byId) return byId;
        }

        const channelNames = [
            channel.name,
            channel.nickname,
            channel.realName,
            channel.handle
        ].map(normalizeYtLookupText).filter(Boolean);

        return chars.find(friend => {
            const friendNames = [
                friend.nickname,
                friend.realName,
                friend.name
            ].map(normalizeYtLookupText).filter(Boolean);
            return friendNames.some(name => channelNames.includes(name));
        }) || null;
    }

    function resolveYtExplicitImChar(channel) {
        if (!channel || typeof channel !== 'object') return null;
        if (channel.imCharId === undefined || channel.imCharId === null || channel.imCharId === '') return null;
        return getYtImChars().find(friend => String(friend.id) === String(channel.imCharId)) || null;
    }

    function getYtChannelRelationshipContext(channel) {
        const linkedChar = resolveYtExplicitImChar(channel);
        if (!linkedChar) return '';

        const normalizedChar = window.imApp && typeof window.imApp.normalizeFriendData === 'function'
            ? window.imApp.normalizeFriendData(linkedChar)
            : linkedChar;
        const relationships = Array.isArray(normalizedChar?.memory?.relationships)
            ? normalizedChar.memory.relationships
            : [];
        if (relationships.length === 0) return '';

        const allFriends = Array.isArray(window.imData?.friends) ? window.imData.friends : [];
        const lines = relationships
            .map(rel => {
                const target = allFriends.find(item => String(item.id) === String(rel.npcId));
                const targetName = target?.nickname || target?.realName || target?.name || '未知角色';
                const relation = String(rel.relation || '').trim();
                return relation ? `- ${targetName}：${relation}` : '';
            })
            .filter(Boolean);

        return lines.length > 0 ? `iMessage 关系网：\n${lines.join('\n')}` : '';
    }

    function getYtChannelPersonaWithRelationships(channel, fallbackPersona = '未知') {
        const basePersona = String(
            channel?.desc || channel?.persona || fallbackPersona || '未知'
        ).trim() || '未知';
        const relationshipContext = getYtChannelRelationshipContext(channel);
        return relationshipContext ? `${basePersona}\n${relationshipContext}` : basePersona;
    }

    function resolveYtChannelAvatar(channel) {
        const linkedChar = resolveYtLinkedImChar(channel);
        return (linkedChar && linkedChar.avatarUrl)
            || (channel && (channel.avatar || channel.avatarUrl))
            || 'https://picsum.photos/80/80?grayscale';
    }

    window.resolveYtLinkedImChar = resolveYtLinkedImChar;
    window.resolveYtExplicitImChar = resolveYtExplicitImChar;
    window.getYtChannelRelationshipContext = getYtChannelRelationshipContext;
    window.getYtChannelPersonaWithRelationships = getYtChannelPersonaWithRelationships;
    window.resolveYtChannelAvatar = resolveYtChannelAvatar;

    function normalizeYtSubscription(sub, index = 0) {
        if (!sub || typeof sub !== 'object') return null;

        const resolvedName = String(sub.name || sub.nickname || '').trim();
        if (!resolvedName) return null;

        const resolvedHandle = String(sub.handle || resolvedName.toLowerCase().replace(/\s+/g, '')).replace(/^@/, '') || `channel${index + 1}`;
        const resolvedId = sub.id || `yt_sub_${resolvedHandle}_${index}`;

        return {
            ...sub,
            id: resolvedId,
            name: resolvedName,
            handle: resolvedHandle,
            imCharId: sub.imCharId || sub.imId || sub.friendId || null,
            avatar: sub.avatar || sub.avatarUrl || `https://picsum.photos/seed/${encodeURIComponent(resolvedId)}/80/80?grayscale`,
            banner: sub.banner || null,
            desc: sub.desc || '',
            subs: sub.subs || '',
            videos: sub.videos || '',
            isLive: !!sub.isLive,
            generatedContent: sub.generatedContent || null,
            groupChatHistory: Array.isArray(sub.groupChatHistory) ? sub.groupChatHistory : [],
            isFriend: !!sub.isFriend,
            isBusiness: !!sub.isBusiness,
            isSubscribed: sub.isSubscribed !== false,
            dmHistory: Array.isArray(sub.dmHistory) ? sub.dmHistory.filter(item => item && typeof item === 'object') : []
        };
    }

    function normalizeYtSubscriptions(rawSubscriptions) {
        if (!Array.isArray(rawSubscriptions)) return [];

        return rawSubscriptions
            .map((sub, index) => normalizeYtSubscription(sub, index))
            .filter(Boolean);
    }

    function createStableYtChannelId(value, prefix = 'yt_channel') {
        const source = String(value || prefix)
            .trim()
            .toLowerCase()
            .replace(/^@/, '')
            .replace(/\s+/g, '-')
            .replace(/[^\w\u4e00-\u9fa5.-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || prefix;
        return `${prefix}_${source}`;
    }

    function buildYtChannelFromTrendingItem(item, type = 'trend', index = 0) {
        const safeItem = item && typeof item === 'object' ? item : {};
        const resolvedName = String(safeItem.name || safeItem.nickname || `频道${index + 1}`).trim();
        const resolvedHandle = String(safeItem.handle || resolvedName || `channel${index + 1}`)
            .replace(/^@/, '')
            .replace(/\s+/g, '')
            .trim() || `channel${index + 1}`;
        const stableId = safeItem.id || createStableYtChannelId(`${type}_${resolvedHandle}`, 'char_trend');
        const avatarSeed = encodeURIComponent(resolvedHandle || stableId);

        return normalizeYtSubscription({
            id: stableId,
            name: resolvedName,
            handle: resolvedHandle,
            avatar: safeItem.avatar || safeItem.avatarUrl || `https://picsum.photos/seed/${avatarSeed}/80/80`,
            banner: safeItem.banner || null,
            isLive: !!safeItem.isLive,
            desc: safeItem.desc || safeItem.persona || '',
            subs: safeItem.subs || '0',
            videos: safeItem.videos || '10',
            isFriend: !!safeItem.isFriend,
            isBusiness: !!safeItem.isBusiness,
            isSubscribed: safeItem.isSubscribed === true,
            generatedContent: safeItem.generatedContent || null,
            groupChatHistory: Array.isArray(safeItem.groupChatHistory) ? safeItem.groupChatHistory : [],
            dmHistory: Array.isArray(safeItem.dmHistory) ? safeItem.dmHistory : []
        }, index);
    }

    function mergeYtChannelIntoSubscriptions(channel, options = {}) {
        if (!channel || typeof channel !== 'object') return null;
        const { save = true, preferExistingSubscription = true } = options;
        const normalized = normalizeYtSubscription(channel, mockSubscriptions.length) || buildYtChannelFromTrendingItem(channel, 'manual', mockSubscriptions.length);
        if (!normalized) return null;

        const lookupHandle = normalizeYtLookupText(normalized.handle);
        const existingIndex = mockSubscriptions.findIndex(sub => {
            if (!sub) return false;
            if (String(sub.id) === String(normalized.id)) return true;
            return lookupHandle && normalizeYtLookupText(sub.handle) === lookupHandle;
        });

        if (existingIndex > -1) {
            const existing = mockSubscriptions[existingIndex];
            const merged = normalizeYtSubscription({
                ...existing,
                ...normalized,
                id: existing.id || normalized.id,
                isSubscribed: preferExistingSubscription ? (existing.isSubscribed !== false) : normalized.isSubscribed,
                generatedContent: normalized.generatedContent || existing.generatedContent || null,
                groupChatHistory: Array.isArray(normalized.groupChatHistory) && normalized.groupChatHistory.length > 0 ? normalized.groupChatHistory : (existing.groupChatHistory || []),
                dmHistory: Array.isArray(normalized.dmHistory) && normalized.dmHistory.length > 0 ? normalized.dmHistory : (existing.dmHistory || [])
            }, existingIndex);
            mockSubscriptions[existingIndex] = merged;
            hasSubscriptions = mockSubscriptions.some(sub => sub && sub.isSubscribed !== false);
            if (save) saveYoutubeData();
            return mockSubscriptions[existingIndex];
        }

        mockSubscriptions.push(normalized);
        hasSubscriptions = mockSubscriptions.some(sub => sub && sub.isSubscribed !== false);
        if (save) saveYoutubeData();
        return mockSubscriptions[mockSubscriptions.length - 1];
    }

    function rebuildYoutubeMockVideos() {
        mockVideos = [];
        if (channelState.activeUserLive) {
            const activeLive = channelState.activeUserLive;
            const liveUser = activeLive.user || {};
            mockVideos.push({
                title: activeLive.title || '我的直播间',
                desc: activeLive.desc || '',
                views: activeLive.views || `${activeLive.totalViews || 0} 人正在观看`,
                time: 'LIVE',
                thumbnail: activeLive.thumbnail || activeLive.backgroundUrl || 'https://picsum.photos/320/180',
                isLive: true,
                comments: Array.isArray(activeLive.comments) ? activeLive.comments : [],
                initialBubbles: Array.isArray(activeLive.initialBubbles) ? activeLive.initialBubbles : [],
                guest: activeLive.guest || null,
                channelData: {
                    id: 'user_channel_id',
                    name: liveUser.name || '我',
                    avatar: liveUser.avatarUrl || liveUser.avatar || 'https://picsum.photos/80/80',
                    subs: liveUser.subs || '0'
                }
            });
        }
        mockSubscriptions.forEach(sub => {
            if (sub.generatedContent && sub.generatedContent.currentLive) {
                mockVideos.push({
                    title: sub.generatedContent.currentLive.title,
                    views: sub.generatedContent.currentLive.views,
                    time: 'LIVE',
                    thumbnail: sub.generatedContent.currentLive.thumbnail || 'https://picsum.photos/320/180?grayscale',
                    isLive: true,
                    comments: sub.generatedContent.currentLive.comments || [],
                    initialBubbles: sub.generatedContent.currentLive.initialBubbles || [],
                    guest: sub.generatedContent.currentLive.guest || null,
                    channelData: sub
                });
            }
        });
    }

    function ensureYtUserState() {
        if (!ytUserState || typeof ytUserState !== 'object') {
            ytUserState = createYtUserStateFromAppleId();
        } else {
            ytUserState = {
                ...createYtUserStateFromAppleId(),
                ...normalizeYtUserState(ytUserState)
            };
        }
        return ytUserState;
    }

    function getYtEffectiveUserState() {
        return ensureYtUserState();
    }

    function loadYoutubeData() {
        try {
            const snapshot = typeof window.getAppState === 'function'
                ? normalizeYoutubeState(window.getAppState('youtube'))
                : createDefaultYoutubeState();

            channelState = snapshot.channelState;
            mockSubscriptions = snapshot.subscriptions;
            hasSubscriptions = mockSubscriptions.length > 0;
            rebuildYoutubeMockVideos();

            ytUserState = snapshot.userState;
        } catch (e) {
            console.error("Error loading YouTube data", e);
            channelState = createDefaultYtChannelState();
            mockSubscriptions = [];
            hasSubscriptions = false;
            mockVideos = [];
            ytUserState = null;
        }
    }

    function saveYoutubeData(options = {}) {
        try {
            const { skipUserState = false } = options || {};

            channelState = normalizeYtChannelState(channelState);
            mockSubscriptions = normalizeYtSubscriptions(mockSubscriptions);
            hasSubscriptions = mockSubscriptions.some(sub => sub && sub.isSubscribed !== false);

            if (typeof currentSubChannelData !== 'undefined' && currentSubChannelData && currentSubChannelData.id) {
                const syncedCurrentSub = mockSubscriptions.find(sub => String(sub.id) === String(currentSubChannelData.id));
                if (syncedCurrentSub) currentSubChannelData = syncedCurrentSub;
            }

            ytUserState = ytUserState ? normalizeYtUserState(ytUserState) : null;

            const nextState = normalizeYoutubeState({
                channelState,
                subscriptions: mockSubscriptions,
                userState: skipUserState || !ytUserState ? null : ytUserState
            });

            if (skipUserState || !ytUserState) {
                ytUserState = null;
            }

            rebuildYoutubeMockVideos();

            if (typeof window.setAppState === 'function') {
                window.setAppState('youtube', nextState);
            } else if (window.appState && typeof window.appStorage !== 'undefined') {
                window.appState.youtube = nextState;
                if (typeof window.appStorage.saveGlobalData === 'function') {
                    window.appStorage.saveGlobalData(window.appState);
                }
            } else {
                console.warn("YouTube data was not saved: setAppState is unavailable");
            }
        } catch (e) {
            console.error("Error saving YouTube data", e);
        }
    }

    loadYoutubeData();

    window.createYtUserStateFromAppleId = createYtUserStateFromAppleId;
    window.ensureYtUserState = ensureYtUserState;
    window.getYtEffectiveUserState = getYtEffectiveUserState;
    window.normalizeYtUserState = normalizeYtUserState;
    window.normalizeYtSubscriptions = normalizeYtSubscriptions;
    window.normalizeYtChannelState = normalizeYtChannelState;
    window.normalizeYoutubeState = normalizeYoutubeState;
    window.createStableYtChannelId = createStableYtChannelId;
    window.buildYtChannelFromTrendingItem = buildYtChannelFromTrendingItem;
    window.mergeYtChannelIntoSubscriptions = mergeYtChannelIntoSubscriptions;
    window.saveYoutubeData = saveYoutubeData;

    // 2. DOM Elements
    const ytView = document.getElementById('youtube-view');
    const subChannelView = document.getElementById('sub-channel-view');
    const dockIconYt = document.getElementById('dock-icon-youtube');
    const backBtn = document.getElementById('yt-back-btn');
    
    // Bottom Nav
    const navItems = document.querySelectorAll('.yt-nav-item');
    const navIndicator = document.getElementById('yt-nav-indicator');
    const tabContents = document.querySelectorAll('.yt-tab-content');

    // Home Tab Elements
    const subsList = document.getElementById('yt-subs-list');
    const liveSection = document.getElementById('yt-live-section');
    const emptyState = document.getElementById('yt-empty-state');
    const filterBubbles = document.querySelectorAll('.yt-filter-bubble');

    // Profile Tab Elements
    const profileName = document.getElementById('yt-profile-name');
    const profileHandle = document.getElementById('yt-profile-handle');
    const profileAvatarImg = document.getElementById('yt-profile-avatar-img');
    const profileAvatarIcon = document.querySelector('.yt-profile-avatar i');
    const profileHeaderBg = document.querySelector('.yt-profile-header-bg');
    const profileSubs = document.getElementById('yt-profile-subs');
    const profileVideos = document.getElementById('yt-profile-videos');
    const profileTabIndicator = document.getElementById('profile-tab-indicator');
    
    // Edit Channel Elements
    const editChannelBtn = document.getElementById('yt-edit-channel-btn');
    const editChannelSheet = document.getElementById('yt-edit-channel-sheet');
    const confirmEditBtn = document.getElementById('confirm-yt-edit-btn');

    // Edit Inputs
    const editNameInput = document.getElementById('yt-edit-name-input');
    const editHandleInput = document.getElementById('yt-edit-handle-input');
    const editUrlInput = document.getElementById('yt-edit-url-input');
    const editSubsInput = document.getElementById('yt-edit-subs-input');
    const editVideosInput = document.getElementById('yt-edit-videos-input');
    const editPersonaInput = document.getElementById('yt-edit-persona-input');
    const editDescInput = document.getElementById('yt-edit-desc-input');
    
    // Edit Uploads
    const editBannerBtn = document.getElementById('yt-edit-banner-btn');
    const bannerUpload = document.getElementById('yt-banner-upload');
    const editBannerImg = document.getElementById('yt-edit-banner-img');
    
    const editAvatarWrapper = document.getElementById('yt-edit-avatar-wrapper');
    const avatarUpload = document.getElementById('yt-avatar-upload');
    const editAvatarImg = document.getElementById('yt-edit-avatar-img');
    const editAvatarIcon = document.querySelector('#yt-edit-avatar-preview i');

    // 3. App Launch & Close Logic
    if (dockIconYt && ytView) {
        dockIconYt.addEventListener('click', (e) => {
            if (window.isJiggleMode || window.preventAppClick) { e.preventDefault(); e.stopPropagation(); return; }
            if (typeof window.ensureYtUserState === 'function') {
                ytUserState = window.ensureYtUserState();
            } else if (!ytUserState) {
                ytUserState = {};
            }
            syncYtProfile();
            if (window.openView) window.openView(ytView);
            else ytView.classList.add('active');
            renderSubscriptions();
            renderVideos();
        });
    }

    if (backBtn && ytView) {
        backBtn.addEventListener('click', () => {
            if (window.closeView) window.closeView(ytView);
            else ytView.classList.remove('active');
        });
    }

    // 4. Bottom Nav Interaction
    
    // --- Messages Tab Logic ---
    const msgFilterDm = document.getElementById('msg-filter-dm');
    const msgFilterCommunity = document.getElementById('msg-filter-community');
    const msgFilterBusiness = document.getElementById('msg-filter-business');
    const msgListContainer = document.getElementById('yt-messages-list');
    const msgRefreshBtn = document.getElementById('yt-messages-refresh-btn');
    let currentMsgFilter = 'dm';

    if (msgRefreshBtn) {
        msgRefreshBtn.addEventListener('click', async () => {
            if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
                if(window.showToast) window.showToast('请先配置 API');
                renderMessagesList();
                return;
            }
            
            if (currentMsgFilter === 'community') {
                if(window.showToast) window.showToast('社群不支持魔法棒生成');
                return;
            }

            msgRefreshBtn.style.opacity = '0.5';
            msgRefreshBtn.style.pointerEvents = 'none';
            if(window.showToast) window.showToast('正在生成新消息...');

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

            const effectiveYtUser = typeof window.getYtEffectiveUserState === 'function'
                ? window.getYtEffectiveUserState()
                : (ytUserState || {});
            const userPersona = effectiveYtUser.persona || '普通用户';
            
            const filterTypeAtRequest = currentMsgFilter;
            let prompt = '';
            if (filterTypeAtRequest === 'business') {
                prompt = `仔细阅读我的用户人设，根据我的用户人设生成3-5个**为你量身定制**的商务合作/赞助/联动邀请。
要求发件人是不同的品牌方、赞助商或希望联动的博主。合作内容必须与我的人设息息相关！
绝对不要使用任何 Emoji 表情符号，句子末尾不要使用句号。
我的用户人设："${userPersona}"。
世界观背景：${wbContext}
返回严格的JSON格式：
{
  "users": [
    {
      "name": "发件人名字(必须纯品牌名或频道名，绝对禁止在名字中添加'PR'、'经理'、'负责人'、'官方'等任何后缀！)",
      "avatarDesc": "英文单词描述头像(如: business logo)",
      "messages": [
        { "type": "text", "content": "你好！我们是某某品牌" },
        { "type": "text", "content": "看了你的内容非常感兴趣" },
        { "type": "offer", "offerData": { 
            "title": "游戏试玩推广", 
            "offerType": "填入枚举值: video(定制视频) 或 live(工商直播) 或 post(图文宣发) 或 collab(博主联动)",
            "requirement": "详细说明植入要求或直播要求，必须明确！", 
            "price": "$5000",
            "rmbAmount": 35000,
            "penalty": "$2000",
            "rmbPenalty": 14000
          } 
        }
      ]
    }
  ]
}
注意：每个发件人的 messages 数组中，除了前面的文字寒暄，最后一条必须是 type 为 "offer" 的商单卡片。
offerData.price 用于展示，offerData.rmbAmount 是纯数字，代表换算成人民币的金额。只能返回纯JSON。`;
            } else if (filterTypeAtRequest === 'dm') {
                prompt = `仔细阅读我的用户人设，生成3-5个不同的陌生人、同行或粉丝给你发私信的数据。
私信内容必须**强烈受我的人设影响**！他们可能是被你的人设吸引，也可能是针对你人设的某些特征来找你搭话。
绝对不要使用任何 Emoji 表情符号，句子末尾不要使用句号，语气要像真实的活人聊天。
我的用户人设："${userPersona}"。
世界观背景：${wbContext}
返回严格的JSON格式：
{
  "users": [
    {
      "name": "陌生人/同行/粉丝名字",
      "avatarDesc": "英文单词描述头像",
      "messages": [
        { "type": "text", "content": "第一条消息内容" },
        { "type": "text", "content": "第二条消息内容" }
      ]
    }
  ]
}
注意：只能返回纯JSON。`;
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
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.9,
                        response_format: { type: "json_object" } 
                    })
                });

                if (!res.ok) throw new Error("API failed");
                const data = await res.json();
                let resultText = data.choices[0].message.content;
                let jsonMatch = resultText.match(/\{[\s\S]*\}/);
                resultText = jsonMatch ? jsonMatch[0] : resultText;
                const parsed = sanitizeObj(JSON.parse(resultText));

                if (parsed.users && Array.isArray(parsed.users)) {
                    const isBusiness = filterTypeAtRequest === 'business';
                    parsed.users.forEach(u => {
                        const newSub = {
                            id: 'gen_user_' + Date.now() + Math.floor(Math.random()*10000),
                            name: u.name,
                            handle: u.name.toLowerCase().replace(/\s+/g, ''),
                            avatar: `https://picsum.photos/seed/${u.avatarDesc ? u.avatarDesc.replace(/\s+/g, '') : Date.now()}/80/80?grayscale`,
                            isBusiness: isBusiness,
                            isFriend: false, // 默认都是陌生人，需要手动添加好友
                            isSubscribed: false, // 默认未订阅
                            dmHistory: u.messages.map(m => {
                                if (m.type === 'offer') {
                                    return {
                                        type: 'char',
                                        name: u.name,
                                        isOffer: true,
                                        offerData: m.offerData || { title: '合作邀请', offerType: 'video', requirement: '详谈', price: '￥5000', penalty: '￥2000' },
                                        offerStatus: 'pending' // pending, accepted, rejected, completed, failed
                                    };
                                } else {
                                    return {
                                        type: 'char',
                                        name: u.name,
                                        text: m.content || m.text || (typeof m === 'string' ? m : "你好")
                                    };
                                }
                            })
                        };
                        mockSubscriptions.unshift(newSub);
                    });
                    saveYoutubeData();
                    renderMessagesList();
                    if(window.showToast) window.showToast(`收到 ${parsed.users.length} 位新联系人的消息`);
                }

            } catch (e) {
                console.error("Generate MSG Error: ", e);
                if(window.showToast) window.showToast('无法生成新消息，请重试');
            } finally {
                msgRefreshBtn.style.opacity = '1';
                msgRefreshBtn.style.pointerEvents = 'auto';
            }
        });
    }

    if (msgFilterDm && msgFilterCommunity && msgFilterBusiness) {
        msgFilterDm.addEventListener('click', () => {
            msgFilterDm.classList.add('active');
            msgFilterCommunity.classList.remove('active');
            msgFilterBusiness.classList.remove('active');
            currentMsgFilter = 'dm';
            renderMessagesList();
        });
        msgFilterCommunity.addEventListener('click', () => {
            msgFilterCommunity.classList.add('active');
            msgFilterDm.classList.remove('active');
            msgFilterBusiness.classList.remove('active');
            currentMsgFilter = 'community';
            renderMessagesList();
        });
        msgFilterBusiness.addEventListener('click', () => {
            msgFilterBusiness.classList.add('active');
            msgFilterCommunity.classList.remove('active');
            msgFilterDm.classList.remove('active');
            currentMsgFilter = 'business';
            renderMessagesList();
        });
    }

    function renderMessagesList() {
        if (!msgListContainer) return;
        msgListContainer.innerHTML = '';

        if (currentMsgFilter === 'business' || currentMsgFilter === 'dm') {
            const isBusiness = currentMsgFilter === 'business';
            const allTargetSubs = mockSubscriptions.filter(sub => sub.isBusiness === isBusiness && (sub.isFriend || (sub.dmHistory && sub.dmHistory.length > 0)));
            
            if (allTargetSubs.length === 0) {
                msgListContainer.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 100px; color: #8e8e93;">
                        <i class="fas ${isBusiness ? 'fa-envelope-open-text' : 'fa-comment-dots'}" style="font-size: 48px; margin-bottom: 16px; color: #d1d1d6;"></i>
                        <p style="font-size: 15px;">暂无${isBusiness ? '商务' : '私信'}消息</p>
                    </div>
                `;
                return;
            }

            const friends = allTargetSubs.filter(s => s.isFriend);
            const strangers = allTargetSubs.filter(s => !s.isFriend);

            const renderSubList = (subsArr, title) => {
                if (subsArr.length === 0) return '';
                const wrapper = document.createElement('div');
                wrapper.innerHTML = `<div style="font-size: 14px; font-weight: 600; color: #8e8e93; margin: 16px 4px 8px;">${title} (${subsArr.length})</div>`;
                
                const listWrapper = document.createElement('div');
                listWrapper.style.backgroundColor = '#ffffff';
                listWrapper.style.borderRadius = '16px';
                listWrapper.style.overflow = 'hidden';
                listWrapper.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';

                subsArr.forEach((sub, index) => {
                    const el = document.createElement('div');
                    const avatarUrl = resolveYtChannelAvatar(sub);
                    el.style.display = 'flex';
                    el.style.alignItems = 'center';
                    el.style.gap = '15px';
                    el.style.cursor = 'pointer';
                    el.style.padding = '16px';
                    el.style.backgroundColor = '#ffffff';
                    if (index < subsArr.length - 1) {
                        el.style.borderBottom = '1px solid #f2f2f2';
                    }
                    
                    const lastMsg = sub.dmHistory[sub.dmHistory.length - 1];
                    let lastMsgText = lastMsg.isOffer ? '[商单邀请]' : (lastMsg.text || '...');
                    let lastMsgTime = '刚刚';

                    const badgeHtml = sub.isBusiness ? `<span style="font-size:10px; background:#e8f5e9; color:#388e3c; padding:2px 4px; border-radius:4px; margin-left:4px;">商务</span>` : '';

                    el.innerHTML = `
                        <div style="width: 50px; height: 50px; border-radius: 50%; overflow: hidden; flex-shrink: 0; ">
                            <img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        <div style="flex: 1; overflow: hidden;">
                            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                                <div style="font-size: 16px; font-weight: 600; color: #0f0f0f; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${sub.name} ${badgeHtml}</div>
                                <div style="font-size: 12px; color: #8e8e93;">${lastMsgTime}</div>
                            </div>
                            <div style="font-size: 13px; color: #606060; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${lastMsgText}</div>
                        </div>
                    `;
                    
                    el.addEventListener('click', () => {
                        currentSubChannelData = sub;
                        openDMChat(sub);
                    });
                    
                    listWrapper.appendChild(el);
                });
                wrapper.appendChild(listWrapper);
                return wrapper;
            };

            if (friends.length > 0) {
                msgListContainer.appendChild(renderSubList(friends, '我的好友'));
            }
            if (strangers.length > 0) {
                msgListContainer.appendChild(renderSubList(strangers, '消息请求'));
            }
            return;
        }

        // Community Tab - Render joined fan groups
        let joinedGroups = [];
        mockSubscriptions.forEach(sub => {
            if (sub.generatedContent && sub.generatedContent.fanGroup && sub.generatedContent.fanGroup.isJoined) {
                joinedGroups.push({
                    subData: sub,
                    group: sub.generatedContent.fanGroup
                });
            }
        });

        if (joinedGroups.length === 0) {
            msgListContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 100px; color: #8e8e93;">
                    <i class="fas fa-users" style="font-size: 48px; margin-bottom: 16px; color: #d1d1d6;"></i>
                    <p style="font-size: 15px;">你还没有加入任何粉丝群</p>
                </div>
            `;
            return;
        }

        const listWrapper = document.createElement('div');
        listWrapper.style.backgroundColor = '#ffffff';
        listWrapper.style.borderRadius = '16px';
        listWrapper.style.overflow = 'hidden';
        listWrapper.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';

        joinedGroups.forEach((item, index) => {
            const el = document.createElement('div');
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.gap = '15px';
            el.style.cursor = 'pointer';
            el.style.padding = '16px';
            el.style.backgroundColor = '#ffffff';
            if (index < joinedGroups.length - 1) {
                el.style.borderBottom = '1px solid #f2f2f2';
            }
            
            let groupAvatarHtml = `
                <div style="width: 50px; height: 50px; border-radius: 50%; background: #f2f2f7; display: flex; justify-content: center; align-items: center; color: #8e8e93; flex-shrink: 0; ">
                    <i class="fas fa-users" style="font-size: 20px;"></i>
                </div>
            `;
            
            if (item.group.avatar) {
                groupAvatarHtml = `
                    <div style="width: 50px; height: 50px; border-radius: 50%; overflow: hidden; flex-shrink: 0;  background: transparent;">
                        <img src="${item.group.avatar}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                `;
            }
            
            let lastMsgText = '暂无群消息';
            if (item.subData.groupChatHistory && item.subData.groupChatHistory.length > 0) {
                const lastMsg = item.subData.groupChatHistory[item.subData.groupChatHistory.length - 1];
                lastMsgText = (lastMsg.name ? lastMsg.name + ': ' : '') + (lastMsg.text || '');
            }
            
            el.innerHTML = `
                ${groupAvatarHtml}
                <div style="flex: 1; overflow: hidden;">
                    <div style="font-size: 16px; font-weight: 600; color: #0f0f0f; margin-bottom: 4px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${item.group.name || '粉丝群'}</div>
                    <div style="font-size: 13px; color: #606060; display: flex; align-items: center; gap: 6px;">
                        <span style="white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${lastMsgText}</span>
                    </div>
                </div>
                <div style="color: #ccc;"><i class="fas fa-chevron-right"></i></div>
            `;
            
            el.addEventListener('click', () => {
                currentSubChannelData = item.subData; // Required for openFanGroupChat to know context
                openFanGroupChat(item.group);
            });
            
            listWrapper.appendChild(el);
        });
        msgListContainer.appendChild(listWrapper);
    }


    function updateNavIndicator(activeItem) {
        if (!activeItem || !navIndicator) return;
        const containerRect = activeItem.parentElement.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        const relativeLeft = itemRect.left - containerRect.left;
        navIndicator.style.width = `${itemRect.width}px`;
        navIndicator.style.left = `${relativeLeft}px`;
    }

    setTimeout(() => {
        const activeNav = document.querySelector('.yt-nav-item.active');
        if(activeNav) updateNavIndicator(activeNav);
    }, 100);

    const ytCreateSheet = document.getElementById('yt-create-sheet');
    const ytNavPlusBtn = document.getElementById('yt-nav-plus-btn');

    if(ytNavPlusBtn && ytCreateSheet) {
        ytNavPlusBtn.addEventListener('click', () => {
            ytCreateSheet.classList.add('active');
        });

        ytCreateSheet.addEventListener('mousedown', (e) => {
            if (e.target === ytCreateSheet) {
                ytCreateSheet.classList.remove('active');
            }
        });
        
        const createBtns = ytCreateSheet.querySelectorAll('.yt-create-bubble-btn');
        createBtns.forEach((btn, idx) => {
            btn.addEventListener('click', () => {
                ytCreateSheet.classList.remove('active');
                if (idx === 0) {
                    const userLiveSetupSheet = document.getElementById('yt-user-live-setup-sheet');
                    if (userLiveSetupSheet) userLiveSetupSheet.classList.add('active');
                } else if (idx === 2) {
                    const addYtCharSheet = document.getElementById('add-yt-char-sheet');
                    if (window.openCustomCharSheet) window.openCustomCharSheet(null);
                    else if (addYtCharSheet) addYtCharSheet.classList.add('active');
                }
            });
        });
    }

    navItems.forEach((item) => {
        item.addEventListener('click', () => {
            if(item.classList.contains('yt-nav-item-center')) return;

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            updateNavIndicator(item);

            const targetId = item.getAttribute('data-target');
            tabContents.forEach(tab => {
                if (tab.id === targetId) {
                    tab.classList.add('active');
                    // Add hook for rendering messages
                    if (targetId === 'yt-messages-tab') {
                        renderMessagesList();
                    }
                } else {
                    tab.classList.remove('active');
                }
            });
        });
    });
    
    window.addEventListener('resize', () => {
        const activeNav = document.querySelector('.yt-nav-item.active');
        if(activeNav) updateNavIndicator(activeNav);
    });

    // 5. Data Rendering Logic
    function renderSubscriptions() {
        if (!subsList) return;
        subsList.innerHTML = '';

        document.querySelector('.yt-subscriptions-wrapper').style.display = 'flex';

        if (!hasSubscriptions || mockSubscriptions.length === 0) {
            const el = document.createElement('div');
            el.className = `yt-sub-item`;
            el.innerHTML = `
                <div class="yt-sub-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <span class="yt-sub-name">暂无订阅</span>
            `;
            subsList.appendChild(el);
            return;
        }

        // Only render actually subscribed channels in the top bar
        const realSubscriptions = mockSubscriptions.filter(s => s.isSubscribed !== false);
        
        if (realSubscriptions.length === 0 && mockSubscriptions.length > 0) {
            const el = document.createElement('div');
            el.className = `yt-sub-item`;
            el.innerHTML = `
                <div class="yt-sub-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <span class="yt-sub-name">暂无订阅</span>
            `;
            subsList.appendChild(el);
        } else {
            realSubscriptions.forEach(sub => {
                const el = document.createElement('div');
                const avatarUrl = resolveYtChannelAvatar(sub);
                el.className = `yt-sub-item ${sub.isLive ? 'has-live' : ''}`;
                el.innerHTML = `
                    <div class="yt-sub-avatar">
                        <img src="${avatarUrl}" alt="${sub.name}">
                    </div>
                    <span class="yt-sub-name">${sub.name}</span>
                `;
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (sub.id === 'user_channel_id') {
                        const userProfileTab = document.querySelector('.yt-nav-item[data-target="yt-profile-tab"]');
                        if (userProfileTab) userProfileTab.click();
                    } else {
                        if(window.openSubChannelView) window.openSubChannelView(sub);
                    }
                });
                subsList.appendChild(el);
            });
        }

        const allBtn = document.querySelector('.yt-sub-all-btn');
        const allSubsSheet = document.getElementById('yt-all-subs-sheet');
        if(allBtn && allSubsSheet) {
            allBtn.onclick = () => {
                const list = document.getElementById('yt-all-subs-list');
                list.innerHTML = '';
                mockSubscriptions.forEach(sub => {
                    const item = document.createElement('div');
                    const avatarUrl = resolveYtChannelAvatar(sub);
                    item.className = 'account-card';
                    item.innerHTML = `
                        <div class="account-content" style="cursor:pointer;">
                            <div class="account-avatar"><img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>
                            <div class="account-info">
                                <div class="account-name">${sub.name}</div>
                                <div class="account-detail">${sub.subs || '0'} 订阅者</div>
                            </div>
                        </div>
                    `;
                    item.addEventListener('click', () => {
                        allSubsSheet.classList.remove('active');
                        openSubChannelView(sub);
                    });
                    list.appendChild(item);
                });
                allSubsSheet.classList.add('active');
            };
            
            allSubsSheet.addEventListener('mousedown', (e) => {
                if(e.target === allSubsSheet) allSubsSheet.classList.remove('active');
            });
        }
    }

    let currentFilter = '全部';

    filterBubbles.forEach(bubble => {
        bubble.addEventListener('click', () => {
            filterBubbles.forEach(b => b.classList.remove('active'));
            bubble.classList.add('active');
            currentFilter = bubble.textContent;
            renderVideos();
        });
    });

    function renderVideos() {
        if (!liveSection || !emptyState) return;
        liveSection.innerHTML = '';

        let filteredVideos = mockVideos;
        if (currentFilter === '正在直播') {
            filteredVideos = mockVideos.filter(v => v.isLive);
        }

        if (filteredVideos.length === 0) {
            liveSection.style.display = 'none';
            emptyState.style.display = 'flex';
            emptyState.querySelector('p').textContent = '暂无符合条件的视频';
            return;
        }

        liveSection.style.display = 'flex';
        emptyState.style.display = 'none';

        // Only show videos from subscribed channels
        const realFilteredVideos = filteredVideos.filter(v => v.channelData && v.channelData.isSubscribed !== false);
        
        if (realFilteredVideos.length === 0) {
            liveSection.style.display = 'none';
            emptyState.style.display = 'flex';
            emptyState.querySelector('p').textContent = '暂无符合条件的视频';
            return;
        }

        realFilteredVideos.forEach(video => {
            const channel = video.channelData;
            const avatarUrl = resolveYtChannelAvatar(channel);
            const liveBadgeHtml = video.isLive ? `<div class="yt-live-badge"><i class="fas fa-broadcast-tower" style="font-size: 10px;"></i> LIVE</div>` : '';

            const el = document.createElement('div');
            el.className = 'yt-video-card';
            el.innerHTML = `
                <div class="yt-video-thumbnail">
                    <img src="${video.thumbnail || 'https://picsum.photos/320/180?grayscale'}" alt="Thumbnail">
                    ${liveBadgeHtml}
                </div>
                <div class="yt-video-info">
                    <div class="yt-video-avatar" style="cursor: pointer; border: 1px solid #e5e5e5; transition: transform 0.2s;">
                        <img src="${avatarUrl}" alt="${channel.name}">
                    </div>
                    <div class="yt-video-details">
                        <h3 class="yt-video-title">${video.title || '无标题'}</h3>
                        <p class="yt-video-meta">${channel.name} • ${video.views || '0'} • ${video.time || '刚刚'}</p>
                    </div>
                </div>
            `;
            
            el.addEventListener('click', () => {
                if(channel.id === 'user_channel_id') {
                    if(video.isLive) {
                        const userLiveView = document.getElementById('yt-user-live-view');
                        if (userLiveView) userLiveView.classList.add('active');
                    } else {
                        const userProfileTab = document.querySelector('.yt-nav-item[data-target="yt-profile-tab"]');
                        if (userProfileTab) userProfileTab.click();
                    }
                } else {
                    openVideoPlayer(video);
                }
            });

            const avatarBtn = el.querySelector('.yt-video-avatar');
            avatarBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if(channel.id === 'user_channel_id') {
                    const userProfileTab = document.querySelector('.yt-nav-item[data-target="yt-profile-tab"]');
                    if (userProfileTab) userProfileTab.click();
                } else {
                    openSubChannelView(channel);
                }
            });

            liveSection.appendChild(el);
        });
    }

    function syncYtProfile() {
        // Safe binding for Data Center to avoid multiple event listeners without cloning
        const dataCenterBtn = document.getElementById('yt-data-center-btn');
        const dataCenterSheet = document.getElementById('yt-data-center-sheet');
        if (dataCenterBtn && dataCenterSheet && !dataCenterBtn.dataset.bound) {
            dataCenterBtn.dataset.bound = 'true';
            dataCenterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if(window.renderDataCenter) window.renderDataCenter();
                dataCenterSheet.classList.add('active');
            });
        }

        const effectiveYtUser = typeof window.getYtEffectiveUserState === 'function'
            ? window.getYtEffectiveUserState()
            : ytUserState;
        if (effectiveYtUser) {
            ytUserState = effectiveYtUser;
            const nameStr = effectiveYtUser.name || 'User';
            if (profileName) profileName.textContent = nameStr;
            
            const handleStr = effectiveYtUser.handle || nameStr.toLowerCase().replace(/\s+/g, '');
            if (profileHandle) profileHandle.textContent = '@' + handleStr;
            
            if (effectiveYtUser.avatarUrl) {
                if (profileAvatarImg) {
                    profileAvatarImg.src = effectiveYtUser.avatarUrl;
                    profileAvatarImg.style.display = 'block';
                }
                if (profileAvatarIcon) profileAvatarIcon.style.display = 'none';
            } else {
                if (profileAvatarImg) profileAvatarImg.style.display = 'none';
                if (profileAvatarIcon) profileAvatarIcon.style.display = 'block';
            }
            
            if (channelState.bannerUrl && profileHeaderBg) {
                profileHeaderBg.style.backgroundImage = `url('${channelState.bannerUrl}')`;
            } else if (profileHeaderBg) {
                profileHeaderBg.style.backgroundImage = 'none';
            }

            if (profileSubs) {
                profileSubs.textContent = `${effectiveYtUser.subs || '0'} 订阅者`;
            }
            if (profileVideos) {
                profileVideos.textContent = `${effectiveYtUser.videos || '0'} 视频`;
            }
        }
    }

    if (editChannelBtn && editChannelSheet) {
        editChannelBtn.addEventListener('click', () => {
            const effectiveYtUser = typeof window.getYtEffectiveUserState === 'function'
                ? window.getYtEffectiveUserState()
                : ytUserState;
            if (!effectiveYtUser) return;
            ytUserState = effectiveYtUser;
            const nameStr = effectiveYtUser.name || '';
            const handleStr = effectiveYtUser.handle || nameStr.toLowerCase().replace(/\s+/g, '');
            
            if(editNameInput) editNameInput.value = nameStr;
            if(editHandleInput) editHandleInput.value = handleStr;
            if(editUrlInput) editUrlInput.value = channelState.url || `youtube.com/@${handleStr}`;
            if(editSubsInput) editSubsInput.value = effectiveYtUser.subs || '';
            if(editVideosInput) editVideosInput.value = effectiveYtUser.videos || '';
            if(editPersonaInput) editPersonaInput.value = effectiveYtUser.persona || '';
            
            if (effectiveYtUser.avatarUrl && editAvatarImg) {
                editAvatarImg.src = effectiveYtUser.avatarUrl;
                editAvatarImg.style.display = 'block';
                if(editAvatarIcon) editAvatarIcon.style.display = 'none';
            } else {
                if(editAvatarImg) editAvatarImg.style.display = 'none';
                if(editAvatarIcon) editAvatarIcon.style.display = 'block';
            }
            
            if (channelState.bannerUrl && editBannerImg) {
                editBannerImg.src = channelState.bannerUrl;
                editBannerImg.style.display = 'block';
            } else {
                if(editBannerImg) editBannerImg.style.display = 'none';
            }
            editChannelSheet.classList.add('active');
        });
    }

    if (editHandleInput && editUrlInput) {
        editHandleInput.addEventListener('input', (e) => {
            const val = e.target.value.replace(/^@/, '');
            editUrlInput.value = val ? `youtube.com/@${val}` : 'youtube.com/@';
        });
    }

    if (editBannerBtn && bannerUpload) {
        editBannerBtn.addEventListener('click', () => bannerUpload.click());
        bannerUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (window.compressImage) {
                        window.compressImage(event.target.result, 800, 800, (compressedUrl) => {
                            if(editBannerImg) {
                                editBannerImg.src = compressedUrl;
                                editBannerImg.style.display = 'block';
                            }
                        });
                    } else {
                        if(editBannerImg) {
                            editBannerImg.src = event.target.result;
                            editBannerImg.style.display = 'block';
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (editAvatarWrapper && avatarUpload) {
        editAvatarWrapper.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                e.preventDefault();
                avatarUpload.click();
            }
        });
        avatarUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (window.compressImage) {
                        window.compressImage(event.target.result, 300, 300, (compressedUrl) => {
                            if(editAvatarImg) {
                                editAvatarImg.src = compressedUrl;
                                editAvatarImg.style.display = 'block';
                            }
                            if(editAvatarIcon) editAvatarIcon.style.display = 'none';
                        });
                    } else {
                        if(editAvatarImg) {
                            editAvatarImg.src = event.target.result;
                            editAvatarImg.style.display = 'block';
                        }
                        if(editAvatarIcon) editAvatarIcon.style.display = 'none';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (confirmEditBtn) {
        confirmEditBtn.addEventListener('click', () => {
            if (typeof window.ensureYtUserState === 'function') {
                ytUserState = window.ensureYtUserState();
            } else if (!ytUserState) {
                ytUserState = {};
            }
            if(editNameInput) ytUserState.name = editNameInput.value.trim();
            if(editHandleInput) ytUserState.handle = editHandleInput.value.trim().replace(/^@/, '');
            if(editSubsInput) ytUserState.subs = editSubsInput.value.trim();
            if(editVideosInput) ytUserState.videos = editVideosInput.value.trim();
            if(editPersonaInput) ytUserState.persona = editPersonaInput.value.trim();
            if(editDescInput) ytUserState.desc = editDescInput.value.trim();
            
            if (editAvatarImg && editAvatarImg.style.display === 'block' && editAvatarImg.src) {
                ytUserState.avatarUrl = editAvatarImg.src;
            }
            if (editBannerImg && editBannerImg.style.display === 'block' && editBannerImg.src) {
                channelState.bannerUrl = editBannerImg.src;
            }
            if(editUrlInput) channelState.url = editUrlInput.value.trim();

            syncYtProfile();
            if(editChannelSheet) editChannelSheet.classList.remove('active');
            saveYoutubeData();
            if (window.showToast) window.showToast('频道信息已保存');
            renderVideos(); // Refresh avatars in video list
        });
    }

    if (editChannelSheet) {
        editChannelSheet.addEventListener('mousedown', (e) => {
            if (e.target === editChannelSheet) {
                editChannelSheet.classList.remove('active');
            }
        });
    }
