// ==========================================
// TIKTOK: 2. CORE SYSTEM, STATE & NAVIGATION
// ==========================================

function createDefaultTkState() {
    return {
        profile: {
            name: 'User',
            handle: 'user123',
            avatar: null,
            status: '思考中...',
            bio: '点击添加个人简介',
            persona: '',
            following: 0,
            followers: 0,
            likes: 0,
            posts: [],
            visitors: []
        },
        activity: {
            newFollowers: '暂无新粉丝',
            likesSaves: '互动消息',
            commentsMentions: '互动消息',
            followers: [],
            likes: [],
            saves: [],
            comments: []
        },
        settings: {
            boundWorldBookIds: []
        },
        chars: [],
        videos: [
            {
                id: 'v_default_1',
                authorId: 'user_default_1',
                authorName: 'Mew',
                desc: '周末的正确打开方式，当然是和猫猫一起虚度光阴啦 🐈 #猫咪日常 #周末vlog',
                sceneText: '阳光穿过窗纱洒在木地板上，一只橘猫正四仰八叉地躺在阳光里打呼噜。镜头缓慢拉近，画面色调温暖治愈，配着慵懒的 lofi 音乐。',
                likes: 12543,
                commentsCount: 432,
                shares: 128,
                isLiked: false,
                comments: [
                    { authorName: 'Cici', text: '好治愈的画面，想去你家偷猫！', likes: 231 },
                    { authorName: '鱼蛋', text: '这猫怎么长得跟人一样哈哈哈', likes: 89 }
                ]
            },
            {
                id: 'v_default_2',
                authorId: 'user_default_2',
                authorName: 'CityWalker',
                desc: '下雨天的城市，也有别样的浪漫 🌧️ 📸 #扫街 #下雨天 #摄影',
                sceneText: '镜头跟随着一把透明雨伞，穿梭在霓虹闪烁的积水街道。水面倒映着红蓝色的灯牌，雨滴砸在伞面上发出清脆的白噪音，氛围感拉满。',
                likes: 8762,
                commentsCount: 215,
                shares: 342,
                isLiked: false,
                comments: [
                    { authorName: '光影', text: '色彩太棒了，求个滤镜参数', likes: 156 },
                    { authorName: 'Jay', text: '喜欢下雨天的人，内心都很温柔吧', likes: 44 }
                ]
            }
        ],
        dms: []
    };
}

function normalizeTkState(rawState = {}) {
    const defaults = createDefaultTkState();
    const safeState = rawState && typeof rawState === 'object' ? rawState : {};
    const imFriends = typeof window.getImFriends === 'function'
        ? window.getImFriends()
        : (Array.isArray(window.imData?.friends) ? window.imData.friends : []);
    const isLinkedImFriend = (char = {}) => {
        if (!Array.isArray(imFriends) || imFriends.length === 0) return false;
        return imFriends.some(friend => {
            if (!friend || friend.isOfficial || friend.type === 'official') return false;
            return String(friend.id) === String(char.imCharId || char.id)
                || String(friend.nickname || '') === String(char.name || '')
                || String(friend.realName || '') === String(char.name || '');
        });
    };
    const chars = Array.isArray(safeState.chars)
        ? safeState.chars.map(char => ({
            ...char,
            isFollowed: Boolean(char.isFollowed),
            isFollower: Boolean(char.isFollower || (char.isFollowed && isLinkedImFriend(char)))
        }))
        : defaults.chars;

    return {
        ...defaults,
        ...safeState,
        profile: {
            ...defaults.profile,
            ...(safeState.profile && typeof safeState.profile === 'object' ? safeState.profile : {})
        },
        activity: {
            ...defaults.activity,
            ...(safeState.activity && typeof safeState.activity === 'object' ? safeState.activity : {}),
            followers: Array.isArray(safeState.activity?.followers) ? safeState.activity.followers : [],
            likes: Array.isArray(safeState.activity?.likes) ? safeState.activity.likes : [],
            saves: Array.isArray(safeState.activity?.saves) ? safeState.activity.saves : [],
            comments: Array.isArray(safeState.activity?.comments) ? safeState.activity.comments : []
        },
        settings: {
            ...defaults.settings,
            ...(safeState.settings && typeof safeState.settings === 'object' ? safeState.settings : {}),
            boundWorldBookIds: Array.isArray(safeState.settings?.boundWorldBookIds)
                ? safeState.settings.boundWorldBookIds.filter(Boolean)
                : []
        },
        chars,
        videos: Array.isArray(safeState.videos) && safeState.videos.length > 0 ? safeState.videos : defaults.videos,
        dms: Array.isArray(safeState.dms) ? safeState.dms : defaults.dms
    };
}

function loadTkStateFromStore() {
    const raw = typeof window.getAppState === 'function' ? window.getAppState('tiktok') : null;
    const normalized = normalizeTkState(raw);

    if (window.userState) {
        if (!normalized.profile.name || normalized.profile.name === 'User') {
            normalized.profile.name = window.userState.name || 'User';
        }
        if (!normalized.profile.avatar && window.userState.avatarUrl) {
            normalized.profile.avatar = window.userState.avatarUrl;
        }
    }

    return normalized;
}

const tkState = loadTkStateFromStore();

window.tkState = tkState;

function persistTkState() {
    const nextState = normalizeTkState(tkState);

    if (typeof window.setAppState === 'function') {
        window.setAppState('tiktok', nextState);
        return;
    }

    if (window.saveGlobalData) {
        window.saveGlobalData();
    }
}

