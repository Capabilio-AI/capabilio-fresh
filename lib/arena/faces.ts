/** Every student gets one face, always the same one: picked from their id, so the leaderboard, the streak and the podium all show the same person the same way. */
const FACES = ["😎", "🤓", "🧐", "😄", "🥳", "😏", "🤠", "🤩", "😇", "🙂", "😌", "😋", "🤗", "🤔", "😺", "😸", "🥸", "😁", "😆", "🫡"] as const;

export function faceFor(userId: string): string {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) h = Math.imul(h ^ userId.charCodeAt(i), 16777619);
  return FACES[(h >>> 0) % FACES.length];
}
