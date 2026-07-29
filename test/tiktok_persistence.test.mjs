import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [tiktokCoreSource, indexSource, homeSource, chatSource, profileSource, tiktokCssSource] = await Promise.all([
    fs.readFile(new URL('../js/tiktok/2_core.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/tiktok/3_home.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/tiktok/4_chat.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/tiktok/5_profile.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/tiktok.css', import.meta.url), 'utf8')
]);

test('TikTok state is rehydrated after IndexedDB-backed global data becomes ready', () => {
    assert.match(tiktokCoreSource, /window\.tkLoadStateFromStore\s*=\s*function\(\)\s*\{[\s\S]*Object\.assign\(tkState, nextState\)/);
    assert.match(tiktokCoreSource, /window\.globalDataReadyPromise\.then\(\(\) => \{/);
    assert.match(tiktokCoreSource, /window\.tkLoadStateFromStore\(\);\s*refreshTkUiAfterHydration\(\);/);
    assert.match(tiktokCoreSource, /window\.tkDataReadyPromise\s*=/);
    assert.match(indexSource, /js\/tiktok\/2_core\.js\?v=20260712-tiktok-feed-cleanup-v1/);
});

test('TikTok search generation accepts a user-selected count and rejects incomplete results', () => {
    assert.match(homeSource, /id="tk-search-generate-count-input" type="number" min="1" max="10"[^>]*value="3"/);
    assert.match(homeSource, /window\.tkGenerateSearchVideos\(query, count\)/);
    assert.match(homeSource, /window\.tkGenerateSearchVideos\s*=\s*async function\(query = '', requestedCount = 3\)/);
    assert.match(homeSource, /const targetCount = Math\.min\(10, Math\.max\(1, Number\.parseInt\(requestedCount, 10\) \|\| 3\)\)/);
    assert.match(homeSource, /Expected \$\{targetCount\} videos but received \$\{normalizedVideos\.length\}/);
    assert.match(tiktokCssSource, /\.tk-search-generate-count\s*\{/);
});

test('Char profile generation requests ten top-level comments and fullscreen covers keep scene bubbles', () => {
    assert.match(profileSource, /Every video in posts and likedVideos must contain at least 10 top-level comments/);
    assert.match(homeSource, /const visualUrl = video\.cover \|\| video\.bgImage \|\| video\.imageUrl \|\| ''/);
    assert.match(homeSource, /const fsBubbleFlowHtml = tkCreateBubbleFlowHtml\(video, \{/);
    assert.doesNotMatch(homeSource, /if \(video\.cover\) \{[\s\S]{0,300}textBubble\.style\.display = 'none'/);
});

test('TikTok DMs persist translated-bubble expansion and activity summaries no longer open sheets', () => {
    assert.match(chatSource, /msg\.translationExpanded \? 'block' : 'none'/);
    assert.match(chatSource, /msg\.translationExpanded = !msg\.translationExpanded/);
    assert.match(chatSource, /if \(window\.tkPersistState\) window\.tkPersistState\(\);/);
    assert.doesNotMatch(chatSource, /tkDmEnsureActivitySheet|tkDmOpenActivityDetail|tk-activity-detail-sheet/);
    const activityMarkup = indexSource.slice(indexSource.indexOf('id="tk-activity-list"'), indexSource.indexOf('id="tk-chat-dms-container"'));
    assert.doesNotMatch(activityMarkup, /fa-chevron-right arrow/);
    assert.match(indexSource, /js\/tiktok\/3_home\.js\?v=20260712-tiktok-feed-cleanup-v1/);
    assert.match(indexSource, /css\/tiktok\.css\?v=20260721-mobile-input-layout-v1/);
});

test('TikTok home feed advances one adjacent video per wheel or vertical swipe', () => {
    assert.match(homeSource, /function tkPageHomeFeed\(direction\)/);
    assert.match(homeSource, /const nextIndex = Math\.min\(cards\.length - 1, Math\.max\(0, currentIndex \+ direction\)\)/);
    assert.match(homeSource, /feedContainer\.addEventListener\('wheel',[\s\S]*event\.preventDefault\(\)[\s\S]*tkPageHomeFeed\(event\.deltaY > 0 \? 1 : -1\)/);
    assert.match(homeSource, /feedContainer\.addEventListener\('touchend',[\s\S]*tkPageHomeFeed\(deltaY < 0 \? 1 : -1\)/);
    assert.match(tiktokCssSource, /\.tk-video-card\s*\{[\s\S]*scroll-snap-stop:\s*always/);
    assert.match(tiktokCssSource, /\.tk-feed-container\s*\{[\s\S]*touch-action:\s*pan-x/);
});

test('TikTok no longer ships unreachable legacy generation or comment-user modal code', () => {
    assert.doesNotMatch(homeSource, /async function generateVideos\(|tkOpenCommentUserModal|currentCommentModal/);
    assert.doesNotMatch(tiktokCoreSource, /tk-comment-user-modal/);
    assert.doesNotMatch(indexSource, /tk-comment-user-modal|tk-comment-modal-home-btn/);
    assert.doesNotMatch(homeSource, /TK_HOME_INITIAL_RENDER_COUNT|TK_HOME_LOAD_STEP|tkHomeVisibleLimit|tkHomeRenderKey|tkHomeHasMoreVideos|tkHomeIsAppending|tkResetHomeFeedLimit/);
});
