import test from 'node:test';
import assert from 'node:assert/strict';

import {
    detectPlatform,
    extractPageData,
    handleRequest,
    isPrivateOrReservedIp,
    validateTargetUrl
} from '../src/index.mjs';

test('detects supported platforms and generic pages', () => {
    assert.equal(detectPlatform('https://www.xiaohongshu.com/explore/1').id, 'xiaohongshu');
    assert.equal(detectPlatform('https://v.douyin.com/example').id, 'douyin');
    assert.equal(detectPlatform('https://b23.tv/example').id, 'bilibili');
    assert.equal(detectPlatform('https://weibo.com/123/abc').id, 'weibo');
    assert.equal(detectPlatform('https://example.com/post').id, 'web');
});

test('blocks dangerous protocols, credentials, ports, and private destinations', () => {
    assert.throws(() => validateTargetUrl('file:///etc/passwd'), /http\/https/);
    assert.throws(() => validateTargetUrl('https://user:pass@example.com'), /凭据/);
    assert.throws(() => validateTargetUrl('http://example.com:8080'), /端口/);
    assert.throws(() => validateTargetUrl('http://127.0.0.1/test'), /私网/);
    assert.throws(() => validateTargetUrl('http://192.168.1.10/test'), /私网/);
    assert.throws(() => validateTargetUrl('http://[::1]/test'), /私网/);
    assert.equal(isPrivateOrReservedIp('8.8.8.8'), false);
    assert.equal(isPrivateOrReservedIp('10.0.0.1'), true);
});

test('extracts JSON-LD, OpenGraph, canonical URL, and media safely', () => {
    const html = `<!doctype html><html><head>
        <title>Fallback title</title>
        <meta property="og:title" content="测试 &amp; 标题">
        <meta property="og:description" content="这是页面摘要">
        <meta property="og:image" content="/cover.jpg">
        <link rel="canonical" href="https://example.com/canonical">
        <script type="application/ld+json">{
            "@type":"Article",
            "author":{"name":"测试作者"},
            "datePublished":"2026-07-05",
            "articleBody":"这是一段足够长的公开页面正文，用于验证角色可以读取页面内容。",
            "image":["/article-1.jpg"]
        }</script>
    </head><body><script>alert(1)</script><main>备用正文</main></body></html>`;
    const result = extractPageData(html, 'https://example.com/post', 'https://example.com/shared');

    assert.equal(result.ok, true);
    assert.equal(result.status, 'resolved');
    assert.equal(result.data.title, '测试 & 标题');
    assert.equal(result.data.author, '测试作者');
    assert.equal(result.data.canonicalUrl, 'https://example.com/canonical');
    assert.match(result.data.bodyText, /角色可以读取/);
    assert.equal(result.data.coverUrl, 'https://example.com/cover.jpg');
    assert.ok(result.data.media.some(item => item.url === 'https://example.com/article-1.jpg'));
    assert.ok(!result.data.bodyText.includes('alert(1)'));
});

test('uses platform embedded text and decodes escaped Chinese', () => {
    const html = `<html><head><meta property="og:title" content="小红书笔记"></head><body>
        <script>window.__INITIAL_STATE__={"desc":"\\u4eca\\u5929\\u53bb\\u4e86\\u6d77\\u8fb9\\uff0c\\u98ce\\u5f88\\u5927\\uff0c\\u4f46\\u662f\\u5915\\u9633\\u5f88\\u7f8e\\u3002"};</script>
    </body></html>`;
    const result = extractPageData(html, 'https://www.xiaohongshu.com/explore/abc');
    assert.equal(result.data.platform, 'xiaohongshu');
    assert.match(result.data.bodyText, /今天去了海边/);
});

test('caps extracted body at 50,000 characters and marks truncation', () => {
    const longBody = '内容'.repeat(30000);
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({ '@type': 'Article', articleBody: longBody })}</script></head><body></body></html>`;
    const result = extractPageData(html, 'https://example.com/long');
    assert.equal(result.data.bodyText.length, 50000);
    assert.equal(result.data.truncated, true);
    assert.ok(result.warnings.includes('BODY_TRUNCATED'));
});

test('health endpoint enforces configured CORS allowlist', async () => {
    const allowedRequest = new Request('https://worker.example/health', {
        headers: { Origin: 'https://app.example' }
    });
    const allowedResponse = await handleRequest(allowedRequest, { ALLOWED_ORIGINS: 'https://app.example' });
    assert.equal(allowedResponse.status, 200);
    assert.equal(allowedResponse.headers.get('access-control-allow-origin'), 'https://app.example');

    const deniedRequest = new Request('https://worker.example/health', {
        headers: { Origin: 'https://evil.example' }
    });
    const deniedResponse = await handleRequest(deniedRequest, { ALLOWED_ORIGINS: 'https://app.example' });
    assert.equal(deniedResponse.status, 403);
});
