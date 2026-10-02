"""JSON inspection and preview adapter for FFU Studio.

The FFU parser and generator beside this file come from Foxiary/VE-ES.
"""
import argparse
import base64
import io
import json
import statistics

from PIL import Image
from ffu import load


def preview(font, sample):
    sample = sample.replace('\n', ' ')[:100]
    median = int(statistics.median(g['adv'] for g in font.glyphs)) if font.glyphs else 12
    glyphs = [(ch, font.index(ch)) for ch in sample]
    width = 24 + sum(font.glyphs[i]['adv'] if i is not None else median for _, i in glyphs)
    width += max((font.glyphs[i]['w'] for _, i in glyphs if i is not None), default=0)
    height = max((g['h'] for g in font.glyphs), default=24) + 24
    if width * height > 4_000_000:
        raise ValueError('Preview text is too wide for a safe image')
    canvas = Image.new('RGBA', (max(96, width), max(48, height)), (20, 24, 35, 255))
    palette = font.palettes[0] if font.palettes else None
    x = 12
    for ch, index in glyphs:
        if index is None:
            x += median
            continue
        w, h, rows = font.bitmap(index)
        if w and h:
            glyph = Image.new('RGBA', (w, h))
            if palette:
                glyph.putdata([tuple(palette[min(15, value)]) for row in rows for value in row])
            else:
                glyph.putdata([(239, 241, 252, value * 17) for row in rows for value in row])
            canvas.alpha_composite(glyph, (x, 12))
        x += font.glyphs[index]['adv']
    scale = 2 if canvas.width <= 1600 else 1
    if scale > 1:
        canvas = canvas.resize((canvas.width * scale, canvas.height * scale), Image.Resampling.NEAREST)
    buffer = io.BytesIO()
    canvas.save(buffer, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii')


def inspect(path, sample):
    font = load(path)
    if not font.glyphs:
        raise ValueError('FFU has no glyphs')
    palette = font.palettes[0] if font.palettes else []
    dark_entry = any(a > 229 and (r + g + b) < 153 for r, g, b, a in palette)
    missing = sorted(set(ch for ch in sample if not ch.isspace() and font.index(ch) is None))
    cell = font._rA & 0xff
    return {
        'glyphCount': font.n_glyph,
        'rangeCount': font.n_range,
        'paletteCount': font.n_pal,
        'cellHeight': cell,
        'headerMatches': (font._rE & 0xff) == cell,
        'commonHeight': statistics.mode(g['h'] for g in font.glyphs),
        'strokeCompatible': bool(dark_entry),
        'missing': missing,
        'preview': preview(font, sample),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('file')
    parser.add_argument('--text', default='Tiếng Việt • Sample 123')
    args = parser.parse_args()
    print(json.dumps(inspect(args.file, args.text), ensure_ascii=False))


if __name__ == '__main__':
    main()
