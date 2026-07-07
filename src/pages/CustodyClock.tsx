import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Plus, LogIn, LogOut, Clock, Bell, Trash2, Timer, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDuration, intervalToDuration } from 'date-fns';

interface CustodyZone {
  id: string;
  user_id: string;
  child_id: string | null;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  zone_type: string;
  created_at: string;
}

interface CheckIn {
  id: string;
  zone_id: string | null;
  child_id: string | null;
  event_type: 'enter' | 'exit' | 'manual';
  lat: number | null;
  lng: number | null;
  notes: string | null;
  created_at: string;
  custody_zones?: { name: string } | null;
}

interface ExchangeLog {
  id: string;
  child_id: string | null;
  handoff_from: string | null;
  handoff_to: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  created_at: string;
}

interface CurfewRule {
  id: string;
  child_id: string;
  curfew_time: string;
  days_of_week: number[];
  alert_minutes_before: number;
  active: boolean;
  created_at: string;
}

interface Child {
  id: string;
  name: string;
}

const ZONE_TYPES = ["Home (Mom's)", "Home (Dad's)", 'School', "Grandma's", "Grandpa's", 'Other'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Isolated so the 1s tick only re-renders this text node, not the whole
// CustodyClock tree (zones/check-ins/exchanges/curfews lists).
const ExchangeElapsed = ({ start }: { start: Date }) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const update = () => {
      const dur = intervalToDuration({ start, end: new Date() });
      setElapsed(formatDuration(dur, { format: ['hours', 'minutes', 'seconds'] }) || '0 seconds');
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [start]);

  return <>{elapsed || '...'}</>;
};

