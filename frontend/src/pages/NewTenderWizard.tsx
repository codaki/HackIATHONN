import { useState, useRef, useEffect } from "react";
import { FileText, Search, Cog, ShieldCheck, CheckCircle2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import api, { Hallazgo } from "@/lib/api";
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
  const stages = [
    "Preparando entorno de análisis...",
    "Extrayendo texto de los PDFs...",
    "Indexando el pliego como base...",
    "Comparando propuestas con el pliego...",
    "Analizando riesgos legales...",
    "Evaluando criterios técnicos...",
    "Evaluando criterios económicos...",
    "Buscando inconsistencias...",
    "Validando RUCs en SRI...",
    "Calculando puntajes y ganador...",
  ];
  const [aniMsg, setAniMsg] = useState(0);
  const [aniProg, setAniProg] = useState(0);
  const [dots, setDots] = useState(0);

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
    mutationFn: async () => { if (!licId) throw new Error("Falta licitación");
      // Solicitar permiso de notificación antes de lanzar el análisis
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch { /* no-op */ }
      }
      return api.analizar(licId);
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["licitaciones"] });
      // Notificación push según riesgos detectados
      try {
        if (licId && typeof Notification !== "undefined" && Notification.permission === "granted") {
          const [resumen, hall] = await Promise.all([
            api.resumen(licId),
            api.hallazgos(licId)
          ]);
          const items = (hall?.items as Hallazgo[] | undefined) || [];
          let rojas = 0, amarillas = 0;
          for (const it of items) {
            const s = String((it.severity || "")).toUpperCase();
            if (["ALTO","ROJO","HIGH"].includes(s)) rojas++;
            else if (["MEDIO","AMARILLO","MEDIUM"].includes(s)) amarillas++;
          }
          const title = rojas > 0 ? "Riesgos críticos detectados" : "Análisis finalizado";
          const body = rojas > 0
            ? `Se detectaron ${rojas} rojas y ${amarillas} amarillas.`
            : `Sin rojas. Amarillas: ${amarillas}. Progreso: ${resumen?.progreso ?? 100}%`;
          new Notification(title, { body });
        }
      } catch { /* no-op */ }
      if (licId) navigate(`/dashboard?lic=${licId}`);
    },
  });

  useEffect(() => {
    if (!analizar.isPending) { setAniMsg(0); setAniProg(0); return; }
    const t1 = setInterval(() => setAniMsg((i) => (i + 1) % stages.length), 2500);
    const t2 = setInterval(() => setAniProg((p) => (p >= 95 ? 95 : p + 3)), 250);
    const t3 = setInterval(() => setDots((d) => (d + 1) % 4), 400);
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); };
  }, [analizar.isPending]);

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
      </header>

      {/* Stepper estilo timeline */}
      <div className="mt-1 w-full flex justify-center">
        <div className="w-full max-w-4xl flex items-center justify-between gap-0">
        {(["Parámetros","Documentos","Confirmación"]).map((label, idx) => {
          const s = idx + 1; const done = s < step; const current = s === step;
          return (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center min-w-[88px]">
                <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${done||current?"border-primary bg-primary/10":"border-border"}`}>
                  <div className={`h-3 w-3 rounded-full ${done?"bg-primary":current?"bg-primary/70":"bg-muted-foreground/20"}`} />
                </div>
                <span className="text-[11px] mt-1 text-muted-foreground">{label}</span>
              </div>
              {idx < 2 && (
                <div className={`flex-1 h-[2px] mx-8 ${s < step?"bg-primary":"bg-border"}`} />
              )}
            </div>
          );
        })}
        </div>
      </div>

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
              
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer de acciones del wizard */}
      <div className="sticky bottom-0 z-20 border-t bg-background/80 glass mt-4">
        <div className="flex items-center justify-between p-3">
          <span className="text-xs text-muted-foreground">Paso {step} de 3</span>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>Atrás</Button>
            )}
            {step < 3 ? (
              <Button onClick={() => (step === 1 ? crear.mutate() : setStep((s) => s + 1))} disabled={crear.isPending}>
                {step === 1 ? (crear.isPending ? "Creando..." : "Crear") : "Siguiente"}
              </Button>
            ) : (
              <Button variant="hero" onClick={() => analizar.mutate()} disabled={analizar.isPending || !licId}>
                {analizar.isPending ? "Analizando..." : "Iniciar análisis"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {analizar.isPending && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm">
          <Card className="shadow-elevated w-[680px]">
            <CardHeader>
              <CardTitle className="text-base">Analizando documentos...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5 text-sm">
                {/* Hilera de iconos animados */}
                <div className="flex items-center justify-center gap-6 text-muted-foreground">
                  {[
                    FileText,
                    Search,
                    Cog,
                    ShieldCheck,
                    CheckCircle2,
                  ].map((Icon, idx) => {
                    const active = (aniMsg % 5) === idx;
                    return (
                      <div key={idx} className={`transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
                        <Icon className={`h-8 w-8 ${active ? "animate-pulse" : "opacity-70"}`} />
                      </div>
                    );
                  })}
                </div>
                <p className="text-muted-foreground">
                  {stages[aniMsg]}{""}
                  <span className="inline-block w-6 text-left">{".".repeat(dots)}</span>
                </p>
                <p className="text-xs text-muted-foreground">Esto puede tomar 30–60s según el tamaño de los PDFs.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
