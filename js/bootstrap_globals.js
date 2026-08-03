// ==========================================
// U2: bootstrap_globals.js
// 在各应用模块注册 DOMContentLoaded 回调之前，提前准备全局配置对象。
// 这样 iMessage 等模块即使先加载，也不会在初始化时拿到 undefined。
// ==========================================
(function () {
    const defaultApiConfig = {
        endpoint: '',
        apiKey: '',
        model: '',
        temperature: 0.7
    };

    const defaultImageGenerationConfig = {
        activeProvider: 'gemini',
        providers: {
            openai: {
                endpoint: 'https://api.openai.com/v1/images/generations',
                apiKey: '',
                model: 'gpt-image-1.5',
                size: '1024x1024'
            },
            gemini: {
                endpoint: 'https://generativelanguage.googleapis.com/v1beta/interactions',
                apiKey: '',
                model: 'gemini-3.1-flash-image',
                size: '1024x1024'
            },
            novelai: {
                endpoint: 'https://image.novelai.net/ai/generate-image',
                apiKey: '',
                model: '',
                size: '1024x1024'
            },
            grok: {
                endpoint: 'https://api.x.ai/v1/images/generations',
                apiKey: '',
                model: 'grok-imagine-image',
                size: '1024x1024'
            },
            relay: {
                endpoint: '',
                apiKey: '',
                model: '',
                size: '1024x1024'
            }
        }
    };

    const defaultMinimaxConfig = {
        region: 'cn',
        customEndpointEnabled: false,
        endpoint: '',
        apiKey: '',
        groupId: '',
        ttsModel: 'speech-02-hd'
    };

    const defaultUserState = {
        name: '',
        phone: '',
        persona: '',
        avatarUrl: null
    };

    function safeLoad(key, fallback) {
        try {
            if (window.StorageManager && typeof window.StorageManager.load === 'function') {
                return window.StorageManager.load(key, fallback);
            }

            return fallback;
        } catch (error) {
            console.warn(`[bootstrap_globals] Failed to load ${key}:`, error);
            return fallback;
        }
    }

    function normalizeApiConfig(value) {
        const normalized = sanitizeApiConfig({
            ...defaultApiConfig,
            ...(value && typeof value === 'object' ? value : {})
        });
        if (normalized.endpoint) {
            try {
                normalized.endpoint = resolveChatCompletionsEndpoint(normalized.endpoint);
            } catch (error) {
                // Keep the trimmed value so the settings UI can explain and correct it.
            }
        }
        return normalized;
    }

    function normalizeMinimaxConfig(value) {
        return {
            ...defaultMinimaxConfig,
            ...(value && typeof value === 'object' ? value : {})
        };
    }

    function normalizeImageGenerationConfig(value) {
        const source = value && typeof value === 'object' ? value : {};
        const sourceProviders = source.providers && typeof source.providers === 'object'
            ? source.providers
            : {};
        const providers = {};
        Object.keys(defaultImageGenerationConfig.providers).forEach((provider) => {
            const defaults = defaultImageGenerationConfig.providers[provider];
            const saved = sourceProviders[provider] && typeof sourceProviders[provider] === 'object'
                ? sourceProviders[provider]
                : {};
            providers[provider] = {
                endpoint: String(saved.endpoint ?? defaults.endpoint).trim(),
                apiKey: String(saved.apiKey ?? defaults.apiKey).trim(),
                model: String(saved.model ?? defaults.model).trim(),
                size: ['1024x1024', '1024x1536', '1536x1024'].includes(saved.size)
                    ? saved.size
                    : defaults.size
            };
        });
        const activeProvider = Object.prototype.hasOwnProperty.call(providers, source.activeProvider)
            ? source.activeProvider
            : defaultImageGenerationConfig.activeProvider;
        return { activeProvider, providers };
    }

    function safeSave(key, value) {
        try {
            if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                window.StorageManager.save(key, value);
                return;
            }
            console.warn(`[bootstrap_globals] StorageManager unavailable for ${key}`);
        } catch (error) {
            console.warn(`[bootstrap_globals] Failed to save ${key}:`, error);
        }
    }

    function resolveUserStateFromAccounts() {
        const accounts = safeLoad('u2_accounts', []);
        const currentAccountId = safeLoad('u2_currentAccountId', null);

        if (Array.isArray(accounts) && currentAccountId != null) {
            const account = accounts.find((item) => String(item.id) === String(currentAccountId));
            if (account) {
                return {
                    name: account.name || '',
                    phone: account.phone || '',
                    persona: account.persona || account.signature || '',
                    avatarUrl: account.avatarUrl || null
                };
            }
        }

        return { ...defaultUserState };
    }

    window.apiConfig = normalizeApiConfig(window.apiConfig || safeLoad('u2_apiConfig', defaultApiConfig));
    window.imageGenerationConfig = normalizeImageGenerationConfig(
        window.imageGenerationConfig || safeLoad('u2_imageGenerationConfig', defaultImageGenerationConfig)
    );
    window.minimaxConfig = normalizeMinimaxConfig(window.minimaxConfig || safeLoad('u2_minimaxConfig', defaultMinimaxConfig));
    window.userState = {
        ...defaultUserState,
        ...(window.userState && typeof window.userState === 'object' ? window.userState : resolveUserStateFromAccounts())
    };

    window.getApiConfig = function getApiConfig() {
        window.apiConfig = normalizeApiConfig(window.apiConfig || safeLoad('u2_apiConfig', defaultApiConfig));
        return window.apiConfig;
    };

    window.getImageGenerationConfig = function getImageGenerationConfig() {
        window.imageGenerationConfig = normalizeImageGenerationConfig(window.imageGenerationConfig);
        return window.imageGenerationConfig;
    };

    window.getActiveImageGenerationConfig = function getActiveImageGenerationConfig() {
        const config = window.getImageGenerationConfig();
        return {
            provider: config.activeProvider,
            ...(config.providers[config.activeProvider] || {})
        };
    };

    window.getMinimaxConfig = function getMinimaxConfig() {
        window.minimaxConfig = normalizeMinimaxConfig(window.minimaxConfig || safeLoad('u2_minimaxConfig', defaultMinimaxConfig));
        return window.minimaxConfig;
    };

    window.getUserState = function getUserState() {
        if (!window.userState || typeof window.userState !== 'object') {
            window.userState = resolveUserStateFromAccounts();
        }
        return window.userState;
    };

    const INTERNAL_SILENT_ERROR_HEADER = 'X-U2-Silent-Errors';
    const INTERNAL_GLOBAL_ERROR_HEADER = 'X-U2-Global-Errors';

    function parseHttpUrl(value, fieldName = '接口地址') {
        const text = String(value || '').trim();
        if (!text) throw new Error(`请填写${fieldName}`);

        let parsed;
        try {
            parsed = new URL(text);
        } catch (error) {
            throw new Error(`${fieldName}格式无效`);
        }
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error(`${fieldName}仅支持 HTTP 或 HTTPS`);
        }
        return parsed;
    }

    function trimTrailingSlashes(pathname) {
        const trimmed = String(pathname || '').replace(/\/+$/, '');
        return trimmed || '/';
    }

    function resolveChatCompletionsEndpoint(endpoint) {
        const parsed = parseHttpUrl(endpoint);
        const pathname = trimTrailingSlashes(parsed.pathname);
        if (/\/chat\/completions$/i.test(pathname)) {
            parsed.pathname = pathname;
        } else if (/\/v\d+(?:[a-z0-9._-]*)?$/i.test(pathname)) {
            parsed.pathname = `${pathname}/chat/completions`;
        } else {
            parsed.pathname = `${pathname === '/' ? '' : pathname}/v1/chat/completions`;
        }
        return parsed.toString();
    }

    function resolveModelsEndpoint(endpoint) {
        const parsed = parseHttpUrl(endpoint);
        const pathname = trimTrailingSlashes(parsed.pathname);
        parsed.search = '';
        parsed.hash = '';

        if (/\/models$/i.test(pathname)) {
            parsed.pathname = pathname;
        } else if (/\/chat\/completions$/i.test(pathname)) {
            parsed.pathname = pathname.replace(/\/chat\/completions$/i, '/models');
        } else if (/\/v\d+(?:[a-z0-9._-]*)?$/i.test(pathname)) {
            parsed.pathname = `${pathname}/models`;
        } else {
            parsed.pathname = `${pathname === '/' ? '' : pathname}/v1/models`;
        }
        return parsed.toString();
    }

    function sanitizeApiConfig(value) {
        const config = value && typeof value === 'object' ? value : {};
        const temperature = Number.parseFloat(config.temperature);
        return {
            endpoint: String(config.endpoint || '').trim(),
            apiKey: String(config.apiKey || '').trim(),
            model: String(config.model || '').trim(),
            temperature: Number.isFinite(temperature) ? Math.max(0, Math.min(2, temperature)) : 0.7
        };
    }

    function validateApiConfig(value, options = {}) {
        const config = sanitizeApiConfig(value);
        parseHttpUrl(config.endpoint);
        if (!config.apiKey) throw new Error('请填写 API 密钥');
        if (options.requireModel !== false && !config.model) throw new Error('请填写模型名称');
        return config;
    }

    function buildApiHeaders(config, extraHeaders = {}) {
        const endpoint = String(config?.endpoint || '');
        const headers = new Headers({ 'Content-Type': 'application/json', ...extraHeaders });
        if (/\.openai\.azure\.com(?=\/|$)/i.test(endpoint)) {
            headers.set('api-key', String(config?.apiKey || ''));
        } else {
            headers.set('Authorization', `Bearer ${String(config?.apiKey || '')}`);
        }
        return Object.fromEntries(headers.entries());
    }

    async function readApiError(response) {
        let rawBody = '';
        try {
            rawBody = await response.clone().text();
        } catch (error) {
            rawBody = '';
        }
        let detail = rawBody;
        try {
            const parsed = JSON.parse(rawBody);
            detail = parsed?.error?.message || parsed?.message || parsed?.error || rawBody;
        } catch (error) {
            // Keep the original response text.
        }
        return {
            status: response.status,
            statusText: response.statusText || '',
            rawBody,
            message: String(detail || `HTTP ${response.status}`)
        };
    }

    window.u2Api = Object.freeze({
        INTERNAL_SILENT_ERROR_HEADER,
        INTERNAL_GLOBAL_ERROR_HEADER,
        parseHttpUrl,
        resolveChatCompletionsEndpoint,
        resolveModelsEndpoint,
        sanitizeApiConfig,
        validateApiConfig,
        buildApiHeaders,
        readApiError
    });

    // ==========================================
    // 全局 fetch 拦截器：统一处理 API 错误弹窗
    // ==========================================
    const originalFetch = window.fetch;

    function showApiErrorPopup(title, message, rawResponse) {
        // 如果已经有弹窗，先移除
        const existing = document.getElementById('global-api-error-overlay');
        if (existing) {
            existing.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'global-api-error-overlay';
        overlay.className = 'api-error-overlay';

        const rawText = typeof rawResponse === 'object' ? JSON.stringify(rawResponse, null, 2) : String(rawResponse || '');
        const modal = document.createElement('div');
        modal.className = 'api-error-modal';
        const content = document.createElement('div');
        content.className = 'api-error-content';
        const titleEl = document.createElement('div');
        titleEl.className = 'api-error-title';
        titleEl.textContent = String(title || 'API 请求失败');
        const messageEl = document.createElement('div');
        messageEl.className = 'api-error-message';
        messageEl.textContent = String(message || '接口返回错误');
        content.append(titleEl, messageEl);

        if (rawText) {
            const rawWrapper = document.createElement('div');
            rawWrapper.className = 'api-error-raw-wrapper';
            const rawEl = document.createElement('pre');
            rawEl.className = 'api-error-raw';
            rawEl.textContent = rawText;
            rawWrapper.appendChild(rawEl);
            content.appendChild(rawWrapper);
        }

        const button = document.createElement('button');
        button.className = 'api-error-button';
        button.type = 'button';
        button.textContent = '确定';
        button.addEventListener('click', () => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 300);
        });
        modal.append(content, button);
        overlay.appendChild(modal);

        document.body.appendChild(overlay);
        
        // 强制重绘以触发动画
        overlay.getBoundingClientRect();
        overlay.classList.add('show');
    }

    window.fetch = async function(...args) {
        const url = args[0];
        const requestInit = args[1] && typeof args[1] === 'object' ? args[1] : {};
        const requestHeaders = requestInit.headers instanceof Headers
            ? requestInit.headers
            : new Headers(requestInit.headers || (url instanceof Request ? url.headers : undefined));
        const silentErrors = requestHeaders.get(INTERNAL_SILENT_ERROR_HEADER) === '1';
        const showGlobalErrors = requestHeaders.get(INTERNAL_GLOBAL_ERROR_HEADER) === '1';
        requestHeaders.delete(INTERNAL_SILENT_ERROR_HEADER);
        requestHeaders.delete(INTERNAL_GLOBAL_ERROR_HEADER);

        let requestUrl = '';
        try {
            requestUrl = String(url instanceof Request ? url.url : url || '');
        } catch (error) {
            requestUrl = '';
        }
        const isAiApiRequest = /\/(?:chat\/completions|models)(?:[/?#]|$)/i.test(requestUrl);
        if (isAiApiRequest && /\.openai\.azure\.com(?=\/|$)/i.test(requestUrl)) {
            const bearer = String(requestHeaders.get('Authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1] || '';
            if (bearer && !requestHeaders.has('api-key')) requestHeaders.set('api-key', bearer);
            requestHeaders.delete('Authorization');
        }

        let networkArgs;
        if (url instanceof Request) {
            networkArgs = [new Request(url, { ...requestInit, headers: requestHeaders })];
        } else {
            networkArgs = [url, { ...requestInit, headers: requestHeaders }];
        }
        
        try {
            const response = await originalFetch(...networkArgs);
            
            // 如果请求正常，直接返回原 response
            if (response.ok) {
                return response;
            }

            // --- 出现错误（非 20x 状态码） ---
            
            // 复制一份 response 来读取 body，防止 consumed 影响后续调用
            if (silentErrors || !showGlobalErrors || !isAiApiRequest) return response;

            const clonedResponse = response.clone();
            let rawBody = '';
            try {
                rawBody = await clonedResponse.text();
            } catch (e) {
                rawBody = '[无法读取接口返回内容]';
            }
            
            // 弹出错误提示
            setTimeout(() => {
                showApiErrorPopup(
                    'API 请求失败', 
                    `接口返回错误状态：HTTP ${response.status}`, 
                    rawBody
                );
            }, 0);

            return response; // 依然把 response 返给调用方，让调用方的 catch 也能正常工作
            
        } catch (error) {
            // AbortError 代表调用方主动取消或超时，不应误报成网络/CORS。
            // 具体的取消原因由发起请求的业务模块负责提示。
            const isAborted = error?.name === 'AbortError' || requestInit.signal?.aborted === true;
            if (!silentErrors && showGlobalErrors && !isAborted && isAiApiRequest) {
                setTimeout(() => {
                    showApiErrorPopup(
                        '网络连接失败',
                        '无法连接 API 接口，请检查接口地址、网络连接、代理服务或跨域设置。',
                        error.message || String(error)
                    );
                }, 0);
            }
            throw error;
        }
    };

})();