const CustodyClock = () => {
  const { user } = useAuth();
  const { isParent } = useRole();
  const { canUseVerifiedHandoffs } = usePermissions();

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [zones, setZones] = useState<CustodyZone[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [exchanges, setExchanges] = useState<ExchangeLog[]>([]);
  const [curfews, setCurfews] = useState<CurfewRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Timer state for exchange — elapsed-time ticking lives in <ExchangeElapsed>
  const [exchangeStart, setExchangeStart] = useState<Date | null>(null);

  // Dialog state
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [exchangeDialogOpen, setExchangeDialogOpen] = useState(false);
  const [curfewDialogOpen, setCurfewDialogOpen] = useState(false);

  // Form state
  const [zoneName, setZoneName] = useState('');
  const [zoneType, setZoneType] = useState('');
  const [zoneRadius, setZoneRadius] = useState('200');
  const [checkInZoneId, setCheckInZoneId] = useState('');
  const [checkInEvent, setCheckInEvent] = useState<'enter' | 'exit' | 'manual'>('manual');
  const [checkInNotes, setCheckInNotes] = useState('');
  const [exchangeNotes, setExchangeNotes] = useState('');
  const [handoffFrom, setHandoffFrom] = useState('');
  const [handoffTo, setHandoffTo] = useState('');
  const [curfewTime, setCurfewTime] = useState('21:00');
  const [curfewDays, setCurfewDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [curfewAlertMin, setCurfewAlertMin] = useState('15');
  const [submitting, setSubmitting] = useState(false);
  const [deleteZoneTarget, setDeleteZoneTarget] = useState<CustodyZone | null>(null);

  useEffect(() => {
    if (user) loadChildren();
  }, [user]);

  useEffect(() => {
    if (selectedChildId) {
      loadZones();
      loadCheckins();
      loadExchanges();
      loadCurfews();
    }
  }, [selectedChildId]);

  const loadChildren = async () => {
    const { data } = await supabase
      .from('children')
      .select('id, name')
      .or(`parent_id.eq.${user!.id},co_parent_id.eq.${user!.id}`);
    if (data && data.length > 0) {
      setChildren(data);
      if (!selectedChildId) setSelectedChildId(data[0].id);
    }
    setLoading(false);
  };

  const loadZones = async () => {
    const { data } = await (supabase as any)
      .from('custody_zones')
      .select('*')
      .or(`user_id.eq.${user!.id},child_id.eq.${selectedChildId}`)
      .order('created_at', { ascending: false });
    setZones(data || []);
  };

  const loadCheckins = async () => {
    const { data } = await (supabase as any)
      .from('custody_checkins')
      .select('*, custody_zones:zone_id(name)')
      .eq('child_id', selectedChildId)
      .order('created_at', { ascending: false })
      .limit(20);
    setCheckins(data || []);
  };

  const loadExchanges = async () => {
    const { data } = await (supabase as any)
      .from('exchange_logs')
      .select('*')
      .eq('child_id', selectedChildId)
      .order('created_at', { ascending: false })
      .limit(10);
    setExchanges(data || []);
  };

  const loadCurfews = async () => {
    const { data } = await (supabase as any)
      .from('curfew_rules')
      .select('*')
      .eq('child_id', selectedChildId)
      .order('created_at', { ascending: false });
    setCurfews(data || []);
  };

  const getLocation = (): Promise<{ lat: number; lng: number } | null> =>
    new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { timeout: 8000 }
      );
    });

  const handleCreateZone = async () => {
    if (!zoneName.trim()) { toast.error('Enter zone name'); return; }
    if (!zoneType) { toast.error('Select zone type'); return; }

    setSubmitting(true);
    const loc = await getLocation();

    try {
      const { error } = await (supabase as any)
        .from('custody_zones')
        .insert({
          user_id: user!.id,
          child_id: selectedChildId || null,
          name: zoneName.trim(),
          zone_type: zoneType,
          lat: loc?.lat ?? 0,
          lng: loc?.lng ?? 0,
          radius_m: parseInt(zoneRadius) || 200,
        });

      if (error) throw error;
      toast.success(loc ? 'Zone created at your current location' : 'Zone created (no GPS — coordinates set to 0,0)');
      setZoneDialogOpen(false);
      setZoneName('');
      setZoneType('');
      setZoneRadius('200');
      loadZones();
    } catch {
      toast.error('Failed to create zone');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteZone = async (id: string) => {
    await (supabase as any).from('custody_zones').delete().eq('id', id);
    toast.success('Zone deleted');
    setDeleteZoneTarget(null);
    loadZones();
  };

  const handleCheckIn = async () => {
    setSubmitting(true);
    const loc = await getLocation();

    if (canUseVerifiedHandoffs && !loc) {
      toast.error('Verified Handoffs requires location access. Enable GPS and try again.');
      setSubmitting(false);
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('custody_checkins')
        .insert({
          user_id: user!.id,
          child_id: selectedChildId || null,
          zone_id: checkInZoneId || null,
          event_type: checkInEvent,
          lat: loc?.lat ?? null,
          lng: loc?.lng ?? null,
          notes: checkInNotes || null,
        });

      if (error) throw error;
      toast.success('Check-in logged' + (loc ? ' with verified GPS' : ' (no GPS)'));
      setCheckInDialogOpen(false);
      setCheckInZoneId('');
      setCheckInNotes('');
      loadCheckins();
    } catch {
      toast.error('Failed to log check-in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogExchange = async () => {
    setSubmitting(true);
    const loc = await getLocation();

    if (canUseVerifiedHandoffs && !loc) {
      toast.error('Verified Handoffs requires location access. Enable GPS and try again.');
      setSubmitting(false);
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('exchange_logs')
        .insert({
          user_id: user!.id,
          child_id: selectedChildId || null,
          handoff_from: handoffFrom || null,
          handoff_to: handoffTo || null,
          lat: loc?.lat ?? null,
          lng: loc?.lng ?? null,
          notes: exchangeNotes || null,
          exchange_at: new Date().toISOString(),
        });

      if (error) throw error;
      toast.success('Exchange logged' + (loc ? ' with verified GPS timestamp' : ''));
      setExchangeDialogOpen(false);
      setHandoffFrom('');
      setHandoffTo('');
      setExchangeNotes('');
      setExchangeStart(null);
      loadExchanges();
    } catch {
      toast.error('Failed to log exchange');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveCurfew = async () => {
    if (!curfewTime) { toast.error('Set curfew time'); return; }
    if (curfewDays.length === 0) { toast.error('Select at least one day'); return; }

    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from('curfew_rules')
        .insert({
          child_id: selectedChildId,
          curfew_time: curfewTime,
          days_of_week: curfewDays,
          alert_minutes_before: parseInt(curfewAlertMin) || 15,
          active: true,
          created_by: user!.id,
        });

      if (error) throw error;
      toast.success('Curfew rule saved');
      setCurfewDialogOpen(false);
      setCurfewTime('21:00');
      setCurfewDays([0, 1, 2, 3, 4, 5, 6]);
      loadCurfews();
    } catch {
      toast.error('Failed to save curfew rule');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCurfewDay = (d: number) => {
    setCurfewDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    );
  };

  const selectedChild = children.find(c => c.id === selectedChildId);

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <span className="sr-only">Loading custody clock…</span>
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-40 rounded-lg" />
        <div className="grid gap-6 lg:grid-cols-2">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <MapPin aria-hidden="true" className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No children yet</h2>
        <p className="text-muted-foreground">Add a child from the Family page first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <MapPin aria-hidden="true" className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-balance">Custody Clock</h1>
            <p className="text-muted-foreground">Zones, check-ins, exchange timer and curfews</p>
          </div>
        </div>
        {children.length > 1 && (
          <Select value={selectedChildId} onValueChange={setSelectedChildId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select child" />
            </SelectTrigger>
            <SelectContent>
              {children.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Exchange Timer */}
      <Card className="shadow-soft border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer aria-hidden="true" className="w-5 h-5 text-primary" />
            Custody Exchange Timer
            {canUseVerifiedHandoffs && (
              <Badge variant="default" className="ml-2 gap-1">
                <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                Verified Handoffs
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {canUseVerifiedHandoffs
              ? 'GPS location is required for every check-in and exchange'
              : 'Time and GPS-stamp custody handoffs (best-effort location)'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {exchangeStart ? (
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Exchange in progress since {format(exchangeStart, 'HH:mm:ss')}</p>
              <p className="text-4xl font-mono font-bold text-primary tabular-nums">
                <ExchangeElapsed start={exchangeStart} />
              </p>
              <div className="flex gap-2 mt-4 justify-center">
                <Dialog open={exchangeDialogOpen} onOpenChange={setExchangeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <LogIn aria-hidden="true" className="w-4 h-4 mr-2" />
                      Complete Exchange
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Log Custody Exchange</DialogTitle>
                      <DialogDescription>Record the handoff details and GPS-stamp it</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="p-3 rounded-lg bg-muted/50 text-sm">
                        <p className="font-medium">Exchange started: {format(exchangeStart, 'dd MMM yyyy HH:mm:ss')}</p>
                        <p className="text-muted-foreground">
                          Elapsed: {exchangeStart && <ExchangeElapsed start={exchangeStart} />}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="handoff-from">Handing off from</Label>
                        <Input id="handoff-from" placeholder="e.g. Mom" value={handoffFrom} onChange={e => setHandoffFrom(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="handoff-to">Handing off to</Label>
                        <Input id="handoff-to" placeholder="e.g. Dad" value={handoffTo} onChange={e => setHandoffTo(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="exchange-notes">Notes</Label>
                        <Input id="exchange-notes" placeholder="e.g. School gate, all bags included" value={exchangeNotes} onChange={e => setExchangeNotes(e.target.value)} />
                      </div>
                      <Button className="w-full" onClick={handleLogExchange} disabled={submitting}>
                        {submitting ? 'Logging...' : 'Log Exchange with GPS'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" onClick={() => setExchangeStart(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-muted-foreground text-sm mb-4">Start the timer when a custody exchange begins</p>
              <Button onClick={() => setExchangeStart(new Date())}>
                <Timer aria-hidden="true" className="w-4 h-4 mr-2" />
                Start Exchange Timer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Zones */}
        <Card className="shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin aria-hidden="true" className="w-5 h-5 text-primary" />
                  Custody Zones
                </CardTitle>
                <CardDescription>Named locations for {selectedChild?.name}</CardDescription>
              </div>
              {isParent && (
                <Dialog open={zoneDialogOpen} onOpenChange={setZoneDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus aria-hidden="true" className="w-4 h-4 mr-1" />
                      Add Zone
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Custody Zone</DialogTitle>
                      <DialogDescription>Your current GPS location will be used as the zone centre</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="zone-name">Zone Name *</Label>
                        <Input id="zone-name" placeholder="e.g. Mom's House" value={zoneName} onChange={e => setZoneName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zone-type">Zone Type *</Label>
                        <Select value={zoneType} onValueChange={setZoneType}>
                          <SelectTrigger id="zone-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>
                            {ZONE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zone-radius">Radius (metres)</Label>
                        <Input id="zone-radius" type="number" min="50" max="5000" value={zoneRadius} onChange={e => setZoneRadius(e.target.value)} aria-describedby="zone-radius-hint" />
                        <p id="zone-radius-hint" className="text-xs text-muted-foreground">Distance from centre that triggers alerts</p>
                      </div>
                      <Button className="w-full" onClick={handleCreateZone} disabled={submitting || !zoneName || !zoneType}>
                        {submitting ? 'Creating...' : 'Create Zone at My Location'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {zones.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No zones yet</p>
            ) : (
              <div className="space-y-2">
                {zones.map(z => (
                  <div key={z.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">{z.name}</p>
                      <p className="text-xs text-muted-foreground">{z.zone_type} · {z.radius_m}m radius</p>
                      {(z.lat !== 0 || z.lng !== 0) && (
                        <p className="text-xs text-muted-foreground tabular-nums">{z.lat.toFixed(4)}, {z.lng.toFixed(4)}</p>
                      )}
                    </div>
                    {isParent && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteZoneTarget(z)}
                        aria-label={`Delete zone "${z.name}"`}
                      >
                        <Trash2 aria-hidden="true" className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Check-ins */}
        <Card className="shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <LogIn aria-hidden="true" className="w-5 h-5 text-primary" />
                  Check-In Log
                </CardTitle>
                <CardDescription>Silent arrival/departure records</CardDescription>
              </div>
              <Dialog open={checkInDialogOpen} onOpenChange={setCheckInDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus aria-hidden="true" className="w-4 h-4 mr-1" />
                    Log Check-In
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Log Check-In</DialogTitle>
                    <DialogDescription>Record a zone arrival or departure for {selectedChild?.name}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="checkin-event">Event</Label>
                      <Select value={checkInEvent} onValueChange={v => setCheckInEvent(v as any)}>
                        <SelectTrigger id="checkin-event"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="enter">Arrived at zone</SelectItem>
                          <SelectItem value="exit">Left zone</SelectItem>
                          <SelectItem value="manual">Manual note</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="checkin-zone">Zone (optional)</Label>
                      <Select value={checkInZoneId} onValueChange={setCheckInZoneId}>
                        <SelectTrigger id="checkin-zone"><SelectValue placeholder="Select zone" /></SelectTrigger>
                        <SelectContent>
                          {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="checkin-notes">Notes</Label>
                      <Input id="checkin-notes" placeholder="Optional note..." value={checkInNotes} onChange={e => setCheckInNotes(e.target.value)} />
                    </div>
                    <Button className="w-full" onClick={handleCheckIn} disabled={submitting}>
                      {submitting ? 'Logging...' : 'Log Check-In with GPS'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {checkins.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No check-ins yet</p>
            ) : (
              <div className="space-y-2">
                {checkins.map(c => (
                  <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border">
                    {c.event_type === 'enter' ? (
                      <LogIn aria-hidden="true" className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    ) : c.event_type === 'exit' ? (
                      <LogOut aria-hidden="true" className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                    ) : (
                      <Clock aria-hidden="true" className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {c.event_type === 'enter' ? 'Arrived' : c.event_type === 'exit' ? 'Left' : 'Note'}
                        {c.custody_zones?.name ? ` · ${c.custody_zones.name}` : ''}
                      </p>
                      {c.notes && <p className="text-xs text-muted-foreground truncate">{c.notes}</p>}
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {c.created_at ? format(new Date(c.created_at), 'dd MMM HH:mm') : ''}
                        {c.lat && c.lng ? ` · GPS: ${c.lat.toFixed(3)}, ${c.lng.toFixed(3)}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Exchange history */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock aria-hidden="true" className="w-5 h-5 text-primary" />
              Exchange History
            </CardTitle>
            <CardDescription>GPS-timestamped custody handoffs</CardDescription>
          </CardHeader>
          <CardContent>
            {exchanges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No exchanges logged yet</p>
            ) : (
              <div className="space-y-2">
                {exchanges.map(e => (
                  <div key={e.id} className="p-3 rounded-lg border space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {e.handoff_from || '?'} → {e.handoff_to || '?'}
                      </p>
                      <Badge variant="outline" className="text-xs">Exchange</Badge>
                    </div>
                    {e.notes && <p className="text-xs text-muted-foreground">{e.notes}</p>}
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {e.created_at ? format(new Date(e.created_at), 'dd MMM yyyy HH:mm:ss') : ''}
                      {e.lat && e.lng ? ` · ${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}` : ' · No GPS'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Curfew rules */}
        <Card className="shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell aria-hidden="true" className="w-5 h-5 text-primary" />
                  Curfew Alerts
                </CardTitle>
                <CardDescription>Soft curfew reminders for {selectedChild?.name}</CardDescription>
              </div>
              {isParent && (
                <Dialog open={curfewDialogOpen} onOpenChange={setCurfewDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus aria-hidden="true" className="w-4 h-4 mr-1" />
                      Add Rule
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Curfew Rule</DialogTitle>
                      <DialogDescription>Set a soft alert before curfew time</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="curfew-time">Curfew Time</Label>
                        <Input id="curfew-time" type="time" value={curfewTime} onChange={e => setCurfewTime(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label id="curfew-days-label">Days</Label>
                        <div className="flex gap-1 flex-wrap" role="group" aria-labelledby="curfew-days-label">
                          {DAYS.map((d, i) => (
                            <Button
                              key={d}
                              type="button"
                              size="sm"
                              variant={curfewDays.includes(i) ? 'default' : 'outline'}
                              className="h-7 px-2 text-xs"
                              aria-pressed={curfewDays.includes(i)}
                              onClick={() => toggleCurfewDay(i)}
                            >
                              {d}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="curfew-alert-min">Alert (minutes before curfew)</Label>
                        <Input id="curfew-alert-min" type="number" min="5" max="60" value={curfewAlertMin} onChange={e => setCurfewAlertMin(e.target.value)} />
                      </div>
                      <Button className="w-full" onClick={handleSaveCurfew} disabled={submitting}>
                        {submitting ? 'Saving...' : 'Save Curfew Rule'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {curfews.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No curfew rules yet</p>
            ) : (
              <div className="space-y-2">
                {curfews.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">{r.curfew_time}</p>
                      <p className="text-xs text-muted-foreground">
                        {(r.days_of_week || []).map((d: number) => DAYS[d]).join(', ')}
                      </p>
                      <p className="text-xs text-muted-foreground">{r.alert_minutes_before} min warning</p>
                    </div>
                    <Badge variant={r.active ? 'default' : 'secondary'}>
                      {r.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteZoneTarget} onOpenChange={open => !open && setDeleteZoneTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this zone?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteZoneTarget && (
                <>
                  This will permanently delete "{deleteZoneTarget.name}". Check-in history tied to
                  this zone will lose its zone reference. This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteZoneTarget && handleDeleteZone(deleteZoneTarget.id)}
            >
              Delete Zone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CustodyClock;
