import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { LogOut, RefreshCw, Plus, Trash2, Edit, Package, ShoppingCart, FileText, Image, TrendingUp, CreditCard, CheckCircle2, XCircle } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { Sun, Moon } from "lucide-react";

export default function AdminDashboard() {
  const { email, logout, authAxios } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const [stats, setStats] = useState({});
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [blog, setBlog] = useState([]);
  const [banners, setBanners] = useState([]);
  const [syncing, setSyncing] = useState(false);

  const loadAll = useCallback(() => {
    authAxios.get("/admin/stats").then(r => setStats(r.data)).catch(() => {});
    authAxios.get("/admin/products").then(r => setProducts(r.data)).catch(() => {});
    authAxios.get("/admin/orders").then(r => setOrders(r.data)).catch(() => {});
    authAxios.get("/admin/blog").then(r => setBlog(r.data)).catch(() => {});
    authAxios.get("/admin/banners").then(r => setBanners(r.data)).catch(() => {});
  }, [authAxios]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const doLogout = () => { logout(); nav("/admin/login"); };

  const syncAll = async () => {
    setSyncing(true);
    try {
      const { data } = await authAxios.post("/admin/sync/all");
      toast.success(`Sync OK: ${data.woocommerce?.imported || 0} produits, ${data.wordpress?.imported || 0} articles`);
      loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur de sync");
    } finally { setSyncing(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/90 backdrop-blur-xl z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="display text-xl font-black shrink-0">KAMI<span className="text-accent">.</span>ADMIN</div>
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">{email}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={syncAll} disabled={syncing} variant="outline" className="rounded-none" data-testid="sync-all-btn">
              <RefreshCw className={`w-4 h-4 sm:mr-2 ${syncing ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Synchroniser Woo + WP</span><span className="sm:hidden">Sync</span>
            </Button>
            <Button onClick={toggle} variant="ghost" size="icon">{theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</Button>
            <Button onClick={doLogout} variant="ghost" size="icon" data-testid="admin-logout-btn"><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<Package />} label="Produits" value={stats.total_products} testId="stat-products" />
          <StatCard icon={<ShoppingCart />} label="Commandes" value={stats.total_orders} testId="stat-orders" />
          <StatCard icon={<TrendingUp />} label="Chiffre d'affaires" value={`${(stats.revenue || 0).toFixed(2)} €`} testId="stat-revenue" />
          <StatCard icon={<FileText />} label="Articles blog" value={stats.total_blog} testId="stat-blog" />
        </div>

        <Tabs defaultValue="products">
          <TabsList className="rounded-none w-full overflow-x-auto justify-start flex-nowrap">
            <TabsTrigger value="products" data-testid="tab-products" className="shrink-0">Produits</TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders" className="shrink-0">Commandes</TabsTrigger>
            <TabsTrigger value="blog" data-testid="tab-blog" className="shrink-0">Blog</TabsTrigger>
            <TabsTrigger value="banners" data-testid="tab-banners" className="shrink-0">Bannières</TabsTrigger>
            <TabsTrigger value="payments" data-testid="tab-payments" className="shrink-0">Paiement</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-6">
            <ProductsPanel items={products} authAxios={authAxios} reload={loadAll} />
          </TabsContent>
          <TabsContent value="orders" className="mt-6">
            <OrdersPanel items={orders} authAxios={authAxios} reload={loadAll} />
          </TabsContent>
          <TabsContent value="blog" className="mt-6">
            <BlogPanel items={blog} authAxios={authAxios} reload={loadAll} />
          </TabsContent>
          <TabsContent value="banners" className="mt-6">
            <BannersPanel items={banners} authAxios={authAxios} reload={loadAll} />
          </TabsContent>
          <TabsContent value="payments" className="mt-6">
            <PaymentsPanel authAxios={authAxios} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

const StatCard = ({ icon, label, value, testId }) => (
  <Card className="rounded-none border-border" data-testid={testId}>
    <CardContent className="p-4 flex items-center gap-3">
      <div className="text-accent">{icon}</div>
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="display text-2xl font-black">{value ?? "-"}</div>
      </div>
    </CardContent>
  </Card>
);

const WC_STATUS_LABELS = {
  publish: "Publié",
  private: "Privé",
  draft: "Brouillon",
  pending: "En attente",
};

function ProductsPanel({ items, authAxios, reload }) {
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const emptyProd = { name: "", description: "", short_description: "", price: 0, sale_price: null, stock: 0, categories: "", images: "", featured: false, active: true };
  const [form, setForm] = useState(emptyProd);

  const filtered = statusFilter === "all" ? items : items.filter(p => (p.wc_status || (p.active ? "publish" : "draft")) === statusFilter);

  const openNew = () => { setEditing(null); setForm(emptyProd); setOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ ...p, categories: (p.categories || []).join(", "), images: (p.images || []).join(",\n") });
    setOpen(true);
  };

  const save = async () => {
    const body = {
      ...form,
      price: parseFloat(form.price) || 0,
      sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
      stock: parseInt(form.stock) || 0,
      categories: (form.categories || "").split(",").map(s => s.trim()).filter(Boolean),
      images: (form.images || "").split(/[\n,]/).map(s => s.trim()).filter(Boolean),
      variations: form.variations || [],
    };
    try {
      if (editing) await authAxios.put(`/admin/products/${editing.id}`, body);
      else await authAxios.post(`/admin/products`, body);
      toast.success("Produit enregistré");
      setOpen(false); reload();
    } catch (e) { toast.error("Erreur"); }
  };

  const del = async (id) => {
    if (!confirm("Supprimer ce produit ?")) return;
    await authAxios.delete(`/admin/products/${id}`);
    toast.success("Supprimé"); reload();
  };

  return (
    <div>
      <div className="flex justify-between mb-4 items-center flex-wrap gap-3">
        <h2 className="display text-xl font-bold">Produits ({filtered.length}/{items.length})</h2>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9 rounded-none text-xs" data-testid="product-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="publish">Publié</SelectItem>
              <SelectItem value="private">Privé</SelectItem>
              <SelectItem value="draft">Brouillon</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openNew} className="cta-primary rounded-none" data-testid="new-product-btn"><Plus className="w-4 h-4 mr-2" />Nouveau</Button>
        </div>
      </div>
      <div className="border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary"><tr>
            <th className="text-left p-3">Image</th><th className="text-left p-3">Nom</th>
            <th className="text-left p-3">Prix</th><th className="text-left p-3">Stock</th>
            <th className="text-left p-3">Statut WP</th><th className="text-left p-3">Actif (boutique)</th><th></th>
          </tr></thead>
          <tbody>
            {filtered.map(p => {
              const wcStatus = p.wc_status || (p.active ? "publish" : "draft");
              return (
                <tr key={p.id} className="border-t border-border" data-testid={`admin-product-${p.id}`}>
                  <td className="p-3"><img src={p.images?.[0]} alt="" className="w-12 h-12 object-cover" /></td>
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3">{p.price?.toFixed(2)} €</td>
                  <td className="p-3">{p.stock}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 text-xs uppercase ${wcStatus === "publish" ? "bg-accent text-black" : "bg-secondary"}`}>
                      {WC_STATUS_LABELS[wcStatus] || wcStatus}
                    </span>
                  </td>
                  <td className="p-3">{p.active ? "Actif" : "Inactif"}</td>
                  <td className="p-3 text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(p.id)}><Trash2 className="w-4 h-4" /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Modifier produit" : "Nouveau produit"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="product-form-name" /></div>
            <div><Label>Résumé</Label><Textarea rows={2} value={form.short_description} onChange={e => setForm({ ...form, short_description: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea rows={5} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div><Label>Prix (€)</Label><Input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
              <div><Label>Prix promo</Label><Input type="number" step="0.01" value={form.sale_price || ""} onChange={e => setForm({ ...form, sale_price: e.target.value })} /></div>
              <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} /></div>
            </div>
            <div><Label>Catégories (séparées par virgule)</Label><Input value={form.categories} onChange={e => setForm({ ...form, categories: e.target.value })} /></div>
            <div><Label>URLs images (une par ligne)</Label><Textarea rows={3} value={form.images} onChange={e => setForm({ ...form, images: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.featured} onCheckedChange={v => setForm({ ...form, featured: v })} /> <Label>Produit phare</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} /> <Label>Actif</Label></div>
            <Button onClick={save} className="cta-primary rounded-none w-full" data-testid="product-form-save">Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrdersPanel({ items, authAxios, reload }) {
  const setStatus = async (id, status) => {
    await authAxios.put(`/admin/orders/${id}/status`, { status });
    toast.success("Statut mis à jour"); reload();
  };
  return (
    <div>
      <h2 className="display text-xl font-bold mb-4">Commandes ({items.length})</h2>
      <div className="border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary"><tr>
            <th className="text-left p-3">N°</th><th className="text-left p-3">Client</th>
            <th className="text-left p-3">Total</th><th className="text-left p-3">Statut</th>
            <th className="text-left p-3">Date</th><th className="text-left p-3">Actions</th>
          </tr></thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucune commande</td></tr>
            ) : items.map(o => (
              <tr key={o.id} className="border-t border-border" data-testid={`admin-order-${o.id}`}>
                <td className="p-3 font-mono text-xs">{o.order_no}</td>
                <td className="p-3">{o.customer_name}<br /><span className="text-xs text-muted-foreground">{o.customer_email}</span></td>
                <td className="p-3 font-bold">{o.total?.toFixed(2)} €</td>
                <td className="p-3"><span className={`px-2 py-1 text-xs uppercase ${o.status === "paid" ? "bg-accent text-black" : "bg-secondary"}`}>{o.status}</span></td>
                <td className="p-3 text-xs">{new Date(o.created_at).toLocaleString("fr-FR")}</td>
                <td className="p-3">
                  <Select value={o.status} onValueChange={v => setStatus(o.id, v)}>
                    <SelectTrigger className="w-32 h-8 rounded-none text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="paid">Payée</SelectItem>
                      <SelectItem value="shipped">Expédiée</SelectItem>
                      <SelectItem value="cancelled">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BlogPanel({ items, authAxios, reload }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { title: "", content: "", excerpt: "", featured_image: "", published: true };
  const [form, setForm] = useState(empty);

  const save = async () => {
    try {
      if (editing) await authAxios.put(`/admin/blog/${editing.id}`, form);
      else await authAxios.post(`/admin/blog`, form);
      toast.success("Article enregistré");
      setOpen(false); reload();
    } catch { toast.error("Erreur"); }
  };
  const del = async (id) => { if (confirm("Supprimer ?")) { await authAxios.delete(`/admin/blog/${id}`); toast.success("Supprimé"); reload(); } };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="display text-xl font-bold">Articles ({items.length})</h2>
        <Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }} className="cta-primary rounded-none"><Plus className="w-4 h-4 mr-2" />Nouveau</Button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {items.map(b => (
          <div key={b.id} className="border border-border p-4 flex gap-4">
            {b.featured_image && <img src={b.featured_image} alt="" className="w-24 h-24 object-cover" />}
            <div className="flex-1">
              <div className="font-bold" dangerouslySetInnerHTML={{ __html: b.title }} />
              <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{b.excerpt}</div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(b); setForm(b); setOpen(true); }}><Edit className="w-3 h-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => del(b.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouvel"} article</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Titre</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Extrait</Label><Textarea rows={2} value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} /></div>
            <div><Label>Image (URL)</Label><Input value={form.featured_image || ""} onChange={e => setForm({ ...form, featured_image: e.target.value })} /></div>
            <div><Label>Contenu (HTML)</Label><Textarea rows={10} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.published} onCheckedChange={v => setForm({ ...form, published: v })} /> <Label>Publié</Label></div>
            <Button onClick={save} className="cta-primary rounded-none w-full">Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BannersPanel({ items, authAxios, reload }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { title: "", subtitle: "", image: "", cta_text: "Shop Now", cta_link: "/shop", active: true, order: 0 };
  const [form, setForm] = useState(empty);

  const save = async () => {
    try {
      if (editing) await authAxios.put(`/admin/banners/${editing.id}`, form);
      else await authAxios.post(`/admin/banners`, form);
      toast.success("Bannière enregistrée");
      setOpen(false); reload();
    } catch { toast.error("Erreur"); }
  };
  const del = async (id) => { if (confirm("Supprimer ?")) { await authAxios.delete(`/admin/banners/${id}`); toast.success("Supprimé"); reload(); } };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="display text-xl font-bold">Bannières ({items.length})</h2>
        <Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }} className="cta-primary rounded-none"><Plus className="w-4 h-4 mr-2" />Nouvelle</Button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {items.map(b => (
          <div key={b.id} className="border border-border overflow-hidden">
            {b.image && <img src={b.image} alt="" className="w-full aspect-video object-cover" />}
            <div className="p-4">
              <div className="font-bold">{b.title}</div>
              <div className="text-xs text-muted-foreground">{b.subtitle}</div>
              <div className="text-xs mt-1">CTA: {b.cta_text} → {b.cta_link}</div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(b); setForm(b); setOpen(true); }}><Edit className="w-3 h-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => del(b.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouvelle"} bannière</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Titre</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Sous-titre</Label><Input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} /></div>
            <div><Label>Image (URL)</Label><Input value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Texte CTA</Label><Input value={form.cta_text} onChange={e => setForm({ ...form, cta_text: e.target.value })} /></div>
              <div><Label>Lien CTA</Label><Input value={form.cta_link} onChange={e => setForm({ ...form, cta_link: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Ordre</Label><Input type="number" value={form.order} onChange={e => setForm({ ...form, order: parseInt(e.target.value) || 0 })} /></div>
              <div className="flex items-center gap-2 mt-6"><Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} /> <Label>Active</Label></div>
            </div>
            <Button onClick={save} className="cta-primary rounded-none w-full">Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentsPanel({ authAxios }) {
  const [settings, setSettings] = useState(null);
  const [qontoStatus, setQontoStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(() => {
    authAxios.get("/admin/settings/payments").then(r => setSettings(r.data)).catch(() => {});
    authAxios.get("/admin/qonto/status").then(r => setQontoStatus(r.data)).catch(() => {});
  }, [authAxios]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("qonto_connected")) {
      toast.success("Qonto connecté avec succès");
      window.history.replaceState({}, "", window.location.pathname);
      load();
    } else if (params.get("qonto_error")) {
      toast.error(`Erreur de connexion Qonto : ${params.get("qonto_error")}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [load]);

  if (!settings) return <div className="text-muted-foreground">Chargement...</div>;

  const update = (patch) => setSettings({ ...settings, ...patch });

  const save = async () => {
    setSaving(true);
    try {
      const { qonto_connected, ...body } = settings;
      await authAxios.put("/admin/settings/payments", body);
      toast.success("Réglages de paiement enregistrés");
      load();
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally { setSaving(false); }
  };

  const connectQonto = async () => {
    setConnecting(true);
    try {
      const { data } = await authAxios.get("/admin/qonto/authorize-url");
      window.location.href = data.url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Impossible de démarrer la connexion Qonto");
      setConnecting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="display text-xl font-bold mb-4">Moyens de paiement</h2>

        <div className="border border-border p-4 flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4" /> Stripe (carte bancaire)</div>
            <div className="text-xs text-muted-foreground mt-1">Encaissement via Stripe Checkout</div>
          </div>
          <Switch checked={settings.stripe_enabled} onCheckedChange={v => update({ stripe_enabled: v })} data-testid="stripe-enabled-switch" />
        </div>

        <div className="border border-border p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4" /> Qonto (carte bancaire)</div>
              <div className="text-xs text-muted-foreground mt-1">Encaissement via Qonto Payment Links</div>
            </div>
            <Switch checked={settings.qonto_enabled} onCheckedChange={v => update({ qonto_enabled: v })} data-testid="qonto-enabled-switch" />
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs">
            {qontoStatus?.connected && qontoStatus?.provider_status === "enabled" ? (
              <span className="flex items-center gap-1 text-accent"><CheckCircle2 className="w-3.5 h-3.5" /> Connecté et actif</span>
            ) : qontoStatus?.connected ? (
              <span className="flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="w-3.5 h-3.5" /> Connecté (statut : {qontoStatus.provider_status})</span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground"><XCircle className="w-3.5 h-3.5" /> Non connecté</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div><Label>Téléphone (E.164)</Label><Input placeholder="+33612345678" value={settings.qonto_phone_number} onChange={e => update({ qonto_phone_number: e.target.value })} /></div>
            <div><Label>Site web</Label><Input placeholder="https://kamistreet.fr" value={settings.qonto_website_url} onChange={e => update({ qonto_website_url: e.target.value })} /></div>
            <div><Label>ID compte bancaire Qonto</Label><Input value={settings.qonto_bank_account_id} onChange={e => update({ qonto_bank_account_id: e.target.value })} /></div>
            <div><Label>Taux de TVA (%)</Label><Input value={settings.qonto_vat_rate} onChange={e => update({ qonto_vat_rate: e.target.value })} /></div>
          </div>
          <div className="mt-3">
            <Label>Description de l'activité (min. 80 caractères, requis par Qonto)</Label>
            <Textarea rows={3} value={settings.qonto_business_description} onChange={e => update({ qonto_business_description: e.target.value })} />
          </div>

          <Button onClick={connectQonto} disabled={connecting} variant="outline" className="rounded-none mt-4" data-testid="qonto-connect-btn">
            {connecting ? "Redirection..." : qontoStatus?.connected ? "Reconnecter Qonto" : "Connecter Qonto"}
          </Button>
        </div>

        <div className="border border-border p-4 flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4" /> Mollie (carte bancaire)</div>
            <div className="text-xs text-muted-foreground mt-1">Encaissement direct via l'API Mollie (clé API, sans OAuth)</div>
          </div>
          <Switch checked={settings.mollie_enabled} onCheckedChange={v => update({ mollie_enabled: v })} data-testid="mollie-enabled-switch" />
        </div>

        <Button onClick={save} disabled={saving} className="cta-primary rounded-none w-full" data-testid="payment-settings-save">
          {saving ? "Enregistrement..." : "Enregistrer les réglages"}
        </Button>
      </div>
    </div>
  );
}
