# yfinance delayed NSE quotes

yfinance is the public delayed fallback for symbols that are not in the live Kite book.

1. No API key is required. The local Python helper in `.venv-flask` must be installed.
2. Sector snapshots and the analyst matrix use `/api/quotes/yfinance`.
3. Label every yfinance value `public_delayed`. Never replace a failed Kite last price with a silent static number.
4. Rate limits and publisher blocks produce `cached` or `partial`, not invented prints.

Test from Integrations → yfinance → Test.
