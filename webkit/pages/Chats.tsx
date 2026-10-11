import { useEffect, useState } from "react";
import { useBackendPack } from "../hooks/useBackendPack";
import { useBackend } from "../hooks/useBackend";

interface ChatInfo {
  id: number;
  peerId: number | null;
  title: string | null;
  username: string | null;
  groupId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface ChatGroupInfo {
  id: number;
  name: string;
  chatCount: number;
}

const MAX_TITLE_LENGTH = 32;

// Array.from counts full characters, so emoji are not cut in half
const truncate = (text: string, max = MAX_TITLE_LENGTH) => {
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max - 1).join("") + "…" : text;
};

export default function Chats() {
  const { call } = useBackend();
  const [groupFilter, setGroupFilter] = useState("all");

  const { data: groups } = useBackendPack<ChatGroupInfo[]>(
    "ChatGroups",
    {},
    { errorMessage: "Failed to load groups" }
  );

  const chatsArgs = groupFilter === "all" ? {} : { groupId: Number(groupFilter) };
  const { data: chats, loading, error, refetch } = useBackendPack<ChatInfo[]>(
    "Chats",
    chatsArgs,
    { errorMessage: "Failed to load chat information" }
  );

  useEffect(() => {
    refetch();
  }, [groupFilter]);

  const groupName = (groupId: number | null) =>
    groups?.find((g) => g.id === groupId)?.name ?? null;

  const handleGroupChange = async (chat: ChatInfo, groupId: number | null) => {
    try {
      await call("ChatAttachGroup", { chatId: chat.id, groupId });
      await refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-4xl font-bold caprasimo-regular">Chats</h1>
        <select
          className="select select-bordered select-sm w-64"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value="all">All groups</option>
          <option value="">No group</option>
          {(groups ?? []).map((g) => (
            <option key={g.id} value={String(g.id)}>
              {g.name} ({g.chatCount})
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="table table-zebra table-xs">
            <thead>
              <tr>
                <th>ID</th>
                <th>Peer ID</th>
                <th>Title</th>
                <th>Username</th>
                <th>Group</th>
                <th>Created</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {chats?.map((chat) => (
                <tr key={chat.id}>
                  <th>{chat.id}</th>
                  <td className="font-mono text-sm">{chat.peerId || "-"}</td>
                  <td
                    className="font-semibold max-w-[32ch] truncate whitespace-nowrap"
                    title={chat.title ?? undefined}
                  >
                    {chat.title ? truncate(chat.title) : "-"}
                  </td>
                  <td className="font-mono text-sm">
                    {chat.username ? `@${chat.username}` : "-"}
                  </td>
                  <td>
                    <select
                      className="select select-xs w-40"
                      value={chat.groupId ? String(chat.groupId) : ""}
                      onChange={(e) =>
                        handleGroupChange(
                          chat,
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                    >
                      <option value="">No group</option>
                      {(groups ?? []).map((g) => (
                        <option key={g.id} value={String(g.id)}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="text-sm">{formatDate(chat.createdAt)}</td>
                  <td className="text-sm">{formatDate(chat.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && (!chats || chats.length === 0) && (
        <div className="flex flex-col items-center text-center bg-white border border-gray-200 rounded-2xl px-6 py-16">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 text-gray-400 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM12 21a9 9 0 10-8.1-5.04L3 21l5.04-.9A8.96 8.96 0 0012 21z" />
            </svg>
          </div>

          {groupFilter === "all" ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900">No chats yet</h2>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                Chats appear here automatically once your account starts receiving
                or syncing conversations. You can then sort them into groups.
              </p>
              <ul className="mt-6 text-left text-sm text-gray-500 space-y-2">
                <li>• Make sure the backend is connected and running</li>
                <li>• Check that your account has at least one active conversation</li>
                <li>• Press refresh to load the latest data</li>
              </ul>
              <button
                className="btn btn-sm btn-outline mt-8 bg-white"
                onClick={() => refetch()}
              >
                Refresh
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900">
                {groupFilter === ""
                  ? "No ungrouped chats"
                  : `No chats in "${groupName(Number(groupFilter)) ?? "this group"}"`}
              </h2>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                {groupFilter === ""
                  ? "Every chat is already assigned to a group."
                  : "Assign chats to this group using the Group dropdown in the table, or pick another filter."}
              </p>
              <button
                className="btn btn-sm btn-outline mt-8 bg-white"
                onClick={() => setGroupFilter("all")}
              >
                Show all chats
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}