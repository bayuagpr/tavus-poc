import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { CVIProvider } from './components/cvi/components/cvi-provider'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TutorApiProvider } from './hooks/tutor'
import { createTutorApiClient } from './api/tutor'


async function bootstrap() {
 const mocks = import.meta.env.DEV && (new URLSearchParams(window.location.search).get('mock') === '1' || import.meta.env.VITE_ENABLE_TUTOR_MOCKS === 'true');
 if (mocks) { const { startTutorMocks } = await import('./mocks/browser'); await startTutorMocks(); }
 const queryClient = new QueryClient();
 const api = createTutorApiClient({ baseUrl: mocks ? '' : import.meta.env.VITE_SSE_API_BASE_URL ?? '' });
 createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><TutorApiProvider client={api}><CVIProvider><App /></CVIProvider></TutorApiProvider></QueryClientProvider></StrictMode>);
}
void bootstrap().catch(error => { console.error('Application startup failed', error); const root = document.getElementById('root'); if (root) root.textContent = 'Unable to initialize the application. Reload to try again.'; });
