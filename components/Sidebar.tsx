"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { MODULES_BY_GROUP, GROUPS, type ModuleDef } from "@/lib/modules";
import { getCurrentBulan } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const GROUP_ICONS: Record<string, string> = {
  "Dalam Gedung — Bulanan": "🏢",
  "Dalam Gedung — Harian": "📅",
  Lainnya: "🔬",
};

const GROUP_SHORT: Record<string, string> = {
  "Dalam Gedung — Bulanan": "BULANAN",
  "Dalam Gedung — Harian": "HARIAN",
  Lainnya: "LAINNYA",
};

function NavItem({ item, onClick, badgeCount, isCollapsed }: { item: ModuleDef; onClick: () => void; badgeCount: number; isCollapsed?: boolean }) {
  const pathname = usePathname();
  const href = `/patroli/${item.slug}`;
  const active = pathname === href;

  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onClick}
      title={isCollapsed ? item.title : undefined}
      aria-current={active ? "page" : undefined}
      className={`
        relative flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-[12px] font-medium
        transition-all duration-150 leading-tight
        ${active
          ? "bg-white/20 text-white font-semibold"
          : "text-white/75 hover:bg-white/10 hover:text-white"
        }
        ${isCollapsed ? "justify-center !px-0" : ""}
      `}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-white"
          aria-hidden="true"
        />
      )}
      <span className="text-[14px] flex-shrink-0 w-5 text-center" aria-hidden="true">
        {item.icon}
      </span>
      {!isCollapsed && <span className="truncate flex-1">{item.title}</span>}
      {badgeCount > 0 && !isCollapsed && (
        <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm">
          {badgeCount}
        </span>
      )}
      {badgeCount > 0 && isCollapsed && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
      )}
    </Link>
  );
}

export default function Sidebar(props: SidebarProps) {
  return (
    <Suspense fallback={<aside className="fixed top-0 left-0 z-40 h-full bg-[var(--brand)] w-[240px]" />}>
      <SidebarContent {...props} />
    </Suspense>
  );
}

