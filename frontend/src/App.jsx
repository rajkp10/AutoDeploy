import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import NodeFormPage from "./pages/NodeFormPage";
import ReactFormPage from "./pages/ReactFormPage";
import ViewDeployedApps from "./pages/ViewDeployedApps";

function App() {
  return (
    <Router>
      <Routes>
        <Route exact path="/" element={<HomePage />} />
        <Route path="/node" element={<NodeFormPage />} />
        <Route path="/react" element={<ReactFormPage />} />
        <Route path="/deploys" element={<ViewDeployedApps />} />
      </Routes>
    </Router>
  );
}

export default App;
