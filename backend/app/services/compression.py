import os
import httpx
from dotenv import load_dotenv

load_dotenv(dotenv_path="../../../.env")

TOKEN_COMPANY_API_KEY = os.getenv("TOKEN_COMPANY_API_KEY") or os.getenv("TOKENC_API_KEY")
TOKEN_COMPANY_URL = "https://api.thetokencompany.com/v1/compress"


async def compress_text(text: str, aggressiveness: float = 0.5) -> str:
    """
    Compress text using Token Company's bear-1 model.
    
    Args:
        text: Raw text from Overshoot buffer
        aggressiveness: 0.1-0.9 (0.5 is balanced)
        
    Returns:
        Compressed text
    """
    if not text or not text.strip():
        return text
    
    if not TOKEN_COMPANY_API_KEY:
        print("⚠️ Token Company API key not set, skipping compression")
        return text
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                TOKEN_COMPANY_URL,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {TOKEN_COMPANY_API_KEY}"
                },
                json={
                    "model": "bear-1",
                    "compression_settings": {
                        "aggressiveness": aggressiveness,
                        "max_output_tokens": None,
                        "min_output_tokens": None
                    },
                    "input": text
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                original = result.get("original_input_tokens", 0)
                compressed = result.get("output_tokens", 0)
                
                if original > 0:
                    savings = ((original - compressed) / original) * 100
                    print(f"🗜️ Compressed: {original} → {compressed} tokens ({savings:.1f}% saved)")
                
                return result.get("output", text)
            else:
                print(f"⚠️ Compression failed: {response.status_code}")
                return text
                
    except Exception as e:
        print(f"⚠️ Compression error: {e}")
        return text