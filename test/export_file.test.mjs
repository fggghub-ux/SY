import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const exporterSource = await fs.readFile(new URL('../js/export_file.js', import.meta.url), 'utf8');

class TestFile extends Blob {
    constructor(parts, name, options = {}) {
        super(parts, options);
        this.name = name;
        this.lastModified = options.lastModified || 0;
    }
}

function createElement(tagName) {
    const listeners = new Map();
    return {
        tagName: tagName.toUpperCase(),
        id: '',
        style: {},
        children: [],
        removed: false,
        append(...children) { this.children.push(...children); },
        appendChild(child) { this.children.push(child); return child; },
        addEventListener(type, listener) { listeners.set(type, listener); },
        dispatch(type, event = {}) { return listeners.get(type)?.({ target: this, ...event }); },
        click() { return this.dispatch('click'); },
        remove() { this.removed = true; }
    };
}

function loadExporter({ navigator, standalone = false, documentOverrides = {}, urlOverrides = {}, setTimeout } = {}) {
    const appended = [];
    const document = {
        createElement,
        getElementById: () => null,
        body: {
            appendChild(element) { appended.push(element); return element; }
        },
        ...documentOverrides
    };
    const window = {
        navigator: navigator || {},
        Blob,
        File: TestFile,
        URL: {
            createObjectURL: () => 'blob:test-export',
            revokeObjectURL: () => {},
            ...urlOverrides
        },
        matchMedia: () => ({ matches: standalone }),
        setTimeout: setTimeout || globalThis.setTimeout,
        document,
        console
    };
    const context = vm.createContext({ window, document, console, Blob, Promise });
    vm.runInContext(exporterSource, context);
    return { window, document, appended };
}

test('iOS standalone exports through system file sharing without creating a blob navigation', async () => {
    let sharedPayload;
    const { window, appended } = loadExporter({
        standalone: true,
        navigator: {
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
            standalone: true,
            userActivation: { isActive: true },
            canShare: ({ files }) => files.length === 1,
            share: async (payload) => { sharedPayload = payload; }
        },
        urlOverrides: {
            createObjectURL: () => { throw new Error('blob download must not run'); }
        }
    });

    const result = await window.u2ExportFile({
        blob: new Blob(['{}'], { type: 'application/json' }),
        fileName: 'theme.json',
        title: 'U2 Theme'
    });

    assert.equal(result, 'shared');
    assert.equal(sharedPayload.title, 'U2 Theme');
    assert.equal(sharedPayload.files[0].name, 'theme.json');
    assert.equal(appended.length, 0);
});

test('cancelling iOS system share does not fall back to browser download', async () => {
    let createdObjectUrl = false;
    const { window } = loadExporter({
        standalone: true,
        navigator: {
            userAgent: 'iPhone',
            standalone: true,
            userActivation: { isActive: true },
            canShare: () => true,
            share: async () => { throw new DOMException('cancelled', 'AbortError'); }
        },
        urlOverrides: {
            createObjectURL: () => { createdObjectUrl = true; return 'blob:unexpected'; }
        }
    });

    const result = await window.u2ExportFile({ blob: new Blob(['x']), fileName: 'cancel.json' });
    assert.equal(result, 'cancelled');
    assert.equal(createdObjectUrl, false);
});

test('iOS standalone shows a fresh-tap prompt when user activation expired', async () => {
    let shareCalls = 0;
    const { window, appended } = loadExporter({
        standalone: true,
        navigator: {
            userAgent: 'iPhone',
            standalone: true,
            userActivation: { isActive: false },
            canShare: () => true,
            share: async () => { shareCalls += 1; }
        }
    });

    const pending = window.u2ExportFile({ blob: new Blob(['backup']), fileName: 'backup.json' });
    await Promise.resolve();
    assert.equal(shareCalls, 0);
    assert.equal(appended[0].id, 'u2-export-ready-overlay');

    const shareButton = appended[0].children[0].children[2];
    await shareButton.click();
    assert.equal(await pending, 'shared');
    assert.equal(shareCalls, 1);
});

test('regular browsers retain direct download and delay object URL revocation', async () => {
    const delays = [];
    const revoked = [];
    const { window, appended } = loadExporter({
        navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0)' },
        urlOverrides: {
            createObjectURL: () => 'blob:desktop-download',
            revokeObjectURL: (url) => revoked.push(url)
        },
        setTimeout: (callback, delay) => {
            delays.push(delay);
            callback();
        }
    });

    const result = await window.u2ExportFile({ blob: new Blob(['desktop']), fileName: 'desktop.json' });
    assert.equal(result, 'downloaded');
    assert.equal(appended[0].download, 'desktop.json');
    assert.equal(appended[0].href, 'blob:desktop-download');
    assert.deepEqual(delays, [5000]);
    assert.deepEqual(revoked, ['blob:desktop-download']);
});

test('all JSON export entry points use the shared exporter loaded before consumers', async () => {
    const [html, settingsSource, chatSheetSource] = await Promise.all([
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/settings.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_sheet.js', import.meta.url), 'utf8')
    ]);

    assert.match(html, /export_file\.js\?v=20260718-ios-pwa-export-v1[\s\S]*4_chat_sheet\.js\?v=20260718-offline-cot-v1[\s\S]*settings\.js\?v=20260718-ios-pwa-export-v1/);
    assert.equal((settingsSource.match(/window\.u2ExportFile\(/g) || []).length, 2);
    assert.equal((chatSheetSource.match(/window\.u2ExportFile\(/g) || []).length, 2);
    assert.doesNotMatch(settingsSource, /URL\.createObjectURL/);
    assert.doesNotMatch(chatSheetSource, /URL\.createObjectURL/);
});
