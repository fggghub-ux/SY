import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const coreSource = fs.readFileSync(path.join(root, 'js/imessage/2_core.js'), 'utf8');
const favoriteSource = fs.readFileSync(path.join(root, 'js/imessage/chat_favorites.js'), 'utf8');
const aiSource = fs.readFileSync(path.join(root, 'js/imessage/4_chat_ai.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function loadFavorites() {
    const sandbox = { console, Date, JSON, Array, String, Number, Math, Set };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.imApp = {};

    const normalizeStart = coreSource.indexOf('window.imApp.normalizeFavoriteUserMessages = function');
    const normalizeEnd = coreSource.indexOf('\nwindow.imApp.normalizeFriendData = function', normalizeStart);
    assert.ok(normalizeStart >= 0 && normalizeEnd > normalizeStart);
    vm.runInNewContext(coreSource.slice(normalizeStart, normalizeEnd), sandbox);
    vm.runInNewContext(favoriteSource, sandbox);
    return sandbox;
}

test('favorite records normalize, deduplicate, sort, and cap reasons at 30 characters', () => {
    const sandbox = loadFavorites();
    const longReason = '一'.repeat(35);
    const result = sandbox.imApp.normalizeFavoriteUserMessages([
        { id: 'old', messageId: 'm1', messageText: '第一句', reason: '旧原因', createdAt: 10 },
        { id: 'new', messageId: 'm2', messageText: '第二句', reason: longReason, createdAt: 20, messageType: 'voice_message' },
        { id: 'duplicate', messageId: 'm1', messageText: '重复', reason: '重复原因', createdAt: 30 },
        { messageId: '', messageText: '无效', reason: '无效' }
    ]);

    assert.equal(result.length, 2);
    assert.equal(result[0].messageId, 'm2');
    assert.equal(result[0].messageType, 'voice_message');
    assert.equal(Array.from(result[0].reason).length, 30);
    assert.equal(result[1].messageId, 'm1');
});

test('only the latest eligible user text or voice message becomes a favorite candidate', () => {
    const sandbox = loadFavorites();
    const textFriend = {
        id: 'f1', type: 'char', favoriteUserMessages: [],
        messages: [{ id: 'u1', role: 'user', content: '今天也想见你', timestamp: 100 }]
    };
    assert.deepEqual(
        JSON.parse(JSON.stringify(sandbox.imChat.buildFavoriteCandidate(textFriend, {}))),
        { messageId: 'u1', messageText: '今天也想见你', messageType: 'text', messageTimestamp: 100 }
    );

    const voiceFriend = {
        id: 'f2', type: 'char', favoriteUserMessages: [],
        messages: [{ id: 'u2', role: 'user', type: 'voice_message', transcript: '我会一直陪你', timestamp: 200 }]
    };
    assert.equal(sandbox.imChat.buildFavoriteCandidate(voiceFriend, {}).messageText, '我会一直陪你');

    assert.equal(sandbox.imChat.buildFavoriteCandidate({ ...textFriend, type: 'group' }, {}), null);
    assert.equal(sandbox.imChat.buildFavoriteCandidate(textFriend, { source: 'autonomous' }), null);
    assert.equal(sandbox.imChat.buildFavoriteCandidate({ ...textFriend, messages: [...textFriend.messages, { role: 'assistant', content: '回复' }] }, {}), null);
    assert.equal(sandbox.imChat.buildFavoriteCandidate({ ...textFriend, messages: [{ id: 'img', role: 'user', type: 'image', text: '图片描述' }] }, {}), null);
    assert.equal(sandbox.imChat.buildFavoriteCandidate({ ...textFriend, favoriteUserMessages: [{ messageId: 'u1', messageText: '今天也想见你', reason: '我想记住这句温柔的话' }] }, {}), null);
});

test('favorite payload accepts only the exact candidate id and a valid reason', () => {
    const sandbox = loadFavorites();
    const candidate = { messageId: 'u1', messageText: '<img src=x onerror=alert(1)>', messageType: 'text', messageTimestamp: 100 };
    const valid = sandbox.imChat.parseFavoriteSelection(
        JSON.stringify({ messageId: 'u1', reason: '我想记住你主动靠近我的这一刻' }),
        candidate,
        'run-1',
        500
    );
    assert.equal(valid.messageId, 'u1');
    assert.equal(valid.messageText, candidate.messageText);
    assert.equal(valid.sourceApiRunId, 'run-1');
    assert.equal(valid.createdAt, 500);
    assert.equal(sandbox.imChat.parseFavoriteSelection('{bad json', candidate, 'run-1'), null);
    assert.equal(sandbox.imChat.parseFavoriteSelection('{"messageId":"other","reason":"不允许"}', candidate, 'run-1'), null);
    assert.equal(sandbox.imChat.parseFavoriteSelection('{"messageId":"u1","reason":""}', candidate, 'run-1'), null);
});

test('favorite commit and removal mutate only favorite metadata', async () => {
    const sandbox = loadFavorites();
    const friend = { id: 'f1', type: 'char', favoriteUserMessages: [], messages: [{ id: 'u1', role: 'user', content: '原消息' }] };
    sandbox.imApp.commitScopedFriendChange = async (_friendOrId, mutator) => {
        mutator(friend);
        return true;
    };
    const favorite = { id: 'fav1', messageId: 'u1', messageText: '原消息', messageType: 'text', messageTimestamp: 100, reason: '我想留下这句真心话', createdAt: 200, sourceApiRunId: 'run1' };
    assert.equal(await sandbox.imChat.commitFavoriteUserMessage(friend, favorite), true);
    assert.equal(friend.favoriteUserMessages.length, 1);
    assert.equal(friend.messages.length, 1);
    assert.equal(await sandbox.imChat.commitFavoriteUserMessage(friend, favorite), false);
    assert.equal(await sandbox.imChat.removeFavoriteUserMessage(friend, 'fav1'), true);
    assert.equal(friend.favoriteUserMessages.length, 0);
    assert.equal(friend.messages[0].content, '原消息');
});

test('AI prompt, rollback snapshot, and safe favorite UI wiring are present', () => {
    assert.match(aiSource, /<message_favorite>\{\"messageId\"/);
    assert.match(aiSource, /favoriteUserMessages: cloneRegenerateSnapshotValue/);
    assert.match(aiSource, /snapshot\.favoriteUserMessages === undefined/);
    assert.match(aiSource, /commitFavoriteUserMessage\(latestFriend\.id, pendingFavoriteUserMessage\)/);
    assert.match(aiSource, /showFavoriteSavedNotice\(latestFriend, getSafeContainer\(\), apiRunId\)/);
    assert.match(htmlSource, /id="chat-settings-favorites-btn"/);
    assert.match(htmlSource, /id="chat-favorites-view"/);
    assert.match(htmlSource, /js\/imessage\/chat_favorites\.js/);
    assert.match(favoriteSource, /quote\.textContent = favorite\.messageText/);
    assert.match(favoriteSource, /reasonText\.textContent = favorite\.reason/);
    assert.match(favoriteSource, /removeButton\.textContent = '×'/);
    assert.match(favoriteSource, /notice\.textContent = '收藏了一些话'/);
});
