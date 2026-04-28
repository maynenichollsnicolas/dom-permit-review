import { redirect } from "next/navigation";

export default function ExpedientRedirect({ params }: { params: { id: string } }) {
  redirect(`/dom/expedients/${params.id}`);
}
