import { createFileRoute } from "@tanstack/react-router";
import { AdminDoctorsPanel } from "@/components/medicita/admin-doctors-panel";
import { requireRole } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    await requireRole(["admin"], context.user.id);
  },
  head: () => ({
    meta: [
      { title: "Administración de profesionales — MediCita" },
      { name: "description", content: "Gestiona profesionales médicos de MediCita." },
      { property: "og:title", content: "Administración de profesionales — MediCita" },
      {
        property: "og:description",
        content: "Alta y gestión segura de profesionales médicos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminDoctorsPanel,
});
