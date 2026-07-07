import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const xappSource = await fs.readFile(new URL('../js/xapp.js', import.meta.url), 'utf8');

function getFunctionBody(name) {
    const start = xappSource.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `Expected to find ${name}`);
    const bodyStart = xappSource.indexOf('{', start);
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
