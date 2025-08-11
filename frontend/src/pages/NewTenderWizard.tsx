import { useState, useRef } from "react";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import api from "@/lib/api";
import { parseMoney } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

export default function NewTenderWizard() {
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [licId, setLicId] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const presRef = useRef<HTMLInputElement>(null);
  const wLegalRef = useRef<HTMLInputElement>(null);
  const wTecRef = useRef<HTMLInputElement>(null);
  const wEcoRef = useRef<HTMLInputElement>(null);
  const pliegoRef = useRef<HTMLInputElement>(null);
  const propsRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const docsQuery = useQuery({
    queryKey: ["docs", licId],
    queryFn: () => api.listarDocumentos(licId as string),
    enabled: !!licId,
  });

  const crear = useMutation({
    mutationFn: async () => {
      const nombre = nameRef.current?.value?.trim() || "Proceso sin nombre";
      const presupuesto = parseMoney(presRef.current?.value || "");
      const pesos = {
        legal: Number(wLegalRef.current?.value || 35),
        tecnico: Number(wTecRef.current?.value || 40),
        economico: Number(wEcoRef.current?.value || 25),
      };
      return api.crearLicitacion({ nombre, objeto: "", presupuesto: presupuesto ?? undefined, pesos, normativa: [], deadline: null });
    },
    onSuccess: (res) => {
      setLicId(res.id);
      qc.invalidateQueries({ queryKey: ["licitaciones"] });
      setStep(2);
    },
  });

  const subir = useMutation({
    mutationFn: async () => {
      if (!licId) throw new Error("Falta licitación");
      const p = pliegoRef.current?.files?.[0];
      const m = propsRef.current?.files;
      if (!p && (!m || m.length === 0)) throw new Error("Seleccione PDFs");
      if (p) await api.subirDocumentos(licId, [p], true, "pliego");
      if (m && m.length) await api.subirDocumentos(licId, Array.from(m), true, "propuesta");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docs", licId] });
    }
  });

  const analizar = useMutation({
    mutationFn: async () => { if (!licId) throw new Error("Falta licitación"); return api.analizar(licId); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["licitaciones"] });
      if (licId) navigate(`/dashboard?lic=${licId}`);
    },
  });

  const simulateUpload = async () => {
    setUploading(true);
    setProgress(0);
    const id = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(id);
          setUploading(false);
          return 100;
        }
        return p + 10;
      });
    }, 300);
    try {
      await subir.mutateAsync();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <SEO title="Nueva licitación | ElicitIA" description="Configura parámetros, sube documentos y confirma para iniciar el análisis." />

      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Nueva licitación</h1>
          <p className="text-sm text-muted-foreground">Wizard de 3 pasos</p>
        </div>
        <div className="flex gap-2">
          {step > 1 && (
            <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>Atrás</Button>
          )}
          {step < 3 ? (
            <Button onClick={() => (step === 1 ? crear.mutate() : setStep((s) => s + 1))} disabled={crear.isPending}>
              {step === 1 ? (crear.isPending ? "Creando..." : "Crear") : "Siguiente"}
            </Button>
          ) : (
            <Button variant="hero">Iniciar análisis</Button>
          )}
        </div>
      </header>

      {step === 1 && (
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="text-base">Paso 1 – Parámetros básicos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm mb-1 block">Nombre</label>
                 <Input placeholder="Ej. Adquisición de equipos" ref={nameRef} />
              </div>
              <div>
                <label className="text-sm mb-1 block">Presupuesto referencial (USD)</label>
                 <Input type="number" placeholder="100000" ref={presRef} />
              </div>
              <div>
                <label className="text-sm mb-1 block">Peso Legal (%)</label>
                 <Input type="number" defaultValue={35} ref={wLegalRef} />
              </div>
              <div>
                <label className="text-sm mb-1 block">Peso Técnico (%)</label>
                 <Input type="number" defaultValue={40} ref={wTecRef} />
              </div>
              <div>
                <label className="text-sm mb-1 block">Peso Económico (%)</label>
                 <Input type="number" defaultValue={25} ref={wEcoRef} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm mb-1 block">Normativa aplicable</label>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" /> LOEPS
                  </label>
                  <label className="flex items-center gap-2"><input type="checkbox" /> Directiva interna
                  </label>
                  <label className="flex items-center gap-2"><input type="checkbox" /> Otras
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="text-base">Paso 2 – Carga de documentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border-dashed border rounded-lg p-6 text-center">
                <p className="text-sm mb-2">Pliego (PDF)</p>
                 <Input type="file" accept="application/pdf" ref={pliegoRef} />
              </div>
              <div className="border-dashed border rounded-lg p-6 text-center">
                <p className="text-sm mb-2">Propuestas (2–3 PDF)</p>
                 <Input type="file" multiple accept="application/pdf" ref={propsRef} />
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">OCR y clasificación</span>
                <Button size="sm" onClick={simulateUpload} disabled={uploading || subir.isPending}>{subir.isPending ? "Subiendo..." : "Procesar"}</Button>
              </div>
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground mt-1">{uploading ? "Procesando..." : progress === 100 ? "Listo" : "En espera"}</p>
              {!!docsQuery.data?.items?.length && (
                <div className="mt-3 text-sm">
                  <p className="mb-2 text-muted-foreground">Archivos subidos</p>
                  <div className="space-y-1">
                    {docsQuery.data.items.map((f) => (
                      <div key={`${f.type}-${f.file}`} className="flex items-center justify-between">
                        <span>{f.file} <span className="text-muted-foreground">({f.type})</span></span>
                        <span className="px-2 py-0.5 rounded-full bg-success text-success-foreground">Listo</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="text-base">Paso 3 – Confirmación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {docsQuery.isLoading && <p className="text-muted-foreground">Cargando archivos...</p>}
              {!docsQuery.isLoading && (!docsQuery.data?.items?.length ? (
                <p className="text-muted-foreground">Sin archivos. Vuelve al paso 2 para subir.</p>
              ) : (
                docsQuery.data.items.map((f) => (
                  <div key={`${f.type}-${f.file}`} className="flex items-center justify-between">
                    <span>{f.file} <span className="text-muted-foreground">({f.type})</span></span>
                    <span className="px-2 py-0.5 rounded-full bg-success text-success-foreground">Listo</span>
                  </div>
                ))
              ))}
              <div className="pt-2">
                <Button variant="hero" onClick={() => analizar.mutate()} disabled={analizar.isPending || !licId}>{analizar.isPending ? "Analizando..." : "Iniciar análisis"}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
