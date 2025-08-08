const DEFAULTS = {
  enabled: false,
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
    $('telemetry').checked = cfg.telemetry;
    $('followedOnly').checked = cfg.followedOnly;
    $('backendUrl').value = cfg.backendUrl || '';
  });
}

function save(){
  const cfg = {
    enabled: $('enabled').checked,
    ttlMinutes: Number($('ttl').value),
    telemetry: $('telemetry').checked,
    followedOnly: $('followedOnly').checked,
    backendUrl: $('backendUrl').value.trim()
  };
  chrome.storage.sync.set(cfg, () => window.close());
}

function clearCache(){
  chrome.storage.local.get(null, (items) => {
    const keys = Object.keys(items).filter(k => k.startsWith('yap:'));
    chrome.storage.local.remove(keys, () => window.close());
  });
}

window.addEventListener('DOMContentLoaded', () => {
  load();
  $('ttl').addEventListener('input', () => $('ttlVal').textContent = `${$('ttl').value}m`);
  $('save').addEventListener('click', save);
  $('clearCache').addEventListener('click', clearCache);
  $('privacy').addEventListener('click', (e) => {
    e.preventDefault();
    alert('Privacy: Only usernames are sent to the backend, cached for a limited time. No browsing content or cookies are collected.');
  });
});
