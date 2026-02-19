import os
import logging
from dotenv import load_dotenv

load_dotenv()

def validate_env_keys():
    required_keys = ["ADMIN_KEY", "AUDITOR_KEY", "VIEWER_KEY"]
    for key in required_keys:
        if not os.getenv(key):
            raise EnvironmentError(f"Missing required environment key: {key}")

def enforce_role(role):
    def decorator(func):
        def wrapper(*args, **kwargs):
            user_role = os.getenv("USER_ROLE")
            if user_role != role:
                logging.error(f"Access denied for role: {user_role}")
                raise PermissionError(f"Access denied for role: {user_role}")
            return func(*args, **kwargs)
        return wrapper
    return decorator

validate_env_keys()

# Example usage
@enforce_role("admin")
def admin_task():
    logging.info("Admin task executed.")

@enforce_role("auditor")
def auditor_task():
    logging.info("Auditor task executed.")

@enforce_role("viewer")
def viewer_task():
    logging.info("Viewer task executed.")
