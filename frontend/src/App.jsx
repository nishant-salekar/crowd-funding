import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import CreateCampaign from "./pages/CreateCampaign.jsx";
import CampaignDetail from "./pages/CampaignDetail.jsx";
import NetworkBanner from "./components/NetworkBanner.jsx";
import ThreeBackground from "./components/ThreeBackground.jsx";

export default function App() {
  return (
    <div className="page-wrapper">
      {/* Three.js animated background — renders behind everything */}
      <ThreeBackground />

      <Navbar />
      <NetworkBanner />
      <main className="pt-20 relative z-10">
        <Routes>
          <Route path="/"            element={<Home />} />
          <Route path="/create"      element={<CreateCampaign />} />
          <Route path="/campaign/:id" element={<CampaignDetail />} />
        </Routes>
      </main>
    </div>
  );
}
