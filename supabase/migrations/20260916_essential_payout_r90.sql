-- Essential pays one month of its ZAR price, R90, matching Plus (R130) and
-- Premium (R270). The earlier migration used R70, which was not one month of
-- the R89.99 Essential price.
--
-- Only partners still on the standard rates move. A custom deal keeps its own
-- Essential rate.

alter table public.partners
  alter column payout_essential_cents set default 9000;

update public.partners
   set payout_essential_cents = 9000
 where payout_essential_cents = 7000
   and payout_plus_cents      = 13000
   and payout_premium_cents   = 27000;
