"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

  async function carregarTudo(idEmpresa: string) {
    const dataHoje = dataRef;

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
        .select("id, type, amount, notes, entry_date, rider_id, neighborhood_id")
        .eq("company_id", idEmpresa)
        .eq("entry_date", dataHoje)
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

    const { error } = await supabase.from("entries").insert({
      company_id: empresaId,
      rider_id: riderId,
      neighborhood_id: tipo === "entrega" ? bairroId || null : null,
      type: tipo,
      amount,
      notes: obs.trim() || null,
      entry_date: dataRef,
    });

    setSalvando(false);

    if (error) {
      setMensagem(error.message);
      return;
    }

    setObs("");
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
      <main className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </main>
    );
  }

  const motoboysAtivos = motoboys.filter((m) => m.active);

  return (
    <main className="min-h-screen bg-zinc-100 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold">Lançamentos</h1>
          <a href="/dashboard" className="underline text-sm">
            Voltar
          </a>
        </div>

        <form onSubmit={salvar} className="grid gap-3 mb-8">
          <label className="text-sm text-zinc-600">
            Data
            <input
              type="date"
              required
              value={dataRef}
              onChange={(e) => setDataRef(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
          <select
            required
            value={riderId}
            onChange={(e) => setRiderId(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="">Selecione o motoboy</option>
            {motoboysAtivos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="entrega">Taxa de entrega</option>
            <option value="combustivel">Combustível</option>
            <option value="bonus">Bônus</option>
          </select>

          {tipo === "entrega" && (
            <select
              required
              value={bairroId}
              onChange={(e) => aoEscolherBairro(e.target.value)}
              className="border rounded-lg px-3 py-2"
            >
              <option value="">Selecione o bairro</option>
              {bairros.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — R$ {Number(b.fee).toFixed(2).replace(".", ",")}
                </option>
              ))}
            </select>
          )}

          <input
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Valor. Ex: 8,00"
            className="border rounded-lg px-3 py-2"
          />

          <input
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Observação (opcional)"
            className="border rounded-lg px-3 py-2"
          />

          <button
            disabled={salvando}
            className="bg-black text-white rounded-lg py-2"
          >
            {salvando ? "Salvando..." : "Lançar"}
          </button>
        </form>

        {mensagem && <p className="text-sm text-red-600 mb-4">{mensagem}</p>}

        {lista.length === 0 ? (
          <p className="text-zinc-600">Nenhum lançamento hoje.</p>
        ) : (
          <ul className="divide-y">
            {lista.map((item) => (
              <li key={item.id} className="py-3 flex justify-between gap-3">
                <div>
                  <p className="font-medium">{nomeMotoboy(item.rider_id)}</p>
                  <p className="text-sm text-zinc-600">
                    {tipoLabel(item.type)}
                    {item.neighborhood_id ? ` · ${nomeBairro(item.neighborhood_id)}` : ""}
                    {item.notes ? ` · ${item.notes}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    R$ {Number(item.amount).toFixed(2).replace(".", ",")}
                  </p>
                  <button
                    onClick={() => excluir(item.id)}
                    className="text-sm text-red-600 underline"
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