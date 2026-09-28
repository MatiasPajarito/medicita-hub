import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ChevronLeft, ChevronRight, Coffee, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeading } from "@/components/medicita/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getMySchedule, saveMySchedule } from "@/lib/clinical.functions";
import { dayRuleSchema, defaultDay, generateSlots, mondayIndex, weekDays, type DayRule } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/doctor/disponibilidad")({
  head: () => ({ meta: [
    { title: "Mi disponibilidad horaria — MediCita" },
    { name: "description", content: "Configura tus días, horarios de atención, pausas y bloques de consulta en MediCita." },
    { property: "og:title", content: "Mi disponibilidad horaria — MediCita" },
    { property: "og:description", content: "Gestiona la agenda semanal del profesional médico." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AvailabilityPage,
});

const durations = [15, 20, 30, 45, 60];

function AvailabilityPage() {
  const load = useServerFn(getMySchedule);
  const save = useServerFn(saveMySchedule);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["my-schedule"], queryFn: () => load() });
  const [days, setDays] = useState<DayRule[]>(() => weekDays.map((_, i) => defaultDay(i)));
  const [saving, setSaving] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<{ date: string; time: string } | null>(null);

  useEffect(() => {
    if (!query.data) return;
    setDays(weekDays.map((_, i) => query.data.days.find((d) => d.day_of_week === i) ?? defaultDay(i)));
  }, [query.data]);

  const update = (i: number, patch: Partial<DayRule>) => setDays((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const errors = days.map((d) => dayRuleSchema.safeParse(d)).map((r) => (r.success ? null : r.error.issues[0]?.message));

  const weekDates = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monday = new Date(today); monday.setDate(today.getDate() - mondayIndex(today) + weekOffset * 7);
    return weekDays.map((_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  }, [weekOffset]);

  async function onSave() {
    if (errors.some(Boolean)) { toast.error("Revisa los horarios marcados con error"); return; }
    setSaving(true);
    try { await save({ data: { days } }); await qc.invalidateQueries({ queryKey: ["my-schedule"] }); toast.success("Disponibilidad guardada"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "No pudimos guardar"); }
    finally { setSaving(false); }
  }

  if (query.isLoading) return <p className="mx-auto max-w-6xl px-4 py-10 text-muted-foreground">Cargando tu agenda…</p>;
  if (query.error) return <p className="mx-auto max-w-6xl px-4 py-10 text-destructive">{query.error.message}</p>;
  if (!query.data?.doctor) return (
    <><PageHeading eyebrow="Portal profesional" title="Mi disponibilidad" description="Configura tu agenda semanal de atención." />
      <div className="mx-auto max-w-3xl px-4 py-10"><Card className="shadow-none"><CardContent className="py-8 text-center text-muted-foreground">Tu cuenta aún no está vinculada a un perfil profesional. Pide a un administrador que asocie tu usuario a tu ficha de médico.</CardContent></Card></div></>
  );

  return (
    <>
      <PageHeading eyebrow="Portal profesional" title="Mi disponibilidad" description={`${query.data.doctor.full_name} · ${query.data.doctor.specialty}`}
        action={<Button onClick={onSave} disabled={saving}><Save />{saving ? "Guardando…" : "Guardar horarios"}</Button>} />
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Card className="shadow-none">
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="text-primary" />Regla semanal</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {days.map((d, i) => (
              <div key={i} className={cn("grid gap-3 rounded-lg border p-3 lg:grid-cols-[150px_1fr_1fr_1fr] lg:items-center", !d.is_available && "bg-muted/40")}>
                <label className="flex items-center gap-3 font-semibold"><Switch checked={d.is_available} onCheckedChange={(v) => update(i, { is_available: v })} aria-label={`Atender ${weekDays[i]}`} />{weekDays[i]}</label>
                <div className="flex items-center gap-2"><Label className="w-14 text-xs text-muted-foreground">Horario</Label>
                  <Input type="time" value={d.start_time} disabled={!d.is_available} onChange={(e) => update(i, { start_time: e.target.value })} />
                  <span>–</span><Input type="time" value={d.end_time} disabled={!d.is_available} onChange={(e) => update(i, { end_time: e.target.value })} /></div>
                <div className="flex items-center gap-2">
                  <Switch checked={d.has_break} disabled={!d.is_available} onCheckedChange={(v) => update(i, { has_break: v })} aria-label="Pausa de almuerzo" /><Coffee className="size-4 text-muted-foreground" />
                  <Input type="time" value={d.break_start} disabled={!d.is_available || !d.has_break} onChange={(e) => update(i, { break_start: e.target.value })} />
                  <span>–</span><Input type="time" value={d.break_end} disabled={!d.is_available || !d.has_break} onChange={(e) => update(i, { break_end: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Label className="text-xs text-muted-foreground">Bloque</Label>
                  <Select value={String(d.slot_duration_minutes)} disabled={!d.is_available} onValueChange={(v) => update(i, { slot_duration_minutes: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{durations.map((m) => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}</SelectContent>
                  </Select></div>
                {d.is_available && errors[i] && <p className="text-sm text-destructive lg:col-span-4">{errors[i]}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Vista previa de bloques</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Semana anterior" disabled={weekOffset === 0} onClick={() => setWeekOffset((w) => w - 1)}><ChevronLeft /></Button>
              <span className="text-sm font-medium">{weekDates[0]!.toLocaleDateString("es-CL", { day: "numeric", month: "short" })} – {weekDates[6]!.toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</span>
              <Button variant="outline" size="icon" aria-label="Semana siguiente" onClick={() => setWeekOffset((w) => w + 1)}><ChevronRight /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-2"><span className="size-3 rounded bg-success" />Disponible</span>
              <span className="flex items-center gap-2"><span className="size-3 rounded bg-muted" />No disponible (pausa o pasado)</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
              {weekDates.map((date, i) => {
                const rule = errors[i] ? undefined : days[i];
                const slots = generateSlots(rule, date);
                const key = date.toISOString().slice(0, 10);
                return (
                  <div key={key} className="rounded-lg border p-2">
                    <p className="mb-2 text-center text-sm font-semibold capitalize">{date.toLocaleDateString("es-CL", { weekday: "short", day: "numeric" })}</p>
                    {slots.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">Sin atención</p> : (
                      <div className="grid max-h-80 gap-1 overflow-y-auto">
                        {slots.map((s) => {
                          const isSel = selected?.date === key && selected.time === s.time;
                          return (
                            <button key={s.time} type="button" disabled={!s.available} title={s.reason === "pausa" ? "Pausa" : s.reason === "pasado" ? "Horario pasado" : "Disponible"}
                              onClick={() => setSelected({ date: key, time: s.time })}
                              className={cn("rounded-md px-2 py-1 text-xs font-medium transition-colors",
                                s.available ? "bg-success/15 text-success hover:bg-success/25" : "cursor-not-allowed bg-muted text-muted-foreground line-through",
                                isSel && "bg-success text-success-foreground ring-2 ring-success")}>{s.time}</button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {selected && <p className="mt-4 text-sm">Bloque seleccionado: <strong>{new Date(selected.date + "T12:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}</strong> a las <strong>{selected.time}</strong></p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
