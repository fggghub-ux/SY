(function() {
    // ==========================================
    // 1. 系统与全屏配置 (PWA / iOS 适配)
    // ==========================================
    
    /* 防止 iOS Safari 橡皮筋弹动 (仅限制 body 的 touchmove 以免影响应用内部滚动) */
    document.addEventListener('touchmove', function(e) {
        // 如果事件目标是 body 或 html，或者是我们最外层的容器，则阻止默认行为
        if (e.target === document.body || e.target === document.documentElement || e.target.id === 'app') {
            e.preventDefault();
        }
    }, { passive: false });

    /* 禁止双击缩放（旧版 iOS 兼容） */
    let lastTap = 0;
    document.addEventListener('touchend', function(e) {
        const now = Date.now();
        if (now - lastTap < 300) { 
            e.preventDefault(); 
        }
        lastTap = now;
    }, { passive: false });

    /* Standalone detection for PWA/fullscreen mode. */
    function isStandalone() {
        return ('standalone' in window.navigator && window.navigator.standalone) || window.matchMedia('(display-mode: standalone)').matches;
    }

    // ==========================================
    // 全局通用方法
    // ==========================================
    window.openView = function(viewElement) {
        if(viewElement) viewElement.classList.add('active');
    };

    window.closeView = function(viewElement) {
        if(viewElement) viewElement.classList.remove('active');
    };

    // --- Custom Modal System ---
    window.showCustomModal = function(options) {
        const overlay = document.getElementById('custom-modal-overlay');
        if (!overlay) return;

        const titleEl = document.getElementById('modal-title');
        const messageEl = document.getElementById('modal-message');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const confirmBtn = document.getElementById('modal-confirm-btn');
        
        if (titleEl) titleEl.textContent = options.title || '提示';
        if (messageEl) messageEl.textContent = options.message || '';
        
        if (cancelBtn) {
            cancelBtn.textContent = options.cancelText || '取消';
            cancelBtn.onclick = () => {
                window.closeView(overlay);
                if (options.onCancel) options.onCancel();
            };
        }
        
        if (confirmBtn) {
            confirmBtn.textContent = options.confirmText || '确定';
            if (options.isDestructive) {
                confirmBtn.style.color = '#ff3b30';
            } else {
                confirmBtn.style.color = '#007aff';
            }
            confirmBtn.onclick = () => {
                window.closeView(overlay);
                if (options.onConfirm) options.onConfirm();
            };
        }

        // Handle prompt vs confirm
        const promptContent = document.getElementById('modal-prompt-content');
        const confirmContent = document.getElementById('modal-confirm-content');
        const promptConfirmBtn = document.getElementById('modal-prompt-confirm-btn');
        const modalInput = document.getElementById('modal-input');

        if (options.type === 'prompt') {
            if (promptContent) promptContent.style.display = 'block';
            if (confirmContent) confirmContent.style.display = 'none';
            if (confirmBtn) confirmBtn.style.display = 'none';
            if (promptConfirmBtn) {
                promptConfirmBtn.style.display = 'block';
                promptConfirmBtn.textContent = options.confirmText || '确定';
                promptConfirmBtn.onclick = () => {
                    window.closeView(overlay);
                    if (options.onConfirm) options.onConfirm(modalInput ? modalInput.value : '');
                };
            }
            if (modalInput) {
                modalInput.placeholder = options.placeholder || '请输入';
                modalInput.value = options.defaultValue || '';
            }
        } else {
            if (promptContent) promptContent.style.display = 'none';
            if (confirmContent) confirmContent.style.display = 'block';
            if (confirmBtn) confirmBtn.style.display = 'block';
            if (promptConfirmBtn) promptConfirmBtn.style.display = 'none';
        }

        window.openView(overlay);
    };

    // --- Toast Notification System ---
    let toastTimeout = null;
    window.showToast = function(message, duration = 2000) {
        let toast = document.getElementById('global-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'global-toast';
            toast.className = 'toast-bubble';
            // Append to screen container to stay within phone frame
            const screen = document.getElementById('app');
            if (screen) {
                screen.appendChild(toast);
            } else {
                document.body.appendChild(toast);
            }
        }

        toast.textContent = message;
        toast.classList.remove('show');
        
        // Force reflow
        void toast.offsetWidth;
        
        toast.classList.add('show');

        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    };

    window.formatChatBubbleTime = function(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        const hh = date.getHours().toString().padStart(2, '0');
        const mm = date.getMinutes().toString().padStart(2, '0');
        
        const isToday = y === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
        const isThisYear = y === now.getFullYear();

        if (isToday) {
            return `${hh}:${mm}`;
        } else if (isThisYear) {
            return `${m}/${d} ${hh}:${mm}`;
        } else {
            return `${y}/${m}/${d} ${hh}:${mm}`;
        }
    };

    // ==========================================
    // 2. 状态管理 
    // ==========================================
    // TODO: 实现应用状态、页面数据、Widget数据的统一管理
    // 可考虑结合 window.StorageManager 使用


    // ==========================================
    // 3. UI 交互与事件绑定 (待实现)
    // ==========================================
    // TODO: 实现 App 图标点击进入应用的动画及页面切换
    // TODO: 实现 Widget 组件的点击编辑、数据渲染

    function getAllMainGrids() {
        return [...document.querySelectorAll('.main-grid')];
    }

    function getMaxHomePageIndex() {
        return Math.max(getAllMainGrids().length - 1, 0);
    }

    function getCurrentHomePageIndex() {
        const pagesContainerEl = document.getElementById('pages-container');
        if (!pagesContainerEl || !pagesContainerEl.clientWidth) return 0;
        const maxIndex = getMaxHomePageIndex();
        return Math.min(maxIndex, Math.max(0, Math.round(pagesContainerEl.scrollLeft / pagesContainerEl.clientWidth)));
    }

    function scrollToHomePageIndex(index, behavior = 'smooth') {
        const pagesContainerEl = document.getElementById('pages-container');
        if (!pagesContainerEl || !pagesContainerEl.clientWidth) return 0;
        const targetIndex = Math.min(getMaxHomePageIndex(), Math.max(0, index));
        pagesContainerEl.scrollTo({
            left: targetIndex * pagesContainerEl.clientWidth,
            behavior
        });
        return targetIndex;
    }

    function updateHomePageIndicators(pageIndex = getCurrentHomePageIndex()) {
        const dots = document.querySelectorAll('.page-indicators .dot');
        dots.forEach((dot, index) => {
            if (index === pageIndex) dot.classList.add('active');
            else dot.classList.remove('active');
        });
    }

    // ==========================================
    // 11. SWIPE / SCROLL NAVIGATION
    // ==========================================
    const pagesContainer = document.getElementById('pages-container');
    if (pagesContainer) {
        let isDown = false;
        let startX;
        let scrollLeft;
        let scrollRAF = null;

        // Using mousedown/mousemove/mouseup to support desktop mouse sliding 
        // while preserving native CSS scroll-snap on touch devices
        pagesContainer.addEventListener('mousedown', (e) => {
            if (window.isJiggleMode || window.preventAppClick || e.target.closest('.bottom-sheet-overlay')) return;
            isDown = true;
            startX = e.pageX - pagesContainer.offsetLeft;
            scrollLeft = pagesContainer.scrollLeft;
            pagesContainer.style.scrollSnapType = 'none'; // Temporarily disable snap during drag
            pagesContainer.style.cursor = 'grabbing';
        });

        pagesContainer.addEventListener('mouseleave', () => {
            if (!isDown) return;
            isDown = false;
            pagesContainer.style.scrollSnapType = '';
            pagesContainer.style.cursor = '';
            snapToNearestPage();
        });

        pagesContainer.addEventListener('mouseup', () => {
            if (!isDown) return;
            isDown = false;
            pagesContainer.style.scrollSnapType = '';
            pagesContainer.style.cursor = '';
            snapToNearestPage();
        });

        pagesContainer.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            if (window.isJiggleMode) {
                isDown = false;
                pagesContainer.style.scrollSnapType = '';
                pagesContainer.style.cursor = '';
                return;
            }
            
            e.preventDefault();
            const x = e.pageX - pagesContainer.offsetLeft;
            const walk = (x - startX) * 1.5;
            pagesContainer.scrollLeft = scrollLeft - walk;
        });

        function snapToNearestPage() {
            if (!pagesContainer.clientWidth) return;
            const pageIndex = Math.round(pagesContainer.scrollLeft / pagesContainer.clientWidth);
            scrollToHomePageIndex(pageIndex, 'smooth');
        }
        
        pagesContainer.addEventListener('scroll', () => {
            if (scrollRAF) return;
            scrollRAF = requestAnimationFrame(() => {
                updateHomePageIndicators();
                scrollRAF = null;
            });
        });

        updateHomePageIndicators();
    }
    

    // ==========================================
    // 4. 初始化加载
    // ==========================================
    document.addEventListener('DOMContentLoaded', () => {
        if (isStandalone()) {
            console.log("App is running in Standalone (Fullscreen) mode.");
            // 在全屏模式下，你可以根据需要做一些特殊的 UI 调整
        } else {
            console.log("App is running in Browser mode.");
            // 可以提示用户将其添加到主屏幕
        }

        // 初始化主屏幕 UI 等后续操作可在此执行
        // 延时等待主要 DOM 和 Storage 渲染完毕后，移除开屏动画
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (typeof window.removeSplashScreen === 'function') {
                    window.removeSplashScreen();
                }
            });
        });
    });

})();
