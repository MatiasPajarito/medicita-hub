import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addMinutes, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { availableDates, clinicNow, type BusySlot, type PublicDoctor } from "@/lib/booking";
import { supabase } from "@/lib/supabase";

export function BookingDialog({ doctor, initialDate, initialModality = "todas", onClose }: { doctor: PublicDoctor | null; initialDate?: string | undefined; initialModality?: string | undefined; onClose: () => void }) {
  return <Dialog open={!!doctor} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">{doctor && <BookingPanel key={doctor.id} doctor={doctor} initialDate={initialDate} initialModality={initialModality} onClose={onClose} />}</DialogContent></Dialog>;
}
function BookingPanel({ doctor, initialDate, initialModality, onClose }: { doctor: PublicDoctor; initialDate?: string | undefined; initialModality: string; onClose: () => void }) {
  const today = format(clinicNow(), "yyyy-MM-dd");
  const [date, setDate] = useState(initialDate && initialDate >= today ? initialDate : today);
  const [chosenDate, setChosenDate] = useState("");
  const [slot, setSlot] = useState("");
  const [modality, setModality] = useState(initialModality === "telemedicina" ? "telemedicina" : "presencial");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const user = useQuery({ queryKey: ["booking-user"], queryFn: async () => { const { data, error } = await supabase.auth.getUser(); if (error) return null; return data.user; } });
  const availability = useQuery({ queryKey: ["booking-availability", doctor.id, date], queryFn: async () => {
    const until = format(addMinutes(parseISO(date), 59 * 24 * 60), "yyyy-MM-dd");
    const [schedule, busy, professional] = await Promise.all([
      supabase.from("doctor_schedules").select("*").eq("doctor_id", doctor.id),
      supabase.rpc("booked_clinical_slots", { _doctor_id: doctor.id, _from: date, _to: until }),
      supabase.from("doctors").select("modalities").eq("id", doctor.id).single(),
    ]);
    if (schedule.error || busy.error || professional.error) throw new Error("No pudimos consultar las horas reales. Inténtalo nuevamente más tarde.");
    const rules = (schedule.data ?? []).map((r) => ({ day_of_week: r.day_of_week, is_available: r.is_available, start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5), has_break: !!r.break_start, break_start: r.break_start?.slice(0, 5) ?? "13:00", break_end: r.break_end?.slice(0, 5) ?? "14:00", slot_duration_minutes: r.slot_duration_minutes }));
    return { days: availableDates(rules, (busy.data ?? []) as BusySlot[], date, clinicNow()), modalities: professional.data.modalities as string[] };
  } });
  const days = availability.data?.days ?? [];
  const activeDay = days.find((d) => d.date === chosenDate) ?? days[0];
  const modes = availability.data?.modalities ?? [];
  async function confirm() {
    if (!user.data || !activeDay || !slot || !modes.includes(modality)) return;
    setSaving(true);
    try {
      const { data: patient, error: patientError } = await supabase.from("patients").select("id").eq("user_id", user.data.id).maybeSingle();
      if (patientError) throw patientError;
      if (!patient) { toast.error("Completa tu ficha de paciente antes de reservar."); return; }
      const end = format(addMinutes(parseISO(`${activeDay.date}T${slot}`), activeDay.duration), "HH:mm");
      const { error } = await supabase.from("appointments").insert({ patient_id: patient.id, doctor_id: doctor.id, appointment_date: activeDay.date, start_time: slot, end_time: end, modality, status: "confirmada" });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("¡Tu cita está confirmada!");
      onClose();
    } catch (error) {
      console.error("Error al reservar cita:", error);
      toast.error(error instanceof Error ? error.message : "No pudimos confirmar la reserva. La hora puede haber sido ocupada.");
      setSlot("");
      await availability.refetch();
    } finally { setSaving(false); }
  }
  return <><DialogHeader><DialogTitle>{doctor.full_name}</DialogTitle><DialogDescription>{doctor.specialty} · ${doctor.consultation_fee.toLocaleString("es-CL")} por consulta</DialogDescription></DialogHeader>
    <div className="grid gap-4"><div className="grid gap-2"><Label htmlFor="booking-date">Fecha de atención</Label><Input id="booking-date" type="date" value={date} min={today} onChange={(e) => { if (e.target.value) setDate(e.target.value); setChosenDate(""); setSlot(""); }} /></div>
    {availability.isPending && <p className="text-sm text-muted-foreground">Consultando disponibilidad…</p>}
    {availability.isError && <p role="alert" className="text-sm text-destructive">{availability.error.message}</p>}
    {availability.isSuccess && !activeDay && <p className="text-sm text-muted-foreground">No hay horas libres durante los próximos 60 días desde la fecha consultada.</p>}
    {activeDay && <>{days[0]?.date !== date && <p className="text-sm text-muted-foreground">No hay horas en la fecha consultada. Estas son las próximas fechas disponibles.</p>}<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{days.slice(0, 9).map((day) => <Button key={day.date} variant={activeDay.date === day.date ? "default" : "outline"} onClick={() => { setChosenDate(day.date); setSlot(""); }}>{format(parseISO(day.date), "EEE d MMM", { locale: es })}</Button>)}</div><p className="font-semibold">{format(parseISO(activeDay.date), "EEEE d 'de' MMMM", { locale: es })}</p><div className="grid grid-cols-4 gap-2">{activeDay.slots.map((s) => <Button key={s.time} variant="outline" aria-pressed={slot === s.time} className={slot === s.time ? "border-success bg-success text-success-foreground" : "border-success/40 bg-success-soft text-success"} onClick={() => setSlot(s.time)}>{s.time}</Button>)}</div>
    <Label>Modalidad</Label><Select value={modality} onValueChange={setModality}><SelectTrigger><SelectValue placeholder="Seleccionar modalidad" /></SelectTrigger><SelectContent>{modes.map((m) => <SelectItem key={m} value={m}>{m === "presencial" ? "Presencial" : "Telemedicina"}</SelectItem>)}</SelectContent></Select>
    {user.data ? <Button disabled={!slot || saving || !modes.includes(modality)} onClick={confirm}><CalendarCheck />{saving ? "Confirmando…" : "Confirmar reserva"}</Button> : <Button asChild><Link to="/acceso" search={{ redirect: `/buscar-citas?doctor=${doctor.id}&date=${activeDay.date}`, mode: "login" }}>Iniciar sesión para reservar</Link></Button>}</>}
    </div></>;
}