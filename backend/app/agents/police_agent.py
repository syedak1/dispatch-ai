import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv(dotenv_path="../../../.env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


POLICE_PROMPT = """You are a Police specialist assistant for 911 dispatch.

You receive a description of an incident from a live video feed.
Your job: Prepare a brief, actionable report for police responders.

Include ONLY these sections:
1. key_facts: Observable facts (number of people, descriptions, vehicles, weapons visible, behaviors)
2. hazards: Safety concerns for officers (weapons, aggression, crowd size, escape routes)
3. equipment: Suggested equipment (standard patrol, tactical, K9, traffic control)
4. unknowns: Critical info missing that officers should verify on arrival

IMPORTANT RULES:
- Use ONLY information from the input description
- Do NOT assume criminal intent without clear evidence
- Describe behaviors objectively, not interpretatively
- Mark anything uncertain as "unconfirmed" or "possible"
- Keep each list to 3-5 items maximum
- Be factual and unbiased

Respond with ONLY valid JSON:
{
  "key_facts": ["fact 1", "fact 2", "fact 3"],
  "hazards": ["hazard 1", "hazard 2"],
  "equipment": ["item 1", "item 2"],
  "unknowns": ["unknown 1", "unknown 2"]
}"""


async def run_police_agent(context: str) -> dict:
    """Run the police specialist agent."""
    if not client:
        return {
            "key_facts": ["Police agent unavailable - API not configured"],
            "hazards": ["Unknown - assess on arrival"],
            "equipment": ["Standard patrol response"],
            "unknowns": ["Full scene assessment needed"]
        }
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=f"{POLICE_PROMPT}\n\n--- INCIDENT DESCRIPTION ---\n{context}\n--- END ---"
        )
        
        result_text = response.text.strip()
        
        # Clean markdown
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0]
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0]
        
        return json.loads(result_text.strip())
        
    except Exception as e:
        print(f"⚠️ Police agent error: {e}")
        return {
            "key_facts": ["Unable to analyze - see raw description"],
            "hazards": ["Unknown - assess on arrival"],
            "equipment": ["Standard patrol response"],
            "unknowns": ["Full scene assessment needed"]
        }