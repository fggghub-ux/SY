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
        return {
            ...defaultApiConfig,
            ...(value && typeof value === 'object' ? value : {})
        };
    }

    function normalizeMinimaxConfig(value) {
        return {
            ...defaultMinimaxConfig,
            ...(value && typeof value === 'object' ? value : {})
        };
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
    window.minimaxConfig = normalizeMinimaxConfig(window.minimaxConfig || safeLoad('u2_minimaxConfig', defaultMinimaxConfig));
    window.userState = {
        ...defaultUserState,
        ...(window.userState && typeof window.userState === 'object' ? window.userState : resolveUserStateFromAccounts())
    };

    window.getApiConfig = function getApiConfig() {
        window.apiConfig = normalizeApiConfig(window.apiConfig || safeLoad('u2_apiConfig', defaultApiConfig));
        return window.apiConfig;
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

        const rawText = typeof rawResponse === 'object' ? JSON.stringify(rawResponse, null, 2) : String(rawResponse);

        overlay.innerHTML = `
            <div class="api-error-modal">
                <div class="api-error-content">
                    <div class="api-error-title">${title}</div>
                    <div class="api-error-message">${message}</div>
                    ${rawText ? `
                    <div class="api-error-raw-wrapper">
                        <pre class="api-error-raw">${rawText.replace(/</g, '<').replace(/>/g, '>')}</pre>
                    </div>
                    ` : ''}
                </div>
                <button class="api-error-button" onclick="this.closest('.api-error-overlay').classList.remove('show'); setTimeout(() => this.closest('.api-error-overlay').remove(), 300)">确定</button>
            </div>
        `;

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
        const silentErrors = requestHeaders.get('X-U2-Silent-Errors') === '1';
        
        // 简单过滤，只针对可能是 API 的请求才去深入解析和弹窗
        // （如果有些纯本地资源文件不想被拦截，可以在这里加判断，比如 if(typeof url === 'string' && !url.startsWith('http')) return originalFetch(...args); ）
        
        try {
            const response = await originalFetch(...args);
            
            // 如果请求正常，直接返回原 response
            if (response.ok) {
                return response;
            }

            // --- 出现错误（非 20x 状态码） ---
            
            // 复制一份 response 来读取 body，防止 consumed 影响后续调用
            if (silentErrors) return response;

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
            if (!silentErrors && !isAborted) {
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
