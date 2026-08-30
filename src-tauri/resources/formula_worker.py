#!/usr/bin/env python3
"""Local LaTeX OCR worker.

The worker deliberately speaks JSONL on stdout: one request per line and one
response per line.  Logs go to stderr so the Rust side can treat stdout as a
strict protocol stream.  pix2tex is loaded once and then reused for all
requests in the process.
"""

from __future__ import annotations

import base64
import contextlib
import io
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any

# Never allow a missing local asset to trigger a network download/check.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("NO_ALBUMENTATIONS_UPDATE", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("PYTHONUNBUFFERED", "1")

MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_BASE64_CHARS = 16 * 1024 * 1024


def emit(payload: dict[str, Any]) -> None:
    """Write exactly one protocol message."""
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def error_response(request_id: int, code: str, message: str) -> dict[str, Any]:
    return {
        "id": request_id,
        "ok": False,
        "latex": None,
        "confidence": None,
        "elapsed_ms": None,
        "engine": "pix2tex-local",
        "error": {"code": code, "message": message},
    }


def _model_root() -> Path:
    configured = os.environ.get("AXIOM_PIX2TEX_MODEL_DIR")
    if configured:
        return Path(configured).expanduser().resolve()

    script_dir = Path(__file__).resolve().parent
    bundled_candidates = (
        script_dir / "models" / "pix2tex" / "model",
        script_dir / "model",
        script_dir / "resources" / "models" / "pix2tex" / "model",
    )
    for bundled in bundled_candidates:
        if (bundled / "settings" / "config.yaml").is_file():
            return bundled

    # Development fallback: use the installed pix2tex package.  A packaged
    # worker should ship the bundled directory above (or set the environment
    # variable explicitly).
    with contextlib.redirect_stdout(sys.stderr):
        import pix2tex  # type: ignore

    return Path(pix2tex.__file__).resolve().parent / "model"


def load_model():
    """Load pix2tex once, with a compatibility shim for modern timm."""
    # Importing pix2tex can emit optional dependency messages.  Keep stdout
    # reserved for JSONL while still surfacing diagnostics in a terminal.
    with contextlib.redirect_stdout(sys.stderr):
        from munch import Munch  # type: ignore
        from pix2tex.cli import LatexOCR  # type: ignore

    root = _model_root()
    config = root / "settings" / "config.yaml"
    checkpoint = root / "checkpoints" / "weights.pth"
    tokenizer = root / "dataset" / "tokenizer.json"
    missing = [str(p) for p in (config, checkpoint, tokenizer) if not p.is_file()]
    if missing:
        raise RuntimeError("本地 pix2tex 模型文件缺失: " + ", ".join(missing))

    args = Munch(
        {
            "config": str(config),
            "checkpoint": str(checkpoint),
            "tokenizer": str(tokenizer),
            "no_cuda": True,
            # The bundled image-resizer is optional.  Disabling it avoids a
            # second model and keeps the CPU MVP deterministic.
            "no_resize": True,
        }
    )
    with contextlib.redirect_stdout(sys.stderr):
        model = LatexOCR(args)

    # pix2tex 0.1.x expects the encoder sequence.  Newer timm releases pool
    # the sequence in VisionTransformer.forward(), so explicitly use the
    # feature path.  This keeps the adapter compatible without changing the
    # user's global Python installation.
    encoder = getattr(getattr(model, "model", None), "encoder", None)
    if encoder is not None and hasattr(encoder, "forward_features"):
        encoder.forward = encoder.forward_features

    try:
        import torch  # type: ignore

        cpu_count = os.cpu_count() or 4
        torch.set_num_threads(max(1, min(cpu_count, 8)))
    except Exception:
        pass

    return model


def _decode_image(request: dict[str, Any]):
    raw_value = request.get("image_base64")
    if not isinstance(raw_value, str) or not raw_value.strip():
        raise ValueError("请求缺少 image_base64")
    if len(raw_value) > MAX_BASE64_CHARS:
        raise ValueError("图片数据过大，限制为 12 MB")

    encoded = raw_value.strip()
    if encoded.startswith("data:"):
        try:
            encoded = encoded.split(",", 1)[1]
        except IndexError as exc:
            raise ValueError("无效的 data URL") from exc
    try:
        data = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise ValueError("图片 Base64 数据无效") from exc
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise ValueError("图片数据为空或超过 12 MB")

    with contextlib.redirect_stdout(sys.stderr):
        from PIL import Image, ImageStat  # type: ignore

    try:
        image = Image.open(io.BytesIO(data)).convert("RGB")
        image.load()
    except Exception as exc:
        raise ValueError("无法读取图片，请使用 PNG/JPG/WebP/BMP") from exc

    if image.width < 2 or image.height < 2:
        raise ValueError("图片尺寸过小")
    if image.width > 4096 or image.height > 4096:
        image.thumbnail((4096, 4096), Image.Resampling.LANCZOS)

    # pix2tex's pad() cannot find a bounding box in a perfectly blank image.
    extrema = ImageStat.Stat(image.convert("L")).extrema[0]
    if extrema[0] == extrema[1]:
        raise ValueError("图片中没有可识别的内容")
    return image


def recognize(model, request: dict[str, Any]) -> dict[str, Any]:
    request_id = int(request.get("id", 0))
    started = time.perf_counter()
    try:
        image = _decode_image(request)
    except ValueError as exc:
        return error_response(request_id, "invalid_image", str(exc))

    try:
        with contextlib.redirect_stdout(sys.stderr):
            latex = model(image, resize=False)
        latex = str(latex or "").strip()
        if not latex:
            return error_response(request_id, "no_formula", "模型没有识别出公式")
        return {
            "id": request_id,
            "ok": True,
            "latex": latex,
            # pix2tex does not expose a calibrated confidence score.
            "confidence": None,
            "elapsed_ms": round((time.perf_counter() - started) * 1000),
            "engine": "pix2tex-local",
            "error": None,
        }
    except Exception as exc:  # Keep the worker alive for the next request.
        logging.exception("local recognition failed")
        return error_response(request_id, "inference_failed", str(exc))


def main() -> int:
    logging.basicConfig(stream=sys.stderr, level=logging.INFO)
    try:
        model = load_model()
    except Exception as exc:
        logging.exception("failed to load local model")
        emit({
            "type": "error",
            "ok": False,
            "error": {"code": "model_unavailable", "message": str(exc)},
        })
        return 2

    emit({
        "type": "ready",
        "ok": True,
        "engine": "pix2tex-local",
        "model": "pix2tex-base",
    })

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        request: Any = {}
        try:
            request = json.loads(line)
            if not isinstance(request, dict):
                raise ValueError("请求必须是 JSON 对象")
            if request.get("type") == "shutdown":
                break
            emit(recognize(model, request))
        except Exception as exc:
            logging.exception("invalid worker request")
            request_id = 0
            try:
                request_id = int(request.get("id", 0))  # type: ignore[name-defined]
            except Exception:
                pass
            emit(error_response(request_id, "invalid_request", str(exc)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
