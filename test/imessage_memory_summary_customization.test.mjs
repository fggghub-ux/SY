import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = path => fs.readFile(new URL(path, import.meta.url), 'utf8');

test('memory editor supports short, long, cherished, and group entry points', async () => {
    const [html, core, groups, ai] = await Promise.all([
        read('../index.html'),
        read('../js/imessage/2_core.js'),
        read('../js/imessage/3_groups.js'),
        read('../js/imessage/4_chat_ai.js')
    ]);

    assert.match(html, /id="memory-entry-editor-modal"/);
    assert.match(html, /id="memory-entry-editor-tags-input"/);
    assert.match(html, /id="memory-entry-editor-degree-select"/);
    const memoryDetailIndex = html.indexOf('id="memory-entry-detail-modal"');
    const memoryEditorIndex = html.indexOf('id="memory-entry-editor-modal"');
    const memoryScheduleIndex = html.indexOf('id="chat-memory-schedule-modal"');
    assert.ok(memoryDetailIndex >= 0 && memoryEditorIndex > memoryDetailIndex);
    assert.ok(memoryScheduleIndex > memoryEditorIndex);
    assert.match(html, /id="group-memory-shortterm-btn"/);
    assert.match(html, /id="group-memory-longterm-btn"/);
    assert.match(core, /sourceType: previous\?\.sourceType \|\| 'manual'/);
    assert.match(core, /collection === 'shortTermEntries'/);
    assert.match(core, /targetFriend\.memory\.lastSummaryMessageCount = targetFriend\.memory\.shortTermEntries\.reduce/);
    assert.match(core, /memory\.longTermEntries\.map\(entry => \(\{ entry, collection: 'longTermEntries' \}\)\)/);
    assert.match(core, /memory\.cherishedEntries\.map\(entry => \(\{ entry, collection: 'cherishedEntries' \}\)\)/);
    assert.match(groups, /openMemoryLocationForFriend\?\.\(group, 'iphone'\)/);
    assert.match(groups, /openMemoryLocationForFriend\?\.\(group, 'downloads'\)/);
    assert.match(ai, /filter\(entry => String\(entry\?\.sourceType \|\| ''\) === 'manual'\)/);
    assert.match(ai, /const cherishedEntries = isGroupChat \? \[\] : pickTriggered/);
});

test('summary settings persist an API preset and append protected custom instructions', async () => {
    const [html, core, settings, imSettings] = await Promise.all([
        read('../index.html'),
        read('../js/imessage/2_core.js'),
        read('../js/settings.js'),
        read('../js/imessage/5_settings.js')
    ]);

    assert.match(html, /id="chat-memory-summary-api-select"/);
    assert.match(html, /id="chat-memory-summary-prompt-input"/);
    assert.match(html, /id="chat-memory-summary-prompt-clear"/);
    assert.match(core, /summary: \{ enabled: false, limit: 80, roundLimit: 30, prompt: '', apiPresetId: '' \}/);
    assert.match(settings, /window\.getApiPresets = function getApiPresets/);
    assert.match(settings, /clonePlainData\(Array\.isArray\(apiPresets\)/);
    assert.match(imSettings, /function resolveSummaryApiConfig\(friend\)/);
    assert.match(imSettings, /apiPresetId: String\(summaryApiSelect\?\.value \|\| ''\)/);
    assert.match(imSettings, /prompt: String\(summaryPromptInput\?\.value \|\| ''\)\.trim\(\)/);
    assert.match(imSettings, /<user_summary_instructions>/);
    assert.match(imSettings, /最高优先级系统约束/);
    assert.match(imSettings, /禁止写入、推断或复述任何群成员私信及好友私聊内容/);
    assert.match(imSettings, /await persistSummarySettings\(friend\)/);
});

test('summaries store event occurrence time and every recalled memory exposes its time to AI', async () => {
    const [dataUtils, ai, sheet, imSettings] = await Promise.all([
        read('../js/imessage/data_utils.js'),
        read('../js/imessage/4_chat_ai.js'),
        read('../js/imessage/4_chat_sheet.js'),
        read('../js/imessage/5_settings.js')
    ]);

    assert.match(dataUtils, /function formatMemoryEventTime\(messages, fallbackTimestamp = Date\.now\(\)\)/);
    assert.match(imSettings, /window\.imDataUtils\.formatMemoryEventTime\(sourceMessages, now\.getTime\(\)\)/);
    assert.match(imSettings, /本批对话实际发生时间：\$\{eventTime\}/);
    assert.match(imSettings, /summary\.time = eventTime;/);
    assert.doesNotMatch(imSettings, /summary\.time = friend\.type === 'group'/);

    assert.ok((ai.match(/<time>\$\{entry\.time \|\| entry\.createdAt \|\| ''\}<\/time>/g) || []).length >= 4);
    assert.ok((ai.match(/<time>\$\{entry\.createdAt \|\| entry\.time \|\| ''\}<\/time>/g) || []).length >= 2);
    assert.match(ai, /<short_term_memory>/);
    assert.match(ai, /<long_term_memories>/);
    assert.match(ai, /<cherished_memories>/);
    assert.match(sheet, /<time>\$\{entry\.time \|\| entry\.createdAt \|\| ''\}<\/time>/);
    assert.match(sheet, /<long_term_memories source="vectorized_char_memory">/);
    assert.match(sheet, /<time>\$\{entry\.createdAt \|\| entry\.time \|\| ''\}<\/time>/);
});
