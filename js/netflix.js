/**
 * Netflix App Logic
 */

class NetflixApp {
    constructor() {
        this.view = document.getElementById('netflix-view');
        this.header = document.getElementById('netflix-header');
        this.content = document.getElementById('netflix-content');
        this.headerAvatar = this.view ? this.view.querySelector('.netflix-avatar') : null;
        this.navItems = [];
        this.tabPanels = [];
        this.navIndicator = null;
        this.editAvatarDataUrl = '';
        this.presetState = this.loadPresetState();
        this.presetDraft = null;
        this.activePlaybackPresetEditorKey = null;
        this.playbackPresetDraft = null;
        this.createDraft = this.createDefaultWorkDraft();
        this.netflixState = this.loadNetflixState();
        this.availableActors = [];
        this.dragState = null;
        this.longPressTimer = null;
        this.activeWorkId = null;
        this.activeEpisodeNumber = 1;
        this.activeDetailWorkId = null;
        this.activeDetailEpisodeNumber = 1;
        this.activeDetailCatalogOnly = false;
        this.activePlaybackId = null;
        this.activePlaybackEpisodeNumber = 1;
        this.editingMessageId = null;
        this.editingWorkId = null;
        this.isHomeSearchLoading = false;
        this.isPlaybackNextLoading = false;
        this.isOpen = false;

        if (this.view) {
            this.init();
        }
    }

    init() {
        this.renderStructure();
        this.cacheElements();
        this.bindEvents();
        this.applyCustomCss();
        this.renderUserProfile();
    }

    renderStructure() {
        if (!this.content || !this.view) return;

        this.content.innerHTML = `
            <div class="netflix-tab-panel active" data-panel="home">
                <div id="netflix-home-content"></div>
            </div>

            <div class="netflix-tab-panel netflix-create-panel" data-panel="create">
                <div class="netflix-create-hub">
                    <button type="button" class="netflix-create-new-btn" id="netflix-create-new-trigger">
                        <i class="fas fa-video"></i>
                        <span>新影片</span>
                    </button>
                    <h3>我的作品</h3>
                    <div class="netflix-create-works-list" id="netflix-create-works-list">
                        <!-- 作品列表将在这里渲染 -->
                    </div>
                </div>
            </div>

            <div class="netflix-tab-panel netflix-profile-panel" data-panel="profile">
                <div class="netflix-profile-avatar" id="netflix-profile-avatar"><i class="fas fa-user"></i></div>
                <h2 id="netflix-profile-name">User</h2>
                <div class="netflix-profile-stats">
                    <div><strong id="netflix-profile-followers">0</strong><span>粉丝</span></div>
                    <div><strong id="netflix-profile-subs">0</strong><span>订阅</span></div>
                </div>
                <div class="netflix-profile-list">
                    <div id="netflix-world-book-entry"><i class="fas fa-clock"></i><span>世界书</span></div>
                    <div id="netflix-settings-entry"><i class="fas fa-cog"></i><span>设置</span></div>
                </div>
                <div class="netflix-acting-section">
                    <h2>参演影片</h2>
                    <div class="netflix-acting-list" id="netflix-acting-list"></div>
                </div>
            </div>
        `;

        const nav = this.view.querySelector('.netflix-bottom-nav');
        if (nav) {
            nav.innerHTML = `
                <div class="netflix-nav-indicator"></div>
                <div class="netflix-nav-item active" data-tab="home">
                    <i class="fas fa-home"></i>
                    <span>首页</span>
                </div>
                <div class="netflix-nav-item" data-tab="create">
                    <i class="fas fa-plus"></i>
                    <span>创作</span>
                </div>
                <div class="netflix-nav-item" data-tab="profile">
                    <div class="netflix-nav-avatar"><i class="fas fa-user"></i></div>
                    <span>我的 Netflix</span>
                </div>
            `;
        }

        if (!this.view.querySelector('#netflix-profile-sheet')) {
            this.view.insertAdjacentHTML('beforeend', `
                <div class="netflix-profile-sheet" id="netflix-profile-sheet">
                    <div class="netflix-profile-sheet-card">
                        <div class="netflix-sheet-handle"></div>
                        <div class="netflix-sheet-title">编辑资料</div>
                        <div class="netflix-edit-avatar" id="netflix-edit-avatar-trigger">
                            <i class="fas fa-camera"></i>
                            <img id="netflix-edit-avatar-preview" src="" alt="">
                            <input type="file" id="netflix-edit-avatar-input" accept="image/*" style="display: none;">
                        </div>
                        <label class="netflix-edit-field">
                            <span>姓名</span>
                            <input type="text" id="netflix-edit-name-input" placeholder="输入姓名">
                        </label>
                        <label class="netflix-edit-field">
                            <span>人设</span>
                            <textarea id="netflix-edit-persona-input" placeholder="输入人设"></textarea>
                        </label>
                        <div class="netflix-edit-save" id="netflix-edit-save-btn">保存</div>
                    </div>
                </div>
            `);
        }

        if (!this.view.querySelector('#netflix-settings-sheet')) {
            this.view.insertAdjacentHTML('beforeend', `
                <div class="netflix-settings-sheet" id="netflix-settings-sheet">
                    <div class="netflix-settings-card">
                        <div class="netflix-sheet-handle"></div>
                        <div class="netflix-settings-title">CSS 设置</div>
                        <div class="netflix-settings-tab-content active" id="netflix-settings-tab-playback">
                            <label class="netflix-settings-upload">
                                <i class="fas fa-file-code"></i>
                                <span>上传播放界面 CSS</span>
                                <input type="file" id="netflix-settings-playback-css-file" accept=".css,text/css">
                            </label>
                            <label class="netflix-settings-field">
                                <span>播放界面 CSS</span>
                                <textarea id="netflix-settings-playback-css-input" placeholder="这里的 CSS 只会应用到播放界面。自动限定在 #netflix-playback-sheet 内。"></textarea>
                            </label>
                        </div>

                        <div class="netflix-settings-actions" style="grid-template-columns: 1fr 1fr;">
                            <button type="button" id="netflix-settings-clear">清空当前</button>
                            <button type="button" id="netflix-settings-apply">应用当前</button>
                        </div>
                    </div>
                </div>
            `);
        }

        if (!this.view.querySelector('#netflix-actor-picker-sheet')) {
            this.view.insertAdjacentHTML('beforeend', `
                <div class="netflix-actor-picker-sheet" id="netflix-actor-picker-sheet">
                    <div class="netflix-actor-picker-card">
                        <div class="netflix-sheet-handle"></div>
                        <div class="netflix-actor-picker-title">选择主演</div>
                        <div class="netflix-actor-picker-list" id="netflix-actor-picker-list"></div>
                        <button type="button" id="netflix-actor-picker-done-btn">完成</button>
                    </div>
                </div>
            `);
        }

        if (!this.view.querySelector('#netflix-work-detail-sheet')) {
            this.view.insertAdjacentHTML('beforeend', `
                <div class="netflix-work-detail-sheet" id="netflix-work-detail-sheet">
                    <div class="netflix-work-detail-card">
                        <div class="netflix-sheet-handle"></div>
                        <div class="netflix-work-detail-content" id="netflix-work-detail-content"></div>
                    </div>
                </div>
            `);
        }

        if (!this.view.querySelector('#netflix-create-form-sheet')) {
            this.view.insertAdjacentHTML('beforeend', `
                <div class="netflix-create-form-sheet" id="netflix-create-form-sheet">
                    <div class="netflix-create-form-close" id="netflix-create-form-close"><i class="fas fa-times"></i></div>
                    <div class="netflix-create-form-body">
                        <div class="netflix-create-form">
                            <div class="netflix-cover-upload" id="netflix-work-cover-trigger">
                                <input type="file" id="netflix-work-cover-input" accept="image/*" style="display: none;">
                                <img id="netflix-work-cover-preview" src="" alt="">
                                <div class="netflix-cover-placeholder">
                                    <i class="fas fa-image"></i>
                                    <span>封面</span>
                                </div>
                            </div>

                            <label class="netflix-create-field">
                                <span>作品名字</span>
                                <input type="text" id="netflix-work-title-input" placeholder="输入作品名字">
                            </label>

                            <div class="netflix-create-field">
                                <span>分类</span>
                                <div class="netflix-category-segment" id="netflix-work-category-segment">
                                    <button type="button" class="active" data-category="电视剧">电视剧</button>
                                    <button type="button" data-category="电影">电影</button>
                                    <button type="button" data-category="综艺">综艺</button>
                                    <button type="button" data-category="纪录片">纪录片</button>
                                </div>
                            </div>

                            <label class="netflix-create-field">
                                <span>标签</span>
                                <input type="text" id="netflix-work-tags-input" placeholder="输入标签，用空格或逗号分隔">
                            </label>
                            <div class="netflix-tag-preview" id="netflix-work-tag-preview"></div>

                            <div class="netflix-create-field">
                                <span>主演</span>
                                <div class="netflix-cast-list" id="netflix-work-cast-list">
                                    <button type="button" class="netflix-cast-add" id="netflix-work-cast-add-btn" aria-label="添加主演">
                                        <i class="fas fa-plus"></i>
                                    </button>
                                </div>
                            </div>

                            <label class="netflix-create-field">
                                <span>作品简介</span>
                                <textarea id="netflix-work-summary-input" placeholder="输入作品简介"></textarea>
                            </label>

                            <button type="button" class="netflix-create-submit" id="netflix-work-start-btn">开始创作</button>
                            <button type="button" class="netflix-create-submit" id="netflix-work-delete-btn" style="display: none; background: #e50914; color: white; margin-top: 10px;">删除影片</button>
                        </div>
                    </div>
                </div>
            `);
        }

        if (!this.view.querySelector('#netflix-world-book-sheet')) {
            this.view.insertAdjacentHTML('beforeend', `
                <div class="netflix-world-book-sheet" id="netflix-world-book-sheet">
                    <div class="netflix-world-book-card">
                        <div class="netflix-sheet-handle"></div>
                        <div class="netflix-world-book-header">
                            <div></div>
                            <div class="netflix-world-book-title">世界书</div>
                            <button type="button" id="netflix-world-book-close" class="netflix-world-book-close"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="netflix-world-book-list" id="netflix-world-book-list"></div>
                        <button type="button" class="netflix-world-book-save" id="netflix-world-book-save">保存挂载</button>
                    </div>
                </div>
            `);
        }

        if (!this.view.querySelector('#netflix-home-search-sheet')) {
            this.view.insertAdjacentHTML('beforeend', `
                <div class="netflix-home-search-sheet" id="netflix-home-search-sheet">
                    <div class="netflix-home-search-card">
                        <div class="netflix-sheet-handle"></div>
                        <div class="netflix-home-search-title">搜索 Netflix</div>
                        <label class="netflix-home-search-field">
                            <i class="fas fa-search"></i>
                            <input type="text" id="netflix-home-search-input" placeholder="输入想看的类型、人物或剧情">
                        </label>
                        <div class="netflix-home-search-hint">留空会随机生成一组首页影片。</div>
                        <div class="netflix-home-search-actions">
                            <button type="button" id="netflix-home-search-cancel">取消</button>
                            <button type="button" id="netflix-home-search-confirm">确认</button>
                        </div>
                    </div>
                </div>
            `);
        }

        if (!this.view.querySelector('#netflix-playback-sheet')) {
            this.view.insertAdjacentHTML('beforeend', `
                <div class="netflix-playback-sheet" id="netflix-playback-sheet">
                    <div class="netflix-playback-header">
                        <div class="netflix-playback-header-left">
                            <button type="button" class="netflix-playback-icon-btn" id="netflix-playback-close" aria-label="返回"><i class="fas fa-chevron-left"></i></button>
                            <button type="button" class="netflix-playback-icon-btn" id="netflix-playback-episode-btn" aria-label="选集"><i class="fas fa-list-ol"></i></button>
                        </div>
                        <div class="netflix-playback-title" id="netflix-playback-title">播放中</div>
                        <div class="netflix-playback-header-right">
                            <button type="button" class="netflix-playback-icon-btn" id="netflix-playback-cast-btn" aria-label="主演"><i class="fas fa-user-friends"></i></button>
                            <button type="button" class="netflix-playback-icon-btn" id="netflix-playback-preset-btn" aria-label="预设管理"><i class="fas fa-bars"></i></button>
                        </div>
                    </div>
                    <div class="netflix-playback-body" id="netflix-playback-body"></div>

                    <div class="netflix-record-episode-sidebar netflix-playback-episode-sidebar" id="netflix-playback-episode-sidebar">
                        <div class="netflix-rps-header">
                            <h3>选集</h3>
                            <div class="netflix-rps-close" id="netflix-playback-episode-close"><i class="fas fa-times"></i></div>
                        </div>
                        <div class="netflix-episode-list" id="netflix-playback-episode-list"></div>
                        <div class="netflix-playback-episode-actions" style="padding: 15px; display: flex; flex-direction: column; gap: 10px;">
                            <button type="button" class="netflix-playback-next-btn" id="netflix-playback-advance-btn" style="margin: 0; background: #2b2b2b;">推进本集</button>
                            <button type="button" class="netflix-playback-next-btn" id="netflix-playback-next-btn" style="margin: 0;">完成本集并开启下一集</button>
                        </div>
                    </div>

                    <div class="netflix-record-preset-sidebar netflix-playback-preset-sidebar" id="netflix-playback-preset-sidebar">
                        <div class="netflix-rps-header">
                            <h3>预设管理</h3>
                            <div class="netflix-rps-close" id="netflix-playback-preset-close"><i class="fas fa-times"></i></div>
                        </div>
                        <div class="netflix-rps-body" id="netflix-playback-preset-body"></div>
                    </div>

                    <div class="netflix-playback-cast-sheet" id="netflix-playback-cast-sheet">
                        <div class="netflix-playback-cast-card">
                            <div class="netflix-sheet-handle"></div>
                            <div class="netflix-playback-cast-title">本集主演</div>
                            <div class="netflix-playback-cast-list" id="netflix-playback-cast-list"></div>
                            <button type="button" class="netflix-playback-cast-add" id="netflix-playback-cast-add">添加主演</button>
                            <button type="button" class="netflix-playback-cast-done" id="netflix-playback-cast-done">完成</button>
                        </div>
                    </div>

                    <div class="netflix-playback-next-modal" id="netflix-playback-next-modal">
                        <div class="netflix-playback-next-card">
                            <button type="button" class="netflix-record-modal-close" id="netflix-playback-next-close"><i class="fas fa-times"></i></button>
                            <div class="netflix-record-modal-title">下一集</div>
                            <textarea id="netflix-playback-next-input" class="netflix-edit-message-input" placeholder="输入下一集剧情走向，可留空..."></textarea>
                            <button type="button" class="netflix-edit-message-save" id="netflix-playback-next-confirm">确定</button>
                        </div>
                    </div>
                </div>
            `);
        }
    }

