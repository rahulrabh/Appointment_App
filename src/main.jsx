import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Check,
  X,
  Sparkles,
  ArrowUpRight,
  Mail,
  UserRound,
} from "lucide-react";
import "./styles.css";
import "./state.css";
const zone = "Asia/Kolkata",
API = import.meta.env.VITE_API_URL || "http://127.0.0.1:3001/v1",
  headers = { "x-user-id": "demo-user", "content-type": "application/json" };
const f = (d, o) =>
  new Intl.DateTimeFormat("en-US", { timeZone: zone, ...o }).format(d);
const key = (d) => {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  return `${p.find((x) => x.type === "year").value}-${p.find((x) => x.type === "month").value}-${p.find((x) => x.type === "day").value}`;
};
function App() {
  const today = useMemo(
      () => new Date(`${key(new Date())}T00:00:00+05:30`),
      [],
    ),
    [week, setWeek] = useState(0),
    [date, setDate] = useState(key(today)),
    [slots, setSlots] = useState([]),
    [selected, setSelected] = useState(),
    [appointments, setAppointments] = useState([]),
    [details, setDetails] = useState({ name: "", email: "" }),
    [modal, setModal] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(null),
    [loading, setLoading] = useState(true),
    [isConfirming, setIsConfirming] = useState(false);
  const start = useMemo(() => {
      const d = new Date(today);
      d.setDate(d.getDate() + week * 7);
      return d;
    }, [today, week]),
    days = useMemo(
      () =>
        Array.from({ length: 7 }, (_, i) => {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          return d;
        }),
      [start],
    ),
    current = days.find((d) => key(d) === date) || days[0],
    daySlots = slots.filter(
      (s) =>
        key(new Date(s.startsAt)) === date &&
        new Date(s.endsAt) - new Date(s.startsAt) === 3600000,
    ),
    past = (s) => new Date(s.startsAt) <= new Date(),
    disabled = (s) => s.status === "booked" || past(s);
  const notify = (m) => {
      setToast(m);
      setTimeout(() => setToast(null), 4000);
    },
    load = async () => {
      setLoading(true);
      try {
        const to = new Date(today);
        to.setDate(to.getDate() + 30);
        const r = await fetch(
          `${API}/availability?from=${today.toISOString()}&to=${to.toISOString()}`,
          { headers },
        );
        if (!r.ok) throw Error();
        setSlots((await r.json()).slots);
      } catch {
        notify("Could not load availability. Start the API and try again.");
      } finally {
        setLoading(false);
      }
    },
    loadAppointments = async () => {
      const r = await fetch(`${API}/appointments?scope=upcoming`, { headers });
      if (r.ok) setAppointments((await r.json()).appointments);
    };
  useEffect(() => {
    load();
    loadAppointments();
  }, []);
  const chooseDay = (d) => {
    setDate(key(d));
    setSelected();
  };
  const confirm = async () => {
    if (!details.name.trim() || !/^\S+@\S+\.\S+$/.test(details.email))
      return setError("Enter your name and a valid email address.");
    setIsConfirming(true);
    notify("Sending your confirmation email…");
    try {
      const r = await fetch(`${API}/appointments`, {
        method: "POST",
        headers,
        body: JSON.stringify({ slotId: selected.id, ...details }),
      });
      if (!r.ok) {
        setModal(false);
        setSelected();
        await load();
        return notify("That time is no longer available.");
      }
      setModal(false);
      setSelected();
      setError("");
      notify("Appointment confirmed.");
      await Promise.all([load(), loadAppointments()]);
    } catch {
      notify("Could not confirm your appointment.");
    } finally {
      setIsConfirming(false);
    }
  };
  const cancel = async (id) => {
    const r = await fetch(`${API}/appointments/${id}`, {
      method: "DELETE",
      headers,
    });
    if (r.ok) {
      notify("Appointment cancelled.");
      await Promise.all([load(), loadAppointments()]);
    } else notify("Could not cancel appointment.");
  };
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand">
          <span className="brand-mark">
            <Sparkles size={16} />
          </span>
          luma
        </a>
        <nav>
          <a href="#book">Book a visit</a>
          <a href="#appointments">My appointments</a>
        </nav>
        {/* <button className="avatar">AR</button> */}
      </header>
      <section className="hero">
        <div>
          <p className="eyebrow">BOOK WITH EASE</p>
          <h1>
            Time set aside
            <br />
            <em>for you.</em>
          </h1>
          <p className="hero-copy">
            Schedule a focused, one-hour visit with our team at a time that fits
            your day.
          </p>
        </div>
      </section>
      <section className="booking-grid" id="book">
        <div className="booking-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CHOOSE A TIME</p>
              <h2>Book your visit</h2>
            </div>
            <span className="duration">
              <Clock3 size={15} />
              60 min
            </span>
          </div>
          <div className="date-head">
            <button
              disabled={!week}
              onClick={() => {
                const d = new Date(start);
                d.setDate(d.getDate() - 7);
                setWeek((w) => w - 1);
                chooseDay(d);
              }}
            >
              <ChevronLeft />
            </button>
            <strong>{f(start, { month: "long", year: "numeric" })}</strong>
            <button
              disabled={week >= 4}
              onClick={() => {
                const d = new Date(start);
                d.setDate(d.getDate() + 7);
                setWeek((w) => w + 1);
                chooseDay(d);
              }}
            >
              <ChevronRight />
            </button>
          </div>
          <div className="dates">
            {days.map((d) => (
              <button
                key={key(d)}
                className={key(d) === date ? "date active" : "date"}
                onClick={() => chooseDay(d)}
              >
                <small>{f(d, { weekday: "short" })}</small>
                <b>{f(d, { day: "numeric" })}</b>
                <small>{f(d, { month: "short" })}</small>
              </button>
            ))}
          </div>
          <p className="available-label">
            Times for{" "}
            {f(current, { weekday: "short", month: "short", day: "numeric" })}{" "}
            <span>
              ({daySlots.filter((s) => !disabled(s)).length} available)
            </span>
          </p>
          {loading ? (
            <div className="empty">Loading available appointments…</div>
          ) : (
            <div className="slots">
              {daySlots.length ? (
                daySlots.map((s) => (
                  <button
                    key={s.id}
                    disabled={disabled(s)}
                    className={selected?.id === s.id ? "slot selected" : "slot"}
                    onClick={() => setSelected(s)}
                  >
                    {disabled(s)
                      ? past(s)
                        ? "Passed"
                        : "Booked"
                      : f(new Date(s.startsAt), {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                    {selected?.id === s.id && <Check size={15} />}
                  </button>
                ))
              ) : (
                <div className="empty">
                  No times available for {f(current, { weekday: "long" })}.
                </div>
              )}
            </div>
          )}
          <div className="booking-action">
            <div>
              <span>{selected ? "Selected" : "Select an available time"}</span>
              <strong>
                {selected
                  ? f(new Date(selected.startsAt), {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "60-minute appointment"}
              </strong>
            </div>
            <button
              className="primary"
              disabled={!selected}
              onClick={() => setModal(true)}
            >
              Continue <ArrowUpRight size={17} />
            </button>
          </div>
        </div>
      </section>
      <section id="appointments" className="appointments">
        <div className="appointments-title">
          <div>
            <p className="eyebrow">YOUR SCHEDULE</p>
            <h2>My appointments</h2>
          </div>
          <span>{appointments.length} upcoming</span>
        </div>
        {appointments.length ? (
          <div className="appointment-list">
            {appointments.map((a) => (
              <article className="appointment" key={a.id}>
                <div className="cal-block">
                  <b>{f(new Date(a.startsAt), { day: "numeric" })}</b>
                  <span>{f(new Date(a.startsAt), { month: "short" })}</span>
                </div>
                <div>
                  <h3>Personal appointment — {a.attendeeName || "Guest"}</h3>
                  <p className="contact">
                    {a.attendeeEmail || "Email not provided"}
                  </p>
                  <p>
                    <Clock3 size={14} />
                    {f(new Date(a.startsAt), {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    · 60 minutes
                  </p>
                </div>
                <div className="appointment-actions">
                  <span className="confirmed">
                    <Check size={14} />
                    Confirmed
                  </span>
                  <button type="button" onClick={() => cancel(a.id)}>
                    Cancel
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <CalendarDays size={23} />
            <div>
              <strong>No upcoming appointments</strong>
              <p>Your next moment of focus is just a few clicks away.</p>
            </div>
          </div>
        )}
      </section>
      {modal && (
        <div className="modal-backdrop">
          <form
            className="details-modal"
            onSubmit={(e) => {
              e.preventDefault();
              confirm();
            }}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setModal(false)}
            >
              <X size={18} />
            </button>
            <p className="eyebrow">ONE LAST DETAIL</p>
            <h2>Where should we send your confirmation?</h2>
            <label>
              <span>
                <UserRound size={14} />
                Full name
              </span>
              <input
                autoFocus
                value={details.name}
                onChange={(e) =>
                  setDetails({ ...details, name: e.target.value })
                }
              />
            </label>
            <label>
              <span>
                <Mail size={14} />
                Email address
              </span>
              <input
                type="email"
                value={details.email}
                onChange={(e) =>
                  setDetails({ ...details, email: e.target.value })
                }
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary modal-confirm" disabled={isConfirming}>
              {isConfirming ? "Sending confirmation…" : "Confirm appointment"}
              {isConfirming ? <Clock3 size={17} /> : <Check size={17} />}
            </button>
          </form>
        </div>
      )}
      {toast && (
        <div className="toast">
          <Check size={18} />
          <span>{toast}</span>
          <button onClick={() => setToast(null)}>
            <X size={17} />
          </button>
        </div>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
