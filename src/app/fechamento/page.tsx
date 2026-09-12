"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";

type Motoboy = {
  id: string;
  name: string;
  pix_type: string | null;
  pix_key: string | null;
};

type Lancamento = {
  rider_id: string;
  type: string;
  amount: number;
};

type Payout = {
  id: string;
  rider_id: string;
  paid: boolean;
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
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [dataRef, setDataRef] = useState(hojeISO());
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  async function carregar(idEmpresa: string, data: string) {
    const [r, e, p] = await Promise.all([
      supabase
        .from("riders")
        .select("id, name, pix_type, pix_key")
        .eq("company_id", idEmpresa)
        .order("name"),
      supabase
        .from("entries")
        .select("rider_id, type, amount")
        .eq("company_id", idEmpresa)
        .eq("entry_date", data),
      supabase
        .from("payouts")
        .select("id, rider_id, paid")
        .eq("company_id", idEmpresa)
        .eq("payout_date", data),
    ]);

    if (r.error || e.error || p.error) {
      setMensagem(r.error?.message || e.error?.message || p.error?.message || "");
      return;
    }

    setMotoboys(r.data ?? []);
    setLancamentos(e.data ?? []);
    setPayouts(p.data ?? []);
    setMensagem("");
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
      await carregar(id, dataRef);
      setCarregando(false);
    }

    iniciar();
  }, [router]);

  useEffect(() => {
    if (!empresaId) return;
    setCarregando(true);
    carregar(empresaId, dataRef).finally(() => setCarregando(false));
  }, [dataRef, empresaId]);

  async function marcarPago(riderId: string, pagoAgora: boolean) {
    if (!empresaId) return;
    setSalvandoId(riderId);
    setMensagem("");

    const existente = payouts.find((p) => p.rider_id === riderId);

    if (existente) {
      const { error } = await supabase
        .from("payouts")
        .update({
          paid: pagoAgora,
          paid_at: pagoAgora ? new Date().toISOString() : null,
        })
        .eq("id", existente.id);

      if (error) {
        setMensagem(error.message);
        setSalvandoId(null);
        return;
      }
    } else {
      const { error } = await supabase.from("payouts").insert({
        company_id: empresaId,
        rider_id: riderId,
        payout_date: dataRef,
        paid: pagoAgora,
        paid_at: pagoAgora ? new Date().toISOString() : null,
      });

      if (error) {
        setMensagem(error.message);
        setSalvandoId(null);
        return;
      }
    }

    await carregar(empresaId, dataRef);
    setSalvandoId(null);
  }

  if (carregando) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f4efe6]">
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
      const payout = payouts.find((p) => p.rider_id === m.id);
      const pago = payout?.paid === true;

      return {
        id: m.id,
        nome: m.name,
        pixTipo: m.pix_type,
        pixChave: m.pix_key,
        qtd: entregas.length,
        taxas,
        combustivel,
        bonus,
        total,
        pago,
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
      pago: acc.pago + (l.pago ? l.total : 0),
      pendente: acc.pendente + (l.pago ? 0 : l.total),
    }),
    { qtd: 0, taxas: 0, combustivel: 0, bonus: 0, total: 0, pago: 0, pendente: 0 }
  );

  return (
    <AppShell title="Fechamento">
      <label className="block text-sm text-stone-600 mb-6">
        Data
        <input
          type="date"
          value={dataRef}
          onChange={(e) => setDataRef(e.target.value)}
          className="mt-1 w-full max-w-xs border border-stone-300 rounded-lg px-3 py-2"
        />
      </label>

      {mensagem && <p className="text-sm text-red-600 mb-4">{mensagem}</p>}

      {linhas.length === 0 ? (
        <p className="text-stone-600">Ainda não há lançamentos nesta data.</p>
      ) : (
        <div className="space-y-4">
          {linhas.map((l) => (
            <div key={l.id} className="border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="font-bold">{l.nome}</p>
                <span
                  className={
                    l.pago
                      ? "text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-800"
                      : "text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-800"
                  }
                >
                  {l.pago ? "Pago" : "Pendente"}
                </span>
              </div>
              <p className="text-sm text-stone-700">Entregas: {l.qtd}</p>
              <p className="text-sm text-stone-700">Taxas: {dinheiro(l.taxas)}</p>
              <p className="text-sm text-stone-700">Combustível: {dinheiro(l.combustivel)}</p>
              <p className="text-sm text-stone-700">Bônus: {dinheiro(l.bonus)}</p>
              <p className="mt-2 font-medium">Total: {dinheiro(l.total)}</p>
              {l.pixChave ? (
                <p className="text-sm text-stone-600 mt-1">
                  Pix ({l.pixTipo}): {l.pixChave}
                </p>
              ) : (
                <p className="text-sm text-stone-500 mt-1">Pix não cadastrado</p>
              )}
              <button
                type="button"
                disabled={salvandoId === l.id}
                onClick={() => marcarPago(l.id, !l.pago)}
                className="mt-3 w-full border border-stone-300 rounded-lg py-2 text-sm"
              >
                {salvandoId === l.id
                  ? "Salvando..."
                  : l.pago
                  ? "Marcar como pendente"
                  : "Marcar como pago"}
              </button>
            </div>
          ))}

          <div className="border-2 border-stone-900 rounded-xl p-4">
            <p className="font-bold mb-2">Total geral do dia</p>
            <p className="text-sm">Entregas: {geral.qtd}</p>
            <p className="text-sm">Taxas: {dinheiro(geral.taxas)}</p>
            <p className="text-sm">Combustível: {dinheiro(geral.combustivel)}</p>
            <p className="text-sm">Bônus: {dinheiro(geral.bonus)}</p>
            <p className="mt-2 font-bold">Total: {dinheiro(geral.total)}</p>
            <p className="text-sm mt-2">Já pago: {dinheiro(geral.pago)}</p>
            <p className="text-sm">Ainda pendente: {dinheiro(geral.pendente)}</p>
          </div>
        </div>
      )}
    </AppShell>
  );
}