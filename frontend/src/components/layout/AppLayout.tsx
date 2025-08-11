import { PropsWithChildren } from "react";
import { HelmetProvider } from "react-helmet-async";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";

export default function AppLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <HelmetProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-20 border-b bg-background/80 glass">
            <div className="flex h-14 items-center gap-3 px-4">
              <SidebarTrigger />
              <div className="flex-1 max-w-2xl">
                <Input placeholder="Buscar por texto, proveedor o RUC" aria-label="Buscador global" />
              </div>
              <Button variant="hero" onClick={() => navigate("/nueva")}>Nueva licitación</Button>
            </div>
          </header>
          <main className="p-4 md:p-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </HelmetProvider>
  );
}
