/* ============================================================
   Natasha's Birthday Site
   ============================================================ */

/* ------------------------------------------------------------
   CONTENT — edit these two arrays to add/remove photos & videos.
   Drop real images at the `img` paths and they appear automatically.

   Photo item:  { type:'photo', img:'image/stinky/01.jpg', emoji:'🤪', caption:'...' }
   Video item:  { type:'video', src:'<youtube or drive url>', emoji:'🎬', caption:'...' }
                 (leave src:'' for a "coming soon" placeholder)
   ------------------------------------------------------------ */
const GALLERIES = {
    stinky: [
        { type: 'photo', img: 'image/stinky/01.jpg', emoji: '💤', caption: 'sleeping beauty' },
        { type: 'photo', img: 'image/stinky/02.jpg', emoji: '☀️', caption: 'good morning sunshine' },
        { type: 'video', src: 'video/stinky/01.mov', emoji: '🎬', caption: 'up the hill she goes 😭' },
        { type: 'photo', img: 'image/stinky/03.jpg', emoji: '😐', caption: "caught lacking" },
        { type: 'photo', img: 'image/stinky/04.jpg', emoji: '🧖‍♀️', caption: 'fashion week' },
        { type: 'video', src: 'video/stinky/02.mov', emoji: '🎬', caption: 'always take so long to get ready 💀' },
        { type: 'photo', img: 'image/stinky/05.jpg', emoji: '💇‍♀️', caption: 'the hair said no' },
        { type: 'photo', img: 'image/stinky/06.jpg', emoji: '🌯', caption: 'blanket burrito' },
        { type: 'video', src: 'video/stinky/03.mov', emoji: '🎬', caption: 'SIX SEVEN' },
        { type: 'photo', img: 'image/stinky/07.jpg', emoji: '📸', caption: 'caught in 4k' },
        { type: 'video', src: 'video/stinky/04.mov', emoji: '🎬', caption: 'usual stinkiness' },
        { type: 'video', src: 'video/stinky/05.mov', emoji: '🎬', caption: "forever dancing 😂" },
    ],
    nice: [
        { type: 'photo', img: 'image/nice/01.jpg', emoji: '✨', caption: 'main character energy' },
        { type: 'photo', img: 'image/nice/02.jpg', emoji: '🧢', caption: 'okay the hat ate' },
        { type: 'video', src: 'video/nice/01.mov', emoji: '🎬', caption: "what a cutie 🥹" },
        { type: 'photo', img: 'image/nice/03.jpg', emoji: '🎓', caption: 'she\'s so smart' },
        { type: 'photo', img: 'image/nice/04.jpg', emoji: '🥹', caption: 'mum era' },
        { type: 'video', src: 'video/nice/02.mov', emoji: '🎬', caption: 'my favourite clip of us' },
        { type: 'photo', img: 'image/nice/05.jpg', emoji: '💪', caption: 'my favourite spectator' },
        { type: 'photo', img: 'image/nice/06.jpg', emoji: '💕', caption: 'good things inside' },
        { type: 'video', src: 'video/nice/03.mov', emoji: '🎬', caption: 'party girl 🌷' },
        { type: 'photo', img: 'image/nice/07.jpg', emoji: '🧸', caption: 'our family portrait' },
        { type: 'video', src: 'video/nice/04.mov', emoji: '🎬', caption: 'my dance partner for life <3' },
    ],
};

const TYPED_MESSAGE = 'Happy Birthday NASTINGE!! 💕';
const COUNTDOWN_TARGET = new Date('2026-05-30T00:00:00+08:00');

/* ------------------------------------------------------------
   Polaroid placeholder fallback (when a real image is missing)
   ------------------------------------------------------------ */
function phFallback(img, emoji) {
    const box = img.parentElement; // .pol-img
    if (!box) return;
    box.classList.add('ph');
    box.innerHTML =
        `<div class="ph-inner"><span class="ph-emoji">${emoji}</span>` +
        `<span class="ph-text">coming soon</span></div>`;
}

/* ------------------------------------------------------------
   Render polaroid walls — caption shows first, photo on the flip.
   Tap -> card flips to the cropped photo AND opens the expanded
   view in the lightbox. Closing the lightbox leaves the cropped
   polaroid behind, so the wall "develops" into a photo gallery.
   ------------------------------------------------------------ */
