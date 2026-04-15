import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user?.email) {
        // Check if this user is a DOM staff member
        const { data: domUser } = await supabase
          .from("users")
          .select("role")
          .eq("email", user.email)
          .single();

        if (domUser) {
          // DOM staff — route based on role
          const roleRoutes: Record<string, string> = {
            admisibilidad: "/admisibilidad",
            revisor_tecnico: "/",
            jefe_departamento: "/",
            director_dom: "/",
          };
          const destination = roleRoutes[domUser.role] ?? "/";
          return NextResponse.redirect(new URL(destination, origin));
        } else {
          // Architect — ensure profile exists then go to architect portal
          await supabase.from("architects").upsert(
            {
              auth_user_id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name ?? user.email,
            },
            { onConflict: "email" }
          );
          return NextResponse.redirect(new URL("/architect", origin));
        }
      }
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
}
