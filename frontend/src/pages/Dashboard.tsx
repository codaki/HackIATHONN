import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api, { ComparativoItem, Hallazgo, RucValidationItem } from "@/lib/api";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { Trophy, AlertTriangle, Gauge, MessageSquare } from "lucide-react";
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
  // Cargar justificación del reporte si viene embebida en /resumen
  type ResumenResp = { progreso: number; rojas?: number; amarillas?: number; justificacion_agente?: string };
  const justificacion: string | undefined = (resumenQ.data as ResumenResp | undefined)?.justificacion_agente;
  const [showBubble, setShowBubble] = useState(true);
  const [showNudge, setShowNudge] = useState(false);
  type ChatMsg = { role: 'user' | 'assistant'; content: string };
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatDots, setChatDots] = useState(0);

  // Nudge ocasional "Leeme" para llamar la atención sobre la burbuja
  useEffect(() => {
    let timeoutId: number | undefined;
    const intervalId = window.setInterval(() => {
      setShowNudge(true);
      timeoutId = window.setTimeout(() => setShowNudge(false), 2500);
    }, 12000);
    return () => { window.clearInterval(intervalId); if (timeoutId) window.clearTimeout(timeoutId); };
  }, []);

  // Resaltado de palabras clave en la justificación
  const highlightJustificacion = (text: string) => {
    const KEY_CLASSES: Record<string, string> = {
      legal: "bg-primary text-primary-foreground",
      tecnico: "bg-success text-success-foreground",
      técnico: "bg-success text-success-foreground",
      economico: "bg-warning text-warning-foreground",
      económico: "bg-warning text-warning-foreground",
      garantias: "bg-primary text-primary-foreground",
      garantías: "bg-primary text-primary-foreground",
      multas: "bg-primary text-primary-foreground",
      plazos: "bg-primary text-primary-foreground",
      materiales: "bg-success text-success-foreground",
      procesos: "bg-success text-success-foreground",
      tiempos: "bg-success text-success-foreground",
      presupuesto: "bg-warning text-warning-foreground",
      presupuestos: "bg-warning text-warning-foreground",
      pago: "bg-warning text-warning-foreground",
      pagos: "bg-warning text-warning-foreground",
      "formas de pago": "bg-warning text-warning-foreground",
      coherencia: "bg-info text-info-foreground",
      pliegos: "bg-info text-info-foreground",
      riesgos: "bg-destructive text-destructive-foreground",
      rojas: "bg-destructive text-destructive-foreground",
      amarillas: "bg-warning text-warning-foreground",
      ganador: "bg-primary text-primary-foreground",
      contrato: "bg-primary/20",
      contratos: "bg-primary/20",
      recomendaciones: "bg-info text-info-foreground",
      mejora: "bg-info text-info-foreground",
    };
    const words = [
      "legal","técnico","tecnico","económico","economico","garantías","garantias","multas","plazos","materiales","procesos","tiempos","presupuesto","presupuestos","pago","pagos","formas\\s+de\\s+pago","coherencia","pliegos","riesgos","rojas","amarillas","ganador","contrato","contratos","recomendaciones","mejora"
    ];
    const re = new RegExp(`(${words.join("|")})`, "gi");
    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return text.split(re).map((seg, i) => {
      const key = seg.trim();
      if (!key) return <span key={i}></span>;
      const base = key.replace(/\s+/g, " ");
      const clsKey = Object.keys(KEY_CLASSES).find((k) => norm(base) === norm(k));
      if (clsKey) return <span key={i} className={`px-1 rounded ${KEY_CLASSES[clsKey]} font-semibold`}>{seg}</span>;
      return <span key={i}>{seg}</span>;
    });
  };
  
  // Render markdown ligero para respuestas del agente en chat
  const renderMarkdownLite = (text: string) => {
    const escape = (s: string) => s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const lines = escape(text).split(/\r?\n/);
    const out: string[] = [];
    let inList = false;
    let lastWasBlock = false;
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      // close list if current line is not a list item
      if (inList && !/^\s*[-*]\s+/.test(ln)) {
        out.push('</ul>');
        inList = false;
        lastWasBlock = true;
      }
      // headings ### -> h4
      const h3 = ln.match(/^###\s+(.*)$/);
      if (h3) {
        if (inList) { out.push('</ul>'); inList = false; }
        const inner = h3[1];
        out.push(`<h4 class="text-sm font-semibold mb-1 mt-1">${inner}</h4>`);
        continue;
      }
      // list items
      const li = ln.match(/^\s*[-*]\s+(.*)$/);
      if (li) {
        if (!inList) { out.push('<ul class="list-disc ml-4 my-1 space-y-0.5">'); inList = true; }
        out.push(`<li>${li[1]}</li>`);
        lastWasBlock = true;
        continue;
      }
      // skip extra blank lines
      if (ln.trim() === '') { continue; }
      // paragraph line with compact spacing
      out.push(`<p class="mb-1">${ln}</p>`);
      lastWasBlock = true;
    }
    if (inList) out.push('</ul>');
    let html = out.join('\n');
    // bold and italics
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };
  // api.resumen solo devuelve progreso y conteo; para mostrar el texto, lo obtendremos desde /reports si backend lo expone en /resumen o usar comparativo/resumen endpoints.

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

  const onSendChat = async () => {
    const q = chatText.trim();
    if (!q || !lic) return;
    setChatText("");
    setChatMsgs((m) => [...m, { role: 'user', content: q }]);
    setChatSending(true);
    try {
      const res = await api.chat(lic, q);
      const ans = (res as { answer: string }).answer || "";
      setChatMsgs((m) => [...m, { role: 'assistant', content: ans }]);
    } catch (e) {
      setChatMsgs((m) => [...m, { role: 'assistant', content: "No fue posible responder en este momento." }]);
    } finally {
      setChatSending(false);
    }
  };

  useEffect(() => {
    if (!chatSending) return;
    const id = window.setInterval(() => setChatDots((d) => (d + 1) % 4), 400);
    return () => window.clearInterval(id);
  }, [chatSending]);

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
          <CardHeader className="py-2"><CardTitle className="text-sm">Promedios</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground inline-flex items-center gap-1"><Gauge className="w-3 h-3"/>Legal</span>
              <span className="font-medium">{avgL}</span>
            </div>
            <div className="h-1.5 w-full rounded bg-primary/20"><div className="h-1.5 rounded bg-primary" style={{ width: `${avgL}%` }} /></div>
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full bg-success text-success-foreground inline-flex items-center gap-1"><Gauge className="w-3 h-3"/>Técnico</span>
              <span className="font-medium">{avgT}</span>
            </div>
            <div className="h-1.5 w-full rounded bg-success/20"><div className="h-1.5 rounded bg-success" style={{ width: `${avgT}%` }} /></div>
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full bg-warning text-warning-foreground inline-flex items-center gap-1"><Gauge className="w-3 h-3"/>Económico</span>
              <span className="font-medium">{avgE}</span>
            </div>
            <div className="h-1.5 w-full rounded bg-warning/20"><div className="h-1.5 rounded bg-warning" style={{ width: `${avgE}%` }} /></div>
          </CardContent>
        </Card>

        {/* KPI Alertas */}
        <Card className="grid-stack-item shadow-elevated" gs-x={6} gs-y={0} gs-w={2} gs-h={2} style={{ height: "100%" }}>
          <CardHeader className="py-2"><CardTitle className="text-sm">Alertas</CardTitle></CardHeader>
          <CardContent className="text-xs flex items-center gap-3">
            <div className="shrink-0 w-[72px] h-[72px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie dataKey="value" data={[{name:'Rojas', value: (derived.red || resumen.rojas)}, {name:'Amarillas', value: (derived.yellow || resumen.amarillas)}]} innerRadius={18} outerRadius={30} paddingAngle={2}>
                    <Cell fill="hsl(var(--destructive))" />
                    <Cell fill="hsl(var(--warning))" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-1">
              <Badge variant="destructive" className="inline-flex items-center gap-1 w-fit"><AlertTriangle className="w-3 h-3"/>{derived.red || resumen.rojas} rojas</Badge>
              <span className="px-2 py-0.5 rounded-full bg-warning text-warning-foreground text-[10px] font-semibold inline-flex items-center gap-1 w-fit"><AlertTriangle className="w-3 h-3"/>{derived.yellow || resumen.amarillas} amarillas</span>
            </div>
					</CardContent>
				</Card>

        {/* Ganador */}
        <Card className="grid-stack-item shadow-elevated bg-gradient-primary text-primary-foreground" gs-x={8} gs-y={4} gs-w={4} gs-h={2} style={{ height: "100%" }}>
          <CardHeader className="py-2"><CardTitle className="text-sm">Ganador recomendado</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-3 text-xs">
						{ganador ? (
              <>
                <div className="h-10 w-10 rounded-full bg-white/20 grid place-items-center shadow-glow"><Trophy className="h-5 w-5" /></div>
                <div className="truncate">
                  <div className="truncate font-medium">{ganador.oferente}</div>
                  <div className="opacity-90">Score <span className="font-semibold">{ganador.score_total}</span></div>
                </div>
              </>
            ) : (
              <p className="opacity-90">Aún no hay ganador.</p>
            )}
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



        {/* Radar comparativo multi-dimensión */}
        <Card className="grid-stack-item shadow-elevated overflow-hidden" gs-x={0} gs-y={11} gs-w={12} gs-h={4} style={{ height: '100%' }}>
          <CardHeader className="py-2"><CardTitle className="text-sm">Comparación avanzada (Radar)</CardTitle></CardHeader>
          <CardContent className="p-3 h-[calc(100%-2.5rem)]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={[
                { dim: 'Legal', ...(rows[0] ? { [rows[0].oferente]: rows[0].legal } : {}), ...(rows[1] ? { [rows[1].oferente]: rows[1].legal } : {}) },
                { dim: 'Técnico', ...(rows[0] ? { [rows[0].oferente]: rows[0].tecnico } : {}), ...(rows[1] ? { [rows[1].oferente]: rows[1].tecnico } : {}) },
                { dim: 'Económico', ...(rows[0] ? { [rows[0].oferente]: rows[0].economico } : {}), ...(rows[1] ? { [rows[1].oferente]: rows[1].economico } : {}) },
              ]}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dim" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                {rows[0] && (
                  <Radar name={rows[0].oferente} dataKey={rows[0].oferente} stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                )}
                {rows[1] && (
                  <Radar name={rows[1].oferente} dataKey={rows[1].oferente} stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.2} />
                )}
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Justificación del Agente – movida a burbuja flotante */}

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
      {/* Burbuja flotante de justificación */}
      {justificacion && showBubble && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
          {showNudge && (
            <div className="mb-2 select-none px-2 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold shadow-glow flex items-center gap-1 animate-pulse">
              <MessageSquare className="w-3 h-3"/>
              Leeme
            </div>
          )}
          <button
            onClick={() => setShowBubble(false)}
            className="mb-2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-primary shadow-glow text-primary-foreground"
            title="Ocultar justificación"
          >
            <MessageSquare className="w-5 h-5"/>
          </button>
          <div className="max-w-[380px] w-[90vw] sm:w-[380px] bg-card text-card-foreground border shadow-elevated rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-xs font-medium">Justificación del Agente</span>
              <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowBubble(false)}>Cerrar</button>
            </div>
            <div className="p-3 text-xs leading-5 max-h-[65vh] flex flex-col gap-2">
              <div className="overflow-auto border rounded p-2 bg-background/50" style={{ maxHeight: '28vh' }}>
                <p className="whitespace-pre-line">{highlightJustificacion(justificacion)}</p>
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Chat</div>
              <div className="flex-1 overflow-auto border rounded p-2 bg-background/50 space-y-2" style={{ maxHeight: '24vh' }}>
                {chatMsgs.length === 0 && (
                  <p className="text-muted-foreground">Haz una pregunta sobre riesgos, RUC, garantías o comparación.</p>
                )}
                {chatMsgs.map((m, i) => (
                  <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
                    <div className={`${m.role==='user'?'bg-primary text-primary-foreground':'bg-muted'} px-2 py-1 rounded max-w-[80%] whitespace-pre-line`}>
                      {m.role === 'assistant' ? renderMarkdownLite(m.content) : m.content}
                    </div>
                  </div>
                ))}
                {chatSending && (
                  <div className="flex justify-start">
                    <div className="bg-muted px-2 py-1 rounded inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/80 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/80 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/80 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={chatText}
                  onChange={(e)=>setChatText(e.target.value)}
                  onKeyDown={(e)=>{ if(e.key==='Enter'&& !e.shiftKey){ e.preventDefault(); onSendChat(); }}}
                  placeholder="Escribe tu pregunta..."
                />
                <Button size="sm" onClick={onSendChat} disabled={chatSending || !chatText.trim()}>Enviar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {!showBubble && justificacion && (
        <button
          onClick={() => setShowBubble(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-primary shadow-glow text-primary-foreground"
          title="Mostrar justificación"
        >
          <MessageSquare className="w-6 h-6"/>
        </button>
      )}
		</div>
	);
}



