/**
 * Singleton loader for map / UI images. On failure, consumers must use geometric fallbacks.
 */
export class AssetManager {
  private static instance: AssetManager | null = null;

  private readonly images = new Map<string, HTMLImageElement>();

  private constructor() {}

  static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  /**
   * Loads a single URL keyed by `assetId`. Failed loads leave the id unregistered so `get` returns null.
   */
  async loadImage(assetId: string, url: string): Promise<void> {
    if (this.images.has(assetId)) return;
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(assetId, img);
        resolve();
      };
      img.onerror = () => {
        resolve();
      };
      img.src = url;
    });
  }

  /**
   * Preloads a manifest of id → absolute or site-root URL paths.
   */
  async preloadManifest(manifest: Record<string, string>): Promise<void> {
    await Promise.all(
      Object.entries(manifest).map(([id, url]) => this.loadImage(id, url)),
    );
  }

  /**
   * Derives default public URLs from optional asset ids on game entities.
   */
  buildManifestFromGameState(state: {
    officers: Record<
      string,
      { portraitAssetId?: string; avatarAssetId?: string }
    >;
    nodes: Record<string, { spriteAssetId?: string }>;
    routes: Record<string, { textureAssetId?: string }>;
  }): Record<string, string> {
    const manifest: Record<string, string> = {};
    for (const o of Object.values(state.officers)) {
      if (o.portraitAssetId) {
        manifest[o.portraitAssetId] = `/assets/portraits/${o.portraitAssetId}.png`;
      }
      if (o.avatarAssetId) {
        manifest[o.avatarAssetId] = `/assets/portraits/${o.avatarAssetId}.png`;
      }
    }
    for (const n of Object.values(state.nodes)) {
      if (n.spriteAssetId) {
        manifest[n.spriteAssetId] = `/assets/nodes/${n.spriteAssetId}.png`;
      }
    }
    for (const r of Object.values(state.routes)) {
      if (r.textureAssetId) {
        manifest[r.textureAssetId] = `/assets/ui/${r.textureAssetId}.png`;
      }
    }
    return manifest;
  }

  async preloadFromGameState(state: Parameters<
    AssetManager["buildManifestFromGameState"]
  >[0]): Promise<void> {
    await this.preloadManifest(this.buildManifestFromGameState(state));
  }

  /**
   * Returns a loaded image, or null if missing or failed (fallback to canvas primitives).
   */
  get(assetId: string | undefined | null): HTMLImageElement | null {
    if (!assetId) return null;
    const img = this.images.get(assetId);
    if (!img || !img.complete || img.naturalWidth === 0) return null;
    return img;
  }
}
