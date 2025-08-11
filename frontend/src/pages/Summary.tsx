import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";

export default function Summary() {
  const { search } = useLocation();
  const lic = useMemo(() => new URLSearchParams(search).get("lic"), [search]);
  const riesgos = [
    { t: "Penalidad no cuantificada", cita: "Pliego p.15" },
    { t: "Tope de reajustes ausente", cita: "Propuesta A p.16" },
    { t: "Cronograma irreal (Hito 3)", cita: "Propuesta B p.7" },
    { t: "Actividad económica no coincide", cita: "SUNAT" },
    { t: "Garantía 12m vs 6m", cita: "Comparativo" },
  ];

  return (
    <div className="space-y-6">
      <SEO title="Resumen ejecutivo | ElicitIA" description="2 páginas con ganador, scores y top 5 riesgos con citas." />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Resumen ejecutivo</h1>
        <Button variant="hero" asChild>
          <a href={lic ? api.resumenPdfUrl(lic) : "#"} target="_blank" rel="noreferrer">Descargar PDF</a>
        </Button>
      </div>

      <Card className="shadow-elevated">
        <CardHeader>
          <CardTitle className="text-base">Ganador recomendado</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>Proveedor A — Score total 93</p>
        </CardContent>
      </Card>

      <Card className="shadow-elevated">
        <CardHeader>
          <CardTitle className="text-base">Top 5 riesgos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc ml-5 space-y-1 text-sm">
            {riesgos.map((r) => (
              <li key={r.t}>{r.t} — <span className="text-muted-foreground">{r.cita}</span></li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
