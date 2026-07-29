import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
    loginSource,
    indexSource,
    loginCss,
    settingsSource,
    packageSource,
    buildSource,
    migrationSource,
    registerFunctionSource,
    adminServerSource
] = await Promise.all([
    fs.readFile(new URL('../js/login.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/login.css', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/settings.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../package.json', import.meta.url), 'utf8'),
    fs.readFile(new URL('../tools/build-obfuscate.mjs', import.meta.url), 'utf8'),
    fs.readFile(new URL('../supabase/migrations/202607290001_u2_auth.sql', import.meta.url), 'utf8'),
    fs.readFile(new URL('../supabase/functions/register-account/index.ts', import.meta.url), 'utf8'),
    fs.readFile(new URL('../tools/auth-admin-server.mjs', import.meta.url), 'utf8')
]);

test('login gate exposes separate sign-in and activation-code registration modes', () => {
    assert.match(indexSource, /id="u2-login-mode-signin"/);
    assert.match(indexSource, /id="u2-login-mode-register"/);
    assert.match(indexSource, /id="u2-login-account"/);
    assert.match(indexSource, /id="u2-login-password"/);
    assert.match(indexSource, /id="u2-login-confirm"/);
    assert.match(indexSource, /id="u2-login-code"/);
    assert.match(indexSource, /id="u2-login-submit-label">登录/);
    assert.match(loginCss, /\.u2-login-screen\.is-register-mode \.u2-login-register-only/);
});

test('browser auth uses only the public key and never embeds an elevated Supabase key', () => {
    assert.match(loginSource, /const SUPABASE_URL = 'https:\/\/xesofmxgvsnpldrjtxur\.supabase\.co'/);
    assert.match(loginSource, /const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_/);
    assert.doesNotMatch(loginSource, /sb_secret_|service_role|SUPABASE_SECRET/i);
    assert.match(loginSource, /\/auth\/v1\/token\?grant_type=password/);
    assert.match(loginSource, /\/functions\/v1\/register-account/);
    assert.match(loginSource, /\/rest\/v1\/rpc\/u2_check_device/);
});

test('session restoration fails closed through remote device authorization', () => {
    assert.match(loginSource, /const AUTH_SESSION_KEY = 'u2_auth_session_v1'/);
    assert.match(loginSource, /const DEVICE_ID_KEY = 'u2_auth_device_id_v1'/);
    assert.match(loginSource, /async function authorizeSession\(session\)/);
    assert.match(loginSource, /if \(!state\?\.allowed\)/);
    assert.match(loginSource, /clearSession\(\);\s*showLoginScreen/);
    assert.match(loginSource, /DEVICE_MISMATCH/);
});

test('registration function creates the account only around a one-time atomic code claim', () => {
    assert.match(registerFunctionSource, /admin\.auth\.admin\.createUser/);
    assert.match(registerFunctionSource, /admin\.rpc\('u2_claim_registration'/);
    assert.match(registerFunctionSource, /admin\.auth\.admin\.deleteUser\(created\.user\.id\)/);
    assert.match(registerFunctionSource, /codeHash = await sha256\(activationCode\)/);
    assert.match(registerFunctionSource, /deviceHash = await sha256\(deviceId\)/);
    assert.doesNotMatch(registerFunctionSource, /SUPABASE_SECRET_KEY\s*=\s*['"]/);
});

test('database keeps code and profile tables private while exposing only scoped RPCs', () => {
    assert.match(migrationSource, /create table if not exists public\.u2_activation_codes/);
    assert.match(migrationSource, /create table if not exists public\.u2_profiles/);
    assert.match(migrationSource, /for update/);
    assert.match(migrationSource, /set status = 'used'/);
    assert.match(migrationSource, /enable row level security/);
    assert.match(migrationSource, /revoke all on public\.u2_activation_codes from anon, authenticated/);
    assert.match(migrationSource, /grant execute on function public\.u2_check_device\(text\) to authenticated/);
    assert.match(migrationSource, /if current_profile\.device_hash is null then/);
});

test('sign out is restored in Data Management without deleting local app data', () => {
    assert.match(indexSource, /id="u2-auth-sign-out-btn"/);
    assert.match(indexSource, /保留本机数据，下次使用账号密码登录/);
    assert.match(settingsSource, /await window\.u2Auth\?\.logout\(\)/);
    assert.match(loginSource, /window\.u2Auth = \{/);
});

test('local admin tool is server-side only and excluded from the production bundle', () => {
    assert.match(packageSource, /"auth:admin": "node tools\/auth-admin-server\.mjs"/);
    assert.match(adminServerSource, /server\.listen\(config\.port, '127\.0\.0\.1'/);
    assert.match(adminServerSource, /SUPABASE_SECRET_KEY/);
    assert.match(adminServerSource, /\/api\/codes\/generate/);
    assert.match(adminServerSource, /reset-device\|status\|password/);
    assert.match(buildSource, /'tools', 'test', 'supabase'/);
    assert.match(buildSource, /'\.env\.auth\.example'/);
});

test('browser assets carry the account-auth cache-bust version', () => {
    assert.match(indexSource, /css\/login\.css\?v=20260729-account-auth-v1/);
    assert.match(indexSource, /js\/login\.js\?v=20260729-account-auth-v1/);
});
