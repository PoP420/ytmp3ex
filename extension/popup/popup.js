const urlInput = document.getElementById('url');
const convertBtn = document.getElementById('convertBtn');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const infoEl = document.getElementById('info');
const settingsLink = document.getElementById('settingsLink');

const BACKEND = 'http://localhost:8000';

function cleanUrl(url) {
  try {
    const u = new URL(url);
    const id = u.searchParams.get('v');
    if (id) return `https://www.youtube.com/watch?v=${id}`;
  } catch {}
  return url;
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (result) => {
      resolve(result.settings || { backend: 'http://localhost:8000' });
    });
  });
}

settingsLink.href = chrome.runtime.getURL('options/options.html');

async function detectVideo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.includes('youtube.com') && !tab.url.includes('youtu.be')) {
    statusEl.textContent = 'Not on YouTube';
    urlInput.value = tab?.url || '';
    return;
  }
  statusEl.textContent = 'YouTube detected';
  urlInput.value = tab.url;
}

async function convert() {
  const url = urlInput.value.trim();
  if (!url) return;
  convertBtn.disabled = true;
  statusEl.textContent = 'Converting...';
  resultEl.classList.add('hidden');
  try {
    const res = await fetch(`${BACKEND}/api/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cleanUrl(url) })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Conversion failed');
    }
    const data = await res.json();
    chrome.downloads.download({
      url: `${BACKEND}/api/download/${data.id}`,
      filename: `${data.title || data.id}.mp3`,
      saveAs: false
    });
    infoEl.textContent = `${data.title} (${data.duration || '?'}s)`;
    resultEl.classList.remove('hidden');
    statusEl.textContent = 'Done';
  } catch (e) {
    statusEl.textContent = 'Error: ' + e.message;
  } finally {
    convertBtn.disabled = false;
  }
}

convertBtn.addEventListener('click', convert);
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') convert();
});

detectVideo();
