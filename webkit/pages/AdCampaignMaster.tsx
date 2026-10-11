import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useBackendPack } from "../hooks/useBackendPack";
import { useBackend } from "../hooks/useBackend";
import SMPSTCPayload from "../components/SMPSTCPayload";

interface AdCampaignTime {
  startAt?: string;
  endAt?: string;
  asFastAsPossible: boolean;
}

interface AdCampaign {
  id: number;
  name: string;
  time: AdCampaignTime;
  payload: Record<string, any>;
  campaignType: string;
  status: string;
  addressesForCampaign: string[];
  createdAt: string;
  updatedAt: string;
}

interface CampaignMeta {
  campaignTypes: string[];
  statuses: string[];
  createStatuses: string[];
}

interface ChatGroupInfo {
  id: number;
  name: string;
  chatCount: number;
}

interface ChatInfo {
  id: number;
  peerId: number | null;
  title: string | null;
  username: string | null;
  groupId: number | null;
}

const DEFAULT_STATUSES = ["draft", "scheduled", "running", "completed", "failed"];
const DEFAULT_CREATE_STATUSES = ["draft", "scheduled"];

const STATUS_BADGE: Record<string, string> = {
  draft: "badge-neutral",
  scheduled: "badge-warning",
  running: "badge-info",
  completed: "badge-success",
  failed: "badge-error",
};

const SPM_SEND_TO_CHATS = "SPM::SendToChats";

const emptyForm = () => ({
  name: "",
  time: { startAt: "", endAt: "", asFastAsPossible: true },
  payloadSettings: { delayMs: 100 } as Record<string, any>,
  messageText: "",
  groupId: null as number | null,
  campaignType: "SPM::SendToChats",
  status: "draft",
  addressesForCampaign: "",
});

