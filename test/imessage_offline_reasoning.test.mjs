import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const reasoning = require('../js/imessage/offline_reasoning.js');

test('parses thinking and think tags into a separate reasoning field', () => {
    assert.deepEqual(
        reasoning.normalizeResponse('<thinking>规划 A</thinking>正文 A', ''),
        {
            content: '正文 A',
            reasoning: '规划 A',
            reasoningSource: 'tagged',
            foundTag: true,
            incomplete: false,
            pendingTag: ''
        }
    );
    const shortTag = reasoning.normalizeResponse('<think>规划 B</think>正文 B', '');
    assert.equal(shortTag.content, '正文 B');
    assert.equal(shortTag.reasoning, '规划 B');
});

test('auto-parses fixed reasoning and analysis tags with case and whitespace variants', () => {
    const reasoningTag = reasoning.normalizeResponse('< REASONING >plan R</ REASONING >final R', '');
    assert.equal(reasoningTag.reasoning, 'plan R');
    assert.equal(reasoningTag.content, 'final R');

    const analysisTag = reasoning.normalizeResponse('<Analysis>plan A</Analysis>final A', '');
    assert.equal(analysisTag.reasoning, 'plan A');
    assert.equal(analysisTag.content, 'final A');

    const multiple = reasoning.normalizeResponse('<think>one</think><analysis>two</analysis>final', '');
    assert.equal(multiple.reasoning, 'one\n\ntwo');
    assert.equal(multiple.content, 'final');
});

test('tagged reasoning wins while native reasoning remains a fallback', () => {
    const result = reasoning.normalizeResponse(
        '<thinking>标签思考</thinking>干净正文',
        [{ type: 'reasoning.text', text: '原生思考' }]
    );
    assert.equal(result.content, '干净正文');
    assert.equal(result.reasoning, '标签思考');
    assert.equal(result.reasoningSource, 'tagged');

    const nativeFallback = reasoning.normalizeResponse(
        '<thinking></thinking>干净正文',
        [{ type: 'reasoning.text', text: '原生思考' }]
    );
    assert.equal(nativeFallback.content, '干净正文');
    assert.equal(nativeFallback.reasoning, '原生思考');
    assert.equal(nativeFallback.reasoningSource, 'native');
});

test('malformed reasoning boundaries never leak their reasoning text into final content', () => {
    const missingClose = reasoning.normalizeResponse('<thinking>尚未结束的思考', '');
    assert.equal(missingClose.content, '');
    assert.equal(missingClose.reasoning, '尚未结束的思考');
    assert.equal(missingClose.incomplete, true);

    const missingOpen = reasoning.normalizeResponse('缺失开始标签的思考</think>最终正文', '');
    assert.equal(missingOpen.content, '最终正文');
    assert.equal(missingOpen.reasoning, '缺失开始标签的思考');
});

test('stream parsing holds incomplete tag prefixes instead of flashing them as prose', () => {
    const partial = reasoning.normalizeResponse('<thin', '', { streaming: true });
    assert.equal(partial.content, '');
    assert.equal(partial.reasoning, '');
    assert.equal(partial.pendingTag, '<thin');

    const completed = reasoning.normalizeResponse('<thinking>流式思考</thinking>正文', '');
    assert.equal(completed.reasoning, '流式思考');
    assert.equal(completed.content, '正文');

    const reasoningPartial = reasoning.normalizeResponse('<reas', '', { streaming: true });
    assert.equal(reasoningPartial.content, '');
    assert.equal(reasoningPartial.pendingTag, '<reas');
});

test('plain responses remain plain and do not create an empty reasoning block', () => {
    const result = reasoning.normalizeResponse('只有正文', '');
    assert.equal(result.content, '只有正文');
    assert.equal(result.reasoning, '');
    assert.equal(result.reasoningSource, '');
});

test('provider reasoning aliases use the first populated field without duplication', () => {
    assert.equal(reasoning.readFirstReasoningValue('', 'same thought', 'same thought'), 'same thought');
    assert.equal(reasoning.readReasoningValue([{ text: 'part one' }, { text: 'part two' }]), 'part one\npart two');
});

test('extracts text from structured compatible-API content blocks', () => {
    assert.equal(reasoning.readContentValue('plain'), 'plain');
    assert.equal(reasoning.readContentValue([
        { type: 'text', text: 'part one' },
        { type: 'output_text', output_text: 'part two' }
    ]), 'part onepart two');
    assert.equal(reasoning.readFirstContentValue('', [{ content: 'nested text' }]), 'nested text');
});

