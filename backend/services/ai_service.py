from groq import Groq
import os
from dotenv import load_dotenv
import json

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def _mastered_context(mastered_names: list[str]) -> str:
    if not mastered_names:
        return "The learner has not mastered any concepts yet — they are just starting out."
    return f"The learner has already mastered: {', '.join(mastered_names)}."

def explain_concept(concept_name: str, concept_description: str, mastered_names: list[str]) -> str:
    prompt = f"""You are a CS tutor helping a student learn Data Structures and Algorithms.

{_mastered_context(mastered_names)}

Now explain the concept: "{concept_name}"
Context about this concept: {concept_description}

Give a clear, concise explanation (3-5 sentences) tailored to what they already know.
Use simple analogies where helpful. Do not repeat what they already know — build on it.
Do not use markdown formatting."""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

def suggest_next(mastered_names: list[str], unlocked_names: list[str], frontier_names: list[str]) -> str:
    prompt = f"""You are a CS tutor helping a student learn Data Structures and Algorithms.

{_mastered_context(mastered_names)}
Concepts they can start right now: {', '.join(unlocked_names) if unlocked_names else 'none yet'}.
Concepts almost unlocked (one prerequisite away): {', '.join(frontier_names) if frontier_names else 'none'}.

Give a short, motivating recommendation (3-4 sentences) on what they should learn next and why.
Be specific — name the concept and explain why it makes sense given their current progress.
Do not use markdown formatting."""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=250,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

def generate_quiz(concept_name: str, mastered_names: list[str], previous_questions: list[str] = []) -> dict:
    prev_context = ""
    if previous_questions:
        prev_context = f"\nDo NOT repeat these questions:\n" + "\n".join(f"- {q}" for q in previous_questions)

    prompt = f"""You are a CS tutor creating a quiz question.

{_mastered_context(mastered_names)}
Generate ONE multiple choice question to test understanding of: "{concept_name}"
{prev_context}

Respond in this EXACT format only, no extra text:
QUESTION: <question text>
A: <option A>
B: <option B>
C: <option C>
D: <option D>
ANSWER: <just the letter, A B C or D>
EXPLANATION: <one sentence explaining why>"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=300,
        temperature=0.9,
        messages=[{"role": "user", "content": prompt}]
    )

    text = response.choices[0].message.content
    lines = {l.split(":")[0].strip(): ":".join(l.split(":")[1:]).strip()
             for l in text.strip().split("\n") if ":" in l}

    return {
        "question":    lines.get("QUESTION", ""),
        "options":     {"A": lines.get("A",""), "B": lines.get("B",""), "C": lines.get("C",""), "D": lines.get("D","")},
        "answer":      lines.get("ANSWER", "").strip(),
        "explanation": lines.get("EXPLANATION", ""),
    }

def answer_question(concept_name: str, explanation: str, question: str, mastered_names: list[str], history: list[dict]) -> str:
    messages = [
        {
            "role": "system",
            "content": f"""You are a CS tutor helping a student learn Data Structures and Algorithms.
{_mastered_context(mastered_names)}
You just explained: "{concept_name}".
Your explanation was: {explanation}
Answer follow-up questions clearly and concisely. Do not use markdown formatting."""
        }
    ]
    for h in history:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": question})

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=300,
        temperature=0.7,
        messages=messages
    )
    return response.choices[0].message.content

def generate_roadmap(topic: str) -> dict:
    prompt = f"""You are a curriculum designer creating a learning roadmap for: "{topic}"

Generate a structured learning graph with 12-18 concepts.

Respond with ONLY valid JSON in this exact structure, nothing else:
{{
  "topic": "{topic}",
  "description": "A comprehensive learning roadmap for {topic}",
  "concepts": [
    {{
      "id": 1,
      "name": "Concept Name",
      "description": "2-3 sentence description of this concept.",
      "difficulty": 1
    }}
  ],
  "dependencies": [
    {{"from": 1, "to": 2}},
    {{"from": 1, "to": 3}}
  ]
}}

Rules:
- difficulty is 1 (beginner) to 5 (advanced)
- dependencies go from prerequisite TO dependent concept
- use the integer ids you defined in concepts array
- NO circular dependencies — this must be a valid DAG
- start with 2-3 foundational concepts that have no prerequisites
- build logically so each concept genuinely needs its prerequisites"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=2000,
        temperature=0.3,
        messages=[{"role": "user", "content": prompt}]
    )

    text = response.choices[0].message.content.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    return json.loads(text)