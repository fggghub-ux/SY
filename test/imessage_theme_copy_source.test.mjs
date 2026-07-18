import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = (path) => fs.readFile(new URL(path, import.meta.url), 'utf8');

function extractTemplate(source, name) {
    const match = source.match(new RegExp('const ' + name + ' = `([\\s\\S]*?)`;'));
    assert.ok(match, `${name} should remain a static clipboard template`);
    return match[1];
}

test('status Theme source covers every application-owned profile class', async () => {
    const [settingsSource, statusSource] = await Promise.all([
        read('../js/settings.js'),
        read('../js/imessage/4_chat_status.js')
    ]);
    const template = extractTemplate(settingsSource, 'statusTemplate');
    const runtimeClasses = Array.from(new Set(
        statusSource.match(/\b(?:chat-profile|gmp)-[a-z0-9-]+\b/g) || []
    )).sort();

    assert.ok(runtimeClasses.length > 40, 'status class inventory should be substantive');
    for (const className of runtimeClasses) {
        assert.match(template, new RegExp(`\\.${className}\\b`), `missing .${className}`);
    }
    for (const modifier of ['active', 'is-page', 'is-danger', 'is-primary', 'is-confirm', 'is-cancel', 'is-confirmed', 'is-cancelled']) {
        assert.match(template, new RegExp(`\\.${modifier}\\b`), `missing state modifier .${modifier}`);
    }
    assert.match(template, /:scope\s+\.chat-profile-panel-overlay/);
    assert.doesNotMatch(template, /:scope\s*\{[^}]*display\s*:\s*none/i);
    assert.doesNotMatch(template, /来源[：:]/);
});

test('single-chat Theme source includes every current single-chat message-card family', async () => {
    const settingsSource = await read('../js/settings.js');
    const template = extractTemplate(settingsSource, 'chatTemplate');
    const requiredClasses = [
        'im-card-bubble', 'im-card-content',
        'image-message-bubble', 'chat-image-bubble-img',
        'pay-transfer-bubble', 'pay-transfer-card', 'pay-receipt-card',
        'voice-message-bubble', 'voice-message-bubble-inner', 'voice-message-mic',
        'voice-message-wave', 'voice-message-duration', 'voice-message-transcript',
        'sticker-message-wrap', 'sticker-message-img', 'sticker-message-meta', 'sticker-group-wrap',
        'moment-forward-bubble',
        'chat-link-card', 'chat-link-card-cover', 'chat-link-card-body',
        'chat-link-card-platform', 'chat-link-card-title', 'chat-link-card-summary', 'chat-link-card-footer',
        'html-bubble', 'loves-invite-bubble',
        'voice-call-record-bubble', 'voice-call-record-card', 'offline-meeting-record-card',
        'chat-system-row', 'system-notice-card',
        'message-recalled-notice', 'message-recalled-view-link'
    ];

    for (const className of requiredClasses) {
        assert.match(template, new RegExp(`\\.${className}\\b`), `missing .${className}`);
    }
    assert.match(template, /:scope\.timestamp-outside/);
    assert.doesNotMatch(template, /:scope\s*\{[^}]*display\s*:\s*none/i);
    assert.doesNotMatch(template, /\.group-red-packet-/);
    assert.doesNotMatch(template, /\.group-ai-/);
    assert.doesNotMatch(template, /\.group-private-chat-view-link\b/);
    assert.doesNotMatch(template, /\.system-notice-(?:group_|red_packet_claim)\b/);
    assert.doesNotMatch(template, /来源[：:]/);
});

test('loads the cache-busted Theme copy-source script', async () => {
    const html = await read('../index.html');
    assert.match(html, /js\/settings\.js\?v=20260718-ios-pwa-export-v1/);
});
