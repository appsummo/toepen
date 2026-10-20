import type { RuleSection } from './rules.js';

export const rulesEn: RuleSection[] = [
  {
    title: 'The game',
    items: [
      { text: 'Toepen is played with 32 cards: everything from the 2 to the 6 is removed.' },
      {
        text: 'The ranking from low to high is Jack, Queen, King, Ace, 7, 8, 9, 10.',
        sub: ['So the Jack is the weakest card in the game and the 10 the strongest.'],
      },
      { text: 'The aim of a round is to win the last trick — not the most tricks.' },
      { text: 'Two to eight players sit at a table.' },
    ],
  },
  {
    title: 'Dealing',
    items: [
      { text: 'The dealer deals clockwise, one card at a time, four cards each.' },
      { text: 'The player to the dealer’s left leads the first trick.' },
      { text: 'Whoever wins the round deals the next one.' },
    ],
  },
  {
    title: 'Playing',
    items: [
      { text: 'You must follow suit if you can. If you cannot, you may play anything.' },
      { text: 'The highest card of the led suit wins the trick and leads the next one.' },
      { text: 'Every card played stays face up on the table, so you can count what is still out.' },
      { text: 'Whoever wins the final trick wins the round.' },
    ],
  },
  {
    title: 'Scoring',
    items: [
      {
        text: 'Losers take penalty points. Reach the agreed total (15 by default) and you are out.',
        sub: ['The host sets the target before the game starts: 5, 8, 10, 12 or 15 points.'],
      },
      { text: 'A lost round normally costs 1 point.' },
      { text: 'The last player still in the game wins it.' },
    ],
  },
  {
    title: 'Knocking (toepen)',
    items: [
      {
        text: 'On your turn you may knock, which raises the stake by one point.',
        sub: [
          'Everyone else calls or folds.',
          'Folding costs the stake as it stood before the knock, and you are out of the round.',
          'Calling and losing costs the full stake.',
        ],
      },
      {
        text: 'Anyone may knock again afterwards — but never twice in a row themselves.',
        sub: ['Knocking stops as soon as a loss would push a player who is still in past the target.'],
      },
      { text: 'If everyone folds after a knock the round ends there and the knocker has won it. Bluffing is half the game.' },
    ],
  },
  {
    title: 'Poverty (armoede)',
    items: [
      { text: 'When somebody is one point short of the target, the table is in poverty.' },
      {
        text: 'The others look at their cards and decide whether to play along or fold.',
        sub: ['Folding costs 1 point.', 'Playing along and losing costs 2 points.'],
      },
      { text: 'Anyone already in poverty has to play — they have nothing left to fold for.' },
    ],
  },
  {
    title: 'Four of a kind',
    items: [
      { text: 'Hold four of a kind and you call Toep and win the round outright.' },
      { text: 'Everyone else takes 3 penalty points.' },
    ],
  },
  {
    title: 'Dirty laundry (vuile was)',
    items: [
      {
        text: 'Dirty laundry is a hand of nothing but picture cards (Jack, Queen, King, Ace), or all pictures bar one plus a 7.',
      },
      {
        text: 'At the start of the round anyone may claim it and swap their whole hand.',
        sub: ['You may bluff: nobody gets to see your cards.'],
      },
      {
        text: 'Anyone may then quietly check a claim. Nobody sees who checked, or how many did.',
        sub: [
          'Nobody checks? You get a new hand and the bluff stays secret.',
          'Caught bluffing? 1 penalty point, and you play on with the hand you were dealt.',
          'Really had it? Every challenger takes 1 penalty point and you get your new cards.',
        ],
      },
      { text: 'The host can switch dirty laundry off before the game starts.' },
    ],
  },
  {
    title: 'Winning with a Jack',
    items: [
      { text: 'The Jack is the weakest card, so taking the last trick with one is a small humiliation for everybody else.' },
      { text: 'Manage it and 1 penalty point comes off your own score.' },
    ],
  },
  {
    title: 'The decider',
    items: [
      {
        text: 'When everyone still in the game is one point from the target, eight cards are dealt each instead of four.',
        sub: ['Only when the deck allows it — so up to four players.'],
      },
    ],
  },
  {
    title: 'Time to think',
    items: [
      { text: 'Every table has a thinking time. When it runs out the server decides for you, carefully.' },
      {
        text: 'Always the safest move:',
        sub: [
          'On your turn: your weakest legal card goes down.',
          'Facing a knock: you fold, at the stake from before the knock.',
          'In poverty: you fold.',
          'On dirty laundry: you pass, or you check nobody.',
        ],
      },
    ],
  },
];
