"use client";
import { useEffect, useState } from "react";
import type {
  Advertiser,
  Territory,
} from "@/modules/forecasting/domain/models";
import { api, ApiError, errorMessage } from "./client-api";
export function Advertisers({
  territories,
}: {
  territories: readonly Territory[];
}) {
  const [rows, setRows] = useState<Advertiser[]>([]),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [revision, refresh] = useState(0);
  const [selected, setSelected] = useState<Advertiser | "new" | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<Advertiser[]>(
      `advertisers?search=${encodeURIComponent(query)}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then(setRows)
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [query, revision]);
  return (
    <section>
      <div className="toolbar">
        <h2>Advertiser management</h2>
        <button
          onClick={() => {
            setSelected("new");
            setMessage("");
          }}
        >
          Add advertiser
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {selected ? (
        <AdvertiserEditor
          key={
            selected === "new" ? "new" : `${selected.id}-${selected.version}`
          }
          record={selected === "new" ? undefined : selected}
          territories={territories}
          onCancel={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            refresh((n) => n + 1);
            setMessage("Advertiser saved.");
          }}
        />
      ) : (
        <>
          <form
            className="panel filters"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search);
              setError("");
            }}
          >
            <label className="search">
              Find advertiser
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or six-digit ID"
              />
            </label>
            <button>Search advertisers</button>
          </form>
          <div className="panel results">
            <div className="table-scroll">
              <table>
                <caption>{rows.length} advertisers</caption>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Territory</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <th scope="row">{row.name}</th>
                      <td>
                        {
                          territories.find((t) => t.id === row.territoryId)
                            ?.name
                        }
                      </td>
                      <td>
                        <button
                          className="secondary"
                          onClick={() => {
                            setSelected(row);
                            setMessage("");
                          }}
                        >
                          Edit advertiser {row.id}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <p className="empty">No advertisers match your search.</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
function AdvertiserEditor({
  record,
  territories,
  onCancel,
  onSaved,
}: {
  record?: Advertiser;
  territories: readonly Territory[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [id, setId] = useState(record?.id ?? ""),
    [name, setName] = useState(record?.name ?? ""),
    [territoryId, setTerritory] = useState(
      record?.territoryId ?? territories[0]?.id ?? "",
    );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        record ? `advertisers/${record.id}` : "advertisers",
        record ? "PATCH" : "POST",
        {
          id,
          name,
          territoryId,
          ...(record ? { version: record.version } : {}),
        },
      );
      onSaved();
    } catch (e) {
      setError(
        `${errorMessage(e)} ${e instanceof ApiError ? Object.values(e.fields).join(" ") : ""}`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel editor" onSubmit={save}>
      <h2>{record ? "Edit advertiser" : "New advertiser"}</h2>
      <fieldset disabled={busy} className="filters">
        <label>
          Advertiser ID
          <input
            required
            pattern="[0-9]{6}"
            maxLength={6}
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
        </label>
        <label className="search">
          Advertiser name
          <input
            required
            maxLength={500}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Assigned territory
          <select
            value={territoryId}
            onChange={(e) => setTerritory(e.target.value)}
          >
            {territories.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="actions">
        <button disabled={busy}>Save advertiser</button>
        <button
          type="button"
          disabled={busy}
          className="secondary"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
