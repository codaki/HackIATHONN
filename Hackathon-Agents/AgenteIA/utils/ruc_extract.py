import re
from typing import List

RUC_REGEX = re.compile(r"\b\d{13}\b")


def extract_rucs(text: str) -> List[str]:
    return sorted(set(RUC_REGEX.findall(text or "")))