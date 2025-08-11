import os
try:
    import chromadb
    from chromadb.config import Settings
except Exception:  # fallback si sqlite/chromadb no disponible
    chromadb = None
    Settings = None

CHROMA_PATH = os.environ.get("CHROMA_PATH", "./chroma_db")
LEGAL_COLLECTION = os.environ.get("LEGAL_COLLECTION", "base_legal")
DOCS_COLLECTION = os.environ.get("DOCS_COLLECTION", "contratos")

client = None
if chromadb is not None:
    try:
        client = chromadb.PersistentClient(path=CHROMA_PATH, settings=Settings())
    except Exception:
        client = None

def get_legal_collection():
    if client is None:
        class _Dummy:
            def add(self, **kwargs):
                pass
            def query(self, **kwargs):
                return {"documents": [[]], "metadatas": [[]]}
        return _Dummy()
    return client.get_or_create_collection(name=LEGAL_COLLECTION, metadata={"hnsw:space": "cosine"})

def get_docs_collection():
    if client is None:
        class _Dummy:
            def add(self, **kwargs):
                pass
            def query(self, **kwargs):
                return {"documents": [[]], "metadatas": [[]]}
        return _Dummy()
    return client.get_or_create_collection(name=DOCS_COLLECTION, metadata={"hnsw:space": "cosine"})

def get_collection(kind: str = "legal"):
    if kind == "legal":
        return get_legal_collection()
    elif kind == "docs" or kind == "contratos":
        return get_docs_collection()
    else:
        # por defecto, legal
        return get_legal_collection()