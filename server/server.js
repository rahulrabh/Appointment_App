import http from "node:http";
import { randomUUID } from "node:crypto";
import { openDatabase, seed } from "./db.js";
import { notify } from "./notifications.js";

const db = openDatabase();
seed(db);
const PORT = Number(process.env.PORT || 3001);
const allowedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

const json = (res, status, payload) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": allowedOrigin,
    vary: "Origin",
  });
  res.end(JSON.stringify(payload));
};
const auth = (req, res) => {
  // Replace this development identity adapter with verified OIDC/JWT middleware in deployment.
  const userId = req.headers["x-user-id"];
  if (!userId || !db.prepare("SELECT 1 FROM users WHERE id=?").get(userId)) {
    json(res, 401, {
      error: { code: "UNAUTHORIZED", message: "Sign in is required." },
    });
    return null;
  }
  return userId;
};
const body = (req) =>
  new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 50_000) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": allowedOrigin,
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type,x-user-id",
      vary: "Origin",
    });
    return res.end();
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "GET" && url.pathname === "/health")
      return json(res, 200, { status: "ok" });
    const userId = auth(req, res);
    if (!userId) return;
    if (req.method === "GET" && url.pathname === "/v1/availability") {
      const from = url.searchParams.get("from") || new Date().toISOString();
      const to =
        url.searchParams.get("to") ||
        new Date(Date.now() + 30 * 864e5).toISOString();
      if (
        Number.isNaN(Date.parse(from)) ||
        Number.isNaN(Date.parse(to)) ||
        from >= to
      )
        return json(res, 422, {
          error: {
            code: "INVALID_RANGE",
            message: "A valid from/to range is required.",
          },
        });
      return json(res, 200, {
        slots: db
          .prepare(
            "SELECT id,starts_at AS startsAt,ends_at AS endsAt,status FROM slots WHERE starts_at >= ? AND starts_at < ? ORDER BY starts_at",
          )
          .all(from, to),
      });
    }
    if (req.method === "GET" && url.pathname === "/v1/appointments") {
      const scope = url.searchParams.get("scope") || "upcoming";
      if (!["upcoming", "past"].includes(scope))
        return json(res, 422, {
          error: {
            code: "INVALID_SCOPE",
            message: "scope must be upcoming or past.",
          },
        });
      const comparator = scope === "upcoming" ? ">=" : "<";
      return json(res, 200, {
        appointments: db
          .prepare(
            `SELECT a.id,a.status,a.attendee_name AS attendeeName,a.attendee_email AS attendeeEmail,s.starts_at AS startsAt,s.ends_at AS endsAt FROM appointments a JOIN slots s ON s.id=a.slot_id WHERE a.user_id=? AND a.status='confirmed' AND s.starts_at ${comparator} ? ORDER BY s.starts_at ${scope === "upcoming" ? "ASC" : "DESC"}`,
          )
          .all(userId, new Date().toISOString()),
      });
    }
    if (req.method === "POST" && url.pathname === "/v1/appointments") {
      const { slotId, name, email } = await body(req);
      if (typeof slotId !== "string" || slotId.length > 150)
        return json(res, 422, {
          error: { code: "INVALID_SLOT", message: "slotId is required." },
        });
      if (
        typeof name !== "string" ||
        !name.trim() ||
        typeof email !== "string" ||
        !/^\S+@\S+\.\S+$/.test(email)
      )
        return json(res, 422, {
          error: {
            code: "INVALID_CONTACT",
            message: "A valid name and email are required.",
          },
        });
      db.prepare("UPDATE users SET name=?, email=? WHERE id=?").run(
        name.trim(),
        email.trim().toLowerCase(),
        userId,
      );
      const reserve = db.transaction(() => {
        const updated = db
          .prepare(
            "UPDATE slots SET status='booked' WHERE id=? AND status='available' AND starts_at > ?",
          )
          .run(slotId, new Date().toISOString());
        if (updated.changes !== 1) return null;
        const prior = db
          .prepare("SELECT id FROM appointments WHERE slot_id=?")
          .get(slotId);
        const appointment = { id: prior?.id || randomUUID(), slotId };
        if (prior) {
          db.prepare(
            "UPDATE appointments SET user_id=?, status='confirmed', cancelled_at=NULL, attendee_name=?, attendee_email=? WHERE id=?",
          ).run(
            userId,
            name.trim(),
            email.trim().toLowerCase(),
            appointment.id,
          );
        } else {
          db.prepare(
            "INSERT INTO appointments (id,user_id,slot_id,attendee_name,attendee_email) VALUES (?,?,?,?,?)",
          ).run(
            appointment.id,
            userId,
            slotId,
            name.trim(),
            email.trim().toLowerCase(),
          );
        }
        return db
          .prepare(
            "SELECT a.id,a.status,a.attendee_name AS attendeeName,a.attendee_email AS attendeeEmail,s.starts_at AS startsAt,s.ends_at AS endsAt FROM appointments a JOIN slots s ON s.id=a.slot_id WHERE a.id=?",
          )
          .get(appointment.id);
      });
      const appointment = reserve();
      if (!appointment)
        return json(res, 409, {
          error: {
            code: "SLOT_UNAVAILABLE",
            message: "That time was just booked. Please choose another slot.",
          },
        });
      let previewUrl = null;
      try {
        previewUrl = await notify(appointment);
      } catch (error) {
        console.error("Notification failed:", error);
      }
      return json(res, 201, { appointment, notification: { previewUrl } });
    }
    const match = url.pathname.match(/^\/v1\/appointments\/([\w-]+)$/);
    if (req.method === "DELETE" && match) {
      const cancel = db.transaction(() => {
        const a = db
          .prepare(
            "SELECT a.*,a.attendee_name AS attendeeName,a.attendee_email AS attendeeEmail,s.starts_at AS startsAt,s.ends_at AS endsAt FROM appointments a JOIN slots s ON s.id=a.slot_id WHERE a.id=? AND a.user_id=? AND a.status='confirmed'",
          )
          .get(match[1], userId);
        if (!a) return false;
        db.prepare(
          "UPDATE appointments SET status='cancelled',cancelled_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(a.id);
        db.prepare("UPDATE slots SET status='available' WHERE id=?").run(
          a.slot_id,
        );
        return a;
      });
      const appointment = cancel();
      if (!appointment)
        return json(res, 404, {
          error: { code: "NOT_FOUND", message: "Appointment was not found." },
        });
      try {
        await notify(appointment, "cancellation");
      } catch (error) {
        console.error("Cancellation notification failed:", error);
      }
      return json(res, 204, {});
    }
    return json(res, 404, {
      error: { code: "NOT_FOUND", message: "Route not found." },
    });
  } catch (error) {
    console.error(error);
    return json(res, 400, {
      error: {
        code: "BAD_REQUEST",
        message: error.message || "Could not process request.",
      },
    });
  }
});
server.listen(PORT, "0.0.0.0", () =>
  console.log(`Appointments API listening on :${PORT}`),
);
export { server, db };
