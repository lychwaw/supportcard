import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Plus,
  UserCircle,
  Users,
  Mail,
  Phone,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Heart,
  Baby,
  Crown,
  Scale,
  ArrowUpRight,
  ShieldOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { InviteCoParent } from '@/components/InviteCoParent';
import { InviteProfessional } from '@/components/InviteProfessional';
import { AccountSwitcher } from '@/components/AccountSwitcher';
import SubscriptionGate from '@/components/SubscriptionGate';
import { useNavigate } from 'react-router-dom';

interface CoParentInfo {
  id: string;
  full_name: string | null;
  email: string | null;
  parent_role: string | null;
  avatar_url: string | null;
  phone: string | null;
}

const CUSTODY_SPLITS = [50, 60, 70, 80];

interface ChildWithDetails {
  id: string;
  name: string;
  user_id: string | null;
  co_parent_id: string | null;
  custody_split_pct: number;
  coParent?: CoParentInfo | null;
}

interface FamilyMember {
  id: string;
  full_name: string | null;
  email: string | null;
  parent_role: string | null;
  avatar_url: string | null;
  phone: string | null;
  isCurrentUser?: boolean;
}

interface ProfessionalLink {
  id: string;
  invited_email: string;
  status: string;
  created_at: string;
  professional?: { full_name: string | null; email: string | null } | null;
}

