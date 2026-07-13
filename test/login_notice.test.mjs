import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [html, loginCss, settingsCss, loginSource, settingsSource, modalSource] = await Promise.all([
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/login.css', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/settings.css', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/login.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/settings.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/about_info_modal.js', import.meta.url), 'utf8')
]);

function getFunctionBody(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `Expected ${name}`);
    const bodyStart = source.indexOf('{', source.indexOf(')', start));
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') depth -= 1;
        if (depth === 0) return source.slice(bodyStart + 1, index);
    }
    assert.fail(`Expected ${name} to close`);
}

test('login notice follows the password field and precedes submit feedback', () => {
    const passwordAt = html.indexOf('id="u2-login-password"');
    const noticeAt = html.indexOf('id="u2-login-notice-row"');
    const errorAt = html.indexOf('id="u2-login-error"');
    const submitAt = html.indexOf('id="u2-login-submit"');
    assert.ok(passwordAt > 0 && passwordAt < noticeAt && noticeAt < errorAt && errorAt < submitAt);
    assert.match(html, /id="u2-login-notice-accepted"[^>]*type="checkbox"/);
    assert.match(html, /我已知晓《<\/label><button[^>]*id="u2-login-notice-link">u2phone食用须知<\/button><span>》/);
});

test('login requires notice acceptance and focuses the checkbox on failure', () => {
    const submitBody = getFunctionBody(loginSource, 'handleSubmit');
    assert.match(submitBody, /noticeMissing = !dom\.noticeAccepted\?\.checked/);
    assert.match(submitBody, /if \(noticeMissing\)/);
    assert.match(submitBody, /请先阅读并勾选《u2phone食用须知》/);
    assert.match(submitBody, /dom\.noticeAccepted\?\.focus\(\)/);
    assert.match(submitBody, /login\(\{ account, password \}\)/);
});

test('notice state resets without being added to the auth session', () => {
    const showBody = getFunctionBody(loginSource, 'showLoginScreen');
    assert.match(showBody, /dom\.noticeAccepted\.checked = false/);
    const submitBody = getFunctionBody(loginSource, 'handleSubmit');
    assert.match(submitBody, /dom\.noticeAccepted\.checked = false/);
    const loginBody = getFunctionBody(loginSource, 'login');
    assert.doesNotMatch(loginBody, /noticeAccepted/);
    assert.doesNotMatch(loginSource, /saveLegacyKey[^\n]*notice|commitDomain[^\n]*notice/);
});

test('notice text opens the shared disclaimer without changing the checkbox', () => {
    const bindBody = getFunctionBody(loginSource, 'bindInputReset');
    assert.match(bindBody, /noticeLink\?\.addEventListener\('click'/);
    assert.match(bindBody, /u2AboutInfoModal\?\.open\('disclaimer'\)/);
    assert.doesNotMatch(bindBody, /noticeAccepted\.checked\s*=/);
    assert.match(settingsSource, /u2AboutInfoModal\?\.open\('disclaimer'\)/);
    assert.match(settingsSource, /u2AboutInfoModal\?\.open\('changelog'\)/);
    assert.match(modalSource, /window\.u2AboutInfoModal = \{ open, close \}/);
});

test('shared modal loads before login and remains interactive above the lock screen', () => {
    const modalScriptAt = html.indexOf('js/about_info_modal.js?v=20260712-login-notice-v1');
    const loginScriptAt = html.indexOf('js/login.js?v=20260713-auth-fast-v1');
    assert.ok(modalScriptAt > 0 && modalScriptAt < loginScriptAt);
    assert.match(html, /css\/login\.css\?v=20260712-login-notice-v1/);
    assert.match(html, /css\/settings\.css\?v=20260712-login-notice-v1/);
    assert.match(settingsCss, /\.about-info-modal-overlay\s*\{[^}]*z-index: 10000000/);
    assert.match(loginCss, /\.u2-login-screen\s*\{[^}]*z-index: 9999996/);
});

test('login notice has compact error and keyboard focus states', () => {
    assert.match(loginCss, /\.u2-login-notice\s*\{[^}]*display: flex/);
    assert.match(loginCss, /\.u2-login-notice input:focus-visible/);
    assert.match(loginCss, /\.u2-login-notice button:focus-visible/);
    assert.match(loginCss, /\.u2-login-notice\.is-invalid/);
});
