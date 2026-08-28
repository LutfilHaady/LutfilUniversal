# Natasha's Birthday Site — Design Spec

**Date:** 2026-05-28
**Goal:** A personalised, single-page birthday website for Natasha. Static, deployable to Netlify. Pink + cute, Jellycat-inspired, with a "stinky → not stinky → I love you anyway" media narrative.

## Tech & Constraints

- Single static page: one `index.html`, one CSS file, vanilla JS. **No framework, no build step** — deploys directly to Netlify (drag-and-drop or git).
- Rebuilt from scratch. From the cloned `geniusinsanity/birthday-site` repo we keep **only**: the `image/Birthday!/` folder structure and `music/zahra.mp3`. Everything else (`jscp/*`, `lang.js`, old `css/index.css`, old `index.html`) is removed — it was a Vietnamese SaaS payment/WebSocket builder template, incompatible with this spec.
- Mobile responsive (portrait-first; the old site's forced-landscape orientation lock is gone).
- No confetti, balloons, matrix rain, fireworks, or the old flip-book.

## Visual System

**Palette**
- Blush base `#fdf2f6`
- Soft pink `#f7d9e6`
- Rose accent `#d168a0`
- Plum text `#6b2d4d`
- Cozy dark `#2a1f26` (countdown section)

**Fonts** (Google Fonts, self-referenced via `<link>`)
- **Chewy** — headlines, countdown digits, section titles (soft marker-bubble look)
- **Nunito** — body text, labels, nav (clean, warm, readable; carries long text Chewy can't)
- **Gochi Hand** — handwritten captions (polaroid backs) and small accents

**Jellycat motifs** — hand-built **inline SVG**, in the "Amuseable" visual language (soft rounded silhouettes, minimal stitched smile = two dot eyes + tiny stitched mouth, beige/blush tones). NOT clipart, NOT emoji, NOT pasted Jellycat product photos (copyright). Restrained usage:
- Small paw / bunny-ear motifs as section dividers
- Tiny plush corners framing the countdown
- One larger **bunny-hugging-a-cake** illustration peeking into the closing screen

## Page Structure — 5 Beats (in order)

The page is a single vertical scroll. During development it is **fully unlocked** (all sections visible/scrollable) so it can be debugged end-to-end. The countdown **gate** (hiding everything below until zero) is wired up as the final pre-deploy step — see "Countdown Gate (deferred)" below.

### Beat 1 — Countdown
- Full viewport, cozy dark background `#2a1f26`.
- Tiny Jellycat plush motifs in the corners.
- Live countdown to **30 May 2026, 00:00 SGT (UTC+8)**. Digits in Chewy. Days / hours / minutes / seconds.
- No confetti/balloons.

### Beat 2 — Message Reveal
- Triggered when the countdown reaches zero.
- Typewriter animation reveals: **"Happy Birthday NASTINGE!! 💕"**
- After it finishes, a soft "scroll down" cue appears, inviting her into the rest of the site.

### Beat 3 — "Sometimes you're stinky 🦨"
- Section title in Chewy.
- **Polaroid Wall**: goofy photos *and* videos, scattered at random tilt angles, scrapbook-style.
- **Photo interaction:** tap → the polaroid physically flips (CSS 3D transform) to reveal a handwritten (Gochi Hand) caption on the back.
- **Video interaction:** video polaroids show a thumbnail + a small play badge. Tap → opens a lightbox/modal embedding the video (YouTube or Google Drive iframe) with its caption shown below.

### Beat 4 — "Sometimes you're not ✨"
- Same Polaroid Wall mechanic as Beat 3.
- The nicer photos + videos.

### Beat 5 — Closing
- Blush background `#fdf2f6`.
- Big line (Chewy): **"no matter how stinky you are, I still love you"**
- A nice photo of the two of them.
- Jellycat bunny-with-cake illustration peeking in from a corner.

## Background Music
- `music/zahra.mp3` as a soft, looping background track.
- **Visible toggle button** (play/pause), persistent on screen.
- Starts **paused** (browsers block autoplay; also more tasteful). She presses play if she wants it.

## Countdown Gate (deferred to pre-deploy)
- Behavior when enabled: on load, only Beat 1 (countdown) is shown; Beats 2–5 are hidden and the page does not scroll past the countdown. When the target time passes, Beat 2's typewriter fires automatically and the rest of the page unlocks.
- Returning visits after the date: countdown section shows a celebratory state (e.g. "It's your birthday! 🎂") and the site is unlocked.
- This gate is **not wired up during development**. It is added/flipped on as the final step right before deployment, after the user has confirmed and debugged the full experience.

## Content (placeholders — to be provided by user)

Currently available in repo: `image/Birthday!/cover.jpg`, `photo1.jpg`–`photo8.jpg`, `9.jpg`.
The user will provide the real goofy/nice photos and videos later. Built with clearly-marked placeholders that are easy to swap.

| Item | Status |
|------|--------|
| Her name | **Natasha** (also "Nastinge" in the headline) ✓ |
| Beat 2 message | "Happy Birthday NASTINGE!! 💕" ✓ |
| Beat 3 title | "Sometimes you're stinky" ✓ |
| Beat 4 title | "Sometimes you're not" ✓ |
| Beat 5 closing line | "no matter how stinky you are, I still love you" ✓ |
| Goofy photos + captions | **TODO — user to provide** |
| Goofy videos (YouTube/Drive links) + captions | **TODO — user to provide** |
| Nice photos + captions | **TODO — user to provide** |
| Nice videos + captions | **TODO — user to provide** |
| Closing "us" photo | **TODO — user to provide** |

Photos/videos and their captions will be defined in a single, easy-to-edit JS data structure (one array per section) so adding/removing items is trivial.

## Out of Scope
- Authentication / Google sign-in (was never in this repo; not needed).
- Payments, vouchers, WebSocket — all removed.
- Multi-language — English only.
