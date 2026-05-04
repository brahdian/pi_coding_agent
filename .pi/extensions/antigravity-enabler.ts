import { type ExtensionAPI, type ExtensionContext } from "@mariozechner/pi-coding-agent";
import { antigravityOAuthProvider, registerOAuthProvider } from "@mariozechner/pi-ai/oauth";

/**
 * Antigravity Enabler — Zenith Extension
 * 
 * Force-registers the Google Antigravity provider in the OAuth registry
 * to ensure it appears in the /login menu on fresh installations.
 */
export default function antigravityEnabler(pi: ExtensionAPI) {
	// Register the provider immediately on extension load
	pi.on("session_start", async (_event, ctx: ExtensionContext) => {
		try {
			// Access the internal OAuth registry and ensure Antigravity is present
			registerOAuthProvider(antigravityOAuthProvider);
			
			if (ctx.hasUI) {
				// Verify if models are already loaded, if not, refresh registry
				const antigravityModels = ctx.modelRegistry.getAvailable().filter(m => m.provider === "google-antigravity");
				if (antigravityModels.length === 0) {
					ctx.modelRegistry.refresh();
				}
			}
		} catch (err) {
			console.error("Zenith ⚠️  Failed to force-enable Antigravity:", err);
		}
	});
}
