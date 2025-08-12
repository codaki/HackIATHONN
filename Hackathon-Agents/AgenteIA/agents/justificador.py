from typing import List, Dict, Any, Optional
import os
from openai import OpenAI

MODEL_JUST = os.environ.get("MODEL_JUST", "gpt-4o-mini")


def _fallback_text(rows: List[Dict[str, Any]], winner: Optional[Dict[str, Any]]) -> str:
    if not winner:
        return (
            "No fue posible determinar un contrato ganador con la información disponible. "
            "Revise la consistencia de los documentos y vuelva a ejecutar el análisis."
        )
    return (
        f"Se recomienda el contrato '{winner.get('oferente')}' por presentar el mejor equilibrio entre cumplimiento legal, "
        f"solidez técnica y propuesta económica (puntaje total {winner.get('total')}). "
        f"Frente a las alternativas, registra menos riesgos críticos (rojas: {winner.get('rojas')}, amarillas: {winner.get('amarillas')}) y mejor coherencia con los pliegos.\n\n"
        "En el aspecto legal, cubre garantías, multas y plazos con mayor claridad; en lo técnico, especifica materiales, procesos y tiempos con suficiencia; y en lo económico, la estructura de costos y pagos es competitiva y viable.\n\n"
        "Recomendaciones: precisar cláusulas susceptibles de ambigüedad, reforzar hitos de control y evidencias técnicas, y asegurar que las formas de pago y cronogramas de avance queden explícitamente detallados."
    )


def generate_justification(
    rows: List[Dict[str, Any]],
    winner: Optional[Dict[str, Any]],
    objeto: str = "",
    pesos: Optional[Dict[str, Any]] = None,
    num_docs: Optional[int] = None,
) -> str:
    """Genera una justificación breve (3–4 párrafos) del contrato recomendado.

    rows: lista de dicts con: oferente, scores{legal,tecnico,economico}, total, rojas, amarillas, issues[]
    winner: dict de row ganador
    objeto: objeto del proceso
    pesos: pesos utilizados
    """
    try:
        client = OpenAI()
        insumos: List[Dict[str, Any]] = []
        for f in rows:
            insumos.append({
                "oferente": f.get("oferente"),
                "legal": f.get("scores", {}).get("legal", 0),
                "tecnico": f.get("scores", {}).get("tecnico", 0),
                "economico": f.get("scores", {}).get("economico", 0),
                "total": f.get("total", 0),
                "rojas": f.get("rojas", 0),
                "amarillas": f.get("amarillas", 0),
                "top_riesgos": [
                    {
                        "categoria": i.get("category", ""),
                        "severidad": i.get("severity", ""),
                        "desc": i.get("recommendation") or i.get("evidence") or i.get("type"),
                    }
                    for i in (f.get("issues") or [])[:5]
                ],
            })

        modo = "evaluacion_unica" if (num_docs or len(rows)) <= 1 else "comparativo"
        if modo == "evaluacion_unica":
            prompt = (
                "Redacta en español un resumen evaluativo breve (máx. 3–4 párrafos) y claro para no técnicos, "
                "sobre el contrato analizado, explicando su nivel de cumplimiento legal, técnico y económico. "
                "Usa los hallazgos (garantías, multas, plazos, materiales, procesos, tiempos, presupuestos, formas de pago), "
                "y señala vacíos, inconsistencias o cláusulas ambiguas/faltantes, así como coherencia con los pliegos.\n\n"
                f"Objeto del proceso: {objeto or 'N/D'}.\n"
                f"Datos: {insumos}.\n\n"
                "Cierra con recomendaciones concretas para fortalecer el contrato. Evita opiniones sin sustento."
            )
        else:
            prompt = (
                "Redacta en español una justificación breve (máx. 3–4 párrafos) y clara para no técnicos, "
                "sobre cuál contrato es la mejor opción y por qué, comparando dimensiones legales, técnicas y económicas. "
                "Usa los hallazgos: garantías, multas, plazos, materiales, procesos, tiempos, presupuestos y formas de pago; "
                "considera vacíos/inconsistencias, cláusulas ambiguas/faltantes, coherencia con pliegos y riesgos.\n\n"
                f"Objeto del proceso: {objeto or 'N/D'}.\n"
                f"Pesos aplicados: {pesos or {}}.\n"
                f"Datos: {insumos}.\n"
                f"Ganador propuesto: {(winner or {}).get('oferente', 'N/D')} con total {(winner or {}).get('total', 'N/D')}.\n\n"
                "Finaliza con un breve párrafo de recomendaciones para fortalecer el contrato ganador si aplica. Evita opiniones sin sustento."
            )

        resp = client.chat.completions.create(
            model=MODEL_JUST,
            messages=[
                {"role": "system", "content": (
                    "Eres un asistente experto en análisis de licitaciones. "
                    "Redactas en español, en 3–4 párrafos máximo, claro y educativo para no técnicos. "
                    "Explica QUÉ hallazgos hay (legales, técnicos, económicos), POR QUÉ importan, cita evidencia cuando sea posible y cierra con recomendaciones prácticas."
                )},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        return _fallback_text(rows, winner)


