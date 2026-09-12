"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Bairro = {
  id: string;
  name: string;
  fee: number;
};

function normalizarNome(nome: string) {
  return nome.trim().replace(/\s+/g, " ").toLowerCase();
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

  function limparFormulario() {
    setEditandoId(null);
    setNome("");
    setValor("");
  }

  async function carregarBairros(idEmpresa: string) {
    const { data, error } = await supabase
      .from("neighborhoods")
      .select("id, name, fee")
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

  function comecarEdicao(bairro: Bairro) {
    setEditandoId(bairro.id);
    setNome(bairro.name);
    setValor(String(bairro.fee).replace(".", ","));
    setMensagem("");
    window.scrollTo({ top: 0, behavior: "smooth" });
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

    limparFormulario();
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
    if (editandoId === id) limparFormulario();
    await carregarBairros(empresaId);
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
            {editandoId ? "Editar bairro" : "Bairros e valores"}
          </h1>
          <a href="/dashboard" className="underline text-sm">
            Voltar
          </a>
        </div>

        <form onSubmit={salvarBairro} className="grid gap-3 sm:grid-cols-3 mb-6">
          <input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do bairro"
            className="border rounded-lg px-3 py-2"
          />
          <input
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Valor. Ex: 8,00"
            className="border rounded-lg px-3 py-2"
          />
          <div className="flex gap-2">
            <button
              disabled={salvando}
              className="flex-1 bg-black text-white rounded-lg py-2"
            >
              {salvando ? "Salvando..." : editandoId ? "Salvar" : "Adicionar"}
            </button>
            {editandoId && (
              <button
                type="button"
                onClick={limparFormulario}
                className="border rounded-lg px-3 py-2"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        {mensagem && <p className="text-sm text-red-600 mb-4">{mensagem}</p>}

        {bairros.length === 0 ? (
          <p className="text-zinc-600">Nenhum bairro cadastrado ainda.</p>
        ) : (
          <ul className="divide-y">
            {bairros.map((bairro) => (
              <li
                key={bairro.id}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium">{bairro.name}</p>
                  <p className="text-sm text-zinc-600">
                    R$ {Number(bairro.fee).toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <div className="flex gap-3 text-sm">
                  <button
                    onClick={() => comecarEdicao(bairro)}
                    className="underline"
                  >
                    Editar
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
      </div>
    </main>
  );
}