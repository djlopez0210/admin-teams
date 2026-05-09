"""Players persistence interfaces."""

class PlayerRepository:
    def create(self, name: str):
        raise NotImplementedError
