"""The signed-in user's own profile."""
from werkzeug.datastructures import FileStorage

from app.forms.staff_forms import PasswordChangeInput, ProfileInput
from app.models.auth.user import User
from app.repositories.auth.user_repository import UserRepository
from app.services.errors import NotFoundError
from app.utils.file_storage import ImageStorage
from app.utils.security import PasswordHasher


class ProfileService:
    def __init__(self, user_repo: UserRepository | None = None,
                 hasher: PasswordHasher | None = None,
                 storage: ImageStorage | None = None) -> None:
        self.user_repo = user_repo or UserRepository()
        self.hasher = hasher or PasswordHasher()
        self.storage = storage or ImageStorage("AVATAR_UPLOAD_FOLDER")

    def get_profile(self, user_id: int) -> User:
        user = self.user_repo.find_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found.")
        return user

    def update_profile(self, user_id: int, data: ProfileInput, avatar: FileStorage | None) -> User:
        if len(data.name) > 100:
            raise ValueError("Name must be 100 characters or fewer.")
        filename = self.storage.save(avatar)
        self.user_repo.update_profile(user_id, data.name, data.phone or None, filename)
        return self.get_profile(user_id)

    def change_password(self, user_id: int, data: PasswordChangeInput) -> None:
        user = self.get_profile(user_id)
        if not self.hasher.verify(user.password_hash, data.current_password):
            raise ValueError("Current password is incorrect.")
        if data.new_password != data.confirm_password:
            raise ValueError("New password and confirmation do not match.")
        if data.new_password == data.current_password:
            raise ValueError("New password must be different from the current one.")
        self.user_repo.update_password(user_id, self.hasher.hash(data.new_password))
