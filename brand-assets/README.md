# SupportCard brand assets

Every file here is generated from `mobile/assets/images/icon.png`, so the mark,
colour and proportions match what ships in the app.

## Palette

| Role | Hex |
|---|---|
| Brand blue — all backgrounds | `#2B74D6` |
| Mark, headings on blue | `#FFFFFF` |
| App background | `#EBF4FF` |
| Body text on light | `#0D1C2E` |
| Accent / positive | `#0EA968` |

Tagline: **Child support, made clearer and easier**

---

## `app-store/`

| File | Use |
|---|---|
| `icon-1024.png` | App Store Connect icon. Opaque, no alpha — Apple rejects PNGs containing an alpha channel. |

## `play-store/`

| File | Use |
|---|---|
| `icon-512.png` | Play Console app icon (required, 512×512) |
| `feature-graphic-1024x500.png` | Play Console feature graphic (required). Shown at the top of your store listing. |

## `social/`

| File | Where |
|---|---|
| `open-graph-1200x630.png` | `og:image` — link previews on WhatsApp, Slack, iMessage, Facebook |
| `linkedin-1200x627.png` | LinkedIn shares |
| `x-header-1500x500.png` | X / Twitter profile header |
| `instagram-square-1080.png` | Instagram feed post |
| `instagram-story-1080x1920.png` | Instagram / Facebook story |
| `facebook-cover-1640x856.png` | Facebook page cover |

## `web/`

For `supportcard.co.za`. Drop into the site root and reference from `<head>`:

```html
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<link rel="icon" href="/favicon-16.png" sizes="16x16">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<meta property="og:image" content="https://supportcard.co.za/open-graph-1200x630.png">
<meta name="twitter:card" content="summary_large_image">
```

`icon-192.png` and `icon-512.png` are the PWA manifest sizes.

---

## Notes

**The wordmark is deliberately absent from the icons.** At 29–60 px, "SupportCard"
is a few pixels tall and becomes texture rather than text, while stealing the
space the mark needs to stay recognisable. The social and store graphics have
room for it; icons do not. Two variants with the wordmark are kept in
`mobile/assets/images/icon-variants/` if you ever want to compare.

**`mobile/assets/images/icon-original-lockup.png`** is the original horizontal
logo — mark plus wordmark on white. Still the right asset for website headers,
email signatures and documents, where it has room to breathe.

**Type is Segoe UI**, matching the system font the app renders in. If you ever
commission a proper typeface, regenerate these rather than editing them.
