# Logo source

`supportcard-mark.svg` is the master. Everything else is generated from it.

The mark previously existed only as ~527×501 raster pixels inside the 2000×2000
lockup, which meant app icons had to upscale it (1.24× for iOS, 1.13× for
Android). This is a vector rebuild traced from that raster — it renders at any
size without loss.

## Colour

The SVG uses `currentColor`, so one file serves every variant:

```html
<div style="color:#FFFFFF"><!-- svg --></div>   <!-- on brand blue -->
<div style="color:#2B74D6"><!-- svg --></div>   <!-- on light -->
```

`mark-white-1024.png` and `mark-blue-1024.png` are pre-rendered for tools that
can't take SVG.

## Regenerating the PNGs

Rendered with headless Chrome — no design tool needed:

```bash
chrome --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1024,1024 \
  --default-background-color=00000000 \       # omit for a solid background
  --screenshot=out.png "file:///path/to/page.html"
```

Where the page centres the SVG at the right percentage. Sizes in use: 64% for
the iOS icon, 58% for the Android foreground (inside the adaptive safe zone),
52% for the splash.

**Icons with a solid background must have no alpha channel** — App Store Connect
rejects PNGs that carry one. Rendering over an opaque background produces
24-bit RGB, which is correct; verify with any image tool before uploading.

## Accuracy

Traced against the original and checked by overlay. Deviation is 2–4px out of
527 (under 1%) on the knockout squares, imperceptible at any size the mark is
displayed. If the original vector ever turns up, replace this file and
regenerate — nothing else needs to change.
