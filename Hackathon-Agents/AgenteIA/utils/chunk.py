from typing import List

def chunk_text(text: str, chunk_size: int = 1400, overlap: int = 200) -> List[str]:
    text = text or ""
    if len(text) <= chunk_size:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        if end == len(text):
            break
        start = max(0, end - overlap)
    return chunks