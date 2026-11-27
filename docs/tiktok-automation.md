# Posting Godward episodes to TikTok automatically

Researched 2026-11-27 against TikTok's developer docs (pages last updated Aug–Nov 2026) and the
schedulers' own pricing pages. Prices change; re-check them before paying.

## TL;DR

**Use Buffer's official TikTok integration with a TikTok Business account.** Buffer auto-publishes
TikTok videos for business profiles, the free plan covers 3 channels (TikTok + YouTube Shorts +
Instagram), and paid is $5/month per channel. Building our own Content Posting API app is not worth
it for one creator: until TikTok audits the app every post is forced private, and TikTok's
guidelines say an app that is an internal utility for one account shouldn't expect to pass that audit.

## The options

| Option | Really auto-publishes? | Cost | Account needed | Catch for Godward |
|---|---|---|---|---|
| **TikTok Content Posting API, Direct Post** (own developer app, Login Kit, `video.publish`) | Only after the app passes TikTok's audit. Unaudited apps can post `SELF_ONLY` (private) only, the account must be private when posting, and at most 5 users per 24 h | Free | Any account that authorises the app | The guidelines say the app "must not be a test app or an internal utility" and should be "intended for a wide audience". A personal uploader is exactly that kind of app, so it's unlikely to pass the audit. It also needs an https redirect URI (no localhost listed), the required posting UI (privacy picker with no default, consent text, commercial-content toggle, preview), and token refresh (access 2 h, refresh 180 days, rotated) |
| **Content Posting API, Upload to inbox** (`video.upload`) | No. The video lands as a draft in the TikTok app inbox and you tap Post | Free | Any | Still needs the developer app, Login Kit and an https redirect. It saves the file transfer but not the tap |
| **TikTok Studio scheduler** (tiktok.com, desktop web) | Yes, natively | Free | Any | Manual upload in the browser per video. It's scheduling, not automation |
| **Buffer** (official TikTok partner integration) | **Yes for TikTok business profiles** ("Automatic Publishing: Included"). It falls back to a phone reminder for TikTok-library music, product tags or collaborators, and Godward uses none of these | Free: 3 channels, 10 queued posts per channel. Essentials: $5/month per channel (yearly), Team $10 | **TikTok Business account** | Free plan has no custom cover image. A 10-post queue is plenty for a few episodes a week |
| **Later** | Yes (auto-publish listed for TikTok) | No free plan. Starter $18.75/month billed yearly (30 posts per profile) | Business or Creator | Costs more than we need |
| **Metricool** | Auto-publish exists, but music outside TikTok's top list goes to manual publishing. TikTok auto-publish on the free plan not confirmed | Free: 1 brand, 20 posts/month. Paid from about $20/month | Business recommended | Original soundtracks may get pushed to "manual" |
| **Publer** | Offers direct publish or a push reminder (from comparison sites; its pricing page wouldn't load for me) | Free plan with 3 accounts; paid from about $12/month (unverified) | Business recommended | Not verified first-hand |

Limits that apply whatever you pick: about 15 posts per day per account through any API-based tool,
videos up to 3 min for every creator (some get 5 or 10), MP4/H.264 recommended, 23–60 fps,
360–4096 px per side, max 4 GB, caption/title up to 2,200 characters. Godward's 1080x1920 H.264
outro-joined MP4s already meet all of these.

## Why a Business account

Buffer only auto-publishes to TikTok **business** profiles, and Later and Metricool work best with
them too. A Business account only gets TikTok's Commercial Music Library instead of trending sounds.
That doesn't affect Godward, because every episode has its own mixed soundtrack baked into the MP4
(it posts as original audio). Switching is free, can be undone in settings, and adds analytics.
Pick a category such as "Education" or "Religion" if offered.

## Recommendation

1. Create (or switch) the Godward TikTok account to a **Business account**.
2. Connect it to **Buffer** (free plan), alongside YouTube and Instagram if you want one queue for
   everything.
3. Per episode: run `node tools/package.js <slug>`, then in Buffer upload `posts/<slug>/<slug>-reel.mp4`,
   paste the caption, set the time and turn on automatic publishing. Buffer posts it, with no phone tap.
4. Upgrade to Essentials ($5/month per channel) only if you need custom TikTok cover images or more
   than 10 queued posts.

Fully hands-off (Claude pushing straight from the repo) would need a scheduler's API. Buffer's and
Publer's public APIs are limited or tied to higher plans, so check that separately once the manual
Buffer flow works. Don't build a TikTok developer app unless Godward becomes a tool other creators use.

## How it plugs into the pipeline

`tools/package.js` already writes everything a TikTok post needs:

```
posts/<slug>/<slug>-reel.mp4      outro-joined 9:16 video (hard link)
posts/<slug>/<slug>-caption.txt   from videos/<slug>/caption-ig.txt
posts/<slug>/<slug>-cover.png     4:5 IG cover (TikTok covers are 9:16, so this one doesn't fit as-is)
```

- **Caption:** the IG caption (2,200 limit) also fits TikTok's 2,200 limit, so it can be reused.
  If you want TikTok-specific hashtags, add an optional `videos/<slug>/caption-tiktok.txt` in stage 8
  of the skill and have the packager prefer it. That's a later change, not made here.
- **Cover:** TikTok picks a frame from the video by default. For a custom one, a 9:16 still or a
  chosen frame time works better than the 4:5 IG cover.
- **Uploader:** with the Buffer path there's no script. `posts/index.html` stays the posting page
  (Copy caption, then drag the reel into Buffer). No stub uploader was written, because the API path
  isn't recommended. If it ever is, it belongs as `tools/post-tiktok.js` reading `posts/<slug>/`, with
  `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` and the refresh token in `.env` (already git-ignored),
  using `FILE_UPLOAD` in 5–64 MB chunks.

## Setup checklist

| # | Step | Who |
|---|---|---|
| 1 | Decide the account: new "Godward" TikTok account or your existing one. Sign up in the TikTok app with your own email/phone, password and verification code | **You** |
| 2 | In the TikTok app: Profile, then ☰, Settings and privacy, Account, **Switch to Business account**. Choose a category and accept TikTok's terms | **You** |
| 3 | Fill in the bio, profile picture (Godward logo) and link | **You** (Claude can draft the bio text) |
| 4 | Sign up at buffer.com (free plan) and accept Buffer's terms | **You** |
| 5 | In Buffer: Connect channel, then TikTok, and log in to TikTok and approve Buffer's access (OAuth) | **You** |
| 6 | Run `node tools/package.js <slug>` for the episode to post | Claude |
| 7 | In Buffer: new post, upload `posts/<slug>/<slug>-reel.mp4`, paste the caption, set "Automatic" publishing and a time | **You** (Claude can walk through it in the browser pane if you're signed in, and you confirm before it schedules anything) |
| 8 | After the first post goes live, check it's public, has original audio and the caption looks right | **You** + Claude |
| 9 | Optional: add `caption-tiktok.txt` and a 9:16 cover to the skill's stages 8–9 | Claude, on request |

## What I need from you next

**Decided 2026-11-27: a new, dedicated Godward TikTok account.** Next, sign it up in the TikTok
app and switch it to a **Business account** (steps 1–2). You do all sign-ups,
passwords, codes and terms yourself. Once it's a Business account, connect it to Buffer (steps 4–5)
and I'll help schedule the first episode.

## Sources

- TikTok Content Sharing Guidelines (updated 2026-08-04): https://developers.tiktok.com/doc/content-sharing-guidelines
- Direct Post API reference (updated 2026-11-25): https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
- Media Transfer Guide: https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide
- Get Started, Direct Post: https://developers.tiktok.com/doc/content-posting-api-get-started
- Token management: https://developers.tiktok.com/doc/oauth-user-access-token-management
- Login Kit Web (redirect URI rules): https://developers.tiktok.com/doc/login-kit-web
- Buffer pricing: https://buffer.com/pricing
- Later pricing: https://later.com/pricing
- Metricool pricing: https://metricool.com/pricing
- Scheduler comparisons (Publer and music fallbacks, secondary): https://www.socialpilot.co/tiktok-scheduling-tools, https://sydium.com/blog/best-tiktok-scheduling-tools
