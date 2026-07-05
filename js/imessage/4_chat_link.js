// ==========================================
// IMESSAGE: external link composer
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    window.imChat = window.imChat || {};
    const imChat = window.imChat;

    const PLATFORM_RULES = [
        { id: 'xiaohongshu', label: '小红书', color: '#ff2442', hosts: ['xiaohongshu.com', 'xhslink.com'] },
        { id: 'douyin', label: '抖音', color: '#111111', hosts: ['douyin.com', 'iesdouyin.com'] },
        { id: 'bilibili', label: '哔哩哔哩', color: '#00aeec', hosts: ['bilibili.com', 'b23.tv'] },
        { id: 'weibo', label: '微博', color: '#ff8200', hosts: ['weibo.com', 'weibo.cn', 't.cn'] }
    ];

    function extractFirstExternalUrl(value) {
        const match = String(value || '').match(/https?:\/\/[^\s<>"'，。！？；：、]+/i);
        if (!match) return '';
        const trimmed = match[0].replace(/[\]\[(){}<>，。！？；：、,!?;:]+$/g, '');
        try {
            const parsed = new URL(trimmed);
            return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
        } catch (_) {
            return '';
        }
    }

    function detectLinkPlatform(value) {
        const url = extractFirstExternalUrl(value) || String(value || '').trim();
        try {
            const parsed = new URL(url);
            const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
            const match = PLATFORM_RULES.find(rule => rule.hosts.some(host => hostname === host || hostname.endsWith(`.${host}`)));
            return match
                ? { ...match, hostname }
                : { id: 'web', label: '网页', color: '#007aff', hosts: [], hostname };
        } catch (_) {
            return { id: 'unknown', label: '未识别', color: '#8e8e93', hosts: [], hostname: '' };
        }
    }

    function safeHttpUrl(value) {
        try {
            const parsed = new URL(String(value || '').trim());
            return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
        } catch (_) {
            return '';
        }
    }

    function getResolverEndpoint() {
        const config = window.getLinkResolverConfig
            ? window.getLinkResolverConfig()
            : (window.linkResolverConfig || {});
        const base = String(config.endpoint || '').trim().replace(/\/+$/, '');
        if (!base) return { endpoint: '', timeoutMs: 12000 };
        return {
            endpoint: base.endsWith('/v1/resolve-link') ? base : `${base}/v1/resolve-link`,
            timeoutMs: Math.min(30000, Math.max(3000, Number(config.timeoutMs) || 12000))
        };
    }

    function cleanText(value, maxLength = 50000) {
        return String(value == null ? '' : value).replace(/\u0000/g, '').trim().slice(0, maxLength);
    }

    function normalizeMedia(media) {
        if (!Array.isArray(media)) return [];
        const seen = new Set();
        return media.slice(0, 12).map(item => {
            const url = safeHttpUrl(item && item.url);
            if (!url || seen.has(url)) return null;
            seen.add(url);
            return {
                type: item && item.type === 'video' ? 'video' : 'image',
                url,
                caption: cleanText(item && item.caption, 1000),
                captionSource: cleanText(item && item.captionSource, 40)
            };
        }).filter(Boolean);
    }

    function createFallbackLinkData(url, platform, status = 'unresolved', errorCode = '') {
        return {
            originalUrl: url,
            finalUrl: url,
            canonicalUrl: url,
            platform: platform.id === 'unknown' ? 'web' : platform.id,
            platformLabel: platform.id === 'unknown' ? '网页' : platform.label,
            title: platform.hostname || url,
            author: '',
            description: '',
            bodyText: '',
            coverUrl: '',
            media: [],
            publishedAt: '',
            fetchedAt: Date.now(),
            truncated: false,
            resolveStatus: status,
            errorCode: cleanText(errorCode, 100)
        };
    }

    function normalizeResolvedLinkData(url, platform, payload, status) {
        const source = payload && typeof payload === 'object' ? payload : {};
        return {
            originalUrl: safeHttpUrl(source.originalUrl) || url,
            finalUrl: safeHttpUrl(source.finalUrl) || url,
            canonicalUrl: safeHttpUrl(source.canonicalUrl) || safeHttpUrl(source.finalUrl) || url,
            platform: cleanText(source.platform, 40) || platform.id || 'web',
            platformLabel: cleanText(source.platformLabel, 40) || platform.label || '网页',
            title: cleanText(source.title, 500) || platform.hostname || url,
            author: cleanText(source.author, 300),
            description: cleanText(source.description, 3000),
            bodyText: cleanText(source.bodyText, 50000),
            coverUrl: safeHttpUrl(source.coverUrl),
            media: normalizeMedia(source.media),
            publishedAt: cleanText(source.publishedAt, 100),
            fetchedAt: Number(source.fetchedAt) || Date.now(),
            truncated: !!source.truncated,
            resolveStatus: ['resolved', 'partial'].includes(status) ? status : 'partial',
            errorCode: ''
        };
    }

    function createLinkComposer(page) {
        let overlay = page.querySelector('.im-link-composer-overlay');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.className = 'im-link-composer-overlay';
        overlay.innerHTML = `
            <div class="im-link-composer-backdrop"></div>
            <section class="im-link-composer-card" role="dialog" aria-modal="true" aria-label="发送外部链接">
                <header class="im-link-composer-header">
                    <button type="button" class="im-link-composer-close" aria-label="关闭"><i class="fas fa-times"></i></button>
                    <strong>发送链接</strong>
                    <span></span>
                </header>
                <div class="im-link-composer-body">
                    <textarea class="im-link-composer-input" rows="4" inputmode="url" autocomplete="off" placeholder="粘贴链接或包含链接的分享文字"></textarea>
                    <div class="im-link-detection-row">
                        <span class="im-link-platform-badge"><i class="fas fa-link"></i><span>等待链接</span></span>
                        <span class="im-link-resolve-status">粘贴后自动识别</span>
                    </div>
                    <div class="im-link-preview" hidden>
                        <div class="im-link-preview-cover"><img alt=""><i class="fas fa-link"></i></div>
                        <div class="im-link-preview-copy">
                            <div class="im-link-preview-title"></div>
                            <div class="im-link-preview-author"></div>
                            <div class="im-link-preview-description"></div>
                        </div>
                    </div>
                    <div class="im-link-composer-hint">只读取无需登录的公开页面；解析失败时仍可发送原链接。</div>
                </div>
                <footer class="im-link-composer-actions">
                    <button type="button" class="im-link-composer-cancel">取消</button>
                    <button type="button" class="im-link-composer-send" disabled>发送</button>
                </footer>
            </section>
        `;
        page.appendChild(overlay);

        const input = overlay.querySelector('.im-link-composer-input');
        const closeButton = overlay.querySelector('.im-link-composer-close');
        const cancelButton = overlay.querySelector('.im-link-composer-cancel');
        const sendButton = overlay.querySelector('.im-link-composer-send');
        const backdrop = overlay.querySelector('.im-link-composer-backdrop');
        const platformBadge = overlay.querySelector('.im-link-platform-badge');
        const platformText = platformBadge.querySelector('span');
        const statusText = overlay.querySelector('.im-link-resolve-status');
        const preview = overlay.querySelector('.im-link-preview');
        const previewCover = overlay.querySelector('.im-link-preview-cover');
        const previewImage = previewCover.querySelector('img');
        const previewTitle = overlay.querySelector('.im-link-preview-title');
        const previewAuthor = overlay.querySelector('.im-link-preview-author');
        const previewDescription = overlay.querySelector('.im-link-preview-description');

        const state = {
            url: '',
            platform: detectLinkPlatform(''),
            linkData: null,
            status: 'idle',
            sequence: 0,
            debounceTimer: null,
            controller: null,
            resolvePromise: null,
            visionSequence: 0,
            sending: false
        };
        overlay._imLinkState = state;

        function setStatus(status, message) {
            state.status = status;
            statusText.textContent = message || '';
            statusText.dataset.status = status;
        }

        function renderState() {
            const platform = state.platform;
            platformText.textContent = platform.label;
            platformBadge.style.setProperty('--link-platform-color', platform.color);
            platformBadge.classList.toggle('is-valid', !!state.url);
            sendButton.disabled = !state.url || state.sending;

            const data = state.linkData;
            preview.hidden = !state.url;
            if (!state.url) {
                previewTitle.textContent = '';
                previewAuthor.textContent = '';
                previewDescription.textContent = '';
                previewImage.removeAttribute('src');
                previewCover.classList.remove('has-image');
                return;
            }

            previewTitle.textContent = (data && data.title) || platform.hostname || state.url;
            previewAuthor.textContent = data && data.author
                ? `${data.platformLabel || platform.label} · ${data.author}`
                : `${(data && data.platformLabel) || platform.label} · ${platform.hostname || ''}`;
            const bodyLength = data && data.bodyText ? data.bodyText.length : 0;
            previewDescription.textContent = bodyLength > 0
                ? `已读取 ${bodyLength.toLocaleString()} 字${data.truncated ? '（已截断）' : ''}`
                : ((data && data.description) || '尚未读取页面正文');

            const coverUrl = data && safeHttpUrl(data.coverUrl);
            if (coverUrl) {
                previewImage.src = coverUrl;
                previewCover.classList.add('has-image');
            } else {
                previewImage.removeAttribute('src');
                previewCover.classList.remove('has-image');
            }
        }

        previewImage.addEventListener('error', () => {
            previewCover.classList.remove('has-image');
            previewImage.removeAttribute('src');
        });

        function cancelActiveWork() {
            state.sequence += 1;
            state.visionSequence += 1;
            if (state.debounceTimer) clearTimeout(state.debounceTimer);
            state.debounceTimer = null;
            if (state.controller) state.controller.abort();
            state.controller = null;
            state.resolvePromise = null;
        }

        async function enrichImageCaptions(runId) {
            const data = state.linkData;
            if (!data || !Array.isArray(data.media) || typeof imChat.identifyChatImage !== 'function') return;
            const imageItems = data.media.filter(item => item.type === 'image').slice(0, 3);
            const missingItems = imageItems.filter(item => !String(item.caption || '').trim());
            if (missingItems.length === 0) return;

            const api = window.getApiConfig ? window.getApiConfig() : (window.apiConfig || {});
            if (!api.endpoint || !api.apiKey || !api.model) {
                if (runId === state.visionSequence) setStatus(data.resolveStatus, '正文已读取；未配置视觉模型');
                return;
            }

            for (let index = 0; index < missingItems.length; index += 1) {
                if (runId !== state.visionSequence || !overlay.classList.contains('active')) return;
                setStatus(data.resolveStatus, `正文已读取；正在识别配图 ${index + 1}/${missingItems.length}`);
                try {
                    const caption = await imChat.identifyChatImage(missingItems[index].url);
                    if (runId !== state.visionSequence) return;
                    missingItems[index].caption = cleanText(caption, 1000);
                    missingItems[index].captionSource = 'vision';
                } catch (error) {
                    console.warn('[iMessage link] image recognition failed', error);
                }
            }

            if (runId === state.visionSequence) {
                const recognized = imageItems.filter(item => item.caption).length;
                setStatus(data.resolveStatus, recognized > 0 ? `已读取正文和 ${recognized} 张配图` : '已读取正文');
                renderState();
            }
        }

        async function resolveCurrentLink(sequence) {
            const url = state.url;
            const platform = state.platform;
            const resolver = getResolverEndpoint();
            if (!resolver.endpoint) {
                state.linkData = createFallbackLinkData(url, platform, 'unconfigured', 'RESOLVER_NOT_CONFIGURED');
                setStatus('unconfigured', '未配置外链解析服务');
                renderState();
                return;
            }

            state.controller = new AbortController();
            const timeoutId = setTimeout(() => state.controller && state.controller.abort(), resolver.timeoutMs);
            setStatus('loading', '正在读取公开页面…');
            renderState();

            try {
                const response = await fetch(resolver.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-U2-Silent-Errors': '1' },
                    body: JSON.stringify({ url }),
                    signal: state.controller.signal
                });
                const result = await response.json().catch(() => null);
                if (sequence !== state.sequence) return;
                if (!response.ok || !result || result.ok !== true) {
                    const errorCode = result && (result.errorCode || result.error) || `HTTP_${response.status}`;
                    state.linkData = createFallbackLinkData(url, platform, 'failed', errorCode);
                    setStatus('failed', '未能读取正文，将只发送链接');
                    renderState();
                    return;
                }

                state.linkData = normalizeResolvedLinkData(url, platform, result.data, result.status);
                const bodyLength = state.linkData.bodyText.length;
                setStatus(
                    state.linkData.resolveStatus,
                    bodyLength > 0 ? `已读取 ${bodyLength.toLocaleString()} 字正文` : '已获取预览，但未读取正文'
                );
                renderState();
                const visionRunId = ++state.visionSequence;
                void enrichImageCaptions(visionRunId);
            } catch (error) {
                if (sequence !== state.sequence) return;
                const timedOut = error && error.name === 'AbortError';
                state.linkData = createFallbackLinkData(url, platform, 'failed', timedOut ? 'TIMEOUT' : 'NETWORK_ERROR');
                setStatus('failed', timedOut ? '读取超时，将只发送链接' : '网络错误，将只发送链接');
                renderState();
            } finally {
                clearTimeout(timeoutId);
                if (sequence === state.sequence) state.controller = null;
            }
        }

        function scheduleResolve() {
            cancelActiveWork();
            const url = extractFirstExternalUrl(input.value);
            state.url = url;
            state.platform = detectLinkPlatform(url);
            state.linkData = url ? createFallbackLinkData(url, state.platform) : null;

            if (!url) {
                setStatus('idle', input.value.trim() ? '请粘贴有效的 http/https 链接' : '粘贴后自动识别');
                renderState();
                return;
            }

            setStatus('detected', `已识别：${state.platform.label}`);
            renderState();
            const sequence = state.sequence;
            state.debounceTimer = setTimeout(() => {
                state.debounceTimer = null;
                state.resolvePromise = resolveCurrentLink(sequence);
            }, 300);
        }

        function closeComposer() {
            cancelActiveWork();
            overlay.classList.remove('active');
            setTimeout(() => {
                if (!overlay.classList.contains('active')) overlay.style.display = 'none';
            }, 220);
        }

        async function sendLinkMessage() {
            if (!state.url || state.sending) return;
            state.sending = true;
            sendButton.disabled = true;
            if (state.debounceTimer) {
                clearTimeout(state.debounceTimer);
                state.debounceTimer = null;
                state.resolvePromise = resolveCurrentLink(state.sequence);
            }
            sendButton.textContent = ['detected', 'loading'].includes(state.status) ? '等待解析…' : '发送中…';

            if (state.resolvePromise) {
                try { await state.resolvePromise; } catch (_) {}
            }

            const friend = window.imData.currentActiveFriend;
            if (!friend || (friend.type === 'group' && Number(friend.leftGroupAt) > 0)) {
                if (window.showToast) window.showToast('当前聊天无法发送链接');
                state.sending = false;
                sendButton.textContent = '发送';
                renderState();
                return;
            }

            const linkData = state.linkData || createFallbackLinkData(state.url, state.platform);
            const now = Date.now();
            const msgObj = {
                id: imChat.createMessageId ? imChat.createMessageId('link') : `link-${now}`,
                role: 'user',
                type: 'link',
                content: state.url,
                text: `[链接] ${linkData.platformLabel || state.platform.label}：${linkData.title || state.url}`,
                linkData: JSON.parse(JSON.stringify(linkData)),
                timestamp: now
            };

            const saved = window.imApp.appendFriendMessage
                ? await window.imApp.appendFriendMessage(friend.id, msgObj, { silent: true })
                : false;
            if (!saved) {
                if (window.showToast) window.showToast('链接消息保存失败');
                state.sending = false;
                sendButton.textContent = '发送';
                renderState();
                return;
            }

            const container = page.querySelector('.ins-chat-messages');
            if (container) {
                const appended = imChat.appendMessageToContainer
                    ? imChat.appendMessageToContainer(friend, container, msgObj, { scroll: true })
                    : false;
                if (!appended && imChat.rerenderChatContainer) {
                    imChat.rerenderChatContainer(friend, container, { scroll: true });
                }
            }

            closeComposer();
            state.sending = false;
            sendButton.textContent = '发送';
        }

        input.addEventListener('input', scheduleResolve);
        closeButton.addEventListener('click', closeComposer);
        cancelButton.addEventListener('click', closeComposer);
        backdrop.addEventListener('click', closeComposer);
        sendButton.addEventListener('click', () => void sendLinkMessage());
        input.addEventListener('keydown', (event) => {
            if (event.isComposing || event.keyCode === 229) return;
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                void sendLinkMessage();
            }
        });

        overlay._openLinkComposer = () => {
            cancelActiveWork();
            state.url = '';
            state.platform = detectLinkPlatform('');
            state.linkData = null;
            state.status = 'idle';
            state.sending = false;
            input.value = '';
            sendButton.textContent = '发送';
            setStatus('idle', '粘贴后自动识别');
            renderState();
            overlay.style.display = 'flex';
            void overlay.offsetWidth;
            overlay.classList.add('active');
            setTimeout(() => input.focus(), 80);
        };

        return overlay;
    }

    function openLinkComposer() {
        const friend = window.imData.currentActiveFriend;
        if (!friend) return;
        const page = document.getElementById(`chat-interface-${friend.id}`);
        if (!page) return;
        const overlay = createLinkComposer(page);
        overlay._openLinkComposer();
    }

    imChat.extractFirstExternalUrl = extractFirstExternalUrl;
    imChat.detectLinkPlatform = detectLinkPlatform;
    imChat.openLinkComposer = openLinkComposer;
});
