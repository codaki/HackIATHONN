import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

function useQueryParam(name: string) {
	const { search } = useLocation();
	return useMemo(() => new URLSearchParams(search).get(name), [search, name]);
}

export default function Dashboard() {
	const lic = useQueryParam("lic") || "";
	const resumenQ = useQuery({ queryKey: ["resumen", lic], queryFn: () => api.resumen(lic), enabled: !!lic });
	const hallazgosQ = useQuery({ queryKey: ["hallazgos", lic], queryFn: () => api.hallazgos(lic), enabled: !!lic });
	const compQ = useQuery({ queryKey: ["comparativo", lic], queryFn: () => api.comparativo(lic), enabled: !!lic });

	const resumen = resumenQ.data || { progreso: 0, rojas: 0, amarillas: 0 };
	const hallazgos = hallazgosQ.data?.items || [];
	const ganador = compQ.data?.ganador || null;
	const items = compQ.data?.items || [];

	return (
		<div className="space-y-6">
			<SEO title="Dashboard | proc-stream" description="Resumen, riesgos y comparativo del proceso." />
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Dashboard</h1>
				<div className="flex gap-2">
					<Button asChild variant="outline"><a href={`/comparativo?lic=${lic}`}>Ver comparativo</a></Button>
					<Button asChild variant="hero"><a href={api.resumenPdfUrl(lic)} target="_blank" rel="noreferrer">PDF ejecutivo</a></Button>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
				<Card className="shadow-elevated">
					<CardHeader><CardTitle className="text-base">KPIs</CardTitle></CardHeader>
					<CardContent className="text-sm">
						<p>Progreso: {resumen.progreso}%</p>
						<p>Alertas rojas: <Badge variant="destructive">{resumen.rojas}</Badge></p>
						<p>Alertas amarillas: <span className="px-2 py-0.5 rounded-full bg-warning text-warning-foreground text-xs font-semibold">{resumen.amarillas}</span></p>
					</CardContent>
				</Card>
				<Card className="shadow-elevated lg:col-span-2">
					<CardHeader><CardTitle className="text-base">Ganador recomendado</CardTitle></CardHeader>
					<CardContent className="text-sm">
						{ganador ? (
							<p>{ganador.oferente || ganador.nombre} — Score total {ganador.score_total}</p>
						) : (
							<p className="text-muted-foreground">Aún no hay ganador.</p>
						)}
					</CardContent>
				</Card>
			</div>

			<Card className="shadow-elevated">
				<CardHeader><CardTitle className="text-base">Top hallazgos</CardTitle></CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Documento</TableHead>
								<TableHead>Tipo</TableHead>
								<TableHead>Severidad</TableHead>
								<TableHead>Descripción</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{hallazgos.slice(0, 10).map((h: any, idx: number) => (
								<TableRow key={idx}>
									<TableCell>{h.documento || "-"}</TableCell>
									<TableCell>{h.category || "-"}</TableCell>
									<TableCell>
										{String(h.severity || "").toUpperCase() in { ROJO:1, ALTO:1 } ? (
											<Badge variant="destructive">{h.severity}</Badge>
										) : (
											<span className="px-2 py-0.5 rounded-full bg-warning text-warning-foreground text-xs font-semibold">{h.severity || "-"}</span>
										)}
									</TableCell>
									<TableCell>{h.recommendation || h.evidence || h.type}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}



