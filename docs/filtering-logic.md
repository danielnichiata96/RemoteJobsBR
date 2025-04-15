# Job Fetcher Filtering Logic

This document explains how the `GreenhouseFetcher` and `AshbyFetcher` determine if a job posting is relevant for the RemoteJobsBR platform (i.e., likely 100% remote and potentially suitable for LATAM applicants).

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
*   **Ashby:** Also primarily uses `src/config/greenhouse-filter-config.json`. During initialization, it:
    *   Loads the **positive** `LOCATION_KEYWORDS` (Global, LATAM, Brazil) from the Greenhouse config for its location/title analysis.
    *   Loads and combines the **negative** `LOCATION_KEYWORDS.STRONG_NEGATIVE_RESTRICTION`, `CONTENT_KEYWORDS.STRONG_NEGATIVE_REGION`, and `CONTENT_KEYWORDS.STRONG_NEGATIVE_TIMEZONE` lists from the Greenhouse config for its negative keyword checks across location, title, and content.

*(Note: This shared approach ensures consistency but means changes to the Greenhouse config affect both fetchers.)*

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

## AshbyFetcher Logic (`_isJobRelevant`)

The Ashby fetcher uses a slightly different approach, focusing heavily on location data and context:

1.  **Initial Check:**
    *   Checks the `isRemote` flag. If `false`, rejects immediately.
    *   Checks the `isListed` flag. If `false`, rejects immediately.

2.  **Location/Title Analysis:**
    *   Combines text from `title`, `locations`, `secondaryLocations`, including address components (country, city, state, raw address).
    *   Analyzes this combined text for signals:
        *   **LATAM Signal:** Checks for specific LATAM country codes or positive LATAM/Brazil keywords (from `ashby-positive-filter-config.json`).
        *   **Negative Signal:** Checks for negative keywords (from `negative-filter-config.json`).
        *   **Americas Signal:** Checks for the term "Americas".
        *   **Global Signal:** Checks for global remote keywords (from `ashby-positive-filter-config.json`). Uses **context checking** to ignore global keywords if negative keywords appear nearby (within ~30 chars).

3.  **Location Decision Logic (Prioritized):**
    *   If LATAM signal found -> Accept as `latam`.
    *   Else if Negative signal found -> Reject.
    *   Else if Americas signal found -> Accept as `latam`.
    *   Else if Global signal found (without negative context) -> Mark as potentially `global` and proceed to content check.
    *   Else -> Mark as `unknown` and proceed to content check.

4.  **Content Check:**
    *   Processes job content (description, sections).
    *   **Negative Check:** Searches content for negative keywords. If found -> Reject.
    *   **LATAM Check:** Searches content for positive LATAM keywords. If found -> Accept as `latam`.
    *   **Global Check:** Searches content for positive global keywords. Uses **context checking** similar to step 2. If a *clean* global keyword (no nearby negative) is found -> Mark as confirmed `global` in content.

5.  **Final Decision:**
    *   If rejected at any prior step -> Reject.
    *   If accepted as `latam` at any prior step -> Accept as `latam`.
    *   If content check confirmed `global` -> Accept as `global`.
    *   If location decision was `global` (step 3) and content check didn't reject or accept LATAM -> Accept as `global` (based on location signal).
    *   If `isRemote` flag was initially `true` and no other decision was made -> Accept as `global` (fallback).
    *   Otherwise -> Reject (`Ambiguous or No Remote Signal`). 