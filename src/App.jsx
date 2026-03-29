import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Trash2, Calculator, Info, Settings, 
  Droplets, Beaker, Calendar, 
  Tag, StickyNote, ClipboardList, Printer,
  Percent, FlaskConical, AlertTriangle,
  Save, History, BookOpen, Download
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
let app, auth, db;
if (firebaseConfig) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Base de datos completa solicitada
const OIL_DATABASE = [
  { id: 'tallow', name: 'Sebo de Res', inci: 'Sodium Tallowate', sap: 0.141, hardness: 51, cleansing: 8, bubbly: 8, creamy: 43, conditioning: 41 },
  { id: 'lard', name: 'Manteca de Cerdo', inci: 'Sodium Lardate', sap: 0.138, hardness: 42, cleansing: 1, bubbly: 1, creamy: 41, conditioning: 57 },
  { id: 'olive', name: 'Aceite de Oliva', inci: 'Sodium Olivate', sap: 0.134, hardness: 14, cleansing: 0, bubbly: 0, creamy: 14, conditioning: 82 },
  { id: 'coconut', name: 'Aceite de Coco', inci: 'Sodium Cocoate', sap: 0.190, hardness: 85, cleansing: 67, bubbly: 67, creamy: 18, conditioning: 10 },
  { id: 'castor', name: 'Aceite de Ricino', inci: 'Sodium Castorate', sap: 0.128, hardness: 0, cleansing: 0, bubbly: 90, creamy: 90, conditioning: 98 },
  { id: 'avocado', name: 'Aceite de Aguacate', inci: 'Sodium Avocadate', sap: 0.133, hardness: 20, cleansing: 0, bubbly: 0, creamy: 20, conditioning: 80 },
  { id: 'grapeseed', name: 'Aceite de Semilla de Uva', inci: 'Sodium Grapeseedate', sap: 0.133, hardness: 11, cleansing: 0, bubbly: 0, creamy: 11, conditioning: 89 },
  { id: 'shea', name: 'Manteca de Karité', inci: 'Sodium Shea Butterate', sap: 0.128, hardness: 45, cleansing: 0, bubbly: 0, creamy: 45, conditioning: 54 },
  { id: 'canola', name: 'Aceite de Colza (Canola)', inci: 'Sodium Canolate', sap: 0.133, hardness: 6, cleansing: 0, bubbly: 0, creamy: 6, conditioning: 94 },
  { id: 'palm', name: 'Aceite de Palma', inci: 'Sodium Palmate', sap: 0.144, hardness: 50, cleansing: 1, bubbly: 1, creamy: 49, conditioning: 49 },
  { id: 'soybean', name: 'Aceite de Soja', inci: 'Sodium Soyate', sap: 0.135, hardness: 14, cleansing: 0, bubbly: 0, creamy: 14, conditioning: 86 },
  { id: 'almond', name: 'Aceite de Almendras Dulces', inci: 'Sodium Almondate', sap: 0.136, hardness: 7, cleansing: 0, bubbly: 0, creamy: 7, conditioning: 89 }
];

