(function () {
  'use strict';

  var STORAGE_KEYS = {
    sessionActive: 'vox_sessionActive',
    sessionStartTime: 'vox_sessionStartTime',
    storiesAnalysed: 'vox_storiesAnalysed',
    highPriorityCount: 'vox_highPriorityCount',
    currentStoryProgress: 'vox_currentStoryProgress'
  };

  var idleEl = document.getElementById('vox-idle');
  var activeEl = document.getElementById('vox-active');
  var footerIdleEl = document.getElementById('vox-footer-idle');
  var startBtn = document.getElementById('vox-start-btn');
  var endBtn = document.getElementById('vox-end-btn');
  var timerEl = document.getElementById('vox-timer');
  var barFill = document.getElementById('vox-bar-fill');
  var progressPct = document.getElementById('vox-progress-pct');
  var storiesCountEl = document.getElementById('vox-stories-count');
  var highCountEl = document.getElementById('vox-high-count');

  var timerInterval = null;

  function formatTime(ms) {
    var totalSec = Math.floor(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function updateTimer(startTime) {
    if (!startTime || !timerEl) return;
    var elapsed = Date.now() - startTime;
    timerEl.textContent = formatTime(elapsed);
  }

  function render(storage) {
    var active = !!storage[STORAGE_KEYS.sessionActive];
    var startTime = storage[STORAGE_KEYS.sessionStartTime] || 0;
    var stories = storage[STORAGE_KEYS.storiesAnalysed] || 0;
    var highPriority = storage[STORAGE_KEYS.highPriorityCount] || 0;
    var progress = Math.min(100, Math.max(0, storage[STORAGE_KEYS.currentStoryProgress] || 0));

    if (idleEl) idleEl.hidden = active;
    if (footerIdleEl) footerIdleEl.hidden = active;
    if (activeEl) {
      activeEl.hidden = !active;
      if (active) {
        updateTimer(startTime);
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(function () { updateTimer(startTime); }, 1000);
      } else {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
      }
    }

    if (barFill) barFill.style.width = progress + '%';
    if (progressPct) progressPct.textContent = progress + '%';
    if (storiesCountEl) storiesCountEl.textContent = stories;
    if (highCountEl) highCountEl.textContent = highPriority;
  }

  function loadAndRender() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get([
      STORAGE_KEYS.sessionActive,
      STORAGE_KEYS.sessionStartTime,
      STORAGE_KEYS.storiesAnalysed,
      STORAGE_KEYS.highPriorityCount,
      STORAGE_KEYS.currentStoryProgress
    ], render);
  }

  startBtn.addEventListener('click', function () {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    var payload = {};
    payload[STORAGE_KEYS.sessionActive] = true;
    payload[STORAGE_KEYS.sessionStartTime] = Date.now();
    payload[STORAGE_KEYS.storiesAnalysed] = 0;
    payload[STORAGE_KEYS.highPriorityCount] = 0;
    payload[STORAGE_KEYS.currentStoryProgress] = 0;
    chrome.storage.local.set(payload, loadAndRender);
  });

  endBtn.addEventListener('click', function () {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    var payload = {};
    payload[STORAGE_KEYS.sessionActive] = false;
    chrome.storage.local.set(payload, loadAndRender);
  });

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, areaName) {
      if (areaName !== 'local') return;
      loadAndRender();
    });
  }

  loadAndRender();
})();
