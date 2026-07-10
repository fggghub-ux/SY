import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [bridgeSource, storageSource, netflixSource, paySource, desktopSource, shoppingSource, indexSource] = await Promise.all([
    fs.readFile(new URL('../js/app_state_bridge.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/storage/app_storage.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/netflix.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/pay.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/home_desktop.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/shopping.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

test('state-backed apps wait for durable storage before using mutable startup defaults', () => {
    assert.match(bridgeSource, /netflix:\s*\{\s*works: \[\]/);
    assert.match(bridgeSource, /netflix: isPlainObject\(safe\.netflix\)/);
    assert.match(storageSource, /netflix:\s*\{\s*works: \[\]/);
    assert.match(storageSource, /netflix: safeState\.netflix/);
    assert.match(netflixSource, /window\.netflixDataReadyPromise\s*=\s*window\.globalDataReadyPromise\.then/);
    assert.match(netflixSource, /refreshFromPersistedState\(\)/);
    assert.match(netflixSource, /if \(!hadNetflixDomain\) \{\s*this\.saveNetflixState\(\);\s*this\.savePresetState\(\);/);
    assert.match(paySource, /window\.payDataReadyPromise\s*=\s*window\.globalDataReadyPromise\.then/);
    assert.match(paySource, /applyPaySnapshot\(getPayStoreSnapshot\(\)\)/);
    assert.match(desktopSource, /window\.desktopDataReadyPromise\s*=\s*window\.globalDataReadyPromise\.then/);
    assert.match(desktopSource, /function refreshDesktopStateAfterHydration\(\)/);
    assert.match(shoppingSource, /window\.shoppingDataReadyPromise\s*=\s*window\.globalDataReadyPromise\.then/);
    assert.match(indexSource, /js\/netflix\.js\?v=20260710-storage-ready-v2/);
    assert.match(indexSource, /js\/pay\.js\?v=20260710-storage-ready-v1/);
    assert.match(indexSource, /js\/shopping\.js\?v=20260710-storage-ready-v1/);
    assert.match(indexSource, /js\/home_desktop\.js\?v=20260710-storage-ready-v1/);
});
