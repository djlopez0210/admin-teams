"""Tournaments persistence interfaces."""

class TournamentRepository:
    def create(self, name: str):
        raise NotImplementedError
