import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv(dotenv_path="../../.env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


EMS_PROMPT = """You are an EMS/Paramedic specialist assistant for 911 dispatch.

You receive a description of an incident from a live video feed.
Your job: Prepare a brief, actionable report for medical responders.

Include ONLY these sections:
1. key_facts: Observable medical facts (number of patients, visible conditions, consciousness level, movement)
2. hazards: Scene dangers for medics (traffic, debris, violence, hazardous materials)
3. equipment: Suggested medical equipment based on observations
4. unknowns: Critical medical info missing that responders must assess on arrival

IMPORTANT RULES:
- Use ONLY information from the input description
- NEVER diagnose - only describe what is observed
- Do NOT assume conditions not visible in the description
- Mark anything uncertain as "unconfirmed" or "possible"
- Keep each list to 3-5 items maximum
- Use medical terminology appropriately

Respond with ONLY valid JSON:
{
  "key_facts": ["fact 1", "fact 2", "fact 3"],
  "hazards": ["hazard 1", "hazard 2"],
  "equipment": ["item 1", "item 2"],
  "unknowns": ["unknown 1", "unknown 2"]
}"""


async def run_ems_agent(context: str) -> dict:
    """Run the EMS/paramedic specialist agent."""
    if not client:
        return {
            "key_facts": ["EMS agent unavailable - API not configured"],
            "hazards": ["Unknown - assess on arrival"],
            "equipment": ["Standard medical kit"],
            "unknowns": ["Full patient assessment needed"]
        }
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=f"{EMS_PROMPT}\n\n--- INCIDENT DESCRIPTION ---\n{context}\n--- END ---"
        )
        
        result_text = response.text.strip()
        
        # Clean markdown
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0]
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0]
        
        return json.loads(result_text.strip())
        
    except Exception as e:
        print(f"⚠️ EMS agent error: {e}")
        return {
            "key_facts": ["Unable to analyze - see raw description"],
            "hazards": ["Unknown - assess on arrival"],
            "equipment": ["Standard medical kit", "AED"],
            "unknowns": ["Full patient assessment needed"]
        }