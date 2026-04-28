import { redirect } from "next/navigation";

export default function AdmisibilidadDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/dom/admisibilidad/${params.id}`);
}
