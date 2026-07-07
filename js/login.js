(function() {
    const SESSION_KEY = 'u2_mockAuthSession';
    let cachedDom = null;

    function clonePlainData(value) {
        if (!value || typeof value !== 'object') return value;
        if (typeof structuredClone === 'function') return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }

    function safeLoadSession() {
        try {
            const raw = window.localStorage ? window.localStorage.getItem(SESSION_KEY) : null;
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || !parsed.account) return null;
            return parsed;
        } catch (error) {
            console.warn('[u2Auth] Failed to load session:', error);
            return null;
        }
    }

    function safeSaveSession(session) {
        try {
            if (window.localStorage) {
                window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            }
        } catch (error) {
            console.warn('[u2Auth] Failed to save session:', error);
        }
    }

    function safeRemoveSession() {
        try {
            if (window.localStorage) window.localStorage.removeItem(SESSION_KEY);
        } catch (error) {
            console.warn('[u2Auth] Failed to remove session:', error);
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
        return safeLoadSession();
    }

    function isLoggedIn() {
        return !!getSession();
    }

    function login(credentials = {}) {
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
        safeSaveSession(session);
        hideLoginScreen();
        emitAuthChanged(session);
        return {
            ok: true,
            session: clonePlainData(session)
        };
    }

    function logout() {
        safeRemoveSession();
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
        setError('');
    }

    function markInvalid(accountMissing, passwordMissing) {
        const dom = cachedDom || collectDom();
        dom.accountField?.classList.toggle('is-invalid', !!accountMissing);
        dom.passwordField?.classList.toggle('is-invalid', !!passwordMissing);
    }

    function handleSubmit(event) {
        event.preventDefault();
        const dom = cachedDom || collectDom();
        const account = dom.accountInput ? dom.accountInput.value.trim() : '';
        const password = dom.passwordInput ? dom.passwordInput.value : '';
        const accountMissing = !account;
        const passwordMissing = !password;

        if (accountMissing || passwordMissing) {
            markInvalid(accountMissing, passwordMissing);
            setError('Enter account and password / 请输入账号和密码');
            if (accountMissing && dom.accountInput) dom.accountInput.focus();
            else if (passwordMissing && dom.passwordInput) dom.passwordInput.focus();
            return;
        }

        clearInvalidState();
        const result = login({ account, password });
        if (!result.ok) {
            setError(result.error || 'Unable to sign in.');
            return;
        }

        if (dom.passwordInput) dom.passwordInput.value = '';
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
    }

    function initLoginScreen() {
        const dom = collectDom();
        if (!dom.screen || !dom.form) return;

        dom.form.addEventListener('submit', handleSubmit);
        bindPasswordToggle();
        bindInputReset();

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
        login,
        logout,
        getSession,
        isLoggedIn,
        showLoginScreen,
        hideLoginScreen
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLoginScreen, { once: true });
    } else {
        initLoginScreen();
    }
})();
