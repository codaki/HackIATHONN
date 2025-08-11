import os, glob, uuid
from dotenv import load_dotenv
from openai import OpenAI

from rag.chroma_setup import get_docs_collection
from utils.pdf_text import pdf_to_text
from utils.chunk import chunk_text

load_dotenv()
client = OpenAI()

DOCS_DIR = os.environ.get("DOCS_DIR", "./data/docs")
MODEL_EMB = os.environ.get("MODEL_EMB", "text-embedding-3-small")

# Ejecuta: python -m rag.ingest_proposals

def embed(texts):
    resp = client.embeddings.create(model=MODEL_EMB, input=texts)
    return [d.embedding for d in resp.data]


def main():
    col = get_docs_collection()
    pdfs = glob.glob(os.path.join(DOCS_DIR, "**/*.pdf"), recursive=True)
    if not pdfs:
        print(f"No se encontraron PDFs en {DOCS_DIR}")
        return

    print(f"Indexando {len(pdfs)} contratos/propuestas...")
    for path in pdfs:
        try:
            text = pdf_to_text(path)
            chunks = chunk_text(text)
            ids = [str(uuid.uuid4()) for _ in chunks]
            embeddings = embed(chunks)
            metadatas = [{"source": os.path.basename(path), "path": path, "type": "contrato"} for _ in chunks]
            col.add(ids=ids, documents=chunks, embeddings=embeddings, metadatas=metadatas)
            print(f"✔ {os.path.basename(path)} → {len(chunks)} chunks")
        except Exception as e:
            print(f"✖ Error en {path}: {e}")

    print("Listo. Contratos indexados en ChromaDB (colección 'contratos').")

if __name__ == "__main__":
    main()