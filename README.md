# 🏏 AI Cricket League

An IPL-style AI-powered Cricket League Simulator built with React, TypeScript, Vite, and Gemini AI.

AI Cricket League allows users to create custom cricket franchises, build squads, simulate realistic T20 leagues, experience dynamic AI-generated commentary, track player statistics, and maintain historical season archives.

---

## ✨ Features

### 🏏 Franchise Management

* Create custom cricket franchises
* Manual squad builder
* Bulk player import support
* Team locking and validation
* Unique player ownership registry

### 📅 Tournament Engine

* Round Robin League Format
* Automatic Fixture Generation
* Points Table Calculation
* Net Run Rate (NRR) Tracking
* Playoff Qualification Logic

### 🏆 IPL Style Playoffs

* Qualifier 1
* Eliminator
* Qualifier 2
* Grand Final

### 🎙️ AI Commentary System

* Ball-by-ball match commentary
* Dynamic cricket storytelling
* High-energy fan reactions
* Kannada-style fan commentary mode
* Replay Commentary System
* Multiple commentary speed controls

### 📊 Statistics & Awards

* Orange Cap
* Purple Cap
* MVP Rankings
* Batting Statistics
* Bowling Statistics
* Team Performance Analytics

### 🏛️ Hall Of Fame

* Season Archives
* Championship History
* Archived Points Tables
* Archived Playoff Records
* Historical Awards
* Match Replay Access

### 🔄 Season Lifecycle

* Archive completed seasons
* Start fresh seasons
* Reset league state
* Preserve historical records

---

## 🛠️ Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS

### Backend

* Node.js
* Express

### AI Engine

* Google Gemini API

---

## 📂 Project Structure

```text
src/
├── components/
│   ├── HallOfFamePanel.tsx
│   ├── MatchSimPanel.tsx
│   ├── Newsroom.tsx
│   ├── PlayoffsPanel.tsx
│   ├── SquadBuilder.tsx
│   └── StatsTable.tsx
│
├── utils/
│   └── cricketCalculations.ts
│
├── App.tsx
├── main.tsx
├── types.ts
│
server.ts
package.json
vite.config.ts
```

## 🚀 Installation

Clone the repository:

```bash
git clone https://github.com/Keerthan-15/AI-Cricket-League.git
cd AI-Cricket-League
```

Install dependencies:

```bash
npm install
```

Create a local environment file:

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

Start development server:

```bash
npm run dev
```

## 🔨 Production Build

```bash
npm run build
```

## 🌟 Highlights

* IPL-inspired tournament structure
* Realistic match simulations
* AI-powered commentary engine
* Interactive playoff system
* Historical season archives
* Modern sports-management interface

## 👨‍💻 Author

**Keerthan GK**

GitHub:
https://github.com/Keerthan-15

## 📜 License

This project is licensed under the MIT License.
