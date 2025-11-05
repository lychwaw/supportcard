import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PhoneCall, Plus, Mail, User } from 'lucide-react';
import { toast } from 'sonner';

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

const Contacts = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    fetchContacts();
  }, [user]);

  const fetchContacts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      if (data) setContacts(data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!user || !name || !phone) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('emergency_contacts')
        .insert({
          user_id: user.id,
          name,
          relationship: relationship || null,
          phone,
          email: email || null,
        });

      if (error) throw error;

      toast.success('Contact added successfully');
      setIsDialogOpen(false);
      setName('');
      setRelationship('');
      setPhone('');
      setEmail('');
      fetchContacts();
    } catch (error) {
      toast.error('Failed to add contact');
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
          <PhoneCall className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Emergency Contacts</h1>
            <p className="text-muted-foreground">Important contacts for emergencies</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Emergency Contact</DialogTitle>
              <DialogDescription>Add an important contact person</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="relationship">Relationship</Label>
                <Input
                  id="relationship"
                  placeholder="Lawyer, Guardian, etc."
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button onClick={handleAddContact} className="w-full">
                Add Contact
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {contacts.length === 0 ? (
          <Card className="col-span-full shadow-soft">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <PhoneCall className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">No emergency contacts yet</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Contact
              </Button>
            </CardContent>
          </Card>
        ) : (
          contacts.map((contact) => (
            <Card 
              key={contact.id} 
              className="shadow-soft hover:shadow-lg transition-all duration-300 hover:border-primary/20 group"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <span className="group-hover:text-primary transition-colors">{contact.name}</span>
                </CardTitle>
                {contact.relationship && (
                  <CardDescription className="mt-1">{contact.relationship}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <a 
                  href={`tel:${contact.phone}`} 
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group/contact"
                >
                  <div className="p-1.5 rounded-full bg-primary/10 group-hover/contact:bg-primary/20 transition-colors">
                    <PhoneCall className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium group-hover/contact:text-primary transition-colors">
                    {contact.phone}
                  </span>
                </a>
                {contact.email && (
                  <a 
                    href={`mailto:${contact.email}`} 
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group/contact"
                  >
                    <div className="p-1.5 rounded-full bg-primary/10 group-hover/contact:bg-primary/20 transition-colors">
                      <Mail className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium group-hover/contact:text-primary transition-colors truncate">
                      {contact.email}
                    </span>
                  </a>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Contacts;
