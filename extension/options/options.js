const defaults = { backend: 'http://localhost:8000', quality: '192', autoConvert: false };

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (result) => {
      resolve(result.settings || { ...defaults });
    });
  });
}

async function load() {
  const settings = await getSettings();
  document.getElementById('backend').value = settings.backend || defaults.backend;
  document.getElementById('quality').value = settings.quality || defaults.quality;
  document.getElementById('autoConvert').checked = settings.autoConvert ?? defaults.autoConvert;
}

async function save() {
  const settings = {
    backend: document.getElementById('backend').value.trim() || defaults.backend,
    quality: document.getElementById('quality').value.trim() || defaults.quality,
    autoConvert: document.getElementById('autoConvert').checked,
  };
  await chrome.storage.local.set({ settings });
  await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings }, (res) => resolve(res));
  });
  const status = document.getElementById('status');
  status.textContent = 'Saved';
  setTimeout(() => { status.textContent = ''; }, 1500);
}

document.getElementById('save').addEventListener('click', save);
load();
