const urlInput = document.getElementById('url');
const convertBtn = document.getElementById('convertBtn');
const statusEl = document.getElementById('status');
const progressEl = document.getElementById('currentProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const queueList = document.getElementById('queueList');
const historyList = document.getElementById('historyList');
const settingsLink = document.getElementById('settingsLink');
const backendStatus = document.getElementById('backendStatus');

settingsLink.href = chrome.runtime.getURL('options/options.html');

function cleanUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.pathname === '/results' && u.searchParams.has('search_query')) {
      return null;
    }
    const id = u.searchParams.get('v');
    if (id) return `https://www.youtube.com/watch?v=${id}`;
  } catch {}
  return url;
}

async function swMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) => resolve(res));
  });
}

async function checkBackend() {
  try {
    const settings = await swMessage({ type: 'GET_SETTINGS' });
    const backend = (settings.backend || 'http://localhost:8000').replace(/\/+$/, '');
    const res = await fetch(`${backend}/health`);
    backendStatus.classList.add(res.ok ? 'ok' : 'err');
    backendStatus.title = res.ok ? 'Backend connected' : 'Backend unreachable';
  } catch {
    backendStatus.classList.add('err');
    backendStatus.title = 'Backend unreachable';
  }
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach((c) => c.classList.toggle('active', c.id === `tab-${name}`));
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

function formatDuration(seconds) {
  if (!seconds) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderBadge(status) {
  const map = {
    queued: '<span class="badge badge-queued">Queued</span>',
    processing: '<span class="badge badge-processing">Processing</span>',
    completed: '<span class="badge badge-completed">Done</span>',
    failed: '<span class="badge badge-failed">Failed</span>',
  };
  return map[status] || status;
}

async function refreshData() {
  const data = await swMessage({ type: 'GET_QUEUE' });
  renderQueue(data.queue || []);
  renderHistory(data.history || []);
}

function renderQueue(items) {
  if (!items.length) {
    queueList.innerHTML = '<div class="empty">No active conversions</div>';
    return;
  }
  queueList.innerHTML = items
    .map((item) => {
      const isActive = item.status === 'queued' || item.status === 'processing';
      return `
        <div class="item">
          <div class="item-title" title="${item.url}">${item.title || item.url}</div>
          <div class="item-meta">
            ${renderBadge(item.status)}
            <span>${item.message || ''}</span>
          </div>
          ${isActive ? `
          <div class="progress" style="margin-top:6px;">
            <div class="progress-bar"><div class="progress-fill" style="width:${item.progress || 0}%"></div></div>
            <div class="progress-text">${item.progress || 0}%</div>
          </div>` : ''}
          <div class="item-actions">
            ${item.status === 'failed' ? `<button class="btn-xs btn-primary" data-action="retry" data-jid="${item.jobId}">Retry</button>` : ''}
            <button class="btn-xs btn-ghost" data-action="remove" data-jid="${item.jobId}">Remove</button>
          </div>
        </div>
      `;
    })
    .join('');

  queueList.querySelectorAll('button[data-action="retry"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const res = await swMessage({ type: 'RETRY_JOB', jobId: btn.dataset.jid });
      if (res.ok) refreshData();
    });
  });
  queueList.querySelectorAll('button[data-action="remove"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await swMessage({ type: 'REMOVE_JOB', jobId: btn.dataset.jid });
      refreshData();
    });
  });
}

function renderHistory(items) {
  if (!items.length) {
    historyList.innerHTML = '<div class="empty">No history yet</div>';
    return;
  }
  historyList.innerHTML = items
    .map((item) => `
      <div class="item">
        <div class="item-title" title="${item.url}">${item.title || item.url}</div>
        <div class="item-meta">
          ${renderBadge(item.status)}
          <span>${formatDuration(item.duration)} · ${formatTime(item.addedAt)}</span>
        </div>
      </div>
    `)
    .join('');
}

async function convert() {
  const url = cleanUrl(urlInput.value.trim());
  if (!url) {
    statusEl.textContent = 'Error: Open a specific YouTube video to convert';
    return;
  }
  convertBtn.disabled = true;
  statusEl.textContent = 'Starting...';
  progressEl.classList.add('hidden');
  try {
    const res = await swMessage({ type: 'CONVERT', url });
    if (!res || !res.ok) throw new Error(res?.error || 'Conversion failed');
    statusEl.textContent = 'Converting...';
    progressEl.classList.remove('hidden');
    urlInput.value = '';
    refreshData();
    switchTab('queue');
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

(async () => {
  await checkBackend();
  await swMessage({ type: 'SYNC_QUEUE' });
  await refreshData();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url && (tab.url.includes('youtube.com') || tab.url.includes('youtu.be'))) {
    urlInput.value = tab.url;
  }
})();

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'QUEUE_UPDATED') {
    refreshData();
  }
});

setInterval(checkBackend, 30000);
