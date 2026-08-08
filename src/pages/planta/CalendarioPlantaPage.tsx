import React, { useEffect, useState, useMemo, type ChangeEvent } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Input, Modal } from '@/components/ui'
import { PageHeader, ReadOnlyBanner } from '@/components/common/Page'
import { useCanWrite } from '@/hooks/usePermissions'
import './calendario-planta.css'

// ── Types ──────────────────────────────────────────────
interface RegistroTurno {
  planta: string
  mina: string
  triturado: number | null
  molienda: number | null
  flotacion: number | null
  filtroPrensas: number | null
  plantasElectricas: number | null
  material: number | null
  acpm: number | null
  pelotaMolino: number | null
  observaciones: string
}

type TurnoNum = 1 | 2 | 3
type RowTipo  = 'text' | 'number' | 'obs'
type FormState = Record<string, string>

// ── Constants ──────────────────────────────────────────
const TURNO_LABELS: Record<TurnoNum, string> = {
  1: 'Turno 1 — 6:00 AM a 2:00 PM',
  2: 'Turno 2 — 2:00 PM a 10:00 PM',
  3: 'Turno 3 — 10:00 PM a 6:00 AM',
}
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const LS_KEY = 'molinos_planta_cal_v1'

const FILAS: { key: keyof RegistroTurno; label: string; tipo: RowTipo }[] = [
  { key: 'planta',            label: 'PLANTA',                tipo: 'text'   },
  { key: 'mina',              label: 'MINA / RESPONSABLE',    tipo: 'text'   },
  { key: 'triturado',         label: 'TRITURADO (h)',         tipo: 'number' },
  { key: 'molienda',          label: 'MOLIENDA (h)',          tipo: 'number' },
  { key: 'flotacion',         label: 'FLOTACIÓN (h)',         tipo: 'number' },
  { key: 'filtroPrensas',     label: 'FILTRO PRENSA (h)',     tipo: 'number' },
  { key: 'plantasElectricas', label: 'PLANTAS ELÉC. (h)',     tipo: 'number' },
  { key: 'material',          label: 'MATERIAL (ton)',        tipo: 'number' },
  { key: 'acpm',              label: 'ACPM (gal)',            tipo: 'number' },
  { key: 'pelotaMolino',      label: 'PELOTA MOL. (kg)',      tipo: 'number' },
  { key: 'observaciones',     label: 'OBSERVACIONES',         tipo: 'obs'    },
]

const CRITICAL_KW = ['paro', 'paró', 'perdió', 'daño', 'dañó', 'botó', 'tapó', 'rompió', 'falló', 'falla']

const PLANTA_OPTS = ['PLANTA GRANDE', 'PLANTA PEQUEÑA']
const MINA_OPTS   = [
  '', 'RICARDO POVEDA', 'OMAR', 'OMAR MINA 80', 'OMAR ROCA MINA 80',
  'LEONEL MINA 30', 'OMAR-REFLOTANDO', 'PASARON MATERIAL OMAR M. 80',
]

const SUMMARY_FIELDS: { key: keyof RegistroTurno; label: string; unit: string }[] = [
  { key: 'molienda',          label: 'Molienda',       unit: 'h'   },
  { key: 'flotacion',         label: 'Flotación',      unit: 'h'   },
  { key: 'filtroPrensas',     label: 'Filtro Prensa',  unit: 'h'   },
  { key: 'plantasElectricas', label: 'Plantas Eléc.',  unit: 'h'   },
  { key: 'material',          label: 'Material',       unit: 'ton' },
  { key: 'acpm',              label: 'ACPM',           unit: 'gal' },
  { key: 'triturado',         label: 'Triturado',      unit: 'h'   },
]

// ── Helpers ────────────────────────────────────────────
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

const getMonday = (d: Date): Date => {
  const dt = new Date(d); dt.setHours(0,0,0,0)
  const day = dt.getDay()
  dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1))
  return dt
}

const getWeekDays = (monday: Date): Date[] =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i); return d
  })

const rKey = (fecha: string, t: TurnoNum) => `${fecha}-${t}`

const emptyForm = (): FormState => ({
  planta:'', mina:'', triturado:'', molienda:'', flotacion:'',
  filtroPrensas:'', plantasElectricas:'', material:'', acpm:'',
  pelotaMolino:'', observaciones:'',
})

