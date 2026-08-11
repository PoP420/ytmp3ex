async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (result) => {
      resolve(result.settings || { backend: 'http://localhost:8000', autoConvert: false });
    });
  });
}

function getVideoId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('v');
}

function getVideoUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('v');
  return id ? `https://www.youtube.com/watch?v=${id}` : window.location.href;
}

async function convertToMp3(url) {
  const settings = await getSettings();
  const res = await fetch(`${settings.backend}/api/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  if (!res.ok) throw new Error('Conversion failed');
  return res.json();
}

function injectButton() {
  if (document.getElementById('ytmp3ex-btn')) return;
  const target =
    document.querySelector('ytd-menu-renderer #top-level-buttons-computed') ||
    document.querySelector('#top-level-buttons-computed') ||
    document.querySelector('#actions-inner') ||
    document.querySelector('ytd-actions') ||
    document.querySelector('#owner');
  if (!target) return;

  const btn = document.createElement('button');
  btn.id = 'ytmp3ex-btn';
  btn.textContent = 'Download';
  btn.style.cssText = 'background:#ff0000;color:#fff;border:none;border-radius:18px;padding:0 16px;height:36px;margin-left:8px;cursor:pointer;font-weight:500;';
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = '...';
    try {
      const data = await convertToMp3(getVideoUrl());
      const settings = await getSettings();
      chrome.downloads.download({
        url: `${settings.backend}/api/download/${data.id}`,
        filename,
        saveAs: false
      });
      btn.textContent = '✓';
    } catch (e) {
      btn.textContent = '!';
      console.error(e);
    } finally {
      setTimeout(() => { btn.disabled = false; btn.textContent = 'Download'; }, 2000);
    }
  });
  target.appendChild(btn);
}

(async function init() {
  const settings = await getSettings();
  if (!settings.autoConvert) return;
  if (!getVideoId()) return;
  const tryInject = () => {
    if (document.readyState === 'complete') injectButton();
  };
  tryInject();
  new MutationObserver(tryInject).observe(document.body, { childList: true, subtree: true });
})();
