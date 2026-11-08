import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  defaultAltText,
  MAX_UPLOAD_BYTES,
  prepareImageFile,
  type GallerySavePlan,
  type GallerySaveReport,
  type MediaCategory,
  type MediaItem,
} from '../api';

// Everything the admin changes on the gallery page is kept here, in the browser, and nothing is sent
// to the server until "Save" (which uses buildPlan() / applyReport()). So: edits to photo details,
// the order, removals, new photos, the splash photo and its darkening are all a draft that can be
// discarded.

type Field = 'category' | 'altText' | 'isActive';
type Edits = Partial<Pick<MediaItem, Field>>;

interface PendingPhoto {
  key: string; // page-local id ("new:1"), used where a server id would be
  file: File; // already prepared (HEIC converted)
  previewUrl: string; // object URL, so the photo can be shown before it is uploaded
  category: MediaCategory;
  altText: string;
  isActive: boolean;
}

type HeroDraft =
  | { kind: 'keep' }
  | { kind: 'remove' }
  | { kind: 'replace'; file: File; previewUrl: string };

// One tile of the gallery grid, with the draft applied on top of what the server has.
export interface DraftPhoto {
  key: string; // server id, or "new:N" for a photo that is not uploaded yet
  isNew: boolean;
  url: string;
  thumbUrl: string; // light preview for the grid: the thumbnail (or the photo itself if it has none), the local file for a new photo
  category: MediaCategory;
  altText: string;
  isActive: boolean;
  markedForDeletion: boolean;
}

export interface DraftHero {
  url: string | null; // null → the built-in default image
  state: 'saved' | 'new' | 'removed'; // as on the server / replaced by an unsaved photo / unsaved removal
  hasServerHero: boolean;
}

// A picked file that could not be added to the draft.
export interface StageFailure {
  file: File;
  reason: 'heic' | 'tooLarge';
}