test('separates structured reasoning blocks from final content', () => {
    const result = reasoning.extractResponseParts([[
        { type: 'reasoning.text', text: 'step one' },
        { type: 'reasoning.summary', summary: 'summary two' },
        { type: 'text', text: 'final text' }
    ]], []);

    assert.equal(result.content, 'final text');
    assert.equal(result.reasoning, 'step one\nsummary two');
    assert.equal(result.reasoningSource, 'structured');
});

test('ignores encrypted reasoning details and reads OpenRouter native aliases', () => {
    const encryptedOnly = reasoning.extractResponseParts([
        [{ type: 'reasoning.encrypted', data: 'opaque' }, { type: 'text', text: 'answer' }]
    ], [[{ type: 'reasoning.encrypted', data: 'opaque' }]]);
    assert.equal(encryptedOnly.content, 'answer');
    assert.equal(encryptedOnly.reasoning, '');

    const native = reasoning.extractResponseParts(['answer'], [
        '',
        'native reasoning',
        [{ type: 'reasoning.text', text: 'later duplicate' }]
    ]);
    assert.equal(native.reasoning, 'native reasoning');
    assert.equal(native.reasoningSource, 'native');
});

test('tagged reasoning wins over structured or native reasoning without duplication', () => {
    const parts = reasoning.extractResponseParts([
        [{ type: 'reasoning.text', text: 'structured thought' }, { type: 'text', text: '<think>tagged thought</think>answer' }]
    ], ['native thought']);
    const normalized = reasoning.normalizeResponse(parts.content, parts.reasoning);

    assert.equal(normalized.content, 'answer');
    assert.equal(normalized.reasoning, 'tagged thought');
    assert.equal(normalized.reasoningSource, 'tagged');
});

test('normalizes the per-character maximum response token setting', () => {
    assert.equal(reasoning.normalizeMaxResponseTokens(undefined), 30000);
    assert.equal(reasoning.normalizeMaxResponseTokens('invalid'), 30000);
    assert.equal(reasoning.normalizeMaxResponseTokens(''), 30000);
    assert.equal(reasoning.normalizeMaxResponseTokens(100), 256);
    assert.equal(reasoning.normalizeMaxResponseTokens(50000), 32768);
    assert.equal(reasoning.normalizeMaxResponseTokens(4096), 4096);
});

test('maps OpenRouter and unknown compatible proxies to reasoning parameters', () => {
    const openRouter = reasoning.buildReasoningRequestConfig({
        endpoint: 'https://openrouter.ai/api/v1',
        model: 'some-reasoning-model',
        enabled: true,
        maxTokens: 8192
    });
    assert.equal(openRouter.mode, 'openrouter');
    assert.deepEqual(openRouter.parameters, {
        max_tokens: 8192,
        reasoning: { enabled: true, exclude: false }
    });

    const unknownDisabled = reasoning.buildReasoningRequestConfig({
        endpoint: 'https://proxy.example.com',
        model: 'deepseek-reasoner',
        enabled: false
    });
    assert.equal(unknownDisabled.mode, 'openrouter');
    assert.deepEqual(unknownDisabled.parameters.reasoning, { enabled: false, exclude: false });
});

test('maps GLM and Kimi providers to thinking parameters', () => {
    const glm = reasoning.buildReasoningRequestConfig({
        endpoint: 'https://open.bigmodel.cn/api/paas/v4',
        model: 'glm-4.5',
        enabled: true
    });
    assert.equal(glm.mode, 'thinking');
    assert.deepEqual(glm.parameters.thinking, { type: 'enabled' });

    const kimiDisabled = reasoning.buildReasoningRequestConfig({
        endpoint: 'https://api.moonshot.cn/v1',
        model: 'kimi-k2',
        enabled: false
    });
    assert.deepEqual(kimiDisabled.parameters.thinking, { type: 'disabled' });
});

test('keeps native reasoning APIs effort-free and uses OpenAI completion token naming', () => {
    const openAi = reasoning.buildReasoningRequestConfig({
        endpoint: 'https://api.openai.com/v1',
        model: 'o3-mini',
        enabled: true,
        maxTokens: 2048
    });
    assert.equal(openAi.mode, 'native');
    assert.deepEqual(openAi.parameters, { max_completion_tokens: 2048 });
    assert.equal(openAi.hasReasoningParameter, false);

    const deepSeek = reasoning.buildReasoningRequestConfig({
        endpoint: 'https://api.deepseek.com',
        model: 'deepseek-reasoner',
        enabled: true,
        maxTokens: 4096
    });
    assert.equal(deepSeek.mode, 'native');
    assert.deepEqual(deepSeek.parameters, { max_tokens: 4096 });
});
