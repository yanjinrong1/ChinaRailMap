# Shared route topology (work prototype)

`npm run build` derives a graph from completed per-train geometry; it does not run
another pathfinder or replace the source routing database. Published artifacts use:

- `nodes`: common track geometry vertices.
- `sections` and `sectionIds`: undirected atomic edges isolated by operator, with
  stable IDs hashed from operator and endpoint coordinates. Signed numeric refs
  encode traversal direction without duplicating geometry.
- `legs`: ordered section references for every original stop-to-stop variant.
- `trainPaths`: ordered leg references keyed by train ID.
- `passages`: ordered station anchors encountered along each routed leg. Joining
  these with `trainPaths` yields train-specific stop/pass status.

A-C and A-B-C share atomic edges after splitting at existing collinear vertices.
Only common geometry is joined: nearby parallel lines, crossing lines without a
common vertex, and separate operators are not snapped together. Existing input
coordinates have five-decimal precision; the builder uses that precision and a
sub-centimeter collinearity test. Different simplifications of the same real
railway may remain separate. This is conservative geometry-derived topology,
not an authoritative OSM node-ID graph.

A passing station requires traversal of a node used as the endpoint of another
routed service stopping at that station, within 120m of the station coordinates.
Coincident station coordinates carrying different names are excluded as ambiguous.
Candidates are labeled inferred; no passing times or new passenger destinations
are created. Opening a train shows inferred passing stations as smaller gray dots.

The map unions selected section IDs per service color, then stitches chains for
rendering. Different service colors retain parallel offsets. Each train's original
stop list, geometry binding, operator checks, calendars and times remain intact.
Source coordinates remain in `public/timetable/`; packaged geometry reconstructs
from the topology. Files are sharded under `dist/timetable/topology/`.

Validation: `npm test`, `npm run build`, then
`node scripts/audit-route-topology.mjs`. The audit verifies every original route
vertex survives reconstruction, checks stable ID uniqueness, and reports sample
rendering reductions and inferred passages in `reports/topology-audit.json`.

## Parallel-line continuity

Rendering stitches each color independently, even where companion colors start or
end. Each operator uses a consistent lane order for the selected color set. Every
junction has one shared projected offset frame, oriented across its connected
component; all incident chains use that exact offset point. This prevents gaps
from per-chain offset direction changes or changes in local color membership.
A single focused service is centered. Geometry and routing references are unchanged.

## Display detail and memory

Screen-space Douglas–Peucker simplification runs on shared geometry before offset
frames are built. Color boundaries and graph junctions remain fixed, so parallel
colors simplify together and continue to meet. Pixel tolerances decrease from
1.5px at zoom <=5 to zero at zoom 13. Detailed routing and passing-station logic
continue to use the original graph.

Near-identical directional leg variants may use one display representative when
they have the same operator, color and station pair and their full bidirectional
geometric deviation is within 400m. This allowance also accommodates differences
in source shape sampling. Large detours and different operators remain distinct.
Representative selection is cached for the current journey, independent of zoom;
opening one service still retains its original train-to-route association.

The browser runtime skips the stable-ID strings and redundant full train-path
lookup table, which remain available as downloadable audit artifacts. Geometry
memory benchmarks use isolated Node/V8 with explicit GC, not whole-tab/GPU memory.
Run `node --expose-gc scripts/measure-route-memory.mjs dist --runtime --render --optimize`.

## Station alignment

Selected display-leg endpoints and their inferred station-passage nodes are hard
pins in the display graph. Simplification splits chains at those nodes before
removing bends. Parallel strokes taper together within 10 screen pixels of these
pins, meeting the original routed station anchor exactly. Leaflet's second
simplification pass is disabled for these already-simplified topology strokes.
Station coordinates, source route topology and timetable data remain unchanged.

After visual review, display tolerances were reduced to 1.5px (zoom <=5), 1px
(<=7), .65px (<=9), .3px (<=11), .1px (12), and zero (13). Station nodes remain
protected at every level. Unambiguous routed station anchors within 500m use the
station marker coordinates for display only; conflicting anchors are excluded.
