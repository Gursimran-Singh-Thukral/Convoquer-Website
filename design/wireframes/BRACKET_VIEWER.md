# Wireframe Blueprint: Tournament Knockout Bracket (`/tournaments/[id]/bracket`)

## 1. Objectives & Seeding Constraint
- Visualize the single-elimination tournament tree with progressive connecting lines.
- Clearly demonstrate the **User's Seeding Constraint**:
  - **Seed 1** is anchored to the **Top Half** of the bracket.
  - **Seed 2** is anchored to the **Bottom Half** of the bracket.
  - They **CANNOT** play against each other before the **Finals**.

---

## 2. Layout Structure & Wireframe

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ HEADER: CONVOQUER'26 INTER-COLLEGIATE FOOTBALL CHAMPIONSHIP             │
│ Format: 4-Team Knockout Stage | Venue: Main Stadium Ground              │
├─────────────────────────────────────────────────────────────────────────┤
│ SEEDING NOTICE STRIP                                                    │
│ 🛡️ SEEDING LOCK ACTIVE: Seed 1 (IIT Jammu) & Seed 2 (NIT Srinagar) are   │
│ isolated in opposite halves. They can only meet in the Championship Final│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SEMIFINALS (OCT 2)                         FINAL (OCT 4)               │
│                                                                         │
│  ┌─────────────────────────┐                                            │
│  │ MATCH FB-SF-01 • TOP    │                                            │
│  │ [Gold] SEED 1: IIT JAMMU│─────┐                                      │
│  │        SEED 4: GCET     │     │                                      │
│  └─────────────────────────┘     │     ┌────────────────────────────┐   │
│                                  ├────►│ 🏆 CHAMPIONSHIP FINAL      │   │
│  ┌─────────────────────────┐     │     │ WINNER SF1 (Seed 1 Side)   │   │
│  │ MATCH FB-SF-02 • BOTTOM │     │     │             VS             │   │
│  │ [Flame]SEED 2: NIT SRIN.│─────┘     │ WINNER SF2 (Seed 2 Side)   │   │
│  │        SEED 3: SMVDU    │           └────────────────────────────┘   │
│  └─────────────────────────┘                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```