function renderWall(id, items) {
    const wall = document.getElementById(id);
    if (!wall) return;

    items.forEach((item) => {
        const tilt = (Math.random() * 6 - 3).toFixed(1) + 'deg';
        const card = document.createElement('div');
        card.className = 'polaroid';
        card.style.setProperty('--tilt', tilt);
        card.dataset.type = item.type;

        let photoFace;
        if (item.type === 'video') {
            photoFace =
                `<div class="pol-img vid"><span class="play-badge">▶</span></div>` +
                `<div class="pol-strip">${item.caption || ''}</div>`;
        } else {
            photoFace =
                `<div class="pol-img"><img alt="" src="${item.img}" ` +
                `onerror="phFallback(this,'${item.emoji || '📷'}')"></div>` +
                `<div class="pol-strip">${item.caption || ''}</div>`;
        }

        card.innerHTML =
            `<div class="pol-inner">` +
            `<div class="pol-face pol-caption">` +
            `<div class="cap-emoji">${item.emoji || '💕'}</div>` +
            `<div class="cap-text">${item.caption || ''}</div>` +
            `<div class="cap-hint">${item.type === 'video' ? 'tap to play ♡' : 'tap to reveal ♡'}</div>` +
            `</div>` +
            `<div class="pol-face pol-photo">${photoFace}</div>` +
            `</div>`;

        card.addEventListener('click', () => {
            if (!card.classList.contains('revealed')) {
                card.classList.add('revealed');
                if (item.type === 'video') {
                    makeVideoThumb(item.src, card.querySelector('.pol-img.vid'));
                }
            }
            openMedia(item);
        });

        wall.appendChild(card);
    });
}

/* ------------------------------------------------------------
   Capture a still frame from a local video for the polaroid thumb
   ------------------------------------------------------------ */
function makeVideoThumb(src, box) {
    if (!box || box.classList.contains('has-thumb') || !isLocalVideo(src)) return;
    const v = document.createElement('video');
    v.src = src;
    v.muted = true;
    v.playsInline = true;
    v.preload = 'metadata';

    let grabbed = false;
    const grab = () => {
        if (grabbed) return;
        grabbed = true;
        try {
            const c = document.createElement('canvas');
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
            box.style.backgroundImage = `url(${c.toDataURL('image/jpeg', 0.82)})`;
            box.classList.add('has-thumb');
        } catch (e) { /* keep the striped placeholder */ }
        v.remove();
    };

    v.addEventListener('loadeddata', () => {
        const t = Math.min(0.6, (v.duration || 1) / 2);
        try { v.currentTime = t; } catch (e) { grab(); }
    });
    v.addEventListener('seeked', grab, { once: true });
    v.addEventListener('error', () => { v.remove(); });
}

/* ------------------------------------------------------------
   Media lightbox (expanded view) — photos and videos
   ------------------------------------------------------------ */
const lightbox = document.getElementById('lightbox');
const lightboxMedia = document.getElementById('lightboxMedia');
const lightboxCaption = document.getElementById('lightboxCaption');

function toEmbedSrc(url) {
    if (!url) return '';
    // YouTube
    let m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
    if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0`;
    // Google Drive
    m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
    if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    return url; // assume a direct embeddable url
}

function isLocalVideo(url) {
    return /\.(mov|mp4|webm|m4v)$/i.test(url || '');
}

function openMedia(item) {
    if (item.type === 'video') {
        if (isLocalVideo(item.src)) {
            lightboxMedia.innerHTML =
                `<video src="${item.src}" controls autoplay playsinline></video>`;
        } else if (toEmbedSrc(item.src)) {
            lightboxMedia.innerHTML =
                `<div class="lb-frame"><iframe src="${toEmbedSrc(item.src)}" ` +
                `allow="autoplay; encrypted-media" allowfullscreen></iframe></div>`;
        } else {
            lightboxMedia.innerHTML =
                `<div class="lb-frame" style="display:flex;align-items:center;justify-content:center;` +
                `color:#f7d9e6;font-family:'Gochi Hand',cursive;font-size:1.4rem">🎬 a video will go here</div>`;
        }
    } else {
        lightboxMedia.innerHTML = `<img src="${item.img}" alt="">`;
    }
    lightboxCaption.textContent = item.caption || '';
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
}

