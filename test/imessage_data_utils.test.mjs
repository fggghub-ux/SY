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
    assert.match(source, /if \(!savedSession\)[\s\S]*?Failed to save offline meeting session/);
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
    assert.match(html, /4_chat_sheet\.js\?v=20260713-offline-bound-id-v1/);
    assert.match(html, /5_settings\.js\?v=20260713-offline-bound-id-v1/);
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
    assert.match(html, /6_moments\.js\?v=20260713-moments-comment-delete-v4/);
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
    assert.match(html, /6_moments\.js\?v=20260713-moments-comment-delete-v4/);
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
    assert.match(source, /const bilingualPrompt = prompts\.find\(prompt => prompt\.id === 'bilingual_dialogue'\)[\s\S]*?concat\(bilingualPrompt \? \[bilingualPrompt\] : \[\]\)[\s\S]*?concat\(barragePrompt/);
    assert.match(source, /id: 'cot'[\s\S]*?presetVersion: 3[\s\S]*?Read Char's Default Language[\s\S]*?audit every drafted Char dialogue line/);
    assert.match(source, /Correct all language, translation, corner-quote, and full-width-parenthesis errors/);
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
