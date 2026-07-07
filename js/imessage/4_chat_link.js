// ==========================================
// IMESSAGE: fake link composer
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    window.imChat = window.imChat || {};
    const imChat = window.imChat;

    const FAKE_LINK_CONTEXT_OPTIONS_KEY = 'u2_fakeLinkAiContextOptions';
    const FAKE_LINK_RANDOM_IMAGE_HOST = 'picsum.photos';
    const DEFAULT_FAKE_LINK_STATUS = 'AI 生成只需域名和提示词；手动填入会套用通用美化网页';

    function cleanText(value, maxLength = 50000) {
        return String(value == null ? '' : value)
            .replace(/\u0000/g, '')
            .trim()
            .slice(0, maxLength);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function stripHtmlToPlainText(value, maxLength = 50000) {
        return cleanText(value, maxLength)
            .replace(/<\s*(script|style|iframe|object|embed|svg|canvas)[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#039;/gi, "'")
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, maxLength);
    }

    function hashFakeLinkSeed(value) {
        const text = String(value == null ? '' : value);
        let hash = 2166136261;
        for (let i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    }

    function buildRandomFakeLinkImageUrl(seedParts = [], index = 0, width = 900, height = 600) {
        const seed = hashFakeLinkSeed([].concat(seedParts, index).join('|')) || 'u2';
        return 'https://' + FAKE_LINK_RANDOM_IMAGE_HOST + '/seed/u2-' + seed + '-' + index + '/' + width + '/' + height;
    }

    function isAllowedFakeLinkImageUrl(value) {
        try {
            const parsed = new URL(String(value || ''));
            return parsed.protocol === 'https:' && parsed.hostname === FAKE_LINK_RANDOM_IMAGE_HOST;
        } catch (_) {
            return false;
        }
    }

    function injectRandomFakeLinkImages(html, options = {}) {
        const sourceHtml = cleanText(html, 80000);
        if (!sourceHtml) return '';
        const seedParts = [
            cleanText(options.domain || '', 180),
            cleanText(options.prompt || '', 1000),
            cleanText(options.theme || '', 80),
            cleanText(options.siteName || '', 80)
        ];
        let imageIndex = 0;
        const replaceImg = (match, attrs = '') => {
            const srcMatch = String(attrs).match(/\s+src\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i);
            const currentSrc = srcMatch ? srcMatch[1].replace(/^['"]|['"]$/g, '') : '';
            const nextSrc = isAllowedFakeLinkImageUrl(currentSrc)
                ? currentSrc
                : buildRandomFakeLinkImageUrl(seedParts, imageIndex);
            imageIndex += 1;
            let nextAttrs = String(attrs)
                .replace(/\s+src\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/ig, '')
                .replace(/\s+srcset\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/ig, '')
                .replace(/\s+loading\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/ig, '');
            if (!/\salt\s*=/i.test(nextAttrs)) nextAttrs += ' alt=""';
            return '<img' + nextAttrs + ' src="' + escapeHtml(nextSrc) + '" loading="lazy">';
        };
        let nextHtml = sourceHtml.replace(/<img\b([^>]*)>/gi, replaceImg);
        if (imageIndex === 0 && /\b(data-fake-image|fake-image-slot|image-placeholder|photo-placeholder)\b/i.test(nextHtml)) {
            nextHtml = nextHtml.replace(/<([a-z0-9-]+)([^>]*(?:data-fake-image|fake-image-slot|image-placeholder|photo-placeholder)[^>]*)>/gi, (match) => {
                const src = buildRandomFakeLinkImageUrl(seedParts, imageIndex);
                imageIndex += 1;
                return match + '<img class="u2-fake-random-image" src="' + escapeHtml(src) + '" alt="" loading="lazy">';
            });
        }
        return nextHtml;
    }

    function loadFakeLinkContextOptions() {
        const fallback = { includeCharPersona: false, includeUserPersona: false };
        try {
            const loaded = window.StorageManager && typeof window.StorageManager.load === 'function'
                ? window.StorageManager.load(FAKE_LINK_CONTEXT_OPTIONS_KEY, fallback)
                : JSON.parse(window.localStorage?.getItem(FAKE_LINK_CONTEXT_OPTIONS_KEY) || 'null');
            return {
                includeCharPersona: !!loaded?.includeCharPersona,
                includeUserPersona: !!loaded?.includeUserPersona
            };
        } catch (_) {
            return fallback;
        }
    }

    function saveFakeLinkContextOptions(options = {}) {
        const normalized = {
            includeCharPersona: !!options.includeCharPersona,
            includeUserPersona: !!options.includeUserPersona
        };
        try {
            if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                window.StorageManager.save(FAKE_LINK_CONTEXT_OPTIONS_KEY, normalized);
            } else if (window.localStorage) {
                window.localStorage.setItem(FAKE_LINK_CONTEXT_OPTIONS_KEY, JSON.stringify(normalized));
            }
        } catch (_) {}
        return normalized;
    }

    function getFakeLinkAppContainer() {
        return document.getElementById('app') || document.body;
    }

    function focusFakeLinkControl(element) {
        if (!element || typeof element.focus !== 'function') return;
        try {
            element.focus({ preventScroll: true });
        } catch (_) {
            element.focus();
        }
    }

    function resolveFakeLinkWorldBookContext(friend, contextText = '') {
        const positions = ['system_depth', 'before_role', 'after_role'];
        const sections = [];
        positions.forEach((position) => {
            let text = '';
            if (friend && window.imApp?.getWorldBookContextForFriendByPosition) {
                text = window.imApp.getWorldBookContextForFriendByPosition(position, friend, contextText) || '';
            } else if (window.getGlobalWorldBookContextByPosition) {
                text = window.getGlobalWorldBookContextByPosition(position, contextText) || '';
            }
            if (text) sections.push(position + ':\n' + text);
        });
        return sections.join('\n\n');
    }

    function resolveFakeLinkCharPersona(friend) {
        if (!friend || typeof friend !== 'object') return '';
        const name = friend.realName || friend.nickname || friend.name || 'Char';
        const persona = cleanText(friend.persona || friend.signature || friend.description || '', 5000);
        if (!persona) return '';
        return 'Char name: ' + name + '\nChar persona:\n' + persona;
    }

    function resolveFakeLinkUserPersona(friend) {
        const user = window.getUserState ? window.getUserState() : (window.userState || {});
        const name = user.name || user.realName || 'User';
        const persona = cleanText(
            (window.imApp?.getEffectivePersonaForFriend ? window.imApp.getEffectivePersonaForFriend(friend) : '') ||
            user.persona ||
            user.signature ||
            '',
            5000
        );
        if (!persona) return '';
        return 'User name: ' + name + '\nUser persona:\n' + persona;
    }

    function normalizeFakeLinkInput(value) {
        const raw = cleanText(value, 220);
        if (!raw || /[\u0000-\u001F\u007F]/.test(raw) || /[\s<>"'\x60\\]/.test(raw)) return null;
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) return null;

        const candidate = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
        try {
            const parsed = new URL(candidate);
            if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null;
            const domain = parsed.hostname.toLowerCase();
            const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
            const search = parsed.search || '';
            const displayUrl = (domain + path + search).replace(/\/+$/, '');
            if (!displayUrl || displayUrl.length > 180) return null;
            return {
                domain,
                path,
                search,
                displayUrl,
                canonicalUrl: 'https://' + displayUrl
            };
        } catch (_) {
            return null;
        }
    }

    function normalizeFakeLinkDomain(value) {
        const normalized = normalizeFakeLinkInput(value);
        return normalized ? normalized.displayUrl : '';
    }

    function resolveChatCompletionsEndpoint(config = {}) {
        const endpoint = String(config.endpoint || '').trim().replace(/\/+$/, '');
        if (!endpoint) return '';
        if (/\/chat\/completions$/i.test(endpoint)) return endpoint;
        return endpoint.endsWith('/v1') ? endpoint + '/chat/completions' : endpoint + '/v1/chat/completions';
    }

    function extractJsonObject(text) {
        const raw = String(text || '').trim();
        if (!raw) return null;
        const fencePattern = new RegExp('\\x60\\x60\\x60(?:json)?\\s*([\\s\\S]*?)\\x60\\x60\\x60', 'i');
        const fenced = raw.match(fencePattern);
        const candidate = fenced ? fenced[1].trim() : raw;
        try {
            return JSON.parse(candidate);
        } catch (_) {
            const start = candidate.indexOf('{');
            const end = candidate.lastIndexOf('}');
            if (start >= 0 && end > start) {
                try { return JSON.parse(candidate.slice(start, end + 1)); } catch (_) {}
            }
        }
        return null;
    }

    function sanitizeFakeLinkHtmlForStorage(value) {
        let html = cleanText(value, 80000);
        if (!html) return '';
        html = html
            .replace(/<\s*(script|style|iframe|object|embed|svg|canvas|link|meta|base|form|input|textarea|select|option)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
            .replace(/<\s*\/?\s*(script|style|iframe|object|embed|svg|canvas|link|meta|base|form|input|textarea|select|option)[^>]*>/gi, '')
            .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
            .replace(/\s+(href|src|srcset|action|formaction)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (match, attrName, attrValue) => {
                if (String(attrName || '').toLowerCase() === 'src') {
                    const srcValue = String(attrValue || '').replace(/^['"]|['"]$/g, '');
                    if (isAllowedFakeLinkImageUrl(srcValue)) {
                        return ' src="' + escapeHtml(srcValue) + '" loading="lazy"';
                    }
                }
                return '';
            })
            .replace(/\s+style\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
        return html.slice(0, 80000);
    }

    function sanitizeFakeLinkCssForStorage(value) {
        return cleanText(value, 40000)
            .replace(/@import[^;]+;/gi, '')
            .replace(/url\s*\([^)]*\)/gi, 'none')
            .replace(/expression\s*\([^)]*\)/gi, '')
            .replace(/javascript\s*:/gi, '')
            .replace(/behavior\s*:/gi, '')
            .replace(/-moz-binding\s*:/gi, '')
            .replace(/position\s*:\s*fixed\s*;?/gi, 'position:absolute;')
            .slice(0, 40000);
    }

    function normalizeFakeLinkInteraction(source = {}) {
        if (!source || typeof source !== 'object') return null;
        const allowedTypes = new Set(['toggleClass', 'toggleText', 'increment', 'switchPanel']);
        const type = allowedTypes.has(source.type) ? source.type : 'toggleClass';
        const selector = cleanText(source.selector || source.target || '', 160);
        if (!selector || /[<>{}]/.test(selector)) return null;
        return {
            type,
            selector,
            targetSelector: cleanText(source.targetSelector || source.target || selector, 160),
            className: cleanText(source.className || 'is-active', 60) || 'is-active',
            activeText: cleanText(source.activeText || '', 80),
            inactiveText: cleanText(source.inactiveText || '', 80),
            countSelector: cleanText(source.countSelector || '', 160),
            panelGroup: cleanText(source.panelGroup || '', 80)
        };
    }

    function normalizeFakeLinkWebPage(source = {}, fallback = {}) {
        const safeSource = source && typeof source === 'object' ? source : {};
        const theme = cleanText(safeSource.theme || fallback.theme || 'generic', 40).toLowerCase() || 'generic';
        const rawHtml = injectRandomFakeLinkImages(safeSource.html || safeSource.bodyHtml || '', {
            domain: fallback.domain || safeSource.domain || '',
            prompt: fallback.prompt || safeSource.prompt || '',
            theme,
            siteName: fallback.siteName || safeSource.siteName || ''
        });
        const html = sanitizeFakeLinkHtmlForStorage(rawHtml);
        const css = sanitizeFakeLinkCssForStorage(safeSource.css || safeSource.style || '');
        const rawInteractions = Array.isArray(safeSource.interactions) ? safeSource.interactions : [];
        const interactions = rawInteractions
            .map(normalizeFakeLinkInteraction)
            .filter(Boolean)
            .slice(0, 24);
        return {
            theme,
            html,
            css,
            interactions,
            source: cleanText(safeSource.source || fallback.source || '', 30)
        };
    }

    function splitBodyParagraphs(bodyText) {
        const parts = cleanText(bodyText, 12000)
            .split(/\n{2,}|\r?\n/)
            .map(part => cleanText(part, 1200))
            .filter(Boolean);
        return parts.length ? parts : ['这个页面内容由手动填写生成，展示为通用美化网页。'];
    }

    function buildManualFakeLinkWebPage({ siteName, title, summary, bodyText, displayUrl, theme = 'generic' } = {}) {
        const safeSite = cleanText(siteName, 80) || 'Web';
        const safeTitle = cleanText(title, 180) || safeSite;
        const safeSummary = cleanText(summary, 800) || cleanText(bodyText, 160);
        const safeDisplayUrl = cleanText(displayUrl, 180);
        const paragraphs = splitBodyParagraphs(bodyText);
        const paragraphsHtml = paragraphs
            .map(part => '<p>' + escapeHtml(part) + '</p>')
            .join('');
        const tags = safeDisplayUrl
            .split(/[./?&=-]+/)
            .map(part => cleanText(part, 18))
            .filter(part => part && part.length > 2)
            .slice(0, 3);
        const tagHtml = tags.length
            ? tags.map(tag => '<span>#' + escapeHtml(tag) + '</span>').join('')
            : '<span>#站内网页</span><span>#链接预览</span>';
        const html = [
            '<article class="u2-fake-generic-page">',
            '  <header class="u2-fake-generic-hero">',
            '    <div class="u2-fake-generic-site">' + escapeHtml(safeSite) + '</div>',
            '    <h1>' + escapeHtml(safeTitle) + '</h1>',
            safeSummary ? '    <p class="u2-fake-generic-summary">' + escapeHtml(safeSummary) + '</p>' : '',
            '  </header>',
            '  <section class="u2-fake-generic-card">',
            '    <div class="u2-fake-generic-cover"><span>' + escapeHtml(safeSite.charAt(0).toUpperCase() || 'W') + '</span></div>',
            '    <div class="u2-fake-generic-tags">' + tagHtml + '</div>',
            '    <div class="u2-fake-generic-body">' + paragraphsHtml + '</div>',
            '    <div class="u2-fake-generic-actions">',
            '      <button type="button" data-fake-action="like">♡ 喜欢 <span data-fake-count="like">12</span></button>',
            '      <button type="button" data-fake-action="save">☆ 收藏</button>',
            '      <button type="button" data-fake-action="comments">评论 3</button>',
            '    </div>',
            '    <div class="u2-fake-generic-comments" data-fake-panel="comments">',
            '      <strong>精选评论</strong>',
            '      <p>这个页面看起来很完整，信息也挺自然。</p>',
            '      <p>细节做得不错，像是真的网页截图延展开了。</p>',
            '      <p>已收藏，晚点再细看。</p>',
            '    </div>',
            '  </section>',
            '</article>'
        ].filter(Boolean).join('');
        const css = [
            '.u2-fake-generic-page{min-height:100%;background:linear-gradient(180deg,#f8f8fb 0%,#fff 38%);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#111;}',
            '.u2-fake-generic-hero{padding:24px 18px 16px;}',
            '.u2-fake-generic-site{color:#0a84ff;font-size:12px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;}',
            '.u2-fake-generic-hero h1{margin:10px 0 0;font-size:27px;line-height:1.12;letter-spacing:-.05em;}',
            '.u2-fake-generic-summary{margin:12px 0 0;color:#636366;font-size:15px;line-height:1.55;}',
            '.u2-fake-generic-card{margin:0 14px 24px;border-radius:26px;background:#fff;box-shadow:0 16px 42px rgba(0,0,0,.09);overflow:hidden;}',
            '.u2-fake-generic-cover{height:150px;background:radial-gradient(circle at 25% 20%,#8fd3ff,transparent 36%),linear-gradient(135deg,#111827,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;}',
            '.u2-fake-generic-cover span{width:70px;height:70px;border-radius:24px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:900;backdrop-filter:blur(12px);}',
            '.u2-fake-generic-tags{display:flex;flex-wrap:wrap;gap:7px;padding:15px 15px 0;}',
            '.u2-fake-generic-tags span{border-radius:999px;background:#f2f2f7;color:#0a84ff;padding:6px 10px;font-size:12px;font-weight:800;}',
            '.u2-fake-generic-body{padding:14px 16px 4px;font-size:15px;line-height:1.72;}',
            '.u2-fake-generic-body p{margin:0 0 13px;}',
            '.u2-fake-generic-actions{display:flex;gap:8px;padding:12px 14px;border-top:1px solid #f2f2f7;}',
            '.u2-fake-generic-actions button{flex:1;border:0;border-radius:15px;background:#f7f7fa;color:#3a3a3c;min-height:38px;font-weight:800;}',
            '.u2-fake-generic-actions button.is-active{background:#111;color:#fff;}',
            '.u2-fake-generic-comments{display:none;padding:0 16px 17px;color:#3a3a3c;font-size:13px;line-height:1.45;}',
            '.u2-fake-generic-comments.is-open{display:block;}',
            '.u2-fake-generic-comments strong{display:block;margin:4px 0 8px;color:#111;}',
            '.u2-fake-generic-comments p{margin:7px 0;padding:9px 11px;border-radius:14px;background:#f7f7fa;}'
        ].join('');
        return {
            theme,
            html,
            css,
            interactions: [
                { type: 'toggleClass', selector: '[data-fake-action="like"]', className: 'is-active' },
                { type: 'increment', selector: '[data-fake-action="like"]', countSelector: '[data-fake-count="like"]' },
                { type: 'toggleClass', selector: '[data-fake-action="save"]', className: 'is-active' },
                { type: 'toggleClass', selector: '[data-fake-action="comments"]', targetSelector: '[data-fake-panel="comments"]', className: 'is-open' }
            ],
            source: 'manual'
        };
    }

    function buildFakeLinkPrompt({ domain, prompt, worldBookContext = '', charPersonaContext = '', userPersonaContext = '', includeCharPersona = false, includeUserPersona = false }) {
        const contextLines = [
            '',
            '图片要求：页面中凡是图片、封面、配图、头像、商品图、笔记图的位置，都必须输出 <img> 标签；src 可以留空或使用 https://picsum.photos/seed/...，系统会统一替换为 allowlist 随机图片链接。不要使用其它外部图片链接。',
            '世界书上下文（生成时必须参考；如为空则忽略）：',
            worldBookContext || '无'
        ];
        if (includeCharPersona && charPersonaContext) {
            contextLines.push('', 'Char 人设（用户开启时参考）：', charPersonaContext);
        }
        if (includeUserPersona && userPersonaContext) {
            contextLines.push('', 'User 人设（用户开启时参考）：', userPersonaContext);
        }
        return [
            '你正在为站内 iMessage 假链接功能生成一个“虚构但可信的仿真网页”。',
            '不要访问真实网站，不要声称读取了真实页面；只根据域名和用户提示创作。',
            '只返回合法 JSON，不要 Markdown，不要解释。',
            'JSON 顶层字段固定为：',
            '{"siteName":"站点名","title":"卡片标题","summary":"卡片摘要","bodyText":"纯文本页面内容摘要","webPage":{"theme":"xiaohongshu|news|shop|generic","html":"受控 HTML","css":"受控 CSS","interactions":[]}}',
            'webPage.html 要包含完整页面主体结构，可做小红书式笔记、评论区、点赞栏、购物页、新闻页等，但不要包含 html/head/body 外壳。',
            'webPage.css 只写页面内部样式，不要使用 @import、url()、position:fixed、外部字体或外部图片。',
            '禁止输出 <script>、iframe、form、input、textarea、select、外链、登录、支付、账号密码采集。',
            '如果需要 JS 效果，只能在 interactions 里输出受控交互配置；允许 type 为 toggleClass、toggleText、increment、switchPanel。',
            '示例 interaction：{"type":"toggleClass","selector":"[data-fake-action=\\"like\\"]","className":"is-active"}。',
            '如果用户要求“小红书”，请生成类似笔记详情页：作者栏、图文内容、标签、点赞/收藏/评论栏、3-6 条自然评论。',
            'bodyText 必须是纯文本，概括页面正文和评论，控制在 600-1500 字；不能包含 HTML。',
            '',
            '域名：' + domain,
            '用户提示：' + (prompt || '根据域名生成一个可读、可信、排版精致的虚构网页。')
        ].concat(contextLines).join('\n');
    }

    async function requestFakeLinkAiContent({ domain, prompt, friend = null, includeCharPersona = false, includeUserPersona = false }) {
        const api = window.getApiConfig ? window.getApiConfig() : (window.apiConfig || {});
        const endpoint = resolveChatCompletionsEndpoint(api);
        if (!endpoint || !api.apiKey || !api.model) {
            throw new Error('API_NOT_CONFIGURED');
        }
        const contextText = [domain, prompt || ''].filter(Boolean).join('\n');
        const worldBookContext = resolveFakeLinkWorldBookContext(friend, contextText);
        const charPersonaContext = includeCharPersona ? resolveFakeLinkCharPersona(friend) : '';
        const userPersonaContext = includeUserPersona ? resolveFakeLinkUserPersona(friend) : '';

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + api.apiKey,
                'X-U2-Silent-Errors': '1'
            },
            body: JSON.stringify({
                model: api.model,
                temperature: Number.isFinite(Number(api.temperature)) ? Number(api.temperature) : 0.72,
                messages: [
                    { role: 'system', content: '你是受控网页包生成器。只输出严格 JSON；不输出脚本、外链、登录、支付或钓鱼内容。' },
                    { role: 'user', content: buildFakeLinkPrompt({
                        domain,
                        prompt,
                        worldBookContext,
                        charPersonaContext,
                        userPersonaContext,
                        includeCharPersona,
                        includeUserPersona
                    }) }
                ]
            })
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) {
            throw new Error('HTTP_' + response.status);
        }
        const text = payload.choices?.[0]?.message?.content || payload.choices?.[0]?.text || '';
        const parsed = extractJsonObject(text);
        if (!parsed || typeof parsed !== 'object') {
            throw new Error('INVALID_JSON');
        }

        const siteName = cleanText(parsed.siteName, 80);
        const title = cleanText(parsed.title, 180);
        const summary = cleanText(parsed.summary, 800);
        const pageSource = parsed.webPage && typeof parsed.webPage === 'object'
            ? parsed.webPage
            : {
                theme: parsed.theme,
                html: parsed.html || parsed.bodyHtml,
                css: parsed.css || parsed.style,
                interactions: parsed.interactions
            };
        let webPage = normalizeFakeLinkWebPage(pageSource, { source: 'ai', domain, prompt, siteName });
        const bodyText = cleanText(
            parsed.bodyText || parsed.pageText || stripHtmlToPlainText(webPage.html, 50000) || summary,
            50000
        );

        if (!webPage.html) {
            webPage = buildManualFakeLinkWebPage({
                siteName,
                title,
                summary,
                bodyText,
                displayUrl: domain,
                theme: webPage.theme || 'generic'
            });
            webPage.source = 'ai-fallback';
        } else {
            webPage.source = 'ai';
        }

        return {
            siteName,
            title,
            summary,
            bodyText,
            webPage
        };
    }

    function createFakeLinkComposer(page) {
        const host = getFakeLinkAppContainer();
        let overlay = document.getElementById('im-fake-link-composer-overlay') || document.querySelector('.im-fake-link-composer-overlay');
        if (overlay) {
            if (overlay.parentNode !== host) host.appendChild(overlay);
            overlay._imFakeLinkPage = page;
            return overlay;
        }

        overlay = document.createElement('div');
        overlay.id = 'im-fake-link-composer-overlay';
        overlay.className = 'im-fake-link-composer-overlay';
        overlay.innerHTML = [
            '<div class="im-fake-link-composer-backdrop"></div>',
            '<section class="im-fake-link-composer-card" role="dialog" aria-modal="true" aria-label="发送链接">',
            '  <header class="im-fake-link-composer-header">',
            '    <button type="button" class="im-fake-link-composer-close" aria-label="关闭"><i class="fas fa-times"></i></button>',
            '    <strong>发送链接</strong>',
            '    <span></span>',
            '  </header>',
            '  <div class="im-fake-link-composer-tabs" role="tablist">',
            '    <button type="button" class="im-fake-link-tab active" data-tab="ai" role="tab" aria-selected="true">AI 生成</button>',
            '    <button type="button" class="im-fake-link-tab" data-tab="manual" role="tab" aria-selected="false">手动填入</button>',
            '  </div>',
            '  <div class="im-fake-link-composer-body">',
            '    <div class="im-fake-link-panel active" data-panel="ai">',
            '      <label class="im-fake-link-field"><span>域名 / 地址</span><input class="im-fake-link-ai-domain-input" type="text" inputmode="url" autocomplete="off" placeholder="xiaohongshu.com/explore/example"></label>',
            '      <label class="im-fake-link-field"><span>提示词</span><textarea class="im-fake-link-ai-prompt-input" rows="4" placeholder="例如：生成一个小红书笔记页，主题是深夜咖啡店探店，带作者、正文、标签和评论"></textarea></label>',
            '      <div class="im-fake-link-context-options">',
            '        <label class="im-fake-link-context-toggle"><input class="im-fake-link-char-persona-toggle" type="checkbox"><span>挂载 char 人设</span></label>',
            '        <label class="im-fake-link-context-toggle"><input class="im-fake-link-user-persona-toggle" type="checkbox"><span>挂载 user 人设</span></label>',
            '      </div>',
            '      <div class="im-fake-link-generation-row"><button type="button" class="im-fake-link-generate-btn" aria-label="调用 API 生成网页" title="调用 API 生成网页"><i class="fas fa-search"></i></button><span class="im-fake-link-status">输入域名和提示词后，点搜索调用 API</span></div>',
            '    </div>',
            '    <div class="im-fake-link-panel" data-panel="manual" hidden>',
            '      <label class="im-fake-link-field"><span>域名 / 地址</span><input class="im-fake-link-manual-domain-input" type="text" inputmode="url" autocomplete="off" placeholder="example.com/page"></label>',
            '      <div class="im-fake-link-edit-grid">',
            '        <label class="im-fake-link-field"><span>站点名</span><input class="im-fake-link-site-input" type="text" autocomplete="off" placeholder="站点名"></label>',
            '        <label class="im-fake-link-field"><span>标题</span><input class="im-fake-link-title-input" type="text" autocomplete="off" placeholder="网页标题"></label>',
            '      </div>',
            '      <label class="im-fake-link-field"><span>摘要</span><textarea class="im-fake-link-summary-input" rows="2" placeholder="显示在聊天卡片里的简短摘要"></textarea></label>',
            '      <label class="im-fake-link-field"><span>正文</span><textarea class="im-fake-link-body-input" rows="7" placeholder="打开假网页后显示的正文；会自动套用通用美化网页"></textarea></label>',
            '    </div>',
            '    <div class="im-fake-link-preview" hidden>',
            '      <div class="im-fake-link-preview-cover"><i class="fas fa-link"></i></div>',
            '      <div class="im-fake-link-preview-copy">',
            '        <div class="im-fake-link-preview-site"></div>',
            '        <div class="im-fake-link-preview-title"></div>',
            '        <div class="im-fake-link-preview-summary"></div>',
            '        <div class="im-fake-link-preview-url"></div>',
            '      </div>',
            '    </div>',
            '    <div class="im-fake-link-web-mini-preview" hidden>',
            '      <div class="im-fake-link-web-mini-label">仿真网页预览</div>',
            '      <div class="im-fake-link-web-mini-frame"></div>',
            '    </div>',
            '  </div>',
            '  <footer class="im-fake-link-composer-actions">',
            '    <button type="button" class="im-fake-link-composer-cancel">取消</button>',
            '    <button type="button" class="im-fake-link-composer-send">发送</button>',
            '  </footer>',
            '</section>'
        ].join('');
        host.appendChild(overlay);
        overlay._imFakeLinkPage = page;

        const tabButtons = Array.from(overlay.querySelectorAll('.im-fake-link-tab'));
        const panels = Array.from(overlay.querySelectorAll('.im-fake-link-panel'));
        const aiDomainInput = overlay.querySelector('.im-fake-link-ai-domain-input');
        const aiPromptInput = overlay.querySelector('.im-fake-link-ai-prompt-input');
        const includeCharPersonaInput = overlay.querySelector('.im-fake-link-char-persona-toggle');
        const includeUserPersonaInput = overlay.querySelector('.im-fake-link-user-persona-toggle');
        const manualDomainInput = overlay.querySelector('.im-fake-link-manual-domain-input');
        const siteInput = overlay.querySelector('.im-fake-link-site-input');
        const titleInput = overlay.querySelector('.im-fake-link-title-input');
        const summaryInput = overlay.querySelector('.im-fake-link-summary-input');
        const bodyInput = overlay.querySelector('.im-fake-link-body-input');
        const generateButton = overlay.querySelector('.im-fake-link-generate-btn');
        const statusText = overlay.querySelector('.im-fake-link-status');
        const preview = overlay.querySelector('.im-fake-link-preview');
        const previewSite = overlay.querySelector('.im-fake-link-preview-site');
        const previewTitle = overlay.querySelector('.im-fake-link-preview-title');
        const previewSummary = overlay.querySelector('.im-fake-link-preview-summary');
        const previewUrl = overlay.querySelector('.im-fake-link-preview-url');
        const miniPreview = overlay.querySelector('.im-fake-link-web-mini-preview');
        const miniFrame = overlay.querySelector('.im-fake-link-web-mini-frame');
        const closeButton = overlay.querySelector('.im-fake-link-composer-close');
        const cancelButton = overlay.querySelector('.im-fake-link-composer-cancel');
        const sendButton = overlay.querySelector('.im-fake-link-composer-send');
        const backdrop = overlay.querySelector('.im-fake-link-composer-backdrop');
        const savedContextOptions = loadFakeLinkContextOptions();
        if (includeCharPersonaInput) includeCharPersonaInput.checked = savedContextOptions.includeCharPersona;
        if (includeUserPersonaInput) includeUserPersonaInput.checked = savedContextOptions.includeUserPersona;

        const state = {
            activeTab: 'ai',
            generatedBy: 'manual',
            generatedData: null,
            sending: false,
            generating: false
        };
        overlay._imFakeLinkState = state;

        function setGenerateButtonLoading(isLoading) {
            if (!generateButton) return;
            const icon = generateButton.querySelector('i');
            if (icon) icon.className = isLoading ? 'fas fa-spinner fa-spin' : 'fas fa-search';
            generateButton.setAttribute('aria-busy', String(!!isLoading));
        }

        function setStatus(message, tone = 'idle') {
            if (!statusText) return;
            statusText.textContent = message || '';
            statusText.dataset.status = tone;
        }

        function getActiveDomainInput() {
            return state.activeTab === 'manual' ? manualDomainInput : aiDomainInput;
        }

        function buildDataFromManual(normalized) {
            const displayUrl = normalized?.displayUrl || cleanText(manualDomainInput.value, 180);
            const domain = normalized?.domain || '';
            const siteName = cleanText(siteInput.value, 80) || domain || displayUrl || 'Web';
            const title = cleanText(titleInput.value, 180) || siteName;
            const summary = cleanText(summaryInput.value, 800);
            const bodyText = cleanText(bodyInput.value, 50000);
            return {
                domain,
                displayUrl,
                canonicalUrl: normalized?.canonicalUrl || '',
                siteName,
                title,
                summary,
                bodyText,
                prompt: '',
                generatedBy: 'manual',
                webPage: buildManualFakeLinkWebPage({ siteName, title, summary, bodyText, displayUrl, theme: 'generic' }),
                createdAt: Date.now()
            };
        }

        function buildDataFromAi(normalized) {
            const displayUrl = normalized?.displayUrl || cleanText(aiDomainInput.value, 180);
            const domain = normalized?.domain || '';
            const generated = state.generatedData || {};
            const siteName = cleanText(generated.siteName, 80) || domain || displayUrl || 'AI Web';
            const title = cleanText(generated.title, 180) || siteName;
            const summary = cleanText(generated.summary, 800);
            const bodyText = cleanText(generated.bodyText, 50000);
            const webPage = generated.webPage && generated.webPage.html
                ? normalizeFakeLinkWebPage(generated.webPage, { source: 'ai' })
                : null;
            return {
                domain,
                displayUrl,
                canonicalUrl: normalized?.canonicalUrl || '',
                siteName,
                title,
                summary,
                bodyText,
                prompt: cleanText(aiPromptInput.value, 1000),
                includeCharPersona: !!includeCharPersonaInput?.checked,
                includeUserPersona: !!includeUserPersonaInput?.checked,
                generatedBy: webPage ? 'ai' : 'manual',
                webPage,
                createdAt: Date.now()
            };
        }

        function getDraftData() {
            const domainInput = getActiveDomainInput();
            const normalized = normalizeFakeLinkInput(domainInput.value);
            const data = state.activeTab === 'manual'
                ? buildDataFromManual(normalized)
                : buildDataFromAi(normalized);
            return { normalized, data };
        }

        function renderMiniPreview(webPage) {
            if (!miniPreview || !miniFrame) return;
            if (!webPage || !webPage.html) {
                miniPreview.hidden = true;
                miniFrame.innerHTML = '';
                return;
            }
            miniPreview.hidden = false;
            miniFrame.innerHTML = '<div class="im-fake-link-web-mini-root">' + sanitizeFakeLinkHtmlForStorage(webPage.html) + '</div>';
        }

        function renderPreview() {
            const domainInput = getActiveDomainInput();
            const draft = getDraftData();
            const normalized = draft.normalized;
            const data = draft.data;
            preview.hidden = !normalized;
            if (!normalized) {
                renderMiniPreview(null);
                if (domainInput.value.trim()) setStatus('请输入有效域名或 http/https 地址', 'error');
                else setStatus(state.activeTab === 'ai' ? '输入域名和提示词后，点搜索调用 API' : DEFAULT_FAKE_LINK_STATUS, 'idle');
                return;
            }
            previewSite.textContent = data.siteName;
            previewTitle.textContent = data.title;
            previewSummary.textContent = data.summary || data.bodyText.slice(0, 120) || '站内仿真网页内容';
            previewUrl.textContent = data.displayUrl;
            renderMiniPreview(data.webPage);
            if (state.activeTab === 'ai') {
                setStatus(data.webPage ? 'AI 网页已生成，可以发送或重新生成' : '填写提示词后点击搜索生成网页', data.webPage ? 'ready' : 'idle');
            } else {
                setStatus('手动网页预览已就绪，可以发送', 'ready');
            }
        }

        function setActiveTab(tab) {
            state.activeTab = tab === 'manual' ? 'manual' : 'ai';
            tabButtons.forEach((button) => {
                const active = button.dataset.tab === state.activeTab;
                button.classList.toggle('active', active);
                button.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            panels.forEach((panel) => {
                const active = panel.dataset.panel === state.activeTab;
                panel.classList.toggle('active', active);
                panel.hidden = !active;
            });
            renderPreview();
        }

        function closeComposer() {
            const activeElement = document.activeElement;
            if (activeElement && overlay.contains(activeElement) && typeof activeElement.blur === 'function') {
                activeElement.blur();
            }
            state.sending = false;
            state.generating = false;
            overlay.classList.remove('active');
            setTimeout(() => {
                if (!overlay.classList.contains('active')) overlay.style.display = 'none';
            }, 220);
        }

        async function generateContent() {
            const normalized = normalizeFakeLinkInput(aiDomainInput.value);
            if (!normalized) {
                setStatus('请先输入有效域名', 'error');
                focusFakeLinkControl(aiDomainInput);
                return;
            }
            if (state.generating) return;
            state.generating = true;
            state.generatedData = null;
            generateButton.disabled = true;
            setGenerateButtonLoading(true);
            setStatus('正在让 AI 生成仿真网页…', 'loading');
            renderPreview();
            try {
                const contextOptions = saveFakeLinkContextOptions({
                    includeCharPersona: !!includeCharPersonaInput?.checked,
                    includeUserPersona: !!includeUserPersonaInput?.checked
                });
                const generated = await requestFakeLinkAiContent({
                    domain: normalized.displayUrl,
                    prompt: cleanText(aiPromptInput.value, 1000),
                    friend: window.imData?.currentActiveFriend || null,
                    includeCharPersona: contextOptions.includeCharPersona,
                    includeUserPersona: contextOptions.includeUserPersona
                });
                state.generatedData = {
                    ...generated,
                    siteName: generated.siteName || normalized.domain,
                    title: generated.title || normalized.domain,
                    includeCharPersona: contextOptions.includeCharPersona,
                    includeUserPersona: contextOptions.includeUserPersona,
                    webPage: normalizeFakeLinkWebPage(generated.webPage, {
                        source: 'ai',
                        domain: normalized.displayUrl,
                        prompt: cleanText(aiPromptInput.value, 1000),
                        siteName: generated.siteName || normalized.domain
                    })
                };
                state.generatedBy = 'ai';
                renderPreview();
            } catch (error) {
                console.warn('[iMessage fake link] AI generation failed', error);
                const message = error && error.message === 'API_NOT_CONFIGURED'
                    ? '未配置 API，请到设置里填写后再生成'
                    : 'AI 生成失败，可切到手动填入';
                setStatus(message, 'error');
                if (window.showToast) window.showToast(message);
            } finally {
                state.generating = false;
                generateButton.disabled = false;
                setGenerateButtonLoading(false);
            }
        }

        async function sendFakeLinkMessage() {
            if (state.sending) return;
            const draft = getDraftData();
            const normalized = draft.normalized;
            const data = draft.data;
            const domainInput = getActiveDomainInput();
            if (!normalized) {
                setStatus('请先输入有效域名', 'error');
                focusFakeLinkControl(domainInput);
                return;
            }
            if (state.activeTab === 'ai' && (!data.webPage || !data.webPage.html)) {
                setStatus('请先点击搜索生成网页', 'error');
                focusFakeLinkControl(generateButton);
                return;
            }

            const friend = window.imData.currentActiveFriend;
            if (!friend || (friend.type === 'group' && Number(friend.leftGroupAt) > 0)) {
                if (window.showToast) window.showToast('当前聊天无法发送链接');
                return;
            }

            state.sending = true;
            sendButton.disabled = true;
            sendButton.textContent = '发送中…';
            const now = Date.now();
            const fakeLinkData = { ...data, createdAt: now };
            const msgObj = {
                id: imChat.createMessageId ? imChat.createMessageId('fake-link') : 'fake-link-' + now,
                role: 'user',
                type: 'fake_link',
                content: fakeLinkData.displayUrl,
                text: '[假链接] ' + fakeLinkData.siteName + '：' + fakeLinkData.title,
                fakeLinkData,
                timestamp: now
            };

            const saved = window.imApp.appendFriendMessage
                ? await window.imApp.appendFriendMessage(friend.id, msgObj, { silent: true })
                : false;
            if (!saved) {
                if (window.showToast) window.showToast('链接消息保存失败');
                state.sending = false;
                sendButton.disabled = false;
                sendButton.textContent = '发送';
                return;
            }

            const activePage = overlay._imFakeLinkPage || document.getElementById('chat-interface-' + friend.id) || page;
            const container = activePage ? activePage.querySelector('.ins-chat-messages') : null;
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
            sendButton.disabled = false;
            sendButton.textContent = '发送';
        }

        tabButtons.forEach(button => {
            button.addEventListener('click', () => setActiveTab(button.dataset.tab));
        });
        [aiDomainInput, aiPromptInput, manualDomainInput, siteInput, titleInput, summaryInput, bodyInput].forEach((node) => {
            node.addEventListener('input', () => {
                if (state.activeTab === 'ai' && (node === aiDomainInput || node === aiPromptInput)) {
                    state.generatedData = null;
                }
                renderPreview();
            });
        });
        generateButton.addEventListener('click', () => void generateContent());
        sendButton.addEventListener('click', () => void sendFakeLinkMessage());
        closeButton.addEventListener('click', closeComposer);
        cancelButton.addEventListener('click', closeComposer);
        backdrop.addEventListener('click', closeComposer);

        overlay._openFakeLinkComposer = () => {
            state.activeTab = 'ai';
            state.generatedBy = 'manual';
            state.generatedData = null;
            state.sending = false;
            state.generating = false;
            aiDomainInput.value = '';
            aiPromptInput.value = '';
            manualDomainInput.value = '';
            siteInput.value = '';
            titleInput.value = '';
            summaryInput.value = '';
            bodyInput.value = '';
            const nextContextOptions = loadFakeLinkContextOptions();
            if (includeCharPersonaInput) includeCharPersonaInput.checked = nextContextOptions.includeCharPersona;
            if (includeUserPersonaInput) includeUserPersonaInput.checked = nextContextOptions.includeUserPersona;
            sendButton.disabled = false;
            sendButton.textContent = '发送';
            generateButton.disabled = false;
            setGenerateButtonLoading(false);
            setActiveTab('ai');
            overlay.style.display = 'flex';
            void overlay.offsetWidth;
            overlay.classList.add('active');
        };

        return overlay;
    }

    function openFakeLinkComposer() {
        const friend = window.imData.currentActiveFriend;
        if (!friend) return;
        const page = document.getElementById('chat-interface-' + friend.id);
        if (!page) return;
        const overlay = createFakeLinkComposer(page);
        overlay._imFakeLinkPage = page;
        overlay._openFakeLinkComposer();
    }

    imChat.normalizeFakeLinkInput = normalizeFakeLinkInput;
    imChat.normalizeFakeLinkDomain = normalizeFakeLinkDomain;
    imChat.buildFakeLinkPrompt = buildFakeLinkPrompt;
    imChat.buildRandomFakeLinkImageUrl = buildRandomFakeLinkImageUrl;
    imChat.isAllowedFakeLinkImageUrl = isAllowedFakeLinkImageUrl;
    imChat.injectRandomFakeLinkImages = injectRandomFakeLinkImages;
    imChat.buildManualFakeLinkWebPage = buildManualFakeLinkWebPage;
    imChat.normalizeFakeLinkWebPage = normalizeFakeLinkWebPage;
    imChat.sanitizeFakeLinkHtmlForStorage = sanitizeFakeLinkHtmlForStorage;
    imChat.sanitizeFakeLinkCssForStorage = sanitizeFakeLinkCssForStorage;
    imChat.openFakeLinkComposer = openFakeLinkComposer;
});
