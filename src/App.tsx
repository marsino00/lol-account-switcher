import { useEffect, useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { api, ProfileInfo, AppConfig } from "./lib/api";
import { useI18n } from "./i18n";
import appIcon from "./assets/logo.png";
import "./App.css";

type Screen = "setup" | "home" | "adding";

function App() {
  const { lang, setLang, t } = useI18n();
  const [screen, setScreen] = useState<Screen>("home");
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [status, setStatus] = useState("");
  const [launching, setLaunching] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  );
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [autostart, setAutostart] = useState(false);

  const showStatus = useCallback((msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(""), 3000);
  }, []);

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
          showStatus(t.riotDetectedAt(detected));
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
      setStatus(t.error(e));
    }
    api.rebuildTray().catch(() => {});
    api
      .getAutostart()
      .then(setAutostart)
      .catch(() => {});
  }, [showStatus, t]);

  const handleToggleAutostart = async () => {
    try {
      const next = await api.setAutostart(!autostart);
      setAutostart(next);
    } catch (e) {
      showStatus(t.error(e));
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unlisteners = [
      listen<string>("tray:launched", (e) => {
        setActiveProfile(e.payload);
        showStatus(t.launched(e.payload));
      }),
      listen<void>("tray:closed-all", () => {
        setActiveProfile(null);
        showStatus(t.closed);
      }),
      listen<string>("tray:error", (e) => showStatus(t.error(e.payload))),
    ];
    return () => {
      unlisteners.forEach((p) => p.then((un) => un()));
    };
  }, [showStatus, t]);

  // --- Setup Screen ---
  const handleSelectPath = async () => {
    try {
      const selected = await open({
        directory: true,
        title: t.selectFolderTitle,
      });
      if (selected) {
        await api.setRiotPath(selected as string);
        showStatus(t.pathSaved);
        await loadData();
      }
    } catch (e) {
      showStatus(t.error(e));
    }
  };

  // --- Profile Actions ---
  const handleLaunch = async (name: string) => {
    setLaunching(name);
    try {
      await api.launchProfile(name);
      showStatus(t.launched(name));
      setActiveProfile(name);
    } catch (e) {
      showStatus(t.error(e));
    }
    setTimeout(() => setLaunching(null), 2000);
  };

  const handleClose = async () => {
    try {
      await api.closeRiot();
      showStatus(t.closed);
      setActiveProfile(null);
    } catch (e) {
      showStatus(t.error(e));
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await api.deleteProfile(name);
      showStatus(t.deleted(name));
      setShowDeleteConfirm(null);
      if (activeProfile === name) setActiveProfile(null);
      await loadData();
    } catch (e) {
      showStatus(t.error(e));
    }
  };

  const openRename = (name: string) => {
    setRenameTarget(name);
    setRenameInput(name);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const next = renameInput.trim();
    if (!next || next === renameTarget) {
      setRenameTarget(null);
      return;
    }
    try {
      await api.renameProfile(renameTarget, next);
      showStatus(t.renamed(renameTarget, next));
      if (activeProfile === renameTarget) setActiveProfile(next);
      setRenameTarget(null);
      await loadData();
    } catch (e) {
      showStatus(t.error(e));
    }
  };

  const handleSetReference = async (name: string) => {
    try {
      await api.setReferenceProfile(name);
      showStatus(t.referenceSet(name));
      await loadData();
    } catch (e) {
      showStatus(t.error(e));
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
      showStatus(t.riotOpened);
    } catch (e) {
      showStatus(t.error(e));
    }
  };

  const handleFinishAdd = async () => {
    if (!newProfileName.trim()) return;
    try {
      await api.saveProfile(newProfileName.trim());
      showStatus(t.profileSaved(newProfileName.trim()));
      setScreen("home");
      await loadData();
    } catch (e) {
      showStatus(t.error(e));
    }
  };

  // --- Renders ---
  if (screen === "setup") {
    return (
      <div className="app">
        <div className="setup-screen">
          <img
            src={appIcon}
            alt={t.appTitle}
            className="setup-icon"
          />
          <h1 className="setup-title">{t.appTitle}</h1>
          <p className="setup-subtitle">{t.setupSubtitle}</p>
          <p className="setup-hint">{t.setupHint}</p>
          <button
            className="btn btn-primary btn-lg"
            onClick={async () => {
              try {
                const detected = await api.autoDetectRiot();
                showStatus(t.detected(detected));
                await loadData();
              } catch {
                showStatus(t.notFound);
              }
            }}
          >
            {t.autoDetect}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleSelectPath}
            style={{ marginTop: "12px" }}
          >
            {t.selectManually}
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
            {t.back}
          </button>
          <h1 className="adding-title">{t.addAccountTitle}</h1>

          <div className="adding-steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <label className="step-label">{t.profileName}</label>
                <input
                  className="input"
                  type="text"
                  placeholder={t.profileNamePlaceholder}
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <p className="step-label">{t.openRiotClient}</p>
                <p className="step-desc">
                  {t.openRiotDesc1}
                  <strong>{t.staySignedIn}</strong>.
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={handlePrepareAdd}
                  disabled={!newProfileName.trim()}
                >
                  {t.openRiotBtn}
                </button>
              </div>
            </div>

            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <p className="step-label">{t.saveProfile}</p>
                <p className="step-desc">{t.saveProfileDesc}</p>
                <button
                  className="btn btn-primary"
                  onClick={handleFinishAdd}
                  disabled={!newProfileName.trim()}
                >
                  {t.saveProfile}
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
          <h1 className="app-title">{t.appTitle}</h1>
        </div>
        <div className="header-right">
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleClose}
            title={t.killAllTitle}
          >
            ✕ {t.killAll}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowSettings(!showSettings)}
            title={t.settingsTitle}
          >
            ⚙
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-row">
            <span className="settings-label">{t.riotClient}</span>
            <span className="settings-value">
              {config?.riot_client_exe || t.notConfigured}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={handleSelectPath}>
              {t.change}
            </button>
          </div>
          <div className="settings-row">
            <span className="settings-label">{t.referenceProfile}</span>
            <span className="settings-value">
              {config?.reference_profile || t.none}
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-label">{t.autostart}</span>
            <label className="switch" title={t.autostart}>
              <input
                type="checkbox"
                checked={autostart}
                onChange={handleToggleAutostart}
              />
              <span className="slider" />
            </label>
          </div>
          <div className="settings-row">
            <span className="settings-label">{t.language}</span>
            <div className="lang-toggle">
              <button
                className={`lang-btn ${lang === "es" ? "active" : ""}`}
                onClick={() => setLang("es")}
              >
                ES
              </button>
              <button
                className={`lang-btn ${lang === "en" ? "active" : ""}`}
                onClick={() => setLang("en")}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profiles Grid */}
      <div className="profiles-container">
        {profiles.length === 0 ? (
          <div className="empty-state">
            <p className="empty-text">{t.noProfiles}</p>
            <p className="empty-hint">{t.noProfilesHint}</p>
          </div>
        ) : (
          <div className="profiles-grid">
            {profiles.map((p) => {
              const isActive = activeProfile === p.name;
              return (
                <div
                  key={p.name}
                  className={`profile-card ${launching === p.name ? "launching" : ""} ${isActive ? "active" : ""}`}
                >
                  {isActive && (
                    <span className="active-badge">{t.inGame}</span>
                  )}
                  <div className="card-top">
                    <span className="profile-name">{p.name}</span>
                    <div className="card-actions">
                      {config?.reference_profile === p.name ? (
                        <span className="ref-badge" title={t.refBadgeTitle}>
                          ★
                        </span>
                      ) : (
                        <button
                          className="btn-icon"
                          onClick={() => handleSetReference(p.name)}
                          title={t.useAsReference}
                        >
                          ☆
                        </button>
                      )}
                      <button
                        className="btn-icon"
                        onClick={() => openRename(p.name)}
                        title={t.renameTitle}
                      >
                        ✎
                      </button>
                      <button
                        className="btn-icon btn-icon-danger"
                        onClick={() => setShowDeleteConfirm(p.name)}
                        title={t.deleteTitle}
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
                    {launching === p.name ? t.launching : t.play}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Button */}
      <div className="footer">
        <button className="btn btn-primary" onClick={handleStartAdd}>
          {t.addAccount}
        </button>
      </div>

      {/* Status Toast */}
      {status && <div className="toast">{status}</div>}

      {/* Rename Modal */}
      {renameTarget && (
        <div className="modal-overlay" onClick={() => setRenameTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-text">
              {t.renameProfileTitle} <strong>{renameTarget}</strong>
            </p>
            <input
              className="input"
              type="text"
              placeholder={t.newName}
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setRenameTarget(null);
              }}
              autoFocus
            />
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button
                className="btn btn-ghost"
                onClick={() => setRenameTarget(null)}
              >
                {t.cancel}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRename}
                disabled={
                  !renameInput.trim() || renameInput.trim() === renameTarget
                }
              >
                {t.rename}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-text">
              {t.deleteProfileQ} <strong>{showDeleteConfirm}</strong>?
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowDeleteConfirm(null)}
              >
                {t.cancel}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleDelete(showDeleteConfirm)}
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
