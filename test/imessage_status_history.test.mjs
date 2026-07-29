import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const readWorkspaceFile = (path) => fs.readFile(new URL(path, root), 'utf8');

async function loadStatusHistoryNormalizer() {
    const source = await readWorkspaceFile('js/imessage/2_core.js');
    const start = source.indexOf('window.imApp.normalizeProfileStatusHistory = function');
    const end = source.indexOf('window.imApp.createDefaultProfilePanel = function', start);
    assert.ok(start >= 0 && end > start, 'status history normalizer should be defined before profile defaults');
    const sandbox = { window: { imApp: {} } };
    vm.runInNewContext(source.slice(start, end), sandbox);
    return sandbox.window.imApp;
}

test('legacy thought history only enriches the matching current record', async () => {
    const { normalizeProfileStatusHistory: normalize } = await loadStatusHistoryNormalizer();
    const history = normalize({
        id: 'friend-1',
        latestThought: '最新心声',
        profilePanel: {
            thought: '最新心声',
            location: '咖啡馆',
            action: '看向窗外',
            mood: '放松',
            expression: '微笑',
            affection: 42,
            affectionChange: 2,
            thoughtHistory: [
                { id: 'new', content: '最新心声', time: 200 },
                { id: 'old', content: '旧心声', time: 100 }
            ]
        }
    });

    assert.equal(history.length, 2);
    assert.equal(history[0].affection, 42);
    assert.equal(history[0].legacy, false);
    assert.equal(history[1].thought, '旧心声');
    assert.equal(history[1].affection, null);
    assert.equal(history[1].legacy, true);
    assert.equal('location' in history[0], false);
    assert.equal('action' in history[0], false);
    assert.equal('mood' in history[0], false);
    assert.equal('expression' in history[0], false);
});

test('status snapshots retain thought and affection but discard legacy status fields', async () => {
    const { normalizeProfileStatusHistory: normalize } = await loadStatusHistoryNormalizer();
    const history = normalize({
        profilePanel: {
            thought: '当前值不应覆盖历史',
            location: '当前地点',
            statusHistory: [{
                id: 'snapshot-1',
                thought: '历史心声',
                location: '历史地点',
                action: '历史动作',
                mood: '历史心情',
                expression: '历史表情',
                affection: 20,
                affectionChange: -1,
                createdAt: 123
            }]
        }
    });

    assert.equal(history[0].thought, '历史心声');
    assert.equal(history[0].affectionChange, -1);
    assert.equal(history[0].createdAt, 123);
    assert.deepEqual(Object.keys(history[0]).sort(), [
        'affection', 'affectionChange', 'createdAt', 'id', 'legacy', 'thought'
    ]);
});

test('single-chat migration deletes legacy fields from current and historical status data', async () => {
    const { migrateSingleChatProfileStatus: migrate } = await loadStatusHistoryNormalizer();
    const friend = {
        type: 'char',
        profilePanel: {
            thought: '当前内容',
            location: '当前地点',
            action: '当前动作',
            mood: '当前心情',
            expression: '当前表情',
            statusHistory: [{ thought: '历史内容', location: '历史地点', action: '历史动作' }],
            thoughtHistory: [{ content: '更旧内容', mood: '历史心情', expression: '历史表情' }]
        }
    };

    assert.equal(migrate(friend), true);
    assert.equal(migrate(friend), false);
    assert.deepEqual(Object.keys(friend.profilePanel).sort(), ['statusHistory', 'thought', 'thoughtHistory']);
    assert.deepEqual(Object.keys(friend.profilePanel.statusHistory[0]).sort(), ['thought']);
    assert.deepEqual(Object.keys(friend.profilePanel.thoughtHistory[0]).sort(), ['content']);
});

test('single-chat status UI swipes the whole card and removes the old settings manager', async () => {
    const [html, statusSource, aiSource] = await Promise.all([
        readWorkspaceFile('index.html'),
        readWorkspaceFile('js/imessage/4_chat_status.js'),
        readWorkspaceFile('js/imessage/4_chat_ai.js')
    ]);

    assert.doesNotMatch(html, /id="stickers-btn"/);
    assert.doesNotMatch(html, /id="bind-stickers-sheet"/);
    assert.match(html, /css\/imessage\.css\?v=[^"']*status-prompt-v3/);
    assert.match(statusSource, /class="chat-profile-status-page"/);
    assert.match(statusSource, /statusCard\.addEventListener\('pointermove'/);
    assert.match(statusSource, /statusCard\.style\.transform = `translateX/);
    assert.doesNotMatch(statusSource, /class="chat-profile-status-carousel"/);
    assert.match(statusSource, /data-action="edit-status"/);
    assert.match(statusSource, /data-action="delete-status"/);
    assert.doesNotMatch(statusSource, /chat-profile-status-meta-grid/);
    assert.doesNotMatch(statusSource, /name="location"/);
    assert.equal((statusSource.match(/<button[^>]+data-action="page-status"/g) || []).length, 2);
    assert.match(statusSource, /data-direction="newer"/);
    assert.match(statusSource, /data-direction="older"/);
    assert.match(statusSource, /const events = Array\.isArray\(panel\.events\)/);
    assert.match(aiSource, /existingStatusHistory\.unshift\(\{/);
    assert.match(aiSource, /affection: newAffection/);
});
