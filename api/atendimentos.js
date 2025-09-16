// api/atendimentos.js — GET lista, POST cria, PATCH muda status, DELETE apaga
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'POST') {
      // cria um atendimento
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const {
        id, cliente_id, titulo, modulo = null, motivo = null,
        data = null, solicitante = null, col = 'aberto'
      } = body || {};
      if (!id || !cliente_id || !titulo) {
        return res.status(400).json({ ok:false, error:'id, cliente_id e titulo são obrigatórios' });
      }
      // usamos a coluna "status" do banco para guardar a coluna do kanban
      await sql`
        INSERT INTO atendimentos (id, cliente_id, titulo, modulo, motivo, data, solicitante, status)
        VALUES (${id}, ${cliente_id}, ${titulo}, ${modulo}, ${motivo}, ${data}, ${solicitante}, ${col})
      `;
      return res.status(201).json({ ok:true });
    }

    if (req.method === 'PATCH') {
      // atualiza somente o status/coluna do kanban
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, col } = body || {};
      if (!id || !col) return res.status(400).json({ ok:false, error:'id e col são obrigatórios' });
      await sql`UPDATE atendimentos SET status = ${col} WHERE id = ${id}`;
      return res.status(200).json({ ok:true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query || {};
      if (!id) return res.status(400).json({ ok:false, error:'id é obrigatório' });
      await sql`DELETE FROM atendimentos WHERE id = ${id}`;
      return res.status(200).json({ ok:true });
    }

    // GET: lista todos, mapeando status->col
    const rows = await sql`SELECT * FROM atendimentos`;
    const out = rows.map(r => ({ ...r, col: r.status }));
    return res.status(200).json(out);

  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:String(e) });
  }
}
