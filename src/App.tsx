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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [cfg, profs] = await Promise.all([
        api.getConfig(),
        api.listProfiles(),
      ]);
      setConfig(cfg);
      setProfiles(profs);
      if (!cfg.riot_client_exe) {
        setScreen("setup");
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
      const selected = await open({ directory: true, title: "Selecciona la carpeta del Riot Client" });
      if (selected) {
        await api.setRiotPath(selected as string);
        showStatus("Ruta guardada");
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
      showStatus(`Lanzado: ${name}`);
    } catch (e) {
      showStatus(`Error: ${e}`);
    }
    setTimeout(() => setLaunching(null), 2000);
  };

  const handleClose = async () => {
    try {
      await api.closeRiot();
      showStatus("Cerrado");
    } catch (e) {
      showStatus(`Error: ${e}`);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await api.deleteProfile(name);
      showStatus(`Eliminado: ${name}`);
      setShowDeleteConfirm(null);
      await loadData();
    } catch (e) {
      showStatus(`Error: ${e}`);
    }
  };

  const handleSetReference = async (name: string) => {
    try {
      await api.setReferenceProfile(name);
      showStatus(`Perfil de referencia: ${name}`);
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
      showStatus("Riot Client abierto. Haz login con 'Stay signed in'.");
    } catch (e) {
      showStatus(`Error: ${e}`);
    }
  };

  const handleFinishAdd = async () => {
    if (!newProfileName.trim()) return;
    try {
      await api.saveProfile(newProfileName.trim());
      showStatus(`Perfil '${newProfileName.trim()}' guardado`);
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
            Selecciona la carpeta del Riot Client para empezar
          </p>
          <p className="setup-hint">Normalmente en C:\Riot Games\Riot Client</p>
          <button className="btn btn-primary btn-lg" onClick={handleSelectPath}>
            Seleccionar carpeta
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
            ← Volver
          </button>
          <h1 className="adding-title">Añadir cuenta</h1>

          <div className="adding-steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <label className="step-label">Nombre del perfil</label>
                <input
                  className="input"
                  type="text"
                  placeholder="ej: main, smurf, tryhard..."
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <p className="step-label">Abrir Riot Client</p>
                <p className="step-desc">
                  Se abrirá con sesión limpia. Haz login con la cuenta y marca
                  <strong> "Stay signed in"</strong>.
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={handlePrepareAdd}
                  disabled={!newProfileName.trim()}
                >
                  Abrir Riot Client
                </button>
              </div>
            </div>

            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <p className="step-label">Guardar perfil</p>
                <p className="step-desc">
                  Cuando hayas entrado al cliente de League, ciérralo todo con la
                  X y pulsa guardar.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={handleFinishAdd}
                  disabled={!newProfileName.trim()}
                >
                  Guardar perfil
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
            title="Cerrar Riot Client y League"
          >
            ✕ Cerrar todo
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowSettings(!showSettings)}
            title="Ajustes"
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
              {config?.riot_client_exe || "No configurado"}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={handleSelectPath}>
              Cambiar
            </button>
          </div>
          <div className="settings-row">
            <span className="settings-label">Perfil referencia:</span>
            <span className="settings-value">
              {config?.reference_profile || "Ninguno"}
            </span>
          </div>
        </div>
      )}

      {/* Profiles Grid */}
      <div className="profiles-container">
        {profiles.length === 0 ? (
          <div className="empty-state">
            <p className="empty-text">No hay perfiles todavía</p>
            <p className="empty-hint">Añade tu primera cuenta para empezar</p>
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
                      <span className="ref-badge" title="Perfil de referencia">
                        ★
                      </span>
                    ) : (
                      <button
                        className="btn-icon"
                        onClick={() => handleSetReference(p.name)}
                        title="Usar como referencia"
                      >
                        ☆
                      </button>
                    )}
                    <button
                      className="btn-icon btn-icon-danger"
                      onClick={() => setShowDeleteConfirm(p.name)}
                      title="Eliminar"
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
                  {launching === p.name ? "Lanzando..." : "▶  PLAY"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Button */}
      <div className="footer">
        <button className="btn btn-primary" onClick={handleStartAdd}>
          + Añadir cuenta
        </button>
      </div>

      {/* Status Toast */}
      {status && <div className="toast">{status}</div>}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-text">
              ¿Eliminar el perfil <strong>{showDeleteConfirm}</strong>?
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleDelete(showDeleteConfirm)}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
