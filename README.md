# Data Warehousing Study Notes

Static study-notes website for CITS3401 / CITS5504 Data Warehousing.

## Study Note Sync

Each lecture page adds a `Note` button beside the lecture title, each main section heading, and each topic heading. Opening a note shows a textarea directly under that heading.

Notes autosave while typing. They are always saved to browser `localStorage` first, so notes still work if Supabase is unavailable. When Supabase is reachable, notes also sync to the shared cloud note space configured in [assets/js/supabase-config.js](assets/js/supabase-config.js).

The shared cloud space is:

```js
sharedSpace: 'data-warehouse-shared'
tableName: 'dw_study_notes'
```

Remote rows use the `public.dw_study_notes` table:

- `id`: `sharedSpace + '|' + localNoteKey`
- `passcode`: the shared space name
- `content`: note text
- `updated_at`: latest save time

No login, password, or passcode prompt is used. Everyone using this project shares the same note space.

Run [supabase-dw-study-notes.sql](supabase-dw-study-notes.sql) in the Supabase SQL editor to create the separate Data Warehousing notes table and row-level security policies.

Bottom-right controls are available on the site:

- `Refresh notes`: reloads notes from Supabase.
- Sync status text: shows local/cloud state.
- `Export notes`: downloads local notes as JSON.
- `Clear notes`: clears local notes and deletes all Supabase rows for this shared note space.

## Local Testing

Run the site locally with:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8000/`.
