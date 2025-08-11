import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const legal = [
  { titulo: "Garantías", estado: "ok", razon: "",
    cita: "pág. 12", confianza: 0.92 },
  { titulo: "Penalidades", estado: "warn", razon: "No cuantificada",
    cita: "pág. 15", confianza: 0.71 },
  { titulo: "Terminación", estado: "bad", razon: "Causal abierta",
    cita: "pág. 20", confianza: 0.62 },
];

const tecnico = [
  { titulo: "Cronograma", estado: "warn", razon: "Hito irreal",
    cita: "pág. 7", confianza: 0.66 },
  { titulo: "SLA", estado: "ok", razon: "",
    cita: "pág. 5", confianza: 0.88 },
];

const economico = [
  { titulo: "Anticipo", estado: "ok", razon: "",
    cita: "pág. 11", confianza: 0.83 },
  { titulo: "Reajustes", estado: "warn", razon: "Tope ausente",
    cita: "pág. 16", confianza: 0.69 },
];

function Pill({ s }: { s: "ok" | "warn" | "bad" }) {
  const cls = s === "ok" ? "bg-success text-success-foreground" : s === "warn" ? "bg-warning text-warning-foreground" : "bg-destructive text-destructive-foreground";
  const label = s === "ok" ? "Verde" : s === "warn" ? "Amarillo" : "Rojo";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

function Cards({ items }: { items: { titulo: string; estado: any; razon: string; cita: string; confianza: number; }[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((i) => (
        <Card key={i.titulo} className="shadow-elevated">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              {i.titulo}
              <Pill s={i.estado} />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {i.razon && <p className="text-muted-foreground">Razón: {i.razon}</p>}
            <p>Confianza del modelo: {(i.confianza * 100).toFixed(0)}%</p>
            <p>Cita: {i.cita}</p>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="secondary">Marcar como revisado</Button>
              <Button size="sm" variant="outline">Sugerir redacción</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Analysis() {
  return (
    <div className="space-y-6">
      <SEO title="Análisis | ElicitIA" description="Tarjetas por criterio con estado, razón, cita y acciones rápidas." />
      <h1 className="text-2xl font-semibold">Análisis</h1>
      <Tabs defaultValue="legal">
        <TabsList>
          <TabsTrigger value="legal">Legal</TabsTrigger>
          <TabsTrigger value="tecnico">Técnico</TabsTrigger>
          <TabsTrigger value="economico">Económico</TabsTrigger>
        </TabsList>
        <TabsContent value="legal"><Cards items={legal} /></TabsContent>
        <TabsContent value="tecnico"><Cards items={tecnico} /></TabsContent>
        <TabsContent value="economico"><Cards items={economico} /></TabsContent>
      </Tabs>
    </div>
  );
}
