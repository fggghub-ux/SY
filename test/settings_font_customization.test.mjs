import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [html, css, source] = await Promise.all([
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/settings.css', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/settings.js', import.meta.url), 'utf8')
]);

test('font settings use one semantic entry button and a bottom sheet', () => {
    assert.match(html, /<button class="settings-item theme-font-entry-btn" id="theme-font-btn" type="button">/);
    const themeEntryAt = html.indexOf('id="theme-config-btn"');
    const fontEntryAt = html.indexOf('id="theme-font-btn"');
    const widgetEntryAt = html.indexOf('id="home-widget-config-btn"');
    assert.ok(themeEntryAt < fontEntryAt && fontEntryAt < widgetEntryAt);
    assert.equal(html.match(/id="theme-font-btn"/g)?.length, 1);
    assert.doesNotMatch(html, /theme-font-current-label|当前字体：默认|theme-font-group-body/);
    assert.match(html, /id="theme-font-modal" aria-hidden="true"/);
    assert.match(html, /role="dialog" aria-modal="true" aria-labelledby="theme-font-modal-title"/);
    assert.match(css, /\.theme-font-modal-overlay\s*\{[\s\S]*align-items: flex-end;/);
    assert.match(css, /\.theme-font-modal-card\s*\{[\s\S]*transform: translateY\(100%\);/);
});

test('font picker supports local files and link sources with one add action', () => {
    assert.match(html, /data-font-source="local">本地上传</);
    assert.match(html, /data-font-source="link">字体链接</);
    assert.match(html, /id="theme-font-file-input" accept="\.ttf,\.otf,\.woff,\.woff2,font\/ttf,font\/otf,font\/woff,font\/woff2"/);
    assert.match(html, /id="theme-font-add-btn"[^>]*>添加并应用<\/button>/);
    assert.match(source, /const THEME_FONT_MAX_FILE_SIZE = 20 \* 1024 \* 1024;/);
    assert.match(source, /const THEME_FONT_WARNING_FILE_SIZE = 5 \* 1024 \* 1024;/);
    assert.match(source, /new Set\(\['ttf', 'otf', 'woff', 'woff2'\]\)/);
});

test('local fonts persist as assets and are validated before activation', () => {
    assert.match(source, /fontSourceType: 'preset'/);
    assert.match(source, /fontAssetId: ''/);
    assert.match(source, /fontFormat: ''/);
    assert.match(source, /window\.appStorage\.saveAssetFromDataUrl\(newAssetId, dataUrl/);
    assert.match(source, /window\.appStorage\.getAssetUrl\(definition\.fontAssetId\)/);
    assert.match(source, /window\.appStorage\.deleteAsset\(preset\.fontAssetId\)/);
    assert.match(source, /const fontFace = new FontFace\(definition\.cssName, sourceDescriptor/);
    assert.match(source, /await fontFace\.load\(\);/);
    assert.match(source, /await loadThemeFontDefinition\(nextPreset\);[\s\S]*themeState\.savedFontPresets/);
    assert.match(source, /createThemeFontInternalName\(presetId\)/);
});

test('global font covers body overlays while preserving icons and code editors', () => {
    assert.match(source, /body :where\(\*:not\(i\):not\(\.fa\)/);
    assert.doesNotMatch(source, /#app :where\(\*\)/);
    assert.match(source, /body :where\(i, \.fa, \.fas/);
    assert.match(source, /"Font Awesome 6 Free", "Font Awesome 6 Brands" !important/);
    assert.match(source, /textarea\[placeholder\*="CSS"\][\s\S]*ui-monospace/);
});

test('font assets are stored without browser-side compression or glyph trimming', () => {
    assert.doesNotMatch(source, /fonttools|subset|compressThemeFont|convertToWoff2/i);
    assert.match(html, /推荐使用体积更小的 WOFF2/);
    assert.match(source, /文件较大，建议优先使用 WOFF2/);
});
