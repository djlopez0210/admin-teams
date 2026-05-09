"""Costs domain entities."""

class Cost:
    def __init__(self, cost_id: int, amount: float):
        self.id = cost_id
        self.amount = amount
