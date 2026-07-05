const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_BODY_CHARS = 50000;
const FETCH_TIMEOUT_MS = 12000;
const CACHE_TTL_SECONDS = 21600;

const PLATFORM_RULES = [
    { id: 'xiaohongshu', label: '小红书', hosts: ['xiaohongshu.com', 'xhslink.com'] },
    { id: 'douyin', label: '抖音', hosts: ['douyin.com', 'iesdouyin.com'] },
    { id: 'bilibili', label: '哔哩哔哩', hosts: ['bilibili.com', 'b23.tv'] },
    { id: 'weibo', label: '微博', hosts: ['weibo.com', 'weibo.cn', 't.cn'] }
];

class ResolverError extends Error {
    constructor(code, message, status = 422) {
        super(message);
        this.name = 'ResolverError';
        this.code = code;
        this.status = status;
    }
}

export function detectPlatform(input) {
    const parsed = input instanceof URL ? input : new URL(String(input));
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const match = PLATFORM_RULES.find(rule => rule.hosts.some(host => hostname === host || hostname.endsWith(`.${host}`)));
    return match ? { id: match.id, label: match.label } : { id: 'web', label: '网页' };
}

function parseIpv4(hostname) {
    const parts = String(hostname).split('.');
    if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part))) return null;
    const numbers = parts.map(Number);
    return numbers.every(number => number >= 0 && number <= 255) ? numbers : null;
}

export function isPrivateOrReservedIp(value) {
    const hostname = String(value || '').toLowerCase().replace(/^\[|\]$/g, '');
    const ipv4 = parseIpv4(hostname);
    if (ipv4) {
        const [a, b, c] = ipv4;
        return a === 0
            || a === 10
            || a === 127
            || (a === 100 && b >= 64 && b <= 127)
            || (a === 169 && b === 254)
            || (a === 172 && b >= 16 && b <= 31)
            || (a === 192 && b === 0)
            || (a === 192 && b === 168)
            || (a === 192 && b === 0 && c === 2)
            || (a === 198 && (b === 18 || b === 19))
            || (a === 198 && b === 51 && c === 100)
            || (a === 203 && b === 0 && c === 113)
            || a >= 224;
    }

    if (!hostname.includes(':')) return false;
    if (hostname === '::' || hostname === '::1') return true;
    if (/^(fc|fd)/.test(hostname) || /^fe[89ab]/.test(hostname) || hostname.startsWith('2001:db8:')) return true;
    const mappedIpv4 = hostname.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mappedIpv4 ? isPrivateOrReservedIp(mappedIpv4[1]) : false;
}

export function validateTargetUrl(input) {
    let parsed;
    try {
        parsed = input instanceof URL ? new URL(input.href) : new URL(String(input || '').trim());
    } catch (_) {
        throw new ResolverError('INVALID_URL', '链接格式无效', 400);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new ResolverError('UNSUPPORTED_PROTOCOL', '仅支持 http/https 链接', 400);
    }
    if (parsed.username || parsed.password) {
        throw new ResolverError('URL_CREDENTIALS_NOT_ALLOWED', '链接不能包含访问凭据', 400);
    }
    if (!parsed.hostname || parsed.href.length > 4096) {
        throw new ResolverError('INVALID_URL', '链接格式无效', 400);
    }
    if (parsed.port && !['80', '443'].includes(parsed.port)) {
        throw new ResolverError('PORT_NOT_ALLOWED', '仅允许标准 HTTP/HTTPS 端口', 400);
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
        hostname === 'localhost'
        || hostname.endsWith('.localhost')
        || hostname.endsWith('.local')
        || hostname.endsWith('.internal')
        || isPrivateOrReservedIp(hostname)
    ) {
        throw new ResolverError('PRIVATE_ADDRESS_BLOCKED', '不允许访问私网或本地地址', 400);
    }

    parsed.hash = '';
    return parsed;
}

