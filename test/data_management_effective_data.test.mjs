import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [indexSource, settingsSource, storageSource] = await Promise.all([
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/settings.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/storage/app_storage.js', import.meta.url), 'utf8')
]);

test('data management shows only logical application data', () => {
    assert.doesNotMatch(indexSource, /id="storage-health-usage"/);
    assert.doesNotMatch(settingsSource, /站点总占用/);
    assert.doesNotMatch(settingsSource, /health\.ratio >= 0\.8/);
    assert.match(settingsSource, /health\.breakdown\?\.logicalGroups/);
    assert.match(storageSource, /const logicalGroups = cloneDeep\(groups\)/);
    assert.match(storageSource, /logicalGroups,/);
    assert.match(indexSource, /js\/settings\.js\?v=20260710-imessage-theme-idb-v1/);
});
