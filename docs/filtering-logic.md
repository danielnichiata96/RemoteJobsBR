# Job Fetcher Filtering Logic

This document explains how the `GreenhouseFetcher` determines if a job posting is relevant for the RemoteJobsBR platform (i.e., likely 100% remote and potentially suitable for LATAM applicants).

## Goal

The primary goal is to filter for:
1.  **100% Remote Jobs:** Exclude hybrid or on-site positions.
2.  **Geographic Suitability:** Identify jobs explicitly open to LATAM/Brazil or globally remote, while excluding those restricted to specific non-LATAM regions (e.g., "Remote (US Only)").

The filtering process assigns a type (`latam` or `global`) to relevant jobs.

## Configuration Files

The logic relies heavily on external configuration files containing keywords and rules:

*   **Greenhouse:** Uses `src/config/greenhouse-filter-config.json`. This defines:
    *   Positive keywords (Global Remote, LATAM/Brazil Remote) for location, content, and metadata.
    *   Negative keywords (On-site indicators, specific country/region restrictions like US/Canada/UK/EU only, timezone restrictions) for location and content.
    *   Metadata fields to check (e.g., specific fields in Greenhouse indicating remote status or location).

## GreenhouseFetcher Logic (`_isJobRelevant`)

The Greenhouse fetcher checks relevance in a specific priority order:

1.  **Metadata Check (`_checkMetadataForRemoteness`):**
    *   Examines predefined metadata fields from the job posting (configured in `greenhouse-filter-config.json`).
    *   Looks for boolean flags or string values indicating:
        *   Explicit LATAM Remoteness (`ACCEPT_LATAM`)
        *   Explicit Global Remoteness (`ACCEPT_GLOBAL`)
        *   Explicit Rejection (e.g., "On-site", "US Only") (`REJECT`)
    *   If a definitive result (Accept LATAM or Reject) is found here, the decision is made immediately.

2.  **Location/Office Check (`_checkLocationName`):**
    *   If metadata was inconclusive, analyzes the `location.name` field and any associated `offices`.
    *   Compares the combined text against positive (LATAM, Global) and negative keywords from the config.
    *   If a definitive result (Accept LATAM or Reject) is found, the decision is made.

3.  **Content Check (`_checkContentKeywords`):**
    *   If still inconclusive, analyzes the job `title` and the main job `content` (HTML stripped).
    *   Searches for positive (LATAM, Global) and negative (regional restrictions, timezone restrictions) keywords from the config.
    *   Includes **context checking**: Looks for negative keywords near positive LATAM/Global keywords to avoid misinterpretations (e.g., "Remote, US applicants preferred"). If a positive keyword has a nearby negative context, it can lead to rejection.
    *   If a definitive result (Accept LATAM or Reject) is found, the decision is made.

4.  **Final Decision:**
    *   If any step resulted in `ACCEPT_LATAM` or `REJECT`, that decision is final.
    *   If any step resulted in `ACCEPT_GLOBAL` (and no rejection occurred), the job is accepted as `global`.
    *   If none of the checks yielded a definitive result, the job is considered irrelevant (`Ambiguous or No Remote Signal`). 