/** Apply only after server authorization; identity numbers are intentionally excluded. */
export function matchesDocumentSearch(doc: any, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  const state = doc?.state || {};
  const surveys = Array.isArray(state.surveys) && state.surveys.length ? state.surveys : [state.survey];
  const values: unknown[] = [doc?.docNo, doc?.docType, doc?.subType, doc?.propertyAddress, doc?.writer,
    state.property?.village, state.property?.sro];
  if (Array.isArray(state.parties)) {
    for (const party of state.parties) values.push(party?.name, party?.nameTa, party?.NameTa);
  }
  for (const survey of surveys) values.push(survey?.surveyNo, survey?.subDivision, survey?.pattaNo);
  return values.some(value => typeof value === 'string' && value.toLocaleLowerCase().includes(q));
}
