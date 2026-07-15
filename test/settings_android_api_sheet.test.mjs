import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [settingsSource, settingsCssSource, globalCssSource, imessageCssSource, mobileInputSource, indexSource] = await Promise.all([
    fs.readFile(new URL('../js/settings.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/settings.css', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/global.css', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/imessage.css', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/mobile_input_compat.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

function getFunctionBody(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `Expected to find ${name}`);
    const paramsEnd = source.indexOf(')', start);
    assert.notEqual(paramsEnd, -1, `Expected to find ${name} params`);
    const bodyStart = source.indexOf('{', paramsEnd);
    assert.notEqual(bodyStart, -1, `Expected to find ${name} body`);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        const char = source[index];
        if (char === '{') depth += 1;
        if (char === '}') depth -= 1;
        if (depth === 0) return source.slice(bodyStart + 1, index);
    }
    assert.fail(`Expected to close ${name} body`);
}

function getCssRule(source, selector) {
    const start = source.indexOf(selector);
    assert.notEqual(start, -1, `Expected to find CSS selector ${selector}`);
    const bodyStart = source.indexOf('{', start);
    assert.notEqual(bodyStart, -1, `Expected to find CSS body for ${selector}`);
    const bodyEnd = source.indexOf('}', bodyStart);
    assert.notEqual(bodyEnd, -1, `Expected to close CSS body for ${selector}`);
    return source.slice(bodyStart + 1, bodyEnd);
}

test('shared Android bottom-sheet lock CSS keeps default sheets unchanged', () => {
    const globalBottomSheetRule = getCssRule(globalCssSource, '.bottom-sheet-overlay');
    assert.match(globalBottomSheetRule, /position:\s*absolute/);
    assert.doesNotMatch(globalBottomSheetRule, /position:\s*fixed/);

    const lockedRule = getCssRule(globalCssSource, '.bottom-sheet-overlay.u2-android-input-locked');
    assert.match(lockedRule, /position:\s*fixed/);
    assert.match(lockedRule, /inset:\s*0/);
    assert.match(lockedRule, /overflow-x:\s*hidden/);
    assert.match(lockedRule, /touch-action:\s*none/);
    assert.match(globalCssSource, /\.bottom-sheet-overlay\.u2-android-input-locked \.bottom-sheet\s*\{[\s\S]*max-width:\s*100%/);
    assert.match(globalCssSource, /\.bottom-sheet-overlay\.u2-android-input-locked :is\(input, textarea, select\)\s*\{[\s\S]*min-width:\s*0/);

    assert.doesNotMatch(settingsCssSource, /#api-config-sheet\s*\{[\s\S]*position:\s*fixed/);
    assert.doesNotMatch(settingsCssSource, /#api-config-sheet \.form-item input/);
});

test('shared Android bottom-sheet guard locks and restores home page horizontal scroll', () => {
    assert.match(mobileInputSource, /const isAndroid = \/Android\/i\.test/);
    assert.match(mobileInputSource, /const bottomSheetFocusGuard = \{/);
    assert.match(mobileInputSource, /function getPagesContainer\(\)/);
    assert.match(mobileInputSource, /document\.getElementById\('pages-container'\)/);

    const lockBody = getFunctionBody(mobileInputSource, 'lockBottomSheetFocusScroll');
    assert.match(lockBody, /bottomSheetFocusGuard\.scrollLeft = pagesContainer \? pagesContainer\.scrollLeft : 0/);
    assert.match(lockBody, /pagesContainer\.style\.scrollSnapType = 'none'/);
    assert.match(lockBody, /pagesContainer\.style\.overflowX = 'hidden'/);
    assert.match(lockBody, /pagesContainer\.style\.touchAction = 'none'/);
    assert.match(lockBody, /overlay\.classList\.add\('u2-android-input-locked'\)/);

    const restoreBody = getFunctionBody(mobileInputSource, 'restoreBottomSheetFocusPosition');
    assert.match(restoreBody, /pagesContainer\.scrollTo\(\{ left: bottomSheetFocusGuard\.scrollLeft, behavior: 'auto' \}\)/);
    assert.match(restoreBody, /pagesContainer\.scrollLeft = bottomSheetFocusGuard\.scrollLeft/);
    assert.match(restoreBody, /resetHorizontalWindowScroll\(\)/);

    const unlockBody = getFunctionBody(mobileInputSource, 'unlockBottomSheetFocusScroll');
    assert.match(unlockBody, /pagesContainer\.style\.overflowX = bottomSheetFocusGuard\.previousOverflowX/);
    assert.match(unlockBody, /pagesContainer\.style\.touchAction = bottomSheetFocusGuard\.previousTouchAction/);
    assert.match(unlockBody, /classList\.remove\('u2-android-input-locked'\)/);
});

test('shared Android guard is driven by bottom-sheet focus, viewport, and selection events', () => {
    assert.match(mobileInputSource, /bottomSheetExcludedInputTypes = new Set\(\['file', 'hidden', 'checkbox', 'radio', 'range', 'color'\]\)/);
    assert.match(mobileInputSource, /function isBottomSheetEditableTarget\(/);
    assert.match(mobileInputSource, /function getActiveBottomSheetOverlay\(/);
    assert.match(mobileInputSource, /\.bottom-sheet-overlay\.active/);
    assert.match(mobileInputSource, /document\.addEventListener\('focusin'/);
    assert.match(mobileInputSource, /document\.addEventListener\('pointerdown'/);
    assert.match(mobileInputSource, /document\.addEventListener\('touchstart'/);
    assert.match(mobileInputSource, /document\.addEventListener\('focusout'/);
    assert.match(mobileInputSource, /document\.addEventListener\('selectionchange'/);
    assert.match(mobileInputSource, /window\.visualViewport\.addEventListener\('resize', handleBottomSheetViewportChange/);
    assert.match(mobileInputSource, /window\.visualViewport\.addEventListener\('scroll', handleBottomSheetViewportChange/);
});

test('API config sheet now relies on the shared bottom-sheet input guard', () => {
    const openBody = getFunctionBody(settingsSource, 'openApiConfigSheet');
    assert.match(openBody, /openView\(UI\.overlays\.apiConfig\)/);
    assert.doesNotMatch(openBody, /lockApiConfigHomeScroll|scheduleApiConfigHomeScrollRestore/);

    const closeBody = getFunctionBody(settingsSource, 'closeApiConfigSheet');
    assert.match(closeBody, /closeView\(UI\.overlays\.apiConfig\)/);
    assert.doesNotMatch(closeBody, /unlockApiConfigHomeScroll/);

    assert.match(settingsSource, /openApiConfigSheet\(\)/);
    assert.match(settingsSource, /closeApiConfigSheet\(\)/);
    assert.doesNotMatch(settingsSource, /apiConfigHomeScrollLock/);
    assert.doesNotMatch(settingsSource, /lockApiConfigHomeScroll/);
    assert.doesNotMatch(settingsSource, /scheduleApiConfigHomeScrollRestore/);
    assert.doesNotMatch(settingsSource, /handleApiConfigViewportChange/);
});

test('iMessage Chat CSS hydrates from the IndexedDB settings domain and confirms persistence', () => {
    const startupEnd = settingsSource.indexOf('// Expose globally');
    const startupSource = settingsSource.slice(0, startupEnd);
    assert.match(startupSource, /document\.addEventListener\('DOMContentLoaded', async \(\) =>/);
    assert.match(startupSource, /await window\.appStorage\?\.ready/);
    assert.match(startupSource, /window\.appStorage\.readDomain\('settings', \{\}\)/);
    assert.match(startupSource, /const savedThemeState = savedSettings\.themeState/);
    assert.match(startupSource, /applySavedTheme\(\)/);
    assert.doesNotMatch(startupSource, /StorageManager\.load/);

    const persistBody = getFunctionBody(settingsSource, 'persistSettingsData');
    assert.match(persistBody, /appStorage\.commitDomain\('settings'/);
    assert.match(persistBody, /\.\.\.draft/);
    assert.match(persistBody, /themeState: clonePlainData\(themeState\)/);

    const currentApplySource = settingsSource.slice(
        settingsSource.indexOf('async function applyCurrentThemeCss'),
        settingsSource.indexOf('if (themeConfigBtn', settingsSource.indexOf('async function applyCurrentThemeCss'))
    );
    assert.match(currentApplySource, /const persisted = await saveGlobalData\(\)/);
    assert.match(currentApplySource, /Chat CSS 保存失败，当前效果未持久化/);

    const clearChatSource = settingsSource.slice(
        settingsSource.indexOf('if (themeChatClearBtn)'),
        settingsSource.indexOf('// Clear Status CSS', settingsSource.indexOf('if (themeChatClearBtn)'))
    );
    assert.match(clearChatSource, /addEventListener\('click', async \(\) =>/);
    assert.match(clearChatSource, /const persisted = await saveGlobalData\(\)/);
});

test('chat settings persist per-friend CSS and durable theme presets', () => {
    assert.match(settingsSource, /imessageCssPresets:\s*\{\s*bubble:\s*\[\],\s*chat:\s*\[\],\s*status:\s*\[\]/);
    assert.match(settingsSource, /async function savePresets\(type, presets\)/);
    assert.match(settingsSource, /return saveGlobalData\(\)/);
    assert.match(settingsSource, /u2_theme_\$\{type\}Presets/);
    assert.match(settingsSource, /document\.dispatchEvent\(new CustomEvent\('u2-theme-state-ready'\)\)/);
    assert.match(settingsSource, /currentOption\.textContent = '当前已应用的自定义主题'/);

    const chatSettingsApply = settingsSource.slice(
        settingsSource.indexOf("if (chatThemeApplyBtn)"),
        settingsSource.indexOf('// Theme Background', settingsSource.indexOf("if (chatThemeApplyBtn)"))
    );
    assert.match(chatSettingsApply, /targetFriend\.chatCss = nextChatCss/);
    assert.match(chatSettingsApply, /targetFriend\.chatCssEnabled = !!nextChatCss/);
    assert.doesNotMatch(chatSettingsApply, /themeState\.imessageChatCss = nextChatCss/);
});

test('Char edit sheet is hardened against Android input focus overflow', () => {
    assert.match(imessageCssSource, /#edit-char-persona-sheet \.char-settings-sheet\s*\{[\s\S]*overflow:\s*hidden/);
    assert.match(imessageCssSource, /#edit-char-persona-sheet \.char-settings-content\s*\{[\s\S]*overflow-x:\s*hidden[\s\S]*-webkit-overflow-scrolling:\s*touch/);
    assert.match(imessageCssSource, /#edit-char-persona-sheet \.form-item label\s*\{[\s\S]*max-width:\s*48%[\s\S]*text-overflow:\s*ellipsis/);
    assert.match(imessageCssSource, /#edit-char-persona-sheet \.form-item input,\s*\n#edit-char-persona-sheet \.global-textarea\s*\{[\s\S]*min-width:\s*0/);
});

test('changed Android input assets are cache-busted', () => {
    assert.match(indexSource, /css\/global\.css\?v=20260714-assistive-ball-image-v1/);
    assert.match(indexSource, /css\/imessage\.css\?v=20260714-offline-global-theme-v8/);
    assert.match(indexSource, /css\/settings\.css\?v=20260715-font-upload-v1/);
    assert.match(indexSource, /js\/mobile_input_compat\.js\?v=20260713-bstage-enter-v1/);
    assert.match(indexSource, /js\/settings\.js\?v=20260715-font-upload-v1/);
    assert.match(indexSource, /id="storage-clean-cache-btn"[^>]*>优化存储<\/button>/);
    assert.match(settingsSource, /appStorage\.optimizeStorage\(\{ progressCallback: updateOperation \}\)/);
});
