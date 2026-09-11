import type * as CalendarModule from 'expo-calendar';

type CalendarApi = typeof CalendarModule;
type ExpoCalendar = CalendarModule.ExpoCalendar;
type ExpoCalendarEvent = CalendarModule.ExpoCalendarEvent;
type Source = CalendarModule.Source;

/**
 * Mirroring SupportCard events into the iOS Calendar app.
 *
 * One-way, on purpose. SupportCard is the record of what was agreed, and a
 * court-ready record you can edit from anywhere isn't one. So we write into a
 * calendar we own and never read a parent's personal events back.
 *
 * Sync is keyed on the event's `url` field, which we set to a supportcard://
 * URI containing the row id. That gives a stable identity across syncs, so a
 * month can be reconciled (add the new, drop the deleted, replace the changed)
 * instead of wiped and rewritten, which would make every calendar refresh
 * churn the user's Calendar app.
 *
 * Events in SupportCard are dates, not times, so everything here is all-day.
 */

const CALENDAR_TITLE = 'SupportCard';
const CALENDAR_COLOR = '#2B74D6';
const URL_PREFIX = 'supportcard://event/';

const KEY_ENABLED = 'appleCalendar.enabled';

const isIOS = process.env.EXPO_OS === 'ios';

/**
 * expo-calendar is a native module, so it only exists in a binary built after
 * it was added. Users on an older build still receive JS over the air, and
 * that JS must not assume the native side is present. Resolving it lazily
 * means those users simply never see sync turn on, rather than crashing the
 * calendar tab.
 */
let cached: CalendarApi | null | undefined;
function mod(): CalendarApi | null {
  if (cached !== undefined) return cached;
  if (!isIOS) { cached = null; return cached; }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-calendar') as CalendarApi;
  } catch {
    cached = null;
  }
  return cached;
}

/** The shape the calendar screen already has in hand. */
export interface SyncableEvent {
  id: string;
  event_date: string;   // YYYY-MM-DD
  event_type: string | null;
  notes: string | null;
}

// ── preference ───────────────────────────────────────────────────────────────

function secureStore(): any | null {
  if (!isIOS) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-secure-store');
  } catch {
    return null;
  }
}

export async function isSyncEnabled(): Promise<boolean> {
  const s = secureStore();
  if (!s) return false;
  try {
    return (await s.getItemAsync(KEY_ENABLED)) === '1';
  } catch {
    return false;
  }
}

async function setSyncEnabled(on: boolean): Promise<void> {
  const s = secureStore();
  if (!s) return;
  try {
    await s.setItemAsync(KEY_ENABLED, on ? '1' : '0');
  } catch {
    // non-fatal. Worst case the toggle doesn't stick across launches.
  }
}

// ── calendar ────────────────────────────────────────────────────────────────

/**
 * Find our calendar, creating it if this is the first sync.
 *
 * Returns null whenever we can't or shouldn't write: no native module,
 * permission refused, or no writable source on the device. Callers treat null
 * as "sync is off", because from the user's side it always is.
 */
async function getCalendar(): Promise<ExpoCalendar | null> {
  const Calendar = mod();
  if (!Calendar) return null;

  const perm = await Calendar.getCalendarPermissions();
  if (!perm.granted) return null;

  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const existing = calendars.find(c => c.title === CALENDAR_TITLE);
  if (existing) return existing;

  // A new calendar needs a source to live in. The default calendar's source is
  // the right one: it's whatever account the user actually writes events to.
  let source: Source | undefined;
  try {
    source = Calendar.getDefaultCalendarSync()?.source;
  } catch {
    source = undefined;
  }
  if (!source) source = Calendar.getSourcesSync()?.[0];
  if (!source) return null;

  try {
    return await Calendar.createCalendar({
      title: CALENDAR_TITLE,
      color: CALENDAR_COLOR,
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: source.id,
      source,
    });
  } catch {
    return null;
  }
}

/**
 * Ask for calendar access and turn sync on.
 *
 * Returns false if the user declined, or if there's nowhere to write. The
 * caller is expected to leave the toggle off and say why.
 */
