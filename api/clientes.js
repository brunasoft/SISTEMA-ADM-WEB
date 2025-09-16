// api/clientes.js — GET lista, POST cria/atualiza (UPSERT), DELETE apaga
import { neon } from '@neondatabase/serverless';
export default async function handler(req, res){
  const sql = neon(process.env.DATABASE_URL);
  try{
    if (req.method === 'POST'){
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, codigo=null, nome, telefone=null, responsavel=null } = body || {};
      if (!id || !nome) return res.status(400).json({ ok:false, error:'id e nome são obrigatórios' });
      // upsert simples
      await sql`
        INSERT INTO clientes (id, codigo, nome, telefone, responsavel)
        VALUES (${id}, ${codigo}, ${nome}, ${telefone}, ${responsavel})
        ON CONFLICT (id) DO UPDATE SET
          codigo = EXCLUDED.codigo,
          nome = EXCLUDED.nome,
          telefone = EXCLUDED.telefone,
          responsavel = EXCLUDED.responsavel
      `;
      return res.status(201).json({ ok:true });
    }
    if (req.method === 'DELETE'){
      const { id } = req.query || {};
      if (!id) return res.status(400).json({ ok:false, error:'id é obrigatório' });
      await sql`DELETE FROM clientes WHERE id=${id}`;
      return res.status(200).json({ ok:true });
    }
    const rows = await sql`SELECT * FROM clientes ORDER BY nome`;
    return res.status(200).json(rows);
  }catch(e){
    console.error(e);
    return res.status(500).json({ ok:false, error:String(e) });
  }
}
