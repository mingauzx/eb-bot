const rankTags = [
  'CR', 'SCR', 'MAR', 'PRES', 'V PRES', 'CMT', 'SCMT', 'ER', 'ES', 'EM',
  'GEN EX', 'GEN DV', 'GEN BDA', 'CEL', 'TEN-CEL', 'MAJ', 'CAP', '1° TEN',
  '2° TEN', 'ASP', 'CT', 'ST', '1° SGT', '2° SGT', '3° SGT', 'CB', 'SLD', 'REC'
];

export const trainings = [
  {key: 'RECRUTAMENTO', label: 'Recrutamento', minimumRoles: ['1545550460499525666']},
  {key: 'PRACAS', label: 'Praças e Graduados', minimumRoles: ['1545550460537151545']},
  {key: 'AMAN', label: 'AMAN', minimumRoles: ['1545550460545409050']},
  {key: 'OFICIAIS', label: 'Oficiais', minimumRoles: ['1545550460545409050']},
  {key: 'EPC', label: 'EPC', minimumRoles: ['1545550460545409050']},
  {key: 'APG', label: 'APG', minimumRoles: ['1545550460579086384']},
  {key: 'CPE', label: 'CPE', minimumRoles: ['1545550460612513877', '1545550460612513879']}
];

export function rankOrder(roles) {
  const candidates = new Map();
  for (const role of roles.values()) {
    if (role.managed) continue;
    const tag = role.name.match(/^\s*\[([^\]]+)\]/)?.[1];
    const rank = rankTags.indexOf(tag?.trim().toUpperCase().replace(/º/g, '°').replace(/\s+/g, ' '));
    if (rank < 0) continue;
    const ids = candidates.get(rank) ?? [];
    ids.push(role.id);
    candidates.set(rank, ids);
  }
  return new Map([...candidates].filter(([, ids]) => ids.length === 1).map(([rank, [id]]) => [id, rank]));
}

export function accessibleTrainings(ranks, memberRoleIds) {
  const highestRank = Math.min(...Array.from(memberRoleIds, id => ranks.get(id) ?? Infinity));
  return trainings.filter(({minimumRoles}) => minimumRoles.every(id => ranks.has(id))
    && highestRank <= Math.max(...minimumRoles.map(id => ranks.get(id))));
}
