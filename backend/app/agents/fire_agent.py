import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv(dotenv_path="../../../.env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

client = None
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)

FIRE_AGENT_PROMPT = """You are a Fire Department dispatch assistant.

Given a description of an incident, extract ONLY information relevant to fire response.

RULES:
- Use ONLY facts stated in the input
- Mark anything uncertain with "Unknown: ..."
- Do NOT invent or assume details
- Be concise and actionable

Extract:
1. KEY FACTS: What is actually observed (fire location, size, color of smoke, etc.)
2. HAZARDS: Potential dangers for responders (chemicals, structural damage, trapped persons, etc.)
3. EQUIPMENT: Recommended equipment based on facts (ladder truck, hazmat, etc.)
4. UNKNOWNS: What information is missing but would be useful

Respond with ONLY valid JSON:
{
  "key_facts": ["fact 1", "fact 2"],
  "hazards": ["hazard 1", "hazard 2"],
  "equipment": ["equipment 1", "equipment 2"],
  "unknowns": ["unknown 1", "unknown 2"]
}

Keep each list to 3-5 items maximum. Be specific, not generic."""


async def run_fire_agent(compressed_text: str) -> dict:
    """
    Run fire department agent to extract fire-relevant information.
    """
    if not client:
        return {
            "key_facts": ["Fire agent unavailable - API not configured"],
            "hazards": [],
            "equipment": [],
            "unknowns": ["All details unknown"]
        }
    
    full_prompt = f"{FIRE_AGENT_PROMPT}\n\n--- INCIDENT DESCRIPTION ---\n{compressed_text}\n--- END ---"
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=full_prompt
        )
        
        result_text = response.text.strip()
        
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0]
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0]
        
        return json.loads(result_text.strip())
        
    except json.JSONDecodeError as e:
        print(f" Fire agent JSON error: {e}")
        return {
            "key_facts": ["Failed to parse response"],
            "hazards": [],
            "equipment": [],
            "unknowns": ["Response parsing failed"]
        }
    except Exception as e:
        print(f" Fire agent error: {e}")
        return {
            "key_facts": [f"Error: {str(e)}"],
            "hazards": [],
            "equipment": [],
            "unknowns": []
        }
