import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';

const require = createRequire(import.meta.url);
const utils = require('../js/imessage/data_utils.js');

test('summary batch maps user rounds to the complete dynamic message count', () => {
    const messages = [];
    for (let round = 1; round <= 32; round += 1) {
        messages.push({ role: 'user', content: `u${round}` });
        const replyCount = round % 3 + 1;
        for (let reply = 0; reply < replyCount; reply += 1) {
            messages.push({ role: 'assistant', content: `a${round}-${reply}` });
        }
    }

    const batch = utils.getSummaryBatch(messages, 0, 30);
    const expectedCount = messages.findIndex(message => message.content === 'u31');
    assert.equal(batch.ready, true);
    assert.equal(batch.availableRounds, 32);
    assert.equal(batch.selectedRounds, 30);
    assert.equal(batch.selectedMessageCount, expectedCount);
    assert.equal(batch.endIndex, expectedCount);

    const remainder = utils.getSummaryBatch(messages, batch.endIndex, 30);
    assert.equal(remainder.availableRounds, 2);
    assert.equal(remainder.ready, false);
    assert.equal(remainder.selectedRounds, 2);
    assert.equal(remainder.selectedMessageCount, messages.length - expectedCount);
});

test('summary batch respects an existing message boundary and ignores assistant-only backlog as rounds', () => {
    const messages = [
        { role: 'user', content: 'old' },
        { role: 'assistant', content: 'old reply' },
        { role: 'assistant', content: 'proactive' },
        { role: 'user', content: 'new' },
        { role: 'assistant', content: 'new reply 1' },
        { role: 'assistant', content: 'new reply 2' }
    ];
    const batch = utils.getSummaryBatch(messages, 2, 1);
    assert.equal(batch.selectedRounds, 1);
    assert.equal(batch.selectedMessageCount, 4);
    assert.equal(batch.endIndex, messages.length);
});

test('group chat memory keeps the latest 30 public messages and excludes private notices', () => {
    const messages = Array.from({ length: 35 }, (_, index) => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `public-${index + 1}`
    }));
    messages.splice(10, 0, { role: 'system', noticeKind: 'group_private_to_user', content: 'private to user' });
    messages.splice(20, 0, { role: 'system', noticeKind: 'group_friend_private_chat', content: 'private friend chat' });

    const recent = utils.getRecentPublicGroupMessages(messages);
    assert.equal(recent.messageLimit, 30);
    assert.equal(recent.availableMessageCount, 35);
    assert.equal(recent.selectedMessageCount, 30);
    assert.deepEqual(recent.selectedMessages.map(message => message.content), Array.from(
        { length: 30 },
        (_, index) => `public-${index + 6}`
    ));
});

test('normalizes group chat memory contexts as unique group IDs', () => {
    assert.deepEqual(utils.normalizeGroupChatContexts([
        { groupId: 'group-a', roundLimit: 5 },
        { groupId: 'group-a', messageLimit: 20 },
        { groupId: 7, roundLimit: 0 },
        { groupId: '', roundLimit: 8 },
        null
    ]), [
        { groupId: 'group-a', messageLimit: 30 },
        { groupId: '7', messageLimit: 30 }
    ]);
});

test('deleting short-term summaries keeps the covered conversation out of the unsummarized queue', () => {
    const messages = [];
    for (let round = 1; round <= 10; round += 1) {
        messages.push({ role: 'user', content: `u${round}` });
        messages.push({ role: 'assistant', content: `a${round}` });
    }

    const memory = {
        lastSummaryMessageCount: 5,
        shortTermEntries: [
            { id: 'earlier-summary', sourceEndMessageCount: 3 },
            { id: 'latest-summary', sourceEndMessageCount: 5 }
        ]
    };
    const getUnsummarizedRounds = () => utils.getSummaryBatch(messages, memory.lastSummaryMessageCount, 30).availableRounds;

    assert.equal(getUnsummarizedRounds(), 7);
    memory.shortTermEntries = utils.removeShortTermSummaryEntry(memory.shortTermEntries, 'latest-summary');
    assert.deepEqual(memory.shortTermEntries.map(entry => entry.id), ['earlier-summary']);
    assert.equal(getUnsummarizedRounds(), 7);

    memory.shortTermEntries = utils.removeShortTermSummaryEntry(memory.shortTermEntries, 'earlier-summary');
    assert.deepEqual(memory.shortTermEntries, []);
    assert.equal(getUnsummarizedRounds(), 7);
});

