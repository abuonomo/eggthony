#!/usr/bin/env python3
"""Generate or edit pixel art sprites via OpenAI's gpt-image-1 API."""

import argparse
import base64
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from PIL import Image
import io


def _prepare_input_image(path: str) -> io.BytesIO:
    """Load an image and convert to RGBA PNG bytes for the API."""
    img = Image.open(path).convert("RGBA")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    buf.seek(0)
    buf.name = Path(path).name
    return buf


def _save_result(image_data: bytes, output: str) -> Path:
    """Decode, auto-crop, and save a generated image."""
    raw = base64.b64decode(image_data)
    img = Image.open(io.BytesIO(raw)).convert("RGBA")

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    out_path = Path(output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "PNG")
    print(f"Saved {img.size[0]}x{img.size[1]} RGBA sprite to {out_path}")
    return out_path


def generate_sprite(prompt: str, output: str, size: str = "1024x1024", quality: str = "medium") -> Path:
    load_dotenv()
    client = OpenAI()

    print(f"Generating sprite: {prompt[:80]}...")
    result = client.images.generate(
        model="gpt-image-1",
        prompt=prompt,
        size=size,
        quality=quality,
        background="transparent",
        output_format="png",
    )

    return _save_result(result.data[0].b64_json, output)


def edit_sprite(prompt: str, input_paths: list[str], output: str, size: str = "1024x1024", quality: str = "medium") -> Path:
    load_dotenv()
    client = OpenAI()

    images = [_prepare_input_image(p) for p in input_paths]
    label = ", ".join(Path(p).name for p in input_paths)
    print(f"Editing sprite ({label}): {prompt[:80]}...")

    result = client.images.edit(
        model="gpt-image-1",
        image=images if len(images) > 1 else images[0],
        prompt=prompt,
        size=size,
        quality=quality,
        background="transparent",
        output_format="png",
    )

    return _save_result(result.data[0].b64_json, output)


def main():
    parser = argparse.ArgumentParser(description="Generate or edit pixel art sprites via OpenAI image API")
    parser.add_argument("--prompt", required=True, help="Image generation/editing prompt")
    parser.add_argument("--output", required=True, help="Output PNG path")
    parser.add_argument("--input", dest="inputs", action="append", default=[], help="Input image(s) for editing (can be repeated)")
    parser.add_argument("--size", default="1024x1024", choices=["1024x1024", "1536x1024", "1024x1536"], help="Image size")
    parser.add_argument("--quality", default="medium", choices=["low", "medium", "high"], help="Generation quality")
    args = parser.parse_args()

    try:
        if args.inputs:
            edit_sprite(args.prompt, args.inputs, args.output, args.size, args.quality)
        else:
            generate_sprite(args.prompt, args.output, args.size, args.quality)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
