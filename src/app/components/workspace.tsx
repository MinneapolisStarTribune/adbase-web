"use client";
import { useEffect, useState } from "react";
import type {
  Bootstrap,
  Choices,
  QueryResult,
} from "@/modules/forecasting/application/service";
import {
  months,
  type AuditEvent,
  type Forecast,
} from "@/modules/forecasting/domain/models";
import { api, displayAmount, errorMessage } from "./client-api";
import { ForecastEditor } from "./forecast-editor";
import { Advertisers } from "./advertisers";
type Filter = {
  territoryId: string;
  year: number;
  search: string;
  range: string;
  page: number;
};
export function Workspace({ bootstrap }: { bootstrap: Bootstrap }) {
  const initial: Filter = {
    territoryId: bootstrap.territories[0]?.id ?? "",
    year: bootstrap.years[0] ?? 2026,
    search: "",
    range: "ALL",
    page: 1,
  };
  const [draft, setDraft] = useState(initial),
    [filter, setFilter] = useState(initial),
    [result, setResult] = useState<QueryResult | null>(null),
    [revision, refresh] = useState(0);
  const [tab, setTab] = useState("forecasts"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [editor, setEditor] = useState<{
    record?: Forecast;
    choices: Choices;
    territoryId: string;
    year: number;
  } | null>(null);
  useEffect(() => {
    if (!filter.territoryId || tab !== "forecasts") return;
    const controller = new AbortController();
    const params = new URLSearchParams(
      Object.entries(filter).map(([k, v]) => [k, String(v)]),
    );
    setBusy(true);
    setError("");
    setResult(null);
    api<QueryResult>(`forecasts?${params}`, "GET", undefined, controller.signal)
      .then(setResult)
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [filter, revision, tab]);
  async function openEditor(record?: Forecast) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const params = new URLSearchParams(
        Object.entries({ ...filter, page: 1 }).map(([k, v]) => [k, String(v)]),
      );
      const choices = await api<Choices>(`choices?${params}`);
      setEditor({
        record,
        choices,
        territoryId: record?.territoryId ?? filter.territoryId,
        year: record?.year ?? filter.year,
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    try {
      await api("/api/session", "DELETE");
      window.location.reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function download() {
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/workspace/export", {
        cache: "no-store",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
      const url = URL.createObjectURL(await response.blob()),
        link = document.createElement("a");
      link.href = url;
      link.download =
        response.headers
          .get("content-disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? "ForecastRevenue.csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Domo export downloaded.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="toolbar">
        <span>
          Signed in as <strong>{bootstrap.displayName}</strong>
        </span>
        <button className="secondary" onClick={signOut}>
          Sign out
        </button>
      </div>
      <nav className="tabs" aria-label="Workspace sections">
        <button
          aria-current={tab === "forecasts" ? "page" : undefined}
          onClick={() => {
            setTab("forecasts");
            setEditor(null);
          }}
        >
          Forecasts
        </button>
        {bootstrap.isAdministrator && (
          <>
            <button
              aria-current={tab === "advertisers" ? "page" : undefined}
              onClick={() => {
                setTab("advertisers");
                setEditor(null);
              }}
            >
              Advertisers
            </button>
            <button
              aria-current={tab === "audit" ? "page" : undefined}
              onClick={() => {
                setTab("audit");
                setEditor(null);
              }}
            >
              Activity
            </button>
            <button onClick={download} disabled={busy}>
              Download Domo CSV
            </button>
          </>
        )}
      </nav>
      {error && (
        <p role="alert" className="notice field-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {tab === "advertisers" ? (
        <Advertisers territories={bootstrap.territories} />
      ) : tab === "audit" ? (
        <Activity />
      ) : !bootstrap.territories.length ? (
        <section className="panel">
          <h2>No territory access</h2>
          <p>No territories are assigned to this account.</p>
        </section>
      ) : (
        <>
          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              setFilter({ ...draft, page: 1 });
              setMessage("");
            }}
          >
            <fieldset className="filters" disabled={busy || Boolean(editor)}>
              <label>
                Territory
                <select
                  value={draft.territoryId}
                  onChange={(e) =>
                    setDraft({ ...draft, territoryId: e.target.value })
                  }
                >
                  {bootstrap.territories.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Year
                <select
                  value={draft.year}
                  onChange={(e) =>
                    setDraft({ ...draft, year: Number(e.target.value) })
                  }
                >
                  {bootstrap.years.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </label>
              <label>
                Advertiser range
                <select
                  value={draft.range}
                  onChange={(e) =>
                    setDraft({ ...draft, range: e.target.value })
                  }
                >
                  {["ALL", "#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map(
                    (range) => (
                      <option key={range}>{range}</option>
                    ),
                  )}
                </select>
              </label>
              <label className="search">
                Advertiser search
                <input
                  value={draft.search}
                  maxLength={500}
                  onChange={(e) =>
                    setDraft({ ...draft, search: e.target.value })
                  }
                  placeholder="Name or ID overrides range"
                />
              </label>
              <button>View forecasts</button>
            </fieldset>
          </form>
          <section className="summary">
            <div>
              <p className="eyebrow">TERRITORY ANNUAL TOTAL</p>
              <p className="total" data-testid="annual-total">
                {result ? displayAmount(result.annualTotal) : "—"}
              </p>
              <p>
                {
                  bootstrap.territories.find((t) => t.id === filter.territoryId)
                    ?.name
                }{" "}
                · {filter.year} · All advertisers
              </p>
            </div>
            <button
              disabled={busy || Boolean(editor)}
              onClick={() => openEditor()}
            >
              Add forecast
            </button>
          </section>
          {editor && (
            <ForecastEditor
              key={editor.record?.id ?? "new"}
              {...editor}
              onCancel={() => setEditor(null)}
              onSaved={() => {
                refresh((n) => n + 1);
                if (editor.record) {
                  setEditor(null);
                  setMessage("Forecast updated.");
                }
              }}
            />
          )}
          {busy && <p role="status">Loading…</p>}
          {result && (
            <section className="panel results">
              <div className="results-heading">
                <h2>Monthly forecasts</h2>
                <span>{result.totalRecords} records</span>
              </div>
              {!result.forecasts.length ? (
                <p className="empty">No forecasts match your selection.</p>
              ) : (
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Monthly forecast table"
                >
                  <table>
                    <caption>Monthly forecast amounts</caption>
                    <thead>
                      <tr>
                        <th scope="col">Advertiser</th>
                        <th scope="col">Product</th>
                        {months.map((month) => (
                          <th scope="col" className="numeric" key={month}>
                            {month}
                          </th>
                        ))}
                        <th scope="col">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.forecasts.map((record) => (
                        <tr key={record.id}>
                          <th scope="row">
                            {record.advertiserName}
                            <small>{record.advertiserId}</small>
                          </th>
                          <td>{record.productName}</td>
                          {months.map((month) => (
                            <td className="numeric" key={month}>
                              {displayAmount(record.amounts[month])}
                            </td>
                          ))}
                          <td>
                            <button
                              className="secondary"
                              disabled={busy || Boolean(editor)}
                              onClick={() => openEditor(record)}
                            >
                              Edit {record.advertiserId}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="pagination">
                <button
                  className="secondary"
                  disabled={busy || Boolean(editor) || result.page <= 1}
                  onClick={() =>
                    setFilter({ ...filter, page: result.page - 1 })
                  }
                >
                  Previous
                </button>
                <span>
                  Page {result.page} of {result.pages}
                </span>
                <button
                  className="secondary"
                  disabled={
                    busy || Boolean(editor) || result.page >= result.pages
                  }
                  onClick={() =>
                    setFilter({ ...filter, page: result.page + 1 })
                  }
                >
                  Next
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
function Activity() {
  const [events, setEvents] = useState<AuditEvent[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<AuditEvent[]>("audit", "GET", undefined, controller.signal)
      .then(setEvents)
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, []);
  return (
    <section className="panel results">
      <div className="results-heading">
        <h2>Recent activity</h2>
        <span>Latest 100 events</span>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Time (UTC)</th>
              <th>Account</th>
              <th>Operation</th>
              <th>Result</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{event.at}</td>
                <td>{event.actorId}</td>
                <td>{event.operation}</td>
                <td>{event.outcome}</td>
                <td>{event.correlationId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
