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
});
