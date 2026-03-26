import { createContext, useContext } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../db';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const settings = useLiveQuery(() => db.workspaceSettings.toCollection().first()) || {};

  return (
    <WorkspaceContext.Provider value={{ settings }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
