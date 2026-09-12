"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";

type Bairro = {
  id: string;
  name: string;
  fee: number;
  active: boolean;
};

function normalizarNome(nome: string) {
  return nome.trim().replace(/\s+/g, " ").toLowerCase();
}

function dinheiro(n: number) {
  return `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
}

export default function BairrosPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [painelAberto, setPainelAberto] = useState(false);

  function limparCampos(manterAberto = true) {
    setEditandoId(null);
    setNome("");
    setValor("");
    if (!manterAberto) setPainelAberto(false);
  }

  async function carregarBairros(idEmpresa: string) {
    const { data, error } = await supabase
      .from("neighborhoods")
      .select("id, name, fee, active")
      .eq("company_id", idEmpresa)
      .order("name");

    if (error) {
      setMensagem(error.message);
      return;
    }

    setBairros(data ?? []);
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
      await carregarBairros(id);
      setCarregando(false);
    }

    iniciar();
  }, [router]);

  function abrirNovo() {
    setEditandoId(null);
    setNome("");
    setValor("");
    setMensagem("");
    setPainelAberto(true);
  }

  function comecarEdicao(bairro: Bairro) {
    setEditandoId(bairro.id);
    setNome(bairro.name);
    setValor(String(bairro.fee).replace(".", ","));
    setMensagem("");
    setPainelAberto(true);
  }

  async function salvarBairro(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId) return;

    setMensagem("");

    const nomeLimpo = nome.trim().replace(/\s+/g, " ");
    const fee = Number(valor.replace(",", "."));

    if (!nomeLimpo) {
      setMensagem("Digite o nome do bairro.");
      return;
    }

    if (Number.isNaN(fee)) {
      setMensagem("Digite um valor válido. Ex: 7,00");
      return;
    }

    const nomeJaExiste = bairros.some(
      (b) =>
        normalizarNome(b.name) === normalizarNome(nomeLimpo) &&
        b.id !== editandoId
    );

    if (nomeJaExiste) {
      setMensagem("Já existe um bairro com esse nome.");
      return;
    }

    setSalvando(true);

    const { error } = editandoId
      ? await supabase
          .from("neighborhoods")
          .update({ name: nomeLimpo, fee })
          .eq("id", editandoId)
      : await supabase.from("neighborhoods").insert({
          company_id: empresaId,
          name: nomeLimpo,
          fee,
          active: true,
        });

    setSalvando(false);

    if (error) {
      if (error.message.toLowerCase().includes("duplicate") || error.code === "23505") {
        setMensagem("Já existe um bairro com esse nome.");
        return;
      }
      setMensagem(error.message);
      return;
    }

    setEditandoId(null);
    setNome("");
    setValor("");
    await carregarBairros(empresaId);
  }

  async function alternarAtivo(bairro: Bairro) {
    if (!empresaId) return;
    const { error } = await supabase
      .from("neighborhoods")
      .update({ active: !bairro.active })
      .eq("id", bairro.id);

    if (error) {
      setMensagem(error.message);
      return;
    }
    await carregarBairros(empresaId);
  }

  async function excluirBairro(id: string) {
    if (!empresaId) return;
    const ok = window.confirm("Excluir este bairro?");
    if (!ok) return;

    const { error } = await supabase.from("neighborhoods").delete().eq("id", id);
    if (error) {
      setMensagem(error.message);
      return;
    }
    if (editandoId === id) limparCampos(true);
    await carregarBairros(empresaId);
  }

  if (carregando) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f4efe6]">
        <p>Carregando...</p>
      </main>
    );
  }

  const ativos = bairros.filter((b) => b.active).length;

  return (
    <AppShell title="Bairros e valores" badge={`${ativos} ativos`}>
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={abrirNovo}
          className="bg-orange-500 text-white rounded-full w-10 h-10 text-2xl leading-none"
        >
          +
        </button>
      </div>

      {mensagem && <p className="text-sm text-red-600 mb-4">{mensagem}</p>}

      {bairros.length === 0 ? (
        <p className="text-stone-600">Nenhum bairro cadastrado ainda.</p>
      ) : (
        <ul className="divide-y divide-stone-200">
          {bairros.map((bairro) => (
            <li key={bairro.id} className="py-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{bairro.name}</p>
                <p className="text-sm text-stone-600">
                  {dinheiro(bairro.fee)} · {bairro.active ? "Ativo" : "Inativo"}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 text-sm">
                <button onClick={() => comecarEdicao(bairro)} className="underline">
                  Editar
                </button>
                <button onClick={() => alternarAtivo(bairro)} className="underline">
                  {bairro.active ? "Desativar" : "Ativar"}
                </button>
                <button
                  onClick={() => excluirBairro(bairro.id)}
                  className="text-red-600 underline"
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {painelAberto && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">
                {editandoId ? "Editar bairro" : "Novo bairro"}
              </h2>
              <button type="button" onClick={() => limparCampos(false)} className="text-xl px-2">
                ×
              </button>
            </div>
            <form onSubmit={salvarBairro} className="grid gap-3">
              <input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do bairro"
                className="border border-stone-300 rounded-lg px-3 py-2"
              />
              <input
                required
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Valor. Ex: 8,00"
                className="border border-stone-300 rounded-lg px-3 py-2"
              />
              <button
                disabled={salvando}
                className="bg-orange-500 text-white rounded-lg py-2.5 font-medium"
              >
                {salvando ? "Salvando..." : editandoId ? "Salvar alteração" : "Adicionar"}
              </button>
              <button
                type="button"
                onClick={() => limparCampos(false)}
                className="border border-stone-300 rounded-lg py-2"
              >
                Fechar
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
