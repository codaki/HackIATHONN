from typing import List, Dict
from openai import OpenAI
from dotenv import load_dotenv

from rag.chroma_setup import get_legal_collection as get_collection

load_dotenv()
client = OpenAI()
MODEL_EMB = "text-embedding-3-small"


def _embed(query: str):
    resp = client.embeddings.create(model=MODEL_EMB, input=[query])
    return resp.data[0].embedding


def retrieve_context(query: str, k: int = 6) -> List[Dict]:
    col = get_collection()
    qemb = _embed(query)
    res = col.query(query_embeddings=[qemb], n_results=k, include=["documents", "metadatas", "distances"])

    docs = res.get("documents", [[]])[0]
    metas = res.get("metadatas", [[]])[0]
    dists = res.get("distances", [[]])[0]

    items = []
    for doc, meta, dist in zip(docs, metas, dists):
        items.append({
            "text": doc,
            "source": meta.get("source"),
            "path": meta.get("path"),
            "distance": float(dist),
        })
    return items