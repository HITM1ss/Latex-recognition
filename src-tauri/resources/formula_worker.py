#!/usr/bin/env python3
"""Local LaTeX OCR worker.

The worker deliberately speaks JSONL on stdout: one request per line and one
response per line.  Logs go to stderr so the Rust side can treat stdout as a
strict protocol stream.  TexTeller is loaded once and then reused for all
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
        "engine": "texteller-local",
        "error": {"code": code, "message": message},
    }


MODEL_REPO = "OleehyO/TexTeller"
PROGRESS_INTERVAL = 0.5


def _emit_progress(downloaded: int, total: int, speed_bps: float, filename: str) -> None:
    """通过 stdout 协议上报下载进度，供前端实时显示进度和速度。"""
    emit({
        "type": "download_progress",
        "downloaded": downloaded,
        "total": total,
        "speed_bps": round(speed_bps),
        "filename": filename,
    })


def _stream_download(target: Path, endpoint: str) -> None:
    """逐个文件流式下载 repo 到 target，过程中实时上报进度。

    相比 snapshot_download（无进度回调），这里自己控制下载循环：
    `downloaded / total` 就是整体进度，`speed_bps` 为近 0.5s 的平均速度。
    每个文件下载完成后会比对期望大小；不匹配视为失败并清理残留。
    """
    with contextlib.redirect_stdout(sys.stderr):
        from huggingface_hub import HfApi  # type: ignore

        import requests  # type: ignore

    info = HfApi().model_info(MODEL_REPO, files_metadata=True)
    siblings = [
        s for s in (info.siblings or []) if not s.rfilename.startswith(".")
    ]
    if not siblings:
        raise RuntimeError("无法获取模型文件清单")
    total = sum(s.size or 0 for s in siblings) or 1
    downloaded = 0
    session = requests.Session()
    last_tick = time.monotonic()
    last_downloaded = 0
    try:
        for sibling in siblings:
            name = sibling.rfilename
            expected = sibling.size or 0
            target_file = target / name
            # 已存在同等大小文件视为完成（续传/幂等）
            if expected > 0 and target_file.is_file() and target_file.stat().st_size == expected:
                downloaded += expected
                continue
            url = f"{endpoint}/{MODEL_REPO}/resolve/main/{name}"
            with session.get(url, stream=True, timeout=(15, 120)) as resp:
                resp.raise_for_status()
                with open(target_file, "wb") as fh:
                    for chunk in resp.iter_content(chunk_size=1 << 20):
                        if not chunk:
                            continue
                        fh.write(chunk)
                        downloaded += len(chunk)
                        now = time.monotonic()
                        if now - last_tick >= PROGRESS_INTERVAL:
                            speed = (downloaded - last_downloaded) / max(now - last_tick, 1e-9)
                            _emit_progress(downloaded, total, speed, name)
                            last_tick = now
                            last_downloaded = downloaded
            # 大小校验：镜像返回异常内容（如 HTML 错误页）时拒收。
            if expected > 0 and target_file.stat().st_size != expected:
                target_file.unlink(missing_ok=True)
                raise RuntimeError(f"文件大小不符，已清理：{name}（期望 {expected} 实际 {target_file.stat().st_size if target_file.exists() else 0}）")
    finally:
        session.close()
    _emit_progress(total, total, 0.0, "")


def _download_model(target: Path) -> None:
    """从 HuggingFace 仓库下载模型权重到 target 目录。

    下载期间临时允许在线（worker 常驻默认离线，见模块头部的离线设置），
    这样既保证打包后不自动联网，也允许首次运行时拉取官方模型。
    """
    saved = {k: os.environ.get(k) for k in ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE")}
    for key in saved:
        os.environ.pop(key, None)
    # SSL 信任链校验失败 == 本机 CA 库不完整。用户未显式指定 HF_ENDPOINT 时，
    # 默认走 hf-mirror.com 镜像（中国大陆网络可达，且证书链通常能正常验证），
    # 用户可用环境变量覆盖为任意自定义 HF 端点。
    os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
    try:
        with contextlib.redirect_stdout(sys.stderr):
            import huggingface_hub.constants as hf_constants  # type: ignore
        # huggingface_hub 的离线标志/端点在 import 时缓存为模块常量，
        # 仅 pop 或 set 环境变量无效，必须显式覆盖其缓存值。
        hf_constants.HF_HUB_OFFLINE = False
        hf_constants.ENDPOINT = os.environ["HF_ENDPOINT"]
        try:
            _stream_download(target, hf_constants.ENDPOINT.rstrip("/"))
        except Exception:
            logging.exception("流式下载失败，回退 snapshot_download")
            with contextlib.redirect_stdout(sys.stderr):
                from huggingface_hub import snapshot_download  # type: ignore
            snapshot_download(MODEL_REPO, local_dir=str(target))
    finally:
        for key, value in saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
    has_weight = any(
        (target / name).is_file() and (target / name).stat().st_size > 0
        for name in ("model.safetensors", "pytorch_model.bin")
    )
    missing = []
    if not has_weight:
        missing.append("model.safetensors / pytorch_model.bin")
    if not ((target / "config.json").is_file() and (target / "config.json").stat().st_size > 0):
        missing.append("config.json")
    if missing:
        raise RuntimeError(
            "模型下载不完整，缺失文件：" + "、".join(missing)
            + "。请检查网络后重试（可在设置页再次点击下载权重）。"
        )


def _model_root() -> Path:
    """定位 TexTeller 权重目录；找不到就下载一份（优先下载到显式指定目录）。

    优先级：AXIOM_TEXTELLER_MODEL_DIR（Rust 端会注入用户数据目录）
    → 随包捆绑 resources/models/texteller。
    """
    configured = os.environ.get("AXIOM_TEXTELLER_MODEL_DIR")
    script_dir = Path(__file__).resolve().parent
    bundled_candidates = (
        script_dir / "models" / "texteller",
        script_dir / "resources" / "models" / "texteller",
    )

    candidates: list[Path] = []
    if configured:
        candidates.append(Path(configured).expanduser().resolve())
    candidates.extend(bundled_candidates)

    for candidate in candidates:
        if (candidate / "config.json").is_file():
            return candidate

    # 本地没有模型 → 从官方仓库下载到第一个候选目录
    target = candidates[0] if configured else bundled_candidates[0]
    target.mkdir(parents=True, exist_ok=True)
    _download_model(target)
    return target


def _use_onnx() -> bool:
    value = os.environ.get("AXIOM_TEXTELLER_ONNX", "").strip().lower()
    return value in ("1", "true", "yes", "onnx")


def _num_beams() -> int:
    try:
        return max(1, int(os.environ.get("AXIOM_TEXTELLER_BEAMS", "1")))
    except ValueError:
        return 1


def load_model():
    """Load TexTeller once (model + tokenizer) and return the inference
    primitives.  CPU is the target backend for this desktop app."""
    with contextlib.redirect_stdout(sys.stderr):
        from texteller import img2latex  # type: ignore
        from texteller import load_model as _load_model  # type: ignore
        from texteller import load_tokenizer as _load_tokenizer  # type: ignore

    root = _model_root()
    model_dir = str(root)
    with contextlib.redirect_stdout(sys.stderr):
        model = _load_model(model_dir=model_dir, use_onnx=_use_onnx())
        tokenizer = _load_tokenizer(tokenizer_dir=model_dir)

    try:
        import torch  # type: ignore

        cpu_count = os.cpu_count() or 4
        torch.set_num_threads(max(1, min(cpu_count, 8)))
    except Exception:
        pass

    return {"model": model, "tokenizer": tokenizer, "img2latex": img2latex}


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


def recognize(components: dict[str, Any], request: dict[str, Any]) -> dict[str, Any]:
    request_id = int(request.get("id", 0))
    started = time.perf_counter()
    try:
        image = _decode_image(request)
    except ValueError as exc:
        return error_response(request_id, "invalid_image", str(exc))

    try:
        with contextlib.redirect_stdout(sys.stderr):
            import numpy as np  # type: ignore

            latex_list = components["img2latex"](
                components["model"],
                components["tokenizer"],
                [np.asarray(image, dtype=np.uint8)],
                # device 不传：texteller 默认自动选 CPU/GPU（本应用以 CPU 为目标）
                num_beams=_num_beams(),
            )
        latex = str((latex_list or [""])[0] or "").strip()
        if not latex:
            return error_response(request_id, "no_formula", "模型没有识别出公式")
        return {
            "id": request_id,
            "ok": True,
            "latex": latex,
            # TexTeller 未暴露校准后的置信度分数。
            "confidence": None,
            "elapsed_ms": round((time.perf_counter() - started) * 1000),
            "engine": "texteller-local",
            "error": None,
        }
    except Exception as exc:  # 保持 worker 存活以处理下一个请求。
        logging.exception("local recognition failed")
        return error_response(request_id, "inference_failed", str(exc))


def main() -> int:
    logging.basicConfig(stream=sys.stderr, level=logging.INFO)
    try:
        components = load_model()
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
        "engine": "texteller-local",
        "model": "texteller-3.0",
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
            emit(recognize(components, request))
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
