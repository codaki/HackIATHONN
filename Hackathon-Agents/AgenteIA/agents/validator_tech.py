from typing import Dict, Any, List
from openai import OpenAI

client = OpenAI()
MODEL = "gpt-4o-mini"

SYSTEM = (
    "Eres un analista técnico de licitaciones. Con el contexto RAG y la propuesta, "
    "verifica requisitos técnicos: materiales, procesos y tiempos. JSON issues+score."
)

PROMPT = (
    "Contexto (RAG):\n{ctx}\n\nPropuesta:\n{proposal}\n\n"
    "Tarea: verifica REQUISITOS TÉCNICOS (materiales, procesos, tiempos). "
    "Reporta faltantes/ambigüedades y puntúa conformidad técnica (0-100)."
)


def run(proposal_text: str, ctx_items: List[Dict]) -> Dict[str, Any]:
    ctx = "\n---\n".join([f"Fuente: {c.get('source')}\n{c.get('text')[:1200]}" for c in ctx_items])
    content = PROMPT.format(ctx=ctx, proposal=proposal_text[:6000])
    resp = client.chat.completions.create(
        model=MODEL,
        temperature=0.2,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM + " Devuelve únicamente JSON válido."},
            {"role": "user", "content": content + "\n\nSalida estricta JSON con campos: issues (array) y score (0-100)."},
        ]
    )
    text = resp.choices[0].message.content
    import json
    try:
        data = json.loads(text)
    except Exception:
        data = {"issues": [{"type": "parse_error", "where": "validator_tech", "evidence": text[:1000], "severity": "MEDIO", "recommendation": "Revisar"}], "score": 50}
    return data