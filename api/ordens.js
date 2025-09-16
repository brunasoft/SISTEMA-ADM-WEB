// api/ordens.js — GET lista ordens; POST cria ordem
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      const {
        id,
        numero,
        titulo,
        status = 'Lançado',
        previsto = null
      } = body || {};

      if (!id || !numero || !titulo) {
        return res.status(400).json({ ok: false, error: 'id, numero e titulo são obrigatórios' });
      }

      await sql`
        INSERT INTO ordens (id, numero, titulo, status, previsto)
        VALUES (${id}, ${numero}, ${titulo}, ${status}, ${previsto})
      `;

      return res.status(201).json({ ok: true });
    }

    // GET — lista em ordem do mais recente
    const rows = await sql`SELECT * FROM ordens ORDER BY created_at DESC`;
    return res.status(200).json(rows);

  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
