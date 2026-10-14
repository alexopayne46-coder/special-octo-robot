import { useState } from "react";
import { useBackendPack } from "../hooks/useBackendPack";

interface ChatGroupInfo {
  id: number;
  name: string;
  chatCount: number;
}

interface ProxyLite {
  id: number;
  name: string;
  type: string;
  host: string;
  port: number;
}

const NEW_GROUP = "__new__";

export default function Import() {
  const [selectedOption, setSelectedOption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [clearBeforeImport, setClearBeforeImport] = useState(false);
  const [groupSelection, setGroupSelection] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [proxySelection, setProxySelection] = useState("");

  const isChatsCsv = selectedOption === "chats-csv";
  const isTdataAccount = selectedOption === "tdata-account";

  const { data: groups } = useBackendPack<ChatGroupInfo[]>(
    "ChatGroups",
    {},
    { enabled: isChatsCsv, errorMessage: "Failed to load groups" }
  );

  const { data: proxies } = useBackendPack<ProxyLite[]>(
    "Proxies",
    {},
    { enabled: isTdataAccount, errorMessage: "Failed to load proxies" }
  );

  const getGroupName = (): string | undefined => {
    if (!isChatsCsv) return undefined;
    if (groupSelection === NEW_GROUP) {
      return newGroupName.trim() || undefined;
    }
    const selected = groups?.find((g) => String(g.id) === groupSelection);
    return selected?.name;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("type", selectedOption);
      if (clearBeforeImport) {
        formData.append("clearBeforeImport", "true");
      }
      const groupName = getGroupName();
      if (groupName) {
        formData.append("groupName", groupName);
      }
      if (isTdataAccount && proxySelection) {
        formData.append("proxyId", proxySelection);
      }

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(result.message || "Import successful");
      } else {
        setError(result.error || "Import failed");
      }
    } catch (err) {
      setError("Failed to import TData account");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-4xl font-bold caprasimo-regular mb-6">Import</h1>

      <div className="w-full">
        <fieldset className="fieldset bg-base-200 border-base-300 rounded-box  p-4 w-full">
          <label className="label">Import type</label>
          {/* <input type="text" className="input" placeholder="My awesome page" /> */}
          <select className="select" onChange={(e) => { setSelectedOption(e.target.value); setGroupSelection(""); setNewGroupName(""); }}>
            <option disabled selected>Choose import type</option>
            <option>tdata-account</option>
            <option>chats-csv</option>
            <option>other</option>
          </select>

          <label className="label">Select file</label>
          <input type="file" className="file-input ghost" onChange={handleFileChange} />

          {isChatsCsv && (
            <>
              <label className="label">Chat group</label>
              <select
                className="select"
                value={groupSelection}
                onChange={(e) => setGroupSelection(e.target.value)}
              >
                <option value="">No group</option>
                {(groups ?? []).map((g) => (
                  <option key={g.id} value={String(g.id)}>
                    {g.name} ({g.chatCount})
                  </option>
                ))}
                <option value={NEW_GROUP}>+ New group...</option>
              </select>

              {groupSelection === NEW_GROUP && (
                <label className="label">
                  <span className="label-text">New group name</span>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="My chat group"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                </label>
              )}
            </>
          )}

          {isTdataAccount && (
            <>
              <label className="label">Proxy</label>
              <select
                className="select"
                value={proxySelection}
                onChange={(e) => setProxySelection(e.target.value)}
              >
                <option value="">Direct connection</option>
                {(proxies ?? []).map((proxy) => (
                  <option key={proxy.id} value={String(proxy.id)}>
                    {proxy.name} ({proxy.type}) — {proxy.host}:{proxy.port}
                  </option>
                ))}
              </select>
            </>
          )}

          {selectedOption === "chats-csv" && (
            <label className="label cursor-pointer flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                className="checkbox"
                checked={clearBeforeImport}
                onChange={(e) => setClearBeforeImport(e.target.checked)}
              />
              <span>Clear existing chats before import</span>
            </label>
          )}
        </fieldset>



        {error && (
          <div className="alert alert-error mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <dialog id="my_modal_1" className="modal" open>
            <div className="modal-box">
              <h3 className="font-bold text-lg">Success</h3>
              <p className="py-4">
                {success}
              </p>
              <div className="modal-action">
                <form method="dialog">
                  {/* if there is a button in form, it will close the modal */}
                  <button className="btn">Close</button>
                </form>
              </div>
            </div>
          </dialog>

        )}

        <div className="card-actions justify-end mt-4">
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!selectedOption || !selectedFile || loading}
          >
            {loading ? <span className="loading loading-spinner"></span> : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
