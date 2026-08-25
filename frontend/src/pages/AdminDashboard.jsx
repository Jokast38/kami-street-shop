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
import { LogOut, RefreshCw, Plus, Trash2, Edit, Package, ShoppingCart, FileText, Image, TrendingUp, CreditCard, CheckCircle2, XCircle, Download, Receipt, Users, Send, Mail, Inbox, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { Sun, Moon } from "lucide-react";

export default function AdminDashboard() {
  const { email, role, logout, authAxios } = useAuth();
  const isAdmin = role === "admin";
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const [stats, setStats] = useState({});
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [blog, setBlog] = useState([]);
  const [banners, setBanners] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [promos, setPromos] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  const loadAll = useCallback(() => {
    authAxios.get("/admin/stats").then(r => setStats(r.data)).catch(() => {});
    authAxios.get("/admin/products").then(r => setProducts(r.data)).catch(() => {});
    authAxios.get("/admin/orders").then(r => setOrders(r.data)).catch(() => {});
    authAxios.get("/admin/blog").then(r => setBlog(r.data)).catch(() => {});
    authAxios.get("/admin/banners").then(r => setBanners(r.data)).catch(() => {});
    authAxios.get("/admin/invoices").then(r => setInvoices(r.data)).catch(() => {});
    authAxios.get("/admin/promos").then(r => setPromos(r.data)).catch(() => {});
    authAxios.get("/admin/sync/status").then(r => setSyncStatus(r.data)).catch(() => {});
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
            {syncStatus?.last_sync_at && (
              <span className="text-xs text-muted-foreground hidden md:inline" data-testid="last-sync-info">
                {syncStatus.last_sync_ok === false ? "⚠ Échec" : "Auto-sync"} · {new Date(syncStatus.last_sync_at).toLocaleString("fr-FR")}
              </span>
            )}
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
            {isAdmin && <TabsTrigger value="payments" data-testid="tab-payments" className="shrink-0">Paiement</TabsTrigger>}
            <TabsTrigger value="invoices" data-testid="tab-invoices" className="shrink-0">Factures</TabsTrigger>
            <TabsTrigger value="promos" data-testid="tab-promos" className="shrink-0">Codes promo</TabsTrigger>
            <TabsTrigger value="mailbox" data-testid="tab-mailbox" className="shrink-0">Messagerie</TabsTrigger>
            <TabsTrigger value="campaigns" data-testid="tab-campaigns" className="shrink-0">Campagnes</TabsTrigger>
            {isAdmin && <TabsTrigger value="collaborators" data-testid="tab-collaborators" className="shrink-0">Collaborateurs</TabsTrigger>}
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
          {isAdmin && (
            <TabsContent value="payments" className="mt-6">
              <PaymentsPanel authAxios={authAxios} />
            </TabsContent>
          )}
          <TabsContent value="invoices" className="mt-6">
            <InvoicesPanel items={invoices} orders={orders} authAxios={authAxios} reload={loadAll} />
          </TabsContent>
          <TabsContent value="promos" className="mt-6">
            <PromosPanel items={promos} authAxios={authAxios} reload={loadAll} />
          </TabsContent>
          <TabsContent value="mailbox" className="mt-6">
            <MailboxPanel authAxios={authAxios} />
          </TabsContent>
          <TabsContent value="campaigns" className="mt-6">
            <CampaignsPanel authAxios={authAxios} />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="collaborators" className="mt-6">
              <CollaboratorsPanel authAxios={authAxios} currentEmail={email} />
            </TabsContent>
          )}
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
  const [uploading, setUploading] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");

  const emptyProd = { name: "", description: "", short_description: "", price: 0, sale_price: null, stock: 0, categories: "", brands: "", images: [], featured: false, active: true, bundle_enabled: false, bundle_quantity: 2, bundle_price: null, variations: [] };
  const [form, setForm] = useState(emptyProd);

  const filtered = statusFilter === "all" ? items : items.filter(p => (p.wc_status || (p.active ? "publish" : "draft")) === statusFilter);

  const attributesToText = (attrs) => Object.entries(attrs || {}).map(([k, v]) => `${k}: ${v}`).join(", ");
  const textToAttributes = (text) => Object.fromEntries((text || "").split(",").map(s => s.trim()).filter(Boolean).map(pair => {
    const [k, ...rest] = pair.split(":");
    return [k.trim(), rest.join(":").trim()];
  }).filter(([k]) => k));

  const openNew = () => { setEditing(null); setForm(emptyProd); setNewImageUrl(""); setOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      ...p,
      categories: (p.categories || []).join(", "),
      brands: (p.brands || []).join(", "),
      images: p.images || [],
      variations: (p.variations || []).map(v => ({ ...v, attributesText: attributesToText(v.attributes) })),
    });
    setNewImageUrl("");
    setOpen(true);
  };

  const addVariation = () => setForm(f => ({ ...f, variations: [...(f.variations || []), { id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "", price: "", sale_price: "", stock: 0, attributesText: "", image: "" }] }));
  const updateVariation = (idx, field, value) => setForm(f => ({ ...f, variations: f.variations.map((v, i) => i === idx ? { ...v, [field]: value } : v) }));
  const removeVariation = (idx) => setForm(f => ({ ...f, variations: f.variations.filter((_, i) => i !== idx) }));

  const addImageUrl = () => {
    const url = newImageUrl.trim();
    if (!url) return;
    setForm({ ...form, images: [...form.images, url] });
    setNewImageUrl("");
  };
  const removeImage = (idx) => setForm({ ...form, images: form.images.filter((_, i) => i !== idx) });

  const uploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await authAxios.post("/admin/uploads/image", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm(f => ({ ...f, images: [...f.images, data.url] }));
      toast.success("Image envoyée");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur lors de l'envoi de l'image");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const save = async () => {
    const body = {
      ...form,
      price: parseFloat(form.price) || 0,
      sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
      stock: parseInt(form.stock) || 0,
      categories: (form.categories || "").split(",").map(s => s.trim()).filter(Boolean),
      brands: (form.brands || "").split(",").map(s => s.trim()).filter(Boolean),
      images: form.images || [],
      variations: (form.variations || []).map(v => ({
        id: v.id,
        name: v.name,
        price: v.price ? parseFloat(v.price) : 0,
        sale_price: v.sale_price ? parseFloat(v.sale_price) : null,
        stock: parseInt(v.stock) || 0,
        attributes: textToAttributes(v.attributesText),
        image: v.image || "",
      })),
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
                  <td className="p-3">
                    <div className="relative w-12 h-12">
                      <img src={p.images?.[0]} alt={p.name} className="w-12 h-12 object-cover" />
                      {p.images?.length > 1 && (
                        <span className="absolute -top-1 -right-1 bg-accent text-black text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                          {p.images.length}
                        </span>
                      )}
                    </div>
                  </td>
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
            <div className="border border-border p-4 space-y-3">
              <div className="flex items-center gap-2"><Switch checked={form.bundle_enabled} onCheckedChange={v => setForm({ ...form, bundle_enabled: v })} /><Label>Activer l'offre bundle</Label></div>
              {form.bundle_enabled && <div className="grid grid-cols-2 gap-3">
                <div><Label>Articles par lot</Label><Input type="number" min="2" value={form.bundle_quantity} onChange={e => setForm({ ...form, bundle_quantity: e.target.value })} /></div>
                <div><Label>Prix du lot (€)</Label><Input type="number" min="0" step="0.01" value={form.bundle_price || ""} onChange={e => setForm({ ...form, bundle_price: e.target.value })} /></div>
              </div>}
            </div>

            <div className="border border-border p-4 space-y-3">
              <div className="flex justify-between items-center">
                <Label>Variantes ({(form.variations || []).length})</Label>
                <Button type="button" variant="outline" size="sm" className="rounded-none" onClick={addVariation} data-testid="add-variation-btn"><Plus className="w-4 h-4 mr-1" />Ajouter une variante</Button>
              </div>
              {(form.variations || []).map((v, idx) => (
                <div key={v.id || idx} className="border border-border p-3 space-y-2 relative" data-testid={`variation-row-${idx}`}>
                  <button
                    type="button"
                    onClick={() => removeVariation(idx)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center text-xs"
                    aria-label="Supprimer la variante"
                    data-testid={`remove-variation-${idx}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <div><Label className="text-xs">Nom de la variante</Label><Input value={v.name} onChange={e => updateVariation(idx, "name", e.target.value)} placeholder="Ex: Rouge / M" /></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-xs">Prix (€)</Label><Input type="number" step="0.01" value={v.price} onChange={e => updateVariation(idx, "price", e.target.value)} /></div>
                    <div><Label className="text-xs">Prix promo</Label><Input type="number" step="0.01" value={v.sale_price || ""} onChange={e => updateVariation(idx, "sale_price", e.target.value)} /></div>
                    <div><Label className="text-xs">Stock</Label><Input type="number" value={v.stock} onChange={e => updateVariation(idx, "stock", e.target.value)} /></div>
                  </div>
                  <div><Label className="text-xs">Attributs (ex: Couleur: Rouge, Taille: M)</Label><Input value={v.attributesText} onChange={e => updateVariation(idx, "attributesText", e.target.value)} placeholder="Couleur: Rouge, Taille: M" /></div>
                  <div><Label className="text-xs">Image (URL)</Label><Input value={v.image} onChange={e => updateVariation(idx, "image", e.target.value)} placeholder="https://..." /></div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Catégories (séparées par virgule)</Label><Input value={form.categories} onChange={e => setForm({ ...form, categories: e.target.value })} /></div>
              <div><Label>Marques (séparées par virgule)</Label><Input value={form.brands} onChange={e => setForm({ ...form, brands: e.target.value })} /></div>
            </div>

            <div>
              <Label>Images ({form.images.length})</Label>
              {form.images.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-2">
                  {form.images.map((img, idx) => (
                    <div key={idx} className="relative aspect-square border border-border bg-white group">
                      <img src={img} alt={`Image ${idx + 1}`} className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Retirer l'image"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 mt-3">
                <Input placeholder="Coller une URL d'image..." value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addImageUrl())} />
                <Button type="button" variant="outline" className="rounded-none shrink-0" onClick={addImageUrl}>Ajouter</Button>
              </div>
              <div className="mt-2">
                <label className="inline-flex items-center gap-2 text-sm border border-dashed border-border px-4 py-2 cursor-pointer hover:border-accent transition-colors" data-testid="product-image-upload-label">
                  <Image className="w-4 h-4" />
                  {uploading ? "Envoi en cours..." : "Uploader une image"}
                  <input type="file" accept="image/*" className="hidden" onChange={uploadImage} disabled={uploading} data-testid="product-image-upload-input" />
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2"><Switch checked={form.featured} onCheckedChange={v => setForm({ ...form, featured: v })} /> <Label>Produit phare</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} /> <Label>Actif</Label></div>
            <Button onClick={save} className="cta-primary rounded-none w-full" data-testid="product-form-save">Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PromosPanel({ items, authAxios, reload }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { code: "", discount_type: "percent", value: 10, min_order: 0, expires_at: "", max_uses: "", active: true };
  const [form, setForm] = useState(empty);
  const save = async () => {
    const body = { ...form, code: form.code.toUpperCase(), value: Number(form.value), min_order: Number(form.min_order) || 0, max_uses: form.max_uses ? Number(form.max_uses) : null, expires_at: form.expires_at || null };
    try { editing ? await authAxios.put(`/admin/promos/${editing.id}`, body) : await authAxios.post("/admin/promos", body); toast.success("Code promo enregistré"); setOpen(false); reload(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };
  const del = async id => { if (!confirm("Supprimer ce code promo ?")) return; await authAxios.delete(`/admin/promos/${id}`); reload(); };
  return <div>
    <div className="flex justify-between mb-4 items-center"><h2 className="display text-xl font-bold">Codes promo ({items.length})</h2><Button className="cta-primary rounded-none" onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}><Plus className="w-4 h-4 mr-2" />Nouveau</Button></div>
    <div className="border border-border overflow-x-auto"><table className="w-full text-sm"><thead className="bg-secondary"><tr><th className="text-left p-3">Code</th><th className="text-left p-3">Remise</th><th className="text-left p-3">Utilisations</th><th className="text-left p-3">Statut</th><th></th></tr></thead><tbody>{items.map(p => <tr key={p.id} className="border-t border-border"><td className="p-3 font-mono font-bold">{p.code}</td><td className="p-3">{p.value}{p.discount_type === "percent" ? "%" : " €"}</td><td className="p-3">{p.uses || 0}{p.max_uses ? ` / ${p.max_uses}` : ""}</td><td className="p-3">{p.active ? "Actif" : "Inactif"}</td><td className="p-3 text-right"><Button size="icon" variant="ghost" onClick={() => { setEditing(p); setForm({ ...p, expires_at: p.expires_at ? p.expires_at.slice(0, 10) : "" }); setOpen(true); }}><Edit className="w-4 h-4" /></Button><Button size="icon" variant="ghost" onClick={() => del(p.id)}><Trash2 className="w-4 h-4" /></Button></td></tr>)}</tbody></table></div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? "Modifier le code promo" : "Nouveau code promo"}</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Code</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Type</Label><Select value={form.discount_type} onValueChange={v => setForm({ ...form, discount_type: v })}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percent">Pourcentage</SelectItem><SelectItem value="fixed">Montant fixe</SelectItem></SelectContent></Select></div><div><Label>Valeur</Label><Input type="number" min="0" step="0.01" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} /></div></div><div className="grid grid-cols-2 gap-3"><div><Label>Minimum (€)</Label><Input type="number" min="0" step="0.01" value={form.min_order} onChange={e => setForm({ ...form, min_order: e.target.value })} /></div><div><Label>Expiration</Label><Input type="date" value={form.expires_at || ""} onChange={e => setForm({ ...form, expires_at: e.target.value })} /></div></div><div><Label>Nombre max. d'utilisations (optionnel)</Label><Input type="number" min="1" value={form.max_uses || ""} onChange={e => setForm({ ...form, max_uses: e.target.value })} /></div><div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} /><Label>Actif</Label></div><Button onClick={save} className="cta-primary rounded-none w-full">Enregistrer</Button></div></DialogContent></Dialog>
  </div>;
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
            {b.featured_image && <img src={b.featured_image} alt={b.title?.replace(/<[^>]+>/g, "")} className="w-24 h-24 object-cover" />}
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
  const empty = { title: "", subtitle: "", promo_label: "", image: "", cta_text: "Shop Now", cta_link: "/shop", active: true, order: 0 };
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
            {b.image && (
              <div className="relative">
                <img src={b.image} alt={b.title} className="w-full aspect-video object-cover" />
                {b.promo_label && (
                  <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold uppercase px-2 py-1 tracking-wide">
                    {b.promo_label}
                  </span>
                )}
              </div>
            )}
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
            <div>
              <Label>Titre promo (badge rouge sur l'image, optionnel)</Label>
              <Input placeholder="Ex: -20% / SOLDES" value={form.promo_label} onChange={e => setForm({ ...form, promo_label: e.target.value })} />
            </div>
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

        <div className="border border-border p-4 flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4" /> Klarna (paiement en plusieurs fois)</div>
            <div className="text-xs text-muted-foreground mt-1">
              Affiche le badge "Payez en 3x avec Klarna" sur la boutique pour les paniers de 300 € minimum. Activez d'abord Klarna dans votre espace Mollie (Paiements → Moyens de paiement) avant d'activer ce switch.
            </div>
          </div>
          <Switch checked={settings.klarna_enabled} onCheckedChange={v => update({ klarna_enabled: v })} data-testid="klarna-enabled-switch" />
        </div>

        <div className="border border-border p-4 flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4" /> Alma (paiement en plusieurs fois)</div>
            <div className="text-xs text-muted-foreground mt-1">
              Affiche le badge "Payez en 3x avec Alma" sur la boutique pour les paniers de 300 € minimum.
            </div>
          </div>
          <Switch checked={settings.alma_enabled} onCheckedChange={v => update({ alma_enabled: v })} data-testid="alma-enabled-switch" />
        </div>

        <Button onClick={save} disabled={saving} className="cta-primary rounded-none w-full" data-testid="payment-settings-save">
          {saving ? "Enregistrement..." : "Enregistrer les réglages"}
        </Button>
      </div>
    </div>
  );
}

function computeInvoiceTotals(invoice) {
  // unit_price is already TTC (VAT included) — derive HT/VAT from it instead of adding VAT on top,
  // so the displayed TOTAL TTC always matches the actual product price.
  const totalTtc = (invoice.items || []).reduce((sum, i) => sum + (parseFloat(i.unit_price) || 0) * (parseInt(i.quantity) || 0), 0);
  const taxRate = (parseFloat(invoice.tax_rate) || 0) / 100;
  const subtotal = taxRate ? totalTtc / (1 + taxRate) : totalTtc;
  const tax = totalTtc - subtotal;
  return { subtotal, tax, total: totalTtc };
}

function InvoicesPanel({ items, orders, authAxios, reload }) {
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [sendingId, setSendingId] = useState(null);

  const emptyInvoice = {
    order_id: null, order_no: "", customer_name: "", customer_email: "",
    billing_address: { line1: "", city: "", postal_code: "", country: "France" },
    items: [{ ref: "", name: "", quantity: 1, unit_price: 0 }],
    tax_rate: 20.0, notes: "", payment_method: "Carte", seller_name: "Vente en ligne",
  };
  const [form, setForm] = useState(emptyInvoice);

  const paidOrdersWithoutInvoice = orders.filter(
    o => o.payment_status === "paid" && !items.some(inv => inv.order_id === o.id)
  );

  const openNew = () => { setEditing(null); setForm(emptyInvoice); setOpen(true); };
  const openEdit = (inv) => {
    setEditing(inv);
    setForm({
      ...inv,
      billing_address: inv.billing_address || { line1: "", city: "", postal_code: "", country: "France" },
      items: inv.items?.length ? inv.items : [{ ref: "", name: "", quantity: 1, unit_price: 0 }],
      payment_method: inv.payment_method || "Carte",
      seller_name: inv.seller_name || "Vente en ligne",
    });
    setOpen(true);
  };

  const updateItem = (idx, patch) => {
    const newItems = form.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    setForm({ ...form, items: newItems });
  };
  const addItem = () => setForm({ ...form, items: [...form.items, { ref: "", name: "", quantity: 1, unit_price: 0 }] });
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const save = async () => {
    const body = {
      ...form,
      items: form.items.map(i => ({ ref: i.ref || "", name: i.name, quantity: parseInt(i.quantity) || 1, unit_price: parseFloat(i.unit_price) || 0 })),
      tax_rate: parseFloat(form.tax_rate) || 0,
    };
    try {
      if (editing) await authAxios.put(`/admin/invoices/${editing.id}`, body);
      else await authAxios.post(`/admin/invoices`, body);
      toast.success("Facture enregistrée");
      setOpen(false); reload();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };

  const del = async (id) => {
    if (!confirm("Supprimer cette facture ?")) return;
    await authAxios.delete(`/admin/invoices/${id}`);
    toast.success("Supprimée"); reload();
  };

  const createFromOrder = async (orderId) => {
    try {
      await authAxios.post(`/admin/invoices/from-order/${orderId}`);
      toast.success("Facture générée depuis la commande");
      reload();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };

  const downloadPdf = async (inv) => {
    setDownloadingId(inv.id);
    try {
      const res = await authAxios.get(`/admin/invoices/${inv.id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
    } catch (e) {
      toast.error("Erreur lors du téléchargement");
    } finally { setDownloadingId(null); }
  };

  const sendByEmail = async (inv) => {
    setSendingId(inv.id);
    try {
      await authAxios.post(`/admin/invoices/${inv.id}/send`);
      toast.success(`Facture envoyée à ${inv.customer_email}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur lors de l'envoi");
    } finally { setSendingId(null); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <h2 className="display text-xl font-bold">Factures ({items.length})</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {paidOrdersWithoutInvoice.length > 0 && (
            <Select onValueChange={createFromOrder}>
              <SelectTrigger className="w-56 h-9 rounded-none text-xs" data-testid="invoice-from-order-select">
                <SelectValue placeholder="Générer depuis une commande..." />
              </SelectTrigger>
              <SelectContent>
                {paidOrdersWithoutInvoice.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.order_no} — {o.customer_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={openNew} className="cta-primary rounded-none" data-testid="new-invoice-btn"><Plus className="w-4 h-4 mr-2" />Nouvelle</Button>
        </div>
      </div>

      <div className="border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary"><tr>
            <th className="text-left p-3">N°</th><th className="text-left p-3">Client</th>
            <th className="text-left p-3">Commande</th><th className="text-left p-3">Total TTC</th>
            <th className="text-left p-3">Date</th><th></th>
          </tr></thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucune facture</td></tr>
            ) : items.map(inv => {
              const { total } = computeInvoiceTotals(inv);
              return (
                <tr key={inv.id} className="border-t border-border" data-testid={`admin-invoice-${inv.id}`}>
                  <td className="p-3 font-mono text-xs">{inv.invoice_no}</td>
                  <td className="p-3">{inv.customer_name}<br /><span className="text-xs text-muted-foreground">{inv.customer_email}</span></td>
                  <td className="p-3 text-xs">{inv.order_no || "—"}</td>
                  <td className="p-3 font-bold">{total.toFixed(2)} €</td>
                  <td className="p-3 text-xs">{inv.created_at ? new Date(inv.created_at).toLocaleDateString("fr-FR") : ""}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => downloadPdf(inv)} disabled={downloadingId === inv.id} data-testid={`invoice-download-${inv.id}`}>
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => sendByEmail(inv)} disabled={sendingId === inv.id || !inv.customer_email} data-testid={`invoice-send-${inv.id}`} title="Envoyer par email">
                      <Send className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(inv)}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(inv.id)}><Trash2 className="w-4 h-4" /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? `Modifier ${editing.invoice_no}` : "Nouvelle facture"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nom du client</Label><Input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} /></div>
            </div>
            <div><Label>Adresse</Label><Input value={form.billing_address.line1} onChange={e => setForm({ ...form, billing_address: { ...form.billing_address, line1: e.target.value } })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Code postal</Label><Input value={form.billing_address.postal_code} onChange={e => setForm({ ...form, billing_address: { ...form.billing_address, postal_code: e.target.value } })} /></div>
              <div><Label>Ville</Label><Input value={form.billing_address.city} onChange={e => setForm({ ...form, billing_address: { ...form.billing_address, city: e.target.value } })} /></div>
              <div><Label>Pays</Label><Input value={form.billing_address.country} onChange={e => setForm({ ...form, billing_address: { ...form.billing_address, country: e.target.value } })} /></div>
            </div>

            <div>
              <Label>Articles</Label>
              <div className="space-y-2 mt-2">
                {form.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-[80px_1fr_60px_90px_auto] gap-2 items-center">
                    <Input placeholder="Réf." value={it.ref || ""} onChange={e => updateItem(idx, { ref: e.target.value })} />
                    <Input placeholder="Description" value={it.name} onChange={e => updateItem(idx, { name: e.target.value })} />
                    <Input type="number" placeholder="Qté" value={it.quantity} onChange={e => updateItem(idx, { quantity: e.target.value })} />
                    <Input type="number" step="0.01" placeholder="Prix unit." value={it.unit_price} onChange={e => updateItem(idx, { unit_price: e.target.value })} />
                    <Button size="icon" variant="ghost" onClick={() => removeItem(idx)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="rounded-none" onClick={addItem}><Plus className="w-3 h-3 mr-1" />Ligne</Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Taux de TVA (%)</Label><Input type="number" step="0.1" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: e.target.value })} /></div>
              <div>
                <Label>Mode de règlement</Label>
                <Select value={form.payment_method || "Carte"} onValueChange={v => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Carte">Carte</SelectItem>
                    <SelectItem value="Espèces">Espèces</SelectItem>
                    <SelectItem value="Virement bancaire">Virement bancaire</SelectItem>
                    <SelectItem value="Chèque">Chèque</SelectItem>
                    <SelectItem value="Paiement en plusieurs fois (Alma)">Paiement en plusieurs fois (Alma)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Nom du vendeur</Label><Input value={form.seller_name || ""} onChange={e => setForm({ ...form, seller_name: e.target.value })} placeholder="Vente en ligne" /></div>
            <div className="text-sm text-muted-foreground">
              Total TTC : <span className="font-bold text-accent ml-1">{computeInvoiceTotals(form).total.toFixed(2)} €</span>
            </div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

            <Button onClick={save} className="cta-primary rounded-none w-full" data-testid="invoice-form-save">Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CollaboratorsPanel({ authAxios, currentEmail }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const empty = { email: "", password: "", role: "employee" };
  const [form, setForm] = useState(empty);

  const load = useCallback(() => authAxios.get("/admin/collaborators").then(r => setItems(r.data)).catch(() => {}), [authAxios]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      await authAxios.post("/admin/collaborators", form);
      toast.success("Collaborateur ajouté");
      setOpen(false); setForm(empty); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };

  const changeRole = async (id, role) => {
    try { await authAxios.put(`/admin/collaborators/${id}`, { role }); toast.success("Rôle mis à jour"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };

  const del = async (id) => {
    if (!confirm("Supprimer ce collaborateur ?")) return;
    try { await authAxios.delete(`/admin/collaborators/${id}`); toast.success("Supprimé"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };

  return (
    <div>
      <div className="flex justify-between mb-4 items-center">
        <h2 className="display text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5" />Collaborateurs ({items.length})</h2>
        <Button className="cta-primary rounded-none" onClick={() => { setForm(empty); setOpen(true); }} data-testid="new-collaborator-btn">
          <Plus className="w-4 h-4 mr-2" />Nouveau
        </Button>
      </div>
      <div className="border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary"><tr>
            <th className="text-left p-3">Email</th><th className="text-left p-3">Rôle</th>
            <th className="text-left p-3">Ajouté le</th><th></th>
          </tr></thead>
          <tbody>
            {items.map(u => (
              <tr key={u.id} className="border-t border-border" data-testid={`collaborator-row-${u.id}`}>
                <td className="p-3">{u.email}{u.email === currentEmail && <span className="text-xs text-muted-foreground ml-1">(vous)</span>}</td>
                <td className="p-3">
                  <Select value={u.role} onValueChange={v => changeRole(u.id, v)}>
                    <SelectTrigger className="w-36 h-8 rounded-none text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="employee">Employé</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString("fr-FR") : "—"}</td>
                <td className="p-3 text-right">
                  <Button size="icon" variant="ghost" onClick={() => del(u.id)}><Trash2 className="w-4 h-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau collaborateur</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Mot de passe</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
            <div>
              <Label>Rôle</Label>
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employé</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={create} className="cta-primary rounded-none w-full">Créer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MailboxPanel({ authAxios }) {
  const [tab, setTab] = useState("received"); // received | sent
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedFull, setSelectedFull] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const emptyCompose = { to_email: "", to_name: "", subject: "", body: "" };
  const [compose, setCompose] = useState(emptyCompose);

  const load = useCallback(() => {
    authAxios.get("/admin/emails", { params: { direction: tab, search: search || undefined } })
      .then(r => setItems(r.data))
      .catch(() => {});
  }, [authAxios, tab, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelected(null); setSelectedFull(null); }, [tab]);

  const openEmail = async (item) => {
    setSelected(item);
    try {
      const { data } = await authAxios.get(`/admin/emails/${item.id}`);
      setSelectedFull(data);
      if (!item.read) setItems(prev => prev.map(i => i.id === item.id ? { ...i, read: true } : i));
    } catch { toast.error("Erreur lors du chargement de l'email"); }
  };

  const del = async (id) => {
    if (!confirm("Supprimer cet email ?")) return;
    await authAxios.delete(`/admin/emails/${id}`);
    toast.success("Supprimé");
    setSelected(null); setSelectedFull(null);
    load();
  };

  const syncInbox = async () => {
    setSyncing(true);
    try {
      const { data } = await authAxios.post("/admin/emails/sync");
      toast.success(`${data.new_messages} nouveau(x) message(s)`);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur de synchronisation"); }
    finally { setSyncing(false); }
  };

  const send = async () => {
    setSending(true);
    try {
      await authAxios.post("/admin/emails/send", compose);
      toast.success("Email envoyé");
      setComposeOpen(false); setCompose(emptyCompose);
      if (tab === "sent") load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur d'envoi"); }
    finally { setSending(false); }
  };

  const replyTo = (item) => {
    setCompose({
      to_email: tab === "received" ? item.from_email : item.to_email,
      to_name: tab === "received" ? (item.from_name || "") : (item.to_name || ""),
      subject: item.subject?.startsWith("Re:") ? item.subject : `Re: ${item.subject || ""}`,
      body: "",
    });
    setComposeOpen(true);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <h2 className="display text-xl font-bold flex items-center gap-2"><Mail className="w-5 h-5" />Messagerie</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} className="rounded-none h-9 w-48" />
          <Button variant="outline" className="rounded-none" onClick={syncInbox} disabled={syncing} data-testid="mailbox-sync-btn">
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />Actualiser
          </Button>
          <Button className="cta-primary rounded-none" onClick={() => { setCompose(emptyCompose); setComposeOpen(true); }} data-testid="mailbox-compose-btn">
            <Plus className="w-4 h-4 mr-2" />Nouveau message
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Button size="sm" variant={tab === "received" ? "default" : "outline"} className={`rounded-none ${tab === "received" ? "cta-primary" : ""}`} onClick={() => setTab("received")} data-testid="mailbox-tab-received">
          <Inbox className="w-4 h-4 mr-2" />Reçus
        </Button>
        <Button size="sm" variant={tab === "sent" ? "default" : "outline"} className={`rounded-none ${tab === "sent" ? "cta-primary" : ""}`} onClick={() => setTab("sent")} data-testid="mailbox-tab-sent">
          <Send className="w-4 h-4 mr-2" />Envoyés
        </Button>
      </div>

      <div className="grid md:grid-cols-[340px_1fr] gap-4 border border-border" style={{ minHeight: "480px" }}>
        <div className="border-r border-border overflow-y-auto max-h-[600px]">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Aucun email</div>
          ) : items.map(item => (
            <button
              key={item.id}
              onClick={() => openEmail(item)}
              data-testid={`mailbox-item-${item.id}`}
              className={`w-full text-left p-3 border-b border-border transition-colors ${selected?.id === item.id ? "bg-accent/10" : "hover:bg-secondary"} ${!item.read ? "font-semibold" : ""}`}
            >
              <div className="flex justify-between items-center gap-2">
                <span className="text-sm truncate flex items-center gap-1.5">
                  {tab === "received" ? <ArrowDownLeft className="w-3 h-3 shrink-0 text-muted-foreground" /> : <ArrowUpRight className="w-3 h-3 shrink-0 text-muted-foreground" />}
                  {tab === "received" ? (item.from_name || item.from_email) : (item.to_name || item.to_email)}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">{item.created_at ? new Date(item.created_at).toLocaleDateString("fr-FR") : ""}</span>
              </div>
              <div className="text-xs truncate mt-0.5">{item.subject || "(sans objet)"}</div>
              {item.status === "failed" && <span className="text-[10px] text-red-500">Échec d'envoi</span>}
            </button>
          ))}
        </div>

        <div className="p-4 overflow-y-auto max-h-[600px]">
          {!selectedFull ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sélectionnez un email</div>
          ) : (
            <div>
              <div className="flex justify-between items-start mb-4 gap-3">
                <div>
                  <h3 className="font-bold text-lg">{selectedFull.subject || "(sans objet)"}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {tab === "received" ? "De" : "À"} : {tab === "received" ? (selectedFull.from_name || selectedFull.from_email) : (selectedFull.to_name || selectedFull.to_email)}
                    {" "}({tab === "received" ? selectedFull.from_email : selectedFull.to_email})
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedFull.created_at ? new Date(selectedFull.created_at).toLocaleString("fr-FR") : ""}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => replyTo(selectedFull)} title="Répondre"><Send className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(selectedFull.id)} title="Supprimer"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                {selectedFull.html ? (
                  <iframe
                    title="email-body"
                    srcDoc={`<html><head><meta charset="utf-8"><style>html,body{background:#fff;color:#000;margin:0;padding:0;}</style></head><body>${selectedFull.html}</body></html>`}
                    className="w-full border-0 bg-white"
                    style={{ minHeight: "400px" }}
                    sandbox=""
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm">{selectedFull.text || "(vide)"}</pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau message</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Destinataire (email)</Label><Input type="email" value={compose.to_email} onChange={e => setCompose({ ...compose, to_email: e.target.value })} /></div>
              <div><Label>Nom (optionnel)</Label><Input value={compose.to_name} onChange={e => setCompose({ ...compose, to_name: e.target.value })} /></div>
            </div>
            <div><Label>Sujet</Label><Input value={compose.subject} onChange={e => setCompose({ ...compose, subject: e.target.value })} /></div>
            <div><Label>Message</Label><Textarea rows={8} value={compose.body} onChange={e => setCompose({ ...compose, body: e.target.value })} /></div>
            <Button onClick={send} disabled={sending || !compose.to_email || !compose.subject} className="cta-primary rounded-none w-full">
              {sending ? "Envoi..." : "Envoyer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Brand palette (matches --accent / --foreground in index.css): lime #D9FF33, near-black #0F0F10.
const buildFlyerTemplateHtml = () => `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>KamiSTREET x {{association}}</title>
<style>
  body { margin:0; padding:0; background-color:#F4F5F2; font-family:Arial,Helvetica,sans-serif; color:#0F0F10; }
  table { border-spacing:0; border-collapse:collapse; }
  img { border:0; display:block; max-width:100%; }
  a { text-decoration:none; }
  .container { width:100%; max-width:640px; margin:0 auto; background:#ffffff; }
  .lime { color:#8C9E12; }
  .button { display:inline-block; background-color:#D9FF33; color:#0F0F10 !important; padding:15px 28px; border-radius:4px; font-size:16px; font-weight:bold; }
  @media screen and (max-width:600px) {
    .container { width:100% !important; }
    .mobile-padding { padding-left:20px !important; padding-right:20px !important; }
    .hero-title { font-size:28px !important; line-height:34px !important; }
    .benefit { display:block !important; width:100% !important; margin-bottom:15px; }
  }
</style>
</head>
<body>
<table width="100%" bgcolor="#F4F5F2"><tr><td align="center">
<table class="container" width="640">

  <!-- HEADER -->
  <tr><td align="center" style="padding:30px 25px 20px;">
    <a href="https://kamistreet.fr">
      <img src="https://kamistreet.fr/logo/04-logo-kamistreet.jpg" width="180" alt="KamiSTREET" style="margin:0 auto;border-radius:6px;">
    </a>
    <p style="margin:10px 0 0;font-size:13px;color:#8C9E12;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;">
      Vos projets de mobilité douce
    </p>
  </td></tr>

  <!-- HERO -->
  <tr><td style="padding:0 20px;">
    <table width="100%" style="border-radius:12px;overflow:hidden;background:#F1FBD9;">
      <tr>
        <td width="46%" valign="middle" style="padding:30px 20px 30px 28px;">
          <p style="margin:0 0 8px;font-size:16px;font-weight:bold;color:#0F0F10;">KamiSTREET ×</p>
          <h1 class="hero-title" style="margin:0;font-size:30px;line-height:36px;color:#0F0F10;">{{association}}</h1>
          <p style="margin:16px 0 0;font-size:17px;line-height:25px;color:#0F0F10;font-weight:bold;">
            Des solutions de mobilité douce pour vos adhérents
          </p>
        </td>
        <td width="54%" valign="middle">
          <img src="https://kamistreet.fr/logo/01-photo-famille-cargo.jpg" width="350" alt="Mobilité douce en famille" style="width:100%;height:auto;">
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- INTRO -->
  <tr><td class="mobile-padding" style="padding:32px 40px 15px;font-size:15px;line-height:25px;color:#333333;">
    <p style="margin:0 0 16px;">Bonjour <strong>{{name}}</strong>,</p>
    <p style="margin:0 0 16px;">Nous sommes <strong>KamiSTREET</strong>, spécialiste des vélos à assistance électrique à Épinay-sur-Seine.</p>
    <p style="margin:0;">Nous accompagnons les <strong>associations et leurs adhérents</strong> dans leurs projets de mobilité douce, avec des solutions adaptées aux besoins de chacun.</p>
  </td></tr>

  <!-- TITRE SOLUTIONS -->
  <tr><td style="padding:20px 20px 0;">
    <table width="100%" style="background:#0F0F10;border-radius:8px 8px 0 0;">
      <tr><td align="center" style="padding:14px 10px;color:#ffffff;font-size:18px;font-weight:bold;">
        DES SOLUTIONS ADAPTÉES À VOS BESOINS
      </td></tr>
    </table>
  </td></tr>

  <!-- SOLUTIONS -->
  <tr><td style="padding:0 20px;">
    <table width="100%" style="background:#D9FF33;border-radius:0 0 8px 8px;">
      <tr>
        <td width="42%" valign="top" style="padding:20px 12px 20px 20px;">
          <img src="https://kamistreet.fr/logo/02-velos-electriques-boutique.jpg" width="240" alt="Vélos électriques KamiSTREET en boutique" style="width:100%;border-radius:6px;margin:0 0 10px;">
          <img src="https://kamistreet.fr/logo/03-velos-pliants.jpg" width="240" alt="Vélos pliants électriques KamiSTREET" style="width:100%;border-radius:6px;">
        </td>
        <td width="58%" valign="middle" style="padding:20px 25px 20px 8px;">
          <p style="margin:0 0 6px;font-size:19px;line-height:24px;font-weight:bold;color:#0F0F10;">VÉLOS À ASSISTANCE ÉLECTRIQUE</p>
          <p style="margin:0 0 14px;font-size:14px;line-height:22px;font-weight:bold;color:#0F0F10;">Modèles individuels et familiaux</p>
          <p style="margin:0;font-size:13px;line-height:23px;color:#0F0F10;">
            Modèles individuels<br>
            Modèles familiaux<br>
            Vélos cargo<br>
            Vélos pliants
          </p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- BENEFICES -->
  <tr><td style="padding:22px 20px 5px;">
    <img src="https://kamistreet.fr/asso-mail-banner-1.png" width="600" alt="Apprentissage, Autonomie, Mobilité, Lien familial" style="width:100%;height:auto;border-radius:8px;">
  </td></tr>

  <!-- FINANCEMENT -->
  <tr><td style="padding:18px 20px;">
    <table width="100%" style="background:#F5B800;border-radius:8px;">
      <tr><td align="center" style="padding:18px;">
        <p style="margin:0 0 8px;font-size:18px;font-weight:bold;color:#0F0F10;">DES FINANCEMENTS PEUVENT ÊTRE MOBILISÉS</p>
        <p style="margin:0;display:inline-block;padding:9px 18px;background:#0F0F10;border-radius:4px;color:#ffffff;font-size:14px;font-weight:bold;">
          CAF &nbsp;•&nbsp; DÉPARTEMENT &nbsp;•&nbsp; CNAV &nbsp;•&nbsp; RÉGION
        </p>
      </td></tr>
    </table>
  </td></tr>

  <!-- MESSAGE PARTENARIAT -->
  <tr><td class="mobile-padding" style="padding:18px 40px;font-size:15px;line-height:25px;color:#333333;">
    <p style="margin:0 0 14px;font-size:18px;font-weight:bold;color:#0F0F10;">Un projet pour vos adhérents ?</p>
    <p style="margin:0 0 14px;">Nous serions ravis d'échanger avec vous sur un accompagnement adapté aux besoins de {{association}} :</p>
    <ul style="padding-left:20px;margin:0;">
      <li style="margin-bottom:6px;">Essais en magasin</li>
      <li style="margin-bottom:6px;">Tarifs adaptés aux associations</li>
      <li style="margin-bottom:6px;">Modèles familiaux et cargo</li>
      <li style="margin-bottom:6px;">Vélos pliants</li>
      <li>Accompagnement sur les solutions de financement</li>
    </ul>
  </td></tr>

  <!-- CTA -->
  <tr><td align="center" style="padding:12px 30px 36px;">
    <p style="margin:0 0 18px;font-size:16px;font-weight:bold;color:#0F0F10;">Échangeons ensemble sur votre projet.</p>
    <a href="mailto:contact@kamistreet.fr" class="button">RÉPONDRE À CET EMAIL</a>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:0 20px 24px;">
    <table width="100%" style="background:#0F0F10;border-radius:10px;">
      <tr>
        <td width="50%" style="padding:22px;">
          <img src="https://kamistreet.fr/logo/kami-street-black.png" width="150" alt="KamiSTREET" style="filter:brightness(0) invert(1);">
          <table style="margin:14px 0 0;"><tr>
            <td valign="top" style="padding-right:6px;"><img src="https://kamistreet.fr/logo/favicon-koala.png" width="16" alt="" style="filter:brightness(0) invert(1);margin-top:2px;"></td>
            <td style="color:#ffffff;font-size:13px;line-height:21px;">59 avenue Joffre<br>93800 Épinay-sur-Seine</td>
          </tr></table>
        </td>
        <td width="50%" valign="middle" style="padding:22px;color:#ffffff;font-size:13px;">
          <p style="margin:0 0 8px;font-weight:bold;font-size:15px;">Suivez-nous</p>
          <p style="margin:0 0 14px;">TikTok : <a href="https://www.tiktok.com/@kami_street_" style="color:#D9FF33;">@kami_street_</a></p>
          <a href="https://kamistreet.fr" style="display:inline-block;color:#ffffff;border:1px solid #D9FF33;padding:7px 14px;border-radius:4px;">kamistreet.fr</a>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- FOOTER LEGAL -->
  <tr><td align="center" style="padding:0 25px 28px;font-size:11px;line-height:18px;color:#888888;">
    <p style="margin:0 0 5px;">Cet email vous a été envoyé par KamiSTREET.</p>
    <p style="margin:0;">Vous ne souhaitez plus recevoir nos emails ? <a href="mailto:contact@kamistreet.fr?subject=Désinscription" style="color:#777777;text-decoration:underline;">Cliquez ici pour vous désinscrire.</a></p>
  </td></tr>

</table>
</td></tr></table>
</body>
</html>`.trim();

const FLYER_TEMPLATE = {
  subject: "KamiSTREET x {{association}} — vélos électriques et mobilité douce en famille",
  html: buildFlyerTemplateHtml(),
};

function CampaignsPanel({ authAxios }) {
  const [campaigns, setCampaigns] = useState([]);
  const [open, setOpen] = useState(false);
  const emptyForm = { name: "", subject: "", html: "" };
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState(null);
  const [leads, setLeads] = useState([]);
  const [importing, setImporting] = useState(false);
  const [sending, setSending] = useState(false);
  const emptyLead = { email: "", name: "", association: "", city: "", phone: "" };
  const [leadForm, setLeadForm] = useState(emptyLead);
  const [addingLead, setAddingLead] = useState(false);

  const load = useCallback(() => {
    authAxios.get("/admin/campaigns").then(r => setCampaigns(r.data)).catch(() => {});
  }, [authAxios]);

  useEffect(() => { load(); }, [load]);

  const loadLeads = useCallback((cid) => {
    authAxios.get(`/admin/campaigns/${cid}/leads`).then(r => setLeads(r.data)).catch(() => {});
  }, [authAxios]);

  const openCampaign = (c) => { setSelected(c); loadLeads(c.id); setLeadForm(emptyLead); };

  const useFlyerTemplate = () => setForm(f => ({ ...f, subject: FLYER_TEMPLATE.subject, html: FLYER_TEMPLATE.html }));

  const addLead = async () => {
    if (!selected || !leadForm.email) return;
    setAddingLead(true);
    try {
      await authAxios.post(`/admin/campaigns/${selected.id}/leads`, leadForm);
      toast.success("Contact ajouté");
      setLeadForm(emptyLead);
      load(); loadLeads(selected.id);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur d'ajout");
    } finally { setAddingLead(false); }
  };

  const delLead = async (leadId) => {
    if (!selected) return;
    await authAxios.delete(`/admin/campaigns/${selected.id}/leads/${leadId}`);
    load(); loadLeads(selected.id);
  };

  useEffect(() => {
    if (!selected) return;
    if (selected.status !== "sending") return;
    const t = setInterval(() => {
      authAxios.get(`/admin/campaigns/${selected.id}`).then(r => {
        setSelected(r.data);
        setCampaigns(prev => prev.map(c => c.id === r.data.id ? r.data : c));
      }).catch(() => {});
      loadLeads(selected.id);
    }, 4000);
    return () => clearInterval(t);
  }, [selected, authAxios, loadLeads]);

  const create = async () => {
    try {
      await authAxios.post("/admin/campaigns", form);
      toast.success("Campagne créée");
      setOpen(false); setForm(emptyForm); load();
    } catch { toast.error("Erreur"); }
  };

  const del = async (id) => {
    if (!confirm("Supprimer cette campagne et ses destinataires ?")) return;
    await authAxios.delete(`/admin/campaigns/${id}`);
    if (selected?.id === id) setSelected(null);
    toast.success("Supprimé"); load();
  };

  const importFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await authAxios.post(`/admin/campaigns/${selected.id}/import`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`${data.imported} contact(s) importé(s), ${data.skipped} ignoré(s)`);
      load(); loadLeads(selected.id);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur d'import");
    } finally { setImporting(false); e.target.value = ""; }
  };

  const launchSend = async () => {
    if (!selected) return;
    if (!confirm(`Envoyer cette campagne à ${selected.pending} destinataire(s) en attente ?`)) return;
    setSending(true);
    try {
      await authAxios.post(`/admin/campaigns/${selected.id}/send`);
      toast.success("Envoi lancé");
      const { data } = await authAxios.get(`/admin/campaigns/${selected.id}`);
      setSelected(data);
      setCampaigns(prev => prev.map(c => c.id === data.id ? data : c));
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur au lancement");
    } finally { setSending(false); }
  };

  const STATUS_LABELS = { draft: "Brouillon", sending: "Envoi en cours", done: "Terminée" };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="display text-xl font-bold">Campagnes email ({campaigns.length})</h2>
        <Button onClick={() => { setForm(emptyForm); setOpen(true); }} className="cta-primary rounded-none" data-testid="campaign-new-btn">
          <Plus className="w-4 h-4 mr-2" />Nouvelle campagne
        </Button>
      </div>

      <div className="grid md:grid-cols-[300px_1fr] gap-4">
        <div className="border border-border overflow-y-auto max-h-[600px]">
          {campaigns.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Aucune campagne</div>
          ) : campaigns.map(c => (
            <button
              key={c.id}
              onClick={() => openCampaign(c)}
              data-testid={`campaign-item-${c.id}`}
              className={`w-full text-left p-3 border-b border-border transition-colors ${selected?.id === c.id ? "bg-accent/10" : "hover:bg-secondary"}`}
            >
              <div className="flex justify-between items-center gap-2">
                <span className="text-sm font-semibold truncate">{c.name}</span>
                <span className="text-[10px] uppercase text-muted-foreground shrink-0">{STATUS_LABELS[c.status] || c.status}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">{c.subject}</div>
              <div className="text-[10px] mt-1 text-muted-foreground">
                {c.sent}/{c.total} envoyés {c.failed > 0 && `· ${c.failed} échecs`} {c.replied > 0 && `· ${c.replied} réponses`}
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 border border-border">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sélectionnez une campagne</div>
          ) : (
            <div>
              <div className="flex justify-between items-start mb-4 gap-3 flex-wrap">
                <div>
                  <h3 className="font-bold text-lg">{selected.name}</h3>
                  <p className="text-xs text-muted-foreground">{selected.subject}</p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <label>
                    <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={importFile} disabled={importing} data-testid="campaign-import-input" />
                    <span className={`inline-flex items-center gap-2 px-3 py-2 border border-border text-xs cursor-pointer hover:bg-secondary ${importing ? "opacity-50 pointer-events-none" : ""}`}>
                      <Users className="w-3 h-3" />{importing ? "Import..." : "Importer CSV / Excel"}
                    </span>
                  </label>
                  <Button
                    size="sm"
                    className="cta-primary rounded-none"
                    onClick={launchSend}
                    disabled={sending || selected.status === "sending" || (selected.pending || 0) === 0}
                    data-testid="campaign-send-btn"
                  >
                    <Send className="w-3 h-3 mr-2" />
                    {selected.status === "sending" ? "Envoi en cours..." : `Lancer l'envoi (${selected.pending || 0})`}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => del(selected.id)} title="Supprimer"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="border border-border p-2 text-center">
                  <div className="text-lg font-black">{selected.total || 0}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">Contacts</div>
                </div>
                <div className="border border-border p-2 text-center">
                  <div className="text-lg font-black text-accent">{selected.sent || 0}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">Envoyés</div>
                </div>
                <div className="border border-border p-2 text-center">
                  <div className="text-lg font-black text-red-500">{selected.failed || 0}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">Échecs</div>
                </div>
                <div className="border border-border p-2 text-center">
                  <div className="text-lg font-black text-green-600">{selected.replied || 0}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">Réponses</div>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2 mb-4 border border-border p-3">
                <div className="flex-1 min-w-[160px]">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={leadForm.email} onChange={e => setLeadForm({ ...leadForm, email: e.target.value })} className="h-8" data-testid="campaign-lead-email-input" />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <Label className="text-xs">Nom</Label>
                  <Input value={leadForm.name} onChange={e => setLeadForm({ ...leadForm, name: e.target.value })} className="h-8" />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <Label className="text-xs">Nom association / structure</Label>
                  <Input value={leadForm.association} onChange={e => setLeadForm({ ...leadForm, association: e.target.value, name: e.target.value })} className="h-8" />
                </div>
                <div className="flex-1 min-w-[100px]">
                  <Label className="text-xs">Ville</Label>
                  <Input value={leadForm.city} onChange={e => setLeadForm({ ...leadForm, city: e.target.value })} className="h-8" />
                </div>
                <div className="flex-1 min-w-[110px]">
                  <Label className="text-xs">Téléphone</Label>
                  <Input value={leadForm.phone} onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })} className="h-8" />
                </div>
                <Button size="sm" className="cta-primary rounded-none h-8" onClick={addLead} disabled={addingLead || !leadForm.email} data-testid="campaign-add-lead-btn">
                  <Plus className="w-3 h-3 mr-1" />Ajouter
                </Button>
              </div>

              <div className="border border-border overflow-y-auto max-h-[360px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-secondary">
                    <tr>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Association / Structure</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Ville</th>
                      <th className="text-left p-2">Téléphone</th>
                      <th className="text-left p-2">Statut</th>
                      <th className="text-left p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.length === 0 ? (
                      <tr><td colSpan={7} className="p-4 text-center text-muted-foreground text-xs">Aucun contact — importez un fichier ou ajoutez-en un manuellement ci-dessus</td></tr>
                    ) : leads.map(l => (
                      <tr key={l.id} className="border-t border-border" data-testid={`campaign-lead-${l.id}`}>
                        <td className="p-2 truncate max-w-[180px]">{l.email}</td>
                        <td className="p-2 truncate max-w-[160px]">{l.association || l.name}</td>
                        <td className="p-2 truncate max-w-[100px]">{l.type_structure}</td>
                        <td className="p-2 truncate max-w-[100px]">{l.city}</td>
                        <td className="p-2 truncate max-w-[110px]">{l.phone}</td>
                        <td className="p-2">
                          {l.replied ? (
                            <span className="text-[10px] uppercase text-green-600 font-semibold">Répondu</span>
                          ) : l.status === "sent" ? (
                            <span className="text-[10px] uppercase text-accent">Envoyé</span>
                          ) : l.status === "failed" ? (
                            <span className="text-[10px] uppercase text-red-500">Échec</span>
                          ) : (
                            <span className="text-[10px] uppercase text-muted-foreground">En attente</span>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => delLead(l.id)} title="Retirer">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle campagne</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom (interne)</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Associations - rentrée 2026" /></div>
            <Button type="button" variant="outline" size="sm" className="rounded-none" onClick={useFlyerTemplate} data-testid="campaign-use-flyer-template-btn">
              Utiliser le modèle du flyer associations
            </Button>
            <div><Label>Objet de l'email</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
            <div>
              <Label>Email complet (HTML autonome — logo, mise en page, pied de page inclus. Variables {"{{name}}"} et {"{{association}}"})</Label>
              <Textarea rows={10} value={form.html} onChange={e => setForm({ ...form, html: e.target.value })} />
            </div>
            <Button onClick={create} disabled={!form.name || !form.subject || !form.html} className="cta-primary rounded-none w-full">
              Créer la campagne
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