window.tkGetChar = function(charId) {
    return tkState.chars.find(c => c.id === charId);
};

window.tkSaveChar = function(charData) {
    const existing = tkState.chars.find(c => c.id === charData.id);
    if (existing) {
        Object.assign(existing, {
            isFollowed: Boolean(existing.isFollowed),
            isFollower: Boolean(existing.isFollower),
            ...charData
        });
    } else {
        tkState.chars.push({
            isFollowed: false,
            isFollower: false,
            ...charData
        });
    }
    persistTkState();
};

window.tkPersistState = persistTkState;
window.tkLoadStateFromStore = function() {
    const nextState = loadTkStateFromStore();
    Object.assign(tkState.profile, nextState.profile);
    tkState.chars = nextState.chars;
    tkState.videos = nextState.videos;
    tkState.dms = nextState.dms;
    return tkState;
};

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const tkAppBtn = document.getElementById('app-tiktok-btn');
    const tkView = document.getElementById('tiktok-view');
    const homeBar = document.getElementById('home-bar');

    // Nav Items
    const tkNavItems = document.querySelectorAll('.tk-bottom-nav .tk-nav-item[data-target]');
    const tkTabContents = document.querySelectorAll('.tk-tab-content');

    // Init function
    function initTikTok() {
        if (window.tkRenderHome) window.tkRenderHome();
        if (window.tkRenderChat) window.tkRenderChat();
        if (window.tkRenderProfile) window.tkRenderProfile();
    }

    // Open App
    if (tkAppBtn && tkView) {
        tkAppBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.isJiggleMode) return;
            
            try {
                initTikTok();
            } catch(err) {
                console.error("TikTok Init Error:", err);
            }
            
            tkView.classList.add('active');
        });
    }

    // Close App
    const closeTkApp = () => {
        window.closeView(tkView);
        window.closeView(document.getElementById('tk-video-detail-sheet'));
        window.closeView(document.getElementById('tk-edit-profile-sheet'));
        window.closeView(document.getElementById('tk-edit-char-sheet'));
        window.closeView(document.getElementById('tk-import-char-sheet'));
        window.closeView(document.getElementById('tk-share-sheet'));
        window.closeView(document.getElementById('tk-comment-user-modal'));
        document.getElementById('tk-sub-profile-view').classList.remove('active');
    };

    // Top Bar Back Buttons
    const homeBackBtn = document.getElementById('tk-home-back-btn');
    if (homeBackBtn) homeBackBtn.addEventListener('click', closeTkApp);

    // Bottom Navigation Switching & Swipe Logic
    const tkNavIndicator = document.querySelector('.tk-nav-indicator');
    const mainContent = document.querySelector('.tk-main-content');
    let currentTabIndex = 0;

    function switchTab(index) {
        if (index < 0 || index >= tkNavItems.length) return;
        currentTabIndex = index;

        // Update Nav Items
        tkNavItems.forEach((nav, i) => {
            if (i === index) nav.classList.add('active');
            else nav.classList.remove('active');
        });

        // Move indicator
        if (tkNavIndicator) {
            // Get actual position and width of the clicked nav item
            const targetItem = tkNavItems[index];
            const navRect = targetItem.parentElement.getBoundingClientRect();
            const itemRect = targetItem.getBoundingClientRect();
            
            // Calculate relative left position
            const leftPos = itemRect.left - navRect.left;
            
            tkNavIndicator.style.width = `${itemRect.width}px`;
            tkNavIndicator.style.left = `${leftPos}px`;
            tkNavIndicator.style.transform = 'none'; // Clear previous transform logic
        }

        // Slide Tabs
        tkTabContents.forEach((tab, i) => {
            tab.style.transform = `translateX(-${index * 100}%)`;
            if (i === index) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Refresh specific tab data if needed
        const targetId = tkNavItems[index].getAttribute('data-target');
        if (targetId === 'tk-home-tab' && window.tkRenderHome) {
            window.tkRenderHome();
        } else if (targetId === 'tk-chat-tab' && window.tkRenderChat) {
            window.tkRenderChat();
        } else if (targetId === 'tk-profile-tab' && window.tkRenderProfile) {
            window.tkRenderProfile();
        }
    }

    tkNavItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            switchTab(index);
        });
    });

    // Swipe gestures
    let startX = 0;
    let isSwiping = false;

    if (mainContent) {
        mainContent.addEventListener('touchstart', (e) => {
            // Ignore if touching a horizontally scrollable element
            if (e.target.closest('.tk-following-bar')) return;
            startX = e.touches[0].clientX;
            isSwiping = true;
        }, { passive: true });

        mainContent.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            // Prevent default to stop native scrolling while swiping tabs horizontally
            // But we need vertical scroll to work on feed/profile, so we don't preventDefault here simply.
        }, { passive: true });

        mainContent.addEventListener('touchend', (e) => {
            if (!isSwiping) return;
            isSwiping = false;
            let endX = e.changedTouches[0].clientX;
            let diffX = startX - endX;

            if (Math.abs(diffX) > 50) { // Threshold for swipe
                if (diffX > 0 && currentTabIndex < tkNavItems.length - 1) {
                    // Swipe Left -> Next Tab
                    switchTab(currentTabIndex + 1);
                } else if (diffX < 0 && currentTabIndex > 0) {
                    // Swipe Right -> Prev Tab
                    switchTab(currentTabIndex - 1);
                }
            }
        });
    }
    
    // Initialize
    switchTab(0);
});
