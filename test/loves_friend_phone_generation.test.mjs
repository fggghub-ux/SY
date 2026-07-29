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
    assert.match(source, /每个会话生成 2-5 条自然气泡/);
    assert.match(source, /【覆盖规则】本次勾选应用的生成结果会完整覆盖该应用旧数据/);
    assert.doesNotMatch(source, /已有 iMessage 会话正文，供二次生成续写/);
    assert.doesNotMatch(source, /【二次生成语义去重清单】/);
    assert.match(source, /getRecentSingleChatMessages\(messageFriend\?\.messages, 20\)/);
    assert.match(source, /requireRange\(chat\?\.messages, 1, 5, `iMessage 主号会话/);
    assert.match(source, /①【备忘录】/);
    assert.match(source, /②【文件传输助手】/);
    assert.match(source, /sourceChats\.find\(chat => fixedNameOf\(chat\) === '备忘录'\)/);
    assert.match(source, /top\.slice\(0, genCounts\.musicTop\)/);
    assert.match(source, /recentGames\.slice\(0, genCounts\.gameTotal\)/);
    assert.match(source, /recentCalls\.slice\(0, genCounts\.callTotal\)/);
    assert.match(source, /严格生成 \$\{safariSplit\.primary\} 条公开模式/);
    assert.match(source, /严格生成 \$\{weiboPostSplit\.primary\} 条主页帖子/);
    assert.match(source, /每条主页帖子尽量生成 2-5 条自然评论/);
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
    assert.match(css, /\.friend-phone-translate-toggle\s*\{[\s\S]*?color:\s*#8e8e93/);
    assert.match(css, /#friend-safari-private-mode \.friend-phone-translate-toggle,[\s\S]*?#friend-game-view \.friend-phone-translate-toggle\s*\{\s*color:\s*#aeaeb2/);
    assert.doesNotMatch(css, /friend-phone-translate-toggle[^}]*color:\s*#(?:007aff|75aaff)/);
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

test('generated iMessage bubbles tolerate one message and cap oversized batches at five', () => {
    const app = window.lovesApp;
    const one = [{ sender: 'char', text: 'Only bubble' }];
    const oversized = Array.from({ length: 7 }, (_, index) => ({ sender: 'char', text: `bubble-${index + 1}` }));

    assert.deepEqual(app.normalizeFriendPhoneChatMessages(one), one);
    assert.deepEqual(app.normalizeFriendPhoneChatMessages(oversized).map(item => item.text), oversized.slice(0, 5).map(item => item.text));
    assert.deepEqual(app.normalizeFriendPhoneChatMessages([null, 'bad', ...one]), one);
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

test('friend phone generated data is timestamped and replaces selected app history', () => {
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
        callData: { recentCalls: [{ name: '旧来电', generatedAt: 1 }], contacts: [] },
        weiboData: { mainAccount: { posts: [{ text: '旧微博' }], album: [], liked: [] }, altAccount: { posts: [], album: [], liked: [] } },
        untouchedPhoneData: { value: '保留' }
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
        call: { recentCalls: [{ name: '新来电', time: 'AI 假时间' }], contacts: [] },
        weibo: { mainAccount: { posts: [{ text: '新微博' }], album: [], liked: [] }, altAccount: { posts: [], album: [], liked: [] } }
    };
    const result = app.mergeFriendPhoneGeneratedData(friend, parsed, { generatedAt: 123456, batchId: 'batch-fixed' });

    assert.deepEqual(result.next.musicData.top.map(item => item.name), ['新歌']);
    assert.equal(result.next.musicData.top[0].generatedAt, 123456);
    assert.equal(result.next.musicData.top[0].time, undefined);
    assert.equal(result.next.musicData.top[0].nameTranslationZh, undefined);
    assert.deepEqual(result.next.safariData.recentSearches.map(item => item.keyword), ['新搜索']);
    assert.deepEqual(result.next.healthData.history.map(item => item.steps), ['2']);
    assert.deepEqual(result.next.payData.snapshots.map(item => item.totalAssets), ['2']);
    assert.deepEqual(result.next.payData.recentTransactions.map(item => item.title), ['新交易']);
    assert.deepEqual(result.next.imessageData.mainAccount.chats[0].messages.map(item => item.text), ['新消息']);
    assert.deepEqual(result.next.imessageData.altAccount.chats.map(item => item.contactName), ['备忘录', '文件传输助手']);
    assert.deepEqual(result.next.filesData.tags[0].items.map(item => item.title), ['新文件']);
    assert.equal(result.next.gameData.recentGames[0].matches.length, 1);
    assert.deepEqual(result.next.callData.recentCalls.map(item => item.name), ['新来电']);
    assert.deepEqual(result.next.weiboData.mainAccount.posts.map(item => item.text), ['新微博']);
    assert.equal(result.next.untouchedPhoneData, undefined);
    Object.assign(friend, result.next);
    assert.equal(friend.untouchedPhoneData.value, '保留');
    assert.deepEqual(friend.weiboData.mainAccount.posts.map(item => item.text), ['新微博']);
});

test('foreign-language phone data degrades missing translations without rejecting the batch', () => {
    const app = window.lovesApp;
    const missing = app.validateFriendPhoneLocalizedTree(
        { music: { recent: [{ name: 'Song', artist: 'Singer' }] } },
        'en',
        'phone'
    );
    assert.deepEqual(missing, ['phone.music.recent[0].artist']);

    const degraded = app.mergeFriendPhoneGeneratedData(
        { language: 'en' },
        { music: { top: [], recent: [{ name: 'Song', artist: 'Singer' }], favorites: [] } },
        { generatedAt: 10, batchId: 'bad' }
    );
    assert.equal(degraded.next.musicData.recent[0].name, 'Song');
    assert.equal(app.renderFriendPhoneLocalized(degraded.next.musicData.recent[0], 'name'), 'Song');

    const valid = app.mergeFriendPhoneGeneratedData(
        { language: 'en' },
        { music: { top: [{ name: 'Song', nameTranslationZh: '歌曲' }], recent: [], favorites: [] } },
        { generatedAt: 10, batchId: 'good' }
    );
    assert.equal(valid.next.musicData.top[0].name, 'Song');
    assert.equal(valid.next.musicData.top[0].nameTranslationZh, undefined);
});

test('music titles and non-narrative game fields keep their natural language without translations', () => {
    const app = window.lovesApp;
    const result = app.mergeFriendPhoneGeneratedData(
        { language: 'en' },
        {
            music: {
                recent: [{ name: '夜に駆ける', nameTranslationZh: '向夜晚奔去', artist: 'YOASOBI', artistTranslationZh: 'YOASOBI' }],
                favorites: [],
                top: []
            },
            game: {
                playerName: 'Player One',
                playerNameTranslationZh: '玩家一号',
                totalHours: '200h',
                totalHoursTranslationZh: '200小时',
                recentGames: [{
                    name: 'League of Legends',
                    nameTranslationZh: '英雄联盟',
                    hours: '50h',
                    hoursTranslationZh: '50小时',
                    rank: 'Diamond',
                    rankTranslationZh: '钻石',
                    matches: [{
                        result: 'Win',
                        hero: 'Ahri',
                        heroTranslationZh: '阿狸',
                        highlights: [{ desc: 'A clean final engage', descTranslationZh: '漂亮的最终开团' }],
                        innerThoughts: 'Stay calm',
                        innerThoughtsTranslationZh: '保持冷静',
                        postGameReflection: 'I should ward earlier',
                        postGameReflectionTranslationZh: '我应该更早做视野'
                    }]
                }]
            }
        },
        { generatedAt: 20, batchId: 'natural-language' }
    );

    assert.equal(result.next.musicData.recent[0].nameTranslationZh, undefined);
    assert.equal(result.next.gameData.playerNameTranslationZh, undefined);
    assert.equal(result.next.gameData.recentGames[0].nameTranslationZh, undefined);
    assert.equal(result.next.gameData.recentGames[0].matches[0].heroTranslationZh, undefined);
    assert.equal(result.next.gameData.recentGames[0].matches[0].innerThoughtsTranslationZh, '保持冷静');
});

test('Weibo comment batches tolerate short results and cap oversized results', () => {
    const posts = window.lovesApp.normalizeFriendPhoneWeiboPostComments([
        { text: 'short', comments: [{ text: 'only one' }] },
        { text: 'missing' },
        { text: 'long', comments: Array.from({ length: 7 }, (_, index) => ({ text: `comment-${index}` })) }
    ]);
    assert.equal(posts[0].comments.length, 1);
    assert.deepEqual(posts[1].comments, []);
    assert.equal(posts[2].comments.length, 5);
});

test('Weibo and Files require translations only for detail content and comment bodies', () => {
    const missing = window.lovesApp.validateFriendPhoneLocalizedTree({
        weibo: {
            mainAccount: {
                name: 'free language name',
                signature: 'free language signature',
                posts: [{
                    text: 'detail post body',
                    textTranslationZh: '详情帖子正文',
                    source: 'free source',
                    comments: [{ author: 'free author', text: 'detail comment', textTranslationZh: '详情评论' }]
                }],
                album: [{ description: 'free album description' }]
            }
        },
        files: {
            tags: [{ name: 'free tag', items: [{ title: 'free title', content: 'detail file body', contentTranslationZh: '文件详情正文' }] }]
        }
    }, 'en', 'phone');
    assert.deepEqual(missing, []);
});

test('Safari, Weibo, and Files keep translation controls out of outer lists', async () => {
    const source = await fs.readFile(new URL('../js/loves.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /renderFriendPhoneLocalized\(s, 'keyword'/);
    assert.match(source, /renderFriendPhoneLocalized\(record, 'title'/);
    assert.match(source, /renderFriendPhoneLocalized\(record, 'content'/);
    assert.doesNotMatch(source, /renderFriendPhoneLocalized\(item, 'title'/);
    assert.doesNotMatch(source, /renderFriendPhoneLocalized\(tag, 'name'/);
    assert.match(source, /renderFriendPhoneLocalized\(item, 'content'/);
    assert.doesNotMatch(source, /weibo-text-\$\{options\.index/);
    assert.match(source, /renderFriendPhoneLocalized\(post, 'text', \{ id: 'weibo-detail-text' \}\)/);
    assert.match(source, /renderFriendPhoneLocalized\(comment, 'text'/);
    assert.doesNotMatch(source, /renderFriendPhoneLocalized\(comment, 'author'/);
});

test('iMessage and call contact names are Chinese-only fields and prefer Chinese display values', () => {
    const app = window.lovesApp;
    const contactPayload = {
        imessage: {
            altAccount: {
                name: 'Private account',
                nameTranslationZh: '私人账号',
                chats: [
                    { kind: 'memo', contactName: '备忘录', messages: [{ sender: 'char', text: 'A private note', textTranslationZh: '一条私人记录' }] },
                    { kind: 'file_transfer', contactName: '文件传输助手', messages: [{ sender: 'char', text: 'Saved file', textTranslationZh: '已保存的文件' }] }
                ]
            }
        },
        call: {
            recentCalls: [{ name: '林夏', type: 'incoming', dialogue: 'Hello', dialogueTranslationZh: '你好' }],
            contacts: [{ name: '林夏', callReason: 'Work', callReasonTranslationZh: '工作' }]
        }
    };

    assert.deepEqual(app.validateFriendPhoneLocalizedTree(contactPayload, 'en', 'phone'), []);
    assert.equal(app.getFriendPhoneChineseContactName({ name: 'Alex', nameTranslationZh: '艾利克斯' }), '艾利克斯');
    assert.equal(app.getFriendPhoneChineseContactName({ contactName: '林夏' }, 'contactName'), '林夏');
    assert.equal(app.getFriendPhoneChineseContactName({ name: 'Alex' }), '未知联系人');
});

test('iMessage list keeps translations inside bubbles and renders plain outer previews', async () => {
    const source = await fs.readFile(new URL('../js/loves.js', import.meta.url), 'utf8');
    assert.match(source, /getFriendPhoneChineseContactName\(chat, 'contactName'\)/);
    assert.match(source, /lastMsgObj \? this\.escapeHTML\(lastMsgText\) : '\.\.\.'/);
    assert.doesNotMatch(source, /renderFriendPhoneLocalized\(lastMsgObj, 'text'/);
    assert.match(source, /friend-phone-bubble-translatable/);
    assert.match(source, /control\.querySelector\('\.friend-phone-translation'\)/);
    assert.match(source, /bindFriendPhoneTranslationDelegation\(document\.getElementById\('friend-reverse-chat-view'\)\)/);
});
