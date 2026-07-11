import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const xappSource = await fs.readFile(new URL('../js/xapp.js', import.meta.url), 'utf8');

function getFunctionBody(name) {
    const start = xappSource.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `Expected to find ${name}`);
    const paramsEnd = xappSource.indexOf(')', start);
    assert.notEqual(paramsEnd, -1, `Expected to find ${name} params`);
    const bodyStart = xappSource.indexOf('{', paramsEnd);
    assert.notEqual(bodyStart, -1, `Expected to find ${name} body`);
    let depth = 0;
    for (let index = bodyStart; index < xappSource.length; index += 1) {
        const char = xappSource[index];
        if (char === '{') depth += 1;
        if (char === '}') depth -= 1;
        if (depth === 0) return xappSource.slice(bodyStart + 1, index);
    }
    assert.fail(`Expected to close ${name} body`);
}

test('X app open path avoids synchronous state save and eager tab rendering', () => {
    const openBody = getFunctionBody('openXApp');
    assert.equal(openBody.includes('saveXState(getXState())'), false);
    assert.match(openBody, /view\.classList\.add\('active'\)/);
    assert.match(openBody, /ensureXEventBindings\(\)/);
    assert.match(openBody, /switchTab\(currentIndex, \{ state, resetHomeFeed: true \}\)/);

    const tail = xappSource.slice(xappSource.indexOf("appButton.addEventListener('click', openXApp)"));
    assert.doesNotMatch(tail, /renderProfile\(\);\s*renderWorldBookSummary\(\);\s*renderSuperFollowBar\(\);\s*renderGeneratedPosts\(\);\s*renderTrends\(\);\s*renderDirectMessages\(\);/);
    assert.doesNotMatch(tail, /requestAnimationFrame\(\(\) => switchTab\(0\)\)/);
});

test('X app has one-time chrome/event guards and paged home feed rendering', () => {
    assert.match(xappSource, /let xChromeInitialized = false;/);
    assert.match(xappSource, /let xEventsInitialized = false;/);
    assert.match(xappSource, /function ensureXEventBindings\(\)/);
    assert.match(xappSource, /if \(xEventsInitialized\) return;/);
    assert.match(xappSource, /if \(xChromeInitialized\) return;/);

    assert.match(xappSource, /const xHomeFeedInitialLimit = 20;/);
    assert.match(xappSource, /function renderGeneratedPosts\(state = getXState\(\), options = \{\}\)/);
    assert.match(xappSource, /\.slice\(0, xHomeFeedRenderLimit\)/);
    assert.match(xappSource, /function loadMoreHomeFeedPosts\(\)/);
    assert.match(xappSource, /function renderVisibleXTab\(index = currentIndex, state = getXState\(\), options = \{\}\)/);
});

test('X external random image sources use grayscale rendering', () => {
    const externalImageBody = getFunctionBody('getStableExternalImage');
    assert.match(externalImageBody, /picsum\.photos\/seed\/\$\{safeSeed\}\/\$\{width\}\/\$\{height\}\?grayscale/);
    const unsplashAvatars = xappSource.match(/https:\/\/images\.unsplash\.com\/[^']+/g) || [];
    assert.equal(unsplashAvatars.length, 8);
    assert.ok(unsplashAvatars.every((url) => url.includes('sat=-100')));
});

test('X iMessage imports do not copy single-chat messages into X DMs', () => {
    const stripBody = getFunctionBody('stripImessageCharMessagesForXImport');
    assert.match(stripBody, /messages:\s*\[\]/);

    const addDmBody = getFunctionBody('addDirectMessageChar');
    assert.match(addDmBody, /stripImessageCharMessagesForXImport\(charItem\)/);
    assert.doesNotMatch(xappSource, /normalizeDmChar\((friend|char), 'imessage'\)/);
});

test('X user post publishing triggers background engagement generation and immediate flush', () => {
    const submitBody = getFunctionBody('submitComposer');
    assert.match(submitBody, /appendGeneratedPosts\(\[rawPost\]\)/);
    assert.match(submitBody, /commentsCount:\s*0/);
    assert.match(submitBody, /comments:\s*\[\]/);
    assert.doesNotMatch(submitBody, /@xapp/);
    assert.match(submitBody, /flushXStateNow\('x-post-publish'\)/);
    assert.match(submitBody, /generatePostPublishInteractions\(added\[0\]\.id\)/);

    const publishBody = getFunctionBody('generatePostPublishInteractions');
    assert.match(publishBody, /includePrivateMessages:\s*true/);
    assert.match(publishBody, /minCommentItems:\s*10/);
    assert.match(publishBody, /minPrivateMessages:\s*2/);
    assert.match(publishBody, /flushXStateNow\('x-post-publish-interactions'\)/);
});

test('X post settings can advance a post without private-message generation', () => {
    const settingsBody = getFunctionBody('setupPostSettingsSheet');
    assert.match(settingsBody, /id="x-post-advance-btn"/);
    assert.match(xappSource, /getElementById\('x-post-advance-btn'\)\?\.addEventListener\('click', advanceCurrentPostComments\)/);

    const advanceBody = getFunctionBody('advanceCurrentPostComments');
    assert.match(advanceBody, /includePrivateMessages:\s*false/);
    assert.match(advanceBody, /minCommentItems:\s*10/);
    assert.match(advanceBody, /showToast\('Generating post engagement\.\.\.'\)/);
    assert.match(advanceBody, /buttonLabel\.textContent = 'Generating\.\.\.'/);
    assert.match(advanceBody, /setAttribute\('aria-busy', 'true'\)/);
    assert.match(advanceBody, /flushXStateNow\('x-post-advance-comments'\)/);
});

test('X post engagement prompt mounts worldbook, user persona, comment and DM minimums', () => {
    assert.match(xappSource, /function requestPostInteractionBatch\(postId, options = \{\}\)/);
    assert.match(xappSource, /comments plus nested replies combined MUST contain at least 10 generated comment objects/);
    assert.match(xappSource, /privateMessages MUST contain at least 2 new stranger private-message conversations/);
    assert.match(xappSource, /Each privateMessages\[\]\.messages MUST contain 2 to 5 incoming message objects/);
    assert.match(xappSource, /User profile\/persona:/);
    assert.match(xappSource, /Worldbook:/);
});

test('X high-value writes flush durable app state', () => {
    const flushBody = getFunctionBody('flushXStateNow');
    assert.match(flushBody, /window\.saveGlobalData\(\)/);

    const closeBody = getFunctionBody('closeXApp');
    assert.match(closeBody, /flushXStateNow\('x-close'\)/);
});

test('X post deletion clears every post source and restores state when persistence fails', () => {
    const deleteBody = getFunctionBody('deleteXPost');
    assert.match(deleteBody, /draft\.xGeneratedPosts[\s\S]*?\.filter/);
    assert.match(deleteBody, /draft\.xDirectMessages[\s\S]*?profilePosts[\s\S]*?\.filter/);
    assert.match(deleteBody, /delete draft\.xPostThreads\[String\(postId\)\]/);
    assert.match(deleteBody, /delete postData\[postId\]/);
    assert.match(deleteBody, /await flushXStateNow\('x-post-delete'\)/);
    assert.match(deleteBody, /saveXState\(previousState\)/);
    assert.match(deleteBody, /帖子删除未保存，请重试/);

    const targetBody = getFunctionBody('deleteTargetPost');
    assert.match(targetBody, /void deleteXPost\(postId\)/);
});