    createHeroBanner(item = null, index = 0) {
        const work = item ? this.normalizeCatalogItem(item, `banner-${index}`, '电视剧') : null;
        const title = work?.title || '暂无影片';
        const tags = work ? [work.category, ...(work.tags || [])].filter(Boolean).slice(0, 3) : ['等待搜索', '随机生成', '首页横幅'];
        const coverUrl = work?.coverUrl || '';
        const background = coverUrl
            ? `background-image: url('${this.escapeAttr(coverUrl)}');`
            : `background: ${this.getCatalogFallbackGradient(index)};`;
        return `
            <div class="netflix-hero-banner ${work ? '' : 'netflix-hero-empty'}" ${work ? `data-catalog-id="${this.escapeHtml(work.id)}"` : ''}>
                <div class="netflix-hero-img-wrapper">
                    <div class="netflix-hero-placeholder" style="${background} width: 100%; height: 100%;"></div>
                    <div class="netflix-hero-fade"></div>
                </div>
                <div class="netflix-hero-info">
                    <h1 class="netflix-hero-title">${this.escapeHtml(title)}</h1>
                    <div class="netflix-tags">
                        ${tags.map(tag => `<span>${this.escapeHtml(tag)}</span>`).join('<em>·</em>')}
                    </div>
                    <div class="netflix-hero-actions">
                        <button type="button" class="netflix-btn netflix-btn-play" ${work ? '' : 'disabled'}>
                            <i class="fas fa-play"></i> 播放
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    cacheElements() {
        this.header = document.getElementById('netflix-header');
        this.content = document.getElementById('netflix-content');
        this.headerAvatar = this.view.querySelector('.netflix-avatar');
        this.headerSearchBtn = this.view.querySelector('.netflix-header-right .fa-search');
        this.homeContent = this.view.querySelector('#netflix-home-content');
        this.navItems = Array.from(this.view.querySelectorAll('.netflix-nav-item'));
        this.tabPanels = Array.from(this.view.querySelectorAll('.netflix-tab-panel'));
        this.navIndicator = this.view.querySelector('.netflix-nav-indicator');
        this.profileSheet = this.view.querySelector('#netflix-profile-sheet');
        this.worldBookEntry = this.view.querySelector('#netflix-world-book-entry');
        this.settingsEntry = this.view.querySelector('#netflix-settings-entry');
        this.settingsSheet = this.view.querySelector('#netflix-settings-sheet');
        this.settingsTabs = [];
        this.settingsTabContents = {
            playback: this.view.querySelector('#netflix-settings-tab-playback')
        };
        this.settingsPlaybackCssFile = this.view.querySelector('#netflix-settings-playback-css-file');
        this.settingsPlaybackCssInput = this.view.querySelector('#netflix-settings-playback-css-input');
        this.settingsApply = this.view.querySelector('#netflix-settings-apply');
        this.settingsClear = this.view.querySelector('#netflix-settings-clear');
        this.worldBookSheet = this.view.querySelector('#netflix-world-book-sheet');
        this.worldBookList = this.view.querySelector('#netflix-world-book-list');
        this.worldBookClose = this.view.querySelector('#netflix-world-book-close');
        this.worldBookSave = this.view.querySelector('#netflix-world-book-save');
        this.homeSearchSheet = this.view.querySelector('#netflix-home-search-sheet');
        this.homeSearchInput = this.view.querySelector('#netflix-home-search-input');
        this.homeSearchCancel = this.view.querySelector('#netflix-home-search-cancel');
        this.homeSearchConfirm = this.view.querySelector('#netflix-home-search-confirm');
        this.playbackSheet = this.view.querySelector('#netflix-playback-sheet');
        this.playbackClose = this.view.querySelector('#netflix-playback-close');
        this.playbackEpisodeBtn = this.view.querySelector('#netflix-playback-episode-btn');
        this.playbackTitle = this.view.querySelector('#netflix-playback-title');
        this.playbackCastBtn = this.view.querySelector('#netflix-playback-cast-btn');
        this.playbackPresetBtn = this.view.querySelector('#netflix-playback-preset-btn');
        this.playbackBody = this.view.querySelector('#netflix-playback-body');
        this.playbackEpisodeSidebar = this.view.querySelector('#netflix-playback-episode-sidebar');
        this.playbackEpisodeClose = this.view.querySelector('#netflix-playback-episode-close');
        this.playbackEpisodeList = this.view.querySelector('#netflix-playback-episode-list');
        this.playbackAdvanceBtn = this.view.querySelector('#netflix-playback-advance-btn');
        this.playbackNextBtn = this.view.querySelector('#netflix-playback-next-btn');
        this.playbackPresetSidebar = this.view.querySelector('#netflix-playback-preset-sidebar');
        this.playbackPresetClose = this.view.querySelector('#netflix-playback-preset-close');
        this.playbackPresetBody = this.view.querySelector('#netflix-playback-preset-body');
        this.playbackCastSheet = this.view.querySelector('#netflix-playback-cast-sheet');
        this.playbackCastList = this.view.querySelector('#netflix-playback-cast-list');
        this.playbackCastAdd = this.view.querySelector('#netflix-playback-cast-add');
        this.playbackCastDone = this.view.querySelector('#netflix-playback-cast-done');
        this.playbackNextModal = this.view.querySelector('#netflix-playback-next-modal');
        this.playbackNextClose = this.view.querySelector('#netflix-playback-next-close');
        this.playbackNextInput = this.view.querySelector('#netflix-playback-next-input');
        this.playbackNextConfirm = this.view.querySelector('#netflix-playback-next-confirm');
        
        this.createNewTrigger = this.view.querySelector('#netflix-create-new-trigger');
        this.createWorksList = this.view.querySelector('#netflix-create-works-list');
        this.createFormSheet = this.view.querySelector('#netflix-create-form-sheet');
        this.createFormClose = this.view.querySelector('#netflix-create-form-close');

        this.workCoverTrigger = this.view.querySelector('#netflix-work-cover-trigger');
        this.workCoverInput = this.view.querySelector('#netflix-work-cover-input');
        this.workCoverPreview = this.view.querySelector('#netflix-work-cover-preview');
        this.workTitleInput = this.view.querySelector('#netflix-work-title-input');
        this.workCategoryButtons = Array.from(this.view.querySelectorAll('#netflix-work-category-segment button'));
        this.workTagsInput = this.view.querySelector('#netflix-work-tags-input');
        this.workTagPreview = this.view.querySelector('#netflix-work-tag-preview');
        this.workCastList = this.view.querySelector('#netflix-work-cast-list');
        this.workCastAddBtn = this.view.querySelector('#netflix-work-cast-add-btn');
        this.workSummaryInput = this.view.querySelector('#netflix-work-summary-input');
        this.workStartBtn = this.view.querySelector('#netflix-work-start-btn');
        this.workDeleteBtn = this.view.querySelector('#netflix-work-delete-btn');
        this.actingList = this.view.querySelector('#netflix-acting-list');
        this.workDetailSheet = this.view.querySelector('#netflix-work-detail-sheet');
        this.workDetailContent = this.view.querySelector('#netflix-work-detail-content');
        this.actorPickerSheet = this.view.querySelector('#netflix-actor-picker-sheet');
        this.actorPickerList = this.view.querySelector('#netflix-actor-picker-list');
        this.actorPickerDoneBtn = this.view.querySelector('#netflix-actor-picker-done-btn');
        this.editAvatarTrigger = this.view.querySelector('#netflix-edit-avatar-trigger');
        this.editAvatarPreview = this.view.querySelector('#netflix-edit-avatar-preview');
        this.editAvatarInput = this.view.querySelector('#netflix-edit-avatar-input');
        this.editNameInput = this.view.querySelector('#netflix-edit-name-input');
        this.editPersonaInput = this.view.querySelector('#netflix-edit-persona-input');
        this.editSaveBtn = this.view.querySelector('#netflix-edit-save-btn');
    }

    bindEvents() {
        document.getElementById('app-netflix-btn')?.addEventListener('click', () => this.open());

        if (this.content && this.header) {
            this.content.addEventListener('scroll', () => {
                this.header.classList.toggle('scrolled', this.content.scrollTop > 50);
            });
        }

        this.navItems.forEach(item => {
            item.addEventListener('click', () => {
                this.switchTab(item.getAttribute('data-tab') || 'home');
            });
        });

        if (this.headerAvatar) {
            this.headerAvatar.addEventListener('click', () => this.openProfileSheet());
        }

        if (this.headerSearchBtn) {
            this.headerSearchBtn.addEventListener('click', () => this.openHomeSearchSheet());
        }

        if (this.homeSearchSheet) {
            this.homeSearchSheet.addEventListener('click', (event) => {
                if (event.target === this.homeSearchSheet && !this.isHomeSearchLoading) this.closeHomeSearchSheet();
            });
        }

        if (this.homeSearchCancel) {
            this.homeSearchCancel.addEventListener('click', () => this.closeHomeSearchSheet());
        }

        if (this.homeSearchConfirm) {
            this.homeSearchConfirm.addEventListener('click', () => this.generateHomeCatalogFromSearch());
        }

        if (this.homeSearchInput) {
            this.homeSearchInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') this.generateHomeCatalogFromSearch();
            });
        }

        this.playbackClose?.addEventListener('click', () => this.closePlaybackSheet());
        this.playbackEpisodeBtn?.addEventListener('click', () => this.openPlaybackEpisodeSidebar());
        this.playbackEpisodeClose?.addEventListener('click', () => this.closePlaybackEpisodeSidebar());
        this.playbackPresetBtn?.addEventListener('click', () => this.openPlaybackPresetSidebar());
        this.playbackPresetClose?.addEventListener('click', () => this.closePlaybackPresetSidebar());
        this.playbackCastBtn?.addEventListener('click', () => this.openPlaybackCastSheet());
        this.playbackCastDone?.addEventListener('click', () => this.closePlaybackCastSheet());
        this.playbackCastAdd?.addEventListener('click', () => this.addPlaybackCastMember());
        this.playbackAdvanceBtn?.addEventListener('click', () => this.openPlaybackNextModal('advance'));
        this.playbackNextBtn?.addEventListener('click', () => this.openPlaybackNextModal('next'));
        this.playbackNextClose?.addEventListener('click', () => this.closePlaybackNextModal());
        this.playbackNextConfirm?.addEventListener('click', () => this.handlePlaybackModalConfirm());
        this.playbackCastSheet?.addEventListener('click', (event) => {
            if (event.target === this.playbackCastSheet) this.closePlaybackCastSheet();
        });
        this.playbackNextModal?.addEventListener('click', (event) => {
            if (event.target === this.playbackNextModal && !this.isPlaybackNextLoading) this.closePlaybackNextModal();
        });

        if (this.worldBookEntry) {
            this.worldBookEntry.addEventListener('click', () => this.openWorldBookSheet());
        }

        if (this.settingsEntry) {
            this.settingsEntry.addEventListener('click', () => this.openSettingsSheet());
        }

        if (this.settingsSheet) {
            this.settingsSheet.addEventListener('click', (event) => {
                if (event.target === this.settingsSheet) this.closeSettingsSheet();
            });
        }

        if (this.settingsPlaybackCssFile) {
            this.settingsPlaybackCssFile.addEventListener('change', (event) => this.handleCssFile(event, this.settingsPlaybackCssInput));
        }

        if (this.settingsApply) {
            this.settingsApply.addEventListener('click', () => this.saveCustomCss());
        }

        if (this.settingsClear) {
            this.settingsClear.addEventListener('click', () => this.clearCustomCss());
        }

        if (this.worldBookSheet) {
            this.worldBookSheet.addEventListener('click', (event) => {
                if (event.target === this.worldBookSheet) this.closeWorldBookSheet();
            });
        }

        if (this.worldBookClose) {
            this.worldBookClose.addEventListener('click', () => this.closeWorldBookSheet());
        }

        if (this.worldBookSave) {
            this.worldBookSave.addEventListener('click', () => this.saveMountedWorldBooks());
        }

        if (this.profileSheet) {
            this.profileSheet.addEventListener('click', (event) => {
                if (event.target === this.profileSheet) this.closeProfileSheet();
            });
        }

        if (this.actorPickerSheet) {
            this.actorPickerSheet.addEventListener('click', (event) => {
                if (event.target === this.actorPickerSheet) this.closeActorPicker();
            });
        }

        if (this.workDetailSheet) {
            this.workDetailSheet.addEventListener('click', (event) => {
                if (event.target === this.workDetailSheet) this.closeWorkDetail();
            });
        }

        if (this.editAvatarTrigger && this.editAvatarInput) {
            this.editAvatarTrigger.addEventListener('click', () => this.editAvatarInput.click());
            this.editAvatarInput.addEventListener('change', (event) => this.handleAvatarFile(event));
        }

        if (this.editSaveBtn) {
            this.editSaveBtn.addEventListener('click', () => this.saveProfile());
        }

        if (this.createNewTrigger) {
            this.createNewTrigger.addEventListener('click', () => this.openCreateFormSheet());
        }

        if (this.createFormClose) {
            this.createFormClose.addEventListener('click', () => this.closeCreateFormSheet());
        }

        if (this.workCoverTrigger && this.workCoverInput) {
            this.workCoverTrigger.addEventListener('click', (event) => {
                if (event.target !== this.workCoverInput) this.workCoverInput.click();
            });
            this.workCoverInput.addEventListener('change', (event) => this.handleWorkCoverFile(event));
        }

        if (this.workTitleInput) {
            this.workTitleInput.addEventListener('input', () => {
                this.createDraft.title = this.workTitleInput.value;
            });
        }

        this.workCategoryButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.createDraft.category = button.getAttribute('data-category') || '电视剧';
                this.renderCreateForm();
            });
        });

        if (this.workTagsInput) {
            this.workTagsInput.addEventListener('input', () => {
                this.createDraft.tagsText = this.workTagsInput.value;
                this.renderTagPreview();
            });
        }

        if (this.workCastAddBtn) {
            this.workCastAddBtn.addEventListener('click', () => this.openActorPicker());
        }

        if (this.workSummaryInput) {
            this.workSummaryInput.addEventListener('input', () => {
                this.createDraft.summary = this.workSummaryInput.value;
            });
        }

        if (this.workStartBtn) {
            this.workStartBtn.addEventListener('click', () => this.saveCreatedWork());
        }

        if (this.workDeleteBtn) {
            this.workDeleteBtn.addEventListener('click', () => this.deleteWork());
        }

        if (this.actorPickerDoneBtn) {
            this.actorPickerDoneBtn.addEventListener('click', () => this.closeActorPicker());
        }

        this.renderCreateForm();
        this.renderWorks();
        this.renderHomeCatalog();
    }

    createDefaultWorkDraft() {
        return {
            coverUrl: '',
            title: '',
            category: '电视剧',
            tagsText: '',
            cast: [],
            summary: ''
        };
    }

    getHomeSectionNames() {
        return ['为你推荐', '电影', '电视剧', '综艺', '纪录片'];
    }

    createDefaultHomeCatalog() {
        return {
            banners: [null, null, null],
            recent: [],
            sections: this.getHomeSectionNames().reduce((sections, name) => {
                sections[name] = [];
                return sections;
            }, {})
        };
    }

    normalizeHomeCatalog(rawCatalog = null) {
        const defaults = this.createDefaultHomeCatalog();
        const safe = rawCatalog && typeof rawCatalog === 'object' ? rawCatalog : {};
        const sections = { ...defaults.sections };
        this.getHomeSectionNames().forEach(name => {
            const source = name === '为你推荐'
                ? (safe.sections?.[name] || safe.recommendations || safe.recommended)
                : safe.sections?.[name];
            sections[name] = Array.isArray(source)
                ? source.slice(0, 4).map((item, index) => this.normalizeCatalogItem(item, `${name}-${index}`, name === '为你推荐' ? '' : name)).filter(Boolean)
                : [];
        });

        return {
            banners: Array.from({ length: 3 }, (_, index) => {
                const item = Array.isArray(safe.banners) ? safe.banners[index] : null;
                return item ? this.normalizeCatalogItem(item, `banner-${index}`, '') : null;
            }),
            recent: Array.isArray(safe.recent)
                ? safe.recent.slice(0, 8).map((item, index) => this.normalizeCatalogItem(item, `recent-${index}`, '')).filter(Boolean)
                : [],
            sections
        };
    }

    normalizeCatalogItem(item = {}, fallbackId = this.createPresetId('catalog'), fallbackCategory = '') {
        if (!item || typeof item !== 'object') return null;
        const title = String(item.title || item.name || item.workTitle || '').trim();
        const category = String(item.category || item.type || fallbackCategory || '电视剧').trim();
        const tags = Array.isArray(item.tags)
            ? item.tags
            : String(item.tag || item.label || '')
                .split(/[，,、\s]+/)
                .filter(Boolean);
        const safeTitle = title || '未命名影片';
        const idBase = item.id || `${fallbackId}-${safeTitle}-${category}`;
        const summary = String(item.summary || item.description || item.desc || '').trim();
        const coverUrl = this.normalizeCoverUrl(item.coverUrl || item.cover || item.thumbnail || item.imageUrl || '', safeTitle, fallbackId);
        const castSource = Array.isArray(item.cast)
            ? item.cast
            : (Array.isArray(item.actors) ? item.actors : []);
        const cast = castSource
            .slice(0, 3)
            .map((actor, index) => this.normalizePlaybackActor(actor, index))
            .filter(Boolean);
        return {
            id: item.id ? String(idBase) : this.createCatalogId(idBase),
            title: safeTitle,
            category: category || '电视剧',
            tags: tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 4),
            coverUrl,
            summary,
            cast
        };
    }

    createCatalogId(value) {
        return `catalog-${String(value || Date.now()).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || Date.now()}`;
    }

    normalizeCoverUrl(url, title, fallbackId = '') {
        const trimmed = String(url || '').trim();
        if (/^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed)) return trimmed;
        const seed = encodeURIComponent(`${title || 'netflix'}-${fallbackId || ''}`);
        return `https://picsum.photos/seed/${seed}/640/960?grayscale`;
    }

    getCatalogFallbackGradient(index = 0) {
        const gradients = [
            'linear-gradient(135deg, #3a3a3a, #111)',
            'linear-gradient(135deg, #5a1418, #141414)',
            'linear-gradient(135deg, #1f3446, #080808)',
            'linear-gradient(135deg, #332a4a, #111)'
        ];
        return gradients[index % gradients.length];
    }

    renderHomeCatalog() {
        if (!this.homeContent) return;
        const catalog = this.normalizeHomeCatalog(this.netflixState.homeCatalog);
        this.netflixState.homeCatalog = catalog;
        const rows = [
            this.renderRecentRow(catalog.recent),
            ...this.getHomeSectionNames().map((name, index) => this.renderCatalogSection(name, catalog.sections[name] || [], index === this.getHomeSectionNames().length - 1))
        ].join('');

        this.homeContent.innerHTML = `
            <div class="netflix-hero-scroll">
                ${catalog.banners.map((item, index) => this.createHeroBanner(item, index)).join('')}
            </div>
            ${rows}
        `;
        this.bindHomeCatalogEvents();
    }

    renderRecentRow(items = []) {
        const content = items.length
            ? items.map((item, index) => this.renderCatalogCard(item, index, false)).join('')
            : '<div class="netflix-row-empty">暂无</div>';
        return `
            <div class="netflix-row">
                <h2 class="netflix-row-title">最近观看</h2>
                <div class="netflix-row-scroll netflix-recent-row-scroll">${content}</div>
            </div>
        `;
    }

    renderCatalogSection(title, items = [], isLast = false) {
        const content = items.length
            ? items.map((item, index) => this.renderCatalogCard(item, index, true)).join('')
            : '<div class="netflix-row-empty">暂无</div>';
        return `
            <div class="netflix-row ${isLast ? 'netflix-last-row' : ''}">
                <h2 class="netflix-row-title">${this.escapeHtml(title)}</h2>
                <div class="netflix-row-scroll">${content}</div>
            </div>
        `;
    }

    renderCatalogCard(item, index = 0, vertical = true) {
        const work = this.normalizeCatalogItem(item, `card-${index}`, item?.category || '');
        if (!work) return '';
        const tags = [work.category, ...(work.tags || [])].filter(Boolean).slice(0, 2);
        return `
            <button type="button" class="netflix-card ${vertical ? 'vertical' : ''} netflix-catalog-card" data-catalog-id="${this.escapeHtml(work.id)}" aria-label="查看${this.escapeHtml(work.title)}">
                <div class="netflix-card-img" style="background-image:url('${this.escapeAttr(work.coverUrl)}');"></div>
                <div class="netflix-card-text">
                    <strong>${this.escapeHtml(work.title)}</strong>
                    <span>${tags.map(tag => this.escapeHtml(tag)).join(' · ')}</span>
                </div>
            </button>
        `;
    }

    bindHomeCatalogEvents() {
        if (!this.homeContent) return;
        this.homeContent.querySelectorAll('[data-catalog-id]').forEach(element => {
            element.addEventListener('click', () => {
                const item = this.findCatalogItem(element.getAttribute('data-catalog-id'));
                if (item) this.openCatalogWorkDetail(item);
            });
        });
    }

    findCatalogItem(itemId) {
        const catalog = this.normalizeHomeCatalog(this.netflixState.homeCatalog);
        const allItems = [
            ...catalog.banners.filter(Boolean),
            ...catalog.recent,
            ...this.getHomeSectionNames().flatMap(name => catalog.sections[name] || [])
        ];
        return allItems.find(item => String(item.id) === String(itemId)) || null;
    }

    openHomeSearchSheet() {
        if (this.homeSearchSheet) this.homeSearchSheet.classList.add('active');
        if (this.homeSearchInput) {
            this.homeSearchInput.value = '';
            setTimeout(() => this.homeSearchInput?.focus(), 80);
        }
    }

    closeHomeSearchSheet(force = false) {
        if (this.isHomeSearchLoading && !force) return;
        if (this.homeSearchSheet) this.homeSearchSheet.classList.remove('active');
    }

    setHomeSearchLoading(isLoading) {
        this.isHomeSearchLoading = !!isLoading;
        if (this.homeSearchSheet) this.homeSearchSheet.classList.toggle('loading', this.isHomeSearchLoading);
        if (this.homeSearchInput) this.homeSearchInput.disabled = this.isHomeSearchLoading;
        if (this.homeSearchCancel) this.homeSearchCancel.disabled = this.isHomeSearchLoading;
        if (this.homeSearchConfirm) {
            this.homeSearchConfirm.disabled = this.isHomeSearchLoading;
            this.homeSearchConfirm.innerHTML = this.isHomeSearchLoading
                ? '<i class="fas fa-spinner fa-spin"></i> 生成中'
                : '确认';
        }
    }

