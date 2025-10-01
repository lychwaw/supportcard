import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface CalendarEvent {
  id: string;
  event_date: string;
  event_type: string;
  notes: string;
}

const Calendar = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchEvents();
  }, [user]);

  const fetchEvents = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .order('event_date', { ascending: true });

      if (error) throw error;
      if (data) setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = async () => {
    if (!user || !eventDate || !eventType) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('calendar_events')
        .insert({
          user_id: user.id,
          event_date: eventDate,
          event_type: eventType,
          notes: notes || null,
        });

      if (error) throw error;

      toast.success('Event added successfully');
      setIsDialogOpen(false);
      setEventDate('');
      setEventType('');
      setNotes('');
      fetchEvents();
    } catch (error) {
      toast.error('Failed to add event');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Co-Parenting Calendar</h1>
            <p className="text-muted-foreground">Manage custody and important dates</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Calendar Event</DialogTitle>
              <DialogDescription>Schedule a co-parenting event or custody day</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="eventDate">Date</Label>
                <Input
                  id="eventDate"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eventType">Event Type</Label>
                <Input
                  id="eventType"
                  placeholder="e.g., Custody Day, School Event"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <Button onClick={handleAddEvent} className="w-full">
                Add Event
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {events.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarIcon className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">No events scheduled</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Event
              </Button>
            </CardContent>
          </Card>
        ) : (
          events.map((event) => (
            <Card key={event.id} className="shadow-soft">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{event.event_type}</CardTitle>
                    <CardDescription>
                      {format(new Date(event.event_date), 'EEEE, MMMM dd, yyyy')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              {event.notes && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{event.notes}</p>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Calendar;
