export interface Balloon { id: string; text: string }
export interface TranslationRequest { balloons: Balloon[]; previous: { source: string; translation: string }[]; glossary: Record<string,string>; context: string }
export interface EngineIdentity { id: 'opus'|'ollama'|'webgpu'; model: string; version: string }
export interface TranslationResult { translations: string[]; engine: EngineIdentity; warnings: string[]; metrics?: Record<string,number> }
/** Implementations initialize lazily and reuse their model until dispose/cancellation. */
export interface Translator {
  describe(options: unknown): Promise<EngineIdentity>;
  translate(request: TranslationRequest, options: unknown, expected?: EngineIdentity): Promise<TranslationResult>;
  dispose(): Promise<void>;
}