function SidebarContent({ isOpen, onClose, isCollapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryBulan = searchParams?.get("bulan");
  const bulan = queryBulan || getCurrentBulan();

  const [needsAttentionCounts, setNeedsAttentionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    // 1. Listen for global updates from page.tsx to avoid double fetch delay
    const handleUpdate = (e: any) => {
      const summaries = e.detail.summaries || [];
      const counts: Record<string, number> = {};
      summaries.forEach((s: any) => {
        counts[s.slug] = s.needsAttentionCount || 0;
      });
      setNeedsAttentionCounts(counts);
    };
    window.addEventListener('dashboardUpdate', handleUpdate);

    // 2. Fetch on our own for direct visits to subpages
    fetch(`/api/patrol-data?mode=summary&bulan=${bulan}`)
      .then(res => res.json())
      .then(data => {
        const summaries = data.summaries || [];
        const counts: Record<string, number> = {};
        summaries.forEach((s: any) => {
          counts[s.slug] = s.needsAttentionCount || 0;
        });
        setNeedsAttentionCounts(counts);
      })
      .catch(() => { });

    return () => window.removeEventListener('dashboardUpdate', handleUpdate);
  }, [bulan]);

  return (
    <aside
      className={`
        fixed top-0 left-0 z-40 h-full flex flex-col
        transition-all duration-300 ease-in-out bg-[var(--brand)] dark:bg-[var(--brand-dark)]
        ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        ${isCollapsed ? "w-[72px]" : "w-[240px]"}
      `}
      aria-label="Sidebar navigasi"
    >
      {/* Branding */}
      <div
        className="flex items-center gap-2 px-3 py-3.5 border-b"
        style={{ borderColor: "rgba(255,255,255,0.15)" }}
      >
        <div className={`flex-shrink-0 flex items-center bg-white rounded-lg p-1 ${isCollapsed ? "mx-auto" : ""}`}>
          <Image
            src="/K3_logo.png"
            alt="K3"
            width={34}
            height={30}
            className="object-contain"
          />
        </div>
        {!isCollapsed && (
          <div className="flex-1 flex flex-col justify-center gap-1 overflow-hidden">
            <Image
              src="/RSOMH_logo.png"
              alt="RSOMH"
              width={100}
              height={30}
              className="object-contain filter brightness-0 invert"
            />
          </div>
        )}
        <button
          onClick={onClose}
          className="md:hidden flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Tutup sidebar"
        >
          ✕
        </button>
        {/* Desktop Toggle Button */}
        <button
          onClick={onToggleCollapse}
          className={`hidden md:flex flex-shrink-0 w-7 h-7 rounded-lg items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors ${isCollapsed ? "absolute -right-3.5 top-5 bg-white shadow-md border text-[var(--brand)] hover:text-[var(--brand-dark)] hover:bg-gray-50 z-50 rounded-full" : ""}`}
          aria-label="Toggle Sidebar"
        >
          {isCollapsed ? "▶" : "◀"}
        </button>
      </div>

      {/* Home link */}
      <div className="px-2 pt-2">
        <Link
          href="/"
          onClick={onClose}
          title={isCollapsed ? "Dashboard" : undefined}
          aria-current={pathname === "/" ? "page" : undefined}
          className={`
            flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-semibold
            transition-all duration-150
            ${pathname === "/"
              ? "bg-white/20 text-white"
              : "text-white/75 hover:bg-white/10 hover:text-white"
            }
            ${isCollapsed ? "justify-center !px-0 mx-2" : ""}
          `}
        >
          <span className="text-[14px] w-5 text-center flex-shrink-0">🏠</span>
          {!isCollapsed && <span>Dashboard</span>}
        </Link>
        <Link
          href="/temuan"
          onClick={onClose}
          title={isCollapsed ? "Temuan & Keluhan" : undefined}
          aria-current={pathname === "/temuan" ? "page" : undefined}
          className={`
            mt-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-semibold
            transition-all duration-150
            ${pathname === "/temuan"
              ? "bg-white/20 text-white"
              : "text-white/75 hover:bg-white/10 hover:text-white"
            }
            ${isCollapsed ? "justify-center !px-0 mx-2" : ""}
          `}
        >
          <span className="text-[14px] w-5 text-center flex-shrink-0">🚨</span>
          {!isCollapsed && <span>Rekap Temuan</span>}
        </Link>
      </div>

      {/* Nav groups */}
      <nav
        className="flex-1 overflow-y-auto py-1 space-y-0.5"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.2) transparent" }}
        aria-label="Navigasi topik patroli"
      >
        {GROUPS.map((group) => {
          const items = MODULES_BY_GROUP[group];
          return (
            <div key={group} className="mb-1">
              {/* Group label */}
              {!isCollapsed ? (
                <p
                  className="px-4 pt-3 pb-1 text-[9px] font-bold tracking-[0.12em] uppercase"
                  style={{ color: "rgba(255,255,255,0.40)" }}
                >
                  {GROUP_ICONS[group]} {GROUP_SHORT[group]}
                </p>
              ) : (
                <div className="w-full flex justify-center pt-3 pb-1" title={group}>
                  <span className="text-[12px] opacity-60">{GROUP_ICONS[group]}</span>
                </div>
              )}
              {items.map((item) => (
                <NavItem
                  key={item.slug}
                  item={item}
                  onClick={onClose}
                  badgeCount={needsAttentionCounts[item.slug] || 0}
                  isCollapsed={isCollapsed}
                />
              ))}
            </div>
          );
        })}

        {/* Divider */}
        <div
          className="mx-4 my-2 border-t"
          style={{ borderColor: "rgba(255,255,255,0.12)" }}
        />

        {/* Form link */}
        <a
          href="https://forms.gle/C9YZAJLHjAZMdnHY8"
          target="_blank"
          rel="noopener noreferrer"
          title={isCollapsed ? "Isi Form Patroli" : undefined}
          className={`flex items-center gap-2 mx-4 mb-2 px-3 py-2 rounded-lg text-[12px] font-bold bg-white text-[var(--brand)] hover:bg-gray-100 transition-all duration-150 ${isCollapsed ? "justify-center !px-0 mx-2" : "justify-center"}`}
        >
          <span>📝</span>
          {!isCollapsed && <span>Isi Form Patroli</span>}
        </a>

        {/* Settings link */}
        <Link
          href="/settings"
          onClick={onClose}
          title={isCollapsed ? "Pengaturan" : undefined}
          className={`flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-[12px] font-medium text-white/60 hover:bg-white/10 hover:text-white transition-all duration-150 ${isCollapsed ? "justify-center !px-0" : ""}`}
        >
          <span className="text-[14px] w-5 text-center flex-shrink-0">⚙️</span>
          {!isCollapsed && <span>Pengaturan</span>}
        </Link>
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div
          className="px-4 py-2.5 border-t"
          style={{ borderColor: "rgba(255,255,255,0.12)" }}
        >
          <p className="text-[10px] text-center" style={{ color: "rgba(255,255,255,0.35)" }}>
            K3 Dashboard v1.0 · 2026 RSOMH
          </p>
        </div>
      )}
    </aside>
  );
}