function decodeHtmlEntities(value) {
    const named = {
        amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
        hellip: '…', middot: '·', copy: '©', reg: '®', ndash: '–', mdash: '—'
    };
    return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (full, entity) => {
        if (entity[0] === '#') {
            const codePoint = entity[1].toLowerCase() === 'x'
                ? Number.parseInt(entity.slice(2), 16)
                : Number.parseInt(entity.slice(1), 10);
            if (Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff) {
                try { return String.fromCodePoint(codePoint); } catch (_) { return full; }
            }
            return full;
        }
        return Object.prototype.hasOwnProperty.call(named, entity.toLowerCase()) ? named[entity.toLowerCase()] : full;
    });
}

function parseAttributes(tag) {
    const attributes = {};
    String(tag || '').replace(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g, (_, name, doubleQuoted, singleQuoted, bare) => {
        attributes[String(name).toLowerCase()] = decodeHtmlEntities(doubleQuoted ?? singleQuoted ?? bare ?? '').trim();
        return '';
    });
    return attributes;
}

function cleanText(value) {
    return decodeHtmlEntities(String(value || ''))
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[\t\r ]+/g, ' ')
        .replace(/ *\n+ */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function normalizePageText(value) {
    return cleanText(String(value || '')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
        .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, ' '));
}

function collectMeta(html) {
    const meta = new Map();
    const tags = String(html || '').match(/<meta\b[^>]*>/gi) || [];
    tags.forEach(tag => {
        const attrs = parseAttributes(tag);
        const key = String(attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
        const content = String(attrs.content || '').trim();
        if (key && content && !meta.has(key)) meta.set(key, content);
    });
    return meta;
}

function firstMeta(meta, keys) {
    for (const key of keys) {
        const value = meta.get(String(key).toLowerCase());
        if (value) return cleanText(value);
    }
    return '';
}

function resolveHttpUrl(value, baseUrl) {
    try {
        const parsed = new URL(String(value || '').trim(), baseUrl);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch (_) {
        return '';
    }
}

function parseJsonLd(html) {
    const values = [];
    const regex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = regex.exec(String(html || ''))) !== null) {
        const attrs = parseAttributes(match[1]);
        if (!String(attrs.type || '').toLowerCase().includes('ld+json')) continue;
        const raw = decodeHtmlEntities(match[2]).trim();
        if (!raw || raw.length > 500000) continue;
        try { values.push(JSON.parse(raw)); } catch (_) {}
    }
    return values;
}

function flattenJsonLd(value, output = []) {
    if (Array.isArray(value)) {
        value.forEach(item => flattenJsonLd(item, output));
    } else if (value && typeof value === 'object') {
        output.push(value);
        if (value['@graph']) flattenJsonLd(value['@graph'], output);
    }
    return output;
}

function jsonLdAuthor(value) {
    const author = value && value.author;
    if (typeof author === 'string') return cleanText(author);
    if (Array.isArray(author)) return author.map(item => typeof item === 'string' ? item : item && item.name).filter(Boolean).join(', ');
    return cleanText(author && author.name);
}

function jsonLdImages(value) {
    const images = [];
    const append = item => {
        if (typeof item === 'string') images.push(item);
        else if (item && typeof item === 'object') images.push(item.url || item.contentUrl || '');
    };
    const image = value && value.image;
    if (Array.isArray(image)) image.forEach(append); else append(image);
    return images.filter(Boolean);
}

function extractEmbeddedJsonString(html, keys) {
    for (const key of keys) {
        const expression = new RegExp(`"${key}"\\s*:\\s*("(?:\\\\.|[^"\\\\])*")`, 'i');
        const match = String(html || '').match(expression);
        if (!match) continue;
        try {
            const decoded = cleanText(JSON.parse(match[1]));
            if (decoded.length >= 10) return decoded;
        } catch (_) {}
    }
    return '';
}

function extractCanonicalUrl(html, baseUrl) {
    const links = String(html || '').match(/<link\b[^>]*>/gi) || [];
    for (const tag of links) {
        const attrs = parseAttributes(tag);
        if (String(attrs.rel || '').toLowerCase().split(/\s+/).includes('canonical')) {
            const canonical = resolveHttpUrl(attrs.href, baseUrl);
            if (canonical) return canonical;
        }
    }
    return baseUrl;
}

