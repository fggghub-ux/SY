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
    const [html, source, css] = await Promise.all([
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/loves.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../css/loves.css', import.meta.url), 'utf8')
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
    assert.match(html, /id="friend-phone-chat-context-toggle"[^>]*checked/);
    assert.match(html, /id="friend-phone-real-time-toggle"[^>]*checked/);
    assert.match(html, /向 AI 注入当前日期、星期与准确时间/);
    assert.match(html, /固定带入与该 Char 最近 20 条真实单聊消息/);
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
    assert.match(source, /一轮允许连续生成 2-5 条自然气泡/);
    assert.match(source, /已有 iMessage 会话正文，供二次生成续写/);
    assert.match(source, /【二次生成语义去重清单】/);
    assert.match(source, /不得原句重复、同义改写、换语言复述或先总结再重复/);
    assert.match(source, /buildFriendPhoneImessageContinuationContext\(friend, 20\)/);
    assert.match(source, /getRecentSingleChatMessages\(messageFriend\?\.messages, 20\)/);
    assert.match(source, /requireRange\(chat\?\.messages, 2, 5, `iMessage 主号会话/);
    assert.match(source, /①【备忘录】/);
    assert.match(source, /②【文件传输助手】/);
    assert.match(source, /sourceChats\.find\(chat => fixedNameOf\(chat\) === '备忘录'\)/);
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
    assert.match(source, /所有 AI 创作的可读字符串原文必须只使用 Char 的默认语言/);
    assert.match(source, /真实生成时间始终由前端写入/);
    assert.match(source, /friend\.phoneIncludeRealTime = realTimeToggle\.checked/);
    assert.match(source, /if \(includeRealTime\) prompt \+= `\\n【当前真实时间】/);
    assert.match(source, /mergeFriendPhoneGeneratedData/);
    assert.match(source, /friend-phone-bubble-translatable/);
    assert.doesNotMatch(source, /document\.getElementById\('friend-imsg-user-name'\)\.textContent/);
    assert.match(source, /await this\.ensureFriendPhoneMessagesLoaded\(friend\)[\s\S]*?this\.renderFriendImsg\(messageFriend\);[\s\S]*?window\.openView\(imsgView\)/);
    assert.match(html, /使用真实时间/);
    assert.match(html, /id="friend-phone-real-time-toggle"/);
    assert.match(css, /\.reverse-bubble-left\s*\{[\s\S]*?padding:\s*7px 11px;[\s\S]*?border-radius:\s*18px;/);
    assert.match(css, /\.reverse-bubble-left\s*\{[\s\S]*?background:\s*#111;[\s\S]*?color:\s*#fff;/);
    assert.match(css, /\.reverse-bubble-right\s*\{[\s\S]*?padding:\s*7px 11px;[\s\S]*?border-radius:\s*18px;/);
    assert.doesNotMatch(css, /border-bottom-(?:left|right)-radius:\s*4px/);
    assert.match(css, /#reverse-chat-messages\s*\{[\s\S]*?gap:\s*6px !important/);
    assert.match(css, /--friend-settings-bg:\s*#f2eef0/);
    assert.match(css, /friend-gen-check input:checked \+ span\s*\{[\s\S]*?background:\s*#a77d90/);
});

test('pinned User chat mirrors the canonical latest ten message contexts', () => {
    const app = window.lovesApp;
    const canonical = Array.from({ length: 12 }, (_, index) => ({
        role: index % 2 ? 'assistant' : 'user',
        content: `context-${index + 1}`,
        timestamp: index + 1
    }));
    window.imData = { messages: { friend: [{ sender: 'me', text: 'legacy-only' }] } };
    const selected = app.getFriendPhoneUserContextMessages({ id: 'friend', messages: canonical }, 10);

    assert.equal(selected.length, 10);
    assert.equal(app.getFriendPhoneMessageText(selected[0]), 'context-3');
    assert.equal(app.getFriendPhoneMessageText(selected[9]), 'context-12');
    assert.equal(app.isFriendPhoneUserMessage(selected[0]), true);
    assert.equal(app.isFriendPhoneUserMessage(selected[1]), false);
    assert.equal(app.getFriendPhoneMessageText({ type: 'image' }), '[图片]');
});

test('friend phone hydrates the canonical iMessage friend before rendering User context', async () => {
    const app = window.lovesApp;
    const detachedFriend = { id: 'friend-hydrate', messages: [] };
    const canonicalFriend = { id: 'friend-hydrate', messages: [] };
    window.imData = { friends: [canonicalFriend] };
    let loadedTarget = null;
    window.imApp = {
        ensureFriendMessagesLoaded: async target => {
            loadedTarget = target;
            target.messages = [{ role: 'user', content: 'loaded context', timestamp: 10 }];
        }
    };

    const result = await app.ensureFriendPhoneMessagesLoaded(detachedFriend);
    assert.equal(result, canonicalFriend);
    assert.equal(loadedTarget, canonicalFriend);
    assert.equal(app.getFriendPhoneMessageText(app.getFriendPhoneUserContextMessages(result, 10)[0]), 'loaded context');
});

test('phone generation mounts exactly twenty chat messages and can continue existing iMessage threads', () => {
    const app = window.lovesApp;
    const messages = Array.from({ length: 24 }, (_, index) => ({ text: `single-${index + 1}` }));
    assert.deepEqual(app.getRecentSingleChatMessages(messages, 20).map(item => item.text), messages.slice(4).map(item => item.text));

    const context = app.buildFriendPhoneImessageContinuationContext({
        imessageData: {
            mainAccount: { chats: [{ contactName: 'Alex', messages: [{ sender: 'them', text: '旧问题' }, { sender: 'char', text: '旧回复' }] }] },
            altAccount: { chats: [{ contactName: '备忘录', messages: [{ sender: 'char', text: '旧记录' }] }] }
        }
    }, 8);
    assert.match(context, /\[主账号 \/ Alex\][\s\S]*对方: 旧问题[\s\S]*Char: 旧回复/);
    assert.match(context, /\[小号 \/ 备忘录\][\s\S]*Char: 旧记录/);
});

test('friend phone times hide seconds and show the date only outside today', () => {
    const app = window.lovesApp;
    const now = new Date(2026, 6, 19, 18, 30, 50).getTime();
    assert.equal(app.formatFriendPhoneGeneratedAt(new Date(2026, 6, 19, 9, 5, 44).getTime(), now), '09:05');
    assert.equal(app.formatFriendPhoneGeneratedAt(new Date(2026, 6, 18, 23, 59, 59).getTime(), now), '2026/07/18 23:59');
});

test('second generation receives readable existing content from selected apps for semantic deduplication', () => {
    const context = window.lovesApp.buildFriendPhoneExistingContentContext({
        imessageData: { mainAccount: { chats: [{ contactName: 'Alex', messages: [{ text: '前面说过的话', textTranslationZh: '重复翻译' }] }] } },
        weiboData: { mainAccount: { posts: [{ text: '已经发过的帖子' }] } },
        safariData: { recentSearches: [{ keyword: '未选择应用的内容' }] }
    }, ['imessage', 'weibo']);
    assert.match(context, /前面说过的话/);
    assert.match(context, /已经发过的帖子/);
    assert.doesNotMatch(context, /重复翻译|未选择应用的内容/);
});

test('friend phone generated data is timestamped and prepended without losing history', () => {
    const app = window.lovesApp;
    const friend = {
        id: 'friend-merge',
        language: 'zh',
        musicData: { top: [{ name: '旧歌', generatedAt: 1 }], recent: [], favorites: [] },
        safariData: { recentSearches: [{ keyword: '旧搜索', generatedAt: 1 }], privateSearches: [] },
        healthData: { steps: '1', generatedAt: 1 },
        payData: { totalAssets: '1', recentTransactions: [{ title: '旧交易', generatedAt: 1 }] },
        imessageData: {
            mainAccount: { chats: [{ contactName: 'Alex', messages: [{ sender: 'them', text: '旧消息', generatedAt: 1 }] }] },
            altAccount: { chats: [] }
        },
        filesData: { tags: [{ name: '日记', items: [{ title: '旧文件' }] }] },
        gameData: { recentGames: [{ name: 'Game', matches: [{ result: '失败', generatedAt: 1 }] }] },
        callData: { recentCalls: [{ name: '旧来电', generatedAt: 1 }], contacts: [] }
    };
    const parsed = {
        music: { top: [{ name: '新歌', time: 'AI 假时间', nameTranslationZh: '重复译文' }], recent: [], favorites: [] },
        safari: { recentSearches: [{ keyword: '新搜索' }], privateSearches: [] },
        health: { steps: '2' },
        pay: { totalAssets: '2', recentTransactions: [{ title: '新交易' }] },
        imessage: {
            mainAccount: { chats: [{ contactName: 'Alex', messages: [{ sender: 'char', text: '新消息' }] }] },
            altAccount: { name: '小号', chats: [{ contactName: '备忘录', messages: [{ sender: 'char', text: '记录' }] }, { contactName: '文件传输助手', messages: [{ sender: 'char', text: '文件' }] }] }
        },
        files: { tags: [{ name: '日记', items: [{ title: '新文件' }] }] },
        game: { recentGames: [{ name: 'Game', matches: [{ result: '胜利', time: 'AI 假时间' }] }] },
        call: { recentCalls: [{ name: '新来电', time: 'AI 假时间' }], contacts: [] }
    };
    const result = app.mergeFriendPhoneGeneratedData(friend, parsed, { generatedAt: 123456, batchId: 'batch-fixed' });

    assert.deepEqual(result.next.musicData.top.map(item => item.name), ['新歌', '旧歌']);
    assert.equal(result.next.musicData.top[0].generatedAt, 123456);
    assert.equal(result.next.musicData.top[0].time, undefined);
    assert.equal(result.next.musicData.top[0].nameTranslationZh, '');
    assert.deepEqual(result.next.safariData.recentSearches.map(item => item.keyword), ['新搜索', '旧搜索']);
    assert.deepEqual(result.next.healthData.history.map(item => item.steps), ['2', '1']);
    assert.deepEqual(result.next.payData.snapshots.map(item => item.totalAssets), ['2', '1']);
    assert.deepEqual(result.next.payData.recentTransactions.map(item => item.title), ['新交易', '旧交易']);
    assert.deepEqual(result.next.imessageData.mainAccount.chats[0].messages.map(item => item.text), ['新消息', '旧消息']);
    assert.deepEqual(result.next.imessageData.altAccount.chats.map(item => item.contactName), ['备忘录', '文件传输助手']);
    assert.deepEqual(result.next.filesData.tags[0].items.map(item => item.title), ['新文件', '旧文件']);
    assert.equal(result.next.gameData.recentGames[0].matches.length, 2);
    assert.deepEqual(result.next.callData.recentCalls.map(item => item.name), ['新来电', '旧来电']);
});

test('foreign-language phone data requires Chinese translations atomically', () => {
    const app = window.lovesApp;
    assert.throws(() => app.mergeFriendPhoneGeneratedData(
        { language: 'en' },
        { music: { top: [{ name: 'Song' }], recent: [], favorites: [] } },
        { generatedAt: 10, batchId: 'bad' }
    ), /缺少中文翻译/);

    const valid = app.mergeFriendPhoneGeneratedData(
        { language: 'en' },
        { music: { top: [{ name: 'Song', nameTranslationZh: '歌曲' }], recent: [], favorites: [] } },
        { generatedAt: 10, batchId: 'good' }
    );
    assert.equal(valid.next.musicData.top[0].nameTranslationZh, '歌曲');
});