    async generateHomeCatalogFromSearch() {
        if (this.isHomeSearchLoading) return;
        const apiConfig = typeof window.getApiConfig === 'function' ? window.getApiConfig() : (window.apiConfig || {});
        if (!apiConfig || !apiConfig.endpoint || !apiConfig.apiKey) {
            if (typeof window.showToast === 'function') window.showToast('请先在设置中配置大模型 API');
            return;
        }

        const query = (this.homeSearchInput?.value || '').trim();
        this.setHomeSearchLoading(true);
        try {
            const endpoint = this.resolveChatCompletionsEndpoint(apiConfig.endpoint);
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: apiConfig.model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: this.createHomeCatalogPrompt(query) }],
                    temperature: parseFloat(apiConfig.temperature) || 0.8,
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) throw new Error(`API Request Failed: ${response.status}`);
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';
            const parsed = this.parseJsonFromText(content);
            const recent = this.normalizeHomeCatalog(this.netflixState.homeCatalog).recent;
            const nextCatalog = this.normalizeGeneratedHomeCatalog(parsed, recent);
            this.netflixState.homeCatalog = nextCatalog;
            this.saveNetflixState();
            this.renderHomeCatalog();
            this.closeHomeSearchSheet(true);
            if (typeof window.showToast === 'function') window.showToast('Netflix 首页已生成');
        } catch (error) {
            console.error('Netflix home catalog generation failed:', error);
            if (typeof window.showToast === 'function') window.showToast('生成失败，请检查 API 返回格式或网络');
        } finally {
            this.setHomeSearchLoading(false);
        }
    }

    resolveChatCompletionsEndpoint(endpoint = '') {
        let resolved = String(endpoint || '').trim();
        if (resolved.endsWith('/')) resolved = resolved.slice(0, -1);
        if (!resolved.endsWith('/chat/completions')) {
            resolved = resolved.endsWith('/v1') ? `${resolved}/chat/completions` : `${resolved}/v1/chat/completions`;
        }
        return resolved;
    }

    getNetflixApiConfig() {
        return typeof window.getApiConfig === 'function' ? window.getApiConfig() : (window.apiConfig || {});
    }

    async requestChatCompletion(promptText, options = {}) {
        const apiConfig = options.apiConfig || this.getNetflixApiConfig();
        if (!apiConfig || !apiConfig.endpoint || !apiConfig.apiKey) {
            throw new Error('API_CONFIG_MISSING');
        }

        const endpoint = this.resolveChatCompletionsEndpoint(apiConfig.endpoint);
        const timeoutMs = Number(options.timeoutMs) || 60000;
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

        try {
            const body = {
                model: apiConfig.model || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: promptText }],
                temperature: parseFloat(apiConfig.temperature) || 0.8
            };
            if (options.responseFormat) body.response_format = options.responseFormat;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiConfig.apiKey}`
                },
                body: JSON.stringify(body),
                signal: controller?.signal
            });

            if (!response.ok) {
                let detail = '';
                try {
                    detail = await response.text();
                } catch (error) {
                    detail = '';
                }
                const error = new Error(`API Request Failed: ${response.status}${detail ? ` ${detail.slice(0, 240)}` : ''}`);
                error.status = response.status;
                throw error;
            }

            return response.json();
        } catch (error) {
            if (error?.name === 'AbortError') {
                const timeoutError = new Error('API_REQUEST_TIMEOUT');
                timeoutError.isTimeout = true;
                throw timeoutError;
            }
            throw error;
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    createHomeCatalogPrompt(query = '') {
        const intent = query
            ? `用户搜索内容是：“${query}”。请围绕这个内容生成。`
            : '用户没有输入搜索内容。请随机生成一组适合 Netflix 首页的影片。';
        return `${intent}
