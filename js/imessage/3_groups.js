// ==========================================
// IMESSAGE: 3. GROUPS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const { openView, closeView, showToast } = window;

    const createGroupSheet = document.getElementById('create-group-sheet');
    const groupDetailsSheet = document.getElementById('group-details-sheet');
    const groupEditSheet = document.getElementById('group-edit-sheet');
    const groupDetailsEditBtn = document.getElementById('group-details-edit-btn');
    const groupDetailsSettingsBtn = document.getElementById('group-details-settings-btn');
    const groupContextSettingsSheet = document.getElementById('group-context-settings-sheet');
    const groupDetailsMoreBtn = document.getElementById('group-details-more-btn');
    const groupMoreSheet = document.getElementById('group-more-sheet');
    const groupOverviewBtn = document.getElementById('group-overview-btn');
    const groupCallBtn = document.getElementById('group-call-btn');
    const groupCallInviteSheet = document.getElementById('group-call-invite-sheet');
    const groupCallMembersList = document.getElementById('group-call-members-list');
    const groupCallStartBtn = document.getElementById('group-call-start-btn');
    const groupContextEnabledToggle = document.getElementById('group-context-enabled-toggle');
    const groupContextLimitInput = document.getElementById('group-context-limit-input');
    const groupBotEnabledToggle = document.getElementById('group-bot-enabled-toggle');
    const groupSummaryHeader = document.getElementById('group-summary-header');
    const groupSummaryBody = document.getElementById('group-summary-body');
    const groupSummaryEnabledToggle = document.getElementById('group-summary-enabled-toggle');
    const groupSummaryLimitInput = document.getElementById('group-summary-limit-input');
    const groupSummaryPromptInput = document.getElementById('group-summary-prompt-input');
    const confirmGroupContextBtn = document.getElementById('confirm-group-context-btn');
    const confirmGroupEditBtn = document.getElementById('confirm-group-edit-btn');
    const groupEditNameInput = document.getElementById('group-edit-name-input');
    const groupBgUploadIcon = document.getElementById('group-bg-upload-icon');
    const groupBgResetIcon = document.getElementById('group-bg-reset-icon');
    const groupBgUpload = document.getElementById('group-bg-upload');
    const groupAddMemberBtn = document.getElementById('group-add-member-btn');
    const groupAddMemberSheet = document.getElementById('group-add-member-sheet');
    const groupAddMemberList = document.getElementById('group-add-member-list');

    let tempGroupMembers = [];
    let currentViewingGroup = null;

    function isSelectableGroupMember(friend) {
        return !!friend && (friend.type === 'char' || friend.type === 'npc');
    }

    function getAvailableGroupAccounts() {
        return typeof window.getAccounts === 'function' ? window.getAccounts() : [];
    }

    async function commitCurrentGroupChange(mutator, options = {}) {
        if (!currentViewingGroup) return false;

        return window.imApp.commitScopedFriendChange(currentViewingGroup, (targetGroup) => {
            if (!targetGroup) return;
            currentViewingGroup = targetGroup;
            return mutator(targetGroup);
        }, {
            syncActive: true,
            metaOnly: options.metaOnly !== false,
            ...options
        });
    }

    async function commitContactsFriendChange(friendOrId, mutator, options = {}) {
        return window.imApp.commitScopedFriendChange(friendOrId, mutator, {
            syncActive: false,
            metaOnly: options.metaOnly !== false,
            ...options
        });
    }

    function getGroupUserDisplayMeta(group) {
        const currentAccountId = typeof window.getCurrentAccountId === 'function' ? window.getCurrentAccountId() : null;
        const accounts = getAvailableGroupAccounts();
        const currentAccount = accounts.find(acc => String(acc.id) === String(currentAccountId)) || null;
        const override = group && group.memory ? (group.memory.userOverride || null) : null;

        const fallbackName = (window.userState && (window.userState.name || window.userState.realName))
            || currentAccount?.name
            || 'Me';
        const fallbackAvatar = (window.userState && (window.userState.avatarUrl || window.userState.avatar))
            || currentAccount?.avatarUrl
            || currentAccount?.avatar
            || `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=random`;

        return {
            id: override?.id || currentAccount?.id || '__user__',
            name: override?.name || fallbackName,
            avatarUrl: override?.avatarUrl || override?.avatar || fallbackAvatar,
            persona: override?.persona || currentAccount?.persona || (window.userState ? window.userState.persona : '') || '',
            signature: override?.signature || currentAccount?.signature || ''
        };
    }

    function setGroupAvatar(url) {
        const img = document.getElementById('group-avatar-img');
        const icon = document.getElementById('group-avatar-icon');
        if (!img || !icon) return;
        if (url) {
            img.src = url;
            img.style.display = 'block';
            icon.style.display = 'none';
        } else {
            img.src = '';
            img.style.display = 'none';
            icon.style.display = 'block';
        }
    }

    function updateCreateGroupConfirmBtn() {
        const confirmBtn = document.getElementById('confirm-create-group-btn');
        if (!confirmBtn) return;
        if (tempGroupMembers.length > 0) {
            confirmBtn.style.opacity = '1';
            confirmBtn.style.pointerEvents = 'auto';
        } else {
            confirmBtn.style.opacity = '0.5';
            confirmBtn.style.pointerEvents = 'none';
        }
    }

    function renderCreateGroupMembersList() {
        const list = document.getElementById('create-group-members-list');
        if (!list) return;
        list.innerHTML = '';

        const allFriends = window.imData.friends.filter(isSelectableGroupMember);

        allFriends.forEach(friend => {
            const item = document.createElement('div');
            item.className = 'line-list-item';

            const isSelected = tempGroupMembers.includes(friend.id);

            const avatarHtml = friend.avatarUrl
                ? `<img src="${friend.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">`
                : (friend.type === 'npc' ? `<i class="fas fa-robot"></i>` : `<i class="fas fa-user"></i>`);

            item.innerHTML = `
                <div style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid ${isSelected ? '#007aff' : '#c7c7cc'}; background: ${isSelected ? '#007aff' : 'transparent'}; display: flex; justify-content: center; align-items: center; color: #fff; font-size: 12px; margin-right: 5px;">
                    ${isSelected ? '<i class="fas fa-check"></i>' : ''}
                </div>
                <div class="line-item-avatar">${avatarHtml}</div>
                <div class="line-item-text" style="flex: 1;">${friend.nickname}</div>
            `;

            item.addEventListener('click', () => {
                if (isSelected) {
                    tempGroupMembers = tempGroupMembers.filter(id => id !== friend.id);
                } else {
                    tempGroupMembers.push(friend.id);
                }
                renderCreateGroupMembersList();
                updateCreateGroupConfirmBtn();
            });

            list.appendChild(item);
        });
    }

    function openCreateGroupSheet() {
        tempGroupMembers = [];
        const nameInput = document.getElementById('group-name-input');
        if (nameInput) nameInput.value = '';
        setGroupAvatar(null);
        renderCreateGroupMembersList();
        updateCreateGroupConfirmBtn();
        openView(createGroupSheet);
    }

    function renderGroupsList() {
        const groupsContent = document.getElementById('groups-content');
        if (!groupsContent) return;

        groupsContent.innerHTML = `
            <div class="line-list-item" id="create-group-trigger">
                <div class="line-item-icon bg-light"><i class="fas fa-users"></i></div>
                <div class="line-item-text">Create group</div>
            </div>
        `;

        const createGroupTrigger = document.getElementById('create-group-trigger');
        if (createGroupTrigger) {
            createGroupTrigger.addEventListener('click', () => {
                openCreateGroupSheet();
            });
        }

        const groups = window.imData.friends.filter(f => f.type === 'group');
        groups.forEach(group => {
            const item = document.createElement('div');
            item.className = 'line-list-item';

            const avatarHtml = group.avatarUrl
                ? `<img src="${group.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">`
                : `<div style="width: 100%; height: 100%; background: linear-gradient(135deg, #ff9a9e, #fecfef); color: white; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 20px;">${group.nickname.charAt(0).toUpperCase()}</div>`;

            item.innerHTML = `
                <div class="line-item-avatar">${avatarHtml}</div>
                <div class="line-item-text">${group.nickname}</div>
            `;

            item.addEventListener('click', () => {
                if (window.imApp.openChatTab) window.imApp.openChatTab(group);
            });

            groupsContent.appendChild(item);
        });
    }

    function openGroupEditSheet() {
        if (!currentViewingGroup || !groupEditSheet) return;
        if (groupEditNameInput) {
            groupEditNameInput.value = currentViewingGroup.nickname || '';
        }
        openView(groupEditSheet);
    }

    function openGroupContextSettingsSheet() {
        if (!currentViewingGroup || !groupContextSettingsSheet) return;

        currentViewingGroup.memory = currentViewingGroup.memory || window.imApp.createDefaultMemory();
        currentViewingGroup.memory.context = currentViewingGroup.memory.context || {};
        currentViewingGroup.memory.summary = currentViewingGroup.memory.summary || {};

        const enabled = typeof currentViewingGroup.memory.context.enabled === 'boolean'
            ? currentViewingGroup.memory.context.enabled
            : true;
        const limit = Number(currentViewingGroup.memory.context.limit) > 0
            ? Number(currentViewingGroup.memory.context.limit)
            : 100;

        if (groupContextEnabledToggle) {
            groupContextEnabledToggle.checked = enabled;
        }

        if (groupContextLimitInput) {
            groupContextLimitInput.value = limit;
        }

        if (groupBotEnabledToggle) {
            groupBotEnabledToggle.checked = !!currentViewingGroup.botEnabled;
        }

        const summaryEnabled = !!currentViewingGroup.memory.summary.enabled;
        const summaryLimit = Number(currentViewingGroup.memory.summary.limit) > 0
            ? Number(currentViewingGroup.memory.summary.limit)
            : 100;
        const summaryPrompt = currentViewingGroup.memory.summary.prompt || '';

        if (groupSummaryEnabledToggle) {
            groupSummaryEnabledToggle.checked = summaryEnabled;
        }
        if (groupSummaryLimitInput) {
            groupSummaryLimitInput.value = summaryLimit;
        }
        if (groupSummaryPromptInput) {
            groupSummaryPromptInput.value = summaryPrompt;
        }
        if (groupSummaryBody && groupSummaryHeader) {
            if (summaryEnabled) {
                groupSummaryBody.style.display = 'block';
                groupSummaryHeader.style.borderRadius = '20px 20px 0 0';
                groupSummaryHeader.style.borderBottom = '1px solid #e5e5ea';
            } else {
                groupSummaryBody.style.display = 'none';
                groupSummaryHeader.style.borderRadius = '20px';
                groupSummaryHeader.style.borderBottom = 'none';
            }
        }

        openView(groupContextSettingsSheet);
    }

    function openGroupAddMemberSheet() {
        if (!currentViewingGroup || !groupAddMemberSheet || !groupAddMemberList) return;

        groupAddMemberList.innerHTML = '';

        const allFriendsAndNpcs = window.imData.friends.filter(isSelectableGroupMember);
        const currentMemberIds = currentViewingGroup.members || [];

        allFriendsAndNpcs.forEach(friend => {
            const isAlreadyInGroup = currentMemberIds.includes(friend.id);
            const item = document.createElement('div');
            item.className = 'line-list-item';
            if (isAlreadyInGroup) {
                item.style.opacity = '0.5';
                item.style.pointerEvents = 'none';
            }

            const avatarHtml = friend.avatarUrl
                ? `<img src="${friend.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">`
                : (friend.type === 'npc' ? `<i class="fas fa-robot"></i>` : `<i class="fas fa-user"></i>`);

            item.innerHTML = `
                <div class="line-item-avatar">${avatarHtml}</div>
                <div class="line-item-text" style="flex: 1;">${friend.nickname}</div>
                ${isAlreadyInGroup ? '<div style="font-size: 13px; color: #8e8e93; margin-right: 15px;">已在群内</div>' : '<div style="width: 28px; height: 28px; border-radius: 50%; background: #007aff; color: #fff; display: flex; justify-content: center; align-items: center; cursor: pointer; margin-right: 15px;"><i class="fas fa-plus" style="font-size: 12px;"></i></div>'}
            `;

            if (!isAlreadyInGroup) {
                item.addEventListener('click', async () => {
                    const saved = await commitCurrentGroupChange((targetGroup) => {
                        targetGroup.members.push(friend.id);
                    }, { silent: true });

                    if (!saved) {
                        if (window.showToast) window.showToast(`邀请 ${friend.nickname} 失败`);
                        return;
                    }

                    item.style.opacity = '0.5';
                    item.style.pointerEvents = 'none';
                    item.innerHTML = `
                        <div class="line-item-avatar">${avatarHtml}</div>
                        <div class="line-item-text" style="flex: 1;">${friend.nickname}</div>
                        <div style="font-size: 13px; color: #8e8e93; margin-right: 15px;">已在群内</div>
                    `;

                    window.imApp.openGroupDetails(currentViewingGroup);

                    if (window.showToast) window.showToast(`已邀请 ${friend.nickname} 加入群聊`);
                });
            }

            groupAddMemberList.appendChild(item);
        });

        openView(groupAddMemberSheet);
    }

    window.imApp.openGroupDetails = function(group) {
        if (!group || group.type !== 'group') return;
        currentViewingGroup = group;

        const avatarText = document.getElementById('group-details-avatar-text');
        const avatarImg = document.getElementById('group-details-avatar-img');
        if (group.avatarUrl) {
            avatarImg.src = group.avatarUrl;
            avatarImg.style.display = 'block';
            avatarText.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
            avatarText.style.display = 'block';
            avatarText.textContent = group.nickname.charAt(0).toUpperCase();
        }

        document.getElementById('group-details-name').textContent = group.nickname;

        const count = (group.members ? group.members.length : 0) + 1;
        document.getElementById('group-details-count').textContent = `${count} member${count > 1 ? 's' : ''}`;

        const listContainer = document.getElementById('group-details-members-list');
        const userMeta = getGroupUserDisplayMeta(group);
        const myName = userMeta.name;
        const myAvatarUrl = userMeta.avatarUrl;

        let membersHtml = `
            <div class="group-detail-member-item" data-id="__user__" style="padding: 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f2f2f7; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #e5e5ea; display: flex; justify-content: center; align-items: center; overflow: hidden;">
                        <img src="${myAvatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: #000;">${myName}</div>
                        <div style="font-size: 12px; color: #007aff;">online</div>
                    </div>
                </div>
                <div style="font-size: 12px; color: #8e8e93; background: #f2f2f7; padding: 2px 8px; border-radius: 10px; color: #c084fc; background: #f3e8ff;">owner</div>
            </div>
        `;

        if (group.botEnabled) {
            membersHtml += `
                <div class="group-detail-member-item" data-id="__group_bot__" style="padding: 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f2f2f7; cursor: pointer;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #ff9500, #ff2d55); display: flex; justify-content: center; align-items: center; overflow: hidden;">
                            <i class="fas fa-robot" style="color: #fff;"></i>
                        </div>
                        <div>
                            <div style="font-size: 16px; font-weight: 600; color: #000;">群bot</div>
                            <div style="font-size: 12px; color: #007aff;">online</div>
                        </div>
                    </div>
                    <div style="font-size: 12px; color: #8e8e93; background: #f2f2f7; padding: 2px 8px; border-radius: 10px;">bot</div>
                </div>
            `;
        }

        if (group.members) {
            group.members.forEach(id => {
                const f = window.imData.friends.find(x => x.id === id);
                if (!f) return;
                const avatar = f.avatarUrl ? `<img src="${f.avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="fas fa-user" style="color: #fff;"></i>`;
                membersHtml += `
                    <div class="group-detail-member-item" data-id="${f.id}" style="padding: 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f2f2f7; cursor: pointer;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 40px; height: 40px; border-radius: 50%; background: #c7c7cc; display: flex; justify-content: center; align-items: center; overflow: hidden;">
                                ${avatar}
                            </div>
                            <div>
                                <div style="font-size: 16px; font-weight: 600; color: #000;">${f.nickname}</div>
                                <div style="font-size: 12px; color: #8e8e93;">offline</div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        if (listContainer) {
            listContainer.innerHTML = membersHtml;

            const memberItems = listContainer.querySelectorAll('.group-detail-member-item');
            memberItems.forEach(item => {
                item.addEventListener('click', () => {
                    const memberId = item.getAttribute('data-id');
                    if (memberId === '__user__') {
                        if (window.openView && document.getElementById('group-account-switch-sheet')) {
                            if (window.imApp && window.imApp.showGroupAccountSwitchSheet) {
                                window.imApp.showGroupAccountSwitchSheet(currentViewingGroup);
                            }
                        }
                    } else if (memberId !== '__group_bot__') {
                        if (window.imApp && window.imApp.showGroupMemberManageSheet) {
                            window.imApp.showGroupMemberManageSheet(currentViewingGroup, memberId);
                        }
                    }
                });
            });
        }

        if (groupDetailsSheet) {
            openView(groupDetailsSheet);
        }
    };

    window.imApp.showGroupAccountSwitchSheet = function(group) {
        const sheet = document.getElementById('group-account-switch-sheet');
        const listContainer = document.getElementById('group-account-switch-list');
        if (!sheet || !listContainer || !group) return;

        listContainer.innerHTML = '';

        const accounts = getAvailableGroupAccounts();
        if (accounts.length === 0) {
            listContainer.innerHTML = '<div style="text-align: center; color: #8e8e93; padding: 20px;">暂无可用账号，请先在设置中添加 Apple ID</div>';
            window.openView(sheet);
            return;
        }

        accounts.forEach(acc => {
            const item = document.createElement('div');
            item.className = 'group-detail-member-item';
            item.style.cssText = 'padding: 12px 16px; background: #fff; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer;  margin-bottom: 10px;';

            const accountAvatarUrl = acc.avatarUrl || acc.avatar || '';
            const avatarHtml = accountAvatarUrl
                ? `<img src="${accountAvatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">`
                : `<i class="fas fa-user"></i>`;

            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 44px; height: 44px; border-radius: 50%; background: #e5e5ea; display: flex; justify-content: center; align-items: center; color: #8e8e93; font-size: 20px; overflow: hidden;">
                        ${avatarHtml}
                    </div>
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: #000;">${acc.name || 'User'}</div>
                        <div style="font-size: 12px; color: #8e8e93;">${acc.signature || acc.persona || 'No Signature'}</div>
                    </div>
                </div>
            `;

            item.addEventListener('click', async () => {
                const saved = await commitContactsFriendChange(group, (targetGroup) => {
                    targetGroup.memory = targetGroup.memory || window.imApp.createDefaultMemory();
                    targetGroup.memory.userOverride = {
                        id: acc.id,
                        name: acc.name || 'User',
                        avatarUrl: acc.avatarUrl || acc.avatar || '',
                        persona: acc.persona || '',
                        signature: acc.signature || ''
                    };
                }, { silent: true });

                if (!saved) {
                    if (window.showToast) window.showToast('群身份切换保存失败');
                    return;
                }

                if (window.imApp.openGroupDetails) {
                    window.imApp.openGroupDetails(group);
                }

                window.closeView(sheet);
                if (window.showToast) window.showToast(`已将您的发言身份切换为: ${acc.name}`);
            });

            listContainer.appendChild(item);
        });

        window.openView(sheet);
    };

    window.imApp.showGroupMemberManageSheet = function(group, memberId) {
        const sheet = document.getElementById('group-member-manage-sheet');
        if (!sheet || !group) return;

        let targetMember = null;
        if (memberId === '__group_bot__') {
            targetMember = { id: '__group_bot__', nickname: '群bot', avatarUrl: null };
            return;
        } else {
            targetMember = window.imData.friends.find(x => String(x.id) === String(memberId));
        }

        if (!targetMember) return;

        const avatarImg = document.getElementById('gmm-avatar');
        const avatarIcon = document.getElementById('gmm-avatar-icon');
        if (targetMember.avatarUrl) {
            avatarImg.src = targetMember.avatarUrl;
            avatarImg.style.display = 'block';
            avatarIcon.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
            avatarIcon.style.display = 'block';
        }

        document.getElementById('gmm-name').textContent = targetMember.nickname || 'Member';
        
        // 单聊记忆开关与数量逻辑
        const memoryToggle = document.getElementById('gmm-memory-toggle');
        const memoryLimitInput = document.getElementById('gmm-memory-limit-input');
        
        if (memoryToggle) {
            const newToggle = memoryToggle.cloneNode(true);
            memoryToggle.parentNode.replaceChild(newToggle, memoryToggle);
            
            let newLimitInput = null;
            if (memoryLimitInput) {
                newLimitInput = memoryLimitInput.cloneNode(true);
                memoryLimitInput.parentNode.replaceChild(newLimitInput, memoryLimitInput);
            }
            
            if (memberId === '__group_bot__') {
                newToggle.disabled = true;
                newToggle.checked = false;
                if (newLimitInput) newLimitInput.disabled = true;
            } else {
                newToggle.disabled = false;
                if (newLimitInput) newLimitInput.disabled = false;
                
                const groupMemory = group.memory || {};
                const mountSettings = groupMemory.mountSettings || {};
                const mountLimits = groupMemory.mountLimits || {};
                
                newToggle.checked = !!mountSettings[memberId];
                if (newLimitInput) {
                    newLimitInput.value = mountLimits[memberId] || 20;
                }
                
                const saveSettings = async () => {
                    const isChecked = newToggle.checked;
                    const limitVal = newLimitInput ? parseInt(newLimitInput.value) || 20 : 20;
                    
                    // 同步更新本地引用
                    group.memory = group.memory || window.imApp.createDefaultMemory();
                    group.memory.mountSettings = group.memory.mountSettings || {};
                    group.memory.mountLimits = group.memory.mountLimits || {};
                    group.memory.mountSettings[memberId] = isChecked;
                    group.memory.mountLimits[memberId] = limitVal;
                    
                    await commitCurrentGroupChange((targetGroup) => {
                        targetGroup.memory = targetGroup.memory || window.imApp.createDefaultMemory();
                        targetGroup.memory.mountSettings = targetGroup.memory.mountSettings || {};
                        targetGroup.memory.mountLimits = targetGroup.memory.mountLimits || {};
                        
                        targetGroup.memory.mountSettings[memberId] = isChecked;
                        targetGroup.memory.mountLimits[memberId] = limitVal;
                    }, { silent: true });
                };

                newToggle.addEventListener('change', async (e) => {
                    await saveSettings();
                    if (window.showToast) window.showToast(e.target.checked ? '已开启单聊挂载' : '已关闭单聊挂载');
                });
                
                if (newLimitInput) {
                    newLimitInput.addEventListener('change', async () => {
                        await saveSettings();
                    });
                }
            }
        }

        window.openView(sheet);
    };

    if (createGroupSheet) {
        const createGroupTrigger = document.querySelector('#groups-content .line-list-item');
        if (createGroupTrigger) {
            createGroupTrigger.addEventListener('click', () => {
                openCreateGroupSheet();
            });
        }
    }

    const cancelCreateGroupBtn = document.getElementById('cancel-create-group-btn');
    if (cancelCreateGroupBtn) {
        cancelCreateGroupBtn.addEventListener('click', () => {
            closeView(createGroupSheet);
        });
    }

    const groupAvatarWrapper = document.getElementById('group-avatar-wrapper');
    const groupAvatarUpload = document.getElementById('group-avatar-upload');
    if (groupAvatarWrapper && groupAvatarUpload) {
        groupAvatarWrapper.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') groupAvatarUpload.click();
        });
        groupAvatarUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const nextAvatar = window.imApp.compressImageFile
                    ? await window.imApp.compressImageFile(file, {
                        maxWidth: 256,
                        maxHeight: 256,
                        mimeType: 'image/jpeg',
                        quality: 0.8
                    })
                    : await window.imApp.readFileAsDataUrl(file);

                setGroupAvatar(nextAvatar);
            } catch (error) {
                console.error('Failed to process group avatar', error);
                if (showToast) showToast('群头像处理失败');
            }
        });
    }

    const confirmCreateGroupBtn = document.getElementById('confirm-create-group-btn');
    if (confirmCreateGroupBtn) {
        confirmCreateGroupBtn.addEventListener('click', async () => {
            if (tempGroupMembers.length === 0) return;

            let groupName = document.getElementById('group-name-input').value.trim();
            if (!groupName) {
                const memberNames = tempGroupMembers.map(id => {
                    const f = window.imData.friends.find(x => x.id === id);
                    return f ? f.nickname : '';
                }).filter(Boolean);
                groupName = memberNames.join(', ');
                if (groupName.length > 20) groupName = groupName.substring(0, 20) + '...';
            }

            const img = document.getElementById('group-avatar-img');
            const avatarUrl = (img && img.style.display === 'block') ? img.src : null;

            const group = window.imApp.normalizeFriendData({
                id: 'group_' + Date.now(),
                type: 'group',
                realName: groupName,
                nickname: groupName,
                signature: 'Group Chat',
                persona: '',
                avatarUrl: avatarUrl,
                members: [...tempGroupMembers],
                messages: [],
                chatBg: null,
                customCssEnabled: false,
                customCss: '',
                isPinned: false,
                memory: window.imApp.createDefaultMemory()
            });

            const saved = window.imApp.commitFriendsChange
                ? await window.imApp.commitFriendsChange(() => {
                    window.imData.friends.push(group);
                }, { silent: true })
                : false;

            if (!saved) {
                if (window.showToast) window.showToast('创建群聊保存失败');
                return;
            }

            renderGroupsList();
            closeView(createGroupSheet);

            if (window.showToast) {
                window.showToast('Created a group', 'Groups can have:\n✓ Up to 200,000 members\n✓ Persistent chat history\n✓ Public links such as t.me/title\n✓ Admins with different rights', 3000);
            }
        });
    }

    window.imApp.renderGroupsList = renderGroupsList;
    renderGroupsList();

    if (groupDetailsSheet) {
        groupDetailsSheet.addEventListener('click', (e) => {
            if (e.target === groupDetailsSheet) closeView(groupDetailsSheet);
        });
    }

    if (groupSummaryEnabledToggle && groupSummaryBody && groupSummaryHeader) {
        groupSummaryEnabledToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                groupSummaryBody.style.display = 'block';
                groupSummaryHeader.style.borderRadius = '20px 20px 0 0';
                groupSummaryHeader.style.borderBottom = '1px solid #e5e5ea';
            } else {
                groupSummaryBody.style.display = 'none';
                groupSummaryHeader.style.borderRadius = '20px';
                groupSummaryHeader.style.borderBottom = 'none';
            }
        });
    }

    if (groupBotEnabledToggle) {
        groupBotEnabledToggle.addEventListener('change', async (e) => {
            if (currentViewingGroup) {
                const previousValue = !!currentViewingGroup.botEnabled;
                const nextValue = e.target.checked;
                const saved = await commitCurrentGroupChange((targetGroup) => {
                    targetGroup.botEnabled = nextValue;
                }, { silent: true });

                if (!saved) {
                    e.target.checked = previousValue;
                    if (window.showToast) window.showToast('群bot设置保存失败');
                    return;
                }

                if (window.imApp.openGroupDetails) {
                    window.imApp.openGroupDetails(currentViewingGroup);
                }
            }
        });
    }

    if (groupEditSheet) {
        groupEditSheet.addEventListener('click', (e) => {
            if (e.target === groupEditSheet) closeView(groupEditSheet);
        });
    }

    if (groupContextSettingsSheet) {
        groupContextSettingsSheet.addEventListener('click', (e) => {
            if (e.target === groupContextSettingsSheet) closeView(groupContextSettingsSheet);
        });
    }

    if (groupDetailsEditBtn) {
        groupDetailsEditBtn.addEventListener('click', () => {
            openGroupEditSheet();
        });
    }

    if (groupDetailsSettingsBtn) {
        groupDetailsSettingsBtn.addEventListener('click', () => {
            openGroupContextSettingsSheet();
        });
    }

    if (groupDetailsMoreBtn) {
        groupDetailsMoreBtn.addEventListener('click', () => {
            if (groupMoreSheet) {
                if (window.openView) window.openView(groupMoreSheet);
                else {
                    groupMoreSheet.style.display = 'flex';
                    setTimeout(() => { groupMoreSheet.style.opacity = '1'; }, 10);
                }
            }
        });
    }

    if (groupOverviewBtn) {
        groupOverviewBtn.addEventListener('click', () => {
            if (window.showToast) window.showToast('群总览功能开发中');
            closeView(groupMoreSheet);
        });
    }

    let selectedGroupCallMembers = [];

    function renderGroupCallInviteList() {
        if (!groupCallMembersList || !currentViewingGroup) return;
        groupCallMembersList.innerHTML = '';
        
        const allMembers = [ ...currentViewingGroup.members ];
        
        allMembers.forEach((memberId, index) => {
            const friend = window.imData.friends.find(f => f.id === memberId);
            if (!friend) return;

            const isSelected = selectedGroupCallMembers.includes(friend.id);
            const item = document.createElement('div');
            item.className = 'group-detail-member-item';
            item.style.cssText = `padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: ${index === allMembers.length - 1 ? 'none' : '1px solid #f2f2f7'}; cursor: pointer;`;

            const avatarHtml = friend.avatarUrl
                ? `<img src="${friend.avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">`
                : (friend.type === 'npc' ? `<i class="fas fa-robot"></i>` : `<i class="fas fa-user"></i>`);

            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #e5e5ea; display: flex; justify-content: center; align-items: center; color: #8e8e93; overflow: hidden;">
                        ${avatarHtml}
                    </div>
                    <div style="font-size: 16px; font-weight: 500; color: #000;">${friend.nickname}</div>
                </div>
                <div style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid ${isSelected ? '#34c759' : '#c7c7cc'}; background: ${isSelected ? '#34c759' : 'transparent'}; display: flex; justify-content: center; align-items: center; color: #fff; font-size: 12px;">
                    ${isSelected ? '<i class="fas fa-check"></i>' : ''}
                </div>
            `;

            item.addEventListener('click', () => {
                if (isSelected) {
                    selectedGroupCallMembers = selectedGroupCallMembers.filter(id => id !== friend.id);
                } else {
                    selectedGroupCallMembers.push(friend.id);
                }
                renderGroupCallInviteList();
            });

            groupCallMembersList.appendChild(item);
        });
        
        if (groupCallStartBtn) {
            if (selectedGroupCallMembers.length > 0) {
                groupCallStartBtn.style.opacity = '1';
                groupCallStartBtn.style.pointerEvents = 'auto';
            } else {
                groupCallStartBtn.style.opacity = '0.5';
                groupCallStartBtn.style.pointerEvents = 'none';
            }
        }
    }

    if (groupCallBtn) {
        groupCallBtn.addEventListener('click', () => {
            if (!currentViewingGroup) return;
            
            closeView(groupMoreSheet);
            closeView(document.getElementById('group-details-sheet'));
            
            selectedGroupCallMembers = [...currentViewingGroup.members];
            renderGroupCallInviteList();
            
            if (window.openView) window.openView(groupCallInviteSheet);
        });
    }

    if (groupCallStartBtn) {
        groupCallStartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (
                !groupCallInviteSheet ||
                !groupCallInviteSheet.classList.contains('active') ||
                window.getComputedStyle(groupCallInviteSheet).pointerEvents === 'none'
            ) {
                return;
            }

            if (!currentViewingGroup || selectedGroupCallMembers.length === 0) return;
            closeView(groupCallInviteSheet);
            
            if (window.imChat && window.imChat.openGroupVoiceCall) {
                window.imChat.openGroupVoiceCall(currentViewingGroup, selectedGroupCallMembers);
            }
        });
    }

    const clearGroupChatHistoryBtn = document.getElementById('clear-group-chat-history-btn');
    if (clearGroupChatHistoryBtn) {
        clearGroupChatHistoryBtn.addEventListener('click', async () => {
            if (!currentViewingGroup) return;
            window.showCustomModal({
                title: '清空聊天记录',
                message: `确定要清空群聊 "${currentViewingGroup.nickname}" 的聊天记录吗？此操作不可恢复。`,
                confirmText: '清空',
                isDestructive: true,
                onConfirm: async () => {
                    const success = await window.imApp.resetFriendMessages(currentViewingGroup.id);
                    if (success) {
                        if (window.showToast) window.showToast('聊天记录已清空');
                        if (window.imApp.openChatTab) window.imApp.openChatTab(currentViewingGroup);
                    }
                }
            });
        });
    }

    const leaveGroupChatBtn = document.getElementById('leave-group-chat-btn');
    if (leaveGroupChatBtn) {
        leaveGroupChatBtn.addEventListener('click', async () => {
            if (!currentViewingGroup) return;
            window.showCustomModal({
                title: '退出群聊',
                message: `确定要退出群聊 "${currentViewingGroup.nickname}" 吗？`,
                confirmText: '退出',
                isDestructive: true,
                onConfirm: async () => {
                    await window.imApp.appendFriendMessage(currentViewingGroup.id, {
                        id: `sys-${Date.now()}`,
                        role: 'system',
                        content: '你已退出群聊',
                        timestamp: Date.now()
                    });
                    if (window.showToast) window.showToast('已退出群聊');
                    window.closeView(document.getElementById('group-context-settings-sheet'));
                    window.closeView(document.getElementById('group-details-sheet'));
                    if (window.imData.currentActiveFriend && window.imData.currentActiveFriend.id === currentViewingGroup.id) {
                        window.imData.currentActiveFriend = null;
                        if (window.imChat && window.imChat.updateChatsView) {
                            window.imChat.updateChatsView();
                        }
                    }
                    if (window.imApp.openChatTab) window.imApp.openChatTab(currentViewingGroup);
                }
            });
        });
    }

    const dismissGroupChatBtn = document.getElementById('dismiss-group-chat-btn');
    if (dismissGroupChatBtn) {
        dismissGroupChatBtn.addEventListener('click', async () => {
            if (!currentViewingGroup) return;
            window.showCustomModal({
                title: '解散群聊',
                message: `确定要解散群聊 "${currentViewingGroup.nickname}" 吗？所有相关数据将被删除且不可恢复。`,
                confirmText: '解散',
                isDestructive: true,
                onConfirm: async () => {
                    const saved = await window.imApp.commitFriendsChange(() => {
                        window.imData.friends = window.imData.friends.filter(f => String(f.id) !== String(currentViewingGroup.id));
                    }, { silent: true });
                    
                    if (saved) {
                        if (window.imStorage && window.imStorage.deleteFriend) {
                            await window.imStorage.deleteFriend(currentViewingGroup.id);
                        }
                        if (window.showToast) window.showToast('群聊已解散');
                        window.closeView(document.getElementById('group-context-settings-sheet'));
                        window.closeView(document.getElementById('group-details-sheet'));
                        const chatInterface = document.getElementById(`chat-interface-${currentViewingGroup.id}`);
                        if (chatInterface) {
                            chatInterface.remove();
                        }
                        if (window.imData.currentActiveFriend && window.imData.currentActiveFriend.id === currentViewingGroup.id) {
                            window.imData.currentActiveFriend = null;
                            if (window.imChat && window.imChat.updateChatsView) {
                                window.imChat.updateChatsView();
                            }
                        }
                        currentViewingGroup = null;
                        if (window.imApp.renderGroupsList) window.imApp.renderGroupsList();
                    }
                }
            });
        });
    }

    if (confirmGroupEditBtn) {
        confirmGroupEditBtn.addEventListener('click', async () => {
            if (!currentViewingGroup) return;
            const newName = groupEditNameInput ? groupEditNameInput.value.trim() : '';
            if (newName) {
                const saved = await commitCurrentGroupChange((targetGroup) => {
                    targetGroup.nickname = newName;
                    targetGroup.realName = newName;
                }, { silent: true });

                if (!saved) {
                    if (window.showToast) window.showToast('群聊名称保存失败');
                    return;
                }

                const nameEl = document.getElementById('group-details-name');
                if (nameEl) nameEl.textContent = newName;

                const chatNameEl = document.getElementById('active-chat-name');
                const groupChatHeaderEl = document.getElementById('active-chat-header');

                if (window.imData.currentActiveFriend && window.imData.currentActiveFriend.id === currentViewingGroup.id) {
                    if (chatNameEl) {
                        chatNameEl.textContent = newName;
                    }
                    if (groupChatHeaderEl) {
                        const nameDiv = groupChatHeaderEl.querySelector('.ins-chat-name');
                        if (nameDiv) nameDiv.textContent = newName;
                    }
                }

                renderGroupsList();
            }
            closeView(groupEditSheet);
        });
    }

    if (confirmGroupContextBtn) {
        confirmGroupContextBtn.addEventListener('click', async () => {
            if (!currentViewingGroup) return;

            const enabled = !!(groupContextEnabledToggle && groupContextEnabledToggle.checked);
            let limit = groupContextLimitInput ? Number(groupContextLimitInput.value) : 100;

            if (!Number.isFinite(limit) || limit <= 0) {
                limit = 100;
            }

            limit = Math.max(1, Math.floor(limit));

            if (groupContextLimitInput) {
                groupContextLimitInput.value = limit;
            }

            const sumEnabled = !!(groupSummaryEnabledToggle && groupSummaryEnabledToggle.checked);
            let sumLimit = groupSummaryLimitInput ? Number(groupSummaryLimitInput.value) : 100;
            if (!Number.isFinite(sumLimit) || sumLimit <= 0) sumLimit = 100;
            sumLimit = Math.max(1, Math.floor(sumLimit));
            const sumPrompt = groupSummaryPromptInput ? groupSummaryPromptInput.value.trim() : '';

            const saved = await commitCurrentGroupChange((targetGroup) => {
                targetGroup.memory = targetGroup.memory || window.imApp.createDefaultMemory();
                targetGroup.memory.context = targetGroup.memory.context || {};
                targetGroup.memory.summary = targetGroup.memory.summary || {};
                targetGroup.memory.context.enabled = enabled;
                targetGroup.memory.context.limit = limit;
                targetGroup.memory.summary.enabled = sumEnabled;
                targetGroup.memory.summary.limit = sumLimit;
                targetGroup.memory.summary.prompt = sumPrompt;
            }, { silent: true });

            if (!saved) {
                if (window.showToast) window.showToast('群上下文设置保存失败');
                return;
            }

            closeView(groupContextSettingsSheet);
            if (window.showToast) window.showToast('设置已保存');
        });
    }

    if (groupBgUploadIcon && groupBgUpload) {
        groupBgUploadIcon.addEventListener('click', () => {
            groupBgUpload.click();
        });
        groupBgUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && currentViewingGroup) {
                try {
                    const nextBg = window.imApp.compressImageFile
                        ? await window.imApp.compressImageFile(file, {
                            maxWidth: 1280,
                            maxHeight: 1280,
                            mimeType: 'image/jpeg',
                            quality: 0.82
                        })
                        : await window.imApp.readFileAsDataUrl(file);

                    const saved = await commitCurrentGroupChange((targetGroup) => {
                        targetGroup.chatBg = nextBg;
                    }, { silent: true });

                    if (!saved) {
                        if (window.showToast) window.showToast('群聊背景保存失败');
                        return;
                    }

                    if (window.imData.currentActiveFriend && window.imData.currentActiveFriend.id === currentViewingGroup.id) {
                        if (window.imApp.applyFriendBg) window.imApp.applyFriendBg(currentViewingGroup);
                    }
                    if (window.showToast) window.showToast('群聊背景已更新');
                } catch (error) {
                    console.error('Failed to process group background', error);
                    if (showToast) showToast('群背景处理失败');
                }
            }
            e.target.value = '';
        });
    }

    if (groupBgResetIcon) {
        groupBgResetIcon.addEventListener('click', async () => {
            if (currentViewingGroup) {
                const saved = await commitCurrentGroupChange((targetGroup) => {
                    targetGroup.chatBg = null;
                }, { silent: true });

                if (!saved) {
                    if (window.showToast) window.showToast('群聊背景重置失败');
                    return;
                }

                if (window.imData.currentActiveFriend && window.imData.currentActiveFriend.id === currentViewingGroup.id) {
                    if (window.imApp.applyFriendBg) window.imApp.applyFriendBg(currentViewingGroup);
                }
                if (window.showToast) window.showToast('群聊背景已重置');
            }
        });
    }

    const groupAvatarUploadBtn = document.getElementById('group-details-avatar-upload-btn');
    const groupAvatarInput = document.getElementById('group-details-avatar-input');
    if (groupAvatarUploadBtn && groupAvatarInput) {
        groupAvatarUploadBtn.addEventListener('click', () => {
            groupAvatarInput.click();
        });

        groupAvatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && currentViewingGroup) {
                try {
                    const newUrl = window.imApp.compressImageFile
                        ? await window.imApp.compressImageFile(file, {
                            maxWidth: 256,
                            maxHeight: 256,
                            mimeType: 'image/jpeg',
                            quality: 0.8
                        })
                        : await window.imApp.readFileAsDataUrl(file);

                    const saved = await commitCurrentGroupChange((targetGroup) => {
                        targetGroup.avatarUrl = newUrl;
                    }, { silent: true });

                    if (!saved) {
                        if (window.showToast) window.showToast('群头像保存失败');
                        return;
                    }

                    const avatarImg = document.getElementById('group-details-avatar-img');
                    const avatarText = document.getElementById('group-details-avatar-text');

                    if (avatarImg) {
                        avatarImg.src = newUrl;
                        avatarImg.style.display = 'block';
                    }
                    if (avatarText) avatarText.style.display = 'none';

                    const latestGroup = (window.imData.friends || []).find(item => String(item.id) === String(currentViewingGroup.id)) || currentViewingGroup;
                    currentViewingGroup = latestGroup;

                    if (window.imData.currentActiveFriend && String(window.imData.currentActiveFriend.id) === String(currentViewingGroup.id)) {
                        window.imData.currentActiveFriend = latestGroup;
                    }

                    if (window.imChat && window.imChat.refreshGroupHeaderAvatar) {
                        window.imChat.refreshGroupHeaderAvatar(latestGroup);
                    }

                    renderGroupsList();
                    if (window.imChat && window.imChat.renderChatsList) {
                        window.imChat.renderChatsList();
                    }
                    if (window.showToast) window.showToast('群头像已更新');
                } catch (error) {
                    console.error('Failed to process group details avatar', error);
                    if (showToast) showToast('群头像处理失败');
                }
            }
            e.target.value = '';
        });
    }

    if (groupAddMemberBtn) {
        groupAddMemberBtn.addEventListener('click', () => {
            if (!currentViewingGroup) return;
            openGroupAddMemberSheet();
        });
    }

    if (groupAddMemberSheet) {
        groupAddMemberSheet.addEventListener('click', (e) => {
            if (e.target === groupAddMemberSheet) closeView(groupAddMemberSheet);
        });
    }
});
