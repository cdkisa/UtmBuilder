import { createContext, useContext } from 'react';
import { useQuery } from './useQuery.js';
import { collection } from '../storage/provider.js';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { data: rows = [] } = useQuery(() => collection('workspaceSettings').list(), ['workspaceSettings'], []);
  const settings = rows[0] || {};

  return (
    <WorkspaceContext.Provider value={{ settings }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
