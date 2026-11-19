const rankNames = [
  ['cr', 'criador'], ['scr', 'sub criador'], ['mar', 'marechal'],
  ['pres', 'presidente'], ['v pres', 'vice presidente'], ['cmt', 'comandante'],
  ['scmt', 'subcomandante'], ['er', 'elite real'], ['es', 'elite secreta'],
  ['em', 'elite militar', 'oficiais de elite', 'oficiais da elite', 'oficiais do exercito de elite'],
  ['gen ex', 'general de exercito'], ['gen dv', 'general de divisao'],
  ['gen bda', 'general de brigada'], ['cel', 'coronel'], ['ten-cel', 'tenente coronel'],
  ['maj', 'major'], ['cap', 'capitao'], ['1° ten', 'primeiro tenente'],
  ['2° ten', 'segundo tenente', 'oficiais de exercito', 'oficiais do exercito'],
  ['asp', 'aspirante a oficial'], ['ct', 'cadete'], ['st', 'subtenente'],
  ['1° sgt', 'primeiro sargento'], ['2° sgt', 'segundo sargento'],
  ['3° sgt', 'terceiro sargento'], ['cb', 'cabo'], ['sld', 'soldado'], ['rec', 'recruta']
];

const rankByName = new Map(rankNames.flatMap((names, rank) => names.map(name => [name, rank])));

function normalizeRoleName(name) {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/º/g, '°').replace(/[^a-z0-9\s°-]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function roleRank(role) {
  if (!role || role.managed) return undefined;
  const tag = role.name.match(/\[([^\]]+)\]/)?.[1];
  const name = role.name.replace(/\[[^\]]+\]/g, ' ');
  return rankByName.get(normalizeRoleName(name))
    ?? rankByName.get(normalizeRoleName(tag ?? ''));
}

export const trainings = [
  {key: 'RECRUTAMENTO', label: 'Recrutamento', minimumRoles: ['1545550460499525666']},
  {key: 'PRACAS', label: 'Praças e Graduados', minimumRoles: ['1545550460537151545']},
  {key: 'AMAN', label: 'AMAN', minimumRoles: ['1545550460545409050']},
  {key: 'OFICIAIS', label: 'Oficiais', minimumRoles: ['1545550460545409050']},
  {key: 'EPC', label: 'EPC', minimumRoles: ['1545550460545409050']},
  {key: 'APG', label: 'APG', minimumRoles: ['1545550460579086384']},
  {key: 'CPE', label: 'CPE', minimumRoles: ['1545550460612513877', '1545550460612513879']}
];

export function accessibleTrainings(guildRoles, memberRoleIds) {
  const members = Array.from(memberRoleIds, id => guildRoles.get(id)).filter(role => role && !role.managed);
  return trainings.filter(({minimumRoles}) => minimumRoles.some(id => {
    const minimum = guildRoles.get(id);
    if (!minimum || minimum.managed) return false;
    const minimumRank = roleRank(minimum);
    return members.some(member => {
      if (member.id === minimum.id) return true;
      const memberRank = roleRank(member);
      if (memberRank === undefined) return false;
      if (minimumRank !== undefined) return memberRank <= minimumRank;
      return member.comparePositionTo(minimum) >= 0;
    });
  }));
}
