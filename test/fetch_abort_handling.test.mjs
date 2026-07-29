import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bootstrapSource = fs.readFileSync(path.join(root, 'js/bootstrap_globals.js'), 'utf8');
const aiSource = fs.readFileSync(path.join(root, 'js/imessage/4_chat_ai.js'), 'utf8');

function loadBootstrap(fetchImpl) {
    const overlays = [];
    const sandbox = {
        console,
        Headers,
        Request,
        fetch: fetchImpl,
        setTimeout: callback => {
            callback();
            return 1;
        },
        document: {
            getElementById: () => null,
            createElement: () => ({
                classList: { add() {} },
                getBoundingClientRect() {},
                remove() {}
            }),
            body: { appendChild: overlay => overlays.push(overlay) }
        }
    };
    sandbox.window = sandbox;
    vm.runInNewContext(bootstrapSource, sandbox);
    return { sandbox, overlays };
}

test('global fetch interceptor does not report an aborted request as CORS', async () => {
    const abortError = new DOMException('This operation was aborted', 'AbortError');
    const { sandbox, overlays } = loadBootstrap(async () => { throw abortError; });

    await assert.rejects(sandbox.fetch('https://example.test/v1/chat/completions'), error => error.name === 'AbortError');
    assert.equal(overlays.length, 0);
});

test('global fetch interceptor still reports a real network fetch failure', async () => {
    const { sandbox, overlays } = loadBootstrap(async () => { throw new TypeError('Failed to fetch'); });

    await assert.rejects(sandbox.fetch('https://example.test/v1/chat/completions'), TypeError);
    assert.equal(overlays.length, 1);
});

function loadChatCompletionFetcher(fetchImpl) {
    const start = aiSource.indexOf('async function fetchChatCompletionWithTimeout');
    const end = aiSource.indexOf('\n    function getRegenerateRequestApiConfig', start);
    assert.ok(start >= 0 && end > start);

    const sandbox = {
        console,
        AbortController,
        Error,
        JSON,
        fetch: fetchImpl,
        setTimeout,
        clearTimeout
    };
    vm.runInNewContext(aiSource.slice(start, end), sandbox);
    return sandbox.fetchChatCompletionWithTimeout;
}

function rejectWhenAborted(_endpoint, options) {
    return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
            reject(new DOMException('This operation was aborted', 'AbortError'));
        }, { once: true });
    });
}

test('iMessage converts its own request deadline into TimeoutError', async () => {
    const fetchWithTimeout = loadChatCompletionFetcher(rejectWhenAborted);

    await assert.rejects(
        fetchWithTimeout('https://example.test', { apiKey: 'key', model: 'model' }, [], 5),
        error => error.name === 'TimeoutError'
    );
});

test('iMessage preserves an external cancellation as AbortError', async () => {
    const fetchWithTimeout = loadChatCompletionFetcher(rejectWhenAborted);
    const controller = new AbortController();
    const request = fetchWithTimeout('https://example.test', { apiKey: 'key', model: 'model' }, [], 1000, controller);
    controller.abort();

    await assert.rejects(request, error => error.name === 'AbortError');
});

test('iMessage catch path distinguishes timeout from a cancelled conversation', () => {
    assert.match(aiSource, /const isTimeout = error\?\.name === 'TimeoutError'/);
    assert.match(aiSource, /requestController\.signal\.aborted && !isTimeout/);
    assert.match(aiSource, /API 请求超时（60 秒）/);
});
