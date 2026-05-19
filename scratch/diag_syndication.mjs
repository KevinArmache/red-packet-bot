// Script de diagnostic - teste directement l'API Syndication
const url = 'https://syndication.twitter.com/srv/timeline-profile/screen-name/binanceboxcode';

fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1'
  }
}).then(async r => {
  console.log('>>> HTTP Status:', r.status);
  if (r.status !== 200) { console.log('BLOQUÉ - pas de 200'); return; }

  const html = await r.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);
  if (!match) {
    console.log('>>> __NEXT_DATA__ INTROUVABLE!');
    console.log('>>> Début du HTML reçu:', html.slice(0, 800));
    return;
  }

  const data = JSON.parse(match[1]);
  const entries = data?.props?.pageProps?.timeline?.entries || [];
  console.log('>>> Nombre d\'entrées:', entries.length);

  if (entries.length === 0) {
    console.log('>>> Structure pageProps:', JSON.stringify(Object.keys(data?.props?.pageProps || {})));
    return;
  }

  const first = entries[0];
  console.log('>>> Clés entry[0]:', JSON.stringify(Object.keys(first)));
  console.log('>>> Clés entry[0].content:', JSON.stringify(Object.keys(first.content || {})));

  const tweet = first?.content?.tweet;
  if (tweet) {
    console.log('>>> Premier tweet texte:', tweet.text?.slice(0, 200));
  } else {
    console.log('>>> PAS DE "tweet" dans content. Content complet:', JSON.stringify(first.content)?.slice(0, 400));
  }
}).catch(e => console.error('ERREUR FETCH:', e.message));
