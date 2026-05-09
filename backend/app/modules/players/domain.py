"""Players domain entities."""

class Player:
    def __init__(self, player_id: int, name: str):
        self.id = player_id
        self.name = name
