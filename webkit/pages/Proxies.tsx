import { useState } from "react";
import { useBackend } from "../hooks/useBackend";
import { useBackendPack } from "../hooks/useBackendPack";

interface ProxyRow {
  id: number;
  type: string;
  name: string;
  host: string;
  port: number;
  rotationUrl: string | null;
  username: string;
  createdAt: string;
  updatedAt: string;
}

const PROXY_TYPES = ["https", "socks5"];

const emptyForm = () => ({
  name: "",
  type: "https",
  host: "",
  port: "",
  rotationUrl: "",
  username: "",
  password: "",
});

export default function Proxies() {
  const { call } = useBackend();
  const { data: proxies, loading, error, refetch } = useBackendPack<ProxyRow[]>(
    "Proxies",
    {},
    { errorMessage: "Failed to load proxies" }
  );

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (proxy: ProxyRow) => {
    setEditingId(proxy.id);
    setFormError(null);
    setForm({
      name: proxy.name,
      type: proxy.type,
      host: proxy.host,
      port: String(proxy.port),
      rotationUrl: proxy.rotationUrl ?? "",
      username: proxy.username,
      password: "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      if (editingId !== null) {
        await call("ProxyUpdate", {
          id: editingId,
          name: form.name.trim(),
          type: form.type,
          host: form.host.trim(),
          port: Number(form.port),
          rotationUrl: form.rotationUrl.trim() || null,
          username: form.username.trim(),
          password: form.password || undefined,
        });
      } else {
        await call("ProxyCreate", {
          name: form.name.trim(),
          type: form.type,
          host: form.host.trim(),
          port: Number(form.port),
          rotationUrl: form.rotationUrl.trim() || null,
          username: form.username.trim(),
          password: form.password,
        });
      }

      setShowModal(false);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save proxy");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(`Delete proxy #${id}?`)) return;
    try {
      await call("ProxyDelete", { id });
      await refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateString?: string) =>
    dateString ? new Date(dateString).toLocaleString() : "-";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-4xl font-bold caprasimo-regular">Proxies</h1>
        <button className="btn btn-outline" onClick={openCreate}>
          Create Proxy
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

      {!loading && !error && (!proxies || proxies.length === 0) && (
        <div className="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>No proxies found</span>
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="table table-zebra table-xs">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Endpoint</th>
                <th>Rotation</th>
                <th>Username</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {proxies?.map((proxy) => (
                <tr key={proxy.id}>
                  <th>{proxy.id}</th>
                  <td className="font-semibold">{proxy.name || "-"}</td>
                  <td className="font-mono text-sm">{proxy.type}</td>
                  <td className="font-mono text-sm">{proxy.host}:{proxy.port}</td>
                  <td className="font-mono text-xs">
                    {proxy.rotationUrl ? (
                      <a className="link" href={proxy.rotationUrl} target="_blank" rel="noreferrer">
                        rotation
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="font-mono text-sm">{proxy.username}</td>
                  <td className="text-sm">{formatDate(proxy.updatedAt)}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(proxy)}>
                        Edit
                      </button>
                      <button className="btn btn-sm btn-ghost btn-error" onClick={() => handleDelete(proxy.id)}>
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

      {showModal && (
        <dialog className="modal" open>
          <div className="modal-box w-11/12 max-w-4xl">
            <h3 className="font-bold text-lg mb-4">
              {editingId !== null ? `Edit Proxy #${editingId}` : "Create Proxy"}
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
                      placeholder="rotating-main"
                      maxLength={64}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">
                      <span className="label-text">Type</span>
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                    >
                      {PROXY_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </fieldset>

              <fieldset className="fieldset">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">
                      <span className="label-text">Host</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={form.host}
                      onChange={(e) => setForm({ ...form, host: e.target.value })}
                      placeholder="1.2.3.4 or proxy.example.com"
                      maxLength={253}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">
                      <span className="label-text">Port</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered w-full"
                      value={form.port}
                      onChange={(e) => setForm({ ...form, port: e.target.value })}
                      placeholder="8080"
                      min={1}
                      max={65535}
                      required
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="fieldset">
                <label className="label">
                  <span className="label-text">Rotation URL</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={form.rotationUrl}
                  onChange={(e) => setForm({ ...form, rotationUrl: e.target.value })}
                  placeholder="http://gateway.example.com/rotate (optional)"
                />
              </fieldset>

              <fieldset className="fieldset">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">
                      <span className="label-text">Username</span>
                      <span className="label-text-alt">optional</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      maxLength={128}
                      placeholder="leave empty for no auth"
                    />
                  </div>

                  <div>
                    <label className="label">
                      <span className="label-text">Password</span>
                      {editingId !== null ? (
                        <span className="label-text-alt">empty = keep current</span>
                      ) : (
                        <span className="label-text-alt">optional</span>
                      )}
                    </label>
                    <input
                      type="password"
                      className="input input-bordered w-full"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="leave empty for no auth"
                    />
                  </div>
                </div>
              </fieldset>

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
