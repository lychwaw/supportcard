import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar as CalendarIcon, Plus, Edit, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import { format, isPast, isToday, isFuture } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface CalendarEvent {
  id: string;
  event_date: string;
  event_type: string;
  notes: string | null;
  child_id: string | null;
  user_id: string;
  children?: {
    id: string;
    name: string;
  };
  profiles?: {
    id: string;
    full_name: string;
  };
}

const Calendar = () => {
  const { user } = useAuth();
  const { children, isParent } = useRole();
  const { canManageCalendar } = usePermissions();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null);
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  useEffect(() => {
    fetchEvents();
  }, [user]);

  const fetchEvents = async () => {
    if (!user) return;

    try {
      setLoading(true);
      // Get user's children (shared with co-parent)
      const { data: myChildren } = await supabase
        .from('children')
        .select('id')
        .or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`);
      
      const childIds = myChildren?.map(c => c.id) || [];

      // Fetch events for user OR for their children (co-parenting events)
      if (childIds.length > 0) {
        const { data, error } = await supabase
          .from('calendar_events')
          .select(`
            *,
            children:child_id(id, name),
            profiles:user_id(id, full_name)
          `)
          .or(`user_id.eq.${user.id}${childIds.map(id => `,child_id.eq.${id}`).join('')}`)
          .order('event_date', { ascending: true });
        
        if (error) throw error;
        if (data) setEvents(data as CalendarEvent[]);
      } else {
        const { data, error } = await supabase
          .from('calendar_events')
          .select(`
            *,
            children:child_id(id, name),
            profiles:user_id(id, full_name)
          `)
          .eq('user_id', user.id)
          .order('event_date', { ascending: true });
        
        if (error) throw error;
        if (data) setEvents(data as CalendarEvent[]);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load calendar events');
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
          child_id: selectedChildId || null,
          event_date: eventDate,
          event_type: eventType,
          notes: notes || null,
        });

      if (error) throw error;

      toast.success('Event added successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchEvents();
    } catch (error: any) {
      console.error('Error adding event:', error);
      toast.error(error?.message || 'Failed to add event');
    }
  };

  const handleEditEvent = async () => {
    if (!editingEvent || !eventDate || !eventType) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('calendar_events')
        .update({
          child_id: selectedChildId || null,
          event_date: eventDate,
          event_type: eventType,
          notes: notes || null,
        })
        .eq('id', editingEvent.id);

      if (error) throw error;

      toast.success('Event updated successfully');
      setIsEditDialogOpen(false);
      setEditingEvent(null);
      resetForm();
      fetchEvents();
    } catch (error: any) {
      console.error('Error updating event:', error);
      toast.error(error?.message || 'Failed to update event');
    }
  };

  const handleDeleteEvent = async () => {
    if (!deletingEvent) return;

    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', deletingEvent.id);

      if (error) throw error;

      toast.success('Event deleted successfully');
      setIsDeleteDialogOpen(false);
      setDeletingEvent(null);
      fetchEvents();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast.error(error?.message || 'Failed to delete event');
    }
  };

  const resetForm = () => {
    setEventDate('');
    setEventType('');
    setNotes('');
    setSelectedChildId('');
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEventDate(event.event_date);
    setEventType(event.event_type);
    setNotes(event.notes || '');
    setSelectedChildId(event.child_id || '');
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (event: CalendarEvent) => {
    setDeletingEvent(event);
    setIsDeleteDialogOpen(true);
  };

  const getEventStatus = (eventDate: string) => {
    const date = new Date(eventDate);
    if (isPast(date) && !isToday(date)) return { label: 'Past', color: 'bg-muted text-muted-foreground' };
    if (isToday(date)) return { label: 'Today', color: 'bg-primary/10 text-primary' };
    if (isFuture(date)) return { label: 'Upcoming', color: 'bg-success/10 text-success' };
    return { label: 'Today', color: 'bg-primary/10 text-primary' };
  };

  const upcomingEvents = events.filter(e => isFuture(new Date(e.event_date)) || isToday(new Date(e.event_date)));
  const pastEvents = events.filter(e => isPast(new Date(e.event_date)) && !isToday(new Date(e.event_date)));

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
            <p className="text-muted-foreground">Manage custody dates, events, and important occasions</p>
          </div>
        </div>
        {canManageCalendar && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Calendar Event</DialogTitle>
                <DialogDescription>Schedule a co-parenting event, custody day, or important date</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {isParent && children.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="child">Child (Optional)</Label>
                    <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select child (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Family Event</SelectItem>
                        {children.map((child) => (
                          <SelectItem key={child.id} value={child.id}>
                            {child.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="eventDate">Date *</Label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventType">Event Type *</Label>
                  <Input
                    id="eventType"
                    placeholder="e.g., Custody Day, School Event, Doctor Appointment"
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional details, location, time, etc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button onClick={handleAddEvent} className="w-full" disabled={!eventDate || !eventType}>
                  Add Event
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Upcoming Events</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map((event) => {
              const status = getEventStatus(event.event_date);
              return (
                <Card key={event.id} className="shadow-soft hover:shadow-lg transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{event.event_type}</CardTitle>
                        <CardDescription className="mt-1">
                          {format(new Date(event.event_date), 'EEEE, MMMM dd, yyyy')}
                        </CardDescription>
                      </div>
                      <Badge className={status.color}>{status.label}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(event.children || event.profiles) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>
                          {event.children ? event.children.name : event.profiles?.full_name || 'Family Event'}
                        </span>
                      </div>
                    )}
                    {event.notes && (
                      <p className="text-sm text-muted-foreground">{event.notes}</p>
                    )}
                    {canManageCalendar && (
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => openEditDialog(event)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-destructive hover:text-destructive"
                          onClick={() => openDeleteDialog(event)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Past Events</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pastEvents.map((event) => {
              const status = getEventStatus(event.event_date);
              return (
                <Card key={event.id} className="shadow-soft opacity-75">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{event.event_type}</CardTitle>
                        <CardDescription className="mt-1">
                          {format(new Date(event.event_date), 'EEEE, MMMM dd, yyyy')}
                        </CardDescription>
                      </div>
                      <Badge className={status.color}>{status.label}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(event.children || event.profiles) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>
                          {event.children ? event.children.name : event.profiles?.full_name || 'Family Event'}
                        </span>
                      </div>
                    )}
                    {event.notes && (
                      <p className="text-sm text-muted-foreground">{event.notes}</p>
                    )}
                    {canManageCalendar && (
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => openEditDialog(event)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-destructive hover:text-destructive"
                          onClick={() => openDeleteDialog(event)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {events.length === 0 && (
        <Card className="shadow-soft">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarIcon className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No events scheduled</p>
            {canManageCalendar && (
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Event
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Calendar Event</DialogTitle>
            <DialogDescription>Update event details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isParent && children.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="editChild">Child (Optional)</Label>
                <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select child (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Family Event</SelectItem>
                    {children.map((child) => (
                      <SelectItem key={child.id} value={child.id}>
                        {child.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="editEventDate">Date *</Label>
              <Input
                id="editEventDate"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEventType">Event Type *</Label>
              <Input
                id="editEventType"
                placeholder="e.g., Custody Day, School Event"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editNotes">Notes (Optional)</Label>
              <Textarea
                id="editNotes"
                placeholder="Additional details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <Button onClick={handleEditEvent} className="w-full" disabled={!eventDate || !eventType}>
              Update Event
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingEvent?.event_type}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvent} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Calendar;
