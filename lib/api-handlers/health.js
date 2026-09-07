module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Access-Control-Allow-Origin','*');
  res.status(200).json({
    ok:true,
    service:'clarinavi',
    edition:'unified',
    features:[
      'unified market refresh cadence',
      'editable market cards with TAIEX and TX futures',
      'voice stock search',
      'proportional sector treemap and five-day replay bar',
      'historical foreign trust dealer cost lines',
      'stock intraday price average line and volume charts',
      'ETF directory category filters and ranking tables',
      'TW stock top-100 price gain loss volume turnover rankings',
      'target price and PE river valuation',
      'industry-chain upstream peers downstream research',
      'private portfolio allocation charts',
      'opt-in anonymous public portfolio top-10 leaderboard',
      'watchlist portfolio industry calendar radar KOL'
    ],
    disclaimer:'資料可能延遲；研究估算不構成投資建議。'
  });
};