export default function AdCampaignMaster() {
  const { data: campaigns, loading, error, refetch } = useBackendPack<AdCampaign[]>(
    "AdCampaigns",
    {},
    { errorMessage: "Failed to load campaigns" }
  );
  const { data: meta } = useBackendPack<CampaignMeta>(
    "AdCampaignMeta",
    {},
    { errorMessage: "Failed to load campaign meta" }
  );
  const { data: groups } = useBackendPack<ChatGroupInfo[]>(
    "ChatGroups",
    {},
    { errorMessage: "Failed to load chat groups" }
  );
  const { call } = useBackend();

  const [selectedCampaigns, setSelectedCampaigns] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());

  const { data: groupChats, refetch: refetchGroupChats } = useBackendPack<ChatInfo[]>(
    "Chats",
    form.groupId ? { groupId: form.groupId } : {},
    { enabled: !!form.groupId, errorMessage: "Failed to load group chats" }
  );

  useEffect(() => {
    refetchGroupChats();
  }, [form.groupId, refetchGroupChats]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (campaign: AdCampaign) => {
    setEditingId(campaign.id);
    const payload = campaign.payload ?? {};
    const { messageText, chatGroupId, ...settings } = payload;
    setForm({
      name: campaign.name ?? "",
      time: {
        startAt: toLocalInput(campaign.time?.startAt),
        endAt: toLocalInput(campaign.time?.endAt),
        asFastAsPossible: campaign.time?.asFastAsPossible ?? true,
      },
      payloadSettings: settings ?? {},
      messageText: typeof messageText === "string" ? messageText : "",
      groupId: typeof chatGroupId === "number" ? chatGroupId : null,
      campaignType: campaign.campaignType,
      status: campaign.status,
      addressesForCampaign: (campaign.addressesForCampaign ?? []).join(", "),
    });
    setFormError(null);
    setShowModal(true);
  };

  const isSendToChats = form.campaignType === SPM_SEND_TO_CHATS;

  const buildPayload = (): Record<string, any> => {
    if (!isSendToChats) return {};

    const payload: Record<string, any> = { ...form.payloadSettings };
    const text = form.messageText.trim();
    if (text) payload.messageText = text;

    if (form.groupId) {
      payload.chatGroupId = form.groupId;
      payload.chats = (groupChats ?? []).map((chat) => ({
        peerId: chat.peerId,
        title: chat.title ?? undefined,
        username: chat.username ?? undefined,
      }));
    }

    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const addresses = form.addressesForCampaign
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const args: Record<string, any> = {
      name: form.name.trim(),
      campaignType: form.campaignType,
      status: form.status,
      time: {
        startAt: form.time.startAt ? new Date(form.time.startAt).toISOString() : undefined,
        endAt: form.time.endAt ? new Date(form.time.endAt).toISOString() : undefined,
        asFastAsPossible: form.time.asFastAsPossible,
      },
      payload: buildPayload(),
      addressesForCampaign: addresses,
    };

    try {
      setSaving(true);
      setFormError(null);

      if (editingId !== null) {
        await call("AdCampaignUpdate", { id: editingId, ...args });
      } else {
        await call("AdCampaignCreate", args);
      }

      setShowModal(false);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save campaign");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (campaign: AdCampaign, status: string) => {
    try {
      await call("AdCampaignStatus", { id: campaign.id, status });
      await refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(`Delete campaign #${id}?`)) return;
    try {
      await call("AdCampaignDelete", { id });
      await refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateString?: string) =>
    dateString ? new Date(dateString).toLocaleString() : "-";

  const describeTime = (time: AdCampaignTime) => {
    if (time.asFastAsPossible) return "ASAP";
    const parts: string[] = [];
    if (time.startAt) parts.push(formatDate(time.startAt));
    if (time.endAt) parts.push(formatDate(time.endAt));
    return parts.length > 0 ? parts.join(" → ") : "Scheduled";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-4xl font-bold caprasimo-regular">Ad Campaign Master</h1>
        <button className="btn btn-outline" onClick={openCreate}>
          Create Campaign
        </button>
      </div>

      {loading && (
        <div className="flex justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="table table-zebra table-xs">
            <thead>
              <tr>
                <th>
                  <label>
                    <input type="checkbox" className="checkbox" checked={selectedCampaigns.length === campaigns?.length} onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCampaigns(campaigns?.map(campaign => campaign.id) || []);
                      } else {
                        setSelectedCampaigns([]);
                      }
                    }} />
                  </label>
                </th>
                <th>ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Time</th>
                <th>Addresses</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns?.map((campaign) => (
                <tr key={campaign.id}>
                  <th>
                  <label>
                    <input type="checkbox" className="checkbox" checked={selectedCampaigns.includes(campaign.id)} onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCampaigns([...selectedCampaigns, campaign.id]);
                      } else {
                        setSelectedCampaigns(selectedCampaigns.filter(id => id !== campaign.id));
                      }
                    }} />
                  </label>
                </th>
                  <th>{campaign.id}</th>
                  <td className="font-semibold">{campaign.name || "-"}</td>
                  <td className="font-mono text-sm">{campaign.campaignType}</td>
                  <td>
                    <select
                      className={`select select-xs ${STATUS_BADGE[campaign.status] ?? "badge-neutral"}`}
                      value={campaign.status}
                      onChange={(e) => handleStatusChange(campaign, e.target.value)}
                    >
                      {(meta?.statuses ?? ["draft", "scheduled", "running", "completed", "failed"]).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="text-sm">{describeTime(campaign.time ?? { asFastAsPossible: true })}</td>
                  <td className="text-sm">
                    <span className="badge badge-ghost">{campaign.addressesForCampaign?.length ?? 0}</span>
                    {campaign.addressesForCampaign?.slice(0, 2).join(", ")}
                    {(campaign.addressesForCampaign?.length ?? 0) > 2 && "…"}
                  </td>
                  <td className="text-sm">{formatDate(campaign.createdAt)}</td>
                  <td className="text-sm">{formatDate(campaign.updatedAt)}</td>
                  <td>
                    <div className="flex gap-2">
                      <Link
                        className="btn btn-sm btn-ghost"
                        to={`/application/campaigns/${campaign.id}/artifacts`}
                      >
                        Artifacts
                      </Link>
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(campaign)}>
                        Edit
                      </button>
                      <button className="btn btn-sm btn-ghost btn-error" onClick={() => handleDelete(campaign.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && (!campaigns || campaigns.length === 0) && (
        <div className="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>No campaigns found</span>
        </div>
      )}

      {showModal && (
        <dialog className="modal" open>
          <div className="modal-box w-11/12 max-w-4xl">
            <h3 className="font-bold text-lg mb-4">
              {editingId !== null ? `Edit Campaign #${editingId}` : "Create Campaign"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-2">
              <fieldset className="fieldset">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">
                      <span className="label-text">Name</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="My campaign"
                      required
                    />
                  </div>

                  <div>
                    <label className="label">
                      <span className="label-text">Campaign Type</span>
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={form.campaignType}
                      onChange={(e) => setForm({ ...form, campaignType: e.target.value })}
                    >
                      {(meta?.campaignTypes ?? ["SPM::SendToChats"]).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </fieldset>

              {editingId !== null && (
                <fieldset className="fieldset">
                  <label className="label">
                    <span className="label-text">Status</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    {(meta?.statuses ?? DEFAULT_STATUSES).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </fieldset>
              )}

              <fieldset className="fieldset">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">
                      <span className="label-text">Start At</span>
                    </label>
                    <input
                      type="datetime-local"
                      className="input input-bordered w-full"
                      value={form.time.startAt}
                      onChange={(e) => setForm({ ...form, time: { ...form.time, startAt: e.target.value } })}
                      disabled={form.time.asFastAsPossible}
                    />
                  </div>

                  <div>
                    <label className="label">
                      <span className="label-text">End At</span>
                    </label>
                    <input
                      type="datetime-local"
                      className="input input-bordered w-full"
                      value={form.time.endAt}
                      onChange={(e) => setForm({ ...form, time: { ...form.time, endAt: e.target.value } })}
                      disabled={form.time.asFastAsPossible}
                    />
                  </div>
                </div>

                <label className="label cursor-pointer justify-start gap-2">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={form.time.asFastAsPossible}
                    onChange={(e) => setForm({ ...form, time: { ...form.time, asFastAsPossible: e.target.checked } })}
                  />
                  <span>Send as fast as possible</span>
                </label>

                <label className="label">
                  <span className="label-text">Addresses for campaign (comma-separated or JSON array)</span>
                </label>
                <textarea
                  className="textarea textarea-bordered w-full font-mono text-sm"
                  rows={3}
                  value={form.addressesForCampaign}
                  onChange={(e) => setForm({ ...form, addressesForCampaign: e.target.value })}
                  placeholder="0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b, 0xabc123..."
                />
              </fieldset>

              {isSendToChats && (
                <SMPSTCPayload
                  messageText={form.messageText}
                  onMessageTextChange={(text) => setForm({ ...form, messageText: text })}
                  groupId={form.groupId}
                  onGroupChange={(id) => setForm({ ...form, groupId: id })}
                  payload={form.payloadSettings}
                  onPayloadChange={(next) => setForm({ ...form, payloadSettings: next })}
                  groups={groups ?? null}
                  groupChats={groupChats ?? null}
                  hidePayloadSettings={true}
                />
              )}


              {formError && <div className="alert alert-error py-2"><span>{formError}</span></div>}

              <div className="modal-action">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="loading loading-spinner" /> : editingId !== null ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </dialog>
      )}
    </div>
  );
}

function toLocalInput(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
