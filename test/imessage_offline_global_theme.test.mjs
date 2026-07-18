import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readWorkspaceFile = (path) => readFile(new URL(path, root), 'utf8');

test('offline theme helpers normalize global state, presets, and scoped CSS', async () => {
    const coreSource = await readWorkspaceFile('js/imessage/2_core.js');
    const helperStart = coreSource.indexOf('window.imApp.scopeUserCss = function');
    const helperEnd = coreSource.indexOf('window.imApp.applyGlobalChatCss');
    assert.ok(helperStart >= 0 && helperEnd > helperStart);

    const context = { window: { imApp: {} } };
    vm.runInNewContext(coreSource.slice(helperStart, helperEnd), context);
    const { imApp } = context.window;

    assert.deepEqual(
        JSON.parse(JSON.stringify(imApp.normalizeOfflineThemeState({
            narrativeColor: '#abcdef',
            dialogueColor: 'invalid',
            customCss: '.offline-tavern-content { color: red; }',
            customCssEnabled: true,
            activePresetId: 'preset-1'
        }))),
        {
            narrativeColor: '#ABCDEF',
            dialogueColor: '#8B8B8B',
            customCss: '.offline-tavern-content { color: red; }',
            customCssEnabled: true,
            activePresetId: 'preset-1'
        }
    );
    assert.equal(imApp.normalizeOfflineThemeState({ customCss: ':scope { color: red; }', customCssEnabled: false }).customCssEnabled, true);
    assert.equal(imApp.normalizeOfflineThemeState({ customCss: '' }).customCssEnabled, false);

    const presets = imApp.normalizeOfflineThemePresets([
        { id: 'one', name: '夜间', narrativeColor: '#ffffff', dialogueColor: '#cccccc', customCss: ':scope { background:#000; }' },
        { id: 'two', name: '夜间', customCss: 'duplicate' }
    ]);
    assert.equal(presets.length, 1);
    assert.equal(presets[0].narrativeColor, '#FFFFFF');

    const scoped = imApp.scopeUserCss(':scope { color:red; } .offline-tavern-content { color:blue; }', ':is(#offline-tavern-view, #offline-tavern-barrage-view)');
    assert.match(scoped, /:is\(#offline-tavern-view, #offline-tavern-barrage-view\)\s*\{/);
    assert.match(scoped, /:is\(#offline-tavern-view, #offline-tavern-barrage-view\) \.offline-tavern-content/);
    assert.doesNotMatch(scoped, /offline-settings-view/);
});

test('offline theme state persists globally and migrates legacy colors once', async () => {
    const [coreSource, sheetSource] = await Promise.all([
        readWorkspaceFile('js/imessage/2_core.js'),
        readWorkspaceFile('js/imessage/4_chat_sheet.js')
    ]);

    assert.match(coreSource, /offlineTheme:\s*window\.imApp\.normalizeOfflineThemeState\(window\.imData\.offlineTheme\)/);
    assert.match(coreSource, /offlineThemePresets:\s*window\.imApp\.normalizeOfflineThemePresets\(window\.imData\.offlineThemePresets\)/);
    assert.match(coreSource, /window\.imData\.offlineThemeInitialized = !!globalUiState\.hasOfflineTheme/);
    assert.match(sheetSource, /legacyFriend\?\.offlineTheme \|\| OFFLINE_THEME_DEFAULTS/);
    assert.match(sheetSource, /styleTag\.id = 'offline-tavern-custom-theme-style'/);
    assert.match(sheetSource, /OFFLINE_THEME_SCOPE = ':is\(#offline-tavern-view, #offline-tavern-barrage-view\)'/);
    assert.doesNotMatch(sheetSource, /targetFriend\.offlineTheme\s*=/);
});

test('offline theme editor exposes source, presets, immediate apply, and full reset', async () => {
    const [sheetSource, cssSource, indexSource] = await Promise.all([
        readWorkspaceFile('js/imessage/4_chat_sheet.js'),
        readWorkspaceFile('css/imessage.css'),
        readWorkspaceFile('index.html')
    ]);

    for (const text of ['选择主题', '导入主题', '导出主题', '清空 CSS', '复制源码', '应用 CSS', '存为主题预设', '恢复默认主题']) {
        assert.match(sheetSource, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.doesNotMatch(sheetSource, /启用自定义 CSS/);
    assert.match(sheetSource, /presetSelect\.addEventListener\('change',[\s\S]*persistOfflineTheme/);
    assert.match(sheetSource, /preset\.name\.toLocaleLowerCase\(\) === name\.toLocaleLowerCase\(\)/);
    assert.match(sheetSource, /navigator\.clipboard\?\.writeText/);
    assert.match(sheetSource, /type: 'u2-offline-theme'/);
    assert.match(sheetSource, /importPresetInput\.accept = '\.json,application\/json'/);
    assert.match(sheetSource, /已导入并应用主题/);

    const copiedSourceMatch = sheetSource.match(/const OFFLINE_THEME_SOURCE_TEMPLATE = `([\s\S]*?)`\.replaceAll\('offline-tavern', 'offline-chat'\)/);
    assert.ok(copiedSourceMatch);
    const copiedSource = copiedSourceMatch[1].replaceAll('offline-tavern', 'offline-chat');
    for (const selector of [
        ':scope',
        '.offline-chat-header',
        '.offline-chat-bubble',
        '.offline-chat-thinking',
        '.offline-chat-thinking-toggle',
        '.offline-chat-thinking-label',
        '.offline-chat-thinking-icon',
        '.offline-chat-thinking-content',
        '.offline-chat-history-card',
        '.offline-chat-barrage-row',
        '.offline-chat-choice-btn',
        '.offline-chat-action-btn',
        '.offline-chat-input-area'
    ]) {
        assert.ok(copiedSource.includes(selector), `missing copied source selector: ${selector}`);
    }
    const runtimeThinkingClasses = Array.from(new Set(
        sheetSource.match(/\boffline-tavern-thinking(?:-[a-z0-9-]+)?\b/g) || []
    ));
    for (const runtimeClass of runtimeThinkingClasses) {
        const copiedClass = runtimeClass.replace('offline-tavern', 'offline-chat');
        assert.ok(copiedSource.includes(`.${copiedClass}`), `missing copied thinking selector: .${copiedClass}`);
    }
    assert.match(copiedSource, /\.offline-chat-thinking\.is-expanded \.offline-chat-thinking-icon/);
    assert.match(copiedSource, /\.offline-chat-thinking-content\[hidden\]/);
    assert.doesNotMatch(copiedSource, /tavern/i);

    assert.match(cssSource, /\.offline-theme-css-input\s*\{/);
    assert.match(cssSource, /\.offline-theme-preset-select\s*\{/);
    assert.match(cssSource, /\.offline-theme-preset-icon\s*\{/);
    assert.match(cssSource, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(cssSource, /\.offline-theme-button-row button\.primary\s*\{[\s\S]*?grid-column:\s*1 \/ -1/);
    assert.match(sheetSource, /replaceAll\('offline-tavern', 'offline-chat'\)/);
    assert.match(sheetSource, /replaceAll\('offline-chat', 'offline-tavern'\)/);
    assert.match(indexSource, /css\/imessage\.css\?v=20260716-status-prompt-v3/);
    assert.match(indexSource, /js\/imessage\/2_core\.js\?v=20260716-offline-token-v1/);
    assert.match(indexSource, /js\/imessage\/4_chat_sheet\.js\?v=20260718-ios-pwa-export-v1/);
});
