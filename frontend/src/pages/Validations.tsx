import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Validations() {
  const requisitos = [
    { label: "Firmas y fechas", status: "ok" },
    { label: "Anexos obligatorios", status: "warn" },
    { label: "Vigencias", status: "ok" },
  ];
  const proveedor = [
    { label: "RUC activo", status: "ok" },
    { label: "Actividad vs objeto", status: "bad" },
  ];

  const pill = (status: string) =>
    status === "ok"
      ? "bg-success text-success-foreground"
      : status === "warn"
      ? "bg-warning text-warning-foreground"
      : "bg-destructive text-destructive-foreground";

  return (
    <div className="space-y-6">
      <SEO title="Validaciones | proc-stream" description="Checklist de requisitos formales y verificación de proveedor." />
      <h1 className="text-2xl font-semibold">Validaciones</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="text-base">Requisitos formales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {requisitos.map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span>{r.label}</span>
                <span className={`px-2 py-0.5 rounded-full ${pill(r.status)}`}>
                  {r.status === "ok" ? "✓" : r.status === "warn" ? "Parcial" : "✗"}
                </span>
              </div>
            ))}
            <div className="pt-2">
              <Button variant="outline">Ver en documento</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="text-base">Proveedor (RUC)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {proveedor.map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span>{r.label}</span>
                <span className={`px-2 py-0.5 rounded-full ${pill(r.status)}`}>
                  {r.status === "ok" ? "Verde" : r.status === "warn" ? "Amarillo" : "Rojo"}
                </span>
              </div>
            ))}
            <div className="pt-2">
              <Button variant="outline">Ver en documento</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
