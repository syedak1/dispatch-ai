import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv(dotenv_path="../../../.env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

client = None
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)

EMS_AGENT_PROMPT = """You are an EMS (Emergency Medical Services) dispatch assistant.

Given a description of an incident, extract ONLY information relevant to medical response.

RULES:
- Use ONLY facts stated in the input
- Mark anything uncertain with "Unknown: ..."
- Do NOT invent or assume details
- Do NOT diagnose - only describe what is observed
- Be concise and actionable

Extract:
1. KEY FACTS: What is observed about patients (conscious/unconscious, visible injuries, number of patients, etc.)
2. HAZARDS: Scene dangers for medics (traffic, fire, violence, etc.)
3. EQUIPMENT: Recommended medical resources (ALS/BLS, stretcher, trauma kit, etc.)
4. UNKNOWNS: Missing information that would help (patient age, mechanism of injury, etc.)

Respond with ONLY valid JSON:
{
  "key_facts": ["fact 1", "fact 2"],
  "hazards": ["hazard 1", "hazard 2"],
  "equipment": ["equipment 1", "equipment 2"],
  "unknowns": ["unknown 1", "unknown 2"]
}

Keep each list to 3-5 items maximum. Be specific, not generic."""


async def run_ems_agent(compressed_text: str) -> dict:
    """
    Run EMS agent to extract medical-relevant information.
    """
    if not client:
        return {
            "key_facts": ["EMS agent unavailable - API not configured"],
            "hazards": [],
            "equipment": [],
            "unknowns": ["All details unknown"]
        }
    
    full_prompt = f"{EMS_AGENT_PROMPT}\n\n--- INCIDENT DESCRIPTION ---\n{compressed_text}\n--- END ---"
    
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
        print(f" EMS agent JSON error: {e}")
        return {
            "key_facts": ["Failed to parse response"],
            "hazards": [],
            "equipment": [],
            "unknowns": ["Response parsing failed"]
        }
    except Exception as e:
        print(f" EMS agent error: {e}")
        return {
            "key_facts": [f"Error: {str(e)}"],
            "hazards": [],
            "equipment": [],
            "unknowns": []
        }
