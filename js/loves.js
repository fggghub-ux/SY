/**
 * Loves App Logic
 */
window.lovesApp = {
    view: null,
    backBtn: null,
    initialized: false,
    currentImsgAccount: 'main',
    currentWeiboAccount: 'main',
    currentFriend: null,
    currentSelectedFriendId: null,
    lovesProgrammaticScrollUntil: 0,

    persistFriendState: async function(friend = this.currentFriend, options = {}) {
        if (!friend) return false;

        if (window.imApp && typeof window.imApp.commitScopedFriendChange === 'function') {
            const saved = await window.imApp.commitScopedFriendChange(friend, (targetFriend) => {
                if (this.currentFriend && String(this.currentFriend.id) === String(targetFriend.id)) {
                    this.currentFriend = targetFriend;
                }
            }, {
                silent: options.silent !== false,
                syncActive: true,
                metaOnly: options.metaOnly === true
            });
            return !!saved;
        }

        if (typeof window.saveGlobalData === 'function') {
            await window.saveGlobalData();
            return true;
        }

        return false;
    },

    bindLongPress: function(element, callback) {
        let pressTimer = null;
        let startX = 0, startY = 0;

        const start = (e) => {
            if (e.type === 'mousedown' && e.button !== 0) return;
            if (e.type === 'touchstart') {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            } else {
                startX = e.clientX;
                startY = e.clientY;
            }
            if (pressTimer === null) {
                pressTimer = setTimeout(() => {
                    pressTimer = null;
                    callback(e);
                }, 600);
            }
        };

        const cancel = () => {
            if (pressTimer !== null) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        const move = (e) => {
            if (pressTimer === null) return;
            let currentX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
            let currentY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
            if (Math.abs(currentX - startX) > 10 || Math.abs(currentY - startY) > 10) {
                cancel();
            }
        };

        element.addEventListener('mousedown', start);
        element.addEventListener('touchstart', start, {passive: true});
        element.addEventListener('mousemove', move);
        element.addEventListener('touchmove', move, {passive: true});
        element.addEventListener('mouseup', cancel);
        element.addEventListener('touchend', cancel);
        element.addEventListener('mouseleave', cancel);
        element.addEventListener('touchcancel', cancel);
    },

    showDeleteConfirm: function(text, onConfirm) {
        const result = window.confirm('确定要删除 "' + text + '" 吗？');
        if (result) {
            Promise.resolve(onConfirm()).then(() => {
            });
            if (window.showToast) window.showToast('已删除');
        }
    },

    escapeHTML: function(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[char]);
    },

    getLocalDateKey: function(value = new Date()) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return this.getLocalDateKey(new Date());
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    parseDateKey: function(dateKey) {
        if (!dateKey || typeof dateKey !== 'string') return new Date();
        const parts = dateKey.split('-').map(Number);
        if (parts.length !== 3 || parts.some(Number.isNaN)) return new Date();
        return new Date(parts[0], parts[1] - 1, parts[2]);
    },

    formatMoney: function(amount) {
        const value = Number(amount) || 0;
        return '¥' + value.toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },
    
    init: function() {
        if (this.initialized) return;
        
        this.view = document.getElementById('loves-view');
        this.backBtn = document.getElementById('loves-back-btn');
        
        if (!this.view) return;
        
        this.bindEvents();
        this.initialized = true;
        console.log('Loves app initialized');
    },
    
    bindEvents: function() {
        if (this.backBtn) {
            this.backBtn.addEventListener('click', () => {
                this.close();
            });
        }

        if (!this._sharedSavingsDelegated) {
            document.addEventListener('click', (e) => {
                const savingsBtn = e.target.closest('#lovers-shared-savings-btn');
                if (!savingsBtn) return;
                e.preventDefault();
                e.stopPropagation();
                const friendId = savingsBtn.dataset.friendId;
                if (!this.currentFriend && friendId) {
                    this.currentFriend = window.imData?.friends?.find(friend => String(friend.id) === String(friendId)) || null;
                }
                this.openSavingsJar();
            });
            this._sharedSavingsDelegated = true;
        }
    },

    bindSharedSavingsButton: function(friend = this.currentFriend) {
        const sharedSavingsBtn = document.getElementById('lovers-shared-savings-btn');
        if (!sharedSavingsBtn) return;
        if (friend && friend.id !== undefined) {
            sharedSavingsBtn.dataset.friendId = String(friend.id);
        }
        sharedSavingsBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (friend) this.currentFriend = friend;
            if (!this.currentFriend && sharedSavingsBtn.dataset.friendId) {
                this.currentFriend = window.imData?.friends?.find(item => String(item.id) === String(sharedSavingsBtn.dataset.friendId)) || null;
            }
            this.openSavingsJar();
        };
    },
    
    // 添加动态辅助方法
    bindFabClick: function() {
        const fab = document.getElementById('lovers-space-fab');
        if (!fab) return;
        
        // 移除拖拽相关样式，确保它固定，并恢复默认的触摸行为防止点击被吞
        fab.style.transform = '';
        fab.style.touchAction = 'auto';
        
        // 使用 onclick 简单粗暴覆盖绑定，避免因为 DOM 刷新或重进导致事件丢失
        fab.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const savingsView = document.getElementById('lovers-savings-view');
            if (savingsView && savingsView.classList.contains('active')) {
                this.openSavingsDepositSheet('user');
                return;
            }
            
            // 判断当前活跃的 tab
            const activeTab = document.querySelector('.lovers-space-tab.active');
            if (activeTab) {
                const tabName = activeTab.getAttribute('data-tab');
                if (tabName === 'calendar') {
                    const scheduleView = document.getElementById('lovers-schedule-view');
                    if (scheduleView && window.openView) {
                        document.getElementById('lovers-schedule-text').value = '';
                        document.getElementById('lovers-schedule-location').value = '';
                        const now = new Date();
                        const todayStr = now.toISOString().split('T')[0];
                        const timeStr = now.toTimeString().substring(0, 5);
                        document.getElementById('lovers-schedule-date').value = todayStr;
                        document.getElementById('lovers-schedule-time').value = timeStr;
                        
                        const addBtn = document.getElementById('lovers-schedule-btn');
                        if (addBtn) {
                            addBtn.onclick = () => {
                                const title = document.getElementById('lovers-schedule-text').value.trim();
                                const date = document.getElementById('lovers-schedule-date').value;
                                const time = document.getElementById('lovers-schedule-time').value;
                                const loc = document.getElementById('lovers-schedule-location').value.trim() || '未设置地点';
                                
                                if (!title) {
                                    if (window.showToast) window.showToast('请输入日程标题');
                                    return;
                                }
                                
                                if (!this.currentFriend.memory) this.currentFriend.memory = {};
                                if (!this.currentFriend.memory.schedule) this.currentFriend.memory.schedule = {};
                                if (!this.currentFriend.memory.schedule.events) this.currentFriend.memory.schedule.events = [];
                                
                                this.currentFriend.memory.schedule.events.push({
                                    id: 'sch_' + Date.now(),
                                    name: title,
                                    title: title,
                                    date: date,
                                    startTime: time,
                                    endTime: time,
                                    time: time,
                                    location: loc,
                                    timestamp: Date.now()
                                });
                                
                                this.persistFriendState();
                                if (window.showToast) window.showToast('日程已添加');
                                if (window.closeView) window.closeView(scheduleView);
                                
                                this.currentCalendarDate = new Date(date);
                                this.renderCalendar();
                            };
                        }
                        
                        window.openView(scheduleView);
                    }
                } else if (tabName === 'moments') {
                    this.openPublishView();
                } else {
                    if (window.showToast) window.showToast('此板块暂不支持添加');
                }
            } else {
                this.openPublishView(); // 默认 fallback
            }
        };
    },

    currentCalendarDate: new Date(),

    renderCalendar: function() {
        const datesContainer = document.getElementById('lovers-calendar-dates');
        const listContainer = document.getElementById('lovers-calendar-list');
        const monthPicker = document.getElementById('lovers-calendar-month-picker');
        const yearDisplay = document.getElementById('lovers-calendar-year-display');
        const monthDisplay = document.getElementById('lovers-calendar-month-display');
        
        if (!datesContainer || !listContainer) return;

        // 渲染顶部日期横条
        const today = new Date();
        const baseDate = this.currentCalendarDate || today;
        
        // 更新标题栏年月显示
        if (yearDisplay && monthDisplay) {
            yearDisplay.textContent = baseDate.getFullYear() + '年';
            monthDisplay.textContent = (baseDate.getMonth() + 1) + '月';
        }
        
        // 绑定隐藏的 month picker
        if (monthPicker) {
            // 设置 picker 的当前值为当前 baseDate 的年月 (YYYY-MM)
            const mm = (baseDate.getMonth() + 1).toString().padStart(2, '0');
            monthPicker.value = `${baseDate.getFullYear()}-${mm}`;
            
            // 监听用户选择，选中后跳转到该月 1 号
            monthPicker.onchange = (e) => {
                const val = e.target.value; // e.g. "2026-04"
                if (val) {
                    const parts = val.split('-');
                    const newDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
                    this.currentCalendarDate = newDate;
                    this.renderCalendar();
                }
            };
        }
        
        let datesHtml = '';
        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
        
        // 生成包含当天在内的前后各 15 天的列表
        for (let i = -15; i <= 15; i++) {
            const d = new Date(baseDate);
            d.setDate(baseDate.getDate() + i);
            const isToday = d.toDateString() === today.toDateString();
            const isSelected = d.toDateString() === baseDate.toDateString();
            const dateStr = d.toISOString().split('T')[0];
            const displayDay = d.getDate();
            const displayWeek = isToday ? '今' : dayNames[d.getDay()];
            
            let bg = 'transparent';
            let color = '#8e8e93';
            let weight = '600';
            let shadow = 'none';
            
            if (isSelected) {
                bg = '#ff9bb3';
                color = '#fff';
                weight = '800';
                shadow = '0 2px 10px rgba(255,155,179,0.3)';
            } else if (isToday) {
                color = '#111';
                weight = '800';
            }

            datesHtml += `
            <div class="calendar-date-item" data-date="${dateStr}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 44px; height: 56px; border-radius: 12px; cursor: pointer; background: ${bg};  transition: all 0.2s;">
                <div style="font-size: 11px; font-weight: 600; color: ${isSelected ? '#fff' : color}; margin-bottom: 2px;">${displayWeek}</div>
                <div style="font-size: 16px; font-weight: ${weight}; color: ${color};">${displayDay}</div>
            </div>`;
        }
        datesContainer.innerHTML = datesHtml;

        // 滚动到选中日期居中 (简单处理)
        setTimeout(() => {
            const selectedEl = datesContainer.querySelector('.calendar-date-item[style*="background: rgb(255, 155, 179)"]');
            if (selectedEl && datesContainer.parentElement) {
                const scrollLeft = selectedEl.offsetLeft - datesContainer.parentElement.offsetWidth / 2 + selectedEl.offsetWidth / 2;
                datesContainer.parentElement.scrollTo({ left: scrollLeft, behavior: 'smooth' });
            }
        }, 50);

        // 绑定日期点击事件
        const dateItems = datesContainer.querySelectorAll('.calendar-date-item');
        dateItems.forEach(item => {
            item.onclick = () => {
                this.currentCalendarDate = new Date(item.getAttribute('data-date'));
                this.renderCalendar();
            };
        });

        // 渲染行程列表
        const selectedDateStr = baseDate.toISOString().split('T')[0];
        let schedules = [];
        if (this.currentFriend && this.currentFriend.memory && this.currentFriend.memory.schedule && this.currentFriend.memory.schedule.events) {
            schedules = this.currentFriend.memory.schedule.events.filter(s => s.date === selectedDateStr);
            // 按时间排序
            schedules.sort((a, b) => (a.startTime || a.time || '').localeCompare(b.startTime || b.time || ''));
        }

        let listHtml = `<!-- 垂直轴线 -->
            <div style="position: absolute; left: 54px; top: 15px; bottom: 50px; width: 2px; background: rgba(255,155,179,0.3); border-radius: 1px;"></div>`;

        if (schedules.length === 0) {
            listHtml += `<div style="text-align: center; color: #8e8e93; font-size: 14px; margin-top: 60px; position: relative; z-index: 3;">没有当天的行程安排</div>`;
        } else {
            schedules.forEach((s, idx) => {
                const timeDisplay = s.startTime && s.endTime ? `${s.startTime}~${s.endTime}` : (s.time || '');
                listHtml += `
                <div style="display: flex; align-items: flex-start; gap: 15px; margin-bottom: 20px; position: relative;" class="lovers-schedule-item" data-idx="${idx}">
                    <div style="display: flex; flex-direction: column; align-items: flex-end; width: 45px; flex-shrink: 0; padding-top: 14px;">
                        <div style="font-size: 14px; font-weight: 700; color: #111; word-break: break-all; text-align: right;">${timeDisplay}</div>
                    </div>
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: #ff9bb3; border: 3px solid #fff;  position: absolute; left: 49px; top: 16px; z-index: 2;"></div>
                    <div style="flex: 1; background: #fff; border-radius: 16px; padding: 16px;  margin-left: 10px; position: relative;">
                        <div class="delete-schedule-btn" style="position: absolute; top: 16px; right: 16px; color: #ccc; cursor: pointer; font-size: 14px;"><i class="fas fa-times"></i></div>
                        <div style="font-size: 16px; font-weight: 600; color: #111; margin-bottom: 6px; padding-right: 20px;">${s.name || s.title}</div>
                        <div style="font-size: 13px; color: #8e8e93; display: flex; align-items: center; gap: 4px;">
                            <i class="fas fa-map-marker-alt"></i> ${s.location || '未设置地点'}
                        </div>
                    </div>
                </div>`;
            });
            listHtml += `<div style="text-align: center; color: #8e8e93; font-size: 13px; margin-top: 20px; position: relative; z-index: 3;">没有更多日程了</div>`;
        }
        
        listContainer.innerHTML = listHtml;

        // 绑定删除日程事件
        const delBtns = listContainer.querySelectorAll('.delete-schedule-btn');
        delBtns.forEach((btn) => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const itemEl = e.target.closest('.lovers-schedule-item');
                const idx = itemEl.getAttribute('data-idx');
                const s = schedules[idx];
                
                if (confirm(`确定要删除日程 "${s.name || s.title}" 吗？`)) {
                    const originalIdx = this.currentFriend.memory.schedule.events.findIndex(os => os.id === s.id);
                    if (originalIdx !== -1) {
                        this.currentFriend.memory.schedule.events.splice(originalIdx, 1);
                        this.persistFriendState();
                        this.renderCalendar();
                    }
                }
            };
        });
    },

    openPublishView: function() {
        const publishView = document.getElementById('lovers-publish-view');
        if (!publishView) return;
        
        if (window.openView) window.openView(publishView);
        
        document.getElementById('lovers-publish-text').value = '';
        
        const imgContainer = document.getElementById('lovers-publish-images-container');
        const addBtn = document.getElementById('lovers-publish-add-img-btn');
        imgContainer.innerHTML = '';
        imgContainer.appendChild(addBtn);
        
        // 初始化当前上传的图片数组
        this.currentPublishImages = [];
        
        // 绑定事件
        const cancelBtn = document.getElementById('lovers-publish-cancel');
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                if (window.closeView) window.closeView(publishView);
            };
        }
        
        const fileInput = document.getElementById('lovers-publish-file-input');
        if (addBtn && fileInput) {
            addBtn.onclick = () => fileInput.click();
            fileInput.onchange = (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;
                
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        this.currentPublishImages.push(ev.target.result);
                        this.renderPublishImagePreview();
                    };
                    reader.readAsDataURL(file);
                }
                fileInput.value = '';
            };
        }
        
        const publishBtn = document.getElementById('lovers-publish-btn');
        if (publishBtn) {
            publishBtn.onclick = () => {
                const text = document.getElementById('lovers-publish-text').value.trim();
                if (!text && this.currentPublishImages.length === 0) {
                    if (window.showToast) window.showToast('写点什么或添加图片吧');
                    return;
                }
                
                const moment = {
                    id: 'lm_' + Date.now(),
                    text: text,
                    images: [...this.currentPublishImages],
                    timestamp: Date.now(),
                    likes: 0,
                    comments: []
                };
                
                if (!this.currentFriend.lovesData) {
                    this.currentFriend.lovesData = { moments: [] };
                }
                if (!this.currentFriend.lovesData.moments) {
                    this.currentFriend.lovesData.moments = [];
                }
                
                this.currentFriend.lovesData.moments.unshift(moment);
                
                this.persistFriendState();
                if (window.showToast) window.showToast('发布成功');
                if (window.closeView) window.closeView(publishView);
                
                this.renderLovesMoments();
            };
        }
    },
    
    renderPublishImagePreview: function() {
        const imgContainer = document.getElementById('lovers-publish-images-container');
        const addBtn = document.getElementById('lovers-publish-add-img-btn');
        if (!imgContainer || !addBtn) return;
        
        imgContainer.innerHTML = '';
        
        (this.currentPublishImages || []).forEach((src, index) => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'aspect-ratio: 1/1; border-radius: 12px; overflow: hidden; position: relative;';
            
            const img = document.createElement('img');
            img.src = src;
            img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
            
            const delBtn = document.createElement('div');
            delBtn.innerHTML = '<i class="fas fa-times"></i>';
            delBtn.style.cssText = 'position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; background: rgba(0,0,0,0.5); color: #fff; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 10px; cursor: pointer;';
            delBtn.onclick = () => {
                this.currentPublishImages.splice(index, 1);
                this.renderPublishImagePreview();
            };
            
            wrapper.appendChild(img);
            wrapper.appendChild(delBtn);
            imgContainer.appendChild(wrapper);
        });
        
        imgContainer.appendChild(addBtn);
    },

    renderLovesMoments: function() {
        const list = document.getElementById('lovers-moments-list');
        const empty = document.getElementById('lovers-moments-empty');
        if (!list || !empty || !this.currentFriend) return;
        
        const moments = this.currentFriend.lovesData?.moments || [];
        
        if (moments.length === 0) {
            list.style.display = 'none';
            empty.style.display = 'flex';
            return;
        }
        
        list.style.display = 'flex';
        empty.style.display = 'none';
        
        const userAvatar = window.userState?.avatarUrl || window.imData?.profile?.avatarUrl;
        const userName = window.userState?.name || window.imData?.profile?.name || '我';
        const safeUserName = this.escapeHTML(userName);
        
        let html = '';
        moments.forEach((m, idx) => {
            const date = new Date(m.timestamp);
            const timeStr = `${date.getMonth()+1}-${date.getDate()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
            
            const displayAvatar = m.isChar ? this.currentFriend.avatarUrl : userAvatar;
            const displayName = m.isChar ? (this.currentFriend.nickname || this.currentFriend.realname || 'TA') : userName;
            const safeDisplayName = this.escapeHTML(displayName);
            const safeMomentText = this.escapeHTML(m.text);

            let imagesHtml = '';
            if (m.images && m.images.length > 0) {
                imagesHtml = `<div style="display: grid; grid-template-columns: repeat(${Math.min(3, m.images.length)}, 1fr); gap: 6px; margin-top: 10px;">`;
                m.images.forEach(src => {
                    imagesHtml += `<img src="${src}" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 8px;">`;
                });
                imagesHtml += `</div>`;
            }
            
            let commentsHtml = '';
            if (m.comments && m.comments.length > 0) {
                commentsHtml = `<div style="background: #f4f4f5; border-radius: 12px; padding: 10px 12px; margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">`;
                m.comments.forEach((c, cIdx) => {
                    const cAuthor = c.isChar ? (this.currentFriend.nickname || this.currentFriend.realname || 'TA') : userName;
                    const cColor = c.isChar ? '#576b95' : '#333';
                    const safeAuthor = this.escapeHTML(cAuthor);
                    const safeCommentText = this.escapeHTML(c.text);
                    commentsHtml += `
                        <div style="font-size: 14px; line-height: 1.4; display: flex; justify-content: space-between; gap: 10px; align-items: flex-start;">
                            <div style="flex: 1; cursor: pointer;" onclick="window.lovesApp.replyToComment(${idx}, ${cIdx})"><span style="color: ${cColor}; font-weight: 600;">${safeAuthor}</span>: <span style="color: #333;">${safeCommentText}</span></div>
                            <div style="color: #ff3b30; font-size: 12px; cursor: pointer; white-space: nowrap; flex-shrink: 0;" onclick="window.lovesApp.deleteComment(${idx}, ${cIdx})">删除</div>
                        </div>
                    `;
                });
                commentsHtml += `</div>`;
            }

            html += `
            <div style="background: #fff; border-radius: 20px; padding: 16px;  position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div style="display: flex; gap: 10px;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: #f2f2f7; overflow: hidden; display: flex; justify-content: center; align-items: center; color: #ccc;">
                            ${displayAvatar ? `<img src="${displayAvatar}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="fas fa-user"></i>`}
                        </div>
                        <div>
                            <div style="font-size: 15px; font-weight: 600; color: #111;">${safeDisplayName}</div>
                            <div style="font-size: 12px; color: #8e8e93; margin-top: 2px;">${timeStr}</div>
                        </div>
                    </div>
                    <div style="position: relative;">
                        <div style="color: #8e8e93; font-size: 16px; cursor: pointer; padding: 0 5px;" onclick="window.lovesApp.toggleMomentMenu(${idx})"><i class="fas fa-ellipsis-h"></i></div>
                        <div id="loves-moment-menu-${idx}" style="display: none; position: absolute; right: 0; top: 25px; background: #fff; border-radius: 12px;  width: 140px; z-index: 10; overflow: hidden;">
                            <div style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 10px; cursor: pointer;" onclick="window.lovesApp.requestCharComment(${idx})">
                                <i class="fas fa-comment-dots" style="color: #007aff; width: 16px; text-align: center;"></i>
                                <span style="font-size: 14px; color: #111; font-weight: 500;">让TA评论</span>
                            </div>
                            <div style="padding: 12px 16px; display: flex; align-items: center; gap: 10px; cursor: pointer;" onclick="window.lovesApp.deleteMoment(${idx})">
                                <i class="fas fa-trash-alt" style="color: #ff3b30; width: 16px; text-align: center;"></i>
                                <span style="font-size: 14px; color: #ff3b30; font-weight: 500;">删除动态</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${m.text ? `<div style="font-size: 15px; color: #333; line-height: 1.5; white-space: pre-wrap; word-break: break-word;">${safeMomentText}</div>` : ''}
                ${imagesHtml}
                
                <div style="display: flex; gap: 20px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #f2f2f7; color: #8e8e93;">
                    <div style="display: flex; align-items: center; gap: 6px; cursor: pointer;" onclick="window.lovesApp.toggleMomentLike(${idx})">
                        <i class="${m.isLiked ? 'fas' : 'far'} fa-heart" style="${m.isLiked ? 'color: #ff2d55;' : ''} font-size: 18px;"></i>
                        <span style="font-size: 14px;">${m.likes || 0}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; cursor: pointer;" onclick="window.lovesApp.addMomentComment(${idx})">
                        <i class="far fa-comment-dots" style="font-size: 18px;"></i>
                        <span style="font-size: 14px;">${m.comments ? m.comments.length : 0}</span>
                    </div>
                </div>
                
                ${commentsHtml}
                <div style="display: flex; align-items: center; gap: 10px; margin-top: 12px; background: #fafafa; border-radius: 18px; padding: 8px 10px;">
                    <div style="width: 28px; height: 28px; border-radius: 50%; background: #e5e5ea; overflow: hidden; display: flex; justify-content: center; align-items: center; color: #aaa; flex-shrink: 0;">
                        ${userAvatar ? `<img src="${userAvatar}" alt="${safeUserName}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="fas fa-user" style="font-size: 12px;"></i>`}
                    </div>
                    <input type="text" class="loves-moment-comment-input" data-moment-idx="${idx}" placeholder="${m.isChar ? '评论 TA 的动态...' : '添加评论...'}" style="flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-size: 14px; color: #111;">
                    <button type="button" class="loves-moment-comment-send" data-moment-idx="${idx}" style="border: none; background: #ff9bb3; color: #fff; border-radius: 14px; padding: 6px 12px; font-size: 13px; font-weight: 700; cursor: pointer; flex-shrink: 0;">发送</button>
                </div>
            </div>
            `;
        });
        
        list.innerHTML = html;
        list.querySelectorAll('.loves-moment-comment-send').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.momentIdx, 10);
                const input = list.querySelector(`.loves-moment-comment-input[data-moment-idx="${idx}"]`);
                this.addMomentComment(idx, input ? input.value : '');
            });
        });
        list.querySelectorAll('.loves-moment-comment-input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const idx = parseInt(input.dataset.momentIdx, 10);
                this.addMomentComment(idx, input.value);
            });
        });
        
        // 全局点击关闭菜单
        if (!this._menuClickBound) {
            document.addEventListener('click', (e) => {
                if (!e.target.closest('[id^="loves-moment-menu-"]') && !e.target.closest('.fa-ellipsis-h')) {
                    const menus = document.querySelectorAll('[id^="loves-moment-menu-"]');
                    menus.forEach(m => m.style.display = 'none');
                }
            });
            this._menuClickBound = true;
        }
    },
    
    updateDaysCount: function(friend) {
        const daysEl = document.getElementById('lovers-space-days');
        if (!daysEl) return;
        
        let startTimestamp = friend.lovesSpaceStartTime;
        if (!startTimestamp) {
            // 如果没有记录时间，则以当前时间为准存入
            startTimestamp = Date.now();
            friend.lovesSpaceStartTime = startTimestamp;
            this.persistFriendState(friend, { silent: true });
        }
        
        const diffMs = Date.now() - startTimestamp;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1; // 至少1天
        
        daysEl.textContent = diffDays;
    },

    toggleMomentMenu: function(idx) {
        const menus = document.querySelectorAll('[id^="loves-moment-menu-"]');
        menus.forEach((m, i) => {
            if (i !== idx) m.style.display = 'none';
        });
        const targetMenu = document.getElementById(`loves-moment-menu-${idx}`);
        if (targetMenu) {
            targetMenu.style.display = targetMenu.style.display === 'none' ? 'block' : 'none';
        }
    },
    
    deleteMoment: function(idx) {
        if (!this.currentFriend || !this.currentFriend.lovesData || !this.currentFriend.lovesData.moments) return;
        const targetMenu = document.getElementById(`loves-moment-menu-${idx}`);
        if (targetMenu) targetMenu.style.display = 'none';
        
        this.showDeleteConfirm('这条动态', () => {
            this.currentFriend.lovesData.moments.splice(idx, 1);
            this.persistFriendState();
            this.renderLovesMoments();
        });
    },

    deleteComment: function(mIdx, cIdx) {
        if (!this.currentFriend || !this.currentFriend.lovesData || !this.currentFriend.lovesData.moments) return;
        const m = this.currentFriend.lovesData.moments[mIdx];
        if (!m || !m.comments) return;
        
        this.showDeleteConfirm('这条评论', () => {
            m.comments.splice(cIdx, 1);
            this.persistFriendState();
            this.renderLovesMoments();
        });
    },

    addMomentComment: function(mIdx, presetText = '') {
        if (!this.currentFriend || !this.currentFriend.lovesData || !this.currentFriend.lovesData.moments) return;
        const m = this.currentFriend.lovesData.moments[mIdx];
        if (!m) return;

        let commentText = String(presetText || '').trim();
        if (!commentText) {
            const prompted = prompt(m.isChar ? '评论 TA 的动态：' : '添加评论：');
            if (prompted === null) return;
            commentText = prompted.trim();
        }
        if (!commentText) return;

        if (!m.comments) m.comments = [];
        m.comments.push({
            text: commentText,
            isChar: false,
            timestamp: Date.now()
        });

        this.persistFriendState();
        this.renderLovesMoments();

        if (m.isChar === true) {
            this.requestCharComment(mIdx, {
                reason: 'user_comment',
                userComment: commentText,
                silentMissingApi: true
            });
        }
    },

    replyToComment: function(mIdx, cIdx) {
        if (!this.currentFriend || !this.currentFriend.lovesData || !this.currentFriend.lovesData.moments) return;
        const m = this.currentFriend.lovesData.moments[mIdx];
        if (!m || !m.comments || !m.comments[cIdx]) return;
        
        const targetComment = m.comments[cIdx];
        const targetName = targetComment.isChar ? (this.currentFriend.nickname || this.currentFriend.realname || 'TA') : '我';
        
        const replyText = prompt(`回复 ${targetName}：`);
        if (replyText !== null && replyText.trim() !== '') {
            m.comments.push({
                text: `回复 @${targetName} : ${replyText.trim()}`,
                isChar: false,
                timestamp: Date.now()
            });
            this.persistFriendState();
            this.renderLovesMoments();

            if (m.isChar === true) {
                this.requestCharComment(mIdx, {
                    reason: 'user_comment',
                    userComment: replyText.trim(),
                    silentMissingApi: true
                });
            }
        }
    },

    requestCharComment: function(idx, options = {}) {
        if (!this.currentFriend || !this.currentFriend.lovesData || !this.currentFriend.lovesData.moments) return;
        const m = this.currentFriend.lovesData.moments[idx];
        if (!m) return;
        
        const targetMenu = document.getElementById(`loves-moment-menu-${idx}`);
        if (targetMenu) targetMenu.style.display = 'none';

        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            if (!options.silentMissingApi && window.showToast) window.showToast('请先在系统设置中配置 API');
            return;
        }
        
        if (m._charReplyPending) return;
        m._charReplyPending = true;
        if (window.showToast) window.showToast(options.reason === 'user_comment' ? 'TA 正在回复...' : '正在生成评论...');

        let globalRule = '';
        if (window.getGlobalWorldBookContextByPosition) {
            globalRule = window.getGlobalWorldBookContextByPosition('system_depth') || '';
            const beforeRole = window.getGlobalWorldBookContextByPosition('before_role');
            if (beforeRole) globalRule += '\n' + beforeRole;
        }
        
        const userPersona = window.userState?.persona || '普通用户';
        const charPersona = this.currentFriend.persona || '普通角色';
        
        let chatContext = '';
        if (this.currentFriend && Array.isArray(this.currentFriend.messages)) {
            const msgs = this.currentFriend.messages.slice(-10);
            if (msgs.length > 0) {
                chatContext = msgs.map(msg => {
                    const sender = msg.sender === 'me' ? 'User' : 'Char';
                    return `${sender}: ${msg.text || '[特殊消息]'}`;
                }).join('\n');
            }
        }
        
        const momentContent = m.text || '[只有图片]';
        const imageCount = (m.images && m.images.length) || 0;
        const isCharMoment = m.isChar === true;
        const momentAuthor = isCharMoment ? '角色(Char)' : '用户(User)';
        let momentDesc = `${momentAuthor}刚才发布了一条动态：\n文字内容：${momentContent}\n附带图片数量：${imageCount} 张`;
        if (options.userComment) {
            momentDesc += `\nUser刚刚在这条动态下评论：${options.userComment}`;
        }

        let prompt = options.reason === 'user_comment'
            ? `你现在要扮演给定的角色(Char)。这条朋友圈动态是 Char 自己发布的，User 刚在下面评论了。请为 Char 生成1条自然回复 User 评论的动态评论，并且可选生成0-2条相关私聊消息。\n`
            : isCharMoment
            ? `你现在要扮演给定的角色(Char)。这条朋友圈动态是 Char 自己刚发布的，请为 Char 生成1-3条对自己动态的延续、补充说明或额外感想，并且给用户(User)的iMessage聊天界面发送1-3条相关私聊消息，可以提醒 User 快去看，也可以聊和这条动态有关的事。\n`
            : `你现在要扮演给定的角色(Char)，为用户(User)刚发布的朋友圈动态写1~2条符合人设的评论，并且根据动态内容，给用户(User)的iMessage聊天界面发送1-3条相关私聊消息。\n`;
        if (globalRule) prompt += `\n【世界书设定】：\n${globalRule}\n`;
        prompt += `\n【角色 (Char) 人设】：\n${charPersona}\n`;
        prompt += `\n【用户 (User) 人设】：\n${userPersona}\n`;
        if (chatContext) prompt += `\n【近期聊天上下文(最近10条)】：\n${chatContext}\n`;
        prompt += `\n【刚才发布的动态】：\n${momentDesc}\n`;
        
        prompt += `\n要求：
