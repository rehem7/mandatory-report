"""Build the fixed login heading as vector artwork, without shipping a font file."""
import json
import re
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

TITLE = "从受伤的此刻，到微笑的未来。"
ROOT = Path(__file__).resolve().parent.parent
font = TTFont("C:/Windows/Fonts/msyhbd.ttc", fontNumber=0)
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
scale = 128 / font["head"].unitsPerEm
cursor = 0
art = []
all_bounds = []
for char in TITLE:
    glyph_name = cmap[ord(char)]
    glyph = glyphs[glyph_name]
    transform = (scale, 0, 0, -scale, cursor, 0)
    outline = SVGPathPen(glyphs)
    glyph.draw(TransformPen(outline, transform))
    bounds_pen = BoundsPen(glyphs)
    glyph.draw(TransformPen(bounds_pen, transform))
    bounds = bounds_pen.bounds
    contours = re.findall(r"M[^M]+", outline.getCommands())
    if not contours or not bounds:
        raise ValueError(f"Missing glyph artwork: {char}")
    art.append({"char": char, "contours": contours})
    all_bounds.append(bounds)
    advance = font["hmtx"].metrics[glyph_name][0] * scale
    # Optical spacing for the Chinese comma: no gap from separate SVG canvases.
    if char == "，":
        advance = bounds[2] - cursor + 12
    cursor += advance - 4

pad = 3
x0 = min(b[0] for b in all_bounds) - pad
y0 = min(b[1] for b in all_bounds) - pad
x1 = max(b[2] for b in all_bounds) + pad
y1 = max(b[3] for b in all_bounds) + pad
data = {"text": TITLE, "fontSize": 128, "box": {"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0}, "glyphs": art}
target = ROOT / "public/login-title-paths.js"
target.write_text("// Fixed title outline artwork from locally installed Microsoft YaHei Bold.\n"
                  "// Each contour is separate so complex Chinese glyphs draw completely.\n"
                  "export const titleArtwork = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print(json.dumps({"characters": len(art), "contours": sum(len(g["contours"]) for g in art), "microContours": len(next(g for g in art if g["char"] == "微")["contours"]), "bytes": target.stat().st_size}))
