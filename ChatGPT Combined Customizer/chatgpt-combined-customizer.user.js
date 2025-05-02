// ==UserScript==
// @name         ChatGPT Combined Customizer
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Customizes ChatGPT UI with multiple enhancements
// @author       KhvichaDev
// @match        https://chatgpt.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /* ─────────────── Helper Functions ─────────────── */

  /** Removes "Discover GPTs" button from sidebar consistently */
  function removeDiscoverGptsButton() {
    const discoverButton = document.querySelector('a[data-testid="explore-gpts-button"]');
    if (discoverButton) discoverButton.remove();

    const discoverLink = document.querySelector('a[href^="/discover"]');
    if (discoverLink) {
      const discoverRow =
        discoverLink.closest('div.relative.self-stretch') || discoverLink.closest('div');
      if (discoverRow) discoverRow.remove();
    }
  }

  /** Sets up observer to consistently remove Discover GPTs button */
  function setupDiscoverGptsObserver() {
    const observer = new MutationObserver(() => removeDiscoverGptsButton());
    observer.observe(document.body, { childList: true, subtree: true });
    removeDiscoverGptsButton();
    return observer;
  }

  /* ─────────────── Static Dropdown Items ─────────────── */

  /** Creates a static dropdown item with icon and text */
  function createStaticDropdownItem(href, name, iconSVG) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = href;
    a.target = '_self';
    a.className =
      'group flex items-center gap-3 px-4 py-2 hover:bg-token-surface-secondary transition-colors rounded-md';
    a.innerHTML = `
      <div class="h-6 w-6 rounded-full overflow-hidden bg-token-main-surface-secondary">
        ${
          iconSVG ||
          '<img src="https://chat.openai.com/favicon.ico" class="h-full w-full object-cover">'
        }
      </div>
      <div class="flex-1 truncate">${name}</div>
    `;
    li.appendChild(a);
    return li;
  }

  /** Populates the dropdown with static items (My GPTs, Discover GPTs) */
  function populateMygptsDropdown(list) {
    if (list.dataset.staticAdded) return;
    list.dataset.staticAdded = 'true';

    // Add "My GPTs" from profile menu
    const profileItem = [...document.querySelectorAll('[role="menuitem"]')].find((el) => {
      const t = el.textContent.trim();
      return t === 'ჩემი GPT ები' || t === 'ჩემი gpt ები' || t === 'My GPTs';
    });
    if (profileItem) {
      const link = profileItem.tagName.toLowerCase() === 'a' ? profileItem : profileItem.querySelector('a');
      if (link) {
        const iconSVG = link.querySelector('svg')?.outerHTML || '';
        const li = createStaticDropdownItem(link.href, link.textContent.trim(), iconSVG);
        list.appendChild(li);
      }
      profileItem.remove();
    }

    // Add "Discover GPTs" from sidebar
    const discoverLink = document.querySelector('a[href^="/discover"]');
    if (discoverLink) {
      const iconSVG = discoverLink.querySelector('svg')?.outerHTML || '';
      const li = createStaticDropdownItem(discoverLink.href, 'Discover GPTs', iconSVG);
      list.appendChild(li);
      const discoverRow =
        discoverLink.closest('div.relative.self-stretch') || discoverLink.closest('div');
      if (discoverRow) discoverRow.remove();
    }
  }

  /* ─────────────── Pinned GPTs Mover + Sora ─────────────── */

  const PINNED_SELECTOR = 'a[href^="/g/"][data-discover="true"]';
  let initedPath = null;

  /** Checks if a link is a pinned GPT */
  const isPinnedGpt = (link) => {
    const href = link.getAttribute('href') || '';
    return (
      href.startsWith('/g/') &&
      !href.includes('/project') &&
      !href.includes('g-p-') &&
      !href.includes('/c/')
    );
  };

  /** Creates the dropdown switcher in header */
  function createSwitcher(modelSwitcher) {
    modelSwitcher.style.overflow = 'visible';

    const container = document.createElement('div');
    container.className = '__pinnedGPTs_container relative inline-flex items-center gap-1';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Pinned GPTs');
    btn.className =
      'flex items-center gap-2 px-3 py-1.5 h-9 rounded-md text-sm text-token-text-primary hover:bg-token-main-surface-secondary transition';
    btn.innerHTML = `
      <div class="truncate">My GPTs</div>
      <svg width="16" height="16" fill="none" class="icon-md text-token-text-tertiary">
        <path fill-rule="evenodd" clip-rule="evenodd"
              d="M5.293 9.293a1 1 0 0 1 1.414 0L12 14.586l5.293-5.293a1 1 0 0 1 1.414 1.414l-6 6a1 1 0 0 1-1.414 0l-6-6a1 1 0 0 1 0-1.414z"
              fill="currentColor"/>
      </svg>`;

    const dd = document.createElement('div');
    dd.className =
      'absolute left-0 top-full mt-4 w-64 origin-top-right rounded-lg bg-token-main-surface-primary ring-1 ring-black ring-opacity-5 shadow-lg hidden opacity-0 transition-opacity duration-150';
    Object.assign(dd.style, { minWidth: '280px', maxHeight: '500px', overflowY: 'auto' });

    const ul = document.createElement('ul');
    ul.className = 'py-1 text-sm text-token-text-primary';
    dd.appendChild(ul);

    // Add static items first
    populateMygptsDropdown(ul);

    // Then add pinned GPTs + Sora
    moveSidebarItemsInto(ul);

    // Toggle dropdown on button click
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dd.classList.contains('hidden')) {
        dd.classList.remove('hidden');
        setTimeout(() => dd.classList.remove('opacity-0'), 10);
      } else {
        dd.classList.add('opacity-0');
        setTimeout(() => dd.classList.add('hidden'), 150);
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      dd.classList.add('opacity-0');
      setTimeout(() => dd.classList.add('hidden'), 150);
    });

    container.append(btn, dd);
    modelSwitcher.appendChild(container);

    // Watch for new pinned GPTs or Sora; dropdown აღარ ქრება არასდროს
    const mo = new MutationObserver(() => moveSidebarItemsInto(ul));
    mo.observe(document.body, { childList: true, subtree: true });
  }

  /** Moves sidebar items (pinned GPTs + Sora) into dropdown */
  function moveSidebarItemsInto(list) {
    document.querySelectorAll(PINNED_SELECTOR).forEach((link) => {
      if (!isPinnedGpt(link) || link.hasAttribute('data-processed')) return;
      transfer(link, list);
    });
    const sora = document.querySelector('a[title="Sora"]');
    if (sora && !sora.hasAttribute('data-processed')) transfer(sora, list);
  }

  /** Transfers a sidebar item to the dropdown */
  function transfer(link, list) {
    link.setAttribute('data-processed', 'true');

    const name =
      link.querySelector('div.text-token-text-primary')?.textContent.trim() ||
      link.getAttribute('title') ||
      'Item';
    const href = link.href;
    const icon = link.querySelector('img')?.src;

    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = href;
    a.target = link.target || '_self';
    a.className =
      'group flex items-center gap-3 px-4 py-2 hover:bg-token-surface-secondary transition-colors rounded-md';
    a.innerHTML = `
      <div class="h-6 w-6 rounded-full overflow-hidden bg-token-main-surface-secondary">
        <img src="${icon || 'https://chat.openai.com/favicon.ico'}" class="h-full w-full object-cover">
      </div>
      <div class="flex-1 truncate">${name}</div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
           class="opacity-0 group-hover:opacity-100 text-token-text-tertiary transition-opacity">
        <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    li.appendChild(a);
    list.appendChild(li);

    // Hide original sidebar item
    const row = link.closest('div.relative.self-stretch') || link.closest('div');
    if (row) Object.assign(row.style, { opacity: '0', height: '0', pointerEvents: 'none' });
  }

  /* ───────── Projects & Tasks Customizer ───────── */

  /** Injects necessary CSS styles */
  function injectStyles() {
    if (document.getElementById('mp-style')) return;
    const css = `
      #sidebar > div.bg-token-sidebar-surface-primary.pt-0 { display: none; }
      .mp-divider { height: 1px; margin: 6px 0; background-color: var(--token-border-default, #2a2b32); }
      #my-projects-modal { display: none; position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.55); backdrop-filter: blur(4px); align-items: center; justify-content: center; animation: mp-fade .25s ease; }
      @keyframes mp-fade { from { opacity: 0 } to { opacity: 1 } }
      #my-projects-modal .mp-box { width: min(420px,90vw); max-height: 80vh; background: var(--token-main-surface-primary,#202123); color: var(--token-text-primary,#ECECF1); border-radius:12px; box-shadow:0 10px 32px rgba(0,0,0,0.45); padding:24px 28px; display:flex; flex-direction:column; animation: mp-zoom .25s cubic-bezier(.34,1.56,.64,1); }
      @keyframes mp-zoom { from { transform: scale(.95) } to { transform: scale(1) } }
      #my-projects-modal h2 { display:flex; align-items:center; gap:8px; margin:0 0 16px 0; font-size:20px; font-weight:600; }
      #my-projects-modal ul { list-style:none; margin:0; padding:0; flex:1 1 auto; overflow-y:auto; }
      #my-projects-modal li { border-radius:8px; transition: background .15s; }
      #my-projects-modal li a { display:flex; align-items:center; gap:10px; padding:8px 10px; color:inherit; text-decoration:none; font-size:15px; width:100%; }
      #my-projects-modal li:hover { background: var(--token-sidebar-surface-tertiary,rgba(255,255,255,.08)); }
      #mp-close { position:absolute; top:5px; right:12px; background:none; border:none; color:#999; font-size:28px; cursor:pointer; transition:color .15s; }
      #mp-close:hover { color:#fff }
    `;
    const style = document.createElement('style');
    style.id = 'mp-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /** Builds the Projects and Tasks UI elements */
  function build() {
    const aside = document.querySelector('aside');
    if (!aside) return;
    if (document.getElementById('my-projects-button')) {
      clearInterval(poll);
      return;
    }

    // Collect project links
    const projectLinks = aside.querySelectorAll('a[href*="/project"]');
    if (!projectLinks.length) return;
    const projects = Array.from(projectLinks).map((a) => ({
      name: a.textContent.trim(),
      href: a.href
    }));
    projectLinks.forEach((a) => a.closest('div')?.remove());

    // Find "Show more" button row
    const moreBtn = [...aside.querySelectorAll('button')].find(
      (btn) => btn.textContent.trim() === 'მეტის ჩვენება'
    );
    const moreRow = moreBtn?.closest('div');
    if (!moreRow) return;

    // Create Projects button
    const projRow = document.createElement('div');
    projRow.className = 'group flex w-full items-center justify-start';
    const projBtn = document.createElement('button');
    projBtn.id = 'my-projects-button';
    projBtn.className =
      'tracking-condensed text-token-text-secondary hover:bg-token-sidebar-surface-secondary screen-arch:py-[7px] screen-arch:text-body can-hover:hover:screen-arch:bg-token-main-surface-secondary flex flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ease-[var(--spring-bounce)] select-none focus:ring-0 motion-safe:active:scale-[98%] motion-safe:active:transition-transform';
    projBtn.innerHTML =
      '<div class="h-6 w-6"><div class="text-token-text-primary relative flex h-full items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h6l2 2h8v12H4z"/></svg></div></div><span class="text-start">ჩემი პროექტები</span>';
    projBtn.onclick = () => (document.getElementById('my-projects-modal').style.display = 'flex');
    projRow.appendChild(projBtn);

    // Create Tasks button
    const tasksRow = document.createElement('div');
    tasksRow.className = projRow.className;
    const tasksBtn = document.createElement('button');
    tasksBtn.id = 'my-tasks-button';
    tasksBtn.className = projBtn.className;
    tasksBtn.innerHTML =
      '<div class="h-6 w-6"><div class="text-token-text-primary relative flex h-full items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.1 4.7c.44.33.53.96.2 1.4L6.3 10.1c-.16.22-.41.36-.68.39-.27.03-.54-.05-.74-.22l-1.5-1.25a1 1 0 0 1 1.38-1.47l.69.58L7.7 4.9a1 1 0 0 1 1.4-.2Zm2.9 1.8a1 1 0 0 1 1-1h7a1 1 0 1 1 0 2h-7a1 1 0 0 1-1-1ZM3 16.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0Zm3-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm6 1a1 1 0 0 1 1-1h7a1 1 0 1 1 0 2h-7a1 1 0 0 1-1-1Z"/></svg></div></div><span class="text-start">დავალებები</span>';
    tasksBtn.onclick = () => {
      window.location.href = '/tasks';
    };
    tasksRow.appendChild(tasksBtn);

    // Insert new buttons above "Show more"
    moreRow.parentNode.insertBefore(projRow, moreRow);
    moreRow.parentNode.insertBefore(tasksRow, moreRow.nextSibling);

    insertDividersForProjectsSection();

    // Create projects modal if not exists
    if (!document.getElementById('my-projects-modal')) {
      const modal = document.createElement('div');
      modal.id = 'my-projects-modal';
      modal.innerHTML = `
        <div class="mp-box" style="position:relative;">
          <button id="mp-close" aria-label="დახურვა">&times;</button>
          <h2>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 4h6l2 2h8v12H4z"/>
            </svg>
            ჩემი პროექტები
          </h2>
          <ul>
            ${projects
              .map(
                (p) => `
              <li>
                <a href="${p.href}" target="_blank">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 4H4v16h16V8h-6z"/>
                    <path d="M14 4v4h4" fill="none" stroke="currentColor" stroke-width="2"/>
                  </svg>
                  ${p.name}
                </a>
              </li>
            `
              )
              .join('')}
          </ul>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => {
        if (e.target.id === 'mp-close' || e.target === modal) {
          modal.style.display = 'none';
        }
      });
    }

    clearInterval(poll);
  }

  /** Inserts dividers around Projects/Tasks section */
  function insertDividersForProjectsSection() {
    const header = document.getElementById('snorlax-heading');
    if (header && !header.previousElementSibling?.classList.contains('mp-divider')) {
      const dividerTop = document.createElement('div');
      dividerTop.className = 'mp-divider';
      header.insertAdjacentElement('beforebegin', dividerTop);
    }
    const tasksRow = document.getElementById('my-tasks-button')?.closest('div');
    if (tasksRow && !tasksRow.previousElementSibling?.classList.contains('mp-divider')) {
      const dividerBottom = document.createElement('div');
      dividerBottom.className = 'mp-divider';
      tasksRow.insertAdjacentElement('beforebegin', dividerBottom);
    }
  }

  /** Moves My GPTs and Discover GPTs to dropdown */
  function moveMyGptsAndDiscoverToDropdown() {
    const discoverObserver = setupDiscoverGptsObserver();

    // Hide original items in profile menu
    const profileMenuObserver = new MutationObserver(() => {
      document.querySelectorAll('[role="menuitem"]').forEach((item) => {
        const txt = item.textContent.trim();
        if (txt === 'ჩემი GPT-ები' || txt === 'GPT-ების დათვალიერება') {
          item.style.display = 'none';
        }
      });
    });
    profileMenuObserver.observe(document.body, { childList: true, subtree: true });

    // Add to dropdown (static approach)
    const interval = setInterval(() => {
      const dropdown = document.querySelector('.__pinnedGPTs_container ul');
      if (!dropdown || dropdown.querySelector('.__mygpts_header')) return;

      // Add header
      const header = document.createElement('div');
      header.className = '__mygpts_header';
      dropdown.prepend(header);

      // Add Discover GPTs
      const li1 = document.createElement('li');
      li1.innerHTML = `
        <a href="/gpts" class="group flex items-center gap-3 px-4 py-2 hover:bg-token-surface-secondary transition-colors rounded-md">
          <div class="h-6 w-6 rounded-full overflow-hidden bg-token-main-surface-secondary">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M6.75 4.5C5.50736 4.5 4.5 5.50736 4.5 6.75C4.5 7.99264 5.50736 9 6.75 9C7.99264 9 9 7.99264 9 6.75C9 5.50736 7.99264 4.5 6.75 4.5ZM2.5 6.75C2.5 4.40279 4.40279 2.5 6.75 2.5C9.09721 2.5 11 4.40279 11 6.75C11 9.09721 9.09721 11 6.75 11C4.40279 11 2.5 9.09721 2.5 6.75Z" fill="currentColor"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M17.25 4.5C16.0074 4.5 15 5.50736 15 6.75C15 7.99264 16.0074 9 17.25 9C18.4926 9 19.5 7.99264 19.5 6.75C19.5 5.50736 18.4926 4.5 17.25 4.5ZM13 6.75C13 4.40279 14.9028 2.5 17.25 2.5C19.5972 2.5 21.5 4.40279 21.5 6.75C21.5 9.09721 19.5972 11 17.25 11C14.9028 11 13 9.09721 13 6.75Z" fill="currentColor"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M6.75 15C5.50736 15 4.5 16.0074 4.5 17.25C4.5 18.4926 5.50736 19.5 6.75 19.5C7.99264 19.5 9 18.4926 9 17.25C9 16.0074 7.99264 15 6.75 15ZM2.5 17.25C2.5 14.9028 4.40279 13 6.75 13C9.09721 13 11 14.9028 11 17.25C11 19.5972 9.09721 21.5 6.75 21.5C4.40279 21.5 2.5 19.5972 2.5 17.25Z" fill="currentColor"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M17.25 15C16.0074 15 15 16.0074 15 17.25C15 18.4926 16.0074 19.5 17.25 19.5C18.4926 19.5 19.5 18.4926 19.5 17.25C19.5 16.0074 18.4926 15 17.25 15ZM13 17.25C13 14.9028 14.9028 13 17.25 13C19.5972 13 21.5 14.9028 21.5 17.25C21.5 19.5972 19.5972 21.5 17.25 21.5C14.9028 21.5 13 19.5972 13 17.25Z" fill="currentColor"/>
            </svg>
          </div>
          <div class="flex-1 truncate">GPT-ების დათვალიერება</div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               class="opacity-0 group-hover:opacity-100 text-token-text-tertiary transition-opacity">
            <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>`;
      dropdown.prepend(li1);

      // Add My GPTs (delegate click)
      const li2 = document.createElement('li');
      li2.innerHTML = `
        <a href="#" class="__delegate-mine group flex items-center gap-3 px-4 py-2 hover:bg-token-surface-secondary transition-colors rounded-md">
          <div class="h-6 w-6 rounded-full overflow-hidden bg-token-main-surface-secondary">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12 4C10.3431 4 9 5.34315 9 7C9 8.65685 10.3431 10 12 10C13.6569 10 15 8.65685 15 7C15 5.34315 13.6569 4 12 4ZM7 7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7C17 9.76142 14.76142 12 12 12C9.23858 12 7 9.76142 7 7Z" fill="currentColor"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M10.9684 14.0022C11.1062 14.537 10.7843 15.0823 10.2495 15.22C7.46676 15.9369 5.5 18.2894 5.5 20.9999C5.5 21.5522 5.05228 21.9999 4.5 21.9999C3.94772 21.9999 3.5 21.5522 3.5 20.9999C3.5 17.2714 6.1909 14.2002 9.75054 13.2833C10.2854 13.1455 10.8306 13.4674 10.9684 14.0022Z" fill="currentColor"/>
              <path d="M17.25 15.625C17.25 16.5225 16.5225 17.25 15.625 17.25C14.7275 17.25 14 16.5225 14 15.625C14 14.7275 14.7275 14 15.625 14C16.5225 14 17.25 14.7275 17.25 15.625Z" fill="currentColor"/>
              <path d="M21.75 15.625C21.75 16.5225 21.0225 17.25 20.125 17.25C19.2275 17.25 18.5 16.5225 18.5 15.625C18.5 14.7275 19.2275 14 20.125 14C21.0225 14 21.75 14.7275 21.75 15.625Z" fill="currentColor"/>
              <path d="M21.75 20.125C21.75 21.0225 21.0225 21.75 20.125 21.75C19.2275 21.75 18.5 21.0225 18.5 20.125C18.5 19.2275 19.2275 18.5 20.125 18.5C21.0225 18.5 21.75 19.2275 21.75 20.125Z" fill="currentColor"/>
              <path d="M17.25 20.125C17.25 21.0225 16.5225 21.75 15.625 21.75C14.7275 21.75 14 21.0225 14 20.125C14 19.2275 14.7275 18.5 15.625 18.5C16.5225 18.5 17.25 19.2275 17.25 20.125Z" fill="currentColor"/>
            </svg>
          </div>
          <div class="flex-1 truncate">ჩემი GPT-ები</div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               class="opacity-0 group-hover:opacity-100 text-token-text-tertiary transition-opacity">
            <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>`;
      dropdown.prepend(li2);

      // Delegate click
      li2.querySelector('a').addEventListener('click', (e) => {
        e.preventDefault();
        const profileBtn = document.querySelector('button[data-testid="profile-button"]');
        if (!profileBtn) return;

        const obs = new MutationObserver((_, observer) => {
          const menu = document.querySelector('[data-radix-menu-content][data-state="open"]');
          if (menu) {
            const myItem = [...menu.querySelectorAll('[role="menuitem"]')].find(
              (el) => el.textContent.trim() === 'ჩემი GPT-ები'
            );
            if (myItem) {
              myItem.click();
              observer.disconnect();
            }
          }
        });
        obs.observe(document.body, { childList: true, subtree: true });

        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
          profileBtn.dispatchEvent(
            new MouseEvent(type, { bubbles: true, cancelable: true, view: window })
          );
        });
      });

      // Divider
      const divider = document.createElement('li');
      divider.className = 'mp-divider';
      dropdown.insertBefore(divider, dropdown.children[2]);

      clearInterval(interval);
    }, 500);
  }

  /** Replaces padding on elements with pt-7 class */
  function replacePadding() {
    const el = document.querySelector('div.pt-7');
    if (el) {
      el.classList.remove('pt-7');
      el.classList.add('pt-0');
    }
  }

  /** Hooks into history API to detect SPA navigation */
  function hookHistory() {
    const wrap = (fn) =>
      function (...args) {
        const r = fn.apply(this, args);
        setTimeout(init, 200);
        return r;
      };
    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
    window.addEventListener('popstate', () => setTimeout(init, 200));
  }

  /** Handles SPA navigation by reinitializing components when URL changes */
  function handleSPANavigation() {
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        setTimeout(() => {
          init(true);
          build();
        }, 300);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /** Main initialization function that coordinates all components */
  function init(force = false) {
    const path = location.pathname;
    if (!force && initedPath === path) return;
    initedPath = path;

    // Always create switcher (dropdown), უ_pinned_ შემოწმების გარეშე
    const header = document.getElementById('page-header');
    const modelSwitcher = header?.querySelector('.flex.items-center.gap-0.overflow-hidden');
    if (!header || !modelSwitcher) {
      setTimeout(init, 500);
      return;
    }
    if (!modelSwitcher.querySelector('.__pinnedGPTs_container')) {
      createSwitcher(modelSwitcher);
    }
  }

  /* ─────────────── Global Initializer ─────────────── */

  function initializeAllComponents() {
    injectStyles();
    hookHistory();
    handleSPANavigation();

    setTimeout(init, 1000);
    setTimeout(moveMyGptsAndDiscoverToDropdown, 1500);

    replacePadding();

    poll = setInterval(() => {
      try {
        build();
        if (document.getElementById('my-projects-button')) clearInterval(poll);
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 700);

    const profileMenuObserver = new MutationObserver(() => {
      for (const txt of ['დავალებები', 'ჩემი GPT ები', 'ჩემი gpt ები', 'My GPTs']) {
        const item = [...document.querySelectorAll('[role="menuitem"]')].find(
          (el) => el.textContent.trim() === txt
        );
        if (item) item.remove();
      }
    });
    profileMenuObserver.observe(document.body, { childList: true, subtree: true });

    const plansObserver = new MutationObserver(() => {
      for (const span of document.querySelectorAll('span')) {
        if (span.textContent.trim() === 'გეგმების დათვალიერება') {
          const row = span.closest('div.flex.flex-col.py-2');
          if (row) {
            row.remove();
            plansObserver.disconnect();
            break;
          }
        }
      }
    });
    plansObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Start everything
  let poll;
  initializeAllComponents();

  const paddingObserver = new MutationObserver(replacePadding);
  paddingObserver.observe(document.body, { childList: true, subtree: true });




   /** აჩვენებს შუალედურ ჩატვირთვის ეკრანს ChatGPT ლოგოთი და ტექსტით */
  function showLoadingScreen() {
    if (document.getElementById('khvicha-loading')) return;

    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'khvicha-loading';
    loadingScreen.style.position = 'fixed';
    loadingScreen.style.inset = '0';
    loadingScreen.style.backgroundColor = '#000';
    loadingScreen.style.color = '#fff';
    loadingScreen.style.display = 'flex';
    loadingScreen.style.flexDirection = 'column';
    loadingScreen.style.alignItems = 'center';
    loadingScreen.style.justifyContent = 'center';
    loadingScreen.style.gap = '12px';
    loadingScreen.style.fontFamily = 'Arial, sans-serif';
    loadingScreen.style.zIndex = '999999';

    const logo = document.createElement('img');
    logo.src = 'https://chat.openai.com/favicon.ico';
    logo.style.width = '64px';
    logo.style.height = '64px';
    logo.style.borderRadius = '50%';

    const mainText = document.createElement('div');
    mainText.textContent = 'ChatGPT';
    mainText.style.fontSize = '32px';
    mainText.style.fontWeight = 'bold';

    const subText = document.createElement('div');
    subText.textContent = 'Customized by KhvichaDev';
    subText.style.fontSize = '14px';
    subText.style.opacity = '0.8';

    loadingScreen.appendChild(logo);
    loadingScreen.appendChild(mainText);
    loadingScreen.appendChild(subText);

    document.body.appendChild(loadingScreen);
  }

  /** Forces full page reload on SPA navigation except exclusions */
  function forceFullReloadOnNavigation() {
    let lastUrl = location.href;

    const observeNavigation = () => {
      const currentUrl = location.href;

      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;

        const url = new URL(currentUrl);
        const path = url.pathname;
        const searchParams = url.searchParams;

        const isGptsMine = path.startsWith('/gpts/mine');
        const hasModelParam = searchParams.has('model');
        const isGPage = path.startsWith('/g/'); // აქ ვამატებთ სრულ გამონაკლისს

        if (!isGptsMine && !hasModelParam && !isGPage) {
          console.log('[Customizer] URL changed, forcing reload:', currentUrl);
          showLoadingScreen();
          setTimeout(() => {
            location.href = currentUrl;
          }, 300);
        } else {
          console.log('[Customizer] URL changed but excluded from reload:', currentUrl);
        }
      }
    };

    const wrap = (fn) =>
      function (...args) {
        const result = fn.apply(this, args);
        setTimeout(observeNavigation, 50);
        return result;
      };

    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
    window.addEventListener('popstate', observeNavigation);

    const observer = new MutationObserver(observeNavigation);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('hashchange', observeNavigation);
  }

  forceFullReloadOnNavigation();


})();
