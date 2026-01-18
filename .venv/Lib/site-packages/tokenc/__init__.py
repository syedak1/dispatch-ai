"""
tokenc - Python SDK for The Token Company API

A Python client library for compressing LLM inputs to reduce token usage,
lower costs, and speed up AI applications.
"""

from tokenc.client import TokenClient
from tokenc.types import (
    CompressionSettings,
    CompressRequest,
    CompressResponse,
)
from tokenc.errors import (
    TokenCError,
    AuthenticationError,
    InvalidRequestError,
    APIError,
    RateLimitError,
)
from tokenc.constants import Model

__version__ = "0.1.0"

__all__ = [
    "TokenClient",
    "CompressionSettings",
    "CompressRequest",
    "CompressResponse",
    "TokenCError",
    "AuthenticationError",
    "InvalidRequestError",
    "APIError",
    "RateLimitError",
    "Model",
]