function extractMainHtml(html) {
    const source = String(html || '');
    const article = source.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
    if (article) return article[1];
    const main = source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
    if (main) return main[1];
    const body = source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    return body ? body[1] : source;
}

function platformEmbeddedBody(platform, html) {
    if (platform.id === 'xiaohongshu') return extractEmbeddedJsonString(html, ['desc', 'noteText', 'content']);
    if (platform.id === 'douyin') return extractEmbeddedJsonString(html, ['desc', 'caption']);
    if (platform.id === 'bilibili') return extractEmbeddedJsonString(html, ['description', 'dynamic', 'desc']);
    if (platform.id === 'weibo') return extractEmbeddedJsonString(html, ['text_raw', 'text', 'description']);
    return '';
}

function collectMedia(html, meta, jsonLdEntities, baseUrl, description) {
    const output = [];
    const seen = new Set();
    const append = (type, value, caption = '', captionSource = '') => {
        const url = resolveHttpUrl(value, baseUrl);
        if (!url || seen.has(url) || /\.(?:svg|ico)(?:$|\?)/i.test(url)) return;
        seen.add(url);
        output.push({ type, url, caption: cleanText(caption).slice(0, 1000), captionSource });
    };

    append('image', firstMeta(meta, ['og:image:secure_url', 'og:image', 'twitter:image']));
    jsonLdEntities.forEach(entity => jsonLdImages(entity).forEach(image => append('image', image)));

    const imageTags = String(html || '').match(/<img\b[^>]*>/gi) || [];
    imageTags.slice(0, 30).forEach(tag => {
        const attrs = parseAttributes(tag);
        const src = attrs.src || attrs['data-src'] || attrs['data-original'] || '';
        const width = Number(attrs.width) || 0;
        const height = Number(attrs.height) || 0;
        if ((width && width < 80) || (height && height < 80)) return;
        append('image', src, attrs.alt || attrs.title || '', attrs.alt || attrs.title ? 'page' : '');
    });

    append('video', firstMeta(meta, ['og:video:secure_url', 'og:video', 'twitter:player:stream']), description, description ? 'page' : '');
    return output.slice(0, 12);
}

