-- Companies feed everyone's shared job pool, so only the service role may add them
-- (followCompany validates the board with detectAts and a non-empty fetch first).
drop policy companies_insert on public.companies;
