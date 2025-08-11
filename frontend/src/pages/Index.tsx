import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api, { LicResumen } from "@/lib/api";

type Row = LicResumen & { dueno?: string; categoria?: string };

function EtapaBadge({ etapa }: { etapa: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    Ingesta: { label: "Ingesta", cls: "bg-accent text-accent-foreground" },
    "Análisis": { label: "Análisis", cls: "bg-info text-info-foreground" },
    Comparativo: { label: "Comparativo", cls: "bg-warning text-warning-foreground" },
    "Aprobación": { label: "Aprobación", cls: "bg-success text-success-foreground" },
  };
  const cfg = map[etapa] ?? map["Ingesta"];
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>;
}

export default function Index() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["licitaciones"],
    queryFn: api.listarLicitaciones,
  });
  const procesos: Row[] = (data || []).map((x) => ({ ...x }));
  return (
    <div className="space-y-6">
      <SEO title="Mis licitaciones | ElicitIA" description="Explora tus procesos, filtra por estado y actúa rápido sobre lo que importa." />

      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mis licitaciones</h1>
          <p className="text-sm text-muted-foreground">Estado de cada proceso y acceso rápido.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate("/comparativo")}>Ver comparativo</Button>
          <Button variant="hero" onClick={() => navigate("/nueva")}>Nueva licitación</Button>
        </div>
      </header>

      <Card className="shadow-elevated">
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-sm mb-1 block">Estado</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ingesta">Ingesta</SelectItem>
                  <SelectItem value="analisis">Análisis</SelectItem>
                  <SelectItem value="comparativo">Comparativo</SelectItem>
                  <SelectItem value="aprobacion">Aprobación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm mb-1 block">Categoría</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="obras">Obras</SelectItem>
                  <SelectItem value="bienes">Bienes</SelectItem>
                  <SelectItem value="servicios">Servicios</SelectItem>
                  <SelectItem value="ti">TI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm mb-1 block">Dueño</label>
              <Input placeholder="Nombre" />
            </div>
            <div>
              <label className="text-sm mb-1 block">Fecha límite</label>
              <Input type="date" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-elevated">
        <CardHeader>
          <CardTitle className="text-base">Procesos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Avance</TableHead>
                <TableHead>Alertas</TableHead>
                <TableHead>Fecha límite</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-sm text-muted-foreground">Cargando...</TableCell>
                </TableRow>
              )}
              {isError && (
                <TableRow>
                  <TableCell colSpan={7} className="text-sm text-destructive-foreground">Error al cargar</TableCell>
                </TableRow>
              )}
              {procesos.map((p) => (
                <TableRow key={p.id} className="align-middle">
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell><EtapaBadge etapa={p.etapa} /></TableCell>
                  <TableCell className="min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <Progress value={p.progreso} />
                      <span className="text-xs text-muted-foreground w-10 text-right">{p.progreso}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Badge variant="destructive">{p.rojas ?? 0} rojas</Badge>
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-warning text-warning-foreground">{p.amarillas ?? 0} amarillas</span>
                    </div>
                  </TableCell>
                  <TableCell>{p.deadline ? new Date(p.deadline).toLocaleDateString() : "-"}</TableCell>
                  <TableCell>{p.responsables?.[0] || "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => navigate("/tareas")}>Pendientes</Button>
                      <Button onClick={() => navigate(`/dashboard?lic=${p.id}`)}>Abrir</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && procesos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-sm text-muted-foreground">Sin licitaciones todavía. Crea una nueva.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="shadow-elevated">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">¿No ves lo que buscas?</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Button variant="secondary" onClick={() => navigate("/documentos")}>Reanudar último</Button>
            <Button variant="hero" onClick={() => navigate("/nueva")}>Crear nueva</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
