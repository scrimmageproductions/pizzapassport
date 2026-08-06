# Strawberry Collection — Bedrock Skin Pack

A Minecraft Bedrock Edition skin pack for the "Strawberry Avatar" IP,
built for local testing and eventual Minecraft Partner Program submission.

## Folder structure

```
minecraft/
├── generate_skin_template.py          Dev tool: (re)generates blank textures + UV guide
├── templates/
│   └── uv_guide.png                   Reference only — labeled UV regions, do NOT ship this
└── StrawberryCollectionSkinPack/       <-- this whole folder IS the pack
    ├── manifest.json                  Pack identity, version, engine requirement
    ├── skins.json                     Maps display names -> geometry + texture
    ├── pack_icon.png                  128x128 icon shown in the skin pack list
    ├── texts/
    │   ├── languages.json             Declares which .lang files exist
    │   └── en_US.lang                 Display-name strings referenced by skins.json
    └── textures/
        ├── strawberry_classic.png     64x64, geometry.humanoid.custom
        ├── strawberry_slim.png        64x64, geometry.humanoid.customSlim
        └── strawberry_cap.png         64x64, geometry.humanoid.custom + hat-layer pixels
```

Everything Bedrock needs to load the pack lives directly under
`StrawberryCollectionSkinPack/` — `manifest.json` and `skins.json` must sit
at that folder's root, not nested inside a subfolder.

## Filling in the artwork

`generate_skin_template.py` only writes **fully transparent** 64x64 PNGs —
they're placeholders so the pack is valid and installable immediately.
Open `templates/uv_guide.png` alongside your art tool (Aseprite, Photoshop,
GIMP, etc.) as a reference for where each body part's pixels go, then paint
directly into the three files under `textures/`.

For `strawberry_cap.png`: there's no "enable outer layer" switch in
`skins.json`. The second layer (hat/jacket/sleeves/pants) renders
automatically on `geometry.humanoid.custom(Slim)` whenever you paint
non-transparent pixels into the overlay regions the guide highlights
(e.g. `Head (Hat)` at x32-64, y0-16). Leave those regions transparent on
`strawberry_classic.png`/`strawberry_slim.png` if you don't want a visible
overlay on those skins.

To regenerate blank textures/guide from scratch:

```bash
python3 generate_skin_template.py
```

## Testing in Minecraft Bedrock (`.mcpack`)

An `.mcpack` is just the pack folder zipped up with the extension renamed.

```bash
cd minecraft/StrawberryCollectionSkinPack
zip -r ../StrawberryCollection.mcpack . -x ".*"
```

Important: zip the **contents** of `StrawberryCollectionSkinPack/`
(`manifest.json` etc. at the top level of the archive), not the folder
itself — a nested `StrawberryCollectionSkinPack/manifest.json` inside the
zip will fail to import.

Then:

1. Transfer `StrawberryCollection.mcpack` to the test device (AirDrop,
   email, cloud drive, USB, etc.).
2. Tap/open the file — Bedrock registers `.mcpack` as a file association
   and will launch Minecraft's importer automatically.
3. In-game: **Settings → Global Resources** (or **Profile → Skin Picker**
   in newer builds) → the "Strawberry Collection" pack should appear with
   its `pack_icon.png` and all three skins, ready to select.

If double-tapping doesn't trigger the importer on your platform, you can
instead drop the unzipped `StrawberryCollectionSkinPack` folder directly
into Bedrock's `skin_packs` directory:

- **Windows (UWP):**
  `%LOCALAPPDATA%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\skin_packs\`
- **Android:** `/storage/emulated/0/Android/data/com.mojang.minecraftpe/files/games/com.mojang/skin_packs/`
- **iOS:** via the Files app under Minecraft's app documents, `games/com.mojang/skin_packs/`

Restart Minecraft after copying so it rescans the `skin_packs` directory.

## Before Partner Program submission

- Replace `pack_icon.png` with real Strawberry Avatar artwork (the current
  one is a placeholder generated for testing).
- Paint over the three transparent textures with the final designs.
- Confirm `min_engine_version` in `manifest.json` matches the lowest
  Bedrock version you've actually tested against.
- Increment `version` in `manifest.json` (and `skins.json` stays
  version-less — only the manifest is versioned) for any future update.
