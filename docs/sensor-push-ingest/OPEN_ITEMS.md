# Open items (unanswered)

1. Vendor firmware: does it lock flash readout (or encrypt the firmware), and does it verify the server's TLS certificate? This decides whether sequential ids are safe.
2. Zones: does a zone belong to a facility or to the whole organization? Recommendation: per facility.
3. Send interval from the vendor, needed for the online, offline and stale thresholds. The current 20 minutes assumes the old vendor.
4. Tenant fault indicator: a generic "sensor fault" badge, or nothing.
5. Retention: how long readings are kept.
6. Real temperature and humidity thresholds to replace the placeholders.
7. Which zones show sensor data. Only Kill Floor and Wet Aging are built out today.
8. Firmware behavior on a 404 or any other non-204 response.
