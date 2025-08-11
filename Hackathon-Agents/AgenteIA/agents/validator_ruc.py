import requests
from typing import Dict, Any
from rapidfuzz import fuzz
import re
import unicodedata
from openai import OpenAI
import os

SRI_URL = (
    "https://srienlinea.sri.gob.ec/"
    "sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/"
    "obtenerPorNumerosRuc?&ruc={ruc}"
)

# Initialize OpenAI client with API key from environment variable
# Try to load from dotenv first if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Initialize the client with API key
api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    print("WARNING: OPENAI_API_KEY not found in environment variables.")
    print("AI-powered validation will not be available unless the key is provided.")
    print("Using deterministic fallback method instead.")

client = OpenAI(api_key=api_key)
MODEL = "gpt-4o-mini"

def call_sri(ruc: str, max_retries=3):
    url = SRI_URL.format(ruc=ruc)
    
    for attempt in range(max_retries):
        try:
            # Add a longer timeout and user-agent header
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            r = requests.get(url, headers=headers, timeout=30)
            r.raise_for_status()
            data = r.json()
            if isinstance(data, list) and data:
                return data[0]
            return None
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            if attempt < max_retries - 1:
                import time
                # Exponential backoff
                time.sleep(2 ** attempt)
                continue
            else:
                raise Exception(f"No se pudo conectar al servicio del SRI después de {max_retries} intentos: {e}")
        except requests.exceptions.HTTPError as e:
            raise Exception(f"Error HTTP al conectar con el SRI: {e}")
        except ValueError as e:
            raise Exception(f"Error al procesar la respuesta del SRI: {e}")

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


def assess_related_with_ai(actividad: str, razon: str, objeto: str) -> Dict[str, Any]:
    """
    Utiliza la API de OpenAI para determinar si la actividad económica principal
    es adecuada para el objeto del contrato.
    """
    try:
        prompt = f"""
        Evalúa si la actividad económica principal de una empresa es coherente y adecuada 
        para el proyecto o contrato descrito.
        
        Actividad económica principal: "{actividad}"
        Razón social de la empresa: "{razon}"
        Objeto del contrato/proyecto: "{objeto}"
        
        Responde con un JSON que contenga:
        1. "related": true/false (si la actividad es adecuada para el proyecto)
        2. "confidence": valor de 0 a 100 que indique la confianza en la evaluación
        3. "reasoning": explicación detallada de tu evaluación
        """
        
        response = client.chat.completions.create(
            model=MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "Eres un experto en análisis de contratos y validación de empresas que responde exclusivamente en formato JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )
        
        import json
        ai_response = json.loads(response.choices[0].message.content)
        
        related = ai_response.get("related", False)
        confidence = ai_response.get("confidence", 0)
        reasoning = ai_response.get("reasoning", "No se proporcionó razonamiento")
        
        return {
            "related": related,
            "confidence": confidence,
            "why": reasoning,
            "ai_powered": True
        }
    except Exception as e:
        # Si hay algún error con la API de OpenAI, usamos el método determinístico como fallback
        fallback_result = assess_related_deterministic(actividad, razon, objeto)
        fallback_result["error"] = f"Error en validación con IA: {str(e)}"
        fallback_result["ai_powered"] = False
        return fallback_result


def assess_related_deterministic(actividad: str, razon: str, objeto: str) -> Dict[str, Any]:
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
    return {"related": related, "why": why, "ai_powered": False}


# Alias para mantener compatibilidad
assess_related = assess_related_with_ai


def run(ruc: str, objeto_contrato: str) -> Dict[str, Any]:
    out = {"ruc": ruc, "exists": False, "related": False, "risk": "ALTO", "rationale": "", "ai_powered": False}
    try:
        data = call_sri(ruc)
        if not data:
            out["rationale"] = "RUC no existe o sin datos"
            return out
        
        out["exists"] = True
        out["sri_data"] = data  # Incluimos los datos completos del SRI
        
        actividad = (data.get("actividadEconomicaPrincipal") or "").strip()
        razon = (data.get("razonSocial") or "").strip()
        
        # Añadimos información adicional relevante
        out["actividad_economica"] = actividad
        out["razon_social"] = razon
        out["estado_contribuyente"] = data.get("estadoContribuyenteRuc")
        out["tipo_contribuyente"] = data.get("tipoContribuyente")
        out["obligado_contabilidad"] = data.get("obligadoLlevarContabilidad")
        
        # Evaluación principal con IA
        verdict = assess_related_with_ai(actividad, razon, objeto_contrato)
        out["related"] = bool(verdict.get("related", False))
        out["rationale"] = verdict.get("why", "")
        out["ai_powered"] = verdict.get("ai_powered", False)
        out["confidence"] = verdict.get("confidence", 0)

        # Evaluamos el riesgo
        if not out["related"]:
            out["risk"] = "ALTO"
        else:
            # Evaluación de estado del contribuyente
            estado = data.get("estadoContribuyenteRuc", "").upper()
            if estado != "ACTIVO":
                out["risk"] = "MEDIO"
                out["rationale"] += f" Estado contribuyente: {estado}."
            # Verificamos banderas de riesgo
            elif (data.get("contribuyenteFantasma") == "SI" or 
                  data.get("transaccionesInexistente") == "SI"):
                out["risk"] = "ALTO"
                out["rationale"] += " Contribuyente con alertas de riesgo."
            else:
                out["risk"] = "BAJO"
                
        return out
    except Exception as e:
        out["rationale"] = f"Error en validación SRI: {e}"
        out["risk"] = "ALTO"
        return out