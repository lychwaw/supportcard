import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface SubscriptionGateProps {
  title: string;
  description: string;
  ctaText?: string;
}

const SubscriptionGate = ({ title, description, ctaText = 'View Plans' }: SubscriptionGateProps) => {
  const navigate = useNavigate();

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => navigate('/subscriptions')}>{ctaText}</Button>
      </CardContent>
    </Card>
  );
};

export default SubscriptionGate;


