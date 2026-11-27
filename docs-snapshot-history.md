# Database history

The map reads `public/timetable/snapshots.json`. The current release remains in
`public/timetable/`; older releases live in `public/timetable/snapshots/<release>/`.
Only versions present on disk appear in the selector. Full release IDs distinguish
multiple databases published on the same date.

Use `npm run data:update` (or `python scripts/update-timetable.py <zip> <release>`).
Before replacing the current dataset, the updater archives its timetable, matching
route index, geometry shards, routing audits, and license. Existing historical
releases are never overwritten. An archive failure stops replacement.

`npm run build` refreshes the version index and packages route shards for every
release. Commit the new current data, `snapshots.json`, and any newly created
snapshot directories together. They must remain hosted with subsequent updates.
If replacing data manually, first run
`node scripts/snapshot-history.mjs archive <incoming-release-id>`.

Historical selection uses the database's original date for calendar filtering;
the current version uses today, limited to its published validity interval.
Geometry is loaded lazily from the selected release's own directory. Selecting
another version clears the prior journey while preserving the map view. A failed
load retains the previously usable database.
