"""
Token Company API Client
"""

from typing import Optional
import requests

from tokenc.constants import API_BASE_URL, DEFAULT_TIMEOUT, Model
from tokenc.types import CompressionSettings, CompressResponse
from tokenc.errors import (
    AuthenticationError,
    InvalidRequestError,
    APIError,
    RateLimitError,
)


class TokenClient:
    """
    Client for interacting with The Token Company API.

    Example:
        >>> from tokenc import TokenClient
        >>> client = TokenClient(api_key="your-api-key")
        >>> response = client.compress_input(
        ...     input="Your long text here...",
        ...     aggressiveness=0.5
        ... )
        >>> print(response.output)
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = API_BASE_URL,
        timeout: int = DEFAULT_TIMEOUT,
    ):
        """
        Initialize the Token Company API client.

        Args:
            api_key: Your API key for authentication
            base_url: Base URL for the API (default: https://api.thetokencompany.com)
            timeout: Request timeout in seconds (default: 30)
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._session = self._create_session()

    def _create_session(self) -> requests.Session:
        """Create a requests session with default headers."""
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        })
        return session

    def _handle_error(self, response: requests.Response) -> None:
        """Handle API error responses."""
        if response.status_code == 401:
            raise AuthenticationError("Invalid API key")
        elif response.status_code == 400:
            error_msg = response.json().get("error", "Invalid request")
            raise InvalidRequestError(error_msg)
        elif response.status_code == 429:
            raise RateLimitError("Rate limit exceeded")
        elif response.status_code >= 500:
            raise APIError(f"Server error: {response.status_code}")
        else:
            raise APIError(f"API error: {response.status_code}")

    def compress_input(
        self,
        input: str,
        model: str = Model.BEAR_1,
        aggressiveness: float = 0.5,
        max_output_tokens: Optional[int] = None,
        min_output_tokens: Optional[int] = None,
        compression_settings: Optional[CompressionSettings] = None,
    ) -> CompressResponse:
        """
        Compress text input for optimized LLM inference.

        Args:
            input: The text to compress
            model: Model to use for compression (default: "bear-1")
            aggressiveness: Compression intensity from 0.0 to 1.0 (default: 0.5)
                - 0.1-0.3: Light compression (obvious filler removal)
                - 0.4-0.6: Moderate compression (balanced approach)
                - 0.7-0.9: Aggressive compression (maximum cost savings)
            max_output_tokens: Optional maximum token count for output
            min_output_tokens: Optional minimum token count for output
            compression_settings: Optional CompressionSettings object. If provided,
                individual parameters (aggressiveness, max_output_tokens,
                min_output_tokens) are ignored.

        Returns:
            CompressResponse containing the compressed output and metadata

        Raises:
            AuthenticationError: If API key is invalid
            InvalidRequestError: If request parameters are invalid
            RateLimitError: If rate limit is exceeded
            APIError: For other API errors

        Example:
            >>> response = client.compress_input(
            ...     input="This is a very long text that needs compression...",
            ...     aggressiveness=0.7,
            ...     max_output_tokens=100
            ... )
            >>> print(f"Compressed: {response.output}")
            >>> print(f"Saved {response.original_input_tokens - response.output_tokens} tokens")
        """
        # Build compression settings
        if compression_settings is None:
            compression_settings = CompressionSettings(
                aggressiveness=aggressiveness,
                max_output_tokens=max_output_tokens,
                min_output_tokens=min_output_tokens,
            )

        # Build request payload
        payload = {
            "model": model,
            "input": input,
            "compression_settings": compression_settings.to_dict(),
        }

        # Make API request
        try:
            response = self._session.post(
                f"{self.base_url}/v1/compress",
                json=payload,
                timeout=self.timeout,
            )

            if not response.ok:
                self._handle_error(response)

            data = response.json()
            return CompressResponse.from_dict(data)

        except requests.exceptions.Timeout:
            raise APIError("Request timeout")
        except requests.exceptions.RequestException as e:
            raise APIError(f"Request failed: {str(e)}")

    def close(self) -> None:
        """Close the HTTP session."""
        self._session.close()

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()
