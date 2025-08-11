import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api, { ComparativoItem, Hallazgo, RucValidationItem } from "@/lib/api";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Trophy, AlertTriangle, Gauge } from "lucide-react";
import { GridStack } from "gridstack";
import 'gridstack/dist/gridstack.min.css';

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
  const [gridKey, setGridKey] = useState(0);
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
  // Ordenar globalmente por severidad (ROJO/ALTO/HIGH > MEDIO/AMARILLO/MEDIUM > LOW)
  const severityRank = (s: string) => (s === "ALTO" || s === "ROJO" || s === "HIGH" ? 2 : (s === "MEDIO" || s === "AMARILLO" || s === "MEDIUM" ? 1 : 0));
  const topHallazgos: UIHallazgo[] = [...hallazgos]
    .sort((a,b)=> severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 20);
  const ganador: ComparativoItem | null = (compQ.data?.ganador as ComparativoItem | null) || null;
  const items: ComparativoItem[] = (compQ.data?.items as ComparativoItem[] | undefined) || [];
  // Derivar alertas reales desde hallazgos (mapea severidades a rojas/amarillas)
  const derived = useMemo(() => {
    type WithUpper = { SEVERITY?: string };
    const all = (hallazgosQ.data?.items as (Hallazgo & WithUpper)[] | undefined) || [];
    let red = 0, yellow = 0;
    for (const it of all) {
      const s = String(it?.severity || it?.SEVERITY || '').toUpperCase();
      if (["ALTO","ROJO","HIGH"].includes(s)) red++;
      else if (["MEDIO","AMARILLO","MEDIUM"].includes(s)) yellow++;
    }
    return { red, yellow };
  }, [hallazgosQ.data]);
  const numProps = items.length;
  const avg = (arr:number[]) => (arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0);
  const avgL = avg(items.map((x)=>Number(x.legal||0)));
  const avgT = avg(items.map((x)=>Number(x.tecnico||0)));
  const avgE = avg(items.map((x)=>Number(x.economico||0)));
  const rows: ComparativoItem[] = [...items].sort((a, b) => b.score_total - a.score_total);

  // Inicializa GridStack para drag & resize de widgets (primer bloque)
  useEffect(() => {
    const grid = GridStack.init({
      float: false,
      column: 12,
      cellHeight: 80,
      margin: 5,
      resizable: { handles: 'se' },
      minRow: 6,
    }, '.grid-stack');
    return () => { grid.destroy(false); };
  }, [gridKey]);

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

      <div className="w-full flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={()=>setGridKey((k)=>k+1)}>Restablecer posiciones</Button>
      </div>

      {/* GRIDSTACK: cada Card es un item independiente (drag & resize) */}
      <div key={gridKey} className="grid-stack w-full" style={{ minHeight: 'calc(100vh - 180px)' }}>
        {/* KPI Progreso */}
        <Card className="grid-stack-item shadow-elevated" gs-x={0} gs-y={0} gs-w={2} gs-h={2} style={{ height: "100%" }}>
            <CardHeader className="py-3"><CardTitle className="text-sm">Progreso</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <div className="text-xs flex justify-between"><span>Completado</span><span className="font-medium">{resumen.progreso}%</span></div>
              <Progress value={resumen.progreso} />
            </CardContent>
        </Card>

        {/* KPI Propuestas */}
        <Card className="grid-stack-item shadow-elevated" gs-x={2} gs-y={0} gs-w={2} gs-h={2} style={{ height: "100%" }}>
            <CardHeader className="py-3"><CardTitle className="text-sm">Propuestas</CardTitle></CardHeader>
            <CardContent className="text-xs"><span className="px-2 py-0.5 rounded-full bg-info text-info-foreground text-[10px] font-semibold">{numProps} propuestas</span></CardContent>
        </Card>

        {/* KPI Promedios */}
        <Card className="grid-stack-item shadow-elevated" gs-x={4} gs-y={0} gs-w={2} gs-h={2} style={{ height: "100%" }}>
            <CardHeader className="py-3"><CardTitle className="text-sm">Promedios</CardTitle></CardHeader>
            <CardContent className="text-xs flex gap-2">
              <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground inline-flex items-center gap-1"><Gauge className="w-3 h-3"/>L {avgL}</span>
              <span className="px-2 py-0.5 rounded-full bg-success text-success-foreground inline-flex items-center gap-1"><Gauge className="w-3 h-3"/>T {avgT}</span>
              <span className="px-2 py-0.5 rounded-full bg-warning text-warning-foreground inline-flex items-center gap-1"><Gauge className="w-3 h-3"/>E {avgE}</span>
            </CardContent>
        </Card>

        {/* KPI Alertas */}
        <Card className="grid-stack-item shadow-elevated" gs-x={6} gs-y={0} gs-w={2} gs-h={2} style={{ height: "100%" }}>
            <CardHeader className="py-3"><CardTitle className="text-sm">Alertas</CardTitle></CardHeader>
            <CardContent className="text-xs flex items-center gap-2">
              <Badge variant="destructive" className="inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>{derived.red || resumen.rojas} rojas</Badge>
              <span className="px-2 py-0.5 rounded-full bg-warning text-warning-foreground text-[10px] font-semibold inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>{derived.yellow || resumen.amarillas} amarillas</span>
            </CardContent>
        </Card>

        {/* Ganador */}
        <Card className="grid-stack-item shadow-elevated" gs-x={8} gs-y={4} gs-w={4} gs-h={2} style={{ height: "100%" }}>
            <CardHeader className="py-2"><CardTitle className="text-sm">Ganador recomendado</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-3 text-xs">
              {ganador ? (<>
                <div className="h-8 w-8 rounded-full bg-warning text-warning-foreground grid place-items-center shadow-glow"><Trophy className="h-4 w-4" /></div>
                <div className="truncate"><div className="truncate font-medium">{ganador.oferente}</div><div className="text-muted-foreground">Score <span className="font-semibold">{ganador.score_total}</span></div></div>
              </>) : (<p className="text-muted-foreground">Aún no hay ganador.</p>)}
            </CardContent>
        </Card>

        {/* Pie Alertas */}
        <Card className="grid-stack-item shadow-elevated" gs-x={0} gs-y={2} gs-w={4} gs-h={3} style={{ height: "100%" }}>
            <CardHeader className="py-3"><CardTitle className="text-sm">Alertas (Rojas vs Amarillas)</CardTitle></CardHeader>
            <CardContent className="text-xs">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie dataKey="value" data={[{name:'Rojas', value: (derived.red || resumen.rojas)},{name:'Amarillas', value: (derived.yellow || resumen.amarillas)}]} cx="50%" cy="50%" outerRadius={50} label>
                    <Cell fill="hsl(var(--destructive))" />
                    <Cell fill="hsl(var(--warning))" />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
        </Card>

        {/* Distribución por criterio */}
        <Card className="grid-stack-item shadow-elevated overflow-hidden" gs-x={4} gs-y={2} gs-w={8} gs-h={3} style={{ height: "100%" }}>
            <CardHeader className="py-2"><CardTitle className="text-sm">Distribución por criterio</CardTitle></CardHeader>
            <CardContent className="p-3 h-[calc(100%-2.5rem)]">
              {rows.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sin datos</div>
              ) : (
                <ChartContainer className="h-full" config={{
                  legal:{label:"Legal",color:"hsl(222,89%,56%)"},
                  tecnico:{label:"Técnico",color:"hsl(142,76%,36%)"},
                  economico:{label:"Económico",color:"hsl(27,96%,61%)"},
                }}>
                  <BarChart data={rows} barCategoryGap={6} barGap={2}>
                    <XAxis dataKey="oferente" hide/>
                    <YAxis allowDecimals={false} />
                    <Tooltip content={<ChartTooltipContent/>} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                    <Legend content={<ChartLegendContent/>} />
                    <Bar dataKey="legal" stackId="a" fill="var(--color-legal)"/>
                    <Bar dataKey="tecnico" stackId="a" fill="var(--color-tecnico)"/>
                    <Bar dataKey="economico" stackId="a" fill="var(--color-economico)"/>
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
        </Card>

        {/* Ranking */}
        <Card className="grid-stack-item shadow-elevated overflow-hidden" gs-x={0} gs-y={5} gs-w={6} gs-h={3} style={{ height: "100%" }}>
            <CardHeader className="py-2"><CardTitle className="text-sm">Ranking (Top 5)</CardTitle></CardHeader>
            <CardContent className="p-3">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={rows.slice(0,5)} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="oferente" width={150} />
                  <Tooltip />
                  <Bar dataKey="score_total" fill="hsl(var(--success))" radius={[4,4,4,4]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
        </Card>

        {/* Top hallazgos */}
        <Card className="grid-stack-item shadow-elevated overflow-hidden" gs-x={6} gs-y={5} gs-w={6} gs-h={3} style={{ height: "100%" }}>
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
                  {topHallazgos.map((h, idx) => (
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

        {/* RUC */}
        <Card className="grid-stack-item shadow-elevated overflow-hidden" gs-x={0} gs-y={8} gs-w={5} gs-h={3} style={{ height: "100%" }}>
            <CardHeader className="py-2"><CardTitle className="text-sm">Validación de RUC</CardTitle></CardHeader>
            <CardContent className="text-[11px] space-y-1 p-3 h-[calc(100%-2.5rem)] overflow-auto">
              {((rucQ.data?.items as RucValidationItem[] | undefined) || []).length===0 && <p className="text-muted-foreground">Sin RUCs detectados.</p>}
              {((rucQ.data?.items as RucValidationItem[] | undefined) || []).map((r, i)=> (
                <div key={i} className="flex items-center justify-between">
                  <span>{r.ruc} <span className="text-muted-foreground">— {r.documento || "Documento"}</span></span>
                  {r.related ? (
                    <span className="px-2 py-0.5 rounded-full bg-success text-success-foreground text-xs font-semibold">Relacionado</span>
                  ) : (
                    <Badge variant="destructive">No relacionado</Badge>
                  )}
                </div>
              ))}
            </CardContent>
        </Card>

        {/* Comparativo */}
        <Card className="grid-stack-item shadow-elevated overflow-hidden" gs-x={5} gs-y={8} gs-w={7} gs-h={3} style={{ height: "100%" }}>
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