test('normalizes AI, Loves and manual schedule event shapes without dropping compatibility fields', () => {
    const schedule = utils.normalizeSchedule({
        enabled: true,
        sleepTime: '22:30',
        wakeTime: '07:30',
        events: [
            {
                id: 'ai',
                title: '看电影',
                date: '2026-07-10',
                startTime: '19:00',
                endTime: '21:00',
                location: '影院',
                source: 'icloud'
            },
            {
                id: 'manual',
                name: '早餐',
                rawTime: '2026-07-09T08:00',
                endAt: '2026-07-09T09:00'
            }
        ]
    });

    assert.equal(schedule.events.length, 2);
    assert.equal(schedule.events[0].id, 'manual');
    assert.equal(schedule.events[1].id, 'ai');
    assert.equal(schedule.events[1].name, '看电影');
    assert.equal(schedule.events[1].rawTime, '2026-07-10T19:00');
    assert.equal(schedule.events[1].endAt, '2026-07-10T21:00');
    assert.match(schedule.events[1].time, /2026年07月10日 19:00/);
    assert.equal(schedule.events[1].date, '2026-07-10');
    assert.equal(schedule.events[1].startTime, '19:00');
    assert.equal(schedule.events[1].endTime, '21:00');
});

test('parses TXT or DOCX extracted manifest text as name plus URL per line', () => {
    const parsed = utils.parseStickerManifestText(`开心 https://example.com/happy.png\n晚安猫 https://example.com/cat.webp\ninvalid-line`);
    assert.deepEqual(parsed.items, [
        { name: '开心', url: 'https://example.com/happy.png' },
        { name: '晚安猫', url: 'https://example.com/cat.webp' }
    ]);
    assert.deepEqual(parsed.invalidLines, [3]);
});

test('ships the full-screen sticker manager, manifest upload, and protected moment content layout', async () => {
    const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(html, /class="app-view stickers-view" id="stickers-view"/);
    assert.match(html, /id="sticker-category-detail-sheet"/);
    assert.match(html, /id="sticker-manifest-upload-input"[^>]*\.docx/);
    assert.match(html, /class="publish-moment-content"/);
    assert.match(html, /id="chat-memory-auto-summary-toggle"/);
    assert.match(html, /id="chat-memory-summary-round-input" value="30"/);
    assert.match(html, /id="chat-memory-group-context-btn"/);
});

test('injects loaded group chat memory only into character single-chat prompts', async () => {
    const [source, settingsSource, coreSource, cssSource] = await Promise.all([
        fs.readFile(new URL('../js/imessage/4_chat_ai.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/5_settings.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/2_core.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../css/imessage.css', import.meta.url), 'utf8')
    ]);
    assert.match(source, /async function buildGroupChatMemoryContext\(currentFriend\)/);
    assert.match(source, /if \(currentFriend\.type === 'group'\) return ''/);
    assert.match(source, /await window\.imApp\.loadEligibleGroupChatMemoryContexts\(currentFriend\)/);
    assert.match(source, /getRecentPublicGroupMessages\(group\.messages, messageLimit\)/);
    assert.doesNotMatch(source, /getRecentUserRounds\(group\.messages, roundLimit\)/);
    assert.match(source, /<group_chat_memories>/);
    assert.match(source, /<member_identity>/);
    assert.match(source, /group_private_to_user/);
    assert.match(source, /if \(groupChatMemoryContext && friend\.type !== 'group'\)/);
    assert.match(source, /role: 'system',\s*content: groupChatMemoryContext/);
    assert.match(settingsSource, /<select class="chat-memory-group-picker-select"/);
    assert.doesNotMatch(settingsSource, /id="chat-memory-group-context-list"/);
    assert.match(settingsSource, /const modalRoot = chatSettingsSheet \|\| memoryPanel/);
    assert.match(settingsSource, /modalRoot\.appendChild\(overlay\)/);
    assert.match(settingsSource, /messageLimit: 30/);
    assert.match(settingsSource, /chat-memory-group-context-limit-input/);
    assert.match(settingsSource, /normalizeMessageLimit\(numericValue, 30\)/);
    assert.match(settingsSource, /metaOnly: false,\s*includeMessages: false,\s*syncActive: true/);
    assert.match(coreSource, /loadEligibleGroupChatMemoryContexts = async function/);
    assert.match(coreSource, /isDirectMember \|\| isResolvedMember/);
    assert.match(coreSource, /normalizeGroupChatContexts\(memory\.groupChatContexts\)/);
    assert.match(cssSource, /\.chat-memory-modal-overlay\s*\{[\s\S]*?z-index: 1100/);
});
