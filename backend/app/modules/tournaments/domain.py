"""Tournaments domain entities."""

class Tournament:
    def __init__(self, tournament_id: int, name: str):
        self.id = tournament_id
        self.name = name
