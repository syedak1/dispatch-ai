import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(dotenv_path="../../../.env")

# Phoenix configuration
PHOENIX_API_KEY = os.getenv("PHOENIX_API_KEY")
PHOENIX_ENDPOINT = os.getenv("PHOENIX_COLLECTOR_ENDPOINT")

phoenix_enabled = False


def init_phoenix():
    """Initialize Phoenix tracing."""
    global phoenix_enabled
    
    if not PHOENIX_API_KEY or not PHOENIX_ENDPOINT:
        print("⚠️ Phoenix not configured (missing API key or endpoint)")
        print("   Tracing will be logged locally only")
        return
    
    try:
        # Set environment variables for Phoenix
        os.environ["PHOENIX_API_KEY"] = PHOENIX_API_KEY
        os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = PHOENIX_ENDPOINT
        
        # Try to import and initialize
        import phoenix as px
        
        phoenix_enabled = True
        print(f"✅ Phoenix tracing enabled: {PHOENIX_ENDPOINT}")
        
    except ImportError:
        print("⚠️ Phoenix library not fully installed")
        print("   Run: pip install arize-phoenix")
    except Exception as e:
        print(f"⚠️ Phoenix initialization failed: {e}")


def log_trace(event_name: str, data: dict):
    """
    Log a trace event.
    
    In production, this would send to Phoenix.
    For hackathon, we'll also print locally.
    """
    timestamp = datetime.now().isoformat()
    
    # Always log locally
    print(f"📊 [TRACE:{event_name}] {timestamp}")
    for key, value in data.items():
        if isinstance(value, str) and len(value) > 100:
            print(f"   {key}: {value[:100]}...")
        else:
            print(f"   {key}: {value}")
    
    if phoenix_enabled:
        try:
            # In a full implementation, you'd use OpenTelemetry spans here
            # For hackathon simplicity, we're just logging
            pass
        except Exception as e:
            print(f"⚠️ Phoenix log error: {e}")