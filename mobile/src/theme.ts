// Brown-café palette, ported from the web app's theme.css so the mobile app
// keeps the same warm wood / parchment / green-felt identity.
export const colors = {
  bg1: '#31200f',
  bg2: '#1e1207',
  bg3: '#271808',
  parchment: '#f7f2e6',
  parchment2: '#f2e8d5',
  parchment3: '#efe9df',
  creamLine: '#e4d7bd',
  gold: '#c98f3d',
  goldBright: '#e8b25c',
  goldSoft: '#f0c884',
  goldDeep: '#8a5a22',
  red: '#b3402e',
  redBright: '#c44c38',
  ink: '#221305',
  inkSoft: '#2a241c',
  muted: '#9d8c6c',
  muted2: '#7d6c50',
  felt: '#4f7a68',
  feltDeep: '#243029',
  feltLine: '#8fb59d',
  woodEdge: '#7a2f20',
  cardWhite: '#ffffff',
  overlay: 'rgba(20,10,3,0.82)',
} as const;

export const radius = { sm: 8, md: 12, lg: 14, pill: 999 } as const;

export const shadowCard = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.35,
  shadowRadius: 16,
  elevation: 6,
} as const;
