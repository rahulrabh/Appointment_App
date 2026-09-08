# Luma Appointments

Luma is a responsive appointment-booking application. Visitors browse a 30-day availability window, book a one-hour slot, receive an SMTP confirmation email, and manage upcoming appointments.

## Features

- 30-day booking horizon with week-by-week navigation
- India-timezone-aware availability, including visible booked and passed slots
- Transaction-safe SQLite booking and cancellation
- Persistent “My appointments” schedule with attendee name and email
- SMTP confirmation email on booking through Nodemailer
- Responsive, keyboard-friendly booking flow with loading, error, empty, and success states

## Stack

- React + Vite frontend (`src/`)
- Node.js HTTP API (`server/server.js`)
- SQLite via `better-sqlite3` (`appointments.db`)
- Nodemailer SMTP notifications (`server/notifications.js`)
- Vitest tests (`server/server.test.js`)

## Project structure

```text
src/                 React UI and styles
server/              API, database setup, and mail service
appointments.db      Local SQLite database (generated locally)
.env                 Local SMTP/API configuration (never commit)
.env.example         Safe configuration template
```

## Run locally

```bash
npm install
cp .env.example .env
npm run api
```

In another terminal:

```bash
npm run dev
```

Open the Vite URL shown in the terminal.

## Environment variables

```env
VITE_API_URL=http://127.0.0.1:3001/v1
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password-or-app-password
MAIL_FROM="Luma Appointments <your-email@example.com>"
```

Use an app password where your email provider requires one. Do not commit `.env`.

## API

- `GET /v1/availability?from&to` — slots and their availability status
- `POST /v1/appointments` — creates an appointment and sends confirmation email
- `GET /v1/appointments?scope=upcoming|past` — current user’s appointments
- `DELETE /v1/appointments/:id` — cancels an appointment and reopens the slot

The demo API authenticates with `X-User-Id: demo-user`. Replace it with session/JWT authentication before deployment.

## Quality checks

```bash
npm test
npm run build
```

## AI assistance

This project was built collaboratively with an AI coding assistant. AI helped turn product requirements into the booking flow, responsive UI, API/database design, concurrency handling, tests, and project documentation. Product decisions, review, configuration, and final approval remained human-directed.