const ProgressBar = ({ label, value, min = 40, max = 60 }) => {
  const isOptimal = value >= min && value <= max;
  const percentage = Math.min(Math.max(value, 0), 100);
  
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1 items-center">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className={`text-sm font-bold ${isOptimal ? 'text-green-600' : 'text-amber-600'}`}>
          {Math.round(value)}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 relative">
        <div className="absolute h-4 w-0.5 bg-gray-400 dark:bg-gray-500 top-1/2 -translate-y-1/2" style={{ left: `${min}%` }} />
        <div className="absolute h-4 w-0.5 bg-gray-400 dark:bg-gray-500 top-1/2 -translate-y-1/2" style={{ left: `${max}%` }} />
        <div className={`h-2 rounded-full transition-all duration-500 ${isOptimal ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};

export default function App() {
  const [recipe, setRecipe] = useState([]);
  const [additives, setAdditives] = useState([]);
  const [superfat, setSuperfat] = useState(8);
  const [concentration, setConcentration] = useState(30);
  const [prices, setPrices] = useState({});
  const [metadata, setMetadata] = useState({
    batch: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    recipeName: '',
    author: ''
  });

  // Estados para Base de Datos
  const [user, setUser] = useState(null);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [showRecipesModal, setShowRecipesModal] = useState(false);
  const [showPricesModal, setShowPricesModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // 1. Inicializar Autenticación
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Error de Auth:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Cargar Datos desde la Base de Datos
  useEffect(() => {
    if (!user || !db) return;

    // Obtener Recetas
    const recipesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'recipes');
    const unsubRecipes = onSnapshot(recipesRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date)); // Orden descendente
      setSavedRecipes(data);
    }, err => console.error("Error recetas:", err));

    // Obtener Historial de Precios
    const pricesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'prices');
    const unsubPrices = onSnapshot(pricesRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date)); // Orden descendente
      setPriceHistory(data);
    }, err => console.error("Error precios:", err));

    return () => {
      unsubRecipes();
      unsubPrices();
    };
  }, [user]);

  const showMessage = (msg) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleGeneratePDF = async () => {
    showMessage("⏳ Preparando reporte formal...");
    setIsGeneratingPDF(true);

    setTimeout(() => {
      const element = document.getElementById('formal-report');
      
      const createPDF = () => {
        const opt = {
          margin:       0.5,
          filename:     `Sapolab_${metadata.recipeName || metadata.batch || 'Reporte'}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true },
          jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        window.html2pdf().set(opt).from(element).save().then(() => {
          setIsGeneratingPDF(false);
          showMessage("✅ PDF descargado con éxito.");
        }).catch(err => {
          console.error(err);
          setIsGeneratingPDF(false);
          showMessage("❌ Error al generar el PDF.");
        });
      };

      if (!window.html2pdf) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = createPDF;
        document.body.appendChild(script);
      } else {
        createPDF();
      }
    }, 800); // Dar tiempo a React para ocultar los botones de la interfaz
  };

  // Funciones de Base de Datos
  const handleSaveRecipe = async () => {
    if (!user || !db) return showMessage("⚠️ Conectando a la base de datos...");
    if (!metadata.recipeName || !metadata.author) {
      return showMessage("⚠️ Por favor ingresa el Nombre de la Receta y Autor.");
    }
    try {
      const recipesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'recipes');
      await addDoc(recipesRef, {
        name: metadata.recipeName,
        author: metadata.author,
        date: new Date().toISOString(),
        data: { recipe, additives, superfat, concentration, metadata, prices }
      });
      showMessage("✅ Receta guardada exitosamente.");
    } catch (error) {
      console.error(error);
      showMessage("❌ Error al guardar receta.");
    }
  };

  const deleteRecipe = async (id) => {
    if (!user || !db) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'recipes', id));
      showMessage("🗑️ Receta eliminada.");
    } catch (error) { console.error(error); }
  };

  const loadRecipe = (savedData) => {
    setRecipe(savedData.data.recipe || []);
    setAdditives(savedData.data.additives || []);
    setSuperfat(savedData.data.superfat || 8);
    setConcentration(savedData.data.concentration || 30);
    setPrices(savedData.data.prices || {});
    setMetadata(savedData.data.metadata || { 
      batch: '', date: new Date().toISOString().split('T')[0], notes: '', 
      recipeName: savedData.name, author: savedData.author 
    });
    setShowRecipesModal(false);
    showMessage(`✅ Receta "${savedData.name}" cargada.`);
  };

  const handleSavePrices = async () => {
    if (!user || !db) return showMessage("⚠️ Conectando a la base de datos...");
    if (Object.keys(prices).length === 0) return showMessage("⚠️ No hay precios para guardar.");
    try {
      const pricesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'prices');
      await addDoc(pricesRef, {
        date: new Date().toISOString(),
        prices: prices
      });
      showMessage("✅ Historial de precios guardado.");
    } catch (error) {
      console.error(error);
      showMessage("❌ Error al guardar precios.");
    }
  };

  const loadPriceHistory = (savedPrices) => {
    setPrices(savedPrices);
    setShowPricesModal(false);
    showMessage("✅ Precios restaurados en la tabla.");
  };

  const addOil = (oil) => {
    if (recipe.find(item => item.id === oil.id)) return;
    setRecipe([...recipe, { ...oil, grams: 0 }]);
  };

  const addAdditive = (isCitric = false) => {
    const id = Date.now().toString();
    const newAdd = isCitric 
      ? { id, name: 'Ácido Cítrico', grams: 0, inci: 'Citric Acid', type: 'citric' }
      : { id, name: '', grams: 0, inci: '', type: 'standard' };
    setAdditives([...additives, newAdd]);
  };

  const totals = useMemo(() => {
    let totalGramsOils = 0;
    let baseSapNaOH = 0;
    let totalCost = 0;
    let h = 0, cl = 0, b = 0, cr = 0, co = 0;
    let citricGrams = 0;

    recipe.forEach(oil => {
      const g = parseFloat(oil.grams) || 0;
      totalGramsOils += g;
      baseSapNaOH += g * oil.sap;
      totalCost += (g / 1000) * (parseFloat(prices[oil.id]) || 0);
      h += (oil.hardness * g);
      cl += (oil.cleansing * g);
      b += (oil.bubbly * g);
      cr += (oil.creamy * g);
      co += (oil.conditioning * g);
    });

    additives.forEach(add => {
      const g = parseFloat(add.grams) || 0;
      totalCost += (g / 1000) * (parseFloat(prices[add.id]) || 0);
      if (add.type === 'citric' || add.name.toLowerCase().includes('cítrico') || add.name.toLowerCase().includes('citrico')) {
        citricGrams += g;
      }
    });

    // Cálculos de Lejía
    const sf = parseFloat(superfat) || 0;
    const conc = parseFloat(concentration) || 1;
    
    // Sosa necesaria para aceites con sobreengrasado
    const naohForOils = baseSapNaOH * (1 - sf / 100);
    // Sosa adicional para neutralizar ácido cítrico (1g de AC necesita 0.6g de NaOH)
    const naohForCitric = citricGrams * 0.6;
    const totalNaOH = naohForOils + naohForCitric;
    
    const water = totalGramsOils > 0 ? (totalNaOH / (conc / 100)) - totalNaOH : 0;
    totalCost += (totalNaOH / 1000) * (parseFloat(prices['naoh']) || 0);

    // Generar INCI
    const sortedOils = [...recipe].sort((a, b) => (parseFloat(b.grams) || 0) - (parseFloat(a.grams) || 0));
    const inciList = [
      ...sortedOils.map(o => o.inci),
      'Aqua',
      'Sodium Hydroxide',
      ...additives.filter(a => a.inci).map(a => a.inci)
    ].filter(Boolean).join(', ');

    return {
      totalGramsOils, naoh: totalNaOH, water, totalCost, inciList, citricGrams, naohForCitric,
      predictions: {
        hardness: totalGramsOils > 0 ? h / totalGramsOils : 0,
        cleansing: totalGramsOils > 0 ? cl / totalGramsOils : 0,
        bubbly: totalGramsOils > 0 ? b / totalGramsOils : 0,
        creamy: totalGramsOils > 0 ? cr / totalGramsOils : 0,
        conditioning: totalGramsOils > 0 ? co / totalGramsOils : 0
      }
    };
  }, [recipe, additives, superfat, concentration, prices]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900 print:bg-white print:p-0">
      
      {/* Alertas Flotantes */}
      {statusMessage && (
        <div className="fixed top-4 right-4 z-[60] bg-slate-800 text-white px-6 py-3 rounded-xl shadow-2xl font-bold animate-fade-in-down print:hidden">
          {statusMessage}
        </div>
      )}

      {/* Modal de Recetas */}
      {showRecipesModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
              <h3 className="text-xl font-black flex items-center gap-2"><BookOpen /> Mis Recetas Guardadas</h3>
              <button onClick={() => setShowRecipesModal(false)} className="hover:bg-indigo-500 p-2 rounded-full transition-colors text-xl font-bold">✕</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {savedRecipes.length === 0 ? (
                <p className="text-slate-500 text-center py-8 font-medium">No tienes recetas guardadas aún.</p>
              ) : (
                <div className="space-y-3">
                  {savedRecipes.map(r => (
                    <div key={r.id} className="border border-slate-200 rounded-xl p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                      <div>
                        <h4 className="font-black text-slate-800 text-lg">{r.name}</h4>
                        <p className="text-xs text-slate-500 font-medium">Por: {r.author} • {new Date(r.date).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => loadRecipe(r)} className="px-4 py-2 bg-indigo-100 text-indigo-700 font-bold rounded-lg hover:bg-indigo-200 transition-colors">Cargar</button>
                        <button onClick={() => deleteRecipe(r.id)} className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 transition-colors"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Historial de Precios */}
      {showPricesModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
              <h3 className="text-xl font-black flex items-center gap-2"><History /> Historial de Costos</h3>
              <button onClick={() => setShowPricesModal(false)} className="hover:bg-emerald-500 p-2 rounded-full transition-colors text-xl font-bold">✕</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {priceHistory.length === 0 ? (
                <p className="text-slate-500 text-center py-8 font-medium">No hay historial de precios guardado.</p>
              ) : (
                <div className="space-y-3">
                  {priceHistory.map(h => (
                    <div key={h.id} className="border border-slate-200 rounded-xl p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                      <div>
                        <h4 className="font-black text-slate-800">Corte del {new Date(h.date).toLocaleDateString()}</h4>
                        <p className="text-xs text-slate-500 font-medium">{Object.keys(h.prices).length} ingredientes registrados</p>
                      </div>
                      <button onClick={() => loadPriceHistory(h.prices)} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 font-bold rounded-lg hover:bg-emerald-200 transition-colors">Restaurar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
        INTERFAZ PRINCIPAL O REPORTE PDF
        =========================================================
      */}
      {!isGeneratingPDF ? (
        <div id="app-content" className="max-w-6xl mx-auto pb-8 bg-slate-50 animate-fade-in">
          <header className="mb-6 flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-b print:rounded-none">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-3 rounded-xl text-white">
                <FlaskConical size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">SAPOLAB PRO <span className="text-indigo-600">v4.0</span></h1>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{user ? 'Conectado a la Nube ☁️' : 'Calculadora de Precisión & Costos'}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3 mt-4 md:mt-0 print:hidden justify-center">
              <button onClick={() => setShowRecipesModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full font-bold hover:bg-indigo-100 transition-all text-sm border border-indigo-200">
                <BookOpen size={16} /> MIS RECETAS
              </button>
              <button onClick={handleSaveRecipe} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 transition-all text-sm shadow-md shadow-indigo-200">
                <Save size={16} /> GUARDAR
              </button>
              <button onClick={handleGeneratePDF} className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-full font-bold hover:bg-slate-800 transition-all text-sm">
                <Download size={16} /> DESCARGAR PDF
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              
              {/* PARÁMETROS DE PROCESO */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:break-inside-avoid">
                <div className="bg-slate-900 px-6 py-3 text-white flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest">Configuración del Lote</span>
                  <Settings size={16} className="opacity-50" />
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-6 gap-6">
                  
                  <div className="space-y-1 md:col-span-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Nombre de Receta</label>
                    <input type="text" value={metadata.recipeName} onChange={e => setMetadata({...metadata, recipeName: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800" placeholder="Ej. Jabón de Castilla" />
                  </div>
                  <div className="space-y-1 md:col-span-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Autor / Creador</label>
                    <input type="text" value={metadata.author} onChange={e => setMetadata({...metadata, author: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Tu nombre" />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Lote ID</label>
                    <input type="text" value={metadata.batch} onChange={e => setMetadata({...metadata, batch: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm" placeholder="BATCH-001" />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Fecha</label>
                    <input type="date" value={metadata.date} onChange={e => setMetadata({...metadata, date: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-1">SE %</label>
                    <input type="number" value={superfat} onChange={e => setSuperfat(e.target.value)} className="w-full px-3 py-2 border-2 border-indigo-100 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-700 text-sm" title="Sobreengrasado" />
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">Conc %</label>
                    <input type="number" value={concentration} onChange={e => setConcentration(e.target.value)} className="w-full px-3 py-2 border-2 border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-700 text-sm" title="Concentración" />
                  </div>
                </div>
              </div>

              {/* TABLA DE ACEITES */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 print:break-inside-avoid print:mt-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <h2 className="text-lg font-black flex items-center gap-2 uppercase tracking-tight">
                    <div className="w-1.5 h-5 bg-indigo-500 rounded-full" /> Aceites y Grasas
                  </h2>
                  
                  <div className="flex flex-wrap gap-2 print:hidden w-full md:w-auto justify-end">
                    <button onClick={() => setShowPricesModal(true)} className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg text-[10px] font-black flex items-center gap-1 hover:bg-emerald-100 transition-colors border border-emerald-200">
                      <History size={14} /> VER COSTOS
                    </button>
                    <button onClick={handleSavePrices} className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg text-[10px] font-black flex items-center gap-1 hover:bg-emerald-100 transition-colors border border-emerald-200 shadow-sm">
                      <Save size={14} /> GUARDAR COSTOS
                    </button>
                    <div className="relative group flex-grow md:flex-grow-0">
                      <button className="w-full bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-[10px] font-black flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors">
                        <Plus size={16} /> MATERIAL
                      </button>
                      <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 hidden group-hover:block max-h-96 overflow-y-auto p-2">
                        {OIL_DATABASE.map(oil => (
                          <button key={oil.id} onClick={() => addOil(oil)} className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 rounded-lg text-sm mb-1 transition-colors flex justify-between items-center border-b border-slate-50 last:border-0">
                            <span className="font-medium text-slate-700">{oil.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">SAP:{oil.sap}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100 text-[10px] uppercase font-black tracking-widest">
                        <th className="pb-3 text-left">Componente</th>
                        <th className="pb-3 text-left">Peso (g)</th>
                        <th className="pb-3 text-left">Costo $/Kg</th>
                        <th className="pb-3 text-right">Subtotal</th>
                        <th className="pb-3 w-10 print:hidden"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {recipe.map(oil => (
                        <tr key={oil.id} className="group">
                          <td className="py-3 font-bold text-slate-700">{oil.name}</td>
                          <td>
                            <input type="number" value={oil.grams || ''} onChange={e => setRecipe(recipe.map(o => o.id === oil.id ? {...o, grams: e.target.value} : o))} className="w-24 p-2 bg-slate-50 border rounded-lg font-mono text-center outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0" />
                          </td>
                          <td>
                            <input type="number" value={prices[oil.id] || ''} onChange={e => setPrices({...prices, [oil.id]: e.target.value})} className="w-24 p-2 bg-slate-50 border rounded-lg font-mono text-center outline-none" placeholder="0" />
                          </td>
                          <td className="text-right font-mono font-medium text-slate-500">
                            ${((parseFloat(oil.grams || 0) / 1000) * (parseFloat(prices[oil.id] || 0))).toFixed(2)}
                          </td>
                          <td className="text-right print:hidden">
                            <button onClick={() => setRecipe(recipe.filter(o => o.id !== oil.id))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-indigo-50/40">
                        <td className="py-4 px-3 font-bold text-indigo-900 italic">Sosa Cáustica (NaOH)</td>
                        <td className="py-4 font-mono font-black text-indigo-700">{totals.naoh.toFixed(2)}g</td>
                        <td>
                          <input type="number" value={prices['naoh'] || ''} onChange={e => setPrices({...prices, naoh: e.target.value})} className="w-24 p-2 bg-white border border-indigo-100 rounded-lg font-mono text-center outline-none" placeholder="$/kg" />
                        </td>
                        <td className="text-right font-mono font-black text-indigo-900">${((totals.naoh / 1000) * (parseFloat(prices['naoh'] || 0))).toFixed(2)}</td>
                        <td className="print:hidden"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ADITIVOS Y ÁCIDO CÍTRICO */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 print:break-inside-avoid print:mt-4">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-black flex items-center gap-2 uppercase tracking-tight">
                    <div className="w-1.5 h-5 bg-purple-500 rounded-full" /> Aditivos & Quelantes
                  </h2>
                  <div className="flex gap-2 print:hidden">
                    <button onClick={() => addAdditive(true)} className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg text-[10px] font-black border border-amber-200 hover:bg-amber-100 transition-colors">
                      + AÑADIR ÁCIDO CÍTRICO
                    </button>
                    <button onClick={() => addAdditive(false)} className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg text-[10px] font-black border border-purple-200 hover:bg-purple-100 transition-colors">
                      + OTRO ADITIVO
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {additives.map(add => (
                    <div key={add.id} className={`grid grid-cols-1 md:grid-cols-5 gap-3 items-end p-4 rounded-xl border ${add.type === 'citric' ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="md:col-span-1">
                        <label className="text-[9px] text-slate-400 font-black uppercase">Nombre</label>
                        <input type="text" value={add.name} onChange={e => setAdditives(additives.map(a => a.id === add.id ? {...a, name: e.target.value} : a))} className="w-full p-2 border rounded-lg text-xs font-bold" />
                      </div>
                      <div className="md:col-span-1">
                        <label className="text-[9px] text-slate-400 font-black uppercase">INCI</label>
                        <input type="text" value={add.inci} onChange={e => setAdditives(additives.map(a => a.id === add.id ? {...a, inci: e.target.value} : a))} className="w-full p-2 border rounded-lg text-xs font-mono" />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 font-black uppercase">Gramos</label>
                        <input type="number" value={add.grams || ''} onChange={e => setAdditives(additives.map(a => a.id === add.id ? {...a, grams: e.target.value} : a))} className="w-full p-2 border rounded-lg text-xs font-mono text-center" />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 font-black uppercase">$/Kg</label>
                        <input type="number" value={prices[add.id] || ''} onChange={e => setPrices({...prices, [add.id]: e.target.value})} className="w-full p-2 border rounded-lg text-xs font-mono text-center" />
                      </div>
                      <div className="text-right">
                        <button onClick={() => setAdditives(additives.filter(a => a.id !== add.id))} className="text-red-300 hover:text-red-500 p-2 print:hidden"><Trash2 size={16} /></button>
                      </div>
                      {add.type === 'citric' && (
                        <div className="md:col-span-5 text-[10px] text-amber-600 font-bold flex items-center gap-1 mt-1">
                          <AlertTriangle size={12} /> Se han sumado {(parseFloat(add.grams || 0) * 0.6).toFixed(2)}g de sosa extra para neutralizar este aditivo.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* NOTAS */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 print:break-inside-avoid print:mt-4">
                <h2 className="text-[10px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2">
                  <StickyNote size={14} /> Observaciones del Proceso
                </h2>
                <textarea 
                  value={metadata.notes}
                  onChange={e => setMetadata({...metadata, notes: e.target.value})}
                  className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Detalla aquí la temperatura, el momento de la traza, el aroma..."
                />
              </div>
            </div>

            {/* RESULTADOS */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* PREDICCIONES */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Indicadores de Calidad</h2>
                <ProgressBar label="Dureza" value={totals.predictions.hardness} min={45} max={55} />
                <ProgressBar label="Limpieza" value={totals.predictions.cleansing} min={12} max={22} />
                <ProgressBar label="Acondicionado" value={totals.predictions.conditioning} min={45} max={60} />
                <ProgressBar label="Burbujas" value={totals.predictions.bubbly} min={12} max={22} />
                <ProgressBar label="Persistencia" value={totals.predictions.creamy} min={16} max={48} />
              </div>

              {/* RESUMEN DE MEZCLA */}
              <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl">
                <h2 className="text-lg font-black mb-6 border-b border-white/10 pb-4">Guía de Mezcla</h2>
                
                <div className="space-y-5">
                  <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Agua Destilada</span>
                    <span className="text-2xl font-mono font-bold text-blue-300">{totals.water.toFixed(2)}g</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <div className="flex flex-col">
                      <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Sosa (NaOH) Total</span>
                      {totals.citricGrams > 0 && <span className="text-[9px] text-amber-400 font-bold italic">Incluye ajuste AC (+{totals.naohForCitric.toFixed(1)}g)</span>}
                    </div>
                    <span className="text-2xl font-mono font-bold text-amber-300">{totals.naoh.toFixed(2)}g</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="bg-white/5 p-3 rounded-2xl">
                      <span className="text-[10px] uppercase font-black text-slate-500 block mb-1">Costo Lote</span>
                      <p className="text-xl font-mono font-black text-green-400">${totals.totalCost.toFixed(2)}</p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-2xl text-right">
                      <span className="text-[10px] uppercase font-black text-slate-500 block mb-1">Peso Final</span>
                      <p className="text-xl font-mono font-black">{(totals.totalGramsOils + totals.naoh + totals.water).toFixed(1)}g</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* INCI AUTOMÁTICO */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-[10px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2">
                  <Tag size={14} /> Etiquetado INCI
                </h2>
                <div className="p-4 bg-slate-950 text-indigo-100 rounded-xl text-[10px] font-mono leading-relaxed select-all">
                  <strong>Ingredients:</strong> {totals.inciList}.
                </div>
                <p className="text-[9px] text-slate-400 mt-2 italic">
                  * Ordenado según peso de mayor a menor según regulación vigente.
                </p>
              </div>

            </div>
          </div>
        </div>
      ) : (
        /* =========================================
           PLANTILLA DE REPORTE FORMAL (CELDAS/TABLAS)
           SE MUESTRA ÚNICAMENTE AL GENERAR EL PDF
           ========================================= */
        <div id="formal-report" className="bg-white text-black p-8 font-sans w-full max-w-[800px] mx-auto text-sm shadow-2xl">
          <div className="border-b-4 border-slate-800 pb-4 mb-6 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase">Reporte de Producción</h1>
              <p className="text-slate-500 font-bold tracking-widest uppercase text-xs mt-1">Sapolab Pro v4.0</p>
            </div>
            <div className="text-right">
              <div className="text-xl font-mono font-bold bg-slate-100 px-3 py-1 border border-slate-800 inline-block mb-1">{metadata.batch || 'S/N'}</div>
              <div className="text-slate-600 font-medium">{metadata.date}</div>
            </div>
          </div>

          <table className="w-full border-collapse border border-slate-800 mb-6">
            <tbody>
              <tr>
                <td className="border border-slate-800 p-2 font-bold bg-slate-100 w-1/4 uppercase text-xs">Receta</td>
                <td className="border border-slate-800 p-2 w-1/4 font-medium">{metadata.recipeName || 'Sin Nombre'}</td>
                <td className="border border-slate-800 p-2 font-bold bg-slate-100 w-1/4 uppercase text-xs">Autor</td>
                <td className="border border-slate-800 p-2 w-1/4 font-medium">{metadata.author || 'Anónimo'}</td>
              </tr>
              <tr>
                <td className="border border-slate-800 p-2 font-bold bg-slate-100 uppercase text-xs">Sobreengrasado</td>
                <td className="border border-slate-800 p-2 font-mono">{superfat}%</td>
                <td className="border border-slate-800 p-2 font-bold bg-slate-100 uppercase text-xs">Concentración</td>
                <td className="border border-slate-800 p-2 font-mono">{concentration}%</td>
              </tr>
              <tr>
                <td className="border border-slate-800 p-2 font-bold bg-slate-100 uppercase text-xs">Peso Estimado</td>
                <td className="border border-slate-800 p-2 font-mono">{(totals.totalGramsOils + totals.naoh + totals.water).toFixed(1)} g</td>
                <td className="border border-slate-800 p-2 font-bold bg-slate-100 uppercase text-xs">Costo Total Lote</td>
                <td className="border border-slate-800 p-2 font-mono text-green-700 font-bold">${totals.totalCost.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          {/* FASE OLEOSA */}
          <h2 className="font-bold text-sm bg-slate-800 text-white px-3 py-1.5 mb-2 uppercase tracking-wider">1. Fase Oleosa (Grasas y Aceites)</h2>
          <table className="w-full border-collapse border border-slate-800 mb-6">
            <thead>
              <tr className="bg-slate-100 text-xs uppercase tracking-wider">
                <th className="border border-slate-800 p-2 text-left">Ingrediente</th>
                <th className="border border-slate-800 p-2 text-center w-24">Proporción</th>
                <th className="border border-slate-800 p-2 text-right w-32">Peso (g)</th>
              </tr>
            </thead>
            <tbody>
              {recipe.map(oil => (
                <tr key={oil.id}>
                  <td className="border border-slate-800 p-2">{oil.name}</td>
                  <td className="border border-slate-800 p-2 text-center font-mono text-slate-600">
                    {totals.totalGramsOils > 0 ? ((parseFloat(oil.grams) || 0) / totals.totalGramsOils * 100).toFixed(1) : 0}%
                  </td>
                  <td className="border border-slate-800 p-2 text-right font-mono font-bold">{parseFloat(oil.grams || 0).toFixed(1)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className="border border-slate-800 p-2 text-right uppercase text-xs" colSpan="2">Total Aceites y Grasas:</td>
                <td className="border border-slate-800 p-2 text-right font-mono bg-slate-200">{totals.totalGramsOils.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>

          {/* FASE ACUOSA Y ALCALI */}
          <h2 className="font-bold text-sm bg-slate-800 text-white px-3 py-1.5 mb-2 uppercase tracking-wider">2. Fase Acuosa y Álcali</h2>
          <table className="w-full border-collapse border border-slate-800 mb-6">
            <thead>
              <tr className="bg-slate-100 text-xs uppercase tracking-wider">
                <th className="border border-slate-800 p-2 text-left">Componente</th>
                <th className="border border-slate-800 p-2 text-left">Detalles de formulación</th>
                <th className="border border-slate-800 p-2 text-right w-32">Peso (g)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-800 p-2 font-bold text-blue-900">Agua Destilada</td>
                <td className="border border-slate-800 p-2 text-xs text-slate-600">Calculada al {concentration}% de concentración</td>
                <td className="border border-slate-800 p-2 text-right font-mono font-bold text-blue-700">{totals.water.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="border border-slate-800 p-2 font-bold text-amber-900">Sosa Cáustica (NaOH)</td>
                <td className="border border-slate-800 p-2 text-xs text-slate-600">
                  Base (SE {superfat}%) 
                  {totals.citricGrams > 0 ? <span className="text-amber-600 font-bold"> + Ajuste Ácido Cítrico (+{totals.naohForCitric.toFixed(1)}g)</span> : ''}
                </td>
                <td className="border border-slate-800 p-2 text-right font-mono font-bold text-amber-700 bg-amber-50">{totals.naoh.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          {/* ADITIVOS */}
          {additives.length > 0 && (
            <>
              <h2 className="font-bold text-sm bg-slate-800 text-white px-3 py-1.5 mb-2 uppercase tracking-wider">3. Aditivos Extra</h2>
              <table className="w-full border-collapse border border-slate-800 mb-6">
                <thead>
                  <tr className="bg-slate-100 text-xs uppercase tracking-wider">
                    <th className="border border-slate-800 p-2 text-left">Aditivo / Nomenclatura</th>
                    <th className="border border-slate-800 p-2 text-right w-32">Peso (g)</th>
                  </tr>
                </thead>
                <tbody>
                  {additives.map(add => (
                    <tr key={add.id}>
                      <td className="border border-slate-800 p-2">
                        <span className="font-bold">{add.name}</span> <span className="text-slate-500 text-xs">({add.inci || 'N/A'})</span>
                      </td>
                      <td className="border border-slate-800 p-2 text-right font-mono font-bold">{parseFloat(add.grams || 0).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* PROPIEDADES */}
          <h2 className="font-bold text-sm bg-slate-800 text-white px-3 py-1.5 mb-2 uppercase tracking-wider">4. Perfil Químico Proyectado</h2>
          <table className="w-full border-collapse border border-slate-800 mb-6 text-center table-fixed">
            <thead>
              <tr className="bg-slate-100 text-xs uppercase tracking-wider">
                <th className="border border-slate-800 p-2">Dureza<br/><span className="text-[9px] font-normal normal-case text-slate-500">(Ideal 45-55)</span></th>
                <th className="border border-slate-800 p-2">Limpieza<br/><span className="text-[9px] font-normal normal-case text-slate-500">(Ideal 12-22)</span></th>
                <th className="border border-slate-800 p-2">Acond.<br/><span className="text-[9px] font-normal normal-case text-slate-500">(Ideal 45-60)</span></th>
                <th className="border border-slate-800 p-2">Burbujas<br/><span className="text-[9px] font-normal normal-case text-slate-500">(Ideal 12-22)</span></th>
                <th className="border border-slate-800 p-2">Persistencia<br/><span className="text-[9px] font-normal normal-case text-slate-500">(Ideal 16-48)</span></th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-lg">
                <td className="border border-slate-800 p-2 font-mono font-bold">{Math.round(totals.predictions.hardness)}</td>
                <td className="border border-slate-800 p-2 font-mono font-bold">{Math.round(totals.predictions.cleansing)}</td>
                <td className="border border-slate-800 p-2 font-mono font-bold">{Math.round(totals.predictions.conditioning)}</td>
                <td className="border border-slate-800 p-2 font-mono font-bold">{Math.round(totals.predictions.bubbly)}</td>
                <td className="border border-slate-800 p-2 font-mono font-bold">{Math.round(totals.predictions.creamy)}</td>
              </tr>
            </tbody>
          </table>

          {/* NOTAS E INCI */}
          <div className="border border-slate-800 p-4 mb-4">
            <h3 className="font-bold uppercase text-xs tracking-wider mb-2 text-slate-500 border-b border-slate-300 pb-1">Observaciones del Proceso:</h3>
            <p className="whitespace-pre-wrap text-sm text-slate-800 min-h-[4rem]">{metadata.notes || 'Ninguna observación.'}</p>
          </div>

          <div className="border border-slate-800 p-4 bg-slate-50">
            <h3 className="font-bold uppercase text-xs tracking-wider mb-2 text-slate-500">Listado INCI Internacional Sugerido:</h3>
            <p className="text-xs font-mono leading-relaxed text-slate-700">{totals.inciList}</p>
          </div>
          
          <div className="mt-8 text-center text-xs text-slate-400 font-mono">
            Generado automáticamente por SAPOLAB PRO - {new Date().toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}