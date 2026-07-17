# ALPHA_PROGRAM_SPEC

**Status:** Draft v1.0\
**Owner:** Product & Engineering\
**Applies to:** LUZ Alpha-0

------------------------------------------------------------------------

# Purpose

Define the objectives, operating principles, participant experience,
engineering instrumentation, privacy commitments, and success criteria
for the LUZ Alpha Program.

------------------------------------------------------------------------

# Objectives

-   Validate the Memory, Knowledge, Context, and Presence engines under
    real-world usage.
-   Measure whether LUZ feels like a persistent presence rather than a
    chatbot.
-   Collect structured feedback to improve the architecture before Beta.
-   Observe long-term continuity across days and weeks.

------------------------------------------------------------------------

# Alpha Scope

-   Limited number of invited participants.
-   Daily use in real-life situations.
-   Persistent conversations over time.
-   Explicit user opt-in.
-   Continuous observation of system behavior.

------------------------------------------------------------------------

# Learning Partnership

The Alpha Program is based on voluntary participation.

Participants help improve LUZ's internal intelligence architecture.

The information collected is used exclusively to improve the behavior of
LUZ and **not** to train a general-purpose language model.

For detailed commitments, see:

-   `LEARNING_PARTNERSHIP_POLICY.md`

------------------------------------------------------------------------

# Consent Requirements

Participants must be able to:

-   Join the Alpha voluntarily.
-   Pause learning participation.
-   Leave the Alpha at any time.
-   Request deletion of their Alpha data.
-   Understand when previous conversations influence a response.

------------------------------------------------------------------------

# Data Collected

## Conversation

-   User messages
-   LUZ responses
-   Conversation timestamps

## Memory

-   Captured memories
-   Ignored memories
-   Memory ranking
-   Retrieval success
-   User corrections

## Knowledge

-   Detected patterns
-   Generated inferences
-   Confidence levels
-   User corrections

## Presence

-   Helpfulness
-   Tone
-   Intrusiveness
-   Continuity quality

## Feedback

-   👍 Helpful
-   👎 Not Helpful
-   Free-text comments

------------------------------------------------------------------------

# Data Never Used For

Alpha data will never be used for:

-   Advertising
-   Sale of personal information
-   Marketing profiling
-   Training a general-purpose language model

------------------------------------------------------------------------

# Engineering Metrics

Success will be measured through:

-   Memory precision
-   Memory recall
-   Knowledge accuracy
-   Context relevance
-   Presence quality
-   User trust
-   Conversation continuity

------------------------------------------------------------------------

# Alpha Lifecycle

``` text
Alpha-0
    ↓
Engine Validation
    ↓
Architecture Refinement
    ↓
Reduced Telemetry
    ↓
Beta
    ↓
Production
```

------------------------------------------------------------------------

# Exit Criteria

The Alpha concludes when:

-   Memory behaves reliably.
-   Knowledge extraction is consistently useful.
-   Context feels natural.
-   Presence earns user trust.
-   Alpha telemetry can be reduced without degrading quality.

------------------------------------------------------------------------

# Related Documents

-   `HUMAN_EXPERIENCE_DATASET_V1.md`
-   `LEARNING_PARTNERSHIP_POLICY.md`
-   Architecture documentation
-   Relevant ADRs

------------------------------------------------------------------------

# Vision

Alpha is not simply a software test.

It is the first stage in teaching LUZ how to become a trustworthy
long-term companion through transparent collaboration with real people.
