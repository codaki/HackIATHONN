from typing import Dict, Any, List


def _score_to_risk(score: int) -> str:
    if score >= 85:
        return "BAJO"
    if score >= 60:
        return "MEDIO"
    return "ALTO"


def aggregate(
    legal: Dict[str, Any], tech: Dict[str, Any], econ: Dict[str, Any], incons: Dict[str, Any], ruc_reports: List[Dict[str, Any]]
) -> Dict[str, Any]:
    # Scores globales
    score_legal = int(legal.get("score", 50))
    score_tech = int(tech.get("score", 50))
    score_econ = int(econ.get("score", 50))
    score_incons = int(incons.get("score", 50))

    # Riesgo por categoría
    risks = {
        "legal": _score_to_risk(score_legal),
        "tecnico": _score_to_risk(score_tech),
        "economico": _score_to_risk(score_econ),
        "inconsistencias": _score_to_risk(score_incons),
        "ruc": max([r.get("risk", "ALTO") for r in ruc_reports] or ["ALTO"])  # peor caso
    }

    # Issues
    issues = []
    for name, pack in [
        ("legal", legal), ("tecnico", tech), ("economico", econ), ("inconsistencias", incons)
    ]:
        for it in pack.get("issues", []) or []:
            it["category"] = name
            issues.append(it)

    return {
        "scores": {
            "legal": score_legal,
            "tecnico": score_tech,
            "economico": score_econ,
            "inconsistencias": score_incons,
        },
        "risks": risks,
        "issues": issues,
        "ruc_reports": ruc_reports,
    }