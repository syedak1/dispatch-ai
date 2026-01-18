"""
Custom exceptions for The Token Company API
"""


class TokenCError(Exception):
    """Base exception for all Token Company API errors."""
    pass


class AuthenticationError(TokenCError):
    """Raised when API authentication fails."""
    pass


class InvalidRequestError(TokenCError):
    """Raised when the request parameters are invalid."""
    pass


class APIError(TokenCError):
    """Raised when the API returns an error."""
    pass


class RateLimitError(TokenCError):
    """Raised when the API rate limit is exceeded."""
    pass
