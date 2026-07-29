import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [mobileInputSource, bstageSource, lovesSource, globalCssSource, bstageCssSource, indexSource] = await Promise.all([
    fs.readFile(new URL('../js/mobile_input_compat.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/bstage.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/loves.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/global.css', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/bstage.css', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

test('shared mobile input helper exposes delegated Android focus scopes', () => {
    assert.match(mobileInputSource, /const focusScopeRegistrations = new Map\(\)/);
    assert.match(mobileInputSource, /function registerFocusScope\(options = \{\}\)/);
    assert.match(mobileInputSource, /registerFocusScope,/);
    assert.match(mobileInputSource, /target\.closest\(registration\.selector\)/);
    assert.match(mobileInputSource, /bottomSheetExcludedInputTypes = new Set\(\['file', 'hidden', 'checkbox', 'radio', 'range', 'color'\]\)/);
    assert.match(mobileInputSource, /target\.isContentEditable/);
});

test('focus scopes cancel native page panning and only resize after a real keyboard shrink', () => {
    assert.match(mobileInputSource, /scrollTop: Math\.round\(window\.scrollY/);
    assert.match(mobileInputSource, /window\.scrollTo\(scope\.scrollLeft, scope\.scrollTop\)/);
    assert.match(mobileInputSource, /\[0, 60, 180, 360\]\.forEach/);
    assert.match(mobileInputSource, /const layoutAlreadyResized = scope\.restingLayoutHeight - layoutHeight > 100/);
    assert.match(mobileInputSource, /const keyboardOpen = focused && scope\.restingHeight - viewportHeight > 100/);
    assert.match(mobileInputSource, /scope\.root\.style\.height = `\$\{viewportHeight\}px`/);
    assert.match(mobileInputSource, /scope\.root\.style\.top = `\$\{viewportTop\}px`/);
    assert.match(mobileInputSource, /root\.style\.height = originalRoot\.height/);
    assert.match(mobileInputSource, /scheduleFocusScopeRelease\(\)/);
});

test('b.stage registers all app, chat, modal, and sheet input surfaces', () => {
    assert.match(bstageSource, /registerFocusScope\?\.\(\{/);
    assert.match(bstageSource, /#bstage-view, #bstage-chat-view, #bstage-fan-chat-view/);
    assert.match(bstageSource, /\.bottom-sheet-overlay\[id\^="bstage-"\]/);
    assert.match(bstageSource, /root\.id === 'bstage-chat-view'/);
    assert.match(bstageSource, /root\.id === 'bstage-fan-chat-view'/);
    assert.match(bstageSource, /root\.id === 'bstage-video-detail-modal'/);
    assert.match(bstageCssSource, /#bstage-chat-view\.u2-android-keyboard-open \.bstage-chat-input-area/);
});

test('Loves registers main, sub-app, dynamic, and bottom-sheet input surfaces', () => {
    assert.match(lovesSource, /bindAndroidInputFocusScope\(\)/);
    assert.match(lovesSource, /#loves-view, #lovers-space-view, #lovers-savings-view/);
    assert.match(lovesSource, /#lovers-friend-phone-view, #lovers-friend-computer-view/);
    assert.match(lovesSource, /\.bottom-sheet-overlay\[id\^="lovers-"\]/);
    assert.match(lovesSource, /\.bottom-sheet-overlay\[id\^="friend-"\]/);
});

test('shared locked-state CSS and browser cache busts are present', () => {
    assert.match(globalCssSource, /\.u2-android-focus-locked\s*\{[\s\S]*position:\s*fixed\s*!important/);
    assert.match(globalCssSource, /\.u2-android-focus-locked\.u2-android-keyboard-open\s*\{[\s\S]*bottom:\s*auto\s*!important/);
    assert.match(indexSource, /mobile_input_compat\.js\?v=[^"']*android-focus-scope-v1/);
    assert.match(indexSource, /bstage\.js\?v=[^"']*android-keyboard-actions-v2/);
    assert.match(indexSource, /loves\.js\?v=[^"']*android-focus-scope-v1/);
});
