import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import vm from 'node:vm';

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

test('parses offline bilingual dialogue for display while keeping Minimax source language only', () => {
    assert.equal(utils.getChatLanguageName('ko'), 'Korean');
    assert.equal(utils.getChatLanguageName('ja'), 'Japanese');
    assert.equal(utils.getChatLanguageName('en'), 'English');
    assert.equal(utils.getChatLanguageName('fr'), 'French');

    assert.deepEqual(utils.parseBilingualDialogue('잘자（晚安）', 'ko'), {
        original: '잘자',
        translation: '晚安'
    });
    assert.deepEqual(utils.parseBilingualDialogue('おやすみ（晚安）', 'ja'), {
        original: 'おやすみ',
        translation: '晚安'
    });
    assert.deepEqual(utils.parseBilingualDialogue('Good night（晚安）', 'en'), {
        original: 'Good night',
        translation: '晚安'
    });
    assert.deepEqual(utils.parseBilingualDialogue('Bonne nuit（晚安）', 'fr'), {
        original: 'Bonne nuit',
        translation: '晚安'
    });
    assert.deepEqual(utils.parseBilingualDialogue('晚安', 'zh'), {
        original: '晚安',
        translation: ''
    });
    assert.deepEqual(utils.parseBilingualDialogue('Good night (晚安)', 'en'), {
        original: 'Good night (晚安)',
        translation: ''
    });
    assert.deepEqual(utils.parseBilingualDialogue('Good night（translation）', 'en'), {
        original: 'Good night（translation）',
        translation: ''
    });
});

test('parses one-shot offline meeting artifacts and guarantees recallable memory tags', () => {
    const parsed = utils.parseOfflineMeetingArtifacts(JSON.stringify({
        meetingSummary: {
            title: '雨天见面',
            summary: 'Char 在咖啡馆见到 User，两人聊完近期安排后一同离开。'
        },
        shortTermMemory: {
            title: '咖啡馆之约',
            event: '我在咖啡馆见到 User，并记住了当天的雨声。',
            memoryPoints: '雨声、咖啡香、安心',
            memoryTags: ['咖啡馆', 'User'],
            degree: '低'
        },
        activatedEntryIds: ['old-memory', 'old-memory']
    }), {
        dateText: '2026年07月13日 12:30',
        userName: 'User',
        charName: 'Char',
        isGroup: false
    });

    assert.equal(parsed.meetingSummary.title, '雨天见面');
    assert.equal(parsed.shortTermMemory.degree, '高');
    assert.equal(parsed.shortTermMemory.time, '2026年07月13日 12:30');
    assert.equal(parsed.shortTermMemory.memoryTags[0], '线下见面');
    assert.equal(parsed.shortTermMemory.memoryTags.includes('咖啡馆'), true);
    assert.deepEqual(parsed.activatedEntryIds, ['old-memory']);
    assert.equal(parsed.usedMemoryFallback, false);
});

