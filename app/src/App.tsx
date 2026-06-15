import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Rail } from './components/Rail';
import { Dashboard } from './pages/Dashboard';
import { Judge } from './pages/Judge';
import { Themes } from './pages/Themes';
import { Profile } from './pages/Profile';
import { api } from './api';

export function App() {
  const [name, setName] = useState('Friend');

  useEffect(() => {
    api.me().then((m) => setName(m.display_name)).catch(() => {});
  }, []);

  return (
    <>
      <div className="shell">
        <Sidebar name={name} />
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard name={name} />} />
            <Route path="/judge" element={<Judge />} />
            <Route path="/themes" element={<Themes />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </main>
        <Rail />
      </div>
      <footer className="footer-band">
        <span className="fb-main">Your voice. Your preferences. Your world.</span>
        <span className="fb-sub">Built on the shape of Stanford Human Preferences</span>
      </footer>
    </>
  );
}
