import requests
from typing import Dict, Any
from rapidfuzz import fuzz
from openai import OpenAI

client = OpenAI()
MODEL = "gpt-4o-mini"

SRI_URL = (
    "https://srienlinea.sri.gob.ec/"
    "sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/"
    "obtenerPorNumerosRuc?&ruc={ruc}"
)

SYSTEM = (
    "Eres un verificador de RUC. Dados los datos del SRI, decide si la actividad económica principal es coherente "
    "con la razón social y si está relacionada con el objeto del contrato. Responde JSON con related (bool) y why."
)

PROMPT = (
    "Datos SRI:\nActividad: {actividad}\nRazon Social: {razon}\nObjeto del contrato: {objeto}\n\n"
    "¿La actividad es coherente con la razón social y relevante para el objeto? Responde JSON: {{\"related\": true|false, \"why\": \"...\"}}"
)


def call_sri(ruc: str):
    url = SRI_URL.format(ruc=ruc)
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    data = r.json()
    if isinstance(data, list) and data:
        return data[0]
    return None


def assess_related(actividad: str, razon: str, objeto: str) -> Dict[str, Any]:
    # Filtro rápido por similitud (suave) + LLM como juez final
    sim = fuzz.token_set_ratio((actividad or "").lower(), (razon or "").lower())
    # Pregunta al modelo para una evaluación semántica + explicación
    content = PROMPT.format(actividad=actividad or "", razon=razon or "", objeto=objeto or "")
    resp = client.chat.completions.create(
        model=MODEL,
        temperature=0,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": content},
        ]
    )
    import json
    try:
        verdict = json.loads(resp.choices[0].message.content)
    except Exception:
        verdict = {"related": sim >= 40, "why": f"Heurística por similitud={sim}"}
    return verdict


def run(ruc: str, objeto_contrato: str) -> Dict[str, Any]:
    out = {"ruc": ruc, "exists": False, "related": False, "risk": "ALTO", "rationale": ""}
    try:
        data = call_sri(ruc)
        if not data:
            out["rationale"] = "RUC no existe o sin datos"
            return out
        out["exists"] = True
        actividad = (data.get("actividadEconomicaPrincipal") or "").strip()
        razon = (data.get("razonSocial") or "").strip()

        verdict = assess_related(actividad, razon, objeto_contrato)
        out["related"] = bool(verdict.get("related", False))
        out["rationale"] = verdict.get("why", "")

        if not out["related"]:
            out["risk"] = "ALTO"
        else:
            # Si existe y está relacionado, baja el riesgo; puedes afinar por estadoContribuyenteRuc o banderas
            out["risk"] = "BAJO"
        return out
    except Exception as e:
        out["rationale"] = f"Error en validación SRI: {e}"
        out["risk"] = "ALTO"
        return out