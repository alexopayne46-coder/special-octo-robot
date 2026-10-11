import { useEffect, useRef, useState } from "react";

type PayloadFieldType = "string" | "number" | "boolean" | "json";

interface PayloadField {
  id: string;
  key: string;
  type: PayloadFieldType;
  value: string;
  jsonError?: string;
}

interface JsonPayloadEditorProps {
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  onValidityChange?: (valid: boolean) => void;
}

let fieldSeq = 0;
const nextFieldId = () => `field_${++fieldSeq}`;

function detectType(value: any): PayloadFieldType {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (value !== null && typeof value === "object") return "json";
  return "string";
}

function toFields(value: Record<string, any>): PayloadField[] {
  return Object.entries(value ?? {}).map(([key, v]) => {
    const type = detectType(v);
    return {
      id: nextFieldId(),
      key,
      type,
      value: type === "json" ? JSON.stringify(v, null, 2) : String(v),
    };
  });
}

function fieldsToObject(fields: PayloadField[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const field of fields) {
    const key = field.key.trim();
    if (!key) continue;

    if (field.type === "number") {
      const parsed = Number(field.value);
      if (field.value !== "" && Number.isFinite(parsed)) {
        result[key] = parsed;
      }
    } else if (field.type === "boolean") {
      result[key] = field.value === "true";
    } else if (field.type === "json") {
      if (!field.jsonError && field.value.trim()) {
        try {
          result[key] = JSON.parse(field.value);
        } catch {
          // keep last valid state
        }
      }
    } else {
      result[key] = field.value;
    }
  }
  return result;
}

function validateJson(text: string): string | undefined {
  if (!text.trim()) return undefined;
  try {
    JSON.parse(text);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid JSON";
  }
}

export default function JsonPayloadEditor({ value, onChange, onValidityChange }: JsonPayloadEditorProps) {
  const [fields, setFields] = useState<PayloadField[]>(() => toFields(value));
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [rawError, setRawError] = useState<string | null>(null);
  const lastEmitted = useRef(JSON.stringify(value ?? {}));

  useEffect(() => {
    const incoming = JSON.stringify(value ?? {});
    if (incoming !== lastEmitted.current) {
      lastEmitted.current = incoming;
      setFields(toFields(value ?? {}));
      setRawText(JSON.stringify(value ?? {}, null, 2));
      setRawError(null);
    }
  }, [value]);

  const hasErrors = fields.some((field) => field.jsonError);

  useEffect(() => {
    onValidityChange?.(!hasErrors && !rawError);
  }, [hasErrors, rawError, onValidityChange]);

  const emit = (next: PayloadField[]) => {
    setFields(next);
    const object = fieldsToObject(next);
    lastEmitted.current = JSON.stringify(object);
    onChange(object);
  };

  const updateField = (id: string, patch: Partial<PayloadField>) => {
    emit(fields.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  };

  const addField = () => {
    emit([...fields, { id: nextFieldId(), key: "", type: "string", value: "" }]);
  };

  const removeField = (id: string) => {
    emit(fields.filter((field) => field.id !== id));
  };

  const handleRawChange = (text: string) => {
    setRawText(text);
    const error = validateJson(text);
    setRawError(error ?? null);
    if (!error) {
      const parsed = JSON.parse(text || "{}");
      lastEmitted.current = JSON.stringify(parsed);
      onChange(parsed);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="label-text font-semibold">Payload settings</span>
        <label className="label cursor-pointer gap-2">
          <span className="label-text text-xs">Raw JSON</span>
          <input
            type="checkbox"
            className="toggle toggle-xs"
            checked={rawMode}
            onChange={(e) => setRawMode(e.target.checked)}
          />
        </label>
      </div>

      {rawMode ? (
        <div>
          <label className="label">
            <span className="label-text">Raw JSON payload</span>
          </label>
          <textarea
            className={`textarea textarea-bordered w-full font-mono text-sm ${rawError ? "textarea-error" : ""}`}
            rows={7}
            value={rawText}
            onChange={(e) => handleRawChange(e.target.value)}
            placeholder='{"delayMs": 100, "maxPerMinute": 10}'
          />
          {rawError && <p className="text-error text-xs mt-1">{rawError}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {fields.length === 0 && (
            <p className="text-sm text-base-content/60">
              No payload fields. Add fields like delayMs or maxPerMinute.
            </p>
          )}

          {fields.map((field) => (
            <div key={field.id} className="space-y-1">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <label className="label">
                    <span className="label-text text-xs">Key</span>
                  </label>
                  <input
                    className="input input-bordered input-sm w-full"
                    placeholder="key"
                    value={field.key}
                    onChange={(e) => updateField(field.id, { key: e.target.value })}
                  />
                </div>

                <div className="w-28">
                  <label className="label">
                    <span className="label-text text-xs">Type</span>
                  </label>
                  <select
                    className="select select-bordered select-sm w-full"
                    value={field.type}
                    onChange={(e) => updateField(field.id, { type: e.target.value as PayloadFieldType })}
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="json">json</option>
                  </select>
                </div>

                <div className="flex-[2]">
                  <label className="label">
                    <span className="label-text text-xs">Value</span>
                  </label>
                  {field.type === "boolean" ? (
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={field.value === "true"}
                      onChange={(e) => updateField(field.id, { value: String(e.target.checked) })}
                    />
                  ) : field.type === "json" ? (
                    <textarea
                      className={`textarea textarea-bordered textarea-sm w-full font-mono text-xs ${field.jsonError ? "textarea-error" : ""}`}
                      rows={2}
                      value={field.value}
                      onChange={(e) =>
                        updateField(field.id, { value: e.target.value, jsonError: validateJson(e.target.value) })
                      }
                      placeholder='{"nested": true}'
                    />
                  ) : (
                    <input
                      type={field.type === "number" ? "number" : "text"}
                      className="input input-bordered input-sm w-full"
                      value={field.value}
                      onChange={(e) => updateField(field.id, { value: e.target.value })}
                    />
                  )}
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost btn-error"
                    onClick={() => removeField(field.id)}
                    aria-label="Remove field"
                  >
                    x
                  </button>
                </div>
              </div>

              {field.jsonError && <p className="text-error text-xs">{field.jsonError}</p>}
            </div>
          ))}

          <button type="button" className="btn btn-sm btn-outline" onClick={addField}>
            + Add field
          </button>
        </div>
      )}
    </div>
  );
}
