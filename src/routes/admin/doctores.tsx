import { createFileRoute } from "@tanstack/react-router";
import { AdminDoctorsPanel } from "@/components/medicita/admin-doctors-panel";
import { requireRole } from "@/lib/route-guards";

export const Route = createFileRoute("/admin/doctores")({
  beforeLoad: async () => {
    await requireRole(["admin"]);
  },
  head: () => ({
    meta: [
      { title: "Gestión de Médicos — Panel Admin MediCita" },
      {
        name: "description",
        content: "Administra profesionales médicos, estado activo/inactivo y eliminación en MediCita.",
      },
      { property: "og:title", content: "Gestión de Médicos — Panel Admin MediCita" },
      {
        property: "og:description",
        content: "Panel administrativo de gestión médica.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminDoctorsPanel,
});
