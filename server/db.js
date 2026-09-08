import Database from "better-sqlite3";

export function openDatabase(
  filename = process.env.DATABASE_URL || "appointments.db",
) {
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS slots (
      id TEXT PRIMARY KEY,
      starts_at TEXT NOT NULL UNIQUE,
      ends_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','booked'))
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      slot_id TEXT NOT NULL UNIQUE REFERENCES slots(id),
      attendee_name TEXT,
      attendee_email TEXT,
      status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      cancelled_at TEXT
    );
  `);
  // SQLite migrations for databases created before attendee details existed.
  const columns = db
    .prepare("PRAGMA table_info(appointments)")
    .all()
    .map((column) => column.name);
  if (!columns.includes("attendee_name"))
    db.exec("ALTER TABLE appointments ADD COLUMN attendee_name TEXT");
  if (!columns.includes("attendee_email"))
    db.exec("ALTER TABLE appointments ADD COLUMN attendee_email TEXT");
  return db;
}

export function seed(db) {
  db.prepare("INSERT OR IGNORE INTO users (id,email,name) VALUES (?,?,?)").run(
    "demo-user",
    "demo@luma.example",
    "Avery Reed",
  );
  // Migrate the original 30-minute demo slots that overlap the current
  // 10 AM–4 PM IST schedule. This preserves slot IDs and existing bookings.
  db.prepare(
    `
    UPDATE slots
    SET ends_at = strftime('%Y-%m-%dT%H:%M:%fZ', datetime(starts_at, '+1 hour'))
    WHERE (julianday(ends_at) - julianday(starts_at)) * 1440 BETWEEN 29 AND 31
      AND strftime('%H:%M', starts_at) IN ('04:30','05:30','07:30','08:30','09:30','10:30')
  `,
  ).run();
  const insert = db.prepare(
    "INSERT OR IGNORE INTO slots (id,starts_at,ends_at) VALUES (?,?,?)",
  );
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let day = 0; day < 30; day++)
    for (const hour of [10, 11, 13, 14, 15, 16]) {
      const begins = new Date(start);
      begins.setDate(start.getDate() + day);
      begins.setHours(hour, 0, 0, 0);
      const ends = new Date(begins.getTime() + 60 * 60_000);
      insert.run(
        `slot-${begins.toISOString()}`,
        begins.toISOString(),
        ends.toISOString(),
      );
    }
}
