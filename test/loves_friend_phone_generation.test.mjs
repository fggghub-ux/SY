import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

globalThis.window = {};
globalThis.document = {
    addEventListener() {}
};

await import('../js/loves.js');

test('friend phone generation counts use defaults and clamp saved values', () => {
    const app = window.lovesApp;
    assert.deepEqual(app.getFriendPhoneGenCounts({}), {
        imessageMain: 5,
        imessageAlt: 5,
        musicTop: 3,
        safariTotal: 10,
        gameTotal: 2,
        callTotal: 5,
        weiboPostsTotal: 10,
        weiboPhotosTotal: 6
    });

    assert.deepEqual(app.getFriendPhoneGenCounts({
        phoneGenCounts: {
            imessageMain: 99,
            imessageAlt: 0,
            musicTop: 50,
            safariTotal: '11',
            gameTotal: 20,
            callTotal: 0,
            weiboPostsTotal: '7',
            weiboPhotosTotal: 'invalid'
        }
    }), {
        imessageMain: 10,
        imessageAlt: 2,
        musicTop: 10,
        safariTotal: 11,
        gameTotal: 5,
        callTotal: 1,
        weiboPostsTotal: 7,
        weiboPhotosTotal: 6
    });
});

test('odd totals favor the public or main account', () => {
    assert.deepEqual(window.lovesApp.splitFriendGenTotal(10), { primary: 5, secondary: 5 });
    assert.deepEqual(window.lovesApp.splitFriendGenTotal(11), { primary: 6, secondary: 5 });
});

test('weibo normalization preserves configured-size collections and caps comments', () => {
    const posts = Array.from({ length: 7 }, (_, index) => ({
        text: `post ${index}`,
        comments: Array.from({ length: 8 }, (_item, commentIndex) => `comment ${commentIndex}`)
    }));
    const album = Array.from({ length: 4 }, (_, index) => ({ description: `photo ${index}` }));
    const normalized = window.lovesApp.normalizeWeiboAccount({ posts, album, liked: posts }, { id: 'friend-1' });

    assert.equal(normalized.posts.length, 7);
    assert.equal(normalized.album.length, 4);
    assert.equal(normalized.posts[0].comments.length, 5);
    assert.equal(normalized.liked.length, 3);
});

test('generation controls are inline and prompts use configurable counts', async () => {
    const [html, source] = await Promise.all([
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/loves.js', import.meta.url), 'utf8')
    ]);

    assert.match(html, /class="friend-gen-section"/);
    assert.match(html, /id="friend-gen-imessage-main-count"[^>]*value="5"/);
    assert.match(html, /id="friend-gen-imessage-alt-count"[^>]*value="5"/);
    assert.match(html, /id="friend-gen-music-top-count"[^>]*value="3"/);
    assert.match(html, /id="friend-gen-safari-count"[^>]*value="10"/);
    assert.match(html, /id="friend-gen-game-count"[^>]*value="2"/);
    assert.match(html, /id="friend-gen-call-count"[^>]*value="5"/);
    assert.match(html, /id="friend-gen-weibo-post-count"[^>]*value="10"/);
    assert.match(html, /id="friend-gen-weibo-photo-count"[^>]*value="6"/);
    assert.doesNotMatch(html, /id="friend-phone-gen-modal"/);
    assert.doesNotMatch(html, /id="friend-phone-gen-settings-btn"/);
    assert.doesNotMatch(html, /id="friend-phone-clear-all-data-btn"/);
    assert.doesNotMatch(html, /friend-settings-section-label/);
    assert.doesNotMatch(html, /friend-gen-apps/);
    assert.equal((html.match(/class="gen-app-checkbox"/g) || []).length, 9);
    ['imessage', 'music', 'health', 'pay', 'game', 'call', 'safari', 'weibo', 'files'].forEach(app => {
        assert.equal((html.match(new RegExp(`data-gen-app="${app}"`, 'g')) || []).length, 1);
    });

    const weiboIcon = html.match(/id="friend-phone-app-weibo"[\s\S]*?<div style="([^"]+)"/i)?.[1] || '';
    assert.equal(weiboIcon.includes('box-shadow'), false);

    assert.match(source, /严格生成 \$\{genCounts\.imessageMain\} 个/);
    assert.match(source, /按对方、Char、对方、Char 的顺序生成 4 条消息/);
    assert.match(source, /①【备忘录】/);
    assert.match(source, /②【文件传输助手】/);
    assert.match(source, /sourceChats\.find\(chat => chat\?\.contactName === '备忘录'\)/);
    assert.match(source, /top\.slice\(0, genCounts\.musicTop\)/);
    assert.match(source, /recentGames\.slice\(0, genCounts\.gameTotal\)/);
    assert.match(source, /recentCalls\.slice\(0, genCounts\.callTotal\)/);
    assert.match(source, /严格生成 \$\{safariSplit\.primary\} 条公开模式/);
    assert.match(source, /严格生成 \$\{weiboPostSplit\.primary\} 条主页帖子/);
    assert.match(source, /每条主页帖子必须生成 2-5 条自然评论/);
    assert.match(source, /禁止套用固定开头、固定剧情、编号化文案/);
    assert.match(source, /"stepsThoughts"/);
    assert.match(source, /"dream"/);
    assert.match(source, /"heartRate"/);
    assert.match(source, /实时心率/);
    assert.match(source, /const syncGenRows = \(\) =>/);
    assert.match(source, /input\.disabled = !cb\.checked/);
    assert.match(source, /row\.classList\.toggle\('is-disabled', !cb\.checked\)/);
});
