from typing import Dict, Any, List
from rag.retrieve import retrieve_context

TOPICS = {
    "garantias": "garantías",
    "multas": "multas",
    "plazos": "plazos",
    "tecnicos": "requisitos técnicos, materiales, procesos y tiempos",
    "economicos": "condiciones económicas, presupuestos y formas de pago",
    "coherencia": "validación de que contrato/propuesta refleja pliegos",
}


def run(question: str, extra_context: str = "", k: int = 6) -> Dict[str, Any]:
    q = (question or "").strip()
    if extra_context:
        q += f"\n\nCONSIDERA ESTE CONTEXTO DE LA PROPUESTA:\n{extra_context[:1500]}"
    ctx = retrieve_context(q, k=k)
    return {"context": ctx}


def run_topics(topics: List[str], proposal_excerpt: str = "", k: int = 6) -> Dict[str, Any]:
    out = {}
    for t in topics:
        label = TOPICS.get(t, t)
        res = run(f"Extrae reglas y requisitos sobre: {label}. Cita textualmente si es posible.", proposal_excerpt, k=k)
        out[t] = res["context"]
    return out