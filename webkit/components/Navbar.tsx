import { Link, useNavigation } from "react-router-dom";
import { useEffect, useState } from "react";
import classnames from "classnames";

export default function Navbar() {
  const navigation = [
    { name: "Main", path: "/application/main" },
    { name: "Chats", path: "/application/audience/chats" },
    { name: "LookALike Users", path: "/application/audience/lookalike-users" },
    { name: "Ad Campaigns", path: "/application/campaigns" },
    { name: "Artifacts", path: "/application/campaigns/artifacts" },
    { name: "Import", path: "/application/import" },
  ];

  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const func = (event: NavigateEvent) => {
      const uri = new URL(event.destination.url);
      setCurrentPath(uri.pathname);
    };
    if (window.navigation) {
      window.navigation.addEventListener("navigate", func);
    }

    return () => {
      if (window.navigation) {
        window.navigation.removeEventListener("navigate", func);
      }
    };
  }, [typeof window, typeof navigation]);

  return (
    <div className="bg-black text-white">
      <div className="flex-none container mx-auto">
        <ul className="flex gap-6 py-2">
          {navigation.map((item) => (
            <li className="text-xs font-bold " key={item.path}>
              <Link to={item.path} className={classnames("text-white", { "underline": currentPath === item.path })}>{item.name}</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}