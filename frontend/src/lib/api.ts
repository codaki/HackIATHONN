// Cliente API simple para FastAPI
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${BASE_URL}${path}`, {
		...init,
		headers: {
			...(init?.headers || {}),
		},
		credentials: "omit",
	});
	if (!res.ok) {
		const txt = await res.text().catch(() => "");
		throw new Error(`API ${res.status}: ${txt || res.statusText}`);
	}
	const ct = res.headers.get("content-type") || "";
	if (ct.includes("application/json")) return (await res.json()) as T;
	return (await res.blob()) as unknown as T;
}

export interface Pesos {
	legal: number;
	tecnico: number;
	economico: number;
}

export interface LicResumen {
	id: string;
	nombre: string;
	etapa: string;
	progreso: number;
	rojas: number;
	amarillas: number;
	deadline?: string | null;
	responsables: string[];
}

export interface ComparativoItem { oferente: string; cumple_minimos: boolean; legal: number; tecnico: number; economico: number; score_total: number; rojas: number; amarillas: number; observaciones: string }
export interface ComparativoResp { items: ComparativoItem[]; ganador: ComparativoItem | null }
export interface Hallazgo { documento?: string; category?: string; severity?: string; recommendation?: string; evidence?: string; type?: string }

export interface RucValidationItem {
  ruc: string;
  exists: boolean;
  related: boolean;
  risk: "ALTO" | "MEDIO" | "BAJO";
  rationale: string;
  documento?: string;
}

export const api = {
	health: () => request<{ ok: boolean; ts: string }>(`/health`),
	crearLicitacion: (payload: {
		nombre: string;
		objeto: string;
		presupuesto?: number | null;
		pesos: Pesos;
		normativa: string[];
		deadline?: string | null;
	}) =>
		request<LicResumen>(`/licitaciones`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		}),
	listarLicitaciones: () => request<LicResumen[]>(`/licitaciones`),
	subirDocumentos: (licId: string, files: File[], autoIndex = true, tipo?: "pliego" | "propuesta") => {
		const fd = new FormData();
		files.forEach((f) => fd.append("files", f, f.name));
		fd.append("auto_index", String(autoIndex));
		if (tipo) fd.append("tipo", tipo);
		return request<{ ok: boolean; saved: string[]; indexed: boolean }>(
			`/licitaciones/${licId}/documentos`,
			{ method: "POST", body: fd }
		);
	},
	analizar: (licId: string) => request(`/licitaciones/${licId}/analizar`, { method: "POST" }),
	comparativo: (licId: string) => request<ComparativoResp>(`/licitaciones/${licId}/comparativo`),
	resumen: (licId: string) => request<{ progreso: number; rojas: number; amarillas: number; justificacion_agente?: string }>(`/licitaciones/${licId}/resumen`),
	hallazgos: (licId: string) => request<{ items: Hallazgo[] }>(`/licitaciones/${licId}/hallazgos`),
	listarDocumentos: (licId: string) => request<{ items: { file: string; type: string; size: number }[] }>(`/licitaciones/${licId}/documentos`),
	validacionesRuc: (licId: string) => request<{ items: RucValidationItem[] }>(`/licitaciones/${licId}/validaciones/ruc`),
	resumenPdfUrl: (licId: string) => `${BASE_URL}/licitaciones/${licId}/resumen-ejecutivo.pdf`,
  chat: (licId: string, message: string) => request<{ answer: string }>(`/licitaciones/${licId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  }),
};

export default api;


