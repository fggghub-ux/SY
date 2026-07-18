import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';

const require = createRequire(import.meta.url);
const utils = require('../js/imessage/data_utils.js');

test('moment localized content enforces Chinese translations for non-Chinese speakers', () => {
    assert.deepEqual(utils.normalizeLocalizedContent({ text: '晚安', translation: 'ignored' }, 'zh'), {
        text: '晚安',
        translation: '',
        language: 'zh'
    });
    assert.deepEqual(utils.normalizeLocalizedContent({ text: 'Good night', translation: '晚安' }, 'en'), {
        text: 'Good night',
        translation: '晚安',
        language: 'en'
    });
    assert.equal(utils.normalizeLocalizedContent({ text: 'Good night', translation: '' }, 'en'), null);
    assert.equal(utils.normalizeLocalizedContent({ text: 'おやすみ', translation: '' }, 'ja'), null);
    assert.equal(utils.normalizeLocalizedContent({ text: '잘 자', translation: '' }, 'ko'), null);
    assert.equal(utils.normalizeLocalizedContent({ text: 'Bonne nuit', translation: '' }, 'fr'), null);
    assert.match(utils.buildLocalizedJsonContract('en', 'post'), /Simplified Chinese translation/);
    assert.match(utils.buildLocalizedJsonContract('zh', 'post'), /translation must be an empty string/);
});

test('moments uses one strict JSON publishing pipeline for batch and autonomous posts', async () => {
    const [momentsSource, chatAiSource] = await Promise.all([
        fs.readFile(new URL('../js/imessage/6_moments.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_ai.js', import.meta.url), 'utf8')
    ]);

    assert.match(momentsSource, /async function generateAndPublishMoment\(friend, options = \{\}\)/);
    assert.match(momentsSource, /window\.imApp\.generateAndPublishMoment = generateAndPublishMoment/);
    assert.match(momentsSource, /"post":\{"text":"moment text","translation":"Chinese translation or empty string"\}/);
    assert.match(momentsSource, /speakerId":"allowed id"/);
    assert.doesNotMatch(momentsSource, /\[Comment:\s/);
    assert.doesNotMatch(momentsSource, /\[Thought:\s/);
    assert.match(chatAiSource, /window\.imApp\.generateAndPublishMoment\(latestFriend/);
    assert.doesNotMatch(chatAiSource, /function generateAutonomousMomentText/);
});

test('moments renders translation controls and a persisted unread message bubble', async () => {
    const [momentsSource, coreSource, html, css] = await Promise.all([
        fs.readFile(new URL('../js/imessage/6_moments.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/2_core.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
        fs.readFile(new URL('../css/imessage.css', import.meta.url), 'utf8')
    ]);

    assert.match(html, /id="moments-new-message-bubble"/);
    assert.match(css, /\.moments-new-message-bubble\s*\{/);
    assert.match(momentsSource, /<span class="moment-translate-btn moment-post-translate-btn"/);
    assert.match(momentsSource, /<span class="moment-translate-btn moment-comment-translate-btn"/);
    assert.match(momentsSource, /<span class="moment-translate-btn moment-thought-translate-btn"/);
    assert.match(momentsSource, /class="moment-comment-delete"[^>]*>删除<\/span>/);
    assert.match(momentsSource, /function deleteMomentComment\(momentId, commentIndex\)/);
    assert.match(momentsSource, /title: `回复[\s\S]*?confirmTone: 'dark'/);
    assert.match(css, /\.moment-comment-delete\s*\{/);
    assert.doesNotMatch(momentsSource, /<button[^>]*moment-(post|comment|thought)-translate-btn/);
    assert.match(momentsSource, /picsum\.photos\/seed\/\$\{encodeURIComponent\(`moment_\$\{seed\}`\)\}\/900\/900\?grayscale/);
    assert.match(momentsSource, /function openMomentImageDetail\(image, moment\)/);
    assert.match(momentsSource, /function normalizeMomentImageDescription\(value\)[\s\S]*?\\u3400-\\u9fff/);
    assert.match(momentsSource, /function markCurrentMomentMessagesRead\(\)/);
    assert.match(momentsSource, /const unreadIds = new Set/);
    assert.match(momentsSource, /window\.imData\.momentMessages = previousMessages/);
    assert.match(coreSource, /contentTranslation:/);
    assert.match(coreSource, /thoughtTranslation:/);
    assert.match(coreSource, /read: false/);
});

test('moment nested replies use only the replied-to character, including on user moments', async () => {
    const momentsSource = await fs.readFile(new URL('../js/imessage/6_moments.js', import.meta.url), 'utf8');
    const targetBuilder = momentsSource.slice(
        momentsSource.indexOf('function buildMomentCommentReplyTargets('),
        momentsSource.indexOf('function cleanMomentApiJsonText(')
    );

    assert.match(targetBuilder, /addTarget\(replyFriend, relation, role\)/);
    assert.doesNotMatch(targetBuilder, /relationships\.forEach|relation network/);
    assert.match(momentsSource, /async function generateMomentUserCommentReplies\(moment, replyFriend, userComment, targetComment = null\)/);
    assert.match(momentsSource, /getWorldBookContextForFriendByPosition\('system_depth', replyFriend, worldBookContextText\)/);
    assert.match(momentsSource, /buildApiContextMessages\(replyFriend/);
    assert.match(momentsSource, /const replyFriend = explicitReplyFriend \|\| \(targetComment[\s\S]*?findFriendForMomentComment\(targetComment\)[\s\S]*?findFriendForMomentAuthor\(latestMoment\)\)/);
    assert.match(momentsSource, /triggerMomentUserCommentReplies\(momentId, userComment, targetComment, friend\)/);
    assert.match(momentsSource, /if \(findFriendForMomentAuthor\(latestMoment\)\)[\s\S]*?triggerMomentUserCommentReplies\(momentId, newComment\)/);
    assert.match(momentsSource, /const handledMomentReplyCommentIds = new Set\(\)/);
});
