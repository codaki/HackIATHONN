import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import NewTenderWizard from "./pages/NewTenderWizard";
import Compare from "./pages/Compare";
import Documents from "./pages/Documents";
import Validations from "./pages/Validations";
import Analysis from "./pages/Analysis";
import Tasks from "./pages/Tasks";
import Summary from "./pages/Summary";
import Dashboard from "./pages/Dashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/nueva" element={<NewTenderWizard />} />
            <Route path="/documentos" element={<Documents />} />
            <Route path="/validaciones" element={<Validations />} />
            <Route path="/analisis" element={<Analysis />} />
            <Route path="/comparativo" element={<Compare />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tareas" element={<Tasks />} />
            <Route path="/resumen" element={<Summary />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
