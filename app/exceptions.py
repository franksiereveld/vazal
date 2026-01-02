class ToolError(Exception):
    """Raised when a tool encounters an error."""

    def __init__(self, message):
        self.message = message


class VazalError(Exception):
    """Base exception for all Vazal errors"""


class TokenLimitExceeded(VazalError):
    """Exception raised when the token limit is exceeded"""
