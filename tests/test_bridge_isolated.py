"""Regression test for the isolated Windows Python runtime's import behavior."""
import base64
import io
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest

from PIL import Image


class IsolatedBridgeTest(unittest.TestCase):
    def test_template_preview_without_script_directory_on_sys_path(self):
        engine = Path(__file__).resolve().parents[1] / 'engine'
        # Create a synthetic eight-pixel glyph, without using any game assets.
        palette = b''.join(bytes((255, 255, 255, i * 17)) for i in range(16))
        bitmap = bytes([0xff] * 32)
        header = struct.pack('<8H6I', 0x4655, 1, 1, 0, 3, 0x108, 1, 0x108,
                             156 - 0x1a, 104, 116, 124, 0, 0)
        ranges = struct.pack('<3I', ord('A'), ord('A') + 1, 0)
        glyph = struct.pack('<BBHI', 8, 8, len(bitmap), 0)
        with tempfile.TemporaryDirectory(prefix='FFU font ') as folder:
            template = Path(folder) / 'mẫu font.ffu'
            template.write_bytes(header + palette + ranges + glyph + bitmap)
            result = subprocess.run(
                [sys.executable, '-I', '-X', 'utf8', str(engine / 'bridge.py'),
                 str(template), '--text', 'AB'],
                cwd=folder, capture_output=True, text=True,
                encoding='utf-8', timeout=20,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            info = json.loads(result.stdout)
            self.assertEqual(info['glyphCount'], 1)
            self.assertEqual(info['cellHeight'], 8)
            self.assertTrue(info['headerMatches'])
            self.assertEqual(info['missing'], ['B'])
            prefix, payload = info['preview'].split(',', 1)
            self.assertEqual(prefix, 'data:image/png;base64')
            with Image.open(io.BytesIO(base64.b64decode(payload))) as preview:
                self.assertEqual(preview.format, 'PNG')
                self.assertGreater(preview.width, 0)


if __name__ == '__main__':
    unittest.main()
