import { NavLink, useLocation } from "react-router-dom";
import { 
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Home,
  FilePlus2,
  FileText,
  ShieldCheck,
  Wrench,
  Coins,
  Table2,
  StickyNote,
} from "lucide-react";

const items = [
  { title: "Inicio", url: "/", icon: Home },
  { title: "Nueva licitación", url: "/nueva", icon: FilePlus2 },
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Validaciones", url: "/validaciones", icon: ShieldCheck },
  { title: "Análisis", url: "/analisis", icon: Wrench },
  { title: "Comparativo", url: "/comparativo", icon: Table2 },
  { title: "Tareas", url: "/tareas", icon: StickyNote },
  { title: "Resumen", url: "/resumen", icon: Coins },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-foreground/90";

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>proc-stream</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
