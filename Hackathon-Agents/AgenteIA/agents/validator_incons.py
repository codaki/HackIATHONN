from typing import Dict, Any, List
from openai import OpenAI

client = OpenAI()
MODEL = "gpt-4o-mini"

SYSTEM = (
    "Eres un auditor de coherencia contractual. Con el contexto RAG y la propuesta/contrato, "
    "detecta ambigüedades, contradicciones o cláusulas faltantes; valida que contrato/propuesta refleje pliegos. JSON issues+score."
    "Devuelve JSON con issues (type, where, evidence, severity, recommendation) y score 0-100."
)

PROMPT = (
    "Contexto (RAG):\n{ctx}\n\nDocumento: \n{proposal}\n\n"
    "Tarea: detectar INCONSISTENCIAS (ambigüedades, contradicciones, faltantes) y validar COHERENCIA con los pliegos. "
    "Entregar issues detallados y score 0-100."
)


def run(proposal_text: str, ctx_items: List[Dict]) -> Dict[str, Any]:
    ctx = "\n---\n".join([f"Fuente: {c.get('source')}\n{c.get('text')[:1200]}" for c in ctx_items])
    content = PROMPT.format(ctx=ctx, proposal=proposal_text[:6000])
    resp = client.chat.completions.create(
        model=MODEL,
        temperature=0.2,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": content},
        ]
    )
    text = resp.choices[0].message.content
    import json
    try:
        data = json.loads(text)
    except Exception:
        data = {"issues": [{"type": "parse_error", "where": "validator_incons", "evidence": text[:1000], "severity": "MEDIO", "recommendation": "Revisar"}], "score": 50}
    return data