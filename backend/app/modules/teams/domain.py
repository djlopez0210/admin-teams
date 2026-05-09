"""Teams domain entities."""

class Team:
    def __init__(self, team_id: int, name: str):
        self.id = team_id
        self.name = name
