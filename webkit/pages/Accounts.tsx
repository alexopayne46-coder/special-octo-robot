import { useState } from "react";
import { useBackend } from "../hooks/useBackend";
import { useBackendPack } from "../hooks/useBackendPack";

interface ProxyLite {
  id: number;
  name: string;
  type: string;
  host: string;
  port: number;
}

interface AccountRow {
  id: number;
  name: string;
  address: string;
  tdataPath: string | null;
  proxyId: number | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  proxy: ProxyLite | null;
  loaded: boolean;
  me: { displayName: string; username: string | null } | null;
}

const emptyForm = () => ({
  name: "",
  proxyId: "",
  enabled: true,
});

export default function Accounts() {
  const { call } = useBackend();
  const { data: accounts, loading, error, refetch } = useBackendPack<AccountRow[]>(
    "Accounts",
    {},
    { errorMessage: "Failed to load accounts" }
  );
  const { data: proxies } = useBackendPack<ProxyLite[]>(
    "Proxies",
    {},
    { errorMessage: "Failed to load proxies" }
  );

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [busyId, setBusyId] = useState<number | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (account: AccountRow) => {
    setEditingId(account.id);
    setFormError(null);
    setForm({
      name: account.name,
      proxyId: account.proxyId !== null ? String(account.proxyId) : "",
      enabled: account.enabled,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      if (editingId !== null) {
        await call("AccountUpdate", {
          id: editingId,
          proxyId: form.proxyId === "" ? null : Number(form.proxyId),
          enabled: form.enabled,
        });
      } else {
        await call("AccountCreate", {
          name: form.name.trim(),
          proxyId: form.proxyId === "" ? null : Number(form.proxyId),
          enabled: form.enabled,
        });
      }

      setShowModal(false);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save account");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (account: AccountRow) => {
    setBusyId(account.id);
    try {
      await call("AccountUpdate", { id: account.id, enabled: !account.enabled });
      await refetch();
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  const spawn = async (account: AccountRow) => {
    setBusyId(account.id);
    try {
      await call("AccountSpawn", { id: account.id });
      await refetch();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to spawn account");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(`Delete account #${id}?`)) return;
    try {
      await call("AccountDelete", { id });
      await refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const shortAddress = (address: string) =>
    address.length > 14 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-4xl font-bold caprasimo-regular">Accounts</h1>
        <button className="btn btn-outline" onClick={openCreate}>
          Register Account
        </button>
      </div>

      <p className="text-sm text-base-content/70 mb-4">
        Accounts live in the database: enabled ones autostart with the app, each can be
        routed through a proxy. New sessions still arrive via Import.
      </p>

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

      {!loading && !error && (!accounts || accounts.length === 0) && (
        <div className="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>No accounts found — import one or register a name</span>
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="table table-zebra table-xs">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Autostart</th>
                <th>Proxy</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts?.map((account) => (
                <tr key={account.id}>
                  <th>{account.id}</th>
                  <td className="font-semibold">
                    {account.name}
                    {account.me && (
                      <div className="text-xs font-normal text-base-content/70">
                        {account.me.displayName}
                        {account.me.username ? ` · @${account.me.username}` : ""}
                      </div>
                    )}
                  </td>
                  <td>
                    {account.loaded ? (
                      <span className="badge badge-sm badge-success">loaded</span>
                    ) : (
                      <span className="badge badge-sm badge-ghost">offline</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-sm ${account.enabled ? "badge-info" : "badge-ghost"}`}>
                      {account.enabled ? "on" : "off"}
                    </span>
                  </td>
                  <td className="font-mono text-sm">
                    {account.proxy ? `${account.proxy.name} (${account.proxy.type})` : "-"}
                  </td>
                  <td className="font-mono text-xs" title={account.address}>{shortAddress(account.address)}</td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => spawn(account)}
                        disabled={busyId === account.id}
                      >
                        {account.loaded ? "Respawn" : "Spawn"}
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => toggleEnabled(account)}>
                        {account.enabled ? "Disable" : "Enable"}
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(account)}>
                        Proxy
                      </button>
                      <button className="btn btn-sm btn-ghost btn-error" onClick={() => handleDelete(account.id)}>
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
              {editingId !== null ? `Edit Account #${editingId}` : "Register Account"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-2">
              <fieldset className="fieldset">
                <label className="label">
                  <span className="label-text">Name</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="account-1"
                  maxLength={64}
                  disabled={editingId !== null}
                  required={editingId === null}
                />
                {editingId === null && (
                  <div className="label">
                    <span className="label-text-alt">
                      Matching session/tdata under data/&lt;name&gt; is reused automatically
                    </span>
                  </div>
                )}
              </fieldset>

              <fieldset className="fieldset">
                <label className="label">
                  <span className="label-text">Proxy</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={form.proxyId}
                  onChange={(e) => setForm({ ...form, proxyId: e.target.value })}
                >
                  <option value="">Direct connection</option>
                  {(proxies ?? []).map((proxy) => (
                    <option key={proxy.id} value={String(proxy.id)}>
                      {proxy.name} ({proxy.type}) — {proxy.host}:{proxy.port}
                    </option>
                  ))}
                </select>
              </fieldset>

              <fieldset className="fieldset">
                <label className="label cursor-pointer justify-start gap-2">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  />
                  <span>Autostart with the app</span>
                </label>
              </fieldset>

              {formError && <div className="alert alert-error py-2"><span>{formError}</span></div>}

              <div className="modal-action">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="loading loading-spinner" /> : editingId !== null ? "Save" : "Register"}
                </button>
              </div>
            </form>
          </div>
        </dialog>
      )}
    </div>
  );
}
