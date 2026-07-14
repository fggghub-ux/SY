import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [settingsSource, storageSource, pageSource, globalCss] = await Promise.all([
    fs.readFile(new URL('../js/settings.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/storage/app_storage.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/global.css', import.meta.url), 'utf8')
]);

test('assistive ball settings persist a PNG image URL', () => {
    assert.match(settingsSource, /imageUrl:\s*''/);
    assert.match(storageSource, /imageUrl:\s*typeof safe\.assistiveBallSettings\.imageUrl === 'string'/);
    assert.match(storageSource, /data:image\\\/png;base64,/);
});

test('assistive ball accepts image URLs and compresses PNG uploads without losing alpha', () => {
    assert.match(settingsSource, /function normalizeAssistiveBallImageUrl\(value\)/);
    assert.match(settingsSource, /parsed\.protocol === 'http:' \|\| parsed\.protocol === 'https:'/);
    assert.match(settingsSource, /maxWidth:\s*256/);
    assert.match(settingsSource, /maxHeight:\s*256/);
    assert.match(settingsSource, /outputType:\s*'image\/png'/);
    assert.match(pageSource, /accept="image\/png,\.png"/);
});

test('assistive ball renders the uploaded image without clipping its shape', () => {
    assert.match(settingsSource, /classList\.add\('has-custom-image'\)/);
    assert.match(globalCss, /\.assistive-api-ball\.has-custom-image \{[\s\S]*background: transparent;/);
    assert.match(globalCss, /\.assistive-api-ball-image \{[\s\S]*object-fit: contain;[\s\S]*opacity: var\(--assistive-ball-opacity\);/);
});