const Family = () => {
  const { user } = useAuth();
  const { refreshChildren, isParent } = useRole();
  const { canManageChildren, canInviteProfessional } = usePermissions();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [childName, setChildName] = useState('');
  const [custodySplit, setCustodySplit] = useState('50');
  const [isLoading, setIsLoading] = useState(false);
  const [updatingSplitId, setUpdatingSplitId] = useState<string | null>(null);
  const [childrenWithDetails, setChildrenWithDetails] = useState<ChildWithDetails[]>([]);
  const [coParent, setCoParent] = useState<CoParentInfo | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [professionalLinks, setProfessionalLinks] = useState<ProfessionalLink[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user?.id]);

  const loadAllData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await Promise.all([
        fetchFamilyData(),
        fetchChildrenDetails(),
        findCoParent(),
        fetchProfessionalLinks(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFamilyData = async () => {
    if (!user) return;

    try {
      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('id, full_name, email, parent_role, avatar_url, phone, family_id')
        .eq('id', user.id)
        .single();

      const members: FamilyMember[] = [];

      if (currentUserProfile) {
        members.push({ ...currentUserProfile, isCurrentUser: true });
      }

      setFamilyMembers(members);
    } catch (error) {
      console.error('Error fetching family data:', error);
    }
  };

  const findCoParent = async () => {
    if (!user) return;

    try {
      // Find any child where the current user is the co-parent, then look up that child's primary parent
      const { data: asCoParent } = await supabase
        .from('children')
        .select('parent_id')
        .eq('co_parent_id', user.id)
        .limit(1)
        .maybeSingle();

      if (asCoParent?.parent_id) {
        const { data: parentProfile } = await supabase
          .from('profiles')
          .select('id, full_name, email, parent_role, avatar_url, phone')
          .eq('id', asCoParent.parent_id)
          .maybeSingle();

        setCoParent(parentProfile ?? null);
        return;
      }

      // Alternatively, find a child this user owns that has a co-parent assigned
      const { data: ownedChild } = await supabase
        .from('children')
        .select('co_parent_id')
        .eq('parent_id', user.id)
        .not('co_parent_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (ownedChild?.co_parent_id) {
        const { data: coParentProfile } = await supabase
          .from('profiles')
          .select('id, full_name, email, parent_role, avatar_url, phone')
          .eq('id', ownedChild.co_parent_id)
          .maybeSingle();

        setCoParent(coParentProfile ?? null);
        return;
      }

      setCoParent(null);
    } catch (error) {
      console.error('Error finding co-parent:', error);
    }
  };

  const fetchChildrenDetails = async () => {
    if (!user) {
      console.log('❌ No user, skipping fetch');
      return;
    }

    try {
      const { data: freshChildren, error } = await (supabase as any)
        .from('children')
        .select('id, name, user_id, co_parent_id, custody_split_pct, parent_id')
        .or(`parent_id.eq.${user.id},co_parent_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching children:', error);
        setChildrenWithDetails([]);
        return;
      }

      const children = freshChildren || [];

      if (children.length === 0) {
        setChildrenWithDetails([]);
        return;
      }

      // Try to get co_parent_id if column exists, but don't fail if it doesn't
      const childrenData = await Promise.all(
        children.map(async (child: any) => {
          let coParent: CoParentInfo | null = null;
          
          // Only try to fetch co-parent if co_parent_id exists in the data
          if (child.co_parent_id) {
            try {
              const { data } = await supabase
                .from('profiles')
                .select('id, full_name, email, parent_role, avatar_url, phone')
                .eq('id', child.co_parent_id)
                .single();
              
              if (data) {
                coParent = {
                  id: data.id,
                  full_name: data.full_name,
                  email: data.email,
                  parent_role: data.parent_role,
                  avatar_url: data.avatar_url,
                  phone: data.phone,
                };
              }
            } catch (e) {
              // Ignore errors fetching co-parent
            }
          }

          return {
            id: child.id,
            name: child.name,
            user_id: child.user_id,
            co_parent_id: child.co_parent_id || null,
            coParent,
            custody_split_pct: child.custody_split_pct ?? 50,
          } as ChildWithDetails;
        })
      );

      setChildrenWithDetails(childrenData);
    } catch (error) {
      console.error('Error fetching children details:', error);
      setChildrenWithDetails([]);
    }
  };

  const handleAddChild = async () => {
    if (!user || !childName) {
      toast.error('Please enter a name');
      return;
    }

    setIsLoading(true);
    try {
      const { data: insertedChild, error } = await (supabase as any)
        .from('children')
        .insert({
          parent_id: user.id,
          name: childName,
          custody_split_pct: parseInt(custodySplit, 10) || 50,
        })
        .select()
        .single();

      if (error) throw error;

      // Close dialog and clear form immediately
      setChildName('');
      setCustodySplit('50');
      setIsDialogOpen(false);
      
      toast.success(`✨ ${childName} added successfully!`);
      
      // Give the DB trigger a moment then refresh
      await new Promise(resolve => setTimeout(resolve, 400));
      await fetchChildrenDetails();
      
      // Also refresh other components
      await refreshChildren();
      await fetchFamilyData();
      await findCoParent();
      
      // Trigger global refresh for other pages
      window.dispatchEvent(new CustomEvent('children-updated'));
    } catch (error: any) {
      console.error('❌ Error adding child:', error);
      toast.error(error?.message || 'Failed to add child');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfessionalLinks = async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase as any)
        .from('professional_links')
        .select('id, invited_email, status, created_at, professional:professional_id(full_name, email)')
        .eq('parent_id', user.id)
        .neq('status', 'revoked')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfessionalLinks(data || []);
    } catch (error) {
      console.error('Error fetching professional links:', error);
      setProfessionalLinks([]);
    }
  };

  const handleRevokeProfessional = async (linkId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('professional_links')
        .update({ status: 'revoked' })
        .eq('id', linkId);

      if (error) throw error;
      toast.success('Access revoked');
      fetchProfessionalLinks();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to revoke access');
    }
  };

  const handleUpdateSplit = async (childId: string, pct: string) => {
    setUpdatingSplitId(childId);
    try {
      const { error } = await (supabase as any)
        .from('children')
        .update({ custody_split_pct: parseInt(pct, 10) || 50 })
        .eq('id', childId);

      if (error) throw error;

      setChildrenWithDetails(prev =>
        prev.map(c => (c.id === childId ? { ...c, custody_split_pct: parseInt(pct, 10) || 50 } : c))
      );
      toast.success('Custody split updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update custody split');
    } finally {
      setUpdatingSplitId(null);
    }
  };

  const getParentRoleBadge = (role: string | null) => {
    switch (role) {
      case 'payer':
        return <Badge className="bg-primary/10 text-primary border-primary/20"><ArrowUpRight className="w-3 h-3 mr-1" />Payer</Badge>;
      case 'receiver':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><Heart className="w-3 h-3 mr-1" />Receiver</Badge>;
      case 'both':
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20"><Crown className="w-3 h-3 mr-1" />Both</Badge>;
      default:
        return null;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-primary flex items-center justify-center shadow-brand ring-2 ring-primary/20">
            <Users className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Family Management</h1>
            <p className="text-muted-foreground">Manage your family members and children</p>
          </div>
        </div>
        {isParent && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Child
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Child</DialogTitle>
                <DialogDescription>
                  Create a new child profile for support tracking
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="child-name">Child's Name *</Label>
                  <Input
                    id="child-name"
                    placeholder="Enter name"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custody-split">Custody Split</Label>
                  <Select value={custodySplit} onValueChange={setCustodySplit} disabled={isLoading}>
                    <SelectTrigger id="custody-split">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CUSTODY_SPLITS.map(pct => (
                        <SelectItem key={pct} value={String(pct)}>
                          {pct}/{100 - pct}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Your share of shared expenses for this child</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button onClick={handleAddChild} disabled={isLoading}>
                  {isLoading ? 'Adding...' : 'Add Child'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <AccountSwitcher />

      {/* Family Members Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Family Members</h2>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          {familyMembers.map((member) => (
            <Card key={member.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-primary/20">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                      {member.full_name?.charAt(0) || member.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">
                        {member.full_name || member.email || 'Unknown'}
                      </CardTitle>
                      {member.isCurrentUser && (
                        <Badge variant="secondary" className="gap-1">
                          <Sparkles className="w-3 h-3" />
                          You
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {member.parent_role && getParentRoleBadge(member.parent_role)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {member.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>{member.email}</span>
                  </div>
                )}
                {member.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{member.phone}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {familyMembers.length === 0 && (
            <Card className="col-span-full border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <UserCircle className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">No family members found</p>
                <p className="text-xs text-muted-foreground">Add a child to connect with co-parents</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Children Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Baby className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Children</h2>
          {childrenWithDetails.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {childrenWithDetails.length}
            </Badge>
          )}
        </div>

        {childrenWithDetails.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Baby className="w-10 h-10 text-primary" />
              </div>
              <p className="text-lg font-medium mb-2">No children added yet</p>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                Create a child profile to start tracking support payments and invite a co-parent
              </p>
              {isParent && (
                canManageChildren ? (
                  <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Your First Child
                  </Button>
                ) : (
                  <Button onClick={() => navigate('/subscriptions')} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Upgrade to add a child
                  </Button>
                )
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {childrenWithDetails.map((child, index) => (
              <Card
                key={child.id}
                className="hover:shadow-lg transition-all hover:scale-[1.02] group"
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Baby className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {child.name}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {child.user_id ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="w-3 h-3" />
                              Account Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-yellow-600">
                              <AlertCircle className="w-3 h-3" />
                              Pending Setup
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Scale className="w-3 h-3" aria-hidden="true" />
                        Custody Split
                      </span>
                      <Select
                        value={String(child.custody_split_pct)}
                        onValueChange={(v) => handleUpdateSplit(child.id, v)}
                        disabled={updatingSplitId === child.id}
                      >
                        <SelectTrigger className="h-7 w-24 text-xs" aria-label={`Custody split for ${child.name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CUSTODY_SPLITS.map(pct => (
                            <SelectItem key={pct} value={String(pct)}>
                              {pct}/{100 - pct}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your share of shared expenses used in the Receipt Ledger 50/50 calculator
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {child.coParent ? (
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-2">
                        <UserPlus className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-900 dark:text-green-100">
                          Co-Parent Connected
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 border border-green-300">
                          <AvatarImage src={child.coParent.avatar_url || undefined} />
                          <AvatarFallback className="bg-green-100 text-green-700 text-xs">
                            {child.coParent.full_name?.charAt(0) || child.coParent.email?.charAt(0) || 'C'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {child.coParent.full_name || child.coParent.email || 'Unknown'}
                          </p>
                        </div>
                        {child.coParent.parent_role && (
                          <Badge variant="outline" className="text-xs">
                            {child.coParent.parent_role}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                          No Co-Parent
                        </span>
                      </div>
                      <InviteCoParent 
                        childId={child.id} 
                        childName={child.name}
                        onInviteSent={loadAllData}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Professionals Section */}
      {isParent && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Professionals</h2>
              {professionalLinks.length > 0 && (
                <Badge variant="secondary" className="ml-2">{professionalLinks.length}</Badge>
              )}
            </div>
            {canInviteProfessional && <InviteProfessional onInviteSent={fetchProfessionalLinks} />}
          </div>

          {!canInviteProfessional ? (
            <SubscriptionGate
              title="Inviting a professional is a Premium feature"
              description="Give a lawyer or mediator read-only access to your family's records."
              ctaText="Upgrade to Premium"
            />
          ) : professionalLinks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Scale className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">No professionals linked yet</p>
                <p className="text-xs text-muted-foreground mt-1">Invite a lawyer or mediator for read-only access</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {professionalLinks.map((link) => (
                <Card key={link.id}>
                  <CardContent className="pt-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {link.professional?.full_name || link.invited_email}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={link.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {link.status === 'active' ? 'Active' : 'Pending'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Read-only</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => handleRevokeProfessional(link.id)}
                      aria-label={`Revoke access for ${link.professional?.full_name || link.invited_email}`}
                    >
                      <ShieldOff className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Family;
