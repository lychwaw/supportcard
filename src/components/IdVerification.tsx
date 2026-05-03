import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ShieldCheck, ShieldX, ShieldAlert, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

interface VerificationResult {
  verified: boolean;
  reference: string | null;
  deceased_status: string | null;
  country_of_birth: string | null;
  on_hanis: string | null;
  is_smart_card_issued: string | null;
  validation: {
    first_name: { value: string; match: boolean } | null;
    last_name:  { value: string; match: boolean } | null;
  };
}

// Client-side SA ID Luhn validation — mirrors the server-side check.
const validateSAId = (id: string): string | null => {
  if (!/^\d{13}$/.test(id)) return 'Must be exactly 13 digits';
  const month = parseInt(id.slice(2, 4), 10);
  const day   = parseInt(id.slice(4, 6), 10);
  if (month < 1 || month > 12) return 'Invalid birth month';
  if (day < 1 || day > 31)     return 'Invalid birth day';
  if (id[10] !== '0' && id[10] !== '1') return 'Invalid citizenship digit (position 11)';
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    let d = parseInt(id[i], 10);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  if ((10 - (sum % 10)) % 10 !== parseInt(id[12], 10)) return 'Checksum invalid — double-check the number';
  return null;
};

export const IdVerification = () => {
  const { user } = useAuth();

  const [idVerified, setIdVerified]       = useState<boolean | null>(null);
  const [idVerifiedAt, setIdVerifiedAt]   = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);
  const [showForm, setShowForm]           = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [result, setResult]               = useState<VerificationResult | null>(null);

  // Form fields
  const [idNumber, setIdNumber]           = useState('');
  const [idError, setIdError]             = useState<string | null>(null);
  const [firstName, setFirstName]         = useState('');
  const [lastName, setLastName]           = useState('');
  const [consent, setConsent]             = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchStatus();
  }, [user]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id_verified, id_verified_at')
        .eq('id', user!.id)
        .maybeSingle();

      setIdVerified(data?.id_verified ?? false);
      setIdVerifiedAt(data?.id_verified_at ?? null);
    } catch {
      setIdVerified(false);
    } finally {
      setLoading(false);
    }
  };

  const handleIdChange = (value: string) => {
    // Strip non-digits as the user types.
    const digits = value.replace(/\D/g, '').slice(0, 13);
    setIdNumber(digits);
    setIdError(digits.length === 13 ? validateSAId(digits) : null);
  };

  const handleSubmit = async () => {
    const validationError = validateSAId(idNumber);
    if (validationError) {
      setIdError(validationError);
      return;
    }

    if (!consent) {
      toast.error('You must give consent before verification can proceed');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/korapay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          action:                'verify-id',
          id_number:             idNumber,
          first_name:            firstName.trim() || undefined,
          last_name:             lastName.trim()  || undefined,
          verification_consent:  true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data?.error || 'Verification failed');
        return;
      }

      setResult(data as VerificationResult);

      if (data.verified) {
        toast.success('Identity verified successfully');
        setIdVerified(true);
        setIdVerifiedAt(new Date().toISOString());
        setShowForm(false);
      } else {
        toast.error('Verification unsuccessful. Check the details and try again.');
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      // Always clear the ID number from state once the request completes.
      setIdNumber('');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-soft">
        <CardContent className="flex items-center gap-2 py-6 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading verification status…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`shadow-soft border-2 ${
      idVerified ? 'border-green-400/40' : 'border-border'
    }`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {idVerified ? (
              <ShieldCheck className="w-5 h-5 text-green-600" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-yellow-600" />
            )}
            <CardTitle className="text-base">South African Identity Verification</CardTitle>
          </div>
          <Badge
            variant={idVerified ? 'default' : 'secondary'}
            className={idVerified ? 'bg-green-100 text-green-800 border-green-300' : ''}
          >
            {idVerified ? 'Verified' : 'Not Verified'}
          </Badge>
        </div>
        <CardDescription>
          {idVerified
            ? `Your SA ID was verified against HANIS on ${idVerifiedAt ? format(new Date(idVerifiedAt), 'MMM d, yyyy') : 'record'}.`
            : 'Verify your South African ID number against the Department of Home Affairs (HANIS) database.'}
        </CardDescription>
      </CardHeader>

      {!idVerified && (
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? (
              <><ChevronUp className="w-4 h-4 mr-2" />Hide Form</>
            ) : (
              <><ChevronDown className="w-4 h-4 mr-2" />Verify My SA ID Number</>
            )}
          </Button>

          {showForm && (
            <div className="space-y-4 pt-2 border-t">
              {/* SA ID number */}
              <div className="space-y-2">
                <Label htmlFor="idNumber">
                  SA ID Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="idNumber"
                  type="text"
                  inputMode="numeric"
                  placeholder="13-digit ID number"
                  value={idNumber}
                  onChange={(e) => handleIdChange(e.target.value)}
                  maxLength={13}
                  autoComplete="off"
                  className={idError ? 'border-destructive' : ''}
                />
                {idError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <ShieldX className="w-3 h-3" />
                    {idError}
                  </p>
                )}
                {idNumber.length === 13 && !idError && (
                  <p className="text-xs text-green-600">Format looks valid</p>
                )}
              </div>

              {/* Optional name matching */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    id="firstName"
                    placeholder="For name matching"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    id="lastName"
                    placeholder="For name matching"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                Providing your names allows SupportCard to confirm they match the government record.
              </p>

              {/* Consent */}
              <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30">
                <Checkbox
                  id="consent"
                  checked={consent}
                  onCheckedChange={(v) => setConsent(!!v)}
                />
                <label htmlFor="consent" className="text-xs leading-relaxed cursor-pointer">
                  I consent to SupportCard verifying my South African ID number against the
                  Department of Home Affairs (HANIS/NPR) database via KoraPay's identity
                  verification service. I understand this is a one-time check and my ID
                  number will not be stored.
                </label>
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={isSubmitting || !!idError || idNumber.length !== 13 || !consent}
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</>
                ) : (
                  'Submit Verification'
                )}
              </Button>
            </div>
          )}

          {/* Show result after a failed attempt */}
          {result && !result.verified && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
              <p className="text-sm font-medium text-destructive flex items-center gap-2">
                <ShieldX className="w-4 h-4" />
                Verification unsuccessful
              </p>
              {result.deceased_status && result.deceased_status !== 'alive' && (
                <p className="text-xs text-destructive">
                  The ID record shows deceased status: {result.deceased_status}
                </p>
              )}
              {result.validation.first_name && (
                <p className="text-xs text-muted-foreground">
                  First name match: {result.validation.first_name.match ? '✓ Yes' : '✗ No'}
                </p>
              )}
              {result.validation.last_name && (
                <p className="text-xs text-muted-foreground">
                  Last name match: {result.validation.last_name.match ? '✓ Yes' : '✗ No'}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Reference: {result.reference ?? '–'}
              </p>
            </div>
          )}
        </CardContent>
      )}

      {/* Verified state — show a summary */}
      {idVerified && result && (
        <CardContent>
          <div className="space-y-2 text-sm">
            {result.country_of_birth && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Country of birth</span>
                <span className="font-medium">{result.country_of_birth}</span>
              </div>
            )}
            {result.is_smart_card_issued && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Smart ID card issued</span>
                <span className="font-medium">{result.is_smart_card_issued}</span>
              </div>
            )}
            {result.on_hanis && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">On HANIS</span>
                <span className="font-medium">{result.on_hanis}</span>
              </div>
            )}
            {result.reference && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">KoraPay ref</span>
                <span className="font-mono">{result.reference}</span>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
