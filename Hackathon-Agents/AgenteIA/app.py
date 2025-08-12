from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import os, io, json, uuid, shutil, glob
from datetime import datetime

# === Importa tu lógica ya creada ===
from utils.pdf_text import pdf_to_text
from utils.ruc_extract import extract_rucs
from agents import rag_legal, validator_legal, validator_tech, validator_econ, validator_incons, validator_ruc, aggregator
from agents.justificador import generate_justification
from rag.chroma_setup import get_docs_collection
from openai import OpenAI

# PDF resumen ejecutivo
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.lib.utils import simpleSplit

# ============ Config básica ============
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DOCS_DIR = os.path.join(DATA_DIR, "docs")
DB_DIR = os.path.join(BASE_DIR, "db")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")

os.makedirs(DOCS_DIR, exist_ok=True)
os.makedirs(DB_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

DB_PATH = os.path.join(DB_DIR, "licitaciones.json")

client = OpenAI()
MODEL_EMB = os.environ.get("MODEL_EMB", "text-embedding-3-small")
MODEL_JUST = os.environ.get("MODEL_JUST", "gpt-4o-mini")

# ============ Helpers de persistencia (MVP) ============

def _load_db() -> Dict[str, Any]:
    if not os.path.exists(DB_PATH):
        return {"licitaciones": []}
    with open(DB_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def _save_db(db: Dict[str, Any]):
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)

def _get_licitacion(db, lic_id: str):
    for x in db.get("licitaciones", []):
        if x["id"] == lic_id:
            return x
    return None

# ============ Embeddings para Chroma (contratos) ============

def _embed_batch(texts: List[str]):
    resp = client.embeddings.create(model=MODEL_EMB, input=texts)
    return [d.embedding for d in resp.data]


def index_folder_to_contratos(folder: str, lic_id: str):
    col = get_docs_collection()  # colección "contratos"
    pdfs = glob.glob(os.path.join(folder, "**/*.pdf"), recursive=True)
    for path in pdfs:
        try:
            text = pdf_to_text(path)
            # Chunking muy simple (reusa tu utils/chunk si prefieres)
            from utils.chunk import chunk_text
            chunks = chunk_text(text)
            embs = _embed_batch(chunks)
            ids = [str(uuid.uuid4()) for _ in chunks]
            metas = [{
                "source": os.path.basename(path),
                "path": path,
                "type": "contrato",
                "licitacion_id": lic_id,
            } for _ in chunks]
            col.add(ids=ids, documents=chunks, embeddings=embs, metadatas=metas)
        except Exception as e:
            print(f"[index] Error {path}: {e}")

# ============ Orquestador para una licitación ============

def run_analysis_for_lic(lic_id: str, objeto: str) -> Dict[str, Any]:
    folder = os.path.join(DOCS_DIR, lic_id)
    pdfs = glob.glob(os.path.join(folder, "**/*.pdf"), recursive=True)
    if not pdfs:
        raise HTTPException(status_code=400, detail="No hay PDFs para esta licitación")

    # Separar pliego vs propuestas desde DB si existe metadata; fallback por nombre
    db = _load_db()
    lic = _get_licitacion(db, lic_id)
    doc_meta = {os.path.join(folder, d.get("file")): d.get("type", "propuesta") for d in (lic.get("docs", []) if lic else [])}
    pliegos = []
    propuestas = []
    for path in pdfs:
        t = doc_meta.get(path)
        if not t:
            base = os.path.basename(path).lower()
            t = "pliego" if "pliego" in base else "propuesta"
        (pliegos if t == "pliego" else propuestas).append(path)
    if not propuestas:
        propuestas = [p for p in pdfs if p not in pliegos]

    results = []
    topics = ["garantias", "multas", "plazos", "tecnicos", "economicos", "coherencia"]

    # Construir contexto base del pliego para comparar
    base_ctx = {k: [] for k in topics}
    for path in pliegos:
        try:
            text = pdf_to_text(path)
            topic_ctx = rag_legal.run_topics(topics, proposal_excerpt=text[:4000], k=6)
            for k in topics:
                base_ctx[k].extend(topic_ctx.get(k, []))
        except Exception:
            continue

    # Analizar solo propuestas, con contexto del pliego
    for path in propuestas:
        text = pdf_to_text(path)
        topic_ctx = rag_legal.run_topics(topics, proposal_excerpt=text[:4000], k=6)
        # Mezclar contexto del pliego con el de la propuesta
        for k in topics:
            topic_ctx[k] = (base_ctx.get(k, []) or []) + (topic_ctx.get(k, []) or [])
        v_legal = validator_legal.run(text, topic_ctx.get("garantias", []) + topic_ctx.get("multas", []) + topic_ctx.get("plazos", []))
        v_tech  = validator_tech.run(text, topic_ctx.get("tecnicos", []))
        v_econ  = validator_econ.run(text, topic_ctx.get("economicos", []))
        v_incon = validator_incons.run(text, topic_ctx.get("coherencia", []))

        rucs = extract_rucs(text)
        # Usar objeto si existe; en su defecto, un extracto del documento como contexto semántico
        ctx_obj = objeto or " ".join((text or "").split()[:60])
        ruc_reports = [validator_ruc.run(r, ctx_obj) for r in rucs]

        report = aggregator.aggregate(v_legal, v_tech, v_econ, v_incon, ruc_reports)
        results.append({
            "file": os.path.basename(path),
            "path": path,
            "report": report
        })

    # Resumen global para la licitación (MVP)
    total_rojas = sum(1 for r in results for i in r["report"]["issues"] if str(i.get("severity", "")).upper() in ("ALTO","ROJO"))
    total_amarillas = sum(1 for r in results for i in r["report"]["issues"] if str(i.get("severity", "")).upper() in ("MEDIO","AMARILLO"))

    summary = {"rojas": int(total_rojas), "amarillas": int(total_amarillas)}

    # Calcular filas comparativas y ganador (misma lógica de endpoint comparativo)
    try:
        db = _load_db()
        lic = _get_licitacion(db, lic_id)
        pesos = (lic or {}).get("pesos", {"legal": 35, "tecnico": 40, "economico": 25})
        wl, wt, we = float(pesos.get("legal", 35)), float(pesos.get("tecnico", 40)), float(pesos.get("economico", 25))
        denom = max(wl + wt + we, 1.0)
        wl, wt, we = wl/denom, wt/denom, we/denom
        filas = []
        for r in results:
            rep = r["report"]
            sc = rep.get("scores", {})
            total = int(wl*sc.get("legal",0) + wt*sc.get("tecnico",0) + we*sc.get("economico",0))
            rojas = sum(1 for i in rep.get("issues", []) if str(i.get("severity","" )).upper() in ("ALTO","ROJO"))
            amar = sum(1 for i in rep.get("issues", []) if str(i.get("severity","" )).upper() in ("MEDIO","AMARILLO"))
            filas.append({
                "oferente": r.get("file"),
                "scores": sc,
                "total": total,
                "rojas": rojas,
                "amarillas": amar,
                "issues": rep.get("issues", [])
            })
        ganador = max(filas, key=lambda x: x["total"]) if filas else None
    except Exception:
        filas, ganador = [], None

    # Generar justificación con IA (fallback determinístico si falla)
    def _generate_just(data_rows, win):
        try:
            resumen_insumos = []
            for f in data_rows:
                resumen_insumos.append({
                    "oferente": f["oferente"],
                    "legal": f["scores"].get("legal", 0),
                    "tecnico": f["scores"].get("tecnico", 0),
                    "economico": f["scores"].get("economico", 0),
                    "rojas": f["rojas"],
                    "amarillas": f["amarillas"],
                    "top_riesgos": [
                        {
                            "categoria": i.get("category",""),
                            "severidad": i.get("severity",""),
                            "desc": i.get("recommendation") or i.get("evidence") or i.get("type")
                        } for i in (f.get("issues") or [])[:5]
                    ]
                })

            prompt = f"""
            Eres AgenteIA. Con base en los siguientes resultados de análisis de una licitación, redacta una justificación breve (máx. 4 párrafos) en español, clara para usuarios no técnicos, pero precisa. Explica cuál contrato es la mejor opción y por qué, comparando criterios legales, técnicos y económicos. Considera garantías, multas, plazos, materiales/procesos, tiempos, presupuestos/forma de pago, vacíos/inconsistencias, cláusulas ambiguas/faltantes, coherencia con pliegos y riesgos.

            Datos (JSON): {resumen_insumos}
            Ganador propuesto: {win.get('oferente') if win else 'N/D'} con total {win.get('total') if win else 'N/D'}.

            Debes incluir al final (en un párrafo breve) recomendaciones para fortalecer el contrato ganador si aplica. Evita opiniones sin sustento y mantén el texto en 3-4 párrafos.
            """
            resp = client.chat.completions.create(
                model=MODEL_JUST,
                messages=[
                    {"role":"system","content":"Eres un asesor experto en contratación pública. Redactas claro y breves párrafos."},
                    {"role":"user","content": prompt}
                ],
                temperature=0.3,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            if win:
                return (
                    f"Se recomienda el contrato '{win.get('oferente')}' por presentar el mejor equilibrio entre cumplimiento legal, solidez técnica y propuesta económica, de acuerdo con los puntajes ponderados. "
                    f"Frente a las alternativas, registra menos riesgos críticos (rojas: {win.get('rojas')}, amarillas: {win.get('amarillas')}) y una mejor alineación con los requisitos del pliego.\n\n"
                    "En el aspecto legal, cumple con las exigencias de garantías, multas y plazos de forma más clara y consistente. En lo técnico, la definición de materiales, procesos y tiempos es más completa y compatible con los objetivos del proyecto. En lo económico, la estructura de precios y pagos es competitiva y viable.\n\n"
                    "Como mejora, se recomienda precisar cláusulas susceptibles de ambigüedad y reforzar hitos de control y evidencias técnicas para mitigar riesgos residuales."
                )
            return "No fue posible generar una justificación automática."

    just_text = generate_justification(
        filas,
        ganador,
        objeto=objeto,
        pesos=pesos if 'pesos' in locals() else None,
        num_docs=len(results)
    )

    return {"results": results, "summary": summary, "justificacion_agente": just_text}

# ============ PDF: Resumen Ejecutivo (2 páginas) ============

def _wrap_text(c: canvas.Canvas, text: str, max_width: float, font_name: str = "Helvetica", font_size: int = 10):
    c.setFont(font_name, font_size)
    return simpleSplit(text, font_name, font_size, max_width)


def build_executive_pdf(lic: Dict[str, Any], data: Dict[str, Any], out_path: str):
    c = canvas.Canvas(out_path, pagesize=A4)
    width, height = A4

    # ---------- Página 1 ----------
    c.setFont("Helvetica-Bold", 16)
    c.drawString(2*cm, height-2*cm, "Resumen Ejecutivo de Licitación")

    c.setFont("Helvetica", 11)
    y = height-3*cm
    info = [
        ("Nombre", lic.get("nombre", "")),
        ("Objeto", lic.get("objeto", "")),
        ("Deadline", lic.get("deadline", "N/D")),
        ("Fecha de reporte", datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')),
    ]
    for k, v in info:
        c.setFont("Helvetica-Bold", 11)
        c.drawString(2*cm, y, f"{k}:")
        c.setFont("Helvetica", 11)
        lines = _wrap_text(c, str(v), max_width=16*cm)
        for ln in lines:
            c.drawString(5*cm, y, ln)
            y -= 0.6*cm
        y -= 0.2*cm

    # KPIs
    rojas = data.get("summary", {}).get("rojas", 0)
    amar = data.get("summary", {}).get("amarillas", 0)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(2*cm, y, f"Alertas rojas: {rojas}   |   Alertas amarillas: {amar}")
    y -= 1*cm

    # ---------- Página 2 ----------
    c.showPage()
    c.setFont("Helvetica-Bold", 14)
    c.drawString(2*cm, height-2*cm, "Top 5 riesgos y condiciones obligatorias")

    # Collect issues
    issues = []
    for r in data.get("results", []):
        for it in r.get("report", {}).get("issues", []) or []:
            issues.append({
                "severity": str(it.get("severity", "")).upper(),
                "desc": it.get("recommendation") or it.get("evidence") or it.get("type"),
                "doc": r.get("file"),
                "where": it.get("where"),
                "category": it.get("category", "")
            })
    # Orden simple: rojas primero, luego amarillas; limitar a 5
    def sev_rank(s):
        return {"ROJO":0, "ALTO":0, "AMARILLO":1, "MEDIO":1}.get(s, 2)
    issues.sort(key=lambda x: (sev_rank(x["severity"]), x["category"]))
    issues = issues[:5]

    y = height-3*cm
    c.setFont("Helvetica", 11)
    if not issues:
        c.drawString(2*cm, y, "Sin riesgos destacados.")
    else:
        for i, it in enumerate(issues, start=1):
            desc = f"{i}. [{it['severity']}] ({it['category']}) {it['desc']} — Doc: {it['doc']} — Ref: {it.get('where','N/D')}"
            lines = _wrap_text(c, desc, max_width=17*cm)
            for ln in lines:
                c.drawString(2*cm, y, ln)
                y -= 0.6*cm
            y -= 0.4*cm

    c.save()

# ============ FastAPI ============
app = FastAPI(title="API Auditor IA Licitaciones", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True, "ts": datetime.utcnow().isoformat()}

# ---- Modelos ----
class Pesos(BaseModel):
    legal: int = 35
    tecnico: int = 40
    economico: int = 25

class NuevaLicitacion(BaseModel):
    nombre: str
    objeto: str
    presupuesto: Optional[float] = None
    pesos: Pesos = Pesos()
    normativa: List[str] = Field(default_factory=list)
    deadline: Optional[str] = None  # ISO date

class LicResumen(BaseModel):
    id: str
    nombre: str
    etapa: str
    progreso: int
    rojas: int
    amarillas: int
    deadline: Optional[str]
    responsables: List[str] = []

# ---- LICITACIONES CRUD BÁSICO ----
@app.post("/licitaciones", response_model=LicResumen)
def crear_licitacion(payload: NuevaLicitacion):
    db = _load_db()
    lic_id = str(uuid.uuid4())
    item = {
        "id": lic_id,
        "nombre": payload.nombre,
        "objeto": payload.objeto,
        "presupuesto": payload.presupuesto,
        "pesos": payload.pesos.dict(),
        "normativa": payload.normativa,
        "deadline": payload.deadline,
        "etapa": "Ingesta",
        "progreso": 0,
        "created_at": datetime.utcnow().isoformat(),
    }
    db["licitaciones"].append(item)
    _save_db(db)

    # crear carpeta de documentos de la licitación
    lic_folder = os.path.join(DOCS_DIR, lic_id)
    os.makedirs(lic_folder, exist_ok=True)

    return LicResumen(
        id=lic_id,
        nombre=item["nombre"],
        etapa=item["etapa"],
        progreso=item["progreso"],
        rojas=0,
        amarillas=0,
        deadline=item.get("deadline"),
        responsables=[],
    )

@app.get("/licitaciones", response_model=List[LicResumen])
def listar_licitaciones():
    db = _load_db()
    items = []
    for x in db.get("licitaciones", []):
        items.append(LicResumen(
            id=x["id"], nombre=x["nombre"], etapa=x.get("etapa", "Ingesta"), progreso=x.get("progreso", 0),
            rojas=0, amarillas=0, deadline=x.get("deadline"), responsables=[]
        ))
    return items

@app.get("/licitaciones/{lic_id}")
def obtener_licitacion(lic_id: str):
    db = _load_db()
    lic = _get_licitacion(db, lic_id)
    if not lic:
        raise HTTPException(status_code=404, detail="No encontrada")
    return lic

# ---- Subida de documentos (AUTO-GUARDADO + AUTO-INDEXACIÓN) ----
@app.post("/licitaciones/{lic_id}/documentos")
async def subir_documentos(
    lic_id: str,
    files: List[UploadFile] = File(...),
    auto_index: bool = True,
    tipo: Optional[str] = Form(None),
):
    db = _load_db()
    lic = _get_licitacion(db, lic_id)
    if not lic:
        raise HTTPException(status_code=404, detail="Licitación no encontrada")

    folder = os.path.join(DOCS_DIR, lic_id)
    os.makedirs(folder, exist_ok=True)

    saved = []
    lic_docs = lic.setdefault("docs", [])
    for f in files:
        if not f.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Solo PDFs por ahora")
        out_path = os.path.join(folder, f.filename)
        with open(out_path, "wb") as out:
            shutil.copyfileobj(f.file, out)
        saved.append(out_path)
        doc_type = (tipo or "propuesta").lower()
        if doc_type not in ("pliego", "propuesta"):
            doc_type = "propuesta"
        lic_docs.append({
            "file": f.filename,
            "path": out_path,
            "type": doc_type,
            "size": os.path.getsize(out_path)
        })
    _save_db(db)

    # AUTO-INDEXACIÓN inmediata a colección contratos
    if auto_index:
        index_folder_to_contratos(folder, lic_id)

    return {"ok": True, "saved": saved, "indexed": bool(auto_index)}

# ---- Listar documentos de la licitación ----
@app.get("/licitaciones/{lic_id}/documentos")
def listar_documentos(lic_id: str):
    db = _load_db()
    lic = _get_licitacion(db, lic_id)
    if not lic:
        raise HTTPException(status_code=404, detail="Licitación no encontrada")
    items = []
    for d in lic.get("docs", []) or []:
        items.append({
            "file": d.get("file"),
            "type": d.get("type", "propuesta"),
            "size": int(d.get("size", 0)),
        })
    return {"items": items}

# ---- Indexar documentos de la licitación en Chroma (colección contratos) ----
@app.post("/licitaciones/{lic_id}/indexar")
def indexar_licitacion(lic_id: str):
    folder = os.path.join(DOCS_DIR, lic_id)
    if not os.path.isdir(folder):
        raise HTTPException(status_code=404, detail="No hay carpeta de documentos para esta licitación")
    index_folder_to_contratos(folder, lic_id)
    return {"ok": True, "indexed_from": folder}

# ---- Análisis orquestado ----
@app.post("/licitaciones/{lic_id}/analizar")
def analizar_licitacion(lic_id: str):
    db = _load_db()
    lic = _get_licitacion(db, lic_id)
    if not lic:
        raise HTTPException(status_code=404, detail="Licitación no encontrada")

    result = run_analysis_for_lic(lic_id, objeto=lic.get("objeto", ""))

    # Persistir reporte
    rep_path = os.path.join(REPORTS_DIR, f"reporte_{lic_id}.json")
    with open(rep_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    # Actualizar estado básico
    lic["etapa"] = "Análisis"
    lic["progreso"] = 100
    db_ts = datetime.utcnow().isoformat()
    lic["last_analysis_at"] = db_ts
    _save_db(db)

    return {"ok": True, "report_path": rep_path, **result}

# ---- Endpoints para vistas específicas de tu UI ----
@app.get("/licitaciones/{lic_id}/resumen")
def resumen_licitacion(lic_id: str):
    rep_path = os.path.join(REPORTS_DIR, f"reporte_{lic_id}.json")
    if not os.path.exists(rep_path):
        raise HTTPException(status_code=404, detail="Aún no hay reporte. Ejecuta /analizar")
    with open(rep_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    rojas = data["summary"].get("rojas", 0)
    amarillas = data["summary"].get("amarillas", 0)
    just = data.get("justificacion_agente")
    return {"progreso": 100, "rojas": rojas, "amarillas": amarillas, "justificacion_agente": just}

@app.get("/licitaciones/{lic_id}/hallazgos")
def hallazgos_licitacion(lic_id: str):
    rep_path = os.path.join(REPORTS_DIR, f"reporte_{lic_id}.json")
    if not os.path.exists(rep_path):
        raise HTTPException(status_code=404, detail="Aún no hay reporte. Ejecuta /analizar")
    with open(rep_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    rows = []
    for r in data["results"]:
        doc = r["file"]
        for it in r["report"].get("issues", []) or []:
            it_copy = dict(it)
            it_copy["documento"] = doc
            rows.append(it_copy)
    return {"items": rows}

@app.get("/licitaciones/{lic_id}/validaciones/ruc")
def validaciones_ruc(lic_id: str):
    rep_path = os.path.join(REPORTS_DIR, f"reporte_{lic_id}.json")
    if not os.path.exists(rep_path):
        raise HTTPException(status_code=404, detail="Aún no hay reporte. Ejecuta /analizar")
    with open(rep_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    rows = []
    for r in data["results"]:
        for rr in r["report"].get("ruc_reports", []) or []:
            item = dict(rr)
            item["documento"] = r.get("file")
            rows.append(item)
    return {"items": rows}

@app.get("/licitaciones/{lic_id}/comparativo")
def comparativo(lic_id: str):
    rep_path = os.path.join(REPORTS_DIR, f"reporte_{lic_id}.json")
    if not os.path.exists(rep_path):
        raise HTTPException(status_code=404, detail="Aún no hay reporte. Ejecuta /analizar")
    with open(rep_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    rows = []
    for r in data["results"]:
        rep = r["report"]
        scores = rep.get("scores", {})
        rojas = sum(1 for i in rep.get("issues", []) if str(i.get("severity", "")).upper() in ("ALTO", "ROJO"))
        amar = sum(1 for i in rep.get("issues", []) if str(i.get("severity", "")).upper() in ("MEDIO", "AMARILLO"))
        # Pesos desde DB si existen
        db = _load_db()
        lic = _get_licitacion(db, lic_id)
        pesos = (lic or {}).get("pesos", {"legal": 35, "tecnico": 40, "economico": 25})
        wl, wt, we = float(pesos.get("legal", 35)), float(pesos.get("tecnico", 40)), float(pesos.get("economico", 25))
        denom = max(wl + wt + we, 1.0)
        wl, wt, we = wl/denom, wt/denom, we/denom
        total = int(wl * scores.get("legal", 50) + wt * scores.get("tecnico", 50) + we * scores.get("economico", 50))
        rows.append({
            "oferente": r["file"],
            "cumple_minimos": True,  # placeholder
            "legal": scores.get("legal", 0),
            "tecnico": scores.get("tecnico", 0),
            "economico": scores.get("economico", 0),
            "score_total": total,
            "rojas": rojas,
            "amarillas": amar,
            "observaciones": "",
        })
    # excluir pliegos de la competencia si se colaron
    rows = [r for r in rows if not str(r.get("oferente", "")).lower().startswith("pliego")]
    ganador = max(rows, key=lambda x: x["score_total"]) if rows else None
    return {"items": rows, "ganador": ganador}

class ChatRequest(BaseModel):
    message: str

CHAT_SYSTEM_PROMPT = """
Eres un asistente experto en análisis de licitaciones que ayuda a interpretar reportes de contratos.
Tienes acceso a:
1. Análisis completo (scores legales, técnicos, económicos)
2. Issues detectados con evidencia
3. Validaciones de RUC y riesgos empresariales
4. Contenido original relevante de documentos

Responde de forma conversacional, clara y educativa.
Explica QUÉ encontraste, POR QUÉ es importante, cita evidencia y da recomendaciones prácticas.
Si hay más de un contrato, haz comparaciones automáticas.
Usa un tono profesional pero accesible.
"""

def _format_issues(issues: List[Dict[str, Any]]) -> str:
    if not issues:
        return "Sin issues destacados."
    lines: List[str] = []
    for it in issues[:30]:
        sev = str(it.get("severity", "")).upper()
        cat = it.get("category") or ""
        desc = it.get("desc") or it.get("recommendation") or it.get("evidence") or it.get("type") or ""
        doc = it.get("doc") or it.get("documento") or ""
        lines.append(f"- [{sev}] ({cat}) {desc} — Doc: {doc}")
    return "\n".join(lines)

def _format_ruc_data(rucs: List[Dict[str, Any]]) -> str:
    if not rucs:
        return "Sin validaciones RUC registradas."
    lines: List[str] = []
    for r in rucs[:20]:
        lines.append(
            f"- RUC {r.get('ruc')} — exists={r.get('exists')} related={r.get('related')} risk={r.get('risk')} doc={r.get('doc')}. Razonamiento: {r.get('rationale','')}"
        )
    return "\n".join(lines)

def _format_rows(rows: List[Dict[str, Any]], ganador: Optional[Dict[str, Any]]) -> str:
    if not rows:
        return "Sin filas comparativas."
    lines: List[str] = []
    for r in rows[:10]:
        sc = r.get("scores", {})
        lines.append(
            f"- {r.get('oferente')}: Legal={sc.get('legal',0)}, Técnico={sc.get('tecnico',0)}, Económico={sc.get('economico',0)}, Total={r.get('total',0)} (Rojas={r.get('rojas',0)}, Amarillas={r.get('amarillas',0)})"
        )
    if ganador:
        lines.append(f"Ganador propuesto: {ganador.get('oferente')} con Total={ganador.get('total')}")
    return "\n".join(lines)

def _retrieve_context(lic_id: str, user_question: str, k: int = 6) -> List[str]:
    chunks: List[str] = []
    try:
        col = get_docs_collection()
        q = col.query(query_texts=[user_question], n_results=k, where={"licitacion_id": lic_id})
        docs = q.get("documents") if isinstance(q, dict) else getattr(q, "documents", None)
        if docs:
            for d in (docs[0] if isinstance(docs[0], list) else docs):
                if isinstance(d, str):
                    chunks.append(d)
    except Exception as e:
        print(f"[chat] retrieval error: {e}")
    return chunks

def build_chat_context(lic_id: str, user_question: str) -> Dict[str, Any]:
    rep_path = os.path.join(REPORTS_DIR, f"reporte_{lic_id}.json")
    if not os.path.exists(rep_path):
        raise HTTPException(status_code=404, detail="Aún no hay reporte. Ejecuta /analizar")
    with open(rep_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Derivar filas/ganador
    rows: List[Dict[str, Any]] = []
    ganador: Optional[Dict[str, Any]] = None
    try:
        db = _load_db()
        lic = _get_licitacion(db, lic_id)
        pesos = (lic or {}).get("pesos", {"legal": 35, "tecnico": 40, "economico": 25})
        wl, wt, we = float(pesos.get("legal", 35)), float(pesos.get("tecnico", 40)), float(pesos.get("economico", 25))
        denom = max(wl + wt + we, 1.0)
        wl, wt, we = wl/denom, wt/denom, we/denom
        for r in data.get("results", []):
            rep = r.get("report", {})
            scores = rep.get("scores", {})
            rojas = sum(1 for i in rep.get("issues", []) if str(i.get("severity", "")).upper() in ("ALTO", "ROJO"))
            amar = sum(1 for i in rep.get("issues", []) if str(i.get("severity", "")).upper() in ("MEDIO", "AMARILLO"))
            total = int(wl * scores.get("legal", 0) + wt * scores.get("tecnico", 0) + we * scores.get("economico", 0))
            rows.append({
                "oferente": r.get("file"),
                "scores": scores,
                "total": total,
                "rojas": rojas,
                "amarillas": amar,
            })
        rows = [r for r in rows if not str(r.get("oferente", "")).lower().startswith("pliego")]
        ganador = max(rows, key=lambda x: x["total"]) if rows else None
    except Exception:
        rows, ganador = [], None

    # Issues y RUCs
    issues: List[Dict[str, Any]] = []
    for r in data.get("results", []):
        for it in r.get("report", {}).get("issues", []) or []:
            issues.append({
                "doc": r.get("file"),
                "severity": str(it.get("severity", "")).upper(),
                "category": it.get("category") or it.get("tipo") or "",
                "desc": it.get("recommendation") or it.get("evidence") or it.get("type") or "",
            })
    rucs: List[Dict[str, Any]] = []
    for r in data.get("results", []):
        for rr in r.get("report", {}).get("ruc_reports", []) or []:
            rucs.append({
                "ruc": rr.get("ruc"),
                "exists": rr.get("exists"),
                "related": rr.get("related"),
                "risk": rr.get("risk"),
                "doc": r.get("file"),
                "rationale": rr.get("rationale"),
            })

    # Recuperación semántica
    rag_chunks = _retrieve_context(lic_id, user_question, k=6)

    # Construcción de texto de contexto estructurado
    context_text = (
        "ANÁLISIS COMPLETO:\n" + _format_rows(rows, ganador) + "\n\n"
        "ISSUES ENCONTRADOS:\n" + _format_issues(issues) + "\n\n"
        "VALIDACIÓN RUC:\n" + _format_ruc_data(rucs) + "\n\n"
        "CONTENIDO RELEVANTE DE DOCUMENTOS:\n" + "\n---\n".join(rag_chunks)
    )

    return {
        "rows": rows,
        "winner": ganador,
        "issues": issues,
        "rucs": rucs,
        "rag": rag_chunks,
        "text": context_text,
    }

@app.post("/licitaciones/{lic_id}/chat")
def chat_licitacion(lic_id: str, payload: ChatRequest):
    # Construir contexto enriquecido
    ctx = build_chat_context(lic_id, payload.message)

    try:
        messages = [
            {"role": "system", "content": CHAT_SYSTEM_PROMPT},
            {"role": "user", "content": (
                f"Pregunta del usuario: {payload.message}\n\n"
                f"CONTEXTO UNIFICADO:\n{ctx['text']}"
            )},
        ]
        resp = client.chat.completions.create(
            model=MODEL_JUST,
            messages=messages,
            temperature=0.2,
        )
        answer = resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[chat] openai error: {e}")
        answer = (
            "No fue posible generar una respuesta completa ahora. Sin embargo, de acuerdo con el comparativo, el ganador presenta mejor equilibrio de puntajes y menor número de riesgos críticos. "
            "Revisa garantías, multas y plazos en lo legal; definición de materiales, procesos y tiempos en lo técnico; y coherencia de precios y pagos en lo económico."
        )

    return {"answer": answer}

# ---- Descargar PDF de Resumen Ejecutivo (2 páginas) ----
@app.get("/licitaciones/{lic_id}/resumen-ejecutivo.pdf")
def descargar_resumen_ejecutivo(lic_id: str):
    db = _load_db()
    lic = _get_licitacion(db, lic_id)
    if not lic:
        raise HTTPException(status_code=404, detail="Licitación no encontrada")

    rep_path = os.path.join(REPORTS_DIR, f"reporte_{lic_id}.json")
    if not os.path.exists(rep_path):
        raise HTTPException(status_code=404, detail="Aún no hay reporte. Ejecuta /analizar")

    with open(rep_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    pdf_path = os.path.join(REPORTS_DIR, f"resumen_{lic_id}.pdf")
    build_executive_pdf(lic, data, pdf_path)

    return FileResponse(pdf_path, media_type="application/pdf", filename=f"resumen_{lic_id}.pdf")

# ============ Cómo correr ============
# pip install fastapi uvicorn reportlab python-dotenv
# uvicorn main_api:app --reload --port 8000

if __name__ == "__main__":
	import uvicorn
	# Nota: reload requiere import string. Para ejecución directa, lo desactivamos.
	uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=False)