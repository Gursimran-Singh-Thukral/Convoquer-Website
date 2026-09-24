# Convoquer'26 Image Assets Directory

Drop your official championship, sporting events, and campus photographs into this folder (`client/public/images/convoquer/`).

---

### 1. Main Homepage Assets

| File Path        | Description                                                                                                   | Recommended Dimensions                | Aspect Ratio |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------ |
| `hero-bg.jpg`    | Main hero panoramic championship banner (IIT Jammu sports arena or campus dusk photo). **(Currently active)** | 1920×1080 or larger (up to 3840×2160) | 16:9         |
| `campus-map.jpg` | Official architectural campus layout or aerial render of IIT Jammu Jagti.                                     | 1600×1000 or larger                   | 16:10        |

---

### 2. Sports Directory & Cards (`sports/`)

Used on both the Homepage sports carousel and the dedicated `/sports` Directory Page:

| File Path                 | Sport                                         | Recommended Dimensions | Aspect Ratio |
| ------------------------- | --------------------------------------------- | ---------------------- | ------------ |
| `sports/cricket.jpg`      | Cricket action photo (batsman/bowler on turf) | 1200×800 or 800×600    | 4:3 or 16:9  |
| `sports/football.jpg`     | Football match action photo                   | 1200×800 or 800×600    | 4:3 or 16:9  |
| `sports/basketball.jpg`   | Basketball indoor hardwood court action       | 1200×800 or 800×600    | 4:3 or 16:9  |
| `sports/volleyball.jpg`   | Volleyball spike or block action              | 1200×800 or 800×600    | 4:3 or 16:9  |
| `sports/badminton.jpg`    | Badminton indoor court smash or rally         | 1200×800 or 800×600    | 4:3 or 16:9  |
| `sports/table-tennis.jpg` | Table tennis fast rally action                | 1200×800 or 800×600    | 4:3 or 16:9  |
| `sports/athletics.jpg`    | Track & field sprinters or long jump          | 1200×800 or 800×600    | 4:3 or 16:9  |
| `sports/chess.jpg`        | Chess board & focus tournament photo          | 1200×800 or 800×600    | 4:3 or 16:9  |

---

### 3. Venues & Facilities (`venues/`)

Used on the Venues & Campus Masterplan section:

| File Path                          | Facility                          | Recommended Dimensions |
| ---------------------------------- | --------------------------------- | ---------------------- |
| `venues/main-ground.jpg`           | Main Football & Track Arena       | 1200×800               |
| `venues/cricket-ground.jpg`        | Jagti Cricket Oval                | 1200×800               |
| `venues/indoor-sports-complex.jpg` | Central Indoor Sports Complex     | 1200×800               |
| `venues/basketball-court.jpg`      | Indoor Hardwood Basketball Court  | 1200×800               |
| `venues/volleyball-court.jpg`      | Outdoor Floodlit Volleyball Arena | 1200×800               |

---

### 4. Automatic Color Grading & Styling

Any photo placed in this folder will automatically have `.convoquer-img` and theme gradient overlays applied by the frontend:

- Brightness, contrast, and saturation are balanced with Convoquer's brand palette (Deep Burgundy `#701A2B`, Obsidian `#121114`, and Champagne Gold `#D4AF37`).
- Fallbacks are implemented gracefully if any image file is pending.
