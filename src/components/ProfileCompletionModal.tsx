import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { User } from 'lucide-react';

export const ProfileCompletionModal = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [age, setAge] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkProfileCompletion = async () => {
      if (!user) {
        setChecking(false);
        setOpen(false);
        return;
      }

      try {
        // Wait a moment for profile to be created by trigger (if new OAuth user)
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Check if profile exists and has age
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('age')
          .eq('id', user.id)
          .single();

        if (error) {
          // If profile doesn't exist yet, it will be created by trigger
          // Check again after a short delay
          if (error.code === 'PGRST116') {
            setTimeout(async () => {
              const { data: profileRetry } = await supabase
                .from('profiles')
                .select('age')
                .eq('id', user.id)
                .single();

              if (!profileRetry || profileRetry.age === null || profileRetry.age === undefined) {
                setOpen(true);
              }
              setChecking(false);
            }, 1000);
            return;
          } else {
            console.error('Error checking profile:', error);
            setChecking(false);
            return;
          }
        }

        // If age is missing, show modal
        if (!profile || profile.age === null || profile.age === undefined) {
          setOpen(true);
        }
        setChecking(false);
      } catch (error) {
        console.error('Error in profile check:', error);
        setChecking(false);
      }
    };

    checkProfileCompletion();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (!age || (typeof age !== 'number') || age < 13 || age > 120) {
      toast.error('Please enter a valid age (13-120)');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ age: age } as any)
        .eq('id', user.id);

      if (error) {
        console.error('Error updating profile:', error);
        toast.error('Failed to update profile. Please try again.');
      } else {
        toast.success('Profile completed! Your role has been assigned based on your age.');
        setOpen(false);
        // Role will be updated automatically by the trigger
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render anything while checking or if user is not logged in
  if (checking || !user) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              <User className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle>Complete Your Profile</DialogTitle>
          </div>
          <DialogDescription>
            We need your age to assign the correct role. Users under 18 will be assigned the child role,
            while users 18 and older will be assigned the parent role.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="age">Your Age</Label>
              <Input
                id="age"
                type="number"
                min="13"
                max="120"
                placeholder="Enter your age"
                value={age}
                onChange={(e) => {
                  const value = e.target.value;
                  setAge(value === '' ? '' : parseInt(value, 10));
                }}
                disabled={isLoading}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Must be between 13 and 120 years old
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading || !age || (typeof age === 'number' && (age < 13 || age > 120))}>
              {isLoading ? 'Saving...' : 'Save & Continue'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

