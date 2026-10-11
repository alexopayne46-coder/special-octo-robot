import { useState } from "react";
import { useBackendPack } from "../hooks/useBackendPack";
import { useBackend } from "../hooks/useBackend";

export interface CampaignArtifact {
  id: number;
  campaignId: number;
  text: string;
  mood: "positive" | "negative" | "neutral";
  payload: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

const MOOD_BADGE: Record<string, string> = {
  positive: "badge-success",
  negative: "badge-error",
  neutral: "badge-neutral",
};

const MOODS: CampaignArtifact["mood"][] = ["positive", "negative", "neutral"];

interface CampaignArtifactsPanelProps {
  campaignId: number;
  limit?: number;
}

export default function CampaignArtifactsPanel({ campaignId, limit }: CampaignArtifactsPanelProps) {
  const { data: artifacts, loading, error, refetch } = useBackendPack<CampaignArtifact[]>(
    "CampaignArtifacts",
    { campaignId, limit },
    { errorMessage: "Failed to load campaign artifacts" }
  );
  const { call } = useBackend();

  const [showCreate, setShowCreate] = useState(false);
  const [text, setText] = useState("");
  const [mood, setMood] = useState<CampaignArtifact["mood"]>("neutral");
  const [payload, setPayload] = useState("{}");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    let parsedPayload: Record<string, any> = {};
    if (payload.trim()) {
      try {
        parsedPayload = JSON.parse(payload);
      } catch {
        setFormError("Payload must be valid JSON");
        return;
      }
    }

    try {
      setSaving(true);
      setFormError(null);
      await call("CampaignArtifactCreate", {
        campaignId,
        text: text.trim(),
        mood,
        payload: parsedPayload,
      });
      setText("");
      setMood("neutral");
      setPayload("{}");
      setShowCreate(false);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create artifact");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(`Delete artifact #${id}?`)) return;
    try {
      await call("CampaignArtifactDelete", { id });
      await refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateString?: string) =>
    dateString ? new Date(dateString).toLocaleString() : "-";

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <span className="loading loading-spinner loading-md"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-bold">Artifacts</h3>
          <span className="badge badge-ghost badge-sm">{artifacts?.length ?? 0}</span>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-xs btn-ghost" onClick={() => refetch()}>
            Refresh
          </button>
          <button className="btn btn-xs btn-outline" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Cancel" : "New Artifact"}
          </button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="border border-base-300 rounded-box p-3 space-y-2">
          <div className="grid grid-cols-[1fr_10rem] gap-2">
            <input
              type="text"
              className="input input-bordered input-sm w-full"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Artifact text, e.g. Message sent"
              required
            />
            <select
              className="select select-bordered select-sm w-full"
              value={mood}
              onChange={(e) => setMood(e.target.value as CampaignArtifact["mood"])}
            >
              {MOODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <textarea
            className="textarea textarea-bordered textarea-sm w-full font-mono text-xs"
            rows={3}
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder='{"chatId": 42, "messageId": 7}'
          />
          {formError && <div className="alert alert-error py-1"><span className="text-sm">{formError}</span></div>}
          <div className="flex justify-end">
            <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-xs" /> : "Create Artifact"}
            </button>
          </div>
        </form>
      )}

      {(!artifacts || artifacts.length === 0) && (
        <div className="alert alert-info py-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>No artifacts logged for this campaign yet</span>
        </div>
      )}

      {artifacts && artifacts.length > 0 && (
        <div className="overflow-x-auto max-h-96">
          <table className="table table-zebra table-xs">
            <thead>
              <tr>
                <th>ID</th>
                <th>Mood</th>
                <th>Text</th>
                <th>Payload</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {artifacts.map((artifact) => (
                <tr key={artifact.id}>
                  <th>{artifact.id}</th>
                  <td>
                    <span className={`badge badge-sm ${MOOD_BADGE[artifact.mood] ?? "badge-neutral"}`}>
                      {artifact.mood}
                    </span>
                  </td>
                  <td className="text-sm">{artifact.text}</td>
                  <td>
                    {Object.keys(artifact.payload ?? {}).length > 0 ? (
                      <details className="cursor-pointer">
                        <summary className="text-xs text-base-content/70">data</summary>
                        <pre className="text-xs font-mono whitespace-pre-wrap max-w-md">
                          {JSON.stringify(artifact.payload, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-base-content/40">-</span>
                    )}
                  </td>
                  <td className="text-xs">{formatDate(artifact.createdAt)}</td>
                  <td>
                    <button
                      className="btn btn-xs btn-ghost btn-error"
                      onClick={() => handleDelete(artifact.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
