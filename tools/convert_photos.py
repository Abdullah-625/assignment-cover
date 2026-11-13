"""Convert teacher photos to 400x400 WebP (square crop, biased toward the top so faces are kept).
Usage:  python convert_photos.py  <folder-with-jpgs>  [output-folder=../photos]
Needs:  pip install pillow
"""
import sys, os
from PIL import Image, ImageOps

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'photos')
os.makedirs(out, exist_ok=True)
for f in sorted(os.listdir(src)):
    name, ext = os.path.splitext(f)
    if ext.lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
        continue
    im = ImageOps.exif_transpose(Image.open(os.path.join(src, f))).convert('RGB')
    w, h = im.size
    s = min(w, h)
    left = (w - s) // 2
    top = int((h - s) * 0.2)          # portrait photos: keep the upper part (faces)
    im = im.crop((left, top, left + s, top + s)).resize((400, 400), Image.LANCZOS)
    im.save(os.path.join(out, name + '.webp'), 'WEBP', quality=82)
    print('ok', f, '->', name + '.webp')
