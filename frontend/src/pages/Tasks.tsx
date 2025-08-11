import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const data = {
  abierto: [
    { t: "Penalidad no cuantificada", sev: "Roja", doc: "Pliego", pagina: 12, asig: "María" },
    { t: "Cronograma irreal", sev: "Amarilla", doc: "Propuesta A", pagina: 7, asig: "Carlos" },
  ],
  revision: [
    { t: "Actividad vs objeto", sev: "Roja", doc: "Proveedor B", pagina: 0, asig: "Ana" },
  ],
  resuelto: [
    { t: "Garantía 12m vs 6m", sev: "Amarilla", doc: "Comparativo", pagina: 0, asig: "Equipo" },
  ],
};

function Col({ title, items }: { title: string; items: any[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {items.map((i, idx) => (
        <Card key={idx} className="shadow-elevated">
          <CardHeader>
            <CardTitle className="text-base">{i.t}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>{i.sev} – {i.doc} p.{i.pagina}</p>
            <p>Asignado a: {i.asig}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Tasks() {
  return (
    <div className="space-y-6">
      <SEO title="Tareas | ElicitIA" description="Kanban simplificado para colaboración mínima entre áreas." />
      <h1 className="text-2xl font-semibold">Tareas</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Col title="Abierto" items={data.abierto} />
        <Col title="En revisión" items={data.revision} />
        <Col title="Resuelto" items={data.resuelto} />
      </div>
    </div>
  );
}
