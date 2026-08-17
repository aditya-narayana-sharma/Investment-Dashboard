# HealthKit pairing

HealthKit stays iOS-only. The Mac never requests HealthKit.

1. Generate a pairing code on the Mac (`npm run iphone:pair`).
2. Open iPhone Settings inside the native app and enter the code.
3. Sync Activity, Sleep, Heart, Respiratory, Mobility, and Nutrition through `healthTargetDate(nowIST)`.
4. Import the Health Shortcut export into `artifacts/private/health-overrides.json` when you need diary reconciliation.
5. Body Measurements and Hearing remain excluded. Health Daily Apple Notes stay deprecated.

Incognito gates thumbnail values, drill-down values, source metadata, actions, and accessibility text.
