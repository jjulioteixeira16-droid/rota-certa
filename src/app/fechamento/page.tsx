"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Motoboy = { id: string; name: string };
type Lancamento = {
  rider_id: string;
  type: string;
  amount: number;
};

function hojeISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dinheiro(n: number) {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

export default function FechamentoPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [dataRef, setDataRef] = useState(hojeISO());

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

      const [r, e] = await Promise.all([
        supabase.from("riders").select("id, name").eq("company_id", id).order("name"),
        supabase
          .from("entries")
          .select("rider_id, type, amount")
          .eq("company_id", id)
          .eq("entry_date", dataRef),
      ]);

      if (r.error || e.error) {
        setMensagem(r.error?.message || e.error?.message || "");
      } else {
        setMotoboys(r.data ?? []);
        setLancamentos(e.data ?? []);
      }

      setCarregando(false);
    }

    iniciar();
  }, [router, dataRef]);

  if (carregando) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </main>
    );
  }

  const linhas = motoboys
    .map((m) => {
      const itens = lancamentos.filter((l) => l.rider_id === m.id);
      const entregas = itens.filter((l) => l.type === "entrega");
      const combustivel = itens
        .filter((l) => l.type === "combustivel")
        .reduce((acc, l) => acc + Number(l.amount), 0);
      const bonus = itens
        .filter((l) => l.type === "bonus")
        .reduce((acc, l) => acc + Number(l.amount), 0);
      const taxas = entregas.reduce((acc, l) => acc + Number(l.amount), 0);
      const total = taxas + combustivel + bonus;

      return {
        id: m.id,
        nome: m.name,
        qtd: entregas.length,
        taxas,
        combustivel,
        bonus,
        total,
      };
    })
    .filter((l) => l.qtd > 0 || l.combustivel > 0 || l.bonus > 0);

  const geral = linhas.reduce(
    (acc, l) => ({
      qtd: acc.qtd + l.qtd,
      taxas: acc.taxas + l.taxas,
      combustivel: acc.combustivel + l.combustivel,
      bonus: acc.bonus + l.bonus,
      total: acc.total + l.total,
    }),
    { qtd: 0, taxas: 0, combustivel: 0, bonus: 0, total: 0 }
  );

  return (
    <main className="min-h-screen bg-zinc-100 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold">Fechamento</h1>
          <a href="/dashboard" className="underline text-sm">
            Voltar
          </a>
        </div>

        <label className="block text-sm text-zinc-600 mb-6">
          Data
          <input
            type="date"
            value={dataRef}
            onChange={(e) => {
              setCarregando(true);
              setDataRef(e.target.value);
            }}
            className="mt-1 w-full max-w-xs border rounded-lg px-3 py-2"
          />
        </label>

        {mensagem && <p className="text-sm text-red-600 mb-4">{mensagem}</p>}

        {linhas.length === 0 ? (
          <p className="text-zinc-600">Ainda não há lançamentos hoje.</p>
        ) : (
          <div className="space-y-4">
            {linhas.map((l) => (
              <div key={l.id} className="border rounded-xl p-4">
                <p className="font-bold mb-2">{l.nome}</p>
                <p className="text-sm text-zinc-700">Entregas: {l.qtd}</p>
                <p className="text-sm text-zinc-700">Taxas: {dinheiro(l.taxas)}</p>
                <p className="text-sm text-zinc-700">Combustível: {dinheiro(l.combustivel)}</p>
                <p className="text-sm text-zinc-700">Bônus: {dinheiro(l.bonus)}</p>
                <p className="mt-2 font-medium">Total: {dinheiro(l.total)}</p>
              </div>
            ))}

            <div className="border-2 rounded-xl p-4">
              <p className="font-bold mb-2">Total geral do dia</p>
              <p className="text-sm">Entregas: {geral.qtd}</p>
              <p className="text-sm">Taxas: {dinheiro(geral.taxas)}</p>
              <p className="text-sm">Combustível: {dinheiro(geral.combustivel)}</p>
              <p className="text-sm">Bônus: {dinheiro(geral.bonus)}</p>
              <p className="mt-2 font-bold">Total: {dinheiro(geral.total)}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}