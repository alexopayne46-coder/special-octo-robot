import { useState } from "react";
import { useBackendPack } from "../hooks/useBackendPack";
import { useAppStore } from "../stores/app";

interface UserInfo {
   id: number
  displayName: string
  firstName: string
  lastName: string
  username: string
  phoneNumber: string
  isBot: boolean
  isSelf: boolean
  isPremium: boolean
  status: string
  lastOnline: any
}

export default function Main() {
  const [isComfortableView, setIsComfortableView] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const { data: users, loading, error, refetch } = useBackendPack<UserInfo[]>(
    "HypervisorInfo",
    {},
    { errorMessage: "Failed to load user information" }
  );

  return (
    <div>
      <h1 className="text-4xl font-bold  caprasimo-regular mb-6">Accounts</h1>

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


          <table className={isComfortableView ? "table table-zebra" : "table table-zebra table-xs"}>
            <thead>
              <tr>
                <th>
                  <label>
                    <input type="checkbox" className="checkbox" checked={selectedUsers.length === users?.length} onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers(users?.map(user => user.id) || []);
                      } else {
                        setSelectedUsers([]);
                      }
                    }} />
                  </label>
                </th>
                <th>ID</th>
                <th>Name</th>
                <th>Username</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user, index) => (
                <tr key={user.id}>
                  <th className="w-12">
                    <label>
                      <input type="checkbox" className="checkbox" checked={selectedUsers.includes(user.id)} onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers([...selectedUsers, user.id]);
                        } else {
                          setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                        }
                      }} />
                    </label>
                  </th>
                  <th>{index + 1}</th>
                  <td className="font-semibold">
                    {user.firstName} {user.lastName}
                  </td>
                  <td className="font-mono text-sm">
                    {user.username ? `@${user.username}` : "-"}
                  </td>
                  <td className="font-mono text-sm">
                    {user.phoneNumber || "-"}
                  </td>
                  <td>
                    {
                      user.status === "userStatusOnline" ? <span className="space-x-2 text-lime-500">Online</span> : <span className="space-x-2 text-gray-500">Offline</span>
                    }
                  </td>
                  <td>
                    <span className="text-sm">{user.isBot ? "Bot" : "User"}</span>
                  </td>
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
          <span>No users found</span>
        </div>
      )}
    </div>
  );
}
