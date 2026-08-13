const ALARM_POLL = 'ytmp3ex-poll';
const POLL_INTERVAL_MINUTES = 1;

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (result) => {
      resolve(result.settings || { backend: 'http://localhost:8000', quality: '192', autoConvert: false });
    });
  });
}

async function getBackend() {
  const s = await getSettings();
  return (s.backend || 'http://localhost:8000').replace(/\/+$/, '');
}

async function queue() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['queue'], (result) => resolve(result.queue || []));
  });
}

async function setQueue(q) {
  chrome.storage.local.set({ queue: q });
}

async function history() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['history'], (result) => resolve(result.history || []));
  });
}

async function setHistory(h) {
  chrome.storage.local.set({ history: h });
}

async function addToHistory(item) {
  const h = await history();
  h.unshift({ ...item, addedAt: Date.now() });
  if (h.length > 50) h.length = 50;
  await setHistory(h);
}

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: 'basic',
      title: title || 'ytmp3ex',
      message: message || 'Conversion complete',
      priority: 2,
    });
  } catch {}
}

async function pollJob(jobId) {
  try {
    const backend = await getBackend();
    const res = await fetch(`${backend}/api/jobs/${jobId}`);
    if (!res.ok) {
      const status = res.status;
      let message = 'Unknown error';
      if (status === 404) message = 'Job not found';
      else if (status === 500) message = 'Server error';
      else message = `HTTP ${status}`;
      return { status: 'error', message, code: status };
    }
    return await res.json();
  } catch (e) {
    return { status: 'error', message: e.message || 'Network error', code: null };
  }
}

async function processQueue() {
  const q = await queue();
  const activeIds = q.filter((j) => j.status === 'queued' || j.status === 'processing').map((j) => j.jobId);
  if (!activeIds.length) return;

  for (const jobId of activeIds) {
    const current = await queue();
    const idx = current.findIndex((j) => j.jobId === jobId);
    if (idx === -1) continue;

    const job = await pollJob(jobId);
    if (!job || job.status === 'error') {
      if (job && job.status === 'error') {
        current[idx].status = 'failed';
        current[idx].message = job.message || 'Failed';
        await setQueue(current);
      }
      continue;
    }

    if (job.status === 'completed') {
      current[idx].status = 'completed';
      current[idx].progress = 100;
      current[idx].message = 'Done';
      current[idx].title = job.title;
      current[idx].duration = job.duration;
      current[idx].thumbnail = job.thumbnail;
      current[idx].file_path = job.file_path;
      await setQueue(current);

      const backend = await getBackend();
      try {
        chrome.downloads.download({
          url: `${backend}/api/download/${job.id}`,
          filename: `${job.title || job.id}.mp3`,
          saveAs: false,
        });
      } catch (e) {
        console.error('Download failed', e);
      }

      await addToHistory({
        jobId: job.id,
        title: job.title,
        status: 'completed',
        duration: job.duration,
        url: current[idx].url,
      });

      notify('Conversion Complete', `${job.title || 'MP3'} is ready`);
    } else if (job.status === 'failed') {
      current[idx].status = 'failed';
      current[idx].message = job.message || 'Failed';
      await setQueue(current);
    } else {
      current[idx].progress = job.progress || 0;
      current[idx].message = job.message || 'Processing...';
      if (job.status === 'processing' && current[idx].status === 'queued') {
        current[idx].status = 'processing';
      }
      await setQueue(current);
    }
  }

  const updated = await queue();
  const filtered = updated.filter((j) => j.status === 'queued' || j.status === 'processing');
  if (filtered.length !== updated.length) {
    await setQueue(filtered);
  }

  chrome.runtime.sendMessage({ type: 'QUEUE_UPDATED' }).catch(() => {});
}

function startPolling() {
  if (chrome.alarms.get(ALARM_POLL)) return;
  chrome.alarms.create(ALARM_POLL, { periodInMinutes: POLL_INTERVAL_MINUTES });
}

function stopPolling() {
  chrome.alarms.clear(ALARM_POLL);
}

async function checkQueueActivity() {
  const q = await queue();
  const active = q.some((j) => j.status === 'queued' || j.status === 'processing');
  if (active) {
    startPolling();
  } else {
    stopPolling();
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === 'CONVERT') {
      try {
        const settings = await getSettings();
        const backend = settings.backend || 'http://localhost:8000';
          const res = await fetch(`${backend}/api/convert/async`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: msg.url, quality: settings.quality || '192' }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Failed to start conversion');
        }
        const data = await res.json();
        const q = await queue();
        q.push({
          jobId: data.job_id,
          url: msg.url,
          status: 'queued',
          progress: 0,
          message: 'Starting...',
          addedAt: Date.now(),
        });
        await setQueue(q);
        startPolling();
        chrome.runtime.sendMessage({ type: 'QUEUE_UPDATED' }).catch(() => {});
        return { ok: true, jobId: data.job_id };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    } else if (msg.type === 'GET_QUEUE') {
      const q = await queue();
      const h = await history();
      return { queue: q, history: h.slice(0, 20) };
    } else if (msg.type === 'SYNC_QUEUE') {
      await processQueue();
      return { ok: true };
    } else if (msg.type === 'GET_SETTINGS') {
      const s = await getSettings();
      return s;
    } else if (msg.type === 'SETTINGS_UPDATED') {
      await chrome.storage.local.set({ settings: msg.settings });
      return { ok: true };
    } else if (msg.type === 'RETRY_JOB') {
      const q = await queue();
      const job = q.find((j) => j.jobId === msg.jobId);
      if (job && job.status === 'failed') {
        job.status = 'queued';
        job.progress = 0;
        job.message = 'Retrying...';
        await setQueue(q);
        try {
          const settings = await getSettings();
          const backend = settings.backend || 'http://localhost:8000';
          const res = await fetch(`${backend}/api/convert/async`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: job.url, quality: settings.quality || '192' }),
          });
          if (!res.ok) throw new Error('Retry failed');
          const data = await res.json();
          job.jobId = data.job_id;
          await setQueue(q);
          startPolling();
          return { ok: true };
        } catch (e) {
          job.status = 'failed';
          job.message = e.message;
          await setQueue(q);
          return { ok: false, error: e.message };
        }
      } else {
        return { ok: false, error: 'Job not found or not failed' };
      }
    } else if (msg.type === 'REMOVE_JOB') {
      const q = await queue();
      const filtered = q.filter((j) => j.jobId !== msg.jobId);
      await setQueue(filtered);
      return { ok: true };
    }
    return {};
  })().then(
    (res) => sendResponse(res),
    (err) => sendResponse({ ok: false, error: err.message })
  );
  return true;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_POLL) {
    await processQueue();
    await checkQueueActivity();
  }
});

chrome.runtime.onStartup.addListener(checkQueueActivity);
chrome.runtime.onInstalled.addListener(checkQueueActivity);
checkQueueActivity();
