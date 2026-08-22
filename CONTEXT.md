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

**Weight observation**:
A non-null weight recorded on a Day Log for a specific calendar date. A visually connected chart line does not create additional weight observations.
_Avoid_: inferred weight, estimated weight

**Nutrition target**:
A daily comparison value for a nutrient. Until user-specific goals exist, Calibrate may use a shared placeholder target such as the current 60g fat target.
_Avoid_: personalized goal, persisted goal
