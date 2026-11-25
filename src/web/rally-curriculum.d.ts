declare module 'virtual:rally-curriculum' {
  const semesters: Record<string, import('../shared/race-questions.js').RaceQuestion[]>;
  export default semesters;
}
