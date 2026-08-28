(function () {
  'use strict';

  const STORY_PATH_REGEX = /^\/stories\//;
  const ANIMATION_DURATION_MS = 3000;
  const HUD_ID = 'vox-ai-hud';
  const OVERLAY_ID = 'vox-ai-overlay';
  const DASHBOARD_URL = 'http://localhost:3000/dashboard';
  const STORAGE_KEYS = {
    sessionActive: 'vox_sessionActive',
    sessionStartTime: 'vox_sessionStartTime',
    storiesAnalysed: 'vox_storiesAnalysed',
    highPriorityCount: 'vox_highPriorityCount',
    currentStoryProgress: 'vox_currentStoryProgress'
  };

  let overlayRoot = null;
  let progressFill = null;
  let statusBadge = null;
  let alertBanner = null;
  let animationFrameId = null;
  let animationStartTime = null;
  let sessionActive = false;

  function isOnStoryUrl() {
    return STORY_PATH_REGEX.test(window.location.pathname);
  }

  function updateStorage(updates) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local)
        chrome.storage.local.set(updates).catch(function () {});
    } catch (e) { /* extension context invalidated */ }
  }

  function createOverlay() {
    if (overlayRoot) return overlayRoot;

    const container = document.createElement('div');
    container.id = OVERLAY_ID;
    container.setAttribute('data-vox-hud', HUD_ID);
    container.className = 'vox-ai-hud';

    const badge = document.createElement('div');
    badge.className = 'vox-ai-hud__badge';
    badge.textContent = 'VOX AI Monitoring';
    statusBadge = badge;

    const barWrap = document.createElement('div');
    barWrap.className = 'vox-ai-hud__bar-wrap';
    const barTrack = document.createElement('div');
    barTrack.className = 'vox-ai-hud__bar-track';
    const barFill = document.createElement('div');
    barFill.className = 'vox-ai-hud__bar-fill';
    barFill.style.width = '0%';
    progressFill = barFill;
    barTrack.appendChild(barFill);
    barWrap.appendChild(barTrack);

    const alertEl = document.createElement('div');
    alertEl.className = 'vox-ai-hud__alert vox-ai-hud__alert--hidden';
    alertEl.setAttribute('aria-live', 'assertive');
    alertEl.innerHTML = '<span class="vox-ai-hud__alert-icon" aria-hidden="true">⚠</span> High priority';
    alertBanner = alertEl;

    const dashboardLink = document.createElement('a');
    dashboardLink.className = 'vox-ai-hud__dashboard-link';
    dashboardLink.href = DASHBOARD_URL;
    dashboardLink.target = '_blank';
    dashboardLink.rel = 'noopener noreferrer';
    dashboardLink.textContent = 'Dashboard';

    const dragHandle = document.createElement('div');
    dragHandle.className = 'vox-ai-hud__drag-handle';
    dragHandle.setAttribute('title', 'Drag to move');
    dragHandle.setAttribute('aria-label', 'Drag to move panel');
    const grip = document.createElement('span');
    grip.className = 'vox-ai-hud__grip';
    grip.textContent = '\u22EE';
    dragHandle.appendChild(grip);
    dragHandle.appendChild(badge);

    const row = document.createElement('div');
    row.className = 'vox-ai-hud__row';
    row.appendChild(dragHandle);
    row.appendChild(barWrap);
    row.appendChild(alertEl);
    row.appendChild(dashboardLink);
    container.appendChild(row);
    document.body.appendChild(container);
    overlayRoot = container;
    makeOverlayDraggable(container);
    return overlayRoot;
  }

  function makeOverlayDraggable(el) {
    var dragging = false;
    var startX, startY, startLeft, startTop;
    var handle = el.querySelector('.vox-ai-hud__drag-handle');
    if (!handle) return;

    function onMouseMove(e) {
      if (!dragging) return;
      e.preventDefault();
      e.stopPropagation();
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      el.style.left = (startLeft + dx) + 'px';
      el.style.top = (startTop + dy) + 'px';
    }

    function onMouseUp() {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('vox-ai-hud--dragging');
      window.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('mouseup', onMouseUp, true);
    }

    handle.addEventListener('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      var rect = el.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      el.classList.add('vox-ai-hud--dragging');
      el.style.right = 'auto';
      el.style.left = startLeft + 'px';
      el.style.top = startTop + 'px';
      window.addEventListener('mousemove', onMouseMove, true);
      window.addEventListener('mouseup', onMouseUp, true);
    }, true);
  }

  function removeOverlay() {
    if (animationFrameId != null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    updateStorage({ [STORAGE_KEYS.currentStoryProgress]: 0 });
    if (overlayRoot && overlayRoot.parentNode) {
      overlayRoot.parentNode.removeChild(overlayRoot);
      overlayRoot = null;
      progressFill = null;
      statusBadge = null;
      alertBanner = null;
    }
  }

  function clearRiskState() {
    if (alertBanner) alertBanner.classList.add('vox-ai-hud__alert--hidden');
    if (overlayRoot) {
      overlayRoot.classList.remove('vox-ai-hud--low-risk', 'vox-ai-hud--medium-risk', 'vox-ai-hud--high-risk');
    }
  }

  function setRiskLevel(level) {
    clearRiskState();
    if (!overlayRoot) return;
    if (level === 'high') {
      if (statusBadge) statusBadge.textContent = 'Flag for review (high sensitivity)';
      overlayRoot.classList.add('vox-ai-hud--high-risk');
      if (alertBanner) alertBanner.classList.remove('vox-ai-hud__alert--hidden');
    } else if (level === 'medium') {
      if (statusBadge) statusBadge.textContent = 'Review priority: Medium';
      overlayRoot.classList.add('vox-ai-hud--medium-risk');
    } else {
      if (statusBadge) statusBadge.textContent = 'Review priority: Low';
      overlayRoot.classList.add('vox-ai-hud--low-risk');
    }
  }

  function setProgress(percent) {
    if (progressFill) progressFill.style.width = percent + '%';
    updateStorage({ [STORAGE_KEYS.currentStoryProgress]: Math.round(percent) });
  }

  function setStatus(text) {
    if (statusBadge) statusBadge.textContent = text;
  }

  function runLoadingAnimation() {
    if (!overlayRoot || !progressFill || !statusBadge) return;

    clearRiskState();
    setStatus('Analysing…');
    setProgress(0);

    if (animationFrameId != null) {
      cancelAnimationFrame(animationFrameId);
    }

    animationStartTime = null;
    function tick(timestamp) {
      if (animationStartTime == null) animationStartTime = timestamp;
      const elapsed = timestamp - animationStartTime;
      const percent = Math.min(100, (elapsed / ANIMATION_DURATION_MS) * 100);
      setProgress(percent);

      if (percent >= 100) {
        var r = Math.random();
        var riskLevel = r < 0.95 ? 'high' : r < 0.05 ? 'medium' : 'low';
        if (sessionActive) {
          try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              chrome.storage.local.get([STORAGE_KEYS.storiesAnalysed, STORAGE_KEYS.highPriorityCount], function (result) {
                try {
                  var stories = (result[STORAGE_KEYS.storiesAnalysed] || 0) + 1;
                  var highPriority = (result[STORAGE_KEYS.highPriorityCount] || 0) + (riskLevel === 'high' ? 1 : 0);
                  updateStorage({
                    [STORAGE_KEYS.storiesAnalysed]: stories,
                    [STORAGE_KEYS.highPriorityCount]: highPriority
                  });
                } catch (e) { /* context invalidated in callback */ }
              });
            }
          } catch (e) { /* extension context invalidated */ }
        }
        setRiskLevel(riskLevel);
        animationFrameId = null;
        return;
      }
      animationFrameId = requestAnimationFrame(tick);
    }
    animationFrameId = requestAnimationFrame(tick);
  }

  function syncOverlay() {
    if (isOnStoryUrl()) {
      createOverlay();
      runLoadingAnimation();
    } else {
      removeOverlay();
    }
  }

  function refreshSessionState() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STORAGE_KEYS.sessionActive], function (result) {
          try {
            sessionActive = !!result[STORAGE_KEYS.sessionActive];
            syncOverlay();
          } catch (e) { syncOverlay(); }
        });
      } else {
        syncOverlay();
      }
    } catch (e) {
      syncOverlay();
    }
  }

  function initHistoryHooks() {
    const origPushState = history.pushState;
    const origReplaceState = history.replaceState;

    history.pushState = function () {
      origPushState.apply(this, arguments);
      syncOverlay();
    };
    history.replaceState = function () {
      origReplaceState.apply(this, arguments);
      syncOverlay();
    };

    window.addEventListener('popstate', syncOverlay);
  }

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function (changes, areaName) {
        try {
          if (areaName !== 'local') return;
          if (changes[STORAGE_KEYS.sessionActive]) {
            sessionActive = !!changes[STORAGE_KEYS.sessionActive].newValue;
            syncOverlay();
          }
        } catch (e) { /* context invalidated */ }
      });
    }
  } catch (e) { /* extension context invalidated */ }

  function init() {
    initHistoryHooks();
    refreshSessionState();
    if (isOnStoryUrl()) {
      setTimeout(function () {
        if (document.body && !overlayRoot) syncOverlay();
      }, 100);
    }
    syncOverlay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
