import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [html, css, source, modalSource] = await Promise.all([
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/settings.css', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/settings.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/about_info_modal.js', import.meta.url), 'utf8')
]);

function getFunctionBody(input, name) {
    const start = input.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `Expected ${name}`);
    const bodyStart = input.indexOf('{', input.indexOf(')', start));
    let depth = 0;
    for (let index = bodyStart; index < input.length; index += 1) {
        if (input[index] === '{') depth += 1;
        if (input[index] === '}') depth -= 1;
        if (depth === 0) return input.slice(bodyStart + 1, index);
    }
    assert.fail(`Expected ${name} to close`);
}

test('About Device exposes disclaimer, changelog, and close actions', () => {
    const disclaimerAt = html.indexOf('id="about-device-disclaimer-btn"');
    const changelogAt = html.indexOf('id="about-device-changelog-btn"');
    const closeAt = html.indexOf('id="about-device-close-btn"');
    assert.ok(disclaimerAt > 0 && disclaimerAt < changelogAt && changelogAt < closeAt);
    assert.match(html, /id="about-info-modal"[^>]*hidden[^>]*aria-hidden="true"/);
    assert.match(html, /role="dialog" aria-modal="true" aria-labelledby="about-info-modal-title"/);
});

test('disclaimer contains author identity and required usage notices', () => {
    ['iisonyoung', '49713923588', '年满 18 周岁', 'AI 生成内容', '自行保管密钥', '自行备份重要数据', '禁止二次上传', '二传', '倒卖', '下载链接或访问链接', '改包分发', '镜像传播'].forEach((text) => {
        assert.match(html, new RegExp(text));
    });
});

test('reusable About modal switches isolated content and restores focus', () => {
    const openBody = getFunctionBody(modalSource, 'open');
    assert.match(openBody, /mode === 'changelog'/);
    assert.match(openBody, /disclaimerContent\.hidden = showChangelog/);
    assert.match(openBody, /changelogContent\.hidden = !showChangelog/);
    assert.match(openBody, /closeButton\?\.focus\(\)/);
    assert.match(html, /id="about-changelog-content"[^>]*hidden/);
    assert.match(html, /暂无更新日志/);

    const closeBody = getFunctionBody(modalSource, 'close');
    assert.match(closeBody, /returnFocus\.focus\(\)/);
    assert.match(closeBody, /previousBodyOverflow/);
});

test('About modal closes from its controls, backdrop, and Escape key', () => {
    assert.match(modalSource, /closeButton\?\.addEventListener\('click', close\)/);
    assert.match(modalSource, /confirmButton\?\.addEventListener\('click', close\)/);
    assert.match(modalSource, /event\.target === modal/);
    assert.match(modalSource, /event\.key === 'Escape'/);
});

test('About modal is centered, scrollable, and constrained by safe areas', () => {
    assert.match(css, /\.about-info-modal-overlay\s*\{[\s\S]*align-items: center;[\s\S]*justify-content: center;[\s\S]*var\(--safe-top\)[\s\S]*var\(--safe-bottom\)/);
    assert.match(css, /\.about-info-modal-card\s*\{[\s\S]*max-height: min\(76vh, 640px\)/);
    assert.match(css, /\.about-info-modal-body\s*\{[^}]*overflow-y: auto/);
    assert.match(css, /@media \(max-width: 480px\)[\s\S]*calc\(100% - var\(--safe-top\) - var\(--safe-bottom\) - 24px\)/);
});
