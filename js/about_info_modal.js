(function () {
    const modal = document.getElementById('about-info-modal');
    const title = document.getElementById('about-info-modal-title');
    const disclaimerContent = document.getElementById('about-disclaimer-content');
    const changelogContent = document.getElementById('about-changelog-content');
    const closeButton = document.getElementById('about-info-modal-close');
    const confirmButton = document.getElementById('about-info-modal-confirm');
    let returnFocus = null;
    let previousBodyOverflow = '';

    function open(mode = 'disclaimer') {
        if (!modal) return false;
        const showChangelog = mode === 'changelog';
        returnFocus = document.activeElement;
        if (title) title.textContent = showChangelog ? '更新日志' : '免责声明';
        if (disclaimerContent) disclaimerContent.hidden = showChangelog;
        if (changelogContent) changelogContent.hidden = !showChangelog;
        previousBodyOverflow = document.body.style.overflow;
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        closeButton?.focus();
        return true;
    }

    function close() {
        if (!modal || modal.hidden) return false;
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = previousBodyOverflow;
        previousBodyOverflow = '';
        if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
        returnFocus = null;
        return true;
    }

    closeButton?.addEventListener('click', close);
    confirmButton?.addEventListener('click', close);
    modal?.addEventListener('click', (event) => {
        if (event.target === modal) close();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal && !modal.hidden) close();
    });

    window.u2AboutInfoModal = { open, close };
})();
