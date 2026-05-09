class ActivityLog:
    @staticmethod
    def log(action: str, detail: str = "") -> None:
        # Minimal placeholder for activity logging
        # In future, integrate with a proper logger or DB table
        msg = f"{action}: {detail}" if detail else action
        print(msg)
