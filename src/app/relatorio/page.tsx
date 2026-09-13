"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";

type Motoboy = { id: string; name: string };
type Bairro = { id: string; name: string };
type Lancamento = {
  id: string;
  rider_id: string;
  neighborhood_id: string | null;
  type: string;
  amount: number;
  entry_date: string;
};

function hojeISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function inicioSemana() {
  const d = new Date();
  const dia = d.getDay();
  const diff = dia === 0 ? 6 : dia - 1;
  d.setDate(d.getDate() - diff);
  return iso(d);
}

function inicioMes() {
  const d = new Date();
  d.setDate(1);
  return iso(d);
}

function dinheiro(n: number) {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

function dataBR(s: string) {
  const [y, m, d] = s.split("-");
  if (!d) return s;
  return `${d}/${m}/${y}`;
}

export default function RelatorioPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [lista, setLista] = useState<Lancamento[]>([]);
  const [atalho, setAtalho] = useState<"hoje" | "semana" | "mes" | "livre">("hoje");
  const [de, setDe] = useState(hojeISO());
  const [ate, setAte] = useState(hojeISO());
  const [riderId, setRiderId] = useState("");
  const [bairroId, setBairroId] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [mensagem, setMensagem] = useState("");

  function aplicarAtalho(tipo: "hoje" | "semana" | "mes") {
    setAtalho(tipo);
    const hoje = hojeISO();
    if (tipo === "hoje") {
      setDe(hoje);
      setAte(hoje);
    } else if (tipo === "semana") {
      setDe(inicioSemana());
      setAte(hoje);
    } else {
      setDe(inicioMes());
      setAte(hoje);
    }
  }

  async function carregarBase(idEmpresa: string) {
    const [r, b] = await Promise.all([
      supabase.from("riders").select("id, name").eq("company_id", idEmpresa).order("name"),
      supabase.from("neighborhoods").select("id, name").eq("company_id", idEmpresa).order("name"),
    ]);
    if (r.error || b.error) {
      setMensagem(r.error?.message || b.error?.message || "");
      return;
    }
    setMotoboys(r.data ?? []);
    setBairros(b.data ?? []);
  }

  async function carregarLancamentos(idEmpresa: string) {
    let q = supabase
      .from("entries")
      .select("id, rider_id, neighborhood_id, type, amount, entry_date")
      .eq("company_id", idEmpresa)
      .gte("entry_date", de)
      .lte("entry_date", ate)
      .order("entry_date", { ascending: false });

    if (riderId) q = q.eq("rider_id", riderId);
    if (bairroId) q = q.eq("neighborhood_id", bairroId);
    if (categoria !== "todas") q = q.eq("type", categoria);

    const { data, error } = await q;
    if (error) {
      setMensagem(error.message);
      return;
    }
    setLista(data ?? []);
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
      await carregarBase(id);
      setCarregando(false);
    }

    iniciar();
  }, [router]);

  useEffect(() => {
    if (!empresaId) return;
    carregarLancamentos(empresaId);
  }, [empresaId, de, ate, riderId, bairroId, categoria]);

  if (carregando) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f4efe6]">
        <p>Carregando...</p>
      </main>
    );
  }

  const qtdTodos = lista.length;
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
      if (itens.length === 0) return null;
      const datas = itens.map((l) => l.entry_date).sort();
      const soma = itens.reduce((acc, l) => acc + Number(l.amount), 0);
      return {
        id: m.id,
        nome: m.name,
        qtd: itens.length,
        total: soma,
        de: datas[0],
        ate: datas[datas.length - 1],
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .sort((a, b) => b.total - a.total);

  const btnAtalho = (id: "hoje" | "semana" | "mes", label: string) => (
    <button
      type="button"
      onClick={() => aplicarAtalho(id)}
      className={
        atalho === id
          ? "rounded-full px-3 py-1.5 text-sm font-medium bg-orange-500 text-white"
          : "rounded-full px-3 py-1.5 text-sm font-medium border border-stone-300"
      }
    >
      {label}
    </button>
  );

  return (
    <AppShell title="Relatório de recebimentos">
      <div className="flex flex-wrap gap-2 mb-4">
        {btnAtalho("hoje", "Hoje")}
        {btnAtalho("semana", "Esta semana")}
        {btnAtalho("mes", "Este mês")}
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <label className="text-sm text-stone-600">
          De
          <input
            type="date"
            value={de}
            onChange={(e) => {
              setAtalho("livre");
              setDe(e.target.value);
            }}
            className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2"
          />
        </label>
        <label className="text-sm text-stone-600">
          Até
          <input
            type="date"
            value={ate}
            onChange={(e) => {
              setAtalho("livre");
              setAte(e.target.value);
            }}
            className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2"
          />
        </label>
        <label className="text-sm text-stone-600">
          Motoboy
          <select
            value={riderId}
            onChange={(e) => setRiderId(e.target.value)}
            className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2"
          >
            <option value="">Todos</option>
            {motoboys.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-stone-600">
          Bairro
          <select
            value={bairroId}
            onChange={(e) => setBairroId(e.target.value)}
            className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2"
          >
            <option value="">Todos</option>
            {bairros.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-sm text-stone-600 mb-2">Categoria</p>
      <div className="grid grid-cols-2 gap-2 mb-6">
        {[
          { id: "todas", label: "Todas" },
          { id: "entrega", label: "Taxa de entrega" },
          { id: "combustivel", label: "Combustível" },
          { id: "bonus", label: "Bônus" },
        ].map((op) => (
          <button
            key={op.id}
            type="button"
            onClick={() => setCategoria(op.id)}
            className={
              categoria === op.id
                ? "rounded-lg py-2 text-sm font-medium bg-orange-500 text-white"
                : "rounded-lg py-2 text-sm font-medium border border-stone-300"
            }
          >
            {op.label}
          </button>
        ))}
      </div>

      {mensagem && <p className="text-sm text-red-600 mb-4">{mensagem}</p>}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="border border-stone-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">Lançamentos no período</p>
          <p className="text-2xl font-bold mt-1">{qtdTodos}</p>
        </div>
        <div className="border border-stone-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">Entregas no período</p>
          <p className="text-2xl font-bold mt-1">{qtdEntregas}</p>
        </div>
        <div className="border border-stone-200 rounded-xl p-4 col-span-2">
          <p className="text-xs uppercase tracking-wide text-stone-500">Valor total</p>
          <p className="text-2xl font-bold mt-1 text-orange-600">{dinheiro(total)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="border border-stone-200 rounded-xl p-3">
          <p className="text-xs text-stone-500">Taxas</p>
          <p className="font-semibold mt-1">{dinheiro(taxas)}</p>
        </div>
        <div className="border border-stone-200 rounded-xl p-3">
          <p className="text-xs text-stone-500">Combustível</p>
          <p className="font-semibold mt-1">{dinheiro(combustivel)}</p>
        </div>
        <div className="border border-stone-200 rounded-xl p-3">
          <p className="text-xs text-stone-500">Bônus</p>
          <p className="font-semibold mt-1">{dinheiro(bonus)}</p>
        </div>
      </div>

      <p className="text-sm font-medium text-stone-500 mb-2">Fechamento por motoboy</p>
      {porMotoboy.length === 0 ? (
        <p className="text-stone-600">Nenhum lançamento nesse filtro.</p>
      ) : (
        <div className="space-y-2">
          {porMotoboy.map((m) => (
            <div
              key={m.id}
              className="border border-stone-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
            >
              <div>
                <p className="font-semibold">{m.nome}</p>
                <p className="text-sm text-stone-500">
                  {m.qtd} {m.qtd === 1 ? "lançamento" : "lançamentos"} · {dataBR(m.de)}
                  {m.de !== m.ate ? ` a ${dataBR(m.ate)}` : ""}
                </p>
              </div>
              <p className="font-semibold text-orange-600">{dinheiro(m.total)}</p>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