const toForm = (r: RegistroTurno): FormState => ({
  planta: r.planta, mina: r.mina, observaciones: r.observaciones,
  triturado:         r.triturado         != null ? String(r.triturado)         : '',
  molienda:          r.molienda          != null ? String(r.molienda)          : '',
  flotacion:         r.flotacion         != null ? String(r.flotacion)         : '',
  filtroPrensas:     r.filtroPrensas     != null ? String(r.filtroPrensas)     : '',
  plantasElectricas: r.plantasElectricas != null ? String(r.plantasElectricas) : '',
  material:          r.material          != null ? String(r.material)          : '',
  acpm:              r.acpm              != null ? String(r.acpm)              : '',
  pelotaMolino:      r.pelotaMolino      != null ? String(r.pelotaMolino)      : '',
})

const fromForm = (f: FormState): RegistroTurno => ({
  planta: f.planta, mina: f.mina, observaciones: f.observaciones,
  triturado:         f.triturado         !== '' ? Number(f.triturado)         : null,
  molienda:          f.molienda          !== '' ? Number(f.molienda)          : null,
  flotacion:         f.flotacion         !== '' ? Number(f.flotacion)         : null,
  filtroPrensas:     f.filtroPrensas     !== '' ? Number(f.filtroPrensas)     : null,
  plantasElectricas: f.plantasElectricas !== '' ? Number(f.plantasElectricas) : null,
  material:          f.material          !== '' ? Number(f.material)          : null,
  acpm:              f.acpm              !== '' ? Number(f.acpm)              : null,
  pelotaMolino:      f.pelotaMolino      !== '' ? Number(f.pelotaMolino)      : null,
})

const obsLevel = (obs: string): 'none' | 'minor' | 'critical' => {
  if (!obs) return 'none'
  const lo = obs.toLowerCase()
  return CRITICAL_KW.some(k => lo.includes(k)) ? 'critical' : 'minor'
}

const fmt = (v: number | null, decimals = 1) =>
  v === null ? null : (Number.isInteger(v) ? v : v.toFixed(decimals))

