import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function Documents() {
  const [open, setOpen] = useState(true);
  return (
    <div className="space-y-6">
      <SEO title="Documentos | ElicitIA" description="Visor con índice de secciones y tabs de resumen, texto y metadatos." />
      <h1 className="text-2xl font-semibold">Documentos</h1>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Funcionalidad en desarrollo</AlertDialogTitle>
            <AlertDialogDescription>
              Esta sección permitirá previsualizar pliegos y propuestas, resaltar secciones clave (garantías, multas, plazos, anexos), y navegar por hallazgos detectados con enlaces al texto original. Próximamente podrás comparar versiones y reclasificar secciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
            <AlertDialogAction>Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 space-y-3">
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="text-base">Secciones detectadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                "Legal",
                "Técnico",
                "Económico",
                "Anexos",
                "Garantías",
                "Penalidades",
                "Cronograma",
                "Hitos",
              ].map((s) => (
                <div key={s} className="flex items-center justify-between">
                  <span>{s}</span>
                  <Button size="sm" variant="ghost">Ver</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-9 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Select>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Pliego" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pliego">Pliego</SelectItem>
                  <SelectItem value="a">Propuesta A</SelectItem>
                  <SelectItem value="b">Propuesta B</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">Reclasificar sección</Button>
              <Badge variant="secondary">OCR Alto</Badge>
            </div>
          </div>

          <Card className="shadow-elevated">
            <CardContent className="p-0">
              <Tabs defaultValue="resumen" className="w-full">
                <TabsList className="m-3">
                  <TabsTrigger value="resumen">Resumen</TabsTrigger>
                  <TabsTrigger value="texto">Texto extraído</TabsTrigger>
                  <TabsTrigger value="metadatos">Metadatos</TabsTrigger>
                </TabsList>
                <TabsContent value="resumen" className="p-4">
                  <div className="h-[420px] grid place-items-center text-sm text-muted-foreground">
                    <div className="text-center">
                      <Skeleton className="h-64 w-80 mb-4" />
                      <p>Visor PDF (placeholder). Resaltado de bloques y chips de tipo por venir.</p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="texto" className="p-4 text-sm text-muted-foreground">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-6 w-2/3 mb-2" />
                  <Skeleton className="h-6 w-1/2" />
                </TabsContent>
                <TabsContent value="metadatos" className="p-4 text-sm">
                  <ul className="list-disc ml-5 space-y-1">
                    <li>Tipo: Pliego</li>
                    <li>Páginas: 42</li>
                    <li>Autor: SIAF</li>
                  </ul>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="text-sm text-destructive-foreground bg-destructive/10 rounded-md p-3">
            Error de ejemplo: No se pudo extraer la página 7.
            <Button size="sm" variant="destructive" className="ml-2">Reintentar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
