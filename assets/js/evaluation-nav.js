(() => {
  function init() {
    const groups = [...document.querySelectorAll('.evaluation-nav')].map(nav => {
      const links = [...nav.querySelectorAll('a[href^="#"]')];
      const targets = links.map(link => targetOf(link.hash));
      const scroller = nav.querySelector('.evaluation-nav-links');
      return { nav, links, targets, scroller, current: -1 };
    }).filter(group => group.targets.length && group.targets.every(Boolean));
    if (!groups.length) return;

    const topbarQuery = window.matchMedia('(max-width: 768px), (max-height: 600px)');
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const readerQuery = window.matchMedia('(min-width: 1100px) and (min-height: 700px)');
    const readers = groups.filter(group => group.nav.classList.contains('evaluation-nav--reader')).map(group => {
      const workspace = group.nav.closest('.evaluation-workspace');
      const reader = workspace?.querySelector('.evaluation-reader');
      const panels = reader ? [...reader.querySelectorAll('[data-evaluation-panel]')] : [];
      return { group, workspace, reader, panels, selectedPanel: panels[0], active: false };
    }).filter(state => state.reader && state.panels.length);
    readers.forEach(state => {
      state.selectedPanel = panelOf(state, targetOf(location.hash)) || state.selectedPanel;
    });
    groups.forEach(group => {
      group.readerState = readers.find(state => state.group === group || state.reader.contains(group.nav));
    });
    let frame = 0;
    let hashFrame = 0;

    function targetOf(hash) {
      if (!hash || hash === '#') return null;
      try { return document.getElementById(decodeURIComponent(hash.slice(1))); }
      catch (_) { return null; }
    }

    function panelOf(state, target) {
      if (!target) return null;
      if (target === state.reader.querySelector('.inference-context')) return state.panels[0];
      return state.panels.find(panel => panel === target || panel.contains(target));
    }

    function markReader(state) {
      const { group, selectedPanel } = state;
      group.links.forEach((link, index) => {
        if (panelOf(state, group.targets[index]) === selectedPanel) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    function selectPanel(state, panel, reset = false) {
      if (!panel) return;
      state.selectedPanel = panel;
      if (!state.active) return;
      state.panels.forEach(item => {
        const hide = item !== panel;
        if (hide && !item.hidden) item.querySelectorAll('video').forEach(video => video.pause());
        item.hidden = hide;
      });
      if (reset) state.reader.scrollTop = 0;
      markReader(state);
      schedule();
    }

    function setReaderMode() {
      readers.forEach(state => {
        const active = readerQuery.matches;
        if (active === state.active) return;
        state.active = active;
        state.workspace.classList.toggle('is-reader', active);
        if (active) selectPanel(state, state.selectedPanel, true);
        else {
          state.panels.forEach(panel => { panel.hidden = false; });
          state.group.current = -1;
        }
      });
      schedule();
    }

    function openDetails(target) {
      for (let details = target.closest('details'); details; details = details.parentElement?.closest('details')) details.open = true;
    }

    /* Let normal fragment links work even when their target lives in another
       reader panel. Menu clicks keep the page in place and restart the reader. */
    document.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) return;
      const target = targetOf(url.hash);
      const state = readers.find(item => panelOf(item, target));
      if (!state) return;
      const panel = panelOf(state, target);
      if (!state.active) { state.selectedPanel = panel; return; }
      const menuClick = state.group.nav.contains(link);
      const left = window.scrollX;
      const top = window.scrollY;
      selectPanel(state, panel, menuClick);
      openDetails(target);
      if (!menuClick) return;
      event.preventDefault();
      if (location.hash !== url.hash) history.pushState(null, '', url.hash);
      window.scrollTo({ left, top, behavior: 'instant' });
    }, true);

    function followHash() {
      cancelAnimationFrame(hashFrame);
      const target = targetOf(location.hash);
      const state = readers.find(item => panelOf(item, target));
      if (!state) return;
      const panel = panelOf(state, target);
      state.selectedPanel = panel;
      if (!state.active) return;
      selectPanel(state, panel, true);
      openDetails(target);
      hashFrame = requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'instant' }));
    }

    function pinnedTop() {
      const bar = document.querySelector('.navbar');
      if (!bar || !topbarQuery.matches || !bar.classList.contains('scrolled')) return 0;
      return bar.getBoundingClientRect().height;
    }

    function landing(target) {
      const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      return pad + margin;
    }

    function updateFades(group) {
      const s = group.scroller;
      if (!s) return;
      const max = s.scrollWidth - s.clientWidth;
      s.classList.toggle('fade-l', max > 1 && s.scrollLeft > 2);
      s.classList.toggle('fade-r', max > 1 && s.scrollLeft < max - 2);
    }

    function reveal(group, link) {
      const s = group.scroller;
      if (!s || s.scrollWidth <= s.clientWidth + 1) return;
      const box = s.getBoundingClientRect();
      const r = link.getBoundingClientRect();
      const delta = (r.left + r.width / 2) - (box.left + box.width / 2);
      const left = Math.max(0, Math.min(s.scrollLeft + delta, s.scrollWidth - s.clientWidth));
      if (Math.abs(left - s.scrollLeft) < 1) return;
      s.scrollTo({ left, behavior: reduceQuery.matches ? 'auto' : 'smooth' });
    }

    /* Stacked layouts and the supervision section retain the original scroll
       navigation, including the sideways overflow hints on narrower screens. */
    function update() {
      frame = 0;
      const headerHeight = pinnedTop();
      groups.forEach(group => {
        const { nav, links, targets, readerState } = group;
        if (readerState?.active && group === readerState.group) return;
        if (!nav.getClientRects().length) return;
        const visibleTop = readerState?.active ? Math.max(headerHeight, readerState.reader.getBoundingClientRect().top) : headerHeight;
        const probe = visibleTop + nav.getBoundingClientRect().height + 32;
        let selected = 0;
        targets.forEach((target, index) => {
          if (target.getBoundingClientRect().top <= Math.max(probe, landing(target) + 12)) selected = index;
        });
        links.forEach((link, index) => {
          if (index === selected) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
        if (selected !== group.current) {
          group.current = selected;
          reveal(group, links[selected]);
        }
        updateFades(group);
      });
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', () => { groups.forEach(group => { group.current = -1; }); schedule(); });
    window.addEventListener('hashchange', () => { followHash(); schedule(); });
    window.addEventListener('popstate', followHash);
    window.addEventListener('load', schedule, { once: true });
    readerQuery.addEventListener('change', setReaderMode);
    readers.forEach(state => state.reader.addEventListener('scroll', schedule, { passive: true }));
    groups.forEach(group => {
      group.nav.closest('details')?.addEventListener('toggle', () => { group.current = -1; schedule(); });
      group.scroller?.addEventListener('scroll', () => updateFades(group), { passive: true });
    });
    setReaderMode();
    if (location.hash) followHash();
    update();
  }

  // Deferred player scripts create fragment targets before DOMContentLoaded.
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