// ── Seed data — semanas mayo 2026 ─────────────────────
const SEED_DATA: Record<string, RegistroTurno> = {
  // Semana 11–17 mayo 2026
  '2026-05-11-1': { planta:'PLANTA GRANDE', mina:'RICARDO POVEDA',  triturado:0,    molienda:8,    flotacion:8,   filtroPrensas:0,   plantasElectricas:2,   material:7000,  acpm:20,  pelotaMolino:null, observaciones:'' },
  '2026-05-11-2': { planta:'PLANTA GRANDE', mina:'OMAR',            triturado:0,    molienda:6,    flotacion:6,   filtroPrensas:0,   plantasElectricas:6,   material:8335,  acpm:50,  pelotaMolino:null, observaciones:'' },
  '2026-05-11-3': { planta:'PLANTA GRANDE', mina:'OMAR',            triturado:0,    molienda:6,    flotacion:6,   filtroPrensas:0,   plantasElectricas:6,   material:7042,  acpm:50,  pelotaMolino:null, observaciones:'' },

  '2026-05-12-1': { planta:'PLANTA GRANDE', mina:'OMAR MINA 80',   triturado:0,    molienda:6,    flotacion:6,   filtroPrensas:9,   plantasElectricas:8,   material:8000,  acpm:65,  pelotaMolino:null, observaciones:'Se perdio 1h. de molienda, se soldo parales.' },
  '2026-05-12-2': { planta:'PLANTA GRANDE', mina:'OMAR MINA 80',   triturado:0,    molienda:7,    flotacion:8,   filtroPrensas:5,   plantasElectricas:8,   material:11281, acpm:65,  pelotaMolino:null, observaciones:'' },
  '2026-05-12-3': { planta:'PLANTA GRANDE', mina:'OMAR MINA 80',   triturado:0,    molienda:6,    flotacion:6,   filtroPrensas:4,   plantasElectricas:6,   material:8453,  acpm:50,  pelotaMolino:null, observaciones:'' },

  '2026-05-13-1': { planta:'PLANTA GRANDE', mina:'OMAR MINA 80',   triturado:0,    molienda:7,    flotacion:7,   filtroPrensas:0,   plantasElectricas:7,   material:9563,  acpm:50,  pelotaMolino:null, observaciones:'Paro 20mn, se tapo hidrociclon. La bomba empezó a botar el agua por el cuello del molino, se paro para soldar, molieron 6h.' },
  '2026-05-13-2': { planta:'PLANTA GRANDE', mina:'OMAR MINA 80',   triturado:0,    molienda:7,    flotacion:8,   filtroPrensas:0,   plantasElectricas:8,   material:10340, acpm:65,  pelotaMolino:null, observaciones:'' },
  '2026-05-13-3': { planta:'PLANTA GRANDE', mina:'OMAR MINA 80',   triturado:0,    molienda:7,    flotacion:8,   filtroPrensas:0,   plantasElectricas:8,   material:9657,  acpm:65,  pelotaMolino:null, observaciones:'' },

  '2026-05-14-1': { planta:'PLANTA GRANDE', mina:'OMAR MINA 80',   triturado:0,    molienda:8,    flotacion:8,   filtroPrensas:8,   plantasElectricas:8,   material:10362, acpm:60,  pelotaMolino:null, observaciones:'' },
  '2026-05-14-2': { planta:'PLANTA GRANDE', mina:'OMAR MINA 80',   triturado:0,    molienda:6,    flotacion:8,   filtroPrensas:0,   plantasElectricas:8,   material:9185,  acpm:60,  pelotaMolino:null, observaciones:'La planta grande solo trabajo 6 horas.' },
  '2026-05-14-3': { planta:'PLANTA GRANDE', mina:'OMAR MINA 80',   triturado:0,    molienda:8,    flotacion:8,   filtroPrensas:8,   plantasElectricas:4.5, material:10332, acpm:35,  pelotaMolino:null, observaciones:'' },

  '2026-05-15-1': { planta:'PLANTA GRANDE', mina:'OMAR MINA 80',   triturado:0,    molienda:8,    flotacion:8,   filtroPrensas:9,   plantasElectricas:6,   material:12314, acpm:50,  pelotaMolino:null, observaciones:'Fallo bomba del agua y molino grande, toco volver a soldar perdiendo 2h. Se trabajo con dos molinos pequeños.' },
  '2026-05-15-2': { planta:'PLANTA GRANDE', mina:'OMAR MINA 80',   triturado:0,    molienda:6,    flotacion:8,   filtroPrensas:0,   plantasElectricas:8,   material:9048,  acpm:65,  pelotaMolino:null, observaciones:'' },
  '2026-05-15-3': { planta:'PLANTA GRANDE', mina:'OMAR MINA 80',   triturado:0,    molienda:6,    flotacion:8,   filtroPrensas:9,   plantasElectricas:5,   material:8071,  acpm:40,  pelotaMolino:null, observaciones:'' },

  '2026-05-16-1': { planta:'PLANTA GRANDE', mina:'OMAR MINA 80',      triturado:null, molienda:1,    flotacion:8,   filtroPrensas:9,   plantasElectricas:0,   material:696,   acpm:0,   pelotaMolino:null, observaciones:'Limpiaron molinos y flotacion por cambio de material, el personal translado la roca a la rampa.' },
  '2026-05-16-2': { planta:'PLANTA GRANDE', mina:'',                   triturado:null, molienda:0,    flotacion:0,   filtroPrensas:0,   plantasElectricas:0,   material:0,     acpm:0,   pelotaMolino:null, observaciones:'' },
  '2026-05-16-3': { planta:'PLANTA GRANDE', mina:'OMAR ROCA MINA 80', triturado:null, molienda:8,    flotacion:0,   filtroPrensas:0,   plantasElectricas:4,   material:8111,  acpm:30,  pelotaMolino:null, observaciones:'' },

  '2026-05-17-1': { planta:'PLANTA GRANDE', mina:'OMAR ROCA MINA 80', triturado:null, molienda:7,    flotacion:0,   filtroPrensas:9,   plantasElectricas:0,   material:6597,  acpm:0,   pelotaMolino:null, observaciones:'' },
  '2026-05-17-2': { planta:'PLANTA GRANDE', mina:'OMAR ROCA MINA 80', triturado:null, molienda:8,    flotacion:0,   filtroPrensas:0,   plantasElectricas:9,   material:10945, acpm:70,  pelotaMolino:null, observaciones:'Se desocupo la piscina de la filtro prensa que estaba con material de Omar que salio bajo de tenor.' },
  '2026-05-17-3': { planta:'PLANTA GRANDE', mina:'',                   triturado:null, molienda:0,    flotacion:0,   filtroPrensas:9,   plantasElectricas:0,   material:0,     acpm:0,   pelotaMolino:null, observaciones:'' },

  // Semana 18–24 mayo 2026
  '2026-05-18-1': { planta:'PLANTA GRANDE', mina:'OMAR ROCA MINA 80', triturado:null, molienda:7,    flotacion:0,   filtroPrensas:0,   plantasElectricas:5,   material:5371,  acpm:52,  pelotaMolino:null, observaciones:'Se trabajo 7h. La bomba se tapo el empele y se cambio correa al molino pequeño.' },

  '2026-05-19-1': { planta:'PLANTA GRANDE', mina:'OMAR ROCA MINA 80', triturado:null, molienda:null, flotacion:null, filtroPrensas:9,  plantasElectricas:0,   material:null,  acpm:null, pelotaMolino:null, observaciones:'Trabajo molino pequeño.' },
  '2026-05-19-2': { planta:'PLANTA GRANDE', mina:'OMAR ROCA MINA 80', triturado:null, molienda:2,    flotacion:null, filtroPrensas:8,  plantasElectricas:8,   material:3000,  acpm:50,  pelotaMolino:null, observaciones:'' },

  '2026-05-20-1': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30',    triturado:null, molienda:null, flotacion:null, filtroPrensas:0,  plantasElectricas:null, material:null, acpm:null, pelotaMolino:null, observaciones:'No se laboro.' },
  '2026-05-20-2': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30',    triturado:null, molienda:8,    flotacion:8,   filtroPrensas:0,   plantasElectricas:8,   material:7000,  acpm:65,  pelotaMolino:null, observaciones:'Trabajaron 2 personas moliendo y pasando a la piscina de filtroprensa.' },
  '2026-05-20-3': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30',    triturado:null, molienda:8,    flotacion:8,   filtroPrensas:0,   plantasElectricas:5,   material:7300,  acpm:40,  pelotaMolino:null, observaciones:'' },

  '2026-05-21-1': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30',    triturado:null, molienda:8,    flotacion:8,   filtroPrensas:9,   plantasElectricas:8,   material:7000,  acpm:60,  pelotaMolino:null, observaciones:'' },
  '2026-05-21-2': { planta:'PLANTA GRANDE', mina:'OMAR-REFLOTANDO',   triturado:null, molienda:6,    flotacion:8,   filtroPrensas:0,   plantasElectricas:8,   material:null,  acpm:60,  pelotaMolino:null, observaciones:'Trabajaron 2 personas, recogiendo y pesando material.' },
  '2026-05-21-3': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30',    triturado:null, molienda:5,    flotacion:5,   filtroPrensas:9,   plantasElectricas:8,   material:5508,  acpm:60,  pelotaMolino:null, observaciones:'' },

  '2026-05-22-1': { planta:'PLANTA GRANDE', mina:'OMAR-REFLOTANDO',            triturado:null, molienda:2, flotacion:2, filtroPrensas:9, plantasElectricas:3, material:3600,  acpm:25, pelotaMolino:null, observaciones:'Terminaron de pasar material y despues empacaron, porque las piscinas estaban llenas y no se podia flotar ya que se iba a reflotar el material de Omar Mina 80.' },
  '2026-05-22-2': { planta:'PLANTA GRANDE', mina:'PASARON MATERIAL OMAR M. 80', triturado:null, molienda:7, flotacion:8, filtroPrensas:0, plantasElectricas:8, material:8262,  acpm:65, pelotaMolino:null, observaciones:'' },
  '2026-05-22-3': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30',              triturado:null, molienda:8, flotacion:8, filtroPrensas:0, plantasElectricas:8, material:12948, acpm:65, pelotaMolino:null, observaciones:'' },

  '2026-05-23-1': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30', triturado:null, molienda:6.5, flotacion:8, filtroPrensas:9, plantasElectricas:6.5, material:10339, acpm:52, pelotaMolino:null, observaciones:'Trasladando material de Ricardo y Marlon de la piscina a la filtroprensa.' },
  '2026-05-23-2': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30', triturado:null, molienda:8,   flotacion:8, filtroPrensas:0, plantasElectricas:8,   material:13464, acpm:65, pelotaMolino:null, observaciones:'Se inicio reflotacion material Omar Mina 80.' },
  '2026-05-23-3': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30', triturado:null, molienda:8,   flotacion:8, filtroPrensas:9, plantasElectricas:4,   material:10120, acpm:32, pelotaMolino:null, observaciones:'' },

  // Semana 25–31 mayo 2026
  '2026-05-25-1': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30', triturado:null, molienda:7, flotacion:8, filtroPrensas:9, plantasElectricas:8, material:11512, acpm:65, pelotaMolino:null, observaciones:'Se floto concentrado Omar Mina 80.' },
  '2026-05-25-2': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30', triturado:null, molienda:8, flotacion:8, filtroPrensas:0, plantasElectricas:8, material:11617, acpm:65, pelotaMolino:null, observaciones:'La flotacion de limpieza se daño, se desarmo para reconstruir la pieza que se daño.' },
  '2026-05-25-3': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30', triturado:null, molienda:8, flotacion:8, filtroPrensas:9, plantasElectricas:4, material:13192, acpm:35, pelotaMolino:null, observaciones:'' },

  '2026-05-26-1': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30', triturado:null, molienda:8, flotacion:8, filtroPrensas:9, plantasElectricas:8, material:16087, acpm:60, pelotaMolino:null, observaciones:'Se trabajo 2h de molienda, la flotacion de molienda se daño.' },
  '2026-05-26-2': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30', triturado:null, molienda:8, flotacion:8, filtroPrensas:0, plantasElectricas:8, material:12483, acpm:60, pelotaMolino:null, observaciones:'Se paro 1h el remoledor grande, se daño unos tornillos y toco soldarlos.' },
  '2026-05-26-3': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30', triturado:null, molienda:6, flotacion:6, filtroPrensas:9, plantasElectricas:6, material:12152, acpm:50, pelotaMolino:null, observaciones:'Solo se trabajo 6.5h, se fue la luz y la planta estaba en mantenimiento.' },

  '2026-05-27-1': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30', triturado:null, molienda:null, flotacion:null, filtroPrensas:null, plantasElectricas:null, material:null, acpm:null, pelotaMolino:null, observaciones:'Se perdio 1h porque se partio la base del molino.' },
  '2026-05-27-2': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30', triturado:null, molienda:null, flotacion:null, filtroPrensas:null, plantasElectricas:null, material:null, acpm:null, pelotaMolino:null, observaciones:'Se trabajo solo en la flotacion porque la planta esta dañada y los muchachos del area trabajaron en empacado.' },
  '2026-05-27-3': { planta:'PLANTA GRANDE', mina:'LEONEL MINA 30', triturado:null, molienda:null, flotacion:null, filtroPrensas:null, plantasElectricas:null, material:null, acpm:null, pelotaMolino:null, observaciones:'Empacaron material todo el turno para despachar la mula. No se trabajo.' },
}

