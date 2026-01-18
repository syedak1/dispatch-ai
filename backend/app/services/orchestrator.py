import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv(dotenv_path="../../../.env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize Gemini client
client = None
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    print("⚠️ Gemini API key not set!")


ORCHESTRATOR_PROMPT = """You are an emergency incident classifier for a 911 dispatch system.

You receive text descriptions from a live video feed. Your job is to:
1. Determine if this is an emergency
2. Classify the incident type
3. Assess severity and urgency
4. Decide which response teams to activate

INCIDENT TYPES:
- FIRE: Smoke, flames, burning, fire hazards
- EMS: Medical emergencies, injuries, unconscious persons, health crises
- POLICE: Crime, violence, suspicious activity, traffic accidents needing police
- MULTI: Requires multiple response types (e.g., car crash with injuries and fire)
- NONE: No emergency detected, normal activity

SEVERITY LEVELS:
- LOW: Minor incident, no immediate danger
- MEDIUM: Moderate concern, should be addressed soon
- HIGH: Serious incident, prompt response needed
- CRITICAL: Life-threatening, immediate response required

URGENCY LEVELS:
- ROUTINE: Can wait, schedule as available
- SOON: Should respond within minutes
- IMMEDIATE: Drop everything, respond now

RULES:
- Use ONLY facts from the input text
- If uncertain, mark confidence lower and escalate severity
- Do NOT invent or assume details not in the text
- When in doubt, it's better to over-respond than under-respond

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "incident_type": "FIRE|POLICE|EMS|MULTI|NONE",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "urgency": "ROUTINE|SOON|IMMEDIATE",
  "confidence": 0.0-1.0,
  "reasoning": "Brief 1-2 sentence explanation",
  "activate_agents": ["FIRE", "EMS", "POLICE"]
}

If incident_type is NONE, activate_agents should be empty []."""


async def classify_incident(compressed_text: str) -> dict:
    """
    Use Gemini to classify the incident and decide which agents to activate.
    """
    if not client:
        print("⚠️ Gemini client not initialized")
        return {
            "incident_type": "UNKNOWN",
            "severity": "MEDIUM",
            "urgency": "SOON",
            "confidence": 0.3,
            "reasoning": "Classification unavailable - API not configured",
            "activate_agents": ["EMS"]
        }
    
    full_prompt = f"{ORCHESTRATOR_PROMPT}\n\n--- VIDEO DESCRIPTION ---\n{compressed_text}\n--- END DESCRIPTION ---"
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=full_prompt
        )
        
        result_text = response.text.strip()
        
        # Clean up markdown formatting if present
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0]
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0]
        
        result_text = result_text.strip()
        
        return json.loads(result_text)
        
    except json.JSONDecodeError as e:
        print(f"⚠️ JSON parse error: {e}")
        print(f"   Raw response: {result_text[:200]}...")
        return {
            "incident_type": "UNKNOWN",
            "severity": "MEDIUM",
            "urgency": "SOON",
            "confidence": 0.3,
            "reasoning": "Failed to parse AI response",
            "activate_agents": ["EMS"]
        }
    except Exception as e:
        print(f"⚠️ Orchestrator error: {e}")
        return {
            "incident_type": "UNKNOWN",
            "severity": "MEDIUM",
            "urgency": "SOON",
            "confidence": 0.3,
            "reasoning": f"Classification error: {str(e)}",
            "activate_agents": ["EMS"]
        }