请返回严格 JSON，不要 Markdown，不要解释。结构必须是：
{
  "banners": [
    {"title":"作品名","category":"电影/电视剧/综艺/纪录片","tags":["标签1","标签2"],"coverUrl":"https://picsum.photos/seed/.../640/960?grayscale","summary":"简介","cast":[{"realName":"演员名","roleName":"饰演角色","rolePersona":"人物设定","avatar":""}]}
  ],
  "recommendations": [
    {"title":"作品名","category":"电影/电视剧/综艺/纪录片","tags":["标签1","标签2"],"coverUrl":"https://picsum.photos/seed/.../640/960?grayscale","summary":"简介","cast":[{"realName":"演员名","roleName":"饰演角色","rolePersona":"人物设定","avatar":""}]}
  ],
  "sections": {
    "电影": [],
    "电视剧": [],
    "综艺": [],
    "纪录片": []
  }
}
数量要求：banners 必须 3 个，recommendations 必须 4 个，sections 里的电影、电视剧、综艺、纪录片各 4 个。
每个作品都必须包含 title、category、tags、coverUrl、summary、cast。cast 必须是 1-3 个主演，每个主演包含 realName、roleName、rolePersona、avatar，avatar 可为空字符串。
coverUrl 使用外部图片链接，优先使用 https://picsum.photos/seed/英文或拼音关键词/640/960?grayscale 这种稳定链接。`;
    }

    parseJsonFromText(text = '') {
        const raw = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
        const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        return JSON.parse(match ? match[0] : raw);
    }

    normalizeGeneratedHomeCatalog(parsed, existingRecent = []) {
        const safe = parsed && typeof parsed === 'object' ? parsed : {};
        const catalog = this.createDefaultHomeCatalog();
        catalog.banners = (Array.isArray(safe.banners) ? safe.banners : [])
            .slice(0, 3)
            .map((item, index) => this.normalizeCatalogItem(item, `banner-${index}`, ''))
            .filter(Boolean);
        while (catalog.banners.length < 3) catalog.banners.push(null);

        catalog.recent = Array.isArray(existingRecent)
            ? existingRecent.slice(0, 8).map((item, index) => this.normalizeCatalogItem(item, `recent-${index}`, '')).filter(Boolean)
            : [];
        catalog.sections['为你推荐'] = (Array.isArray(safe.recommendations) ? safe.recommendations : (safe.sections?.['为你推荐'] || []))
            .slice(0, 4)
            .map((item, index) => this.normalizeCatalogItem(item, `recommend-${index}`, ''))
            .filter(Boolean);

        ['电影', '电视剧', '综艺', '纪录片'].forEach(name => {
            catalog.sections[name] = (Array.isArray(safe.sections?.[name]) ? safe.sections[name] : [])
                .slice(0, 4)
                .map((item, index) => this.normalizeCatalogItem(item, `${name}-${index}`, name))
                .filter(Boolean);
        });

        const requiredCounts = [
            catalog.banners.filter(Boolean).length === 3,
            catalog.sections['为你推荐'].length === 4,
            catalog.sections['电影'].length === 4,
            catalog.sections['电视剧'].length === 4,
            catalog.sections['综艺'].length === 4,
            catalog.sections['纪录片'].length === 4
        ];
        if (!requiredCounts.every(Boolean)) throw new Error('Generated catalog is incomplete');

        return this.normalizeHomeCatalog(catalog);
    }

    normalizePlaybackCatalog(rawCatalog = null) {
        const safe = rawCatalog && typeof rawCatalog === 'object' ? rawCatalog : {};
        return Object.entries(safe).reduce((catalog, [id, entry]) => {
            const normalized = this.normalizePlaybackEntry(entry, id);
            if (normalized) catalog[normalized.id] = normalized;
            return catalog;
        }, {});
    }

    normalizePlaybackEntry(entry = {}, fallbackId = '') {
        if (!entry || typeof entry !== 'object') return null;
        const item = this.normalizeCatalogItem(entry.item || entry.work || entry, fallbackId || 'playback', entry.category || '');
        if (!item) return null;
        const episodes = Array.isArray(entry.episodes)
            ? entry.episodes.map((episode, index) => this.normalizePlaybackEpisode(episode, index + 1)).filter(Boolean)
            : [];
        const introIndex = episodes.findIndex(episode => Number(episode.number) === 0);
        if (introIndex === -1) {
            episodes.unshift(this.createInitialPlaybackEpisode(item));
        } else {
            episodes[introIndex] = this.normalizePlaybackIntroEpisode(episodes[introIndex], item);
        }
        episodes.sort((a, b) => Number(a.number) - Number(b.number));
        const requestedActive = Number(entry.activeEpisodeNumber);
        const activeEpisodeNumber = episodes.some(episode => Number(episode.number) === requestedActive)
            ? requestedActive
            : 0;
        return {
            id: item.id,
            item,
            episodes,
            activeEpisodeNumber,
            presetSwitches: entry.presetSwitches && typeof entry.presetSwitches === 'object' ? entry.presetSwitches : {},
            updatedAt: entry.updatedAt || new Date().toISOString()
        };
    }

    normalizePlaybackEpisode(episode = {}, fallbackNumber = 1) {
        const safe = episode && typeof episode === 'object' ? episode : {};
        const parsedNumber = Number(safe.number);
        return {
            number: Number.isFinite(parsedNumber) ? parsedNumber : fallbackNumber,
            recap: typeof safe.recap === 'string' ? safe.recap : '',
            content: typeof safe.content === 'string' ? safe.content : '',
            summary: typeof safe.summary === 'string' ? safe.summary : '',
            comments: Array.isArray(safe.comments) ? safe.comments : [],
            cast: Array.isArray(safe.cast) ? safe.cast.map((actor, index) => this.normalizePlaybackActor(actor, index)).filter(Boolean) : [],
            createdAt: safe.createdAt || new Date().toISOString()
        };
    }

    createInitialPlaybackEpisode(item) {
        const itemCast = Array.isArray(item?.cast)
            ? item.cast.map((actor, index) => this.normalizePlaybackActor(actor, index)).filter(Boolean)
            : [];
        return this.normalizePlaybackIntroEpisode({
            number: 0,
            recap: '',
            content: item.summary || '',
            summary: item.summary || '',
            cast: itemCast.length ? itemCast : this.createDefaultPlaybackCast(),
            createdAt: new Date().toISOString()
        }, item);
    }

    normalizePlaybackIntroEpisode(episode = {}, item = {}) {
        const itemCast = Array.isArray(item?.cast)
            ? item.cast.map((actor, index) => this.normalizePlaybackActor(actor, index)).filter(Boolean)
            : [];
        const fallbackCast = itemCast.length ? itemCast : this.createDefaultPlaybackCast();
        return {
            ...episode,
            number: 0,
            recap: '',
            content: episode.content || item.summary || '',
            summary: episode.summary || item.summary || '',
            cast: Array.isArray(episode.cast) && episode.cast.length ? episode.cast : fallbackCast,
            createdAt: episode.createdAt || new Date().toISOString()
        };
    }

    createDefaultPlaybackCast() {
        const user = this.getUserState();
        const name = user.name || user.realName || 'User';
        return [{
            id: this.createPresetId('cast'),
            realName: name,
            name,
            roleName: name,
            rolePersona: user.persona || user.signature || '',
            avatar: user.avatarUrl || user.avatar || ''
        }];
    }

    normalizePlaybackActor(actor = {}, index = 0) {
        if (!actor || typeof actor !== 'object') return null;
        const realName = String(actor.realName || actor.name || `主演${index + 1}`).trim();
        return {
            id: String(actor.id || this.createPresetId('cast')),
            realName,
            name: String(actor.name || realName).trim(),
            roleName: String(actor.roleName || actor.name || realName).trim(),
            rolePersona: String(actor.rolePersona || actor.persona || actor.desc || '').trim(),
            avatar: String(actor.avatar || actor.avatarUrl || '').trim()
        };
    }

    getPlaybackEntry(playbackId = this.activePlaybackId) {
        if (!playbackId) return null;
        const catalog = this.netflixState.playbackCatalog || {};
        const entry = catalog[playbackId] || null;
        return entry ? this.normalizePlaybackEntry(entry, playbackId) : null;
    }

    savePlaybackEntry(entry) {
        if (!entry) return;
        if (!this.netflixState.playbackCatalog || typeof this.netflixState.playbackCatalog !== 'object') {
            this.netflixState.playbackCatalog = {};
        }
        entry.updatedAt = new Date().toISOString();
        this.netflixState.playbackCatalog[entry.id] = this.normalizePlaybackEntry(entry, entry.id);
    }

    getSerializablePlaybackEpisodes(entry) {
        return (entry?.episodes || [])
            .filter(episode => Number(episode.number) > 0)
            .map((episode, index) => ({
                number: index + 1,
                recap: episode.recap || '',
                content: episode.content || '',
                summary: episode.summary || '',
                comments: Array.isArray(episode.comments) ? episode.comments : [],
                cast: Array.isArray(episode.cast) ? episode.cast : [],
                createdAt: episode.createdAt || new Date().toISOString()
            }));
    }

    syncPlaybackEntryToSourceWork(entry) {
        if (!entry?.id) return null;
        const sourceWork = (this.netflixState.works || []).find(work => String(work.id) === String(entry.id));
        if (!sourceWork) return null;
        sourceWork.title = entry.item?.title || sourceWork.title || '未命名作品';
        sourceWork.category = entry.item?.category || sourceWork.category || '电视剧';
        sourceWork.tags = Array.isArray(entry.item?.tags) ? entry.item.tags : (sourceWork.tags || []);
        sourceWork.coverUrl = entry.item?.coverUrl || sourceWork.coverUrl || '';
        sourceWork.summary = entry.item?.summary || sourceWork.summary || '';
        sourceWork.cast = Array.isArray(entry.item?.cast) ? entry.item.cast : (sourceWork.cast || []);
        sourceWork.episodes = JSON.parse(JSON.stringify(this.getSerializablePlaybackEpisodes(entry)));
        sourceWork.episodeCount = sourceWork.episodes.length || 1;
        return this.normalizeWork(sourceWork, sourceWork.id);
    }

    getActivePlaybackEpisode() {
        const entry = this.getPlaybackEntry();
        if (!entry) return null;
        return entry.episodes.find(episode => Number(episode.number) === Number(this.activePlaybackEpisodeNumber))
            || entry.episodes.find(episode => Number(episode.number) === 0)
            || entry.episodes[0]
            || null;
    }

    upsertRecentCatalogItem(item) {
        const work = this.normalizeCatalogItem(item, item?.id || 'recent', item?.category || '');
        if (!work) return;
        const catalog = this.normalizeHomeCatalog(this.netflixState.homeCatalog);
        catalog.recent = [work, ...catalog.recent.filter(existing => String(existing.id) !== String(work.id))].slice(0, 8);
        this.netflixState.homeCatalog = catalog;
    }

    normalizeNetflixState(rawState = null) {
        const safe = rawState && typeof rawState === 'object' ? rawState : {};
        return {
            works: Array.isArray(safe.works) ? safe.works.map((work, index) => this.normalizeWork(work, `legacy-work-${index}`)) : [],
            boundWorldBookIds: Array.isArray(safe.boundWorldBookIds) ? safe.boundWorldBookIds.map(String) : [],
            homeCatalog: this.normalizeHomeCatalog(safe.homeCatalog),
            playbackCatalog: this.normalizePlaybackCatalog(safe.playbackCatalog),
            playbackCustomCss: typeof safe.playbackCustomCss === 'string' ? safe.playbackCustomCss : ''
        };
    }

    loadNetflixState() {
        let rawState = null;
        try {
            if (typeof window.getAppState === 'function') {
                rawState = window.getAppState('netflix') || null;
            }
            if (!rawState && window.StorageManager && typeof window.StorageManager.load === 'function') {
                rawState = {
                    works: window.StorageManager.load('u2_netflixWorks', []),
                    boundWorldBookIds: window.StorageManager.load('u2_netflixBoundWorldBookIds', []),
                    homeCatalog: window.StorageManager.load('u2_netflixHomeCatalog', null),
                    playbackCatalog: window.StorageManager.load('u2_netflixPlaybackCatalog', null),
                    playbackCustomCss: window.StorageManager.load('u2_netflixPlaybackCustomCss', '')
                };
            }
        } catch (error) {
            console.warn('Failed to load Netflix state:', error);
        }
        return this.normalizeNetflixState(rawState);
    }

    saveNetflixState() {
        try {
            if (typeof window.getAppState === 'function' && typeof window.setAppState === 'function') {
                const previous = window.getAppState('netflix') || {};
                window.setAppState('netflix', {
                    ...previous,
                    works: this.netflixState.works,
                    boundWorldBookIds: this.netflixState.boundWorldBookIds || [],
                    homeCatalog: this.netflixState.homeCatalog || this.createDefaultHomeCatalog(),
                    playbackCatalog: this.netflixState.playbackCatalog || {},
                    playbackCustomCss: this.netflixState.playbackCustomCss || ''
                }, { silent: true });
            } else if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                window.StorageManager.save('u2_netflixWorks', this.netflixState.works);
                window.StorageManager.save('u2_netflixBoundWorldBookIds', this.netflixState.boundWorldBookIds || []);
                window.StorageManager.save('u2_netflixHomeCatalog', this.netflixState.homeCatalog || this.createDefaultHomeCatalog());
                window.StorageManager.save('u2_netflixPlaybackCatalog', this.netflixState.playbackCatalog || {});
                window.StorageManager.save('u2_netflixPlaybackCustomCss', this.netflixState.playbackCustomCss || '');
            }
            if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                window.StorageManager.save('u2_netflixPlaybackCustomCss', this.netflixState.playbackCustomCss || '');
            }
        } catch (error) {
            console.warn('Failed to save Netflix state:', error);
        }
    }

    openSettingsSheet() {
        if (this.settingsPlaybackCssInput) {
            this.settingsPlaybackCssInput.value = this.netflixState.playbackCustomCss || '';
        }
        if (this.settingsSheet) this.settingsSheet.classList.add('active');
    }

    closeSettingsSheet() {
        if (this.settingsSheet) this.settingsSheet.classList.remove('active');
    }

    handleCssFile(event, targetInput) {
        const file = event?.target?.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
            if (targetInput) {
                targetInput.value = String(readerEvent.target?.result || '');
            }
        };
        reader.readAsText(file);
        if (event.target) event.target.value = '';
    }

    getActiveSettingsTab() {
        return 'playback';
    }

    saveCustomCss() {
        if (this.settingsPlaybackCssInput) {
            this.netflixState.playbackCustomCss = String(this.settingsPlaybackCssInput.value || '');
            if (typeof window.showToast === 'function') window.showToast('播放界面样式已应用');
        }
        this.applyCustomCss();
        this.saveNetflixState();
    }

    clearCustomCss() {
        if (this.settingsPlaybackCssInput) {
            this.netflixState.playbackCustomCss = '';
            this.settingsPlaybackCssInput.value = '';
            if (typeof window.showToast === 'function') window.showToast('播放界面样式已清空');
        }
        this.applyCustomCss();
        this.saveNetflixState();
    }

    applyCustomCss() {
        const playbackCss = this.netflixState?.playbackCustomCss || '';

        if (typeof document === 'undefined') return;
        const styleId = 'netflix-custom-styles';
        let style = document.getElementById(styleId);
        
        let finalCss = '';

        if (playbackCss.trim()) {
            finalCss += this.scopeCssBlock(
                String(playbackCss).replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import\s+[^;]+;/gi, ''), 
                '#netflix-playback-sheet'
            );
        }

        if (!finalCss) {
            if (style) style.remove();
            return;
        }

        if (!document.head) return;
        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            document.head.appendChild(style);
        }
        style.textContent = finalCss;
    }

    scopeCssBlock(css = '', scope = '#netflix-playback-sheet') {
        let output = '';
        let index = 0;
        while (index < css.length) {
            const openIndex = css.indexOf('{', index);
            if (openIndex === -1) {
                output += css.slice(index);
                break;
            }
            const selector = css.slice(index, openIndex).trim();
            const closeIndex = this.findMatchingBrace(css, openIndex);
            if (closeIndex === -1) {
                output += css.slice(index);
                break;
            }
            const body = css.slice(openIndex + 1, closeIndex);
            const lowerSelector = selector.toLowerCase();
            if (lowerSelector.startsWith('@keyframes') || lowerSelector.startsWith('@-webkit-keyframes') || lowerSelector.startsWith('@font-face')) {
                output += `${selector}{${body}}`;
            } else if (lowerSelector.startsWith('@media') || lowerSelector.startsWith('@supports') || lowerSelector.startsWith('@container') || lowerSelector.startsWith('@layer')) {
                output += `${selector}{${this.scopeCssBlock(body, scope)}}`;
            } else if (selector.startsWith('@')) {
                output += '';
            } else {
                const scopedSelector = this.scopeCssSelectors(selector, scope);
                if (scopedSelector) output += `${scopedSelector}{${body}}`;
            }
            index = closeIndex + 1;
        }
        return output;
    }

    findMatchingBrace(css = '', openIndex = 0) {
        let depth = 0;
        let quote = '';
        for (let index = openIndex; index < css.length; index += 1) {
            const char = css[index];
            const prev = css[index - 1];
            if (quote) {
                if (char === quote && prev !== '\\') quote = '';
                continue;
            }
            if (char === '"' || char === "'") {
                quote = char;
                continue;
            }
            if (char === '{') depth += 1;
            if (char === '}') {
                depth -= 1;
                if (depth === 0) return index;
            }
        }
        return -1;
    }

    scopeCssSelectors(selectorText = '', scope = '#netflix-playback-sheet') {
        return this.splitCssSelectors(selectorText)
            .map(selector => selector.trim())
            .filter(Boolean)
            .map(selector => {
                if (selector.startsWith(scope)) return selector;
                if (/^(html|body|:root)$/i.test(selector)) return scope;
                if (/^(html|body)\b/i.test(selector)) {
                    return selector.replace(/^(html|body)\b/i, scope);
                }
                return `${scope} ${selector}`;
            })
            .join(', ');
    }

    splitCssSelectors(selectorText = '') {
        const selectors = [];
        let current = '';
        let depth = 0;
        let quote = '';
        for (let index = 0; index < selectorText.length; index += 1) {
            const char = selectorText[index];
            const prev = selectorText[index - 1];
            if (quote) {
                current += char;
                if (char === quote && prev !== '\\') quote = '';
                continue;
            }
            if (char === '"' || char === "'") {
                quote = char;
                current += char;
                continue;
            }
            if (char === '(' || char === '[') depth += 1;
            if (char === ')' || char === ']') depth = Math.max(0, depth - 1);
            if (char === ',' && depth === 0) {
                selectors.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        if (current.trim()) selectors.push(current);
        return selectors;
    }

    renderCreateForm() {
        if (this.workDeleteBtn) {
            this.workDeleteBtn.style.display = this.editingWorkId ? 'block' : 'none';
        }
        if (this.workCoverPreview) {
            if (this.createDraft.coverUrl) {
                this.workCoverPreview.src = this.createDraft.coverUrl;
                this.workCoverPreview.style.display = 'block';
            } else {
                this.workCoverPreview.removeAttribute('src');
                this.workCoverPreview.style.display = 'none';
            }
        }
        if (this.workTitleInput) this.workTitleInput.value = this.createDraft.title || '';
        this.workCategoryButtons.forEach(button => {
            button.classList.toggle('active', button.getAttribute('data-category') === this.createDraft.category);
        });
        if (this.workTagsInput) this.workTagsInput.value = this.createDraft.tagsText || '';
        if (this.workSummaryInput) this.workSummaryInput.value = this.createDraft.summary || '';
        this.renderTagPreview();
        this.renderCastList();
    }

    parseWorkTags(text = this.createDraft.tagsText) {
        return String(text || '')
            .split(/[\s,，、]+/)
            .map(tag => tag.trim())
            .filter(Boolean);
    }

    parseEpisodeCount(value = null) {
        const count = parseInt(value, 10);
        return Number.isFinite(count) && count > 0 ? count : 1;
    }

    renderTagPreview() {
        if (!this.workTagPreview) return;
        const tags = this.parseWorkTags();
        this.workTagPreview.innerHTML = tags.length
            ? tags.map(tag => `<span>${this.escapeHtml(tag)}</span>`).join('')
            : '<em>暂无标签</em>';
    }

    renderCastList() {
        if (!this.workCastList || !this.workCastAddBtn) return;
        const castItems = this.createDraft.cast.map(actor => `
            <div class="netflix-cast-item" data-actor-id="${actor.id}">
                <div class="netflix-cast-avatar">${actor.avatar ? `<img src="${actor.avatar}" alt="">` : `<span>${this.escapeHtml((actor.realName || actor.name || '?').charAt(0))}</span>`}</div>
                <div class="netflix-cast-meta">
                    <strong>${this.escapeHtml(actor.realName || actor.name || '未命名')}</strong>
                    <label>
                        <span>饰演</span>
                        <input type="text" data-actor-id="${actor.id}" class="role-name-input" value="${this.escapeHtml(actor.roleName || '')}" placeholder="角色名">
                    </label>
                    <label>
                        <span>人设</span>
                        <textarea data-actor-id="${actor.id}" class="role-persona-input" placeholder="角色人设" style="min-height: 60px;">${this.escapeHtml(actor.rolePersona || '')}</textarea>
                    </label>
                </div>
            </div>
        `).join('');
        this.workCastList.innerHTML = `
            ${castItems}
            <button type="button" class="netflix-cast-add" id="netflix-work-cast-add-btn" aria-label="添加主演">
                <i class="fas fa-plus"></i>
            </button>
        `;
        this.workCastAddBtn = this.view.querySelector('#netflix-work-cast-add-btn');
        this.workCastAddBtn?.addEventListener('click', () => this.openActorPicker());
        this.workCastList.querySelectorAll('.netflix-cast-meta .role-name-input').forEach(input => {
            input.addEventListener('input', () => {
                const actor = this.createDraft.cast.find(item => item.id === input.getAttribute('data-actor-id'));
                if (actor) actor.roleName = input.value;
            });
        });
        this.workCastList.querySelectorAll('.netflix-cast-meta .role-persona-input').forEach(textarea => {
            textarea.addEventListener('input', () => {
                const actor = this.createDraft.cast.find(item => item.id === textarea.getAttribute('data-actor-id'));
                if (actor) actor.rolePersona = textarea.value;
            });
        });
    }

    handleWorkCoverFile(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            this.createDraft.coverUrl = reader.result || '';
            this.renderCreateForm();
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    }

    async getAvailableActors() {
        const user = this.getUserState();
        const actors = [{
            id: 'user-current',
            type: 'user',
            sourceId: 'user-current',
            realName: user.name || user.realName || 'User',
            name: user.name || user.realName || 'User',
            roleName: user.name || user.realName || 'User',
            rolePersona: user.persona || user.desc || user.bio || '',
            avatar: user.avatarUrl || user.avatar || ''
        }];

        try {
            let friends = [];
            if (window.imStorage && typeof window.imStorage.loadFriends === 'function') {
                friends = await window.imStorage.loadFriends();
            } else if (typeof window.getAppState === 'function') {
                friends = window.getAppState('imessage')?.friends || [];
            }

            friends
                .filter(friend => friend && (friend.type === 'char' || friend.type === 'npc'))
                .forEach(friend => {
                    const realName = friend.realName || friend.realname || friend.originalName || friend.name || friend.nickname || (friend.type === 'npc' ? 'NPC' : 'Char');
                    const name = friend.nickname || friend.name || friend.realName || realName;
                    actors.push({
                        id: `${friend.type}-${friend.id || realName}`,
                        sourceId: friend.id || '',
                        type: friend.type,
                        realName,
                        name,
                        roleName: name,
                        rolePersona: friend.persona || friend.desc || friend.signature || friend.bio || '',
                        avatar: friend.avatarUrl || friend.avatar || friend.avatarDataUrl || ''
                    });
                });
        } catch (error) {
            console.warn('Failed to load Netflix actors:', error);
        }

        return actors;
    }

    async openActorPicker() {
        if (!this.actorPickerSheet || !this.actorPickerList) return;
        this.actorPickerList.innerHTML = '<div class="netflix-actor-empty">加载中...</div>';
        this.actorPickerSheet.classList.add('active');
        this.availableActors = await this.getAvailableActors();
        this.renderActorPicker();
    }

    closeActorPicker() {
        if (this.actorPickerSheet) this.actorPickerSheet.classList.remove('active');
    }

    renderActorPicker() {
        if (!this.actorPickerList) return;
        if (!this.availableActors.length) {
            this.actorPickerList.innerHTML = '<div class="netflix-actor-empty">暂无可选主演</div>';
            return;
        }
        const selectedIds = new Set(this.createDraft.cast.map(actor => actor.id));
        this.actorPickerList.innerHTML = this.availableActors.map(actor => `
            <button type="button" class="netflix-actor-option ${selectedIds.has(actor.id) ? 'selected' : ''}" data-actor-id="${actor.id}" ${actor.id === 'user-current' ? 'disabled style="opacity: 0.8; cursor: not-allowed;"' : ''}>
                <div class="netflix-actor-avatar">${actor.avatar ? `<img src="${actor.avatar}" alt="">` : `<span>${this.escapeHtml((actor.realName || actor.name || '?').charAt(0))}</span>`}</div>
                <div class="netflix-actor-info">
                    <strong>${this.escapeHtml(actor.realName || actor.name || '未命名')}</strong>
                    <span>${this.escapeHtml(actor.type === 'user' ? 'user' : actor.type)}</span>
                </div>
                <i class="fas ${selectedIds.has(actor.id) ? 'fa-check-circle' : 'fa-plus-circle'}"></i>
            </button>
        `).join('');
        this.actorPickerList.querySelectorAll('.netflix-actor-option').forEach(button => {
            button.addEventListener('click', () => this.toggleCreateActor(button.getAttribute('data-actor-id')));
        });
    }

    toggleCreateActor(actorId) {
        if (actorId === 'user-current') {
            if (typeof window.showToast === 'function') window.showToast('User 必须作为主演，不可取消');
            return;
        }
        const existingIndex = this.createDraft.cast.findIndex(actor => actor.id === actorId);
        if (existingIndex >= 0) {
            this.createDraft.cast.splice(existingIndex, 1);
        } else {
            const nonUserCount = this.createDraft.cast.filter(a => a.type !== 'user').length;
            if (nonUserCount >= 2) {
                if (typeof window.showToast === 'function') window.showToast('最多只能选择两个 Char 作为主演');
                return;
            }
            const actor = this.availableActors.find(item => item.id === actorId);
            if (actor) this.createDraft.cast.push({ ...actor });
        }
        this.renderActorPicker();
        this.renderCastList();
    }

    openCreateFormSheet() {
        if (!this.createDraft.cast.some(a => a.type === 'user')) {
            const user = this.getUserState();
            this.createDraft.cast.unshift({
                id: 'user-current',
                type: 'user',
                sourceId: 'user-current',
                realName: user.name || user.realName || 'User',
                name: user.name || user.realName || 'User',
                roleName: user.name || user.realName || 'User',
                rolePersona: user.persona || user.signature || '',
                avatar: user.avatarUrl || user.avatar || ''
            });
        }
        this.renderCreateForm();
        if (this.createFormSheet) this.createFormSheet.classList.add('active');
    }

    openEditWorkForm() {
        const work = this.getActiveWork();
        if (!work) return;
        this.editingWorkId = work.id;
        this.createDraft = {
            coverUrl: work.coverUrl || '',
            title: work.title || '',
            category: work.category || '电视剧',
            tagsText: (work.tags || []).join(', '),
            cast: JSON.parse(JSON.stringify(work.cast || [])),
            summary: work.summary || ''
        };
        
        if (this.workStartBtn) this.workStartBtn.textContent = '保存修改';
        this.openCreateFormSheet();
    }

    closeCreateFormSheet() {
        if (this.createFormSheet) this.createFormSheet.classList.remove('active');
        this.editingWorkId = null;
        if (this.workStartBtn) this.workStartBtn.textContent = '开始创作';
        this.createDraft = this.createDefaultWorkDraft();
    }

    openWorldBookSheet() {
        this.renderWorldBookSheet();
        if (this.worldBookSheet) this.worldBookSheet.classList.add('active');
    }

    closeWorldBookSheet() {
        if (this.worldBookSheet) this.worldBookSheet.classList.remove('active');
    }

    renderWorldBookSheet() {
        if (!this.worldBookList) return;
        const books = this.getAvailableWorldBooks();
        const selected = new Set((this.netflixState.boundWorldBookIds || []).map(String));
        if (!books.length) {
            this.worldBookList.innerHTML = '<div class="netflix-world-book-empty">暂无世界书，请先在设置中创建。</div>';
            return;
        }

        const grouped = books.reduce((acc, book) => {
            const group = book.group || '未分组';
            if (!acc[group]) acc[group] = [];
            acc[group].push(book);
            return acc;
        }, {});

        this.worldBookList.innerHTML = Object.entries(grouped).map(([group, items]) => `
            <div class="netflix-world-book-group">
                <div class="netflix-world-book-group-title">${this.escapeHtml(group)}</div>
                ${items.map(book => {
                    const id = String(book.id);
                    const entries = Array.isArray(book.entries) ? book.entries : [];
                    return `
                        <label class="netflix-world-book-item">
                            <div class="netflix-world-book-item-main">
                                <i class="fas fa-book"></i>
                                <div>
                                    <strong>${this.escapeHtml(book.name || '未命名世界书')}</strong>
                                    <span>${entries.length} 条词条</span>
                                </div>
                            </div>
                            <input type="checkbox" class="netflix-world-book-checkbox" value="${this.escapeHtml(id)}" ${selected.has(id) ? 'checked' : ''}>
                        </label>
                    `;
                }).join('')}
            </div>
        `).join('');
    }

    saveMountedWorldBooks() {
        const ids = Array.from(this.worldBookList?.querySelectorAll('.netflix-world-book-checkbox:checked') || []).map(input => input.value);
        this.netflixState.boundWorldBookIds = ids;
        this.saveNetflixState();
        this.closeWorldBookSheet();
        if (typeof window.showToast === 'function') window.showToast('世界书已挂载');
    }

    getAvailableWorldBooks() {
        if (typeof window.getWorldBooks === 'function') {
            const books = window.getWorldBooks();
            if (Array.isArray(books)) return books;
        }
        if (window.StorageManager && typeof window.StorageManager.load === 'function') {
            return window.StorageManager.load('u2_worldBooks', []) || [];
        }
        return [];
    }

    getMountedWorldBookContext() {
        const selected = new Set((this.netflixState.boundWorldBookIds || []).map(String));
        if (!selected.size) return '';
        return this.getAvailableWorldBooks()
            .filter(book => selected.has(String(book.id)))
            .map(book => {
                const entriesText = (Array.isArray(book.entries) ? book.entries : [])
                    .filter(entry => entry && entry.enabled !== false)
                    .map(entry => {
                        const title = entry.title || entry.name || entry.keyword || '未命名词条';
                        return `【${title}】\n${entry.content || ''}`.trim();
                    })
                    .filter(Boolean)
                    .join('\n');
                return entriesText ? `《${book.name || '未命名世界书'}》\n${entriesText}` : '';
            })
            .filter(Boolean)
            .join('\n\n');
    }
    normalizeRecordMessage(message = {}, fallbackIndex = 0) {
        const safe = message && typeof message === 'object' ? message : {};
        const role = safe.role === 'api' || safe.role === 'char' ? 'char' : 'user';
        return {
            id: safe.id || this.createPresetId(`msg-${fallbackIndex}`),
            role,
            content: safe.content || safe.text || '',
            scene: Number.isFinite(Number(safe.scene)) ? Number(safe.scene) : null,
            tokens: Number.isFinite(Number(safe.tokens)) ? Number(safe.tokens) : 0,
            createdAt: safe.createdAt || new Date().toISOString()
        };
    }

    getLegacyMessagesContent(messages = []) {
        if (!Array.isArray(messages) || !messages.length) return '';
        return messages
            .map((message, index) => {
                const normalized = this.normalizeRecordMessage(message, index);
                const speaker = normalized.role === 'user' ? 'User' : 'Char';
                return normalized.content ? `${speaker}: ${normalized.content}` : '';
            })
            .filter(Boolean)
            .join('\n\n');
    }

    getActiveWork() {
        if (!this.activeWorkId) return null;
        return (this.netflixState.works || []).find(work => String(work.id) === String(this.activeWorkId)) || null;
    }

    ensureWorkEpisodes(work) {
        if (!work) return [];
        const savedEpisodes = Array.isArray(work.episodes) ? work.episodes : [];
        if (savedEpisodes.length === 0) {
            savedEpisodes.push({ number: 1, recap: '', content: '', summary: '', comments: [], cast: [], messages: [] });
        }
        work.episodes = savedEpisodes.map((saved, index) => {
            const messages = Array.isArray(saved.messages)
                ? saved.messages.map((message, msgIndex) => this.normalizeRecordMessage(message, msgIndex))
                : [];
            const content = typeof saved.content === 'string' && saved.content.trim()
                ? saved.content
                : this.getLegacyMessagesContent(messages);
            return {
                number: Number(saved.number) > 0 ? Number(saved.number) : index + 1,
                recap: typeof saved.recap === 'string' ? saved.recap : '',
                opening: typeof saved.opening === 'string' ? saved.opening : '',
                content,
                summary: typeof saved.summary === 'string' ? saved.summary : '',
                comments: Array.isArray(saved.comments) ? saved.comments : [],
                cast: Array.isArray(saved.cast) ? saved.cast.map((actor, actorIndex) => this.normalizePlaybackActor(actor, actorIndex)).filter(Boolean) : [],
                messages
            };
        });
        work.episodeCount = work.episodes.length;
        return work.episodes;
    }

    saveCreatedWork() {
        const title = (this.workTitleInput?.value || '').trim();
        if (!title) {
            if (typeof window.showToast === 'function') window.showToast('请输入作品名字');
            return;
        }

        if (this.editingWorkId) {
            const work = this.netflixState.works.find(w => w.id === this.editingWorkId);
            if (work) {
                work.title = title;
                work.coverUrl = this.createDraft.coverUrl || '';
                work.category = this.createDraft.category || '电视剧';
                work.tags = this.parseWorkTags();
                work.cast = this.createDraft.cast.map(actor => ({
                    id: actor.id,
                    type: actor.type,
                    sourceId: actor.sourceId || '',
                    realName: actor.realName || actor.name || '',
                    name: actor.name || actor.realName || '',
                    roleName: actor.roleName || actor.name || actor.realName || '',
                    rolePersona: actor.rolePersona || '',
                    avatar: actor.avatar || ''
                }));
                work.summary = (this.workSummaryInput?.value || '').trim();
            }
            this.saveNetflixState();
            this.renderWorks();
            this.closeCreateFormSheet();
            if (typeof window.showToast === 'function') window.showToast('修改成功');
        } else {
            const work = {
                id: this.createPresetId('work'),
                coverUrl: this.createDraft.coverUrl || '',
                title,
                category: this.createDraft.category || '电视剧',
                tags: this.parseWorkTags(),
                episodeCount: 1,
                cast: this.createDraft.cast.map(actor => ({
                    id: actor.id,
                    type: actor.type,
                    sourceId: actor.sourceId || '',
                    realName: actor.realName || actor.name || '',
                    name: actor.name || actor.realName || '',
                    roleName: actor.roleName || actor.name || actor.realName || '',
                    rolePersona: actor.rolePersona || '',
                    avatar: actor.avatar || ''
                })),
                summary: (this.workSummaryInput?.value || '').trim(),
                series: [],
                episodes: [{ number: 1, recap: '', content: '', summary: '', comments: [], cast: [] }],
                likeCount: 0,
                subscriberCount: 0,
                comments: [],
                createdAt: new Date().toISOString()
            };

            this.netflixState.works.unshift(work);
            this.saveNetflixState();
            this.renderWorks();
            this.closeCreateFormSheet();
            if (typeof window.showToast === 'function') window.showToast('作品创建成功');
        }
    }

    deleteWork() {
        const workId = this.editingWorkId;
        if (!workId) return;
        const work = this.netflixState.works.find(item => String(item.id) === String(workId));
        const title = work?.title || '这部影片';
        if (!window.confirm(`确定要删除“${title}”吗？此操作不可恢复。`)) return;

        this.netflixState.works = this.netflixState.works.filter(item => String(item.id) !== String(workId));
        if (String(this.activeWorkId) === String(workId)) {
            this.activeWorkId = null;
            this.activeEpisodeNumber = 1;
        }
        if (String(this.activePlaybackId) === String(workId)) {
            this.activePlaybackId = null;
            this.activePlaybackEpisodeNumber = 1;
            this.closePlaybackSheet();
        }
        if (String(this.activeDetailWorkId) === String(workId)) {
            this.activeDetailWorkId = null;
            this.activeDetailEpisodeNumber = 1;
            this.closeWorkDetail();
        }
        this.editingWorkId = null;
        this.saveNetflixState();
        this.renderWorks();
        this.closeCreateFormSheet();
        if (typeof window.showToast === 'function') window.showToast('影片已删除');
    }

    renderWorks() {
        const works = (this.netflixState.works || []).map((work, index) => this.normalizeWork(work, `legacy-work-${index}`));
        
        // 渲染“参演影片” (Profile页)
        if (this.actingList) {
            if (!works.length) {
                this.actingList.innerHTML = '<div class="netflix-acting-empty">暂无</div>';
            } else {
                this.actingList.innerHTML = works.map(work => `
                    <button type="button" class="netflix-work-card" data-work-id="${this.escapeHtml(work.id)}" aria-label="查看${this.escapeHtml(work.title || '未命名作品')}">
                        <div class="netflix-work-cover">${work.coverUrl ? `<img src="${work.coverUrl}" alt="">` : '<i class="fas fa-film"></i>'}</div>
                        <div class="netflix-work-title">${this.escapeHtml(work.title || '未命名作品')}</div>
                    </button>
                `).join('');

                this.actingList.querySelectorAll('.netflix-work-card').forEach(card => {
                    card.addEventListener('click', () => this.openWorkDetail(card.getAttribute('data-work-id')));
                });
            }
        }

        // 渲染“我的作品” (Create面板中的列表)
        if (this.createWorksList) {
            if (!works.length) {
                this.createWorksList.innerHTML = '<div style="grid-column:1/-1;color:#888;font-size:14px;padding:20px 0;text-align:center;">您还没有创建任何作品</div>';
            } else {
                this.createWorksList.innerHTML = works.map(work => `
                    <div class="netflix-create-work-item" data-work-id="${this.escapeHtml(work.id)}">
                        <div class="netflix-create-work-item-cover">
                            ${work.coverUrl ? `<img src="${work.coverUrl}" alt="">` : '<i class="fas fa-film"></i>'}
                        </div>
                        <div class="netflix-create-work-item-title">${this.escapeHtml(work.title || '未命名作品')}</div>
                    </div>
                `).join('');

                this.createWorksList.querySelectorAll('.netflix-create-work-item').forEach(card => {
                    card.addEventListener('click', () => this.openPlaybackFromWork(card.getAttribute('data-work-id'), 1));
                });
            }
        }
    }

    normalizeWork(work = {}, fallbackId = this.createPresetId('work')) {
        const safe = work && typeof work === 'object' ? work : {};
        const normalized = {
            ...safe,
            id: safe.id || fallbackId,
            coverUrl: safe.coverUrl || '',
            title: safe.title || '未命名作品',
            category: safe.category || '电视剧',
            tags: Array.isArray(safe.tags) ? safe.tags : [],
            episodeCount: this.parseEpisodeCount(safe.episodeCount),
            cast: Array.isArray(safe.cast) ? safe.cast : [],
            summary: safe.summary || '',
            series: Array.isArray(safe.series) ? safe.series : [],
            likeCount: Number.isFinite(Number(safe.likeCount)) ? Number(safe.likeCount) : 0,
            subscriberCount: Number.isFinite(Number(safe.subscriberCount)) ? Number(safe.subscriberCount) : 0,
            comments: Array.isArray(safe.comments) ? safe.comments : []
        };
        this.ensureWorkEpisodes(normalized);
        return normalized;
    }

    openWorkDetail(workId) {
        const work = (this.netflixState.works || [])
            .map((item, index) => this.normalizeWork(item, `legacy-work-${index}`))
            .find(item => String(item.id) === String(workId));
        if (!work) return;
        this.activeDetailWorkId = work.id;
        this.activeDetailEpisodeNumber = 1;
        this.activeDetailCatalogOnly = false;
        this.renderWorkDetail(work);
        if (this.workDetailSheet) this.workDetailSheet.classList.add('active');
    }

    openCatalogWorkDetail(item) {
        let catalogWork = this.normalizeCatalogWorkForDetail(item);
        if (!catalogWork) return;

        // 如果在 playbackCatalog 中有这个影片的记录，则优先使用它来合并集数和评论
        const playbackEntry = this.getPlaybackEntry(catalogWork.id);
        if (playbackEntry) {
            catalogWork.episodes = playbackEntry.episodes.filter(ep => Number(ep.number) > 0);
            catalogWork.episodeCount = catalogWork.episodes.length || catalogWork.episodeCount;
        }

        this.activeDetailWorkId = catalogWork.id;
        this.activeDetailEpisodeNumber = 1;
        this.activeDetailCatalogOnly = true;
        this.renderWorkDetail(catalogWork);
        if (this.workDetailSheet) this.workDetailSheet.classList.add('active');
    }

    createCatalogItemFromWork(work) {
        return this.normalizeCatalogItem({
            id: work.id,
            title: work.title,
            category: work.category,
            tags: work.tags,
            coverUrl: work.coverUrl,
            summary: work.summary,
            cast: work.cast
        }, work.id, work.category || '');
    }

    createPlaybackEpisodeFromWorkEpisode(episode = {}, fallbackNumber = 1, work = {}) {
        const number = Number(episode.number) > 0 ? Number(episode.number) : fallbackNumber;
        const cast = Array.isArray(episode.cast) && episode.cast.length ? episode.cast : (Array.isArray(work.cast) ? work.cast : []);
        return this.normalizePlaybackEpisode({
            number,
            recap: episode.recap || '',
            content: episode.content || this.getLegacyMessagesContent(episode.messages || ''),
            summary: episode.summary || '',
            comments: Array.isArray(episode.comments) ? episode.comments : [],
            cast,
            createdAt: episode.createdAt || new Date().toISOString()
        }, number);
    }

    createPlaybackEntryFromWork(work) {
        const normalizedWork = this.normalizeWork(work, work?.id || this.createPresetId('work'));
        const item = this.createCatalogItemFromWork(normalizedWork);
        const episodes = normalizedWork.episodes.map((episode, index) => this.createPlaybackEpisodeFromWorkEpisode(episode, index + 1, normalizedWork));
        return this.normalizePlaybackEntry({
            id: item.id,
            item,
            episodes,
            activeEpisodeNumber: 1
        }, item.id);
    }

    mergePlaybackEntryWithWork(entry, workEntry) {
        if (!entry) return workEntry;
        const merged = this.normalizePlaybackEntry({
            ...entry,
            item: { ...entry.item, ...workEntry.item }
        }, workEntry.id);
        const existingByNumber = new Map(merged.episodes.map(episode => [Number(episode.number), episode]));
        workEntry.episodes.forEach(episode => {
            const number = Number(episode.number);
            const existing = existingByNumber.get(number);
            if (!existing || (!existing.content && episode.content)) {
                existingByNumber.set(number, episode);
            }
        });
        merged.episodes = Array.from(existingByNumber.values()).sort((a, b) => Number(a.number) - Number(b.number));
        return this.normalizePlaybackEntry(merged, workEntry.id);
    }

    openPlaybackFromWork(workId, episodeNumber = 1) {
        const work = (this.netflixState.works || [])
            .map((item, index) => this.normalizeWork(item, `legacy-work-${index}`))
            .find(item => String(item.id) === String(workId));
        if (!work) return;

        const workEntry = this.createPlaybackEntryFromWork(work);
        let entry = this.getPlaybackEntry(workEntry.id);
        entry = this.mergePlaybackEntryWithWork(entry, workEntry);

        const requestedNumber = Number(episodeNumber);
        const targetNumber = Number.isFinite(requestedNumber) && entry.episodes.some(episode => Number(episode.number) === requestedNumber)
            ? requestedNumber
            : (entry.episodes.some(episode => Number(episode.number) === 1) ? 1 : 0);

        this.activePlaybackId = entry.id;
        this.activePlaybackEpisodeNumber = targetNumber;
        entry.activeEpisodeNumber = targetNumber;
        this.savePlaybackEntry(entry);
        this.upsertRecentCatalogItem(entry.item);
        this.saveNetflixState();
        this.renderHomeCatalog();
        this.renderPlaybackWindow();
        this.closeWorkDetail();
        if (this.playbackSheet) this.playbackSheet.classList.add('active');
    }

    openPlaybackFromCatalog(item, episodeNumber = null) {
        const catalogItem = this.normalizeCatalogItem(item, item?.id || this.createPresetId('playback'), item?.category || '');
        if (!catalogItem) return;
        let entry = this.getPlaybackEntry(catalogItem.id);
        if (!entry) {
            entry = this.normalizePlaybackEntry({ id: catalogItem.id, item: catalogItem, episodes: [this.createInitialPlaybackEpisode(catalogItem)] }, catalogItem.id);
        } else {
            entry.item = { ...entry.item, ...catalogItem };
            entry = this.normalizePlaybackEntry(entry, entry.id);
        }
        this.activePlaybackId = entry.id;
        const requestedNumber = Number(episodeNumber);
        this.activePlaybackEpisodeNumber = Number.isFinite(requestedNumber) && entry.episodes.some(episode => Number(episode.number) === requestedNumber)
            ? requestedNumber
            : 0;
        entry.activeEpisodeNumber = this.activePlaybackEpisodeNumber;
        this.savePlaybackEntry(entry);
        this.upsertRecentCatalogItem(entry.item);
        this.saveNetflixState();
        this.renderHomeCatalog();
        this.renderPlaybackWindow();
        this.closeWorkDetail();
        if (this.playbackSheet) this.playbackSheet.classList.add('active');
    }

    closePlaybackSheet() {
        if (this.playbackSheet) this.playbackSheet.classList.remove('active');
        this.closePlaybackEpisodeSidebar();
        this.closePlaybackPresetSidebar();
        this.closePlaybackCastSheet();
        this.closePlaybackNextModal(true);
    }

    renderPlaybackWindow() {
        const entry = this.getPlaybackEntry();
        if (!entry || !this.playbackBody) return;
        const episode = entry.episodes.find(item => Number(item.number) === Number(this.activePlaybackEpisodeNumber))
            || entry.episodes.find(item => Number(item.number) === 0)
            || entry.episodes[0];
        this.activePlaybackEpisodeNumber = Number(episode?.number) || 0;
        entry.activeEpisodeNumber = this.activePlaybackEpisodeNumber;
        this.savePlaybackEntry(entry);
        const isIntro = Number(this.activePlaybackEpisodeNumber) === 0;
        if (this.playbackTitle) this.playbackTitle.textContent = `${entry.item.title || '未命名影片'} · ${isIntro ? '影片介绍' : `第 ${this.activePlaybackEpisodeNumber} 集`}`;
        const content = (episode?.content || '').trim() || (isIntro ? '暂无影片介绍' : '暂无正文。点击选集中的“推进本集”生成剧情。');
        const episodeSections = isIntro
            ? `
                <section class="netflix-playback-content">
                    <div class="netflix-playback-section-label">影片介绍</div>
                    <p>${this.escapeHtml(content)}</p>
                </section>
            `
            : `
                <section class="netflix-playback-fixed">
                    <div class="netflix-playback-section-label">前情回顾</div>
                    <p>${this.escapeHtml((episode?.recap || '').trim() || '暂无前情回顾')}</p>
                </section>
                <section class="netflix-playback-content">
                    <div class="netflix-playback-section-label">本集正文</div>
                    <p>${this.escapeHtml(content)}</p>
                </section>
                <section class="netflix-playback-fixed">
                    <div class="netflix-playback-section-label">本集总结</div>
                    <p>${this.escapeHtml((episode?.summary || '').trim() || '暂无本集总结')}</p>
                </section>
            `;
        this.playbackBody.innerHTML = `
            <article class="netflix-playback-reader">
                ${episodeSections}
            </article>
        `;
        this.playbackBody.scrollTop = 0;
    }

    openPlaybackEpisodeSidebar() {
        if (!this.playbackEpisodeSidebar) return;
        this.renderPlaybackEpisodeSidebar();
        this.playbackEpisodeSidebar.classList.add('active');
    }

    closePlaybackEpisodeSidebar() {
        if (this.playbackEpisodeSidebar) this.playbackEpisodeSidebar.classList.remove('active');
    }

    renderPlaybackEpisodeSidebar() {
        if (!this.playbackEpisodeList) return;
        const entry = this.getPlaybackEntry();
        if (!entry) {
            this.playbackEpisodeList.innerHTML = '<div class="netflix-record-empty">暂无影片</div>';
            return;
        }
        this.playbackEpisodeList.innerHTML = entry.episodes.map(episode => `
            <button type="button" class="netflix-episode-item ${Number(episode.number) === Number(this.activePlaybackEpisodeNumber) ? 'active' : ''}" data-episode-number="${episode.number}" aria-label="长按删除">
                <span>${Number(episode.number) === 0 ? '影片介绍' : `第 ${episode.number} 集`}</span>
                <em>${Number(episode.number) === 0 ? '介绍' : (episode.summary ? '已总结' : '未总结')}</em>
            </button>
        `).join('');

        let pressTimer = null;
        let isLongPress = false;

        this.playbackEpisodeList.querySelectorAll('.netflix-episode-item').forEach(button => {
            const parsedNumber = Number(button.getAttribute('data-episode-number'));
            const nextNumber = Number.isFinite(parsedNumber) ? parsedNumber : 0;

            button.addEventListener('pointerdown', (e) => {
                if (e.button !== 0 && e.type !== 'touchstart') return;
                isLongPress = false;
                
                // 第 0 集（影片介绍）不允许删除
                if (nextNumber === 0) return;
                
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    if (window.confirm(`确定要删除播放中的 第 ${nextNumber} 集 吗？这也会从原作品中同步移除。`)) {
                        this.deletePlaybackEpisode(nextNumber);
                    }
                }, 600);
            });

            button.addEventListener('pointerup', () => {
                if (pressTimer) clearTimeout(pressTimer);
                if (!isLongPress) {
                    const latest = this.getPlaybackEntry();
                    if (latest) {
                        latest.activeEpisodeNumber = nextNumber;
                        this.savePlaybackEntry(latest);
                        this.saveNetflixState();
                    }
                    this.activePlaybackEpisodeNumber = nextNumber;
                    this.renderPlaybackWindow();
                    this.renderPlaybackEpisodeSidebar();
                    this.closePlaybackEpisodeSidebar();
                }
            });

            button.addEventListener('pointerleave', () => {
                if (pressTimer) clearTimeout(pressTimer);
            });
            button.addEventListener('pointercancel', () => {
                if (pressTimer) clearTimeout(pressTimer);
            });
        });
    }

    deletePlaybackEpisode(numberToDelete) {
        const entry = this.getPlaybackEntry();
        if (!entry || !entry.episodes) return;
        
        // 至少要保留第0集介绍和第1集
        const normalEpisodes = entry.episodes.filter(ep => Number(ep.number) > 0);
        if (normalEpisodes.length <= 1) {
            if (typeof window.showToast === 'function') window.showToast('这是最后一集，无法删除');
            return;
        }

        // 删除目标集数，并重新编号（忽略第 0 集）
        entry.episodes = entry.episodes.filter(ep => Number(ep.number) !== numberToDelete);
        
        let counter = 1;
        entry.episodes.forEach(ep => {
            if (Number(ep.number) > 0) {
                ep.number = counter;
                counter++;
            }
        });

        // 调整活动集数
        const maxNumber = counter - 1;
        if (this.activePlaybackEpisodeNumber > maxNumber) {
            this.activePlaybackEpisodeNumber = maxNumber;
        } else if (this.activePlaybackEpisodeNumber === numberToDelete) {
            this.activePlaybackEpisodeNumber = Math.max(1, numberToDelete - 1);
        }
        
        entry.activeEpisodeNumber = this.activePlaybackEpisodeNumber;
        
        this.savePlaybackEntry(entry);
        
        const sourceWork = this.syncPlaybackEntryToSourceWork(entry);

        this.saveNetflixState();
        this.renderPlaybackWindow();
        this.renderPlaybackEpisodeSidebar();
        
        // 如果当前作品详情页开着，也要同步更新
        if (this.workDetailSheet && this.workDetailSheet.classList.contains('active') && String(this.activeDetailWorkId) === String(entry.id)) {
            const updatedWork = sourceWork || this.normalizeWork({ ...entry.item, episodes: entry.episodes.filter(ep => Number(ep.number) > 0), episodeCount: maxNumber, isCatalogItem: true }, entry.id);
            this.renderWorkDetail(updatedWork);
        }
        
        if (typeof window.showToast === 'function') window.showToast(`已删除并同步原作品`);
    }

    openPlaybackPresetSidebar() {
        if (!this.playbackPresetSidebar) return;
        this.renderPlaybackPresetSidebar();
        this.playbackPresetSidebar.classList.add('active');
    }

    closePlaybackPresetSidebar() {
        if (this.playbackPresetSidebar) this.playbackPresetSidebar.classList.remove('active');
        this.activePlaybackPresetEditorKey = null;
        this.playbackPresetDraft = null;
    }

    togglePlaybackPresetEditor(categoryKey, itemId, switchKey) {
        if (this.activePlaybackPresetEditorKey === switchKey) {
            this.activePlaybackPresetEditorKey = null;
            this.playbackPresetDraft = null;
            this.renderPlaybackPresetSidebar();
            return;
        }

        const preset = this.getActivePreset();
        const item = (preset.itemsByCategory?.[categoryKey] || []).find(candidate => String(candidate.id) === String(itemId));
        if (!item) return;

        this.activePlaybackPresetEditorKey = switchKey;
        if ((item.key || item.id) === 'wordCount') {
            const range = this.parsePresetWordCount(item.value || '500-800');
            this.playbackPresetDraft = { categoryKey, itemId, min: range.min, max: range.max };
        } else {
            this.playbackPresetDraft = { categoryKey, itemId, value: item.value || '' };
        }
        this.renderPlaybackPresetSidebar();
    }

    renderPlaybackPresetEditor(item) {
        const draft = this.playbackPresetDraft;
        if (!draft) return '';
        const isWordCount = (item.key || item.id) === 'wordCount';
        const fields = isWordCount
            ? `
                <div class="netflix-rps-range">
                    <label>
                        <span>最少字数</span>
                        <input type="number" min="1" step="1" value="${this.escapeAttr(draft.min)}" data-preset-field="min">
                    </label>
                    <label>
                        <span>最多字数</span>
                        <input type="number" min="1" step="1" value="${this.escapeAttr(draft.max)}" data-preset-field="max">
                    </label>
                </div>
            `
            : `<textarea class="netflix-rps-editor-textarea" data-preset-field="value" aria-label="编辑${this.escapeAttr(item.label || '预设')}" placeholder="输入${this.escapeAttr(item.label || '预设')}内容">${this.escapeHtml(draft.value || '')}</textarea>`;

        return `
            <div class="netflix-rps-editor">
                ${fields}
                <div class="netflix-rps-editor-actions">
                    <button type="button" class="netflix-rps-editor-cancel">取消</button>
                    <button type="button" class="netflix-rps-editor-save">保存</button>
                </div>
            </div>
        `;
    }

    savePlaybackPresetEditor() {
        const draft = this.playbackPresetDraft;
        if (!draft) return;
        const preset = this.getActivePreset();
        const item = (preset.itemsByCategory?.[draft.categoryKey] || []).find(candidate => String(candidate.id) === String(draft.itemId));
        if (!item) return;

        if ((item.key || item.id) === 'wordCount') {
            const min = Math.floor(Number(draft.min));
            const max = Math.floor(Number(draft.max));
            if (!Number.isFinite(min) || !Number.isFinite(max) || min < 1 || max < 1) {
                if (typeof window.showToast === 'function') window.showToast('字数必须为正整数');
                return;
            }
            item.value = this.formatPresetWordCount(`${min}-${max}`);
        } else {
            const value = String(draft.value || '').trim();
            if (!value) {
                if (typeof window.showToast === 'function') window.showToast('预设内容不能为空');
                return;
            }
            item.value = value;
        }

        this.savePresetState();
        this.activePlaybackPresetEditorKey = null;
        this.playbackPresetDraft = null;
        this.renderPlaybackPresetSidebar();
        if (typeof window.showToast === 'function') window.showToast('预设已保存');
    }

    renderPlaybackPresetSidebar() {
        if (!this.playbackPresetBody) return;
        const entry = this.getPlaybackEntry();
        if (!entry) {
            this.playbackPresetBody.innerHTML = '<div style="color:#888;font-size:14px;text-align:center;">暂无影片</div>';
            return;
        }
        const preset = this.getActivePreset();
        const definitions = this.getPresetDefinitions();
        const defaultOffKeys = this.getDefaultOffPresetKeys();
        
        const html = this.getPresetCategoryOrder().map(categoryKey => {
            const category = definitions[categoryKey];
            if (!category) return '';
            
            const items = preset.itemsByCategory[categoryKey] || [];
            if (items.length === 0) return '';
            
            const itemsHtml = items.map(item => {
                const switchKey = `${categoryKey}:${item.id}`;
                const saved = preset.switchState?.[switchKey];
                const isActive = typeof saved === 'boolean' ? saved : !defaultOffKeys.has(item.key || item.id);
                const isExpanded = this.activePlaybackPresetEditorKey === switchKey;
                return `
                <div class="netflix-rps-item-shell ${isExpanded ? 'expanded' : ''}">
                    <div class="netflix-rps-item">
                        <button type="button" class="netflix-rps-item-toggle" data-category="${this.escapeAttr(categoryKey)}" data-item-id="${this.escapeAttr(item.id)}" data-switch-key="${this.escapeAttr(switchKey)}" aria-expanded="${isExpanded}">
                            <span class="netflix-rps-item-label">${this.escapeHtml(item.label || '未命名')}</span>
                            <i class="fas fa-chevron-down netflix-rps-item-chevron"></i>
                        </button>
                        <button type="button" class="netflix-rps-switch ${isActive ? 'active' : ''}" role="switch" aria-checked="${isActive}" aria-label="启用${this.escapeAttr(item.label || '预设')}" data-switch-key="${this.escapeAttr(switchKey)}"></button>
                    </div>
                    ${isExpanded ? this.renderPlaybackPresetEditor(item) : ''}
                </div>
            `;
            }).join('');

            return `
                <div class="netflix-rps-category">
                    <h4>${category.label}</h4>
                    ${itemsHtml}
                </div>
            `;
        }).join('');
        
        this.playbackPresetBody.innerHTML = html || '<div style="color:#888;font-size:14px;text-align:center;">暂无预设条目</div>';

        this.playbackPresetBody.querySelectorAll('.netflix-rps-item-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                this.togglePlaybackPresetEditor(
                    toggle.getAttribute('data-category'),
                    toggle.getAttribute('data-item-id'),
                    toggle.getAttribute('data-switch-key')
                );
            });
        });
        
        this.playbackPresetBody.querySelectorAll('.netflix-rps-switch').forEach(switchEl => {
            switchEl.addEventListener('click', event => {
                event.stopPropagation();
                switchEl.classList.toggle('active');
                switchEl.setAttribute('aria-checked', String(switchEl.classList.contains('active')));
                if (!preset.switchState) preset.switchState = {};
                preset.switchState[switchEl.getAttribute('data-switch-key')] = switchEl.classList.contains('active');
                this.savePresetState();
            });
        });

        this.playbackPresetBody.querySelectorAll('[data-preset-field]').forEach(input => {
            input.addEventListener('input', () => {
                if (!this.playbackPresetDraft) return;
                this.playbackPresetDraft[input.getAttribute('data-preset-field')] = input.value;
            });
        });

        this.playbackPresetBody.querySelector('.netflix-rps-editor-cancel')?.addEventListener('click', () => {
            this.activePlaybackPresetEditorKey = null;
            this.playbackPresetDraft = null;
            this.renderPlaybackPresetSidebar();
        });
        this.playbackPresetBody.querySelector('.netflix-rps-editor-save')?.addEventListener('click', () => this.savePlaybackPresetEditor());
    }

    openPlaybackCastSheet() {
        const entry = this.getPlaybackEntry();
        if (!entry) return;
        const episode = entry.episodes.find(item => Number(item.number) === Number(this.activePlaybackEpisodeNumber)) || entry.episodes[0];
        if (episode && (!Array.isArray(episode.cast) || !episode.cast.length)) {
            const previous = entry.episodes
                .filter(item => Number(item.number) < Number(episode.number) && Number(item.number) >= 0 && Array.isArray(item.cast) && item.cast.length)
                .slice(-1)[0];
            episode.cast = previous ? previous.cast.map(actor => ({ ...actor, id: this.createPresetId('cast') })) : this.createDefaultPlaybackCast();
            this.savePlaybackEntry(entry);
            this.syncPlaybackEntryToSourceWork(entry);
            this.saveNetflixState();
        }
        this.renderPlaybackCastSheet();
        if (this.playbackCastSheet) this.playbackCastSheet.classList.add('active');
    }

    closePlaybackCastSheet() {
        if (this.playbackCastSheet) this.playbackCastSheet.classList.remove('active');
    }

    renderPlaybackCastSheet() {
        if (!this.playbackCastList) return;
        const entry = this.getPlaybackEntry();
        const episode = this.getActivePlaybackEpisode();
        if (!entry || !episode) {
            this.playbackCastList.innerHTML = '<div class="netflix-actor-empty">暂无影片</div>';
            return;
        }
        const cast = Array.isArray(episode.cast) ? episode.cast : [];
        this.playbackCastList.innerHTML = cast.length ? cast.map(actor => `
            <div class="netflix-playback-cast-item" data-cast-id="${this.escapeHtml(actor.id)}">
                <button type="button" class="netflix-cast-avatar netflix-playback-cast-avatar" aria-label="更换头像">
                    ${actor.avatar ? `<img src="${this.escapeAttr(actor.avatar)}" alt="">` : `<span>${this.escapeHtml((actor.realName || actor.name || '?').charAt(0))}</span>`}
                    <i class="fas fa-camera"></i>
                </button>
                <input type="file" class="netflix-playback-cast-avatar-input" accept="image/*">
                <div class="netflix-cast-meta">
                    <label>
                        <span>名字</span>
                        <input type="text" data-field="realName" value="${this.escapeHtml(actor.realName || '')}" placeholder="演员名">
                    </label>
                    <label>
                        <span>饰演</span>
                        <input type="text" data-field="roleName" value="${this.escapeHtml(actor.roleName || '')}" placeholder="角色名">
                    </label>
                    <label>
                        <span>人设</span>
                        <textarea data-field="rolePersona" placeholder="角色人设">${this.escapeHtml(actor.rolePersona || '')}</textarea>
                    </label>
                </div>
                <button type="button" class="netflix-playback-cast-delete" aria-label="删除主演"><i class="fas fa-times"></i></button>
            </div>
        `).join('') : '<div class="netflix-actor-empty">暂无本集主演</div>';

        this.playbackCastList.querySelectorAll('[data-field]').forEach(input => {
            input.addEventListener('input', () => {
                const row = input.closest('.netflix-playback-cast-item');
                const actorId = row?.getAttribute('data-cast-id');
                const field = input.getAttribute('data-field');
                this.updatePlaybackCastMember(actorId, field, input.value);
            });
        });
        this.playbackCastList.querySelectorAll('.netflix-playback-cast-avatar').forEach(button => {
            button.addEventListener('click', () => {
                const input = button.closest('.netflix-playback-cast-item')?.querySelector('.netflix-playback-cast-avatar-input');
                input?.click();
            });
        });
        this.playbackCastList.querySelectorAll('.netflix-playback-cast-avatar-input').forEach(input => {
            input.addEventListener('change', () => {
                const actorId = input.closest('.netflix-playback-cast-item')?.getAttribute('data-cast-id');
                this.handlePlaybackCastAvatarFile(actorId, input);
            });
        });
        this.playbackCastList.querySelectorAll('.netflix-playback-cast-delete').forEach(button => {
            button.addEventListener('click', () => {
                const actorId = button.closest('.netflix-playback-cast-item')?.getAttribute('data-cast-id');
                this.deletePlaybackCastMember(actorId);
            });
        });
    }

    addPlaybackCastMember() {
        const entry = this.getPlaybackEntry();
        const episode = this.getActivePlaybackEpisode();
        if (!entry || !episode) return;
        if (!Array.isArray(episode.cast)) episode.cast = [];
        episode.cast.push({
            id: this.createPresetId('cast'),
            realName: '新主演',
            name: '新主演',
            roleName: '新角色',
            rolePersona: '',
            avatar: ''
        });
        const stored = this.getPlaybackEntry();
        const storedEpisode = stored?.episodes.find(item => Number(item.number) === Number(episode.number));
        if (storedEpisode) storedEpisode.cast = episode.cast;
        const latest = stored || entry;
        this.savePlaybackEntry(latest);
        this.syncPlaybackEntryToSourceWork(latest);
        this.saveNetflixState();
        this.renderPlaybackCastSheet();
    }

    updatePlaybackCastMember(actorId, field, value) {
        const entry = this.getPlaybackEntry();
        const episode = this.getActivePlaybackEpisode();
        if (!entry || !episode || !actorId || !field) return;
        const target = episode.cast?.find(actor => String(actor.id) === String(actorId));
        if (!target || !['realName', 'roleName', 'rolePersona'].includes(field)) return;
        target[field] = value;
        if (field === 'realName') target.name = value;
        const stored = this.getPlaybackEntry();
        const storedEpisode = stored?.episodes.find(item => Number(item.number) === Number(episode.number));
        if (storedEpisode) storedEpisode.cast = episode.cast;
        const latest = stored || entry;
        this.savePlaybackEntry(latest);
        this.syncPlaybackEntryToSourceWork(latest);
        this.saveNetflixState();
    }

    handlePlaybackCastAvatarFile(actorId, input) {
        const file = input?.files?.[0];
        if (!file || !actorId) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const avatar = event.target?.result;
            if (!avatar) return;
            const entry = this.getPlaybackEntry();
            const episode = this.getActivePlaybackEpisode();
            if (!entry || !episode) return;
            const target = episode.cast?.find(actor => String(actor.id) === String(actorId));
            if (!target) return;
            target.avatar = String(avatar);
            const stored = this.getPlaybackEntry();
            const storedEpisode = stored?.episodes.find(item => Number(item.number) === Number(episode.number));
            if (storedEpisode) storedEpisode.cast = episode.cast;
            const latest = stored || entry;
            this.savePlaybackEntry(latest);
            this.syncPlaybackEntryToSourceWork(latest);
            this.saveNetflixState();
            this.renderPlaybackCastSheet();
        };
        reader.readAsDataURL(file);
        input.value = '';
    }

    deletePlaybackCastMember(actorId) {
        const entry = this.getPlaybackEntry();
        const episode = this.getActivePlaybackEpisode();
        if (!entry || !episode || !actorId) return;
        episode.cast = (episode.cast || []).filter(actor => String(actor.id) !== String(actorId));
        const stored = this.getPlaybackEntry();
        const storedEpisode = stored?.episodes.find(item => Number(item.number) === Number(episode.number));
        if (storedEpisode) storedEpisode.cast = episode.cast;
        const latest = stored || entry;
        this.savePlaybackEntry(latest);
        this.syncPlaybackEntryToSourceWork(latest);
        this.saveNetflixState();
        this.renderPlaybackCastSheet();
    }

    openPlaybackNextModal(actionType = 'advance') {
        if (!this.getPlaybackEntry()) return;
        this.currentPlaybackModalAction = actionType;
        if (this.playbackNextInput) {
            this.playbackNextInput.value = '';
            this.playbackNextInput.placeholder = actionType === 'advance' 
                ? '输入接下来本集剧情的发展方向，可留空自由推进...' 
                : '（可选）输入对整个这一集的杀青补充设定，即将生成前情回顾与评论区...';
        }
        const titleEl = this.playbackNextModal?.querySelector('.netflix-record-modal-title');
        if (titleEl) {
            titleEl.textContent = actionType === 'advance' ? '推进本集' : '完成本集并开启下一集';
        }
        if (this.playbackNextModal) this.playbackNextModal.classList.add('active');
        setTimeout(() => this.playbackNextInput?.focus(), 0);
    }

    handlePlaybackModalConfirm() {
        if (this.currentPlaybackModalAction === 'advance') {
            this.generateAdvancePlaybackEpisode();
        } else {
            this.generateNextPlaybackEpisode();
        }
    }

    closePlaybackNextModal(force = false) {
        if (this.isPlaybackNextLoading && !force) return;
        if (this.playbackNextModal) this.playbackNextModal.classList.remove('active');
    }

    setPlaybackNextLoading(isLoading) {
        this.isPlaybackNextLoading = !!isLoading;
        if (this.playbackNextInput) this.playbackNextInput.disabled = this.isPlaybackNextLoading;
        if (this.playbackNextClose) this.playbackNextClose.disabled = this.isPlaybackNextLoading;
        if (this.playbackNextConfirm) {
            this.playbackNextConfirm.disabled = this.isPlaybackNextLoading;
            this.playbackNextConfirm.innerHTML = this.isPlaybackNextLoading
                ? '<i class="fas fa-spinner fa-spin"></i> 生成中'
                : '确定';
        }
    }

    getPlaybackPresetContext(entry) {
        return this.getGlobalPresetContext();
    }

    getGlobalPresetContext() {
        const preset = this.getActivePreset();
        const definitions = this.getPresetDefinitions();
        const defaultOffKeys = this.getDefaultOffPresetKeys();
        const lines = [];
        this.getPresetCategoryOrder().forEach(categoryKey => {
            const category = definitions[categoryKey];
            const items = preset.itemsByCategory[categoryKey] || [];
            items.forEach(item => {
                const switchKey = `${categoryKey}:${item.id}`;
                const saved = preset.switchState?.[switchKey];
                const isActive = typeof saved === 'boolean' ? saved : !defaultOffKeys.has(item.key || item.id);
                if (isActive && item.value) {
                    lines.push(this.formatPresetContextLine(item, category?.label || categoryKey));
                }
            });
        });
        return lines.join('\n');
    }

    formatPresetContextLine(item, categoryLabel = '') {
        if ((item.key || item.id) === 'wordCount') {
            return `字数要求：${this.formatPresetWordCount(item.value)}字`;
        }
        return `[${categoryLabel} / ${item.label || '未命名'}] ${item.value}`;
    }

    getPresetWordCountText(preset = this.getActivePreset()) {
        const item = (preset?.itemsByCategory?.length || preset?.itemsByCategory?.narration || [])
            .find(candidate => (candidate.key || candidate.id) === 'wordCount');
        return `${this.formatPresetWordCount(item?.value || '500-800')}字`;
    }

    getPlaybackWordCountText(entry) {
        return this.getPresetWordCountText(this.getActivePreset(), entry);
    }

    createPlaybackAdvancePrompt(entry, currentEpisode, direction) {
        const work = entry.item || {};
        const tags = Array.isArray(work.tags) && work.tags.length ? work.tags.join('、') : '无';
        const cast = Array.isArray(currentEpisode.cast) ? currentEpisode.cast : [];
        const isIntro = Number(currentEpisode.number) === 0;
        const wordCountText = this.getPlaybackWordCountText(entry);
        const castText = cast.length
            ? cast.map(actor => `- ${actor.realName || actor.name || '未知'} 饰 ${actor.roleName || actor.name || '未知'}${actor.rolePersona ? `\n  人设: ${actor.rolePersona}` : ''}`).join('\n')
            : '无';
        const worldBookContext = this.getMountedWorldBookContext();
        const presetContext = this.getPlaybackPresetContext(entry);
        return `【系统提示】
你正在为 Netflix 生成影片播放页创作本集的后续正文内容。请以电影感、小说叙事的方式写作，直接推进当前集的剧情。

${worldBookContext ? `【世界书】\n${worldBookContext}\n\n` : ''}【作品信息】
作品名: ${work.title || '未命名影片'}
分类: ${work.category || '未知'}
标签: ${tags}
简介: ${work.summary || '无'}

【本集出场主演】
${castText}

${presetContext ? `【启用的预设】\n${presetContext}\n\n` : ''}${isIntro ? '【影片介绍】' : '【本集前情回顾】'}
${isIntro ? (currentEpisode.content || work.summary || '无') : (currentEpisode.recap || '无')}

【本集已有正文】
${currentEpisode.content || '暂无内容，请开始撰写本集开局。'}

【用户输入的接下来剧情走向】
${direction || '无，允许自由推进。'}

【任务】
请续写本集正文，需要满足字数要求：${wordCountText}。请严格返回 JSON 格式，不要包含 Markdown 标记或多余的解释说明：
{
  "content": "电影感正文的续写部分，${wordCountText}"
}`;
    }

    async generateAdvancePlaybackEpisode() {
        if (this.isPlaybackNextLoading) return;
        const apiConfig = this.getNetflixApiConfig();
        if (!apiConfig || !apiConfig.endpoint || !apiConfig.apiKey) {
            if (typeof window.showToast === 'function') window.showToast('请先在设置中配置大模型 API');
            return;
        }
        const entry = this.getPlaybackEntry();
        const currentEpisode = this.getActivePlaybackEpisode();
        if (!entry || !currentEpisode) return;

        const direction = (this.playbackNextInput?.value || '').trim();
        this.setPlaybackNextLoading(true);
        try {
            const endpoint = this.resolveChatCompletionsEndpoint(apiConfig.endpoint);
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: apiConfig.model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: this.createPlaybackAdvancePrompt(entry, currentEpisode, direction) }],
                    temperature: parseFloat(apiConfig.temperature) || 0.8,
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) throw new Error(`API Request Failed: ${response.status}`);
            const data = await response.json();
            const parsed = this.parseJsonFromText(data.choices?.[0]?.message?.content || '');
            const additionalContent = String(parsed.content || '').trim();
            if (!additionalContent) throw new Error('Playback advance response is incomplete');

            const latest = this.getPlaybackEntry(entry.id) || entry;
            const latestCurrent = latest.episodes.find(item => Number(item.number) === Number(currentEpisode.number)) || currentEpisode;
            
            // 追加正文
            latestCurrent.content = latestCurrent.content ? `${latestCurrent.content}\n\n${additionalContent}` : additionalContent;

            this.savePlaybackEntry(latest);
            const sourceWork = this.syncPlaybackEntryToSourceWork(latest);
            this.saveNetflixState();
            this.renderWorks();
            if (this.workDetailSheet && this.workDetailSheet.classList.contains('active') && String(this.activeDetailWorkId) === String(latest.id)) {
                const fallbackWork = this.normalizeWork({
                    ...latest.item,
                    episodes: this.getSerializablePlaybackEpisodes(latest),
                    episodeCount: this.getSerializablePlaybackEpisodes(latest).length,
                    isCatalogItem: true
                }, latest.id);
                this.renderWorkDetail(sourceWork || fallbackWork);
            }
            this.renderPlaybackWindow();
            this.closePlaybackNextModal(true);
            if (typeof window.showToast === 'function') window.showToast('本集剧情已推进');
        } catch (error) {
            console.error('Netflix playback advance episode failed:', error);
            if (typeof window.showToast === 'function') window.showToast('剧情推进失败，请检查 API 或网络');
        } finally {
            this.setPlaybackNextLoading(false);
        }
    }

    createPlaybackNextPrompt(entry, currentEpisode, direction) {
        const work = entry.item || {};
        const tags = Array.isArray(work.tags) && work.tags.length ? work.tags.join('、') : '无';
        const cast = Array.isArray(currentEpisode.cast) ? currentEpisode.cast : [];
        const isIntro = Number(currentEpisode.number) === 0;
        const castText = cast.length
            ? cast.map(actor => `- ${actor.realName || actor.name || '未知'} 饰 ${actor.roleName || actor.name || '未知'}${actor.rolePersona ? `\n  人设: ${actor.rolePersona}` : ''}`).join('\n')
            : '无';
        const worldBookContext = this.getMountedWorldBookContext();
        return `【系统提示】
你正在处理一场影视剧集的播放页杀青阶段。请根据以下作品信息、世界观以及本集的完整内容，完成以下两项任务：
1. 提取本集的核心情节与戏剧张力，用电影级、小说感（第三人称）的叙事风格写一段约 200 字左右的精炼前情回顾，为下一集的开场铺垫悬念和气氛。同时写一段 100 字以内的本集总结。
2. 扮演不同类型的真实观众（细节党、考据党、CP粉、颜狗、剧情粉、喷子等），针对本集具体情节和人物表现，生成 5 到 10 条主楼评论。每条主楼可附带 0 到 2 条楼中楼回复（replies）。
   要求：
   - 字数差异化：有极短的情绪宣泄（如 10 字以内，“啊啊啊绝了！”），也有较长的剧情分析或吐槽（10-30 字左右）。
   - 强真实感：口语化、玩梗、带点饭圈黑话或网络流行语，必须严格结合剧情内容发散。不要像机器人一样官方点评。

${worldBookContext ? `【世界书】\n${worldBookContext}\n\n` : ''}【作品信息】
作品名: ${work.title || '未命名影片'}
分类: ${work.category || '未知'}
标签: ${tags}
简介: ${work.summary || '无'}

【本集出场主演】
${castText}

${isIntro ? '【影片介绍】' : '【本集前情回顾】'}
${isIntro ? (currentEpisode.content || work.summary || '无') : (currentEpisode.recap || '无')}

【本集完整正文】
${currentEpisode.content || '无'}

【用户对整集的附加设定说明】
${direction || '无'}

【任务】
请严格返回 JSON 格式，不要包含 Markdown 标记或多余解释说明：
{
  "summary": "100字内本集总结",
  "recap": "200字左右的精炼前情回顾，悬念迭起、电影感十足...",
  "comments": [
    {
      "name": "极光追逐者",
      "text": "天哪这集XX的那个眼神简直绝了！谁懂啊！",
      "likes": 2304,
      "replies": [
        { "name": "吃瓜群众甲", "text": "对对对，我看的时候也尖叫了！", "likes": 128 }
      ]
    }
  ]
}`;
    }

    getNextPlaybackEpisodeNumber(entry) {
        const numbers = (entry?.episodes || [])
            .map(episode => Number(episode.number))
            .filter(number => Number.isFinite(number) && number > 0);
        return numbers.length ? Math.max(...numbers) + 1 : 1;
    }

    async generateNextPlaybackEpisode() {
        if (this.isPlaybackNextLoading) return;
        const apiConfig = typeof window.getApiConfig === 'function' ? window.getApiConfig() : (window.apiConfig || {});
        if (!apiConfig || !apiConfig.endpoint || !apiConfig.apiKey) {
            if (typeof window.showToast === 'function') window.showToast('请先在设置中配置大模型 API');
            return;
        }
        const entry = this.getPlaybackEntry();
        const currentEpisode = this.getActivePlaybackEpisode();
        if (!entry || !currentEpisode) return;

        const direction = (this.playbackNextInput?.value || '').trim();
        this.setPlaybackNextLoading(true);
        try {
            const endpoint = this.resolveChatCompletionsEndpoint(apiConfig.endpoint);
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: apiConfig.model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: this.createPlaybackNextPrompt(entry, currentEpisode, direction) }],
                    temperature: parseFloat(apiConfig.temperature) || 0.8,
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) throw new Error(`API Request Failed: ${response.status}`);
            const data = await response.json();
            const parsed = this.parseJsonFromText(data.choices?.[0]?.message?.content || '');
            const summary = String(parsed.summary || '').trim();
            const recapText = String(parsed.recap || '').trim();
            const generatedComments = Array.isArray(parsed.comments) ? parsed.comments : [];

            if (!summary && !recapText) throw new Error('Playback episode finish response is incomplete');

            const latest = this.getPlaybackEntry(entry.id) || entry;
            const latestCurrent = latest.episodes.find(item => Number(item.number) === Number(currentEpisode.number)) || currentEpisode;
            
            // 写入当前集的总结和评论
            latestCurrent.summary = summary;
            latestCurrent.comments = generatedComments.map(c => {
                const replies = Array.isArray(c.replies) ? c.replies.map(r => ({
                    name: String(r.name || '网友').trim(),
                    text: String(r.text || r.content || '').trim(),
                    likes: Number(r.likes) || Math.floor(Math.random() * 50)
                })).filter(r => r.text) : [];
                return {
                    name: String(c.name || '热心网友').trim(),
                    text: String(c.text || c.content || '').trim(),
                    likes: Number(c.likes) || Math.floor(Math.random() * 1000),
                    replies
                };
            }).filter(c => c.text);

            // 建立下一集
            const nextNumber = this.getNextPlaybackEpisodeNumber(latest);
            const inheritedCast = (latestCurrent.cast && latestCurrent.cast.length ? latestCurrent.cast : this.createDefaultPlaybackCast())
                .map(actor => ({ ...actor, id: this.createPresetId('cast') }));
            
            latest.episodes.push({
                number: nextNumber,
                recap: recapText,
                content: '',
                summary: '',
                comments: [],
                cast: inheritedCast,
                createdAt: new Date().toISOString()
            });

            latest.activeEpisodeNumber = nextNumber;
            this.activePlaybackEpisodeNumber = nextNumber;
            this.savePlaybackEntry(latest);
            this.upsertRecentCatalogItem(latest.item);
            const sourceWork = this.syncPlaybackEntryToSourceWork(latest);

            this.saveNetflixState();
            this.renderHomeCatalog();
            this.renderWorks(); // 重新渲染我的作品

            // 如果当前是从详情页打开的，同步更新详情页
            if (this.workDetailSheet && this.workDetailSheet.classList.contains('active') && String(this.activeDetailWorkId) === String(latest.id)) {
                const serializableEpisodes = this.getSerializablePlaybackEpisodes(latest);
                const updatedWork = sourceWork || this.normalizeWork({ ...latest.item, episodes: serializableEpisodes, episodeCount: serializableEpisodes.length, isCatalogItem: true }, latest.id);
                this.renderWorkDetail(updatedWork);
            }

            this.renderPlaybackWindow();
            this.renderPlaybackEpisodeSidebar();
            this.closePlaybackNextModal(true);
            if (typeof window.showToast === 'function') window.showToast('本集已结束，生成前情回顾与评论，并进入下一集');
        } catch (error) {
            console.error('Netflix playback finish episode failed:', error);
            if (typeof window.showToast === 'function') window.showToast('完成本集生成失败，请检查 API 或网络');
        } finally {
            this.setPlaybackNextLoading(false);
        }
    }

    normalizeCatalogWorkForDetail(item) {
        const catalogItem = this.normalizeCatalogItem(item, item?.id || this.createPresetId('catalog-detail'), item?.category || '');
        if (!catalogItem) return null;
        return this.normalizeWork({
            ...catalogItem,
            episodeCount: catalogItem.category === '电影' ? 1 : 6,
            cast: Array.isArray(catalogItem.cast) ? catalogItem.cast : [],
            comments: [],
            episodes: [],
            isCatalogItem: true
        }, catalogItem.id);
    }

    closeWorkDetail() {
        if (this.workDetailSheet) this.workDetailSheet.classList.remove('active');
        this.activeDetailCatalogOnly = false;
    }

    renderWorkDetail(work) {
        if (!this.workDetailContent) return;
        const tags = [work.category, ...(work.tags || [])].filter(Boolean);
        const tagText = tags.join(' • ');
        this.ensureWorkEpisodes(work);
        const detailEpisodeNumber = this.getDetailEpisodeNumber(work);
        const detailCommentsCount = this.getEpisodeComments(work, detailEpisodeNumber).length;
        
        let castHtml = '';
        if (work.cast && work.cast.length) {
            castHtml = `
                <div class="netflix-wd-cast-scroll">
                    ${work.cast.map(actor => {
                        const actorName = actor.realName || actor.name || '未知';
                        const roleName = actor.roleName || actor.name || '';
                        const avatarContent = actor.avatar ? `<img src="${this.escapeAttr(actor.avatar)}" alt="">` : this.escapeHtml(actorName.charAt(0));
                        return `
                        <div class="netflix-wd-cast-item">
                            <div class="netflix-wd-cast-avatar">${avatarContent}</div>
                            <div class="netflix-wd-cast-name">${this.escapeHtml(actorName)}</div>
                            ${roleName ? `<div class="netflix-wd-cast-role">饰 ${this.escapeHtml(roleName)}</div>` : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else {
            castHtml = '<div style="font-size:12px;color:#bcbcbc;margin-bottom:16px;">暂无演员记录</div>';
        }
            
        const isMovie = (work.category || '') === '电影';
        const epCount = this.parseEpisodeCount(work.episodeCount);
        const episodesHtml = this.renderEpisodeList(work, isMovie, epCount, detailEpisodeNumber);
        const commentsHtml = this.renderWorkComments(work, detailEpisodeNumber);
        
        // 模拟随机的年份和匹配度
        const matchScore = Math.floor(Math.random() * (99 - 80) + 80);
        const year = new Date().getFullYear() - Math.floor(Math.random() * 5);

        this.workDetailContent.innerHTML = `
            <div class="netflix-wd-hero">
                ${work.coverUrl ? `<img src="${this.escapeAttr(work.coverUrl)}" alt="">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#555;font-size:40px;"><i class="fas fa-film"></i></div>'}
                <div class="netflix-wd-hero-fade"></div>
                <div class="netflix-wd-close" onclick="window.netflixApp && window.netflixApp.closeWorkDetail()">
                    <i class="fas fa-times"></i>
                </div>
            </div>

            <div class="netflix-wd-body">
                <h2 class="netflix-wd-title">${this.escapeHtml(work.title || '未命名作品')}</h2>
                
                <div class="netflix-wd-meta">
                    <span class="netflix-wd-meta-match">${matchScore}% 匹配</span>
                    <span>${year}</span>
                    <span class="netflix-wd-meta-age">16+</span>
                    <span>${isMovie ? '1 小时 58 分钟' : `${epCount} 集`}</span>
                    <span class="netflix-wd-meta-hd">HD</span>
                </div>

                <button class="netflix-wd-btn-play" id="netflix-wd-play-btn"><i class="fas fa-play"></i> 播放</button>
                <button class="netflix-wd-btn-download"><i class="fas fa-download"></i> 下载</button>

                <p class="netflix-wd-summary">${this.escapeHtml(work.summary || '这是一部精彩的影视作品，讲述了令人着迷的故事，充满反转与惊喜。在追寻真相的路上，主角们经历了重重考验。')}</p>
                
                <div class="netflix-wd-cast-tags">
                    <div style="margin-bottom:8px;">主演：</div>
                    ${castHtml}
                    <div>类型：<span>${this.escapeHtml(tagText || '未知')}</span></div>
                </div>

                <div class="netflix-wd-actions">
                    <div class="netflix-wd-action-item">
                        <i class="fas fa-plus"></i>
                        <span>我的列表</span>
                    </div>
                    <div class="netflix-wd-action-item">
                        <i class="far fa-thumbs-up"></i>
                        <span>评价</span>
                    </div>
                    <div class="netflix-wd-action-item">
                        <i class="fas fa-share-alt"></i>
                        <span>分享</span>
                    </div>
                </div>

                <div class="netflix-wd-tabs">
                    <div class="netflix-wd-tab active">相关内容</div>
                    <div class="netflix-wd-tab">更多影片</div>
                </div>

                ${!isMovie ? `
                <div class="netflix-wd-episodes-header">
                    <select>
                        <option>第 1 季</option>
                    </select>
                </div>
                ` : ''}

                <div class="netflix-wd-episode-list">
                    ${episodesHtml}
                </div>

                <div class="netflix-wd-tabs" style="margin-top: 30px;">
                    <div class="netflix-wd-tab active">第 ${detailEpisodeNumber} 集评论区 (${detailCommentsCount})</div>
                </div>
                <div class="netflix-wd-comments-list">
                    ${commentsHtml}
                </div>
            </div>
        `;

        this.workDetailContent.querySelectorAll('.netflix-wd-episode-item').forEach(item => {
            item.addEventListener('click', () => {
                this.activeDetailEpisodeNumber = Number(item.getAttribute('data-episode-number')) || 1;
                const latestWork = (this.netflixState.works || []).find(candidate => String(candidate.id) === String(work.id)) || work;
                this.renderWorkDetail(this.normalizeWork(latestWork, work.id));
            });
        });
        this.workDetailContent.querySelector('#netflix-wd-play-btn')?.addEventListener('click', () => {
            if (work.isCatalogItem || this.activeDetailCatalogOnly) {
                this.openPlaybackFromCatalog(work);
                return;
            }
            this.openPlaybackFromWork(work.id, detailEpisodeNumber);
        });
    }

    getDetailEpisodeNumber(work) {
        const episodes = this.ensureWorkEpisodes(work);
        const max = Math.max(1, episodes.length || 1);
        return Math.min(Math.max(1, Number(this.activeDetailEpisodeNumber) || 1), max);
    }

    getEpisodeComments(work, episodeNumber = 1) {
        this.ensureWorkEpisodes(work);
        const episode = work.episodes.find(item => Number(item.number) === Number(episodeNumber));
        const comments = Array.isArray(episode?.comments) ? episode.comments : [];
        if (Number(episodeNumber) === 1 && comments.length === 0 && Array.isArray(work.comments)) {
            return work.comments;
        }
        return comments;
    }

    renderEpisodeList(work, isMovie, count, activeEpisodeNumber = 1) {
        this.ensureWorkEpisodes(work);
        
        if (isMovie || count <= 1) {
            const episode = work.episodes[0] || {};
            const desc = (episode.summary || episode.recap || episode.content || work.summary || '点击立即播放完整影片。体验沉浸式的视听盛宴。').trim();
            return `
                <div class="netflix-wd-episode-item ${Number(activeEpisodeNumber) === 1 ? 'active' : ''}" data-episode-number="1">
                    <div class="netflix-wd-ep-img">
                        ${work.coverUrl ? `<img src="${work.coverUrl}" alt="">` : ''}
                        <i class="fas fa-play-circle"></i>
                    </div>
                    <div class="netflix-wd-ep-info">
                        <div class="netflix-wd-ep-head">
                            <span class="netflix-wd-ep-title">正片</span>
                            <span class="netflix-wd-ep-duration">1 小时 58 分钟</span>
                        </div>
                        <div class="netflix-wd-ep-desc">${this.escapeHtml(desc)}</div>
                    </div>
                </div>
            `;
        }
        
        return Array.from({ length: count }, (_, i) => {
            const epNum = i + 1;
            const episode = work.episodes.find(ep => Number(ep.number) === epNum) || {};
            const duration = Math.floor(Math.random() * (55 - 42) + 42); // 42-55 minutes
            const desc = (episode.summary || episode.recap || episode.content || '随着故事的深入，新的线索逐渐浮出水面，角色面临着前所未有的艰难抉择。').trim();
            
            return `
                <div class="netflix-wd-episode-item ${Number(activeEpisodeNumber) === epNum ? 'active' : ''}" data-episode-number="${epNum}">
                    <div class="netflix-wd-ep-img">
                        ${work.coverUrl ? `<img src="${work.coverUrl}" alt="">` : ''}
                        <i class="fas fa-play-circle"></i>
                        <div class="netflix-progress-bar" style="height: 2px;"><div class="netflix-progress-fill" style="width: ${i === 0 ? '100%' : i === 1 ? '45%' : '0'};"></div></div>
                    </div>
                    <div class="netflix-wd-ep-info">
                        <div class="netflix-wd-ep-head">
                            <span class="netflix-wd-ep-title">${epNum}. 第 ${epNum} 集</span>
                            <span class="netflix-wd-ep-duration">${duration} 分钟</span>
                        </div>
                        <div class="netflix-wd-ep-desc">${this.escapeHtml(desc)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderWorkComments(work, episodeNumber = 1) {
        const comments = this.getEpisodeComments(work, episodeNumber);
        if (!comments.length) {
            return `
                <div class="netflix-comment-empty">
                    <i class="far fa-comment-dots"></i>
                    <p>成为第一个评价的人吧。</p>
                </div>
            `;
        }

        const formatLikes = (num) => {
            if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
            return num;
        };

        const renderCommentBlock = (comment, isReply = false) => {
            const avatarSeed = encodeURIComponent(comment.name || 'user');
            const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${avatarSeed}&backgroundColor=transparent`;
            const likesStr = formatLikes(comment.likes || Math.floor(Math.random() * 100));
            const timeStr = Math.floor(Math.random() * 24) + '小时前';

            return `
                <div class="netflix-comment-item ${isReply ? 'is-reply' : ''}">
                    <div class="netflix-comment-avatar">
                        <img src="${avatarUrl}" alt="avatar">
                    </div>
                    <div class="netflix-comment-main">
                        <div class="netflix-comment-header">
                            <span class="netflix-comment-name">${this.escapeHtml(comment.name || '热心网友')}</span>
                            <span class="netflix-comment-time">${timeStr}</span>
                        </div>
                        <div class="netflix-comment-bubble">
                            <p class="netflix-comment-text">${this.escapeHtml(comment.text || comment.content || '')}</p>
                        </div>
                        <div class="netflix-comment-actions">
                            <button type="button" class="netflix-c-action-btn"><i class="far fa-thumbs-up"></i> ${likesStr}</button>
                            <button type="button" class="netflix-c-action-btn"><i class="far fa-thumbs-down"></i></button>
                            <button type="button" class="netflix-c-action-btn"><i class="far fa-comment"></i> 回复</button>
                            <button type="button" class="netflix-c-action-btn"><i class="fas fa-share"></i></button>
                        </div>
                        ${!isReply && comment.replies && comment.replies.length ? `
                            <div class="netflix-comment-replies">
                                ${comment.replies.map(reply => renderCommentBlock(reply, true)).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        };

        return comments.map(comment => renderCommentBlock(comment, false)).join('');
    }

    getPresetDefinitions() {
        return {
            style: {
                label: '文风',
                items: [{ key: 'plainStyle', label: '白描文风', defaultValue: this.getPlainStylePresetText() }]
            },
            length: {
                label: '字数',
                items: [{ key: 'wordCount', label: '字数要求', defaultValue: '500-800' }]
            },
            perspective: {
                label: '视角',
                items: [
                    { key: 'firstPerson', label: '第一人称', defaultValue: this.getFirstPersonPresetText() },
                    { key: 'secondPerson', label: '第二人称', defaultValue: this.getSecondPersonPresetText() },
                    { key: 'thirdPerson', label: '第三人称', defaultValue: this.getThirdPersonPresetText() }
                ]
            }
        };
    }

    getFirstPersonPresetText() {
        return `
<第一人称视角规则>
- 你只能使用“我”的视角进行叙述。“我”即为{{user}}。
</第一人称视角规则>`.trim();
    }

    getSecondPersonPresetText() {
        return `
<第二人称视角规则>
- 你只能使用“你”进行叙述。“你”即为{{user}}。
</第二人称视角规则>`.trim();
    }

    getThirdPersonPresetText() {
        return `
<第三人称视角规则>
- 只能使用“他/她/它”或具体人名进行叙述。
- 不得出现“我”或“你”作为叙述者介入内容。
- 未在场景中发生或角色无法感知的信息，需通过场景内的线索呈现，不得直接抛出全知总结。
</第三人称视角规则>`.trim();
    }

    getPlainStylePresetText() {
        return `
<文风>
1. 核心定义
白描：以最简洁客观的语言描摹事物的可感知形态、动作、空间关系，不添加任何主观修饰、情感解读或修辞。

2. 绝对禁令（出现即违规）
- 禁用所有修辞手法：比喻、拟人、夸张、排比、反问、象征。
- 禁用情感形容词与副词（如“孤寂地”“欢快地”），仅允许表示颜色、尺寸、方位等客观属性的词。
- 禁止心理描写：不得出现“他想”“她感到”“内心涌起”“意识到”“记得”等揭示内心的语句。
- 禁止主观评价：不得插入作者抒情、议论、解释、总结或价值判断。

3. 必须执行的写作指令
- 只描写外部可感事物：动作、对话、外貌、环境、声音、气味、光线、温度、质地。只写看得见、听得到、摸得着、闻得到的东西。
- 以名词和动词为核心，尽量减少“的”“地”“得”及形容词性修饰语。多用单句和短句。
- 按观察顺序组织内容：由外到内、由远到近、由整体到局部。
- 通过行动、表情、对话侧写人物状态，禁止直述心理。

4. 模仿范例
输入（违规）：她拖着疲惫的身子，茫然走在空无一人的长街，路灯把影子拉得好长，像一声叹息。
输出（白描）：她走在街上。路灯亮着。身后拖着影子。

5. 优先级
以上规则具有最高优先级。任何描写冲动产生时，必须先用“是否可见/可听/可触”检验，不通过的内容一律删除。
</文风>`;
    }

    getDefaultOffPresetKeys() {
        return new Set(['firstPerson', 'thirdPerson']);
    }

    getPresetCategoryOrder() {
        return ['style', 'length', 'perspective'];
    }

    createPresetId(prefix = 'preset') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    createPresetItem(key, label, value = '') {
        return {
            id: key || this.createPresetId('item'),
            key: key || '',
            label,
            value
        };
    }

    clonePreset(preset) {
        return JSON.parse(JSON.stringify(preset));
    }

    createPresetFromDefaults(id = 'default', name = '默认预设', clearValues = true) {
        const itemsByCategory = {};
        const switchState = {};
        const definitions = this.getPresetDefinitions();
        const defaultOffKeys = this.getDefaultOffPresetKeys();

        this.getPresetCategoryOrder().forEach(categoryKey => {
            const category = definitions[categoryKey];
            itemsByCategory[categoryKey] = category.items.map(item => {
                const presetItem = this.createPresetItem(item.key, item.label, clearValues ? (item.defaultValue || '') : (item.value || item.defaultValue || ''));
                const switchKey = `${categoryKey}:${presetItem.id}`;
                switchState[switchKey] = !defaultOffKeys.has(item.key || presetItem.id);
                return presetItem;
            });
        });

        return {
            id,
            name,
            open: {},
            switchState,
            itemsByCategory
        };
    }

    createDefaultPresetState() {
        const defaultPreset = this.createPresetFromDefaults('default', '默认预设');
        return {
            activePresetId: defaultPreset.id,
            presets: [defaultPreset]
        };
    }

    normalizePreset(preset, fallbackId = 'default') {
        const safe = preset && typeof preset === 'object' ? preset : {};
        const normalized = this.createPresetFromDefaults(safe.id || fallbackId, safe.name || '默认预设');
        normalized.open = safe.open && typeof safe.open === 'object' ? safe.open : {};
        normalized.switchState = safe.switchState && typeof safe.switchState === 'object' ? safe.switchState : normalized.switchState;

        const definitions = this.getPresetDefinitions();
        this.getPresetCategoryOrder().forEach(categoryKey => {
            const legacyCategoryKey = (categoryKey === 'length' || categoryKey === 'perspective') ? 'narration' : categoryKey;
            const savedItems = Array.isArray(safe.itemsByCategory?.[categoryKey])
                ? safe.itemsByCategory[categoryKey]
                : (Array.isArray(safe.itemsByCategory?.[legacyCategoryKey]) ? safe.itemsByCategory[legacyCategoryKey] : []);
            const defaultItems = definitions[categoryKey].items.map(item => {
                const legacyKeys = this.getLegacyPresetKeys(item.key);
                const savedItem = savedItems.find(candidate => candidate.key === item.key || candidate.id === item.key || legacyKeys.includes(candidate.key) || legacyKeys.includes(candidate.id));
                const savedValue = typeof savedItem?.value === 'string' && savedItem.value.trim() ? savedItem.value : '';
                const value = savedValue || item.defaultValue || '';
                return this.createPresetItem(item.key, item.label, item.key === 'wordCount' ? this.formatPresetWordCount(value) : value);
            });
            normalized.itemsByCategory[categoryKey] = defaultItems;
        });

        return normalized;
    }

    getLegacyPresetKeys() {
        return [];
    }

    normalizeDefaultPresetValue(key, value = '') {
        if (key === 'wordCount') return this.formatPresetWordCount(value);
        if (key === 'plainStyle' && !String(value || '').trim()) return this.getPlainStylePresetText();
        if (key === 'firstPerson' && !String(value || '').trim()) return this.getFirstPersonPresetText();
        if (key === 'secondPerson' && !String(value || '').trim()) return this.getSecondPersonPresetText();
        if (key === 'thirdPerson' && !String(value || '').trim()) return this.getThirdPersonPresetText();
        return value || '';
    }

    parsePresetWordCount(value = '500-800') {
        const matches = String(value || '').match(/\d+/g) || [];
        let min = Number(matches[0]) || 500;
        let max = Number(matches[1]) || min || 800;
        min = Math.max(1, Math.floor(min));
        max = Math.max(1, Math.floor(max));
        if (min > max) [min, max] = [max, min];
        return { min, max };
    }

    formatPresetWordCount(value = '500-800') {
        const { min, max } = this.parsePresetWordCount(value);
        return `${min}-${max}`;
    }

    migrateLegacyPresetState(safe) {
        const preset = this.createPresetFromDefaults('default', safe.name || '默认预设');
        preset.open = safe.open && typeof safe.open === 'object' ? safe.open : {};
        preset.switchState = safe.switchState && typeof safe.switchState === 'object' ? safe.switchState : preset.switchState;

        this.getPresetCategoryOrder().forEach(categoryKey => {
            const legacyCategoryKey = (categoryKey === 'length' || categoryKey === 'perspective') ? 'narration' : categoryKey;
            const savedCategory = safe.values && typeof safe.values === 'object'
                ? (safe.values[categoryKey] || safe.values[legacyCategoryKey])
                : null;
            if (savedCategory && typeof savedCategory === 'object') {
                preset.itemsByCategory[categoryKey] = preset.itemsByCategory[categoryKey].map(item => ({
                    ...item,
                    value: this.normalizeDefaultPresetValue(item.key, savedCategory[item.key] || this.getLegacyPresetKeys(item.key).map(key => savedCategory[key]).find(Boolean) || item.value || '')
                }));
            }
        });

        return {
            activePresetId: preset.id,
            presets: [preset]
        };
    }

    normalizePresetState(rawState = null) {
        const safe = rawState && typeof rawState === 'object' ? rawState : {};
        if (!Array.isArray(safe.presets) && (safe.values || safe.order || safe.name)) {
            const migrated = this.migrateLegacyPresetState(safe);
            const preset = this.normalizePreset(migrated.presets[0], 'default');
            preset.id = 'default';
            preset.name = '默认预设';
            return { activePresetId: 'default', presets: [preset] };
        }

        const sourcePreset = Array.isArray(safe.presets) && safe.presets.length
            ? (safe.presets.find(preset => preset?.id === safe.activePresetId) || safe.presets[0])
            : null;
        const preset = this.normalizePreset(sourcePreset || this.createPresetFromDefaults('default', '默认预设'), 'default');
        preset.id = 'default';
        preset.name = '默认预设';
        return { activePresetId: 'default', presets: [preset] };
    }

    loadPresetState() {
        let rawState = null;
        try {
            if (typeof window.getAppState === 'function') {
                rawState = window.getAppState('netflix')?.presetState || null;
            }
            if (!rawState && window.StorageManager && typeof window.StorageManager.load === 'function') {
                rawState = window.StorageManager.load('u2_netflixPresetState', null);
            }
        } catch (error) {
            console.warn('Failed to load Netflix preset state:', error);
        }
        return this.normalizePresetState(rawState);
    }

    savePresetState() {
        try {
            if (typeof window.getAppState === 'function' && typeof window.setAppState === 'function') {
                const previous = window.getAppState('netflix') || {};
                window.setAppState('netflix', { ...previous, presetState: this.presetState }, { silent: true });
            } else if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                window.StorageManager.save('u2_netflixPresetState', this.presetState);
            }
        } catch (error) {
            console.warn('Failed to save Netflix preset state:', error);
        }
    }

    getActivePreset() {
        return this.presetState.presets.find(preset => preset.id === this.presetState.activePresetId) || this.presetState.presets[0];
    }

    escapeHtml(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    escapeAttr(value = '') {
        return this.escapeHtml(value).replace(/`/g, '&#96;');
    }

    getUserState() {
        if (typeof window.getUserState === 'function') return window.getUserState();
        if (!window.userState || typeof window.userState !== 'object') {
            window.userState = { name: '', phone: '', persona: '', avatarUrl: null };
        }
        return window.userState;
    }

    getDisplayName(user = this.getUserState()) {
        return user.name || user.realName || 'User';
    }

    renderAvatar(container, avatarUrl, sizeClass = '') {
        if (!container) return;
        const className = sizeClass ? ` class="${sizeClass}"` : '';
        if (avatarUrl) {
            container.innerHTML = `<img src="${avatarUrl}" alt=""${className}>`;
        } else {
            container.innerHTML = '<i class="fas fa-user"></i>';
        }
    }

    renderUserProfile() {
        const user = this.getUserState();
        const name = this.getDisplayName(user);
        const avatarUrl = user.avatarUrl || user.avatar || '';
        const followers = user.followers || user.fans || 0;
        const subscriptions = user.subscriptions || user.subs || 0;

        this.renderAvatar(this.headerAvatar, avatarUrl);
        this.renderAvatar(this.view.querySelector('#netflix-profile-avatar'), avatarUrl);
        this.renderAvatar(this.view.querySelector('.netflix-nav-avatar'), avatarUrl);

        const profileName = this.view.querySelector('#netflix-profile-name');
        const profileFollowers = this.view.querySelector('#netflix-profile-followers');
        const profileSubs = this.view.querySelector('#netflix-profile-subs');
        if (profileName) profileName.textContent = name;
        if (profileFollowers) profileFollowers.textContent = followers;
        if (profileSubs) profileSubs.textContent = subscriptions;
    }

    openProfileSheet() {
        const user = this.getUserState();
        this.editAvatarDataUrl = user.avatarUrl || user.avatar || '';
        if (this.editNameInput) this.editNameInput.value = this.getDisplayName(user);
        if (this.editPersonaInput) this.editPersonaInput.value = user.persona || user.signature || '';
        this.renderEditAvatar();
        if (this.profileSheet) this.profileSheet.classList.add('active');
    }

    closeProfileSheet() {
        if (this.profileSheet) this.profileSheet.classList.remove('active');
    }

    renderEditAvatar() {
        if (!this.editAvatarPreview || !this.editAvatarTrigger) return;
        const icon = this.editAvatarTrigger.querySelector('i');
        if (this.editAvatarDataUrl) {
            this.editAvatarPreview.src = this.editAvatarDataUrl;
            this.editAvatarPreview.style.display = 'block';
            if (icon) icon.style.display = 'none';
        } else {
            this.editAvatarPreview.removeAttribute('src');
            this.editAvatarPreview.style.display = 'none';
            if (icon) icon.style.display = 'block';
        }
    }

    handleAvatarFile(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            this.editAvatarDataUrl = reader.result || '';
            this.renderEditAvatar();
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    }

    saveProfile() {
        const user = this.getUserState();
        const nextName = this.editNameInput ? this.editNameInput.value.trim() : '';
        const nextPersona = this.editPersonaInput ? this.editPersonaInput.value.trim() : '';

        user.name = nextName || 'User';
        user.persona = nextPersona;
        user.avatarUrl = this.editAvatarDataUrl || null;
        window.userState = user;

        this.syncCurrentAccount(user);
        this.persistUserState(user);
        this.renderUserProfile();
        this.closeProfileSheet();

        if (typeof window.showToast === 'function') {
            window.showToast('资料已保存');
        }
    }

    syncCurrentAccount(user) {
        if (typeof window.getAccounts !== 'function' || typeof window.getCurrentAccountId !== 'function') return;
        const accounts = window.getAccounts();
        const currentAccountId = window.getCurrentAccountId();
        if (!Array.isArray(accounts) || currentAccountId == null) return;

        const account = accounts.find(item => String(item.id) === String(currentAccountId));
        if (!account) return;
        account.name = user.name;
        account.persona = user.persona;
        account.signature = user.persona;
        account.avatarUrl = user.avatarUrl;
    }

    persistUserState(user) {
        try {
            if (window.StorageManager && typeof window.StorageManager.save === 'function') {
                window.StorageManager.save('u2_userState', user);
                if (typeof window.getAccounts === 'function') {
                    window.StorageManager.save('u2_accounts', window.getAccounts());
                }
            }
        } catch (error) {
            console.warn('Failed to persist Netflix user state:', error);
        }

        if (typeof window.syncUIs === 'function') window.syncUIs();
        if (typeof window.saveGlobalData === 'function') window.saveGlobalData();
    }

    switchTab(tabName = 'home') {
        const activeItem = this.navItems.find(item => item.getAttribute('data-tab') === tabName) || this.navItems[0];
        if (!activeItem) return;

        this.navItems.forEach(nav => nav.classList.remove('active'));
        activeItem.classList.add('active');

        this.tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.getAttribute('data-panel') === tabName);
        });

        if (tabName === 'profile' || tabName === 'create') {
            this.renderUserProfile();
            this.renderWorks();
        }
        if (tabName === 'home') {
            this.renderHomeCatalog();
        }
        if (this.content) this.content.scrollTop = 0;
        this.updateNavIndicator(activeItem);
    }

    updateNavIndicator(activeItem = null) {
        if (!this.navIndicator) return;
        const target = activeItem || this.view.querySelector('.netflix-nav-item.active');
        const nav = this.view.querySelector('.netflix-bottom-nav');
        if (!target || !nav) return;

        const navRect = nav.getBoundingClientRect();
        const activeRect = target.getBoundingClientRect();
        const offsetLeft = activeRect.left - navRect.left - 5;

        this.navIndicator.style.width = `${activeRect.width}px`;
        this.navIndicator.style.transform = `translateX(${offsetLeft}px)`;
    }

    open() {
        if (!this.view) return;
        this.view.style.display = 'flex';
        this.view.classList.add('active');
        this.isOpen = true;
        this.renderUserProfile();
        this.renderHomeCatalog();
        this.switchTab('home');
        setTimeout(() => this.updateNavIndicator(), 0);
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#000000');
    }

    close() {
        if (!this.view) return;
        this.view.classList.remove('active');
        this.view.style.display = 'none';
        this.closeProfileSheet();
        this.closeSettingsSheet();
        this.closeWorldBookSheet();
        this.closeHomeSearchSheet(true);
        this.closeActorPicker();
        this.closeWorkDetail();
        this.closePlaybackSheet();
        this.isOpen = false;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#ffffff');
    }
}

function initializeNetflixApp() {
    try {
        window.netflixApp = new NetflixApp();
    } catch (error) {
        document.documentElement.dataset.netflixInitError = error?.stack || error?.message || String(error);
        console.error('Netflix app initialization failed:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNetflixApp);
} else {
    initializeNetflixApp();
}
