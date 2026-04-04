import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function SignUpPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    nom: '',
    email: '',
    password: '',
    confirm: '',
    date_naissance: '',
    adresse: '',
    maladies: [],
  })

  // Maladies hardcodées — pas de requête Supabase
  const maladiesRef = [
    { id: '1',  nom: 'Hypertension artérielle',  categorie: 'Cardiovasculaire' },
    { id: '2',  nom: 'Insuffisance cardiaque',    categorie: 'Cardiovasculaire' },
    { id: '3',  nom: 'Arythmie cardiaque',        categorie: 'Cardiovasculaire' },
    { id: '4',  nom: 'Fibrillation auriculaire',  categorie: 'Cardiovasculaire' },
    { id: '5',  nom: 'Angine de poitrine',        categorie: 'Cardiovasculaire' },
    { id: '6',  nom: 'Diabète de type 1',         categorie: 'Métabolique'      },
    { id: '7',  nom: 'Diabète de type 2',         categorie: 'Métabolique'      },
    { id: '8',  nom: 'Obésité',                   categorie: 'Métabolique'      },
    { id: '9',  nom: 'Insuffisance respiratoire', categorie: 'Respiratoire'     },
    { id: '10', nom: 'Apnée du sommeil',          categorie: 'Respiratoire'     },
    { id: '11', nom: 'Épilepsie',                 categorie: 'Neurologique'     },
    { id: '12', nom: 'Maladie de Parkinson',      categorie: 'Neurologique'     },
    { id: '13', nom: 'Alzheimer',                 categorie: 'Neurologique'     },
    { id: '14', nom: 'Insuffisance rénale',       categorie: 'Rénale'           },
    { id: '15', nom: 'Autre',                     categorie: 'Autre'            },
  ]

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function toggleMaladie(nom) {
    setForm(prev => ({
      ...prev,
      maladies: prev.maladies.includes(nom)
        ? prev.maladies.filter(m => m !== nom)
        : [...prev.maladies, nom]
    }))
  }

  async function handleSubmit() {
    setError('')
    setLoading(true)

    try {
      // 1. Créer le compte auth → trigger crée utilisateurs
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            nom:  form.nom,
            role: 'patient',
          }
        }
      })

      if (signUpError) throw signUpError

      const userId = data.user.id

      // 2. Créer la ligne dans patients
      const { error: patientError } = await supabase
        .from('patients')
        .insert({
          user_id:        userId,
          date_naissance: form.date_naissance || null,
          adresse:        form.adresse || null,
          maladies:       form.maladies,
          status:         'offline',
        })

      if (patientError) throw patientError

      // 3. Rediriger
      navigate('/dashboard/patient')

    } catch (err) {
      setError(err.message || 'Erreur lors de l\'inscription')
    } finally {
      setLoading(false)
    }
  }

  // Grouper par catégorie
  const maladiesParCategorie = maladiesRef.reduce((acc, m) => {
    if (!acc[m.categorie]) acc[m.categorie] = []
    acc[m.categorie].push(m)
    return acc
  }, {})

  // Validation step 1
  const step1Valid =
    form.nom.trim() &&
    form.email.trim() &&
    form.password.length >= 6 &&
    form.password === form.confirm

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-3xl mb-2">🫀</div>
          <h1 className="text-2xl font-bold text-white">
            Smart<span className="text-cyan-400">Guardian</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Créer votre compte patient</p>
        </div>

        {/* Indicateur d'étape */}
        <div className="flex items-center gap-2 mb-8">
          <div className={`flex-1 h-1 rounded-full transition-all ${step >= 1 ? 'bg-cyan-400' : 'bg-slate-700'}`} />
          <div className={`flex-1 h-1 rounded-full transition-all ${step >= 2 ? 'bg-cyan-400' : 'bg-slate-700'}`} />
        </div>

        {/* ── STEP 1 : Informations personnelles ── */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-white font-semibold mb-4">Informations personnelles</h2>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Nom complet *</label>
              <input
                name="nom"
                value={form.nom}
                onChange={handleChange}
                placeholder="Mohamed Trabelsi"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Email *</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="votre@email.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Mot de passe *</label>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Confirmer *</label>
                <input
                  name="confirm"
                  type="password"
                  value={form.confirm}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none transition ${
                    form.confirm && form.password !== form.confirm
                      ? 'border-red-500'
                      : 'border-slate-700 focus:border-cyan-400'
                  }`}
                />
              </div>
            </div>

            {form.confirm && form.password !== form.confirm && (
              <p className="text-red-400 text-xs">Les mots de passe ne correspondent pas</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Date de naissance</label>
                <input
                  name="date_naissance"
                  type="date"
                  value={form.date_naissance}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Adresse</label>
                <input
                  name="adresse"
                  value={form.adresse}
                  onChange={handleChange}
                  placeholder="Ville, Pays"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-lg px-4 py-3 transition"
            >
              Suivant →
            </button>
          </div>
        )}

        {/* ── STEP 2 : Maladies par checkbox ── */}
        {step === 2 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setStep(1)}
                className="text-slate-400 hover:text-white transition text-sm"
              >
                ← Retour
              </button>
              <h2 className="text-white font-semibold">
                Antécédents médicaux
                <span className="text-slate-500 font-normal text-sm ml-2">(optionnel)</span>
              </h2>
            </div>

            <p className="text-slate-400 text-sm mb-4">
              Cochez les maladies qui vous concernent. Ces informations aident votre médecin.
            </p>

            {/* Checkboxes groupées par catégorie */}
            <div className="space-y-4 max-h-72 overflow-y-auto pr-1 mb-6">
              {Object.entries(maladiesParCategorie).map(([categorie, maladies]) => (
                <div key={categorie}>
                  <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">
                    {categorie}
                  </p>
                  <div className="space-y-2">
                    {maladies.map(m => (
                      <label
                        key={m.id}
                        className="flex items-center gap-3 cursor-pointer group"
                      >
                        <div
                          onClick={() => toggleMaladie(m.nom)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                            form.maladies.includes(m.nom)
                              ? 'bg-cyan-400 border-cyan-400'
                              : 'border-slate-600 group-hover:border-slate-400'
                          }`}
                        >
                          {form.maladies.includes(m.nom) && (
                            <span className="text-slate-900 text-xs font-bold">✓</span>
                          )}
                        </div>
                        <span
                          onClick={() => toggleMaladie(m.nom)}
                          className="text-sm text-slate-300 group-hover:text-white transition"
                        >
                          {m.nom}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Résumé sélection */}
            {form.maladies.length > 0 && (
              <div className="bg-slate-800 rounded-lg p-3 mb-4">
                <p className="text-xs text-slate-400 mb-2">
                  {form.maladies.length} sélectionnée(s) :
                </p>
                <div className="flex flex-wrap gap-2">
                  {form.maladies.map(m => (
                    <span
                      key={m}
                      className="bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 text-xs px-2 py-1 rounded-full"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-4">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-lg px-4 py-3 transition"
            >
              {loading ? 'Création du compte...' : 'Créer mon compte'}
            </button>
          </div>
        )}

        {/* Lien login */}
        <p className="text-center text-slate-500 text-sm mt-6">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300 transition">
            Se connecter
          </Link>
        </p>

      </div>
    </div>
  )
}