import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

globalThis.window = {};
globalThis.document = { addEventListener() {} };

await import('../js/loves.js');

test('computer generation counts use defaults and clamp values', () => {
    const app = window.lovesApp;
    assert.deepEqual(app.getFriendComputerGenCounts({}), { mail: 6, calendar: 5, notes: 5, files: 6 });
    assert.deepEqual(app.getFriendComputerGenCounts({ computerGenCounts: { mail: 99, calendar: 0, notes: '7', files: 'bad' } }), {
        mail: 12,
        calendar: 1,
        notes: 7,
        files: 6
    });
});

test('real time context includes local date, weekday, and precise time', () => {
    const value = window.lovesApp.getCurrentRealTimeContext(new Date(2026, 6, 11, 9, 8, 7));
    assert.equal(value, '2026年07月11日 星期六 09:08:07');
});

test('single chat context keeps twenty full rounds', () => {
    const messages = Array.from({ length: 55 }, (_, index) => ({ text: String(index) }));
    const recent = window.lovesApp.getRecentSingleChatRounds(messages, 20);
    assert.equal(recent.length, 40);
    assert.equal(recent[0].text, '15');
    assert.equal(recent[39].text, '54');
});

test('computer normalization owns Char identity and caps collections', () => {
    const app = window.lovesApp;
    const normalized = app.normalizeFriendComputerData({
        resume: { name: 'AI name', avatarUrl: 'ai.png', realName: 'AI Real', age: '28岁', height: '180cm', weight: '70kg', ethnicity: '汉族', title: 'Designer', skills: Array(20).fill('Skill') },
        mail: Array(20).fill({ subject: 'Mail' }),
        calendar: Array(20).fill({ title: 'Event' }),
        notes: Array(20).fill({ title: 'Note' }),
        files: Array(20).fill({ name: 'File' })
    }, { nickname: 'Char', realname: '角色真名', avatarUrl: 'char.png' });
    assert.equal(normalized.resume.name, 'Char');
    assert.equal(normalized.resume.avatarUrl, 'char.png');
    assert.equal(normalized.resume.realName, '角色真名');
    assert.equal(normalized.resume.age, '28岁');
    assert.equal(normalized.resume.height, '180cm');
    assert.equal(normalized.resume.weight, '70kg');
    assert.equal(normalized.resume.ethnicity, '汉族');
    assert.equal(normalized.resume.skills.length, 12);
    assert.equal(normalized.mail.length, 12);
    assert.equal(normalized.calendar.length, 10);
    assert.equal(normalized.notes.length, 10);
    assert.equal(normalized.files.length, 12);
});

test('friend computer view exposes six Mac apps and versioned assets', async () => {
    const [html, css, source] = await Promise.all([
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
        fs.readFile(new URL('../css/loves.css', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/loves.js', import.meta.url), 'utf8')
    ]);
    assert.match(html, /id="lovers-friend-computer-view"/);
    assert.match(source, /id="friend-computer-device-item"/);
    ['resume', 'mail', 'calendar', 'notes', 'files', 'settings'].forEach(app => {
        assert.match(html, new RegExp(`data-computer-app="${app}"`));
    });
    assert.match(html, /css\/loves\.css\?v=20260719-friend-phone-bilingual-v8/);
    assert.match(html, /js\/loves\.js\?v=20260719-friend-phone-bilingual-v13/);
    assert.match(css, /@media \(max-width: 620px\)/);
    assert.match(source, /friend\.computerData = this\.normalizeFriendComputerData/);
    assert.match(source, /selected\.forEach\(key =>/);
    assert.match(source, /computer-gen-checkbox:checked/);
    assert.match(source, /this\.currentComputerApp === button\.dataset\.computerApp/);
    assert.match(source, /id="friend-computer-bg-url"/);
    assert.match(source, /id="friend-computer-bg-upload"/);
    assert.match(source, /realName、gender、age、birthday、height、weight、ethnicity、nationality/);
    assert.match(css, /\.friend-mac-personal-grid/);
    assert.match(css, /background-image: url\("\.\.\/assets\/bizhi\.jpg"\)/);
    assert.match(source, /'url\("assets\/bizhi\.jpg"\)'/);
    assert.doesNotMatch(html, /friend-mac-menubar/);
    assert.match(html, /class="friend-mac-floating-back"/);
    assert.match(html, /使用真实时间/);
    assert.match(html, /id="friend-phone-real-time-toggle"/);
    assert.match(source, /id="friend-computer-real-time-toggle"/);
    assert.match(source, /friend\.phoneIncludeRealTime !== false/);
    assert.match(source, /friend\.computerIncludeRealTime !== false/);
    assert.match(source, /【当前真实时间】/);
    assert.match(css, /\.lovers-friend-computer-view\.app-open \.friend-mac-floating-back/);
    assert.match(css, /#friend-phone-app-weibo > div,[\s\S]*background: #fff !important;[\s\S]*color: #111 !important/);
    assert.match(css, /div:last-child \{[\s\S]*background: transparent !important/);
    assert.match(css, /\.friend-mac-owner \{[^}]*top: calc\(var\(--safe-top\) \+ 76px\)/);
    assert.doesNotMatch(html, /class="friend-mac-desktop-icons"/);
    assert.doesNotMatch(source, /friend-mac-desktop-app\[data-computer-app\]/);
    assert.match(css, /\.friend-mac-dock \{[^}]*overflow-x: auto/);
    assert.match(css, /\.friend-mac-dock button \{[^}]*flex: 0 0 52px/);
    assert.match(css, /\.friend-mac-window \{[^}]*top: var\(--safe-top\)/);
    assert.match(source, /getRecentSingleChatRounds\(friend\.messages, 20\)/);
    assert.doesNotMatch(source, /friend\.messages\.slice\(-20\)/);
    assert.match(html, /id="friend-phone-bg-reset-btn"/);
    assert.match(source, /friend\.phoneBg = ''/);
});
