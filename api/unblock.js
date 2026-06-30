const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const adminPassword = req.headers['x-admin-password'];
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const { nom } = req.body || {};
  if (!nom) return res.status(400).json({ error: 'Nom requis' });

  const nomNormalise = nom.trim().toLowerCase();
  const key = `etudiant:${nomNormalise}`;

  try {
    const existant = await kv.get(key);
    if (!existant) return res.status(404).json({ error: 'Étudiant introuvable' });

    // Supprimer l'entrée pour permettre un nouveau passage
    await kv.del(key);

    // Mettre à jour dans la liste globale
    const items = await kv.lrange('resultats', 0, -1);
    await kv.del('resultats');
    for (const item of items) {
      try {
        const obj = typeof item === 'string' ? JSON.parse(item) : item;
        if (obj.nom_normalise !== nomNormalise) {
          await kv.lpush('resultats', JSON.stringify(obj));
        }
      } catch {}
    }

    return res.status(200).json({ ok: true, message: `${nom} a été débloqué et peut repasser le QCM.` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
