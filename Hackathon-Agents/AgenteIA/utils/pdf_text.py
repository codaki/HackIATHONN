from pypdf import PdfReader

def pdf_to_text(path: str) -> str:
    reader = PdfReader(path)
    texts = []
    for i, page in enumerate(reader.pages):
        try:
            texts.append(page.extract_text() or "")
        except Exception:
            texts.append("")
    return "\n\n".join(texts)