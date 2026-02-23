# ⬡ ConceptGraph

A full-stack learning platform that visualises any subject as an interactive **directed acyclic graph (DAG)**. Mark concepts as mastered, unlock prerequisites, generate AI-powered roadmaps for any topic, and get personalised explanations, quizzes, and study suggestions — all in a sleek dark-mode interface.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Environment Variables](#environment-variables)
- [Authentication](#authentication)
- [How It Works](#how-it-works)
  - [The Graph Engine](#the-graph-engine)
  - [AI Roadmap Generator](#ai-roadmap-generator)
  - [AI Features](#ai-features)
  - [Progress Persistence](#progress-persistence)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [UI Guide](#ui-guide)

---

## Overview

ConceptGraph turns any learning subject into a **visual prerequisite graph**. Concepts are nodes; prerequisite relationships are directed edges. The system computes which concepts you can unlock next based on what you've already mastered, guides you through a personalised path, and uses AI to explain, quiz, and advise at every step.

The platform ships with a **built-in DSA (Data Structures & Algorithms) roadmap** and lets you generate unlimited custom roadmaps for any topic using the AI Roadmap Generator.

---

## Features

###  Graph Visualisation
- Interactive DAG rendered with **ReactFlow**
- Hierarchical layout computed via longest-path BFS
- Four concept states with distinct colours:
  - 🟢 **Mastered** — completed by you
  - 🔵 **Unlocked** — all prerequisites met, ready to learn
  - 🟡 **One Away (Frontier)** — one prerequisite missing
  - ⚫ **Locked** — multiple prerequisites incomplete
- Live node colour updates as you progress
- Zoom, pan, and fit-view controls

###  AI Assistant (3 modes)
- **Suggest** — personalised "what to learn next" recommendation based on your exact progress
- **Explain** — detailed AI explanation of any unlocked concept, tailored to your background
- **Quiz** — multiple-choice questions with answer feedback and explanations; tracks previous questions to avoid repeats
- **Follow-up Chat** — threaded conversation to ask follow-up questions after any explanation

###  AI Roadmap Generator
- Type any subject (e.g. "Machine Learning", "Cybersecurity", "Blockchain")
- AI generates a full concept graph with prerequisites and difficulty levels
- DAG is validated before saving — cycles are rejected automatically
- Instantly loadable into the visualiser

###  Authentication & User Accounts
- Email/password registration and login
- JWT-based session management (7-day tokens)
- bcrypt password hashing
- Progress fully isolated per user account
- Cross-device sync — progress loads from the database on every login

###  Progress Tracking
- Per-topic progress bar with live percentage
- Mastered / Unlocked / One-Away concept lists in the sidebar
- "Mark as Complete" button per concept
- Progress auto-saves to the database on every toggle
- Resource checklist per concept — track which links you've read

###  UI/UX
- Dark theme with IBM Plex Mono throughout
- Resizable right panel (drag handle)
- Topic switcher dropdown with all your roadmaps
- Locked concept blocker list — shows exactly which prerequisites to complete first, each clickable
- Difficulty pills (Beginner → Advanced) on each concept

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, ReactFlow, Axios |
| Styling | Inline styles with design token system  |
| Backend | FastAPI (Python) |
| Database | MySQL |
| AI | Groq API — Llama 3.3 70B |
| Auth | JWT (PyJWT), bcrypt |
| Dev Server | Vite |

---

## Project Structure

```
conceptgraph/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── auth.py              # JWT + bcrypt auth routes (/auth/*)
│   ├── routes/
│   │   ├── topics.py        # Graph data routes (/topics/*)
│   │   ├── roadmap.py       # Topic listing + AI generator (/roadmap/*)
│   │   ├── progress.py      # Per-user progress routes (/progress/*)
│   │   └── ai.py            # AI explain/suggest/quiz/chat (/ai/*)
│   ├── db.py                # MySQL connection + helpers
│   ├── graph.py             # DAG engine (unlocked/frontier computation)
│   └── requirements.txt
│
└── frontend/
    └── src/
        ├── main.jsx          # Entry point — AuthProvider + Root gating
        ├── App.jsx           # Main application (graph + panels)
        ├── AuthPage.jsx      # Login / Register UI
        └── AuthContext.jsx   # Auth state, token management, axios helpers
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- MySQL 8.0+
- A [Groq API key](https://console.groq.com) (free tier available)

---

### Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create your MySQL database:

```sql
CREATE DATABASE conceptgraph;
```

Run the backend:

```bash
uvicorn main:app --reload --port 8000
```

The API is available at `http://localhost:8000`.  
Interactive docs (Swagger UI) are at `http://localhost:8000/docs`.

---

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app is available at `http://localhost:5173`.

---

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=conceptgraph
DB_USER=root
DB_PASSWORD=your_password

# Auth
JWT_SECRET=your_super_secret_key_here

# AI
GROQ_API_KEY=gsk_your_groq_api_key_here
```

---

## Authentication

ConceptGraph uses **JWT Bearer token authentication**.

### Flow

```
User submits email + password
        ↓
Backend verifies credentials (bcrypt compare)
        ↓
On success → returns { token, user }
        ↓
Frontend stores token in localStorage as "cg_token"
        ↓
All API requests include:
  Authorization: Bearer <token>
        ↓
On app reload → token verified via GET /auth/me
  ✓ valid:   restore session silently
  ✗ invalid: clear token, redirect to login
```

### Token Details

| Property | Value |
|----------|-------|
| Algorithm | HS256 |
| Expiry | 7 days |
| Storage | `localStorage` — key `cg_token` |
| Header | `Authorization: Bearer <token>` |

### Password Rules
- Minimum 8 characters, maximum 72 (bcrypt limit)
- Stored as a bcrypt hash — never in plaintext

---

## How It Works

### The Graph Engine

Each topic is stored as **concepts** (nodes) and **prerequisite edges** (directed edges: prerequisite → dependent).

When you mark concepts as mastered, the backend computes two derived sets:

**Unlocked** — every prerequisite is satisfied:
```
unlocked = { C | ∀ prereq P of C : P ∈ mastered }
```

**Frontier** — exactly one prerequisite is still missing:
```
frontier = { C | exactly one prereq P of C : P ∉ mastered }
```

Both are recomputed and returned to the frontend on every mastered-set change. Node colours update live without a page reload.

---

### AI Roadmap Generator

When you type a topic and click **Generate**:

1. The topic string is sent to **Groq Llama 3.3 70B** with a structured prompt
2. The model returns JSON: concept names, descriptions, difficulty levels (1–5), prerequisite edges, and resource URLs
3. The backend runs a **topological sort** to validate the graph is a true DAG (no cycles)
4. If invalid → request rejected with an error message
5. If valid → graph saved to MySQL, immediately available in the topic switcher

---

### AI Features

All AI calls use Groq's API (Llama 3.3 70B).

| Feature | Inputs sent to AI | Output |
|---------|------------------|--------|
| **Suggest** | Mastered / unlocked / frontier concept name lists | Plain-English next-step recommendation |
| **Explain** | Concept name + description + your mastered concepts | Detailed explanation pitched at your level |
| **Quiz** | Concept name + mastered concepts + previous questions | New 4-option MCQ with answer key and explanation |
| **Chat** | Concept name, full explanation, chat history, new question | Contextual follow-up answer |

The Quiz feature passes `previous_questions` to the model so it never generates the same question twice in a session.

---

### Progress Persistence

Progress is stored in a `user_progress` table keyed by `(user_id, topic_id, concept_id)`.

**On topic load:**
```
GET /progress/{topic_id}
→ returns { mastered_ids: [1, 3, 7, ...] }
→ frontend restores state instantly
```

**On concept toggle:**
```
POST /progress/toggle  { concept_id: 12, mastered: true }
→ upserts the record in the database
→ frontend updates optimistically (no loading spinner)
```

Progress is fully portable — log in on any device and your state is restored from the database.

---

## API Reference

### Auth Routes

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| `POST` | `/auth/register` | `{ email, password }` | `{ token, user }` |
| `POST` | `/auth/login` | `{ email, password }` | `{ token, user }` |
| `GET` | `/auth/me` | — | `{ id, email }` |

### Topic Routes

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `GET` | `/topics/{topic_id}/path` | — | Full concept list |
| `GET` | `/topics/{topic_id}/edges` | — | All prerequisite edges |
| `POST` | `/topics/{topic_id}/unlocked` | `{ mastered_ids }` | Compute unlocked concepts |
| `POST` | `/topics/{topic_id}/frontier` | `{ mastered_ids }` | Compute frontier concepts |
| `GET` | `/topics/concept/{concept_id}` | — | Single concept detail |

### Roadmap Routes

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `GET` | `/roadmap/` | — | List all topics |
| `POST` | `/roadmap/generate` | `{ topic }` | AI-generate and save a new roadmap |

### Progress Routes *(requires Bearer token)*

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `GET` | `/progress/{topic_id}` | — | Get `{ mastered_ids }` for current user |
| `POST` | `/progress/toggle` | `{ concept_id, mastered }` | Save or remove a mastered concept |

### AI Routes

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/ai/suggest` | `{ mastered_names, unlocked_names, frontier_names }` | Study suggestion |
| `POST` | `/ai/explain` | `{ concept_name, concept_description, mastered_names }` | Concept explanation |
| `POST` | `/ai/quiz` | `{ concept_name, mastered_names, previous_questions }` | Quiz question |
| `POST` | `/ai/chat` | `{ concept_name, explanation, question, mastered_names, history }` | Follow-up chat |

---

## Database Schema

```sql
-- Users
CREATE TABLE users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(255) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,          -- bcrypt hash
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Topics (roadmaps)
CREATE TABLE topics (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Concepts (graph nodes)
CREATE TABLE concepts (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  topic_id         INT NOT NULL REFERENCES topics(id),
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  difficulty_level INT DEFAULT 1,            -- 1 = Beginner … 5 = Advanced
  resources        JSON                      -- array of URLs
);

-- Prerequisite edges (graph edges)
CREATE TABLE prerequisites (
  from_concept_id INT NOT NULL REFERENCES concepts(id),
  to_concept_id   INT NOT NULL REFERENCES concepts(id),
  PRIMARY KEY (from_concept_id, to_concept_id)
);

-- Per-user progress
CREATE TABLE user_progress (
  user_id    INT NOT NULL REFERENCES users(id),
  topic_id   INT NOT NULL REFERENCES topics(id),
  concept_id INT NOT NULL REFERENCES concepts(id),
  mastered   BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, topic_id, concept_id)
);
```

---

## UI Guide

### Icon Rail (far left)

| Icon | Function |
|------|----------|
| `⬡` | App logo |
| `⊞` | Switch to Progress tab |
| `✦` | Switch to AI Assistant tab |
| `◈` | Open AI Roadmap Generator |
| `⏻` | Sign out (hover to see your email) |
| `0%` | Live topic completion percentage |

### Graph Canvas (centre)
- **Click any node** to open its detail card in the right panel
- **Scroll** to zoom, **drag** to pan the graph
- **Bottom-left legend** shows the colour key for all four concept states

### Right Panel — Progress Tab
- Progress bar with mastered count and percentage
- **Selected concept card**: state pill, difficulty pill, first-line description, mark-complete toggle, and resource checklist with per-link checkboxes
- **Locked state**: shows the exact list of prerequisite concepts still needed, each one clickable to jump to it
- Below the card: live lists of *Ready to Learn*, *One Step Away*, and *Mastered* concepts

### Right Panel — AI Assistant Tab
- ` SUGGEST` — get a personalised recommendation; regenerate freely
- ` EXPLAIN` — AI explains the selected concept; follow-up chat thread appears below the explanation
- ` QUIZ` — start a quiz on the selected concept; press *Next Question* to continue after answering

### Resize Handle
Drag the thin vertical bar between the graph and the right panel to resize (range: 280px – 660px).

### Topic Switcher (top-left)
Dropdown listing all your saved roadmaps. The last item always opens the AI Roadmap Generator to create a new one.

---

## License

MIT — free to use, modify, and distribute.
