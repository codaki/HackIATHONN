import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";

function useQueryParam(name: string) {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get(name), [search, name]);
}

function total(o: any) { return Number(o.legal) + Number(o.tecnico) + Number(o.economico); }

export default function Compare() {
  const lic = useQueryParam("lic");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["comparativo", lic],
    queryFn: () => api.comparativo(lic || ""),
    enabled: !!lic,
  });
  const oferentes = data?.items || [];
  const ganador = data?.ganador || null;
  return (
    <div className="space-y-6">
      <SEO title="Comparativo | ElicitIA" description="Matriz de evaluación por criterios y ganador recomendado." />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Comparativo</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline">Exportar PDF</Button>
          <Button variant="outline">Exportar Excel</Button>
        </div>
      </div>

      <Card className="shadow-elevated">
          <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Resultado
            {ganador && <Badge variant="secondary">Ganador recomendado: {ganador.oferente || ganador.nombre}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Oferente</TableHead>
                  <TableHead>Cumple mínimos</TableHead>
                  <TableHead>Legal (35)</TableHead>
                  <TableHead>Técnico (40)</TableHead>
                  <TableHead>Económico (25)</TableHead>
                  <TableHead>Score total</TableHead>
                  <TableHead>Rojas</TableHead>
                  <TableHead>Amarillas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-sm text-muted-foreground">Cargando...</TableCell>
                  </TableRow>
                )}
                {isError && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-sm text-destructive-foreground">Error al cargar</TableCell>
                  </TableRow>
                )}
                {oferentes.map((o: any, idx: number) => (
                  <TableRow key={(o.oferente || o.nombre || idx)}>
                    <TableCell className="font-medium">{o.oferente || o.nombre || `Oferente ${idx+1}`}</TableCell>
                    <TableCell>{o.cumple_minimos ? "Sí" : "No"}</TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger className="underline decoration-dotted">{o.legal}</TooltipTrigger>
                        <TooltipContent>¿Cómo se calculó? Subcriterios: Cláusulas críticas, garantías, sanciones.</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger className="underline decoration-dotted">{o.tecnico}</TooltipTrigger>
                        <TooltipContent>¿Cómo se calculó? Subcriterios: Especificaciones, cronograma, equipo.</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger className="underline decoration-dotted">{o.economico}</TooltipTrigger>
                        <TooltipContent>¿Cómo se calculó? Anticipos, retenciones, reajustes.</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="font-semibold">{o.score_total ?? total(o)}</TableCell>
                    <TableCell><Badge variant="destructive">{o.rojas}</Badge></TableCell>
                    <TableCell><span className="px-2 py-0.5 rounded-full bg-warning text-warning-foreground text-xs font-semibold">{o.amarillas}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
}
