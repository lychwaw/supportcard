import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MapPin, Clock, CheckCircle, AlertCircle, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { z } from 'zod';

// Zod schema for GPS coordinates validation
const GPSLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
});

interface VisitationLog {
  id: string;
  user_id: string;
  child_id: string | null;
  handoff_type: 'pickup' | 'dropoff';
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  timestamp: string;
  notes: string | null;
  verified: boolean;
  created_at: string;
}

const VisitationTracker = () => {
  const { user } = useAuth();
  const { children } = useRole();
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [logs, setLogs] = useState<VisitationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [handoffType, setHandoffType] = useState<'pickup' | 'dropoff'>('pickup');
  const [notes, setNotes] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

  useEffect(() => {
    if (user && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [user, children]);

  useEffect(() => {
    if (user && selectedChildId) {
      fetchLogs();
    }
  }, [user, selectedChildId]);

  const fetchLogs = async () => {
    if (!user || !selectedChildId) return;

    setLoading(true);
    try {
      const { data, error } = await (supabase.from as any)('visitation_logs')
        .select('*')
        .eq('child_id', selectedChildId)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) setLogs(data as VisitationLog[]);
    } catch (error) {
      console.error('Error fetching visitation logs:', error);
      toast.error('Failed to load handoff history');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = (): Promise<{ lat: number; lng: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy || 0,
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  const handleCheckIn = async () => {
    if (!user || !selectedChildId) {
      toast.error('Please select a child');
      return;
    }

    setIsCheckingIn(true);
    try {
      // Get GPS coordinates
      const location = await getCurrentLocation();
      
      // Validate with Zod
      const validated = GPSLocationSchema.parse({
        latitude: location.lat,
        longitude: location.lng,
        accuracy: location.accuracy,
      });

      setCurrentLocation(location);

      // Insert log (permanent - cannot be deleted by user)
      const { error } = await (supabase.from as any)('visitation_logs')
        .insert({
          user_id: user.id,
          child_id: selectedChildId,
          handoff_type: handoffType,
          latitude: validated.latitude,
          longitude: validated.longitude,
          accuracy_meters: validated.accuracy || null,
          notes: notes || null,
          timestamp: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success(`Check-in recorded: ${handoffType === 'pickup' ? 'Pickup' : 'Dropoff'}`);
      setNotes('');
      fetchLogs();

      // Verify handoff if both parents logged
      const { data: verified } = await (supabase.rpc as any)('verify_handoff', {
        p_child_id: selectedChildId,
        p_timestamp: new Date().toISOString(),
        p_tolerance_minutes: 15,
      });

      if (verified) {
        toast.success('Handoff verified - both parents logged location');
      }
    } catch (error: any) {
      console.error('Error checking in:', error);
      if (error.message?.includes('Geolocation')) {
        toast.error('Unable to get your location. Please enable location services.');
      } else {
        toast.error('Failed to record check-in');
      }
    } finally {
      setIsCheckingIn(false);
    }
  };

  const getMapUrl = (lat: number, lng: number) => {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const selectedChild = children.find(c => c.id === selectedChildId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Handoff Tracker</h1>
            <p className="text-muted-foreground">Record pickup and dropoff locations</p>
          </div>
        </div>
        {children.length > 0 && (
          <Select value={selectedChildId} onValueChange={setSelectedChildId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select child" />
            </SelectTrigger>
            <SelectContent>
              {children.map((child) => (
                <SelectItem key={child.id} value={child.id}>
                  {child.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!selectedChildId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Please select a child to track handoffs</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Check-In Button */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Record Handoff</CardTitle>
              <CardDescription>
                Capture GPS coordinates and timestamp for {selectedChild?.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Handoff Type</Label>
                <Select value={handoffType} onValueChange={(value: 'pickup' | 'dropoff') => setHandoffType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pickup">Pickup</SelectItem>
                    <SelectItem value="dropoff">Dropoff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Add any relevant notes about the handoff..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
              {currentLocation && (
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm font-medium mb-1">Current Location</p>
                  <p className="text-xs text-muted-foreground">
                    Lat: {currentLocation.lat.toFixed(6)}, Lng: {currentLocation.lng.toFixed(6)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Accuracy: ±{Math.round(currentLocation.accuracy)}m
                  </p>
                </div>
              )}
              <Button 
                onClick={handleCheckIn} 
                disabled={isCheckingIn}
                className="w-full"
                size="lg"
              >
                <MapPin className="w-4 h-4 mr-2" />
                {isCheckingIn ? 'Recording Location...' : 'Check In'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Note: Handoff records are permanent and cannot be deleted
              </p>
            </CardContent>
          </Card>

          {/* Handoff History */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Handoff History</CardTitle>
              <CardDescription>All pickup and dropoff records for {selectedChild?.name}</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No handoff logs yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <Card key={log.id} className="border-l-4 border-l-primary">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={log.handoff_type === 'pickup' ? 'default' : 'secondary'}>
                                {log.handoff_type === 'pickup' ? 'Pickup' : 'Dropoff'}
                              </Badge>
                              {log.verified && (
                                <Badge variant="outline" className="bg-green-50 text-green-700">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Verified
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {format(new Date(log.timestamp), 'MMM dd, yyyy h:mm a')}
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {log.latitude.toFixed(6)}, {log.longitude.toFixed(6)}
                              </div>
                              {log.accuracy_meters && (
                                <span>±{Math.round(log.accuracy_meters)}m accuracy</span>
                              )}
                            </div>
                            {log.notes && (
                              <p className="text-sm text-muted-foreground mt-2">{log.notes}</p>
                            )}
                            <Button
                              variant="link"
                              size="sm"
                              className="mt-2 p-0 h-auto"
                              onClick={() => window.open(getMapUrl(log.latitude, log.longitude), '_blank')}
                            >
                              View on Map →
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default VisitationTracker;

