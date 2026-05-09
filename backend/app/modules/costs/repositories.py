"""Costs persistence interfaces."""

class CostRepository:
    def create(self, amount: float):
        raise NotImplementedError
