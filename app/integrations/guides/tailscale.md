# Tailscale iPhone access

Stratji is on-device. The iPhone is a WKWebView client over the same tailnet.

1. Sign the Mac and iPhone into the same Tailscale account.
2. Keep Portfolio Intelligence running on the Mac (`scripts/run-dashboard-service.sh`).
3. Set the iPhone server address to the MagicDNS HTTPS URL.
4. LAN `http://<mac-lan>:5050/` is a fallback, not the primary path.

Do not host Mail, Health, or Kite tokens in the cloud.
