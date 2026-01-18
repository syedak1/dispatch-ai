"""
Type definitions for The Token Company API
"""

from typing import Optional
from dataclasses import dataclass


@dataclass
class CompressionSettings:
    """
    Settings for text compression.

    Attributes:
        aggressiveness: Compression intensity from 0.0 to 1.0 (default: 0.5)
        max_output_tokens: Optional maximum token count for output
        min_output_tokens: Optional minimum token count for output
    """
    aggressiveness: float = 0.5
    max_output_tokens: Optional[int] = None
    min_output_tokens: Optional[int] = None

    def __post_init__(self):
        """Validate compression settings."""
        if not 0.0 <= self.aggressiveness <= 1.0:
            raise ValueError("aggressiveness must be between 0.0 and 1.0")

        if self.max_output_tokens is not None and self.max_output_tokens < 1:
            raise ValueError("max_output_tokens must be positive")

        if self.min_output_tokens is not None and self.min_output_tokens < 1:
            raise ValueError("min_output_tokens must be positive")

        if (
            self.max_output_tokens is not None
            and self.min_output_tokens is not None
            and self.min_output_tokens > self.max_output_tokens
        ):
            raise ValueError("min_output_tokens cannot exceed max_output_tokens")

    def to_dict(self) -> dict:
        """Convert to dictionary format for API requests."""
        return {
            "aggressiveness": self.aggressiveness,
            "max_output_tokens": self.max_output_tokens,
            "min_output_tokens": self.min_output_tokens,
        }


@dataclass
class CompressRequest:
    """
    Request for text compression.

    Attributes:
        model: Model to use for compression
        input: The text to compress
        compression_settings: Settings for compression
    """
    model: str
    input: str
    compression_settings: CompressionSettings

    def to_dict(self) -> dict:
        """Convert to dictionary format for API requests."""
        return {
            "model": self.model,
            "input": self.input,
            "compression_settings": self.compression_settings.to_dict(),
        }


@dataclass
class CompressResponse:
    """
    Response from text compression.

    Attributes:
        output: The compressed text
        output_tokens: Token count of the compressed output
        original_input_tokens: Token count of the original input
        compression_time: Processing duration in seconds
    """
    output: str
    output_tokens: int
    original_input_tokens: int
    compression_time: float

    @classmethod
    def from_dict(cls, data: dict) -> "CompressResponse":
        """Create from API response dictionary."""
        return cls(
            output=data["output"],
            output_tokens=data["output_tokens"],
            original_input_tokens=data["original_input_tokens"],
            compression_time=data["compression_time"],
        )

    @property
    def tokens_saved(self) -> int:
        """Calculate the number of tokens saved by compression."""
        return self.original_input_tokens - self.output_tokens

    @property
    def compression_ratio(self) -> float:
        """Calculate the compression ratio (original/compressed)."""
        if self.output_tokens == 0:
            return 0.0
        return self.original_input_tokens / self.output_tokens

    @property
    def compression_percentage(self) -> float:
        """Calculate the percentage reduction in tokens."""
        if self.original_input_tokens == 0:
            return 0.0
        return (self.tokens_saved / self.original_input_tokens) * 100
