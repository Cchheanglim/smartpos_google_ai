"""Typed inputs for authentication, staff management and profile pages."""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any, Mapping

from app.forms.base import FormReader


@dataclass(frozen=True)
class LoginInput:
    email: str
    password: str
    remember: bool

    @classmethod
    def from_form(cls, form: Mapping[str, Any]) -> "LoginInput":
        f = FormReader(form)
        return cls(email=f.required("email", "Email").lower(),
                   password=form.get("password") or "", remember=f.checkbox("remember"))


@dataclass(frozen=True)
class StaffInput:
    name: str
    email: str
    phone: str
    role_id: int
    active: bool
    password: str      # required on create, ignored on edit
    shift_id: int | None = None

    @classmethod
    def from_form(cls, form: Mapping[str, Any]) -> "StaffInput":
        f = FormReader(form)
        role_id = f.optional_int("role_id")
        if role_id is None:
            raise ValueError("Please choose a role.")
        return cls(name=f.required("name", "Name"), email=f.required("email", "Email").lower(),
                   phone=f.text("phone"), role_id=role_id, active=True,
                   password=form.get("password") or "", shift_id=f.optional_int("shift_id"))


@dataclass(frozen=True)
class PasswordChangeInput:
    current_password: str
    new_password: str
    confirm_password: str

    @classmethod
    def from_form(cls, form: Mapping[str, Any]) -> "PasswordChangeInput":
        return cls(current_password=form.get("current_password") or "",
                   new_password=form.get("new_password") or "",
                   confirm_password=form.get("confirm_password") or "")


@dataclass(frozen=True)
class ProfileInput:
    name: str
    phone: str

    @classmethod
    def from_form(cls, form: Mapping[str, Any]) -> "ProfileInput":
        f = FormReader(form)
        return cls(name=f.required("name", "Name"), phone=f.text("phone"))


def role_matrix_from_form(form: Mapping[str, Any]) -> dict[int, list[int]]:
    """Parse checkboxes named ``perm_<roleId>_<permissionId>``."""
    matrix: dict[int, list[int]] = {}
    for key in form.keys():
        parts = key.split("_")
        if len(parts) == 3 and parts[0] == "perm" and parts[1].isdigit() and parts[2].isdigit():
            matrix.setdefault(int(parts[1]), []).append(int(parts[2]))
    return matrix


def user_overrides_from_form(form: Mapping[str, Any]) -> list[int]:
    """Checkboxes named ``extra_perm`` carry permission ids granted to one person."""
    return FormReader(form).int_list("extra_perm")


@dataclass(frozen=True)
class ShiftInput:
    name: str
    start_time: str
    end_time: str

    @classmethod
    def from_form(cls, form: Mapping[str, Any]) -> "ShiftInput":
        f = FormReader(form)
        return cls(name=f.required("name", "Shift name")[:40], start_time=f.required("start_time", "Start time"),
                   end_time=f.required("end_time", "End time"))


@dataclass(frozen=True)
class TaskInput:
    title: str
    assigned_to: int
    priority: str
    due_date: "date | None"
    description: str

    @classmethod
    def from_form(cls, form: Mapping[str, Any]) -> "TaskInput":
        f = FormReader(form)
        assignee = f.optional_int("assigned_to")
        if assignee is None:
            raise ValueError("Choose who the task is for.")
        return cls(title=f.required("title", "Task title"), assigned_to=assignee,
                   priority=f.text("priority") or "medium", due_date=f.optional_date("due_date", "Due date"),
                   description=f.text("description"))


@dataclass(frozen=True)
class DrawerCountInput:
    """Opening float / counted cash, entered in USD and/or riel."""

    usd: Decimal
    khr: int
    notes: str

    @classmethod
    def from_form(cls, form: Mapping[str, Any]) -> "DrawerCountInput":
        f = FormReader(form)
        usd, khr = f.decimal("usd", "Cash (USD)"), f.integer("khr", "Cash (KHR)")
        if usd < 0 or khr < 0:
            raise ValueError("Cash amounts cannot be negative.")
        return cls(usd=usd, khr=khr, notes=f.text("notes")[:255])
