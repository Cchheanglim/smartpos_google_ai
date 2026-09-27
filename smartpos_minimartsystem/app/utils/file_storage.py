"""Image upload storage, used by services that accept an uploaded picture."""
import os
import uuid

from flask import current_app
from werkzeug.datastructures import FileStorage


class ImageStorage:
    """Validates and saves uploaded images under a configured folder."""

    def __init__(self, folder_config_key: str) -> None:
        self._folder_key = folder_config_key

    def save(self, upload: FileStorage | None) -> str | None:
        """Save ``upload`` with a random name and return the filename.

        Returns None when no file was chosen. Raises ValueError for a
        file type that is not an allowed image extension.
        """
        if upload is None or not upload.filename:
            return None
        ext = upload.filename.rsplit(".", 1)[-1].lower() if "." in upload.filename else ""
        if ext not in current_app.config["ALLOWED_IMAGE_EXTENSIONS"]:
            raise ValueError("Image must be a PNG, JPG, GIF or WEBP file.")
        filename = f"{uuid.uuid4().hex}.{ext}"
        upload.save(os.path.join(current_app.config[self._folder_key], filename))
        return filename
