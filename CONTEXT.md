# Calibrate

Calibrate lets a user record and review nutrition information by calendar day.

## Language

**Day Log**:
A user's nutrition aggregate for one calendar date, including its weight and food entries.
_Avoid_: daily log, meal log

**Known-empty day**:
A requested calendar date for which Calibrate has confirmed that the user has no Day Log.
_Avoid_: missing day, unloaded day

**Empty Day Log**:
An existing Day Log with no Food Entries; it remains distinct from a known-empty day and may still carry a weight.
_Avoid_: empty day, deleted Day Log

**Seven-day view**:
An analysis window containing the current local calendar date and the six preceding local calendar dates, ordered from oldest to newest.
_Avoid_: calendar week, arbitrary seven-day period

**Calendar week**:
The Sunday-to-Saturday collection of seven local calendar dates. A future date within the current Calendar week is Upcoming, not a Known-empty day.
_Avoid_: rolling week

**Weight observation**:
A non-null weight recorded on a Day Log for a specific calendar date. A visually connected chart line does not create additional weight observations.
_Avoid_: inferred weight, estimated weight

**Weigh-In day**:
A Day Log with a Weight observation. It is the completed state for the Weigh-In habit display.
_Avoid_: weight day, completed weight log

**Food Logging day**:
A Day Log containing at least one Food Entry. It is the completed state for the Food Logging habit display.
_Avoid_: meal day, completed food log

**Food contribution**:
The total amount of one nutrient supplied by Food Entries with exactly the same recorded name during an analysis window.
_Avoid_: food source, fuzzy food match

**Nutrition target**:
A daily comparison value for a nutrient. Until user-specific goals exist, Calibrate may use a shared placeholder target such as the current 60g fat target.
_Avoid_: personalized goal, persisted goal

**Demo catalog**:
The Foundation Foods reference catalog loaded into a self-contained local evaluator setup; it contains reusable food nutrition records and no user data.
_Avoid_: seed database, sample data

**Reference serving**:
The one quantity basis to which a catalog food's nutrition values correspond. It may retain up to one source-provided named measure, mass, and volume quantity when each expresses that same food amount; otherwise it uses 100 g.
_Avoid_: conversion option, default serving

**Unreported nutrient**:
A nutrient value absent from an imported reference-data record, distinct from a source-reported zero. In the Demo catalog it contributes zero to logged nutrition and is recorded in the seed report.
_Avoid_: zero nutrient, skipped food