function closeMedia() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxMedia.innerHTML = ''; // stop playback / free the image
}

document.getElementById('lightboxClose').addEventListener('click', closeMedia);
document.getElementById('lightboxBackdrop').addEventListener('click', closeMedia);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMedia();
});

/* ------------------------------------------------------------
   Countdown
   ------------------------------------------------------------ */
const el = {
    days: document.getElementById('days'),
    hours: document.getElementById('hours'),
    mins: document.getElementById('mins'),
    secs: document.getElementById('secs'),
};

function pad(n) { return String(n).padStart(2, '0'); }

function unlockSite() {
    if (!document.body.classList.contains('locked')) return;
    document.body.classList.remove('locked');
    document.body.classList.add('unlocked');
    const sub = document.querySelector('.countdown-sub');
    if (sub) sub.textContent = 'it’s finally your day \u{1F495} scroll down ↓';
}

function tickCountdown() {
    const diff = COUNTDOWN_TARGET - new Date();
    if (diff <= 0) {
        el.days.textContent = '00';
        el.hours.textContent = '00';
        el.mins.textContent = '00';
        el.secs.textContent = '00';
        unlockSite();
        return;
    }
    const s = Math.floor(diff / 1000);
    el.days.textContent = pad(Math.floor(s / 86400));
    el.hours.textContent = pad(Math.floor((s % 86400) / 3600));
    el.mins.textContent = pad(Math.floor((s % 3600) / 60));
    el.secs.textContent = pad(s % 60);
}

/* ------------------------------------------------------------
   Typewriter (fires when the message section scrolls into view)
   ------------------------------------------------------------ */
function runTypewriter() {
    const target = document.getElementById('typewriter');
    const cue = document.getElementById('scrollCue');
    const chars = [...TYPED_MESSAGE];
    let i = 0;
    target.innerHTML = '<span class="caret">|</span>';

    const timer = setInterval(() => {
        if (i >= chars.length) {
            clearInterval(timer);
            target.innerHTML = TYPED_MESSAGE + '<span class="caret">|</span>';
            cue.classList.add('show');
            return;
        }
        target.innerHTML = chars.slice(0, i + 1).join('') + '<span class="caret">|</span>';
        i++;
    }, 110);
}

/* ------------------------------------------------------------
   Background petals
   ------------------------------------------------------------ */
function makePetals() {
    const layer = document.querySelector('.bg-petals');
    const glyphs = ['🌸', '💕', '🤍', '✿', '🌷'];
    for (let i = 0; i < 14; i++) {
        const s = document.createElement('span');
        s.textContent = glyphs[i % glyphs.length];
        s.style.left = Math.random() * 100 + 'vw';
        s.style.fontSize = (12 + Math.random() * 16) + 'px';
        s.style.animationDuration = (9 + Math.random() * 10) + 's';
        s.style.animationDelay = (-Math.random() * 15) + 's';
        layer.appendChild(s);
    }
}

/* ------------------------------------------------------------
   Music toggle
   ------------------------------------------------------------ */
function initMusic() {
    const btn = document.getElementById('musicToggle');
    const icon = document.getElementById('musicIcon');
    const audio = document.getElementById('bgMusic');

    btn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play().then(() => {
                btn.classList.add('playing');
                icon.textContent = '⏸';
            }).catch(() => { });
        } else {
            audio.pause();
            btn.classList.remove('playing');
            icon.textContent = '♪';
        }
    });
}

/* ------------------------------------------------------------
   Init
   ------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
    renderWall('stinkyWall', GALLERIES.stinky);
    renderWall('niceWall', GALLERIES.nice);

    // Lock everything but the countdown until the clock hits zero
    if (COUNTDOWN_TARGET - Date.now() > 0) document.body.classList.add('locked');
    tickCountdown();
    setInterval(tickCountdown, 1000);

    makePetals();
    initMusic();

    // typewriter when message section enters view
    const msg = document.getElementById('message');
    let typed = false;
    const obs = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            if (e.isIntersecting && !typed) {
                typed = true;
                runTypewriter();
            }
        });
    }, { threshold: 0.5 });
    obs.observe(msg);
});
