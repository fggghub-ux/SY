import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('add friend sheet imports TXT and DOCX into persona and nickname fields', async () => {
    const [html, contactsSource] = await Promise.all([
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/3_contacts.js', import.meta.url), 'utf8')
    ]);

    assert.match(html, /id="friend-profile-import-btn"/);
    assert.match(html, /id="friend-profile-import-input"[^>]*accept="[^"]*\.txt[^"]*\.docx/);
    assert.match(contactsSource, /async function readFriendProfileFile\(file\)/);
    assert.match(contactsSource, /lowerName\.endsWith\('\.doc'\)[\s\S]*?暂不支持旧版 DOC/);
    assert.match(contactsSource, /window\.mammoth\.extractRawText\(\{ arrayBuffer: await file\.arrayBuffer\(\) \}\)/);
    assert.match(contactsSource, /if \(personaInput\) personaInput\.value = importedPersona/);
    assert.match(contactsSource, /if \(nicknameInput && fileBaseName\) nicknameInput\.value = fileBaseName/);
    assert.match(contactsSource, /角色设定已导入，请确认后添加/);
});

test('desktop theme transfers only versioned home background and app icons', async () => {
    const [html, settingsSource] = await Promise.all([
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/settings.js', import.meta.url), 'utf8')
    ]);

    assert.match(html, /id="theme-export-btn"/);
    assert.match(html, /id="theme-import-btn"/);
    assert.match(html, /id="theme-import-file-input"[^>]*accept="\.json,application\/json"/);
    assert.match(settingsSource, /const HOME_THEME_PACKAGE_FORMAT = 'u2-home-theme'/);
    assert.match(settingsSource, /const HOME_THEME_PACKAGE_VERSION = 1/);
    assert.match(settingsSource, /function buildHomeThemePackage\(\)[\s\S]*?background: themeState\.bgUrl \?\? null[\s\S]*?apps: themeState\.apps\.map/);
    assert.match(settingsSource, /function parseHomeThemePackage\(rawText\)/);
    assert.match(settingsSource, /const importedApps = new Map\(\)/);
    assert.match(settingsSource, /if \(importedTheme\.apps\.has\(String\(app\.id\)\)\)/);
    assert.match(settingsSource, /applyThemeBackground\(themeState\);[\s\S]*?applyThemeAppIcons\(themeState\);[\s\S]*?renderThemeAppList\(\);[\s\S]*?saveGlobalData\(\)/);

    const packageBuilder = settingsSource.slice(
        settingsSource.indexOf('function buildHomeThemePackage()'),
        settingsSource.indexOf('function parseHomeThemePackage(rawText)')
    );
    assert.doesNotMatch(packageBuilder, /font|imessageCss|customCss/i);
});
