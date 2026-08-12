"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle({ 
  isCollapsed,
  variant = "sidebar"
}: { 
  isCollapsed?: boolean;
  variant?: "sidebar" | "settings";
}) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-5 h-5 mx-auto" />; // placeholder to prevent layout shift
  }

  if (variant === "settings") {
    return (
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="px-4 py-2 rounded-lg font-medium text-sm border-2 transition-all hover:-translate-y-0.5 hover:shadow-md flex items-center gap-2"
        style={{ borderColor: "#9e9e9e", background: "white", color: "#424242" }}
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        {theme === "dark" ? "Mode Terang" : "Mode Gelap"}
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={`flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-[12px] font-medium text-white/60 hover:bg-white/10 hover:text-white transition-all duration-150 w-[calc(100%-1rem)] text-left ${isCollapsed ? 'justify-center !px-0' : ''}`}
      aria-label="Toggle Dark Mode"
      title={isCollapsed ? (theme === "dark" ? "Mode Terang" : "Mode Gelap") : undefined}
    >
      <span className="flex-shrink-0 w-5 flex justify-center">
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
      </span>
      {!isCollapsed && <span>{theme === "dark" ? "Mode Terang" : "Mode Gelap"}</span>}
    </button>
  );
}
