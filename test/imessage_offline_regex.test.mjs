import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const regex = require('../js/imessage/offline_regex.js');

const rule = (overrides = {}) => regex.normalizeRule({
    id: 'rule-1',
    scriptName: '测试',
    findRegex: '/foo/g',
    replaceString: 'bar',
    placement: ['user', 'assistant'],
    minDepth: null,
    maxDepth: null,
    revision: 1,
    ...overrides
});

test('支持包裹/普通表达式、flags、捕获组和 {{match}}', () => {
    assert.equal(regex.applyRules('FOO foo', {
        rules: [rule({ findRegex: '/foo/gi', replaceString: 'x', markdownOnly: true })],
        role: 'user', depth: 0, channel: 'display'
    }), 'x x');

    assert.equal(regex.applyRules('abc-123 abc-456', {
        rules: [rule({ findRegex: '(abc)-(\\d+)', replaceString: '$2:$1:{{match}}', markdownOnly: true })],
        role: 'user', depth: 0, channel: 'display'
    }), '123:abc:abc-123 abc-456');
});

test('规则按顺序执行，并按作用范围和含端点深度过滤', () => {
    const rules = [
        rule({ id: 'a', findRegex: '/foo/g', replaceString: 'bar', markdownOnly: true, minDepth: 1, maxDepth: 2 }),
        rule({ id: 'b', findRegex: '/bar/g', replaceString: 'done', markdownOnly: true, placement: ['assistant'] })
    ];
    assert.equal(regex.applyRules('foo', { rules, role: 'assistant', depth: 1, channel: 'display' }), 'done');
    assert.equal(regex.applyRules('foo', { rules, role: 'assistant', depth: 2, channel: 'display' }), 'done');
    assert.equal(regex.applyRules('foo', { rules, role: 'assistant', depth: 0, channel: 'display' }), 'foo');
    assert.equal(regex.applyRules('foo', { rules, role: 'user', depth: 1, channel: 'display' }), 'bar');
});

test('四种格式组合分别作用于存储、显示和提示词', () => {
    const base = { findRegex: '/foo/g', replaceString: 'bar' };
    const storage = rule({ ...base });
    const display = rule({ ...base, markdownOnly: true });
    const prompt = rule({ ...base, promptOnly: true });
    const both = rule({ ...base, markdownOnly: true, promptOnly: true });

    assert.equal(regex.applyRules('foo', { rules: [storage], role: 'user', depth: 0, channel: 'storage' }), 'bar');
    assert.equal(regex.applyRules('foo', { rules: [display], role: 'user', depth: 0, channel: 'display' }), 'bar');
    assert.equal(regex.applyRules('foo', { rules: [prompt], role: 'user', depth: 0, channel: 'prompt' }), 'bar');
    assert.equal(regex.applyRules('foo', { rules: [both], role: 'user', depth: 0, channel: 'display' }), 'bar');
    assert.equal(regex.applyRules('foo', { rules: [both], role: 'user', depth: 0, channel: 'prompt' }), 'bar');
    assert.equal(regex.applyRules('foo', { rules: [both], role: 'user', depth: 0, channel: 'storage' }), 'foo');
});

test('存储规则记录版本，避免重复执行，并在规则修订后再次执行', () => {
    const messages = [{ id: 'm1', role: 'user', content: 'a', timestamp: 1 }];
    const v1 = rule({ findRegex: '/a/g', replaceString: 'aa', revision: 1 });
    const once = regex.applyStorageRules(messages, [v1]);
    assert.equal(once[0].content, 'aa');
    assert.equal(once[0].offlineRegexAppliedRevisions['rule-1'], 1);
    assert.equal(regex.applyStorageRules(once, [v1])[0].content, 'aa');

    const v2 = rule({ findRegex: '/a/g', replaceString: 'aa', revision: 2 });
    const twice = regex.applyStorageRules(once, [v2]);
    assert.equal(twice[0].content, 'aaaa');
    assert.equal(twice[0].offlineRegexAppliedRevisions['rule-1'], 2);
});

test('最新消息深度为 0，系统消息不参与存储处理，非法规则会跳过', () => {
    const messages = [
        { id: 'm1', role: 'user', content: 'foo' },
        { id: 's1', role: 'system', content: 'foo' },
        { id: 'm2', role: 'assistant', content: 'foo' }
    ];
    const onlyLatest = rule({ minDepth: 0, maxDepth: 0 });
    const applied = regex.applyStorageRules(messages, [onlyLatest]);
    assert.equal(applied[0].content, 'foo');
    assert.equal(applied[1].content, 'foo');
    assert.equal(applied[2].content, 'bar');

    const invalid = rule({ findRegex: '/[/' , markdownOnly: true });
    assert.ok(regex.compileRule(invalid).error);
    assert.equal(regex.applyRules('foo', { rules: [invalid], role: 'user', depth: 0, channel: 'display' }), 'foo');
});

test('新规则默认双作用范围、启用、无限深度且两个格式开关关闭', () => {
    const created = regex.createRule();
    assert.deepEqual(created.placement, ['user', 'assistant']);
    assert.equal(created.disabled, false);
    assert.equal(created.markdownOnly, false);
    assert.equal(created.promptOnly, false);
    assert.equal(created.minDepth, null);
    assert.equal(created.maxDepth, null);
});
