import { describe, expect, it } from "vitest";
import { openDatabase, seed } from "./db.js";

describe("appointment persistence", () => {
  it("enforces one appointment per slot, protecting against concurrent reservations", () => {
    const db = openDatabase(":memory:");
    seed(db);
    const slot = db
      .prepare("SELECT id FROM slots WHERE status='available' LIMIT 1")
      .get();
    db.prepare(
      "UPDATE slots SET status='booked' WHERE id=? AND status='available'",
    ).run(slot.id);
    db.prepare(
      "INSERT INTO appointments (id,user_id,slot_id) VALUES (?,?,?)",
    ).run("first", "demo-user", slot.id);
    expect(() =>
      db
        .prepare("INSERT INTO appointments (id,user_id,slot_id) VALUES (?,?,?)")
        .run("second", "demo-user", slot.id),
    ).toThrow();
  });
});
