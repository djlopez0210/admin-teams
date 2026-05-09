"""Teams persistence interfaces."""

class TeamRepository:
    def create(self, name: str):
        raise NotImplementedError
