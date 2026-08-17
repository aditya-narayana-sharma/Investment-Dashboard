# Mail, Calendar, and Reminders mapping

Default mapping matches the owner Mac so a missing live file does not break refresh:

- Newsletters: `iCloud → Newsletters`
- Research: `iCloud → Axis Research` plus `~/Downloads/Axis Research`
- Reminders: `Job 🔍` and `Earnings`
- Earnings calendar name: `Earnings`

To change them, copy `config/integrations.example.json` to `artifacts/private/integrations.json` and edit the mailbox, list, and calendar names. Invalid mailboxes surface as `unavailable` / `permission_required` and the last validated snapshot is retained.

Promo, ads, subscribe CTAs, phone numbers, and website links are stripped from displayed Mail and Podcast summaries. Completed reminders stay evidence; they are never silently restored to To Do.
