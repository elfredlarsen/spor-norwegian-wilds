# Kør multiplayer-migrationen på backenden

Filen `supabase/migrations/20260921120000_multiplayer_pairing.sql` opretter det delte skov-rum for to parrede ræve: parringer, verdensstatus (vejr + hi), placeringer og fodspor — plus adgangsregler, så kun de to deltagere kan se og ændre deres egen skov.

## Hvad der køres

1. Migrationen anvendes præcis som den ligger i filen (uændret indhold).
2. En lille opfølgende migration tilføjer de adgangsrettigheder (GRANT), som filen mangler. Uden dem vil appen få "permission denied", selv om reglerne er korrekte.

## Teknisk

Første migration: filens SQL byte-for-byte via migrationsværktøjet — 4 tabeller, unikke indeks, `is_pairing_member()` security-definer-funktion, RLS + policies, realtime-publikation.

Anden migration (`multiplayer_pairing_grants`):

```sql
GRANT SELECT, INSERT, UPDATE ON public.pairings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.world_state TO authenticated;
GRANT SELECT, INSERT ON public.placements TO authenticated;
GRANT SELECT, INSERT ON public.footprints TO authenticated;
GRANT ALL ON public.pairings, public.world_state, public.placements, public.footprints TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.footprints_id_seq TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pairing_member(uuid) TO authenticated;
```

Ingen `anon`-adgang: alle policies er bundet til `auth.uid()`.

## Efter kørslen

- Generér Supabase-typer igen, så `pairings`/`world_state`/`placements`/`footprints` kendes; `src/world/multiplayer-types.ts` og `as unknown as`-kastene i `pairing.functions.ts` kan så ryddes op senere (ikke en del af denne omgang).
- Kontrollér med en læsende forespørgsel, at de fire tabeller findes, og at RLS er slået til.
- Ingen ændringer i spillets kode i denne omgang.
