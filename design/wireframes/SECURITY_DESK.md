# Wireframe Blueprint: Security & Gate Desk Portal (`/security`)

## 1. Objectives
- Enable campus security gate staff to verify arriving athletes, visitors, and audience members in **under 2 seconds**.
- Provide high contrast and bold visual statuses so screen is easily readable in sunlight at campus gates.
- Prevent duplicate gate entry (stopping badge-sharing).
- Fast on-spot pass issuance form for unregistered visitors with instant database reflection.

---

## 2. Layout Structure & Wireframe

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 🛡️ CONVOQUER'26 GATE CLEARANCE | Gate 1 (North Main)   [Officer Logged] │
├─────────────────────────────────────────────────────────────────────────┤
│ SEARCH BAR (Instant Live Auto-Query):                                   │
│ [ 🔍 Type Name, Roll Number, Phone, or Gate Pass (CQ26-P-...)        ] │
│ [ 📷 Open Camera QR Scanner ]            [ + Issue On-Spot Pass ]       │
├─────────────────────────────────────────────────────────────────────────┤
│ VERIFICATION CARD (Appears Instantly on Match / QR Scan):               │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ [ ATTENDEE PHOTO ] │ NAME:     RAHUL SHARMA                         │ │
│ │                    │ COLLEGE:  Indian Institute of Technology Jammu │ │
│ │                    │ ROLL NO:  2023CSB101                           │ │
│ │                    │ CATEGORY: ATHLETE • Football Men               │ │
│ │                    │ PASS ID:  CQ26-P-8B9F2A                        │ │
│ │ ------------------------------------------------------------------- │ │
│ │ STATUS: NOT YET CHECKED IN                                          │ │
│ │                                                                     │ │
│ │ [ ✔ VERIFY & CHECK-IN ATHLETE ]   [ ✕ FLAG / DENY ENTRY ]           │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│ ALREADY-CHECKED-IN ALERT (If Duplicate Entry Attempted):               │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ ⚠️ WARNING: ALREADY CHECKED IN                                      │ │
│ │ Rahul Sharma was already cleared at Gate 1 at 14:22:10 today.       │ │
│ │ Possible badge-sharing violation. Verify physical government ID.   │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│ RECENT GATE CLEARANCE AUDIT FEED (Live Stream)                          │
│ • 18:24 - Priya Gupta (CQ26-AUD-3001) - Audience - CHECKED IN          │
│ • 18:22 - Aman Deep (CQ26-P-1092) - Athlete (IIT Delhi) - CHECKED IN   │
│ • 18:19 - T. Mir (CQ26-P-4401) - Athlete (NIT Srinagar) - CHECKED IN   │
└─────────────────────────────────────────────────────────────────────────┘
```
