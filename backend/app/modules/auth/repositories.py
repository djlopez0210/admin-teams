"""Auth persistence interfaces (to be implemented with ORM)."""

class UserRepository:
    def get_by_username(self, username: str):
        raise NotImplementedError

    def create(self, username: str, password_hash: str):
        raise NotImplementedError
