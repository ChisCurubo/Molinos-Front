# Graph Report - .  (2026-07-18)

## Corpus Check
- 101 files · ~85,546 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 562 nodes · 1387 edges · 21 communities (19 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- UI Components & CRUD Manager
- App Routing & Auth Permissions
- Materiales Context & State
- Data Context & Mock Calculations
- Mock Data & Inventory
- Data Context Core
- Charts & Visualizations
- External Dependencies
- Design Skills & Animation
- Graphify Tooling & Config
- API Client Modules
- TypeScript Configuration
- ERP Domain Documentation
- Viajes Agua & API Fallback
- Build & Vite Config
- HTML Entry Point
- Brand Assets

## God Nodes (most connected - your core abstractions)
1. `formatDate()` - 36 edges
2. `useCanWrite()` - 33 edges
3. `formatCOP()` - 32 edges
4. `Button()` - 29 edges
5. `todayISO()` - 26 edges
6. `useData()` - 25 edges
7. `Card()` - 23 edges
8. `Input()` - 23 edges
9. `KpiTile()` - 23 edges
10. `useAuth()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `ERP Molinos de Colombia Context Document` --semantically_similar_to--> `ERP README`  [INFERRED] [semantically similar]
  CONTEXT.md → README.md
- `Project CLAUDE.md Graphify Instruction` --references--> `Graphify Skill`  [EXTRACTED]
  CLAUDE.md → .claude/skills/graphify/SKILL.md
- `Materials Module (Materiales)` --conceptually_related_to--> `Pending Backend Endpoints`  [INFERRED]
  CONTEXT.md → src/api/ESTADO.md
- `withFallback (fetch + mock fallback)` --shares_data_with--> `Mock Data Source (src/data/mock.ts)`  [INFERRED]
  src/api/ESTADO.md → CONTEXT.md
- `PrestamosTab()` --calls--> `todayISO()`  [EXTRACTED]
  src/pages/finanzas/JulianaPage.tsx → src/utils/format.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Animation Craft Skill Cluster** — _agents_skills_animation_vocabulary_skill_animation_vocabulary, _agents_skills_emil_design_eng_skill_emil_design_eng, _agents_skills_review_animations_skill_review_animations, _agents_skills_review_animations_standards_animation_standards [INFERRED 0.85]
- **Graphify Core Pipeline Concepts** — _claude_skills_graphify_skill_ast_extraction, _claude_skills_graphify_skill_semantic_extraction, _claude_skills_graphify_skill_community_detection, _claude_skills_graphify_references_extraction_spec_extraction_spec [EXTRACTED 1.00]
- **ERP Core Domain Concepts** — context_md_mineral_processing_flow, context_md_lote_concentrado_flow, context_md_business_rules, context_md_mock_data [EXTRACTED 1.00]

## Communities (21 total, 2 thin omitted)

### Community 0 - "UI Components & CRUD Manager"
Cohesion: 0.06
Nodes (45): CardMap, CrudManagerProps, FieldDef, EmptyState(), Badge(), BadgeProps, ESTADO_MAP, EstadoBadge() (+37 more)

### Community 1 - "App Routing & Auth Permissions"
Cohesion: 0.06
Nodes (47): PublicOnly(), ALL_MODULES, canView(), canWrite(), ModuleKey, RoleProfile, ROLES, AccessibilityMenu() (+39 more)

### Community 2 - "Materiales Context & State"
Cohesion: 0.07
Nodes (50): LS_KEYS, lsLoad(), lsSave(), MaterialesContext, MaterialesContextValue, MaterialesProvider(), useMateriales(), usePersisted() (+42 more)

### Community 3 - "Data Context & Mock Calculations"
Cohesion: 0.07
Nodes (48): ColumnDef, CrudManager(), emptyValues(), useData(), calc4x1000(), calc4x1000Inverso(), empleados, PrestamoEmpleadoMock (+40 more)

### Community 4 - "Mock Data & Inventory"
Cohesion: 0.07
Nodes (47): EmpleadoReal, inventarioConcentrado, inventarioCrudo, InventarioLoteRow, inventarioLotesMock, LoteRow, lotesMock, MINA_A_MINERO (+39 more)

### Community 5 - "Data Context Core"
Cohesion: 0.11
Nodes (39): Collection, DataContext, DataContextValue, DataProvider(), DataState, initialState, load(), seedEmpleados (+31 more)

### Community 6 - "Charts & Visualizations"
Cohesion: 0.08
Nodes (29): axisStyle, BarChartCard(), CHART_COLORS, Datum, LineChartCard(), PieChartCard(), PieChartProps, SeriesChartProps (+21 more)

### Community 7 - "External Dependencies"
Cohesion: 0.06
Nodes (35): axios, lucide-react, dependencies, axios, lucide-react, react, react-dom, react-router-dom (+27 more)

### Community 8 - "Design Skills & Animation"
Cohesion: 0.07
Nodes (29): Animation Glossary, Animation Vocabulary Skill, Easing, Reduced Motion, Spring Animation, AI Tells (Forbidden Patterns), Block Library, Design Taste Frontend Skill (+21 more)

### Community 9 - "Graphify Tooling & Config"
Cohesion: 0.08
Nodes (27): Graphify Claude Code Instruction, Graphify Add URL and Watch Folder Reference, Graphify Watch Mode, Graphify Exports Reference, Graphify MCP Server, Graphify Neo4j Export, Confidence Score Rubric, Graphify Extraction Subagent Spec (+19 more)

### Community 10 - "API Client Modules"
Cohesion: 0.13
Nodes (19): authApi, LoginResponse, Catalogos, CatalogosDueno, CatalogosMina, CatalogosMinero, CatalogosZona, getCatalogos() (+11 more)

### Community 11 - "TypeScript Configuration"
Cohesion: 0.08
Nodes (25): DOM, DOM.Iterable, ES2020, src, compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules (+17 more)

### Community 12 - "ERP Domain Documentation"
Cohesion: 0.15
Nodes (14): Viajes de Agua (agua_planta), Critical Business Rules (calculations), ERP Design System (CSS tokens + base classes), ERP Molinos de Colombia Context Document, Lote Concentrado State Machine, Materials Module (Materiales), 5-Stage Mineral Processing Flow, Mock Data Source (src/data/mock.ts) (+6 more)

### Community 13 - "Viajes Agua & API Fallback"
Cohesion: 0.27
Nodes (9): apiFetch(), apiPost(), authHeaders(), aguaMock, AguaRow, duenosVolqueta, emptyForm(), FormState (+1 more)

### Community 14 - "Build & Vite Config"
Cohesion: 0.20
Nodes (9): vite.config.ts, compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict (+1 more)

## Knowledge Gaps
- **221 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+216 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `formatDate()` connect `Materiales Context & State` to `UI Components & CRUD Manager`, `App Routing & Auth Permissions`, `Data Context & Mock Calculations`, `Mock Data & Inventory`, `Charts & Visualizations`, `Viajes Agua & API Fallback`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `Button()` connect `UI Components & CRUD Manager` to `App Routing & Auth Permissions`, `Materiales Context & State`, `Data Context & Mock Calculations`, `Mock Data & Inventory`, `Charts & Visualizations`, `Viajes Agua & API Fallback`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `formatCOP()` connect `Data Context & Mock Calculations` to `UI Components & CRUD Manager`, `App Routing & Auth Permissions`, `Materiales Context & State`, `Mock Data & Inventory`, `Charts & Visualizations`, `Viajes Agua & API Fallback`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _221 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI Components & CRUD Manager` be split into smaller, more focused modules?**
  _Cohesion score 0.06433566433566433 - nodes in this community are weakly interconnected._
- **Should `App Routing & Auth Permissions` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `Materiales Context & State` be split into smaller, more focused modules?**
  _Cohesion score 0.07138535995160314 - nodes in this community are weakly interconnected._