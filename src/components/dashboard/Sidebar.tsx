import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, Radio, GraduationCap, Tag, MapPin, ShoppingCart, User, ChevronLeft, ChevronRight, Settings, GitMerge, Users, DollarSign, Megaphone, Search } from "lucide-react";

type Item = { to: string; label: string; icon: any; badge?: string };
type Section = { title: string | null; items: Item[] };

const sections: Section[] = [
  {
    title: null,
    items: [
      { to: "/", label: "Visão Geral", icon: LayoutDashboard },
    ],
  },
  {
    title: "Resultados",
    items: [
      { to: "/vendas", label: "Vendas", icon: ShoppingCart },
      { to: "/leads", label: "Leads", icon: Users },
      { to: "/turmas", label: "Turmas", icon: GraduationCap },
      { to: "/geografia", label: "Geografia", icon: MapPin },
    ],
  },
  {
    title: "Marketing",
    items: [
      { to: "/canais", label: "Canais", icon: Radio },
      { to: "/atribuicao", label: "Atribuição", icon: GitMerge },
      { to: "/utms", label: "Campanhas", icon: Tag },
    ],
  },
  {
    title: "Mídia Paga",
    items: [
      { to: "/midia", label: "Mídia Unificada", icon: DollarSign },
      { to: "/meta-ads", label: "Meta Ads", icon: Megaphone },
      { to: "/google-ads", label: "Google Ads", icon: Search },
    ],
  },
  {
    title: "Admin",
    items: [
      { to: "/admin/cadastros", label: "Cadastros", icon: Settings },
      { to: "/conta", label: "Minha conta", icon: User },
    ],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar_collapsed") === "1";
  });

  useEffect(() => {
    const w = collapsed ? "4rem" : "15rem";
    document.documentElement.style.setProperty("--app-sidebar-w", w);
    try { localStorage.setItem("sidebar_collapsed", collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 border-r border-border bg-[var(--sidebar-bg)] flex flex-col transition-[width] duration-200"
      style={{ width: collapsed ? "4rem" : "15rem" }}
    >
      <div className={`${collapsed ? "px-2" : "px-6"} py-5 border-b border-border flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2`}>
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="size-8 shrink-0 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white">
            F
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="font-semibold text-sm tracking-tight truncate">Febracis</div>
              <div className="text-[11px] text-muted-foreground -mt-0.5 truncate">MKT Attribution</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="size-7 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center"
            title="Recolher"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-2 mt-2 h-8 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center"
          title="Expandir"
        >
          <ChevronRight className="size-4" />
        </button>
      )}

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
        {sections.map((sec, idx) => (
          <div key={idx} className="space-y-1">
            {!collapsed && sec.title && (
              <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">{sec.title}</div>
            )}
            {collapsed && idx > 0 && <div className="mx-2 my-1 h-px bg-border/50" />}
            {sec.items.map(({ to, label, icon: Icon, badge }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                activeProps={{ className: "bg-primary/15 text-foreground border border-primary/30" }}
                inactiveProps={{ className: "text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent" }}
                className={`flex items-center ${collapsed ? "justify-center px-0" : "gap-3 px-3"} py-2 rounded-md text-sm font-medium transition-colors`}
                title={collapsed ? label : undefined}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && (
                  <span className="truncate flex-1 flex items-center gap-2">
                    {label}
                    {badge && <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary font-semibold">{badge}</span>}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="px-6 py-3 text-[11px] text-muted-foreground border-t border-border">
          v1.0 · 2026
        </div>
      )}
    </aside>
  );
}