export function extractPageData(html, finalUrl, originalUrl = finalUrl) {
    const safeFinalUrl = validateTargetUrl(finalUrl).href;
    const platform = detectPlatform(safeFinalUrl);
    const meta = collectMeta(html);
    const jsonLdEntities = parseJsonLd(html).flatMap(value => flattenJsonLd(value));
    const articleEntity = jsonLdEntities.find(entity => {
        const type = String(entity && entity['@type'] || '').toLowerCase();
        return /article|posting|news|socialmediapost|videoobject/.test(type);
    }) || jsonLdEntities[0] || {};
    const documentTitle = cleanText((String(html || '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
    const title = firstMeta(meta, ['og:title', 'twitter:title', 'title'])
        || cleanText(articleEntity.headline || articleEntity.name)
        || documentTitle;
    const description = firstMeta(meta, ['og:description', 'twitter:description', 'description'])
        || cleanText(articleEntity.description);
    const author = firstMeta(meta, ['author', 'article:author', 'og:article:author'])
        || jsonLdAuthor(articleEntity)
        || extractEmbeddedJsonString(html, ['nickname', 'userName', 'authorName']);
    const publishedAt = firstMeta(meta, ['article:published_time', 'og:published_time', 'datepublished'])
        || cleanText(articleEntity.datePublished || articleEntity.uploadDate);
    const jsonLdBody = cleanText(articleEntity.articleBody || articleEntity.text || '');
    const embeddedBody = platformEmbeddedBody(platform, html);
    const mainText = normalizePageText(extractMainHtml(html));
    let bodyText = jsonLdBody || embeddedBody || mainText || description;

    if (description && bodyText && bodyText !== description && !bodyText.includes(description) && bodyText.length < 1000) {
        bodyText = `${description}\n\n${bodyText}`;
    }

    const rawBodyLength = bodyText.length;
    const truncated = rawBodyLength > MAX_BODY_CHARS;
    bodyText = bodyText.slice(0, MAX_BODY_CHARS).trim();
    const canonicalUrl = extractCanonicalUrl(html, safeFinalUrl);
    const media = collectMedia(html, meta, jsonLdEntities, safeFinalUrl, description);
    const coverUrl = resolveHttpUrl(firstMeta(meta, ['og:image:secure_url', 'og:image', 'twitter:image']), safeFinalUrl)
        || (media.find(item => item.type === 'image') || {}).url
        || '';
    const warnings = [];
    if (!bodyText || bodyText.length < 20) warnings.push('BODY_NOT_FOUND');
    if (truncated) warnings.push('BODY_TRUNCATED');
    const status = bodyText && bodyText.length >= 20 ? 'resolved' : 'partial';

    return {
        ok: true,
        status,
        data: {
            originalUrl: validateTargetUrl(originalUrl).href,
            finalUrl: safeFinalUrl,
            canonicalUrl,
            platform: platform.id,
            platformLabel: platform.label,
            title: title.slice(0, 500),
            author: author.slice(0, 300),
            description: description.slice(0, 3000),
            bodyText,
            coverUrl,
            media,
            publishedAt: publishedAt.slice(0, 100),
            fetchedAt: Date.now(),
            truncated
        },
        warnings
    };
}

async function resolveDnsAddresses(hostname, signal) {
    const headers = { Accept: 'application/dns-json' };
    const query = async type => {
        const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, { headers, signal });
        if (!response.ok) throw new ResolverError('DNS_CHECK_FAILED', '无法验证目标域名', 502);
        const data = await response.json();
        return Array.isArray(data.Answer)
            ? data.Answer.filter(answer => answer && (answer.type === 1 || answer.type === 28)).map(answer => String(answer.data || ''))
            : [];
    };
    const [ipv4, ipv6] = await Promise.all([query('A'), query('AAAA')]);
    return [...ipv4, ...ipv6];
}

async function assertPublicDestination(url, signal) {
    const parsed = validateTargetUrl(url);
    if (parseIpv4(parsed.hostname) || parsed.hostname.includes(':')) return parsed;
    const addresses = await resolveDnsAddresses(parsed.hostname, signal);
    if (addresses.length === 0) throw new ResolverError('DNS_RESOLUTION_FAILED', '目标域名无可用公网地址', 422);
    if (addresses.some(isPrivateOrReservedIp)) {
        throw new ResolverError('PRIVATE_ADDRESS_BLOCKED', '目标域名解析到私网或保留地址', 400);
    }
    return parsed;
}

async function readLimitedText(response, maxBytes = MAX_RESPONSE_BYTES) {
    const contentLength = Number(response.headers.get('content-length')) || 0;
    if (contentLength > maxBytes) throw new ResolverError('RESPONSE_TOO_LARGE', '页面大小超过限制', 413);
    if (!response.body || typeof response.body.getReader !== 'function') {
        const text = await response.text();
        if (new TextEncoder().encode(text).byteLength > maxBytes) throw new ResolverError('RESPONSE_TOO_LARGE', '页面大小超过限制', 413);
        return text;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let total = 0;
    let text = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel();
            throw new ResolverError('RESPONSE_TOO_LARGE', '页面大小超过限制', 413);
        }
        text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
}

async function fetchPublicHtml(inputUrl, signal) {
    let currentUrl = validateTargetUrl(inputUrl);
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
        currentUrl = await assertPublicDestination(currentUrl, signal);
        const response = await fetch(currentUrl.href, {
            method: 'GET',
            redirect: 'manual',
            signal,
            headers: {
                Accept: 'text/html,application/xhtml+xml;q=0.9',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6',
                'User-Agent': 'u2phone-link-resolver/1.0 (public metadata preview)'
            }
        });

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (!location) throw new ResolverError('INVALID_REDIRECT', '目标返回了无效跳转', 422);
            if (redirectCount >= MAX_REDIRECTS) throw new ResolverError('TOO_MANY_REDIRECTS', '链接跳转次数过多', 422);
            currentUrl = validateTargetUrl(new URL(location, currentUrl));
            continue;
        }

        if (!response.ok) {
            throw new ResolverError(`REMOTE_HTTP_${response.status}`, `目标页面返回 HTTP ${response.status}`, 422);
        }
        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
            throw new ResolverError('UNSUPPORTED_CONTENT_TYPE', '目标不是可解析的网页', 415);
        }
        return { html: await readLimitedText(response), finalUrl: currentUrl.href };
    }
    throw new ResolverError('TOO_MANY_REDIRECTS', '链接跳转次数过多', 422);
}

