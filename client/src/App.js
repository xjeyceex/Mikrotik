import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import HotspotVendo from './pages/HotspotVendo';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/pppoe-vendo" element={<HotspotVendo />} />
      </Routes>
    </Router>
  );
}

export default App;
