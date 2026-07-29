import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const groupsSource = fs.readFileSync(new URL('../js/imessage/3_groups.js', import.meta.url), 'utf8');
const bubblesSource = fs.readFileSync(new URL('../js/imessage/4_chat_bubbles.js', import.meta.url), 'utf8');
const coreSource = fs.readFileSync(new URL('../js/imessage/2_core.js', import.meta.url), 'utf8');
const callSource = fs.readFileSync(new URL('../js/imessage/4_chat_voice_call.js', import.meta.url), 'utf8');
const cssSource = fs.readFileSync(new URL('../css/imessage.css', import.meta.url), 'utf8');
const aiSource = fs.readFileSync(new URL('../js/imessage/4_chat_ai.js', import.meta.url), 'utf8');
const storageSource = fs.readFileSync(new URL('../js/storage/app_storage.js', import.meta.url), 'utf8');

test('places group poll below group call and provides a 2-10 option composer', () => {
    const callIndex = html.indexOf('id="group-call-btn"');
    const pollIndex = html.indexOf('id="group-poll-btn"');
    assert.ok(callIndex >= 0);
    assert.ok(pollIndex > callIndex);
    assert.match(html, /id="group-poll-create-sheet"/);
    assert.match(groupsSource, /options\.length < 2/);
    assert.match(groupsSource, /currentCount >= 10/);
    assert.match(groupsSource, /投票选项不能重复/);
});

test('persists one group poll card without a card-level role-vote request button', () => {
    assert.match(groupsSource, /type: 'group_poll'/);
    assert.match(groupsSource, /window\.imApp\.appendFriendMessage\(group\.id, message\)/);
    assert.match(groupsSource, /pollStatus: 'idle'/);
    assert.doesNotMatch(groupsSource, /requestGroupPollVotes\(group\.id, message\.id\)/);
    assert.match(groupsSource, /window\.imApp\.updateFriendMessage\(groupId, \{ id: messageId \}/);
    assert.match(groupsSource, /window\.imChat\.selectGroupPollOption/);
    assert.doesNotMatch(groupsSource, /requestGroupPollVotes/);
    assert.doesNotMatch(bubblesSource, /获取角色投票|重新获取角色投票|group-poll-retry-btn/);
    assert.match(bubblesSource, /发送群聊回复后角色会投票/);
    assert.match(bubblesSource, /msg\.type === 'group_poll'/);
    assert.match(bubblesSource, /group-poll-card-option/);
});

test('keeps the group poll card compact and aligned with iMessage styling', () => {
    assert.match(cssSource, /\.group-poll-card\s*\{[\s\S]*?width: min\(232px, 64vw\)/);
    assert.match(cssSource, /\.group-poll-card\s*\{[\s\S]*?border: 1px solid #e5e5ea/);
    assert.match(cssSource, /\.group-poll-card-option\.is-user-selected \.group-poll-radio\s*\{[\s\S]*?border: 4px solid #007aff/);
    assert.match(html, /css\/imessage\.css\?v=[^"']*group-poll-v3/);
});

test('filters invalid role votes and exposes poll state to later group context', () => {
    assert.match(aiSource, /!memberIds\.has\(memberId\)/);
    assert.match(aiSource, /!optionIds\.has\(optionId\)/);
    assert.match(aiSource, /alreadyVotedMemberIds\.has\(memberId\)/);
    assert.match(aiSource, /seenMemberIds\.has\(memberId\)/);
    assert.match(aiSource, /也允许弃权/);
    assert.match(coreSource, /normalizedMessage\.type === 'group_poll'/);
    assert.match(coreSource, /'group_poll',/);
    assert.match(coreSource, /投票结果：/);
});

test('adds role voting to the normal group reply triggered by the input arrow', () => {
    assert.match(aiSource, /getGroupPollForNextReply\(friend\)/);
    assert.match(aiSource, /完整沿用本轮群聊提示词、世界书、群设定、成员人设、关系、记忆、语言、时间和近期聊天/);
    assert.match(aiSource, /<group_poll_votes>/);
    assert.match(aiSource, /applyGroupPollRoleVotes/);
    assert.doesNotMatch(aiSource, /responseMode === 'group_poll'|isGroupPollRequest/);
    assert.doesNotMatch(groupsSource, /handleAiReply\(group, null, null|responseMode: 'group_poll'/);
});

test('changing the user vote preserves existing role votes for later AI context', () => {
    assert.match(groupsSource, /const memberVotes = [\s\S]*?filter\(vote => vote\?\.voterType === 'member'\)/);
    assert.match(groupsSource, /\}, \.\.\.memberVotes\];/);
    assert.match(groupsSource, /targetMessage\.pollStatus = 'idle'/);
});

test('keeps complete group poll data in IndexedDB message records', () => {
    assert.match(storageSource, /pollOptions: Array\.isArray\(safe\.pollOptions\)/);
    assert.match(storageSource, /pollVotes: Array\.isArray\(safe\.pollVotes\)/);
    assert.match(storageSource, /pollOptions: Array\.isArray\(row\.pollOptions\)/);
    assert.match(storageSource, /pollVotes: Array\.isArray\(row\.pollVotes\)/);
});

test('group call prompt requests coherent turn-taking without thoughts', () => {
    assert.doesNotMatch(callSource, /本轮必须让所有已接入的非 User 群成员各发言一次/);
    assert.match(callSource, /每次生成 3-8 条按实际发生顺序排列的简短发言/);
    assert.match(callSource, /无需让所有成员出现，也不限制一名成员只能说一次/);
    assert.match(callSource, /严禁输出 thought、inner、monologue、心声、内心、心理活动/);
    assert.match(callSource, /parsed = parsed\.slice\(0, 8\)\.map/);
    assert.match(callSource, /450 \+ \(messageIndex \* 700\)/);
});
