import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Convierte texto numérico con coma o punto a float. Devuelve null si no es numérico válido.
export function parseMoney(input?: string | null): number | null {
  const raw = (input ?? "").trim()
  if (!raw) return null
  const normalized = raw.replace(/\s+/g, "").replace(",", ".")
  if (!/^[-+]?\d*(?:\.\d+)?$/.test(normalized)) return null
  const val = parseFloat(normalized)
  return Number.isFinite(val) ? val : null
}