export async function enableSync(): Promise<boolean> {
  const Calendar = mod();
  if (!Calendar) return false;

  const current = await Calendar.getCalendarPermissions();
  const perm = current.granted ? current : await Calendar.requestCalendarPermissions();
  if (!perm.granted) return false;

  const calendar = await getCalendar();
  if (!calendar) return false;

  await setSyncEnabled(true);
  return true;
}

/**
 * Turn sync off and remove everything we put in the user's Calendar app.
 *
 * Deleting our whole calendar is the honest thing to do: the user asked for
 * these events to stop appearing, and leaving a stale month behind would read
 * as the toggle not working.
 */
export async function disableSync(): Promise<void> {
  await setSyncEnabled(false);
  if (!mod()) return;
  try {
    const calendar = await getCalendar();
    if (calendar) await calendar.delete();
  } catch {
    // Non-fatal. The preference is already off, so nothing new gets written.
  }
}

// ── sync ────────────────────────────────────────────────────────────────────

function titleFor(e: SyncableEvent): string {
  return e.event_type?.trim() || 'SupportCard event';
}

/** All-day events run from midnight to midnight the next day. */
function rangeFor(dateISO: string): { start: Date; end: Date } | null {
  const [y, m, d] = dateISO.split('-').map(Number);
  if (!y || !m || !d) return null;
  return {
    start: new Date(y, m - 1, d, 0, 0, 0, 0),
    end: new Date(y, m - 1, d + 1, 0, 0, 0, 0),
  };
}

/** True when the device event already matches the app event exactly. */
function matches(deviceEvent: ExpoCalendarEvent, appEvent: SyncableEvent): boolean {
  if (deviceEvent.title !== titleFor(appEvent)) return false;
  if ((deviceEvent.notes ?? '') !== (appEvent.notes ?? '')) return false;
  const range = rangeFor(appEvent.event_date);
  if (!range) return false;
  const deviceStart = new Date(deviceEvent.startDate);
  return (
    deviceStart.getFullYear() === range.start.getFullYear() &&
    deviceStart.getMonth() === range.start.getMonth() &&
    deviceStart.getDate() === range.start.getDate()
  );
}

/**
 * Reconcile one month's window against the device calendar.
 *
 * `events` must be every SupportCard event in [windowStart, windowEnd]; any
 * event of ours in that window that isn't in the list is treated as deleted.
 * Safe to call on every month change: it no-ops when nothing has changed.
 */
export async function syncWindow(
  windowStart: Date,
  windowEnd: Date,
  events: SyncableEvent[],
): Promise<void> {
  const Calendar = mod();
  if (!Calendar) return;
  if (!(await isSyncEnabled())) return;

  const calendar = await getCalendar();
  if (!calendar) return;

  let deviceEvents: ExpoCalendarEvent[];
  try {
    deviceEvents = await Calendar.listEvents([calendar], windowStart, windowEnd);
  } catch {
    return;
  }

  const byId = new Map<string, ExpoCalendarEvent>();
  for (const de of deviceEvents) {
    const url = de.url ?? '';
    if (url.startsWith(URL_PREFIX)) byId.set(url.slice(URL_PREFIX.length), de);
  }

  const wanted = new Set(events.map(e => e.id));

  // Drop events the user deleted in SupportCard.
  for (const [id, de] of byId) {
    if (!wanted.has(id)) await de.delete().catch(() => {});
  }

  for (const e of events) {
    const range = rangeFor(e.event_date);
    if (!range) continue;

    const existing = byId.get(e.id);
    if (existing) {
      if (matches(existing, e)) continue;
      // Edited. Replace rather than patch: a delete plus create is one
      // predictable path regardless of which field changed.
      await existing.delete().catch(() => {});
    }

    await calendar
      .createEvent({
        title: titleFor(e),
        startDate: range.start,
        endDate: range.end,
        allDay: true,
        notes: e.notes ?? '',
        url: `${URL_PREFIX}${e.id}`,
        availability: Calendar.Availability.FREE,
      })
      .catch(() => {});
  }
}
