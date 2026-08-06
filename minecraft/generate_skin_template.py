"""
Generates blank 64x64 Bedrock skin textures plus a visual UV-boundary
guide, using the standard "new" (64x64, dual-layer) Minecraft skin
layout shared by both geometry.humanoid.custom and .customSlim.

Output:
  textures/<name>.png   - fully transparent, ready to paint over
  templates/uv_guide.png - same layout with colored/labeled regions,
                           for use as a reference or a Photoshop guide
                           layer (never ship this file in the pack)

Usage:
  python3 generate_skin_template.py
"""

import os
from PIL import Image, ImageDraw

SIZE = 64

# Base-layer (layer 0) bounding boxes per body part, in the standard
# 64x64 skin UV map. Each box covers that part's full cross unwrap
# (top/bottom/front/back/left/right faces packed together).
# Format: (x0, y0, x1, y1)
BASE_LAYER = {
    "Head":       (0, 0, 32, 16),
    "Right Leg":  (0, 16, 16, 32),
    "Body":       (16, 16, 40, 32),
    "Right Arm":  (40, 16, 56, 32),
    "Left Leg":   (16, 48, 32, 64),
    "Left Arm":   (32, 48, 48, 64),
}

# Second-layer (hat / jacket / sleeves / pants overlay) bounding boxes.
# Non-transparent pixels drawn here render as an outer layer automatically
# on geometry.humanoid.custom(Slim) -- there is no separate "enable outer
# layer" flag in skins.json, the texture pixels are what turn it on.
OVERLAY_LAYER = {
    "Head (Hat)":        (32, 0, 64, 16),
    "Right Leg (Pants)": (0, 32, 16, 48),
    "Body (Jacket)":     (16, 32, 40, 48),
    "Right Arm (Sleeve)": (40, 32, 56, 48),
    "Left Leg (Pants)":  (0, 48, 16, 64),
    "Left Arm (Sleeve)": (48, 48, 64, 64),
}

BASE_COLORS = {
    "Head": (231, 76, 60, 90),
    "Right Leg": (52, 152, 219, 90),
    "Body": (46, 204, 113, 90),
    "Right Arm": (241, 196, 15, 90),
    "Left Leg": (155, 89, 182, 90),
    "Left Arm": (230, 126, 34, 90),
}


def make_blank_texture(path):
    """A fully transparent 64x64 canvas -- the actual working texture file."""
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    img.save(path)


def make_uv_guide(path):
    """A reference image with colored, labeled UV regions. Not a game asset."""
    scale = 8  # upscale so labels/gridlines are legible
    img = Image.new("RGBA", (SIZE * scale, SIZE * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    for name, (x0, y0, x1, y1) in BASE_LAYER.items():
        color = BASE_COLORS[name]
        draw.rectangle(
            [x0 * scale, y0 * scale, x1 * scale - 1, y1 * scale - 1],
            fill=color, outline=(0, 0, 0, 255), width=2,
        )
        draw.text((x0 * scale + 4, y0 * scale + 4), name, fill=(0, 0, 0, 255))

    for name, (x0, y0, x1, y1) in OVERLAY_LAYER.items():
        base_name = name.split(" (")[0]
        color = BASE_COLORS[base_name][:3] + (40,)
        draw.rectangle(
            [x0 * scale, y0 * scale, x1 * scale - 1, y1 * scale - 1],
            fill=color, outline=(0, 0, 0, 160), width=1,
        )
        draw.text((x0 * scale + 4, y0 * scale + 4), name, fill=(0, 0, 0, 200))

    img.save(path)


if __name__ == "__main__":
    root = os.path.dirname(os.path.abspath(__file__))
    textures_dir = os.path.join(root, "StrawberryCollectionSkinPack", "textures")
    templates_dir = os.path.join(root, "templates")
    os.makedirs(textures_dir, exist_ok=True)
    os.makedirs(templates_dir, exist_ok=True)

    for filename in ("strawberry_classic.png", "strawberry_slim.png", "strawberry_cap.png"):
        make_blank_texture(os.path.join(textures_dir, filename))
        print(f"Wrote blank template: textures/{filename}")

    guide_path = os.path.join(templates_dir, "uv_guide.png")
    make_uv_guide(guide_path)
    print(f"Wrote UV reference guide: templates/uv_guide.png")