test('builds a local short-term memory when offline artifact memory is missing', () => {
    const parsed = utils.parseOfflineMeetingArtifacts(JSON.stringify({
        meetingSummary: {
            title: '散步',
            summary: 'Char 和 User 在河边散步，最后约定下次再见。'
        }
    }), {
        dateText: '2026年07月13日 20:00',
        userName: 'User',
        charName: 'Char'
    });

    assert.equal(parsed.usedMemoryFallback, true);
    assert.equal(parsed.shortTermMemory.event, parsed.meetingSummary.summary);
    assert.equal(parsed.shortTermMemory.memoryTags.includes('线下见面'), true);
    assert.equal(utils.parseOfflineMeetingArtifacts('{"meetingSummary":{"title":"空","summary":""}}'), null);
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

test('offline meeting state is mutated only inside the persisted friend transaction', async () => {
    const source = await fs.readFile(new URL('../js/imessage/4_chat_sheet.js', import.meta.url), 'utf8');

    assert.doesNotMatch(source, /activeFriend\.offlineMessages\s*=/);
    assert.doesNotMatch(source, /activeFriend\.offlineMeetingSessions\s*=/);
    assert.doesNotMatch(source, /activeFriend\.offlineMeetingActive\s*=/);
    assert.doesNotMatch(source, /activeFriend\.offlineCurrentSessionId\s*=/);
    assert.doesNotMatch(source, /activeFriend\.offlineMeetingStartedAt\s*=/);
    assert.doesNotMatch(source, /activeFriend\.offlineRegexScripts\s*=/);
    assert.match(source, /const saved = await commitSheetFriendChange\(activeFriend\.id,[\s\S]*?targetFriend\.offlineMessages = normalized/);
    assert.match(source, /if \(!saved\) throw new Error\('Failed to persist offline meeting messages'\)/);
    assert.match(source, /if \(!savedSession\)[\s\S]*?Failed to save offline meeting artifacts/);
    assert.match(source, /onRollback: \(\) => \{[\s\S]*?window\.imData\.currentActiveFriend = restoredFriend/);
});

test('offline meeting completion persists one online context record and one linked memory', async () => {
    const [sheetSource, coreSource, storageSource, bubblesSource] = await Promise.all([
        fs.readFile(new URL('../js/imessage/4_chat_sheet.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/2_core.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/storage/app_storage.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_bubbles.js', import.meta.url), 'utf8')
    ]);

    assert.match(sheetSource, /"meetingSummary"[\s\S]*?"shortTermMemory"[\s\S]*?"activatedEntryIds"/);
    assert.match(sheetSource, /shortTermMemory\.event 必须使用第三人称公开记录视角/);
    assert.match(sheetSource, /sourceType: 'offline_meeting'[\s\S]*?sourceId: String\(sessionId\)/);
    assert.match(sheetSource, /applyGeneratedShortTermMemory\(targetFriend, memoryEntry,[\s\S]*?updateSummaryCursor: false/);
    assert.match(sheetSource, /targetFriend\.messages = targetFriend\.messages\.filter[\s\S]*?targetFriend\.messages\.push\(recordMsg\)[\s\S]*?targetFriend\.offlineMeetingSessions/);
    assert.doesNotMatch(sheetSource, /meetingMessages: session\.messages/);
    assert.match(sheetSource, /linkedMemory\.event = summaryText/);
    assert.match(sheetSource, /entry\?\.sourceType === 'offline_meeting'[\s\S]*?String\(entry\.sourceId \|\| ''\) === sessionId/);

    assert.match(coreSource, /buildOfflineMeetingContext = function/);
    assert.match(coreSource, /excludeOfflineMeetingRecords/);
    assert.match(coreSource, /sourceType: String\(entry\?\.sourceType/);
    assert.match(storageSource, /offlineSessionId: typeof safe\.offlineSessionId/);
    assert.match(storageSource, /rawSummary: typeof safe\.rawSummary/);
    assert.match(storageSource, /offlineSessionId: row\.offlineSessionId/);
    assert.match(bubblesSource, /resolveOfflineMeetingDetailMessage[\s\S]*?friend\?\.offlineMeetingSessions/);
    assert.match(bubblesSource, /modal\.className = 'bottom-sheet-overlay detail-sheet-overlay wb-centered-modal-overlay'/);
    assert.match(bubblesSource, /const dateText = msg\.dateText \|\| formatOfflineMeetingTimestamp\(timestamp\);[\s\S]*?aria-label="查看见面总结"[\s\S]*?fa-user-friends[\s\S]*?escapeHtml\(title\)[\s\S]*?escapeHtml\(dateText\)/);
    assert.doesNotMatch(bubblesSource, /offline-meeting-record-card[\s\S]{0,500}?escapeHtml\(summaryText\)/);
    assert.doesNotMatch(bubblesSource, /没有逐楼记录|>楼层</);
});

test('offline single chat follows the bound account identity and refreshes visible user bubbles', async () => {
    const [source, settingsSource, html] = await Promise.all([
        fs.readFile(new URL('../js/imessage/4_chat_sheet.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/5_settings.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
    ]);

    assert.match(source, /function getOfflineBoundAccountForFriend\(friend\)[\s\S]*?getFriendById\?\.\(friend\.id\)[\s\S]*?latestFriend\.type === 'group'[\s\S]*?latestFriend\.boundAccountId/);
    assert.match(source, /function getOfflineEffectiveUserProfile\(friend, currentUserState = null\)[\s\S]*?const boundAccount = getOfflineBoundAccountForFriend\(friend\)[\s\S]*?const source = boundAccount \|\| fallback/);
    assert.match(source, /const offlineUserProfile = getOfflineEffectiveUserProfile\(friend\)[\s\S]*?offlineUserProfile\.name[\s\S]*?offlineUserProfile\.signature[\s\S]*?offlineUserProfile\.avatarUrl/);
    assert.match(source, /userPersona: userProfile\.persona/);
    assert.match(source, /identityContext\.userPersona \|\| ''/);
    assert.match(source, /const userPersona = identityContext\?\.userPersona \|\| 'A normal user'/);
    assert.match(source, /function refreshOfflineUserIdentity\(friendOrId\)[\s\S]*?querySelectorAll\('\.offline-tavern-bubble\.user'\)[\s\S]*?nameEl\.textContent = profile\.name[\s\S]*?signEl\.textContent = profile\.signature/);
    assert.match(source, /imChat\.refreshOfflineUserIdentity = refreshOfflineUserIdentity/);
    assert.match(settingsSource, /window\.imChat\?\.refreshOfflineUserIdentity[\s\S]*?window\.imChat\.refreshOfflineUserIdentity\(friend\)/);
    assert.match(settingsSource, /updateChatBindIdLabel\(window\.imData\.currentSettingsFriend\);[\s\S]*?refreshChatPageForFriend\(window\.imData\.currentSettingsFriend\);/);
    assert.match(html, /offline_reasoning\.js\?v=20260716-reasoning-autoparse-v6/);
    assert.match(html, /4_chat_sheet\.js\?v=20260718-ios-pwa-export-v1/);
    assert.match(html, /5_settings\.js\?v=20260716-status-prompt-v3/);
});

test('Char moment images use external grayscale photos and reveal descriptions only in detail', async () => {
    const [source, html] = await Promise.all([
        fs.readFile(new URL('../js/imessage/6_moments.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
    ]);

    assert.match(source, /function createMomentExternalImageUrl\(image, fallbackSeed = ''\)[\s\S]*?picsum\.photos[\s\S]*?grayscale/);
    assert.match(source, /function getMomentImageSource\(image\)[\s\S]*?image\.kind === 'external'[\s\S]*?createMomentExternalImageUrl/);
    assert.match(source, /function openMomentImageDetail\(image, moment\)[\s\S]*?moment-image-detail-description/);
    assert.match(source, /const desc = normalizeMomentImageDescription\(image\?\.description \|\| image\?\.desc \|\| ''\)[\s\S]*?kind: 'external'/);
    assert.match(source, /Every images\[\]\.description must be written only in natural Simplified Chinese/);
    assert.equal((source.match(/getMomentImageSource\(/g) || []).length >= 5, true);
    assert.doesNotMatch(source, /createMomentDescriptionImageUrl|drawMomentImageDescription/);
    assert.match(html, /6_moments\.js\?v=20260718-moments-target-reply-v1/);
});

test('moment-generated private chat follows the friend language and stores Chinese translations', async () => {
    const [source, html] = await Promise.all([
        fs.readFile(new URL('../js/imessage/6_moments.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
    ]);

    assert.match(source, /function parseAutoMomentResponse\(aiResponse, language\)[\s\S]*?normalizeMomentLocalizedContent\(reply, language\)/);
    assert.match(source, /const targetLanguage = normalizeMomentLanguage\(friend\.language \|\| 'zh'\)/);
    assert.match(source, /buildMomentLanguageContract\(targetLanguage, 'every chatReplies item'\)/);
    assert.match(source, /content: cleanReplies\[index\]\.text[\s\S]*?msgObj\.translation = cleanReplies\[index\]\.translation[\s\S]*?msgObj\.showTranslation = false/);
    assert.match(html, /6_moments\.js\?v=20260718-moments-target-reply-v1/);
});

test('offline chat dialogue and settings use the fullscreen studio presentation', async () => {
    const [html, source, css] = await Promise.all([
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_sheet.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../css/imessage.css', import.meta.url), 'utf8')
    ]);

    assert.match(html, /class="app-view offline-settings-view" id="offline-tavern-settings-sheet"/);
    assert.match(html, /id="offline-tavern-settings-back-btn"/);
    assert.match(html, /OFFLINE STUDIO/);
    assert.doesNotMatch(html, /bottom-sheet-overlay detail-sheet-overlay" id="offline-tavern-settings-sheet"/);
    assert.match(source, /offline-tavern-speech offline-tavern-dialogue/);
    assert.match(source, /id: 'bilingual_dialogue'[\s\S]*?name: '双语对话'[\s\S]*?presetVersion: 1/);
    assert.match(source, /'format_rules',[\s\S]*?'bilingual_dialogue',[\s\S]*?'perspective_first',[\s\S]*?'barrage_comments',[\s\S]*?'player_choices'/);
    assert.match(source, /id: 'cot_before'[\s\S]*?name: 'COT前'[\s\S]*?presetVersion: 6[\s\S]*?请先思考并逐项检查：\n<thinking>/);
    assert.match(source, /id: 'cot_scene_planning'[\s\S]*?name: 'cot-情景规划'[\s\S]*?是否结合世界书、人设、记忆/);
    assert.match(source, /id: 'cot_literary_guidance'[\s\S]*?name: 'cot-文学指导'[\s\S]*?<literary_guidance>[\s\S]*?至少三部与当前题材、风格相关的名著/);
    assert.match(source, /id: 'cot_language_check'[\s\S]*?name: 'cot-语言检查'[\s\S]*?是否按照角色默认语言书写台词/);
    assert.match(source, /id: 'cot_output_audit'[\s\S]*?name: 'cot-输出审查'[\s\S]*?是否遵循全部启用的格式规则与任务要求/);
    assert.match(source, /id: 'cot_after'[\s\S]*?name: 'COT后'[\s\S]*?presetVersion: 5[\s\S]*?content: `<\/thinking>`/);
    assert.match(source, /const modularCotIds = \['cot_scene_planning', 'cot_literary_guidance', 'cot_language_check', 'cot_output_audit'\]/);
    assert.match(source, /const fullCotIds = \['cot_before', \.\.\.modularCotIds, 'cot_after'\]/);
    assert.match(source, /if \(id === 'cot'\) \{[\s\S]*?appendMigratedCotPrompts\(fullCotIds, prompt\.enabled !== false\)/);
    assert.match(source, /if \(id === 'cot_content'\) \{[\s\S]*?appendMigratedCotPrompts\(modularCotIds, prompt\.enabled !== false\)/);
    assert.match(source, /modularCotIds\.includes\(defaultPrompt\.id\)[\s\S]*?findIndex\(prompt => prompt\.id === 'cot_after'\)/);
    assert.match(source, /非中文台词是否紧跟准确的中文翻译，并使用规定的直角引号和全角括号/);
    assert.match(source, /Default Language: \$\{defaultLanguage\}/);
    assert.match(source, /const quoteRegex = \/「\(\[\^」\\n\]\{1,180\}\)」\/g/);
    assert.match(source, /parseOfflineBilingualDialogue\(match\[1\], language\)/);
    assert.doesNotMatch(source, /quoteRegex = [^\n]*“/);
    assert.doesNotMatch(source, /quoteRegex = [^\n]*\[\^"\\n\]/);
    assert.match(source, /detail: '「」包裹的对话'/);
    assert.match(source, /language: friend\?\.language \|\| 'zh'/);
    assert.match(source, /offline-tavern-dialogue is-playable[\s\S]*?role="button"[\s\S]*?aria-busy="false"/);
    assert.match(source, /querySelectorAll\('\.offline-tavern-speech\.is-playable'\)/);
    assert.match(source, /window\.getSelection\(\)[\s\S]*?!selection\.isCollapsed/);
    assert.match(source, /event\.key !== 'Enter' && event\.key !== ' '/);
    assert.doesNotMatch(source, /offline-tavern-voice-btn/);
    assert.match(source, /closeView\(document\.getElementById\('offline-tavern-settings-sheet'\)\)/);
    assert.match(css, /\.offline-tavern-dialogue\s*\{\s*color:\s*var\(--offline-tavern-dialogue-color,\s*#8b8b8b\);\s*\}/);
    assert.match(css, /\.offline-tavern-speech\.is-playable:hover\s*\{[\s\S]*?background:\s*rgba\(0, 0, 0, 0\.045\)/);
    assert.match(css, /\.offline-tavern-speech\.is-playable\.is-loading\s*\{[\s\S]*?cursor:\s*wait/);
    assert.match(css, /\.offline-settings-view\.active\s*\{[\s\S]*?display:\s*flex/);
    assert.match(css, /@media \(max-width: 520px\)[\s\S]*?\.offline-settings-prompt-content\s*\{[\s\S]*?margin-left:\s*0/);
});

test('offline COT normalization expands legacy entries and preserves module switches', async () => {
    const source = await fs.readFile(new URL('../js/imessage/4_chat_sheet.js', import.meta.url), 'utf8');
    const start = source.indexOf('const OFFLINE_LEGACY_PROMPT_ID_BY_NAME');
    const end = source.indexOf('const serializeOfflinePrompts');
    assert.ok(start >= 0 && end > start);

    const context = {
        OFFLINE_CHAT_HISTORY_PROMPT_ID: 'chat_history',
        OFFLINE_TAVERN_PROMPT_ORDER: [
            'role_identity', 'data_zone', 'memory_system', 'chat_history',
            'task_instruction', 'length_words', 'nsfw', 'bilingual_dialogue',
            'perspective_first', 'perspective_second', 'perspective_third',
            'style_creative_guidance', 'style_baimiao', 'style_green_apple',
            'barrage_comments', 'format_rules', 'player_choices',
            'cot_before', 'cot_scene_planning', 'cot_literary_guidance', 'cot_language_check', 'cot_output_audit', 'cot_after'
        ]
    };
    vm.runInNewContext(`${source.slice(start, end)}\nthis.normalizeOfflinePromptsForTest = normalizeOfflinePrompts;`, context);
    const normalize = context.normalizeOfflinePromptsForTest;
    const cotIds = ['cot_before', 'cot_scene_planning', 'cot_literary_guidance', 'cot_language_check', 'cot_output_audit', 'cot_after'];
    const onlyCot = prompts => normalize(prompts).filter(prompt => String(prompt.id).startsWith('cot'));

    const fresh = onlyCot([]);
    assert.deepEqual(Array.from(fresh, prompt => prompt.id), cotIds);
    assert.ok(fresh.every(prompt => prompt.enabled));

    const migratedContent = onlyCot([
        { id: 'cot_before', name: 'COT前', enabled: true },
        { id: 'cot_content', name: 'COT内容', enabled: false },
        { id: 'cot_after', name: 'COT后', enabled: true }
    ]);
    assert.deepEqual(Array.from(migratedContent, prompt => prompt.id), cotIds);
    assert.ok(migratedContent.slice(1, 5).every(prompt => prompt.enabled === false));

    const migratedLegacy = onlyCot([{ id: 'cot', name: 'COT', enabled: false }]);
    assert.deepEqual(Array.from(migratedLegacy, prompt => prompt.id), cotIds);
    assert.ok(migratedLegacy.every(prompt => prompt.enabled === false));

    const independent = onlyCot(cotIds.map((id, index) => ({
        id,
        name: id,
        enabled: index % 2 === 0,
        presetVersion: 2
    }))); 
    assert.deepEqual(Array.from(independent, prompt => prompt.enabled), [true, false, true, false, true, false]);
    assert.equal(independent.find(prompt => prompt.id === 'cot_before').content, '请先思考并逐项检查：\n<thinking>');
    assert.equal(independent.find(prompt => prompt.id === 'cot_after').content, '</thinking>');

    const freshIds = Array.from(normalize([]), prompt => prompt.id);
    assert.deepEqual(freshIds, context.OFFLINE_TAVERN_PROMPT_ORDER);

    const migratedWithCustom = normalize([
        { id: 'role_identity', name: 'custom role name', enabled: false, content: 'CUSTOM ROLE' },
        { id: 'data_zone', name: 'data', enabled: true },
        { id: 'custom-after-data', name: 'custom', enabled: true, content: 'CUSTOM' },
        { id: 'length_words', name: 'length', enabled: true },
        { id: 'barrage_comments', name: 'barrage', enabled: false, content: 'CUSTOM BARRAGE' }
    ]);
    assert.equal(
        migratedWithCustom.findIndex(prompt => prompt.id === 'custom-after-data'),
        migratedWithCustom.findIndex(prompt => prompt.id === 'data_zone') + 1
    );
    assert.deepEqual(
        Object.fromEntries(['name', 'enabled', 'content'].map(key => [key, migratedWithCustom.find(prompt => prompt.id === 'role_identity')[key]])),
        { name: 'custom role name', enabled: false, content: 'CUSTOM ROLE' }
    );
    assert.equal(migratedWithCustom.find(prompt => prompt.id === 'barrage_comments').enabled, false);
    assert.equal(migratedWithCustom.find(prompt => prompt.id === 'barrage_comments').content, 'CUSTOM BARRAGE');

    const migratedGreenApple = normalize([
        { id: 'chat_history', name: '上下文', enabled: true, presetVersion: 2 },
        { id: 'style_green_apple', name: '文风-青苹果', enabled: true, presetVersion: 2, content: 'OLD GREEN APPLE' }
    ]);
    assert.equal(migratedGreenApple.find(prompt => prompt.id === 'style_green_apple').enabled, true);
    assert.match(migratedGreenApple.find(prompt => prompt.id === 'style_green_apple').content, /温柔清透，留白感强/);
    assert.equal(migratedGreenApple.find(prompt => prompt.id === 'chat_history').presetVersion, 3);

    const migratedCreativeGuidance = normalize([
        { id: 'chat_history', name: '上下文', enabled: true, presetVersion: 3 },
        { id: 'style_creative_guidance', name: '文风-创作指导', enabled: true, presetVersion: 1, content: 'OLD CREATIVE GUIDANCE' }
    ]);
    const creativeGuidance = migratedCreativeGuidance.find(prompt => prompt.id === 'style_creative_guidance');
    assert.equal(creativeGuidance.presetVersion, 4);
    assert.equal(creativeGuidance.name, '文学指导');
    assert.match(creativeGuidance.content, /^<literary_guidance>[\s\S]*<\/literary_guidance>$/);
    assert.match(creativeGuidance.content, /Draw extensively on and emulate relevant literary classics\./);
    assert.doesNotMatch(creativeGuidance.content, /#/);

    const userOrdered = normalize([]);
    const markerIndex = userOrdered.findIndex(prompt => prompt.id === 'chat_history');
    const [marker] = userOrdered.splice(markerIndex, 1);
    userOrdered.unshift(marker);
    assert.deepEqual(
        Array.from(normalize(userOrdered), prompt => prompt.id),
        Array.from(userOrdered, prompt => prompt.id)
    );

    const previousOrder = normalize([]);
    previousOrder.find(prompt => prompt.id === 'chat_history').presetVersion = 2;
    const migratedOrder = normalize(previousOrder);
    assert.deepEqual(Array.from(migratedOrder.slice(-6), prompt => prompt.id), cotIds);
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
