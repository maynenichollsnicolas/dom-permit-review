"use client";

import { useT } from "@/lib/i18n";

export function LangToggle() {
  const { lang, setLang } = useT();
  return (
    <div className="flex items-center gap-0.5 bg-white/10 border border-white/15 rounded-md p-0.5">
      <button
        onClick={() => setLang("es")}
        className={`text-[11px] font-bold px-2 py-0.5 rounded transition-all ${
          lang === "es"
            ? "bg-white text-[oklch(0.225_0.095_252)] shadow-sm"
            : "text-white/50 hover:text-white/80"
        }`}
      >
        ES
      </button>
      <button
        onClick={() => setLang("en")}
        className={`text-[11px] font-bold px-2 py-0.5 rounded transition-all ${
          lang === "en"
            ? "bg-white text-[oklch(0.225_0.095_252)] shadow-sm"
            : "text-white/50 hover:text-white/80"
        }`}
      >
        EN
      </button>
    </div>
  );
}
