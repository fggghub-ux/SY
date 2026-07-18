import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const readWorkspaceFile = (path) => fs.readFile(new URL(path, root), 'utf8');

async function loadSearchApi() {
    const source = await readWorkspaceFile('js/imessage/chat_search.js');
    const sandbox = { window: { imChat: {}, setTimeout() {} }, globalThis: {}, console };
    vm.runInNewContext(source, sandbox);
    return sandbox.window.imChat;
}

test('chat search extracts supported readable text without media URLs or HTML tags', async () => {
    const { extractSearchableMessageText: extract } = await loadSearchApi();

    assert.equal(extract({ role: 'user', content: 'Hello World', translation: '你好世界', replyTo: 'Earlier line' }), 'Earlier line · 你好世界 · Hello World');
    assert.equal(extract({ type: 'voice_message', transcript: '语音正文', audioUrl: 'https://secret/audio.mp3' }), '语音正文');
    assert.equal(extract({ type: 'image', content: 'data:image/png;base64,SECRET', description: '海边日落' }), '海边日落');
    assert.equal(extract({ type: 'sticker', stickerUrl: 'https://secret/sticker.gif', stickerName: '开心兔子' }), '开心兔子');
    assert.equal(extract({ type: 'html', content: '<section><strong>卡片标题</strong><script>hidden()</script><p>可见正文</p></section>' }), '卡片标题 可见正文');
});

test('chat search covers cards, records, moments and nested transcripts', async () => {
    const { extractSearchableMessageText: extract } = await loadSearchApi();

    assert.match(extract({ type: 'pay_transfer', description: '晚餐费用', amount: 88, payerName: '我', payeeName: '小夏' }), /晚餐费用 · 88 · 我 · 小夏/);
    assert.match(extract({ type: 'voice_call_record', isVideo: true, statusText: '已结束', callMessages: [{ speaker: '小夏', text: '明天见' }] }), /视频通话.*已结束.*小夏.*明天见/);
    assert.equal(extract({ type: 'moment_forward', content: JSON.stringify({ authorName: '小夏', text: '今天去了海边' }) }), '小夏 · 今天去了海边');
    assert.equal(extract({ type: 'fake_link', fakeLinkData: { siteName: '旅行网', title: '旅行计划', summary: '周末出发' }, content: 'https://secret.example' }), '旅行网 · 旅行计划 · 周末出发');
});

test('chat search is case-insensitive, newest-first and handles special characters literally', async () => {
    const { searchFriendMessages } = await loadSearchApi();
    const friend = {
        messages: [
            { id: 'old', role: 'user', content: 'Alpha [draft]', timestamp: 1 },
            { id: 'miss', role: 'assistant', content: 'Beta', timestamp: 2 },
            { id: 'new', role: 'assistant', content: 'ALPHA [draft] final', timestamp: 3 }
        ]
    };

    assert.deepEqual(Array.from(searchFriendMessages(friend, 'alpha'), result => result.message.id), ['new', 'old']);
    assert.deepEqual(Array.from(searchFriendMessages(friend, '[draft]'), result => result.message.id), ['new', 'old']);
    assert.equal(searchFriendMessages(friend, 'missing').length, 0);
    assert.equal(searchFriendMessages(friend, '   ').length, 0);
});

test('chat search source wires only the regular single-chat settings entry and exposes navigation helpers', async () => {
    const [html, source] = await Promise.all([
        readWorkspaceFile('index.html'),
        readWorkspaceFile('js/imessage/chat_search.js')
    ]);

    assert.match(html, /id="chat-settings-search-btn"[^>]+aria-label="搜索聊天记录"/);
    assert.match(html, /id="chat-settings-search-btn"[\s\S]{0,700}fa-search/);
    assert.doesNotMatch(html, /id="chat-settings-search-btn"[\s\S]{0,700}fa-camera/);
    assert.equal((html.match(/id="chat-settings-search-btn"/g) || []).length, 1);
    assert.match(source, /friend\.type === 'group' \|\| friend\.type === 'npc' \|\| friend\.type === 'official'/);
    assert.match(source, /imChat\.revealChatMessage = revealChatMessage/);
    assert.match(source, /startIndex: Math\.max\(0, targetIndex - 4\)/);
    assert.match(source, /imChat\.centerSearchMessageRow = centerMessageRowInContainer/);
    assert.match(source, /container\.scrollTop = Math\.max\(0, centeredScrollTop\)/);
    assert.doesNotMatch(source, /scrollIntoView/);
});
