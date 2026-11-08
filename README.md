# Business Calculator

A lightweight, mobile-friendly business calculator built with plain HTML, CSS, and JavaScript.

## Run locally

Open `index.html` in a modern browser. No build tools or dependencies are required.

## Publish with GitHub Pages

Enable Pages for the repository's `main` branch and root folder. The project-site URL will normally be `https://betterolly.github.io/calculator/`.

## App branding

- Custom scalable SVG app icon: `icons/calculator.svg`
- Browser tab icon linked from `index.html`
- PWA metadata in `manifest.json`
- Relative asset paths are used so the project also works under the `/calculator/` URL path.

The SVG manifest icon is a scalable icon source. Some browser/device install flows may prefer or require raster 192px and 512px PNG icons for the broadest compatibility; verify installation on the target Android device.

## Included

- Familiar four-column physical-calculator keypad
- GST addition/removal and editable GST rate
- BODMAS/PEDMAS arithmetic with brackets, powers, decimals and sign change
- Percentage calculations, square root, GST addition/removal and editable GST rate
- Memory keys (MRC, M−, M+)
- Calculation review controls with a 120-step in-memory review list
- Persistent recent history stored locally in the browser (up to 50 calculations)
- Responsive light interface
- Keyboard input

## Current limitations

- History is stored locally in the current browser/device; it is not synced across devices and can be cleared by clearing site data.
- The review list is in memory and resets when the page is refreshed.
- Power operations are supported through keyboard input (`^`), but there is no dedicated power key on the keypad.
- Percentage behavior follows common calculator conventions; confirm the displayed expression for business-critical calculations.
- Correction/replay is still a basic review workflow, not a full audit trail with automatic downstream recalculation.

For financial use, independently verify important results until the app has been tested on the target device with real business examples.
