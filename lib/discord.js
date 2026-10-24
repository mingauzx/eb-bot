export async function discord(path,options={}) {
 if(!process.env.DISCORD_TOKEN)throw new Error('Token do bot não configurado.');
 const response=await fetch('https://discord.com/api/v10'+path,{...options,headers:{Authorization:'Bot '+process.env.DISCORD_TOKEN,'Content-Type':'application/json'},signal:AbortSignal.timeout(10000)});
 if(!response.ok) {const error=new Error(response.status===429?'Discord limitou os envios. Aguarde.':'Discord indisponível ou permissões insuficientes.');error.discordStatus=response.status;error.status=response.status===429?429:502;throw error;}
 return response.status===204?null:response.json();
}
export async function channel(guild,id) {
 const c=await discord('/channels/'+id);
 if(c.guild_id!==guild||![0,5].includes(c.type))throw new Error('Canal deve ser de texto deste servidor.');
 return c;
}
