"""Service-layer exception types.

* ``ValueError``      – invalid input / broken business rule (route flashes it)
* ``NotFoundError``   – requested record does not exist (app returns 404)
"""


class NotFoundError(LookupError):
    """Raised when a service cannot find the requested entity."""