// ── Main Component ─────────────────────────────────────
export function CalendarioPlantaPage() {
  const canWrite = useCanWrite('planta')

  const [data, setData] = useState<Record<string, RegistroTurno>>(() => {
    try {
      const s = localStorage.getItem(LS_KEY)
      if (s != null) return JSON.parse(s) as Record<string, RegistroTurno>
      localStorage.setItem(LS_KEY, JSON.stringify(SEED_DATA))
      return SEED_DATA
    } catch { return SEED_DATA }
  })
  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify(data)) }, [data])

  const [vista,     setVista]     = useState<'semanal' | 'diario'>('semanal')
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()))
  const [diaActual, setDiaActual] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d })

  const todayStr = toISO(new Date())
  const dias     = getWeekDays(weekStart)

  // Edit modal
  const [editKey,   setEditKey]   = useState<string | null>(null)
  const [formState, setFormState] = useState<FormState>(emptyForm())

  const editInfo = useMemo(() => editKey ? {
    fecha: editKey.slice(0, 10),
    turno: Number(editKey.slice(11)) as TurnoNum,
  } : null, [editKey])

  const modalTitle = useMemo(() => {
    if (!editInfo) return ''
    const [,, d, ] = [...editInfo.fecha.split('-').map(Number)]
    const m = editInfo.fecha.split('-').map(Number)[1]
    const dt  = new Date(editInfo.fecha + 'T12:00:00')
    const idx  = dt.getDay() === 0 ? 6 : dt.getDay() - 1
    return `${DIAS_SEMANA[idx]} ${d}/${m} — ${TURNO_LABELS[editInfo.turno]}`
  }, [editInfo])

  const openCell = (fecha: string, t: TurnoNum) => {
    const key = rKey(fecha, t)
    setEditKey(key)
    setFormState(data[key] ? toForm(data[key]) : emptyForm())
  }
  const saveCell = () => {
    if (!editKey) return
    setData(prev => ({ ...prev, [editKey]: fromForm(formState) }))
    setEditKey(null)
  }
  const setField = (k: string, v: string) => setFormState(prev => ({ ...prev, [k]: v }))

  // Navigation — weekly
  const prevWeek    = () => { const d = new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d) }
  const nextWeek    = () => { const d = new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d) }
  const goTodayWeek = () => setWeekStart(getMonday(new Date()))

  // Navigation — daily
  const prevDia    = () => { const d = new Date(diaActual); d.setDate(d.getDate()-1); setDiaActual(d) }
  const nextDia    = () => { const d = new Date(diaActual); d.setDate(d.getDate()+1); setDiaActual(d) }
  const goTodayDia = () => { const d = new Date(); d.setHours(0,0,0,0); setDiaActual(d) }

  // Data helpers
  const getR   = (fecha: string, t: TurnoNum) => data[rKey(fecha, t)]
  const hasReg = (fecha: string, t: TurnoNum) => !!data[rKey(fecha, t)]
  const getNum = (fecha: string, t: TurnoNum, key: string): number | null => {
    const r = getR(fecha, t)
    const v = r ? (r as unknown as Record<string, unknown>)[key] : undefined
    return typeof v === 'number' ? v : null
  }
  const getStr = (fecha: string, t: TurnoNum, key: string): string => {
    const r = getR(fecha, t)
    const v = r ? (r as unknown as Record<string, unknown>)[key] : undefined
    return typeof v === 'string' ? v : ''
  }
  const numTotal = (fecha: string, key: string): number | null => {
    const vals = ([1,2,3] as TurnoNum[]).map(t => getNum(fecha, t, key))
    if (vals.every(v => v === null)) return null
    return (vals as (number | null)[]).reduce<number>((acc, v) => acc + (v ?? 0), 0)
  }

  // Totals for current view (weekly = 7 days, daily = 1 day)
  const viewFechas = useMemo(
    () => vista === 'semanal' ? dias.map(toISO) : [toISO(diaActual)],
    [vista, dias, diaActual]
  )
  const viewTotals = useMemo(() => {
    const result: Record<string, number | null> = {}
    for (const sf of SUMMARY_FIELDS) {
      const k = sf.key as string
      let sum: number | null = null
      for (const fecha of viewFechas) {
        for (const t of [1, 2, 3] as TurnoNum[]) {
          const r = data[rKey(fecha, t)]
          const v = r ? (r as unknown as Record<string, unknown>)[k] : undefined
          if (typeof v === 'number') { sum = (sum ?? 0) + v }
        }
      }
      result[k] = sum
    }
    return result
  }, [data, viewFechas])

  // Labels
  const weekLabel = (() => {
    const s = dias[0], e = dias[6]
    if (s.getMonth() === e.getMonth())
      return `${s.getDate()} al ${e.getDate()} de ${MESES[s.getMonth()]} ${s.getFullYear()}`
    return `${s.getDate()} ${MESES[s.getMonth()]} al ${e.getDate()} ${MESES[e.getMonth()]} ${s.getFullYear()}`
  })()

  const diaLabel = (() => {
    const d = diaActual
    const idx = d.getDay() === 0 ? 6 : d.getDay() - 1
    return `${DIAS_SEMANA[idx]}, ${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}`
  })()

  // Render a numeric/text/obs cell
  const renderCell = (fecha: string, t: TurnoNum, fila: typeof FILAS[number]): { cls: string; node: React.ReactNode } => {
    const registered = hasReg(fecha, t)
    const isToday = fecha === todayStr
    let cls = `cp-cell${isToday ? ' cp-cell--today' : ''}`

    if (!registered) {
      return { cls: cls + ' cp-cell--empty', node: <span className="cp-empty">—</span> }
    }

    if (fila.tipo === 'number') {
      const v = getNum(fecha, t, fila.key as string)
      return { cls, node: v != null ? <span>{fmt(v)}</span> : <span style={{color:'var(--text-faint)'}}>0</span> }
    }

    if (fila.tipo === 'text') {
      const v = getStr(fecha, t, fila.key as string)
      return { cls, node: v ? <span>{v}</span> : <span style={{color:'var(--text-faint)'}}>—</span> }
    }

    // obs
    const v     = getStr(fecha, t, 'observaciones')
    const level = obsLevel(v)
    if (level === 'critical') {
      return { cls: cls + ' cp-cell--crit',  node: <span title={v}>{v.slice(0,45)}{v.length>45?'…':''}</span> }
    }
    if (level === 'minor') {
      return { cls: cls + ' cp-cell--minor', node: <span title={v}>{v.slice(0,45)}{v.length>45?'…':''}</span> }
    }
    return { cls, node: <span style={{color:'var(--text-faint)'}}>—</span> }
  }

  const renderTotal = (fecha: string, fila: typeof FILAS[number]): React.ReactNode => {
    const isToday = fecha === todayStr
    const baseCls = `cp-total${isToday ? ' cp-total--today' : ''}`

    if (fila.tipo === 'number') {
      const tot = numTotal(fecha, fila.key as string)
      return <td key="tot" className={baseCls}>{tot != null ? <strong>{fmt(tot, 2)}</strong> : <span className="cp-empty">—</span>}</td>
    }
    if (fila.tipo === 'text') {
      const parts = ([1,2,3] as TurnoNum[]).map(t => getStr(fecha, t, fila.key as string)).filter(Boolean)
      const unique = [...new Set(parts)]
      return <td key="tot" className={baseCls}>{unique.length ? <span style={{fontSize:'0.65rem'}}>{unique.join(' / ')}</span> : <span className="cp-empty">—</span>}</td>
    }
    // obs: count novedades
    const obs  = ([1,2,3] as TurnoNum[]).map(t => getStr(fecha, t, 'observaciones')).filter(Boolean)
    const hasCrit = obs.some(o => obsLevel(o) === 'critical')
    return (
      <td key="tot" className={baseCls}>
        {obs.length > 0
          ? <span style={{fontSize:'0.65rem', color: hasCrit ? 'var(--rose-600)' : 'var(--amber-700)'}}>
              {obs.length} novedad{obs.length > 1 ? 'es' : ''}
            </span>
          : <span className="cp-empty">—</span>
        }
      </td>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Calendario de planta"
        subtitle="Seguimiento diario de producción — turnos, horas de proceso y consumos."
      />
      {!canWrite && <ReadOnlyBanner />}

      {/* Toggle de vista */}
      <div className="cp-view-toggle">
        <button
          className={`cp-toggle-btn${vista === 'semanal' ? ' cp-toggle-btn--active' : ''}`}
          onClick={() => setVista('semanal')}
        >
          Semanal
        </button>
        <button
          className={`cp-toggle-btn${vista === 'diario' ? ' cp-toggle-btn--active' : ''}`}
          onClick={() => setVista('diario')}
        >
          Diario
        </button>
      </div>

      {/* Nav */}
      <div className="cp-nav">
        <Button variant="secondary" size="sm" icon={<ChevronLeft size={16}/>}
          onClick={vista === 'semanal' ? prevWeek : prevDia}>
          Anterior
        </Button>
        <Button variant="secondary" size="sm" icon={<Calendar size={16}/>}
          onClick={vista === 'semanal' ? goTodayWeek : goTodayDia}>
          Hoy
        </Button>
        <span className="cp-week-label">
          {vista === 'semanal' ? `Semana del ${weekLabel}` : diaLabel}
        </span>
        <Button variant="secondary" size="sm" icon={<ChevronRight size={16}/>}
          onClick={vista === 'semanal' ? nextWeek : nextDia}>
          Siguiente
        </Button>
      </div>

      {/* Summary cards */}
      <div className="cp-summary">
        {SUMMARY_FIELDS.map(sf => {
          const val = viewTotals[sf.key as string]
          const display = val === null ? '—' : sf.unit === 'ton'
            ? val.toLocaleString('es-CO')
            : Number.isInteger(val) ? val : val.toFixed(1)
          return (
            <div key={sf.key as string} className="cp-stat">
              <span className="cp-stat__label">{sf.label}</span>
              <span className="cp-stat__value">{display}</span>
              <span className="cp-stat__unit">{sf.unit}</span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="cp-legend">
        <span className="cp-legend-item"><span className="cp-swatch cp-swatch--total"/>Total del día</span>
        <span className="cp-legend-item"><span className="cp-swatch cp-swatch--empty"/>Sin registrar</span>
        <span className="cp-legend-item"><span className="cp-swatch cp-swatch--crit"/>Novedad crítica (paro, daño…)</span>
        <span className="cp-legend-item"><span className="cp-swatch cp-swatch--minor"/>Novedad menor</span>
        <span className="cp-legend-item"><span className="cp-swatch cp-swatch--today"/>◆ Día actual</span>
      </div>

      {/* ── Vista SEMANAL ─────────────────────────────── */}
      {vista === 'semanal' && (
        <div className="cp-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th className="cp-sticky" rowSpan={2}>PROCESO&nbsp;/&nbsp;HORAS</th>
                {dias.map((d, i) => {
                  const fecha   = toISO(d)
                  const isToday = fecha === todayStr
                  return (
                    <th key={fecha} colSpan={4}
                      className={`cp-day-header${isToday ? ' cp-day-header--today' : ''}`}>
                      {DIAS_SEMANA[i]}&nbsp;{d.getDate()}/{String(d.getMonth()+1).padStart(2,'0')}
                      {isToday && <span style={{fontSize:'0.6rem',marginLeft:'0.3rem',opacity:0.75}}>◆</span>}
                    </th>
                  )
                })}
              </tr>
              <tr>
                {dias.map(d => {
                  const fecha   = toISO(d)
                  const isToday = fecha === todayStr
                  return (
                    <React.Fragment key={fecha}>
                      {([1,2,3] as TurnoNum[]).map(t => (
                        <th key={t} className={`cp-subheader${isToday ? ' cp-subheader--today' : ''}`}>T{t}</th>
                      ))}
                      <th className={`cp-subheader cp-total-header${isToday ? ' cp-subheader--today' : ''}`}>Total</th>
                    </React.Fragment>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {FILAS.map(fila => (
                <tr key={fila.key} className={fila.tipo === 'obs' ? 'cp-obs-row' : ''}>
                  <td className="cp-sticky">{fila.label}</td>
                  {dias.map(d => {
                    const fecha = toISO(d)
                    return (
                      <React.Fragment key={fecha}>
                        {([1,2,3] as TurnoNum[]).map(t => {
                          const { cls, node } = renderCell(fecha, t, fila)
                          return (
                            <td key={t} className={cls} onClick={() => canWrite && openCell(fecha, t)}>
                              {node}
                            </td>
                          )
                        })}
                        {renderTotal(fecha, fila)}
                      </React.Fragment>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Vista DIARIA ──────────────────────────────── */}
      {vista === 'diario' && (() => {
        const fecha   = toISO(diaActual)
        const isToday = fecha === todayStr
        return (
          <div className="cp-wrap">
            <table className="cp-table cp-table--daily">
              <thead>
                <tr>
                  <th className="cp-sticky cp-sticky--day">PROCESO&nbsp;/&nbsp;HORAS</th>
                  {([1,2,3] as TurnoNum[]).map(t => (
                    <th key={t} className={`cp-day-header cp-day-header--turno${isToday ? ' cp-day-header--today' : ''}`}>
                      <div className="cp-turno-title">Turno {t}</div>
                      <div className="cp-turno-sub">{TURNO_LABELS[t].split('—')[1].trim()}</div>
                    </th>
                  ))}
                  <th className={`cp-day-header cp-day-header--turno cp-total-header${isToday ? ' cp-day-header--today' : ''}`}>
                    Total del día
                  </th>
                </tr>
              </thead>
              <tbody>
                {FILAS.map(fila => (
                  <tr key={fila.key} className={fila.tipo === 'obs' ? 'cp-obs-row' : ''}>
                    <td className="cp-sticky cp-sticky--day">{fila.label}</td>
                    {([1,2,3] as TurnoNum[]).map(t => {
                      const { cls, node } = renderCell(fecha, t, fila)
                      return (
                        <td key={t} className={`${cls} cp-cell--daily`}
                          onClick={() => canWrite && openCell(fecha, t)}>
                          {node}
                        </td>
                      )
                    })}
                    {renderTotal(fecha, fila)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* ── Edit modal ─────────────────────────────────── */}
      <Modal
        open={editKey !== null}
        title={modalTitle}
        onClose={() => setEditKey(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditKey(null)}>Cancelar</Button>
            <Button onClick={saveCell}>Guardar turno</Button>
          </>
        }
      >
        <div className="grid grid--form">
          <div>
            <label className="field__label">PLANTA</label>
            <select
              className="field__input"
              value={formState.planta}
              onChange={e => setField('planta', e.target.value)}
            >
              <option value="">— Seleccionar —</option>
              {PLANTA_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="field__label">MINA / RESPONSABLE</label>
            <select
              className="field__input"
              value={formState.mina}
              onChange={e => setField('mina', e.target.value)}
            >
              {MINA_OPTS.map(o => <option key={o} value={o}>{o || '— Ninguno —'}</option>)}
            </select>
          </div>
          <Input
            label="TRITURADO (h)"
            type="number" step="0.5" min="0"
            value={formState.triturado}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setField('triturado', e.target.value)}
          />
          <Input
            label="MOLIENDA (h)"
            type="number" step="0.5" min="0"
            value={formState.molienda}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setField('molienda', e.target.value)}
          />
          <Input
            label="FLOTACIÓN (h)"
            type="number" step="0.5" min="0"
            value={formState.flotacion}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setField('flotacion', e.target.value)}
          />
          <Input
            label="FILTRO PRENSA (h)"
            type="number" step="0.5" min="0"
            value={formState.filtroPrensas}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setField('filtroPrensas', e.target.value)}
          />
          <Input
            label="PLANTAS ELÉCTRICAS (h)"
            type="number" step="0.5" min="0"
            value={formState.plantasElectricas}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setField('plantasElectricas', e.target.value)}
          />
          <Input
            label="MATERIAL (ton)"
            type="number" step="1" min="0"
            value={formState.material}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setField('material', e.target.value)}
          />
          <Input
            label="ACPM (galones)"
            type="number" step="0.5" min="0"
            value={formState.acpm}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setField('acpm', e.target.value)}
          />
          <Input
            label="PELOTA DE MOLINO (kg desgaste)"
            type="number" step="0.1" min="0"
            value={formState.pelotaMolino}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setField('pelotaMolino', e.target.value)}
          />
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="field__label">OBSERVACIONES</label>
            <textarea
              className="field__input"
              rows={4}
              placeholder="Novedades del turno: paros, daños, ajustes realizados…"
              value={formState.observaciones}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setField('observaciones', e.target.value)}
              style={{ resize: 'vertical', minHeight: '5rem', fontFamily: 'inherit' }}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
