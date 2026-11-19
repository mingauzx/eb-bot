export const trainingButtonPrefix = 'eb-training:';
export const trainingMenuButton = trainingButtonPrefix + 'menu';

export const trainingColor = 0x167044;

export function trainingPanelMessage() {
 return {
  embeds: [{
   color: trainingColor,
   author: {name: 'EB do Gandra • Instrução Militar'},
   title: '🇧🇷 Central de Treinamentos',
   description: 'Consulte os roteiros oficiais para aplicar os treinamentos do EB.\n\nUse o botão abaixo para abrir seu menu privado. Ele mostra os scripts liberados para seu cargo ou patente.',
   footer: {text: 'EB do Gandra • Scripts de treinamento'}
  }],
  components: [{type: 1, components: [{
   type: 2, style: 1, custom_id: trainingMenuButton, label: 'Ver scripts de treinamento', emoji: {name: '📚'}
  }]}]
 };
}
