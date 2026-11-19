export const trainingButtonPrefix = 'eb-training:';
export const trainingMenuButton = trainingButtonPrefix + 'menu';

const componentsV2 = 1 << 15;
const trainingBanner = 'https://raw.githubusercontent.com/mingauzx/eb-bot/main/public/training-banner.png';
const brazilEmoji = {id: '1546546571691172031', name: 'e_brasilFXP', animated: true};
const brazil = '<a:' + brazilEmoji.name + ':' + brazilEmoji.id + '>';

export function trainingCard({title, description, banner, rows = [], flags = 0, warning = false}) {
 return {
  flags: componentsV2 | flags,
  components: [{
   type: 17,
   accent_color: warning ? 0xc98924 : 0x167044,
   components: [
    {type: 10, content: '## ' + brazil + ' ' + title},
    ...(banner ? [{type: 12, items: [{media: {url: banner}, description: 'Scripts de Treinamento do EB do Gandra'}]}] : []),
    {type: 10, content: description},
    ...rows.map(buttons => ({type: 1, components: buttons}))
   ]
  }]
 };
}

export function trainingPanelMessage() {
 return trainingCard({
  title: 'Central de Treinamentos',
  banner: trainingBanner,
  description: 'Consulte os roteiros oficiais do **EB do Gandra**. O botão abre um menu privado com os scripts disponíveis para seu cargo ou patente.',
  rows: [[{type: 2, style: 1, custom_id: trainingMenuButton, label: 'Ver scripts de treinamento'}]]
 });
}
