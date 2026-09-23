"""
Abstract Base Repository Interface
Defines the standard data-access contract following Domain-Driven Design repository patterns.
"""

from abc import ABC, abstractmethod
from typing import TypeVar, Generic, List, Optional, Dict, Any

T = TypeVar('T')


class BaseRepository(ABC, Generic[T]):
    """Abstract interface defining standard CRUD data access operations."""
    
    @abstractmethod
    def get_by_id(self, entity_id: int) -> Optional[T]:
        """Retrieves a single domain entity by its primary key ID."""
        pass

    @abstractmethod
    def get_all(self) -> List[T]:
        """Retrieves all domain entities."""
        pass

    @abstractmethod
    def create(self, entity: T) -> T:
        """Persists a new domain entity to the database and returns it with generated ID."""
        pass

    @abstractmethod
    def update(self, entity: T) -> bool:
        """Updates an existing domain entity."""
        pass

    @abstractmethod
    def delete(self, entity_id: int) -> bool:
        """Deletes an entity by primary key ID."""
        pass
