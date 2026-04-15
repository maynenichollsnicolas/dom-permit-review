"use client";

import { createClient } from "@/lib/supabase/client";
import { Building2, ArrowRight } from "lucide-react";

export default function ArchitectLoginPage() {
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen bg-grid flex">
      {/* Left — branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] bg-dom-header text-white p-12 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2.5 mb-16">
            <Building2 className="h-5 w-5 text-white/70" />
            <span className="text-sm font-semibold tracking-tight">Portal del Arquitecto</span>
          </div>

          <h1 className="text-3xl font-bold leading-tight tracking-tight mb-4">
            Ingresa tu permiso de edificación en línea
          </h1>
          <p className="text-sm text-white/60 leading-relaxed">
            Plataforma digital de ingreso y seguimiento de permisos ante la DOM de Las Condes.
          </p>
        </div>

        <div className="space-y-4">
          {[
            { label: "Ingreso digital de expedientes", desc: "Sube tus documentos y la IA extrae los parámetros del CIP automáticamente" },
            { label: "Seguimiento en tiempo real", desc: "Consulta el estado de tu solicitud y recibe las Actas de Observaciones" },
            { label: "Asistente IA", desc: "Resuelve dudas sobre observaciones, normativa OGUC y subsanación" },
          ].map((feat) => (
            <div key={feat.label} className="flex gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-white/40 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white/90">{feat.label}</p>
                <p className="text-xs text-white/45 leading-relaxed">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-white/30">
          Municipalidad de Las Condes · Dirección de Obras Municipales
        </p>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Portal del Arquitecto</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
              Acceder al portal
            </h2>
            <p className="text-sm text-muted-foreground">
              Usa tu cuenta personal de Google para continuar.
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-between gap-3 bg-card border border-border rounded-lg px-5 py-3.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors shadow-sm group"
          >
            <div className="flex items-center gap-3">
              <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Continuar con Google</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </button>

          <p className="text-xs text-muted-foreground mt-6 text-center">
            Disponible para arquitectos y propietarios con expedientes activos.
          </p>

          <div className="mt-8 pt-6 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              ¿Eres funcionario DOM?{" "}
              <a href="/login" className="text-primary hover:underline font-medium">
                Accede al sistema institucional
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
