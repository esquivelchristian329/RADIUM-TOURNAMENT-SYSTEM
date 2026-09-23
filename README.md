[README.md](https://github.com/user-attachments/files/32271912/README.md)
# RADIUM Tournament System

A web-based tournament management and scoring system designed for **Karate and Arnis competitions**, including **Combative / Padded Stick** and **Anyo** events.

The project provides tournament setup, athlete/team registration, category management, single-elimination brackets, live scoring, results, staff/accounting support, and Supabase-backed cloud persistence.

> **Project status:** Active development. Features and database scripts are versioned and may change as tournament requirements evolve.

---

## Features

### Tournament Management
- Create and manage tournaments
- Tournament venue, date, organizer, and status information
- Tournament-level settings
- Cloud persistence through Supabase
- Tournament/member role support

### Team & Player Registration
- Team registration
- Player registration
- Player ID generation
- Player fields include:
  - Team
  - Player name
  - Gender
  - Age
  - Weight
  - Event/category
- Supports tournament registration workflows for Arnis events

### Category Management
- Combative/Padded Stick categories
- Anyo categories
- Age-based categories
- Weight-based categories
- Category presets and tournament-specific categories

For Combative categories, the bracket classification can follow the configured requirements:
- **Weight required:** bracket by weight
- **Weight not required:** bracket by age
- **Both age and weight required:** weight takes priority

### Bracket System
- Single-elimination tournament brackets
- Automatic advancement
- Bye handling
- Round progression
- Match queue support
- Draw-lots functionality
- Bracket display page for external screens
- Tournament match/result synchronization

### Combative Scoreboard
The scoreboard is designed for live competition use and includes:
- Blue vs. Red competitor display
- Round and match information
- Timer controls
- Start / pause / reset
- Score controls
- Advantage
- Fouls
- Disarm tracking
- Match winner handling
- Final score display
- Support for matches completed in fewer than three rounds
- Automatic progression to the next scheduled match

### Anyo Scoreboard
A separate scoreboard interface is included for Anyo events.

It supports Anyo-specific scoring/deductions and is separated from the Combative/Padded Stick workflow.

### Authentication & Roles
The project includes authentication and tournament-role functionality for controlled access.

Relevant components include:
- Authentication configuration
- Admin functionality
- Tournament/member roles
- Staff administration
- Cloud database authorization

### Staff & Accounting
The project contains functionality for:
- Staff administration
- Staff registration/accounting workflows
- Tournament-related administrative operations

### Supabase Integration
The system uses Supabase for online data persistence and backend functionality.

Included backend components:
- Database schemas
- SQL migrations/fix scripts
- Supabase Edge Functions
- Cloud synchronization
- Authentication-related database structures

---

## Project Structure

```text
RADIUM TOURNAMENT SYSTEM/
└── app/
    ├── index.html
    ├── bracket-display.html
    │
    ├── anyo-scoreboard/
    │   ├── index.html
    │   └── scoreboard.css
    │
    ├── scoreboard/
    │   ├── index.html
    │   └── scoreboard.css
    │
    ├── css/
    │   ├── app.css
    │   └── bracket.css
    │
    ├── js/
    │   ├── auth.js
    │   ├── bracket.js
    │   ├── cloud-sync.js
    │   ├── draw-lots.js
    │   ├── entry-forms.js
    │   ├── staff-accounting.js
    │   └── supabase-db.js
    │
    ├── db/
    │   ├── auth-config.js
    │   ├── auth_schema.sql
    │   ├── README_DB_SETUP.md
    │   ├── schema.sql
    │   ├── supabase-config.example.js
    │   ├── supabase-config.js
    │   └── *.sql
    │
    ├── supabase/
    │   └── functions/
    │       ├── radium-ai-import/
    │       │   └── index.ts
    │       └── radium-staff-admin/
    │           ├── deno.json
    │           └── index.ts
    │
    ├── Logo1.webp
    ├── Logo2.webp
    ├── Logo3.webp
    ├── Logo4.webp
    ├── buzzer.mp3
    │
    └── MyCustomFont/
        └── ninja-naruto/
            └── njnaruto.ttf
```

---

## Technology

The current project is primarily built with:

- **HTML5**
- **CSS3**
- **JavaScript**
- **Supabase**
- **PostgreSQL**
- **Supabase Edge Functions**
- **TypeScript** for Edge Functions
- **Deno** for Supabase Functions
- Custom fonts and tournament branding assets

No large frontend framework is required by the current application structure.

---

## Running the Application Locally

Because the application uses JavaScript modules, browser APIs, and Supabase integration, it is recommended to run it through a local web server rather than opening `index.html` directly with `file://`.

### Option 1 — VS Code Live Server

1. Clone or download the repository.
2. Open the project in VS Code.
3. Install the **Live Server** extension.
4. Open the `app` directory.
5. Start Live Server.
6. Open the URL provided by Live Server.

Example:

```text
http://127.0.0.1:5500/app/
```

The exact port may be different depending on the local server.

### Option 2 — Python HTTP Server

From the directory containing `app`:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/app/
```

---

## Supabase Setup

The application contains a `db` directory with the database schemas and SQL scripts used during development.

Start by reviewing:

```text
app/db/README_DB_SETUP.md
```

The repository contains several SQL files representing different database versions, fixes, hardening steps, and feature additions.

Examples include:

```text
SUPABASE_V31_FULL.sql
SUPABASE_V32_LOGOS_MANAGER.sql
SUPABASE_V33_ROLE_GROUP_LOGO.sql
SUPABASE_V34_ADMIN_TM_SAVE_SYNC_FIX.sql
SUPABASE_V34_DRAW_LOTS.sql
SUPABASE_V34_TM_TOURNAMENT_CREATION_BILLING_LOGO_FIX.sql
```

### Important

Do **not** blindly execute every SQL file in the folder in random order.

Some files represent later revisions or targeted fixes. Use the database setup documentation and the intended/current schema for the deployment.

---

## Supabase Configuration

A configuration example is included:

```text
app/db/supabase-config.example.js
```

Create the local configuration required by the application using the example as a template.

For example:

```javascript
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
```

Use the actual configuration expected by the project's JavaScript files.

### Security

Before publishing this repository:

- Do not commit Supabase **service-role keys**.
- Do not commit private API keys.
- Do not commit passwords.
- Do not commit private authentication secrets.
- Review `supabase-config.js` and `auth-config.js` before pushing to GitHub.
- Use environment variables or deployment secrets for server-side credentials.
- A Supabase anonymous/public key is intended for client-side use, but database access must still be protected by proper **Row Level Security (RLS)** policies.

If a secret has already been committed to Git, rotate it in the relevant service and remove it from the repository history as appropriate.

---

## Supabase Edge Functions

The project includes Edge Functions under:

```text
app/supabase/functions/
```

Current functions include:

### `radium-ai-import`

Located at:

```text
supabase/functions/radium-ai-import/index.ts
```

This function provides backend functionality related to AI-assisted importing.

### `radium-staff-admin`

Located at:

```text
supabase/functions/radium-staff-admin/
```

This function contains staff administration functionality and includes a Deno configuration file.

Deploy functions using the Supabase CLI according to the project's Supabase configuration.

---

## Main Application Pages

### Main Application

```text
app/index.html
```

Primary tournament management interface.

### Bracket Display

```text
app/bracket-display.html
```

Dedicated bracket display intended for viewing tournament brackets on larger displays.

### Combative Scoreboard

```text
app/scoreboard/index.html
```

Live scoring interface for competition matches.

### Anyo Scoreboard

```text
app/anyo-scoreboard/index.html
```

Dedicated Anyo scoring interface.

---

## Main JavaScript Modules

| File | Purpose |
|---|---|
| `auth.js` | Authentication and access handling |
| `bracket.js` | Bracket creation, progression, and match handling |
| `cloud-sync.js` | Synchronization with cloud data |
| `draw-lots.js` | Draw-lots functionality |
| `entry-forms.js` | Tournament/team/player/category forms |
| `staff-accounting.js` | Staff and accounting-related functionality |
| `supabase-db.js` | Supabase database operations |

---

## Database Functions

The Supabase database contains application-specific functions used by the frontend/backend integration.

Examples include functions for:
- Saving tournaments
- Saving matches
- Saving results
- JSON data merging
- Role/member authorization
- Tournament synchronization

Database functions should be deployed from the appropriate SQL migration/version rather than manually recreated in the browser.

---

## Tournament Workflow

A typical tournament workflow is:

```text
SETUP
  ↓
TOURNAMENT
  ↓
TEAMS
  ↓
PLAYERS
  ↓
CATEGORIES
  ↓
DRAW LOTS / BRACKETS
  ↓
MATCH QUEUE
  ↓
LIVE SCOREBOARD
  ↓
RESULTS
  ↓
REPORTING
```

The exact workflow may vary depending on the tournament configuration and event type.

---

## Competition Types

### Combative / Padded Stick

The system supports tournament bracket and live-score workflows for Arnis Combative/Padded Stick events.

The competition system can use:
- Age
- Gender
- Weight
- Category
- Elimination brackets
- Match results
- Automatic advancement

### Anyo

Anyo is handled as a separate competition workflow.

The project includes a dedicated Anyo scoreboard and separate Anyo-related category/registration handling.

---

## Responsive Design

The application is intended for use on:

- Desktop computers
- Laptops
- Tablets
- Mobile devices
- Large tournament monitors / LED displays

The project includes responsive CSS for the application, brackets, and scoreboards.

---

## Branding Assets

Tournament branding assets are stored in the `app` directory:

```text
Logo1.webp
Logo2.webp
Logo3.webp
Logo4.webp
```

The project also includes a custom font:

```text
MyCustomFont/ninja-naruto/njnaruto.ttf
```

and a buzzer sound:

```text
buzzer.mp3
```

Make sure you have the right to redistribute any third-party fonts, sounds, logos, or other assets before publishing the repository publicly.

---

## GitHub Setup

From the project root:

```bash
git init
git add .
git commit -m "Initial commit"
```

Create a GitHub repository, then connect it:

```bash
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the URL with your actual GitHub repository.

---

## Recommended `.gitignore`

Before the first push, create a `.gitignore` file and exclude local/private configuration where appropriate.

Example:

```gitignore
# OS files
.DS_Store
Thumbs.db
desktop.ini

# Editors
.vscode/
.idea/

# Node/Deno/local dependencies if added later
node_modules/
.env
.env.*
!.env.example

# Local/private configuration
app/db/supabase-config.local.js
app/db/auth-config.local.js

# Logs
*.log
```

**Review the actual configuration files before committing.** Do not blindly add sensitive files to GitHub.

---

## Development Notes

This project has undergone multiple database and synchronization revisions. The SQL files in `app/db/` document the evolution of the Supabase backend, including fixes for roles, logos, tournament/member operations, draw lots, staff/accounting, and cloud synchronization.

When modifying the application:

1. Preserve responsive behavior.
2. Test both desktop and mobile layouts.
3. Test bracket progression after every bracket-related change.
4. Test database persistence after creating/updating tournaments.
5. Test player/team/category registration.
6. Test both Combative and Anyo workflows.
7. Verify Supabase RLS and authorization rules.
8. Test a complete tournament flow before deployment.

---

## Known Development Considerations

Because this is an active tournament system, changes to bracket state and cloud synchronization should be made carefully.

Particular areas that should be regression-tested include:

- Winner advancement
- Round transitions
- Bye handling
- Match queue ordering
- Saving match results
- Saving tournament state
- Cloud synchronization
- Role permissions
- Registration persistence
- Scoreboard-to-bracket updates
- Anyo deductions and scoring
- Combative one-round match completion
- Final score display for `0–0`
- Multiple simultaneous tournament displays

---

## License

No explicit open-source license is currently defined in the project.

If this repository is intended to be publicly reusable, add an appropriate license file such as:

```text
LICENSE
```

Do not assume that absence of a license means others are free to copy, modify, or redistribute the software.

---

## Credits

**RADIUM Tournament System**

Developed for tournament operations involving Karate and Arnis competitions.

Core areas:

- Tournament Management
- Arnis Combative / Padded Stick
- Arnis Anyo
- Bracket Management
- Live Scoring
- Player & Team Registration
- Supabase Cloud Database
- Tournament Administration
- Staff Management

---

## Disclaimer

This software is intended as a tournament-management and scoring tool. Tournament organizers and authorized officials remain responsible for verifying registrations, brackets, scores, results, competition rules, and official records before and during an event.

Always validate the system against the rules and procedures of the organization conducting the competition.
