/**
 * Zenith Background Worker — Pi Extension
 *
 * Zenith is not a separate process. It is a background worker that lives
 * inside Pi's event loop, keeping agents on track by enforcing the
 * 20 Eternal Pillars throughout the full construction lifecycle.
 *
 * Architecture:
 *   - before_agent_start  → Injects Eternal Pillars into the system prompt
 *   - tool_call           → Hard-blocks writes to cryptographically sealed modules
 *   - turn_end            → Unified auditor: syncs state, drift scan, and termination
 *   - session_start       → Loads manifest & state from .zenith/ directory
 *   - session_shutdown    → Persists updated state to .zenith/state.json
 */

import type {
	ExtensionAPI,
	ExtensionContext,
	SessionStartEvent,
	BeforeAgentStartEvent,
	BeforeAgentStartEventResult,
	TurnEndEvent,
	ToolCallEvent,
	ToolCallEventResult,
	InputEvent,
	InputEventResult,
	EditToolCallEvent,
	WriteToolCallEvent,
} from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ZenithModule {
	name: string;
	description: string;
	contracts: string[];
	status: "planned" | "red" | "green" | "sealed";
	sealedHash?: string;   // SHA-256 of the sealed file content
	paths: string[];       // Paths this module owns
	dependencies: string[]; // Names of modules this module depends on (DAG edges)
	wave: number;          // Derived from DAG — which construction wave this belongs to
	language?: string;     // e.g. "typescript", "python"
	logicMap?: Array<{ intent: string; function: string; file: string; constraints: string[] }>;
}

// All valid SDLC phases — maps to a prompt file name in .pi/prompts/
type SdlcPhase =
	| "brainstorm"
	| "takeover"
	| "architecture-first"
	| "audit"
	| "performance-contract"
	| "tdd-red"
	| "tdd-green"
	| "self-heal"
	| "pr-review"
	| "security-review"
	| "integration-audit"
	| "observability-scaffold"
	| "dependency-governance"
	| "release-protocol"
	| "retrospective"
	| "architecture-architect"
	| "tdd-workflow"
	| "code-reviewer"
	| "self-improving-agent"
	| "zenith-discipline"
	| "tech-debt-tracker"
	| null; // null = pillars only, no phase-specific prompt

interface TechDebtItem {
	name: string;
	description: string;
	type: string;
	affected_module: string;
	violated_pillar: number;
	severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
	acceptance_criteria: string;
}

// Industrial grade controls which pillars are enforced and which SOPs are injected.
// prototype       — Pillars 1,4,5,10,11 only. No observability, deployability, or operability requirements.
// production      — All 19 Pillars active. Observability and deployability are required.
// mission-critical — All 19 Pillars + hardening overlays (MFA, audit logs, multi-tenancy, resilience contracts).
type IndustrialGrade = "prototype" | "production" | "mission-critical";

