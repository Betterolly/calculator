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
- Basic arithmetic, percentage, square root, sign change
- Memory keys (MRC, M−, M+)
- Calculation review controls with a 120-step in-memory review list
- Responsive light interface
- Keyboard input

## Current prototype limitations

This is an initial interface prototype. Calculation history is currently kept in memory and is cleared when the page is refreshed. The review controls are a basic prototype; persistent searchable history, robust expression parsing, OCR, voice input, and full step correction/replay are not implemented yet.

For financial use, verify results independently until the calculation engine has been fully tested.
