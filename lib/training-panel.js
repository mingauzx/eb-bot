export const trainingButtonPrefix = 'eb-training:';
export const trainingMenuButton = trainingButtonPrefix + 'menu';

export function trainingPanelMessage() {
 return {
  embeds: [{
   color: 0x167044,
   title: '🇧🇷 Scripts de Treinamento',
   description: 'Clique abaixo para ver os treinamentos disponíveis para sua patente.'
  }],
  components: [{type: 1, components: [{
   type: 2, style: 1, custom_id: trainingMenuButton, label: 'Ver scripts de treinamento'
  }]}]
 };
}
