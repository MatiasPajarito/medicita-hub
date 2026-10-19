import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/portal-profesional")({
  beforeLoad: () => {
    throw redirect({ to: "/doctor/disponibilidad" });
  },
});