import requests
from typing import Dict, Any
from rapidfuzz import fuzz
import re
import unicodedata

SRI_URL = (
    "https://srienlinea.sri.gob.ec/"
    "sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/"
    "obtenerPorNumerosRuc?&ruc={ruc}"
)

def call_sri(ruc: str):
    url = SRI_URL.format(ruc=ruc)
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    data = r.json()
    if isinstance(data, list) and data:
        return data[0]
    return None


def _normalize(text: str) -> str:
    t = text or ""
    t = t.lower()
    t = ''.join(c for c in unicodedata.normalize('NFD', t) if unicodedata.category(c) != 'Mn')
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _token_overlap(haystack: str, needles: str) -> bool:
    hs = haystack.split()
    ns = [w for w in needles.split() if len(w) >= 4]
    return any(w in hs for w in ns)


def assess_related(actividad: str, razon: str, objeto: str) -> Dict[str, Any]:
    """Regla determinística robusta para texto asimétrico.
    Criterios de aceptación (cualquiera de los siguientes para cada relación):
    - actividad vs razón social: token_set_ratio >= 22 o partial_ratio >= 40 o solapamiento de tokens
    - actividad vs objeto: token_set_ratio >= 30 o partial_ratio >= 55 o solapamiento de tokens
    """
    a = _normalize(actividad)
    rz = _normalize(razon)
    obj = _normalize(objeto)

    sim_ar_set = fuzz.token_set_ratio(a, rz)
    sim_ar_part = fuzz.partial_ratio(a, rz)
    sim_ao_set = fuzz.token_set_ratio(a, obj)
    sim_ao_part = fuzz.partial_ratio(a, obj)

    overlap_ar = _token_overlap(a, rz)
    overlap_ao = _token_overlap(a, obj)

    ok_ar = sim_ar_set >= 22 or sim_ar_part >= 40 or overlap_ar
    ok_ao = sim_ao_set >= 30 or sim_ao_part >= 55 or overlap_ao

    related = bool(ok_ar and ok_ao)
    why = (
        f"act-raz(set={sim_ar_set:.1f}, part={sim_ar_part:.1f}, overlap={overlap_ar}); "
        f"act-obj(set={sim_ao_set:.1f}, part={sim_ao_part:.1f}, overlap={overlap_ao}). "
        + ("Coherente con razón social y proyecto." if related else "Incoherencia con razón social y/o proyecto.")
    )
    return {"related": related, "why": why}


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