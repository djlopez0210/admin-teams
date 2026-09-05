
import React, { useState, useEffect } from 'react';
import { 
  Trophy, Users, Network, ChevronRight, ChevronLeft, Plus, Trash2, 
  Settings, Info, AlertCircle, CheckCircle2, Layout, Layers, Shuffle,
  HelpCircle, Eye
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { api } from '../services/api';

const TournamentWizard = ({ onComplete, tournamentId }) => {
  const { showNotification } = useNotification();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Tournament Configuration State
  const [config, setConfig] = useState({
    expected_teams: 16,
    group_count: 4,
    teams_per_group_passing: 2,
    advancement_mode: 'single_knockout', // 'single_knockout' or 'multi_cup'
    qualified_count: 8,
    cups: [
      { id: 'gold', name: 'Copa Oro' },
      { id: 'silver', name: 'Copa Plata' }
    ],
    qualification_type: 'group_positions', // 'group_positions' or 'global_ranking'
    rules: {
      group_positions: [
        { position: 1, target: 'gold' },
        { position: 2, target: 'gold' },
        { position: 3, target: 'silver' },
        { position: 4, target: 'silver' }
      ],
      global_ranking: [
        { from: 1, to: 16, target: 'gold' },
        { from: 17, to: 32, target: 'silver' }
      ]
    },
    knockout_config: {
      gold: {
        seeding_type: 'group_based',
        match_format: 'single',
        seeding_options: {
          avoid_same_group: true,
          avoid_same_group_rounds: 1,
          reseed_each_round: false
        }
      },
      silver: {
        seeding_type: 'global_ranking',
        match_format: 'single',
        seeding_options: {
          avoid_same_group: false,
          avoid_same_group_rounds: 0,
          reseed_each_round: false
        }
      }
    },
    auto_start: true
  });

  // Sync qualifiers when teams/groups change
  useEffect(() => {
    const maxAllowed = Math.floor(config.expected_teams / (config.group_count || 1)) || 1;
    if (config.teams_per_group_passing > maxAllowed) {
      setConfig(prev => ({
        ...prev,
        teams_per_group_passing: maxAllowed,
        qualified_count: maxAllowed * (prev.group_count || 1)
      }));
    }
  }, [config.expected_teams, config.group_count]);

  const nextStep = () => setCurrentStep(prev => prev + 1);
  const prevStep = () => setCurrentStep(prev => prev - 1);

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.post(`/tournaments/${tournamentId}/wizard-config`, config);
      showNotification('Configuración guardada exitosamente', 'success');
      if (onComplete) onComplete();
    } catch (err) {
      showNotification('Error al guardar la configuración', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addCup = () => {
    const newId = `cup_${Date.now()}`;
    setConfig(prev => ({
      ...prev,
      cups: [...prev.cups, { id: newId, name: 'Nueva Copa' }]
    }));
  };

  const removeCup = (id) => {
    setConfig(prev => ({
      ...prev,
      cups: prev.cups.filter(c => c.id !== id)
    }));
  };

  const updateCupName = (id, name) => {
    setConfig(prev => ({
      ...prev,
      cups: prev.cups.map(c => c.id === id ? { ...c, name } : c)
    }));
  };

  const renderStepIndicators = () => (
    <div className="wizard-steps">
      {[1, 2, 3, 4, 5].map(step => (
        <div 
          key={step} 
          className={`step-item ${currentStep === step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}
        >
          <div className="step-number">{currentStep > step ? <CheckCircle2 size={16} /> : step}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="wizard-container glass animate-fade-in">
      <style>{`
        .wizard-container {
          padding: 2rem;
          max-width: 900px;
          margin: 0 auto;
          border-radius: 1.5rem;
          min-height: 600px;
          display: flex;
          flex-direction: column;
        }
        .wizard-steps {
          display: flex;
          justify-content: center;
          gap: 2rem;
          margin-bottom: 3rem;
        }
        .step-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          opacity: 0.4;
          transition: all 0.3s;
        }
        .step-item.active { opacity: 1; transform: scale(1.1); }
        .step-item.completed { opacity: 0.8; color: var(--success); }
        .step-number {
          width: 35px;
          height: 35px;
          border-radius: 50%;
          border: 2px solid currentColor;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }
        .wizard-content {
          flex: 1;
        }
        .wizard-footer {
          margin-top: 3rem;
          display: flex;
          justify-content: space-between;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        .option-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 1.5rem;
          border-radius: 1rem;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .option-card:hover { background: rgba(56, 189, 248, 0.05); border-color: var(--primary); }
        .option-card.active { background: rgba(56, 189, 248, 0.1); border-color: var(--primary); box-shadow: 0 0 20px rgba(56, 189, 248, 0.2); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        .cup-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: rgba(255,255,255,0.03);
          padding: 0.8rem;
          border-radius: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .badge-eliminated { background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; }
      `}</style>

      {renderStepIndicators()}

      <div className="wizard-content">
        {currentStep === 1 && (
          <div className="step-animate-in">
            <h2 className="mb-1"><Users /> Dimensión del Torneo</h2>
            <p className="text-muted mb-2">Define cuántos equipos participarán en total.</p>
            
            <div className="grid-2 mb-4">
              <div className="form-group">
                <label className="label">Cantidad de equipos esperados</label>
                <input 
                  type="number" 
                  className="input" 
                  value={config.expected_teams} 
                  onChange={e => setConfig({...config, expected_teams: parseInt(e.target.value)})} 
                  placeholder="Ej: 16"
                />
              </div>
              <div className="form-group">
                <label className="label">Número de Grupos</label>
                <input 
                  type="number" 
                  className="input" 
                  value={config.group_count} 
                  onChange={e => setConfig({...config, group_count: parseInt(e.target.value)})} 
                  placeholder="Ej: 4"
                />
                {config.expected_teams && config.group_count && (
                  <p className="help-text small opacity-50 mt-0-5">
                    ~{Math.ceil(config.expected_teams / config.group_count)} equipos por grupo
                  </p>
                )}
              </div>
            </div>

            <div className="form-group mb-5 bg-white-03 p-1-5 rounded border-l-primary">
              <label className="label flex items-center gap-1">
                <CheckCircle2 size={16} color="var(--primary)" />
                ¿Cuántos clasifican por cada grupo?
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input 
                  type="range" 
                  min="1" 
                  max={Math.floor(config.expected_teams / (config.group_count || 1)) || 1} 
                  className="w-100"
                  value={Math.min(config.teams_per_group_passing, Math.floor(config.expected_teams / (config.group_count || 1)) || 1)} 
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setConfig({
                      ...config, 
                      teams_per_group_passing: val,
                      qualified_count: val * (config.group_count || 1)
                    });
                  }}
                />
                <span className="font-bold text-lg" style={{ minWidth: '40px', textAlign: 'center' }}>
                  {Math.min(config.teams_per_group_passing, Math.floor(config.expected_teams / (config.group_count || 1)) || 1)}
                </span>
              </div>
              <p className="small text-muted mt-0-5">
                Total clasificados a la siguiente fase: <strong>{Math.min(config.teams_per_group_passing, Math.floor(config.expected_teams / (config.group_count || 1)) || 1) * (config.group_count || 0)}</strong> equipos.
              </p>
            </div>

            <h2 className="mb-1"><Layers /> Modo de Avance</h2>
            <p className="text-muted mb-3">Selecciona cómo clasificarán los equipos a la fase final.</p>
            
            <div className="grid-2">
              <div 
                className={`option-card ${config.advancement_mode === 'single_knockout' ? 'active' : ''}`}
                onClick={() => setConfig({...config, advancement_mode: 'single_knockout'})}
              >
                <Layout size={24} color="var(--primary)" />
                <h3>Eliminación Directa Única</h3>
                <p className="small text-muted">Todos los equipos clasificados van a una misma llave final.</p>
              </div>
              <div 
                className={`option-card ${config.advancement_mode === 'multi_cup' ? 'active' : ''}`}
                onClick={() => setConfig({...config, advancement_mode: 'multi_cup'})}
              >
                <Trophy size={24} color="#fbbf24" />
                <h3>Múltiples Copas</h3>
                <p className="small text-muted">Los equipos se dividen en diferentes copas (Oro, Plata, Bronce).</p>
              </div>
            </div>

            {config.advancement_mode === 'single_knockout' && (
              <div className="form-group mt-3 animate-fade-in">
                <label className="label">¿Cuántos equipos clasifican?</label>
                <input 
                  type="number" 
                  className="input" 
                  value={config.qualified_count} 
                  onChange={e => setConfig({...config, qualified_count: parseInt(e.target.value)})} 
                />
                <p className="help-text">Ej: 8 para comenzar desde Cuartos de Final.</p>
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="step-animate-in">
            <h2 className="mb-1"><Trophy /> Definición de Copas</h2>
            <p className="text-muted mb-3">Define los nombres de las copas dinámicas.</p>
            
            <div className="glass-deep p-2 mb-2">
              {config.cups.map(cup => (
                <div key={cup.id} className="cup-item animate-slide-right">
                  <div style={{ width: '30px', height: '30px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trophy size={14} />
                  </div>
                  <input 
                    type="text" 
                    className="input-flush" 
                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', outline: 'none' }}
                    value={cup.name} 
                    onChange={e => updateCupName(cup.id, e.target.value)}
                  />
                  <button className="btn-icon text-error" onClick={() => removeCup(cup.id)}><Trash2 size={16} /></button>
                </div>
              ))}
              <button className="btn btn-secondary mt-1" onClick={addCup} style={{ width: '100%' }}>
                <Plus size={16} /> Añadir Copa
              </button>
            </div>
            
            <div className="mt-4">
              <h3 className="mb-1"><HelpCircle size={18} /> Tipo de Clasificación</h3>
              <div className="grid-2 mt-2">
                <div 
                  className={`option-card ${config.qualification_type === 'group_positions' ? 'active' : ''}`}
                  onClick={() => setConfig({...config, qualification_type: 'group_positions'})}
                >
                  <Users size={20} />
                  <span>Por Posiciones en Grupos</span>
                </div>
                <div 
                  className={`option-card ${config.qualification_type === 'global_ranking' ? 'active' : ''}`}
                  onClick={() => setConfig({...config, qualification_type: 'global_ranking'})}
                >
                  <Shuffle size={20} />
                  <span>Por Ranking Global</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="step-animate-in">
            <h2 className="mb-1"><Settings /> Reglas de Clasificación</h2>
            <p className="text-muted mb-3">Define qué equipos van a qué copa.</p>
            
            {config.qualification_type === 'group_positions' ? (
              <div className="table-responsive glass">
                <table className="w-100">
                  <thead>
                    <tr>
                      <th>Posición en Grupo</th>
                      <th>Destino</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Limit positions shown to teams per group */}
                    {Array.from({ length: Math.ceil(config.expected_teams / (config.group_count || 1)) }).map((_, i) => {
                      const pos = i + 1;
                      return (
                        <tr key={pos}>
                          <td>{pos}° Lugar</td>
                          <td>
                            <select 
                              className="select"
                              value={config.rules.group_positions.find(r => r.position === pos)?.target || 'eliminated'}
                              onChange={e => {
                                const newRules = [...config.rules.group_positions].filter(r => r.position !== pos);
                                if (e.target.value !== 'eliminated') {
                                  newRules.push({ position: pos, target: e.target.value });
                                }
                                setConfig({...config, rules: {...config.rules, group_positions: newRules}});
                              }}
                            >
                              <option value="eliminated">❌ Eliminado</option>
                              {config.cups.map(cup => <option key={cup.id} value={cup.id}>{cup.name}</option>)}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="table-responsive glass">
                <table className="w-100">
                  <thead>
                    <tr>
                      <th>Desde (Puesto)</th>
                      <th>Hasta (Puesto)</th>
                      <th>Destino</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.rules.global_ranking.map((rule, idx) => (
                      <tr key={idx}>
                        <td><input type="number" className="input-sm" value={rule.from} onChange={e => {
                          const newRules = [...config.rules.global_ranking];
                          newRules[idx] = {...newRules[idx], from: parseInt(e.target.value)};
                          setConfig({...config, rules: {...config.rules, global_ranking: newRules}});
                        }} /></td>
                        <td><input type="number" className="input-sm" value={rule.to} onChange={e => {
                          const newRules = [...config.rules.global_ranking];
                          newRules[idx] = {...newRules[idx], to: parseInt(e.target.value)};
                          setConfig({...config, rules: {...config.rules, global_ranking: newRules}});
                        }} /></td>
                        <td>
                          <select 
                            className="select"
                            value={rule.target}
                            onChange={e => {
                              const newRules = [...config.rules.global_ranking];
                              newRules[idx] = {...newRules[idx], target: e.target.value};
                              setConfig({...config, rules: {...config.rules, global_ranking: newRules}});
                            }}
                          >
                            {config.cups.map(cup => <option key={cup.id} value={cup.id}>{cup.name}</option>)}
                          </select>
                        </td>
                        <td>
                          <button className="btn-icon text-error" onClick={() => {
                             const newRules = config.rules.global_ranking.filter((_, i) => i !== idx);
                             setConfig({...config, rules: {...config.rules, global_ranking: newRules}});
                          }}><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {config.rules.global_ranking.reduce((acc, r) => acc + (r.to - r.from + 1), 0) < config.expected_teams && (
                   <button className="btn btn-secondary mt-1 ml-2" onClick={() => {
                    const last = config.rules.global_ranking[config.rules.global_ranking.length - 1];
                    const nextFrom = last ? last.to + 1 : 1;
                    const nextTo = Math.min(nextFrom + 7, config.expected_teams);
                    setConfig({...config, rules: {...config.rules, global_ranking: [...config.rules.global_ranking, { from: nextFrom, to: nextTo, target: config.cups[0]?.id }]}});
                  }}><Plus size={14} /> Añadir Rango</button>
                )}
              </div>
            )}
            
            <div className={`mt-3 p-1 rounded flex items-center gap-2 ${
                config.rules.global_ranking.reduce((acc, r) => acc + (r.to - r.from + 1), 0) !== config.expected_teams && config.qualification_type === 'global_ranking'
                ? 'bg-warning-10 text-warning border-warning'
                : 'alert-info'
            }`}>
              <Info size={16} />
              <p className="small">
                {config.qualification_type === 'global_ranking' 
                  ? `Has cubierto ${config.rules.global_ranking.reduce((acc, r) => acc + (r.to - r.from + 1), 0)} de ${config.expected_teams} equipos.`
                  : `Reglas aplicadas a las posiciones de los ${config.group_count} grupos.`}
              </p>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="step-animate-in">
            <h2 className="mb-1"><Shuffle /> Configuración de Knockout</h2>
            <p className="text-muted mb-3">Configura el emparejamiento para cada copa.</p>
            
            <div className="grid gap-2">
              {config.cups.map(cup => (
                <div key={cup.id} className="glass p-1-5 border-l-primary">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="flex items-center gap-2"><Trophy size={18} color="#fbbf24" /> {cup.name}</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="form-group">
                      <label className="label">Método de Emparejamiento</label>
                      <select 
                        className="select"
                        value={config.knockout_config[cup.id]?.seeding_type || 'global_ranking'}
                        onChange={e => setConfig({
                          ...config, 
                          knockout_config: {
                            ...config.knockout_config, 
                            [cup.id]: {...config.knockout_config[cup.id], seeding_type: e.target.value}
                          }
                        })}
                      >
                        <option value="group_based">Basado en Grupos (A1 vs B2)</option>
                        <option value="global_ranking">Ranking Global (1 vs N)</option>
                        <option value="manual">Sorteo Manual</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="label">Formato de Partido</label>
                      <select 
                        className="select"
                        value={config.knockout_config[cup.id]?.match_format || 'single'}
                        onChange={e => setConfig({
                          ...config, 
                          knockout_config: {
                            ...config.knockout_config, 
                            [cup.id]: {...config.knockout_config[cup.id], match_format: e.target.value}
                          }
                        })}
                      >
                        <option value="single">Partido Único</option>
                        <option value="home_away">Ida y Vuelta</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-1 bg-white-05 p-1 rounded">
                    <label className="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={config.knockout_config[cup.id]?.seeding_options?.avoid_same_group} 
                        onChange={e => setConfig({
                          ...config, 
                          knockout_config: {
                            ...config.knockout_config, 
                            [cup.id]: {
                              ...config.knockout_config[cup.id], 
                              seeding_options: {
                                ...config.knockout_config[cup.id].seeding_options,
                                avoid_same_group: e.target.checked
                              }
                            }
                          }
                        })}
                      />
                      <span>Evitar cruces del mismo grupo</span>
                    </label>
                    
                    {config.knockout_config[cup.id]?.seeding_type === 'global_ranking' && config.knockout_config[cup.id]?.seeding_options?.avoid_same_group && (
                      <div className="text-warning small flex items-center gap-1">
                        <AlertCircle size={14} />
                        <span>El ranking global tiene prioridad. El cruce 1 vs N podría ignorar esta regla.</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="step-animate-in">
            <h2 className="mb-1"><Eye /> Vista Previa Global</h2>
            <p className="text-muted mb-3">Así se verá el flujo de tu torneo.</p>
            
            <div className="tournament-flow-preview mt-4">
              <div className="flex justify-center items-center gap-4">
                <div className="flow-node phase-groups">
                  <Users size={20} />
                  <span>Fase de Grupos</span>
                </div>
                
                <ChevronRight className="opacity-30" />
                
                <div className="flex flex-col gap-2">
                  {config.advancement_mode === 'single_knockout' ? (
                    <div className="flow-node phase-knockout bg-primary-10">
                      <Trophy size={18} />
                      <span>Fase Final ({config.qualified_count} eq.)</span>
                    </div>
                  ) : (
                    config.cups.map(cup => (
                      <div key={cup.id} className="flow-node phase-cup border-l-primary bg-white-03">
                        <Trophy size={18} color="#fbbf24" />
                        <span>{cup.name}</span>
                        <span className="small opacity-50 ml-2">➜ Final</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 p-2 bg-success-10 rounded border-success flex items-start gap-3">
              <CheckCircle2 color="var(--success)" />
              <div>
                <h4>¡Todo listo!</h4>
                <p className="small text-muted">A continuación se generará la base de datos estructural para estas fases.</p>
                
                <div className="mt-2 p-1 bg-white-05 rounded">
                    <label className="checkbox-label" style={{ cursor: 'pointer' }}>
                        <input 
                            type="checkbox" 
                            checked={config.auto_start} 
                            onChange={e => setConfig({...config, auto_start: e.target.checked})} 
                        />
                        <span className="font-bold">Realizar sorteo y generar partidos automáticamente</span>
                    </label>
                    <p className="text-xs opacity-50 ml-2">Esto distribuirá a los equipos en los grupos y creará el fixture de inmediato.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="wizard-footer">
        <button 
          className="btn btn-secondary" 
          onClick={prevStep} 
          disabled={currentStep === 1 || loading}
        >
          <ChevronLeft size={18} /> Atrás
        </button>
        
        {currentStep < 5 ? (
          <button 
            className="btn btn-primary" 
            onClick={nextStep}
            disabled={config.advancement_mode === 'multi_cup' && config.cups.length === 0}
          >
            Siguiente <ChevronRight size={18} />
          </button>
        ) : (
          <button 
            className="btn btn-gold px-4" 
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Procesando...' : 'Finalizar y Generar Torneo'}
          </button>
        )}
      </div>
    </div>
  );
};

export default TournamentWizard;
