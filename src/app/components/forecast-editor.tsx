"use client";
import { useState } from "react";
import { months, type Forecast } from "@/modules/forecasting/domain/models";
import type { Choices } from "@/modules/forecasting/application/service";
import { api, ApiError, errorMessage } from "./client-api";
export function ForecastEditor({
  record,
  choices,
  territoryId,
  year,
  onSaved,
  onCancel,
}: {
  record?: Forecast;
  choices: Choices;
  territoryId: string;
  year: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>(
    record
      ? { ...record.amounts }
      : Object.fromEntries(months.map((m) => [m, ""])),
  );
  const [advertiserId, setAdvertiser] = useState(record?.advertiserId ?? ""),
    [productId, setProduct] = useState(record?.productId ?? "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({}),
    [saved, setSaved] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFields({});
    try {
      await api(
        record ? `forecasts/${record.id}` : "forecasts",
        record ? "PATCH" : "POST",
        record
          ? { version: record.version, amounts }
          : { territoryId, year, advertiserId, productId, amounts },
      );
      setSaved(true);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError) setFields(e.fields);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel editor">
      <h2>{record ? "Edit forecast" : "New forecast"}</h2>
      <p>
        {territoryId} · {year}
      </p>
      <form onSubmit={save}>
        <fieldset disabled={busy || saved}>
          <div className="filters editor-selects">
            <label>
              Advertiser
              {record ? (
                <input
                  value={`${record.advertiserName} (${record.advertiserId})`}
                  readOnly
                />
              ) : (
                <select
                  required
                  value={advertiserId}
                  onChange={(e) => {
                    setAdvertiser(e.target.value);
                    setProduct("");
                  }}
                >
                  <option value="">Select advertiser</option>
                  {choices.advertisers.map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name} ({a.id})
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label>
              Product
              {record ? (
                <input value={record.productName} readOnly />
              ) : (
                <select
                  required
                  disabled={!advertiserId}
                  value={productId}
                  onChange={(e) => setProduct(e.target.value)}
                >
                  <option value="">Select product</option>
                  {choices.products
                    .filter(
                      (p) =>
                        !p.advertiserIds ||
                        p.advertiserIds.includes(advertiserId),
                    )
                    .map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              )}
            </label>
          </div>
          <div className="months-grid">
            {months.map((month) => (
              <div key={month}>
                <label htmlFor={`amount-${month}`}>
                  {month}
                  <input
                    id={`amount-${month}`}
                    inputMode="decimal"
                    value={amounts[month]}
                    maxLength={40}
                    onChange={(e) =>
                      setAmounts({ ...amounts, [month]: e.target.value })
                    }
                    aria-invalid={Boolean(fields[month])}
                    aria-describedby={
                      fields[month] ? `error-${month}` : undefined
                    }
                  />
                </label>
                {fields[month] && (
                  <small id={`error-${month}`} className="field-error">
                    {fields[month]}
                  </small>
                )}
              </div>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="field-error">
            {error}{" "}
            {Object.entries(fields)
              .filter(([key]) => !(months as readonly string[]).includes(key))
              .map(([, value]) => value)
              .join(" ")}
          </p>
        )}
        {saved && <p role="status">Forecast saved.</p>}
        <div className="actions">
          <button type="submit" disabled={busy || saved}>
            {busy ? "Saving…" : "Save forecast"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onCancel}
          >
            {saved ? "Back to forecasts" : "Cancel"}
          </button>
          {saved && !record && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSaved(false);
                setAdvertiser("");
                setProduct("");
                setAmounts(Object.fromEntries(months.map((m) => [m, ""])));
              }}
            >
              Add another
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
