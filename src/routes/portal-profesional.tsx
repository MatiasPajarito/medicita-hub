import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/portal-profesional")({
  head: () => ({ meta: [
    { title: "Portal profesional — MediCita" },
    { name: "description", content: "Gestiona tu disponibilidad de atención clínica en MediCita." },
    { property: "og:title", content: "Portal profesional — MediCita" },
    { property: "og:description", content: "Tu espacio profesional de gestión clínica." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/doctor/disponibilidad" });
  },
});