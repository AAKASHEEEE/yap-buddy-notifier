(function(){
  const DEFAULTS = {
    enabled: false,
    ttlMinutes: 10,
    telemetry: false,
    followedOnly: false,
    minYap: 0,
    backendUrl: "" // e.g. https://<project>.supabase.co/functions/v1/get-yap
  };

  const cache = new Map(); // session cache
  let settings = { ...DEFAULTS };
  let processing = false;
  const pending = new Set();

  function log(...args){ if(settings.telemetry) console.log("[Yaps]", ...args); }

  function getNow(){ return Date.now(); }

  async function loadSettings(){
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULTS, (items) => {
        settings = { ...DEFAULTS, ...items };
        resolve(settings);
      });
    });
  }

  function onSettingsChanged(changes){
    if(changes && changes.sync){
      settings = { ...settings, ...changes.sync.newValue };
    }
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if(areaName === 'sync'){
      const merged = { ...settings };
      for(const k in changes){ merged[k] = changes[k].newValue; }
      settings = merged;
      log('Settings updated', settings);
    }
  });

  function isValidHandle(h){ return /^[A-Za-z0-9_]{1,15}$/.test(h); }

  function extractHandlesFromDOM(root=document){
    const handles = new Set();
    // Strategy: anchor links to profiles and spans that start with '@'
    root.querySelectorAll('a[href^="/"]').forEach(a => {
      const href = a.getAttribute('href') || '';
      const candidate = href.split('?')[0].slice(1);
      if(isValidHandle(candidate)) handles.add(candidate);
    });
    root.querySelectorAll('span').forEach(s => {
      const text = s.textContent || '';
      if(text.startsWith('@')){
        const candidate = text.replace('@','').trim();
        if(isValidHandle(candidate)) handles.add(candidate);
      }
    });
    return Array.from(handles);
  }

  function getCache(username){
    const entry = cache.get(username);
    if(!entry) return null;
    if(getNow() - entry.ts > settings.ttlMinutes * 60 * 1000){
      cache.delete(username);
      return null;
    }
    return entry.data;
  }

  function setCache(username, data){
    cache.set(username, { ts: getNow(), data });
    // also persist a lightweight cache in chrome.storage.local
    chrome.storage.local.set({ [`yap:${username}`]: { ts: getNow(), data } });
  }

  async function getFromLocalStorage(username){
    return new Promise(resolve => {
      chrome.storage.local.get(`yap:${username}`, (obj) => {
        const entry = obj[`yap:${username}`];
        if(entry && (getNow() - entry.ts) < settings.ttlMinutes * 60 * 1000){
          resolve(entry.data);
        } else resolve(null);
      });
    });
  }

  async function fetchBatch(usernames){
    if(!settings.backendUrl){
      return usernames.map(u => ({ username: u, error: 'backend_not_configured' }));
    }
    const url = `${settings.backendUrl}?usernames=${encodeURIComponent(usernames.join(','))}&ttl=${settings.ttlMinutes*60*1000}`;
    try {
      const res = await fetch(url, { credentials: 'omit' });
      if(!res.ok) throw new Error('bad_status_'+res.status);
      const json = await res.json();
      return Array.isArray(json) ? json : [json];
    } catch (e){
      log('fetch error', e);
      return usernames.map(u => ({ username: u, error: 'network' }));
    }
  }

  function makeBadge(data){
    const el = document.createElement('span');
    el.className = 'kaito-yap-badge';
    const val = data?.score_total ?? '-';
    el.textContent = `⼿ ${val}`; // subtle icon-like glyph
    el.setAttribute('aria-label', `Kaito Yap score: ${val}`);

    const card = document.createElement('div');
    card.className = 'kaito-yap-card';
    card.innerHTML = `
      <div class="ky-row ky-username">@${data.username}</div>
      <div class="ky-row ky-total"><strong>${val}</strong> total</div>
      <div class="ky-grid">
        <div>24h: <b>${data?.score_24h ?? '-'}</b></div>
        <div>7d: <b>${data?.score_7d ?? '-'}</b></div>
        <div>30d: <b>${data?.score_30d ?? '-'}</b></div>
      </div>
      <div class="ky-meta">${data.cached ? 'cached • ' : ''}updated ${new Date(data.last_updated_at || Date.now()).toLocaleTimeString()}</div>
    `;
    el.addEventListener('mouseenter', () => card.classList.add('open'));
    el.addEventListener('mouseleave', () => card.classList.remove('open'));
    el.appendChild(card);
    if(data?.error){ el.classList.add('is-error'); el.setAttribute('title', data.error); }
    return el;
  }

  function attachBadgeToNode(node, data){
    if(!node || node.closest('.kaito-yap-attached')) return;
    const container = document.createElement('span');
    container.className = 'kaito-yap-attached';
    container.appendChild(makeBadge(data));
    node.insertAdjacentElement('afterend', container);
  }

  function findHandleNodes(){
    const nodes = new Map();
    document.querySelectorAll('a[href^="/"]').forEach(a => {
      const href = a.getAttribute('href') || '';
      const handle = href.split('?')[0].slice(1);
      if(isValidHandle(handle)){
        nodes.set(handle, a);
      }
    });
    return nodes;
  }

  async function process(){
    if(processing || !settings.enabled) return;
    processing = true;
    try{
      const nodes = findHandleNodes();
      const toQuery = [];
      for(const [handle, node] of nodes){
        if(node?.nextSibling && (node.nextSibling as HTMLElement)?.classList?.contains('kaito-yap-attached')) continue;
        let data = getCache(handle) || await getFromLocalStorage(handle);
        if(data){
          setCache(handle, data);
          attachBadgeToNode(node, data);
        } else {
          pending.add(handle);
        }
      }
      const all = Array.from(pending);
      pending.clear();
      while(all.length){
        const batch = all.splice(0, 10);
        const results = await fetchBatch(batch);
        results.forEach(r => {
          setCache(r.username, r);
          const nodesNow = findHandleNodes();
          const node = nodesNow.get(r.username);
          if(node) attachBadgeToNode(node, r);
        });
      }
    } finally {
      processing = false;
    }
  }

  function init(){
    loadSettings().then(() => {
      if(!settings.enabled) return;
      process();
      const mo = new MutationObserver(() => process());
      mo.observe(document.documentElement, { childList: true, subtree: true });
      window.addEventListener('scroll', () => process(), { passive: true });
    });
  }

  // Kick off when DOM ready
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
