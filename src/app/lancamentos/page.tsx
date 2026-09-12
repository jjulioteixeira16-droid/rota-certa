"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";

type Motoboy = { id: string; name: string; active: boolean };
type Bairro = { id: string; name: string; fee: number };
type Lancamento = {
  id: string;
  type: string;
  amount: number;
  notes: string | null;
  entry_date: string;
  rider_id: string;
  neighborhood_id: string | null;
  created_at?: string;
};

function hojeISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function tipoLabel(tipo: string) {
  if (tipo === "entrega") return "Taxa de entrega";
  if (tipo === "combustivel") return "Combustível";
  if (tipo === "bonus") return "Bônus";
  return tipo;
}

function dinheiro(n: number) {
  return `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
}

function hora(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function LancamentosPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [lista, setLista] = useState<Lancamento[]>([]);
  const [riderId, setRiderId] = useState("");
  const [tipo, setTipo] = useState("entrega");
  const [bairroId, setBairroId] = useState("");
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [dataRef, setDataRef] = useState(hojeISO());
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [painelAberto, setPainelAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  async function carregarTudo(idEmpresa: string) {
    const [r, b, e] = await Promise.all([
      supabase
        .from("riders")
        .select("id, name, active")
        .eq("company_id", idEmpresa)
        .order("name"),
      supabase
        .from("neighborhoods")
        .select("id, name, fee")
        .eq("company_id", idEmpresa)
        .order("name"),
      supabase
        .from("entries")
        .select("id, type, amount, notes, entry_date, rider_id, neighborhood_id, created_at")
        .eq("company_id", idEmpresa)
        .eq("entry_date", dataRef)
        .order("created_at", { ascending: false }),
    ]);

    if (r.error || b.error || e.error) {
      setMensagem(r.error?.message || b.error?.message || e.error?.message || "");
      return;
    }

    setMotoboys(r.data ?? []);
    setBairros(b.data ?? []);
    setLista(e.data ?? []);
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
      await carregarTudo(id);
      setCarregando(false);
    }

    iniciar();
  }, [router]);

  useEffect(() => {
    if (!empresaId) return;
    carregarTudo(empresaId);
  }, [dataRef, empresaId]);

  function aoEscolherBairro(id: string) {
    setBairroId(id);
    const bairro = bairros.find((item) => item.id === id);
    if (bairro) {
      setValor(String(bairro.fee).replace(".", ","));
    }
  }

  function abrirNovo() {
    setEditandoId(null);
    setObs("");
    if (tipo === "combustivel" || tipo === "bonus") {
      setValor("");
    }
    setMensagem("");
    setPainelAberto(true);
  }

  function fecharPainel() {
    setPainelAberto(false);
    setEditandoId(null);
    setMensagem("");
  }

  function comecarEdicao(item: Lancamento) {
    setEditandoId(item.id);
    setRiderId(item.rider_id);
    setTipo(item.type);
    setBairroId(item.neighborhood_id || "");
    setValor(String(item.amount).replace(".", ","));
    setObs(item.notes || "");
    setDataRef(item.entry_date);
    setMensagem("");
    setPainelAberto(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId) return;

    setMensagem("");
    setSalvando(true);

    const amount = Number(valor.replace(",", "."));
    if (Number.isNaN(amount)) {
      setMensagem("Digite um valor válido.");
      setSalvando(false);
      return;
    }

    const dados = {
      company_id: empresaId,
      rider_id: riderId,
      neighborhood_id: tipo === "entrega" ? bairroId || null : null,
      type: tipo,
      amount,
      notes: obs.trim() || null,
      entry_date: dataRef,
    };

    const { error } = editandoId
      ? await supabase.from("entries").update(dados).eq("id", editandoId)
      : await supabase.from("entries").insert(dados);

    setSalvando(false);

    if (error) {
      setMensagem(error.message);
      return;
    }

    setEditandoId(null);
    setObs("");
    if (tipo === "combustivel" || tipo === "bonus") {
      setValor("");
    }
    await carregarTudo(empresaId);
  }

  async function excluir(id: string) {
    if (!empresaId) return;
    const ok = window.confirm("Excluir este lançamento?");
    if (!ok) return;

    const { error } = await supabase.from("entries").delete().eq("id", id);
    if (error) {
      setMensagem(error.message);
      return;
    }
    if (editandoId === id) {
      setEditandoId(null);
    }
    await carregarTudo(empresaId);
  }

  function nomeMotoboy(id: string) {
    return motoboys.find((m) => m.id === id)?.name ?? "Motoboy";
  }

  function nomeBairro(id: string | null) {
    if (!id) return "";
    return bairros.find((b) => b.id === id)?.name ?? "";
  }

  if (carregando) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f4efe6]">
        <p>Carregando...</p>
      </main>
    );
  }

  const motoboysAtivos = motoboys.filter((m) => m.active);
  const qtdEntregas = lista.filter((l) => l.type === "entrega").length;
  const taxas = lista
    .filter((l) => l.type === "entrega")
    .reduce((acc, l) => acc + Number(l.amount), 0);
  const combustivel = lista
    .filter((l) => l.type === "combustivel")
    .reduce((acc, l) => acc + Number(l.amount), 0);
  const bonus = lista
    .filter((l) => l.type === "bonus")
    .reduce((acc, l) => acc + Number(l.amount), 0);
  const total = taxas + combustivel + bonus;

  const porMotoboy = motoboys
    .map((m) => {
      const itens = lista.filter((l) => l.rider_id === m.id);
      const soma = itens.reduce((acc, l) => acc + Number(l.amount), 0);
      return { id: m.id, nome: m.name, qtd: itens.length, total: soma };
    })
    .filter((m) => m.qtd > 0);

  return (
    <AppShell title="Lançamentos">
      <p className="text-stone-500 -mt-2 mb-5">
        Registre entregas, combustível e bônus de cada motoboy
      </p>

      <label className="block text-sm text-stone-600 mb-4">
        Visualizando o dia
        <input
          type="date"
          value={dataRef}
          onChange={(e) => setDataRef(e.target.value)}
          className="mt-1 w-full max-w-xs border border-stone-300 rounded-lg px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="border border-stone-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">Entregas no dia</p>
          <p className="text-2xl font-bold mt-1">{qtdEntregas}</p>
        </div>
        <div className="border border-stone-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">Total a pagar</p>
          <p className="text-2xl font-bold mt-1 text-orange-600">{dinheiro(total)}</p>
        </div>
      </div>

      <p className="text-sm font-medium text-stone-500 mb-2">Por categoria</p>
      <div className="border border-stone-200 rounded-xl divide-y divide-stone-200 mb-6">
        <div className="flex justify-between px-4 py-2 text-sm">
          <span>Taxas de entrega</span>
          <span className="font-medium">{dinheiro(taxas)}</span>
        </div>
        <div className="flex justify-between px-4 py-2 text-sm">
          <span>Combustível</span>
          <span className="font-medium">{dinheiro(combustivel)}</span>
        </div>
        <div className="flex justify-between px-4 py-2 text-sm">
          <span>Bônus</span>
          <span className="font-medium">{dinheiro(bonus)}</span>
        </div>
      </div>

      <p className="text-sm font-medium text-stone-500 mb-2">Por motoboy</p>
      {porMotoboy.length === 0 ? (
        <p className="text-stone-600 mb-6">Nenhum lançamento nesta data.</p>
      ) : (
        <div className="border border-stone-200 rounded-xl divide-y divide-stone-200 mb-6">
          {porMotoboy.map((m) => (
            <div key={m.id} className="flex justify-between px-4 py-2 text-sm">
              <span>
                {m.nome} · {m.qtd} {m.qtd === 1 ? "lançamento" : "lançamentos"}
              </span>
              <span className="font-medium">{dinheiro(m.total)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-stone-500">Lançamentos do dia</p>
        <button
          type="button"
          onClick={abrirNovo}
          className="bg-orange-500 text-white rounded-full w-10 h-10 text-2xl leading-none"
        >
          +
        </button>
      </div>

      {lista.length === 0 ? (
        <p className="text-stone-600 mb-24">Nenhum lançamento nesta data.</p>
      ) : (
        <ul className="space-y-2 mb-24">
          {lista.map((item) => (
            <li key={item.id} className="border border-stone-200 rounded-xl p-4 flex justify-between gap-3">
              <div>
                <p className="font-medium">
                  {nomeMotoboy(item.rider_id)}
                  {item.type === "entrega" && item.neighborhood_id
                    ? ` · ${nomeBairro(item.neighborhood_id)}`
                    : ` · ${tipoLabel(item.type)}`}
                </p>
                <p className="text-sm text-stone-500">
                  {hora(item.created_at)}
                  {hora(item.created_at) ? " · " : ""}
                  {dinheiro(item.amount)}
                  {item.notes ? ` · ${item.notes}` : ""}
                </p>
              </div>
              <div className="flex gap-3 text-sm items-start">
                <button onClick={() => comecarEdicao(item)} className="underline">
                  Editar
                </button>
                <button onClick={() => excluir(item.id)} className="text-red-600 underline">
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {painelAberto && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">
                {editandoId ? "Editar lançamento" : "Lançar entrega"}
              </h2>
              <button type="button" onClick={fecharPainel} className="text-xl px-2">
                ×
              </button>
            </div>

            <form onSubmit={salvar} className="grid gap-3">
              <label className="text-sm text-stone-600">
                Data
                <input
                  type="date"
                  required
                  value={dataRef}
                  onChange={(e) => setDataRef(e.target.value)}
                  className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2"
                />
              </label>

              <label className="text-sm text-stone-600">
                Motoboy
                <select
                  required
                  value={riderId}
                  onChange={(e) => setRiderId(e.target.value)}
                  className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2"
                >
                  <option value="">Selecione o motoboy</option>
                  {motoboysAtivos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <p className="text-sm text-stone-600 mb-2">Tipo de lançamento</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "entrega", label: "Taxa de entrega" },
                    { id: "combustivel", label: "Combustível" },
                    { id: "bonus", label: "Bônus" },
                  ].map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => {
                        setTipo(op.id);
                        if (op.id !== "entrega") setValor("");
                        else if (bairroId) aoEscolherBairro(bairroId);
                      }}
                      className={
                        tipo === op.id
                          ? "rounded-lg py-2 text-xs font-medium bg-orange-500 text-white"
                          : "rounded-lg py-2 text-xs font-medium border border-stone-300"
                      }
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>

              {tipo === "entrega" && (
                <label className="text-sm text-stone-600">
                  Bairro
                  <select
                    required
                    value={bairroId}
                    onChange={(e) => aoEscolherBairro(e.target.value)}
                    className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Selecione o bairro</option>
                    {bairros.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} — {dinheiro(b.fee)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="text-sm text-stone-600">
                Valor
                <input
                  required
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="Ex: 8,00"
                  className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2"
                />
              </label>

              <input
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Observação (opcional)"
                className="border border-stone-300 rounded-lg px-3 py-2"
              />

              {mensagem && <p className="text-sm text-red-600">{mensagem}</p>}

              <button
                disabled={salvando}
                className="bg-orange-500 text-white rounded-lg py-2.5 font-medium"
              >
                {salvando ? "Salvando..." : editandoId ? "Salvar alteração" : "Lançar"}
              </button>
              <button
                type="button"
                onClick={fecharPainel}
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