1. 你的评论和私聊消息必须极度符合当前的人设、世界观设定以及近期聊天上下文带来的情绪。
2. 返回一个纯 JSON 对象，包含 comments 数组（${options.reason === 'user_comment' ? '1条 Char 回复 User 评论的字符串' : isCharMoment ? '1-3条 Char 对自己动态的补充评论字符串' : '1-2条评论字符串'}）和 messages 数组（${options.reason === 'user_comment' ? '0-2条私聊消息字符串，可以为空数组' : '1-3条私聊消息字符串'}）。不要包含任何 Markdown 标记 (如 \`\`\`json 等)，直接输出合法的 JSON 格式。
3. ${options.reason === 'user_comment' ? 'comments 必须像 Char 直接回复 User 刚刚的评论，可以自然接话，不要写成无关补充。messages 如果生成，要像 Char 私下继续聊这条评论。' : isCharMoment ? 'comments 要像 Char 在自己动态下继续补充想法，不要写成第三方夸赞。messages 要像 Char 主动找 User 聊这条动态。' : 'comments 要像 Char 在评论 User 的动态，messages 要像 Char 私下和 User 聊这条动态。'}
4. 例如：{"comments": ["刚刚发的时候还想补一句。", "这件事其实我还挺在意的。"], "messages": ["我刚发了动态，你有空去看一下。", "其实那条动态里还有点话想跟你说。"]}`;

        const messages = [
            { role: "system", content: "你是一个角色扮演对话助手，严格返回 JSON 格式的字符串数组。" },
            { role: "user", content: prompt }
        ];
        
        const model = window.apiConfig.model || 'gpt-3.5-turbo';
        let endpoint = window.apiConfig.endpoint;
        if (endpoint && !endpoint.endsWith('/chat/completions')) {
            if (endpoint.endsWith('/')) endpoint += 'v1/chat/completions';
            else if (endpoint.endsWith('/v1')) endpoint += '/chat/completions';
            else endpoint += '/v1/chat/completions';
        }

        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + window.apiConfig.apiKey
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.7
            })
        })
        .then(response => {
            if (!response.ok) throw new Error('API Request Failed');
            return response.json();
        })
        .then(async data => {
            let resultText = data.choices?.[0]?.message?.content || "";
            let jsonStr = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const match = jsonStr.match(/\{[\s\S]*\}/);
            if (match) jsonStr = match[0];
            
            try {
                const parsed = JSON.parse(jsonStr);
                const parsedComments = parsed.comments;
                const parsedMessages = parsed.messages;

                let updated = false;

                if (Array.isArray(parsedComments) && parsedComments.length > 0) {
                    if (!m.comments) m.comments = [];
                    parsedComments.forEach(text => {
                        m.comments.push({ text: text, isChar: true, timestamp: Date.now() });
                    });
                    updated = true;
                }
                
                if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
                    const appendTasks = parsedMessages.map((msgText, msgIdx) => {
                        const msgObj = {
                            id: window.imChat && window.imChat.createMessageId ? window.imChat.createMessageId('msg') : 'msg_' + Date.now() + '_' + msgIdx,
                            sender: this.currentFriend.id,
                            role: 'assistant',
                            text: msgText,
                            content: msgText,
                            timestamp: Date.now() + msgIdx * 1000,
                            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
                            type: 'text'
                        };
                        
                        if (window.imApp && window.imApp.appendFriendMessage) {
                            return window.imApp.appendFriendMessage(this.currentFriend.id, msgObj, { silent: false });
                        } else if (this.currentFriend.messages && Array.isArray(this.currentFriend.messages)) {
                            this.currentFriend.messages.push(msgObj);
                        }
                        return Promise.resolve(true);
                    });
                    await Promise.all(appendTasks);
                    updated = true;
                }

                if (updated) {
                    await this.persistFriendState(this.currentFriend, { metaOnly: true });
                    if (window.showToast) window.showToast('评论与消息发送成功');
                    this.renderLovesMoments();
                } else {
                    throw new Error('No comments or messages generated');
                }
            } catch (e) {
                console.error('Comment Parse error', e, '\nOriginal Text:', resultText);
                if (window.showToast) window.showToast('AI 生成格式错误，请重试');
            }
        })
        .catch(err => {
            console.error('Comment API Error:', err);
            if (window.showToast) window.showToast('API 请求失败，无法评论');
        })
        .finally(() => {
            if (m) m._charReplyPending = false;
        });
    },
    
    toggleMomentLike: function(idx) {
        if (!this.currentFriend || !this.currentFriend.lovesData || !this.currentFriend.lovesData.moments) return;
        const m = this.currentFriend.lovesData.moments[idx];
        m.isLiked = !m.isLiked;
        m.likes = (m.likes || 0) + (m.isLiked ? 1 : -1);
        if (m.likes < 0) m.likes = 0;
        this.persistFriendState();
        this.renderLovesMoments();
    },

    ensureSavingsData: function(friend = this.currentFriend) {
        if (!friend) return { goal: 5200, records: [], withdrawals: [] };
        if (!friend.lovesData) friend.lovesData = {};
        if (!friend.lovesData.savings || typeof friend.lovesData.savings !== 'object') {
            friend.lovesData.savings = {};
        }
        const savings = friend.lovesData.savings;
        if (!Number.isFinite(Number(savings.goal)) || Number(savings.goal) <= 0) {
            savings.goal = 5200;
        } else {
            savings.goal = Number(savings.goal);
        }
        if (!Array.isArray(savings.records)) savings.records = [];
        savings.records = savings.records.map((record, index) => ({
            id: record.id || `sav_${Date.now()}_${index}`,
            amount: Math.max(0, Number(record.amount) || 0),
            actor: record.actor === 'char' ? 'char' : 'user',
            date: record.date || this.getLocalDateKey(record.timestamp || new Date()),
            note: String(record.note || ''),
            timestamp: Number(record.timestamp) || Date.now()
        })).filter(record => record.amount > 0);
        if (!Array.isArray(savings.withdrawals)) savings.withdrawals = [];
        savings.withdrawals = savings.withdrawals.map((record, index) => ({
            id: record.id || `wd_${Date.now()}_${index}`,
            amount: Math.max(0, Number(record.amount) || 0),
            actor: 'user',
            date: record.date || this.getLocalDateKey(record.timestamp || new Date()),
            reason: String(record.reason || record.note || ''),
            decisionReason: String(record.decisionReason || ''),
            timestamp: Number(record.timestamp) || Date.now()
        })).filter(record => record.amount > 0);
        return savings;
    },

    getSavingsSummary: function(savings = this.ensureSavingsData()) {
        const records = Array.isArray(savings.records) ? savings.records : [];
        const summary = records.reduce((nextSummary, record) => {
            const amount = Number(record.amount) || 0;
            nextSummary.total += amount;
            if (record.actor === 'char') nextSummary.char += amount;
            else nextSummary.user += amount;
            return nextSummary;
        }, { total: 0, user: 0, char: 0, withdrawn: 0 });
        const withdrawals = Array.isArray(savings.withdrawals) ? savings.withdrawals : [];
        summary.withdrawn = withdrawals.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
        summary.total = Math.max(0, summary.total - summary.withdrawn);
        return summary;
    },

    setSavingsFabCovered: function(covered) {
        const fab = document.getElementById('lovers-space-fab');
        if (!fab) return;

        if (covered) {
            if (fab.dataset.savingsFabCovered !== '1') {
                fab.dataset.savingsPreviousDisplay = fab.style.display || '';
                fab.dataset.savingsPreviousZIndex = fab.style.zIndex || '';
            }
            fab.dataset.savingsFabCovered = '1';
            fab.style.display = 'none';
            return;
        }

        const hasActiveSavingsSheet = [
            'lovers-savings-deposit-sheet',
            'lovers-savings-settings-sheet',
            'lovers-savings-withdraw-sheet',
            'lovers-savings-withdraw-result-modal'
        ].some(id => document.getElementById(id)?.classList.contains('active'));

        if (hasActiveSavingsSheet) return;

        if (fab.dataset.savingsFabCovered === '1') {
            fab.style.display = fab.dataset.savingsPreviousDisplay || 'flex';
            fab.style.zIndex = fab.dataset.savingsPreviousZIndex || '9999';
            delete fab.dataset.savingsFabCovered;
            delete fab.dataset.savingsPreviousDisplay;
            delete fab.dataset.savingsPreviousZIndex;
        }
    },

    closeSavingsSheet: function(sheet, options = {}) {
        if (!sheet) return;
        if (window.closeView) window.closeView(sheet);
        else sheet.classList.remove('active');
        if (!options.keepFabHidden) {
            setTimeout(() => this.setSavingsFabCovered(false), 0);
        }
    },

    openSavingsSheet: function(sheet, focusEl = null) {
        if (!sheet) return;
        sheet.onclick = (e) => {
            if (e.target === sheet) {
                e.stopPropagation();
                this.closeSavingsSheet(sheet);
            }
        };
        this.setSavingsFabCovered(true);
        if (window.openView) window.openView(sheet);
        else sheet.classList.add('active');
        if (focusEl) setTimeout(() => focusEl.focus(), 80);
    },

    getSavingsApiEndpoint: function() {
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) return '';
        let endpoint = window.apiConfig.endpoint;
        if (endpoint && !endpoint.endsWith('/chat/completions')) {
            if (endpoint.endsWith('/')) endpoint += 'v1/chat/completions';
            else if (endpoint.endsWith('/v1')) endpoint += '/chat/completions';
            else endpoint += '/v1/chat/completions';
        }
        return endpoint;
    },

    parseSavingsJsonObject: function(resultText) {
        let jsonStr = String(resultText || '').replace(/```json/gi, '').replace(/```/g, '').trim();
        const match = jsonStr.match(/\{[\s\S]*\}/);
        if (match) jsonStr = match[0];
        return JSON.parse(jsonStr);
    },

    createSavingsMessageId: function(prefix = 'msg') {
        return window.imChat && window.imChat.createMessageId
            ? window.imChat.createMessageId(prefix)
            : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    },

    appendSavingsChatMessage: async function(friend, msgObj, options = {}) {
        if (!friend || !msgObj) return false;
        let saved = false;

        if (window.imApp && window.imApp.appendFriendMessage) {
            saved = await window.imApp.appendFriendMessage(friend.id, msgObj, { silent: options.silent !== false });
        } else {
            if (!Array.isArray(friend.messages)) friend.messages = [];
            friend.messages.push(msgObj);
            saved = true;
        }

        if (!saved) return false;

        const activeFriend = window.imData?.currentActiveFriend &&
            String(window.imData.currentActiveFriend.id) === String(friend.id)
            ? window.imData.currentActiveFriend
            : friend;
        const page = document.getElementById(`chat-interface-${friend.id}`);
        const container = page ? page.querySelector('.ins-chat-messages') : null;
        const isActiveChat = container && window.imData?.currentActiveFriend &&
            String(window.imData.currentActiveFriend.id) === String(friend.id);

        if (isActiveChat && window.imChat?.appendMessageToContainer) {
            const appended = window.imChat.appendMessageToContainer(activeFriend, container, msgObj, { scroll: true });
            if (!appended && window.imChat.rerenderChatContainer) {
                window.imChat.rerenderChatContainer(activeFriend, container, { scroll: true });
            }
        }

        return true;
    },

    normalizeSavingsWithdrawResult: function(parsed, amount, reason) {
        const decision = parsed?.decision === 'reject' ? 'reject' : 'approve';
        const defaultReason = decision === 'reject'
            ? `这笔我先不同意，${reason}这个理由还不够明确。`
            : `可以，这次先从存钱罐给你提 ${amount.toFixed(2)}。`;
        const decisionReason = String(parsed?.reason || parsed?.decisionReason || parsed?.approveReason || parsed?.rejectReason || defaultReason).trim() || defaultReason;
        let messages = Array.isArray(parsed?.messages)
            ? parsed.messages.map(item => String(item || '').trim()).filter(Boolean)
            : [];
        const fallbackMessages = decision === 'reject'
            ? [
                `这笔我先不同意，${reason}这个理由我还想再问清楚一点。`,
                `你先别急着提，跟我说说到底怎么用。`
            ]
            : [
                `可以，你先拿去用。`,
                amount <= 50 ? `就提 ${amount.toFixed(2)} 够不够？` : `这笔我同意，记得别乱花。`
            ];
        fallbackMessages.forEach(text => {
            if (messages.length < 2) messages.push(text);
        });
        messages = messages.slice(0, 5);

        const rawExtra = parsed?.extraSupport && typeof parsed.extraSupport === 'object'
            ? parsed.extraSupport
            : (parsed?.payment && typeof parsed.payment === 'object' ? parsed.payment : {});
        let extraType = String(rawExtra.type || 'none').trim();
        if (extraType === 'red_packet') extraType = 'transfer';
        if (!['none', 'transfer', 'family_card', 'family_card_increase'].includes(extraType)) extraType = 'none';

        const extraAmount = Number.isFinite(Number(rawExtra.amount)) && Number(rawExtra.amount) > 0
            ? Math.round(Number(rawExtra.amount) * 100) / 100
            : 0;
        if (extraAmount <= 0) extraType = 'none';

        return {
            decision,
            reason: decisionReason,
            messages,
            extraSupport: {
                type: extraType,
                amount: extraAmount,
                description: String(rawExtra.description || 'TA 额外补贴').trim() || 'TA 额外补贴'
            }
        };
    },

    openSavingsJar: function() {
        if (!this.currentFriend) {
            if (window.showToast) window.showToast('请先进入情侣空间');
            return;
        }
        const savingsView = document.getElementById('lovers-savings-view');
        if (!savingsView) return;

        this.ensureSavingsData();
        const spaceView = document.getElementById('lovers-space-view');
        if (spaceView && savingsView.parentElement !== spaceView) {
            spaceView.appendChild(savingsView);
        }
        savingsView.classList.add('active');
        const fab = document.getElementById('lovers-space-fab');
        if (fab) {
            fab.style.display = 'flex';
            fab.style.zIndex = '9999';
        }

        const backBtn = document.getElementById('lovers-savings-back-btn');
        if (backBtn) {
            backBtn.onclick = () => {
                savingsView.classList.remove('active');
            };
        }

        const addBtn = document.getElementById('lovers-savings-add-btn');
        if (addBtn) {
            addBtn.onclick = () => this.openSavingsSettingsSheet();
        }

        const dateFilter = document.getElementById('lovers-savings-date-filter');
        if (dateFilter) {
            dateFilter.onchange = () => this.renderSavingsJar();
        }

        this.renderSavingsJar();
    },

    renderSavingsJar: function() {
        if (!this.currentFriend) return;
        const savings = this.ensureSavingsData();
        const summary = this.getSavingsSummary(savings);
        const friendName = this.currentFriend.nickname || this.currentFriend.realname || 'TA';
        const userName = window.userState?.name || window.imData?.profile?.name || '我';
        const percent = savings.goal > 0 ? Math.min(100, Math.round((summary.total / savings.goal) * 100)) : 0;

        const totalEl = document.getElementById('lovers-savings-total');
        const goalEl = document.getElementById('lovers-savings-goal');
        const percentEl = document.getElementById('lovers-savings-percent');
        const progressEl = document.getElementById('lovers-savings-progress');
        const userAmountEl = document.getElementById('lovers-savings-user-amount');
        const charAmountEl = document.getElementById('lovers-savings-char-amount');
        const userNameEl = document.getElementById('lovers-savings-user-name');
        const charNameEl = document.getElementById('lovers-savings-char-name');
        const leftEl = document.getElementById('lovers-savings-left');
        const dateFilter = document.getElementById('lovers-savings-date-filter');
        const selectedDateLabel = document.getElementById('lovers-savings-selected-date');
        const listEl = document.getElementById('lovers-savings-records');

        if (totalEl) totalEl.textContent = this.formatMoney(summary.total);
        if (goalEl) goalEl.textContent = `目标 ${this.formatMoney(savings.goal)}`;
        if (percentEl) percentEl.textContent = `${percent}%`;
        if (progressEl) progressEl.style.width = `${percent}%`;
        if (userAmountEl) userAmountEl.textContent = this.formatMoney(summary.user);
        if (charAmountEl) charAmountEl.textContent = this.formatMoney(summary.char);
        if (userNameEl) userNameEl.textContent = userName;
        if (charNameEl) charNameEl.textContent = friendName;
        if (leftEl) leftEl.textContent = summary.total >= savings.goal ? '目标已达成' : `还差 ${this.formatMoney(savings.goal - summary.total)}`;

        if (dateFilter && !dateFilter.value) {
            dateFilter.value = this.getLocalDateKey();
        }

        const selectedDate = dateFilter?.value || this.getLocalDateKey();
        const selectedDateObj = this.parseDateKey(selectedDate);
        if (selectedDateLabel) {
            selectedDateLabel.textContent = `${selectedDateObj.getMonth() + 1}月${selectedDateObj.getDate()}日`;
        }

        const depositRecords = savings.records
            .filter(record => record.date === selectedDate)
            .map(record => ({ ...record, kind: 'deposit' }));
        const withdrawalRecords = (Array.isArray(savings.withdrawals) ? savings.withdrawals : [])
            .filter(record => record.date === selectedDate)
            .map(record => ({ ...record, kind: 'withdrawal' }));
        const dayRecords = depositRecords
            .concat(withdrawalRecords)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const dayUser = depositRecords.filter(record => record.actor !== 'char').reduce((sum, record) => sum + Number(record.amount || 0), 0);
        const dayChar = depositRecords.filter(record => record.actor === 'char').reduce((sum, record) => sum + Number(record.amount || 0), 0);

        const dayUserEl = document.getElementById('lovers-savings-day-user');
        const dayCharEl = document.getElementById('lovers-savings-day-char');
        if (dayUserEl) dayUserEl.textContent = this.formatMoney(dayUser);
        if (dayCharEl) dayCharEl.textContent = this.formatMoney(dayChar);

        if (!listEl) return;
        if (dayRecords.length === 0) {
            listEl.innerHTML = `
                <div class="lovers-savings-empty">
                    <i class="fas fa-piggy-bank"></i>
                    <div>这天还没有存入记录</div>
                </div>
            `;
            return;
        }

        listEl.innerHTML = dayRecords.map((record) => {
            const isWithdrawal = record.kind === 'withdrawal';
            const isChar = record.actor === 'char';
            const actorName = isChar ? friendName : userName;
            const time = new Date(record.timestamp || Date.now()).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            return `
                <div class="lovers-savings-record ${isWithdrawal ? 'is-withdrawal' : ''}" data-record-id="${record.id}">
                    <div class="lovers-savings-record-icon ${isChar ? 'is-char' : 'is-user'}">
                        <i class="fas ${isWithdrawal ? 'fa-arrow-up-from-bracket' : (isChar ? 'fa-heart' : 'fa-coins')}"></i>
                    </div>
                    <div class="lovers-savings-record-main">
                        <div class="lovers-savings-record-top">
                            <span>${isWithdrawal ? '提款到 Pay' : this.escapeHTML(actorName)}</span>
                            <strong>${isWithdrawal ? '-' : ''}${this.formatMoney(record.amount)}</strong>
                        </div>
                        <div class="lovers-savings-record-meta">
                            <span>${time}</span>
                            ${isWithdrawal
                                ? `<span>${this.escapeHTML(record.reason || '存钱罐提款')}</span>`
                                : (record.note ? `<span>${this.escapeHTML(record.note)}</span>` : '')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    openSavingsDepositSheet: function(defaultActor = 'user') {
        if (!this.currentFriend) return;
        const sheet = document.getElementById('lovers-savings-deposit-sheet');
        if (!sheet) return;
        const savingsView = document.getElementById('lovers-savings-view');
        if (savingsView && sheet.parentElement !== savingsView) {
            savingsView.appendChild(sheet);
        }

        const amountInput = document.getElementById('lovers-savings-amount-input');
        const dateInput = document.getElementById('lovers-savings-date-input');
        const noteInput = document.getElementById('lovers-savings-note-input');
        const actorInput = document.getElementById('lovers-savings-actor-input');
        const friendName = this.currentFriend.nickname || this.currentFriend.realname || 'TA';

        if (amountInput) amountInput.value = '';
        if (dateInput) dateInput.value = this.getLocalDateKey();
        if (noteInput) noteInput.value = '';
        if (actorInput) {
            actorInput.innerHTML = `
                <option value="user">我</option>
                <option value="char">${this.escapeHTML(friendName)}</option>
            `;
            actorInput.value = defaultActor === 'char' ? 'char' : 'user';
        }

        const cancelBtn = document.getElementById('lovers-savings-deposit-cancel');
        if (cancelBtn) cancelBtn.onclick = () => this.closeSavingsSheet(sheet);

        const saveBtn = document.getElementById('lovers-savings-deposit-save');
        if (saveBtn) {
            saveBtn.onclick = () => this.addSavingsRecord();
        }

        this.openSavingsSheet(sheet, amountInput);
    },

    openSavingsSettingsSheet: function() {
        if (!this.currentFriend) return;
        const sheet = document.getElementById('lovers-savings-settings-sheet');
        if (!sheet) return;
        const savingsView = document.getElementById('lovers-savings-view');
        if (savingsView && sheet.parentElement !== savingsView) {
            savingsView.appendChild(sheet);
        }

        const savings = this.ensureSavingsData();
        const goalInput = document.getElementById('lovers-savings-goal-input');
        if (goalInput) goalInput.value = String(savings.goal || 5200);

        const cancelBtn = document.getElementById('lovers-savings-settings-cancel');
        if (cancelBtn) cancelBtn.onclick = () => this.closeSavingsSheet(sheet);

        const saveBtn = document.getElementById('lovers-savings-settings-save');
        if (saveBtn) saveBtn.onclick = () => this.saveSavingsSettings();

        const withdrawBtn = document.getElementById('lovers-savings-withdraw-btn');
        if (withdrawBtn) {
            withdrawBtn.onclick = () => {
                this.closeSavingsSheet(sheet, { keepFabHidden: true });
                this.openSavingsWithdrawSheet();
            };
        }

        this.openSavingsSheet(sheet, goalInput);
    },

    saveSavingsSettings: function() {
        if (!this.currentFriend) return;
        const sheet = document.getElementById('lovers-savings-settings-sheet');
        const goalInput = document.getElementById('lovers-savings-goal-input');
        const nextGoal = Number(goalInput?.value);

        if (!Number.isFinite(nextGoal) || nextGoal <= 0) {
            if (window.showToast) window.showToast('请输入有效目标金额');
            return;
        }

        const savings = this.ensureSavingsData();
        savings.goal = Math.round(nextGoal * 100) / 100;
        this.persistFriendState();
        this.renderSavingsJar();
        this.closeSavingsSheet(sheet);
        if (window.showToast) window.showToast('目标已更新');
    },

    openSavingsWithdrawSheet: function() {
        if (!this.currentFriend) return;
        const sheet = document.getElementById('lovers-savings-withdraw-sheet');
        if (!sheet) return;
        const savingsView = document.getElementById('lovers-savings-view');
        if (savingsView && sheet.parentElement !== savingsView) {
            savingsView.appendChild(sheet);
        }

        const amountInput = document.getElementById('lovers-savings-withdraw-amount-input');
        const reasonInput = document.getElementById('lovers-savings-withdraw-reason-input');
        if (amountInput) amountInput.value = '';
        if (reasonInput) reasonInput.value = '';

        const cancelBtn = document.getElementById('lovers-savings-withdraw-cancel');
        if (cancelBtn) cancelBtn.onclick = () => this.closeSavingsSheet(sheet);

        const sendBtn = document.getElementById('lovers-savings-withdraw-send');
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = '发送请求';
            sendBtn.onclick = () => this.sendSavingsWithdrawRequest();
        }

        this.openSavingsSheet(sheet, amountInput);
    },

    sendSavingsWithdrawRequest: async function() {
        if (!this.currentFriend) return;

        const sheet = document.getElementById('lovers-savings-withdraw-sheet');
        const amountInput = document.getElementById('lovers-savings-withdraw-amount-input');
        const reasonInput = document.getElementById('lovers-savings-withdraw-reason-input');
        const sendBtn = document.getElementById('lovers-savings-withdraw-send');
        const amount = Number(amountInput?.value);
        const reason = String(reasonInput?.value || '').trim();

        if (!Number.isFinite(amount) || amount <= 0) {
            if (window.showToast) window.showToast('请输入有效提款金额');
            return;
        }

        if (!reason) {
            if (window.showToast) window.showToast('请输入提款理由');
            return;
        }

        const endpoint = this.getSavingsApiEndpoint();
        if (!endpoint || !window.apiConfig?.apiKey) {
            if (window.showToast) window.showToast('请先在系统设置中配置 API');
            return;
        }

        const friend = this.currentFriend;
        if (window.imApp?.ensureFriendMessagesLoaded) {
            await window.imApp.ensureFriendMessagesLoaded(friend);
        }

        const savings = this.ensureSavingsData(friend);
        const summary = this.getSavingsSummary(savings);
        const friendName = friend.nickname || friend.realname || friend.realName || friend.name || 'TA';
        const userPersona = window.userState?.persona || '普通用户';
        const charPersona = friend.persona || '普通角色';
        const recentMessages = Array.isArray(friend.messages) ? friend.messages.slice(-10) : [];
        const chatContext = recentMessages.map(msg => {
            const sender = msg.role === 'user' || msg.sender === 'me' ? 'User' : 'Char';
            let content = msg.text || msg.content || '';
            if (msg.type === 'pay_transfer') {
                content = `[支付卡片] ${msg.description || msg.cardTitle || ''} ${msg.amount ? `¥${Number(msg.amount).toFixed(2)}` : ''}`.trim();
            }
            content = String(content || '[特殊消息]').replace(/<[^>]+>/g, '').slice(0, 180);
            return `${sender}: ${content}`;
        }).join('\n');

        let globalRule = '';
        if (window.getGlobalWorldBookContextByPosition) {
            globalRule = window.getGlobalWorldBookContextByPosition('system_depth') || '';
            const beforeRole = window.getGlobalWorldBookContextByPosition('before_role');
            if (beforeRole) globalRule += '\n' + beforeRole;
        }

        const prompt = `你现在扮演 Char，需要处理情侣共享存钱罐的一次提款请求。

【提款请求】
User 想从存钱罐提款：¥${amount.toFixed(2)}
提款理由：${reason}

【存钱罐状态】
存钱目标：${this.formatMoney(savings.goal)}
当前总额：${this.formatMoney(summary.total)}
User 已存：${this.formatMoney(summary.user)}
Char 已存：${this.formatMoney(summary.char)}

${globalRule ? `【世界书设定】\n${globalRule}\n\n` : ''}【角色(Char)人设】
${charPersona}

【用户(User)人设】
${userPersona}

${chatContext ? `【近期 iMessage 上下文】\n${chatContext}\n\n` : ''}要求：
1. 你必须以 Char 的身份决定同意或拒绝这次提款，decision 只能是 "approve" 或 "reject"。
2. 返回 reason，作为 Char 给出的同意理由或拒绝理由，语气要符合人设和上下文。
3. 提款本金来自存钱罐，不是 Char 的钱；如果同意，系统会把这笔钱直接转入 User 的 Pay，并从存钱罐余额扣除。
4. 生成 messages 数组，包含 2-5 条 Char 会发给 User 的 iMessage 单聊文本，要围绕提款理由自然展开。
5. extraSupport 是 Char 额外拿自己的钱或亲属卡补贴 User，完全看 Char 本人意愿，不是强制项；不想额外补贴时必须写 {"type":"none"}。如果补贴，type 可为 "transfer"、"family_card"、"family_card_increase"。
6. 如果拒绝，extraSupport.type 必须是 "none"。
7. 如果提款金额超过当前总额，必须拒绝。
8. 只返回纯 JSON，不要 Markdown，不要多余解释。格式如下：
{"decision":"approve","reason":"可以，你先拿去买吃的。","messages":["吃什么？","就提这么点够不够？"],"extraSupport":{"type":"none"}}`;

        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.textContent = '发送中';
        }
        if (window.showToast) window.showToast('正在发送提款请求...');

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + window.apiConfig.apiKey
                },
                body: JSON.stringify({
                    model: window.apiConfig.model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: '你是角色扮演对话助手，必须严格返回合法 JSON 对象。' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.75
                })
            });

            if (!response.ok) throw new Error('API Request Failed');
            const data = await response.json();
            const resultText = data.choices?.[0]?.message?.content || '';
            const parsed = this.parseSavingsJsonObject(resultText);
            const result = this.normalizeSavingsWithdrawResult(parsed, Math.round(amount * 100) / 100, reason);

            if (result.decision === 'approve' && amount > summary.total) {
                result.decision = 'reject';
                result.reason = `存钱罐当前只有 ${this.formatMoney(summary.total)}，不够提款 ${this.formatMoney(amount)}。`;
                result.extraSupport = { type: 'none', amount: 0, description: '' };
            }

            const baseTime = Date.now();
            if (result.decision === 'approve') {
                if (typeof window.addPayTransaction !== 'function') {
                    throw new Error('Pay API unavailable');
                }

                const incomeSuccess = window.addPayTransaction(amount, `存钱罐提款 · ${friendName}`, 'income');
                if (!incomeSuccess) throw new Error('Pay income failed');

                const now = new Date();
                const date = this.getLocalDateKey(now);
                savings.withdrawals.unshift({
                    id: 'wd_' + Date.now(),
                    amount: Math.round(amount * 100) / 100,
                    actor: 'user',
                    date,
                    reason,
                    decisionReason: result.reason,
                    timestamp: now.getTime()
                });
                const dateFilter = document.getElementById('lovers-savings-date-filter');
                if (dateFilter) dateFilter.value = date;
            }

            for (let idx = 0; idx < result.messages.length; idx++) {
                const msgTime = baseTime + (idx + 1) * 1000;
                const msgText = result.messages[idx];
                const msgObj = {
                    id: this.createSavingsMessageId('msg'),
                    sender: friend.id,
                    role: 'assistant',
                    type: 'text',
                    text: msgText,
                    content: msgText,
                    timestamp: msgTime,
                    time: new Date(msgTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
                };
                await this.appendSavingsChatMessage(friend, msgObj, { silent: false });
            }

            if (result.decision === 'approve' && result.extraSupport.type !== 'none') {
                const paymentMsg = this.createSavingsPaymentMessage(friend, result.extraSupport, baseTime + (result.messages.length + 1) * 1000);
                if (paymentMsg) {
                    await this.appendSavingsChatMessage(friend, paymentMsg, { silent: false });
                }
            }

            await this.persistFriendState(friend);
            this.renderSavingsJar();
            this.closeSavingsSheet(sheet, { keepFabHidden: true });
            this.openSavingsWithdrawResultModal({
                decision: result.decision,
                reason: result.reason,
                amount: Math.round(amount * 100) / 100
            });
        } catch (err) {
            console.error('Savings withdraw request failed:', err);
            if (window.showToast) window.showToast('提款请求发送失败，请重试');
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = '发送请求';
            }
        }
    },

    openSavingsWithdrawResultModal: function(result) {
        const modal = document.getElementById('lovers-savings-withdraw-result-modal');
        if (!modal) return;
        const savingsView = document.getElementById('lovers-savings-view');
        if (savingsView && modal.parentElement !== savingsView) {
            savingsView.appendChild(modal);
        }

        const approved = result?.decision === 'approve';
        const titleEl = document.getElementById('lovers-savings-withdraw-result-title');
        const amountEl = document.getElementById('lovers-savings-withdraw-result-amount');
        const labelEl = document.getElementById('lovers-savings-withdraw-result-reason-label');
        const reasonEl = document.getElementById('lovers-savings-withdraw-result-reason-text');
        const iconEl = document.getElementById('lovers-savings-withdraw-result-icon');
        const closeBtn = document.getElementById('lovers-savings-withdraw-result-close');
        const okBtn = document.getElementById('lovers-savings-withdraw-result-ok');

        modal.classList.toggle('is-approved', approved);
        modal.classList.toggle('is-rejected', !approved);
        if (titleEl) titleEl.textContent = approved ? 'TA 已同意' : 'TA 已拒绝';
        if (amountEl) amountEl.textContent = this.formatMoney(result?.amount || 0);
        if (labelEl) labelEl.textContent = approved ? '同意理由' : '拒绝理由';
        if (reasonEl) reasonEl.textContent = result?.reason || (approved ? 'TA 同意了这次提款。' : 'TA 拒绝了这次提款。');
        if (iconEl) {
            iconEl.innerHTML = `<i class="fas ${approved ? 'fa-check' : 'fa-xmark'}"></i>`;
        }

        const closeModal = () => this.closeSavingsSheet(modal);
        if (closeBtn) closeBtn.onclick = closeModal;
        if (okBtn) okBtn.onclick = closeModal;
        this.openSavingsSheet(modal);
    },

    createSavingsPaymentMessage: function(friend, payment, timestamp = Date.now()) {
        if (!friend || !payment || payment.type === 'none') return null;

        const amount = Number(payment.amount) || 0;
        if (!Number.isFinite(amount) || amount <= 0) return null;

        const friendName = friend.nickname || friend.realname || friend.realName || friend.name || 'Char';
        const userName = window.userState?.name || window.userState?.realName || window.userState?.nickname || window.imData?.profile?.name || 'User';
        const description = String(payment.description || '存钱罐提款').trim() || '存钱罐提款';

        if (payment.type === 'family_card' || payment.type === 'family_card_increase') {
            let titleStr = payment.type === 'family_card_increase' ? '提升亲属卡额度' : '赠送亲属卡';
            if (typeof window.addOrUpdateFamilyCard === 'function') {
                const result = window.addOrUpdateFamilyCard(friend.id, friendName, amount);
                titleStr = result?.action === 'increase' ? '提升亲属卡额度' : '赠送亲属卡';
            }
            return {
                id: this.createSavingsMessageId('pay'),
                sender: friend.id,
                role: 'assistant',
                type: 'pay_transfer',
                payKind: 'system_notification',
                payDirection: 'char_to_user',
                amount,
                description: `${titleStr} ¥${amount.toFixed(2)}`,
                payerName: friendName,
                payeeName: userName,
                senderName: friendName,
                receiverName: userName,
                targetName: userName,
                cardTitle: titleStr,
                payStatus: 'completed',
                content: `[亲属卡] ${titleStr} ¥${amount.toFixed(2)}`,
                timestamp
            };
        }

        return {
            id: this.createSavingsMessageId('pay'),
            sender: friend.id,
            role: 'assistant',
            type: 'pay_transfer',
            payKind: 'char_to_user_pending',
            payDirection: 'char_to_user',
            amount,
            description,
            payerName: friendName,
            payeeName: userName,
            senderName: friendName,
            receiverName: userName,
            targetName: userName,
            cardTitle: '转账',
            payStatus: 'pending',
            content: `[转账] ${description} ¥${amount.toFixed(2)}`,
            timestamp
        };
    },

    addSavingsRecord: function() {
        if (!this.currentFriend) return;
        const amountInput = document.getElementById('lovers-savings-amount-input');
        const dateInput = document.getElementById('lovers-savings-date-input');
        const noteInput = document.getElementById('lovers-savings-note-input');
        const actorInput = document.getElementById('lovers-savings-actor-input');
        const sheet = document.getElementById('lovers-savings-deposit-sheet');

        const amount = Number(amountInput?.value);
        if (!Number.isFinite(amount) || amount <= 0) {
            if (window.showToast) window.showToast('请输入有效金额');
            return;
        }

        const savings = this.ensureSavingsData();
        const date = dateInput?.value || this.getLocalDateKey();
        const now = new Date();
        const recordDate = this.parseDateKey(date);
        recordDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

        savings.records.unshift({
            id: 'sav_' + Date.now(),
            amount: Math.round(amount * 100) / 100,
            actor: actorInput?.value === 'char' ? 'char' : 'user',
            date: date,
            note: (noteInput?.value || '').trim(),
            timestamp: recordDate.getTime()
        });

        const dateFilter = document.getElementById('lovers-savings-date-filter');
        if (dateFilter) dateFilter.value = date;

        this.persistFriendState();
        this.renderSavingsJar();
        this.closeSavingsSheet(sheet);
        if (window.showToast) window.showToast('已存入存钱罐');
    },

    open: function() {
        if (!this.initialized) {
            this.init();
        }
        
        if (this.view) {
            this.scanForAcceptance();
            window.openView(this.view);
            this.renderTopFriends();
        }
    },
    
    scanForAcceptance: function() {
        const friends = window.imData?.friends || [];
        let updated = false;

        friends.forEach(friend => {
            if (friend.pendingLovesInvite && !friend.hasLovesSpace) {
                const msgs = Array.isArray(friend.messages) ? friend.messages : [];
                for (let i = msgs.length - 1; i >= 0; i--) {
                    const msg = msgs[i];
                    if (msg.sender !== 'me' && msg.text && msg.text.includes('[ACCEPT_INVITE]')) {
                        // Found acceptance
                        friend.hasLovesSpace = true;
                        friend.pendingLovesInvite = false;
                        
                        // Replace the tag in the original message
                        msg.text = msg.text.replace(/\[ACCEPT_INVITE\]/g, '').trim();
                        if (msg.content) {
                            msg.content = msg.content.replace(/\[ACCEPT_INVITE\]/g, '').trim();
                        }
                        
                        // Append the visual card
                        const acceptMsg = {
                            id: window.imChat && window.imChat.createMessageId ? window.imChat.createMessageId('msg') : 'msg_' + Date.now(),
                            sender: msg.sender,
                            role: 'assistant',
                            content: `<div class="loves-invite-bubble" style="background:#fff; border-radius:16px; padding:12px; border:1px solid #e5e5ea;  color:#111; max-width:220px; margin:2px;">
                                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                                    <div style="width:28px; height:28px; border-radius:8px; background:#ff2d55; color:#fff; display:flex; justify-content:center; align-items:center; font-size:14px;"><i class="fas fa-heart"></i></div>
                                    <div style="font-size:14px; font-weight:700;">邀请已接受</div>
                                </div>
                                <div style="font-size:13px; color:#333; line-height:1.4;">TA 已接受了你的情侣空间邀请。</div>
                            </div>`,
                            text: '【邀请已接受】TA 已接受了你的情侣空间邀请。',
                            timestamp: Date.now(),
                            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
                            type: 'html'
                        };
                        
                        msgs.push(acceptMsg);
                        updated = true;
                        break; // Stop scanning for this friend
                    }
                }
            }
        });

        if (updated) {
            friends.forEach(friend => {
                if (friend.hasLovesSpace) this.persistFriendState(friend, { metaOnly: true });
            });
        }
    },

    handleInviteAccepted: async function(friend) {
        if (!friend) return;
        
        friend.hasLovesSpace = true;
        friend.pendingLovesInvite = false;
        
        const acceptMsg = {
            id: window.imChat && window.imChat.createMessageId ? window.imChat.createMessageId('msg') : 'msg_' + Date.now(),
            sender: friend.id,
            role: 'assistant',
            content: `<div class="loves-invite-bubble" style="background:#fff; border-radius:16px; padding:12px; border:1px solid #e5e5ea;  color:#111; max-width:220px; margin:2px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <div style="width:28px; height:28px; border-radius:8px; background:#ff2d55; color:#fff; display:flex; justify-content:center; align-items:center; font-size:14px;"><i class="fas fa-heart"></i></div>
                    <div style="font-size:14px; font-weight:700;">邀请已接受</div>
                </div>
                <div style="font-size:13px; color:#333; line-height:1.4;">我已经接受了你的情侣空间邀请，现在我们可以一起使用了。</div>
            </div>`,
            text: '【情侣空间】我接受了你的邀请',
            timestamp: Date.now() - 100, // 稍微提早一点以便排在前面
            type: 'html'
        };
        
        if (window.imApp && window.imApp.appendFriendMessage) {
            await window.imApp.appendFriendMessage(friend.id, acceptMsg, { silent: true });
        } else if (friend.messages && Array.isArray(friend.messages)) {
            friend.messages.push(acceptMsg);
        }
        
        await this.persistFriendState(friend, { metaOnly: true });
        
        // 尝试立即渲染到聊天面板中
        const pageId = `chat-interface-${friend.id}`;
        const page = document.getElementById(pageId);
        if (page) {
            const container = page.querySelector('.ins-chat-messages');
            if (container && window.imChat && window.imChat.appendMessageToContainer) {
                // 将接受卡片动态添加到 DOM，不刷新整个列表，避免抖动
                window.imChat.appendMessageToContainer(friend, container, acceptMsg);
            }
        }

        // 如果当前打开的是这名好友的 Loves 详情页，立即更新按钮状态
        const detailName = document.getElementById('loves-detail-name');
        const detailArea = document.getElementById('loves-detail-area');
        if (detailArea && detailArea.style.display === 'flex' && detailName) {
            const expectedName = friend.nickname || friend.realname || 'Unknown';
            if (detailName.textContent === expectedName) {
                this.showFriendDetail(friend);
            }
        }
    },

    getTopFriends: function() {
        const allFriends = Array.isArray(window.imData?.friends) ? window.imData.friends : [];
        return allFriends.filter(f => f && f.type !== 'group' && f.type !== 'npc');
    },
    
    renderTopFriends: function() {
        const container = document.getElementById('loves-board');
        if (!container) return;
        
        container.innerHTML = '';
        
        // 获取有效的好友列表 (排除群组, 官方号, NPC)
        const validFriends = this.getTopFriends();
        
        if (validFriends.length === 0) {
            container.innerHTML = `
                <div class="loves-placeholder">
                    <i class="fas fa-heart-crack"></i>
                    <p>暂无好友可生成便利贴</p>
                </div>
            `;
            return;
        }

        validFriends.forEach((friend, idx) => {
            const note = document.createElement('div');
            note.className = 'loves-note';
            
            // 头像区
            const avatarWrapper = document.createElement('div');
            avatarWrapper.className = 'loves-note-avatar';
            if (friend.avatarUrl) {
                const img = document.createElement('img');
                img.src = friend.avatarUrl;
                avatarWrapper.appendChild(img);
            } else {
                const icon = document.createElement('i');
                icon.className = 'fas fa-user';
                avatarWrapper.appendChild(icon);
            }
            
            // 中间信息区
            const infoArea = document.createElement('div');
            infoArea.className = 'loves-note-info';
            
            const nameEl = document.createElement('div');
            nameEl.className = 'loves-note-name';
            nameEl.textContent = friend.nickname || friend.realname || 'Unknown';
            
            const signEl = document.createElement('div');
            signEl.className = 'loves-note-sign';
            signEl.textContent = friend.signature || '新朋友加入，快去打个招呼吧';
            
            infoArea.appendChild(nameEl);
            infoArea.appendChild(signEl);
            
            // 右侧按钮区
            const actionBtn = document.createElement('div');
            actionBtn.className = 'loves-note-action';
            
            if (friend.hasLovesSpace) {
                actionBtn.textContent = '进入空间';
                actionBtn.classList.add('loves-note-action-enter');
                note.onclick = (e) => {
                    e.stopPropagation();
                    this.enterLovesSpace(friend);
                };
            } else {
                actionBtn.textContent = '发送邀请';
                actionBtn.classList.add('loves-note-action-invite');
                actionBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.sendInviteCard(friend);
                    // 假设发送后重新渲染界面
                    setTimeout(() => this.renderTopFriends(), 500);
                };
            }
            
            note.appendChild(avatarWrapper);
            note.appendChild(infoArea);
            note.appendChild(actionBtn);
            
            container.appendChild(note);
        });
    },
    
    // showFriendDetail 已废弃，因为按钮直接放在头像下方了
    showFriendDetail: function(friend) {
        // do nothing
    },
    
    sendInviteCard: async function(friend) {
        const inviteMsg = {
            id: window.imChat && window.imChat.createMessageId ? window.imChat.createMessageId('msg') : 'msg_' + Date.now(),
            sender: 'me',
            role: 'user',
            content: `<div class="loves-invite-bubble" style="background:#fff; border-radius:16px; padding:12px; border:1px solid #e5e5ea;  color:#111; max-width:220px; margin:2px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <div style="width:28px; height:28px; border-radius:8px; background:#000; color:#fff; display:flex; justify-content:center; align-items:center; font-size:14px;"><i class="fas fa-heart"></i></div>
                    <div style="font-size:14px; font-weight:700;">Loves 邀请</div>
                </div>
                <div style="font-size:13px; color:#333; line-height:1.4; margin-bottom:8px;">我向你发送了情侣空间的邀请，快来接受吧！</div>
                <div style="font-size:11px; color:#8e8e93;">点击接受进入专属空间</div>
            </div>`,
            text: '【情侣空间邀请】我向你发送了情侣空间的邀请，快来接受吧！',
            timestamp: Date.now(),
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
            type: 'html'
        };
        
        // 尝试通过 imApp 接口追加消息，如果不存在则直接 push
        let saved = true;
        if (window.imApp && window.imApp.appendFriendMessage) {
            saved = await window.imApp.appendFriendMessage(friend.id, inviteMsg, { silent: false });
        } else if (friend.messages && Array.isArray(friend.messages)) {
             friend.messages.push(inviteMsg);
        } else {
             friend.messages = [inviteMsg];
        }
        if (!saved) return;
        
        friend.pendingLovesInvite = true;
        // 注意：这里移除了强制设置 friend.hasLovesSpace = true，改由AI回复后更新

        await this.persistFriendState(friend, { metaOnly: true });
        
        if (window.showToast) {
            window.showToast('已向 ' + (friend.nickname || friend.realname) + ' 发送邀请！');
        }
        
        // 动态更新列表中的按钮状态（仅模拟，实际上需要对方接受）
        this.renderTopFriends();
    },

    getWeiboRandomAvatar: function(friend) {
        const seed = encodeURIComponent(String(friend?.id || friend?.nickname || Date.now()));
        return `https://picsum.photos/seed/weibo_alt_${seed}/160/160`;
    },

    getWeiboRandomImage: function(friend, index = 0, account = 'main') {
        const seed = encodeURIComponent(`${friend?.id || friend?.nickname || 'friend'}_${account}_${index}`);
        return `https://picsum.photos/seed/weibo_photo_${seed}/600/600`;
    },

    getWeiboRandomCover: function(friend, account = 'main') {
        const seed = encodeURIComponent(`${friend?.id || friend?.nickname || 'friend'}_${account}`);
        return `https://picsum.photos/seed/weibo_cover_${seed}/800/300`;
    },

    normalizeWeiboPost: function(post, index = 0, liked = false) {
        const safePost = post && typeof post === 'object' ? post : {};
        const rawComments = Array.isArray(safePost.comments) ? safePost.comments : [];
        const comments = rawComments.map((comment, cIdx) => {
            if (typeof comment === 'string') {
                return { author: `评论用户${cIdx + 1}`, text: comment };
            }
            return {
                author: comment?.author || comment?.name || `评论用户${cIdx + 1}`,
                text: comment?.text || comment?.content || '说得很对。'
            };
        });
        return {
            id: safePost.id || `post_${Date.now()}_${index}`,
            author: safePost.author || safePost.name || '',
            text: safePost.text || safePost.content || safePost.title || '',
            time: safePost.time || safePost.createdAt || '',
            source: safePost.source || '来自 iPhone',
            comments: comments.slice(0, 8),
            reposts: safePost.reposts ?? safePost.repostCount ?? Math.max(1, index + 2),
            likes: safePost.likes ?? safePost.likeCount ?? (liked ? 128 + index * 31 : 76 + index * 27),
            likedByMe: liked || safePost.likedByMe === true
        };
    },

    normalizeWeiboAlbumItem: function(item, index = 0, friend = null, account = 'main') {
        const safeItem = item && typeof item === 'object' ? item : {};
        return {
            id: safeItem.id || `album_${account}_${index}`,
            url: safeItem.url || safeItem.image || safeItem.imageUrl || this.getWeiboRandomImage(friend, index, account),
            description: safeItem.description || safeItem.desc || safeItem.content || ''
        };
    },

    getDefaultWeiboData: function(friend) {
        return {
            mainAccount: {
                signature: '',
                posts: [],
                album: [],
                liked: []
            }
        };
    },

    normalizeWeiboAccount: function(rawAccount, friend, account = 'main') {
        const defaultData = this.getDefaultWeiboData(friend).mainAccount;
        const source = rawAccount && typeof rawAccount === 'object' ? rawAccount : {};
        const displayName = friend?.nickname || friend?.realname || friend?.realName || friend?.name || '好友';
        const isAlt = account === 'alt';
        const name = isAlt ? (source.name || '未公开小号') : displayName;
        const avatarUrl = isAlt ? (source.avatarUrl || this.getWeiboRandomAvatar(friend)) : (friend?.avatarUrl || '');
        const ensureGeneratedItems = (items, fallbackItems) => {
            const list = Array.isArray(items) ? items.slice(0, 3) : [];
            if (!Array.isArray(items)) return [];
            const fallback = Array.isArray(fallbackItems) && fallbackItems.length ? fallbackItems : [{}];
            while (list.length < 3) {
                list.push({ ...fallback[list.length % fallback.length] });
            }
            return list;
        };
        const posts = ensureGeneratedItems(source.posts, defaultData.posts);
        const album = ensureGeneratedItems(source.album, defaultData.album);
        const liked = ensureGeneratedItems(source.liked, defaultData.liked);
        return {
            name,
            signature: source.signature || '',
            avatarUrl,
            posts: posts.map((post, index) => this.normalizeWeiboPost(post, index, false)),
            album: album.map((item, index) => this.normalizeWeiboAlbumItem(item, index, friend, account)),
            liked: liked.map((post, index) => this.normalizeWeiboPost(post, index, true))
        };
    },

    getFriendWeiboData: function(friend) {
        const hasGeneratedData = friend?.weiboData && typeof friend.weiboData === 'object';
        const data = hasGeneratedData ? friend.weiboData : this.getDefaultWeiboData(friend);
        return {
            mainAccount: this.normalizeWeiboAccount(data.mainAccount || data.main || data, friend, 'main'),
            altAccount: hasGeneratedData && data.altAccount ? this.normalizeWeiboAccount(data.altAccount, friend, 'alt') : null
        };
    },

    renderWeiboAvatarHtml: function(avatarUrl, size = 40) {
        const safeUrl = this.escapeHTML(avatarUrl || '');
        return `
            <div style="width: ${size}px; height: ${size}px; border-radius: 50%; background: linear-gradient(135deg, #fff2e2, #ffd2c2); display: flex; align-items: center; justify-content: center; color: #ff8200; flex-shrink: 0; overflow: hidden;">
                ${safeUrl ? `<img src="${safeUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="fas fa-user"></i>`}
            </div>
        `;
    },

    renderWeiboPostCard: function(post, accountData, options = {}) {
        const safeName = this.escapeHTML(options.authorName || post.author || accountData.name);
        const safeText = this.escapeHTML(post.text).replace(/\n/g, '<br>');
        const safeTime = this.escapeHTML(post.time || '刚刚');
        const safeSource = this.escapeHTML(post.source || '来自 iPhone');
        const commentCount = Array.isArray(post.comments) ? post.comments.length : 0;
        const imagePreview = options.images && options.images.length ? `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-top: 10px;">
                ${options.images.slice(0, 3).map(img => `<div style="aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: #f2f2f2;"><img src="${this.escapeHTML(img.url)}" style="width: 100%; height: 100%; object-fit: cover;"></div>`).join('')}
            </div>
        ` : '';
        return `
            <div class="friend-weibo-post-card" data-post-type="${options.type || 'home'}" data-index="${options.index || 0}" style="background: #fff; padding: 14px 16px; cursor: pointer;">
                ${options.likedLabel ? `<div style="font-size: 12px; color: #999; margin-bottom: 8px;">赞过 @${safeName} 的微博</div>` : ''}
                <div style="display: flex; gap: 10px;">
                    ${options.likedLabel ? '' : this.renderWeiboAvatarHtml(accountData.avatarUrl, 40)}
                    <div style="flex: 1; min-width: 0;">
                        ${options.likedLabel ? '' : `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                            <div>
                                <div style="font-size: 15px; font-weight: 700; color: #111;">${safeName}</div>
                                <div style="font-size: 12px; color: #999; margin-top: 2px;">${safeTime} ${safeSource}</div>
                            </div>
                            <i class="fas fa-ellipsis-h" style="color: #999;"></i>
                        </div>`}
                        <div style="font-size: 15px; color: #222; line-height: 1.55; ${options.likedLabel ? '' : 'margin-top: 10px;'}">${safeText}</div>
                        ${imagePreview}
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 13px; color: #888; font-size: 13px;">
                            <span><i class="far fa-comment-dots"></i> ${commentCount || Math.max(3, Number(options.index || 0) + 3)}</span>
                            <span><i class="fas fa-retweet"></i> ${this.escapeHTML(post.reposts ?? 0)}</span>
                            <span style="${post.likedByMe ? 'color: #ff8200;' : ''}"><i class="${post.likedByMe ? 'fas' : 'far'} fa-heart"></i> ${post.likedByMe ? '已赞' : this.escapeHTML(post.likes ?? 0)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    showWeiboPostDetail: function(post, accountData, options = {}) {
        const safeName = this.escapeHTML(options.authorName || post.author || accountData.name);
        const safeText = this.escapeHTML(post.text).replace(/\n/g, '<br>');
        const comments = Array.isArray(post.comments) ? post.comments : [];
        const commentsHtml = comments.length ? comments.map(comment => `
            <div style="padding: 10px 0; border-top: 1px solid #f2f2f2;">
                <span style="font-size: 13px; font-weight: 700; color: #333;">${this.escapeHTML(comment.author || '评论用户')}</span>
                <span style="font-size: 13px; color: #333; line-height: 1.5;">：${this.escapeHTML(comment.text || '')}</span>
            </div>
        `).join('') : '<div style="padding: 12px 0; color: #999; font-size: 13px;">暂无评论</div>';
        const imagesHtml = options.images && options.images.length ? `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin: 14px 0;">
                ${options.images.map((img, idx) => `<div class="friend-weibo-detail-image" data-index="${idx}" style="aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: #f2f2f2; cursor: pointer;"><img src="${this.escapeHTML(img.url)}" style="width: 100%; height: 100%; object-fit: cover;"></div>`).join('')}
            </div>
        ` : '';
        const content = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
                ${this.renderWeiboAvatarHtml(accountData.avatarUrl, 44)}
                <div style="min-width: 0;">
                    <div style="font-size: 16px; font-weight: 800; color: #111;">${safeName}</div>
                    <div style="font-size: 12px; color: #999;">${this.escapeHTML(post.time || '刚刚')} ${this.escapeHTML(post.source || '来自 iPhone')}</div>
                </div>
            </div>
            <div style="font-size: 16px; color: #222; line-height: 1.65; word-break: break-word;">${safeText}</div>
            ${imagesHtml}
            <div style="display: flex; justify-content: space-around; color: #777; font-size: 13px; padding: 12px 0; border-top: 1px solid #f2f2f2; border-bottom: 1px solid #f2f2f2; margin-top: 14px;">
                <span><i class="far fa-comment-dots"></i> ${comments.length}</span>
                <span><i class="fas fa-retweet"></i> ${this.escapeHTML(post.reposts ?? 0)}</span>
                <span style="${post.likedByMe ? 'color: #ff8200;' : ''}"><i class="${post.likedByMe ? 'fas' : 'far'} fa-heart"></i> ${this.escapeHTML(post.likes ?? 0)}</span>
            </div>
            <div style="font-size: 14px; font-weight: 800; margin: 16px 0 4px; color: #111;">评论</div>
            ${commentsHtml}
        `;
        this.showDetailModal('微博详情', content);
        setTimeout(() => {
            document.querySelectorAll('#loves-detail-modal .friend-weibo-detail-image').forEach(el => {
                el.addEventListener('click', () => {
                    const idx = Number(el.getAttribute('data-index') || 0);
                    const image = options.images?.[idx];
                    if (image) this.showWeiboImageDetail(image);
                });
            });
        }, 30);
    },

    showWeiboImageDetail: function(item) {
        const safeUrl = this.escapeHTML(item.url || '');
        const safeDesc = this.escapeHTML(item.description || '').replace(/\n/g, '<br>');
        const content = `
            <div style="width: 100%; aspect-ratio: 1; border-radius: 14px; overflow: hidden; background: #f2f2f2; margin-bottom: 14px;">
                ${safeUrl ? `<img src="${safeUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: #999;"><i class="far fa-image" style="font-size: 40px;"></i></div>`}
            </div>
            <div style="font-size: 15px; color: #222; line-height: 1.6; word-break: break-word;">${safeDesc || '暂无描述'}</div>
        `;
        this.showDetailModal('相册详情', content);
    },

    renderFriendWeibo: function(friend) {
        const weiboView = document.getElementById('friend-weibo-view');
        if (!weiboView) return;

        const hasGeneratedWeiboData = !!(friend?.weiboData && typeof friend.weiboData === 'object');
        const allData = this.getFriendWeiboData(friend);
        if (this.currentWeiboAccount === 'alt' && !allData.altAccount) this.currentWeiboAccount = 'main';
        const accountKey = this.currentWeiboAccount === 'alt' ? 'altAccount' : 'mainAccount';
        const accountData = allData[accountKey] || allData.mainAccount;

        const profileName = document.getElementById('friend-weibo-profile-name');
        const signatureEl = document.getElementById('friend-weibo-profile-signature');
        const postCountEl = document.getElementById('friend-weibo-post-count');
        const switchBtn = document.getElementById('friend-weibo-switch-account-btn');
        const coverEl = document.getElementById('friend-weibo-cover');
        if (profileName) profileName.textContent = accountData.name;
        if (signatureEl) signatureEl.textContent = accountData.signature || '';
        if (postCountEl) postCountEl.textContent = String((accountData.posts || []).length);
        if (switchBtn) switchBtn.textContent = this.currentWeiboAccount === 'alt' ? '切换大号' : '切换账号';
        if (coverEl) {
            const coverUrl = hasGeneratedWeiboData ? this.getWeiboRandomCover(friend, this.currentWeiboAccount) : '';
            coverEl.style.backgroundImage = coverUrl ? `linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.34)), url("${coverUrl}")` : 'none';
            coverEl.style.backgroundSize = 'cover';
            coverEl.style.backgroundPosition = 'center';
            coverEl.style.backgroundColor = coverUrl ? '' : '#f2f2f2';
        }

        weiboView.querySelectorAll('.friend-weibo-avatar-img').forEach(img => {
            if (accountData.avatarUrl) {
                img.src = accountData.avatarUrl;
                img.style.display = 'block';
            } else {
                img.removeAttribute('src');
                img.style.display = 'none';
            }
        });
        weiboView.querySelectorAll('.friend-weibo-avatar-icon').forEach(icon => {
            icon.style.display = accountData.avatarUrl ? 'none' : 'inline-block';
        });

        const homeList = document.getElementById('friend-weibo-home-list');
        const albumGrid = document.getElementById('friend-weibo-album-grid');
        const likedList = document.getElementById('friend-weibo-liked-list');
        const albumImages = accountData.album || [];

        if (homeList) {
            const posts = accountData.posts || [];
            homeList.innerHTML = posts.length ? posts.map((post, index) => {
                const previewImages = index === 0 ? albumImages.slice(0, 3) : [];
                return this.renderWeiboPostCard(post, accountData, { type: 'home', index, images: previewImages });
            }).join('') : '<div style="padding: 38px 16px; text-align: center; color: #999; font-size: 14px;">暂无微博<br><span style="font-size: 12px; display: inline-block; margin-top: 6px;">请在设置中生成</span></div>';
            homeList.querySelectorAll('.friend-weibo-post-card').forEach(card => {
                card.addEventListener('click', () => {
                    const index = Number(card.getAttribute('data-index') || 0);
                    this.showWeiboPostDetail(posts[index], accountData, { images: index === 0 ? albumImages.slice(0, 3) : [] });
                });
            });
        }

        if (albumGrid) {
            albumGrid.innerHTML = albumImages.length ? albumImages.map((item, index) => `
                <div class="friend-weibo-album-item" data-index="${index}" style="aspect-ratio: 1; border-radius: 6px; overflow: hidden; background: #f2f2f2; cursor: pointer; position: relative;">
                    <img src="${this.escapeHTML(item.url)}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
            `).join('') : '<div style="grid-column: span 3; padding: 38px 0; text-align: center; color: #999; font-size: 14px;">暂无相册</div>';
            albumGrid.querySelectorAll('.friend-weibo-album-item').forEach(itemEl => {
                itemEl.addEventListener('click', () => {
                    const index = Number(itemEl.getAttribute('data-index') || 0);
                    this.showWeiboImageDetail(albumImages[index]);
                });
            });
        }

        if (likedList) {
            const likedPosts = accountData.liked || [];
            likedList.innerHTML = likedPosts.length ? likedPosts.map((post, index) => {
                return this.renderWeiboPostCard(post, accountData, { type: 'liked', index, likedLabel: true, authorName: post.author || '微博用户' });
            }).join('') : '<div style="padding: 38px 16px; text-align: center; color: #999; font-size: 14px;">暂无赞过</div>';
            likedList.querySelectorAll('.friend-weibo-post-card').forEach(card => {
                card.addEventListener('click', () => {
                    const index = Number(card.getAttribute('data-index') || 0);
                    this.showWeiboPostDetail(likedPosts[index], accountData, { authorName: likedPosts[index]?.author || '微博用户' });
                });
            });
        }
    },
    
    enterLovesSpace: function(friend) {
        const spaceView = document.getElementById('lovers-space-view');
        if (spaceView) {
            if (window.openView) window.openView(spaceView);
            
            const backBtn = document.getElementById('lovers-space-back-btn');
            if (backBtn) {
                backBtn.onclick = () => {
                    if (window.closeView) window.closeView(spaceView);
                };
            }
            
            // 1. 设置我的头像
            const myAvatarImg = document.getElementById('lovers-space-user-avatar');
            const myAvatarIcon = document.getElementById('lovers-space-user-icon');
            let myAvatarUrl = window.userState?.avatarUrl || window.imData?.profile?.avatarUrl;
            if (!myAvatarUrl) {
                const domAvatar = document.getElementById('edit-avatar-img') || document.getElementById('custom-avatar-img-desktop');
                if (domAvatar && domAvatar.src && !domAvatar.src.endsWith('html') && domAvatar.style.display !== 'none') {
                    myAvatarUrl = domAvatar.src;
                }
            }
            if (myAvatarUrl) {
                if(myAvatarImg) { myAvatarImg.src = myAvatarUrl; myAvatarImg.style.display = 'block'; }
                if(myAvatarIcon) myAvatarIcon.style.display = 'none';
            } else {
                if(myAvatarImg) myAvatarImg.style.display = 'none';
                if(myAvatarIcon) myAvatarIcon.style.display = 'block';
            }
            
            // 2. 设置好友的头像
            const friendAvatarImg = document.getElementById('lovers-space-friend-avatar');
            const friendAvatarIcon = document.getElementById('lovers-space-friend-icon');
            if (friend.avatarUrl) {
                if(friendAvatarImg) { friendAvatarImg.src = friend.avatarUrl; friendAvatarImg.style.display = 'block'; }
                if(friendAvatarIcon) friendAvatarIcon.style.display = 'none';
            } else {
                if(friendAvatarImg) friendAvatarImg.style.display = 'none';
                if(friendAvatarIcon) friendAvatarIcon.style.display = 'block';
            }

            // 渲染设备列表
            const friendName = friend.nickname || friend.realname || 'TA';
            const devicesList = document.getElementById('lovers-devices-list');
            if (devicesList) {
                devicesList.innerHTML = `
                    <div style="background: #f8f8f8; border-radius: 16px; padding: 15px 20px; display: flex; align-items: center; gap: 15px; cursor: pointer; ">
                        <i class="fas fa-mobile-alt" style="font-size: 26px; color: #ff9bb3; width: 30px; text-align: center;"></i>
                        <div style="flex: 1;">
                            <div style="font-size: 16px; font-weight: 600; color: #111;">我的手机</div>
                            <div style="font-size: 13px; color: #8e8e93; margin-top: 2px;">在线 · 电量 85%</div>
                        </div>
                        <i class="fas fa-chevron-right" style="color: #c7c7cc;"></i>
                    </div>
                    <div id="friend-phone-device-item" style="background: #f8f8f8; border-radius: 16px; padding: 15px 20px; display: flex; align-items: center; gap: 15px; cursor: pointer; ">
                        <i class="fas fa-mobile-alt" style="font-size: 26px; color: #ff9bb3; width: 30px; text-align: center;"></i>
                        <div style="flex: 1;">
                            <div style="font-size: 16px; font-weight: 600; color: #111;">${friendName} 的手机</div>
                            <div style="font-size: 13px; color: #8e8e93; margin-top: 2px;">在线 · 电量 92%</div>
                        </div>
                        <i class="fas fa-chevron-right" style="color: #c7c7cc;"></i>
                    </div>
                    <div style="background: #f8f8f8; border-radius: 16px; padding: 15px 20px; display: flex; align-items: center; gap: 15px; cursor: pointer; ">
                        <i class="fas fa-laptop" style="font-size: 22px; color: #c7c7cc; width: 30px; text-align: center;"></i>
                        <div style="flex: 1;">
                            <div style="font-size: 16px; font-weight: 600; color: #111;">${friendName} 的电脑</div>
                            <div style="font-size: 13px; color: #8e8e93; margin-top: 2px;">离线</div>
                        </div>
                        <i class="fas fa-chevron-right" style="color: #c7c7cc;"></i>
                    </div>
                `;
                
                const friendPhoneItem = document.getElementById('friend-phone-device-item');
                if (friendPhoneItem) {
                    friendPhoneItem.addEventListener('click', () => {
                        this.openFriendPhone(friend);
                    });
                }
            }
            
            this.currentFriend = friend;
            this.bindSharedSavingsButton(friend);
            
            // 绑定点击
            this.bindFabClick();
            // 首次渲染动态
            this.renderLovesMoments();
            // 初始化日历并渲染
            this.currentCalendarDate = new Date();
            this.renderCalendar();

            // 3. Tabs 切换逻辑绑定
            const tabs = spaceView.querySelectorAll('.lovers-space-tab');
            const indicator = document.getElementById('lovers-space-tab-indicator');
            const panels = spaceView.querySelectorAll('.lovers-space-panel');
            
            // 避免克隆节点破坏原生绑定，改为检查是否已绑定自定义属性
            const tabsContainer = spaceView.querySelector('.lovers-space-tabs-container');
            if (tabsContainer && !tabsContainer.dataset.bound) {
                tabsContainer.dataset.bound = 'true';
                
                tabs.forEach(tab => {
                    tab.addEventListener('click', (e) => {
                        tabs.forEach(t => {
                            t.classList.remove('active');
                            t.style.color = '#8e8e93';
                        });
                        panels.forEach(p => {
                            p.classList.remove('active');
                        });
                        
                        const target = e.currentTarget;
                        target.classList.add('active');
                        target.style.color = '#111';
                        
                        const targetLeft = target.offsetLeft;
                        const targetWidth = target.offsetWidth;
                        if (indicator) {
                            indicator.style.left = (targetLeft + (targetWidth - 30) / 2) + 'px';
                        }
                        
                        const tabName = target.getAttribute('data-tab');
                        const panel = document.getElementById('lovers-panel-' + tabName);
                        if (panel) {
                            panel.classList.add('active');
                        }
                    });
                });
            }
            
            // 默认触发第一个 tab 居中计算
            if (tabs.length > 0 && indicator) {
                // 等待重绘
                setTimeout(() => {
                    const firstTab = tabs[0];
                    const targetLeft = firstTab.offsetLeft;
                    const targetWidth = firstTab.offsetWidth;
                    indicator.style.left = (targetLeft + (targetWidth - 30) / 2) + 'px';
                }, 10);
            }
        }
    },
    
    openFriendPhone: function(friend) {
        const phoneView = document.getElementById('lovers-friend-phone-view');
        if (!phoneView) return;
        
        phoneView.style.backgroundImage = friend.phoneBg ? `url(${friend.phoneBg})` : 'none';
        
        if (window.openView) window.openView(phoneView);
        
        const backBtn = document.getElementById('friend-phone-back-btn');
        if (backBtn) {
            backBtn.onclick = () => {
                if (window.closeView) window.closeView(phoneView);
            };
        }
        
        // 绑定设置
        const settingsSheet = document.getElementById('friend-phone-settings-sheet');
        const settingsBtn = document.getElementById('friend-phone-app-settings');
        if (settingsBtn && settingsSheet) {
            settingsBtn.onclick = () => window.openView(settingsSheet);
        }
        
        const settingsBackBtn = document.getElementById('friend-settings-back-btn');
        if (settingsBackBtn && settingsSheet) {
            settingsBackBtn.onclick = () => {
                if (window.closeView) window.closeView(settingsSheet);
            };
        }

        const genSettingsBtn = document.getElementById('friend-phone-gen-settings-btn');
        const genModal = document.getElementById('friend-phone-gen-modal');
        const getGenAppCheckboxes = () => Array.from(document.querySelectorAll('.gen-app-checkbox'));
        const defaultGenApps = ['imessage', 'music', 'health', 'pay', 'game', 'call', 'safari', 'weibo', 'files'];
        const getSavedGenApps = () => {
            return Array.isArray(friend.phoneGenApps) ? friend.phoneGenApps : defaultGenApps;
        };
        const applySavedGenApps = () => {
            const savedApps = getSavedGenApps();
            getGenAppCheckboxes().forEach(cb => {
                cb.checked = savedApps.includes(cb.value);
            });
        };
        const saveGenApps = () => {
            friend.phoneGenApps = getGenAppCheckboxes().filter(cb => cb.checked).map(cb => cb.value);
            this.persistFriendState(friend, { silent: true });
        };
        getGenAppCheckboxes().forEach(cb => {
            cb.onchange = () => saveGenApps();
        });
        if (genSettingsBtn && genModal) {
            genSettingsBtn.onclick = () => {
                applySavedGenApps();
                if (window.openView) window.openView(genModal);
            };
        }

        const clearAllDataBtn = document.getElementById('friend-phone-clear-all-data-btn');
        if (clearAllDataBtn) {
            clearAllDataBtn.onclick = () => {
                if (!window.confirm('危险操作！这将会彻底清空该好友所有的生成应用数据（包含短信、音乐、游戏等），确认清空吗？')) return;
                
                friend.imessageData = null;
                friend.musicData = null;
                friend.healthData = null;
                friend.payData = null;
                friend.gameData = null;
                friend.callData = null;
                friend.safariData = null;
                friend.filesData = null;
                friend.weiboData = null;
                
                this.persistFriendState(friend);
                if (window.showToast) window.showToast('所有生成数据已清空');
            };
        }

        const genConfirmBtn = document.getElementById('friend-phone-gen-confirm-btn');
        if (genConfirmBtn) {
            genConfirmBtn.onclick = () => {
                saveGenApps();
                const selectedApps = getSavedGenApps();
                
                if (selectedApps.length === 0) {
                    if (window.showToast) window.showToast('请至少选择一个应用');
                    return;
                }

                if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
                    if (window.showToast) window.showToast('请先在系统设置中配置 API');
                    return;
                }

                if (window.closeView) window.closeView(genModal);
                
                // 收集世界书与人设
                let globalRule = '';
                if (window.getGlobalWorldBookContextByPosition) {
                    globalRule = window.getGlobalWorldBookContextByPosition('system_depth') || '';
                    const beforeRole = window.getGlobalWorldBookContextByPosition('before_role');
                    if (beforeRole) globalRule += '\n' + beforeRole;
                }
                
                const userPersona = window.userState?.persona || '普通用户';
                const charPersona = friend.persona || '普通角色';
                
                // 收集聊天上下文
                let chatContext = '';
                if (Array.isArray(friend.messages)) {
                    const msgs = friend.messages.slice(-20); // 取最近20条
                    if (msgs.length > 0) {
                        chatContext = msgs.map(m => {
                            const sender = m.sender === 'me' ? 'User' : 'Char';
                            return `${sender}: ${m.text || '[特殊消息]'}`;
                        }).join('\n');
                    }
                }
                
                let oldContext = '';
                if (selectedApps.includes('safari') && friend.safariData) {
                    const rs = (friend.safariData.recentSearches || []).slice(0, 3).map(s => typeof s === 'string' ? s : s.keyword).join(', ');
                    if (rs) oldContext += `\n【已有普通搜索】: ${rs}`;
                    const ps = (friend.safariData.privateSearches || []).slice(0, 3).map(s => typeof s === 'string' ? s : s.keyword).join(', ');
                    if (ps) oldContext += `\n【已有无痕搜索】: ${ps}`;
                }
                if (selectedApps.includes('imessage') && friend.imessageData) {
                    const mainChats = friend.imessageData.mainAccount?.chats || (Array.isArray(friend.imessageData) ? friend.imessageData : []);
                    const altChats = friend.imessageData.altAccount?.chats || [];
                    if (mainChats.length > 0) oldContext += `\n【已有主号短信联系人】: ` + mainChats.slice(0,3).map(c => c.contactName).join(', ');
                    if (altChats.length > 0) oldContext += `\n【已有小号短信联系人】: ` + altChats.slice(0,3).map(c => c.contactName).join(', ');
                }
                if (selectedApps.includes('game') && friend.gameData && friend.gameData.recentGames) {
                    const gameInfos = friend.gameData.recentGames.slice(0,3).map(g => {
                        let info = g.name;
                        if (g.matches && g.matches.length > 0) {
                            const times = g.matches.slice(0, 3).map(m => m.time).join('、');
                            info += `(已有对局时间: ${times})`;
                        }
                        return info;
                    });
                    oldContext += `\n【已有游戏及对局】: ` + gameInfos.join('; ') + '。请为已有游戏生成【不同时间点】的新对局，或生成全新的游戏。';
                }
                if (selectedApps.includes('files') && friend.filesData && friend.filesData.tags) {
                    const tagNames = friend.filesData.tags.map(t => t.name).join(', ');
                    let fileTitles = [];
                    friend.filesData.tags.forEach(t => {
                        if (t.items) fileTitles = fileTitles.concat(t.items.map(i => i.title));
                    });
                    if (tagNames) oldContext += `\n【已有文件标签】: ${tagNames}`;
                    if (fileTitles.length > 0) oldContext += `\n【已有文件名称(请勿重复生成同名文件)】: ${fileTitles.slice(0, 5).join(', ')}`;
                }
                if (selectedApps.includes('call') && friend.callData && friend.callData.recentCalls) {
                    const calls = friend.callData.recentCalls.slice(0, 3).map(c => c.name).join(', ');
                    if (calls) oldContext += `\n【已有通话联系人】: ${calls}`;
                }
                if (selectedApps.includes('weibo') && friend.weiboData) {
                    const mainPosts = friend.weiboData.mainAccount?.posts || [];
                    const altPosts = friend.weiboData.altAccount?.posts || [];
                    if (mainPosts.length > 0) oldContext += `\n【已有微博大号帖子】: ${mainPosts.slice(0, 3).map(p => p.text || p.content || '').join(' / ')}`;
                    if (altPosts.length > 0) oldContext += `\n【已有微博小号帖子】: ${altPosts.slice(0, 3).map(p => p.text || p.content || '').join(' / ')}`;
                }
                
                let prompt = `你现在要模拟生成一部手机里不同应用的数据。请严格遵循给定的世界观设定、角色人设和聊天上下文，生成符合角色性格的JSON格式数据。\n`;
                if (oldContext) prompt += `\n【旧数据参考，本次生成会覆盖旧内容；请参考这些信息避免机械重复，并生成一组新的完整数据】：${oldContext}\n`;
                
                if (globalRule) prompt += `\n【世界书设定】：\n${globalRule}\n`;
                prompt += `\n【角色 (Char) 人设】：\n${charPersona}\n`;
                prompt += `\n【用户 (User) 人设】：\n${userPersona}\n`;
                if (chatContext) prompt += `\n【近期聊天上下文】：\n${chatContext}\n`;
                
                prompt += `\n根据选择的应用返回对应的数据。\n`;

                const requirementParts = {
                    imessage: `[imessage]: 主账号必须生成一个对于 user 的专属私密备注 userRemark（如宝宝、主人、亲爱的或任何符合人设的专属称呼），并且为主账号生成2-5个与其他人的日常聊天，绝对不要生成与 user 的聊天记录。为小号严格生成【备忘录】(2-5条己方气泡，情绪文案或关于user的事)、【文件传输助手】(2-5条己方气泡，[图片]关于user的照片或隐私文件)，以及1-3个小号好友的会话(符合小号设定)。小号内的气泡全部体现其暗处的真实心境与癖好。`,
                    safari: `[safari]: 生成 2-5 条日常搜索，以及 2-5 条无痕模式下符合其阴暗面或隐私小癖好的搜索内容。`,
                    files: `[files]: 生成符合角色人设的文件列表，其中 tags 内必须包含能够体现其性格、癖好、或对 User 的看法的隐私内容（如小说草稿、私密日记、账单等），需生成 2-3 个标签，每个标签 1-3 个新文件，确保文件名不要与历史已有的重复。`,
                    call: `[call]: 生成 2-5 个联系人的详细信息及 2-5 条对应的通话记录，严格符合其人设交际圈。请避免使用不符合JSON标准的单引号。`,
                    music: `[music]: 生成 2-5 条听歌排行，风格应极大程度体现其人设与心境，每首歌必须包含循环次数(必须为纯数字)和听歌时的细腻心声(不少于20字)。`,
                    health: `[health]: 严格符合其人设（如是否运动、熬夜、体型等）的近期睡眠、步数、身高体重。`,
                    pay: `[pay]: 生成符合人设的银行卡总金额和近期不少于 5 条收支记录。`,
                    game: `[game]: 生成符合人设 1-2 个玩的游戏。如果是已有游戏，必须生成全新的对局时间。每局必须包含时间、结果(胜利/失败)、KDA(如8/2/5)、使用英雄、高光时刻(数组)、内心戏(30字)、复盘(30字)。格式必须完全符合提供的JSON模板，不要使用特殊字符。`,
                    weibo: `[weibo]: 生成微博资料。大号必须生成签名、帖子3条，每条帖子3-8条评论；相册生成3张，每张内容描述20-50字；赞过生成3条帖子，必须符合微博大号风格，像公开主页，会更体面、可被熟人看到。另生成一个小号，包含名字和签名，帖子/评论/相册/赞过内容同上，但必须符合微博小号风格：可以发关于 User 的内容、暗恋/占有欲/嫉妒/窥探/自我厌弃/黑泥情绪，也可以发珍视的记忆、舍不得忘掉的细节、对关系的自我思考、只有小号才敢保存的温柔瞬间；表达要贴合 Char 人设，不要脱离世界观，也不要让小号只有负面情绪。小号头像使用随机图片，avatarUrl 可以留空，由系统随机补图。`
                };

                const promptParts = {
                    imessage: `"imessage": {\n  "mainAccount": {\n    "userRemark": "对于 user 的专属备注(如宝宝等)",\n    "chats": [\n      {"contactName": "其他人1", "messages": [{"sender": "them", "text": "消息"}, {"sender": "char", "text": "回复"}]}\n    ]\n  },\n  "altAccount": {\n    "name": "生成一个小号的名字(符合其隐藏人设)",\n    "chats": [\n      {"contactName": "备忘录", "messages": [{"sender": "char", "text": "情绪文案、自己的感想或关于 user 的事情(2-5条)"}]}, \n      {"contactName": "文件传输助手", "messages": [{"sender": "char", "text": "[图片] 关于 user 的隐私照片/文件或其他私密内容(2-5条)"}]}, \n      {"contactName": "小号好友", "messages": [{"sender": "them", "text": "消息"}, {"sender": "char", "text": "回复"}]}\n    ]\n  }\n}`,
                    safari: `"safari": {\n  "recentSearches": [\n    {"keyword": "搜索关键词1", "title": "网页标题1", "content": "网页内容(如知乎,百度百科等真实浏览器内容50-100字)"}\n  ],\n  "privateSearches": [\n    {"keyword": "无痕搜索词1", "title": "无痕网页标题1", "content": "不可告人或极具隐私属性的搜索详情内容(50-100字)"}\n  ]\n}`,
                    files: `"files": {\n  "tags": [\n    {"name": "新标签名称", "color": "#ff3b30", "items": [{"title": "新文件名.txt", "content": "一段极度符合人设的私密内容(50-100字)"}]}\n  ]\n}`,
                    call: `"call": {\n  "recentCalls": [\n    {"name": "联系人", "time": "今天 14:00", "type": "incoming/outgoing/missed", "dialogue": "通话内容(50-100字对话形式，带环境描写)"}\n  ],\n  "contacts": [\n    {"name": "联系人", "addedTime": "2023年5月12日", "recentCallTime": "昨天 20:00", "callReason": "通话原因简短说明"}\n  ]\n}`,
                    music: `"music": {\n  "recent": [{"name": "歌曲名1", "artist": "歌手1"}],\n  "favorites": [{"name": "最爱歌曲名1", "artist": "最爱歌手1"}],\n  "top": [{"name": "排行歌曲1", "artist": "歌手1", "loops": 156, "thoughts": "听这首歌时的内心情感与心声，要非常符合人设且细腻，不少于30字"}]\n}`,
                    health: `"health": {\n  "steps": "生成步数数字",\n  "sleepHours": "睡眠小时数数字",\n  "sleepMinutes": "睡眠分钟数数字",\n  "weight": "体重",\n  "height": "身高"\n}`,
                    pay: `"pay": {\n  "totalAssets": "24560.88",\n  "recentTransactions": [\n    {"title": "餐饮美食", "time": "昨天 18:45", "amount": "-128.00", "isIncome": false}\n  ]\n}`,
                    game: `"game": {\n  "playerName": "游戏内id",\n  "totalHours": "200小时",\n  "recentGames": [\n    {"name": "游戏名(如王者荣耀)", "hours": "50小时", "rank": "王者", "winRate": "65%", "icon": "fas fa-gamepad", "matches": [\n      {"time": "昨天 21:00", "result": "胜利", "kda": "8/2/5", "hero": "李白", "highlights": [{"time": "14:20", "desc": "抢龙"}], "innerThoughts": "这局打得好累...", "postGameReflection": "下次注意走位"}\n    ]}\n  ]\n}`,
                    weibo: `"weibo": {\n  "mainAccount": {\n    "signature": "符合 Char 大号公开形象的微博签名",\n    "posts": [\n      {"text": "大号帖子正文，公开、体面、符合熟人可见的大号风格", "time": "今天 18:24", "source": "来自 iPhone", "comments": [{"author": "评论用户名", "text": "评论内容"}], "reposts": 6, "likes": 128}\n    ],\n    "album": [\n      {"description": "大号相册图片内容描述20-50字"}\n    ],\n    "liked": [\n      {"author": "被赞博主名", "text": "符合微博大号风格的赞过帖子正文", "time": "昨天 21:10", "source": "来自 微博", "comments": [{"author": "评论用户名", "text": "评论内容"}], "reposts": 12, "likes": 241}\n    ]\n  },\n  "altAccount": {\n    "name": "符合 Char 小号风格的小号名",\n    "signature": "符合小号隐秘状态的签名，可以关于 User、黑泥、珍视记忆或自我思考",\n    "avatarUrl": "",\n    "posts": [\n      {"text": "小号帖子正文，可以写关于 User 的内容、黑泥、暗恋、嫉妒、占有欲、珍视的记忆、舍不得忘掉的细节或自己的思考", "time": "今天 01:12", "source": "来自 iPhone", "comments": [{"author": "评论用户名", "text": "评论内容"}], "reposts": 1, "likes": 19}\n    ],\n    "album": [\n      {"description": "小号相册图片内容描述20-50字，可以隐晦关联 User、珍视记忆或 Char 的暗处状态"}\n    ],\n    "liked": [\n      {"author": "被赞博主名", "text": "符合微博小号风格的赞过帖子正文，可体现黑泥、隐秘欲望、珍视记忆、自我思考或对 User 的投射", "time": "昨天 02:34", "source": "来自 微博", "comments": [{"author": "评论用户名", "text": "评论内容"}], "reposts": 2, "likes": 33}\n    ]\n  }\n}`
                };

                prompt += `\n【各应用生成要求】：\n`;
                selectedApps.forEach(app => {
                    prompt += requirementParts[app] + `\n`;
                });

                prompt += `\n请包含以下字段（根据选择包含对应的对象）：\n{\n`;
                let selectedPrompts = selectedApps.map(app => promptParts[app]).join(",\n");
                prompt += selectedPrompts + `\n}`;

                prompt += `\n注意：必须且只能返回合法的 JSON 字符串，不要包含任何多余的文字说明，不要 Markdown 标记。确保 JSON 格式绝对正确，键名和字符串都使用双引号。`;
                
                if (window.showToast) window.showToast('正在生成符合设定的数据，请稍候...');
                
                const messages = [
                    { role: "system", content: "你是一个数据生成助手。只能返回合法的 JSON 字符串。" },
                    { role: "user", content: prompt }
                ];
                
                const model = window.apiConfig.model || 'gpt-3.5-turbo';
                
                let endpoint = window.apiConfig.endpoint;
                // 智能补全 endpoint (兼容直接填写的 base url)
                if (endpoint && !endpoint.endsWith('/chat/completions')) {
                    if (endpoint.endsWith('/')) {
                        endpoint += 'v1/chat/completions';
                    } else if (endpoint.endsWith('/v1')) {
                        endpoint += '/chat/completions';
                    } else {
                        endpoint += '/v1/chat/completions';
                    }
                }

                fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + window.apiConfig.apiKey
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: messages,
                        temperature: 0.7
                    })
                })
                .then(async response => {
                    if (!response.ok) {
                        let errorMsg = `HTTP error! status: ${response.status}`;
                        try {
                            const errorBody = await response.text();
                            console.error('API Error Response Body:', errorBody);
                            const errorObj = JSON.parse(errorBody);
                            if (errorObj.error && errorObj.error.message) {
                                errorMsg = errorObj.error.message;
                            } else {
                                errorMsg += ` - ${errorBody}`;
                            }
                        } catch(e) {
                            // ignore
                        }
                        throw new Error(errorMsg);
                    }
                    return response.json();
                })
                .then(data => {
                    let resultText = data.choices?.[0]?.message?.content || "";
                    
                    // 防御性处理：使用正则表达式尝试提取可能被文字包裹的 JSON 结构
                    let jsonStr = resultText;
                    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        jsonStr = jsonMatch[0];
                    } else {
                        // 兜底正则移除 markdown
                        jsonStr = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
                    }

                    try {
                        const parsed = JSON.parse(jsonStr);
                        
                        // 本次生成的数据直接覆盖对应应用的旧内容。
                        if (parsed.music) {
                            friend.musicData = {
                                recent: Array.isArray(parsed.music.recent) ? parsed.music.recent : [],
                                favorites: Array.isArray(parsed.music.favorites) ? parsed.music.favorites : [],
                                top: Array.isArray(parsed.music.top) ? parsed.music.top : []
                            };
                        }
                        if (parsed.health) {
                            friend.healthData = parsed.health;
                        }
                        if (parsed.pay) {
                            friend.payData = {
                                ...parsed.pay,
                                recentTransactions: Array.isArray(parsed.pay.recentTransactions) ? parsed.pay.recentTransactions : []
                            };
                        }
                        if (parsed.game) {
                            friend.gameData = {
                                ...parsed.game,
                                recentGames: Array.isArray(parsed.game.recentGames) ? parsed.game.recentGames : []
                            };
                        }
                        if (parsed.call) {
                            friend.callData = {
                                ...parsed.call,
                                recentCalls: Array.isArray(parsed.call.recentCalls) ? parsed.call.recentCalls : [],
                                contacts: Array.isArray(parsed.call.contacts) ? parsed.call.contacts : []
                            };
                        }
                        if (parsed.safari) {
                            friend.safariData = {
                                recentSearches: Array.isArray(parsed.safari.recentSearches) ? parsed.safari.recentSearches : [],
                                privateSearches: Array.isArray(parsed.safari.privateSearches) ? parsed.safari.privateSearches : []
                            };
                        }
                        if (parsed.files) {
                            friend.filesData = {
                                ...parsed.files,
                                tags: Array.isArray(parsed.files.tags) ? parsed.files.tags : [],
                                recent: Array.isArray(parsed.files.recent) ? parsed.files.recent : []
                            };
                        }
                        if (parsed.weibo) {
                            const rawWeibo = parsed.weibo || {};
                            const ensureAccount = (rawAccount, accountKey) => {
                                const normalized = this.normalizeWeiboAccount(rawAccount || {}, friend, accountKey === 'altAccount' ? 'alt' : 'main');
                                normalized.posts = normalized.posts.slice(0, 3);
                                normalized.album = normalized.album.slice(0, 3).map((item, index) => ({
                                    ...item,
                                    url: item.url || this.getWeiboRandomImage(friend, index, accountKey === 'altAccount' ? 'alt' : 'main')
                                }));
                                normalized.liked = normalized.liked.slice(0, 3);
                                if (accountKey === 'altAccount' && !normalized.avatarUrl) {
                                    normalized.avatarUrl = this.getWeiboRandomAvatar(friend);
                                }
                                return normalized;
                            };
                            friend.weiboData = {
                                mainAccount: ensureAccount(rawWeibo.mainAccount || rawWeibo.main || rawWeibo, 'mainAccount'),
                                altAccount: ensureAccount(rawWeibo.altAccount || rawWeibo.alt || {}, 'altAccount')
                            };
                        }
                        if (parsed.imessage) {
                            friend.imessageData = {
                                mainAccount: {
                                    ...(parsed.imessage.mainAccount || {}),
                                    chats: Array.isArray(parsed.imessage.mainAccount?.chats) ? parsed.imessage.mainAccount.chats : []
                                },
                                altAccount: {
                                    name: parsed.imessage.altAccount?.name || '小号',
                                    ...(parsed.imessage.altAccount || {}),
                                    chats: Array.isArray(parsed.imessage.altAccount?.chats) ? parsed.imessage.altAccount.chats : []
                                }
                            };
                        }
                        
                        this.persistFriendState(friend);
                        
                        if (window.showToast) window.showToast('生成成功！请返回桌面重新进入 App 查看');
                        
                        // 强制刷新并关闭弹窗
                        if (window.closeView) {
                            window.closeView(settingsSheet);
                            const phoneView = document.getElementById('lovers-friend-phone-view');
                            if (phoneView) window.closeView(phoneView);
                        }
                    } catch (e) {
                        console.error('JSON Parse error', e, '\nOriginal Text:', resultText, '\nExtracted:', jsonStr);
                        if (window.showToast) window.showToast('生成数据解析失败，AI可能输出了非标准JSON格式，请重试');
                    }
                })
                .catch(err => {
                    console.error('API Error:', err);
                    let displayMsg = err.message || '未知网络错误';
                    if (displayMsg.length > 50) {
                        displayMsg = displayMsg.substring(0, 50) + '...'; // 防止超长报错撑爆 toast
                    }
                    if (window.showToast) window.showToast('API 请求失败: ' + displayMsg);
                    else alert('API 请求失败: ' + displayMsg);
                });
            };
        }

        const bgUpload = document.getElementById('friend-phone-bg-upload');
        if (bgUpload) {
            bgUpload.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        friend.phoneBg = ev.target.result;
                        this.persistFriendState(friend);
                        phoneView.style.backgroundImage = `url(${friend.phoneBg})`;
                        if (window.showToast) window.showToast('已更换 TA 的主屏幕背景');
                        if (window.closeView) window.closeView(settingsSheet);
                    };
                    reader.readAsDataURL(file);
                }
            };
        }
        
        this.currentFriend = friend;
        
        // 绑定 iMessage
        const imsgBtn = document.getElementById('friend-phone-app-imessage');
        const imsgView = document.getElementById('friend-imessage-view');
        if (imsgBtn && imsgView) {
            imsgBtn.onclick = () => {
                this.currentImsgAccount = 'main';
                this.renderFriendImsg(friend);
                if (window.openView) window.openView(imsgView);
                
                document.getElementById('friend-imsg-user-name').textContent = window.userState?.name || window.imData?.profile?.name || '我';
                const userImg = document.getElementById('friend-imsg-user-avatar');
                const userIcon = document.getElementById('friend-imsg-user-icon');
                const myUserAvatarUrl = window.userState?.avatarUrl || window.imData?.profile?.avatarUrl;
                if (myUserAvatarUrl) {
                    if (userImg) { userImg.src = myUserAvatarUrl; userImg.style.display = 'block'; }
                    if (userIcon) userIcon.style.display = 'none';
                } else {
                    if (userImg) userImg.style.display = 'none';
                    if (userIcon) userIcon.style.display = 'block';
                }
            };
        }
        
        const switchBtn = document.getElementById('friend-imsg-switch-account-btn');
        const accountModal = document.getElementById('friend-imsg-account-modal');
        if (switchBtn && accountModal) {
            switchBtn.onclick = () => {
                const listEl = document.getElementById('friend-imsg-accounts-list');
                if (listEl) {
                    const mainName = friend.nickname || friend.realname || 'TA';
                    let altName = '小号';
                    let hasAlt = false;
                    if (friend.imessageData && !Array.isArray(friend.imessageData) && friend.imessageData.altAccount) {
                        altName = friend.imessageData.altAccount.name || '小号';
                        hasAlt = true;
                    }

                    listEl.innerHTML = `
                        <div style="padding: 15px 16px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; justify-content: space-between; cursor: pointer;" onclick="window.lovesApp.switchImsgAccount('main', true)">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: #e5e5ea; display: flex; justify-content: center; align-items: center; color: #8e8e93;"><i class="fas fa-user"></i></div>
                                <span style="font-size: 16px; font-weight: 500; color: #000;">${mainName} (主账号)</span>
                            </div>
                            ${this.currentImsgAccount === 'main' ? '<i class="fas fa-check" style="color: #007aff;"></i>' : ''}
                        </div>
                        ${hasAlt ? `
                        <div style="padding: 15px 16px; display: flex; align-items: center; justify-content: space-between; cursor: pointer;" onclick="window.lovesApp.switchImsgAccount('alt', true)">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: #e5e5ea; display: flex; justify-content: center; align-items: center; color: #8e8e93;"><i class="fas fa-user-secret"></i></div>
                                <span style="font-size: 16px; font-weight: 500; color: #000;">${altName} (小号)</span>
                            </div>
                            ${this.currentImsgAccount === 'alt' ? '<i class="fas fa-check" style="color: #007aff;"></i>' : ''}
                        </div>
                        ` : `
                        <div style="padding: 15px 16px; display: flex; align-items: center; justify-content: center; color: #8e8e93; font-size: 14px;">
                            暂无小号数据，请在生成设置中重新生成
                        </div>
                        `}
                    `;
                }
                if (window.openView) window.openView(accountModal);
            };
        }
        
        const imsgBackBtn = document.getElementById('friend-imsg-back-btn');
        if (imsgBackBtn) imsgBackBtn.onclick = () => { if (window.closeView) window.closeView(imsgView); };

        // 绑定 Files (文件)
        const filesBtn = document.getElementById('friend-phone-app-files');
        const filesView = document.getElementById('friend-files-view');
        
        // 全局事件代理绑定最近删除按钮，避免重复绑定和闭包问题，并确保点击能被捕获
        const filesRecentlyDeletedView = document.getElementById('friend-files-recently-deleted-view');
        const filesRecentlyDeletedBackBtn = document.getElementById('friend-files-recently-deleted-back-btn');
        const filesRecentlyDeletedList = document.getElementById('friend-files-recently-deleted-list');

        // 只在未绑定过时绑定，通过标识位防止重复绑定
        if (!window.lovesApp._filesRecentlyDeletedBound) {
            document.addEventListener('click', (e) => {
                const targetBtn = e.target.closest('#filesRecentlyDeletedBtn');
                if (targetBtn && filesRecentlyDeletedView) {
                    if (window.openView) window.openView(filesRecentlyDeletedView);
                    
                    const activeFriend = window.lovesApp.currentFriend;
                    
                    if (filesRecentlyDeletedList) {
                        if (activeFriend && activeFriend.filesData && activeFriend.filesData.recentlyDeleted && activeFriend.filesData.recentlyDeleted.length > 0) {
                            filesRecentlyDeletedList.innerHTML = activeFriend.filesData.recentlyDeleted.map(item => `
                                <div style="background: #fff; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; align-items: center;  position: relative; cursor: pointer;">
                                    <div style="width: 100%; aspect-ratio: 1; background: #f2f2f7; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: center; align-items: center; color: #8e8e93; font-size: 30px;">
                                        ${item.type === 'image' ? '<i class="fas fa-image"></i>' : '<i class="far fa-file-alt"></i>'}
                                    </div>
                                    <div style="font-size: 13px; font-weight: 500; color: #111; text-align: center; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
                                    <div style="font-size: 11px; color: #8e8e93; margin-top: 4px;">${item.size || '未知大小'}</div>
                                    <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.5); color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 6px;">${item.daysLeft || '30'}天</div>
                                </div>
                            `).join('');
                        } else {
                            filesRecentlyDeletedList.innerHTML = `<div style="grid-column: span 3; text-align: center; color: #8e8e93; padding: 40px 0;">最近删除为空</div>`;
                        }
                    }
                }
            });
            
            if (filesRecentlyDeletedBackBtn && filesRecentlyDeletedView) {
                filesRecentlyDeletedBackBtn.addEventListener('click', () => {
                    if (window.closeView) window.closeView(filesRecentlyDeletedView);
                });
            }
            window.lovesApp._filesRecentlyDeletedBound = true;
        }

        if (filesBtn && filesView) {
            filesBtn.onclick = () => {
                if (window.openView) window.openView(filesView);

                const tagsList = document.getElementById('friend-files-tags-list');
                if (tagsList) {
                    if (friend.filesData && friend.filesData.tags) {
                        tagsList.innerHTML = friend.filesData.tags.map((tag, tagIdx) => {
                            const itemsHtml = tag.items ? tag.items.map((item, itemIdx) => {
                                const itemStr = encodeURIComponent(JSON.stringify(item));
                                return `
                                    <div class="file-item-clickable" data-item="${itemStr}" style="display: flex; align-items: center; padding: 12px 15px; border-top: 1px solid #f0f0f0; cursor: pointer; background: #fff;">
                                        <i class="far fa-file-alt" style="color: #8e8e93; font-size: 18px; margin-right: 12px;"></i>
                                        <span style="font-size: 16px; color: #111; flex: 1;">${item.title}</span>
                                        <i class="fas fa-chevron-right" style="color: #c7c7cc; font-size: 14px;"></i>
                                    </div>
                                `;
                            }).join('') : '';

                            return `
                                <div style="border-radius: 12px; overflow: hidden;  margin-bottom: 10px;">
                                    <div style="display: flex; align-items: center; padding: 12px 15px; background: #fff;">
                                        <div style="width: 12px; height: 12px; border-radius: 50%; background: ${tag.color || '#ff9500'}; margin-right: 12px;"></div>
                                        <span style="font-size: 17px; font-weight: 600; color: #111; flex: 1;">${tag.name}</span>
                                    </div>
                                    ${itemsHtml}
                                </div>
                            `;
                        }).join('');
                        
                        setTimeout(() => {
                            const fileItems = tagsList.querySelectorAll('.file-item-clickable');
                            fileItems.forEach(el => {
                                el.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    try {
                                        const item = JSON.parse(decodeURIComponent(this.getAttribute('data-item')));
                                        window.lovesApp.showDetailModal(item.title, `<div style="white-space: pre-wrap; font-size: 15px; line-height: 1.6; color: #333;">${item.content}</div>`);
                                    } catch (err) {
                                        console.error('File item parse error', err);
                                    }
                                });
                                window.lovesApp.bindLongPress(el, function() {
                                    try {
                                        const item = JSON.parse(decodeURIComponent(el.getAttribute('data-item')));
                                        window.lovesApp.showDeleteConfirm(item.title, () => {
                                            if (friend.filesData && friend.filesData.tags) {
                                                friend.filesData.tags.forEach(tag => {
                                                    if (tag.items) {
                                                        const idx = tag.items.findIndex(i => i.title === item.title && i.content === item.content);
                                                        if (idx !== -1) tag.items.splice(idx, 1);
                                                    }
                                                });
                                                filesBtn.onclick();
                                            }
                                        });
                                    } catch(e) {}
                                });
                            });
                        }, 50);
                    } else {
                        tagsList.innerHTML = '<div style="padding: 30px; text-align: center; color: #8e8e93; font-size: 14px;">暂无文件数据<br><span style="font-size: 12px; margin-top: 5px; display: inline-block;">请在设置中生成</span></div>';
                    }
                }
            };
        }
        const filesBackBtn = document.getElementById('friend-files-back-btn');
        if (filesBackBtn) filesBackBtn.onclick = () => { if (window.closeView) window.closeView(filesView); };

        // 绑定 Safari
        const safariBtn = document.getElementById('friend-phone-app-safari');
        const safariView = document.getElementById('friend-safari-view');
        if (safariBtn && safariView) {
            safariBtn.onclick = () => {
                if (window.openView) window.openView(safariView);
                
                const topbar = document.getElementById('friend-safari-topbar');
                const searchBar = document.getElementById('friend-safari-search-bar');
                const backBtnIcon = document.getElementById('friend-safari-back-btn');
                const normalMode = document.getElementById('friend-safari-normal-mode');
                const privateMode = document.getElementById('friend-safari-private-mode');
                const dock = document.getElementById('friend-safari-dock');
                const privateToggleBtn = document.getElementById('friend-safari-private-btn');

                // State
                let isPrivateMode = false;

                if (privateToggleBtn) {
                    privateToggleBtn.onclick = () => {
                        isPrivateMode = !isPrivateMode;
                        
                        if (isPrivateMode) {
                            safariView.style.background = '#000';
                            topbar.style.background = '#000';
                            searchBar.style.background = '#1c1c1e';
                            searchBar.style.color = '#8e8e93';
                            backBtnIcon.style.color = '#fff';
                            dock.style.background = 'rgba(0,0,0,0.95)';
                            dock.style.color = '#fff';
                            dock.style.borderTop = '1px solid transparent'; // 移除无痕白线
                            
                            normalMode.style.opacity = '0';
                            normalMode.style.pointerEvents = 'none';
                            normalMode.style.transform = 'translateY(-20px)';
                            
                            privateMode.style.opacity = '1';
                            privateMode.style.pointerEvents = 'auto';
                            privateMode.style.transform = 'translateY(0)';
                        } else {
                            safariView.style.background = '#f4f4f5';
                            topbar.style.background = '#f4f4f5';
                            searchBar.style.background = '#e5e5ea';
                            searchBar.style.color = '#8e8e93';
                            backBtnIcon.style.color = '#111';
                            dock.style.background = 'rgba(255,255,255,0.95)';
                            dock.style.color = '#111';
                            dock.style.borderTop = '1px solid #f0f0f0'; // 恢复普通模式白线
                            
                            privateMode.style.opacity = '0';
                            privateMode.style.pointerEvents = 'none';
                            privateMode.style.transform = 'translateY(20px)';
                            
                            normalMode.style.opacity = '1';
                            normalMode.style.pointerEvents = 'auto';
                            normalMode.style.transform = 'translateY(0)';
                        }
                    };
                }

                const historyList = document.getElementById('friend-safari-history-list');
                const privateHistoryList = document.getElementById('friend-safari-private-history-list');

                if (historyList) {
                    if (friend.safariData && friend.safariData.recentSearches) {
                        historyList.innerHTML = friend.safariData.recentSearches.map((s, idx) => {
                            let text = typeof s === 'string' ? s : (s.keyword || '未知搜索');
                            return `
                        <div class="safari-history-item-new" data-idx="${idx}" style="display: flex; align-items: center; gap: 15px; padding: 16px 0; border-bottom: 1px solid rgba(0,0,0,0.04); cursor: pointer;">
                            <i class="fas fa-search" style="color: #c7c7cc; font-size: 14px; pointer-events: none;"></i>
                            <span style="font-size: 16px; color: #111; pointer-events: none; font-weight: 500;">${text}</span>
                        </div>
                        `}).join('');

                        setTimeout(() => {
                            try {
                                const items = historyList.querySelectorAll('.safari-history-item-new');
                                items.forEach(el => {
                                    el.addEventListener('click', function(e) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const idx = this.getAttribute('data-idx');
                                        const s = friend.safariData.recentSearches[idx];
                                        if (typeof s === 'object' && s.title && s.content) {
                                            window.lovesApp.showBrowserDetailModal(s.title, s.content, false);
                                        } else {
                                            window.lovesApp.showBrowserDetailModal('搜索记录', '无更多详情', false);
                                        }
                                    });
                                    window.lovesApp.bindLongPress(el, function() {
                                        const idx = el.getAttribute('data-idx');
                                        const s = friend.safariData.recentSearches[idx];
                                        const text = typeof s === 'string' ? s : (s.keyword || '未知搜索');
                                        window.lovesApp.showDeleteConfirm(text, () => {
                                            friend.safariData.recentSearches.splice(idx, 1);
                                            safariBtn.onclick(); // 重新渲染
                                        });
                                    });
                                });
                            } catch(err) {
                                console.error('Safari normal bind error', err);
                            }
                        }, 50);
                    } else {
                        historyList.innerHTML = '<div style="padding: 30px; text-align: center; color: #8e8e93; font-size: 14px;">暂无搜索数据<br><span style="font-size: 12px; margin-top: 5px; display: inline-block;">请在设置中生成</span></div>';
                    }
                }

                // 渲染无痕模式列表
                if (privateHistoryList) {
                    if (friend.safariData && friend.safariData.privateSearches) {
                        privateHistoryList.innerHTML = friend.safariData.privateSearches.map((s, idx) => {
                            let text = typeof s === 'string' ? s : (s.keyword || '未知记录');
                            return `
                        <div class="safari-private-item-new" data-idx="${idx}" style="display: flex; align-items: center; gap: 15px; padding: 16px 0; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: pointer;">
                            <i class="fas fa-search" style="color: #666; font-size: 14px; pointer-events: none;"></i>
                            <span style="font-size: 16px; color: #fff; pointer-events: none; font-weight: 500;">${text}</span>
                        </div>
                        `}).join('');

                        setTimeout(() => {
                            try {
                                const items = privateHistoryList.querySelectorAll('.safari-private-item-new');
                                items.forEach(el => {
                                    el.addEventListener('click', function(e) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const idx = this.getAttribute('data-idx');
                                        const s = friend.safariData.privateSearches[idx];
                                        if (typeof s === 'object' && s.title && s.content) {
                                            window.lovesApp.showBrowserDetailModal(s.title, s.content, true);
                                        } else {
                                            window.lovesApp.showBrowserDetailModal('隐私记录', '无更多详情', true);
                                        }
                                    });
                                    window.lovesApp.bindLongPress(el, function() {
                                        const idx = el.getAttribute('data-idx');
                                        const s = friend.safariData.privateSearches[idx];
                                        const text = typeof s === 'string' ? s : (s.keyword || '未知记录');
                                        window.lovesApp.showDeleteConfirm(text, () => {
                                            friend.safariData.privateSearches.splice(idx, 1);
                                            safariBtn.onclick(); // 重新渲染
                                        });
                                    });
                                });
                            } catch(err) {
                                console.error('Safari private bind error', err);
                            }
                        }, 50);
                    } else {
                        privateHistoryList.innerHTML = '<div style="padding: 30px; text-align: center; color: #666; font-size: 14px;">暂无无痕搜索数据<br><span style="font-size: 12px; margin-top: 5px; display: inline-block;">请在设置中生成</span></div>';
                    }
                }
            };
        }
        const safariBackBtn = document.getElementById('friend-safari-back-btn');
        if (safariBackBtn) safariBackBtn.onclick = () => { if (window.closeView) window.closeView(safariView); };

        // 绑定微博
        const weiboBtn = document.getElementById('friend-phone-app-weibo');
        const weiboView = document.getElementById('friend-weibo-view');
        if (weiboBtn && weiboView) {
            weiboBtn.onclick = () => {
                this.currentWeiboAccount = 'main';
                this.renderFriendWeibo(friend);

                const tabs = Array.from(weiboView.querySelectorAll('.friend-weibo-tab'));
                const pages = document.getElementById('friend-weibo-pages');
                const setActiveWeiboTab = (activeIndex) => {
                    tabs.forEach((tab, index) => {
                        const isActive = index === activeIndex;
                        tab.style.color = isActive ? '#111' : '#777';
                        tab.style.fontWeight = isActive ? '700' : '600';
                        const line = tab.querySelector('.friend-weibo-tab-line');
                        if (line) line.style.display = isActive ? 'block' : 'none';
                    });
                };
                if (pages && tabs.length) {
                    tabs.forEach((tab, index) => {
                        tab.onclick = () => {
                            pages.scrollTo({ left: index * pages.clientWidth, behavior: 'smooth' });
                            setActiveWeiboTab(index);
                        };
                    });
                    pages.onscroll = () => {
                        const pageWidth = pages.clientWidth || 1;
                        const activeIndex = Math.max(0, Math.min(2, Math.round(pages.scrollLeft / pageWidth)));
                        setActiveWeiboTab(activeIndex);
                    };
                    pages.scrollTo({ left: 0, behavior: 'auto' });
                    setActiveWeiboTab(0);
                }

                if (window.openView) window.openView(weiboView);
            };
        }
        const weiboSwitchBtn = document.getElementById('friend-weibo-switch-account-btn');
        if (weiboSwitchBtn) {
            weiboSwitchBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const data = this.getFriendWeiboData(friend);
                if (this.currentWeiboAccount === 'main') {
                    if (!data.altAccount) {
                        if (window.showToast) window.showToast('暂无微博小号数据，请在生成设置中生成微博');
                        return;
                    }
                    this.currentWeiboAccount = 'alt';
                } else {
                    this.currentWeiboAccount = 'main';
                }
                this.renderFriendWeibo(friend);
                if (window.showToast) window.showToast(this.currentWeiboAccount === 'alt' ? '已切换到微博小号' : '已切换到微博大号');
            };
        }
        const weiboBackBtn = document.getElementById('friend-weibo-back-btn');
        if (weiboBackBtn) weiboBackBtn.onclick = () => { if (window.closeView) window.closeView(weiboView); };

        // 绑定 Music
        const musicBtn = document.getElementById('friend-phone-app-music');
        const musicView = document.getElementById('friend-music-view');
        if (musicBtn && musicView) {
            musicBtn.onclick = () => {
                if (window.openView) window.openView(musicView);
                const musicContent = document.getElementById('friend-music-content');
                if (musicContent) {
                    let musicData = friend.musicData;
                    
                    if (!musicData || !musicData.top || musicData.top.length === 0) {
                        musicContent.innerHTML = '<div style="padding: 50px 20px; text-align: center; color: #8e8e93; font-size: 15px;">暂无音乐数据<br><span style="font-size: 13px; margin-top: 8px; display: inline-block;">请在设置中生成</span></div>';
                    } else {
                        const topListHTML = (musicData.top || []).map((song, index) => `
                            <div class="music-history-item" data-idx="${index}" style="display: flex; align-items: center; gap: 15px; padding: 10px 0; border-bottom: 1px solid #f0f0f0; cursor: pointer;">
                                <div style="font-size: 16px; font-weight: 700; color: #111; width: 20px; text-align: center;">${index + 1}</div>
                                <div style="width: 50px; height: 50px; border-radius: 6px; background: #111; flex-shrink: 0; display: flex; justify-content: center; align-items: center; color: #fff;">
                                    <i class="fas fa-music"></i>
                                </div>
                                <div style="flex: 1; display: flex; flex-direction: column; pointer-events: none;">
                                    <div style="font-size: 16px; font-weight: 600; color: #111;">${song.name}</div>
                                    <div style="font-size: 13px; color: #8e8e93;">${song.artist}</div>
                                </div>
                                <i class="fas fa-ellipsis-v" style="color: #c7c7cc; pointer-events: none;"></i>
                            </div>
                        `).join('');

                        musicContent.innerHTML = `
                        <div style="padding: 20px 16px; background: #fff;">
                            <div style="font-size: 28px; font-weight: 800; color: #111; margin-bottom: 20px; letter-spacing: -0.5px;">音乐库</div>
                            <div style="display: flex; gap: 15px; overflow-x: auto; padding-bottom: 15px;">
                                <div style="min-width: 140px; display: flex; flex-direction: column; gap: 10px;">
                                    <div style="width: 140px; height: 140px; border-radius: 12px; background: #f4f4f5; display: flex; justify-content: center; align-items: center; color: #111; font-size: 30px; ">
                                        <i class="fas fa-history"></i>
                                    </div>
                                    <div style="font-size: 15px; font-weight: 700; color: #111;">最近播放</div>
                                    <div style="font-size: 13px; color: #8e8e93;">${musicData.recent ? musicData.recent.length : 0} 首歌曲</div>
                                </div>
                                <div style="min-width: 140px; display: flex; flex-direction: column; gap: 10px;">
                                    <div style="width: 140px; height: 140px; border-radius: 12px; background: #111; display: flex; justify-content: center; align-items: center; color: #fff; font-size: 30px; ">
                                        <i class="fas fa-heart"></i>
                                    </div>
                                    <div style="font-size: 15px; font-weight: 700; color: #111;">最爱</div>
                                    <div style="font-size: 13px; color: #8e8e93;">${musicData.favorites ? musicData.favorites.length : 0} 首歌曲</div>
                                </div>
                            </div>
                        </div>
                        <div style="padding: 10px 16px 30px; background: #fff; border-top: 1px solid #f0f0f0;">
                            <div style="font-size: 22px; font-weight: 700; color: #111; margin-bottom: 15px; margin-top: 10px;">听歌排行</div>
                            <div style="display: flex; flex-direction: column; gap: 5px;">
                                ${topListHTML}
                            </div>
                        </div>
                        `;
                    }

                    setTimeout(() => {
                        try {
                            const items = musicContent.querySelectorAll('.music-history-item');
                            items.forEach(el => {
                                el.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const idx = this.getAttribute('data-idx');
                                    const song = musicData.top[idx];
                                    
                                    const loops = parseInt(song.loops) || Math.floor(Math.random() * 100) + 10;
                                    const thoughts = song.thoughts || '这首歌旋律很好听，每次听都能让我安静下来。';
                                    
                                    const content = `
                                        <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 20px;">
                                            <div style="width: 80px; height: 80px; border-radius: 50%; background: #111; display: flex; justify-content: center; align-items: center; color: #fff; font-size: 30px; margin-bottom: 15px; ">
                                                <i class="fas fa-compact-disc"></i>
                                            </div>
                                            <div style="font-size: 22px; font-weight: 800; color: #111; margin-bottom: 4px;">${song.name}</div>
                                            <div style="font-size: 15px; color: #8e8e93;">${song.artist}</div>
                                        </div>
                                        
                                        <div style="background: #f4f4f5; border-radius: 16px; padding: 15px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <div style="width: 32px; height: 32px; border-radius: 8px; background: #fff; display: flex; justify-content: center; align-items: center; color: #111;">
                                                    <i class="fas fa-redo-alt" style="font-size: 14px;"></i>
                                                </div>
                                                <span style="font-size: 15px; font-weight: 600; color: #111;">循环次数</span>
                                            </div>
                                            <div style="font-size: 20px; font-weight: 800; color: #111;">${loops} <span style="font-size: 13px; font-weight: 500; color: #8e8e93;">次</span></div>
                                        </div>

                                        <div style="background: #111; border-radius: 16px; padding: 20px; border-left: 4px solid #fff;">
                                            <div style="font-weight: 700; color: #fff; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                                <i class="fas fa-headphones-alt" style="color: #fff;"></i> 听歌心声
                                            </div>
                                            <div style="color: #ccc; line-height: 1.6; font-size: 14px; font-style: italic;">
                                                “${thoughts.replace(/\n/g, '<br>')}”
                                            </div>
                                        </div>
                                    `;
                                    window.lovesApp.showDetailModal('单曲详情', content);
                                });
                                window.lovesApp.bindLongPress(el, function() {
                                    const idx = el.getAttribute('data-idx');
                                    const song = musicData.top[idx];
                                    window.lovesApp.showDeleteConfirm(song.name, () => {
                                        musicData.top.splice(idx, 1);
                                        musicBtn.onclick(); // 重新渲染
                                    });
                                });
                            });
                        } catch(err) {
                            console.error('Music bind error', err);
                        }
                    }, 50);
                }
            };
        }
        const musicBackBtn = document.getElementById('friend-music-back-btn');
        if (musicBackBtn) musicBackBtn.onclick = () => { if (window.closeView) window.closeView(musicView); };

        // 绑定 电话
        const callBtn = document.getElementById('friend-phone-app-call');
        const callView = document.getElementById('friend-phonecall-view');
        if (callBtn && callView) {
            callBtn.onclick = () => {
                if (window.openView) window.openView(callView);
                
                const tabRecent = document.getElementById('friend-call-tab-recent');
                const tabContacts = document.getElementById('friend-call-tab-contacts');
                const listRecent = document.getElementById('friend-call-list');
                const listContacts = document.getElementById('friend-contact-list');
                
                // Tabs toggle logic
                if (tabRecent && tabContacts && listRecent && listContacts) {
                    tabRecent.onclick = () => {
                        tabRecent.style.background = '#fff';
                        tabRecent.style.color = '#111';
                        tabRecent.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                        
                        tabContacts.style.background = 'transparent';
                        tabContacts.style.color = '#8e8e93';
                        tabContacts.style.boxShadow = 'none';
                        
                        listRecent.style.display = 'block';
                        listContacts.style.display = 'none';
                    };
                    
                    tabContacts.onclick = () => {
                        tabContacts.style.background = '#fff';
                        tabContacts.style.color = '#111';
                        tabContacts.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                        
                        tabRecent.style.background = 'transparent';
                        tabRecent.style.color = '#8e8e93';
                        tabRecent.style.boxShadow = 'none';
                        
                        listContacts.style.display = 'block';
                        listRecent.style.display = 'none';
                    };
                }

                if (listRecent && friend.callData && friend.callData.recentCalls) {
                    listRecent.innerHTML = friend.callData.recentCalls.map((c, idx) => {
                        let typeIcon = '';
                        if (c.type === 'missed') {
                            typeIcon = '<i class="fas fa-phone-slash" style="color: #ff3b30; font-size: 10px;"></i>';
                        } else if (c.type === 'outgoing') {
                            typeIcon = '<i class="fas fa-phone" style="color: #8e8e93; font-size: 10px;"></i>';
                        } else {
                            typeIcon = '<i class="fas fa-phone-alt" style="color: #8e8e93; font-size: 10px;"></i>';
                        }
                        return `
                        <div class="call-history-item-new" data-idx="${idx}" style="display: flex; align-items: center; padding: 15px 0; cursor: pointer;">
                            <div style="flex: 1; display: flex; flex-direction: column; pointer-events: none;">
                                <div style="font-size: 18px; font-weight: 600; color: ${c.type === 'missed' ? '#ff3b30' : '#111'};">${c.name}</div>
                                <div style="font-size: 14px; color: #8e8e93; display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                                    ${typeIcon}
                                    <span>${c.type === 'missed' ? '未接来电' : '语音通话'}</span>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 15px; pointer-events: none;">
                                <span style="color: #8e8e93; font-size: 14px;">${c.time}</span>
                                <i class="fas fa-info-circle" style="color: #007aff; font-size: 22px;"></i>
                            </div>
                        </div>`;
                    }).join('');
                    
                    // Render contacts list
                    if (listContacts) {
                        const contacts = friend.callData.contacts || [...new Set(friend.callData.recentCalls.map(c => c.name))].map(name => ({
                            name: name,
                            addedTime: '未知时间',
                            recentCallTime: '近期',
                            callReason: '日常联系'
                        }));
                        friend.callData._parsedContacts = contacts;

                        listContacts.innerHTML = contacts.map((contact, idx) => `
                            <div class="contact-item-new" data-idx="${idx}" style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #e5e5ea; cursor: pointer;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: #f2f2f7; display: flex; justify-content: center; align-items: center; color: #8e8e93; margin-right: 15px; font-size: 16px; pointer-events: none;">
                                    <i class="fas fa-user"></i>
                                </div>
                                <div style="flex: 1; font-size: 16px; font-weight: 600; color: #111; pointer-events: none;">${contact.name}</div>
                                <i class="fas fa-info-circle" style="color: #007aff; font-size: 20px; pointer-events: none;"></i>
                            </div>
                        `).join('');
                    }

                    setTimeout(() => {
                        try {
                            const items = listRecent.querySelectorAll('.call-history-item-new');
                            items.forEach(el => {
                                el.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const idx = this.getAttribute('data-idx');
                                    const c = friend.callData.recentCalls[idx];
                                    window.lovesApp.showCallDetailModal(c);
                                });
                                window.lovesApp.bindLongPress(el, function() {
                                    const idx = el.getAttribute('data-idx');
                                    const c = friend.callData.recentCalls[idx];
                                    window.lovesApp.showDeleteConfirm(c.name + '的通话记录', () => {
                                        friend.callData.recentCalls.splice(idx, 1);
                                        callBtn.onclick();
                                    });
                                });
                            });

                            if (listContacts && friend.callData._parsedContacts) {
                                const contactItems = listContacts.querySelectorAll('.contact-item-new');
                                contactItems.forEach(el => {
                                    el.addEventListener('click', function(e) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const idx = this.getAttribute('data-idx');
                                        const c = friend.callData._parsedContacts[idx];
                                        window.lovesApp.showContactDetailModal(c);
                                    });
                                });
                            }
                        } catch(err) {
                            console.error('Call bind error', err);
                        }
                    }, 50);
                } else if (listRecent) {
                    listRecent.innerHTML = '<div style="padding: 30px; text-align: center; color: #8e8e93; font-size: 14px;">暂无通话记录<br><span style="font-size: 12px; margin-top: 5px; display: inline-block;">请在设置中生成</span></div>';
                    if (listContacts) {
                        listContacts.innerHTML = '<div style="padding: 30px; text-align: center; color: #8e8e93; font-size: 14px;">暂无联系人</div>';
                    }
                }
            };
        }
        const callBackBtn = document.getElementById('friend-phonecall-back-btn');
        if (callBackBtn) callBackBtn.onclick = () => { if (window.closeView) window.closeView(callView); };

        // 绑定 健康
        const healthBtn = document.getElementById('friend-phone-app-health');
        const healthView = document.getElementById('friend-health-view');
        if (healthBtn && healthView) {
            healthBtn.onclick = () => {
                if (window.openView) window.openView(healthView);
                const healthContent = document.getElementById('friend-health-content');
                if (healthContent) {
                    if (!friend.healthData) {
                        healthContent.innerHTML = '<div style="padding: 50px 20px; text-align: center; color: #8e8e93; font-size: 15px;">暂无健康数据<br><span style="font-size: 13px; margin-top: 8px; display: inline-block;">请在设置中生成</span></div>';
                    } else {
                    const today = new Date();
                    
                    // 生成日期选项
                    const datesHtml = [-2, -1, 0, 1, 2].map(offset => {
                        const d = new Date(today);
                        d.setDate(today.getDate() + offset);
                        const dayStr = d.getDate();
                        const weekStr = ['日','一','二','三','四','五','六'][d.getDay()];
                        const isActive = offset === 0;
                        
                        return `
                            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 44px; height: 56px; border-radius: 14px; background: ${isActive ? '#111' : 'transparent'}; color: ${isActive ? '#fff' : '#8e8e93'}; flex-shrink: 0; cursor: pointer; ">
                                <div style="font-size: 11px; font-weight: 600; margin-bottom: 2px;">${weekStr}</div>
                                <div style="font-size: 16px; font-weight: 800;">${dayStr}</div>
                            </div>
                        `;
                    }).join('');

                    healthContent.innerHTML = `
                        <!-- 顶部日期选择 -->
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                            <div style="font-size: 28px; font-weight: 800; color: #111; letter-spacing: -0.5px;">摘要</div>
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: #f2f2f7; display: flex; justify-content: center; align-items: center; color: #111; font-size: 14px; cursor: pointer;">
                                <i class="fas fa-calendar-day"></i>
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; background: #fff; border-radius: 20px; padding: 8px; ">
                            ${datesHtml}
                        </div>

                        <!-- 步数卡片 -->
                        <div style="background: #fff; border-radius: 24px; padding: 22px; margin-bottom: 15px; border: 1px solid #f0f0f0; ">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 8px; color: #111; font-weight: 600;">
                                    <div style="width: 28px; height: 28px; border-radius: 8px; background: #f2f2f7; display: flex; justify-content: center; align-items: center;"><i class="fas fa-shoe-prints" style="font-size: 12px; color: #ff3b30;"></i></div>
                                    <span>步数</span>
                                </div>
                                <div style="font-size: 12px; color: #8e8e93; font-weight: 600;">14:20 更新</div>
                            </div>
                            <div style="font-size: 42px; font-weight: 800; color: #111; display: flex; align-items: baseline; gap: 6px; letter-spacing: -1px;">
                                ${friend.healthData.steps || '0'} <span style="font-size: 15px; color: #8e8e93; font-weight: 600; letter-spacing: 0;">步</span>
                            </div>
                        </div>

                        <!-- 睡眠卡片 -->
                        <div style="background: #fff; border-radius: 24px; padding: 22px; margin-bottom: 15px; border: 1px solid #f0f0f0; ">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 8px; color: #111; font-weight: 600;">
                                    <div style="width: 28px; height: 28px; border-radius: 8px; background: #f2f2f7; display: flex; justify-content: center; align-items: center;"><i class="fas fa-bed" style="font-size: 12px; color: #5856d6;"></i></div>
                                    <span>睡眠</span>
                                </div>
                                <div style="font-size: 12px; color: #8e8e93; font-weight: 600;">昨晚记录</div>
                            </div>
                            <div style="font-size: 36px; font-weight: 800; color: #111; display: flex; align-items: baseline; gap: 6px; letter-spacing: -0.5px;">
                                ${friend.healthData.sleepHours || '0'} <span style="font-size: 15px; color: #8e8e93; font-weight: 600; letter-spacing: 0;">小时</span> 
                                ${friend.healthData.sleepMinutes || '0'} <span style="font-size: 15px; color: #8e8e93; font-weight: 600; letter-spacing: 0;">分钟</span>
                            </div>
                        </div>

                        <!-- 身体指标 -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div style="background: #fff; border-radius: 24px; padding: 20px; border: 1px solid #f0f0f0; ">
                                <div style="display: flex; align-items: center; gap: 8px; color: #111; font-weight: 600; margin-bottom: 16px;">
                                    <div style="width: 28px; height: 28px; border-radius: 8px; background: #f2f2f7; display: flex; justify-content: center; align-items: center;"><i class="fas fa-weight" style="font-size: 12px; color: #007aff;"></i></div>
                                    <span>体重</span>
                                </div>
                                <div style="font-size: 28px; font-weight: 800; color: #111; letter-spacing: -0.5px;">${friend.healthData.weight || '-'} <span style="font-size: 13px; color: #8e8e93; font-weight: 600; letter-spacing: 0;">kg</span></div>
                            </div>
                            <div style="background: #fff; border-radius: 24px; padding: 20px; border: 1px solid #f0f0f0; ">
                                <div style="display: flex; align-items: center; gap: 8px; color: #111; font-weight: 600; margin-bottom: 16px;">
                                    <div style="width: 28px; height: 28px; border-radius: 8px; background: #f2f2f7; display: flex; justify-content: center; align-items: center;"><i class="fas fa-ruler-vertical" style="font-size: 12px; color: #ff9500;"></i></div>
                                    <span>身高</span>
                                </div>
                                <div style="font-size: 28px; font-weight: 800; color: #111; letter-spacing: -0.5px;">${friend.healthData.height || '-'} <span style="font-size: 13px; color: #8e8e93; font-weight: 600; letter-spacing: 0;">cm</span></div>
                            </div>
                        </div>
                    `;
                    }
                }
            };
        }
        const healthBackBtn = document.getElementById('friend-health-back-btn');
        if (healthBackBtn) healthBackBtn.onclick = () => { if (window.closeView) window.closeView(healthView); };

        // 绑定 Pay
        const payBtn = document.getElementById('friend-phone-app-pay');
        const payView = document.getElementById('friend-pay-view');
        if (payBtn && payView) {
            payBtn.onclick = () => {
                if (window.openView) window.openView(payView);
                const payContent = document.getElementById('friend-pay-content');
                if (payContent) {
                    let payData = friend.payData;
                    if (!payData) {
                        payContent.innerHTML = '<div style="padding: 50px 20px; text-align: center; color: #8e8e93; font-size: 15px;">暂无钱包数据<br><span style="font-size: 13px; margin-top: 8px; display: inline-block;">请在设置中生成</span></div>';
                    } else {
                    let cards = payData.cards;
                    if (!cards) {
                        const totalStr = String(payData.totalAssets || '0').replace(/,/g, '');
                        const total = parseFloat(totalStr) || 0;
                        const txs = payData.recentTransactions || [];
                        
                        cards = [
                            {
                                id: 'card1',
                                bankName: '黑金储蓄卡',
                                cardType: 'Debit',
                                cardNumber: '**** **** **** 8888',
                                amount: (total * 0.6).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
                                transactions: txs.filter((_, i) => i % 2 === 0)
                            },
                            {
                                id: 'card2',
                                bankName: '白金信用卡',
                                cardType: 'Credit',
                                cardNumber: '**** **** **** 1234',
                                amount: (total * 0.4).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
                                transactions: txs.filter((_, i) => i % 2 !== 0)
                            },
                            {
                                id: 'card3',
                                bankName: '虚拟支付卡',
                                cardType: 'Prepaid',
                                cardNumber: '**** **** **** 9999',
                                amount: '0.00',
                                transactions: []
                            }
                        ];
                        // If we didn't generate payData earlier, we attach it now
                        if (friend.payData) {
                            friend.payData.cards = cards;
                        }
                    }
                    
                    let activeCardIndex = 0;

                    const renderPayView = () => {
                        const cardsHTML = cards.map((c, i) => {
                            // 层叠算法：active在最上，其它卡在下方依次堆叠
                            const isActive = i === activeCardIndex;
                            let translateY = 0;
                            let scale = 1;
                            let opacity = 1;
                            let zIndex = 100;

                            // 极简纯深色系，完全消除反差防止刺眼，统一为偏黑质感
                            const bgStyles = [
                                'linear-gradient(135deg, #111, #1a1a1c)', // 深邃黑
                                'linear-gradient(135deg, #141416, #222)', // 稍亮一点黑
                                'linear-gradient(135deg, #0a0a0c, #161618)' // 更暗的黑
                            ];
                            const bgStyle = bgStyles[i % bgStyles.length];
                            
                            // 统一灰白文字
                            const textColor = '#fff';
                            const subtitleColor = 'rgba(255,255,255,0.6)';
                            const borderColor = 'rgba(255,255,255,0.15)';
                            
                            if (!isActive) {
                                // 重构：计算从激活卡片之后开始排队的严格递增索引 (1, 2, 3...)
                                // 取消原来可能出现跳跃的计算方式，只要你不是激活卡，你就排在下面
                                let rank = i - activeCardIndex;
                                if (rank < 0) {
                                    rank += cards.length;
                                }
                                // rank 会是 1, 2... 表示在你下面排第几位
                                
                                // 修改：增加基础偏移量，使未激活卡片被往下推，从而在切换时产生更明显的抽拉感
                                translateY = 40 + ((rank - 1) * 20); 
                                scale = 1 - (0.06 * rank); // 按名次缩小更多，增加层叠的空间感
                                zIndex = 10 - rank;
                            } else {
                                translateY = -10; // 激活卡片稍微往上浮动一点
                                scale = 1.02; // 稍微放大
                                zIndex = 100;
                            }

                            // 过渡曲线稍快，消除生硬感，非常平滑，甚至带一点弹性
                            const transCSS = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.6s ease';

                            return `
                                <div class="pay-wallet-card" data-idx="${i}" style="position: absolute; top: 0; left: 0; right: 0; height: 180px; background: ${bgStyle}; border-radius: 20px; padding: 20px; color: ${textColor};  transition: ${transCSS}; transform: translateY(${translateY}px) scale(${scale}); opacity: ${opacity}; z-index: ${zIndex}; cursor: pointer; border: 1px solid rgba(255,255,255,0.08);">
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                                        <div style="font-size: 16px; font-weight: 700; letter-spacing: 0.5px;">${c.bankName}</div>
                                        <div style="font-size: 11px; color: ${subtitleColor}; border: 1px solid ${borderColor}; padding: 2px 10px; border-radius: 12px; font-weight: 600;">${c.cardType}</div>
                                    </div>
                                    <div style="font-size: 20px; font-family: monospace; letter-spacing: 2px; margin-bottom: 20px; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${c.cardNumber}</div>
                                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                                        <div>
                                            <div style="font-size: 11px; color: ${subtitleColor}; margin-bottom: 4px; font-weight: 500;">当前金额</div>
                                            <div style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">¥ ${c.amount}</div>
                                        </div>
                                        <i class="fab fa-cc-visa" style="font-size: 28px; color: ${textColor}; opacity: 0.7;"></i>
                                    </div>
                                </div>
                            `;
                        }).join('');

                        const activeCard = cards[activeCardIndex];
                        // 极简黑白灰交易明细
                        const txHTML = activeCard.transactions && activeCard.transactions.length > 0 ? activeCard.transactions.map(tx => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 0; border-bottom: 1px solid #f0f0f0;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 40px; height: 40px; border-radius: 12px; background: #f4f4f5; display: flex; justify-content: center; align-items: center; color: #111; font-size: 14px;">
                                        <i class="${tx.isIncome ? 'fas fa-arrow-down' : 'fas fa-arrow-up'}" style="transform: ${tx.isIncome ? 'none' : 'rotate(45deg)'};"></i>
                                    </div>
                                    <div>
                                        <div style="font-size: 15px; font-weight: 600; color: #111; margin-bottom: 2px;">${tx.title}</div>
                                        <div style="font-size: 12px; color: #8e8e93; font-weight: 500;">${tx.time}</div>
                                    </div>
                                </div>
                                <div style="font-size: 16px; font-weight: 700; color: #111;">${tx.isIncome ? '+' : ''}${tx.amount}</div>
                            </div>
                        `).join('') : '<div style="padding: 30px; text-align: center; color: #8e8e93; font-size: 13px;">暂无交易记录</div>';

                        // 高度计算：基于堆叠的最底下一张卡片的 translateY 加上露出部分
                        const maxTranslateY = 50 + (Math.max(0, cards.length - 2) * 20);
                        const containerHeight = maxTranslateY + 45 + 180; // 确保留出足够的空间

                        payContent.innerHTML = `
                            <style>
                            #pay-tx-container { animation: fadeUp 0.4s ease-out forwards; } 
                            @keyframes fadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                            </style>
                            <div style="padding: 20px;">
                                <div style="font-size: 34px; font-weight: 800; color: #111; margin-bottom: 25px; letter-spacing: -0.5px;">Cards</div>
                                <div id="pay-cards-container" style="position: relative; width: 100%; height: ${containerHeight}px; margin-bottom: 10px;">
                                    ${cardsHTML}
                                </div>
                            </div>
                            
                            <div style="padding: 0 20px 40px;" id="pay-tx-container">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                                    <div style="font-size: 20px; font-weight: 800; color: #111; letter-spacing: -0.5px;">Transactions</div>
                                    <div style="width: 32px; height: 32px; border-radius: 16px; background: #e5e5ea; display: flex; justify-content: center; align-items: center; color: #111; font-size: 14px;">
                                        <i class="fas fa-search"></i>
                                    </div>
                                </div>
                                <div style="background: #fff; border-radius: 20px; padding: 0 20px; ">
                                    ${txHTML}
                                </div>
                            </div>
                        `;

                        const container = document.getElementById('pay-cards-container');
                        if (container) {
                            container.querySelectorAll('.pay-wallet-card').forEach(el => {
                                el.onclick = () => {
                                    const idx = parseInt(el.getAttribute('data-idx'));
                                    if (idx !== activeCardIndex) {
                                        activeCardIndex = idx;
                                        renderPayView(); // 重新渲染触发动画
                                    }
                                };
                            });
                        }
                    };

                    renderPayView();
                    }
                }
            };
        }
        const payBackBtn = document.getElementById('friend-pay-back-btn');
        if (payBackBtn) payBackBtn.onclick = () => { if (window.closeView) window.closeView(payView); };

        // 绑定 Game
        const gameBtn = document.getElementById('friend-phone-app-game');
        const gameView = document.getElementById('friend-game-view');
        if (gameBtn && gameView) {
            gameBtn.onclick = () => {
                if (window.openView) window.openView(gameView);
                const gameContent = document.getElementById('friend-game-content');
                if (gameContent && friend.gameData) {
                    const gamesHTML = friend.gameData.recentGames ? friend.gameData.recentGames.map((g, idx) => {
                        return `
                        <div class="game-history-item-new" data-idx="${idx}" style="background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 20px; padding: 18px; display: flex; gap: 16px; align-items: center; cursor: pointer;">
                            <div style="width: 56px; height: 56px; border-radius: 16px; background: #2c2c2e; display: flex; justify-content: center; align-items: center; font-size: 24px; color: #fff; pointer-events: none;">
                                <i class="${g.icon || 'fas fa-gamepad'}"></i>
                            </div>
                            <div style="flex: 1; pointer-events: none;">
                                <div style="font-size: 17px; font-weight: 600; color: #fff; letter-spacing: 0.5px;">${g.name}</div>
                                <div style="font-size: 13px; color: #8e8e93; margin-top: 4px;">时长: ${g.hours}</div>
                                <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
                                    <div style="background: #3a3a3c; color: #fff; font-size: 11px; padding: 3px 10px; border-radius: 6px; font-weight: 600;">${g.rank}</div>
                                    <div style="font-size: 12px; color: #8e8e93;">胜率: <span style="color: #fff; font-weight: 500;">${g.winRate}</span></div>
                                </div>
                            </div>
                        </div>
                    `}).join('') : '';

                    gameContent.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 30px;">
                            <div style="width: 70px; height: 70px; border-radius: 50%; background: #1c1c1e; display: flex; justify-content: center; align-items: center; font-size: 30px; color: #fff; border: 2px solid #3a3a3c;">
                                <i class="fas fa-user"></i>
                            </div>
                            <div>
                                <div style="font-size: 20px; font-weight: 700; color: #fff; letter-spacing: 0.5px;">${friend.gameData.playerName || 'Player One'}</div>
                                <div style="font-size: 13px; color: #8e8e93; margin-top: 6px;">游戏总时长: <span style="color: #fff; font-weight: 500;">${friend.gameData.totalHours || '0 小时'}</span></div>
                            </div>
                        </div>
                        <div style="font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 15px;">常玩的游戏</div>
                        <div style="display: flex; flex-direction: column; gap: 15px;">
                            ${gamesHTML}
                        </div>
                    `;

                    setTimeout(() => {
                        try {
                            const items = gameContent.querySelectorAll('.game-history-item-new');
                            items.forEach(el => {
                                window.lovesApp.bindLongPress(el, function() {
                                    const idx = el.getAttribute('data-idx');
                                    const g = friend.gameData.recentGames[idx];
                                    window.lovesApp.showDeleteConfirm(g.name, () => {
                                        friend.gameData.recentGames.splice(idx, 1);
                                        gameBtn.onclick();
                                    });
                                });

                                el.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const idx = this.getAttribute('data-idx');
                                    const g = friend.gameData.recentGames[idx];
                                    let content = '';
                                    if (Array.isArray(g.matches)) {
                                        content += `<div style="background: #f4f4f5; border-radius: 24px; padding: 16px; margin-bottom: 16px;">
                                            <div style="font-weight: 700; color: #111; margin-bottom: 12px; padding-left: 4px; display: flex; align-items: center; gap: 8px;"><i class="fas fa-gamepad" style="color: #111;"></i> 近期对局 (点击查看单局详情)</div>`;
                                        
                                        g.matches.forEach((m, mIdx) => {
                                            const isWin = m.result === '胜利' || m.result === 'Win';
                                            const bgColor = isWin ? '#111' : '#fff';
                                            const textColor = isWin ? '#fff' : '#8e8e93';
                                            const resultColor = isWin ? '#fff' : '#111';
                                            const kdaBgColor = isWin ? '#333' : '#f4f4f5';
                                            const kdaTextColor = isWin ? '#fff' : '#111';
                                            const iconColor = isWin ? '#fff' : '#111';
                                            
                                            // Encode match data for onclick handler
                                            const matchDataStr = encodeURIComponent(JSON.stringify(m));

                                            content += `
                                            <div class="game-match-item" data-match="${matchDataStr}" style="display: flex; align-items: center; justify-content: space-between; background: ${bgColor}; border: 1px solid #e5e5ea; border-radius: 16px; padding: 16px; margin-bottom: 10px; cursor: pointer;">
                                                <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; width: 50px; pointer-events: none;">
                                                    <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(142,142,147,0.1); display: flex; justify-content: center; align-items: center; color: ${iconColor}; font-size: 16px;">
                                                        <i class="fas fa-user"></i>
                                                    </div>
                                                    <div style="font-size: 11px; font-weight: 500; color: ${textColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center;">${m.hero || '我方'}</div>
                                                </div>
                                                
                                                <div style="display: flex; flex-direction: column; align-items: center; flex: 1; pointer-events: none;">
                                                    <div style="font-size: 18px; font-weight: 800; color: ${resultColor}; letter-spacing: 1px;">${m.result}</div>
                                                    <div style="font-size: 11px; color: #8e8e93; margin-top: 6px;">${m.time}</div>
                                                    <div style="font-size: 12px; font-weight: 700; color: ${kdaTextColor}; margin-top: 8px; background: ${kdaBgColor}; padding: 4px 10px; border-radius: 8px;">KDA: ${m.kda || '-/-/-'}</div>
                                                </div>

                                                <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; width: 50px; pointer-events: none;">
                                                    <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(142,142,147,0.1); display: flex; justify-content: center; align-items: center; color: ${iconColor}; font-size: 16px;">
                                                        <i class="fas fa-skull"></i>
                                                    </div>
                                                    <div style="font-size: 11px; font-weight: 500; color: ${textColor};">敌方</div>
                                                </div>
                                            </div>`;
                                        });
                                        content += `</div>`;
                                    } else if (typeof g.matches === 'string' && g.matches) {
                                        content += `<div style="background: #f4f4f5; border-radius: 24px; padding: 16px; margin-bottom: 16px;">
                                            <div style="font-weight: 700; color: #111; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;"><i class="fas fa-history" style="color: #111;"></i> 近期对局</div>
                                            <div style="color: #333; line-height: 1.6; font-size: 14px;">${g.matches.replace(/\n/g, '<br>')}</div>
                                        </div>`;
                                    }

                                    // For older data formats where thoughts were at the game level rather than match level
                                    if (g.innerThoughts && !Array.isArray(g.matches)) {
                                        content += `<div style="background: #f4f4f5; border-radius: 24px; padding: 16px; margin-bottom: 16px; border-left: 4px solid #111;">
                                            <div style="font-weight: 700; color: #111; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;"><i class="fas fa-headset" style="color: #111;"></i> 局内心声</div>
                                            <div style="color: #333; line-height: 1.6; font-size: 14px; font-style: italic;">“${g.innerThoughts.replace(/\n/g, '<br>')}”</div>
                                        </div>`;
                                    }
                                    
                                    if (g.postGameReflection && !Array.isArray(g.matches)) {
                                        content += `<div style="background: #111; border-radius: 24px; padding: 16px; margin-bottom: 16px;">
                                            <div style="font-weight: 700; color: #fff; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;"><i class="fas fa-clipboard-list" style="color: #fff;"></i> 局后复盘</div>
                                            <div style="color: #ccc; line-height: 1.6; font-size: 14px;">${g.postGameReflection.replace(/\n/g, '<br>')}</div>
                                        </div>`;
                                    }
                                    
                                    if (!content) content = '暂无更多数据';
                                    window.lovesApp.showDetailModal(g.name + ' - 战绩列表', content);

                                    // Bind match click events
                                    setTimeout(() => {
                                        const matchItems = document.querySelectorAll('.game-match-item');
                                        matchItems.forEach(item => {
                                            item.addEventListener('click', function() {
                                                const matchStr = this.getAttribute('data-match');
                                                if (matchStr) {
                                                    try {
                                                        const m = JSON.parse(decodeURIComponent(matchStr));
                                                        let matchDetailContent = '';
                                                        
                                                        // Base Stats
                                                        matchDetailContent += `
                                                            <div style="background: #f4f4f5; border-radius: 20px; padding: 16px; margin-bottom: 16px;">
                                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                                                    <div style="font-weight: 800; font-size: 20px; color: ${m.result === '胜利' || m.result === 'Win' ? '#111' : '#8e8e93'};">${m.result}</div>
                                                                    <div style="font-weight: 700; color: #111; background: #e5e5ea; padding: 4px 10px; border-radius: 8px;">KDA: ${m.kda || '-/-/-'}</div>
                                                                </div>
                                                                <div style="display: flex; align-items: center; gap: 8px; color: #8e8e93; font-size: 13px;">
                                                                    <i class="fas fa-clock"></i> ${m.time} | 英雄: ${m.hero || '未知'}
                                                                </div>
                                                            </div>
                                                        `;

                                                        // Highlights
                                                        if (m.highlights && Array.isArray(m.highlights) && m.highlights.length > 0) {
                                                            let highlightsHtml = m.highlights.map(h => `
                                                                <div style="display: flex; gap: 12px; margin-bottom: 8px; align-items: flex-start;">
                                                                    <div style="font-weight: 700; color: #111; font-size: 13px; background: #e5e5ea; padding: 2px 6px; border-radius: 4px; flex-shrink: 0;">${h.time}</div>
                                                                    <div style="color: #333; font-size: 14px; line-height: 1.4;">${h.desc}</div>
                                                                </div>
                                                            `).join('');
                                                            
                                                            matchDetailContent += `
                                                                <div style="background: #fff; border: 1px solid #e5e5ea; border-radius: 20px; padding: 16px; margin-bottom: 16px;">
                                                                    <div style="font-weight: 700; color: #111; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;"><i class="fas fa-bolt" style="color: #111;"></i> 高光时刻</div>
                                                                    ${highlightsHtml}
                                                                </div>
                                                            `;
                                                        }

                                                        // Inner Thoughts
                                                        if (m.innerThoughts) {
                                                            matchDetailContent += `
                                                                <div style="background: #f4f4f5; border-radius: 20px; padding: 16px; margin-bottom: 16px; border-left: 4px solid #111;">
                                                                    <div style="font-weight: 700; color: #111; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;"><i class="fas fa-headset" style="color: #111;"></i> 局内心声</div>
                                                                    <div style="color: #333; line-height: 1.6; font-size: 14px; font-style: italic;">“${m.innerThoughts.replace(/\n/g, '<br>')}”</div>
                                                                </div>
                                                            `;
                                                        }

                                                        // Post Game Reflection
                                                        if (m.postGameReflection || m.thoughts) {
                                                            const reflectionText = m.postGameReflection || m.thoughts;
                                                            matchDetailContent += `
                                                                <div style="background: #111; border-radius: 20px; padding: 16px; margin-bottom: 16px;">
                                                                    <div style="font-weight: 700; color: #fff; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;"><i class="fas fa-clipboard-list" style="color: #fff;"></i> 局后复盘</div>
                                                                    <div style="color: #ccc; line-height: 1.6; font-size: 14px;">${reflectionText.replace(/\n/g, '<br>')}</div>
                                                                </div>
                                                            `;
                                                        }

                                                        if (!matchDetailContent) matchDetailContent = '暂无详情数据';
                                                        
                                                        // Show secondary modal
                                                        window.lovesApp.showDetailModal('单局详情', matchDetailContent);
                                                    } catch (e) {
                                                        console.error('Parse match data error', e);
                                                    }
                                                }
                                            });
                                        });
                                    }, 100);
                                });
                            });
                        } catch(err) {
                            console.error('Game bind error', err);
                        }
                    }, 50);
                } else if (gameContent) {
                    gameContent.innerHTML = '<div style="padding: 50px 20px; text-align: center; color: #8e8e93; font-size: 15px;">暂无游戏数据<br><span style="font-size: 13px; margin-top: 8px; display: inline-block;">请在设置中生成</span></div>';
                }
            };
        }
        const gameBackBtn = document.getElementById('friend-game-back-btn');
        if (gameBackBtn) gameBackBtn.onclick = () => { if (window.closeView) window.closeView(gameView); };
        
        // iMessage Tab 切换
        const tabChat = document.getElementById('friend-imsg-tabbar-chat');
        const tabMe = document.getElementById('friend-imsg-tabbar-me');
        const panelChat = document.getElementById('friend-imsg-panel-chat');
        const panelMe = document.getElementById('friend-imsg-panel-me');
        const titleEl = document.getElementById('friend-imsg-title');
        
        if (tabChat) tabChat.onclick = () => {
            tabChat.style.color = '#007aff';
            if (tabMe) tabMe.style.color = '#8e8e93';
            if (panelChat) panelChat.style.display = 'flex';
            if (panelMe) panelMe.style.display = 'none';
            if (titleEl) titleEl.textContent = '信息';
        };
        if (tabMe) tabMe.onclick = () => {
            tabMe.style.color = '#007aff';
            if (tabChat) tabChat.style.color = '#8e8e93';
            if (panelMe) panelMe.style.display = 'flex';
            if (panelChat) panelChat.style.display = 'none';
            if (titleEl) titleEl.textContent = '我';
        };
        
        // 反向聊天室
        const revChatView = document.getElementById('friend-reverse-chat-view');
        // 将点击事件代理在外部方法中执行
        
        const revBackBtn = document.getElementById('reverse-chat-back-btn');
        if (revBackBtn) revBackBtn.onclick = () => { if (window.closeView) window.closeView(revChatView); };

    },
    
    showContactDetailModal: function(contactData) {
        try {
            const oldModals = document.querySelectorAll('#loves-contact-detail-modal');
            oldModals.forEach(m => m.remove());

            const modal = document.createElement('div');
            modal.id = 'loves-contact-detail-modal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
            modal.style.zIndex = '2147483647'; 
            modal.style.display = 'flex';
            modal.style.flexDirection = 'column';
            modal.style.justifyContent = 'flex-end';

            const card = document.createElement('div');
            card.style.backgroundColor = '#f2f2f7';
            card.style.borderTopLeftRadius = '24px';
            card.style.borderTopRightRadius = '24px';
            card.style.width = '100%';
            card.style.maxHeight = '85%';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.pointerEvents = 'auto'; 
            card.style.boxShadow = '0 -4px 20px rgba(0,0,0,0.1)';

            const handle = document.createElement('div');
            handle.style.width = '36px';
            handle.style.height = '5px';
            handle.style.backgroundColor = '#ccc';
            handle.style.borderRadius = '3px';
            handle.style.margin = '10px auto 15px';

            const contentWrap = document.createElement('div');
            contentWrap.style.flex = '1';
            contentWrap.style.overflowY = 'auto';
            contentWrap.style.padding = '0 20px 20px';

            // Top Header: Avatar & Name
            const headerHtml = `
                <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 25px;">
                    <div style="width: 80px; height: 80px; border-radius: 50%; background: #e5e5ea; display: flex; justify-content: center; align-items: center; color: #8e8e93; font-size: 34px; margin-bottom: 10px; ">
                        <i class="fas fa-user"></i>
                    </div>
                    <div style="font-size: 24px; font-weight: 600; color: #111;">${contactData.name}</div>
                </div>
            `;

            // Action Buttons Row
            const actionsHtml = `
                <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 25px;">
                    <div style="flex: 1; background: #fff; padding: 12px 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; color: #007aff;">
                        <i class="fas fa-comment" style="font-size: 20px;"></i>
                        <span style="font-size: 11px; font-weight: 500;">信息</span>
                    </div>
                    <div style="flex: 1; background: #fff; padding: 12px 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; color: #007aff;">
                        <i class="fas fa-phone-alt" style="font-size: 20px;"></i>
                        <span style="font-size: 11px; font-weight: 500;">电话</span>
                    </div>
                    <div style="flex: 1; background: #fff; padding: 12px 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; color: #007aff;">
                        <i class="fas fa-video" style="font-size: 20px;"></i>
                        <span style="font-size: 11px; font-weight: 500;">视频</span>
                    </div>
                    <div style="flex: 1; background: #fff; padding: 12px 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; color: #007aff;">
                        <i class="fas fa-envelope" style="font-size: 20px;"></i>
                        <span style="font-size: 11px; font-weight: 500;">邮件</span>
                    </div>
                </div>
            `;

            // Contact Info Details
            const infoHtml = `
                <div style="background: #fff; border-radius: 16px; padding: 16px; margin-bottom: 15px; display: flex; flex-direction: column; gap: 15px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="font-size: 13px; color: #8e8e93;">添加为联系人日期</div>
                        <div style="font-size: 15px; font-weight: 500; color: #111;">${contactData.addedTime || '未知时间'}</div>
                    </div>
                    <div style="height: 1px; background: #f2f2f7;"></div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="font-size: 13px; color: #8e8e93;">近期通话时间</div>
                        <div style="font-size: 15px; font-weight: 500; color: #111;">${contactData.recentCallTime || '无记录'}</div>
                    </div>
                </div>
            `;

            // Reason Card
            const reasonHtml = `
                <div style="background: #fff; border-radius: 16px; padding: 16px;">
                    <div style="font-size: 13px; color: #8e8e93; margin-bottom: 8px;">通话原因</div>
                    <div style="font-size: 15px; color: #333; line-height: 1.5; word-break: break-word;">
                        ${contactData.callReason || '暂无说明'}
                    </div>
                </div>
            `;

            contentWrap.innerHTML = headerHtml + actionsHtml + infoHtml + reasonHtml;

            card.appendChild(handle);
            card.appendChild(contentWrap);
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.opacity = '0';
                    card.style.transform = 'translateY(100%)';
                    setTimeout(() => modal.remove(), 250);
                }
            });

            modal.style.opacity = '0';
            modal.style.transition = 'opacity 0.25s ease';
            card.style.transform = 'translateY(100%)';
            card.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)';
            
            modal.appendChild(card);
            document.body.appendChild(modal);

            void modal.offsetWidth;
            modal.style.opacity = '1';
            card.style.transform = 'translateY(0)';

        } catch (e) {
            console.error('Error showing contact detail modal:', e);
        }
    },

    showCallDetailModal: function(callData) {
        try {
            const oldModals = document.querySelectorAll('#loves-call-detail-modal');
            oldModals.forEach(m => m.remove());

            const modal = document.createElement('div');
            modal.id = 'loves-call-detail-modal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
            modal.style.zIndex = '2147483647'; 
            modal.style.display = 'flex';
            modal.style.flexDirection = 'column';
            modal.style.justifyContent = 'flex-end';
            
            // Format data
            let typeText = '语音通话';
            let typeColor = '#8e8e93';
            if (callData.type === 'missed') {
                typeText = '未接来电';
                typeColor = '#ff3b30';
            } else if (callData.type === 'outgoing') {
                typeText = '呼出通话';
            } else {
                typeText = '呼入通话';
            }

            const dialogue = callData.dialogue || '无对话记录';

            const card = document.createElement('div');
            card.style.backgroundColor = '#f2f2f7';
            card.style.borderTopLeftRadius = '24px';
            card.style.borderTopRightRadius = '24px';
            card.style.width = '100%';
            card.style.maxHeight = '85%';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.pointerEvents = 'auto'; 
            card.style.boxShadow = '0 -4px 20px rgba(0,0,0,0.1)';

            const handle = document.createElement('div');
            handle.style.width = '36px';
            handle.style.height = '5px';
            handle.style.backgroundColor = '#ccc';
            handle.style.borderRadius = '3px';
            handle.style.margin = '10px auto 15px';

            const contentWrap = document.createElement('div');
            contentWrap.style.flex = '1';
            contentWrap.style.overflowY = 'auto';
            contentWrap.style.padding = '0 20px 20px';

            // Top Header: Avatar & Name
            const headerHtml = `
                <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 25px;">
                    <div style="width: 80px; height: 80px; border-radius: 50%; background: #e5e5ea; display: flex; justify-content: center; align-items: center; color: #8e8e93; font-size: 34px; margin-bottom: 10px; ">
                        <i class="fas fa-user"></i>
                    </div>
                    <div style="font-size: 24px; font-weight: 600; color: #111;">${callData.name}</div>
                </div>
            `;

            // Action Buttons Row
            const actionsHtml = `
                <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 25px;">
                    <div style="flex: 1; background: #fff; padding: 12px 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; color: #007aff;">
                        <i class="fas fa-comment" style="font-size: 20px;"></i>
                        <span style="font-size: 11px; font-weight: 500;">信息</span>
                    </div>
                    <div style="flex: 1; background: #fff; padding: 12px 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; color: #007aff;">
                        <i class="fas fa-phone-alt" style="font-size: 20px;"></i>
                        <span style="font-size: 11px; font-weight: 500;">电话</span>
                    </div>
                    <div style="flex: 1; background: #fff; padding: 12px 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; color: #007aff;">
                        <i class="fas fa-video" style="font-size: 20px;"></i>
                        <span style="font-size: 11px; font-weight: 500;">视频</span>
                    </div>
                    <div style="flex: 1; background: #fff; padding: 12px 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; color: #007aff;">
                        <i class="fas fa-envelope" style="font-size: 20px;"></i>
                        <span style="font-size: 11px; font-weight: 500;">邮件</span>
                    </div>
                </div>
            `;

            // Call Details Card
            const detailsHtml = `
                <div style="background: #fff; border-radius: 16px; padding: 16px; margin-bottom: 15px;">
                    <div style="font-size: 15px; font-weight: 600; color: #111; margin-bottom: 8px;">${callData.time}</div>
                    <div style="font-size: 14px; color: ${typeColor};">${typeText}</div>
                </div>
            `;

            // Dialogue Translation Card
            const dialogueHtml = `
                <div style="background: #fff; border-radius: 16px; padding: 16px;">
                    <div style="font-size: 13px; font-weight: 600; color: #8e8e93; margin-bottom: 12px; text-transform: uppercase;">录音转写记录</div>
                    <div style="font-size: 15px; color: #333; line-height: 1.6; word-break: break-word;">
                        ${dialogue.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;

            contentWrap.innerHTML = headerHtml + actionsHtml + detailsHtml + dialogueHtml;

            card.appendChild(handle);
            card.appendChild(contentWrap);
            
            // Add click-to-close behavior
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.opacity = '0';
                    card.style.transform = 'translateY(100%)';
                    setTimeout(() => modal.remove(), 250);
                }
            });

            // Entry animation
            modal.style.opacity = '0';
            modal.style.transition = 'opacity 0.25s ease';
            card.style.transform = 'translateY(100%)';
            card.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)';
            
            modal.appendChild(card);
            document.body.appendChild(modal);

            // Trigger reflow to start animation
            void modal.offsetWidth;
            modal.style.opacity = '1';
            card.style.transform = 'translateY(0)';

        } catch (e) {
            console.error('Error showing call detail modal:', e);
        }
    },

    showDetailModal: function(title, content) {
        try {
            // 清理旧的
            const oldModals = document.querySelectorAll('#loves-detail-modal');
            oldModals.forEach(m => m.remove());

            const modal = document.createElement('div');
            modal.id = 'loves-detail-modal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            modal.style.zIndex = '2147483647'; 
            modal.style.display = 'flex';
            modal.style.justifyContent = 'center';
            modal.style.alignItems = 'center';
            
            const card = document.createElement('div');
            card.style.backgroundColor = '#fff';
            card.style.borderRadius = '16px';
            card.style.width = '80%';
            card.style.maxWidth = '300px';
            card.style.padding = '20px';
            card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            card.style.position = 'relative';
            card.style.maxHeight = '80%';
            card.style.overflowY = 'auto';
            card.style.pointerEvents = 'auto'; 
            
            const closeBtn = document.createElement('i');
            closeBtn.className = 'fas fa-times';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '15px';
            closeBtn.style.right = '15px';
            closeBtn.style.fontSize = '20px';
            closeBtn.style.color = '#8e8e93';
            closeBtn.style.cursor = 'pointer';
            closeBtn.onclick = (e) => { 
                e.stopPropagation();
                modal.remove(); 
            };
            
            const titleEl = document.createElement('div');
            titleEl.id = 'loves-detail-modal-title';
            titleEl.style.fontSize = '20px';
            titleEl.style.fontWeight = '800';
            titleEl.style.color = '#111';
            titleEl.style.marginBottom = '18px';
            titleEl.style.paddingRight = '20px';
            titleEl.innerText = title;
            
            const contentEl = document.createElement('div');
            contentEl.id = 'loves-detail-modal-content';
            contentEl.style.fontSize = '15px';
            contentEl.style.color = '#333';
            contentEl.style.lineHeight = '1.6';
            contentEl.innerHTML = content;
            
            card.appendChild(closeBtn);
            card.appendChild(titleEl);
            card.appendChild(contentEl);
            modal.appendChild(card);
            
            // 点击背景关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
            
            document.body.appendChild(modal);
        } catch (e) {
            console.error('Error showing detail modal:', e);
        }
    },

    showBrowserDetailModal: function(title, content, isDark = false) {
        try {
            // 清理旧的
            const oldModals = document.querySelectorAll('#loves-browser-detail-modal');
            oldModals.forEach(m => m.remove());

            const modal = document.createElement('div');
            modal.id = 'loves-browser-detail-modal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            modal.style.zIndex = '2147483647'; 
            modal.style.display = 'flex';
            modal.style.flexDirection = 'column';
            modal.style.justifyContent = 'flex-end'; // 从底部升起
            
            const bgOuterColor = isDark ? '#000' : '#f4f4f5';
            const bgInnerColor = isDark ? '#1c1c1e' : '#fff';
            const textMainColor = isDark ? '#fff' : '#111';
            const textSubColor = isDark ? '#ccc' : '#333';
            const borderColor = isDark ? 'transparent' : 'rgba(0,0,0,0.05)';
            
            const card = document.createElement('div');
            card.style.backgroundColor = bgOuterColor;
            card.style.borderTopLeftRadius = '24px'; 
            card.style.borderTopRightRadius = '24px';
            card.style.width = '100%';
            card.style.height = '92%'; // 占据大部分屏幕
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.pointerEvents = 'auto'; 
            card.style.boxShadow = '0 -4px 24px rgba(0,0,0,0.1)';
            
            // 极简黑白灰 Safari 风格的顶部导航栏
            const header = document.createElement('div');
            header.style.height = '54px';
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.style.justifyContent = 'space-between';
            header.style.padding = '0 20px';
            header.style.backgroundColor = bgOuterColor;
            header.style.borderBottom = '1px solid ' + borderColor;
            header.style.borderTopLeftRadius = '24px';
            header.style.borderTopRightRadius = '24px';
            header.style.flexShrink = '0';

            const doneBtn = document.createElement('div');
            doneBtn.innerText = '完成';
            doneBtn.style.color = textMainColor; 
            doneBtn.style.fontSize = '16px';
            doneBtn.style.fontWeight = '600';
            doneBtn.style.cursor = 'pointer';
            doneBtn.onclick = () => {
                modal.style.opacity = '0';
                card.style.transform = 'translateY(100%)';
                setTimeout(() => modal.remove(), 250);
            };

            const headerDomain = document.createElement('div');
            headerDomain.style.display = 'flex';
            headerDomain.style.alignItems = 'center';
            headerDomain.style.justifyContent = 'center';
            headerDomain.style.gap = '6px';
            headerDomain.style.fontSize = '13px';
            headerDomain.style.fontWeight = '500';
            headerDomain.style.color = '#8e8e93';
            headerDomain.style.flex = '1';
            headerDomain.innerHTML = '<i class="fas fa-lock" style="font-size: 10px;"></i> search.com';

            const shareBtn = document.createElement('div');
            shareBtn.innerHTML = '<i class="fas fa-share-square"></i>';
            shareBtn.style.color = textMainColor;
            shareBtn.style.fontSize = '20px';

            header.appendChild(doneBtn);
            header.appendChild(headerDomain);
            header.appendChild(shareBtn);

            // 内容包裹区
            const contentWrap = document.createElement('div');
            contentWrap.style.flex = '1';
            contentWrap.style.overflowY = 'auto';
            contentWrap.style.padding = '0';
            contentWrap.style.backgroundColor = bgOuterColor;

            const pagePaper = document.createElement('div');
            pagePaper.style.backgroundColor = bgInnerColor;
            pagePaper.style.margin = '20px'; // 四周留白
            pagePaper.style.borderRadius = '24px'; // 大圆角
            pagePaper.style.padding = '30px 24px';
            pagePaper.style.boxShadow = isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.03)';
            
            const titleEl = document.createElement('h1');
            titleEl.style.fontSize = '24px'; 
            titleEl.style.fontWeight = '800';
            titleEl.style.color = textMainColor;
            titleEl.style.marginBottom = '24px';
            titleEl.style.lineHeight = '1.4';
            titleEl.style.letterSpacing = '-0.5px';
            titleEl.innerText = title;
            
            const textEl = document.createElement('div');
            textEl.style.fontSize = '16px';
            textEl.style.color = textSubColor;
            textEl.style.lineHeight = '1.8';
            textEl.style.wordBreak = 'break-word';
            // Decode component if it was passed safely encoded
            textEl.innerHTML = decodeURIComponent(content);
            
            pagePaper.appendChild(titleEl);
            pagePaper.appendChild(textEl);
            contentWrap.appendChild(pagePaper);

            card.appendChild(header);
            card.appendChild(contentWrap);
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.opacity = '0';
                    card.style.transform = 'translateY(100%)';
                    setTimeout(() => modal.remove(), 250);
                }
            });

            // Entry animation
            modal.style.opacity = '0';
            modal.style.transition = 'opacity 0.25s ease';
            card.style.transform = 'translateY(100%)';
            card.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)';

            modal.appendChild(card);
            document.body.appendChild(modal);

            // Trigger reflow to start animation
            void modal.offsetWidth;
            modal.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        } catch (e) {
            console.error('Error showing browser detail modal:', e);
        }
    },

    switchImsgAccount: function(accType, hasData) {
        if (!hasData) return;
        this.currentImsgAccount = accType;
        
        const accountModal = document.getElementById('friend-imsg-account-modal');
        if (window.closeView && accountModal) window.closeView(accountModal);

        if (this.currentFriend) {
            this.renderFriendImsg(this.currentFriend);
        }
    },

    renderFriendImsg: function(friend) {
        const imsgList = document.getElementById('friend-imsg-panel-chat');
        const meNameEl = document.getElementById('friend-imsg-me-name');
        const meImg = document.getElementById('friend-imsg-me-avatar');
        const meIcon = document.getElementById('friend-imsg-me-icon');

        if (!imsgList) return;

        let isMain = this.currentImsgAccount === 'main';
        
        let mainChats = [];
        let altChats = [];
        let altName = '小号';
        let userRemark = window.imData?.profile?.name || '我'; // 默认备注为用户自身名字
        
        if (friend.imessageData) {
            if (Array.isArray(friend.imessageData)) {
                mainChats = friend.imessageData;
            } else {
                mainChats = friend.imessageData.mainAccount?.chats || [];
                altChats = friend.imessageData.altAccount?.chats || [];
                altName = friend.imessageData.altAccount?.name || '小号';
                if (friend.imessageData.mainAccount?.userRemark) {
                    userRemark = friend.imessageData.mainAccount.userRemark;
                }
            }
        }

        if (isMain) {
            if (meNameEl) meNameEl.textContent = friend.nickname || friend.realname || 'TA';
            if (friend.avatarUrl) {
                if (meImg) { meImg.src = friend.avatarUrl; meImg.style.display = 'block'; }
                if (meIcon) meIcon.style.display = 'none';
            } else {
                if (meImg) meImg.style.display = 'none';
                if (meIcon) { meIcon.style.display = 'block'; meIcon.className = 'fas fa-user'; }
            }
        } else {
            if (meNameEl) meNameEl.textContent = altName;
            if (meImg) meImg.style.display = 'none';
            if (meIcon) {
                meIcon.style.display = 'block';
                meIcon.className = 'fas fa-user-secret';
            }
        }

        // 清空列表
        imsgList.innerHTML = '';
        
        // 渲染与 user 的固定聊天室（仅主账号展示）
        if (isMain) {
            const userAvatarUrl = window.userState?.avatarUrl || window.imData?.profile?.avatarUrl;
            const msgs = window.imData?.messages?.[friend.id] || [];
            const latestMsg = msgs.length > 0 ? msgs[msgs.length - 1].text : '...';

            const userChatHTML = `
            <div id="friend-imsg-chat-with-user-item-dynamic" style="display: flex; align-items: center; padding: 16px; border-radius: 20px; background: #f8f8fa; border: 1px solid #f0f0f0;  cursor: pointer;">
                <div style="width: 50px; height: 50px; border-radius: 50%; background: #f0f0f0; display: flex; justify-content: center; align-items: center; margin-right: 15px; flex-shrink: 0; overflow: hidden; position: relative;">
                    ${userAvatarUrl ? `<img src="${userAvatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="fas fa-user" style="color: #8e8e93; font-size: 24px;"></i>`}
                    <div style="position: absolute; bottom: 0; right: 0; width: 14px; height: 14px; border-radius: 50%; background: #34c759; border: 2px solid #fff;"></div>
                </div>
                <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 17px; font-weight: 600; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 8px;">
                            ${userRemark}
                            <div style="background: rgba(142,142,147,0.15); color: #8e8e93; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 6px; display: flex; align-items: center; gap: 3px;">
                                <i class="fas fa-thumbtack"></i> 置顶
                            </div>
                        </div>
                        <div style="font-size: 13px; color: #007aff; font-weight: 500;">刚刚</div>
                    </div>
                    <div style="font-size: 15px; color: #8e8e93; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${latestMsg}
                    </div>
                </div>
            </div>`;

            const userChatWrapper = document.createElement('div');
            userChatWrapper.innerHTML = userChatHTML;
            const userChatEl = userChatWrapper.firstElementChild;
            
            userChatEl.onclick = () => {
                const revChatView = document.getElementById('friend-reverse-chat-view');
                if (revChatView) {
                    if (window.openView) window.openView(revChatView);
                    document.getElementById('reverse-chat-user-name').textContent = userRemark;
                    const revAvatarImg = document.getElementById('reverse-chat-user-avatar');
                    const revAvatarIcon = document.getElementById('reverse-chat-user-icon');
                    if (userAvatarUrl) {
                        if (revAvatarImg) { revAvatarImg.src = userAvatarUrl; revAvatarImg.style.display = 'block'; }
                        if (revAvatarIcon) revAvatarIcon.style.display = 'none';
                    } else {
                        if (revAvatarImg) revAvatarImg.style.display = 'none';
                        if (revAvatarIcon) revAvatarIcon.style.display = 'block';
                    }
                    
                    const msgContainer = document.getElementById('reverse-chat-messages');
                    if (msgContainer) {
                        msgContainer.innerHTML = '<div style="text-align: center; color: #8e8e93; font-size: 12px; margin-bottom: 20px;">此时以 TA 的视角查看你们的聊天记录</div>';
                        const realMsgs = window.imData?.messages?.[friend.id] || [];
                        const last10Msgs = realMsgs.slice(-10); // 只取最近 10 条真实记录
                        last10Msgs.forEach(m => {
                            const div = document.createElement('div');
                            // 在对方视角，m.sender === 'me' 是对方收到的，所以在左边
                            if (m.sender === 'me') {
                                div.className = 'reverse-bubble-left';
                            } else {
                                div.className = 'reverse-bubble-right';
                            }
                            div.textContent = m.text || '[特殊消息]';
                            msgContainer.appendChild(div);
                        });
                        setTimeout(() => msgContainer.scrollTop = msgContainer.scrollHeight, 50);
                    }
                }
            };
            imsgList.appendChild(userChatEl);
        }

        const currentChats = isMain ? mainChats : altChats;

        const extraChatsHTML = currentChats.map((chat, idx) => {
            const lastMsgObj = chat.messages && chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null;
            const lastMsgText = lastMsgObj ? lastMsgObj.text : '...';
            
            let avatarHtml = '<i class="fas fa-user" style="color: #8e8e93; font-size: 24px;"></i>';
            if (chat.contactName === '文件传输助手') avatarHtml = '<i class="fas fa-folder" style="color: #111; font-size: 20px;"></i>';
            else if (chat.contactName === '备忘录') avatarHtml = '<i class="fas fa-sticky-note" style="color: #111; font-size: 20px;"></i>';

            return `
            <div class="lovers-friend-imsg-item" data-idx="${idx}" style="display: flex; align-items: center; padding: 16px; border-radius: 20px; background: #fff;  cursor: pointer;" onclick="window.lovesApp.openGeneratedChat('${isMain ? 'main' : 'alt'}', ${idx}, '${encodeURIComponent(JSON.stringify(chat))}')">
                <div style="width: 50px; height: 50px; border-radius: 50%; background: #f0f0f0; display: flex; justify-content: center; align-items: center; margin-right: 15px; flex-shrink: 0;">
                    ${avatarHtml}
                </div>
                <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 17px; font-weight: 600; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${chat.contactName || '未知联系人'}</div>
                        <div style="font-size: 13px; color: #8e8e93;">昨天</div>
                    </div>
                    <div style="font-size: 15px; color: #8e8e93; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${lastMsgText}</div>
                </div>
            </div>`;
        }).join('');
        
        if (extraChatsHTML) {
            const extraDiv = document.createElement('div');
            extraDiv.innerHTML = extraChatsHTML;
            while(extraDiv.firstChild) {
                imsgList.appendChild(extraDiv.firstChild);
            }
        } else if (!isMain) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = 'padding: 50px 20px; text-align: center; color: #8e8e93; font-size: 15px;';
            emptyMsg.innerHTML = '暂无短信记录<br><span style="font-size: 13px; margin-top: 8px; display: inline-block;">请在设置中生成</span>';
            imsgList.appendChild(emptyMsg);
        }

        setTimeout(() => {
            const imsgItems = imsgList.querySelectorAll('.lovers-friend-imsg-item');
            imsgItems.forEach(el => {
                window.lovesApp.bindLongPress(el, function() {
                    const idx = el.getAttribute('data-idx');
                    const chat = currentChats[idx];
                    window.lovesApp.showDeleteConfirm(chat.contactName, () => {
                        currentChats.splice(idx, 1);
                        window.lovesApp.renderFriendImsg(friend);
                    });
                });
            });
        }, 50);
    },

    openGeneratedChat: function(accType, idx, chatDataStr) {
        try {
            const chat = JSON.parse(decodeURIComponent(chatDataStr));
            const revChatView = document.getElementById('friend-reverse-chat-view');
            if (revChatView) {
                if (window.openView) window.openView(revChatView);
                document.getElementById('reverse-chat-user-name').textContent = chat.contactName || '联系人';
                
                const revAvatarImg = document.getElementById('reverse-chat-user-avatar');
                const revAvatarIcon = document.getElementById('reverse-chat-user-icon');
                if (revAvatarImg) revAvatarImg.style.display = 'none';
                if (revAvatarIcon) revAvatarIcon.style.display = 'block';
                
                const msgContainer = document.getElementById('reverse-chat-messages');
                if (msgContainer) {
                    msgContainer.innerHTML = `<div style="text-align: center; color: #8e8e93; font-size: 12px; margin-bottom: 20px; font-weight: 500;">昨天 14:20</div>`;
                    const msgs = chat.messages || [];
                    msgs.forEach(m => {
                        const div = document.createElement('div');
                        // 角色(char)是"我"，them是对方
                        if (m.sender === 'them') {
                            div.className = 'reverse-bubble-left';
                            div.style.background = '#fff';
                            div.style.color = '#111';
                            div.style.boxShadow = '0 2px 10px rgba(0,0,0,0.03)';
                        } else {
                            div.className = 'reverse-bubble-right';
                            div.style.background = '#111';
                            div.style.color = '#fff';
                            div.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
                        }
                        div.textContent = m.text || '[特殊消息]';
                        msgContainer.appendChild(div);
                    });
                    setTimeout(() => msgContainer.scrollTop = msgContainer.scrollHeight, 50);
                }
            }
        } catch(e) {
            console.error('Parse chat error', e);
        }
    },

    close: function() {
        if (this.view) {
            window.closeView(this.view);
            const detailArea = document.getElementById('loves-detail-area');
            if (detailArea) detailArea.style.display = 'none';
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化以确保 DOM 完全加载
    setTimeout(() => {
        if (window.lovesApp) {
            window.lovesApp.init();
        }
    }, 100);
});
