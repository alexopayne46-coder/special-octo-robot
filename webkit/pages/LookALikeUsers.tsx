import { useBackendPack } from "../hooks/useBackendPack";

interface LookALikeUserInfo {
  id: number;
  chatSeen: string;
  chatId: number;
  peerId: number;
  name: string;
  username: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function LookALikeUsers() {
  const { data: users, loading, error, refetch } = useBackendPack<LookALikeUserInfo[]>(
    "LookALikeUsers",
    {},
    { errorMessage: "Failed to load lookalike users" }
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div>
      <h1 className="text-4xl font-bold  caprasimo-regular mb-6">LookALike Users</h1>

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
                <th>Name</th>
                <th>Username</th>
                <th>Chat ID</th>
                <th>Peer ID</th>
                <th>Chat Seen</th>
                <th>Created</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => (
                <tr key={user.id}>
                  <th>{user.id}</th>
                  <td className="font-semibold">{user.name}</td>
                  <td className="font-mono text-sm">
                    {user.username ? `@${user.username}` : "-"}
                  </td>
                  <td className="font-mono text-sm">{user.chatId}</td>
                  <td className="font-mono text-sm">{user.peerId}</td>
                  <td className="text-sm">{user.chatSeen}</td>
                  <td className="text-sm">{formatDate(user.createdAt)}</td>
                  <td className="text-sm">{formatDate(user.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && (!users || users.length === 0) && (
        <div className="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>No lookalike users found</span>
        </div>
      )}
    </div>
  );
}
