"""Auth domain entities (e.g., User, Roles)."""

class User:
    def __init__(self, user_id: int, username: str):
        self.id = user_id
        self.username = username
