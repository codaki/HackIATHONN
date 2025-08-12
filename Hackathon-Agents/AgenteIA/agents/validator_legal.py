from typing import Dict, Any, List
from openai import OpenAI

client = OpenAI()
MODEL = "gpt-4o-mini"

SYSTEM = (
    "Eres un analista legal especializado en licitaciones y contratos públicos. "
    "Tu enfoque principal es analizar condiciones legales incluyendo: "
    "- Garantías y seguros contractuales "
    "- Multas, sanciones y penalidades "
    "- Cláusulas y obligaciones contractuales "
    "- Requisitos de cumplimiento normativo "
    "- Plazos legales y fechas límite "
    "- Distribución de responsabilidades y riesgos "
    "- Mecanismos de resolución de disputas "
    "- Requisitos de cumplimiento regulatorio "
    "\nCon el contexto RAG y el texto de la propuesta, verifica estos aspectos legales. "
    "Devuelve JSON con issues (type, where, evidence, severity, recommendation) y score 0-100."
)

PROMPT = (
    "Contexto (RAG):\n{ctx}\n\nPropuesta:\n{proposal}\n\n"
    "Tarea: Realiza un análisis legal exhaustivo de la propuesta, enfocándote en: "
    "1. GARANTÍAS: Verifica tipos, montos, vigencias y condiciones de ejecución. "
    "2. MULTAS: Analiza aplicabilidad, cálculos, topes máximos y proporcionalidad. "
    "3. PLAZOS: Evalúa plazos de ejecución, entrega, garantías y pagos. "
    "4. OBLIGACIONES: Identifica obligaciones específicas y su claridad. "
    "5. RIESGOS: Evalúa la distribución de responsabilidades. "
    "\nPara cada problema encontrado, detalla: "
    "- Tipo exacto de issue legal "
    "- Dónde se encuentra "
    "- Evidencia textual "
    "- Severidad (ALTO/MEDIO/BAJO) "
    "- Recomendación específica para solución "
    "\nPuntúa de 0-100 la conformidad legal general de la propuesta."
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
    # Intento de parseo seguro
    import json
    try:
        data = json.loads(text)
    except Exception:
        data = {"issues": [{"type": "parse_error", "where": "validator_legal", "evidence": text[:1000], "severity": "MEDIO", "recommendation": "Revisar"}], "score": 50}
    return data