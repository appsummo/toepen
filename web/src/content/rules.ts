import type { Lang } from '../i18n/index.js';
import { rulesNl } from './rules.nl.js';
import { rulesEn } from './rules.en.js';

/** A bullet, optionally with its own sub-bullets. */
export interface RuleItem {
  text: string;
  sub?: string[];
}

export interface RuleSection {
  title: string;
  items: RuleItem[];
}

/**
 * The rules as this server actually plays them, which is not quite the rules as
 * written down in any café: the target score is configurable, and "Chance for
 * Toep" (swapping a card when you hold three of a kind) is not implemented, so
 * it is deliberately absent here rather than promised.
 */
export const RULES: Record<Lang, RuleSection[]> = {
  nl: rulesNl,
  en: rulesEn,
};
