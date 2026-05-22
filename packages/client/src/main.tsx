import type { UserId } from '@chatter/shared';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const userId: UserId = 'user-1';
  return <p>Chatter — {userId}</p>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
