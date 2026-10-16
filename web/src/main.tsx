import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './theme.css';
import { Landing } from './screens/Landing.js';
import { GameRoom } from './screens/GameRoom.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/game/:code" element={<GameRoom />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
