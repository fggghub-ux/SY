import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [playerSource, indexSource, cssSource] = await Promise.all([
    fs.readFile(new URL('../js/youtube/5_player.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/youtube.css', import.meta.url), 'utf8')
]);

test('Char live translations render as plain text instead of gray bubbles', () => {
    assert.match(cssSource, /#yt-player-chat-container \.yt-live-chat-row-anim \.yt-comment-translation\s*\{[\s\S]*padding:\s*0;[\s\S]*border-radius:\s*0;[\s\S]*background:\s*transparent;/);
    assert.match(cssSource, /#yt-player-chat-container \.yt-live-chat-row-anim \.yt-comment-translation-toggle\s*\{[\s\S]*font-weight:\s*400;/);
});

test('Char Super Chat uses a centered neutral modal while message bubbles use amount tiers', () => {
    assert.match(indexSource, /class="[^"]*yt-sc-modal-overlay[^"]*" id="yt-sc-sheet"/);
    assert.match(indexSource, /class="bottom-sheet yt-sc-modal-card"/);
    assert.match(indexSource, /id="yt-sc-close-btn"/);
    assert.match(cssSource, /\.yt-sc-modal-overlay\s*\{[\s\S]*justify-content:\s*center;[\s\S]*align-items:\s*center;/);
    assert.match(cssSource, /#yt-sc-sheet \.yt-sc-modal-card\s*\{[\s\S]*box-shadow:\s*none !important;/);
    assert.match(indexSource, /data-amount="30"[\s\S]*data-amount="50"[\s\S]*data-amount="100"[\s\S]*data-amount="200"[\s\S]*data-amount="500"[\s\S]*data-amount="1000"/);
    assert.match(cssSource, /#yt-sc-sheet #yt-send-sc-btn\s*\{[\s\S]*background:\s*#0f0f0f !important;/);
    assert.match(cssSource, /\.yt-sc-modal-header\s*\{[\s\S]*background:\s*#fff;/);
    assert.doesNotMatch(playerSource, /ytScSheet\.style\.setProperty\('--yt-sc-color'/);
    assert.match(playerSource, /numericAmount >= 1000[\s\S]*#e91e63/);
    assert.match(playerSource, /numericAmount >= 500[\s\S]*#f57c00/);
    assert.match(playerSource, /numericAmount >= 200[\s\S]*#ffca28/);
    assert.match(playerSource, /numericAmount >= 100[\s\S]*#00bfa5/);
    assert.match(playerSource, /numericAmount >= 50[\s\S]*#00b8d4/);
    assert.match(playerSource, /return \{ key: 'blue', color: '#1565c0'/);
    assert.match(playerSource, /row\.style\.backgroundColor = superChatTier\.color/);
    assert.match(playerSource, /randomSuperChat\.amount \|\| responseObj\.randomSuperChat\.displayAmount[\s\S]*\.color/);
});

test('Char live audience comments override the host default language with global diversity', () => {
    assert.match(playerSource, /narrative and every charBubbles item/);
    assert.doesNotMatch(playerSource, /narrative, every charBubbles item, every fanComments\/passerbyComments item/);
    assert.match(playerSource, /最高优先级：直播观众国际化协议[\s\S]*每次必须返回 6–10 条[\s\S]*至少包含 3 种语言/);
    assert.match(playerSource, /最高优先级：观众评论国际化协议[\s\S]*currentLive\.comments[\s\S]*至少一半为非中文评论/);
    assert.match(playerSource, /text 非中文时 translationZh 必须填写/);
});
