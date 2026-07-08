/**
 * Shared router helpers (avoids circular imports with advisor-retrieve).
 */
export {
  pickAdvancementName,
  resolveAdvancementName,
  getAdvancementMeta,
  inferSourceClassForAdvancement,
} from './advisor-advancement-resolve.mjs';
