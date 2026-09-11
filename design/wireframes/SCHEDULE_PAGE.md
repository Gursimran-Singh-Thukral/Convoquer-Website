# Wireframe Blueprint: Schedule & Fixtures Page (`/schedule`)

## 1. Objectives
- Enable fans, athletes, and team managers to quickly find matches by **Day**, **Sport**, **Venue**, or **Team**.
- Support two complementary visual models:
  1. **Match Ticket List View**: Card-based, easy to scan on mobile devices.
  2. **Court / Venue Gantt Timeline View**: Visual horizontal grid showing which courts are in use hour-by-hour across campus.

---

## 2. Layout Structure & Wireframe

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ HEADER: SCHEDULE & FIXTURES                                             │
│ "Official Tournament Time Slots & Court Assignments"                    │
├─────────────────────────────────────────────────────────────────────────┤
│ DAY SELECTOR STRIP (Sticky Horizontal Bar)                              │
│ [DAY 1 • OCT 1]   [DAY 2 • OCT 2 (Active)]   [DAY 3 • OCT 3]   [DAY 4]  │
├─────────────────────────────────────────────────────────────────────────┤
│ MULTI-FACET FILTER TOOLBAR                                              │
│ [ Sport: All ▼ ]   [ Venue: All ▼ ]   [ Status: All / Live / Done ]    │
│ [ Search Team or Match ID...                              ]             │
│ VIEW MODE:  [ 📋 Ticket Cards ]  |  [ ⏱️ Court Timeline Grid ]          │
├─────────────────────────────────────────────────────────────────────────┤
│ MATCH CARDS (Grouped by Time Slot)                                      │
│                                                                         │
│ ▼ 09:00 AM - 10:30 AM (Morning Slot)                                    │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ ⚽ FOOTBALL | SEMIFINALS | MAIN STADIUM          STATUS: ● LIVE 22' │ │
│ │  [Crest] IIT JAMMU (Seed 1)   1  -  0   GCET JAMMU (Seed 4) [Crest] │ │
│ │  Scorer: Rahul Sharma 14'               Pass: CQ26-FB-SF1           │ │
│ │  Referee: Dr. A. Sharma               [ Match Hub & Lineups → ]     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ▼ 11:00 AM - 12:30 PM (Midday Slot)                                     │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ ⚽ FOOTBALL | SEMIFINALS | MAIN STADIUM         STATUS: SCHEDULED   │ │
│ │  [Crest] NIT SRINAGAR (Seed 2)   VS   SMVDU KATRA (Seed 3) [Crest]  │ │
│ │  Bottom Half Bracket Match              Pass: CQ26-FB-SF2           │ │
│ │  Referee: Prof. R. Singh              [ Match Hub & Lineups → ]     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ▼ 02:00 PM - 05:00 PM (Afternoon Slot)                                  │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 🏏 CRICKET | GROUP B | CRICKET OVAL             STATUS: SCHEDULED   │ │
│ │  IIT JAMMU CRICKET XI   VS   GCET JAMMU CRICKET XI                  │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```
