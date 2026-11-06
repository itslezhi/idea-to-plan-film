#!/usr/bin/env python3
"""Linear-light shutter integration and contact sheets for the film (MIT).

python3 scripts/composite.py frames --input-dir output/captures --output-dir output/frames --frames 150 --samples 4
python3 scripts/composite.py sheet --input-dir output/stills --output output/contact-sheet.jpg
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


_SRGB = np.arange(256, dtype=np.float32) / 255
_TO_LINEAR = np.where(_SRGB <= 0.04045, _SRGB / 12.92, ((_SRGB + 0.055) / 1.055) ** 2.4)
_LINEAR = np.linspace(0, 1, 65_536, dtype=np.float32)
_TO_SRGB = np.rint(255 * np.where(_LINEAR <= 0.0031308, _LINEAR * 12.92, 1.055 * _LINEAR ** (1 / 2.4) - 0.055)).astype(np.uint8)


def integrate_frame(frame: int, source: Path, destination: Path, count: int) -> None:
    accumulator = None
    for sample in range(count):
        filename = source / f'{frame:05d}_{sample:02d}.png'
        with Image.open(filename) as image:
            array = np.asarray(image.convert('RGB'))
        linear = _TO_LINEAR[array]
        if accumulator is None:
            accumulator = linear
        else:
            accumulator += linear
    accumulator /= count
    result = _TO_SRGB[np.rint(np.clip(accumulator, 0, 1) * 65_535).astype(np.uint16)]
    Image.fromarray(result).save(destination / f'{frame:05d}.png', compress_level=3)


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for filename in [
        '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/System/Library/Fonts/Helvetica.ttc',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    ]:
        try:
            return ImageFont.truetype(filename, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)


def sheet(source: Path, output: Path) -> None:
    manifest_file = source / 'manifest.json'
    manifest = json.loads(manifest_file.read_text()) if manifest_file.exists() else None
    items = manifest['stills'] if manifest else [{'file': p.name, 'time': None} for p in sorted(source.glob('*.png'))]
    if not items:
        raise SystemExit(f'No stills in {source}')
    cols = min(4, len(items))
    rows = (len(items) + cols - 1) // cols
    width, height, gap, label, top = 480, 270, 16, 43, 70
    image = Image.new('RGB', (cols * width + (cols + 1) * gap, top + rows * (height + label + gap)), '#f4f2ec')
    draw = ImageDraw.Draw(image)
    draw.text((gap, 16), 'IDEA TO PLAN  /  FIVE-SECOND STUDY', font=font(25), fill='#233a39')
    draw.text((gap, 47), 'Original character, scene, animation and synthesized sound. One continuous camera.', font=font(15), fill='#667571')
    for index, item in enumerate(items):
        x = gap + index % cols * (width + gap)
        y = top + index // cols * (height + label + gap)
        with Image.open(source / item['file']) as still:
            image.paste(still.convert('RGB').resize((width, height), Image.Resampling.LANCZOS), (x, y))
        draw.rectangle((x, y + height, x + width, y + height + label), fill='white')
        time = item.get('time')
        text = f'{index + 1:02d}  /  {time:.2f} s' if time is not None else f'{index + 1:02d}  /  {item["file"]}'
        draw.text((x + 12, y + height + 11), text, font=font(18), fill='#233a39')
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, quality=93)
    print(json.dumps({'contact_sheet': str(output), 'stills': len(items), 'size': image.size}))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    frames = commands.add_parser('frames')
    frames.add_argument('--input-dir', type=Path, required=True)
    frames.add_argument('--output-dir', type=Path, required=True)
    frames.add_argument('--frames', type=int, required=True)
    frames.add_argument('--samples', type=int, default=4)
    frames.add_argument('--workers', type=int, default=2)
    contact = commands.add_parser('sheet')
    contact.add_argument('--input-dir', type=Path, required=True)
    contact.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.command == 'sheet':
        sheet(args.input_dir, args.output)
        return
    if args.frames < 1 or args.samples < 1:
        parser.error('--frames and --samples must be positive')
    args.output_dir.mkdir(parents=True, exist_ok=True)
    # Two workers bound memory usage while PNG decode/compression release the GIL.
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 4))) as pool:
        list(pool.map(lambda f: integrate_frame(f, args.input_dir, args.output_dir, args.samples), range(args.frames)))
    print(json.dumps({'integrated_frames': args.frames, 'shutter_samples': args.samples, 'space': 'linear sRGB', 'directory': str(args.output_dir)}))


if __name__ == '__main__':
    main()
