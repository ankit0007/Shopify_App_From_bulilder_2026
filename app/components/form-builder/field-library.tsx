import { useDraggable } from "@dnd-kit/core";
import { FIELD_GROUPS, FIELD_REGISTRY, type BuilderFieldType } from "../../domain/forms/field-registry";

function LibraryItem({ type }: { type: BuilderFieldType }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library:${type}`,
    data: { type },
  });
  const definition = FIELD_REGISTRY[type];

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left text-sm transition hover:border-slate-200 hover:bg-white ${
        isDragging ? "opacity-40" : ""
      }`}
      {...listeners}
      {...attributes}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-700">
        {definition.label.slice(0, 2).toUpperCase()}
      </span>
      <span>
        <span className="block font-medium text-slate-800">{definition.label}</span>
        <span className="block text-xs text-slate-400">{definition.description}</span>
      </span>
    </button>
  );
}

export function FieldLibrary() {
  return (
    <aside className="space-y-5 border-b border-slate-200 bg-slate-50/80 p-4 lg:border-b-0 lg:border-r">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Field library
        </p>
        <p className="mt-2 text-sm text-slate-500">Drag a field into your form.</p>
      </div>
      <div className="space-y-4">
        {FIELD_GROUPS.map((group) => (
          <section key={group.label}>
            <h2 className="mb-1 px-3 text-xs font-semibold text-slate-500">{group.label}</h2>
            <div className="space-y-0.5">
              {group.types.map((type) => (
                <LibraryItem key={type} type={type} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
