// api/setup.js — cria tabelas no PostgreSQL (Neon)
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    const sql = neon(process.env.DATABASE_URL);

    await sql`CREATE TABLE IF NOT EXISTS clientes(
      id          text PRIMARY KEY,
      codigo      text UNIQUE,
      nome        text NOT NULL,
      telefone    text,
      responsavel text
    )`;

    await sql`CREATE TABLE IF NOT EXISTS atendimentos(
      id           text PRIMARY KEY,
      cliente_id   text NOT NULL REFERENCES clientes(id),
      titulo       text NOT NULL,
      modulo       text,
      motivo       text,
      data         date,
      solicitante  text,
      status       text NOT NULL DEFAULT 'aberto'
    )`;

    await sql`CREATE TABLE IF NOT EXISTS ordens(
      id         text PRIMARY KEY,
      numero     text NOT NULL,
      titulo     text NOT NULL,
      status     text NOT NULL DEFAULT 'Lançado',
      previsto   date,
      created_at timestamptz DEFAULT now()
    )`;

    res.status(200).json({ ok: true, msg: 'Tabelas criadas/atualizadas ✅' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
}
