import { createContext, useContext, useState } from "react";

const TeamContext = createContext(null);

export function TeamProvider({ children, userId }) {
  const storageKey = `dashboardTeamId_${userId}`;
  const [activeTeamId, setTeamId] = useState(localStorage.getItem(storageKey) || "");

  function setActiveTeamId(id) {
    if (!id) return;
    localStorage.setItem(storageKey, id);
    setTeamId(id);
  }

  return (
    <TeamContext.Provider value={{ activeTeamId, setActiveTeamId }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useActiveTeam() {
  return useContext(TeamContext);
}
