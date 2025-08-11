import os, glob, io, json, sys
from dotenv import load_dotenv

from utils.pdf_text import pdf_to_text
from utils.ruc_extract import extract_rucs
from agents import rag_legal, validator_legal, validator_tech, validator_econ, validator_incons, validator_ruc, aggregator

load_dotenv()

DOCS_DIR = os.environ.get("DOCS_DIR", "./data/docs")

HELP = """
Uso:
  python analyze_contracts.py "analiza los contratos" "Objeto del contrato..."

Si el primer argumento es exactamente 'analiza los contratos', el script procesará TODOS los PDFs en /data/docs.
El segundo argumento (opcional) es el 'objeto del contrato'.
"""


def analyze_all(objeto: str = ""):
    pdfs = glob.glob(os.path.join(DOCS_DIR, "**/*.pdf"), recursive=True)
    if not pdfs:
        print(f"No hay PDFs en {DOCS_DIR}")
        return 1

    results = []
    topics = ["garantias", "multas", "plazos", "tecnicos", "economicos", "coherencia"]

    for path in pdfs:
        print(f"Analizando: {os.path.basename(path)}")
        try:
            text = pdf_to_text(path)
        except Exception as e:
            print(f"✖ No se pudo leer {path}: {e}")
            continue

        topic_ctx = rag_legal.run_topics(topics, proposal_excerpt=text[:4000], k=6)
        v_legal = validator_legal.run(text, topic_ctx.get("garantias", []) + topic_ctx.get("multas", []) + topic_ctx.get("plazos", []))
        v_tech  = validator_tech.run(text, topic_ctx.get("tecnicos", []))
        v_econ  = validator_econ.run(text, topic_ctx.get("economicos", []))
        v_incon = validator_incons.run(text, topic_ctx.get("coherencia", []))

        rucs = extract_rucs(text)
        ruc_reports = [validator_ruc.run(r, objeto) for r in rucs]

        report = aggregator.aggregate(v_legal, v_tech, v_econ, v_incon, ruc_reports)
        results.append({"file": os.path.basename(path), "path": path, "object": objeto, "report": report})

    out_path = os.environ.get("OUT_JSON", "./reporte_contratos.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"results": results}, f, ensure_ascii=False, indent=2)
    print(f" Reporte consolidado: {out_path}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(HELP)
        sys.exit(1)

    cmd = sys.argv[1].strip().lower()
    objeto = sys.argv[2] if len(sys.argv) > 2 else ""

    if cmd == "analiza los contratos":
        rc = analyze_all(objeto)
        sys.exit(rc)
    else:
        print(HELP)
        sys.exit(1)