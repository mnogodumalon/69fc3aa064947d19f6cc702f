import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichKatzenverwaltung, enrichBuchungsverwaltung } from '@/lib/enrich';
import type { EnrichedBuchungsverwaltung } from '@/types/enriched';
import type { Buchungsverwaltung, Gesundheitsprotokoll } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { IconAlertCircle, IconTool, IconRefresh, IconCheck, IconPlus, IconPencil, IconTrash, IconCat, IconBed, IconCalendar, IconUsers, IconCurrencyEuro, IconClipboardList, IconChevronRight, IconHeartbeat, IconDoor } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { BuchungsverwaltungDialog } from '@/components/dialogs/BuchungsverwaltungDialog';
import { GesundheitsprotokollDialog } from '@/components/dialogs/GesundheitsprotokollDialog';

const APPGROUP_ID = '69fc3aa064947d19f6cc702f';
const REPAIR_ENDPOINT = '/claude/build/repair';

const STATUS_ORDER = ['anfrage', 'bestaetigt', 'eingecheckt', 'ausgecheckt', 'storniert'];

const STATUS_CONFIG: Record<string, { label: string; color: string; badge: string }> = {
  anfrage: { label: 'Anfrage', color: 'border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/20', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  bestaetigt: { label: 'Bestätigt', color: 'border-blue-400/40 bg-blue-50/60 dark:bg-blue-950/20', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  eingecheckt: { label: 'Eingecheckt', color: 'border-green-400/40 bg-green-50/60 dark:bg-green-950/20', badge: 'bg-green-100 text-green-700 border-green-200' },
  ausgecheckt: { label: 'Ausgecheckt', color: 'border-slate-300/40 bg-slate-50/60 dark:bg-slate-900/20', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  storniert: { label: 'Storniert', color: 'border-red-300/40 bg-red-50/40 dark:bg-red-950/20', badge: 'bg-red-100 text-red-600 border-red-200' },
};

export default function DashboardOverview() {
  const {
    kundenverwaltung, katzenverwaltung, zimmerverwaltung, leistungsverwaltung, buchungsverwaltung, gesundheitsprotokoll,
    kundenverwaltungMap, katzenverwaltungMap, zimmerverwaltungMap, leistungsverwaltungMap, buchungsverwaltungMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedKatzenverwaltung = enrichKatzenverwaltung(katzenverwaltung, { kundenverwaltungMap });
  const enrichedBuchungsverwaltung = enrichBuchungsverwaltung(buchungsverwaltung, { kundenverwaltungMap, katzenverwaltungMap, zimmerverwaltungMap, leistungsverwaltungMap });

  const [buchungDialogOpen, setBuchungDialogOpen] = useState(false);
  const [editBuchung, setEditBuchung] = useState<EnrichedBuchungsverwaltung | null>(null);
  const [deleteBuchung, setDeleteBuchung] = useState<EnrichedBuchungsverwaltung | null>(null);
  const [gesundheitDialogOpen, setGesundheitDialogOpen] = useState(false);
  const [editGesundheit, setEditGesundheit] = useState<Gesundheitsprotokoll | null>(null);
  const [deleteGesundheit, setDeleteGesundheit] = useState<Gesundheitsprotokoll | null>(null);
  const [activeTab, setActiveTab] = useState<'buchungen' | 'gesundheit'>('buchungen');
  const [selectedBuchungId, setSelectedBuchungId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const kanbanColumns = useMemo(() => {
    const cols: Record<string, EnrichedBuchungsverwaltung[]> = {};
    STATUS_ORDER.forEach(s => { cols[s] = []; });
    enrichedBuchungsverwaltung.forEach(b => {
      const key = b.fields.buchungsstatus?.key ?? 'anfrage';
      if (cols[key]) cols[key].push(b);
    });
    return cols;
  }, [enrichedBuchungsverwaltung]);

  const currentlyCheckedIn = kanbanColumns['eingecheckt']?.length ?? 0;
  const totalRevenue = enrichedBuchungsverwaltung.reduce((sum, b) => sum + (b.fields.gesamtpreis ?? 0), 0);
  const zimmerBelegt = zimmerverwaltung.filter(z => z.fields.zimmer_status?.key === 'belegt').length;
  const openAnfragen = kanbanColumns['anfrage']?.length ?? 0;

  const filteredGesundheit = useMemo(() => {
    if (!selectedBuchungId) return gesundheitsprotokoll;
    return gesundheitsprotokoll.filter(g => {
      const url = g.fields.buchung ?? '';
      return url.includes(selectedBuchungId);
    });
  }, [gesundheitsprotokoll, selectedBuchungId]);

  const handleCreateBuchung = async (fields: Buchungsverwaltung['fields']) => {
    await LivingAppsService.createBuchungsverwaltungEntry(fields);
    fetchAll();
  };

  const handleEditBuchung = async (fields: Buchungsverwaltung['fields']) => {
    if (!editBuchung) return;
    await LivingAppsService.updateBuchungsverwaltungEntry(editBuchung.record_id, fields);
    fetchAll();
  };

  const handleDeleteBuchung = async () => {
    if (!deleteBuchung) return;
    await LivingAppsService.deleteBuchungsverwaltungEntry(deleteBuchung.record_id);
    setDeleteBuchung(null);
    fetchAll();
  };

  const handleCreateGesundheit = async (fields: Gesundheitsprotokoll['fields']) => {
    await LivingAppsService.createGesundheitsprotokollEntry(fields);
    fetchAll();
  };

  const handleEditGesundheit = async (fields: Gesundheitsprotokoll['fields']) => {
    if (!editGesundheit) return;
    await LivingAppsService.updateGesundheitsprotokollEntry(editGesundheit.record_id, fields);
    fetchAll();
  };

  const handleDeleteGesundheit = async () => {
    if (!deleteGesundheit) return;
    await LivingAppsService.deleteGesundheitsprotokollEntry(deleteGesundheit.record_id);
    setDeleteGesundheit(null);
    fetchAll();
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      {/* KPI-Karten */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Eingecheckt"
          value={String(currentlyCheckedIn)}
          description="Katzen vor Ort"
          icon={<IconCat size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Zimmer belegt"
          value={`${zimmerBelegt}/${zimmerverwaltung.length}`}
          description="Auslastung"
          icon={<IconBed size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Offene Anfragen"
          value={String(openAnfragen)}
          description="Zu bestätigen"
          icon={<IconCalendar size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Umsatz gesamt"
          value={formatCurrency(totalRevenue)}
          description="Alle Buchungen"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('buchungen')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'buchungen' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <span className="flex items-center gap-1.5">
            <IconClipboardList size={15} className="shrink-0" />
            Buchungen
          </span>
        </button>
        <button
          onClick={() => setActiveTab('gesundheit')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'gesundheit' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <span className="flex items-center gap-1.5">
            <IconHeartbeat size={15} className="shrink-0" />
            Gesundheitsprotokoll
            {filteredGesundheit.length > 0 && (
              <span className="ml-1 text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{filteredGesundheit.length}</span>
            )}
          </span>
        </button>
      </div>

      {/* BUCHUNGEN: Kanban */}
      {activeTab === 'buchungen' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-base font-semibold text-foreground">Buchungen nach Status</h2>
            <Button size="sm" onClick={() => { setEditBuchung(null); setBuchungDialogOpen(true); }}>
              <IconPlus size={15} className="mr-1 shrink-0" />
              Neue Buchung
            </Button>
          </div>

          {/* Kanban Board — horizontal scroll on mobile */}
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-max lg:min-w-0 lg:grid lg:grid-cols-5">
              {STATUS_ORDER.map(statusKey => {
                const cfg = STATUS_CONFIG[statusKey];
                const cards = kanbanColumns[statusKey] ?? [];
                return (
                  <div key={statusKey} className={`w-56 lg:w-auto rounded-xl border ${cfg.color} flex flex-col min-h-[200px]`}>
                    {/* Column header */}
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-inherit">
                      <span className="text-xs font-semibold text-foreground">{cfg.label}</span>
                      <span className={`text-xs rounded-full px-1.5 py-0.5 border font-medium ${cfg.badge}`}>{cards.length}</span>
                    </div>
                    {/* Cards */}
                    <div className="flex flex-col gap-2 p-2 flex-1">
                      {cards.length === 0 && (
                        <div className="flex items-center justify-center flex-1 text-xs text-muted-foreground py-4">Keine Einträge</div>
                      )}
                      {cards.map(b => (
                        <BuchungsCard
                          key={b.record_id}
                          buchung={b}
                          today={today}
                          onEdit={() => { setEditBuchung(b); setBuchungDialogOpen(true); }}
                          onDelete={() => setDeleteBuchung(b)}
                          onGesundheit={() => {
                            setSelectedBuchungId(b.record_id);
                            setActiveTab('gesundheit');
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* GESUNDHEITSPROTOKOLL */}
      {activeTab === 'gesundheit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-base font-semibold text-foreground">Gesundheitsprotokoll</h2>
              {selectedBuchungId && (
                <button
                  onClick={() => setSelectedBuchungId(null)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground bg-muted rounded-full px-2 py-0.5"
                >
                  Buchungsfilter aktiv
                  <IconChevronRight size={12} className="rotate-180" />
                  Alle anzeigen
                </button>
              )}
            </div>
            <Button size="sm" onClick={() => { setEditGesundheit(null); setGesundheitDialogOpen(true); }}>
              <IconPlus size={15} className="mr-1 shrink-0" />
              Neues Protokoll
            </Button>
          </div>

          {filteredGesundheit.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-dashed border-border">
              <IconHeartbeat size={40} className="text-muted-foreground" stroke={1.5} />
              <p className="text-sm text-muted-foreground">Noch keine Gesundheitseinträge vorhanden.</p>
              <Button size="sm" variant="outline" onClick={() => { setEditGesundheit(null); setGesundheitDialogOpen(true); }}>
                <IconPlus size={14} className="mr-1" />
                Ersten Eintrag anlegen
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Datum</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Katze</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fressen</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Aktivität</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Befinden</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Medikamente</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredGesundheit.map(g => {
                    const katzeId = (g.fields.katze ?? '').split('/').pop() ?? '';
                    const katzeRecord = katzenverwaltungMap.get(katzeId);
                    return (
                      <tr key={g.record_id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(g.fields.protokoll_datum)}</td>
                        <td className="px-4 py-3 font-medium">{katzeRecord?.fields.katze_name ?? '—'}</td>
                        <td className="px-4 py-3">
                          {g.fields.fressverhalten ? (
                            <BefindenBadge val={g.fields.fressverhalten.key} label={g.fields.fressverhalten.label} />
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {g.fields.aktivitaet ? (
                            <BefindenBadge val={g.fields.aktivitaet.key} label={g.fields.aktivitaet.label} />
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {g.fields.befinden ? (
                            <BefindenBadge val={g.fields.befinden.key} label={g.fields.befinden.label} />
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {g.fields.medikamente_verabreicht ? (
                            <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5">Ja</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Nein</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => { setEditGesundheit(g); setGesundheitDialogOpen(true); }}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="Bearbeiten"
                            >
                              <IconPencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteGesundheit(g)}
                              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                              title="Löschen"
                            >
                              <IconTrash size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Zimmerübersicht */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <IconDoor size={18} className="text-muted-foreground shrink-0" />
          Zimmerübersicht
        </h2>
        {zimmerverwaltung.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">Noch keine Zimmer angelegt.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {zimmerverwaltung.map(z => {
              const status = z.fields.zimmer_status?.key ?? 'verfuegbar';
              const statusLabel = z.fields.zimmer_status?.label ?? 'Verfügbar';
              const statusColors: Record<string, string> = {
                verfuegbar: 'bg-green-100 text-green-700 border-green-200',
                belegt: 'bg-blue-100 text-blue-700 border-blue-200',
                in_reinigung: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                gesperrt: 'bg-red-100 text-red-600 border-red-200',
              };
              return (
                <div key={z.record_id} className="rounded-xl border border-border bg-card p-4 space-y-2 overflow-hidden">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{z.fields.zimmer_name ?? 'Zimmer'}</p>
                      <p className="text-xs text-muted-foreground">{z.fields.zimmer_typ?.label ?? '—'}</p>
                    </div>
                    <span className={`text-xs rounded-full px-2 py-0.5 border shrink-0 ${statusColors[status] ?? statusColors['verfuegbar']}`}>{statusLabel}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <IconUsers size={12} className="shrink-0" />
                      {z.fields.kapazitaet ?? '—'} Katzen
                    </span>
                    <span className="font-medium text-foreground">{z.fields.tagespreis != null ? formatCurrency(z.fields.tagespreis) + '/Tag' : '—'}</span>
                  </div>
                  {z.fields.ausstattung && z.fields.ausstattung.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {z.fields.ausstattung.slice(0, 3).map(a => (
                        <span key={a.key} className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">{a.label}</span>
                      ))}
                      {z.fields.ausstattung.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{z.fields.ausstattung.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Aktive Katzen heute */}
      {enrichedKatzenverwaltung.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <IconCat size={18} className="text-muted-foreground shrink-0" />
            Katzen ({enrichedKatzenverwaltung.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            {enrichedKatzenverwaltung.map(k => (
              <div key={k.record_id} className="rounded-xl border border-border bg-card p-3 flex flex-col gap-1 overflow-hidden">
                <p className="font-semibold text-sm text-foreground truncate">{k.fields.katze_name ?? '—'}</p>
                <p className="text-xs text-muted-foreground truncate">{k.fields.rasse ?? 'Unbekannte Rasse'}</p>
                <p className="text-xs text-muted-foreground truncate">{k.besitzerName}</p>
                {k.fields.impfstatus && k.fields.impfstatus.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {k.fields.impfstatus.slice(0, 2).map(i => (
                      <span key={i.key} className="text-xs bg-green-50 text-green-700 border border-green-100 rounded px-1 py-0.5">{i.label}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialoge */}
      <BuchungsverwaltungDialog
        open={buchungDialogOpen}
        onClose={() => { setBuchungDialogOpen(false); setEditBuchung(null); }}
        onSubmit={editBuchung ? handleEditBuchung : handleCreateBuchung}
        defaultValues={editBuchung?.fields}
        kundenverwaltungList={kundenverwaltung}
        katzenverwaltungList={katzenverwaltung}
        zimmerverwaltungList={zimmerverwaltung}
        leistungsverwaltungList={leistungsverwaltung}
        enablePhotoScan={AI_PHOTO_SCAN['Buchungsverwaltung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Buchungsverwaltung']}
      />

      <GesundheitsprotokollDialog
        open={gesundheitDialogOpen}
        onClose={() => { setGesundheitDialogOpen(false); setEditGesundheit(null); }}
        onSubmit={editGesundheit ? handleEditGesundheit : handleCreateGesundheit}
        defaultValues={editGesundheit
          ? {
              ...editGesundheit.fields,
              buchung: editGesundheit.fields.buchung,
            }
          : selectedBuchungId
          ? {
              buchung: createRecordUrl(APP_IDS.BUCHUNGSVERWALTUNG, selectedBuchungId),
            }
          : undefined
        }
        buchungsverwaltungList={buchungsverwaltung}
        katzenverwaltungList={katzenverwaltung}
        enablePhotoScan={AI_PHOTO_SCAN['Gesundheitsprotokoll']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Gesundheitsprotokoll']}
      />

      <ConfirmDialog
        open={!!deleteBuchung}
        title="Buchung löschen"
        description={`Buchung ${deleteBuchung?.fields.buchungsnummer ?? ''} wirklich löschen? Dies kann nicht rückgängig gemacht werden.`}
        onConfirm={handleDeleteBuchung}
        onClose={() => setDeleteBuchung(null)}
      />

      <ConfirmDialog
        open={!!deleteGesundheit}
        title="Protokolleintrag löschen"
        description="Diesen Gesundheitseintrag wirklich löschen?"
        onConfirm={handleDeleteGesundheit}
        onClose={() => setDeleteGesundheit(null)}
      />
    </div>
  );
}

// ─── Buchungskarte ────────────────────────────────────────────────────────────

function BuchungsCard({
  buchung,
  today,
  onEdit,
  onDelete,
  onGesundheit,
}: {
  buchung: EnrichedBuchungsverwaltung;
  today: string;
  onEdit: () => void;
  onDelete: () => void;
  onGesundheit: () => void;
}) {
  const isToday = (dt?: string) => dt?.slice(0, 10) === today;
  const anreise = buchung.fields.anreise?.slice(0, 10);
  const abreise = buchung.fields.abreise?.slice(0, 10);

  return (
    <div className="bg-white dark:bg-card rounded-lg border border-border p-3 space-y-2 shadow-sm">
      {/* Buchungsnummer + Aktionen */}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="text-xs font-mono text-muted-foreground truncate">{buchung.fields.buchungsnummer ?? '—'}</p>
          <p className="font-semibold text-sm text-foreground truncate">{buchung.kundeName}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={onGesundheit} className="p-1 rounded hover:bg-green-50 text-muted-foreground hover:text-green-600 transition-colors" title="Gesundheitsprotokoll">
            <IconHeartbeat size={13} />
          </button>
          <button onClick={onEdit} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Bearbeiten">
            <IconPencil size={13} />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" title="Löschen">
            <IconTrash size={13} />
          </button>
        </div>
      </div>

      {/* Katze + Zimmer */}
      <div className="space-y-0.5">
        {buchung.katzenName && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <IconCat size={11} className="shrink-0" />
            <span className="truncate">{buchung.katzenName}</span>
          </div>
        )}
        {buchung.zimmerName && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <IconBed size={11} className="shrink-0" />
            <span className="truncate">{buchung.zimmerName}</span>
          </div>
        )}
      </div>

      {/* Zeitraum */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <IconCalendar size={11} className="shrink-0" />
        <span className={`${isToday(anreise) ? 'text-green-600 font-medium' : ''}`}>{anreise ? formatDate(anreise) : '—'}</span>
        <span>→</span>
        <span className={`${isToday(abreise) ? 'text-orange-500 font-medium' : ''}`}>{abreise ? formatDate(abreise) : '—'}</span>
      </div>

      {/* Preis + Zahlungsstatus */}
      {(buchung.fields.gesamtpreis != null || buchung.fields.zahlungsstatus) && (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
          {buchung.fields.gesamtpreis != null && (
            <span className="text-xs font-semibold text-foreground">{formatCurrency(buchung.fields.gesamtpreis)}</span>
          )}
          {buchung.fields.zahlungsstatus && (
            <ZahlungsStatusBadge val={buchung.fields.zahlungsstatus.key} label={buchung.fields.zahlungsstatus.label} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Badges ──────────────────────────────────────────────────────────────────

function BefindenBadge({ val, label }: { val: string; label: string }) {
  const colors: Record<string, string> = {
    sehr_gut: 'bg-green-100 text-green-700 border-green-200',
    gut: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    normal: 'bg-blue-50 text-blue-600 border-blue-200',
    sehr_aktiv: 'bg-purple-50 text-purple-700 border-purple-200',
    ruhig: 'bg-slate-50 text-slate-600 border-slate-200',
    apathisch: 'bg-orange-100 text-orange-700 border-orange-200',
    maessig: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    schlecht: 'bg-red-100 text-red-600 border-red-200',
    verweigert: 'bg-red-100 text-red-600 border-red-200',
    auffaellig: 'bg-orange-100 text-orange-700 border-orange-200',
    krank: 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 border ${colors[val] ?? 'bg-muted text-muted-foreground border-border'}`}>
      {label}
    </span>
  );
}

function ZahlungsStatusBadge({ val, label }: { val: string; label: string }) {
  const colors: Record<string, string> = {
    offen: 'bg-red-50 text-red-600 border-red-200',
    anzahlung_erhalten: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    vollstaendig_bezahlt: 'bg-green-100 text-green-700 border-green-200',
    erstattet: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`text-xs rounded-full px-1.5 py-0.5 border ${colors[val] ?? 'bg-muted text-muted-foreground border-border'}`}>
      {label}
    </span>
  );
}

// ─── Loading / Error ──────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-10 w-64" />
      <div className="flex gap-3 overflow-hidden">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-64 flex-1 rounded-xl" />)}
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte lade die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktiere den Support.</p>}
    </div>
  );
}
