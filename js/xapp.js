(function() {
    document.addEventListener('DOMContentLoaded', () => {
        const appButton = document.getElementById('app-x-btn');
        const view = document.getElementById('x-view');
        const mainContent = view ? view.querySelector('.x-main-content') : null;
        const navItems = view ? Array.from(view.querySelectorAll('.x-nav-item[data-target]')) : [];
        const tabs = view ? Array.from(view.querySelectorAll('.x-tab-content')) : [];
        const indicator = document.getElementById('x-nav-indicator');
        const postDetailView = document.getElementById('x-post-detail-view');
        const postDetailBack = document.getElementById('x-post-detail-back');
        const topicDetailView = document.getElementById('x-topic-detail-view');
        const topicDetailBack = document.getElementById('x-topic-detail-back');
        const topicDetailGenerateBtn = document.getElementById('x-topic-detail-generate-btn');
        const topicDetailHeadline = document.getElementById('x-topic-detail-headline');
        const topicFeedPanel = document.getElementById('x-topic-feed-panel');
        const createTopicSheet = document.getElementById('x-create-topic-sheet');
        const createTopicCancelBtn = document.getElementById('x-create-topic-cancel-btn');
        const createTopicSaveBtn = document.getElementById('x-create-topic-save-btn');
        const createTopicBannerPreview = document.getElementById('x-create-topic-banner-preview');
        const createTopicBannerInput = document.getElementById('x-create-topic-banner-input');
        const createTopicAvatarPreview = document.getElementById('x-create-topic-avatar-preview');
        const createTopicAvatarInput = document.getElementById('x-create-topic-avatar-input');
        const createTopicNameInput = document.getElementById('x-create-topic-name-input');
        const createTopicFansInput = document.getElementById('x-create-topic-fans-input');
        const createTopicImportBtn = document.getElementById('x-topic-import-imessage-btn');
        const createTopicManualBtn = document.getElementById('x-topic-manual-char-btn');
        const createTopicImessageContainer = document.getElementById('x-topic-imessage-list-container');
        const createTopicManualContainer = document.getElementById('x-topic-manual-container');
        const createTopicCharsList = document.getElementById('x-topic-chars-list');
        const topicManualSaveBtn = document.getElementById('x-topic-manual-save-btn');
        const superUpdateBtn = document.getElementById('x-super-update-btn');
        
        let createTopicAvatarDraft = '';
        let createTopicBannerDraft = '';
        let createTopicSelectedChars = [];

        const editSheet = document.getElementById('x-edit-profile-sheet');
        const settingsSheet = document.getElementById('x-settings-sheet');
        const composeSheet = document.getElementById('x-compose-sheet');
        const editButton = document.getElementById('x-profile-edit-btn');
        const settingsButton = document.getElementById('x-profile-settings-btn');
        const editCancelButton = document.getElementById('x-edit-cancel-btn');
        const editSaveButton = document.getElementById('x-edit-save-btn');
        const settingsCloseButton = document.getElementById('x-settings-close-btn');
        const settingsWorldBookButton = document.getElementById('x-settings-worldbook-btn');
        const composeCancelButton = document.getElementById('x-compose-cancel-btn');
        const composeSubmitButton = document.getElementById('x-compose-submit-btn');
        const composeTextInput = document.getElementById('x-compose-text-input');
        const editAvatarPreview = document.getElementById('x-edit-avatar-preview');
        const editAvatarInput = document.getElementById('x-edit-avatar-input');
        const editBannerPreview = document.getElementById('x-edit-banner-preview');
        const editBannerInput = document.getElementById('x-edit-banner-input');
        const editNameInput = document.getElementById('x-edit-name-input');
        const editHandleInput = document.getElementById('x-edit-handle-input');
        const editBioInput = document.getElementById('x-edit-bio-input');
        const editPersonaInput = document.getElementById('x-edit-persona-input');
        const closeButtons = [
            document.getElementById('x-back-btn'),
            document.getElementById('x-profile-close-btn')
        ].filter(Boolean);

        if (!view || !appButton || navItems.length === 0 || tabs.length === 0) return;

        const globalDateInput = document.getElementById('x-global-date-input');
        const nextDayBtn = document.getElementById('x-next-day-btn');

        const currentYear = new Date().getFullYear();
        const defaultDate = `${currentYear}-01-01`;

        const defaultProfile = {
            name: 'User Name',
            handle: '@username',
            bio: '',
            persona: '',
            avatar: '',
            banner: ''
        };

        const defaultXState = {
            xData: { ...defaultProfile, edited: false },
            xTopics: [],
            boundWorldBookIds: [],
            xVisitors: [],
            xDirectMessages: [],
            xPostThreads: {},
            xGeneratedPosts: [],
            xHomeBannerUrl: '',
            xSearchBannerUrl: '',
            xCurrentDate: defaultDate
        };
        const generatedImagePlaceholderUrl = 'assets/x/generated-image-placeholder.jpg';

        const postData = {
            island: {
                avatar: '林',
                name: '林屿 Island',
                handle: '@island · 12m',
                text: '首页信息流先按微博的阅读节奏排，保留热搜、转评赞和图文密度，但整体收进 X 的黑白系统里。',
                reposts: '46',
                likes: '3.2K',
                comments: '128',
                commentList: [
                    { avatar: 'A', name: 'Akira', handle: '@akira · 4m', text: '这个层级更像微博，但底色和按钮都很 X。' },
                    { avatar: 'M', name: 'Mina', handle: '@mina · 2m', text: '评论区做成卡片之后，帖子详情就完整很多。' },
                    { avatar: 'S', name: 'Sora', handle: '@sora · now', text: '图片区域保留静态占位也够看排版了。' }
                ]
            },
            super: {
                avatar: '超',
                name: '超话精选',
                handle: '@super · 28m',
                text: '今日签到人数上涨 24%，热门讨论集中在舞台妆造、路透图和饭制剪辑。',
                reposts: '301',
                likes: '8.8K',
                comments: '89',
                commentList: [
                    { avatar: '#', name: 'Topic Bot', handle: '@topic · 9m', text: '年度舞台名场面已经进入超话热帖榜。' },
                    { avatar: 'L', name: 'Luna', handle: '@luna · 3m', text: '超话页和详情页之间的关系现在更明确。' }
                ]
            },
            following: {
                avatar: 'M',
                name: 'Mina',
                handle: '@mina · 6m',
                text: 'Following 里先放关注流的静态样式。后续接账号或角色关系时，可以直接把关注对象的帖子渲染进这里。',
                reposts: '9',
                likes: '642',
                comments: '18',
                commentList: [
                    { avatar: 'U', name: 'User', handle: '@user · 1m', text: '关注页用静态占位就能先验证切换体验。' }
                ]
            },
            profile: {
                avatar: 'U',
                name: 'User Name',
                handle: '@username · pinned',
                text: '个人主页内容卡片先保持静态，重点是排版、层级和底栏切换体验。',
                reposts: '12',
                likes: '520',
                comments: '34',
                commentList: [
                    { avatar: 'X', name: 'X App', handle: '@xapp · now', text: '这条来自个人页 Posts 分栏。' }
                ]
            }
        };

        let currentIndex = 0;
        let touchStartX = 0;
        let touchStartY = 0;
        let isTouching = false;
        let currentProfile = resolveProfile();
        let avatarDraft = currentProfile.avatar || '';
        let bannerDraft = currentProfile.banner || '';
        let tempPostCounter = 0;
        let currentDetailPostId = null;
        let replyTarget = null;
        let visitorsSheet = null;
        let visitorsList = null;
        let addDmSheet = null;
        let imessageCharList = null;
        let dmList = null;
        let manualCharNameInput = null;
        let manualCharHandleInput = null;
        let manualCharBioInput = null;
        let manualCharPersonaInput = null;
        let dmChatView = null;
        let dmChatMessagesEl = null;
        let dmChatInput = null;
        let dmSettingsSheet = null;
        let dmProfileView = null;
        let currentDmId = null;
        let searchGenerateSheet = null;
        let searchGenerateInput = null;
        let imagePreviewOverlay = null;
        let currentTopicContext = null;
        let postSettingsSheet = null;
        let currentActionPostId = null;

        function safeText(value, fallback = '') {
            const text = String(value == null ? '' : value).trim();
            return text || fallback;
        }

        function escapeHtml(value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function parseCompactCount(value) {
            const raw = String(value == null ? '0' : value).trim().replace(/,/g, '');
            const match = raw.match(/^([\d.]+)\s*([Kk万])?$/);
            if (!match) return Number(raw) || 0;
            const number = Number(match[1]) || 0;
            if (match[2] === '万') return Math.round(number * 10000);
            if (match[2] && match[2].toLowerCase() === 'k') return Math.round(number * 1000);
            return Math.round(number);
        }

        function formatCompactCount(value) {
            const count = Math.max(0, Number(value) || 0);
            if (count >= 10000) return `${(count / 10000).toFixed(count >= 100000 ? 0 : 1).replace(/\.0$/, '')}万`;
            if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`;
            return String(count);
        }

        function makeLocalId(prefix) {
            return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }

        function buildAvatarHtml(value, fallback = '?') {
            const avatar = safeText(value);
            if (avatar && (/^(data:|https?:|blob:)/i).test(avatar)) {
                return `<img src="${escapeHtml(avatar)}" alt="">`;
            }
            return escapeHtml((avatar || fallback || '?').slice(0, 2));
        }

        function getCurrentCommentAuthor() {
            const name = safeText(currentProfile.name, 'Me');
            return {
                avatar: currentProfile.avatar || name.slice(0, 1).toUpperCase(),
                name,
                handle: `${currentProfile.handle || '@me'} · now`
            };
        }

        function normalizeApiEndpoint(config = {}) {
            let endpoint = safeText(config.endpoint);
            if (!endpoint) return '';
            if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
            if (!endpoint.endsWith('/chat/completions')) {
                endpoint = endpoint.endsWith('/v1') ? `${endpoint}/chat/completions` : `${endpoint}/v1/chat/completions`;
            }
            return endpoint;
        }

        async function requestXChatCompletion(messages, options = {}) {
            const config = typeof window.getApiConfig === 'function' ? window.getApiConfig() : (window.apiConfig || {});
            const endpoint = normalizeApiEndpoint(config);
            if (!endpoint || !config.apiKey) throw new Error('API config missing');
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.model || 'gpt-3.5-turbo',
                    messages,
                    temperature: parseFloat(config.temperature) || options.temperature || 0.8
                })
            });
            if (!response.ok) throw new Error(`API ${response.status}`);
            const data = await response.json();
            return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
        }

        function parseJsonPayload(text) {
            const raw = safeText(text);
            if (!raw) throw new Error('Empty API response');
            try {
                return JSON.parse(raw);
            } catch (error) {
                const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
                if (match) return JSON.parse(match[1]);
                throw error;
            }
        }

        function getSelectedWorldBookContext(extraText = '') {
            const state = getXState();
            const selected = new Set((state.boundWorldBookIds || []).map(String));
            const parts = [];
            if (typeof window.getWorldBooks === 'function') {
                window.getWorldBooks().forEach((book) => {
                    const isSelected = selected.has(String(book.id));
                    if (!isSelected && !book.isGlobal) return;
                    const lines = (Array.isArray(book.entries) ? book.entries : [])
                        .filter((entry) => entry && entry.enabled !== false)
                        .map((entry) => `- ${entry.keyword || entry.title || book.name}: ${entry.content || ''}`)
                        .filter((line) => line.trim() !== '- :');
                    if (lines.length) parts.push(`[WorldBook: ${book.name || book.id}]\n${lines.join('\n')}`);
                });
            }
            if (typeof window.getBuiltinWorldBookEntries === 'function') {
                const builtinLines = window.getBuiltinWorldBookEntries()
                    .filter((entry) => entry && entry.enabled !== false)
                    .filter((entry) => !entry.keyword || !window.worldBookKeywordMatched || window.worldBookKeywordMatched(entry, extraText))
                    .slice(0, 12)
                    .map((entry) => `- ${entry.keyword || entry.title || 'builtin'}: ${entry.content || ''}`);
                if (builtinLines.length) parts.push(`[Built-in WorldBook]\n${builtinLines.join('\n')}`);
            }
            return parts.join('\n\n');
        }

        function normalizeGeneratedComment(comment, fallbackIndex = 0) {
            const text = safeText(comment.text || comment.content);
            if (!text) return null;
            const name = safeText(comment.authorName || comment.name || comment.handle);
            if (!name) return null;
            return {
                id: String(comment.id || makeLocalId('comment')),
                avatar: comment.authorAvatar || comment.avatar || name.slice(0, 1).toUpperCase(),
                name,
                handle: makeHandle(name, comment.handle || name),
                text,
                replies: (Array.isArray(comment.replies) ? comment.replies : []).map((reply, index) => {
                    const replyText = safeText(reply.text || reply.content);
                    if (!replyText) return null;
                    const replyName = safeText(reply.authorName || reply.name || reply.handle);
                    if (!replyName) return null;
                    return {
                        id: String(reply.id || makeLocalId('reply')),
                        avatar: reply.authorAvatar || reply.avatar || replyName.slice(0, 1).toUpperCase(),
                        name: replyName,
                        handle: makeHandle(replyName, reply.handle || replyName),
                        text: replyText,
                        replies: []
                    };
                }).filter(Boolean)
            };
        }

        function normalizeGeneratedPost(raw, index = 0) {
            const authorName = safeText(raw.authorName || raw.name || raw.handle || raw.authorHandle);
            if (!authorName) return null;
            const id = String(raw.id || makeLocalId('xgen'));
            const text = safeText(raw.text || raw.desc || raw.content);
            if (!text && !raw.isMoment) return null;
            const imageText = safeText(raw.imageText || raw.imagePrompt || raw.image || raw.picture || raw.mediaDescription);
            const rawImages = Array.isArray(raw.images) ? raw.images : [];
            const images = rawImages.length > 0
                ? rawImages.map((image, imageIndex) => ({
                    id: String(image.id || `${id}-image-${imageIndex}`),
                    text: safeText(image.text || image.prompt || image.description || image.alt || imageText),
                    url: safeText(image.url || image.src || image.imageUrl)
                }))
                : (imageText || raw.mediaType === 'image'
                    ? [{ id: `${id}-image-0`, text: imageText, url: '' }]
                    : []);
            const rawComments = Array.isArray(raw.comments)
                ? raw.comments
                : (Array.isArray(raw.commentList) ? raw.commentList : []);
            const comments = rawComments
                .map((comment, commentIndex) => normalizeGeneratedComment(comment, commentIndex))
                .filter(Boolean);
            return {
                id,
                avatar: raw.authorAvatar || raw.avatar || authorName.slice(0, 1).toUpperCase(),
                name: authorName,
                handle: makeHandle(authorName, raw.handle || raw.authorHandle || authorName),
                text,
                reposts: formatCompactCount(raw.reposts ?? raw.shares ?? 0),
                likes: formatCompactCount(raw.likes ?? 0),
                comments: formatCompactCount(Math.max(Number(raw.commentsCount) || 0, comments.length)),
                commentList: comments,
                images,
                generated: true,
                topicTag: raw.topicTag || '',
                isMoment: !!raw.isMoment,
                actionText: safeText(raw.actionText),
                refPost: raw.refPost ? normalizeGeneratedPost(raw.refPost, 0) : null,
                isFeatured: !!raw.isFeatured,
                createdAt: raw.createdAt || Date.now()
            };
        }

        function getPostImages(post) {
            return Array.isArray(post?.images) ? post.images : [];
        }

        function renderPostImages(images = []) {
            if (!images.length) return '';
            return `
                <div class="x-generated-media-grid">
                    ${images.slice(0, 4).map((image) => `
                        <button class="x-post-image-thumb" type="button" data-image-text="${escapeHtml(image.text || 'Image')}" data-image-url="${escapeHtml(image.url || '')}">
                            <img src="${escapeHtml(image.url || generatedImagePlaceholderUrl)}" alt="">
                        </button>
                    `).join('')}
                </div>
            `;
        }

        function makeHandle(name, handle) {
            const raw = safeText(handle);
            if (raw) return raw.startsWith('@') ? raw : `@${raw}`;
            const base = safeText(name, 'user')
                .toLowerCase()
                .replace(/[^a-z0-9_\u4e00-\u9fa5]+/gi, '');
            return `@${base || 'user'}`;
        }

        function normalizeXState(rawState) {
            const safe = rawState && typeof rawState === 'object' ? rawState : {};
            const xData = safe.xData && typeof safe.xData === 'object' ? safe.xData : {};
            return {
                ...defaultXState,
                ...safe,
                xData: {
                    ...defaultXState.xData,
                    ...xData
                },
                xTopics: Array.isArray(safe.xTopics) ? safe.xTopics : [],
                boundWorldBookIds: Array.isArray(safe.boundWorldBookIds)
                    ? safe.boundWorldBookIds.map(String)
                    : [],
                xVisitors: Array.isArray(safe.xVisitors) ? safe.xVisitors : [],
                xDirectMessages: Array.isArray(safe.xDirectMessages) ? safe.xDirectMessages : [],
                xPostThreads: safe.xPostThreads && typeof safe.xPostThreads === 'object' && !Array.isArray(safe.xPostThreads)
                    ? safe.xPostThreads
                    : {},
                xGeneratedPosts: Array.isArray(safe.xGeneratedPosts) ? safe.xGeneratedPosts : [],
                xCurrentDate: safe.xCurrentDate || defaultDate
            };
        }

        function getXState() {
            const raw = typeof window.getAppState === 'function' ? window.getAppState('x') : window.__xFallbackState;
            return normalizeXState(raw);
        }

        function saveXState(nextState) {
            const normalized = normalizeXState(nextState);
            if (typeof window.setAppState === 'function') {
                window.setAppState('x', normalized);
            } else {
                window.__xFallbackState = normalized;
            }
            return normalized;
        }

        function updateXState(mutator) {
            const previous = getXState();
            const draft = {
                ...previous,
                xVisitors: [...(previous.xVisitors || [])],
                xDirectMessages: [...(previous.xDirectMessages || [])],
                xPostThreads: { ...(previous.xPostThreads || {}) },
                xGeneratedPosts: [...(previous.xGeneratedPosts || [])]
            };
            mutator(draft);
            return saveXState(draft);
        }

        function setupSectionHeader(header, rightButtonLabel) {
            if (!header || header.dataset.xCentered === 'true') return;
            const rightButton = header.querySelector('.x-header-button');
            if (!rightButton) return;
            rightButton.setAttribute('aria-label', rightButton.getAttribute('aria-label') || rightButtonLabel || 'Action');
            header.innerHTML = '';
            const backButton = document.createElement('button');
            backButton.className = 'x-header-button';
            backButton.type = 'button';
            backButton.setAttribute('aria-label', 'Back');
            backButton.setAttribute('data-x-close', 'true');
            backButton.innerHTML = '<i class="fas fa-chevron-left"></i>';

            const brand = document.createElement('div');
            brand.className = 'x-brand-lockup x-section-brand';
            brand.innerHTML = '<i class="fa-brands fa-x-twitter"></i>';

            header.classList.add('x-centered-header');
            header.append(backButton, brand, rightButton);
            header.dataset.xCentered = 'true';
        }

        function renderGlobalDate() {
            if (globalDateInput) {
                globalDateInput.value = getXState().xCurrentDate || defaultDate;
            }
        }

        function setGlobalDate(dateStr) {
            updateXState(draft => {
                draft.xCurrentDate = dateStr;
            });
            renderGlobalDate();
        }

        function nextDay() {
            const current = getXState().xCurrentDate || defaultDate;
            const d = new Date(current);
            d.setDate(d.getDate() + 1);
            const nextStr = d.toISOString().split('T')[0];
            setGlobalDate(nextStr);
        }

        function ensureXChrome() {
            const superHeader = document.querySelector('#x-super-tab .x-section-header');
            setupSectionHeader(superHeader, 'Create topic');
            const superCreateBtn = superHeader?.querySelector('.x-header-button[aria-label="Create topic"]');
            if (superCreateBtn) {
                superCreateBtn.addEventListener('click', openCreateTopicSheet);
            }

            setupSectionHeader(document.querySelector('#x-discover-tab .x-section-header'), 'Filter');
            setupSectionHeader(document.querySelector('#x-messages-tab .x-section-header'), 'New message');

            const messageHeaderButton = document.querySelector('#x-messages-tab .x-section-header .x-header-button:last-child');
            if (messageHeaderButton) messageHeaderButton.id = 'x-add-dm-btn';
            const homeSearchButton = document.querySelector('#x-home-tab .x-header-actions .x-header-button:not(.x-compose-button)');
            if (homeSearchButton) homeSearchButton.id = 'x-search-generate-btn';
            const firstSummaryLabel = document.querySelector('#x-messages-tab .x-message-summary div:first-child span');
            if (firstSummaryLabel) firstSummaryLabel.textContent = '新粉丝';

            const summaryLabels = document.querySelectorAll('#x-messages-tab .x-message-summary span');
            const summaryCopy = ['会话', '未读', '@我'];
            summaryLabels.forEach((label, index) => {
                label.textContent = summaryCopy[index] || label.textContent;
            });

            const profileActions = document.querySelector('.x-profile-cover-actions');
            const settingsBtn = document.getElementById('x-profile-settings-btn');
            if (profileActions && settingsBtn && !document.getElementById('x-profile-visitors-btn')) {
                const rightActions = document.createElement('div');
                rightActions.className = 'x-profile-cover-right-actions';
                const visitorBtn = document.createElement('button');
                visitorBtn.className = 'x-header-button';
                visitorBtn.id = 'x-profile-visitors-btn';
                visitorBtn.type = 'button';
                visitorBtn.setAttribute('aria-label', 'Profile visitors');
                visitorBtn.innerHTML = '<i class="fas fa-user-clock"></i>';
                settingsBtn.parentNode.insertBefore(rightActions, settingsBtn);
                rightActions.append(visitorBtn, settingsBtn);
            }

            setupPostDetailControls();
            setupVisitorsSheet();
            setupAddDmSheet();
            setupDmChatView();
            setupDmSettingsSheet();
            setupDmProfileView();
            setupSearchGenerateSheet();
            setupImagePreviewOverlay();
            setupPostSettingsSheet();
            dmList = document.getElementById('x-dm-list') || document.querySelector('#x-messages-tab .x-message-list');
            if (dmList) dmList.id = 'x-dm-list';
            clearDefaultHomeFeedContent();
            renderHomeEmptyStates();
            renderGlobalDate();
        }

        function setupPostDetailControls() {
            const composer = document.querySelector('.x-comment-composer');
            document.getElementById('x-detail-actions')?.remove();
            if (composer && !document.getElementById('x-reply-input')) {
                const context = document.createElement('div');
                context.className = 'x-reply-context';
                context.id = 'x-reply-context';
                context.hidden = true;
                context.innerHTML = `
                    <span id="x-reply-context-text">Replying to post</span>
                    <button id="x-reply-cancel-btn" type="button" aria-label="Cancel reply target"><i class="fas fa-times"></i></button>
                `;
                composer.insertAdjacentElement('beforebegin', context);
                composer.innerHTML = `
                    <div class="x-avatar x-avatar-dark">X</div>
                    <input id="x-reply-input" type="text" maxlength="180" placeholder="Post your reply">
                    <button id="x-reply-submit-btn" type="button">Reply</button>
                `;
            }
            const context = document.getElementById('x-reply-context');
            if (postDetailView && context && context.parentElement !== postDetailView) {
                postDetailView.appendChild(context);
            }
            if (postDetailView && composer && composer.parentElement !== postDetailView) {
                postDetailView.appendChild(composer);
            }
        }

        function setupVisitorsSheet() {
            visitorsSheet = document.getElementById('x-visitors-sheet');
            if (!visitorsSheet) {
                visitorsSheet = document.createElement('div');
                visitorsSheet.className = 'bottom-sheet-overlay detail-sheet-overlay x-visitors-overlay';
                visitorsSheet.id = 'x-visitors-sheet';
                visitorsSheet.style.zIndex = '268';
                visitorsSheet.innerHTML = `
                    <div class="bottom-sheet x-visitors-sheet">
                        <div class="sheet-handle"></div>
                        <div class="x-edit-sheet-header">
                            <button class="x-edit-sheet-text-btn" id="x-visitors-close-btn" type="button">Close</button>
                            <strong>主页访客</strong>
                            <span class="x-settings-spacer"></span>
                        </div>
                        <div class="x-visitors-list" id="x-visitors-list"></div>
                    </div>
                `;
                view.appendChild(visitorsSheet);
            }
            visitorsList = document.getElementById('x-visitors-list');
        }

        function setupAddDmSheet() {
            addDmSheet = document.getElementById('x-add-dm-sheet');
            if (!addDmSheet) {
                addDmSheet = document.createElement('div');
                addDmSheet.className = 'bottom-sheet-overlay detail-sheet-overlay x-add-dm-overlay';
                addDmSheet.id = 'x-add-dm-sheet';
                addDmSheet.style.zIndex = '272';
                addDmSheet.innerHTML = `
                    <div class="bottom-sheet x-add-dm-sheet">
                        <div class="sheet-handle"></div>
                        <div class="x-edit-sheet-header">
                            <button class="x-edit-sheet-text-btn" id="x-add-dm-close-btn" type="button">关闭</button>
                            <strong>添加私信</strong>
                            <span class="x-settings-spacer"></span>
                        </div>
                        <div class="x-add-dm-body">
                            <section class="x-add-dm-section">
                                <div class="x-add-dm-section-title">从 iMessage 导入 Char</div>
                                <div class="x-imessage-char-list" id="x-imessage-char-list">
                                    <div class="x-empty-state">加载 iMessage Char...</div>
                                </div>
                            </section>
                            <section class="x-add-dm-section">
                                <div class="x-add-dm-section-title">手动添加 Char</div>
                                <label class="x-add-dm-field">
                                    <span>名称</span>
                                    <input id="x-manual-char-name" type="text" maxlength="32" placeholder="Char name">
                                </label>
                                <label class="x-add-dm-field">
                                    <span>@账号</span>
                                    <input id="x-manual-char-handle" type="text" maxlength="32" placeholder="@char">
                                </label>
                                <label class="x-add-dm-field">
                                    <span>简介</span>
                                    <textarea id="x-manual-char-bio" maxlength="120" placeholder="输入角色简介或签名"></textarea>
                                </label>
                                <label class="x-add-dm-field">
                                    <span>人设</span>
                                    <textarea id="x-manual-char-persona" maxlength="600" placeholder="输入角色说话方式、性格、关系和背景设定"></textarea>
                                </label>
                                <button class="x-add-dm-submit" id="x-manual-char-add-btn" type="button">保存并添加</button>
                            </section>
                        </div>
                    </div>
                `;
                view.appendChild(addDmSheet);
            }
            imessageCharList = document.getElementById('x-imessage-char-list');
            manualCharNameInput = document.getElementById('x-manual-char-name');
            manualCharHandleInput = document.getElementById('x-manual-char-handle');
            manualCharBioInput = document.getElementById('x-manual-char-bio');
            manualCharPersonaInput = document.getElementById('x-manual-char-persona');
        }

        function setupDmChatView() {
            dmChatView = document.getElementById('x-dm-chat-view');
            if (!dmChatView) {
                dmChatView = document.createElement('div');
                dmChatView.className = 'x-dm-chat-view';
                dmChatView.id = 'x-dm-chat-view';
                dmChatView.setAttribute('aria-hidden', 'true');
                dmChatView.innerHTML = `
                    <header class="x-dm-chat-header">
                        <button class="x-dm-chat-back" id="x-dm-chat-back" type="button" aria-label="返回">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <div class="x-dm-chat-title">
                            <div class="x-avatar" id="x-dm-chat-avatar">X</div>
                            <div class="x-dm-chat-name">
                                <strong id="x-dm-chat-name">Char</strong>
                                <span id="x-dm-chat-handle">@char</span>
                            </div>
                        </div>
                        <button class="x-dm-chat-menu" id="x-dm-chat-menu-btn" type="button" aria-label="菜单">
                            <i class="fas fa-ellipsis-h"></i>
                        </button>
                    </header>
                    <main class="x-dm-chat-messages" id="x-dm-chat-messages"></main>
                    <form class="x-dm-chat-composer" id="x-dm-chat-composer" autocomplete="off">
                        <div class="x-dm-chat-input-wrapper">
                            <input id="x-dm-chat-input" type="text" maxlength="280" placeholder="发送消息...">
                            <button class="x-dm-chat-api" id="x-dm-chat-api-btn" type="button" aria-label="接收/生成回复"><i class="fas fa-arrow-down"></i></button>
                        </div>
                        <button class="x-dm-chat-send" id="x-dm-chat-send-btn" type="submit" aria-label="发送"><i class="fas fa-paper-plane"></i></button>
                    </form>
                `;
                view.appendChild(dmChatView);
            }
            dmChatMessagesEl = document.getElementById('x-dm-chat-messages');
            dmChatInput = document.getElementById('x-dm-chat-input');
        }

        function setupDmSettingsSheet() {
            dmSettingsSheet = document.getElementById('x-dm-settings-sheet');
            if (!dmSettingsSheet) {
                dmSettingsSheet = document.createElement('div');
                dmSettingsSheet.className = 'bottom-sheet-overlay detail-sheet-overlay x-dm-settings-overlay';
                dmSettingsSheet.id = 'x-dm-settings-sheet';
                dmSettingsSheet.style.zIndex = '274';
                dmSettingsSheet.innerHTML = `
                    <div class="bottom-sheet x-dm-settings-sheet">
                        <div class="sheet-handle"></div>
                        <div class="x-edit-sheet-header">
                            <button class="x-edit-sheet-text-btn" id="x-dm-settings-close-btn" type="button">关闭</button>
                            <strong>私信设置</strong>
                            <span class="x-settings-spacer"></span>
                        </div>
                        <div class="x-dm-settings-body">
                            <button class="x-dm-settings-action" id="x-dm-clear-chat-btn" type="button">
                                <i class="fas fa-eraser"></i>
                                <span>清空聊天记录</span>
                            </button>
                            <button class="x-dm-settings-action danger" id="x-dm-delete-chat-btn" type="button">
                                <i class="far fa-trash-alt"></i>
                                <span>删除会话</span>
                            </button>
                        </div>
                    </div>
                `;
                view.appendChild(dmSettingsSheet);
            }
        }

        function setupDmProfileView() {
            dmProfileView = document.getElementById('x-dm-profile-view');
            if (!dmProfileView) {
                dmProfileView = document.createElement('div');
                dmProfileView.className = 'x-dm-profile-view';
                dmProfileView.id = 'x-dm-profile-view';
                dmProfileView.setAttribute('aria-hidden', 'true');
                dmProfileView.innerHTML = `
                    <main class="x-dm-profile-body" id="x-dm-profile-body"></main>
                `;
                view.appendChild(dmProfileView);
            }
        }

        function setupSearchGenerateSheet() {
            searchGenerateSheet = document.getElementById('x-search-generate-sheet');
            if (!searchGenerateSheet) {
                searchGenerateSheet = document.createElement('div');
                searchGenerateSheet.className = 'bottom-sheet-overlay detail-sheet-overlay x-search-generate-overlay';
                searchGenerateSheet.id = 'x-search-generate-sheet';
                searchGenerateSheet.style.zIndex = '273';
                searchGenerateSheet.innerHTML = `
                    <div class="bottom-sheet x-search-generate-sheet">
                        <div class="sheet-handle"></div>
                        <div class="x-edit-sheet-header">
                            <button class="x-edit-sheet-text-btn" id="x-search-generate-close-btn" type="button">Close</button>
                            <strong>搜索/生成帖子</strong>
                            <button class="x-edit-sheet-save" id="x-search-generate-run-btn" type="button">Generate</button>
                        </div>
                        <div class="x-search-generate-body">
                            <label class="x-add-dm-field">
                                <span>生成方向</span>
                                <textarea id="x-search-generate-input" maxlength="500" placeholder="可留空，或输入想生成的帖子主题"></textarea>
                            </label>
                        </div>
                    </div>
                `;
                view.appendChild(searchGenerateSheet);
            }
            searchGenerateInput = document.getElementById('x-search-generate-input');
            searchGenerateSheet?.querySelectorAll('.x-settings-note').forEach((node) => node.remove());
        }

        function setupPostSettingsSheet() {
            postSettingsSheet = document.getElementById('x-post-settings-sheet');
            if (!postSettingsSheet) {
                postSettingsSheet = document.createElement('div');
                postSettingsSheet.className = 'bottom-sheet-overlay detail-sheet-overlay x-dm-settings-overlay';
                postSettingsSheet.id = 'x-post-settings-sheet';
                postSettingsSheet.style.zIndex = '275';
                postSettingsSheet.innerHTML = `
                    <div class="bottom-sheet x-dm-settings-sheet">
                        <div class="sheet-handle"></div>
                        <div class="x-edit-sheet-header">
                            <button class="x-edit-sheet-text-btn" id="x-post-settings-close-btn" type="button">关闭</button>
                            <strong>帖子设置</strong>
                            <span class="x-settings-spacer"></span>
                        </div>
                        <div class="x-dm-settings-body">
                            <button class="x-dm-settings-action danger" id="x-post-delete-btn" type="button">
                                <i class="far fa-trash-alt"></i>
                                <span>删除帖子</span>
                            </button>
                        </div>
                    </div>
                `;
                view.appendChild(postSettingsSheet);
            }
        }

        function setupImagePreviewOverlay() {
            imagePreviewOverlay = document.getElementById('x-image-preview-overlay');
            if (!imagePreviewOverlay) {
                imagePreviewOverlay = document.createElement('div');
                imagePreviewOverlay.className = 'x-image-preview-overlay';
                imagePreviewOverlay.id = 'x-image-preview-overlay';
                imagePreviewOverlay.setAttribute('aria-hidden', 'true');
                imagePreviewOverlay.innerHTML = `
                    <button class="x-image-preview-close" id="x-image-preview-close" type="button" aria-label="Close image"><i class="fas fa-times"></i></button>
                    <div class="x-image-preview-card" id="x-image-preview-card">
                        <img id="x-image-preview-img" alt="">
                        <div id="x-image-preview-text"></div>
                    </div>
                `;
                view.appendChild(imagePreviewOverlay);
            }
        }

        function getCurrentAccountProfile() {
            const accounts = typeof window.getAccounts === 'function' ? window.getAccounts() : [];
            const currentAccountId = typeof window.getCurrentAccountId === 'function' ? window.getCurrentAccountId() : null;
            const currentAccount = Array.isArray(accounts)
                ? accounts.find((account) => String(account.id) === String(currentAccountId))
                : null;
            const runtimeUser = window.userState || {};
            const source = currentAccount || runtimeUser || {};
            const name = source.name || source.realName || runtimeUser.name || runtimeUser.realName || defaultProfile.name;
            const bio = source.signature || source.bio || source.persona || runtimeUser.signature || runtimeUser.persona || defaultProfile.bio;

            return {
                name,
                handle: makeHandle(name, source.handle || runtimeUser.handle),
                bio,
                persona: source.persona || runtimeUser.persona || '',
                avatar: source.avatarUrl || source.avatar || runtimeUser.avatarUrl || runtimeUser.avatar || '',
                banner: source.banner || source.bannerUrl || ''
            };
        }

        function hasEditedXProfile(xData = {}) {
            return Boolean(
                xData.edited ||
                xData.avatar ||
                xData.banner ||
                xData.bio ||
                xData.persona ||
                (xData.name && xData.name !== 'User') ||
                (xData.handle && xData.handle !== '@user')
            );
        }

        function resolveProfile() {
            const xState = getXState();
            const fallback = getCurrentAccountProfile();
            const source = hasEditedXProfile(xState.xData) ? xState.xData : fallback;
            const name = safeText(source.name, fallback.name || defaultProfile.name);

            return {
                name,
                handle: makeHandle(name, source.handle || fallback.handle),
                bio: safeText(source.bio || source.signature, fallback.bio || defaultProfile.bio),
                persona: safeText(source.persona, fallback.persona || ''),
                avatar: safeText(source.avatar || source.avatarUrl, fallback.avatar || ''),
                banner: safeText(source.banner || source.bannerUrl, fallback.banner || '')
            };
        }

        function setAvatarNode(node, profile) {
            if (!node) return;
            const name = safeText(profile.name, 'User');
            const initial = name.slice(0, 1).toUpperCase();
            if (profile.avatar) {
                node.innerHTML = `<img src="${escapeHtml(profile.avatar)}" alt="">`;
            } else {
                node.textContent = initial;
            }
        }

        function renderProfile() {
            currentProfile = resolveProfile();
            const nameEl = document.getElementById('x-profile-name');
            const handleEl = document.getElementById('x-profile-handle');
            const bioEl = document.getElementById('x-profile-bio');
            const coverEl = document.getElementById('x-profile-cover');
            const postNameEl = document.getElementById('x-profile-post-name');
            const postHandleEl = document.getElementById('x-profile-post-handle');

            if (nameEl) nameEl.textContent = currentProfile.name;
            if (handleEl) handleEl.textContent = currentProfile.handle;
            if (bioEl) bioEl.textContent = currentProfile.bio;
            if (postNameEl) postNameEl.textContent = currentProfile.name;
            if (postHandleEl) postHandleEl.textContent = `${currentProfile.handle} · pinned`;
            if (coverEl) {
                coverEl.style.backgroundImage = currentProfile.banner
                    ? `linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.34)), url("${currentProfile.banner}")`
                    : '';
            }

            setAvatarNode(document.getElementById('x-profile-avatar'), currentProfile);
            setAvatarNode(document.getElementById('x-profile-post-avatar'), currentProfile);

            postData.profile.avatar = currentProfile.avatar || currentProfile.name.slice(0, 1).toUpperCase();
            postData.profile.name = currentProfile.name;
            postData.profile.handle = `${currentProfile.handle} · pinned`;
        }

        function renderImagePreview(button, src, fallbackText) {
            if (!button) return;
            if (src) {
                button.innerHTML = `<img src="${escapeHtml(src)}" alt="">`;
            } else {
                button.innerHTML = `<span>${escapeHtml(fallbackText)}</span>`;
            }
        }

        function openEditProfile() {
            currentProfile = resolveProfile();
            avatarDraft = currentProfile.avatar || '';
            bannerDraft = currentProfile.banner || '';
            if (editNameInput) editNameInput.value = currentProfile.name;
            if (editHandleInput) editHandleInput.value = currentProfile.handle;
            if (editBioInput) editBioInput.value = currentProfile.bio;
            if (editPersonaInput) editPersonaInput.value = currentProfile.persona;
            renderImagePreview(editAvatarPreview, avatarDraft, currentProfile.name.slice(0, 1).toUpperCase());
            renderImagePreview(editBannerPreview, bannerDraft, 'Cover');
            if (typeof window.openView === 'function') window.openView(editSheet);
            else editSheet?.classList.add('active');
        }

        function closeEditProfile() {
            if (typeof window.closeView === 'function') window.closeView(editSheet);
            else editSheet?.classList.remove('active');
        }

        function saveProfile() {
            const name = safeText(editNameInput?.value, defaultProfile.name);
            const nextProfile = {
                name,
                handle: makeHandle(name, editHandleInput?.value || currentProfile.handle),
                bio: safeText(editBioInput?.value, defaultProfile.bio),
                persona: safeText(editPersonaInput?.value),
                avatar: avatarDraft,
                banner: bannerDraft,
                edited: true,
                updatedAt: new Date().toISOString()
            };
            const previous = getXState();
            saveXState({
                ...previous,
                xData: {
                    ...previous.xData,
                    ...nextProfile
                }
            });

            currentProfile = nextProfile;
            renderProfile();
            closeEditProfile();
        }

        function renderWorldBookSummary() {
            const countEl = document.getElementById('x-worldbook-count');
            const selected = getXState().boundWorldBookIds || [];
            if (countEl) countEl.textContent = `${selected.length} selected`;
        }

        function openXSettings() {
            renderWorldBookSummary();
            if (typeof window.openView === 'function') window.openView(settingsSheet);
            else settingsSheet?.classList.add('active');
        }

        function closeXSettings() {
            if (typeof window.closeView === 'function') window.closeView(settingsSheet);
            else settingsSheet?.classList.remove('active');
        }

        function openWorldBookSelector() {
            const currentState = getXState();
            const selectedIds = currentState.boundWorldBookIds || [];
            if (typeof window.renderWorldBookSelector !== 'function') {
                if (typeof window.showToast === 'function') window.showToast('世界书选择器不可用');
                return;
            }
            window.renderWorldBookSelector(selectedIds, (nextIds) => {
                saveXState({
                    ...getXState(),
                    boundWorldBookIds: Array.isArray(nextIds) ? nextIds.map(String) : []
                });
                renderWorldBookSummary();
            });
        }

        function openComposer() {
            if (composeTextInput) composeTextInput.value = '';
            if (typeof window.openView === 'function') window.openView(composeSheet);
            else composeSheet?.classList.add('active');
        }

        function closeComposer() {
            if (typeof window.closeView === 'function') window.closeView(composeSheet);
            else composeSheet?.classList.remove('active');
        }

        function submitComposer() {
            const text = safeText(composeTextInput?.value, '新帖子草稿');
            tempPostCounter += 1;
            const id = `temp-${Date.now()}-${tempPostCounter}`;
            postData[id] = {
                avatar: currentProfile.avatar || currentProfile.name.slice(0, 1).toUpperCase(),
                name: currentProfile.name,
                handle: `${currentProfile.handle} · now`,
                text,
                reposts: '0',
                likes: '0',
                comments: '0',
                commentList: [
                    { avatar: 'X', name: 'X App', handle: '@xapp · now', text: '这是本地临时发布的帖子。' }
                ]
            };
            const recommendPanel = view.querySelector('.x-feed-panel[data-feed-panel="recommend"]');
            if (recommendPanel) {
                clearHomeEmptyState(recommendPanel);
                const card = document.createElement('article');
                card.className = 'x-feed-card';
                card.setAttribute('data-post-id', id);
                card.setAttribute('tabindex', '0');
                card.innerHTML = `
                    <div class="x-feed-avatar x-avatar">${currentProfile.avatar ? `<img src="${escapeHtml(currentProfile.avatar)}" alt="">` : escapeHtml(currentProfile.name.slice(0, 1).toUpperCase())}</div>
                    <div class="x-feed-body">
                        <div class="x-feed-meta">
                            <strong>${escapeHtml(currentProfile.name)}</strong>
                            <span>${escapeHtml(currentProfile.handle)} · now</span>
                        </div>
                        <p>${escapeHtml(text)}</p>
                        <div class="x-feed-actions">
                            <span><i class="far fa-comment"></i> 0</span>
                            <span><i class="fas fa-retweet"></i> 0</span>
                            <span><i class="far fa-heart"></i> 0</span>
                            <span><i class="far fa-share-square"></i></span>
                        </div>
                    </div>
                `;
                bindPostCard(card);
                recommendPanel.prepend(card);
            }
            closeComposer();
        }

        function ensureCommentDepth(post) {
            const comments = Array.isArray(post.commentList) ? post.commentList : [];
            post.commentList = comments;
            post.comments = formatCompactCount(Math.max(parseCompactCount(post.comments), comments.length));
            return post;
        }

        function registerGeneratedPosts(posts = []) {
            posts.forEach((post) => {
                postData[post.id] = ensureCommentDepth(post);
                if (post.refPost) {
                    postData[post.refPost.id] = ensureCommentDepth(post.refPost);
                }
            });
        }

        function clearDefaultHomeFeedContent() {
            ['island', 'super', 'following'].forEach((postId) => {
                view.querySelectorAll(`.x-feed-card[data-post-id="${postId}"]`).forEach((card) => card.remove());
            });
        }

        function clearHomeEmptyState(panel) {
            panel?.querySelectorAll('.x-home-empty-state').forEach((node) => node.remove());
        }

        function renderHomeEmptyStates() {
            view.querySelectorAll('#x-home-tab .x-feed-panel').forEach((panel) => {
                clearHomeEmptyState(panel);
                if (!panel.querySelector('.x-feed-card')) {
                    panel.innerHTML = '<div class="x-empty-state x-home-empty-state">暂无内容，点击搜索生成帖子。</div>';
                }
            });
        }

        function buildFeedCardHtml(post) {
            let textHtml = escapeHtml(post.text);
            if (post.topicTag) {
                 textHtml = textHtml.replace(new RegExp(`(${escapeHtml(post.topicTag)})`, 'g'), '<span style="color: #1d9bf0;">$1</span>');
            }
            return `
                <div class="x-feed-avatar x-avatar">${buildAvatarHtml(post.avatar, post.name)}</div>
                <div class="x-feed-body">
                    <div class="x-feed-meta">
                        <strong>${escapeHtml(post.name)}</strong>
                        <span>${escapeHtml(post.handle)} · now</span>
                    </div>
                    <p>${textHtml}</p>
                    ${renderPostImages(getPostImages(post))}
                    <div class="x-feed-actions">
                        <span><i class="far fa-comment"></i> ${escapeHtml(post.comments || '0')}</span>
                        <span><i class="fas fa-retweet"></i> ${escapeHtml(post.reposts || '0')}</span>
                        <span><i class="far fa-heart"></i> ${escapeHtml(post.likes || '0')}</span>
                        <span><i class="far fa-share-square"></i></span>
                    </div>
                </div>
            `;
        }

        function renderGeneratedPosts() {
            const recommendPanel = view.querySelector('.x-feed-panel[data-feed-panel="recommend"]');
            if (!recommendPanel) return;
            clearDefaultHomeFeedContent();
            clearHomeEmptyState(recommendPanel);
            recommendPanel.querySelectorAll('.x-generated-feed-card').forEach((card) => card.remove());
            const posts = (getXState().xGeneratedPosts || [])
                .map((post, index) => normalizeGeneratedPost(post, index))
                .filter(Boolean)
                .map((post) => ensureCommentDepth(post));
            registerGeneratedPosts(posts);
            posts.slice().reverse().forEach((post) => {
                if (post.isMoment) return;
                clearHomeEmptyState(recommendPanel);
                const card = document.createElement('article');
                card.className = 'x-feed-card x-generated-feed-card';
                card.setAttribute('data-post-id', post.id);
                card.setAttribute('tabindex', '0');
                card.innerHTML = buildFeedCardHtml(post);
                bindPostCard(card);
                recommendPanel.prepend(card);
                updatePostCountNodes(post.id, getPostThread(post.id));
            });
            renderHomeEmptyStates();
        }

        function renderTopicFeed(topic) {
            if (!topicFeedPanel) return;
            topicFeedPanel.innerHTML = '';
            const posts = (getXState().xGeneratedPosts || [])
                .filter(p => p.topicTag === topic)
                .map((post, index) => normalizeGeneratedPost(post, index))
                .filter(Boolean)
                .map((post) => ensureCommentDepth(post));
            
            if (posts.length === 0) {
                topicFeedPanel.innerHTML = '<div class="x-empty-state">暂无帖子，点击右上角生成</div>';
                return;
            }

            posts.slice().reverse().forEach((post, index, arr) => {
                const realIndex = arr.length - 1 - index;
                const card = document.createElement('article');
                card.className = 'x-feed-card x-generated-feed-card';
                if (realIndex >= 10) {
                    card.style.display = 'none';
                    card.classList.add('x-hidden-page-2');
                }
                card.setAttribute('data-post-id', post.id);
                card.setAttribute('tabindex', '0');
                card.innerHTML = buildFeedCardHtml(post);
                bindPostCard(card);
                topicFeedPanel.prepend(card);
                updatePostCountNodes(post.id, getPostThread(post.id));
            });
        }

        function openTopicDetail(topicText) {
            currentTopicContext = topicText;
            if (topicDetailHeadline) topicDetailHeadline.textContent = topicText;
            renderTopicFeed(topicText);
            topicDetailView?.classList.add('active');
            topicDetailView?.setAttribute('aria-hidden', 'false');
        }

        function closeTopicDetail() {
            if (topicDetailView?.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            topicDetailView?.classList.remove('active');
            topicDetailView?.setAttribute('aria-hidden', 'true');
            currentTopicContext = null;
        }

        async function generateTopicPosts() {
            if (!currentTopicContext || !topicDetailGenerateBtn) return;
            const topic = currentTopicContext;
            topicDetailGenerateBtn.classList.add('loading');
            topicDetailGenerateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            try {
                const worldbook = getSelectedWorldBookContext(`${topic} ${currentProfile.persona} ${currentProfile.bio}`);
                const prompt = `Return strict JSON only. Generate 1 to 3 X/Twitter style posts for the user's feed specifically about the topic: "${topic}".
Important: Every post text MUST include the exact text "${topic}" within it as a hashtag or text.
Each post must include: authorName, handle, text, likes, reposts, commentsCount, mediaType ("text" or "image"), optional imagePrompt/images, and comments.
Each post must have at least 10 comments. Across each post, replies inside comments must total at least 10.
Images are text placeholders: describe the image content in imagePrompt or images[].text.
ALL text values, including imagePrompt and any text inside the images array describing the picture, MUST be written in Chinese (简体中文). Do not use English for image descriptions.
X user: ${JSON.stringify(currentProfile)}
Current Date: ${getXState().xCurrentDate || defaultDate}
Worldbook:
${worldbook || 'None'}`;
                
                const raw = await requestXChatCompletion([
                    { role: 'system', content: 'You are a JSON generator for a fictional X feed. Output only valid JSON.' },
                    { role: 'user', content: prompt }
                ], { temperature: 0.9 });
                
                const parsed = parseJsonPayload(raw);
                const posts = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.posts) ? parsed.posts : []);
                
                posts.forEach(p => {
                    if (!p.text.includes(topic)) {
                        p.text += ` ${topic}`;
                    }
                    p.topicTag = topic;
                });

                const added = appendGeneratedPosts(posts);
                renderTopicFeed(topic);
                if (typeof window.showToast === 'function') window.showToast(added.length ? `已生成 ${added.length} 条帖子` : '没有生成可用帖子');
            } catch (error) {
                console.error('[X] Generate topic posts failed', error);
                if (typeof window.showToast === 'function') window.showToast('生成失败，请检查 API 配置或返回格式');
            } finally {
                topicDetailGenerateBtn.classList.remove('loading');
                topicDetailGenerateBtn.innerHTML = '<i class="fas fa-magic"></i>';
            }
        }

        function appendGeneratedPosts(rawPosts) {
            const normalized = (Array.isArray(rawPosts) ? rawPosts : [])
                .slice(0, 50)
                .map((post, index) => normalizeGeneratedPost(post, index))
                .filter(Boolean)
                .map((post) => ensureCommentDepth(post));
            if (normalized.length === 0) return [];
            updateXState((draft) => {
                const existingIds = new Set((draft.xGeneratedPosts || []).map((post) => String(post.id)));
                normalized.forEach((post) => {
                    if (!existingIds.has(String(post.id))) draft.xGeneratedPosts.unshift(post);
                });
                
                const topicCounts = {};
                draft.xGeneratedPosts = draft.xGeneratedPosts.filter(post => {
                    if (!post.topicTag) return true;
                    topicCounts[post.topicTag] = (topicCounts[post.topicTag] || 0) + 1;
                    return topicCounts[post.topicTag] <= 20;
                });
            });
            renderGeneratedPosts();
            return normalized;
        }

        function renderSuperFollowBar() {
            const listEl = document.getElementById('x-super-follow-list');
            const countEl = document.getElementById('x-super-follow-count');
            if (!listEl) return;
            const topics = (getXState().xTopics || []).filter(Boolean);
            if (countEl) countEl.textContent = `${topics.length} followed`;
            if (topics.length === 0) {
                listEl.innerHTML = '<div class="x-super-empty-follow">暂无关注</div>';
                return;
            }
            listEl.innerHTML = topics.map((topic) => {
                const name = safeText(topic.name || topic.title, '超话');
                const avatar = safeText(topic.avatar || topic.icon, name.slice(0, 1));
                const avatarHtml = avatar.startsWith('data:') || avatar.startsWith('http')
                    ? `<img src="${escapeHtml(avatar)}" alt="">`
                    : escapeHtml(avatar.slice(0, 1));
                return `
                    <div class="x-super-follow-item" data-topic-id="${escapeHtml(topic.id || name)}">
                        <div class="x-super-follow-avatar">${avatarHtml}</div>
                        <span>${escapeHtml(name)}</span>
                    </div>
                `;
            }).join('');
            
            // 绑定点击事件，切换下方的超话主页卡片
            listEl.querySelectorAll('.x-super-follow-item').forEach(item => {
                item.addEventListener('click', () => {
                    const topicId = item.dataset.topicId;
                    const topic = topics.find(t => String(t.id || t.name) === topicId);
                    if (topic) {
                        updateSuperHomeCard(topic);
                    }
                });
            });
            
            // 默认渲染第一个
            if(topics.length > 0) {
                updateSuperHomeCard(topics[0]);
            }
        }
        
        let currentActiveTopicId = null;

        async function generateSuperTopicUpdate() {
            if (!currentActiveTopicId || !superUpdateBtn) return;
            const topics = getXState().xTopics || [];
            const topic = topics.find(t => String(t.id || t.name) === String(currentActiveTopicId));
            if (!topic) return;

            const topicName = topic.name || topic.title || '超话';
            
            let charsInfo = '';
            if (Array.isArray(topic.chars) && topic.chars.length > 0) {
                charsInfo = topic.chars.map(c => `Character Name: ${c.name}, Persona/Bio: ${c.persona || c.bio || 'None'}`).join('\n');
            }

            superUpdateBtn.disabled = true;
            superUpdateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 更新中...';
            
            try {
                const worldbook = getSelectedWorldBookContext(`${topicName} ${charsInfo}`);
                
                const prompt = `Return strict JSON only. You need to generate an update for a celebrity/entertainment "Super Topic" (超话) named "${topicName}" in a Chinese social app similar to Weibo.

Please generate a JSON OBJECT containing the celebrity's online status and an array of 15 to 20 feed items.
The feed items should be a mix of fan posts, photo posts, featured high-quality posts, and moments.

JSON Format Requirements:
{
  "onlineStatus": {
    "isOnline": boolean, // Is the celebrity online right now?
    "lastOnline": "String" // e.g. "刚刚", "10分钟前", "2小时前", "昨天". Empty string "" if isOnline is true.
  },
  "items": [
    // 1. "Posts" (帖子): Fan/entertainment text posts.
    // Format: { "authorName": "", "handle": "", "text": "", "likes": 0, "reposts": 0, "commentsCount": 10, "mediaType": "text", "comments": [ {"authorName": "", "text": ""} ] }

    // 2. "Photos" (图片): Posts containing images. 
    // Format: { "authorName": "", "handle": "", "text": "", "likes": 0, "reposts": 0, "commentsCount": 10, "mediaType": "image", "imagePrompt": "Description of image", "comments": [ {"authorName": "", "text": ""} ] }

    // 3. "Featured" (精选): High-quality hot posts (can be text or image). MUST add "isFeatured": true.
    // Format: { "authorName": "", "handle": "", "text": "", "likes": 5000, "reposts": 1000, "commentsCount": 50, "mediaType": "text|image", "isFeatured": true, "comments": [...] }

    // 4. "Moments" (动态): Celebrity activity logs (名人互动动态). MUST add "isMoment": true.
    // Represents the celebrity interacting with other posts (likes, comments, reposts).
    // Format MUST include: "actionText" (e.g. "点赞了这条帖子", "评论了这条帖子"), and a nested "refPost" object representing the original post they interacted with.
    // Format: { "authorName": "Celebrity Name", "handle": "@celeb", "isMoment": true, "actionText": "点赞了这条帖子", "refPost": { "authorName": "Fan Account", "handle": "@fan", "text": "Post content...", "likes": 200, "commentsCount": 10, "mediaType": "text", "comments": [ {"authorName": "", "text": "", "replies": []} ] } }
  ]
}

CRITICAL REQUIREMENT: EVERY SINGLE POST (including normal feed items AND the nested "refPost" inside moments) MUST contain an array of "comments" with at least 10 valid comment objects. For nested "replies" inside comments, they also count towards the total of 10. If the moment actionText says the celebrity "评论了这条帖子" (commented on this post), YOU MUST include the celebrity's comment directly inside the refPost's "comments" array!

Ensure the "items" array has at least 3 items with "isFeatured": true, at least 3 items with "mediaType": "image", and at least 3 items with "isMoment": true.
ALL text values, including imagePrompt and any text inside the images array describing the picture, MUST be written in Chinese (简体中文). Do not use English for image descriptions.

Topic Name: ${topicName}
Topic Characters Info:
${charsInfo || 'None'}
Current Date: ${getXState().xCurrentDate || defaultDate}
Worldbook context:
${worldbook || 'None'}
`;
                
                const raw = await requestXChatCompletion([
                    { role: 'system', content: 'You are a JSON generator for a fictional social feed. Output only valid JSON object with onlineStatus and items array.' },
                    { role: 'user', content: prompt }
                ], { temperature: 0.9 });
                
                const parsed = parseJsonPayload(raw);
                let allItems = [];
                let newOnlineStatus = { isOnline: false, lastOnline: "未知" };

                // Handle Object vs Array Fallback
                if (Array.isArray(parsed)) {
                    allItems = parsed;
                } else if (parsed && typeof parsed === 'object') {
                    if (parsed.onlineStatus) {
                        newOnlineStatus = {
                            isOnline: !!parsed.onlineStatus.isOnline,
                            lastOnline: parsed.onlineStatus.lastOnline || ""
                        };
                    }
                    if (Array.isArray(parsed.items)) allItems = allItems.concat(parsed.items);
                    if (Array.isArray(parsed.posts)) allItems = allItems.concat(parsed.posts);
                    if (Array.isArray(parsed.moments)) {
                        parsed.moments.forEach(m => m.isMoment = true);
                        allItems = allItems.concat(parsed.moments);
                    }
                }
                
                // Update topic online status in state
                updateXState(draft => {
                    const t = (draft.xTopics || []).find(x => String(x.id || x.name) === String(currentActiveTopicId));
                    if (t) {
                        t.onlineStatus = newOnlineStatus;
                    }
                });

                allItems.forEach(p => {
                    p.topicTag = topicName;
                });

                // Update the local object for immediate UI rendering
                topic.onlineStatus = newOnlineStatus;
                
                const added = appendGeneratedPosts(allItems);
                renderSuperTopicFeed(topic);
                
                if (typeof window.showToast === 'function') {
                    window.showToast(`超话已更新，生成 ${added.length} 条内容`);
                }
            } catch (error) {
                console.error('[X] Generate super topic update failed', error);
                if (typeof window.showToast === 'function') window.showToast('更新失败，请检查 API 配置');
            } finally {
                superUpdateBtn.disabled = false;
                superUpdateBtn.innerHTML = '<i class="fas fa-sync"></i> 更新';
            }
        }

        function renderSuperTopicFeed(topic) {
            if (!topic) return;
            const topicName = topic.name || topic.title || '';
            const featuredPanel = view.querySelector('.x-super-feed[data-super-panel="featured"]');
            const postsPanel = view.querySelector('.x-super-feed[data-super-panel="posts"]');
            const photosPanel = view.querySelector('.x-super-feed[data-super-panel="photos"]');
            const momentsPanel = view.querySelector('.x-super-feed[data-super-panel="moments"]');
            
            const posts = (getXState().xGeneratedPosts || [])
                .filter(p => p.topicTag === topicName)
                .map((post, index) => normalizeGeneratedPost(post, index))
                .filter(Boolean)
                .map((post) => ensureCommentDepth(post));
            
            if (featuredPanel) featuredPanel.innerHTML = '';
            if (postsPanel) postsPanel.innerHTML = '';
            if (photosPanel) photosPanel.innerHTML = '';
            if (momentsPanel) momentsPanel.innerHTML = '';
            
            // Handle Top Online Status for Moments Panel
            let momentsOnlineHeaderHtml = '';
            if (topic.onlineStatus) {
                const status = topic.onlineStatus;
                if (status.isOnline) {
                    momentsOnlineHeaderHtml = `
                        <div class="x-online-status-banner online">
                            <div class="x-online-indicator online"></div>
                            <span class="x-online-text online">明星当前在线</span>
                        </div>
                    `;
                } else if (status.lastOnline) {
                    momentsOnlineHeaderHtml = `
                        <div class="x-online-status-banner offline">
                            <div class="x-online-indicator offline"></div>
                            <span class="x-online-text offline">离线 · 上次在线：${escapeHtml(status.lastOnline)}</span>
                        </div>
                    `;
                }
            }

            if (posts.length === 0) {
                if (featuredPanel) featuredPanel.innerHTML = '<div class="x-empty-state">暂无精选，点击更新获取内容</div>';
                if (postsPanel) postsPanel.innerHTML = '<div class="x-empty-state">暂无帖子</div>';
                if (photosPanel) photosPanel.innerHTML = '<div class="x-empty-state">暂无图片</div>';
                if (momentsPanel) {
                    momentsPanel.innerHTML = momentsOnlineHeaderHtml + '<div class="x-empty-state">暂无动态</div>';
                }
                return;
            }

            if (momentsPanel && momentsOnlineHeaderHtml) {
                momentsPanel.innerHTML = momentsOnlineHeaderHtml; // Insert header first
            }

            posts.slice().reverse().forEach((post, index, arr) => {
                const realIndex = arr.length - 1 - index;
                const card = document.createElement('article');
                card.className = 'x-feed-card x-generated-feed-card';
                if (realIndex >= 10) {
                    card.style.display = 'none';
                    card.classList.add('x-hidden-page-2');
                }
                card.setAttribute('data-post-id', post.id);
                card.setAttribute('tabindex', '0');
                
                if (post.isMoment) {
                    card.classList.add('is-moment');
                    const actionText = safeText(post.actionText, '更新了动态');
                    const refHtml = post.refPost ? `
                        <div class="x-ref-post" data-ref-id="${escapeHtml(post.refPost.id)}">
                            <div class="x-feed-meta">
                                <strong>${escapeHtml(post.refPost.name)}</strong>
                                <span>${escapeHtml(post.refPost.handle)}</span>
                            </div>
                            <p>${escapeHtml(post.refPost.text)}</p>
                        </div>
                    ` : `<p>${escapeHtml(post.text)}</p>`;

                    card.innerHTML = `
                        <div class="x-feed-body" style="margin-left: 0;">
                            <div class="x-moment-action">
                                <div class="x-avatar" style="width:24px;height:24px;font-size:10px;">${buildAvatarHtml(post.avatar, post.name)}</div>
                                <span>${escapeHtml(post.name)} ${escapeHtml(actionText)}</span>
                            </div>
                            ${refHtml}
                        </div>
                    `;
                    if (momentsPanel) {
                        const existingHeader = momentsPanel.querySelector('.x-online-status-banner');
                        if (existingHeader) {
                            existingHeader.insertAdjacentElement('afterend', card.cloneNode(true));
                        } else {
                            momentsPanel.prepend(card.cloneNode(true));
                        }
                    }
                } else {
                    card.innerHTML = buildFeedCardHtml(post);
                    
                    if (postsPanel) postsPanel.prepend(card.cloneNode(true));
                    if (post.isFeatured && featuredPanel) {
                        featuredPanel.prepend(card.cloneNode(true));
                    }
                }
                
                // Bind all cloned cards
                const addedCards = view.querySelectorAll(`.x-feed-card[data-post-id="${post.id}"]`);
                addedCards.forEach(c => bindPostCard(c));
                updatePostCountNodes(post.id, getPostThread(post.id));
            });

            // Handle photos panel as a grid
            if (photosPanel) {
                const allImages = posts.flatMap(post => {
                    if (post.isMoment) return [];
                    return getPostImages(post).map(img => ({ ...img, postId: post.id }));
                });

                if (allImages.length === 0) {
                    photosPanel.innerHTML = '<div class="x-empty-state">暂无图片</div>';
                } else {
                    photosPanel.innerHTML = `<div class="x-super-post-grid">
                        ${allImages.map((img, i) => `
                            <div class="x-post-image-thumb ${i >= 12 ? 'x-hidden-page-2' : ''}" style="${i >= 12 ? 'display:none;' : ''}" data-image-text="${escapeHtml(img.text || 'Image')}" data-image-url="${escapeHtml(img.url || '')}" data-post-id="${img.postId}">
                                <img src="${escapeHtml(img.url || generatedImagePlaceholderUrl)}" alt="">
                            </div>
                        `).join('')}
                    </div>`;
                    
                    // Bind click for images in photo grid
                    photosPanel.querySelectorAll('.x-post-image-thumb').forEach(thumb => {
                        thumb.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openImagePreview(thumb.dataset.imageText || 'Image', thumb.dataset.imageUrl || '');
                        });
                    });
                }
            }

            if (featuredPanel && featuredPanel.children.length === 0) featuredPanel.innerHTML = '<div class="x-empty-state">暂无精选内容</div>';
            if (postsPanel && postsPanel.children.length === 0) postsPanel.innerHTML = '<div class="x-empty-state">暂无帖子</div>';
            
            // Check Moments emptiness safely (considering the online header might be the only child)
            if (momentsPanel) {
                const hasCards = momentsPanel.querySelector('.x-feed-card');
                if (!hasCards) {
                    momentsPanel.insertAdjacentHTML('beforeend', '<div class="x-empty-state">暂无动态</div>');
                }
            }
        }

        function updateSuperHomeCard(topic) {
            currentActiveTopicId = topic.id || topic.name;
            const coverEl = document.querySelector('.x-super-cover');
            const avatarEl = document.querySelector('.x-super-topic-avatar');
            const titleEl = document.querySelector('.x-super-title-row h3');
            const statEl = document.querySelector('.x-super-title-row span');
            const signBtn = document.querySelector('.x-super-title-row button');
            
            if (coverEl) {
                if (topic.banner) {
                    coverEl.style.backgroundImage = `url(${topic.banner})`;
                    coverEl.innerHTML = '';
                } else {
                    coverEl.style.backgroundImage = '';
                    coverEl.innerHTML = '<div class="x-super-cover-mark">#</div>';
                }
            }
            
            if (avatarEl) {
                const avatar = safeText(topic.avatar || topic.icon, safeText(topic.name || topic.title, '超').slice(0, 1));
                if (avatar.startsWith('data:') || avatar.startsWith('http')) {
                    avatarEl.innerHTML = `<img src="${escapeHtml(avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`;
                } else {
                    avatarEl.textContent = avatar;
                }
            }
            
            if (titleEl) {
                titleEl.textContent = safeText(topic.name || topic.title, '超话');
            }

            if (statEl) {
                const signDays = topic.signDays || 0;
                const fans = safeText(topic.fans, '0');
                statEl.textContent = `超话 · ${fans} 粉丝 · 连续签到 ${signDays} 天`;
            }

            if (signBtn) {
                const currentDate = getXState().xCurrentDate || new Date().toISOString().split('T')[0];
                if (topic.lastSignDate === currentDate) {
                    signBtn.textContent = '已签到';
                    signBtn.disabled = true;
                    signBtn.style.opacity = '0.5';
                    signBtn.style.cursor = 'default';
                } else {
                    signBtn.textContent = '签到';
                    signBtn.disabled = false;
                    signBtn.style.opacity = '1';
                    signBtn.style.cursor = 'pointer';
                }
            }
            renderSuperTopicFeed(topic);
        }

        function handleTopicSign(topicId) {
            const currentDate = getXState().xCurrentDate || new Date().toISOString().split('T')[0];
            
            updateXState(draft => {
                const topic = (draft.xTopics || []).find(t => String(t.id || t.name) === String(topicId));
                if (topic) {
                    if (topic.lastSignDate !== currentDate) {
                        topic.signDays = (topic.signDays || 0) + 1;
                        topic.lastSignDate = currentDate;
                    }
                }
            });

            const topics = getXState().xTopics || [];
            const topic = topics.find(t => String(t.id || t.name) === String(topicId));
            if (topic) {
                updateSuperHomeCard(topic);
                if (typeof window.showToast === 'function') {
                    window.showToast(`签到成功！已连续签到 ${topic.signDays} 天`);
                }
            }
        }

        // --- Create Topic Logic ---
        function openCreateTopicSheet() {
            createTopicAvatarDraft = '';
            createTopicBannerDraft = '';
            createTopicSelectedChars = [];
            
            if (createTopicNameInput) createTopicNameInput.value = '';
            if (createTopicFansInput) createTopicFansInput.value = '';
            renderImagePreview(createTopicAvatarPreview, '', '超');
            renderImagePreview(createTopicBannerPreview, '', 'Cover');
            renderCreateTopicSelectedChars();
            
            if (createTopicImessageContainer) createTopicImessageContainer.style.display = 'none';
            if (createTopicManualContainer) createTopicManualContainer.style.display = 'none';

            if (typeof window.openView === 'function') window.openView(createTopicSheet);
            else createTopicSheet?.classList.add('active');
        }

        function closeCreateTopicSheet() {
            if (typeof window.closeView === 'function') window.closeView(createTopicSheet);
            else createTopicSheet?.classList.remove('active');
        }

        function saveTopic() {
            const name = safeText(createTopicNameInput?.value);
            const fans = safeText(createTopicFansInput?.value, '0');
            if (!name) {
                if (typeof window.showToast === 'function') window.showToast('请输入超话名字');
                return;
            }
            
            const newTopic = {
                id: makeLocalId('topic'),
                name: name,
                fans: fans,
                avatar: createTopicAvatarDraft,
                banner: createTopicBannerDraft,
                chars: createTopicSelectedChars,
                createdAt: Date.now()
            };
            
            updateXState(draft => {
                draft.xTopics = draft.xTopics || [];
                draft.xTopics.unshift(newTopic);
            });
            
            renderSuperFollowBar();
            closeCreateTopicSheet();
            if (typeof window.showToast === 'function') window.showToast('超话创建成功');
        }

        async function toggleTopicImportImessage() {
            if (createTopicManualContainer) createTopicManualContainer.style.display = 'none';
            if (!createTopicImessageContainer) return;
            
            if (createTopicImessageContainer.style.display === 'flex') {
                createTopicImessageContainer.style.display = 'none';
            } else {
                createTopicImessageContainer.style.display = 'flex';
                createTopicImessageContainer.innerHTML = '<div style="text-align:center; padding: 10px;">加载中...</div>';
                const chars = await loadImessageChars();
                if (chars.length === 0) {
                    createTopicImessageContainer.innerHTML = '<div style="text-align:center; padding: 10px;">未找到可导入的角色</div>';
                    return;
                }
                
                createTopicImessageContainer.innerHTML = chars.map(char => {
                    const item = normalizeDmChar(char, 'imessage');
                    return `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid #eee;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="width:30px; height:30px; border-radius:50%; overflow:hidden; background:#eee; display:flex; justify-content:center; align-items:center;">
                                    ${buildAvatarHtml(item.avatar, item.name)}
                                </div>
                                <span>${escapeHtml(item.name)}</span>
                            </div>
                            <button type="button" data-char-id="${item.id}" class="x-topic-pick-char-btn" style="padding:4px 10px; border-radius:4px; border:1px solid #ccc; background:#fff; cursor:pointer;">添加</button>
                        </div>
                    `;
                }).join('');
                
                createTopicImessageContainer.querySelectorAll('.x-topic-pick-char-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const charId = btn.dataset.charId;
                        const char = chars.find(c => String(c.id) === String(charId));
                        if (char) {
                            const normalized = normalizeDmChar(char, 'imessage');
                            if (!createTopicSelectedChars.find(c => c.id === normalized.id)) {
                                createTopicSelectedChars.push(normalized);
                                renderCreateTopicSelectedChars();
                                if (typeof window.showToast === 'function') window.showToast('已添加角色');
                            } else {
                                if (typeof window.showToast === 'function') window.showToast('该角色已添加');
                            }
                        }
                    });
                });
            }
        }

        function toggleTopicManualChar() {
            if (createTopicImessageContainer) createTopicImessageContainer.style.display = 'none';
            if (!createTopicManualContainer) return;
            
            if (createTopicManualContainer.style.display === 'flex') {
                createTopicManualContainer.style.display = 'none';
            } else {
                createTopicManualContainer.style.display = 'flex';
            }
        }

        function saveTopicManualChar() {
            const nameInput = document.getElementById('x-topic-manual-name');
            const handleInput = document.getElementById('x-topic-manual-handle');
            const bioInput = document.getElementById('x-topic-manual-bio');
            const personaInput = document.getElementById('x-topic-manual-persona');
            
            const name = safeText(nameInput?.value);
            if (!name) {
                if (typeof window.showToast === 'function') window.showToast('请输入角色名称');
                return;
            }
            
            const newChar = {
                id: makeLocalId('manual-char'),
                origin: 'manual',
                name: name,
                handle: makeHandle(name, handleInput?.value),
                bio: safeText(bioInput?.value),
                persona: safeText(personaInput?.value),
                avatar: ''
            };
            
            createTopicSelectedChars.push(newChar);
            renderCreateTopicSelectedChars();
            
            if (nameInput) nameInput.value = '';
            if (handleInput) handleInput.value = '';
            if (bioInput) bioInput.value = '';
            if (personaInput) personaInput.value = '';
            
            if (typeof window.showToast === 'function') window.showToast('已添加角色');
        }

        function renderCreateTopicSelectedChars() {
            if (!createTopicCharsList) return;
            if (createTopicSelectedChars.length === 0) {
                createTopicCharsList.innerHTML = '<div style="color: #888; font-size: 13px;">暂未添加任何角色</div>';
                return;
            }
            createTopicCharsList.innerHTML = createTopicSelectedChars.map((char, index) => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f0f0f0; padding:8px 12px; border-radius:8px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:24px; height:24px; border-radius:50%; overflow:hidden; background:#ccc; display:flex; justify-content:center; align-items:center; font-size:12px;">
                            ${buildAvatarHtml(char.avatar, char.name)}
                        </div>
                        <span style="font-weight:bold;">${escapeHtml(char.name)}</span>
                    </div>
                    <i class="fas fa-times x-topic-remove-char" data-index="${index}" style="color:#ff3b30; cursor:pointer;"></i>
                </div>
            `).join('');
            
            createTopicCharsList.querySelectorAll('.x-topic-remove-char').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.index, 10);
                    if (!isNaN(idx)) {
                        createTopicSelectedChars.splice(idx, 1);
                        renderCreateTopicSelectedChars();
                    }
                });
            });
        }

        function getBaseThread(postId) {
            const post = postData[postId] || postData.island;
            return {
                likes: parseCompactCount(post.likes),
                reposts: parseCompactCount(post.reposts),
                commentsCount: parseCompactCount(post.comments),
                liked: false,
                reposted: false,
                comments: (Array.isArray(post.commentList) ? post.commentList : []).map((comment, index) => ({
                    id: comment.id || `${postId}-comment-${index}`,
                    avatar: comment.avatar || '?',
                    name: comment.name || 'User',
                    handle: comment.handle || '@user',
                    text: comment.text || '',
                    replies: Array.isArray(comment.replies) ? comment.replies : []
                }))
            };
        }

        function getPostThread(postId) {
            const base = getBaseThread(postId);
            const saved = getXState().xPostThreads?.[postId];
            if (!saved || typeof saved !== 'object') return base;
            return {
                ...base,
                ...saved,
                comments: Array.isArray(saved.comments) ? saved.comments : base.comments,
                likes: Number.isFinite(Number(saved.likes)) ? Number(saved.likes) : base.likes,
                reposts: Number.isFinite(Number(saved.reposts)) ? Number(saved.reposts) : base.reposts,
                commentsCount: Number.isFinite(Number(saved.commentsCount)) ? Number(saved.commentsCount) : base.commentsCount,
                liked: !!saved.liked,
                reposted: !!saved.reposted
            };
        }

        function savePostThread(postId, thread) {
            updateXState((draft) => {
                draft.xPostThreads[postId] = thread;
            });
        }

        function escapeCssIdent(value) {
            if (window.CSS && typeof window.CSS.escape === 'function') return CSS.escape(String(value));
            return String(value).replace(/["\\]/g, '\\$&');
        }

        function updatePostCountNodes(postId, thread) {
            const post = postData[postId];
            if (post) {
                post.likes = formatCompactCount(thread.likes);
                post.reposts = formatCompactCount(thread.reposts);
                post.comments = formatCompactCount(thread.commentsCount);
            }
            const card = view.querySelector(`.x-feed-card[data-post-id="${escapeCssIdent(postId)}"]`);
            const actionSpans = card ? Array.from(card.querySelectorAll('.x-feed-actions span')) : [];
            if (actionSpans[0]) actionSpans[0].innerHTML = `<i class="far fa-comment"></i> ${escapeHtml(formatCompactCount(thread.commentsCount))}`;
            if (actionSpans[1]) {
                actionSpans[1].classList.toggle('active', !!thread.reposted);
                actionSpans[1].innerHTML = `<i class="fas fa-retweet"></i> ${escapeHtml(formatCompactCount(thread.reposts))}`;
            }
            if (actionSpans[2]) {
                actionSpans[2].classList.toggle('active', !!thread.liked);
                actionSpans[2].innerHTML = `<i class="${thread.liked ? 'fas' : 'far'} fa-heart"></i> ${escapeHtml(formatCompactCount(thread.likes))}`;
            }
        }

        function renderDetailActions(thread) {
            const repostBtn = document.getElementById('x-detail-repost-btn');
            const likeBtn = document.getElementById('x-detail-like-btn');
            repostBtn?.classList.toggle('active', !!thread.reposted);
            likeBtn?.classList.toggle('active', !!thread.liked);
            const likeIcon = likeBtn?.querySelector('i');
            if (likeIcon) likeIcon.className = `${thread.liked ? 'fas' : 'far'} fa-heart`;
        }

        function renderReplyContext() {
            const context = document.getElementById('x-reply-context');
            const textEl = document.getElementById('x-reply-context-text');
            if (!context || !textEl) return;
            if (!replyTarget || !currentDetailPostId) {
                context.hidden = true;
                textEl.textContent = 'Replying to post';
                return;
            }
            context.hidden = false;
            textEl.textContent = `Replying to ${replyTarget.name || 'comment'}`;
        }

        function findCommentById(thread, commentId) {
            return (thread.comments || []).find((comment) => String(comment.id) === String(commentId)) || null;
        }

        function findReplyById(comment, replyId) {
            return (Array.isArray(comment?.replies) ? comment.replies : [])
                .find((reply) => String(reply.id) === String(replyId)) || null;
        }

        function renderCommentsList(postId, thread) {
            const commentsList = document.getElementById('x-comments-list');
            if (!commentsList) return;
            commentsList.innerHTML = thread.comments.map((comment) => {
                const replies = Array.isArray(comment.replies) ? comment.replies : [];
                const repliesHtml = replies.length
                    ? `<div class="x-comment-replies">${replies.map((reply) => `
                        <div class="x-comment-reply" data-comment-id="${escapeHtml(comment.id)}" data-reply-id="${escapeHtml(reply.id)}">
                            <div class="x-avatar">${buildAvatarHtml(reply.avatar, reply.name)}</div>
                            <div>
                                <strong>${escapeHtml(reply.name)}</strong>
                                <span>${escapeHtml(reply.handle)}</span>
                                <p>${reply.replyToName ? `<b>回复 @${escapeHtml(reply.replyToName)}</b> ` : ''}${escapeHtml(reply.text)}</p>
                                <button class="x-comment-reply-btn" type="button" data-comment-id="${escapeHtml(comment.id)}" data-reply-id="${escapeHtml(reply.id)}" data-reply-name="${escapeHtml(reply.name)}">Reply</button>
                            </div>
                        </div>
                    `).join('')}</div>`
                    : '';
                return `
                    <div class="x-comment-row" data-comment-id="${escapeHtml(comment.id)}">
                        <div class="x-avatar">${buildAvatarHtml(comment.avatar, comment.name)}</div>
                        <div class="x-comment-main">
                            <strong>${escapeHtml(comment.name)}</strong>
                            <span>${escapeHtml(comment.handle)}</span>
                            <p>${escapeHtml(comment.text)}</p>
                            <button class="x-comment-reply-btn" type="button" data-comment-id="${escapeHtml(comment.id)}">Reply</button>
                            ${repliesHtml}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function setReplyTarget(target = null) {
            if (!target) {
                replyTarget = null;
            } else if (typeof target === 'object') {
                replyTarget = {
                    commentId: String(target.commentId || ''),
                    replyId: target.replyId ? String(target.replyId) : '',
                    name: safeText(target.name, 'comment')
                };
            } else {
                const thread = currentDetailPostId ? getPostThread(currentDetailPostId) : null;
                const comment = thread ? findCommentById(thread, target) : null;
                replyTarget = {
                    commentId: String(target),
                    replyId: '',
                    name: safeText(comment?.name, 'comment')
                };
            }
            renderReplyContext();
            document.getElementById('x-reply-input')?.focus();
        }

        function submitReply() {
            if (!currentDetailPostId) return;
            const input = document.getElementById('x-reply-input');
            const text = safeText(input?.value);
            if (!text) {
                if (typeof window.showToast === 'function') window.showToast('请输入回复内容');
                return;
            }
            const author = getCurrentCommentAuthor();
            const thread = getPostThread(currentDetailPostId);
            let rootCommentId = '';
            let userReply = null;
            let appended = false;
            if (replyTarget?.commentId) {
                const target = findCommentById(thread, replyTarget.commentId);
                if (target) {
                    target.replies = Array.isArray(target.replies) ? target.replies : [];
                    userReply = {
                        id: makeLocalId('reply'),
                        ...author,
                        text,
                        replyToId: replyTarget.replyId || '',
                        replyToName: replyTarget.name || target.name || ''
                    };
                    target.replies.push(userReply);
                    rootCommentId = target.id;
                    appended = true;
                }
            }
            if (!appended) {
                userReply = {
                    id: makeLocalId('comment'),
                    ...author,
                    text,
                    replies: []
                };
                thread.comments.unshift(userReply);
                rootCommentId = userReply.id;
            }
            thread.commentsCount += 1;
            savePostThread(currentDetailPostId, thread);
            updatePostCountNodes(currentDetailPostId, thread);
            if (input) input.value = '';
            setReplyTarget(null);
            openPostDetail(currentDetailPostId);
            if (rootCommentId && userReply) {
                generateUserReplyEngagement(currentDetailPostId, rootCommentId, userReply, appended);
            }
        }

        function normalizeEngagementReply(reply, index = 0, replyTo = {}) {
            const text = safeText(reply?.text || reply?.content);
            const name = safeText(reply?.authorName || reply?.name || reply?.handle);
            if (!text || !name) return null;
            return {
                id: String(reply.id || makeLocalId('auto-reply')),
                avatar: reply.authorAvatar || reply.avatar || name.slice(0, 1).toUpperCase(),
                name,
                handle: makeHandle(name, reply.handle || name),
                text,
                replyToId: replyTo.id || '',
                replyToName: replyTo.name || '',
                replies: []
            };
        }

        function normalizeGeneratedVisitor(visitor, index = 0) {
            const name = safeText(visitor?.name || visitor?.authorName || visitor?.handle);
            if (!name) return null;
            return {
                id: String(visitor.id || makeLocalId('x-visitor')),
                avatar: visitor.avatar || visitor.authorAvatar || name.slice(0, 1).toUpperCase(),
                name,
                handle: makeHandle(name, visitor.handle || name),
                bio: safeText(visitor.bio || visitor.reason || visitor.text),
                time: safeText(visitor.time, 'now'),
                createdAt: Date.now()
            };
        }

        async function generateUserReplyEngagement(postId, rootCommentId, userReply, isNestedReply = false) {
            const post = postData[postId] || {};
            const rootThread = getPostThread(postId);
            const rootComment = findCommentById(rootThread, rootCommentId);
            if (!rootComment || !userReply) return;
            try {
                const prompt = `Return strict JSON only. A user just commented in an X/Twitter-style post detail page. Generate engagement around this user's exact comment.
Output JSON shape:
{
  "replies": [{"authorName":"", "handle":"", "text":""}],
  "visitors": [{"name":"", "handle":"", "bio":"", "avatar":"", "time":"now"}]
}
Rules:
- replies must contain at least 5 items.
- visitors must contain 2 to 5 items.
- Replies must directly respond to the user's comment, not to the whole post in general.
- Keep replies short, social, varied, and realistic. Mix agreement, disagreement, teasing, clarification, and curiosity.
- Visitors are people who visited the user's profile because of this comment; bio should briefly explain the vibe or reason.
- Do not include markdown or extra text.

Post author: ${post.name || ''}
Post text: ${post.text || ''}
Root comment author: ${rootComment.name || ''}
Root comment text: ${rootComment.text || ''}
User display name: ${currentProfile.name} ${currentProfile.handle}
User comment text: ${userReply.text}
User comment type: ${isNestedReply ? 'reply inside a comment thread' : 'top-level comment'}
Current Date: ${getXState().xCurrentDate || defaultDate}`;
                const raw = await requestXChatCompletion([
                    { role: 'system', content: 'You generate strict JSON for social-feed replies and profile visitors.' },
                    { role: 'user', content: prompt }
                ], { temperature: 0.9 });
                const parsed = parseJsonPayload(raw);
                const rawReplies = Array.isArray(parsed?.replies) ? parsed.replies : [];
                const rawVisitors = Array.isArray(parsed?.visitors) ? parsed.visitors : [];
                const replyTo = isNestedReply ? { id: userReply.id, name: userReply.name } : {};
                const generatedReplies = rawReplies
                    .map((reply, index) => normalizeEngagementReply(reply, index, replyTo))
                    .filter(Boolean);
                const visitors = rawVisitors
                    .map((visitor, index) => normalizeGeneratedVisitor(visitor, index))
                    .filter(Boolean);

                if (generatedReplies.length) {
                    const latestThread = getPostThread(postId);
                    const latestRoot = findCommentById(latestThread, rootCommentId);
                    if (latestRoot) {
                        latestRoot.replies = Array.isArray(latestRoot.replies) ? latestRoot.replies : [];
                        const existingIds = new Set(latestRoot.replies.map((reply) => String(reply.id)));
                        generatedReplies.forEach((reply) => {
                            if (!existingIds.has(String(reply.id))) latestRoot.replies.push(reply);
                        });
                        latestThread.commentsCount += generatedReplies.length;
                        savePostThread(postId, latestThread);
                        updatePostCountNodes(postId, latestThread);
                        if (String(currentDetailPostId) === String(postId)) {
                            renderCommentsList(postId, latestThread);
                            const commentsEl = document.getElementById('x-detail-comments');
                            if (commentsEl) commentsEl.textContent = formatCompactCount(latestThread.commentsCount);
                        }
                    }
                }

                if (visitors.length) {
                    updateXState((draft) => {
                        const existingIds = new Set((draft.xVisitors || []).map((visitor) => String(visitor.id)));
                        visitors.slice(0, 5).reverse().forEach((visitor) => {
                            if (!existingIds.has(String(visitor.id))) draft.xVisitors.unshift(visitor);
                        });
                    });
                    renderVisitors();
                }
            } catch (error) {
                console.error('[X] Generate user reply engagement failed', error);
                if (typeof window.showToast === 'function') window.showToast('回复生成失败');
            }
        }

        function toggleDetailAction(kind) {
            if (!currentDetailPostId) return;
            const thread = getPostThread(currentDetailPostId);
            if (kind === 'like') {
                thread.liked = !thread.liked;
                thread.likes += thread.liked ? 1 : -1;
            } else if (kind === 'repost') {
                thread.reposted = !thread.reposted;
                thread.reposts += thread.reposted ? 1 : -1;
            }
            thread.likes = Math.max(0, thread.likes);
            thread.reposts = Math.max(0, thread.reposts);
            savePostThread(currentDetailPostId, thread);
            updatePostCountNodes(currentDetailPostId, thread);
            openPostDetail(currentDetailPostId);
        }

        function normalizeDmMessages(messages) {
            if (!Array.isArray(messages)) return [];
            return messages.map((message) => {
                const source = message?.source || message?.sender;
                return {
                    id: String(message?.id || makeLocalId('dm-msg')),
                    source: source === 'user' ? 'user' : 'char',
                    text: safeText(message?.text || message?.content || message?.message),
                    createdAt: Number(message?.createdAt || message?.timestamp || Date.now())
                };
            }).filter((message) => message.text);
        }

        function getDmLastMessageText(item) {
            const messages = normalizeDmMessages(item?.messages);
            return messages.length ? messages[messages.length - 1].text : safeText(item?.bio, '暂无签名');
        }

        function updateMessageSummary(messages = []) {
            const summaryValues = document.querySelectorAll('#x-messages-tab .x-message-summary strong');
            if (summaryValues[0]) summaryValues[0].textContent = String(messages.length);
            if (summaryValues[1]) summaryValues[1].textContent = '0';
            if (summaryValues[2]) summaryValues[2].textContent = '0';
        }

        function normalizeDmChar(source = {}, origin = 'manual') {
            const name = safeText(source.nickname || source.name || source.realName, 'Char');
            const handleSource = source.handle || source.realName || source.signature || name;
            const avatar = safeText(source.avatarUrl || source.avatar);
            return {
                id: String(source.id || makeLocalId(origin)),
                origin,
                sourceFriendId: source.sourceFriendId || (origin === 'imessage' ? source.id : ''),
                name,
                handle: makeHandle(name, handleSource),
                bio: safeText(source.bio || source.signature, '暂无签名'),
                persona: safeText(source.persona || source.characterPersona || source.systemPrompt),
                avatar: avatar,
                messages: normalizeDmMessages(source.messages),
                addedAt: Number(source.addedAt) || Date.now()
            };
        }

        function addDirectMessageChar(charItem) {
            const item = normalizeDmChar(charItem, charItem.origin || 'manual');
            updateXState((draft) => {
                const existingIndex = draft.xDirectMessages.findIndex((entry) =>
                    String(entry.id) === String(item.id) || safeText(entry.name).toLowerCase() === item.name.toLowerCase()
                );
                if (existingIndex >= 0) {
                    const existing = normalizeDmChar(draft.xDirectMessages[existingIndex], draft.xDirectMessages[existingIndex].origin || item.origin);
                    const merged = {
                        ...existing,
                        ...item,
                        messages: item.messages.length ? item.messages : existing.messages,
                        addedAt: existing.addedAt || item.addedAt
                    };
                    draft.xDirectMessages.splice(existingIndex, 1);
                    draft.xDirectMessages.unshift(merged);
                } else {
                    draft.xDirectMessages.unshift(item);
                }
            });
            renderDirectMessages();
            if (typeof window.showToast === 'function') window.showToast('已添加到 X 私信');
        }

        function renderDirectMessages() {
            if (!dmList) dmList = document.getElementById('x-dm-list') || document.querySelector('#x-messages-tab .x-message-list');
            if (!dmList) return;
            const messages = (getXState().xDirectMessages || [])
                .map((item) => normalizeDmChar(item, item?.origin || 'manual'))
                .sort((a, b) => {
                    const aLast = a.messages[a.messages.length - 1]?.createdAt || a.addedAt || 0;
                    const bLast = b.messages[b.messages.length - 1]?.createdAt || b.addedAt || 0;
                    return bLast - aLast;
                });
            updateMessageSummary(messages);
            if (messages.length === 0) {
                dmList.innerHTML = `
                    <div class="x-empty-state x-dm-empty-state">
                        <strong>暂无私信</strong>
                        <span>添加一个 Char 开始聊天吧</span>
                        <button class="x-add-dm-submit x-empty-add-dm-btn" type="button">添加 Char</button>
                    </div>
                `;
                return;
            }
            dmList.innerHTML = messages.map((item) => `
                <button class="x-message-row x-dm-row" type="button" data-dm-id="${escapeHtml(item.id)}">
                    <div class="x-avatar">${buildAvatarHtml(item.avatar, item.name)}</div>
                    <div>
                        <strong>${escapeHtml(item.name)}</strong>
                        <p>${escapeHtml(getDmLastMessageText(item))}</p>
                    </div>
                    <span>${escapeHtml(item.origin === 'imessage' ? 'iMessage' : 'X')}</span>
                </button>
            `).join('');
        }

        function renderVisitors() {
            if (!visitorsList) visitorsList = document.getElementById('x-visitors-list');
            if (!visitorsList) return;
            const visitors = getXState().xVisitors || [];
            if (visitors.length === 0) {
                visitorsList.innerHTML = '<div class="x-empty-state">暂无主页访客</div>';
                return;
            }
            visitorsList.innerHTML = visitors.map((item) => `
                <div class="x-message-row">
                    <div class="x-avatar">${buildAvatarHtml(item.avatar, item.name)}</div>
                    <div>
                        <strong>${escapeHtml(item.name || 'Visitor')}</strong>
                        <p>${escapeHtml(item.bio || '最近访问了你的主页')}</p>
                    </div>
                    <span>${escapeHtml(item.time || 'now')}</span>
                </div>
            `).join('');
        }

        async function hydrateImessageCharAvatar(friend) {
            if (!friend || typeof friend !== 'object') return friend;
            if (friend.avatarUrl || friend.avatar || !friend.avatarAssetId) return friend;
            if (!window.appStorage || typeof window.appStorage.getAssetUrl !== 'function') return friend;
            try {
                const avatarUrl = await window.appStorage.getAssetUrl(friend.avatarAssetId);
                return avatarUrl ? { ...friend, avatarUrl } : friend;
            } catch (error) {
                console.warn('[X] Failed to hydrate iMessage char avatar', error);
                return friend;
            }
        }

        async function loadImessageChars() {
            const runtimeFriends = Array.isArray(window.imData?.friends) ? window.imData.friends : [];
            if (runtimeFriends.length > 0) {
                return Promise.all(runtimeFriends
                    .filter((friend) => friend?.type === 'char')
                    .map((friend) => hydrateImessageCharAvatar(friend)));
            }
            if (window.imStorage && typeof window.imStorage.loadFriends === 'function') {
                try {
                    const friends = await window.imStorage.loadFriends();
                    return Array.isArray(friends)
                        ? Promise.all(friends
                            .filter((friend) => friend?.type === 'char')
                            .map((friend) => hydrateImessageCharAvatar(friend)))
                        : [];
                } catch (error) {
                    console.warn('[X] Failed to load iMessage chars', error);
                }
            }
            return [];
        }

        async function renderImessageCharPicker() {
            if (!imessageCharList) imessageCharList = document.getElementById('x-imessage-char-list');
            if (!imessageCharList) return;
            imessageCharList.innerHTML = '<div class="x-empty-state">加载 iMessage Char...</div>';
            const chars = await loadImessageChars();
            if (chars.length === 0) {
                imessageCharList.innerHTML = '<div class="x-empty-state">未找到 iMessage Char</div>';
                return;
            }
            imessageCharList.innerHTML = chars.map((friend) => {
                const item = normalizeDmChar(friend, 'imessage');
                return `
                    <button class="x-char-pick-row" type="button" data-char-id="${escapeHtml(item.id)}">
                        <div class="x-avatar">${buildAvatarHtml(item.avatar, item.name)}</div>
                        <div>
                            <strong>${escapeHtml(item.name)}</strong>
                            <span>${escapeHtml(item.bio)}</span>
                        </div>
                        <i class="fas fa-plus"></i>
                    </button>
                `;
            }).join('');
            imessageCharList.querySelectorAll('.x-char-pick-row').forEach((button) => {
                button.addEventListener('click', () => {
                    const friend = chars.find((item) => String(item.id) === String(button.dataset.charId));
                    if (friend) addDirectMessageChar({ ...friend, origin: 'imessage' });
                });
            });
        }

        function openVisitorsSheet() {
            renderVisitors();
            if (typeof window.openView === 'function') window.openView(visitorsSheet);
            else visitorsSheet?.classList.add('active');
        }

        function closeVisitorsSheet() {
            if (typeof window.closeView === 'function') window.closeView(visitorsSheet);
            else visitorsSheet?.classList.remove('active');
        }

        function openAddDmSheet() {
            if (manualCharNameInput) manualCharNameInput.value = '';
            if (manualCharHandleInput) manualCharHandleInput.value = '';
            if (manualCharBioInput) manualCharBioInput.value = '';
            if (manualCharPersonaInput) manualCharPersonaInput.value = '';
            if (typeof window.openView === 'function') window.openView(addDmSheet);
            else addDmSheet?.classList.add('active');
            renderImessageCharPicker();
        }

        function closeAddDmSheet() {
            if (typeof window.closeView === 'function') window.closeView(addDmSheet);
            else addDmSheet?.classList.remove('active');
        }

        function addManualChar() {
            const name = safeText(manualCharNameInput?.value);
            if (!name) {
                if (typeof window.showToast === 'function') window.showToast('请输入 Char 名称');
                return;
            }
            addDirectMessageChar({
                id: makeLocalId('x-char'),
                origin: 'manual',
                name,
                handle: manualCharHandleInput?.value,
                bio: manualCharBioInput?.value,
                persona: manualCharPersonaInput?.value
            });
            closeAddDmSheet();
        }

        function getDirectMessageById(dmId) {
            const item = (getXState().xDirectMessages || []).find((entry) => String(entry.id) === String(dmId));
            return item ? normalizeDmChar(item, item.origin || 'manual') : null;
        }

        function releaseFocusBeforeHide(container, fallbackSelector = '') {
            if (!container || !container.contains(document.activeElement)) return;
            const focused = document.activeElement;
            if (focused && typeof focused.blur === 'function') focused.blur();
            requestAnimationFrame(() => {
                if (!fallbackSelector) return;
                const fallback = view.querySelector(fallbackSelector);
                if (fallback && typeof fallback.focus === 'function') fallback.focus({ preventScroll: true });
            });
        }

        function renderDmProfileIntro(item) {
            return `
                <section class="x-dm-profile-intro">
                    <div class="x-avatar">${buildAvatarHtml(item.avatar, item.name)}</div>
                    <div>
                        <strong>${escapeHtml(item.name)}</strong>
                        <span>${escapeHtml(item.handle || '@char')}</span>
                        <p>${escapeHtml(item.bio || '暂无签名')}</p>
                    </div>
                    <button class="x-dm-profile-home-btn" type="button" data-dm-profile-id="${escapeHtml(item.id)}">主页</button>
                </section>
            `;
        }

        function openDmProfile(dmId = currentDmId) {
            const item = dmId ? getDirectMessageById(dmId) : null;
            const body = document.getElementById('x-dm-profile-body');
            if (!item || !body || !dmProfileView) return;
            const sourceLabel = item.origin === 'imessage' ? 'iMessage 导入' : 'X 手动添加';
            const postsCount = Math.max(0, normalizeDmMessages(item.messages).filter((message) => message.source === 'char').length);
            const photosCount = getPostImages(item).length || 0;
            body.innerHTML = `
                <div class="x-profile-cover x-dm-profile-cover">
                    <div class="x-profile-cover-actions">
                        <button class="x-header-button" id="x-dm-profile-back" type="button" aria-label="返回">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <span></span>
                    </div>
                    <div class="x-profile-cover-mark">X</div>
                </div>
                <div class="x-scroll-area x-profile-scroll x-dm-profile-scroll">
                    <div class="x-profile-card">
                        <div class="x-profile-avatar">${buildAvatarHtml(item.avatar, item.name)}</div>
                        <div class="x-profile-edit x-dm-profile-source">${escapeHtml(sourceLabel)}</div>
                        <h2>${escapeHtml(item.name)}</h2>
                        <span>${escapeHtml(item.handle || '@char')}</span>
                        <p>${escapeHtml(item.bio || '暂无签名')}</p>
                        <div class="x-profile-stats">
                            <div><strong>${escapeHtml(String(postsCount))}</strong><span>Posts</span></div>
                            <div><strong>${escapeHtml(String(normalizeDmMessages(item.messages).length))}</strong><span>Messages</span></div>
                            <div><strong>${escapeHtml(String(photosCount))}</strong><span>Photos</span></div>
                        </div>
                    </div>
                    <div class="x-profile-tabs x-dm-profile-tabs">
                        <button class="active" type="button" data-dm-profile-tab="posts">Posts</button>
                        <button type="button" data-dm-profile-tab="photos">Photos</button>
                    </div>
                    <div class="x-profile-panel active" data-dm-profile-panel="posts">
                        <div class="x-empty-state">${escapeHtml(item.persona || '暂无人设')}</div>
                    </div>
                    <div class="x-profile-panel" data-dm-profile-panel="photos">
                        <div class="x-empty-state">暂无照片</div>
                    </div>
                </div>
            `;
            dmProfileView.classList.add('active');
            dmProfileView.setAttribute('aria-hidden', 'false');
        }

        function closeDmProfile() {
            releaseFocusBeforeHide(dmProfileView);
            dmProfileView?.classList.remove('active');
            dmProfileView?.setAttribute('aria-hidden', 'true');
        }

        function showXConfirm(options = {}) {
            if (typeof window.showCustomModal === 'function') {
                window.showCustomModal(options);
                return;
            }
            if (window.confirm(options.message || options.title || 'Confirm?')) {
                options.onConfirm?.();
            }
        }

        function openDmSettingsSheet() {
            if (!currentDmId || !getDirectMessageById(currentDmId)) return;
            if (typeof window.openView === 'function') window.openView(dmSettingsSheet);
            else dmSettingsSheet?.classList.add('active');
        }

        function closeDmSettingsSheet() {
            if (typeof window.closeView === 'function') window.closeView(dmSettingsSheet);
            else dmSettingsSheet?.classList.remove('active');
        }

        function clearCurrentDmChat() {
            const item = currentDmId ? getDirectMessageById(currentDmId) : null;
            if (!item) return;
            showXConfirm({
                title: '清空聊天记录',
                message: `确定清空与 ${item.name} 的聊天记录吗？此操作不可恢复。`,
                confirmText: '清空',
                isDestructive: true,
                onConfirm: () => {
                    updateDirectMessage(item.id, (draft) => {
                        draft.messages = [];
                        return draft;
                    });
                    closeDmSettingsSheet();
                    renderDirectMessages();
                    renderDmChat();
                    if (typeof window.showToast === 'function') window.showToast('已清空聊天记录');
                }
            });
        }

        function deleteCurrentDmChat() {
            const item = currentDmId ? getDirectMessageById(currentDmId) : null;
            if (!item) return;
            showXConfirm({
                title: '删除会话',
                message: `确定删除与 ${item.name} 的私信会话吗？此操作不可恢复。`,
                confirmText: '删除',
                isDestructive: true,
                onConfirm: () => {
                    updateXState((draft) => {
                        draft.xDirectMessages = (draft.xDirectMessages || [])
                            .filter((entry) => String(entry.id) !== String(item.id));
                    });
                    closeDmSettingsSheet();
                    closeDmProfile();
                    closeDmChat();
                    renderDirectMessages();
                    if (typeof window.showToast === 'function') window.showToast('已删除会话');
                }
            });
        }

        function updateDirectMessage(dmId, updater) {
            let updated = null;
            updateXState((draft) => {
                draft.xDirectMessages = (draft.xDirectMessages || []).map((item) => {
                    if (String(item.id) !== String(dmId)) return item;
                    const normalized = normalizeDmChar(item, item.origin || 'manual');
                    const next = updater({ ...normalized, messages: [...normalized.messages] }) || normalized;
                    updated = next;
                    return next;
                });
            });
            return updated;
        }

        function appendDmMessage(dmId, source, text) {
            const content = safeText(text);
            if (!content) return null;
            const message = {
                id: makeLocalId('dm-msg'),
                source: source === 'user' ? 'user' : 'char',
                text: content,
                createdAt: Date.now()
            };
            updateDirectMessage(dmId, (item) => {
                item.messages.push(message);
                return item;
            });
            renderDirectMessages();
            renderDmChat();
            return message;
        }

        function openDmChat(dmId) {
            currentDmId = String(dmId);
            renderDmChat();
            dmChatView?.classList.add('active');
            dmChatView?.setAttribute('aria-hidden', 'false');
        }

        function closeDmChat() {
            const closingDmId = currentDmId;
            const fallbackSelector = closingDmId
                ? `.x-dm-row[data-dm-id="${escapeCssIdent(closingDmId)}"]`
                : '';
            releaseFocusBeforeHide(dmChatView, fallbackSelector);
            currentDmId = null;
            dmChatView?.classList.remove('active');
            dmChatView?.setAttribute('aria-hidden', 'true');
        }

        function renderDmChat() {
            const item = currentDmId ? getDirectMessageById(currentDmId) : null;
            if (!item || !dmChatView) return;
            const avatarEl = document.getElementById('x-dm-chat-avatar');
            const nameEl = document.getElementById('x-dm-chat-name');
            const handleEl = document.getElementById('x-dm-chat-handle');
            const messages = normalizeDmMessages(item.messages);

            if (avatarEl) avatarEl.innerHTML = buildAvatarHtml(item.avatar, item.name);
            if (nameEl) nameEl.textContent = item.name;
            if (handleEl) handleEl.textContent = item.handle || '@char';
            if (dmChatMessagesEl) {
                const introHtml = renderDmProfileIntro(item);
                dmChatMessagesEl.innerHTML = messages.length
                    ? `${introHtml}${messages.map((message) => `
                        <div class="x-dm-chat-bubble-row ${message.source === 'user' ? 'user' : 'char'}">
                            <div class="x-dm-chat-bubble">${escapeHtml(message.text)}</div>
                        </div>
                    `).join('')}`
                    : `${introHtml}<div class="x-dm-chat-empty">暂无消息</div>`;
                dmChatMessagesEl.scrollTop = dmChatMessagesEl.scrollHeight;
            }
        }

        function sendDmUserMessage() {
            if (!currentDmId || !dmChatInput) return;
            const text = safeText(dmChatInput.value);
            if (!text) {
                if (typeof window.showToast === 'function') window.showToast('请输入消息内容');
                return;
            }
            dmChatInput.value = '';
            appendDmMessage(currentDmId, 'user', text);
        }

        async function generateDmApiReply() {
            if (!currentDmId) return;
            const item = getDirectMessageById(currentDmId);
            if (!item) return;
            const apiBtn = document.getElementById('x-dm-chat-api-btn');
            apiBtn?.classList.add('loading');
            apiBtn?.setAttribute('disabled', 'true');
            try {
                const recent = normalizeDmMessages(item.messages).slice(-12)
                    .map((message) => `${message.source === 'user' ? currentProfile.name : item.name}: ${message.text}`)
                    .join('\n');
                const worldbook = getSelectedWorldBookContext(`${item.name} ${item.bio} ${currentProfile.persona}`);
                const content = await requestXChatCompletion([
                    { role: 'system', content: 'Reply as the X private-message character. Return only one natural short message, no JSON.' },
                    { role: 'user', content: `Character: ${item.name} ${item.handle || ''}
Persona: ${item.persona || 'ordinary user'}
Bio/signature: ${item.bio || ''}
User profile: ${currentProfile.name} ${currentProfile.handle}
User persona: ${currentProfile.persona || currentProfile.bio || ''}
Current Date: ${getXState().xCurrentDate || defaultDate}
Worldbook:
${worldbook || 'None'}
Recent chat:
${recent || 'No previous chat.'}
Generate the character reply now.` }
                ], { temperature: 0.85 });
                appendDmMessage(currentDmId, 'char', content);
            } catch (error) {
                console.error('[X] DM API reply failed', error);
                if (typeof window.showToast === 'function') window.showToast('API 调用失败，请稍后重试');
            } finally {
                apiBtn?.classList.remove('loading');
                apiBtn?.removeAttribute('disabled');
            }
        }

        function openImagePreview(text, url = '') {
            if (!imagePreviewOverlay) return;
            const textEl = document.getElementById('x-image-preview-text');
            const imgEl = document.getElementById('x-image-preview-img');
            if (textEl) textEl.textContent = safeText(text, 'Image');
            if (imgEl) {
                imgEl.src = url || generatedImagePlaceholderUrl;
                imgEl.style.display = 'block';
            }
            imagePreviewOverlay.classList.add('active');
            imagePreviewOverlay.setAttribute('aria-hidden', 'false');
        }

        function closeImagePreview() {
            imagePreviewOverlay?.classList.remove('active');
            imagePreviewOverlay?.setAttribute('aria-hidden', 'true');
        }

        function openPostSettingsSheet(postId) {
            currentActionPostId = postId;
            if (typeof window.openView === 'function') window.openView(postSettingsSheet);
            else postSettingsSheet?.classList.add('active');
        }

        function closePostSettingsSheet() {
            if (typeof window.closeView === 'function') window.closeView(postSettingsSheet);
            else postSettingsSheet?.classList.remove('active');
            setTimeout(() => { currentActionPostId = null; }, 300);
        }

        function deleteTargetPost() {
            if (!currentActionPostId) return;
            const postId = currentActionPostId;
            showXConfirm({
                title: '删除帖子',
                message: '确定要删除这条帖子吗？此操作不可恢复。',
                confirmText: '删除',
                isDestructive: true,
                onConfirm: () => {
                    updateXState((draft) => {
                        draft.xGeneratedPosts = (draft.xGeneratedPosts || []).filter(p => String(p.id) !== String(postId));
                    });
                    
                    const cards = view.querySelectorAll(`.x-feed-card[data-post-id="${escapeCssIdent(postId)}"]`);
                    cards.forEach(card => {
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.95)';
                        card.style.transition = 'all 0.2s ease';
                        setTimeout(() => card.remove(), 200);
                    });
                    
                    closePostSettingsSheet();
                    if (currentDetailPostId === postId) {
                        closePostDetail();
                    }
                    if (typeof window.showToast === 'function') window.showToast('帖子已删除');
                }
            });
        }

        function openSearchGenerateSheet() {
            if (searchGenerateInput) searchGenerateInput.value = '';
            if (typeof window.openView === 'function') window.openView(searchGenerateSheet);
            else searchGenerateSheet?.classList.add('active');
        }

        function closeSearchGenerateSheet() {
            if (typeof window.closeView === 'function') window.closeView(searchGenerateSheet);
            else searchGenerateSheet?.classList.remove('active');
        }

        async function generateSearchPosts() {
            const runBtn = document.getElementById('x-search-generate-run-btn');
            const topic = safeText(searchGenerateInput?.value);
            runBtn?.classList.add('loading');
            if (runBtn) runBtn.textContent = 'Generating';
            try {
                const worldbook = getSelectedWorldBookContext(`${topic} ${currentProfile.bio}`);
                const searchUserProfile = {
                    name: currentProfile.name,
                    handle: currentProfile.handle,
                    bio: currentProfile.bio
                };
                const prompt = `Return strict JSON only. Generate 5 to 10 realistic Weibo/X-style posts for the user's feed.
Mix account types: official brand/media accounts, personal accounts, fan accounts, passers-by, marketing accounts, and niche community accounts.
Mix tones: serious analysis, funny meme-style posts, subtle sarcasm, heated/controversial takes, recommendations, complaints, fan enthusiasm, and deliberately argument-starting opinions. Keep it plausible, not generic.
Every post must be grounded in the topic, minimal user profile, and worldbook context when available. Avoid template-like filler.
Each post must include: authorName, handle, text, likes, reposts, commentsCount, mediaType ("text" or "image"), comments, and optional imagePrompt/images only when mediaType is "image".
Posts can be pure text. Prefer text posts unless an image clearly adds value.
Each post must have at least 5 comments.
Comments should feel like a real Chinese social feed: disagreements, jokes, memes, clarifications, fans defending someone, skeptical passers-by, and occasional heated replies are allowed.
Every comment must be directly related to its own post. It must reference at least one concrete detail from the post text, topic, author stance, event, character, imagePrompt, or images[].text. Do not write generic reactions such as "interesting", "same", "nice", or comments that could fit any post.
Replies are optional. If replies are included, each reply must respond to the parent comment's concrete point and connect back to the post.
If mediaType is "image", describe the image subject, composition, light, mood, and relevant post detail in imagePrompt or images[].text. Do not invent inaccessible URLs.
ALL text values, including imagePrompt and any text inside the images array describing the picture, MUST be written in Chinese (简体中文). Do not use English for image descriptions.
Topic: ${topic || 'open recommendation feed'}
User profile: ${JSON.stringify(searchUserProfile)}
Current Date: ${getXState().xCurrentDate || defaultDate}
Worldbook:
${worldbook || 'None'}`;
                const raw = await requestXChatCompletion([
                    { role: 'system', content: 'You are a JSON generator for a fictional X feed. Output only valid JSON.' },
                    { role: 'user', content: prompt }
                ], { temperature: 0.9 });
                const parsed = parseJsonPayload(raw);
                const posts = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.posts) ? parsed.posts : []);
                const added = appendGeneratedPosts(posts);
                closeSearchGenerateSheet();
                if (typeof window.showToast === 'function') window.showToast(added.length ? `已生成 ${added.length} 条帖子` : '没有生成可用帖子');
            } catch (error) {
                console.error('[X] Generate posts failed', error);
                if (typeof window.showToast === 'function') window.showToast('生成失败，请检查 API 配置或返回格式');
            } finally {
                runBtn?.classList.remove('loading');
                if (runBtn) runBtn.textContent = 'Generate';
            }
        }

        function updateIndicator(targetItem) {
            if (!indicator || !targetItem) return;
            const nav = targetItem.parentElement;
            if (!nav) return;

            const navRect = nav.getBoundingClientRect();
            const itemRect = targetItem.getBoundingClientRect();
            indicator.style.left = `${itemRect.left - navRect.left}px`;
            indicator.style.width = `${itemRect.width}px`;
        }

        function switchTab(index) {
            if (index < 0 || index >= navItems.length) return;
            currentIndex = index;

            navItems.forEach((item, itemIndex) => {
                item.classList.toggle('active', itemIndex === index);
            });

            tabs.forEach((tab, tabIndex) => {
                tab.classList.toggle('active', tabIndex === index);
                tab.style.transform = `translateX(-${index * 100}%)`;
            });

            updateIndicator(navItems[index]);
            if (navItems[index]?.getAttribute('data-target') === 'x-super-tab') renderSuperFollowBar();
            if (navItems[index]?.getAttribute('data-target') === 'x-messages-tab') renderDirectMessages();
            closePostDetail();
        }

        function switchButtonTabs(buttons, panels, buttonAttr, panelAttr, nextValue) {
            buttons.forEach((button) => {
                button.classList.toggle('active', button.getAttribute(buttonAttr) === nextValue);
            });
            panels.forEach((panel) => {
                panel.classList.toggle('active', panel.getAttribute(panelAttr) === nextValue);
            });
        }

        function openPostDetail(postId) {
            const post = postData[postId] || postData.island;
            currentDetailPostId = postId;
            const detailPost = document.getElementById('x-detail-post');
            const thread = getPostThread(postId);

            if (detailPost) {
                detailPost.innerHTML = `
                    <div class="x-detail-author">
                        <div class="x-avatar">${buildAvatarHtml(post.avatar, post.name)}</div>
                        <div>
                            <strong>${escapeHtml(post.name)}</strong>
                            <span>${escapeHtml(post.handle)}</span>
                        </div>
                    </div>
                    <p class="x-detail-text">${escapeHtml(post.text)}</p>
                    ${renderPostImages(getPostImages(post))}
                    <div class="x-detail-inline-actions">
                        <button id="x-detail-repost-btn" type="button" class="x-detail-inline-action ${thread.reposted ? 'active' : ''}" aria-label="Repost">
                            <i class="fas fa-retweet"></i><span>${escapeHtml(formatCompactCount(thread.reposts))}</span>
                        </button>
                        <button id="x-detail-like-btn" type="button" class="x-detail-inline-action ${thread.liked ? 'active' : ''}" aria-label="Like">
                            <i class="${thread.liked ? 'fas' : 'far'} fa-heart"></i><span>${escapeHtml(formatCompactCount(thread.likes))}</span>
                        </button>
                    </div>
                `;
            }

            const repostsEl = document.getElementById('x-detail-reposts');
            const likesEl = document.getElementById('x-detail-likes');
            const commentsEl = document.getElementById('x-detail-comments');
            if (repostsEl) repostsEl.textContent = formatCompactCount(thread.reposts);
            if (likesEl) likesEl.textContent = formatCompactCount(thread.likes);
            if (commentsEl) commentsEl.textContent = formatCompactCount(thread.commentsCount);
            renderDetailActions(thread);
            renderReplyContext();
            renderCommentsList(postId, thread);
            updatePostCountNodes(postId, thread);

            postDetailView?.classList.add('active');
            postDetailView?.setAttribute('aria-hidden', 'false');
        }

        function closePostDetail() {
            if (postDetailView?.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            postDetailView?.classList.remove('active');
            postDetailView?.setAttribute('aria-hidden', 'true');
            currentDetailPostId = null;
            replyTarget = null;
        }

        function bindPostCard(card) {
            const postId = card.getAttribute('data-post-id');
            if (!postId || card.dataset.xBound === 'true') return;
            card.dataset.xBound = 'true';
            card.addEventListener('click', (event) => {
                if (event.target.closest('.x-post-image-thumb')) return;
                
                const ref = event.target.closest('.x-ref-post');
                if (ref) {
                    event.stopPropagation();
                    openPostDetail(ref.dataset.refId);
                    return;
                }
                
                if (card.classList.contains('is-moment')) return;
                
                openPostDetail(postId);
            });
            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (card.classList.contains('is-moment')) return;
                    openPostDetail(postId);
                }
            });
        }

        function openXApp(event) {
            if (event) event.stopPropagation();
            if (window.isJiggleMode) return;
            ensureXChrome();
            renderProfile();
            renderWorldBookSummary();
            renderSuperFollowBar();
            renderGeneratedPosts();
            renderDirectMessages();
            view.classList.add('active');
            requestAnimationFrame(() => switchTab(currentIndex));
        }

        function closeXApp() {
            closeTopicDetail();
            closePostDetail();
            closeEditProfile();
            closeCreateTopicSheet();
            closeXSettings();
            closeComposer();
            closeVisitorsSheet();
            closeAddDmSheet();
            closeDmChat();
            closeDmSettingsSheet();
            closeDmProfile();
            closeSearchGenerateSheet();
            closeImagePreview();
            view.classList.remove('active');
        }

        function bindFilePreview(input, onLoad) {
            input?.addEventListener('change', () => {
                const file = input.files && input.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => onLoad(String(reader.result || ''));
                reader.readAsDataURL(file);
            });
        }

        ensureXChrome();

        appButton.addEventListener('click', openXApp);
        closeButtons.forEach((button) => button.addEventListener('click', closeXApp));
        navItems.forEach((item, index) => item.addEventListener('click', () => switchTab(index)));

        view.querySelectorAll('.x-feed-card[data-post-id]').forEach(bindPostCard);
        postDetailBack?.addEventListener('click', closePostDetail);
        topicDetailBack?.addEventListener('click', closeTopicDetail);
        topicDetailGenerateBtn?.addEventListener('click', generateTopicPosts);
        editButton?.addEventListener('click', openEditProfile);
        settingsButton?.addEventListener('click', openXSettings);
        document.getElementById('x-profile-visitors-btn')?.addEventListener('click', openVisitorsSheet);
        document.getElementById('x-visitors-close-btn')?.addEventListener('click', closeVisitorsSheet);
        document.getElementById('x-add-dm-btn')?.addEventListener('click', openAddDmSheet);
        document.getElementById('x-add-dm-close-btn')?.addEventListener('click', closeAddDmSheet);
        document.getElementById('x-manual-char-add-btn')?.addEventListener('click', addManualChar);
        if (globalDateInput) {
            globalDateInput.addEventListener('change', (e) => setGlobalDate(e.target.value));
        }
        if (nextDayBtn) {
            nextDayBtn.addEventListener('click', nextDay);
        }

        document.getElementById('x-search-generate-btn')?.addEventListener('click', openSearchGenerateSheet);
        document.getElementById('x-search-generate-close-btn')?.addEventListener('click', closeSearchGenerateSheet);
        document.getElementById('x-search-generate-run-btn')?.addEventListener('click', generateSearchPosts);
        document.getElementById('x-post-settings-close-btn')?.addEventListener('click', closePostSettingsSheet);
        document.getElementById('x-post-delete-btn')?.addEventListener('click', deleteTargetPost);
        document.getElementById('x-post-detail-menu-btn')?.addEventListener('click', () => {
            if (currentDetailPostId) openPostSettingsSheet(currentDetailPostId);
        });
        document.getElementById('x-dm-chat-back')?.addEventListener('click', closeDmChat);
        document.getElementById('x-dm-chat-menu-btn')?.addEventListener('click', openDmSettingsSheet);
        document.getElementById('x-dm-settings-close-btn')?.addEventListener('click', closeDmSettingsSheet);
        document.getElementById('x-dm-clear-chat-btn')?.addEventListener('click', clearCurrentDmChat);
        document.getElementById('x-dm-delete-chat-btn')?.addEventListener('click', deleteCurrentDmChat);
        document.getElementById('x-dm-profile-back')?.addEventListener('click', closeDmProfile);
        document.getElementById('x-dm-chat-composer')?.addEventListener('submit', (event) => {
            event.preventDefault();
            sendDmUserMessage();
        });
        document.getElementById('x-dm-chat-send-btn')?.addEventListener('click', (event) => {
            event.preventDefault();
            sendDmUserMessage();
        });
        document.getElementById('x-dm-chat-api-btn')?.addEventListener('click', generateDmApiReply);
        document.getElementById('x-dm-chat-input')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.isComposing && event.keyCode !== 229) {
                event.preventDefault();
                sendDmUserMessage();
                event.target.blur();
            }
        });
        document.getElementById('x-image-preview-close')?.addEventListener('click', closeImagePreview);
        document.getElementById('x-reply-submit-btn')?.addEventListener('click', submitReply);
        document.getElementById('x-reply-cancel-btn')?.addEventListener('click', () => setReplyTarget(null));
        document.getElementById('x-reply-input')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.isComposing && event.keyCode !== 229) {
                event.preventDefault();
                submitReply();
                event.target.blur();
            }
        });
        editCancelButton?.addEventListener('click', closeEditProfile);
        editSaveButton?.addEventListener('click', saveProfile);
        settingsCloseButton?.addEventListener('click', closeXSettings);
        settingsWorldBookButton?.addEventListener('click', openWorldBookSelector);
        composeCancelButton?.addEventListener('click', closeComposer);
        composeSubmitButton?.addEventListener('click', submitComposer);
        document.querySelector('.x-compose-button')?.addEventListener('click', openComposer);
        document.querySelector('.x-post-button')?.addEventListener('click', openComposer);
        editAvatarPreview?.addEventListener('click', () => editAvatarInput?.click());
        editBannerPreview?.addEventListener('click', () => editBannerInput?.click());

        view.addEventListener('click', (event) => {
            const dmProfileBack = event.target.closest('#x-dm-profile-back');
            if (dmProfileBack) {
                event.preventDefault();
                closeDmProfile();
                return;
            }
            const dmProfileTab = event.target.closest('.x-dm-profile-tabs button[data-dm-profile-tab]');
            if (dmProfileTab) {
                event.preventDefault();
                const nextTab = dmProfileTab.getAttribute('data-dm-profile-tab');
                const profileView = dmProfileTab.closest('.x-dm-profile-view');
                const tabButtons = Array.from(profileView?.querySelectorAll('.x-dm-profile-tabs button[data-dm-profile-tab]') || []);
                const panels = Array.from(profileView?.querySelectorAll('.x-profile-panel[data-dm-profile-panel]') || []);
                switchButtonTabs(tabButtons, panels, 'data-dm-profile-tab', 'data-dm-profile-panel', nextTab);
                return;
            }
            const imageButton = event.target.closest('.x-post-image-thumb');
            if (imageButton) {
                event.preventDefault();
                event.stopPropagation();
                openImagePreview(imageButton.dataset.imageText || 'Image', imageButton.dataset.imageUrl || '');
                return;
            }
            const detailLike = event.target.closest('#x-detail-like-btn');
            if (detailLike) {
                event.preventDefault();
                toggleDetailAction('like');
                return;
            }
            const detailRepost = event.target.closest('#x-detail-repost-btn');
            if (detailRepost) {
                event.preventDefault();
                toggleDetailAction('repost');
                return;
            }
            const dmRow = event.target.closest('.x-dm-row[data-dm-id]');
            if (dmRow) {
                event.preventDefault();
                openDmChat(dmRow.dataset.dmId);
                return;
            }
            const emptyAddDmButton = event.target.closest('.x-empty-add-dm-btn');
            if (emptyAddDmButton) {
                event.preventDefault();
                openAddDmSheet();
                return;
            }
            const dmProfileButton = event.target.closest('[data-dm-profile-id]');
            if (dmProfileButton) {
                event.preventDefault();
                openDmProfile(dmProfileButton.dataset.dmProfileId);
                return;
            }
            const closeTrigger = event.target.closest('[data-x-close]');
            if (closeTrigger) {
                event.preventDefault();
                closeXApp();
                return;
            }
            const replyButton = event.target.closest('.x-comment-reply-btn');
            if (replyButton) {
                event.preventDefault();
                const commentId = replyButton.dataset.commentId;
                const replyId = replyButton.dataset.replyId || '';
                let targetName = safeText(replyButton.dataset.replyName);
                if (!targetName && currentDetailPostId) {
                    const thread = getPostThread(currentDetailPostId);
                    const comment = findCommentById(thread, commentId);
                    targetName = replyId
                        ? safeText(findReplyById(comment, replyId)?.name, comment?.name || 'comment')
                        : safeText(comment?.name, 'comment');
                }
                setReplyTarget({ commentId, replyId, name: targetName });
                return;
            }
            const trendRow = event.target.closest('.x-trend-row');
            if (trendRow) {
                const topicStrong = trendRow.querySelector('strong');
                if (topicStrong) {
                    openTopicDetail(topicStrong.textContent.trim());
                }
                return;
            }

            const signBtn = event.target.closest('.x-super-title-row button');
            if (signBtn && !signBtn.disabled && currentActiveTopicId) {
                event.preventDefault();
                handleTopicSign(currentActiveTopicId);
                return;
            }
        });

        [visitorsSheet, addDmSheet, dmSettingsSheet, searchGenerateSheet, imagePreviewOverlay, createTopicSheet, postSettingsSheet].forEach((sheet) => {
            sheet?.addEventListener('click', (event) => {
                if (event.target === sheet) {
                    if (sheet === visitorsSheet) closeVisitorsSheet();
                    if (sheet === addDmSheet) closeAddDmSheet();
                    if (sheet === dmSettingsSheet) closeDmSettingsSheet();
                    if (sheet === searchGenerateSheet) closeSearchGenerateSheet();
                    if (sheet === imagePreviewOverlay) closeImagePreview();
                    if (sheet === createTopicSheet) closeCreateTopicSheet();
                    if (sheet === postSettingsSheet) closePostSettingsSheet();
                }
            });
        });

        createTopicCancelBtn?.addEventListener('click', closeCreateTopicSheet);
        createTopicSaveBtn?.addEventListener('click', saveTopic);
        createTopicImportBtn?.addEventListener('click', toggleTopicImportImessage);
        createTopicManualBtn?.addEventListener('click', toggleTopicManualChar);
        topicManualSaveBtn?.addEventListener('click', saveTopicManualChar);
        superUpdateBtn?.addEventListener('click', generateSuperTopicUpdate);

        createTopicAvatarPreview?.addEventListener('click', () => createTopicAvatarInput?.click());
        bindFilePreview(createTopicAvatarInput, (src) => {
            createTopicAvatarDraft = src;
            renderImagePreview(createTopicAvatarPreview, src, '超');
        });

        createTopicBannerPreview?.addEventListener('click', () => createTopicBannerInput?.click());
        bindFilePreview(createTopicBannerInput, (src) => {
            createTopicBannerDraft = src;
            renderImagePreview(createTopicBannerPreview, src, 'Cover');
        });

        bindFilePreview(editAvatarInput, (src) => {
            avatarDraft = src;
            renderImagePreview(editAvatarPreview, avatarDraft, safeText(editNameInput?.value, 'U').slice(0, 1).toUpperCase());
        });

        bindFilePreview(editBannerInput, (src) => {
            bannerDraft = src;
            renderImagePreview(editBannerPreview, bannerDraft, 'Cover');
        });

        const homeFeedButtons = Array.from(view.querySelectorAll('.x-home-feed-tabs button[data-feed]'));
        const homeFeedPanels = Array.from(view.querySelectorAll('.x-feed-panel[data-feed-panel]'));
        homeFeedButtons.forEach((button) => {
            button.addEventListener('click', () => {
                switchButtonTabs(homeFeedButtons, homeFeedPanels, 'data-feed', 'data-feed-panel', button.getAttribute('data-feed'));
            });
        });

        const profileTabButtons = Array.from(view.querySelectorAll('.x-profile-tabs button[data-profile-tab]'));
        const profilePanels = Array.from(view.querySelectorAll('.x-profile-panel[data-profile-panel]'));
        profileTabButtons.forEach((button) => {
            button.addEventListener('click', () => {
                switchButtonTabs(profileTabButtons, profilePanels, 'data-profile-tab', 'data-profile-panel', button.getAttribute('data-profile-tab'));
            });
        });

        const superTabButtons = Array.from(view.querySelectorAll('#x-super-profile-tabs button[data-super-tab]'));
        const superPanels = Array.from(view.querySelectorAll('.x-super-feed[data-super-panel]'));
        superTabButtons.forEach((button) => {
            button.addEventListener('click', () => {
                switchButtonTabs(superTabButtons, superPanels, 'data-super-tab', 'data-super-panel', button.getAttribute('data-super-tab'));
            });
        });

        if (mainContent) {
            mainContent.addEventListener('touchstart', (event) => {
                if (postDetailView?.classList.contains('active')) return;
                if (!event.touches || event.touches.length === 0) return;
                touchStartX = event.touches[0].clientX;
                touchStartY = event.touches[0].clientY;
                isTouching = true;
            }, { passive: true });

            mainContent.addEventListener('touchend', (event) => {
                if (!isTouching || !event.changedTouches || event.changedTouches.length === 0) return;
                isTouching = false;

                const endX = event.changedTouches[0].clientX;
                const endY = event.changedTouches[0].clientY;
                const diffX = touchStartX - endX;
                const diffY = touchStartY - endY;

                if (Math.abs(diffX) < 52 || Math.abs(diffX) < Math.abs(diffY) * 1.25) return;

                if (diffX > 0) {
                    switchTab(Math.min(currentIndex + 1, navItems.length - 1));
                } else {
                    switchTab(Math.max(currentIndex - 1, 0));
                }
            }, { passive: true });
        }

        window.addEventListener('resize', () => {
            if (!view.classList.contains('active')) return;
            updateIndicator(navItems[currentIndex]);
        });
        
        view.querySelectorAll('.x-scroll-area, .x-detail-scroll').forEach(area => {
            area.addEventListener('scroll', () => {
                if (area.scrollTop + area.clientHeight >= area.scrollHeight - 160) {
                    const hiddens = area.querySelectorAll('.x-hidden-page-2');
                    if (hiddens.length > 0) {
                        hiddens.forEach(el => {
                            el.style.display = '';
                            el.classList.remove('x-hidden-page-2');
                        });
                    }
                }
            }, { passive: true });
        });

        renderProfile();
        renderWorldBookSummary();
        renderSuperFollowBar();
        renderGeneratedPosts();
        renderDirectMessages();
        requestAnimationFrame(() => switchTab(0));
    });
})();
