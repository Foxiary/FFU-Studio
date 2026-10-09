"""Render synthetic fonts to verify punctuation without any game/font assets."""
import contextlib
import io
import os
from pathlib import Path
import string
import struct
import subprocess
import sys
import tempfile
import unittest

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ENGINE = Path(os.environ.get('FFU_TEST_ENGINE', Path(__file__).resolve().parents[1] / 'engine'))
sys.path.insert(0, str(ENGINE))
from ffu import FFU
from ffugen import (Chain, PUNCTUATION_ALIASES, baseline_of, build, measure,
                    pack, render)


def write_font(path, chars):
    """A Latin face with deliberately oversized Japanese punctuation."""
    builder = FontBuilder(1000, isTTF=True)
    cmap = {ord(ch): 'g%04X' % ord(ch) for ch in chars}
    order = ['.notdef'] + list(cmap.values())
    builder.setupGlyphOrder(order)
    builder.setupCharacterMap(cmap)
    glyphs, metrics = {}, {}
    for name in order:
        pen = TTGlyphPen(None)
        ch = next((c for c in chars if cmap[ord(c)] == name), None)
        japanese = ch == '？'
        if ch not in (None, ' '):
            width = 900 if japanese else 180 + (ord(ch) % 5) * 40
            height = 1300 if japanese else 600 if ch == 'A' else 200 + (ord(ch) % 4) * 100
            pen.moveTo((20, 0))
            pen.lineTo((width, 0))
            pen.lineTo((width, height))
            pen.lineTo((20, height))
            pen.closePath()
        glyphs[name] = pen.glyph()
        metrics[name] = (1000 if japanese else 500, 20)
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics(metrics)
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({'familyName': 'Punctuation Test', 'styleName': 'Regular',
                            'uniqueFontIdentifier': 'PunctuationTest',
                            'fullName': 'Punctuation Test', 'psName': 'PunctuationTest'})
    builder.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=1400, usWinDescent=200)
    builder.setupPost()
    builder.setupMaxp()
    builder.save(path)


def template():
    chars = sorted(set('A n?!？！漢ー。、…　'), key=FFU.u8i)
    palette = b''.join(bytes((255, 255, 255, i * 17)) for i in range(16))
    ranges, table, bitmap = bytearray(), bytearray(), bytearray()
    for i, ch in enumerate(chars):
        # Distinct oversized stock bitmaps, all with the same baseline as A.
        rows = [[15 if 6 <= y < 30 and 2 <= x < (14 if ch == 'A' else 42) else 0
                 for x in range(48)] for y in range(48)]
        data = pack(rows)
        value = FFU.u8i(ch)
        ranges += struct.pack('<3I', value, value + 1, i)
        table += struct.pack('<BBHI', 44, 48, len(data), len(bitmap))
        bitmap += data
    off_range = 40 + len(palette)
    off_table = off_range + len(ranges)
    off_bitmap = off_table + len(table)
    header = struct.pack('<8H6I', 0x4655, len(chars), len(chars), 0, 3, 0x130, 1, 0x130,
                         off_bitmap + len(bitmap) - 0x1a, off_range, off_table, off_bitmap, 0, 0)
    return FFU(header + palette + ranges + table + bitmap)


def glyph(font, ch):
    index = font.index(ch)
    if index is None:
        raise AssertionError('Missing glyph %r' % ch)
    return font.glyphs[index]['adv'], font.bitmap(index)


class PunctuationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='FFU punctuation ')
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        self.font = self.folder / 'font Việt.ttf'
        write_font(self.font, set(string.punctuation + 'An ·？'))
        self.chain = Chain([str(self.font)], 40)
        self.stock = template()

    def generate(self, **options):
        return FFU(build(self.stock, self.chain, 48, 0, baseline_of(self.stock),
                         add_vn=False, verbose=False, **options))

    def test_every_alias_uses_latin_metrics_and_bitmap_at_original_code(self):
        output = self.generate(tracking=2, glow=0.3)
        for ch, equivalent in PUNCTUATION_ALIASES.items():
            with self.subTest(character=ch, equivalent=equivalent):
                advance, width, rows = render(self.chain, equivalent, 48, 0,
                                               tracking=2, glow=0.3)
                self.assertEqual(glyph(output, ch), (advance, (width, 48, rows)))
        self.assertEqual(glyph(output, '？'), glyph(output, '?'))
        self.assertEqual(glyph(output, '！'), glyph(output, '!'))
        # Kanji and the kana vowel extender must remain untouched.
        for ch in '漢ー':
            self.assertEqual(glyph(output, ch), glyph(self.stock, ch))
        self.assertEqual(output._rA & 0xff, 48)
        self.assertEqual(output._rE & 0xff, 48)
        self.assertEqual(output.ranges, sorted(output.ranges))

    def test_disable_retains_original_rendering_and_does_not_add_aliases(self):
        output = self.generate(normalize_punctuation=False)
        advance, width, rows = render(self.chain, '？', 48, 0)
        self.assertEqual(glyph(output, '？'), (advance, (width, 48, rows)))
        self.assertNotEqual(glyph(output, '？'), glyph(output, '?'))
        self.assertEqual(glyph(output, '！'), glyph(self.stock, '！'))
        self.assertIsNone(output.index('「'))

    def test_normalization_uses_the_same_outline_as_latin_punctuation(self):
        from ffugen import outline_palette
        raw = bytearray(self.stock.raw)
        for i in range(16):
            value = 0 if i <= 4 else round((i - 4) * 255 / 11)
            raw[40 + i * 4:44 + i * 4] = bytes((value, value, value, 0 if i == 0 else 255))
        self.stock = FFU(raw)
        output = self.generate(stroke=1.5, glow=0.3)
        palette = outline_palette(self.stock.palettes[0])
        for ch in '？！…':
            advance, width, rows = render(self.chain, PUNCTUATION_ALIASES[ch],
                                          48, 0, stroke=1.5, glow=0.3, palette=palette)
            self.assertEqual(glyph(output, ch), (advance, (width, 48, rows)))

    def test_missing_equivalent_keeps_original_and_warns_without_tofu(self):
        limited = self.folder / 'limited.ttf'
        write_font(limited, set('An？'))
        chain = Chain([str(limited)], 40)
        log = io.StringIO()
        with contextlib.redirect_stdout(log):
            output = FFU(build(self.stock, chain, 48, 0, baseline_of(self.stock),
                               add_vn=False))
        advance, width, rows = render(chain, '？', 48, 0)
        self.assertEqual(glyph(output, '？'), (advance, (width, 48, rows)))
        self.assertEqual(glyph(output, '！'), glyph(self.stock, '！'))
        self.assertIsNone(output.index('「'))
        self.assertIn('WARNING', log.getvalue())
        self.assertIn('U+FF1F', log.getvalue())

    def test_font_fallback_and_composite_punctuation(self):
        primary = self.folder / 'primary.ttf'
        write_font(primary, set('An'))
        chain = Chain([str(primary), str(self.font)], 40)
        output = FFU(build(self.stock, chain, 48, 0, baseline_of(self.stock),
                           add_vn=False, verbose=False))
        for ch in '？！…⁈':
            text = PUNCTUATION_ALIASES[ch]
            self.assertEqual(chain.pick(text).path, str(self.font))
            advance, width, rows = render(chain, text, 48, 0)
            self.assertEqual(glyph(output, ch), (advance, (width, 48, rows)))

    def test_ideographic_space_uses_word_space_ratio(self):
        output = self.generate(space_ratio=0.6)
        self.assertEqual(glyph(output, '　'), glyph(output, ' '))
        self.assertEqual(glyph(output, '　')[0], round(glyph(output, 'n')[0] * 0.6))

    def test_cli_normalizes_before_cell_measurement_and_opt_out_restores_height(self):
        low, high = measure(self.chain, {'A', '？'}, normalize_punctuation=True)
        original_low, original_high = measure(self.chain, {'A', '？'})
        self.assertLess(high - low, original_high - original_low)
        stock = self.folder / 'template.ffu'
        stock.write_bytes(self.stock.raw)
        results = []
        for flags in ([], ['--no-normalize-punctuation']):
            output = self.folder / ('original.ffu' if flags else 'normalized.ffu')
            result = subprocess.run([sys.executable, '-I', '-X', 'utf8',
                                     str(ENGINE / 'ffugen.py'), '--template', str(stock),
                                     '--font', str(self.font), '--out', str(output),
                                     '--px', '40', '--no-vn', *flags], cwd=self.folder,
                                    capture_output=True, text=True, encoding='utf-8', timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr)
            results.append(FFU(output.read_bytes()))
        normalized, original = results
        self.assertLess(normalized._rA & 0xff, original._rA & 0xff)
        self.assertEqual(glyph(normalized, '？'), glyph(normalized, '?'))


if __name__ == '__main__':
    unittest.main()
