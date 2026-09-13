---
title: "how to build a self-improving sales operating system"
date: 2026-09-13
description: "i built a self-improving sales operating system in the last 6 months for our sales team"
keywords: "sales, gtm, ai, agents, lightdash, attio, playbooks, cursor"
og_image: "/images/sales-os-og.jpg"
og_image_width: 1200
og_image_height: 630
---

![pyramid against a crescent moon and setting sun](/images/sales-os-cover.jpg)

i built a self-improving sales operating system in the last 6 months for our sales team

specialised agents run the weekday grind, draft in our voice, and fold learnings back into a private gtm repo. we approve what ships and what gets learned.

## the stack

- ledger
- playbooks
- operators
- self-learning

## ledger - CRM (Attio)

system of record for companies, deals, people, tasks, live status

## playbook - gtm repo (GitHub)

the living brain with ~20 folders and 50+ skills

- playbook/: pricing, ICP/IBP, objections, POC plans, renewals, churn, competitive summary
- product/: positioning, feature truth, technical reference
- competitors/: landscape + battlecards
- legal/: contracts, DPAs, NDAs, POC licenses, partner agreements
- outbound/: ICP, sequences, campaign learnings, cold-call / email playbooks
- ops/: Attio data model, quoting, call-learning, win/loss, self-heal loops
- enablement/: tone of voice, customer proof, founding-sales reference
- partners/: partner context and program planning
- marketing/: messaging, decks, collaterals, events
- hiring/: role specs
- ae-onboarding/: ramp plans
- deliverables/: customer/partner artifacts (proposals, POC plans, PDFs)
- design/: design system for decks and deliverables
- leads/, reports/, forecasts/, updates/, scripts/, mcp/: lists, analysis, dated updates, automation, external context bundle

## operators - grok bot + Cursor

they read ledger + playbook, do the day's work, and update the CRM.

this is the primary daily interface for the sales team.

## self learning - grok bot routines

agents review calls, wins, losses, product changes, and outbound results.

they open draft PRs that update the playbook e.g. objections, positioning, ICP, skills.

i review and merge.

next week's operators run on a sharper brain.

operators pull from ledger + playbook to draft work.

learning writes durable improvements back into the playbook.

nothing silently rewrites the brain.

## the weekday clock

scheduled routines fire in order so prep and follow-up happen without me remembering to ask.

### morning (before calls)

- due-today CRM briefing
- slack "needs you" sweep
- new-customer first-touch drafts
- usage check-in drafts for prospects who signed up for our app but aren't moving
- call prep for the day's customer / prospect meetings
- monday: pipeline weekly update draft

### during the day

- meeting brief bot: morning digest + sweeps when new calls land
- post-call follow-up drafts every couple of hours
- silent-setup / silent-using follow-ups for orgs that stalled after signup

### end of day

- #sales eod standup draft ready to paste
- overnight: tidy billing / customer IDs so accounts stay linked
- friday: catch org / billing gaps before the weekend

## how it feels in practice

i walk into drafts already shaped for:

- what to prep
- who to follow up
- what to post at eod

i edit, send, and move on.

the learning loops (playbook learner) are separate: they improve next week's brain.

the weekday clock is what keeps this week's deals moving.

## the bots

### daily sales ops bot

- runs the weekday sales grind on a schedule
- drafts morning briefings, new-customer follow-ups, call prep, and post-call notes
- keeps pipeline updates and the end-of-day sales standup ready to paste
- tidies billing / customer IDs so deals and accounts stay linked
- you review and send

### meeting brief bot

- watches the calendar for customer and prospect calls
- builds a short brief before each one: context, history, what to push for
- morning digest plus sweeps when new meetings land

### events bot

- plans conference and dinner gtm: who to meet, dinner vs 1:1
- drafts invites and follow-ups for events
- you point it at an event or list, then send and book

### prospecting bot

- works ICP leads and finds ways into accounts
- researches buyers, builds lists, drafts outreach and reconnects
- you decide who gets time; it does the digging and first draft

### odd-jobs bot

- handles one-shot sales tasks that don't fit a routine
- champion lists, referral asks, event side-quests, weird deal questions
- keeps messy non-recurring work out of the specialised bots

### outbound doctor

- audits outbound performance and spots what's underperforming
- ranks the next plays: displacement, referrals, cold-call, intros, event pre-books
- you still own the sequences; it tells you what to fix or run next

### playbook learner

- learns from calls, wins, losses, and stuck enterprise deals
- turns patterns into draft updates to pricing, ICP, and objection playbooks
- you review and approve so the team sales brain improves over time

## full tooling

- CRM (@attio)
- email (gmail)
- messaging service (slack)
- calendar (google)
- call recordings / notes (fathom + attio + @minitiapp)
- a work board for prospecting tickets (@linear)
- an outbound sequencer (@ReplyAppTeam)
- product usage / billing data (@lightdash_devs + @getmeasure)
- version control (github)
- agent chats with scheduled routines (grok @bot)
- a coding agent that can open draft PRs against the repo (@cursor_ai)

## prep

- a gtm repo as the sales brain
- playbooks written so an agent can follow them
- skills / recipes per job (call prep, follow-up, standup, outbound, learning loops)
- tone-of-voice docs so drafts sound like you
- scheduled routines (without clocks you just have chatbots)
- clear bot roles: one job per bot
- draft-only rules: agents prepare, you approve
- human approval as the product: the system compounds when good drafts and good playbook edits get accepted

## design principles

- agents are specialised operators (a small fleet, one job each)
- the repo is the brain
- humans only spend time on decisions that need a human
- every time the agent produces an imperfect draft, it needs to be improved with skills or context

## what you get over time

- every approved draft and every learning PR improves next week's output
- the team stops re-deriving the same objection answers
- new AEs inherit a living sales brain
- knowledge stops dying in Slack threads and one-off chats
