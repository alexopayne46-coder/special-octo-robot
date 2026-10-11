import { useNavigate } from "react-router-dom";
import { useBackendPack } from "../hooks/useBackendPack";

interface ChatInfo {
  id: number;
  peerId: number | null;
  title: string | null;
  username: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function Audience() {
  const navigate = useNavigate();
 
  const modules = [
    {
      name: "Chats",
      path: "/application/chats"
    },
    {
      name: "LookALike Users",
      path: "/application/lookalike-users"
    },
    {
      name: "Import",
      path: "/application/import"
    }
  ]

  return (
    <div>
      <h1 className="text-4xl font-bold caprasimo-regular mb-6">Audience</h1>

      <ul className="menu bg-base-200 rounded-box w-full">
          <li className="menu-title">Select Chat</li>
          {modules.map((module) => (
            <li key={module.name}>
              <a onClick={() => navigate(module.path)}>
                {module.name}
              </a>
            </li>
          ))}
        </ul>
    </div>
  );
}
