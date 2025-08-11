import os
import glob
import uuid
from dotenv import load_dotenv
from openai import OpenAI

from rag.chroma_setup import get_collection
from utils.pdf_text import pdf_to_text
from utils.chunk import chunk_text

load_dotenv()
client = OpenAI()

DATA_DIR = os.environ.get("LEGAL_DATA_DIR", "./data/base_legal")
MODEL_EMB = os.environ.get("MODEL_EMB", "text-embedding-3-small")

# Ejecuta: python -m rag.ingest_legal_docs

def embed(texts):
    # Retorna lista de vectores
    resp = client.embeddings.create(model=MODEL_EMB, input=texts)
    return [d.embedding for d in resp.data]


def main():
    col = get_collection()
    pdfs = glob.glob(os.path.join(DATA_DIR, "**/*.pdf"), recursive=True)
    if not pdfs:
        print(f"No se encontraron PDFs en {DATA_DIR}")
        return

    print(f"Indexando {len(pdfs)} documentos legales...")
    for path in pdfs:
        try:
            text = pdf_to_text(path)
            chunks = chunk_text(text)
            ids = [str(uuid.uuid4()) for _ in chunks]
            embeddings = embed(chunks)

            metadatas = [{
                "source": os.path.basename(path),
                "path": path,
                "type": "legal",
            } for _ in chunks]

            col.add(ids=ids, documents=chunks, embeddings=embeddings, metadatas=metadatas)
            print(f"✔ {os.path.basename(path)} → {len(chunks)} chunks")
        except Exception as e:
            print(f"✖ Error en {path}: {e}")

    print("Listo. Base legal indexada en ChromaDB.")

if __name__ == "__main__":
    main()