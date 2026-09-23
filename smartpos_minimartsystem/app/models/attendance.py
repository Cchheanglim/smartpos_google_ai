"""
Staff Attendance and Shift Domain Models
"""

from typing import Dict, Any, Optional
from datetime import datetime
from .base import BaseModel


class Shift(BaseModel):
    """Work shift time definition."""
    
    def __init__(self, id: Optional[int], name: str, start_time: str, end_time: str):
        super().__init__(id)
        self.name = name
        self.start_time = start_time
        self.end_time = end_time

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'start_time': self.start_time,
            'end_time': self.end_time
        }


class AttendanceRecord(BaseModel):
    """Staff punch clock record with starting and ending drawer cash floats."""
    
    def __init__(
        self,
        id: Optional[int],
        user_id: int,
        clock_in: datetime,
        clock_out: Optional[datetime] = None,
        status: str = 'present',
        starting_cash: float = 0.0,
        counted_cash: Optional[float] = None,
        cash_discrepancy: float = 0.0,
        notes: str = '',
        user_name: str = ''
    ):
        super().__init__(id)
        self.user_id = user_id
        self.clock_in = clock_in
        self.clock_out = clock_out
        self.status = status
        self.starting_cash = round(float(starting_cash), 2)
        self.counted_cash = round(float(counted_cash), 2) if counted_cash is not None else None
        self.cash_discrepancy = round(float(cash_discrepancy), 2)
        self.notes = notes
        self.user_name = user_name

    def clock_out_now(self, counted_cash: float) -> None:
        """Records checkout timestamp and reconciles physical cash."""
        self.clock_out = datetime.now()
        self.counted_cash = round(float(counted_cash), 2)
        self.cash_discrepancy = round(self.counted_cash - self.starting_cash, 2)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user_name,
            'clock_in': self.clock_in.strftime('%Y-%m-%d %H:%M:%S') if self.clock_in else '',
            'clock_out': self.clock_out.strftime('%Y-%m-%d %H:%M:%S') if self.clock_out else None,
            'status': self.status,
            'starting_cash': self.starting_cash,
            'counted_cash': self.counted_cash,
            'cash_discrepancy': self.cash_discrepancy,
            'notes': self.notes
        }
