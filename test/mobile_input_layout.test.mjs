import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [html, tiktokCss, bstageCss, settingsCss] = await Promise.all([
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/tiktok.css', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/bstage.css', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/settings.css', import.meta.url), 'utf8')
]);

test('TikTok DM keeps API and auxiliary actions visible on narrow screens', () => {
    assert.match(html, /class="tk-dm-camera-btn"/);
    assert.match(html, /class="tk-dm-input-shell"/);
    assert.match(html, /class="tk-dm-message-input" id="tk-dm-chat-input"/);
    assert.match(html, /class="far fa-smile tk-dm-emoji-btn"/);
    assert.match(tiktokCss, /\.tk-dm-input-shell\s*\{[\s\S]*?flex:\s*1 1 0;[\s\S]*?width:\s*0;[\s\S]*?min-width:\s*0;/);
    assert.match(tiktokCss, /\.tk-dm-message-input\s*\{[\s\S]*?flex:\s*1 1 0;[\s\S]*?width:\s*0;[\s\S]*?min-width:\s*0;/);
    assert.match(tiktokCss, /#tk-dm-actions-right\s*\{[\s\S]*?flex:\s*0 0 auto;/);
    assert.match(tiktokCss, /#tk-dm-mic-btn,[\s\S]*?#tk-dm-plus-btn,[\s\S]*?#tk-dm-chat-send\s*\{[\s\S]*?flex-shrink:\s*0;/);
});

test('b.stage shared chat layout reserves room for send and API buttons', () => {
    assert.match(bstageCss, /\.bstage-chat-input-area\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/);
    assert.match(bstageCss, /\.bstage-chat-input-wrapper\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/);
    assert.match(bstageCss, /\.bstage-chat-input-wrapper input\s*\{[\s\S]*?flex:\s*1 1 0;[\s\S]*?width:\s*0;[\s\S]*?min-width:\s*0;/);
    assert.match(bstageCss, /\.bstage-chat-action-btn\s*\{[\s\S]*?flex-shrink:\s*0;/);
});

test('horizontal form fields shrink without changing special controls', () => {
    assert.match(settingsCss, /\.form-item\s*\{[\s\S]*?min-height:\s*50px;[\s\S]*?height:\s*auto;/);
    assert.match(settingsCss, /\.form-item > input:not\(\[type\]\):not\(\.small-rounded-input\),/);
    assert.match(settingsCss, /\[type="text"\],[\s\S]*?\[type="tel"\][\s\S]*?:not\(\.small-rounded-input\),/);
    assert.match(settingsCss, /input\[type="number"\]:not\(\.small-rounded-input\):not\(\[style\*="width"\]\)/);
    assert.match(settingsCss, /:not\(\[style\*="width"\]\)\s*\{[\s\S]*?flex:\s*1 1 0;[\s\S]*?width:\s*0;[\s\S]*?min-width:\s*0;/);
    assert.doesNotMatch(settingsCss, /\[type="(?:checkbox|radio|file|range)"\][\s\S]{0,120}flex:\s*1 1 0;/);
});

test('form placeholders inherit the editable text typography', () => {
    assert.match(settingsCss, /\.form-item input::placeholder\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?font-family:\s*inherit;[\s\S]*?font-size:\s*inherit;[\s\S]*?line-height:\s*inherit;/);
});

test('updated styles are cache-busted', () => {
    for (const stylesheet of ['global', 'bstage', 'tiktok', 'settings']) {
        assert.match(html, new RegExp(`css/${stylesheet}\\.css\\?v=20260721-mobile-input-layout-v1`));
    }
});
