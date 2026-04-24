---
name: incident-response
description: Structured response when production is broken — triage, communicate, mitigate, root-cause, postmortem.
audience: [sre-agent, devops-agent, coordinator]
triggers:
  - "production is down"
  - "users are impacted"
  - "alert fired"
  - "outage"
  - "incident"
  - "rollback needed"
---

# Incident Response Skill

Incidents are high-stakes and high-confusion. The template below keeps
the response disciplined: stop the bleeding first, diagnose second,
postmortem third. In that order.

## When to use

- A monitoring alert fires (error rate, uptime, latency).
- A user reports the product is broken.
- A deploy regressed production.
- CI has been red for hours and blocking the team.

## Severity (decide in the first 60 seconds)

| Sev | Symptom | Response |
|---|---|---|
| **SEV1** | Full outage, data loss, security breach | All-hands. Founder paged. |
| **SEV2** | Major feature broken for many users | Rollback + fix immediately |
| **SEV3** | Degraded performance, minor feature broken | Fix today, no rollback |
| **SEV4** | Cosmetic / edge-case | Normal issue flow |

When uncertain, round up. A SEV3 treated as SEV2 wastes time; a SEV2
treated as SEV3 loses customers.

## Steps

### 1. Open an incident issue immediately

Title: `INCIDENT (SEV-N): <one-line symptom>`. Body template:

```
**Started:** <UTC timestamp>
**Status:** investigating | mitigating | monitoring | resolved
**Impact:** <who/what is affected>
**Symptom:** <what users experience>
**Commander:** <the agent or human driving this>

## Timeline
- HH:MM UTC — alert fired / user reported
- HH:MM UTC — acknowledged

## Actions taken
<updated as work happens>

## Open questions
<what we don't know yet>
```

Every significant step appends to the timeline. No side-channel
conversations — the issue is the record.

### 2. Stop the bleeding FIRST

- Can we roll back the most recent deploy? Do it. Root cause second.
- Is there a feature flag we can flip? Flip it.
- Can we scale up / redirect traffic? Do it.
- Do NOT investigate root cause while production is on fire.
- Do NOT deploy a fix-forward you don't fully understand.

### 3. Communicate

- Update the incident issue every 15 minutes, even if nothing new.
  "Still investigating, no update yet" is valuable.
- If SEV1/SEV2: `request_human_approval` with the current status so the
  founder is in the loop. For a true SEV1, also page via any
  configured oncall channel.
- Status page / user-facing message: say what you know, what you don't,
  and when you'll update again.

### 4. Diagnose (once bleeding stopped)

Now you can be methodical (see `debugging` skill):

- Reproduce the failure.
- Walk the stack trace / logs.
- Bisect recent deploys.
- Find the change that introduced it.

Do **not** immediately fix. Understand first.

### 5. Mitigate → Fix → Verify

- Mitigation = "users are no longer impacted" (possibly via rollback /
  flag).
- Fix = "the root cause is addressed."
- Verification = "we have a regression test and staging shows it's
  fixed."

Only after verification, redeploy with the fix.

### 6. Resolve the incident

When users are recovered AND fix is deployed:

- Update incident issue status: `resolved`.
- Final timeline entry with recovery time.
- Schedule the postmortem.

### 7. Postmortem (within 3 days for SEV1/SEV2)

Blameless. Focus on **systems and processes**, not people. Format:

```markdown
# Postmortem: <incident title>

## Summary
<2–3 sentence plain-English story>

## Impact
<Users affected, duration, revenue impact if any>

## Timeline
<from detection to resolution>

## Root cause
<Technical cause — what went wrong, why>

## Why our systems allowed it
<Why didn't tests catch it? Why didn't monitoring page earlier? Why
didn't the review catch it?>

## What went well
<Fast rollback, good alerting, clear comms — credit what worked>

## Action items
- [ ] Owner — action — due date — linked issue
- [ ] Owner — action — due date — linked issue
```

Action items become real issues with real owners and real dates. A
postmortem without tracked actions is theater.

## Rules

1. **Rollback beats diagnose when prod is on fire.**
2. **Never blame people.** Systems let the mistake reach prod.
3. **Timeline everything.** You will not remember at 3am what happened
   at 2am.
4. **Communication is not a distraction from the fix — it is part of
   the fix.** Stakeholders not hearing = stakeholders panicking.
5. **Every incident ends with at least one concrete action item** to
   prevent recurrence. No "we'll be more careful."

## Related skills

- `debugging` — the diagnosis phase uses this skill
- `deploy` — rollback procedures live here
- `code-review` — most SEV incidents trace back to a reviewed PR; use
  this to strengthen reviews post-incident
