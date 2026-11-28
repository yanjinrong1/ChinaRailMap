# Station marker density

Desktop and mobile use the same CSS-pixel distance rule. Both selected endpoints
are always retained, even if they overlap. Other candidates are selected by an
actual Euclidean-distance check across neighboring grid buckets:

- Minimum center-to-center distance: 7 CSS pixels at all zoom levels.
- Eligible candidates come from the current mode: global overview, reachable
  stations, or the focused train's intermediate stations.
- Focused stops and separately operated station companions have priority; then
  the existing zoom hierarchy, regional importance, frequency and stable ID break
  ties. Inferred passing stations enter at zoom 9 and have lower priority.
- Selection occurs before viewport clipping, using stable projected display
  positions. Panning does not change local collision winners. Companions are
  included before spacing checks, so they cannot bypass density control.
- Ordinary symbols and outlines are smaller at low zoom; endpoint symbols stay
  the same size. Enlarging the map reveals more stations.

Only marker visibility changes. Reachable station lists, calendars, route geometry,
train results and stop lists remain complete. A hidden station can still be
selected from the list and is then pinned on the map.

Run `node scripts/audit-station-density.mjs` for mobile/desktop checks against the
Harbin, Guangzhou South and Urumqi snapshots. `reports/station-density-audit.json`
records counts and minimum screen distances; synthetic tests cover bucket edges,
panning, fixed endpoints, focused stops, passing stations and operator companions.
