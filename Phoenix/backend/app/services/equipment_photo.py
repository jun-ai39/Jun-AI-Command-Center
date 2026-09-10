"""Validate and normalize private equipment photo files."""

import os
import re
import warnings
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_EDGE = 1600
PHOTO_IDENTIFIER_PATTERN = re.compile(r"^[0-9a-f]{32}\.jpg$")
SUPPORTED_IMAGE_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})


class EquipmentPhotoError(RuntimeError):
    """Raised when an equipment photo cannot be safely processed."""


class EquipmentPhotoTooLargeError(EquipmentPhotoError):
    """Raised when an upload exceeds the configured byte limit."""


class UnsupportedEquipmentPhotoError(EquipmentPhotoError):
    """Raised when uploaded bytes are not a supported, valid image."""


def _normalized_rgb_image(content: bytes) -> Image.Image:
    """Decode, orient, resize, and copy pixels into a metadata-free image."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as source:
                if source.format not in SUPPORTED_IMAGE_FORMATS:
                    raise UnsupportedEquipmentPhotoError(
                        "JPEG, PNG, or WebP image data is required."
                    )
                source.load()
                oriented = ImageOps.exif_transpose(source)
                rgba = oriented.convert("RGBA")
    except (
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        UnidentifiedImageError,
        OSError,
    ) as error:
        raise UnsupportedEquipmentPhotoError(
            "The uploaded file is not a safe, supported image."
        ) from error

    normalized = Image.new("RGB", rgba.size, "white")
    normalized.paste(rgba, mask=rgba.getchannel("A"))
    normalized.thumbnail(
        (MAX_IMAGE_EDGE, MAX_IMAGE_EDGE),
        resample=Image.Resampling.LANCZOS,
    )
    return normalized


def store_equipment_photo(content: bytes, directory: Path) -> str:
    """Atomically store one normalized JPEG and return its opaque identifier."""
    if len(content) > MAX_UPLOAD_BYTES:
        raise EquipmentPhotoTooLargeError("Equipment photos must be 10 MB or smaller.")
    if not content:
        raise UnsupportedEquipmentPhotoError("An image file is required.")

    normalized = _normalized_rgb_image(content)
    target_directory = directory.expanduser().resolve()
    target_directory.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(target_directory, 0o700)
    except OSError:
        pass

    identifier = f"{uuid4().hex}.jpg"
    final_path = target_directory / identifier
    temporary_path = target_directory / f".{identifier}.pending"
    try:
        normalized.save(
            temporary_path,
            format="JPEG",
            quality=88,
            optimize=True,
        )
        try:
            os.chmod(temporary_path, 0o600)
        except OSError:
            pass
        temporary_path.replace(final_path)
    except OSError as error:
        temporary_path.unlink(missing_ok=True)
        raise EquipmentPhotoError("The equipment photo could not be stored.") from error
    finally:
        normalized.close()
    return identifier


def resolve_equipment_photo(directory: Path, identifier: str) -> Path | None:
    """Resolve only a valid opaque identifier inside the private photo folder."""
    if not PHOTO_IDENTIFIER_PATTERN.fullmatch(identifier):
        return None
    target_directory = directory.expanduser().resolve()
    candidate = (target_directory / identifier).resolve()
    if candidate.parent != target_directory or not candidate.is_file():
        return None
    return candidate


def delete_equipment_photo(directory: Path, identifier: str | None) -> None:
    """Remove one managed photo while ignoring old or invalid path values."""
    if identifier is None:
        return
    photo_path = resolve_equipment_photo(directory, identifier)
    if photo_path is not None:
        photo_path.unlink(missing_ok=True)
