import { createRoot } from 'react-dom/client';
import Sidebar from './components/Sidebar';

// #region agent log
fetch('http://127.0.0.1:7243/ingest/ecd93af8-bad7-493b-ad3e-960f7ec10337',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.tsx:4',message:'Content script loaded',data:{readyState:document.readyState,url:location.href},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion

// Inject sidebar into Instagram page
function injectSidebar() {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/ecd93af8-bad7-493b-ad3e-960f7ec10337',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.tsx:9',message:'injectSidebar called',data:{bodyExists:!!document.body,existingSidebar:!!document.getElementById('vox-copilot-sidebar')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  // Check if sidebar already exists
  if (document.getElementById('vox-copilot-sidebar')) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/ecd93af8-bad7-493b-ad3e-960f7ec10337',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.tsx:12',message:'Sidebar already exists, skipping',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return;
  }

  try {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/ecd93af8-bad7-493b-ad3e-960f7ec10337',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.tsx:18',message:'Creating sidebar container',data:{bodyExists:!!document.body},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    // Create sidebar container
    const sidebarContainer = document.createElement('div');
    sidebarContainer.id = 'vox-copilot-sidebar';
    document.body.appendChild(sidebarContainer);

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/ecd93af8-bad7-493b-ad3e-960f7ec10337',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.tsx:24',message:'Before createRoot',data:{containerInDOM:!!document.getElementById('vox-copilot-sidebar')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    // Render React component
    const root = createRoot(sidebarContainer);
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/ecd93af8-bad7-493b-ad3e-960f7ec10337',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.tsx:28',message:'Before root.render',data:{rootCreated:!!root},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    root.render(<Sidebar />);
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/ecd93af8-bad7-493b-ad3e-960f7ec10337',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.tsx:32',message:'Sidebar injected successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    console.log('VOX Co-pilot sidebar injected successfully');
  } catch (error) {
    // #region agent log
    const err = error as Error;
    fetch('http://127.0.0.1:7243/ingest/ecd93af8-bad7-493b-ad3e-960f7ec10337',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.tsx:36',message:'Error in injectSidebar',data:{errorName:err?.name,errorMessage:err?.message,errorStack:err?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    console.error('VOX Co-pilot: Failed to inject sidebar', error);
  }
}

// Wait for page to load
// #region agent log
fetch('http://127.0.0.1:7243/ingest/ecd93af8-bad7-493b-ad3e-960f7ec10337',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.tsx:42',message:'Checking DOM ready state',data:{readyState:document.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
// #endregion

if (document.readyState === 'loading') {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/ecd93af8-bad7-493b-ad3e-960f7ec10337',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.tsx:45',message:'DOM still loading, adding DOMContentLoaded listener',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  document.addEventListener('DOMContentLoaded', injectSidebar);
} else {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/ecd93af8-bad7-493b-ad3e-960f7ec10337',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.tsx:48',message:'DOM ready, scheduling injectSidebar',data:{readyState:document.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  // Use setTimeout to ensure DOM is ready
  setTimeout(injectSidebar, 100);
}

// Re-inject on navigation (Instagram is a SPA)
let lastUrl = location.href;
// #region agent log
fetch('http://127.0.0.1:7243/ingest/ecd93af8-bad7-493b-ad3e-960f7ec10337',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.tsx:55',message:'Setting up navigation observer',data:{initialUrl:lastUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
// #endregion

const observer = new MutationObserver(() => {
  const url = location.href;
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/ecd93af8-bad7-493b-ad3e-960f7ec10337',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.tsx:59',message:'MutationObserver callback triggered',data:{currentUrl:url,lastUrl:lastUrl,urlChanged:url!==lastUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  
  if (url !== lastUrl) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/ecd93af8-bad7-493b-ad3e-960f7ec10337',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.tsx:63',message:'URL changed, re-injecting sidebar',data:{oldUrl:lastUrl,newUrl:url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    lastUrl = url;
    // Remove existing sidebar before re-injecting
    const existing = document.getElementById('vox-copilot-sidebar');
    if (existing) {
      existing.remove();
    }
    setTimeout(injectSidebar, 1000);
  }
});

// Start observing after a delay to avoid conflicts
// #region agent log
fetch('http://127.0.0.1:7243/ingest/ecd93af8-bad7-493b-ad3e-960f7ec10337',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.tsx:75',message:'Scheduling observer start',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
// #endregion

setTimeout(() => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/ecd93af8-bad7-493b-ad3e-960f7ec10337',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.tsx:78',message:'Starting MutationObserver',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  observer.observe(document, { subtree: true, childList: true });
}, 2000);
