# FFU Studio

A separate Windows x64 desktop app for generating `.ffu` bitmap fonts from OTF, TTF, or TTC fonts. It wraps the [VE-ES generator](https://github.com/Foxiary/VE-ES) without requiring a Virche project folder.

## Use

1. Open FFU Studio and choose a stock `.ffu` template from a compatible game. The template supplies the character map, palette, and fallback bitmaps.
2. Add one or more OTF/TTF/TTC fonts in priority order. For a TTC, enter the face index.
3. Choose a distinct output `.ffu` path.
4. Adjust optional settings, then select **Generate FFU**. Inspect the output preview and test the file in its target game.

The app supports the complete `ffugen.py` option set, including `--stroke` added at source revision `019ccceaf78e4862519e4164e9e0d317da5d745b`. Stroke requires a template palette with a dark opaque entry. A stock FFU template is necessary; arbitrary OTF/TTF files alone cannot supply game specific FFU metadata. No game assets or fonts are bundled.

The Windows packages bundle the official Python 3.13.16 embeddable distribution, Pillow, fontTools, and NumPy. You do not need to install Python. Their licenses are inside `resources/python`. The Windows executables are unsigned and were cross-built on macOS; native Windows launch was not available for this build.

## Update notifications

At startup and once per day while open, the app checks the latest commit on the public VE-ES GitHub repository. If it differs from the bundled revision, the app shows an in-app banner and, where supported, one desktop notification per new commit. **Check updates** runs the check immediately. The app does not download or install code automatically; a newly built desktop package is required to use newer source. Dismissing the banner hides that specific commit until a newer one appears. Offline or rate-limited checks do not interrupt normal work.

## Source development

Run `npm install` then `npm start`. On macOS or Linux, set `FFU_STUDIO_PYTHON` to a Python 3 environment with Pillow, fontTools, and NumPy installed. Run `npm run dist:win` to build Windows x64 installer and portable releases.

Upstream source: [Foxiary/VE-ES commit 019ccce](https://github.com/Foxiary/VE-ES/commit/019ccceaf78e4862519e4164e9e0d317da5d745b).