export function useGalleryDraft(items: MediaItem[], savedOverlay: number) {
  const serverHero = useMemo(() => items.find((i) => i.isHero) ?? null, [items]);
  const serverPhotos = useMemo(() => items.filter((i) => !i.isHero), [items]);

  const [edits, setEdits] = useState<Record<string, Edits>>({});
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [order, setOrder] = useState<string[] | null>(null);
  const [heroDraft, setHeroDraft] = useState<HeroDraft>({ kind: 'keep' });
  const [overlayDraft, setOverlayDraft] = useState<number | null>(null);

  // Object URLs of picked files must be released when they are no longer shown.
  const urls = useRef(new Set<string>());
  const makeUrl = (file: File) => {
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    return url;
  };
  const freeUrl = (url: string) => {
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  };
  useEffect(() => {
    const all = urls.current;
    return () => all.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  const nextKey = useRef(0);

  // ---- the grid ----
  const naturalKeys = useMemo(
    () => [...serverPhotos.map((p) => p.id), ...pending.map((p) => p.key)],
    [serverPhotos, pending],
  );
  const displayedKeys = useMemo(() => {
    if (!order) return naturalKeys;
    const known = new Set(naturalKeys);
    const kept = order.filter((k) => known.has(k));
    const seen = new Set(kept);
    return [...kept, ...naturalKeys.filter((k) => !seen.has(k))];
  }, [order, naturalKeys]);
  const orderChanged = displayedKeys.some((k, i) => k !== naturalKeys[i]);

  const photos = useMemo<DraftPhoto[]>(() => {
    const byId = new Map(serverPhotos.map((p) => [p.id, p]));
    const byKey = new Map(pending.map((p) => [p.key, p]));
    return displayedKeys.flatMap((key): DraftPhoto[] => {
      const server = byId.get(key);
      if (server) {
        const e = edits[key];
        return [
          {
            key,
            isNew: false,
            url: server.url,
            thumbUrl: server.thumbnailUrl ?? server.url,
            category: e?.category ?? server.category,
            altText: e?.altText ?? server.altText,
            isActive: e?.isActive ?? server.isActive,
            markedForDeletion: deleted.has(key),
          },
        ];
      }
      const added = byKey.get(key);
      return added
        ? [
            {
              key,
              isNew: true,
              url: added.previewUrl,
              thumbUrl: added.previewUrl,
              category: added.category,
              altText: added.altText,
              isActive: added.isActive,
              markedForDeletion: false,
            },
          ]
        : [];
    });
  }, [displayedKeys, serverPhotos, pending, edits, deleted]);

  const setField = useCallback(
    <F extends Field>(key: string, field: F, value: MediaItem[F]) => {
      const server = serverPhotos.find((p) => p.id === key);
      if (server) {
        setEdits((prev) => {
          const next: Edits = { ...prev[key], [field]: value };
          if (next[field] === server[field]) delete next[field]; // back to the saved value: not a change
          const out = { ...prev };
          if (Object.keys(next).length) out[key] = next;
          else delete out[key];
          return out;
        });
      } else {
        setPending((prev) => prev.map((p) => (p.key === key ? { ...p, [field]: value } : p)));
      }
    },
    [serverPhotos],
  );

  const move = useCallback(
    (key: string, dir: -1 | 1) => {
      const i = displayedKeys.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= displayedKeys.length) return;
      const next = [...displayedKeys];
      [next[i], next[j]] = [next[j]!, next[i]!];
      setOrder(next);
    },
    [displayedKeys],
  );

  // A saved photo is only marked (and can be restored until Save); a photo that was never uploaded is just dropped.
  const toggleDelete = (key: string) => {
    const added = pending.find((p) => p.key === key);
    if (added) {
      freeUrl(added.previewUrl);
      setPending((prev) => prev.filter((p) => p.key !== key));
      return;
    }
    setDeleted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Adds picked files as new, not yet uploaded photos. HEIC is converted now, so a bad file is reported
  // straight away; the rest is checked by the server on Save.
  const stagePhotos = async (files: File[], category: MediaCategory): Promise<StageFailure[]> => {
    const failures: StageFailure[] = [];
    for (const original of files) {
      try {
        const file = await prepareImageFile(original);
        if (file.size > MAX_UPLOAD_BYTES) {
          failures.push({ file: original, reason: 'tooLarge' });
          continue;
        }
        const photo: PendingPhoto = {
          key: `new:${++nextKey.current}`,
          file,
          previewUrl: makeUrl(file),
          category,
          altText: defaultAltText(file.name),
          isActive: true,
        };
        setPending((prev) => [...prev, photo]);
      } catch {
        failures.push({ file: original, reason: 'heic' });
      }
    }
    return failures;
  };

  // ---- the splash photo ----
  const stageHero = async (original: File): Promise<StageFailure | null> => {
    try {
      const file = await prepareImageFile(original);
      if (file.size > MAX_UPLOAD_BYTES) return { file: original, reason: 'tooLarge' };
      if (heroDraft.kind === 'replace') freeUrl(heroDraft.previewUrl);
      setHeroDraft({ kind: 'replace', file, previewUrl: makeUrl(file) });
      return null;
    } catch {
      return { file: original, reason: 'heic' };
    }
  };

  const revertHero = () => {
    if (heroDraft.kind === 'replace') freeUrl(heroDraft.previewUrl);
    setHeroDraft({ kind: 'keep' });
  };

  // "Back to the default image": deletes the saved splash on Save (or just drops an unsaved new one).
  const removeHero = () => {
    if (serverHero) {
      if (heroDraft.kind === 'replace') freeUrl(heroDraft.previewUrl);
      setHeroDraft({ kind: 'remove' });
    } else {
      revertHero();
    }
  };

  const hero: DraftHero = {
    url:
      heroDraft.kind === 'replace' ? heroDraft.previewUrl : heroDraft.kind === 'remove' ? null : (serverHero?.url ?? null),
    state: heroDraft.kind === 'replace' ? 'new' : heroDraft.kind === 'remove' ? 'removed' : 'saved',
    hasServerHero: serverHero !== null,
  };

  // ---- the darkening ----
  const overlay = overlayDraft ?? savedOverlay;
  const setOverlay = (value: number) => setOverlayDraft(value === savedOverlay ? null : value);

  // ---- what is changed ----
  const existing = new Set(serverPhotos.map((p) => p.id));
  const editedIds = Object.keys(edits).filter((id) => existing.has(id) && !deleted.has(id));
  const deletedIds = [...deleted].filter((id) => existing.has(id));
  const dirtyCount =
    editedIds.length +
    deletedIds.length +
    pending.length +
    (orderChanged ? 1 : 0) +
    (heroDraft.kind === 'keep' ? 0 : 1) +
    (overlayDraft !== null && overlayDraft !== savedOverlay ? 1 : 0);

  const discard = () => {
    pending.forEach((p) => freeUrl(p.previewUrl));
    if (heroDraft.kind === 'replace') freeUrl(heroDraft.previewUrl);
    setEdits({});
    setDeleted(new Set());
    setPending([]);
    setOrder(null);
    setHeroDraft({ kind: 'keep' });
    setOverlayDraft(null);
  };

  const buildPlan = (): GallerySavePlan => ({
    deleteIds: deletedIds,
    hero:
      heroDraft.kind === 'replace'
        ? { kind: 'replace', file: heroDraft.file }
        : heroDraft.kind === 'remove' && serverHero
          ? { kind: 'remove', id: serverHero.id }
          : { kind: 'keep' },
    uploads: pending.map((p) => ({
      key: p.key,
      file: p.file,
      category: p.category,
      altText: p.altText,
      isActive: p.isActive,
    })),
    patches: editedIds.map((id) => ({ id, patch: edits[id]! })),
    order: orderChanged ? displayedKeys.filter((k) => !deleted.has(k)) : null,
    overlay: overlayDraft !== null && overlayDraft !== savedOverlay ? overlayDraft : null,
  });

  // After a save: drop from the draft exactly what reached the server and keep what failed, so
  // pressing Save again retries only that.
  const applyReport = (r: GallerySaveReport) => {
    if (r.deleted.length) {
      setDeleted((prev) => new Set([...prev].filter((id) => !r.deleted.includes(id))));
    }
    if (r.patched.length) {
      setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !r.patched.includes(id))));
    }
    if (r.uploaded.length) {
      pending.filter((p) => r.uploaded.includes(p.key)).forEach((p) => freeUrl(p.previewUrl));
      setPending((prev) => prev.filter((p) => !r.uploaded.includes(p.key)));
    }
    // Uploaded photos have server ids now; keep any unsaved arrangement pointing at them.
    setOrder((prev) => (r.orderDone ? null : prev && prev.map((k) => r.keyToId[k] ?? k)));
    if (r.heroDone && heroDraft.kind !== 'keep') revertHero();
    if (r.overlayDone) setOverlayDraft(null);
  };

  return {
    photos,
    hero,
    overlay,
    dirtyCount,
    setField,
    move,
    toggleDelete,
    stagePhotos,
    stageHero,
    removeHero,
    revertHero,
    setOverlay,
    discard,
    buildPlan,
    applyReport,
  };
}