function parseAllowedOrigins(env) {
    return String(env && env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
}

function corsHeaders(request, env) {
    const origin = request.headers.get('origin') || '';
    const allowedOrigins = parseAllowedOrigins(env);
    const wildcard = allowedOrigins.includes('*');
    const allowed = !origin || wildcard || allowedOrigins.includes(origin);
    if (!allowed) return null;
    return {
        'Access-Control-Allow-Origin': wildcard ? '*' : (origin || allowedOrigins[0] || 'null'),
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-U2-Silent-Errors',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin'
    };
}

function jsonResponse(body, status, cors = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...cors
        }
    });
}

async function cacheKeyFor(request, url) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url));
    const hex = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    return new Request(`${new URL(request.url).origin}/__link_cache/${hex}`, { method: 'GET' });
}

async function resolveLinkRequest(request, env, ctx, cors) {
    let payload;
    try { payload = await request.json(); } catch (_) {
        throw new ResolverError('INVALID_JSON', '请求体必须是 JSON', 400);
    }
    const originalUrl = validateTargetUrl(payload && payload.url).href;
    const cacheKey = await cacheKeyFor(request, originalUrl);
    const cache = typeof caches !== 'undefined' ? caches.default : null;
    if (cache) {
        const cached = await cache.match(cacheKey);
        if (cached) {
            const cachedBody = await cached.json();
            return jsonResponse(cachedBody, 200, { ...cors, 'X-Link-Resolver-Cache': 'HIT' });
        }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const { html, finalUrl } = await fetchPublicHtml(originalUrl, controller.signal);
        const result = extractPageData(html, finalUrl, originalUrl);
        if (cache) {
            const cacheResponse = new Response(JSON.stringify(result), {
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`
                }
            });
            ctx.waitUntil(cache.put(cacheKey, cacheResponse));
        }
        return jsonResponse(result, 200, { ...cors, 'X-Link-Resolver-Cache': 'MISS' });
    } catch (error) {
        if (error && error.name === 'AbortError') {
            throw new ResolverError('FETCH_TIMEOUT', '页面读取超时', 504);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function handleRequest(request, env = {}, ctx = { waitUntil() {} }) {
    const cors = corsHeaders(request, env);
    if (!cors) return jsonResponse({ ok: false, errorCode: 'ORIGIN_NOT_ALLOWED', error: '该来源不允许访问解析服务' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const pathname = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    if (request.method === 'GET' && pathname === '/health') {
        return jsonResponse({ ok: true, service: 'u2-link-resolver' }, 200, cors);
    }
    if (request.method !== 'POST' || pathname !== '/v1/resolve-link') {
        return jsonResponse({ ok: false, errorCode: 'NOT_FOUND', error: '接口不存在' }, 404, cors);
    }

    const contentType = String(request.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
        return jsonResponse({ ok: false, errorCode: 'UNSUPPORTED_REQUEST_TYPE', error: '请使用 application/json' }, 415, cors);
    }

    try {
        return await resolveLinkRequest(request, env, ctx, cors);
    } catch (error) {
        const normalized = error instanceof ResolverError
            ? error
            : new ResolverError('RESOLVE_FAILED', error && error.message ? error.message : '页面解析失败', 500);
        return jsonResponse({ ok: false, errorCode: normalized.code, error: normalized.message }, normalized.status, cors);
    }
}

export default {
    fetch: handleRequest
};
