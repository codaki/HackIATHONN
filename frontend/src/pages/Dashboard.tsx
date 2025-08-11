import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api, { ComparativoItem, Hallazgo, RucValidationItem } from "@/lib/api";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

function useQueryParam(name: string) {
	const { search } = useLocation();
	return useMemo(() => new URLSearchParams(search).get(name), [search, name]);
}

// Tamaños por card (ancho/alto). Modifica aquí para personalizar cada card.
// Por defecto mantenemos el layout actual (width 100% y altura compacta).
const CARD_SIZE = {
  kpiProgress: { width: "100%" as const, height: 88 },
  kpiPropuestas: { width: "100%" as const, height: 88 },
  kpiPromedios: { width: "100%" as const, height: 88 },
  kpiAlertas: { width: "100%" as const, height: 88 },
  ganador: { width: "100%" as const, height: 88 },
  pieAlertas: { width: "100%" as const, height: 180 },
  whatIf: { width: "100%" as const, height: 192 },
  distCriterio: { width: "100%" as const, height: 180 },
  ranking: { width: "100%" as const, height: 200 },
  hallazgos: { width: "100%" as const, height: 220 },
  ruc: { width: "100%" as const, height: 160 },
  comparativo: { width: "100%" as const, height: 220 },
};

export default function Dashboard() {
	const lic = useQueryParam("lic") || "";
	const resumenQ = useQuery({ queryKey: ["resumen", lic], queryFn: () => api.resumen(lic), enabled: !!lic });
	const hallazgosQ = useQuery({ queryKey: ["hallazgos", lic], queryFn: () => api.hallazgos(lic), enabled: !!lic });
	const compQ = useQuery({ queryKey: ["comparativo", lic], queryFn: () => api.comparativo(lic), enabled: !!lic });
  const rucQ = useQuery({ queryKey: ["validaciones-ruc", lic], queryFn: () => api.validacionesRuc(lic), enabled: !!lic });

  const resumen = resumenQ.data || { progreso: 0, rojas: 0, amarillas: 0 };
  type UIHallazgo = Hallazgo & { severity: string; category: string; description: string };
  type RawHallazgo = Hallazgo & { SEVERITY?: string; tipo?: string; desc?: string };
  const rawHallazgos: RawHallazgo[] = (hallazgosQ.data?.items as RawHallazgo[] | undefined) || [];
  const hallazgos: UIHallazgo[] = rawHallazgos.map((h) => ({
    ...h,
    severity: String(h.severity || h.SEVERITY || "").toUpperCase(),
    category: String(h.category || h.tipo || "").toLowerCase(),
    description: h.recommendation || h.evidence || h.desc || h.type || "Revisar",
  }));
  const ganador: ComparativoItem | null = (compQ.data?.ganador as ComparativoItem | null) || null;
  const items: ComparativoItem[] = (compQ.data?.items as ComparativoItem[] | undefined) || [];
  const numProps = items.length;
  const avg = (arr:number[]) => (arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0);
  const avgL = avg(items.map((x)=>Number(x.legal||0)));
  const avgT = avg(items.map((x)=>Number(x.tecnico||0)));
  const avgE = avg(items.map((x)=>Number(x.economico||0)));
  const rows: ComparativoItem[] = [...items].sort((a, b) => b.score_total - a.score_total);

	return (
		<div className="space-y-6">
			<SEO title="Dashboard | ElicitIA" description="Resumen, riesgos y comparativo del proceso." />
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Dashboard</h1>
				<div className="flex gap-2">
					<Button asChild variant="outline"><a href={`/comparativo?lic=${lic}`}>Ver comparativo</a></Button>
					<Button asChild variant="hero"><a href={api.resumenPdfUrl(lic)} target="_blank" rel="noreferrer">PDF ejecutivo</a></Button>
				</div>
			</div>

      <div className="grid grid-cols-12 gap-3 auto-rows-[minmax(120px,auto)]">
        {/* Fila 1: KPIs */}
        <Card className="shadow-elevated col-span-12 lg:col-span-3" style={{ width: CARD_SIZE.kpiProgress.width, height: CARD_SIZE.kpiProgress.height }}>
          <CardHeader className="py-3"><CardTitle className="text-sm">Progreso</CardTitle></CardHeader>
          <CardContent className="text-xs">{resumen.progreso}%</CardContent>
        </Card>
        <Card className="shadow-elevated col-span-12 lg:col-span-3" style={{ width: CARD_SIZE.kpiPropuestas.width, height: CARD_SIZE.kpiPropuestas.height }}>
          <CardHeader className="py-3"><CardTitle className="text-sm">Propuestas</CardTitle></CardHeader>
          <CardContent className="text-xs">{numProps}</CardContent>
        </Card>
        <Card className="shadow-elevated col-span-12 lg:col-span-3" style={{ width: CARD_SIZE.kpiPromedios.width, height: CARD_SIZE.kpiPromedios.height }}>
          <CardHeader className="py-3"><CardTitle className="text-sm">Promedios</CardTitle></CardHeader>
          <CardContent className="text-xs flex gap-3"><span>L {avgL}</span><span>T {avgT}</span><span>E {avgE}</span></CardContent>
        </Card>
        <Card className="shadow-elevated col-span-12 lg:col-span-3" style={{ width: CARD_SIZE.kpiAlertas.width, height: CARD_SIZE.kpiAlertas.height }}>
          <CardHeader className="py-3"><CardTitle className="text-sm">Alertas</CardTitle></CardHeader>
          <CardContent className="text-xs flex items-center gap-2">
            <Badge variant="destructive">{resumen.rojas} rojas</Badge>
            <span className="px-2 py-0.5 rounded-full bg-warning text-warning-foreground text-[10px] font-semibold">{resumen.amarillas} amarillas</span>
          </CardContent>
        </Card>
        {/* Fila 2: Ganador + Pie */}
        <Card className="shadow-elevated col-span-12 lg:col-span-4" style={{ width: CARD_SIZE.ganador.width, height: CARD_SIZE.ganador.height }}>
          <CardHeader className="py-3"><CardTitle className="text-sm">Ganador recomendado</CardTitle></CardHeader>
          <CardContent className="text-xs">
            {ganador ? (
              <p className="truncate">{ganador.oferente} — <span className="font-semibold">{ganador.score_total}</span></p>
            ) : (
              <p className="text-muted-foreground">Aún no hay ganador.</p>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-elevated col-span-12 lg:col-span-8" style={{ width: CARD_SIZE.pieAlertas.width, height: CARD_SIZE.pieAlertas.height }}>
          <CardHeader className="py-3"><CardTitle className="text-sm">Alertas (Rojas vs Amarillas)</CardTitle></CardHeader>
          <CardContent className="text-xs">
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie dataKey="value" data={[{name:'Rojas', value: resumen.rojas},{name:'Amarillas', value: resumen.amarillas}]}
                  cx="50%" cy="50%" outerRadius={50} label>
                  <Cell fill="hsl(0,84%,60%)" />
                  <Cell fill="hsl(45,93%,47%)" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        {/* Fila 3: Distribución */}
      <Card className="shadow-elevated col-span-12 lg:col-span-12 overflow-hidden" style={{ width: CARD_SIZE.distCriterio.width, height: CARD_SIZE.distCriterio.height }}>
        <CardHeader className="py-2"><CardTitle className="text-sm">Distribución por criterio</CardTitle></CardHeader>
        <CardContent className="p-3 h-[calc(100%-2.5rem)]">
          <ChartContainer config={{
            legal:{label:"Legal",color:"hsl(222,89%,56%)"},
            tecnico:{label:"Técnico",color:"hsl(142,76%,36%)"},
            economico:{label:"Económico",color:"hsl(27,96%,61%)"},
          }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} barCategoryGap={6} barGap={2}>
                <XAxis dataKey="oferente" hide/>
                <YAxis allowDecimals={false} />
                <Tooltip content={<ChartTooltipContent/>} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Legend content={<ChartLegendContent/>} />
                <Bar dataKey="legal" stackId="a" fill="var(--color-legal)"/>
                <Bar dataKey="tecnico" stackId="a" fill="var(--color-tecnico)"/>
                <Bar dataKey="economico" stackId="a" fill="var(--color-economico)"/>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Fila 4: Ranking + Hallazgos */}
      <Card className="shadow-elevated col-span-12 lg:col-span-6 overflow-hidden" style={{ width: CARD_SIZE.ranking.width, height: CARD_SIZE.ranking.height }}>
        <CardHeader className="py-2"><CardTitle className="text-sm">Ranking (Top 5)</CardTitle></CardHeader>
        <CardContent className="p-3">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={rows.slice(0,5)} layout="vertical">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="oferente" width={150} />
              <Tooltip />
              <Bar dataKey="score_total" fill="hsl(222,89%,56%)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-elevated col-span-12 lg:col-span-6 overflow-hidden" style={{ width: CARD_SIZE.hallazgos.width, height: CARD_SIZE.hallazgos.height }}>
        <CardHeader className="py-2"><CardTitle className="text-sm">Top hallazgos</CardTitle></CardHeader>
        <CardContent className="p-3 h-[calc(100%-2.5rem)]">
          <div className="h-full overflow-auto">
          <Table className="text-[11px]">
						<TableHeader>
							<TableRow>
								<TableHead>Documento</TableHead>
								<TableHead>Tipo</TableHead>
								<TableHead>Severidad</TableHead>
								<TableHead>Descripción</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
              {hallazgos.slice(0, 8).map((h, idx) => (
								<TableRow key={idx}>
									<TableCell>{h.documento || "-"}</TableCell>
                  <TableCell className="capitalize">{h.category || "-"}</TableCell>
									<TableCell>
                    {h.severity === "ALTO" || h.severity === "ROJO" || h.severity === "HIGH" ? (
                      <Badge variant="destructive">{h.severity}</Badge>
                    ) : h.severity === "MEDIO" || h.severity === "AMARILLO" || h.severity === "MEDIUM" ? (
                      <span className="px-2 py-0.5 rounded-full bg-warning text-warning-foreground text-xs font-semibold">{h.severity}</span>
                    ) : (
                      <Badge variant="secondary">{h.severity || "LOW"}</Badge>
                    )}
									</TableCell>
                  <TableCell className="truncate max-w-[260px]">{h.description}</TableCell>
								</TableRow>
							))}
						</TableBody>
          </Table>
          </div>
				</CardContent>
			</Card>

      {/* Fila 5: RUC + Comparativo */}
      <Card className="shadow-elevated col-span-12 lg:col-span-5 overflow-hidden" style={{ width: CARD_SIZE.ruc.width, height: CARD_SIZE.ruc.height }}>
        <CardHeader className="py-2"><CardTitle className="text-sm">Validación de RUC</CardTitle></CardHeader>
        <CardContent className="text-[11px] space-y-1 p-3 h-[calc(100%-2.5rem)] overflow-auto">
          {((rucQ.data?.items as RucValidationItem[] | undefined) || []).length===0 && <p className="text-muted-foreground">Sin RUCs detectados.</p>}
          {((rucQ.data?.items as RucValidationItem[] | undefined) || []).map((r, i)=> (
            <div key={i} className="flex items-center justify-between">
              <span>{r.ruc} <span className="text-muted-foreground">— {r.documento || "Documento"}</span></span>
              {r.related ? <Badge variant="secondary">Relacionado</Badge> : <Badge variant="destructive">No relacionado</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-elevated col-span-12 lg:col-span-7 overflow-hidden" style={{ width: CARD_SIZE.comparativo.width, height: CARD_SIZE.comparativo.height }}>
        <CardHeader className="py-2"><CardTitle className="text-sm">Comparativo (pesos originales)</CardTitle></CardHeader>
        <CardContent className="text-[11px] p-3 h-[calc(100%-2.5rem)] overflow-auto">
          <Table className="text-[11px]">
            <TableHeader>
              <TableRow>
                <TableHead>Oferente</TableHead>
                <TableHead>Legal</TableHead>
                <TableHead>Técnico</TableHead>
                <TableHead>Económico</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.slice(0,8).map((o, idx)=> (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{o.oferente}</TableCell>
                  <TableCell>{o.legal}</TableCell>
                  <TableCell>{o.tecnico}</TableCell>
                  <TableCell>{o.economico}</TableCell>
                  <TableCell className="font-semibold">{o.score_total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}



