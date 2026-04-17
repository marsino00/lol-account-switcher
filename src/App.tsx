import { useEffect, useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api, ProfileInfo, AppConfig } from "./lib/api";
import "./App.css";

type Screen = "setup" | "home" | "adding";

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [status, setStatus] = useState("");
  const [launching, setLaunching] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  );

  const loadData = useCallback(async () => {
    try {
      const [cfg, profs] = await Promise.all([
        api.getConfig(),
        api.listProfiles(),
      ]);
      setConfig(cfg);
      setProfiles(profs);
      if (!cfg.riot_client_exe) {
        // Try auto-detect before showing setup
        try {
          const detected = await api.autoDetectRiot();
          showStatus(`Riot Client detectado en ${detected}`);
          const newConfig = await api.getConfig();
          setConfig(newConfig);
          setScreen("home");
        } catch {
          setScreen("setup");
        }
      } else {
        setScreen("home");
      }
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(""), 3000);
  };

  // --- Setup Screen ---
  const handleSelectPath = async () => {
    try {
      const selected = await open({
        directory: true,
        title: "Select the Riot Client folder",
      });
      if (selected) {
        await api.setRiotPath(selected as string);
        showStatus("Path saved");
        await loadData();
      }
    } catch (e) {
      showStatus(`Error: ${e}`);
    }
  };

  // --- Profile Actions ---
  const handleLaunch = async (name: string) => {
    setLaunching(name);
    try {
      await api.launchProfile(name);
      showStatus(`Launched: ${name}`);
    } catch (e) {
      showStatus(`Error: ${e}`);
    }
    setTimeout(() => setLaunching(null), 2000);
  };

  const handleClose = async () => {
    try {
      await api.closeRiot();
      showStatus("Closed");
    } catch (e) {
      showStatus(`Error: ${e}`);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await api.deleteProfile(name);
      showStatus(`Deleted: ${name}`);
      setShowDeleteConfirm(null);
      await loadData();
    } catch (e) {
      showStatus(`Error: ${e}`);
    }
  };

  const handleSetReference = async (name: string) => {
    try {
      await api.setReferenceProfile(name);
      showStatus(`Reference profile: ${name}`);
      await loadData();
    } catch (e) {
      showStatus(`Error: ${e}`);
    }
  };

  // --- Add Flow ---
  const handleStartAdd = () => {
    setNewProfileName("");
    setScreen("adding");
  };

  const handlePrepareAdd = async () => {
    if (!newProfileName.trim()) return;
    try {
      await api.prepareAdd();
      showStatus("Riot Client opened. Log in with 'Stay signed in'.");
    } catch (e) {
      showStatus(`Error: ${e}`);
    }
  };

  const handleFinishAdd = async () => {
    if (!newProfileName.trim()) return;
    try {
      await api.saveProfile(newProfileName.trim());
      showStatus(`Profile '${newProfileName.trim()}' saved`);
      setScreen("home");
      await loadData();
    } catch (e) {
      showStatus(`Error: ${e}`);
    }
  };

  // --- Renders ---
  if (screen === "setup") {
    return (
      <div className="app">
        <div className="setup-screen">
          <div className="setup-icon">⚔️</div>
          <h1 className="setup-title">LoL Switcher</h1>
          <p className="setup-subtitle">
            Select the Riot Client folder to get started
          </p>
          <p className="setup-hint">Usually at C:\Riot Games\Riot Client</p>
           <button className="btn btn-primary btn-lg" onClick={async () => {
            try {
              const detected = await api.autoDetectRiot();
              showStatus(`Detected: ${detected}`);
              await loadData();
            } catch {
              showStatus("Not found.  Select it manually.");
            }
          }}>
            Auto-detect
          </button>
          <button className="btn btn-secondary" onClick={handleSelectPath} style={{ marginTop: '12px' }}>
            Select manually
          </button>
          {status && <p className="status">{status}</p>}
        </div>
      </div>
    );
  }

  if (screen === "adding") {
    return (
      <div className="app">
        <div className="adding-screen">
          <button className="btn-back" onClick={() => setScreen("home")}>
            ← Back
          </button>
          <h1 className="adding-title">Add account</h1>

          <div className="adding-steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <label className="step-label">Profile name</label>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. main, smurf, tryhard..."
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <p className="step-label">Open Riot Client</p>
                <p className="step-desc">
                  It will open with a clean session. Log in with your account
                  and check
                  <strong> "Stay signed in"</strong>.
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={handlePrepareAdd}
                  disabled={!newProfileName.trim()}
                >
                  Open Riot Client and click Play and open League of Legends
                  client
                </button>
              </div>
            </div>

            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <p className="step-label">Save profile</p>
                <p className="step-desc">
                  Close the League client (don't log out, just close the
                  window). Then close the Riot Client and make sure it's not
                  running in the system tray.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={handleFinishAdd}
                  disabled={!newProfileName.trim()}
                >
                  Save profile
                </button>
              </div>
            </div>
          </div>

          {status && <p className="status">{status}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <span className="logo">⚔️</span>
          <h1 className="app-title">LoL Switcher</h1>
        </div>
        <div className="header-right">
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleClose}
            title="Close Riot Client and League"
          >
            ✕ Close all
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-row">
            <span className="settings-label">Riot Client:</span>
            <span className="settings-value">
              {config?.riot_client_exe || "Not configured"}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={handleSelectPath}>
              Change
            </button>
          </div>
          <div className="settings-row">
            <span className="settings-label">Reference profile:</span>
            <span className="settings-value">
              {config?.reference_profile || "None"}
            </span>
          </div>
        </div>
      )}

      {/* Profiles Grid */}
      <div className="profiles-container">
        {profiles.length === 0 ? (
          <div className="empty-state">
            <p className="empty-text">No profiles yet</p>
            <p className="empty-hint">Add your first account to get started</p>
          </div>
        ) : (
          <div className="profiles-grid">
            {profiles.map((p) => (
              <div
                key={p.name}
                className={`profile-card ${launching === p.name ? "launching" : ""}`}
              >
                <div className="card-top">
                  <span className="profile-name">{p.name}</span>
                  <div className="card-actions">
                    {config?.reference_profile === p.name ? (
                      <span className="ref-badge" title="Reference profile">
                        ★
                      </span>
                    ) : (
                      <button
                        className="btn-icon"
                        onClick={() => handleSetReference(p.name)}
                        title="Use as reference"
                      >
                        ☆
                      </button>
                    )}
                    <button
                      className="btn-icon btn-icon-danger"
                      onClick={() => setShowDeleteConfirm(p.name)}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <button
                  className="btn-play"
                  onClick={() => handleLaunch(p.name)}
                  disabled={launching !== null}
                >
                  {launching === p.name ? "Launching..." : "▶  PLAY"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Button */}
      <div className="footer">
        <button className="btn btn-primary" onClick={handleStartAdd}>
          + Add account
        </button>
      </div>

      {/* Status Toast */}
      {status && <div className="toast">{status}</div>}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-text">
              Delete profile <strong>{showDeleteConfirm}</strong>?
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleDelete(showDeleteConfirm)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
