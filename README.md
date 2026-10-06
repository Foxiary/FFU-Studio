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

At startup and once per day while open, the app checks the latest published stable release of [Foxiary/FFU-Studio](https://github.com/Foxiary/FFU-Studio/releases). Tags must use `MAJOR.MINOR.PATCH`, optionally prefixed with `v`. A numerically newer version shows an in-app banner and, where supported, one desktop notification per version. Drafts, prereleases, equal or older versions, and source commits do not trigger an update. **Check updates** runs the check immediately. **Download release** opens the release page to download the Setup or portable app; installation is manual. **Dismiss** hides that version during automatic checks; a newer version can still notify. Offline or rate-limited checks do not interrupt font generation. Update checks use the public GitHub API and need no account or token.

## Source development

Run `npm install` then `npm start`. On macOS or Linux, set `FFU_STUDIO_PYTHON` to a Python 3 environment with Pillow, fontTools, and NumPy installed. Run `npm run dist:win` to build Windows x64 installer and portable releases.

Version 1.1.1 fixes template inspection and previews in Windows' isolated embeddable Python runtime. See [release notes](RELEASE_NOTES.md). To run the import regression check, use a Python with Pillow installed: `python -m unittest discover -s tests`. On Windows, the bundled runtime can run it with `vendor\windows-python\python.exe -m unittest discover -s tests`.

Version 1.1.2 switches update notifications to published FFU Studio releases. Run `npm test` for release comparison, network error handling, and notification/dismissal regression checks. Users on 1.1.1 or earlier must install 1.1.2 manually once to get the new update checker.

Upstream source: [Foxiary/VE-ES commit 019ccce](https://github.com/Foxiary/VE-ES/commit/019ccceaf78e4862519e4164e9e0d317da5d745b).
