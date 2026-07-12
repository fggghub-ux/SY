(function() {
    let cachedDom = null;
    let cachedSession = null;
    let authReadyResolve;
    let authReadyReject;
    const authReady = new Promise((resolve, reject) => {
        authReadyResolve = resolve;
        authReadyReject = reject;
    });

    function clonePlainData(value) {
        if (!value || typeof value !== 'object') return value;
        if (typeof structuredClone === 'function') return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }

    async function safeLoadSession() {
        try {
            if (!window.appStorage?.getAuthSession) return null;
            await window.appStorage.ready;
            const session = await window.appStorage.getAuthSession();
            return session && typeof session === 'object' && session.account ? session : null;
        } catch (error) {
            console.warn('[u2Auth] Failed to load session:', error);
            return null;
        }
    }

    async function safeSaveSession(session) {
        try {
            if (!window.appStorage?.setAuthSession) throw new Error('IndexedDB auth storage unavailable');
            await window.appStorage.ready;
            cachedSession = await window.appStorage.setAuthSession(session);
            return cachedSession;
        } catch (error) {
            console.warn('[u2Auth] Failed to save session:', error);
            throw error;
        }
    }

    async function safeRemoveSession() {
        try {
            if (!window.appStorage?.clearAuthSession) throw new Error('IndexedDB auth storage unavailable');
            await window.appStorage.ready;
            await window.appStorage.clearAuthSession();
            cachedSession = null;
        } catch (error) {
            console.warn('[u2Auth] Failed to remove session:', error);
            throw error;
        }
    }

    function resolveDisplayName(account) {
        const safeAccount = String(account || '').trim();
        if (!safeAccount) return '';
        const emailName = safeAccount.split('@')[0];
        return emailName || safeAccount;
    }

    function emitAuthChanged(session) {
        window.dispatchEvent(new CustomEvent('u2:auth-changed', {
            detail: {
                session: session ? clonePlainData(session) : null,
                isLoggedIn: !!session
            }
        }));
    }

    function setLoginLocked(locked) {
        if (document.body) {
            document.body.classList.toggle('u2-login-locked', !!locked);
            document.body.classList.toggle('u2-login-authenticated', !locked);
        }
    }

    function showLoginScreen(options = {}) {
        const dom = cachedDom || collectDom();
        if (!dom.screen) return;
        if (dom.noticeAccepted) dom.noticeAccepted.checked = false;
        dom.noticeRow?.classList.remove('is-invalid');
        dom.screen.classList.remove('is-hidden');
        dom.screen.setAttribute('aria-hidden', 'false');
        setLoginLocked(true);
        if (options.focus && dom.accountInput) {
            setTimeout(() => dom.accountInput.focus(), 80);
        }
    }

    function hideLoginScreen() {
        const dom = cachedDom || collectDom();
        if (!dom.screen) return;
        dom.screen.classList.add('is-hidden');
        dom.screen.setAttribute('aria-hidden', 'true');
        setLoginLocked(false);
    }

    function getSession() {
        return cachedSession ? clonePlainData(cachedSession) : null;
    }

    function isLoggedIn() {
        return !!getSession();
    }

    async function login(credentials = {}) {
        const account = String(credentials.account || '').trim();
        const password = String(credentials.password || '');
        if (!account || !password) {
            return {
                ok: false,
                error: 'Account and password are required.'
            };
        }

        const session = {
            account,
            displayName: resolveDisplayName(account),
            loginAt: Date.now()
        };
        await safeSaveSession(session);
        hideLoginScreen();
        emitAuthChanged(session);
        return {
            ok: true,
            session: clonePlainData(session)
        };
    }

    async function logout() {
        await safeRemoveSession();
        showLoginScreen({ focus: true });
        emitAuthChanged(null);
        return true;
    }

    function collectDom() {
        cachedDom = {
            screen: document.getElementById('u2-login-screen'),
            form: document.getElementById('u2-login-form'),
            accountField: document.getElementById('u2-login-account-field'),
            passwordField: document.getElementById('u2-login-password-field'),
            accountInput: document.getElementById('u2-login-account'),
            passwordInput: document.getElementById('u2-login-password'),
            passwordToggle: document.getElementById('u2-login-password-toggle'),
            noticeRow: document.getElementById('u2-login-notice-row'),
            noticeAccepted: document.getElementById('u2-login-notice-accepted'),
            noticeLink: document.getElementById('u2-login-notice-link'),
            submitButton: document.getElementById('u2-login-submit'),
            error: document.getElementById('u2-login-error')
        };
        return cachedDom;
    }

    function setError(message) {
        const dom = cachedDom || collectDom();
        if (dom.error) dom.error.textContent = message || '';
    }

    function clearInvalidState() {
        const dom = cachedDom || collectDom();
        dom.accountField?.classList.remove('is-invalid');
        dom.passwordField?.classList.remove('is-invalid');
        dom.noticeRow?.classList.remove('is-invalid');
        setError('');
    }

    function markInvalid(accountMissing, passwordMissing, noticeMissing = false) {
        const dom = cachedDom || collectDom();
        dom.accountField?.classList.toggle('is-invalid', !!accountMissing);
        dom.passwordField?.classList.toggle('is-invalid', !!passwordMissing);
        dom.noticeRow?.classList.toggle('is-invalid', !!noticeMissing);
    }

    async function handleSubmit(event) {
        event.preventDefault();
        const dom = cachedDom || collectDom();
        const account = dom.accountInput ? dom.accountInput.value.trim() : '';
        const password = dom.passwordInput ? dom.passwordInput.value : '';
        const accountMissing = !account;
        const passwordMissing = !password;
        const noticeMissing = !dom.noticeAccepted?.checked;

        if (accountMissing || passwordMissing) {
            markInvalid(accountMissing, passwordMissing, noticeMissing);
            setError('Enter account and password / 请输入账号和密码');
            if (accountMissing && dom.accountInput) dom.accountInput.focus();
            else if (passwordMissing && dom.passwordInput) dom.passwordInput.focus();
            return;
        }

        if (noticeMissing) {
            markInvalid(false, false, true);
            setError('请先阅读并勾选《u2phone食用须知》');
            dom.noticeAccepted?.focus();
            return;
        }

        clearInvalidState();
        let result;
        try {
            result = await login({ account, password });
        } catch (error) {
            setError('Unable to save login session / 无法保存登录状态');
            return;
        }
        if (!result.ok) {
            setError(result.error || 'Unable to sign in.');
            return;
        }

        if (dom.passwordInput) dom.passwordInput.value = '';
        if (dom.noticeAccepted) dom.noticeAccepted.checked = false;
        if (typeof window.showToast === 'function') {
            window.showToast('Signed in');
        }
    }

    function bindPasswordToggle() {
        const dom = cachedDom || collectDom();
        if (!dom.passwordToggle || !dom.passwordInput) return;
        dom.passwordToggle.addEventListener('click', () => {
            const shouldShow = dom.passwordInput.type === 'password';
            dom.passwordInput.type = shouldShow ? 'text' : 'password';
            dom.passwordToggle.setAttribute('aria-pressed', shouldShow ? 'true' : 'false');
            dom.passwordToggle.setAttribute('aria-label', shouldShow ? 'Hide password' : 'Show password');
            const icon = dom.passwordToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-eye', !shouldShow);
                icon.classList.toggle('fa-eye-slash', shouldShow);
            }
        });
    }

    function bindInputReset() {
        const dom = cachedDom || collectDom();
        [dom.accountInput, dom.passwordInput].forEach((input) => {
            if (!input) return;
            input.addEventListener('input', () => {
                clearInvalidState();
            });
        });
        dom.noticeAccepted?.addEventListener('change', clearInvalidState);
        dom.noticeLink?.addEventListener('click', () => {
            window.u2AboutInfoModal?.open('disclaimer');
        });
    }

    async function initLoginScreen() {
        const dom = collectDom();
        if (!dom.screen || !dom.form) return;

        dom.form.addEventListener('submit', handleSubmit);
        bindPasswordToggle();
        bindInputReset();

        cachedSession = await safeLoadSession();
        authReadyResolve(true);
        const session = getSession();
        if (session) {
            hideLoginScreen();
            emitAuthChanged(session);
            return;
        }

        showLoginScreen();
        emitAuthChanged(null);
    }

    window.u2Auth = {
        ready: authReady,
        login,
        logout,
        getSession,
        isLoggedIn,
        showLoginScreen,
        hideLoginScreen
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initLoginScreen().catch(authReadyReject), { once: true });
    } else {
        initLoginScreen().catch(authReadyReject);
    }
})();
