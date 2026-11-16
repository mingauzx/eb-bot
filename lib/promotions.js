import {randomBytes} from 'node:crypto';
import {safeUrl} from './config.js';

const snowflake = /^\d{17,20}$/;
export const ticketButton = /^promo-ticket:(\d{17,20}):(\d{17,20})$/;

export function validatePromotion(input) {
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Preencha os dados da promoção.');
 const promotion = {};
 for (const [key, label, max, optional] of [
  ['title', 'Título', 200], ['description', 'Descrição', 3600], ['bannerUrl', 'Banner', 512, true],
  ['shopUrl', 'Link da loja', 512, true], ['shopLabel', 'Nome do botão da loja', 80, true],
  ['ticketLabel', 'Nome do botão de ticket', 80, true]
 ]) {
  const value = input[key] ?? '';
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) throw new Error(label+' inválido.');
  promotion[key] = value.trim();
 }
 for (const [key, label] of [['channelId','canal'],['categoryId','categoria de tickets'],['staffRoleId','cargo de atendimento'],['pingRoleId','cargo de notificação']]) {
  const value = input[key] ?? '';
  if (typeof value !== 'string' || (value && !snowflake.test(value)) || (key === 'channelId' && !value)) throw new Error('Escolha um '+label+' válido.');
  promotion[key] = value;
 }
 for (const url of [promotion.bannerUrl, promotion.shopUrl]) {
  if (url && !safeUrl(url)) throw new Error('Use um endereço HTTPS válido para o banner e para a loja.');
 }
 if (Boolean(promotion.categoryId) !== Boolean(promotion.staffRoleId)) throw new Error('Para abrir tickets, selecione a categoria e o cargo de atendimento.');
 if (typeof input.color !== 'string' || !/^#[\da-f]{6}$/i.test(input.color)) throw new Error('Escolha uma cor válida.');
 promotion.color = input.color;
 return promotion;
}

export function promotionMessage(promotion) {
 const {title,description,bannerUrl,color,shopUrl,shopLabel,categoryId,staffRoleId,ticketLabel,pingRoleId} = promotion;
 const components = [{type:10,content:'## '+title}];
 if (bannerUrl) components.push({type:12,items:[{media:{url:bannerUrl},description:'Banner da promoção'}]});
 components.push({type:14,divider:true,spacing:1},{type:10,content:description});
 const buttons = [];
 if (shopUrl) buttons.push({type:2,style:5,label:shopLabel||'Loja Site',url:shopUrl});
 if (categoryId) buttons.push({type:2,style:1,label:ticketLabel||'Comprar com vendedor',custom_id:'promo-ticket:'+categoryId+':'+staffRoleId});
 if (buttons.length) components.push({type:14,divider:true,spacing:1},{type:1,components:buttons});
 const payload = {flags:32768,components:[{type:17,accent_color:parseInt(color.slice(1),16),components}],
  allowed_mentions:{parse:[],roles:pingRoleId?[pingRoleId]:[]},nonce:randomBytes(12).toString('hex'),enforce_nonce:true};
 if (pingRoleId) payload.components.push({type:10,content:'<@&'+pingRoleId+'>'});
 return payload;
}
