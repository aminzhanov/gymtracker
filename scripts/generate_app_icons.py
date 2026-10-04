"""Regenerate the committed app icons. Requires Pillow; not needed for builds."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent / "public"
(ROOT / "icons").mkdir(parents=True, exist_ok=True)
NAVY, YELLOW, CORAL = "#222339", "#ffe194", "#ff8752"
SIZE = 1024
image = Image.new("RGB", (SIZE, SIZE), YELLOW)
dumbbell = Image.new("RGBA", (SIZE, SIZE))
draw = ImageDraw.Draw(dumbbell)
draw.rounded_rectangle((260, 476, 764, 548), radius=25, fill=NAVY)
for x, y, w, h, radius in [(258, 390, 72, 244, 26), (330, 342, 84, 340, 28), (610, 342, 84, 340, 28), (694, 390, 72, 244, 26)]:
    draw.rounded_rectangle((x, y, x + w, y + h), radius=radius, fill=NAVY)
image.paste(dumbbell.rotate(35, resample=Image.Resampling.BICUBIC), (0, 0), dumbbell.rotate(35, resample=Image.Resampling.BICUBIC))
ImageDraw.Draw(image).polygon([(778, 168), (801, 225), (858, 248), (801, 271), (778, 328), (755, 271), (698, 248), (755, 225)], fill=CORAL)
for size, path in [(180, "apple-touch-icon.png"), (192, "icons/icon-192.png"), (512, "icons/icon-512.png")]:
    image.resize((size, size), Image.Resampling.LANCZOS).save(ROOT / path)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
<rect width="1024" height="1024" rx="200" fill="{YELLOW}"/>
<g fill="{NAVY}" transform="rotate(-35 512 512)">
<rect x="260" y="476" width="504" height="72" rx="25"/>
<rect x="258" y="390" width="72" height="244" rx="26"/>
<rect x="330" y="342" width="84" height="340" rx="28"/>
<rect x="610" y="342" width="84" height="340" rx="28"/>
<rect x="694" y="390" width="72" height="244" rx="26"/>
</g><path fill="{CORAL}" d="M778 168 801 225 858 248 801 271 778 328 755 271 698 248 755 225Z"/>
</svg>'''
(ROOT / "favicon.svg").write_text(svg)