interface ZenithState {
	projectName: string;
	currentWave: number;
	currentPhase: SdlcPhase;
	industrialGrade: IndustrialGrade;
	modules: ZenithModule[];
	pillarViolations: string[];
	lastAuditAt: string | null;
	dagCycles: string[];    // Any detected cycles — non-empty = invalid DAG
	backlog: TechDebtItem[]; // Tech debt and wave N+1 tasks from retrospectives
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

// Grade-aware pillar text. Prototype suppresses heavy pillars to avoid Parsimony violations.
// Mission-critical overlays hardening requirements on top of all 19.
function buildEternalPillars(grade: IndustrialGrade): string {
	const gradeLabel: Record<IndustrialGrade, string> = {
		"prototype": "PROTOTYPE (Pillars 1,4,5,10,11 enforced — Observability/Deployability/Operability are advisory only)",
		"production": "PRODUCTION (All 19 Pillars enforced)",
		"mission-critical": "MISSION-CRITICAL (All 19 Pillars enforced + Hardening Overlays: MFA, audit logs, multi-tenancy, resilience contracts)",
	};

	const pillar17 = grade === "prototype"
		? "17. Observability           — ADVISORY: expose logs where practical. Not required for prototype."
		: "17. Observability           — Every module must expose logs, metrics, and health.";

	const pillar18 = grade === "prototype"
		? "18. Deployability           — ADVISORY: containerization not required for prototype."
		: "18. Deployability           — Containerized, environment-parity builds only.";

	const pillar19 = grade === "prototype"
		? "19. Operability             — ADVISORY: graceful shutdown preferred but not enforced for prototype."
		: "19. Operability             — Graceful shutdown, secret management, resilience.";

	const hardeningOverlay = grade === "mission-critical" ? `
<zenith_hardening_overlay>
MISSION-CRITICAL HARDENING — Active for this project:
  - Authentication: MFA required. No single-factor auth flows permitted.
  - Sessions: session_version, rotation-on-privilege-escalation, absolute timeout.
  - Multi-tenancy: all data queries must be scoped to tenant context. No cross-tenant leakage.
  - Audit Logs: every state mutation must emit a structured audit event.
  - Resilience: every external call must have timeout, retry with backoff, and circuit breaker.
  - Secrets: no secrets in environment variables. Use a secrets manager (Vault, AWS SM, GCP SM).
</zenith_hardening_overlay>` : "";

	const qualityMandate = grade === "prototype"
		? "QUALITY MANDATE: This project is a POC / MVP. Focus on velocity and parsimony over extreme resilience."
		: "QUALITY MANDATE: Every implementation MUST be ENTERPRISE GRADE. No shortcuts, no hacky workarounds. You are building for scale and longevity.";

	const nativeToolsGuide = `
<zenith_native_tools_guide>
As the Zenith Manager, you are the ORCHESTRATOR. You are strictly FORBIDDEN from performing direct implementation, heavy analysis, or codebase mapping in the main session.
INDUSTRIAL SUBAGENT MANDATE:
- subagent: Delegate all implementation (TDD Red/Green), mapping (Takeover), and analysis (Audit) to background workers.
  *   PARALLEL DISPATCH: Use the 'tasks' array to dispatch implementation for ALL independent modules in the current Wave simultaneously.
  *   ISOLATION PROTOCOL: Each subagent MUST work on its own dedicated feature branch (e.g., 'zenith/feat/module-name').
  *   Command the subagent to: "Create branch X, implement module Y, and return summary."
- handoff: Use when the current session is too long. Generates a focused prompt for a new session without losing critical architectural context.
- /zenith-check: Run a discipline audit on recent changes.
- /zenith-plan: Visualize the DAG and wave schedule.
The main session exists ONLY for manifest management, high-level architectural decisions, and final module SEALING.
</zenith_native_tools_guide>
`;

	return `
<zenith_eternal_pillars>
You are operating under the Zenith Software Factory protocol.
Industrial Grade: ${gradeLabel[grade]}
${qualityMandate}
${nativeToolsGuide}

The following 20 Eternal Pillars are active constraints on every action:

1.  Deterministic Path      — Follow the DAG. Never skip a wave.
2.  Replaceability          — Every module has strict versioned interface contracts.
3.  Self-Healing            — On failure, diagnose root cause before any fix.
4.  Self-Documenting        — The manifest (.zenith/) is the sole source of truth. REAL-TIME CODE GENOME SYNC REQUIRED: Any new function or logic change MUST be reflected in the logicMap immediately.
5.  Zero-Drift              — Sealed modules are immutable. Never edit them.
6.  Economics-First         — Adopt proven OSS before building custom.
7.  Self-Improvement        — Detect and flag technical debt automatically.
8.  Consistency             — Same spec = identical reproducible output.
9.  Traceability            — Every file, every function maps back to exactly one module and one wave in the Code Genome logicMap.
10. DRY                     — Zero logic duplication across modules.
11. Parsimony               — Simplest viable design. No speculative complexity.
12. Repeatability           — Builds are 100% idempotent.
13. Immutability            — Sealed modules require a version increment to change.
14. Isolation               — Strict module boundaries. Every module MUST be built on a dedicated git branch. No cross-module state bleed.
15. Preservation            — Maintain full audit logs and compliance artifacts.
16. Verification            — Contract + test validation before any integration.
${pillar17}
${pillar18}
${pillar19}
20. Zero Trust              — Assume every action is destructive. Principle of Least Privilege (PoLP) enforced.
${hardeningOverlay}
<zenith_execution_guardrail>
EXECUTION STABILITY — This is a hard constraint:
  - NO STUBS OR PLACEHOLDERS: Forbid the use of \`// ... rest of code\`, \`# TODO\`, or \`pass\`. Every line of production logic, error handling, and boilerplate must be fully realized.
  - ZERO-SHORTCUT INTEGRITY (ANTI-LAZY): You are strictly forbidden from "saving tokens" or omitting context. Every edit must include: (1) Precise imports, (2) Full type annotations, (3) Structured docstrings, and (4) Comprehensive error boundaries. Completeness is the ONLY metric of success.
  - SURGICAL SPLITTING & TRANSPLANT: When moving code, use surgical edits to extract and transplant logic. NEVER perform a whole-file rewrite to move a function. Preserve the historical integrity of all surrounding code, comments, and formatting.
  - EDIT TOOL INTEGRITY: When using the 'edit' tool, you MUST use the properties 'oldText' (exact match) and 'newText' (replacement). Never use 'replacement', 'content', or 'new_string' inside the edits array.
  - AUTONOMOUS DRIVER PROTOCOL: You are the proactive owner of the Wave. Once a task is initiated, execute the following loop autonomously: [DISPATCH PARALLEL SUBAGENTS -> REGRESSION VERIFY -> SEAL -> NEXT]. 
  - REGRESSION GUARD: Success is NOT defined by the new tests passing. Success is defined as [NEW TESTS PASS] + [ALL PRE-EXISTING TESTS PASS]. You are strictly forbidden from "fixing" one part of a module by weakening another.
  - WAVE VELOCITY: If multiple modules in a Wave are independent, you are MANDATED to use parallel 'subagent' tasks. Never build sequentially if parallelism is possible under Pillar 1 (DAG).
  - SHADOW ARTIFACTS: All temporary fix scripts, migration patches, or refactor tools MUST be created within the '.pi/' shadows. Keep the project root and source tree production-clean at all times.
  - PRESERVE EXISTING LOGIC: Maintain full backward compatibility. Do not delete or modify unrelated code unless it is a documented part of the refactor wave.
</zenith_execution_guardrail>

<zenith_naming_guardrail>
NAMING STABILITY — This is a hard constraint:
  - DO NOT rename variables, functions, classes, or files unless it is an explicit requirement
    stated in the task, a contract fix, or a critical clarity issue (e.g., a name that is
    actively misleading or causes a collision).
  - Cosmetic renames (e.g., "camelCase to snake_case", "more descriptive names") are FORBIDDEN
    unless the contract specifies them.
  - If you believe a rename is necessary, you MUST state the reason explicitly BEFORE making
    the change. The reason must be one of:
      * CONTRACT: The contract or test specifies this exact name.
      * COLLISION: The existing name conflicts with a stdlib or dependency identifier.
      * CORRECTNESS: The existing name is factually wrong (e.g., get_user that deletes users).
  - Any rename not justified by one of the above three categories is a Pillar 10 (DRY) and
    Pillar 15 (Preservation) violation and will be flagged as DRIFT.
</zenith_naming_guardrail>

Current SDLC Phase: RED → Write failing tests first. GREEN → Implement to pass. SEAL → Lock the module.
Zenith advisory is active. Drift violations will be reported after each turn.
</zenith_eternal_pillars>
`;
}

const STATE_FILE = ".zenith/state.json";
const DEFAULT_STATE: ZenithState = {
	projectName: path.basename(process.cwd()),
	currentWave: 1,
	currentPhase: null,
	industrialGrade: "production",
	modules: [],
	pillarViolations: [],
	dagCycles: [],
	backlog: [],
	lastAuditAt: null,
};

// ─────────────────────────────────────────────────────────────
// Phase Detection — maps regex patterns to SDLC phases
// The FIRST matching rule wins (order = priority).
// ─────────────────────────────────────────────────────────────
const PHASE_SIGNALS: Array<{ pattern: RegExp; phase: SdlcPhase }> = [
	// Self-heal must come before tdd-green (failure is more specific)
	{ pattern: /self.?heal|fix.*fail|diagnose.*fail|repair.*test|test.*fail/i, phase: "self-heal" },
	// Security before audit (more specific)
	{ pattern: /security|owasp|cve|injection|xss|sqli|secret.*scan|hardcoded/i, phase: "security-review" },
	// Dependency before release
	{ pattern: /dependenc|npm audit|pip.audit|package.*vuln|lockfile/i, phase: "dependency-governance" },
	// Integration before audit
	{ pattern: /integrat.*audit|post.merge|merge.*module|contract.*valid/i, phase: "integration-audit" },
	{ pattern: /takeover|assimilate|scan.*codebase|map.*dag/i, phase: "takeover" },
	{ pattern: /brainstorm|ideate|explore.*design|let.*think|discuss.*system/i, phase: "brainstorm" },
	{ pattern: /architect|system design|design.*system|topology|bounded context/i, phase: "architecture-first" },
	{ pattern: /audit.*architect|review.*architect|pillar.*check|drift.*check/i, phase: "audit" },
	{ pattern: /performance|sla|latency|throughput|benchmark|p99|p50/i, phase: "performance-contract" },
	{ pattern: /write.*test|failing.*test|tdd.*red|red.*phase|test.*first/i, phase: "tdd-red" },
	{ pattern: /implement|make.*test.*pass|green.*phase|tdd.*green|build.*module/i, phase: "tdd-green" },
	{ pattern: /observabilit|logging.*setup|metrics.*endpoint|health.*check.*impl/i, phase: "observability-scaffold" },
	{ pattern: /code.*review|pr.*review|review.*diff|review.*change/i, phase: "pr-review" },
	{ pattern: /release|deploy|version.*bump|changelog|rollback|semver/i, phase: "release-protocol" },
	{ pattern: /retrospective|retro|post.?mortem|production.*signal|wave.*done/i, phase: "retrospective" },
	{ pattern: /decision.*record|adr|which.*database|which.*stack|architect.*design/i, phase: "architecture-architect" },
	{ pattern: /tdd.*guide|tdd.*workflow|mutation.*test|coverage.*gap/i, phase: "tdd-workflow" },
	{ pattern: /quality.*audit|structural.*check|complexity.*check|code.*reviewer/i, phase: "code-reviewer" },
	{ pattern: /self.*improv|learn.*pattern|promote.*rule|graduate.*pattern|memory.*analyst/i, phase: "self-improving-agent" },
	{ pattern: /zenith|discipline|surgical.*change|simplicity.*first|overcomplicat|anti.*bloat|zenith.*check|audit.*discipline/i, phase: "zenith-discipline" },
	{ pattern: /tech.*debt|debt.*tracker|backlog.*audit|score.*debt|catalog.*debt/i, phase: "tech-debt-tracker" },
];

function detectPhaseFromInput(text: string): SdlcPhase | undefined {
	for (const { pattern, phase } of PHASE_SIGNALS) {
		if (pattern.test(text)) return phase;
	}
	return undefined; // No match — keep current phase
}

function loadPromptFile(promptsDir: string, phase: SdlcPhase): string {
	if (!phase) return "";
	const filePath = path.join(promptsDir, `${phase}.md`);
	if (!fs.existsSync(filePath)) return "";
	try {
		const raw = fs.readFileSync(filePath, "utf8");
		// Strip the YAML frontmatter (--- ... ---) so only the prompt body is injected
		return raw.replace(/^---[\s\S]*?---\n?/, "").trim();
	} catch {
		return "";
	}
}

// ─────────────────────────────────────────────────────────────
// DAG Engine — Topological Sort, Cycle Detection, Wave Assignment
// ─────────────────────────────────────────────────────────────

/**
 * Derives the construction wave for each module using Kahn's algorithm.
 * Wave 1 = modules with no dependencies.
 * Wave N = modules whose deepest dependency chain reaches N-1.
 * Returns: { waveMap, cycles } where cycles lists any detected cycles.
 */
function computeDAG(modules: ZenithModule[]): {
	waveMap: Map<string, number>;
	cycles: string[];
} {
	const names = new Set(modules.map((m) => m.name));
	const inDegree = new Map<string, number>();
	const adjList = new Map<string, string[]>(); // name → dependents (reverse edges)

	for (const m of modules) {
		inDegree.set(m.name, inDegree.get(m.name) ?? 0);
		adjList.set(m.name, adjList.get(m.name) ?? []);
		for (const dep of m.dependencies) {
			if (!names.has(dep)) continue; // ignore external deps
			inDegree.set(m.name, (inDegree.get(m.name) ?? 0) + 1);
			const deps = adjList.get(dep) ?? [];
			deps.push(m.name);
			adjList.set(dep, deps);
		}
	}

	// Kahn's BFS topological sort
	const queue: string[] = [];
	const waveMap = new Map<string, number>();

	for (const [name, deg] of inDegree.entries()) {
		if (deg === 0) {
			queue.push(name);
			waveMap.set(name, 1);
		}
	}

	let processed = 0;
	while (queue.length > 0) {
		const node = queue.shift()!;
		processed++;
		const currentWave = waveMap.get(node) ?? 1;
		for (const dependent of (adjList.get(node) ?? [])) {
			const newDeg = (inDegree.get(dependent) ?? 1) - 1;
			inDegree.set(dependent, newDeg);
			// Wave = max(current wave of all resolved deps) + 1
			waveMap.set(dependent, Math.max(waveMap.get(dependent) ?? 0, currentWave + 1));
			if (newDeg === 0) queue.push(dependent);
		}
	}

	// Any module not processed = part of a cycle
	const cycles: string[] = [];
	if (processed < modules.length) {
		for (const m of modules) {
			if (!waveMap.has(m.name)) cycles.push(m.name);
		}
	}

	return { waveMap, cycles };
}

/** Recomputes wave assignments for all modules and updates state in place. */
function refreshDAG(state: ZenithState): void {
	const { waveMap, cycles } = computeDAG(state.modules);
	for (const m of state.modules) {
		m.wave = waveMap.get(m.name) ?? 1;
	}
	state.dagCycles = cycles;
	// The active wave = lowest wave with unsealed modules
	const unfinished = state.modules.filter((m) => m.status !== "sealed");
	state.currentWave = unfinished.length > 0
		? Math.min(...unfinished.map((m) => m.wave))
		: state.currentWave;
}

/** Renders the DAG as a Mermaid flowchart for system prompt injection. */
function renderMermaidDAG(modules: ZenithModule[]): string {
	if (modules.length === 0) return "";
	const lines = ["graph TD"];
	const statusIcon: Record<string, string> = {
		planned: "⬜",
		red: "🔴",
		green: "🟢",
		sealed: "🔒",
	};
	for (const m of modules) {
		const icon = statusIcon[m.status] ?? "⬜";
		const label = `${icon} ${m.name} [W${m.wave}]`;
		lines.push(`  ${m.name}["${label}"]`);
	}
	for (const m of modules) {
		for (const dep of m.dependencies) {
			lines.push(`  ${dep} --> ${m.name}`);
		}
	}
	return lines.join("\n");
}

/** Checks whether a module's dependencies are all sealed (ready to build). */
function areDepsSealed(module: ZenithModule, state: ZenithState): boolean {
	return module.dependencies.every((depName) => {
		const dep = state.modules.find((m) => m.name === depName);
		return dep?.status === "sealed";
	});
}

// ─────────────────────────────────────────────────────────────
// State Management
// ─────────────────────────────────────────────────────────────


function loadState(cwd: string): ZenithState {
	const stateFile = path.join(cwd, STATE_FILE);
	if (!fs.existsSync(stateFile)) return { ...DEFAULT_STATE, projectName: path.basename(cwd) };
	try {
		const parsed = JSON.parse(fs.readFileSync(stateFile, "utf8")) as Partial<ZenithState>;
		const validGrades: IndustrialGrade[] = ["prototype", "production", "mission-critical"];
		return {
			...DEFAULT_STATE,
			...parsed,
			projectName: parsed.projectName || path.basename(cwd),
			industrialGrade: validGrades.includes(parsed.industrialGrade as IndustrialGrade)
				? parsed.industrialGrade as IndustrialGrade
				: "production",
			modules: Array.isArray(parsed.modules) ? parsed.modules : [],
			backlog: Array.isArray(parsed.backlog) ? parsed.backlog : [],
			pillarViolations: Array.isArray(parsed.pillarViolations) ? parsed.pillarViolations : [],
			dagCycles: Array.isArray(parsed.dagCycles) ? parsed.dagCycles : [],
		};
	} catch (e) {
		// DANGER: Do not return DEFAULT_STATE on JSON parse error, or it wipes the user's project
		// on the next saveState. We must throw an error.
		throw new Error(`Zenith 🛑 CRITICAL: '.zenith/state.json' is corrupted and cannot be parsed. Fix the JSON syntax error manually to prevent data loss. Error: ${e}`);
	}
}

function saveState(cwd: string, state: ZenithState): void {
	const zenithDir = path.join(cwd, ".zenith");
	if (!fs.existsSync(zenithDir)) fs.mkdirSync(zenithDir, { recursive: true });
	fs.writeFileSync(path.join(cwd, STATE_FILE), JSON.stringify(state, null, 2), "utf8");
}

function hashFile(filePath: string, depth = 0): string | null {
	// Optimization: hard limit for recursive depth to prevent audit lag
	if (depth > 10) return "max-depth-reached";

	try {
		const stat = fs.statSync(filePath);
		if (stat.isFile()) {
			const content = fs.readFileSync(filePath);
			return crypto.createHash("sha256").update(content).digest("hex");
		}
		if (stat.isDirectory()) {
			// Skip standard ignore folders + hidden folders (like .git, .pi, .zenith)
			const baseName = path.basename(filePath);
			if (baseName.startsWith(".") && baseName !== ".") return null;

			const ignorePatterns = [/^node_modules$/, /^dist$/, /^build$/, /^__pycache__$/, /^target$/, /^venv$/, /^\.venv$/];
			if (ignorePatterns.some(p => p.test(baseName))) return null;

			const entries = fs.readdirSync(filePath).sort();
			const hash = crypto.createHash("sha256");
			let hasValidEntry = false;

			for (const entry of entries) {
				const entryPath = path.join(filePath, entry);
				const entryHash = hashFile(entryPath, depth + 1);
				if (entryHash) {
					hash.update(entry + ":" + entryHash);
					hasValidEntry = true;
				}
			}
			return hasValidEntry ? hash.digest("hex") : null;
		}
		return null;
	} catch {
		return null;
	}
}

// ─────────────────────────────────────────────────────────────
// Drift Detection
// ─────────────────────────────────────────────────────────────

function detectDrift(state: ZenithState, cwd: string): string[] {
	const violations: string[] = [];

	for (const mod of state.modules) {
		if (mod.status !== "sealed" || !mod.sealedHash) continue;

		for (const modPath of mod.paths) {
			const fullPath = path.join(cwd, modPath);
			const currentHash = hashFile(fullPath);

			if (currentHash && currentHash !== mod.sealedHash) {
				violations.push(
					`Pillar 5 (Zero-Drift): Module '${mod.name}' at '${modPath}' has been modified after sealing. ` +
					`Expected hash: ${mod.sealedHash.slice(0, 8)}… Got: ${currentHash.slice(0, 8)}…`
				);
			}
		}
	}

	return violations;
}

function findOwningModule(filePath: string, state: ZenithState): ZenithModule | null {
	if (!state.modules) return null;
	for (const mod of state.modules) {
		if (mod.paths?.some((p) => filePath.includes(p))) return mod;
	}
	return null;
}

// ─────────────────────────────────────────────────────────────
// Extension Entry Point
// ─────────────────────────────────────────────────────────────

export default function zenithWorker(pi: ExtensionAPI) {
	let state: ZenithState = DEFAULT_STATE;
	let cwd = process.cwd();

	// ── 1. Session Start: Load manifest & state ──────────────
	pi.on("session_start", async (_event: SessionStartEvent, ctx: ExtensionContext) => {
		cwd = process.cwd();
		state = loadState(cwd);

		const moduleCount = state.modules.length;
		const sealedCount = state.modules.filter((m) => m.status === "sealed").length;

		if (moduleCount > 0) {
			ctx.ui.notify(
				`Zenith ⚡ Loaded: ${moduleCount} modules · ${sealedCount} sealed · Wave ${state.currentWave} · Grade: ${state.industrialGrade}`,
				"info"
			);
		} else {
			// No manifest yet — Zenith is dormant but monitoring
			ctx.ui.notify("Zenith ⚡ Active — no manifest found. Run /zenith-init to begin.", "info");
		}
	});
	// ── 2. Injection Hook: Inject Pillars & Set Execution Mode ──────
	pi.on("before_agent_start", async (event: BeforeAgentStartEvent): Promise<BeforeAgentStartEventResult | void> => {
		// Only activate when .zenith/ exists or a manifest is being built
		if (state.modules.length === 0 && !fs.existsSync(path.join(cwd, ".zenith"))) {
			return undefined;
		}

		// Manifest context block
		const moduleContext = state.modules.length > 0
			? `\n<zenith_current_manifest>\nProject: ${state.projectName} | Wave: ${state.currentWave} | Phase: ${state.currentPhase ?? "none"}\n` +
			state.modules.map((m) => `  - [${m.status.toUpperCase()}] ${m.name}: ${m.description}`).join("\n") +
			"\n</zenith_current_manifest>"
			: "";

		// Load the phase-specific prompt and inject it AFTER the pillars.
		// The agent has the full industrial SOP for the current phase on every turn —
		// no manual /prompt invocation needed.
		// Look for prompts locally first (if running inside pi-mono),
		// otherwise fallback to the absolute path of the global prompts directory.
		const localPrompts = path.join(cwd, ".pi", "prompts");
		const globalPrompts = "/Users/visvasis/Home/Zenith IDE/cloned_repos/pi-mono/.pi/prompts";
		const promptsDir = fs.existsSync(localPrompts) ? localPrompts : globalPrompts;

		// 1. Always inject Zenith Discipline (The Core Rules)
		const disciplinePrompt = loadPromptFile(promptsDir, "zenith-discipline");
		const disciplineBlock = disciplinePrompt
			? `\n\n<zenith_discipline_sop>\n${disciplinePrompt}\n</zenith_discipline_sop>`
			: "";

		// 2. Inject active SDLC phase prompt (The Specialized Task)
		const phasePrompt = state.currentPhase !== "zenith-discipline"
			? loadPromptFile(promptsDir, state.currentPhase)
			: "";
		const phaseBlock = phasePrompt
			? `\n\n<zenith_active_phase_sop phase="${state.currentPhase}">\n${phasePrompt}\n</zenith_active_phase_sop>`
			: "";

		return {
			systemPrompt: buildEternalPillars(state.industrialGrade) + moduleContext + disciplineBlock + phaseBlock,
		};
	});

	// ── 3. Unified Industrial Auditor & Termination Controller ──────
	pi.on("turn_end", async (event: TurnEndEvent, ctx: ExtensionContext) => {
		const advisories: string[] = [];

		// ── 3.0 Sync state from disk in case the agent edited .zenith/state.json directly ──
		if (fs.existsSync(path.join(cwd, ".zenith", "state.json"))) {
			try {
				const diskState = loadState(cwd);
				// If the agent added modules or changed dependencies, we must recompute the DAG
				if (JSON.stringify(diskState.modules) !== JSON.stringify(state.modules)) {
					state = diskState;
					refreshDAG(state);
					saveState(cwd, state);

					if (state.dagCycles.length > 0 && ctx.hasUI) {
						ctx.ui.notify(`Zenith 🛑 CRITICAL: DAG Cycle detected in manifest: ${state.dagCycles.join(", ")}`, "error");
						advisories.push(`🛑 **CRITICAL DAG VIOLATION** (Pillar 1): A circular dependency was detected involving: ${state.dagCycles.join(", ")}. You must break this cycle immediately.`);
					}
				} else {
					state = diskState; // just sync phase/wave updates
				}
			} catch (e) {
				// Ignore parse errors mid-edit
			}
		}

		// ── 3.1 Graded Drift Audit (Surgical Scan) ────────────────────
		// Only run drift audit if a tool that can modify files was called this turn
		const canModify = event.toolResults?.some(tr => ["write", "edit", "bash"].includes(tr.toolName));
		if (canModify && state.modules.some(m => m.status === "sealed")) {
			const drift = detectDrift(state, cwd);
			if (drift.length > 0) {
				state.pillarViolations = drift;
				state.lastAuditAt = new Date().toISOString();
				saveState(cwd, state);
				advisories.push(
					`🚨 **Zenith Drift Advisory** — ${drift.length} sealed module violation(s):\n` +
					drift.map((v) => `- ${v}`).join("\n") +
					`\nPillar 3: Diagnose root cause and revert unauthorized changes before proceeding.`
				);
			}
		}

		// ── 3.2 Dependency Governance: scan for new lockfile changes ──
		const pkgFiles = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml",
			"requirements.txt", "Pipfile.lock", "poetry.lock", "go.sum"];
		const changedDeps = pkgFiles.filter((f) => {
			const fp = path.join(cwd, f);
			if (!fs.existsSync(fp)) return false;
			const stat = fs.statSync(fp);
			// Flag if modified within the last 60 seconds (this turn)
			return (Date.now() - stat.mtimeMs) < 60_000;
		});
		if (changedDeps.length > 0 && ctx.hasUI) {
			ctx.ui.notify(
				`Zenith 📦 Dependency Governance: ${changedDeps.join(", ")} changed this turn. ` +
				`Run /zenith-audit-deps or use the zenith-dependency-governance prompt before committing.`,
				"warning"
			);
		}

		// ── 3.3 Observability completeness check on new green modules ──
		const newlyGreen = state.modules.filter((m) => m.status === "green");
		if (newlyGreen.length > 0) {
			const missingObs = newlyGreen.filter((m) => {
				// Check if the module has health/metrics files scaffolded
				return !m.paths.some((p) => {
					const full = path.join(cwd, p);
					return fs.existsSync(full) &&
						(fs.readFileSync(full, "utf8").includes("health") ||
							fs.readFileSync(full, "utf8").includes("/metrics"));
				});
			});
			if (missingObs.length > 0 && ctx.hasUI) {
				ctx.ui.notify(
					`Zenith 📊 Pillar 17: ${missingObs.map((m) => m.name).join(", ")} ` +
					`missing observability scaffold. Use the zenith-observability-scaffold prompt.`,
					"warning"
				);
			}
		}

		if (advisories.length > 0) {
			pi.sendUserMessage(advisories.join("\n\n"), { deliverAs: "followUp" });
		}

		// ── 3.4 Autonomous Termination (SEAL Protocol) ───────────────
		// Bulletproof Correlation: Find the 'zenith-seal' call in the assistant message
		const assistantMessage = event.message;
		if (assistantMessage && assistantMessage.role === "assistant") {
			const content = assistantMessage.content as Array<{ type: string; toolCall?: { name?: string; arguments?: { CommandLine?: string }; id?: string } }>;
			const sealCall = content?.find((block) =>
				block.type === "toolCall" &&
				block.toolCall?.name === "run_command" &&
				block.toolCall?.arguments?.CommandLine?.includes("zenith-seal")
			);

			if (sealCall?.toolCall?.id) {
				const sealResult = event.toolResults?.find(
					(tr) => tr.toolCallId === sealCall.toolCall!.id && !tr.isError
				);
				if (sealResult) {
					ctx.shutdown();
					return;
				}
			}
		}
	});

