import { createContext, useContext, useState } from "react";

const TeamContext = createContext({ activeTeamId: "", setActiveTeamId: () => {} });

export function TeamProvider({ children, userId }) {
  const storageKey = `dashboardTeamId_${userId}`;
  const [activeTeamId, setActiveTeamIdState] = useState(
    () => localStorage.getItem(storageKey) || ""
  );

  function setActiveTeamId(id) {
    if (!id) return;
    localStorage.setItem(storageKey, id);
    setActiveTeamIdState(id);
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
