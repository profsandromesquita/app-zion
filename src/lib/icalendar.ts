/**
 * Utility functions for generating iCalendar (.ics) files
 */

export interface CalendarEvent {
  title: string;
  description: string;
  start: Date;
  end: Date;
  location?: string;
  organizer?: string;
}

/**
 * Format a Date object to iCalendar format (YYYYMMDDTHHMMSSZ)
 */
function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/**
 * Escape special characters for iCalendar format
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n");
}

/**
 * Generate an iCalendar event string
 */
export function generateICalEvent(event: CalendarEvent): string {
  const uid = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}@zion.app`;
  const dtstamp = formatICalDate(new Date());
  const dtstart = formatICalDate(event.start);
  const dtend = formatICalDate(event.end);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ZION//Connection Session//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeICalText(event.title)}`,
    `DESCRIPTION:${escapeICalText(event.description)}`,
  ];

  if (event.location) {
    lines.push(`LOCATION:${escapeICalText(event.location)}`);
    lines.push(`URL:${event.location}`);
  }

  // Add 15-minute reminder alarm
  lines.push(
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Lembrete: Sua conversa no ZION começa em 15 minutos",
    "END:VALARM"
  );

  // Add 1-hour reminder alarm
  lines.push(
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Lembrete: Você tem uma conversa no ZION em 1 hora",
    "END:VALARM"
  );

  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}

/**
 * Download an iCalendar file
 */
export function downloadICalFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format a date for display in Portuguese
 */
export function formatDateTimePtBr(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Calculate the next occurrence of a weekly time slot
 */
export function calculateNextOccurrence(slot: {
  day_of_week: number;
  start_time: string;
  is_today?: boolean;
  is_tomorrow?: boolean;
}): Date {
  const now = new Date();
  const today = now.getDay();
  
  // Parse the time
  const [hours, minutes] = slot.start_time.split(":").map(Number);
  
  // Calculate days until the target day
  let daysUntil = slot.day_of_week - today;
  if (daysUntil < 0) {
    daysUntil += 7;
  }
  
  // If it's today but the time has passed, go to next week
  if (daysUntil === 0) {
    const targetTime = new Date(now);
    targetTime.setHours(hours, minutes, 0, 0);
    if (targetTime <= now) {
      daysUntil = 7;
    }
  }
  
  // Create the target date
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + daysUntil);
  targetDate.setHours(hours, minutes, 0, 0);
  
  return targetDate;
}
