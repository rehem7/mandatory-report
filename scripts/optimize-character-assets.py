"""Build display-sized WebP variants without modifying the original artwork."""
from pathlib import Path
from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / "public" / "assets"


def variant(source, output, width, quality=84):
    image = source.copy()
    image.thumbnail((width, round(width * image.height / image.width)), Image.Resampling.LANCZOS)
    image.save(output, "WEBP", quality=quality, method=6)
    print(f"{output.name}: {image.width}x{image.height}, {output.stat().st_size:,} bytes")


for name in ("before", "after"):
    source = Image.open(ASSETS / f"login-child-{name}.png")
    for width in (240, 480, 800):
        variant(source, ASSETS / f"login-child-{name}-{width}.webp", width)

for name in ("question", "confident"):
    source = Image.open(ASSETS / "mascot" / f"guardian-{name}.png")
    for width in (240, 480):
        variant(source, ASSETS / "mascot" / f"guardian-{name}-{width}.webp", width, quality=86)

sheet = Image.open(ASSETS / "mascot" / "guardian-expressions.jpg")
cell = sheet.width // 3
for name, (column, row) in {"wave": (2, 2), "encourage": (2, 0), "protect": (0, 2)}.items():
    pose = sheet.crop((column * cell, row * cell, (column + 1) * cell, (row + 1) * cell))
    variant(pose, ASSETS / "mascot" / f"guardian-{name}.webp", cell, quality=86)
