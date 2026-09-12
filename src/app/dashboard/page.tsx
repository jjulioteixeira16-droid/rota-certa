"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";

type Lancamento = {
  rider_id: string;
  type: string;
  amount: number;
};

type Motoboy = {
  id: string;
  name: string;
};

type Payout = {
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

function dataPorExtenso() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function dinheiro(n: number) {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [precisaEmpresa, setPrecisaEmpresa] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  useEffect(() => {
    async function iniciar() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.push("/login");
        return;
      }

      setEmail(user.email ?? null);
      setUserId(user.id);

      const { data: perfil } = await supabase
        .from("profiles")
        .select("company_id, companies(name)")
        .eq("id", user.id)
        .maybeSingle();

      let empresaId = perfil?.company_id as string | undefined;
      if (empresaId) {
        const empresa = perfil?.companies as { name?: string } | { name?: string }[] | null;
        const nome = Array.isArray(empresa) ? empresa[0]?.name : empresa?.name;
        setNomeEmpresa(nome ?? "");
      } else {
        const { data: empresaDona } = await supabase
          .from("companies")
          .select("id, name")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (empresaDona) {
          await supabase.from("profiles").insert({
            id: user.id,
            company_id: empresaDona.id,
            full_name: user.email ?? "Dono",
            role: "owner",
          });
          empresaId = empresaDona.id;
          setNomeEmpresa(empresaDona.name);
        }
      }

      if (!empresaId) {
        setPrecisaEmpresa(true);
        setCarregando(false);
        return;
      }

      const dataHoje = hojeISO();
      const [r, e, p] = await Promise.all([
        supabase.from("riders").select("id, name").eq("company_id", empresaId).order("name"),
        supabase
          .from("entries")
          .select("rider_id, type, amount")
          .eq("company_id", empresaId)
          .eq("entry_date", dataHoje),
        supabase
          .from("payouts")
          .select("rider_id, paid")
          .eq("company_id", empresaId)
          .eq("payout_date", dataHoje),
      ]);

      setMotoboys(r.data ?? []);
      setLancamentos(e.data ?? []);
      setPayouts(p.data ?? []);
      setPrecisaEmpresa(false);
      setCarregando(false);
    }

    iniciar();
  }, [router]);

  async function salvarEmpresa(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setMensagem("");
    setSalvando(true);

    const { data: empresa, error: erroEmpresa } = await supabase
      .from("companies")
      .insert({
        name: nomeEmpresa.trim(),
        owner_id: userId,
      })
      .select("id, name")
      .single();

    if (erroEmpresa || !empresa) {
      setMensagem(erroEmpresa?.message ?? "Não deu para salvar a empresa.");
      setSalvando(false);
      return;
    }

    const { error: erroPerfil } = await supabase.from("profiles").insert({
      id: userId,
      company_id: empresa.id,
      full_name: email ?? "Dono",
      role: "owner",
    });

    setSalvando(false);

    if (erroPerfil) {
      setMensagem(erroPerfil.message);
      return;
    }

    window.location.reload();
  }

  async function sair() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (carregando) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f4efe6]">
        <p>Carregando...</p>
      </main>
    );
  }

  if (precisaEmpresa) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f4efe6] p-4">
        <form
          onSubmit={salvarEmpresa}
          className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4"
        >
          <h1 className="text-2xl font-bold">Sua empresa</h1>
          <p className="text-stone-600">
            Seu login já existe. Agora vamos gravar o nome da lanchonete/padaria.
          </p>
          <input
            required
            value={nomeEmpresa}
            onChange={(e) => setNomeEmpresa(e.target.value)}
            placeholder="Ex: Rushtedby"
            className="w-full border border-stone-300 rounded-lg px-3 py-2"
          />
          {mensagem && <p className="text-sm text-red-600">{mensagem}</p>}
          <button
            disabled={salvando}
            className="w-full bg-orange-500 text-white rounded-lg py-2.5 font-medium"
          >
            {salvando ? "Salvando..." : "Salvar empresa"}
          </button>
        </form>
      </main>
    );
  }

  const qtdEntregas = lancamentos.filter((l) => l.type === "entrega").length;
  const taxas = lancamentos
    .filter((l) => l.type === "entrega")
    .reduce((acc, l) => acc + Number(l.amount), 0);
  const combustivel = lancamentos
    .filter((l) => l.type === "combustivel")
    .reduce((acc, l) => acc + Number(l.amount), 0);
  const bonus = lancamentos
    .filter((l) => l.type === "bonus")
    .reduce((acc, l) => acc + Number(l.amount), 0);
  const total = taxas + combustivel + bonus;

  const porMotoboy = motoboys
    .map((m) => {
      const itens = lancamentos.filter((l) => l.rider_id === m.id);
      const soma = itens.reduce((acc, l) => acc + Number(l.amount), 0);
      const pago = payouts.some((p) => p.rider_id === m.id && p.paid);
      return {
        id: m.id,
        nome: m.name,
        qtd: itens.length,
        total: soma,
        pago,
      };
    })
    .filter((m) => m.qtd > 0);

  const totalPago = porMotoboy
    .filter((m) => m.pago)
    .reduce((acc, m) => acc + m.total, 0);
  const totalPendente = total - totalPago;

  return (
    <AppShell title="Início">
      <p className="text-stone-600 -mt-2 mb-1">
        {nomeEmpresa || "Empresa"} · {email}
      </p>
      <p className="text-sm text-stone-500 mb-6 capitalize">{dataPorExtenso()}</p>

      <p className="text-sm font-medium text-stone-500 mb-2">Resumo do dia</p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="border border-stone-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">Entregas</p>
          <p className="text-2xl font-bold mt-1">{qtdEntregas}</p>
        </div>
        <div className="border border-stone-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">Total a pagar</p>
          <p className="text-2xl font-bold mt-1">{dinheiro(total)}</p>
        </div>
        <div className="border border-stone-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">Combustível</p>
          <p className="text-2xl font-bold mt-1">{dinheiro(combustivel)}</p>
        </div>
        <div className="border border-stone-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">Bônus</p>
          <p className="text-2xl font-bold mt-1">{dinheiro(bonus)}</p>
        </div>
      </div>

      <p className="text-sm font-medium text-stone-500 mb-2">Por motoboy</p>
      {porMotoboy.length === 0 ? (
        <p className="text-stone-600 mb-6">Ainda não há lançamentos hoje.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {porMotoboy.map((m) => (
            <div
              key={m.id}
              className="border border-stone-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
            >
              <div>
                <p className="font-semibold">{m.nome}</p>
                <p className="text-sm text-stone-500">
                  {m.qtd} {m.qtd === 1 ? "lançamento" : "lançamentos"}
                  {" · "}
                  {m.pago ? "Pago" : "Pendente"}
                </p>
              </div>
              <p className="font-semibold">{dinheiro(m.total)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="border border-stone-200 rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-stone-500 mb-2">Fechamento do dia</p>
        <div className="flex justify-between text-sm py-1">
          <span>Total</span>
          <span className="font-medium">{dinheiro(total)}</span>
        </div>
        <div className="flex justify-between text-sm py-1">
          <span>Pago</span>
          <span className="font-medium text-green-700">{dinheiro(totalPago)}</span>
        </div>
        <div className="flex justify-between text-sm py-1">
          <span>Pendente</span>
          <span className="font-medium text-amber-700">{dinheiro(totalPendente)}</span>
        </div>
      </div>

      <div className="grid gap-3 mb-6">
        <a
          href="/lancamentos"
          className="bg-orange-500 text-white rounded-xl py-3 text-center font-medium"
        >
          + Lançar entrega
        </a>
        <a
          href="/fechamento"
          className="border border-stone-300 rounded-xl py-3 text-center font-medium"
        >
          Fechamento do dia
        </a>
      </div>

      <button onClick={sair} className="border border-stone-300 rounded-lg px-4 py-2">
        Sair
      </button>
    </AppShell>
  );
}
