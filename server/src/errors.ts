/**
 * Stable codes for the messages a player can actually be shown.
 *
 * The engine and the request handlers throw plain English sentences, which are
 * fine in a log but are not something to put in front of a player who chose
 * Dutch. Each one that can surface in the UI gets a short code here, and the
 * client renders the code in its own language — falling back to the raw
 * message, so a guard we forget to list still says *something* useful.
 *
 * Keyed by the exact thrown message, so this stays next to the throws rather
 * than becoming a parallel taxonomy to keep in sync.
 */
const CODES: Record<string, string> = {
  // Racing the server: your click arrived after the state moved on.
  'not your turn': 'not_your_turn',
  'not in playing phase': 'not_playing_phase',
  'player not in round': 'not_in_round',
  'illegal card (must follow suit)': 'must_follow_suit',
  'cannot knock now': 'cannot_knock',
  'no pending knock': 'no_pending_knock',
  'you are not asked to respond': 'not_asked',
  'already responded': 'already_responded',
  'not in poverty phase': 'not_poverty_phase',
  'poverty player must play': 'poverty_must_play',
  'not in the declare phase': 'not_declare_phase',
  'not in the challenge phase': 'not_challenge_phase',
  'already decided': 'already_decided',
  'you are not at this table': 'not_at_table',
  'you cannot check a claim': 'cannot_check',
  'you cannot check yourself': 'cannot_check_self',
  'nobody claimed vuile was at that seat': 'no_claim_there',
  // Lobby and table management.
  'game already started': 'already_started',
  'only the host can start': 'host_only',
  'need at least 2 players': 'need_two_players',
  'game not in progress': 'not_in_progress',
  'round not finished': 'round_not_finished',
  'not a player in this game': 'not_a_player',
};

export function errorCode(message: string): string | undefined {
  return CODES[message];
}
