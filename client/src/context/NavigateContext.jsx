import React from 'react';

export const NavigateContext = React.createContext(null);

export function useNavigate() {
  const navigate = React.useContext(NavigateContext);
  if (!navigate) throw new Error('useNavigate must be used within NavigateContext');
  return navigate;
}
