import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { Provider } from './context/provider.tsx';
import { PointsProvider } from './context/points.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Provider>
            <PointsProvider>
                <App />
            </PointsProvider>
        </Provider>
    </StrictMode>,
);
