import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const SubscriptionPromptModal = () => {
  const { user } = useAuth();
  const { tier, loading } = useSubscription();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || loading) return;
    const promptKey = `supportcard_subscription_prompted_${user.id}`;
    const alreadyPrompted = localStorage.getItem(promptKey);

    if (!alreadyPrompted) {
      setOpen(true);
    }
  }, [user, loading, tier]);

  const handleDismiss = () => {
    if (!user) return;
    localStorage.setItem(`supportcard_subscription_prompted_${user.id}`, 'true');
    setOpen(false);
  };

  const handleChoosePlan = () => {
    handleDismiss();
    navigate('/subscriptions');
  };

  if (!user || loading) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Choose your subscription</DialogTitle>
          <DialogDescription>
            Pick the plan that matches your needs. You can start free and upgrade anytime.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleDismiss}>
            Stay on Free
          </Button>
          <Button onClick={handleChoosePlan}>Choose Plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionPromptModal;


