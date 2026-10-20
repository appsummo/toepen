import type { RuleSection } from './rules.js';

export const rulesNl: RuleSection[] = [
  {
    title: 'Het spel',
    items: [
      { text: 'Toepen wordt gespeeld met 32 kaarten: de 2 tot en met de 6 gaan eruit.' },
      {
        text: 'De rangorde van laag naar hoog: Boer, Vrouw, Heer, Aas, 7, 8, 9, 10.',
        sub: ['De Boer is dus de laagste kaart van het spel, en de 10 de hoogste.'],
      },
      { text: 'Het doel van een ronde is de laatste slag winnen — niet de meeste slagen.' },
      { text: 'Je speelt met 2 tot 8 man aan tafel.' },
    ],
  },
  {
    title: 'Delen',
    items: [
      { text: 'De gever deelt met de klok mee, één kaart tegelijk, vier kaarten per speler.' },
      { text: 'De speler links van de gever komt uit.' },
      { text: 'Wie de ronde wint, deelt de volgende.' },
    ],
  },
  {
    title: 'Het spelverloop',
    items: [
      { text: 'Je moet kleur volgen als je dat kunt. Kun je dat niet, dan mag je alles leggen.' },
      { text: 'De hoogste kaart van de gevraagde kleur wint de slag en komt uit voor de volgende.' },
      { text: 'Alle gespeelde kaarten blijven open op tafel liggen, zodat je kunt natellen wat er nog uit is.' },
      { text: 'Wie de laatste slag wint, wint de ronde.' },
    ],
  },
  {
    title: 'Punten',
    items: [
      {
        text: 'Verliezers krijgen strafpunten. Wie het afgesproken aantal haalt (standaard 15) ligt eruit.',
        sub: ['De tafelbaas zet het doel voor het potje begint: 5, 8, 10, 12 of 15 punten.'],
      },
      { text: 'Normaal kost een verloren ronde 1 punt.' },
      { text: 'De laatste speler die nog meedoet, wint het potje.' },
    ],
  },
  {
    title: 'Toepen',
    items: [
      {
        text: 'Ben je aan de beurt, dan mag je toepen: de inzet gaat met één punt omhoog.',
        sub: [
          'De anderen gaan mee of vouwen.',
          'Wie vouwt betaalt de inzet van vóór de toep en doet de ronde niet meer mee.',
          'Wie meegaat en verliest, betaalt de volle inzet.',
        ],
      },
      {
        text: 'Iedereen mag daarna opnieuw toepen — maar nooit twee keer achter elkaar zelf.',
        sub: ['Toepen stopt zodra een meegaande speler door een verlies over het doel heen zou gaan.'],
      },
      { text: 'Vouwt iedereen na een toep, dan is de ronde voorbij en heeft de toeper hem gewonnen. Bluffen hoort er dus bij.' },
    ],
  },
  {
    title: 'Armoede',
    items: [
      { text: 'Staat iemand één punt van het doel af, dan is het armoede aan tafel.' },
      {
        text: 'De anderen kijken naar hun kaarten en beslissen of ze meespelen of vouwen.',
        sub: ['Vouwen kost 1 punt.', 'Meespelen en verliezen kost 2 punten.'],
      },
      { text: 'Wie zelf in armoede zit, moet meespelen — die heeft niets meer te vouwen.' },
    ],
  },
  {
    title: 'Vier gelijke',
    items: [
      { text: 'Heb je vier gelijke kaarten in handen, dan roep je Toep en win je de ronde meteen.' },
      { text: 'Alle anderen krijgen 3 strafpunten.' },
    ],
  },
  {
    title: 'Vuile was',
    items: [
      {
        text: 'Vuile was is een hand met alleen maar plaatjes (Boer, Vrouw, Heer, Aas), of alle plaatjes op één kaart na plus een 7.',
      },
      {
        text: 'Aan het begin van de ronde mag iedereen vuile was roepen en zijn hand omruilen.',
        sub: ['Je mag bluffen: niemand ziet je kaarten.'],
      },
      {
        text: 'Daarna mag iedereen stil een claim controleren. Niemand ziet wie er controleert, of hoeveel mensen.',
        sub: [
          'Controleert niemand? Dan krijg je een nieuwe hand en blijft de bluf geheim.',
          'Blufte je en word je betrapt? 1 strafpunt, en je speelt verder met je oorspronkelijke hand.',
          'Had je het echt? Dan krijgt iedere controleur 1 strafpunt en krijg jij je nieuwe kaarten.',
        ],
      },
      { text: 'De tafelbaas kan vuile was voor het potje uitzetten.' },
    ],
  },
  {
    title: 'Winnen met een Boer',
    items: [
      { text: 'De Boer is de laagste kaart, dus de laatste slag pakken met een Boer is een kleine vernedering voor de rest.' },
      { text: 'Lukt dat, dan gaat er 1 strafpunt van je eigen stand af.' },
    ],
  },
  {
    title: 'Beslissende ronde',
    items: [
      {
        text: 'Staat iedereen die nog meedoet één punt van het doel af, dan wordt er met acht kaarten gedeeld in plaats van vier.',
        sub: ['Dat kan alleen als de kaarten het toelaten — dus tot en met vier spelers.'],
      },
    ],
  },
  {
    title: 'Bedenktijd',
    items: [
      { text: 'Elke tafel heeft een bedenktijd. Loopt die af, dan beslist de server voorzichtig voor je.' },
      {
        text: 'Altijd de veiligste zet:',
        sub: [
          'Aan de beurt: je zwakste geldige kaart gaat eruit.',
          'Bij een toep: je vouwt, voor de inzet van vóór de toep.',
          'Bij armoede: je vouwt.',
          'Bij vuile was: je past, of je controleert niemand.',
        ],
      },
    ],
  },
];
