import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useFetcher } from "react-router";
import {
  DEFAULT_FORM_SETTINGS,
  DEFAULT_STYLE_TOKENS,
  autoFieldWidth,
  type BuilderField,
  type FormBuilderConfig,
} from "../../domain/forms/builder-schema";
import type { FormLifecycleState } from "../../domain/forms/builder-service.server";
import {
  FIELD_REGISTRY,
  type BuilderFieldType,
} from "../../domain/forms/field-registry";
import { FieldLibrary } from "./field-library";
import { FormCanvas } from "./form-canvas";
import {
  moveBuilderField,
  normalizeBuilderConfigForColumns,
  placeLibraryField,
  type DropPosition,
} from "./builder-dnd";
import {
  FieldSettingsPanel,
  FormSettingsPanel,
  StyleSettingsPanel,
} from "./settings-panel";

type PreviewMode = "desktop" | "tablet" | "mobile";
type Panel = "field" | "form" | "style";

export const defaultBuilderConfig: FormBuilderConfig = {
  columns: 1,
  settings: DEFAULT_FORM_SETTINGS,
  style: DEFAULT_STYLE_TOKENS,
  fields: [],
};

export function createBuilderField(
  type: BuilderFieldType,
  index: number,
): BuilderField {
  const definition = FIELD_REGISTRY[type];
  const id = `field_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  return {
    id,
    type,
    label: definition.label,
    name: `${type}_${index + 1}`,
    description: "",
    placeholder: definition.supportsPlaceholder
      ? `Enter ${definition.label.toLowerCase()}`
      : "",
    defaultValue: "",
    required: false,
    disabled: false,
    hidden: false,
    row: Math.floor(index / 1) + 1,
    column: 1,
    width: autoFieldWidth(1),
    widthMode: "auto",
    options: definition.supportsOptions
      ? [
          { label: "Option 1", value: "option_1" },
          { label: "Option 2", value: "option_2" },
        ]
      : [],
    validation: {},
  };
}

function previewWidth(mode: PreviewMode) {
  return mode === "mobile"
    ? "max-w-sm"
    : mode === "tablet"
      ? "max-w-2xl"
      : "max-w-5xl";
}

export function BuilderShell({
  form,
  initialConfig,
  shortcode,
}: {
  form: {
    id: string;
    publicId: string;
    name: string;
    status: "DRAFT" | "PUBLISHED" | "DISABLED";
    lifecycleState: FormLifecycleState;
    hasPendingDraft: boolean;
  };
  initialConfig: FormBuilderConfig;
  shortcode: string;
}) {
  const fetcher = useFetcher<{
    ok?: boolean;
    error?: string;
    issues?: { message: string }[];
  }>();
  const [config, setConfig] = useState(initialConfig);
  const [name, setName] = useState(form.name);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(
    config.fields[0]?.id ?? null,
  );
  const [panel, setPanel] = useState<Panel>("form");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [activeType, setActiveType] = useState<BuilderFieldType | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<DropPosition>("before");
  const [dirty, setDirty] = useState(false);
  const hasPendingDraft = form.hasPendingDraft;
  const lifecycleState = form.lifecycleState;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const selectedField = useMemo(
    () => config.fields.find((field) => field.id === selectedFieldId) ?? null,
    [config.fields, selectedFieldId],
  );
  const isSaving = fetcher.state !== "idle";

  const updateConfig = (next: FormBuilderConfig) => {
    setConfig(next);
    setDirty(true);
  };

  const save = (
    intent: "save" | "publish" | "disable" | "duplicate" | "delete",
  ) => {
    const payload =
      intent === "duplicate" ? { name: `${name} copy` } : { name, config };
    fetcher.submit(
      { intent, payload: JSON.stringify(payload) },
      { method: "post", encType: "application/x-www-form-urlencoded" },
    );
    if (intent === "save") setDirty(false);
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const draggedField = config.fields.find(
      (field) => field.id === String(active.id),
    );
    const type =
      (active.data.current?.type as BuilderFieldType | undefined) ??
      draggedField?.type;
    setActiveType(type ?? null);
    setActiveId(String(active.id));
    setOverId(String(active.id));
    setDropPosition("before");
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) {
      setOverId(null);
      return;
    }
    const nextOverId = String(over.id);
    setOverId(nextOverId);
    if (active.id === over.id || nextOverId.startsWith("canvas-cell:")) return;

    const activeRect = active.rect.current.translated;
    const overRect = over.rect;
    if (!activeRect || !overRect) return;
    const activeCenterY = activeRect.top + activeRect.height / 2;
    const activeCenterX = activeRect.left + activeRect.width / 2;
    const overCenterY = overRect.top + overRect.height / 2;
    const overCenterX = overRect.left + overRect.width / 2;
    const verticalDelta = Math.abs(activeCenterY - overCenterY);
    const horizontalDelta = Math.abs(activeCenterX - overCenterX);
    setDropPosition(
      verticalDelta >= horizontalDelta
        ? activeCenterY >= overCenterY
          ? "after"
          : "before"
        : activeCenterX >= overCenterX
          ? "after"
          : "before",
    );
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveType(null);
    setActiveId(null);
    setOverId(null);
    if (!over) return;
    if (String(active.id).startsWith("library:")) {
      const type = active.data.current?.type as BuilderFieldType;
      const field = createBuilderField(type, config.fields.length);
      updateConfig(
        placeLibraryField(config, field, String(over.id), dropPosition),
      );
      setSelectedFieldId(field.id);
      setPanel("field");
      return;
    }
    if (active.id === over.id) return;
    const nextConfig = moveBuilderField(
      config,
      String(active.id),
      String(over.id),
      dropPosition,
    );
    if (nextConfig) updateConfig(nextConfig);
  };

  const handleDragCancel = () => {
    setActiveType(null);
    setActiveId(null);
    setOverId(null);
  };

  const updateSelectedField = (patch: Partial<BuilderField>) => {
    if (!selectedField) return;
    updateConfig({
      ...config,
      fields: config.fields.map((field) =>
        field.id === selectedField.id ? { ...field, ...patch } : field,
      ),
    });
  };

  const deleteField = (id: string) => {
    updateConfig({
      ...config,
      fields: config.fields.filter((field) => field.id !== id),
    });
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const lifecycleLabel: Record<FormLifecycleState, string> = {
    DRAFT: "Draft",
    PUBLISHED: "Published",
    PUBLISHED_WITH_DRAFT: "Published · draft changes",
    DISABLED: "Disabled",
    DISABLED_WITH_DRAFT: "Disabled · draft changes",
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="min-h-screen bg-slate-50 text-slate-950">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <a href="/app/forms" className="hover:text-slate-700">
                  Forms
                </a>
                <span>/</span>
                <span>Builder</span>
              </div>
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setDirty(true);
                }}
                className="mt-1 w-full max-w-sm border-0 bg-transparent p-0 text-lg font-semibold text-slate-900 outline-none focus:ring-0"
                aria-label="Form name"
              />
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${
                lifecycleState === "PUBLISHED"
                  ? "bg-emerald-50 text-emerald-700"
                  : lifecycleState === "PUBLISHED_WITH_DRAFT"
                    ? "bg-blue-50 text-blue-700"
                    : lifecycleState === "DISABLED" ||
                        lifecycleState === "DISABLED_WITH_DRAFT"
                      ? "bg-slate-100 text-slate-600"
                      : "bg-amber-50 text-amber-700"
              }`}
            >
              {lifecycleLabel[lifecycleState]}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`hidden text-xs sm:inline ${dirty ? "text-amber-600" : "text-emerald-600"}`}
              >
                {isSaving ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}
              </span>
              <button
                type="button"
                onClick={() => save("save")}
                disabled={isSaving}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() =>
                  save(
                    hasPendingDraft || form.status !== "PUBLISHED"
                      ? "publish"
                      : "disable",
                  )
                }
                disabled={isSaving}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {hasPendingDraft || form.status !== "PUBLISHED"
                  ? "Publish"
                  : "Disable"}
              </button>
              {hasPendingDraft && form.status === "PUBLISHED" && (
                <button
                  type="button"
                  onClick={() => save("disable")}
                  disabled={isSaving}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Disable
                </button>
              )}
              <button
                type="button"
                onClick={() => save("duplicate")}
                disabled={isSaving}
                className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:block"
              >
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(`Delete ${name}? This cannot be undone.`)
                  ) {
                    save("delete");
                  }
                }}
                disabled={isSaving}
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 sm:block"
              >
                Delete
              </button>
            </div>
          </div>
          <div className="mx-auto mt-3 flex max-w-[1600px] flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>
              Form ID:{" "}
              <strong className="font-mono text-slate-700">
                {form.publicId}
              </strong>
            </span>
            <button
              type="button"
              className="font-semibold text-blue-600 hover:text-blue-700"
              onClick={() => navigator.clipboard?.writeText(shortcode)}
            >
              Copy {shortcode}
            </button>
            <div className="ml-auto flex rounded-lg bg-slate-100 p-1">
              {(["desktop", "tablet", "mobile"] as PreviewMode[]).map(
                (mode) => (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => setPreviewMode(mode)}
                    className={`rounded-md px-2.5 py-1.5 capitalize ${previewMode === mode ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-500"}`}
                  >
                    {mode}
                  </button>
                ),
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto grid max-w-[1600px] lg:grid-cols-[240px_minmax(0,1fr)_320px]">
          <FieldLibrary />
          <section className="min-w-0 border-b border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Form canvas
                </p>
                <p className="text-xs text-slate-400">
                  Drag fields to reorder and select one to edit.
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {[1, 2, 3].map((columns) => (
                  <button
                    type="button"
                    key={columns}
                    onClick={() =>
                      updateConfig({
                        ...config,
                        ...normalizeBuilderConfigForColumns(
                          config,
                          columns as 1 | 2 | 3,
                        ),
                      })
                    }
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${config.columns === columns ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
                  >
                    {columns} col
                  </button>
                ))}
              </div>
            </div>
            <div
              className={`${previewWidth(previewMode)} mx-auto transition-all`}
            >
              <FormCanvas
                config={config}
                selectedFieldId={selectedFieldId}
                onSelectField={(id) => {
                  setSelectedFieldId(id);
                  setPanel("field");
                }}
                onDeleteField={deleteField}
                activeId={activeId}
                overId={overId}
                dropPosition={dropPosition}
              />
            </div>
          </section>
          <aside className="min-h-[560px] border-l border-slate-200 bg-white">
            <div className="flex border-b border-slate-200 p-2">
              {(
                [
                  ["field", "Field"],
                  ["form", "Form"],
                  ["style", "Style"],
                ] as [Panel, string][]
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setPanel(value)}
                  className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold ${panel === value ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {panel === "field" && (
              <FieldSettingsPanel
                field={selectedField}
                columns={config.columns}
                onChange={updateSelectedField}
              />
            )}
            {panel === "form" && (
              <FormSettingsPanel
                config={config}
                onChange={(patch) =>
                  updateConfig({
                    ...config,
                    settings: { ...config.settings, ...patch },
                  })
                }
              />
            )}
            {panel === "style" && (
              <StyleSettingsPanel
                style={config.style}
                onChange={(patch) =>
                  updateConfig({
                    ...config,
                    style: { ...config.style, ...patch },
                  })
                }
              />
            )}
            {fetcher.data?.issues?.length ? (
              <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="font-semibold">
                  Check these items before publishing
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {fetcher.data.issues.map((issue, index) => (
                    <li key={`${issue.message}-${index}`}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </main>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeType ? (
          <div className="w-64 rounded-xl border border-blue-200 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-800 shadow-2xl ring-1 ring-blue-100">
            <div className="flex items-center gap-3">
              <span className="cursor-grabbing text-slate-400" aria-hidden>
                ⋮⋮
              </span>
              <span>{FIELD_REGISTRY[activeType].label}</span>
            </div>
            <p className="mt-1 pl-6 text-xs font-normal text-slate-400">
              Release to place this field
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
