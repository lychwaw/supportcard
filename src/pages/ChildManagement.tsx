import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/contexts/RoleContext';
import { usePermissionContext } from '@/components/PermissionProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  UserCircle, 
  Mail, 
  Key, 
  Edit, 
  Trash2, 
  Settings, 
  Shield, 
  CreditCard,
  DollarSign,
  Calendar,
  Users,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import { ParentOnly } from '@/components/ProtectedComponent';
import { AvatarUpload } from '@/components/FileUpload';
import { uploadAvatar } from '@/lib/file-upload';

interface Child {
  id: string;
  name: string;
  user_id: string | null;
  avatar_url: string | null;
  target_amount: number;
  current_amount: number;
  monthly_limit: number;
  daily_limit: number;
  is_active: boolean;
  created_at: string;
}

const ChildManagementPage = () => {
  const { user } = useAuth();
  const { children, refreshChildren } = useRole();
  const { isParent } = usePermissionContext();
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  
  // Form states
  const [childName, setChildName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [createAccount, setCreateAccount] = useState(false);
  const [childEmail, setChildEmail] = useState('');
  const [childPassword, setChildPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchChildren();
  }, [user]);

  const fetchChildren = async () => {
    if (!user) return;

    try {
      // For demo purposes, use localStorage
      const demoChildren = JSON.parse(localStorage.getItem('demo_children') || '[]');
      const userChildren = demoChildren.filter((child: any) => child.parent_id === user.id);
      setChildrenList(userChildren);
    } catch (error) {
      console.error('Error fetching children:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddChild = async () => {
    if (!user || !childName || !targetAmount) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (createAccount && (!childEmail || !childPassword)) {
      toast.error('Please provide email and password for child account');
      return;
    }

    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newChild: Child = {
        id: Math.random().toString(36).substr(2, 9),
        name: childName,
        target_amount: parseFloat(targetAmount),
        current_amount: 0,
        monthly_limit: parseFloat(monthlyLimit) || 0,
        daily_limit: parseFloat(dailyLimit) || 0,
        avatar_url: avatarUrl || null,
        user_id: createAccount ? Math.random().toString(36).substr(2, 9) : null,
        parent_id: user.id,
        is_active: isActive,
        created_at: new Date().toISOString(),
      };

      const existingChildren = JSON.parse(localStorage.getItem('demo_children') || '[]');
      existingChildren.push(newChild);
      localStorage.setItem('demo_children', JSON.stringify(existingChildren));

      toast.success(`${childName} added successfully${createAccount ? ' with login account' : ''}!`);
      resetForm();
      setIsAddDialogOpen(false);
      await fetchChildren();
    } catch (error) {
      console.error('Error adding child:', error);
      toast.error('Failed to add child');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditChild = (child: Child) => {
    setSelectedChild(child);
    setChildName(child.name);
    setTargetAmount(child.target_amount.toString());
    setMonthlyLimit(child.monthly_limit.toString());
    setDailyLimit(child.daily_limit.toString());
    setAvatarUrl(child.avatar_url || '');
    setIsActive(child.is_active);
    setIsEditDialogOpen(true);
  };

  const handleUpdateChild = async () => {
    if (!selectedChild || !childName || !targetAmount) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const existingChildren = JSON.parse(localStorage.getItem('demo_children') || '[]');
      const updatedChildren = existingChildren.map((child: Child) => 
        child.id === selectedChild.id 
          ? {
              ...child,
              name: childName,
              target_amount: parseFloat(targetAmount),
              monthly_limit: parseFloat(monthlyLimit) || 0,
              daily_limit: parseFloat(dailyLimit) || 0,
              avatar_url: avatarUrl || null,
              is_active: isActive,
            }
          : child
      );
      localStorage.setItem('demo_children', JSON.stringify(updatedChildren));

      toast.success(`${childName} updated successfully!`);
      resetForm();
      setIsEditDialogOpen(false);
      setSelectedChild(null);
      await fetchChildren();
    } catch (error) {
      console.error('Error updating child:', error);
      toast.error('Failed to update child');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteChild = async (childId: string, childName: string) => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const existingChildren = JSON.parse(localStorage.getItem('demo_children') || '[]');
      const updatedChildren = existingChildren.filter((child: Child) => child.id !== childId);
      localStorage.setItem('demo_children', JSON.stringify(updatedChildren));

      toast.success(`${childName} deleted successfully!`);
      await fetchChildren();
    } catch (error) {
      console.error('Error deleting child:', error);
      toast.error('Failed to delete child');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setChildName('');
    setTargetAmount('');
    setMonthlyLimit('');
    setDailyLimit('');
    setAvatarUrl('');
    setCreateAccount(false);
    setChildEmail('');
    setChildPassword('');
    setIsActive(true);
  };

  if (!isParent) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">Only parents can access child management.</p>
        </div>
      </div>
    );
  }

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
          <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Child Management
            </h1>
            <p className="text-muted-foreground">Manage your children's accounts and spending limits</p>
          </div>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Child
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Child</DialogTitle>
              <DialogDescription>
                Create a new child account with spending limits and permissions
              </DialogDescription>
            </DialogHeader>
            <ChildForm
              childName={childName}
              setChildName={setChildName}
              targetAmount={targetAmount}
              setTargetAmount={setTargetAmount}
              monthlyLimit={monthlyLimit}
              setMonthlyLimit={setMonthlyLimit}
              dailyLimit={dailyLimit}
              setDailyLimit={setDailyLimit}
              avatarUrl={avatarUrl}
              setAvatarUrl={setAvatarUrl}
              createAccount={createAccount}
              setCreateAccount={setCreateAccount}
              childEmail={childEmail}
              setChildEmail={setChildEmail}
              childPassword={childPassword}
              setChildPassword={setChildPassword}
              isActive={isActive}
              setIsActive={setIsActive}
              isLoading={isLoading}
              onSubmit={handleAddChild}
              submitText="Add Child"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Total Children</span>
            </div>
            <div className="text-2xl font-bold mt-2">{childrenList.length}</div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Active Accounts</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {childrenList.filter(c => c.is_active).length}
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Total Limits</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              R{childrenList.reduce((sum, c) => sum + c.monthly_limit, 0).toFixed(0)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">With Login</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {childrenList.filter(c => c.user_id).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Children List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {childrenList.map((child) => (
          <Card key={child.id} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={child.avatar_url || undefined} alt={child.name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                      {child.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{child.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={child.is_active ? "default" : "secondary"}>
                        {child.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {child.user_id && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Key className="h-3 w-3" />
                          Login Enabled
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditChild(child)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Child Account</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {child.name}'s account? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteChild(child.id, child.name)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Target Amount</span>
                  <div className="font-medium">R{child.target_amount.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Current Amount</span>
                  <div className="font-medium">R{child.current_amount.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Monthly Limit</span>
                  <div className="font-medium">R{child.monthly_limit.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Daily Limit</span>
                  <div className="font-medium">R{child.daily_limit.toFixed(2)}</div>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {((child.current_amount / child.target_amount) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 mt-1">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ 
                      width: `${Math.min((child.current_amount / child.target_amount) * 100, 100)}%` 
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {childrenList.length === 0 && (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Children Added Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start by adding your first child to manage their support payments and spending limits.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Child
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Child Account</DialogTitle>
            <DialogDescription>
              Update {selectedChild?.name}'s account settings and limits
            </DialogDescription>
          </DialogHeader>
          <ChildForm
            childName={childName}
            setChildName={setChildName}
            targetAmount={targetAmount}
            setTargetAmount={setTargetAmount}
            monthlyLimit={monthlyLimit}
            setMonthlyLimit={setMonthlyLimit}
            dailyLimit={dailyLimit}
            setDailyLimit={setDailyLimit}
            avatarUrl={avatarUrl}
            setAvatarUrl={setAvatarUrl}
            createAccount={createAccount}
            setCreateAccount={setCreateAccount}
            childEmail={childEmail}
            setChildEmail={setChildEmail}
            childPassword={childPassword}
            setChildPassword={setChildPassword}
            isActive={isActive}
            setIsActive={setIsActive}
            isLoading={isLoading}
            onSubmit={handleUpdateChild}
            submitText="Update Child"
            isEdit={true}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Reusable Child Form Component
const ChildForm = ({
  childName,
  setChildName,
  targetAmount,
  setTargetAmount,
  monthlyLimit,
  setMonthlyLimit,
  dailyLimit,
  setDailyLimit,
  avatarUrl,
  setAvatarUrl,
  createAccount,
  setCreateAccount,
  childEmail,
  setChildEmail,
  childPassword,
  setChildPassword,
  isActive,
  setIsActive,
  isLoading,
  onSubmit,
  submitText,
  isEdit = false
}: any) => (
  <div className="space-y-6">
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="basic">Basic Info</TabsTrigger>
        <TabsTrigger value="limits">Spending Limits</TabsTrigger>
        <TabsTrigger value="account">Account Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="child-name">Child's Name *</Label>
            <Input
              id="child-name"
              placeholder="Enter child's name"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Avatar</Label>
            <div className="space-y-2">
              <Input
                id="avatar-url"
                placeholder="https://example.com/avatar.jpg"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                disabled={isLoading}
              />
              <div className="text-center text-sm text-muted-foreground">or</div>
              <AvatarUpload
                onUploadComplete={(result) => {
                  if (result.success && result.url) {
                    setAvatarUrl(result.url);
                    toast.success('Avatar uploaded successfully!');
                  }
                }}
                className="max-w-xs mx-auto"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-amount">Monthly Support Target *</Label>
            <Input
              id="target-amount"
              type="number"
              placeholder="0.00"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isLoading}
            />
            <Label htmlFor="is-active">Account is active</Label>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="limits" className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="monthly-limit">Monthly Spending Limit (R)</Label>
            <Input
              id="monthly-limit"
              type="number"
              placeholder="0.00"
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Maximum amount the child can spend per month
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="daily-limit">Daily Spending Limit (R)</Label>
            <Input
              id="daily-limit"
              type="number"
              placeholder="0.00"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Maximum amount the child can spend per day
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="account" className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="create-account"
              checked={createAccount}
              onCheckedChange={setCreateAccount}
              disabled={isLoading || isEdit}
            />
            <Label htmlFor="create-account">
              {isEdit ? 'Child has login account' : 'Create login account for child'}
            </Label>
          </div>

          {createAccount && (
            <div className="space-y-4 pl-6 border-l-2 border-muted">
              <div className="space-y-2">
                <Label htmlFor="child-email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Address
                </Label>
                <Input
                  id="child-email"
                  type="email"
                  placeholder="child@example.com"
                  value={childEmail}
                  onChange={(e) => setChildEmail(e.target.value)}
                  disabled={isLoading || isEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="child-password" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Password
                </Label>
                <Input
                  id="child-password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={childPassword}
                  onChange={(e) => setChildPassword(e.target.value)}
                  disabled={isLoading || isEdit}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The child will be able to log in with limited permissions
              </p>
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>

    <DialogFooter>
      <Button variant="outline" onClick={() => {}} disabled={isLoading}>
        Cancel
      </Button>
      <Button onClick={onSubmit} disabled={isLoading}>
        {isLoading ? 'Processing...' : submitText}
      </Button>
    </DialogFooter>
  </div>
);

export default ChildManagementPage;
