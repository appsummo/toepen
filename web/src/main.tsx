import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './theme.css';
import { LanguageProvider } from './i18n/index.js';
import { Landing } from './screens/Landing.js';
import { GameRoom } from './screens/GameRoom.js';
import { Rules } from './screens/Rules.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          {/* /rules is kept as an alias so an English link works too. */}
          <Route path="/regels" element={<Rules />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/game/:code" element={<GameRoom />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  </React.StrictMode>,
);