	// ── 4. Intent Detection: Auto-detect SDLC phase from user message ──────────
	pi.on("input", async (event: InputEvent, ctx: ExtensionContext): Promise<InputEventResult | void> => {
		if (!fs.existsSync(path.join(cwd, ".zenith"))) return { action: "continue" };

		const detectedPhase = detectPhaseFromInput(event.text);
		if (detectedPhase && detectedPhase !== state.currentPhase) {
			state.currentPhase = detectedPhase;
			saveState(cwd, state);
			if (ctx.hasUI) {
				ctx.ui.notify(
					`Zenith ⚡ Phase → ${detectedPhase} (SOP injected into system prompt)`,
					"info"
				);
			}
		}
		return { action: "continue" };
	});

	// ── 5. Tool Guard: Hard-block sealed modules + graded rename enforcement ──
	pi.on("tool_call", async (event: ToolCallEvent, ctx: ExtensionContext): Promise<ToolCallEventResult | void> => {
		// ── 5a. Rename detection (edit, write, bash) ──────────────────
		if (isToolCallEventType("bash", event) || isToolCallEventType("edit", event) || isToolCallEventType("write", event)) {
			const content = isToolCallEventType("bash", event)
				? (event.input.command ?? "")
				: isToolCallEventType("edit", event)
					? event.input.edits.map((e) => e.oldText + " " + e.newText).join(" ")
					: (event.input.content ?? "");

			// Heuristics: detect bulk rename patterns (sed -i, mv, large symbol replacements)
			const RENAME_PATTERNS = [
				/\bsed\s+-i.*s\/[\w]+\/[\w]+\//i,  // sed -i 's/old/new/'
				/\bmv\s+[\w./]+\s+[\w./]+/i,        // mv old_file new_file
				/rename\s*\([^)]+,[^)]+\)/i,        // os.rename() calls
				/\.replace\(\/(\w{4,})\//i,         // .replace(/symbol/) in content
			];

			const isRenameOp = RENAME_PATTERNS.some((p) => p.test(content));
			if (isRenameOp) {
				// For bash renames, check if the target path touches a sealed module.
				// If so: hard block. If not: advisory only.
				const targetPath = isToolCallEventType("bash", event)
					? event.input.command ?? ""
					: (event as EditToolCallEvent | WriteToolCallEvent).input.path ?? "";

				const owningModule = findOwningModule(targetPath, state);
				if (owningModule?.status === "sealed") {
					if (ctx.hasUI) {
						ctx.ui.notify(
							`Zenith 🛑 BLOCKED: Rename in sealed module '${owningModule.name}' (Pillar 14 — Naming Stability).`,
							"error"
						);
					}
					return {
						block: true,
						reason:
							`Zenith Enforcement — Pillar 14 (Naming Stability) & Pillar 5 (Zero-Drift): ` +
							`A rename was detected targeting sealed module '${owningModule.name}'. ` +
							`Rename operations on sealed modules are forbidden. ` +
							`Unseal the module first with /zenith-unseal ${owningModule.name}, justify the rename ` +
							`(CONTRACT | COLLISION | CORRECTNESS), then re-seal after.`,
					};
				}

				// Unsealed module — advisory only
				if (ctx.hasUI) {
					ctx.ui.notify(
						"Zenith ⚠️  Naming Guardrail: Rename detected. " +
						"Verify this satisfies CONTRACT, COLLISION, or CORRECTNESS before proceeding.",
						"warning"
					);
				}
			}
		}

		if (!isToolCallEventType("write", event) && !isToolCallEventType("edit", event)) return undefined;

		const filePath = event.input.path;
		if (!filePath) return undefined;

		const owningModule = findOwningModule(filePath, state);
		if (!owningModule) {
			// Zero Trust Enforcement (Pillar 20): All edits must belong to a registered module genome
			if (state.industrialGrade !== "prototype") {
				if (ctx.hasUI) {
					ctx.ui.notify(
						`Zenith 🛑 ZERO TRUST BLOCK: '${filePath}' is not part of any registered module.`,
						"error"
					);
				}
				return {
					block: true,
					reason:
						`Zenith Enforcement — Pillar 20 (Zero Trust): You attempted to modify a path that is not owned by any registered module in the manifest. ` +
						`In Production/Mission-Critical grades, all changes must be traceable to a specific module genome. ` +
						`Register the module first with /zenith-add-module or use /zenith-takeover.`
				};
			}
			return undefined;
		}

		// ── 5b. TDD Lifecycle Enforcement (Pillar 16) ────────────────
		const isTestFile = filePath.includes("/tests/") || path.basename(filePath).startsWith("test_") || filePath.includes(".test.");
		const isCodeFile = !isTestFile;

		if (owningModule.status === "planned" && isCodeFile) {
			if (ctx.hasUI) {
				ctx.ui.notify(
					`Zenith 🛑 TDD BLOCKED: '${owningModule.name}' is in PLANNED status. Write tests first (Pillar 16).`,
					"error"
				);
			}
			return {
				block: true,
				reason:
					`Zenith Enforcement — Pillar 16 (Verification): Module '${owningModule.name}' is currently in 'planned' status. ` +
					`You are strictly forbidden from writing implementation code before tests. ` +
					`1. Switch to the 'tdd-red' phase.\n` +
					`2. Write a comprehensive failing test suite in the module's test directory.\n` +
					`3. Update the module status to 'red' in .zenith/state.json.\n` +
					`Only then will implementation be permitted.`
			};
		}

		// ── 5c. DAG Enforcement (Pillar 1): Cannot edit a module if its dependencies are not sealed ──
		if (owningModule.dependencies?.length > 0) {
			const unsealedDeps = owningModule.dependencies.filter((depName: string) => {
				const dep = state.modules?.find((m) => m.name === depName);
				return !dep || dep.status !== "sealed";
			});

			if (unsealedDeps.length > 0) {
				if (ctx.hasUI) {
					ctx.ui.notify(
						`Zenith 🛑 DAG BLOCKED: Cannot modify '${owningModule.name}'. ` +
						`Unsealed dependencies: ${unsealedDeps.join(", ")} (Pillar 1).`,
						"error"
					);
				}
				return {
					block: true,
					reason: `Zenith Enforcement — Pillar 1 (Deterministic Path): Cannot modify module '${owningModule.name}' because its dependencies are not sealed: ${unsealedDeps.join(", ")}. Complete and seal them first.`
				};
			}
		}

		if (owningModule.status !== "sealed") return undefined;

		// Sealed module — hard block
		if (ctx.hasUI) {
			ctx.ui.notify(
				`Zenith 🔒 BLOCKED: '${owningModule.name}' is sealed (Pillar 5 & 13). Increment version to modify.`,
				"warning"
			);
		}

		return {
			block: true,
			reason:
				`Zenith Enforcement — Pillar 5 (Zero-Drift) & Pillar 13 (Immutability): ` +
				`Module '${owningModule.name}' is cryptographically sealed. ` +
				`To modify it, you must first run /zenith-unseal ${owningModule.name} and increment its version.`,
		};
	});



	// ── 5. Session Shutdown: Persist state ───────────────────
	pi.on("session_shutdown", async () => {
		saveState(cwd, state);
	});

	// /zenith-grade — set or inspect the industrial grade
	pi.registerCommand("zenith-grade", {
		description: "Get or set the Industrial Grade (usage: /zenith-grade [prototype|production|mission-critical])",
		handler: async (args, ctx) => {
			const requested = args.trim() as IndustrialGrade;
			const validGrades: IndustrialGrade[] = ["prototype", "production", "mission-critical"];

			if (!requested) {
				pi.sendUserMessage(
					`**Zenith Industrial Grade**\n` +
					`Current: \`${state.industrialGrade}\`\n\n` +
					`Available grades:\n` +
					`- \`prototype\`        — Pillars 1,4,5,10,11 enforced. Observability/Deployability/Operability are advisory.\n` +
					`- \`production\`       — All 19 Pillars enforced. (default)\n` +
					`- \`mission-critical\` — All 19 Pillars + hardening overlays (MFA, audit logs, multi-tenancy).\n\n` +
					`Usage: \`/zenith-grade prototype\``
				);
				return;
			}

			if (!validGrades.includes(requested)) {
				ctx.ui.notify(`Zenith: Unknown grade "${requested}". Valid: prototype, production, mission-critical.`, "warning");
				return;
			}

			state.industrialGrade = requested;
			saveState(cwd, state);
			ctx.ui.notify(`Zenith ⚡ Industrial Grade set to: ${requested}`, "info");
		},
	});

	// /zenith-phase — manually set or inspect the current SDLC phase
	pi.registerCommand("zenith-phase", {
		description: "Get or set the active Zenith SDLC phase (usage: /zenith-phase [phase-name])",
		handler: async (args, ctx) => {
			const requested = args.trim() as SdlcPhase;
			const validPhases: SdlcPhase[] = [
				"brainstorm", "takeover", "architecture-first", "audit", "performance-contract",
				"tdd-red", "tdd-green", "self-heal", "pr-review", "security-review",
				"integration-audit", "observability-scaffold", "dependency-governance",
				"release-protocol", "retrospective", "architecture-architect",
				"tdd-workflow", "code-reviewer", "self-improving-agent",
				"zenith-discipline", "tech-debt-tracker",
			];

			if (!requested) {
				// Show current phase
				pi.sendUserMessage(
					`**Zenith SDLC Phase**\n` +
					`Current: \`${state.currentPhase ?? "none (pillars-only)"}\`\n\n` +
					`Available phases:\n${validPhases.map((p) => `- \`${p}\``).join("\n")}\n\n` +
					`Usage: \`/zenith-phase tdd-red\`\n` +
					`Auto-detection is active — Zenith also detects phase from your messages.`
				);
				return;
			}

			if (!validPhases.includes(requested)) {
				ctx.ui.notify(`Zenith: Unknown phase "${requested}". Run /zenith-phase with no args to list valid phases.`, "warning");
				return;
			}

			state.currentPhase = requested;
			saveState(cwd, state);
			ctx.ui.notify(`Zenith ⚡ Phase set to: ${requested}`, "info");
		},
	});

	// /zenith-audit-deps — monorepo-aware dependency audit
	pi.registerCommand("zenith-audit-deps", {
		description: "Run dependency vulnerability scan (npm audit / pip-audit) across the monorepo",

		handler: async (_args, ctx) => {
			const findManifests = (dir: string): string[] => {
				const results: string[] = [];
				const entries = fs.readdirSync(dir, { withFileTypes: true });
				for (const entry of entries) {
					if (entry.name === "node_modules" || entry.name === ".git") continue;
					const fullPath = path.join(dir, entry.name);
					if (entry.isDirectory()) {
						results.push(...findManifests(fullPath));
					} else if (entry.name === "package.json" || entry.name === "requirements.txt") {
						results.push(fullPath);
					}
				}
				return results;
			};

			const manifests = findManifests(cwd);
			if (manifests.length === 0) {
				ctx.ui.notify("Zenith: No package manifests found in the monorepo.", "warning");
				return;
			}

			ctx.ui.notify(`Zenith 📦 Auditing ${manifests.length} manifests...`, "info");
			
			for (const manifest of manifests) {
				const manifestDir = path.dirname(manifest);
				const isNode = manifest.endsWith("package.json");
				const label = path.relative(cwd, manifestDir) || "root";

				try {
					if (isNode) {
						const result = await pi.exec("npm", ["audit", "--json"], { cwd: manifestDir });
						const parsed = JSON.parse(result.stdout || "{}");
						const vulns = parsed.metadata?.vulnerabilities ?? {};
						const total = (vulns.critical ?? 0) + (vulns.high ?? 0) + (vulns.moderate ?? 0);
						if (total > 0) {
							pi.sendUserMessage(`🚨 **Zenith Dependency Alert [${label}]**: Found ${total} vulnerabilities.`);
						}
					} else {
						const result = await pi.exec("pip-audit", ["--format", "json"], { cwd: manifestDir });
						const parsed = JSON.parse(result.stdout || "[]") as any[];
						const count = parsed.reduce((sum, p) => sum + p.vulns.length, 0);
						if (count > 0) {
							pi.sendUserMessage(`🚨 **Zenith Dependency Alert [${label}]**: Found ${count} vulnerabilities.`);
						}
					}
				} catch (err) {
					// Silent fail for individual packages
				}
			}
			ctx.ui.notify("Zenith ✅ Monorepo dependency audit complete.", "info");
		},
	});

	// /zenith-audit — trigger a full Principal Audit (Genome Integrity)
	pi.registerCommand("zenith-audit", {
		description: "Trigger a full Principal Audit against the 20 Pillars and Genome Integrity",
		handler: async (_args, ctx) => {
			state.currentPhase = "audit";
			saveState(cwd, state);
			ctx.ui.notify("Zenith 🧬 Initiating Genome Integrity Audit...", "info");
			pi.sendUserMessage(
				"I am initiating a **Principal Audit**. I will now verify:\n" +
				"1. **Genome Integrity** (Pillar 4 logicMap vs Implementation)\n" +
				"2. **Contract Compliance** (Pillar 2)\n" +
				"3. **Zero Trust Isolation** (Pillar 20)\n" +
				"4. **Traceability** (Pillar 9)\n\n" +
				"Analyzing codebase state..."
			);
		},
	});

	// ── 6. Commands ──────────────────────────────────────────

	// /zenith-init — initializes a .zenith/ workspace
	pi.registerCommand("zenith-init", {
		description: "Initialize Zenith for a GREENFIELD (brand new) project",
		handler: async (_args, ctx) => {
			const zenithDir = path.join(cwd, ".zenith");
			if (!fs.existsSync(zenithDir)) fs.mkdirSync(zenithDir, { recursive: true });

			state = { ...DEFAULT_STATE, projectName: path.basename(cwd) };
			saveState(cwd, state);

			ctx.ui.notify(`Zenith ⚡ Greenfield Initialized at ${zenithDir}`, "info");
			pi.sendUserMessage(
				"Zenith has been initialized for a new greenfield project. I now have the 19 Eternal Pillars loaded. " +
				"Describe the system you want to build and I will begin the Architecture-First planning phase."
			);
		},
	});

	// /zenith-takeover — triggers the assimilation protocol for existing codebases
	pi.registerCommand("zenith-takeover", {
		description: "Assimilate a BROWNFIELD (existing) codebase into Zenith",
		handler: async (_args, ctx) => {
			const zenithDir = path.join(cwd, ".zenith");
			if (!fs.existsSync(zenithDir)) fs.mkdirSync(zenithDir, { recursive: true });

			// Initialize base state if it doesn't exist
			if (state.modules.length === 0) {
				state = { ...DEFAULT_STATE, projectName: path.basename(cwd), currentPhase: "takeover" };
				saveState(cwd, state);
			}

			ctx.ui.notify(`Zenith 🧬 Assimilation protocol initiated...`, "info");
			pi.sendUserMessage(
				"I am initiating the Zenith Takeover protocol on this codebase. " +
				"I will now map the existing modules, compute the dependency DAG, and identify critical architectural gaps. " +
				"I will produce the initial `.zenith/state.json` manifest."
			);
		},
	});
	// /zenith-plan — visualize construction schedule and DAG
	pi.registerCommand("zenith-plan", {
		description: "Show the construction schedule and dependency DAG",
		handler: async (_args, ctx) => {
			state = loadState(cwd);
			refreshDAG(state);
			saveState(cwd, state);

			const mermaid = renderMermaidDAG(state.modules);
			const waves = [...new Set(state.modules.map(m => m.wave))].sort((a, b) => a - b);

			let planText = `## Zenith Construction Plan — ${state.projectName}\n\n`;

			if (state.dagCycles.length > 0) {
				planText += `🚨 **CRITICAL DAG VIOLATION**: Circular dependencies detected in: ${state.dagCycles.join(", ")}\n\n`;
			}

			for (const w of waves) {
				planText += `### Wave ${w}\n`;
				const waveModules = state.modules.filter(m => m.wave === w);
				for (const m of waveModules) {
					const status = m.status === "sealed" ? "🔒 SEALED" : m.status.toUpperCase();
					const deps = m.dependencies.length > 0 ? ` (Depends on: ${m.dependencies.join(", ")})` : "";
					planText += `- [${status}] **${m.name}**: ${m.description}${deps}\n`;
				}
				planText += "\n";
			}

			if (state.backlog.length > 0) {
				planText += `### Wave N+1 (Backlog)\n`;
				for (const item of state.backlog) {
					planText += `- [${item.severity}] **${item.name}** (${item.type}): ${item.description}\n`;
				}
				planText += "\n";
			}

			planText += `### Dependency Graph\n\`\`\`mermaid\n${mermaid}\n\`\`\``;

			pi.sendUserMessage(planText);
		},
	});

	// /zenith-status — shows current manifest state
	pi.registerCommand("zenith-status", {
		description: "Show Zenith manifest status and drift report",
		handler: async (_args, ctx) => {
			state = loadState(cwd);
			const violations = detectDrift(state, cwd);

			const lines = [
				`**Zenith Status — ${state.projectName}**`,
				`Wave: ${state.currentWave} | Modules: ${state.modules.length}`,
				"",
				...state.modules.map(
					(m) => `- [${m.status.toUpperCase().padEnd(6)}] **${m.name}**: ${m.description}`
				),
				"",
				violations.length === 0
					? "✅ No drift detected. All sealed modules are intact."
					: `🚨 ${violations.length} drift violation(s):\n` + violations.map((v) => `  - ${v}`).join("\n"),
			];

			pi.sendUserMessage(lines.join("\n"));
		},
	});

	// /zenith-seal <module-name> — seals a module by hashing its owned paths
	pi.registerCommand("zenith-seal", {
		description: "Seal a module as immutable (usage: /zenith-seal <module-name>)",
		handler: async (args, ctx) => {
			const moduleName = args.trim();
			const mod = state.modules.find((m) => m.name === moduleName);

			if (!mod) {
				ctx.ui.notify(`Module '${moduleName}' not found in manifest.`, "warning");
				return;
			}
			if (mod.status === "sealed") {
				ctx.ui.notify(`Module '${moduleName}' is already sealed.`, "info");
				return;
			}

			// Hash the first owned path as the canonical seal
			const primaryPath = path.join(cwd, mod.paths[0] ?? "");
			const hash = hashFile(primaryPath);

			if (!hash) {
				ctx.ui.notify(`Cannot seal '${moduleName}' — no file found at '${mod.paths[0]}'.`, "warning");
				return;
			}

			mod.status = "sealed";
			mod.sealedHash = hash;
			saveState(cwd, state);

			ctx.ui.notify(`Zenith 🔒 '${moduleName}' sealed. Hash: ${hash.slice(0, 12)}…`, "info");
		},
	});

	// /zenith-unseal <module-name> — removes seal for modification
	pi.registerCommand("zenith-unseal", {
		description: "Unseal a module for modification (usage: /zenith-unseal <module-name>)",
		handler: async (args, ctx) => {
			const moduleName = args.trim();
			const mod = state.modules.find((m) => m.name === moduleName);

			if (!mod || mod.status !== "sealed") {
				ctx.ui.notify(`Module '${moduleName}' is not sealed.`, "info");
				return;
			}

			mod.status = "green";
			mod.sealedHash = undefined;
			saveState(cwd, state);

			ctx.ui.notify(`Zenith 🔓 '${moduleName}' unsealed. Pillar 13 requires version increment.`, "warning");
		},
	});

	// /zenith-add-module — registers a new module in the manifest
	pi.registerCommand("zenith-add-module", {
		description: 'Add a module to the manifest (usage: /zenith-add-module <name> <path> "<description>")',
		handler: async (args, ctx) => {
			// Simple parsing: name path "description"
			const match = args.match(/^(\S+)\s+(\S+)\s+"(.+)"$/);
			if (!match) {
				ctx.ui.notify(
					'Usage: /zenith-add-module <name> <path> "<description>"',
					"warning"
				);
				return;
			}
			const [, name, modPath, description] = match;
			const existing = state.modules.find((m) => m.name === name);
			if (existing) {
				ctx.ui.notify(`Module '${name}' already exists.`, "warning");
				return;
			}

			state.modules.push({
				name,
				description,
				contracts: [],
				status: "planned",
				paths: [modPath],
				dependencies: [],
				wave: state.currentWave,
			});
			saveState(cwd, state);
			ctx.ui.notify(`Zenith ⚡ Module '${name}' added to Wave ${state.currentWave}.`, "info");
		},
	});

	// /zenith-upgrade — autonomously installs the full industrial suite
	pi.registerCommand("zenith-upgrade", {
		description: "Autonomously install/update the full 8-file Zenith Industrial Suite",
		handler: async (_args, ctx) => {
			const basePath = "/Users/visvasis/Home/Zenith IDE/cloned_repos/pi-mono/.pi/extensions";
			const suite = [
				"zenith-worker.ts",
				"subagent-tool.ts",
				"handoff.ts",
				"git-checkpoint.ts",
				"dirty-repo-guard.ts",
				"confirm-destructive.ts",
				"permission-gate.ts",
				"prompt-url-widget.ts"
			];

			ctx.ui.notify("Zenith 🧬 Starting Industrial Suite Upgrade...", "info");

			for (const file of suite) {
				const fullPath = path.join(basePath, file);
				if (!fs.existsSync(fullPath)) {
					ctx.ui.notify(`Zenith 🛑 Upgrade Failed: Missing source file ${file}`, "error");
					return;
				}

				ctx.ui.notify(`Zenith 🛠️  Installing ${file}...`, "info");
				try {
					// Use the native pi install command via exec
					const result = await pi.exec("pi", ["install", fullPath]);
					if (result.code !== 0) {
						throw new Error(result.stderr || "Unknown error");
					}
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err);
					ctx.ui.notify(`Zenith ⚠️  Failed to install ${file}: ${msg}`, "warning");
					// Continue with others
				}
			}

			ctx.ui.notify("Zenith ✅ Industrial Suite Upgrade Complete. Reloading...", "info");
			// Trigger a reload of all resources natively
			await ctx.reload();
		},
	});

	// /zenith-check — trigger an autonomous discipline audit
	pi.registerCommand("zenith-check", {
		description: "Trigger an autonomous discipline audit against the 7 Principles of Zenith",
		handler: async (_args, ctx) => {
			state.currentPhase = "zenith-discipline";
			saveState(cwd, state);
			ctx.ui.notify("Zenith ⚡ Initiating Discipline Audit...", "info");
			pi.sendUserMessage(
				"I am initiating a **Zenith Discipline Audit**. I will now analyze the recent changes for:\n" +
				"1. **Complexity/Bloat** (Pillar 11)\n" +
				"2. **Surgical Precision** (Pillar 3)\n" +
				"3. **Genome Integrity** (Pillar 4)\n" +
				"4. **Zero-Shortcut Compliance** (Industrial Integrity)\n\n" +
				"Please provide the diff or context you wish to audit."
			);
		},
	});
}
