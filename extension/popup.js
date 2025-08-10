const DEFAULTS = {
  enabled: true,
  ttlMinutes: 10,
  telemetry: false,
  followedOnly: false,
  minYap: 0,
  backendUrl: ""
};

function $(id){ return document.getElementById(id); }

function load(){
  chrome.storage.sync.get(DEFAULTS, (cfg) => {
    $('enabled').checked = cfg.enabled;
    $('ttl').value = cfg.ttlMinutes;
    $('ttlVal').textContent = `${cfg.ttlMinutes}m`;
  });
}

// settings auto-save on change; no manual save button

function clearCache(){
  chrome.storage.local.get(null, (items) => {
    const keys = Object.keys(items).filter(k => k.startsWith('yap:'));
    chrome.storage.local.remove(keys, () => window.close());
  });
}

window.addEventListener('DOMContentLoaded', () => {
  load();
  $('ttl').addEventListener('input', () => $('ttlVal').textContent = `${$('ttl').value}m`);
  $('ttl').addEventListener('change', () => chrome.storage.sync.set({ ttlMinutes: Number($('ttl').value) }));
  $('enabled').addEventListener('change', () => chrome.storage.sync.set({ enabled: $('enabled').checked }));
  $('clearCache').addEventListener('click', clearCache);
  $('privacy').addEventListener('click', (e) => {
    e.preventDefault();
    alert('Privacy: Only usernames are sent to the backend, cached for a limited time. No browsing content or cookies are collected.');
  });
});
