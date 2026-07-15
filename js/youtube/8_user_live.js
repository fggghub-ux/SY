// === User Live Setup & Interface ===
    const startLiveOptionBtn = ytCreateSheet ? ytCreateSheet.querySelectorAll('.yt-create-bubble-btn')[0] : null;
    
    const userLiveSetupSheet = document.getElementById('yt-user-live-setup-sheet');
    const startUserLiveBtn = document.getElementById('start-user-live-btn');
    const userLiveView = document.getElementById('yt-user-live-view');
    const userLiveBackBtn = document.getElementById('yt-user-live-back-btn');
    const userLiveVideoArea = document.getElementById('yt-user-live-video-area');

    let userLiveBgUrl = '';
    const userLiveBgUpload = document.getElementById('yt-user-live-bg-upload');
    const userLiveBgBtn = document.getElementById('yt-user-live-bg-btn');
    const userLiveBgImg = document.getElementById('yt-user-live-bg-img');

    function getCurrentYtLiveUser() {
        if (typeof window.getYtEffectiveUserState === 'function') {
            return window.getYtEffectiveUserState() || {};
        }
        return ytUserState || {};
    }

    function stopUserLiveControlEvent(e) {
        if (!e) return;
        e.stopPropagation();
    }

    if (userLiveBgBtn && userLiveBgUpload) {
        userLiveBgBtn.addEventListener('click', (e) => {
            stopUserLiveControlEvent(e);
            userLiveBgUpload.click();
        });
        userLiveBgUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (window.compressImage) {
                        window.compressImage(ev.target.result, 900, 600, (compressedUrl) => {
                            userLiveBgUrl = compressedUrl;
                            if(userLiveBgImg) {
                                userLiveBgImg.src = userLiveBgUrl;
                                userLiveBgImg.style.display = 'block';
                            }
                            const liveDisplay = document.getElementById('yt-user-live-bg-display');
                            if(liveDisplay) {
                                liveDisplay.src = userLiveBgUrl;
                            }
                        });
                    } else {
                        userLiveBgUrl = ev.target.result;
                        if(userLiveBgImg) {
                            userLiveBgImg.src = userLiveBgUrl;
                            userLiveBgImg.style.display = 'block';
                        }
                        const liveDisplay = document.getElementById('yt-user-live-bg-display');
                        if(liveDisplay) {
                            liveDisplay.src = userLiveBgUrl;
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (startLiveOptionBtn && userLiveSetupSheet) {
        startLiveOptionBtn.addEventListener('click', () => {
            if(ytCreateSheet) ytCreateSheet.classList.remove('active');
            userLiveSetupSheet.classList.add('active');
        });
        userLiveSetupSheet.addEventListener('mousedown', (e) => {
            if(e.target === userLiveSetupSheet) userLiveSetupSheet.classList.remove('active');
        });
    }

    if (startUserLiveBtn && userLiveView) {
        startUserLiveBtn.addEventListener('click', () => {
            if (typeof window.validateUserLiveSelectedGuest === 'function') {
                window.validateUserLiveSelectedGuest();
            }
            const titleInput = document.getElementById('yt-user-live-title-input');
            const title = titleInput && titleInput.value ? titleInput.value : '我的直播间';

            document.getElementById('yt-user-live-title-display').textContent = title;
            if(userLiveBgUrl) {
                document.getElementById('yt-user-live-bg-display').src = userLiveBgUrl;
            } else {
                document.getElementById('yt-user-live-bg-display').src = 'https://picsum.photos/900/600';
            }

            userLiveSetupSheet.classList.remove('active');
            
            // Clean up old state
            document.getElementById('yt-user-live-chat-container').innerHTML = '';
            document.getElementById('yt-user-live-bubbles-container').innerHTML = '';
            document.getElementById('yt-user-live-alert-container').innerHTML = '';
            userLiveHistory = [];

            if (typeof window.openYtUserLiveView === 'function') {
                window.openYtUserLiveView();
                return;
            }
            userLiveView.classList.add('active');
        });
    }

    if (userLiveBackBtn) {
        userLiveBackBtn.addEventListener('click', () => {
            if (isUserLiveLotteryActive()) {
                if (window.showToast) window.showToast('抽奖进行中，请等待开奖后再结束直播');
                renderUserLiveLotteryStatus(true);
                return;
            }
            window.showCustomModal({
                title: '结束直播',
                message: '确定要结束当前的直播吗？',
                confirmText: '结束',
                cancelText: '继续',
                isDestructive: true,
                onConfirm: () => {
                    if (typeof window.releaseYtChatKeyboardLock === 'function') window.releaseYtChatKeyboardLock();
                    userLiveView.classList.remove('active');
                    
                    document.getElementById('yt-summary-views').textContent = userLiveTotalViews;
                    document.getElementById('yt-summary-hot').textContent = userLiveMaxHot;
                    document.getElementById('yt-summary-subs').textContent = '+' + userLiveNewSubs;
                    document.getElementById('yt-summary-sc').textContent = '￥' + userLiveTotalSC;
                    
                    if(userLiveSummarySheet) userLiveSummarySheet.classList.add('active');
                }
            });
        });
    }

    // Data Center Logic
    window.renderDataCenter = function() {
        const dataCenterBtn = document.getElementById('yt-data-center-btn');
        const dataCenterSheet = document.getElementById('yt-data-center-sheet');
        const ytWithdrawBtn = document.getElementById('yt-withdraw-btn');
        const dcTotalViews = document.getElementById('dc-total-views');
        const dcTotalSc = document.getElementById('dc-total-sc');
        const dcTotalSubs = document.getElementById('dc-total-subs');
        const dcTotalCommission = document.getElementById('dc-total-commission');
        const dcTotalRevenue = document.getElementById('dc-total-revenue');
        const dcOffersList = document.getElementById('dc-offers-list');

        if (!channelState.dataCenter) {
            channelState.dataCenter = { views: 0, sc: 0, subs: 0, commission: 0 };
        }
        if (channelState.dataCenter.commission === undefined) channelState.dataCenter.commission = 0;

        if (dcTotalViews) dcTotalViews.textContent = channelState.dataCenter.views || 0;
        if (dcTotalSc) dcTotalSc.textContent = (channelState.dataCenter.sc || 0).toFixed(2);
        if (dcTotalSubs) dcTotalSubs.textContent = channelState.dataCenter.subs || 0;
        if (dcTotalCommission) dcTotalCommission.textContent = (channelState.dataCenter.commission || 0).toFixed(2);
        
        const total = parseFloat(channelState.dataCenter.sc || 0) + parseFloat(channelState.dataCenter.commission || 0);
        if (dcTotalRevenue) dcTotalRevenue.textContent = total.toFixed(2);
        
        if (ytWithdrawBtn) {
            if (total > 0) {
                ytWithdrawBtn.style.opacity = '1';
                ytWithdrawBtn.style.pointerEvents = 'auto';
            } else {
                ytWithdrawBtn.style.opacity = '0.5';
                ytWithdrawBtn.style.pointerEvents = 'none';
            }
        }

        if (dcOffersList) {
            dcOffersList.innerHTML = '';
            let hasOffers = false;

            mockSubscriptions.forEach(sub => {
                if (sub.dmHistory) {
                    sub.dmHistory.forEach(msg => {
                        if (msg.isOffer && msg.offerStatus === 'accepted') {
                            hasOffers = true;
                            const el = document.createElement('div');
                            el.className = 'settings-item';
                            el.style.padding = '12px 16px';
                            el.style.cursor = 'pointer';

                            const priceStr = msg.offerData.price || '0';
                            const avatarUrl = typeof resolveYtChannelAvatar === 'function'
                                ? resolveYtChannelAvatar(sub)
                                : (sub.avatar || 'https://picsum.photos/80/80?grayscale');

                            el.innerHTML = `
                                <div style="width: 36px; height: 36px; border-radius: 50%; overflow: hidden; margin-right: 12px; flex-shrink: 0;">
                                    <img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                                </div>
                                <div style="flex: 1; overflow: hidden;">
                                    <div style="font-weight: 600; font-size: 15px; color: #000; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${msg.offerData.title || '商单任务'}</div>
                                    <div style="font-size: 12px; color: #8e8e93; margin-top: 2px;">来自: ${sub.name}</div>
                                </div>
                                <div style="color: #ff3b30; font-weight: 600; font-size: 15px;">${priceStr}</div>
                            `;

                            el.addEventListener('click', () => {
                                // Set global current sub so the detail sheet context works
                                currentSubChannelData = sub;
                                openOfferDetailSheet(msg);
                            });

                            dcOffersList.appendChild(el);
                        }
                    });
                }
            });

            if (!hasOffers) {
                dcOffersList.innerHTML = '<div style="padding: 16px; text-align: center; color: #8e8e93; font-size: 14px;">暂无进行中的商单</div>';
            }
        }
        
        // Hide sheet handler
        if (dataCenterSheet && !dataCenterSheet.dataset.bound) {
            dataCenterSheet.dataset.bound = 'true';
            dataCenterSheet.addEventListener('mousedown', (e) => {
                if (e.target === dataCenterSheet) dataCenterSheet.classList.remove('active');
            });
        }
    };
    
    // Bind initial load just in case
    setTimeout(() => {
        const dataCenterBtn = document.getElementById('yt-data-center-btn');
        const dataCenterSheet = document.getElementById('yt-data-center-sheet');
        if (dataCenterBtn && dataCenterSheet && !dataCenterBtn.dataset.bound) {
            dataCenterBtn.dataset.bound = 'true';
            dataCenterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.renderDataCenter();
                dataCenterSheet.classList.add('active');
            });
        }
    }, 500);

    const ytWithdrawBtn = document.getElementById('yt-withdraw-btn');
    if (ytWithdrawBtn) {
        ytWithdrawBtn.addEventListener('click', () => {
            const total = parseFloat(channelState.dataCenter.sc || 0) + parseFloat(channelState.dataCenter.commission || 0);
            if (total <= 0) return;

            if (window.showCustomModal) {
                window.showCustomModal({
                    title: '收益提现',
                    message: `确认将 YouTube 创作者收益 ￥${total.toFixed(2)} 提现到 Pay 钱包吗？`,
                    confirmText: '确认提现',
                    cancelText: '取消',
                    onConfirm: () => {
                        // 重置收益
                        channelState.dataCenter.sc = 0;
                        channelState.dataCenter.commission = 0;
                        saveYoutubeData();
                        renderDataCenter();

                        // 同步到 Pay App
                        if (window.addPayTransaction) {
                            window.addPayTransaction(total, 'YouTube 创作者收益', 'income');
                        }

                        if(window.showToast) window.showToast('提现成功，已存入 Pay 钱包');
                    }
                });
            } else {
                if (confirm(`确认提现 ￥${total.toFixed(2)} 吗？`)) {
                    channelState.dataCenter.sc = 0;
                    channelState.dataCenter.commission = 0;
                    saveYoutubeData();
                    renderDataCenter();
                    if (window.addPayTransaction) window.addPayTransaction(total, 'YouTube 创作者收益', 'income');
                    alert('提现成功！');
                }
            }
        });
    }

    // User Live Chat & API interaction
    let userLiveHistory = [];
    let userLiveComments = [];
    let userLiveTotalSC = 0;
    let userLiveTotalViews = 0;
    let userLiveMaxHot = 0;
    let userLiveNewSubs = 0;
    let userLiveSessionId = null;

    const userLiveChatInput = document.getElementById('yt-user-live-chat-input');
    const userLiveChatSend = document.getElementById('yt-user-live-chat-send');
    const userLiveBubblesContainer = document.getElementById('yt-user-live-bubbles-container');
    const userLiveChatContainer = document.getElementById('yt-user-live-chat-container');
    const userLiveTriggerApiBtn = document.getElementById('yt-user-live-trigger-api-btn');
    const userLiveMinimizeBtn = document.getElementById('yt-user-live-minimize-btn');
    const userLiveLotteryBtn = document.getElementById('yt-user-live-lottery-btn');
    const userLiveLotterySheet = document.getElementById('yt-user-live-lottery-sheet');
    const userLiveLotteryClose = document.getElementById('yt-user-live-lottery-close');
    const userLiveLotteryDuration = document.getElementById('yt-user-live-lottery-duration');
    const userLiveLotteryPrizes = document.getElementById('yt-user-live-lottery-prizes');
    const userLiveLotteryAddPrize = document.getElementById('yt-user-live-lottery-add-prize');
    const userLiveLotteryConfirm = document.getElementById('yt-user-live-lottery-confirm');
    const userLiveLotteryStatus = document.getElementById('yt-user-live-lottery-status');
    const userLiveLotteryParticipants = document.getElementById('yt-user-live-lottery-participants');
    const userLiveLotteryCountdown = document.getElementById('yt-user-live-lottery-countdown');
    const userLiveLotteryResultModal = document.getElementById('yt-user-live-lottery-result-modal');
    const userLiveLotteryResultSummary = document.getElementById('yt-user-live-lottery-result-summary');
    const userLiveLotteryResultList = document.getElementById('yt-user-live-lottery-result-list');
    const userLiveLotteryResultClose = document.getElementById('yt-user-live-lottery-result-close');
    const userLiveLotteryResultConfirm = document.getElementById('yt-user-live-lottery-result-confirm');
    let userLiveLotteryTimer = null;
    let isFinalizingUserLiveLottery = false;

    function positionUserLiveLotteryStatus() {
        if (!userLiveLotteryStatus || !userLiveView) return;
        const chatShell = userLiveView.querySelector('.yt-user-live-chat-shell');
        if (!chatShell) return;
        const viewRect = userLiveView.getBoundingClientRect();
        const chatRect = chatShell.getBoundingClientRect();
        const chatHeightFromBottom = Math.max(0, viewRect.bottom - chatRect.top);
        userLiveLotteryStatus.style.bottom = `${Math.round(chatHeightFromBottom + 8)}px`;
    }

    function escapeYtUserLiveHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]));
    }

    function getActiveUserLiveLottery() {
        const lottery = channelState?.activeUserLive?.lottery;
        return lottery && typeof lottery === 'object' ? lottery : null;
    }

    function isUserLiveLotteryActive() {
        return getActiveUserLiveLottery()?.status === 'active';
    }

    function getUserLiveTitle() {
        const titleInput = document.getElementById('yt-user-live-title-input');
        return titleInput && titleInput.value ? titleInput.value : '我的直播间';
    }

    function getUserLiveTopic() {
        const topicInput = document.getElementById('yt-user-live-topic-input');
        return topicInput && topicInput.value ? topicInput.value : '';
    }

    function getSelectedUserLiveGuest() {
        return typeof userLiveSelectedGuest !== 'undefined' ? userLiveSelectedGuest : null;
    }

    function buildActiveUserLiveState(extra = {}) {
        const effectiveYtUser = getCurrentYtLiveUser();
        const totalViews = Number(userLiveTotalViews) || 0;
        return {
            ...(channelState.activeUserLive || {}),
            title: getUserLiveTitle(),
            desc: getUserLiveTopic(),
            views: `${totalViews} 人正在观看`,
            thumbnail: userLiveBgUrl || channelState.activeUserLive?.thumbnail || 'https://picsum.photos/320/180',
            backgroundUrl: userLiveBgUrl || channelState.activeUserLive?.backgroundUrl || '',
            comments: Array.isArray(userLiveComments) ? [...userLiveComments] : [],
            history: Array.isArray(userLiveHistory) ? [...userLiveHistory] : [],
            totalSC: Number(userLiveTotalSC) || 0,
            totalViews,
            maxHot: Number(userLiveMaxHot) || totalViews,
            newSubs: Number(userLiveNewSubs) || 0,
            liveSessionId: userLiveSessionId || channelState.activeUserLive?.liveSessionId || null,
            guest: getSelectedUserLiveGuest(),
            user: {
                name: effectiveYtUser.name || '我',
                avatarUrl: effectiveYtUser.avatarUrl || '',
                subs: effectiveYtUser.subs || '0'
            },
            updatedAt: Date.now(),
            ...extra
        };
    }

    function persistActiveUserLive(extra = {}) {
        if (!channelState) return null;
        channelState.activeUserLive = buildActiveUserLiveState(extra);
        saveYoutubeData();
        return channelState.activeUserLive;
    }

    function getUserLiveLotteryPrizeName(index) {
        const names = ['一等奖', '二等奖', '三等奖', '四等奖', '五等奖', '六等奖', '七等奖', '八等奖', '九等奖', '十等奖'];
        return names[index] || `奖项${index + 1}`;
    }

    function createDefaultUserLiveLotteryPrize(index = 0) {
        return {
            id: `lottery_prize_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
            name: getUserLiveLotteryPrizeName(index),
            type: 'custom',
            prize: '',
            amount: 0,
            winnerCount: 1
        };
    }

    function renderUserLiveLotteryPrizeRows(prizes = null) {
        if (!userLiveLotteryPrizes) return;
        const source = Array.isArray(prizes) && prizes.length > 0 ? prizes : [createDefaultUserLiveLotteryPrize(0)];
        userLiveLotteryPrizes.innerHTML = '';
        source.slice(0, 10).forEach((prize, index) => {
            const row = document.createElement('div');
            row.className = 'yt-user-live-lottery-prize-row';
            row.dataset.prizeId = prize.id || createDefaultUserLiveLotteryPrize(index).id;
            const prizeType = prize.type === 'cash' ? 'cash' : 'custom';
            row.innerHTML = `
                <input class="yt-lottery-prize-name" type="text" maxlength="20" aria-label="奖项名称" value="${escapeYtUserLiveHtml(prize.name || getUserLiveLotteryPrizeName(index))}">
                <select class="yt-lottery-prize-type" aria-label="奖品类型">
                    <option value="cash"${prizeType === 'cash' ? ' selected' : ''}>金额</option>
                    <option value="custom"${prizeType === 'custom' ? ' selected' : ''}>自定义</option>
                </select>
                <input class="yt-lottery-prize-count" type="number" min="1" max="100" step="1" inputmode="numeric" aria-label="中奖人数" value="${Math.max(1, Math.min(100, Math.round(Number(prize.winnerCount) || 1)))}">
                <button type="button" class="yt-user-live-lottery-prize-remove" aria-label="删除奖项"><i class="fas fa-minus-circle"></i></button>
                <div class="yt-lottery-prize-value">
                    <label class="yt-lottery-prize-amount-wrap">
                        <span>¥</span>
                        <input class="yt-lottery-prize-amount" type="number" min="0.01" max="1000000" step="0.01" inputmode="decimal" aria-label="每位中奖者金额" placeholder="每人金额" value="${Number(prize.amount) > 0 ? Number(prize.amount) : ''}">
                    </label>
                    <input class="yt-lottery-prize-content" type="text" maxlength="60" aria-label="自定义奖品内容" placeholder="填写自定义奖品" value="${escapeYtUserLiveHtml(prizeType === 'custom' ? (prize.prize || '') : '')}">
                </div>
            `;
            const typeSelect = row.querySelector('.yt-lottery-prize-type');
            const syncPrizeValueInput = () => {
                const isCash = typeSelect?.value === 'cash';
                row.querySelector('.yt-lottery-prize-amount-wrap')?.classList.toggle('is-visible', isCash);
                row.querySelector('.yt-lottery-prize-content')?.classList.toggle('is-visible', !isCash);
            };
            typeSelect?.addEventListener('change', syncPrizeValueInput);
            syncPrizeValueInput();
            const removeButton = row.querySelector('.yt-user-live-lottery-prize-remove');
            if (removeButton) {
                removeButton.addEventListener('click', () => {
                    if (userLiveLotteryPrizes.children.length <= 1) {
                        if (window.showToast) window.showToast('至少保留一个奖项');
                        return;
                    }
                    row.remove();
                });
            }
            userLiveLotteryPrizes.appendChild(row);
        });
    }

    function collectUserLiveLotteryConfig() {
        const durationSec = Math.round(Number(userLiveLotteryDuration?.value));
        if (!Number.isFinite(durationSec) || durationSec < 5 || durationSec > 3600) {
            if (window.showToast) window.showToast('开奖时间请输入 5–3600 秒');
            return null;
        }
        const rows = userLiveLotteryPrizes ? Array.from(userLiveLotteryPrizes.querySelectorAll('.yt-user-live-lottery-prize-row')) : [];
        if (rows.length === 0 || rows.length > 10) {
            if (window.showToast) window.showToast('请设置 1–10 个奖项');
            return null;
        }
        const prizes = [];
        let totalCashAmount = 0;
        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            const name = String(row.querySelector('.yt-lottery-prize-name')?.value || '').trim() || getUserLiveLotteryPrizeName(index);
            const type = row.querySelector('.yt-lottery-prize-type')?.value === 'cash' ? 'cash' : 'custom';
            const winnerCount = Math.round(Number(row.querySelector('.yt-lottery-prize-count')?.value));
            if (!Number.isFinite(winnerCount) || winnerCount < 1 || winnerCount > 100) {
                if (window.showToast) window.showToast(`${name}中奖人数需为 1–100`);
                return null;
            }
            let prize = '';
            let amount = 0;
            if (type === 'cash') {
                amount = Math.round(Number(row.querySelector('.yt-lottery-prize-amount')?.value) * 100) / 100;
                if (!Number.isFinite(amount) || amount < 0.01 || amount > 1000000) {
                    if (window.showToast) window.showToast(`${name}每人金额需为 ¥0.01–¥1,000,000`);
                    row.querySelector('.yt-lottery-prize-amount')?.focus();
                    return null;
                }
                prize = `¥${amount.toFixed(2)}`;
                totalCashAmount = Math.round((totalCashAmount + amount * winnerCount) * 100) / 100;
            } else {
                prize = String(row.querySelector('.yt-lottery-prize-content')?.value || '').trim();
                if (!prize) {
                    if (window.showToast) window.showToast(`请填写${name}的自定义奖品`);
                    row.querySelector('.yt-lottery-prize-content')?.focus();
                    return null;
                }
            }
            prizes.push({ id: row.dataset.prizeId || createDefaultUserLiveLotteryPrize(index).id, name, type, prize, amount, winnerCount });
        }
        return { durationSec, prizes, totalCashAmount };
    }

    function closeUserLiveLotterySheet() {
        userLiveLotterySheet?.classList.remove('active');
    }

    function formatUserLiveLotteryCountdown(milliseconds) {
        const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function renderUserLiveLotteryStatus(highlight = false) {
        const lottery = getActiveUserLiveLottery();
        if (!userLiveLotteryStatus) return;
        if (!lottery || lottery.status !== 'active') {
            userLiveLotteryStatus.style.display = 'none';
            userLiveLotteryStatus.classList.remove('is-highlighted');
            return;
        }
        userLiveLotteryStatus.style.display = 'flex';
        positionUserLiveLotteryStatus();
        if (userLiveLotteryParticipants) userLiveLotteryParticipants.textContent = String(Array.isArray(lottery.participants) ? lottery.participants.length : 0);
        if (userLiveLotteryCountdown) userLiveLotteryCountdown.textContent = formatUserLiveLotteryCountdown(Number(lottery.endAt) - Date.now());
        if (highlight) {
            userLiveLotteryStatus.classList.remove('is-highlighted');
            void userLiveLotteryStatus.offsetWidth;
            userLiveLotteryStatus.classList.add('is-highlighted');
        }
    }

    function stopUserLiveLotteryTimer() {
        if (userLiveLotteryTimer) clearInterval(userLiveLotteryTimer);
        userLiveLotteryTimer = null;
    }

    function getUserLiveOnlineViewerLimit() {
        const displayValue = Number.parseInt(document.getElementById('yt-user-live-views-display')?.textContent || '', 10);
        return Math.max(0, Math.round(Number(userLiveTotalViews) || displayValue || 0));
    }

    function createSimulatedUserLiveLotteryParticipantName(lottery, sequence) {
        const names = [
            'Liam Carter', 'Emma Wilson', 'Noah Reed', 'Olivia Stone', 'Haruto', 'Aiko',
            'Sakura', 'Min-jun', 'Seo-yeon', 'Camille', 'Lucas Martin', 'Lucía',
            'Mateo', 'Elena Rossi', 'Mia Schmidt', 'Ethan Brooks', 'Yuna', 'Ren'
        ];
        const baseName = names[sequence % names.length];
        const cycle = Math.floor(sequence / names.length);
        return cycle > 0 ? `${baseName} ${cycle + 1}` : baseName;
    }

    function growSimulatedUserLiveLotteryParticipants(lottery) {
        if (!lottery || lottery.status !== 'active') return false;
        const onlineLimit = getUserLiveOnlineViewerLimit();
        if (onlineLimit <= 0) return false;
        lottery.participants = Array.isArray(lottery.participants) ? lottery.participants : [];
        if (lottery.participants.length >= onlineLimit) return false;

        const winnerSlots = (Array.isArray(lottery.prizes) ? lottery.prizes : [])
            .reduce((total, prize) => total + Math.max(0, Math.round(Number(prize?.winnerCount) || 0)), 0);
        if (!Number.isFinite(Number(lottery.simulatedTargetParticipants)) || Number(lottery.simulatedTargetParticipants) <= 0) {
            const ratio = 0.35 + Math.random() * 0.3;
            lottery.simulatedTargetParticipants = Math.min(onlineLimit, Math.max(winnerSlots, Math.round(onlineLimit * ratio)));
        }
        const target = Math.min(onlineLimit, Math.max(lottery.participants.length, Math.round(Number(lottery.simulatedTargetParticipants) || 0)));
        lottery.simulatedTargetParticipants = target;

        const now = Date.now();
        const duration = Math.max(1, Number(lottery.endAt) - Number(lottery.createdAt));
        const progress = Math.max(0, Math.min(1, (now - Number(lottery.createdAt)) / duration));
        const desiredCount = Math.min(onlineLimit, Math.floor(target * Math.min(1, 0.08 + progress * 0.92)));
        if (desiredCount <= lottery.participants.length) return false;
        if (now < Number(lottery.endAt) && now - Number(lottery.lastSimulatedGrowthAt || 0) < 1500) return false;

        const existingNames = new Set(lottery.participants.map(item => String(item?.name || '').trim().toLocaleLowerCase()));
        let sequence = Math.max(0, Math.round(Number(lottery.simulatedNameSequence) || 0));
        while (lottery.participants.length < desiredCount && lottery.participants.length < onlineLimit) {
            let name = createSimulatedUserLiveLotteryParticipantName(lottery, sequence++);
            while (existingNames.has(name.toLocaleLowerCase())) name = createSimulatedUserLiveLotteryParticipantName(lottery, sequence++);
            existingNames.add(name.toLocaleLowerCase());
            lottery.participants.push({ name, joinedAt: now, source: 'frontend-random' });
        }
        lottery.simulatedNameSequence = sequence;
        lottery.lastSimulatedGrowthAt = now;
        persistActiveUserLive({ lottery });
        return true;
    }

    function startUserLiveLotteryTimer() {
        stopUserLiveLotteryTimer();
        const tick = () => {
            const lottery = getActiveUserLiveLottery();
            if (!lottery || lottery.status !== 'active') {
                stopUserLiveLotteryTimer();
                renderUserLiveLotteryStatus();
                return;
            }
            growSimulatedUserLiveLotteryParticipants(lottery);
            renderUserLiveLotteryStatus();
            if (Date.now() >= Number(lottery.endAt)) finalizeUserLiveLottery();
        };
        tick();
        if (isUserLiveLotteryActive()) userLiveLotteryTimer = setInterval(tick, 500);
    }

    function addUserLiveLotteryParticipant(name, source = 'lottery-api') {
        const lottery = getActiveUserLiveLottery();
        if (!lottery || lottery.status !== 'active') return false;
        const participantName = String(name || '').trim();
        if (!participantName) return false;
        const hostName = String(getCurrentYtLiveUser()?.name || '我').trim().toLocaleLowerCase();
        const normalizedName = participantName.toLocaleLowerCase();
        if (normalizedName === hostName) return false;
        lottery.participants = Array.isArray(lottery.participants) ? lottery.participants : [];
        const onlineLimit = getUserLiveOnlineViewerLimit();
        if (onlineLimit <= 0 || lottery.participants.length >= onlineLimit) return false;
        if (lottery.participants.some(item => String(item?.name || '').trim().toLocaleLowerCase() === normalizedName)) return false;
        lottery.participants.push({ name: participantName, joinedAt: Date.now(), source });
        persistActiveUserLive({ lottery });
        renderUserLiveLotteryStatus();
        return true;
    }

    function shuffleUserLiveLotteryParticipants(participants) {
        const result = [...participants];
        const getRandomIndex = max => {
            if (window.crypto?.getRandomValues) {
                const values = new Uint32Array(1);
                window.crypto.getRandomValues(values);
                return values[0] % max;
            }
            return Math.floor(Math.random() * max);
        };
        for (let index = result.length - 1; index > 0; index--) {
            const swapIndex = getRandomIndex(index + 1);
            [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
        }
        return result;
    }

    function drawUserLiveLotteryWinners(lottery) {
        const pool = shuffleUserLiveLotteryParticipants(Array.isArray(lottery.participants) ? lottery.participants : []);
        const winners = [];
        let cursor = 0;
        (Array.isArray(lottery.prizes) ? lottery.prizes : []).forEach(prize => {
            const count = Math.max(0, Math.round(Number(prize.winnerCount) || 0));
            for (let index = 0; index < count && cursor < pool.length; index++, cursor++) {
                winners.push({
                    prizeId: prize.id,
                    prizeName: prize.name,
                    prize: prize.prize,
                    name: pool[cursor].name
                });
            }
        });
        return winners;
    }

    function renderUserLiveLotteryResult(lottery, shouldOpen = true) {
        if (!lottery || !userLiveLotteryResultList) return;
        const participants = Array.isArray(lottery.participants) ? lottery.participants : [];
        const winners = Array.isArray(lottery.winners) ? lottery.winners : [];
        if (userLiveLotteryResultSummary) {
            userLiveLotteryResultSummary.textContent = `${participants.length} 人参与，共产生 ${winners.length} 位中奖者`;
        }
        userLiveLotteryResultList.innerHTML = '';
        (Array.isArray(lottery.prizes) ? lottery.prizes : []).forEach(prize => {
            const tierWinners = winners.filter(winner => String(winner.prizeId) === String(prize.id));
            const missing = Math.max(0, Number(prize.winnerCount) - tierWinners.length);
            const item = document.createElement('div');
            item.className = 'yt-user-live-lottery-result-tier';
            item.innerHTML = `
                <div style="font-size:14px;font-weight:700;">${escapeYtUserLiveHtml(prize.name)} · ${escapeYtUserLiveHtml(prize.prize)}</div>
                <div class="yt-user-live-lottery-result-names">${tierWinners.length > 0 ? tierWinners.map(winner => escapeYtUserLiveHtml(winner.name)).join('、') : '暂无中奖者'}</div>
                ${missing > 0 ? `<div style="margin-top:5px;color:#ff9500;font-size:12px;">参与人数不足，空缺 ${missing} 个名额</div>` : ''}
            `;
            userLiveLotteryResultList.appendChild(item);
        });
        if (shouldOpen) userLiveLotteryResultModal?.classList.add('active');
    }

    async function requestUserLiveLotteryJson(prompt) {
        if (!window.apiConfig?.endpoint || !window.apiConfig?.apiKey) throw new Error('API_NOT_CONFIGURED');
        let endpoint = window.apiConfig.endpoint.replace(/\/$/, '');
        if (!endpoint.endsWith('/chat/completions')) endpoint = endpoint.endsWith('/v1') ? `${endpoint}/chat/completions` : `${endpoint}/v1/chat/completions`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.apiConfig.apiKey}`
            },
            body: JSON.stringify({
                model: window.apiConfig.model || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.85,
                response_format: { type: 'json_object' }
            })
        });
        if (!response.ok) throw new Error(`API_${response.status}`);
        const data = await response.json();
        const rawText = String(data?.choices?.[0]?.message?.content || '').replace(/```json\n?/gi, '').replace(/```/g, '').trim();
        return sanitizeObj(JSON.parse(rawText));
    }

    function buildUserLiveLotteryLaunchPrompt(lottery) {
        const effectiveUser = getCurrentYtLiveUser();
        return `你正在模拟真实 YouTube 直播间宣布抽奖后的即时评论。\n主播：${effectiveUser.name || '我'}\n主播人设：${effectiveUser.persona || '普通主播'}\n直播标题：${getUserLiveTitle()}\n直播主题：${getUserLiveTopic()}\n开奖剩余时间：${lottery.durationSec} 秒\n奖项：${JSON.stringify(lottery.prizes)}\n\n生成不少于 10 条与本次抽奖直接相关、昵称不重复的短评论。评论者可以报名、期待、讨论奖品或围观；只有明确想参加抽奖的人 participates 才能为 true。至少一半评论必须来自使用英语、日语、韩语、法语、西班牙语等非中文语言的外国观众，外国观众使用符合其语言习惯的昵称和原文；非中文评论必须填写自然准确的简体中文 translationZh，中文评论的 translationZh 为空字符串。\n只返回严格 JSON：{"comments":[{"name":"viewer name","text":"original comment","translationZh":"简体中文翻译或空字符串","participates":true}]}。comments 不少于 10 条，不要 Markdown，不要 emoji。`;
    }

    function buildUserLiveLotteryFollowupPrompt(lottery) {
        const effectiveUser = getCurrentYtLiveUser();
        return `你正在模拟真实 YouTube 直播抽奖开奖后的观众反应。\n主播：${effectiveUser.name || '我'}\n主播人设：${effectiveUser.persona || '普通主播'}\n直播标题：${getUserLiveTitle()}\n直播主题：${getUserLiveTopic()}\n奖项：${JSON.stringify(lottery.prizes)}\n参与人数：${lottery.participants.length}\n中奖结果：${JSON.stringify(lottery.winners)}\n\n生成不少于 10 条短评论，必须同时包含中奖者的惊喜回应、未中奖者的反应和围观观众的祝贺或调侃；不得篡改中奖名单。至少一半评论使用英语、日语、韩语、法语、西班牙语等非中文语言，并使用符合语言地区的外国昵称。所有非中文评论必须填写自然准确的简体中文 translationZh，中文评论的 translationZh 为空字符串。\n此外，每一位实际中奖者都要给主播发送 2 至 5 条连续私信。私信可以谈论本场直播或刚刚获得的奖品，语气要符合中奖后的即时反应。winnerName 必须逐字使用中奖结果中的昵称，不得给未中奖者生成私信；同一中奖者的 messages 数量必须在 2 到 5 条之间。私信若不是中文，translationZh 必须提供自然准确的简体中文；中文私信的 translationZh 为空字符串。\n只返回严格 JSON：{"comments":[{"name":"viewer name","text":"original comment","translationZh":"简体中文翻译或空字符串"}],"winnerDMs":[{"winnerName":"中奖者原昵称","messages":[{"text":"私信原文","translationZh":"简体中文翻译或空字符串"}]}]}。comments 不少于 10 条；每位中奖者必须各有 2 至 5 条 messages；不要 Markdown，不要 emoji。`;
    }

    function normalizeUserLiveLotteryWinnerDmBatches(lottery, rawWinnerDms) {
        const winners = Array.isArray(lottery?.winners) ? lottery.winners : [];
        const winnerNames = [...new Set(winners.map(winner => String(winner?.name || '').trim()).filter(Boolean))];
        if (winnerNames.length === 0) return [];
        const source = Array.isArray(rawWinnerDms) ? rawWinnerDms : [];

        return winnerNames.map(winnerName => {
            const normalizedWinnerName = winnerName.toLocaleLowerCase();
            const batch = source.find(item => String(item?.winnerName || item?.name || '').trim().toLocaleLowerCase() === normalizedWinnerName);
            const messages = (Array.isArray(batch?.messages) ? batch.messages : [])
                .map(message => {
                    if (typeof message === 'string') return { text: message.trim(), translationZh: '' };
                    return {
                        text: String(message?.text || message?.content || '').trim(),
                        translationZh: String(message?.translationZh || '').trim()
                    };
                })
                .filter(message => message.text)
                .slice(0, 5);
            if (messages.length < 2) throw new Error(`TOO_FEW_WINNER_DMS:${winnerName}`);
            return { winnerName, messages };
        });
    }

    function appendUserLiveLotteryWinnerDms(lottery, winnerDmBatches) {
        const lotteryId = String(lottery?.id || '').trim();
        if (!lotteryId || lottery?.winnerDmsAppliedAt) return;
        const now = Date.now();
        winnerDmBatches.forEach((batch, batchIndex) => {
            const normalizedName = batch.winnerName.toLocaleLowerCase();
            let contact = mockSubscriptions.find(sub => String(sub?.name || '').trim().toLocaleLowerCase() === normalizedName && !sub?.isBusiness);
            if (!contact) {
                const contactId = createStableYtChannelId(`lottery-winner-${batch.winnerName}`, 'yt_lottery_winner');
                contact = {
                    id: contactId,
                    name: batch.winnerName,
                    handle: `lottery_${String(contactId).replace(/[^a-zA-Z0-9_]/g, '').slice(-24)}`,
                    avatar: `https://picsum.photos/seed/${encodeURIComponent(contactId)}/80/80?grayscale`,
                    desc: '直播抽奖观众',
                    isFriend: false,
                    isBusiness: false,
                    isSubscribed: false,
                    dmHistory: []
                };
                mockSubscriptions.unshift(contact);
            }
            if (!Array.isArray(contact.dmHistory)) contact.dmHistory = [];
            batch.messages.forEach((message, messageIndex) => {
                contact.dmHistory.push({
                    type: 'char',
                    name: batch.winnerName,
                    text: message.text,
                    translationZh: message.translationZh,
                    timestamp: now + batchIndex * 10 + messageIndex,
                    lotteryId
                });
            });
            if (typeof window.markYtMessagesUnread === 'function') {
                window.markYtMessagesUnread(contact, batch.messages.length);
            } else {
                contact.unreadDmCount = Math.max(0, Math.round(Number(contact.unreadDmCount) || 0)) + batch.messages.length;
            }
        });
        lottery.winnerDmsAppliedAt = now;
        window.updateYtMessageUnreadIndicators?.();
        if (typeof renderMessagesList === 'function') renderMessagesList();
    }

    function scheduleUserLiveLotteryComments(comments, options = {}) {
        const source = Array.isArray(comments) ? comments : [];
        source.forEach((comment, index) => {
            setTimeout(() => {
                const name = String(comment?.name || `观众${index + 1}`).trim();
                const text = String(comment?.text || comment?.content || '').trim();
                if (!text) return;
                if (channelState?.activeUserLive) {
                    addUserLiveChatMessage(name, text, null, null, comment?.translationZh);
                } else {
                    const latestPastVideo = Array.isArray(channelState?.pastVideos) ? channelState.pastVideos[0] : null;
                    if (latestPastVideo) {
                        latestPastVideo.comments = Array.isArray(latestPastVideo.comments) ? latestPastVideo.comments : [];
                        latestPastVideo.comments.push({ name, text, translationZh: String(comment?.translationZh || '').trim(), amount: null, color: null });
                        saveYoutubeData();
                    }
                }
                if (options.collectParticipants && comment?.participates === true) {
                    addUserLiveLotteryParticipant(name, options.source || 'lottery-api');
                }
            }, 180 * index);
        });
    }

    async function requestUserLiveLotteryLaunchComments(lottery) {
        try {
            const parsed = await requestUserLiveLotteryJson(buildUserLiveLotteryLaunchPrompt(lottery));
            const comments = Array.isArray(parsed?.comments) ? parsed.comments.filter(comment => String(comment?.text || comment?.content || '').trim()) : [];
            if (comments.length < 10) throw new Error('TOO_FEW_LOTTERY_COMMENTS');
            comments.filter(comment => comment?.participates === true).forEach(comment => {
                addUserLiveLotteryParticipant(comment.name, 'lottery-launch-api');
            });
            scheduleUserLiveLotteryComments(comments, { collectParticipants: false });
        } catch (error) {
            console.error('User live lottery launch comments failed:', error);
            if (window.showToast) window.showToast('抽奖互动生成失败，抽奖仍会继续');
        }
    }

    async function requestUserLiveLotteryFollowup(lottery) {
        try {
            const parsed = await requestUserLiveLotteryJson(buildUserLiveLotteryFollowupPrompt(lottery));
            const comments = Array.isArray(parsed?.comments) ? parsed.comments.filter(comment => String(comment?.text || comment?.content || '').trim()) : [];
            if (comments.length < 10) throw new Error('TOO_FEW_LOTTERY_FOLLOWUP_COMMENTS');
            const winnerDmBatches = normalizeUserLiveLotteryWinnerDmBatches(lottery, parsed?.winnerDMs);
            appendUserLiveLotteryWinnerDms(lottery, winnerDmBatches);
            scheduleUserLiveLotteryComments(comments, { collectParticipants: false });
            lottery.followupStatus = 'succeeded';
        } catch (error) {
            console.error('User live lottery follow-up failed:', error);
            lottery.followupStatus = 'failed';
            if (window.showToast) window.showToast('开奖结果已保存，后续互动生成失败');
        } finally {
            if (String(channelState?.activeUserLive?.lottery?.id || '') === String(lottery.id || '')) {
                persistActiveUserLive({ lottery });
            } else {
                saveYoutubeData();
            }
        }
    }

    async function finalizeUserLiveLottery() {
        const lottery = getActiveUserLiveLottery();
        if (!lottery || lottery.status !== 'active' || isFinalizingUserLiveLottery) return;
        isFinalizingUserLiveLottery = true;
        try {
            lottery.status = 'completed';
            lottery.completedAt = Date.now();
            lottery.winners = drawUserLiveLotteryWinners(lottery);
            lottery.followupStatus = 'requesting';
            lottery.followupRequestedAt = Date.now();
            persistActiveUserLive({ lottery });
            stopUserLiveLotteryTimer();
            renderUserLiveLotteryStatus();
            renderUserLiveLotteryResult(lottery, true);
            requestUserLiveLotteryFollowup(lottery);
        } finally {
            isFinalizingUserLiveLottery = false;
        }
    }

    function closeUserLiveLotteryResult() {
        userLiveLotteryResultModal?.classList.remove('active');
    }

    function openUserLiveLotterySetup() {
        if (isUserLiveLotteryActive()) {
            renderUserLiveLotteryStatus(true);
            if (window.showToast) window.showToast('当前抽奖正在进行中');
            return;
        }
        if (userLiveLotteryDuration) userLiveLotteryDuration.value = '30';
        renderUserLiveLotteryPrizeRows();
        userLiveLotterySheet?.classList.add('active');
    }

    if (userLiveLotteryBtn) {
        const activateLotteryButton = event => {
            event?.stopPropagation();
            openUserLiveLotterySetup();
        };
        userLiveLotteryBtn.addEventListener('click', activateLotteryButton);
        userLiveLotteryBtn.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            activateLotteryButton(event);
        });
    }

    if (userLiveLotteryAddPrize) {
        userLiveLotteryAddPrize.addEventListener('click', () => {
            const currentRows = userLiveLotteryPrizes ? Array.from(userLiveLotteryPrizes.querySelectorAll('.yt-user-live-lottery-prize-row')) : [];
            if (currentRows.length >= 10) {
                if (window.showToast) window.showToast('最多设置 10 个奖项');
                return;
            }
            const currentPrizes = currentRows.map((row, index) => ({
                id: row.dataset.prizeId,
                name: row.querySelector('.yt-lottery-prize-name')?.value || getUserLiveLotteryPrizeName(index),
                type: row.querySelector('.yt-lottery-prize-type')?.value === 'cash' ? 'cash' : 'custom',
                prize: row.querySelector('.yt-lottery-prize-content')?.value || '',
                amount: row.querySelector('.yt-lottery-prize-amount')?.value || 0,
                winnerCount: row.querySelector('.yt-lottery-prize-count')?.value || 1
            }));
            currentPrizes.push(createDefaultUserLiveLotteryPrize(currentPrizes.length));
            renderUserLiveLotteryPrizeRows(currentPrizes);
        });
    }

    userLiveLotteryClose?.addEventListener('click', closeUserLiveLotterySheet);
    userLiveLotterySheet?.addEventListener('mousedown', event => {
        if (event.target === userLiveLotterySheet) closeUserLiveLotterySheet();
    });
    userLiveLotteryResultClose?.addEventListener('click', closeUserLiveLotteryResult);
    userLiveLotteryResultConfirm?.addEventListener('click', closeUserLiveLotteryResult);
    userLiveLotteryResultModal?.addEventListener('mousedown', event => {
        if (event.target === userLiveLotteryResultModal) closeUserLiveLotteryResult();
    });

    if (userLiveLotteryConfirm) {
        userLiveLotteryConfirm.addEventListener('click', async () => {
            if (isUserLiveLotteryActive()) {
                closeUserLiveLotterySheet();
                renderUserLiveLotteryStatus(true);
                return;
            }
            if (!window.apiConfig?.endpoint || !window.apiConfig?.apiKey) {
                if (window.showToast) window.showToast('请先配置 API');
                return;
            }
            const config = collectUserLiveLotteryConfig();
            if (!config || !channelState?.activeUserLive) return;
            if (config.totalCashAmount > 0) {
                if (typeof window.getPayBalance !== 'function' || typeof window.addPayTransaction !== 'function') {
                    if (window.showToast) window.showToast('Pay 尚未加载，暂时无法发放金额奖品');
                    return;
                }
                const payBalance = Number(window.getPayBalance());
                if (!Number.isFinite(payBalance) || payBalance < config.totalCashAmount) {
                    if (window.showToast) window.showToast(`Pay 余额不足，需要 ¥${config.totalCashAmount.toFixed(2)}`);
                    return;
                }
            }
            const now = Date.now();
            const lottery = {
                id: `user_live_lottery_${now}_${Math.random().toString(36).slice(2, 8)}`,
                status: 'active',
                createdAt: now,
                endAt: now + config.durationSec * 1000,
                durationSec: config.durationSec,
                prizes: config.prizes,
                participants: [],
                winners: [],
                simulatedTargetParticipants: Math.min(
                    getUserLiveOnlineViewerLimit(),
                    Math.max(
                        config.prizes.reduce((total, prize) => total + prize.winnerCount, 0),
                        Math.round(getUserLiveOnlineViewerLimit() * (0.35 + Math.random() * 0.3))
                    )
                ),
                payAmountCharged: config.totalCashAmount,
                payChargedAt: null,
                followupStatus: 'pending'
            };
            userLiveLotteryConfirm.disabled = true;
            try {
                if (config.totalCashAmount > 0) {
                    const paid = window.addPayTransaction(config.totalCashAmount, 'YouTube 直播抽奖奖金', 'expense');
                    if (!paid) {
                        if (window.showToast) window.showToast('Pay 扣款失败，抽奖未开始');
                        return;
                    }
                    lottery.payChargedAt = Date.now();
                }
                persistActiveUserLive({ lottery });
                closeUserLiveLotterySheet();
                closeUserLiveLotteryResult();
                startUserLiveLotteryTimer();
                requestUserLiveLotteryLaunchComments(lottery);
            } finally {
                userLiveLotteryConfirm.disabled = false;
            }
        });
    }

    function buildUserLiveCommentTextHtml(comment, textColor = '#0f0f0f') {
        const translationZh = String(comment?.translationZh || '').trim();
        return `
            <span style="color:${textColor};">${escapeYtUserLiveHtml(comment?.text || '')}</span>
            ${translationZh ? `<span class="yt-user-live-comment-translation-toggle" role="button" tabindex="0">翻译</span><span class="yt-user-live-comment-translation" hidden>${escapeYtUserLiveHtml(translationZh)}</span>` : ''}
        `;
    }

    function bindUserLiveCommentTranslation(row) {
        const toggle = row?.querySelector('.yt-user-live-comment-translation-toggle');
        const translation = row?.querySelector('.yt-user-live-comment-translation');
        if (!toggle || !translation) return;
        const activate = () => {
            const shouldExpand = translation.hidden;
            translation.hidden = !shouldExpand;
            toggle.textContent = shouldExpand ? '收起翻译' : '翻译';
            toggle.setAttribute('aria-expanded', String(shouldExpand));
        };
        toggle.addEventListener('click', activate);
        toggle.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            activate();
        });
    }

    function renderUserLiveChatRow(comment) {
        if (!userLiveChatContainer || !comment) return;
        const row = document.createElement('div');
        if (comment.amount) {
            row.style.backgroundColor = comment.color || '#8e8e93';
            row.style.padding = '8px 12px';
            row.style.borderRadius = '8px';
            row.style.marginBottom = '4px';
            row.innerHTML = `
                <div style="font-weight: bold; font-size: 13px; color: rgba(255,255,255,0.9); margin-bottom: 4px;">${escapeYtUserLiveHtml(comment.name || '')} <span style="margin-left: 8px;">${escapeYtUserLiveHtml(comment.amount)}</span></div>
                <div style="font-size: 14px; color: #fff;">${buildUserLiveCommentTextHtml(comment, '#fff')}</div>
            `;
        } else {
            const grayColors = ['#333333', '#4d4d4d', '#666666', '#808080', '#999999', '#b3b3b3'];
            const randColor = grayColors[Math.floor(Math.random() * grayColors.length)];
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.alignItems = 'flex-start';
            row.style.marginBottom = '12px';
            row.innerHTML = `
                <div style="width:24px; height:24px; border-radius:50%; background-color:${randColor}; display:flex; justify-content:center; align-items:center; color:#fff; font-size:10px; font-weight:bold; flex-shrink:0;">
                    ${escapeYtUserLiveHtml(comment.name && comment.name.length > 0 ? comment.name[0].toUpperCase() : '?')}
                </div>
                <div style="font-size:13px; margin-top:2px;">
                    <span style="font-size:12px; margin-right:4px; color:#606060;">${escapeYtUserLiveHtml(comment.name || '')}</span>
                    ${buildUserLiveCommentTextHtml(comment)}
                </div>
            `;
        }
        bindUserLiveCommentTranslation(row);
        userLiveChatContainer.appendChild(row);
        userLiveChatContainer.scrollTop = userLiveChatContainer.scrollHeight;
    }

    function restoreActiveUserLiveState() {
        const activeLive = channelState && channelState.activeUserLive;
        if (!activeLive || typeof activeLive !== 'object') return;

        userLiveBgUrl = activeLive.backgroundUrl || activeLive.thumbnail || '';
        userLiveHistory = Array.isArray(activeLive.history) ? [...activeLive.history] : [];
        userLiveComments = Array.isArray(activeLive.comments) ? [...activeLive.comments] : [];
        userLiveTotalSC = Number(activeLive.totalSC) || 0;
        userLiveTotalViews = Number(activeLive.totalViews) || 0;
        userLiveMaxHot = Number(activeLive.maxHot) || userLiveTotalViews;
        userLiveNewSubs = Number(activeLive.newSubs) || 0;
        userLiveSessionId = activeLive.liveSessionId || activeLive.id || null;

        const titleInput = document.getElementById('yt-user-live-title-input');
        const topicInput = document.getElementById('yt-user-live-topic-input');
        const titleDisplay = document.getElementById('yt-user-live-title-display');
        const bgDisplay = document.getElementById('yt-user-live-bg-display');
        const viewsEl = document.getElementById('yt-user-live-views-display');

        if (titleInput) titleInput.value = activeLive.title || '';
        if (topicInput) topicInput.value = activeLive.desc || '';
        if (titleDisplay) titleDisplay.textContent = activeLive.title || '我的直播间';
        if (userLiveBgImg && userLiveBgUrl) {
            userLiveBgImg.src = userLiveBgUrl;
            userLiveBgImg.style.display = 'block';
        }
        if (bgDisplay) bgDisplay.src = userLiveBgUrl || 'https://picsum.photos/900/600';
        if (viewsEl) viewsEl.textContent = activeLive.views || `${userLiveTotalViews} 人正在观看`;
        if (userLiveChatContainer) {
            userLiveChatContainer.innerHTML = '';
            userLiveComments.forEach(renderUserLiveChatRow);
        }
        const restoredLottery = activeLive.lottery;
        if (restoredLottery?.status === 'active') {
            startUserLiveLotteryTimer();
        } else {
            renderUserLiveLotteryStatus();
            if (restoredLottery?.status === 'completed') renderUserLiveLotteryResult(restoredLottery, false);
        }
    }

    window.openYtUserLiveView = function() {
        if (typeof window.releaseYtChatKeyboardLock === 'function') window.releaseYtChatKeyboardLock(userLiveView);
        const playerView = document.getElementById('yt-video-player-view');
        if (playerView) playerView.classList.remove('active', 'yt-char-live-mode');
        if (userLiveView) userLiveView.classList.add('active');
        requestAnimationFrame(positionUserLiveLotteryStatus);
        window.resetYtViewportOffset?.();
    };

    window.addEventListener('resize', positionUserLiveLotteryStatus);
    window.visualViewport?.addEventListener('resize', positionUserLiveLotteryStatus);

    [
        userLiveVideoArea,
        userLiveBackBtn,
        userLiveMinimizeBtn,
        userLiveLotteryBtn,
        document.getElementById('yt-user-live-views-display'),
        userLiveTriggerApiBtn,
        userLiveChatContainer,
        userLiveChatInput,
        userLiveChatSend
    ].filter(Boolean).forEach((el) => {
        el.addEventListener('click', stopUserLiveControlEvent);
        el.addEventListener('pointerdown', stopUserLiveControlEvent);
    });

    if (userLiveChatContainer) {
        let isDraggingUserLive = false;
        userLiveChatContainer.addEventListener('touchstart', () => { isDraggingUserLive = false; }, { passive: true });
        userLiveChatContainer.addEventListener('touchmove', () => { isDraggingUserLive = true; }, { passive: true });
        userLiveChatContainer.addEventListener('touchend', () => {
            if (isDraggingUserLive) {
                if (userLiveChatInput && document.activeElement === userLiveChatInput) userLiveChatInput.blur();
            }
        });
        userLiveChatContainer.addEventListener('click', () => {
            if (userLiveChatInput && document.activeElement === userLiveChatInput) userLiveChatInput.blur();
        });
    }

    if (userLiveBackBtn) {
        userLiveBackBtn.addEventListener('click', () => {
            if (userLiveChatInput && document.activeElement === userLiveChatInput) userLiveChatInput.blur();
        });
    }

    if (userLiveChatInput) {
        userLiveChatInput.addEventListener('focus', () => {
            if (typeof window.setYtChatKeyboardLock === 'function') window.setYtChatKeyboardLock(userLiveView, true);
            else if (userLiveView) userLiveView.classList.add('keyboard-open');
        });
        userLiveChatInput.addEventListener('blur', () => {
            if (typeof window.setYtChatKeyboardLock === 'function') window.setYtChatKeyboardLock(userLiveView, false);
            else if (userLiveView) userLiveView.classList.remove('keyboard-open');
            window.resetYtViewportOffset?.();
        });
    }

    restoreActiveUserLiveState();
    if (window.youtubeDataReadyPromise && typeof window.youtubeDataReadyPromise.then === 'function') {
        window.youtubeDataReadyPromise.then(() => restoreActiveUserLiveState()).catch(() => {});
    }

    if (startUserLiveBtn) {
        startUserLiveBtn.addEventListener('click', () => {
            userLiveComments = [];
            userLiveTotalSC = 0;
            userLiveTotalViews = Math.floor(Math.random() * 500) + 100;
            userLiveMaxHot = userLiveTotalViews;
            userLiveNewSubs = 0;
            userLiveSessionId = `user_live_${Date.now()}`;
            stopUserLiveLotteryTimer();
            persistActiveUserLive({ minimized: false, lottery: null });
            renderUserLiveLotteryStatus();
            const viewsEl = document.getElementById('yt-user-live-views-display');
            if(viewsEl) viewsEl.textContent = userLiveTotalViews + ' 人正在观看';
        });
    }

    if (userLiveMinimizeBtn) {
        userLiveMinimizeBtn.addEventListener('click', () => {
            if (typeof window.releaseYtChatKeyboardLock === 'function') window.releaseYtChatKeyboardLock();
            if(userLiveView) userLiveView.classList.remove('active');
            if(window.showToast) window.showToast('直播已最小化并在后台运行');
            
            // Generate a fake active live stream for the user in the channel list
            const effectiveYtUser = getCurrentYtLiveUser();
            if (effectiveYtUser) {
                // Just persist it, rebuildYoutubeMockVideos handles the rest
                persistActiveUserLive({ minimized: true });
                if(typeof rebuildYoutubeMockVideos === 'function') {
                    rebuildYoutubeMockVideos();
                } else {
                    // Fallback just in case
                    const existingIndex = mockVideos.findIndex(v => v.channelData && v.channelData.id === 'user_channel_id');
                    if(existingIndex > -1) mockVideos.splice(existingIndex, 1);
                    const activeLive = channelState.activeUserLive;
                    
                    mockVideos.unshift({
                        title: activeLive.title,
                        desc: activeLive.desc,
                        views: activeLive.views,
                        time: 'LIVE',
                        thumbnail: activeLive.thumbnail,
                        isLive: true,
                        comments: activeLive.comments || [],
                        initialBubbles: [],
                        guest: activeLive.guest || null,
                        channelData: {
                            id: 'user_channel_id',
                            name: effectiveYtUser.name || '我',
                            avatar: effectiveYtUser.avatarUrl || 'https://picsum.photos/80/80',
                            subs: effectiveYtUser.subs || '0'
                        }
                    });
                }
                renderVideos();
            }
        });
    }

    const userLiveSummarySheet = document.getElementById('yt-user-live-summary-sheet');
    const ytSummaryConfirmBtn = document.getElementById('yt-summary-confirm-btn');

    if (userLiveSummarySheet) {
        userLiveSummarySheet.addEventListener('mousedown', (e) => {
            if (e.target === userLiveSummarySheet) userLiveSummarySheet.classList.remove('active');
        });
    }

    if (ytSummaryConfirmBtn && userLiveSummarySheet) {
        ytSummaryConfirmBtn.addEventListener('click', () => {
            userLiveSummarySheet.classList.remove('active');
            const completedLiveId = userLiveSessionId || channelState.activeUserLive?.liveSessionId || `user_live_${Date.now()}`;
            const communityGrowth = typeof window.applyYtUserCommunityLiveGrowth === 'function'
                ? window.applyYtUserCommunityLiveGrowth({
                    liveId: completedLiveId,
                    newSubs: userLiveNewSubs,
                    totalViews: userLiveTotalViews
                })
                : 0;
            
            const existingIndex = mockVideos.findIndex(v => v.channelData && v.channelData.id === 'user_channel_id');
            if(existingIndex > -1) mockVideos.splice(existingIndex, 1);

            // Update Data Center
            if (!channelState.dataCenter) {
                channelState.dataCenter = { views: 0, sc: 0, subs: 0 };
            }
            channelState.dataCenter.views += userLiveTotalViews;
            channelState.dataCenter.sc += userLiveTotalSC;
            if (!channelState.dataCenter.subs) channelState.dataCenter.subs = 0;
            channelState.dataCenter.subs += userLiveNewSubs;
            
            const effectiveYtUser = getCurrentYtLiveUser();
            if (effectiveYtUser) {
                const currentSubsNum = parseSubs(effectiveYtUser.subs);
                effectiveYtUser.subs = formatSubs(currentSubsNum + userLiveNewSubs);

                const currentNumStr = (effectiveYtUser.videos || '0').replace(/[^0-9]/g, '');
                let currentNum = parseInt(currentNumStr) || 0;
                effectiveYtUser.videos = (currentNum + 1).toString();
                ytUserState = effectiveYtUser;
                syncYtProfile();
            }

            // Save to Past Videos
            if (!channelState.pastVideos) channelState.pastVideos = [];
            const titleInput = document.getElementById('yt-user-live-title-input');
            const title = titleInput && titleInput.value ? titleInput.value : '我的直播间';

            const topicInput = document.getElementById('yt-user-live-topic-input');
            const topicDesc = topicInput && topicInput.value ? topicInput.value : '';
            const archivedUserComments = [...userLiveComments];
            
            const pastVid = {
                id: `yt-user-replay-${completedLiveId}-${Date.now()}`,
                sourceLiveId: completedLiveId,
                isLiveReplay: true,
                title: title,
                desc: topicDesc,
                views: userLiveTotalViews + ' 次观看',
                time: '刚刚',
                thumbnail: userLiveBgUrl || 'https://picsum.photos/seed/user_past/320/180?grayscale',
                comments: archivedUserComments,
                realtimeCommentCount: archivedUserComments.length,
                liveTranscript: Array.isArray(userLiveHistory) ? userLiveHistory.map(item => ({ ...item })) : [],
                guest: getSelectedUserLiveGuest(),
                lottery: channelState.activeUserLive?.lottery || null
            };
            channelState.pastVideos.unshift(pastVid);
            
            // Sync to Guest Profile
            const selectedLiveGuest = getSelectedUserLiveGuest();
            if (selectedLiveGuest && selectedLiveGuest.guestSource !== 'tiktok-following') {
                const guestSub = mockSubscriptions.find(s => s.id === selectedLiveGuest.id);
                if (guestSub) {
                    if (!guestSub.generatedContent) {
                        guestSub.generatedContent = { pastVideos: [], communityPosts: [], currentLive: null, fanGroup: null };
                    }
                    if (!guestSub.generatedContent.pastVideos) guestSub.generatedContent.pastVideos = [];
                    guestSub.generatedContent.pastVideos.unshift({
                        title: `【联动录播】${title}`,
                        views: Math.floor(userLiveTotalViews * 0.8) + ' 次观看',
                        time: '刚刚',
                        thumbnail: pastVid.thumbnail,
                        comments: [{name: effectiveYtUser.name || '我', text: '这把打得不错！'}],
                        guest: { name: effectiveYtUser.name || '我' }
                    });
                }
            }

            stopUserLiveLotteryTimer();
            renderUserLiveLotteryStatus();
            channelState.activeUserLive = null;
            saveYoutubeData();

            if(window.showToast) {
                window.showToast(communityGrowth > 0
                    ? `录播已保存，社群新增 ${communityGrowth} 人`
                    : '录播已保存至往期记录');
            }

            renderVideos();
            
            // Force refresh profile tab if active
            const activeTab = document.querySelector('#profile-main-tabs .yt-sliding-tab.active');
            if (activeTab && activeTab.getAttribute('data-target') === 'past') {
                activeTab.click(); 
            }
        });
    }

    if (userLiveChatSend && userLiveChatInput) {
        const sendAction = () => {
            const text = userLiveChatInput.value.trim();
            if(!text) return;

            userLiveHistory.push({ type: 'host', senderType: 'user', text: text });
            
            // Create bubble on screen
            const bubble = document.createElement('div');
            bubble.className = 'yt-user-live-bubble';
            bubble.textContent = text;
            userLiveBubblesContainer.appendChild(bubble);

            setTimeout(() => {
                bubble.style.opacity = '0';
                bubble.style.transition = 'opacity 1s ease';
                setTimeout(() => bubble.remove(), 1000);
            }, 8000);

            userLiveChatInput.value = '';
            persistActiveUserLive();
        };

        userLiveChatSend.addEventListener('click', sendAction);
        userLiveChatSend.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            sendAction();
        });
        window.mobileInputCompat?.register({
            input: userLiveChatInput,
            root: userLiveView,
            scrollContainer: userLiveChatContainer,
            onSend: sendAction,
            allowEmpty: true,
            openClasses: ['keyboard-open', 'yt-chat-keyboard-lock']
        });
    }

    function buildUserLiveAudiencePrompt() {
        const worldBookSections = [];
        if (typeof window.getGlobalWorldBookContext === 'function') {
            const globalCtx = window.getGlobalWorldBookContext();
            if (globalCtx) worldBookSections.push(globalCtx);
        } else if (channelState && Array.isArray(channelState.boundWorldBookIds) && typeof window.getWorldBooks === 'function') {
            const worldBooks = window.getWorldBooks();
            channelState.boundWorldBookIds.forEach(id => {
                const boundBook = worldBooks.find(book => String(book.id) === String(id));
                if (boundBook && Array.isArray(boundBook.entries) && boundBook.entries.length > 0) {
                    const entries = boundBook.entries
                        .map(entry => `${entry.keyword || 'entry'}: ${entry.content || ''}`)
                        .filter(Boolean)
                        .join('\n');
                    if (entries.trim()) worldBookSections.push(`【${boundBook.name || 'World Book'}】\n${entries}`);
                }
            });
        }

        const effectiveYtUser = getCurrentYtLiveUser();
        const hostName = effectiveYtUser.name || '我';
        const hostPersona = effectiveYtUser.persona || effectiveYtUser.desc || '普通主播';
        const liveTitle = getUserLiveTitle();
        const liveTopic = getUserLiveTopic();
        const recentHostMsg = userLiveHistory.slice(-5).map(m => m.text).filter(Boolean).join(' | ') || '刚开播，还没有明显发言';
        const selectedGuest = getSelectedUserLiveGuest();
        const guestContext = selectedGuest
            ? `联动嘉宾：${selectedGuest.name || '未知'}。嘉宾人设：${selectedGuest.desc || selectedGuest.persona || '未知'}。`
            : '联动嘉宾：无。';
        const worldBookSection = worldBookSections.length > 0
            ? `\n已挂载世界书内容：\n${worldBookSections.join('\n\n')}\n`
            : '';
        const activeLottery = getActiveUserLiveLottery();
        const lotteryContext = activeLottery?.status === 'active'
            ? `\n当前直播正在抽奖。剩余约 ${Math.max(0, Math.ceil((Number(activeLottery.endAt) - Date.now()) / 1000))} 秒。奖项：${JSON.stringify(activeLottery.prizes)}。每条评论必须额外返回 participates 布尔值，只有明确报名参加抽奖的人为 true；其他围观评论为 false。\n`
            : '';

        return `你正在为一个真实 YouTube 直播间生成观众实时反应。
主播名：${hostName}
主播人设：${hostPersona}
直播标题：${liveTitle}
直播主题：${liveTopic}
最近主播发言或动作：${recentHostMsg}
${guestContext}${worldBookSection}${lotteryContext}
请根据主播人设、直播标题、主题、最近发言和联动信息，生成像真实 YouTube 直播间一样的即时评论、打赏和新订阅。
评论要短、有弹幕感，允许观众有不同语气、追问、吐槽、起哄、支持和轻微跑题，但要贴合当前直播。
观众要有明显的国际构成：comments 至少一半来自使用英语、日语、韩语、法语、西班牙语等非中文语言的外国观众，昵称也要符合对应语言地区。非中文内容保留原语言，并提供自然准确的简体中文 translationZh；中文内容的 translationZh 为空字符串。不要把所有评论都写成中文。

只返回严格 JSON，不要 Markdown，不要代码块，不要解释，不要 emoji。
JSON 结构必须完全符合：
{
  "comments": [
    {"name": "viewer name", "text": "original comment", "translationZh": "简体中文翻译或空字符串", "participates": false},
    {"name": "观众2", "text": "中文弹幕内容", "translationZh": "", "participates": false}
  ],
  "superchats": [
    {"name": "supporter name", "text": "original message", "translationZh": "简体中文翻译或空字符串", "displayAmount": "$50", "amount": 350, "color": "#e65100"}
  ],
  "newSubs": ["新粉丝A", "新粉丝B"]
}
约束：
1. comments 必须是 5 到 10 条
2. superchats 必须是 0 到 2 条，displayAmount 是带币种符号的展示金额，amount 是换算成人民币的纯数字
3. newSubs 可以是空数组，也可以是 1 到 3 个名字
4. 抽奖进行中时 comments 每项必须包含 participates；没有抽奖时一律为 false
5. comments 和 superchats 的非中文内容必须带 translationZh，中文内容不重复翻译
6. 所有句子自然短促，不要在句末堆标点`;
    }

    if (userLiveTriggerApiBtn) {
        userLiveTriggerApiBtn.addEventListener('click', async () => {
            if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
                if(window.showToast) window.showToast('请配置API');
                return;
            }

            userLiveTriggerApiBtn.style.opacity = '0.5';
            userLiveTriggerApiBtn.style.pointerEvents = 'none';
            userLiveTriggerApiBtn.setAttribute('aria-busy', 'true');
            userLiveTriggerApiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            try {
                let endpoint = window.apiConfig.endpoint;
                if(endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
                if(!endpoint.endsWith('/chat/completions')) {
                    endpoint = endpoint.endsWith('/v1') ? endpoint + '/chat/completions' : endpoint + '/v1/chat/completions';
                }

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.apiConfig.apiKey}`
                    },
                    body: JSON.stringify({
                        model: window.apiConfig.model || 'gpt-3.5-turbo',
                        messages: [{ role: 'user', content: buildUserLiveAudiencePrompt() }],
                        temperature: 0.8,
                        response_format: { type: "json_object" } 
                    })
                });

                if (!res.ok) throw new Error("API failed");
                const data = await res.json();
                let resultText = data.choices[0].message.content.replace(/```json\n?/g, '').replace(/```/g, '').trim();
                
                let parsed;
                try {
                    parsed = sanitizeObj(JSON.parse(resultText));
                } catch (parseErr) {
                    console.error("JSON Parse Error in Live Audience:", parseErr, resultText);
                    if(window.showToast) window.showToast('观众反应格式生成失败，请重试');
                    return;
                }

                // Combine and Shuffle Events for Realistic Streaming
                let events = [];
                
                if (parsed.comments && Array.isArray(parsed.comments)) {
                    parsed.comments.forEach(c => events.push({ type: 'comment', data: c }));
                }
                if (parsed.superchats && Array.isArray(parsed.superchats)) {
                    parsed.superchats.forEach(sc => events.push({ type: 'sc', data: sc }));
                }
                if (parsed.newSubs && Array.isArray(parsed.newSubs)) {
                    parsed.newSubs.forEach(sub => events.push({ type: 'sub', data: sub }));
                }

                // Randomly shuffle the events
                events.sort(() => Math.random() - 0.5);

                let totalDelay = 0;
                events.forEach(ev => {
                    // Random delay between 0.5s and 2.5s for each event
                    totalDelay += Math.floor(Math.random() * 2000) + 500;
                    
                    setTimeout(() => {
                        if (ev.type === 'comment') {
                            addUserLiveChatMessage(ev.data.name, ev.data.text, null, null, ev.data.translationZh);
                            if (ev.data.participates === true) {
                                addUserLiveLotteryParticipant(ev.data.name, 'audience-api');
                            }
                        } else if (ev.type === 'sc') {
                            addUserLiveChatMessage(ev.data.name, ev.data.text, ev.data.displayAmount || ev.data.amount, ev.data.color, ev.data.translationZh);
                            const amountNum = parseFloat(ev.data.amount) || 0;
                            userLiveTotalSC += amountNum;
                            persistActiveUserLive();
                        } else if (ev.type === 'sub') {
                            const alertContainer = document.getElementById('yt-user-live-alert-container');
                            if (alertContainer) {
                                const alert = document.createElement('div');
                                alert.className = 'yt-user-live-alert';
                                alert.innerHTML = `<i class="fas fa-bell"></i> ${ev.data} 刚刚订阅了你！`;
                                
                                // random vertical position
                                alert.style.top = Math.floor(Math.random() * 80) + '%';
                                
                                alertContainer.appendChild(alert);
                                setTimeout(() => alert.remove(), 5000);
                                
                                userLiveNewSubs += 1;
                                
                                // increment viewer count
                                const viewsEl = document.getElementById('yt-user-live-views-display');
                                if(viewsEl) {
                                    let currentNum = parseInt(viewsEl.textContent) || 0;
                                    const addedViews = Math.floor(Math.random() * 50) + 10;
                                    currentNum += addedViews;
                                    userLiveTotalViews += addedViews;
                                    if(userLiveTotalViews > userLiveMaxHot) userLiveMaxHot = userLiveTotalViews;
                                    viewsEl.textContent = currentNum + ' 人正在观看';
                                }
                                persistActiveUserLive();
                            }
                        }
                    }, totalDelay);
                });

            } catch (e) {
                console.error(e);
                if(window.showToast) window.showToast('无法获取观众反应');
            } finally {
                userLiveTriggerApiBtn.style.opacity = '1';
                userLiveTriggerApiBtn.style.pointerEvents = 'auto';
                userLiveTriggerApiBtn.setAttribute('aria-busy', 'false');
                userLiveTriggerApiBtn.innerHTML = '<i class="fas fa-arrow-down" style="font-size:14px;"></i>';
            }
        });
        userLiveTriggerApiBtn.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            userLiveTriggerApiBtn.click();
        });
    }

    function addUserLiveChatMessage(name, text, amount, color, translationZh = '') {
        if (!userLiveChatContainer) return;
        const comment = { name, text, translationZh: String(translationZh || '').trim(), amount, color };
        userLiveComments.push(comment);

        const row = document.createElement('div');
        row.className = 'yt-live-chat-row-anim';
        
        if (amount) {
            let displayAmount = amount;
            if (typeof amount === 'number' || /^\d+(\.\d+)?$/.test(String(amount))) {
                displayAmount = '￥' + amount;
            }
            row.style.backgroundColor = color || '#8e8e93';
            row.style.padding = '8px 12px';
            row.style.borderRadius = '8px';
            row.style.marginBottom = '4px';
            row.innerHTML = `
                <div style="font-weight: bold; font-size: 13px; color: rgba(255,255,255,0.9); margin-bottom: 4px;">${escapeYtUserLiveHtml(name)} <span style="margin-left: 8px;">${escapeYtUserLiveHtml(displayAmount)}</span></div>
                <div style="font-size: 14px; color: #fff;">${buildUserLiveCommentTextHtml(comment, '#fff')}</div>
            `;
        } else {
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.alignItems = 'flex-start';
            row.style.marginBottom = '12px';
            
            const grayColors = ['#333333', '#4d4d4d', '#666666', '#808080', '#999999', '#b3b3b3'];
            const randColor = grayColors[Math.floor(Math.random() * grayColors.length)];
            
            row.innerHTML = `
                <div style="width:24px; height:24px; border-radius:50%; background-color:${randColor}; display:flex; justify-content:center; align-items:center; color:#fff; font-size:10px; font-weight:bold; flex-shrink:0;">
                    ${escapeYtUserLiveHtml(name && name.length > 0 ? name[0].toUpperCase() : '?')}
                </div>
                <div style="font-size:13px; margin-top:2px;">
                    <span style="font-size:12px; margin-right:4px; color:#606060;">${escapeYtUserLiveHtml(name)}</span>
                    ${buildUserLiveCommentTextHtml(comment)}
                </div>
            `;
        }
        bindUserLiveCommentTranslation(row);
        userLiveChatContainer.appendChild(row);
        userLiveChatContainer.scrollTop = userLiveChatContainer.scrollHeight;
        persistActiveUserLive();
    }
