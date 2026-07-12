import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [indexSource, desktopSource, panelSource, settingsSource] = await Promise.all([
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/home_desktop.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/home_widget_panel_enhance.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/settings.js', import.meta.url), 'utf8')
]);

const expectedMusicText = ['oode...', 'u2phone', 'sonokoiomoiiyo', 'The rain of destiny'];

test('API configuration no longer exposes the stream response toggle', () => {
    assert.doesNotMatch(indexSource, /stream-response-toggle/);
    assert.doesNotMatch(indexSource, /流式传输/);
});

test('music widget defaults and templates use the requested text', () => {
    expectedMusicText.forEach((text) => {
        assert.match(indexSource, new RegExp(text.replaceAll('.', '\\.')));
        assert.match(desktopSource, new RegExp(text.replaceAll('.', '\\.')));
        assert.match(panelSource, new RegExp(text.replaceAll('.', '\\.')));
    });
});

test('legacy built-in music text is migrated while arbitrary custom text is not listed', () => {
    assert.match(desktopSource, /function migrateLegacyMusicText\(config\)/);
    assert.match(desktopSource, /musicTitle: new Set\(\['happytwogether'\]\)/);
    assert.match(desktopSource, /config\.text\[key\] = DEFAULT_WIDGET_TEXT\[key\]/);
    assert.match(desktopSource, /desktopStateNeedsSave = true/);
    assert.doesNotMatch(desktopSource, /new Set\(\['custom song'\]\)/);
});

test('settings UI refreshes the background toggle after storage hydration', () => {
    assert.match(settingsSource, /u2:background-activity-settings-changed/);
    assert.match(settingsSource, /syncBackgroundActivityControls/);
});

