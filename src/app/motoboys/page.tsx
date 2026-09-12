"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Motoboy = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  pix_type: string | null;
  pix_key: string | null;
};

const PIX_TIPOS = ["CPF", "CNPJ", "E-mail", "Telefone", "Chave aleatória"];

function formatarTelefoneBR(valor: string) {
  const digitos = (valor || "").replace(/\D/g, "").slice(0, 11);
  if (digitos.length === 0) return "";
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7, 11)}`;
}

export default function MotoboysPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [lista, setLista] = useState<Motoboy[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [pixTipo, setPixTipo] = useState(PIX_TIPOS[0]);
  const [pixChave, setPixChave] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  function limparFormulario() {
    setEditandoId(null);
    setNome("");
    setTelefone("");
    setPixTipo(PIX_TIPOS[0]);
    setPixChave("");
  }

  async function carregar(idEmpresa: string) {
    const { data, error } = await supabase
      .from("riders")
      .select("id, name, phone, active, pix_type, pix_key")
      .eq("company_id", idEmpresa)
      .order("name");

    if (error) {
      setMensagem(error.message);
      return;
    }
    setLista(data ?? []);
  }

  useEffect(() => {
    async function iniciar() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }

      const { data: perfil } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", data.user.id)
        .maybeSingle();

      const { data: empresaDona } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", data.user.id)
        .maybeSingle();

      const id = perfil?.company_id ?? empresaDona?.id ?? null;
      if (!id) {
        router.push("/dashboard");
        return;
      }

      setEmpresaId(id);
      await carregar(id);
      setCarregando(false);
    }

    iniciar();
  }, [router]);

  function comecarEdicao(m: Motoboy) {
    setEditandoId(m.id);
    setNome(m.name);
    setTelefone(formatarTelefoneBR(m.phone || ""));
    setPixTipo(m.pix_type && PIX_TIPOS.includes(m.pix_type) ? m.pix_type : PIX_TIPOS[0]);
    setPixChave(m.pix_key || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId) return;

    setMensagem("");
    setSalvando(true);

    const dados = {
      name: nome.trim(),
      phone: telefone.trim() || null,
      pix_type: pixTipo,
      pix_key: pixChave.trim() || null,
    };

    const { error } = editandoId
      ? await supabase.from("riders").update(dados).eq("id", editandoId)
      : await supabase.from("riders").insert({
          ...dados,
          company_id: empresaId,
          active: true,
        });

    setSalvando(false);

    if (error) {
      setMensagem(error.message);
      return;
    }

    limparFormulario();
    await carregar(empresaId);
  }

  async function alternarAtivo(motoboy: Motoboy) {
    if (!empresaId) return;
    const { error } = await supabase
      .from("riders")
      .update({ active: !motoboy.active })
      .eq("id", motoboy.id);

    if (error) {
      setMensagem(error.message);
      return;
    }
    await carregar(empresaId);
  }

  async function excluir(id: string) {
    if (!empresaId) return;
    const ok = window.confirm("Excluir este motoboy?");
    if (!ok) return;

    const { error } = await supabase.from("riders").delete().eq("id", id);
    if (error) {
      setMensagem(error.message);
      return;
    }
    if (editandoId === id) limparFormulario();
    await carregar(empresaId);
  }

  if (carregando) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold">
            {editandoId ? "Editar motoboy" : "Motoboys"}
          </h1>
          <a href="/dashboard" className="underline text-sm">
            Voltar
          </a>
        </div>

        <form onSubmit={salvar} className="grid gap-3 mb-6">
          <input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do motoboy"
            className="border rounded-lg px-3 py-2"
          />
          <input
            value={telefone}
            onChange={(e) => setTelefone(formatarTelefoneBR(e.target.value))}
            placeholder="Telefone (opcional)"
            className="border rounded-lg px-3 py-2"
          />
          <select
            value={pixTipo}
            onChange={(e) => setPixTipo(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            {PIX_TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
          <input
            value={pixChave}
            onChange={(e) => setPixChave(e.target.value)}
            placeholder="Chave Pix (opcional)"
            className="border rounded-lg px-3 py-2"
          />

          <div className="flex gap-3">
            <button
              disabled={salvando}
              className="flex-1 bg-black text-white rounded-lg py-2"
            >
              {salvando ? "Salvando..." : editandoId ? "Salvar alteração" : "Adicionar"}
            </button>
            {editandoId && (
              <button
                type="button"
                onClick={limparFormulario}
                className="border rounded-lg px-4 py-2"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        {mensagem && <p className="text-sm text-red-600 mb-4">{mensagem}</p>}

        {lista.length === 0 ? (
          <p className="text-zinc-600">Nenhum motoboy cadastrado ainda.</p>
        ) : (
          <ul className="divide-y">
            {lista.map((m) => (
              <li key={m.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-sm text-zinc-600">
                    {m.phone || "Sem telefone"} · {m.active ? "Ativo" : "Inativo"}
                  </p>
                  <p className="text-sm text-zinc-600">
                    {m.pix_key
                      ? `Pix (${m.pix_type}): ${m.pix_key}`
                      : "Pix não cadastrado"}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 text-sm">
                  <button onClick={() => comecarEdicao(m)} className="underline">
                    Editar
                  </button>
                  <button onClick={() => alternarAtivo(m)} className="underline">
                    {m.active ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => excluir(m.id)}
                    className="text-red-600 underline"
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}